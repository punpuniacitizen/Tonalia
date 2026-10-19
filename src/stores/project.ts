// Proyecto: archivo abierto, cambios sin guardar y acciones del menú Archivo.

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import { create } from "zustand";

import type { SongView } from "../bindings/SongView";
import i18n from "../i18n";
import { useNotes } from "./notes";
import { onSongChanged, useSong } from "./song";
import { useUi } from "./ui";

export type ProjectInfo = { path: string | null; name: string | null; dirty: boolean };

const FILTER = [{ name: "Tonalia", extensions: ["tonalia"] }];

interface ProjectState {
  info: ProjectInfo;
  refresh: () => Promise<void>;
  markDirty: () => void;
  newProject: () => Promise<void>;
  openProject: () => Promise<void>;
  saveProject: () => Promise<boolean>;
  saveProjectAs: () => Promise<boolean>;
  exportMidi: () => Promise<void>;
}

async function confirmDiscard(): Promise<boolean> {
  if (!useProject.getState().info.dirty) return true;
  return ask(i18n.t("file.discardQuestion"), { title: "Tonalia", kind: "warning" });
}

function loadView(view: SongView) {
  useSong.setState({ view, error: null });
  useUi.getState().select(null);
  useNotes.getState().clearSelection();
}

export const useProject = create<ProjectState>()((set, get) => ({
  info: { path: null, name: null, dirty: false },
  refresh: async () => set({ info: await invoke<ProjectInfo>("project_info") }),
  markDirty: () => !get().info.dirty && set({ info: { ...get().info, dirty: true } }),
  newProject: async () => {
    if (!(await confirmDiscard())) return;
    loadView(await invoke<SongView>("new_project"));
    await get().refresh();
  },
  openProject: async () => {
    if (!(await confirmDiscard())) return;
    const path = await open({ filters: FILTER, multiple: false, directory: false });
    if (typeof path !== "string") return;
    try {
      loadView(await invoke<SongView>("open_project", { path }));
      await get().refresh();
    } catch (e) {
      useSong.setState({ error: String(e) });
    }
  },
  saveProject: async () => {
    if (!get().info.path) return get().saveProjectAs();
    set({ info: await invoke<ProjectInfo>("save_project", { path: null }) });
    return true;
  },
  saveProjectAs: async () => {
    const path = await save({ filters: FILTER, defaultPath: `${get().info.name ?? i18n.t("file.untitled")}.tonalia` });
    if (!path) return false;
    try {
      set({ info: await invoke<ProjectInfo>("save_project", { path }) });
      return true;
    } catch (e) {
      useSong.setState({ error: String(e) });
      return false;
    }
  },
  exportMidi: async () => {
    const path = await save({
      filters: [{ name: "MIDI", extensions: ["mid"] }],
      defaultPath: `${get().info.name ?? i18n.t("file.untitled")}.mid`,
    });
    if (!path) return;
    try {
      await invoke("export_midi", { path, includeChords: true, tracks: null, region: null });
    } catch (e) {
      useSong.setState({ error: String(e) });
    }
  },
}));

onSongChanged(() => useProject.getState().markDirty());

// Título de la ventana: nombre del proyecto y un punto si hay cambios sin guardar.
useProject.subscribe(({ info }) => {
  const name = info.name ?? i18n.t("file.untitled");
  void getCurrentWindow()
    .setTitle(`${name}${info.dirty ? " •" : ""} — Tonalia`)
    .catch(() => {});
});
