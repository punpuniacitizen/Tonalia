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
    prefs_path: Option<PathBuf>,
    prefs: Mutex<project::Prefs>,
    /// Carpeta de las copias de emergencia.
    pub emergency_dir: Option<PathBuf>,
    /// Última canción copiada a emergencia (para no repetir copias idénticas).
    last_emergency: Mutex<Option<Song>>,
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
        let autosave = app_data.as_deref().map(project::autosave_path);
        let prefs_path = app_data.as_deref().map(project::prefs_path);
        let emergency_dir = app_data.as_deref().map(project::emergency_dir);
        let prefs = prefs_path.as_deref().map(project::read_prefs).unwrap_or_default();
        let song = autosave.as_deref().and_then(|p| project::read_song(p).ok()).unwrap_or_else(new_song);
        // Retomamos el archivo de la última sesión; si la copia automática tiene cambios
        // que no llegaron al archivo (p. ej. se apagó la compu), queda marcado sin guardar.
        let last = prefs.last_project.clone().filter(|p| p.exists());
        let dirty = last.as_deref().is_some_and(|p| project::read_song(p).ok().as_ref() != Some(&song));
        let state = Self {
            doc: Mutex::new(Document::new(song)),
            audio: AudioHandle::start(),
            project_path: Mutex::new(last),
            dirty: Mutex::new(dirty),
            autosave,
            prefs_path,
            prefs: Mutex::new(prefs),
            last_emergency: Mutex::new(emergency_dir.as_deref().and_then(|d| project::emergency_copies(d).first().and_then(|(p, _)| project::read_song(p).ok()))),
            emergency_dir,
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
    /// Con el autoguardado activado, el cambio va también directo al archivo del proyecto.
    pub fn after_change(&self, song: &Song) {
        self.sync_audio(song);
        self.write_autosave(song);
        let target = if self.prefs().autosave_file { self.project_path.lock().unwrap_or_else(|p| p.into_inner()).clone() } else { None };
        let saved = target.is_some_and(|path| match project::write_song(&path, song) {
            Ok(()) => true,
            Err(e) => {
                eprintln!("[proyecto] no se pudo autoguardar en el archivo: {e}");
                false
            }
        });
        *self.dirty.lock().unwrap_or_else(|p| p.into_inner()) = !saved;
    }

    /// Copia de emergencia de la canción actual, si cambió desde la anterior.
    pub fn write_emergency(&self) {
        let Some(dir) = &self.emergency_dir else { return };
        let song = self.doc().song().clone();
        let mut last = self.last_emergency.lock().unwrap_or_else(|p| p.into_inner());
        if last.as_ref() == Some(&song) {
            return;
        }
        let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        match project::write_emergency(dir, &song, stamp) {
            Ok(_) => *last = Some(song),
            Err(e) => eprintln!("[proyecto] no se pudo escribir la copia de emergencia: {e}"),
        }
    }

    pub fn prefs(&self) -> MutexGuard<'_, project::Prefs> {
        self.prefs.lock().unwrap_or_else(|p| p.into_inner())
    }

    /// Modifica las preferencias y las guarda en disco.
    pub fn update_prefs(&self, f: impl FnOnce(&mut project::Prefs)) {
        let mut prefs = self.prefs();
        f(&mut prefs);
        if let Some(path) = &self.prefs_path {
            if let Err(e) = project::write_prefs(path, &prefs) {
                eprintln!("[proyecto] no se pudieron guardar las preferencias: {e}");
            }
        }
    }

    pub fn write_autosave(&self, song: &Song) {
        if let Some(path) = &self.autosave {
            if let Err(e) = project::write_song(path, song) {
                eprintln!("[proyecto] no se pudo autoguardar: {e}");
            }
        }
    }
}
