import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { isMinorLike, keyName, keyRootName, SCALE_CHOICES, scaleSteps } from "../../lib/music";
import { useSong } from "../../stores/song";
import { useTransport } from "../../stores/transport";
import { useUi, type Language, type Level, type SymbolMode } from "../../stores/ui";
import type { Notation } from "../../bindings/Notation";
import { Icon } from "../common/Icon";
import { Popover } from "../common/Popover";
import { Segmented } from "../common/Segmented";
import { PreviewSettingsPanel } from "../lenses/PreviewSettingsPanel";
import { FileMenu } from "./FileMenu";
import "./Header.css";

export function Header() {
  const { t } = useTranslation();
  const view = useSong((s) => s.view);
  const { edit, undo, redo } = useSong();
  const ui = useUi();
  const playing = useTransport((s) => s.playing);
  const { toggle, rewind } = useTransport();

  if (!view) return <header className="header" />;
  const song = view.song;

  return (
    <header className="header">
      <div className="brand">
        <span className="brand-orb" aria-hidden="true" />
        <span className="brand-name">Tonalia</span>
        <span className="brand-tagline">{t("app.tagline")}</span>
      </div>

      <FileMenu />

      <div className="transport">
        <button className="icon-button" title={t("transport.rewind")} onClick={rewind}>
          <Icon name="rewind" />
        </button>
        <button className={`play-button ${playing ? "is-playing" : ""}`} title={playing ? t("transport.stop") : t("transport.play")} onClick={toggle}>
          <Icon name={playing ? "stop" : "play"} size={20} filled />
        </button>
        <button
          className={`icon-button ${song.looping ? "is-on" : ""}`}
          title={t("transport.loop")}
          aria-pressed={song.looping}
          onClick={() => edit({ type: "setLooping", looping: !song.looping })}
        >
          <Icon name="loop" />
        </button>
        <BpmControl bpm={song.bpm} onCommit={(bpm) => edit({ type: "setBpm", bpm })} />
      </div>

      <KeyPill />

      <div className="header-spacer" />

      <div className="view-switches">
        <Segmented<Notation>
          label={t("view.notation")}
          value={ui.notation}
          onChange={(notation) => ui.set({ notation })}
          options={[
            { value: "letters", label: t("view.letters") },
            { value: "solfege", label: t("view.solfege") },
          ]}
        />
        <Segmented<SymbolMode>
          label={t("view.symbols")}
          value={ui.symbols}
          onChange={(symbols) => ui.set({ symbols })}
          options={[
            { value: "names", label: t("view.names") },
            { value: "roman", label: t("view.roman") },
          ]}
        />
        <Popover
          align="right"
          trigger={(open, toggleOpen) => (
            <button className={`view-button ${open ? "is-open" : ""}`} onClick={toggleOpen} title={t("view.title")}>
              {t(`view.${ui.level}`)} · {ui.language.toUpperCase()}
              <Icon name="chevronDown" size={14} />
            </button>
          )}
        >
          {() => (
            <div className="settings-panel">
              <label className="setting">
                <span>{t("view.level")}</span>
                <Segmented<Level>
                  label={t("view.level")}
                  value={ui.level}
                  onChange={(level) => ui.set({ level })}
                  options={[
                    { value: "beginner", label: t("view.beginner") },
                    { value: "intermediate", label: t("view.intermediate") },
                    { value: "advanced", label: t("view.advanced") },
                  ]}
                />
                <small>{t(`view.${ui.level}Hint`)}</small>
              </label>
              <label className="setting">
                <span>{t("view.language")}</span>
                <Segmented<Language>
                  label={t("view.language")}
                  value={ui.language}
                  onChange={(language) => ui.set({ language })}
                  options={[
                    { value: "es", label: "Español" },
                    { value: "en", label: "English" },
                  ]}
                />
              </label>
            </div>
          )}
        </Popover>
      </div>

      <div className="learn-buttons">
        <button
          className={`learn-button ${ui.panel === "library" ? "is-on" : ""}`}
          onClick={() => ui.set({ panel: ui.panel === "library" ? null : "library" })}
          title={t("library.title")}
        >
          <Icon name="book" size={16} /> <span className="learn-button-label">{t("library.short")}</span>
        </button>
        <button
          className={`learn-button ${ui.panel === "training" ? "is-on" : ""}`}
          onClick={() => ui.set({ panel: ui.panel === "training" ? null : "training" })}
          title={t("training.title")}
        >
          <Icon name="ear" size={16} /> <span className="learn-button-label">{t("training.short")}</span>
        </button>
      </div>

      <div className="history">
        <button className="icon-button" title={`${t("edit.undo")} (Ctrl+Z)`} disabled={!view.canUndo} onClick={undo}>
          <Icon name="undo" />
        </button>
        <button className="icon-button" title={`${t("edit.redo")} (Ctrl+Y)`} disabled={!view.canRedo} onClick={redo}>
          <Icon name="redo" />
        </button>
        <Popover
          align="right"
          trigger={(open, toggleOpen) => (
            <button className={`icon-button ${open ? "is-on" : ""}`} title={t("preview.title")} onClick={toggleOpen}>
              <Icon name="wave" />
            </button>
          )}
        >
          {() => <PreviewSettingsPanel />}
        </Popover>
      </div>
    </header>
  );
}

/** Número de BPM que se cambia arrastrando arriba/abajo o con la rueda del ratón. */
function BpmControl({ bpm, onCommit }: { bpm: number; onCommit: (bpm: number) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<number | null>(null);
  const wheelTimer = useRef<number | undefined>(undefined);
  const shown = Math.round(draft ?? bpm);

  const onPointerDown = (e: React.PointerEvent) => {
    const startY = e.clientY;
    const start = bpm;
    let value = start;
    const move = (ev: PointerEvent) => {
      value = Math.min(400, Math.max(20, Math.round(start + (startY - ev.clientY) / 2)));
      setDraft(value);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDraft(null);
      if (value !== start) onCommit(value);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onWheel = (e: React.WheelEvent) => {
    const value = Math.min(400, Math.max(20, (draft ?? bpm) + (e.deltaY < 0 ? 1 : -1)));
    setDraft(value);
    window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(() => {
      setDraft(null);
      onCommit(value);
    }, 350);
  };

  return (
    <div className="bpm" title={t("transport.bpmHint")} onPointerDown={onPointerDown} onWheel={onWheel}>
      <span className="bpm-value">{shown}</span>
      <span className="bpm-label">{t("transport.bpm")}</span>
    </div>
  );
}

/** Píldora con la tonalidad de la canción; abre un selector de tónica y escala. */
function KeyPill() {
  const { t } = useTranslation();
  const view = useSong((s) => s.view);
  const edit = useSong((s) => s.edit);
  const notation = useUi((s) => s.notation);
  if (!view) return null;
  const key = view.song.homeKey;
  const scaleLabel = (name: string) => t(`scale.${name}`);

  const setKey = (root: number, scale: string) =>
    edit({ type: "setHomeKey", key: { root, scale: { name: scale, steps: scaleSteps(scale) } } });

  return (
    <Popover
      className="key-popover"
      trigger={(open, toggle) => (
        <button className={`key-pill ${open ? "is-open" : ""}`} onClick={toggle} title={t("key.home")} data-tip={`mode.${key.scale.name}`}>
          <span className="key-pill-label">{t("key.title")}</span>
          <span className="key-pill-name">{keyName(key, notation, scaleLabel)}</span>
          <Icon name="chevronDown" size={14} />
        </button>
      )}
    >
      {() => (
        <div className="key-picker">
          <div className="key-roots">
            {Array.from({ length: 12 }, (_, pc) => (
              <button key={pc} className={pc === key.root ? "is-active" : ""} onClick={() => setKey(pc, key.scale.name)}>
                {keyRootName(pc, key.scale.name, notation)}
                {isMinorLike(key.scale.name) ? "m" : ""}
              </button>
            ))}
          </div>
          <div className="key-scales">
            {SCALE_CHOICES.map((s) => (
              <button key={s} data-tip={`mode.${s}`} className={s === key.scale.name ? "is-active" : ""} onClick={() => setKey(key.root, s)}>
                {scaleLabel(s)}
              </button>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}
