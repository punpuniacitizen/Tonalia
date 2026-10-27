// La escala de la tonalidad en un teclado de dos octavas, para tocarla en un piano de verdad.
// Se abre con clic derecho sobre el nombre de la escala (Mi mayor) y se cierra al hacer clic fuera.

import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, melodySequence } from "../../api";
import type { Key } from "../../bindings/Key";
import type { Notation } from "../../bindings/Notation";
import { keyRootName, scaleNoteNames, scaleOffsets } from "../../lib/music";
import { Icon } from "../common/Icon";

/** Primera tecla: Do central; se dibujan dos octavas y el Do de arriba. */
const START = 60;
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const WHITE_W = 34;
const WHITE_H = 132;
const BLACK_W = 22;
const BLACK_H = 82;
const WIDTH = 15 * WHITE_W;

type PianoKey = { pitch: number; x: number; black: boolean };

/** Teclas de dos octavas desde Do, con su posición horizontal. */
function layout(): PianoKey[] {
  const keys: PianoKey[] = [];
  let white = 0;
  for (let pitch = START; pitch <= START + 24; pitch++) {
    const pc = pitch % 12;
    if (WHITE_PCS.includes(pc)) keys.push({ pitch, x: white++ * WHITE_W, black: false });
    else keys.push({ pitch, x: white * WHITE_W - BLACK_W / 2, black: true });
  }
  return keys;
}
const KEYS = layout();

export function ScalePiano({ keyScale, notation, at, onClose }: { keyScale: Key; notation: Notation; at: { x: number; y: number }; onClose: () => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  const offsets = scaleOffsets(keyScale.scale.steps);
  const names = scaleNoteNames(keyScale, notation);
  const degreeOf = (pitch: number) => offsets.indexOf((pitch - keyScale.root + 120) % 12);
  const title = `${keyRootName(keyScale.root, keyScale.scale.name, notation)} ${t(`scale.${keyScale.scale.name}`)}`;

  // Se queda dentro de la ventana: arriba del clic si no cabe abajo.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const left = Math.max(12, Math.min(at.x - 40, window.innerWidth - el.offsetWidth - 12));
    const top = at.y + el.offsetHeight + 16 < window.innerHeight ? at.y + 12 : Math.max(12, at.y - el.offsetHeight - 12);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [at]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
      timers.current.forEach(clearTimeout);
    };
  }, [onClose]);

  const playKey = (pitch: number) => {
    void api.previewNotes([pitch], 0.8, "piano", 0.9);
    setLit(pitch);
    timers.current.push(window.setTimeout(() => setLit((p) => (p === pitch ? null : p)), 350));
  };

  /** La escala subiendo desde la tónica hasta su octava, tecla por tecla. */
  const playScale = () => {
    const first = START + keyScale.root;
    const pitches = [...offsets.map((o) => first + o), first + 12];
    const step = 0.32;
    void api.previewSequence(melodySequence(pitches, step), "piano");
    timers.current.forEach(clearTimeout);
    timers.current = pitches.map((p, i) => window.setTimeout(() => setLit(p), i * step * 1000));
    timers.current.push(window.setTimeout(() => setLit(null), pitches.length * step * 1000 + 200));
  };

  const keyClass = (k: PianoKey) => {
    const d = degreeOf(k.pitch);
    return ["sp-key", k.black ? "is-black" : "is-white", d === 0 ? "is-tonic" : d > 0 ? "is-on" : "", lit === k.pitch ? "is-lit" : ""].join(" ");
  };

  const label = (k: PianoKey) => {
    const d = degreeOf(k.pitch);
    if (d < 0) return null;
    const cx = k.x + (k.black ? BLACK_W : WHITE_W) / 2;
    const y = k.black ? BLACK_H - 8 : WHITE_H - 10;
    return (
      <g key={`l${k.pitch}`} className={`sp-label ${k.black ? "is-black" : ""}`} pointerEvents="none">
        <text x={cx} y={y}>
          {names[d]}
        </text>
        <text x={cx} y={y - (k.black ? 14 : 15)} className="sp-degree">
          {d + 1}
        </text>
      </g>
    );
  };

  const whites = KEYS.filter((k) => !k.black);
  const blacks = KEYS.filter((k) => k.black);

  return (
    <motion.div
      ref={ref}
      className="scale-piano glass"
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.16 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <header>
        <div>
          <strong>{title}</strong>
          <small>{t("scalePiano.subtitle")}</small>
        </div>
        <button className="icon-button" onClick={onClose} title={t("tips.close")}>
          <Icon name="plus" size={16} />
        </button>
      </header>
      <svg viewBox={`-1 -1 ${WIDTH + 2} ${WHITE_H + 2}`} width={WIDTH + 2} height={WHITE_H + 2}>
        {whites.map((k) => (
          <rect key={k.pitch} x={k.x} y={0} width={WHITE_W - 2} height={WHITE_H} rx={4} className={keyClass(k)} onPointerDown={() => playKey(k.pitch)} />
        ))}
        {whites.map(label)}
        {blacks.map((k) => (
          <rect key={k.pitch} x={k.x} y={0} width={BLACK_W} height={BLACK_H} rx={3} className={keyClass(k)} onPointerDown={() => playKey(k.pitch)} />
        ))}
        {blacks.map(label)}
      </svg>
      <footer>
        <button className="ghost-button small" onClick={playScale}>
          <Icon name="play" size={12} filled /> {t("scalePiano.play")}
        </button>
        <span className="sp-legend">
          <i className="is-tonic" /> {t("scalePiano.tonic")}
          <i className="is-on" /> {t("scalePiano.inScale")}
        </span>
      </footer>
    </motion.div>
  );
}
