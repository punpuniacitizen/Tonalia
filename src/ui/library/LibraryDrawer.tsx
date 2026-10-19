import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { api, type SequenceNote } from "../../api";
import type { SongView } from "../../bindings/SongView";
import { PROGRESSIONS, chordPitches, degreeFunction, progressionRoot, type Progression } from "../../library/progressions";
import { isMinorLike, keyRootName } from "../../lib/music";
import { insertionPoint, useSelectedChord, useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";
import "./library.css";

const BAR = 10368;

/** Panel lateral con progresiones famosas para escuchar y añadir. */
export function LibraryDrawer({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView;
  const edit = useSong((s) => s.edit);
  const selected = useSelectedChord();
  const { language, notation } = useUi();
  const key = selected?.key ?? view.song.homeKey;
  const minor = isMinorLike(key.scale.name);

  const listen = (p: Progression) => {
    const root = progressionRoot(p, key.root, minor);
    let time = 0;
    const notes: SequenceNote[] = [];
    for (const c of p.chords) {
      const seconds = Math.min(2, (c.bars ?? 1) * 0.9);
      for (const pitch of chordPitches(root, c)) notes.push({ pitch, delay: time, duration: seconds * 0.95, velocity: 0.7 });
      time += seconds;
    }
    void api.previewSequence(notes, view.song.chordTrack.instrument);
  };

  const add = (p: Progression) => {
    const root = progressionRoot(p, key.root, minor);
    const at = insertionPoint(view, selected);
    const commands = p.chords.map((c, i) => ({
      type: "insertChord" as const,
      section: at.section,
      index: at.index + i,
      chord: { root: (root + c.deg) % 12, intervals: c.iv },
      length: (c.bars ?? 1) * BAR,
    }));
    void edit({ type: "batch", commands });
  };

  return (
    <motion.aside
      className="library glass"
      initial={{ x: 420, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
    >
      <header className="library-head">
        <div>
          <h2>{t("library.title")}</h2>
          <p>{t("library.subtitle", { key: `${keyRootName(key.root, key.scale.name, notation)} ${t(`scale.${key.scale.name}`)}` })}</p>
        </div>
        <button className="icon-button" onClick={onClose} title={t("tips.close")}>
          <Icon name="plus" size={18} />
        </button>
      </header>
      <div className="library-list">
        {PROGRESSIONS.map((p) => {
          const text = p[language];
          const relative = (p.mode === "minor") !== minor;
          return (
            <article key={p.id} className="prog-card">
              <div className="prog-ribbon">
                {p.chords.map((c, i) => {
                  const fn = degreeFunction(c.deg, c.iv);
                  return (
                    <span key={i} className="prog-chip" style={{ flex: c.bars ?? 1, ["--fn" as string]: `var(--fn-${fn})` }}>
                      {c.roman}
                    </span>
                  );
                })}
              </div>
              <h3>{text.name}</h3>
              <span className="prog-mood">{text.mood}</span>
              <p>{text.desc}</p>
              {relative && (
                <small className="prog-note">
                  {t(p.mode === "minor" ? "library.relativeMinor" : "library.relativeMajor", {
                    key: keyRootName(progressionRoot(p, key.root, minor), p.mode, notation),
                  })}
                </small>
              )}
              <div className="prog-actions">
                <button className="ghost-button small" onClick={() => listen(p)}>
                  <Icon name="play" size={13} filled /> {t("library.listen")}
                </button>
                <button className="ghost-button small" onClick={() => add(p)}>
                  <Icon name="plus" size={13} /> {t("library.add")}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </motion.aside>
  );
}
