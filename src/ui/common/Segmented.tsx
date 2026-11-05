import { Icon, type IconName } from "./Icon";
import "./common.css";

/**
 * Grupo de botones donde solo uno está activo (como un interruptor de varias posiciones).
 * Una opción con `icon` muestra solo el ícono; su nombre (y su `title`) quedan en el tooltip.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; title?: string; icon?: IconName }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label} title={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.icon ? o.label : undefined}
          className={`${o.value === value ? "is-active" : ""} ${o.icon ? "has-icon" : ""}`}
          title={o.icon ? (o.title ? `${o.label} — ${o.title}` : o.label) : o.title}
          onClick={() => onChange(o.value)}
        >
          {o.icon ? <Icon name={o.icon} size={15} /> : o.label}
        </button>
      ))}
    </div>
  );
}
