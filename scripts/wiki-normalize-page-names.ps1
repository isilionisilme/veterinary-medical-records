[CmdletBinding()]
param(
    [string]$WikiRoot = "wiki",
    [string]$Folder,
    [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Convert-ToTitleHyphenCase {
    param([Parameter(Mandatory = $true)][string]$Stem)

    if ([string]::IsNullOrWhiteSpace($Stem)) {
        return $Stem
    }

    $tokens = $Stem -split "-"
    $acronyms = @{
        "adr" = "ADR"
        "api" = "API"
        "ci" = "CI"
        "e2e" = "E2E"
        "id" = "ID"
        "mvp" = "MVP"
        "qa" = "QA"
        "sql" = "SQL"
        "ui" = "UI"
        "ux" = "UX"
    }
    $normalized = foreach ($token in $tokens) {
        if ($token -match "^\d+$") {
            $token
            continue
        }
        $tokenKey = $token.ToLowerInvariant()
        if ($acronyms.ContainsKey($tokenKey)) {
            $acronyms[$tokenKey]
            continue
        }
        if ($token -cmatch "^[A-Z0-9]{2,}$") {
            # Preserve intentional acronyms such as ADR/API/QA.
            $token
            continue
        }
        if ($token.Length -eq 0) {
            $token
            continue
        }

        $lower = $token.ToLowerInvariant()
        if ($lower.Length -eq 1) {
            $lower.ToUpperInvariant()
        }
        else {
            $lower.Substring(0, 1).ToUpperInvariant() + $lower.Substring(1)
        }
    }

    return ($normalized -join "-")
}

function Get-RelativePathCompat {
    param(
        [Parameter(Mandatory = $true)][string]$BasePath,
        [Parameter(Mandatory = $true)][string]$TargetPath
    )

    if ([System.IO.Path].GetMethods() | Where-Object { $_.Name -eq 'GetRelativePath' }) {
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

function Get-NormalizedRelativePath {
    param(
        [Parameter(Mandatory = $true)][string]$FromDirectory,
        [Parameter(Mandatory = $true)][string]$ToPath,
        [Parameter(Mandatory = $true)][bool]$KeepMdExtension
    )

    $relative = (Get-RelativePathCompat -BasePath $FromDirectory -TargetPath $ToPath).Replace('\', '/')
    if (-not $KeepMdExtension -and $relative.EndsWith(".md", [System.StringComparison]::OrdinalIgnoreCase)) {
        return $relative.Substring(0, $relative.Length - 3)
    }

    return $relative
}

$repoRoot = (Get-Location).Path
$wikiRootPath = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $WikiRoot))
if (-not (Test-Path $wikiRootPath)) {
    throw "Wiki root not found: $wikiRootPath"
}

$scopeRoot = $wikiRootPath
if ($Folder) {
    $scopeRoot = [System.IO.Path]::GetFullPath((Join-Path $wikiRootPath $Folder))
    if (-not (Test-Path $scopeRoot)) {
        throw "Folder scope not found inside wiki root: $scopeRoot"
    }
}

$sourceFiles = Get-ChildItem -Path $scopeRoot -Recurse -File -Filter *.md |
    Where-Object { $_.Name -notmatch '^_' }

$renamePlans = New-Object System.Collections.Generic.List[object]
foreach ($file in $sourceFiles) {
    $newStem = Convert-ToTitleHyphenCase -Stem $file.BaseName
    if ($newStem -ceq $file.BaseName) {
        continue
    }

    $newName = "$newStem$($file.Extension)"
    $newPath = Join-Path $file.DirectoryName $newName

    $renamePlans.Add([pscustomobject]@{
            OldPath    = $file.FullName
            NewPath    = [System.IO.Path]::GetFullPath($newPath)
            OldRelPath = (Get-RelativePathCompat -BasePath $wikiRootPath -TargetPath $file.FullName).Replace('\', '/')
            NewRelPath = (Get-RelativePathCompat -BasePath $wikiRootPath -TargetPath ([System.IO.Path]::GetFullPath($newPath))).Replace('\', '/')
        })
}

$collisionGroups = @($renamePlans | Group-Object { $_.NewPath.ToLowerInvariant() } | Where-Object { $_.Count -gt 1 })
if ($collisionGroups.Count -gt 0) {
    Write-Host "Detected naming collisions. Aborting:" -ForegroundColor Red
    foreach ($group in $collisionGroups) {
        $group.Group | ForEach-Object { Write-Host "  $($_.OldRelPath) -> $($_.NewRelPath)" -ForegroundColor Red }
    }
    throw "Cannot continue due to collisions."
}

$oldToNewMap = @{}
foreach ($plan in $renamePlans) {
    $oldToNewMap[$plan.OldPath.ToLowerInvariant()] = $plan.NewPath
}

Write-Host "Wiki root: $wikiRootPath"
if ($Folder) {
    Write-Host "Scoped folder: $scopeRoot"
}
Write-Host "Planned renames: $($renamePlans.Count)"
foreach ($plan in $renamePlans) {
    Write-Host "  $($plan.OldRelPath) -> $($plan.NewRelPath)"
}

if (-not $Apply) {
    Write-Host "Dry-run complete. Re-run with -Apply to execute."
    return
}

# Case-only renames are unreliable on Windows, so force a temporary unique hop.
foreach ($plan in $renamePlans) {
    $oldPath = $plan.OldPath
    $newPath = $plan.NewPath

    if (-not (Test-Path $oldPath)) {
        continue
    }

    if ($oldPath.ToLowerInvariant() -eq $newPath.ToLowerInvariant()) {
        $tempPath = "$oldPath.__tmp_rename_$([Guid]::NewGuid().ToString('N'))"
        Rename-Item -LiteralPath $oldPath -NewName ([System.IO.Path]::GetFileName($tempPath))
        Rename-Item -LiteralPath $tempPath -NewName ([System.IO.Path]::GetFileName($newPath))
    }
    else {
        Rename-Item -LiteralPath $oldPath -NewName ([System.IO.Path]::GetFileName($newPath))
    }
}

$allWikiFiles = Get-ChildItem -Path $wikiRootPath -Recurse -File -Filter *.md
$filesUpdated = 0
$linkUpdates = 0

foreach ($file in $allWikiFiles) {
    $original = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
    $content = $original
    $sourceDir = $file.DirectoryName

    $pattern = '(?<!!)(\[[^\]]+\]\((?<target>[^)]+)\))'
    $matches = [System.Text.RegularExpressions.Regex]::Matches($content, $pattern)

    if ($matches.Count -eq 0) {
        continue
    }

    $updatedContent = [System.Text.RegularExpressions.Regex]::Replace(
        $content,
        $pattern,
        {
            param($m)

            $whole = $m.Groups[1].Value
            $target = $m.Groups['target'].Value.Trim()
            if ([string]::IsNullOrWhiteSpace($target)) {
                return $whole
            }
            if ($target.StartsWith("#") -or $target.StartsWith("http://") -or $target.StartsWith("https://") -or $target.StartsWith("mailto:")) {
                return $whole
            }

            $anchor = ""
            $base = $target
            $hashIndex = $target.IndexOf("#")
            if ($hashIndex -ge 0) {
                $base = $target.Substring(0, $hashIndex)
                $anchor = $target.Substring($hashIndex)
            }

            if ([string]::IsNullOrWhiteSpace($base)) {
                return $whole
            }

            $hasMdExtension = $base.EndsWith(".md", [System.StringComparison]::OrdinalIgnoreCase)
            $candidate = if ($hasMdExtension) { $base } else { "$base.md" }

            $resolved = [System.IO.Path]::GetFullPath((Join-Path $sourceDir $candidate))
            $key = $resolved.ToLowerInvariant()
            if (-not $oldToNewMap.ContainsKey($key)) {
                return $whole
            }

            $newTargetPath = $oldToNewMap[$key]
            $replacementBase = Get-NormalizedRelativePath -FromDirectory $sourceDir -ToPath $newTargetPath -KeepMdExtension:$hasMdExtension
            $replacement = $whole.Replace("($target)", "($replacementBase$anchor)")

            if ($replacement -ne $whole) {
                $script:linkUpdates++
            }
            return $replacement
        }
    )

    if ($updatedContent -ne $original) {
        Set-Content -LiteralPath $file.FullName -Value $updatedContent -Encoding UTF8
        $filesUpdated++
    }
}

Write-Host "Renames applied: $($renamePlans.Count)"
Write-Host "Files with link updates: $filesUpdated"
Write-Host "Total link updates: $linkUpdates"
Write-Host "Done. Next steps: run wiki sync/publish and verify folder pages."
