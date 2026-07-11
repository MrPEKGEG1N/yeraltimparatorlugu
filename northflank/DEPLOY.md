# Northflank deploy — Yeraltı İmparatorluğu

Railway süresi dolduğunda bu rehberle oyunu Northflank’a taşıyın. Oyuncu verisi **volume (/data)** + **Supabase yedek** + **seed/oyun.db** ile korunur.

## 1. Veriyi hazırla (yerelde) — TAMAMLANDI

Son Supabase yedeği (2026-07-10) ile **7 oyuncu** `seed/oyun.db` ve `seed/oyuncular/*.json` içine yazıldı.

Yeniden hazırlamak için:

```powershell
# Railway CLI oturumu varsa Supabase otomatik okunur:
npm run prepare:northflank
```

Bu komut en iyi `oyun.db` dosyasını seçer, `seed/oyun.db` ve `seed/oyuncular/*.json` snapshot’larını günceller.

## 2. Northflank — Combined service oluştur

1. [Northflank](https://northflank.com) → **Create new** → **Combined service**
2. **Repository:** `MrPEKGEG1N/yeraltimparatorlugu` — branch `main`
3. **Build:** Dockerfile — path `/Dockerfile`
4. **Port:** internal `3000`, protocol HTTP, **Public** açık
5. **Health check:** HTTP GET `/api/health`, port 3000

## 3. Kalıcı volume (zorunlu)

Servis → **Volumes** → **Add volume**

| Alan | Değer |
|------|--------|
| Volume adı | `yeralti-db` |
| Boyut | 1 GB+ |
| Container mount path | `/data` |

**Runtime environment:**

```
PERSISTENT_DATA_PATH=/data
NODE_ENV=production
PORT=3000
ADMIN_USERNAME=mrpekgeg1n
JWT_SECRET=<uzun-rastgele-gizli>
SUPABASE_URL=<supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
PUBLIC_BASE_URL=https://<northflank-public-url>
```

`JWT_SECRET` ve Supabase değerlerini **Secret** olarak işaretleyin.

İlk açılışta volume boşsa sunucu otomatik olarak:
1. Supabase’den `oyun.db` indirir
2. Yoksa `seed/oyun.db` + oyuncu snapshot’larını kullanır

## 4. Deploy

GitHub’a push edin; Northflank CI/CD otomatik build + deploy yapar.

```powershell
git add .
git commit -m "deploy: Northflank migration"
git push origin main
```

## 5. Doğrulama

```text
GET https://<SIZIN-URL>/api/health
```

Beklenen:

- `status`: `"ready"`
- `volume`: `"/data"`
- `volumeOk`: `true`
- `oyuncular`: > 0
- `kaliciVeri`: `"volume+supabase"` veya `"volume"`

## 6. APK / domain güncelleme

Northflank URL’niz belli olduktan sonra:

```powershell
$env:PUBLIC_BASE_URL="https://<SIZIN-URL>"
$env:CAPACITOR_SERVER_URL=$env:PUBLIC_BASE_URL
npm run android:apk
```

`kurallar.json` içindeki eski Railway adreslerini yeni `PUBLIC_BASE_URL` ile güncelleyin.

## Sorun giderme

| Belirti | Çözüm |
|---------|--------|
| `oyuncular: 0` | Supabase anahtarlarını kontrol edin; volume `/data` mount’lu mu bakın |
| `volumeOk: false` | `PERSISTENT_DATA_PATH=/data` ayarlı mı, mount path `/data` mi |
| Eski oyuncular eksik | Supabase’den `node tools/download-supabase-backups.js` ile son yedeği indirin, `prepare-northflank-deploy.js` tekrar çalıştırın |

## Railway’den farklar

| Railway | Northflank |
|---------|------------|
| `RAILWAY_VOLUME_MOUNT_PATH` otomatik | `PERSISTENT_DATA_PATH=/data` elle ayarlanır |
| `railway.toml` mounts | Volume UI → container mount `/data` |

Kod her iki platformu da destekler (`PERSISTENT_DATA_PATH` öncelikli).
