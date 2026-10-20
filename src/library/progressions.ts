// Biblioteca de progresiones famosas. Cada acorde es [grado en semitonos, intervalos, compases].
// Se transportan a la tonalidad actual al escucharlas o añadirlas.

import type { Key } from "../bindings/Key";
import type { Notation } from "../bindings/Notation";
import type { SpelledNote } from "../bindings/SpelledNote";
import { isMinorLike, scaleOffsets, scaleSteps, spelledName } from "../lib/music";

export type LibChord = { deg: number; iv: number[]; bars?: number; roman: string };

type Text = { name: string; mood: string; desc: string };

/** Filtros de la biblioteca. */
export type Category = "pop" | "rock" | "jazz" | "classic" | "modal" | "world";
export const CATEGORIES: Category[] = ["pop", "rock", "jazz", "classic", "modal", "world"];

export type Progression = {
  id: string;
  /** Escala de la que sale (identificador de `scale.*`). */
  scale: string;
  category: Category;
  chords: LibChord[];
  es: Text;
  en: Text;
};

const M = [4, 7];
const m = [3, 7];
const D7 = [4, 7, 10];
const m7 = [3, 7, 10];
const maj7 = [4, 7, 11];
const aug = [4, 8];
const sus4 = [5, 7];
const five = [7];

export const PROGRESSIONS: Progression[] = [
  // ---------- Pop ----------
  {
    id: "axis",
    scale: "major",
    category: "pop",
    chords: [
      { deg: 0, iv: M, roman: "I" },
      { deg: 7, iv: M, roman: "V" },
      { deg: 9, iv: m, roman: "vi" },
      { deg: 5, iv: M, roman: "IV" },
    ],
    es: { name: "I – V – vi – IV", mood: "optimista, himno", desc: "La progresión del pop por excelencia: cientos de éxitos la usan. Empieza en casa, sube a la dominante, se tiñe de nostalgia con el vi y respira con el IV." },
    en: { name: "I – V – vi – IV", mood: "optimistic, anthemic", desc: "The quintessential pop progression, used by hundreds of hits. Home, up to the dominant, a touch of nostalgia with vi, and a breath with IV." },
  },
  {
    id: "sensitive",
    scale: "major",
    category: "pop",
    chords: [
      { deg: 9, iv: m, roman: "vi" },
      { deg: 5, iv: M, roman: "IV" },
      { deg: 0, iv: M, roman: "I" },
      { deg: 7, iv: M, roman: "V" },
    ],
    es: { name: "vi – IV – I – V", mood: "emotiva, introspectiva", desc: "Los mismos acordes que la anterior, pero empezando en el vi: la canción suena más melancólica y sensible desde el primer compás." },
    en: { name: "vi – IV – I – V", mood: "emotional, introspective", desc: "Same chords as the previous one, but starting on vi: the song sounds more melancholic and tender from the first bar." },
  },
  {
    id: "doowop",
    scale: "major",
    category: "pop",
    chords: [
      { deg: 0, iv: M, roman: "I" },
      { deg: 9, iv: m, roman: "vi" },
      { deg: 5, iv: M, roman: "IV" },
      { deg: 7, iv: M, roman: "V" },
    ],
    es: { name: "I – vi – IV – V (años 50)", mood: "nostálgica, dulce", desc: "La progresión del doo-wop y las baladas de los 50. Cada paso es suave y termina en la dominante, que empuja a repetir el ciclo." },
    en: { name: "I – vi – IV – V ('50s)", mood: "nostalgic, sweet", desc: "The progression of doo-wop and '50s ballads. Every step is smooth and it ends on the dominant, which pushes to repeat the cycle." },
  },
  {
    id: "royal",
    scale: "major",
    category: "pop",
    chords: [
      { deg: 5, iv: maj7, roman: "IVmaj7" },
      { deg: 7, iv: D7, roman: "V7" },
      { deg: 4, iv: m7, roman: "iii7" },
      { deg: 9, iv: m, roman: "vi" },
    ],
    es: { name: "IV – V – iii – vi («royal road»)", mood: "anhelante, cinematográfica", desc: "Muy usada en el pop japonés y en bandas sonoras de anime. Evita la tónica: sube por la subdominante y la dominante y cae en el vi, dejando un anhelo sin resolver." },
    en: { name: "IV – V – iii – vi ('royal road')", mood: "yearning, cinematic", desc: "Very common in J-pop and anime scores. It avoids the tonic: it rises through subdominant and dominant and falls onto vi, leaving an unresolved longing." },
  },
  {
    id: "minor-iv",
    scale: "major",
    category: "pop",
    chords: [
      { deg: 0, iv: M, roman: "I" },
      { deg: 5, iv: M, roman: "IV" },
      { deg: 5, iv: m, roman: "iv" },
      { deg: 0, iv: M, roman: "I" },
    ],
    es: { name: "I – IV – iv – I", mood: "agridulce, conmovedora", desc: "El IV se oscurece a iv menor (prestado de la tonalidad menor) justo antes de volver a casa. Un truco clásico para emocionar." },
    en: { name: "I – IV – iv – I", mood: "bittersweet, moving", desc: "IV darkens into minor iv (borrowed from the minor key) right before going home. A classic trick to move the listener." },
  },

  // ---------- Rock y blues ----------
  {
    id: "blues",
    scale: "major",
    category: "rock",
    chords: [
      { deg: 0, iv: D7, bars: 4, roman: "I7" },
      { deg: 5, iv: D7, bars: 2, roman: "IV7" },
      { deg: 0, iv: D7, bars: 2, roman: "I7" },
      { deg: 7, iv: D7, roman: "V7" },
      { deg: 5, iv: D7, roman: "IV7" },
      { deg: 0, iv: D7, roman: "I7" },
      { deg: 7, iv: D7, roman: "V7" },
    ],
    es: { name: "Blues de 12 compases", mood: "terrenal, con swing", desc: "La forma del blues: 12 compases con tres acordes de séptima de dominante. Todos son dominantes, así que la música nunca termina de reposar: es su encanto." },
    en: { name: "12-bar blues", mood: "earthy, swinging", desc: "The blues form: 12 bars with three dominant seventh chords. Every chord is a dominant, so the music never fully rests: that's its charm." },
  },
  {
    id: "minor-blues",
    scale: "minor",
    category: "rock",
    chords: [
      { deg: 0, iv: m7, bars: 4, roman: "i7" },
      { deg: 5, iv: m7, bars: 2, roman: "iv7" },
      { deg: 0, iv: m7, bars: 2, roman: "i7" },
      { deg: 8, iv: D7, roman: "♭VI7" },
      { deg: 7, iv: D7, roman: "V7" },
      { deg: 0, iv: m7, bars: 2, roman: "i7" },
    ],
    es: { name: "Blues menor", mood: "nocturno, dolido", desc: "Los mismos 12 compases en menor. El ♭VI7 que baja por semitono a la V7 es su momento más oscuro." },
    en: { name: "Minor blues", mood: "nocturnal, aching", desc: "The same 12 bars in minor. The ♭VI7 sliding down a half step to V7 is its darkest moment." },
  },
  {
    id: "mixo",
    scale: "mixolydian",
    category: "rock",
    chords: [
      { deg: 0, iv: M, roman: "I" },
      { deg: 10, iv: M, roman: "♭VII" },
      { deg: 5, iv: M, roman: "IV" },
      { deg: 0, iv: M, roman: "I" },
    ],
    es: { name: "Himno de estadio", mood: "rockera, despreocupada", desc: "El ♭VII del mixolidio da un aire de rock clásico y de himno de estadio. Sin sensible, la vuelta al I es relajada y poderosa a la vez." },
    en: { name: "Stadium anthem", mood: "rocking, carefree", desc: "Mixolydian's ♭VII gives a classic-rock, stadium-anthem feel. With no leading tone, the return to I is relaxed and powerful at once." },
  },
  {
    id: "power-riff",
    scale: "minorPentatonic",
    category: "rock",
    chords: [
      { deg: 0, iv: five, roman: "I5" },
      { deg: 3, iv: five, roman: "♭III5" },
      { deg: 5, iv: five, roman: "IV5" },
      { deg: 10, iv: five, roman: "♭VII5" },
    ],
    es: { name: "Riff de quintas", mood: "cruda, con fuerza", desc: "Acordes de quinta sola sobre la pentatónica menor: sin tercera no son ni mayores ni menores, solo potencia. La base de mil riffs de rock y metal." },
    en: { name: "Power-chord riff", mood: "raw, powerful", desc: "Bare fifths over the minor pentatonic: with no third they're neither major nor minor, just power. The basis of a thousand rock and metal riffs." },
  },

  // ---------- Jazz ----------
  {
    id: "251",
    scale: "major",
    category: "jazz",
    chords: [
      { deg: 2, iv: m7, roman: "ii7" },
      { deg: 7, iv: D7, roman: "V7" },
      { deg: 0, iv: maj7, bars: 2, roman: "Imaj7" },
    ],
    es: { name: "ii7 – V7 – Imaj7", mood: "sofisticada, cálida", desc: "El corazón del jazz: dos quintas descendentes seguidas (ii → V → I). Con séptimas suena rico y elegante." },
    en: { name: "ii7 – V7 – Imaj7", mood: "sophisticated, warm", desc: "The heart of jazz: two falling fifths in a row (ii → V → I). With sevenths it sounds rich and elegant." },
  },
  {
    id: "circle",
    scale: "major",
    category: "jazz",
    chords: [
      { deg: 9, iv: m7, roman: "vi7" },
      { deg: 2, iv: m7, roman: "ii7" },
      { deg: 7, iv: D7, roman: "V7" },
      { deg: 0, iv: maj7, roman: "Imaj7" },
    ],
    es: { name: "vi – ii – V – I (círculo)", mood: "fluida, irresistible", desc: "Tres quintas descendentes seguidas: cada acorde «cae» en el siguiente. En la rueda es recorrer el círculo de quintas hacia la izquierda hasta llegar a casa." },
    en: { name: "vi – ii – V – I (circle)", mood: "flowing, irresistible", desc: "Three falling fifths in a row: each chord 'falls' into the next. On the wheel it walks the circle of fifths counter-clockwise until reaching home." },
  },
  {
    id: "minor-251",
    scale: "minor",
    category: "jazz",
    chords: [
      { deg: 2, iv: [3, 6, 10], roman: "iiø7" },
      { deg: 7, iv: [4, 7, 10, 13], roman: "V7♭9" },
      { deg: 0, iv: m7, bars: 2, roman: "i7" },
    ],
    es: { name: "iiø7 – V7♭9 – i (en menor)", mood: "melancólica, elegante", desc: "El ii–V–i en menor: el ii se vuelve semidisminuido y la dominante suma la ♭9. Suena a bolero, bossa y standards nocturnos." },
    en: { name: "iiø7 – V7♭9 – i (minor)", mood: "melancholic, elegant", desc: "The minor ii–V–i: ii becomes half-diminished and the dominant adds ♭9. It sounds like boleros, bossa and late-night standards." },
  },
  {
    id: "dim-cycle",
    scale: "diminished",
    category: "jazz",
    chords: [
      { deg: 0, iv: D7, roman: "I7" },
      { deg: 3, iv: D7, roman: "♭III7" },
      { deg: 6, iv: D7, roman: "♯IV7" },
      { deg: 9, iv: D7, roman: "VI7" },
    ],
    es: { name: "Ciclo de terceras menores", mood: "tensa, vertiginosa", desc: "Cuatro dominantes a distancia de tercera menor: todas caben en la misma escala disminuida. Sube sin llegar a ningún lado, ideal para suspenso." },
    en: { name: "Minor-third cycle", mood: "tense, dizzying", desc: "Four dominants a minor third apart: they all fit the same diminished scale. It climbs without arriving anywhere, ideal for suspense." },
  },

  // ---------- Clásico ----------
  {
    id: "cadence",
    scale: "major",
    category: "classic",
    chords: [
      { deg: 0, iv: M, roman: "I" },
      { deg: 5, iv: M, roman: "IV" },
      { deg: 7, iv: M, roman: "V" },
      { deg: 0, iv: M, roman: "I" },
    ],
    es: { name: "I – IV – V – I", mood: "sencilla, firme", desc: "Tónica, subdominante, dominante y vuelta a casa: el recorrido funcional completo T → S → D → T. La base del folk, el country y el rock clásico." },
    en: { name: "I – IV – V – I", mood: "simple, solid", desc: "Tonic, subdominant, dominant and home again: the complete functional journey T → S → D → T. The basis of folk, country and classic rock." },
  },
  {
    id: "canon",
    scale: "major",
    category: "classic",
    chords: [
      { deg: 0, iv: M, roman: "I" },
      { deg: 7, iv: M, roman: "V" },
      { deg: 9, iv: m, roman: "vi" },
      { deg: 4, iv: m, roman: "iii" },
      { deg: 5, iv: M, roman: "IV" },
      { deg: 0, iv: M, roman: "I" },
      { deg: 5, iv: M, roman: "IV" },
      { deg: 7, iv: M, roman: "V" },
    ],
    es: { name: "Canon (Pachelbel)", mood: "serena, ceremonial", desc: "Un bajo que desciende paso a paso bajo acordes que alternan subidas de cuarta y bajadas de tercera. Suena inevitable y luminoso; lo han reutilizado infinidad de canciones." },
    en: { name: "Canon (Pachelbel)", mood: "serene, ceremonial", desc: "A bass descending step by step under chords alternating fourths up and thirds down. It sounds inevitable and luminous; countless songs reuse it." },
  },
  {
    id: "minor-cadence",
    scale: "minor",
    category: "classic",
    chords: [
      { deg: 0, iv: m, roman: "i" },
      { deg: 5, iv: m, roman: "iv" },
      { deg: 7, iv: D7, roman: "V7" },
      { deg: 0, iv: m, roman: "i" },
    ],
    es: { name: "i – iv – V7 – i", mood: "dramática, clásica", desc: "El recorrido funcional en menor, con la dominante mayor tomada de la menor armónica: su sensible hace que la vuelta a la tónica sea contundente." },
    en: { name: "i – iv – V7 – i", mood: "dramatic, classical", desc: "The functional journey in minor, with the major dominant taken from harmonic minor: its leading tone makes the return home decisive." },
  },
  {
    id: "neapolitan",
    scale: "neapolitanMinor",
    category: "classic",
    chords: [
      { deg: 0, iv: m, roman: "i" },
      { deg: 1, iv: M, roman: "♭II" },
      { deg: 7, iv: D7, roman: "V7" },
      { deg: 0, iv: m, roman: "i" },
    ],
    es: { name: "Cadencia napolitana", mood: "trágica, operística", desc: "El acorde napolitano (♭II mayor) prepara la dominante con un roce de semitono sobre la tónica. Típico de la ópera y de los finales dramáticos." },
    en: { name: "Neapolitan cadence", mood: "tragic, operatic", desc: "The Neapolitan chord (major ♭II) sets up the dominant with a half-step rub above the tonic. Typical of opera and dramatic endings." },
  },

  // ---------- Modal y cine ----------
  {
    id: "epic",
    scale: "minor",
    category: "modal",
    chords: [
      { deg: 0, iv: m, roman: "i" },
      { deg: 8, iv: M, roman: "♭VI" },
      { deg: 3, iv: M, roman: "♭III" },
      { deg: 10, iv: M, roman: "♭VII" },
    ],
    es: { name: "i – ♭VI – ♭III – ♭VII (épica)", mood: "épica, heroica", desc: "La progresión de los tráileres y los himnos de batalla. Los acordes mayores dentro de una tonalidad menor dan una mezcla de tristeza y grandeza." },
    en: { name: "i – ♭VI – ♭III – ♭VII (epic)", mood: "epic, heroic", desc: "The progression of trailers and battle anthems. Major chords inside a minor key blend sadness and grandeur." },
  },
  {
    id: "dorian-vamp",
    scale: "dorian",
    category: "modal",
    chords: [
      { deg: 0, iv: m7, bars: 2, roman: "i7" },
      { deg: 5, iv: D7, bars: 2, roman: "IV7" },
    ],
    es: { name: "Vamp de funk", mood: "groovy, misteriosa", desc: "Dos acordes que se repiten: el IV mayor delata la sexta mayor del dórico. Ideal para improvisar, funk y jazz modal." },
    en: { name: "Funk vamp", mood: "groovy, mysterious", desc: "Two repeating chords: the major IV reveals Dorian's major sixth. Ideal for improvising, funk and modal jazz." },
  },
  {
    id: "lydian-float",
    scale: "lydian",
    category: "modal",
    chords: [
      { deg: 0, iv: maj7, bars: 2, roman: "Imaj7" },
      { deg: 2, iv: M, bars: 2, roman: "II" },
    ],
    es: { name: "Vuelo de fantasía", mood: "soñadora, mágica", desc: "El II mayor contiene el ♯4 del lidio. Alternarlo con la tónica produce la sensación de vuelo y asombro de las bandas sonoras de fantasía." },
    en: { name: "Fantasy flight", mood: "dreamy, magical", desc: "Major II contains Lydian's ♯4. Alternating it with the tonic creates the flying, wonder-struck feel of fantasy scores." },
  },
  {
    id: "phrygian-vamp",
    scale: "phrygian",
    category: "modal",
    chords: [
      { deg: 0, iv: m, bars: 2, roman: "i" },
      { deg: 1, iv: M, bars: 2, roman: "♭II" },
    ],
    es: { name: "Amenaza", mood: "amenazante, oscura", desc: "La tónica y el acorde medio tono arriba: un roce que no se resuelve. Es el sonido del metal y de las persecuciones en el cine." },
    en: { name: "Menace", mood: "menacing, dark", desc: "The tonic and the chord a half step above: a rub that never resolves. The sound of metal and film chase scenes." },
  },
  {
    id: "whole-dream",
    scale: "wholeTone",
    category: "modal",
    chords: [
      { deg: 0, iv: aug, roman: "I+" },
      { deg: 2, iv: aug, roman: "II+" },
      { deg: 4, iv: aug, roman: "III+" },
      { deg: 2, iv: aug, roman: "II+" },
    ],
    es: { name: "Niebla de sueño", mood: "onírica, irreal", desc: "Acordes aumentados que suben por tonos: como la escala es simétrica, ninguno se siente casa. El sonido de los sueños y los recuerdos en el cine." },
    en: { name: "Dream fog", mood: "dreamlike, unreal", desc: "Augmented chords rising by whole steps: since the scale is symmetrical, none feels like home. The sound of dreams and memories in film." },
  },

  // ---------- Del mundo ----------
  {
    id: "andalusian",
    scale: "minor",
    category: "world",
    chords: [
      { deg: 0, iv: m, roman: "i" },
      { deg: 10, iv: M, roman: "♭VII" },
      { deg: 8, iv: M, roman: "♭VI" },
      { deg: 7, iv: M, roman: "V" },
    ],
    es: { name: "Cadencia andaluza", mood: "apasionada, flamenca", desc: "Un bajo que desciende por grados (La–Sol–Fa–Mi) hasta una dominante mayor con sabor frigio. Es el sonido del flamenco y de muchas canciones dramáticas." },
    en: { name: "Andalusian cadence", mood: "passionate, flamenco", desc: "A bass descending by step (A–G–F–E) to a major dominant with a Phrygian flavor. The sound of flamenco and many dramatic songs." },
  },
  {
    id: "hijaz-vamp",
    scale: "phrygianDominant",
    category: "world",
    chords: [
      { deg: 0, iv: M, bars: 2, roman: "I" },
      { deg: 1, iv: M, roman: "♭II" },
      { deg: 0, iv: M, roman: "I" },
    ],
    es: { name: "Vaivén Hijaz", mood: "árabe, hipnótica", desc: "El vaivén entre la tónica mayor y el acorde medio tono arriba es la firma del Hijaz: suena a Medio Oriente, a flamenco y a surf rock." },
    en: { name: "Hijaz sway", mood: "Arabic, hypnotic", desc: "Rocking between the major tonic and the chord a half step above is Hijaz's signature: it sounds Middle Eastern, flamenco and surf rock." },
  },
  {
    id: "freygish",
    scale: "phrygianDominant",
    category: "world",
    chords: [
      { deg: 0, iv: M, roman: "I" },
      { deg: 5, iv: m, roman: "iv" },
      { deg: 10, iv: m, roman: "♭vii" },
      { deg: 0, iv: M, roman: "I" },
    ],
    es: { name: "Freygish (klezmer)", mood: "klezmer, festiva y triste", desc: "El Hijaz de la música judía (freygish): una tónica mayor rodeada de acordes menores. Alegre y melancólica a la vez, como una boda que llora." },
    en: { name: "Freygish (klezmer)", mood: "klezmer, festive and sad", desc: "The Hijaz of Jewish music (freygish): a major tonic surrounded by minor chords. Happy and melancholic at once, like a wedding in tears." },
  },
  {
    id: "byzantine",
    scale: "doubleHarmonic",
    category: "world",
    chords: [
      { deg: 0, iv: M, roman: "I" },
      { deg: 1, iv: maj7, roman: "♭IImaj7" },
      { deg: 5, iv: m, roman: "iv" },
      { deg: 0, iv: M, roman: "I" },
    ],
    es: { name: "Templo bizantino", mood: "mística, de desierto", desc: "Con las dos segundas aumentadas de la doble armónica: el ♭II con séptima mayor y el iv menor rodean la tónica como en una melodía de templo." },
    en: { name: "Byzantine temple", mood: "mystic, desert", desc: "Using the double harmonic's two augmented seconds: ♭II with a major seventh and minor iv surround the tonic like a temple melody." },
  },
  {
    id: "csardas",
    scale: "hungarianMinor",
    category: "world",
    chords: [
      { deg: 0, iv: m, roman: "i" },
      { deg: 8, iv: M, roman: "♭VI" },
      { deg: 7, iv: M, roman: "V" },
      { deg: 0, iv: m, roman: "i" },
    ],
    es: { name: "Csárdás", mood: "gitana, ardiente", desc: "La menor húngara le da a esta cadencia un aire de csárdás: la melodía encima puede usar el ♯4 y sus dos segundas aumentadas." },
    en: { name: "Csárdás", mood: "Gypsy, fiery", desc: "Hungarian minor gives this cadence a csárdás feel: the melody on top can use the ♯4 and its two augmented seconds." },
  },
  {
    id: "persian-ritual",
    scale: "persian",
    category: "world",
    chords: [
      { deg: 0, iv: [4, 6], roman: "I(♭5)" },
      { deg: 1, iv: M, roman: "♭II" },
      { deg: 5, iv: m, roman: "iv" },
      { deg: 1, iv: M, roman: "♭II" },
    ],
    es: { name: "Ritual persa", mood: "ritual, inquietante", desc: "La tónica con quinta disminuida nunca termina de asentarse; el ♭II la ronda medio tono arriba. Funciona mejor sobre un bajo pedal en la tónica." },
    en: { name: "Persian ritual", mood: "ritual, unsettling", desc: "The tonic with a diminished fifth never quite settles; ♭II circles it a half step above. Works best over a pedal bass on the tonic." },
  },
  {
    id: "koto",
    scale: "hirajoshi",
    category: "world",
    chords: [
      { deg: 0, iv: m, roman: "i" },
      { deg: 8, iv: M, roman: "♭VI" },
      { deg: 7, iv: sus4, roman: "Vsus4" },
      { deg: 0, iv: m, roman: "i" },
    ],
    es: { name: "Koto", mood: "japonesa, contenida", desc: "Solo con notas de la hirajoshi: la dominante queda suspendida (sin sensible), así que la vuelta a casa es serena, sin dramatismo." },
    en: { name: "Koto", mood: "Japanese, restrained", desc: "Only hirajoshi notes: the dominant stays suspended (no leading tone), so the return home is serene, without drama." },
  },
  {
    id: "pent-folk",
    scale: "majorPentatonic",
    category: "world",
    chords: [
      { deg: 0, iv: M, roman: "I" },
      { deg: 9, iv: m, roman: "vi" },
      { deg: 7, iv: sus4, roman: "Vsus4" },
      { deg: 0, iv: M, roman: "I" },
    ],
    es: { name: "Folk sin semitonos", mood: "abierta, folclórica", desc: "Solo notas de la pentatónica mayor: sin semitonos, nada choca. Suena a folk escocés, andino o chino según la melodía que pongas encima." },
    en: { name: "Folk without half steps", mood: "open, folk", desc: "Only major pentatonic notes: no half steps, nothing clashes. It sounds Scottish, Andean or Chinese depending on the melody on top." },
  },
];

/** Función tonal aproximada por grado (la misma tabla que en Rust). */
export function degreeFunction(deg: number, iv: number[]): "tonic" | "subdominant" | "dominant" {
  if (iv.includes(4) && iv.includes(10)) return "dominant";
  if ([0, 3, 4, 9].includes(deg)) return "tonic";
  if ([6, 7, 11].includes(deg)) return "dominant";
  return "subdominant";
}

/** Mayor y menor se pasan a la relativa si no coinciden con la tonalidad; las demás escalas usan la misma tónica. */
const RELATIVE = new Set(["major", "minor"]);

/** Tónica para una progresión en la tonalidad actual. */
export function progressionRoot(p: Progression, key: Key): number {
  const progMinor = isMinorLike(p.scale);
  if (!RELATIVE.has(p.scale) || progMinor === isMinorLike(key.scale.name)) return key.root;
  return progMinor ? (key.root + 9) % 12 : (key.root + 3) % 12;
}

/** ¿Todas las notas de la progresión (ya transportada) están en la escala de la tonalidad? */
export function fitsKey(p: Progression, key: Key): boolean {
  const pcs = new Set(scaleOffsets(key.scale.steps).map((o) => (key.root + o) % 12));
  const root = progressionRoot(p, key);
  return p.chords.every((c) => [0, ...c.iv].every((i) => pcs.has((root + c.deg + i) % 12)));
}

/** Escala en la que suena la progresión (para cambiar la tonalidad con un clic). */
export function progressionKey(p: Progression, key: Key): Key {
  return { root: progressionRoot(p, key), scale: { name: p.scale, steps: scaleSteps(p.scale) } };
}

/** Alturas MIDI en posición cerrada (fundamental entre Do3 y Si3). */
export function chordPitches(root: number, c: LibChord): number[] {
  const base = 48 + ((root + c.deg) % 12);
  return [base, ...c.iv.map((i) => base + i)];
}

const SUFFIX: Record<string, string> = {
  "4,7": "",
  "3,7": "m",
  "4,7,10": "7",
  "3,7,10": "m7",
  "4,7,11": "maj7",
  "3,6": "°",
  "3,6,10": "ø7",
  "4,8": "+",
  "5,7": "sus4",
  "2,7": "sus2",
  "7": "5",
  "4,6": "(♭5)",
  "4,7,10,13": "7♭9",
};

/** Sufijo del acorde para mostrarlo con nombre (C, Am7, G7♭9…). */
export function chordSuffix(iv: number[]): string {
  return SUFFIX[iv.join(",")] ?? "";
}

const n = (letter: number, accidental: number): SpelledNote => ({ letter, accidental });
const SHARP_NAMES = [n(0, 0), n(0, 1), n(1, 0), n(1, 1), n(2, 0), n(3, 0), n(3, 1), n(4, 0), n(4, 1), n(5, 0), n(5, 1), n(6, 0)];
const FLAT_NAMES = [n(0, 0), n(1, -1), n(1, 0), n(2, -1), n(2, 0), n(3, 0), n(4, -1), n(4, 0), n(5, -1), n(5, 0), n(6, -1), n(6, 0)];
/** Tónicas mayores que se escriben con sostenidos: Re, Mi, Fa♯, Sol, La, Si. */
const SHARP_MAJOR_ROOTS = new Set([2, 4, 6, 7, 9, 11]);

/** Nombre de un acorde de la progresión, con sostenidos o bemoles según su tonalidad (C♯m en Mi, no D♭m). */
export function chordName(p: Progression, root: number, c: LibChord, notation: Notation): string {
  const parent = isMinorLike(p.scale) ? (root + 3) % 12 : root;
  const table = SHARP_MAJOR_ROOTS.has(parent) ? SHARP_NAMES : FLAT_NAMES;
  return spelledName(table[(root + c.deg) % 12], notation) + chordSuffix(c.iv);
}
