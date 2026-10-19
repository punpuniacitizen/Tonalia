// Bienvenida y ayuda: se abre sola la primera vez y luego con la tecla "?".

import { motion } from "motion/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Icon, type IconName } from "../common/Icon";
import "./help.css";

const STEPS: { icon: IconName; key: string }[] = [
  { icon: "sparkle", key: "step1" },
  { icon: "play", key: "step2" },
  { icon: "lines", key: "step3" },
  { icon: "book", key: "step4" },
];

const SHORTCUTS: [string, string][] = [
  ["Espacio", "play"],
  ["Ctrl+Z / Ctrl+Y", "undo"],
  ["Supr", "delete"],
  ["← →", "chords"],
  ["↑ ↓", "transpose"],
  ["Ctrl+A", "selectAll"],
  ["Ctrl+S / Ctrl+O / Ctrl+N", "file"],
  ["Ctrl+E", "export"],
  ["Ctrl + rueda", "zoom"],
  ["?", "help"],
];

export function HelpOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => (e.key === "Escape" || e.key === "?") && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="help-backdrop" onPointerDown={onClose}>
      <motion.section
        className="help glass"
        onPointerDown={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
      >
        <header>
          <span className="brand-orb" aria-hidden="true" />
          <div>
            <h2>{t("help.title")}</h2>
            <p>{t("help.subtitle")}</p>
          </div>
        </header>
        <ol className="help-steps">
          {STEPS.map((s, i) => (
            <motion.li key={s.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }}>
              <span className="help-icon">
                <Icon name={s.icon} size={18} />
              </span>
              <div>
                <strong>{t(`help.${s.key}Title`)}</strong>
                <p>{t(`help.${s.key}`)}</p>
              </div>
            </motion.li>
          ))}
        </ol>
        <p className="help-tip">{t("tips.hint")}</p>
        <details>
          <summary>{t("help.shortcuts")}</summary>
          <table className="help-keys">
            <tbody>
              {SHORTCUTS.map(([keys, id]) => (
                <tr key={id}>
                  <td>
                    <kbd>{keys}</kbd>
                  </td>
                  <td>{t(`help.keys.${id}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        <button className="ghost-button help-start" onClick={onClose}>
          {t("help.start")} <Icon name="chevronRight" size={14} />
        </button>
      </motion.section>
    </div>
  );
}
