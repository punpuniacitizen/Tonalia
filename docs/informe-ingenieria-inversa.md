# Informe completo de ingeniería inversa de un plug-in VST3 (REA + Ghidra)

> Análisis **estático y de solo lectura** de un plug-in VST3 de composición y teoría musical, distribuido como dos módulos (`…Main.vst3` y `…Track.vst3`), realizado con fines de interoperabilidad (herramientas MIDI y de teoría musical).
> No se modificó ningún binario, no se ejecutó el software y **no se analizó nada relacionado con licencias** (quedó fuera de alcance a propósito).
>
> El nombre comercial del producto solo sobrevive en rutas y cadenas literales extraídas del binario; por lo demás, el análisis lo trata como un objetivo anónimo y no asume conocimiento previo del producto.
>
> Convención usada en todo el documento:
> - **[Observado]** = sale literalmente del binario (cadena, constante, pseudocódigo descompilado).
> - **[Inferido]** = interpretación razonada a partir de lo observado (nombres de funciones, significado musical).
> - **[Abierto]** = no se resolvió.
>
> Todas las direcciones son virtuales (VA) con base de imagen `0x180000000`. Los nombres `FUN_xxxxxxxx` son los que asigna Ghidra (el binario no trae símbolos).

---

## Índice

1. [Entorno y herramientas](#1-entorno-y-herramientas)
2. [Los binarios analizados](#2-los-binarios-analizados)
3. [Arquitectura general](#3-arquitectura-general)
4. [Frameworks y librerías detectadas](#4-frameworks-y-librerías-detectadas)
5. [Módulo Track: el cliente MIDI](#5-módulo-track-el-cliente-midi)
6. [Protocolo Main ⇄ Track](#6-protocolo-main--track)
7. [Módulo Main: mapa de clases](#7-módulo-main-mapa-de-clases)
8. [Modelo de datos musical](#8-modelo-de-datos-musical)
9. [Notas y nombres de notas](#9-notas-y-nombres-de-notas)
10. [Intervalos](#10-intervalos)
11. [Escalas](#11-escalas)
12. [Acordes y símbolos](#12-acordes-y-símbolos)
13. [Voicing: almacenamiento, reproducción y generación](#13-voicing-almacenamiento-reproducción-y-generación)
14. [Puntuación de progresiones ("Tonal Harmony")](#14-puntuación-de-progresiones-tonal-harmony)
15. [Paleta de acordes, préstamo modal y círculo de quintas](#15-paleta-de-acordes-préstamo-modal-y-círculo-de-quintas)
16. [Interfaz gráfica y renderizado](#16-interfaz-gráfica-y-renderizado)
17. [Cadenas de interfaz relevantes (vocabulario del producto)](#17-cadenas-de-interfaz-relevantes)
18. [Tabla maestra de funciones y direcciones](#18-tabla-maestra-de-funciones-y-direcciones)
19. [Técnicas de ingeniería inversa usadas (lo que se aprende)](#19-técnicas-de-ingeniería-inversa-usadas)
20. [Puntos abiertos y límites del análisis](#20-puntos-abiertos-y-límites)
21. [Cómo reproducir el análisis](#21-cómo-reproducir-el-análisis)

---

## 1. Entorno y herramientas

| Componente | Detalle |
|---|---|
| REA (Reverse Engineer Anything) | Repo oficial `morluto/rea` (MIT). Paquete npm `rea-agents@6.7.0`. Código fuente descargado como zip en `Proyectos Programacion/rea/` (solo referencia). |
| Registro MCP | `C:\Users\nocom\.claude.json` → `mcpServers.rea` = `cmd.exe /d /c npx -y rea-agents@6.7.0 mcp` |
| Skill | `C:\Users\nocom\.claude\skills\reverse-engineer-anything\` |
| Ghidra | 12.1.4 (`ghidra_12.1.4_PUBLIC_20260921.zip`, SHA-256 `ddac49f903da9d5bac833e5cc79395098b9c33cfd3279be5f31bd00387d2d4db`) en `C:\Users\nocom\tools\ghidra_12.1.4_PUBLIC` |
| JDK | Eclipse Temurin 21.0.12.1+1 (SHA-256 `f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e`) en `C:\Users\nocom\tools\jdk-21` (carpeta renombrada: el lanzador de REA rechaza metacaracteres en rutas) |
| Variables de entorno de REA | `REA_ANALYSIS_PROVIDER=ghidra`, `GHIDRA_INSTALL_DIR`, `JAVA_HOME`, `REA_GHIDRA_STARTUP_TIMEOUT_MS=1800000`, `REA_GHIDRA_DISABLED_ANALYZERS=WindowsResourceReference` |
| Modo Ghidra en Windows | "Windows P0": **solo lectura**, base de datos efímera, sin GUI ni anotaciones persistentes |

Por qué hizo falta subir el timeout: el módulo Main (13 MB) no terminaba el auto-análisis en los 330 s por defecto. Con el analizador `WindowsResourceReference` desactivado y 30 min de margen tardó ≈10 min. El módulo Track (5 MB) cabe en el límite por defecto.

Herramientas MCP de REA utilizadas: `open_binary`, `binary_overview`, `binary_session`, `inspect_pe_resources`, `search_strings`, `search_bytes`, `xrefs`, `resolve_containing_procedure`, `procedure_pseudo_code`, `procedure_callers`, `procedure_references`, `read_bytes`, `close_binary`. Además se leyó el archivo como datos con PowerShell (extracción de cadenas ASCII) sin ejecutarlo.

---

## 2. Los binarios analizados

### Instalaciones encontradas

| Ruta | Tamaño | Versión |
|---|---|---|
| `C:\Program Files\Common Files\VST3\Klimper Main.vst3` | 13 773 312 B | **2.4** (analizado) |
| `C:\Program Files\Common Files\VST3\Klimper Track.vst3` | 5 403 136 B | **2.4** (analizado) |
| `C:\Program Files\Klimper\Klimper.exe` | 13 646 336 B | 2.4 (standalone, no analizado) |
| `C:\Program Files\Common Files\VST3\Polydigm\Klimper Main.vst3` | 13 676 544 B | 2.3.1 |
| `C:\Program Files\Common Files\VST3\Polydigm\Klimper Track.vst3` | 5 318 656 B | 2.3.1 |
| `C:\Program Files\Polydigm\Klimper.exe` | 13 558 784 B | 2.3.1 |

Los `.vst3` de Windows aquí son **un único archivo PE64 (DLL)**, no un bundle de carpetas.

### Módulo Track (v2.4)

- SHA-256: `ba893275a914f2280d26c9ee58ee2b02a2bc220777660c354cad6f0d4371c615`
- PE32+ x86-64, rol: biblioteca compartida (DLL). Nombre interno del módulo: `Klimper Track.dll`.
- PDB referenciado (no incluido): `Klimper Track.pdb`, GUID `6a3edd86-b5b8-4255-b074-a61953b9c669`, age 1, RSDS.
- Recursos PE: solo `RT_VERSION` (16) y `RT_MANIFEST` (24). Iconos/imágenes van embebidos en `.rdata`.
- Ghidra: **14 521 funciones**, **5 562 cadenas** definidas.

| Segmento | Inicio | Fin (excl.) | Tamaño |
|---|---|---|---|
| Headers | 0x180000000 | 0x180000400 | 1 024 |
| .text | 0x180001000 | 0x1803c2800 | 3 938 304 |
| .rdata | 0x1803c3000 | 0x1804cee00 | 1 097 216 |
| .data | 0x1804cf000 | 0x1804f0500 | 136 448 |
| .pdata | 0x1804f1000 | 0x180523600 | 206 336 |
| _RDATA | 0x180524000 | 0x180524200 | 512 |
| .rsrc | 0x180525000 | 0x180525600 | 1 536 |
| .reloc | 0x180526000 | 0x18052ee00 | 36 352 |

### Módulo Main (v2.4)

- SHA-256: `a97867aa881da43ef7b34ae747fb3dfc8dda118a08f81718c8c940742d7e8c85`
- PDB referenciado (no incluido): `Klimper Main.pdb`, GUID `13e8234f-06f7-46c3-a36c-ecfb3a35488c`.
- Ghidra: **19 146 funciones**, **7 727 cadenas** definidas.
- **Desfase archivo → VA en `.rdata`: `VA = offset + 0x180000C00`** (útil para localizar literales cortos que Ghidra no define como cadena).

| Segmento | Inicio | Fin (excl.) | Tamaño |
|---|---|---|---|
| .text | 0x180001000 | 0x18051c000 | 5 353 472 |
| .rdata | 0x18051c000 | 0x180c95200 | 7 836 160 |
| .data | 0x180c96000 | 0x180d3ca58 | 682 584 |
| .pdata | 0x180d3d000 | 0x180d7e800 | 268 288 |
| .rsrc | 0x180d80000 | 0x180d80600 | 1 536 |
| .reloc | 0x180d81000 | 0x180d90000 | 61 440 |

---

## 3. Arquitectura general

```
┌──────────────────────────────── DAW ────────────────────────────────┐
│                                                                      │
│  Pista de acordes / instrumentos             Pista N                 │
│  ┌──────────────────────┐            ┌──────────────────────┐        │
│  │      Main.vst3       │  TCP local │     Track.vst3       │ ─MIDI→ instrumento
│  │  (motor musical, UI, │◀══════════▶│  (cliente ligero)    │        │
│  │   servidor IPC)      │ 127.0.0.1  │  3 clases propias    │        │
│  └──────────────────────┘  JSON      └──────────────────────┘        │
│        │ "… Main Midi Out" / "Direct Midi Out"                       │
└──────────────────────────────────────────────────────────────────────┘
```

- **[Observado]** Main contiene todo el dominio musical (`polydigm::music`): `Song`, `Section`, `ChordEntry`, `Chord`, `Note`, `Scale`, reproductores, paleta de acordes, UI completa, servidor `track_plugins::Connections`.
- **[Observado]** Track solo tiene `KlimperTrackAudioProcessor`, `KlimperTrackAudioProcessorEditor`, `polydigm::music::track_plugins::KlimperConnection` (+ `polydigm::ThisGuard`). Muestra "Connected to Klimper Main" o "This instance is currently not assigned to a track within the Klimper Main Plug-in."
- **[Observado]** Main avisa: *"Please note that only a single instance of Klimper's Main Plugin can be opened on your system."* → un Main por sistema, N Tracks.
- **[Inferido]** Main decide qué notas suenan y cuándo; cada Track recibe `note_on`/`note_off` por JSON y los emite como MIDI en su pista del DAW. Main además tiene salida MIDI propia y sintetizador SoundFont integrado.

---

## 4. Frameworks y librerías detectadas

| Librería | Evidencia [Observado] |
|---|---|
| **JUCE 8.0.6** | `"JUCE v8.0.6"`, `juce_version_8_0_6`, cientos de RTTI `@juce@@`, `JuceVST3EditController`, `JUCEWindow`, `juceAppLock_` |
| **VST3 SDK (Steinberg)** | `IPlugViewContentScaleSupport@Steinberg`, lista de hosts para workarounds: Cubase 4/5/6/7/8/8.5/9/9.5/10/10.5, Nuendo 3/4/5, Wavelab 5–8, "Steinberg TestHost", "Blue Cat's VST3 Host", "JUCE AudioPluginHost", "My VST3 HostApplication" |
| **nlohmann::json** | Mensajes de error `"type must be number, but is "` (código 302 = `0x12e`), `"type must be array, but is "`, `"cannot use key() for non-object iterators"` (207), `"cannot get value"` (214), `[json.exception.`, `parse error at byte`, RTTI `nlohmann::basic_json<std::map,std::vector,...>` |
| **juce::InterprocessConnection** | RTTI `InterprocessConnection`, `ConnectionThread`, `InterprocessConnectionServer`, `SafeAction` |
| **libpng / zlib** | Mensajes de libpng (`"Only compression method 8 is supported by PNG"`…), `"unsupported zlib version"` |
| **Lector SoundFont 2 (Main)** | `"Instrument generator indices not monotonic"`, `"Preset bag ... not monotonic"`, `Piano_sf2`, `"Grand Piano"`, `built_in_grand_piano`, `"Common Files/Soundfonts"`, `*.sf2`, `"Velocity out of range"` |
| **HarfBuzz (texto, Main)** | `"skipped inserting dotted-circles because there is no broken syllables"`, tablas de scripts |
| **MSVC runtime** | `VCRUNTIME140`, `MSVCP140`, `api-ms-win-crt-*`, RTTI `.?AV...@@` |
| **JUCE WebBrowserComponent** | `window.__JUCE__...`, `__juce__slider`, `__juce__comboBox`, interfaces OLE `IOleInPlaceSite`… **[Abierto]** está enlazado, pero no se confirmó que la UI lo use |

---

## 5. Módulo Track: el cliente MIDI

### 5.1 Conexión con Main

`FUN_180035300` **[Observado]**:
```cpp
connected = conn->connectToSocket("127.0.0.1", port = this[0x1c0], timeoutMs = this[0x1c4]);
if (!connected)
    Timer::callAfterDelay(this[0x1c8], [this]{ retry(); });   // lambda_c27de550…
```
- Host fijo `127.0.0.1` (cadena en `0x18040ed70`).
- **[Abierto]** El número de puerto es un campo (`+0x1c0`) inicializado en tiempo de ejecución; no se leyó su valor.
- **[Inferido]** Reintenta periódicamente hasta que Main esté abierto.

### 5.2 Recepción de mensajes

`FUN_180028c30` = `KlimperConnection::messageReceived(MemoryBlock)` **[Observado]**:
```cpp
text  = String(memoryBlock)
json  = nlohmann::json::parse(text)
key   = primera clave del objeto           // el tipo de mensaje
value = json[key]
if key == <cadena global DAT_1804efef0>:   // [Abierto] valor no leído; probablemente el handshake (uuid)
    guardar juce::Uuid en this+0x1d0 (bajo lock); FUN_180029440(this)
else:
    handlers(this+0x390)[key](value)       // std::map<string, std::function<void(json)>>
```
`FUN_180028a90` accede al mismo mapa bajo lock (**[Inferido]** registro de handlers).

### 5.3 Manejadores de notas → MIDI

| Función | Entrada | MIDI generado |
|---|---|---|
| `FUN_1801c0f10` | JSON (`FUN_1800281e0` parsea `pitch`, `velocity`, `timestamp`) | `0x90, pitch & 0x7F, min(velocity,127)` |
| `FUN_180038460` | JSON (`pitch`, `timestamp`) | `0x80, pitch & 0x7F, 0` |
| `FUN_1801c1cf0` | struct directa | `0x90, pitch & 0x7F, min(vel,127)` |
| `FUN_1801c1c50` | struct directa | `0x80, pitch & 0x7F, 0` |

- Los cuatro construyen `juce::MidiMessage(bytes, 3, timestamp)` (`FUN_18027f150`) y lo encolan con `FUN_1800268c0(this+0x288, msg)`.
- **[Observado]** El byte de estado es siempre `0x90`/`0x80` **sin OR de canal** → canal MIDI 1.
- **[Observado]** Velocity se satura a 127; pitch se enmascara a 7 bits.

### 5.4 Cola thread-safe
```cpp
// FUN_1800268c0
access(queue + 0x50, [msg](std::vector<juce::MidiMessage>& v){ v.push_back(msg); });

// FUN_180029b90  (helper genérico de acceso bajo lock)
AcquireSRWLockExclusive(obj + 0xc0);
fn(obj + 0xc8);                 // el std::vector<MidiMessage>
ReleaseSRWLockExclusive(obj + 0xc0);
```
- **[Observado]** Primitiva: **SRWLock de Win32** (exclusivo).
- **[Inferido]** `processBlock` vacía esa cola en el `MidiBuffer` del DAW. **[Abierto]** la función exacta no se localizó (hay varios lambdas `vector<MidiMessage>&` en RTTI: `f718ee0c…` = push, `e03a0509…`, `d89c55ee…` candidatos al drenaje).

### 5.5 Identidad de la pista
```cpp
// FUN_180027ba0  to_json(std::optional<uint32_t> trackId)
nullopt   → { "chordTrack": 0 }        // esta instancia es la pista de acordes
value(n)  → { "trackId": n }           // número sin signo

// FUN_180027e10  from_json
si el objeto contiene "chordTrack" → nullopt, si no → trackId (acepta int/uint/float/bool)

// FUN_1800283b0  from_json(Track)
"track" → identidad (arriba), "name" → string (+0x08), "instrument" → string (+0x28)
```
Claves JSON contiguas en `.rdata` de Track (`0x18040ecec…`): `name`, `instrument`, `pitch`, `tracks`, `chordTrack`, `trackId`, `timestamp`, `log`, `uuid`, `restored_uuid`, `track`, `track_name`, `127.0.0.1`. `velocity` no aparece porque es un literal corto (≤15 bytes) embebido como inmediato en el código.

### 5.6 Track también lleva la librería de teoría

Track incluye la misma librería `polydigm::music` (tabla en `0x1803d4e00`): `"not a note letter"`, `"not an accidental"`, `Harmonic Minor`, `Ionian`, `Major`, `Minor`, `chromatic`, `Aeolian`, `Locrian`, `Lydian`, `Mixolydian`, `Dorian`, `Phrygian`, `note_off`. Inicializadores estáticos observados:

| Función | Global (nombre / vector) | `steps` |
|---|---|---|
| `FUN_180009a20` | `0x1804d0bc0` / `0x1804d0be0` | Ionian `{2,2,1,2,2,2,1}` |
| `FUN_1800098e0` | `0x1804d0b00` / `0x1804d0b20` | Harmonic Minor `{2,1,2,2,1,3,2}` |

---

## 6. Protocolo Main ⇄ Track

- Transporte: `juce::InterprocessConnection` sobre TCP a `127.0.0.1` (con el framing propio de JUCE: cabecera mágica + longitud).
- Carga útil: **un objeto JSON cuya primera clave es el tipo de mensaje**.

Tipos de mensaje **[Observado]** (tabla en Main `0x1805221b0…`):

| Mensaje | Uso [Inferido] |
|---|---|
| `identify` | El Track se presenta (uuid / trackId) |
| `track_plugin_did_restore_id_after_initial_connect` | El Track restauró su id desde el estado del proyecto |
| `id_already_taken` | Conflicto de id |
| `session_sync` | Sincronización de sesión |
| `list_available_tracks` | Listado de pistas del proyecto de Main |
| `assign_track` | Asignar este Track a una pista de Main |
| `auto_create_and_assign_track` | Crear pista nueva y asignarla |
| `update_name` / `host_track_name_changed` | Nombre de la pista en el DAW |
| `note_on` / `note_off` | Eventos de nota |
| `log` | Mensajes de diagnóstico |

Ejemplos de forma (claves observadas, valores ilustrativos):
```json
{ "note_on":  { "pitch": 60, "velocity": 100, "timestamp": 0.0 } }
{ "note_off": { "pitch": 60, "timestamp": 0.5 } }
{ "identify": { "track": { "trackId": 3 }, "name": "Bass", "instrument": "..." } }
{ "identify": { "track": { "chordTrack": 0 } } }
```
Mensajes de log de Main sobre conexiones: `"connection object created"`, `"destroying connection"`, `"on connection made"`, `"RECEIVED:"`, `"unrecognized message received."`, `"on connection lost"`, `"remove connection"`. UI: `"Wait for New Track Plug-in Instance"`, `"Free Track Plug-in Instances:"`, `"In-Use Track Plug-in Instances:"`, `"Klimper Track Plug-in"`.

---

## 7. Módulo Main: mapa de clases

Extraído de los nombres RTTI de MSVC (282 entradas con `polydigm`).

### 7.1 Interfaz (`polydigm::music::ui`)

`KlimperMainAudioProcessorEditor`, `HeaderComponent`, `TransportControls`, `BpmSelector`, `SnappingSelector`, `EditingModeSwitch`, `UpdateButton`, `ProjectSettingsComponent`, `SectionSettings`, `TimelineComponent`, `SongFrame`, `TrackListComponent`, `StandardTrackEntryComponent`, `TrackMuteSoloControl`, `TrackVolume`, `ChordTrackComponent`, `MidiClipComponent`, `EditorComponent`, `NoteDragging`, `NoteLasso`, `Dragging<BeginningOfNote>`, `Dragging<EndOfNote>`, `Dragging<WholeNote>`, `ChordPalette`, `ChordPaletteContent`, `ChordPaletteItem`, `ChordPaletteToolbar`, `ChordPreviewPlayer`, `ChordDropHandler`, `ChordSymbolisationSwitch`, `RelationsHighlightSwitch`, `PreviewSettings`, `ScaleSelection` (+ `KeysList`, `ModesList`), `ProjectScaleSelector`, `ModeSelector`. Otras: `polydigm::PopupContainerComponent`, `polydigm::ThrottledAction`, `polydigm::klimper::LicensingComponent` (fuera de alcance).

### 7.2 Dominio y reproducción (`polydigm::music`)

Tipos: `Song`, `Section`, `ChordEntry`, `Chord`, `Note`, `Scale`, `TrackSettings`, `MusicalTime`, `ChordQueryResultEntry`, `ScaleQueryResultEntry`, `ChordTrackHandle`, `Outputs::DirectMidiOut`, `chords::Entry`.
Reproductores: `ProjectPlayer`, `HighResProjectPlayer`, `NotePlayer`, `NotePreviewPlayer`.
Red: `track_plugins::Connections`, `track_plugins::Connections::ClientConnection`.

### 7.3 Consultas funcionales sobre `Song` (functores `XAEBUSong…`)

Diseño estilo "query objects": cada consulta es un struct invocable vía `std::function`:

`full_song`, `song_length`, `song_bpm`, `song_scale`, `looping`, `has_track`, `track_name`, `track_settings`, `all_standard_tracks`, `all_track_handles_with_settings`, `tracks_using_instrument`, `instrument_of`, `instruments_in_use`, `is_empty_track_assigned_to_output`, `section_start`, `section_end`, `section_length`, `section_name`, `section_content_length`, `section_accepts_subsections`, `sections_in_range`, `sections_slice_at`, `section_paths_valid`, `is_section_at_path`, `copy_sections_at`, `content_count`, `chords_at`, `chordentry_at`, `query_chord_at`, `chords_in_region`, `chord_entry_length`, `chord_notes_of_entry`, `chord_paths_valid`, `scale_at_position`, `scale_at_path`, `scales_in_region_with_dead_zones`, `notes_at_point`, `notes_in_region`, `all_notes_in_section`, `all_notes_in_track`, `can_insert_notes`, `effective_velocity`.

Predicados sobre notas (`polydigm::music::notes`): `within_pitch_range`, `starting_before`, `starting_in`, `ending_in`, `intersecting`, `intersecting_time_range`, `first_equal_to`, `satisfying_all`.

### 7.4 Comandos de edición (`Command<Song>`)

Patrón comando (undo/redo): `new_section_at_end_of`, `wrap_in_new_section`, `set_section_colors`, `add_track`, `toggle_mute`, `set_volume`, `insert_notes`, `replace_chord_at`, `remove_chords`.

---

## 8. Modelo de datos musical

### 8.1 Estructuras en memoria [Observado por offsets en (de)serializadores]
```cpp
struct MusicalTime { int64_t ticks; };           // 10368 ticks = 1 redonda (ver §13.4)

struct Note {                                    // 0x18 bytes
    MusicalTime position;   // +0x00
    MusicalTime length;     // +0x08
    int32_t     pitch;      // +0x10  (MIDI, absoluto)
    float       velocity;   // +0x14  (0..1 en voicing; se escala al emitir)
};

struct Chord {
    int32_t                 root;       // +0x00  clase de altura 0..11
    std::set<uint16_t>      intervals;  // +0x08  semitonos sobre la fundamental (sin el 0)
};

struct ChordEntry {
    Chord               chord;          // +0x00 .. +0x18
    MusicalTime         length;         // +0x18
    std::vector<Note>   voicing;        // +0x20  notas explícitas
};

struct Scale    { std::string name; std::vector<int32_t> steps; };   // name +0x00, steps +0x20
struct KeyScale { int32_t root; Scale scale; };                       // root +0, name +0x08, steps +0x28 [Inferido de FUN_18003c590 / FUN_1800295b0]

struct PreviewSettings {   // offsets dentro del objeto dueño
    uint32_t    octave;     // +0x18
    MusicalTime strumming;  // +0x20
    float       velocity;   // +0x28
};
```

### 8.2 Formato JSON del proyecto (`*.klp`)

Claves observadas en `.rdata` de Main (`0x180b940d0…`):
`position`, `length`, `pitch`, `velocity`, `root`, `intervals`, `chord`, `voicing`, `chords`, `clipByTrack`, `r`, `g`, `b`, `a`, `steps`, `type`, `color`, `scale`, `children`, `clips`, `sections`, `_start`, `_end`, `bpm`, `tracks`, `chord_track`, `looping`, `no_sync`, `sync_to_bars`, `sync_to`, `notes`, `paths`, `_paths`, `label`, `width`, `name`, `instrument`, `ui_state`, `_wholeNoteWidth`, `_pitchHeight`, `_x`, `_y`, `_width`, `_height`, `window_bounds`, `link_transport_to_host`, `sync_to_host_timeline`, `project`, `plugin_state`, `direct_midi_out`, `current_track`, `frame`, `in_chord_palette`, `chord_symbolisation`, `selection`, `chord_palette`, `pianoroll`, `height`, `snapping`, `velocity_mode`, `content_offset`, `chord_relations`, `selectedScale`, `preview`, `octave`, `strumming`, `home`, `current`, `to_left`, `to_right`, `track_label`.

Serializadores concretos **[Observado]**:

| Tipo | to_json | from_json | Forma |
|---|---|---|---|
| `Chord` | `FUN_180027ea0` | `FUN_180027fe0` | `{"root": <nota>, "intervals": [..]}` |
| `ChordEntry` | `FUN_1800caa90` | `FUN_1800286d0` | `{"chord": {...}, "length": <double>, "voicing": [Note...]}` — `length` se multiplica por **10368.0** al leer |
| `Note` | `FUN_180027580` | — | `{"position": d, "length": d, "pitch": int, "velocity": float}` |
| `vector<Note>` | `FUN_180092bc0` | `FUN_1800a25d0` | array |
| `Scale` | — | `FUN_180029160` | `{"name": string, "steps": [int...]}` (exige array) |
| `PreviewSettings` | `FUN_18006d9f0` | `FUN_18006dcf0` | `{"octave": uint, "strumming": d, "velocity": float}` |
| tiempo | `FUN_180027510` | — | ticks → double |

Ejemplo de entrada de acorde:
```json
{ "chord":  { "root": "Eb", "intervals": [4, 7, 10] },
  "length": 0.5,
  "voicing": [ { "position": 0.0, "length": 0.5, "pitch": 51, "velocity": 1.0 },
               { "position": 0.0, "length": 0.5, "pitch": 55, "velocity": 1.0 } ] }
```
(la representación exacta de `root` en JSON pasa por `FUN_180092b50` / `FUN_180092af0`; el parser de nombres de nota es `FUN_180027d10`)

---

## 9. Notas y nombres de notas

`FUN_180027d10` **[Observado]** — parser de nombre de nota a clase de altura:
```cpp
letra:  C=0  D=2  E=4  F=5  G=7  A=9  B=11  H=11   (H = notación alemana; el namespace propio apunta a un desarrollador germano-hablante)
otra letra → excepción "not a note letter"
para cada carácter siguiente:
    '#' → +1,  'b' → −1,  otro → excepción "not an accidental"
    resultado = mod12(resultado)
```
Admite alteraciones acumuladas (`"Cbb"`, `"F##"`).

Ortografía de escalas (`FUN_18003c590`) usa `FUN_18003cff0` / `FUN_18003cde0` para elegir nombre con sostenidos o bemoles según un parámetro de preferencia.

---

## 10. Intervalos

Constantes globales `uint16` en semitonos **[Observado]** (`0x180c97fe8 … 0x180c9802c`):

| Dirección | Valor | Intervalo |
|---|---|---|
| 0x180c98008 | 1 | 2ª menor |
| 0x180c98000 | 2 | 2ª mayor (sus2) |
| 0x180c97fe8 | 3 | 3ª menor |
| 0x180c97ffc | 4 | 3ª mayor |
| 0x180c9800c | 5 | 4ª justa (sus4) |
| 0x180c98014 | 6 | tritono |
| 0x180c97ff4 | 7 | 5ª justa |
| 0x180c98010 / 0x180c98018 | 8 | 6ª menor / 5ª aumentada (dos alias) |
| 0x180c9802c | 9 | 6ª mayor |
| 0x180c98004 | 10 | 7ª menor |
| 0x180c98024 | 11 | 7ª mayor |
| 0x180c97ff8 | 12 | octava |
| 0x180c97ff0 | 13 | 9ª menor (b9) |
| 0x180c97fec | 14 | 9ª |
| 0x180c98020 | 17 | 11ª |
| 0x180c9801c | 18 | #11 |
| 0x180c98028 | 20 | b13 |

Alias en tiempo de inicialización (stubs `mov eax,[src]; mov [dst],eax; ret` en `0x1800021e0…`):

| Destino | ← Fuente (valor) |
|---|---|
| 0x180cd42a4 | 0x180c98008 (1) |
| 0x180cd4258 | 0x180c98008 (1) |
| 0x180cd4298 | 0x180c98000 (2) |
| 0x180cd4294 | 0x180c97fe8 (3) |
| 0x180cd4290 | 0x180c97ffc (4) |
| 0x180cd429c | 0x180c9800c (5) |
| 0x180cd4280 | 0x180c98014 (6) |
| 0x180cd4288 | 0x180c97ff4 (7) |
| 0x180cd428c | 0x180cd4260 |
| 0x180cd426c | 0x180c980c8 |

Patrón típico de C++ `inline const Interval sus2 = major_second;` → el compilador lo resuelve en arranque.

---

## 11. Escalas

### 11.1 Representación

`Scale = { name, steps }`, donde `steps` son **pasos en semitonos entre grados consecutivos**.

Escalas observadas por nombre: `Major`, `Minor`, `Ionian`, `Dorian`, `Phrygian`, `Lydian`, `Mixolydian`, `Aeolian`, `Locrian`, `Harmonic Minor`, `chromatic`.

Inicializadores en Main (`0x180003a80 … 0x180004611`, 12 referencias al alias de semitono):

| Función | Escala | steps |
|---|---|---|
| `FUN_180003bb0` | Major (`0x180c97db0`, vector `0x180c97dd0`) | `{W, W, H, W, W, W, H}` con W=`0x180cd3c68`, H=`0x180cd3c4c` |
| `FUN_180003a80` | chromatic (`0x180c97e30`, vector `0x180c97e50`) | 11 × H |

`W` y `H` valen 0 en la imagen (se asignan en tiempo de ejecución); por consistencia con Major son 2 y 1 **[Inferido]**.

### 11.2 Cómo se convierten pasos en grados — `FUN_18003c590` [Observado]
```cpp
deg = key.root
for step in scale.steps:
    emit(deg)                    // registra el grado y su nombre ortográfico en tabla[deg]
    deg = mod12(deg + step)      // el paso se suma DESPUÉS de emitir
for pc in 0..11:
    if tabla[pc] vacía: tabla[pc] = nombre ortográfico por defecto
```
Consecuencias:

1. **El último paso nunca se usa** (solo "cerraría" la octava).
2. Harmonic Minor `{2,1,2,2,1,3,2}` (suma 13, dato "incorrecto") produce grados correctos `0,2,3,5,7,8,11`.
3. **[Inferido]** `chromatic` con 11 pasos produce solo las clases `0…10`; la clase 11 no figura como grado (solo recibe nombre en el relleno). Rareza a tener en cuenta si replicas el comportamiento.

### 11.3 Escala del proyecto y regiones

- `song_scale`, `scale_at_position`, `scale_at_path`, `scales_in_region_with_dead_zones` devuelven `std::optional<Scale>` / vectores de `ScaleQueryResultEntry`: la escala puede cambiar por sección ("Set Song scale", "Project scale", "Select the project's home key").

---

## 12. Acordes y símbolos

### 12.1 Modelo

`Chord = { root: 0..11, intervals: std::set<uint16> }` — conjunto ordenado de semitonos sobre la fundamental. No guarda inversión ni octava: eso vive en el voicing.

### 12.2 Vocabulario de símbolos [Observado]

Tokens en `.rdata` (`0x180b94440…`): `#`, `iii`, `iv`, `vi`, `vii`, `5`, `?7` (carácter no ASCII, probablemente `°7`/`ø7`), `#11`, `b13`, `sus2`, `sus4`, `add`, `no5`, `7/9/11/13`, `7/9/11`, `7/9`, `m`, `maj`. Los números romanos cortos (`I`, `ii`…) son inmediatos en código. Dos modos de visualización: *"Show chord symbols with pitch names"* / *"Show chord symbols in roman notation"*.

### 12.3 Paso "sus" del generador de símbolos — `FUN_18003e350` [Observado]
```cpp
symbol = ""
if 3 ∉ intervals and 4 ∉ intervals:          // sin tercera
    if 2 ∈ intervals: remaining.erase(2); symbol += "sus2"
    if 5 ∈ intervals: remaining.erase(5); symbol += "sus4"
return symbol                                   // el resto de intervalos lo consumen otros pasos
```
**[Abierto]** Los demás pasos del nombrado (m, 7, extensiones, add, no5) no se descompilaron uno a uno.

### 12.4 Utilidades de acordes [Observado]

| Función | Qué hace |
|---|---|
| `FUN_180038be0` | Copia un `Chord` (root + set) |
| `FUN_180069020` | Transpone un acorde a grado relativo: `root = mod12(root − key)` |
| `FUN_180038cd0` | Conjunto de clases de altura del acorde (root + intervalos, mod 12) |
| `FUN_1800284c0` | `isSus(chord)`: contiene 2 o 5 |
| `FUN_180069a10` | `susNote(chord)` → `optional<int>`: `root+2` si hay 2, si no `root+5` si hay 5 |
| `FUN_180069b70` | Nota "objetivo" del acorde destino (usada para resolución) **[Inferido]** |
| `FUN_180028470` / `FUN_180028420` | Predicados sus4 / sus2 **[Inferido]** |

---

## 13. Voicing: almacenamiento, reproducción y generación

### 13.1 Almacenamiento

Cada `ChordEntry` guarda su `voicing` como `std::vector<Note>` explícito (§8.1). UI: *"Voicing — Edit freely how the chords are being voiced"*.

### 13.2 Reproducción — `chord_notes_of_entry` [Observado]

Vtable del functor `_Func_impl<chord_notes_of_entry>` en `0x180b8c9d8`; slot `_Do_call` = `0x1800b33e0`:
```cpp
e = chordentry_at(path)                              // FUN_18002b780
return notes_in_region(e.voicing, start=0, end=e.length, cutoff=e.length, minPitch=0, maxPitch=127)

notes_in_region (FUN_180030db0):
    if start <= fin_ultima_nota and end >= 0:
        copy_if(notes, satisfying_all{
            within_pitch_range(min, max),
            starting_before(cutoff),
            intersecting_time_range(start, end) })
```
No genera nada: filtra el voicing guardado.

### 13.3 Generación del voicing por defecto [Observado]

Se crea con la **misma cadena que la vista previa de la paleta**, `FUN_18006d830`:
```cpp
preview_notes(settings, chord, velScale):
    n = chord_to_notes(chord, length = 0x2880 /*10368*/, vel = velScale * settings.velocity)   // FUN_18006d1e0
    n = strum(settings.strumming, n)                                                          // FUN_18006d530
    n = register_fix(this[0x2c0], n)                                                          // FUN_18006d3f0
    n = transpose(settings.octave * 12, n)                                                    // FUN_18006d320

chord_to_notes(chord, L, v):
    notes = [ Note(pos 0, len L, pitch = chord.root, vel v) ]
    for iv in chord.intervals (orden ascendente del std::set):
        notes += Note(pos 0, len L, pitch = chord.root + iv, vel v)    // posición cerrada, fundamental abajo

strum(s, notes):
    for i, n in enumerate(notes):
        d = i * s
        n.position += d
        n.length = max(n.length - d, 162)        // 162 ticks = 1/64

register_fix(t, notes):
    if mod12(notes[0].pitch) < t: transpose(+12)  // [Abierto] origen de t (campo +0x2c0)

transpose(k, notes): for n: n.pitch += k
```
Quién lo usa:
- `FUN_18006f630` = inicio de arrastre de un `ChordPaletteItem` **[Observado]**: busca el `DragAndDropContainer` padre, construye `ChordEntry{ chord = (root this+0xf0, intervals this+0xf8), length = 0x2880, voicing = preview_notes(settings, chord, 1.0f) }` y arranca el drag con la carga `[[drop_chord_entries]]`.
- `FUN_18006d8e0` (segundo llamador, envoltorio de la vista previa) **[No descompilado]**.

Ajustes de vista previa en la UI: `Strumming` (`None`, `1/64`, `1/32`, …), `Octave`, `Transpose`, *"Change chord preview settings"*.

### 13.4 Unidad de tiempo

- `length` por defecto del acorde de paleta: 10368 ticks.
- Duración mínima tras strum: 162 ticks = 10368 / 64.
- ⇒ **10368 ticks = 1 redonda**, 2592 = negra, 162 = semifusa. 10368 = 2⁷·3⁴: divisible exactamente por tresillos y subdivisiones finas (cuadrícula: `1/8`, `1/4`, `1/8 triplets`, `1/16 triplets`, `Bars`, `Beats`, `8ths`).

---

## 14. Puntuación de progresiones ("Tonal Harmony")

### 14.1 Función de puntuación — `FUN_180282e50` [Observado]

Devuelve un `float` (constantes `0x3f800000`=1.0, `0x3f4ccccd`=0.8, `0x3f333333`=0.7, `0`=0.0):
```cpp
score(A /*acorde previo*/, B /*candidato*/, key):
    if !A.valido:                                  return 0.8   // sin contexto
    if !isSus(A) and !isSus(B):
        if A.root == B.root or functional(A,B,key): return 1.0
        if chromatic_root_motion(A,B,key):         return 0.7
    else:
        if sus_resolves(A,B):                      return 1.0
        if susNote(B) ∈ pitchClasses(A):           return 0.7   // suspensión preparada
    return 0.0
```
Llamadores de las dos reglas: `0x180282e50` y `0x180284170` (**[No descompilado]** el segundo; probablemente la dirección inversa o el resaltado de relaciones).

### 14.2 Reglas funcionales — `FUN_180069100` [Observado + interpretación]

Ambos acordes se pasan a grados relativos con `FUN_180069020`. Tabla de grados estáticos (registros de 32 bytes, raíz en el primer dword) en `0x180c97af0…`:

| Dirección | Raíz | Grado [Inferido] |
|---|---|---|
| 0x180c97af0 | 2 | ii |
| 0x180c97b30 | 2 | ii |
| 0x180c97bb0 | 5 | IV |
| 0x180c97bf0 | 5 | IV |
| 0x180c97c50 | 7 | V |
| 0x180c97c90 | 9 | vi |
| 0x180c97cb0 | 11 | vii° |
| 0x180c97d30 | 8 | bVI |
| 0x180cd3c30 | 0 (sin escrituras → .bss) | I |

(otros registros de la tabla: `b10`=11, `b50`=1, `b70`=3, `b90`=11, `bd0`=6, `c10`=8, `c30`=10, `c70`=7, `cd0`=4, `cf0`=4, `d10`=1, `d50`=2 — usados por funciones no descompiladas)
```cpp
functional(A, B, key):
    if A.root(absoluta) == key:                        return true    // desde la tónica, todo vale
    a = deg(A), b = deg(B)
    if mod12(b − a) == 5:                              return true    // quinta descendente (ii→V, V→I, vi→ii…)
    if (a,b) ∈ { (IV,vii°), (V,I), (vii°,I), (vi,IV),
                 (bVI,ii), (bVI,IV), (ii,vii°), (IV,V) }: return true
    return false
```

### 14.3 Movimiento cromático de fundamentales — `FUN_180069650` [Observado]
```cpp
chromatic_root_motion(A, B, key):
    if A.root == key: return true
    i = mod12(B.root − A.root)
    return i ∈ {1, 2, 5, 6, 8, 9}
```
[Inferido] = subir 2ª menor/mayor, bajar 5ª (=subir 4ª), tritono, bajar 3ª mayor/menor (=subir 6ª menor/mayor): las "progresiones fuertes" clásicas (Rameau/Schoenberg) más el tritono.

### 14.4 Resolución de suspensiones — `FUN_180069cd0` [Observado]
```cpp
sus_resolves(A, B):
    s = susNote(A); t = targetNote(B)            // ambos optional
    if !s or !t: return false
    if isSus4(A): return t ∈ { s−1, s−2 }         // la 4ª baja por grado conjunto
    if isSus2(A): return t ∈ { s+1, s+2 }         // la 2ª sube por grado conjunto
    return false
```

### 14.5 Modos de coincidencia

Tabla de opciones (inicializadores estáticos `0x180005c40`, `0x180005cf9`): `disabled`, `No Matching`, `tonal_harmony` / `Tonal Harmony`. UI: *"Find Matching Chords"*, *"Match against Notes"*. **[Inferido]** El modo "Tonal Harmony" ordena/resalta la paleta con `score()`; "Match against Notes" filtra por las notas existentes en esa posición. **[Abierto]** el código exacto del filtrado de la paleta.

---

## 15. Paleta de acordes, préstamo modal y círculo de quintas

- UI: *"Show Chord Palette"*, *"If enabled, the chord palette follows the project's scale"*, *"Select a key to borrow chords from"*, *"Select a parallel mode to borrow chords from"*, *"Step left/right on the circle of fifth to borrow chords from adjacent scales"*, claves `home`, `current`, `to_left`, `to_right`.
- `FUN_1800295b0` **[Observado]**: `root = mod12(root − 7)` sobre un `KeyScale` → un paso a la izquierda en el círculo de quintas. `FUN_180029720` (gemela, no descompilada) **[Inferido]** `+7`.
- `FUN_180048c70` = constructor de la barra de la paleta (7 KB), donde vive el tooltip de "Find Matching Chords" (`0x18004a42a`).
- `FUN_18005baa0` usa la tonalidad del proyecto y construye entradas de paleta ordenadas **[parcialmente interpretado]**.
- Inserción desde notas seleccionadas: *"Set as Chord"*, *"Add as Chord"*, `" (with "` + nota + `" as root)"`, *"Selected Notes"* (función UI `FUN_180078ef0`, 4 KB, no descompilada).
- Carga útil de arrastre: `[[drop_chord_entries]]`, `[[drop_chords_from_paths]]`, `[[drop_sections_from_paths]]` (manejado por `ChordDropHandler`).

---

## 16. Interfaz gráfica y renderizado

**[Observado]** (RTTI + importaciones), común a Main y Track:

| Capa | Clases / APIs |
|---|---|
| Ventana | `juce::HWNDComponentPeer` (+ `WindowClassHolder`), ventanas Win32 propias, `ScaleFactorListener` / `NativeScaleFactorNotifier` (DPI) |
| Render principal | **Direct2D**: `Direct2DGraphicsContext`, `Direct2DHwndContext`, `D2DRenderContext`, `WrappedD2DHwndContext`, `WrappedD2DHwndContextTransparent`, `Direct2DImageContext`, `Direct2DPixelData`, `Direct2DFactories`; `D3D11CreateDevice` (d3d11.dll), `CreateDXGIFactory2` (dxgi.dll); hilo dedicado **"JUCE D2D swap chain thread"** |
| Respaldos | `GDIRenderContext`, `LowLevelGraphicsSoftwareRenderer`, `SoftwareImageType`, `WindowsBitmapImage`; GDI32 (`SetMapMode`, `SetStretchBltMode`) |
| Texto | DirectWrite (`IDWriteFontCollectionLoader`, `DWriteFontFileLoader`, `DWriteFontFileStream`, `TextAnalysis`), HarfBuzz en Main |
| Imágenes | `PNGImageFormat`, `JPEGImageFormat`, `GIFImageFormat`, iconos SVG embebidos (`menu-scale.svg`, `more-horiz-circle.svg`) |
| Accesibilidad | Proveedores UI Automation (`IRawElementProviderSimple`, `IGridProvider`, `ITextProvider`, `IValueProvider`, …) |
| Plugin | `IPlugViewContentScaleSupport` (VST3, escalado de la vista) |

Conclusión: **ninguna llamada gráfica directa del plug-in al SO**; todo pasa por el pipeline de JUCE 8 (Direct2D sobre swap chain DXGI, respaldo GDI/software).

---

## 17. Cadenas de interfaz relevantes

Menús y acciones: `Undo`, `Redo`, `Delete`, `Delete Track`, `Select All Sections`, `Select All Notes`, `Find Matching Chords`, `Zoom In/Out (Horizontal/Vertical)`, `Get Help online`, `Online Manual` (`https://www.klimper-plugin.com/help`), `Save Klimper Project as...`, `Choose a Klimper Project to open...`.
Pistas: `Add new track`, `New Track`, `Chord Track`, `Chords`, `Built-in Instruments`, `Inst.`, `Klimper Main Midi Out`, `Direct Midi Out`.
Edición: `move` (*"Enable to move notes and edit note lengths."*), `velocity_mode` (*"Hold left mouse button down on a note and drag up to increase, down to decrease velocity."*), snapping (*"Select the grid width for snapping notes, chords, and sections lengths."*).
Composición: *"Create melodies and basslines based on your chord progression"*.
Secciones: `Name and Color`, `Set Playback Region`, `Insert New Sub-Section`, `Wrap In New Section`, `New Section`.
Transporte: `play`, `rewind`, `loop`, `link` (*"If enabled, playback and stop is triggered also by your DAW."*), `Align Playback to Host's Timeline`, BPM ± (*"decrement/increment bpm by one step"*).
Exportación: *"Drag this to your DAW to export your current selection."*, `clip.mid`, `Drag to export midi clip`, `Selection empty`.
Errores internos: `"trying to access a subsection where are none!"`, `"selected track has to be in project"`, `"track entry could not be found"`, `"cannot dismiss section settings, parent calloutbox not found!"`, `"trying to show a popup without having a PopupContainerComponent in it's parental hierarchy"`.
Red (fuera de alcance, solo se anota que existe): `https://api.klimper.polydigm.de:3000`, `/products/2/version`, `update_info_uri`, `download`, *"Update available. Click for more infos!"*.

---

## 18. Tabla maestra de funciones y direcciones

### Track

| Dirección | Rol |
|---|---|
| `FUN_180035300` | Conectar a `127.0.0.1:port` y reintentar con timer |
| `FUN_180028c30` | `messageReceived`: parse JSON + despacho por mapa |
| `FUN_180028a90` | Acceso al mapa de handlers (`+0x390`) |
| `FUN_180029b90` | Acceso bajo SRWLock (`+0xc0` lock, `+0xc8` dato) |
| `FUN_1800268c0` | Encolar `MidiMessage` |
| `FUN_1801c0f10` / `FUN_1801c1cf0` | note_on (JSON / struct) |
| `FUN_180038460` / `FUN_1801c1c50` | note_off (JSON / struct) |
| `FUN_1800281e0` | from_json(NoteEvent) |
| `FUN_1800283b0` | from_json(Track) |
| `FUN_180027ba0` / `FUN_180027e10` | to/from_json(trackId / chordTrack) |
| `FUN_18027f150` | Construir `juce::MidiMessage` |
| `FUN_180009a20` / `FUN_1800098e0` | Inicializar Ionian / Harmonic Minor |

### Main

| Dirección | Rol |
|---|---|
| `FUN_180027d10` | Parser de nombre de nota (incl. H) |
| `FUN_180027ea0` / `FUN_180027fe0` | to/from_json(Chord) |
| `FUN_1800286d0` / `FUN_1800caa90` | from/to_json(ChordEntry) |
| `FUN_180027580` / `FUN_180092bc0` | to_json(Note) / to_json(vector<Note>) |
| `FUN_180029160` | from_json(Scale) |
| `FUN_180003bb0` / `FUN_180003a80` | Inicializar Major / chromatic |
| `0x1800021e0…` | Stubs de alias de constantes de intervalo |
| `FUN_18003c590` | Tabla de grados/ortografía de una escala (último paso ignorado) |
| `FUN_1800295b0` | Tonalidad −7 semitonos (círculo de quintas) |
| `FUN_18003e350` | Paso "sus2/sus4" del nombrado |
| `FUN_180038be0` / `FUN_180069020` / `FUN_180038cd0` | Copia / a grado relativo / clases de altura |
| `FUN_1800284c0` / `FUN_180069a10` / `FUN_180069cd0` | isSus / susNote / resolución de sus |
| `FUN_180069100` | Reglas funcionales |
| `FUN_180069650` | Movimiento cromático {1,2,5,6,8,9} |
| `FUN_180282e50` | Puntuación de transición (1.0/0.8/0.7/0.0) |
| `0x1800b33e0` | `chord_notes_of_entry::_Do_call` (vtable `0x180b8c9d8`) |
| `FUN_180030db0` | `notes_in_region` con predicados |
| `FUN_18006d830` | Cadena vista previa / voicing por defecto |
| `FUN_18006d1e0` / `FUN_18006d530` / `FUN_18006d3f0` / `FUN_18006d320` | chord→notas / strum / registro / transponer |
| `FUN_18006d9f0` / `FUN_18006dcf0` | to/from_json(PreviewSettings) |
| `FUN_18006f630` | Arrastre desde la paleta → `ChordEntry` |
| `FUN_180048c70` | UI barra de la paleta |
| `FUN_180078ef0` | UI "Set/Add as Chord" desde notas |

---

## 19. Técnicas de ingeniería inversa usadas

Lo que conviene aprender de este análisis, en el orden en que se aplicó:

1. **Elegir el objetivo más pequeño primero.** Track (5 MB) reveló la arquitectura cliente/servidor en minutos y orientó el análisis de Main.
2. **RTTI de MSVC = nombres de clase gratis.** Aunque no haya PDB, MSVC deja cadenas `.?AVNombre@namespace@@` (clase) y `.?AU…` (struct). Buscarlas con regex excluyendo `juce|std|Steinberg` aísla el código propio.
3. **Cadena → xref → función.** Buscar una cadena distintiva (`"127.0.0.1"`, `"chordTrack"`, `"intervals"`), pedir sus referencias y resolver la función contenedora.
4. **Literales cortos (SSO).** `std::string` de MSVC guarda ≤15 bytes inline; el compilador los escribe como inmediatos: `0x6863746970` = `"pitch"`, `0x797469636f6c6576` = `"velocity"`, `0x746f6f72` = `"root"`. Leer los inmediatos en little-endian como ASCII.
5. **Literales no definidos por Ghidra.** Calcular su VA desde el offset del archivo (`VA = offset + 0x180000C00` en `.rdata` de Main) y pedir xrefs a esa dirección.
6. **nlohmann::json se reconoce por su `value_t`.** 0 null, 1 object, 2 array, 3 string, 4 boolean, 5 number_integer, 6 number_unsigned, 7 number_float, 8 binary. Los códigos de excepción (302, 207, 214) delatan la librería.
7. **`std::set`/`std::map` de MSVC.** Nodo: `_Left` +0, `_Parent` +8, `_Right` +0x10, `_Color` +0x18, `_Isnil` +0x19, valor desde +0x1c/+0x20. Los bucles que comparan `*(ushort*)(nodo+0x1c)` son búsquedas `find()`.
8. **`std::function` y vtables.** RTTI del `_Func_impl` → TypeDescriptor (cadena − 0x10) → xref = Complete Object Locator (TD ref − 0xc) → xref = `vtable − 8`. Slot 2 = `_Do_call` → llega al `operator()` del functor.
9. **Aritmética del compilador.** `x % 12` aparece como `imul 0x2AAAAAAB` (o `-0x2aaaaaab`), y `x * 12` como `lea r,[r+r*2]; shl r,2`. Buscar esos patrones con `search_bytes` (con máscara) encontró todo el código de teoría musical.
10. **Floats como enteros.** `0x3f800000` = 1.0, `0x3f4ccccd` = 0.8, `0x3f333333` = 0.7: devolver un float desde una función de puntuación.
11. **Datos estáticos vs. inicialización dinámica.** Valores en `.data` pueden ser placeholders sobrescritos al arrancar (stubs `mov eax,[src]; mov [dst],eax; ret`). Si una global no tiene escrituras y está en `.bss`, vale 0.
12. **Validar con la teoría.** Las constantes "raras" (13, 14, 18, 20) cobran sentido como semitonos de extensiones (b9, 9, #11, b13); la regla `{1,2,5,6,8,9}` coincide con las progresiones fuertes clásicas. Separar siempre "observado" de "interpretado".
13. **Gestionar el coste del análisis.** Binarios grandes en Ghidra/Windows: subir `REA_GHIDRA_STARTUP_TIMEOUT_MS`, desactivar `WindowsResourceReference`, y cerrar la sesión (`close_binary`) al terminar.

---

## 20. Puntos abiertos y límites

| Tema | Estado |
|---|---|
| Función de `processBlock` que vacía la cola MIDI en Track | [Abierto] (patrón inferido) |
| Puerto TCP (`+0x1c0`) y clave de handshake (`DAT_1804efef0`) en Track | [Abierto] (valores de runtime / no leídos) |
| Ruta Main→Track: quién envía `note_on` desde `ProjectPlayer` / `Connections` | [Abierto] |
| Resto del nombrado de acordes (m, 7, extensiones, add, no5, romanos) | [Abierto] solo se vio el paso sus |
| Umbral del ajuste de registro (`this+0x2c0`) | [Abierto] posiblemente tonalidad del proyecto |
| `chromatic` sin la clase 11 | [Inferido] de la lógica; no verificado en ejecución |
| Filtrado exacto de "Find Matching Chords" / "Match against Notes" | [Inferido] usa `score()`; código de la paleta no descompilado |
| Segundo llamador de las reglas (`0x180284170`) | [No descompilado] |
| Lectores/escritores de estado `.klp` completos (secciones, clips, colores) | Claves conocidas; funciones no descompiladas |
| WebBrowserComponent (UI web) | Enlazado; uso no confirmado |
| Licencias, activación, red de actualizaciones | **Fuera de alcance por decisión explícita** |
| Standalone y versión 2.3.1 | No analizados |

Limitaciones generales: análisis estático (nada se ejecutó); el pseudocódigo de Ghidra no es el código fuente original; los nombres de funciones "con sentido" son interpretaciones.

---

## 21. Cómo reproducir el análisis

1. Asegurar que REA aparece en Claude Code con Ghidra disponible (`binary_session` → proveedor `ghidra` "available").
2. `open_binary` con `provider_id: "ghidra"` sobre el `.vst3`; la primera consulta (`binary_overview`) dispara el auto-análisis (Track ≈ 3–5 min, Main ≈ 10 min).
3. Buscar RTTI propio:
   ```text
   search_strings  regex  ^\.\?A[VU](?!.*(juce|std@@|Steinberg|lambda|_Func|_Ref_count)).*   (case sensitive)
   ```
4. Buscar claves/cadenas de dominio (`intervals`, `voicing`, `octave`, `strumming`, `127.0.0.1`) → `xrefs` → `resolve_containing_procedure` → `procedure_pseudo_code`.
5. Para literales cortos de Main: calcular `VA = offset_archivo + 0x180000C00` y pedir `xrefs`.
6. Para código aritmético musical: `search_bytes` patrón `8D 00 00 C1 E0 02` máscara `FF 00 00 FF F8 FF` (multiplicaciones ×12) en `0x180020000–0x1800d0000`.
7. Al terminar: `close_binary`.

---

*Generado a partir del análisis realizado el 18–19 de octubre de 2026 sobre la versión 2.4 con REA 6.7.0 y Ghidra 12.1.4.*
