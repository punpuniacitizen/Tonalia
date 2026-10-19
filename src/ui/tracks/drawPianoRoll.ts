// Dibujo del piano roll en un canvas 2D.
//
// Capas, de atrás hacia delante:
//   1. filas coloreadas por su papel armónico en cada tramo (acorde / escala / fuera)
//   2. líneas de tiempo y de octava
//   3. el voicing del acorde como sombra
//   4. las notas de la pista (con un borde que indica su papel armónico)
//   5. el rectángulo del lazo

import type { Function as TonalFunction } from "../../bindings/Function";
import type { Notation } from "../../bindings/Notation";
import type { Note } from "../../bindings/Note";
import { TICKS_PER_BAR, TICKS_PER_BEAT } from "../../lib/music";
import { harmonicRole, isBlack, pitchName } from "../../lib/pitch";
import { noteKey } from "../../stores/notes";
import { tickToX, xToTick } from "../timeline/geometry";
import { regionAt, type Region } from "./harmony";

export const ROW_HEIGHT = 12;

type Palette = Record<TonalFunction, string> & { danger: string; accent: string; text: string };

let cachedPalette: Palette | null = null;
function palette(): Palette {
  if (cachedPalette) return cachedPalette;
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  cachedPalette = {
    tonic: v("--fn-tonic"),
    subdominant: v("--fn-subdominant"),
    dominant: v("--fn-dominant"),
    danger: v("--danger"),
    accent: v("--accent"),
    text: v("--text-0"),
  };
  return cachedPalette;
}

let hatch: CanvasPattern | null = null;
function hatchPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (hatch) return hatch;
  const c = document.createElement("canvas");
  c.width = c.height = 8;
  const g = c.getContext("2d");
  if (!g) return null;
  g.strokeStyle = "rgba(255,255,255,0.05)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, 8);
  g.lineTo(8, 0);
  g.stroke();
  hatch = ctx.createPattern(c, "repeat");
  return hatch;
}

/** Color con opacidad a partir de un color CSS hex (#rrggbb). */
function alpha(hex: string, a: number): string {
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.replace(/./g, "$&$&") : m, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export type DrawState = {
  width: number;
  height: number;
  topPitch: number;
  pxPerBar: number;
  regions: Region[];
  notes: Note[];
  selection: Set<string>;
  trackColor: string;
  notation: Notation;
  showLabels: boolean;
  lasso: { x0: number; y0: number; x1: number; y1: number } | null;
  hoverPitch: number | null;
};

export function pitchToY(pitch: number, topPitch: number): number {
  return (topPitch - pitch) * ROW_HEIGHT;
}

export function yToPitch(y: number, topPitch: number): number {
  return topPitch - Math.floor(y / ROW_HEIGHT);
}

export function drawPianoRoll(ctx: CanvasRenderingContext2D, s: DrawState) {
  const p = palette();
  const rows = Math.ceil(s.height / ROW_HEIGHT) + 1;
  ctx.clearRect(0, 0, s.width, s.height);

  // 1. Filas por papel armónico, tramo a tramo.
  for (const r of s.regions) {
    const x0 = tickToX(r.start, s.pxPerBar);
    const x1 = tickToX(r.end, s.pxPerBar);
    const fnColor = r.fn ? p[r.fn] : p.accent;
    for (let i = 0; i < rows; i++) {
      const pitch = s.topPitch - i;
      const y = i * ROW_HEIGHT;
      const role = harmonicRole(pitch, r.chordPcs, r.root, r.scalePcs);
      if (role === "root") ctx.fillStyle = alpha(fnColor, 0.26);
      else if (role === "chord") ctx.fillStyle = alpha(fnColor, 0.15);
      else if (role === "scale") ctx.fillStyle = "rgba(255,255,255,0.035)";
      else ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(x0, y, x1 - x0, ROW_HEIGHT);
      if (role === "outside") {
        const pat = hatchPattern(ctx);
        if (pat) {
          ctx.fillStyle = pat;
          ctx.fillRect(x0, y, x1 - x0, ROW_HEIGHT);
        }
      }
    }
  }

  // Fila bajo el ratón.
  if (s.hoverPitch !== null) {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(0, pitchToY(s.hoverPitch, s.topPitch), s.width, ROW_HEIGHT);
  }

  // 2. Separadores de fila (más marcados en cada Do) y líneas de tiempo.
  for (let i = 0; i <= rows; i++) {
    const pitch = s.topPitch - i;
    const isC = (pitch + 1) % 12 === 0; // la línea inferior de cada Do
    ctx.fillStyle = isC ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.025)";
    ctx.fillRect(0, (i + 1) * ROW_HEIGHT - 1, s.width, 1);
  }
  const endTick = xToTick(s.width, s.pxPerBar);
  for (let t = 0; t <= endTick; t += TICKS_PER_BEAT) {
    const x = Math.round(tickToX(t, s.pxPerBar));
    ctx.fillStyle = t % TICKS_PER_BAR === 0 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.045)";
    ctx.fillRect(x, 0, 1, s.height);
  }

  // 3. Voicing del acorde como sombra.
  ctx.setLineDash([3, 3]);
  for (const r of s.regions) {
    if (!r.fn) continue;
    for (const n of r.voicing) {
      const x = tickToX(n.position, s.pxPerBar);
      const w = Math.max(2, n.length * (s.pxPerBar / TICKS_PER_BAR) - 2);
      const y = pitchToY(n.pitch, s.topPitch);
      ctx.fillStyle = alpha(p[r.fn], 0.1);
      ctx.strokeStyle = alpha(p[r.fn], 0.35);
      ctx.fillRect(x, y + 1, w, ROW_HEIGHT - 2);
      ctx.strokeRect(x + 0.5, y + 1.5, w - 1, ROW_HEIGHT - 3);
    }
  }
  ctx.setLineDash([]);

  // 4. Notas.
  ctx.font = "600 9px 'Inter Variable', sans-serif";
  ctx.textBaseline = "middle";
  for (const n of s.notes) {
    const x = tickToX(n.position, s.pxPerBar);
    const w = Math.max(3, n.length * (s.pxPerBar / TICKS_PER_BAR) - 1);
    const y = pitchToY(n.pitch, s.topPitch);
    if (y + ROW_HEIGHT < 0 || y > s.height) continue;
    const region = regionAt(s.regions, n.position);
    const role = region ? harmonicRole(n.pitch, region.chordPcs, region.root, region.scalePcs) : "scale";
    const selected = s.selection.has(noteKey(n));

    ctx.save();
    if (role === "root" || role === "chord") {
      ctx.shadowColor = region?.fn ? p[region.fn] : s.trackColor;
      ctx.shadowBlur = 10;
    }
    // Fuera de la escala: tono rojizo. De paso (escala, no acorde): algo más tenue.
    const base = role === "outside" ? p.danger : s.trackColor;
    const strength = role === "scale" ? 0.25 + 0.55 * n.velocity : 0.35 + 0.65 * n.velocity;
    ctx.fillStyle = alpha(base, strength);
    roundRect(ctx, x, y + 1, w, ROW_HEIGHT - 2, 3);
    ctx.fill();
    ctx.restore();

    ctx.lineWidth = selected ? 2 : 1;
    ctx.setLineDash(role === "outside" && !selected ? [2, 2] : []);
    ctx.strokeStyle = selected
      ? p.text
      : role === "outside"
        ? p.danger
        : role === "scale"
          ? alpha(s.trackColor, 0.9)
          : "rgba(255,255,255,0.85)";
    roundRect(ctx, x + 0.5, y + 1.5, w - 1, ROW_HEIGHT - 3, 3);
    ctx.stroke();
    ctx.setLineDash([]);

    if (s.showLabels && w > 26) {
      ctx.fillStyle = "rgba(4,5,10,0.85)";
      ctx.fillText(pitchName(n.pitch, s.notation), x + 4, y + ROW_HEIGHT / 2 + 0.5);
    }
  }

  // 5. Lazo de selección.
  if (s.lasso) {
    const { x0, y0, x1, y1 } = s.lasso;
    ctx.fillStyle = alpha(p.accent, 0.12);
    ctx.strokeStyle = p.accent;
    ctx.setLineDash([4, 3]);
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.strokeRect(Math.min(x0, x1) + 0.5, Math.min(y0, y1) + 0.5, Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.setLineDash([]);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rr);
}

/** Dibuja la tira de teclado (columna fija a la izquierda). */
export function drawKeyboard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  topPitch: number,
  highlight: Set<number>,
  sounding: Set<number>,
  fn: TonalFunction | null,
  notation: Notation,
) {
  const p = palette();
  const rows = Math.ceil(height / ROW_HEIGHT) + 1;
  ctx.clearRect(0, 0, width, height);
  ctx.font = "500 9px 'Inter Variable', sans-serif";
  ctx.textBaseline = "middle";
  for (let i = 0; i < rows; i++) {
    const pitch = topPitch - i;
    const y = i * ROW_HEIGHT;
    const black = isBlack(pitch);
    ctx.fillStyle = black ? "#10131f" : "#c9cee3";
    ctx.fillRect(0, y, width, ROW_HEIGHT - 1);
    if (highlight.has(pitch % 12) && fn) {
      ctx.fillStyle = alpha(p[fn], black ? 0.55 : 0.45);
      ctx.fillRect(0, y, width, ROW_HEIGHT - 1);
    }
    if (sounding.has(pitch)) {
      ctx.fillStyle = fn ? p[fn] : p.accent;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      ctx.fillRect(0, y, width, ROW_HEIGHT - 1);
      ctx.shadowBlur = 0;
    }
    if (pitch % 12 === 0) {
      ctx.fillStyle = "#10131f";
      ctx.fillText(pitchName(pitch, notation), 4, y + ROW_HEIGHT / 2);
    }
  }
}
