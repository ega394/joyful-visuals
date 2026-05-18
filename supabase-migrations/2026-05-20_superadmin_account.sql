-- 2026-05-20 — Bootstrap akun Super Administrator.
-- Halaman /superadmin hanya bisa diakses akun users dengan role
-- 'superadmin'. Akun ini dipakai untuk login awal.
--
-- Username : superadmin
-- Password : rinjani2026  (disimpan sebagai SHA-256: $sha256$<hex>)
--
-- Idempoten: jika 'superadmin' sudah ada, role/password/status dipulihkan.

INSERT INTO users (username, nama, jabatan, role, password, disabled)
VALUES (
  'superadmin',
  'superadmin',
  'Super Administrator',
  'superadmin',
  '$sha256$7207ae84279f633769531a2ec33375e4c8204c0b192fd5c8c69e6f54a70d6516',
  false
)
ON CONFLICT (username) DO UPDATE
SET role     = 'superadmin',
    nama     = EXCLUDED.nama,
    password = EXCLUDED.password,
    disabled = false;
