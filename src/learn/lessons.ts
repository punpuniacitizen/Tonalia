// Lecciones de teoría: lo mínimo para entender lo que muestra Tonalia.
// Se usan en el tutorial básico y quedan en la sección «Aprender» para repasarlas.
// Breves a propósito: una idea por lección, con un dibujo y un ejemplo sonoro.

import { chordsSequence, melodySequence, type SequenceNote } from "../api";
import type { TipVisual } from "../tips/tips";

export type LessonGroup = "basics" | "harmony" | "rhythm" | "beyond";

type Text = {
  title: string;
  kicker: string;
  /** Uno o dos párrafos cortos. */
  body: string[];
  /** La idea que hay que llevarse. */
  takeaway: string;
  /** Dónde se ve esto en Tonalia. */
  inApp: string;
  /** Para profundizar: solo en Aprender (el tutorial se queda en lo esencial). */
  more?: string[];
};

export type Lesson = {
  id: string;
  group: LessonGroup;
  visual: TipVisual;
  sound?: () => SequenceNote[];
  /** Tip relacionado (clic derecho) con más detalle. */
  tip?: string;
  es: Text;
  en: Text;
};

const C = [60, 64, 67];
const after = (notes: SequenceNote[], seconds: number) => notes.map((n) => ({ ...n, delay: n.delay + seconds }));

/** Mismo pulso, primero partido en dos (corcheas) y luego en tres (tresillos); el pulso, más fuerte. */
function subdivisionSound(): SequenceNote[] {
  const beat = 0.5;
  const bar = (perBeat: number, start: number) =>
    Array.from({ length: 4 * perBeat }, (_, i) => ({
      pitch: i % perBeat === 0 ? 76 : 69,
      delay: start + (i * beat) / perBeat,
      duration: (beat / perBeat) * 0.8,
      velocity: i % perBeat === 0 ? 0.9 : 0.5,
    }));
  return [...bar(2, 0), ...bar(3, 4 * beat + 0.4)];
}

export const LESSONS: Lesson[] = [
  {
    id: "notes",
    group: "basics",
    visual: { kind: "notes" },
    sound: () => melodySequence([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72], 0.2),
    es: {
      title: "Notas y semitonos",
      kicker: "Las 12 piezas de todo",
      body: [
        "La música occidental usa solo 12 notas que se repiten hacia arriba y hacia abajo. Al llegar a la 13.ª vuelves a la primera, más aguda: eso es una octava.",
        "La distancia más pequeña entre dos notas es el semitono (dos teclas vecinas del piano, contando las negras). Dos semitonos forman un tono.",
      ],
      takeaway: "Todo lo demás (acordes, escalas, modos) se mide en semitonos.",
      inApp: "Las filas del piano roll y el reloj cromático de la lente muestran las 12 notas.",
    },
    en: {
      title: "Notes and half steps",
      kicker: "The 12 building blocks",
      body: [
        "Western music uses only 12 notes that repeat up and down. After the 12th you're back at the first one, higher: that's an octave.",
        "The smallest distance between two notes is a half step (two neighboring piano keys, black ones included). Two half steps make a whole step.",
      ],
      takeaway: "Everything else (chords, scales, modes) is measured in half steps.",
      inApp: "The piano roll rows and the lens's chromatic clock show all 12 notes.",
    },
  },
  {
    id: "chord",
    group: "basics",
    visual: { kind: "triad" },
    sound: () => [...melodySequence(C, 0.45), ...after(chordsSequence([C], 1.6), 1.5)],
    tip: "concept.extensions",
    es: {
      title: "¿Qué es un acorde?",
      kicker: "Varias notas a la vez",
      body: [
        "Un acorde son tres o más notas que suenan juntas. El más común, la tríada, se arma saltando de una nota en una: fundamental, tercera y quinta (Do-Mi-Sol).",
        "La fundamental le da nombre (Do). La tercera le da el color (mayor o menor) y la quinta, cuerpo y estabilidad. Por eso decimos que los acordes se «apilan en terceras».",
      ],
      takeaway: "Acorde = fundamental + 3.ª + 5.ª (y a veces más notas encima).",
      inApp: "Cada bloque de la cinta es un acorde. Selecciónalo y la lente te muestra sus notas.",
    },
    en: {
      title: "What is a chord?",
      kicker: "Several notes at once",
      body: [
        "A chord is three or more notes sounding together. The most common, the triad, is built by skipping every other note: root, third and fifth (C-E-G).",
        "The root names it (C). The third gives it its color (major or minor) and the fifth adds body and stability. That's why chords are said to be 'stacked in thirds'.",
      ],
      takeaway: "Chord = root + 3rd + 5th (sometimes with more notes on top).",
      inApp: "Each block in the ribbon is a chord. Select it and the lens shows its notes.",
    },
  },
  {
    id: "majorMinor",
    group: "basics",
    visual: { kind: "third" },
    sound: () => chordsSequence([C, [60, 63, 67]], 1.3),
    tip: "concept.majorMinor",
    es: {
      title: "Mayor y menor",
      kicker: "Una sola nota cambia el ánimo",
      body: [
        "Si la tercera está a 4 semitonos de la fundamental, el acorde es mayor: suena abierto, luminoso. Si está a 3, es menor: suena más íntimo o triste.",
        "En los nombres, la «m» indica menor: C es Do mayor y Cm es Do menor. Con números romanos, las mayúsculas son mayores (IV) y las minúsculas, menores (ii).",
      ],
      takeaway: "La tercera decide si un acorde es mayor o menor.",
      inApp: "En la lente, la tercera aparece resaltada. Escucha C y luego Cm en la rueda.",
    },
    en: {
      title: "Major and minor",
      kicker: "One note changes the mood",
      body: [
        "If the third is 4 half steps above the root, the chord is major: open and bright. If it's 3, it's minor: more intimate or sad.",
        "In names, 'm' means minor: C is C major and Cm is C minor. In Roman numerals, uppercase is major (IV) and lowercase is minor (ii).",
      ],
      takeaway: "The third decides whether a chord is major or minor.",
      inApp: "The lens highlights the third. Listen to C and then Cm on the wheel.",
    },
  },
  {
    id: "scale",
    group: "basics",
    visual: { kind: "mode", scale: "major" },
    sound: () => melodySequence([60, 62, 64, 65, 67, 69, 71, 72]),
    tip: "mode.major",
    es: {
      title: "Escalas y tonalidad",
      kicker: "Las 7 notas de la canción",
      body: [
        "Una escala elige 7 de las 12 notas siguiendo un patrón de tonos (T) y semitonos (S). La escala mayor es T-T-S-T-T-T-S: en Do, solo teclas blancas.",
        "La tonalidad es esa escala más su nota central, la tónica: el lugar donde la música «descansa». Una canción en Do mayor usa sobre todo esas 7 notas y gira en torno a Do.",
      ],
      takeaway: "Tonalidad = una escala + una nota que hace de casa.",
      inApp: "Elígela en la pastilla de tonalidad (arriba). Su forma aparece junto a la rueda.",
    },
    en: {
      title: "Scales and keys",
      kicker: "The song's 7 notes",
      body: [
        "A scale picks 7 of the 12 notes following a pattern of whole (W) and half (H) steps. The major scale is W-W-H-W-W-W-H: in C, just the white keys.",
        "A key is that scale plus its central note, the tonic: where the music 'rests'. A song in C major mostly uses those 7 notes and revolves around C.",
      ],
      takeaway: "Key = a scale + one note that feels like home.",
      inApp: "Pick it in the key pill (top). Its shape appears next to the wheel.",
    },
  },
  {
    id: "diatonic",
    group: "harmony",
    visual: { kind: "diatonic" },
    sound: () =>
      chordsSequence(
        [
          [60, 64, 67],
          [62, 65, 69],
          [64, 67, 71],
          [65, 69, 72],
          [67, 71, 74],
          [69, 72, 76],
          [71, 74, 77],
          [72, 76, 79],
        ],
        0.6,
      ),
    es: {
      title: "Los acordes de la tonalidad",
      kicker: "Siete acordes que ya combinan",
      body: [
        "Si construyes una tríada sobre cada nota de la escala, usando solo notas de la escala, salen 7 acordes. En Do mayor: C, Dm, Em, F, G, Am y B°.",
        "Se numeran con romanos según su lugar en la escala: I ii iii IV V vi vii°. Así una progresión (I–V–vi–IV) vale para cualquier tonalidad.",
      ],
      takeaway: "Los 7 acordes diatónicos suenan bien juntos porque comparten la misma escala.",
      inApp: "Son el anillo interior de la rueda. Cambia «Nombres» por «Romanos» arriba para ver los números.",
    },
    en: {
      title: "The chords of a key",
      kicker: "Seven chords that already fit",
      body: [
        "Build a triad on each note of the scale, using only scale notes, and you get 7 chords. In C major: C, Dm, Em, F, G, Am and B°.",
        "They're numbered with Roman numerals by their place in the scale: I ii iii IV V vi vii°. That way a progression (I–V–vi–IV) works in any key.",
      ],
      takeaway: "The 7 diatonic chords sound good together because they share one scale.",
      inApp: "They're the inner ring of the wheel. Switch 'Names' to 'Roman' at the top to see the numbers.",
    },
  },
  {
    id: "functions",
    group: "harmony",
    visual: { kind: "gravity", focus: null },
    sound: () => chordsSequence([C, [53, 57, 60], [55, 59, 62, 65], C], 1),
    tip: "function.tonic",
    es: {
      title: "Tónica, subdominante y dominante",
      kicker: "Casa, salir y querer volver",
      body: [
        "Cada acorde cumple un papel. La tónica (I, vi, iii) es reposo: la casa. La subdominante (IV, ii) es movimiento: sales de casa. La dominante (V, vii°) es tensión: pide volver.",
        "El viaje típico de una frase es T → S → D → T. Lo puedes alterar, pero saber en qué papel está cada acorde explica por qué una progresión «funciona».",
      ],
      takeaway: "Reposo, movimiento y tensión: la armonía es un viaje de ida y vuelta.",
      inApp: "Los colores de toda la app: azul = tónica, ámbar = subdominante, rosa = dominante.",
    },
    en: {
      title: "Tonic, subdominant and dominant",
      kicker: "Home, leaving and wanting back",
      body: [
        "Each chord plays a role. The tonic (I, vi, iii) is rest: home. The subdominant (IV, ii) is motion: you leave home. The dominant (V, vii°) is tension: it wants to return.",
        "A phrase's typical journey is T → S → D → T. You can bend it, but knowing each chord's role explains why a progression 'works'.",
      ],
      takeaway: "Rest, motion and tension: harmony is a round trip.",
      inApp: "The colors throughout the app: blue = tonic, amber = subdominant, pink = dominant.",
    },
  },
  {
    id: "cadence",
    group: "harmony",
    visual: { kind: "arcs" },
    sound: () => chordsSequence([[53, 57, 60], [55, 59, 62, 65], C], 1),
    tip: "concept.transitions",
    es: {
      title: "Tensión y cadencias",
      kicker: "Cómo termina una frase",
      body: [
        "Cada acorde tiene más o menos tensión, y pasar de uno a otro puede ser un paso fuerte o suave. El más fuerte es V → I: la dominante resuelve en la tónica.",
        "Una cadencia es cómo cierra una frase: V → I suena a punto final, IV → I a «amén» y terminar en V deja una pregunta abierta.",
      ],
      takeaway: "La tensión crea ganas de resolver; la cadencia decide cómo resuelves.",
      inApp: "En la cinta, la altura de cada bloque es su tensión y los arcos de arriba, la fuerza del paso.",
      more: [
        "La «Llegada» de la lente es un número de 0 a 100: qué tan natural es llegar a ese acorde desde el anterior. Fuerte (100): un paso que la armonía tonal respalda, como bajar una quinta (V → I, ii → V) o un par funcional (IV → V). Aceptable (70): funciona, pero con otro carácter, como un movimiento cromático del bajo. Débil (0): ninguna regla lo respalda; suena sorprendente, que no siempre es malo.",
        "Desde la tónica se puede ir a cualquier acorde de la escala (100). Si el acorde trae notas de fuera, el paso queda en 70: no está mal, se oye como color o sorpresa (por ejemplo I → iv prestado). El primer acorde marca 80 porque no tiene con qué compararse.",
      ],
    },
    en: {
      title: "Tension and cadences",
      kicker: "How a phrase ends",
      body: [
        "Each chord has more or less tension, and moving between two can be a strong or a soft step. The strongest is V → I: the dominant resolves to the tonic.",
        "A cadence is how a phrase closes: V → I sounds like a full stop, IV → I like an 'amen', and ending on V leaves a question open.",
      ],
      takeaway: "Tension makes you want to resolve; the cadence decides how.",
      inApp: "In the ribbon, each block's height is its tension and the arcs above show how strong each step is.",
      more: [
        "The lens's 'Arrival' is a number from 0 to 100: how natural it is to reach that chord from the previous one. Strong (100): a step tonal harmony backs up, like falling a fifth (V → I, ii → V) or a functional pair (IV → V). Fair (70): it works, with a different character, like a chromatic bass move. Weak (0): no rule backs it up; it sounds surprising, which isn't always bad.",
        "From the tonic you can go to any chord in the scale (100). If the chord brings notes from outside, the step drops to 70: not wrong, it reads as color or surprise (for example I → borrowed iv). The first chord shows 80 because there's nothing to compare it with.",
      ],
    },
  },
  {
    id: "modes",
    group: "harmony",
    visual: { kind: "mode", scale: "dorian" },
    sound: () => melodySequence([62, 64, 65, 67, 69, 71, 72, 74]),
    tip: "mode.dorian",
    es: {
      title: "Modos",
      kicker: "La misma escala, otra casa",
      body: [
        "Si tocas las notas de Do mayor pero tomas Re como casa, obtienes el modo dórico: menor, pero con un brillo especial. Cada nota de partida da un modo con otro carácter.",
        "Del más brillante al más oscuro: lidio, jónico (mayor), mixolidio, dórico, eólico (menor), frigio y locrio. Cada uno tiene una nota característica que lo distingue.",
      ],
      takeaway: "Un modo es una escala vista desde otra tónica: cambia el ánimo, no las notas.",
      inApp: "La lista «Modos», junto a la rueda, los ordena de brillante a oscuro con su fórmula. Clic derecho sobre uno para ver su carácter.",
      more: [
        "Cómo leer la fórmula: cada modo se compara con la escala mayor. «♭3 ♭7» (dórico) quiere decir que la 3.ª y la 7.ª están medio tono más abajo que en la mayor; el resto de las notas es igual. La nota resaltada es la característica: la que lo distingue del peldaño de al lado.",
        "Por qué la escalera va de brillante a oscuro: de un peldaño al siguiente se baja exactamente una nota medio tono. Lidio (♯4) → jónico → mixolidio (♭7) → dórico (♭3) → eólico (♭6) → frigio (♭2) → locrio (♭5). Más notas bajadas, sonido más oscuro.",
      ],
    },
    en: {
      title: "Modes",
      kicker: "Same scale, different home",
      body: [
        "Play the notes of C major but treat D as home and you get the Dorian mode: minor, but with a special brightness. Each starting note gives a mode with its own character.",
        "From brightest to darkest: Lydian, Ionian (major), Mixolydian, Dorian, Aeolian (minor), Phrygian and Locrian. Each has a signature note that sets it apart.",
      ],
      takeaway: "A mode is a scale seen from another tonic: the mood changes, not the notes.",
      inApp: "The 'Modes' list next to the wheel orders them from bright to dark with their formula. Right-click one to see its character.",
      more: [
        "How to read the formula: each mode is compared with the major scale. '♭3 ♭7' (Dorian) means the 3rd and 7th sit a half step lower than in major; every other note is the same. The highlighted note is the signature one: what sets it apart from the step next to it.",
        "Why the ladder goes from bright to dark: from one step to the next exactly one note drops a half step. Lydian (♯4) → Ionian → Mixolydian (♭7) → Dorian (♭3) → Aeolian (♭6) → Phrygian (♭2) → Locrian (♭5). More lowered notes, darker sound.",
      ],
    },
  },
  {
    id: "borrow",
    group: "harmony",
    visual: { kind: "borrow" },
    sound: () => chordsSequence([C, [53, 57, 60], [53, 56, 60], C], 1),
    tip: "concept.borrow",
    es: {
      title: "Acordes prestados",
      kicker: "Color de fuera, sin perderse",
      body: [
        "Puedes tomar acordes de otro modo con la misma tónica. En Do mayor, el Fm (de Do menor) suena nostálgico; el B♭ y el A♭ suenan épicos.",
        "Siguen girando alrededor de la misma casa, así que no te pierdes: solo añades color.",
      ],
      takeaway: "Prestar = usar acordes del modo paralelo para cambiar el color.",
      inApp: "Es el anillo medio de la rueda. Elige de qué modo se toman en la lista «Modos».",
    },
    en: {
      title: "Borrowed chords",
      kicker: "Outside color, still at home",
      body: [
        "You can take chords from another mode with the same tonic. In C major, Fm (from C minor) sounds nostalgic; B♭ and A♭ sound epic.",
        "They still revolve around the same home, so you don't get lost: you just add color.",
      ],
      takeaway: "Borrowing = using chords from the parallel mode to change the color.",
      inApp: "That's the wheel's middle ring. Choose which mode they come from in the 'Modes' list.",
    },
  },
  {
    id: "subdivision",
    group: "rhythm",
    visual: { kind: "subdivision" },
    sound: subdivisionSound,
    es: {
      title: "Subdivisiones y tresillos",
      kicker: "Cómo se reparte el pulso",
      body: [
        "Cada compás tiene pulsos (en 4/4, cuatro negras) y cada pulso se puede partir. Si lo partes en dos o en cuatro, la subdivisión es binaria: corcheas, semicorcheas. Suena recta, como la mayoría del pop y el rock.",
        "Si cada pulso se parte en tres, es ternaria: son los tresillos. Suena a balanceo, como el blues, el shuffle o una balada en 6/8.",
      ],
      takeaway: "Binaria suena recta; ternaria, balanceada. El mismo tempo cambia de carácter según cómo lo repartes.",
      inApp: "El botón de cuadrícula, junto a «Restablecer», parte el compás: binarias (1/2 a 1/32) o ternarias (1/3 a 1/24). Mantén Alt al editar notas para ignorarla.",
      more: [
        "Cómo leer las divisiones: «1/8» parte el compás en 8 (en 4/4, dos corcheas por pulso); «1/12» lo parte en 12 (tres por pulso: tresillos de corchea); «1/6» en 6 (tres notas cada dos pulsos: tresillos de negra); «1/24», tresillos de semicorchea.",
        "Para un groove con swing, escribe la melodía con la cuadrícula en 1/12 y usa la 1.ª y la 3.ª nota de cada tresillo: es la base del shuffle.",
      ],
    },
    en: {
      title: "Subdivisions and triplets",
      kicker: "How the beat is split",
      body: [
        "Each bar has beats (in 4/4, four quarter notes) and each beat can be split. Split it in two or four and the subdivision is binary: eighths, sixteenths. It sounds straight, like most pop and rock.",
        "Split each beat in three and it's ternary: triplets. It sounds like a swing, as in blues, shuffle or a 6/8 ballad.",
      ],
      takeaway: "Binary sounds straight; ternary sounds swung. The same tempo changes character depending on how you split it.",
      inApp: "The grid button, next to 'Reset', splits the bar: binary (1/2 to 1/32) or ternary (1/3 to 1/24). Hold Alt while editing notes to ignore it.",
      more: [
        "How to read the divisions: '1/8' splits the bar in 8 (in 4/4, two eighths per beat); '1/12' in 12 (three per beat: eighth-note triplets); '1/6' in 6 (three notes every two beats: quarter-note triplets); '1/24', sixteenth-note triplets.",
        "For a swung groove, write the melody with the grid at 1/12 and use the 1st and 3rd note of each triplet: that's the basis of a shuffle.",
      ],
    },
  },
  {
    id: "circle",
    group: "beyond",
    visual: { kind: "circle" },
    sound: () => chordsSequence([C, [55, 59, 62], [62, 66, 69], [57, 61, 64]], 0.8),
    tip: "concept.circle",
    es: {
      title: "El círculo de quintas",
      kicker: "El mapa de las tonalidades",
      body: [
        "Ordena las 12 notas saltando de quinta en quinta: C, G, D, A… Las tonalidades vecinas en el círculo comparten 6 de sus 7 notas.",
        "Por eso moverse a una vecina (modular) suena natural, y alejarse mucho suena sorprendente.",
      ],
      takeaway: "Cerca en el círculo = muchas notas en común.",
      inApp: "El anillo exterior de la rueda y los botones de «Tonalidades vecinas».",
    },
    en: {
      title: "The circle of fifths",
      kicker: "The map of keys",
      body: [
        "Arrange the 12 notes by jumping in fifths: C, G, D, A… Neighboring keys on the circle share 6 of their 7 notes.",
        "That's why moving to a neighbor (modulating) sounds natural, and going far sounds surprising.",
      ],
      takeaway: "Close on the circle = many notes in common.",
      inApp: "The wheel's outer ring and the 'Neighbor keys' buttons.",
    },
  },
  {
    id: "modulation",
    group: "beyond",
    visual: { kind: "modulation" },
    // Do mayor → Lam (pivote: vi en Do, ii en Sol) → Re7 (dominante de Sol) → Sol.
    sound: () => chordsSequence([C, [57, 60, 64], [50, 54, 57, 60], [55, 59, 62]], 1),
    tip: "concept.circle",
    es: {
      title: "Modulación",
      kicker: "Cambiar de casa sin perderse",
      body: [
        "Modular es pasar a otra tonalidad: el centro de gravedad se muda. Cuanto más notas comparten las dos tonalidades, más suave suena el cambio; por eso ir a una vecina del círculo de quintas es lo más natural.",
        "Hay tres formas típicas: con un acorde pivote (pertenece a las dos tonalidades y hace de puente), con la dominante de la nueva (la empuja con fuerza) o de golpe, sin preparación, cuando se busca sorprender.",
      ],
      takeaway: "Un buen cambio de tonalidad se prepara: un acorde en común y la dominante de la nueva.",
      inApp: "Dale a una sección su propia tonalidad: en la cinta aparece una marca en el límite («C → G · vecina»). Tócala para escuchar e insertar cada camino.",
      more: [
        "Acorde pivote: de Do a Sol, Lam es vi en Do y ii en Sol. Suena todavía en Do, pero ya prepara Re7 → Sol. Los pivotes que en la tonalidad nueva son subdominante (ii, IV) son los que mejor funcionan.",
        "Relativa y paralela: la relativa comparte todas las notas (Do mayor ↔ La menor) y el cambio casi no se nota; la paralela comparte la tónica (Do mayor ↔ Do menor) y lo que cambia es el color. Ambas son puertas muy usadas.",
        "El salto de un tono hacia arriba en el último estribillo es el cambio directo más famoso del pop: no se prepara, se nota a propósito.",
      ],
    },
    en: {
      title: "Modulation",
      kicker: "Moving house without getting lost",
      body: [
        "Modulating means moving to another key: the center of gravity relocates. The more notes two keys share, the smoother the change; that's why going to a neighbor on the circle of fifths feels most natural.",
        "There are three typical ways: with a pivot chord (it belongs to both keys and acts as a bridge), with the new key's dominant (it pushes hard), or all at once, unprepared, when you want to surprise.",
      ],
      takeaway: "A good key change is prepared: a shared chord and the new key's dominant.",
      inApp: "Give a section its own key: a mark appears at the boundary in the ribbon ('C → G · neighbor'). Click it to hear and insert each path.",
      more: [
        "Pivot chord: from C to G, Am is vi in C and ii in G. It still sounds like C, but it already sets up D7 → G. Pivots that are subdominant in the new key (ii, IV) work best.",
        "Relative and parallel: the relative shares every note (C major ↔ A minor) and the change is barely noticeable; the parallel shares the tonic (C major ↔ C minor) and what changes is the color. Both are common doors.",
        "Jumping up a whole step for the last chorus is pop's most famous direct change: unprepared, noticeable on purpose.",
      ],
    },
  },
  {
    id: "extensions",
    group: "beyond",
    visual: { kind: "extensions" },
    sound: () => chordsSequence([C, [60, 64, 67, 71], [60, 64, 67, 71, 74]], 1.2),
    tip: "concept.extensions",
    es: {
      title: "Séptimas y extensiones",
      kicker: "Más terceras, más color",
      body: [
        "Si sigues apilando terceras sobre la tríada aparecen la 7.ª, la 9.ª, la 11.ª y la 13.ª. Cada una añade riqueza: la 7.ª suena a jazz y soul; la 9.ª, a algo abierto y moderno.",
        "Algunas chocan con el acorde (notas a evitar). Tonalia te las marca en rojo.",
      ],
      takeaway: "Las extensiones no cambian la función del acorde, cambian su color.",
      inApp: "En la lente: «Extensiones (7, 9, 11, 13)». En el mapa y el Tonnetz: botón «Tensiones».",
    },
    en: {
      title: "Sevenths and extensions",
      kicker: "More thirds, more color",
      body: [
        "Keep stacking thirds on a triad and you get the 7th, 9th, 11th and 13th. Each adds richness: the 7th sounds like jazz and soul; the 9th, open and modern.",
        "Some clash with the chord (avoid notes). Tonalia marks them in red.",
      ],
      takeaway: "Extensions don't change a chord's function, they change its color.",
      inApp: "In the lens: 'Extensions (7, 9, 11, 13)'. In the map and Tonnetz: the 'Tensions' button.",
    },
  },
  {
    id: "voices",
    group: "beyond",
    visual: { kind: "voices" },
    sound: () => chordsSequence([C, [60, 65, 69], [59, 62, 67], C], 1),
    tip: "concept.voices",
    es: {
      title: "Conducción de voces",
      kicker: "Que cada nota se mueva poco",
      body: [
        "Piensa cada nota del acorde como un cantante. Si al cambiar de acorde cada uno se mueve lo mínimo, el cambio suena suave y profesional.",
        "Para lograrlo se usan inversiones: el mismo acorde con otra nota abajo (Do-Mi-Sol → Mi-Sol-Do).",
      ],
      takeaway: "Pocas distancias entre acordes = progresión fluida.",
      inApp: "En la pista de acordes, «Voces» dibuja las líneas y «Suavizar» elige las inversiones solo. En la lente (o con doble clic en un acorde), la pestaña Voces deja moverlas a mano.",
      more: [
        "Cerrado y abierto: en un acorde cerrado todas las notas caben dentro de una octava (Do-Mi-Sol); en uno abierto se reparten en más de una (Do-Sol-Mi). Abierto suena amplio, como una orquesta; cerrado, compacto, como un piano en el registro medio.",
        "Drop 2: tomas un acorde cerrado y bajas una octava la segunda voz desde arriba. Es la forma más usada en el jazz y en la guitarra para abrir un acorde de cuatro notas sin que pierda claridad.",
        "En la pestaña Voces cada nota muestra su papel: 1 es la fundamental, 3 y 5 completan la tríada, 7 es la séptima y 9, 11 y 13 son extensiones (con ♭ o ♯ si están alteradas). La nota más grave decide la posición: fundamental, 1.ª inversión (la 3.ª abajo), 2.ª (la 5.ª) o 3.ª (la 7.ª).",
      ],
    },
    en: {
      title: "Voice leading",
      kicker: "Let each note move a little",
      body: [
        "Think of each note in the chord as a singer. If each one moves as little as possible when the chord changes, the change sounds smooth and polished.",
        "Inversions make that possible: the same chord with another note at the bottom (C-E-G → E-G-C).",
      ],
      takeaway: "Short distances between chords = a flowing progression.",
      inApp: "On the chord track, 'Voices' draws the lines and 'Smooth' picks inversions for you. In the lens (or by double-clicking a chord), the Voices tab lets you move them by hand.",
      more: [
        "Close and open: in a close chord all notes fit within one octave (C-E-G); in an open one they spread over more than one (C-G-E). Open sounds wide, like an orchestra; close sounds compact, like a piano in its middle register.",
        "Drop 2: take a close chord and drop the second voice from the top an octave. It's the most common way in jazz and on guitar to open up a four-note chord while keeping it clear.",
        "In the Voices tab each note shows its role: 1 is the root, 3 and 5 complete the triad, 7 is the seventh and 9, 11 and 13 are extensions (with ♭ or ♯ when altered). The lowest note sets the position: root, 1st inversion (3rd in the bass), 2nd (5th) or 3rd (7th).",
      ],
    },
  },
  {
    id: "reharm",
    group: "beyond",
    visual: { kind: "reharm" },
    sound: () => chordsSequence([C, [53, 57, 60], C, [53, 56, 60]], 1),
    tip: "concept.reharm",
    es: {
      title: "Rearmonizar",
      kicker: "La misma melodía, otro acorde",
      body: [
        "Rearmonizar es cambiar un acorde por otro que cumpla un papel parecido: su relativo (F → Dm), su versión prestada (F → Fm) o una dominante que lo prepare.",
        "La melodía sigue encajando, pero la emoción cambia. Es la herramienta favorita de los arreglistas.",
      ],
      takeaway: "Sustituir sin romper el camino: misma función, otro color.",
      inApp: "En la lente, «Alternativas» propone sustitutos con su explicación.",
      more: [
        "Dominante secundaria («V7 antes»): antes de un acorde se agrega su propia dominante. Para llegar a Dm, su dominante es A7: A7 → Dm funciona como un V7 → I en miniatura y empuja la música hacia ese acorde.",
        "Sustitución tritonal («tritonal»): una dominante se cambia por la que está a un tritono. G7 y D♭7 comparten el mismo tritono (Si-Fa / Do♭-Fa), así que cumplen la misma función, pero el bajo baja por semitonos (D♭7 → C). Muy usada en el jazz.",
        "Suspendido: se quita la 3.ª y se pone la 4.ª o la 2.ª. El acorde queda «en el aire», sin ser mayor ni menor, y pide resolver.",
      ],
    },
    en: {
      title: "Reharmonizing",
      kicker: "Same melody, another chord",
      body: [
        "Reharmonizing means swapping a chord for another with a similar role: its relative (F → Dm), its borrowed version (F → Fm) or a dominant that sets it up.",
        "The melody still fits, but the emotion changes. It's arrangers' favorite tool.",
      ],
      takeaway: "Substitute without breaking the path: same function, new color.",
      inApp: "In the lens, 'Alternatives' suggests substitutes with an explanation.",
      more: [
        "Secondary dominant ('V7 before'): a chord's own dominant is added in front of it. To reach Dm, its dominant is A7: A7 → Dm works like a miniature V7 → I and pushes the music toward that chord.",
        "Tritone substitution ('tritone'): a dominant is swapped for the one a tritone away. G7 and D♭7 share the same tritone (B-F / C♭-F), so they do the same job, but the bass moves down by half steps (D♭7 → C). A jazz staple.",
        "Suspended: the 3rd is replaced by the 4th or the 2nd. The chord hangs 'in the air', neither major nor minor, and wants to resolve.",
      ],
    },
  },
  {
    id: "tonnetz",
    group: "beyond",
    visual: { kind: "tonnetz" },
    sound: () => chordsSequence([C, [60, 63, 67], [57, 60, 64], [59, 64, 67]], 1),
    tip: "concept.tonnetz",
    es: {
      title: "El Tonnetz",
      kicker: "Acordes como triángulos",
      body: [
        "Es una red donde cada triángulo es un acorde mayor o menor. Los triángulos vecinos comparten dos notas, así que pasar de uno a otro suena muy suave.",
        "Tres movimientos básicos: P (Do ↔ Do menor), R (Do ↔ La menor) y L (Do ↔ Mi menor).",
      ],
      takeaway: "Vecinos en la red = cambios suaves entre acordes.",
      inApp: "Vista «Tonnetz» del muelle: pasa el ratón por un triángulo para oírlo, clic para añadirlo o arrástralo a la cinta.",
    },
    en: {
      title: "The Tonnetz",
      kicker: "Chords as triangles",
      body: [
        "A grid where each triangle is a major or minor chord. Neighboring triangles share two notes, so moving between them sounds very smooth.",
        "Three basic moves: P (C ↔ C minor), R (C ↔ A minor) and L (C ↔ E minor).",
      ],
      takeaway: "Neighbors on the grid = smooth chord changes.",
      inApp: "The 'Tonnetz' view in the dock: hover a triangle to hear it, click to add it or drag it to the ribbon.",
    },
  },
];

export const LESSON_GROUPS: LessonGroup[] = ["basics", "harmony", "rhythm", "beyond"];

/** Lo que entra en el tutorial básico: fundamentos y armonía (lo «más allá» queda para Aprender). */
export const TUTORIAL_LESSONS = LESSONS.filter((l) => l.group === "basics" || l.group === "harmony");
