import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { keyRootName, scaleSteps } from "../../lib/music";
import { useSelectedChord, useSong } from "../../stores/song";
import { useUi, type WheelSource } from "../../stores/ui";
import { ChordLens } from "../lenses/ChordLens";
import { HarmonyWheel } from "./HarmonyWheel";
import "./HarmonyWheel.css";
import "./WheelDock.css";

const PARALLEL = ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian", "harmonicMinor", "melodicMinor"];

/** Zona inferior: leyenda de funciones, la rueda y de dónde se toman prestados los acordes. */
export function WheelDock() {
  const { t } = useTranslation();
  const view = useSong((s) => s.view);
  const selected = useSelectedChord();
  const { level, notation, wheelSource, set } = useUi();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(520);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      setSize(Math.max(320, Math.min(height - 48, width - 560, 680)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!view) return null;
  const key = selected?.key ?? view.song.homeKey;
  const sameSteps = (name: string) => JSON.stringify(scaleSteps(name)) === JSON.stringify(key.scale.steps);
  const modes = PARALLEL.filter((m) => !sameSteps(m));
  const isActive = (s: WheelSource) => JSON.stringify(s) === JSON.stringify(wheelSource);

  return (
    <section className="wheel-dock" ref={ref}>
      {selected ? (
        <div className="dock-side dock-legend">
          <ChordLens chord={selected} />
        </div>
      ) : (
        <aside className="dock-side dock-legend">
          <h2>{t("wheel.title")}</h2>
          {(["tonic", "subdominant", "dominant"] as const).map((fn) => (
            <div key={fn} className="legend-item" style={{ ["--fn" as string]: `var(--fn-${fn})` }}>
              <span className="dot" />
              <div>
                <strong>{t(`function.${fn}`)}</strong>
                {level !== "advanced" && <small>{t(`function.${fn}Hint`)}</small>}
              </div>
            </div>
          ))}
          <p className="dock-hint">{t("wheel.hint")}</p>
        </aside>
      )}

      <HarmonyWheel size={size} />

      <aside className="dock-side dock-sources">
        <h3>{t("wheel.borrowFrom")}</h3>
        <div className="source-list">
          {modes.map((m) => (
            <button key={m} className={isActive({ kind: "mode", scale: m }) ? "is-active" : ""} onClick={() => set({ wheelSource: { kind: "mode", scale: m } })}>
              {t(`scale.${m}`)}
            </button>
          ))}
        </div>
        <h3>{t("wheel.neighbors")}</h3>
        <div className="source-neighbors">
          <button className={isActive({ kind: "left" }) ? "is-active" : ""} onClick={() => set({ wheelSource: { kind: "left" } })}>
            ◀ {keyRootName((key.root + 5) % 12, key.scale.name, notation)}
          </button>
          <button className={isActive({ kind: "right" }) ? "is-active" : ""} onClick={() => set({ wheelSource: { kind: "right" } })}>
            {keyRootName((key.root + 7) % 12, key.scale.name, notation)} ▶
          </button>
        </div>
      </aside>
    </section>
  );
}
