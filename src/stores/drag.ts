// Arrastre de acordes (desde la rueda o dentro de la cinta). Usamos eventos de puntero
// propios en lugar del drag & drop de HTML para dibujar un "fantasma" luminoso.

import { create } from "zustand";

import type { Chord } from "../bindings/Chord";
import type { ChordLabel } from "../bindings/ChordLabel";
import type { ChordRef } from "../bindings/ChordRef";

export type DragPayload =
  | { kind: "new"; chord: Chord; label: ChordLabel }
  | { kind: "move"; from: ChordRef; chord: Chord; label: ChordLabel };

export type DropTarget = { section: number; index: number; x: number };

interface DragState {
  payload: DragPayload | null;
  x: number;
  y: number;
  target: DropTarget | null;
  start: (payload: DragPayload, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  setTarget: (target: DropTarget | null) => void;
  end: () => void;
}

export const useDrag = create<DragState>()((set) => ({
  payload: null,
  x: 0,
  y: 0,
  target: null,
  start: (payload, x, y) => set({ payload, x, y, target: null }),
  move: (x, y) => set({ x, y }),
  setTarget: (target) => set({ target }),
  end: () => set({ payload: null, target: null }),
}));

/**
 * Distingue clic de arrastre: si el puntero se mueve más de `threshold` px antes de
 * soltarse, empieza un arrastre; si no, es un clic.
 */
export function pointerGesture(
  down: { clientX: number; clientY: number },
  handlers: { onClick: () => void; onDragStart: (x: number, y: number) => void },
  threshold = 5,
) {
  const sx = down.clientX;
  const sy = down.clientY;
  let dragging = false;
  const move = (e: PointerEvent) => {
    if (!dragging && Math.hypot(e.clientX - sx, e.clientY - sy) > threshold) {
      dragging = true;
      handlers.onDragStart(e.clientX, e.clientY);
    }
    if (dragging) useDrag.getState().move(e.clientX, e.clientY);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (!dragging) {
      handlers.onClick();
      return;
    }
    dropCallbacks.forEach((cb) => cb());
    useDrag.getState().end();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

/** Quien acepta soltar (la cinta) se registra aquí y decide qué hacer al soltar. */
const dropCallbacks = new Set<() => void>();
export function onDrop(cb: () => void): () => void {
  dropCallbacks.add(cb);
  return () => dropCallbacks.delete(cb);
}
