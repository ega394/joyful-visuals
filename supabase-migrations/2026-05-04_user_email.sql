-- ============================================================
--  Migration: Email column for OTP (alternatif WhatsApp)
--  Tanggal  : 2026-05-04
--  Tujuan   : Menambahkan kolom email sehingga OTP bisa dikirim
--             via WhatsApp ATAU Email. Akun super admin sengaja
--             dipakai email-only untuk meng-isolasi dari Fonnte.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- (Opsional) index unik untuk mencegah duplikasi email aktif
CREATE INDEX IF NOT EXISTS users_email_idx ON users (LOWER(email)) WHERE email IS NOT NULL;

-- Catatan:
--  • Setelah migrasi ini dijalankan, isi email super admin via SQL
--    atau lewat tab Users di /superadmin (setelah login pertama).
--    Contoh:
--      UPDATE users SET email='admin@tarakankota.go.id' WHERE username='superadmin';
--
--  • Konfigurasi Vercel ENV:
--      RESEND_API_KEY  = api key dari https://resend.com (free 3000/bulan)
--      MAIL_FROM       = "Prokopim Hibot <noreply@yourdomain.id>"
--                        (untuk testing pakai "onboarding@resend.dev")
--
--  • Verifikasi:
--      SELECT username, email FROM users WHERE email IS NOT NULL;
-- ============================================================
