# Yangi Choy — VPS'ga deploy (Ubuntu + Nginx + PM2 + SSL)

Baza: **Google Sheets** (o'zgarmaydi). Domen: **musaffotea.uz**.

> VPS: Ubuntu 22.04 (yoki 24.04), kamida 1 GB RAM. ahost.uz / ps.uz / cloud.uz dan oling.
> Quyidagi komandalarni VPS'ga SSH bilan kirib bajaring.

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
```bash
cd /var/www/yangi-choy
git pull
npm install
npm run build --workspace=web
pm2 restart yangi-choy
```

## Foydali komandalar
```bash
pm2 logs yangi-choy      # loglar
pm2 status               # holat
pm2 restart yangi-choy   # qayta ishga tushirish
```
