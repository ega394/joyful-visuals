-- 2026-08-06 — Kolom updated_at pada tabel `jadwal` untuk sinkronisasi bertahap
--
-- LATAR BELAKANG
-- Basis data hanya ~30 MB, tetapi egress Supabase menembus 6,4 GB/bulan
-- (kuota gratis 5 GB). Penyebabnya bukan besarnya data, melainkan frekuensi:
-- polling aplikasi menarik SELURUH tabel `jadwal` setiap 60 detik, sehingga
-- isi basis data terkirim ulang ratusan kali dalam sebulan.
--
-- Dengan kolom ini, polling cukup meminta baris yang berubah sejak sinkron
-- terakhir (updated_at=gt.<terakhir>) — yang umumnya membalas NOL baris.
--
-- AMAN DIJALANKAN KAPAN SAJA:
--   • hanya menambah kolom, tidak mengubah/menghapus data yang ada;
--   • baris lama otomatis mendapat nilai now() saat kolom dibuat;
--   • kode versi lama tetap berjalan normal setelah migrasi ini;
--   • kode versi baru juga tetap berjalan bila migrasi ini BELUM dijalankan
--     (otomatis jatuh kembali ke pemuatan penuh).
-- Idempoten — boleh dijalankan berulang kali.

alter table jadwal
  add column if not exists updated_at timestamptz not null default now();

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists jadwal_updated_at on jadwal;
create trigger jadwal_updated_at
  before insert or update on jadwal
  for each row execute function set_updated_at();

-- Polling menyaring dengan updated_at > <terakhir>; indeks menjaga query ini
-- tetap murah seiring bertambahnya baris.
create index if not exists jadwal_updated_at_idx on jadwal (updated_at);
