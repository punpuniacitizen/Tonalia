mod audio;
mod commands;
mod project;
mod state;

use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};

use audio::Shared;
use commands::TransportState;
use state::AppState;

/// Mientras suena, publica la posición unas 30 veces por segundo (evento `transport`).
/// La interfaz interpola entre mensajes para mover el cursor a 60 fps.
fn spawn_transport_emitter(app: AppHandle, shared: Arc<Shared>) {
    thread::Builder::new()
        .name("tonalia-transport".into())
        .spawn(move || {
            let mut was_playing = false;
            loop {
                thread::sleep(Duration::from_millis(33));
                let playing = shared.playing();
                if playing || was_playing {
                    let _ = app.emit("transport", TransportState { playing, position: shared.position() });
                }
                was_playing = playing;
            }
        })
        .expect("no se pudo crear el hilo de transporte");
}

const SOUNDFONT: &str = "GeneralUser-GS.sf2";

/// Dónde está el banco de sonidos: junto a la app instalada o en `assets/` al desarrollar.
fn soundfont_path(app: &AppHandle) -> Option<PathBuf> {
    let bundled = app.path().resource_dir().ok().map(|d| d.join("soundfonts").join(SOUNDFONT));
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("assets").join("soundfonts").join(SOUNDFONT);
    bundled.into_iter().chain([dev]).find(|p| p.exists())
}

/// Carga el SoundFont en segundo plano; mientras tanto suena el sintetizador FM.
fn spawn_soundfont_loader(app: AppHandle) {
    thread::Builder::new()
        .name("tonalia-soundfont".into())
        .spawn(move || {
            let Some(path) = soundfont_path(&app) else {
                eprintln!("[audio] no se encontró {SOUNDFONT}; se usa el sintetizador FM");
                return;
            };
            let state = app.state::<AppState>();
            match audio::sf2::Sf2::load(&path, state.audio.sample_rate) {
                Ok(sf) => state.audio.send(audio::AudioMsg::SoundFont(Box::new(sf))),
                Err(e) => eprintln!("[audio] no se pudo cargar el SoundFont: {e}"),
            }
        })
        .expect("no se pudo crear el hilo del SoundFont");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_drag::init())
        .setup(|app| {
            let state = AppState::new(app.path().app_data_dir().ok());
            spawn_transport_emitter(app.handle().clone(), state.audio.shared.clone());
            app.manage(state);
            spawn_soundfont_loader(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_view,
            commands::apply_edit,
            commands::undo,
            commands::redo,
            commands::get_palette,
            commands::detect_chord,
            commands::substitutes,
            commands::describe_chord,
            commands::preview_chord,
            commands::preview_notes,
            commands::preview_sequence,
            commands::stop_preview,
            commands::transport_play,
            commands::transport_stop,
            commands::transport_seek,
            commands::transport_state,
            commands::audio_status,
            commands::sound_engine,
            commands::set_sound_engine,
            commands::project_info,
            commands::new_project,
            commands::open_project,
            commands::save_project,
            commands::export_midi,
            commands::prepare_midi_drag,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar Tonalia");
}
