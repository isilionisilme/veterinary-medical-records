[CmdletBinding()]
param([string]$BaseRef = "main")
Write-Host "[DEPRECATED] Use scripts/ci/preflight/test-L1.ps1"
& (Join-Path $PSScriptRoot "test-L1.ps1") -BaseRef $BaseRef
exit $LASTEXITCODE
