# Koyeb deploy — kart gerektirmez (Northflank alternatifi)

Northflank kart dogrulamasi Turkiye'deki bircok bankada reddedilir. **Koyeb Hobby** ucretsiz ve genelde kart istemez.

## Veri koruma

Volume yok → **Supabase yedek** + `seed/oyun.db` (7 oyuncu). Deploy sonrasi Supabase'den geri yuklenir.

## Kurulum (CLI — onerilen)

```powershell
npm run setup:koyeb
tools\bin\koyeb.exe login    # terminalde calistir (tarayici acilir)
npm run provision:koyeb
```

## Kurulum (sadece tarayici — kart yok)

1. https://app.koyeb.com → GitHub ile kayit ol (kart istemez)
2. **Create App** → **GitHub** → `MrPEKGEG1N/yeraltimparatorlugu` branch `main`
3. Builder: **Dockerfile**
4. Instance: **Free** — Region: **Frankfurt (fra)**
5. Port `3000`, health check `/api/health`
6. Environment variables:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `ADMIN_USERNAME=mrpekgeg1n`
   - `JWT_SECRET=yeralti-dev-gizli-anahtar-degistir`
   - `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` (Railway Variables'dan)
7. Deploy → URL'yi kopyala → `npm run update:url https://<url>`

## Dogrulama

`GET https://<url>/api/health` → `oyuncular: 7`, `kaliciVeri: supabase-yedek` veya `seed-yedek`

## Notlar

- Ucretsiz instance: 512 MB RAM, Frankfurt
- 1 saat islem olmazsa uyur (ilk istekte acilir)
- Railway trial bitti — Koyeb veya ucretli Railway gerekir
