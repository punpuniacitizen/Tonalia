import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { SongView } from "../../bindings/SongView";
import { keyRootName, SCALE_CHOICES, scaleSteps } from "../../lib/music";
import { useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";

const COLORS = ["#5B8CFF", "#B26BFF", "#FF6BB5", "#FFB547", "#4DE1C1", "#7CE36B", "#FF7A5C", "#5CD6FF"];

/** Siguiente nombre libre: A, B, C… */
export function nextSectionName(view: SongView): string {
  const used = new Set(view.sections.map((s) => s.name));
  for (let i = 0; i < 26; i++) {
    const name = String.fromCharCode(65 + i);
    if (!used.has(name)) return name;
  }
  return `S${view.sections.length + 1}`;
}

/** Tarjeta flotante para editar una sección (se abre al hacer clic en su etiqueta). */
export function SectionEditor({ id, x, y, onClose }: { id: number; x: number; y: number; onClose: () => void }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view) as SongView;
  const edit = useSong((s) => s.edit);
  const notation = useUi((s) => s.notation);
  const ref = useRef<HTMLDivElement>(null);
  const section = view.sections.find((s) => s.id === id);

  useEffect(() => {
    const onDown = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!section) return null;
  const siblings = view.sections.filter((s) => s.parent === section.parent);
  const indexInParent = siblings.findIndex((s) => s.id === id);
  const ownKey = section.hasOwnKey ? section.key : null;
  const rename = (name: string) => name.trim() && name !== section.name && edit({ type: "updateSection", section: id, name: name.trim(), color: null });
  const setKey = (root: number | null, scale: string) =>
    edit({ type: "setSectionKey", section: id, key: root === null ? null : { root, scale: { name: scale, steps: scaleSteps(scale) } } });

  const left = Math.min(x, window.innerWidth - 320);
  return (
    <div ref={ref} className="section-editor glass" style={{ left, top: y }}>
      <input
        className="section-name-input"
        defaultValue={section.name}
        aria-label={t("sections.name")}
        onBlur={(e) => rename(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <div className="swatches">
        {COLORS.map((c) => (
          <button
            key={c}
            className={c.toLowerCase() === section.color.toLowerCase() ? "is-active" : ""}
            style={{ background: c }}
            aria-label={c}
            onClick={() => edit({ type: "updateSection", section: id, name: null, color: c })}
          />
        ))}
      </div>

      <label className="setting" data-tip={`mode.${section.key.scale.name}`}>
        <span>{t("sections.key")}</span>
        <div className="key-row">
          <select
            value={ownKey ? ownKey.root : "inherit"}
            onChange={(e) => setKey(e.target.value === "inherit" ? null : Number(e.target.value), ownKey?.scale.name ?? section.key.scale.name)}
          >
            <option value="inherit">{t("sections.inherit")}</option>
            {Array.from({ length: 12 }, (_, pc) => (
              <option key={pc} value={pc}>
                {keyRootName(pc, ownKey?.scale.name ?? "major", notation)}
              </option>
            ))}
          </select>
          {ownKey && (
            <select value={ownKey.scale.name} onChange={(e) => setKey(ownKey.root, e.target.value)}>
              {SCALE_CHOICES.map((s) => (
                <option key={s} value={s}>
                  {t(`scale.${s}`)}
                </option>
              ))}
            </select>
          )}
        </div>
        <small>{t("sections.keyHint")}</small>
      </label>

      <div className="section-actions">
        <button onClick={() => edit({ type: "addSection", parent: section.parent, index: indexInParent + 1, name: nextSectionName(view) })}>
          <Icon name="plus" size={14} /> {t("sections.addAfter")}
        </button>
        <button onClick={() => edit({ type: "addSection", parent: id, index: 999, name: `${section.name}${t("sections.subSuffix")}` })}>
          <Icon name="plus" size={14} /> {t("sections.addSub")}
        </button>
        <button onClick={() => edit({ type: "wrapInSection", sections: [id], name: nextSectionName(view) })}>
          <Icon name="grid" size={14} /> {t("sections.wrap")}
        </button>
        <button
          className="danger"
          onClick={() => {
            void edit({ type: "removeSection", section: id });
            onClose();
          }}
        >
          <Icon name="trash" size={14} /> {t("sections.delete")}
        </button>
      </div>
    </div>
  );
}
