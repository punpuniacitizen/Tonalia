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
}

impl Shared {
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

    fn release_sequencer_voices(&mut self) {
        self.synth.release_where(|id| id & PREVIEW_BIT == 0);
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
        }
    }

    fn stop_preview(&mut self) {
        self.pending.clear();
        self.synth.release_where(|id| id & PREVIEW_BIT != 0);
    }

    /// Avanza una muestra y devuelve su valor.
    pub fn next_sample(&mut self) -> f32 {
        if self.playing {
            let s = &self.schedule;
            while self.next_event < s.events.len() && s.events[self.next_event].tick <= self.position {
                let e = s.events[self.next_event];
                if e.on {
                    self.synth.note_on(e.id, e.pitch, e.velocity, e.instrument);
                } else {
                    self.synth.note_off(e.id);
                }
                self.next_event += 1;
            }
            let ticks_per_sample = s.bpm / 60.0 * QUARTER as f64 / self.sample_rate as f64;
            self.position += ticks_per_sample;
            if let Some((start, end)) = s.loop_range {
                if self.position >= end {
                    self.position = start;
                    self.next_event = self.first_event_from(start);
                    self.release_sequencer_voices();
                }
            } else if self.position >= s.length {
                self.playing = false;
                self.position = 0.0;
                self.next_event = 0;
                self.release_sequencer_voices();
            }
        }

        let mut i = 0;
        while i < self.pending.len() {
            let p = &mut self.pending[i];
            if !p.started {
                if p.start_in <= 0 {
                    p.started = true;
                    self.synth.note_on(p.id, p.note.pitch, p.note.velocity, p.note.instrument);
                } else {
                    p.start_in -= 1;
                }
            } else {
                p.stop_in -= 1;
                if p.stop_in <= 0 {
                    self.synth.note_off(p.id);
                    self.pending.swap_remove(i);
                    continue;
                }
            }
            i += 1;
        }

        self.synth.next_sample()
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
            peak = peak.max(engine.next_sample().abs());
        }
        engine.publish();
        assert!(peak > 0.05);
        assert!(shared.playing());
        let pos = shared.position();
        assert!(pos > 0.0 && pos < BAR as f64 * 0.3, "posición tras el bucle: {pos}");
    }
}
