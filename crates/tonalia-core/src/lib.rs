//! # tonalia-core
//!
//! Núcleo de teoría musical de Tonalia, sin dependencias de interfaz ni de audio.
//!
//! - [`time`]: unidad de tiempo (10368 ticks = 1 redonda) y cuadrículas.
//! - [`pitch`]: clases de altura, nombres de notas y ortografía.
//! - [`interval`]: intervalos en semitonos.
//! - [`scale`]: escalas y tonalidades.
//! - [`chord`]: acordes como fundamental + conjunto de intervalos.
//! - [`naming`]: símbolos de acorde y números romanos.
//! - [`detect`]: reconocer un acorde a partir de notas sueltas.
//! - [`harmony`]: función tonal, tensión y puntuación de transiciones.
//! - [`voicing`]: cómo se reparten las notas de un acorde.
//! - [`palette`]: acordes disponibles para una tonalidad (diatónicos, prestados, vecinos).
//! - [`model`], [`commands`], [`history`], [`queries`], [`analysis`]: la canción y su edición.
//! - [`midi_export`]: exportación a archivo MIDI estándar.

pub mod analysis;
pub mod chord;
pub mod commands;
pub mod detect;
pub mod harmony;
pub mod history;
pub mod interval;
pub mod midi_export;
pub mod model;
pub mod naming;
pub mod palette;
pub mod pitch;
pub mod queries;
pub mod scale;
pub mod time;
pub mod voicing;

pub use chord::Chord;
pub use model::{ChordEntry, Note, Song};
pub use pitch::PitchClass;
pub use scale::{Key, Scale};
pub use time::Ticks;
