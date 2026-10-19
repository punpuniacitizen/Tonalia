// Tonnetz: red de notas donde a la derecha se sube una quinta y en diagonal una tercera mayor.
// Cada triángulo es una tríada (hacia arriba = mayor, hacia abajo = menor) y los triángulos
// vecinos comparten dos notas: moverse entre ellos es el movimiento más suave posible.
// Transformaciones: P (paralelo: Do ↔ Dom), R (relativo: Do ↔ Lam), L (sensible: Do ↔ Mim).

import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { Chord } from "../../bindings/Chord";
import type { ChordView } from "../../bindings/ChordView";
import { functionColor } from "../../lib/music";
import { pitchName } from "../../lib/pitch";
import { useSelectedChord, useSong } from "../../stores/song";
import { sameRef, useUi } from "../../stores/ui";

const COLS = 7;
const ROWS = 5;
const W = 50;
const H = 43;

type Tri = { root: number; minor: boolean; pts: [number, number][]; cx: number; cy: number };

/** Tríada mayor/menor de un acorde (si la tiene). */
function triadOf(c: Chord): { root: number; minor: boolean } | null {
  const has = (i: number) => c.intervals.includes(i);
  if (has(4) && has(7)) return { root: c.root, minor: false };
  if (has(3) && has(7)) return { root: c.root, minor: true };
  return null;
}

export function Tonnetz({ size }: { size: number }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view);
  const edit = useSong((s) => s.edit);
  const selected = useSelectedChord();
  const notation = useUi((s) => s.notation);
  if (!view) return null;
  const keyRoot = (selected?.key ?? view.song.homeKey).root;

  // La tónica queda en el centro de la red (columna 2, fila 2).
  const base = (((keyRoot - 7 * 2 - 4 * 2) % 12) + 12) % 12;
  const pc = (i: number, j: number) => (base + 7 * i + 4 * j) % 12;
  const pos = (i: number, j: number): [number, number] => [(i + j * 0.5 - 3) * W, -(j - 2) * H];

  const tris: Tri[] = [];
  for (let i = 0; i < COLS - 1; i++) {
    for (let j = 0; j < ROWS - 1; j++) {
      const up: [number, number][] = [pos(i, j), pos(i + 1, j), pos(i, j + 1)];
      const down: [number, number][] = [pos(i + 1, j), pos(i, j + 1), pos(i + 1, j + 1)];
      const centroid = (p: [number, number][]) => [(p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][1] + p[1][1] + p[2][1]) / 3];
      const [ux, uy] = centroid(up);
      const [dx, dy] = centroid(down);
      tris.push({ root: pc(i, j), minor: false, pts: up, cx: ux, cy: uy });
      tris.push({ root: pc(i, j + 1), minor: true, pts: down, cx: dx, cy: dy });
    }
  }

  // Camino de la progresión: en cada paso, la aparición del triángulo más cercana al anterior.
  const path: { tri: Tri; chord: ChordView }[] = [];
  let last: [number, number] = [0, 0];
  for (const c of view.chords) {
    const tr = triadOf(c.chord);
    if (!tr) continue;
    const options = tris.filter((x) => x.root === tr.root && x.minor === tr.minor);
    const best = options.reduce((a, b) => (Math.hypot(b.cx - last[0], b.cy - last[1]) < Math.hypot(a.cx - last[0], a.cy - last[1]) ? b : a), options[0]);
    if (!best) continue;
    path.push({ tri: best, chord: c });
    last = [best.cx, best.cy];
  }
  const used = new Map(path.map((p) => [p.tri, p.chord]));
  const selTri = selected ? path.find((p) => sameRef(p.chord, selected))?.tri : undefined;

  const transform = (kind: "P" | "R" | "L") => {
    if (!selected) return;
    const tr = triadOf(selected.chord);
    if (!tr) return;
    const r = tr.root;
    const next: Chord =
      kind === "P"
        ? { root: r, intervals: tr.minor ? [4, 7] : [3, 7] }
        : kind === "R"
          ? tr.minor
            ? { root: (r + 3) % 12, intervals: [4, 7] }
            : { root: (r + 9) % 12, intervals: [3, 7] }
          : tr.minor
            ? { root: (r + 8) % 12, intervals: [4, 7] }
            : { root: (r + 4) % 12, intervals: [3, 7] };
    void edit({ type: "replaceChord", at: { section: selected.section, index: selected.index }, chord: next });
  };

  return (
    <div className="tonnetz-wrap" style={{ width: size }}>
      <svg className="tonnetz" viewBox="-185 -100 370 200" width={size} height={size * 0.54} data-tip="concept.tonnetz">
        {tris.map((tr, k) => {
          const chord = used.get(tr);
          return (
            <polygon
              key={k}
              points={tr.pts.map((p) => p.join(",")).join(" ")}
              className={`tri ${tr.minor ? "minor" : "major"} ${chord ? "is-used" : ""} ${tr === selTri ? "is-selected" : ""}`}
              style={chord ? { ["--fn" as string]: functionColor(chord.label.function) } : undefined}
            />
          );
        })}
        <polyline points={path.map((p) => `${p.tri.cx},${p.tri.cy}`).join(" ")} className="tonnetz-path" />
        {path.map((p, i) => (
          <motion.circle key={i} cx={p.tri.cx} cy={p.tri.cy} r={3} className="tonnetz-step" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.08 }} />
        ))}
        {Array.from({ length: COLS }, (_, i) =>
          Array.from({ length: ROWS }, (_, j) => {
            const [x, y] = pos(i, j);
            const n = pc(i, j);
            return (
              <g key={`${i}-${j}`}>
                <circle cx={x} cy={y} r={11} className={`tn-node ${n === keyRoot ? "is-tonic" : ""}`} />
                <text x={x} y={y + 3.5} className="tn-label">
                  {pitchName(n, notation, false)}
                </text>
              </g>
            );
          }),
        )}
      </svg>
      <div className="plr">
        <span>{selected && triadOf(selected.chord) ? t("dock.plrHint") : t("dock.plrSelect")}</span>
        {(["P", "R", "L"] as const).map((k) => (
          <button key={k} disabled={!selected || !triadOf(selected.chord)} onClick={() => transform(k)} title={t(`dock.plr${k}`)}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
