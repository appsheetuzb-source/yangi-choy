# Yangi Choy — VPS'ga deploy (Ubuntu + Nginx + PM2 + SSL)

Baza: **Google Sheets** (o'zgarmaydi). Domen: **musaffotea.uz**.

> VPS: Ubuntu 22.04 (yoki 24.04), kamida 1 GB RAM. ahost.uz / ps.uz / cloud.uz dan oling.
> Quyidagi komandalarni VPS'ga SSH bilan kirib bajaring.

---

## ⚠️ ISH OQIMI (MAJBURIY): avval LOKAL, keyin DEPLOY

Har bir yangi o'zgarish quyidagi tartibda chiqariladi — **to'g'ridan-to'g'ri serverga o'zgartirish kiritilmaydi**:

1. **Lokalda yozish** — kodni `c:\Users\user\Desktop\yangi-choy` da o'zgartirish.
2. **Lokalda test** — `npm run dev --workspace=web` → http://localhost:3000 da tekshirish (yoki `npm run build --workspace=web` xatosiz o'tishi).
3. **Foydalanuvchi tasdiqlashi** — lokalda hammasi to'g'ri ishlasagina davom etamiz.
4. **Commit + push** — `git add -A && git commit && git push origin main`.
5. **Serverga deploy** — pastdagi "Yangilash" bo'limidagi komandalar bilan VPS'ga chiqarish.

> Qisqasi: **lokalda ishlamaguncha — deploy yo'q.** Server (musaffotea.uz) faqat tekshirilgan kodni oladi.

---

## 1. Tizimni tayyorlash (Node 20, git, nginx, pm2)
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
sudo npm install -g pm2
```

## 2. Loyihani yuklash
```bash
sudo mkdir -p /var/www && cd /var/www
sudo git clone https://github.com/appsheetuzb-source/yangi-choy.git
sudo chown -R $USER:$USER /var/www/yangi-choy
cd /var/www/yangi-choy
```

## 3. Env faylini yaratish (Google Sheets ulanishi)
```bash
nano apps/web/.env.local
```
Ichiga 4 ta qatorni qo'ying (qiymatlarni lokal `.env.local`dan ko'chiring):
```
GOOGLE_SHEETS_ID=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_NAME=...
```
Saqlash: `Ctrl+O`, `Enter`, `Ctrl+X`.

## 4. O'rnatish va build
```bash
npm install
npm run build --workspace=web
```

## 5. PM2 bilan ishga tushirish
```bash
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup     # chiqgan komandani nusxalab bajaring (reboot'da avto-start)
```
Tekshirish: `curl -I http://localhost:3000` → 200 bo'lsa ishlayapti.

## 6. Nginx (domenni ulash)
```bash
sudo cp deploy/nginx-musaffotea.conf /etc/nginx/sites-available/musaffotea
sudo ln -s /etc/nginx/sites-available/musaffotea /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 7. DNS — domenni VPS'ga yo'naltirish
Domen registratorida (musaffotea.uz boshqaruv panelida) **A yozuv**:
```
A    @      <VPS_IP>
A    www    <VPS_IP>
```
(VPS IP'ni hosting bergan; tarqalishi 5 daq–1 soat)

## 8. SSL (HTTPS, bepul Let's Encrypt)
DNS tarqalgach:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d musaffotea.uz -d www.musaffotea.uz
```
Avtomatik yangilanish o'rnatiladi. Endi: **https://musaffotea.uz** ✅

---

## Yangilash (kod o'zgargach)

Asosiy production deploy endi GitHub Actions orqali yuradi: `main` branch'ga push/merge bo'lsa,
GitHub Linux runner'da `next build` qiladi, VPS'dagi source'ni shu commitga reset qiladi, tayyor
`.next` artifact'ni yuboradi va PM2 reload qiladi. Shuning uchun kichik VPS endi sekin
`next build` bilan band bo'lmaydi.

Manual deploy kerak bo'lsa GitHub'da **Actions → Deploy VPS → Run workflow** bosing.

`package.json` yoki `package-lock.json` o'zgargan kamyob holatda VPS'da runtime dependency'larni
alohida maintenance oynasida yangilang; odatiy deploy buni qilmaydi, chunki bu qadam kichik VPS'da
sekin va ba'zan `node_modules` rename xatolari beradi.

Eski server ichida build qiladigan fallback:
```bash
cd /var/www/yangi-choy
git pull
npm install
npm run build --workspace=web
pm2 restart yangi-choy
```

## PostgreSQL sekinlashsa: index hotfix

Sheets'dan PostgreSQL'ga ko'chirilgan jadval nomlari va `btrim()` bilan ishlaydigan ID qidiruvlari uchun tayyor index script:

```bash
cd /var/www/yangi-choy
psql "$DATABASE_URL" -f deploy/postgres-performance-indexes.sql
```

Script `CREATE INDEX CONCURRENTLY` ishlatadi, shuning uchun uni `BEGIN/COMMIT` ichida ishga tushirmang. Agar ixtiyoriy jadval yoki ustun prod bazada yo'q bo'lsa, o'sha index qatorini olib tashlab qayta ishga tushiring.

## Foydali komandalar
```bash
pm2 logs yangi-choy      # loglar
pm2 status               # holat
pm2 restart yangi-choy   # qayta ishga tushirish
```
