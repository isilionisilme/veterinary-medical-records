[CmdletBinding()]
param(
    [string]$BaseRef = "main",
    [switch]$SkipE2E
)
Write-Host "[DEPRECATED] Use scripts/ci/preflight/preflight-full.ps1"
& (Join-Path $PSScriptRoot "ci\preflight\preflight-full.ps1") -BaseRef $BaseRef -SkipE2E:$SkipE2E
exit $LASTEXITCODE
