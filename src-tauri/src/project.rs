//! Archivos de proyecto (`.tonalia`, JSON legible) y autoguardado.

use std::fs;
use std::path::{Path, PathBuf};

use tonalia_core::Song;
use tonalia_core::model::SONG_FORMAT_VERSION;

pub const EXTENSION: &str = "tonalia";
const AUTOSAVE_FILE: &str = "autosave.tonalia";
const PREFS_FILE: &str = "prefs.json";
/// Cuántos proyectos recientes se recuerdan.
pub const MAX_RECENT: usize = 10;

/// Preferencias del proyecto que viven fuera de la interfaz: recientes y autoguardado.
#[derive(serde::Serialize, serde::Deserialize, Default, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Prefs {
    /// Más reciente primero.
    pub recent: Vec<PathBuf>,
    /// Guardar cada cambio también en el archivo del proyecto.
    pub autosave_file: bool,
    /// Archivo abierto la última vez (para retomarlo al volver).
    pub last_project: Option<PathBuf>,
}

impl Prefs {
    pub fn push_recent(&mut self, path: &Path) {
        self.recent.retain(|p| p != path);
        self.recent.insert(0, path.to_path_buf());
        self.recent.truncate(MAX_RECENT);
    }
}

/// Copias de emergencia: aparte del autoguardado, una foto de la canción cada pocos
/// minutos. Se guardan las últimas `MAX_EMERGENCY`.
const EMERGENCY_DIR: &str = "emergencia";
const EMERGENCY_PREFIX: &str = "emergencia-";
pub const MAX_EMERGENCY: usize = 5;

pub fn emergency_dir(app_data: &Path) -> PathBuf {
    app_data.join(EMERGENCY_DIR)
}

/// Copias de emergencia en `dir` con su hora (segundos Unix), la más nueva primero.
pub fn emergency_copies(dir: &Path) -> Vec<(PathBuf, u64)> {
    let mut copies: Vec<(PathBuf, u64)> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| e.path())
        .filter_map(|p| {
            let stamp = p.file_stem()?.to_str()?.strip_prefix(EMERGENCY_PREFIX)?.parse().ok()?;
            (p.extension()? == EXTENSION).then_some((p, stamp))
        })
        .collect();
    copies.sort_by(|a, b| b.1.cmp(&a.1));
    copies
}

/// Escribe una copia nueva y borra las que sobran por encima de `MAX_EMERGENCY`.
pub fn write_emergency(dir: &Path, song: &Song, stamp: u64) -> Result<PathBuf, String> {
    let path = dir.join(format!("{EMERGENCY_PREFIX}{stamp}.{EXTENSION}"));
    write_song(&path, song)?;
    for (old, _) in emergency_copies(dir).into_iter().skip(MAX_EMERGENCY) {
        let _ = fs::remove_file(old);
    }
    Ok(path)
}

pub fn prefs_path(app_data: &Path) -> PathBuf {
    app_data.join(PREFS_FILE)
}

pub fn read_prefs(path: &Path) -> Prefs {
    fs::read_to_string(path).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

pub fn write_prefs(path: &Path, prefs: &Prefs) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(prefs).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

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

    #[test]
    fn emergencia_guarda_las_ultimas_cinco() {
        let dir = std::env::temp_dir().join(format!("tonalia-emergencia-{}", std::process::id()));
        let song = Song::default();
        for stamp in 100..108 {
            write_emergency(&dir, &song, stamp).unwrap();
        }
        let copies = emergency_copies(&dir);
        assert_eq!(copies.len(), MAX_EMERGENCY);
        assert_eq!(copies[0].1, 107);
        assert_eq!(copies[MAX_EMERGENCY - 1].1, 103);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn recientes_sin_repetir_y_con_tope() {
        let mut prefs = Prefs::default();
        for i in 0..MAX_RECENT + 3 {
            prefs.push_recent(Path::new(&format!("{i}.tonalia")));
        }
        prefs.push_recent(Path::new("5.tonalia"));
        assert_eq!(prefs.recent.len(), MAX_RECENT);
        assert_eq!(prefs.recent[0], PathBuf::from("5.tonalia"));
        assert_eq!(prefs.recent.iter().filter(|p| **p == PathBuf::from("5.tonalia")).count(), 1);
    }
}
