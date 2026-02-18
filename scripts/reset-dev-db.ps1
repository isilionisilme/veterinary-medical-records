param(
    [switch]$NoStartBackend
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$storageDir = Join-Path $backendDir "storage"
$venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $backendDir)) {
    throw "No se encontro la carpeta backend en: $backendDir"
}

$dbPath = if ([string]::IsNullOrWhiteSpace($env:VET_RECORDS_DB_PATH)) {
    Join-Path $backendDir "data\documents.db"
} else {
    $env:VET_RECORDS_DB_PATH
}

function Stop-PortProcess {
    param(
        [Parameter(Mandatory = $true)][int]$Port
    )

    $lines = netstat -ano -p TCP | Select-String -Pattern "LISTENING" | Select-String -Pattern "[:\.]$Port\s"
    foreach ($line in $lines) {
        $parts = ($line.Line -replace "\s+", " ").Trim().Split(" ")
        if ($parts.Count -lt 5) {
            continue
        }
        $pid = 0
        if ([int]::TryParse($parts[-1], [ref]$pid) -and $pid -gt 0) {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "Reiniciando estado local de desarrollo..."
Stop-PortProcess -Port 8000

if (Test-Path $dbPath) {
    Remove-Item -Path $dbPath -Force
    Write-Host "DB eliminada: $dbPath"
} else {
    Write-Host "DB no encontrada (ok): $dbPath"
}

if (Test-Path $storageDir) {
    Remove-Item -Path $storageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $storageDir -Force | Out-Null
Write-Host "Storage reiniciado: $storageDir"

if ($NoStartBackend) {
    Write-Host "Reset completado. Backend no iniciado (NoStartBackend)."
    exit 0
}

if (-not (Test-Path $venvPython)) {
    throw "No se encontro Python del entorno virtual en: $venvPython"
}

Set-Location $repoRoot
Write-Host "Iniciando backend en http://localhost:8000 ..."
& $venvPython -m uvicorn backend.app.main:create_app --factory --reload
