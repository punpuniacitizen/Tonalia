// Tip abierto. Se abre con clic derecho sobre `[data-tip]` o desde botones "?".

import { create } from "zustand";

import { TIPS } from "../tips/tips";

export type OpenTip = { id: string; x: number; y: number };

export const useTips = create<{ open: OpenTip | null; set: (o: OpenTip | null) => void }>()((set) => ({
  open: null,
  set: (open) => set({ open }),
}));

export function showTip(id: string, x: number, y: number) {
  if (TIPS[id]) useTips.getState().set({ id, x, y });
}
