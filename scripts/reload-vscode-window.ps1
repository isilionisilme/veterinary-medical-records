$ErrorActionPreference = 'Stop'
Write-Host "[DEPRECATED] Use scripts/dev/local-env/reload-vscode-window.ps1"
& (Join-Path $PSScriptRoot "dev\local-env\reload-vscode-window.ps1") @args
exit $LASTEXITCODE
