// Preferencias y estado de la interfaz (no forman parte de la canción).
// Se recuerdan entre sesiones, salvo la selección.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Arpeggio } from "../bindings/Arpeggio";
import type { Chord } from "../bindings/Chord";
import type { ChordRef } from "../bindings/ChordRef";
import type { ChordSize } from "../bindings/ChordSize";
import type { Notation } from "../bindings/Notation";
import type { Rhythm } from "../bindings/Rhythm";
import type { TourKind } from "../learn/tours";

export type Level = "beginner" | "intermediate" | "advanced";
export type SymbolMode = "names" | "roman";
export type Language = "es" | "en";
/** De dónde salen los acordes del anillo medio de la rueda. */
export type WheelSource = { kind: "mode"; scale: string } | { kind: "left" } | { kind: "right" };
/** Panel lateral o ventana abierta (biblioteca, entrenamiento auditivo, aprender…). */
export type Panel = "library" | "training" | "help" | "welcome" | "learn" | null;
/** Pestaña de la ventana de herramientas del acorde. */
export type ChordToolsTab = "extensions" | "voices" | "rhythm";
/** Ventana de herramientas del acorde seleccionado; `anchor` = junto a qué bloque abrirla. */
export type ChordTools = { tab: ChordToolsTab; anchor: { left: number; right: number; top: number } | null };
/** Cómo se ve una pista de acordes: bloques con el nombre o piano roll con sus notas. */
export type ChordLaneView = "blocks" | "piano";
/** Qué se ve en el centro del muelle: rueda, mapa de funciones o Tonnetz. */
export type DockView = "wheel" | "map" | "tonnetz";

interface UiState {
  notation: Notation;
  symbols: SymbolMode;
  level: Level;
  language: Language;
  chordSize: ChordSize;
  /** Cuadrícula: en cuántas partes se divide cada compás (0 = libre). */
  gridDivisions: number;
  pxPerBar: number;
  wheelSource: WheelSource;
  /** Último modo elegido: al dejar una tonalidad vecina se vuelve a él. */
  lastModeScale: string;
  panel: Panel;
  dockView: DockView;
  /** Ya se mostró la bienvenida. */
  welcomed: boolean;
  /** Ya se ofreció elegir tutorial (básico o «sé lo que hago»). */
  onboarded: boolean;
  /** Recorrido guiado en curso y paso actual (no se recuerdan entre sesiones). */
  tour: TourKind | null;
  tourStep: number;
  /** Alto del muelle elegido con el divisor (null = automático). */
  dockHeight: number | null;
  /** Modo «enfocar armonía»: oculta las pistas y agranda la rueda (no se recuerda). */
  harmonyFocus: boolean;
  /** Muelle (rueda, leyenda, modos) oculto: todo el alto para la línea de tiempo. */
  dockHidden: boolean;
  /** Ventana de extensiones / voces del acorde seleccionado (no se recuerda). */
  chordTools: ChordTools | null;
  /** Acordes pivote de la modulación que se está mirando: la rueda los resalta. */
  pivotChords: Chord[] | null;
  /** Lección abierta en Aprender y lecciones ya vistas. */
  lesson: string | null;
  learned: string[];
  /** Mostrar las tensiones (9, 11, 13) en el mapa T–S–D y el Tonnetz. */
  showTensions: boolean;
  /** Mostrar las líneas de conducción de voces en la cinta. */
  showVoices: boolean;
  /** Largo de los acordes nuevos (ticks): el último que se eligió. */
  newChordLength: number;
  /** Largo de las notas nuevas en el piano roll (ticks; 0 = un paso de la cuadrícula). */
  noteLength: number;
  /** Alto de cada fila del piano roll (zoom vertical), en píxeles. */
  pianoRowHeight: number;
  /** Último arpegio usado: se propone al arpegiar otro acorde. */
  lastArp: Arpeggio;
  /** Último patrón de ritmo usado. */
  lastRhythm: Rhythm;
  /** Vista de cada pista de acordes ("main" = la principal; si falta, bloques). */
  chordViews: Record<string, ChordLaneView>;
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
      gridDivisions: 4,
      pxPerBar: 180,
      wheelSource: { kind: "mode", scale: "aeolian" },
      lastModeScale: "aeolian",
      panel: null,
      dockView: "wheel",
      welcomed: false,
      onboarded: false,
      tour: null,
      tourStep: 0,
      lesson: null,
      learned: [],
      dockHeight: null,
      harmonyFocus: false,
      dockHidden: false,
      chordTools: null,
      pivotChords: null,
      showTensions: false,
      showVoices: false,
      newChordLength: 10368,
      noteLength: 0,
      pianoRowHeight: 12,
      lastArp: { pattern: "up", step: 1296, octaves: 1, hold: false, keepBass: false },
      chordViews: {},
      lastRhythm: { pattern: "pulse", step: 2592, short: false, strum: null },
      selected: null,
      set: (patch) => set(patch),
      select: (selected) => set({ selected }),
    }),
    {
      name: "tonalia-ui",
      storage: safeStorage,
      partialize: ({ selected: _selected, panel: _panel, tour: _tour, tourStep: _tourStep, harmonyFocus: _harmonyFocus, chordTools: _chordTools, pivotChords: _pivotChords, set: _set, select: _select, ...rest }) => rest,
    },
  ),
);

export function sameRef(a: ChordRef | null, b: ChordRef | null): boolean {
  return !!a && !!b && a.section === b.section && a.index === b.index;
}

/** Marca una lección como vista (para el progreso de Aprender). */
export function markLearned(id: string) {
  const { learned, set } = useUi.getState();
  if (!learned.includes(id)) set({ learned: [...learned, id] });
}
