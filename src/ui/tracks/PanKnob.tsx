// Perilla de paneo: arrastrar arriba/abajo (o la rueda del ratón) la mueve entre izquierda y
// derecha; doble clic la vuelve al centro. El arco va del centro hacia el lado elegido.

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const SIZE = 22;
const R = 8;
/** La perilla gira 135° hacia cada lado. */
const SWEEP = 135;
/** Píxeles de arrastre para ir del centro a un extremo. */
const DRAG_RANGE = 70;

const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
const point = (deg: number, r = R): [number, number] => [SIZE / 2 + Math.cos(rad(deg)) * r, SIZE / 2 + Math.sin(rad(deg)) * r];

/** Paneo para mostrar: «C», «I 40», «D 100». */
export function panLabel(pan: number, left: string, right: string, center: string): string {
  const amount = Math.round(Math.abs(pan) * 100);
  if (amount === 0) return center;
  return `${pan < 0 ? left : right} ${amount}`;
}

export function PanKnob({ value, onChange }: { value: number; onChange: (pan: number) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<number | null>(null);
  const pan = draft ?? value;
  const ref = useRef<SVGSVGElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Rueda del ratón: pasos de 5 %, se confirma al instante.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = Math.max(-1, Math.min(1, Math.round((valueRef.current + (e.deltaY < 0 ? 0.05 : -0.05)) * 20) / 20));
      if (next !== valueRef.current) onChange(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onChange]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startY = e.clientY;
    const start = value;
    let current = start;
    const move = (ev: PointerEvent) => {
      // Cerca del centro «se pega» un poco, para encontrarlo fácil.
      let next = Math.max(-1, Math.min(1, start + (startY - ev.clientY) / DRAG_RANGE));
      if (Math.abs(next) < 0.04) next = 0;
      current = Math.round(next * 100) / 100;
      setDraft(current);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDraft(null);
      if (current !== start) onChange(current);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const angle = pan * SWEEP;
  const [x0, y0] = point(0);
  const [x1, y1] = point(angle);
  const [px, py] = point(angle, R - 3.5);
  const label = panLabel(pan, t("tracks.panLeft"), t("tracks.panRight"), t("tracks.panCenter"));

  return (
    <svg
      ref={ref}
      className={`pan-knob ${draft !== null ? "is-dragging" : ""}`}
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="slider"
      aria-label={t("tracks.pan")}
      aria-valuemin={-1}
      aria-valuemax={1}
      aria-valuenow={pan}
      aria-valuetext={label}
      onPointerDown={onPointerDown}
      onDoubleClick={() => value !== 0 && onChange(0)}
    >
      <title>{`${t("tracks.pan")}: ${label} · ${t("tracks.panHint")}`}</title>
      <path className="pan-track" d={`M${point(-SWEEP).join(",")} A${R},${R} 0 1 1 ${point(SWEEP).join(",")}`} />
      {pan !== 0 && <path className="pan-value" d={`M${x0},${y0} A${R},${R} 0 0 ${pan > 0 ? 1 : 0} ${x1},${y1}`} />}
      <circle className="pan-cap" cx={SIZE / 2} cy={SIZE / 2} r={R - 2.5} />
      <line className="pan-pointer" x1={SIZE / 2} y1={SIZE / 2} x2={px} y2={py} />
    </svg>
  );
}
