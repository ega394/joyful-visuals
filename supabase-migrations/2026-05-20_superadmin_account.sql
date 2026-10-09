-- 2026-05-20 — Bootstrap akun Super Administrator.
-- Diperbarui 9 Oktober 2026.
--
-- Versi sebelumnya menanam sandi tetap yang tertulis di berkas ini, padahal
-- repositori ini publik, dan MENGEMBALIKAN sandi itu setiap kali migrasi
-- dijalankan ulang. Sandi lama itu harus dianggap bocor dan tidak boleh dipakai
-- lagi.
--
-- Sekarang akun hanya dibuat bila belum ada, dalam keadaan NONAKTIF dan tanpa
-- sandi yang bisa dipakai. Akun yang sudah ada tidak disentuh sama sekali.

INSERT INTO users (username, nama, jabatan, role, password, disabled)
VALUES (
  'superadmin',
  'Super Administrator',
  'Super Administrator',
  'superadmin',
  '$sha256$terkunci',   -- bukan hash SHA-256 apa pun: tidak ada sandi yang cocok
  true
)
ON CONFLICT (username) DO NOTHING;

-- Menyetel sandi dan mengaktifkan akun — jalankan sendiri di Supabase SQL
-- Editor, ganti FRASA-ACAK-PANJANG dengan frasa minimal 16 karakter, dan JANGAN
-- menyimpan frasanya di repositori:
--
--   update users
--      set password = '$sha256$' || encode(extensions.digest('FRASA-ACAK-PANJANG', 'sha256'), 'hex'),
--          disabled = false,
--          session_version = coalesce(session_version, 0) + 1
--    where username = 'superadmin';
