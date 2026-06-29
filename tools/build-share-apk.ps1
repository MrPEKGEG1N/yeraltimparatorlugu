# Telefona dogrudan kurulabilir APK uret (Play Store gerekmez)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Write-AsciiFile {
    param([string]$Path, [string]$Content)
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Fix-KeystoreProperties {
    $propsFile = Join-Path $Root "android\keystore.properties"
    if (-not (Test-Path $propsFile)) { return }
    $text = [System.IO.File]::ReadAllText($propsFile)
    if ($text.Length -gt 0 -and [int][char]$text[0] -eq 0xFEFF) { $text = $text.Substring(1) }
    Write-AsciiFile $propsFile ($text.TrimEnd() + "`n")
}

$jbr = "${env:ProgramFiles}\Android\Android Studio\jbr"
if (Test-Path $jbr) { $env:JAVA_HOME = $jbr }
$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
if (Test-Path $sdk) {
    $env:ANDROID_HOME = $sdk
    Write-AsciiFile (Join-Path $Root "android\local.properties") "sdk.dir=$($sdk -replace '\\','/')`n"
}

Fix-KeystoreProperties

# Kucuk APK: sadece kabuk, oyun Railway'den yuklenir
$env:CAPACITOR_SERVER_URL = "https://yeraltimparatorlugu-production.up.railway.app"
$env:CAPACITOR_MOBILE_SHELL = "1"

$old = $ErrorActionPreference
$ErrorActionPreference = "Continue"
npx cap sync android 2>&1 | Out-Null
$ErrorActionPreference = $old

$propsFile = Join-Path $Root "android\keystore.properties"
$releaseApk = Join-Path $Root "android\app\build\outputs\apk\release\app-release.apk"
$debugApk = Join-Path $Root "android\app\build\outputs\apk\debug\app-debug.apk"
$outDir = Join-Path $Root "android\release"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Push-Location (Join-Path $Root "android")

if (Test-Path $propsFile) {
    Write-Host "=== Release APK (imzali, kucuk kabuk) ===" -ForegroundColor Cyan
    & .\gradlew.bat clean assembleRelease --no-daemon
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "assembleRelease basarisiz" }
    $src = $releaseApk
    $dst = Join-Path $outDir "yeralti-imparatorlugu.apk"
} else {
    Write-Host "=== Debug APK (keystore yok) ===" -ForegroundColor Yellow
    & .\gradlew.bat clean assembleDebug --no-daemon
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "assembleDebug basarisiz" }
    $src = $debugApk
    $dst = Join-Path $outDir "yeralti-imparatorlugu-debug.apk"
}

Pop-Location

if (-not (Test-Path $src)) { throw "APK bulunamadi: $src" }
Copy-Item -Force $src $dst
$mb = [math]::Round((Get-Item $dst).Length / 1MB, 2)

Write-Host ""
Write-Host "=== APK HAZIR ===" -ForegroundColor Green
Write-Host "Dosya: $dst"
Write-Host "Boyut: $mb MB"
Write-Host ""
Write-Host "ONEMLI paylasim:" -ForegroundColor Yellow
Write-Host "  - Google Drive veya Telegram ile gonderin (WhatsApp buyuk APK bozabilir)"
Write-Host "  - Telefonda once eski Yeralti Imparatorlugu varsa KALDIRIN, sonra kurun"
Write-Host "  - Android 7.0+ ve en az 200 MB bos alan gerekir"
Write-Host ""
