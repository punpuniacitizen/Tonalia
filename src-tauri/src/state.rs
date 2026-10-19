//! Estado global de la app: el documento (canción + historial), el proyecto y el audio.

use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};

use tonalia_core::analysis::{SongView, song_view};
use tonalia_core::history::Document;
use tonalia_core::pitch::PitchClass;
use tonalia_core::{Key, Song};

use crate::audio::{AudioHandle, AudioMsg, sequencer};
use crate::project;

pub struct AppState {
    doc: Mutex<Document>,
    pub audio: AudioHandle,
    /// Archivo del proyecto abierto (`None` = sin guardar todavía).
    pub project_path: Mutex<Option<PathBuf>>,
    /// Hay cambios sin guardar en el archivo del proyecto.
    pub dirty: Mutex<bool>,
    /// Copia de seguridad continua: la canción se recupera al volver a abrir la app.
    autosave: Option<PathBuf>,
}

/// Canción vacía con las pistas iniciales.
pub fn new_song() -> Song {
    let mut song = Song::new(Key::major(PitchClass::C), &["Melodía", "Bajo"]);
    if let Some(bass) = song.tracks.get_mut(1) {
        bass.instrument = "bass".into();
    }
    song
}

impl AppState {
    pub fn new(app_data: Option<PathBuf>) -> Self {
        let autosave = app_data.map(|d| project::autosave_path(&d));
        let song = autosave.as_deref().and_then(|p| project::read_song(p).ok()).unwrap_or_else(new_song);
        let state = Self {
            doc: Mutex::new(Document::new(song)),
            audio: AudioHandle::start(),
            project_path: Mutex::new(None),
            dirty: Mutex::new(false),
            autosave,
        };
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

    /// Tras cualquier cambio: audio al día, marca de cambios y copia de seguridad.
    pub fn after_change(&self, song: &Song) {
        self.sync_audio(song);
        *self.dirty.lock().unwrap_or_else(|p| p.into_inner()) = true;
        self.write_autosave(song);
    }

    pub fn write_autosave(&self, song: &Song) {
        if let Some(path) = &self.autosave {
            if let Err(e) = project::write_song(path, song) {
                eprintln!("[proyecto] no se pudo autoguardar: {e}");
            }
        }
    }
}
