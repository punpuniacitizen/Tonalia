//! Archivos de proyecto (`.tonalia`, JSON legible) y autoguardado.

use std::fs;
use std::path::{Path, PathBuf};

use tonalia_core::Song;
use tonalia_core::model::SONG_FORMAT_VERSION;

pub const EXTENSION: &str = "tonalia";
const AUTOSAVE_FILE: &str = "autosave.tonalia";

pub fn autosave_path(app_data: &Path) -> PathBuf {
    app_data.join(AUTOSAVE_FILE)
}

pub fn read_song(path: &Path) -> Result<Song, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let song: Song = serde_json::from_str(&text).map_err(|e| format!("archivo no válido: {e}"))?;
    if song.version > SONG_FORMAT_VERSION {
        return Err(format!("el proyecto es de una versión más nueva de Tonalia (formato {})", song.version));
    }
    Ok(song)
}

/// Escribe primero a un archivo temporal y luego lo renombra: si algo falla a mitad,
/// el proyecto anterior queda intacto.
pub fn write_song(path: &Path, song: &Song) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(song).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

/// Nombre visible del proyecto: el nombre del archivo sin extensión.
pub fn display_name(path: Option<&Path>) -> Option<String> {
    path.and_then(|p| p.file_stem()).map(|s| s.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guardar_y_abrir() {
        let dir = std::env::temp_dir().join(format!("tonalia-test-{}", std::process::id()));
        let path = dir.join("prueba.tonalia");
        let mut song = Song::default();
        song.bpm = 87.0;
        write_song(&path, &song).unwrap();
        assert_eq!(read_song(&path).unwrap(), song);
        assert_eq!(display_name(Some(&path)).as_deref(), Some("prueba"));
        fs::write(&path, "no es json").unwrap();
        assert!(read_song(&path).is_err());
        let _ = fs::remove_dir_all(dir);
    }
}
