import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type SequenceNote } from "../../api";
import type { Key } from "../../bindings/Key";
import type { SongView } from "../../bindings/SongView";
import {
  CATEGORIES,
  PROGRESSIONS,
  chordName,
  chordPitches,
  degreeFunction,
  fitsKey,
  progressionKey,
  progressionRoot,
  type Category,
  type Progression,
} from "../../library/progressions";
import { keyRootName } from "../../lib/music";
import { insertionPoint, useSelectedChord, useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";
import "./library.css";

const BAR = 10368;

type Filter = "all" | "fits" | Category;

/** Cuánto dura cada acorde al escucharlo (segundos) y cuándo empieza. */
function timeline(p: Progression): { delay: number; seconds: number }[] {
  let time = 0;
  return p.chords.map((c) => {
    const seconds = Math.min(2, (c.bars ?? 1) * 0.9);
    const slot = { delay: time, seconds };
    time += seconds;
    return slot;
  });
}

/**
 * Panel lateral con progresiones para escuchar y añadir. Cada una ocupa una línea (acordes y
 * nombre); la explicación se despliega al hacer clic. Los filtros separan estilos y escalas.
 */
export function LibraryDrawer({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView;
  const edit = useSong((s) => s.edit);
  const selected = useSelectedChord();
  const { language, notation, symbols } = useUi();
  const key = selected?.key ?? view.song.homeKey;
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ id: string; token: number } | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const keyLabel = (k: Key) => `${keyRootName(k.root, k.scale.name, notation)} ${t(`scale.${k.scale.name}`)}`;
  const fitting = PROGRESSIONS.filter((p) => fitsKey(p, key));
  const shown = filter === "all" ? PROGRESSIONS : filter === "fits" ? fitting : PROGRESSIONS.filter((p) => p.category === filter);

  const listen = (p: Progression) => {
    const root = progressionRoot(p, key);
    const slots = timeline(p);
    const notes: SequenceNote[] = p.chords.flatMap((c, i) =>
      chordPitches(root, c).map((pitch) => ({ pitch, delay: slots[i].delay, duration: slots[i].seconds * 0.95, velocity: 0.7 })),
    );
    void api.previewSequence(notes, view.song.chordTrack.instrument);
    const token = Date.now();
    setPlaying({ id: p.id, token });
    const end = slots[slots.length - 1];
    later((end.delay + end.seconds) * 1000, () => setPlaying((cur) => (cur?.token === token ? null : cur)));
  };

  const add = (p: Progression) => {
    const root = progressionRoot(p, key);
    const at = insertionPoint(view, selected);
    const commands = p.chords.map((c, i) => ({
      type: "insertChord" as const,
      section: at.section,
      index: at.index + i,
      chord: { root: (root + c.deg) % 12, intervals: c.iv },
      length: (c.bars ?? 1) * BAR,
    }));
    void edit({ type: "batch", commands });
    setAdded(p.id);
    later(1400, () => setAdded((cur) => (cur === p.id ? null : cur)));
  };

  const switchToScale = (p: Progression) => edit({ type: "setHomeKey", key: progressionKey(p, key) });

  const chipText = (p: Progression, root: number, c: Progression["chords"][number]) =>
    symbols === "names" ? chordName(p, root, c, notation) : c.roman;

  /** Qué pasa con la tonalidad: se toca en la relativa, o pertenece a otra escala. */
  const note = (p: Progression, root: number) => {
    if (root !== key.root) {
      return { text: t(p.scale === "minor" ? "library.relativeMinor" : "library.relativeMajor", { key: keyRootName(root, p.scale, notation) }), target: key, offer: false };
    }
    if (p.scale !== key.scale.name && !["major", "minor"].includes(p.scale)) {
      const target = progressionKey(p, key);
      return { text: t(fitsKey(p, key) ? "library.fromScaleFits" : "library.fromScale", { key: keyLabel(target) }), target, offer: true };
    }
    return null;
  };

  const filters: Filter[] = ["all", "fits", ...CATEGORIES];

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
          <p>{t("library.subtitle", { key: keyLabel(key) })}</p>
        </div>
        <button className="icon-button" onClick={onClose} title={t("tips.close")}>
          <Icon name="plus" size={18} />
        </button>
      </header>

      <div className="library-filters" role="tablist">
        {filters.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? "is-active" : ""} onClick={() => setFilter(f)}>
            {f === "fits" ? t("library.filters.fits", { count: fitting.length }) : t(`library.filters.${f}`)}
          </button>
        ))}
      </div>

      <div className="library-list">
        {shown.length === 0 && <p className="library-empty">{t("library.empty", { key: keyLabel(key) })}</p>}
        {shown.map((p) => {
          const text = p[language];
          const root = progressionRoot(p, key);
          const isOpen = open === p.id;
          const hit = playing?.id === p.id ? playing.token : null;
          const slots = timeline(p);
          const info = isOpen ? note(p, root) : null;
          const exotic = !["major", "minor"].includes(p.scale);
          return (
            <motion.article key={p.id} layout="position" className={`prog-card ${isOpen ? "is-open" : ""}`}>
              <div className="prog-row">
                <button className="prog-play" onClick={() => listen(p)} title={t("library.listen")} aria-label={t("library.listen")}>
                  <Icon name="play" size={13} filled />
                </button>
                <button className="prog-main" onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen}>
                  <span className="prog-ribbon">
                    {p.chords.map((c, i) => (
                      <span
                        key={`${hit ?? 0}-${i}`}
                        className={`prog-chip ${hit ? "is-hit" : ""}`}
                        style={{
                          flex: c.bars ?? 1,
                          ["--fn" as string]: `var(--fn-${degreeFunction(c.deg, c.iv)})`,
                          ["--hit-delay" as string]: `${slots[i].delay}s`,
                          ["--hit-dur" as string]: `${slots[i].seconds}s`,
                        }}
                      >
                        {chipText(p, root, c)}
                      </span>
                    ))}
                  </span>
                  <span className="prog-title">
                    <span className="prog-name">{text.name}</span>
                    {exotic && <span className="prog-scale">{t(`scale.${p.scale}`)}</span>}
                  </span>
                  <span className="prog-mood">{text.mood}</span>
                </button>
                <button className={`prog-add ${added === p.id ? "is-done" : ""}`} onClick={() => add(p)} title={t("library.add")} aria-label={t("library.add")}>
                  <Icon name={added === p.id ? "check" : "plus"} size={15} />
                </button>
              </div>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    className="prog-more"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <p>{text.desc}</p>
                    {info && (
                      <div className="prog-note">
                        <span>{info.text}</span>
                        {info.offer && (
                          <button className="ghost-button small" onClick={() => void switchToScale(p)}>
                            {t("library.useScale", { key: keyLabel(info.target) })}
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          );
        })}
      </div>
    </motion.aside>
  );
}
