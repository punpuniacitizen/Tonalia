// Ilustraciones de los tips: pequeños SVG animados que explican sin palabras.

import { motion } from "motion/react";

import { BRIGHTNESS, CHARACTERISTIC, type TipVisual } from "../../tips/tips";
import { scaleSteps } from "../../lib/music";

const FN = { tonic: "var(--fn-tonic)", subdominant: "var(--fn-subdominant)", dominant: "var(--fn-dominant)" } as const;

export function TipVisualView({ visual, lang }: { visual: TipVisual; lang: "es" | "en" }) {
  switch (visual.kind) {
    case "gravity":
      return <Gravity focus={visual.focus} lang={lang} />;
    case "mode":
      return <ModeKeys scale={visual.scale} lang={lang} />;
    case "third":
      return <Third lang={lang} />;
    case "roles":
      return <Roles lang={lang} />;
    case "arcs":
      return <Arcs />;
    case "circle":
      return <Circle />;
    case "borrow":
      return <Borrow />;
    case "tension":
      return <Tension />;
    case "voices":
      return <Voices />;
  }
}

/** Tres acordes como columnas de voces unidas por líneas (común, paso, salto). */
function Voices() {
  const chords = [
    [60, 64, 67],
    [60, 65, 69],
    [59, 62, 67],
  ];
  const y = (p: number) => 100 - (p - 57) * 7;
  const x = [50, 160, 270];
  const color = (a: number, b: number) => (a === b ? "var(--fn-tonic)" : Math.abs(a - b) <= 2 ? "#7ce36b" : "#ff9a4d");
  return (
    <svg viewBox="0 0 320 110" className="tip-svg">
      {chords.slice(0, -1).flatMap((c, i) =>
        c.map((p, k) => (
          <motion.path
            key={`${i}-${k}`}
            d={`M${x[i] + 16},${y(p)} C${x[i] + 60},${y(p)} ${x[i + 1] - 60},${y(chords[i + 1][k])} ${x[i + 1] - 16},${y(chords[i + 1][k])}`}
            fill="none"
            stroke={color(p, chords[i + 1][k])}
            strokeWidth={2.5}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: i * 0.4 + k * 0.1 }}
          />
        )),
      )}
      {chords.flatMap((c, i) => c.map((p) => <rect key={`${i}-${p}`} x={x[i] - 16} y={y(p) - 3} width={32} height={6} rx={3} fill="white" />))}
    </svg>
  );
}

/** Tónica abajo (casa), subdominante y dominante arriba; flechas T → S → D → T. */
function Gravity({ focus, lang }: { focus: keyof typeof FN | null; lang: string }) {
  const nodes = [
    { id: "tonic" as const, x: 160, y: 96, label: lang === "es" ? "Tónica" : "Tonic", chords: "I · vi · iii" },
    { id: "subdominant" as const, x: 62, y: 34, label: lang === "es" ? "Subdominante" : "Subdominant", chords: "IV · ii" },
    { id: "dominant" as const, x: 258, y: 34, label: lang === "es" ? "Dominante" : "Dominant", chords: "V · vii°" },
  ];
  return (
    <svg viewBox="0 0 320 130" className="tip-svg">
      <defs>
        <marker id="tip-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--text-2)" />
        </marker>
      </defs>
      <path d="M128,92 Q70,90 66,58" className="tip-flow" markerEnd="url(#tip-arrow)" />
      <path d="M96,26 Q160,4 224,26" className="tip-flow" markerEnd="url(#tip-arrow)" />
      <path d="M254,58 Q250,90 192,92" className="tip-flow strong" markerEnd="url(#tip-arrow)" />
      {nodes.map((n) => {
        const on = focus === n.id;
        return (
          <g key={n.id} opacity={focus && !on ? 0.45 : 1}>
            {on && (
              <motion.circle
                cx={n.x}
                cy={n.y}
                r={22}
                fill="none"
                stroke={FN[n.id]}
                initial={{ r: 20, opacity: 0.8 }}
                animate={{ r: 32, opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
            )}
            <circle cx={n.x} cy={n.y} r={on ? 20 : 16} fill={FN[n.id]} fillOpacity={0.25} stroke={FN[n.id]} strokeWidth={2} />
            <text x={n.x} y={n.y + 4} className="tip-node">
              {n.id === "tonic" ? "T" : n.id === "subdominant" ? "S" : "D"}
            </text>
            <text x={n.x} y={n.y + (n.id === "tonic" ? 30 : -24)} className="tip-caption" fill={FN[n.id]}>
              {n.label} · {n.chords}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const WHITE = [0, 2, 4, 5, 7, 9, 11, 12];
const BLACK: [number, number][] = [
  [1, 0],
  [3, 1],
  [6, 3],
  [8, 4],
  [10, 5],
];
const DEGREE_LABEL: Record<number, string> = { 1: "♭2", 6: "♯4 / ♭5", 8: "♭6", 9: "6", 10: "♭7", 11: "7" };

/** Teclado de una octava desde Do con las notas del modo y su nota característica. */
function ModeKeys({ scale, lang }: { scale: string; lang: string }) {
  const notes = new Set<number>([0]);
  let acc = 0;
  for (const s of scaleSteps(scale)) {
    acc += s;
    notes.add(acc % 12 === 0 ? 12 : acc);
  }
  const char = CHARACTERISTIC[scale];
  const charLabel = scale === "locrian" ? "♭5" : scale === "lydian" ? "♯4" : DEGREE_LABEL[char];
  const kw = 34;
  const brightness = BRIGHTNESS[scale] ?? 4;
  return (
    <svg viewBox="0 0 320 132" className="tip-svg">
      <g transform="translate(24,6)">
        {WHITE.map((pc, i) => {
          const on = notes.has(pc);
          const isChar = pc === char;
          return (
            <motion.rect
              key={pc}
              x={i * kw}
              y={0}
              width={kw - 3}
              height={70}
              rx={4}
              fill={isChar ? "var(--fn-dominant)" : on ? "var(--accent-2)" : "#2a2f45"}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: on || isChar ? 1 : 0.5, y: 0 }}
              transition={{ delay: i * 0.05 }}
            />
          );
        })}
        {BLACK.map(([pc, after]) => {
          const on = notes.has(pc);
          const isChar = pc === char;
          return (
            <rect
              key={pc}
              x={(after + 1) * kw - 11}
              y={0}
              width={20}
              height={42}
              rx={3}
              fill={isChar ? "var(--fn-dominant)" : on ? "var(--accent-2)" : "#0b0d16"}
              stroke="var(--line-strong)"
            />
          );
        })}
        {char !== undefined && (
          <text x={keyX(char, kw)} y={86} className="tip-caption" fill="var(--fn-dominant)">
            {charLabel} {lang === "es" ? "característica" : "signature"}
          </text>
        )}
      </g>
      {/* Medidor de brillo: de oscuro a brillante */}
      <defs>
        <linearGradient id="tip-bright" x1="0" x2="1">
          <stop offset="0" stopColor="#1b1530" />
          <stop offset="1" stopColor="#ffe9a8" />
        </linearGradient>
      </defs>
      <rect x={24} y={104} width={272} height={8} rx={4} fill="url(#tip-bright)" />
      <motion.circle
        cy={108}
        r={7}
        fill="white"
        stroke="var(--bg-0)"
        strokeWidth={2}
        initial={{ cx: 24 }}
        animate={{ cx: 24 + ((brightness - 1) / 6) * 272 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <text x={24} y={128} className="tip-caption start">
        {lang === "es" ? "oscuro" : "dark"}
      </text>
      <text x={296} y={128} className="tip-caption end">
        {lang === "es" ? "brillante" : "bright"}
      </text>
    </svg>
  );
}

function keyX(pc: number, kw: number): number {
  const w = WHITE.indexOf(pc);
  if (w >= 0) return w * kw + kw / 2;
  const b = BLACK.find(([p]) => p === pc);
  return b ? (b[1] + 1) * kw - 1 : 0;
}

/** Acorde mayor y menor: solo se mueve la tercera. */
function Third({ lang }: { lang: string }) {
  const triad = (x: number, third: number, label: string, color: string) => (
    <g transform={`translate(${x},10)`}>
      {[0, 2, 4, 5, 7].map((pc, i) => (
        <rect key={pc} x={i * 22} y={0} width={20} height={56} rx={3} fill={pc === 0 || pc === 7 || pc === third ? color : "#2a2f45"} />
      ))}
      <rect x={33} y={0} width={13} height={34} rx={2} fill={third === 3 ? color : "#0b0d16"} stroke="var(--line-strong)" />
      <motion.path
        d={`M10,70 Q${third === 4 ? 32 : 26},84 ${third === 4 ? 54 : 40},70`}
        fill="none"
        stroke={color}
        strokeWidth={2}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8 }}
      />
      <text x={55} y={100} className="tip-caption" fill={color}>
        {label}
      </text>
    </g>
  );
  return (
    <svg viewBox="0 0 320 116" className="tip-svg">
      {triad(30, 4, lang === "es" ? "Mayor · 4 semitonos" : "Major · 4 half steps", "var(--fn-subdominant)")}
      {triad(184, 3, lang === "es" ? "Menor · 3 semitonos" : "Minor · 3 half steps", "var(--fn-tonic)")}
    </svg>
  );
}

/** Muestra de filas del piano roll y su significado. */
function Roles({ lang }: { lang: string }) {
  const rows = [
    { fill: "rgba(69,217,255,0.35)", label: lang === "es" ? "Fundamental del acorde" : "Chord root" },
    { fill: "rgba(69,217,255,0.2)", label: lang === "es" ? "Nota del acorde: estable" : "Chord tone: stable" },
    { fill: "rgba(255,255,255,0.06)", label: lang === "es" ? "De la escala: de paso" : "Scale tone: passing" },
    { fill: "rgba(255,92,108,0.18)", label: lang === "es" ? "Fuera de escala: tensión" : "Outside: tension" },
  ];
  return (
    <svg viewBox="0 0 320 112" className="tip-svg">
      {rows.map((r, i) => (
        <g key={i} transform={`translate(16,${8 + i * 25})`}>
          <rect width={288} height={20} rx={4} fill={r.fill} />
          {i === 3 && <rect width={288} height={20} rx={4} fill="none" stroke="var(--danger)" strokeDasharray="3 3" />}
          <text x={10} y={14} className="tip-caption start" fill="var(--text-0)">
            {r.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Tres bloques unidos por arcos fuerte, medio y débil. */
function Arcs() {
  const blocks = [
    { x: 20, label: "G", color: FN.dominant },
    { x: 120, label: "C", color: FN.tonic },
    { x: 220, label: "F", color: FN.subdominant },
  ];
  return (
    <svg viewBox="0 0 320 110" className="tip-svg">
      <motion.path d="M50,44 Q100,6 150,44" className="tip-arc strong" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7 }} />
      <motion.path d="M150,44 Q200,14 250,44" className="tip-arc" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 0.3 }} />
      {blocks.map((b) => (
        <g key={b.label}>
          <rect x={b.x} y={50} width={80} height={50} rx={10} fill={b.color} fillOpacity={0.3} stroke={b.color} />
          <text x={b.x + 40} y={82} className="tip-node">
            {b.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Círculo de quintas con las 7 casillas de Do mayor encendidas. */
function Circle() {
  const names = ["C", "G", "D", "A", "E", "B", "F♯", "D♭", "A♭", "E♭", "B♭", "F"];
  const inKey = new Set(["F", "C", "G", "D", "A", "E", "B"]);
  return (
    <svg viewBox="-160 -62 320 124" className="tip-svg">
      {names.map((n, i) => {
        const a = ((i * 30 - 90) * Math.PI) / 180;
        const on = inKey.has(n);
        return (
          <motion.g key={n} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
            <circle cx={Math.cos(a) * 50} cy={Math.sin(a) * 50} r={11} fill={on ? "var(--accent)" : "#20253a"} fillOpacity={on ? 0.5 : 1} stroke={on ? "var(--accent)" : "var(--line)"} />
            <text x={Math.cos(a) * 50} y={Math.sin(a) * 50 + 3.5} className="tip-small">
              {n}
            </text>
          </motion.g>
        );
      })}
      <text x={0} y={4} className="tip-node">
        C
      </text>
    </svg>
  );
}

/** Acordes de Do mayor y, debajo, los prestados de Do menor. */
function Borrow() {
  const major = ["C", "Dm", "Em", "F", "G", "Am", "B°"];
  const minor = ["Cm", "D°", "E♭", "Fm", "Gm", "A♭", "B♭"];
  return (
    <svg viewBox="0 0 320 96" className="tip-svg">
      {major.map((c, i) => (
        <g key={c} transform={`translate(${12 + i * 43},10)`}>
          <rect width={38} height={30} rx={6} fill="#20253a" stroke="var(--line-strong)" />
          <text x={19} y={20} className="tip-small">
            {c}
          </text>
        </g>
      ))}
      {minor.map((c, i) => (
        <motion.g key={c} transform={`translate(${12 + i * 43},54)`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
          <rect width={38} height={30} rx={6} fill="var(--fn-subdominant)" fillOpacity={0.22} stroke="var(--fn-subdominant)" strokeDasharray="4 3" />
          <text x={19} y={20} className="tip-small">
            {c}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}

/** Una ola de tensión: bloques que suben y bajan. */
function Tension() {
  const bars = [
    { h: 0.25, c: FN.tonic },
    { h: 0.45, c: FN.subdominant },
    { h: 0.7, c: FN.dominant },
    { h: 0.92, c: FN.dominant },
    { h: 0.22, c: FN.tonic },
  ];
  return (
    <svg viewBox="0 0 320 104" className="tip-svg">
      {bars.map((b, i) => (
        <motion.rect
          key={i}
          x={20 + i * 58}
          width={50}
          rx={8}
          fill={b.c}
          fillOpacity={0.35}
          stroke={b.c}
          initial={{ y: 96, height: 0 }}
          animate={{ y: 96 - b.h * 88, height: b.h * 88 }}
          transition={{ delay: i * 0.08, type: "spring", stiffness: 160, damping: 14 }}
        />
      ))}
    </svg>
  );
}
