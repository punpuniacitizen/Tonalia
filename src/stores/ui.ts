// Preferencias y estado de la interfaz (no forman parte de la canción).
// Se recuerdan entre sesiones, salvo la selección.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ChordRef } from "../bindings/ChordRef";
import type { ChordSize } from "../bindings/ChordSize";
import type { Grid } from "../bindings/Grid";
import type { Notation } from "../bindings/Notation";

export type Level = "beginner" | "intermediate" | "advanced";
export type SymbolMode = "names" | "roman";
export type Language = "es" | "en";
/** De dónde salen los acordes del anillo medio de la rueda. */
export type WheelSource = { kind: "mode"; scale: string } | { kind: "left" } | { kind: "right" };
/** Panel lateral o ventana abierta (biblioteca, entrenamiento auditivo…). */
export type Panel = "library" | "training" | "help" | null;
/** Qué se ve en el centro del muelle: rueda, mapa de funciones o Tonnetz. */
export type DockView = "wheel" | "map" | "tonnetz";

interface UiState {
  notation: Notation;
  symbols: SymbolMode;
  level: Level;
  language: Language;
  chordSize: ChordSize;
  grid: Grid;
  pxPerBar: number;
  wheelSource: WheelSource;
  panel: Panel;
  dockView: DockView;
  /** Ya se mostró la bienvenida. */
  welcomed: boolean;
  /** Mostrar las tensiones (9, 11, 13) en el mapa T–S–D y el Tonnetz. */
  showTensions: boolean;
  /** Mostrar las líneas de conducción de voces en la cinta. */
  showVoices: boolean;
  selected: ChordRef | null;
  set: (patch: Partial<Omit<UiState, "set" | "select">>) => void;
  select: (ref: ChordRef | null) => void;
}

const safeStorage = createJSONStorage(() => {
  try {
    return window.localStorage;
  } catch {
    // Sin almacenamiento (modo privado, etc.): la app funciona con los valores por defecto.
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }
});

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      notation: "letters",
      symbols: "names",
      level: "beginner",
      language: "es",
      chordSize: "triads",
      grid: "beat",
      pxPerBar: 180,
      wheelSource: { kind: "mode", scale: "aeolian" },
      panel: null,
      dockView: "wheel",
      welcomed: false,
      showTensions: false,
      showVoices: false,
      selected: null,
      set: (patch) => set(patch),
      select: (selected) => set({ selected }),
    }),
    {
      name: "tonalia-ui",
      storage: safeStorage,
      partialize: ({ selected: _selected, panel: _panel, set: _set, select: _select, ...rest }) => rest,
    },
  ),
);

export function sameRef(a: ChordRef | null, b: ChordRef | null): boolean {
  return !!a && !!b && a.section === b.section && a.index === b.index;
}
