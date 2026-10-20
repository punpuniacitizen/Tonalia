import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import i18n from "../../i18n";

import { useProject } from "../../stores/project";
import { useSong } from "../../stores/song";
import { Icon, type IconName } from "../common/Icon";
import { Popover } from "../common/Popover";

/** Menú Archivo: nuevo, abrir, recientes, guardar, autoguardado y exportar MIDI. */
export function FileMenu() {
  const { t } = useTranslation();
  const info = useProject((s) => s.info);
  const recent = useProject((s) => s.recent);
  const emergency = useProject((s) => s.emergency);
  const p = useProject();
  const loop = useSong((s) => s.view?.song.loopRegion ?? null);

  useEffect(() => {
    void useProject.getState().refresh();
  }, []);

  const items: { icon: IconName; label: string; keys: string; run: () => unknown }[] = [
    { icon: "file", label: t("file.new"), keys: "Ctrl+N", run: p.newProject },
    { icon: "folder", label: t("file.open"), keys: "Ctrl+O", run: p.openProject },
    { icon: "save", label: t("file.save"), keys: "Ctrl+S", run: p.saveProject },
    { icon: "save", label: t("file.saveAs"), keys: "Ctrl+Mayús+S", run: p.saveProjectAs },
    { icon: "download", label: t("file.exportMidi"), keys: "Ctrl+E", run: () => p.exportMidi() },
  ];
  if (loop) {
    items.push({ icon: "download", label: t("file.exportLoop"), keys: "", run: () => p.exportMidi(loop) });
  }

  return (
    <Popover
      className="file-menu"
      trigger={(open, toggle) => (
        <button className={`file-button ${open ? "is-open" : ""}`} onClick={() => {
            // Recientes y copias de emergencia al día cada vez que se abre.
            if (!open) void p.refresh();
            toggle();
          }}
          title={info.path ?? t("file.untitled")}>
          <Icon name="folder" size={16} />
          <span className="file-name">{info.name ?? t("file.untitled")}</span>
          {info.dirty && <span className="file-dirty" title={t("file.unsaved")} />}
        </button>
      )}
    >
      {(close) => (
        <div className="menu-list">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                close();
                void it.run();
              }}
            >
              <Icon name={it.icon} size={15} />
              <span>{it.label}</span>
              <kbd>{it.keys}</kbd>
            </button>
          ))}
          <div className="menu-section">
            <span>{t("file.recent")}</span>
            {recent.length > 0 && (
              <button className="menu-link" onClick={() => void p.clearRecent()}>
                {t("file.clearRecent")}
              </button>
            )}
          </div>
          {recent.length === 0 && <p className="menu-note">{t("file.noRecent")}</p>}
          {recent.map((r) => (
            <button
              key={r.path}
              className={r.path === info.path ? "is-current" : ""}
              title={r.path}
              onClick={() => {
                close();
                void p.openRecent(r.path);
              }}
            >
              <Icon name="clock" size={15} />
              <span className="menu-recent-name">{r.name}</span>
              <kbd className="menu-recent-dir">{folderOf(r.path)}</kbd>
            </button>
          ))}
          <div className="menu-section">
            <span>{t("file.emergency")}</span>
            <button className="menu-link" onClick={() => void p.showEmergencyFolder()}>
              {t("file.emergencyFolder")}
            </button>
          </div>
          {emergency.length === 0 && <p className="menu-note">{t("file.noEmergency")}</p>}
          {emergency.map((c) => (
            <button
              key={c.path}
              title={t("file.emergencyRestore")}
              onClick={() => {
                close();
                void p.restoreEmergency(c.path);
              }}
            >
              <Icon name="save" size={15} />
              <span>{new Date(c.time * 1000).toLocaleString(i18n.language, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span>
              <kbd>{ago(c.time, t)}</kbd>
            </button>
          ))}
          <label className="menu-toggle" title={t("file.autosaveFileHint")}>
            <input type="checkbox" checked={info.autosaveFile} onChange={(e) => void p.setAutosaveFile(e.target.checked)} />
            <span>{t("file.autosaveFile")}</span>
          </label>
          <p className="menu-note">{info.autosaveFile && !info.path ? t("file.autosaveFileNeedsPath") : t("file.autosaveNote")}</p>
        </div>
      )}
    </Popover>
  );
}

/** «hace 4 min», «hace 2 h»… */
function ago(seconds: number, t: TFunction): string {
  const min = Math.max(0, Math.round((Date.now() / 1000 - seconds) / 60));
  if (min < 1) return t("file.agoNow");
  if (min < 60) return t("file.agoMin", { n: min });
  if (min < 60 * 24) return t("file.agoHours", { n: Math.round(min / 60) });
  return t("file.agoDays", { n: Math.round(min / 60 / 24) });
}

/** Carpeta del archivo, abreviada: solo el último nivel. */
function folderOf(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts.length > 1 ? parts[parts.length - 2] : "";
}
