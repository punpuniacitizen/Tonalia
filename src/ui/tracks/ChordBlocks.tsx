// Vista «bloques» de una pista de acordes: los acordes de la cinta con su nombre y, en
// miniatura, lo que toca esta pista (se ve el dibujo del arpegio). Clic elige (Mayús suma),
// doble clic abre extensiones y voces.

import { useTranslation } from "react-i18next";

import type { SongView } from "../../bindings/SongView";
import { chordSymbol, functionColor, romanSymbol } from "../../lib/music";
import { chordKey, useNotes } from "../../stores/notes";
import { useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";
import { pxPerTick, tickToX } from "../timeline/geometry";
import { laneArp, openChordTools, pickLaneChord } from "./chordLane";

const HEIGHT = 52;
const EMPTY = new Set<string>();

export function ChordBlocks({ lane, width }: { lane: number; width: number }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView;
  const pxPerBar = useUi((s) => s.pxPerBar);
  const notation = useUi((s) => s.notation);
  const symbols = useUi((s) => s.symbols);
  const picked = useNotes((s) => (s.chordPick?.lane === lane ? s.chordPick.keys : EMPTY));
  const pickChords = useNotes((s) => s.pickChords);
  const ppt = pxPerTick(pxPerBar);
  const notes = view.trackNotes.find((n) => n.track === lane)?.notes ?? [];
  const lo = Math.min(...notes.map((n) => n.pitch), 127);
  const hi = Math.max(...notes.map((n) => n.pitch), 0);
  const range = Math.max(12, hi - lo + 1);

  return (
    <div className="chord-blocks" style={{ width, height: HEIGHT }}>
      {view.chords.length === 0 && <span className="lane-mini-empty">{t("chordLane.emptyHint")}</span>}
      {view.chords.map((c) => {
        const name = symbols === "names" ? chordSymbol(c.label, notation) : romanSymbol(c.label);
        return (
          <div
            key={`${c.section}-${c.index}`}
            className={`chord-chip ${picked.has(chordKey(c)) ? "is-picked" : ""}`}
            style={{ left: tickToX(c.start, pxPerBar) + 2, width: Math.max(10, c.length * ppt - 4), ["--fn" as string]: functionColor(c.label.function) }}
            title={t("chordLane.pickHint")}
            onPointerDown={(e) => e.button === 0 && pickLaneChord(view, lane, c, e.shiftKey, pickChords)}
            onDoubleClick={(e) => openChordTools(c, e.currentTarget)}
          >
            <span className="chord-chip-name">
              {name}
              {laneArp(c, lane) && <Icon name="arp" size={11} />}
            </span>
          </div>
        );
      })}
      {notes.map((n, i) => (
        <span
          key={i}
          className="mini-note chord-chip-note"
          style={{
            left: tickToX(n.position, pxPerBar) + 2,
            width: Math.max(2, n.length * ppt - 1),
            top: 20 + ((hi - n.pitch) / range) * (HEIGHT - 28),
          }}
        />
      ))}
    </div>
  );
}
