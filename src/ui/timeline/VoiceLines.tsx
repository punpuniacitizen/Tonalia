// Conducción de voces: cada nota del voicing es un trazo dentro de su acorde y se une con
// la voz correspondiente del acorde siguiente. El color dice cuánto se mueve:
// igual = nota común, verde = paso (1–2 semitonos), naranja = salto.

import type { ChordView } from "../../bindings/ChordView";

type Geometry = { left: number; width: number };

function pair(a: number[], b: number[]): [number, number][] {
  // Mismo número de voces: de grave a agudo. Si no, cada voz va a la más cercana.
  if (a.length === b.length) return a.map((p, i) => [p, b[i]]);
  const [from, to, flip] = a.length > b.length ? [a, b, false] : [b, a, true];
  return from.map((p) => {
    const q = to.reduce((best, x) => (Math.abs(x - p) < Math.abs(best - p) ? x : best), to[0]);
    return flip ? [q, p] : [p, q];
  });
}

export function VoiceLines({ chords, geometry, height }: { chords: ChordView[]; geometry: Geometry[]; height: number }) {
  const all = chords.flatMap((c) => c.voicing.map((n) => n.pitch));
  if (!all.length) return null;
  const lo = Math.min(...all) - 2;
  const hi = Math.max(...all) + 2;
  const y = (p: number) => 14 + ((hi - p) / Math.max(1, hi - lo)) * (height - 28);
  const pitchesOf = (c: ChordView) => [...new Set(c.voicing.map((n) => n.pitch))].sort((a, b) => a - b);

  return (
    <svg className="voice-lines" width="100%" height={height} aria-hidden="true">
      {chords.map((c, i) => {
        const g = geometry[i];
        const ps = pitchesOf(c);
        return (
          <g key={`v${i}`}>
            {ps.map((p) => (
              <line key={p} x1={g.left + 10} x2={g.left + g.width - 6} y1={y(p)} y2={y(p)} className="voice-hold" />
            ))}
            {i + 1 < chords.length &&
              pair(ps, pitchesOf(chords[i + 1])).map(([a, b], k) => {
                const n = geometry[i + 1];
                const move = Math.abs(b - a);
                const cls = move === 0 ? "common" : move <= 2 ? "step" : "leap";
                const x1 = g.left + g.width - 6;
                const x2 = n.left + 10;
                return <path key={k} d={`M${x1},${y(a)} C${x1 + 12},${y(a)} ${x2 - 12},${y(b)} ${x2},${y(b)}`} className={`voice-move ${cls}`} />;
              })}
          </g>
        );
      })}
    </svg>
  );
}
