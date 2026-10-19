//! Acordes.
//!
//! Un acorde es una **fundamental** (clase de altura) más un **conjunto de intervalos** en
//! semitonos sobre ella, sin el 0. Do mayor = `{root: C, intervals: {4, 7}}`.
//! No guarda inversión ni octava: eso es trabajo del voicing.

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::interval::*;
use crate::pitch::PitchClass;

#[derive(Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct Chord {
    pub root: PitchClass,
    pub intervals: BTreeSet<u8>,
}

impl Chord {
    pub fn new(root: PitchClass, intervals: impl IntoIterator<Item = u8>) -> Self {
        Self { root, intervals: intervals.into_iter().filter(|&i| i != UNISON).collect() }
    }

    pub fn major(root: PitchClass) -> Self {
        Self::new(root, [MAJOR_THIRD, PERFECT_FIFTH])
    }

    pub fn minor(root: PitchClass) -> Self {
        Self::new(root, [MINOR_THIRD, PERFECT_FIFTH])
    }

    pub fn diminished(root: PitchClass) -> Self {
        Self::new(root, [MINOR_THIRD, TRITONE])
    }

    pub fn augmented(root: PitchClass) -> Self {
        Self::new(root, [MAJOR_THIRD, AUGMENTED_FIFTH])
    }

    pub fn sus2(root: PitchClass) -> Self {
        Self::new(root, [SUS2, PERFECT_FIFTH])
    }

    pub fn sus4(root: PitchClass) -> Self {
        Self::new(root, [SUS4, PERFECT_FIFTH])
    }

    pub fn dominant7(root: PitchClass) -> Self {
        Self::new(root, [MAJOR_THIRD, PERFECT_FIFTH, MINOR_SEVENTH])
    }

    pub fn major7(root: PitchClass) -> Self {
        Self::new(root, [MAJOR_THIRD, PERFECT_FIFTH, MAJOR_SEVENTH])
    }

    pub fn minor7(root: PitchClass) -> Self {
        Self::new(root, [MINOR_THIRD, PERFECT_FIFTH, MINOR_SEVENTH])
    }

    pub fn half_diminished7(root: PitchClass) -> Self {
        Self::new(root, [MINOR_THIRD, TRITONE, MINOR_SEVENTH])
    }

    pub fn diminished7(root: PitchClass) -> Self {
        Self::new(root, [MINOR_THIRD, TRITONE, DIMINISHED_SEVENTH])
    }

    pub fn has(&self, interval: u8) -> bool {
        self.intervals.contains(&interval)
    }

    /// Clases de altura que suenan: la fundamental más cada intervalo (mod 12).
    pub fn pitch_classes(&self) -> BTreeSet<PitchClass> {
        std::iter::once(self.root)
            .chain(self.intervals.iter().map(|&i| self.root.transpose(i as i32)))
            .collect()
    }

    pub fn contains_pc(&self, pc: PitchClass) -> bool {
        self.pitch_classes().contains(&pc)
    }

    pub fn transpose(&self, semitones: i32) -> Self {
        Self { root: self.root.transpose(semitones), intervals: self.intervals.clone() }
    }

    /// El mismo acorde expresado como grado: la fundamental pasa a ser la distancia a la tónica.
    pub fn relative_to(&self, key_root: PitchClass) -> Self {
        Self { root: PitchClass::from(key_root.up_to(self.root)), intervals: self.intervals.clone() }
    }

    pub fn has_third(&self) -> bool {
        self.has(MINOR_THIRD) || self.has(MAJOR_THIRD)
    }

    /// Suspendido de cuarta: sin tercera y con la cuarta en su lugar.
    pub fn is_sus4(&self) -> bool {
        !self.has_third() && self.has(SUS4)
    }

    /// Suspendido de segunda: sin tercera y con la segunda en su lugar.
    pub fn is_sus2(&self) -> bool {
        !self.has_third() && self.has(SUS2) && !self.has(SUS4)
    }

    pub fn is_sus(&self) -> bool {
        self.is_sus4() || self.is_sus2()
    }

    /// La nota suspendida (la que "quiere" resolver), si el acorde es sus.
    pub fn sus_note(&self) -> Option<PitchClass> {
        if self.is_sus4() {
            Some(self.root.transpose(SUS4 as i32))
        } else if self.is_sus2() {
            Some(self.root.transpose(SUS2 as i32))
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clases_de_altura() {
        let g7 = Chord::dominant7(PitchClass::G);
        let pcs: Vec<u8> = g7.pitch_classes().into_iter().map(u8::from).collect();
        assert_eq!(pcs, vec![2, 5, 7, 11]); // Re Fa Sol Si
        assert!(g7.contains_pc(PitchClass::F));
    }

    #[test]
    fn grado_relativo() {
        let g = Chord::major(PitchClass::G);
        assert_eq!(g.relative_to(PitchClass::C).root, PitchClass::from(7));
        assert_eq!(g.relative_to(PitchClass::A).root, PitchClass::from(10));
    }

    #[test]
    fn suspensiones() {
        let csus4 = Chord::sus4(PitchClass::C);
        let csus2 = Chord::sus2(PitchClass::C);
        assert!(csus4.is_sus4() && !csus4.is_sus2());
        assert!(csus2.is_sus2() && !csus2.is_sus4());
        assert_eq!(csus4.sus_note(), Some(PitchClass::F));
        assert_eq!(csus2.sus_note(), Some(PitchClass::D));
        // Con tercera ya no es suspendido (Cadd2 / Cadd4).
        assert!(!Chord::new(PitchClass::C, [2, 4, 7]).is_sus());
        assert!(!Chord::major(PitchClass::C).is_sus());
        assert_eq!(Chord::new(PitchClass::C, [0, 4, 7]), Chord::major(PitchClass::C));
    }
}
