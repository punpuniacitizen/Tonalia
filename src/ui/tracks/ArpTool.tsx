// Herramienta «Arpegiar», como la de FL Studio: toma lo elegido (acordes de una pista de
// acordes o notas de un piano roll), reconoce cada acorde y lo arpegia con los parámetros
// que pongas al tocar «Aplicar». Sin nada elegido, se aplica a todo.
//
// En una pista de acordes el arpegio no borra nada: se guarda en cada acorde y se puede
// cambiar o quitar. En una pista de notas reemplaza las notas (se deshace con Ctrl+Z).

import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { ArpPattern } from "../../bindings/ArpPattern";
import type { Arpeggio } from "../../bindings/Arpeggio";
import { TICKS_PER_BAR } from "../../lib/music";
import { noteKey, useNotes } from "../../stores/notes";
import { useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";
import { Segmented } from "../common/Segmented";
import { laneArp, laneTrack, playNotes } from "./chordLane";
import { sortNotes, useToolScope, type ToolsTarget } from "./toolScope";


const SPEEDS: { ticks: number; label: string; triplet?: boolean }[] = [
  { ticks: TICKS_PER_BAR / 4, label: "1/4" },
  { ticks: TICKS_PER_BAR / 8, label: "1/8" },
  { ticks: TICKS_PER_BAR / 16, label: "1/16" },
  { ticks: TICKS_PER_BAR / 12, label: "1/8", triplet: true },
  { ticks: TICKS_PER_BAR / 24, label: "1/16", triplet: true },
];


/** Panel de «Arpegiar» (se abre desde el menú de herramientas). */
export function ArpPanel({ target, close }: { target: ToolsTarget; close: () => void }) {
  const { t } = useTranslation();
  const edit = useSong((s) => s.edit);
  const settings = useUi((s) => s.lastArp);
  const set = useUi((s) => s.set);
  const select = useNotes((s) => s.select);

  const { view, chords, notes, allNotes, empty, instrument, scopeBar } = useToolScope(target);

  const change = (patch: Partial<Arpeggio>) => set({ lastArp: { ...settings, ...patch } });

  /** El primer acorde (o los primeros compases de notas) tal como quedaría. */
  const listen = async () => {
    if (empty) return;
    if (target.kind === "chords") {
      const c = chords[0];
      // El arpegio usa las alturas del voicing y dura todo el acorde, como al reproducir.
      const block = c.voicing.map((n) => ({ ...n, position: c.start, length: c.length }));
      playNotes(view, await api.arpeggiate(block, settings), c.start, instrument);
    } else {
      const result = await api.arpeggiate(notes, settings);
      const start = Math.min(...result.map((n) => n.position));
      playNotes(view, result.filter((n) => n.position < start + 2 * TICKS_PER_BAR), start, instrument);
    }
  };

  const applyArp = async (arp: Arpeggio | null) => {
    if (empty) return;
    if (target.kind === "chords") {
      await edit({ type: "setArpeggio", track: laneTrack(target.lane), chords: chords.map((c) => ({ section: c.section, index: c.index })), arp });
    } else if (arp) {
      const result = await api.arpeggiate(notes, arp);
      const replaced = new Set(notes.map(noteKey));
      const fresh = new Set(result.map(noteKey));
      const kept = allNotes.filter((n) => !replaced.has(noteKey(n)) && !fresh.has(noteKey(n)));
      await edit({ type: "setTrackNotes", track: target.track.id, notes: sortNotes([...kept, ...result]) });
      select(target.track.id, result.map(noteKey));
    }
    close();
  };

  const anyArp = target.kind === "chords" && chords.some((c) => laneArp(c, target.lane));
  return (
    <div className="arp-panel">
      {scopeBar}
      {target.kind === "notes" && <p className="arp-note">{t("arp.notesHint")}</p>}

      <div className="arp-row">
        <span>{t("arp.pattern")}</span>
        <Segmented<ArpPattern>
          label={t("arp.pattern")}
          value={settings.pattern}
          onChange={(pattern) => change({ pattern })}
          options={[
            { value: "up", label: "↑", title: t("rhythm.up") },
            { value: "down", label: "↓", title: t("rhythm.down") },
            { value: "upDown", label: "↑↓", title: t("rhythm.upDown") },
            { value: "downUp", label: "↓↑", title: t("rhythm.downUp") },
            { value: "random", label: t("rhythm.random") },
          ]}
        />
      </div>
      <div className="arp-row">
        <span>{t("rhythm.speed")}</span>
        <div className="grid-chips">
          {SPEEDS.map((s) => (
            <button key={s.ticks} className={`grid-chip ${settings.step === s.ticks ? "is-active" : ""}`} onClick={() => change({ step: s.ticks })}>
              {s.label}
              {s.triplet && <small> {t("rhythm.triplet")}</small>}
            </button>
          ))}
        </div>
      </div>
      <div className="arp-row">
        <span>{t("rhythm.octaves")}</span>
        <div className="grid-chips">
          {[1, 2, 3].map((o) => (
            <button key={o} className={`grid-chip ${settings.octaves === o ? "is-active" : ""}`} onClick={() => change({ octaves: o })}>
              {o}
            </button>
          ))}
        </div>
      </div>
      <div className="arp-row arp-checks">
        <label title={t("rhythm.holdHint")}>
          <input type="checkbox" checked={settings.hold} onChange={(e) => change({ hold: e.target.checked })} /> {t("rhythm.hold")}
        </label>
        <label title={t("rhythm.keepBassHint")}>
          <input type="checkbox" checked={settings.keepBass} onChange={(e) => change({ keepBass: e.target.checked })} /> {t("rhythm.keepBass")}
        </label>
      </div>

      {empty && <p className="arp-note">{t("arp.nothing")}</p>}
      <div className="arp-actions">
        <button className="ghost-button small" onClick={() => void listen()} disabled={empty}>
          <Icon name="play" size={12} filled /> {t("rhythm.listen")}
        </button>
        {anyArp && (
          <button className="ghost-button small" onClick={() => void applyArp(null)}>
            {t("arp.remove")}
          </button>
        )}
        <button className="primary-button small" onClick={() => void applyArp(settings)} disabled={empty}>
          {t("arp.apply")}
        </button>
      </div>
    </div>
  );
}
