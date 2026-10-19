import type { TFunction } from "i18next";

import type { Reason } from "../bindings/Reason";

// Grados expresados en semitonos sobre la tónica → número romano (referencia mayor).
const DEGREE_ROMAN: Record<number, string> = {
  0: "I",
  1: "♭II",
  2: "ii",
  3: "♭III",
  4: "iii",
  5: "IV",
  6: "♯IV",
  7: "V",
  8: "♭VI",
  9: "vi",
  10: "♭VII",
  11: "vii°",
};

/** Explicación en palabras de por qué una transición suena como suena. */
export function reasonText(t: TFunction, reason: Reason): string {
  switch (reason.kind) {
    case "functionalPair":
      return t("reason.functionalPair", { from: DEGREE_ROMAN[reason.from], to: DEGREE_ROMAN[reason.to] });
    case "strongRootMotion":
      return t("reason.strongRootMotion", { interval: t(`intervals.${reason.semitones}`) });
    default:
      return t(`reason.${reason.kind}`);
  }
}
