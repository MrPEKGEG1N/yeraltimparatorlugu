# Railway Volume kurulumu — kalici SQLite (/app/db/oyun.db)
# Kullanim:
#   1) railway login  (veya: $env:RAILWAY_TOKEN = "tokeniniz")
#   2) railway link   (proje + production servisini secin)
#   3) .\tools\setup-railway-volume.ps1

$ErrorActionPreference = "Stop"
$VolumeName = "yeralti-db"
$MountPath = "/data"

function Invoke-Railway {
    param([string[]]$Args)
    & npx --yes @railway/cli @Args
    if ($LASTEXITCODE -ne 0) { throw "railway komutu basarisiz: railway $($Args -join ' ')" }
}

Write-Host "=== Yeralti Imparatorlugu — Railway Volume ===" -ForegroundColor Cyan
Write-Host "Volume adi: $VolumeName"
Write-Host "Mount path: $MountPath"
Write-Host ""

if (-not $env:RAILWAY_TOKEN) {
    Write-Host "RAILWAY_TOKEN yok. Once giris yapin:" -ForegroundColor Yellow
    Write-Host "  npx @railway/cli login"
    Write-Host "veya Railway panelinden Project Token alip:"
    Write-Host '  $env:RAILWAY_TOKEN = "..."'
    Write-Host ""
}

try {
    Invoke-Railway @("whoami")
} catch {
    Write-Host "Railway oturumu yok. 'npx @railway/cli login' calistirin." -ForegroundColor Red
    exit 1
}

Write-Host "Mevcut volume'lar:" -ForegroundColor Gray
Invoke-Railway @("volume", "list")

$volumes = @(npx --yes @railway/cli volume list --json 2>$null | ConvertFrom-Json)
$existing = $volumes | Where-Object { $_.mountPath -eq $MountPath -or $_.name -match "yeralti" }
if (-not $existing) {
    Write-Host "Volume olusturuluyor (mount: $MountPath)..." -ForegroundColor Green
    Invoke-Railway @("volume", "add", "--mount-path", $MountPath)
} else {
    Write-Host "Volume zaten var: $($existing.name) -> $($existing.mountPath)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Servis yeniden baslatiliyor (git kaynagindan redeploy)..." -ForegroundColor Green
Invoke-Railway @("redeploy", "--from-source", "-y")

Write-Host ""
Write-Host "Tamam. Kontrol:" -ForegroundColor Cyan
Write-Host "  https://yeralti-game.onrender.com/api/health"
Write-Host "  volumeOk: true ve oyuncu sayisi korunmus olmali."
