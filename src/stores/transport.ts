// Transporte (reproducir/parar) y posición del cursor.
// Rust publica la posición ~30 veces por segundo; entre mensajes la estimamos con el reloj
// para que el cursor se mueva suave a 60 fps.

import { create } from "zustand";

import { api, onTransport } from "../api";
import { TICKS_PER_BEAT } from "../lib/music";
import { useSong } from "./song";

interface TransportStore {
  playing: boolean;
  /** Última posición conocida (ticks) y cuándo se recibió (performance.now()). */
  position: number;
  at: number;
  play: () => void;
  stop: () => void;
  toggle: () => void;
  seek: (ticks: number) => void;
  rewind: () => void;
}

export const useTransport = create<TransportStore>()((set, get) => ({
  playing: false,
  position: 0,
  at: performance.now(),
  play: () => {
    const from = currentPosition();
    set({ playing: true, position: from, at: performance.now() });
    void api.play(from);
  },
  stop: () => {
    set({ playing: false, position: currentPosition(), at: performance.now() });
    void api.stop();
  },
  toggle: () => (get().playing ? get().stop() : get().play()),
  seek: (ticks) => {
    set({ position: Math.max(0, ticks), at: performance.now() });
    void api.seek(Math.max(0, ticks));
  },
  rewind: () => get().seek(0),
}));

void onTransport(({ playing, position }) => {
  useTransport.setState({ playing, position, at: performance.now() });
});

/** Posición estimada ahora mismo, teniendo en cuenta el bucle. */
export function currentPosition(): number {
  const { playing, position, at } = useTransport.getState();
  if (!playing) return position;
  const view = useSong.getState().view;
  if (!view) return position;
  const ticksPerMs = (view.song.bpm / 60) * TICKS_PER_BEAT / 1000;
  let p = position + (performance.now() - at) * ticksPerMs;
  if (view.song.looping) {
    const start = view.song.loopRegion?.start ?? 0;
    const end = view.song.loopRegion?.end ?? view.length;
    if (end > start && p >= end) p = start + ((p - start) % (end - start));
  }
  return p;
}
