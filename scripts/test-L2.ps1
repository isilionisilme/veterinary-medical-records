[CmdletBinding()]
param([string]$BaseRef = "main")
Write-Host "[DEPRECATED] Use scripts/ci/preflight/test-L2.ps1"
& (Join-Path $PSScriptRoot "ci\preflight\test-L2.ps1") -BaseRef $BaseRef
exit $LASTEXITCODE
