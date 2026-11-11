// Ilustraciones de los tips: pequeños SVG animados que explican sin palabras.

import { motion } from "motion/react";

import { BRIGHTNESS, CHARACTERISTIC, type TipVisual } from "../../tips/tips";
import { scaleOffsets, scaleSteps } from "../../lib/music";
import { ToolDemoView } from "./ToolDemoView";

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
    case "tonnetz":
      return <TonnetzMini />;
    case "extensions":
      return <ThirdsTower />;
    case "reharm":
      return <Reharm lang={lang} />;
    case "notes":
      return <Notes lang={lang} />;
    case "triad":
      return <Triad lang={lang} />;
    case "diatonic":
      return <Diatonic />;
    case "subdivision":
      return <Subdivision lang={lang} />;
    case "modulation":
      return <Modulation lang={lang} />;
    case "worldScales":
      return <WorldScales lang={lang} />;
    case "tool":
      return <ToolDemoView tool={visual.tool} lang={lang} />;
  }
}

/** Un acorde en el centro y sus sustitutos alrededor, unidos por lo que comparten. */
function Reharm({ lang }: { lang: string }) {
  const es = lang === "es";
  const subs = [
    { x: 60, y: 28, chord: "Am", kind: es ? "relativo" : "relative", fn: FN.tonic },
    { x: 260, y: 28, chord: "Fm", kind: es ? "préstamo" : "borrowed", fn: FN.subdominant },
    { x: 60, y: 92, chord: "D♭7", kind: es ? "tritonal" : "tritone", fn: FN.dominant },
    { x: 260, y: 92, chord: "C7", kind: es ? "V7 antes" : "V7 before", fn: FN.dominant },
  ];
  return (
    <svg viewBox="0 0 320 120" className="tip-svg">
      {subs.map((s, i) => (
        <motion.line key={`l${s.chord}`} x1={160} y1={60} x2={s.x} y2={s.y} stroke={s.fn} strokeWidth={1.5} strokeDasharray="4 3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.15 * i }} />
      ))}
      <rect x={128} y={44} width={64} height={32} rx={10} fill="var(--fn-subdominant)" fillOpacity={0.35} stroke="var(--fn-subdominant)" />
      <text x={160} y={65} className="tip-node">
        F
      </text>
      {subs.map((s, i) => (
        <motion.g key={s.chord} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + 0.15 * i }}>
          <rect x={s.x - 34} y={s.y - 16} width={68} height={30} rx={8} fill={s.fn} fillOpacity={0.22} stroke={s.fn} />
          <text x={s.x} y={s.y - 1} className="tip-small">
            {s.chord}
          </text>
          <text x={s.x} y={s.y + 10} className="tip-caption" style={{ fontSize: 8 }}>
            {s.kind}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}

/** Torre de terceras: C E G B D F A, de la fundamental a la trecena. */
function ThirdsTower() {
  const steps = [
    { n: "C", d: "1", core: true },
    { n: "E", d: "3", core: true },
    { n: "G", d: "5", core: true },
    { n: "B", d: "7", core: true },
    { n: "D", d: "9", core: false },
    { n: "F", d: "11", core: false },
    { n: "A", d: "13", core: false },
  ];
  return (
    <svg viewBox="0 0 320 120" className="tip-svg">
      {steps.map((s, i) => (
        <motion.g key={s.d} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.09 }}>
          <rect x={18 + i * 42} y={100 - i * 13 - 16} width={38} height={16} rx={5} fill={s.core ? "var(--fn-tonic)" : "var(--accent-2)"} fillOpacity={0.35} stroke={s.core ? "var(--fn-tonic)" : "var(--accent-2)"} />
          <text x={37 + i * 42} y={100 - i * 13 - 4} className="tip-small">
            {s.n} · {s.d}
          </text>
        </motion.g>
      ))}
      <text x={60} y={116} className="tip-caption">
        tríada + 7ª
      </text>
      <text x={230} y={20} className="tip-caption" fill="var(--accent-2)">
        9 · 11 · 13
      </text>
    </svg>
  );
}

/** Do mayor y sus tres vecinos P, R y L en la red. */
function TonnetzMini() {
  const W = 46;
  const H = 40;
  const p = (i: number, j: number): [number, number] => [160 + (i + j * 0.5 - 1.5) * W, 70 - j * H];
  const tri = (a: [number, number], b: [number, number], c: [number, number]) => [a, b, c].map((q) => q.join(",")).join(" ");
  const nodes: [number, number, string][] = [
    [0, 0, "C"],
    [1, 0, "G"],
    [0, 1, "E"],
    [1, 1, "B"],
    [-1, 1, "A"],
    [2, 0, "D"],
    [-1, 0, "F"],
  ];
  return (
    <svg viewBox="0 0 320 110" className="tip-svg">
      <polygon points={tri(p(0, 0), p(1, 0), p(0, 1))} fill="var(--fn-tonic)" fillOpacity={0.45} stroke="white" />
      <motion.polygon points={tri(p(1, 0), p(0, 1), p(1, 1))} fill="var(--fn-tonic)" fillOpacity={0.2} stroke="var(--fn-tonic)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} />
      <motion.polygon points={tri(p(0, 0), p(0, 1), p(-1, 1))} fill="var(--fn-tonic)" fillOpacity={0.2} stroke="var(--fn-tonic)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} />
      {nodes.map(([i, j, n]) => {
        const [x, y] = p(i, j);
        return (
          <g key={n}>
            <circle cx={x} cy={y} r={11} fill="#20253a" stroke="var(--line-strong)" />
            <text x={x} y={y + 4} className="tip-small">
              {n}
            </text>
          </g>
        );
      })}
      <text x={160} y={104} className="tip-caption">
        C · Em (L) · Am (R)
      </text>
    </svg>
  );
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
const DEGREE_LABEL: Record<number, string> = { 1: "♭2", 3: "♭3", 6: "♯4 / ♭5", 8: "♭6", 9: "6", 10: "♭7", 11: "7" };

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
        <g key={c} transform={`translate(${12 + i * 43},54)`}>
          <motion.g initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
          <rect width={38} height={30} rx={6} fill="var(--fn-subdominant)" fillOpacity={0.22} stroke="var(--fn-subdominant)" strokeDasharray="4 3" />
          <text x={19} y={20} className="tip-small">
            {c}
          </text>
        </motion.g>
        </g>
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

/** Una octava con sus 12 notas numeradas, un semitono y un tono. */
function Notes({ lang }: { lang: string }) {
  const es = lang === "es";
  const kw = 34;
  return (
    <svg viewBox="0 0 320 128" className="tip-svg">
      <g transform="translate(24,24)">
        {WHITE.map((pc, i) => (
          <motion.rect key={pc} x={i * kw} y={0} width={kw - 3} height={66} rx={4} fill="#2a2f45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} />
        ))}
        {BLACK.map(([pc, after]) => (
          <rect key={pc} x={(after + 1) * kw - 11} y={0} width={20} height={40} rx={3} fill="#0b0d16" stroke="var(--line-strong)" />
        ))}
        {Array.from({ length: 13 }, (_, pc) => (
          <motion.text key={pc} x={keyX(pc, kw)} y={WHITE.includes(pc) ? 60 : 32} className="tip-small" fill={pc === 0 || pc === 12 ? "var(--accent-2)" : "var(--text-1)"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + pc * 0.05 }}>
            {pc === 12 ? "1" : pc + 1}
          </motion.text>
        ))}
        {/* Semitono: Mi → Fa. Tono: Do → Re. */}
        <path d={`M${keyX(4, kw)},-4 Q${(keyX(4, kw) + keyX(5, kw)) / 2},-16 ${keyX(5, kw)},-4`} className="tip-arc strong" />
        <text x={(keyX(4, kw) + keyX(5, kw)) / 2} y={-18} className="tip-caption" fill="var(--fn-dominant)">
          {es ? "semitono" : "half step"}
        </text>
        <path d={`M${keyX(0, kw)},-4 Q${keyX(1, kw)},-16 ${keyX(2, kw)},-4`} className="tip-arc" />
        <text x={keyX(1, kw)} y={-18} className="tip-caption">
          {es ? "tono" : "whole step"}
        </text>
        <path d={`M${keyX(0, kw)},78 L${keyX(0, kw)},84 L${keyX(12, kw)},84 L${keyX(12, kw)},78`} fill="none" stroke="var(--accent-2)" strokeWidth={1.5} />
        <text x={keyX(6, kw)} y={98} className="tip-caption" fill="var(--accent-2)">
          {es ? "octava: 12 semitonos" : "octave: 12 half steps"}
        </text>
      </g>
    </svg>
  );
}

/** Do-Mi-Sol en el teclado: se salta una nota de la escala entre cada voz. */
function Triad({ lang }: { lang: string }) {
  const es = lang === "es";
  const kw = 34;
  const tones: Record<number, string> = { 0: es ? "fundamental" : "root", 4: es ? "3ª" : "3rd", 7: es ? "5ª" : "5th" };
  return (
    <svg viewBox="0 0 320 124" className="tip-svg">
      <g transform="translate(24,6)">
        {WHITE.map((pc, i) => {
          const on = pc in tones;
          return (
            <motion.rect
              key={pc}
              x={i * kw}
              y={0}
              width={kw - 3}
              height={66}
              rx={4}
              fill={pc === 0 ? "var(--fn-tonic)" : on ? "var(--accent-2)" : "#2a2f45"}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: on ? 1 : 0.45 }}
              transition={{ delay: on ? 0.2 + pc * 0.06 : 0 }}
            />
          );
        })}
        {BLACK.map(([pc, after]) => (
          <rect key={pc} x={(after + 1) * kw - 11} y={0} width={20} height={40} rx={3} fill="#0b0d16" stroke="var(--line-strong)" />
        ))}
        {[
          [0, 4],
          [4, 7],
        ].map(([a, b], i) => (
          <motion.path
            key={a}
            d={`M${keyX(a, kw)},72 Q${(keyX(a, kw) + keyX(b, kw)) / 2},88 ${keyX(b, kw)},72`}
            className="tip-arc"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.5 + i * 0.3, duration: 0.5 }}
          />
        ))}
        {Object.entries(tones).map(([pc, label]) => (
          <text key={pc} x={keyX(Number(pc), kw)} y={104} className="tip-caption" fill={pc === "0" ? "var(--fn-tonic)" : "var(--accent-2)"}>
            {label}
          </text>
        ))}
        <text x={keyX(2, kw)} y={58} className="tip-small" fill="var(--text-2)">
          ✕
        </text>
        <text x={keyX(5, kw)} y={58} className="tip-small" fill="var(--text-2)">
          ✕
        </text>
        <text x={keyX(11, kw)} y={104} className="tip-caption" fill="var(--text-2)">
          {es ? "✕ se salta" : "✕ skipped"}
        </text>
      </g>
    </svg>
  );
}

/** Los 7 acordes de Do mayor con su grado y su función. */
function Diatonic() {
  const chords = [
    { n: "C", r: "I", fn: FN.tonic },
    { n: "Dm", r: "ii", fn: FN.subdominant },
    { n: "Em", r: "iii", fn: FN.tonic },
    { n: "F", r: "IV", fn: FN.subdominant },
    { n: "G", r: "V", fn: FN.dominant },
    { n: "Am", r: "vi", fn: FN.tonic },
    { n: "B°", r: "vii°", fn: FN.dominant },
  ];
  return (
    <svg viewBox="0 0 320 96" className="tip-svg">
      {chords.map((c, i) => (
        <g key={c.n} transform={`translate(${10 + i * 43.5},14)`}>
          <motion.g initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
          <rect width={39} height={40} rx={7} fill={c.fn} fillOpacity={0.25} stroke={c.fn} />
          <text x={19.5} y={25} className="tip-small" fill="var(--text-0)">
            {c.n}
          </text>
          <text x={19.5} y={64} className="tip-caption" fill={c.fn}>
            {c.r}
          </text>
        </motion.g>
        </g>
      ))}
    </svg>
  );
}

/** Un compás de 4 pulsos partido en dos (binaria) y en tres (ternaria). */
function Subdivision({ lang }: { lang: string }) {
  const es = lang === "es";
  const rows = [
    { y: 34, per: 2, label: es ? "binaria · 1/8" : "binary · 1/8", color: "var(--accent-2)" },
    { y: 86, per: 3, label: es ? "ternaria · 1/12" : "ternary · 1/12", color: "var(--accent)" },
  ];
  const x0 = 24;
  const width = 272;
  return (
    <svg viewBox="0 0 320 118" className="tip-svg">
      {rows.map((r) => (
        <g key={r.per}>
          <line x1={x0} x2={x0 + width} y1={r.y} y2={r.y} stroke="var(--line-strong)" />
          {Array.from({ length: 4 * r.per + 1 }, (_, i) => {
            const x = x0 + (i * width) / (4 * r.per);
            const onBeat = i % r.per === 0;
            return <line key={i} x1={x} x2={x} y1={r.y - (onBeat ? 9 : 5)} y2={r.y + (onBeat ? 9 : 5)} stroke={onBeat ? "var(--text-1)" : "var(--line-strong)"} />;
          })}
          {Array.from({ length: 4 * r.per }, (_, i) => (
            <motion.circle
              key={`n${i}`}
              cx={x0 + (i * width) / (4 * r.per) + 1}
              cy={r.y}
              r={i % r.per === 0 ? 5 : 3.5}
              fill={r.color}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * i + (r.per === 3 ? 0.4 : 0) }}
            />
          ))}
          <text x={x0} y={r.y - 15} className="tip-caption start" fill={r.color}>
            {r.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Do mayor y Sol mayor como dos círculos: en la intersección, los acordes que comparten. */
function Modulation({ lang }: { lang: string }) {
  const es = lang === "es";
  const onlyC = ["F", "B°"];
  const shared = ["C", "Em", "Am", "G"];
  const onlyG = ["D", "F♯°"];
  return (
    <svg viewBox="0 0 320 124" className="tip-svg">
      <motion.circle cx={122} cy={62} r={54} fill="var(--fn-tonic)" fillOpacity={0.12} stroke="var(--fn-tonic)" initial={{ cx: 104 }} animate={{ cx: 122 }} transition={{ duration: 0.6 }} />
      <motion.circle cx={198} cy={62} r={54} fill="var(--accent-2)" fillOpacity={0.12} stroke="var(--accent-2)" initial={{ cx: 216 }} animate={{ cx: 198 }} transition={{ duration: 0.6 }} />
      <text x={92} y={18} className="tip-caption" fill="var(--fn-tonic)">
        {es ? "Do mayor" : "C major"}
      </text>
      <text x={228} y={18} className="tip-caption" fill="var(--accent-2)">
        {es ? "Sol mayor" : "G major"}
      </text>
      {onlyC.map((c, i) => (
        <text key={c} x={92} y={56 + i * 18} className="tip-small">
          {c}
        </text>
      ))}
      {shared.map((c, i) => (
        <motion.text key={c} x={160} y={38 + i * 17} className="tip-small" fill={c === "Am" ? "var(--accent-2)" : "var(--text-0)"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.1 }}>
          {c}
        </motion.text>
      ))}
      {onlyG.map((c, i) => (
        <text key={c} x={230} y={56 + i * 18} className="tip-small">
          {c}
        </text>
      ))}
      <text x={160} y={118} className="tip-caption">
        {es ? "pivotes: acordes en común" : "pivots: shared chords"}
      </text>
    </svg>
  );
}

/** Cuatro escalas como recortes de las 12 notas: cada tradición elige las suyas. */
function WorldScales({ lang }: { lang: string }) {
  const es = lang === "es";
  const rows = [
    { scale: "majorPentatonic", label: es ? "pentatónica" : "pentatonic" },
    { scale: "phrygianDominant", label: "Hijaz" },
    { scale: "blues", label: "blues" },
    { scale: "wholeTone", label: es ? "tonos enteros" : "whole tone" },
  ];
  return (
    <svg viewBox="0 0 320 124" className="tip-svg">
      {rows.map((r, row) => {
        const on = new Set(scaleOffsets(scaleSteps(r.scale)));
        const y = 18 + row * 28;
        return (
          <g key={r.scale}>
            <text x={92} y={y + 4} className="tip-small" style={{ textAnchor: "end" }}>
              {r.label}
            </text>
            {Array.from({ length: 12 }, (_, pc) => (
              <motion.circle
                key={pc}
                cx={104 + pc * 17}
                cy={y}
                r={6}
                fill={on.has(pc) ? (pc === 0 ? "var(--fn-tonic)" : "var(--accent-2)") : "#2a2f45"}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: row * 0.12 + pc * 0.02 }}
              />
            ))}
          </g>
        );
      })}
      <text x={204} y={120} className="tip-caption">
        {es ? "las 12 notas, cuatro recortes" : "12 notes, four selections"}
      </text>
    </svg>
  );
}
