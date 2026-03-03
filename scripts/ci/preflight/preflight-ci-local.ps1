[CmdletBinding()]
param(
    [string]$BaseRef = "main",
    [ValidateSet("Quick", "Push", "Full")]
    [string]$Mode = "Push",
    [switch]$ForceFull,
    [switch]$SkipE2E
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
Set-Location $repoRoot

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    Write-Host "`n==> $Name" -ForegroundColor Cyan
    $global:LASTEXITCODE = 0
    & $Action
    if (-not $?) { throw "Step failed: $Name" }
    if ($LASTEXITCODE -ne 0) { throw "Step failed with exit code ${LASTEXITCODE}: $Name" }
}

function Resolve-PythonCommand {
    $localVenvPython = Join-Path $repoRoot ".venv/Scripts/python.exe"
    if (Test-Path $localVenvPython) { return $localVenvPython }
    return "python"
}

$python = Resolve-PythonCommand
Write-Host "preflight-ci-local: mode=$Mode base-ref=$BaseRef"

Invoke-Step "Canonical docs guard" { & $python "scripts/docs/check_no_canonical_router_refs.py" }
Invoke-Step "Doc change classification" { & $python "scripts/docs/classify_doc_change.py" "--base-ref" $BaseRef }
Invoke-Step "Doc/test sync guard" { & $python "scripts/docs/check_doc_test_sync.py" "--base-ref" $BaseRef }
Invoke-Step "Doc/router parity guard" { & $python "scripts/docs/check_doc_router_parity.py" "--base-ref" $BaseRef }
Invoke-Step "Brand compliance guard" { & $python "scripts/quality/lint/check_brand_compliance.py" "--base-ref" $BaseRef }
Invoke-Step "Docs links (changed scope)" { node scripts/docs/check_docs_links.mjs --changed-only --base-ref $BaseRef }
Invoke-Step "Frontend design system guard" { npm --prefix frontend run check:design-system }

if ($Mode -eq "Quick") {
    Invoke-Step "Backend unit (quick)" { & $python "-m" "pytest" "backend/tests/unit" "-q" "-o" "addopts=" }
}
elseif ($Mode -eq "Push") {
    Invoke-Step "Backend unit" { & $python "-m" "pytest" "backend/tests/unit" "-q" "-o" "addopts=" }
    Invoke-Step "Frontend lint" { npm --prefix frontend run lint }
    Invoke-Step "Frontend tests" { npm --prefix frontend run test }
}
else {
    Invoke-Step "Backend tests" { & $python "-m" "pytest" "backend/tests" "-q" "-o" "addopts=" }
    Invoke-Step "Frontend lint" { npm --prefix frontend run lint }
    Invoke-Step "Frontend tests" { npm --prefix frontend run test }
    if (-not $SkipE2E) {
        Invoke-Step "E2E smoke" { npm --prefix frontend run test:e2e:smoke }
    }
}

Write-Host "`npreflight-ci-local: PASS" -ForegroundColor Green
