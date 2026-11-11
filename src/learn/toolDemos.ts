// Ejemplos «antes → después» de cada herramienta, para las lecciones de Herramientas.
// Cada nota: `t` y `len` en dieciseisavos de compás, `p` altura MIDI. El dibujo y el sonido
// salen de los mismos datos.

import type { SequenceNote } from "../api";

export type DemoNote = {
  t: number;
  len: number;
  p: number;
  /** Intensidad (0–1): el dibujo la muestra como brillo. */
  v?: number;
  /** Fuera de la escala (se pinta en rojo). */
  off?: boolean;
  /** Elegida (borde claro). */
  sel?: boolean;
};

export type ToolDemo = {
  before: DemoNote[];
  after: DemoNote[];
  /** Las notas de «antes» son un bloque de una pista de acordes (caja con el nombre). */
  beforeChord?: string;
  /** Nombre que aparece sobre «después» (por ejemplo, el acorde reconocido). */
  afterLabel?: string;
  /** «Antes» muestra la caja de selección alrededor de todo. */
  selectBox?: boolean;
};

const n = (t: number, len: number, p: number, extra: Partial<DemoNote> = {}): DemoNote => ({ t, len, p, ...extra });
const C = [60, 64, 67];
const block = (chord: number[], t = 0, len = 16, extra: Partial<DemoNote> = {}) => chord.map((p) => n(t, len, p, extra));
const melody = [n(0, 2, 72), n(2, 2, 71), n(4, 4, 67), n(8, 2, 69), n(10, 2, 71), n(12, 4, 72)];

export const TOOL_DEMOS: Record<string, ToolDemo> = {
  toolbox: {
    before: melody,
    after: melody.map((x) => ({ ...x, sel: true })),
    selectBox: true,
  },
  arp: {
    before: block(C),
    after: [60, 64, 67, 72, 67, 64, 60, 64].map((p, i) => n(i * 2, 2, p, { v: i % 4 === 0 ? 0.95 : 0.75 })),
    beforeChord: "C",
  },
  rhythm: {
    before: block(C),
    // Rasgueo pop ↓ · ↓ ↑ · ↑ ↓ ↑ en corcheas: abajo todas las cuerdas, arriba las agudas.
    after: [
      ...block(C, 0, 4, { v: 0.95 }),
      ...block(C, 4, 2),
      ...block([64, 67], 6, 4, { v: 0.6 }),
      ...block([64, 67], 10, 2, { v: 0.6 }),
      ...block(C, 12, 2, { v: 0.9 }),
      ...block([64, 67], 14, 2, { v: 0.6 }),
    ],
    beforeChord: "C",
  },
  transpose: {
    before: [n(0, 4, 60), n(4, 4, 62), n(8, 4, 64), n(12, 4, 65)],
    // Segunda voz una 3ª arriba, dentro de Do mayor: Mi, Fa, Sol, La.
    after: [n(0, 4, 60), n(4, 4, 62), n(8, 4, 64), n(12, 4, 65), n(0, 4, 64, { sel: true }), n(4, 4, 65, { sel: true }), n(8, 4, 67, { sel: true }), n(12, 4, 69, { sel: true })],
  },
  quantize: {
    before: [n(0.7, 2, 67), n(3.4, 2, 69), n(8.6, 2, 71), n(11.3, 4, 72)],
    after: [n(0, 2, 67), n(4, 2, 69), n(8, 2, 71), n(12, 4, 72)],
  },
  humanize: {
    before: [0, 2, 4, 6, 8, 10, 12, 14].map((t, i) => n(t, 2, [60, 64, 67, 64, 60, 64, 67, 72][i], { v: 0.8 })),
    after: [0.15, 1.85, 4.1, 6.2, 7.9, 10.15, 11.9, 14.1].map((t, i) => n(t, 2, [60, 64, 67, 64, 60, 64, 67, 72][i], { v: [0.9, 0.7, 0.82, 0.66, 0.88, 0.72, 0.85, 0.75][i] })),
  },
  articulation: {
    before: [n(0, 1.5, 64), n(4, 1.5, 65), n(8, 1.5, 67), n(12, 4, 72)],
    after: [n(0, 4, 64), n(4, 4, 65), n(8, 4, 67), n(12, 4, 72)],
  },
  repeat: {
    before: [n(0, 2, 67), n(2, 2, 69), n(4, 4, 71)],
    after: [n(0, 2, 67), n(2, 2, 69), n(4, 4, 71), n(8, 2, 67, { sel: true }), n(10, 2, 69, { sel: true }), n(12, 4, 71, { sel: true })],
  },
  snap: {
    before: [n(0, 4, 64), n(4, 4, 66, { off: true }), n(8, 4, 67), n(12, 4, 70, { off: true })],
    // En Do mayor: Fa♯ → Fa (la más cercana, hacia abajo en el empate) y Si♭ → La.
    after: [n(0, 4, 64), n(4, 4, 65), n(8, 4, 67), n(12, 4, 69)],
  },
  bass: {
    before: [...block(C, 0, 8), ...block([65, 69, 72], 8, 8)],
    // Caminante: Do, Mi, Sol, Mi (se acerca a Fa), Fa, La, Do, Si (se acerca a Do).
    after: [...block(C, 0, 8, { v: 0.4 }), ...block([65, 69, 72], 8, 8, { v: 0.4 }), ...[48, 52, 55, 52, 53, 57, 60, 59].map((p, i) => n(i * 2, 2, p, { sel: true }))],
  },
  octave: {
    before: block([60, 64, 67, 72]),
    after: block([48, 52, 55, 60]),
    beforeChord: "C",
    afterLabel: "−1 8va",
  },
  convert: {
    before: [60, 64, 67, 72, 67, 64, 60, 64].map((p, i) => n(i * 2, 2, p)),
    after: [60, 64, 67, 72, 67, 64, 60, 64].map((p, i) => n(i * 2, i === 7 ? 4 : 2, i === 3 ? 74 : p, { sel: i === 3 || i === 7 })),
    beforeChord: "C",
  },
  toChord: {
    before: [n(0, 8, 57, { sel: true }), n(0, 8, 60, { sel: true }), n(0, 8, 64, { sel: true })],
    after: block([57, 60, 64], 0, 8),
    afterLabel: "Am",
  },
};

/** El ejemplo como sonido: primero «antes», luego «después». */
export function demoSound(id: string): SequenceNote[] {
  const demo = TOOL_DEMOS[id];
  const step = 0.14;
  const play = (notes: DemoNote[], start: number) =>
    notes.map((x) => ({ pitch: x.p, delay: start + x.t * step, duration: Math.max(0.1, x.len * step), velocity: x.v ?? 0.8 }));
  return [...play(demo.before, 0), ...play(demo.after, 16 * step + 0.6)];
}
