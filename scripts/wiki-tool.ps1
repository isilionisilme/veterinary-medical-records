param(
    [Parameter(Position = 0)]
    [ValidateSet("preview", "publish", "stop", "sync")]
    [string]$Action = "sync",

    [int]$Port = 4567,
    [string]$ContainerName = "vetrecords-wiki-preview",
    [switch]$NoSync,
    [string]$BrowserTitleHint = "Home"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$repoName = Split-Path $repoRoot -Leaf
$workspaceWiki = Join-Path $repoRoot "wiki"
$wikiRepo = Join-Path (Split-Path $repoRoot -Parent) ("{0}.wiki" -f $repoName)
$previewWiki = Join-Path $repoRoot "tmp\wiki-preview"

function Get-RelativePathCompat {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BasePath,
        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )

    if ([System.IO.Path].GetMethods() | Where-Object { $_.Name -eq "GetRelativePath" }) {
        return [System.IO.Path]::GetRelativePath($BasePath, $TargetPath)
    }

    $baseFull = [System.IO.Path]::GetFullPath($BasePath)
    $targetFull = [System.IO.Path]::GetFullPath($TargetPath)

    if (-not $baseFull.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $baseFull += [System.IO.Path]::DirectorySeparatorChar
    }

    $baseUri = New-Object System.Uri($baseFull)
    $targetUri = New-Object System.Uri($targetFull)
    $relativeUri = $baseUri.MakeRelativeUri($targetUri)
    return [System.Uri]::UnescapeDataString($relativeUri.ToString()).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
}

function Rename-CaseAwareFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RootPath,
        [Parameter(Mandatory = $true)]
        [string]$CurrentRelativePath,
        [Parameter(Mandatory = $true)]
        [string]$DesiredRelativePath
    )

    if ($CurrentRelativePath -ceq $DesiredRelativePath) {
        return
    }

    $currentFull = Join-Path $RootPath $CurrentRelativePath
    $desiredFull = Join-Path $RootPath $DesiredRelativePath

    if (-not (Test-Path $currentFull)) {
        return
    }

    $currentDir = Split-Path -Parent $currentFull
    $desiredDir = Split-Path -Parent $desiredFull
    if (-not (Test-Path $desiredDir)) {
        New-Item -ItemType Directory -Path $desiredDir -Force | Out-Null
    }

    if ($currentFull.ToLowerInvariant() -eq $desiredFull.ToLowerInvariant()) {
        $tempName = "{0}.tmp_case_{1}" -f (Split-Path $currentFull -Leaf), ([Guid]::NewGuid().ToString("N"))
        $tempFull = Join-Path $currentDir $tempName
        Rename-Item -LiteralPath $currentFull -NewName $tempName
        Rename-Item -LiteralPath $tempFull -NewName (Split-Path $desiredFull -Leaf)
    }
    else {
        Rename-Item -LiteralPath $currentFull -NewName (Split-Path $desiredFull -Leaf)
    }
}

function Sync-CaseSensitiveNames {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourceRoot,
        [Parameter(Mandatory = $true)]
        [string]$TargetRoot
    )

    $sourceFiles = Get-ChildItem -Path $SourceRoot -Recurse -File
    $targetFiles = Get-ChildItem -Path $TargetRoot -Recurse -File

    $targetLookup = @{}
    foreach ($targetFile in $targetFiles) {
        $rel = (Get-RelativePathCompat -BasePath $TargetRoot -TargetPath $targetFile.FullName).Replace('\', '/')
        $targetLookup[$rel.ToLowerInvariant()] = $rel
    }

    $renamedCount = 0
    foreach ($sourceFile in $sourceFiles) {
        $sourceRel = (Get-RelativePathCompat -BasePath $SourceRoot -TargetPath $sourceFile.FullName).Replace('\', '/')
        $key = $sourceRel.ToLowerInvariant()
        if (-not $targetLookup.ContainsKey($key)) {
            continue
        }

        $currentRel = $targetLookup[$key]
        if ($currentRel -ceq $sourceRel) {
            continue
        }

        Rename-CaseAwareFile -RootPath $TargetRoot -CurrentRelativePath $currentRel -DesiredRelativePath $sourceRel
        $targetLookup[$key] = $sourceRel
        $renamedCount++
    }

    if ($renamedCount -gt 0) {
        Write-Host "Adjusted $renamedCount case-sensitive path(s) in target wiki repo."
    }
}

function Test-DockerDaemon {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DockerExe
    )

    $stdoutPath = [System.IO.Path]::GetTempFileName()
    $stderrPath = [System.IO.Path]::GetTempFileName()
    try {
        $process = Start-Process -FilePath $DockerExe -ArgumentList "version" -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
        return ($process.ExitCode -eq 0)
    }
    finally {
        Remove-Item $stdoutPath, $stderrPath -ErrorAction SilentlyContinue
    }
}

function Start-DockerDesktop {
    $candidates = @(
        "C:\Program Files\Docker\Docker\Docker Desktop.exe",
        (Join-Path $env:LOCALAPPDATA "Programs\Docker\Docker\Docker Desktop.exe")
    )

    $dockerDesktopExe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $dockerDesktopExe) {
        throw "Docker Desktop executable was not found in the standard install locations."
    }

    Write-Host "Starting Docker Desktop..."
    Start-Process -FilePath $dockerDesktopExe | Out-Null
}

function Ensure-DockerAvailable {
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerCmd) {
        throw "Docker CLI is not installed or not available on PATH."
    }

    if (Test-DockerDaemon -DockerExe $dockerCmd.Source) {
        return
    }

    Start-DockerDesktop

    for ($attempt = 1; $attempt -le 60; $attempt++) {
        Start-Sleep -Seconds 2
        if (Test-DockerDaemon -DockerExe $dockerCmd.Source) {
            Write-Host "Docker Desktop is ready."
            return
        }
    }

    throw "Docker Desktop did not become ready in time. Start Docker manually and retry."
}

function Get-WikiRemoteUrl {
    $origin = (git -C $repoRoot remote get-url origin).Trim()
    if (-not $origin) {
        throw "Unable to determine origin URL for repository: $repoRoot"
    }

    if ($origin -match "^https://github.com/(.+?)/(.+?)(\.git)?$") {
        $owner = $Matches[1]
        $repo = $Matches[2]
        return "https://github.com/$owner/$repo.wiki.git"
    }

    if ($origin -match "^git@github.com:(.+?)/(.+?)(\.git)?$") {
        $owner = $Matches[1]
        $repo = $Matches[2]
        return "git@github.com:$owner/$repo.wiki.git"
    }

    throw "Unsupported origin URL format: $origin"
}

function Ensure-WikiRepo {
    if (Test-Path $wikiRepo) {
        git -C $wikiRepo config core.ignorecase false | Out-Null
        return
    }

    $wikiUrl = Get-WikiRemoteUrl
    Write-Host "Cloning wiki repo from $wikiUrl"
    git clone $wikiUrl $wikiRepo
    git -C $wikiRepo config core.ignorecase false | Out-Null
}

function Sync-WorkspaceToWikiRepo {
    if (-not (Test-Path $workspaceWiki)) {
        throw "Workspace wiki folder not found: $workspaceWiki"
    }

    Ensure-WikiRepo

    Write-Host "Syncing $workspaceWiki -> $wikiRepo"
    robocopy $workspaceWiki $wikiRepo /MIR /XD .git /XF *.lnk | Out-Null

    # Robocopy returns non-zero codes for success conditions (1-7).
    if ($LASTEXITCODE -ge 8) {
        throw "Robocopy failed with exit code $LASTEXITCODE"
    }

    # Robocopy on Windows may not apply case-only path changes; enforce source casing explicitly.
    Sync-CaseSensitiveNames -SourceRoot $workspaceWiki -TargetRoot $wikiRepo
}

function Sync-WorkspaceToPreviewWiki {
    if (-not (Test-Path $workspaceWiki)) {
        throw "Workspace wiki folder not found: $workspaceWiki"
    }

    if (-not (Test-Path $previewWiki)) {
        New-Item -ItemType Directory -Path $previewWiki -Force | Out-Null
    }

    Write-Host "Preparing preview content $workspaceWiki -> $previewWiki"
    robocopy $workspaceWiki $previewWiki /MIR /XD .git /XF *.lnk | Out-Null

    # Robocopy returns non-zero codes for success conditions (1-7).
    if ($LASTEXITCODE -ge 8) {
        throw "Preview content sync failed with exit code $LASTEXITCODE"
    }

    # Keep preview file naming consistent with workspace when only case changed.
    Sync-CaseSensitiveNames -SourceRoot $workspaceWiki -TargetRoot $previewWiki

    $previewGitDir = Join-Path $previewWiki ".git"
    if (Test-Path $previewGitDir) {
        Remove-Item -Recurse -Force $previewGitDir
    }

    git -C $previewWiki init | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to initialize git repository in preview folder."
    }

    git -C $previewWiki config user.name "Wiki Preview" | Out-Null
    git -C $previewWiki config user.email "wiki-preview@local" | Out-Null
    git -C $previewWiki config core.autocrlf false | Out-Null
    git -C $previewWiki config core.safecrlf false | Out-Null
    git -C $previewWiki add -A
    git -C $previewWiki commit -m "preview: snapshot" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create preview snapshot commit."
    }
}

function Start-Preview {
    if (-not (Test-Path $workspaceWiki)) {
        throw "Workspace wiki folder not found: $workspaceWiki"
    }

    Ensure-DockerAvailable

    Sync-WorkspaceToPreviewWiki

    if (-not $NoSync) {
        Sync-WorkspaceToWikiRepo
    }

    $previewSource = (Resolve-Path $previewWiki).Path
    $running = docker ps --filter "name=^/${ContainerName}$" --format "{{.Names}}"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to query Docker containers."
    }
    if ($running -eq $ContainerName) {
        Write-Host "Restarting running preview container to reload updated content..."
        docker rm -f $ContainerName | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to recreate preview container '${ContainerName}'."
        }
    }

    $existing = docker ps -a --filter "name=^/${ContainerName}$" --format "{{.Names}}"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to query existing Docker containers."
    }
    if ($existing -eq $ContainerName) {
        docker rm -f $ContainerName | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to remove previous preview container '${ContainerName}'."
        }
    }

    $wikiMount = ($previewSource -replace "\\", "/")
    docker run -d --rm --name $ContainerName -p "${Port}:4567" -v "${wikiMount}:/wiki" gollumwiki/gollum | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start Gollum preview container."
    }

    $previewUrl = "http://localhost:$Port/Home"
    Write-Host "Preview started at $previewUrl"

    # Important behavior: preview does not open a new browser tab/window.
    # The user must open localhost:4567 at least once; this block only tries to refresh an existing tab/window.
    $refreshed = $false
    try {
        $shell = New-Object -ComObject WScript.Shell
        # Try to activate a browser tab/window using a deterministic title hint first.
        $hints = @()
        if ($BrowserTitleHint) {
            $hints += $BrowserTitleHint
        }
        $hints += @("localhost:$Port", "$previewUrl")

        $activated = $false
        foreach ($hint in $hints) {
            if ($shell.AppActivate($hint)) {
                $activated = $true
                break
            }
        }

        if ($activated) {
            Start-Sleep -Milliseconds 150
            $shell.SendKeys("{F5}")
            $refreshed = $true
            Write-Host "Refreshed existing Gollum tab/window."
        }
    }
    catch {
        # Best effort only; fallback to manual refresh below.
    }

    if (-not $refreshed) {
        Write-Host "No browser tab auto-opened. Refresh your existing Gollum tab manually (F5): $previewUrl"
        Write-Host "Tip: set -BrowserTitleHint to the exact tab title shown in your browser if needed."
    }
}

function Stop-Preview {
    Ensure-DockerAvailable

    $running = docker ps --filter "name=^/${ContainerName}$" --format "{{.Names}}"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to query Docker containers."
    }
    if ($running -ne $ContainerName) {
        Write-Host "Preview container is not running."
        return
    }

    docker stop $ContainerName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to stop preview container '${ContainerName}'."
    }
    Write-Host "Preview stopped (${ContainerName})."
}

function Publish-Wiki {
    Ensure-WikiRepo

    if (-not $NoSync) {
        Sync-WorkspaceToWikiRepo
    }

    git -C $wikiRepo add -A
    $changes = git -C $wikiRepo status --porcelain
    if ($changes) {
        $msg = "wiki: sync from workspace wiki folder"
        git -C $wikiRepo commit -m $msg
    }

    git -C $wikiRepo fetch origin master | Out-Null
    $aheadBehind = (git -C $wikiRepo rev-list --left-right --count origin/master...master).Trim()
    $counts = $aheadBehind -split "\s+"
    $behind = [int]$counts[0]
    $ahead = [int]$counts[1]

    if ($behind -gt 0) {
        git -C $wikiRepo pull --rebase origin master | Out-Null
        $aheadBehind = (git -C $wikiRepo rev-list --left-right --count origin/master...master).Trim()
        $counts = $aheadBehind -split "\s+"
        $ahead = [int]$counts[1]
    }

    if ($ahead -le 0) {
        Write-Host "No wiki changes to publish."
        return
    }

    git -C $wikiRepo push origin master
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to push wiki changes to origin/master."
    }

    Write-Host "Published to GitHub Wiki successfully."
}

switch ($Action) {
    "sync" { Sync-WorkspaceToWikiRepo }
    "preview" { Start-Preview }
    "stop" { Stop-Preview }
    "publish" { Publish-Wiki }
}
