# Arranca Tonalia en modo desarrollo: abre la ventana y recarga al guardar cambios.
# Uso:  & .\scripts\dev.ps1

$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (-not (($env:PATH -split ';') -contains $cargoBin)) {
    $env:PATH = "$cargoBin;$env:PATH"
}
Set-Location (Join-Path $PSScriptRoot "..")
npm run tauri dev
