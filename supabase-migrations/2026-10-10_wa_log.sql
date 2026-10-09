-- 2026-10-10 — Pencatatan WhatsApp (Fonnte) dan pengaman kirim ganda cron.
-- Aman dijalankan berulang kali.

-- 1. wa_log: satu baris per WA yang dikirim peladen.
--    Sengaja TANPA nomor HP, nama, maupun isi pesan — hanya jenis pesan,
--    sumber, peran penerima, dan berhasil/gagal. Dipakai halaman superadmin
--    untuk melihat pemakaian kuota per jenis pesan.
CREATE TABLE IF NOT EXISTS wa_log (
  id        BIGSERIAL PRIMARY KEY,
  waktu     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  jenis     TEXT NOT NULL,          -- mis. ringkasan_sore, kabar_lapangan, otp
  sumber    TEXT,                   -- aplikasi | cron | tamu | ruangan | otp
  peran     TEXT,                   -- peran penerima, mis. kasubbag_protokol
  berhasil  BOOLEAN NOT NULL DEFAULT TRUE,
  catatan   TEXT
);
CREATE INDEX IF NOT EXISTS wa_log_waktu_idx ON wa_log (waktu DESC);
CREATE INDEX IF NOT EXISTS wa_log_jenis_idx ON wa_log (jenis);

-- Hanya kunci layanan (peladen) yang menulis; membaca boleh dari aplikasi
-- karena isinya tidak memuat data pribadi.
ALTER TABLE wa_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wa_log_baca ON wa_log;
CREATE POLICY wa_log_baca ON wa_log FOR SELECT USING (true);

-- 2. notif_daily_log: penanda "rekap jenis ini sudah dikirim hari ini".
--    Tabelnya dipakai api/notif-cron.mjs sejak lama tetapi belum pernah ada di
--    folder migrasi. Indeks unik membuat dua jalannya cron yang berbarengan
--    tidak bisa sama-sama mengirim.
CREATE TABLE IF NOT EXISTS notif_daily_log (
  id          BIGSERIAL PRIMARY KEY,
  notif_type  TEXT NOT NULL,
  notif_date  DATE NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Buang catatan ganda lama (bila ada) sebelum indeks unik dibuat.
DELETE FROM notif_daily_log a
 USING notif_daily_log b
 WHERE a.id > b.id
   AND a.notif_type = b.notif_type
   AND a.notif_date = b.notif_date;
CREATE UNIQUE INDEX IF NOT EXISTS notif_daily_log_unik
  ON notif_daily_log (notif_type, notif_date);

-- 3. Pemeriksaan (opsional): pemakaian WA 30 hari terakhir per jenis.
--   SELECT jenis, sumber, count(*) AS jumlah, count(*) FILTER (WHERE NOT berhasil) AS gagal
--     FROM wa_log WHERE waktu > now() - interval '30 days'
--    GROUP BY 1, 2 ORDER BY 3 DESC;
