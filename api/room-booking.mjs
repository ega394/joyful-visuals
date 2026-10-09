/**
 * api/room-booking.mjs — Unified Room Booking Handler
 * Menggabungkan rooms.js + room-bookings.js + room-bookings-admin.js
 * agar tetap dalam batas 12 serverless functions Vercel Hobby.
 *
 * BEREKSTENSI .mjs — JANGAN dinamai ulang menjadi .js.
 *
 * api/package.json menyatakan "type": "commonjs", sehingga berkas .js di
 * sini ditranspilasi menjadi CommonJS oleh pembangun Vercel. Berkas ini
 * mengimpor ../src/lib/plh.js, yang berada di bawah package.json akar
 * ("type": "module") dan karenanya tetap ESM. Impornya berubah menjadi
 * require() terhadap modul ESM, dan fungsi ini mati saat dimuat:
 *
 *   Error [ERR_REQUIRE_ESM]: require() of ES Module src/lib/plh.js
 *   from api/room-booking.js not supported
 *
 * Seluruh endpoint ini balas 500 — peminjaman ruangan, penerbitan token
 * sesi (op=auth), dan penetapan PLH sekaligus. Kejadian nyata: 10–11
 * September 2026, sekitar 18 jam, tanpa gejala lain selain "gagal
 * memverifikasi akses pengelola" di layar pengguna.
 *
 * Ekstensi .mjs membuat berkas ini ESM tanpa bergantung pada package.json,
 * sehingga impor ESM-ke-ESM berjalan wajar. Jalur rutenya tidak berubah:
 * tetap /api/room-booking.
 *
 * `node --check` pada berkas api/*.js adalah alat yang tepat untuk
 * mencurigai masalah ini, tetapi bukan untuk memastikannya — dan
 * mem-bundel dengan esbuild JUSTRU MENYESATKAN, sebab esbuild menyisipkan
 * plh.js ke dalam keluaran sehingga require()-nya tidak pernah terjadi.
 * Pemastiannya: impor berkas ini dengan Node sungguhan (lihat
 * package.json → skrip "cek:api").
 *
 * Routing:
 *   GET  ?op=rooms              → list ruangan
 *   GET  ?month=YYYY-MM         → kalender ketersediaan
 *   GET  ?code=XXX              → tracker by booking_code
 *   GET  ?pic_wa=XXX            → tracker by WA
 *   GET  ?admin=1               → admin list (protected)
 *   POST (no admin)             → submit pengajuan publik
 *   PUT  + header X-Username    → admin update status
 *   DELETE ?id=X&code=X         → cancel oleh peminjam
 */

// Aturan PLH sengaja tidak disalin ulang di sini: peramban dan peladen harus
// memakai pemeriksaan yang sama persis, kalau tidak keduanya bisa berbeda
// pendapat tentang penetapan yang sah.
import { periksaPenetapan, plhAktif } from "../src/lib/plh.js";
import { sinkronSatu } from "./_kalender.mjs";
// CommonJS (lihat kepala _walog.js) — impor bawaan, lalu ambil fungsinya.
import walog from "./_walog.js";
const { catatWA, hasilFonnte } = walog;

const SUPA_URL = process.env.SUPABASE_URL  || process.env.VITE_SUPABASE_URL;
// Utamakan service key: dengan itu endpoint ini tetap berjalan meski kebijakan
// RLS `room_bookings` dipersempit sehingga anon key tidak lagi bisa membaca
// tabelnya langsung. Fallback tetap ada supaya deploy lama tidak mati.
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const FONNTE   = process.env.FONNTE_TOKEN;
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const VAPID_EMAIL   = process.env.VAPID_EMAIL || "mailto:prokopim@tarakankota.go.id";

const H = () => ({
  "Content-Type":  "application/json",
  "apikey":        SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
});

// ── Supabase helpers ──────────────────────────────────────────
async function sbGet(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: H() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbPost(path, body) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: { ...H(), "Prefer": "return=representation" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbPatch(path, body) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...H(), "Prefer": "return=representation" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbDelete(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { method: "DELETE", headers: H() });
  if (!r.ok) throw new Error(await r.text());
}

// Tabel belum ada — BUKAN hak akses yang kurang. Dipakai untuk membedakan
// "migrasi belum dijalankan" (boleh kembali ke perilaku lama) dari "kunci
// layanan belum terpasang" (harus gagal, bukan diam-diam dilonggarkan).
const tabelBelumAda = (e) => /PGRST205|Could not find the table/i.test(e?.message || "");

// ── WA helper ─────────────────────────────────────────────────
// `jenis` dan `peran` hanya untuk wa_log (tanpa nomor/isi pesan).
async function sendWA(to, message, jenis = "ruangan", peran = "") {
  if (!FONNTE || !to) return false;
  try {
    const r = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { "Authorization": FONNTE, "Content-Type": "application/json" },
      body: JSON.stringify({ target: String(to).replace(/\D/g, ""), message }),
    });
    const h = await hasilFonnte(r);
    await catatWA({ jenis, sumber: "ruangan", peran, berhasil: h.ok });
    return h.ok;
  } catch (e) {
    await catatWA({ jenis, sumber: "ruangan", peran, berhasil: false, catatan: e?.message });
    return false;
  }
}

// Peninjau permohonan ruangan yang AKTIF (akun nonaktif tidak dikirimi),
// satu per nomor. `kabag`: "selalu" — Kabag ikut (pengajuan baru, sesuai
// SOP 6); "cadangan" — Kabag hanya bila tidak ada pengelola aktif.
async function peninjauRuangan(kabag = "selalu") {
  const aktif = "&disabled=not.is.true";
  const [managers, kabagList] = await Promise.all([
    sbGet("users?can_manage_rooms=eq.true&select=nama,noWA,role" + aktif).catch(() => []),
    sbGet("users?role=eq.kabag&select=nama,noWA,role" + aktif).catch(() => []),
  ]);
  const pengelola = (managers || []).filter(u => u.noWA);
  const ikutKabag = kabag === "selalu" || pengelola.length === 0;
  const semua = [...pengelola, ...(ikutKabag ? (kabagList || []) : [])];
  const nomor = (n) => String(n || "").replace(/\D/g, "").replace(/^0/, "62");
  return semua.filter((u, i, a) => u.noWA && a.findIndex(x => nomor(x.noWA) === nomor(u.noWA)) === i);
}

// ── Push notification helper ──────────────────────────────────
async function sendPushToManagers({ title, body, url, tag }) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  let webpush;
  try { webpush = (await import("web-push")).default || (await import("web-push")); }
  catch { return; }
  try { webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE); }
  catch { return; }

  // Ambil username peninjau permohonan + kabag
  const [managers, kabagList] = await Promise.all([
    sbGet("users?can_manage_rooms=eq.true&select=username&disabled=not.is.true").catch(()=>[]),
    sbGet("users?role=eq.kabag&select=username&disabled=not.is.true").catch(()=>[]),
  ]);
  const usernames = [...new Set([...(managers||[]),...(kabagList||[])].map(u=>u.username).filter(Boolean))];
  if (!usernames.length) return;

  // Ambil semua subscription untuk usernames tersebut
  const list = usernames.map(u => encodeURIComponent(u)).join(",");
  const subs = await sbGet(`push_subscriptions?username=in.(${list})&select=endpoint,subscription`).catch(()=>[]);
  if (!subs?.length) return;

  const payload = JSON.stringify({ title, body, url, tag });
  for (const row of subs) {
    try {
      await webpush.sendNotification(row.subscription, payload);
    } catch (e) {
      // Subscription kadaluwarsa → hapus
      if (e.statusCode === 404 || e.statusCode === 410) {
        await fetch(`${SUPA_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(row.endpoint)}`, {
          method: "DELETE", headers: H(),
        }).catch(()=>{});
      }
    }
  }
}

// ── Booking code (1 pengajuan = 1 kode untuk banyak slot) ─────
// ── Pengaman halaman publik /pinjamruangan ──────────────────
// Formulir terbuka tanpa login. Tanpa penahan, satu orang bisa mengunci
// banyak slot sekaligus atau membanjiri antrian pengelola. Bersandar pada
// basis data, bukan memori proses, supaya tetap berlaku di instance baru.
const JEDA_KIRIM_MENIT = 10;
const MAKS_PENGAJUAN_AKTIF = 3;

// 0812…, 62812…, dan +62 812… harus dikenali sebagai orang yang sama.
function normalWA(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.slice(0, 2) === "62") d = "0" + d.slice(2);
  else if (d.slice(0, 1) === "8") d = "0" + d;
  return d;
}

async function pastikanTidakSpam(picWA) {
  const wa = normalWA(picWA);
  if (wa.length < 8) return { error: "Nomor WhatsApp PIC tidak valid." };

  // Cocokkan 9 digit terakhir agar tahan beda format penulisan.
  const ekor = wa.slice(-9);
  const rows = await sbGet(
    `room_bookings?pic_wa=like.*${encodeURIComponent(ekor)}*` +
    `&select=created_at,status,booking_code&order=created_at.desc&limit=200`
  );
  if (!rows || !rows.length) return null;

  const terakhir = rows[0]?.created_at ? new Date(rows[0].created_at).getTime() : 0;
  const selisihMenit = (Date.now() - terakhir) / 60000;
  if (terakhir && selisihMenit < JEDA_KIRIM_MENIT) {
    const sisa = Math.max(1, Math.ceil(JEDA_KIRIM_MENIT - selisihMenit));
    return { error: `Pengajuan Anda sebelumnya baru saja masuk. Mohon tunggu ${sisa} menit lagi sebelum mengajukan yang baru.` };
  }

  // Satu pengajuan bisa berisi banyak baris slot, jadi yang dihitung adalah
  // jumlah kode pengajuan yang berbeda — bukan jumlah barisnya.
  const kodeAktif = new Set(
    rows.filter(r => r.status === "Pending").map(r => r.booking_code).filter(Boolean)
  );
  if (kodeAktif.size >= MAKS_PENGAJUAN_AKTIF) {
    return { error: `Masih ada ${kodeAktif.size} pengajuan Anda yang menunggu keputusan. Mohon tunggu sampai diputuskan sebelum mengajukan yang baru.` };
  }
  return null;
}

function genBookingCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// Peran yang boleh memesan ruangan internal dari Generator Undangan — sama
// dengan peran yang dapat membuka generator itu di aplikasi.
const PERAN_PESAN_INTERNAL = ["kabag", "kasubbag_protokol", "staf", "pramu_tamu", "admin_rk", "admin_undangan"];

// ── Session conflict logic ────────────────────────────────────
function conflictSessions(session) {
  if (session === "Pagi")     return ["Pagi", "Full_Day"];
  if (session === "Siang")    return ["Siang", "Full_Day"];
  if (session === "Full_Day") return ["Pagi", "Siang", "Full_Day"];
  return [session];
}

function sessionLabel(s) {
  return s === "Pagi" ? "Pagi (07.30–12.00)"
       : s === "Siang" ? "Siang (12.30–16.30)"
       : s === "Full_Day" ? "Full Day (Seharian)" : s;
}

// ── Auth helper — verifikasi token sesi admin ────────────────
function genToken() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz0123456789";
  let s = "";
  // Acak kriptografis (Math.random dapat ditebak). 58 karakter, bias modulo
  // dihindari dengan menolak bita >= 232 (4 × 58).
  while (s.length < 40) {
    for (const b of globalThis.crypto.getRandomValues(new Uint8Array(48))) {
      if (b < 232 && s.length < 40) s += c[b % c.length];
    }
  }
  return s;
}

// Verifikasi via header Authorization: Bearer <token> (atau X-Admin-Token).
//
// Token diterbitkan oleh op=auth dan disimpan pada tabel `sesi`, BUKAN pada
// tabel `users`. Alasannya: `users` dibaca peramban dengan kunci anon dan
// seluruh barisnya disalin ke localStorage, sehingga selama token tinggal di
// situ, setiap pengguna memegang token sesi semua pengguna lain — cukup untuk
// menyamar sebagai Kabag. Tabel `sesi` tidak dapat dibaca kunci anon sama
// sekali; hanya kunci layanan yang dipakai berkas ini yang bisa.
//
// Butuh SUPABASE_SERVICE_KEY. Dengan kunci anon, pembacaan `sesi` ditolak
// sehingga verifikasi selalu gagal — memang yang diinginkan, tetapi harus
// terbaca sebagai kesalahan konfigurasi, bukan sebagai sesi kedaluwarsa. Jadi
// hanya keadaan "tabel belum ada" yang dibiarkan kembali ke kolom lama;
// penolakan hak akses TIDAK, supaya kekeliruan pemasangan kunci tidak
// menyamar sebagai perbaikan yang berhasil.
async function verifySession(req) {
  const auth = req.headers["authorization"] || "";
  const token = (auth.startsWith("Bearer ") ? auth.slice(7) : "")
    || req.headers["x-admin-token"] || "";
  if (!token) return null;

  let username;
  try {
    const sesi = (await sbGet(
      `sesi?token=eq.${encodeURIComponent(token)}&select=username,kedaluwarsa`
    ))?.[0];
    if (!sesi) return null;
    if (!sesi.kedaluwarsa || new Date(sesi.kedaluwarsa) < new Date()) return null;
    username = sesi.username;
  } catch (e) {
    if (!tabelBelumAda(e)) {
      console.error("verifySession: tabel `sesi` tidak terbaca. Periksa SUPABASE_SERVICE_KEY.", e.message);
      return null;
    }
    // Migrasi belum dijalankan — pakai kolom lama supaya urutan merge dan
    // migrasi tidak menentukan hidup-matinya layar Peminjaman Ruangan & PLH.
    const lama = (await sbGet(
      `users?session_token=eq.${encodeURIComponent(token)}` +
      `&select=username,session_expires`
    ))?.[0];
    if (!lama?.session_expires || new Date(lama.session_expires) < new Date()) return null;
    username = lama.username;
  }

  const u = (await sbGet(
    `users?username=eq.${encodeURIComponent(username)}` +
    `&select=username,nama,role,can_manage_rooms,disabled`
  ))?.[0];
  if (!u || u.disabled) return null;
  return u;
}

// verifyAdmin → khusus peninjau permohonan (Kabag / pengelola ruangan).
async function verifyAdmin(req) {
  const u = await verifySession(req);
  if (!u) return null;
  return (u.role === "kabag" || u.can_manage_rooms) ? u : null;
}

// ── Pemilihan kolom ───────────────────────────────────────────
// Kalender bulanan dapat dibuka siapa saja tanpa login. Yang dibutuhkan
// halaman publik hanyalah "slot ini terpakai atau tidak" — bukan siapa
// peminjamnya, apalagi nomor WhatsApp-nya. Jadi respons tanpa sesi dipangkas
// ke kolom ketersediaan saja; nomor kontak hanya keluar untuk pemegang akun.
const KOLOM_KALENDER_PUBLIK =
  "id,booking_code,room_id,start_date,end_date,session,status";
const KOLOM_KALENDER_INTERNAL =
  "id,booking_code,room_id,start_date,end_date,session,status," +
  "event_name,instansi,pic_name,pic_wa,participant_count,notes,created_at,reviewed_at";

// ── Main handler ──────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { method, query, body } = req;

  try {
    // ?op=kalender → samakan Google Calendar bersama dengan satu jadwal.
    // Dipanggil aplikasi sesudah jadwal disimpan. Isinya dibaca peladen dari
    // basis data, jadi yang dikirim peramban hanya nomor jadwalnya. Selama
    // GOOGLE_CALENDAR_ID belum diisi, jawabannya {nonaktif:true}.
    if (query.op === "kalender" && method === "POST") {
      const pemohon = await verifySession(req);
      if (!pemohon) return res.status(403).json({ error: "Sesi tidak valid — silakan login ulang." });
      const id = body?.id;
      if (id === undefined || id === null || !/^[\w-]{1,40}$/.test(String(id)))
        return res.status(400).json({ error: "Nomor jadwal tidak sah" });
      try {
        return res.status(200).json({ ok: true, ...(await sinkronSatu(String(id))) });
      } catch (e) {
        // Gagal di sini bukan bencana: pencocokan terjadwal akan menambalnya.
        console.error("[kalender] sinkron satu:", e.message);
        return res.status(502).json({ error: "Sinkron kalender gagal", detail: e.message.slice(0, 200) });
      }
    }

    // ── GET ────────────────────────────────────────────────────
    if (method === "GET") {

      // ?op=rooms → list ruangan
      if (query.op === "rooms") {
        const data = await sbGet("rooms?select=*&order=id");
        return res.status(200).json(data);
      }

      // ?admin=1 → admin list (protected)
      if (query.admin === "1") {
        const admin = await verifyAdmin(req);
        if (!admin) return res.status(403).json({ error: "Akses ditolak. Sesi peninjau permohonan tidak valid — silakan login ulang." });

        let filters = "select=*,rooms(name,capacity)";
        if (query.status)  filters += `&status=eq.${query.status}`;
        if (query.room_id) filters += `&room_id=eq.${query.room_id}`;
        if (query.from)    filters += `&start_date=gte.${query.from}`;
        if (query.to)      filters += `&end_date=lte.${query.to}`;

        // Limit dinaikkan: 1 pengajuan kini bisa banyak baris slot.
        // (Filter "sembunyikan terminal lama" dilakukan di sisi klien agar
        //  tidak berisiko membuat seluruh daftar kosong bila PostgREST
        //  menolak ekspresi or=.)
        const rows = await sbGet(`room_bookings?${filters}&order=created_at.desc&limit=1000`);
        return res.status(200).json(rows);
      }

      // ?code=XXX → tracker by booking_code
      if (query.code) {
        const rows = await sbGet(
          `room_bookings?booking_code=eq.${encodeURIComponent(query.code.toUpperCase())}&select=*,rooms(name,capacity)`
        );
        return res.status(200).json(rows);
      }

      // ?pic_wa=XXX → tracker by WA
      // Dulu cocok-substring apa adanya: "0812" pun mengembalikan booking milik
      // orang lain, jadi daftar peminjam bisa disisir sedikit demi sedikit.
      // Sekarang wajib nomor utuh, lalu dicocokkan pada 9 digit terakhir supaya
      // beda format penulisan (0812…/62812…/+62 812…) tetap ketemu.
      if (query.pic_wa) {
        const wa = normalWA(query.pic_wa);
        if (wa.length < 10) {
          return res.status(400).json({
            error: "Masukkan nomor WhatsApp lengkap (contoh: 08123456789), bukan sebagian.",
          });
        }
        const ekor = wa.slice(-9);
        const rows = await sbGet(
          `room_bookings?pic_wa=like.*${encodeURIComponent(ekor)}*` +
          `&select=*,rooms(name,capacity)&order=created_at.desc&limit=20`
        );
        return res.status(200).json(rows);
      }

      // ?month=YYYY-MM → kalender (default: bulan ini)
      const monthStr = query.month || new Date().toISOString().slice(0, 7);
      const [year, month] = monthStr.split("-").map(Number);
      const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay  = new Date(year, month, 0).toISOString().slice(0, 10);

      // Rincian peminjam (termasuk WA PIC) hanya untuk pemegang akun aplikasi.
      const sesi = await verifySession(req);
      const kolom = sesi ? KOLOM_KALENDER_INTERNAL : KOLOM_KALENDER_PUBLIK;

      const rows = await sbGet(
        `room_bookings?select=${kolom},rooms(name,capacity)` +
        `&status=in.(Pending,Approved)` +
        `&start_date=lte.${lastDay}&end_date=gte.${firstDay}` +
        `&order=start_date.asc`
      );
      return res.status(200).json(rows);
    }

    // ── POST — submit pengajuan publik (multi-slot) ────────────
    if (method === "POST") {

      // ── op=request_cancel → pemohon mengajukan pembatalan booking Approved ──
      if (query.op === "request_cancel") {
        const { booking_code, reason } = body || {};
        if (!booking_code) return res.status(400).json({ error: "Kode booking wajib ada" });
        if (!reason || !String(reason).trim())
          return res.status(400).json({ error: "Alasan pembatalan wajib diisi" });
        const code = String(booking_code).toUpperCase();
        const rows = await sbGet(`room_bookings?booking_code=eq.${code}&select=*&order=start_date.asc`);
        if (!rows?.length) return res.status(404).json({ error: "Booking tidak ditemukan" });
        if (rows.some(r => r.status !== "Approved"))
          return res.status(400).json({ error: "Hanya peminjaman yang sudah disetujui yang dapat diajukan pembatalan." });
        const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); // WITA
        const maxEnd = rows.reduce((m, r) => (r.end_date > m ? r.end_date : m), "");
        if (maxEnd && maxEnd < today)
          return res.status(400).json({ error: "Acara sudah berlalu — pembatalan tidak dapat diajukan." });
        if (String(rows[0].notes || "").startsWith("[MINTA BATAL]"))
          return res.status(200).json({ ok: true, already: true, message: "Permintaan pembatalan sudah tercatat & sedang diproses." });

        await sbPatch(`room_bookings?booking_code=eq.${code}`, { notes: "[MINTA BATAL] " + String(reason).trim() });

        const head = rows[0];
        try {
          // WA ke pengelola aktif; Kabag hanya bila tidak ada pengelola.
          // Push ke semua peninjau (termasuk Kabag) tetap dikirim.
          const targets = await peninjauRuangan("cadangan");
          const msg =
            `*[PERMINTAAN PEMBATALAN RUANGAN]*\nKode *${code}* — ${head.event_name}\n` +
            `Instansi: ${head.instansi} · PIC: ${head.pic_name}\n` +
            `Alasan: ${String(reason).trim()}\n\nMohon ditinjau di dashboard peminjaman ruangan.`;
          for (const u of targets) await sendWA(u.noWA, msg, "ruangan_minta_batal", u.role);
          await sendPushToManagers({
            title: `🗑️ Permintaan Pembatalan Ruangan — ${code}`,
            body: `${head.event_name} (${head.instansi}): ${String(reason).trim().slice(0, 100)}`,
            url: "/", tag: `booking-${code}`,
          });
        } catch (_) {}

        return res.status(200).json({ ok: true, booking_code: code });
      }

      // ── op=internal → pemakaian ruangan oleh Prokopim sendiri ──
      // Dipesan dari Generator Undangan ketika undangan Pimpinan memakai Ruang
      // Imbaya/Kenawai. Atas keputusan Kepala Bagian, pemesanan internal
      // LANGSUNG DISETUJUI — tidak melewati antrean Pengelola Ruangan — supaya
      // slotnya seketika tertutup bagi pemohon umum. Bentrokan tetap ditolak:
      // slot yang sudah diajukan atau disetujui pihak lain tidak boleh direbut
      // diam-diam; penyelesaiannya lewat Pengelola Ruangan.
      if (query.op === "internal") {
        const u = await verifySession(req);
        if (!u) return res.status(403).json({ error: "Sesi tidak valid — silakan login ulang." });
        if (!(PERAN_PESAN_INTERNAL.includes(u.role) || u.can_manage_rooms))
          return res.status(403).json({ error: "Peran Anda tidak berwenang memesan ruangan internal." });

        const { room_id, date, session, event_name, participant_count } = body || {};
        const nama = String(event_name || "").trim();
        const peserta = Number(participant_count);
        if (!room_id || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")))
          return res.status(400).json({ error: "Ruangan dan tanggal wajib diisi." });
        if (!["Pagi", "Siang", "Full_Day"].includes(String(session)))
          return res.status(400).json({ error: `Sesi '${session}' tidak valid.` });
        if (!nama) return res.status(400).json({ error: "Nama acara wajib diisi." });
        if (!Number.isInteger(peserta) || peserta < 1)
          return res.status(400).json({ error: "Perkiraan jumlah peserta wajib diisi." });
        const hariIni = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); // WITA
        if (date < hariIni) return res.status(400).json({ error: `Tanggal ${date} sudah lewat.` });

        const room = (await sbGet(`rooms?id=eq.${encodeURIComponent(room_id)}&select=*`))?.[0];
        if (!room) return res.status(400).json({ error: "Ruangan tidak ditemukan." });

        const bentrok = await sbGet(
          `room_bookings?room_id=eq.${room.id}&status=in.(Pending,Approved)` +
          `&start_date=lte.${date}&end_date=gte.${date}` +
          `&session=in.(${conflictSessions(session).join(",")})` +
          `&select=event_name,instansi,session,status`
        );
        if (bentrok?.length) {
          const c = bentrok[0];
          return res.status(409).json({
            error: `${room.name} pada ${date} sesi ${sessionLabel(c.session)} sudah ` +
              `${c.status === "Approved" ? "disetujui" : "diajukan"} untuk "${c.event_name}" (${c.instansi}). ` +
              `Hubungi Pengelola Ruangan untuk penyelesaiannya.`,
          });
        }

        const kontak = (await sbGet(`users?username=eq.${encodeURIComponent(u.username)}&select=noWA`))?.[0];
        const booking_code = genBookingCode();
        await sbPost("room_bookings", [{
          room_id: room.id, start_date: date, end_date: date, session,
          instansi: "Bagian Protokol dan Komunikasi Pimpinan Setda Kota Tarakan",
          pic_name: u.nama || u.username,
          pic_wa: String(kontak?.noWA || "").replace(/\D/g, "") || "-",
          event_name: nama, participant_count: peserta,
          status: "Approved", booking_code,
          notes: "[INTERNAL] Dipesan melalui Generator Undangan",
          reviewed_by: u.nama || u.username, reviewed_at: new Date().toISOString(),
        }]);

        // Sekadar pemberitahuan: tidak ada yang perlu disetujui.
        try {
          await sendPushToManagers({
            title: `🏛️ ${room.name} dipakai internal`,
            body: `${nama} — ${date}, ${sessionLabel(session)} (oleh ${u.nama || u.username})`,
            url: "/", tag: `booking-${booking_code}`,
          });
        } catch (_) {}

        return res.status(201).json({ ok: true, booking_code, room: room.name, date, session });
      }

      // ── op=auth → tukar (username + hash password) dgn token sesi ──
      if (query.op === "auth") {
        const { username, pass } = body || {};
        if (!username || !pass)
          return res.status(400).json({ error: "Username & kredensial wajib diisi." });
        const rows = await sbGet(
          `users?username=eq.${encodeURIComponent(String(username).toLowerCase())}` +
          `&select=username,nama,role,can_manage_rooms,disabled,password`
        );
        const u = rows?.[0];
        if (!u || u.disabled || u.password !== pass)
          return res.status(401).json({ error: "Username atau password salah." });

        // Token diterbitkan untuk semua pemegang akun aktif — dipakai juga oleh
        // kalender ruangan internal agar bisa melihat kontak PIC. Kewenangan
        // meninjau permohonan tetap diperiksa terpisah lewat verifyAdmin().
        const TTL_MS = 12 * 3600 * 1000;
        const token = genToken();
        // Satu akun boleh punya beberapa sesi (HP dan laptop, atau beberapa
        // permintaan yang meminta token bersamaan). Dulu semua sesi lama
        // dihapus di sini, sehingga dua perangkat — bahkan dua permintaan
        // paralel — saling mencabut token dan notifikasi WA gagal diam-diam.
        // Kini hanya yang kedaluwarsa dibuang, dan yang berlaku dibatasi
        // MAKS_SESI terbaru supaya barisnya tidak menumpuk.
        const MAKS_SESI = 5;
        try {
          const ada = await sbGet(
            `sesi?username=eq.${encodeURIComponent(u.username)}` +
            `&select=token,kedaluwarsa&order=kedaluwarsa.desc`
          );
          const kini = Date.now();
          const buang = (ada || [])
            .filter((x, i) => i >= MAKS_SESI - 1 || !x.kedaluwarsa || new Date(x.kedaluwarsa).getTime() < kini)
            .map((x) => x.token)
            .filter((t) => /^[A-Za-z0-9_-]+$/.test(String(t || "")));
          if (buang.length) await sbDelete(`sesi?token=in.(${buang.join(",")})`);
          await sbPost("sesi", {
            token,
            username: u.username,
            kedaluwarsa: new Date(Date.now() + TTL_MS).toISOString(),
          });
        } catch (e) {
          if (!tabelBelumAda(e)) throw e;
          // Migrasi belum dijalankan — terbitkan pada kolom lama seperti
          // sebelumnya. Sekali migrasi berjalan, cabang ini tidak terpakai lagi.
          await sbPatch(`users?username=eq.${encodeURIComponent(u.username)}`, {
            session_token: token,
            session_expires: new Date(Date.now() + TTL_MS).toISOString(),
          });
        }
        return res.status(200).json({
          ok: true, token, ttl_ms: TTL_MS,
          username: u.username, nama: u.nama, role: u.role,
          can_manage_rooms: !!u.can_manage_rooms,
        });
      }

      const {
        room_id, instansi, pic_name, pic_wa, event_name,
        participant_count, srikandi_ref, document_path,
      } = body || {};

      // Slot fleksibel: tiap hari bisa sesi berbeda.
      // Dukung payload baru `slots:[{date,session}]` & lama (start/end/session).
      let slots = Array.isArray(body?.slots) ? body.slots : null;
      if (!slots && body?.start_date && body?.session) {
        slots = [];
        for (let d = new Date(body.start_date + "T00:00:00"),
                 end = new Date((body.end_date || body.start_date) + "T00:00:00");
             d <= end; d.setDate(d.getDate() + 1)) {
          slots.push({ date: d.toISOString().slice(0, 10), session: body.session });
        }
      }

      const required = { room_id, instansi, pic_name, pic_wa, event_name, participant_count };
      for (const [k, v] of Object.entries(required)) {
        if (v === undefined || v === null || v === "")
          return res.status(400).json({ error: `Field '${k}' wajib diisi` });
      }

      // Kolom umpan: tidak terlihat manusia, hanya bot yang mengisinya.
      // Dibalas seolah berhasil agar bot tidak belajar menghindar.
      if (String(body?.website || body?.alamat_web || "").trim()) {
        return res.status(200).json({ ok: true, booking_code: null });
      }
      const spam = await pastikanTidakSpam(pic_wa);
      if (spam) return res.status(429).json(spam);
      if (!slots || !slots.length)
        return res.status(400).json({ error: "Minimal pilih satu tanggal & sesi." });
      if (slots.length > 60)
        return res.status(400).json({ error: "Terlalu banyak slot dalam satu pengajuan." });

      // Validasi tiap slot + cegah duplikat/konflik antar slot di pengajuan ini
      const todayStr = new Date().toISOString().slice(0, 10);
      const seen = new Map(); // date -> sessions[]
      for (const sl of slots) {
        const date = String(sl?.date || "");
        const session = String(sl?.session || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
          return res.status(400).json({ error: "Format tanggal slot tidak valid." });
        if (!["Pagi", "Siang", "Full_Day"].includes(session))
          return res.status(400).json({ error: `Sesi '${session}' tidak valid.` });
        if (date < todayStr)
          return res.status(400).json({ error: `Tanggal ${date} sudah lewat.` });
        const dow = new Date(date + "T00:00:00").getDay();
        if (dow === 0 || dow === 6)
          return res.status(400).json({ error: `${date} jatuh pada Sabtu/Minggu. Pilih hari kerja (Senin–Jumat).` });
        const arr = seen.get(date) || [];
        for (const ex of arr) {
          if (ex === session || ex === "Full_Day" || session === "Full_Day")
            return res.status(400).json({ error: `Sesi bentrok di tanggal ${date} (dalam pengajuan ini).` });
        }
        arr.push(session); seen.set(date, arr);
      }

      const multiSlot = slots.length > 1;
      if (multiSlot && !srikandi_ref && !document_path)
        return res.status(400).json({
          error: "Pengajuan lebih dari 1 slot wajib melampirkan nomor Srikandi atau file surat",
        });
      if (srikandi_ref && !/^\d[\d.]*\/\d[\d.]*\/[^/]+\/\d{4}$/.test(String(srikandi_ref).trim()))
        return res.status(400).json({
          error: "Format nomor Srikandi tidak valid. Gunakan format: nomor/nomor/instansi/tahun (contoh: 005/1234/SETDA/2026)",
        });

      const rooms = await sbGet(`rooms?id=eq.${room_id}&select=*`);
      const room  = rooms?.[0];
      if (!room) return res.status(400).json({ error: "Ruangan tidak ditemukan" });
      if (Number(participant_count) > room.capacity)
        return res.status(400).json({
          error: `Jumlah peserta (${participant_count}) melebihi kapasitas ${room.name} (${room.capacity} orang)`,
        });

      // Cek konflik tiap slot terhadap booking aktif (Pending/Approved)
      for (const sl of slots) {
        const cs = conflictSessions(sl.session);
        const conflicts = await sbGet(
          `room_bookings?room_id=eq.${room_id}&status=in.(Pending,Approved)` +
          `&start_date=lte.${sl.date}&end_date=gte.${sl.date}` +
          `&session=in.(${cs.join(",")})&select=event_name,start_date,session,status`
        );
        if (conflicts?.length) {
          const c = conflicts[0];
          return res.status(409).json({
            error: `Slot ${sl.date} sesi ${sessionLabel(sl.session)} sudah dipesan (${c.event_name} — ${c.status === "Approved" ? "disetujui" : "menunggu"}). Silakan pilih slot lain.`,
          });
        }
      }

      const booking_code = genBookingCode();
      const shared = {
        room_id: Number(room_id), instansi, pic_name,
        pic_wa: String(pic_wa).replace(/\D/g, ""),
        event_name, participant_count: Number(participant_count),
        srikandi_ref: srikandi_ref || null,
        document_path: document_path || null,
        status: "Pending", booking_code,
      };
      const rows = slots.map(sl => ({
        ...shared, start_date: sl.date, end_date: sl.date, session: sl.session,
      }));
      await sbPost("room_bookings", rows);

      const slotLines = slots
        .slice()
        .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
        .map(s => `• ${s.date} — ${sessionLabel(s.session)}`)
        .join("\n");

      // WA ke peninjau permohonan
      const targets = await peninjauRuangan("selalu");
      const adminMsg =
        `*[PENGAJUAN RUANGAN BARU]*\n` +
        `Kode: *${booking_code}*\n` +
        `Ruangan: ${room.name}\nInstansi: ${instansi}\nAcara: ${event_name}\n` +
        `PIC: ${pic_name} (${pic_wa})\nPeserta: ${participant_count} orang\n` +
        `Jadwal (${slots.length} slot):\n${slotLines}\n` +
        (srikandi_ref ? `Srikandi: ${srikandi_ref}\n` : "") +
        `\nSilakan validasi di dashboard Peninjau Permohonan.`;
      for (const u of targets) await sendWA(u.noWA, adminMsg, "ruangan_pengajuan_baru", u.role);

      await sendPushToManagers({
        title: `🏛️ Pengajuan Ruangan Baru — ${room.name}`,
        body: `${event_name} (${instansi}) — ${slots.length} slot`,
        url: "/",
        tag: `booking-${booking_code}`,
      });

      await sendWA(shared.pic_wa,
        `*[PROKOPIM TARAKAN]* Pengajuan peminjaman ruangan diterima.\n\n` +
        `Kode Booking: *${booking_code}*\n` +
        `Ruangan: ${room.name}\nJadwal (${slots.length} slot):\n${slotLines}\n\n` +
        `Cek status: prokopim.tarakankota.go.id/pinjamruangan?cek=${booking_code}\n` +
        `Status saat ini: *Menunggu Konfirmasi*`,
        "ruangan_tanda_terima", "pemohon"
      );

      return res.status(201).json({
        ok: true,
        booking: { booking_code, slots: slots.length },
      });
    }

    // ── PUT — admin update status / set_manager ────────────────
    if (method === "PUT") {

      // ?op=set_plh → tetapkan / cabut Pelaksana Harian
      //
      // Menumpang endpoint ini karena kuota fungsi Vercel Hobby sudah penuh
      // (12/12); tidak ada kaitannya dengan peminjaman ruangan.
      //
      // Memakai verifySession, bukan verifyAdmin: yang berwenang menetapkan
      // adalah Kabag dan Superadmin, sedangkan verifyAdmin justru meloloskan
      // pengelola ruangan yang tidak berwenang atas urusan kepegawaian.
      if (query.op === "set_plh") {
        const pemohon = await verifySession(req);
        if (!pemohon) return res.status(403).json({ error: "Sesi tidak valid — silakan login ulang." });
        if (pemohon.role !== "kabag" && pemohon.role !== "superadmin")
          return res.status(403).json({ error: "Hanya Kabag dan Superadmin yang dapat menetapkan PLH." });

        const { target, plh_untuk, plh_mulai, plh_selesai, plh_dasar } = body || {};
        if (!target) return res.status(400).json({ error: "Field 'target' wajib ada" });

        const tgt = await sbGet(
          `users?username=eq.${encodeURIComponent(target)}&select=username,nama,role,disabled`
        );
        if (!tgt?.length) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
        if (tgt[0].disabled) return res.status(400).json({ error: "Akun tersebut dinonaktifkan." });

        // plh_untuk kosong → pencabutan
        if (!plh_untuk) {
          await sbPatch(`users?username=eq.${encodeURIComponent(target)}`, {
            plh_untuk: null, plh_mulai: null, plh_selesai: null, plh_dasar: null,
          });
          return res.status(200).json({ ok: true, username: target, dicabut: true });
        }

        const salah = periksaPenetapan({
          peranPengampu: tgt[0].role, plh_untuk, plh_mulai, plh_selesai,
        });
        if (salah) return res.status(400).json({ error: salah });

        await sbPatch(`users?username=eq.${encodeURIComponent(target)}`, {
          plh_untuk, plh_mulai, plh_selesai,
          plh_dasar: (plh_dasar || "").trim() || null,
        });
        return res.status(200).json({
          ok: true, username: target, nama: tgt[0].nama,
          plh_untuk, plh_mulai, plh_selesai,
        });
      }

      // ?op=kata_hari_ini → Kabag (atau PLH-nya) menulis/menghapus "Kata-kata
      // Hari Ini" yang tampil di bawah judul halaman bagi seluruh tim.
      // Menumpang endpoint ini karena kuota fungsi Vercel Hobby sudah penuh.
      if (query.op === "kata_hari_ini") {
        const pemohon = await verifySession(req);
        if (!pemohon) return res.status(403).json({ error: "Sesi tidak valid — silakan login ulang." });
        let boleh = pemohon.role === "kabag" || pemohon.role === "superadmin";
        if (!boleh) {
          const plh = (await sbGet(
            `users?username=eq.${encodeURIComponent(pemohon.username)}&select=role,plh_untuk,plh_mulai,plh_selesai`
          ).catch(() => []))?.[0];
          boleh = plhAktif(plh || {})?.untuk === "kabag";
        }
        if (!boleh) return res.status(403).json({ error: "Hanya Kabag (atau PLH Kabag) yang dapat mengubah Kata-kata Hari Ini." });

        const teks = String((body && body.teks) || "").replace(/\s+/g, " ").trim().slice(0, 160);
        const nilai = teks
          ? { teks, oleh: pemohon.username, nama: pemohon.nama || pemohon.username, pada: new Date().toISOString() }
          : null;
        const r = await fetch(`${SUPA_URL}/rest/v1/pengaturan_aplikasi?on_conflict=kunci`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({ kunci: "kata_hari_ini", nilai, diubah_oleh: pemohon.username, diubah_pada: new Date().toISOString() }),
        });
        if (!r.ok) {
          const t = await r.text();
          if (/PGRST205|Could not find the table/i.test(t))
            return res.status(503).json({ error: "Tabel pengaturan belum dibuat — jalankan migrasi 2026-10-10_kata_hari_ini.sql." });
          return res.status(500).json({ error: "Gagal menyimpan: " + t.slice(0, 120) });
        }
        return res.status(200).json({ ok: true, nilai });
      }

      const admin = await verifyAdmin(req);
      if (!admin) return res.status(403).json({ error: "Akses ditolak. Sesi peninjau permohonan tidak valid — silakan login ulang." });

      // ?op=set_manager → kabag tetapkan/cabut hak peninjau permohonan
      if (query.op === "set_manager") {
        if (admin.role !== "kabag")
          return res.status(403).json({ error: "Hanya Kabag yang dapat mengatur peninjau permohonan." });
        const { target, value } = body || {};
        if (!target) return res.status(400).json({ error: "Field 'target' wajib ada" });
        const tgt = await sbGet(`users?username=eq.${encodeURIComponent(target)}&select=username,role,disabled`);
        if (!tgt?.length) return res.status(404).json({ error: "User tidak ditemukan" });
        await sbPatch(`users?username=eq.${encodeURIComponent(target)}`, { can_manage_rooms: !!value });
        // Cabut akses → sekalian akhiri sesi user tsb, supaya token yang sudah
        // dipegangnya tidak tetap berlaku sampai 12 jam ke depan.
        if (!value) {
          await sbDelete(`sesi?username=eq.${encodeURIComponent(target)}`).catch(async (e) => {
            if (!tabelBelumAda(e)) throw e;
            await sbPatch(`users?username=eq.${encodeURIComponent(target)}`,
              { session_token: null, session_expires: null });
          });
        }
        return res.status(200).json({ ok: true, username: target, can_manage_rooms: !!value });
      }

      const { id, booking_code, status, notes } = body || {};
      if (!id && !booking_code)
        return res.status(400).json({ error: "Field 'booking_code' atau 'id' wajib ada" });
      if (!["Approved","Rejected","Cancelled"].includes(status))
        return res.status(400).json({ error: "Status tidak valid" });

      // Ambil seluruh slot dalam grup (1 kode = banyak baris)
      const groupFilter = booking_code
        ? `booking_code=eq.${encodeURIComponent(String(booking_code).toUpperCase())}`
        : null;
      let group;
      if (groupFilter) {
        group = await sbGet(`room_bookings?${groupFilter}&select=*,rooms(name,capacity)&order=start_date.asc`);
      } else {
        const one = await sbGet(`room_bookings?id=eq.${id}&select=booking_code`);
        if (!one?.length) return res.status(404).json({ error: "Booking tidak ditemukan" });
        group = await sbGet(`room_bookings?booking_code=eq.${one[0].booking_code}&select=*,rooms(name,capacity)&order=start_date.asc`);
      }
      if (!group?.length) return res.status(404).json({ error: "Booking tidak ditemukan" });
      const head = group[0];

      // Dasbor yang basi bisa mengirim keputusan untuk pengajuan yang sudah
      // dibatalkan pemohon — slot terkunci lagi dan PIC menerima WA
      // "DISETUJUI" yang keliru. Keputusan atas pengajuan batal ditolak.
      if (group.some(b => b.status === "Cancelled") && status !== "Cancelled")
        return res.status(409).json({ error: "Pengajuan ini sudah dibatalkan. Muat ulang dasbor." });

      // "Tolak Pembatalan (Tetap Disetujui)": booking sudah Approved dan
      // pemohon sedang minta batal. Pemohon diberi kabar khusus, bukan WA
      // "DISETUJUI" ulang yang tidak menyebut permintaan batalnya.
      const sudahDisetujui = group.every(b => b.status === "Approved");
      const tolakPembatalan = status === "Approved" && sudahDisetujui &&
        String(head.notes || "").startsWith("[MINTA BATAL]");

      // Konflik dicek per slot saat menyetujui (abaikan grup sendiri)
      if (status === "Approved") {
        for (const b of group) {
          const cs = conflictSessions(b.session);
          const conflicts = await sbGet(
            `room_bookings?room_id=eq.${b.room_id}&status=eq.Approved` +
            `&start_date=lte.${b.end_date}&end_date=gte.${b.start_date}` +
            `&session=in.(${cs.join(",")})&booking_code=neq.${head.booking_code}` +
            `&select=event_name,start_date,session`
          );
          if (conflicts?.length)
            return res.status(409).json({
              error: `Konflik pada ${b.start_date} sesi ${sessionLabel(b.session)}: "${conflicts[0].event_name}" sudah disetujui.`,
            });
        }
      }

      const updated = await sbPatch(
        `room_bookings?booking_code=eq.${head.booking_code}`,
        { status, notes: notes || null, reviewed_by: admin.nama || admin.username, reviewed_at: new Date().toISOString() }
      );

      const slotLines = group
        .map(b => `• ${b.start_date} — ${sessionLabel(b.session)}`)
        .join("\n");

      const msgs = {
        Approved:
          `*[PROKOPIM TARAKAN]* Permohonan peminjaman Anda *DISETUJUI* ✅\n\n` +
          `Kode: *${head.booking_code}*\n` +
          `Ruangan: ${head.rooms?.name}\nAcara: ${head.event_name}\n` +
          `Jadwal (${group.length} slot):\n${slotLines}\n\n` +
          `Harap datang tepat waktu. Pastikan ruangan dikembalikan bersih dan rapi.`,
        Rejected:
          `*[PROKOPIM TARAKAN]* Permohonan Anda *DITOLAK* ❌\n\n` +
          `Kode: *${head.booking_code}*\n` +
          `Ruangan: ${head.rooms?.name}\nAcara: ${head.event_name}\n` +
          (notes ? `Alasan: ${notes}\n` : "") +
          `\nSilakan ajukan ulang atau hubungi Bagian Prokopim.`,
        Cancelled:
          `*[PROKOPIM TARAKAN]* Peminjaman Anda *DIBATALKAN* oleh peninjau permohonan.\n\n` +
          `Kode: *${head.booking_code}*\n` +
          (notes ? `Keterangan: ${notes}\n` : "") +
          `Hubungi Bagian Prokopim jika ada pertanyaan.`,
      };
      if (tolakPembatalan) {
        msgs.Approved =
          `*[PROKOPIM TARAKAN]* Permintaan pembatalan Anda *tidak dapat dikabulkan*.\n\n` +
          `Kode: *${head.booking_code}*\n` +
          `Ruangan: ${head.rooms?.name}\nAcara: ${head.event_name}\n` +
          `Jadwal (${group.length} slot):\n${slotLines}\n\n` +
          `Peminjaman *tetap berlaku*. Hubungi Bagian Prokopim bila ada pertanyaan.`;
      } else if (status === "Approved" && sudahDisetujui) {
        // Disetujui ulang tanpa perubahan: pemohon sudah menerima WA-nya.
        delete msgs.Approved;
      }
      if (msgs[status] && head.pic_wa)
        await sendWA(head.pic_wa, msgs[status], tolakPembatalan ? "ruangan_batal_ditolak" : "ruangan_keputusan_" + status.toLowerCase(), "pemohon");

      return res.status(200).json({ ok: true, count: group.length, booking_code: head.booking_code });
    }

    // ── DELETE — cancel oleh peminjam (seluruh grup kode) ─────
    if (method === "DELETE") {
      const { code } = query;
      if (!code) return res.status(400).json({ error: "Parameter code wajib ada" });

      const rows = await sbGet(
        `room_bookings?booking_code=eq.${code.toUpperCase()}&select=*&order=start_date.asc`
      );
      if (!rows?.length) return res.status(404).json({ error: "Booking tidak ditemukan atau kode tidak cocok" });

      const booking = rows[0];
      if (rows.some(r => r.status !== "Pending"))
        return res.status(400).json({
          error: `Pengajuan sudah diproses (status '${booking.status}') dan tidak bisa dibatalkan. Hubungi peninjau permohonan.`,
        });

      await sbPatch(`room_bookings?booking_code=eq.${booking.booking_code}`, { status:"Cancelled", notes:"Dibatalkan oleh peminjam" });

      // Cukup push: slot otomatis lepas dan tidak ada yang perlu diputus.
      // Tag yang sama menggantikan push "pengajuan baru" di perangkat.
      await sendPushToManagers({
        title: `🗑️ Pengajuan Ruangan Dibatalkan — ${booking.booking_code}`,
        body: `${booking.event_name} — dibatalkan oleh peminjam (${booking.pic_name})`,
        url: "/", tag: `booking-${booking.booking_code}`,
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
