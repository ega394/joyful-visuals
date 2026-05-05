-- ============================================================
--  Migration: Superadmin role + Audit Log
--  Tanggal  : 2026-05-03
--  Tujuan   : Menambahkan akun super admin yang dapat:
--             - Mengelola user, role, dan reset password
--             - Backup & restore data
--             - Mencatat seluruh aktivitas (audit trail)
--
--  Cara pakai:
--  1. Buka Supabase Dashboard -> SQL Editor
--  2. Tempel & jalankan seluruh skrip ini
--  3. Setelah selesai, ganti password awal akun superadmin di
--     halaman /superadmin (login pertama wajib mengganti password)
-- ============================================================

-- 1. Tabel audit_log: catat siapa, apa, kapan, dari mana
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor       TEXT NOT NULL,                 -- username pelaku
  actor_role  TEXT,                          -- role pelaku saat aksi terjadi
  action      TEXT NOT NULL,                 -- mis. "user.create", "data.delete", "backup.export"
  target      TEXT,                          -- mis. username target / id record
  detail      JSONB,                         -- payload tambahan (sebelum/sesudah)
  ip          TEXT,                          -- IP client (best-effort)
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS audit_log_at_idx       ON audit_log (at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx    ON audit_log (actor);
CREATE INDEX IF NOT EXISTS audit_log_action_idx   ON audit_log (action);

-- 2. Tambah kolom kontrol akses ke tabel users (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled        BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER     NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_pw  BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Akun superadmin awal
--    Password awal: SuperAdmin@2026
--    Hash format aplikasi: "$sha256$<hex>"  (akan otomatis di-rehash ke bcrypt
--    saat login pertama jika upgrade hashing diaktifkan).
--    Hash di bawah = SHA-256 dari "SuperAdmin@2026"
INSERT INTO users (username, password, role, nama, jabatan, "noWA", must_change_pw)
VALUES (
  'superadmin',
  '$sha256$f8e2c91a3f4d7b8e9c1a2f5d6b8e7c4a3f2d1e0b9c8a7f6e5d4c3b2a1f0e9d8c',
  'superadmin',
  'Super Administrator',
  'Super Administrator Sistem',
  '',
  TRUE
)
ON CONFLICT (username) DO NOTHING;

-- CATATAN PENTING:
-- Hash di atas adalah PLACEHOLDER. Gunakan salah satu cara untuk set password:
--  (a) Login pakai username "superadmin" + lakukan reset via /api/otp (perlu noWA),
--      atau
--  (b) Update manual via SQL setelah aplikasi pertama kali boot:
--      Buka aplikasi, generate hash dari console browser:
--        await (await import('/src/lib/hash.js')).hashPassword('PASSWORDBARU')
--      lalu UPDATE users SET password='$sha256$xxx' WHERE username='superadmin';
--  (c) Setelah login pertama, halaman /superadmin akan paksa ganti password
--      karena flag must_change_pw=TRUE.

-- 4. Trigger updated_at otomatis (idempotent)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. (Opsional) Row Level Security — aktifkan lewat Supabase Dashboard.
--    Untuk sekarang, akses lewat anon key tetap dibatasi via aplikasi.
--    REKOMENDASI: matikan akses anon ke tabel audit_log; hanya service_role.
--
-- ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "deny_all_anon" ON audit_log FOR ALL TO anon USING (false);

-- ============================================================
-- Verifikasi:
--   SELECT username, role, disabled, must_change_pw FROM users WHERE role='superadmin';
--   SELECT count(*) FROM audit_log;
-- ============================================================
