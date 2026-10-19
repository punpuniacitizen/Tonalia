import { useEffect } from "react";

import { api } from "../../api";
import type { Note } from "../../bindings/Note";
import { noteKey, useNotes } from "../../stores/notes";
import { useProject } from "../../stores/project";
import { useSong } from "../../stores/song";
import { useTransport } from "../../stores/transport";
import { sameRef, useUi } from "../../stores/ui";

/**
 * Atajos globales:
 * Espacio = reproducir/parar · Ctrl+Z / Ctrl+Y = deshacer/rehacer · Supr = borrar
 * ← → = acorde anterior/siguiente · Esc = quitar selección
 * Con notas seleccionadas: Supr = borrarlas · ↑ ↓ = transponer (Mayús: octava) · Ctrl+A = todas
 */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      const { view, edit, undo, redo } = useSong.getState();
      const { selected, select } = useUi.getState();
      const notesState = useNotes.getState();
      const ctrl = e.ctrlKey || e.metaKey;
      const noteTrack = notesState.selectionTrack;
      const trackNotes: Note[] = view?.trackNotes.find((t) => t.track === noteTrack)?.notes ?? [];
      const selectedNotes = trackNotes.filter((n) => notesState.selection.has(noteKey(n)));

      const k = e.key.toLowerCase();
      const project = useProject.getState();
      if (ctrl && k === "s") {
        e.preventDefault();
        void (e.shiftKey ? project.saveProjectAs() : project.saveProject());
      } else if (ctrl && k === "o") {
        e.preventDefault();
        void project.openProject();
      } else if (ctrl && k === "n") {
        e.preventDefault();
        void project.newProject();
      } else if (ctrl && k === "e") {
        e.preventDefault();
        void project.exportMidi(undefined);
      } else if (e.code === "Space") {
        e.preventDefault();
        useTransport.getState().toggle();
      } else if (ctrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        void undo();
      } else if (ctrl && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        void redo();
      } else if (ctrl && e.key.toLowerCase() === "a" && notesState.expandedTrack !== null) {
        e.preventDefault();
        const notes = view?.trackNotes.find((t) => t.track === notesState.expandedTrack)?.notes ?? [];
        notesState.select(notesState.expandedTrack, notes.map(noteKey));
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedNotes.length && noteTrack !== null) {
        e.preventDefault();
        void edit({ type: "setTrackNotes", track: noteTrack, notes: trackNotes.filter((n) => !notesState.selection.has(noteKey(n))) });
        notesState.clearSelection();
      } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && selectedNotes.length && noteTrack !== null) {
        e.preventDefault();
        const dp = (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 12 : 1);
        const moved = selectedNotes.map((n) => ({ ...n, pitch: Math.min(127, Math.max(0, n.pitch + dp)) }));
        const rest = trackNotes.filter((n) => !notesState.selection.has(noteKey(n)));
        void edit({ type: "setTrackNotes", track: noteTrack, notes: [...rest, ...moved] });
        notesState.select(noteTrack, moved.map(noteKey));
        const instrument = view?.song.tracks.find((t) => t.id === noteTrack)?.instrument;
        void api.previewNotes(moved.map((n) => n.pitch), 0.8, instrument, 0.35);
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
        if (notesState.selection.size) notesState.clearSelection();
        else select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
