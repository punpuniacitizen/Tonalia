import { useEffect, useRef, useState, type ReactNode } from "react";

/** Botón que abre una tarjeta flotante; se cierra al hacer clic fuera o con Escape. */
export function Popover({
  trigger,
  children,
  align = "left",
  className = "",
}: {
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="popover-anchor" ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div className={`popover glass ${className}`} style={align === "right" ? { right: 0 } : { left: 0 }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
