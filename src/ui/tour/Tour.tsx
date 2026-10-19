// Recorrido guiado: tarjetas de teoría centradas y, para la app, un foco que ilumina
// cada zona de la pantalla con su explicación al lado.

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { buildTour, type StepSetup, type TourStep } from "../../learn/tours";
import { TUTORIAL_LESSONS } from "../../learn/lessons";
import { useSong } from "../../stores/song";
import { markLearned, useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";
import { LessonCard } from "../learn/LessonCard";
import "./tour.css";

const PAD = 8;
const CARD_W = 360;
const GAP = 14;

type Rect = { x: number; y: number; w: number; h: number };

export function Tour() {
  const { t } = useTranslation();
  const { tour, tourStep, language, set } = useUi();
  const steps = useMemo(() => (tour ? buildTour(tour) : []), [tour]);
  const step: TourStep | undefined = steps[tourStep];

  const finish = () => set({ tour: null, tourStep: 0 });
  const go = (i: number) => (i >= steps.length ? finish() : set({ tourStep: Math.max(0, i) }));

  // Flechas, Intro y Esc mandan sobre los atajos de la app mientras dura el recorrido.
  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") go(tourStep + 1);
      else if (e.key === "ArrowLeft") go(tourStep - 1);
      else if (e.key === "Escape") finish();
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  useEffect(() => {
    if (step?.kind === "lesson") markLearned(step.lesson.id);
    if (step?.kind === "app" && step.step.setup) runSetup(step.step.setup);
  }, [step]);

  if (!tour || !step) return null;

  const nav = (
    <footer className="tour-nav">
      <div className="tour-progress" aria-hidden="true">
        <span style={{ width: `${((tourStep + 1) / steps.length) * 100}%` }} />
      </div>
      <button className="ghost-button small tour-skip" onClick={finish}>
        {t("tour.skip")}
      </button>
      <div className="tour-nav-spacer" />
      {tourStep > 0 && (
        <button className="ghost-button small" onClick={() => go(tourStep - 1)}>
          <Icon name="chevronLeft" size={14} /> {t("tour.back")}
        </button>
      )}
      <button className="ghost-button small tour-next" onClick={() => go(tourStep + 1)}>
        {tourStep === steps.length - 1 ? t("tour.finish") : t("tour.next")} <Icon name="chevronRight" size={14} />
      </button>
    </footer>
  );

  if (step.kind === "app") {
    const text = step.step[language];
    const label = `${t("tour.appChapter")} · ${appIndex(steps, tourStep)}`;
    return <Spotlight targets={step.step.target} stepKey={step.step.id} label={label} title={text.title} body={text.body} nav={nav} />;
  }

  const lessonPos = step.kind === "lesson" ? TUTORIAL_LESSONS.indexOf(step.lesson) + 1 : 0;
  const part2 = steps.findIndex((s) => s.kind === "part2");

  return (
    <div className="tour-backdrop">
      <motion.section key={tourStep} className="tour-modal glass" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}>
        {step.kind === "lesson" && (
          <>
            <div className="tour-chapter">
              <span>
                {t("tour.theoryChapter")} · {lessonPos}/{TUTORIAL_LESSONS.length}
              </span>
              <button className="link-button" onClick={() => go(part2)}>
                {t("tour.skipTheory")}
              </button>
            </div>
            <LessonCard lesson={step.lesson} />
          </>
        )}
        {step.kind !== "lesson" && (
          <div className="tour-text">
            <span className="brand-orb" aria-hidden="true" />
            <h2>{t(`tour.${step.kind}Title`)}</h2>
            <p>{t(`tour.${step.kind}Body`)}</p>
            {step.kind === "outro" && (
              <button className="ghost-button small" onClick={() => set({ tour: null, tourStep: 0, panel: "learn" })}>
                <Icon name="book" size={13} /> {t("tour.openLearn")}
              </button>
            )}
          </div>
        )}
        {nav}
      </motion.section>
    </div>
  );
}

function appIndex(steps: TourStep[], i: number): string {
  const app = steps.filter((s) => s.kind === "app");
  return `${steps.slice(0, i + 1).filter((s) => s.kind === "app").length}/${app.length}`;
}

function runSetup(setup: StepSetup) {
  const ui = useUi.getState();
  if (ui.dockHidden) ui.set({ dockHidden: false });
  if (setup === "wheel") ui.set({ dockView: "wheel" });
  if (setup !== "selectFirst") return ui.select(null);
  const first = useSong.getState().view?.chords[0];
  if (first) ui.select({ section: first.section, index: first.index });
}

/** Une los rectángulos visibles de los elementos (recortados por su zona con scroll). */
function measure(selectors: string[]): Rect | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const sel of selectors) {
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const r = el.getBoundingClientRect();
      const clip = el.closest(".timeline-scroll")?.getBoundingClientRect() ?? new DOMRect(0, 0, innerWidth, innerHeight);
      const l = Math.max(r.left, clip.left, 0), tp = Math.max(r.top, clip.top, 0);
      const rt = Math.min(r.right, clip.right, innerWidth), b = Math.min(r.bottom, clip.bottom, innerHeight);
      if (rt - l < 2 || b - tp < 2) continue;
      x0 = Math.min(x0, l), y0 = Math.min(y0, tp), x1 = Math.max(x1, rt), y1 = Math.max(y1, b);
    }
  }
  return x0 === Infinity ? null : { x: x0 - PAD, y: y0 - PAD, w: x1 - x0 + PAD * 2, h: y1 - y0 + PAD * 2 };
}

/** Sigue la zona en cada fotograma: se adapta a animaciones, scroll y cambios de tamaño. */
function useTargetRect(selectors: string[], key: string): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  useLayoutEffect(() => {
    let frame = 0;
    const tick = () => {
      const next = measure(selectors);
      setRect((prev) => (prev && next && Math.abs(prev.x - next.x) + Math.abs(prev.y - next.y) + Math.abs(prev.w - next.w) + Math.abs(prev.h - next.h) < 1 ? prev : next));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return rect;
}

/** Dónde cabe la tarjeta: debajo, encima, a la derecha, a la izquierda o, si no, centrada. */
function placeCard(r: Rect | null, cardH: number): { left: number; top: number } {
  const W = innerWidth, H = innerHeight, m = 12;
  const clampX = (x: number) => Math.min(Math.max(m, x), W - CARD_W - m);
  const clampY = (y: number) => Math.min(Math.max(m, y), H - cardH - m);
  if (!r) return { left: (W - CARD_W) / 2, top: (H - cardH) / 2 };
  const cx = r.x + r.w / 2 - CARD_W / 2, cy = r.y + r.h / 2 - cardH / 2;
  if (r.y + r.h + GAP + cardH <= H - m) return { left: clampX(cx), top: r.y + r.h + GAP };
  if (r.y - GAP - cardH >= m) return { left: clampX(cx), top: r.y - GAP - cardH };
  if (r.x + r.w + GAP + CARD_W <= W - m) return { left: r.x + r.w + GAP, top: clampY(cy) };
  if (r.x - GAP - CARD_W >= m) return { left: r.x - GAP - CARD_W, top: clampY(cy) };
  return { left: clampX(cx), top: H - cardH - m };
}

function Spotlight({ targets, stepKey, label, title, body, nav }: { targets: string[]; stepKey: string; label: string; title: string; body: string; nav: ReactNode }) {
  const rect = useTargetRect(targets, stepKey);
  const cardRef = useRef<HTMLElement>(null);
  const [cardH, setCardH] = useState(200);
  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [stepKey]);
  const pos = placeCard(rect, cardH);
  const hole = rect ?? { x: innerWidth / 2, y: innerHeight / 2, w: 0, h: 0 };
  const spring = { type: "spring", stiffness: 240, damping: 30 } as const;

  return (
    <div className="tour-spot">
      <svg className="tour-shade" width="100%" height="100%">
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            <motion.rect rx={14} fill="black" initial={false} animate={{ x: hole.x, y: hole.y, width: hole.w, height: hole.h }} transition={spring} />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(2,3,8,0.68)" mask="url(#tour-hole)" />
      </svg>
      {rect && <motion.div className="tour-ring" initial={false} animate={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} transition={spring} />}
      <AnimatePresence mode="wait">
        <motion.section
          key={stepKey}
          ref={cardRef}
          className="tour-card glass"
          style={{ width: CARD_W }}
          initial={{ opacity: 0, y: 8, left: pos.left, top: pos.top }}
          animate={{ opacity: 1, y: 0, left: pos.left, top: pos.top }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <span className="tip-kicker">{label}</span>
          <h2>{title}</h2>
          <p>{body}</p>
          {nav}
        </motion.section>
      </AnimatePresence>
    </div>
  );
}
