param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
$processStateFile = Join-Path $repoRoot ".start-all-processes.json"

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

function Stop-TrackedProcesses {
    if (-not (Test-Path $processStateFile)) {
        return
    }

    try {
        $state = Get-Content $processStateFile -Raw | ConvertFrom-Json
        foreach ($pid in @($state.pids)) {
            if ($pid -is [int] -and $pid -gt 0) {
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {
        # Ignore malformed state file and continue with port cleanup.
    } finally {
        Remove-Item $processStateFile -Force -ErrorAction SilentlyContinue
    }
}

function Start-DevConsole {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$CommandToRun
    )

    $composedCommand = "& { $resizeWindowCommand; Set-Location '$WorkingDirectory'; $CommandToRun }"

    if (Test-Path $conhostExe) {
        return Start-Process $conhostExe -PassThru -ArgumentList @(
            $powershellExe,
            "-NoExit",
            "-Command",
            $composedCommand
        )
    }

    return Start-Process $powershellExe -PassThru -ArgumentList @(
        "-NoExit",
        "-Command",
        $composedCommand
    )
}

Stop-TrackedProcesses
Stop-PortProcess -Port 8000
Stop-PortProcess -Port 5173

$backendProcess = Start-DevConsole -WorkingDirectory $repoRoot -CommandToRun $backendCommand
$frontendProcess = Start-DevConsole -WorkingDirectory $frontendDir -CommandToRun "npm run dev"

@{
    pids = @($backendProcess.Id, $frontendProcess.Id)
    started_at = (Get-Date).ToString("o")
} | ConvertTo-Json | Set-Content -Path $processStateFile -Encoding UTF8

Write-Host "Entorno iniciado: backend + frontend."
