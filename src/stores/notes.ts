// Estado de edición de notas: qué pista está abierta como piano roll, la herramienta
// activa y las notas seleccionadas. No se guarda entre sesiones.

import { create } from "zustand";

import type { Note } from "../bindings/Note";

export type PianoTool = "draw" | "select" | "velocity";

/** Una nota se identifica por su posición y altura (no puede haber dos iguales a la vez). */
export const noteKey = (n: Pick<Note, "position" | "pitch">) => `${n.position}:${n.pitch}`;

interface NotesState {
  expandedTrack: number | null;
  tool: PianoTool;
  selection: Set<string>;
  /** Track al que pertenece la selección. */
  selectionTrack: number | null;
  toggleExpanded: (track: number) => void;
  setTool: (tool: PianoTool) => void;
  select: (track: number, keys: Iterable<string>, additive?: boolean) => void;
  clearSelection: () => void;
}

export const useNotes = create<NotesState>()((set, get) => ({
  expandedTrack: null,
  tool: "draw",
  selection: new Set(),
  selectionTrack: null,
  toggleExpanded: (track) =>
    set((s) => ({ expandedTrack: s.expandedTrack === track ? null : track, selection: new Set(), selectionTrack: null })),
  setTool: (tool) => set({ tool }),
  select: (track, keys, additive = false) => {
    const base = additive && get().selectionTrack === track ? new Set(get().selection) : new Set<string>();
    for (const k of keys) base.add(k);
    set({ selection: base, selectionTrack: track });
  },
  clearSelection: () => set({ selection: new Set(), selectionTrack: null }),
}));
