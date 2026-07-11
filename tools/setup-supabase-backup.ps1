# Supabase Storage yedek kurulumu — Railway env + ilk yukleme testi
# Kullanim:
#   1) Supabase Dashboard > Project Settings > API (URL + service_role key)
#   2) .\tools\setup-supabase-backup.ps1
#      veya: $env:SUPABASE_URL="..."; $env:SUPABASE_SERVICE_ROLE_KEY="..."; .\tools\setup-supabase-backup.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$EnvFile = Join-Path $Root ".env"

function Invoke-Railway {
    param([string[]]$Args)
    & npx --yes @railway/cli @Args
    if ($LASTEXITCODE -ne 0) { throw "railway komutu basarisiz: railway $($Args -join ' ')" }
}

function Read-DotEnv {
    param([string]$Path)
    $vars = @{}
    if (-not (Test-Path $Path)) { return $vars }
    Get-Content $Path | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
        $parts = $_ -split '=', 2
        $k = $parts[0].Trim()
        $v = $parts[1].Trim().Trim('"').Trim("'")
        if ($k) { $vars[$k] = $v }
    }
    return $vars
}

function Write-DotEnvSupabase {
    param([string]$Url, [string]$Key, [string]$Bucket)
    $lines = @()
    if (Test-Path $EnvFile) { $lines = Get-Content $EnvFile }
    $map = @{
        SUPABASE_URL = $Url
        SUPABASE_SERVICE_ROLE_KEY = $Key
    }
    if ($Bucket) { $map["SUPABASE_DB_BUCKET"] = $Bucket }
    foreach ($key in $map.Keys) {
        $val = $map[$key]
        $found = $false
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match "^\s*$key\s*=") {
                $lines[$i] = "$key=$val"
                $found = $true
                break
            }
        }
        if (-not $found) { $lines += "$key=$val" }
    }
    Set-Content -Path $EnvFile -Value $lines -Encoding UTF8
}

Write-Host "=== Supabase bulut yedek kurulumu ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Supabase: https://supabase.com/dashboard/org/uuzouhmfcyqazgpqvfth" -ForegroundColor Gray
Write-Host "Project Settings > API > Project URL + service_role (anon degil!)" -ForegroundColor Gray
Write-Host ""

$dot = Read-DotEnv $EnvFile
if (-not $env:SUPABASE_URL -and $dot.SUPABASE_URL) { $env:SUPABASE_URL = $dot.SUPABASE_URL }
if (-not $env:SUPABASE_SERVICE_ROLE_KEY -and $dot.SUPABASE_SERVICE_ROLE_KEY) {
    $env:SUPABASE_SERVICE_ROLE_KEY = $dot.SUPABASE_SERVICE_ROLE_KEY
}
if (-not $env:SUPABASE_DB_BUCKET -and $dot.SUPABASE_DB_BUCKET) {
    $env:SUPABASE_DB_BUCKET = $dot.SUPABASE_DB_BUCKET
}

if (-not $env:SUPABASE_URL) {
    $env:SUPABASE_URL = Read-Host "SUPABASE_URL (https://xxxx.supabase.co)"
}
if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
    $secure = Read-Host "SUPABASE_SERVICE_ROLE_KEY" -AsSecureString
    $env:SUPABASE_SERVICE_ROLE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    )
}

$url = $env:SUPABASE_URL.Trim()
$key = $env:SUPABASE_SERVICE_ROLE_KEY.Trim()
$bucket = if ($env:SUPABASE_DB_BUCKET) { $env:SUPABASE_DB_BUCKET.Trim() } else { "yeralti-db-backups" }

if ($url -notmatch '^https://.+\.supabase\.co') {
    throw "Gecersiz SUPABASE_URL: $url"
}
if ($key.Length -lt 40) {
    throw "SUPABASE_SERVICE_ROLE_KEY cok kisa — service_role anahtarini kullanin (anon degil)"
}

Write-DotEnvSupabase -Url $url -Key $key -Bucket $bucket
Write-Host ".env guncellendi (gitignore'da)" -ForegroundColor Green

try {
    Invoke-Railway @("whoami")
    Invoke-Railway @("status")
} catch {
    Write-Host "Railway bagli degil. Once:" -ForegroundColor Yellow
    Write-Host "  npx @railway/cli link --project calm-friendship --environment production --service yeraltimparatorlugu"
    exit 1
}

Write-Host ""
Write-Host "Railway degiskenleri ayarlaniyor..." -ForegroundColor Yellow
Invoke-Railway @("variable", "set", "SUPABASE_URL=$url")
$key | Invoke-Railway @("variable", "set", "SUPABASE_SERVICE_ROLE_KEY", "--stdin")
if ($bucket -ne "yeralti-db-backups") {
    Invoke-Railway @("variable", "set", "SUPABASE_DB_BUCKET=$bucket")
}

Write-Host ""
Write-Host "Yerel yedek testi..." -ForegroundColor Yellow
Set-Location $Root
node tools/test-supabase-backup.js
if ($LASTEXITCODE -ne 0) { throw "Supabase yedek testi basarisiz" }

Write-Host ""
Write-Host "Production redeploy..." -ForegroundColor Yellow
Invoke-Railway @("redeploy", "--from-source", "-y")

Write-Host ""
Write-Host "Tamam. 60 sn sonra kontrol:" -ForegroundColor Cyan
Write-Host "  https://yeralti-game.onrender.com/api/health"
Write-Host "  supabase.configured: true, lastUploadOk: true beklenir"
