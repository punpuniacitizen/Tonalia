//! Rearmonización: acordes que pueden ocupar el lugar de otro (o prepararlo).
//!
//! - **Relativo**: comparte dos notas y la función (I ↔ vi ↔ iii, IV ↔ ii).
//! - **Intercambio modal**: el mismo acorde en el modo paralelo (IV → iv).
//! - **Sustitución tritonal**: un dominante por el que está a un tritono (G7 → D♭7).
//! - **Dominante secundaria**: el V7 *de* este acorde, para insertarlo antes.
//! - **Color**: versión sus o con séptima diatónica.

use serde::{Deserialize, Serialize};

use crate::chord::Chord;
use crate::naming::{Fifth, Seventh, Third, analyze};
use crate::scale::Key;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub enum SubKind {
    Relative,
    ModalInterchange,
    TritoneSub,
    /// Se inserta *antes* del acorde, no lo reemplaza.
    SecondaryDominant,
    Sus,
    Seventh,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Substitute {
    pub chord: Chord,
    pub kind: SubKind,
}

pub fn substitutes(chord: &Chord, key: &Key) -> Vec<Substitute> {
    let shape = analyze(chord);
    let r = chord.root;
    let mut out: Vec<Substitute> = Vec::new();
    let mut push = |c: Chord, kind: SubKind| {
        if c != *chord && !out.iter().any(|s| s.chord == c) {
            out.push(Substitute { chord: c, kind });
        }
    };
    let triad_major = shape.third == Third::Major && shape.fifth == Fifth::Perfect;
    let triad_minor = shape.third == Third::Minor && shape.fifth == Fifth::Perfect;

    if triad_major {
        push(Chord::minor(r.transpose(9)), SubKind::Relative);
        push(Chord::minor(r.transpose(4)), SubKind::Relative);
        push(Chord::minor(r), SubKind::ModalInterchange);
    } else if triad_minor {
        push(Chord::major(r.transpose(3)), SubKind::Relative);
        push(Chord::major(r.transpose(8)), SubKind::Relative);
        push(Chord::major(r), SubKind::ModalInterchange);
    }

    let is_dominant7 = shape.third == Third::Major && shape.seventh == Seventh::Minor;
    let on_fifth_degree = key.root.up_to(r) == 7 && shape.third == Third::Major;
    if is_dominant7 || on_fifth_degree {
        push(Chord::dominant7(r.transpose(6)), SubKind::TritoneSub);
    }

    if shape.fifth != Fifth::Diminished {
        push(Chord::dominant7(r.transpose(7)), SubKind::SecondaryDominant);
    }

    if matches!(shape.third, Third::Major | Third::Minor) {
        push(Chord::sus4(r), SubKind::Sus);
        push(Chord::sus2(r), SubKind::Sus);
    }

    if shape.seventh == Seventh::None && matches!(shape.third, Third::Major | Third::Minor) {
        // Séptima diatónica: la que pertenezca a la tonalidad (o menor si ninguna).
        let seventh = if key.contains(r.transpose(11)) && shape.fifth == Fifth::Perfect { 11 } else { 10 };
        let mut ivs = chord.intervals.clone();
        ivs.insert(seventh);
        push(Chord { root: r, intervals: ivs }, SubKind::Seventh);
    }
    out
}

/// Una tensión que se le puede añadir (o quitar) a un acorde.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TensionOption {
    /// Intervalo compuesto (13 = ♭9 … 21 = 13).
    pub interval: u8,
    /// Nombre corto: "b9", "9", "#9", "11", "#11", "b13", "13".
    pub token: String,
    /// La nota pertenece a la escala de la tonalidad.
    pub in_key: bool,
    /// "Nota a evitar": queda un semitono por encima de una nota del acorde y choca
    /// (salvo las tensiones alteradas en acordes de dominante, que se usan a propósito).
    pub avoid: bool,
    /// El acorde ya la tiene.
    pub present: bool,
    /// El acorde con esta tensión añadida (o quitada, si ya estaba).
    pub chord: Chord,
}

const TENSIONS: [(u8, &str); 7] = [(13, "b9"), (14, "9"), (15, "#9"), (17, "11"), (18, "#11"), (20, "b13"), (21, "13")];

pub fn tension_options(chord: &Chord, key: &Key) -> Vec<TensionOption> {
    let shape = analyze(chord);
    let tones = chord.pitch_classes();
    let dominant = shape.third == Third::Major && shape.seventh == Seventh::Minor;
    TENSIONS
        .iter()
        .filter_map(|&(iv, token)| {
            let pc = chord.root.transpose(iv as i32);
            let present = chord.has(iv);
            // Si la nota ya está en el acorde como otra cosa (sexta, sus…), no es una tensión.
            if !present && tones.contains(&pc) {
                return None;
            }
            let altered = matches!(token, "b9" | "#9" | "#11" | "b13");
            let clashes = tones.contains(&pc.transpose(-1));
            let avoid = clashes && !(dominant && altered);
            let mut with = chord.clone();
            if present {
                with.intervals.remove(&iv);
            } else {
                // 11 y #11, b13 y 13: la misma nota alterada de dos formas, solo una.
                let rival = match iv {
                    17 => Some(18),
                    18 => Some(17),
                    20 => Some(21),
                    21 => Some(20),
                    _ => None,
                };
                if let Some(r) = rival {
                    with.intervals.remove(&r);
                }
                with.intervals.insert(iv);
            }
            Some(TensionOption { interval: iv, token: token.to_string(), in_key: key.contains(pc), avoid, present, chord: with })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pitch::PitchClass;

    fn option<'a>(opts: &'a [TensionOption], token: &str) -> &'a TensionOption {
        opts.iter().find(|o| o.token == token).unwrap()
    }

    #[test]
    fn tensiones_y_notas_a_evitar() {
        let key = Key::major(PitchClass::C);
        let cmaj7 = substitutes_base_cmaj7();
        let opts = tension_options(&cmaj7, &key);
        assert!(option(&opts, "9").in_key && !option(&opts, "9").avoid);
        assert!(option(&opts, "11").in_key && option(&opts, "11").avoid); // Fa sobre Mi: choca
        assert!(!option(&opts, "#11").in_key && !option(&opts, "#11").avoid);
        assert!(option(&opts, "13").in_key && !option(&opts, "13").avoid);
        // En un dominante, las alteradas no son "a evitar".
        let g7 = Chord::dominant7(PitchClass::G);
        let opts = tension_options(&g7, &key);
        assert!(!option(&opts, "b9").avoid);
        assert!(option(&opts, "11").avoid); // Do sobre Si
        // Añadir 13 quita b13 y viceversa; una tensión presente se puede quitar.
        let with13 = option(&opts, "13").chord.clone();
        assert!(with13.has(21));
        let opts13 = tension_options(&with13, &key);
        assert!(option(&opts13, "13").present);
        assert!(!option(&opts13, "13").chord.has(21));
        assert!(option(&opts13, "b13").chord.has(20) && !option(&opts13, "b13").chord.has(21));
    }

    fn substitutes_base_cmaj7() -> Chord {
        Chord::major7(PitchClass::C)
    }

    fn has(subs: &[Substitute], c: &Chord, kind: SubKind) -> bool {
        subs.iter().any(|s| &s.chord == c && s.kind == kind)
    }

    #[test]
    fn sustitutos_de_un_acorde_mayor() {
        let key = Key::major(PitchClass::C);
        let subs = substitutes(&Chord::major(PitchClass::F), &key);
        assert!(has(&subs, &Chord::minor(PitchClass::D), SubKind::Relative)); // IV ↔ ii
        assert!(has(&subs, &Chord::minor(PitchClass::F), SubKind::ModalInterchange)); // IV → iv
        assert!(has(&subs, &Chord::dominant7(PitchClass::C), SubKind::SecondaryDominant)); // V7/IV
        assert!(has(&subs, &Chord::major7(PitchClass::F), SubKind::Seventh));
    }

    #[test]
    fn sustitucion_tritonal() {
        let key = Key::major(PitchClass::C);
        let subs = substitutes(&Chord::dominant7(PitchClass::G), &key);
        assert!(has(&subs, &Chord::dominant7(PitchClass::new(1)), SubKind::TritoneSub)); // G7 → D♭7
        let subs = substitutes(&Chord::minor(PitchClass::A), &key);
        assert!(has(&subs, &Chord::major(PitchClass::C), SubKind::Relative));
        assert!(has(&subs, &Chord::minor7(PitchClass::A), SubKind::Seventh));
        assert!(!subs.iter().any(|s| s.kind == SubKind::TritoneSub));
    }
}
