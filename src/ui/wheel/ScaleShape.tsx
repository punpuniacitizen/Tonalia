// "Escalas como formas": la escala de la tonalidad dibujada en el reloj cromático.
// Todos los modos de la mayor son la misma figura girada; lo que cambia es dónde está la tónica.

import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { Key } from "../../bindings/Key";
import type { Notation } from "../../bindings/Notation";
import { keyRootName } from "../../lib/music";
import { pitchName } from "../../lib/pitch";

export function ScaleShape({ keyScale, notation }: { keyScale: Key; notation: Notation }) {
  const { t } = useTranslation();
  const R = 52;
  const degrees: number[] = [];
  let acc = 0;
  for (const s of keyScale.scale.steps) {
    degrees.push((keyScale.root + acc) % 12);
    acc += s;
  }
  const pos = (pc: number, r = R): [number, number] => {
    const a = ((pc * 30 - 90) * Math.PI) / 180;
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  const pattern = keyScale.scale.steps.map((s) => (s === 1 ? t("scaleShape.half") : s === 2 ? t("scaleShape.whole") : `${s}½`)).join("·");

  return (
    <figure className="scale-shape" data-tip={`mode.${keyScale.scale.name}`}>
      <svg viewBox="-75 -72 150 144">
        <circle r={R} className="clock-ring" />
        <motion.polygon
          key={keyScale.root + keyScale.scale.name}
          points={degrees.map((pc) => pos(pc).join(",")).join(" ")}
          className="scale-poly"
          initial={{ rotate: -40, opacity: 0, scale: 0.7 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 15 }}
        />
        {Array.from({ length: 12 }, (_, pc) => {
          const [x, y] = pos(pc);
          const on = degrees.includes(pc);
          const [lx, ly] = pos(pc, R + 12);
          return (
            <g key={pc}>
              <circle cx={x} cy={y} r={pc === keyScale.root ? 5 : on ? 3.5 : 1.8} className={pc === keyScale.root ? "clock-root" : on ? "scale-on" : "clock-off"} />
              {on && (
                <text x={lx} y={ly + 3} className="scale-label">
                  {pitchName(pc, notation, false)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption>
        <strong>
          {keyRootName(keyScale.root, keyScale.scale.name, notation)} {t(`scale.${keyScale.scale.name}`)}
        </strong>
        <small>{pattern}</small>
      </figcaption>
    </figure>
  );
}
