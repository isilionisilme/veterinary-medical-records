param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $backendDir)) {
    throw "No se encontro la carpeta backend en: $backendDir"
}

if (-not (Test-Path $frontendDir)) {
    throw "No se encontro la carpeta frontend en: $frontendDir"
}

$backendCommand = if (Test-Path $venvPython) {
    "& '$venvPython' -m uvicorn backend.app.main:create_app --factory --reload"
} else {
    "uvicorn backend.app.main:create_app --factory --reload"
}

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$repoRoot'; $backendCommand"
)

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$frontendDir'; npm run dev"
)


Write-Host "Entorno iniciado: backend + frontend."
