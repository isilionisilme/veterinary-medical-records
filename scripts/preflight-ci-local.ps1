[CmdletBinding()]
param(
    [string]$BaseRef = "main",
    [switch]$All,
    [switch]$SkipDocker
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    Write-Host "`n==> $Name" -ForegroundColor Cyan
    $global:LASTEXITCODE = 0
    & $Action
    if (-not $?) {
        throw "Step failed: $Name"
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Step failed with exit code ${LASTEXITCODE}: $Name"
    }
}

function Get-GitOutput {
    param([string[]]$Arguments)

    $output = & git @Arguments 2>$null
    if ($LASTEXITCODE -ne 0) {
        return @()
    }

    if (-not $output) {
        return @()
    }

    return @($output | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ })
}

function Get-ChangedFiles {
    param([string]$BaseRefValue)

    $set = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

    $sources = @(
        @("diff", "--name-only", "$BaseRefValue...HEAD"),
        @("diff", "--name-only"),
        @("diff", "--name-only", "--cached")
    )

    foreach ($args in $sources) {
        foreach ($line in (Get-GitOutput -Arguments $args)) {
            $normalized = $line.Replace("\", "/")
            [void]$set.Add($normalized)
        }
    }

    return @($set | Sort-Object)
}

function Test-MatchesAny {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string[]]$Patterns
    )

    foreach ($pattern in $Patterns) {
        if ($Path -like $pattern) {
            return $true
        }
    }

    return $false
}

function Resolve-PythonCommand {
    $venvPython = Join-Path $repoRoot ".venv/Scripts/python.exe"
    if (Test-Path $venvPython) {
        return $venvPython
    }

    return "python"
}

function Resolve-NpmCommand {
    $npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
    if ($npmCmd) {
        return $npmCmd.Source
    }

    return "npm"
}

$python = Resolve-PythonCommand
$npm = Resolve-NpmCommand
$changedFiles = Get-ChangedFiles -BaseRefValue $BaseRef

Write-Host "preflight-ci-local: base-ref=$BaseRef"
if ($changedFiles.Count -eq 0) {
    Write-Host "No changed files detected (branch diff + staged + unstaged)."
}
else {
    Write-Host "Changed files:"
    $changedFiles | ForEach-Object { Write-Host " - $_" }
}

$backendPatterns = @(
    "backend/*",
    "requirements*.txt",
    "pyproject.toml",
    "pytest.ini"
)

$frontendPatterns = @(
    "frontend/*"
)

$docsPatterns = @(
    "docs/*",
    "*.md",
    "scripts/*"
)

$dockerPackagingPatterns = @(
    ".dockerignore",
    ".env.example",
    "Dockerfile.backend",
    "Dockerfile.frontend",
    "docker-compose.yml",
    "docker-compose.dev.yml",
    ".github/workflows/ci.yml",
    "shared/*",
    "backend/*",
    "frontend/*"
)

$backendChanged = $changedFiles | Where-Object { Test-MatchesAny -Path $_ -Patterns $backendPatterns } | Select-Object -First 1
$frontendChanged = $changedFiles | Where-Object { Test-MatchesAny -Path $_ -Patterns $frontendPatterns } | Select-Object -First 1
$docsChanged = $changedFiles | Where-Object { Test-MatchesAny -Path $_ -Patterns $docsPatterns } | Select-Object -First 1
$dockerChanged = $changedFiles | Where-Object { Test-MatchesAny -Path $_ -Patterns $dockerPackagingPatterns } | Select-Object -First 1

$runDocs = $All.IsPresent -or [bool]$docsChanged
$runBackend = $All.IsPresent -or [bool]$backendChanged
$runFrontend = $All.IsPresent -or [bool]$frontendChanged -or [bool]$backendChanged
$runFrontendGuards = $All.IsPresent -or [bool]$frontendChanged
$runDocker = -not $SkipDocker.IsPresent -and ($All.IsPresent -or [bool]$dockerChanged)

Write-Host "`nExecution plan:"
Write-Host " - Docs guards:      $runDocs"
Write-Host " - Backend quality:  $runBackend"
Write-Host " - Frontend build:   $runFrontend"
Write-Host " - Frontend guards:  $runFrontendGuards"
Write-Host " - Docker guard:     $runDocker"

if ($runDocs) {
    Invoke-Step "Docs canonical guard" {
        & $python "scripts/check_no_canonical_router_refs.py"
    }

    Invoke-Step "Doc/test sync guard" {
        & $python "scripts/check_doc_test_sync.py" "--base-ref" $BaseRef
    }

    Invoke-Step "Doc/router parity guard" {
        & $python "scripts/check_doc_router_parity.py" "--base-ref" $BaseRef
    }
}

if ($runBackend) {
    Invoke-Step "Backend lint (Ruff)" {
        & ruff check .
    }

    Invoke-Step "Backend format check (Ruff)" {
        & ruff format --check .
    }

    Invoke-Step "Backend tests (Pytest + coverage)" {
        & pytest -x --tb=short --cov=backend/app --cov-report=term-missing
    }

    Invoke-Step "Backend security audit (pip-audit)" {
        & pip-audit --requirement backend/requirements.txt --strict --ignore-vuln GHSA-2c2j-9gv5-cj73 --ignore-vuln GHSA-7f5h-v6xp-fcq8
    }
}

if ($runFrontend) {
    Invoke-Step "Frontend dependencies" {
        & $npm --prefix frontend ci
    }

    Invoke-Step "Frontend lint" {
        & $npm --prefix frontend run lint
    }

    Invoke-Step "Frontend format check" {
        & $npm --prefix frontend run format:check
    }

    Invoke-Step "Frontend tests (coverage)" {
        & $npm --prefix frontend run test:coverage
    }

    Invoke-Step "Frontend build" {
        & $npm --prefix frontend run build
    }
}

if ($runFrontendGuards) {
    Invoke-Step "Brand guard (frontend changed)" {
        & $python "scripts/check_brand_compliance.py" "--base-ref" $BaseRef
    }

    Invoke-Step "Frontend design system guard" {
        & $npm --prefix frontend run check:design-system
    }
}

if ($runDocker) {
    Invoke-Step "Build backend image" {
        & docker build -f Dockerfile.backend -t vetrecords-backend:ci .
    }

    Invoke-Step "Assert backend shared contract in image" {
        $backendCid = (& docker create vetrecords-backend:ci).Trim()
        try {
            $backendContract = Join-Path $env:TEMP "backend_global_schema_contract.json"
            if (Test-Path $backendContract) {
                Remove-Item $backendContract -Force
            }
            & docker cp "${backendCid}:/app/shared/global_schema_contract.json" $backendContract
            if (-not (Test-Path $backendContract)) {
                throw "backend global schema contract missing in image"
            }
        }
        finally {
            & docker rm -f $backendCid | Out-Null
        }
    }

    Invoke-Step "Build frontend image" {
        & docker build -f Dockerfile.frontend -t vetrecords-frontend:ci .
    }

    Invoke-Step "Assert frontend shared contract in image" {
        $frontendCid = (& docker create vetrecords-frontend:ci).Trim()
        try {
            $frontendContract = Join-Path $env:TEMP "frontend_global_schema_contract.json"
            if (Test-Path $frontendContract) {
                Remove-Item $frontendContract -Force
            }
            & docker cp "${frontendCid}:/app/shared/global_schema_contract.json" $frontendContract
            if (-not (Test-Path $frontendContract)) {
                throw "frontend global schema contract missing in image"
            }
        }
        finally {
            & docker rm -f $frontendCid | Out-Null
        }
    }
}

if (-not ($runDocs -or $runBackend -or $runFrontend -or $runFrontendGuards -or $runDocker)) {
    Write-Host "No CI-equivalent checks selected by changed paths."
}

Write-Host "`npreflight-ci-local: PASS" -ForegroundColor Green
