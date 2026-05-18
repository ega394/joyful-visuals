-- 2026-05-19 — Token sesi admin untuk endpoint pengelola ruangan.
-- Mengganti kepercayaan pada header X-Username (mudah dipalsukan) dengan
-- token acak yang diterbitkan & diverifikasi server terhadap tabel users.

ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_expires  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_session_token ON users(session_token);
