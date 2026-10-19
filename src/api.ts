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
export type SequenceNote = { pitch: number; delay: number; duration: number; velocity?: number };

/** Acordes uno tras otro (cada uno es una lista de alturas MIDI). */
export function chordsSequence(chords: number[][], seconds = 0.9): SequenceNote[] {
  return chords.flatMap((pitches, i) => pitches.map((pitch) => ({ pitch, delay: i * seconds, duration: seconds * 0.95 })));
}

/** Notas una tras otra (melodía o escala). */
export function melodySequence(pitches: number[], seconds = 0.28): SequenceNote[] {
  return pitches.map((pitch, i) => ({ pitch, delay: i * seconds, duration: seconds * 1.4 }));
}

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
  previewSequence: (notes: SequenceNote[], instrument?: string) => invoke<void>("preview_sequence", { notes, instrument }),
  stopPreview: () => invoke<void>("stop_preview"),
  play: (from?: number) => invoke<void>("transport_play", { from }),
  stop: () => invoke<void>("transport_stop"),
  seek: (position: number) => invoke<void>("transport_seek", { position }),
  transportState: () => invoke<TransportState>("transport_state"),
  audioStatus: () => invoke<string | null>("audio_status"),
  soundEngine: () => invoke<{ sampledAvailable: boolean; sampled: boolean }>("sound_engine"),
  setSoundEngine: (sampled: boolean) => invoke<void>("set_sound_engine", { sampled }),
};

export function onTransport(handler: (state: TransportState) => void): Promise<UnlistenFn> {
  return listen<TransportState>("transport", (event) => handler(event.payload));
}
