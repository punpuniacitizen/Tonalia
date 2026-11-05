//! Voicing: qué notas concretas (con octava) suenan para un acorde.
//!
//! El voicing por defecto se construye en cadena:
//! 1. [`chord_to_notes`]: posición cerrada, fundamental abajo.
//! 2. [`strum`]: cada nota entra un poco después que la anterior (rasgueo).
//! 3. [`register_fix`]: las fundamentales por debajo de la tónica suben una octava,
//!    así los acordes quedan agrupados cerca de la tónica.
//! 4. [`transpose`]: se lleva todo a la octava elegida.
//!
//! Hay dos disposiciones: **cerrada** (todas las notas lo más juntas posible) y **abierta**
//! ([`open_notes`]: bajo, quinta, y el resto una octava arriba, con las tensiones encima),
//! que es la que hace sonar bien a los acordes con novenas, oncenas o trecenas.

use serde::{Deserialize, Serialize};

use crate::chord::Chord;
use crate::model::Note;
use crate::pitch::PitchClass;
use crate::time::{MIN_STRUM_LENGTH, Ticks};

/// Cómo se reparten las notas de los acordes nuevos.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub enum VoicingStyle {
    /// Abierta solo si el acorde tiene extensiones (9, 11, 13…); cerrada si no.
    #[default]
    Auto,
    Closed,
    Open,
}

/// Ajustes con los que se escuchan y se insertan los acordes.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct PreviewSettings {
    /// Octava de la fundamental (3 → entre Do3 = 48 y Si3 = 59, con Do4 = 60 como Do central).
    pub octave: u8,
    /// Retraso entre notas sucesivas, en ticks (0 = todas a la vez).
    pub strumming: Ticks,
    /// Intensidad 0..=1.
    pub velocity: f32,
    /// Disposición de las notas. Los proyectos antiguos no la tienen: se usa `Auto`.
    #[serde(default)]
    pub style: VoicingStyle,
}

impl Default for PreviewSettings {
    fn default() -> Self {
        Self { octave: 3, strumming: 0, velocity: 0.8, style: VoicingStyle::Auto }
    }
}

/// El acorde tiene tensiones por encima de la octava (9, 11, 13 y sus alteraciones).
pub fn has_extensions(chord: &Chord) -> bool {
    chord.intervals.iter().any(|&i| i > 12)
}

fn uses_open(chord: &Chord, style: VoicingStyle) -> bool {
    match style {
        VoicingStyle::Auto => has_extensions(chord),
        VoicingStyle::Closed => false,
        VoicingStyle::Open => true,
    }
}

/// Disposición abierta, como la tocaría un pianista:
/// - la fundamental en el bajo y, si cabe, la quinta justo encima;
/// - tercera, séptima (y sexta, sus…) una octava más arriba;
/// - las tensiones por encima de todo lo anterior.
///
/// Con cinco notas o más se omite la quinta justa (no aporta color) y, si hay una oncena
/// natural junto a una tercera mayor, se omite la tercera (chocan a distancia de 9ª menor).
pub fn open_notes(chord: &Chord, length: Ticks, velocity: f32) -> Vec<Note> {
    let has = |i: u8| chord.intervals.contains(&i);
    let root = chord.root.value() as i32;
    let tone_count = 1 + chord.intervals.iter().filter(|&&i| i != 12).count();
    let omit_fifth = tone_count >= 5 && has(7);
    let omit_third = has(4) && (has(17) || has(5));

    let mut pitches: Vec<i32> = vec![root];
    if has(7) && !omit_fifth {
        pitches.push(root + 7);
    }
    for &iv in chord.intervals.iter().filter(|&&i| i < 12 && i != 7) {
        if iv == 4 && omit_third {
            continue;
        }
        pitches.push(root + iv as i32 + 12);
    }
    for &iv in chord.intervals.iter().filter(|&&i| i > 12) {
        let top = *pitches.iter().max().unwrap();
        let mut p = root + iv as i32;
        while p <= top {
            p += 12;
        }
        pitches.push(p);
    }
    pitches.sort_unstable();
    pitches.dedup();
    pitches.into_iter().map(|p| Note::new(0, length, p.clamp(0, 127) as u8, velocity)).collect()
}

/// Notas del acorde en posición cerrada. Las alturas son relativas al Do más grave (0);
/// [`transpose`] las coloca después en su octava.
pub fn chord_to_notes(chord: &Chord, length: Ticks, velocity: f32) -> Vec<Note> {
    let root = chord.root.value();
    std::iter::once(0)
        .chain(chord.intervals.iter().copied())
        .map(|iv| Note::new(0, length, root + iv, velocity))
        .collect()
}

/// Rasgueo: la nota `i` entra `i * step` ticks más tarde y se acorta para terminar a la vez,
/// sin quedar nunca por debajo de 1/64.
pub fn strum(mut notes: Vec<Note>, step: Ticks) -> Vec<Note> {
    for (i, n) in notes.iter_mut().enumerate() {
        let delay = i as Ticks * step;
        n.position += delay;
        n.length = (n.length - delay).max(MIN_STRUM_LENGTH);
    }
    notes
}

/// Si la primera nota (la fundamental) cae por debajo de `threshold`, sube todo una octava.
pub fn register_fix(notes: Vec<Note>, threshold: PitchClass) -> Vec<Note> {
    match notes.first() {
        Some(first) if first.pitch % 12 < threshold.value() => transpose(notes, 12),
        _ => notes,
    }
}

/// Sube o baja todas las notas `semitones`, sin salir del rango MIDI 0..=127.
pub fn transpose(mut notes: Vec<Note>, semitones: i32) -> Vec<Note> {
    for n in &mut notes {
        n.pitch = (n.pitch as i32 + semitones).clamp(0, 127) as u8;
    }
    notes
}

/// Voicing por defecto de un acorde nuevo (el mismo que se oye al previsualizarlo).
pub fn default_voicing(chord: &Chord, length: Ticks, settings: &PreviewSettings, key_root: PitchClass) -> Vec<Note> {
    let open = uses_open(chord, settings.style);
    let notes = if open { open_notes(chord, length, settings.velocity) } else { chord_to_notes(chord, length, settings.velocity) };
    let notes = strum(notes, settings.strumming);
    let notes = register_fix(notes, key_root);
    // En disposición abierta el bajo baja una octava (mano izquierda) y el resto queda en
    // el registro central (mano derecha), como lo tocaría un pianista.
    let octave_shift = if open { -12 } else { 0 };
    transpose(notes, (settings.octave as i32 + 1) * 12 + octave_shift)
}

/// Coste de ir de un voicing a otro: cuánto se mueve cada voz nueva hasta la voz anterior
/// más cercana, más un poco por desplazar el centro del acorde.
fn movement_cost(prev: &[u8], next: &[u8]) -> f32 {
    let nearest: f32 = next.iter().map(|&p| prev.iter().map(|&q| (p as i32 - q as i32).abs()).min().unwrap_or(0) as f32).sum();
    let center = |v: &[u8]| v.iter().map(|&p| p as f32).sum::<f32>() / v.len().max(1) as f32;
    nearest + 0.5 * (center(prev) - center(next)).abs()
}

/// Voicing con la mínima conducción de voces desde `previous`: prueba todas las inversiones
/// en varias octavas y se queda con la que menos mueve las voces.
pub fn smooth_voicing(previous: &[Note], chord: &Chord, length: Ticks, settings: &PreviewSettings) -> Vec<Note> {
    let prev: Vec<u8> = previous.iter().map(|n| n.pitch).collect();
    if prev.is_empty() {
        return default_voicing(chord, length, settings, chord.root);
    }
    // Disposición abierta: se conserva la forma y solo se elige la octava que menos se mueve.
    if uses_open(chord, settings.style) {
        let base = default_voicing(chord, length, settings, chord.root);
        return [-12, 0, 12]
            .into_iter()
            .map(|shift| transpose(base.clone(), shift))
            .min_by(|a, b| {
                let pa: Vec<u8> = a.iter().map(|n| n.pitch).collect();
                let pb: Vec<u8> = b.iter().map(|n| n.pitch).collect();
                movement_cost(&prev, &pa).total_cmp(&movement_cost(&prev, &pb))
            })
            .unwrap_or(base);
    }
    // Clases de altura del acorde en orden (fundamental, luego intervalos), sin repetir.
    let mut tones: Vec<u8> = Vec::new();
    for iv in std::iter::once(0).chain(chord.intervals.iter().copied()) {
        let pc = (chord.root.value() + iv) % 12;
        if !tones.contains(&pc) {
            tones.push(pc);
        }
    }
    let low = *prev.iter().min().unwrap() as i32;
    let mut best: Option<(f32, Vec<u8>)> = None;
    for inversion in 0..tones.len() {
        let rotated: Vec<u8> = tones[inversion..].iter().chain(&tones[..inversion]).copied().collect();
        for base in (low - 12)..=(low + 12) {
            if (base.rem_euclid(12)) as u8 != rotated[0] || !(24..=96).contains(&base) {
                continue;
            }
            // Apilar hacia arriba en posición cerrada.
            let mut pitches = vec![base as u8];
            for &pc in &rotated[1..] {
                let last = *pitches.last().unwrap() as i32;
                let mut p = last + 1;
                while (p.rem_euclid(12)) as u8 != pc {
                    p += 1;
                }
                pitches.push(p as u8);
            }
            let cost = movement_cost(&prev, &pitches);
            if best.as_ref().is_none_or(|(c, _)| cost < *c) {
                best = Some((cost, pitches));
            }
        }
    }
    let pitches = best.map(|(_, p)| p).unwrap_or_default();
    let notes = pitches.into_iter().map(|p| Note::new(0, length, p, settings.velocity)).collect();
    strum(notes, settings.strumming)
}

/// Adapta un voicing a una nueva duración: las notas que sostenían hasta el final siguen
/// haciéndolo; las que empiezan después del nuevo final desaparecen.
pub fn fit_voicing(voicing: &[Note], old_length: Ticks, new_length: Ticks) -> Vec<Note> {
    voicing
        .iter()
        .filter(|n| n.position < new_length)
        .map(|n| {
            let mut n = n.clone();
            if n.end() >= old_length || n.end() > new_length {
                n.length = new_length - n.position;
            }
            n
        })
        .collect()
}

/// Orden en que se tocan las notas del arpegio.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub enum ArpPattern {
    Up,
    Down,
    UpDown,
    DownUp,
    /// Al azar, pero siempre igual para el mismo acorde (no cambia al reproducir otra vez).
    Random,
}

/// Cómo arpegiar un acorde.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export))]
pub struct Arpeggio {
    pub pattern: ArpPattern,
    /// Distancia entre notas, en ticks (una corchea = `EIGHTH`).
    pub step: Ticks,
    /// Cuántas octavas recorre (1 a 3).
    pub octaves: u8,
    /// Cada nota sigue sonando hasta el final del acorde (como con pedal).
    pub hold: bool,
    /// La nota más grave queda sostenida todo el acorde y se arpegian las demás.
    pub keep_bass: bool,
}

impl Arpeggio {
    /// Valores dentro de rango: paso de al menos una fusa y de 1 a 3 octavas.
    pub fn sanitized(self) -> Self {
        Self { step: self.step.max(MIN_STRUM_LENGTH * 2), octaves: self.octaves.clamp(1, 3), ..self }
    }
}

/// Arpegia un voicing: sus alturas se reparten una tras otra cada `step` hasta llenar `length`.
pub fn arpeggiate(voicing: &[Note], length: Ticks, arp: &Arpeggio) -> Vec<Note> {
    let arp = arp.sanitized();
    let mut pitches: Vec<u8> = voicing.iter().map(|n| n.pitch).collect();
    pitches.sort_unstable();
    pitches.dedup();
    if pitches.is_empty() || length <= 0 {
        return Vec::new();
    }
    let velocity = voicing.iter().map(|n| n.velocity).sum::<f32>() / voicing.len() as f32;
    let mut out = Vec::new();
    if arp.keep_bass && pitches.len() > 1 {
        out.push(Note::new(0, length, pitches.remove(0), velocity));
    }
    let base = pitches.clone();
    for o in 1..arp.octaves {
        pitches.extend(base.iter().map(|&p| p + 12 * o).filter(|&p| p <= 127));
    }
    let up = pitches.clone();
    let down: Vec<u8> = up.iter().rev().copied().collect();
    let inner = |v: &[u8]| if v.len() > 2 { v[1..v.len() - 1].to_vec() } else { Vec::new() };
    let cycle: Vec<u8> = match arp.pattern {
        ArpPattern::Up | ArpPattern::Random => up.clone(),
        ArpPattern::Down => down.clone(),
        ArpPattern::UpDown => [up.clone(), inner(&down)].concat(),
        ArpPattern::DownUp => [down.clone(), inner(&up)].concat(),
    };
    // Generador fijo a partir de las notas: el «azar» se repite igual en cada reproducción.
    let mut seed: u32 = cycle.iter().fold(2166136261u32, |h, &p| (h ^ p as u32).wrapping_mul(16777619));
    let mut previous: Option<usize> = None;
    let mut k = 0usize;
    let mut t = 0;
    while t < length {
        let index = if arp.pattern == ArpPattern::Random && cycle.len() > 1 {
            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
            let mut i = (seed >> 16) as usize % cycle.len();
            if Some(i) == previous {
                i = (i + 1) % cycle.len();
            }
            i
        } else {
            k % cycle.len()
        };
        previous = Some(index);
        let accent = if k % cycle.len() == 0 { 0.08 } else { 0.0 };
        let note_length = if arp.hold { length - t } else { arp.step.min(length - t) };
        out.push(Note::new(t, note_length, cycle[index], (velocity + accent).min(1.0)));
        k += 1;
        t += arp.step;
    }
    out
}

/// Arpegia notas sueltas (las seleccionadas en un piano roll), como la herramienta de FL Studio:
/// las que empiezan juntas (a menos de una fusa) forman un acorde, y cada acorde se arpegia
/// hasta que termina su nota más larga o empieza el siguiente. Posiciones absolutas.
pub fn arpeggiate_notes(notes: &[Note], arp: &Arpeggio) -> Vec<Note> {
    let mut sorted = notes.to_vec();
    sorted.sort_by_key(|n| (n.position, n.pitch));
    let mut out = Vec::new();
    let mut i = 0;
    while i < sorted.len() {
        let start = sorted[i].position;
        let mut j = i;
        while j < sorted.len() && sorted[j].position - start < crate::time::THIRTY_SECOND {
            j += 1;
        }
        let group = &sorted[i..j];
        let mut end = group.iter().map(Note::end).max().unwrap_or(start);
        if let Some(next) = sorted.get(j) {
            end = end.min(next.position);
        }
        let relative: Vec<Note> = group.iter().map(|n| Note { position: 0, ..n.clone() }).collect();
        out.extend(arpeggiate(&relative, end - start, arp).into_iter().map(|n| Note { position: n.position + start, ..n }));
        i = j;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn arpegiar_notas_sueltas_por_acordes() {
        use crate::time::{HALF, WHOLE};
        // Do mayor (un compás) y luego Fa mayor (medio compás), con la tercera un poco tarde.
        let notes = vec![
            Note::new(0, WHOLE, 60, 0.8),
            Note::new(0, WHOLE, 64, 0.8),
            Note::new(20, WHOLE - 20, 67, 0.8),
            Note::new(WHOLE, HALF, 65, 0.8),
            Note::new(WHOLE, HALF, 69, 0.8),
            Note::new(WHOLE, HALF, 72, 0.8),
        ];
        let out = arpeggiate_notes(&notes, &Arpeggio { pattern: ArpPattern::Up, step: crate::time::EIGHTH, octaves: 1, hold: false, keep_bass: false });
        let first: Vec<u8> = out.iter().filter(|n| n.position < WHOLE).map(|n| n.pitch).collect();
        let second: Vec<u8> = out.iter().filter(|n| n.position >= WHOLE).map(|n| n.pitch).collect();
        assert_eq!(first, [60, 64, 67, 60, 64, 67, 60, 64]);
        assert_eq!(second, [65, 69, 72, 65]);
        assert!(out.iter().all(|n| n.end() <= WHOLE || n.position >= WHOLE), "no pisa el acorde siguiente");
    }

    fn arp(pattern: ArpPattern) -> Arpeggio {
        Arpeggio { pattern, step: crate::time::EIGHTH, octaves: 1, hold: false, keep_bass: false }
    }

    #[test]
    fn arpegios_basicos() {
        let block = vec![Note::new(0, 9, 60, 0.8), Note::new(0, 9, 64, 0.8), Note::new(0, 9, 67, 0.8)];
        let len = crate::time::HALF; // 4 corcheas
        let pitches = |a: Arpeggio| arpeggiate(&block, len, &a).iter().map(|n| n.pitch).collect::<Vec<_>>();
        assert_eq!(pitches(arp(ArpPattern::Up)), [60, 64, 67, 60]);
        assert_eq!(pitches(arp(ArpPattern::Down)), [67, 64, 60, 67]);
        assert_eq!(pitches(arp(ArpPattern::UpDown)), [60, 64, 67, 64]);
        assert_eq!(pitches(Arpeggio { octaves: 2, ..arp(ArpPattern::Up) }), [60, 64, 67, 72]);
        // Bajo sostenido: el Do dura todo el acorde y se arpegian Mi y Sol.
        let held = arpeggiate(&block, len, &Arpeggio { keep_bass: true, ..arp(ArpPattern::Up) });
        assert_eq!((held[0].pitch, held[0].length), (60, len));
        assert_eq!(held[1..].iter().map(|n| n.pitch).collect::<Vec<_>>(), [64, 67, 64, 67]);
        // Con pedal cada nota suena hasta el final.
        assert!(arpeggiate(&block, len, &Arpeggio { hold: true, ..arp(ArpPattern::Up) }).iter().all(|n| n.end() == len));
        // El azar es siempre el mismo y no repite la misma nota seguida.
        let random = pitches(arp(ArpPattern::Random));
        assert_eq!(random, pitches(arp(ArpPattern::Random)));
        assert!(random.windows(2).all(|w| w[0] != w[1]));
    }
    use crate::time::WHOLE;

    #[test]
    fn posicion_cerrada() {
        let notes = chord_to_notes(&Chord::major7(PitchClass::D), WHOLE, 1.0);
        let pitches: Vec<u8> = notes.iter().map(|n| n.pitch).collect();
        assert_eq!(pitches, vec![2, 6, 9, 13]);
        assert!(notes.iter().all(|n| n.position == 0 && n.length == WHOLE));
    }

    #[test]
    fn rasgueo_respeta_minimo() {
        let notes = strum(chord_to_notes(&Chord::major(PitchClass::C), WHOLE, 1.0), 6000);
        assert_eq!(notes.iter().map(|n| n.position).collect::<Vec<_>>(), vec![0, 6000, 12000]);
        assert_eq!(notes.iter().map(|n| n.length).collect::<Vec<_>>(), vec![WHOLE, WHOLE - 6000, MIN_STRUM_LENGTH]);
    }

    #[test]
    fn voicing_por_defecto_cerca_de_la_tonica() {
        let settings = PreviewSettings::default();
        // En Mi mayor, La (9) está por encima de Mi (4): se queda en la octava 3.
        let a = default_voicing(&Chord::major(PitchClass::A), WHOLE, &settings, PitchClass::E);
        assert_eq!(a[0].pitch, 57);
        // Do (0) está por debajo de Mi: sube una octava.
        let c = default_voicing(&Chord::major(PitchClass::C), WHOLE, &settings, PitchClass::E);
        assert_eq!(c[0].pitch, 60);
        assert_eq!(c.iter().map(|n| n.pitch).collect::<Vec<_>>(), vec![60, 64, 67]);
        assert!((c[0].velocity - 0.8).abs() < 1e-6);
    }

    fn pitches(notes: &[Note]) -> Vec<u8> {
        notes.iter().map(|n| n.pitch).collect()
    }

    #[test]
    fn disposicion_abierta() {
        let s = PreviewSettings::default(); // estilo Auto, octava 3
        let c = PitchClass::C;
        // C9 = Do Mi Sol Si♭ Re: sin quinta (5 notas), bajo Do2 y mano derecha Mi3 Si♭3 Re4.
        let c9 = Chord::new(c, [4, 7, 10, 14]);
        assert_eq!(pitches(&default_voicing(&c9, WHOLE, &s, c)), vec![36, 52, 58, 62]);
        // C11 dominante: la 11ª choca con la 3ª mayor → se omite la tercera.
        let c11 = Chord::new(c, [4, 7, 10, 14, 17]);
        assert_eq!(pitches(&default_voicing(&c11, WHOLE, &s, c)), vec![36, 58, 62, 65]);
        // Cm11 conserva la tercera menor.
        let cm11 = Chord::new(c, [3, 7, 10, 14, 17]);
        assert_eq!(pitches(&default_voicing(&cm11, WHOLE, &s, c)), vec![36, 51, 58, 62, 65]);
        // Cadd9 (4 notas) conserva la quinta: Do2 Sol2 Mi3 Re4.
        let cadd9 = Chord::new(c, [4, 7, 14]);
        assert_eq!(pitches(&default_voicing(&cadd9, WHOLE, &s, c)), vec![36, 43, 52, 62]);
        // G13 en Do: Sol2 | Si3 Fa4 La4 Mi5.
        let g13 = Chord::new(PitchClass::G, [4, 7, 10, 14, 21]);
        assert_eq!(pitches(&default_voicing(&g13, WHOLE, &s, c)), vec![43, 59, 65, 69, 76]);
    }

    #[test]
    fn estilos_de_voicing() {
        let triad = Chord::major(PitchClass::C);
        let auto = PreviewSettings::default();
        let open = PreviewSettings { style: VoicingStyle::Open, ..auto };
        let closed = PreviewSettings { style: VoicingStyle::Closed, ..auto };
        assert_eq!(pitches(&default_voicing(&triad, WHOLE, &auto, PitchClass::C)), vec![48, 52, 55]);
        assert_eq!(pitches(&default_voicing(&triad, WHOLE, &open, PitchClass::C)), vec![36, 43, 52]);
        let c9 = Chord::new(PitchClass::C, [4, 7, 10, 14]);
        assert_eq!(pitches(&default_voicing(&c9, WHOLE, &closed, PitchClass::C)), vec![48, 52, 55, 58, 62]);
        // Los proyectos sin `style` se leen con el valor por defecto.
        let old: PreviewSettings = serde_json::from_str(r#"{"octave":3,"strumming":0,"velocity":0.8}"#).unwrap();
        assert_eq!(old.style, VoicingStyle::Auto);
    }

    #[test]
    fn voicing_suave_mueve_poco() {
        let settings = PreviewSettings::default();
        let c = default_voicing(&Chord::major(PitchClass::C), WHOLE, &settings, PitchClass::C); // 48 52 55
        let f = smooth_voicing(&c, &Chord::major(PitchClass::F), WHOLE, &settings);
        let pitches: Vec<u8> = f.iter().map(|n| n.pitch).collect();
        // Do mayor → Fa mayor en segunda inversión (Do-Fa-La): Do se queda, las otras suben poco.
        assert_eq!(pitches, vec![48, 53, 57]);
        let g = smooth_voicing(&f, &Chord::major(PitchClass::G), WHOLE, &settings);
        let moved: i32 = g.iter().zip(&f).map(|(a, b)| (a.pitch as i32 - b.pitch as i32).abs()).sum();
        assert!(moved <= 6, "movimiento {moved}: {:?}", g.iter().map(|n| n.pitch).collect::<Vec<_>>());
    }

    #[test]
    fn ajustar_duracion() {
        let v = strum(chord_to_notes(&Chord::major(PitchClass::C), WHOLE, 1.0), 4000);
        let fitted = fit_voicing(&v, WHOLE, 5184);
        assert_eq!(fitted.len(), 2); // la tercera nota empezaba en 8000
        assert!(fitted.iter().all(|n| n.end() == 5184));
        let longer = fit_voicing(&v, WHOLE, 2 * WHOLE);
        assert!(longer.iter().all(|n| n.end() == 2 * WHOLE));
    }
}
