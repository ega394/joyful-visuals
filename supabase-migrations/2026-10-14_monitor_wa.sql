-- 2026-10-14 — Monitor WA: arsip WA keluar dan status kiriman dari Fonnte.
-- Jalankan SESUDAH 2026-10-10_wa_log.sql. Aman dijalankan berulang kali.
--
-- Keputusan Kabag (Oktober 2026): Admin RK, Kasubbag Protokol, dan Kabag perlu
-- memeriksa apakah WA terkirim. Karena itu wa_log kini juga menyimpan penerima
-- dan isi pesan (kecuali OTP), sehingga tabel ini DITUTUP dari kunci publik:
-- hanya peladen (kunci layanan) yang membaca/menulis, lewat
-- /api/whatsapp?op=monitor_wa yang memeriksa sesi dan peran. Nomor, nama, dan
-- isi dikosongkan otomatis sesudah 90 hari.

ALTER TABLE wa_log ADD COLUMN IF NOT EXISTS nomor              TEXT;
ALTER TABLE wa_log ADD COLUMN IF NOT EXISTS nama_penerima      TEXT;
ALTER TABLE wa_log ADD COLUMN IF NOT EXISTS penerima_username  TEXT;
ALTER TABLE wa_log ADD COLUMN IF NOT EXISTS isi                TEXT;
ALTER TABLE wa_log ADD COLUMN IF NOT EXISTS rujukan            TEXT;  -- mis. tamu:123, ruangan:ABC123
ALTER TABLE wa_log ADD COLUMN IF NOT EXISTS id_fonnte          TEXT;  -- dicocokkan dengan webhook status
ALTER TABLE wa_log ADD COLUMN IF NOT EXISTS status_kirim       TEXT;  -- diterima | pending | sent | failed | …
ALTER TABLE wa_log ADD COLUMN IF NOT EXISTS state              TEXT;  -- status penerimaan dari WhatsApp (webhook)
ALTER TABLE wa_log ADD COLUMN IF NOT EXISTS diperbarui_pada    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS wa_log_id_fonnte_idx ON wa_log (id_fonnte);
CREATE INDEX IF NOT EXISTS wa_log_berhasil_idx  ON wa_log (berhasil, waktu DESC);

-- Tutup untuk peramban: kebijakan baca publik dari migrasi sebelumnya dicabut.
ALTER TABLE wa_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wa_log_baca ON wa_log;
REVOKE ALL ON wa_log FROM anon, authenticated;

-- Pemeriksaan (opsional):
--   SELECT waktu, jenis, nama_penerima, berhasil, status_kirim, state
--     FROM wa_log ORDER BY waktu DESC LIMIT 20;
