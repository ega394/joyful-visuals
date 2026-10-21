-- Bukti persetujuan Kebijakan Privasi & Ketentuan Penggunaan pada formulir
-- publik (permohonan audiensi /tamu, peminjaman ruangan /pinjamruangan).
--
-- UU 27/2022 PDP: persetujuan harus dapat dibuktikan. Peladen mengisi kedua
-- kolom ini saat pengajuan masuk (api/_persetujuan.js):
--   persetujuan_privasi_at  waktu persetujuan menurut jam peladen
--   persetujuan_versi       tanggal berlaku kebijakan yang disetujui
--
-- Pengajuan lama (sebelum fitur ini) dibiarkan kosong: saat itu belum ada
-- kotak persetujuan, jadi tidak ada yang bisa dibuktikan.
--
-- Aman dijalankan berulang.

alter table public.permohonan_tamu
  add column if not exists persetujuan_privasi_at timestamptz,
  add column if not exists persetujuan_versi text;

alter table public.room_bookings
  add column if not exists persetujuan_privasi_at timestamptz,
  add column if not exists persetujuan_versi text;

-- PostgREST perlu memuat ulang skema agar kolom baru langsung dikenali.
notify pgrst, 'reload schema';

-- Pemeriksaan sesudah dijalankan (harus 4 baris):
-- select table_name, column_name from information_schema.columns
--  where table_schema = 'public'
--    and table_name in ('permohonan_tamu', 'room_bookings')
--    and column_name like 'persetujuan_%';
