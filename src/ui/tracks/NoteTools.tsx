// Herramientas para pistas de notas: Cuantizar, Ajustar a la escala y Bajo automático.
// Todas reemplazan notas de la pista (se deshacen con Ctrl+Z).

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { BassStyle } from "../../bindings/BassStyle";
import type { Note } from "../../bindings/Note";
import type { SongView } from "../../bindings/SongView";
import type { Track } from "../../bindings/Track";
import { TICKS_PER_BAR } from "../../lib/music";
import { keyPitchClasses } from "../../lib/pitch";
import { noteKey, useNotes } from "../../stores/notes";
import { useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";
import { Segmented } from "../common/Segmented";
import { gridStep } from "../timeline/geometry";
import { playNotes } from "./chordLane";
import { harmonyRegions, regionAt } from "./harmony";
import { dedupeNotes, useToolScope } from "./toolScope";

const MIN_LENGTH = TICKS_PER_BAR / 64;
const GRIDS: { div: number; label: string; triplet?: boolean }[] = [
  { div: 4, label: "1/4" },
  { div: 8, label: "1/8" },
  { div: 16, label: "1/16" },
  { div: 32, label: "1/32" },
  { div: 12, label: "1/8", triplet: true },
  { div: 24, label: "1/16", triplet: true },
];

const sameNote = (a: Note, b: Note) => a.position === b.position && a.length === b.length && a.pitch === b.pitch;

/** Reemplaza `before` por `after` dentro de la pista y deja seleccionado el resultado. */
function useReplaceNotes(track: Track) {
  const edit = useSong((s) => s.edit);
  const select = useNotes((s) => s.select);
  return async (all: Note[], before: Note[], after: Note[]) => {
    const removed = new Set(before.map(noteKey));
    const kept = all.filter((n) => !removed.has(noteKey(n)));
    await edit({ type: "setTrackNotes", track: track.id, notes: dedupeNotes([...kept, ...after]) });
    select(track.id, after.map(noteKey));
  };
}

function Actions({ empty, disabled, onApply, onListen }: { empty: boolean; disabled?: boolean; onApply: () => void; onListen?: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      {empty && <p className="arp-note">{t("arp.nothing")}</p>}
      <div className="arp-actions">
        {onListen && (
          <button className="ghost-button small" onClick={onListen} disabled={empty}>
            <Icon name="play" size={12} filled /> {t("rhythm.listen")}
          </button>
        )}
        <button className="primary-button small" onClick={onApply} disabled={empty || disabled}>
          {t("arp.apply")}
        </button>
      </div>
    </>
  );
}

// ---------- Cuantizar ----------

export function QuantizePanel({ track, close }: { track: Track; close: () => void }) {
  const { t } = useTranslation();
  const gridDivisions = useUi((s) => s.gridDivisions);
  const { notes, allNotes, empty, scopeBar } = useToolScope({ kind: "notes", track });
  const replace = useReplaceNotes(track);
  const [div, setDiv] = useState(gridDivisions > 0 ? gridDivisions : 16);
  const [strength, setStrength] = useState(100);
  const [lengths, setLengths] = useState(false);

  const step = gridStep(div);
  const amount = strength / 100;
  const quantized = notes.map((n) => {
    const start = Math.round(n.position / step) * step;
    const position = Math.max(0, Math.round(n.position + (start - n.position) * amount));
    if (!lengths) return { ...n, position };
    const end = n.position + n.length;
    const target = Math.max(Math.round(end / step) * step, start + step);
    const newEnd = Math.round(end + (target - end) * amount);
    return { ...n, position, length: Math.max(MIN_LENGTH, newEnd - position) };
  });
  const moved = quantized.filter((q, i) => !sameNote(q, notes[i])).length;

  return (
    <div className="arp-panel">
      {scopeBar}
      <div className="arp-row">
        <span>{t("quantize.grid")}</span>
        <div className="grid-chips">
          {GRIDS.map((g) => (
            <button key={g.div} className={`grid-chip ${div === g.div ? "is-active" : ""}`} onClick={() => setDiv(g.div)}>
              {g.label}
              {g.triplet && <small> {t("rhythm.triplet")}</small>}
            </button>
          ))}
        </div>
      </div>
      <div className="arp-row">
        <span>
          {t("quantize.strength")}: {strength}%
        </span>
        <input type="range" min={10} max={100} step={10} value={strength} onChange={(e) => setStrength(Number(e.target.value))} title={t("quantize.strengthHint")} />
      </div>
      <div className="arp-row arp-checks">
        <label>
          <input type="checkbox" checked={lengths} onChange={(e) => setLengths(e.target.checked)} /> {t("quantize.lengths")}
        </label>
      </div>
      {!empty && <p className="arp-note">{moved > 0 ? t("quantize.changes", { count: moved }) : t("quantize.none")}</p>}
      <Actions
        empty={empty}
        disabled={moved === 0}
        onApply={() => {
          void replace(allNotes, notes, quantized);
          close();
        }}
      />
    </div>
  );
}

// ---------- Ajustar a la escala ----------

type SnapTarget = "scale" | "chord";

/** La altura más cercana cuya clase está en `pcs` (en empate, hacia abajo). */
function nearestIn(pitch: number, pcs: Set<number>): number {
  for (let d = 0; d <= 6; d++) {
    if (pitch - d >= 0 && pcs.has((pitch - d) % 12)) return pitch - d;
    if (pitch + d <= 127 && pcs.has((pitch + d) % 12)) return pitch + d;
  }
  return pitch;
}

export function ScaleSnapPanel({ track, close }: { track: Track; close: () => void }) {
  const { t } = useTranslation();
  const { view, notes, allNotes, empty, scopeBar } = useToolScope({ kind: "notes", track });
  const replace = useReplaceNotes(track);
  const [target, setTarget] = useState<SnapTarget>("scale");

  const end = Math.max(view.length, ...notes.map((n) => n.position + n.length)) + 1;
  const regions = harmonyRegions(view, end);
  const home = keyPitchClasses(view.song.homeKey);
  const snapped = notes.map((n) => {
    const r = regionAt(regions, n.position);
    const pcs = target === "chord" && r?.chordPcs ? r.chordPcs : (r?.scalePcs ?? home);
    return { ...n, pitch: nearestIn(n.pitch, pcs) };
  });
  const moved = snapped.filter((s, i) => s.pitch !== notes[i].pitch).length;

  return (
    <div className="arp-panel">
      {scopeBar}
      <div className="arp-row">
        <span>{t("snap.target")}</span>
        <Segmented<SnapTarget>
          label={t("snap.target")}
          value={target}
          onChange={setTarget}
          options={[
            { value: "scale", label: t("snap.scale"), title: t("snap.scaleHint") },
            { value: "chord", label: t("snap.chord"), title: t("snap.chordHint") },
          ]}
        />
      </div>
      {!empty && <p className="arp-note">{moved > 0 ? t("snap.changes", { count: moved }) : t("snap.none")}</p>}
      <Actions
        empty={empty}
        disabled={moved === 0}
        onApply={() => {
          void replace(allNotes, notes, snapped);
          close();
        }}
      />
    </div>
  );
}

// ---------- Bajo automático ----------

const BASS_STYLES: BassStyle[] = ["root", "rootFifth", "octaves", "walking"];

export function BassPanel({ track, close }: { track: Track; close: () => void }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView;
  const edit = useSong((s) => s.edit);
  const select = useNotes((s) => s.select);
  const [style, setStyle] = useState<BassStyle>("rootFifth");
  const [useBassSound, setUseBassSound] = useState(track.instrument !== "bass");
  const existing = view.trackNotes.find((n) => n.track === track.id)?.notes.length ?? 0;
  const empty = view.chords.length === 0;
  const instrument = useBassSound ? "bass" : track.instrument;

  const listen = async () => {
    const line = await api.bassLine(style);
    playNotes(view, line.filter((n) => n.position < 2 * TICKS_PER_BAR), 0, instrument);
  };

  const apply = async () => {
    const line = await api.bassLine(style);
    const commands = [{ type: "setTrackNotes" as const, track: track.id, notes: line }];
    await edit(
      useBassSound && track.instrument !== "bass"
        ? {
            type: "batch",
            commands: [
              ...commands,
              { type: "updateTrack", track: track.id, name: null, instrument: "bass", volume: null, pan: null, muted: null, solo: null },
            ],
          }
        : commands[0],
    );
    select(track.id, line.map(noteKey));
    close();
  };

  return (
    <div className="arp-panel">
      <div className="pattern-grid">
        {BASS_STYLES.map((s) => (
          <button key={s} className={`pattern-chip ${style === s ? "is-active" : ""}`} onClick={() => setStyle(s)}>
            <strong>{t(`bass.${s}`)}</strong>
            <small>{t(`bass.${s}Hint`)}</small>
          </button>
        ))}
      </div>
      {track.instrument !== "bass" && (
        <div className="arp-row arp-checks">
          <label>
            <input type="checkbox" checked={useBassSound} onChange={(e) => setUseBassSound(e.target.checked)} /> {t("bass.useBass")}
          </label>
        </div>
      )}
      {empty ? (
        <p className="arp-note">{t("bass.noChords")}</p>
      ) : (
        existing > 0 && <p className="arp-note">{t("bass.replace", { count: existing })}</p>
      )}
      <div className="arp-actions">
        <button className="ghost-button small" onClick={() => void listen()} disabled={empty}>
          <Icon name="play" size={12} filled /> {t("rhythm.listen")}
        </button>
        <button className="primary-button small" onClick={() => void apply()} disabled={empty}>
          {t("arp.apply")}
        </button>
      </div>
    </div>
  );
}
