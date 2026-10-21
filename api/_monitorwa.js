// api/_monitorwa.js — Monitor WA: meteran, arsip WA keluar, status perangkat
// Fonnte, dan penerima webhook Fonnte. Dilayani lewat /api/whatsapp?op=…
// (berawalan garis bawah = modul, bukan fungsi Vercel; kuota 12 fungsi penuh).
//
// Keputusan Kabag (Oktober 2026):
//  - Yang boleh melihat: Admin RK, Kasubbag Protokol, Kabag (+PLH), superadmin.
//  - Lingkup: Kabag, Kasubbag Protokol, superadmin melihat SEMUA WA; Admin RK
//    hanya WA ke pihak luar (pemohon audiensi dan peminjam ruangan).
//  - Isi pesan disimpan lengkap (kecuali OTP), dikosongkan sesudah 90 hari.
//  - Perangkat terputus / gagal beruntun → notifikasi ke ketiga jabatan.
//  - Status terkirim/dibaca dari webhook Fonnte.
//
//   GET  ?op=monitor_wa[&saring=semua|gagal|tamu|ruangan|internal][&q=][&hal=0]
//   POST ?op=wa_status&k=KUNCI     ← webhook "update message status" Fonnte
//   POST ?op=wa_perangkat&k=KUNCI  ← webhook "device status" Fonnte
//   POST ?op=wa_kirim_ulang_gagal  ← kirim ulang WA yang gagal karena perangkat terputus
//
// Webhook Fonnte tidak bertanda tangan, jadi alamatnya membawa kunci rahasia
// turunan kunci layanan (HMAC) — tidak perlu variabel lingkungan baru. Alamat
// lengkapnya hanya ditampilkan kepada Kabag/Kasubbag/superadmin.

const crypto = require("crypto");
const { wajibSesi, peranDipegang } = require("./_sesi.js");
const { peringatkanAdmin } = require("./_dorong.js");
const { catatWA, hasilFonnte } = require("./_walog.js");

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || "";
const H = (prefer) => ({
  "Content-Type": "application/json", apikey: SUPA_KEY,
  Authorization: "Bearer " + SUPA_KEY, ...(prefer ? { Prefer: prefer } : {}),
});

const PERAN_LIHAT = ["kabag", "kasubbag_protokol", "admin_rk", "superadmin"];
const PERAN_PENUH = ["kabag", "kasubbag_protokol", "superadmin"];
const MASA_ARSIP_HARI = 90;
const SEGAR_PERANGKAT_MS = 10 * 60 * 1000;
const PER_HALAMAN = 50;
const KOLOM_ARSIP = "id,waktu,jenis,sumber,peran,berhasil,catatan,nomor,nama_penerima,isi,rujukan,status_kirim,state,diperbarui_pada";

async function sbGet(path) {
  const r = await fetch(SUPA_URL + "/rest/v1/" + path, { headers: H() });
  if (!r.ok) throw Object.assign(new Error(await r.text()), { status: r.status });
  return r.json();
}
async function simpanPengaturan(kunci, nilai) {
  await fetch(SUPA_URL + "/rest/v1/pengaturan_aplikasi?on_conflict=kunci", {
    method: "POST", headers: H("resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify({ kunci, nilai, diubah_oleh: "sistem", diubah_pada: new Date().toISOString() }),
  }).catch(() => {});
}
async function bacaPengaturan(kunci) {
  try { return ((await sbGet("pengaturan_aplikasi?kunci=eq." + kunci + "&select=nilai")) || [])[0]?.nilai || null; }
  catch { return null; }
}

/** Kunci webhook: HMAC kunci layanan — stabil, rahasia, tanpa env baru. */
function kunciWebhook() {
  const dasar = SUPA_KEY || process.env.FONNTE_TOKEN || "";
  if (!dasar) return "";
  return crypto.createHmac("sha256", dasar).update("fonnte-webhook-v1").digest("hex").slice(0, 32);
}
function kunciCocok(k) {
  const a = Buffer.from(String(k || "")), b = Buffer.from(kunciWebhook());
  return b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** 6281234567890 → 0812•••7890 (layar tidak pernah menampilkan nomor utuh). */
function samarkan(n) {
  let d = String(n || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("62")) d = "0" + d.slice(2);
  return d.length <= 7 ? d.slice(0, 2) + "•••" : d.slice(0, 4) + "•••" + d.slice(-4);
}

// ── Status perangkat Fonnte ─────────────────────────────────────
// API profil perangkat Fonnte dibatasi, jadi hasilnya disimpan 10 menit di
// pengaturan_aplikasi ("fonnte_perangkat"); webhook status perangkat juga
// memperbaruinya seketika.
async function statusPerangkat(paksa) {
  const simpanan = await bacaPengaturan("fonnte_perangkat");
  const umur = simpanan && Date.now() - Date.parse(simpanan.diperbarui_pada || "");
  if (!paksa && simpanan && umur < SEGAR_PERANGKAT_MS) return simpanan;
  const token = process.env.FONNTE_TOKEN;
  if (!token) return simpanan || { status: "belum_diatur" };
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch("https://api.fonnte.com/device", { method: "POST", headers: { Authorization: token }, signal: ctl.signal });
    clearTimeout(t);
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.status === false) return { ...(simpanan || {}), galat: String(d.reason || d.detail || "Profil perangkat tidak dapat dibaca").slice(0, 120) };
    const baru = {
      status: String(d.device_status || "").toLowerCase().startsWith("connect") ? "tersambung" : "terputus",
      kuota: d.quota ?? null, kedaluwarsa: d.expired ?? null, paket: d.package ?? null,
      nomor: samarkan(d.device), diperbarui_pada: new Date().toISOString(), sumber: "api",
    };
    await simpanPengaturan("fonnte_perangkat", baru);
    if (baru.status === "terputus" && (!simpanan || simpanan.status !== "terputus")) await peringatanPutus();
    return baru;
  } catch (e) {
    return { ...(simpanan || {}), galat: "Fonnte tidak dapat dihubungi" };
  }
}

function peringatanPutus() {
  return peringatkanAdmin("perangkat_putus", {
    title: "⚠️ Perangkat WhatsApp terputus",
    body: "Perangkat Fonnte terputus, WA dari aplikasi tidak akan terkirim. Mohon sambungkan ulang (pindai kode QR di dasbor Fonnte).",
  }).catch(() => {});
}

// Kosongkan nomor/nama/isi yang lebih tua dari 90 hari (jumlahnya untuk
// meteran tetap ada). Paling sering sekali sehari.
async function bersihkanArsipLama() {
  const hariIni = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const tanda = await bacaPengaturan("wa_arsip_dibersihkan");
  if (tanda && tanda.tanggal === hariIni) return;
  const batas = new Date(Date.now() - MASA_ARSIP_HARI * 86400000).toISOString();
  await fetch(SUPA_URL + "/rest/v1/wa_log?waktu=lt." + encodeURIComponent(batas) + "&or=(isi.not.is.null,nomor.not.is.null,nama_penerima.not.is.null)", {
    method: "PATCH", headers: H("return=minimal"), body: JSON.stringify({ isi: null, nomor: null, nama_penerima: null }),
  }).catch(() => {});
  await simpanPengaturan("wa_arsip_dibersihkan", { tanggal: hariIni });
}

// ── Webhook Fonnte ─────────────────────────────────────────────
const STATUS_GAGAL = ["failed", "invalid", "expired", "url unreachable"];

async function webhookStatus(req, res) {
  const b = { ...(req.query || {}), ...(typeof req.body === "object" && req.body ? req.body : {}) };
  const id = String(b.id || "").slice(0, 60);
  if (!id) return res.status(200).json({ ok: true, diabaikan: "tanpa id" });
  const status = String(b.status || "").toLowerCase().slice(0, 30) || null;
  const state = b.state === undefined || b.state === null ? null : String(b.state).toLowerCase().slice(0, 30);
  const ubah = { diperbarui_pada: new Date().toISOString() };
  if (status) ubah.status_kirim = status;
  if (state !== null) ubah.state = state;
  if (status && STATUS_GAGAL.includes(status)) { ubah.berhasil = false; ubah.catatan = "Fonnte: " + status; }
  await fetch(SUPA_URL + "/rest/v1/wa_log?id_fonnte=eq." + encodeURIComponent(id), {
    method: "PATCH", headers: H("return=minimal"), body: JSON.stringify(ubah),
  }).catch(() => {});
  return res.status(200).json({ ok: true });
}

async function webhookPerangkat(req, res) {
  const b = { ...(req.query || {}), ...(typeof req.body === "object" && req.body ? req.body : {}) };
  const mentah = String(b.status || b.device_status || b.state || "").toLowerCase();
  if (!mentah) return res.status(200).json({ ok: true, diabaikan: "tanpa status" });
  const putus = /disconnect|logout|off|terputus/.test(mentah);
  const lama = await bacaPengaturan("fonnte_perangkat");
  const baru = { ...(lama || {}), status: putus ? "terputus" : "tersambung", alasan: b.reason ? String(b.reason).slice(0, 120) : null,
    diperbarui_pada: new Date().toISOString(), sumber: "webhook" };
  await simpanPengaturan("fonnte_perangkat", baru);
  if (putus) await peringatanPutus();
  return res.status(200).json({ ok: true });
}

// ── Kirim ulang yang gagal karena perangkat terputus ─────────────
// Saat perangkat Fonnte terputus, semua WA ditolak ("disconnected device").
// Setelah tersambung lagi, pesan yang sama dapat dikirim ulang sekali:
// isi dan nomor sudah tersimpan di arsip (kecuali OTP). Batas 48 jam supaya
// kabar yang sudah basi tidak terkirim; satu ketukan paling banyak 10 pesan
// agar fungsi tidak melewati batas waktu. Kiriman ulang dicatat dengan
// rujukan "ulang:<id asal>", sehingga pesan yang sama tidak terkirim dua kali.
const ULANG_JAM = 48;
const ULANG_PER_KETUK = 10;

async function calonUlang(lingkup) {
  const sejak = encodeURIComponent(new Date(Date.now() - ULANG_JAM * 3600000).toISOString());
  const [gagal, sudah] = await Promise.all([
    sbGet("wa_log?select=id,waktu,jenis,peran,nomor,nama_penerima,penerima_username,isi" + lingkup +
      "&berhasil=is.false&waktu=gte." + sejak + "&nomor=not.is.null&isi=not.is.null&jenis=neq.otp" +
      "&catatan=ilike.*disconnected*&order=waktu.asc&limit=300"),
    sbGet("wa_log?select=rujukan&rujukan=like.ulang:*&waktu=gte." + sejak + "&limit=1000"),
  ]);
  const dikirim = new Set((sudah || []).map((r) => String(r.rujukan).slice(6)));
  const unik = new Set();
  return (gagal || []).filter((r) => {
    const k = r.nomor + "|" + r.isi;
    if (dikirim.has(String(r.id)) || unik.has(k)) return false;
    unik.add(k); return true;
  });
}

async function kirimUlangGagal(req, res) {
  const u = await wajibSesi(req, res, { peran: PERAN_LIHAT });
  if (!u) return;
  const penuh = peranDipegang(u).some((p) => PERAN_PENUH.includes(p));
  const lingkup = penuh ? "" : "&peran=eq.pemohon";
  const token = process.env.FONNTE_TOKEN;
  if (!token) return res.status(503).json({ error: "Token Fonnte belum diatur." });
  const perangkat = await statusPerangkat(true);
  if (perangkat && perangkat.status === "terputus") {
    return res.status(409).json({ error: "Perangkat WhatsApp masih terputus. Sambungkan dulu di dasbor fonnte.com, lalu coba lagi." });
  }
  const calon = await calonUlang(lingkup);
  const kirim = calon.slice(0, ULANG_PER_KETUK);
  let terkirim = 0, gagal = 0;
  for (const r of kirim) {
    let h = { ok: false, detail: null };
    try {
      const x = await fetch("https://api.fonnte.com/send", {
        method: "POST", headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ target: r.nomor, message: r.isi, countryCode: "62" }),
      });
      h = await hasilFonnte(x);
    } catch (e) { h = { ok: false, detail: { reason: e && e.message } }; }
    h.ok ? terkirim++ : gagal++;
    await catatWA({ jenis: r.jenis, sumber: "kirim_ulang", peran: r.peran, berhasil: h.ok, nomor: r.nomor,
      nama: r.nama_penerima, username: r.penerima_username, isi: r.isi, rujukan: "ulang:" + r.id, detail: h.detail });
  }
  return res.status(200).json({ terkirim, gagal, sisa: Math.max(0, calon.length - kirim.length), oleh: u.username });
}

// ── Monitor WA (aplikasi) ──────────────────────────────────────
async function monitor(req, res) {
  const u = await wajibSesi(req, res, { peran: PERAN_LIHAT });
  if (!u) return;
  const penuh = peranDipegang(u).some((p) => PERAN_PENUH.includes(p));
  const q = req.query || {};
  // Admin RK: hanya WA ke pihak luar (pemohon audiensi & peminjam ruangan).
  const lingkup = penuh ? "" : "&peran=eq.pemohon";
  const saring = String(q.saring || "semua");
  let filter = lingkup;
  if (saring === "gagal") filter += "&berhasil=is.false";
  else if (saring === "tamu") filter += "&sumber=eq.tamu";
  else if (saring === "ruangan") filter += "&sumber=eq.ruangan";
  else if (saring === "internal" && penuh) filter += "&peran=neq.pemohon";
  const cari = String(q.q || "").replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 40);
  if (cari) filter += "&or=(nama_penerima.ilike.*" + encodeURIComponent(cari) + "*,jenis.ilike.*" + encodeURIComponent(cari) + "*,rujukan.ilike.*" + encodeURIComponent(cari) + "*)";
  const hal = Math.max(0, Math.min(200, parseInt(q.hal || "0", 10) || 0));

  // Rekap mentah untuk konsol superadmin (tab Notifikasi & WA): jenis,
  // sumber, berhasil per baris tanpa data penerima, sampai 90 hari.
  if (q.mentah === "1") {
    if (!penuh) return res.status(403).json({ error: "Tidak berwenang." });
    const hari = Math.max(1, Math.min(MASA_ARSIP_HARI, parseInt(q.hari || "30", 10) || 30));
    const sejak = new Date(Date.now() - hari * 86400000).toISOString();
    const baris = [];
    for (let off = 0; off < 20000; off += 1000) {
      const page = await sbGet("wa_log?select=waktu,jenis,sumber,peran,berhasil&waktu=gte." + encodeURIComponent(sejak) + "&order=waktu.asc&limit=1000&offset=" + off);
      baris.push(...page);
      if (page.length < 1000) break;
    }
    return res.status(200).json({ baris });
  }

  bersihkanArsipLama().catch(() => {});
  const sejak30 = new Date(Date.now() - 30 * 86400000).toISOString();
  let baris, ringkasBaris, perangkat;
  try {
    [baris, ringkasBaris, perangkat] = await Promise.all([
      sbGet("wa_log?select=" + KOLOM_ARSIP + filter + "&order=waktu.desc&limit=" + (PER_HALAMAN + 1) + "&offset=" + hal * PER_HALAMAN),
      sbGet("wa_log?select=waktu,jenis,berhasil" + lingkup + "&waktu=gte." + encodeURIComponent(sejak30) + "&order=waktu.desc&limit=10000"),
      statusPerangkat(q.segarkan === "1"),
    ]);
  } catch (e) {
    if (/column|PGRST204|42703/i.test(e.message)) return res.status(503).json({ error: "Monitor WA belum aktif — jalankan migrasi 2026-10-14_monitor_wa.sql." });
    throw e;
  }

  // Meteran: hari ini (WITA), 7 hari, 30 hari; per jenis 30 hari.
  const hariIni = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const sejak7 = Date.now() - 7 * 86400000;
  const kosong = () => ({ ok: 0, gagal: 0 });
  const ringkas = { hari: kosong(), minggu: kosong(), bulan: kosong() };
  const perJenis = {};
  for (const r of ringkasBaris || []) {
    const k = r.berhasil ? "ok" : "gagal";
    ringkas.bulan[k]++;
    const t = Date.parse(r.waktu);
    if (t >= sejak7) ringkas.minggu[k]++;
    if (new Date(t + 8 * 3600000).toISOString().slice(0, 10) === hariIni) ringkas.hari[k]++;
    (perJenis[r.jenis] = perJenis[r.jenis] || kosong())[k]++;
  }

  // Pesan gagal karena perangkat terputus yang masih bisa dikirim ulang.
  let ulang = null;
  try {
    const c = await calonUlang(lingkup);
    ulang = { jumlah: c.length, contoh: c.slice(0, 5).map((r) => ({ waktu: r.waktu, jenis: r.jenis, nama_penerima: r.nama_penerima, nomor: samarkan(r.nomor) })) };
  } catch { /* kolom arsip belum ada: abaikan */ }

  const ada = (baris || []).length > PER_HALAMAN;
  const arsip = (baris || []).slice(0, PER_HALAMAN).map((r) => ({ ...r, nomor: samarkan(r.nomor) }));
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  const kunci = kunciWebhook();
  return res.status(200).json({
    lingkup: penuh ? "semua" : "eksternal",
    ringkas,
    perJenis: Object.entries(perJenis).map(([jenis, v]) => ({ jenis, ...v })).sort((a, b) => (b.ok + b.gagal) - (a.ok + a.gagal)),
    arsip, lanjut: ada, hal,
    perangkat: perangkat || null,
    webhook: penuh && kunci && host ? {
      status: "https://" + host + "/api/whatsapp?op=wa_status&k=" + kunci,
      perangkat: "https://" + host + "/api/whatsapp?op=wa_perangkat&k=" + kunci,
    } : null,
    masaArsipHari: MASA_ARSIP_HARI,
    ulang,
  });
}

async function tanganiMonitor(req, res) {
  const op = String((req.query || {}).op || "");
  try {
    if (op === "wa_status" || op === "wa_perangkat") {
      if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      if (!kunciCocok((req.query || {}).k)) return res.status(403).json({ error: "Kunci webhook tidak sah." });
      return op === "wa_status" ? webhookStatus(req, res) : webhookPerangkat(req, res);
    }
    if (op === "monitor_wa" && req.method === "GET") return monitor(req, res);
    if (op === "wa_kirim_ulang_gagal" && req.method === "POST") return kirimUlangGagal(req, res);
    return res.status(404).json({ error: "Operasi tidak dikenal." });
  } catch (e) {
    console.error("[monitor WA]", op, e.message);
    return res.status(500).json({ error: "Terjadi kesalahan pada peladen." });
  }
}

module.exports = { tanganiMonitor, kunciWebhook, samarkan, calonUlang };
