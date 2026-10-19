//! Estado global de la app: el documento (canción + historial) y el audio.

use std::sync::{Mutex, MutexGuard};

use tonalia_core::analysis::{SongView, song_view};
use tonalia_core::history::Document;
use tonalia_core::pitch::PitchClass;
use tonalia_core::{Key, Song};

use crate::audio::{AudioHandle, AudioMsg, sequencer};

pub struct AppState {
    doc: Mutex<Document>,
    pub audio: AudioHandle,
}

impl AppState {
    pub fn new() -> Self {
        let mut song = Song::new(Key::major(PitchClass::C), &["Melodía", "Bajo"]);
        if let Some(bass) = song.tracks.get_mut(1) {
            bass.instrument = "bass".into();
        }
        let state = Self { doc: Mutex::new(Document::new(song)), audio: AudioHandle::start() };
        state.sync_audio(state.doc().song());
        state
    }

    /// Acceso al documento. Si un hilo entró en pánico con el candado tomado, seguimos
    /// con el último estado en lugar de bloquear la app.
    pub fn doc(&self) -> MutexGuard<'_, Document> {
        self.doc.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn view_of(doc: &Document) -> SongView {
        song_view(doc.song(), doc.can_undo(), doc.can_redo())
    }

    /// Recompila la canción y se la entrega al motor de audio.
    pub fn sync_audio(&self, song: &Song) {
        self.audio.send(AudioMsg::Schedule(Box::new(sequencer::compile(song))));
    }
}
