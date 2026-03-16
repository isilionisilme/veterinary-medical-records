param(
    [string]$ContainerName = "vetrecords-wiki-preview"
)

$ErrorActionPreference = "Stop"

$running = docker ps --filter "name=^/${ContainerName}$" --format "{{.Names}}"
if ($running -ne $ContainerName) {
    Write-Host "Wiki preview container is not running."
    exit 0
}

docker stop $ContainerName | Out-Null
Write-Host "Wiki preview stopped (${ContainerName})."
