#!/usr/bin/env bash
# ROAD API-г Ubuntu сервер дээр нэг удаа байршуулах script (дахин ажиллуулахад аюулгүй).
# Хэрэглээ: sudo bash setup.sh <certbot-email>
#   /tmp/road-server.tgz урьдчилан хуулагдсан байх ёстой.
set -euo pipefail

EMAIL="${1:?certbot email required: sudo bash setup.sh you@example.com}"
DOMAIN=zam.xpro.mn
APP=/opt/road/server
cd /tmp

echo "== 1. road хэрэглэгч, код =="
id road >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/road --shell /usr/sbin/nologin road
tar -xzf /tmp/road-server.tgz -C /opt/road
(cd "$APP" && npm ci --omit=dev --no-audit --no-fund)

echo "== 2. PostgreSQL =="
if [ ! -f "$APP/.env" ]; then
  DB_PASS=$(openssl rand -hex 24)
  if sudo -u postgres psql -Atc "select 1 from pg_roles where rolname='road_user'" | grep -q 1; then
    sudo -u postgres psql -qc "ALTER USER road_user WITH PASSWORD '$DB_PASS';"
  else
    sudo -u postgres psql -qc "CREATE USER road_user WITH PASSWORD '$DB_PASS';"
  fi
  sudo -u postgres psql -Atc "select 1 from pg_database where datname='road_db'" | grep -q 1 \
    || sudo -u postgres psql -qc "CREATE DATABASE road_db OWNER road_user;"
  cat > "$APP/.env" <<EOF
PORT=4000
HOST=127.0.0.1
DATABASE_URL=postgresql://road_user:$DB_PASS@127.0.0.1:5432/road_db
JWT_SECRET=$(openssl rand -hex 32)
OTP_MODE=test
OTP_TEST_CODE=780615
EOF
fi
sudo -u postgres psql -q -d road_db -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
DATABASE_URL=$(grep '^DATABASE_URL=' "$APP/.env" | cut -d= -f2-)
psql -q "$DATABASE_URL" -f "$APP/db/init.sql"
chown -R road:road /opt/road
chmod 600 "$APP/.env"

echo "== 3. systemd service =="
cp "$APP/deploy/road-api.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable road-api >/dev/null
systemctl restart road-api
sleep 3
curl -fsS http://127.0.0.1:4000/api/health && echo

echo "== 4. GitHub Actions deploy hook =="
install -m 755 -o root -g root "$APP/deploy/road-deploy.sh" /usr/local/bin/road-deploy
DEPLOY_USER="${SUDO_USER:-administrator}"
echo "$DEPLOY_USER ALL=(root) NOPASSWD: /usr/local/bin/road-deploy" > /etc/sudoers.d/80-road-deploy
chmod 440 /etc/sudoers.d/80-road-deploy
visudo -cf /etc/sudoers.d/80-road-deploy

echo "== 5. Web app files =="
command -v rsync >/dev/null || apt-get install -y -qq rsync
install -d -o "$DEPLOY_USER" -g www-data -m 755 /var/www/road-web
if [ -d /tmp/road-web ]; then
  cp -r /tmp/road-web/. /var/www/road-web/
  chown -R "$DEPLOY_USER":www-data /var/www/road-web
fi

echo "== 6. nginx ($DOMAIN) =="
cp "$APP/deploy/nginx-$DOMAIN.conf" /etc/nginx/sites-available/$DOMAIN
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
nginx -t
systemctl reload nginx

echo "== 7. HTTPS (certbot) =="
command -v certbot >/dev/null || apt-get install -y -qq certbot python3-certbot-nginx
# --redirect-гүй: provider-ийн firewall 443-ыг нээх хүртэл HTTP ажилласаар байна.
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m "$EMAIL" --no-redirect

echo "== DONE =="
curl -sS http://$DOMAIN/api/health && echo
