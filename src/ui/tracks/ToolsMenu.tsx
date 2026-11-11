// Menú de herramientas de una pista (la caja de herramientas de su cabecera). Se abre con un
// clic: muestra las herramientas y, al elegir una, su panel dentro de la misma tarjeta.
// Es aparte del selector Dibujar / Seleccionar / Intensidad porque estas herramientas no son
// modos del clic: actúan sobre lo elegido.

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useNotes } from "../../stores/notes";
import { useUi } from "../../stores/ui";
import { Icon, type IconName } from "../common/Icon";
import { Popover } from "../common/Popover";
import { ArpPanel } from "./ArpTool";
import { NotesToChordPanel } from "./NotesToChordPanel";
import { ArticulationPanel, BassPanel, HumanizePanel, QuantizePanel, RepeatPanel, ScaleSnapPanel, TransposePanel } from "./NoteTools";
import { OctavePanel } from "./OctaveTool";
import { RhythmPatternPanel } from "./RhythmTool";
import { ConvertPanel } from "./ConvertTool";
import type { ToolsTarget } from "./toolScope";


type ToolId = "arp" | "rhythm" | "octave" | "repeat" | "convert" | "transpose" | "quantize" | "humanize" | "articulation" | "snap" | "bass" | "toChord";

export function ToolsMenu({ target }: { target: ToolsTarget }) {
  const { t } = useTranslation();
  return (
    <Popover
      className="tools-menu"
      floating
      trigger={(open, toggle) => (
        <button className={`head-icon ${open ? "is-on" : ""}`} onClick={toggle} title={t("tools.title")} aria-label={t("tools.title")}>
          <Icon name="wrench" size={16} />
        </button>
      )}
    >
      {(close) => <ToolsPanel target={target} close={close} />}
    </Popover>
  );
}

function ToolsPanel({ target, close }: { target: ToolsTarget; close: () => void }) {
  const { t } = useTranslation();
  const [tool, setTool] = useState<ToolId | null>(null);
  const selection = useNotes((s) => (target.kind === "notes" && s.selectionTrack === target.track.id ? s.selection : null));
  const noteCount = selection?.size ?? 0;

  const tools: { id: ToolId; icon: IconName; name: string; hint: string; disabled?: string }[] = [
    { id: "arp", icon: "arp", name: t("arp.tool"), hint: target.kind === "chords" ? t("arp.toolHint") : t("arp.toolHintNotes") },
  ];
  if (target.kind === "chords") {
    tools.push(
      { id: "rhythm", icon: "drum", name: t("tools.rhythm"), hint: t("tools.rhythmHint") },
      { id: "octave", icon: "updown", name: t("tools.octave"), hint: t("tools.octaveHint") },
      { id: "convert", icon: "notes", name: t("tools.convert"), hint: t("tools.convertHint") },
    );
  }
  if (target.kind === "notes") {
    tools.push(
      { id: "transpose", icon: "updown", name: t("tools.transpose"), hint: t("tools.transposeHint") },
      { id: "quantize", icon: "magnet", name: t("tools.quantize"), hint: t("tools.quantizeHint") },
      { id: "humanize", icon: "dice", name: t("tools.humanize"), hint: t("tools.humanizeHint") },
      { id: "repeat", icon: "repeat", name: t("tools.repeat"), hint: t("tools.repeatHint") },
      { id: "articulation", icon: "legato", name: t("tools.articulation"), hint: t("tools.articulationHint") },
      { id: "snap", icon: "target", name: t("tools.snap"), hint: t("tools.snapHint") },
      { id: "bass", icon: "bassClef", name: t("tools.bass"), hint: t("tools.bassHint") },
    );
    tools.push({
      id: "toChord",
      icon: "sparkle",
      name: t("piano.toChord"),
      hint: t("piano.toChordHint"),
      disabled: noteCount < 2 ? t("piano.toChordNeeds") : undefined,
    });
  }
  const current = tools.find((x) => x.id === tool);
  // En nivel avanzado, lista compacta: solo el nombre (la descripción queda en el tooltip).
  const compact = useUi.getState().level === "advanced";

  if (!current) {
    return (
      <div className={`tools-list ${compact ? "is-compact" : ""}`}>
        <h4>{t("tools.title")}</h4>
        {tools.map((x) => (
          <button key={x.id} className="tools-item" disabled={!!x.disabled} onClick={() => setTool(x.id)} title={compact ? (x.disabled ?? x.hint) : undefined}>
            <Icon name={x.icon} size={compact ? 15 : 17} />
            <span>
              <strong>{x.name}</strong>
              {!compact && <small>{x.disabled ?? x.hint}</small>}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="tools-open">
      <header className="tools-open-head">
        <button className="head-icon" onClick={() => setTool(null)} title={t("tools.back")} aria-label={t("tools.back")}>
          <Icon name="chevronLeft" size={15} />
        </button>
        <Icon name={current.icon} size={15} />
        <h4>{current.name}</h4>
      </header>
      {current.id === "arp" && <ArpPanel target={target} close={close} />}
      {current.id === "rhythm" && target.kind === "chords" && <RhythmPatternPanel lane={target.lane} close={close} />}
      {current.id === "convert" && target.kind === "chords" && <ConvertPanel lane={target.lane} close={close} />}
      {current.id === "octave" && target.kind === "chords" && <OctavePanel lane={target.lane} />}
      {current.id === "repeat" && target.kind === "notes" && <RepeatPanel track={target.track} close={close} />}
      {current.id === "transpose" && target.kind === "notes" && <TransposePanel track={target.track} close={close} />}
      {current.id === "quantize" && target.kind === "notes" && <QuantizePanel track={target.track} close={close} />}
      {current.id === "humanize" && target.kind === "notes" && <HumanizePanel track={target.track} close={close} />}
      {current.id === "articulation" && target.kind === "notes" && <ArticulationPanel track={target.track} close={close} />}
      {current.id === "snap" && target.kind === "notes" && <ScaleSnapPanel track={target.track} close={close} />}
      {current.id === "bass" && target.kind === "notes" && <BassPanel track={target.track} close={close} />}
      {current.id === "toChord" && target.kind === "notes" && selection && <NotesToChordPanel track={target.track} keys={selection} close={close} />}
    </div>
  );
}
