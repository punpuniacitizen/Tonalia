import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { keyRootName, scaleSteps } from "../../lib/music";
import { useSelectedChord, useSong } from "../../stores/song";
import { useUi, type DockView, type WheelSource } from "../../stores/ui";
import { Segmented } from "../common/Segmented";
import { ChordLens } from "../lenses/ChordLens";
import { GravityMap } from "./GravityMap";
import { HarmonyWheel } from "./HarmonyWheel";
import { ScaleShape } from "./ScaleShape";
import { Tonnetz } from "./Tonnetz";
import "./HarmonyWheel.css";
import "./WheelDock.css";

const PARALLEL = ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian", "harmonicMinor", "melodicMinor"];

/** Zona inferior: leyenda de funciones, la rueda y de dónde se toman prestados los acordes. */
export function WheelDock() {
  const { t } = useTranslation();
  const view = useSong((s) => s.view);
  const selected = useSelectedChord();
  const { level, notation, wheelSource, dockView, set } = useUi();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(520);
  const ready = view !== null;

  // Se registra cuando el elemento ya existe (mientras carga, el componente no pinta nada).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      setSize(Math.max(180, Math.min(height - 40, width - 560, 680)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  if (!view) return null;
  const key = selected?.key ?? view.song.homeKey;
  const sameSteps = (name: string) => JSON.stringify(scaleSteps(name)) === JSON.stringify(key.scale.steps);
  const modes = PARALLEL.filter((m) => !sameSteps(m));
  const isActive = (s: WheelSource) => JSON.stringify(s) === JSON.stringify(wheelSource);

  return (
    <section className={`wheel-dock ${size < 340 ? "is-compact" : ""}`} ref={ref}>
      {selected ? (
        <div className="dock-side dock-legend">
          <ChordLens chord={selected} />
        </div>
      ) : (
        <aside className="dock-side dock-legend">
          <h2>{t("wheel.title")}</h2>
          {(["tonic", "subdominant", "dominant"] as const).map((fn) => (
            <div key={fn} className="legend-item" data-tip={`function.${fn}`} style={{ ["--fn" as string]: `var(--fn-${fn})` }}>
              <span className="dot" />
              <div>
                <strong>{t(`function.${fn}`)}</strong>
                {level !== "advanced" && <small>{t(`function.${fn}Hint`)}</small>}
              </div>
            </div>
          ))}
          <ScaleShape keyScale={key} notation={notation} />
          <p className="dock-hint">{t("wheel.hint")}</p>
          <p className="dock-hint tip-hint">{t("tips.hint")}</p>
        </aside>
      )}

      <div className="dock-center">
        <Segmented<DockView>
          label={t("dock.view")}
          value={dockView}
          onChange={(v) => set({ dockView: v })}
          options={[
            { value: "wheel", label: t("dock.wheel") },
            { value: "map", label: t("dock.map"), title: t("dock.mapHint") },
            { value: "tonnetz", label: "Tonnetz", title: t("dock.tonnetzHint") },
          ]}
        />
        {dockView === "wheel" && <HarmonyWheel size={size - 34} />}
        {dockView === "map" && <GravityMap size={Math.min(size * 1.25, 560)} />}
        {dockView === "tonnetz" && <Tonnetz size={Math.min(size * 1.6, 640)} />}
      </div>

      <aside className="dock-side dock-sources">
        <h3 data-tip="concept.borrow">{t("wheel.borrowFrom")}</h3>
        <div className="source-list">
          {modes.map((m) => (
            <button
              key={m}
              data-tip={`mode.${m}`}
              className={isActive({ kind: "mode", scale: m }) ? "is-active" : ""}
              onClick={() => set({ wheelSource: { kind: "mode", scale: m } })}
            >
              {t(`scale.${m}`)}
            </button>
          ))}
        </div>
        <h3 data-tip="concept.circle">{t("wheel.neighbors")}</h3>
        <div className="source-neighbors" data-tip="concept.circle">
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
