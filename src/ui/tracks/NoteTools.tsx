// Herramientas para pistas de notas: Transponer por grados, Cuantizar, Humanizar, Legato /
// Staccato, Ajustar a la escala y Bajo automático.
// Todas reemplazan notas de la pista (se deshacen con Ctrl+Z).

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { BassStyle } from "../../bindings/BassStyle";
import type { Note } from "../../bindings/Note";
import type { SongView } from "../../bindings/SongView";
import type { Track } from "../../bindings/Track";
import { formatLength } from "../../lib/duration";
import { TICKS_PER_BAR } from "../../lib/music";
import { keyPitchClasses } from "../../lib/pitch";
import { noteKey, useNotes } from "../../stores/notes";
import { useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";
import { Segmented } from "../common/Segmented";
import { gridStep } from "../timeline/geometry";
import { playNotes } from "./chordLane";
import { transposeByDegrees } from "./diatonic";
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

// ---------- Transponer por grados ----------

const INTERVALS = [2, 3, 4, 5, 6, 7, 8];

export function TransposePanel({ track, close }: { track: Track; close: () => void }) {
  const { t } = useTranslation();
  const { view, notes, allNotes, empty, scopeBar } = useToolScope({ kind: "notes", track });
  const replace = useReplaceNotes(track);
  const [size, setSize] = useState(3);
  const [dir, setDir] = useState<"up" | "down">("up");
  const [addVoice, setAddVoice] = useState(false);

  const sign = dir === "up" ? 1 : -1;
  // La octava es exacta (12 semitonos); el resto cuenta notas de la escala.
  const moved =
    size === 8
      ? notes.map((n) => ({ ...n, pitch: Math.min(127, Math.max(0, n.pitch + 12 * sign)) }))
      : transposeByDegrees(view, notes, (size - 1) * sign);

  const listen = () => {
    const all = addVoice ? [...notes, ...moved] : moved;
    if (!all.length) return;
    const start = Math.min(...all.map((n) => n.position));
    playNotes(view, all.filter((n) => n.position < start + 2 * TICKS_PER_BAR), start, track.instrument);
  };

  return (
    <div className="arp-panel">
      {scopeBar}
      <div className="arp-row">
        <span>{t("transpose.interval")}</span>
        <div className="grid-chips">
          {INTERVALS.map((i) => (
            <button key={i} className={`grid-chip ${size === i ? "is-active" : ""}`} onClick={() => setSize(i)}>
              {t(`transpose.i${i}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="arp-row">
        <span>{t("transpose.direction")}</span>
        <Segmented<"up" | "down">
          label={t("transpose.direction")}
          value={dir}
          onChange={setDir}
          options={[
            { value: "up", label: t("transpose.up") },
            { value: "down", label: t("transpose.down") },
          ]}
        />
      </div>
      <div className="arp-row arp-checks">
        <label title={t("transpose.addVoiceHint")}>
          <input type="checkbox" checked={addVoice} onChange={(e) => setAddVoice(e.target.checked)} /> {t("transpose.addVoice")}
        </label>
      </div>
      <p className="arp-note">{addVoice ? t("transpose.addVoiceHint") : t("transpose.hint")}</p>
      <Actions
        empty={empty}
        onListen={listen}
        onApply={() => {
          void replace(allNotes, addVoice ? [] : notes, moved);
          close();
        }}
      />
    </div>
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

// ---------- Humanizar ----------

/** Números al azar a partir de una semilla: «Escuchar» y «Aplicar» dan lo mismo. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lo máximo que se corre una nota con «Tiempo» al 100 % (una semifusa). */
const MAX_SHIFT = TICKS_PER_BAR / 64;

export function HumanizePanel({ track, close }: { track: Track; close: () => void }) {
  const { t } = useTranslation();
  const { view, notes, allNotes, empty, scopeBar } = useToolScope({ kind: "notes", track });
  const replace = useReplaceNotes(track);
  const [timing, setTiming] = useState(40);
  const [force, setForce] = useState(40);
  const [length, setLength] = useState(0);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));

  const next = random(seed);
  const spread = () => next() * 2 - 1;
  const humanized = notes.map((n) => {
    const shift = Math.round(spread() * MAX_SHIFT * (timing / 100));
    const velocity = Math.min(1, Math.max(0.05, n.velocity + spread() * 0.15 * (force / 100)));
    const len = Math.max(MIN_LENGTH, Math.round(n.length * (1 + spread() * 0.15 * (length / 100))));
    return { ...n, position: Math.max(0, n.position + shift), velocity, length: len };
  });

  const listen = () => {
    if (!humanized.length) return;
    const start = Math.min(...humanized.map((n) => n.position));
    playNotes(view, humanized.filter((n) => n.position < start + 2 * TICKS_PER_BAR), start, track.instrument);
  };

  const slider = (label: string, hint: string, value: number, set: (v: number) => void) => (
    <label className="arp-row" title={hint}>
      <span>
        {label}: {value}%
      </span>
      <input type="range" min={0} max={100} step={10} value={value} onChange={(e) => set(Number(e.target.value))} />
    </label>
  );

  return (
    <div className="arp-panel">
      {scopeBar}
      {slider(t("humanize.timing"), t("humanize.timingHint"), timing, setTiming)}
      {slider(t("humanize.velocity"), t("humanize.velocityHint"), force, setForce)}
      {slider(t("humanize.length"), t("humanize.lengthHint"), length, setLength)}
      <p className="arp-note">{t("humanize.hint")}</p>
      <div className="arp-actions">
        <button className="ghost-button small" onClick={() => setSeed(Math.floor(Math.random() * 1e9))} disabled={empty} title={t("humanize.rerollHint")}>
          <Icon name="dice" size={13} /> {t("humanize.reroll")}
        </button>
        <span className="arp-spacer" />
        <button className="ghost-button small" onClick={listen} disabled={empty}>
          <Icon name="play" size={12} filled /> {t("rhythm.listen")}
        </button>
        <button
          className="primary-button small"
          onClick={() => {
            void replace(allNotes, notes, humanized);
            close();
          }}
          disabled={empty || (timing === 0 && force === 0 && length === 0)}
        >
          {t("arp.apply")}
        </button>
      </div>
      {empty && <p className="arp-note">{t("arp.nothing")}</p>}
    </div>
  );
}

// ---------- Legato / Staccato ----------

type Articulation = "legato" | "staccato";
const STACCATO = [25, 50, 75];

/** Cada nota hasta que empieza la siguiente (las que empiezan juntas, un acorde, van juntas). */
export function legato(notes: Note[]): Note[] {
  const starts = [...new Set(notes.map((n) => n.position))].sort((a, b) => a - b);
  return notes.map((n) => {
    const next = starts.find((s) => s > n.position);
    return next === undefined ? n : { ...n, length: next - n.position };
  });
}

export function ArticulationPanel({ track, close }: { track: Track; close: () => void }) {
  const { t } = useTranslation();
  const { view, notes, allNotes, empty, scopeBar } = useToolScope({ kind: "notes", track });
  const replace = useReplaceNotes(track);
  const [mode, setMode] = useState<Articulation>("legato");
  const [percent, setPercent] = useState(50);

  const result =
    mode === "legato" ? legato(notes) : notes.map((n) => ({ ...n, length: Math.max(MIN_LENGTH, Math.round((n.length * percent) / 100)) }));
  const changed = result.filter((r, i) => r.length !== notes[i].length).length;

  const listen = () => {
    if (!result.length) return;
    const start = Math.min(...result.map((n) => n.position));
    playNotes(view, result.filter((n) => n.position < start + 2 * TICKS_PER_BAR), start, track.instrument);
  };

  return (
    <div className="arp-panel">
      {scopeBar}
      <Segmented<Articulation>
        label={t("articulation.mode")}
        value={mode}
        onChange={setMode}
        options={[
          { value: "legato", label: t("articulation.legato"), title: t("articulation.legatoHint") },
          { value: "staccato", label: t("articulation.staccato"), title: t("articulation.staccatoHint") },
        ]}
      />
      {mode === "staccato" && (
        <div className="arp-row">
          <span>{t("articulation.keep")}</span>
          <div className="grid-chips">
            {STACCATO.map((p) => (
              <button key={p} className={`grid-chip ${percent === p ? "is-active" : ""}`} onClick={() => setPercent(p)}>
                {p}%
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="arp-note">{mode === "legato" ? t("articulation.legatoHint") : t("articulation.staccatoHint")}</p>
      {!empty && <p className="arp-note">{changed > 0 ? t("articulation.changes", { count: changed }) : t("articulation.none")}</p>}
      <Actions
        empty={empty}
        disabled={changed === 0}
        onListen={listen}
        onApply={() => {
          void replace(allNotes, notes, result);
          close();
        }}
      />
    </div>
  );
}

// ---------- Repetir ----------

/** Lo que ocupa la selección, redondeado hacia arriba al tiempo (negra). */
export function autoSpan(notes: Note[]): number {
  const start = Math.min(...notes.map((n) => n.position));
  const end = Math.max(...notes.map((n) => n.position + n.length));
  const beat = TICKS_PER_BAR / 4;
  return Math.max(beat, Math.ceil((end - start) / beat) * beat);
}

/** `times` copias seguidas de las notas, cada una `span` más adelante. */
export function repeatNotes(notes: Note[], times: number, span: number): Note[] {
  return Array.from({ length: times }, (_, k) => notes.map((n) => ({ ...n, position: n.position + (k + 1) * span }))).flat();
}

const TIMES = [1, 2, 3, 4, 7];
type Spacing = "auto" | 1 | 2 | 4;

export function RepeatPanel({ track, close }: { track: Track; close: () => void }) {
  const { t } = useTranslation();
  const { view, notes, allNotes, empty, scopeBar } = useToolScope({ kind: "notes", track });
  const replace = useReplaceNotes(track);
  const [times, setTimes] = useState(1);
  const [spacing, setSpacing] = useState<Spacing>("auto");
  const span = empty ? TICKS_PER_BAR : spacing === "auto" ? autoSpan(notes) : spacing * TICKS_PER_BAR;
  const copies = empty ? [] : repeatNotes(notes, times, span);
  const len = (ticks: number) => formatLength(ticks, t("rhythm.bar"), t("rhythm.bars"));

  const listen = () => {
    const all = [...notes, ...copies];
    if (!all.length) return;
    const start = Math.min(...all.map((n) => n.position));
    playNotes(view, all.filter((n) => n.position < start + 4 * TICKS_PER_BAR), start, track.instrument);
  };

  return (
    <div className="arp-panel">
      {scopeBar}
      <div className="arp-row">
        <span>{t("repeat.times")}</span>
        <div className="grid-chips">
          {TIMES.map((n) => (
            <button key={n} className={`grid-chip ${times === n ? "is-active" : ""}`} onClick={() => setTimes(n)}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="arp-row">
        <span>{t("repeat.every")}</span>
        <div className="grid-chips">
          {(["auto", 1, 2, 4] as Spacing[]).map((s) => (
            <button key={String(s)} className={`grid-chip ${spacing === s ? "is-active" : ""}`} onClick={() => setSpacing(s)}>
              {s === "auto" ? `${t("repeat.auto")}${empty ? "" : ` (${len(autoSpan(notes))})`}` : len(s * TICKS_PER_BAR)}
            </button>
          ))}
        </div>
      </div>
      <p className="arp-note">{t("repeat.hint")}</p>
      <Actions
        empty={empty}
        onListen={listen}
        onApply={() => {
          void replace(allNotes, [], copies);
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
