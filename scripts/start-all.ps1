$ErrorActionPreference = 'Stop'
Write-Host "[DEPRECATED] Use scripts/dev/bootstrap/start-all.ps1"
& (Join-Path $PSScriptRoot "dev\bootstrap\start-all.ps1") @args
exit $LASTEXITCODE
