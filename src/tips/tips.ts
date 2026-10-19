// Tips educativos: se abren con clic derecho sobre cualquier elemento con `data-tip`.
// Cada tip tiene texto (es/en), un visual y, opcionalmente, un ejemplo sonoro.

import { chordsSequence, melodySequence, type SequenceNote } from "../api";
import { scaleSteps } from "../lib/music";

export type TipVisual =
  | { kind: "gravity"; focus: "tonic" | "subdominant" | "dominant" | null }
  | { kind: "mode"; scale: string }
  | { kind: "third" }
  | { kind: "roles" }
  | { kind: "arcs" }
  | { kind: "circle" }
  | { kind: "borrow" }
  | { kind: "tension" }
  | { kind: "voices" };

type Text = { title: string; kicker: string; mood: string[]; body: string; useWhen: string[]; examples?: string };

export type Tip = {
  visual: TipVisual;
  es: Text;
  en: Text;
  sound?: () => SequenceNote[];
};

const C = [60, 64, 67];
const scaleFromC = (name: string) => {
  const out = [60];
  for (const step of scaleSteps(name)) out.push(out[out.length - 1] + step);
  return out.slice(0, 8);
};
const modeSound = (name: string) => () => {
  const s = scaleFromC(name);
  const scale = melodySequence(s);
  const tonic = [s[0], s[2], s[4]];
  return [...scale, ...chordsSequence([tonic], 1.2).map((n) => ({ ...n, delay: n.delay + s.length * 0.28 + 0.2 }))];
};

/** Qué tan luminoso es cada modo (7 = el más brillante). */
export const BRIGHTNESS: Record<string, number> = {
  lydian: 7,
  ionian: 6,
  major: 6,
  mixolydian: 5,
  dorian: 4,
  melodicMinor: 4,
  aeolian: 3,
  minor: 3,
  harmonicMinor: 3,
  phrygian: 2,
  locrian: 1,
};

/** La nota que da carácter al modo (semitonos sobre la tónica). */
export const CHARACTERISTIC: Record<string, number> = {
  ionian: 11,
  major: 11,
  dorian: 9,
  phrygian: 1,
  lydian: 6,
  mixolydian: 10,
  aeolian: 8,
  minor: 8,
  locrian: 6,
  harmonicMinor: 11,
  melodicMinor: 9,
};

const majorText = {
  es: {
    title: "Mayor (jónico)",
    kicker: "Luminoso y estable",
    mood: ["alegre", "brillante", "seguro", "resuelto"],
    body: "La escala de referencia de casi toda la música occidental. Su tercera mayor suena abierta y su séptima (la sensible) está a un semitono de la tónica, por eso todo «vuelve a casa» con mucha claridad.",
    useWhen: ["Quieres un tono optimista o triunfal", "Estribillos que celebran", "Finales felices y música infantil"],
    examples: "La mayoría del pop; himnos; «Do-Re-Mi».",
  },
  en: {
    title: "Major (Ionian)",
    kicker: "Bright and stable",
    mood: ["happy", "bright", "confident", "resolved"],
    body: "The reference scale of most Western music. Its major third sounds open and its seventh (the leading tone) sits a half step below the tonic, so everything 'comes home' very clearly.",
    useWhen: ["You want an optimistic or triumphant tone", "Celebratory choruses", "Happy endings and children's music"],
    examples: "Most pop songs; anthems; 'Do-Re-Mi'.",
  },
};

const minorText = {
  es: {
    title: "Menor natural (eólico)",
    kicker: "Melancólico e introspectivo",
    mood: ["triste", "nostálgico", "serio", "épico"],
    body: "Igual que la mayor pero con 3ª, 6ª y 7ª bajadas. La sexta menor (♭6) le da ese peso emocional. Sin sensible, sus cadencias son más suaves; por eso a menudo se toma prestado el V mayor de la menor armónica.",
    useWhen: ["Baladas tristes o reflexivas", "Música épica y cinematográfica", "Contrastar un verso oscuro con un estribillo mayor"],
    examples: "Mucho rock y pop melancólico; bandas sonoras dramáticas.",
  },
  en: {
    title: "Natural minor (Aeolian)",
    kicker: "Melancholic and introspective",
    mood: ["sad", "nostalgic", "serious", "epic"],
    body: "Like major but with lowered 3rd, 6th and 7th. The minor sixth (♭6) gives it its emotional weight. With no leading tone its cadences are softer, so the major V is often borrowed from harmonic minor.",
    useWhen: ["Sad or reflective ballads", "Epic, cinematic music", "Contrasting a dark verse with a major chorus"],
    examples: "Lots of melancholic rock and pop; dramatic film scores.",
  },
};

export const TIPS: Record<string, Tip> = {
  "function.tonic": {
    visual: { kind: "gravity", focus: "tonic" },
    sound: () => chordsSequence([C, [57, 60, 64], C]),
    es: {
      title: "Tónica",
      kicker: "La casa: reposo",
      mood: ["calma", "llegada", "estabilidad", "resolución"],
      body: "Es el centro de gravedad de la tonalidad. Acordes con función de tónica: I (el principal), vi y iii, que comparten casi todas sus notas con él. Nada «empuja» desde aquí: puedes ir a cualquier parte.",
      useWhen: ["Empezar y terminar una canción o una frase", "Dar sensación de hogar tras un pasaje tenso", "Mantener un ambiente tranquilo (alternar I y vi)"],
    },
    en: {
      title: "Tonic",
      kicker: "Home: rest",
      mood: ["calm", "arrival", "stability", "resolution"],
      body: "The center of gravity of the key. Chords with tonic function: I (the main one), vi and iii, which share most of their notes with it. Nothing 'pushes' from here: you can go anywhere.",
      useWhen: ["Starting and ending a song or phrase", "A sense of home after a tense passage", "Keeping a calm mood (alternate I and vi)"],
    },
  },
  "function.subdominant": {
    visual: { kind: "gravity", focus: "subdominant" },
    sound: () => chordsSequence([C, [53, 57, 60], [50, 53, 57], C]),
    es: {
      title: "Subdominante",
      kicker: "Salir de casa: movimiento",
      mood: ["apertura", "anhelo", "nostalgia", "anticipación suave"],
      body: "Aleja la música de la tónica sin crear todavía mucha tensión. Acordes típicos: IV y ii (y prestados como iv menor, ♭VI y ♭VII, que suenan más nostálgicos o épicos). Suele preparar la dominante.",
      useWhen: ["Abrir el camino tras la tónica", "Cadencia «amén» suave: IV → I", "Dar emoción sin dramatismo (el iv menor es muy emotivo)"],
    },
    en: {
      title: "Subdominant",
      kicker: "Leaving home: motion",
      mood: ["opening", "longing", "nostalgia", "gentle anticipation"],
      body: "Moves the music away from the tonic without much tension yet. Typical chords: IV and ii (plus borrowed iv minor, ♭VI and ♭VII, which sound more nostalgic or epic). It usually prepares the dominant.",
      useWhen: ["Opening the way after the tonic", "Soft 'amen' cadence: IV → I", "Emotion without drama (minor iv is very moving)"],
    },
  },
  "function.dominant": {
    visual: { kind: "gravity", focus: "dominant" },
    sound: () => chordsSequence([[53, 57, 60], [55, 59, 62, 65], C]),
    es: {
      title: "Dominante",
      kicker: "Tensión que pide volver",
      mood: ["suspenso", "expectativa", "urgencia", "inestabilidad"],
      body: "Contiene la sensible (la nota a un semitono de la tónica) y, en el V7, un tritono que «quiere» resolverse. Acordes: V, V7 y vii°. Cuanto más tiempo la sostienes, más satisfactoria es la llegada a la tónica.",
      useWhen: ["Justo antes de volver a la tónica (cadencia V → I)", "Crear suspenso al final de una sección", "Dominantes secundarias (A7 → Dm) para empujar hacia otros acordes"],
    },
    en: {
      title: "Dominant",
      kicker: "Tension that wants to return",
      mood: ["suspense", "expectation", "urgency", "instability"],
      body: "It contains the leading tone (a half step below the tonic) and, in V7, a tritone that 'wants' to resolve. Chords: V, V7 and vii°. The longer you hold it, the more satisfying the arrival home.",
      useWhen: ["Right before returning to the tonic (V → I cadence)", "Building suspense at the end of a section", "Secondary dominants (A7 → Dm) to push toward other chords"],
    },
  },
  "mode.major": { visual: { kind: "mode", scale: "major" }, sound: modeSound("major"), ...majorText },
  "mode.ionian": { visual: { kind: "mode", scale: "ionian" }, sound: modeSound("ionian"), ...majorText },
  "mode.minor": { visual: { kind: "mode", scale: "minor" }, sound: modeSound("minor"), ...minorText },
  "mode.aeolian": { visual: { kind: "mode", scale: "aeolian" }, sound: modeSound("aeolian"), ...minorText },
  "mode.dorian": {
    visual: { kind: "mode", scale: "dorian" },
    sound: modeSound("dorian"),
    es: {
      title: "Dórico",
      kicker: "Menor con esperanza",
      mood: ["melancolía luminosa", "groove", "misterio", "elegancia"],
      body: "Es menor, pero su sexta es mayor (en Do dórico: La natural). Esa nota quita peso y da un aire «cool», menos trágico que el eólico. Su acorde más característico es el IV mayor dentro de un contexto menor (Dm → G).",
      useWhen: ["Funk, soul, jazz modal y rock latino", "Melodías menores que no quieres que suenen tristes", "Vamps de dos acordes: i → IV"],
      examples: "«Oye como va», «Scarborough Fair», mucho funk.",
    },
    en: {
      title: "Dorian",
      kicker: "Minor with hope",
      mood: ["bright melancholy", "groove", "mystery", "elegance"],
      body: "It's minor, but its sixth is major (in C Dorian: A natural). That note lifts the weight and gives a 'cool' feel, less tragic than Aeolian. Its signature chord is the major IV in a minor context (Dm → G).",
      useWhen: ["Funk, soul, modal jazz and Latin rock", "Minor melodies you don't want to sound sad", "Two-chord vamps: i → IV"],
      examples: "'Oye como va', 'Scarborough Fair', lots of funk.",
    },
  },
  "mode.phrygian": {
    visual: { kind: "mode", scale: "phrygian" },
    sound: modeSound("phrygian"),
    es: {
      title: "Frigio",
      kicker: "Oscuro y exótico",
      mood: ["tensión", "drama", "aire español", "amenaza"],
      body: "Menor con la segunda bajada (♭2): la nota justo encima de la tónica crea un roce intenso. El movimiento ♭II → i suena a flamenco y a metal. Su pariente, el frigio dominante, es la base de la cadencia andaluza.",
      useWhen: ["Flamenco y música con aire mediterráneo", "Metal y bandas sonoras amenazantes", "Riffs que giran alrededor de la tónica y su ♭2"],
      examples: "Cadencia andaluza (Am–G–F–E), muchos riffs de metal.",
    },
    en: {
      title: "Phrygian",
      kicker: "Dark and exotic",
      mood: ["tension", "drama", "Spanish flavor", "menace"],
      body: "Minor with a lowered second (♭2): the note right above the tonic creates an intense rub. The ♭II → i move sounds like flamenco and metal. Its relative, Phrygian dominant, underlies the Andalusian cadence.",
      useWhen: ["Flamenco and Mediterranean-flavored music", "Metal and menacing film music", "Riffs that orbit the tonic and its ♭2"],
      examples: "Andalusian cadence (Am–G–F–E), many metal riffs.",
    },
  },
  "mode.lydian": {
    visual: { kind: "mode", scale: "lydian" },
    sound: modeSound("lydian"),
    es: {
      title: "Lidio",
      kicker: "Soñador y flotante",
      mood: ["asombro", "magia", "ingravidez", "optimismo etéreo"],
      body: "El más brillante de los modos: mayor con la cuarta elevada (♯4). Esa nota elimina la «atracción» hacia la subdominante y hace que todo parezca suspendido en el aire. Acorde típico: II mayor (C → D).",
      useWhen: ["Bandas sonoras de fantasía, vuelo o descubrimiento", "Momentos de asombro en un estribillo", "Sonidos de sueño y ciencia ficción"],
      examples: "Muchas bandas sonoras de cine fantástico y videojuegos.",
    },
    en: {
      title: "Lydian",
      kicker: "Dreamy and floating",
      mood: ["wonder", "magic", "weightlessness", "ethereal optimism"],
      body: "The brightest mode: major with a raised fourth (♯4). That note removes the 'pull' toward the subdominant and makes everything feel suspended in the air. Signature chord: major II (C → D).",
      useWhen: ["Fantasy, flying or discovery soundtracks", "Moments of wonder in a chorus", "Dreamy and sci-fi sounds"],
      examples: "Many fantasy film and video game scores.",
    },
  },
  "mode.mixolydian": {
    visual: { kind: "mode", scale: "mixolydian" },
    sound: modeSound("mixolydian"),
    es: {
      title: "Mixolidio",
      kicker: "Mayor relajado y rockero",
      mood: ["despreocupado", "terrenal", "festivo", "bluesy"],
      body: "Mayor con la séptima bajada (♭7). Sin sensible, la vuelta a la tónica es más relajada. Su acorde estrella es el ♭VII mayor (Bb en Do): el clásico ♭VII → I del rock.",
      useWhen: ["Rock, blues, country y música celta", "Estribillos enérgicos que no quieres que suenen «de manual»", "Riffs sobre un acorde dominante (C7)"],
      examples: "Muchos clásicos del rock; gaitas y música folk.",
    },
    en: {
      title: "Mixolydian",
      kicker: "Laid-back, rocking major",
      mood: ["carefree", "earthy", "festive", "bluesy"],
      body: "Major with a lowered seventh (♭7). With no leading tone, returning to the tonic is more relaxed. Its star chord is the major ♭VII (Bb in C): rock's classic ♭VII → I.",
      useWhen: ["Rock, blues, country and Celtic music", "Energetic choruses that shouldn't sound 'textbook'", "Riffs over a dominant chord (C7)"],
      examples: "Many rock classics; bagpipes and folk.",
    },
  },
  "mode.locrian": {
    visual: { kind: "mode", scale: "locrian" },
    sound: modeSound("locrian"),
    es: {
      title: "Locrio",
      kicker: "Inestable e inquietante",
      mood: ["inquietud", "vértigo", "extrañeza", "oscuridad"],
      body: "El modo más oscuro: su tónica es un acorde disminuido (quinta bajada, ♭5), así que nunca suena del todo «en casa». Se usa más como color que como tonalidad.",
      useWhen: ["Momentos de terror o desorientación", "Pasajes cortos de tensión en metal", "Sobre un acorde semidisminuido (ø7) en jazz"],
    },
    en: {
      title: "Locrian",
      kicker: "Unstable and unsettling",
      mood: ["unease", "vertigo", "strangeness", "darkness"],
      body: "The darkest mode: its tonic is a diminished chord (lowered fifth, ♭5), so it never quite feels 'at home'. It's used more as a color than as a key.",
      useWhen: ["Moments of horror or disorientation", "Short tense passages in metal", "Over a half-diminished chord (ø7) in jazz"],
    },
  },
  "mode.harmonicMinor": {
    visual: { kind: "mode", scale: "harmonicMinor" },
    sound: modeSound("harmonicMinor"),
    es: {
      title: "Menor armónica",
      kicker: "Dramática y clásica",
      mood: ["drama", "pasión", "misterio", "aire oriental"],
      body: "Menor natural con la séptima elevada: aparece la sensible y el V se vuelve mayor (E en La menor), con una cadencia V → i muy potente. El salto entre ♭6 y 7 (segunda aumentada) le da su sabor exótico.",
      useWhen: ["Cadencias fuertes en tonalidad menor", "Música clásica, tango y neoclásico", "Melodías con aire de Oriente Medio"],
    },
    en: {
      title: "Harmonic minor",
      kicker: "Dramatic and classical",
      mood: ["drama", "passion", "mystery", "Eastern flavor"],
      body: "Natural minor with a raised seventh: the leading tone appears and V becomes major (E in A minor), with a very strong V → i cadence. The jump between ♭6 and 7 (augmented second) gives its exotic taste.",
      useWhen: ["Strong cadences in a minor key", "Classical, tango and neoclassical", "Middle-Eastern flavored melodies"],
    },
  },
  "mode.melodicMinor": {
    visual: { kind: "mode", scale: "melodicMinor" },
    sound: modeSound("melodicMinor"),
    es: {
      title: "Menor melódica",
      kicker: "Menor elegante y jazzística",
      mood: ["sofisticación", "suavidad", "ambigüedad", "elegancia"],
      body: "Menor con la sexta y la séptima elevadas: el comienzo es menor y el final, mayor. Suaviza el salto de la menor armónica y es una fuente enorme de acordes en jazz.",
      useWhen: ["Líneas melódicas menores que suben hacia la tónica", "Jazz y bossa nova", "Sonidos menores sin dramatismo"],
    },
    en: {
      title: "Melodic minor",
      kicker: "Elegant, jazzy minor",
      mood: ["sophistication", "smoothness", "ambiguity", "elegance"],
      body: "Minor with raised sixth and seventh: it starts minor and ends major. It smooths out harmonic minor's jump and is a huge source of jazz chords.",
      useWhen: ["Minor melodic lines rising to the tonic", "Jazz and bossa nova", "Minor sounds without drama"],
    },
  },
  "concept.majorMinor": {
    visual: { kind: "third" },
    sound: () => chordsSequence([C, [60, 63, 67], C, [60, 63, 67]], 1),
    es: {
      title: "Mayor y menor",
      kicker: "Una sola nota cambia la emoción",
      mood: ["mayor: luz", "menor: sombra"],
      body: "La diferencia entre un acorde mayor y uno menor es su tercera: 4 semitonos (mayor) o 3 (menor). Escúchalo: Do–Mi–Sol suena abierto; Do–Mi♭–Sol, más íntimo y triste. Lo mismo vale para escalas y tonalidades enteras.",
      useWhen: ["Mayor: alegría, energía, certeza", "Menor: tristeza, introspección, drama", "Mezclarlas (préstamo modal) para emociones agridulces"],
    },
    en: {
      title: "Major and minor",
      kicker: "One note changes the emotion",
      mood: ["major: light", "minor: shadow"],
      body: "The difference between a major and a minor chord is its third: 4 half steps (major) or 3 (minor). Listen: C–E–G sounds open; C–E♭–G, more intimate and sad. The same holds for whole scales and keys.",
      useWhen: ["Major: joy, energy, certainty", "Minor: sadness, introspection, drama", "Mixing them (modal borrowing) for bittersweet emotions"],
    },
  },
  "concept.roles": {
    visual: { kind: "roles" },
    sound: () => [...chordsSequence([C], 2.4).map((n) => ({ ...n, velocity: 0.45 })), ...melodySequence([72, 74, 76, 77, 79, 78, 79], 0.32)],
    es: {
      title: "El color de las filas",
      kicker: "Qué nota elegir para la melodía",
      mood: ["brillante = estable", "tenue = de paso", "rayado = fuera"],
      body: "Cada fila se ilumina según el acorde que suena en ese momento. Las notas del acorde (brillantes) suenan «dentro» y estables; las de la escala (tenues) crean movimiento y conviene que lleguen a una nota del acorde; las de fuera de la escala (rayadas, en rojo) son cromáticas: dan color o tensión fuerte.",
      useWhen: ["Notas largas y finales de frase: notas del acorde", "Notas cortas entre medias: notas de la escala", "Adornos y tensión: cromáticas, de paso y resolviendo"],
    },
    en: {
      title: "Row colors",
      kicker: "Which note to choose for the melody",
      mood: ["bright = stable", "dim = passing", "hatched = outside"],
      body: "Each row lights up according to the chord playing at that moment. Chord tones (bright) sound 'inside' and stable; scale tones (dim) create motion and should land on a chord tone; out-of-scale notes (hatched, red) are chromatic: color or strong tension.",
      useWhen: ["Long notes and phrase endings: chord tones", "Short in-between notes: scale tones", "Ornaments and tension: chromatic, passing and resolving"],
    },
  },
  "concept.transitions": {
    visual: { kind: "arcs" },
    sound: () => chordsSequence([[55, 59, 62], C, [53, 57, 60], [52, 55, 59]], 0.9),
    es: {
      title: "Arcos de transición",
      kicker: "¿Qué tan fuerte es cada paso?",
      mood: ["arco brillante = fuerte", "tenue = aceptable", "punteado = sorpresa"],
      body: "Entre acorde y acorde, Tonalia evalúa el movimiento de las fundamentales con reglas de armonía tonal: bajar una quinta (V → I, ii → V) es lo más fuerte; subir un tono o bajar una tercera también funciona; otros pasos no tienen respaldo y suenan sorprendentes (¡que no es malo!).",
      useWhen: ["Progresiones que «fluyen»: busca arcos brillantes", "Sorprender o cambiar de color: un arco punteado bien colocado", "Haz clic en un acorde y mira la rueda: sus arcos te sugieren el siguiente"],
    },
    en: {
      title: "Transition arcs",
      kicker: "How strong is each step?",
      mood: ["bright arc = strong", "dim = fine", "dotted = surprise"],
      body: "Between chords, Tonalia rates the root motion with tonal harmony rules: falling a fifth (V → I, ii → V) is strongest; rising a step or falling a third also works; other steps have no backing and sound surprising (which isn't bad!).",
      useWhen: ["Progressions that 'flow': look for bright arcs", "To surprise or change color: a well-placed dotted arc", "Click a chord and watch the wheel: its arcs suggest the next one"],
    },
  },
  "concept.circle": {
    visual: { kind: "circle" },
    sound: () => chordsSequence([[57, 60, 64], [50, 53, 57], [55, 59, 62], C], 0.9),
    es: {
      title: "El círculo de quintas",
      kicker: "El mapa de las tonalidades",
      mood: ["vecinos = parientes", "lejanos = contraste"],
      body: "Cada paso a la derecha sube una quinta (Do → Sol → Re…). Las tonalidades vecinas comparten 6 de sus 7 notas, por eso los acordes de una tonalidad forman un arco de 7 casillas seguidas. Recorrer el círculo hacia la izquierda (vi → ii → V → I) es el motor de muchísimas canciones.",
      useWhen: ["Encontrar acordes que suenan bien juntos (están cerca)", "Modular suavemente a una tonalidad vecina", "Progresiones por quintas: Am → Dm → G → C"],
    },
    en: {
      title: "The circle of fifths",
      kicker: "The map of keys",
      mood: ["neighbors = relatives", "far = contrast"],
      body: "Each step clockwise rises a fifth (C → G → D…). Neighboring keys share 6 of their 7 notes, so a key's chords form an arc of 7 adjacent slots. Moving counter-clockwise (vi → ii → V → I) drives countless songs.",
      useWhen: ["Finding chords that sound good together (they're close)", "Modulating smoothly to a neighbor key", "Fifth progressions: Am → Dm → G → C"],
    },
  },
  "concept.borrow": {
    visual: { kind: "borrow" },
    sound: () => chordsSequence([C, [56, 60, 63], [58, 62, 65], C], 1),
    es: {
      title: "Acordes prestados",
      kicker: "Colores de otra escala",
      mood: ["agridulce", "épico", "sorpresa emotiva"],
      body: "El préstamo modal toma acordes de un modo paralelo (misma tónica, otra escala). En Do mayor, los prestados de Do menor (Fm, A♭, B♭, E♭) añaden sombra y emoción sin cambiar de tonalidad. El anillo medio de la rueda los muestra.",
      useWhen: ["♭VI → ♭VII → I: final épico", "iv menor (Fm en Do): momento emotivo, casi nostálgico", "Elige el modo de origen en «Tomar prestado de» para explorar colores"],
    },
    en: {
      title: "Borrowed chords",
      kicker: "Colors from another scale",
      mood: ["bittersweet", "epic", "emotional surprise"],
      body: "Modal borrowing takes chords from a parallel mode (same tonic, another scale). In C major, chords borrowed from C minor (Fm, A♭, B♭, E♭) add shadow and emotion without changing key. The wheel's middle ring shows them.",
      useWhen: ["♭VI → ♭VII → I: epic ending", "Minor iv (Fm in C): an emotional, almost nostalgic moment", "Pick the source mode in 'Borrow from' to explore colors"],
    },
  },
  "concept.voices": {
    visual: { kind: "voices" },
    sound: () => chordsSequence([C, [60, 65, 69], [59, 62, 67], C], 0.9),
    es: {
      title: "Conducción de voces",
      kicker: "Que cada nota camine poco",
      mood: ["fluido", "conectado", "profesional"],
      body: "Un acorde es un grupo de voces (como un coro). Si cada voz se mueve lo menos posible al siguiente acorde —manteniendo las notas comunes y avanzando por pasos—, la progresión suena unida y suave. Por eso los pianistas usan inversiones en vez de saltar con la mano entera. «Suavizar» elige las inversiones por ti.",
      useWhen: ["Acompañamientos de piano o cuerdas que suenen profesionales", "Pads y coros: los saltos se notan mucho", "Ver por qué una progresión suena «a tirones»: busca líneas naranjas (saltos)"],
    },
    en: {
      title: "Voice leading",
      kicker: "Let every note walk a little",
      mood: ["flowing", "connected", "polished"],
      body: "A chord is a group of voices (like a choir). If each voice moves as little as possible to the next chord—keeping common tones and moving by step—the progression sounds connected and smooth. That's why pianists use inversions instead of jumping with the whole hand. 'Smooth' picks the inversions for you.",
      useWhen: ["Piano or string accompaniments that sound polished", "Pads and choirs: leaps are very noticeable", "Seeing why a progression sounds 'jerky': look for orange lines (leaps)"],
    },
  },
  "concept.tension": {
    visual: { kind: "tension" },
    sound: () => chordsSequence([C, [53, 57, 60, 64], [55, 59, 62, 65], [55, 59, 62, 65, 68], C], 0.8),
    es: {
      title: "Altura = tensión",
      kicker: "Cuánto «pide» moverse un acorde",
      mood: ["bajo = reposo", "alto = tensión"],
      body: "La altura de cada bloque en la cinta muestra su tensión: la función (tónica baja, dominante alta) más sus disonancias (tritono, séptimas, novenas alteradas, notas fuera de la escala). Una buena progresión suele subir y bajar como una ola.",
      useWhen: ["Construir un clímax: acordes cada vez más altos", "Relajar: volver a bloques bajos (tónica)", "Comparar dos versiones de una progresión de un vistazo"],
    },
    en: {
      title: "Height = tension",
      kicker: "How much a chord 'wants' to move",
      mood: ["low = rest", "high = tension"],
      body: "Each block's height on the ribbon shows its tension: its function (tonic low, dominant high) plus its dissonances (tritone, sevenths, altered ninths, out-of-key notes). A good progression often rises and falls like a wave.",
      useWhen: ["Building a climax: ever taller chords", "Relaxing: back to low blocks (tonic)", "Comparing two versions of a progression at a glance"],
    },
  },
};

/** Tip de un modo/escala por su identificador de escala. */
export const modeTipId = (scale: string) => `mode.${scale}`;
