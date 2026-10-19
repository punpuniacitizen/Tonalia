// Utilidades musicales de presentación. La teoría vive en Rust; aquí solo se da formato.

import type { ChordLabel } from "../bindings/ChordLabel";
import type { Function as TonalFunction } from "../bindings/Function";
import type { Key } from "../bindings/Key";
import type { Notation } from "../bindings/Notation";
import type { SpelledNote } from "../bindings/SpelledNote";

export const TICKS_PER_WHOLE = 10368;
export const TICKS_PER_BEAT = TICKS_PER_WHOLE / 4;
export const TICKS_PER_BAR = TICKS_PER_WHOLE;

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const SOLFEGE = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"];

/** Nombre de nota con símbolos tipográficos: Si♭, F♯. */
export function spelledName(note: SpelledNote, notation: Notation): string {
  const base = (notation === "solfege" ? SOLFEGE : LETTERS)[note.letter];
  const acc = note.accidental > 0 ? "♯".repeat(note.accidental) : "♭".repeat(-note.accidental);
  return base + acc;
}

/** Sufijo de acorde con ♭/♯ en las alteraciones numéricas: "7b9" → "7♭9", "7#11" → "7♯11". */
export function prettySuffix(suffix: string): string {
  return suffix.replace(/b(?=\d)/g, "♭").replace(/#/g, "♯");
}

/** Número romano con ♭/♯ iniciales: "bVII7" → "♭VII7". */
export function prettyRoman(roman: string): string {
  const lead = roman.match(/^[b#]+/)?.[0] ?? "";
  const rest = roman.slice(lead.length);
  return lead.replace(/b/g, "♭").replace(/#/g, "♯") + prettySuffix(rest);
}

export function chordSymbol(label: ChordLabel, notation: Notation): string {
  return spelledName(label.root, notation) + prettySuffix(label.suffix);
}

export function romanSymbol(label: ChordLabel): string {
  return prettyRoman(label.roman);
}

// Nombres habituales de las tónicas (como se escriben las armaduras más comunes).
const MAJOR_KEY_ROOTS: SpelledNote[] = [
  { letter: 0, accidental: 0 }, // C
  { letter: 1, accidental: -1 }, // Db
  { letter: 1, accidental: 0 }, // D
  { letter: 2, accidental: -1 }, // Eb
  { letter: 2, accidental: 0 }, // E
  { letter: 3, accidental: 0 }, // F
  { letter: 3, accidental: 1 }, // F#
  { letter: 4, accidental: 0 }, // G
  { letter: 5, accidental: -1 }, // Ab
  { letter: 5, accidental: 0 }, // A
  { letter: 6, accidental: -1 }, // Bb
  { letter: 6, accidental: 0 }, // B
];
const MINOR_KEY_ROOTS: SpelledNote[] = MAJOR_KEY_ROOTS.map((n, pc) =>
  pc === 1 ? { letter: 0, accidental: 1 } : pc === 8 ? { letter: 4, accidental: 1 } : n,
); // C# y G# en lugar de Db y Ab

const MINOR_LIKE = new Set(["minor", "aeolian", "dorian", "phrygian", "locrian", "harmonicMinor", "melodicMinor"]);

export function isMinorLike(scaleName: string): boolean {
  return MINOR_LIKE.has(scaleName);
}

export function keyRootName(root: number, scaleName: string, notation: Notation): string {
  const table = isMinorLike(scaleName) ? MINOR_KEY_ROOTS : MAJOR_KEY_ROOTS;
  return spelledName(table[root % 12], notation);
}

export function keyName(key: Key, notation: Notation, scaleLabel: (name: string) => string): string {
  return `${keyRootName(key.root, key.scale.name, notation)} ${scaleLabel(key.scale.name)}`;
}

/** Posición en el círculo de quintas: Do = 0 arriba, Sol = 1, Re = 2… Fa = 11. */
export function fifthsIndex(pc: number): number {
  return (pc * 7) % 12;
}

export function fifthsAngle(pc: number): number {
  return fifthsIndex(pc) * 30;
}

export function functionColor(fn: TonalFunction): string {
  return `var(--fn-${fn})`;
}

export const SCALE_CHOICES = [
  "major",
  "minor",
  "dorian",
  "phrygian",
  "lydian",
  "mixolydian",
  "locrian",
  "harmonicMinor",
  "melodicMinor",
];

const MAJOR_STEPS = [2, 2, 1, 2, 2, 2, 1];
const MODES = ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian"];

/** Pasos de las escalas predefinidas (los mismos que en `scale.rs`). */
export function scaleSteps(name: string): number[] {
  switch (name) {
    case "major":
      return MAJOR_STEPS;
    case "minor":
      return [2, 1, 2, 2, 1, 2, 2];
    case "harmonicMinor":
      return [2, 1, 2, 2, 1, 3, 1];
    case "melodicMinor":
      return [2, 1, 2, 2, 2, 2, 1];
    case "chromatic":
      return Array(12).fill(1);
    default: {
      const i = Math.max(0, MODES.indexOf(name));
      return MAJOR_STEPS.map((_, k) => MAJOR_STEPS[(i + k) % 7]);
    }
  }
}

/** Compases y tiempos para la regla: "3.2" = compás 3, tiempo 2. */
export function barBeat(ticks: number): string {
  const bar = Math.floor(ticks / TICKS_PER_BAR) + 1;
  const beat = Math.floor((ticks % TICKS_PER_BAR) / TICKS_PER_BEAT) + 1;
  return `${bar}.${beat}`;
}
