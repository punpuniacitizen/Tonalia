// Biblioteca de progresiones famosas. Cada acorde es [grado en semitonos, intervalos, compases].
// Se transportan a la tonalidad actual al escucharlas o añadirlas.

export type LibChord = { deg: number; iv: number[]; bars?: number; roman: string };

type Text = { name: string; mood: string; desc: string };

export type Progression = {
  id: string;
  mode: "major" | "minor";
  chords: LibChord[];
  tags: string[];
  es: Text;
  en: Text;
};

const M = [4, 7];
const m = [3, 7];
const D7 = [4, 7, 10];
const m7 = [3, 7, 10];
const maj7 = [4, 7, 11];

export const PROGRESSIONS: Progression[] = [
  {
    id: "axis",
    mode: "major",
    tags: ["pop"],
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
    mode: "major",
    tags: ["pop", "emotivo"],
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
    mode: "major",
    tags: ["clásico"],
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
    id: "251",
    mode: "major",
    tags: ["jazz"],
    chords: [
      { deg: 2, iv: m7, roman: "ii7" },
      { deg: 7, iv: D7, roman: "V7" },
      { deg: 0, iv: maj7, bars: 2, roman: "Imaj7" },
    ],
    es: { name: "ii7 – V7 – Imaj7", mood: "sofisticada, cálida", desc: "El corazón del jazz: dos quintas descendentes seguidas (ii → V → I). Con séptimas suena rico y elegante. Practícalo en todas las tonalidades girando la rueda." },
    en: { name: "ii7 – V7 – Imaj7", mood: "sophisticated, warm", desc: "The heart of jazz: two falling fifths in a row (ii → V → I). With sevenths it sounds rich and elegant. Practice it in every key by turning the wheel." },
  },
  {
    id: "cadence",
    mode: "major",
    tags: ["clásico", "folk"],
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
    mode: "major",
    tags: ["clásico"],
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
    id: "royal",
    mode: "major",
    tags: ["pop", "emotivo"],
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
    id: "circle",
    mode: "major",
    tags: ["jazz", "clásico"],
    chords: [
      { deg: 9, iv: m7, roman: "vi7" },
      { deg: 2, iv: m7, roman: "ii7" },
      { deg: 7, iv: D7, roman: "V7" },
      { deg: 0, iv: maj7, roman: "Imaj7" },
    ],
    es: { name: "vi – ii – V – I (círculo)", mood: "fluida, irresistible", desc: "Tres quintas descendentes seguidas: cada acorde «cae» en el siguiente. Mira la rueda: es recorrer el círculo de quintas hacia la izquierda hasta llegar a casa." },
    en: { name: "vi – ii – V – I (circle)", mood: "flowing, irresistible", desc: "Three falling fifths in a row: each chord 'falls' into the next. Look at the wheel: it walks the circle of fifths counter-clockwise until reaching home." },
  },
  {
    id: "blues",
    mode: "major",
    tags: ["blues", "rock"],
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
    id: "mixo",
    mode: "major",
    tags: ["rock"],
    chords: [
      { deg: 0, iv: M, roman: "I" },
      { deg: 10, iv: M, roman: "♭VII" },
      { deg: 5, iv: M, roman: "IV" },
      { deg: 0, iv: M, roman: "I" },
    ],
    es: { name: "I – ♭VII – IV – I (mixolidio)", mood: "rockera, despreocupada", desc: "El ♭VII prestado del mixolidio da un aire de rock clásico y de himno de estadio. Sin sensible, la vuelta al I es relajada y poderosa a la vez." },
    en: { name: "I – ♭VII – IV – I (Mixolydian)", mood: "rocking, carefree", desc: "The ♭VII borrowed from Mixolydian gives a classic-rock, stadium-anthem feel. With no leading tone, the return to I is relaxed and powerful at once." },
  },
  {
    id: "epic",
    mode: "minor",
    tags: ["épico", "cine"],
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
    id: "andalusian",
    mode: "minor",
    tags: ["flamenco"],
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
    id: "minor-cadence",
    mode: "minor",
    tags: ["clásico"],
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
    id: "dorian-vamp",
    mode: "minor",
    tags: ["funk", "modal"],
    chords: [
      { deg: 0, iv: m7, bars: 2, roman: "i7" },
      { deg: 5, iv: D7, bars: 2, roman: "IV7" },
    ],
    es: { name: "i7 – IV7 (vamp dórico)", mood: "groovy, misteriosa", desc: "Dos acordes que se repiten: el IV mayor delata la sexta mayor del dórico. Ideal para improvisar, funk y jazz modal." },
    en: { name: "i7 – IV7 (Dorian vamp)", mood: "groovy, mysterious", desc: "Two repeating chords: the major IV reveals Dorian's major sixth. Ideal for improvising, funk and modal jazz." },
  },
  {
    id: "lydian-float",
    mode: "major",
    tags: ["cine", "modal"],
    chords: [
      { deg: 0, iv: maj7, bars: 2, roman: "Imaj7" },
      { deg: 2, iv: M, bars: 2, roman: "II" },
    ],
    es: { name: "I – II (lidio flotante)", mood: "soñadora, mágica", desc: "El II mayor contiene el ♯4 del lidio. Alternarlo con la tónica produce esa sensación de vuelo y asombro de las bandas sonoras de fantasía." },
    en: { name: "I – II (floating Lydian)", mood: "dreamy, magical", desc: "Major II contains Lydian's ♯4. Alternating it with the tonic creates the flying, wonder-struck feel of fantasy scores." },
  },
  {
    id: "minor-iv",
    mode: "major",
    tags: ["emotivo"],
    chords: [
      { deg: 0, iv: M, roman: "I" },
      { deg: 5, iv: M, roman: "IV" },
      { deg: 5, iv: m, roman: "iv" },
      { deg: 0, iv: M, roman: "I" },
    ],
    es: { name: "I – IV – iv – I", mood: "agridulce, conmovedora", desc: "El IV se oscurece a iv menor (prestado de la tonalidad menor) justo antes de volver a casa. Un truco clásico para emocionar." },
    en: { name: "I – IV – iv – I", mood: "bittersweet, moving", desc: "IV darkens into minor iv (borrowed from the minor key) right before going home. A classic trick to move the listener." },
  },
];

/** Función tonal aproximada por grado (la misma tabla que en Rust). */
export function degreeFunction(deg: number, iv: number[]): "tonic" | "subdominant" | "dominant" {
  if (iv.includes(4) && iv.includes(10)) return "dominant";
  if ([0, 3, 4, 9].includes(deg)) return "tonic";
  if ([6, 7, 11].includes(deg)) return "dominant";
  return "subdominant";
}

/** Tónica para una progresión: si el modo no coincide con la tonalidad, se usa la relativa. */
export function progressionRoot(p: Progression, keyRoot: number, keyIsMinor: boolean): number {
  if (p.mode === "minor" && !keyIsMinor) return (keyRoot + 9) % 12;
  if (p.mode === "major" && keyIsMinor) return (keyRoot + 3) % 12;
  return keyRoot;
}

/** Alturas MIDI en posición cerrada (fundamental entre Do3 y Si3). */
export function chordPitches(root: number, c: LibChord): number[] {
  const base = 48 + ((root + c.deg) % 12);
  return [base, ...c.iv.map((i) => base + i)];
}
