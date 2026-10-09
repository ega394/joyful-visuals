// api/_walog.js — catatan setiap WhatsApp (Fonnte) yang dikirim peladen.
//
// Berawalan garis bawah sehingga Vercel tidak menghitungnya sebagai fungsi.
// CommonJS seperti _sesi.js: dimuat api/*.js lewat import (ditranspilasi
// menjadi require) maupun api/*.mjs lewat `import walog from "./_walog.js"`.
//
// Tujuannya mengukur: jenis pesan apa yang paling banyak memakai kuota, dan
// apakah pemangkasan benar-benar menurunkan jumlahnya. Karena itu yang
// dicatat hanya JENIS pesan, sumber, PERAN penerima, dan berhasil/gagal —
// tidak pernah nomor HP, nama, ataupun isi pesan.
//
// Tabel: supabase-migrations/2026-10-10_wa_log.sql. Pencatatan tidak boleh
// pernah menggagalkan pengiriman: tabel belum dibuat, kunci salah, atau
// jaringan lambat cukup dicatat di log fungsi.

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
// Hanya kunci layanan yang boleh menulis wa_log (RLS menolak kunci anon).
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || "";

/**
 * Catat satu WA. `baris`: { jenis, sumber, peran, berhasil, catatan }.
 * Ditunggu paling lama 1,5 detik supaya fungsi tidak keburu dihentikan
 * sebelum catatannya terkirim, tanpa memperlambat pengiriman berikutnya.
 */
async function catatWA(baris) {
  if (!SUPA_URL || !SUPA_KEY) return;
  const isi = {
    jenis: String((baris && baris.jenis) || "lainnya").slice(0, 60),
    sumber: String((baris && baris.sumber) || "").slice(0, 30) || null,
    peran: String((baris && baris.peran) || "").slice(0, 40) || null,
    berhasil: !(baris && baris.berhasil === false),
    catatan: (baris && baris.catatan) ? String(baris.catatan).slice(0, 200) : null,
  };
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), 1500) : null;
  try {
    const r = await fetch(SUPA_URL + "/rest/v1/wa_log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", apikey: SUPA_KEY,
        Authorization: "Bearer " + SUPA_KEY, Prefer: "return=minimal",
      },
      body: JSON.stringify(isi),
      signal: ctl ? ctl.signal : undefined,
    });
    if (!r.ok) console.warn("[wa_log] gagal dicatat:", r.status);
  } catch (e) {
    console.warn("[wa_log] gagal dicatat:", (e && e.message) || e);
  } finally {
    if (t) clearTimeout(t);
  }
}

/** Fonnte membalas HTTP 200 dengan {status:false} saat gagal; anggap gagal juga. */
async function hasilFonnte(r) {
  let d = null;
  try { d = await r.json(); } catch { /* bukan JSON */ }
  return { ok: !!(r && r.ok) && !(d && d.status === false), detail: d };
}

module.exports = { catatWA, hasilFonnte };
