// Estado de edición de notas: qué pista está abierta como piano roll, la herramienta
// activa, las notas seleccionadas y los acordes elegidos en una pista de acordes.
// No se guarda entre sesiones.

import { create } from "zustand";

import type { ChordRef } from "../bindings/ChordRef";
import type { Note } from "../bindings/Note";

export type PianoTool = "draw" | "select" | "velocity";

/** Una pista de acordes: la principal (la cinta) o una pista de tipo acordes (su id). */
export type ChordLane = "main" | number;

/** Una nota se identifica por su posición y altura (no puede haber dos iguales a la vez). */
export const noteKey = (n: Pick<Note, "position" | "pitch">) => `${n.position}:${n.pitch}`;

/** La última pista con la que se interactuó (para «A» = seleccionar todo). */
export type Focus = { kind: "notes"; track: number } | { kind: "chords"; lane: ChordLane };

/** Un acorde de la cinta, como texto (para guardarlo en un Set). */
export const chordKey = (c: ChordRef) => `${c.section}:${c.index}`;
export const chordRefOf = (key: string): ChordRef => {
  const [section, index] = key.split(":").map(Number);
  return { section, index };
};

interface NotesState {
  expandedTrack: number | null;
  tool: PianoTool;
  selection: Set<string>;
  /** Track al que pertenece la selección. */
  selectionTrack: number | null;
  /** Acordes elegidos en una pista de acordes (para arpegiarlos). */
  chordPick: { lane: ChordLane; keys: Set<string> } | null;
  focus: Focus | null;
  setFocus: (focus: Focus) => void;
  toggleExpanded: (track: number) => void;
  setTool: (tool: PianoTool) => void;
  select: (track: number, keys: Iterable<string>, additive?: boolean) => void;
  clearSelection: () => void;
  /** Elige acordes; con `toggle` suma o quita cada uno de los que ya había. */
  pickChords: (lane: ChordLane, keys: Iterable<string>, toggle?: boolean) => void;
  clearChordPick: () => void;
}

export const useNotes = create<NotesState>()((set, get) => ({
  expandedTrack: null,
  tool: "draw",
  selection: new Set(),
  selectionTrack: null,
  chordPick: null,
  focus: null,
  setFocus: (focus) => set({ focus }),
  toggleExpanded: (track) =>
    set((s) => ({ expandedTrack: s.expandedTrack === track ? null : track, selection: new Set(), selectionTrack: null })),
  setTool: (tool) => set({ tool }),
  select: (track, keys, additive = false) => {
    const base = additive && get().selectionTrack === track ? new Set(get().selection) : new Set<string>();
    for (const k of keys) base.add(k);
    set({ selection: base, selectionTrack: track, focus: { kind: "notes", track } });
  },
  clearSelection: () => set({ selection: new Set(), selectionTrack: null }),
  pickChords: (lane, keys, toggle = false) => {
    const current = get().chordPick;
    const base = toggle && current?.lane === lane ? new Set(current.keys) : new Set<string>();
    for (const k of keys) {
      if (toggle && base.has(k)) base.delete(k);
      else base.add(k);
    }
    set({ chordPick: { lane, keys: base }, focus: { kind: "chords", lane } });
  },
  clearChordPick: () => set({ chordPick: null }),
}));
