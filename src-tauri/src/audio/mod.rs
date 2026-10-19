//! Audio: dispositivo de salida (cpal), motor y comunicación con el resto de la app.
//!
//! El stream de cpal vive en un hilo propio que no hace nada más (en algunas plataformas
//! el stream no puede cambiar de hilo). La app le habla a través de [`AudioHandle`].

pub mod sequencer;
pub mod sf2;
pub mod synth;

use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, SampleFormat, SizedSample};

pub use sequencer::{AudioMsg, PreviewNote, Shared};
use sequencer::{Engine, Garbage};

const QUEUE_SIZE: usize = 256;

pub struct AudioHandle {
    tx: Mutex<rtrb::Producer<AudioMsg>>,
    garbage: Mutex<rtrb::Consumer<Garbage>>,
    pub shared: Arc<Shared>,
    pub sample_rate: f32,
    /// Si no hay dispositivo de audio, la app funciona igual pero en silencio.
    pub error: Option<String>,
}

impl AudioHandle {
    pub fn start() -> Self {
        let (tx, rx) = rtrb::RingBuffer::<AudioMsg>::new(QUEUE_SIZE);
        let (garbage_tx, garbage_rx) = rtrb::RingBuffer::<Garbage>::new(QUEUE_SIZE);
        let shared = Arc::new(Shared::default());
        let (ready_tx, ready_rx) = mpsc::channel::<Result<f32, String>>();

        let engine_shared = shared.clone();
        thread::Builder::new()
            .name("tonalia-audio".into())
            .spawn(move || match open_stream(rx, garbage_tx, engine_shared) {
                Ok((stream, sample_rate)) => {
                    let _ = ready_tx.send(Ok(sample_rate));
                    // El stream suena mientras este hilo lo mantenga vivo.
                    let _stream = stream;
                    loop {
                        thread::park();
                    }
                }
                Err(e) => {
                    let _ = ready_tx.send(Err(e));
                }
            })
            .expect("no se pudo crear el hilo de audio");

        let (sample_rate, error) = match ready_rx.recv() {
            Ok(Ok(sr)) => (sr, None),
            Ok(Err(e)) => (48_000.0, Some(e)),
            Err(_) => (48_000.0, Some("el hilo de audio terminó sin responder".into())),
        };
        if let Some(e) = &error {
            eprintln!("[audio] sin salida de sonido: {e}");
        }
        Self { tx: Mutex::new(tx), garbage: Mutex::new(garbage_rx), shared, sample_rate, error }
    }

    pub fn send(&self, msg: AudioMsg) {
        // Liberamos aquí lo que el hilo de audio devolvió.
        if let Ok(mut g) = self.garbage.lock() {
            while g.pop().is_ok() {}
        }
        if let Ok(mut tx) = self.tx.lock() {
            if tx.push(msg).is_err() {
                eprintln!("[audio] cola llena: mensaje descartado");
            }
        }
    }
}

fn open_stream(rx: rtrb::Consumer<AudioMsg>, garbage: rtrb::Producer<Garbage>, shared: Arc<Shared>) -> Result<(cpal::Stream, f32), String> {
    let host = cpal::default_host();
    let device = host.default_output_device().ok_or("no hay dispositivo de salida")?;
    let supported = device.default_output_config().map_err(|e| e.to_string())?;
    let format = supported.sample_format();
    let config: cpal::StreamConfig = supported.into();
    let sample_rate = config.sample_rate as f32;
    let engine = Engine::new(sample_rate, shared, garbage);

    let stream = match format {
        SampleFormat::F32 => build::<f32>(&device, &config, engine, rx),
        SampleFormat::I16 => build::<i16>(&device, &config, engine, rx),
        SampleFormat::I32 => build::<i32>(&device, &config, engine, rx),
        SampleFormat::U16 => build::<u16>(&device, &config, engine, rx),
        other => Err(format!("formato de muestra no soportado: {other}")),
    }?;
    stream.play().map_err(|e| e.to_string())?;
    Ok((stream, sample_rate))
}

fn build<T>(device: &cpal::Device, config: &cpal::StreamConfig, mut engine: Engine, mut rx: rtrb::Consumer<AudioMsg>) -> Result<cpal::Stream, String>
where
    T: SizedSample + FromSample<f32>,
{
    let channels = config.channels as usize;
    device
        .build_output_stream(
            config.clone(),
            move |data: &mut [T], _: &cpal::OutputCallbackInfo| {
                while let Ok(msg) = rx.pop() {
                    engine.handle(msg);
                }
                for frame in data.chunks_mut(channels) {
                    let (l, r) = engine.next_sample();
                    for (i, sample) in frame.iter_mut().enumerate() {
                        *sample = T::from_sample(if i % 2 == 0 { l } else { r });
                    }
                }
                engine.publish();
            },
            |err| eprintln!("[audio] error del stream: {err}"),
            None,
        )
        .map_err(|e| e.to_string())
}
