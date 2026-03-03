$ErrorActionPreference = 'Stop'
Write-Host "[DEPRECATED] Use scripts/ci/hooks/install-pre-push-hook.ps1"
& (Join-Path $PSScriptRoot "ci\hooks\install-pre-push-hook.ps1") @args
exit $LASTEXITCODE
