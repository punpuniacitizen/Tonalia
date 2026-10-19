import { useEffect } from "react";

import { api } from "../../api";
import { useSong } from "../../stores/song";
import { useTransport } from "../../stores/transport";
import { sameRef, useUi } from "../../stores/ui";

/**
 * Atajos globales:
 * Espacio = reproducir/parar · Ctrl+Z / Ctrl+Y = deshacer/rehacer · Supr = borrar acorde
 * ← → = acorde anterior/siguiente · Esc = quitar selección
 */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      const { view, edit, undo, redo } = useSong.getState();
      const { selected, select } = useUi.getState();
      const ctrl = e.ctrlKey || e.metaKey;

      if (e.code === "Space") {
        e.preventDefault();
        useTransport.getState().toggle();
      } else if (ctrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        void undo();
      } else if (ctrl && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        void redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        void edit({ type: "removeChords", chords: [selected] });
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && view && view.chords.length) {
        e.preventDefault();
        const i = view.chords.findIndex((c) => sameRef(c, selected));
        const next = e.key === "ArrowRight" ? Math.min(view.chords.length - 1, i + 1) : Math.max(0, i < 0 ? view.chords.length - 1 : i - 1);
        const c = view.chords[next];
        select({ section: c.section, index: c.index });
        void api.previewChord(c.chord, c.key.root);
      } else if (e.key === "Escape") {
        select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
