import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { Chord } from "../../bindings/Chord";
import type { ChordView } from "../../bindings/ChordView";
import type { SongView } from "../../bindings/SongView";
import { chordSymbol, functionColor, isMinorLike, romanSymbol } from "../../lib/music";
import { reasonText } from "../../lib/reason";
import { onDrop, pointerGesture, useDrag, type DropTarget } from "../../stores/drag";
import { useSong } from "../../stores/song";
import { currentPosition, useTransport } from "../../stores/transport";
import { sameRef, useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";
import { gridStep, pxPerTick, snap, tickToX, xToTick } from "./geometry";
import { VoiceLines } from "./VoiceLines";

type Resize = { section: number; index: number; length: number };

/** Dónde caería un acorde soltado en el instante `tick`. */
function dropTargetAt(view: SongView, tick: number, pxPerBar: number): DropTarget {
  const leaves = view.sections.filter((s) => s.isLeaf);
  const leaf =
    leaves.find((s) => tick >= s.start && tick < s.start + s.length) ?? (tick < 0 ? leaves[0] : leaves[leaves.length - 1]);
  const inLeaf = view.chords.filter((c) => c.section === leaf.id);
  let index = inLeaf.findIndex((c) => tick < c.start + c.length / 2);
  if (index < 0) index = inLeaf.length;
  const last = inLeaf[inLeaf.length - 1];
  const xTick = index < inLeaf.length ? inLeaf[index].start : last ? last.start + last.length : leaf.start;
  return { section: leaf.id, index, x: tickToX(xTick, pxPerBar) };
}

/** Índice del acorde que está sonando (solo cambia de estado cuando cambia el acorde). */
function usePlayingIndex(chords: ChordView[]): number {
  const playing = useTransport((s) => s.playing);
  const [index, setIndex] = useState(-1);
  useEffect(() => {
    if (!playing) {
      setIndex(-1);
      return;
    }
    let frame = 0;
    const loop = () => {
      const p = currentPosition();
      const i = chords.findIndex((c) => p >= c.start && p < c.start + c.length);
      setIndex((prev) => (prev === i ? prev : i));
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, [playing, chords]);
  return index;
}

export function ChordRibbon() {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView;
  const edit = useSong((s) => s.edit);
  const { pxPerBar, notation, symbols, level, grid, selected, select, showVoices } = useUi();
  const payload = useDrag((s) => s.payload);
  const dragX = useDrag((s) => s.x);
  const dragY = useDrag((s) => s.y);
  const target = useDrag((s) => s.target);
  const laneRef = useRef<HTMLDivElement>(null);
  const [resize, setResize] = useState<Resize | null>(null);
  const playingIndex = usePlayingIndex(view.chords);
  const ppt = pxPerTick(pxPerBar);

  // Mientras se arrastra un acorde, calculamos dónde caería.
  useEffect(() => {
    const lane = laneRef.current;
    if (!payload || !lane) return;
    const rect = lane.getBoundingClientRect();
    const near = dragX >= rect.left && dragX <= rect.right && dragY >= rect.top - 60 && dragY <= rect.bottom + 40;
    const next = near ? dropTargetAt(view, xToTick(dragX - rect.left, pxPerBar), pxPerBar) : null;
    const prev = useDrag.getState().target;
    if (next?.section !== prev?.section || next?.index !== prev?.index) useDrag.getState().setTarget(next);
  }, [payload, dragX, dragY, view, pxPerBar]);

  // Al soltar sobre la cinta: insertar (desde la rueda) o mover (dentro de la cinta).
  useEffect(
    () =>
      onDrop(() => {
        const { payload: p, target: tg } = useDrag.getState();
        if (!p || !tg) return;
        if (p.kind === "new") {
          void edit({ type: "insertChord", section: tg.section, index: tg.index, chord: p.chord, length: null }).then(
            (v) => v && select({ section: tg.section, index: tg.index }),
          );
        } else {
          const index = p.from.section === tg.section && p.from.index < tg.index ? tg.index - 1 : tg.index;
          void edit({ type: "moveChord", from: p.from, to: { section: tg.section, index: tg.index } }).then(
            (v) => v && select({ section: tg.section, index }),
          );
        }
      }),
    [edit, select],
  );

  const onBlockDown = (e: React.PointerEvent, c: ChordView) => {
    if (e.button !== 0) return;
    pointerGesture(e, {
      onClick: () => {
        select({ section: c.section, index: c.index });
        void api.previewChord(c.chord, c.key.root);
      },
      onDragStart: (x, y) =>
        useDrag.getState().start({ kind: "move", from: { section: c.section, index: c.index }, chord: c.chord, label: c.label }, x, y),
    });
  };

  const onResizeDown = (e: React.PointerEvent, c: ChordView) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const startX = e.clientX;
    const step = gridStep(grid);
    let length = c.length;
    const move = (ev: PointerEvent) => {
      length = Math.max(step, snap(c.length + (ev.clientX - startX) / ppt, grid));
      setResize({ section: c.section, index: c.index, length });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setResize(null);
      if (length !== c.length) void edit({ type: "resizeChord", at: { section: c.section, index: c.index }, length });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Durante un redimensionado, los acordes siguientes se desplazan en vivo.
  const resizedAt = resize ? view.chords.findIndex((c) => sameRef(c, resize)) : -1;
  const shift = resize && resizedAt >= 0 ? (resize.length - view.chords[resizedAt].length) * ppt : 0;
  const geometry = view.chords.map((c, i) => {
    const length = i === resizedAt && resize ? resize.length : c.length;
    const left = tickToX(c.start, pxPerBar) + (resizedAt >= 0 && i > resizedAt ? shift : 0);
    return { left, width: Math.max(10, length * ppt - 6) };
  });

  return (
    <div className="ribbon">
      <svg className="ribbon-links" height="30" aria-hidden="true" data-tip="concept.transitions">
        {view.chords.map((c, i) => {
          if (i === 0 || c.transition.reason.kind === "noContext") return null;
          const a = geometry[i - 1];
          const b = geometry[i];
          const x1 = a.left + a.width / 2;
          const x2 = b.left + b.width / 2;
          const strength = c.transition.score >= 1 ? "strong" : c.transition.score >= 0.7 ? "medium" : "weak";
          return (
            <path key={i} className={`link link-${strength}`} d={`M ${x1} 28 Q ${(x1 + x2) / 2} ${2} ${x2} 28`}>
              <title>{reasonText(t, c.transition.reason)}</title>
            </path>
          );
        })}
      </svg>

      <div className={`ribbon-lane ${payload ? "is-drop-zone" : ""}`} ref={laneRef} data-tip="concept.tension">
        {view.chords.length === 0 && <EmptyRibbon />}

        {view.chords.map((c, i) => {
          const primary = symbols === "names" ? chordSymbol(c.label, notation) : romanSymbol(c.label);
          const secondary = symbols === "names" ? romanSymbol(c.label) : chordSymbol(c.label, notation);
          const isDragged = payload?.kind === "move" && sameRef(payload.from, c);
          const classes = [
            "chord-block",
            sameRef(selected, c) ? "is-selected" : "",
            i === playingIndex ? "is-playing" : "",
            isDragged ? "is-dragged" : "",
          ].join(" ");
          return (
            <div
              key={`${c.section}-${c.index}`}
              className={classes}
              data-tip={`function.${c.label.function}`}
              style={{
                left: geometry[i].left,
                width: geometry[i].width,
                ["--fn" as string]: functionColor(c.label.function),
                ["--tension" as string]: c.label.tension,
              }}
              onPointerDown={(e) => onBlockDown(e, c)}
            >
              <div className="block-glow" />
              <div className="block-body">
                <span className="block-primary">{primary}</span>
                {level !== "beginner" && <span className="block-secondary">{secondary}</span>}
                {level === "beginner" && <span className="block-function">{t(`function.${c.label.function}`)}</span>}
              </div>
              <div className="block-resize" title={t("ribbon.resize")} onPointerDown={(e) => onResizeDown(e, c)} />
            </div>
          );
        })}

        {showVoices && view.chords.length > 0 && (
          <VoiceLines chords={view.chords} geometry={geometry} height={laneRef.current?.clientHeight ?? 168} />
        )}

        {payload && target && <div className="drop-indicator" style={{ left: target.x - 3 }} />}
      </div>
    </div>
  );
}

/** Cinta vacía: invita a empezar y ofrece una progresión de ejemplo. */
function EmptyRibbon() {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView;
  const edit = useSong((s) => s.edit);
  const key = view.song.homeKey;
  const section = view.sections.filter((s) => s.isLeaf)[0].id;

  const tryExample = () => {
    // I–V–vi–IV en mayor; i–VI–III–VII en menor.
    const degrees: [number, number[]][] = isMinorLike(key.scale.name)
      ? [[0, [3, 7]], [8, [4, 7]], [3, [4, 7]], [10, [4, 7]]]
      : [[0, [4, 7]], [7, [4, 7]], [9, [3, 7]], [5, [4, 7]]];
    const commands = degrees.map(([deg, intervals], index) => {
      const chord: Chord = { root: (key.root + deg) % 12, intervals };
      return { type: "insertChord" as const, section, index, chord, length: null };
    });
    void edit({ type: "batch", commands });
  };

  return (
    <div className="ribbon-empty">
      <p>{t("ribbon.empty")}</p>
      <button className="ghost-button" onClick={tryExample}>
        <Icon name="sparkle" size={16} /> {t("ribbon.example")}
      </button>
    </div>
  );
}
