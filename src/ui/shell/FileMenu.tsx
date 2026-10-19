import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useProject } from "../../stores/project";
import { Icon, type IconName } from "../common/Icon";
import { Popover } from "../common/Popover";

/** Menú Archivo: nuevo, abrir, guardar, guardar como y exportar MIDI. */
export function FileMenu() {
  const { t } = useTranslation();
  const info = useProject((s) => s.info);
  const p = useProject();

  useEffect(() => {
    void useProject.getState().refresh();
  }, []);

  const items: { icon: IconName; label: string; keys: string; run: () => unknown }[] = [
    { icon: "file", label: t("file.new"), keys: "Ctrl+N", run: p.newProject },
    { icon: "folder", label: t("file.open"), keys: "Ctrl+O", run: p.openProject },
    { icon: "save", label: t("file.save"), keys: "Ctrl+S", run: p.saveProject },
    { icon: "save", label: t("file.saveAs"), keys: "Ctrl+Mayús+S", run: p.saveProjectAs },
    { icon: "download", label: t("file.exportMidi"), keys: "Ctrl+E", run: p.exportMidi },
  ];

  return (
    <Popover
      className="file-menu"
      trigger={(open, toggle) => (
        <button className={`file-button ${open ? "is-open" : ""}`} onClick={toggle} title={info.path ?? t("file.untitled")}>
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
          <p className="menu-note">{t("file.autosaveNote")}</p>
        </div>
      )}
    </Popover>
  );
}
