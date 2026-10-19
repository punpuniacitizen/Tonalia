import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { ChordView } from "../../bindings/ChordView";
import { chordSymbol, functionColor, romanSymbol, spelledName } from "../../lib/music";
import { reasonText } from "../../lib/reason";
import { useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";
import "./lenses.css";

/** Tarjeta del acorde seleccionado: anatomía básica y "por qué" de su llegada. */
export function ChordLens({ chord }: { chord: ChordView }) {
  const { t } = useTranslation();
  const notation = useUi((s) => s.notation);
  const level = useUi((s) => s.level);
  const edit = useSong((s) => s.edit);
  const { label, transition } = chord;
  const hasContext = transition.reason.kind !== "noContext";

  return (
    <aside
      key={`${chord.section}-${chord.index}`}
      className="chord-lens glass"
      style={{ ["--lens-color" as string]: functionColor(label.function) }}
      aria-label={chordSymbol(label, notation)}
    >
      <div className="lens-head">
        <span className="lens-symbol">{chordSymbol(label, notation)}</span>
        <span className="lens-roman">{romanSymbol(label)}</span>
      </div>

      <div className="lens-function">
        <span className="dot" />
        {t(`function.${label.function}`)}
        <small>— {t(`function.${label.function}Hint`)}</small>
      </div>

      <MiniKeys pitchClasses={label.pitchClasses} root={chord.chord.root} />

      <div className="lens-notes" aria-label={t("lens.notes")}>
        {label.notes.map((n, i) => (
          <span key={i} className={`lens-note ${i === 0 ? "is-root" : ""}`}>
            {spelledName(n, notation)}
          </span>
        ))}
      </div>

      {hasContext && (
        <div className="lens-reason">
          <div className="score-wrap" title={t("lens.transition")}>
            <div className="score-meter" style={{ ["--score" as string]: transition.score }} />
            <span>{Math.round(transition.score * 100)}</span>
          </div>
          <div>{reasonText(t, transition.reason)}</div>
        </div>
      )}

      <div className="lens-actions">
        <button className="icon-button" title={t("lens.preview")} onClick={() => api.previewChord(chord.chord, chord.key.root)}>
          <Icon name="speaker" />
        </button>
        <button
          className="icon-button"
          title={`${t("edit.delete")} (Supr)`}
          onClick={() => edit({ type: "removeChords", chords: [{ section: chord.section, index: chord.index }] })}
        >
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

// Teclas blancas (clase de altura) y negras (clase de altura, posición en % del ancho).
const WHITES = [0, 2, 4, 5, 7, 9, 11];
const BLACKS: [number, number][] = [
  [1, 9.5],
  [3, 23.8],
  [6, 52.4],
  [8, 66.7],
  [10, 81],
];

function MiniKeys({ pitchClasses, root }: { pitchClasses: number[]; root: number }) {
  const on = new Set(pitchClasses);
  return (
    <div className="mini-keys" aria-hidden="true">
      {WHITES.map((pc) => (
        <div key={pc} className={`white ${on.has(pc) ? "is-on" : ""} ${pc === root ? "is-root" : ""}`} />
      ))}
      {BLACKS.map(([pc, x]) => (
        <div key={pc} className={`black ${on.has(pc) ? "is-on" : ""}`} style={{ left: `${x}%` }} />
      ))}
    </div>
  );
}
