import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { SongView } from "../../bindings/SongView";
import type { Track } from "../../bindings/Track";
import type { TrackKind } from "../../bindings/TrackKind";
import { INSTRUMENTS } from "../../lib/instruments";
import { useNotes, type ChordLane, type PianoTool } from "../../stores/notes";
import { useSong } from "../../stores/song";
import { useUi, type ChordLaneView } from "../../stores/ui";
import { Icon } from "../common/Icon";
import { Popover } from "../common/Popover";
import { Segmented } from "../common/Segmented";
import { tickToX } from "../timeline/geometry";
import { PianoRoll, MAX_ROW, MIN_ROW } from "./PianoRoll";
import "./tracks.css";
import { PanKnob } from "./PanKnob";
import { ToolsMenu } from "./ToolsMenu";
import { ChordBlocks } from "./ChordBlocks";
import { ChordPianoRoll } from "./ChordPianoRoll";
import { setLaneView, useLaneView } from "./chordLane";

export const PIANO_HEIGHT = 288;
const MINI_HEIGHT = 40;

/** Carriles de las pistas (de notas o de acordes), bajo la cinta de acordes. */
export function TrackLanes({ width }: { width: number }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView;
  const edit = useSong((s) => s.edit);

  const addTrack = (kind: TrackKind) => {
    const chordTracks = view.song.tracks.filter((tr) => tr.kind === "chords").length;
    const name = kind === "chords" ? `${t("tracks.chords")} ${chordTracks + 2}` : `${t("tracks.new")} ${view.song.tracks.length + 1}`;
    void edit({ type: "addTrack", name, instrument: kind === "chords" ? "pad" : "pluck", kind });
  };

  return (
    <div className="track-lanes">
      {view.song.tracks.map((track) =>
        track.kind === "chords" ? <ChordTrackLane key={track.id} track={track} width={width} /> : <TrackLane key={track.id} track={track} width={width} />,
      )}
      <div className="lane-add">
        <Popover
          className="track-kind"
          floating
          trigger={(open, toggle) => (
            <button className={`ghost-button ${open ? "is-on" : ""}`} onClick={toggle}>
              <Icon name="plus" size={14} /> {t("tracks.add")}
            </button>
          )}
        >
          {(close) => (
            <div className="track-kind-panel">
              <h4>{t("tracks.kindTitle")}</h4>
              <button
                className="track-kind-option"
                onClick={() => {
                  addTrack("chords");
                  close();
                }}
              >
                <Icon name="music" size={18} />
                <span>
                  <strong>{t("tracks.kindChords")}</strong>
                  <small>{t("tracks.kindChordsHint")}</small>
                </span>
              </button>
              <button
                className="track-kind-option"
                onClick={() => {
                  addTrack("notes");
                  close();
                }}
              >
                <Icon name="notes" size={18} />
                <span>
                  <strong>{t("tracks.kindNotes")}</strong>
                  <small>{t("tracks.kindNotesHint")}</small>
                </span>
              </button>
            </div>
          )}
        </Popover>
      </div>
    </div>
  );
}

type TrackPatch = Partial<Pick<Track, "name" | "instrument" | "volume" | "pan" | "muted" | "solo">>;

function useTrackUpdate(track: Track) {
  const edit = useSong((s) => s.edit);
  return (patch: TrackPatch) =>
    edit({
      type: "updateTrack",
      track: track.id,
      name: patch.name ?? null,
      instrument: patch.instrument ?? null,
      volume: patch.volume ?? null,
      pan: patch.pan ?? null,
      muted: patch.muted ?? null,
      solo: patch.solo ?? null,
    });
}

/** Instrumento, silencio, solo, volumen y paneo de una pista. */
export function LaneMixer({
  instrument,
  volume,
  pan,
  muted,
  solo,
  update,
}: {
  instrument: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  update: (patch: TrackPatch) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <select value={instrument} onChange={(e) => update({ instrument: e.target.value })} title={t("tracks.instrument")}>
        {INSTRUMENTS.map((i) => (
          <option key={i} value={i}>
            {t(`instruments.${i}`)}
          </option>
        ))}
      </select>
      <button className={`lane-flag ${muted ? "is-on mute" : ""}`} onClick={() => update({ muted: !muted })} title={t("tracks.mute")}>
        M
      </button>
      <button className={`lane-flag ${solo ? "is-on solo" : ""}`} onClick={() => update({ solo: !solo })} title={t("tracks.solo")}>
        S
      </button>
      <input
        key={volume}
        className="lane-volume"
        type="range"
        min={0}
        max={1}
        step={0.05}
        defaultValue={volume}
        title={`${t("tracks.volume")} ${Math.round(volume * 100)}%`}
        onPointerUp={(e) => update({ volume: Number((e.target as HTMLInputElement).value) })}
      />
      <PanKnob value={pan} onChange={(p) => update({ pan: p })} />
    </>
  );
}

function TrackLane({ track, width }: { track: Track; width: number }) {
  const { t } = useTranslation();
  const edit = useSong((s) => s.edit);
  const expanded = useNotes((s) => s.expandedTrack === track.id);
  const toggleExpanded = useNotes((s) => s.toggleExpanded);
  const update = useTrackUpdate(track);

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
          <LaneMixer {...track} update={update} />
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

/** Una pista de acordes: toca los acordes de la cinta con su instrumento y su arpegio. */
function ChordTrackLane({ track, width }: { track: Track; width: number }) {
  const { t } = useTranslation();
  const edit = useSong((s) => s.edit);
  const update = useTrackUpdate(track);
  const mode = useLaneView(track.id);

  return (
    <section className={`lane chord-lane ${mode === "piano" ? "is-expanded" : ""}`} style={{ ["--track" as string]: track.color }}>
      <header className="lane-head">
        <div className="lane-head-sticky">
          <button
            className="lane-toggle"
            onClick={() => setLaneView(track.id, mode === "piano" ? "blocks" : "piano")}
            title={mode === "piano" ? t("chordLane.blocksHint") : t("chordLane.pianoHint")}
          >
            <span className={`lane-chevron ${mode === "piano" ? "is-open" : ""}`}>
              <Icon name="chevronRight" size={14} />
            </span>
            <span className="lane-dot" />
            <span className="lane-name">{track.name}</span>
          </button>
          <LaneMixer {...track} update={update} />
          <ChordLaneTools lane={track.id} />
          <button className="icon-button lane-delete" onClick={() => edit({ type: "removeTrack", track: track.id })} title={t("tracks.delete")}>
            <Icon name="trash" size={15} />
          </button>
        </div>
      </header>
      {mode === "piano" ? (
        <ChordPianoRoll lane={track.id} color={track.color} width={width} height={PIANO_HEIGHT} />
      ) : (
        <ChordBlocks lane={track.id} width={width} />
      )}
    </section>
  );
}

/** Vista (bloques / piano roll), «Arpegiar» y, en el piano roll, el zoom. */
export function ChordLaneTools({ lane, children }: { lane: ChordLane; children?: ReactNode }) {
  const { t } = useTranslation();
  const mode = useLaneView(lane);
  return (
    <>
      <Segmented<ChordLaneView>
        label={t("chordLane.view")}
        value={mode}
        onChange={(m) => setLaneView(lane, m)}
        options={[
          { value: "blocks", label: t("chordLane.blocks"), title: t("chordLane.blocksHint"), icon: "music" },
          { value: "piano", label: t("chordLane.piano"), title: t("chordLane.pianoHint"), icon: "notes" },
        ]}
      />
      <ToolsMenu target={{ kind: "chords", lane }} />
      {mode === "piano" && <PianoZoom />}
      {children}
    </>
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

/** Modo del clic (dibujar, seleccionar, intensidad), herramientas y zoom del piano roll. */
function PianoToolbar({ track }: { track: Track }) {
  const { t } = useTranslation();
  const tool = useNotes((s) => s.tool);
  const setTool = useNotes((s) => s.setTool);
  return (
    <>
      <Segmented<PianoTool>
        label={t("piano.tool")}
        value={tool}
        onChange={setTool}
        options={[
          { value: "draw", label: t("piano.draw"), title: t("piano.drawHint"), icon: "pencil" },
          { value: "select", label: t("piano.select"), title: t("piano.selectHint"), icon: "pointer" },
          { value: "velocity", label: t("piano.velocity"), title: t("piano.velocityHint"), icon: "velocity" },
        ]}
      />
      {/* Aparte del selector: no son modos del clic, actúan sobre lo seleccionado. */}
      <ToolsMenu target={{ kind: "notes", track }} />
      <PianoZoom />
    </>
  );
}

/** Zoom del piano roll: alto de las filas y ancho de los compases. */
export function PianoZoom() {
  const { t } = useTranslation();
  const rowHeight = useUi((s) => s.pianoRowHeight);
  const pxPerBar = useUi((s) => s.pxPerBar);
  const set = useUi((s) => s.set);
  // Se lee el valor del momento: varios clics seguidos suman bien.
  const rows = (d: number) => set({ pianoRowHeight: Math.min(MAX_ROW, Math.max(MIN_ROW, useUi.getState().pianoRowHeight + d * 2)) });
  const width = (f: number) => set({ pxPerBar: Math.min(600, Math.max(60, useUi.getState().pxPerBar * f)) });
  return (
    <span className="piano-zoom" title={t("piano.zoom")}>
      <button onClick={() => rows(-1)} disabled={rowHeight <= MIN_ROW} title={t("piano.zoomShorter")}>
        −
      </button>
      <span aria-hidden="true">↕</span>
      <button onClick={() => rows(1)} disabled={rowHeight >= MAX_ROW} title={t("piano.zoomTaller")}>
        +
      </button>
      <button onClick={() => width(1 / 1.25)} disabled={pxPerBar <= 60} title={t("piano.zoomNarrower")}>
        −
      </button>
      <span aria-hidden="true">↔</span>
      <button onClick={() => width(1.25)} disabled={pxPerBar >= 600} title={t("piano.zoomWider")}>
        +
      </button>
    </span>
  );
}
