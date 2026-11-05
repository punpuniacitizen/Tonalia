//! Bajo automático: una línea de bajo que sigue los acordes de la canción.
//!
//! Estilos: solo la fundamental, fundamental y quinta, octavas, o bajo caminante (negras
//! que recorren el acorde y se acercan por semitono a la fundamental del siguiente).
//! Respeta los silencios entre acordes. El registro va de Mi1 a Re#2 (lo cómodo de un bajo).

use serde::{Deserialize, Serialize};

use crate::chord::Chord;
use crate::model::{Note, Song};
use crate::queries::layout;
use crate::time::{EIGHTH, HALF, QUARTER, Ticks};

/// Registro del bajo: de Mi1 a Re#3 (sin incluir).
const LOWEST: u8 = 28;
const HIGHEST: u8 = 48;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub enum BassStyle {
    /// La fundamental, sostenida todo el acorde.
    Root,
    /// Fundamental y quinta, alternando cada medio compás.
    RootFifth,
    /// Fundamental grave y aguda, alternando en corcheas.
    Octaves,
    /// Negras que recorren el acorde y llegan por semitono al siguiente.
    Walking,
}

/// Fundamental del acorde en la octava más grave del registro.
fn root_pitch(chord: &Chord) -> u8 {
    LOWEST + (chord.root.value() + 12 - LOWEST % 12) % 12
}

/// Fundamental en la octava (dentro del registro) más cerca de la nota anterior, para que
/// la línea no salte de un extremo al otro.
fn root_near(chord: &Chord, previous: u8) -> u8 {
    let low = root_pitch(chord);
    [low, low + 12].into_iter().filter(|&p| p < HIGHEST).min_by_key(|&p| (p as i32 - previous as i32).abs()).unwrap_or(low)
}

fn third(chord: &Chord) -> u8 {
    [4, 3, 5, 2].into_iter().find(|i| chord.intervals.contains(i)).unwrap_or(4)
}

fn fifth(chord: &Chord) -> u8 {
    [7, 6, 8].into_iter().find(|i| chord.intervals.contains(i)).unwrap_or(7)
}

/// Golpes del bajo dentro de un acorde: (inicio relativo, duración, altura, intensidad).
fn hits(chord: &Chord, root: u8, length: Ticks, next_root: u8, style: BassStyle) -> Vec<(Ticks, Ticks, u8, f32)> {
    let repeat = |step: Ticks, tones: &[u8]| {
        let mut out = Vec::new();
        let mut t = 0;
        let mut k = 0;
        while t < length {
            out.push((t, step.min(length - t), tones[k % tones.len()], if t == 0 { 0.88 } else { 0.8 }));
            t += step;
            k += 1;
        }
        out
    };
    match style {
        BassStyle::Root => vec![(0, length, root, 0.88)],
        BassStyle::RootFifth => repeat(HALF, &[root, root + fifth(chord)]),
        BassStyle::Octaves => repeat(EIGHTH, &[root, root + 12]),
        BassStyle::Walking => {
            let beats = (length / QUARTER).max(1) as usize;
            if length < QUARTER {
                return vec![(0, length, root, 0.88)];
            }
            let tones = [root, root + third(chord), root + fifth(chord), root + 12];
            let mut out: Vec<(Ticks, Ticks, u8, f32)> = (0..beats)
                .map(|k| (k as Ticks * QUARTER, QUARTER, tones[k % tones.len()], if k == 0 { 0.88 } else { 0.8 }))
                .collect();
            // El último tiempo se acerca por semitono (desde abajo) a la fundamental siguiente.
            if beats >= 2 {
                let approach = if next_root > LOWEST { next_root - 1 } else { next_root + 1 };
                if let Some(last) = out.last_mut() {
                    last.2 = approach;
                }
            }
            // Lo que sobre después del último tiempo entero queda sonando en la última nota.
            if let Some(last) = out.last_mut() {
                last.1 = length - last.0;
            }
            out
        }
    }
}

/// La línea de bajo de toda la canción (posiciones absolutas). El último acorde camina
/// hacia el primero, como al repetir en bucle.
pub fn bass_line(song: &Song, style: BassStyle) -> Vec<Note> {
    let l = layout(song);
    let chords = &l.chords;
    let mut roots: Vec<u8> = Vec::with_capacity(chords.len());
    for c in chords {
        let root = match roots.last() {
            Some(&previous) => root_near(&c.entry.chord, previous),
            None => root_pitch(&c.entry.chord),
        };
        roots.push(root);
    }
    let mut out = Vec::new();
    for (i, c) in chords.iter().enumerate() {
        let next_root = roots.get(i + 1).or(roots.first()).copied().unwrap_or(roots[i]);
        for (at, len, pitch, velocity) in hits(&c.entry.chord, roots[i], c.entry.length, next_root, style) {
            out.push(Note::new(c.start + at, len, pitch, velocity));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::{EditCommand, apply};
    use crate::pitch::PitchClass;
    use crate::time::BAR;

    fn song(chords: &[Chord]) -> Song {
        let mut song = Song::default();
        let section = song.sections[0].id;
        for (index, chord) in chords.iter().enumerate() {
            apply(&mut song, &EditCommand::InsertChord { section, index, chord: chord.clone(), length: Some(BAR) }).unwrap();
        }
        song
    }

    #[test]
    fn fundamental_en_el_registro_del_bajo() {
        let s = song(&[Chord::major(PitchClass::C), Chord::minor(PitchClass::A), Chord::major(PitchClass::E)]);
        let line = bass_line(&s, BassStyle::Root);
        assert_eq!(line.iter().map(|n| n.pitch).collect::<Vec<_>>(), [36, 33, 28]);
        assert!(line.iter().all(|n| n.length == BAR));
    }

    #[test]
    fn quinta_y_octavas() {
        let s = song(&[Chord::major(PitchClass::C)]);
        assert_eq!(bass_line(&s, BassStyle::RootFifth).iter().map(|n| n.pitch).collect::<Vec<_>>(), [36, 43]);
        let oct = bass_line(&s, BassStyle::Octaves);
        assert_eq!(oct.len(), 8);
        assert_eq!((oct[0].pitch, oct[1].pitch), (36, 48));
    }

    #[test]
    fn bajo_caminante_llega_al_siguiente() {
        // Do mayor → Fa: Do, Mi, Sol y Mi (un semitono bajo Fa).
        let s = song(&[Chord::major(PitchClass::C), Chord::major(PitchClass::F)]);
        let line = bass_line(&s, BassStyle::Walking);
        let first: Vec<u8> = line.iter().filter(|n| n.position < BAR).map(|n| n.pitch).collect();
        assert_eq!(first, [36, 40, 43, 40]);
        // Menor: la tercera es menor.
        let s = song(&[Chord::minor(PitchClass::A), Chord::major(PitchClass::C)]);
        let line = bass_line(&s, BassStyle::Walking);
        assert_eq!(line[1].pitch, 33 + 3);
    }
}
