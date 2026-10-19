// Recorridos guiados. El básico empieza por la teoría (lecciones) y sigue con la app;
// «Sé lo que hago» solo recorre la app. Cada paso de la app ilumina una zona de la pantalla.

import { LESSONS, TUTORIAL_LESSONS, type Lesson } from "./lessons";

export type TourKind = "basic" | "app";

/** Preparar la pantalla antes de un paso: seleccionar un acorde, mostrar la rueda… */
export type StepSetup = "selectFirst" | "deselect" | "wheel";

type Text = { title: string; body: string };

export type AppStep = {
  id: string;
  /** Selectores CSS de la zona a iluminar (se unen en un solo rectángulo). */
  target: string[];
  setup?: StepSetup;
  /** Lección que explica la teoría de este paso (para el enlace «¿Qué significa?»). */
  lesson?: string;
  es: Text;
  en: Text;
};

export type TourStep = { kind: "intro" } | { kind: "lesson"; lesson: Lesson } | { kind: "part2" } | { kind: "app"; step: AppStep } | { kind: "outro" };

export const APP_STEPS: AppStep[] = [
  {
    id: "transport",
    target: [".header .transport"],
    es: {
      title: "Reproducir y tempo",
      body: "Reproduce con el botón o con la barra espaciadora. El bucle repite la región marcada. Arrastra el número o usa la rueda del ratón para cambiar el tempo (BPM).",
    },
    en: {
      title: "Playback and tempo",
      body: "Play with the button or the space bar. Loop repeats the marked region. Drag the number or scroll over it to change the tempo (BPM).",
    },
  },
  {
    id: "key",
    target: [".key-pill"],
    lesson: "scale",
    es: {
      title: "Tonalidad",
      body: "Aquí eliges la tónica y la escala o el modo de la canción. Todo lo demás (rueda, colores, funciones) se recalcula según esta elección.",
    },
    en: {
      title: "Key",
      body: "Choose the song's tonic and scale or mode here. Everything else (wheel, colors, functions) is recalculated from this choice.",
    },
  },
  {
    id: "view",
    target: [".view-switches"],
    lesson: "diatonic",
    es: {
      title: "Cómo se ven las cosas",
      body: "C D E o Do Re Mi; nombres de acorde (Am) o números romanos (vi). En el menú de la derecha eliges el nivel (cuánta explicación ves) y el idioma.",
    },
    en: {
      title: "How things are shown",
      body: "C D E or Do Re Mi; chord names (Am) or Roman numerals (vi). The menu on the right sets your level (how much explanation you see) and language.",
    },
  },
  {
    id: "ribbon",
    target: [".ribbon"],
    setup: "deselect",
    lesson: "functions",
    es: {
      title: "La cinta de acordes",
      body: "Tu progresión. El color es la función (azul tónica, ámbar subdominante, rosa dominante), la altura es la tensión y los arcos, la fuerza de cada paso. Arrastra un bloque para moverlo o su borde para alargarlo; Supr lo borra.",
    },
    en: {
      title: "The chord ribbon",
      body: "Your progression. Color is function (blue tonic, amber subdominant, pink dominant), height is tension and the arcs show how strong each step is. Drag a block to move it or its edge to stretch it; Delete removes it.",
    },
  },
  {
    id: "chordHead",
    target: [".chord-head"],
    lesson: "voices",
    es: {
      title: "Pista de acordes",
      body: "Instrumento, silencio (M), solo (S) y volumen. «Voces» dibuja cómo se mueve cada nota entre acordes y «Suavizar» elige inversiones para que se muevan lo mínimo.",
    },
    en: {
      title: "Chord track",
      body: "Instrument, mute (M), solo (S) and volume. 'Voices' draws how each note moves between chords and 'Smooth' picks inversions so they move as little as possible.",
    },
  },
  {
    id: "timeline",
    target: [".ruler", ".section-bar"],
    es: {
      title: "Regla y secciones",
      body: "Clic en la regla para mover el cursor; arrastra para marcar una región de bucle (doble clic la quita). Las secciones (A, B…) se editan con un clic: nombre, color y tonalidad propia. Si una sección cambia de tonalidad, una marca en el límite te propone cómo preparar el cambio.",
    },
    en: {
      title: "Ruler and sections",
      body: "Click the ruler to move the cursor; drag to mark a loop region (double-click removes it). Click a section (A, B…) to edit its name, color and its own key. If a section changes key, a mark at the boundary suggests how to prepare the change.",
    },
  },
  {
    id: "tracks",
    target: [".track-lanes"],
    es: {
      title: "Pistas y piano roll",
      body: "Abre una pista para dibujar melodías o bajos. El piano roll colorea las filas según el acorde que suena: notas del acorde (seguras), de la escala (de paso) y fuera de escala (en rojo).",
    },
    en: {
      title: "Tracks and piano roll",
      body: "Open a track to draw melodies or bass lines. The piano roll colors rows by the chord playing: chord tones (safe), scale tones (passing) and out-of-scale notes (red).",
    },
  },
  {
    id: "wheel",
    target: [".dock-center"],
    setup: "wheel",
    lesson: "diatonic",
    es: {
      title: "La rueda armónica",
      body: "Pasa el ratón para escuchar un acorde, haz clic para añadirlo o arrástralo a la cinta. Anillo interior: los acordes de la tonalidad. Medio: prestados. Exterior: tonalidades vecinas. Los arcos de luz sugieren qué suena bien después. ¿Se ve chica? Arrastra la barra que la separa de la línea de tiempo o pulsa W para ampliarla; H la oculta para dar todo el espacio al piano roll.",
    },
    en: {
      title: "The harmony wheel",
      body: "Hover to hear a chord, click to add it or drag it to the ribbon. Inner ring: the key's chords. Middle: borrowed. Outer: neighboring keys. The light arcs suggest what sounds good next. Too small? Drag the bar above it or press W to enlarge it; H hides it to give the piano roll all the room.",
    },
  },
  {
    id: "dockViews",
    target: [".dock-view-row"],
    lesson: "tonnetz",
    es: {
      title: "Otras vistas",
      body: "El Mapa T–S–D muestra tu progresión como un viaje entre reposo, movimiento y tensión. El Tonnetz la muestra como un camino entre triángulos. En ambas, «Tensiones» añade 9.ª, 11.ª y 13.ª.",
    },
    en: {
      title: "Other views",
      body: "The T–S–D map shows your progression as a journey between rest, motion and tension. The Tonnetz shows it as a path between triangles. In both, 'Tensions' adds 9ths, 11ths and 13ths.",
    },
  },
  {
    id: "sources",
    target: [".dock-sources"],
    lesson: "borrow",
    es: {
      title: "Modos",
      body: "Los modos van del más brillante (lidio) al más oscuro (locrio); tu tonalidad es el punto verde. Elige uno y sus acordes llenan el anillo medio de la rueda. Pasa el ratón por un modo para ver su fórmula, con la nota que le da carácter en negrita. Las tonalidades vecinas están a la izquierda, bajo la tonalidad.",
    },
    en: {
      title: "Modes",
      body: "Modes run from brightest (Lydian) to darkest (Locrian); your key is the green dot. Pick one and its chords fill the wheel's middle ring. Hover a mode to see its formula, with its signature note in bold. Neighbor keys are on the left, under the key.",
    },
  },
  {
    id: "lens",
    target: [".dock-legend"],
    setup: "selectFirst",
    lesson: "reharm",
    es: {
      title: "La lente del acorde",
      body: "Al seleccionar un acorde aparece aquí: sus notas en teclado, reloj o mástil, por qué suena bien en ese lugar, alternativas para rearmonizar, y los botones Extensiones (7, 9, 11, 13) y Voces, para elegir a mano en qué octava suena cada nota. Atajo: doble clic sobre un acorde de la cinta abre sus extensiones y voces a su lado.",
    },
    en: {
      title: "The chord lens",
      body: "Select a chord and it appears here: its notes on a keyboard, clock or fretboard, why it works in that spot, alternatives to reharmonize, plus the Extensions (7, 9, 11, 13) and Voices buttons to choose by hand which octave each note plays in. Shortcut: double-click a chord in the ribbon to open its extensions and voices next to it.",
    },
  },
  {
    id: "learn",
    target: [".learn-buttons"],
    setup: "deselect",
    es: {
      title: "Biblioteca, Oído y Aprender",
      body: "La Biblioteca trae progresiones famosas para escuchar y añadir en tu tonalidad. Oído entrena tu escucha. Aprender guarda todas las explicaciones de teoría de este tutorial para repasarlas.",
    },
    en: {
      title: "Library, Ear and Learn",
      body: "The Library has famous progressions to hear and add in your key. Ear trains your listening. Learn keeps every theory explanation from this tutorial so you can review it.",
    },
  },
  {
    id: "file",
    target: [".file-button", ".midi-chip"],
    es: {
      title: "Guardar y exportar",
      body: "El menú Archivo guarda, abre y exporta a MIDI (también solo la región de bucle). Arrastra la pastilla MIDI directamente a tu DAW.",
    },
    en: {
      title: "Save and export",
      body: "The File menu saves, opens and exports MIDI (the loop region only, too). Drag the MIDI pill straight into your DAW.",
    },
  },
  {
    id: "tips",
    target: [".help-button"],
    es: {
      title: "Tips y ayuda",
      body: "Haz clic derecho sobre acordes, funciones, modos o la rueda para ver qué transmiten y cuándo usarlos. El botón «?» (o la tecla ?) abre los atajos y te deja repetir este recorrido.",
    },
    en: {
      title: "Tips and help",
      body: "Right-click chords, functions, modes or the wheel to see what they convey and when to use them. The '?' button (or the ? key) opens the shortcuts and lets you replay this tour.",
    },
  },
];

export function buildTour(kind: TourKind): TourStep[] {
  const app = APP_STEPS.map((step) => ({ kind: "app" as const, step }));
  if (kind === "app") return [...app, { kind: "outro" }];
  return [{ kind: "intro" }, ...TUTORIAL_LESSONS.map((lesson) => ({ kind: "lesson" as const, lesson })), { kind: "part2" }, ...app, { kind: "outro" }];
}

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
