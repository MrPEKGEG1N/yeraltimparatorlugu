# Northflank tek seferlik kurulum sihirbazi
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "=== Northflank bootstrap ===" -ForegroundColor Cyan

Write-Host "[1/4] Oyuncu verisi (Supabase + seed)..."
$varsJson = npx --yes @railway/cli variables --json 2>$null
if ($LASTEXITCODE -eq 0 -and $varsJson) {
    $rw = $varsJson | ConvertFrom-Json
    $env:SUPABASE_URL = $rw.SUPABASE_URL
    $env:SUPABASE_SERVICE_ROLE_KEY = $rw.SUPABASE_SERVICE_ROLE_KEY
}
node tools/prepare-northflank-deploy.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "[2/4] GitHub push..."
git add seed/oyun.db seed/oyuncular/*.json 2>$null
$porcelain = git status --porcelain seed/
if ($porcelain) {
    git commit -m "data: refresh player seed before Northflank deploy."
    git push origin main
}

Write-Host ""
Write-Host "[3/4] Northflank panel aciliyor..." -ForegroundColor Yellow
Start-Process "https://app.northflank.com"

Write-Host ""
Write-Host "[4/4] Panelde yapilacaklar (5 dk):" -ForegroundColor Green
Write-Host @"

  CREATE -> Combined service
  Repo:    MrPEKGEG1N/yeraltimparatorlugu  branch: main
  Build:   Dockerfile /Dockerfile
  Port:    3000 HTTP Public
  Health:  GET /api/health

  Volumes -> Add volume
    Name: yeralti-db | Size: 1GB+ | Mount: /data

  Runtime environment (Secret isaretle):
    PERSISTENT_DATA_PATH=/data
    NODE_ENV=production
    PORT=3000
    ADMIN_USERNAME=mrpekgeg1n
    JWT_SECRET=yeralti-dev-gizli-anahtar-degistir
    SUPABASE_URL=$($env:SUPABASE_URL)
    SUPABASE_SERVICE_ROLE_KEY=<Railway Variables'dan kopyala>

  Deploy bitince PUBLIC_BASE_URL = Northflank public URL
  Dogrula: <url>/api/health -> oyuncular: 7, volumeOk: true

"@

if ($env:NORTHFLANK_API_TOKEN -and $env:NORTHFLANK_PROJECT_ID) {
    Write-Host "API token bulundu — otomatik kurulum deneniyor..." -ForegroundColor Cyan
    node tools/setup-northflank-service.js
}

Write-Host "Detay: northflank/DEPLOY.md"
