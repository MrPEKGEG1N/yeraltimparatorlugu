# Yeralti Imparatorlugu - Google Play yayin hazirligi
# Kullanim:
#   powershell -ExecutionPolicy Bypass -File tools/prepare-google-play.ps1
#   powershell -ExecutionPolicy Bypass -File tools/prepare-google-play.ps1 -CreateKeystore
#   powershell -ExecutionPolicy Bypass -File tools/prepare-google-play.ps1 -BuildRelease

param(
    [switch]$CreateKeystore,
    [switch]$BuildRelease,
    [string]$ServerUrl = "https://yeraltimparatorlugu-production.up.railway.app"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Invoke-Npm {
    param([string[]]$Args)
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & npm @Args 2>&1 | Out-Null
    $code = $LASTEXITCODE
    $ErrorActionPreference = $old
    if ($code -ne 0) { throw "npm $($Args -join ' ') basarisiz (exit $code)" }
}

function Invoke-Npx {
    param([string[]]$Args)
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & npx @Args 2>&1 | Out-Null
    $code = $LASTEXITCODE
    $ErrorActionPreference = $old
    if ($code -ne 0) { throw "npx $($Args -join ' ') basarisiz (exit $code)" }
}

Write-Host "=== Yeralti Imparatorlugu - Google Play hazirligi ===" -ForegroundColor Cyan
Write-Host "Sunucu URL: $ServerUrl"

# 1) Kaynak ikon (emblemden kare crop)
$srcIcon = Join-Path $Root "public\images\racon-raporu.png"
$resDir = Join-Path $Root "resources"
$iconOut = Join-Path $resDir "icon.png"
$iconScript = Join-Path $Root "tools\generate-app-icon.py"
if (-not (Test-Path $srcIcon)) {
    throw "Ikon bulunamadi: $srcIcon"
}
New-Item -ItemType Directory -Force -Path $resDir | Out-Null
if (Test-Path $iconScript) {
    $py = Get-Command python -ErrorAction SilentlyContinue
    if ($py) {
        & python $iconScript
        if ($LASTEXITCODE -ne 0) { Copy-Item -Force $srcIcon $iconOut }
    } else {
        Copy-Item -Force $srcIcon $iconOut
    }
} else {
    Copy-Item -Force $srcIcon $iconOut
}
Write-Host "[OK] resources/icon.png hazir"

# 2) Capacitor assets (ikon + splash)
$env:CAPACITOR_SERVER_URL = $ServerUrl
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm bulunamadi. Node.js kurulu olmali."
}

Write-Host "[...] npm paketleri kontrol ediliyor"
$hasNodeModules = (Test-Path (Join-Path $Root "node_modules\@capacitor\cli")) -and `
    (Test-Path (Join-Path $Root "node_modules\@capacitor\assets"))
if (-not $hasNodeModules) {
    try {
        Invoke-Npm @("install", "--no-audit", "--no-fund")
    } catch {
        Write-Host "[!] npm install atlandi (node_modules kilitli veya hata): $($_.Exception.Message)" -ForegroundColor Yellow
        if (-not (Test-Path (Join-Path $Root "node_modules\@capacitor\cli"))) {
            throw $_
        }
    }
} else {
    Write-Host "[OK] node_modules mevcut, npm install atlandi"
}

$assetsCli = Join-Path $Root "node_modules\@capacitor\assets\bin\capacitor-assets"
if (-not (Test-Path $assetsCli)) {
    Write-Host "[!] @capacitor/assets eksik; cap sync yine de denenecek" -ForegroundColor Yellow
}

Write-Host "[...] Android ikon ve splash uretiliyor"
Invoke-Npx @("@capacitor/assets", "generate", "--android", "--iconBackgroundColor", "#0a0604", "--splashBackgroundColor", "#0a0604")

Write-Host "[...] Capacitor sync"
Invoke-Npx @("cap", "sync", "android")

# 3) Keystore
$keystoreDir = Join-Path $Root "android\release"
$keystoreFile = Join-Path $keystoreDir "yeralti-release.keystore"
$propsFile = Join-Path $Root "android\keystore.properties"
$propsExample = Join-Path $Root "android\keystore.properties.example"

if ($CreateKeystore) {
    New-Item -ItemType Directory -Force -Path $keystoreDir | Out-Null
    if (Test-Path $keystoreFile) {
        Write-Host "[!] Keystore zaten var: $keystoreFile" -ForegroundColor Yellow
    } else {
        $storePass = Read-Host "Keystore sifresi (en az 6 karakter)"
        $keyPass = Read-Host "Key sifresi (bos birakirsaniz keystore sifresi kullanilir)"
        if ([string]::IsNullOrWhiteSpace($keyPass)) { $keyPass = $storePass }
        $keytool = "keytool"
        if ($env:JAVA_HOME) {
            $keytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"
        }
        & $keytool -genkeypair -v `
            -keystore $keystoreFile `
            -alias yeralti `
            -keyalg RSA -keysize 2048 -validity 10000 `
            -storepass $storePass -keypass $keyPass `
            -dname "CN=Yeralti Imparatorlugu, OU=Mobile, O=Yeralti, L=Istanbul, ST=Istanbul, C=TR"
        Write-Host "[OK] Keystore olusturuldu: $keystoreFile" -ForegroundColor Green
        Write-Host "     Bu dosyayi ve sifreleri guvenli yedekleyin. Kaybederseniz guncelleme yapamazsiniz!" -ForegroundColor Yellow
    }
    if (-not (Test-Path $propsFile)) {
        Copy-Item $propsExample $propsFile
        Write-Host "[!] android/keystore.properties olusturuldu - sifreleri duzenleyin" -ForegroundColor Yellow
    }
}

if (-not (Test-Path $propsFile)) {
    Write-Host ""
    Write-Host "SONRAKI ADIM - Imzalama:" -ForegroundColor Yellow
    Write-Host "  1. powershell -File tools/prepare-google-play.ps1 -CreateKeystore"
    Write-Host "  2. android/keystore.properties dosyasindaki sifreleri doldurun"
    Write-Host ""
}

# 4) Release AAB
if ($BuildRelease) {
    if (-not (Test-Path $propsFile)) {
        throw "android/keystore.properties bulunamadi. Once -CreateKeystore calistirin."
    }
    Write-Host "[...] Release AAB derleniyor (bundleRelease)"
    Push-Location (Join-Path $Root "android")
    if (Test-Path ".\gradlew.bat") {
        .\gradlew.bat bundleRelease
    } else {
        throw "gradlew.bat bulunamadi. Android Studio ile projeyi bir kez acin."
    }
    Pop-Location
    $aab = Join-Path $Root "android\app\build\outputs\bundle\release\app-release.aab"
    if (Test-Path $aab) {
        Write-Host "[OK] AAB hazir: $aab" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== Google Play Console kontrol listesi ===" -ForegroundColor Cyan
Write-Host "  - AAB yukle: android\app\build\outputs\bundle\release\app-release.aab"
Write-Host "  - Gizlilik politikasi: https://yeraltimparatorlugu-production.up.railway.app/gizlilik"
Write-Host "  - Paket adi: com.yeralti.imparatorlugu"
Write-Host "  - Icerik derecelendirmesi anketi (siddet/tema icin)"
Write-Host "  - Ekran goruntuleri (telefon + tablet)"
Write-Host "  - Android Studio: npm run cap:open:android"
Write-Host ""
