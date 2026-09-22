-- ═══════════════════════════════════════════════════════════════
--  CEK: kenapa usulan perubahan tidak muncul di dashboard Kabag
-- ═══════════════════════════════════════════════════════════════
--
-- Jalankan di Supabase → SQL Editor. SELURUHNYA HANYA MEMBACA —
-- tidak ada satu pun perintah yang mengubah data.
--
-- Jalankan BAGIAN 1 lebih dulu, lalu laporkan hasilnya.

-- ── BAGIAN 1 — Apakah tabelnya melewati batas "Max rows"? ──────
--
-- Supabase memotong balasan API pada batas ini (bawaannya 1000) TANPA
-- pesan galat. Karena `id` jadwal berasal dari Date.now() dan urutannya
-- menaik, yang terpotong justru jadwal PALING BARU — persis gejala
-- "usulan yang baru dibuat seperti tidak pernah ada".
--
-- Bandingkan angka `jumlah_baris` di bawah dengan nilai "Max rows" pada
--   Settings → API → Max rows
-- Bila jumlah_baris >= Max rows, inilah penyebabnya.

SELECT
  count(*)                                              AS jumlah_baris,
  count(*) FILTER (WHERE data->>'alurEdit'  IS NOT NULL) AS ada_usulan_ubah,
  count(*) FILTER (WHERE data->>'alurHapus' IS NOT NULL) AS ada_minta_batal
FROM jadwal;


-- ── BAGIAN 2 — Di meja siapa usulannya sekarang? ───────────────
--
-- Ini menjawab langsung: masih di Kasubbag, atau sudah di Kabag.

SELECT
  id,
  data->>'namaAcara'       AS acara,
  data->>'tanggal'         AS tanggal_acara,
  data->>'alur'            AS alur,
  data->>'alurEdit'        AS tahap_usulan,
  data->>'usulanEditOleh'  AS diusulkan_oleh,
  data->>'usulanEditPada'  AS diusulkan_pada,
  data->>'alasanEdit'      AS alasan
FROM jadwal
WHERE data->>'alurEdit' IS NOT NULL
ORDER BY data->>'usulanEditPada' DESC NULLS LAST;


-- ── BAGIAN 3 — Apakah usulannya terpotong oleh batas itu? ──────
--
-- Memberi nomor urut menurut `id` menaik — urutan yang sama dipakai
-- aplikasi saat menarik data. Bila `urutan_ke` sebuah usulan LEBIH BESAR
-- daripada "Max rows", aplikasi memang tidak akan pernah melihatnya.

WITH urut AS (
  SELECT id,
         row_number() OVER (ORDER BY id) AS urutan_ke,
         data->>'namaAcara' AS acara,
         data->>'alurEdit'  AS tahap_usulan,
         data->>'alurHapus' AS tahap_batal
  FROM jadwal
)
SELECT urutan_ke, id, acara, tahap_usulan, tahap_batal
FROM urut
WHERE tahap_usulan IS NOT NULL OR tahap_batal IS NOT NULL
ORDER BY urutan_ke;


-- ── BAGIAN 4 — Berapa jadwal yang berada di luar 1000 pertama? ─
--
-- Bila angkanya lebih dari 0, ada jadwal yang selama ini TIDAK PERNAH
-- tampil di aplikasi sama sekali — bukan hanya usulannya.

SELECT count(*) AS jadwal_di_luar_1000_pertama
FROM (SELECT id, row_number() OVER (ORDER BY id) AS n FROM jadwal) t
WHERE n > 1000;
