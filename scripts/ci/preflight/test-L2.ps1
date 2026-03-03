[CmdletBinding()]
param([string]$BaseRef = "main")
& (Join-Path $PSScriptRoot "preflight-ci-local.ps1") -Mode Push -BaseRef $BaseRef
exit $LASTEXITCODE
