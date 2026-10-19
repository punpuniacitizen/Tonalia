//! Comandos de edición: la única forma de cambiar una canción.
//!
//! La interfaz envía un [`EditCommand`] (como JSON) y [`apply`] lo aplica. El historial
//! ([`crate::history::Document`]) aplica cada comando sobre una copia, así un error a mitad
//! de camino nunca deja la canción a medio modificar.

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::chord::Chord;
use crate::model::{ChordEntry, Clip, LoopRegion, Note, Section, SectionContent, SectionId, Song, Track, TrackId, palette_color};
use crate::queries::layout;
use crate::scale::Key;
use crate::time::{BAR, SIXTY_FOURTH, Ticks};
use crate::voicing::{PreviewSettings, default_voicing, fit_voicing};

/// Duración mínima de un acorde (1/64).
pub const MIN_CHORD_LENGTH: Ticks = SIXTY_FOURTH;

/// Referencia a un acorde: sección hoja + posición dentro de ella.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChordRef {
    pub section: SectionId,
    pub index: usize,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum EditCommand {
    SetBpm { bpm: f64 },
    SetHomeKey { key: Key },
    SetLooping { looping: bool },
    SetLoopRegion { region: Option<LoopRegion> },
    SetPreviewSettings { settings: PreviewSettings },

    /// Inserta un acorde con el voicing por defecto. Sin `length` dura un compás.
    InsertChord { section: SectionId, index: usize, chord: Chord, length: Option<Ticks> },
    /// Cambia el acorde conservando su duración (el voicing se regenera).
    ReplaceChord { at: ChordRef, chord: Chord },
    RemoveChords { chords: Vec<ChordRef> },
    ResizeChord { at: ChordRef, length: Ticks },
    /// Mueve un acorde; `to.index` es la posición de inserción antes de quitarlo.
    MoveChord { from: ChordRef, to: ChordRef },
    SetVoicing { at: ChordRef, voicing: Vec<Note> },

    AddTrack { name: String, instrument: String },
    RemoveTrack { track: TrackId },
    UpdateTrack {
        track: TrackId,
        name: Option<String>,
        instrument: Option<String>,
        volume: Option<f32>,
        muted: Option<bool>,
        solo: Option<bool>,
    },
    UpdateChordTrack { instrument: Option<String>, volume: Option<f32>, muted: Option<bool>, solo: Option<bool> },
    /// Reemplaza todas las notas de una pista. Las posiciones son absolutas; cada nota
    /// se guarda en la sección donde empieza.
    SetTrackNotes { track: TrackId, notes: Vec<Note> },

    /// Nueva sección vacía. Si `parent` es una hoja con contenido, ese contenido pasa a
    /// una primera subsección para no perderlo.
    AddSection { parent: Option<SectionId>, index: usize, name: String },
    RemoveSection { section: SectionId },
    UpdateSection { section: SectionId, name: Option<String>, color: Option<String> },
    SetSectionKey { section: SectionId, key: Option<Key> },
    /// Envuelve secciones hermanas y contiguas en una sección nueva.
    WrapInSection { sections: Vec<SectionId>, name: String },

    /// Varios comandos como un solo paso de deshacer.
    Batch { commands: Vec<EditCommand> },
}

impl EditCommand {
    /// Los ajustes de previsualización no son parte de la "obra": no ensucian el historial.
    pub fn is_undoable(&self) -> bool {
        !matches!(self, EditCommand::SetPreviewSettings { .. })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum EditError {
    #[error("no existe la sección {0}")]
    SectionNotFound(SectionId),
    #[error("la sección {0} tiene subsecciones y no admite acordes ni notas")]
    NotALeaf(SectionId),
    #[error("no hay acorde {index} en la sección {section}")]
    ChordNotFound { section: SectionId, index: usize },
    #[error("no existe la pista {0}")]
    TrackNotFound(TrackId),
    #[error("no se puede borrar la última sección")]
    CannotRemoveLastSection,
    #[error("las secciones deben ser hermanas y contiguas")]
    NotContiguousSiblings,
    #[error("valor no válido: {0}")]
    InvalidValue(String),
}

fn leaf_mut(song: &mut Song, id: SectionId) -> Result<(&mut Vec<ChordEntry>, &mut Vec<Clip>), EditError> {
    match &mut song.section_mut(id).ok_or(EditError::SectionNotFound(id))?.content {
        SectionContent::Leaf { chords, clips } => Ok((chords, clips)),
        SectionContent::Sections { .. } => Err(EditError::NotALeaf(id)),
    }
}

fn chord_mut(song: &mut Song, at: ChordRef) -> Result<&mut ChordEntry, EditError> {
    let (chords, _) = leaf_mut(song, at.section)?;
    chords.get_mut(at.index).ok_or(EditError::ChordNotFound { section: at.section, index: at.index })
}

fn key_of(song: &Song, section: SectionId) -> Result<Key, EditError> {
    song.effective_key(section).ok_or(EditError::SectionNotFound(section))
}

pub fn apply(song: &mut Song, cmd: &EditCommand) -> Result<(), EditError> {
    use EditCommand::*;
    match cmd {
        SetBpm { bpm } => {
            if !bpm.is_finite() {
                return Err(EditError::InvalidValue(format!("bpm {bpm}")));
            }
            song.bpm = bpm.clamp(20.0, 400.0);
        }
        SetHomeKey { key } => song.home_key = key.clone(),
        SetLooping { looping } => song.looping = *looping,
        SetLoopRegion { region } => song.loop_region = region.filter(|r| r.end > r.start && r.start >= 0),
        SetPreviewSettings { settings } => {
            song.preview = PreviewSettings {
                octave: settings.octave.min(8),
                strumming: settings.strumming.max(0),
                velocity: settings.velocity.clamp(0.0, 1.0),
            }
        }

        InsertChord { section, index, chord, length } => {
            let length = length.unwrap_or(BAR).max(MIN_CHORD_LENGTH);
            let key = key_of(song, *section)?;
            let voicing = default_voicing(chord, length, &song.preview, key.root);
            let (chords, _) = leaf_mut(song, *section)?;
            let index = (*index).min(chords.len());
            chords.insert(index, ChordEntry { chord: chord.clone(), length, voicing });
        }
        ReplaceChord { at, chord } => {
            let key = key_of(song, at.section)?;
            let preview = song.preview;
            let entry = chord_mut(song, *at)?;
            entry.voicing = default_voicing(chord, entry.length, &preview, key.root);
            entry.chord = chord.clone();
        }
        RemoveChords { chords } => {
            // De atrás hacia delante, para que los índices pendientes sigan siendo válidos.
            let mut refs = chords.clone();
            refs.sort_by(|a, b| a.section.cmp(&b.section).then(b.index.cmp(&a.index)));
            refs.dedup();
            for r in refs {
                let (list, _) = leaf_mut(song, r.section)?;
                if r.index >= list.len() {
                    return Err(EditError::ChordNotFound { section: r.section, index: r.index });
                }
                list.remove(r.index);
            }
        }
        ResizeChord { at, length } => {
            let length = (*length).max(MIN_CHORD_LENGTH);
            let entry = chord_mut(song, *at)?;
            entry.voicing = fit_voicing(&entry.voicing, entry.length, length);
            entry.length = length;
        }
        MoveChord { from, to } => {
            let entry = {
                let (list, _) = leaf_mut(song, from.section)?;
                if from.index >= list.len() {
                    return Err(EditError::ChordNotFound { section: from.section, index: from.index });
                }
                list.remove(from.index)
            };
            let mut index = to.index;
            if from.section == to.section && from.index < to.index {
                index -= 1;
            }
            let (list, _) = leaf_mut(song, to.section)?;
            let index = index.min(list.len());
            list.insert(index, entry);
        }
        SetVoicing { at, voicing } => {
            let entry = chord_mut(song, *at)?;
            entry.voicing = voicing.iter().map(sanitize_note).collect();
        }

        AddTrack { name, instrument } => {
            let id = song.alloc_id();
            let color = palette_color(song.tracks.len() + 4);
            song.tracks.push(Track::new(id, name.clone(), instrument.clone(), color));
        }
        RemoveTrack { track } => {
            let before = song.tracks.len();
            song.tracks.retain(|t| t.id != *track);
            if song.tracks.len() == before {
                return Err(EditError::TrackNotFound(*track));
            }
            song.for_each_leaf_mut(|_, clips| clips.retain(|c| c.track != *track));
        }
        UpdateTrack { track, name, instrument, volume, muted, solo } => {
            let t = song.track_mut(*track).ok_or(EditError::TrackNotFound(*track))?;
            if let Some(v) = name {
                t.name = v.clone();
            }
            if let Some(v) = instrument {
                t.instrument = v.clone();
            }
            if let Some(v) = volume {
                t.volume = v.clamp(0.0, 1.0);
            }
            if let Some(v) = muted {
                t.muted = *v;
            }
            if let Some(v) = solo {
                t.solo = *v;
            }
        }
        UpdateChordTrack { instrument, volume, muted, solo } => {
            let t = &mut song.chord_track;
            if let Some(v) = instrument {
                t.instrument = v.clone();
            }
            if let Some(v) = volume {
                t.volume = v.clamp(0.0, 1.0);
            }
            if let Some(v) = muted {
                t.muted = *v;
            }
            if let Some(v) = solo {
                t.solo = *v;
            }
        }
        SetTrackNotes { track, notes } => {
            if song.track(*track).is_none() {
                return Err(EditError::TrackNotFound(*track));
            }
            let leaves: Vec<(SectionId, Ticks)> = layout(song)
                .sections
                .iter()
                .filter(|p| p.section.is_leaf())
                .map(|p| (p.section.id, p.start))
                .collect();
            let mut buckets: Vec<Vec<Note>> = vec![Vec::new(); leaves.len()];
            for n in notes {
                let mut n = sanitize_note(n);
                let i = leaves.iter().rposition(|&(_, start)| start <= n.position).unwrap_or(0);
                n.position -= leaves[i].1;
                buckets[i].push(n);
            }
            for (&(id, _), mut notes) in leaves.iter().zip(buckets) {
                notes.sort_by_key(|n| (n.position, n.pitch));
                let (_, clips) = leaf_mut(song, id)?;
                clips.retain(|c| c.track != *track);
                if !notes.is_empty() {
                    clips.push(Clip { track: *track, notes });
                }
            }
        }

        AddSection { parent, index, name } => {
            let id = song.alloc_id();
            let new = Section::leaf(id, name.clone(), palette_color(id as usize));
            match parent {
                None => {
                    let i = (*index).min(song.sections.len());
                    song.sections.insert(i, new);
                }
                Some(pid) => {
                    let first_child_id = song.alloc_id();
                    let p = song.section_mut(*pid).ok_or(EditError::SectionNotFound(*pid))?;
                    if p.is_leaf() {
                        let old = std::mem::replace(&mut p.content, SectionContent::Sections { children: Vec::new() });
                        let has_content = match &old {
                            SectionContent::Leaf { chords, clips } => !chords.is_empty() || !clips.is_empty(),
                            SectionContent::Sections { .. } => false,
                        };
                        if has_content {
                            let first = Section { id: first_child_id, name: p.name.clone(), color: p.color.clone(), key: None, content: old };
                            if let SectionContent::Sections { children } = &mut p.content {
                                children.push(first);
                            }
                        }
                    }
                    if let SectionContent::Sections { children } = &mut p.content {
                        let i = (*index).min(children.len());
                        children.insert(i, new);
                    }
                }
            }
        }
        RemoveSection { section } => {
            let path = song.section_path(*section).ok_or(EditError::SectionNotFound(*section))?;
            if path.len() == 1 && song.sections.len() == 1 {
                return Err(EditError::CannotRemoveLastSection);
            }
            let (last, parent_path) = path.split_last().expect("el camino nunca está vacío");
            let siblings = song.siblings_at_mut(parent_path).expect("el padre existe");
            siblings.remove(*last);
            // Una sección que se queda sin hijas vuelve a ser una hoja vacía.
            if siblings.is_empty() && !parent_path.is_empty() {
                if let Some(parent) = song.section_at_path_mut(parent_path) {
                    parent.content = SectionContent::Leaf { chords: Vec::new(), clips: Vec::new() };
                }
            }
        }
        UpdateSection { section, name, color } => {
            let s = song.section_mut(*section).ok_or(EditError::SectionNotFound(*section))?;
            if let Some(v) = name {
                s.name = v.clone();
            }
            if let Some(v) = color {
                s.color = v.clone();
            }
        }
        SetSectionKey { section, key } => {
            song.section_mut(*section).ok_or(EditError::SectionNotFound(*section))?.key = key.clone();
        }
        WrapInSection { sections, name } => {
            let mut paths = Vec::with_capacity(sections.len());
            for id in sections {
                paths.push(song.section_path(*id).ok_or(EditError::SectionNotFound(*id))?);
            }
            let Some(first_path) = paths.first() else {
                return Err(EditError::InvalidValue("no hay secciones que envolver".into()));
            };
            let parent: Vec<usize> = first_path[..first_path.len() - 1].to_vec();
            if paths.iter().any(|p| p[..p.len() - 1] != parent[..]) {
                return Err(EditError::NotContiguousSiblings);
            }
            let mut indices: Vec<usize> = paths.iter().map(|p| *p.last().unwrap()).collect();
            indices.sort_unstable();
            indices.dedup();
            if indices.windows(2).any(|w| w[1] != w[0] + 1) {
                return Err(EditError::NotContiguousSiblings);
            }
            let id = song.alloc_id();
            let siblings = song.siblings_at_mut(&parent).expect("el padre existe");
            let (first, last) = (indices[0], *indices.last().unwrap());
            let children: Vec<Section> = siblings.drain(first..=last).collect();
            siblings.insert(first, Section { id, name: name.clone(), color: palette_color(id as usize), key: None, content: SectionContent::Sections { children } });
        }

        Batch { commands } => {
            for c in commands {
                apply(song, c)?;
            }
        }
    }
    Ok(())
}

fn sanitize_note(n: &Note) -> Note {
    Note { position: n.position.max(0), length: n.length.max(1), pitch: n.pitch.min(127), velocity: n.velocity.clamp(0.0, 1.0) }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pitch::PitchClass;
    use crate::queries::{layout, track_notes};
    use crate::time::HALF;

    fn insert(song: &mut Song, root: u8) {
        let section = song.sections[0].id;
        let index = usize::MAX;
        apply(song, &EditCommand::InsertChord { section, index, chord: Chord::major(PitchClass::from(root)), length: None }).unwrap();
    }

    fn roots(song: &Song) -> Vec<u8> {
        layout(song).chords.iter().map(|c| c.entry.chord.root.value()).collect()
    }

    #[test]
    fn insertar_mover_borrar() {
        let mut song = Song::default();
        for r in [0, 9, 5, 7] {
            insert(&mut song, r);
        }
        assert_eq!(roots(&song), vec![0, 9, 5, 7]);
        let s = song.sections[0].id;
        apply(&mut song, &EditCommand::MoveChord { from: ChordRef { section: s, index: 0 }, to: ChordRef { section: s, index: 3 } }).unwrap();
        assert_eq!(roots(&song), vec![9, 5, 0, 7]);
        apply(&mut song, &EditCommand::RemoveChords { chords: vec![ChordRef { section: s, index: 0 }, ChordRef { section: s, index: 2 }] }).unwrap();
        assert_eq!(roots(&song), vec![5, 7]);
        let err = apply(&mut song, &EditCommand::RemoveChords { chords: vec![ChordRef { section: s, index: 9 }] });
        assert_eq!(err, Err(EditError::ChordNotFound { section: s, index: 9 }));
    }

    #[test]
    fn voicing_y_duracion() {
        let mut song = Song::default();
        insert(&mut song, 7);
        let at = ChordRef { section: song.sections[0].id, index: 0 };
        apply(&mut song, &EditCommand::ResizeChord { at, length: HALF }).unwrap();
        let l = layout(&song);
        let e = l.chords[0].entry;
        assert_eq!(e.length, HALF);
        assert!(e.voicing.iter().all(|n| n.end() == HALF));
        assert_eq!(e.voicing[0].pitch, 55); // Sol3: la fundamental queda por encima de la tónica Do
    }

    #[test]
    fn notas_repartidas_por_seccion() {
        let mut song = Song::default();
        insert(&mut song, 0);
        apply(&mut song, &EditCommand::AddSection { parent: None, index: 1, name: "B".into() }).unwrap();
        let track = song.tracks[0].id;
        let notes = vec![Note::new(100, 50, 60, 0.5), Note::new(BAR + 10, 50, 64, 0.5)];
        apply(&mut song, &EditCommand::SetTrackNotes { track, notes: notes.clone() }).unwrap();
        // La segunda nota vive en la sección B, en posición relativa 10.
        if let SectionContent::Leaf { clips, .. } = &song.sections[1].content {
            assert_eq!(clips[0].notes[0].position, 10);
        } else {
            panic!("B debería ser hoja");
        }
        assert_eq!(track_notes(&song, track), notes);
    }

    #[test]
    fn subsecciones_y_envolver() {
        let mut song = Song::default();
        insert(&mut song, 0);
        let a = song.sections[0].id;
        // Añadir una subsección a una hoja con acordes conserva los acordes en una primera hija.
        apply(&mut song, &EditCommand::AddSection { parent: Some(a), index: 1, name: "A2".into() }).unwrap();
        let children = song.sections[0].children();
        assert_eq!(children.len(), 2);
        assert_eq!(roots(&song), vec![0]);
        // Envolver las dos hijas.
        let ids: Vec<SectionId> = children.iter().map(|s| s.id).collect();
        apply(&mut song, &EditCommand::WrapInSection { sections: ids.clone(), name: "W".into() }).unwrap();
        assert_eq!(song.sections[0].children().len(), 1);
        assert_eq!(song.sections[0].children()[0].children().len(), 2);
        // Borrar las dos: la sección W vuelve a ser una hoja vacía.
        apply(&mut song, &EditCommand::RemoveSection { section: ids[0] }).unwrap();
        apply(&mut song, &EditCommand::RemoveSection { section: ids[1] }).unwrap();
        assert!(song.sections[0].children()[0].is_leaf());
        assert_eq!(apply(&mut Song::default(), &EditCommand::RemoveSection { section: 1 }), Err(EditError::CannotRemoveLastSection));
    }

    #[test]
    fn comandos_en_json() {
        let json = r#"{"type":"insertChord","section":1,"index":0,"chord":{"root":7,"intervals":[4,7,10]},"length":null}"#;
        let cmd: EditCommand = serde_json::from_str(json).unwrap();
        let mut song = Song::default();
        apply(&mut song, &cmd).unwrap();
        assert_eq!(layout(&song).chords[0].entry.chord, Chord::dominant7(PitchClass::G));
        let back = serde_json::to_string(&EditCommand::ResizeChord { at: ChordRef { section: 1, index: 0 }, length: 5 }).unwrap();
        assert_eq!(back, r#"{"type":"resizeChord","at":{"section":1,"index":0},"length":5}"#);
    }
}
