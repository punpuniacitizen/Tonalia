// Pastilla "MIDI" que se arrastra fuera de la app (a un DAW o a una carpeta).
// Al pasar el ratón se prepara el archivo; al arrastrar, el sistema operativo lo lleva.

import { Channel, invoke } from "@tauri-apps/api/core";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "../common/Icon";

/** Imagen que acompaña al cursor durante el arrastre. */
function dragImage(): string {
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 40;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#4de1c1";
    g.beginPath();
    g.roundRect(2, 2, 92, 36, 10);
    g.fill();
    g.fillStyle = "#04050a";
    g.font = "bold 16px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("MIDI ♪", 48, 21);
  }
  return c.toDataURL("image/png");
}

export function MidiDragChip() {
  const { t } = useTranslation();
  const path = useRef<string | null>(null);
  const [state, setState] = useState<"idle" | "ready" | "done" | "error">("idle");

  const prepare = async () => {
    try {
      path.current = await invoke<string>("prepare_midi_drag");
      setState("ready");
    } catch {
      setState("error");
    }
  };

  const onPointerDown = async (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (!path.current) await prepare();
    if (!path.current) return;
    const onEvent = new Channel<{ result: string }>();
    onEvent.onmessage = (msg) => setState(msg.result === "Dropped" ? "done" : "ready");
    try {
      await invoke("plugin:drag|start_drag", { item: [path.current], image: dragImage(), onEvent });
    } catch {
      setState("error");
    }
  };

  return (
    <button
      className={`midi-chip is-${state}`}
      onPointerEnter={() => void prepare()}
      onPointerDown={(e) => void onPointerDown(e)}
      title={t("file.dragMidi")}
    >
      <Icon name="download" size={14} /> MIDI
    </button>
  );
}
