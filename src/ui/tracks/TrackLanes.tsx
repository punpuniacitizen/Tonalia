import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { DetectedView } from "../../bindings/DetectedView";
import type { SongView } from "../../bindings/SongView";
import type { Track } from "../../bindings/Track";
import { chordSymbol, functionColor, romanSymbol } from "../../lib/music";
import { noteKey, useNotes, type PianoTool } from "../../stores/notes";
import { useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";
import { Popover } from "../common/Popover";
import { Segmented } from "../common/Segmented";
import { tickToX } from "../timeline/geometry";
import { PianoRoll } from "./PianoRoll";
import "./tracks.css";

export const INSTRUMENTS = ["piano", "bass", "pluck", "pad"];
const PIANO_HEIGHT = 288;
const MINI_HEIGHT = 40;

/** Carriles de las pistas de melodía/bajo, bajo la cinta de acordes. */
export function TrackLanes({ width }: { width: number }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView;
  const edit = useSong((s) => s.edit);

  const addTrack = () =>
    edit({ type: "addTrack", name: `${t("tracks.new")} ${view.song.tracks.length + 1}`, instrument: "pluck" });

  return (
    <div className="track-lanes">
      {view.song.tracks.map((track) => (
        <TrackLane key={track.id} track={track} width={width} />
      ))}
      <div className="lane-add">
        <button className="ghost-button" onClick={addTrack}>
          <Icon name="plus" size={14} /> {t("tracks.add")}
        </button>
      </div>
    </div>
  );
}

function TrackLane({ track, width }: { track: Track; width: number }) {
  const { t } = useTranslation();
  const edit = useSong((s) => s.edit);
  const expanded = useNotes((s) => s.expandedTrack === track.id);
  const toggleExpanded = useNotes((s) => s.toggleExpanded);
  const update = (patch: Partial<Pick<Track, "name" | "instrument" | "volume" | "muted" | "solo">>) =>
    edit({
      type: "updateTrack",
      track: track.id,
      name: patch.name ?? null,
      instrument: patch.instrument ?? null,
      volume: patch.volume ?? null,
      muted: patch.muted ?? null,
      solo: patch.solo ?? null,
    });

  return (
    <section className={`lane ${expanded ? "is-expanded" : ""}`} style={{ ["--track" as string]: track.color }}>
      <header className="lane-head">
        <div className="lane-head-sticky">
          <button className="lane-toggle" onClick={() => toggleExpanded(track.id)} title={expanded ? t("tracks.collapse") : t("tracks.expand")}>
            <span className={`lane-chevron ${expanded ? "is-open" : ""}`}>
              <Icon name="chevronRight" size={14} />
            </span>
            <span className="lane-dot" />
            <span className="lane-name">{track.name}</span>
          </button>
          <select value={track.instrument} onChange={(e) => update({ instrument: e.target.value })} title={t("tracks.instrument")}>
            {INSTRUMENTS.map((i) => (
              <option key={i} value={i}>
                {t(`instruments.${i}`)}
              </option>
            ))}
          </select>
          <button className={`lane-flag ${track.muted ? "is-on mute" : ""}`} onClick={() => update({ muted: !track.muted })} title={t("tracks.mute")}>
            M
          </button>
          <button className={`lane-flag ${track.solo ? "is-on solo" : ""}`} onClick={() => update({ solo: !track.solo })} title={t("tracks.solo")}>
            S
          </button>
          <input
            key={track.volume}
            className="lane-volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            defaultValue={track.volume}
            title={`${t("tracks.volume")} ${Math.round(track.volume * 100)}%`}
            onPointerUp={(e) => update({ volume: Number((e.target as HTMLInputElement).value) })}
          />
          {expanded && <PianoToolbar track={track} />}
          <button className="icon-button lane-delete" onClick={() => edit({ type: "removeTrack", track: track.id })} title={t("tracks.delete")}>
            <Icon name="trash" size={15} />
          </button>
        </div>
      </header>
      {expanded ? (
        <PianoRoll track={track} width={width} height={PIANO_HEIGHT} />
      ) : (
        <MiniNotes track={track} width={width} onOpen={() => toggleExpanded(track.id)} />
      )}
    </section>
  );
}

/** Vista plegada: las notas en miniatura. Clic para abrir el piano roll. */
function MiniNotes({ track, width, onOpen }: { track: Track; width: number; onOpen: () => void }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView;
  const pxPerBar = useUi((s) => s.pxPerBar);
  const notes = view.trackNotes.find((n) => n.track === track.id)?.notes ?? [];
  const lo = Math.min(...notes.map((n) => n.pitch), 127);
  const hi = Math.max(...notes.map((n) => n.pitch), 0);
  const range = Math.max(12, hi - lo + 1);

  return (
    <div className="lane-mini" style={{ width, height: MINI_HEIGHT }} onClick={onOpen} title={t("tracks.expand")}>
      {notes.length === 0 && <span className="lane-mini-empty">{t("tracks.emptyHint")}</span>}
      {notes.map((n, i) => (
        <span
          key={i}
          className="mini-note"
          style={{
            left: tickToX(n.position, pxPerBar),
            width: Math.max(2, (n.length * pxPerBar) / 10368 - 1),
            top: 4 + ((hi - n.pitch) / range) * (MINI_HEIGHT - 10),
          }}
        />
      ))}
    </div>
  );
}

/** Herramientas del piano roll y "acorde desde notas". */
function PianoToolbar({ track }: { track: Track }) {
  const { t } = useTranslation();
  const tool = useNotes((s) => s.tool);
  const setTool = useNotes((s) => s.setTool);
  const selection = useNotes((s) => (s.selectionTrack === track.id ? s.selection : null));
  return (
    <>
      <Segmented<PianoTool>
        label={t("piano.tool")}
        value={tool}
        onChange={setTool}
        options={[
          { value: "draw", label: t("piano.draw"), title: t("piano.drawHint") },
          { value: "select", label: t("piano.select"), title: t("piano.selectHint") },
          { value: "velocity", label: t("piano.velocity"), title: t("piano.velocityHint") },
        ]}
      />
      {selection && selection.size >= 2 && <NotesToChord track={track} keys={selection} />}
    </>
  );
}

/** Reconoce el acorde de las notas seleccionadas y permite fijarlo o añadirlo a la cinta. */
function NotesToChord({ track, keys }: { track: Track; keys: Set<string> }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView;
  const edit = useSong((s) => s.edit);
  const notation = useUi((s) => s.notation);
  const [found, setFound] = useState<DetectedView[]>([]);

  const notes = (view.trackNotes.find((n) => n.track === track.id)?.notes ?? []).filter((n) => keys.has(noteKey(n)));
  const start = Math.min(...notes.map((n) => n.position));
  const target = view.chords.find((c) => start >= c.start && start < c.start + c.length) ?? null;
  const key = target?.key ?? view.song.homeKey;
  const pitchesId = notes.map((n) => n.pitch).join(",");

  useEffect(() => {
    if (!notes.length) return;
    void api.detectChord(notes.map((n) => n.pitch), key).then(setFound);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitchesId, JSON.stringify(key)]);

  const leaves = view.sections.filter((s) => s.isLeaf);
  const setAsChord = (d: DetectedView) =>
    target
      ? edit({ type: "replaceChord", at: { section: target.section, index: target.index }, chord: d.chord })
      : addAsChord(d);
  const addAsChord = (d: DetectedView) => {
    const at = target
      ? { section: target.section, index: target.index + 1 }
      : { section: leaves[leaves.length - 1].id, index: view.chords.filter((c) => c.section === leaves[leaves.length - 1].id).length };
    return edit({ type: "insertChord", section: at.section, index: at.index, chord: d.chord, length: null });
  };

  return (
    <Popover
      className="notes-chord"
      trigger={(open, toggle) => (
        <button className={`ghost-button small ${open ? "is-on" : ""}`} onClick={toggle}>
          <Icon name="sparkle" size={14} /> {t("piano.toChord")}
        </button>
      )}
    >
      {(close) => (
        <div className="detected-list">
          <h3>{t("piano.detected")}</h3>
          {found.slice(0, 4).map((d, i) => (
            <div key={i} className="detected-item" style={{ ["--fn" as string]: functionColor(d.label.function) }}>
              <span className="detected-symbol">{chordSymbol(d.label, notation)}</span>
              <span className="detected-roman">{romanSymbol(d.label)}</span>
              {!d.rootIsBass && <small>{t("piano.inversion")}</small>}
              <span className="detected-actions">
                <button
                  onClick={() => {
                    void setAsChord(d);
                    close();
                  }}
                  title={target ? t("piano.setHint") : undefined}
                >
                  {t("piano.set")}
                </button>
                <button
                  onClick={() => {
                    void addAsChord(d);
                    close();
                  }}
                >
                  {t("piano.add")}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </Popover>
  );
}
