//! Voicing: qué notas concretas (con octava) suenan para un acorde.
//!
//! El voicing por defecto se construye en cadena:
//! 1. [`chord_to_notes`]: posición cerrada, fundamental abajo.
//! 2. [`strum`]: cada nota entra un poco después que la anterior (rasgueo).
//! 3. [`register_fix`]: las fundamentales por debajo de la tónica suben una octava,
//!    así los acordes quedan agrupados cerca de la tónica.
//! 4. [`transpose`]: se lleva todo a la octava elegida.

use serde::{Deserialize, Serialize};

use crate::chord::Chord;
use crate::model::Note;
use crate::pitch::PitchClass;
use crate::time::{MIN_STRUM_LENGTH, Ticks};

/// Ajustes con los que se escuchan y se insertan los acordes.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewSettings {
    /// Octava de la fundamental (3 → entre Do3 = 48 y Si3 = 59, con Do4 = 60 como Do central).
    pub octave: u8,
    /// Retraso entre notas sucesivas, en ticks (0 = todas a la vez).
    pub strumming: Ticks,
    /// Intensidad 0..=1.
    pub velocity: f32,
}

impl Default for PreviewSettings {
    fn default() -> Self {
        Self { octave: 3, strumming: 0, velocity: 0.8 }
    }
}

/// Notas del acorde en posición cerrada. Las alturas son relativas al Do más grave (0);
/// [`transpose`] las coloca después en su octava.
pub fn chord_to_notes(chord: &Chord, length: Ticks, velocity: f32) -> Vec<Note> {
    let root = chord.root.value();
    std::iter::once(0)
        .chain(chord.intervals.iter().copied())
        .map(|iv| Note::new(0, length, root + iv, velocity))
        .collect()
}

/// Rasgueo: la nota `i` entra `i * step` ticks más tarde y se acorta para terminar a la vez,
/// sin quedar nunca por debajo de 1/64.
pub fn strum(mut notes: Vec<Note>, step: Ticks) -> Vec<Note> {
    for (i, n) in notes.iter_mut().enumerate() {
        let delay = i as Ticks * step;
        n.position += delay;
        n.length = (n.length - delay).max(MIN_STRUM_LENGTH);
    }
    notes
}

/// Si la primera nota (la fundamental) cae por debajo de `threshold`, sube todo una octava.
pub fn register_fix(notes: Vec<Note>, threshold: PitchClass) -> Vec<Note> {
    match notes.first() {
        Some(first) if first.pitch % 12 < threshold.value() => transpose(notes, 12),
        _ => notes,
    }
}

/// Sube o baja todas las notas `semitones`, sin salir del rango MIDI 0..=127.
pub fn transpose(mut notes: Vec<Note>, semitones: i32) -> Vec<Note> {
    for n in &mut notes {
        n.pitch = (n.pitch as i32 + semitones).clamp(0, 127) as u8;
    }
    notes
}

/// Voicing por defecto de un acorde nuevo (el mismo que se oye al previsualizarlo).
pub fn default_voicing(chord: &Chord, length: Ticks, settings: &PreviewSettings, key_root: PitchClass) -> Vec<Note> {
    let notes = chord_to_notes(chord, length, settings.velocity);
    let notes = strum(notes, settings.strumming);
    let notes = register_fix(notes, key_root);
    transpose(notes, (settings.octave as i32 + 1) * 12)
}

/// Adapta un voicing a una nueva duración: las notas que sostenían hasta el final siguen
/// haciéndolo; las que empiezan después del nuevo final desaparecen.
pub fn fit_voicing(voicing: &[Note], old_length: Ticks, new_length: Ticks) -> Vec<Note> {
    voicing
        .iter()
        .filter(|n| n.position < new_length)
        .map(|n| {
            let mut n = n.clone();
            if n.end() >= old_length || n.end() > new_length {
                n.length = new_length - n.position;
            }
            n
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::time::WHOLE;

    #[test]
    fn posicion_cerrada() {
        let notes = chord_to_notes(&Chord::major7(PitchClass::D), WHOLE, 1.0);
        let pitches: Vec<u8> = notes.iter().map(|n| n.pitch).collect();
        assert_eq!(pitches, vec![2, 6, 9, 13]);
        assert!(notes.iter().all(|n| n.position == 0 && n.length == WHOLE));
    }

    #[test]
    fn rasgueo_respeta_minimo() {
        let notes = strum(chord_to_notes(&Chord::major(PitchClass::C), WHOLE, 1.0), 6000);
        assert_eq!(notes.iter().map(|n| n.position).collect::<Vec<_>>(), vec![0, 6000, 12000]);
        assert_eq!(notes.iter().map(|n| n.length).collect::<Vec<_>>(), vec![WHOLE, WHOLE - 6000, MIN_STRUM_LENGTH]);
    }

    #[test]
    fn voicing_por_defecto_cerca_de_la_tonica() {
        let settings = PreviewSettings::default();
        // En Mi mayor, La (9) está por encima de Mi (4): se queda en la octava 3.
        let a = default_voicing(&Chord::major(PitchClass::A), WHOLE, &settings, PitchClass::E);
        assert_eq!(a[0].pitch, 57);
        // Do (0) está por debajo de Mi: sube una octava.
        let c = default_voicing(&Chord::major(PitchClass::C), WHOLE, &settings, PitchClass::E);
        assert_eq!(c[0].pitch, 60);
        assert_eq!(c.iter().map(|n| n.pitch).collect::<Vec<_>>(), vec![60, 64, 67]);
        assert!((c[0].velocity - 0.8).abs() < 1e-6);
    }

    #[test]
    fn ajustar_duracion() {
        let v = strum(chord_to_notes(&Chord::major(PitchClass::C), WHOLE, 1.0), 4000);
        let fitted = fit_voicing(&v, WHOLE, 5184);
        assert_eq!(fitted.len(), 2); // la tercera nota empezaba en 8000
        assert!(fitted.iter().all(|n| n.end() == 5184));
        let longer = fit_voicing(&v, WHOLE, 2 * WHOLE);
        assert!(longer.iter().all(|n| n.end() == 2 * WHOLE));
    }
}
