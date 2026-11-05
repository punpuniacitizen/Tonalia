// Herramienta «Acorde desde notas»: reconoce el acorde de las notas seleccionadas y permite
// fijarlo en la cinta (reemplaza el que suena ahí) o añadirlo como acorde nuevo.

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { DetectedView } from "../../bindings/DetectedView";
import type { SongView } from "../../bindings/SongView";
import type { Track } from "../../bindings/Track";
import { chordSymbol, functionColor, romanSymbol } from "../../lib/music";
import { noteKey } from "../../stores/notes";
import { useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";

export function NotesToChordPanel({ track, keys, close }: { track: Track; keys: Set<string>; close: () => void }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView;
  const edit = useSong((s) => s.edit);
  const notation = useUi((s) => s.notation);
  const [found, setFound] = useState<DetectedView[]>([]);

  const notes = (view.trackNotes.find((n) => n.track === track.id)?.notes ?? []).filter((n) => keys.has(noteKey(n)));
  const start = Math.min(...notes.map((n) => n.position));
  const target = view.chords.find((c) => start >= c.start && start < c.start + c.length) ?? null;
  const key = target?.key ?? view.song.homeKey;
  const pitchesId = notes.map((n) => n.pitch).join(",");

  useEffect(() => {
    if (!notes.length) return;
    void api.detectChord(notes.map((n) => n.pitch), key).then(setFound);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitchesId, JSON.stringify(key)]);

  const leaves = view.sections.filter((s) => s.isLeaf);
  const setAsChord = (d: DetectedView) =>
    target ? edit({ type: "replaceChord", at: { section: target.section, index: target.index }, chord: d.chord }) : addAsChord(d);
  const addAsChord = (d: DetectedView) => {
    const at = target
      ? { section: target.section, index: target.index + 1 }
      : { section: leaves[leaves.length - 1].id, index: view.chords.filter((c) => c.section === leaves[leaves.length - 1].id).length };
    return edit({ type: "insertChord", section: at.section, index: at.index, chord: d.chord, length: null });
  };

  return (
    <div className="detected-list">
      <p className="arp-note">{t("piano.detected")}</p>
      {found.slice(0, 4).map((d, i) => (
        <div key={i} className="detected-item" style={{ ["--fn" as string]: functionColor(d.label.function) }}>
          <span className="detected-symbol">{chordSymbol(d.label, notation)}</span>
          <span className="detected-roman">{romanSymbol(d.label)}</span>
          {!d.rootIsBass && <small>{t("piano.inversion")}</small>}
          <span className="detected-actions">
            <button
              onClick={() => {
                void setAsChord(d);
                close();
              }}
              title={target ? t("piano.setHint") : undefined}
            >
              {t("piano.set")}
            </button>
            <button
              onClick={() => {
                void addAsChord(d);
                close();
              }}
            >
              {t("piano.add")}
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
