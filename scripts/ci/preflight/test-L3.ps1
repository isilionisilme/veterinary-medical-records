[CmdletBinding()]
param(
    [string]$BaseRef = "main",
    [switch]$SkipE2E
)
& (Join-Path $PSScriptRoot "preflight-ci-local.ps1") -Mode Full -BaseRef $BaseRef -SkipE2E:$SkipE2E
exit $LASTEXITCODE
