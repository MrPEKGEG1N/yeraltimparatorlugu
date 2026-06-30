# Railway Volume + Supabase kalici veri kurulumu
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "=== Kalici veri: Railway + Supabase ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1) RAILWAY VOLUME (birincil — deployda veri kalir)" -ForegroundColor Yellow
Write-Host "   npx @railway/cli login"
Write-Host "   npx @railway/cli link"
Write-Host "   npm run railway:volume"
Write-Host "   Volume: yeralti-db  |  Mount: /app/db"
Write-Host ""
Write-Host "2) SUPABASE YEDEK (bulut — volume kaybolursa geri yukler)" -ForegroundColor Yellow
Write-Host "   Supabase Dashboard > Project Settings > API"
Write-Host "   Railway > Variables ekleyin:"
Write-Host "     SUPABASE_URL=https://xxxx.supabase.co"
Write-Host "     SUPABASE_SERVICE_ROLE_KEY=eyJ... (service_role, anon degil!)"
Write-Host "   Opsiyonel: SUPABASE_DB_BUCKET=yeralti-db-backups"
Write-Host ""
Write-Host "3) DEPLOY" -ForegroundColor Yellow
Write-Host "   npm run deploy"
Write-Host ""
Write-Host "4) KONTROL" -ForegroundColor Yellow
Write-Host "   https://yeraltimparatorlugu-production.up.railway.app/api/health"
Write-Host "   volumeOk: true  VEYA  supabase.configured: true"
Write-Host "   kaliciVeri: railway-volume veya supabase-yedek"
Write-Host ""

if ($env:SUPABASE_URL -and $env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Host "Supabase env bu makinede tanimli — test yedek:" -ForegroundColor Green
    Set-Location $Root
    node -e "require('./services/supabaseBackupService').uploadDbBackup(require('./db/database').DB_PATH).then(r=>console.log(r)).catch(e=>console.error(e))"
} else {
    Write-Host "Supabase env yok (normal). Railway panelinden ekleyin." -ForegroundColor Gray
}
