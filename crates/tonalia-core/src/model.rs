//! Modelo de datos de una canción.
//!
//! ```text
//! Song
//! ├─ home_key, bpm, looping, preview…
//! ├─ tracks: [Track]                 pistas de notas (melodía, bajo…) o de acordes (la principal es aparte)
//! └─ sections: [Section]             árbol de secciones, en orden temporal
//!    └─ content: Sections { children }          subsecciones, o bien
//!                Leaf { chords: [ChordEntry],   acordes uno tras otro (cada uno puede dejar un silencio antes)
//!                       clips:  [Clip] }        notas de cada pista, relativas a la sección
//! ```
//! Las posiciones de secciones y acordes no se guardan: se deducen sumando duraciones
//! (ver [`crate::queries::layout`]). Así mover o duplicar una sección arrastra su melodía.

use serde::{Deserialize, Serialize};

use crate::chord::Chord;
use crate::pitch::PitchClass;
use crate::scale::Key;
use crate::time::{BAR, Ticks};
use crate::rhythm::Rhythm;
use crate::strum::StrumPattern;
use crate::voicing::{Arpeggio, PreviewSettings};

pub type TrackId = u32;
pub type SectionId = u32;

pub const SONG_FORMAT_VERSION: u32 = 1;

/// Colores neón para secciones y pistas (tema "Estudio nocturno").
pub const PALETTE_COLORS: [&str; 8] = ["#5B8CFF", "#B26BFF", "#FF6BB5", "#FFB547", "#4DE1C1", "#7CE36B", "#FF7A5C", "#5CD6FF"];

pub fn palette_color(i: usize) -> String {
    PALETTE_COLORS[i % PALETTE_COLORS.len()].to_string()
}

/// Una nota con posición, duración, altura MIDI e intensidad (0..=1).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct Note {
    pub position: Ticks,
    pub length: Ticks,
    pub pitch: u8,
    pub velocity: f32,
}

impl Note {
    pub fn new(position: Ticks, length: Ticks, pitch: u8, velocity: f32) -> Self {
        Self { position, length, pitch, velocity }
    }

    pub fn end(&self) -> Ticks {
        self.position + self.length
    }
}

/// Un acorde en la pista de acordes: qué acorde, cuánto dura y cómo suena (voicing).
/// Las posiciones del voicing son relativas al inicio del acorde.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct ChordEntry {
    pub chord: Chord,
    pub length: Ticks,
    pub voicing: Vec<Note>,
    /// Silencio antes del acorde (en ticks): el hueco que queda tras el anterior.
    #[serde(default)]
    pub gap: Ticks,
    /// Si se toca arpegiado. El voicing guarda las notas del acorde; el arpegio se aplica
    /// al reproducir (ver [`ChordEntry::played`]), así se puede cambiar o quitar sin perder nada.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub arp: Option<Arpeggio>,
    /// Si se toca con un patrón de ritmo (excluye al arpegio).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rhythm: Option<Rhythm>,
    /// Cómo lo tocan las otras pistas de acordes (las que no figuran lo tocan en bloque).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub layers: Vec<ChordLayer>,
}

/// Cómo toca un acorde una pista de acordes que no es la principal: arpegiado o con ritmo.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct ChordLayer {
    pub track: TrackId,
    #[serde(default)]
    pub arp: Option<Arpeggio>,
    #[serde(default)]
    pub rhythm: Option<Rhythm>,
}

impl ChordEntry {
    pub fn new(chord: Chord, length: Ticks, voicing: Vec<Note>) -> Self {
        Self { chord, length, voicing, gap: 0, arp: None, rhythm: None, layers: Vec::new() }
    }

    /// Arpegio en una pista de acordes (`None` = la principal).
    pub fn arp_for(&self, track: Option<TrackId>) -> Option<Arpeggio> {
        match track {
            None => self.arp,
            Some(id) => self.layers.iter().find(|l| l.track == id).and_then(|l| l.arp),
        }
    }

    /// Patrón de ritmo en una pista de acordes (`None` = la principal).
    pub fn rhythm_for(&self, track: Option<TrackId>) -> Option<Rhythm> {
        match track {
            None => self.rhythm,
            Some(id) => self.layers.iter().find(|l| l.track == id).and_then(|l| l.rhythm),
        }
    }

    /// Cambia cómo toca el acorde una pista. Arpegio y ritmo se excluyen: poner uno quita el otro.
    fn set_style_for(&mut self, track: Option<TrackId>, arp: Option<Option<Arpeggio>>, rhythm: Option<Option<Rhythm>>) {
        let (mut a, mut r) = (self.arp_for(track), self.rhythm_for(track));
        if let Some(v) = arp {
            a = v;
            if a.is_some() {
                r = None;
            }
        }
        if let Some(v) = rhythm {
            r = v;
            if r.is_some() {
                a = None;
            }
        }
        match track {
            None => (self.arp, self.rhythm) = (a, r),
            Some(id) => {
                self.layers.retain(|l| l.track != id);
                if a.is_some() || r.is_some() {
                    self.layers.push(ChordLayer { track: id, arp: a, rhythm: r });
                }
            }
        }
    }

    pub fn set_arp_for(&mut self, track: Option<TrackId>, arp: Option<Arpeggio>) {
        self.set_style_for(track, Some(arp), None);
    }

    pub fn set_rhythm_for(&mut self, track: Option<TrackId>, rhythm: Option<Rhythm>) {
        self.set_style_for(track, None, Some(rhythm));
    }

    /// Lo que suena en una pista de acordes: el voicing en bloque, arpegiado o con ritmo.
    /// Posiciones relativas al acorde. `strums`: los patrones de rasgueo de la canción.
    pub fn played_for(&self, track: Option<TrackId>, strums: &[StrumPattern]) -> Vec<Note> {
        if let Some(arp) = self.arp_for(track) {
            return crate::voicing::arpeggiate(&self.voicing, self.length, &arp);
        }
        if let Some(rhythm) = self.rhythm_for(track) {
            return crate::rhythm::apply_rhythm(&self.voicing, self.length, &rhythm, strums);
        }
        self.voicing.clone()
    }

    /// Lo que suena en la pista de acordes principal.
    pub fn played(&self, strums: &[StrumPattern]) -> Vec<Note> {
        self.played_for(None, strums)
    }
}

/// Qué tiene una pista: notas sueltas (piano roll) o los acordes de la canción.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub enum TrackKind {
    #[default]
    Notes,
    /// Toca los acordes de la cinta con su propio instrumento y su propio arpegio en cada acorde.
    Chords,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct Track {
    pub id: TrackId,
    pub name: String,
    pub instrument: String,
    pub color: String,
    pub volume: f32,
    /// Paneo: -1 = izquierda, 0 = centro, 1 = derecha.
    #[serde(default)]
    pub pan: f32,
    pub muted: bool,
    pub solo: bool,
    #[serde(default)]
    pub kind: TrackKind,
}

impl Track {
    pub fn new(id: TrackId, name: impl Into<String>, instrument: impl Into<String>, color: String) -> Self {
        Self { id, name: name.into(), instrument: instrument.into(), color, volume: 0.8, pan: 0.0, muted: false, solo: false, kind: TrackKind::Notes }
    }

    pub fn is_chords(&self) -> bool {
        self.kind == TrackKind::Chords
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct ChordTrackSettings {
    pub instrument: String,
    pub volume: f32,
    /// Paneo: -1 = izquierda, 0 = centro, 1 = derecha.
    #[serde(default)]
    pub pan: f32,
    pub muted: bool,
    pub solo: bool,
}

impl Default for ChordTrackSettings {
    fn default() -> Self {
        Self { instrument: "piano".into(), volume: 0.7, pan: 0.0, muted: false, solo: false }
    }
}

/// Las notas de una pista dentro de una sección (posiciones relativas a la sección).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct Clip {
    pub track: TrackId,
    pub notes: Vec<Note>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub enum SectionContent {
    Sections { children: Vec<Section> },
    Leaf { chords: Vec<ChordEntry>, clips: Vec<Clip> },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct Section {
    pub id: SectionId,
    pub name: String,
    pub color: String,
    /// Tonalidad propia; `None` = hereda la de la sección padre o la de la canción.
    pub key: Option<Key>,
    pub content: SectionContent,
}

impl Section {
    pub fn leaf(id: SectionId, name: impl Into<String>, color: String) -> Self {
        Self { id, name: name.into(), color, key: None, content: SectionContent::Leaf { chords: Vec::new(), clips: Vec::new() } }
    }

    pub fn is_leaf(&self) -> bool {
        matches!(self.content, SectionContent::Leaf { .. })
    }

    pub fn children(&self) -> &[Section] {
        match &self.content {
            SectionContent::Sections { children } => children,
            SectionContent::Leaf { .. } => &[],
        }
    }

    /// Duración: suma de sus acordes o subsecciones. Una sección vacía ocupa un compás,
    /// para que siempre haya dónde soltar acordes.
    pub fn length(&self) -> Ticks {
        let total = match &self.content {
            SectionContent::Sections { children } => children.iter().map(Section::length).sum(),
            SectionContent::Leaf { chords, .. } => chords.iter().map(|c| c.gap + c.length).sum(),
        };
        if total > 0 { total } else { BAR }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct LoopRegion {
    pub start: Ticks,
    pub end: Ticks,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct Song {
    pub version: u32,
    pub bpm: f64,
    pub home_key: Key,
    pub sections: Vec<Section>,
    pub tracks: Vec<Track>,
    pub chord_track: ChordTrackSettings,
    pub looping: bool,
    pub loop_region: Option<LoopRegion>,
    pub preview: PreviewSettings,
    /// Patrones de rasgueo hechos a mano para esta canción.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub strum_patterns: Vec<StrumPattern>,
    /// Próximo identificador libre para secciones, pistas y patrones.
    pub next_id: u32,
}

impl Default for Song {
    fn default() -> Self {
        Self::new(Key::major(PitchClass::C), &["Melody", "Bass"])
    }
}

impl Song {
    /// Canción nueva con una sección vacía y las pistas indicadas.
    pub fn new(home_key: Key, track_names: &[&str]) -> Self {
        let mut song = Self {
            version: SONG_FORMAT_VERSION,
            bpm: 100.0,
            home_key,
            sections: Vec::new(),
            tracks: Vec::new(),
            chord_track: ChordTrackSettings::default(),
            looping: true,
            loop_region: None,
            preview: PreviewSettings::default(),
            strum_patterns: Vec::new(),
            next_id: 1,
        };
        let id = song.alloc_id();
        song.sections.push(Section::leaf(id, "A", palette_color(0)));
        for (i, name) in track_names.iter().enumerate() {
            let id = song.alloc_id();
            song.tracks.push(Track::new(id, *name, "piano", palette_color(i + 4)));
        }
        song
    }

    pub fn alloc_id(&mut self) -> u32 {
        let id = self.next_id;
        self.next_id += 1;
        id
    }

    pub fn track(&self, id: TrackId) -> Option<&Track> {
        self.tracks.iter().find(|t| t.id == id)
    }

    pub fn track_mut(&mut self, id: TrackId) -> Option<&mut Track> {
        self.tracks.iter_mut().find(|t| t.id == id)
    }

    /// Camino de índices desde la raíz hasta la sección `id`.
    pub fn section_path(&self, id: SectionId) -> Option<Vec<usize>> {
        fn walk(sections: &[Section], id: SectionId, path: &mut Vec<usize>) -> bool {
            for (i, s) in sections.iter().enumerate() {
                path.push(i);
                if s.id == id || walk(s.children(), id, path) {
                    return true;
                }
                path.pop();
            }
            false
        }
        let mut path = Vec::new();
        walk(&self.sections, id, &mut path).then_some(path)
    }

    pub fn section(&self, id: SectionId) -> Option<&Section> {
        let path = self.section_path(id)?;
        let mut list = &self.sections;
        let (last, parents) = path.split_last()?;
        for &i in parents {
            list = match &list.get(i)?.content {
                SectionContent::Sections { children } => children,
                SectionContent::Leaf { .. } => return None,
            };
        }
        list.get(*last)
    }

    /// Lista de secciones hermanas en `parent_path` (vacío = nivel superior).
    pub fn siblings_at_mut(&mut self, parent_path: &[usize]) -> Option<&mut Vec<Section>> {
        let mut list = &mut self.sections;
        for &i in parent_path {
            list = match &mut list.get_mut(i)?.content {
                SectionContent::Sections { children } => children,
                SectionContent::Leaf { .. } => return None,
            };
        }
        Some(list)
    }

    pub fn section_at_path_mut(&mut self, path: &[usize]) -> Option<&mut Section> {
        let (last, parents) = path.split_last()?;
        self.siblings_at_mut(parents)?.get_mut(*last)
    }

    pub fn section_mut(&mut self, id: SectionId) -> Option<&mut Section> {
        let path = self.section_path(id)?;
        self.section_at_path_mut(&path)
    }

    /// Tonalidad que rige en la sección: la propia, la de un ancestro o la de la canción.
    pub fn effective_key(&self, id: SectionId) -> Option<Key> {
        let path = self.section_path(id)?;
        let mut key = &self.home_key;
        let mut list = &self.sections;
        for &i in &path {
            let s = &list[i];
            if let Some(k) = &s.key {
                key = k;
            }
            list = match &s.content {
                SectionContent::Sections { children } => children,
                SectionContent::Leaf { .. } => list,
            };
        }
        Some(key.clone())
    }

    /// Recorre todas las secciones hoja (las que tienen acordes y clips).
    pub fn for_each_leaf_mut(&mut self, mut f: impl FnMut(&mut Vec<ChordEntry>, &mut Vec<Clip>)) {
        fn walk(sections: &mut [Section], f: &mut impl FnMut(&mut Vec<ChordEntry>, &mut Vec<Clip>)) {
            for s in sections {
                match &mut s.content {
                    SectionContent::Sections { children } => walk(children, f),
                    SectionContent::Leaf { chords, clips } => f(chords, clips),
                }
            }
        }
        walk(&mut self.sections, &mut f);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancion_nueva() {
        let song = Song::default();
        assert_eq!(song.sections.len(), 1);
        assert_eq!(song.tracks.len(), 2);
        assert_eq!(song.sections[0].length(), BAR);
        assert_eq!(song.next_id, 4);
    }

    #[test]
    fn json_de_ida_y_vuelta() {
        let mut song = Song::default();
        if let SectionContent::Leaf { clips, .. } = &mut song.sections[0].content {
            clips.push(Clip { track: 2, notes: vec![Note::new(0, 100, 60, 0.5)] });
        }
        let json = serde_json::to_string_pretty(&song).unwrap();
        assert!(json.contains("\"homeKey\""));
        assert!(json.contains("\"kind\": \"leaf\""));
        let back: Song = serde_json::from_str(&json).unwrap();
        assert_eq!(back, song);
    }
}
