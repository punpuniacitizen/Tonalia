//! Nombres de acordes: símbolos (`Cm7`, `G7b9`, `Fmaj7#11`) y números romanos (`ii7`, `bVII`).
//!
//! Primero se **analiza** la forma del acorde (qué tercera, qué quinta, qué séptima,
//! qué extensiones) y después se escribe. El mismo análisis sirve para ambos formatos.

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::chord::Chord;
use crate::pitch::{Notation, PitchClass};
use crate::scale::{Key, Scale};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Third {
    Major,
    Minor,
    Sus2,
    Sus4,
    None,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Fifth {
    Perfect,
    Diminished,
    Augmented,
    None,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Seventh {
    Minor,
    Major,
    Diminished,
    None,
}

/// Tensiones por encima de la séptima, en el orden en que se escriben.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Extension {
    FlatNine,
    Nine,
    SharpNine,
    Eleven,
    SharpEleven,
    FlatThirteen,
    Thirteen,
}

impl Extension {
    pub fn token(self) -> &'static str {
        match self {
            Extension::FlatNine => "b9",
            Extension::Nine => "9",
            Extension::SharpNine => "#9",
            Extension::Eleven => "11",
            Extension::SharpEleven => "#11",
            Extension::FlatThirteen => "b13",
            Extension::Thirteen => "13",
        }
    }

    pub fn is_natural(self) -> bool {
        matches!(self, Extension::Nine | Extension::Eleven | Extension::Thirteen)
    }
}

/// Forma de un acorde, independiente de su fundamental.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChordShape {
    pub third: Third,
    pub fifth: Fifth,
    pub seventh: Seventh,
    pub sixth: bool,
    pub extensions: BTreeSet<Extension>,
}

pub fn analyze(chord: &Chord) -> ChordShape {
    let has = |i: u8| chord.intervals.contains(&i);
    let mut used = BTreeSet::new();
    let mut take = |i: u8| {
        used.insert(i);
    };

    let third = if has(4) {
        take(4);
        Third::Major
    } else if has(3) {
        take(3);
        Third::Minor
    } else if has(5) {
        take(5);
        Third::Sus4
    } else if has(2) {
        take(2);
        Third::Sus2
    } else {
        Third::None
    };

    let fifth = if has(7) {
        take(7);
        Fifth::Perfect
    } else if has(6) && matches!(third, Third::Major | Third::Minor) {
        take(6);
        Fifth::Diminished
    } else if has(8) && third == Third::Major {
        take(8);
        Fifth::Augmented
    } else {
        Fifth::None
    };

    let seventh = if has(10) {
        take(10);
        Seventh::Minor
    } else if has(11) {
        take(11);
        Seventh::Major
    } else if has(9) && third == Third::Minor && fifth == Fifth::Diminished {
        take(9);
        Seventh::Diminished
    } else {
        Seventh::None
    };

    let sixth = seventh == Seventh::None && has(9);
    if sixth {
        take(9);
    }

    // Lo que queda son tensiones. Un intervalo dentro de la octava junto a una tercera
    // se lee como su versión compuesta (Do-Re-Mi-Sol = Cadd9).
    let mut extensions = BTreeSet::new();
    for &iv in chord.intervals.iter().filter(|i| !used.contains(*i)) {
        let ext = match iv % 12 {
            1 => Some(Extension::FlatNine),
            2 => Some(Extension::Nine),
            3 if third == Third::Major => Some(Extension::SharpNine),
            5 => Some(Extension::Eleven),
            6 => Some(Extension::SharpEleven),
            8 => Some(Extension::FlatThirteen),
            9 => Some(Extension::Thirteen),
            // El resto son notas del acorde repetidas en otra octava.
            _ => None,
        };
        if let Some(e) = ext {
            extensions.insert(e);
        }
    }

    ChordShape { third, fifth, seventh, sixth, extensions }
}

/// Saca la tensión natural más alta (13 > 11 > 9), que da nombre al acorde: C7 + 9 = C9.
fn take_top(ext: &mut BTreeSet<Extension>) -> Option<&'static str> {
    if ext.remove(&Extension::Thirteen) {
        ext.remove(&Extension::Eleven);
        ext.remove(&Extension::Nine);
        Some("13")
    } else if ext.remove(&Extension::Eleven) {
        ext.remove(&Extension::Nine);
        Some("11")
    } else if ext.remove(&Extension::Nine) {
        Some("9")
    } else {
        None
    }
}

fn seventh_part(seventh: Seventh, minor_third: bool, ext: &mut BTreeSet<Extension>) -> String {
    match seventh {
        Seventh::Minor => take_top(ext).unwrap_or("7").to_string(),
        Seventh::Major => {
            let top = take_top(ext).unwrap_or("7");
            if minor_third { format!("(maj{top})") } else { format!("maj{top}") }
        }
        Seventh::Diminished => "°7".to_string(),
        Seventh::None => String::new(),
    }
}

/// Sufijo del símbolo (todo lo que va después de la fundamental): `"m7"`, `"7sus4"`, `"°"`.
pub fn suffix(chord: &Chord) -> String {
    let shape = analyze(chord);
    let mut ext = shape.extensions.clone();
    let mut out = String::new();
    let mut no5 = false;

    match (shape.third, shape.fifth, shape.seventh) {
        (Third::Minor, Fifth::Diminished, Seventh::Minor) => {
            out.push('ø');
            out.push_str(take_top(&mut ext).unwrap_or("7"));
        }
        (Third::Minor, Fifth::Diminished, Seventh::Diminished) => out.push_str("°7"),
        (Third::Minor, Fifth::Diminished, Seventh::None) => out.push('°'),
        (Third::Major, Fifth::Augmented, seventh) => {
            out.push('+');
            out.push_str(&seventh_part(seventh, false, &mut ext));
        }
        (third, fifth, seventh) => {
            if third == Third::Minor {
                out.push('m');
            }
            if seventh == Seventh::None && shape.sixth {
                out.push_str(if ext.remove(&Extension::Nine) { "6/9" } else { "6" });
            } else {
                out.push_str(&seventh_part(seventh, third == Third::Minor, &mut ext));
            }
            match third {
                Third::Sus4 => out.push_str("sus4"),
                Third::Sus2 => out.push_str("sus2"),
                Third::None => {
                    let bare = seventh == Seventh::None && !shape.sixth && ext.is_empty();
                    if bare && fifth == Fifth::Perfect {
                        out.push('5');
                    } else {
                        out.push_str("no3");
                    }
                }
                Third::Major | Third::Minor => {}
            }
            if third == Third::Major && fifth == Fifth::Diminished {
                out.push_str(if seventh == Seventh::None { "(b5)" } else { "b5" });
            }
            no5 = matches!(third, Third::Major | Third::Minor) && fifth == Fifth::None;
        }
    }

    let has_seventh = shape.seventh != Seventh::None;
    for e in ext {
        if has_seventh {
            out.push_str(e.token());
        } else if e.is_natural() {
            out.push_str("add");
            out.push_str(e.token());
        } else {
            out.push('(');
            out.push_str(e.token());
            out.push(')');
        }
    }
    if no5 {
        out.push_str("no5");
    }
    out
}

/// Símbolo completo con la fundamental escrita según la tonalidad: `"Bbmaj7"`, `"Solm"`.
pub fn symbol(chord: &Chord, key: &Key, notation: Notation) -> String {
    format!("{}{}", key.spell(chord.root).name(notation), suffix(chord))
}

const ROMAN: [&str; 7] = ["I", "II", "III", "IV", "V", "VI", "VII"];

/// Para fundamentales que no están en la escala: a qué grado "pertenecen" (como en la mayor).
const MAJOR_REFERENCE_DEGREE: [usize; 12] = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];

/// Grado de la fundamental en la tonalidad: alteración (`""`, `"b"`, `"#"`) e índice 0..=6.
pub fn degree_label(root: PitchClass, key: &Key) -> (String, usize) {
    let rel = key.root.up_to(root);
    let offsets = if key.scale.is_heptatonic() { key.scale.offsets() } else { Scale::major().offsets() };
    if let Some(i) = offsets.iter().position(|&o| o == rel) {
        return (String::new(), i);
    }
    // Convención: en menor, el acorde sobre la sensible elevada se escribe vii° sin alteración.
    if rel == 11 && offsets.get(6) == Some(&10) {
        return (String::new(), 6);
    }
    let idx = MAJOR_REFERENCE_DEGREE[rel as usize];
    let diff = (rel as i32 - offsets[idx] as i32 + 6).rem_euclid(12) - 6;
    let accidental = if diff > 0 { "#".repeat(diff as usize) } else { "b".repeat((-diff) as usize) };
    (accidental, idx)
}

/// Número romano: mayúscula = tercera mayor, minúscula = tercera menor. `ii7`, `V7`, `bVII`, `viiø7`.
pub fn roman(chord: &Chord, key: &Key) -> String {
    let (accidental, idx) = degree_label(chord.root, key);
    let minor = analyze(chord).third == Third::Minor;
    let numeral = if minor { ROMAN[idx].to_lowercase() } else { ROMAN[idx].to_string() };
    let mut suf = suffix(chord);
    // La minúscula ya dice "menor": Dm7 en Do = ii7, no iim7.
    if minor && suf.starts_with('m') {
        suf.remove(0);
    }
    format!("{accidental}{numeral}{suf}")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn c(intervals: &[u8]) -> Chord {
        Chord::new(PitchClass::C, intervals.iter().copied())
    }

    #[test]
    fn sufijos_basicos() {
        let cases: &[(&[u8], &str)] = &[
            (&[4, 7], ""),
            (&[3, 7], "m"),
            (&[3, 6], "°"),
            (&[4, 8], "+"),
            (&[2, 7], "sus2"),
            (&[5, 7], "sus4"),
            (&[7], "5"),
            (&[4], "no5"),
        ];
        for (ivs, expected) in cases {
            assert_eq!(suffix(&c(ivs)), *expected, "{ivs:?}");
        }
    }

    #[test]
    fn sufijos_con_septima_y_extensiones() {
        let cases: &[(&[u8], &str)] = &[
            (&[4, 7, 10], "7"),
            (&[4, 7, 11], "maj7"),
            (&[3, 7, 10], "m7"),
            (&[3, 7, 11], "m(maj7)"),
            (&[3, 6, 10], "ø7"),
            (&[3, 6, 9], "°7"),
            (&[4, 8, 10], "+7"),
            (&[5, 7, 10], "7sus4"),
            (&[4, 7, 10, 14], "9"),
            (&[3, 7, 10, 14], "m9"),
            (&[4, 7, 11, 14], "maj9"),
            (&[4, 7, 10, 14, 21], "13"),
            (&[4, 7, 10, 13], "7b9"),
            (&[4, 7, 10, 15], "7#9"),
            (&[4, 7, 10, 18], "7#11"),
            (&[4, 7, 11, 18], "maj7#11"),
            (&[4, 6, 10], "7b5"),
            (&[4, 10], "7no5"),
            (&[4, 7, 9], "6"),
            (&[3, 7, 9], "m6"),
            (&[4, 7, 9, 14], "6/9"),
            (&[4, 7, 14], "add9"),
            (&[2, 4, 7], "add9"),
            (&[3, 7, 14], "madd9"),
            (&[4, 7, 17], "add11"),
        ];
        for (ivs, expected) in cases {
            assert_eq!(suffix(&c(ivs)), *expected, "{ivs:?}");
        }
    }

    #[test]
    fn simbolos_con_ortografia() {
        let eb = Key::major(PitchClass::new(3));
        let bb7 = Chord::dominant7(PitchClass::new(10));
        assert_eq!(symbol(&bb7, &eb, Notation::Letters), "Bb7");
        assert_eq!(symbol(&bb7, &eb, Notation::Solfege), "Sib7");
        let e = Key::major(PitchClass::E);
        assert_eq!(symbol(&Chord::minor(PitchClass::new(8)), &e, Notation::Letters), "G#m");
    }

    #[test]
    fn numeros_romanos_en_mayor() {
        let key = Key::major(PitchClass::C);
        let cases = [
            (Chord::major(PitchClass::C), "I"),
            (Chord::minor7(PitchClass::D), "ii7"),
            (Chord::minor(PitchClass::E), "iii"),
            (Chord::major7(PitchClass::F), "IVmaj7"),
            (Chord::dominant7(PitchClass::G), "V7"),
            (Chord::minor(PitchClass::A), "vi"),
            (Chord::diminished(PitchClass::B), "vii°"),
            (Chord::half_diminished7(PitchClass::B), "viiø7"),
            (Chord::major(PitchClass::new(10)), "bVII"),
            (Chord::major(PitchClass::new(8)), "bVI"),
            (Chord::major(PitchClass::new(3)), "bIII"),
            (Chord::major(PitchClass::new(1)), "bII"),
            (Chord::diminished(PitchClass::new(6)), "#iv°"),
            (Chord::minor(PitchClass::F), "iv"),
            (Chord::sus4(PitchClass::G), "Vsus4"),
        ];
        for (chord, expected) in cases {
            assert_eq!(roman(&chord, &key), expected, "{chord:?}");
        }
    }

    #[test]
    fn numeros_romanos_en_menor() {
        let key = Key::minor(PitchClass::A);
        assert_eq!(roman(&Chord::minor(PitchClass::A), &key), "i");
        assert_eq!(roman(&Chord::major(PitchClass::C), &key), "III");
        assert_eq!(roman(&Chord::major(PitchClass::E), &key), "V");
        assert_eq!(roman(&Chord::major(PitchClass::G), &key), "VII");
        assert_eq!(roman(&Chord::diminished(PitchClass::new(8)), &key), "vii°");
        assert_eq!(roman(&Chord::diminished(PitchClass::new(6)), &key), "#vi°");
    }
}
