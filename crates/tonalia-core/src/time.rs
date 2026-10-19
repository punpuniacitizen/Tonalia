//! Tiempo musical.
//!
//! Usamos ticks enteros: **10368 ticks = 1 redonda**. 10368 = 2⁷·3⁴, así que se divide
//! exactamente en subdivisiones binarias finas (hasta 1/128) y en tresillos.
//! Una negra son 2592 ticks, que además sirve directamente como PPQ de un archivo MIDI.

use serde::{Deserialize, Serialize};

pub type Ticks = i64;

pub const WHOLE: Ticks = 10368;
pub const HALF: Ticks = WHOLE / 2;
pub const QUARTER: Ticks = WHOLE / 4;
pub const EIGHTH: Ticks = WHOLE / 8;
pub const SIXTEENTH: Ticks = WHOLE / 16;
pub const THIRTY_SECOND: Ticks = WHOLE / 32;
pub const SIXTY_FOURTH: Ticks = WHOLE / 64;

/// Por ahora todo está en 4/4: un compás dura una redonda.
pub const BAR: Ticks = WHOLE;

/// Duración mínima de una nota después de aplicar strumming (1/64).
pub const MIN_STRUM_LENGTH: Ticks = SIXTY_FOURTH;

/// Cuadrícula de imán para notas, acordes y secciones.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub enum Grid {
    Off,
    Bar,
    Half,
    Beat,
    Eighth,
    Sixteenth,
    ThirtySecond,
    EighthTriplet,
    SixteenthTriplet,
}

impl Grid {
    /// Paso de la cuadrícula en ticks, o `None` si el imán está apagado.
    pub fn step(self) -> Option<Ticks> {
        Some(match self {
            Grid::Off => return None,
            Grid::Bar => BAR,
            Grid::Half => HALF,
            Grid::Beat => QUARTER,
            Grid::Eighth => EIGHTH,
            Grid::Sixteenth => SIXTEENTH,
            Grid::ThirtySecond => THIRTY_SECOND,
            Grid::EighthTriplet => QUARTER / 3,
            Grid::SixteenthTriplet => EIGHTH / 3,
        })
    }

    /// Redondea `t` a la línea de cuadrícula más cercana.
    pub fn snap(self, t: Ticks) -> Ticks {
        match self.step() {
            Some(step) => (t as f64 / step as f64).round() as Ticks * step,
            None => t,
        }
    }

    /// Redondea `t` hacia abajo a la línea de cuadrícula anterior.
    pub fn snap_floor(self, t: Ticks) -> Ticks {
        match self.step() {
            Some(step) => t.div_euclid(step) * step,
            None => t,
        }
    }
}

/// Convierte ticks a segundos con un tempo dado (BPM en negras).
pub fn ticks_to_seconds(t: Ticks, bpm: f64) -> f64 {
    t as f64 / QUARTER as f64 * 60.0 / bpm
}

/// Convierte segundos a ticks con un tempo dado (BPM en negras).
pub fn seconds_to_ticks(seconds: f64, bpm: f64) -> f64 {
    seconds * bpm / 60.0 * QUARTER as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subdivisiones_exactas() {
        assert_eq!(QUARTER, 2592);
        assert_eq!(SIXTY_FOURTH, 162);
        assert_eq!(Grid::EighthTriplet.step(), Some(864));
        assert_eq!(Grid::SixteenthTriplet.step(), Some(432));
        // 10368 es divisible por todas las cuadrículas.
        for g in [Grid::Bar, Grid::Half, Grid::Beat, Grid::Eighth, Grid::Sixteenth, Grid::ThirtySecond, Grid::EighthTriplet, Grid::SixteenthTriplet] {
            assert_eq!(WHOLE % g.step().unwrap(), 0, "{g:?}");
        }
    }

    #[test]
    fn iman() {
        assert_eq!(Grid::Beat.snap(1300), 2592);
        assert_eq!(Grid::Beat.snap(1200), 0);
        assert_eq!(Grid::Beat.snap_floor(5000), 2592);
        assert_eq!(Grid::Off.snap(1234), 1234);
    }

    #[test]
    fn conversion_segundos() {
        // A 120 BPM una negra dura medio segundo.
        assert!((ticks_to_seconds(QUARTER, 120.0) - 0.5).abs() < 1e-9);
        assert!((seconds_to_ticks(0.5, 120.0) - QUARTER as f64).abs() < 1e-9);
    }
}
