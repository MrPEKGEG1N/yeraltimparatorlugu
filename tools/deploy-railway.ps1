# Railway canliya deploy (localhost:3000 ile ayni kod)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "=== Railway deploy ===" -ForegroundColor Cyan

$status = git status --porcelain 2>&1
if ($status) {
    Write-Host "Uyari: commit edilmemis degisiklikler var. Once commit edin." -ForegroundColor Yellow
    git status -sb
    exit 1
}

git fetch origin 2>&1 | Out-Null
Write-Host "[...] origin/main ve origin/deploy guncelleniyor"
git push origin HEAD:main
git push origin HEAD:deploy

Write-Host ""
Write-Host "Railway genelde 'main' dalini deploy eder." -ForegroundColor Yellow
Write-Host "1-2 dakika bekleyin, sonra kontrol:" -ForegroundColor Yellow
Write-Host "  https://yeraltimparatorlugu-production.up.railway.app/api/health"
Write-Host ""
Write-Host "APK uretmek icin: npm run android:apk"
Write-Host ""
