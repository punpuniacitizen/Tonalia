import { useEffect, useState } from "react";

import { api } from "../../api";
import type { Chord } from "../../bindings/Chord";
import type { ChordView } from "../../bindings/ChordView";
import type { Key } from "../../bindings/Key";
import type { TensionView } from "../../bindings/TensionView";
import { useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";

/** Tensiones de un acorde (se piden a Rust cuando cambia el acorde o la tonalidad). */
export function useTensions(chord: Chord | null, key: Key | null, enabled: boolean): TensionView[] {
  const [tensions, setTensions] = useState<TensionView[]>([]);
  const id = JSON.stringify([chord, key]);
  useEffect(() => {
    if (!enabled || !chord || !key) {
      setTensions([]);
      return;
    }
    let alive = true;
    void api.tensions(chord, key).then((t) => alive && setTensions(t));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, enabled]);
  return tensions;
}

/** Se muestran las de la tonalidad y las que el acorde ya tiene. */
export const visibleTensions = (ts: TensionView[]) => ts.filter((t) => t.inKey || t.present);

/** Aplica una tensión (añadir o quitar) a un acorde de la canción y lo selecciona. */
export function applyTension(target: ChordView, t: TensionView) {
  const at = { section: target.section, index: target.index };
  void useSong
    .getState()
    .edit({ type: "replaceChord", at, chord: t.chord })
    .then((v) => v && useUi.getState().select(at));
}

export const tensionLabel = (token: string) => token.replace("b", "♭").replace("#", "♯");
