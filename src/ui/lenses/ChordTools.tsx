// Ventana flotante del acorde seleccionado con tres pestañas: Extensiones (constructor),
// Voces (voicing a mano) y Ritmo (duración y silencio antes). Se abre desde la lente o con doble clic sobre un bloque de la
// cinta (en ese caso aparece al lado del acorde). Se cierra con Esc o tocando fuera.

import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { chordSymbol, functionColor } from "../../lib/music";
import { useSelectedChord } from "../../stores/song";
import { useUi, type ChordToolsTab } from "../../stores/ui";
import { Icon } from "../common/Icon";
import { Segmented } from "../common/Segmented";
import { ChordBuilder } from "./ChordBuilder";
import { RhythmPanel } from "./RhythmPanel";
import { VoicingEditor } from "./VoicingEditor";
import "./lenses.css";

const MARGIN = 12;

export function ChordTools() {
  const { t } = useTranslation();
  const tools = useUi((s) => s.chordTools);
  const notation = useUi((s) => s.notation);
  const set = useUi((s) => s.set);
  const chord = useSelectedChord();
  const ref = useRef<HTMLElement>(null);

  // Sin acorde seleccionado no hay nada que editar.
  useEffect(() => {
    if (tools && !chord) set({ chordTools: null });
  }, [tools, chord, set]);

  useEffect(() => {
    if (!tools) return;
    const close = () => set({ chordTools: null });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    // Tocar fuera cierra; los botones de la lente que la abren se encargan solos (alternan).
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (ref.current?.contains(target) || target.closest(".lens-tools")) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [tools, set]);

  // Junto al acorde: a su derecha (o a su izquierda si no cabe), sin salirse de la ventana.
  useLayoutEffect(() => {
    const el = ref.current;
    const anchor = tools?.anchor;
    if (!el || !anchor) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = anchor.right + MARGIN + w <= innerWidth - MARGIN ? anchor.right + MARGIN : Math.max(MARGIN, anchor.left - MARGIN - w);
    el.style.left = `${left}px`;
    el.style.top = `${Math.min(Math.max(MARGIN, anchor.top), innerHeight - h - MARGIN)}px`;
    el.style.bottom = "auto";
  });

  if (!tools || !chord) return null;
  const setTab = (tab: ChordToolsTab) => set({ chordTools: { ...tools, tab } });

  return createPortal(
    <section
      ref={ref}
      className="builder-float chord-tools glass"
      style={{ ["--lens-color" as string]: functionColor(chord.label.function) }}
      role="dialog"
      aria-label={chordSymbol(chord.label, notation)}
    >
      <header className="builder-float-head">
        <strong className="chord-tools-symbol">{chordSymbol(chord.label, notation)}</strong>
        <Segmented<ChordToolsTab>
          label={t("voicing.tools")}
          value={tools.tab}
          onChange={setTab}
          options={[
            { value: "extensions", label: t("builder.short"), title: t("builder.title") },
            { value: "voices", label: t("voicing.title"), title: t("voicing.hint") },
            { value: "rhythm", label: t("rhythm.title"), title: t("rhythm.hint") },
          ]}
        />
        <button className="icon-button" onClick={() => set({ chordTools: null })} title={t("tips.close")}>
          <Icon name="plus" size={16} />
        </button>
      </header>
      {tools.tab === "extensions" ? <ChordBuilder chord={chord} /> : tools.tab === "voices" ? <VoicingEditor chord={chord} /> : <RhythmPanel chord={chord} />}
    </section>,
    document.body,
  );
}
