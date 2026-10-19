# Arranca Tonalia en modo desarrollo: abre la ventana y recarga al guardar cambios.
# Uso:  & .\scripts\dev.ps1            (normal)
#       & .\scripts\dev.ps1 -Inspect   (además abre el puerto 9222 de depuración de WebView2,
#                                       solo en localhost, para pruebas automáticas)
param([switch]$Inspect)

$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (-not (($env:PATH -split ';') -contains $cargoBin)) {
    $env:PATH = "$cargoBin;$env:PATH"
}
if ($Inspect) {
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222 --remote-allow-origins=http://127.0.0.1:9222"
}
Set-Location (Join-Path $PSScriptRoot "..")
npm run tauri dev
