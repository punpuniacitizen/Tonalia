// Caja de selección en una fila de acordes (la cinta o los bloques de una pista de acordes):
// arrastrar elige los acordes que toca la caja; con Mayús se suman a los que ya había.
// Un clic sin arrastrar llama a `onClick` (elegir el acorde tocado o soltar lo elegido).

import { useNotes, type ChordLane } from "../../stores/notes";

export type LassoBox = { x0: number; x1: number } | null;
export type LaneItem = { key: string; left: number; right: number };

export function startLaneLasso(
  e: React.PointerEvent,
  el: HTMLElement,
  items: LaneItem[],
  lane: ChordLane,
  setBox: (box: LassoBox) => void,
  onClick: () => void,
) {
  const rect = el.getBoundingClientRect();
  const x0 = e.clientX - rect.left;
  const store = useNotes.getState();
  const base = e.shiftKey && store.chordPick?.lane === lane ? [...store.chordPick.keys] : [];
  store.setFocus({ kind: "chords", lane });
  let moved = false;
  const move = (ev: PointerEvent) => {
    const x = ev.clientX - rect.left;
    if (!moved && Math.abs(x - x0) < 5) return;
    moved = true;
    const [a, b] = [Math.min(x0, x), Math.max(x0, x)];
    setBox({ x0: a, x1: b });
    const inside = items.filter((it) => it.right >= a && it.left <= b).map((it) => it.key);
    useNotes.getState().pickChords(lane, [...base, ...inside]);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    setBox(null);
    if (!moved) onClick();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}
