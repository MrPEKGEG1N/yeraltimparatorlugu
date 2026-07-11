# Yeralti Imparatorlugu - tam otomatik release (keystore + AAB)
# Kullanim: powershell -ExecutionPolicy Bypass -File tools/build-release-full.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Write-AsciiFile {
    param([string]$Path, [string]$Content)
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Find-JavaHome {
    $candidates = @(
        "${env:ProgramFiles}\Android\Android Studio\jbr",
        "${env:LocalAppData}\Programs\Android\Android Studio\jbr",
        "${env:ProgramFiles}\Android\Android Studio\jre",
        $env:JAVA_HOME
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path (Join-Path $c "bin\java.exe"))) { return $c }
    }
    $java = Get-Command java -ErrorAction SilentlyContinue
    if ($java) {
        return (Split-Path -Parent (Split-Path -Parent $java.Source))
    }
    throw "Java 11+ bulunamadi. Android Studio JBR veya JDK kurun."
}

function Find-AndroidSdk {
    if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) { return $env:ANDROID_HOME }
    if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) { return $env:ANDROID_SDK_ROOT }
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
        (Join-Path $env:USERPROFILE "AppData\Local\Android\Sdk")
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    throw "Android SDK bulunamadi. Android Studio ile SDK kurun."
}

function Ensure-AndroidLocalProperties {
    param([string]$SdkPath)
    $localProps = Join-Path $Root "android\local.properties"
    $sdkDir = ($SdkPath -replace '\\', '/')
    Write-AsciiFile $localProps "sdk.dir=$sdkDir`n"
    Write-Host "[OK] android/local.properties -> $sdkDir"
}

function Find-Keytool {
    $javaHome = Find-JavaHome
    $env:JAVA_HOME = $javaHome
    $p = Join-Path $javaHome "bin\keytool.exe"
    if (Test-Path $p) { return $p }
    throw "keytool bulunamadi: $p"
}

function New-RandomPassword {
    param([int]$Length = 24)
    $chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    $bytes = New-Object byte[] $Length
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Strip-KeystorePropertiesBom {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        [System.IO.File]::WriteAllBytes($Path, $bytes[3..($bytes.Length - 1)])
        Write-Host "[OK] keystore.properties BOM temizlendi"
    }
}

Write-Host "=== Tam otomatik Google Play build ===" -ForegroundColor Cyan

$env:JAVA_HOME = Find-JavaHome
$env:ANDROID_HOME = Find-AndroidSdk
Ensure-AndroidLocalProperties $env:ANDROID_HOME
Write-Host "[OK] JAVA_HOME: $env:JAVA_HOME"

# 1) Ikon + assets + sync
& powershell -ExecutionPolicy Bypass -File (Join-Path $Root "tools\prepare-google-play.ps1")
if ($LASTEXITCODE -ne 0) { throw "prepare-google-play.ps1 basarisiz (exit $LASTEXITCODE)" }

# 2) Keystore
$keytool = Find-Keytool
Write-Host "[OK] keytool: $keytool"

$releaseDir = Join-Path $Root "android\release"
$keystoreFile = Join-Path $releaseDir "yeralti-release.keystore"
$propsFile = Join-Path $Root "android\keystore.properties"
$credsFile = Join-Path $releaseDir "SIGNING-CREDENTIALS.txt"
$alias = "yeralti"

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
Strip-KeystorePropertiesBom $propsFile

if (Test-Path $keystoreFile) {
    Write-Host "[!] Mevcut keystore kullaniliyor: $keystoreFile" -ForegroundColor Yellow
    if (-not (Test-Path $propsFile)) {
        throw "keystore var ama android/keystore.properties yok."
    }
} else {
    $storePass = New-RandomPassword
    $keyPass = $storePass
    Write-Host "[...] Yeni release keystore olusturuluyor"
    & $keytool -genkeypair -v `
        -keystore $keystoreFile `
        -alias $alias `
        -keyalg RSA -keysize 2048 -validity 10000 `
        -storepass $storePass -keypass $keyPass `
        -dname "CN=Yeralti Imparatorlugu, OU=Mobile, O=Yeralti, L=Istanbul, ST=Istanbul, C=TR"
    if ($LASTEXITCODE -ne 0) { throw "keytool basarisiz (exit $LASTEXITCODE)" }

    $propsContent = @"
storeFile=../release/yeralti-release.keystore
storePassword=$storePass
keyAlias=$alias
keyPassword=$keyPass
"@
    Write-AsciiFile $propsFile $propsContent

    $credsContent = @"
YERALTI IMPARATORLUGU - RELEASE IMZA BILGILERI
==============================================
Olusturulma: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Keystore dosyasi : android/release/yeralti-release.keystore
Key alias        : $alias
Store sifresi    : $storePass
Key sifresi      : $keyPass

ONEMLI:
- Bu dosyayi ve keystore'u guvenli yedekleyin.
- Kaybederseniz Google Play'de guncelleme yapamazsiniz.
- Bu dosya git'e eklenmez (.gitignore).
"@
    Write-AsciiFile $credsFile $credsContent

    Write-Host "[OK] Keystore + keystore.properties olusturuldu" -ForegroundColor Green
    Write-Host "     Sifreler: $credsFile" -ForegroundColor Yellow
}

# 3) Gradle bundleRelease
$gradlew = Join-Path $Root "android\gradlew.bat"
if (-not (Test-Path $gradlew)) {
    throw "gradlew.bat bulunamadi: $gradlew"
}

Write-Host "[...] Release AAB derleniyor (bu birkac dakika surebilir)"
Push-Location (Join-Path $Root "android")
$env:CAPACITOR_SERVER_URL = "https://yeralti-game.onrender.com"
$old = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& .\gradlew.bat bundleRelease --no-daemon 2>&1 | Out-Null
$gradleExit = $LASTEXITCODE
$ErrorActionPreference = $old
Pop-Location

if ($gradleExit -ne 0) {
    throw "Gradle bundleRelease basarisiz (exit $gradleExit)"
}

$aab = Join-Path $Root "android\app\build\outputs\bundle\release\app-release.aab"
if (-not (Test-Path $aab)) {
    throw "AAB dosyasi bulunamadi: $aab"
}

$sizeMb = [math]::Round((Get-Item $aab).Length / 1MB, 2)
$releaseAab = Join-Path $releaseDir "yeralti-imparatorlugu-v1.0.0.aab"
Copy-Item -Force $aab $releaseAab

# 4) Play Store grafikleri
$playIconDir = Join-Path $releaseDir "play-store-assets"
New-Item -ItemType Directory -Force -Path $playIconDir | Out-Null
$icon512 = Join-Path $playIconDir "icon-512.png"
if (Test-Path (Join-Path $Root "resources\icon.png")) {
    Copy-Item -Force (Join-Path $Root "resources\icon.png") $icon512
}
$playAssetsScript = Join-Path $Root "tools\generate-play-assets.py"
if ((Get-Command python -ErrorAction SilentlyContinue) -and (Test-Path $playAssetsScript)) {
    & python $playAssetsScript 2>&1 | Out-Null
}

Write-Host ""
Write-Host "=== BASARILI ===" -ForegroundColor Green
Write-Host "AAB: $releaseAab ($sizeMb MB)"
Write-Host "Play ikon (512): $icon512"
Write-Host "Feature graphic: $playIconDir\feature-graphic-1024x500.png"
Write-Host "Play Console: Production > Create new release > Upload"
Write-Host "Gizlilik: https://yeralti-game.onrender.com/gizlilik"
Write-Host "Magaza metinleri: tools/google-play-store-listing.txt"
if (Test-Path $credsFile) {
    Write-Host "Imza sifreleri: $credsFile"
}
Write-Host ""

# 5) Release klasorune kopyala + Play grafikleri
& powershell -ExecutionPolicy Bypass -File (Join-Path $Root "tools\finalize-play-release.ps1")
