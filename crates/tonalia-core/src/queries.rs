//! Consultas sobre la canción: dónde empieza cada sección y acorde, qué suena en un instante,
//! qué tonalidad rige, qué notas hay en una región.

use crate::model::{ChordEntry, Note, Section, SectionContent, SectionId, Song, TrackId};
use crate::scale::Key;
use crate::time::Ticks;

/// Una sección colocada en la línea de tiempo.
#[derive(Clone, Debug)]
pub struct PlacedSection<'a> {
    pub section: &'a Section,
    pub parent: Option<SectionId>,
    pub depth: usize,
    pub start: Ticks,
    pub length: Ticks,
    /// Tonalidad efectiva (propia o heredada).
    pub key: Key,
}

/// Un acorde colocado en la línea de tiempo.
#[derive(Clone, Debug)]
pub struct PlacedChord<'a> {
    pub section: SectionId,
    pub index: usize,
    pub start: Ticks,
    pub entry: &'a ChordEntry,
    pub key: Key,
}

impl PlacedChord<'_> {
    pub fn end(&self) -> Ticks {
        self.start + self.entry.length
    }
}

#[derive(Clone, Debug, Default)]
pub struct Layout<'a> {
    /// En orden de recorrido: cada sección antes que sus hijas.
    pub sections: Vec<PlacedSection<'a>>,
    pub chords: Vec<PlacedChord<'a>>,
    pub length: Ticks,
}

pub fn layout(song: &Song) -> Layout<'_> {
    let mut out = Layout::default();
    out.length = walk(&song.sections, None, 0, 0, &song.home_key, &mut out);
    out
}

fn walk<'a>(sections: &'a [Section], parent: Option<SectionId>, depth: usize, mut start: Ticks, inherited: &Key, out: &mut Layout<'a>) -> Ticks {
    for s in sections {
        let key = s.key.clone().unwrap_or_else(|| inherited.clone());
        let length = s.length();
        out.sections.push(PlacedSection { section: s, parent, depth, start, length, key: key.clone() });
        match &s.content {
            SectionContent::Sections { children } => {
                walk(children, Some(s.id), depth + 1, start, &key, out);
            }
            SectionContent::Leaf { chords, .. } => {
                let mut t = start;
                for (index, entry) in chords.iter().enumerate() {
                    out.chords.push(PlacedChord { section: s.id, index, start: t, entry, key: key.clone() });
                    t += entry.length;
                }
            }
        }
        start += length;
    }
    start
}

pub fn song_length(song: &Song) -> Ticks {
    song.sections.iter().map(Section::length).sum()
}

/// El acorde que suena en el instante `t`.
pub fn chord_at<'l, 'a>(layout: &'l Layout<'a>, t: Ticks) -> Option<&'l PlacedChord<'a>> {
    layout.chords.iter().find(|c| c.start <= t && t < c.end())
}

/// La tonalidad que rige en el instante `t` (la de la sección más interna que lo contiene).
pub fn key_at(song: &Song, t: Ticks) -> Key {
    layout(song)
        .sections
        .iter()
        .filter(|s| s.start <= t && t < s.start + s.length)
        .max_by_key(|s| s.depth)
        .map(|s| s.key.clone())
        .unwrap_or_else(|| song.home_key.clone())
}

/// Todas las notas de una pista con posiciones absolutas, ordenadas.
pub fn track_notes(song: &Song, track: TrackId) -> Vec<Note> {
    let mut notes: Vec<Note> = layout(song)
        .sections
        .iter()
        .filter_map(|p| match &p.section.content {
            SectionContent::Leaf { clips, .. } => Some((p.start, clips)),
            SectionContent::Sections { .. } => None,
        })
        .flat_map(move |(start, clips)| {
            clips.iter().filter(move |c| c.track == track).flat_map(move |c| {
                c.notes.iter().map(move |n| Note { position: n.position + start, ..n.clone() })
            })
        })
        .collect();
    notes.sort_by_key(|n| (n.position, n.pitch));
    notes
}

/// Las notas de la pista de acordes (los voicings) con posiciones absolutas.
pub fn chord_track_notes(song: &Song) -> Vec<Note> {
    layout(song)
        .chords
        .iter()
        .flat_map(|c| c.entry.voicing.iter().map(move |n| Note { position: n.position + c.start, ..n.clone() }))
        .collect()
}

/// Notas que se cruzan con `[start, end)` y están dentro del rango de alturas.
pub fn notes_in_region(notes: &[Note], start: Ticks, end: Ticks, min_pitch: u8, max_pitch: u8) -> Vec<Note> {
    notes
        .iter()
        .filter(|n| (min_pitch..=max_pitch).contains(&n.pitch) && n.position < end && n.end() > start)
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chord::Chord;
    use crate::model::{Clip, palette_color};
    use crate::pitch::PitchClass;
    use crate::time::{BAR, HALF};

    fn entry(root: u8, length: Ticks) -> ChordEntry {
        ChordEntry { chord: Chord::major(PitchClass::from(root)), length, voicing: vec![Note::new(0, length, 60 + root, 0.8)] }
    }

    /// A [C(1 compás) G(½)] · B [Am(1)] · C (tonalidad propia: La menor) { C1 [F(1)] }
    fn sample() -> Song {
        let mut song = Song::default();
        song.sections.clear();
        song.sections.push(Section {
            id: 10,
            name: "A".into(),
            color: palette_color(0),
            key: None,
            content: SectionContent::Leaf {
                chords: vec![entry(0, BAR), entry(7, HALF)],
                clips: vec![Clip { track: 2, notes: vec![Note::new(BAR, 100, 72, 0.5)] }],
            },
        });
        song.sections.push(Section {
            id: 11,
            name: "B".into(),
            color: palette_color(1),
            key: None,
            content: SectionContent::Leaf { chords: vec![entry(9, BAR)], clips: vec![] },
        });
        let mut c1 = Section::leaf(13, "C1", palette_color(3));
        if let SectionContent::Leaf { chords, .. } = &mut c1.content {
            chords.push(entry(5, BAR));
        }
        song.sections.push(Section {
            id: 12,
            name: "C".into(),
            color: palette_color(2),
            key: Some(Key::minor(PitchClass::A)),
            content: SectionContent::Sections { children: vec![c1] },
        });
        song
    }

    #[test]
    fn posiciones_deducidas() {
        let song = sample();
        let l = layout(&song);
        assert_eq!(l.length, BAR + HALF + BAR + BAR);
        let starts: Vec<Ticks> = l.chords.iter().map(|c| c.start).collect();
        assert_eq!(starts, vec![0, BAR, BAR + HALF, 2 * BAR + HALF]);
        assert_eq!(l.sections.iter().map(|s| s.section.id).collect::<Vec<_>>(), vec![10, 11, 12, 13]);
        assert_eq!(l.sections[3].depth, 1);
        assert_eq!(song_length(&song), l.length);
    }

    #[test]
    fn acorde_y_tonalidad_en_un_instante() {
        let song = sample();
        let l = layout(&song);
        assert_eq!(chord_at(&l, BAR + 10).unwrap().entry.chord.root, PitchClass::G);
        assert!(chord_at(&l, l.length).is_none());
        assert_eq!(key_at(&song, 0), song.home_key);
        assert_eq!(key_at(&song, 3 * BAR), Key::minor(PitchClass::A));
        assert_eq!(song.effective_key(13), Some(Key::minor(PitchClass::A)));
    }

    #[test]
    fn notas_absolutas_y_region() {
        let song = sample();
        let notes = track_notes(&song, 2);
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].position, BAR);
        assert_eq!(chord_track_notes(&song).len(), 4);
        let all = chord_track_notes(&song);
        assert_eq!(notes_in_region(&all, BAR, BAR + 1, 0, 127).len(), 1);
        assert_eq!(notes_in_region(&all, 0, 10 * BAR, 0, 62).len(), 1);
    }
}
