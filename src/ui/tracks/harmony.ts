// Regiones armónicas de la canción: en cada tramo de tiempo, qué acorde suena y qué escala
// rige. El piano roll las usa para iluminar las filas (notas del acorde, de la escala, fuera).

import type { Function as TonalFunction } from "../../bindings/Function";
import type { Note } from "../../bindings/Note";
import type { SongView } from "../../bindings/SongView";
import { keyPitchClasses } from "../../lib/pitch";

export type Region = {
  start: number;
  end: number;
  chordPcs: Set<number> | null;
  root: number | null;
  scalePcs: Set<number>;
  fn: TonalFunction | null;
  voicing: Note[];
};

function keyAt(view: SongView, tick: number) {
  const containing = view.sections.filter((s) => tick >= s.start && tick < s.start + s.length);
  const deepest = containing.sort((a, b) => b.depth - a.depth)[0];
  return deepest?.key ?? view.song.homeKey;
}

function gap(view: SongView, start: number, end: number): Region {
  return { start, end, chordPcs: null, root: null, scalePcs: keyPitchClasses(keyAt(view, start)), fn: null, voicing: [] };
}

export function harmonyRegions(view: SongView, contentEnd: number): Region[] {
  const regions: Region[] = [];
  let t = 0;
  for (const c of view.chords) {
    if (c.start > t) regions.push(gap(view, t, c.start));
    regions.push({
      start: c.start,
      end: c.start + c.length,
      chordPcs: new Set(c.label.pitchClasses),
      root: c.chord.root,
      scalePcs: keyPitchClasses(c.key),
      fn: c.label.function,
      voicing: c.voicing,
    });
    t = c.start + c.length;
  }
  if (t < contentEnd) regions.push(gap(view, t, contentEnd));
  return regions;
}

export function regionAt(regions: Region[], tick: number): Region | null {
  return regions.find((r) => tick >= r.start && tick < r.end) ?? null;
}
