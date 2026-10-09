-- 2026-10-10 — Pengaturan aplikasi sederhana (kunci → nilai), dipakai pertama
-- kali untuk "Kata-kata Hari Ini" yang ditulis Kabag dari menu Profil.
-- Aman dijalankan berulang kali.

CREATE TABLE IF NOT EXISTS pengaturan_aplikasi (
  kunci        TEXT PRIMARY KEY,
  nilai        JSONB,
  diubah_oleh  TEXT,
  diubah_pada  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Semua pengguna aplikasi boleh MEMBACA (isinya bukan data pribadi).
-- Menulis hanya lewat peladen (kunci layanan), yang memeriksa sesi dan
-- peran Kabag/PLH Kabag terlebih dahulu.
ALTER TABLE pengaturan_aplikasi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pengaturan_aplikasi_baca ON pengaturan_aplikasi;
CREATE POLICY pengaturan_aplikasi_baca ON pengaturan_aplikasi FOR SELECT USING (true);
