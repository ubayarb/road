CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- last_name (овог), name (нэр), user_type and password_hash stay NULL between OTP verification and profile completion.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_name VARCHAR(120),
  name VARCHAR(120),
  phone VARCHAR(20) NOT NULL UNIQUE,
  user_type VARCHAR(30),
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrades databases created by the earlier schema.
ALTER TABLE users ALTER COLUMN name DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(120);
-- Optional; stored lowercase. UNIQUE still allows many NULLs.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254) UNIQUE;

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  code_hash TEXT NOT NULL,
  purpose VARCHAR(30) NOT NULL DEFAULT 'register',
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Failed verification attempts; verification is rejected once the limit is reached.
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS otp_codes_phone_purpose_idx ON otp_codes(phone, purpose, created_at DESC);
