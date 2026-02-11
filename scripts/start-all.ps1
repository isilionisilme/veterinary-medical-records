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
$backendWindowTitle = "US21 Backend Dev"
$frontendWindowTitle = "US21 Frontend Dev"
$scriptMutexName = "Global\US21StartAllMutex"

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

function Get-DescendantProcessIds {
    param(
        [Parameter(Mandatory = $true)][int]$RootPid
    )

    $visited = New-Object 'System.Collections.Generic.HashSet[int]'
    $queue = New-Object System.Collections.Queue
    $queue.Enqueue([int]$RootPid)

    while ($queue.Count -gt 0) {
        $currentPid = [int]$queue.Dequeue()
        if (-not $visited.Add($currentPid)) {
            continue
        }

        Get-CimInstance Win32_Process -Filter "ParentProcessId = $currentPid" -ErrorAction SilentlyContinue |
            ForEach-Object { $queue.Enqueue([int]$_.ProcessId) }
    }

    return @($visited)
}

function Stop-ProcessSubtree {
    param(
        [Parameter(Mandatory = $true)][int]$RootPid
    )

    $all = Get-DescendantProcessIds -RootPid $RootPid
    if (-not $all -or $all.Count -eq 0) {
        return
    }

    # Stop children first, then the root process to close windows cleanly.
    $ordered = $all | Sort-Object -Descending
    foreach ($pidToStop in $ordered) {
        Stop-Process -Id $pidToStop -Force -ErrorAction SilentlyContinue
    }
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
            Stop-ProcessSubtree -RootPid $pid
        }
    }
}

function Stop-ExistingDevWindows {
    $targetTitles = @($backendWindowTitle, $frontendWindowTitle)
    Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $targetTitles -contains $_.MainWindowTitle } |
        ForEach-Object { Stop-ProcessSubtree -RootPid $_.Id }
}

function Stop-DevProcessesByCommandLine {
    $patterns = @(
        "npm run dev",
        "backend.app.main:create_app"
    )

    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $cmd = $_.CommandLine
            if (-not $cmd) { return $false }
            foreach ($pattern in $patterns) {
                if ($cmd -like "*$pattern*") { return $true }
            }
            return $false
        } |
        ForEach-Object { Stop-ProcessSubtree -RootPid ([int]$_.ProcessId) }
}

function Stop-TrackedProcesses {
    if (-not (Test-Path $processStateFile)) {
        return
    }

    try {
        $state = Get-Content $processStateFile -Raw | ConvertFrom-Json
        foreach ($pid in @($state.pids)) {
            if ($pid -is [int] -and $pid -gt 0) {
                Stop-ProcessSubtree -RootPid $pid
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
        [Parameter(Mandatory = $true)][string]$CommandToRun,
        [Parameter(Mandatory = $true)][string]$WindowTitle
    )

    $composedCommand = "& { `$Host.UI.RawUI.WindowTitle = '$WindowTitle'; $resizeWindowCommand; Set-Location '$WorkingDirectory'; $CommandToRun }"

    return Start-Process $powershellExe -PassThru -ArgumentList @(
        "-NoExit",
        "-Command",
        $composedCommand
    )
}

$mutex = New-Object System.Threading.Mutex($false, $scriptMutexName)
$hasLock = $false
try {
    $hasLock = $mutex.WaitOne(0)
    if (-not $hasLock) {
        Write-Host "Ya hay una ejecucion de start-all en curso. Espera un momento y vuelve a intentarlo."
        exit 1
    }

    Stop-TrackedProcesses
    Stop-ExistingDevWindows
    Stop-DevProcessesByCommandLine
    Stop-PortProcess -Port 8000
    Stop-PortProcess -Port 5173
    $backendProcess = Start-DevConsole -WorkingDirectory $repoRoot -CommandToRun $backendCommand -WindowTitle $backendWindowTitle
    $frontendProcess = Start-DevConsole -WorkingDirectory $frontendDir -CommandToRun "npm run dev" -WindowTitle $frontendWindowTitle

    @{
        pids = @($backendProcess.Id, $frontendProcess.Id)
        started_at = (Get-Date).ToString("o")
    } | ConvertTo-Json | Set-Content -Path $processStateFile -Encoding UTF8

    Write-Host "Entorno iniciado: backend + frontend."
}
finally {
    if ($hasLock) {
        $mutex.ReleaseMutex() | Out-Null
    }
    $mutex.Dispose()
}
