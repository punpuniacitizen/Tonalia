// Primera vez: elegir cómo empezar. Básico (teoría + app), «Sé lo que hago» (solo la app)
// o explorar por cuenta propia.

import { motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { TourKind } from "../../learn/tours";
import { useUi, type Language } from "../../stores/ui";
import { Icon } from "../common/Icon";
import "./tour.css";

export function TourWelcome() {
  const { t } = useTranslation();
  const set = useUi((s) => s.set);
  const language = useUi((s) => s.language);
  const done = { panel: null, onboarded: true, welcomed: true } as const;
  const start = (tour: TourKind) => set({ ...done, tour, tourStep: 0 });
  // Primero el idioma: todo lo que sigue (tutorial incluido) ya sale en el elegido.
  const [languagePicked, setLanguagePicked] = useState(false);

  if (!languagePicked)
    return (
      <div className="help-backdrop">
        <motion.section
          className="tour-welcome glass"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
        >
          <header>
            <span className="brand-orb" aria-hidden="true" />
            <div>
              <h2>Tonalia</h2>
              <p>Elige tu idioma · Choose your language</p>
            </div>
          </header>
          <div className="tour-lang">
            <select value={language} onChange={(e) => set({ language: e.target.value as Language })} aria-label="Idioma / Language">
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
            <button className="ghost-button small tour-next" onClick={() => setLanguagePicked(true)}>
              {t("tour.next")} <Icon name="chevronRight" size={14} />
            </button>
          </div>
          <p className="help-tip">Puedes cambiarlo después en el menú de nivel · You can change it later in the level menu.</p>
        </motion.section>
      </div>
    );

  return (
    <div className="help-backdrop">
      <motion.section
        className="tour-welcome glass"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
      >
        <header>
          <span className="brand-orb" aria-hidden="true" />
          <div>
            <h2>{t("help.title")}</h2>
            <p>{t("tour.chooseTitle")}</p>
          </div>
        </header>
        <div className="tour-choices">
          <button className="tour-choice" onClick={() => start("basic")}>
            <span className="tour-choice-icon">
              <Icon name="book" size={22} />
            </span>
            <strong>{t("tour.basicName")}</strong>
            <span>{t("tour.basicDesc")}</span>
            <small>{t("tour.basicTime")}</small>
          </button>
          <button className="tour-choice" onClick={() => start("app")}>
            <span className="tour-choice-icon">
              <Icon name="wand" size={22} />
            </span>
            <strong>{t("tour.appName")}</strong>
            <span>{t("tour.appDesc")}</span>
            <small>{t("tour.appTime")}</small>
          </button>
        </div>
        <p className="help-tip">{t("tour.chooseNote")}</p>
        <button className="link-button tour-explore" onClick={() => set(done)}>
          {t("tour.explore")} <Icon name="chevronRight" size={13} />
        </button>
      </motion.section>
    </div>
  );
}
