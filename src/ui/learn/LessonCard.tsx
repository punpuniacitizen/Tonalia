// Una lección de teoría: dibujo, idea, explicación breve, dónde se ve en la app y su sonido.
// La usan el tutorial básico y la sección Aprender.

import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { Lesson } from "../../learn/lessons";
import { useUi } from "../../stores/ui";
import { TIPS } from "../../tips/tips";
import { Icon } from "../common/Icon";
import { TipVisualView } from "../tips/TipVisuals";
import "./learn.css";

/** `extended` añade el «cuándo usarlo» del tip relacionado (en Aprender, para repasar a fondo). */
export function LessonCard({ lesson, extended = false }: { lesson: Lesson; extended?: boolean }) {
  const { t } = useTranslation();
  const language = useUi((s) => s.language);
  const text = lesson[language];
  const tip = extended && lesson.tip ? TIPS[lesson.tip]?.[language] : undefined;

  return (
    <article className="lesson" key={lesson.id}>
      <div className="lesson-visual">
        <TipVisualView visual={lesson.visual} lang={language} />
      </div>
      <header className="lesson-head">
        <span className="tip-kicker">{text.kicker}</span>
        <h2>{text.title}</h2>
      </header>
      {text.body.map((p) => (
        <p key={p} className="lesson-body">
          {p}
        </p>
      ))}
      <p className="lesson-takeaway">
        <Icon name="sparkle" size={14} /> {text.takeaway}
      </p>
      <p className="lesson-inapp">
        <strong>{t("learn.inApp")}</strong> {text.inApp}
      </p>
      {extended && text.more && (
        <div className="lesson-more">
          <h3>{t("learn.more")}</h3>
          {text.more.map((p) => (
            <p key={p} className="lesson-body">
              {p}
            </p>
          ))}
        </div>
      )}
      {tip && (
        <div className="lesson-more">
          <h3>{t("tips.useWhen")}</h3>
          <ul className="tip-list">
            {tip.useWhen.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
          {tip.examples && <p className="tip-examples">{tip.examples}</p>}
        </div>
      )}
      {lesson.sound && (
        <button className="ghost-button small lesson-listen" onClick={() => api.previewSequence(lesson.sound!(), "piano")}>
          <Icon name="play" size={13} filled /> {t("tips.listen")}
        </button>
      )}
    </article>
  );
}
