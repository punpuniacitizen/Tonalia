import type { Grid } from "../../bindings/Grid";
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

const GRID_TICKS: Record<Grid, number> = {
  off: 1,
  bar: 10368,
  half: 5184,
  beat: 2592,
  eighth: 1296,
  sixteenth: 648,
  thirtySecond: 324,
  eighthTriplet: 864,
  sixteenthTriplet: 432,
};

export function gridStep(grid: Grid): number {
  return GRID_TICKS[grid];
}

export function snap(ticks: number, grid: Grid): number {
  const step = gridStep(grid);
  return Math.round(ticks / step) * step;
}
