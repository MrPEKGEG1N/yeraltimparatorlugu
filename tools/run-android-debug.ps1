# Emulatore debug APK kur ve uygulamayi ac
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$jbr = "${env:ProgramFiles}\Android\Android Studio\jbr"
if (Test-Path $jbr) { $env:JAVA_HOME = $jbr }

$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
if (Test-Path $sdk) { $env:ANDROID_HOME = $sdk }

$localProps = Join-Path $Root "android\local.properties"
if (Test-Path $sdk) {
    $sdkDir = $sdk -replace '\\', '/'
    [System.IO.File]::WriteAllText($localProps, "sdk.dir=$sdkDir`n")
}

Write-Host "=== Capacitor sync ===" -ForegroundColor Cyan
$env:CAPACITOR_SERVER_URL = "https://yeraltimparatorlugu-production.up.railway.app"
$old = $ErrorActionPreference
$ErrorActionPreference = "Continue"
npx cap sync android 2>&1 | Out-Null
$ErrorActionPreference = $old

Write-Host "=== Debug kurulum (installDebug) ===" -ForegroundColor Cyan
Push-Location (Join-Path $Root "android")
& .\gradlew.bat installDebug --no-daemon
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "installDebug basarisiz" }
Pop-Location

$adb = Join-Path $sdk "platform-tools\adb.exe"
if (Test-Path $adb) {
    Write-Host "=== Uygulama aciliyor ===" -ForegroundColor Cyan
    & $adb shell am start -n com.yeralti.imparatorlugu/.MainActivity
}

Write-Host ""
Write-Host "Hazir! Emulatorda Yeralti Imparatorlugu acilmali." -ForegroundColor Green
Write-Host "Acilmazsa: emulatorda yukari kaydir -> Yeralti Imparatorlugu ikonuna tikla" -ForegroundColor Yellow
