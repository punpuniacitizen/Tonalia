//! Instrumentos sampleados: banco SoundFont 2 (GeneralUser GS) reproducido con rustysynth.
//!
//! Cada instrumento usa un canal MIDI con su programa General MIDI. La previsualización
//! usa canales distintos de la reproducción, así no se pisan las notas iguales. Con el 9
//! reservado a la percusión no alcanzan los canales para todos: el colchón y la cajita
//! musical comparten el de previsualización y se cambia el programa al tocar.
//!
//! El paneo es por canal (controlador 10), así que la reproducción no fija un canal por
//! instrumento: cada combinación (instrumento, paneo) toma uno de los 8 canales libres.
//! Al empezar, cada instrumento ocupa el suyo en el centro, como antes.
//! rustysynth trabaja por bloques; aquí lo envolvemos para servir muestra a muestra.

use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::sync::Arc;

use rustysynth::{SoundFont, Synthesizer, SynthesizerSettings};

use super::synth::Instrument;

/// Canales de previsualización (se salta el 9, reservado a percusión). La reproducción usa del 0 al 7.
const PREVIEW_CHANNELS: [i32; 8] = [8, 10, 11, 12, 13, 14, 15, 15];
const PLAYBACK_CHANNELS: usize = 8;

/// Paneo como valor del controlador 10 (0 = izquierda, 64 = centro, 127 = derecha).
fn pan_cc(pan: f32) -> i32 {
    (64.0 + pan.clamp(-1.0, 1.0) * 63.5).round().clamp(0.0, 127.0) as i32
}

pub struct Sf2 {
    synth: Synthesizer,
    /// Cuántas notas iguales suenan a la vez en cada canal/tecla (para no cortar antes de tiempo).
    active: [[u16; 128]; 16],
    /// Programa cargado en cada canal (los compartidos lo cambian al tocar).
    programs: [i32; 16],
    /// Paneo (valor CC10) de cada canal de reproducción.
    pans: [i32; PLAYBACK_CHANNELS],
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
        let mut programs = [-1; 16];
        for inst in Instrument::ALL {
            for channel in [inst.index() as i32, PREVIEW_CHANNELS[inst.index()]] {
                synth.process_midi_message(channel, 0xC0, inst.gm_program(), 0);
                programs[channel as usize] = inst.gm_program();
            }
        }
        let block = synth.get_block_size();
        Ok(Self {
            synth,
            active: [[0; 128]; 16],
            programs,
            pans: [64; PLAYBACK_CHANNELS],
            left: vec![0.0; block],
            right: vec![0.0; block],
            pos: block,
        })
    }

    fn idle(&self, ch: usize) -> bool {
        self.active[ch].iter().all(|&n| n == 0)
    }

    /// Canal de reproducción con ese programa y paneo, si ya hay uno.
    fn find_playback(&self, program: i32, pan: i32) -> Option<usize> {
        (0..PLAYBACK_CHANNELS).find(|&ch| self.programs[ch] == program && self.pans[ch] == pan)
    }

    /// Canal para una nota nueva. Si ninguno tiene ese instrumento y paneo, se reconfigura uno
    /// callado (primero el «propio» del instrumento). Si todos suenan, se usa uno con el mismo
    /// instrumento aunque esté paneado distinto.
    fn playback_channel(&mut self, inst: Instrument, pan: i32) -> usize {
        let program = inst.gm_program();
        if let Some(ch) = self.find_playback(program, pan) {
            return ch;
        }
        let own = inst.index();
        let free = std::iter::once(own).chain(0..PLAYBACK_CHANNELS).find(|&ch| self.idle(ch));
        match free {
            Some(ch) => {
                if self.programs[ch] != program {
                    self.synth.process_midi_message(ch as i32, 0xC0, program, 0);
                    self.programs[ch] = program;
                }
                self.synth.process_midi_message(ch as i32, 0xB0, 10, pan);
                self.pans[ch] = pan;
                ch
            }
            None => (0..PLAYBACK_CHANNELS).find(|&ch| self.programs[ch] == program).unwrap_or(own),
        }
    }

    pub fn note_on(&mut self, pitch: u8, velocity: f32, inst: Instrument, preview: bool, pan: f32) {
        let ch = if preview { PREVIEW_CHANNELS[inst.index()] } else { self.playback_channel(inst, pan_cc(pan)) as i32 };
        // Canal compartido: las notas que ya suenan siguen con su programa; las nuevas usan este.
        if self.programs[ch as usize] != inst.gm_program() {
            self.synth.process_midi_message(ch, 0xC0, inst.gm_program(), 0);
            self.programs[ch as usize] = inst.gm_program();
        }
        let key = pitch.min(127);
        let vel = (velocity.clamp(0.0, 1.0) * 127.0).round().max(1.0) as i32;
        self.synth.note_on(ch, key as i32, vel);
        self.active[ch as usize][key as usize] += 1;
    }

    pub fn note_off(&mut self, pitch: u8, inst: Instrument, preview: bool, pan: f32) {
        let ch = if preview {
            PREVIEW_CHANNELS[inst.index()]
        } else {
            let program = inst.gm_program();
            // El canal donde empezó; si se reconfiguró, el que tenga esa tecla sonando.
            match self.find_playback(program, pan_cc(pan)).or_else(|| {
                (0..PLAYBACK_CHANNELS).find(|&ch| self.programs[ch] == program && self.active[ch][pitch.min(127) as usize] > 0)
            }) {
                Some(ch) => ch as i32,
                None => return,
            }
        };
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
        let channels: Vec<i32> = if preview { PREVIEW_CHANNELS.to_vec() } else { (0..PLAYBACK_CHANNELS as i32).collect() };
        for ch in channels {
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
            sf.note_on(60, 0.9, inst, false, 0.0);
        }
        let peak = (0..9600).map(|_| sf.next_sample().0.abs()).fold(0.0f32, f32::max);
        assert!(peak > 0.01, "pico {peak}");
        sf.release_all(false);
        assert!(sf.active.iter().all(|ch| ch.iter().all(|&n| n == 0)));
    }

    #[test]
    fn el_paneo_toma_otro_canal() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../assets/soundfonts/GeneralUser-GS.sf2");
        if !path.exists() {
            return;
        }
        let mut sf = Sf2::load(&path, 48_000.0).expect("carga");
        // Dos pistas de piano, una a cada lado: suenan en canales distintos y solo por su lado.
        sf.note_on(60, 0.9, Instrument::Piano, false, -1.0);
        sf.note_on(64, 0.9, Instrument::Piano, false, 1.0);
        let used: Vec<usize> = (0..PLAYBACK_CHANNELS).filter(|&ch| !sf.idle(ch)).collect();
        assert_eq!(used.len(), 2);
        sf.note_off(64, Instrument::Piano, false, 1.0);
        assert_eq!((0..PLAYBACK_CHANNELS).filter(|&ch| !sf.idle(ch)).count(), 1);
        // Una sola nota a la izquierda: casi nada por la derecha.
        let mut sf = Sf2::load(&path, 48_000.0).expect("carga");
        sf.note_on(60, 0.9, Instrument::Piano, false, -1.0);
        let (mut l, mut r) = (0.0f32, 0.0f32);
        for _ in 0..9600 {
            let (a, b) = sf.next_sample();
            l = l.max(a.abs());
            r = r.max(b.abs());
        }
        assert!(l > r * 4.0, "izquierda {l}, derecha {r}");
    }
}
