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

export type ProjectInfo = { path: string | null; name: string | null; dirty: boolean; autosaveFile: boolean };
export type RecentProject = { path: string; name: string };
export type EmergencyCopy = { path: string; time: number };

const FILTER = [{ name: "Tonalia", extensions: ["tonalia"] }];

interface ProjectState {
  info: ProjectInfo;
  recent: RecentProject[];
  emergency: EmergencyCopy[];
  restoreEmergency: (path: string) => Promise<void>;
  showEmergencyFolder: () => Promise<void>;
  refresh: () => Promise<void>;
  markDirty: () => void;
  newProject: () => Promise<void>;
  openProject: () => Promise<void>;
  openRecent: (path: string) => Promise<void>;
  clearRecent: () => Promise<void>;
  setAutosaveFile: (enabled: boolean) => Promise<void>;
  saveProject: () => Promise<boolean>;
  saveProjectAs: () => Promise<boolean>;
  exportMidi: (region?: { start: number; end: number }) => Promise<void>;
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
  info: { path: null, name: null, dirty: false, autosaveFile: false },
  recent: [],
  emergency: [],
  refresh: async () => {
    const [info, recent, emergency] = await Promise.all([
      invoke<ProjectInfo>("project_info"),
      invoke<RecentProject[]>("recent_projects"),
      invoke<EmergencyCopy[]>("emergency_copies"),
    ]);
    set({ info, recent, emergency });
  },
  restoreEmergency: async (path) => {
    if (!(await confirmDiscard())) return;
    try {
      loadView(await invoke<SongView>("restore_emergency", { path }));
    } catch (e) {
      useSong.setState({ error: String(e) });
    }
    await get().refresh();
  },
  showEmergencyFolder: async () => {
    await invoke("emergency_folder").catch((e) => useSong.setState({ error: String(e) }));
  },
  // Con el autoguardado en el archivo, el cambio ya quedó guardado.
  markDirty: () => {
    const { info } = get();
    if (info.dirty || (info.autosaveFile && info.path)) return;
    set({ info: { ...info, dirty: true } });
  },
  newProject: async () => {
    if (!(await confirmDiscard())) return;
    loadView(await invoke<SongView>("new_project"));
    await get().refresh();
  },
  openProject: async () => {
    if (!(await confirmDiscard())) return;
    const path = await open({ filters: FILTER, multiple: false, directory: false });
    if (typeof path !== "string") return;
    await openProjectPath(path);
  },
  openRecent: async (path) => {
    if (!(await confirmDiscard())) return;
    await openProjectPath(path);
  },
  clearRecent: async () => {
    await invoke("clear_recent_projects");
    set({ recent: [] });
  },
  setAutosaveFile: async (enabled) => {
    try {
      set({ info: await invoke<ProjectInfo>("set_autosave_file", { enabled }) });
    } catch (e) {
      useSong.setState({ error: String(e) });
    }
  },
  saveProject: async () => {
    if (!get().info.path) return get().saveProjectAs();
    set({ info: await invoke<ProjectInfo>("save_project", { path: null }) });
    await get().refresh();
    return true;
  },
  saveProjectAs: async () => {
    const path = await save({ filters: FILTER, defaultPath: `${get().info.name ?? i18n.t("file.untitled")}.tonalia` });
    if (!path) return false;
    try {
      set({ info: await invoke<ProjectInfo>("save_project", { path }) });
      await get().refresh();
      return true;
    } catch (e) {
      useSong.setState({ error: String(e) });
      return false;
    }
  },
  exportMidi: async (region) => {
    const suffix = region ? `-${i18n.t("file.loopSuffix")}` : "";
    const path = await save({
      filters: [{ name: "MIDI", extensions: ["mid"] }],
      defaultPath: `${get().info.name ?? i18n.t("file.untitled")}${suffix}.mid`,
    });
    if (!path) return;
    try {
      await invoke("export_midi", { path, includeChords: true, tracks: null, region: region ? [region.start, region.end] : null });
    } catch (e) {
      useSong.setState({ error: String(e) });
    }
  },
}));

async function openProjectPath(path: string) {
  try {
    loadView(await invoke<SongView>("open_project", { path }));
  } catch (e) {
    useSong.setState({ error: String(e) });
  }
  await useProject.getState().refresh();
}

onSongChanged(() => useProject.getState().markDirty());

// Título de la ventana: nombre del proyecto y un punto si hay cambios sin guardar.
useProject.subscribe(({ info }) => {
  const name = info.name ?? i18n.t("file.untitled");
  void getCurrentWindow()
    .setTitle(`${name}${info.dirty ? " •" : ""} — Tonalia`)
    .catch(() => {});
});
