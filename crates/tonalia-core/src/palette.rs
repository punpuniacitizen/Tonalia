//! Paleta de acordes de una tonalidad: lo que muestra la Rueda armónica.
//!
//! - **Diatónicos**: se construyen apilando terceras sobre cada grado de la escala. En escalas
//!   que no tienen siete notas (pentatónicas, blues, tonos enteros…) apilar terceras no tiene
//!   sentido: sobre cada grado se elige la forma de acorde más habitual que cabe en la escala.
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
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub enum ChordSize {
    Triads,
    Sevenths,
    /// Cuatríada + novena (cinco terceras apiladas).
    Ninths,
    /// Cuatríada + novena + oncena (seis terceras apiladas).
    Elevenths,
}

impl ChordSize {
    /// Cuántas terceras se apilan sobre la fundamental.
    fn thirds(self) -> usize {
        match self {
            ChordSize::Triads => 2,
            ChordSize::Sevenths => 3,
            ChordSize::Ninths => 4,
            ChordSize::Elevenths => 5,
        }
    }
}

/// Formas de tríada, de la más habitual a la menos: mayor, menor, disminuida, aumentada,
/// sus4, sus2, cuartal (dos cuartas: Mi-La-Re) y quinta sola.
const TRIAD_SHAPES: [&[u8]; 8] = [&[4, 7], &[3, 7], &[3, 6], &[4, 8], &[5, 7], &[2, 7], &[5, 10], &[7]];
/// Cuatríadas: maj7, m7, 7, ø7, °7, +7, m(maj7), +maj7, 6, m6 y 7sus4.
const SEVENTH_SHAPES: [&[u8]; 11] =
    [&[4, 7, 11], &[3, 7, 10], &[4, 7, 10], &[3, 6, 10], &[3, 6, 9], &[4, 8, 10], &[3, 7, 11], &[4, 8, 11], &[4, 7, 9], &[3, 7, 9], &[5, 7, 10]];

/// Acorde sobre `root` para una escala sin siete notas: la primera tríada cuyas notas están
/// todas en la escala; con cuatríadas, la primera que la contiene (si ninguna cabe, queda la
/// tríada), más la 9ª y la 11ª si la escala las tiene. `None` si no cabe ninguna tríada
/// (p. ej. sobre la «blue note» del blues).
fn fitted_chord(key: &Key, root: crate::pitch::PitchClass, size: ChordSize) -> Option<Chord> {
    let fits = |ivs: &[u8]| ivs.iter().all(|&i| key.contains(root.transpose(i as i32)));
    let triad = TRIAD_SHAPES.iter().find(|s| fits(s))?;
    let seventh = || SEVENTH_SHAPES.iter().find(|s| fits(s) && triad.iter().all(|i| s.contains(i)));
    let mut ivs = if size == ChordSize::Triads { None } else { seventh() }.unwrap_or(triad).to_vec();
    if matches!(size, ChordSize::Ninths | ChordSize::Elevenths) && fits(&[2]) && !ivs.contains(&2) {
        ivs.push(14);
    }
    if size == ChordSize::Elevenths && fits(&[5]) && !ivs.contains(&5) {
        ivs.push(17);
    }
    Some(Chord::new(root, ivs))
}

/// Acordes de la tonalidad, uno por grado. En escalas de siete notas, por terceras; las
/// tensiones (9ª, 11ª) se guardan como intervalos compuestos para que suenen por encima.
/// En las demás, con [`fitted_chord`] (los grados donde no cabe ningún acorde se saltan).
/// La cromática no tiene acordes propios.
pub fn diatonic_chords(key: &Key, size: ChordSize) -> Vec<Chord> {
    if key.scale.len() >= 12 {
        return Vec::new();
    }
    if !key.scale.is_heptatonic() {
        return key.degrees().into_iter().filter_map(|root| fitted_chord(key, root, size)).collect();
    }
    let d = key.degrees();
    (0..7)
        .map(|i| {
            let root = d[i];
            let intervals = (1..=size.thirds()).map(|k| {
                let iv = root.up_to(d[(i + 2 * k) % 7]);
                if k >= 4 { iv + 12 } else { iv }
            });
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
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct PaletteEntry {
    pub chord: Chord,
    pub label: ChordLabel,
    pub transition: Transition,
    /// Grado (0..=6) en la escala de origen.
    pub degree: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct BorrowedGroup {
    /// Identificador de la escala de origen (`"dorian"`, `"harmonicMinor"`…).
    pub scale: String,
    pub entries: Vec<PaletteEntry>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
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
        transition: score(previous, &chord, key),
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
    fn novenas_y_oncenas_diatonicas() {
        let key = Key::major(PitchClass::C);
        let ninths: Vec<String> = diatonic_chords(&key, ChordSize::Ninths).iter().map(suffix).collect();
        assert_eq!(ninths, ["maj9", "m9", "m7b9", "maj9", "9", "m9", "ø7b9"]);
        let elevenths = diatonic_chords(&key, ChordSize::Elevenths);
        assert_eq!(elevenths[1].intervals.iter().copied().collect::<Vec<_>>(), vec![3, 7, 10, 14, 17]); // Dm11
        assert_eq!(suffix(&elevenths[1]), "m11");
    }

    #[test]
    fn menor_armonica_tiene_dominante_mayor() {
        let key = Key::new(PitchClass::A, Scale::harmonic_minor());
        let chords = diatonic_chords(&key, ChordSize::Triads);
        assert_eq!(chords[4], Chord::major(PitchClass::E));
        assert_eq!(chords[2], Chord::augmented(PitchClass::C));
    }

    fn world(root: PitchClass, name: &str) -> Key {
        Key::new(root, Scale::builtin(name).unwrap())
    }

    #[test]
    fn acordes_de_escalas_sin_siete_notas() {
        let c = PitchClass::C;
        let triads = |name: &str| -> Vec<String> { diatonic_chords(&world(c, name), ChordSize::Triads).iter().map(suffix).collect() };
        // Do pentatónica mayor: C, Dsus4, Mi-La-Re (cuartal), Gsus4, Am.
        assert_eq!(triads("majorPentatonic"), ["", "sus4", "7sus4", "sus4", "m"]);
        assert_eq!(triads("minorPentatonic"), ["m", "", "sus4", "7sus4", "sus4"]);
        // Tonos enteros: todo aumentado. Disminuida (semitono-tono): mayores y disminuidos alternados.
        assert_eq!(triads("wholeTone"), vec!["+"; 6]);
        assert_eq!(triads("diminished"), ["", "°", "", "°", "", "°", "", "°"]);
        // Blues: sobre la blue note (Fa#) no cabe ningún acorde.
        let blues = diatonic_chords(&world(c, "blues"), ChordSize::Triads);
        assert_eq!(blues.len(), 5);
        assert!(blues.iter().all(|ch| ch.root != PitchClass::new(6)));
        // Hirajoshi: Cm y Ab mayor.
        let hira = diatonic_chords(&world(c, "hirajoshi"), ChordSize::Triads);
        assert_eq!(hira[0], Chord::minor(c));
        assert!(hira.contains(&Chord::major(PitchClass::new(8))));
        // Cuatríadas: Do pentatónica mayor da C6 y Am7.
        let sevenths: Vec<String> = diatonic_chords(&world(c, "majorPentatonic"), ChordSize::Sevenths).iter().map(suffix).collect();
        assert_eq!(sevenths[0], "6");
        assert_eq!(sevenths[4], "m7");
        // Disminuida: la cuatríada extiende la tríada (C → C7, no Cm7).
        let dim7: Vec<String> = diatonic_chords(&world(c, "diminished"), ChordSize::Sevenths).iter().map(suffix).collect();
        assert_eq!(dim7[..2], ["7", "°7"]);
        assert!(diatonic_chords(&Key::new(c, Scale::chromatic()), ChordSize::Triads).is_empty());
    }

    #[test]
    fn escalas_exoticas_de_siete_notas() {
        // Mi frigio dominante (Hijaz): E mayor, F mayor, G#°, Am, B°, C+, Dm.
        let hijaz = diatonic_chords(&world(PitchClass::E, "phrygianDominant"), ChordSize::Triads);
        assert_eq!(hijaz[0], Chord::major(PitchClass::E));
        assert_eq!(hijaz[1], Chord::major(PitchClass::F));
        assert_eq!(hijaz[3], Chord::minor(PitchClass::A));
        let p = build_palette(&world(PitchClass::C, "doubleHarmonic"), ChordSize::Triads, None);
        assert_eq!(p.diatonic.len(), 7);
        assert_eq!(p.diatonic[1].label.roman, "II"); // Db mayor: el II napolitano
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
