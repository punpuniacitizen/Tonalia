// Dibujo de una lección de herramientas: un mini piano roll «antes» y otro «después».

import { motion } from "motion/react";

import { TOOL_DEMOS, type DemoNote } from "../../learn/toolDemos";

const PANEL_W = 132;
const PANEL_H = 92;
const TOP = 10;
const LEFT = [10, 178];

function Panel({ x, notes, low, high, delay, chord, label, selectBox }: { x: number; notes: DemoNote[]; low: number; high: number; delay: number; chord?: string; label?: string; selectBox?: boolean }) {
  const rows = high - low + 1;
  const rh = PANEL_H / rows;
  const sx = PANEL_W / 16;
  const y = (p: number) => TOP + (high - p) * rh;
  const lo = Math.min(...notes.map((n) => n.p));
  const hi = Math.max(...notes.map((n) => n.p));
  return (
    <g>
      <rect x={x} y={TOP} width={PANEL_W} height={PANEL_H} rx={6} fill="#151a2b" stroke="#2a3150" />
      {[4, 8, 12].map((b) => (
        <line key={b} x1={x + b * sx} x2={x + b * sx} y1={TOP} y2={TOP + PANEL_H} stroke="#2a3150" strokeWidth={b === 8 ? 1 : 0.6} />
      ))}
      {chord && (
        <g>
          <rect x={x + 1} y={y(hi) - 4} width={PANEL_W - 2} height={(hi - lo + 1) * rh + 8} rx={4} fill="none" stroke="var(--fn-tonic)" strokeDasharray="3 2" />
          <text x={x + 5} y={y(hi) - 6} className="tip-caption" style={{ textAnchor: "start", fill: "var(--fn-tonic)" }}>
            {chord}
          </text>
        </g>
      )}
      {notes.map((n, i) => (
        <motion.rect
          key={i}
          x={x + n.t * sx + 0.5}
          y={y(n.p) + 0.5}
          width={Math.max(2, n.len * sx - 1)}
          height={Math.max(2, rh - 1)}
          rx={1.5}
          fill={n.off ? "var(--fn-dominant)" : "var(--accent-2)"}
          fillOpacity={0.35 + (n.v ?? 0.8) * 0.65}
          stroke={n.sel ? "#ffffff" : "none"}
          strokeWidth={n.sel ? 1 : 0}
          initial={{ opacity: 0, scaleX: 0.4 }}
          animate={{ opacity: 1, scaleX: 1 }}
          style={{ transformOrigin: `${x + n.t * sx}px center` }}
          transition={{ delay: delay + i * 0.03 }}
        />
      ))}
      {selectBox && (
        <motion.rect
          x={x + 3}
          y={y(hi) - 4}
          width={PANEL_W - 6}
          height={(hi - lo + 1) * rh + 8}
          rx={4}
          fill="var(--accent)"
          fillOpacity={0.12}
          stroke="var(--accent)"
          strokeDasharray="4 3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.3 }}
        />
      )}
      {label && (
        <text x={x + PANEL_W - 6} y={TOP + 12} className="tip-small" style={{ textAnchor: "end" }}>
          {label}
        </text>
      )}
    </g>
  );
}

export function ToolDemoView({ tool, lang }: { tool: string; lang: "es" | "en" }) {
  const demo = TOOL_DEMOS[tool];
  if (!demo) return null;
  const all = [...demo.before, ...demo.after];
  const low = Math.min(...all.map((n) => n.p)) - 1;
  const high = Math.max(...all.map((n) => n.p)) + 2;
  const es = lang === "es";
  return (
    <svg viewBox="0 0 320 124" className="tip-svg">
      <Panel x={LEFT[0]} notes={demo.before} low={low} high={high} delay={0} chord={demo.beforeChord} selectBox={demo.selectBox} />
      <Panel x={LEFT[1]} notes={demo.after} low={low} high={high} delay={0.45} label={demo.afterLabel} />
      <motion.path d="M150 56 h18 m-6 -6 l6 6 l-6 6" fill="none" stroke="var(--text-2)" strokeWidth={1.6} strokeLinecap="round" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} />
      <text x={LEFT[0] + PANEL_W / 2} y={118} className="tip-caption">
        {es ? "antes" : "before"}
      </text>
      <text x={LEFT[1] + PANEL_W / 2} y={118} className="tip-caption">
        {es ? "después" : "after"}
      </text>
    </svg>
  );
}
