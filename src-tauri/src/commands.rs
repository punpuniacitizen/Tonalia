//! Comandos que la interfaz invoca con `invoke("nombre", { argumentos })`.

use serde::Serialize;
use tauri::State;
use tonalia_core::analysis::SongView;
use tonalia_core::commands::EditCommand;
use tonalia_core::detect::{DetectedChord, detect};
use tonalia_core::palette::{ChordSize, Palette, build_palette};
use tonalia_core::pitch::PitchClass;
use tonalia_core::time::{BAR, QUARTER};
use tonalia_core::voicing::default_voicing;
use tonalia_core::{Chord, Key};

use crate::audio::synth::Instrument;
use crate::audio::{AudioMsg, PreviewNote};
use crate::state::AppState;

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
        state.sync_audio(doc.song());
    }
    Ok(AppState::view_of(&doc))
}

#[tauri::command]
pub fn undo(state: State<AppState>) -> SongView {
    let mut doc = state.doc();
    if doc.undo() {
        state.sync_audio(doc.song());
    }
    AppState::view_of(&doc)
}

#[tauri::command]
pub fn redo(state: State<AppState>) -> SongView {
    let mut doc = state.doc();
    if doc.redo() {
        state.sync_audio(doc.song());
    }
    AppState::view_of(&doc)
}

#[tauri::command]
pub fn get_palette(key: Key, size: ChordSize, previous: Option<Chord>) -> Palette {
    build_palette(&key, size, previous.as_ref())
}

#[tauri::command]
pub fn detect_chord(pitches: Vec<u8>) -> Vec<DetectedChord> {
    detect(&pitches)
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

/// `None` si el audio funciona; si no, el motivo.
#[tauri::command]
pub fn audio_status(state: State<AppState>) -> Option<String> {
    state.audio.error.clone()
}
