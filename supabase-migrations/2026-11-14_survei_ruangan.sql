-- Survei Kepuasan Masyarakat (SKM) layanan peminjaman ruang rapat.
-- Sembilan unsur PermenPAN-RB 14/2017 (u1–u9, skala 1–4) dan saran.
--
-- Satu baris per kode peminjaman, dibuat peladen saat survei dikirim lewat
-- WhatsApp pada sore hari terakhir peminjaman (api/_survei.mjs). Data ruangan,
-- instansi, dan kegiatan disalin saat itu supaya hasil survei tetap utuh
-- meski peminjamannya kelak diubah. Nomor WA peminjam TIDAK disimpan di sini.
--
-- RLS aktif tanpa kebijakan: tertutup bagi kunci publik; hanya kunci layanan
-- (SUPABASE_SERVICE_KEY di Vercel) yang membaca dan menulis.
--
-- Aman dijalankan berulang.

create table if not exists public.survei_ruangan (
  booking_code     text primary key,
  token            text not null unique,
  room_id          int,
  ruang            text,
  instansi         text,
  pic_name         text,
  kegiatan         text,
  tanggal_mulai    date,
  tanggal_selesai  date,
  dikirim_at       timestamptz,
  terkirim         boolean,
  diisi_at         timestamptz,
  u1 smallint check (u1 between 1 and 4),
  u2 smallint check (u2 between 1 and 4),
  u3 smallint check (u3 between 1 and 4),
  u4 smallint check (u4 between 1 and 4),
  u5 smallint check (u5 between 1 and 4),
  u6 smallint check (u6 between 1 and 4),
  u7 smallint check (u7 between 1 and 4),
  u8 smallint check (u8 between 1 and 4),
  u9 smallint check (u9 between 1 and 4),
  saran            text check (char_length(saran) <= 1000),
  created_at       timestamptz default now()
);
create index if not exists survei_ruangan_selesai_idx on public.survei_ruangan (tanggal_selesai desc);

alter table public.survei_ruangan enable row level security;

notify pgrst, 'reload schema';

-- Pemeriksaan sesudah dijalankan (harus 1 baris, rowsecurity = true):
-- select tablename, rowsecurity from pg_tables
--  where schemaname = 'public' and tablename = 'survei_ruangan';
