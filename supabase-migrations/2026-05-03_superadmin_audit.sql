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
--    Dibuat NONAKTIF dengan nilai sandi yang bukan hash apa pun. Versi lama
--    berkas ini menanam "hash placeholder" yang tertulis di repositori publik;
--    nilai seperti itu bisa dipakai langsung sebagai kredensial di endpoint
--    yang membandingkan hash, jadi tidak boleh ada lagi.
--    Setel sandi sendiri lewat SQL Editor (lihat 2026-05-20_superadmin_account.sql);
--    jangan pernah menulis sandi atau hash sungguhan di repositori publik ini.
INSERT INTO users (username, password, role, nama, jabatan, "noWA", must_change_pw, disabled)
VALUES (
  'superadmin',
  '$sha256$terkunci',
  'superadmin',
  'Super Administrator',
  'Super Administrator Sistem',
  '',
  TRUE,
  TRUE
)
ON CONFLICT (username) DO NOTHING;

-- CATATAN PENTING:
-- Akun di atas nonaktif dan tanpa sandi yang bisa dipakai. Setel sandi lewat SQL Editor — perintahnya
-- ada di 2026-05-20_superadmin_account.sql.
-- Catatan: reset via /api/otp tidak berlaku untuk akun superadmin, dan
-- must_change_pw belum ditegakkan aplikasi.

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
