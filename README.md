# Tonalia

Composición armónica visual y educativa. Aplicación de escritorio (Tauri 2) con el motor
musical en Rust y la interfaz en React + TypeScript. Proyecto personal y educativo.

## Estructura

```
crates/tonalia-core/   teoría musical pura en Rust (notas, escalas, acordes, armonía,
                       voicing, canción, comandos, deshacer, export MIDI) + tests
src-tauri/             la app de escritorio: estado, comandos y motor de audio
src/                   la interfaz (React): cinta de acordes, rueda armónica, lentes
src/bindings/          tipos TypeScript generados desde Rust (no editar a mano)
scripts/dev.ps1        arranque en modo desarrollo
```

## Comandos

```bash
npm install                  # dependencias de la interfaz (una vez)
npm run tauri dev            # abrir la app en modo desarrollo
npm run test:rust            # todos los tests de Rust
npm run bindings             # regenerar src/bindings tras cambiar tipos en Rust
npx tsc --noEmit             # comprobar los tipos de TypeScript
```

Si la terminal no encuentra `cargo` (recién instalado Rust), usa `scripts/dev.ps1`,
que añade Rust al PATH. Con `-Inspect` abre además el puerto 9222 de depuración de
WebView2 (solo localhost) para pruebas automáticas.

## Unidades

- Tiempo: 10368 ticks = 1 redonda (2592 = negra, 162 = 1/64). La negra es también la
  resolución (PPQ) de los MIDI exportados.
- Alturas: MIDI (60 = Do central). Intensidad: 0..1.
