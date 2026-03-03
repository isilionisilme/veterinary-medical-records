[CmdletBinding()]
param([string]$BaseRef = "main")
Write-Host "[DEPRECATED] Use scripts/ci/preflight/preflight-quick.ps1"
& (Join-Path $PSScriptRoot "ci\preflight\preflight-quick.ps1") -BaseRef $BaseRef
exit $LASTEXITCODE
