#!/usr/bin/env bash
# Yangi Choy (Musaffo Tea) — server ichida build qiladigan FALLBACK deploy.
#
# Asosiy production yo'l: GitHub Actions (`.github/workflows/deploy-vps.yml`).
# U build'ni GitHub runner'da qiladi va VPS'ga tayyor artifact yuboradi. Kichik
# VPS'da `next build` juda sekin bo'lgani uchun odatiy deployda shu yo'l ishlatiladi.
#
# Bu script faqat GitHub Actions ishlamasa yoki favqulodda manual deploy kerak
# bo'lsa serverda ishlatiladi.
#
# Muammo: oldin `next build` jonli ilovaning `.next` papkasi ustiga yozardi va
# kichik VPS'ni band qilib ~10 daqiqa saytni o'chirardi.
#
# Yechim: build ALOHIDA klonda (/var/www/yc-build) bajariladi — jonli sayt o'z
# `.next`idan ishlab turaveradi. Build past CPU/IO prioritetda (nice/ionice), shu
# sabab sayt sekinlashmaydi. Tayyor bo'lgach `.next` atomik almashtirilib, PM2
# graceful `reload` qilinadi (eski ishchi yangi tayyor bo'lgach almashadi).
#
# Ishlatish (serverda):  sudo bash /var/www/yangi-choy/deploy/deploy.sh
set -euo pipefail

LIVE=/var/www/yangi-choy
BUILD=/var/www/yc-build
APP=apps/web

echo "==> [1/5] Build klonini origin/main'ga yangilash"
cd "$BUILD"
git fetch --quiet origin main
git reset --hard --quiet origin/main
cp -f "$LIVE/$APP/.env.local" "$BUILD/$APP/.env.local"

echo "==> [2/5] Bog'liqliklar (o'zgargan bo'lsa o'rnatiladi)"
npm install --no-audit --no-fund

echo "==> [3/5] Build (past prioritet — jonli sayt ishlab turadi)"
# .next/cache (Turbopack inkremental kesh) SAQLANADI — keyingi buildlar tezroq.
# Eski build chiqishini tozalaymiz, lekin keshni emas:
find "$BUILD/$APP/.next" -mindepth 1 -maxdepth 1 ! -name cache -exec rm -rf {} + 2>/dev/null || true
NODE_OPTIONS=--max-old-space-size=2048 nice -n 19 ionice -c3 \
  npm run build --workspace=web

echo "==> [4/5] Live source'ni yangilab, .next'ni atomik almashtirish"
cd "$LIVE"
git fetch --quiet origin main
git reset --hard --quiet origin/main
# LIVE node_modules'ni yangilash — yangi paketlar (masalan pg) runtime'da topilishi uchun.
# next start LIVE node_modules'dan require qiladi; build klonidagi o'rnatish bu yerga ko'chmaydi.
npm install --no-audit --no-fund
rm -rf "$LIVE/$APP/.next.new" "$LIVE/$APP/.next.old"
cp -a "$BUILD/$APP/.next" "$LIVE/$APP/.next.new"
cd "$LIVE/$APP"
mv .next .next.old 2>/dev/null || true
mv .next.new .next

echo "==> [5/5] PM2 graceful reload (uzilishsiz)"
cd "$LIVE"
pm2 reload yangi-choy --update-env
rm -rf "$LIVE/$APP/.next.old"
echo "✅ ZERO-DOWNTIME DEPLOY OK"
