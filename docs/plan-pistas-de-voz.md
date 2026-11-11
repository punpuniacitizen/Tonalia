# Pistas de voz: notas con curva de altura continua y transiciones editables

## Contexto

Hoy Tonalia tiene dos tipos de pista: **notas** (piano roll) y **acordes**. Las dos tocan notas sueltas: cada nota arranca y termina, y no hay manera de que la melodía *deslice* de una a otra como hace un cantante. Querés un tercer tipo, **Voz**, donde:

- las notas se unan con continuidad;
- se pueda editar la transición entre ellas (cuánto tarda, cuándo arranca, con qué forma, si se pasa de la nota o toma impulso antes);
- haya vibrato.

Es el modelo de los editores de voz (Synthesizer V, Vocaloid, OpenUtau): notas + una **curva de altura** calculada a partir de ellas. Por dentro se guarda ese modelo. Al tocar y al exportar se traduce a MIDI estándar con *pitch bend*.

Alcance:
- **Etapas 1 a 4:** pista de voz con timbre de **voz guía** («Voice Oohs», «Choir Aahs» y «Synth Voice» de GeneralUser GS). Responde al instante mientras se edita. Cada nota guarda un campo `lyric` opcional desde el principio.
- **Etapa 5:** letra por nota y **exportar a OpenUtau** (.ustx), que canta con nuestras transiciones y vibratos.
- **Etapa 6:** **render propio con bancos de voz UTAU** dentro de Tonalia.
- Al final, comparar 5 y 6 con la misma canción y quedarse con lo que suene mejor.

¿Por qué no ir directo a UTAU? Las etapas 1 y 3 (modelo, curva y editor) hacen falta igual para los dos caminos. Además, el render UTAU no es instantáneo: tarda segundos en cada cambio. La voz guía queda como **escucha inmediata** mientras se arrastran las transiciones, y el render reemplaza solo el sonido final.

---

## Etapa 1: Núcleo (Rust, `crates/tonalia-core`)

### Modelo (`model.rs`)

- `TrackKind::Voice`.
- `Note` gana un campo opcional que no rompe nada: `#[serde(default, skip_serializing_if = "Option::is_none")] pub voice: Option<Box<VoiceNote>>`.
  - En TS queda `voice?: …`, así que los literales `{position, length, pitch, velocity}` siguen valiendo.
  - Las herramientas que hacen `{...n, pitch}` (transponer, cuantizar, humanizar, repetir…) arrastran la curva de cada nota sin cambios.
  - Hay ~21 literales `Note { … }` en Rust: se pasan a `Note::new(...)` o a `..Default::default()`.
- Tipos nuevos en un módulo `voice.rs`, exportados con ts-rs:

| Tipo | Campos |
|---|---|
| `Glide`: cómo llega la voz a esta nota desde la anterior | `length: Ticks` (0 = salto)<br>`offset: f32` (−1 todo antes del cambio, 0 centrado, 1 todo después)<br>`shape: GlideShape {Linear, Smooth, Early, Late}`<br>`overshoot: f32` (semitonos que se pasa y vuelve)<br>`preparation: f32` (semitonos de impulso contrario antes de salir) |
| `Vibrato` | `depth: f32` (semitonos)<br>`rate: f32` (Hz)<br>`delay: f32` y `fade: f32` (fracciones de la nota) |
| `BendPoint` | `at: Ticks` (desde el inicio de la nota)<br>`cents: f32`<br>Es la curva dibujada a mano. Viaja con la nota al moverla o transponerla. |
| `VoiceNote` | `glide: Option<Glide>`<br>`vibrato: Option<Vibrato>`<br>`bend: Vec<BendPoint>`<br>`lyric: Option<String>`<br>Un `None` usa el estilo de la pista. |
| `VoiceStyle` | `glide: Glide`<br>`vibrato: Option<Vibrato>`<br>Son los valores por defecto de la pista y van en `Track.voice: Option<VoiceStyle>`. |

- Estilos de transición rápidos:
  - **Recta:** `length` 0.
  - **Suave:** 1/32, `Smooth`.
  - **Deslizada:** 1/8, `Linear`, `offset` −0.3.
  - **Con caída:** 1/16, preparación −0.4, sobrepaso 0.3.
- Vibratos rápidos:
  - **Sin**.
  - **Leve:** 0.25 st, 5.5 Hz.
  - **Marcado:** 0.5 st, 6 Hz.

### La curva: una sola fuente de verdad (`voice.rs`)

- `phrases(notes) -> Vec<Phrase>`: agrupa las notas pegadas (hueco ≤ 1/64).
- `pitch_at(phrase, style, bpm, t) -> f32` devuelve la altura MIDI con decimales:
  1. **Base:** la altura de la nota que suena.
  2. **Transición:** en cada unión, la nota que llega define su `Glide`. La ventana `[b − L·(1−offset)/2, b + L·(1+offset)/2]` se recorta a la mitad de cada nota vecina. Adentro, `prev + Δ·shape(u)`.
  3. **Preparación** antes de la ventana y **sobrepaso** amortiguado después, en el sentido del salto.
  4. **Vibrato:**
     - Empieza en `delay`, crece durante `fade` y va en segundos, convertidos con `bpm`.
     - Se apaga dentro de las ventanas de transición, para no pelearse con el deslizamiento.
  5. **Curva a mano:** se suma lo dibujado, interpolado entre puntos y en 0 fuera de ellos.
- `sample_curve(notes, style, bpm, step) -> Vec<(Ticks, f32)>` toma muestras y saltea los tramos planos. La usan el dibujo, el audio y la exportación.

### Comandos (`commands.rs`)

- `AddTrack` con `kind: Voice`: instrumento `"oohs"` y `voice: Some(VoiceStyle::default())` (Suave + Leve).
- `SetVoiceStyle { track, style }`, deshacible.
- `SetTrackNotes` en una pista de voz la deja **de una sola voz**:
  - Si dos notas se pisan, la anterior se corta donde empieza la siguiente.
  - Si empiezan juntas, queda la última.
  - Así cualquier herramienta queda a salvo.

### Lo que funciona sin tocarlo

- `queries::track_notes`: las alturas nominales de una pista de voz alimentan el análisis armónico, la detección de tonalidad y la vista igual que una pista de notas.

### Tests

- Una transición recta salta exactamente en la unión.
- `Smooth` es simétrica y llega al centro del salto en el punto medio.
- Con `offset` ±1 la transición queda toda de un lado.
- El sobrepaso pasa la nota y vuelve.
- El vibrato vale 0 antes de `delay` y respeta la profundidad.
- La curva a mano se suma.
- `phrases` corta en los silencios.
- `SetTrackNotes` corta las notas que se pisan.
- Una canción vieja sin `voice` se abre igual que antes.

---

## Etapa 2: Sonido (`src-tauri/src/audio`)

### Instrumentos (`synth.rs`)

- `Instrument` gana `Oohs` (GM 53), `Aahs` (52) y `SynthVoice` (54).
- `ALL` sigue siendo la lista de los 8 melódicos, porque indexa los canales actuales. Se agrega `VOICES`.
- `src/lib/instruments.ts` suma una lista `VOICE_INSTRUMENTS`. El selector de una pista de voz muestra solo esos tres.
- Sintetizador FM de respaldo: las voces de voz suenan como seno con algo de formante. Se agrega `set_bend(id, semitones)`, porque `freq` ya es un campo de la voz.

### Banco de voces (`sf2.rs`)

- Los 16 canales del `Synthesizer` actual ya están ocupados: 0–7 reproducción, 9 percusión, el resto previsualización.
- Por eso se crea un **segundo `Synthesizer` sobre el mismo `Arc<SoundFont>`**, que no duplica las muestras: `VoiceBank`.
  - Canal 0..14: una pista de voz cada uno.
  - Canal 15: previsualización.
- Al cargar, cada canal recibe RPN 0 con rango de *bend* ±24: `CC101=0, CC100=0, CC6=24`.
  - Ya verifiqué que rustysynth 1.3.7 implementa el RPN 0 (`channel.rs: data_entry_coarse`).
  - También verifiqué que aplica el *bend* por bloque de 64 muestras a las voces que suenan (`voice.rs:214`).
- `next_sample` mezcla los dos sintetizadores.

### Secuenciador (`sequencer.rs`)

- `SeqEvent` gana `kind: On | Off | Bend(f32)` y `voice: Option<u8>` (el canal del `VoiceBank`).
- `compile()` hace esto para cada pista de voz audible:
  1. Corta las notas en frases.
  2. Por frase, un solo note-on en la **altura de referencia**: el centro entre la más grave y la más aguda. Si la frase pasa de ±22 semitonos desde ahí, se parte en dos frases.
  3. Agrega eventos `Bend` a partir de `sample_curve`, con paso de QUARTER/128 (~4 ms a 120 bpm), solo donde cambia más de 1 cent.
  4. Un note-off al final.
- `resume_sounding_notes()` y `Seek` buscan el último `Bend` de cada canal antes de la posición y lo reaplican.
- Mute, solo, volumen y paneo funcionan igual: el paneo va por CC10 en el canal propio.

### Previsualización

- Una pista de voz que se toca o se dibuja suena como hoy, con `previewNotes` y el instrumento de voz.
- Para escuchar una transición hay un comando tauri nuevo, `preview_voice(notes, style)`. Compila un mini horario con la misma función y lo toca en el canal de previsualización del `VoiceBank`.

---

## Etapa 3: Editor (TS / React)

### Comandos tauri y API

- `voice_curve(notes, style, bpm, step)` no guarda estado y llama a `sample_curve`. Sirve para dibujar incluso a mitad de un arrastre (borrador).
- `src/api.ts` gana `voiceCurve` y `previewVoice`.
- Hook `useVoiceCurve(notes, style)`:
  - Va con `requestAnimationFrame`.
  - Si llega una respuesta vieja, se descarta.
  - Así el dibujo y el sonido salen siempre del mismo cálculo de Rust.

### Crear la pista (`TrackLanes.tsx`)

- El popover de tipo de pista suma una tercera opción, **Voz**, con ícono de micrófono.
- La nueva pista se llama «Voz N».

### Carrilla (`src/ui/tracks/voice/`)

- **`VoiceLane.tsx`:** misma estructura que `TrackLane`.
  - Mezclador, nombre e instrumento de voz.
  - Plegada: `MiniNotes` dibuja la curva como una línea.
  - Desplegada: `PianoRoll` con la prop `voice={{ style }}`.
- **`PianoRoll.tsx`**, con cambios mínimos:
  - Si tiene `voice`, dibuja las notas tenues: `drawPianoRoll` recibe la opción `ghost`.
  - Llama a `drawVoiceOverlay(ctx, …)`.
  - Antes de buscar notas bajo el puntero, consulta `voiceHit(x, y)`.
  - Los gestos nuevos viven en `voiceGestures.ts`, para no inflar el archivo.
- **`drawVoice.ts`** dibuja:
  - La curva: una línea gruesa del color de la pista.
  - Un **punto de transición** en cada unión pegada.
  - Una pequeña **onda de vibrato** donde empieza.
- **Gestos:**

| Gesto | Qué cambia |
|---|---|
| Arrastrar el punto de transición en horizontal | `length` (con Alt, libre) |
| Arrastrar el punto de transición con Mayús | `offset` |
| Arrastrar el punto de transición en vertical | `overshoot` |
| Doble clic en el punto de transición | Recta ↔ estilo de la pista |
| Arrastrar la onda de vibrato | `delay` (horizontal) y `depth` (vertical) |
| Nuevo modo del clic **Curva** (ícono onda) en el `Segmented` de Dibujar / Seleccionar / Intensidad | Dibuja `bend` sobre la nota debajo del puntero. Con clic derecho borra. |

- Cada cambio se confirma con un único `setTrackNotes`: un paso de deshacer.
- **`useShortcuts.ts`:** la tecla A, Ctrl+D y las flechas ya funcionan, porque `focus` es de tipo `notes` con la pista.

### Caja de herramientas (`ToolsMenu.tsx`)

- `ToolsTarget` gana `{ kind: "voice", track }`.
- Herramientas disponibles: Transponer, Cuantizar, Humanizar, Repetir, Legato/Staccato y Ajustar a la escala, más dos nuevas:
  - **Transición:** estilos rápidos y deslizadores (duración, desfase, forma, sobrepaso, preparación). Usa el alcance Elegidos/Todos de `useToolScope`, botón «▶ Escuchar» con `previewVoice` y «Usar como estilo de la pista», que llama a `SetVoiceStyle`.
  - **Vibrato:** estilos rápidos y deslizadores, con el mismo alcance.
- Se ocultan Arpegiar, Bajo automático y Acorde desde notas.
- Legato gana importancia: unir notas es lo que crea transiciones.

### Otros

- **`Icon.tsx`:** `mic`, `glide`, `vibrato`, `wave`.
- **i18n:** bloque `voice.*` en es (con tú) y en. Plurales con `_one` / `_other`.

---

## Etapa 4: Exportar y aprender

### MIDI (`midi_export.rs`)

- La pista de voz se exporta en su canal con:
  - el programa GM;
  - RPN ±24;
  - un note-on por frase;
  - los *pitch bend* de `sample_curve`.
- Se abre en cualquier DAW.
- Test: los *bend* que se exportan, reconstruidos, coinciden con `pitch_at` (±2 cents).

### Aprender

- `toolDemos.ts`: `ToolDemo` gana `curve?: [t, p][]` y `voiced?: true`.
- `ToolDemoView.tsx` dibuja la curva sobre las notas.
- `demoSound` usa `previewVoice` cuando el ejemplo es de voz.
- Lecciones nuevas en el grupo Herramientas:
  - **Pista de voz:** qué es y cómo crearla.
  - **Transiciones:** portamento y glissando, con las cuatro formas.
  - **Vibrato**.

---

## Etapa 5: Letra y exportar a OpenUtau

### Letra (UI)

- En una pista de voz, **doble clic en una nota** abre un campo para escribir su sílaba, dibujada dentro de la nota.
- Tab salta a la nota siguiente, como en Synthesizer V y OpenUtau.
- Nueva herramienta **Pegar letra**: reparte un verso entre las notas elegidas, cortando por espacios y guiones (`can-ción` = 2 sílabas).
- Las notas sin letra se exportan con «a».

### Exportar `.ustx` (`crates/tonalia-core/src/ustx.rs`, con `serde_yaml`)

- Resolución 480 por negra: se convierte desde 2592.
- Tempo, compás y una `voice_part` por pista de voz, con sus notas (`position`, `duration`, `tone`, `lyric`).

**Equivalencias con nuestro modelo**

| Tonalia | OpenUtau |
|---|---|
| `Glide` | Puntos de *pitch* de la nota que llega: el primero antes de la unión, a la altura de la nota anterior. |
| Forma `Smooth` / `Linear` / `Early` / `Late` | `io` / `l` / `o` / `i` |
| Sobrepaso y preparación | Un punto extra cada uno. |
| `Vibrato` | `length` en % de la nota, `period` = 1000/`rate` ms, `depth` en cents, `in`/`out` en %. |
| `BendPoint` | Puntos de *pitch* adicionales. |

**Formatos**

- Antes de escribir el conversor, guardar un `.ustx` hecho a mano en OpenUtau con una transición y un vibrato. De ahí se confirman las unidades exactas de `x` (ms) y `y` (cents o décimas de semitono). Ese archivo queda como test de referencia.
- `.ust` (UTAU clásico, Shift-JIS, `PBS/PBW/PBY/PBM` + `VBR`) es opcional, con el mismo conversor.

### Tests

- Una canción con transiciones y vibrato exporta exactamente el `.ustx` esperado.
- La curva que reconstruye OpenUtau con esos puntos, muestreada, queda a menos de 20 cents de `pitch_at`.

### Prueba manual

- Abrir el archivo en OpenUtau con un banco gratuito (en japonés y, si se consigue, en castellano) y escuchar.

---

## Etapa 6: Render propio con bancos UTAU

### Bancos de voz (`src-tauri/src/voicebank/`)

- El usuario elige la carpeta de un banco desde Configuración. Tonalia **no incluye ninguno**, porque cada banco tiene su licencia, y muestra el `readme` y los términos del banco.
- Se lee:
  - `character.txt`;
  - `oto.ini` (Shift-JIS o UTF-8 con `encoding_rs`): por sílaba, offset, consonante, corte, *preutterance* y *overlap*;
  - `prefix.map`.

### Fonetizador

- De la sílaba escrita al alias del banco.
  - Primero CV japonés: hiragana o romaji.
  - Después un mapeo simple de sílabas en castellano para bancos CV y VCV en castellano.
- Si un alias falta, se prueban alternativas y en último caso la vocal sola.

### Síntesis (WORLD, crate `rsworld`)

1. Cada muestra se analiza una sola vez (f0, envolvente espectral, aperiodicidad) y se guarda en caché en disco.
2. Por nota:
   - la consonante queda intacta;
   - la vocal se estira repitiendo o interpolando cuadros;
   - se aplica **nuestra f0** de `sample_curve`, absoluta;
   - se resintetiza.
3. Se encadenan respetando *preutterance* y *overlap*, con fundidos.

### Motor

- Render fuera del hilo de audio, por pista, con una espera de ~300 ms después de cada cambio.
- El secuenciador aprende a reproducir un **clip de audio** colocado en un tick. Si cambia el bpm, se vuelve a renderizar.
- Mientras el render no está listo, o quedó viejo, suena la voz guía.
- Selector por pista: **Voz: guía / banco UTAU**, con un indicador de «renderizando…».

### Tests

- Lectura de `oto.ini` real, con las dos codificaciones.
- La f0 analizada del render sigue a `pitch_at` (±30 cents en los tramos con voz).
- El largo de cada nota se respeta: la consonante cae antes del pulso según su *preutterance*.

### Riesgos

- `rsworld` compila C++: hay que verificar que compile en Windows con MSVC. Plan B: portar a Rust las partes de WORLD que hagan falta.
- Hay pocos bancos en castellano.
- La calidad no va a llegar a la de OpenUtau con sus *resamplers* sin mucho ajuste. Por eso conviene comparar con la etapa 5.

---

## Archivos clave

**Núcleo y audio**
- `crates/tonalia-core/src/model.rs`
- `crates/tonalia-core/src/voice.rs` (nuevo)
- `crates/tonalia-core/src/commands.rs`
- `crates/tonalia-core/src/midi_export.rs`
- `src-tauri/src/audio/sf2.rs`
- `src-tauri/src/audio/sequencer.rs`
- `src-tauri/src/audio/synth.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`

**Interfaz**
- `src/api.ts`
- `src/lib/instruments.ts`
- `src/ui/tracks/TrackLanes.tsx`
- `src/ui/tracks/PianoRoll.tsx`
- `src/ui/tracks/drawPianoRoll.ts`
- `src/ui/tracks/ToolsMenu.tsx`
- `src/ui/tracks/toolScope.tsx`
- `src/ui/tracks/voice/*` (nuevos)
- `src/ui/common/Icon.tsx`
- `src/i18n/*`

**Aprender**
- `src/learn/toolDemos.ts`
- `src/learn/lessons.ts`
- `src/ui/tips/ToolDemoView.tsx`

**Se reutiliza**
- `useToolScope`, `Popover floating`, `Segmented icon`, `setTrackNotes`.
- `noteKey`: en una sola voz no hay dos notas con la misma posición y altura.
- `previewNotes`, `channel_for` (exportación) y el esquema de prueba por CDP (`cdp.mjs`, foto, deshacer hasta igualar).

## Verificación

1. Correr `npm run test:rust` con los tests nuevos de `voice.rs`, comandos, secuenciador y exportación. Después, `npm run bindings` y `tsc` sin errores.
2. **Probar en la app por CDP**, en una canción de prueba, no en «Tonalia-rescate»:
   - Crear una pista de voz y dibujar Do–Mi–Sol pegadas: debe verse la curva.
   - Arrastrar un punto de transición: la curva cambia en vivo, y al soltar queda un solo paso de deshacer.
   - Tocar la canción y escuchar el deslizamiento.
   - Tocar con un *loop* y con *seek*: no debe quedar una nota colgada ni un *bend* viejo.
3. **Herramientas:** Transponer y Cuantizar conservan las transiciones. Legato une notas y aparecen transiciones nuevas. Dos notas superpuestas quedan cortadas.
4. **Exportar MIDI** y revisar los eventos con un script de `midly`: note-on por frase, RPN y *bend*.
5. **Aprender:** las lecciones nuevas se dibujan y suenan.
6. Commit y push solo cuando lo pidas.

## Riesgos y cómo los manejo

- **Timbre «chipmunk»:** al doblar mucho una muestra se deforma.
  - La referencia en el centro de la frase limita el problema a ±11 semitonos en melodías normales.
  - Si suena mal, se pasa a un **relevo entre dos canales**: cada nota ataca en su propia tecla con el *bend* empezando en la nota anterior, y la cola de la anterior sigue la misma curva.
- **Costo de la curva al arrastrar:** el comando no guarda estado y está limitado con `requestAnimationFrame`. Si se nota lento, solo se recalcula la ventana visible.
- **Muchas pistas de voz:** el `VoiceBank` admite 15. Si se pasa, comparten canal y la frase más nueva gana; lo aviso con un tooltip.
