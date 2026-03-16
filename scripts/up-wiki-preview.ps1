param(
    [int]$Port = 4567,
    [string]$ContainerName = "vetrecords-wiki-preview"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$wikiDir = Join-Path $repoRoot "wiki"
if (-not (Test-Path $wikiDir)) {
    $repoName = Split-Path $repoRoot -Leaf
    $candidateWikiRepo = Join-Path (Split-Path $repoRoot -Parent) ("{0}.wiki" -f $repoName)
    if (Test-Path $candidateWikiRepo) {
        $wikiDir = $candidateWikiRepo
    }
    else {
        throw "Wiki directory not found. Expected '$wikiDir' or sibling wiki repo '$candidateWikiRepo'."
    }
}

$wikiGitDir = Join-Path $wikiDir ".git"
if (-not (Test-Path $wikiGitDir)) {
    Push-Location $wikiDir
    try {
        git init | Out-Null
    }
    finally {
        Pop-Location
    }
}

$hasCommit = $false
Push-Location $wikiDir
try {
    git rev-parse --verify HEAD *> $null
    if ($LASTEXITCODE -eq 0) {
        $hasCommit = $true
    }

    if (-not $hasCommit) {
        $mdCount = (Get-ChildItem $wikiDir -Recurse -Filter "*.md" -ErrorAction SilentlyContinue | Measure-Object).Count
        if ($mdCount -gt 0) {
            git config user.name "Wiki Preview" | Out-Null
            git config user.email "wiki-preview@local" | Out-Null
            git add .
            git commit -m "Initial wiki content for local preview" | Out-Null
        }
    }
}
finally {
    Pop-Location
}

$running = docker ps --filter "name=^/${ContainerName}$" --format "{{.Names}}"
if ($running -eq $ContainerName) {
    Write-Host "Wiki preview is already running in container '${ContainerName}'."
    Start-Process "http://localhost:$Port"
    exit 0
}

$existing = docker ps -a --filter "name=^/${ContainerName}$" --format "{{.Names}}"
if ($existing -eq $ContainerName) {
    docker rm -f $ContainerName | Out-Null
}

$wikiMount = ($wikiDir -replace "\\", "/")
docker run -d --rm --name $ContainerName -p "${Port}:4567" -v "${wikiMount}:/wiki" gollumwiki/gollum | Out-Null

Write-Host "Wiki preview started at http://localhost:$Port"
Start-Process "http://localhost:$Port"
