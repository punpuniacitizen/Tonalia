import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const MARGIN = 8;

/**
 * Botón que abre una tarjeta flotante; se cierra al hacer clic fuera o con Escape.
 * Con `floating`, la tarjeta va por encima de todo (fuera de la zona con scroll): se abre
 * debajo del botón o, si no entra, encima.
 */
export function Popover({
  trigger,
  children,
  align = "left",
  className = "",
  floating = false,
}: {
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  className?: string;
  floating?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Flotante: junto al botón, sin salirse de la ventana.
  useLayoutEffect(() => {
    const el = popRef.current;
    const anchor = ref.current?.getBoundingClientRect();
    if (!open || !floating || !el || !anchor) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const below = anchor.bottom + 10;
    const top = below + h <= innerHeight - MARGIN ? below : Math.max(MARGIN, anchor.top - 10 - h);
    const left = Math.min(Math.max(MARGIN, align === "right" ? anchor.right - w : anchor.left), innerWidth - w - MARGIN);
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  });

  const close = () => setOpen(false);
  return (
    <div className="popover-anchor" ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open &&
        (floating ? (
          createPortal(
            <div ref={popRef} className={`popover glass is-floating ${className}`}>
              {children(close)}
            </div>,
            document.body,
          )
        ) : (
          <div ref={popRef} className={`popover glass ${className}`} style={align === "right" ? { right: 0 } : { left: 0 }}>
            {children(close)}
          </div>
        ))}
    </div>
  );
}
