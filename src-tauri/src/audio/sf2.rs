//! Instrumentos sampleados: banco SoundFont 2 (GeneralUser GS) reproducido con rustysynth.
//!
//! Cada instrumento usa un canal MIDI con su programa General MIDI. La previsualización
//! usa canales distintos de la reproducción, así no se pisan las notas iguales.
//! rustysynth trabaja por bloques; aquí lo envolvemos para servir muestra a muestra.

use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::sync::Arc;

use rustysynth::{SoundFont, Synthesizer, SynthesizerSettings};

use super::synth::Instrument;

/// Canales de previsualización (se salta el 9, reservado a percusión).
const PREVIEW_CHANNELS: [i32; 7] = [7, 8, 10, 11, 12, 13, 14];

pub struct Sf2 {
    synth: Synthesizer,
    /// Cuántas notas iguales suenan a la vez en cada canal/tecla (para no cortar antes de tiempo).
    active: [[u16; 128]; 16],
    left: Vec<f32>,
    right: Vec<f32>,
    pos: usize,
}

impl Sf2 {
    pub fn load(path: &Path, sample_rate: f32) -> Result<Self, String> {
        let file = File::open(path).map_err(|e| format!("{}: {e}", path.display()))?;
        let font = Arc::new(SoundFont::new(&mut BufReader::new(file)).map_err(|e| format!("{e:?}"))?);
        let settings = SynthesizerSettings::new(sample_rate as i32);
        let mut synth = Synthesizer::new(&font, &settings).map_err(|e| format!("{e:?}"))?;
        synth.set_master_volume(0.55);
        for inst in Instrument::ALL {
            for channel in [Self::channel(inst, false), Self::channel(inst, true)] {
                synth.process_midi_message(channel, 0xC0, inst.gm_program(), 0);
            }
        }
        let block = synth.get_block_size();
        Ok(Self { synth, active: [[0; 128]; 16], left: vec![0.0; block], right: vec![0.0; block], pos: block })
    }

    fn channel(inst: Instrument, preview: bool) -> i32 {
        if preview { PREVIEW_CHANNELS[inst.index()] } else { inst.index() as i32 }
    }

    pub fn note_on(&mut self, pitch: u8, velocity: f32, inst: Instrument, preview: bool) {
        let ch = Self::channel(inst, preview);
        let key = pitch.min(127);
        let vel = (velocity.clamp(0.0, 1.0) * 127.0).round().max(1.0) as i32;
        self.synth.note_on(ch, key as i32, vel);
        self.active[ch as usize][key as usize] += 1;
    }

    pub fn note_off(&mut self, pitch: u8, inst: Instrument, preview: bool) {
        let ch = Self::channel(inst, preview);
        let key = pitch.min(127);
        let count = &mut self.active[ch as usize][key as usize];
        if *count > 0 {
            *count -= 1;
            if *count == 0 {
                self.synth.note_off(ch, key as i32);
            }
        }
    }

    /// Suelta todas las notas de reproducción (`preview = false`) o de previsualización.
    pub fn release_all(&mut self, preview: bool) {
        for inst in Instrument::ALL {
            let ch = Self::channel(inst, preview);
            self.synth.note_off_all_channel(ch, false);
            self.active[ch as usize] = [0; 128];
        }
    }

    pub fn next_sample(&mut self) -> (f32, f32) {
        if self.pos >= self.left.len() {
            self.synth.render(&mut self.left, &mut self.right);
            self.pos = 0;
        }
        let s = (self.left[self.pos], self.right[self.pos]);
        self.pos += 1;
        s
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn el_banco_carga_y_suena() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../assets/soundfonts/GeneralUser-GS.sf2");
        if !path.exists() {
            eprintln!("sin banco SoundFont: se omite la prueba");
            return;
        }
        let mut sf = Sf2::load(&path, 48_000.0).expect("carga");
        for inst in Instrument::ALL {
            sf.note_on(60, 0.9, inst, false);
        }
        let peak = (0..9600).map(|_| sf.next_sample().0.abs()).fold(0.0f32, f32::max);
        assert!(peak > 0.01, "pico {peak}");
        sf.release_all(false);
        assert!(sf.active.iter().all(|ch| ch.iter().all(|&n| n == 0)));
    }
}
