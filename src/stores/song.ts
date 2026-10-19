// Espejo de la canción que vive en Rust. Nunca se modifica aquí: se envían comandos
// y Rust devuelve la vista nueva (canción + análisis).

import { create } from "zustand";

import { api } from "../api";
import type { ChordView } from "../bindings/ChordView";
import type { EditCommand } from "../bindings/EditCommand";
import type { SongView } from "../bindings/SongView";
import { sameRef, useUi } from "./ui";

interface SongState {
  view: SongView | null;
  error: string | null;
  load: () => Promise<void>;
  edit: (cmd: EditCommand) => Promise<SongView | null>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clearError: () => void;
}

/** Si el acorde seleccionado ya no existe tras un cambio, se quita la selección. */
function keepSelectionValid(view: SongView) {
  const { selected, select } = useUi.getState();
  if (selected && !view.chords.some((c) => sameRef(c, selected))) select(null);
}

export const useSong = create<SongState>()((set) => ({
  view: null,
  error: null,
  load: async () => {
    const view = await api.getView();
    set({ view });
  },
  edit: async (cmd) => {
    try {
      const view = await api.edit(cmd);
      set({ view, error: null });
      keepSelectionValid(view);
      return view;
    } catch (e) {
      set({ error: String(e) });
      return null;
    }
  },
  undo: async () => {
    const view = await api.undo();
    set({ view });
    keepSelectionValid(view);
  },
  redo: async () => {
    const view = await api.redo();
    set({ view });
    keepSelectionValid(view);
  },
  clearError: () => set({ error: null }),
}));

/** El acorde seleccionado, o `null`. */
export function useSelectedChord(): ChordView | null {
  const view = useSong((s) => s.view);
  const selected = useUi((s) => s.selected);
  return view?.chords.find((c) => sameRef(c, selected)) ?? null;
}

/** Sección hoja donde se añaden acordes nuevos: la del acorde seleccionado o la última. */
export function insertionPoint(view: SongView, selected: ChordView | null): { section: number; index: number } {
  if (selected) return { section: selected.section, index: selected.index + 1 };
  const leaves = view.sections.filter((s) => s.isLeaf);
  const last = leaves[leaves.length - 1];
  const count = view.chords.filter((c) => c.section === last.id).length;
  return { section: last.id, index: count };
}
