import { AnimatePresence, animate, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "./api";
import { useSong } from "./stores/song";
import { useUi } from "./stores/ui";
import { LibraryDrawer } from "./ui/library/LibraryDrawer";
import { EarTraining } from "./ui/training/EarTraining";
import { DragGhost } from "./ui/shell/DragGhost";
import { DockSplitter } from "./ui/shell/DockSplitter";
import { HelpOverlay } from "./ui/shell/HelpOverlay";
import { LearnPanel } from "./ui/learn/LearnPanel";
import { ChordTools } from "./ui/lenses/ChordTools";
import { Icon } from "./ui/common/Icon";
import { Tour } from "./ui/tour/Tour";
import { TourWelcome } from "./ui/tour/TourWelcome";
import { Header } from "./ui/shell/Header";
import { useShortcuts } from "./ui/shell/useShortcuts";
import { Timeline } from "./ui/timeline/Timeline";
import { TipLayer } from "./ui/tips/TipLayer";
import { WheelDock } from "./ui/wheel/WheelDock";
import "./App.css";

export default function App() {
  const load = useSong((s) => s.load);
  const error = useSong((s) => s.error);
  const clearError = useSong((s) => s.clearError);
  const [audioError, setAudioError] = useState<string | null>(null);
  const panel = useUi((s) => s.panel);
  const dockHeight = useUi((s) => s.dockHeight);
  const harmonyFocus = useUi((s) => s.harmonyFocus);
  const dockHidden = useUi((s) => s.dockHidden);
  const { t } = useTranslation();
  const setUi = useUi((s) => s.set);
  useShortcuts();

  // Ocultar / mostrar el muelle con animación: el muelle cambia de alto (y se desvanece)
  // mientras la línea de tiempo ocupa o devuelve ese espacio. Al volver recupera el alto que
  // tenía. Durante la animación el reparto es «manual» (clase is-dock-manual); al terminar,
  // oculto queda fuera del flujo y visible vuelve al reparto normal.
  const dockRef = useRef<HTMLDivElement>(null);
  const lastDockHeight = useRef<number | null>(null);
  // Alto actual del muelle (fuera de las animaciones), para animar el cambio al ampliar.
  const liveHeight = useRef(0);
  const firstRun = useRef(true);
  const [dockMoving, setDockMoving] = useState(dockHidden);
  const [dockGone, setDockGone] = useState(dockHidden);
  useLayoutEffect(() => {
    const el = dockRef.current;
    if (firstRun.current || !el) {
      firstRun.current = false;
      return;
    }
    const ease = [0.22, 1, 0.36, 1] as const;
    let anim: ReturnType<typeof animate> | null = null;
    if (dockHidden) {
      const from = el.getBoundingClientRect().height;
      if (from > 0) lastDockHeight.current = from;
      el.style.height = `${from}px`;
      setDockMoving(true);
      anim = animate(el, { height: 0, opacity: 0 }, { duration: 0.34, ease });
      // Si mientras tanto se volvió a mostrar, no hay que sacarlo del flujo.
      void anim.then(() => useUi.getState().dockHidden && setDockGone(true));
    } else {
      el.style.height = "0px";
      el.style.opacity = "0";
      setDockGone(false);
      setDockMoving(true);
      const to = lastDockHeight.current ?? Math.round(window.innerHeight * 0.4);
      anim = animate(el, { height: to, opacity: 1 }, { duration: 0.34, ease });
      // El alto fijo se quita recién cuando ya rige el reparto normal (efecto de abajo): si se
      // quitara antes, por un fotograma el muelle tomaría el alto de su contenido.
      void anim.then(() => {
        liveHeight.current = to;
        if (!useUi.getState().dockHidden) setDockMoving(false);
      });
    }
    return () => anim?.stop();
  }, [dockHidden]);
  useLayoutEffect(() => {
    if (!dockMoving && dockRef.current) dockRef.current.style.height = "";
  }, [dockMoving]);

  const movingRef = useRef(dockMoving);
  movingRef.current = dockMoving;
  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!movingRef.current) liveHeight.current = el.getBoundingClientRect().height;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ampliar / reducir (W): el muelle pasa de su alto anterior al nuevo con la misma curva,
  // mientras las pistas se pliegan o reaparecen arriba.
  const focusFirstRun = useRef(true);
  useLayoutEffect(() => {
    const el = dockRef.current;
    if (focusFirstRun.current || !el || dockHidden || dockGone) {
      focusFirstRun.current = false;
      return;
    }
    const from = liveHeight.current;
    const to = el.getBoundingClientRect().height;
    if (!from || Math.abs(to - from) < 2) return;
    el.style.height = `${from}px`;
    setDockMoving(true);
    const anim = animate(el, { height: to }, { duration: 0.34, ease: [0.22, 1, 0.36, 1] });
    void anim.then(() => {
      // Al terminar el tamaño no cambia, así que el observador no avisa: se anota aquí.
      liveHeight.current = to;
      if (!useUi.getState().dockHidden) setDockMoving(false);
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [harmonyFocus]);

  useEffect(() => {
    void load();
    void api.audioStatus().then(setAudioError);
    // La primera vez, elegir tutorial: básico (teoría + app) o «sé lo que hago».
    if (!useUi.getState().onboarded) useUi.getState().set({ panel: "welcome" });
  }, [load]);

  return (
    <div className="app">
      <div className="ambient" aria-hidden="true" />
      <Header />
      <main
        className={`stage ${dockHeight && !dockMoving ? "has-dock-size" : ""} ${harmonyFocus && !dockHidden ? "is-focus" : ""} ${dockMoving ? "is-dock-manual" : ""}`}
        style={dockHeight ? { ["--dock-h" as string]: `${dockHeight}px` } : undefined}
      >
        <Timeline />
        {!dockMoving && <DockSplitter />}
        <div ref={dockRef} className="dock-wrap" style={dockGone ? { display: "none" } : undefined}>
          <WheelDock />
        </div>
        <AnimatePresence>
          {dockHidden && (
            // El envoltorio (sin relleno ni borde) es el que se pliega: así su alto llega de
            // verdad a 0 y la línea de tiempo no salta cuando el botón aparece o se va.
            <motion.div
              key="reveal"
              className="dock-reveal-wrap"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              <button className="dock-reveal" onClick={() => setUi({ dockHidden: false })} title={t("dock.showHint")}>
                <Icon name="chevronDown" size={14} /> {t("dock.show")} <kbd>H</kbd>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <DragGhost />
      {panel === "library" && <LibraryDrawer onClose={() => setUi({ panel: null })} />}
      {panel === "training" && <EarTraining onClose={() => setUi({ panel: null })} />}
      {panel === "help" && <HelpOverlay onClose={() => setUi({ panel: null, welcomed: true })} />}
      {panel === "welcome" && <TourWelcome />}
      {panel === "learn" && <LearnPanel onClose={() => setUi({ panel: null })} />}
      <Tour />
      <ChordTools />
      <TipLayer />
      {(error || audioError) && (
        <div className="toast" role="alert" onClick={clearError}>
          {error ?? `Audio: ${audioError}`}
        </div>
      )}
    </div>
  );
}
