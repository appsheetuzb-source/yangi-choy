#!/usr/bin/env bash
# Yangi Choy — VPS avtomatik setup (root sifatida ishga tushiring)
# Oldindan: loyiha /var/www/yangi-choy ga clone qilingan va
#           apps/web/.env.local yaratilgan bo'lishi kerak.
set -e

APP_DIR=/var/www/yangi-choy
IP=$(hostname -I | awk '{print $1}')

echo "==> 1/5 Node 20, nginx, pm2 o'rnatilmoqda..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
apt install -y nginx
npm install -g pm2 >/dev/null 2>&1 || npm install -g pm2

echo "==> Env tekshirish..."
if [ ! -f "$APP_DIR/apps/web/.env.local" ]; then
  echo "!! XATO: $APP_DIR/apps/web/.env.local topilmadi."
  echo "   Avval shuni bajaring: nano $APP_DIR/apps/web/.env.local"
  exit 1
fi

echo "==> 2/5 O'rnatish va build (bir necha daqiqa kutiladi)..."
cd "$APP_DIR"
npm install
npm run build --workspace=web

echo "==> 3/5 PM2 bilan ishga tushirish..."
pm2 delete yangi-choy 2>/dev/null || true
pm2 start "$APP_DIR/deploy/ecosystem.config.js"
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash 2>/dev/null || true

echo "==> 4/5 Nginx sozlanmoqda..."
cp "$APP_DIR/deploy/nginx-musaffotea.conf" /etc/nginx/sites-available/musaffotea
ln -sf /etc/nginx/sites-available/musaffotea /etc/nginx/sites-enabled/musaffotea
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "==> 5/5 TAYYOR! ✅"
echo "    Sayt ochildi:  http://$IP"
echo ""
echo "    Keyingi qadamlar (domen + SSL):"
echo "    1) DNS: musaffotea.uz A yozuv -> $IP"
echo "    2) DNS tarqalgach:"
echo "       apt install -y certbot python3-certbot-nginx"
echo "       certbot --nginx -d musaffotea.uz -d www.musaffotea.uz"
echo ""
