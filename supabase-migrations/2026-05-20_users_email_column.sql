-- 2026-05-20 — Tambah kolom users.email.
-- Form profil & OTP cadangan (email) memakai field 'email', dan halaman
-- superadmin mengirim 'email' saat menyimpan user. Tanpa kolom ini,
-- PATCH gagal: PGRST204 "Could not find the 'email' column".

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
