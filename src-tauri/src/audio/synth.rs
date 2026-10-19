//! Sintetizador polifónico propio, sin samples: síntesis FM de dos operadores.
//!
//! Cada voz es una portadora senoidal modulada en frecuencia por otra senoide. El índice
//! de modulación decae rápido (ataque brillante que se oscurece), como un piano eléctrico.
//! Cuatro "instrumentos" cambian los parámetros: piano eléctrico, bajo, pulsado y colchón.

use std::f32::consts::TAU;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Instrument {
    EPiano,
    Bass,
    Pluck,
    Pad,
}

impl Instrument {
    pub fn from_name(name: &str) -> Self {
        match name {
            "bass" => Instrument::Bass,
            "pluck" => Instrument::Pluck,
            "pad" => Instrument::Pad,
            _ => Instrument::EPiano,
        }
    }

    fn params(self) -> Params {
        match self {
            Instrument::EPiano => Params { attack: 0.004, decay: 1.6, sustain: 0.0, release: 0.35, ratio: 1.0, index: 2.2, index_decay: 0.35, gain: 0.9, detune: 0.0 },
            Instrument::Bass => Params { attack: 0.006, decay: 0.9, sustain: 0.55, release: 0.12, ratio: 1.0, index: 1.3, index_decay: 0.15, gain: 1.1, detune: 0.0 },
            Instrument::Pluck => Params { attack: 0.002, decay: 0.35, sustain: 0.0, release: 0.2, ratio: 2.0, index: 3.0, index_decay: 0.12, gain: 0.8, detune: 0.0 },
            Instrument::Pad => Params { attack: 0.35, decay: 2.5, sustain: 0.75, release: 0.9, ratio: 1.0, index: 0.6, index_decay: 3.0, gain: 0.55, detune: 0.006 },
        }
    }
}

#[derive(Clone, Copy)]
struct Params {
    /// Segundos hasta el máximo.
    attack: f32,
    /// Constante de tiempo (s) del decaimiento hacia `sustain`.
    decay: f32,
    sustain: f32,
    /// Duración aproximada (s) del final de la nota.
    release: f32,
    /// Frecuencia del modulador respecto a la portadora.
    ratio: f32,
    /// Índice de modulación inicial (brillo).
    index: f32,
    /// Constante de tiempo (s) con la que se apaga el brillo.
    index_decay: f32,
    gain: f32,
    /// Desafinación de un segundo oscilador (0 = ninguno).
    detune: f32,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Stage {
    Idle,
    Attack,
    Decay,
    Release,
}

#[derive(Clone, Copy)]
struct Voice {
    id: u64,
    stage: Stage,
    params: Params,
    age: u64,
    freq: f32,
    velocity: f32,
    phase: f32,
    mod_phase: f32,
    phase2: f32,
    env: f32,
    mod_env: f32,
    attack_step: f32,
    decay_coef: f32,
    release_coef: f32,
    mod_coef: f32,
}

const SILENT: Voice = Voice {
    id: 0,
    stage: Stage::Idle,
    params: Params { attack: 0.0, decay: 1.0, sustain: 0.0, release: 0.1, ratio: 1.0, index: 0.0, index_decay: 1.0, gain: 0.0, detune: 0.0 },
    age: 0,
    freq: 0.0,
    velocity: 0.0,
    phase: 0.0,
    mod_phase: 0.0,
    phase2: 0.0,
    env: 0.0,
    mod_env: 0.0,
    attack_step: 1.0,
    decay_coef: 0.0,
    release_coef: 0.0,
    mod_coef: 0.0,
};

pub const MAX_VOICES: usize = 64;
const MASTER_GAIN: f32 = 0.22;

pub struct Synth {
    voices: Vec<Voice>,
    sample_rate: f32,
    clock: u64,
}

fn coef(seconds: f32, sample_rate: f32) -> f32 {
    (-1.0 / (seconds.max(1e-4) * sample_rate)).exp()
}

impl Synth {
    pub fn new(sample_rate: f32) -> Self {
        Self { voices: vec![SILENT; MAX_VOICES], sample_rate, clock: 0 }
    }

    pub fn note_on(&mut self, id: u64, pitch: u8, velocity: f32, instrument: Instrument) {
        // Voz libre; si no hay, robamos la más antigua (preferimos una que ya se esté apagando).
        let slot = self.voices.iter().position(|v| v.stage == Stage::Idle).unwrap_or_else(|| {
            let (i, _) = self
                .voices
                .iter()
                .enumerate()
                .min_by_key(|(_, v)| (v.stage != Stage::Release, v.age))
                .expect("siempre hay voces");
            i
        });
        let mut p = instrument.params();
        // Las notas graves de piano suenan más tiempo que las agudas.
        if instrument == Instrument::EPiano {
            p.decay *= (1.0 + (60.0 - pitch as f32) / 48.0).clamp(0.5, 2.0);
        }
        let sr = self.sample_rate;
        self.clock += 1;
        self.voices[slot] = Voice {
            id,
            stage: Stage::Attack,
            params: p,
            age: self.clock,
            freq: 440.0 * 2f32.powf((pitch as f32 - 69.0) / 12.0),
            velocity: velocity.clamp(0.0, 1.0),
            phase: 0.0,
            mod_phase: 0.0,
            phase2: 0.25,
            env: 0.0,
            mod_env: 1.0,
            attack_step: 1.0 / (p.attack.max(1e-4) * sr),
            decay_coef: coef(p.decay, sr),
            release_coef: coef(p.release / 4.0, sr),
            mod_coef: coef(p.index_decay, sr),
        };
    }

    pub fn note_off(&mut self, id: u64) {
        for v in &mut self.voices {
            if v.id == id && matches!(v.stage, Stage::Attack | Stage::Decay) {
                v.stage = Stage::Release;
            }
        }
    }

    /// Apaga suavemente todas las voces cuyo id cumpla la condición.
    pub fn release_where(&mut self, pred: impl Fn(u64) -> bool) {
        for v in &mut self.voices {
            if v.stage != Stage::Idle && pred(v.id) {
                v.stage = Stage::Release;
            }
        }
    }

    pub fn next_sample(&mut self) -> f32 {
        let sr = self.sample_rate;
        let mut sum = 0.0;
        for v in &mut self.voices {
            match v.stage {
                Stage::Idle => continue,
                Stage::Attack => {
                    v.env += v.attack_step;
                    if v.env >= 1.0 {
                        v.env = 1.0;
                        v.stage = Stage::Decay;
                    }
                }
                Stage::Decay => {
                    v.env = v.params.sustain + (v.env - v.params.sustain) * v.decay_coef;
                    if v.params.sustain == 0.0 && v.env < 1e-4 {
                        v.stage = Stage::Idle;
                        continue;
                    }
                }
                Stage::Release => {
                    v.env *= v.release_coef;
                    if v.env < 1e-4 {
                        v.stage = Stage::Idle;
                        continue;
                    }
                }
            }
            v.mod_env *= v.mod_coef;
            let brightness = v.params.index * v.mod_env * (0.4 + 0.6 * v.velocity);
            let modulator = (TAU * v.mod_phase).sin();
            let mut s = (TAU * v.phase + brightness * modulator).sin();
            if v.params.detune > 0.0 {
                s = 0.6 * s + 0.4 * (TAU * v.phase2).sin();
                v.phase2 = (v.phase2 + v.freq * (1.0 + v.params.detune) / sr).fract();
            }
            sum += s * v.env * v.velocity * v.params.gain;
            v.phase = (v.phase + v.freq / sr).fract();
            v.mod_phase = (v.mod_phase + v.freq * v.params.ratio / sr).fract();
        }
        // Saturación suave: muchos acordes juntos nunca recortan de golpe.
        (sum * MASTER_GAIN).tanh()
    }

    #[cfg(test)]
    pub fn active_voices(&self) -> usize {
        self.voices.iter().filter(|v| v.stage != Stage::Idle).count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn suena_y_se_apaga() {
        let mut s = Synth::new(48_000.0);
        s.note_on(1, 60, 1.0, Instrument::EPiano);
        let peak = (0..4800).map(|_| s.next_sample().abs()).fold(0.0f32, f32::max);
        assert!(peak > 0.05, "pico {peak}");
        s.note_off(1);
        for _ in 0..48_000 {
            s.next_sample();
        }
        assert_eq!(s.active_voices(), 0);
    }

    #[test]
    fn roba_voces_sin_desbordar() {
        let mut s = Synth::new(48_000.0);
        for i in 0..(MAX_VOICES as u64 + 10) {
            s.note_on(i, 40 + (i % 40) as u8, 0.8, Instrument::Pad);
        }
        assert_eq!(s.active_voices(), MAX_VOICES);
        assert!(s.next_sample().abs() <= 1.0);
    }
}
