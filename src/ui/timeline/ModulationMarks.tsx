// Puente de modulación: donde una sección cambia de tonalidad aparece una marca en la cinta
// («C → G · vecina»). Al tocarla se abre una ventana con tres caminos para llegar a la
// tonalidad nueva (pivote, dominante, directo), cada uno para escuchar e insertar. Mientras
// está abierta, los acordes pivote se resaltan en la rueda.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { api, chordsSequence } from "../../api";
import type { Chord } from "../../bindings/Chord";
import type { ChordLabel } from "../../bindings/ChordLabel";
import type { EditCommand } from "../../bindings/EditCommand";
import type { Key } from "../../bindings/Key";
import type { SectionView } from "../../bindings/SectionView";
import { bridgePlans, diatonicTriads, keyDistance, pivots, previewPitches, romanOf, sameKey, tonicOf, type BridgePlan } from "../../lib/modulation";
import { chordSymbol, keyRootName } from "../../lib/music";
import { pitchName } from "../../lib/pitch";
import { useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";
import { tickToX } from "./geometry";

type Boundary = { from: SectionView; to: SectionView };
const PANEL_W = 700;

export function ModulationMarks() {
  const { t } = useTranslation();
  const view = useSong((s) => s.view);
  const pxPerBar = useUi((s) => s.pxPerBar);
  const notation = useUi((s) => s.notation);
  const [open, setOpen] = useState<{ index: number; rect: DOMRect } | null>(null);
  if (!view) return null;

  const leaves = view.sections.filter((s) => s.isLeaf).sort((a, b) => a.start - b.start);
  const boundaries: Boundary[] = leaves.slice(1).flatMap((to, i) => (sameKey(leaves[i].key, to.key) ? [] : [{ from: leaves[i], to }]));
  const keyLabel = (k: Key) => keyRootName(k.root, k.scale.name, notation) + (k.scale.name === "minor" || k.scale.name === "aeolian" ? "m" : "");

  return (
    <>
      {boundaries.map((b, i) => {
        const x = tickToX(b.to.start, pxPerBar);
        const { kind } = keyDistance(b.from.key, b.to.key);
        return (
          <div key={b.to.id} className="mod-mark" style={{ left: x }}>
            <span className="mod-line" aria-hidden="true" />
            <button
              className={`mod-chip is-${kind} ${open?.index === i ? "is-open" : ""}`}
              title={t("modulation.markHint")}
              onClick={(e) => setOpen(open?.index === i ? null : { index: i, rect: e.currentTarget.getBoundingClientRect() })}
            >
              {keyLabel(b.from.key)} → {keyLabel(b.to.key)} · {t(`modulation.distance.${kind}`)}
            </button>
          </div>
        );
      })}
      {open && boundaries[open.index] && <BridgePanel boundary={boundaries[open.index]} anchor={open.rect} onClose={() => setOpen(null)} keyLabel={keyLabel} />}
    </>
  );
}

function BridgePanel({ boundary, anchor, onClose, keyLabel }: { boundary: Boundary; anchor: DOMRect; onClose: () => void; keyLabel: (k: Key) => string }) {
  const { t } = useTranslation();
  const view = useSong((s) => s.view)!;
  const edit = useSong((s) => s.edit);
  const notation = useUi((s) => s.notation);
  const scaleName = (k: Key) => t(`scale.${k.scale.name}`);
  const setUi = useUi((s) => s.set);
  const dockView = useUi((s) => s.dockView);
  const ref = useRef<HTMLElement>(null);
  const { from, to } = boundary;
  const plans = bridgePlans(from.key, to.key);
  const distance = keyDistance(from.key, to.key);
  const [labels, setLabels] = useState<Map<string, ChordLabel>>(new Map());

  // Nombres bien escritos: el pivote en la tonalidad de partida, el resto en la nueva.
  const id = (c: Chord, k: Key) => `${JSON.stringify(c)}@${JSON.stringify(k)}`;
  useEffect(() => {
    let alive = true;
    const wanted: [Chord, Key][] = [...pivots(from.key, to.key).map((p) => [p.chord, from.key] as [Chord, Key]), ...plans.flatMap((p) => p.chords.map((c) => [c, to.key] as [Chord, Key])), [tonicOf(to.key), to.key]];
    void Promise.all(wanted.map(([c, k]) => api.describeChord(c, k).then((l) => [id(c, k), l] as const))).then((pairs) => alive && setLabels(new Map(pairs)));
    // Mientras la ventana está abierta, la rueda resalta los acordes pivote.
    setUi({ pivotChords: pivots(from.key, to.key).map((p) => p.chord) });
    return () => {
      alive = false;
      setUi({ pivotChords: null });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(from.key), JSON.stringify(to.key)]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (!ref.current?.contains(target) && !target.closest(".mod-chip")) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  // Debajo de la marca y sin tapar el muelle (ahí se resaltan los pivotes en la rueda).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const top = anchor.bottom + 8;
    const dock = document.querySelector(".dock-wrap")?.getBoundingClientRect();
    const floor = dock && dock.height > 0 && dock.top - top > 260 ? dock.top - 8 : innerHeight - 12;
    el.style.left = `${Math.min(Math.max(12, anchor.left + anchor.width / 2 - PANEL_W / 2), innerWidth - PANEL_W - 12)}px`;
    el.style.top = `${top}px`;
    el.style.maxHeight = `${floor - top}px`;
  });

  const name = (c: Chord, k: Key) => {
    const l = labels.get(id(c, k));
    return l ? chordSymbol(l, notation) : pitchName(c.root, notation, false);
  };
  const before = view.chords.filter((c) => c.section === from.id);
  const after = view.chords.filter((c) => c.section === to.id);
  const lastBefore = before[before.length - 1]?.chord ?? tonicOf(from.key);
  const firstAfter = after[0]?.chord ?? tonicOf(to.key);

  const listen = (plan: BridgePlan) => {
    const seq = [lastBefore, ...plan.chords, firstAfter].map(previewPitches);
    void api.previewSequence(chordsSequence(seq, 0.95), view.song.chordTrack.instrument);
  };
  const insert = (plan: BridgePlan) => {
    const commands: EditCommand[] = plan.chords.map((chord, i) => ({ type: "insertChord", section: from.id, index: before.length + i, chord, length: null }));
    // Si la sección nueva está vacía, también se pone su tónica: el camino tiene a dónde llegar.
    if (!after.length) commands.push({ type: "insertChord", section: to.id, index: 0, chord: tonicOf(to.key), length: null });
    void edit({ type: "batch", commands });
    onClose();
  };

  return createPortal(
    <section ref={ref} className="bridge-panel glass" style={{ width: PANEL_W }} role="dialog" aria-label={t("modulation.title")}>
      <header>
        <span className="tip-kicker">{t("modulation.title")}</span>
        <h3>
          {keyLabel(from.key)} {scaleName(from.key)} → {keyLabel(to.key)} {scaleName(to.key)}
        </h3>
        <p>
          <span className={`mod-chip is-${distance.kind} is-static`}>{t(`modulation.distance.${distance.kind}`)}</span> {t(`modulation.distanceHint.${distance.kind}`, { n: distance.shared })}
        </p>
      </header>
      <div className="bridge-plans">
        {plans.map((plan) => {
          const path = [...plan.chords.map((c, i) => (plan.kind === "pivot" && i === 0 ? name(c, from.key) : name(c, to.key))), name(tonicOf(to.key), to.key)];
          const pivotText =
            plan.pivot &&
            t("modulation.pivotRoles", {
              chord: name(plan.pivot.chord, from.key),
              from: romanOf({ chord: plan.pivot.chord, degree: plan.pivot.degreeFrom }),
              to: romanOf(diatonicTriads(to.key)[plan.pivot.degreeTo]),
              a: keyLabel(from.key),
              b: keyLabel(to.key),
            });
          return (
            <article key={plan.kind} className="bridge-plan">
              <div className="bridge-plan-head">
                <strong>{t(`modulation.plan.${plan.kind}`)}</strong>
                <span className="bridge-path">
                  {path.map((p, i) => (
                    <span key={i} className="bridge-step">
                      {i > 0 && <span className="bridge-arrow">→</span>}
                      <span className={`bridge-chord ${i === path.length - 1 ? "is-target" : ""}`}>{p}</span>
                    </span>
                  ))}
                </span>
              </div>
              <p>
                {t(`modulation.planHint.${plan.kind}`, { v7: name(plan.chords[plan.chords.length - 1] ?? tonicOf(to.key), to.key), key: keyLabel(to.key) })}
                {pivotText && <span className="bridge-pivot"> {pivotText}</span>}
              </p>
              <div className="bridge-actions">
                <button className="ghost-button small" onClick={() => listen(plan)}>
                  <Icon name="play" size={12} filled /> {t("modulation.listen")}
                </button>
                {plan.chords.length > 0 && (
                  <button className="ghost-button small" onClick={() => insert(plan)} title={t("modulation.insertHint")}>
                    <Icon name="plus" size={12} /> {t("modulation.insert")}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!plans.some((p) => p.kind === "pivot") && <p className="bridge-note">{t("modulation.noPivot")}</p>}
      <p className="bridge-note">
        {t("modulation.wheelHint")}{" "}
        {dockView !== "wheel" && (
          <button className="link-button" onClick={() => setUi({ dockView: "wheel", dockHidden: false })}>
            {t("modulation.showWheel")}
          </button>
        )}
      </p>
    </section>,
    document.body,
  );
}
