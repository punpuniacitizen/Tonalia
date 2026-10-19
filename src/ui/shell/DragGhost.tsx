import { chordSymbol, functionColor } from "../../lib/music";
import { useDrag } from "../../stores/drag";
import { useUi } from "../../stores/ui";

/** El acorde que se está arrastrando, siguiendo al puntero. */
export function DragGhost() {
  const payload = useDrag((s) => s.payload);
  const x = useDrag((s) => s.x);
  const y = useDrag((s) => s.y);
  const notation = useUi((s) => s.notation);
  if (!payload) return null;
  return (
    <div className="drag-ghost" style={{ left: x, top: y, ["--fn" as string]: functionColor(payload.label.function) }}>
      {chordSymbol(payload.label, notation)}
    </div>
  );
}
