mod audio;
mod commands;
mod state;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = AppState::new();
            spawn_transport_emitter(app.handle().clone(), state.audio.shared.clone());
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_view,
            commands::apply_edit,
            commands::undo,
            commands::redo,
            commands::get_palette,
            commands::detect_chord,
            commands::preview_chord,
            commands::preview_notes,
            commands::preview_sequence,
            commands::stop_preview,
            commands::transport_play,
            commands::transport_stop,
            commands::transport_seek,
            commands::transport_state,
            commands::audio_status,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar Tonalia");
}
