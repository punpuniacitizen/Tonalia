//! Exportación a archivo MIDI estándar (formato 1).
//!
//! Nuestra negra mide 2592 ticks, que cabe como resolución (PPQ) del archivo: los tiempos
//! se escriben tal cual, sin redondeos. Cada pista va en su propio canal.

use midly::num::{u4, u7, u15, u24, u28};
use midly::{Format, Header, MetaMessage, MidiMessage, Smf, Timing, TrackEvent, TrackEventKind};
use thiserror::Error;

use crate::model::{Note, Song, TrackId};
use crate::queries::{chord_track_notes, track_notes};
use crate::time::{QUARTER, Ticks};

#[derive(Clone, Debug, PartialEq)]
pub struct ExportOptions {
    pub include_chords: bool,
    /// `None` = todas las pistas que no estén silenciadas.
    pub tracks: Option<Vec<TrackId>>,
    /// Solo lo que se cruza con `[inicio, fin)`; se recorta y se lleva al tiempo 0.
    pub region: Option<(Ticks, Ticks)>,
}

impl Default for ExportOptions {
    fn default() -> Self {
        Self { include_chords: true, tracks: None, region: None }
    }
}

#[derive(Debug, Error)]
pub enum ExportError {
    #[error("no se pudo escribir el MIDI: {0}")]
    Io(#[from] std::io::Error),
}

/// Canal MIDI para la pista número `i` (0 = acordes). Se salta el canal 10 (índice 9), de percusión.
fn channel_for(i: usize) -> u8 {
    let c = (i % 15) as u8;
    if c >= 9 { c + 1 } else { c }
}

fn clip_to_region(notes: Vec<Note>, region: Option<(Ticks, Ticks)>) -> Vec<Note> {
    let Some((start, end)) = region else { return notes };
    notes
        .into_iter()
        .filter(|n| n.position < end && n.end() > start)
        .map(|n| {
            let s = n.position.max(start);
            let e = n.end().min(end);
            Note { position: s - start, length: e - s, ..n }
        })
        .collect()
}

fn velocity_to_midi(v: f32) -> u8 {
    (v * 127.0).round().clamp(1.0, 127.0) as u8
}

fn note_events<'a>(name: &'a [u8], channel: u8, notes: &[Note]) -> Vec<TrackEvent<'a>> {
    // (tick, orden, evento): en un mismo tick, los note-off van antes que los note-on.
    let mut timed: Vec<(Ticks, u8, MidiMessage)> = Vec::with_capacity(notes.len() * 2);
    for n in notes {
        let key = u7::new(n.pitch.min(127));
        timed.push((n.position, 1, MidiMessage::NoteOn { key, vel: u7::new(velocity_to_midi(n.velocity)) }));
        timed.push((n.end(), 0, MidiMessage::NoteOff { key, vel: u7::new(0) }));
    }
    timed.sort_by_key(|(t, order, _)| (*t, *order));

    let mut events = vec![TrackEvent { delta: u28::new(0), kind: TrackEventKind::Meta(MetaMessage::TrackName(name)) }];
    let mut last = 0;
    for (t, _, message) in timed {
        let t = t.max(0);
        events.push(TrackEvent { delta: u28::new((t - last) as u32), kind: TrackEventKind::Midi { channel: u4::new(channel), message } });
        last = t;
    }
    events.push(TrackEvent { delta: u28::new(0), kind: TrackEventKind::Meta(MetaMessage::EndOfTrack) });
    events
}

pub fn export_smf(song: &Song, options: &ExportOptions) -> Result<Vec<u8>, ExportError> {
    // Primero reunimos (nombre, notas) con datos propios; los eventos MIDI los toman prestados.
    let mut parts: Vec<(String, Vec<Note>)> = Vec::new();
    if options.include_chords && !song.chord_track.muted {
        parts.push(("Chords".to_string(), clip_to_region(chord_track_notes(song), options.region)));
    }
    for track in &song.tracks {
        let selected = match &options.tracks {
            Some(ids) => ids.contains(&track.id),
            None => !track.muted,
        };
        if selected {
            parts.push((track.name.clone(), clip_to_region(track_notes(song, track.id), options.region)));
        }
    }

    let tempo = (60_000_000.0 / song.bpm).round() as u32;
    let mut tracks = vec![vec![
        TrackEvent { delta: u28::new(0), kind: TrackEventKind::Meta(MetaMessage::TrackName(b"Tonalia")) },
        TrackEvent { delta: u28::new(0), kind: TrackEventKind::Meta(MetaMessage::Tempo(u24::new(tempo))) },
        TrackEvent { delta: u28::new(0), kind: TrackEventKind::Meta(MetaMessage::TimeSignature(4, 2, 24, 8)) },
        TrackEvent { delta: u28::new(0), kind: TrackEventKind::Meta(MetaMessage::EndOfTrack) },
    ]];
    for (i, (name, notes)) in parts.iter().enumerate() {
        tracks.push(note_events(name.as_bytes(), channel_for(i), notes));
    }

    let smf = Smf { header: Header::new(Format::Parallel, Timing::Metrical(u15::new(QUARTER as u16))), tracks };
    let mut out = Vec::new();
    smf.write_std(&mut out)?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chord::Chord;
    use crate::commands::{EditCommand, apply};
    use crate::pitch::PitchClass;
    use crate::time::BAR;

    fn song_with_content() -> Song {
        let mut song = Song::default();
        let s = song.sections[0].id;
        for (i, root) in [0u8, 7].into_iter().enumerate() {
            let chord = Chord::major(PitchClass::from(root));
            apply(&mut song, &EditCommand::InsertChord { section: s, index: i, chord, length: None }).unwrap();
        }
        let track = song.tracks[0].id;
        let notes = vec![Note::new(0, QUARTER, 72, 1.0), Note::new(BAR, QUARTER, 74, 0.5)];
        apply(&mut song, &EditCommand::SetTrackNotes { track, notes }).unwrap();
        song
    }

    fn note_ons(track: &[TrackEvent]) -> Vec<(u32, u8, u8, u8)> {
        let mut t = 0;
        let mut out = Vec::new();
        for e in track {
            t += e.delta.as_int();
            if let TrackEventKind::Midi { channel, message: MidiMessage::NoteOn { key, vel } } = e.kind {
                out.push((t, channel.as_int(), key.as_int(), vel.as_int()));
            }
        }
        out
    }

    #[test]
    fn ida_y_vuelta() {
        let song = song_with_content();
        let bytes = export_smf(&song, &ExportOptions::default()).unwrap();
        let smf = Smf::parse(&bytes).unwrap();
        assert_eq!(smf.header.timing, Timing::Metrical(u15::new(2592)));
        assert_eq!(smf.tracks.len(), 1 + 1 + 2); // tempo + acordes + 2 pistas
        let chords = note_ons(&smf.tracks[1]);
        assert_eq!(chords.len(), 6); // dos tríadas
        assert!(chords[..3].iter().all(|&(t, ch, _, _)| t == 0 && ch == 0));
        assert!(chords[3..].iter().all(|&(t, _, _, _)| t == BAR as u32));
        let melody = note_ons(&smf.tracks[2]);
        assert_eq!(melody, vec![(0, 1, 72, 127), (BAR as u32, 1, 74, 64)]);
    }

    #[test]
    fn region_y_seleccion_de_pistas() {
        let song = song_with_content();
        let track = song.tracks[0].id;
        let options = ExportOptions { include_chords: false, tracks: Some(vec![track]), region: Some((BAR, 2 * BAR)) };
        let smf_bytes = export_smf(&song, &options).unwrap();
        let smf = Smf::parse(&smf_bytes).unwrap();
        assert_eq!(smf.tracks.len(), 2);
        assert_eq!(note_ons(&smf.tracks[1]), vec![(0, 0, 74, 64)]);
    }

    #[test]
    fn canales_saltan_la_percusion() {
        assert_eq!((0..12).map(channel_for).collect::<Vec<_>>(), vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12]);
    }
}
