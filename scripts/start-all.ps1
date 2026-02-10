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

$fixedWindowWidth = 50
$fixedWindowHeight = 40
$powershellExe = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
$conhostExe = Join-Path $env:WINDIR "System32\conhost.exe"

$resizeWindowCommand = @'
try {
    mode con: cols=__FIXED_WIDTH__ lines=__FIXED_HEIGHT__ > $null
} catch {}

try {
$rawUi = $Host.UI.RawUI
$currentWindow = $rawUi.WindowSize
$targetWidth = __FIXED_WIDTH__
$targetHeight = __FIXED_HEIGHT__
$buffer = $rawUi.BufferSize
if ($buffer.Width -lt $targetWidth) {
    $rawUi.BufferSize = New-Object System.Management.Automation.Host.Size($targetWidth, $buffer.Height)
}
$rawUi.WindowSize = New-Object System.Management.Automation.Host.Size($targetWidth, $targetHeight)
} catch {}
'@
$resizeWindowCommand = $resizeWindowCommand.Replace("__FIXED_WIDTH__", $fixedWindowWidth)
$resizeWindowCommand = $resizeWindowCommand.Replace("__FIXED_HEIGHT__", $fixedWindowHeight)

function Start-DevConsole {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$CommandToRun
    )

    $composedCommand = "& { $resizeWindowCommand; Set-Location '$WorkingDirectory'; $CommandToRun }"

    if (Test-Path $conhostExe) {
        Start-Process $conhostExe -ArgumentList @(
            $powershellExe,
            "-NoExit",
            "-Command",
            $composedCommand
        ) | Out-Null
        return
    }

    Start-Process $powershellExe -ArgumentList @(
        "-NoExit",
        "-Command",
        $composedCommand
    ) | Out-Null
}

Start-DevConsole -WorkingDirectory $repoRoot -CommandToRun $backendCommand
Start-DevConsole -WorkingDirectory $frontendDir -CommandToRun "npm run dev"

Write-Host "Entorno iniciado: backend + frontend."
