// Constructor de acordes: base + séptima + tensiones, con una "torre de terceras" que muestra
// cómo las extensiones (9, 11, 13) son simplemente terceras apiladas encima del acorde.

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { ChordLabel } from "../../bindings/ChordLabel";
import type { ChordView } from "../../bindings/ChordView";
import {
  BASES,
  EXTS,
  SEVENTHS,
  buildChord,
  extLabel,
  parseChord,
  toggleExt,
  type BuilderState,
  type Ext,
} from "../../lib/chordBuilder";
import { chordSymbol, romanSymbol } from "../../lib/music";
import { useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";

export function ChordBuilder({ chord }: { chord: ChordView }) {
  const { t } = useTranslation();
  const notation = useUi((s) => s.notation);
  const select = useUi((s) => s.select);
  const edit = useSong((s) => s.edit);
  const original = useMemo(() => parseChord(chord.chord), [chord.chord]);
  const [state, setState] = useState<BuilderState>(original);
  const [label, setLabel] = useState<ChordLabel>(chord.label);
  const previewTimer = useRef<number | undefined>(undefined);
  const draft = buildChord(chord.chord.root, state);
  const draftId = JSON.stringify(draft);
  const changed = draftId !== JSON.stringify(buildChord(chord.chord.root, original));

  // Al seleccionar otro acorde, el constructor parte de él.
  useEffect(() => setState(original), [original]);

  // Nombre en vivo y escucha del borrador.
  useEffect(() => {
    let alive = true;
    void api.describeChord(draft, chord.key).then((l) => alive && setLabel(l));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, JSON.stringify(chord.key)]);

  const update = (next: BuilderState) => {
    setState(next);
    window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => void api.previewChord(buildChord(chord.chord.root, next), chord.key.root), 90);
  };

  const at = { section: chord.section, index: chord.index };
  const apply = () => void edit({ type: "replaceChord", at, chord: draft });
  const addAfter = () =>
    void edit({ type: "insertChord", section: at.section, index: at.index + 1, chord: draft, length: chord.length }).then(
      (v) => v && select({ section: at.section, index: at.index + 1 }),
    );

  return (
    <div className="builder" data-tip="concept.extensions">
      <div className="builder-head">
        <span className="builder-symbol">{chordSymbol(label, notation)}</span>
        <span className="builder-roman">{romanSymbol(label)}</span>
      </div>

      <div className="builder-body">
        <Tower state={state} />
        <div className="builder-controls">
          <div className="chip-row" role="radiogroup" aria-label={t("builder.base")}>
            {BASES.map((b) => (
              <button key={b} className={`bchip ${state.base === b ? "is-on" : ""}`} title={t(`builder.baseHint.${b}`)} onClick={() => update({ ...state, base: b, seventh: b !== "dim" && state.seventh === "dim7" ? "none" : state.seventh })}>
                {t(`builder.bases.${b}`)}
              </button>
            ))}
          </div>
          <div className="chip-row" role="radiogroup" aria-label={t("builder.seventh")}>
            {SEVENTHS.filter((s) => s !== "dim7" || state.base === "dim").map((s) => (
              <button key={s} className={`bchip ${state.seventh === s ? "is-on" : ""}`} title={t(`builder.seventhHint.${s}`)} onClick={() => update({ ...state, seventh: s })}>
                {t(`builder.sevenths.${s}`)}
              </button>
            ))}
            <button
              className={`bchip ${state.sixth ? "is-on" : ""}`}
              disabled={state.seventh !== "none"}
              title={t("builder.sixthHint")}
              onClick={() => update({ ...state, sixth: !state.sixth })}
            >
              6
            </button>
          </div>
          <div className="chip-row tensions" aria-label={t("builder.tensions")}>
            {EXTS.map((e) => (
              <button key={e} className={`bchip tension ${state.ext.includes(e) ? "is-on" : ""}`} title={t(`builder.extHint.${e}`)} onClick={() => update(toggleExt(state, e))}>
                {extLabel(e)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="builder-actions">
        <button className="ghost-button small" onClick={() => api.previewChord(draft, chord.key.root)}>
          <Icon name="speaker" size={13} /> {t("lens.preview")}
        </button>
        <button className="ghost-button small" disabled={!changed} onClick={() => update(original)} title={t("builder.resetHint")}>
          <Icon name="undo" size={13} />
        </button>
        <span className="builder-spacer" />
        <button className="ghost-button small" onClick={addAfter}>
          <Icon name="plus" size={13} /> {t("builder.addAfter")}
        </button>
        <button className="ghost-button small primary" disabled={!changed} onClick={apply}>
          {t("builder.apply")}
        </button>
      </div>
    </div>
  );
}

/** Torre de terceras: de la fundamental (abajo) a la trecena (arriba). */
function Tower({ state }: { state: BuilderState }) {
  const has = (e: Ext) => state.ext.includes(e);
  const third = { major: "3", minor: "♭3", dim: "♭3", aug: "3", sus2: "2", sus4: "4" }[state.base];
  const fifth = state.base === "dim" ? "♭5" : state.base === "aug" ? "♯5" : "5";
  const seventh = state.seventh === "b7" ? "♭7" : state.seventh === "maj7" ? "7" : state.seventh === "dim7" ? "°7" : state.sixth ? "6" : null;
  const join = (xs: Ext[]) => xs.filter(has).map(extLabel).join(" ") || null;
  const rows: { label: string | null; kind: "core" | "tension" }[] = [
    { label: join(["b13", "13"]), kind: "tension" },
    { label: join(["11", "#11"]), kind: "tension" },
    { label: join(["b9", "9", "#9"]), kind: "tension" },
    { label: seventh, kind: "core" },
    { label: fifth, kind: "core" },
    { label: third, kind: "core" },
    { label: "R", kind: "core" },
  ];
  return (
    <div className="tower" aria-hidden="true">
      {rows.map((r, i) => (
        <motion.div
          key={i}
          className={`tower-step ${r.label ? `is-on ${r.kind}` : ""}`}
          animate={{ opacity: r.label ? 1 : 0.35, scaleX: r.label ? 1 : 0.85 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
        >
          {r.label ?? "·"}
        </motion.div>
      ))}
    </div>
  );
}
