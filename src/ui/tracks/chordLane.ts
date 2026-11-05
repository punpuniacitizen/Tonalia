// Ayudas para las pistas de acordes: la principal (la cinta) y las de tipo acordes.
// Todas tocan los mismos acordes; cada una con su instrumento y su propio arpegio por acorde.

import { api } from "../../api";
import type { Arpeggio } from "../../bindings/Arpeggio";
import type { ChordView } from "../../bindings/ChordView";
import type { Note } from "../../bindings/Note";
import type { SongView } from "../../bindings/SongView";
import { TICKS_PER_BEAT } from "../../lib/music";
import { chordKey, type ChordLane } from "../../stores/notes";
import { useUi, type ChordLaneView } from "../../stores/ui";

/** Arpegio de un acorde en una pista de acordes (null = en bloque). */
export function laneArp(c: ChordView, lane: ChordLane): Arpeggio | null {
  if (lane === "main") return c.arp ?? null;
  return c.layers.find((l) => l.track === lane)?.arp ?? null;
}

/** Lo que toca una pista de acordes en un acorde (posiciones absolutas). */
export function laneChordNotes(view: SongView, lane: ChordLane, c: ChordView): Note[] {
  if (lane === "main") return c.played;
  const all = view.trackNotes.find((t) => t.track === lane)?.notes ?? [];
  return all.filter((n) => n.position >= c.start && n.position < c.start + c.length);
}

export function laneInstrument(view: SongView, lane: ChordLane): string {
  if (lane === "main") return view.song.chordTrack.instrument;
  return view.song.tracks.find((t) => t.id === lane)?.instrument ?? "piano";
}

/** El `track` que espera el comando setArpeggio (null = la principal). */
export const laneTrack = (lane: ChordLane): number | null => (lane === "main" ? null : lane);

/** Escucha unas notas desde `start`, al tempo de la canción. */
export function playNotes(view: SongView, notes: Note[], start: number, instrument: string) {
  const secondsPerTick = 60 / view.song.bpm / TICKS_PER_BEAT;
  void api.previewSequence(
    notes.map((n) => ({
      pitch: n.pitch,
      delay: (n.position - start) * secondsPerTick,
      duration: Math.max(0.12, n.length * secondsPerTick),
      velocity: n.velocity,
    })),
    instrument,
  );
}

export function playLaneChord(view: SongView, lane: ChordLane, c: ChordView) {
  playNotes(view, laneChordNotes(view, lane, c), c.start, laneInstrument(view, lane));
}

/** Vista elegida para una pista de acordes. */
export function useLaneView(lane: ChordLane): ChordLaneView {
  return useUi((s) => s.chordViews[String(lane)] ?? "blocks");
}

export function setLaneView(lane: ChordLane, mode: ChordLaneView) {
  const { chordViews, set } = useUi.getState();
  set({ chordViews: { ...chordViews, [String(lane)]: mode } });
}

/** Clic en un acorde de una pista de acordes: lo elige (Mayús suma/quita), lo selecciona y suena. */
export function pickLaneChord(view: SongView, lane: ChordLane, c: ChordView, toggle: boolean, pick: (lane: ChordLane, keys: string[], toggle?: boolean) => void) {
  pick(lane, [chordKey(c)], toggle);
  useUi.getState().select({ section: c.section, index: c.index });
  useUi.getState().set({ newChordLength: c.length });
  playLaneChord(view, lane, c);
}

/** Doble clic: la ventana de extensiones y voces al lado del acorde. */
export function openChordTools(c: ChordView, el: Element) {
  const r = el.getBoundingClientRect();
  useUi.getState().select({ section: c.section, index: c.index });
  useUi.getState().set({ chordTools: { tab: "extensions", anchor: { left: r.left, right: r.right, top: r.top } } });
}
