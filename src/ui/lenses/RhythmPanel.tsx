// Pestaña «Ritmo» de la ventana del acorde: duración y silencio antes.
// (El arpegio se hace con la herramienta «Arpegiar» de cada pista de acordes.)

import { useTranslation } from "react-i18next";

import type { ChordView } from "../../bindings/ChordView";
import { formatLength, LENGTH_CHOICES } from "../../lib/duration";
import { TICKS_PER_BAR } from "../../lib/music";
import { useSong } from "../../stores/song";

const GAPS = [0, TICKS_PER_BAR / 8, TICKS_PER_BAR / 4, TICKS_PER_BAR / 2, TICKS_PER_BAR];

export function RhythmPanel({ chord }: { chord: ChordView }) {
  const { t } = useTranslation();
  const edit = useSong((s) => s.edit);
  const at = { section: chord.section, index: chord.index };
  const len = (ticks: number) => formatLength(ticks, t("rhythm.bar"), t("rhythm.bars"));

  return (
    <div className="rhythm-panel">
      <section>
        <h4>{t("rhythm.length")}</h4>
        <div className="grid-chips">
          {LENGTH_CHOICES.map((ticks) => (
            <button
              key={ticks}
              className={`grid-chip ${ticks === chord.length ? "is-active" : ""}`}
              onClick={() => void edit({ type: "resizeChord", at, length: ticks })}
            >
              {len(ticks)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h4>{t("rhythm.gap")}</h4>
        <div className="grid-chips">
          {GAPS.map((ticks) => (
            <button
              key={ticks}
              className={`grid-chip ${ticks === chord.gap ? "is-active" : ""}`}
              onClick={() => void edit({ type: "setChordGap", at, gap: ticks })}
            >
              {ticks === 0 ? t("rhythm.noGap") : len(ticks)}
            </button>
          ))}
        </div>
        <p className="rhythm-hint">{t("rhythm.gapHint")}</p>
      </section>

      <p className="rhythm-hint">{t("rhythm.arpMoved")}</p>
    </div>
  );
}
