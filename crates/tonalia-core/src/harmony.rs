//! Armonía tonal: función de cada acorde, tensión y puntuación de transiciones.
//!
//! La puntuación reproduce el comportamiento observado del modo "Tonal Harmony":
//! `1.0` = transición fuerte, `0.8` = sin contexto, `0.7` = aceptable, `0.0` = débil.
//! Además devolvemos el **motivo** ([`Reason`]) para poder explicarlo en la interfaz.

use serde::{Deserialize, Serialize};

use crate::chord::Chord;
use crate::naming::{Fifth, Seventh, Third, analyze};
use crate::pitch::{PitchClass, mod12};
use crate::scale::Key;

/// Función tonal: reposo (tónica), alejamiento (subdominante) o tensión (dominante).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Function {
    Tonic,
    Subdominant,
    Dominant,
}

/// Función del acorde según el grado de su fundamental.
/// Un acorde mayor con séptima menor fuera del V es una dominante secundaria (p. ej. A7 en Do).
pub fn function_of(chord: &Chord, key: &Key) -> Function {
    let shape = analyze(chord);
    if shape.third == Third::Major && shape.seventh == Seventh::Minor {
        return Function::Dominant;
    }
    match key.root.up_to(chord.root) {
        0 | 3 | 4 | 9 => Function::Tonic,
        6 | 7 | 11 => Function::Dominant,
        _ => Function::Subdominant, // 1, 2, 5, 8, 10
    }
}

/// Tensión heurística 0..=1: la función da la base y cada disonancia suma.
/// Es la altura de los bloques en la cinta de acordes.
pub fn tension(chord: &Chord, key: &Key) -> f32 {
    let shape = analyze(chord);
    let mut t: f32 = match function_of(chord, key) {
        Function::Tonic => 0.15,
        Function::Subdominant => 0.4,
        Function::Dominant => 0.65,
    };
    let pcs = chord.pitch_classes();
    if pcs.iter().any(|p| pcs.contains(&p.transpose(6))) {
        t += 0.12; // tritono
    }
    if shape.seventh != Seventh::None {
        t += 0.08;
    }
    t += 0.08 * shape.extensions.iter().filter(|e| !e.is_natural()).count() as f32;
    if chord.is_sus() {
        t += 0.1;
    }
    if matches!(shape.fifth, Fifth::Augmented | Fifth::Diminished) {
        t += 0.08;
    }
    if !pcs.iter().all(|&p| key.contains(p)) {
        t += 0.1; // notas fuera de la escala (préstamo o cromatismo)
    }
    t.clamp(0.0, 1.0)
}

/// Por qué una transición suena bien (o no).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Reason {
    /// No hay acorde anterior.
    NoContext,
    /// Misma fundamental (cambio de color, no de función).
    SameRoot,
    /// Desde la tónica se puede ir a cualquier parte.
    FromTonic,
    /// La fundamental baja una quinta (ii→V, V→I, vi→ii…): el movimiento más fuerte.
    FifthDown,
    /// Un par funcional clásico, como IV→V o vi→IV. `from`/`to` son grados en semitonos.
    FunctionalPair { from: u8, to: u8 },
    /// Movimiento de fundamental fuerte por semitonos: 1, 2, 5, 6, 8 o 9.
    StrongRootMotion { semitones: u8 },
    /// Una suspensión resuelve por grado conjunto (sus4 baja, sus2 sube).
    SusResolution,
    /// La nota suspendida ya sonaba en el acorde anterior (suspensión preparada).
    PreparedSus,
    /// Ninguna regla la respalda.
    Weak,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transition {
    pub score: f32,
    pub reason: Reason,
}

impl Transition {
    fn new(score: f32, reason: Reason) -> Self {
        Self { score, reason }
    }
}

/// Pares de grados (semitonos sobre la tónica) que se consideran funcionales:
/// IV→vii°, V→I, vii°→I, vi→IV, bVI→ii, bVI→IV, ii→vii°, IV→V.
const FUNCTIONAL_PAIRS: [(u8, u8); 8] = [(5, 11), (7, 0), (11, 0), (9, 5), (8, 2), (8, 5), (2, 11), (5, 7)];

/// Subir 2ª menor/mayor, subir 4ª (= bajar 5ª), tritono, subir 6ª menor/mayor (= bajar 3ª).
const STRONG_ROOT_MOTIONS: [u8; 6] = [1, 2, 5, 6, 8, 9];

/// Reglas funcionales entre dos acordes (comparando sus fundamentales como grados).
pub fn functional(a: &Chord, b: &Chord, key_root: PitchClass) -> Option<Reason> {
    if a.root == key_root {
        return Some(Reason::FromTonic);
    }
    let da = key_root.up_to(a.root);
    let db = key_root.up_to(b.root);
    if mod12(db as i32 - da as i32) == 5 {
        return Some(Reason::FifthDown);
    }
    FUNCTIONAL_PAIRS.contains(&(da, db)).then_some(Reason::FunctionalPair { from: da, to: db })
}

/// Movimiento "fuerte" de fundamentales al estilo Rameau/Schoenberg, más el tritono.
pub fn chromatic_root_motion(a: &Chord, b: &Chord, key_root: PitchClass) -> Option<Reason> {
    if a.root == key_root {
        return Some(Reason::FromTonic);
    }
    let semitones = a.root.up_to(b.root);
    STRONG_ROOT_MOTIONS.contains(&semitones).then_some(Reason::StrongRootMotion { semitones })
}

/// ¿La nota suspendida de `a` resuelve por grado conjunto en alguna nota de `b`?
/// La 4ª suspendida baja (Fa→Mi/Mib) y la 2ª suspendida sube (Re→Mib/Mi).
pub fn sus_resolves(a: &Chord, b: &Chord) -> bool {
    let Some(s) = a.sus_note() else { return false };
    let targets = if a.is_sus4() { [s.transpose(-1), s.transpose(-2)] } else { [s.transpose(1), s.transpose(2)] };
    targets.iter().any(|&t| b.contains_pc(t))
}

/// Puntuación de ir de `previous` a `candidate` en una tonalidad con tónica `key_root`.
pub fn score(previous: Option<&Chord>, candidate: &Chord, key_root: PitchClass) -> Transition {
    let Some(a) = previous else {
        return Transition::new(0.8, Reason::NoContext);
    };
    if !a.is_sus() && !candidate.is_sus() {
        if a.root == candidate.root {
            return Transition::new(1.0, Reason::SameRoot);
        }
        if let Some(reason) = functional(a, candidate, key_root) {
            return Transition::new(1.0, reason);
        }
        if let Some(reason) = chromatic_root_motion(a, candidate, key_root) {
            return Transition::new(0.7, reason);
        }
    } else {
        if sus_resolves(a, candidate) {
            return Transition::new(1.0, Reason::SusResolution);
        }
        if candidate.sus_note().is_some_and(|s| a.contains_pc(s)) {
            return Transition::new(0.7, Reason::PreparedSus);
        }
    }
    Transition::new(0.0, Reason::Weak)
}

#[cfg(test)]
mod tests {
    use super::*;

    const C: PitchClass = PitchClass::C;

    fn pc(v: u8) -> PitchClass {
        PitchClass::from(v)
    }

    fn s(a: &Chord, b: &Chord) -> Transition {
        score(Some(a), b, C)
    }

    #[test]
    fn sin_contexto() {
        assert_eq!(score(None, &Chord::major(C), C), Transition::new(0.8, Reason::NoContext));
    }

    #[test]
    fn transiciones_fuertes() {
        let (dm, g, am, f, em) = (Chord::minor(pc(2)), Chord::major(pc(7)), Chord::minor(pc(9)), Chord::major(pc(5)), Chord::minor(pc(4)));
        assert_eq!(s(&g, &Chord::major(C)).reason, Reason::FifthDown); // V→I
        assert_eq!(s(&dm, &g).reason, Reason::FifthDown); // ii→V
        assert_eq!(s(&am, &dm).reason, Reason::FifthDown); // vi→ii
        assert_eq!(s(&f, &g), Transition::new(1.0, Reason::FunctionalPair { from: 5, to: 7 })); // IV→V
        assert_eq!(s(&am, &f).score, 1.0); // vi→IV
        assert_eq!(s(&Chord::major(C), &em), Transition::new(1.0, Reason::FromTonic));
        assert_eq!(s(&g, &Chord::dominant7(pc(7))).reason, Reason::SameRoot);
    }

    #[test]
    fn transiciones_cromaticas_y_debiles() {
        let (dm, g, am, f, em) = (Chord::minor(pc(2)), Chord::major(pc(7)), Chord::minor(pc(9)), Chord::major(pc(5)), Chord::minor(pc(4)));
        // Re → Mib: sube una 2ª menor.
        assert_eq!(s(&dm, &Chord::major(pc(3))), Transition::new(0.7, Reason::StrongRootMotion { semitones: 1 }));
        // V→vi (cadencia rota): sube una 2ª mayor.
        assert_eq!(s(&g, &am).score, 0.7);
        // V→iii: baja una 3ª mayor (= sube 6ª menor).
        assert_eq!(s(&g, &em).score, 0.7);
        // IV→iii y vi→V no tienen regla.
        assert_eq!(s(&f, &em), Transition::new(0.0, Reason::Weak));
        assert_eq!(s(&am, &g).score, 0.0);
    }

    #[test]
    fn suspensiones() {
        let csus4 = Chord::sus4(C);
        let csus2 = Chord::sus2(C);
        assert_eq!(s(&csus4, &Chord::major(C)), Transition::new(1.0, Reason::SusResolution)); // Fa→Mi
        assert_eq!(s(&csus4, &Chord::minor(C)).score, 1.0); // Fa→Mib
        assert_eq!(s(&csus2, &Chord::major(C)).score, 1.0); // Re→Mi
        // La→(Mi sus4): La ya sonaba en Lam.
        assert_eq!(s(&Chord::minor(pc(9)), &Chord::sus4(pc(4))), Transition::new(0.7, Reason::PreparedSus));
        assert_eq!(s(&Chord::major(pc(7)), &csus4).score, 0.0);
    }

    #[test]
    fn funciones_y_tension() {
        let key = Key::major(C);
        assert_eq!(function_of(&Chord::major(C), &key), Function::Tonic);
        assert_eq!(function_of(&Chord::minor(pc(9)), &key), Function::Tonic);
        assert_eq!(function_of(&Chord::minor(pc(2)), &key), Function::Subdominant);
        assert_eq!(function_of(&Chord::major(pc(7)), &key), Function::Dominant);
        assert_eq!(function_of(&Chord::dominant7(pc(9)), &key), Function::Dominant); // V/ii
        let i = tension(&Chord::major(C), &key);
        let v7 = tension(&Chord::dominant7(pc(7)), &key);
        let v7b9 = tension(&Chord::new(pc(7), [4, 7, 10, 13]), &key);
        assert!(i < v7 && v7 < v7b9, "{i} {v7} {v7b9}");
        assert!(v7b9 <= 1.0);
    }
}
