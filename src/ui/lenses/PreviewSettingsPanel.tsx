import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { ChordSize } from "../../bindings/ChordSize";
import type { VoicingStyle } from "../../bindings/VoicingStyle";
import { useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";
import { Segmented } from "../common/Segmented";
import "./lenses.css";

/** Instrumentos sampleados o sintetizador FM. */
function SoundEngineSwitch() {
  const { t } = useTranslation();
  const [engine, setEngine] = useState<{ sampledAvailable: boolean; sampled: boolean } | null>(null);
  useEffect(() => {
    void api.soundEngine().then(setEngine);
  }, []);
  if (!engine) return null;
  return (
    <label className="setting" title={t("engine.hint")}>
      <span>{t("engine.title")}</span>
      {engine.sampledAvailable ? (
        <Segmented<"sampled" | "synth">
          label={t("engine.title")}
          value={engine.sampled ? "sampled" : "synth"}
          onChange={(v) => {
            void api.setSoundEngine(v === "sampled");
            setEngine({ ...engine, sampled: v === "sampled" });
          }}
          options={[
            { value: "sampled", label: t("engine.sampled") },
            { value: "synth", label: t("engine.synth") },
          ]}
        />
      ) : (
        <small>{t("engine.loading")}</small>
      )}
    </label>
  );
}

// Rasgueo en ticks: ninguno, 1/64, 1/32, 1/16, 1/8.
const STRUMS = [0, 162, 324, 648, 1296];
const STRUM_LABELS = ["—", "1/64", "1/32", "1/16", "1/8"];

/** Cómo suenan los acordes al previsualizarlos y al insertarlos (octava, rasgueo, intensidad). */
export function PreviewSettingsPanel() {
  const { t } = useTranslation();
  const view = useSong((s) => s.view);
  const edit = useSong((s) => s.edit);
  const chordSize = useUi((s) => s.chordSize);
  const setUi = useUi((s) => s.set);
  if (!view) return null;
  const p = view.song.preview;
  const update = (patch: Partial<typeof p>) => edit({ type: "setPreviewSettings", settings: { ...p, ...patch } });

  return (
    <div className="settings-panel">
      <h3>{t("preview.title")}</h3>

      <SoundEngineSwitch />

      <label className="setting">
        <span>{t("preview.size")}</span>
        <Segmented<ChordSize>
          label={t("preview.size")}
          value={chordSize}
          onChange={(v) => setUi({ chordSize: v })}
          options={[
            { value: "triads", label: t("preview.triads") },
            { value: "sevenths", label: t("preview.sevenths") },
            { value: "ninths", label: t("preview.ninths"), title: t("preview.ninthsHint") },
            { value: "elevenths", label: t("preview.elevenths"), title: t("preview.ninthsHint") },
          ]}
        />
      </label>

      <label className="setting" title={t("preview.voicingHint")}>
        <span>{t("preview.voicing")}</span>
        <Segmented<VoicingStyle>
          label={t("preview.voicing")}
          value={p.style}
          onChange={(style) => update({ style })}
          options={[
            { value: "auto", label: t("preview.voicingAuto") },
            { value: "closed", label: t("preview.voicingClosed") },
            { value: "open", label: t("preview.voicingOpen") },
          ]}
        />
        <small>{t("preview.voicingHint")}</small>
      </label>

      <label className="setting">
        <span>{t("preview.octave")}</span>
        <div className="stepper">
          <button onClick={() => update({ octave: Math.max(1, p.octave - 1) })}>−</button>
          <output>{p.octave}</output>
          <button onClick={() => update({ octave: Math.min(6, p.octave + 1) })}>+</button>
        </div>
      </label>

      <label className="setting">
        <span>{t("preview.strumming")}</span>
        <div className="strums">
          {STRUMS.map((s, i) => (
            <button key={s} className={p.strumming === s ? "is-active" : ""} onClick={() => update({ strumming: s })}>
              {i === 0 ? t("preview.none") : STRUM_LABELS[i]}
            </button>
          ))}
        </div>
      </label>

      <label className="setting">
        <span>
          {t("preview.velocity")} <output>{Math.round(p.velocity * 100)}%</output>
        </span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          defaultValue={p.velocity}
          onPointerUp={(e) => update({ velocity: Number((e.target as HTMLInputElement).value) })}
          onKeyUp={(e) => update({ velocity: Number((e.target as HTMLInputElement).value) })}
        />
      </label>
    </div>
  );
}
