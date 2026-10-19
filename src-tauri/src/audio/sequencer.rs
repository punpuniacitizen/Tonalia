//! Secuenciador: la canción se "compila" a una lista de eventos ordenada y el motor la
//! recorre muestra a muestra dentro del callback de audio.
//!
//! Regla de oro del audio en tiempo real: el callback no debe bloquearse ni reservar
//! memoria. Por eso los mensajes llegan por una cola sin bloqueo (`rtrb`) y lo que el
//! motor descarta (programas viejos, notas de preview) vuelve por otra cola para
//! liberarse fuera del hilo de audio.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

use tonalia_core::Song;
use tonalia_core::queries::{chord_track_notes, song_length, track_notes};
use tonalia_core::time::QUARTER;

use super::sf2::Sf2;
use super::synth::{Instrument, Synth};

/// Los ids con este bit son de previsualización; el resto, del secuenciador.
pub const PREVIEW_BIT: u64 = 1 << 63;

#[derive(Clone, Copy, Debug)]
pub struct SeqEvent {
    pub tick: f64,
    pub on: bool,
    pub id: u64,
    pub pitch: u8,
    pub velocity: f32,
    pub instrument: Instrument,
}

#[derive(Debug, Default)]
pub struct Schedule {
    pub bpm: f64,
    pub events: Vec<SeqEvent>,
    pub length: f64,
    pub loop_range: Option<(f64, f64)>,
}

/// Convierte la canción en eventos de nota, aplicando volumen, mute y solo.
pub fn compile(song: &Song) -> Schedule {
    let any_solo = song.chord_track.solo || song.tracks.iter().any(|t| t.solo);
    let audible = |muted: bool, solo: bool| !muted && (!any_solo || solo);

    let mut events = Vec::new();
    let mut next_id = 1u64;
    let mut push = |notes: Vec<tonalia_core::Note>, volume: f32, instrument: Instrument| {
        for n in notes {
            let id = next_id;
            next_id += 1;
            let velocity = n.velocity * volume;
            events.push(SeqEvent { tick: n.position as f64, on: true, id, pitch: n.pitch, velocity, instrument });
            events.push(SeqEvent { tick: n.end() as f64, on: false, id, pitch: n.pitch, velocity: 0.0, instrument });
        }
    };

    let ct = &song.chord_track;
    if audible(ct.muted, ct.solo) {
        push(chord_track_notes(song), ct.volume, Instrument::from_name(&ct.instrument));
    }
    for t in &song.tracks {
        if audible(t.muted, t.solo) {
            push(track_notes(song, t.id), t.volume, Instrument::from_name(&t.instrument));
        }
    }
    // En el mismo instante, primero los note-off: una nota repetida se re-ataca limpia.
    events.sort_by(|a, b| a.tick.total_cmp(&b.tick).then(a.on.cmp(&b.on)));

    let length = song_length(song) as f64;
    let loop_range = song.looping.then(|| song.loop_region.map(|r| (r.start as f64, r.end as f64)).unwrap_or((0.0, length)));
    Schedule { bpm: song.bpm, events, length, loop_range }
}

#[derive(Clone, Copy, Debug)]
pub struct PreviewNote {
    pub pitch: u8,
    pub velocity: f32,
    /// Segundos desde ahora hasta que empieza.
    pub delay: f32,
    /// Segundos que dura.
    pub duration: f32,
    pub instrument: Instrument,
}

pub enum AudioMsg {
    Schedule(Box<Schedule>),
    Play { from: f64 },
    Stop,
    Seek(f64),
    Preview(Vec<PreviewNote>),
    StopPreview,
    /// Banco SoundFont ya cargado (se carga en otro hilo: tarda ~1 s).
    SoundFont(Box<Sf2>),
    /// Elegir instrumentos sampleados (`true`) o el sintetizador FM (`false`).
    UseSoundFont(bool),
}

/// Lo que el hilo de audio devuelve para liberar fuera de él.
/// Nadie lee el contenido: basta con que se destruya en otro hilo.
#[allow(dead_code)]
pub enum Garbage {
    Schedule(Box<Schedule>),
    Notes(Vec<PreviewNote>),
}

/// Estado que el resto de la app puede leer sin bloquear al audio.
#[derive(Default)]
pub struct Shared {
    position_bits: AtomicU64,
    playing: AtomicBool,
    soundfont_loaded: AtomicBool,
    using_soundfont: AtomicBool,
}

impl Shared {
    pub fn soundfont_loaded(&self) -> bool {
        self.soundfont_loaded.load(Ordering::Relaxed)
    }

    pub fn using_soundfont(&self) -> bool {
        self.using_soundfont.load(Ordering::Relaxed)
    }

    pub fn position(&self) -> f64 {
        f64::from_bits(self.position_bits.load(Ordering::Relaxed))
    }

    pub fn playing(&self) -> bool {
        self.playing.load(Ordering::Relaxed)
    }

    fn store(&self, position: f64, playing: bool) {
        self.position_bits.store(position.to_bits(), Ordering::Relaxed);
        self.playing.store(playing, Ordering::Relaxed);
    }
}

#[derive(Clone, Copy)]
struct Pending {
    id: u64,
    start_in: i64,
    stop_in: i64,
    started: bool,
    note: PreviewNote,
}

const MAX_PENDING: usize = 128;

pub struct Engine {
    synth: Synth,
    sf2: Option<Box<Sf2>>,
    use_sf2: bool,
    sample_rate: f32,
    schedule: Box<Schedule>,
    next_event: usize,
    playing: bool,
    position: f64,
    pending: Vec<Pending>,
    preview_counter: u64,
    shared: Arc<Shared>,
    garbage: rtrb::Producer<Garbage>,
}

impl Engine {
    pub fn new(sample_rate: f32, shared: Arc<Shared>, garbage: rtrb::Producer<Garbage>) -> Self {
        Self {
            synth: Synth::new(sample_rate),
            sf2: None,
            use_sf2: true,
            sample_rate,
            schedule: Box::default(),
            next_event: 0,
            playing: false,
            position: 0.0,
            pending: Vec::with_capacity(MAX_PENDING),
            preview_counter: 0,
            shared,
            garbage,
        }
    }

    fn first_event_from(&self, tick: f64) -> usize {
        self.schedule.events.partition_point(|e| e.tick < tick)
    }

    fn sampled(&mut self) -> Option<&mut Sf2> {
        if self.use_sf2 { self.sf2.as_deref_mut() } else { None }
    }

    fn voice_on(&mut self, id: u64, pitch: u8, velocity: f32, instrument: Instrument) {
        match self.sampled() {
            Some(sf) => sf.note_on(pitch, velocity, instrument, id & PREVIEW_BIT != 0),
            None => self.synth.note_on(id, pitch, velocity, instrument),
        }
    }

    fn voice_off(&mut self, id: u64, pitch: u8, instrument: Instrument) {
        match self.sampled() {
            Some(sf) => sf.note_off(pitch, instrument, id & PREVIEW_BIT != 0),
            None => self.synth.note_off(id),
        }
    }

    fn release_sequencer_voices(&mut self) {
        self.synth.release_where(|id| id & PREVIEW_BIT == 0);
        if let Some(sf) = self.sf2.as_deref_mut() {
            sf.release_all(false);
        }
    }

    fn publish_engine(&self) {
        self.shared.soundfont_loaded.store(self.sf2.is_some(), Ordering::Relaxed);
        self.shared.using_soundfont.store(self.sf2.is_some() && self.use_sf2, Ordering::Relaxed);
    }

    pub fn handle(&mut self, msg: AudioMsg) {
        match msg {
            AudioMsg::Schedule(schedule) => {
                let old = std::mem::replace(&mut self.schedule, schedule);
                let _ = self.garbage.push(Garbage::Schedule(old));
                self.release_sequencer_voices();
                if let Some((start, end)) = self.schedule.loop_range {
                    if self.position >= end {
                        self.position = start;
                    }
                }
                self.next_event = self.first_event_from(self.position);
            }
            AudioMsg::Play { from } => {
                self.release_sequencer_voices();
                self.position = from.max(0.0);
                self.next_event = self.first_event_from(self.position);
                self.playing = true;
            }
            AudioMsg::Stop => {
                self.playing = false;
                self.release_sequencer_voices();
            }
            AudioMsg::Seek(tick) => {
                self.position = tick.max(0.0);
                self.next_event = self.first_event_from(self.position);
                self.release_sequencer_voices();
            }
            AudioMsg::Preview(notes) => {
                self.stop_preview();
                let sr = self.sample_rate;
                for note in notes.iter().take(MAX_PENDING) {
                    self.preview_counter += 1;
                    self.pending.push(Pending {
                        id: PREVIEW_BIT | self.preview_counter,
                        start_in: (note.delay * sr) as i64,
                        stop_in: (note.duration * sr) as i64,
                        started: false,
                        note: *note,
                    });
                }
                let _ = self.garbage.push(Garbage::Notes(notes));
            }
            AudioMsg::StopPreview => self.stop_preview(),
            AudioMsg::SoundFont(sf) => {
                self.release_all_voices();
                self.sf2 = Some(sf);
                self.publish_engine();
            }
            AudioMsg::UseSoundFont(on) => {
                // Al cambiar de motor, las notas que suenan en el otro se sueltan.
                self.release_all_voices();
                self.use_sf2 = on;
                self.publish_engine();
            }
        }
    }

    fn release_all_voices(&mut self) {
        self.pending.clear();
        self.synth.release_where(|_| true);
        if let Some(sf) = self.sf2.as_deref_mut() {
            sf.release_all(false);
            sf.release_all(true);
        }
    }

    fn stop_preview(&mut self) {
        self.pending.clear();
        self.synth.release_where(|id| id & PREVIEW_BIT != 0);
        if let Some(sf) = self.sf2.as_deref_mut() {
            sf.release_all(true);
        }
    }

    /// Avanza una muestra y devuelve su valor estéreo.
    pub fn next_sample(&mut self) -> (f32, f32) {
        if self.playing {
            while let Some(e) = self.schedule.events.get(self.next_event).copied() {
                if e.tick > self.position {
                    break;
                }
                self.next_event += 1;
                if e.on {
                    self.voice_on(e.id, e.pitch, e.velocity, e.instrument);
                } else {
                    self.voice_off(e.id, e.pitch, e.instrument);
                }
            }
            let (bpm, loop_range, length) = (self.schedule.bpm, self.schedule.loop_range, self.schedule.length);
            self.position += bpm / 60.0 * QUARTER as f64 / self.sample_rate as f64;
            if let Some((start, end)) = loop_range {
                if self.position >= end {
                    self.position = start;
                    self.next_event = self.first_event_from(start);
                    self.release_sequencer_voices();
                }
            } else if self.position >= length {
                self.playing = false;
                self.position = 0.0;
                self.next_event = 0;
                self.release_sequencer_voices();
            }
        }

        let mut i = 0;
        while i < self.pending.len() {
            let p = self.pending[i];
            if !p.started {
                if p.start_in <= 0 {
                    self.pending[i].started = true;
                    self.voice_on(p.id, p.note.pitch, p.note.velocity, p.note.instrument);
                } else {
                    self.pending[i].start_in -= 1;
                }
            } else if p.stop_in <= 1 {
                self.voice_off(p.id, p.note.pitch, p.note.instrument);
                self.pending.swap_remove(i);
                continue;
            } else {
                self.pending[i].stop_in -= 1;
            }
            i += 1;
        }

        let fm = self.synth.next_sample();
        match self.sf2.as_deref_mut() {
            Some(sf) => {
                let (l, r) = sf.next_sample();
                (l + fm, r + fm)
            }
            None => (fm, fm),
        }
    }

    /// Publica posición y estado para la interfaz (una vez por bloque de audio).
    pub fn publish(&self) {
        self.shared.store(self.position, self.playing);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tonalia_core::Chord;
    use tonalia_core::commands::{EditCommand, apply};
    use tonalia_core::pitch::PitchClass;
    use tonalia_core::time::BAR;

    fn song() -> Song {
        let mut song = Song::default();
        let s = song.sections[0].id;
        apply(&mut song, &EditCommand::InsertChord { section: s, index: 0, chord: Chord::major(PitchClass::C), length: None }).unwrap();
        song
    }

    #[test]
    fn compila_eventos_ordenados() {
        let sched = compile(&song());
        assert_eq!(sched.events.len(), 6);
        assert!(sched.events.windows(2).all(|w| w[0].tick <= w[1].tick));
        assert_eq!(sched.loop_range, Some((0.0, BAR as f64)));
    }

    #[test]
    fn mute_y_solo() {
        let mut s = song();
        s.chord_track.muted = true;
        assert!(compile(&s).events.is_empty());
        s.chord_track.muted = false;
        s.tracks[0].solo = true;
        assert!(compile(&s).events.is_empty(), "con una pista en solo, los acordes callan");
    }

    #[test]
    fn el_motor_avanza_y_hace_bucle() {
        let (producer, _consumer) = rtrb::RingBuffer::new(8);
        let shared = Arc::new(Shared::default());
        let mut engine = Engine::new(48_000.0, shared.clone(), producer);
        engine.handle(AudioMsg::Schedule(Box::new(compile(&song()))));
        engine.handle(AudioMsg::Play { from: 0.0 });
        // A 100 BPM un compás dura 2,4 s: tras 3 s debe haber dado la vuelta.
        let mut peak = 0.0f32;
        for _ in 0..(48_000 * 3) {
            peak = peak.max(engine.next_sample().0.abs());
        }
        engine.publish();
        assert!(peak > 0.05);
        assert!(shared.playing());
        let pos = shared.position();
        assert!(pos > 0.0 && pos < BAR as f64 * 0.3, "posición tras el bucle: {pos}");
    }
}
