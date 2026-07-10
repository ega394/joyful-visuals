/**
 * api/notif-cron.js — Prokopim Notifikasi Harian
 *
 * PERBAIKAN DUPLIKAT:
 * Sebelumnya WA terkirim 2x karena Vercel kadang menjalankan cron
 * lebih dari sekali (retry otomatis). Fix: sebelum kirim, cek tabel
 * `notif_daily_log` apakah notif jenis ini sudah terkirim hari ini.
 * Jika sudah → skip. Jika belum → kirim + catat ke log.
 *
 * JADWAL CRON (vercel.json, dalam UTC):
 *   type=pagi      → "30 23 * * *"  = 07:30 WITA
 *   type=reminder  → "55 7 * * *"   = 15:55 WITA
 *   type=ajudan    → "0 8 * * *"    = 16:00 WITA
 *   type=personil  → "10 8 * * *"   = 16:10 WITA
 */

const SUPA_URL  = process.env.SUPABASE_URL  || process.env.VITE_SUPABASE_URL;
const SUPA_KEY  = process.env.SUPABASE_KEY  || process.env.VITE_SUPABASE_ANON_KEY;
const FONNTE    = process.env.FONNTE_TOKEN;
const CRON_SEC  = process.env.CRON_SECRET;

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

    // Belum ada → INSERT ke log SEKARANG (sebelum kirim, untuk lock)
    await fetch(`${SUPA_URL}/rest/v1/notif_daily_log`, {
      method: "POST",
      headers: {
        ...H(),
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        notif_type: type,
        notif_date: todayStr,
        sent_at:    new Date().toISOString(),
      }),
    });

    return false; // bukan duplikat — lanjut kirim
  } catch (err) {
    // Jika tabel belum ada atau error lain → tetap lanjut kirim
    // (jangan blokir notif hanya karena tabel log belum dibuat)
    console.warn(`[DEDUP] Error cek log:`, err?.message || err);
    return false;
  }
}

// ── Helper: kirim WA via Fonnte ──────────────────────────────
async function sendWA(to, message) {
  if (!FONNTE || !to) return;
  try {
    await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        "Authorization": FONNTE,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ target: to, message, countryCode: "62" }),
    });
  } catch (err) {
    console.error(`[WA] Gagal kirim ke ${to}:`, err?.message || err);
  }
}

// ── Formatter tanggal ────────────────────────────────────────
const HARI  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const BULAN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function fmtTgl(str) {
  if (!str) return str;
  const d = new Date(str + "T00:00:00+08:00");
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]}`;
}

function localDateWITA(offsetDays = 0) {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

// ── Load data dari Supabase ──────────────────────────────────
async function loadJadwal() {
  const today = localDateWITA(0);
  // Ambil jadwal yang disetujui mulai hari ini ke depan
  const rows = await sbGet(
    `jadwal?select=data&order=id`
  );
  if (!rows) return [];
  return rows
    .map(r => r.data)
    .filter(e => e && e.alur === "disetujui" && e.tanggal >= today);
}

// Versi untuk pending-approval (semua alur, jadwal aktif belum lewat)
async function loadJadwalPending() {
  const today = localDateWITA(0);
  const rows = await sbGet(`jadwal?select=data&order=id`);
  if (!rows) return [];
  return rows
    .map(r => r.data)
    .filter(e =>
      e &&
      (e.alur === "menunggu_kasubbag" || e.alur === "menunggu_kabag") &&
      e.tanggal >= today
    );
}

async function loadUsers() {
  const rows = await sbGet(`users?select=username,nama,jabatan,role,noWA`);
  return rows || [];
}

// ── Tipe notifikasi ──────────────────────────────────────────

/**
 * PAGI (07:30 WITA) — rekap agenda HARI INI
 * Penerima: Kabag, Kasubbag, Ajudan, Personil bertugas
 */
async function notifPagi(jadwal, users) {
  const today    = localDateWITA(0);
  const todayEvs = jadwal.filter(e => e.tanggal === today);

  if (todayEvs.length === 0) {
    console.log("[PAGI] Tidak ada agenda hari ini, skip.");
    return;
  }

  const sorted = todayEvs.sort((a, b) => a.jam.localeCompare(b.jam));

  const roles = [
    "kabag", "kasubbag_protokol", "kasubbag_komdokpim",
    "ajudan_walikota", "ajudan_wakilwalikota",
  ];

  const targets = users.filter(u => roles.includes(u.role) && u.noWA);

  // Buat ringkasan
  const ringkasan = sorted.map(e =>
    `🕐 ${e.jam?.slice(0,5)} — *${e.namaAcara}*\n📍 ${e.lokasi || e.penyelenggara || "-"}`
  ).join("\n\n");

  const msg =
    `📋 *Rekap Agenda Hari Ini*\n` +
    `${fmtTgl(today)} | ${sorted.length} kegiatan\n\n` +
    ringkasan +
    `\n\n_Prokopim Kota Tarakan_`;

  for (const u of targets) {
    await sendWA(u.noWA, msg);
    console.log(`[PAGI] Terkirim → ${u.nama} (${u.role})`);
  }

  // Personil bertugas — DINONAKTIFKAN (notifikasi penugasan dimatikan global)
  console.log("[PAGI] Notifikasi personil/penugasan dinonaktifkan — skip.");
}

/**
 * REMINDER (15:55 WITA) — peringatan agenda BESOK belum ditugaskan
 * Penerima: Kasubbag Protokol & Komdokpim
 */
async function notifReminder(jadwal, users) {
  const tomorrow = localDateWITA(1);
  const tmrwEvs  = jadwal.filter(e => e.tanggal === tomorrow);

  const belumDitugaskan = tmrwEvs.filter(
    e => !e.personil || e.personil.length === 0
  );

  if (belumDitugaskan.length === 0) {
    console.log("[REMINDER] Semua agenda besok sudah ditugaskan.");
    return;
  }

  const kasubbags = users.filter(
    u => (u.role === "kasubbag_protokol" || u.role === "kasubbag_komdokpim") && u.noWA
  );

  const daftar = belumDitugaskan.map(e =>
    `• ${e.jam?.slice(0,5)} — ${e.namaAcara} (${e.lokasi || e.penyelenggara || "-"})`
  ).join("\n");

  const msg =
    `⚠️ *Reminder: Personil Belum Ditugaskan*\n` +
    `Agenda ${fmtTgl(tomorrow)} yang belum ada personilnya:\n\n` +
    daftar +
    `\n\nSilakan segera tugaskan via aplikasi Prokopim.\n_Prokopim Kota Tarakan_`;

  for (const u of kasubbags) {
    await sendWA(u.noWA, msg);
    console.log(`[REMINDER] Terkirim → ${u.nama}`);
  }
}

/**
 * AJUDAN (16:00 WITA) — rekap agenda BESOK + minta konfirmasi kehadiran
 * Penerima: Ajudan WK & Ajudan WWK
 */
async function notifAjudan(jadwal, users) {
  const tomorrow = localDateWITA(1);
  const tmrwEvs  = jadwal
    .filter(e => e.tanggal === tomorrow)
    .sort((a, b) => a.jam.localeCompare(b.jam));

  const ajudans = users.filter(
    u => (u.role === "ajudan_walikota" || u.role === "ajudan_wakilwalikota") && u.noWA
  );

  for (const ajudan of ajudans) {
    const isWK = ajudan.role === "ajudan_walikota";
    const label = isWK ? "Wali Kota" : "Wakil Wali Kota";

    const myEvs = tmrwEvs.filter(e =>
      isWK
        ? (e.untukPimpinan || []).includes("walikota")
        : (e.untukPimpinan || []).includes("wakilwalikota") || e.delegasiKeWWK
    );

    if (myEvs.length === 0) continue;

    const daftar = myEvs.map(e =>
      `🕐 ${e.jam?.slice(0,5)} — *${e.namaAcara}*\n📍 ${e.lokasi || e.penyelenggara || "-"}\n👔 ${e.pakaian || "-"}`
    ).join("\n\n");

    const msg =
      `📅 *Agenda ${label}*\n` +
      `${fmtTgl(tomorrow)} | ${myEvs.length} kegiatan\n\n` +
      daftar +
      `\n\nMohon konfirmasi kehadiran ${label} melalui aplikasi Prokopim.\n_Prokopim Kota Tarakan_`;

    await sendWA(ajudan.noWA, msg);
    console.log(`[AJUDAN] Terkirim → ${ajudan.nama}`);
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
    const jam   = (e.jam || "").slice(0, 5);
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
    const orang = users.filter(u => u.role === p.role && u.noWA);
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
      await sendWA(u.noWA, msg);
      console.log(`[PIMPINAN] Terkirim → ${u.nama} (${p.role})`);
    }
  }
}

/**
 * PERSONIL — DINONAKTIFKAN (notifikasi penugasan dimatikan global)
 */
async function notifPersonil(jadwal, users) {
  console.log("[PERSONIL] Notifikasi penugasan dinonaktifkan — skip.");
  return;
}

/**
 * PENDING (16:00 WITA) — pengingat jadwal yang belum disetujui
 * Penerima:
 *   - Kasubbag Protokol & Komdokpim → jadwal "menunggu_kasubbag"
 *   - Kabag → jadwal "menunggu_kabag"
 */
async function notifPendingApproval(users) {
  const pendings = await loadJadwalPending();
  if (pendings.length === 0) {
    console.log("[PENDING] Tidak ada jadwal yang menunggu persetujuan — skip.");
    return;
  }

  const pendKasubbag = pendings.filter(e => e.alur === "menunggu_kasubbag")
    .sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam));
  const pendKabag = pendings.filter(e => e.alur === "menunggu_kabag")
    .sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam));

  const fmtItem = (e) =>
    `• ${fmtTgl(e.tanggal)} ${e.jam?.slice(0,5)} — *${e.namaAcara}*\n   📍 ${e.lokasi || e.penyelenggara || "-"}`;

  // Untuk Kasubbag (Protokol & Komdokpim)
  if (pendKasubbag.length > 0) {
    const kasubbags = users.filter(
      u => (u.role === "kasubbag_protokol" || u.role === "kasubbag_komdokpim") && u.noWA
    );
    const daftar = pendKasubbag.map(fmtItem).join("\n");
    const msg =
      `⏰ *Pengingat Antrian Persetujuan*\n` +
      `Sampai pukul 16:00 WITA, masih ada *${pendKasubbag.length}* jadwal menunggu verifikasi Kasubbag:\n\n` +
      daftar +
      `\n\nMohon segera ditindaklanjuti agar tidak menumpuk.\n_Prokopim Kota Tarakan_`;
    for (const u of kasubbags) {
      await sendWA(u.noWA, msg);
      console.log(`[PENDING-KASUBBAG] Terkirim → ${u.nama}`);
    }
  }

  // Untuk Kabag
  if (pendKabag.length > 0) {
    const kabags = users.filter(u => u.role === "kabag" && u.noWA);
    const daftar = pendKabag.map(fmtItem).join("\n");
    const msg =
      `⏰ *Pengingat Persetujuan Akhir*\n` +
      `Sampai pukul 16:00 WITA, masih ada *${pendKabag.length}* jadwal menunggu persetujuan Kabag:\n\n` +
      daftar +
      `\n\nMohon segera ditindaklanjuti.\n_Prokopim Kota Tarakan_`;
    for (const u of kabags) {
      await sendWA(u.noWA, msg);
      console.log(`[PENDING-KABAG] Terkirim → ${u.nama}`);
    }
  }
}

// ── MAIN HANDLER ─────────────────────────────────────────────
export default async function handler(req, res) {
  // Validasi CRON_SECRET
  const authHeader = req.headers["authorization"] || "";
  const secret     = authHeader.replace("Bearer ", "").trim();
  if (CRON_SEC && secret !== CRON_SEC) {
    // Vercel Cron mengirim header x-vercel-cron, izinkan juga
    const isCronCall = req.headers["x-vercel-cron"] === "1";
    if (!isCronCall) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const type = req.query.type || "pagi";

  console.log(`[CRON] Mulai: type=${type}, time=${new Date().toISOString()}`);

  // ── DEDUPLICATION CHECK ──────────────────────────────────────
  const duplikat = await isDuplicate(type);
  if (duplikat) {
    return res.status(200).json({
      ok: true,
      skipped: true,
      reason: `Notifikasi '${type}' sudah terkirim hari ini`,
    });
  }

  try {
    const [jadwal, users] = await Promise.all([loadJadwal(), loadUsers()]);
    console.log(`[CRON] Data: ${jadwal.length} jadwal, ${users.length} users`);

    if      (type === "pagi")     await notifPagi(jadwal, users);
    else if (type === "pimpinan") await notifPimpinan(jadwal, users);
    else if (type === "reminder") await notifReminder(jadwal, users);
    else if (type === "ajudan")   await notifAjudan(jadwal, users);
    else if (type === "personil") await notifPersonil(jadwal, users);
    else if (type === "pending")  await notifPendingApproval(users);
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