# Render deploy — kart gerektirmez

Northflank/Koyeb kart sorunu yasandiginda **Render Free** en kolay yol.

## Veri koruma

Volume yok (ucretsiz) → **Supabase yedek** + `seed/oyun.db` (7 oyuncu).

## Hizli kurulum (tarayici)

1. https://dashboard.render.com → **GitHub** ile giris (kart yok)
2. Blueprint ac:
   https://dashboard.render.com/blueprint/new?repo=https://github.com/MrPEKGEG1N/yeraltimparatorlugu
3. `SUPABASE_SERVICE_ROLE_KEY` soruldugunda Railway Variables'dan yapistir
4. **Apply** → deploy bitince URL: `https://yeralti-game.onrender.com`
5. `npm run update:url https://yeralti-game.onrender.com`

## CLI (API token ile)

1. https://dashboard.render.com/u/settings/api-keys → token olustur
2. PowerShell:
   ```powershell
   $env:RENDER_API_KEY="rnd_..."
   npm run provision:render
   ```

## Dogrulama

`GET /api/health` → `oyuncular: 7`, Supabase yapilandirilmis

## Notlar

- Ucretsiz instance 15 dk inbound yoksa uyur; ilk istek ~30-60 sn acilir
- **7/24 uyaniklik (uc katman):**
  1. Sunucu `RENDER_EXTERNAL_URL` uzerinden her ~4 dk self-ping (`KEEP_ALIVE_SELF=0` ile kapatilir)
  2. GitHub Actions: `keep-alive.yml` + `keep-alive-backup.yml` (offset cron)
  3. Acik tarayici sekmesi her 3 dk `/api/ping`
- Not: Free planda ayda ~750 saat; 7/24 acik tutmak bu kotayi doldurur. Kesin cozum: Render Starter (uyuma yok).
- Manuel ping: `npm run keep-alive:ping` veya `KEEP_ALIVE_URL=https://... node tools/keep-alive-ping.js`
- Frankfurt bolgesi (`render.yaml`)
- Railway trial bitti; Render ucretsiz devam eder
