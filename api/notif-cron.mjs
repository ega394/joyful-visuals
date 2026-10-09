/**
 * api/notif-cron.mjs — Prokopim Notifikasi Harian
 *
 * BEREKSTENSI .mjs — JANGAN dinamai ulang menjadi .js. Berkas ini mengimpor
 * ../src/lib/plh.js yang tetap ESM, sedangkan api/package.json menyatakan
 * "type": "commonjs" sehingga berkas .js di sini ditranspilasi menjadi
 * CommonJS dan impornya berubah menjadi require() terhadap modul ESM —
 * fungsinya mati saat dimuat dengan ERR_REQUIRE_ESM. Keterangan lengkapnya
 * ada di kepala api/room-booking.mjs.
 *
 * Akibatnya di sini lebih sulit disadari daripada di room-booking: cron
 * gagal tanpa seorang pun melihat galat, sehingga pengingat harian berhenti
 * dalam sunyi.
 *
 * PERBAIKAN DUPLIKAT:
 * Sebelumnya WA terkirim 2x karena Vercel kadang menjalankan cron
 * lebih dari sekali (retry otomatis). Fix: sebelum kirim, cek tabel
 * `notif_daily_log` apakah notif jenis ini sudah terkirim hari ini.
 * Jika sudah → skip. Jika belum → kirim + catat ke log.
 *
 * JADWAL CRON (vercel.json, dalam UTC; paket Hobby → bisa meleset ≤1 jam):
 *   type=pimpinan  → "30 22 * * *"  = 06:30 WITA  briefing WK & WWK (WA)
 *   type=pagi      → "30 23 * * *"  = 07:30 WITA  rekap hari ini: ajudan (WA), Kabag & Kasubbag (push)
 *   type=ajudan    → "0 8 * * *"    = 16:00 WITA  agenda besok untuk ajudan (WA)
 *   type=pending   → "0 8 * * *"    = 16:00 WITA  ringkasan sore: SATU WA per pejabat
 *   type=reminder  → tidak terjadwal lagi; isinya kini bagian ringkasan sore
 *
 * HEMAT KUOTA FONNTE (audit Oktober 2026):
 *   - Kabag & Kasubbag tidak lagi menerima rekap pagi lewat WA (cukup push):
 *     isinya jadwal yang mereka verifikasi dan setujui sendiri.
 *   - Pengingat 15:55 dan 16:00 digabung: setiap nomor menerima paling banyak
 *     satu WA sore, dan hanya bila ada yang perlu ditindaklanjuti.
 *   - Setiap WA dicatat ke tabel wa_log (tanpa nomor/isi) — lihat _walog.js.
 */

import webpush from "web-push";
// Satu sumber aturan PLH untuk peramban maupun peladen.
import { plhAktif, hariIniWita } from "../src/lib/plh.js";
import { kalenderAktif, rekonsiliasi } from "./_kalender.mjs";
// CommonJS (lihat kepala _walog.js) — impor bawaan, lalu ambil fungsinya.
import walog from "./_walog.js";
const { catatWA, hasilFonnte } = walog;

const SUPA_URL  = process.env.SUPABASE_URL  || process.env.VITE_SUPABASE_URL;
const SUPA_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const FONNTE    = process.env.FONNTE_TOKEN;
const CRON_SEC  = process.env.CRON_SECRET;

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const VAPID_EMAIL   = process.env.VAPID_EMAIL || "mailto:prokopim@tarakankota.go.id";

// ── Helper Supabase ──────────────────────────────────────────
const H = () => ({
  "Content-Type":  "application/json",
  "apikey":        SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
});

async function sbGet(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: H() });
  if (!r.ok) return null;
  return r.json();
}

// ── Push ke PWA ──────────────────────────────────────────────
// Cron sebelumnya hanya bisa mengirim WhatsApp, sehingga pengingat antrian
// persetujuan tidak pernah sampai sebagai notifikasi PWA. Push dikirim
// langsung dari sini (bukan lewat /api/webpush) supaya tidak perlu tahu URL
// absolut deployment dan tidak melewati gerbang autentikasi endpoint itu.
function pushSiap() {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  try {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
    return true;
  } catch (e) { console.warn("[PUSH] VAPID tidak valid:", e.message); return false; }
}

// ── Pelaksana Harian (PLH) ────────────────────────────────────
// Penerima pengingat BERTAMBAH, bukan berpindah: aplikasi mengetahui jabatan
// apa yang sedang diampu, tetapi tidak mengetahui pejabat mana yang sedang
// cuti — apalagi bila pemangku jabatan itu lebih dari satu orang. Lebih baik
// pengingat sampai ke dua orang daripada tidak sampai sama sekali.

// Bersandar pada plhAktif() supaya aturan masa berlakunya sama persis dengan
// yang dipakai peramban — bukan disalin ulang di sini.
function sedangMengampu(u, role) {
  return plhAktif(u)?.untuk === role;
}

/** Pemegang jabatan `role` hari ini: pemangku aslinya dan PLH yang mengampunya. */
function penerimaJabatan(users, role) {
  return (users || []).filter(u => u.noWA && (u.role === role || sedangMengampu(u, role)));
}

async function pengampuJabatan(role) {
  const hari = hariIniWita();
  try {
    return await sbGet(
      `users?plh_untuk=eq.${encodeURIComponent(role)}` +
      `&plh_mulai=lte.${hari}&plh_selesai=gte.${hari}` +
      // not.is.true, bukan is.false: baris lama yang `disabled`-nya NULL juga
      // pengguna aktif, dan is.false membuangnya.
      `&disabled=not.is.true&select=username,nama,noWA`
    ) || [];
  } catch { return []; }   // kolom PLH belum ada → berjalan seperti semula
}

async function sendPushRole(role, { title, body, url, tag }) {
  if (!pushSiap()) return 0;
  const [byRole, plh] = await Promise.all([
    sbGet(`push_subscriptions?select=endpoint,subscription&role=eq.${encodeURIComponent(role)}`),
    pengampuJabatan(role),
  ]);
  let subs = byRole || [];
  if (plh.length) {
    const daftar = plh.map(u => encodeURIComponent(u.username)).join(",");
    const tambahan = await sbGet(
      `push_subscriptions?select=endpoint,subscription&username=in.(${daftar})`
    ).catch(() => []);
    // Satu perangkat bisa terjaring dua kali bila peran aslinya kebetulan sama.
    const sudah = new Set(subs.map(r => r.endpoint));
    for (const r of (tambahan || [])) if (!sudah.has(r.endpoint)) { sudah.add(r.endpoint); subs.push(r); }
  }
  if (!subs.length) return 0;

  const payload = JSON.stringify({ title, body, url: url || "/", tag: tag || "prokopim" });
  let terkirim = 0;
  await Promise.all(subs.map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, payload);
      terkirim++;
    } catch (e) {
      // Langganan kedaluwarsa → bersihkan agar tidak dicoba terus
      if (e.statusCode === 410 || e.statusCode === 404) {
        const ep = row.subscription?.endpoint;
        if (ep) await fetch(
          `${SUPA_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(ep)}`,
          { method: "DELETE", headers: H() }
        ).catch(() => {});
      }
    }
  }));
  console.log(`[PUSH] ${role}: ${terkirim}/${subs.length} terkirim — ${title}`);
  return terkirim;
}

// ── DEDUPLICATION: cek & catat log harian ───────────────────
/**
 * Kembalikan true jika notif jenis `type` sudah terkirim hari ini (WITA).
 * Jika belum, langsung INSERT ke log dan kembalikan false.
 */
async function isDuplicate(type) {
  // Tanggal hari ini dalam zona WITA (UTC+8)
  const nowWITA = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const todayStr = nowWITA.toISOString().slice(0, 10); // "YYYY-MM-DD"

  try {
    // Cek apakah sudah ada record hari ini untuk type ini
    const existing = await sbGet(
      `notif_daily_log?select=id&notif_type=eq.${type}&notif_date=eq.${todayStr}&limit=1`
    );

    if (existing && existing.length > 0) {
      console.log(`[DEDUP] ${type} sudah terkirim hari ini (${todayStr}), skip.`);
      return true; // duplikat — jangan kirim
    }

    // Belum ada → INSERT ke log SEKARANG (sebelum kirim, untuk lock).
    // Dengan indeks unik (notif_type, notif_date) dari migrasi 2026-10-10,
    // dua jalannya cron yang berbarengan tidak bisa sama-sama lolos: yang
    // kalah mendapat 0 baris kembali dan dianggap duplikat.
    const r = await fetch(`${SUPA_URL}/rest/v1/notif_daily_log?on_conflict=notif_type,notif_date`, {
      method: "POST",
      headers: {
        ...H(),
        "Prefer": "resolution=ignore-duplicates,return=representation",
      },
      body: JSON.stringify({
        notif_type: type,
        notif_date: todayStr,
        sent_at:    new Date().toISOString(),
      }),
    });
    if (r.ok) {
      const baris = await r.json().catch(() => null);
      if (Array.isArray(baris) && baris.length === 0) {
        console.log(`[DEDUP] ${type} sedang/sudah dikirim jalannya cron lain, skip.`);
        return true;
      }
    }

    return false; // bukan duplikat — lanjut kirim
  } catch (err) {
    // Jika tabel belum ada atau error lain → tetap lanjut kirim
    // (jangan blokir notif hanya karena tabel log belum dibuat)
    console.warn(`[DEDUP] Error cek log:`, err?.message || err);
    return false;
  }
}

// ── Helper: kirim WA via Fonnte ──────────────────────────────
// `jenis` dan `peran` hanya untuk wa_log (tanpa nomor/isi pesan).
async function sendWA(to, message, jenis = "cron", peran = "") {
  if (!FONNTE || !to) return false;
  try {
    const r = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        "Authorization": FONNTE,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ target: to, message, countryCode: "62" }),
    });
    const h = await hasilFonnte(r);
    await catatWA({ jenis, sumber: "cron", peran, berhasil: h.ok,
                    catatan: h.ok ? null : JSON.stringify(h.detail || {}).slice(0, 200) });
    return h.ok;
  } catch (err) {
    console.error(`[WA] Gagal kirim (${jenis}):`, err?.message || err);
    await catatWA({ jenis, sumber: "cron", peran, berhasil: false, catatan: err?.message });
    return false;
  }
}

// "08xx" / "+62 8xx" / "628xx" → "628xx", untuk mengenali nomor yang sama.
function normalNomor(n) {
  return String(n || "").trim().replace(/^\+/, "").replace(/^0/, "62").replace(/\D/g, "");
}

/** Satu orang per nomor: dua akun dengan nomor sama hanya dikirimi sekali. */
function unikNomor(list) {
  const sudah = new Set();
  return (list || []).filter(u => {
    const k = normalNomor(u.noWA);
    if (k.length < 10 || sudah.has(k)) return false;
    sudah.add(k);
    return true;
  });
}

// Urut jam tanpa galat bila ada agenda tanpa jam (dulu melempar TypeError,
// dan rekap hari itu gagal diam-diam setelah kunci dedup tertulis).
const urutJam = (a, b) => ((a.tanggal || "") + (a.jam || "")).localeCompare((b.tanggal || "") + (b.jam || ""));

// ── Formatter tanggal ────────────────────────────────────────
const HARI  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const BULAN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function fmtTgl(str) {
  if (!str) return str;
  // Baca komponen tanggal dalam UTC agar konsisten dengan input (YYYY-MM-DD)
  // dan tidak bergantung zona waktu server (Vercel = UTC). Memakai +08:00 lalu
  // getDate() membuat tanggal mundur 1 hari.
  const d = new Date(str + "T00:00:00Z");
  return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}`;
}

function localDateWITA(offsetDays = 0) {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

// ── Waktu agenda ─────────────────────────────────────────────
// `jamSelesai` bersifat opsional dan tidak dimiliki agenda lama, jadi rentang
// hanya ditampilkan bila terisi dan lebih besar dari jam mulai.
function _mnt(t) {
  const [h, m] = String(t || "").split(":").map(Number);
  return (h * 60 + m) || 0;
}
function fmtRentangJam(e) {
  const mulai = (e && e.jam ? e.jam : "").slice(0, 5);
  if (!mulai) return "";
  const selesai = (e && e.jamSelesai ? e.jamSelesai : "").slice(0, 5);
  return selesai && _mnt(selesai) > _mnt(mulai) ? `${mulai} – ${selesai}` : mulai;
}

// ── Load data dari Supabase ──────────────────────────────────
// Penyaringan tanggal & alur didorong ke query. Sebelumnya seluruh tabel
// ditarik lalu disaring di sini — 5x sehari, padahal yang dipakai hanya
// jadwal hari ini/besok. Ikut menekan egress Supabase.
async function loadJadwal() {
  const today = localDateWITA(0);
  const rows = await sbGet(
    `jadwal?select=data&data->>alur=eq.disetujui&data->>tanggal=gte.${today}&order=id`
  );
  if (!rows) return [];
  return rows
    .map(r => r.data)
    .filter(e => e && e.alur === "disetujui" && e.tanggal >= today);
}

// Versi untuk pending-approval (semua alur, jadwal aktif belum lewat)
async function loadJadwalPending() {
  const today = localDateWITA(0);
  const rows = await sbGet(
    `jadwal?select=data&data->>alur=in.(menunggu_kasubbag,menunggu_kabag,ditolak)&data->>tanggal=gte.${today}&order=id`
  );
  if (!rows) return [];
  return rows
    .map(r => r.data)
    .filter(e =>
      e &&
      // "ditolak" = dikembalikan ke Admin RK untuk diperbaiki. Bagi Admin RK
      // inilah padanan "menunggu tindakan", karena ia tidak menyetujui apa pun.
      ["menunggu_kasubbag", "menunggu_kabag", "ditolak"].includes(e.alur) &&
      e.tanggal >= today
    );
}

// Usulan perubahan jadwal yang SUDAH terbit. Jadwalnya tetap ber-alur
// "disetujui", jadi tidak terjaring loadJadwalPending() di atas dan perlu
// query tersendiri agar tidak mengendap tanpa pengingat.
async function loadUsulanEdit() {
  const today = localDateWITA(0);
  const rows = await sbGet(
    `jadwal?select=data&data->>alur=eq.disetujui&data->>tanggal=gte.${today}&order=id`
  );
  if (!rows) return [];
  return rows
    .map(r => r.data)
    .filter(e =>
      e &&
      ["menunggu_kasubbag", "menunggu_kabag"].includes(e.alurEdit) &&
      e.tanggal >= today
    );
}

async function loadUsers() {
  // Kolom PLH baru ada setelah migrasi dijalankan, sedangkan deploy selalu
  // mendahului migrasi. Tanpa penahan ini, seluruh pengingat terjadwal mati
  // sampai migrasinya dijalankan.
  // Akun nonaktif tidak dikirimi apa pun. `not.is.true`, bukan `is.false`:
  // baris lama yang kolom disabled-nya NULL tetap pengguna aktif.
  const rows = await sbGet(`users?select=username,nama,jabatan,role,noWA,plh_untuk,plh_mulai,plh_selesai,disabled&disabled=not.is.true`)
    || await sbGet(`users?select=username,nama,jabatan,role,noWA`);
  return (rows || []).filter(u => !u.disabled);
}

// ── Tipe notifikasi ──────────────────────────────────────────

// Agenda yang dihadiri pimpinan tertentu (WK, atau WWK termasuk delegasi WK).
function untukPimpinanIni(e, kunci) {
  return kunci === "walikota"
    ? (e.untukPimpinan || []).includes("walikota")
    : (e.untukPimpinan || []).includes("wakilwalikota") || !!e.delegasiKeWWK;
}

// Label status kehadiran singkat untuk rekap ajudan.
function labelStatus(e, kunci) {
  if (kunci === "walikota" && e.delegasiKeWWK) return "↩️ Didelegasikan ke WWK";
  const st = kunci === "walikota" ? e.statusWK : e.statusWWK;
  if (st === "hadir") return "✅ Hadir";
  if (st === "tidak_hadir") return "❌ Tidak hadir";
  if (st === "diwakilkan") return "↩️ Diwakilkan";
  return "⏳ Belum dikonfirmasi";
}

const AJUDAN = [
  { role: "ajudan_walikota",      kunci: "walikota",      label: "Wali Kota" },
  { role: "ajudan_wakilwalikota", kunci: "wakilwalikota", label: "Wakil Wali Kota" },
];

/**
 * PAGI (07:30 WITA) — rekap agenda HARI INI
 *   Ajudan WK/WWK → WA, hanya agenda pimpinannya (bagi mereka inilah satu-
 *     satunya kabar terjadwal untuk jadwal yang disetujui setelah 16:00 kemarin).
 *   Kabag & Kasubbag → push saja: isinya jadwal yang mereka verifikasi dan
 *     setujui sendiri, dan dasbor aplikasi sudah menampilkannya.
 */
async function notifPagi(jadwal, users) {
  const today    = localDateWITA(0);
  const todayEvs = jadwal.filter(e => e.tanggal === today).sort(urutJam);

  if (todayEvs.length === 0) {
    console.log("[PAGI] Tidak ada agenda hari ini, skip.");
    return;
  }

  for (const a of AJUDAN) {
    const myEvs = todayEvs.filter(e => untukPimpinanIni(e, a.kunci));
    if (myEvs.length === 0) continue;
    const daftar = myEvs.map(e =>
      `🕐 ${fmtRentangJam(e)} — *${e.namaAcara}*\n📍 ${e.lokasi || e.penyelenggara || "-"}\n${labelStatus(e, a.kunci)}`
    ).join("\n\n");
    const msg =
      `📋 *Agenda ${a.label} Hari Ini*\n` +
      `${fmtTgl(today)} | ${myEvs.length} kegiatan\n\n` +
      daftar +
      `\n\n_Prokopim Kota Tarakan_`;
    for (const u of unikNomor(users.filter(u => u.role === a.role && u.noWA))) {
      await sendWA(u.noWA, msg, "rekap_pagi_ajudan", a.role);
      console.log(`[PAGI] Terkirim → ${u.nama} (${a.role})`);
    }
  }

  const tanpaPetugas = todayEvs.filter(e => !(e.personil || []).length).length;
  const belumKonfirmasi = todayEvs.filter(e =>
    (untukPimpinanIni(e, "walikota") && !e.statusWK && !e.delegasiKeWWK) ||
    (untukPimpinanIni(e, "wakilwalikota") && !e.statusWWK)
  ).length;
  const tambahan = [
    tanpaPetugas ? `${tanpaPetugas} tanpa petugas` : "",
    belumKonfirmasi ? `${belumKonfirmasi} belum dikonfirmasi kehadirannya` : "",
  ].filter(Boolean).join(" · ");
  for (const r of ["kabag", "kasubbag_protokol", "kasubbag_komdokpim"]) {
    await sendPushRole(r, {
      title: `📋 ${todayEvs.length} agenda hari ini`,
      body: (todayEvs[0] ? `Pertama ${fmtRentangJam(todayEvs[0])} ${todayEvs[0].namaAcara}` : "") +
            (tambahan ? ` · ${tambahan}` : ""),
      url: "/", tag: "rekap-pagi",
    });
  }
}

/**
 * REMINDER — tidak dikirim tersendiri lagi. "Agenda besok tanpa petugas"
 * kini menjadi bagian ringkasan sore (type=pending), supaya Kasubbag tidak
 * menerima dua sampai tiga WA dalam lima menit. Tetap dijawab untuk
 * pemanggilan manual atau jadwal cron lama yang belum terhapus.
 */
async function notifReminder() {
  console.log("[REMINDER] Digabung ke ringkasan sore (type=pending) — skip.");
}

/**
 * AJUDAN (16:00 WITA) — rekap agenda BESOK + minta konfirmasi kehadiran
 * Penerima: Ajudan WK & Ajudan WWK, masing-masing agenda pimpinannya saja.
 */
async function notifAjudan(jadwal, users) {
  const tomorrow = localDateWITA(1);
  const tmrwEvs  = jadwal.filter(e => e.tanggal === tomorrow).sort(urutJam);

  for (const a of AJUDAN) {
    const myEvs = tmrwEvs.filter(e => untukPimpinanIni(e, a.kunci));
    if (myEvs.length === 0) continue;

    const daftar = myEvs.map(e =>
      `🕐 ${fmtRentangJam(e)} — *${e.namaAcara}*\n📍 ${e.lokasi || e.penyelenggara || "-"}\n👔 ${e.pakaian || "-"}\n${labelStatus(e, a.kunci)}`
    ).join("\n\n");
    const belum = myEvs.filter(e => labelStatus(e, a.kunci).startsWith("⏳")).length;

    const msg =
      `📅 *Agenda ${a.label}*\n` +
      `${fmtTgl(tomorrow)} | ${myEvs.length} kegiatan\n\n` +
      daftar +
      (belum ? `\n\nMohon konfirmasi kehadiran ${a.label} (${belum} agenda) melalui aplikasi Prokopim.` : "") +
      `\n_Prokopim Kota Tarakan_`;

    for (const u of unikNomor(users.filter(u => u.role === a.role && u.noWA))) {
      await sendWA(u.noWA, msg, "rekap_ajudan_besok", a.role);
      console.log(`[AJUDAN] Terkirim → ${u.nama}`);
    }
  }
}

/**
 * PIMPINAN (06:30 WITA) — briefing agenda HARI INI langsung ke pimpinan
 * Penerima: Wali Kota & Wakil Wali Kota (nomor pribadi)
 * Nada ringan, informatif, tanpa perlu dibalas.
 */
async function notifPimpinan(jadwal, users) {
  const today    = localDateWITA(0);
  const todayEvs = jadwal
    .filter(e => e.tanggal === today)
    .sort((a, b) => (a.jam || "").localeCompare(b.jam || ""));

  const FOOTER =
    `\n━━━━━━━━━━━━━━\n` +
    `🤖 Pesan ini dikirim secara otomatis dan tidak perlu dibalas\n` +
    `📌 Jadwal secara realtime dapat diakses di aplikasi *#ProkopimHibot*`;
  const FOOTER_ADA = FOOTER;
  const FOOTER_KOSONG = FOOTER;

  // Format satu baris kegiatan: waktu, nama, lokasi, pakaian (+ tanda sambutan)
  const fmtItem = (e) => {
    const jam   = fmtRentangJam(e);
    const isSambutan = e.jenisKegiatan === "Sambutan" || e.jenisKegiatan === "Sambutan membuka acara";
    let s = `🕐 ${jam} · *${e.namaAcara}*\n   📍 ${e.lokasi || e.penyelenggara || "-"}\n   👔 ${e.pakaian || "-"}`;
    if (isSambutan) s += " · 🎤 Ada sambutan";
    return s;
  };

  const pimpinanList = [
    { role: "walikota",      key: "walikota",      sapaan: "Bapak Wali Kota",       label: "Wali Kota",
      statusF: "statusWK",  wakilF: "perwakilanWK" },
    { role: "wakilwalikota", key: "wakilwalikota", sapaan: "Bapak Wakil Wali Kota", label: "Wakil Wali Kota",
      statusF: "statusWWK", wakilF: "perwakilanWWK" },
  ];

  for (const p of pimpinanList) {
    const orang = unikNomor(users.filter(u => u.role === p.role && u.noWA));
    if (orang.length === 0) continue;

    const myEvs = todayEvs.filter(e =>
      p.key === "walikota"
        ? (e.untukPimpinan || []).includes("walikota")
        : (e.untukPimpinan || []).includes("wakilwalikota") || e.delegasiKeWWK
    );

    // Kelompokkan: Dihadiri Langsung / Diwakilkan / Menunggu Konfirmasi.
    // "Tidak Hadir" sengaja tidak ditampilkan pada briefing pimpinan.
    const hadir = [], wakil = [], nunggu = [];
    for (const e of myEvs) {
      const status = e[p.statusF];
      let diwakilkanKe = null;
      if (p.key === "walikota" && e.delegasiKeWWK) diwakilkanKe = "Wakil Wali Kota";
      else if (p.key === "wakilwalikota" && e.delegasiWWKJajaran) diwakilkanKe = e.perwakilanWWK || "pejabat yang ditunjuk";
      else if (status === "diwakilkan") diwakilkanKe = e[p.wakilF] || "pejabat yang ditunjuk";

      if (diwakilkanKe) wakil.push({ e, ke: diwakilkanKe });
      else if (status === "hadir") hadir.push(e);
      else if (status === "tidak_hadir") { /* tidak ditampilkan */ }
      else nunggu.push(e); // belum dikonfirmasi
    }

    let msg;
    if (myEvs.length === 0) {
      msg =
        `🌅 *Selamat Pagi, ${p.sapaan}*\n\n` +
        `Tidak ada agenda resmi terjadwal hari ini.` +
        FOOTER_KOSONG;
    } else {
      let body = `🌅 *Selamat Pagi, ${p.sapaan}*\n\nAgenda ${p.label} hari ini — ${fmtTgl(today)}:\n`;
      if (hadir.length) {
        body += `\n✅ *Dihadiri Langsung* (${hadir.length})\n` + hadir.map(fmtItem).join("\n");
      }
      if (wakil.length) {
        body += `\n\n👥 *Diwakilkan* (${wakil.length})\n` +
          wakil.map(w => fmtItem(w.e) + `\n   ↩️ Diwakilkan kepada: *${w.ke}*`).join("\n");
      }
      if (nunggu.length) {
        body += `\n\n🕓 *Menunggu Konfirmasi* (${nunggu.length})\n` + nunggu.map(fmtItem).join("\n");
      }
      if (!hadir.length && !wakil.length && !nunggu.length) {
        body += `\nTidak ada agenda yang memerlukan perhatian Bapak hari ini.`;
      }
      msg = body + FOOTER_ADA;
    }

    for (const u of orang) {
      await sendWA(u.noWA, msg, "briefing_pimpinan", p.role);
      console.log(`[PIMPINAN] Terkirim → ${u.nama} (${p.role})`);
    }
  }
}

/**
 * PERSONIL — DINONAKTIFKAN (notifikasi penugasan dimatikan global)
 */
async function notifPersonil() {
  console.log("[PERSONIL] Notifikasi penugasan dinonaktifkan — skip.");
}

// Agenda yang semua pimpinan tujuannya sudah menyatakan tidak hadir tidak
// perlu dikejar petugasnya (dulu memicu alarm palsu "belum ada personil").
function semuaPimpinanAbsen(e) {
  const tuju = [];
  if (untukPimpinanIni(e, "walikota") && !e.delegasiKeWWK) tuju.push(e.statusWK);
  if (untukPimpinanIni(e, "wakilwalikota")) tuju.push(e.statusWWK);
  return tuju.length > 0 && tuju.every(st => st === "tidak_hadir");
}

/**
 * RINGKASAN SORE (16:00 WITA) — SATU WA per pejabat, hanya bila ada isinya.
 *
 *   Kasubbag Protokol (+PLH): agenda besok tanpa petugas, antrian verifikasi,
 *                             usulan perubahan, permintaan pembatalan.
 *   Kasubbag Komdokpim (+PLH): agenda besok tanpa petugas saja — mereka tidak
 *                             memutus antrian verifikasi.
 *   Kabag (+PLH):             persetujuan akhir, usulan perubahan, pembatalan.
 *
 * Seseorang yang memegang dua jabatan (mis. Kasubbag yang sedang PLH Kabag)
 * tetap menerima satu pesan berisi kedua bagian. Dikirim juga pada akhir
 * pekan, karena banyak agenda pimpinan jatuh pada Sabtu/Minggu.
 */
async function notifPendingApproval(users, jadwal) {
  const [pendings, usulans] = await Promise.all([loadJadwalPending(), loadUsulanEdit()]);
  const besok = localDateWITA(1);

  const fmtItem = (e) =>
    `• ${fmtTgl(e.tanggal)} ${fmtRentangJam(e)} — *${e.namaAcara}*\n   📍 ${e.lokasi || e.penyelenggara || "-"}`;

  const daftar = {
    tanpaPetugas: (jadwal || []).filter(e => e.tanggal === besok && !(e.personil || []).length && !semuaPimpinanAbsen(e)).sort(urutJam),
    verifikasi:   pendings.filter(e => e.alur === "menunggu_kasubbag").sort(urutJam),
    akhir:        pendings.filter(e => e.alur === "menunggu_kabag").sort(urutJam),
    usulKasubbag: usulans.filter(e => e.alurEdit === "menunggu_kasubbag").sort(urutJam),
    usulKabag:    usulans.filter(e => e.alurEdit === "menunggu_kabag").sort(urutJam),
    batalKasubbag: (jadwal || []).filter(e => e.alurHapus === "menunggu_kasubbag").sort(urutJam),
    batalKabag:    (jadwal || []).filter(e => e.alurHapus === "menunggu_kabag").sort(urutJam),
  };

  // Urutan bagian = urutan kepentingan; yang paling mendesak paling atas.
  const BAGIAN = {
    kasubbag_protokol: [
      ["tanpaPetugas", `⚠️ *Agenda besok (${fmtTgl(besok)}) belum ada petugas*`],
      ["verifikasi",   "⏰ *Menunggu verifikasi Anda*"],
      ["batalKasubbag","🗑️ *Permintaan pembatalan*"],
      ["usulKasubbag", "✏️ *Usulan perubahan jadwal*"],
    ],
    kasubbag_komdokpim: [
      ["tanpaPetugas", `⚠️ *Agenda besok (${fmtTgl(besok)}) belum ada petugas*`],
    ],
    kabag: [
      ["akhir",        "⏰ *Menunggu persetujuan akhir Anda*"],
      ["batalKabag",   "🗑️ *Permintaan pembatalan*"],
      ["usulKabag",    "✏️ *Usulan perubahan jadwal*"],
    ],
  };

  // Kumpulkan bagian per nomor (satu orang bisa memegang beberapa jabatan).
  const perNomor = new Map();
  for (const [role, bagian] of Object.entries(BAGIAN)) {
    for (const u of penerimaJabatan(users, role)) {
      const k = normalNomor(u.noWA);
      if (k.length < 10) continue;
      const isi = perNomor.get(k) || { u, peran: [], bagian: [] };
      if (!isi.peran.includes(role)) isi.peran.push(role);
      for (const [kunci, judul] of bagian) {
        if (daftar[kunci].length && !isi.bagian.some(b => b.kunci === kunci)) isi.bagian.push({ kunci, judul });
      }
      perNomor.set(k, isi);
    }
  }

  for (const { u, peran, bagian } of perNomor.values()) {
    if (!bagian.length) continue;
    const isiPesan = bagian.map(b =>
      `${b.judul} (${daftar[b.kunci].length})\n` + daftar[b.kunci].map(fmtItem).join("\n")
    ).join("\n\n");
    const msg =
      `🗓️ *Ringkasan Sore Prokopim*\n` +
      `${fmtTgl(localDateWITA(0))}\n\n` +
      isiPesan +
      `\n\nMohon ditindaklanjuti melalui aplikasi Prokopim.\n_Prokopim Kota Tarakan_`;
    await sendWA(u.noWA, msg, "ringkasan_sore", peran.join("+"));
    console.log(`[RINGKASAN] Terkirim → ${u.nama} (${peran.join("+")}: ${bagian.map(b => b.kunci).join(",")})`);
  }

  // Push tetap per jabatan (gratis; ikut sampai ke PLH lewat sendPushRole).
  const hitung = (kunci) => daftar[kunci].length;
  const pushKasubbag = [
    hitung("tanpaPetugas") && `${hitung("tanpaPetugas")} agenda besok tanpa petugas`,
    hitung("verifikasi") && `${hitung("verifikasi")} menunggu verifikasi`,
    hitung("batalKasubbag") && `${hitung("batalKasubbag")} permintaan batal`,
    hitung("usulKasubbag") && `${hitung("usulKasubbag")} usulan perubahan`,
  ].filter(Boolean).join(" · ");
  if (pushKasubbag) await sendPushRole("kasubbag_protokol", { title: "🗓️ Ringkasan Sore", body: pushKasubbag, url: "/", tag: "ringkasan-sore" });
  if (hitung("tanpaPetugas")) await sendPushRole("kasubbag_komdokpim", { title: "⚠️ Agenda Besok Tanpa Petugas", body: `${hitung("tanpaPetugas")} agenda besok belum ada petugas`, url: "/", tag: "ringkasan-sore" });
  const pushKabag = [
    hitung("akhir") && `${hitung("akhir")} menunggu persetujuan akhir`,
    hitung("batalKabag") && `${hitung("batalKabag")} permintaan batal`,
    hitung("usulKabag") && `${hitung("usulKabag")} usulan perubahan`,
  ].filter(Boolean).join(" · ");
  if (pushKabag) await sendPushRole("kabag", { title: "🗓️ Ringkasan Sore", body: pushKabag, url: "/", tag: "ringkasan-sore" });

  // Admin RK — jadwal yang dikembalikan & belum diperbaiki (push saja).
  const pendRevisi = pendings.filter(e => e.alur === "ditolak");
  if (pendRevisi.length > 0) {
    await sendPushRole("admin_rk", {
      title: "↩ Jadwal Menunggu Perbaikan",
      body: `${pendRevisi.length} jadwal dikembalikan & belum diperbaiki`,
      url: "/", tag: "pending-revisi",
    });
  }
}

// ── MAIN HANDLER ─────────────────────────────────────────────
export default async function handler(req, res) {
  // Gerbang: bila CRON_SECRET diisi, Vercel Cron otomatis mengirimkannya
  // sebagai "Authorization: Bearer <CRON_SECRET>", jadi hanya itu yang
  // diterima. Header x-vercel-cron dapat dipalsukan siapa saja, sehingga
  // hanya dipercaya bila CRON_SECRET belum diisi (perilaku lama).
  const authHeader = req.headers["authorization"] || "";
  const secret     = authHeader.replace("Bearer ", "").trim();
  const sah = CRON_SEC ? secret === CRON_SEC : req.headers["x-vercel-cron"] === "1";
  if (!sah) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const type = req.query.type || "pagi";
  // ?force=1 melewati deduplikasi harian — khusus untuk uji manual, dan hanya
  // dengan CRON_SECRET (tanpanya siapa pun dapat memicu kirim ulang massal).
  const force = !!CRON_SEC && secret === CRON_SEC && (req.query.force === "1" || req.query.force === "true");

  console.log(`[CRON] Mulai: type=${type}, force=${force}, time=${new Date().toISOString()}`);

  // Pencocokan Google Calendar bersama — lima kali sehari mengikuti jadwal
  // cron ini. Sengaja SEBELUM pemeriksaan duplikat notifikasi (kalender tetap
  // perlu dicocokkan meski notifikasinya sudah terkirim) dan terbungkus
  // sendiri, supaya kegagalannya tidak pernah menggagalkan notifikasi.
  if (kalenderAktif()) {
    try { console.log("[CRON] Kalender:", JSON.stringify(await rekonsiliasi())); }
    catch (e) { console.error("[CRON] Kalender gagal:", e?.message || e); }
  }

  // ── DEDUPLICATION CHECK ──────────────────────────────────────
  if (!force) {
    const duplikat = await isDuplicate(type);
    if (duplikat) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: `Notifikasi '${type}' sudah terkirim hari ini (pakai &force=1 untuk uji)`,
      });
    }
  }

  try {
    const [jadwal, users] = await Promise.all([loadJadwal(), loadUsers()]);
    console.log(`[CRON] Data: ${jadwal.length} jadwal, ${users.length} users`);

    if      (type === "pagi")     await notifPagi(jadwal, users);
    else if (type === "pimpinan") await notifPimpinan(jadwal, users);
    else if (type === "reminder") await notifReminder(jadwal, users);
    else if (type === "ajudan")   await notifAjudan(jadwal, users);
    else if (type === "personil") await notifPersonil(jadwal, users);
    else if (type === "pending")  await notifPendingApproval(users, jadwal);
    else {
      return res.status(400).json({ error: `Tipe tidak dikenal: ${type}` });
    }

    console.log(`[CRON] Selesai: type=${type}`);
    return res.status(200).json({ ok: true, type });

  } catch (err) {
    console.error(`[CRON] Error:`, err?.message || err);
    return res.status(500).json({ error: err?.message || "Internal error" });
  }
}