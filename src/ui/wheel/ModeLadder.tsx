// Selector de modos como escalera de brillo: del lidio (el más brillante, blanco) al locrio
// (el más oscuro, violeta). La tonalidad actual queda marcada en su peldaño y el modo elegido
// alimenta el anillo medio de la rueda. Para no recargar, la fórmula de cada modo (con su nota
// característica) solo se ve en el modo elegido y en el que está bajo el ratón.

import { useTranslation } from "react-i18next";

import type { Key } from "../../bindings/Key";
import { scaleSteps } from "../../lib/music";
import { useUi, type WheelSource } from "../../stores/ui";
import { CHARACTERISTIC } from "../../tips/tips";

/** De más brillante a más oscuro: cada peldaño baja una nota medio tono. */
const LADDER = ["lydian", "ionian", "mixolydian", "dorian", "aeolian", "phrygian", "locrian"];
/** Menores con la 7.ª (y la 6.ª) subidas: no están en la escalera de los modos griegos. */
const ALTERED = ["harmonicMinor", "melodicMinor"];

const MAJOR = [0, 2, 4, 5, 7, 9, 11];

const pcs = (scale: string) => {
  const out = [0];
  for (const s of scaleSteps(scale).slice(0, 6)) out.push(out[out.length - 1] + s);
  return out;
};

/** Fórmula del modo respecto de la mayor: dórico → ♭3 ♭7. La característica va marcada. */
function formula(scale: string): { label: string; signature: boolean }[] {
  const char = CHARACTERISTIC[scale];
  return pcs(scale).flatMap((pc, d) => {
    const diff = pc - MAJOR[d];
    if (diff === 0) return [];
    const label = `${diff < 0 ? "♭".repeat(-diff) : "♯".repeat(diff)}${d + 1}`;
    return [{ label, signature: pc === char }];
  });
}

const sameSteps = (a: string, steps: number[]) => JSON.stringify(scaleSteps(a)) === JSON.stringify(steps);

export function ModeLadder({ keyScale }: { keyScale: Key }) {
  const { t } = useTranslation();
  const { wheelSource, set } = useUi();

  const own = [...LADDER, ...ALTERED].find((m) => sameSteps(m, keyScale.scale.steps));
  const activeMode = wheelSource.kind === "mode" ? wheelSource.scale : null;
  const pick = (scale: string) => set({ wheelSource: { kind: "mode", scale } satisfies WheelSource, lastModeScale: scale });

  const row = (m: string) => {
    const isOwn = m === own;
    // Elegir el modo de la propia tonalidad = sin préstamos (el anillo medio queda vacío).
    const isActive = m === activeMode;
    return (
      <button
        key={m}
        className={`ladder-row ${isOwn ? "is-own" : ""} ${isActive ? "is-active" : ""}`}
        onClick={() => pick(m)}
        data-tip={`mode.${m}`}
        title={isOwn ? t("wheel.yourKeyHint") : undefined}
      >
        <span className="ladder-formula">
          {formula(m).length ? (
            formula(m).map((f) => (
              <span key={f.label} className={f.signature ? "is-signature" : ""}>
                {f.label}
              </span>
            ))
          ) : (
            <span>{t("wheel.majorFormula")}</span>
          )}
        </span>
        <span className="ladder-name">{t(`scale.${m}`)}</span>
        <span className="ladder-stop" aria-hidden="true" />
      </button>
    );
  };

  return (
    <div className="mode-ladder">
      <div className="ladder" style={{ ["--rows" as string]: LADDER.length }}>
        <span className="ladder-rail" aria-hidden="true" />
        <span className="ladder-end is-top" title={t("wheel.bright")} aria-label={t("wheel.bright")}>
          ☀
        </span>
        {LADDER.map(row)}
        <span className="ladder-end is-bottom" title={t("wheel.dark")} aria-label={t("wheel.dark")}>
          ☾
        </span>
      </div>
      <div className="ladder-altered">{ALTERED.map(row)}</div>
    </div>
  );
}
