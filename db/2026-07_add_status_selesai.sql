-- Migrasi: izinkan status 'selesai' (arsip audiensi tamu)
-- Jalankan SEKALI di Supabase → SQL Editor.
--
-- Penyebab error sebelumnya:
--   new row for relation "permohonan_tamu" violates check constraint
--   "permohonan_tamu_status_check"
-- karena status 'selesai' belum termasuk daftar yang diizinkan.

ALTER TABLE permohonan_tamu
  DROP CONSTRAINT IF EXISTS permohonan_tamu_status_check;

ALTER TABLE permohonan_tamu
  ADD CONSTRAINT permohonan_tamu_status_check
  CHECK (status IN (
    'pending_rk',
    'pending_kasubbag',
    'pending_kabag',
    'pending_pimpinan',
    'approved',
    'rejected',
    'disposed',
    'selesai'
  ));
