-- 2026-05-18 — Dukung 1 pengajuan = banyak slot (tanggal + sesi) berbagi 1 kode booking.
-- Sebelumnya booking_code UNIQUE → tidak bisa banyak baris dengan kode sama.

-- 1. Lepas constraint UNIQUE pada booking_code
ALTER TABLE room_bookings DROP CONSTRAINT IF EXISTS room_bookings_booking_code_key;

-- 2. Index untuk query grup berdasarkan kode
CREATE INDEX IF NOT EXISTS idx_rb_booking_code ON room_bookings(booking_code);

-- 3. Cegah baris slot identik (tanggal + sesi) dalam satu pengajuan
CREATE UNIQUE INDEX IF NOT EXISTS uq_rb_slot
  ON room_bookings(booking_code, start_date, session);
