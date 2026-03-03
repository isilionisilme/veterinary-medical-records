[CmdletBinding()]
param(
    [string]$BaseRef = "main",
    [switch]$SkipE2E
)
Write-Host "[DEPRECATED] Use scripts/ci/preflight/test-L3.ps1"
& (Join-Path $PSScriptRoot "ci\preflight\test-L3.ps1") -BaseRef $BaseRef -SkipE2E:$SkipE2E
exit $LASTEXITCODE
