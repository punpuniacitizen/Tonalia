// Capa de tips: clic derecho sobre cualquier elemento con `data-tip="…"` abre una tarjeta
// con una ilustración, el carácter/emoción, cuándo usarlo y un ejemplo sonoro.

import { useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import { useTips } from "../../stores/tips";
import { useUi } from "../../stores/ui";
import { TIPS } from "../../tips/tips";
import { Icon } from "../common/Icon";
import { TipVisualView } from "./TipVisuals";
import "./tips.css";

const CARD_WIDTH = 380;

export function TipLayer() {
  const { t } = useTranslation();
  const language = useUi((s) => s.language);
  const open = useTips((s) => s.open);
  const setOpen = useTips((s) => s.set);
  const cardRef = useRef<HTMLElement>(null);

  // Tras pintarse, la tarjeta mide su altura real y sube si se saldría por abajo.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || !open) return;
    const top = Math.max(12, Math.min(open.y - 40, window.innerHeight - el.offsetHeight - 12));
    el.style.top = `${top}px`;
  }, [open]);

  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea")) return;
      // En una app de escritorio el menú del navegador no aporta nada.
      e.preventDefault();
      const el = target.closest<HTMLElement | SVGElement>("[data-tip]");
      const id = el?.getAttribute("data-tip");
      if (id && TIPS[id]) setOpen({ id, x: e.clientX, y: e.clientY });
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("keydown", onKey);
    };
  }, [setOpen]);

  if (!open) return null;
  const tip = TIPS[open.id];
  const text = tip[language];
  const left = Math.min(Math.max(12, open.x + 12), window.innerWidth - CARD_WIDTH - 12);

  return (
    <div className="tip-backdrop" onPointerDown={() => setOpen(null)}>
      <article
        ref={cardRef}
        className="tip-card glass"
        style={{ left, top: Math.max(12, open.y - 40), width: CARD_WIDTH }}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={text.title}
      >
        <div className="tip-visual">
          <TipVisualView visual={tip.visual} lang={language} />
        </div>
        <header className="tip-head">
          <span className="tip-kicker">{text.kicker}</span>
          <h2>{text.title}</h2>
        </header>
        <div className="tip-moods">
          {text.mood.map((m) => (
            <span key={m} className="chip">
              {m}
            </span>
          ))}
        </div>
        <p className="tip-body">{text.body}</p>
        <h3>{t("tips.useWhen")}</h3>
        <ul className="tip-list">
          {text.useWhen.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
        {text.examples && <p className="tip-examples">{text.examples}</p>}
        <footer className="tip-actions">
          {tip.sound && (
            <button className="ghost-button small" onClick={() => api.previewSequence(tip.sound!(), "piano")}>
              <Icon name="play" size={14} filled /> {t("tips.listen")}
            </button>
          )}
          <button className="icon-button" onClick={() => setOpen(null)} title={t("tips.close")}>
            <Icon name="plus" size={16} />
          </button>
        </footer>
      </article>
    </div>
  );
}
