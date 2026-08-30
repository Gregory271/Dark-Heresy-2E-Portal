param(
  [string]$FoundryDataPath = "$env:LOCALAPPDATA\FoundryVTT\Data",
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$moduleSource = Join-Path $repo 'dist\dh2-portal'
$moduleDestination = Join-Path $FoundryDataPath 'modules\dh2-portal'

if (-not $SkipBuild) {
  Write-Host 'Building the latest Foundry module...' -ForegroundColor Cyan
  Push-Location $repo
  try {
    npm.cmd run build:foundry
    if ($LASTEXITCODE -ne 0) { throw 'Build failed. No Foundry files were copied.' }
  } finally { Pop-Location }
}

if (-not (Test-Path (Join-Path $moduleSource 'module.json'))) {
  throw "Built module was not found at $moduleSource. Run npm.cmd run build:foundry first."
}

if (-not (Test-Path $FoundryDataPath)) {
  throw "Foundry Data path was not found: $FoundryDataPath`nPass the correct path with -FoundryDataPath 'C:\path\to\FoundryVTT\Data'."
}

New-Item -ItemType Directory -Path $moduleDestination -Force | Out-Null
Copy-Item -Path (Join-Path $moduleSource '*') -Destination $moduleDestination -Recurse -Force

$manifest = Get-Content (Join-Path $moduleDestination 'module.json') -Raw | ConvertFrom-Json
Write-Host "Installed DH2 Portal module version $($manifest.version) to:" -ForegroundColor Green
Write-Host "  $moduleDestination"
Write-Host 'Restart Foundry, then verify DH2 Portal is enabled in Manage Modules.' -ForegroundColor Yellow
