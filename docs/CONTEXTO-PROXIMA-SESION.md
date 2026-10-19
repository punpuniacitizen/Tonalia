# Contexto para la próxima sesión

> Léelo al empezar (o pídele a Claude: "lee docs/CONTEXTO-PROXIMA-SESION.md y seguimos").
> Estado al 19-10-2026, commit `ff0aa02` + este documento.

## Qué es Tonalia

Versión propia, personal y educativa, de un plug-in de composición armónica que se
analizó por ingeniería inversa (ver [informe-ingenieria-inversa.md](informe-ingenieria-inversa.md)).
Se reimplementa solo el **comportamiento musical**; no se copia código, nombre, marca ni
assets del original, y no se toca nada de licencias.

## Decisiones tomadas (no re-discutir)

- **Escritorio con Tauri 2.** Motor en **Rust**, interfaz en **React + TypeScript**.
- El núcleo de teoría (`crates/tonalia-core`) es Rust puro: servirá también para un
  futuro plug-in VST3/CLAP con nih-plug.
- La canción vive en Rust (única fuente de verdad). La UI envía `EditCommand` y recibe
  un `SongView` (canción + análisis: símbolos, romanos, función, tensión, puntuación).
- Sonido: sintetizador FM propio (cpal) + exportar `.mid`. Sin MIDI en vivo por ahora.
- Educación mixta con niveles (Inicial / Medio / Avanzado), interfaz español + inglés.
- Estética "Estudio nocturno" (oscuro, acordes que brillan). Priorizar UI creativa y
  visual sobre paneles monolíticos.
- Tipos TS generados con **ts-rs** (`npm run bindings` → `src/bindings/`).

## Qué está hecho

| Fase | Estado |
|---|---|
| 0. Entorno (Rust, Build Tools C++, Git, Tauri) | ✅ |
| 1. Núcleo teórico `tonalia-core` (51 tests) | ✅ |
| 2. Audio + Rueda armónica + Cinta de acordes + lente | ✅ verificado con capturas |
| 3. Pistas y piano roll inteligente | 🟡 casi: carriles, piano roll con coloreado armónico, herramientas, teclado y "acorde desde notas" hechos; falta verificar en ventana los últimos ajustes (cinta compacta con piano roll abierto, notas fuera de escala en rojo), probar mover/estirar/lazo/intensidad y "acorde desde notas" |
| 4. Secciones, guardar/abrir, export MIDI, SoundFont | pendiente |
| 5+. Capa educativa | pendiente |

Detalles de la fase 2:
- `src-tauri/src/audio/`: `synth.rs` (FM, 4 instrumentos: piano, bajo, pulsado, colchón),
  `sequencer.rs` (compila la canción a eventos, motor muestra a muestra, colas `rtrb`),
  `mod.rs` (hilo de audio con cpal 0.18).
- `src-tauri/src/commands.rs`: `get_view`, `apply_edit`, `undo`, `redo`, `get_palette`,
  `detect_chord`, `preview_chord`, `preview_notes`, `stop_preview`, `transport_*`,
  `audio_status`. Evento `transport` ~30 Hz.
- `src/ui/`: `shell/Header` (transporte, BPM, tonalidad, conmutadores), `timeline/`
  (regla, secciones, Cinta de acordes, cursor), `wheel/` (Rueda armónica + muelle),
  `lenses/` (lente del acorde, ajustes de previsualización).
- Stores zustand en `src/stores/` (song, ui, transport, drag).

**Sin verificar:** el sonido no se pudo escuchar (solo tests). Confirmar que suena bien
y sin cortes.

## Próximos pasos (fase 3: pistas y piano roll inteligente)

1. **Carriles de pistas** bajo la cinta: nombre, color, mute/solo/volumen, instrumento,
   agregar/borrar (`AddTrack`, `RemoveTrack`, `UpdateTrack`, `UpdateChordTrack` ya existen).
   Mostrar las notas de cada pista en miniatura (`SongView.trackNotes`).
2. Un carril **se expande con animación a piano roll** (no ventana aparte). Canvas 2D.
3. **Coloreado armónico de filas** según el acorde que suena en cada instante: notas del
   acorde brillantes, de la escala tenues, fuera de escala oscuras/rayadas. Datos en
   `ChordView.label.pitchClasses` y `ChordView.key` (escala por región).
4. Voicing del acorde como sombra de fondo (`ChordView.voicing`).
5. Herramientas: dibujar, mover, redimensionar inicio/fin, lazo, modo velocity, imán
   (`Grid`). Al soltar se envía un único `SetTrackNotes` con todas las notas absolutas.
6. Tira de teclado abajo que se ilumina al reproducir; clic en una tecla = `preview_notes`.
7. "Fijar / Añadir como acorde" desde notas seleccionadas (`detect_chord`, con
   alternativas de fundamental).

Después: fase 4 (secciones anidadas con escala propia, envolver, región de bucle,
guardar/abrir `.tonalia` con autoguardado, exportar `.mid` por diálogo y arrastrando al
DAW con `tauri-plugin-drag`, soporte `.sf2` con `rustysynth`). Fase 5: "¿por qué suena
bien?" ampliado, anatomía del acorde + reloj cromático, escalas como formas, líneas de
voces + voicing suave, mapa de gravedad T–S–D, biblioteca de progresiones, Tonnetz,
entrenamiento auditivo, mástil de guitarra, rearmonización. El plan completo aprobado
está en la sección "Fases" de abajo.

## Pendientes menores conocidos

- La cabecera es justa a 1024 px de ancho: agrupar los conmutadores en un menú "Vista"
  en ventanas estrechas.
- Al cambiar el programa durante la reproducción se cortan las notas sostenidas
  (se liberan las voces del secuenciador).
- Diseño propio donde el original quedó abierto: nombrado completo de acordes, romanos,
  `target_note` de las suspensiones (cualquier nota del acorde destino a 1–2 semitonos)
  y umbral de registro (= tónica). Cromática con 12 notas y menor armónica con pasos
  correctos (diferencias intencionales).

## Puesta en marcha en otra máquina (notebook)

Requisitos en Windows (con winget):

```bash
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
winget install --id Rustlang.Rustup -e
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
```

Si Build Tools ya existe pero incompleto, hay que **modificarlo** como administrador:
`setup.exe modify --installPath "<ruta BuildTools>" --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive`.

Luego:

```bash
git clone <url-del-repo> tonalia
cd tonalia
npm install
npm run test:rust
npm run tauri dev
```

La primera compilación tarda ~6 min. En PowerShell recién instalado usar
`scripts\dev.ps1` (añade `~\.cargo\bin` al PATH). `scripts\dev.ps1 -Inspect` abre el
puerto 9222 de WebView2 (solo localhost) para que Claude haga capturas y simule clics por
CDP sin mover el ratón.

## Fases (plan aprobado, resumen)

0. Entorno · 1. Núcleo con tests · 2. Primer sonido: cinta + rueda + audio ·
3. Pistas y piano roll inteligente · 4. Proyecto completo (hito: recreación) ·
5+. Capa educativa (se planifica en detalle al llegar).
