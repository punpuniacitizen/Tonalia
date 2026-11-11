// Herramienta «Convertir a notas» de las pistas de acordes: escribe lo que toca la pista
// (en bloque, arpegiado, con ritmo o rasgueo) como notas sueltas en una pista de piano roll,
// para retocarlo a mano. Puede ir a una pista nueva o sumarse a una que ya exista, y
// silenciar la pista de acordes para que no suene doble. Todo en un solo paso de deshacer.

import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { EditCommand } from "../../bindings/EditCommand";
import type { SongView } from "../../bindings/SongView";
import { noteKey, useNotes, type ChordLane } from "../../stores/notes";
import { useSong } from "../../stores/song";
import { laneChordNotes, laneInstrument } from "./chordLane";
import { dedupeNotes, useToolScope } from "./toolScope";

function laneSettings(view: SongView, lane: ChordLane) {
  if (lane === "main") return { name: null, ...view.song.chordTrack };
  return view.song.tracks.find((t) => t.id === lane)!;
}

export function ConvertPanel({ lane, close }: { lane: ChordLane; close: () => void }) {
  const { t } = useTranslation();
  const edit = useSong((s) => s.edit);
  const select = useNotes((s) => s.select);
  const toggleExpanded = useNotes((s) => s.toggleExpanded);
  const { view, chords, empty, scopeBar } = useToolScope({ kind: "chords", lane });
  const noteTracks = view.song.tracks.filter((tr) => tr.kind === "notes");
  const [dest, setDest] = useState<number | "new">("new");
  const all = chords.length === view.chords.length;
  const [mute, setMute] = useState(true);

  const source = laneSettings(view, lane);
  const notes = chords.flatMap((c) => laneChordNotes(view, lane, c));

  const apply = async () => {
    if (!notes.length) return;
    const commands: EditCommand[] = [];
    let track: number;
    if (dest === "new") {
      // El id que recibirá la pista nueva es el próximo libre de la canción.
      track = view.song.nextId;
      const base = lane === "main" ? t("tracks.chords") : (source.name ?? t("tracks.chords"));
      commands.push(
        { type: "addTrack", name: `${base} (${t("convert.notesSuffix")})`, instrument: laneInstrument(view, lane), kind: "notes" },
        { type: "updateTrack", track, name: null, instrument: null, volume: source.volume, pan: source.pan, muted: null, solo: null },
        { type: "setTrackNotes", track, notes: dedupeNotes(notes) },
      );
    } else {
      track = dest;
      const existing = view.trackNotes.find((n) => n.track === dest)?.notes ?? [];
      commands.push({ type: "setTrackNotes", track, notes: dedupeNotes([...existing, ...notes]) });
    }
    if (mute && all && (!source.muted || source.solo)) {
      // Si la pista de acordes estaba en solo, el solo pasa a las notas: si no, no sonarían.
      const solo = source.solo ? false : null;
      commands.push(
        lane === "main"
          ? { type: "updateChordTrack", instrument: null, volume: null, pan: null, muted: true, solo }
          : { type: "updateTrack", track: lane, name: null, instrument: null, volume: null, pan: null, muted: true, solo },
      );
      if (source.solo) commands.push({ type: "updateTrack", track, name: null, instrument: null, volume: null, pan: null, muted: null, solo: true });
    }
    const next = await edit({ type: "batch", commands });
    if (next) {
      // Abrir el piano roll de la pista con las notas elegidas, listo para retocar.
      if (useNotes.getState().expandedTrack !== track) toggleExpanded(track);
      select(track, notes.map(noteKey));
    }
    close();
  };

  return (
    <div className="arp-panel">
      {scopeBar}
      <div className="arp-row">
        <span>{t("convert.to")}</span>
        <select className="convert-dest" value={String(dest)} onChange={(e) => setDest(e.target.value === "new" ? "new" : Number(e.target.value))}>
          <option value="new">{t("convert.newTrack")}</option>
          {noteTracks.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.name}
            </option>
          ))}
        </select>
      </div>
      {all ? (
        <div className="arp-row arp-checks">
          <label title={t("convert.muteHint")}>
            <input type="checkbox" checked={mute} onChange={(e) => setMute(e.target.checked)} /> {t("convert.mute")}
          </label>
        </div>
      ) : (
        <p className="arp-note">{t("convert.partialHint")}</p>
      )}
      <p className="arp-note">{t("convert.hint", { count: notes.length })}</p>
      {empty && <p className="arp-note">{t("arp.nothing")}</p>}
      <div className="arp-actions">
        <button className="primary-button small" onClick={() => void apply()} disabled={empty || !notes.length}>
          {t("convert.apply")}
        </button>
      </div>
    </div>
  );
}
