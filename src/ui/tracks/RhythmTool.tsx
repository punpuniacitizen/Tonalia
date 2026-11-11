// Herramienta «Patrones de ritmo» de las pistas de acordes: toca cada acorde elegido con un
// ritmo (pulsos, contratiempos, charleston, tresillo, bajo y acorde, Alberti, rasgueo).
// Como el arpegio, no borra nada: se guarda en el acorde y se puede cambiar o quitar.

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { Rhythm } from "../../bindings/Rhythm";
import type { RhythmPattern } from "../../bindings/RhythmPattern";
import type { StrumPattern } from "../../bindings/StrumPattern";
import { TICKS_PER_BAR } from "../../lib/music";
import { type ChordLane } from "../../stores/notes";
import { useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";
import { laneRhythm, laneTrack, playNotes, shiftToLane } from "./chordLane";
import { StrumEditor } from "./StrumEditor";
import { patternFromPreset, STRUM_PRESETS } from "./strumPresets";
import { useToolScope } from "./toolScope";

const PATTERNS: RhythmPattern[] = ["pulse", "offbeat", "charleston", "tresillo", "bassChord", "alberti", "strum"];
/** Patrones que usan el paso (los demás tienen su ritmo fijo por compás). */
const USES_STEP: RhythmPattern[] = ["pulse", "offbeat", "alberti", "strum"];
/** Paso con el que empieza cada patrón al elegirlo. */
const DEFAULT_STEP: Partial<Record<RhythmPattern, number>> = {
  pulse: TICKS_PER_BAR / 4,
  offbeat: TICKS_PER_BAR / 4,
  alberti: TICKS_PER_BAR / 8,
  strum: TICKS_PER_BAR / 8,
};
const STEPS: { ticks: number; label: string; triplet?: boolean }[] = [
  { ticks: TICKS_PER_BAR / 2, label: "1/2" },
  { ticks: TICKS_PER_BAR / 4, label: "1/4" },
  { ticks: TICKS_PER_BAR / 8, label: "1/8" },
  { ticks: TICKS_PER_BAR / 16, label: "1/16" },
  { ticks: TICKS_PER_BAR / 12, label: "1/8", triplet: true },
];

export function RhythmPatternPanel({ lane, close }: { lane: ChordLane; close: () => void }) {
  const { t } = useTranslation();
  const edit = useSong((s) => s.edit);
  const settings = useUi((s) => s.lastRhythm);
  const set = useUi((s) => s.set);
  const { view, chords, empty, instrument, scopeBar } = useToolScope({ kind: "chords", lane });
  const [editing, setEditing] = useState<StrumPattern | null>(null);
  const patterns = view.song.strumPatterns ?? [];
  // El rasgueo elegido puede no existir (se borró o es de otra canción): entonces, el clásico.
  const strumId = settings.strum !== null && patterns.some((p) => p.id === settings.strum) ? settings.strum : null;
  const rhythmNow: Rhythm = { ...settings, strum: settings.pattern === "strum" ? strumId : null };
  const custom = settings.pattern === "strum" && strumId !== null;

  const change = (patch: Partial<Rhythm>) => set({ lastRhythm: { ...settings, ...patch } });
  const first = chords[0];
  const firstVoicing = first ? shiftToLane(view, lane, first.voicing).map((n) => ({ ...n, position: n.position - first.start })) : null;

  /** El primer acorde elegido tal como sonaría. */
  const listen = async () => {
    if (!first || !firstVoicing) return;
    playNotes(view, await api.rhythmNotes(firstVoicing, first.length, rhythmNow, patterns), 0, instrument);
  };

  if (editing) {
    return (
      <StrumEditor
        initial={editing}
        lane={lane}
        voicing={firstVoicing}
        onDone={(id) => {
          setEditing(null);
          if (id !== undefined) change({ pattern: "strum", strum: id });
        }}
      />
    );
  }

  const newPattern = () =>
    setEditing(patternFromPreset(STRUM_PRESETS[0], `${t("strum.newName")} ${patterns.length + 1}`));

  const apply = async (rhythm: Rhythm | null) => {
    if (empty) return;
    await edit({ type: "setRhythm", track: laneTrack(lane), chords: chords.map((c) => ({ section: c.section, index: c.index })), rhythm });
    close();
  };

  const anyRhythm = chords.some((c) => laneRhythm(c, lane));

  return (
    <div className="arp-panel">
      {scopeBar}
      <div className="pattern-grid">
        {PATTERNS.map((p) => (
          <button key={p} className={`pattern-chip ${settings.pattern === p ? "is-active" : ""}`} onClick={() => change({ pattern: p, step: DEFAULT_STEP[p] ?? settings.step })}>
            <strong>{t(`pattern.${p}`)}</strong>
            <small>{t(`pattern.${p}Hint`)}</small>
          </button>
        ))}
      </div>
      {settings.pattern === "strum" && (
        <div className="arp-row">
          <span>{t("strum.title")}</span>
          <div className="grid-chips">
            <button className={`grid-chip ${!custom ? "is-active" : ""}`} onClick={() => change({ strum: null })} title={t("pattern.strumHint")}>
              {t("strum.classic")}
            </button>
            {patterns.map((p) => (
              <button
                key={p.id}
                className={`grid-chip ${strumId === p.id ? "is-active" : ""}`}
                onClick={() => change({ strum: p.id })}
                onDoubleClick={() => setEditing(p)}
                title={t("strum.editHint")}
              >
                {p.name}
              </button>
            ))}
            <button className="grid-chip" onClick={newPattern} title={t("strum.newHint")}>
              <Icon name="plus" size={11} /> {t("strum.new")}
            </button>
          </div>
          {custom && (
            <button className="link-button strum-edit" onClick={() => setEditing(patterns.find((p) => p.id === strumId) ?? null)}>
              <Icon name="pencil" size={12} /> {t("strum.edit")}
            </button>
          )}
        </div>
      )}
      {USES_STEP.includes(settings.pattern) && !custom && (
        <div className="arp-row">
          <span>{t("pattern.step")}</span>
          <div className="grid-chips">
            {STEPS.map((s) => (
              <button key={s.ticks} className={`grid-chip ${settings.step === s.ticks ? "is-active" : ""}`} onClick={() => change({ step: s.ticks })}>
                {s.label}
                {s.triplet && <small> {t("rhythm.triplet")}</small>}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="arp-row arp-checks">
        <label title={t("pattern.shortHint")}>
          <input type="checkbox" checked={settings.short} onChange={(e) => change({ short: e.target.checked })} /> {t("pattern.short")}
        </label>
      </div>
      <p className="arp-note">{t("pattern.replacesArp")}</p>

      {empty && <p className="arp-note">{t("arp.nothing")}</p>}
      <div className="arp-actions">
        <button className="ghost-button small" onClick={() => void listen()} disabled={empty}>
          <Icon name="play" size={12} filled /> {t("rhythm.listen")}
        </button>
        {anyRhythm && (
          <button className="ghost-button small" onClick={() => void apply(null)}>
            {t("pattern.remove")}
          </button>
        )}
        <button className="primary-button small" onClick={() => void apply(rhythmNow)} disabled={empty}>
          {t("arp.apply")}
        </button>
      </div>
    </div>
  );
}
