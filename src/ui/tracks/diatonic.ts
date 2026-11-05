// Transponer por grados de la escala: en Do mayor, un Mi sube a Fa (no a Fa♯) y un Si a Do.
// Usa la escala que rige donde está cada nota (las secciones con otra tonalidad, la suya).
// Una nota fuera de la escala cuenta la nota de la escala más cercana como el primer grado.

import type { Note } from "../../bindings/Note";
import type { SongView } from "../../bindings/SongView";
import { keyPitchClasses } from "../../lib/pitch";
import { harmonyRegions, regionAt } from "./harmony";

/** Sube (o baja, con `steps` negativo) `steps` notas de la escala `pcs`. */
export function stepInScale(pitch: number, steps: number, pcs: Set<number>): number {
  const dir = Math.sign(steps);
  let left = Math.abs(steps);
  let p = pitch;
  while (left > 0) {
    p += dir;
    if (p < 0 || p > 127) return pitch;
    if (pcs.has(p % 12)) left--;
  }
  return p;
}

/** Las notas movidas `degrees` grados dentro de la escala que rige en cada una. */
export function transposeByDegrees(view: SongView, notes: Note[], degrees: number): Note[] {
  const end = Math.max(view.length, ...notes.map((n) => n.position + n.length)) + 1;
  const regions = harmonyRegions(view, end);
  const home = keyPitchClasses(view.song.homeKey);
  return notes.map((n) => ({ ...n, pitch: stepInScale(n.pitch, degrees, regionAt(regions, n.position)?.scalePcs ?? home) }));
}
