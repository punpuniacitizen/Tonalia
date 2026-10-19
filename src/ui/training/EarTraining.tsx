// Entrenamiento auditivo: escuchar y reconocer intervalos, calidades de acorde y funciones.

import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, chordsSequence, melodySequence } from "../../api";
import { useUi, type Level } from "../../stores/ui";
import { Icon } from "../common/Icon";
import { Segmented } from "../common/Segmented";
import "./training.css";

type Mode = "intervals" | "chords" | "functions";
type Question = { answer: string; options: string[]; play: () => void; pitches: number[] };

const INTERVALS: Record<Level, number[]> = {
  beginner: [4, 5, 7, 12],
  intermediate: [2, 3, 4, 5, 7, 9, 10, 12],
  advanced: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

const QUALITIES: Record<string, number[]> = {
  major: [4, 7],
  minor: [3, 7],
  dim: [3, 6],
  aug: [4, 8],
  sus4: [5, 7],
  sus2: [2, 7],
  dom7: [4, 7, 10],
  maj7: [4, 7, 11],
  min7: [3, 7, 10],
};
const QUALITY_LEVELS: Record<Level, string[]> = {
  beginner: ["major", "minor"],
  intermediate: ["major", "minor", "dim", "aug", "sus4"],
  advanced: ["major", "minor", "dim", "aug", "sus4", "sus2", "dom7", "maj7", "min7"],
};

// Acordes de la prueba de funciones: [grado, intervalos, función]
const FUNCTION_CHORDS: [number, number[], string][] = [
  [9, [3, 7], "tonic"],
  [4, [3, 7], "tonic"],
  [5, [4, 7], "subdominant"],
  [2, [3, 7], "subdominant"],
  [7, [4, 7], "dominant"],
  [7, [4, 7, 10], "dominant"],
  [11, [3, 6], "dominant"],
];

const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

function makeQuestion(mode: Mode, level: Level): Question {
  const base = 55 + Math.floor(Math.random() * 10);
  if (mode === "intervals") {
    const iv = pick(INTERVALS[level]);
    const pitches = [base, base + iv];
    return {
      answer: String(iv),
      options: INTERVALS[level].map(String),
      pitches,
      play: () => void api.previewSequence(melodySequence(pitches, 0.7), "piano"),
    };
  }
  if (mode === "chords") {
    const q = pick(QUALITY_LEVELS[level]);
    const pitches = [base, ...QUALITIES[q].map((i) => base + i)];
    return {
      answer: q,
      options: QUALITY_LEVELS[level],
      pitches,
      play: () => void api.previewSequence([...melodySequence(pitches, 0.35), ...chordsSequence([pitches], 1.6).map((n) => ({ ...n, delay: n.delay + pitches.length * 0.35 + 0.1 }))], "piano"),
    };
  }
  const [deg, iv, fn] = pick(FUNCTION_CHORDS);
  const root = 48 + Math.floor(Math.random() * 7);
  const tonic = [root, root + 4, root + 7];
  const chord = [root + deg, ...iv.map((i) => root + deg + i)].map((p) => (p > root + 12 ? p - 12 : p));
  return {
    answer: fn,
    options: ["tonic", "subdominant", "dominant"],
    pitches: chord,
    play: () => void api.previewSequence(chordsSequence([tonic, chord], 1.1), "piano"),
  };
}

export function EarTraining({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const level = useUi((s) => s.level);
  const [mode, setMode] = useState<Mode>("intervals");
  const [q, setQ] = useState<Question>(() => makeQuestion("intervals", level));
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 });

  const next = useCallback(
    (m: Mode = mode) => {
      const nq = makeQuestion(m, level);
      setQ(nq);
      setChosen(null);
      window.setTimeout(nq.play, 150);
    },
    [mode, level],
  );

  // La primera pregunta suena sola al abrir.
  useEffect(() => {
    const id = window.setTimeout(q.play, 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const answer = (opt: string) => {
    if (chosen) return;
    setChosen(opt);
    const ok = opt === q.answer;
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1, streak: ok ? s.streak + 1 : 0 }));
  };

  const label = (opt: string) =>
    mode === "intervals" ? t(`training.interval.${opt}`) : mode === "chords" ? t(`training.quality.${opt}`) : t(`function.${opt}`);
  const accuracy = score.total ? score.right / score.total : 0;

  return (
    <div className="training-backdrop" onPointerDown={onClose}>
      <motion.section
        className="training glass"
        onPointerDown={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
      >
        <header className="training-head">
          <div>
            <h2>
              <Icon name="ear" /> {t("training.title")}
            </h2>
            <p>{t(`training.${mode}Intro`)}</p>
          </div>
          <div className="score-wrap big" title={t("training.accuracy")}>
            <div className="score-meter" style={{ ["--score" as string]: accuracy }} />
            <span>
              {score.right}/{score.total}
            </span>
          </div>
        </header>

        <Segmented<Mode>
          label={t("training.mode")}
          value={mode}
          onChange={(m) => {
            setMode(m);
            next(m);
          }}
          options={[
            { value: "intervals", label: t("training.intervals") },
            { value: "chords", label: t("training.chords") },
            { value: "functions", label: t("training.functions") },
          ]}
        />

        <button className="listen-orb" onClick={q.play} title={t("training.replay")}>
          <motion.span
            key={q.pitches.join("-") + mode}
            initial={{ scale: 0.6, opacity: 0.4 }}
            animate={{ scale: [1, 1.15, 1], opacity: 1 }}
            transition={{ duration: 0.9 }}
          >
            <Icon name="play" size={30} filled />
          </motion.span>
        </button>
        <p className="training-hint">{chosen ? "" : t("training.prompt")}</p>

        <div className="options">
          {q.options.map((opt) => {
            const state = !chosen ? "" : opt === q.answer ? "is-right" : opt === chosen ? "is-wrong" : "is-dim";
            return (
              <button key={opt} className={`option ${state}`} onClick={() => answer(opt)}>
                {label(opt)}
              </button>
            );
          })}
        </div>

        {chosen && (
          <motion.div className="feedback" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <strong className={chosen === q.answer ? "ok" : "ko"}>
              {chosen === q.answer ? t("training.right", { streak: score.streak }) : t("training.wrong", { answer: label(q.answer) })}
            </strong>
            <MiniKeyboard pitches={q.pitches} />
            <p>{t(`training.explain.${mode}.${q.answer}`, { defaultValue: "" })}</p>
            <div className="feedback-actions">
              <button className="ghost-button small" onClick={q.play}>
                <Icon name="speaker" size={14} /> {t("training.replay")}
              </button>
              <button className="ghost-button small" onClick={() => next()}>
                {t("training.next")} <Icon name="chevronRight" size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </motion.section>
    </div>
  );
}

/** Dos octavas de teclado con las notas de la pregunta encendidas. */
function MiniKeyboard({ pitches }: { pitches: number[] }) {
  const lo = Math.min(...pitches) - (Math.min(...pitches) % 12);
  const whites: number[] = [];
  for (let p = lo; p < lo + 24; p++) if (![1, 3, 6, 8, 10].includes(p % 12)) whites.push(p);
  const on = new Set(pitches);
  const w = 100 / whites.length;
  return (
    <div className="train-keys">
      {whites.map((p, i) => (
        <div key={p} className={`tk white ${on.has(p) ? "on" : ""}`} style={{ left: `${i * w}%`, width: `${w}%` }} />
      ))}
      {whites.map((p, i) =>
        [0, 2, 5, 7, 9].includes(p % 12) && p + 1 < lo + 24 ? (
          <div key={p + 1} className={`tk black ${on.has(p + 1) ? "on" : ""}`} style={{ left: `${(i + 1) * w - w * 0.3}%`, width: `${w * 0.6}%` }} />
        ) : null,
      )}
    </div>
  );
}
