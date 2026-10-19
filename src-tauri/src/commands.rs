//! Comandos que la interfaz invoca con `invoke("nombre", { argumentos })`.

use serde::Serialize;
use tauri::State;
use tonalia_core::analysis::{DetectedView, SongView, detect_labeled};
use tonalia_core::commands::EditCommand;
use tonalia_core::palette::{ChordSize, Palette, build_palette};
use tonalia_core::pitch::PitchClass;
use tonalia_core::time::{BAR, QUARTER};
use tonalia_core::voicing::default_voicing;
use tonalia_core::{Chord, Key};

use std::path::PathBuf;

use tonalia_core::midi_export::{ExportOptions, export_smf};

use crate::audio::synth::Instrument;
use crate::audio::{AudioMsg, PreviewNote};
use crate::project;
use crate::state::{AppState, new_song};

type CmdResult<T> = Result<T, String>;

/// Duración de la previsualización de un acorde, en segundos.
const PREVIEW_SECONDS: f32 = 1.4;

#[derive(Serialize, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TransportState {
    pub playing: bool,
    pub position: f64,
}

#[tauri::command]
pub fn get_view(state: State<AppState>) -> SongView {
    AppState::view_of(&state.doc())
}

#[tauri::command]
pub fn apply_edit(state: State<AppState>, cmd: EditCommand) -> CmdResult<SongView> {
    let mut doc = state.doc();
    let changed = doc.apply(&cmd).map_err(|e| e.to_string())?;
    if changed {
        state.after_change(doc.song());
    }
    Ok(AppState::view_of(&doc))
}

#[tauri::command]
pub fn undo(state: State<AppState>) -> SongView {
    let mut doc = state.doc();
    if doc.undo() {
        state.after_change(doc.song());
    }
    AppState::view_of(&doc)
}

#[tauri::command]
pub fn redo(state: State<AppState>) -> SongView {
    let mut doc = state.doc();
    if doc.redo() {
        state.after_change(doc.song());
    }
    AppState::view_of(&doc)
}

// ---------- Proyecto ----------

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub path: Option<String>,
    pub name: Option<String>,
    pub dirty: bool,
}

fn project_info_of(state: &AppState) -> ProjectInfo {
    let path = state.project_path.lock().unwrap_or_else(|p| p.into_inner()).clone();
    ProjectInfo {
        name: project::display_name(path.as_deref()),
        path: path.map(|p| p.to_string_lossy().into_owned()),
        dirty: *state.dirty.lock().unwrap_or_else(|p| p.into_inner()),
    }
}

#[tauri::command]
pub fn project_info(state: State<AppState>) -> ProjectInfo {
    project_info_of(&state)
}

#[tauri::command]
pub fn new_project(state: State<AppState>) -> SongView {
    let mut doc = state.doc();
    doc.replace(new_song());
    *state.project_path.lock().unwrap_or_else(|p| p.into_inner()) = None;
    state.sync_audio(doc.song());
    state.write_autosave(doc.song());
    *state.dirty.lock().unwrap_or_else(|p| p.into_inner()) = false;
    AppState::view_of(&doc)
}

#[tauri::command]
pub fn open_project(state: State<AppState>, path: String) -> CmdResult<SongView> {
    let path = PathBuf::from(path);
    let song = project::read_song(&path)?;
    let mut doc = state.doc();
    doc.replace(song);
    *state.project_path.lock().unwrap_or_else(|p| p.into_inner()) = Some(path);
    state.sync_audio(doc.song());
    state.write_autosave(doc.song());
    *state.dirty.lock().unwrap_or_else(|p| p.into_inner()) = false;
    Ok(AppState::view_of(&doc))
}

/// Guarda en `path` o, si no se indica, en el archivo actual.
#[tauri::command]
pub fn save_project(state: State<AppState>, path: Option<String>) -> CmdResult<ProjectInfo> {
    let target = match path {
        Some(p) => {
            let mut p = PathBuf::from(p);
            if p.extension().is_none() {
                p.set_extension(project::EXTENSION);
            }
            p
        }
        None => state.project_path.lock().unwrap_or_else(|p| p.into_inner()).clone().ok_or("el proyecto no tiene archivo todavía")?,
    };
    project::write_song(&target, state.doc().song())?;
    *state.project_path.lock().unwrap_or_else(|p| p.into_inner()) = Some(target);
    *state.dirty.lock().unwrap_or_else(|p| p.into_inner()) = false;
    Ok(project_info_of(&state))
}

/// Exporta a MIDI estándar. `region` = [inicio, fin) en ticks; `tracks` = pistas elegidas.
#[tauri::command]
pub fn export_midi(state: State<AppState>, path: String, include_chords: bool, tracks: Option<Vec<u32>>, region: Option<(i64, i64)>) -> CmdResult<()> {
    let options = ExportOptions { include_chords, tracks, region };
    let bytes = export_smf(state.doc().song(), &options).map_err(|e| e.to_string())?;
    let mut path = PathBuf::from(path);
    if path.extension().is_none() {
        path.set_extension("mid");
    }
    std::fs::write(&path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_palette(key: Key, size: ChordSize, previous: Option<Chord>) -> Palette {
    build_palette(&key, size, previous.as_ref())
}

/// Reconoce el acorde formado por unas notas (el más probable primero).
#[tauri::command]
pub fn detect_chord(pitches: Vec<u8>, key: Key) -> Vec<DetectedView> {
    detect_labeled(&pitches, &key)
}

/// Escucha un acorde con los ajustes de previsualización de la canción.
#[tauri::command]
pub fn preview_chord(state: State<AppState>, chord: Chord, key_root: Option<PitchClass>) {
    let notes = {
        let doc = state.doc();
        let song = doc.song();
        let root = key_root.unwrap_or(song.home_key.root);
        let seconds_per_tick = 60.0 / song.bpm as f32 / QUARTER as f32;
        let instrument = Instrument::from_name(&song.chord_track.instrument);
        default_voicing(&chord, BAR, &song.preview, root)
            .into_iter()
            .map(|n| {
                let delay = n.position as f32 * seconds_per_tick;
                PreviewNote { pitch: n.pitch, velocity: n.velocity, delay, duration: (PREVIEW_SECONDS - delay).max(0.25), instrument }
            })
            .collect()
    };
    state.audio.send(AudioMsg::Preview(notes));
}

/// Escucha notas sueltas (teclado, piano roll).
#[tauri::command]
pub fn preview_notes(state: State<AppState>, pitches: Vec<u8>, velocity: Option<f32>, instrument: Option<String>, duration: Option<f32>) {
    let instrument = Instrument::from_name(instrument.as_deref().unwrap_or("piano"));
    let velocity = velocity.unwrap_or(0.8);
    let duration = duration.unwrap_or(0.6);
    let notes = pitches.into_iter().map(|pitch| PreviewNote { pitch, velocity, delay: 0.0, duration, instrument }).collect();
    state.audio.send(AudioMsg::Preview(notes));
}

/// Una nota de un ejemplo sonoro (escala, cadencia…), con su retraso en segundos.
#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SequenceNote {
    pub pitch: u8,
    pub delay: f32,
    pub duration: f32,
    pub velocity: Option<f32>,
}

/// Toca una secuencia corta de notas (los ejemplos de los tips).
#[tauri::command]
pub fn preview_sequence(state: State<AppState>, notes: Vec<SequenceNote>, instrument: Option<String>) {
    let instrument = Instrument::from_name(instrument.as_deref().unwrap_or("piano"));
    let notes = notes
        .into_iter()
        .map(|n| PreviewNote { pitch: n.pitch, velocity: n.velocity.unwrap_or(0.75), delay: n.delay, duration: n.duration, instrument })
        .collect();
    state.audio.send(AudioMsg::Preview(notes));
}

#[tauri::command]
pub fn stop_preview(state: State<AppState>) {
    state.audio.send(AudioMsg::StopPreview);
}

#[tauri::command]
pub fn transport_play(state: State<AppState>, from: Option<f64>) {
    let from = from.unwrap_or_else(|| state.audio.shared.position());
    state.audio.send(AudioMsg::Play { from });
}

#[tauri::command]
pub fn transport_stop(state: State<AppState>) {
    state.audio.send(AudioMsg::Stop);
}

#[tauri::command]
pub fn transport_seek(state: State<AppState>, position: f64) {
    state.audio.send(AudioMsg::Seek(position));
}

#[tauri::command]
pub fn transport_state(state: State<AppState>) -> TransportState {
    TransportState { playing: state.audio.shared.playing(), position: state.audio.shared.position() }
}

#[derive(Serialize, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SoundEngine {
    /// El banco SoundFont terminó de cargar.
    pub sampled_available: bool,
    /// Se están usando los instrumentos sampleados.
    pub sampled: bool,
}

#[tauri::command]
pub fn sound_engine(state: State<AppState>) -> SoundEngine {
    let s = &state.audio.shared;
    SoundEngine { sampled_available: s.soundfont_loaded(), sampled: s.using_soundfont() }
}

/// Instrumentos sampleados (`true`) o sintetizador FM (`false`).
#[tauri::command]
pub fn set_sound_engine(state: State<AppState>, sampled: bool) {
    state.audio.send(AudioMsg::UseSoundFont(sampled));
}

/// `None` si el audio funciona; si no, el motivo.
#[tauri::command]
pub fn audio_status(state: State<AppState>) -> Option<String> {
    state.audio.error.clone()
}
