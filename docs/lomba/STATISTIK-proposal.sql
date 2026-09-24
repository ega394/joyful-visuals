-- ═══════════════════════════════════════════════════════════════════
--  STATISTIK PROPOSAL KALTARA INNOVATION AWARDS 2026
-- ═══════════════════════════════════════════════════════════════════
--
-- Jalankan di Supabase → SQL Editor, lalu salin SELURUH isi sel hasilnya
-- (satu sel berisi JSON) dan kirimkan kembali. Seluruh angka proposal
-- diperbarui dari hasil ini sekaligus, tanpa diketik ulang satu per satu.
--
-- HANYA MEMBACA. Tidak ada satu pun perintah yang mengubah, menambah,
-- atau menghapus data.
--
-- Cara hitungnya sama dengan scripts/statistik-lomba.mjs yang dipakai
-- untuk angka 10 September, supaya angka lama dan baru sebanding.
--
-- Kolom yang keberadaannya tidak pasti dibaca lewat to_jsonb(baris)->>'kolom'.
-- Bila kolom itu tidak ada, hasilnya NULL — bukan galat yang menggagalkan
-- seluruh kueri.

WITH
j AS (
  SELECT data AS d,
         CASE WHEN jsonb_typeof(data->'timeline') = 'array'
              THEN data->'timeline' ELSE '[]'::jsonb END AS tl
  FROM jadwal
  WHERE data IS NOT NULL
),

-- Setiap peristiwa jejak audit yang cap waktunya sah.
ev AS (
  SELECT j.d,
         x.e->>'action'              AS aksi,
         (x.e->>'at')::timestamptz   AS pada,
         x.e                          AS e
  FROM j, jsonb_array_elements(j.tl) AS x(e)
  WHERE x.e->>'at' ~ '^\d{4}-\d{2}-\d{2}T'
),

-- Kemunculan PERTAMA tiap tahap per kegiatan — sama dengan tl.find() pada skrip.
tahap AS (
  SELECT j.d,
    (SELECT (x->>'at')::timestamptz FROM jsonb_array_elements(j.tl) WITH ORDINALITY y(x,i)
      WHERE x->>'action' = 'submit' AND x->>'at' ~ '^\d{4}-\d{2}-\d{2}T' ORDER BY i LIMIT 1) AS t_ajukan,
    (SELECT (x->>'at')::timestamptz FROM jsonb_array_elements(j.tl) WITH ORDINALITY y(x,i)
      WHERE x->>'action' = 'forward_to_kabag' AND x->>'at' ~ '^\d{4}-\d{2}-\d{2}T' ORDER BY i LIMIT 1) AS t_teruskan,
    (SELECT (x->>'at')::timestamptz FROM jsonb_array_elements(j.tl) WITH ORDINALITY y(x,i)
      WHERE x->>'action' = 'publish' AND x->>'at' ~ '^\d{4}-\d{2}-\d{2}T' ORDER BY i LIMIT 1) AS t_tayang
  FROM j
),

durasi AS (
  SELECT
    EXTRACT(EPOCH FROM (t_tayang   - t_ajukan  )) / 3600.0 AS ajukan_tayang,
    EXTRACT(EPOCH FROM (t_teruskan - t_ajukan  )) / 3600.0 AS ajukan_teruskan,
    EXTRACT(EPOCH FROM (t_tayang   - t_teruskan)) / 3600.0 AS teruskan_tayang
  FROM tahap
),

-- Keputusan penelaahan (Kasubbag meneruskan, Kabag menayangkan) menurut
-- jam WITA. Di luar jam kerja = sebelum 07.30, sejak 16.00, atau Sabtu/Minggu.
-- Hari libur nasional tidak ikut dihitung, jadi angkanya cenderung KURANG,
-- bukan berlebih.
putusan AS (
  SELECT pada AT TIME ZONE 'Asia/Makassar' AS lokal
  FROM ev
  WHERE aksi IN ('forward_to_kabag', 'publish')
),

tamu AS (SELECT to_jsonb(p) AS r FROM permohonan_tamu p),
ruang AS (SELECT to_jsonb(b) AS r FROM room_bookings b),
pengguna AS (SELECT to_jsonb(u) AS r FROM users u)

SELECT jsonb_pretty(jsonb_build_object(

  'dihitung_pada', to_char(now() AT TIME ZONE 'Asia/Makassar', 'YYYY-MM-DD HH24:MI') || ' WITA',

  -- ── Cakupan ────────────────────────────────────────────────────
  'kegiatan_total',      (SELECT count(*) FROM j),
  'tanggal_kegiatan',    jsonb_build_object(
                            'awal',  (SELECT min(d->>'tanggal') FROM j),
                            'akhir', (SELECT max(d->>'tanggal') FROM j)),
  'kegiatan_per_bulan',  (SELECT coalesce(jsonb_object_agg(bln, n ORDER BY bln), '{}'::jsonb) FROM (
                            SELECT substr(d->>'tanggal', 1, 7) AS bln, count(*) AS n
                            FROM j WHERE d->>'tanggal' ~ '^\d{4}-\d{2}'
                            GROUP BY 1) s),
  'kegiatan_per_pimpinan', jsonb_build_object(
                            'walikota',      (SELECT count(*) FROM j WHERE d->'untukPimpinan' ? 'walikota'),
                            'wakilwalikota', (SELECT count(*) FROM j WHERE d->'untukPimpinan' ? 'wakilwalikota')),
  'jenis_kegiatan',      (SELECT coalesce(jsonb_object_agg(jenis, n), '{}'::jsonb) FROM (
                            SELECT coalesce(nullif(d->>'jenisKegiatan', ''), '(kosong)') AS jenis, count(*) AS n
                            FROM j GROUP BY 1) s),

  -- ── Jejak audit ────────────────────────────────────────────────
  'jejak', jsonb_build_object(
      'peristiwa_total',   (SELECT count(*) FROM ev),
      'pertama',           (SELECT to_char(min(pada) AT TIME ZONE 'Asia/Makassar', 'YYYY-MM-DD') FROM ev),
      'terakhir',          (SELECT to_char(max(pada) AT TIME ZONE 'Asia/Makassar', 'YYYY-MM-DD') FROM ev),
      'kegiatan_berjejak', (SELECT count(*) FROM j WHERE jsonb_array_length(tl) > 0),
      'per_aksi',          (SELECT coalesce(jsonb_object_agg(aksi, n), '{}'::jsonb) FROM (
                              SELECT coalesce(aksi, '(kosong)') AS aksi, count(*) AS n FROM ev GROUP BY 1) s),
      -- Tindakan yang diambil Pelaksana Harian (jejak memuat "atas_nama").
      'oleh_plh',          (SELECT count(*) FROM ev WHERE e ? 'atas_nama'),
      -- Keputusan yang melewati daftar periksa wajib (berlaku sejak 22 September 2026).
      'dengan_daftar_periksa', (SELECT count(*) FROM ev
                                 WHERE aksi IN ('forward_to_kabag', 'publish')
                                   AND pada >= '2026-09-22T00:00:00+08:00'
                                   AND coalesce(e->>'note', '') <> '')
  ),

  -- ── Kecepatan penetapan jadwal ─────────────────────────────────
  'kecepatan', jsonb_build_object(
      'kegiatan_jejak_lengkap', (SELECT count(*) FROM durasi WHERE ajukan_tayang IS NOT NULL),
      'median_ajukan_tayang_jam',   (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ajukan_tayang)::numeric, 2)   FROM durasi WHERE ajukan_tayang   IS NOT NULL),
      'rata_ajukan_tayang_jam',     (SELECT round(avg(ajukan_tayang)::numeric, 2)                                           FROM durasi WHERE ajukan_tayang   IS NOT NULL),
      'median_ajukan_teruskan_jam', (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ajukan_teruskan)::numeric, 2) FROM durasi WHERE ajukan_teruskan IS NOT NULL),
      'median_teruskan_tayang_jam', (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY teruskan_tayang)::numeric, 2) FROM durasi WHERE teruskan_tayang IS NOT NULL),
      'tayang_dalam_24_jam',        (SELECT count(*) FROM durasi WHERE ajukan_tayang IS NOT NULL AND ajukan_tayang <= 24),
      'tayang_dalam_4_jam',         (SELECT count(*) FROM durasi WHERE ajukan_tayang IS NOT NULL AND ajukan_tayang <= 4)
  ),
  'penelaahan_waktu', jsonb_build_object(
      'total',             (SELECT count(*) FROM putusan),
      'di_luar_jam_kerja', (SELECT count(*) FROM putusan
                             WHERE EXTRACT(ISODOW FROM lokal) IN (6, 7)
                                OR lokal::time < '07:30' OR lokal::time >= '16:00')
  ),
  'dikembalikan_untuk_diperbaiki', (SELECT count(*) FROM j WHERE EXISTS (
                                      SELECT 1 FROM jsonb_array_elements(tl) x
                                      WHERE x->>'action' IN ('return_by_kasubbag', 'reject_by_kabag'))),

  -- ── Cakupan pemakaian ──────────────────────────────────────────
  'dengan_penugasan_petugas', (SELECT count(*) FROM j WHERE jsonb_typeof(d->'personil') = 'array'
                                                          AND jsonb_array_length(d->'personil') > 0),
  'undangan_terarsip',        (SELECT count(*) FROM j WHERE coalesce(d->>'undanganFile', '') <> ''),
  'sambutan_disahkan',        (SELECT count(*) FROM j WHERE coalesce(d->>'sambutanSah', '') NOT IN ('', 'false', '0', 'null')),
  'sudah_dievaluasi',         (SELECT count(*) FROM j WHERE jsonb_typeof(d->'evaluasi') = 'object'
                                                          AND d->'evaluasi' <> '{}'::jsonb),
  'agenda_dari_permohonan_tamu', (SELECT count(*) FROM j WHERE d->>'created_from' = 'guest_module'),

  -- ── Permohonan audiensi / tamu ─────────────────────────────────
  'tamu', jsonb_build_object(
      'total',            (SELECT count(*) FROM tamu),
      'per_status',       (SELECT coalesce(jsonb_object_agg(st, n), '{}'::jsonb) FROM (
                             SELECT coalesce(r->>'status', '(kosong)') AS st, count(*) AS n FROM tamu GROUP BY 1) s),
      'instansi_berbeda', (SELECT count(DISTINCT lower(trim(r->>'instansi'))) FROM tamu
                            WHERE coalesce(trim(r->>'instansi'), '') <> ''),
      'median_diputus_jam', (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY
                                EXTRACT(EPOCH FROM ((r->>'responded_at')::timestamptz - (r->>'created_at')::timestamptz)) / 3600.0)::numeric, 2)
                              FROM tamu
                              WHERE r->>'responded_at' ~ '^\d{4}-\d{2}-\d{2}' AND r->>'created_at' ~ '^\d{4}-\d{2}-\d{2}')
  ),

  -- ── Peminjaman ruangan ─────────────────────────────────────────
  -- Satu pengajuan dapat terdiri atas beberapa baris slot dengan kode yang
  -- sama; karena itu dihitung per kode, bukan per baris.
  'ruang', jsonb_build_object(
      'baris_slot',       (SELECT count(*) FROM ruang),
      'pengajuan',        (SELECT count(DISTINCT r->>'booking_code') FROM ruang),
      'per_status',       (SELECT coalesce(jsonb_object_agg(st, n), '{}'::jsonb) FROM (
                             SELECT coalesce(r->>'status', '(kosong)') AS st,
                                    count(DISTINCT r->>'booking_code') AS n
                             FROM ruang GROUP BY 1) s),
      'instansi_berbeda', (SELECT count(DISTINCT lower(trim(r->>'instansi'))) FROM ruang
                            WHERE coalesce(trim(r->>'instansi'), '') <> ''),
      'peserta_disetujui', (SELECT coalesce(sum(p), 0) FROM (
                              SELECT max(CASE WHEN r->>'participant_count' ~ '^\d+$'
                                              THEN (r->>'participant_count')::int END) AS p
                              FROM ruang WHERE r->>'status' = 'Approved'
                              GROUP BY r->>'booking_code') s)
  ),

  -- ── Pengguna ───────────────────────────────────────────────────
  'pengguna', jsonb_build_object(
      'aktif',     (SELECT count(*) FROM pengguna WHERE coalesce(r->>'disabled', 'false') <> 'true'),
      'total',     (SELECT count(*) FROM pengguna),
      'per_peran', (SELECT coalesce(jsonb_object_agg(peran, n), '{}'::jsonb) FROM (
                      SELECT coalesce(r->>'role', '(kosong)') AS peran, count(*) AS n
                      FROM pengguna WHERE coalesce(r->>'disabled', 'false') <> 'true'
                      GROUP BY 1) s)
  ),
  'perangkat_notifikasi', jsonb_build_object(
      'perangkat', (SELECT count(*) FROM push_subscriptions),
      'pengguna',  (SELECT count(DISTINCT to_jsonb(s)->>'username') FROM push_subscriptions s))

)) AS statistik;
