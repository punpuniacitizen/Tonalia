// Voces de un acorde a mano: cada nota del voicing (de la más aguda a la más grave) se puede
// subir o bajar una octava, y hay atajos para invertir, mover todo el acorde y abrirlo (drop 2).
// Mover voces por octavas cambia la disposición, no el acorde.

import { useTranslation } from "react-i18next";

import { api } from "../../api";
import type { ChordView } from "../../bindings/ChordView";
import type { Note } from "../../bindings/Note";
import { spelledName } from "../../lib/music";
import { pitchName } from "../../lib/pitch";
import { useSong } from "../../stores/song";
import { useUi } from "../../stores/ui";
import { Icon } from "../common/Icon";

const LOW = 28; // Mi1
const HIGH = 100; // Mi7

/** Papel de cada intervalo del acorde (en semitonos sobre la fundamental, compuestos incluidos). */
const ROLE: Record<number, string> = {
  0: "1", 1: "♭2", 2: "2", 3: "♭3", 4: "3", 5: "4", 6: "♭5", 7: "5", 8: "♯5", 9: "6", 10: "♭7", 11: "7",
  13: "♭9", 14: "9", 15: "♯9", 17: "11", 18: "♯11", 20: "♭13", 21: "13",
};

export function VoicingEditor({ chord }: { chord: ChordView }) {
  const { t } = useTranslation();
  const notation = useUi((s) => s.notation);
  const edit = useSong((s) => s.edit);
  const instrument = useSong((s) => s.view?.song.chordTrack.instrument);
  const notes = [...chord.voicing].sort((a, b) => b.pitch - a.pitch); // aguda arriba
  const pitches = notes.map((n) => n.pitch);
  const root = chord.chord.root;
  // El papel sale del intervalo del acorde que suena en esa nota: G♯ es ♯11 en un D7♯11, no ♭5.
  const intervals = [0, ...chord.chord.intervals];
  const role = (p: number) => {
    const semis = (((p - root) % 12) + 12) % 12;
    const iv = intervals.find((i) => i % 12 === semis) ?? semis;
    return ROLE[iv] ?? ROLE[semis];
  };
  // Con la ortografía del acorde (G♯ en un D7♯11, no A♭) y la octava (60 = Do4).
  // `label.notes` va en el orden del acorde (fundamental, 3.ª, 5.ª…), como sus intervalos.
  const chordPcs = intervals.map((iv) => (root + iv) % 12);
  const name = (p: number) => {
    const i = chordPcs.indexOf(((p % 12) + 12) % 12);
    return i >= 0 ? `${spelledName(chord.label.notes[i], notation)}${Math.floor(p / 12) - 1}` : pitchName(p, notation);
  };

  const commit = (next: Note[]) => {
    const relative = next.map((n) => ({ ...n, position: n.position - chord.start }));
    void edit({ type: "setVoicing", at: { section: chord.section, index: chord.index }, voicing: relative });
    void api.previewNotes(next.map((n) => n.pitch), 0.8, instrument, 0.9);
  };
  const free = (p: number, except: Note) => p >= LOW && p <= HIGH && !notes.some((n) => n !== except && n.pitch === p);
  const moveVoice = (note: Note, by: number) => commit(notes.map((n) => (n === note ? { ...n, pitch: n.pitch + by } : n)));

  const lowest = notes[notes.length - 1];
  const highest = notes[0];
  const canAll = (by: number) => pitches.every((p) => p + by >= LOW && p + by <= HIGH);
  // Invertir: la más grave sube una octava (o la más aguda baja) hasta quedar al otro extremo.
  const invertUp = () => {
    let p = lowest.pitch;
    while (p <= highest.pitch) p += 12;
    if (free(p, lowest)) moveVoice(lowest, p - lowest.pitch);
  };
  const invertDown = () => {
    let p = highest.pitch;
    while (p >= lowest.pitch) p -= 12;
    if (free(p, highest)) moveVoice(highest, p - highest.pitch);
  };
  // Drop 2: la segunda voz desde arriba baja una octava (abre el acorde).
  const drop2 = () => notes.length >= 3 && free(notes[1].pitch - 12, notes[1]) && moveVoice(notes[1], -12);

  const bassRole = lowest ? role(lowest.pitch) : "1";
  const position = bassRole === "1" ? "root" : bassRole === "3" || bassRole === "♭3" ? "first" : bassRole === "5" || bassRole === "♭5" || bassRole === "♯5" ? "second" : bassRole === "7" || bassRole === "♭7" ? "third" : "other";
  const lo = Math.min(...pitches) - 3;
  const hi = Math.max(...pitches) + 3;

  if (!notes.length) return <p className="voicing-empty">{t("voicing.empty")}</p>;

  return (
    <div className="voicing">
      <p className="voicing-summary">
        {t(`voicing.position.${position}`)} · {name(lowest.pitch)}–{name(highest.pitch)}
      </p>
      <ol className="voicing-voices">
        {notes.map((n) => (
          <li key={`${n.pitch}-${n.position}`}>
            <span className={`voicing-role ${role(n.pitch) === "1" ? "is-root" : ""}`}>{role(n.pitch)}</span>
            <span className="voicing-name">{name(n.pitch)}</span>
            <span className="voicing-track" aria-hidden="true">
              <span style={{ left: `${((n.pitch - lo) / Math.max(1, hi - lo)) * 100}%` }} />
            </span>
            <button className="icon-button small" disabled={!free(n.pitch - 12, n)} onClick={() => moveVoice(n, -12)} title={t("voicing.down")}>
              <Icon name="chevronDown" size={14} />
            </button>
            <button className="icon-button small flip" disabled={!free(n.pitch + 12, n)} onClick={() => moveVoice(n, 12)} title={t("voicing.up")}>
              <Icon name="chevronDown" size={14} />
            </button>
          </li>
        ))}
      </ol>
      <div className="voicing-actions">
        <button className="ghost-button small" onClick={invertDown} title={t("voicing.invertDownHint")}>
          <Icon name="chevronLeft" size={13} /> {t("voicing.invertDown")}
        </button>
        <button className="ghost-button small" onClick={invertUp} title={t("voicing.invertUpHint")}>
          {t("voicing.invertUp")} <Icon name="chevronRight" size={13} />
        </button>
        <button className="ghost-button small" disabled={notes.length < 3} onClick={drop2} title={t("voicing.drop2Hint")}>
          {t("voicing.drop2")}
        </button>
        <button className="ghost-button small" disabled={!canAll(-12)} onClick={() => commit(notes.map((n) => ({ ...n, pitch: n.pitch - 12 })))} title={t("voicing.allDown")}>
          −8va
        </button>
        <button className="ghost-button small" disabled={!canAll(12)} onClick={() => commit(notes.map((n) => ({ ...n, pitch: n.pitch + 12 })))} title={t("voicing.allUp")}>
          +8va
        </button>
      </div>
      <p className="voicing-hint">{t("voicing.hint")}</p>
    </div>
  );
}
