# Northflank canliya deploy
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "=== Northflank deploy hazirligi ===" -ForegroundColor Cyan

Write-Host "[1/3] Oyuncu verisi hazirlaniyor..."
node tools/prepare-northflank-deploy.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$status = git status --porcelain 2>&1
if ($status) {
    Write-Host ""
    Write-Host "Commit edilmemis degisiklikler var. Northflank GitHub'dan ceker — once commit + push yapin:" -ForegroundColor Yellow
    git status -sb
    Write-Host ""
    Write-Host "  git add ."
    Write-Host "  git commit -m `"deploy: Northflank migration`""
    Write-Host "  git push origin main"
    exit 1
}

Write-Host "[2/3] GitHub'a push..."
git push origin main

Write-Host ""
Write-Host "[3/3] Northflank panelinde deploy'i izleyin." -ForegroundColor Green
Write-Host "Rehber: northflank/DEPLOY.md"
Write-Host ""
$base = $env:PUBLIC_BASE_URL
if ($base) {
    Write-Host "Health: $base/api/health"
} else {
    Write-Host "Health: https://<NORTHFLANK-URL>/api/health"
}
