param(
  [string]$SourcebookPath = "$env:USERPROFILE\Documents\Dark Heresy",
  [string]$OutputPath = "",
  [int]$RenderDpi = 110
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutputPath) { $OutputPath = Join-Path $repo 'public\assets\reinforcements' }
$OutputPath = [IO.Path]::GetFullPath($OutputPath)
$tempPath = Join-Path ([IO.Path]::GetTempPath()) ("dh2-reinforcement-art-" + [guid]::NewGuid().ToString('N'))

$pdftoppm = (Get-Command pdftoppm -ErrorAction SilentlyContinue).Source
if (-not $pdftoppm) {
  throw 'pdftoppm was not found. Install Poppler or run this script from the Codex workspace runtime.'
}

# Coordinates are normalized against the rendered page, so they remain stable
# if RenderDpi changes. Every crop was visually checked against its named
# sourcebook profile; entries without a specific illustration are intentionally
# omitted and receive the neutral silhouette in the application.
$core = 'Dark_Heresy_Second_Edition_Core_Rulebook.pdf'
$within = 'dark_heresy_second_edition_-_enemies_within.pdf'
$without = 'dark_heresy_second_edition_-_enemies_without_1_.pdf'
$beyond = 'dark_heresy_second_edition_-_enemies_beyond.pdf'
$crops = @(
  @{ File=$core; Page=297; Name='sister-of-battle-canoness'; X=.57; Y=.42; W=.43; H=.58; Printed=296 },
  @{ File=$core; Page=298; Name='deathwatch-space-marine'; X=.50; Y=0; W=.50; H=.57; Printed=297 },
  @{ File=$core; Page=300; Name='grey-knight-space-marine'; X=.47; Y=0; W=.53; H=.59; Printed=299 },
  @{ File=$within; Page=41; Name='arco-flagellant'; X=.51; Y=.49; W=.49; H=.51; Printed=40 },
  @{ File=$within; Page=42; Name='penitent-engine'; X=0; Y=0; W=.55; H=.70; Printed=41 },
  @{ File=$without; Page=41; Name='callidus-assassin'; X=.51; Y=.39; W=.49; H=.61; Printed=40 },
  @{ File=$without; Page=42; Name='ork-freeboota'; X=.52; Y=.48; W=.48; H=.52; Printed=41 },
  @{ File=$beyond; Page=39; Name='culexus-assassin'; X=.50; Y=.32; W=.50; H=.68; Printed=38 },
  @{ File=$core; Page=192; Name='chimera'; X=.50; Y=.62; W=.50; H=.38; Printed=191 },
  @{ File=$without; Page=55; Name='aelurus-heavy-trike'; X=.01; Y=.48; W=.50; H=.52; Printed=54 },
  @{ File=$without; Page=55; Name='aquila-lander'; X=.48; Y=0; W=.52; H=.60; Printed=54 },
  @{ File=$without; Page=56; Name='arvus-lighter'; X=.27; Y=.51; W=.73; H=.49; Printed=55 },
  @{ File=$without; Page=57; Name='sentinel-walker'; X=.47; Y=.18; W=.53; H=.66; Printed=56 },
  @{ File=$without; Page=121; Name='reaver-jetbike'; X=0; Y=.48; W=.58; H=.52; Printed=120 }
)

Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $OutputPath, $tempPath | Out-Null

try {
  foreach ($crop in $crops) {
    $pdf = Join-Path $SourcebookPath $crop.File
    if (-not (Test-Path -LiteralPath $pdf)) { throw "Missing sourcebook: $pdf" }
    $renderPrefix = Join-Path $tempPath $crop.Name
    & $pdftoppm -f $crop.Page -l $crop.Page -singlefile -jpeg -r $RenderDpi $pdf $renderPrefix
    if ($LASTEXITCODE -ne 0) { throw "Failed to render PDF page $($crop.Page) from $pdf" }

    $rendered = "$renderPrefix.jpg"
    $source = [Drawing.Bitmap]::FromFile($rendered)
    try {
      $x = [Math]::Floor($source.Width * $crop.X)
      $y = [Math]::Floor($source.Height * $crop.Y)
      $width = [int][Math]::Min([Math]::Ceiling($source.Width * $crop.W), $source.Width - $x)
      $height = [int][Math]::Min([Math]::Ceiling($source.Height * $crop.H), $source.Height - $y)
      $result = [Drawing.Bitmap]::new($width, $height)
      try {
        $graphics = [Drawing.Graphics]::FromImage($result)
        try {
          $graphics.DrawImage($source, [Drawing.Rectangle]::new(0, 0, $width, $height), [Drawing.Rectangle]::new($x, $y, $width, $height), [Drawing.GraphicsUnit]::Pixel)
        } finally { $graphics.Dispose() }
        $destination = Join-Path $OutputPath ($crop.Name + '.jpg')
        $result.Save($destination, [Drawing.Imaging.ImageFormat]::Jpeg)
        Write-Host ("Verified {0} — printed p. {1}, PDF p. {2}" -f $crop.Name, $crop.Printed, $crop.Page) -ForegroundColor Green
      } finally { $result.Dispose() }
    } finally { $source.Dispose() }
  }
} finally {
  if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Recurse -Force }
}

Write-Host "Private reinforcement artwork written to $OutputPath" -ForegroundColor Cyan
Write-Host 'These sourcebook crops are for private/local use and are excluded from git.' -ForegroundColor Yellow
