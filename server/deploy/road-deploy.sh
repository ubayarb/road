#!/usr/bin/env bash
# Шинэ кодыг байршуулж API-г дахин асаана. GitHub Actions /tmp/road-server.tgz-г хуулаад
# `sudo /usr/local/bin/road-deploy` гэж дуудна (setup.sh суулгана, sudoers-д зөвхөн энэ зөвшөөрөгдсөн).
set -euo pipefail

ARCHIVE=/tmp/road-server.tgz
APP=/opt/road/server
cd /tmp

[ -f "$ARCHIVE" ] || { echo "$ARCHIVE not found"; exit 1; }
[ -f "$APP/.env" ] || { echo "$APP/.env missing: run setup.sh first"; exit 1; }

# Хуучин src-д устсан файл үлдэхгүйн тулд src-г цэвэрлэнэ (.env, node_modules хэвээр).
rm -rf "$APP/src"
tar -xzf "$ARCHIVE" -C /opt/road
rm -f "$ARCHIVE"
(cd "$APP" && npm ci --omit=dev --no-audit --no-fund)
chown -R road:road /opt/road
chmod 600 "$APP/.env"

# Schema шинэчлэл (init.sql нь IF NOT EXISTS-тэй, өгөгдөл устгахгүй).
DATABASE_URL=$(grep '^DATABASE_URL=' "$APP/.env" | cut -d= -f2-)
psql -q -v ON_ERROR_STOP=1 "$DATABASE_URL" -f "$APP/db/init.sql"

# nginx тохиргоо repo-д өөрчлөгдсөн бол шинэчилнэ. certbot-ын нэмсэн 443 блокийг дахин суулгана;
# амжилтгүй бол хуучныг сэргээнэ.
SITE=/etc/nginx/sites-available/zam.xpro.mn
CONF="$APP/deploy/nginx-zam.xpro.mn.conf"
if [ -f "$SITE" ] && ! cmp -s "$CONF" "$SITE.repo"; then
  cp "$SITE" "$SITE.bak"
  cp "$CONF" "$SITE"
  if certbot install --nginx --cert-name zam.xpro.mn --non-interactive >/dev/null && nginx -t; then
    cp "$CONF" "$SITE.repo"
    systemctl reload nginx
    echo "nginx config updated"
  else
    cp "$SITE.bak" "$SITE"
    echo "nginx config update failed, previous config restored"
  fi
fi

# Дараагийн deploy энэ скриптийн шинэ хувилбараар ажиллана.
install -m 755 -o root -g root "$APP/deploy/road-deploy.sh" /usr/local/bin/road-deploy

PORT=$(grep '^PORT=' "$APP/.env" | cut -d= -f2-)
systemctl restart road-api
for i in $(seq 1 10); do
  if curl -fsS "http://127.0.0.1:${PORT:-4000}/api/health"; then echo; echo "DEPLOY OK"; exit 0; fi
  sleep 2
done
echo "Health check failed"; journalctl -u road-api -n 30 --no-pager; exit 1
