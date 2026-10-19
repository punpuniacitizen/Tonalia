import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { keyRootName } from "../../lib/music";
import { useSelectedChord, useSong } from "../../stores/song";
import { useUi, type DockView, type WheelSource } from "../../stores/ui";
import { Icon } from "../common/Icon";
import { Segmented } from "../common/Segmented";
import { ChordLens } from "../lenses/ChordLens";
import { GravityMap, MAP_RATIO } from "./GravityMap";
import { HarmonyWheel } from "./HarmonyWheel";
import { ModeLadder } from "./ModeLadder";
import { ScaleShape } from "./ScaleShape";
import { Tonnetz, TONNETZ_CONTROLS, TONNETZ_RATIO } from "./Tonnetz";
import "./HarmonyWheel.css";
import "./WheelDock.css";

/** Zona inferior: leyenda y tonalidad (con sus vecinas), la rueda y la escalera de modos. */
export function WheelDock() {
  const { t } = useTranslation();
  const view = useSong((s) => s.view);
  const selected = useSelectedChord();
  const { level, notation, wheelSource, lastModeScale, dockView, showTensions, harmonyFocus, set } = useUi();
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 1200, height: 560 });
  const ready = view !== null;

  // Se registra cuando el elemento ya existe (mientras carga, el componente no pinta nada).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      setBox({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  if (!view) return null;
  // Espacio para la vista central: lo que dejan las columnas laterales, el relleno y la fila
  // de botones. La rueda es cuadrada; el mapa y el Tonnetz son apaisados y se ajustan al alto.
  // Las columnas laterales crecen con el muelle (al ampliar o arrastrar el divisor), sin
  // pasar de lo que deja libre el ancho de la ventana.
  // Tope por alto: la leyenda (funciones, escala y vecinas) mide unos 390 px a escala 1.
  const sideScale = Math.max(1, Math.min(1 + (box.height - 340) / 500, 1.45, (box.width * 0.5) / 560, (box.height - 40) / 390));
  const sides = 560 * sideScale;
  const size = Math.max(180, Math.min(box.height - 40, box.width - sides, 680));
  const viewWidth = Math.max(240, box.width - sides);
  const viewHeight = Math.max(160, box.height - 30 - 40);
  const mapWidth = Math.min(viewWidth, viewHeight / MAP_RATIO, 680);
  const tonnetzWidth = Math.min(viewWidth, (viewHeight - TONNETZ_CONTROLS) / TONNETZ_RATIO, 760);
  const key = selected?.key ?? view.song.homeKey;
  const isActive = (s: WheelSource) => JSON.stringify(s) === JSON.stringify(wheelSource);
  // Vecinas: un clic las activa y otro clic (o «volver») regresa al último modo elegido.
  const toggleNeighbor = (kind: "left" | "right") => {
    if (isActive({ kind })) return set({ wheelSource: { kind: "mode", scale: lastModeScale } });
    set({
      wheelSource: { kind },
      ...(wheelSource.kind === "mode" ? { lastModeScale: wheelSource.scale } : {}),
    });
  };
  const onNeighbor = wheelSource.kind !== "mode";

  return (
    <section className={`wheel-dock ${size < 340 ? "is-compact" : ""}`} ref={ref} style={{ ["--side-scale" as string]: sideScale.toFixed(3) }}>
      {selected ? (
        <div className="dock-side dock-legend">
          <FitHeight widen>
            <ChordLens chord={selected} />
          </FitHeight>
        </div>
      ) : (
        <aside className="dock-side dock-legend">
          <FitHeight>
            <h3>{t("wheel.title")}</h3>
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
            <div className="source-neighbors" data-tip="concept.circle">
              <span>{t("wheel.neighbors")}</span>
              <button className={isActive({ kind: "left" }) ? "is-active" : ""} onClick={() => toggleNeighbor("left")}>
                ◀ {keyRootName((key.root + 5) % 12, key.scale.name, notation)}
              </button>
              <button className={isActive({ kind: "right" }) ? "is-active" : ""} onClick={() => toggleNeighbor("right")}>
                {keyRootName((key.root + 7) % 12, key.scale.name, notation)} ▶
              </button>
              {onNeighbor && (
                <button
                  className="neighbor-back"
                  onClick={() => set({ wheelSource: { kind: "mode", scale: lastModeScale } })}
                  title={t("wheel.backToModesHint")}
                >
                  ↩ {t(`scale.${lastModeScale}`)}
                </button>
              )}
            </div>
          </FitHeight>
        </aside>
      )}

      <div className="dock-center">
        <div className="dock-view-row">
          <Segmented<DockView>
            label={t("dock.view")}
            value={dockView}
            onChange={(v) => set({ dockView: v })}
            options={[
              { value: "wheel", label: t("dock.wheel") },
              { value: "map", label: t("dock.map"), title: t("dock.mapHint") },
              {
                value: "tonnetz",
                label: "Tonnetz",
                title: t("dock.tonnetzHint"),
              },
            ]}
          />
          {dockView !== "wheel" && (
            <button
              className={`tension-toggle ${showTensions ? "is-on" : ""}`}
              onClick={() => set({ showTensions: !showTensions })}
              title={t("tensions.toggleHint")}
              data-tip="concept.extensions"
              aria-pressed={showTensions}
            >
              <Icon name="sparkle" size={13} /> {t("tensions.toggle")}
            </button>
          )}
          <button
            className={`tension-toggle focus-toggle ${harmonyFocus ? "is-on" : ""}`}
            onClick={() => set({ harmonyFocus: !harmonyFocus })}
            title={t(harmonyFocus ? "dock.unfocusHint" : "dock.focusHint")}
            aria-pressed={harmonyFocus}
          >
            <Icon name={harmonyFocus ? "shrink" : "expand"} size={13} /> {t(harmonyFocus ? "dock.unfocus" : "dock.focus")}
            <kbd>W</kbd>
          </button>
          <button className="tension-toggle focus-toggle dock-hide" onClick={() => set({ dockHidden: true, harmonyFocus: false })} title={t("dock.hideHint")}>
            <Icon name="chevronDown" size={13} /> {t("dock.hide")}
            <kbd>H</kbd>
          </button>
        </div>
        {dockView === "wheel" && <HarmonyWheel size={size - 34} />}
        {dockView === "map" && <GravityMap size={mapWidth} />}
        {dockView === "tonnetz" && <Tonnetz size={tonnetzWidth} />}
      </div>

      <aside className="dock-side dock-sources">
        <h3 data-tip="concept.borrow">{t("wheel.borrowFrom")}</h3>
        <ModeLadder keyScale={key} />
      </aside>
    </section>
  );
}

/**
 * Achica su contenido (sin pasar de su tamaño normal) para que entre entero en el alto de la
 * columna: así la lente no necesita barra de scroll cuando el muelle es bajo.
 */
function FitHeight({ children, widen = false }: { children: ReactNode; widen?: boolean }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = outer.current?.parentElement;
    const content = inner.current;
    if (!box || !content) return;
    // Proporción entre el alto disponible y el que pide el contenido (mismas unidades).
    // Se descuenta el relleno de la columna para que no quede ni un borde cortado.
    const ratio = () => (box.clientHeight - 12) / Math.max(1, content.scrollHeight);
    const fit = () => {
      content.style.zoom = "1";
      content.classList.remove("is-wide");
      content.style.width = "";
      box.style.maxWidth = "";
      let r = ratio();
      // (Solo la lente) si hay que achicar mucho, primero se ensancha a dos columnas usando el espacio
      // libre hasta la vista central: así el texto queda más grande y legible.
      const center = box.parentElement?.querySelector(".dock-center");
      if (widen && r < 0.9 && center) {
        const unit = box.getBoundingClientRect().width / Math.max(1, box.offsetWidth); // px de pantalla por unidad local
        const free = (center.getBoundingClientRect().left - box.getBoundingClientRect().left - 32) / unit;
        if (free >= 360) {
          const width = Math.min(free, 580);
          box.style.maxWidth = `${width}px`;
          content.style.width = `${width}px`;
          content.classList.add("is-wide");
          r = ratio();
        }
      }
      // Ancha, la lente no pasa del 85 %: con más espacio sus textos no deben verse más
      // grandes que en la lente normal.
      const max = content.classList.contains("is-wide") ? 0.85 : 1;
      content.style.zoom = String(Math.max(0.55, Math.min(max, r)));
    };
    fit();
    const ro = new ResizeObserver(() => requestAnimationFrame(fit));
    ro.observe(box);
    const mo = new MutationObserver(() => requestAnimationFrame(fit));
    mo.observe(content, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <div ref={outer} className="fit-height">
      <div ref={inner}>{children}</div>
    </div>
  );
}
