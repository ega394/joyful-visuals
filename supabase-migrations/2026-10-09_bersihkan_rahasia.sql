-- 2026-10-09 — Bersihkan rahasia yang tertinggal dari versi lama aplikasi.
-- Aman dijalankan berulang kali.
--
-- 1. pending_regs: formulir pendaftaran lama ikut menyimpan isian
--    "konfirmasi" (sandi polos) di kolom data.
UPDATE pending_regs
   SET data = data - 'konfirmasi'
 WHERE data ? 'konfirmasi';

-- 2. audit_log: otorisasi ganda versi lama mencatat objek pemberi otorisasi
--    lengkap, termasuk hash sandinya, di detail.approvers. Disisakan
--    username-nya saja.
UPDATE audit_log
   SET detail = jsonb_set(
         detail, '{approvers}',
         (SELECT coalesce(jsonb_object_agg(k, CASE WHEN jsonb_typeof(v) = 'object'
                                                   THEN to_jsonb(v ->> 'username')
                                                   ELSE v END), '{}'::jsonb)
            FROM jsonb_each(detail -> 'approvers') AS e(k, v)))
 WHERE jsonb_typeof(detail -> 'approvers') = 'object'
   AND detail::text LIKE '%"password"%';

-- 3. Sesudah langkah 2, periksa tidak ada lagi hash yang tersisa (harus 0):
--   SELECT count(*) FROM audit_log WHERE detail::text LIKE '%"password"%';
