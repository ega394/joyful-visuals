-- =====================================================================
--  Token sesi dipindah keluar dari tabel `users`
--  Tanggal: 2026-09-11
-- =====================================================================
--
--  MASALAH
--  -------
--  Kolom users.session_token menyimpan token sesi yang berlaku 12 jam.
--  Tabel `users` dibaca peramban dengan KUNCI ANON melalui
--  `/rest/v1/users?select=*`, dan seluruh hasilnya disalin ke
--  localStorage["jp_users"]. Akibatnya setiap pengguna memegang token sesi
--  SEMUA pengguna lain di perangkatnya.
--
--  Seorang staf dapat mengambil token Kabag dari localStorage lalu
--  memanggil /api/room-booking?op=set_plh untuk mengangkat dirinya sendiri
--  sebagai PLH Kasubbag, atau meninjau permohonan peminjaman ruangan.
--  Menyembunyikannya dari localStorage saja tidak menutup apa pun: kunci
--  anon ada di dalam bundel aplikasi, jadi tabelnya dapat dipanggil
--  langsung.
--
--  RANCANGAN
--  ---------
--  Token dipindah ke tabel `sesi` yang TIDAK dapat dibaca kunci anon:
--  RLS dinyalakan tanpa satu pun policy, dan hak anon dicabut. Hanya kunci
--  layanan — yang dipakai api/room-booking.js dan melewati RLS — yang bisa
--  membacanya.
--
--  Yang TIDAK diselesaikan di sini: hash sandi seluruh pegawai masih
--  terbaca kunci anon, karena verifikasi login masih berjalan di peramban.
--  Itu pekerjaan tersendiri (verifikasi login di peladen) dan bukan alasan
--  menunda migrasi ini.
--
--  PRASYARAT
--  ---------
--  1. SUPABASE_SERVICE_KEY sudah terpasang di Environment Variables Vercel
--     (Production). TANPA INI VERIFIKASI SESI SELALU GAGAL, sehingga layar
--     Peminjaman Ruangan dan Penetapan PLH tidak dapat dibuka. Jangan
--     sekali-kali memberinya awalan VITE_ — Vite menyisipkan setiap
--     variabel berawalan VITE_ ke dalam bundel yang diunduh peramban.
--
--     Kunci ini sudah dipakai sejak penutupan paparan nomor WA peminjam
--     ruangan, jadi seharusnya sudah ada. Pastikan, jangan diandaikan.
--
--  URUTAN MENJALANKAN
--  ------------------
--  Urutan BAGIAN 1 terhadap deploy tidak menentukan hidup-matinya aplikasi.
--  api/room-booking.js sengaja dibuat tahan dua arah: selama tabel `sesi`
--  belum ada, ia kembali memakai users.session_token seperti sebelumnya.
--  Pelajaran dari penutupan paparan nomor WA peminjam ruangan — waktu itu
--  migrasi mendahului kode dan layar peminjaman langsung kosong.
--
--  Yang TIDAK ditoleransi: penolakan hak akses. Bila tabelnya ada tetapi
--  tak terbaca karena kunci layanan belum terpasang, verifikasi gagal dan
--  log mencatatnya — bukan diam-diam kembali ke kolom lama, sebab itu akan
--  tampak seperti perbaikan yang berhasil padahal tidak.
--
--    1. Merge & tunggu Vercel selesai deploy.
--    2. Jalankan BAGIAN 1.
--    3. Login ulang, lalu buka Peminjaman Ruangan dan Penetapan PLH.
--       Pastikan keduanya terbuka, dan kueri verifikasi di bawah
--       menunjukkan baris pada tabel `sesi`. Bila salah satu menolak
--       dengan "Sesi tidak valid" sementara barisnya kosong, BERHENTI:
--       hampir pasti SUPABASE_SERVICE_KEY belum terpasang. Jangan lanjut
--       ke BAGIAN 2 — kolom lama masih menjadi jalan kembali.
--    4. Baru jalankan BAGIAN 2.
--
--  BAGIAN 2 barulah yang menutup paparannya. Sebelum itu dijalankan,
--  token masih tersalin ke peramban setiap pengguna, jadi jangan ditunda.
--
--  AMAN DIJALANKAN BERULANG
--  ------------------------
--  Seluruh perintah memakai IF NOT EXISTS / IF EXISTS.
-- =====================================================================


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  BAGIAN 1 — menambah tabel `sesi` (jalankan lebih dahulu)         ║
-- ╚═══════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS sesi (
  token       text PRIMARY KEY,
  username    text NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  kedaluwarsa timestamptz NOT NULL,
  dibuat      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  sesi             IS 'Token sesi peladen. Tidak boleh terbaca kunci anon — lihat supabase-migrations/2026-09-11_sesi.sql.';
COMMENT ON COLUMN sesi.token       IS 'Token acak 40 karakter, diterbitkan /api/room-booking?op=auth.';
COMMENT ON COLUMN sesi.kedaluwarsa IS 'Batas berlaku token (12 jam sejak diterbitkan).';

-- Satu sesi berlaku per akun, seperti perilaku kolom tunggal sebelumnya.
CREATE UNIQUE INDEX IF NOT EXISTS sesi_username_idx ON sesi (username);
-- Pembersihan sesi kedaluwarsa menyapu kolom ini.
CREATE INDEX IF NOT EXISTS sesi_kedaluwarsa_idx ON sesi (kedaluwarsa);

-- RLS menyala TANPA satu pun policy: anon dan authenticated tidak dapat
-- membaca maupun menulis. Kunci layanan melewati RLS, jadi peladen tetap bisa.
ALTER TABLE sesi ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sesi FROM anon, authenticated;

-- Sesi yang masih berlaku dipindahkan supaya yang sedang bekerja tidak
-- terlempar keluar saat kode baru mulai berjalan.
INSERT INTO sesi (token, username, kedaluwarsa)
SELECT session_token, username, session_expires
  FROM users
 WHERE session_token IS NOT NULL
   AND session_expires IS NOT NULL
   AND session_expires > now()
ON CONFLICT (token) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  BAGIAN 2 — membuang kolom lama (hanya sesudah deploy diuji)       ║
-- ╚═══════════════════════════════════════════════════════════════════╝
--
-- Sampai perintah ini dijalankan, token masih tersalin ke peramban setiap
-- pengguna. Jadi jangan ditunda lama — tetapi jangan pula dijalankan
-- sebelum langkah 3 di atas benar-benar diperiksa.

-- ALTER TABLE users DROP COLUMN IF EXISTS session_token;
-- ALTER TABLE users DROP COLUMN IF EXISTS session_expires;


-- ── Verifikasi ───────────────────────────────────────────────────────
--
-- Sesudah BAGIAN 1 — harus ada barisnya bila ada yang sedang login:
--
--   SELECT username, kedaluwarsa FROM sesi ORDER BY dibuat DESC;
--
-- Harus MENOLAK (dijalankan sebagai anon, mis. dari peramban):
--
--   fetch(SUPA_URL + "/rest/v1/sesi?select=token",
--         { headers: { apikey: ANON, Authorization: "Bearer " + ANON } })
--
-- Sesudah BAGIAN 2 — harus mengembalikan nol baris:
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'users' AND column_name LIKE 'session_%'
--      AND column_name <> 'session_version';
--
-- Catatan: users.session_version TETAP ADA. Itu penghitung untuk memaksa
-- logout dari halaman superadmin, bukan token, dan tidak rahasia.
--
-- ── MEMBATALKAN ──────────────────────────────────────────────────────
--
-- Selama BAGIAN 2 belum dijalankan, pembatalannya hanya mengembalikan kode
-- ke keadaan sebelumnya — kolom lamanya masih utuh. Tabel `sesi` boleh
-- ditinggalkan; ia tidak mengganggu kode lama.
--
--   DROP TABLE IF EXISTS sesi;
--
-- Bila BAGIAN 2 sudah dijalankan, kolomnya perlu dibuat kembali lebih
-- dahulu — dan semua orang harus login ulang:
--
--   ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token   text;
--   ALTER TABLE users ADD COLUMN IF NOT EXISTS session_expires timestamptz;
