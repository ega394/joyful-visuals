-- Postingan akun Instagram resmi (@humas_tarakan) untuk IKU 3:
-- berita kegiatan pimpinan dianggap selesai saat TERBIT, paling lambat
-- 24 jam sesudah acara. Diisi oleh peladen (api/_instagram.mjs).
--
-- Kedua tabel tertutup bagi kunci publik (RLS aktif tanpa kebijakan):
-- `instagram_akun` menyimpan token akses, jadi hanya kunci layanan
-- (SUPABASE_SERVICE_KEY di Vercel) yang boleh membaca dan menulisnya.
-- Peramban memperoleh postingan lewat /api/room-booking?op=instagram.
--
-- Aman dijalankan berulang.

create table if not exists public.instagram_akun (
  id                int primary key default 1 check (id = 1),
  token             text,
  sumber_sidik      text,
  token_kedaluwarsa timestamptz,
  token_diperbarui  timestamptz,
  ig_user_id        text,
  username          text,
  sinkron_at        timestamptz,
  sinkron_ok_at     timestamptz,
  galat             text,
  galat_perpanjang  text
);

create table if not exists public.instagram_postingan (
  id          text primary key,
  caption     text,
  permalink   text,
  terbit_at   timestamptz not null,
  media_type  text,
  diambil_at  timestamptz default now()
);
create index if not exists instagram_postingan_terbit_idx on public.instagram_postingan (terbit_at desc);

alter table public.instagram_akun      enable row level security;
alter table public.instagram_postingan enable row level security;

notify pgrst, 'reload schema';

-- Pemeriksaan sesudah dijalankan (harus 2 baris, rowsecurity = true):
-- select tablename, rowsecurity from pg_tables
--  where schemaname = 'public' and tablename like 'instagram_%';
