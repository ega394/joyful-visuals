// api/_survei.mjs — Survei Kepuasan Masyarakat layanan peminjaman ruang rapat.
// Berawalan garis bawah = modul, bukan fungsi Vercel (kuota 12 fungsi penuh).
//
//   Kirim  : notif-cron?type=survei_ruangan (17.00 WITA) → kirimSurveiRuangan()
//   Isi    : GET/POST /api/room-booking?op=survei&t=TOKEN   (publik, tanpa akun)
//   Hasil  : GET /api/room-booking?op=survei_hasil&dari=&sampai=
//            (Kabag, Kasubbag Protokol, pengelola ruangan; termasuk PLH)
//
// Tabel survei_ruangan (migrasi 2026-11-14_survei_ruangan.sql) tertutup bagi
// kunci publik; hanya kunci layanan di sini yang membaca dan menulisnya.
// Setiap tautan bersifat pribadi (token acak), berlaku 7 hari, sekali isi.
// Nomor WA peminjam tidak pernah ikut dikirim ke peramban.

import crypto from "node:crypto";
import walog from "./_walog.js";
import { punyaPeran } from "../src/lib/plh.js";
import { KODE_UNSUR, MASA_BERLAKU_HARI, periksaJawaban, selesaiPadaHari, rentangTanggal } from "../src/lib/survei.js";

const { catatWA, hasilFonnte } = walog;
const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const FONNTE = process.env.FONNTE_TOKEN;
export const ALAMAT = "https://prokopim.tarakankota.go.id";

const H = (prefer) => ({
  "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
  ...(prefer ? { Prefer: prefer } : {}),
});
async function sb(path, opsi = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { ...opsi, headers: H(opsi.prefer) });
  if (!r.ok) throw new Error(await r.text());
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const tabelBelumAda = (e) => /PGRST205|Could not find the table/i.test(e?.message || "");
const PESAN_MIGRASI = "Survei kepuasan belum aktif — jalankan migrasi 2026-11-14_survei_ruangan.sql.";

// Tanpa huruf/angka yang mudah tertukar (0/O, 1/I/L).
const ABJAD = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function buatToken(panjang = 12) {
  const b = crypto.randomBytes(panjang);
  let s = "";
  for (let i = 0; i < panjang; i++) s += ABJAD[b[i] % ABJAD.length];
  return s;
}
const tokenSah = (t) => /^[2-9A-HJKMNP-Z]{12}$/.test(String(t || ""));

export function isiPesan({ nama, instansi, ruang, kegiatan, tanggal, token }) {
  return (
    `*[PROKOPIM TARAKAN]* Survei Kepuasan Layanan Peminjaman Ruang Rapat\n\n` +
    `Yth. Bapak/Ibu ${nama}${instansi ? ` (${instansi})` : ""},\n` +
    `terima kasih telah menggunakan *Ruang ${ruang}* untuk kegiatan *${kegiatan}* pada ${tanggal}.\n\n` +
    `Mohon kesediaannya mengisi survei singkat (9 pertanyaan, ±2 menit) agar layanan kami semakin baik:\n` +
    `${ALAMAT}/survei/${token}\n\n` +
    `Tautan berlaku ${MASA_BERLAKU_HARI} hari dan hanya dapat diisi sekali.`
  );
}

async function kirimWA(nomor, pesan, arsip) {
  if (!FONNTE) return { ok: false, alasan: "FONNTE_TOKEN belum diatur" };
  try {
    const r = await fetch("https://api.fonnte.com/send", {
      method: "POST", headers: { Authorization: FONNTE, "Content-Type": "application/json" },
      body: JSON.stringify({ target: nomor, message: pesan, countryCode: "62" }),
    });
    const h = await hasilFonnte(r);
    await catatWA({ jenis: "ruangan_survei", sumber: "ruangan", peran: "pemohon", berhasil: h.ok, nomor, isi: pesan, detail: h.detail, ...arsip });
    return { ok: h.ok };
  } catch (e) {
    await catatWA({ jenis: "ruangan_survei", sumber: "ruangan", peran: "pemohon", berhasil: false, catatan: e?.message, nomor, isi: pesan, ...arsip });
    return { ok: false, alasan: e?.message };
  }
}

/**
 * Kirim survei kepada peminjam yang peminjamannya selesai `hari` (WITA).
 * Aman dijalankan berulang: satu kode peminjaman hanya mendapat satu survei
 * (kunci utama booking_code), jadi pengulangan cron tidak mengirim ganda.
 */
export async function kirimSurveiRuangan(hari) {
  const baris = await sb(
    `room_bookings?status=eq.Approved&end_date=gte.${hari}` +
    `&select=booking_code,room_id,start_date,end_date,status,notes,event_name,instansi,pic_name,pic_wa,rooms(name)&limit=1000`
  );
  // Slot lain dalam kode yang sama mungkin berstatus lain (mis. dibatalkan);
  // selesaiPadaHari menolak grup yang tidak seluruhnya disetujui, jadi ambil
  // juga baris non-Approved untuk kode-kode tersebut.
  const kode = [...new Set((baris || []).map((b) => b.booking_code))];
  let semua = baris || [];
  if (kode.length) {
    const lain = await sb(`room_bookings?booking_code=in.(${kode.map(encodeURIComponent).join(",")})&status=neq.Approved&select=booking_code,status,start_date,end_date,notes`);
    semua = semua.concat(lain || []);
  }
  const calon = selesaiPadaHari(semua, hari);
  if (!calon.length) return { dikirim: 0, calon: 0 };

  let sudah = [];
  try {
    sudah = await sb(`survei_ruangan?booking_code=in.(${calon.map((c) => encodeURIComponent(c.booking_code)).join(",")})&select=booking_code`);
  } catch (e) {
    if (tabelBelumAda(e)) return { dikirim: 0, calon: calon.length, galat: PESAN_MIGRASI };
    throw e;
  }
  const sudahSet = new Set((sudah || []).map((s) => s.booking_code));

  let dikirim = 0, gagal = 0;
  for (const c of calon) {
    if (sudahSet.has(c.booking_code)) continue;
    const k = c.kepala;
    const token = buatToken();
    const ruang = k.rooms?.name || "rapat";
    // Simpan dulu (abaikan bila sudah ada) supaya kiriman ganda mustahil.
    const baru = await sb("survei_ruangan?on_conflict=booking_code", {
      method: "POST", prefer: "resolution=ignore-duplicates,return=representation",
      body: JSON.stringify([{
        booking_code: c.booking_code, token, room_id: k.room_id, ruang, instansi: k.instansi,
        pic_name: k.pic_name, kegiatan: k.event_name, tanggal_mulai: c.awal, tanggal_selesai: c.akhir,
      }]),
    });
    if (!baru || !baru.length) continue;
    const pesan = isiPesan({ nama: k.pic_name, instansi: k.instansi, ruang, kegiatan: k.event_name, tanggal: rentangTanggal(c.awal, c.akhir), token });
    const h = await kirimWA(c.wa, pesan, { nama: k.pic_name, rujukan: `ruangan:${c.booking_code}` });
    await sb(`survei_ruangan?booking_code=eq.${encodeURIComponent(c.booking_code)}`, {
      method: "PATCH", body: JSON.stringify({ dikirim_at: new Date().toISOString(), terkirim: h.ok }),
    });
    h.ok ? dikirim++ : gagal++;
  }
  return { dikirim, gagal, calon: calon.length };
}

const KOLOM_HASIL = "booking_code,ruang,room_id,instansi,pic_name,kegiatan,tanggal_mulai,tanggal_selesai,dikirim_at,terkirim,diisi_at,saran," + KODE_UNSUR.join(",");

/** ?op=survei (publik) dan ?op=survei_hasil (berwenang). */
export async function tanganiSurvei(req, res, { verifySession }) {
  const { method, query, body } = req;
  try {
    if (query.op === "survei") {
      if (!tokenSah(query.t)) return res.status(404).json({ error: "Tautan survei tidak dikenal." });
      const row = (await sb(`survei_ruangan?token=eq.${query.t}&select=ruang,instansi,kegiatan,tanggal_mulai,tanggal_selesai,dikirim_at,created_at,diisi_at`))?.[0];
      if (!row) return res.status(404).json({ error: "Tautan survei tidak dikenal." });
      const mulai = Date.parse(row.dikirim_at || row.created_at);
      const kedaluwarsa = Date.now() - mulai > MASA_BERLAKU_HARI * 86400000;
      const info = { ruang: row.ruang, instansi: row.instansi, kegiatan: row.kegiatan,
        tanggal: rentangTanggal(row.tanggal_mulai, row.tanggal_selesai) };

      if (method === "GET") {
        const status = row.diisi_at ? "sudah" : kedaluwarsa ? "kedaluwarsa" : "siap";
        return res.status(200).json({ status, ...info });
      }
      if (method === "POST") {
        if (row.diisi_at) return res.status(409).json({ error: "Survei ini sudah diisi. Terima kasih." });
        if (kedaluwarsa) return res.status(410).json({ error: "Masa pengisian survei ini sudah berakhir." });
        const jawaban = body?.jawaban || {};
        const saran = typeof body?.saran === "string" ? body.saran.trim() : "";
        const salah = periksaJawaban(jawaban, saran);
        if (salah) return res.status(400).json({ error: salah });
        const isi = { diisi_at: new Date().toISOString(), saran: saran || null };
        for (const k of KODE_UNSUR) isi[k] = jawaban[k];
        // diisi_at=is.null menjamin sekali isi meski dua kiriman datang bersamaan.
        const hasil = await sb(`survei_ruangan?token=eq.${query.t}&diisi_at=is.null`, {
          method: "PATCH", prefer: "return=representation", body: JSON.stringify(isi),
        });
        if (!hasil || !hasil.length) return res.status(409).json({ error: "Survei ini sudah diisi. Terima kasih." });
        return res.status(200).json({ ok: true });
      }
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (query.op === "survei_hasil" && method === "GET") {
      const u = await verifySession(req);
      if (!u) return res.status(403).json({ error: "Sesi tidak valid — silakan login ulang." });
      const lengkap = (await sb(`users?username=eq.${encodeURIComponent(u.username)}&select=role,plh_untuk,plh_mulai,plh_selesai,can_manage_rooms`))?.[0] || u;
      const boleh = lengkap.can_manage_rooms || u.role === "superadmin" ||
        punyaPeran(lengkap, "kabag") || punyaPeran(lengkap, "kasubbag_protokol");
      if (!boleh) return res.status(403).json({ error: "Tidak berwenang." });
      const tgl = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? String(s) : null);
      let f = `survei_ruangan?select=${KOLOM_HASIL}&order=tanggal_selesai.desc&limit=2000`;
      if (tgl(query.dari)) f += `&tanggal_selesai=gte.${tgl(query.dari)}`;
      if (tgl(query.sampai)) f += `&tanggal_selesai=lte.${tgl(query.sampai)}`;
      return res.status(200).json({ baris: await sb(f) });
    }
    return res.status(404).json({ error: "Operasi tidak dikenal." });
  } catch (e) {
    if (tabelBelumAda(e)) return res.status(503).json({ error: PESAN_MIGRASI });
    console.error("[survei]", e?.message || e);
    return res.status(500).json({ error: "Terjadi kesalahan pada peladen." });
  }
}
