//! Patrones de rasgueo hechos a mano. Cada canción guarda los suyos con nombre («Estrofa»,
//! «Estribillo»…); los acordes solo dicen con cuál se tocan, así que al cambiar un patrón
//! cambian todos los acordes que lo usan.
//!
//! Un patrón es una grilla de un compás (8, 12 o 16 pasos) con un golpe por paso: hacia
//! abajo (de grave a agudo), hacia arriba (solo las cuerdas agudas, de agudo a grave),
//! apagado (la mano sobre las cuerdas: un golpe corto y seco) o nada. Cada nota suena
//! hasta el golpe siguiente.

use serde::{Deserialize, Serialize};

use crate::model::Note;
use crate::time::{BAR, SIXTY_FOURTH, Ticks};

pub type StrumId = u32;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub enum Stroke {
    #[default]
    Rest,
    Down,
    Up,
    /// Apagado: la mano golpea las cuerdas tapadas (un «chasquido»).
    Mute,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct StrumPattern {
    pub id: StrumId,
    pub name: String,
    /// Pasos por compás: 8 (corcheas), 12 (tresillos) o 16 (semicorcheas).
    pub steps: u8,
    /// Un golpe por paso.
    pub strokes: Vec<Stroke>,
    /// Golpes acentuados (más fuertes).
    pub accents: Vec<bool>,
    /// Tiempo entre cuerda y cuerda, en ticks (más = rasgueo más lento).
    pub spread: Ticks,
    /// Cuántas cuerdas toca el golpe hacia arriba (0 = todas).
    pub up_strings: u8,
    /// Imperfección humana, de 0 (exacto) a 1: corre un poco los golpes y su fuerza.
    pub humanize: f32,
}

impl StrumPattern {
    /// Valores dentro de rango y largos coherentes con los pasos.
    pub fn sanitized(mut self) -> Self {
        self.steps = match self.steps {
            12 => 12,
            16 => 16,
            _ => 8,
        };
        let n = self.steps as usize;
        self.strokes.resize(n, Stroke::Rest);
        self.accents.resize(n, false);
        self.spread = self.spread.clamp(0, 240);
        self.up_strings = self.up_strings.min(6);
        self.humanize = self.humanize.clamp(0.0, 1.0);
        self.name = self.name.trim().chars().take(40).collect();
        self
    }
}

/// Número pseudoaleatorio fijo en [-1, 1] (el mismo cada vez que se reproduce).
fn jitter(seed: u64) -> f32 {
    let mut x = seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ 0xD1B5_4A32_D192_ED03;
    x ^= x >> 29;
    x = x.wrapping_mul(0xBF58_476D_1CE4_E5B9);
    x ^= x >> 32;
    (x % 2001) as f32 / 1000.0 - 1.0
}

/// Toca las alturas (ya ordenadas de grave a agudo) con un patrón durante `length`.
pub fn render(pitches: &[u8], velocity: f32, length: Ticks, pattern: &StrumPattern, short: bool) -> Vec<Note> {
    let p = pattern.clone().sanitized();
    let n = p.steps as usize;
    let step = BAR / p.steps as Ticks;
    // Golpes del compás (índice de paso, golpe).
    let hits: Vec<(usize, Stroke)> = p.strokes.iter().copied().enumerate().filter(|&(_, s)| s != Stroke::Rest).collect();
    if pitches.is_empty() || hits.is_empty() || length <= 0 {
        return Vec::new();
    }
    let mut out = Vec::new();
    let mut bar = 0;
    while bar < length {
        for (k, &(i, stroke)) in hits.iter().enumerate() {
            let at = bar + i as Ticks * step;
            if at >= length {
                break;
            }
            // Suena hasta el golpe siguiente (el primero del compás que viene, si es el último).
            let next = hits.get(k + 1).map_or(n + hits[0].0, |h| h.0);
            let mut len = ((next - i) as Ticks * step).min(length - at);
            if short {
                len = (len / 2).max(SIXTY_FOURTH.min(len));
            }
            let seed = (at as u64) << 8;
            let shift = (jitter(seed) * p.humanize * step as f32 / 8.0) as Ticks;
            let accent = if p.accents[i] { 0.14 } else { 0.0 };
            let force = (velocity * if p.accents[i] { 1.0 } else { 0.86 } + accent + jitter(seed + 1) * p.humanize * 0.08).clamp(0.1, 1.0);
            let (strings, spread, len, force): (Vec<u8>, Ticks, Ticks, f32) = match stroke {
                Stroke::Down => (pitches.to_vec(), p.spread, len, force),
                Stroke::Up => {
                    let take = if p.up_strings == 0 { pitches.len() } else { (p.up_strings as usize).min(pitches.len()) };
                    (pitches.iter().rev().take(take).copied().collect(), p.spread, len, force * 0.88)
                }
                // Apagado: todas las cuerdas, casi a la vez, muy corto y más suave.
                Stroke::Mute => (pitches.to_vec(), p.spread / 4, (step / 3).max(SIXTY_FOURTH).min(len), force * 0.55),
                Stroke::Rest => continue,
            };
            let start = (at + shift).clamp(0, length - 1);
            for (s, &pitch) in strings.iter().enumerate() {
                let offset = s as Ticks * spread;
                let position = start + offset;
                let end = (at + len).min(length);
                if position < end {
                    out.push(Note::new(position, end - position, pitch, force));
                }
            }
        }
        bar += BAR;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::time::EIGHTH;

    fn pattern(code: &str) -> StrumPattern {
        let strokes = code
            .chars()
            .map(|c| match c {
                'D' => Stroke::Down,
                'U' => Stroke::Up,
                'X' => Stroke::Mute,
                _ => Stroke::Rest,
            })
            .collect::<Vec<_>>();
        StrumPattern { id: 1, name: "t".into(), steps: strokes.len() as u8, accents: vec![false; strokes.len()], strokes, spread: 50, up_strings: 2, humanize: 0.0 }
    }

    #[test]
    fn golpes_del_patron() {
        // Pop: ↓ · ↓ ↑ · ↑ ↓ ↑
        let notes = render(&[48, 52, 55, 60], 0.8, BAR, &pattern("D.DU.UDU"), false);
        let mut starts: Vec<Ticks> = notes.iter().map(|n| n.position - n.position % EIGHTH).collect();
        starts.dedup();
        assert_eq!(starts, [0, 2 * EIGHTH, 3 * EIGHTH, 5 * EIGHTH, 6 * EIGHTH, 7 * EIGHTH]);
        // Abajo: las cuatro cuerdas de grave a agudo; arriba: las 2 agudas de agudo a grave.
        assert_eq!(notes.iter().filter(|n| n.position < EIGHTH).map(|n| n.pitch).collect::<Vec<_>>(), [48, 52, 55, 60]);
        let up: Vec<u8> = notes.iter().filter(|n| (3 * EIGHTH..4 * EIGHTH).contains(&n.position)).map(|n| n.pitch).collect();
        assert_eq!(up, [60, 55]);
        // El primer golpe suena hasta el siguiente (dos corcheas).
        assert_eq!(notes[0].length, 2 * EIGHTH);
        assert!(notes.iter().all(|n| n.end() <= BAR));
    }

    #[test]
    fn apagado_acentos_y_humanizar() {
        let mut p = pattern("D.X.D.X.");
        p.accents[0] = true;
        let notes = render(&[48, 52, 55], 0.7, BAR, &p, false);
        let mute = notes.iter().find(|n| n.position >= 2 * EIGHTH && n.position < 3 * EIGHTH).unwrap();
        assert!(mute.length < EIGHTH / 2 && mute.velocity < 0.5);
        let first = notes[0].velocity;
        let third = notes.iter().find(|n| n.position >= 4 * EIGHTH).unwrap().velocity;
        assert!(first > third, "el acento suena más fuerte");
        // Humanizar mueve un poco, pero siempre igual.
        p.humanize = 1.0;
        let a = render(&[48, 52, 55], 0.7, BAR, &p, false);
        assert_eq!(a, render(&[48, 52, 55], 0.7, BAR, &p, false));
        assert!(a.iter().all(|n| n.position >= 0 && n.end() <= BAR));
        // Se repite en cada compás y respeta el largo del acorde.
        assert!(render(&[48, 52, 55], 0.7, 2 * BAR, &pattern("D.DU.UDU"), false).iter().any(|n| n.position >= BAR));
    }
}
