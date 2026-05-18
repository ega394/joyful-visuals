-- 2026-05-20 — Backfill reviewed_by lama: ganti username/NIP menjadi nama.
-- Persetujuan sebelum perbaikan menyimpan admin.username di reviewed_by
-- (untuk staf hasil impor, username = NIP). Ubah ke nama lengkap agar
-- surat/tanda terima menampilkan nama, bukan deretan NIP.
--
-- Aman: hanya baris yang reviewed_by-nya PERSIS sama dengan sebuah
-- users.username yang diubah. Baris yang sudah berisi nama tidak terdampak.

UPDATE room_bookings rb
SET    reviewed_by = u.nama
FROM   users u
WHERE  rb.reviewed_by = u.username
  AND  u.nama IS NOT NULL
  AND  btrim(u.nama) <> '';
