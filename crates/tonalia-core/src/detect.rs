//! Reconocer acordes a partir de notas sueltas ("Fijar como acorde").
//!
//! Cada nota distinta se prueba como fundamental y se puntúa: tener tercera y quinta
//! suma, cada tensión extra resta y que la fundamental sea el bajo suma un poco.
//! Así Mi-Sol-Do se reconoce como Do mayor (en primera inversión) y no como Mim(b13).

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::chord::Chord;
use crate::naming::{Fifth, Seventh, Third, analyze};
use crate::pitch::PitchClass;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedChord {
    pub chord: Chord,
    pub score: f32,
    /// La fundamental es la nota más grave (posición fundamental).
    pub root_is_bass: bool,
}

/// Candidatos ordenados del más probable al menos probable.
pub fn detect(pitches: &[u8]) -> Vec<DetectedChord> {
    let Some(&lowest) = pitches.iter().min() else { return Vec::new() };
    let bass = PitchClass::of_midi(lowest);
    let pcs: BTreeSet<PitchClass> = pitches.iter().map(|&p| PitchClass::of_midi(p)).collect();

    let mut out: Vec<DetectedChord> = pcs
        .iter()
        .map(|&root| {
            let chord = Chord::new(root, pcs.iter().map(|&p| root.up_to(p)));
            let shape = analyze(&chord);
            let mut score = 0.0f32;
            score += match shape.third {
                Third::Major | Third::Minor => 2.0,
                Third::Sus2 | Third::Sus4 => 1.0,
                Third::None => 0.0,
            };
            score += match shape.fifth {
                Fifth::Perfect => 2.0,
                Fifth::Diminished | Fifth::Augmented => 1.0,
                Fifth::None => 0.0,
            };
            if shape.seventh != Seventh::None {
                score += 0.5;
            }
            if shape.sixth {
                score -= 0.5;
            }
            score -= shape.extensions.len() as f32;
            if root == bass {
                score += 1.5;
            }
            DetectedChord { chord, score, root_is_bass: root == bass }
        })
        .collect();

    out.sort_by(|a, b| b.score.total_cmp(&a.score).then(b.root_is_bass.cmp(&a.root_is_bass)));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn best(pitches: &[u8]) -> Chord {
        detect(pitches).remove(0).chord
    }

    #[test]
    fn triadas_e_inversiones() {
        assert_eq!(best(&[60, 64, 67]), Chord::major(PitchClass::C));
        assert_eq!(best(&[64, 67, 72]), Chord::major(PitchClass::C)); // primera inversión
        assert_eq!(best(&[67, 72, 76]), Chord::major(PitchClass::C)); // segunda inversión
        assert_eq!(best(&[57, 64, 72]), Chord::minor(PitchClass::A));
    }

    #[test]
    fn cuatriadas_ambiguas_segun_el_bajo() {
        assert_eq!(best(&[57, 60, 64, 67]), Chord::minor7(PitchClass::A)); // La-Do-Mi-Sol
        assert_eq!(best(&[60, 64, 67, 69]), Chord::new(PitchClass::C, [4, 7, 9])); // C6
        assert_eq!(best(&[55, 59, 62, 65]), Chord::dominant7(PitchClass::G));
    }

    #[test]
    fn vacio_y_alternativas() {
        assert!(detect(&[]).is_empty());
        let all = detect(&[60, 64, 67]);
        assert_eq!(all.len(), 3);
        assert!(all[0].root_is_bass);
    }
}
