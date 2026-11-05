// Vista «piano roll» de una pista de acordes: las notas que toca en cada acorde, dentro de
// una caja con su nombre. Se eligen acordes con clic (Mayús suma o quita) o con un lazo
// desde un hueco; luego «Arpegiar» los arpegia. Doble clic: extensiones y voces.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SongView } from "../../bindings/SongView";
import { chordSymbol, functionColor, romanSymbol } from "../../lib/music";
import { useDrag } from "../../stores/drag";
import { chordKey, noteKey, useNotes, type ChordLane } from "../../stores/notes";
import { useSong } from "../../stores/song";
import { currentPosition, useTransport } from "../../stores/transport";
import { useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";
import { useChordDrop } from "../timeline/ChordRibbon";
import { pxPerTick, tickToX, xToTick } from "../timeline/geometry";
import { drawKeyboard, drawPianoRoll, pitchToY, yToPitch } from "./drawPianoRoll";
import { harmonyRegions, regionAt } from "./harmony";
import { laneChordNotes, laneInstrument, laneStyleIcon, openChordTools, pickLaneChord } from "./chordLane";
import { api } from "../../api";
import { KEYS_WIDTH, MAX_ROW, MIN_ROW } from "./PianoRoll";

const MAX_CANVAS_WIDTH = 16000;
const EMPTY = new Set<string>();
/** Margen de la caja alrededor de las notas del acorde. */
const BOX_PAD = 3;

type Lasso = { x0: number; y0: number; additive: boolean; base: Set<string>; moved: boolean };

export function ChordPianoRoll({ lane, color, width, height }: { lane: ChordLane; color: string; width: number; height: number }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView;
  const { pxPerBar, gridDivisions, notation, level, symbols, pianoRowHeight: rh } = useUi();
  const picked = useNotes((s) => (s.chordPick?.lane === lane ? s.chordPick.keys : EMPTY));
  const pickChords = useNotes((s) => s.pickChords);
  const clearChordPick = useNotes((s) => s.clearChordPick);
  const playing = useTransport((s) => s.playing);
  const payload = useDrag((s) => s.payload);
  const dropTarget = useDrag((s) => s.target);

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<HTMLCanvasElement>(null);
  const lassoRef = useRef<Lasso | null>(null);
  const [lasso, setLasso] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [hoverPitch, setHoverPitch] = useState<number | null>(null);
  const [hoverTick, setHoverTick] = useState<number | null>(null);

  const canvasWidth = Math.min(width, MAX_CANVAS_WIDTH);
  const ppt = pxPerTick(pxPerBar);
  const rows = Math.ceil(height / rh);
  const instrument = laneInstrument(view, lane);

  // La pista principal acepta acordes soltados desde la rueda también en esta vista.
  useChordDrop(rootRef, lane === "main");

  const perChord = useMemo(() => view.chords.map((c) => laneChordNotes(view, lane, c)), [view, lane]);
  const notes = useMemo(() => perChord.flat(), [perChord]);
  const [topPitch, setTopPitch] = useState(() => (notes.length ? Math.min(127, Math.max(...notes.map((n) => n.pitch)) + 6) : 80));
  const regions = useMemo(() => harmonyRegions(view, xToTick(canvasWidth, pxPerBar)), [view, canvasWidth, pxPerBar]);
  const selection = useMemo(() => {
    const keys = new Set<string>();
    view.chords.forEach((c, i) => {
      if (picked.has(chordKey(c))) for (const n of perChord[i]) keys.add(noteKey(n));
    });
    return keys;
  }, [view, perChord, picked]);

  // Cajas: del inicio al final del acorde, de su nota más grave a la más aguda.
  const boxes = view.chords.map((c, i) => {
    const ns = perChord[i];
    if (!ns.length) return null;
    const hi = Math.max(...ns.map((n) => n.pitch));
    const lo = Math.min(...ns.map((n) => n.pitch));
    const top = pitchToY(hi, topPitch, rh) - BOX_PAD;
    const bottom = pitchToY(lo, topPitch, rh) + rh + BOX_PAD;
    return { left: tickToX(c.start, pxPerBar) + 1, width: Math.max(8, c.length * ppt - 2), top, height: Math.max(18, bottom - top) };
  });

  // ---------- Dibujo ----------
  useLayoutEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(canvasWidth * dpr) || c.height !== Math.round(height * dpr)) {
      c.width = Math.round(canvasWidth * dpr);
      c.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPianoRoll(ctx, {
      width: canvasWidth,
      height,
      topPitch,
      pxPerBar,
      regions,
      notes,
      selection,
      trackColor: color,
      notation,
      showLabels: level !== "advanced",
      lasso,
      hoverPitch,
      gridDivisions,
      rowHeight: rh,
    });
  }, [canvasWidth, height, topPitch, pxPerBar, regions, notes, selection, color, notation, level, lasso, hoverPitch, gridDivisions, rh]);

  // Teclado: las notas del acorde bajo el puntero (o del que suena) y lo que suena.
  useEffect(() => {
    const c = keysRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(KEYS_WIDTH * dpr);
    c.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let frame = 0;
    const paint = () => {
      const focus = playing ? currentPosition() : (hoverTick ?? 0);
      const region = regionAt(regions, focus);
      const sounding = new Set<number>();
      if (playing) for (const n of notes) if (focus >= n.position && focus < n.position + n.length) sounding.add(n.pitch);
      drawKeyboard(ctx, KEYS_WIDTH, height, topPitch, region?.chordPcs ?? new Set(), sounding, region?.fn ?? null, notation, rh);
      if (playing) frame = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(frame);
  }, [playing, hoverTick, regions, notes, height, topPitch, notation, rh]);

  // Rueda: desplaza las alturas; Alt + rueda = zoom vertical (Ctrl + rueda lo maneja la línea de tiempo).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey || e.ctrlKey) return;
      e.preventDefault();
      if (e.altKey) {
        const { pianoRowHeight, set } = useUi.getState();
        set({ pianoRowHeight: Math.min(MAX_ROW, Math.max(MIN_ROW, pianoRowHeight + (e.deltaY < 0 ? 2 : -2))) });
        return;
      }
      setTopPitch((p) => Math.min(127, Math.max(rows - 1, p + (e.deltaY < 0 ? 2 : -2))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [rows]);

  // ---------- Lazo desde un hueco ----------
  const local = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const { x, y } = local(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    lassoRef.current = { x0: x, y0: y, additive: e.shiftKey, base: e.shiftKey ? new Set(picked) : new Set(), moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = local(e);
    setHoverPitch(yToPitch(y, topPitch, rh));
    setHoverTick(xToTick(x, pxPerBar));
    const g = lassoRef.current;
    if (!g) return;
    if (!g.moved && Math.hypot(x - g.x0, y - g.y0) < 4) return;
    g.moved = true;
    setLasso({ x0: g.x0, y0: g.y0, x1: x, y1: y });
    const [xa, xb] = [Math.min(g.x0, x), Math.max(g.x0, x)];
    const [ya, yb] = [Math.min(g.y0, y), Math.max(g.y0, y)];
    const inside = view.chords.filter((_, i) => {
      const b = boxes[i];
      return b && b.left + b.width >= xa && b.left <= xb && b.top + b.height >= ya && b.top <= yb;
    });
    pickChords(lane, [...g.base, ...inside.map(chordKey)]);
  };

  const onPointerUp = () => {
    const g = lassoRef.current;
    lassoRef.current = null;
    setLasso(null);
    // Un clic en un hueco (sin Mayús) suelta lo elegido.
    if (g && !g.moved && !g.additive) clearChordPick();
  };

  const onKeysDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    void api.previewNotes([yToPitch(e.clientY - r.top, topPitch, rh)], 0.8, instrument, 0.35);
  };

  return (
    <div className="piano-roll chord-roll" style={{ height }} ref={rootRef}>
      <div className="piano-keys">
        <canvas ref={keysRef} style={{ width: KEYS_WIDTH, height }} onPointerDown={onKeysDown} />
      </div>
      <canvas
        ref={canvasRef}
        className="piano-grid"
        style={{ width: canvasWidth, height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          setHoverPitch(null);
          setHoverTick(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="chord-roll-boxes" style={{ width: canvasWidth, height }}>
        {view.chords.map((c, i) => {
          const b = boxes[i];
          if (!b) return null;
          const name = symbols === "names" ? chordSymbol(c.label, notation) : romanSymbol(c.label);
          const style = laneStyleIcon(c, lane);
          return (
            <div
              key={`${c.section}-${c.index}`}
              className={`chord-box ${picked.has(chordKey(c)) ? "is-picked" : ""} ${b.top < 16 ? "label-inside" : ""}`}
              style={{ left: b.left, top: b.top, width: b.width, height: b.height, ["--fn" as string]: functionColor(c.label.function) }}
              title={t("chordLane.pickHint")}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                pickLaneChord(view, lane, c, e.shiftKey, pickChords);
              }}
              onDoubleClick={(e) => openChordTools(c, e.currentTarget)}
            >
              <span className="chord-box-label">
                {name}
                {style && <Icon name={style} size={11} />}
              </span>
            </div>
          );
        })}
        {lane === "main" && payload && dropTarget && <div className="drop-indicator" style={{ left: dropTarget.x - 3 }} />}
      </div>
      {view.chords.length === 0 && <span className="lane-mini-empty chord-roll-empty">{lane === "main" ? t("chordLane.emptyMain") : t("chordLane.emptyHint")}</span>}
    </div>
  );
}
