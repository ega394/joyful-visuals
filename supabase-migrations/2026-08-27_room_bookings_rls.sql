-- =====================================================================
--  Mempersempit akses baca/tulis tabel room_bookings
--  Tanggal: 2026-08-27
-- =====================================================================
--
--  MASALAH
--  -------
--  Kebijakan lama pada 2026-05-13_room_booking.sql memberi anon key hak
--  penuh atas room_bookings:
--
--    public_read_bookings   SELECT  USING (status IN (...semua status...))
--    public_insert_bookings INSERT  WITH CHECK (true)
--    anon_update_bookings   UPDATE  USING (true) WITH CHECK (true)
--
--  Anon key ada di bundel JavaScript, jadi siapa pun yang membuka aplikasi
--  bisa menyalinnya lalu memanggil PostgREST langsung:
--
--    GET  /rest/v1/room_bookings?select=*      → seluruh daftar peminjam
--                                                lengkap dengan pic_wa
--    PATCH/POST                                 → mengubah status booking
--
--  Padahal tidak ada satu pun kode di browser yang membaca atau menulis
--  tabel ini secara langsung — semuanya lewat /api/room-booking, yang
--  sudah memeriksa token sesi untuk operasi peninjau permohonan.
--
--  PRASYARAT — JALANKAN URUT, JANGAN DILEWATI
--  ------------------------------------------
--  1. Di Vercel → Project Settings → Environment Variables, tambahkan
--       SUPABASE_SERVICE_KEY = <service_role key dari Supabase>
--     (Supabase Dashboard → Project Settings → API → service_role).
--     Service role melewati RLS, sehingga /api/room-booking tetap jalan
--     setelah kebijakan di bawah dicabut.
--  2. Deploy ulang aplikasi supaya variabel itu terbaca.
--  3. Uji: buka /pinjamruangan — kalender harus tetap terisi. Kalau
--     kosong, service key belum terpasang; JANGAN lanjut ke langkah 4.
--  4. Baru jalankan skrip ini di Supabase → SQL Editor.
--
--  YANG IKUT TERDAMPAK
--  -------------------
--  Menu Superadmin → Backup & Restore membaca room_bookings langsung dari
--  browser memakai anon key, jadi tabel itu akan kosong di hasil backup
--  setelah skrip ini dijalankan. Selama belum dipindahkan ke API, cadangkan
--  room_bookings lewat Supabase Dashboard → Table Editor → Export CSV,
--  atau andalkan Database Backups bawaan Supabase.
--
--  MEMBATALKAN
--  -----------
--  Jalankan ulang bagian kebijakan di 2026-05-13_room_booking.sql.
-- =====================================================================

ALTER TABLE room_bookings ENABLE ROW LEVEL SECURITY;

-- Cabut seluruh kebijakan yang terbuka untuk anon key.
DROP POLICY IF EXISTS "public_read_bookings"   ON room_bookings;
DROP POLICY IF EXISTS "public_insert_bookings" ON room_bookings;
DROP POLICY IF EXISTS "anon_update_bookings"   ON room_bookings;

-- Tidak ada kebijakan pengganti: dengan RLS aktif dan tanpa policy, anon
-- dan authenticated tidak bisa membaca maupun menulis apa pun. Service role
-- melewati RLS, jadi /api/room-booking tetap berfungsi penuh.

-- rooms tetap boleh dibaca publik: hanya berisi nama & kapasitas ruangan,
-- dan halaman /pinjamruangan memang perlu menampilkannya.
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_rooms" ON rooms;
CREATE POLICY "public_read_rooms" ON rooms
  FOR SELECT USING (true);

-- ── Verifikasi ───────────────────────────────────────────────────────
-- Setelah dijalankan, daftar berikut harus kosong untuk room_bookings:
--
--   SELECT policyname, cmd, roles
--     FROM pg_policies
--    WHERE tablename = 'room_bookings';
--
-- Dan uji dari luar (ganti <ANON_KEY> & <PROJECT>) — harus mengembalikan []:
--
--   curl "https://<PROJECT>.supabase.co/rest/v1/room_bookings?select=pic_wa" \
--        -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
