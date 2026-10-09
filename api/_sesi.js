// api/_sesi.js — pemeriksaan sesi bersama untuk endpoint berkas .js (CommonJS)
//
// Berawalan garis bawah sehingga Vercel tidak menghitungnya sebagai fungsi
// (jatah Hobby 12/12 penuh). Ditulis CommonJS dan dimuat dengan require(),
// seperti api/_middleware.js — JANGAN diubah menjadi ESM/.mjs: api/*.js
// ditranspilasi menjadi CommonJS, dan require() terhadap modul ESM membuat
// fungsinya mati saat dimuat (lihat scripts/cek-api.mjs).
//
// Token sesi diterbitkan api/room-booking.mjs?op=auth dan disimpan di tabel
// `sesi`. Pemeriksaan di sini sengaja meniru verifySession() di
// api/room-booking.mjs (kunci, tabel, cadangan kolom lama) supaya sebuah token
// yang sah di sana juga sah di sini, dan sebaliknya.

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

async function sbGet(path) {
  const r = await fetch(SUPA_URL + "/rest/v1/" + path, {
    headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Tabel `sesi` belum dibuat (migrasi 2026-09-11 belum dijalankan).
function tabelBelumAda(e) {
  const m = String((e && e.message) || "");
  return /PGRST205|Could not find the table/i.test(m);
}

function ambilToken(req) {
  const auth = req.headers["authorization"] || "";
  return (auth.startsWith("Bearer ") ? auth.slice(7) : "") || req.headers["x-admin-token"] || "";
}

/** Pengguna aktif pemilik token, atau null. */
async function verifikasiSesi(req) {
  const token = ambilToken(req);
  if (!token || !SUPA_URL || !SUPA_KEY) return null;

  let username;
  try {
    const sesi = (await sbGet("sesi?token=eq." + encodeURIComponent(token) + "&select=username,kedaluwarsa"))[0];
    if (!sesi || !sesi.kedaluwarsa || new Date(sesi.kedaluwarsa) < new Date()) return null;
    username = sesi.username;
  } catch (e) {
    if (!tabelBelumAda(e)) {
      console.error("[sesi] tabel `sesi` tidak terbaca. Periksa SUPABASE_SERVICE_KEY.", e.message);
      return null;
    }
    const lama = (await sbGet("users?session_token=eq." + encodeURIComponent(token) + "&select=username,session_expires"))[0];
    if (!lama || !lama.session_expires || new Date(lama.session_expires) < new Date()) return null;
    username = lama.username;
  }

  const u = (await sbGet(
    "users?username=eq." + encodeURIComponent(username) +
    "&select=username,nama,role,disabled,plh_untuk,plh_mulai,plh_selesai"
  ))[0];
  if (!u || u.disabled) return null;
  return u;
}

// Tanggal hari ini menurut WITA (UTC+8), "YYYY-MM-DD".
function hariIniWita() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Peran asli ditambah peran yang sedang diampu sebagai PLH (bila masih berlaku). */
function peranDipegang(u) {
  const hasil = [u.role];
  const t = hariIniWita();
  if (u.plh_untuk && u.plh_mulai && u.plh_selesai && u.plh_mulai <= t && t <= u.plh_selesai) hasil.push(u.plh_untuk);
  return hasil;
}

/**
 * Wajib sesi sah. Mengembalikan pengguna, atau null setelah mengirim 401/403.
 * opts.peran: daftar peran yang diizinkan (peran asli maupun PLH yang berlaku).
 */
async function wajibSesi(req, res, opts) {
  const peran = opts && opts.peran;
  let u = null;
  try { u = await verifikasiSesi(req); } catch (e) { console.error("[sesi]", e.message); }
  if (!u) {
    res.status(401).json({ error: "Sesi tidak valid — silakan login ulang." });
    return null;
  }
  if (peran && !peranDipegang(u).some((p) => peran.includes(p))) {
    res.status(403).json({ error: "Peran Anda tidak berwenang untuk tindakan ini." });
    return null;
  }
  return u;
}

/**
 * Permintaan membawa DRIVE_ADMIN_SECRET atau CRON_SECRET (alat admin/diagnosis,
 * bukan peramban). API_SECRET sengaja TIDAK diterima: versi lama aplikasi
 * menanam salinannya (VITE_API_SECRET) di bundel peramban, sehingga nilainya
 * harus dianggap publik.
 */
function rahasiaCocok(req) {
  const rahasia = [process.env.DRIVE_ADMIN_SECRET, process.env.CRON_SECRET].filter(Boolean);
  if (rahasia.length === 0) return false;
  const auth = req.headers["authorization"] || "";
  const diberi = req.headers["x-api-secret"] || (auth.startsWith("Bearer ") ? auth.slice(7) : "");
  return !!diberi && rahasia.includes(diberi);
}

// "08xx" / "+62 8xx" / "628xx" → "628xx".
function normalNomor(n) {
  return String(n || "").trim().replace(/^\+/, "").replace(/^0/, "62").replace(/\D/g, "");
}

/**
 * Nomor WA milik akun aktif yang terdaftar di tabel users. Notifikasi aplikasi
 * hanya dikirim ke pegawai sendiri; tanpa pemeriksaan ini akun mana pun yang
 * login dapat memakai nomor resmi Prokopim untuk mengirim pesan ke nomor luar.
 */
async function nomorTerdaftar(nomor) {
  const target = normalNomor(nomor);
  if (target.length < 10 || !SUPA_URL || !SUPA_KEY) return false;
  const rows = await sbGet("users?select=*");
  return rows.some((u) => !u.disabled && [u.noWA, u.no_wa].some((n) => n && normalNomor(n) === target));
}

module.exports = { verifikasiSesi, wajibSesi, rahasiaCocok, peranDipegang, ambilToken, nomorTerdaftar, normalNomor };
