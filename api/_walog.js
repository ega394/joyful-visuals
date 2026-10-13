// api/_walog.js — catatan dan arsip setiap WhatsApp (Fonnte) yang dikirim peladen.
//
// Berawalan garis bawah sehingga Vercel tidak menghitungnya sebagai fungsi.
// CommonJS seperti _sesi.js: dimuat api/*.js lewat import (ditranspilasi
// menjadi require) maupun api/*.mjs lewat `import walog from "./_walog.js"`.
//
// Dua kegunaan:
//  1. Meteran — jenis pesan apa yang paling banyak memakai kuota, berhasil/gagal.
//  2. Arsip WA keluar (Monitor WA, keputusan Kabag Oktober 2026) — Admin RK,
//     Kasubbag Protokol, dan Kabag dapat memeriksa apakah sebuah WA terkirim:
//     penerima, nomor, isi pesan, dan status dari Fonnte (lewat webhook).
//     Isi pesan OTP TIDAK PERNAH disimpan. Nomor/nama/isi dikosongkan sesudah
//     90 hari (lihat api/_monitorwa.js); tabel tertutup untuk kunci publik.
//
// Tabel: supabase-migrations/2026-10-10_wa_log.sql + 2026-10-14_monitor_wa.sql.
// Pencatatan tidak boleh pernah menggagalkan pengiriman: tabel/kolom belum
// dibuat, kunci salah, atau jaringan lambat cukup dicatat di log fungsi.

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
// Hanya kunci layanan yang boleh menulis wa_log (RLS menolak kunci anon).
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || "";

const H = (prefer) => ({
  "Content-Type": "application/json", apikey: SUPA_KEY,
  Authorization: "Bearer " + SUPA_KEY, ...(prefer ? { Prefer: prefer } : {}),
});

async function denganBatasWaktu(ms, kerja) {
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), ms) : null;
  try { return await kerja(ctl ? ctl.signal : undefined); }
  finally { if (t) clearTimeout(t); }
}

/** ID pesan dari jawaban Fonnte ({ id: ["80367170"] } atau { id: "…" }). */
function idFonnte(detail) {
  const v = detail && detail.id;
  const id = Array.isArray(v) ? v[0] : v;
  return id === undefined || id === null || id === "" ? null : String(id).slice(0, 60);
}

/** Alasan gagal yang bisa dibaca dari jawaban Fonnte. */
function alasanFonnte(detail) {
  if (!detail) return null;
  return String(detail.reason || detail.detail || detail.message || JSON.stringify(detail)).slice(0, 200);
}

/**
 * Catat satu WA.
 *   wajib   : jenis, sumber, berhasil
 *   meteran : peran (peran penerima), catatan
 *   arsip   : nomor, nama, username, isi, rujukan (mis. "tamu:123"), detail (jawaban Fonnte)
 * Ditunggu paling lama 1,5 detik supaya fungsi tidak keburu dihentikan
 * sebelum catatannya terkirim, tanpa memperlambat pengiriman berikutnya.
 */
async function catatWA(baris) {
  if (!SUPA_URL || !SUPA_KEY) return;
  const b = baris || {};
  const berhasil = b.berhasil !== false;
  const dasar = {
    jenis: String(b.jenis || "lainnya").slice(0, 60),
    sumber: String(b.sumber || "").slice(0, 30) || null,
    peran: String(b.peran || "").slice(0, 40) || null,
    berhasil,
    catatan: b.catatan ? String(b.catatan).slice(0, 200) : (!berhasil ? alasanFonnte(b.detail) : null),
  };
  const otp = dasar.jenis === "otp" || dasar.sumber === "otp";
  const arsip = {
    nomor: b.nomor ? String(b.nomor).replace(/[^\d+]/g, "").slice(0, 20) || null : null,
    nama_penerima: b.nama ? String(b.nama).slice(0, 120) : null,
    penerima_username: b.username ? String(b.username).slice(0, 60) : null,
    // Kode OTP tidak boleh tersimpan di mana pun.
    isi: !otp && b.isi ? String(b.isi).slice(0, 4000) : null,
    rujukan: b.rujukan ? String(b.rujukan).slice(0, 80) : null,
    id_fonnte: idFonnte(b.detail),
    status_kirim: berhasil ? (b.detail && b.detail.process ? String(b.detail.process).slice(0, 30) : "diterima") : "gagal",
  };
  try {
    await denganBatasWaktu(1500, async (signal) => {
      let r = await fetch(SUPA_URL + "/rest/v1/wa_log", {
        method: "POST", headers: H("return=minimal"), body: JSON.stringify({ ...dasar, ...arsip }), signal,
      });
      // Migrasi arsip belum dijalankan → catat kolom meteran saja seperti dulu.
      if (!r.ok && r.status === 400) {
        r = await fetch(SUPA_URL + "/rest/v1/wa_log", {
          method: "POST", headers: H("return=minimal"), body: JSON.stringify(dasar), signal,
        });
      }
      if (!r.ok) console.warn("[wa_log] gagal dicatat:", r.status);
    });
  } catch (e) {
    console.warn("[wa_log] gagal dicatat:", (e && e.message) || e);
  }
  if (!berhasil) {
    try { await periksaGagalBeruntun(); } catch (e) { console.warn("[wa_log] periksa gagal:", e && e.message); }
  }
}

/** Fonnte membalas HTTP 200 dengan {status:false} saat gagal; anggap gagal juga. */
async function hasilFonnte(r) {
  let d = null;
  try { d = await r.json(); } catch { /* bukan JSON */ }
  return { ok: !!(r && r.ok) && !(d && d.status === false), detail: d };
}

// ── Peringatan dini ─────────────────────────────────────────────
// Tiga WA terakhir gagal semua → kemungkinan besar perangkat Fonnte terputus
// atau kuota habis. Admin RK, Kasubbag Protokol, dan Kabag (+PLH) diberi
// notifikasi aplikasi, paling sering sekali per jam (lihat _dorong.js).
async function periksaGagalBeruntun() {
  if (!SUPA_URL || !SUPA_KEY) return;
  const r = await denganBatasWaktu(1500, (signal) =>
    fetch(SUPA_URL + "/rest/v1/wa_log?select=berhasil,catatan&order=waktu.desc&limit=3", { headers: H(), signal }));
  if (!r.ok) return;
  const akhir = await r.json();
  if (!Array.isArray(akhir) || akhir.length < 3 || akhir.some((x) => x.berhasil)) return;
  const { peringatkanAdmin } = require("./_dorong.js");
  await peringatkanAdmin("gagal_beruntun", {
    title: "⚠️ WhatsApp gagal terkirim",
    body: "3 WA terakhir gagal. Periksa sambungan perangkat Fonnte di menu Monitor WA. Alasan terakhir: " + String(akhir[0].catatan || "-").slice(0, 80),
  });
}

module.exports = { catatWA, hasilFonnte, idFonnte, alasanFonnte };
