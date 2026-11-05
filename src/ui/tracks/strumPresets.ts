// Patrones de rasgueo de partida, para no empezar de cero en el editor.
// Código: D = abajo, U = arriba, X = apagado, . = nada. `accents`: pasos acentuados.

import type { Stroke } from "../../bindings/Stroke";
import type { StrumPattern } from "../../bindings/StrumPattern";

export type StrumPreset = { key: string; steps: number; code: string; accents: number[] };

export const STRUM_PRESETS: StrumPreset[] = [
  { key: "pop", steps: 8, code: "D.DU.UDU", accents: [0, 4] },
  { key: "ballad", steps: 8, code: "D...D.DU", accents: [0, 4] },
  { key: "folk", steps: 8, code: "D.DUD.DU", accents: [0, 4] },
  { key: "rock", steps: 8, code: "DDDDDDDD", accents: [0, 2, 4, 6] },
  { key: "reggae", steps: 8, code: "..D...D.", accents: [2, 6] },
  { key: "ska", steps: 8, code: ".U.U.U.U", accents: [] },
  { key: "rumba", steps: 8, code: "D.XUD.XU", accents: [0, 4] },
  { key: "funk", steps: 16, code: "D.XUDUXUD.XUDUXU", accents: [0, 8] },
  { key: "shuffle", steps: 12, code: "D.UD.UD.UD.U", accents: [0, 6] },
];

const CODE: Record<string, Stroke> = { D: "down", U: "up", X: "mute" };

export function strokesFromCode(code: string): Stroke[] {
  return [...code].map((c) => CODE[c] ?? "rest");
}

/** Un patrón nuevo a partir de un patrón de partida (id 0 = todavía sin guardar). */
export function patternFromPreset(preset: StrumPreset, name: string, base?: Partial<StrumPattern>): StrumPattern {
  return {
    id: 0,
    name,
    spread: 50,
    upStrings: 3,
    humanize: 0.3,
    ...base,
    steps: preset.steps,
    strokes: strokesFromCode(preset.code),
    accents: Array.from({ length: preset.steps }, (_, i) => preset.accents.includes(i)),
  };
}

/** Lleva golpes y acentos a otra cantidad de pasos por compás (cada golpe a su lugar más cercano). */
export function resample(p: StrumPattern, steps: number): StrumPattern {
  const strokes: Stroke[] = Array(steps).fill("rest");
  const accents: boolean[] = Array(steps).fill(false);
  p.strokes.forEach((s, i) => {
    const j = Math.round((i * steps) / p.steps);
    if (j < steps && s !== "rest") strokes[j] = s;
    if (j < steps && p.accents[i]) accents[j] = true;
  });
  return { ...p, steps, strokes, accents };
}
