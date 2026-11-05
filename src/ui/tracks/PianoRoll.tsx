import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { api } from "../../api";
import type { Note } from "../../bindings/Note";
import type { SongView } from "../../bindings/SongView";
import type { Track } from "../../bindings/Track";
import { noteKey, useNotes } from "../../stores/notes";
import { useSelectedChord, useSong } from "../../stores/song";
import { currentPosition, useTransport } from "../../stores/transport";
import { useUi } from "../../stores/ui";
import { gridStep, snap, tickToX, xToTick } from "../timeline/geometry";
import { drawKeyboard, drawPianoRoll, pitchToY, yToPitch } from "./drawPianoRoll";
import { harmonyRegions, regionAt } from "./harmony";

export const KEYS_WIDTH = 48;
const MIN_LENGTH = 162; // 1/64
const MAX_CANVAS_WIDTH = 16000;
/** Límites del zoom vertical (alto de fila en píxeles). */
export const MIN_ROW = 6;
export const MAX_ROW = 32;
const EMPTY = new Set<string>();

type Gesture =
  | { kind: "create"; note: Note; downX: number }
  | { kind: "move"; originals: Note[]; downTick: number; downPitch: number; lastDp: number }
  | { kind: "resizeEnd" | "resizeStart"; originals: Note[]; downTick: number }
  | { kind: "velocity"; originals: Note[]; downY: number }
  | { kind: "lasso"; x0: number; y0: number; additive: boolean };

type Hit = { note: Note; zone: "body" | "start" | "end" };

function defaultTopPitch(notes: Note[], instrument: string): number {
  if (notes.length) return Math.min(127, Math.max(...notes.map((n) => n.pitch)) + 5);
  return instrument === "bass" ? 62 : 86;
}

const sortNotes = (notes: Note[]) => [...notes].sort((a, b) => a.position - b.position || a.pitch - b.pitch);

export function PianoRoll({ track, width, height }: { track: Track; width: number; height: number }) {
  const view = useSong((s) => s.view) as SongView;
  const edit = useSong((s) => s.edit);
  const { pxPerBar, gridDivisions, notation, level, noteLength, pianoRowHeight: rh } = useUi();
  const { tool, selection, selectionTrack, select, clearSelection } = useNotes();
  const playing = useTransport((s) => s.playing);
  const selectedChord = useSelectedChord();

  const committed = useMemo(() => view.trackNotes.find((t) => t.track === track.id)?.notes ?? [], [view, track.id]);
  const [draft, setDraft] = useState<Note[] | null>(null);
  const draftRef = useRef<Note[] | null>(null);
  const notes = draft ?? committed;
  const [topPitch, setTopPitch] = useState(() => defaultTopPitch(committed, track.instrument));
  const [lasso, setLasso] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [hoverPitch, setHoverPitch] = useState<number | null>(null);
  const [hoverTick, setHoverTick] = useState<number | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<HTMLCanvasElement>(null);

  const canvasWidth = Math.min(width, MAX_CANVAS_WIDTH);
  const rows = Math.ceil(height / rh);
  const regions = useMemo(() => harmonyRegions(view, xToTick(canvasWidth, pxPerBar)), [view, canvasWidth, pxPerBar]);
  const sel = selectionTrack === track.id ? selection : EMPTY;
  const step = gridDivisions > 0 ? gridStep(gridDivisions) : MIN_LENGTH;
  // Con Alt pulsado (se puede pulsar a mitad del arrastre) las notas se mueven y estiran
  // libremente, sin la cuadrícula; el mínimo pasa a ser una semifusa de 1/64.
  const snapTo = (ticks: number, free: boolean) => snap(ticks, free ? 0 : gridDivisions);
  const minLength = (n: Note, free: boolean) => (free ? Math.min(MIN_LENGTH, n.length) : Math.min(step, n.length));

  const setDraftNotes = (n: Note[] | null) => {
    draftRef.current = n;
    setDraft(n);
  };

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
      selection: sel,
      trackColor: track.color,
      notation,
      showLabels: level !== "advanced",
      lasso,
      hoverPitch,
      gridDivisions,
      rowHeight: rh,
    });
  }, [canvasWidth, height, topPitch, pxPerBar, regions, notes, sel, track.color, notation, level, lasso, hoverPitch, gridDivisions, rh]);

  // Si cambian las notas (bajo automático, deshacer…) y ninguna queda a la vista, ir hacia ellas.
  useEffect(() => {
    if (!committed.length) return;
    const visible = committed.some((n) => n.pitch <= topPitch && n.pitch > topPitch - rows);
    if (!visible) setTopPitch(defaultTopPitch(committed, track.instrument));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed]);

  // Teclado: resalta las notas del acorde en el instante de interés y lo que suena.
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
      const focus = playing ? currentPosition() : (hoverTick ?? selectedChord?.start ?? 0);
      const region = regionAt(regions, focus);
      const sounding = new Set<number>();
      if (playing) for (const n of notes) if (focus >= n.position && focus < n.position + n.length) sounding.add(n.pitch);
      drawKeyboard(ctx, KEYS_WIDTH, height, topPitch, region?.chordPcs ?? new Set(), sounding, region?.fn ?? null, notation, rh);
      if (playing) frame = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(frame);
  }, [playing, hoverTick, selectedChord, regions, notes, height, topPitch, notation, rh]);

  // Rueda: desplaza las alturas (Mayús + rueda = desplazamiento horizontal normal,
  // Ctrl + rueda = zoom horizontal, Alt + rueda = zoom vertical).
  useEffect(() => {
    const el = canvasRef.current?.parentElement;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey || e.ctrlKey) return;
      e.preventDefault();
      if (e.altKey) {
        zoomRows(e.deltaY < 0 ? 1 : -1);
        return;
      }
      setTopPitch((p) => Math.min(127, Math.max(rows - 1, p + (e.deltaY < 0 ? 2 : -2))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [rows]);

  // ---------- Interacción ----------
  // Zoom vertical: filas más altas o más bajas, manteniendo arriba la misma nota.
  function zoomRows(direction: number) {
    const { pianoRowHeight, set } = useUi.getState();
    set({ pianoRowHeight: Math.min(MAX_ROW, Math.max(MIN_ROW, pianoRowHeight + direction * 2)) });
  }

  const local = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const hit = (x: number, y: number): Hit | null => {
    const pitch = yToPitch(y, topPitch, rh);
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (n.pitch !== pitch) continue;
      const x0 = tickToX(n.position, pxPerBar);
      const x1 = tickToX(n.position + n.length, pxPerBar);
      if (x < x0 || x > x1) continue;
      const zone = x > x1 - 6 ? "end" : x < x0 + 5 && x1 - x0 > 14 ? "start" : "body";
      return { note: n, zone };
    }
    return null;
  };

  const preview = (pitch: number) => void api.previewNotes([pitch], 0.8, track.instrument, 0.35);

  const commit = (next: Note[]) => {
    void edit({ type: "setTrackNotes", track: track.id, notes: sortNotes(next) }).finally(() => setDraftNotes(null));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.altKey) e.preventDefault();
    const { x, y } = local(e);
    const tick = xToTick(x, pxPerBar);
    const pitch = yToPitch(y, topPitch, rh);
    const h = hit(x, y);

    if (e.button === 2) {
      if (h) commit(notes.filter((n) => n !== h.note));
      return;
    }
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    useNotes.getState().setFocus({ kind: "notes", track: track.id });

    if (h) {
      // Como en FL Studio: las notas nuevas salen con el largo de la última que tocaste.
      useUi.getState().set({ noteLength: h.note.length });
      const key = noteKey(h.note);
      const keys = e.shiftKey ? new Set([...sel, key]) : sel.has(key) ? sel : new Set([key]);
      select(track.id, keys);
      const originals = notes.filter((n) => keys.has(noteKey(n)));
      if (tool === "velocity") gesture.current = { kind: "velocity", originals, downY: y };
      else if (h.zone === "end") gesture.current = { kind: "resizeEnd", originals, downTick: tick };
      else if (h.zone === "start") gesture.current = { kind: "resizeStart", originals, downTick: tick };
      else {
        gesture.current = { kind: "move", originals, downTick: tick, downPitch: pitch, lastDp: 0 };
        preview(h.note.pitch);
      }
    } else if (tool === "select" || e.shiftKey || e.ctrlKey) {
      // Caja de selección: con la herramienta Seleccionar, o con Mayús / Ctrl en cualquiera.
      gesture.current = { kind: "lasso", x0: x, y0: y, additive: e.shiftKey };
      if (!e.shiftKey) clearSelection();
    } else if (tool === "draw") {
      const position = Math.max(0, e.altKey ? Math.round(tick) : Math.floor(tick / step) * step);
      // Las notas nuevas salen con el último largo usado (o un paso de la cuadrícula).
      const note: Note = { position, length: noteLength > 0 ? noteLength : step, pitch, velocity: 0.8 };
      gesture.current = { kind: "create", note, downX: x };
      setDraftNotes([...committed.filter((n) => noteKey(n) !== noteKey(note)), note]);
      select(track.id, [noteKey(note)]);
      preview(pitch);
    } else {
      clearSelection();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = local(e);
    const tick = xToTick(x, pxPerBar);
    const pitch = yToPitch(y, topPitch, rh);
    setHoverPitch(pitch);
    setHoverTick(tick);
    const g = gesture.current;

    if (!g) {
      const h = hit(x, y);
      e.currentTarget.style.cursor = h
        ? h.zone === "body"
          ? tool === "velocity"
            ? "ns-resize"
            : "grab"
          : "ew-resize"
        : tool === "draw"
          ? "crosshair"
          : "default";
      return;
    }

    const others = (originals: Note[]) => {
      const keys = new Set(originals.map(noteKey));
      return committed.filter((n) => !keys.has(noteKey(n)));
    };

    switch (g.kind) {
      case "create": {
        // Un clic sin arrastrar conserva el largo recordado.
        if (Math.abs(x - g.downX) < 4) break;
        const end = e.altKey ? Math.max(g.note.position + MIN_LENGTH, Math.round(tick)) : Math.max(g.note.position + step, Math.ceil(tick / step) * step);
        const note = { ...g.note, length: end - g.note.position };
        setDraftNotes([...committed.filter((n) => noteKey(n) !== noteKey(note)), note]);
        break;
      }
      case "move": {
        const minPos = Math.min(...g.originals.map((n) => n.position));
        const dt = Math.max(-minPos, snapTo(tick - g.downTick, e.altKey));
        const dp = pitch - g.downPitch;
        const moved = g.originals.map((n) => ({ ...n, position: n.position + dt, pitch: Math.min(127, Math.max(0, n.pitch + dp)) }));
        setDraftNotes([...others(g.originals), ...moved]);
        if (dp !== g.lastDp) {
          g.lastDp = dp;
          preview(moved[0].pitch);
        }
        break;
      }
      case "resizeEnd": {
        const dt = snapTo(tick - g.downTick, e.altKey);
        const resized = g.originals.map((n) => ({ ...n, length: Math.max(minLength(n, e.altKey), n.length + dt) }));
        setDraftNotes([...others(g.originals), ...resized]);
        break;
      }
      case "resizeStart": {
        const dt = snapTo(tick - g.downTick, e.altKey);
        const resized = g.originals.map((n) => {
          const end = n.position + n.length;
          const position = Math.min(end - minLength(n, e.altKey), Math.max(0, n.position + dt));
          return { ...n, position, length: end - position };
        });
        setDraftNotes([...others(g.originals), ...resized]);
        break;
      }
      case "velocity": {
        const dv = (g.downY - y) / 150;
        const changed = g.originals.map((n) => ({ ...n, velocity: Math.min(1, Math.max(0.05, n.velocity + dv)) }));
        setDraftNotes([...others(g.originals), ...changed]);
        break;
      }
      case "lasso": {
        setLasso({ x0: g.x0, y0: g.y0, x1: x, y1: y });
        const [xa, xb] = [Math.min(g.x0, x), Math.max(g.x0, x)];
        const [ya, yb] = [Math.min(g.y0, y), Math.max(g.y0, y)];
        const inside = notes.filter((n) => {
          const nx0 = tickToX(n.position, pxPerBar);
          const nx1 = tickToX(n.position + n.length, pxPerBar);
          const ny = pitchToY(n.pitch, topPitch, rh);
          return nx1 >= xa && nx0 <= xb && ny + rh >= ya && ny <= yb;
        });
        select(track.id, inside.map(noteKey), g.additive);
        break;
      }
    }
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    setLasso(null);
    if (!g || g.kind === "lasso") return;
    const next = draftRef.current;
    if (!next) return;
    // La selección sigue a las notas movidas/estiradas.
    const before = new Set(committed.map(noteKey));
    const changed = next.filter((n) => !before.has(noteKey(n)) || sel.has(noteKey(n)));
    if (g.kind !== "velocity") select(track.id, changed.map(noteKey));
    // Crear o estirar una nota fija el largo de las próximas.
    if ((g.kind === "create" || g.kind === "resizeEnd" || g.kind === "resizeStart") && changed[0]) {
      useUi.getState().set({ noteLength: changed[0].length });
    }
    commit(next);
  };

  const onKeysDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    preview(yToPitch(e.clientY - r.top, topPitch, rh));
  };

  return (
    <div className="piano-roll" style={{ height }}>
      <div className="piano-keys" data-tip="concept.roles">
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
    </div>
  );
}
