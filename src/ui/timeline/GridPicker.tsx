// Selector de cuadrícula: en cuántas partes se divide cada compás (binarias y ternarias)
// o «libre». Ajusta notas, acordes y la región de bucle, y se ve como líneas en la línea de
// tiempo y el piano roll. Alt al editar notas la ignora momentáneamente.

import { useTranslation } from "react-i18next";

import { useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";
import { Popover } from "../common/Popover";

const BINARY = [1, 2, 4, 8, 16, 32];
const TERNARY = [3, 6, 12, 24];

export function GridPicker() {
  const { t } = useTranslation();
  const divisions = useUi((s) => s.gridDivisions);
  const set = useUi((s) => s.set);
  const label = (d: number) => (d === 0 ? t("grid.free") : d === 1 ? t("grid.bar") : `1/${d}`);

  const chip = (d: number, close: () => void) => (
    <button
      key={d}
      className={`grid-chip ${d === divisions ? "is-active" : ""}`}
      onClick={() => {
        set({ gridDivisions: d });
        close();
      }}
    >
      {label(d)}
    </button>
  );

  return (
    <Popover
      className="grid-picker"
      trigger={(open, toggle) => (
        <button className={`ghost-button small ${open ? "is-on" : ""}`} onClick={toggle} title={t("grid.hint")}>
          <Icon name="grid" size={13} /> {label(divisions)}
        </button>
      )}
    >
      {(close) => (
        <div className="grid-panel">
          <h4>{t("grid.title")}</h4>
          {(
            [
              ["binary", BINARY],
              ["ternary", TERNARY],
              ["none", [0]],
            ] as const
          ).map(([group, list]) => (
            <div key={group} className="grid-group">
              <span>{t(`grid.${group}`)}</span>
              <div className="grid-chips">{list.map((d) => chip(d, close))}</div>
            </div>
          ))}
          <p>{t("grid.altHint")}</p>
        </div>
      )}
    </Popover>
  );
}
