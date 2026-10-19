//! Clases de altura, nombres de notas y ortografía (sostenidos o bemoles).

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Módulo 12 que siempre devuelve 0..=11, también para negativos.
pub fn mod12(v: i32) -> u8 {
    v.rem_euclid(12) as u8
}

/// Clase de altura: una nota sin octava. 0 = Do, 1 = Do#/Reb, … 11 = Si.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(from = "u8", into = "u8")]
pub struct PitchClass(u8);

impl From<u8> for PitchClass {
    fn from(v: u8) -> Self {
        Self(v % 12)
    }
}

impl From<PitchClass> for u8 {
    fn from(pc: PitchClass) -> Self {
        pc.0
    }
}

impl PitchClass {
    pub const C: Self = Self(0);
    pub const D: Self = Self(2);
    pub const E: Self = Self(4);
    pub const F: Self = Self(5);
    pub const G: Self = Self(7);
    pub const A: Self = Self(9);
    pub const B: Self = Self(11);

    pub fn new(v: i32) -> Self {
        Self(mod12(v))
    }

    /// Clase de altura de una nota MIDI (60 = Do central).
    pub fn of_midi(pitch: u8) -> Self {
        Self(pitch % 12)
    }

    pub fn value(self) -> u8 {
        self.0
    }

    pub fn transpose(self, semitones: i32) -> Self {
        Self::new(self.0 as i32 + semitones)
    }

    /// Semitonos que hay que subir desde `self` para llegar a `other` (0..=11).
    pub fn up_to(self, other: Self) -> u8 {
        mod12(other.0 as i32 - self.0 as i32)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum NoteParseError {
    #[error("nombre de nota vacío")]
    Empty,
    #[error("'{0}' no es una letra de nota")]
    NotANoteLetter(char),
    #[error("'{0}' no es una alteración")]
    NotAnAccidental(char),
}

/// Lee un nombre de nota como `"Eb"`, `"F##"`, `"Cbb"` o `"H"` (Si en notación alemana).
/// Las alteraciones se acumulan: cada `#` sube y cada `b` baja un semitono.
pub fn parse_note_name(text: &str) -> Result<PitchClass, NoteParseError> {
    let mut chars = text.trim().chars();
    let first = chars.next().ok_or(NoteParseError::Empty)?;
    let mut value: i32 = match first.to_ascii_uppercase() {
        'C' => 0,
        'D' => 2,
        'E' => 4,
        'F' => 5,
        'G' => 7,
        'A' => 9,
        'B' | 'H' => 11,
        _ => return Err(NoteParseError::NotANoteLetter(first)),
    };
    for c in chars {
        match c {
            '#' | '♯' => value += 1,
            'b' | '♭' => value -= 1,
            other => return Err(NoteParseError::NotAnAccidental(other)),
        }
    }
    Ok(PitchClass::new(value))
}

/// Preferencia para escribir las teclas negras.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Accidentals {
    Sharps,
    Flats,
}

/// Sistema de nombres: C-D-E o Do-Re-Mi.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Notation {
    Letters,
    Solfege,
}

const NATURAL_PCS: [u8; 7] = [0, 2, 4, 5, 7, 9, 11];
const LETTER_NAMES: [&str; 7] = ["C", "D", "E", "F", "G", "A", "B"];
const SOLFEGE_NAMES: [&str; 7] = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"];

/// Una nota escrita: letra (0 = C … 6 = B) más alteración (−2 = doble bemol … +2 = doble sostenido).
///
/// La misma clase de altura puede escribirse de varias formas (Do# = Reb). La ortografía
/// correcta depende de la escala: en Mi mayor el tercer grado es Sol#, no Lab.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SpelledNote {
    pub letter: u8,
    pub accidental: i8,
}

impl SpelledNote {
    /// Escribe `pc` usando obligatoriamente la letra `letter`.
    pub fn with_letter(pc: PitchClass, letter: u8) -> Self {
        let letter = letter % 7;
        let natural = NATURAL_PCS[letter as usize] as i32;
        // Diferencia en el rango −6..=5 (el camino más corto alrededor del círculo).
        let diff = (pc.value() as i32 - natural + 6).rem_euclid(12) - 6;
        Self { letter, accidental: diff as i8 }
    }

    /// Escritura sin contexto: natural si se puede, si no según la preferencia.
    pub fn simple(pc: PitchClass, prefer: Accidentals) -> Self {
        if let Some(letter) = NATURAL_PCS.iter().position(|&n| n == pc.value()) {
            return Self { letter: letter as u8, accidental: 0 };
        }
        let neighbour = match prefer {
            Accidentals::Sharps => pc.transpose(-1),
            Accidentals::Flats => pc.transpose(1),
        };
        let letter = NATURAL_PCS
            .iter()
            .position(|&n| n == neighbour.value())
            .expect("las teclas negras siempre tienen vecinas blancas") as u8;
        Self::with_letter(pc, letter)
    }

    pub fn pitch_class(self) -> PitchClass {
        PitchClass::new(NATURAL_PCS[self.letter as usize] as i32 + self.accidental as i32)
    }

    pub fn name(self, notation: Notation) -> String {
        let base = match notation {
            Notation::Letters => LETTER_NAMES[self.letter as usize],
            Notation::Solfege => SOLFEGE_NAMES[self.letter as usize],
        };
        let accidental = match self.accidental {
            a if a > 0 => "#".repeat(a as usize),
            a if a < 0 => "b".repeat((-a) as usize),
            _ => String::new(),
        };
        format!("{base}{accidental}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parser_de_nombres() {
        assert_eq!(parse_note_name("C"), Ok(PitchClass::C));
        assert_eq!(parse_note_name("Eb"), Ok(PitchClass::new(3)));
        assert_eq!(parse_note_name("F##"), Ok(PitchClass::G));
        assert_eq!(parse_note_name("Cbb"), Ok(PitchClass::new(10)));
        assert_eq!(parse_note_name("H"), Ok(PitchClass::B));
        assert_eq!(parse_note_name("B#"), Ok(PitchClass::C));
        assert_eq!(parse_note_name(""), Err(NoteParseError::Empty));
        assert_eq!(parse_note_name("X"), Err(NoteParseError::NotANoteLetter('X')));
        assert_eq!(parse_note_name("C$"), Err(NoteParseError::NotAnAccidental('$')));
    }

    #[test]
    fn modulo_negativo() {
        assert_eq!(mod12(-1), 11);
        assert_eq!(mod12(-13), 11);
        assert_eq!(PitchClass::C.up_to(PitchClass::B), 11);
        assert_eq!(PitchClass::B.up_to(PitchClass::C), 1);
    }

    #[test]
    fn ortografia() {
        let cs = SpelledNote::simple(PitchClass::new(1), Accidentals::Sharps);
        let db = SpelledNote::simple(PitchClass::new(1), Accidentals::Flats);
        assert_eq!(cs.name(Notation::Letters), "C#");
        assert_eq!(db.name(Notation::Letters), "Db");
        assert_eq!(db.name(Notation::Solfege), "Reb");
        assert_eq!(SpelledNote::with_letter(PitchClass::new(5), 2).name(Notation::Letters), "E#");
        assert_eq!(SpelledNote::with_letter(PitchClass::new(9), 6).name(Notation::Letters), "Bbb");
        assert_eq!(SpelledNote::with_letter(PitchClass::B, 0).name(Notation::Letters), "Cb");
        assert_eq!(SpelledNote::with_letter(PitchClass::B, 0).pitch_class(), PitchClass::B);
    }

    #[test]
    fn serde_normaliza() {
        let pc: PitchClass = serde_json::from_str("14").unwrap();
        assert_eq!(pc, PitchClass::D);
        assert_eq!(serde_json::to_string(&PitchClass::E).unwrap(), "4");
    }
}
