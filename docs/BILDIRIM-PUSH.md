# Bildirim / Push kurulumu

## Web Push (tarayıcı / PWA)
Canlı ortamda **kalıcı** VAPID anahtarları şarttır. Diskteki `db/vapid.json` ephemeral hostlarda silinirse tüm abonelikler ölür.

```bash
node -e "console.log(JSON.stringify(require('web-push').generateVAPIDKeys(),null,2))"
```

Render / sunucu env:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT=mailto:destek@...`

Oyuncu tarayıcıda bildirim izni vermeli. Chrome Android’de ana ekrana ekleme (PWA) kapalı sekmede daha güvenilir.

## Android APK (FCM — oyun kapalıyken)
1. Firebase Console’da Android app: `com.yeralti.imparatorlugu`
2. `google-services.json` → `android/app/google-services.json`
3. Service account JSON → env `FIREBASE_SERVICE_ACCOUNT_JSON` (tek satır) veya `FIREBASE_SERVICE_ACCOUNT_PATH`
4. `npm install` + `npx cap sync android` + APK build
5. Cihazda bildirim izni ver; giriş sonrası FCM token `/api/bildirim/fcm-token` ile kaydolur

Sunucu hem Web Push hem FCM gönderir (`bildirimGonder`).

## Test
Oyun içi zil → Ayarlar → **Test bildirimi gönder**. Sekme/uygulama kapalıyken OS bildirimi gelmeli (izin + abonelik/token varsa).
