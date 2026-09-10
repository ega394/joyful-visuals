-- =====================================================================
--  Pelaksana Harian (PLH) — kewenangan sementara saat pejabat berhalangan
--  Tanggal: 2026-09-03
-- =====================================================================
--
--  MASALAH
--  -------
--  Ketika Kabag atau Kasubbag cuti, antrian persetujuan berhenti total.
--  Jadwal mengendap pada status "menunggu_kabag" dan tidak seorang pun dapat
--  memajukannya — antrian Kabag hanya menampilkan tahap miliknya sendiri,
--  bahkan Kabag pun tidak dapat mengambil alih tahap Kasubbag. Akibatnya
--  agenda pimpinan tidak tayang sama sekali.
--
--  RANCANGAN
--  ---------
--  Kewenangan sementara ditempelkan pada akun PENGAMPU, bukan pada akun
--  pejabat yang berhalangan:
--
--    plh_untuk    jabatan yang diampu — 'kabag', 'kasubbag_protokol',
--                 atau 'kasubbag_komdokpim'
--    plh_mulai    tanggal mulai berlaku (WITA), inklusif
--    plh_selesai  tanggal terakhir berlaku (WITA), inklusif
--    plh_dasar    nomor Surat Perintah — boleh NULL, sesuai keputusan
--                 bahwa pencantumannya bersifat opsional
--
--  Kewenangan PADAM SENDIRI begitu tanggal hari ini melewati plh_selesai.
--  Tidak ada yang perlu diingat untuk dicabut, sehingga kewenangan pinjaman
--  tidak menggantung tanpa batas.
--
--  Aturan siapa boleh mengampu siapa TIDAK ditegakkan di basis data,
--  melainkan di src/lib/plh.js yang dipakai bersama oleh peramban dan
--  peladen (api/room-booking.js, api/notif-cron.js). Menaruhnya di satu
--  tempat lebih aman daripada menuliskannya dua kali dengan risiko berbeda
--  pendapat. Yang dijaga di sini hanya bentuk datanya.
--
--  AMAN DIJALANKAN BERULANG
--  ------------------------
--  Seluruh perintah memakai IF NOT EXISTS / DROP-CREATE.
-- =====================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS plh_untuk   text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plh_mulai   date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plh_selesai date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plh_dasar   text;

COMMENT ON COLUMN users.plh_untuk   IS 'Jabatan yang diampu sebagai PLH; NULL bila tidak sedang mengampu.';
COMMENT ON COLUMN users.plh_mulai   IS 'Tanggal mulai berlaku PLH (WITA), inklusif.';
COMMENT ON COLUMN users.plh_selesai IS 'Tanggal terakhir berlaku PLH (WITA), inklusif. Kewenangan padam sendiri sesudahnya.';
COMMENT ON COLUMN users.plh_dasar   IS 'Nomor Surat Perintah penunjukan PLH; opsional.';

-- Hanya jabatan yang memang dapat diampu.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plh_untuk_valid;
ALTER TABLE users ADD  CONSTRAINT users_plh_untuk_valid
  CHECK (plh_untuk IS NULL
         OR plh_untuk IN ('kabag', 'kasubbag_protokol', 'kasubbag_komdokpim'));

-- Pendelegasian tanpa masa berlaku tidak akan pernah padam sendiri — justru
-- hal yang hendak dicegah. Jadi ketiganya harus terisi bersama-sama.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plh_lengkap;
ALTER TABLE users ADD  CONSTRAINT users_plh_lengkap
  CHECK ((plh_untuk IS NULL AND plh_mulai IS NULL AND plh_selesai IS NULL)
         OR (plh_untuk IS NOT NULL AND plh_mulai IS NOT NULL AND plh_selesai IS NOT NULL
             AND plh_selesai >= plh_mulai));

-- Pencarian pengampu yang sedang berlaku dilakukan tiap kali pengingat
-- terjadwal berjalan (lima kali sehari), jadi barisnya disaring lebih dahulu.
CREATE INDEX IF NOT EXISTS users_plh_aktif_idx
  ON users (plh_untuk, plh_mulai, plh_selesai)
  WHERE plh_untuk IS NOT NULL;

-- ── Verifikasi ───────────────────────────────────────────────────────
--
--   SELECT column_name, data_type
--     FROM information_schema.columns
--    WHERE table_name = 'users' AND column_name LIKE 'plh%'
--    ORDER BY column_name;
--
-- Harus mengembalikan empat baris: plh_dasar (text), plh_mulai (date),
-- plh_selesai (date), plh_untuk (text).
--
-- Uji batasan — perintah berikut HARUS ditolak:
--
--   UPDATE users SET plh_untuk = 'walikota' WHERE username = '<uji>';
--   UPDATE users SET plh_untuk = 'kabag'    WHERE username = '<uji>';  -- tanpa tanggal
--
-- ── MEMBATALKAN ──────────────────────────────────────────────────────
--
--   DROP INDEX IF EXISTS users_plh_aktif_idx;
--   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plh_lengkap;
--   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plh_untuk_valid;
--   ALTER TABLE users DROP COLUMN IF EXISTS plh_dasar;
--   ALTER TABLE users DROP COLUMN IF EXISTS plh_selesai;
--   ALTER TABLE users DROP COLUMN IF EXISTS plh_mulai;
--   ALTER TABLE users DROP COLUMN IF EXISTS plh_untuk;
--
-- Aplikasi tetap berjalan tanpa kolom ini: pembacaan pengampu dibungkus
-- try/catch dan kembali ke perilaku semula bila kolomnya belum ada.
