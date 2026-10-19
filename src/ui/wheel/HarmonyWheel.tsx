// La Rueda armónica: el círculo de quintas convertido en paleta de acordes.
//
//   anillo exterior  → las 12 tonalidades (clic para cambiar; la tónica queda arriba)
//   anillo medio     → acordes prestados (de un modo paralelo o de una tonalidad vecina)
//   anillo interior  → los acordes de la tonalidad: forman un arco de 7 casillas seguidas
//   arcos de luz     → qué tan bien suena ir desde el acorde anterior a cada candidato
//
// Cada acorde se coloca en el ángulo de su fundamental en el círculo de quintas.

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { Palette } from "../../bindings/Palette";
import type { PaletteEntry } from "../../bindings/PaletteEntry";
import {
  chordSymbol,
  fifthsAngle,
  functionColor,
  isMinorLike,
  keyName,
  keyRootName,
  romanSymbol,
  scaleSteps,
} from "../../lib/music";
import { reasonText } from "../../lib/reason";
import { pointerGesture, useDrag } from "../../stores/drag";
import { insertionPoint, useSelectedChord, useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";
import "./HarmonyWheel.css";

const R = {
  center: 88,
  diatonic: [98, 172] as const,
  borrowed: [180, 244] as const,
  keys: [252, 296] as const,
};
const HALF = 14; // medio ancho de cada casilla, en grados (30° menos un pequeño hueco)

const rad = (deg: number) => (deg * Math.PI) / 180;
function polar(angle: number, r: number): [number, number] {
  return [r * Math.sin(rad(angle)), -r * Math.cos(rad(angle))];
}

function sectorPath(a0: number, a1: number, r0: number, r1: number): string {
  const [x0, y0] = polar(a0, r1);
  const [x1, y1] = polar(a1, r1);
  const [x2, y2] = polar(a1, r0);
  const [x3, y3] = polar(a0, r0);
  return `M${x0},${y0} A${r1},${r1} 0 0 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 0 0 ${x3},${y3} Z`;
}

/** Rotación acumulada que siempre gira por el camino más corto. */
function useShortestRotation(target: number): number {
  const ref = useRef(target);
  const delta = ((((target - ref.current) % 360) + 540) % 360) - 180;
  ref.current += delta;
  return ref.current;
}

export function HarmonyWheel({ size }: { size: number }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view);
  const edit = useSong((s) => s.edit);
  const selected = useSelectedChord();
  const { notation, symbols, level, chordSize, wheelSource, select } = useUi();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [hovered, setHovered] = useState<PaletteEntry | null>(null);
  const dragging = useDrag((s) => s.payload !== null);

  const key = selected?.key ?? view?.song.homeKey;
  const previous = selected?.chord ?? view?.chords[view.chords.length - 1]?.chord ?? null;
  const keyId = JSON.stringify(key);
  const previousId = JSON.stringify(previous);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    void api.palette(key, chordSize, previous).then((p) => alive && setPalette(p));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyId, chordSize, previousId]);

  const rotation = useShortestRotation(key ? -fifthsAngle(key.root) : 0);
  if (!view || !key || !palette) return <div className="wheel-wrap" style={{ width: size, height: size }} />;

  const scaleLabel = (name: string) => t(`scale.${name}`);
  const minorLike = isMinorLike(key.scale.name);
  const outer: PaletteEntry[] =
    wheelSource.kind === "left"
      ? palette.left
      : wheelSource.kind === "right"
        ? palette.right
        : (palette.borrowed.find((g) => g.scale === wheelSource.scale) ?? palette.borrowed[0])?.entries ?? [];
  const inKey = (e: PaletteEntry) => palette.diatonic.some((d) => JSON.stringify(d.chord) === JSON.stringify(e.chord));

  const label = (e: PaletteEntry) => (symbols === "names" ? chordSymbol(e.label, notation) : romanSymbol(e.label));
  const subLabel = (e: PaletteEntry) => (symbols === "names" ? romanSymbol(e.label) : chordSymbol(e.label, notation));

  const addChord = (e: PaletteEntry) => {
    const at = insertionPoint(view, selected);
    void edit({ type: "insertChord", section: at.section, index: at.index, chord: e.chord, length: null }).then(
      (v) => v && select(at),
    );
  };

  const onEntryDown = (ev: React.PointerEvent, e: PaletteEntry) => {
    if (ev.button !== 0) return;
    pointerGesture(ev, {
      onClick: () => addChord(e),
      onDragStart: (x, y) => useDrag.getState().start({ kind: "new", chord: e.chord, label: e.label }, x, y),
    });
  };

  const onEntryEnter = (e: PaletteEntry) => {
    setHovered(e);
    if (!dragging) void api.previewChord(e.chord, key.root);
  };

  const setKeyRoot = (root: number) =>
    edit({ type: "setHomeKey", key: { root, scale: { name: key.scale.name, steps: scaleSteps(key.scale.name) } } });

  const showSub = level !== "beginner";
  const previousAngle = previous ? fifthsAngle(previous.root) : null;
  const candidates = [
    ...palette.diatonic.map((e) => ({ e, r: R.diatonic[0] })),
    ...outer.filter((e) => !inKey(e)).map((e) => ({ e, r: R.borrowed[0] })),
  ].filter(({ e }) => e.transition.score >= 0.7 && e.transition.reason.kind !== "noContext");

  return (
    <div className="wheel-wrap" style={{ width: size, height: size }}>
      <svg className="wheel" viewBox="-310 -310 620 620" width={size} height={size} role="group" aria-label={t("wheel.title")}>
        <defs>
          <radialGradient id="wheel-core" r="0.5">
            <stop offset="0%" stopColor="rgba(139,123,255,0.22)" />
            <stop offset="100%" stopColor="rgba(139,123,255,0)" />
          </radialGradient>
        </defs>
        <circle r={300} className="wheel-halo" />
        <circle r={R.center} fill="url(#wheel-core)" />

        <g className="wheel-rotor" style={{ transform: `rotate(${rotation}deg)` }}>
          {/* Anillo de tonalidades */}
          {Array.from({ length: 12 }, (_, i) => {
            const pc = (i * 7) % 12;
            const a = i * 30;
            const isHome = pc === key.root;
            const isNeighbor = pc === (key.root + 7) % 12 || pc === (key.root + 5) % 12;
            const [x, y] = polar(a, (R.keys[0] + R.keys[1]) / 2);
            return (
              <g
                key={`k${pc}`}
                data-tip="concept.circle"
                className={`key-sector ${isHome ? "is-home" : ""} ${isNeighbor ? "is-neighbor" : ""}`}
                onClick={() => setKeyRoot(pc)}
              >
                <path d={sectorPath(a - HALF, a + HALF, R.keys[0], R.keys[1])} />
                <g className="upright" style={{ transform: `translate(${x}px, ${y}px) rotate(${-rotation}deg)` }}>
                  <text y={5}>
                    {keyRootName(pc, key.scale.name, notation)}
                    {minorLike ? "m" : ""}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Casillas vacías: dejan ver que la tonalidad ocupa 7 casillas seguidas */}
          {Array.from({ length: 12 }, (_, i) => (
            <g key={`slot${i}`} className="slot">
              <path d={sectorPath(i * 30 - HALF, i * 30 + HALF, R.diatonic[0], R.diatonic[1])} />
              <path d={sectorPath(i * 30 - HALF, i * 30 + HALF, R.borrowed[0], R.borrowed[1])} />
            </g>
          ))}

          {/* Arcos de luz desde el acorde anterior */}
          {previousAngle !== null &&
            candidates.map(({ e, r }) => {
              const a = fifthsAngle(e.chord.root);
              const [x0, y0] = polar(previousAngle, R.center + 4);
              const [x1, y1] = polar(a, r);
              const [cx, cy] = polar((previousAngle + a) / 2, 20);
              return (
                <motion.path
                  key={`arc-${JSON.stringify(e.chord)}`}
                  className={`score-arc ${e.transition.score >= 1 ? "is-strong" : ""}`}
                  d={`M${x0},${y0} Q${cx},${cy} ${x1},${y1}`}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: e.transition.score >= 1 ? 0.9 : 0.4 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              );
            })}

          {/* Acordes de la tonalidad */}
          {palette.diatonic.map((e) => (
            <ChordSector
              key={`d${e.degree}`}
              entry={e}
              r0={R.diatonic[0]}
              r1={R.diatonic[1]}
              rotation={rotation}
              text={label(e)}
              sub={showSub ? subLabel(e) : null}
              isPrevious={!!previous && JSON.stringify(previous) === JSON.stringify(e.chord)}
              onDown={onEntryDown}
              onEnter={onEntryEnter}
              onLeave={() => setHovered(null)}
            />
          ))}

          {/* Acordes prestados o vecinos */}
          {outer.map((e) => (
            <ChordSector
              key={`b${e.degree}-${JSON.stringify(e.chord)}`}
              entry={e}
              r0={R.borrowed[0]}
              r1={R.borrowed[1]}
              rotation={rotation}
              text={label(e)}
              sub={showSub ? subLabel(e) : null}
              shared={inKey(e)}
              small
              isPrevious={!!previous && JSON.stringify(previous) === JSON.stringify(e.chord)}
              onDown={onEntryDown}
              onEnter={onEntryEnter}
              onLeave={() => setHovered(null)}
            />
          ))}
        </g>

        {/* Centro: la tonalidad, o el acorde bajo el ratón */}
        <g className="wheel-center" data-tip={`mode.${key.scale.name}`}>
          <circle r={R.center} fill="transparent" />
          {hovered ? (
            <>
              <text y={-14} className="center-symbol" style={{ fill: functionColor(hovered.label.function) }}>
                {chordSymbol(hovered.label, notation)}
              </text>
              <text y={14} className="center-sub">
                {romanSymbol(hovered.label)} · {t(`function.${hovered.label.function}`)}
              </text>
              {previous && (
                <text y={36} className="center-score">
                  {"●".repeat(hovered.transition.score >= 1 ? 3 : hovered.transition.score >= 0.7 ? 2 : hovered.transition.score > 0 ? 1 : 0) || "○"}
                </text>
              )}
            </>
          ) : (
            <>
              <text y={-6} className="center-key">
                {keyRootName(key.root, key.scale.name, notation)}
              </text>
              <text y={20} className="center-sub">
                {scaleLabel(key.scale.name)}
              </text>
            </>
          )}
        </g>
      </svg>

      {hovered && previous && hovered.transition.reason.kind !== "noContext" && (
        <p className="wheel-reason">{reasonText(t, hovered.transition.reason)}</p>
      )}
      <span className="sr-only">{keyName(key, notation, scaleLabel)}</span>
    </div>
  );
}

function ChordSector({
  entry,
  r0,
  r1,
  rotation,
  text,
  sub,
  shared = false,
  small = false,
  isPrevious,
  onDown,
  onEnter,
  onLeave,
}: {
  entry: PaletteEntry;
  r0: number;
  r1: number;
  rotation: number;
  text: string;
  sub: string | null;
  shared?: boolean;
  small?: boolean;
  isPrevious: boolean;
  onDown: (ev: React.PointerEvent, e: PaletteEntry) => void;
  onEnter: (e: PaletteEntry) => void;
  onLeave: () => void;
}) {
  const a = fifthsAngle(entry.chord.root);
  const [x, y] = polar(a, (r0 + r1) / 2);
  const score = entry.transition.score;
  const classes = [
    "chord-sector",
    small ? "is-outer" : "",
    shared ? "is-shared" : "",
    isPrevious ? "is-previous" : "",
    score >= 1 && entry.transition.reason.kind !== "noContext" ? "is-strong" : "",
  ].join(" ");
  return (
    <g
      className={classes}
      data-tip={`function.${entry.label.function}`}
      style={{ ["--fn" as string]: functionColor(entry.label.function) }}
      onPointerDown={(ev) => onDown(ev, entry)}
      onPointerEnter={() => onEnter(entry)}
      onPointerLeave={onLeave}
    >
      <path d={sectorPath(a - HALF, a + HALF, r0, r1)} />
      <g className="upright" style={{ transform: `translate(${x}px, ${y}px) rotate(${-rotation}deg)` }}>
        <text y={sub ? -4 : 6} className="sector-label" style={text.length > 3 ? { fontSize: Math.max(11, (small ? 16 : 21) - (text.length - 3) * 2.2) } : undefined}>
          {text}
        </text>
        {sub && (
          <text y={16} className="sector-sub">
            {sub}
          </text>
        )}
      </g>
    </g>
  );
}
