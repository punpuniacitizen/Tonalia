// Herramienta «Octava de la pista» de las pistas de acordes: corre una o más octavas todo lo
// que toca la pista, sin tocar los voicings (así el colchón puede ir grave y el piano agudo
// tocando los mismos acordes). Se aplica al momento y se escucha el primer acorde.

import { useTranslation } from "react-i18next";

import type { SongView } from "../../bindings/SongView";
import type { ChordLane } from "../../stores/notes";
import { useSong } from "../../stores/song";
import { laneChordNotes, laneInstrument, laneOctave, laneTrack, playNotes } from "./chordLane";

const OCTAVES = [-2, -1, 0, 1, 2];

export function OctavePanel({ lane }: { lane: ChordLane }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView;
  const edit = useSong((s) => s.edit);
  const current = laneOctave(view, lane);

  const choose = async (octave: number) => {
    const next = await edit({ type: "setLaneOctave", track: laneTrack(lane), octave });
    const c = next?.chords[0];
    if (next && c) playNotes(next, laneChordNotes(next, lane, c), c.start, laneInstrument(next, lane));
  };

  return (
    <div className="arp-panel">
      <div className="grid-chips octave-chips">
        {OCTAVES.map((o) => (
          <button key={o} className={`grid-chip ${current === o ? "is-active" : ""}`} onClick={() => void choose(o)}>
            {o === 0 ? t("octave.none") : `${o > 0 ? "+" : "−"}${Math.abs(o)}`}
          </button>
        ))}
      </div>
      <p className="arp-note">{t("octave.hint")}</p>
    </div>
  );
}

/** Marca junto al nombre de la pista cuando suena corrida de octava. */
export function OctaveBadge({ lane }: { lane: ChordLane }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView | null;
  const octave = view ? laneOctave(view, lane) : 0;
  if (!octave) return null;
  return (
    <span className="octave-badge" title={t("octave.badgeHint")}>
      {octave > 0 ? "+" : "−"}
      {Math.abs(octave)} 8va
    </span>
  );
}
