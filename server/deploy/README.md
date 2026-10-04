# ROAD API — Ubuntu сервер дээр тестийн хувилбар байршуулах

Үр дүн: `https://api.eland.mn/api` (HTTPS, nginx → Node API → PostgreSQL), OTP тогтмол тест кодтой.

## 0. Урьдчилсан нөхцөл

1. **Сервер интернэтээс хандагдах ёстой.** `103.168.35.250` одоо 22/80/443/4000 бүх портоор хариу өгөхгүй байна. Hosting-ийн удирдлагын самбараас сервер асаалттай эсэх, provider-ийн firewall/security group-д **22, 80, 443** порт нээлттэй эсэхийг шалга. 4000 портыг гадагш **бүү** нээ.
2. **DNS:** `eland.mn`-ийн DNS удирдлагад A record нэм:

   | Type | Name | Value |
   |---|---|---|
   | A | `api` | `103.168.35.250` |

   Шалгах: `nslookup api.eland.mn` → `103.168.35.250`.

## 1. Програм суулгах (Ubuntu 22.04/24.04)

```bash
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs postgresql nginx certbot python3-certbot-nginx
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

## 2. Код хуулах

Windows компьютер дээрээс (PowerShell, `C:\VSCode\ZAM` дотроос):

```powershell
tar --exclude=node_modules --exclude=.env -czf road-server.tgz server
scp road-server.tgz USER@103.168.35.250:/tmp/
```

Сервер дээр:

```bash
sudo useradd --system --create-home --home-dir /opt/road --shell /usr/sbin/nologin road
sudo tar -xzf /tmp/road-server.tgz -C /opt/road
cd /opt/road/server && sudo npm ci --omit=dev
sudo chown -R road:road /opt/road
```

## 3. PostgreSQL

```bash
DB_PASS=$(openssl rand -hex 24); echo "DB password: $DB_PASS"
sudo -u postgres psql -c "CREATE USER road_user WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "CREATE DATABASE road_db OWNER road_user;"
sudo -u postgres psql -d road_db -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
psql "postgresql://road_user:$DB_PASS@127.0.0.1:5432/road_db" -f /opt/road/server/db/init.sql
```

Өмнө нь DB үүсгэсэн бол зөвхөн сүүлийн `psql ... -f db/init.sql` мөрийг ажиллуулна (шинэ багануудыг нэмнэ, өгөгдөл устахгүй).

## 4. `.env`

```bash
sudo -u road tee /opt/road/server/.env > /dev/null <<EOF
PORT=4000
HOST=127.0.0.1
DATABASE_URL=postgresql://road_user:$DB_PASS@127.0.0.1:5432/road_db
JWT_SECRET=$(openssl rand -hex 32)
OTP_MODE=test
OTP_TEST_CODE=780615
EOF
sudo chmod 600 /opt/road/server/.env
```

Тестийн үеийн тогтмол код: **780615**. Үүнийг зөвхөн тестерүүддээ хэл. **Анхаар:** тест горимд энэ кодыг мэдсэн хэн ч дурын дугаараар бүртгүүлж чадна — жинхэнэ хэрэглэгчдэд нээхээс өмнө доорх **Twilio SMS** хэсгийг хийж `OTP_MODE=twilio` болгоно.

## 5. Service

```bash
sudo cp /opt/road/server/deploy/road-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now road-api
sudo systemctl status road-api        # active (running) байх ёстой
curl http://127.0.0.1:4000/api/health # {"status":"ok"}
```

Log харах: `journalctl -u road-api -f`

## 6. nginx + HTTPS

```bash
sudo cp /opt/road/server/deploy/nginx-api.eland.mn.conf /etc/nginx/sites-available/api.eland.mn
sudo ln -s /etc/nginx/sites-available/api.eland.mn /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.eland.mn --redirect -m YOUR_EMAIL --agree-tos
```

Шалгах (дурын төхөөрөмжөөс): `https://api.eland.mn/api/health` → `{"status":"ok"}`

## Twilio SMS

Тест дууссаны дараа OTP-г жинхэнэ SMS-ээр илгээх.

1. **Twilio бүртгэл:** https://console.twilio.com → Account SID, Auth Token-оо ав.
2. **Илгээгч:** Messaging → Services → шинэ Messaging Service үүсгэ (`MG...` SID). Sender pool-д Монгол руу илгээх боломжтой дугаар эсвэл Alphanumeric Sender ID (жишээ нь `ROAD`) нэм. Монгол руу alphanumeric sender ID дэмжигдэх эсэх, бүртгэл шаардлагатай эсэхийг Twilio-гийн "SMS Guidelines → Mongolia" хуудаснаас шалга.
3. **Geo permissions (заавал):** Messaging → Settings → Geo permissions дээр **зөвхөн Mongolia**-г идэвхжүүл. Ингэснээр SMS pumping луйвраар гадаадын үнэтэй дугаар руу илгээгдэхээс сэргийлнэ.
4. **Trial бүртгэл:** зөвхөн "Verified Caller IDs"-д нэмсэн дугаар руу илгээнэ. Тестерүүдэд нээхийн тулд бүртгэлээ upgrade хий.
5. Сервер дээрх `.env`-г засах:

   ```bash
   sudo -u road nano /opt/road/server/.env
   ```

   ```env
   OTP_MODE=twilio
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_MESSAGING_SERVICE_SID=MG...
   SMS_DEFAULT_COUNTRY_CODE=+976
   ```

   Messaging Service-ийн оронд `TWILIO_FROM=+1...` (Twilio дугаар) ашиглаж болно.

6. `sudo systemctl restart road-api` → `journalctl -u road-api -n 20`-д `OTP_MODE=twilio` гарсан эсэхийг шалга.

Хамгаалалт: нэг дугаарт 60 секундэд 1 код, код 5 минут хүчинтэй, 5 буруу оролдлогын дараа түгжинэ, nginx нэг IP-ээс `/api/auth/` руу минутад 10 хүсэлт. SMS илгээгдээгүй бол алдаа `journalctl -u road-api`-д `[ROAD OTP] SMS to ... failed` гэж гарна.

## Шинэчлэх

```powershell
tar --exclude=node_modules --exclude=.env -czf road-server.tgz server
scp road-server.tgz USER@103.168.35.250:/tmp/
```

```bash
sudo tar -xzf /tmp/road-server.tgz -C /opt/road
cd /opt/road/server && sudo npm ci --omit=dev && sudo chown -R road:road /opt/road
sudo systemctl restart road-api
```

Schema өөрчлөгдсөн бол `psql ... -f db/init.sql`-г дахин ажиллуулна.
