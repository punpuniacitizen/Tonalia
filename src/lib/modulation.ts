// Modulación: qué tan lejos están dos tonalidades, qué acordes comparten (pivotes) y caminos
// típicos para pasar de una a otra. Lógica pura, sin interfaz.

import type { Chord } from "../bindings/Chord";
import type { Key } from "../bindings/Key";
import { tonicIntervals } from "./music";

export type Triad = { chord: Chord; degree: number };
export type Distance = "same" | "relative" | "parallel" | "neighbor" | "close" | "far";
export type Pivot = { chord: Chord; degreeFrom: number; degreeTo: number };
export type BridgePlan = { kind: "pivot" | "dominant" | "direct"; chords: Chord[]; pivot?: Pivot };

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

/** Las notas de la tonalidad, desde la tónica (7 en las tonalidades de siempre). */
export function scalePcs(key: Key): number[] {
  const out = [mod12(key.root)];
  for (const step of key.scale.steps.slice(0, -1)) out.push(mod12(out[out.length - 1] + step));
  return out;
}

/**
 * Tríada sobre cada grado, solo con notas de la escala. En escalas que no tienen siete notas
 * (pentatónicas, blues…) apilar terceras no tiene sentido: solo cuenta la tríada de la tónica.
 */
export function diatonicTriads(key: Key): Triad[] {
  const pcs = scalePcs(key);
  if (pcs.length !== 7) return [{ degree: 0, chord: { root: pcs[0], intervals: tonicIntervals(key.scale.steps) } }];
  return pcs.map((root, degree) => ({
    degree,
    chord: { root, intervals: [mod12(pcs[(degree + 2) % 7] - root), mod12(pcs[(degree + 4) % 7] - root)] },
  }));
}

/** Grado en números romanos: mayúscula si es mayor, minúscula si es menor, ° disminuido, + aumentado. */
export function romanOf(t: { chord: Chord; degree: number }): string {
  const [third, fifth] = t.chord.intervals;
  const numeral = ROMAN[t.degree];
  if (third === 4) return fifth === 8 ? `${numeral}+` : numeral;
  return fifth === 6 ? `${numeral.toLowerCase()}°` : numeral.toLowerCase();
}

export const sameKey = (a: Key, b: Key) => mod12(a.root) === mod12(b.root) && JSON.stringify(a.scale.steps) === JSON.stringify(b.scale.steps);

/** Distancia entre tonalidades según cuántas notas comparten (y si comparten tónica). */
export function keyDistance(a: Key, b: Key): { kind: Distance; shared: number } {
  const pa = new Set(scalePcs(a));
  const pb = scalePcs(b);
  const shared = pb.filter((p) => pa.has(p)).length;
  if (sameKey(a, b)) return { kind: "same", shared };
  if (mod12(a.root) === mod12(b.root)) return { kind: "parallel", shared };
  // Mismas notas, otra tónica (Do mayor ↔ La menor, o sus pentatónicas).
  if (shared === pa.size && shared === pb.length) return { kind: "relative", shared };
  if (shared === 6 && pa.size === 7 && pb.length === 7) return { kind: "neighbor", shared };
  if (shared >= 4) return { kind: "close", shared };
  return { kind: "far", shared };
}

export const tonicOf = (key: Key): Chord => diatonicTriads(key)[0].chord;
/** Dominante con séptima de la tonalidad (también en menor, como en la menor armónica). */
export const dominant7Of = (key: Key): Chord => ({ root: mod12(key.root + 7), intervals: [4, 7, 10] });

const sameChord = (a: Chord, b: Chord) => mod12(a.root) === mod12(b.root) && JSON.stringify(a.intervals) === JSON.stringify(b.intervals);

/**
 * Acordes de las dos tonalidades. Primero los que en la nueva son subdominante (ii, luego IV),
 * que preparan mejor su dominante; después vi, iii y el resto. La tónica de partida va al final
 * (no se «sale» de casa con ella) y se descartan la tónica y la dominante de la nueva: ya forman
 * parte del camino.
 */
export function pivots(from: Key, to: Key): Pivot[] {
  const target = diatonicTriads(to);
  const rank = (p: Pivot) => [9, 0, 3, 1, 9, 2, 4][p.degreeTo] + (p.degreeFrom === 0 ? 10 : 0);
  return diatonicTriads(from)
    .flatMap((f) => {
      const t = target.find((x) => sameChord(x.chord, f.chord));
      return t && t.degree !== 0 && t.degree !== 4 ? [{ chord: f.chord, degreeFrom: f.degree, degreeTo: t.degree }] : [];
    })
    .sort((a, b) => rank(a) - rank(b));
}

/** Tres caminos: pivote → V7, dominante sola y cambio directo (sin preparación). */
export function bridgePlans(from: Key, to: Key): BridgePlan[] {
  const v7 = dominant7Of(to);
  const best = pivots(from, to)[0];
  const plans: BridgePlan[] = [];
  if (best) plans.push({ kind: "pivot", chords: [best.chord, v7], pivot: best });
  plans.push({ kind: "dominant", chords: [v7] });
  plans.push({ kind: "direct", chords: [] });
  return plans;
}

/** Alturas para escuchar un acorde: bajo en la 2.ª octava y el acorde cerrado encima. */
export function previewPitches(chord: Chord): number[] {
  const base = 48 + mod12(chord.root);
  return [base - 12, base, ...chord.intervals.map((i) => base + i)];
}

/** ¿El acorde contiene la tríada pivote (misma fundamental, su 3.ª y su 5.ª)? */
export function matchesPivot(chord: Chord, pivot: Chord): boolean {
  return mod12(chord.root) === mod12(pivot.root) && pivot.intervals.every((i) => chord.intervals.includes(i));
}
