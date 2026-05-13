// ============================================================
//  /api/notif-penugasan.js — Notifikasi Penugasan Personil
//
//  Satu file, dua mode — hemat slot Vercel Hobby (maks 12):
//
//  MODE "darurat" (default POST dari App.jsx)
//    → Kirim WA hanya jika sisa waktu < 6 jam
//    Body: { namaAcara, tanggal, jam, lokasi, pakaian,
//            penyelenggara, catatanPenugasan,
//            personil: string[], pimpinan: string[],
//            delegasiKeWWK: boolean }
//
//  MODE "harian" (cron Vercel GET jam 08:00 UTC = 16:00 WITA)
//    → Kirim pengingat H-1 ke seluruh personil besok
//    GET /api/notif-penugasan?mode=harian
//
//  vercel.json:
//  { "crons": [{ "path": "/api/notif-penugasan?mode=harian", "schedule": "0 8 * * *" }] }
//
//  ENV: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
//       FONNTE_TOKEN, CRON_SECRET, API_SECRET
// ============================================================

const SUPA_URL = process.env.VITE_SUPABASE_URL    || process.env.SUPABASE_URL  || "";
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";
const FONNTE   = process.env.FONNTE_TOKEN || "";

// ── Helpers umum ─────────────────────────────────────────────
function tomorrowWITA() {
  return new Date(Date.now() + 8*3600000 + 86400000).toISOString().slice(0,10);
}

function fmtTgl(tgl) {
  const HARI  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const BULAN = ["","Januari","Februari","Maret","April","Mei","Juni",
                 "Juli","Agustus","September","Oktober","November","Desember"];
  const [y,m,d] = tgl.split("-").map(Number);
  return `${HARI[new Date(y,m-1,d).getDay()]}, ${d} ${BULAN[m]} ${y}`;
}

function sisaJam(tanggal, jam) {
  const [h,mn] = jam.split(":").map(Number);
  const [y,mo,d] = tanggal.split("-").map(Number);
  return (Date.UTC(y,mo-1,d,h-8,mn,0) - Date.now()) / 3600000;
}

async function supaFetch(path) {
  const r = await fetch(SUPA_URL + path, {
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPA_KEY,
      "Authorization": "Bearer " + SUPA_KEY,
    },
  });
  if (!r.ok) throw new Error("Supabase " + r.status + ": " + path);
  return r.json();
}

async function getUserMap(usernames) {
  if (!usernames.length) return {};
  const list = usernames.map(u => encodeURIComponent(u)).join(",");
  const rows = await supaFetch(
    `/rest/v1/users?username=in.(${list})&select=username,nama,jabatan,noWA,role`
  );
  return Object.fromEntries(rows.map(u => [u.username, u]));
}

async function kirimWA(noWA, pesan) {
  const nomor = noWA.trim().replace(/^0/,"62").replace(/\D/g,"");
  if (nomor.length < 10) return false;
  try {
    const r = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { "Authorization": FONNTE, "Content-Type": "application/json" },
      body: JSON.stringify({ target: nomor, message: pesan }),
    });
    return (await r.json()).status !== false;
  } catch(e) {
    console.error("[notif-penugasan] WA gagal:", nomor, e.message);
    return false;
  }
}

// ── Template pesan darurat (< 6 jam) ─────────────────────────
function pesanDarurat(ev, namaStaf, jabatanStaf, sisaH) {
  const sisaStr = sisaH < 1
    ? Math.round(sisaH*60) + " menit lagi"
    : "sekitar " + sisaH.toFixed(0) + " jam lagi";

  const pimpinan = [];
  if ((ev.pimpinan||[]).includes("walikota"))
    pimpinan.push(ev.delegasiKeWWK ? "Wali Kota (Delegasi ke Wakil WK)" : "Wali Kota");
  if ((ev.pimpinan||[]).includes("wakilwalikota") || ev.delegasiKeWWK)
    pimpinan.push("Wakil Wali Kota");

  const sapaan  = namaStaf ? `Yth. *${namaStaf}*${jabatanStaf ? ` (${jabatanStaf})` : ""},\n\n` : "";
  const catatan = ev.catatanPenugasan ? `\n📝 *Catatan:* ${ev.catatanPenugasan}` : "";

  return `🏛️ *Prokopim Kota Tarakan*\n` +
    sapaan +
    `⚠️ *Penugasan Darurat — berlangsung ${sisaStr}*\n\n` +
    `📅 *${fmtTgl(ev.tanggal)}*\n` +
    `🕐 *${ev.jam} WITA*\n` +
    `📌 *${ev.namaAcara}*\n` +
    (ev.lokasi        ? `📍 ${ev.lokasi}\n`          : "") +
    (ev.penyelenggara ? `🏢 ${ev.penyelenggara}\n`   : "") +
    (ev.pakaian       ? `👔 Pakaian: ${ev.pakaian}\n`: "") +
    (pimpinan.length  ? `👤 Pimpinan: ${pimpinan.join(" & ")}\n` : "") +
    catatan +
    `\n\nMohon segera mempersiapkan diri dan hadir tepat waktu.\n\n` +
    `_Bagian Protokol dan Komunikasi Pimpinan_\n_Setda Kota Tarakan_\n_prokopim.tarakankota.go.id_`;
}

// ── Template pesan harian H-1 ─────────────────────────────────
function pesanHarian(ev, namaStaf, jabatanStaf, rekan) {
  const pimpinan = [];
  if ((ev.untukPimpinan||[]).includes("walikota"))
    pimpinan.push(ev.delegasiKeWWK ? "Wali Kota (Delegasi ke Wakil WK)" : "Wali Kota");
  if ((ev.untukPimpinan||[]).includes("wakilwalikota") || ev.delegasiKeWWK)
    pimpinan.push("Wakil Wali Kota");

  const sapaan   = namaStaf ? `Yth. *${namaStaf}*${jabatanStaf ? ` (${jabatanStaf})` : ""},\n\n` : "";
  const rekanStr = rekan.length > 0 ? `\n👥 *Rekan bertugas:* ${rekan.join(", ")}` : "";
  const catatan  = ev.catatanPenugasan ? `\n📝 *Catatan:* ${ev.catatanPenugasan}` : "";

  return `🏛️ *Prokopim Kota Tarakan*\n` +
    sapaan +
    `📋 *Pengingat Penugasan*\n\n` +
    `📅 *${fmtTgl(ev.tanggal)}*\n` +
    `🕐 *${ev.jam} WITA*\n` +
    `📌 *${ev.namaAcara}*\n` +
    (ev.lokasi        ? `📍 ${ev.lokasi}\n`          : "") +
    (ev.penyelenggara ? `🏢 ${ev.penyelenggara}\n`   : "") +
    (ev.pakaian       ? `👔 Pakaian: ${ev.pakaian}\n`: "") +
    (pimpinan.length  ? `👤 Pimpinan: ${pimpinan.join(" & ")}\n` : "") +
    catatan +
    rekanStr +
    `\n\nSilakan mempersiapkan diri. Hadir tepat waktu sesuai jadwal.\n\n` +
    `_Bagian Protokol dan Komunikasi Pimpinan_\n_Setda Kota Tarakan_\n_prokopim.tarakankota.go.id_`;
}

// ── Handler utama ─────────────────────────────────────────────
// WA penugasan dinonaktifkan — endpoint tetap hidup agar cron tidak error,
// tapi tidak mengirim WA ke personil yang bertugas.
module.exports = async function handler(req, res) {
  return res.status(200).json({ ok: true, disabled: true, message: "Notifikasi WA penugasan dinonaktifkan." });

  // eslint-disable-next-line no-unreachable
  const mode = req.query?.mode || req.body?.mode || (req.method === "GET" ? "harian" : "darurat");

  // Validasi secret untuk POST
  if (req.method === "POST") {
    const secret = (req.headers["authorization"] || "").replace("Bearer ", "");
    const valid  = [process.env.CRON_SECRET, process.env.API_SECRET].filter(Boolean);
    if (valid.length > 0 && !valid.includes(secret)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ error: "SUPABASE env belum diset" });
  }

  // ════════════════════════════════════════════════════════════
  // MODE DARURAT
  // ════════════════════════════════════════════════════════════
  if (mode === "darurat") {
    const body = req.body || {};
    const { tanggal, jam, personil = [] } = body;

    if (!tanggal || !jam || !personil.length) {
      return res.status(400).json({ error: "tanggal, jam, personil wajib diisi" });
    }

    const sisa = sisaJam(tanggal, jam);
    if (sisa >= 6) {
      return res.status(200).json({ ok:true, skipped:true, message:`Sisa ${sisa.toFixed(1)} jam ≥ 6 jam` });
    }
    if (sisa <= 0) {
      return res.status(200).json({ ok:true, skipped:true, message:"Acara sudah lewat" });
    }

    const userMap = await getUserMap(personil);
    let sent=0, failed=0, noWA=0;
    const log = [];

    for (const un of personil) {
      const u = userMap[un];
      if (!u?.noWA) {
        noWA++;
        log.push({ username:un, skip: !u ? "not_found" : "no_wa" });
        continue;
      }
      const ok = await kirimWA(u.noWA, pesanDarurat(body, u.nama, u.jabatan, sisa));
      if (ok) sent++; else failed++;
      log.push({ username:un, ok });
      await new Promise(r => setTimeout(r, 250));
    }

    console.log(`[notif-penugasan/darurat] sisa:${sisa.toFixed(1)}h sent:${sent} failed:${failed}`);
    return res.status(200).json({ ok:true, mode:"darurat", sisaJam:sisa, sent, failed, noWA, log });
  }

  // ════════════════════════════════════════════════════════════
  // MODE HARIAN (cron 16:00 WITA)
  // ════════════════════════════════════════════════════════════
  if (mode === "harian") {
    const besok = tomorrowWITA();
    console.log(`[notif-penugasan/harian] Jadwal besok: ${besok}`);

    const rows = await supaFetch("/rest/v1/jadwal?select=id,data&order=data->jam.asc");
    const jadwalBesok = rows
      .map(r => ({ id: r.id, ...(r.data || {}) }))
      .filter(ev =>
        ev.tanggal === besok &&
        ev.alur    === "disetujui" &&
        ev.personil?.length > 0
      );

    if (!jadwalBesok.length) {
      return res.status(200).json({ ok:true, mode:"harian", message:"Tidak ada jadwal bertugas besok", besok });
    }

    const allUsernames = [...new Set(jadwalBesok.flatMap(ev => ev.personil || []))];
    const userMap = await getUserMap(allUsernames);
    let sent=0, failed=0, noWA=0;
    const log = [];

    for (const ev of jadwalBesok) {
      for (const un of (ev.personil || [])) {
        const u = userMap[un];
        if (!u?.noWA) {
          noWA++;
          log.push({ username:un, evId:ev.id, skip: !u ? "not_found" : "no_wa" });
          continue;
        }
        const rekan = (ev.personil || []).filter(x => x !== un).map(x => userMap[x]?.nama || x);
        const ok    = await kirimWA(u.noWA, pesanHarian(ev, u.nama, u.jabatan, rekan));
        if (ok) sent++; else failed++;
        log.push({ username:un, evId:ev.id, ok });
        await new Promise(r => setTimeout(r, 300));
      }
    }

    console.log(`[notif-penugasan/harian] Selesai. sent:${sent} failed:${failed} noWA:${noWA}`);
    return res.status(200).json({ ok:true, mode:"harian", besok, jadwal:jadwalBesok.length, sent, failed, noWA, log });
  }

  return res.status(400).json({ error: `Mode tidak dikenal: ${mode}` });
};