// Alturas MIDI para el piano roll: nombres, teclas negras y notas de una escala.

import type { Key } from "../bindings/Key";
import type { Notation } from "../bindings/Notation";

const LETTER_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const SOLFEGE_NAMES = ["Do", "Do♯", "Re", "Mi♭", "Mi", "Fa", "Fa♯", "Sol", "La♭", "La", "Si♭", "Si"];
const BLACK = new Set([1, 3, 6, 8, 10]);

export const isBlack = (pitch: number) => BLACK.has(((pitch % 12) + 12) % 12);
export const octaveOf = (pitch: number) => Math.floor(pitch / 12) - 1;

/** "C4", "Fa♯3"… (Do central = C4 = 60). */
export function pitchName(pitch: number, notation: Notation, withOctave = true): string {
  const name = (notation === "solfege" ? SOLFEGE_NAMES : LETTER_NAMES)[pitch % 12];
  return withOctave ? `${name}${octaveOf(pitch)}` : name;
}

/** Clases de altura de una tonalidad (sumando sus pasos desde la tónica). */
export function keyPitchClasses(key: Key): Set<number> {
  const out = new Set<number>();
  let acc = 0;
  for (const step of key.scale.steps) {
    out.add((key.root + acc) % 12);
    acc += step;
  }
  return out;
}

export type HarmonicRole = "root" | "chord" | "scale" | "outside";

export function harmonicRole(pitch: number, chordPcs: Set<number> | null, root: number | null, scalePcs: Set<number>): HarmonicRole {
  const pc = pitch % 12;
  if (chordPcs?.has(pc)) return pc === root ? "root" : "chord";
  return scalePcs.has(pc) ? "scale" : "outside";
}
