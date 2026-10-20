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

/** De color menor: tiene tercera menor y no mayor (menor, dórico, blues, hirajoshi…). */
export function isMinorLike(scaleName: string): boolean {
  const offsets = scaleOffsets(scaleSteps(scaleName));
  return offsets.includes(3) && !offsets.includes(4);
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

/** Escalas de otras tradiciones con siete notas: funcionan como cualquier tonalidad. */
export const WORLD_SCALES = ["phrygianDominant", "doubleHarmonic", "hungarianMinor", "persian", "neapolitanMinor", "neapolitanMajor"];
/** Cinco, seis u ocho notas: sus acordes se eligen por forma (ver `palette.rs`). */
export const OTHER_SCALES = ["majorPentatonic", "minorPentatonic", "blues", "majorBlues", "wholeTone", "hirajoshi", "diminished"];

/** Grupos del selector de escala. `key.groups.<id>` es su título. */
export const SCALE_GROUPS = [
  { id: "modes", scales: SCALE_CHOICES },
  { id: "world", scales: WORLD_SCALES },
  { id: "other", scales: OTHER_SCALES },
] as const;

/** Pasos de las escalas del mundo (los mismos que `WORLD_SCALES` en `scale.rs`). */
const WORLD_STEPS: Record<string, number[]> = {
  phrygianDominant: [1, 3, 1, 2, 1, 2, 2],
  doubleHarmonic: [1, 3, 1, 2, 1, 3, 1],
  hungarianMinor: [2, 1, 3, 1, 1, 3, 1],
  persian: [1, 3, 1, 1, 2, 3, 1],
  neapolitanMinor: [1, 2, 2, 2, 1, 3, 1],
  neapolitanMajor: [1, 2, 2, 2, 2, 2, 1],
  majorPentatonic: [2, 2, 3, 2, 3],
  minorPentatonic: [3, 2, 2, 3, 2],
  blues: [3, 2, 1, 1, 3, 2],
  majorBlues: [2, 1, 1, 3, 2, 3],
  wholeTone: [2, 2, 2, 2, 2, 2],
  hirajoshi: [2, 1, 4, 1, 4],
  diminished: [1, 2, 1, 2, 1, 2, 1, 2],
};

type Progression = [degree: number, intervals: number[]][];

/** Progresión típica de cada escala del mundo (grado en semitonos e intervalos). */
export const EXAMPLE_PROGRESSIONS: Record<string, Progression> = {
  // I – ♭II – iv – ♭II: el vaivén de la tónica con su ♭II.
  phrygianDominant: [[0, [4, 7]], [1, [4, 7]], [5, [3, 7]], [1, [4, 7]]],
  doubleHarmonic: [[0, [4, 7]], [1, [4, 7]], [5, [3, 7]], [1, [4, 7]]],
  hungarianMinor: [[0, [3, 7]], [8, [4, 7]], [7, [4, 7]], [0, [3, 7]]],
  persian: [[0, [4, 6]], [1, [4, 7]], [5, [3, 7]], [1, [4, 7]]],
  neapolitanMinor: [[0, [3, 7]], [1, [4, 7]], [7, [4, 7]], [0, [3, 7]]],
  neapolitanMajor: [[0, [3, 7]], [5, [4, 7]], [7, [4, 7]], [0, [3, 7]]],
  majorPentatonic: [[0, [4, 7]], [9, [3, 7]], [2, [5, 7]], [7, [5, 7]]],
  minorPentatonic: [[0, [3, 7]], [3, [4, 7]], [5, [5, 7]], [10, [2, 7]]],
  // El blues de siempre: I7 – IV7 – I7 – V7 (mezcla lo mayor y lo menor).
  blues: [[0, [4, 7, 10]], [5, [4, 7, 10]], [0, [4, 7, 10]], [7, [4, 7, 10]]],
  majorBlues: [[0, [4, 7]], [5, [4, 7]], [0, [4, 7]], [7, [4, 7]]],
  wholeTone: [[0, [4, 8]], [2, [4, 8]], [4, [4, 8]], [2, [4, 8]]],
  hirajoshi: [[0, [3, 7]], [8, [4, 7]], [7, [5, 7]], [0, [3, 7]]],
  // Tríadas mayores a distancia de tercera menor: el ciclo de la disminuida.
  diminished: [[0, [4, 7]], [3, [4, 7]], [6, [4, 7]], [9, [4, 7]]],
};

/** Progresión de ejemplo: la de la escala si tiene una; si no, I–V–vi–IV o i–VI–III–VII. */
export function exampleProgression(scaleName: string): Progression {
  return (
    EXAMPLE_PROGRESSIONS[scaleName] ??
    (isMinorLike(scaleName)
      ? [[0, [3, 7]], [8, [4, 7]], [3, [4, 7]], [10, [4, 7]]]
      : [[0, [4, 7]], [7, [4, 7]], [9, [3, 7]], [5, [4, 7]]])
  );
}

/** Distancia de cada grado a la tónica, en semitonos. */
export function scaleOffsets(steps: number[]): number[] {
  let acc = 0;
  return steps.map((s) => {
    const o = acc % 12;
    acc += s;
    return o;
  });
}

/** Tríada de la tónica que cabe en la escala: 3.ª mayor o menor (o sus) y 5.ª justa, aumentada o disminuida. */
export function tonicIntervals(steps: number[]): [number, number] {
  const has = new Set(scaleOffsets(steps));
  const third = has.has(4) ? 4 : has.has(3) ? 3 : has.has(5) ? 5 : 2;
  const fifth = has.has(7) ? 7 : has.has(8) ? 8 : has.has(6) ? 6 : 7;
  return [third, fifth];
}

const MAJOR_STEPS = [2, 2, 1, 2, 2, 2, 1];
const MODES = ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian"];

/** Pasos de las escalas predefinidas (los mismos que en `scale.rs`). */
export function scaleSteps(name: string): number[] {
  if (WORLD_STEPS[name]) return WORLD_STEPS[name];
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
