//! Patrones de ritmo para acompañar con acordes: en vez de sostener el acorde (bloque) o
//! arpegiarlo, se toca con un ritmo (pulsos, contratiempos, charleston, tresillo, bajo y
//! acorde, bajo Alberti o rasgueo de guitarra). Igual que el arpegio, se aplica al reproducir:
//! el voicing se conserva y se puede cambiar o quitar.

use serde::{Deserialize, Serialize};

use crate::model::Note;
use crate::time::{BAR, EIGHTH, QUARTER, THIRTY_SECOND, Ticks};

/// Separación entre cuerdas en un rasgueo.
const STRUM_GAP: Ticks = 60;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub enum RhythmPattern {
    /// El acorde repetido en cada paso.
    Pulse,
    /// En los contratiempos («y» de cada paso), como el ska o el reggae.
    Offbeat,
    /// Tiempo 1 y el «y» del 2 (negra con puntillo + corchea…).
    Charleston,
    /// 3 + 3 + 2 corcheas por compás (el ritmo del pop latino y el reguetón).
    Tresillo,
    /// Bajo en los tiempos 1 y 3, el resto del acorde en 2 y 4 («bum-chic»).
    BassChord,
    /// Grave, agudo, medio, agudo: el bajo Alberti del piano clásico.
    Alberti,
    /// Rasgueo de guitarra: abajo, abajo-arriba, arriba-abajo-arriba.
    Strum,
}

/// Cómo tocar un acorde con ritmo.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct Rhythm {
    pub pattern: RhythmPattern,
    /// Paso del patrón (pulsos, contratiempos, Alberti y rasgueo).
    pub step: Ticks,
    /// Notas cortas (staccato) en vez de ligadas.
    pub short: bool,
    /// Rasgueo hecho a mano (de los patrones de la canción). Sin él, el rasgueo clásico.
    #[serde(default)]
    pub strum: Option<crate::strum::StrumId>,
}

impl Rhythm {
    /// Paso entre una fusa y un compás.
    pub fn sanitized(self) -> Self {
        Self { step: self.step.clamp(THIRTY_SECOND, BAR), ..self }
    }
}

/// Qué notas del acorde suenan en cada golpe.
#[derive(Clone, Copy)]
enum Voices {
    All,
    Bass,
    Upper,
    One(usize),
    StrumDown,
    StrumUp,
}

/// Toca un voicing con un ritmo durante `length`. Posiciones relativas al acorde.
/// `strums` son los patrones de rasgueo de la canción (para los rasgueos hechos a mano).
pub fn apply_rhythm(voicing: &[Note], length: Ticks, rhythm: &Rhythm, strums: &[crate::strum::StrumPattern]) -> Vec<Note> {
    let r = rhythm.sanitized();
    let mut pitches: Vec<u8> = voicing.iter().map(|n| n.pitch).collect();
    pitches.sort_unstable();
    pitches.dedup();
    if pitches.is_empty() || length <= 0 {
        return Vec::new();
    }
    let velocity = voicing.iter().map(|n| n.velocity).sum::<f32>() / voicing.len() as f32;
    if r.pattern == RhythmPattern::Strum
        && let Some(custom) = r.strum.and_then(|id| strums.iter().find(|p| p.id == id))
    {
        return crate::strum::render(&pitches, velocity, length, custom, r.short);
    }
    let step = r.step;

    // Golpes: (inicio, duración, qué notas, acento).
    let mut hits: Vec<(Ticks, Ticks, Voices, f32)> = Vec::new();
    let per_bar = |hits: &mut Vec<(Ticks, Ticks, Voices, f32)>, pattern: &[(Ticks, Ticks, Voices)]| {
        let mut bar = 0;
        while bar < length {
            for (i, &(at, len, voices)) in pattern.iter().enumerate() {
                hits.push((bar + at, len, voices, if i == 0 { 0.08 } else { 0.0 }));
            }
            bar += BAR;
        }
    };
    match r.pattern {
        RhythmPattern::Pulse => {
            let mut t = 0;
            while t < length {
                hits.push((t, step, Voices::All, if t % BAR == 0 { 0.08 } else { 0.0 }));
                t += step;
            }
        }
        RhythmPattern::Offbeat => {
            let mut t = 0;
            while t < length {
                hits.push((t + step / 2, step / 2, Voices::All, 0.0));
                t += step;
            }
        }
        RhythmPattern::Charleston => per_bar(&mut hits, &[(0, 3 * EIGHTH, Voices::All), (3 * EIGHTH, 5 * EIGHTH, Voices::All)]),
        RhythmPattern::Tresillo => per_bar(
            &mut hits,
            &[(0, 3 * EIGHTH, Voices::All), (3 * EIGHTH, 3 * EIGHTH, Voices::All), (6 * EIGHTH, 2 * EIGHTH, Voices::All)],
        ),
        RhythmPattern::BassChord => per_bar(
            &mut hits,
            &[
                (0, QUARTER, Voices::Bass),
                (QUARTER, QUARTER, Voices::Upper),
                (2 * QUARTER, QUARTER, Voices::Bass),
                (3 * QUARTER, QUARTER, Voices::Upper),
            ],
        ),
        RhythmPattern::Alberti => {
            let n = pitches.len();
            let (low, mid, high) = (0, if n >= 3 { n / 2 } else { 0 }, n - 1);
            let order = [low, high, mid, high];
            let mut t = 0;
            let mut k = 0;
            while t < length {
                hits.push((t, step, Voices::One(order[k % 4]), if k % 4 == 0 { 0.06 } else { 0.0 }));
                t += step;
                k += 1;
            }
        }
        RhythmPattern::Strum => {
            // En pasos: abajo (1), abajo-arriba (3, 4), arriba-abajo-arriba (6, 7, 8).
            const STROKES: [(i32, bool); 6] = [(0, true), (2, true), (3, false), (5, false), (6, true), (7, false)];
            let group = 8 * step;
            let mut g = 0;
            while g < length {
                for (i, &(at, down)) in STROKES.iter().enumerate() {
                    let next = STROKES.get(i + 1).map_or(8, |s| s.0);
                    let voices = if down { Voices::StrumDown } else { Voices::StrumUp };
                    hits.push((g + at as Ticks * step, (next - at) as Ticks * step, voices, if i == 0 { 0.08 } else { 0.0 }));
                }
                g += group;
            }
        }
    }

    let mut out = Vec::new();
    for (at, len, voices, accent) in hits {
        if at >= length {
            continue;
        }
        let mut len = len.min(length - at);
        if r.short {
            len = (len / 2).max(THIRTY_SECOND.min(len));
        }
        let vel = (velocity + accent).min(1.0);
        let push = |out: &mut Vec<Note>, offset: Ticks, pitch: u8, v: f32| {
            if offset < len {
                out.push(Note::new(at + offset, len - offset, pitch, v));
            }
        };
        match voices {
            Voices::All => pitches.iter().for_each(|&p| push(&mut out, 0, p, vel)),
            Voices::Bass => push(&mut out, 0, pitches[0], vel),
            Voices::Upper => {
                let upper = if pitches.len() > 1 { &pitches[1..] } else { &pitches[..] };
                upper.iter().for_each(|&p| push(&mut out, 0, p, vel * 0.9));
            }
            Voices::One(i) => push(&mut out, 0, pitches[i], vel),
            Voices::StrumDown => {
                for (i, &p) in pitches.iter().enumerate() {
                    push(&mut out, i as Ticks * STRUM_GAP, p, vel);
                }
            }
            Voices::StrumUp => {
                // Hacia arriba se rozan las cuerdas agudas, un poco más suave.
                for (i, &p) in pitches.iter().rev().take(3).enumerate() {
                    push(&mut out, i as Ticks * STRUM_GAP, p, vel * 0.85);
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::time::{HALF, SIXTEENTH};

    fn triad() -> Vec<Note> {
        vec![Note::new(0, BAR, 60, 0.8), Note::new(0, BAR, 64, 0.8), Note::new(0, BAR, 67, 0.8)]
    }

    fn rhythm(pattern: RhythmPattern, step: Ticks) -> Rhythm {
        Rhythm { pattern, step, short: false, strum: None }
    }

    fn starts(notes: &[Note]) -> Vec<Ticks> {
        let mut s: Vec<Ticks> = notes.iter().map(|n| n.position).collect();
        s.dedup();
        s
    }

    #[test]
    fn pulsos_y_contratiempos() {
        let pulse = apply_rhythm(&triad(), BAR, &rhythm(RhythmPattern::Pulse, QUARTER), &[]);
        assert_eq!(pulse.len(), 12);
        assert_eq!(starts(&pulse), [0, QUARTER, HALF, 3 * QUARTER]);
        let off = apply_rhythm(&triad(), HALF, &rhythm(RhythmPattern::Offbeat, QUARTER), &[]);
        assert_eq!(starts(&off), [EIGHTH, 3 * EIGHTH]);
        assert!(off.iter().all(|n| n.length == EIGHTH));
        // Corto: la mitad.
        let short = apply_rhythm(&triad(), BAR, &Rhythm { short: true, ..rhythm(RhythmPattern::Pulse, QUARTER) }, &[]);
        assert!(short.iter().all(|n| n.length == EIGHTH));
    }

    #[test]
    fn charleston_tresillo_y_bajo_acorde() {
        assert_eq!(starts(&apply_rhythm(&triad(), BAR, &rhythm(RhythmPattern::Charleston, QUARTER), &[])), [0, 3 * EIGHTH]);
        assert_eq!(starts(&apply_rhythm(&triad(), BAR, &rhythm(RhythmPattern::Tresillo, QUARTER), &[])), [0, 3 * EIGHTH, 6 * EIGHTH]);
        let bc = apply_rhythm(&triad(), BAR, &rhythm(RhythmPattern::BassChord, QUARTER), &[]);
        let first: Vec<u8> = bc.iter().filter(|n| n.position == 0).map(|n| n.pitch).collect();
        let second: Vec<u8> = bc.iter().filter(|n| n.position == QUARTER).map(|n| n.pitch).collect();
        assert_eq!(first, [60]);
        assert_eq!(second, [64, 67]);
        // Un acorde de medio compás corta el patrón.
        assert!(apply_rhythm(&triad(), HALF, &rhythm(RhythmPattern::Tresillo, QUARTER), &[]).iter().all(|n| n.end() <= HALF));
    }

    #[test]
    fn alberti_y_rasgueo() {
        let alberti = apply_rhythm(&triad(), HALF, &rhythm(RhythmPattern::Alberti, EIGHTH), &[]);
        assert_eq!(alberti.iter().map(|n| n.pitch).collect::<Vec<_>>(), [60, 67, 64, 67]);
        let strum = apply_rhythm(&triad(), BAR, &rhythm(RhythmPattern::Strum, EIGHTH), &[]);
        // Primer golpe hacia abajo: de grave a agudo, cada cuerda un poco después.
        let down: Vec<(Ticks, u8)> = strum.iter().filter(|n| n.position < EIGHTH).map(|n| (n.position, n.pitch)).collect();
        assert_eq!(down, [(0, 60), (STRUM_GAP, 64), (2 * STRUM_GAP, 67)]);
        // El tercer golpe va hacia arriba: empieza por la aguda.
        let up = strum.iter().find(|n| n.position == 3 * EIGHTH).unwrap();
        assert_eq!(up.pitch, 67);
        assert!(strum.iter().all(|n| n.end() <= BAR));
        // Con paso de semicorchea el rasgueo entra dos veces por compás.
        let fast = apply_rhythm(&triad(), BAR, &rhythm(RhythmPattern::Strum, SIXTEENTH), &[]);
        assert!(fast.iter().any(|n| n.position == HALF));
    }
}
