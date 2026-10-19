// Tonnetz: red de notas donde a la derecha se sube una quinta y en diagonal una tercera mayor.
// Cada triángulo es una tríada (hacia arriba = mayor, hacia abajo = menor) y los triángulos
// vecinos comparten dos notas: moverse entre ellos es el movimiento más suave posible.
// Transformaciones: P (paralelo: Do ↔ Dom), R (relativo: Do ↔ Lam), L (sensible: Do ↔ Mim).
// Como la rueda, sirve para buscar acordes: pasar el ratón por un triángulo lo hace sonar,
// clic lo añade después del acorde seleccionado y arrastrarlo lo lleva a la cinta. Los acordes
// de la tonalidad aparecen rotulados y teñidos con su función.

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { Chord } from "../../bindings/Chord";
import type { ChordLabel } from "../../bindings/ChordLabel";
import type { ChordView } from "../../bindings/ChordView";
import type { TensionView } from "../../bindings/TensionView";
import { chordSymbol, functionColor, romanSymbol } from "../../lib/music";
import { pitchName } from "../../lib/pitch";
import { pointerGesture, useDrag } from "../../stores/drag";
import { insertionPoint, useSelectedChord, useSong } from "../../stores/song";
import { sameRef, useUi } from "../../stores/ui";
import { applyTension, tensionLabel, useTensions, visibleTensions } from "./useTensions";

const COLS = 7;
const ROWS = 5;
const W = 50;
const H = 43;

type Tri = { root: number; minor: boolean; pts: [number, number][]; cx: number; cy: number };

const triChord = (t: { root: number; minor: boolean }): Chord => ({ root: t.root, intervals: t.minor ? [3, 7] : [4, 7] });
const triId = (t: { root: number; minor: boolean }) => `${t.root}${t.minor ? "m" : ""}`;

/** Tríada mayor/menor de un acorde (si la tiene). */
function triadOf(c: Chord): { root: number; minor: boolean } | null {
  const has = (i: number) => c.intervals.includes(i);
  if (has(4) && has(7)) return { root: c.root, minor: false };
  if (has(3) && has(7)) return { root: c.root, minor: true };
  return null;
}

/** Proporción alto/ancho del dibujo y alto aproximado de lo que va debajo (aviso y P/R/L). */
export const TONNETZ_RATIO = 0.54;
export const TONNETZ_CONTROLS = 34;

export function Tonnetz({ size }: { size: number }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view);
  const edit = useSong((s) => s.edit);
  const selected = useSelectedChord();
  const notation = useUi((s) => s.notation);
  const symbols = useUi((s) => s.symbols);
  const select = useUi((s) => s.select);
  const showTensions = useUi((s) => s.showTensions);
  const dragging = useDrag((s) => s.payload !== null);
  const tensions = useTensions(selected?.chord ?? null, selected?.key ?? null, showTensions);
  const [hovered, setHovered] = useState<Tri | null>(null);
  const [labels, setLabels] = useState<Map<string, ChordLabel>>(new Map());
  const key = selected?.key ?? view?.song.homeKey ?? null;
  const keyId = JSON.stringify(key);

  // Nombre, grado y función de las 24 tríadas en la tonalidad actual.
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const all = Array.from({ length: 24 }, (_, i) => ({ root: i % 12, minor: i >= 12 }));
    void Promise.all(all.map((t) => api.describeChord(triChord(t), key).then((l) => [triId(t), l] as const))).then(
      (pairs) => alive && setLabels(new Map(pairs)),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyId]);

  if (!view || !key) return null;
  const keyRoot = key.root;
  // Notas de la escala: una tríada es «de la tonalidad» si sus tres notas están en ella.
  const scalePcs = new Set(key.scale.steps.slice(0, -1).reduce((acc, s) => [...acc, (acc[acc.length - 1] + s) % 12], [keyRoot]));
  const inKey = (t: Tri) => triChord(t).intervals.every((i) => scalePcs.has((t.root + i) % 12)) && scalePcs.has(t.root);
  const labelOf = (t: Tri) => labels.get(triId(t));
  const nameOf = (l: ChordLabel) => (symbols === "names" ? chordSymbol(l, notation) : romanSymbol(l));

  const addChord = (t: Tri) => {
    const at = insertionPoint(view, selected);
    void edit({ type: "insertChord", section: at.section, index: at.index, chord: triChord(t), length: null }).then((v) => v && select(at));
  };
  const onTriDown = (ev: React.PointerEvent, t: Tri) => {
    if (ev.button !== 0) return;
    const label = labelOf(t);
    pointerGesture(ev, {
      onClick: () => addChord(t),
      onDragStart: (x, y) => label && useDrag.getState().start({ kind: "new", chord: triChord(t), label }, x, y),
    });
  };
  const onTriEnter = (t: Tri) => {
    setHovered(t);
    if (!dragging) void api.previewChord(triChord(t), keyRoot);
  };

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

  // Tensiones del acorde seleccionado: el nodo más cercano a su triángulo con cada nota.
  const nodes = Array.from({ length: COLS }, (_, i) => Array.from({ length: ROWS }, (_, j) => ({ pc: pc(i, j), xy: pos(i, j) }))).flat();
  const nearest = (target: number, from: [number, number]) =>
    nodes.filter((n) => n.pc === target).reduce((a, b) => (Math.hypot(b.xy[0] - from[0], b.xy[1] - from[1]) < Math.hypot(a.xy[0] - from[0], a.xy[1] - from[1]) ? b : a));
  const seventhIv = selected ? [10, 11, 9].find((i) => selected.chord.intervals.includes(i) && !(i === 9 && !selected.chord.intervals.includes(6))) : undefined;
  const ext: { label: string; xy: [number, number]; present: boolean; avoid: boolean; ten?: TensionView }[] = [];
  if (showTensions && selected && selTri) {
    const c: [number, number] = [selTri.cx, selTri.cy];
    if (seventhIv !== undefined) ext.push({ label: seventhIv === 11 ? "maj7" : "7", xy: nearest((selected.chord.root + seventhIv) % 12, c).xy, present: true, avoid: false });
    for (const ten of visibleTensions(tensions)) {
      ext.push({ label: tensionLabel(ten.token), xy: nearest((selected.chord.root + ten.interval) % 12, c).xy, present: ten.present, avoid: ten.avoid, ten });
    }
  }

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
    <div className="tonnetz-wrap">
      <svg className="tonnetz" viewBox="-185 -100 370 200" width={size} height={size * TONNETZ_RATIO} data-tip="concept.tonnetz">
        {tris.map((tr, k) => {
          const chord = used.get(tr);
          const label = labelOf(tr);
          const fn = chord?.label.function ?? label?.function;
          return (
            <polygon
              key={k}
              points={tr.pts.map((p) => p.join(",")).join(" ")}
              className={`tri ${tr.minor ? "minor" : "major"} ${inKey(tr) ? "is-key" : ""} ${chord ? "is-used" : ""} ${tr === selTri ? "is-selected" : ""} ${tr === hovered ? "is-hover" : ""}`}
              style={fn ? { ["--fn" as string]: functionColor(fn) } : undefined}
              onPointerEnter={() => onTriEnter(tr)}
              onPointerLeave={() => setHovered((h) => (h === tr ? null : h))}
              onPointerDown={(ev) => onTriDown(ev, tr)}
            />
          );
        })}
        {/* Nombre de los acordes de la tonalidad (y del que está bajo el ratón). */}
        {tris.map((tr, k) => {
          const label = labelOf(tr);
          if (!label || (!inKey(tr) && tr !== hovered)) return null;
          return (
            <text key={`t${k}`} x={tr.cx} y={tr.cy + 3} className={`tn-tri-label ${tr === hovered ? "is-hover" : ""}`}>
              {nameOf(label)}
            </text>
          );
        })}
        <polyline points={path.map((p) => `${p.tri.cx},${p.tri.cy}`).join(" ")} className="tonnetz-path" />
        {path.map((p, i) => (
          <motion.circle key={i} cx={p.tri.cx} cy={p.tri.cy} r={3} className="tonnetz-step" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.08 }} />
        ))}
        {selTri &&
          ext.map((e, k) => (
            <motion.line
              key={`l${k}`}
              x1={selTri.cx}
              y1={selTri.cy}
              x2={e.xy[0]}
              y2={e.xy[1]}
              className={`tn-ext-line ${e.present ? "is-present" : ""} ${e.avoid ? "is-avoid" : ""}`}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: k * 0.05 }}
            />
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
        {ext.map((e, k) => (
          <g
            key={`n${k}`}
            className={`tn-ext ${e.present ? "is-present" : ""} ${e.avoid ? "is-avoid" : ""} ${e.ten ? "is-clickable" : ""}`}
            data-tip="concept.extensions"
            onPointerEnter={() => e.ten && selected && api.previewChord(e.ten.chord, selected.key.root)}
            onClick={() => e.ten && selected && applyTension(selected, e.ten)}
          >
            <circle cx={e.xy[0]} cy={e.xy[1]} r={13} />
            <text x={e.xy[0]} y={e.xy[1] - 17} className="tn-ext-label">
              {e.label}
            </text>
            {e.ten && (
              <title>
                {chordSymbol(e.ten.label, notation)}
                {e.avoid ? ` — ${t("tensions.avoid")}` : ""}
              </title>
            )}
          </g>
        ))}
      </svg>
      <div className="plr">
        {/* Sin acorde elegido, un solo aviso: con las tensiones visibles, el de tensiones. */}
        <span>
          {hovered && labelOf(hovered)
            ? `${chordSymbol(labelOf(hovered)!, notation)} · ${romanSymbol(labelOf(hovered)!)} · ${t(`function.${labelOf(hovered)!.function}`)} — ${t("dock.tonnetzAddHint")}`
            : selected && triadOf(selected.chord)
              ? t("dock.plrHint")
              : showTensions && !selected
                ? t("tensions.selectHint")
                : t("dock.plrSelect")}
        </span>
        {(["P", "R", "L"] as const).map((k) => (
          <button key={k} disabled={!selected || !triadOf(selected.chord)} onClick={() => transform(k)} title={t(`dock.plr${k}`)}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
