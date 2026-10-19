# Contexto para la próxima sesión

> Léelo al empezar (o pídele a Claude: "lee docs/CONTEXTO-PROXIMA-SESION.md y seguimos").
> Estado al 19-10-2026. Repo: https://github.com/punpuniacitizen/Tonalia (rama `main`).

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
- Sonido: **banco SoundFont GeneralUser GS** (`assets/soundfonts/`, licencia permisiva v2.0,
  incluida) reproducido con `rustysynth`; el sintetizador FM propio queda de respaldo.
- Educación mixta con niveles (Inicial / Medio / Avanzado), interfaz español + inglés.
- Estética "Estudio nocturno". Priorizar UI creativa y visual sobre paneles monolíticos.
- Tipos TS generados con **ts-rs** (`npm run bindings` → `src/bindings/`).

## Qué está hecho (todas las fases del plan)

| Fase | Estado |
|---|---|
| 0. Entorno | ✅ |
| 1. Núcleo teórico `tonalia-core` | ✅ 92 tests |
| 2. Audio + Rueda armónica + Cinta de acordes + lente | ✅ |
| 3. Pistas y piano roll inteligente | ✅ verificado en ventana |
| 4. Proyecto: secciones, guardar/abrir, autoguardado, exportar/arrastrar MIDI, SoundFont, bucle | ✅ |
| 5. Capa educativa | ✅ (ver lista) |

### Funciones por zona

- **Cabecera:** menú Archivo (Nuevo/Abrir/Guardar/Guardar como/Exportar MIDI, Ctrl+N/O/S/E),
  pastilla **MIDI** para arrastrar la canción a un DAW, transporte, BPM (arrastrar o rueda),
  tonalidad, C-D-E/Do-Re-Mi, nombres/romanos, menú Vista (nivel e idioma),
  **Biblioteca** y **Oído** (entrenamiento), deshacer/rehacer, ajustes de sonido
  (motor sampleado/sintetizador, octava, rasgueo, intensidad, tríadas/cuatríadas).
- **Línea de tiempo:** regla (clic = cursor, arrastrar = región de bucle; doble clic la
  quita), secciones (clic = editor: nombre, color, tonalidad propia, añadir, subsección,
  envolver, borrar; "+" añade al final), pista de acordes con botones **Voces** (líneas de
  conducción de voces), **Suavizar** (voicing con mínimo movimiento) y **Restablecer**.
- **Cinta de acordes:** color = función, altura = tensión, arcos = fuerza de la transición;
  arrastrar para mover, borde para estirar.
- **Pistas:** instrumento (piano de cola, piano eléctrico, guitarra, arpa, bajo, cuerdas,
  colchón), M/S, volumen; se despliegan como **piano roll inteligente** (filas coloreadas
  por el acorde que suena, voicing de fondo, notas fuera de escala en rojo, herramientas
  dibujar/seleccionar/intensidad, teclado lateral, "Acorde desde notas").
- **Muelle inferior:** selector **Rueda / Mapa T–S–D / Tonnetz**.
  - Rueda armónica: diatónicos, prestados (modo elegible) o vecinas, arcos de puntuación.
  - Mapa T–S–D: la progresión como recorrido entre zonas; luz que se mueve al reproducir.
  - Tonnetz: triángulos = acordes, camino de la progresión, transformaciones **P/R/L**.
- **Lente del acorde** (columna izquierda al seleccionar): anatomía en **teclado / reloj
  cromático / mástil**, notas escritas, "por qué suena bien" con puntuación y
  **Alternativas** para rearmonizar (relativo, préstamo, tritonal, V7 antes, sus, séptima).
- **Tips con clic derecho** (`src/tips/tips.ts`): funciones tonales, todos los modos
  (carácter, nota característica, medidor oscuro→brillante, cuándo usarlos, ejemplo
  sonoro), mayor/menor, papeles de las notas, transiciones, círculo de quintas, préstamos,
  tensión, conducción de voces y Tonnetz.
- **Biblioteca:** 16 progresiones famosas (pop, jazz, blues, andaluza, canon, épica,
  modales…), se escuchan y se añaden en tu tonalidad (o en su relativa).
- **Entrenamiento auditivo:** intervalos, calidad de acordes y funciones, según el nivel.
- **Escalas como formas:** el polígono de la escala de la tonalidad en un reloj cromático
  (columna izquierda del muelle), con su patrón de tonos y semitonos.
- **Suspensiones animadas:** en la lente de un acorde sus, la nota suspendida se desliza
  hasta la tercera y se puede escuchar la resolución.
- **Bienvenida y ayuda** (primera vez, botón "?" o tecla `?`): pasos básicos y atajos.
- Exportar solo la **región de bucle** (menú Archivo) y editar durante la reproducción sin
  cortes (las notas que suenan se retoman).

## Verificado y sin verificar

- Verificado con capturas por CDP: todo lo anterior salvo el arrastre nativo del MIDI al
  DAW (se comprobó que el archivo se prepara; falta probar soltarlo en un DAW real).
- **El sonido no se pudo escuchar** (solo tests y estado del motor). Confirmar que el
  banco sampleado suena bien y sin cortes.

## Ideas para seguir

- Exportar una sola pista (el comando `export_midi` ya acepta `tracks`).
- Salida MIDI en vivo (midir) y, más adelante, plug-in VST3/CLAP con nih-plug.
- Importar proyectos del formato original (`.klp`, claves conocidas en el informe §8.2).
- Más contenido educativo: tips sobre cadencias concretas, dominantes secundarias, modulación.
- Al editar en plena reproducción las notas que suenan se re-atacan (no hay silencio, pero
  se oye el nuevo ataque).

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
git clone https://github.com/punpuniacitizen/Tonalia.git
cd Tonalia
npm install
npm run test:rust
npm run tauri dev
```

La primera compilación tarda ~6 min. En PowerShell recién instalado usar
`scripts\dev.ps1` (añade `~\.cargo\bin` al PATH). `scripts\dev.ps1 -Inspect` abre el
puerto 9222 de WebView2 (solo localhost) para que Claude haga capturas y simule clics por
CDP sin mover el ratón.
