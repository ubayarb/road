require('dotenv').config();

const bcrypt = require('bcryptjs');
const { randomInt } = require('crypto');
const cors = require('cors');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { assertTwilioConfig, sendSms, toE164 } = require('./sms');

const required = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`${key} is missing. Copy .env.example to .env and set it.`);
}

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.PORT || 4000);
// Behind nginx set HOST=127.0.0.1 so the API is only reachable through HTTPS.
const host = process.env.HOST || '0.0.0.0';
// OTP_MODE: development = code in server log, test = fixed OTP_TEST_CODE for everyone, twilio = SMS via Twilio.
const otpMode = process.env.OTP_MODE || 'development';
const OTP_MODES = ['development', 'test', 'twilio'];
if (!OTP_MODES.includes(otpMode)) throw new Error(`OTP_MODE must be one of: ${OTP_MODES.join(', ')}.`);
const otpTestCode = process.env.OTP_TEST_CODE || '';
if (otpMode === 'test' && !/^\d{6}$/.test(otpTestCode)) throw new Error('OTP_MODE=test requires a 6-digit OTP_TEST_CODE.');
if (otpMode === 'twilio') assertTwilioConfig();

app.use(cors());
app.use(express.json());

const cleanPhone = (value = '') => value.replace(/[^0-9+]/g, '');
const isValidPhone = (phone) => /^\+?[0-9]{8,15}$/.test(phone);
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const tokenFor = (user) => jwt.sign({ sub: user.id, phone: user.phone }, process.env.JWT_SECRET, { expiresIn: '7d' });
const MAX_OTP_ATTEMPTS = 5;
// Minimum gap between codes for one number; limits SMS cost and SMS-pumping abuse.
const OTP_RESEND_SECONDS = 60;
const USER_TYPES = ['driver', 'local', 'miner'];

// Express 4 does not forward rejected promises to the error handler; without this a DB error crashes the process.
const route = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// A user exists right after OTP verification; names, type and password are filled in later from the profile screen.
const isProfileComplete = (user) => Boolean(user.last_name && user.name && user.user_type && user.password_hash);

function publicUser(user) {
  return {
    id: user.id,
    lastName: user.last_name,
    name: user.name,
    email: user.email,
    phone: user.phone,
    userType: user.user_type,
    profileComplete: isProfileComplete(user),
    createdAt: user.created_at,
  };
}

function requireAuth(req, res, next) {
  const [scheme, token] = String(req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ message: 'Нэвтэрнэ үү.' });
  try {
    req.userId = jwt.verify(token, process.env.JWT_SECRET).sub;
    return next();
  } catch {
    return res.status(401).json({ message: 'Нэвтрэх хугацаа дууссан. Дахин нэвтэрнэ үү.' });
  }
}

app.get('/api/health', route(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
}));

app.post('/api/auth/request-otp', route(async (req, res) => {
  const phone = cleanPhone(req.body.phone);
  if (!isValidPhone(phone)) return res.status(400).json({ message: 'Утасны дугаар буруу байна.' });

  // Users who verified but never finished their profile may request a new code to resume.
  const existing = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
  if (existing.rowCount && isProfileComplete(existing.rows[0])) {
    return res.status(409).json({ message: 'Энэ утасны дугаар бүртгэлтэй байна. Нэвтрэх хэсгээр орно уу.' });
  }

  const recent = await pool.query(
    `SELECT 1 FROM otp_codes WHERE phone = $1 AND purpose = 'register' AND created_at > NOW() - INTERVAL '${OTP_RESEND_SECONDS} seconds'`,
    [phone],
  );
  if (recent.rowCount) {
    return res.status(429).json({ message: `Код саяхан илгээгдсэн. ${OTP_RESEND_SECONDS} секундийн дараа дахин оролдоно уу.` });
  }

  const code = otpMode === 'test' ? otpTestCode : String(randomInt(100000, 1000000));
  const codeHash = await bcrypt.hash(code, 10);
  await pool.query('DELETE FROM otp_codes WHERE phone = $1 AND purpose = $2', [phone, 'register']);
  const inserted = await pool.query(
    'INSERT INTO otp_codes (phone, code_hash, purpose, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'5 minutes\') RETURNING id',
    [phone, codeHash, 'register'],
  );

  if (otpMode === 'development') console.log(`[ROAD OTP] ${phone}: ${code}`);
  if (otpMode === 'twilio') {
    try {
      // Cyrillic SMS is UCS-2: keep under 70 characters so it stays a single billed segment.
      await sendSms(toE164(phone), `ROAD код: ${code}. 5 минут хүчинтэй. Хэнд ч бүү хэл.`);
    } catch (error) {
      // Drop the unsent code so the cooldown does not block an immediate retry.
      await pool.query('DELETE FROM otp_codes WHERE id = $1', [inserted.rows[0].id]);
      console.error(`[ROAD OTP] SMS to ${phone} failed:`, error.message);
      return res.status(502).json({ message: 'SMS илгээж чадсангүй. Дугаараа шалгаад дахин оролдоно уу.' });
    }
  }
  res.status(201).json({ message: 'Баталгаажуулах код илгээгдлээ.', expiresIn: 300 });
}));

app.post('/api/auth/verify-otp', route(async (req, res) => {
  const phone = cleanPhone(req.body.phone);
  const code = String(req.body.code || '');
  if (!isValidPhone(phone) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: 'Утасны дугаар болон 6 оронтой кодоо шалгана уу.' });
  }
  const otpResult = await pool.query(
    `SELECT * FROM otp_codes WHERE phone = $1 AND purpose = 'register' AND consumed_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
    [phone],
  );
  const otp = otpResult.rows[0];
  if (otp && otp.attempts >= MAX_OTP_ATTEMPTS) {
    return res.status(429).json({ message: 'Хэт олон удаа буруу код оруулсан байна. Шинэ код авна уу.' });
  }
  if (!otp || !(await bcrypt.compare(code, otp.code_hash))) {
    if (otp) await pool.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [otp.id]);
    return res.status(400).json({ message: 'Баталгаажуулах код буруу эсвэл хугацаа нь дууссан байна.' });
  }

  await pool.query('INSERT INTO users (phone) VALUES ($1) ON CONFLICT (phone) DO NOTHING', [phone]);
  const user = (await pool.query('SELECT * FROM users WHERE phone = $1', [phone])).rows[0];
  if (isProfileComplete(user)) {
    return res.status(409).json({ message: 'Энэ утасны дугаар бүртгэлтэй байна. Нэвтрэх хэсгээр орно уу.' });
  }
  await pool.query('UPDATE otp_codes SET consumed_at = NOW() WHERE id = $1', [otp.id]);
  res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
}));

app.post('/api/auth/login', route(async (req, res) => {
  const phone = cleanPhone(req.body.phone);
  const password = String(req.body.password || '');
  const result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
  const user = result.rows[0];
  if (user && !user.password_hash) {
    return res.status(401).json({ message: 'Бүртгэл дуусаагүй байна. "Бүртгүүлэх" хэсгээр код аваад профайлаа гүйцээнэ үү.' });
  }
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: 'Утасны дугаар эсвэл нууц үг буруу байна.' });
  }
  res.json({ token: tokenFor(user), user: publicUser(user) });
}));

app.put('/api/me/profile', requireAuth, route(async (req, res) => {
  const current = (await pool.query('SELECT * FROM users WHERE id = $1', [req.userId])).rows[0];
  if (!current) return res.status(401).json({ message: 'Хэрэглэгч олдсонгүй. Дахин нэвтэрнэ үү.' });

  const lastName = String(req.body.lastName || '').trim();
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const userType = String(req.body.userType || '');
  const password = String(req.body.password || '');
  if (email && (email.length > 254 || !isValidEmail(email))) return res.status(400).json({ message: 'Имэйл хаяг буруу байна.' });
  if (lastName.length < 2 || lastName.length > 120) return res.status(400).json({ message: 'Хамгийн багадаа 2 үсэгтэй овог оруулна уу.' });
  if (name.length < 2 || name.length > 120) return res.status(400).json({ message: 'Хамгийн багадаа 2 үсэгтэй нэр оруулна уу.' });
  if (!USER_TYPES.includes(userType)) return res.status(400).json({ message: 'Хэрэглэгчийн төрлөө сонгоно уу.' });
  // Password is mandatory until one is set; afterwards it is only changed when provided.
  if ((!current.password_hash || password) && password.length < 6) {
    return res.status(400).json({ message: 'Нууц үг хамгийн багадаа 6 тэмдэгт байна.' });
  }

  const passwordHash = password ? await bcrypt.hash(password, 12) : current.password_hash;
  try {
    const result = await pool.query(
      'UPDATE users SET last_name = $1, name = $2, email = $3, user_type = $4, password_hash = $5 WHERE id = $6 RETURNING *',
      [lastName, name, email || null, userType, passwordHash, current.id],
    );
    return res.json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Энэ имэйл хаяг өөр хэрэглэгчид бүртгэлтэй байна.' });
    throw error;
  }
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Серверийн алдаа гарлаа.' });
});

pool.query('SELECT 1')
  .then(() => app.listen(port, host, () => console.log(`ROAD API running on ${host}:${port} (OTP_MODE=${otpMode})`)))
  .catch((error) => { console.error('PostgreSQL connection failed:', error.message); process.exit(1); });
