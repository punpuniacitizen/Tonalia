//! Escalas y tonalidades.
//!
//! Una escala se describe por sus **pasos**: semitonos entre grados consecutivos.
//! La mayor es `2 2 1 2 2 2 1` (tono, tono, semitono, …). El último paso solo cierra
//! la octava; los grados salen de ir sumando los pasos desde la fundamental.

use serde::{Deserialize, Serialize};

use crate::pitch::{Accidentals, PitchClass, SpelledNote};

/// Nombres de los siete modos griegos, en orden de rotación de la escala mayor.
pub const MODE_NAMES: [&str; 7] = ["ionian", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian"];

const MAJOR_STEPS: [u8; 7] = [2, 2, 1, 2, 2, 2, 1];

/// Escalas de otras tradiciones, en el orden en que se muestran. Las de siete notas
/// (Hijaz, doble armónica…) funcionan como cualquier tonalidad; las demás (pentatónicas,
/// blues, tonos enteros, disminuida) arman sus acordes con [`crate::palette::diatonic_chords`].
pub const WORLD_SCALES: [(&str, &[u8]); 13] = [
    // Siete notas.
    ("phrygianDominant", &[1, 3, 1, 2, 1, 2, 2]),
    ("doubleHarmonic", &[1, 3, 1, 2, 1, 3, 1]),
    ("hungarianMinor", &[2, 1, 3, 1, 1, 3, 1]),
    ("persian", &[1, 3, 1, 1, 2, 3, 1]),
    ("neapolitanMinor", &[1, 2, 2, 2, 1, 3, 1]),
    ("neapolitanMajor", &[1, 2, 2, 2, 2, 2, 1]),
    // Cinco, seis u ocho notas.
    ("majorPentatonic", &[2, 2, 3, 2, 3]),
    ("minorPentatonic", &[3, 2, 2, 3, 2]),
    ("blues", &[3, 2, 1, 1, 3, 2]),
    ("majorBlues", &[2, 1, 1, 3, 2, 3]),
    ("wholeTone", &[2, 2, 2, 2, 2, 2]),
    ("hirajoshi", &[2, 1, 4, 1, 4]),
    ("diminished", &[1, 2, 1, 2, 1, 2, 1, 2]),
];

/// Escala: nombre (identificador que la interfaz traduce) y pasos en semitonos.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct Scale {
    pub name: String,
    pub steps: Vec<u8>,
}

impl Scale {
    pub fn new(name: impl Into<String>, steps: Vec<u8>) -> Self {
        Self { name: name.into(), steps }
    }

    pub fn major() -> Self {
        Self::new("major", MAJOR_STEPS.to_vec())
    }

    pub fn minor() -> Self {
        Self::new("minor", vec![2, 1, 2, 2, 1, 2, 2])
    }

    pub fn harmonic_minor() -> Self {
        Self::new("harmonicMinor", vec![2, 1, 2, 2, 1, 3, 1])
    }

    pub fn melodic_minor() -> Self {
        Self::new("melodicMinor", vec![2, 1, 2, 2, 2, 2, 1])
    }

    /// Las 12 notas. (El original solo emitía 11 grados; aquí están todas.)
    pub fn chromatic() -> Self {
        Self::new("chromatic", vec![1; 12])
    }

    /// Modo griego número `index` (0 = jónico … 6 = locrio): rotación de la escala mayor.
    pub fn mode(index: usize) -> Self {
        let index = index % 7;
        let steps = (0..7).map(|i| MAJOR_STEPS[(index + i) % 7]).collect();
        Self::new(MODE_NAMES[index], steps)
    }

    /// Escala predefinida por su identificador.
    pub fn builtin(name: &str) -> Option<Self> {
        match name {
            "major" => Some(Self::major()),
            "minor" => Some(Self::minor()),
            "harmonicMinor" => Some(Self::harmonic_minor()),
            "melodicMinor" => Some(Self::melodic_minor()),
            "chromatic" => Some(Self::chromatic()),
            _ => MODE_NAMES
                .iter()
                .position(|&m| m == name)
                .map(Self::mode)
                .or_else(|| WORLD_SCALES.iter().find(|(n, _)| *n == name).map(|(n, steps)| Self::new(*n, steps.to_vec()))),
        }
    }

    /// Todas las escalas predefinidas, en el orden en que se muestran.
    pub fn builtins() -> Vec<Self> {
        let mut all = vec![Self::major(), Self::minor()];
        all.extend((0..7).map(Self::mode));
        all.extend([Self::harmonic_minor(), Self::melodic_minor()]);
        all.extend(WORLD_SCALES.iter().map(|(n, steps)| Self::new(*n, steps.to_vec())));
        all.push(Self::chromatic());
        all
    }

    /// Distancia en semitonos de cada grado a la fundamental.
    /// Se emite el grado y *después* se suma el paso, así el último paso nunca se usa.
    pub fn offsets(&self) -> Vec<u8> {
        let mut acc = 0u32;
        let mut out = Vec::with_capacity(self.steps.len());
        for &step in &self.steps {
            out.push((acc % 12) as u8);
            acc += step as u32;
        }
        out
    }

    pub fn len(&self) -> usize {
        self.steps.len()
    }

    pub fn is_empty(&self) -> bool {
        self.steps.is_empty()
    }

    /// Siete grados: se pueden escribir con siete letras distintas y construir acordes por terceras.
    pub fn is_heptatonic(&self) -> bool {
        self.steps.len() == 7
    }

    /// De color menor: tiene tercera menor y no mayor (menor, dórico, blues, hirajoshi…).
    pub fn is_minor_like(&self) -> bool {
        let offsets = self.offsets();
        offsets.contains(&3) && !offsets.contains(&4)
    }

    /// Si es un modo de la escala mayor (o mayor/menor), su índice de modo.
    pub fn mode_index(&self) -> Option<usize> {
        (0..7).find(|&i| Self::mode(i).steps == self.steps)
    }
}

/// Tonalidad: una fundamental y una escala (p. ej. "Re dórico").
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct Key {
    pub root: PitchClass,
    pub scale: Scale,
}

impl Key {
    pub fn new(root: PitchClass, scale: Scale) -> Self {
        Self { root, scale }
    }

    pub fn major(root: PitchClass) -> Self {
        Self::new(root, Scale::major())
    }

    pub fn minor(root: PitchClass) -> Self {
        Self::new(root, Scale::minor())
    }

    pub fn degrees(&self) -> Vec<PitchClass> {
        self.scale.offsets().into_iter().map(|o| self.root.transpose(o as i32)).collect()
    }

    pub fn contains(&self, pc: PitchClass) -> bool {
        self.degrees().contains(&pc)
    }

    /// Índice de grado (0 = tónica) de `pc`, si pertenece a la escala.
    pub fn degree_of(&self, pc: PitchClass) -> Option<usize> {
        self.degrees().iter().position(|&d| d == pc)
    }

    /// Un paso a la izquierda en el círculo de quintas (una quinta abajo: Do → Fa).
    pub fn fifth_left(&self) -> Self {
        Self::new(self.root.transpose(-7), self.scale.clone())
    }

    /// Un paso a la derecha en el círculo de quintas (una quinta arriba: Do → Sol).
    pub fn fifth_right(&self) -> Self {
        Self::new(self.root.transpose(7), self.scale.clone())
    }

    /// Misma fundamental, otra escala (modo paralelo).
    pub fn with_scale(&self, scale: Scale) -> Self {
        Self::new(self.root, scale)
    }

    /// Grados escritos con letras consecutivas (Mi mayor → E F# G# A B C# D#).
    /// Para escalas que no tienen siete grados se usa la preferencia de alteraciones.
    pub fn spelled_degrees(&self) -> Vec<SpelledNote> {
        let degrees = self.degrees();
        if !self.scale.is_heptatonic() {
            let prefer = self.parent().accidentals();
            return degrees.into_iter().map(|pc| SpelledNote::simple(pc, prefer)).collect();
        }
        let mut best: Option<(i32, Vec<SpelledNote>)> = None;
        for letter in 0..7u8 {
            if SpelledNote::with_letter(self.root, letter).accidental.abs() > 1 {
                continue;
            }
            let names: Vec<SpelledNote> = degrees
                .iter()
                .enumerate()
                .map(|(i, &pc)| SpelledNote::with_letter(pc, letter + i as u8))
                .collect();
            let doubles = names.iter().filter(|n| n.accidental.abs() > 1).count() as i32;
            let cost: i32 = names.iter().map(|n| (n.accidental as i32).abs()).sum::<i32>() + doubles * 100;
            if best.as_ref().is_none_or(|(c, _)| cost < *c) {
                best = Some((cost, names));
            }
        }
        best.map(|(_, names)| names).unwrap_or_default()
    }

    /// Para escalas que no tienen siete notas: la mayor o la menor natural de la misma
    /// tónica, según su color. Da la ortografía y los números romanos (Am pentatónica → La menor).
    pub fn parent(&self) -> Key {
        if self.scale.is_minor_like() { Key::minor(self.root) } else { Key::major(self.root) }
    }

    /// ¿Esta tonalidad se escribe con sostenidos o con bemoles?
    /// Sin alteraciones (Do mayor, La menor) preferimos bemoles: los acordes prestados
    /// típicos (Sib, Lab, Mib) se leen mejor así.
    pub fn accidentals(&self) -> Accidentals {
        if !self.scale.is_heptatonic() {
            return self.parent().accidentals();
        }
        if self.spelled_degrees().iter().any(|n| n.accidental > 0) {
            Accidentals::Sharps
        } else {
            Accidentals::Flats
        }
    }

    /// Escribe una nota en el contexto de esta tonalidad.
    pub fn spell(&self, pc: PitchClass) -> SpelledNote {
        if self.scale.is_heptatonic() {
            if let Some(i) = self.degree_of(pc) {
                return self.spelled_degrees()[i];
            }
        }
        SpelledNote::simple(pc, self.accidentals())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pitch::Notation;

    fn pcs(v: &[u8]) -> Vec<PitchClass> {
        v.iter().map(|&x| PitchClass::from(x)).collect()
    }

    fn names(key: &Key) -> Vec<String> {
        key.spelled_degrees().iter().map(|n| n.name(Notation::Letters)).collect()
    }

    #[test]
    fn grados_de_escalas() {
        assert_eq!(Key::major(PitchClass::C).degrees(), pcs(&[0, 2, 4, 5, 7, 9, 11]));
        assert_eq!(Key::new(PitchClass::A, Scale::harmonic_minor()).degrees(), pcs(&[9, 11, 0, 2, 4, 5, 8]));
        let chromatic = Key::new(PitchClass::C, Scale::chromatic()).degrees();
        assert_eq!(chromatic.len(), 12);
        assert!(chromatic.contains(&PitchClass::B));
    }

    #[test]
    fn modos_son_rotaciones() {
        assert_eq!(Scale::mode(1).steps, vec![2, 1, 2, 2, 2, 1, 2]); // dórico
        assert_eq!(Scale::mode(5).steps, Scale::minor().steps); // eólico = menor natural
        assert_eq!(Scale::minor().mode_index(), Some(5));
        assert_eq!(Scale::builtin("lydian"), Some(Scale::mode(3)));
        assert_eq!(Scale::builtins().len(), 12 + WORLD_SCALES.len());
        assert_eq!(Scale::builtin("hirajoshi").map(|s| s.steps), Some(vec![2, 1, 4, 1, 4]));
    }

    #[test]
    fn escalas_del_mundo_cierran_la_octava() {
        for (name, steps) in WORLD_SCALES {
            assert_eq!(steps.iter().map(|&s| s as u32).sum::<u32>(), 12, "{name}");
        }
        let minor_like: Vec<&str> =
            WORLD_SCALES.iter().filter(|(_, s)| Scale::new("", s.to_vec()).is_minor_like()).map(|(n, _)| *n).collect();
        assert_eq!(minor_like, ["hungarianMinor", "neapolitanMinor", "neapolitanMajor", "minorPentatonic", "blues", "hirajoshi"]);
        assert!(Scale::minor().is_minor_like() && Scale::mode(1).is_minor_like() && !Scale::major().is_minor_like());
    }

    #[test]
    fn ortografia_de_escalas_del_mundo() {
        let hijaz = |root: PitchClass| Key::new(root, Scale::builtin("phrygianDominant").unwrap());
        assert_eq!(names(&hijaz(PitchClass::E)), ["E", "F", "G#", "A", "B", "C", "D"]);
        let double = Key::new(PitchClass::C, Scale::builtin("doubleHarmonic").unwrap());
        assert_eq!(names(&double), ["C", "Db", "E", "F", "G", "Ab", "B"]);
        // Sin siete notas: la escala madre decide (blues de La se escribe como La menor).
        let blues = Key::new(PitchClass::A, Scale::builtin("blues").unwrap());
        assert_eq!(names(&blues), ["A", "C", "D", "Eb", "E", "G"]);
        let pent = Key::new(PitchClass::E, Scale::builtin("majorPentatonic").unwrap());
        assert_eq!(names(&pent), ["E", "F#", "G#", "B", "C#"]);
    }

    #[test]
    fn circulo_de_quintas() {
        let c = Key::major(PitchClass::C);
        assert_eq!(c.fifth_left().root, PitchClass::F);
        assert_eq!(c.fifth_right().root, PitchClass::G);
    }

    #[test]
    fn ortografia_de_tonalidades() {
        assert_eq!(names(&Key::major(PitchClass::E)), ["E", "F#", "G#", "A", "B", "C#", "D#"]);
        assert_eq!(names(&Key::major(PitchClass::new(3))), ["Eb", "F", "G", "Ab", "Bb", "C", "D"]);
        assert_eq!(names(&Key::major(PitchClass::new(1))), ["Db", "Eb", "F", "Gb", "Ab", "Bb", "C"]);
        assert_eq!(names(&Key::minor(PitchClass::new(8))), ["G#", "A#", "B", "C#", "D#", "E", "F#"]);
        assert_eq!(Key::major(PitchClass::C).accidentals(), Accidentals::Flats);
        assert_eq!(Key::major(PitchClass::G).accidentals(), Accidentals::Sharps);
        assert_eq!(Key::major(PitchClass::F).accidentals(), Accidentals::Flats);
        // Nota fuera de la escala: se escribe según la tonalidad.
        assert_eq!(Key::major(PitchClass::C).spell(PitchClass::new(10)).name(Notation::Letters), "Bb");
        assert_eq!(Key::major(PitchClass::D).spell(PitchClass::new(8)).name(Notation::Letters), "G#");
    }
}
