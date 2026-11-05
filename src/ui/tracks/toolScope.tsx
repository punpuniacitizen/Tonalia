// A qué se aplica una herramienta: lo elegido (acordes de una pista de acordes o notas de
// un piano roll) o todo. Lo comparten todos los paneles de la caja de herramientas.

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { ChordView } from "../../bindings/ChordView";
import type { Note } from "../../bindings/Note";
import type { SongView } from "../../bindings/SongView";
import type { Track } from "../../bindings/Track";
import { chordKey, noteKey, useNotes, type ChordLane } from "../../stores/notes";
import { useSong } from "../../stores/song";
import { Segmented } from "../common/Segmented";
import { laneInstrument } from "./chordLane";

export type ToolsTarget = { kind: "chords"; lane: ChordLane } | { kind: "notes"; track: Track };

export const sortNotes = (notes: Note[]) => [...notes].sort((a, b) => a.position - b.position || a.pitch - b.pitch);

/** Una nota por posición y altura (si dos caen en el mismo lugar, queda la última). */
export function dedupeNotes(notes: Note[]): Note[] {
  const byKey = new Map<string, Note>();
  for (const n of notes) byKey.set(noteKey(n), n);
  return sortNotes([...byKey.values()]);
}

export function useToolScope(target: ToolsTarget) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView;
  const chordPick = useNotes((s) => s.chordPick);
  const selection = useNotes((s) => s.selection);
  const selectionTrack = useNotes((s) => s.selectionTrack);

  const allChords = view.chords;
  const pickedChords = target.kind === "chords" && chordPick?.lane === target.lane ? allChords.filter((c) => chordPick.keys.has(chordKey(c))) : [];
  const allNotes = target.kind === "notes" ? (view.trackNotes.find((n) => n.track === target.track.id)?.notes ?? []) : [];
  const pickedNotes = target.kind === "notes" && selectionTrack === target.track.id ? allNotes.filter((n) => selection.has(noteKey(n))) : [];
  const pickedCount = target.kind === "chords" ? pickedChords.length : pickedNotes.length;
  // Se decide al abrir: lo elegido si hay algo, si no todo.
  const [scope, setScope] = useState<"picked" | "all">(pickedCount > 0 ? "picked" : "all");
  const usePicked = scope === "picked" && pickedCount > 0;
  const chords: ChordView[] = usePicked ? pickedChords : allChords;
  const notes: Note[] = usePicked ? pickedNotes : allNotes;
  const empty = target.kind === "chords" ? chords.length === 0 : notes.length === 0;
  const instrument = target.kind === "chords" ? laneInstrument(view, target.lane) : target.track.instrument;

  const options =
    target.kind === "chords"
      ? [
          { value: "picked" as const, label: t("arp.picked", { count: pickedChords.length }), title: t("arp.pickedChordsHint") },
          { value: "all" as const, label: t("arp.allChords", { count: allChords.length }) },
        ]
      : [
          { value: "picked" as const, label: t("arp.picked", { count: pickedNotes.length }), title: t("arp.pickedNotesHint") },
          { value: "all" as const, label: t("arp.allNotes", { count: allNotes.length }) },
        ];

  const scopeBar: ReactNode = (
    <>
      <div className="arp-scope">
        <Segmented<"picked" | "all">
          label={t("arp.scope")}
          value={usePicked ? "picked" : "all"}
          onChange={(v) => (v === "picked" && pickedCount === 0 ? undefined : setScope(v))}
          options={options}
        />
      </div>
      {pickedCount === 0 && <p className="arp-note">{target.kind === "chords" ? t("arp.pickChordsHint") : t("arp.pickNotesHint")}</p>}
    </>
  );

  return { view, chords, notes, allNotes, empty, instrument, scopeBar };
}
