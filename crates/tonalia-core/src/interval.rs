//! Intervalos medidos en semitonos sobre la fundamental.
//!
//! Los intervalos compuestos (más de una octava) se usan para las extensiones:
//! 13 = novena menor (b9), 14 = novena, 17 = oncena, 18 = oncena aumentada (#11),
//! 20 = trecena menor (b13), 21 = trecena.

pub const UNISON: u8 = 0;
pub const MINOR_SECOND: u8 = 1;
pub const MAJOR_SECOND: u8 = 2;
pub const MINOR_THIRD: u8 = 3;
pub const MAJOR_THIRD: u8 = 4;
pub const PERFECT_FOURTH: u8 = 5;
pub const TRITONE: u8 = 6;
pub const PERFECT_FIFTH: u8 = 7;
pub const MINOR_SIXTH: u8 = 8;
pub const MAJOR_SIXTH: u8 = 9;
pub const MINOR_SEVENTH: u8 = 10;
pub const MAJOR_SEVENTH: u8 = 11;
pub const OCTAVE: u8 = 12;
pub const FLAT_NINTH: u8 = 13;
pub const NINTH: u8 = 14;
pub const SHARP_NINTH: u8 = 15;
pub const ELEVENTH: u8 = 17;
pub const SHARP_ELEVENTH: u8 = 18;
pub const FLAT_THIRTEENTH: u8 = 20;
pub const THIRTEENTH: u8 = 21;

// Alias con nombre musical (como `sus2 = segunda mayor`).
pub const SUS2: u8 = MAJOR_SECOND;
pub const SUS4: u8 = PERFECT_FOURTH;
pub const AUGMENTED_FIFTH: u8 = MINOR_SIXTH;
pub const DIMINISHED_FIFTH: u8 = TRITONE;
pub const DIMINISHED_SEVENTH: u8 = MAJOR_SIXTH;

/// Identificador corto del intervalo, independiente del idioma (la interfaz lo traduce).
/// Ejemplos: `"M3"` = tercera mayor, `"P5"` = quinta justa, `"TT"` = tritono, `"b9"`.
pub fn interval_id(semitones: u8) -> &'static str {
    match semitones {
        0 => "P1",
        1 => "m2",
        2 => "M2",
        3 => "m3",
        4 => "M3",
        5 => "P4",
        6 => "TT",
        7 => "P5",
        8 => "m6",
        9 => "M6",
        10 => "m7",
        11 => "M7",
        12 => "P8",
        13 => "b9",
        14 => "9",
        15 => "#9",
        16 => "M10",
        17 => "11",
        18 => "#11",
        19 => "P12",
        20 => "b13",
        21 => "13",
        _ => "?",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extensiones_son_compuestas() {
        assert_eq!(FLAT_NINTH, MINOR_SECOND + OCTAVE);
        assert_eq!(NINTH, MAJOR_SECOND + OCTAVE);
        assert_eq!(ELEVENTH, PERFECT_FOURTH + OCTAVE);
        assert_eq!(SHARP_ELEVENTH, TRITONE + OCTAVE);
        assert_eq!(FLAT_THIRTEENTH, MINOR_SIXTH + OCTAVE);
        assert_eq!(interval_id(PERFECT_FIFTH), "P5");
        assert_eq!(interval_id(SHARP_ELEVENTH), "#11");
    }
}
