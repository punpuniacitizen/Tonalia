//! Paleta de acordes de una tonalidad: lo que muestra la Rueda armónica.
//!
//! - **Diatónicos**: se construyen apilando terceras sobre cada grado de la escala.
//! - **Prestados**: los diatónicos de los modos paralelos (misma tónica, otra escala)
//!   que no están en la tonalidad propia. Por ejemplo, Fa menor en Do mayor viene de Do menor.
//! - **Vecinos**: los diatónicos de las tonalidades a un paso en el círculo de quintas.
//!
//! Cada entrada lleva su etiqueta (relativa a la tonalidad propia) y su puntuación
//! respecto al acorde anterior, para dibujar los "arcos de luz".

use serde::{Deserialize, Serialize};

use crate::analysis::{ChordLabel, describe};
use crate::chord::Chord;
use crate::harmony::{Transition, score};
use crate::scale::{Key, Scale};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ChordSize {
    Triads,
    Sevenths,
}

/// Acordes por terceras sobre cada grado (solo escalas de siete notas).
pub fn diatonic_chords(key: &Key, size: ChordSize) -> Vec<Chord> {
    if !key.scale.is_heptatonic() {
        return Vec::new();
    }
    let d = key.degrees();
    (0..7)
        .map(|i| {
            let root = d[i];
            let mut intervals = vec![root.up_to(d[(i + 2) % 7]), root.up_to(d[(i + 4) % 7])];
            if size == ChordSize::Sevenths {
                intervals.push(root.up_to(d[(i + 6) % 7]));
            }
            Chord::new(root, intervals)
        })
        .collect()
}

/// Escalas paralelas de las que se pueden tomar prestados acordes.
pub fn parallel_scales() -> Vec<Scale> {
    let mut all: Vec<Scale> = (0..7).map(Scale::mode).collect();
    all.push(Scale::harmonic_minor());
    all.push(Scale::melodic_minor());
    all
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaletteEntry {
    pub chord: Chord,
    pub label: ChordLabel,
    pub transition: Transition,
    /// Grado (0..=6) en la escala de origen.
    pub degree: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BorrowedGroup {
    /// Identificador de la escala de origen (`"dorian"`, `"harmonicMinor"`…).
    pub scale: String,
    pub entries: Vec<PaletteEntry>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Palette {
    pub key: Key,
    pub diatonic: Vec<PaletteEntry>,
    pub borrowed: Vec<BorrowedGroup>,
    /// Tonalidad un paso a la izquierda en el círculo de quintas (subdominante).
    pub left: Vec<PaletteEntry>,
    /// Tonalidad un paso a la derecha en el círculo de quintas (dominante).
    pub right: Vec<PaletteEntry>,
}

pub fn build_palette(key: &Key, size: ChordSize, previous: Option<&Chord>) -> Palette {
    let entry = |degree: usize, chord: Chord| PaletteEntry {
        label: describe(&chord, key),
        transition: score(previous, &chord, key.root),
        degree,
        chord,
    };
    let entries = |chords: Vec<Chord>| -> Vec<PaletteEntry> { chords.into_iter().enumerate().map(|(i, c)| entry(i, c)).collect() };

    let home = diatonic_chords(key, size);
    let borrowed = parallel_scales()
        .into_iter()
        .filter(|s| s.steps != key.scale.steps)
        .map(|scale| {
            let name = scale.name.clone();
            let chords = diatonic_chords(&key.with_scale(scale), size);
            let entries = chords.into_iter().enumerate().filter(|(_, c)| !home.contains(c)).map(|(i, c)| entry(i, c)).collect();
            BorrowedGroup { scale: name, entries }
        })
        .filter(|g: &BorrowedGroup| !g.entries.is_empty())
        .collect();

    Palette {
        key: key.clone(),
        diatonic: entries(home.clone()),
        borrowed,
        left: entries(diatonic_chords(&key.fifth_left(), size)),
        right: entries(diatonic_chords(&key.fifth_right(), size)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::naming::suffix;
    use crate::pitch::PitchClass;

    #[test]
    fn diatonicos_de_do_mayor() {
        let key = Key::major(PitchClass::C);
        let triads: Vec<String> = diatonic_chords(&key, ChordSize::Triads).iter().map(suffix).collect();
        assert_eq!(triads, ["", "m", "m", "", "", "m", "°"]);
        let sevenths: Vec<String> = diatonic_chords(&key, ChordSize::Sevenths).iter().map(suffix).collect();
        assert_eq!(sevenths, ["maj7", "m7", "m7", "maj7", "7", "m7", "ø7"]);
    }

    #[test]
    fn menor_armonica_tiene_dominante_mayor() {
        let key = Key::new(PitchClass::A, Scale::harmonic_minor());
        let chords = diatonic_chords(&key, ChordSize::Triads);
        assert_eq!(chords[4], Chord::major(PitchClass::E));
        assert_eq!(chords[2], Chord::augmented(PitchClass::C));
    }

    #[test]
    fn prestamos_y_vecinos() {
        let key = Key::major(PitchClass::C);
        let p = build_palette(&key, ChordSize::Triads, Some(&Chord::major(PitchClass::G)));
        assert_eq!(p.diatonic.len(), 7);
        let aeolian = p.borrowed.iter().find(|g| g.scale == "aeolian").unwrap();
        let romans: Vec<&str> = aeolian.entries.iter().map(|e| e.label.roman.as_str()).collect();
        assert_eq!(romans, ["i", "ii°", "bIII", "iv", "v", "bVI", "bVII"]);
        assert!(p.borrowed.iter().all(|g| g.scale != "ionian"));
        assert_eq!(p.left[0].chord.root, PitchClass::F);
        assert_eq!(p.right[0].chord.root, PitchClass::G);
        // Desde G (V), el I puntúa 1.0.
        assert_eq!(p.diatonic[0].transition.score, 1.0);
    }
}
