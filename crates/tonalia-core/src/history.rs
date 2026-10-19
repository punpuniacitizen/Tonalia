//! Documento con historial de deshacer/rehacer.
//!
//! Usamos instantáneas completas: una canción ocupa pocos KB, así que guardar una copia
//! por paso es simple y a prueba de errores (no hay que escribir el "inverso" de cada comando).

use crate::commands::{EditCommand, EditError, apply};
use crate::model::Song;

pub const DEFAULT_HISTORY_LIMIT: usize = 200;

#[derive(Clone, Debug)]
pub struct Document {
    song: Song,
    undo: Vec<Song>,
    redo: Vec<Song>,
    limit: usize,
}

impl Document {
    pub fn new(song: Song) -> Self {
        Self { song, undo: Vec::new(), redo: Vec::new(), limit: DEFAULT_HISTORY_LIMIT }
    }

    pub fn song(&self) -> &Song {
        &self.song
    }

    /// Aplica un comando de forma atómica: o se aplica entero, o la canción no cambia.
    /// Devuelve `true` si la canción cambió.
    pub fn apply(&mut self, cmd: &EditCommand) -> Result<bool, EditError> {
        let mut next = self.song.clone();
        apply(&mut next, cmd)?;
        if next == self.song {
            return Ok(false);
        }
        let previous = std::mem::replace(&mut self.song, next);
        if cmd.is_undoable() {
            self.undo.push(previous);
            if self.undo.len() > self.limit {
                self.undo.remove(0);
            }
            self.redo.clear();
        }
        Ok(true)
    }

    pub fn undo(&mut self) -> bool {
        match self.undo.pop() {
            Some(previous) => {
                let current = std::mem::replace(&mut self.song, previous);
                self.redo.push(current);
                true
            }
            None => false,
        }
    }

    pub fn redo(&mut self) -> bool {
        match self.redo.pop() {
            Some(next) => {
                let current = std::mem::replace(&mut self.song, next);
                self.undo.push(current);
                true
            }
            None => false,
        }
    }

    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }

    /// Reemplaza la canción (al abrir un proyecto) y vacía el historial.
    pub fn replace(&mut self, song: Song) {
        self.song = song;
        self.undo.clear();
        self.redo.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::voicing::PreviewSettings;

    #[test]
    fn deshacer_y_rehacer() {
        let mut doc = Document::new(Song::default());
        assert!(doc.apply(&EditCommand::SetBpm { bpm: 90.0 }).unwrap());
        assert!(doc.apply(&EditCommand::SetBpm { bpm: 140.0 }).unwrap());
        assert!(doc.undo());
        assert_eq!(doc.song().bpm, 90.0);
        assert!(doc.redo());
        assert_eq!(doc.song().bpm, 140.0);
        assert!(doc.undo() && doc.undo());
        assert_eq!(doc.song().bpm, 100.0);
        assert!(!doc.undo());
        // Un comando nuevo borra lo que se podía rehacer.
        doc.apply(&EditCommand::SetBpm { bpm: 60.0 }).unwrap();
        assert!(!doc.can_redo());
    }

    #[test]
    fn errores_y_comandos_sin_historial() {
        let mut doc = Document::new(Song::default());
        let bad = EditCommand::Batch { commands: vec![EditCommand::SetBpm { bpm: 70.0 }, EditCommand::RemoveTrack { track: 999 }] };
        assert!(doc.apply(&bad).is_err());
        assert_eq!(doc.song().bpm, 100.0, "el lote falló: nada debe cambiar");
        let preview = PreviewSettings { octave: 4, ..Default::default() };
        assert!(doc.apply(&EditCommand::SetPreviewSettings { settings: preview }).unwrap());
        assert!(!doc.can_undo());
        assert!(!doc.apply(&EditCommand::SetBpm { bpm: 100.0 }).unwrap(), "sin cambios no hay paso nuevo");
    }
}
