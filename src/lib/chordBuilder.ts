// Constructor de acordes: un acorde = base (tríada o sus) + séptima/sexta + tensiones.
// Las tensiones se guardan como intervalos compuestos (9 = 14 semitonos, 11 = 17, 13 = 21),
// así el voicing abierto las coloca por encima del acorde y suenan claras.

import type { Chord } from "../bindings/Chord";

export type Base = "major" | "minor" | "dim" | "aug" | "sus2" | "sus4";
export type SeventhKind = "none" | "b7" | "maj7" | "dim7";
export type Ext = "b9" | "9" | "#9" | "11" | "#11" | "b13" | "13";

export type BuilderState = { base: Base; seventh: SeventhKind; sixth: boolean; ext: Ext[] };

export const BASES: Base[] = ["major", "minor", "dim", "aug", "sus2", "sus4"];
export const SEVENTHS: SeventhKind[] = ["none", "b7", "maj7", "dim7"];
export const EXTS: Ext[] = ["b9", "9", "#9", "11", "#11", "b13", "13"];

const BASE_IV: Record<Base, number[]> = {
  major: [4, 7],
  minor: [3, 7],
  dim: [3, 6],
  aug: [4, 8],
  sus2: [2, 7],
  sus4: [5, 7],
};
const SEVENTH_IV: Record<SeventhKind, number | null> = { none: null, b7: 10, maj7: 11, dim7: 9 };
export const EXT_IV: Record<Ext, number> = { b9: 13, "9": 14, "#9": 15, "11": 17, "#11": 18, b13: 20, "13": 21 };

/** Tensiones que no tiene sentido combinar (la misma nota alterada de dos formas). */
const EXCLUSIVE: [Ext, Ext][] = [
  ["11", "#11"],
  ["b13", "13"],
];

export function parseChord(chord: Chord): BuilderState {
  const has = (i: number) => chord.intervals.includes(i);
  const third = has(4) ? "M" : has(3) ? "m" : null;
  let base: Base;
  if (third === "m" && has(6) && !has(7)) base = "dim";
  else if (third === "M" && has(8) && !has(7)) base = "aug";
  else if (third === "M") base = "major";
  else if (third === "m") base = "minor";
  else if (has(5)) base = "sus4";
  else if (has(2)) base = "sus2";
  else base = "major";

  const seventh: SeventhKind = has(10) ? "b7" : has(11) ? "maj7" : base === "dim" && has(9) ? "dim7" : "none";
  const sixth = seventh === "none" && has(9);
  const ext: Ext[] = [];
  if (has(13) || has(1)) ext.push("b9");
  if (has(14) || (has(2) && base !== "sus2")) ext.push("9");
  if (has(15) || (has(3) && third === "M")) ext.push("#9");
  if (has(17) || (has(5) && base !== "sus4")) ext.push("11");
  if (has(18) || (has(6) && has(7))) ext.push("#11");
  if (has(20) || (has(8) && has(7))) ext.push("b13");
  if (has(21) || (has(9) && seventh !== "none" && seventh !== "dim7")) ext.push("13");
  return { base, seventh, sixth, ext };
}

export function buildChord(root: number, s: BuilderState): Chord {
  const ivs = new Set<number>(BASE_IV[s.base]);
  const seventh = SEVENTH_IV[s.seventh];
  if (seventh !== null) ivs.add(seventh);
  if (s.sixth && s.seventh !== "dim7") ivs.add(9);
  for (const e of s.ext) ivs.add(EXT_IV[e]);
  return { root, intervals: [...ivs].sort((a, b) => a - b) };
}

/** Activa o desactiva una tensión respetando las incompatibles. */
export function toggleExt(s: BuilderState, e: Ext): BuilderState {
  if (s.ext.includes(e)) return { ...s, ext: s.ext.filter((x) => x !== e) };
  const rival = EXCLUSIVE.find((pair) => pair.includes(e))?.find((x) => x !== e);
  return { ...s, ext: [...s.ext.filter((x) => x !== rival), e].sort((a, b) => EXTS.indexOf(a) - EXTS.indexOf(b)) };
}

/** Nombre corto de cada opción (con ♭/♯ tipográficos). */
export function extLabel(e: Ext): string {
  return e.replace("b", "♭").replace("#", "♯");
}
