//! La "vista" de la canción que recibe la interfaz: la canción más todo lo que se deduce
//! de ella (posiciones, nombres, función, tensión, puntuación respecto al acorde anterior).
//! Con esto la interfaz dibuja sin tener que volver a preguntar a Rust.

use serde::Serialize;

use crate::chord::Chord;
use crate::harmony::{Function, Transition, function_of, score, tension};
use crate::model::{Note, SectionId, Song, TrackId};
use crate::naming::{roman, suffix};
use crate::pitch::SpelledNote;
use crate::queries::{layout, track_notes};
use crate::scale::Key;
use crate::time::Ticks;

/// Todo lo que hace falta para mostrar un acorde en una tonalidad.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChordLabel {
    pub root: SpelledNote,
    pub suffix: String,
    pub roman: String,
    pub function: Function,
    pub tension: f32,
    pub pitch_classes: Vec<u8>,
}

pub fn describe(chord: &Chord, key: &Key) -> ChordLabel {
    ChordLabel {
        root: key.spell(chord.root),
        suffix: suffix(chord),
        roman: roman(chord, key),
        function: function_of(chord, key),
        tension: tension(chord, key),
        pitch_classes: chord.pitch_classes().into_iter().map(u8::from).collect(),
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SectionView {
    pub id: SectionId,
    pub parent: Option<SectionId>,
    pub depth: usize,
    pub start: Ticks,
    pub length: Ticks,
    pub name: String,
    pub color: String,
    pub is_leaf: bool,
    /// Tonalidad efectiva y si es propia (no heredada).
    pub key: Key,
    pub has_own_key: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChordView {
    pub section: SectionId,
    pub index: usize,
    pub start: Ticks,
    pub length: Ticks,
    pub chord: Chord,
    pub label: ChordLabel,
    /// Puntuación respecto al acorde anterior en la línea de tiempo.
    pub transition: Transition,
    /// Notas del voicing con posiciones absolutas.
    pub voicing: Vec<Note>,
    pub key: Key,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackNotes {
    pub track: TrackId,
    pub notes: Vec<Note>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SongView {
    pub song: Song,
    pub length: Ticks,
    pub sections: Vec<SectionView>,
    pub chords: Vec<ChordView>,
    pub track_notes: Vec<TrackNotes>,
    pub can_undo: bool,
    pub can_redo: bool,
}

pub fn song_view(song: &Song, can_undo: bool, can_redo: bool) -> SongView {
    let l = layout(song);
    let sections = l
        .sections
        .iter()
        .map(|p| SectionView {
            id: p.section.id,
            parent: p.parent,
            depth: p.depth,
            start: p.start,
            length: p.length,
            name: p.section.name.clone(),
            color: p.section.color.clone(),
            is_leaf: p.section.is_leaf(),
            key: p.key.clone(),
            has_own_key: p.section.key.is_some(),
        })
        .collect();

    let mut previous: Option<&Chord> = None;
    let mut chords = Vec::with_capacity(l.chords.len());
    for c in &l.chords {
        let chord = &c.entry.chord;
        chords.push(ChordView {
            section: c.section,
            index: c.index,
            start: c.start,
            length: c.entry.length,
            chord: chord.clone(),
            label: describe(chord, &c.key),
            transition: score(previous, chord, c.key.root),
            voicing: c.entry.voicing.iter().map(|n| Note { position: n.position + c.start, ..n.clone() }).collect(),
            key: c.key.clone(),
        });
        previous = Some(chord);
    }

    let track_notes = song.tracks.iter().map(|t| TrackNotes { track: t.id, notes: track_notes(song, t.id) }).collect();

    SongView { song: song.clone(), length: l.length, sections, chords, track_notes, can_undo, can_redo }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::{EditCommand, apply};
    use crate::harmony::Reason;
    use crate::pitch::PitchClass;

    #[test]
    fn vista_de_una_progresion() {
        let mut song = Song::default();
        let s = song.sections[0].id;
        for (i, chord) in [Chord::minor7(PitchClass::D), Chord::dominant7(PitchClass::G), Chord::major7(PitchClass::C)].into_iter().enumerate() {
            apply(&mut song, &EditCommand::InsertChord { section: s, index: i, chord, length: None }).unwrap();
        }
        let view = song_view(&song, false, false);
        let romans: Vec<&str> = view.chords.iter().map(|c| c.label.roman.as_str()).collect();
        assert_eq!(romans, ["ii7", "V7", "Imaj7"]);
        assert_eq!(view.chords[0].transition.reason, Reason::NoContext);
        assert_eq!(view.chords[1].transition.reason, Reason::FifthDown);
        assert_eq!(view.chords[2].transition.score, 1.0);
        assert_eq!(view.chords[2].label.function, Function::Tonic);
        assert_eq!(view.chords[1].voicing[0].position, view.chords[1].start);
        let json = serde_json::to_value(&view).unwrap();
        assert!(json["chords"][0]["label"]["pitchClasses"].is_array());
    }
}
