# ROAD API — Ubuntu + PostgreSQL

## 1. PostgreSQL database бэлдэх

Ubuntu сервер дээр PostgreSQL суусан хэрэглэгчээр:

```bash
sudo -u postgres psql
```

Дараах SQL-ийг ажиллуул. `CHANGE_THIS_PASSWORD`-г хүчтэй нууц үгээр солино.

```sql
CREATE USER road_user WITH PASSWORD 'CHANGE_THIS_PASSWORD';
CREATE DATABASE road_db OWNER road_user;
\q
```

Schema-г үүсгэх:

```bash
psql "postgresql://road_user:CHANGE_THIS_PASSWORD@127.0.0.1:5432/road_db" -f db/init.sql
```

## 2. API ажиллуулах

```bash
cp .env.example .env
npm install
npm start
```

`.env` дотор `DATABASE_URL`, `JWT_SECRET`-ийг заавал соль. `OTP_MODE=development` үед OTP код Ubuntu terminal-ийн log дээр гарна.

## 3. Mobile app холбох

Root folder дахь `.env.example`-г `.env` болгож, Ubuntu серверийн LAN IP/domain-оор солино:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000/api
```

Дараа нь Expo server-ийг cache цэвэрлэн дахин асаа:

```powershell
npm.cmd start -- --lan --clear
```

## API

- `GET /api/health`
- `POST /api/auth/request-otp` — `{ "phone": "99112233" }`
- `POST /api/auth/verify-otp` — `{ "phone", "code" }` → утасны дугаараар хэрэглэгч үүсгээд `token` буцаана (`profileComplete: false`)
- `PUT /api/me/profile` — `Authorization: Bearer <token>`, `{ "lastName", "name", "email" (заавал биш), "userType": "driver" | "local" | "miner", "password" }`
- `PUT /api/me/avatar` — `Authorization: Bearer <token>`, `{ "image": "<base64 JPEG/PNG, ≤700 KB>" }` → `user.avatarPath`
- `DELETE /api/me/avatar` — профайлын зургийг устгана
- `GET /api/users/:id/avatar` — зураг (`avatarPath`-д `?v=` хувилбартай, урт хугацаагаар cache-лэгдэнэ)
- `POST /api/auth/login` — `{ "phone", "password" }` (профайлаа гүйцээсний дараа)

Бүртгэл: утасны дугаар → OTP → профайл хэсэгт овог, нэр, төрөл, нууц үг. Профайлаа гүйцээгээгүй хэрэглэгч дахин OTP авч үргэлжлүүлж болно.

### Админ

`/admin/` хаягаар (жишээ нь `https://zam.xpro.mn/admin/`, локалд `http://localhost:4100/admin/`) админ вэб нээгдэнэ: Dashboard (статистик) болон Хэрэглэгч (хайлт, блоклох, админ эрх). Апп дээрх утас, нууц үгээрээ нэвтэрнэ.

Анхны админыг database дээр гараар томилно (профайлаа гүйцээсэн хэрэглэгч байх ёстой):

```sql
UPDATE users SET role = 'admin' WHERE phone = '99112233';
```

Дараагийн админуудыг админ вэбээс томилно. Блоклогдсон хэрэглэгч нэвтэрч чадахгүй, хуучин token нь ч шууд хүчингүй болно.

- `GET /api/admin/stats` — нийт/шинэ/блоклогдсон тоо, төрлөөр, сүүлийн 14 хоногийн бүртгэл
- `GET /api/admin/users?q=&status=admin|blocked|incomplete&limit=&offset=`
- `PATCH /api/admin/users/:id` — `{ "role": "user" | "admin", "blocked": true | false }`

Production-д API-г HTTPS domain-ын ард ажиллуулж, `OTP_MODE=twilio` болгон Twilio-гоор SMS илгээнэ ([deploy/README.md](deploy/README.md#twilio-sms)). PostgreSQL-ийн 5432 портыг интернет рүү бүү нээ.
