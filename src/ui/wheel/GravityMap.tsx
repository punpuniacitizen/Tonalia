// Mapa de gravedad T–S–D: cada acorde de la canción es un punto en la zona de su función y
// la progresión es un camino entre zonas. Al reproducir, una luz recorre el camino.

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { ChordView } from "../../bindings/ChordView";
import { chordSymbol, romanSymbol } from "../../lib/music";
import { useSelectedChord, useSong } from "../../stores/song";
import { currentPosition, useTransport } from "../../stores/transport";
import { useUi } from "../../stores/ui";
import { applyTension, tensionLabel, useTensions, visibleTensions } from "./useTensions";

const ZONES = {
  tonic: { x: 0, y: 70, r: 62 },
  subdominant: { x: -92, y: -52, r: 54 },
  dominant: { x: 92, y: -52, r: 54 },
} as const;

const GOLDEN = 137.508;

/** Tensiones de un acorde como pequeños satélites en arco por encima de su punto. */
function TensionSatellites({ x, y, target }: { x: number; y: number; target: ChordView }) {
  const { t } = useTranslation();
  const notation = useUi((s) => s.notation);
  const tensions = visibleTensions(useTensions(target.chord, target.key, true));
  const n = tensions.length;
  return (
    <g className="satellites">
      {tensions.map((ten, i) => {
        const a = ((-160 + (n === 1 ? 70 : (i * 140) / (n - 1))) * Math.PI) / 180;
        const sx = x + Math.cos(a) * 24;
        const sy = y + Math.sin(a) * 24;
        const cls = ten.present ? "is-present" : ten.avoid ? "is-avoid" : "";
        return (
          <g
            key={ten.token}
            className={`satellite ${cls}`}
            data-tip="concept.extensions"
            onPointerEnter={() => api.previewChord(ten.chord, target.key.root)}
            onClick={() => applyTension(target, ten)}
          >
            <line x1={x} y1={y} x2={sx} y2={sy} />
            <circle cx={sx} cy={sy} r={8} />
            <text x={sx} y={sy + 3}>
              {tensionLabel(ten.token)}
            </text>
            <title>
              {chordSymbol(ten.label, notation)}
              {ten.avoid ? ` — ${t("tensions.avoid")}` : ""}
              {ten.present ? ` — ${t("tensions.remove")}` : ""}
            </title>
          </g>
        );
      })}
    </g>
  );
}

export function GravityMap({ size }: { size: number }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view);
  const selected = useSelectedChord();
  const { notation, symbols, select, showTensions } = useUi();
  const playing = useTransport((s) => s.playing);
  const [current, setCurrent] = useState(-1);

  useEffect(() => {
    if (!playing || !view) {
      setCurrent(-1);
      return;
    }
    let frame = 0;
    const loop = () => {
      const p = currentPosition();
      const i = view.chords.findIndex((c) => p >= c.start && p < c.start + c.length);
      setCurrent((prev) => (prev === i ? prev : i));
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, [playing, view]);

  if (!view) return null;

  // Un punto por acorde distinto, repartido en su zona con el ángulo áureo (no se solapan).
  const points = new Map<string, { x: number; y: number; chord: ChordView }>();
  const perZone = { tonic: 0, subdominant: 0, dominant: 0 };
  for (const c of view.chords) {
    const id = JSON.stringify(c.chord);
    if (points.has(id)) continue;
    const z = ZONES[c.label.function];
    const n = perZone[c.label.function]++;
    const a = ((n * GOLDEN - 90) * Math.PI) / 180;
    // Con las tensiones visibles, los puntos se separan más para que sus satélites no se pisen.
    const r = n === 0 ? 0 : showTensions ? Math.min(z.r - 4, 44 + n * 4) : Math.min(z.r - 12, 26 + n * 4);
    points.set(id, { x: z.x + Math.cos(a) * r, y: z.y + Math.sin(a) * r, chord: c });
  }
  const path = view.chords.map((c) => points.get(JSON.stringify(c.chord))!);
  const d = path.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `Q${(path[i - 1].x + p.x) / 2 + (p.y - path[i - 1].y) * 0.25},${(path[i - 1].y + p.y) / 2 - (p.x - path[i - 1].x) * 0.25} ${p.x},${p.y}`)).join(" ");
  const label = (c: ChordView) => (symbols === "names" ? chordSymbol(c.label, notation) : romanSymbol(c.label));
  const here = current >= 0 ? path[current] : null;

  return (
    <svg className="gravity" viewBox="-170 -130 340 270" width={size} height={size * 0.8} role="img" aria-label={t("dock.map")}>
      {(Object.keys(ZONES) as (keyof typeof ZONES)[]).map((fn) => {
        const z = ZONES[fn];
        return (
          <g key={fn} data-tip={`function.${fn}`}>
            <circle cx={z.x} cy={z.y} r={z.r} className="zone" style={{ ["--fn" as string]: `var(--fn-${fn})` }} />
            <text x={z.x} y={fn === "tonic" ? z.y + z.r + 14 : z.y - z.r - 6} className="zone-label" style={{ fill: `var(--fn-${fn})` }}>
              {t(`function.${fn}`)}
            </text>
          </g>
        );
      })}
      <path d={d} className="map-path" />
      {[...points.values()].map((p) => {
        const isSel = selected && JSON.stringify(selected.chord) === JSON.stringify(p.chord.chord);
        return (
          <g key={JSON.stringify(p.chord.chord)}>
            <g
              className={`map-point ${isSel ? "is-selected" : ""}`}
              style={{ ["--fn" as string]: `var(--fn-${p.chord.label.function})` }}
              onClick={() => select({ section: p.chord.section, index: p.chord.index })}
            >
              <circle cx={p.x} cy={p.y} r={isSel ? 9 : 7} />
              <text x={p.x} y={showTensions ? p.y + 20 : p.y - 12}>
                {label(p.chord)}
              </text>
            </g>
            {showTensions && <TensionSatellites x={p.x} y={p.y} target={isSel && selected ? selected : p.chord} />}
          </g>
        );
      })}
      {here && (
        <motion.circle
          className="map-here"
          r={12}
          animate={{ cx: here.x, cy: here.y }}
          transition={{ type: "spring", stiffness: 220, damping: 20 }}
        />
      )}
      {view.chords.length === 0 && (
        <text y={0} className="zone-label">
          {t("dock.mapEmpty")}
        </text>
      )}
    </svg>
  );
}
