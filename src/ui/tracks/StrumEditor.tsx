// Editor de patrones de rasgueo: una grilla de un compás donde cada casilla es un golpe
// (clic: nada → abajo → arriba → apagado; clic derecho: borrar), una fila de acentos y
// ajustes de cómo se rasguea. «Escuchar» lo repite en bucle sobre un acorde y marca el
// paso que suena; los cambios se oyen en la vuelta siguiente.
//
// El patrón se guarda en la canción con su nombre: al guardarlo, todos los acordes que lo
// usan cambian.

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { Note } from "../../bindings/Note";
import type { SongView } from "../../bindings/SongView";
import type { Stroke } from "../../bindings/Stroke";
import type { StrumPattern } from "../../bindings/StrumPattern";
import { TICKS_PER_BAR, TICKS_PER_BEAT } from "../../lib/music";
import type { ChordLane } from "../../stores/notes";
import { useSong } from "../../stores/song";
import { Icon } from "../common/Icon";
import { Segmented } from "../common/Segmented";
import { laneInstrument } from "./chordLane";
import { patternFromPreset, resample, STRUM_PRESETS } from "./strumPresets";

const NEXT: Record<Stroke, Stroke> = { rest: "down", down: "up", up: "mute", mute: "rest" };
const GLYPH: Record<Stroke, string> = { rest: "", down: "↓", up: "↑", mute: "✕" };
/** Un acorde de Do mayor para escuchar si no hay ninguno elegido. */
const FALLBACK: Note[] = [48, 52, 55, 60, 64].map((pitch) => ({ position: 0, length: TICKS_PER_BAR, pitch, velocity: 0.8 }));

/** Etiqueta de cada paso: el número del tiempo y «y» en la mitad. */
function stepLabel(i: number, steps: number, and: string): string {
  const perBeat = steps / 4;
  if (i % perBeat === 0) return String(i / perBeat + 1);
  if (perBeat % 2 === 0 && i % perBeat === perBeat / 2) return and;
  return "·";
}

export function StrumEditor({
  initial,
  lane,
  voicing,
  onDone,
}: {
  initial: StrumPattern;
  lane: ChordLane;
  /** Notas del acorde con el que escuchar (posiciones relativas). */
  voicing: Note[] | null;
  /** Al terminar: el id guardado, null si se borró, undefined si se canceló. */
  onDone: (id: number | null | undefined) => void;
}) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView;
  const edit = useSong((s) => s.edit);
  const [draft, setDraft] = useState<StrumPattern>(initial);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [looping, setLooping] = useState(false);
  const [current, setCurrent] = useState(-1);
  const isNew = initial.id === 0;
  const instrument = laneInstrument(view, lane);
  const usedBy = view.chords.filter((c) => {
    const r = lane === "main" ? c.rhythm : c.layers.find((l) => l.track === lane)?.rhythm;
    return r?.strum === initial.id;
  }).length;

  const change = (patch: Partial<StrumPattern>) => setDraft((d) => ({ ...d, ...patch }));
  const setCell = (i: number, stroke: Stroke) => setDraft((d) => ({ ...d, strokes: d.strokes.map((s, j) => (j === i ? stroke : s)) }));
  const toggleAccent = (i: number) => setDraft((d) => ({ ...d, accents: d.accents.map((a, j) => (j === i ? !a : a)) }));

  // ---------- Escuchar en bucle ----------
  useEffect(() => {
    if (!looping) return;
    const barSeconds = (60 / view.song.bpm) * (TICKS_PER_BAR / TICKS_PER_BEAT);
    const notes = voicing && voicing.length ? voicing : FALLBACK;
    let start = performance.now();
    let frame = 0;
    let timer = 0;
    let stopped = false;
    const playBar = async () => {
      const p = draftRef.current;
      const out = await api.rhythmNotes(notes, TICKS_PER_BAR, { pattern: "strum", step: TICKS_PER_BAR / 8, short: false, strum: p.id }, [p]);
      if (stopped) return;
      start = performance.now();
      const secondsPerTick = barSeconds / TICKS_PER_BAR;
      void api.previewSequence(
        out.map((n) => ({ pitch: n.pitch, delay: n.position * secondsPerTick, duration: Math.max(0.08, n.length * secondsPerTick), velocity: n.velocity })),
        instrument,
      );
      timer = window.setTimeout(() => void playBar(), barSeconds * 1000);
    };
    const paint = () => {
      const progress = ((performance.now() - start) / 1000 / barSeconds) % 1;
      setCurrent(Math.floor(progress * draftRef.current.steps));
      frame = requestAnimationFrame(paint);
    };
    void playBar();
    paint();
    return () => {
      stopped = true;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      setCurrent(-1);
      void api.stopPreview();
    };
  }, [looping, voicing, instrument, view.song.bpm]);

  const save = async () => {
    setLooping(false);
    if (isNew) {
      const next = await edit({ type: "addStrumPattern", pattern: draft });
      const list = next?.song.strumPatterns ?? [];
      onDone(list.length ? list[list.length - 1].id : undefined);
    } else {
      await edit({ type: "updateStrumPattern", pattern: draft });
      onDone(draft.id);
    }
  };

  const remove = async () => {
    setLooping(false);
    await edit({ type: "removeStrumPattern", id: initial.id });
    onDone(null);
  };

  const useGuitar = () =>
    edit(
      lane === "main"
        ? { type: "updateChordTrack", instrument: "guitar", volume: null, pan: null, muted: null, solo: null }
        : { type: "updateTrack", track: lane, name: null, instrument: "guitar", volume: null, pan: null, muted: null, solo: null },
    );

  return (
    <div className="strum-editor">
      <input className="strum-name" value={draft.name} maxLength={40} onChange={(e) => change({ name: e.target.value })} aria-label={t("strum.name")} placeholder={t("strum.name")} />

      <div className="arp-row">
        <span>{t("strum.startFrom")}</span>
        <div className="grid-chips">
          {STRUM_PRESETS.map((p) => (
            <button key={p.key} className="grid-chip" onClick={() => setDraft((d) => ({ ...patternFromPreset(p, d.name, d), id: d.id }))}>
              {t(`strum.preset.${p.key}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="arp-row">
        <span>{t("strum.grid")}</span>
        <Segmented<"8" | "16" | "12">
          label={t("strum.grid")}
          value={String(draft.steps) as "8" | "16" | "12"}
          onChange={(v) => setDraft((d) => resample(d, Number(v)))}
          options={[
            { value: "8", label: t("strum.eighths") },
            { value: "16", label: t("strum.sixteenths") },
            { value: "12", label: t("strum.triplets") },
          ]}
        />
      </div>

      <div className="strum-grid" style={{ ["--steps" as string]: draft.steps }} onContextMenu={(e) => e.preventDefault()}>
        {draft.strokes.map((_, i) => (
          <span key={`l${i}`} className={`strum-label ${i % (draft.steps / 4) === 0 ? "is-beat" : ""}`}>
            {stepLabel(i, draft.steps, t("strum.and"))}
          </span>
        ))}
        {draft.strokes.map((s, i) => (
          <button
            key={`c${i}`}
            className={`strum-cell is-${s} ${i === current ? "is-now" : ""} ${i % (draft.steps / 4) === 0 ? "is-beat" : ""}`}
            title={t(`strum.stroke.${s}`)}
            onClick={() => setCell(i, NEXT[s])}
            onContextMenu={(e) => {
              e.preventDefault();
              setCell(i, "rest");
            }}
          >
            {GLYPH[s]}
          </button>
        ))}
        {draft.accents.map((a, i) => (
          <button key={`a${i}`} className={`strum-accent ${a ? "is-on" : ""}`} title={t("strum.accentHint")} onClick={() => toggleAccent(i)} aria-pressed={a} />
        ))}
      </div>
      <p className="arp-note">{t("strum.gridHint")}</p>

      <div className="strum-settings">
        <label title={t("strum.spreadHint")}>
          <span>{t("strum.spread")}</span>
          <input type="range" min={10} max={160} step={10} value={draft.spread} onChange={(e) => change({ spread: Number(e.target.value) })} />
        </label>
        <label title={t("strum.humanizeHint")}>
          <span>
            {t("strum.humanize")}: {Math.round(draft.humanize * 100)}%
          </span>
          <input type="range" min={0} max={1} step={0.1} value={draft.humanize} onChange={(e) => change({ humanize: Number(e.target.value) })} />
        </label>
        <div className="arp-row">
          <span title={t("strum.upStringsHint")}>{t("strum.upStrings")}</span>
          <div className="grid-chips">
            {[2, 3, 4, 0].map((n) => (
              <button key={n} className={`grid-chip ${draft.upStrings === n ? "is-active" : ""}`} onClick={() => change({ upStrings: n })}>
                {n === 0 ? t("strum.all") : n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {instrument !== "guitar" && (
        <p className="arp-note">
          {t("strum.guitarHint")}{" "}
          <button className="link-button" onClick={() => void useGuitar()}>
            {t("strum.useGuitar")}
          </button>
        </p>
      )}
      {!isNew && usedBy > 0 && <p className="arp-note">{t("strum.usedBy", { count: usedBy })}</p>}

      <div className="arp-actions">
        <button className={`ghost-button small ${looping ? "is-on" : ""}`} onClick={() => setLooping((l) => !l)}>
          <Icon name={looping ? "stop" : "play"} size={12} filled /> {looping ? t("strum.stop") : t("strum.listen")}
        </button>
        {!isNew && (
          <button className="ghost-button small" onClick={() => void remove()} title={t("strum.removeHint")}>
            <Icon name="trash" size={12} />
          </button>
        )}
        <span className="arp-spacer" />
        <button className="ghost-button small" onClick={() => onDone(undefined)}>
          {t("strum.cancel")}
        </button>
        <button className="primary-button small" onClick={() => void save()} disabled={!draft.name.trim() || draft.strokes.every((s) => s === "rest")}>
          {t("strum.save")}
        </button>
      </div>
    </div>
  );
}
