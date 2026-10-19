import { TICKS_PER_BAR } from "../../lib/music";

/** Margen izquierdo del contenido de la línea de tiempo (deja sitio a la tira de teclado). */
export const PAD = 56;

export function pxPerTick(pxPerBar: number): number {
  return pxPerBar / TICKS_PER_BAR;
}

export function tickToX(ticks: number, pxPerBar: number): number {
  return PAD + ticks * pxPerTick(pxPerBar);
}

export function xToTick(x: number, pxPerBar: number): number {
  return (x - PAD) / pxPerTick(pxPerBar);
}

/** Ticks de cada división de la cuadrícula: el compás partido en `divisions` (0 = libre). */
export function gridStep(divisions: number): number {
  return divisions > 0 ? TICKS_PER_BAR / divisions : 1;
}

export function snap(ticks: number, divisions: number): number {
  const step = gridStep(divisions);
  return Math.round(ticks / step) * step;
}
