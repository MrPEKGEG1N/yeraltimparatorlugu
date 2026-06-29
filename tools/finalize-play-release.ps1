# Mevcut AAB ve Play Store dosyalarini release klasorune toplar
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$releaseDir = Join-Path $Root "android\release"
$aabSrc = Join-Path $Root "android\app\build\outputs\bundle\release\app-release.aab"
$aabDst = Join-Path $releaseDir "yeralti-imparatorlugu-v1.0.0.aab"

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
if (-not (Test-Path $aabSrc)) {
    throw "AAB bulunamadi. Once: npm run android:release"
}
Copy-Item -Force $aabSrc $aabDst

$playDir = Join-Path $releaseDir "play-store-assets"
New-Item -ItemType Directory -Force -Path $playDir | Out-Null
if (Test-Path (Join-Path $Root "resources\icon.png")) {
    Copy-Item -Force (Join-Path $Root "resources\icon.png") (Join-Path $playDir "icon-512.png")
}
if (Get-Command python -ErrorAction SilentlyContinue) {
    & python (Join-Path $Root "tools\generate-play-assets.py")
}

$mb = [math]::Round((Get-Item $aabDst).Length / 1MB, 2)
Write-Host "Hazir: $aabDst ($mb MB)"
Write-Host "Play assets: $playDir"
