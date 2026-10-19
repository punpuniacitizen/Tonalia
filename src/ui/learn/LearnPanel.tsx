// Aprender: todas las lecciones de teoría, agrupadas, para repasarlas cuando quieras.

import { motion } from "motion/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { LESSON_GROUPS, LESSONS } from "../../learn/lessons";
import { markLearned, useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";
import { LessonCard } from "./LessonCard";
import "./learn.css";

export function LearnPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { language, lesson: lessonId, learned, set } = useUi();
  const index = Math.max(0, LESSONS.findIndex((l) => l.id === lessonId));
  const lesson = LESSONS[index];

  useEffect(() => markLearned(lesson.id), [lesson.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const next = LESSONS[index + (e.key === "ArrowDown" ? 1 : -1)];
        if (next) set({ lesson: next.id });
      } else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [index, onClose, set]);

  const go = (i: number) => LESSONS[i] && set({ lesson: LESSONS[i].id });

  return (
    <div className="help-backdrop" onPointerDown={onClose}>
      <motion.section
        className="learn glass"
        onPointerDown={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        role="dialog"
        aria-label={t("learn.title")}
      >
        <nav className="learn-nav">
          <header>
            <h2>{t("learn.title")}</h2>
            <p>{t("learn.progress", { done: LESSONS.filter((l) => learned.includes(l.id)).length, total: LESSONS.length })}</p>
          </header>
          {LESSON_GROUPS.map((g) => (
            <div key={g} className="learn-group">
              <h3>{t(`learn.group.${g}`)}</h3>
              {LESSONS.filter((l) => l.group === g).map((l) => (
                <button key={l.id} className={`learn-item ${l.id === lesson.id ? "is-active" : ""}`} onClick={() => set({ lesson: l.id })}>
                  <span className={`learn-check ${learned.includes(l.id) ? "is-done" : ""}`} aria-hidden="true" />
                  {l[language].title}
                </button>
              ))}
            </div>
          ))}
          <button className="ghost-button small learn-tour" onClick={() => set({ panel: null, tour: "basic", tourStep: 0 })}>
            <Icon name="play" size={12} filled /> {t("learn.replayTour")}
          </button>
        </nav>
        <div className="learn-main">
          <button className="icon-button learn-close" onClick={onClose} title={t("tips.close")}>
            <Icon name="plus" size={18} />
          </button>
          <LessonCard lesson={lesson} extended />
          <footer className="learn-pager">
            <button className="ghost-button small" disabled={index === 0} onClick={() => go(index - 1)}>
              <Icon name="chevronLeft" size={14} /> {t("tour.back")}
            </button>
            <span>
              {index + 1} / {LESSONS.length}
            </span>
            <button className="ghost-button small" disabled={index === LESSONS.length - 1} onClick={() => go(index + 1)}>
              {t("tour.next")} <Icon name="chevronRight" size={14} />
            </button>
          </footer>
        </div>
      </motion.section>
    </div>
  );
}
