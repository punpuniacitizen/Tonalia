// Tres formas de ver las notas de un acorde: teclado, reloj cromático y mástil de guitarra.

import { motion } from "motion/react";

import type { Chord } from "../../bindings/Chord";
import type { Notation } from "../../bindings/Notation";
import type { SpelledNote } from "../../bindings/SpelledNote";
import { spelledName } from "../../lib/music";

// Teclas blancas (clase de altura) y negras (clase de altura, posición en % del ancho).
const WHITES = [0, 2, 4, 5, 7, 9, 11];
const BLACKS: [number, number][] = [
  [1, 9.5],
  [3, 23.8],
  [6, 52.4],
  [8, 66.7],
  [10, 81],
];

export function MiniKeys({ pitchClasses, root }: { pitchClasses: number[]; root: number }) {
  const on = new Set(pitchClasses);
  return (
    <div className="mini-keys" aria-hidden="true">
      {WHITES.map((pc) => (
        <div key={pc} className={`white ${on.has(pc) ? "is-on" : ""} ${pc === root ? "is-root" : ""}`} />
      ))}
      {BLACKS.map(([pc, x]) => (
        <div key={pc} className={`black ${on.has(pc) ? "is-on" : ""}`} style={{ left: `${x}%` }} />
      ))}
    </div>
  );
}

const INTERVAL_SHORT: Record<number, string> = { 1: "2m", 2: "2M", 3: "3m", 4: "3M", 5: "4J", 6: "TT", 7: "5J", 8: "6m", 9: "6M", 10: "7m", 11: "7M" };

/**
 * Reloj cromático: las 12 notas en círculo y el acorde como polígono.
 * Todos los acordes mayores forman el mismo triángulo, solo que girado: así se ve que la
 * "forma" de un acorde no depende de su fundamental.
 */
export function ChromaticClock({ chord, notes, notation }: { chord: Chord; notes: SpelledNote[]; notation: Notation }) {
  const R = 62;
  const pcs = [chord.root, ...chord.intervals.map((i) => (chord.root + i) % 12)].filter((pc, i, a) => a.indexOf(pc) === i);
  const sorted = [...pcs].sort((a, b) => ((a - chord.root + 12) % 12) - ((b - chord.root + 12) % 12));
  const pos = (pc: number, r = R): [number, number] => {
    const a = ((pc * 30 - 90) * Math.PI) / 180;
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  const polygon = sorted.map((pc) => pos(pc).join(",")).join(" ");
  const nameOf = (pc: number) => {
    const i = pcs.indexOf(pc);
    return i >= 0 && notes[i] ? spelledName(notes[i], notation) : "";
  };
  return (
    <svg viewBox="-90 -82 180 164" className="clock">
      <circle r={R} className="clock-ring" />
      <motion.polygon
        key={polygon}
        points={polygon}
        className="clock-shape"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 16 }}
      />
      {sorted.map((pc, i) => {
        const next = sorted[(i + 1) % sorted.length];
        const gap = (next - pc + 12) % 12;
        const [x1, y1] = pos(pc);
        const [x2, y2] = pos(next);
        const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
        return (
          <text key={`iv${pc}`} x={mx * 0.72} y={my * 0.72 + 3} className="clock-interval">
            {INTERVAL_SHORT[gap] ?? ""}
          </text>
        );
      })}
      {Array.from({ length: 12 }, (_, pc) => {
        const [x, y] = pos(pc);
        const on = pcs.includes(pc);
        const [lx, ly] = pos(pc, R + 13);
        return (
          <g key={pc}>
            <circle cx={x} cy={y} r={on ? (pc === chord.root ? 6 : 5) : 2.2} className={on ? (pc === chord.root ? "clock-root" : "clock-on") : "clock-off"} />
            {on && (
              <text x={lx} y={ly + 3} className="clock-label">
                {nameOf(pc)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Afinación estándar, de la 6ª cuerda (grave) a la 1ª: Mi La Re Sol Si Mi.
const STRINGS = [4, 9, 2, 7, 11, 4];
const FRETS = 12;

/** Mástil de guitarra (trastes 0–12) con las notas del acorde marcadas. */
export function Fretboard({ pitchClasses, root }: { pitchClasses: number[]; root: number }) {
  const on = new Set(pitchClasses);
  const W = 248;
  const H = 92;
  const fx = (f: number) => 14 + (f / FRETS) * (W - 20);
  const sy = (s: number) => 8 + ((5 - s) / 5) * (H - 16);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fretboard">
      {[3, 5, 7, 9].map((f) => (
        <circle key={f} cx={(fx(f) + fx(f - 1)) / 2} cy={H / 2} r={3} className="fret-marker" />
      ))}
      <circle cx={(fx(12) + fx(11)) / 2} cy={H / 2 - 12} r={3} className="fret-marker" />
      <circle cx={(fx(12) + fx(11)) / 2} cy={H / 2 + 12} r={3} className="fret-marker" />
      {Array.from({ length: FRETS + 1 }, (_, f) => (
        <line key={f} x1={fx(f)} x2={fx(f)} y1={6} y2={H - 6} className={f === 0 ? "nut" : "fret"} />
      ))}
      {STRINGS.map((_, s) => (
        <line key={s} x1={fx(0)} x2={fx(FRETS)} y1={sy(s)} y2={sy(s)} className="string" strokeWidth={1 + (5 - s) * 0.25} />
      ))}
      {STRINGS.flatMap((open, s) =>
        Array.from({ length: FRETS + 1 }, (_, f) => {
          const pc = (open + f) % 12;
          if (!on.has(pc)) return null;
          const x = f === 0 ? fx(0) - 7 : (fx(f) + fx(f - 1)) / 2;
          return <circle key={`${s}-${f}`} cx={x} cy={sy(s)} r={pc === root ? 5 : 4} className={pc === root ? "fret-root" : "fret-on"} />;
        }),
      )}
    </svg>
  );
}
