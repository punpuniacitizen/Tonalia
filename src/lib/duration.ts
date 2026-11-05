// Duraciones para mostrar: «1 compás», «1/4», «1 + 1/2».

import { TICKS_PER_BAR } from "./music";

const DENOMINATORS = [2, 4, 8, 16, 32, 64, 3, 6, 12, 24];

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Duración en ticks como fracción de compás. `bar`/`bars` son las palabras «compás»/«compases». */
export function formatLength(ticks: number, bar: string, bars: string): string {
  const whole = Math.floor(ticks / TICKS_PER_BAR);
  const rest = ticks - whole * TICKS_PER_BAR;
  if (rest === 0) return `${whole} ${whole === 1 ? bar : bars}`;
  const d = DENOMINATORS.find((den) => (rest * den) % TICKS_PER_BAR === 0);
  if (!d) return `${(ticks / TICKS_PER_BAR).toFixed(2)} ${bars}`;
  const num = (rest * d) / TICKS_PER_BAR;
  const g = gcd(num, d);
  const fraction = `${num / g}/${d / g}`;
  return whole > 0 ? `${whole} + ${fraction}` : fraction;
}

/** Largos para elegir rápido (2 compases, 1, 1/2, 1/4, 1/8). */
export const LENGTH_CHOICES = [2 * TICKS_PER_BAR, TICKS_PER_BAR, TICKS_PER_BAR / 2, TICKS_PER_BAR / 4, TICKS_PER_BAR / 8];
