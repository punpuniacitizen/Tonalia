import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { ChordView } from "../../bindings/ChordView";
import type { SubstituteView } from "../../bindings/SubstituteView";
import { chordSymbol, functionColor, romanSymbol, spelledName } from "../../lib/music";
import { reasonText } from "../../lib/reason";
import { sameRef, useUi } from "../../stores/ui";
import { useSong } from "../../stores/song";
import { Icon } from "../common/Icon";
import { Segmented } from "../common/Segmented";
import { ChromaticClock, Fretboard, MiniKeys } from "./Anatomy";
import "./lenses.css";

type AnatomyView = "keys" | "clock" | "guitar";

/** Tarjeta del acorde seleccionado: anatomía, el porqué de su llegada y alternativas. */
export function ChordLens({ chord }: { chord: ChordView }) {
  const { t } = useTranslation();
  const notation = useUi((s) => s.notation);
  const level = useUi((s) => s.level);
  const select = useUi((s) => s.select);
  const view = useSong((s) => s.view);
  const edit = useSong((s) => s.edit);
  const [anatomy, setAnatomy] = useState<AnatomyView>("keys");
  const [subs, setSubs] = useState<SubstituteView[]>([]);
  const { label, transition } = chord;
  const hasContext = transition.reason.kind !== "noContext";
  const position = view?.chords.findIndex((c) => sameRef(c, chord)) ?? -1;
  const previous = position > 0 ? view!.chords[position - 1].chord : null;

  useEffect(() => {
    let alive = true;
    void api.substitutes(chord.chord, chord.key, previous).then((s) => alive && setSubs(s));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(chord.chord), JSON.stringify(chord.key), JSON.stringify(previous)]);

  const at = { section: chord.section, index: chord.index };
  const applySub = (s: SubstituteView) => {
    if (s.kind === "secondaryDominant") {
      void edit({ type: "insertChord", section: at.section, index: at.index, chord: s.chord, length: null }).then((v) => v && select(at));
    } else {
      void edit({ type: "replaceChord", at, chord: s.chord });
    }
  };

  return (
    <aside
      key={`${chord.section}-${chord.index}`}
      className="chord-lens glass"
      style={{ ["--lens-color" as string]: functionColor(label.function) }}
      aria-label={chordSymbol(label, notation)}
    >
      <div className="lens-head" data-tip="concept.majorMinor">
        <span className="lens-symbol">{chordSymbol(label, notation)}</span>
        <span className="lens-roman">{romanSymbol(label)}</span>
      </div>

      <div className="lens-function" data-tip={`function.${label.function}`}>
        <span className="dot" />
        {t(`function.${label.function}`)}
        <small>— {t(`function.${label.function}Hint`)}</small>
      </div>

      <Segmented<AnatomyView>
        label={t("lens.anatomy")}
        value={anatomy}
        onChange={setAnatomy}
        options={[
          { value: "keys", label: t("lens.keys") },
          { value: "clock", label: t("lens.clock"), title: t("lens.clockHint") },
          { value: "guitar", label: t("lens.guitar") },
        ]}
      />
      {anatomy === "keys" && <MiniKeys pitchClasses={label.pitchClasses} root={chord.chord.root} />}
      {anatomy === "clock" && <ChromaticClock chord={chord.chord} notes={label.notes} notation={notation} />}
      {anatomy === "guitar" && <Fretboard pitchClasses={label.pitchClasses} root={chord.chord.root} />}

      <div className="lens-notes" aria-label={t("lens.notes")}>
        {label.notes.map((n, i) => (
          <span key={i} className={`lens-note ${i === 0 ? "is-root" : ""}`}>
            {spelledName(n, notation)}
          </span>
        ))}
      </div>

      {hasContext && (
        <div className="lens-reason" data-tip="concept.transitions">
          <div className="score-wrap" title={t("lens.transition")}>
            <div className="score-meter" style={{ ["--score" as string]: transition.score }} />
            <span>{Math.round(transition.score * 100)}</span>
          </div>
          <div>{reasonText(t, transition.reason)}</div>
        </div>
      )}

      {subs.length > 0 && (
        <div className="lens-subs">
          <h4>{t("lens.alternatives")}</h4>
          <div className="sub-chips">
            {subs.map((s) => (
              <button
                key={JSON.stringify(s.chord) + s.kind}
                className="sub-chip"
                style={{ ["--fn" as string]: functionColor(s.label.function) }}
                title={t(`subs.${s.kind}Hint`)}
                onPointerEnter={() => api.previewChord(s.chord, chord.key.root)}
                onClick={() => applySub(s)}
              >
                <strong>{chordSymbol(s.label, notation)}</strong>
                <small>{t(`subs.${s.kind}`)}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="lens-actions">
        <button className="icon-button" title={t("lens.preview")} onClick={() => api.previewChord(chord.chord, chord.key.root)}>
          <Icon name="speaker" />
        </button>
        <button className="icon-button" title={`${t("edit.delete")} (Supr)`} onClick={() => edit({ type: "removeChords", chords: [at] })}>
          <Icon name="trash" />
        </button>
      </div>
      {level === "advanced" && (
        <small style={{ color: "var(--text-2)" }}>
          {t("lens.tension")} {label.tension.toFixed(2)}
        </small>
      )}
    </aside>
  );
}
