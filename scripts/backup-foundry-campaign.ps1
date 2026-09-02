param(
  [string]$FoundryUserDataPath = "$env:LOCALAPPDATA\FoundryVTT",
  [string]$WorldId = 'dark-heresy-test',
  [string]$SystemId = 'dark-heresy-2nd',
  [string]$ModuleId = 'dh2-portal',
  [string]$Destination = "",
  [switch]$SkipSharedAssets,
  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$userData = [IO.Path]::GetFullPath($FoundryUserDataPath)
$dataPath = Join-Path $userData 'Data'
$worldPath = Join-Path $dataPath "worlds\$WorldId"
$systemPath = Join-Path $dataPath "systems\$SystemId"
$modulePath = Join-Path $dataPath "modules\$ModuleId"

foreach ($required in @($worldPath, $systemPath, $modulePath)) {
  if (-not (Test-Path -LiteralPath $required -PathType Container)) { throw "Required Foundry package was not found: $required" }
}

$world = Get-Content (Join-Path $worldPath 'world.json') -Raw | ConvertFrom-Json
$system = Get-Content (Join-Path $systemPath 'system.json') -Raw | ConvertFrom-Json
$module = Get-Content (Join-Path $modulePath 'module.json') -Raw | ConvertFrom-Json
if ($world.system -ne $SystemId) { throw "World '$WorldId' uses '$($world.system)', not '$SystemId'." }

$sharedAssetsPath = Join-Path $dataPath 'assets'
$includeSharedAssets = -not $SkipSharedAssets -and (Test-Path -LiteralPath $sharedAssetsPath -PathType Container)
$summary = [ordered]@{
  createdAt = (Get-Date).ToUniversalTime().ToString('o')
  sourceUserData = $userData
  foundryCoreVersion = $world.coreVersion
  world = [ordered]@{ id=$WorldId; title=$world.title; system=$world.system; systemVersion=$world.systemVersion }
  system = [ordered]@{ id=$SystemId; title=$system.title; version=$system.version }
  module = [ordered]@{ id=$ModuleId; title=$module.title; version=$module.version }
  includesSharedAssets = $includeSharedAssets
}

Write-Host "World:  $($world.title) ($WorldId)" -ForegroundColor Cyan
Write-Host "System: $($system.title) $($system.version)" -ForegroundColor Cyan
Write-Host "Module: $($module.title) $($module.version)" -ForegroundColor Cyan
Write-Host "Shared Data/assets: $includeSharedAssets" -ForegroundColor Cyan
if ($ValidateOnly) { Write-Host 'Portable-backup validation passed; no files were copied.' -ForegroundColor Green; return }

$running = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match '^Foundry|FoundryVTT' }
if ($running) { throw 'Close Foundry VTT before creating a portable backup.' }

if (-not $Destination) {
  $Destination = Join-Path ([Environment]::GetFolderPath('Desktop')) ("dh2-foundry-portable-{0}-{1}.zip" -f $WorldId, (Get-Date -Format 'yyyyMMdd-HHmmss'))
}
$Destination = [IO.Path]::GetFullPath($Destination)
if ([IO.Path]::GetExtension($Destination) -ne '.zip') { $Destination += '.zip' }
$destinationParent = Split-Path -Parent $Destination
New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
if (Test-Path -LiteralPath $Destination) { throw "Destination already exists: $Destination" }

$tempRoot = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) ("dh2-foundry-portable-" + [guid]::NewGuid().ToString('N'))))
$systemTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
if (-not $tempRoot.StartsWith($systemTemp, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe temporary staging path.' }

try {
  $stagedData = Join-Path $tempRoot 'Data'
  New-Item -ItemType Directory -Force -Path (Join-Path $stagedData 'worlds'), (Join-Path $stagedData 'systems'), (Join-Path $stagedData 'modules') | Out-Null
  Copy-Item -LiteralPath $worldPath -Destination (Join-Path $stagedData 'worlds') -Recurse
  Copy-Item -LiteralPath $systemPath -Destination (Join-Path $stagedData 'systems') -Recurse
  Copy-Item -LiteralPath $modulePath -Destination (Join-Path $stagedData 'modules') -Recurse
  if ($includeSharedAssets) { Copy-Item -LiteralPath $sharedAssetsPath -Destination $stagedData -Recurse }
  $summary | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $tempRoot 'MIGRATION-MANIFEST.json') -Encoding UTF8
  Compress-Archive -Path (Join-Path $tempRoot '*') -DestinationPath $Destination -CompressionLevel Optimal
} finally {
  if ((Test-Path -LiteralPath $tempRoot) -and $tempRoot.StartsWith($systemTemp, [StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}

Write-Host "Portable Foundry package created: $Destination" -ForegroundColor Green
Write-Host 'Keep this ZIP static. Do not run an active Foundry world from OneDrive, Dropbox, or another sync folder.' -ForegroundColor Yellow
