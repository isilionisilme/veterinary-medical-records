$ErrorActionPreference = 'Stop'
Write-Host "[DEPRECATED] Use scripts/dev/local-env/reset-dev-db.ps1"
& (Join-Path $PSScriptRoot "dev\local-env\reset-dev-db.ps1") @args
exit $LASTEXITCODE
