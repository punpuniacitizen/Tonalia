// Puente con Rust: cada función llama a un comando de `src-tauri/src/commands.rs`.
// Los tipos vienen de `src/bindings`, generados desde el núcleo (`npm run bindings`).

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { Chord } from "./bindings/Chord";
import type { ChordSize } from "./bindings/ChordSize";
import type { DetectedView } from "./bindings/DetectedView";
import type { EditCommand } from "./bindings/EditCommand";
import type { Key } from "./bindings/Key";
import type { Palette } from "./bindings/Palette";
import type { PitchClass } from "./bindings/PitchClass";
import type { SongView } from "./bindings/SongView";

export type TransportState = { playing: boolean; position: number };

export const api = {
  getView: () => invoke<SongView>("get_view"),
  edit: (cmd: EditCommand) => invoke<SongView>("apply_edit", { cmd }),
  undo: () => invoke<SongView>("undo"),
  redo: () => invoke<SongView>("redo"),
  palette: (key: Key, size: ChordSize, previous: Chord | null) =>
    invoke<Palette>("get_palette", { key, size, previous }),
  detectChord: (pitches: number[], key: Key) => invoke<DetectedView[]>("detect_chord", { pitches, key }),
  previewChord: (chord: Chord, keyRoot: PitchClass | null) =>
    invoke<void>("preview_chord", { chord, keyRoot }),
  previewNotes: (pitches: number[], velocity?: number, instrument?: string, duration?: number) =>
    invoke<void>("preview_notes", { pitches, velocity, instrument, duration }),
  stopPreview: () => invoke<void>("stop_preview"),
  play: (from?: number) => invoke<void>("transport_play", { from }),
  stop: () => invoke<void>("transport_stop"),
  seek: (position: number) => invoke<void>("transport_seek", { position }),
  transportState: () => invoke<TransportState>("transport_state"),
  audioStatus: () => invoke<string | null>("audio_status"),
};

export function onTransport(handler: (state: TransportState) => void): Promise<UnlistenFn> {
  return listen<TransportState>("transport", (event) => handler(event.payload));
}
