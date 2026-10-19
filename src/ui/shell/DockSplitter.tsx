// Divisor entre la línea de tiempo y el muelle: arrastrar reparte el alto (se recuerda);
// doble clic vuelve al reparto automático.

import { useTranslation } from "react-i18next";

import { useUi } from "../../stores/ui";

const MIN_DOCK = 300;
const MIN_TIMELINE = 140;

export function DockSplitter() {
  const { t } = useTranslation();
  const set = useUi((s) => s.set);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const stage = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!stage) return;
    const move = (ev: PointerEvent) => {
      const height = Math.round(stage.bottom - ev.clientY);
      set({ dockHeight: Math.min(Math.max(height, MIN_DOCK), stage.height - MIN_TIMELINE) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      document.body.classList.remove("is-resizing-dock");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    document.body.classList.add("is-resizing-dock");
  };

  return (
    <div
      className="dock-splitter"
      role="separator"
      aria-orientation="horizontal"
      title={t("dock.splitterHint")}
      onPointerDown={onPointerDown}
      onDoubleClick={() => set({ dockHeight: null })}
    >
      <span />
    </div>
  );
}
