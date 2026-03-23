/**
 * api/guest.js — Prokopim v1.5: Smart Guest Management
 *
 * ENDPOINT:
 *   POST /api/guest?action=checkin        → Tamu daftar via form publik /tamu
 *   GET  /api/guest?action=queue          → Kasubbag lihat antrian
 *   POST /api/guest?action=screen         → Kasubbag kurasi tamu
 *   POST /api/guest?action=respond        → Pimpinan respons (terima/disposisi/tolak)
 *   POST /api/guest?action=check_conflict → Cek bentrok jadwal sebelum terima tamu
 *   GET  /api/guest?action=available_slots → Cari slot kosong untuk tamu
 *
 * TIMEZONE NOTE:
 *   Semua pengecekan jadwal menggunakan zona WITA (UTC+8) secara eksplisit.
 *   Perbandingan waktu dilakukan dalam string format lokal (YYYY-MM-DD HH:MM)
 *   untuk menghindari bug konversi UTC.
 */

const SUPA_URL = process.env.SUPABASE_URL  || process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY  || process.env.VITE_SUPABASE_ANON_KEY;
const FONNTE   = process.env.FONNTE_TOKEN;

const H = () => ({
  "Content-Type":  "application/json",
  "apikey":        SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
  "Prefer":        "return=representation",
});

async function sbGet(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: H() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbPost(table, body) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: "POST", headers: H(), body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbPatch(table, filter, body) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH", headers: H(), body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sendWA(to, message) {
  if (!FONNTE || !to) return;
  try {
    await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { "Authorization": FONNTE, "Content-Type": "application/json" },
      body: JSON.stringify({ target: to, message, countryCode: "62" }),
    });
  } catch (e) { console.warn("[WA guest]", e.message); }
}

// ── TIMEZONE UTILS (WITA = UTC+8) ────────────────────────────

/**
 * Konversi tanggal+jam lokal WITA ke objek Date UTC
 * Input : "2026-03-25", "09:30"
 * Output: Date object (internal UTC, tapi merepresentasikan 09:30 WITA)
 */
function witatoDate(dateStr, timeStr) {
  // Eksplisit append offset +08:00 agar tidak ada ambiguitas UTC
  return new Date(`${dateStr}T${timeStr}:00+08:00`);
}

/**
 * Ambil string tanggal hari ini dalam WITA
 * Output: "2026-03-25"
 */
function todayWITA() {
  return new Date(Date.now() + 8 * 3600000)
    .toISOString().slice(0, 10);
}

/**
 * Format durasi menit menjadi teks
 */
function fmtDuration(minutes) {
  if (minutes < 60) return `${minutes} menit`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
}

// ── CONFLICT DETECTION ────────────────────────────────────────
/**
 * checkScheduleConflict
 *
 * Mengecek apakah slot waktu yang diminta untuk tamu bentrok
 * dengan agenda Pimpinan yang sudah berstatus 'Hadir'.
 *
 * Aturan bentrok:
 * - Waktu yang sama persis (overlap)
 * - Jeda kurang dari 30 menit dari agenda sebelum/sesudah
 * - Pimpinan yang sama (WK atau WWK)
 *
 * @param {string} dateStr     - "YYYY-MM-DD" (WITA)
 * @param {string} timeStr     - "HH:MM" (WITA)
 * @param {number} durationMin - Estimasi durasi audiensi (default 30 menit)
 * @param {string} pimpinan    - "walikota" | "wakilwalikota"
 */
async function checkScheduleConflict({ dateStr, timeStr, durationMin = 30, pimpinan = "walikota" }) {
  const BUFFER_MINUTES = 30; // Jeda minimum antar kegiatan
  const WITA_OFFSET    = 8 * 60; // menit

  // Waktu tamu dalam menit sejak tengah malam WITA
  const [reqH, reqM] = timeStr.split(":").map(Number);
  const reqStart = reqH * 60 + reqM;
  const reqEnd   = reqStart + durationMin;

  // Ambil semua jadwal di tanggal yang sama yang sudah dikonfirmasi Pimpinan
  // Data jadwal ada di kolom JSONB `data` di tabel `jadwal`
  const rows = await sbGet(
    `jadwal?select=data&order=id`
  );

  const conflicts = [];
  const confirmedAgendas = [];

  for (const row of rows) {
    const ev = row.data;
    if (!ev || ev.alur !== "disetujui") continue;
    if (ev.tanggal !== dateStr) continue;

    // Cek apakah agenda ini untuk pimpinan yang dimaksud
    const untukPimpinan = ev.untukPimpinan || [];
    const isRelevant =
      (pimpinan === "walikota" && untukPimpinan.includes("walikota") && ev.statusWK === "hadir") ||
      (pimpinan === "wakilwalikota" && (untukPimpinan.includes("wakilwalikota") || ev.delegasiKeWWK) && ev.statusWWK === "hadir");

    if (!isRelevant) continue;

    const [evH, evM] = (ev.jam || "08:00").split(":").map(Number);
    const evStart = evH * 60 + evM;
    const evEnd   = evStart + (ev.durasiMenit || 60); // default 60 menit jika tidak ada durasi

    confirmedAgendas.push({
      id: ev.id, name: ev.namaAcara, jam: ev.jam,
      evStart, evEnd, lokasi: ev.lokasi,
    });

    // Cek overlap + buffer
    const tooClose =
      (reqStart >= evStart - BUFFER_MINUTES && reqStart < evEnd + BUFFER_MINUTES) ||
      (reqEnd   >  evStart - BUFFER_MINUTES && reqEnd  <= evEnd + BUFFER_MINUTES) ||
      (reqStart <= evStart && reqEnd >= evEnd);

    if (tooClose) {
      const overlapType =
        reqStart >= evStart && reqStart < evEnd ? "overlap_langsung" :
        Math.abs(reqStart - evEnd) < BUFFER_MINUTES  ? "terlalu_dekat_sesudah" :
        Math.abs(evStart - reqEnd) < BUFFER_MINUTES  ? "terlalu_dekat_sebelum" : "overlap";

      conflicts.push({
        agendaId:   ev.id,
        agendaName: ev.namaAcara,
        jam:        ev.jam,
        lokasi:     ev.lokasi || "-",
        type:       overlapType,
        message:
          overlapType === "overlap_langsung"
            ? `Bertabrakan langsung dengan acara "${ev.namaAcara}" (${ev.jam} WITA)`
            : `Terlalu dekat dengan acara "${ev.namaAcara}" (${ev.jam} WITA) — jeda < ${BUFFER_MINUTES} menit`,
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    confirmedAgendas: confirmedAgendas.sort((a, b) => a.evStart - b.evStart),
  };
}

/**
 * findAvailableSlots
 *
 * Mencari slot waktu kosong di tanggal yang diminta
 * berdasarkan agenda yang sudah ada
 *
 * @returns Array of { startTime, endTime, label }
 */
async function findAvailableSlots({ dateStr, pimpinan = "walikota", durationMin = 30 }) {
  const BUFFER = 30;
  const WORK_START = 8 * 60;   // 08:00 WITA
  const WORK_END   = 16 * 60;  // 16:00 WITA

  const { confirmedAgendas } = await checkScheduleConflict({
    dateStr, timeStr: "00:00", durationMin: 0, pimpinan,
  });

  // Buat daftar slot yang terisi (start - end + buffer)
  const busy = confirmedAgendas.map(a => ({
    start: a.evStart - BUFFER,
    end:   a.evEnd   + BUFFER,
    name:  a.name,
  }));

  // Cari celah yang cukup untuk durationMin
  const slots = [];
  let cursor = WORK_START;

  while (cursor + durationMin <= WORK_END) {
    const slotEnd = cursor + durationMin;
    const isBusy = busy.some(b => cursor < b.end && slotEnd > b.start);

    if (!isBusy) {
      const h = Math.floor(cursor / 60);
      const m = cursor % 60;
      const hEnd = Math.floor(slotEnd / 60);
      const mEnd = slotEnd % 60;
      slots.push({
        startTime: `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`,
        endTime:   `${String(hEnd).padStart(2,"0")}:${String(mEnd).padStart(2,"0")}`,
        label:     `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")} – ${String(hEnd).padStart(2,"0")}:${String(mEnd).padStart(2,"0")} WITA`,
      });
      cursor += durationMin + BUFFER;
    } else {
      cursor += 15; // Geser 15 menit, coba lagi
    }
  }

  return slots.slice(0, 6); // Maksimal 6 rekomendasi slot
}

// ── ACTIONS ──────────────────────────────────────────────────

// ACTION: checkin — tamu daftar via form publik
async function actionCheckin(body) {
  const { name, organization, phone, purpose, preferred_date, preferred_time, message } = body;
  if (!name || !phone || !purpose) {
    throw new Error("Nama, nomor HP, dan keperluan wajib diisi");
  }

  // Simple anti-spam: cek jika nomor HP sudah daftar hari ini
  const today = todayWITA();
  const existing = await sbGet(
    `audiences?phone=eq.${encodeURIComponent(phone)}&created_at=gte.${today}T00:00:00Z&status=neq.rejected&limit=1`
  );
  if (existing.length > 0) {
    throw new Error("Nomor HP ini sudah terdaftar dalam antrian hari ini");
  }

  const created = await sbPost("audiences", {
    name, organization: organization || "", phone, purpose,
    preferred_date: preferred_date || null,
    preferred_time: preferred_time || null,
    message: message || "",
    status: "waiting",
    priority: "low",
  });

  // Konfirmasi WA ke tamu
  await sendWA(
    phone,
    `✅ *Konfirmasi Pendaftaran Audiensi*\n\n` +
    `Terima kasih, *${name}*, permohonan audiensi Anda di *Kantor Wali Kota Tarakan* telah diterima.\n\n` +
    `📋 Keperluan: ${purpose}\n` +
    `📅 Pilihan tanggal: ${preferred_date ? preferred_date + " pukul " + preferred_time + " WITA" : "Belum ditentukan"}\n\n` +
    `Kami akan menghubungi Anda kembali setelah jadwal dikonfirmasi oleh Pimpinan.\n\n` +
    `_Prokopim — Pemerintah Kota Tarakan_`
  );

  return { ok: true, id: created[0]?.id, message: "Pendaftaran berhasil! Kami akan menghubungi Anda segera." };
}

// ACTION: screen — Kasubbag kurasi tamu
async function actionScreen(body) {
  const { id, priority, secretNotes, tags } = body;
  if (!id) throw new Error("id tamu wajib");

  await sbPatch("audiences", `id=eq.${id}`, {
    priority:     priority || "medium",
    secret_notes: secretNotes || "",
    tags:         tags || [],
    status:       "screened",
    screened_at:  new Date().toISOString(),
    updated_at:   new Date().toISOString(),
  });

  // Notif push ke Pimpinan (bisa ditambahkan via webpush.js)
  return { ok: true, message: "Tamu berhasil dinaikkan ke meja Pimpinan ✓" };
}

// ACTION: respond — Pimpinan respons
async function actionRespond(body) {
  const { id, response, pimpinanResponse, disposedTo, rejectionReason,
          scheduledDate, scheduledTime, pimpinan } = body;

  const audience = await sbGet(`audiences?id=eq.${id}&limit=1`);
  if (!audience.length) throw new Error("Tamu tidak ditemukan");
  const tamu = audience[0];

  let updateData = {
    status: response,
    pimpinan_response: pimpinanResponse || "",
    responded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let waMessage = "";

  if (response === "accepted") {
    // Cek konflik jadwal sebelum set jadwal
    if (scheduledDate && scheduledTime) {
      const conflict = await checkScheduleConflict({
        dateStr: scheduledDate, timeStr: scheduledTime,
        pimpinan: pimpinan || "walikota",
      });
      if (conflict.hasConflict) {
        return {
          ok: false, hasConflict: true,
          conflicts: conflict.conflicts,
          message: "Jadwal bentrok! Lihat rekomendasi slot tersedia.",
        };
      }
    }
    updateData.status = "accepted";
    waMessage =
      `🎉 *Permohonan Audiensi Diterima*\n\n` +
      `Yth. *${tamu.name}*,\n\n` +
      `Permohonan audiensi Anda dengan Pimpinan Kota Tarakan telah *DITERIMA*.\n\n` +
      (scheduledDate
        ? `📅 Jadwal: *${scheduledDate}* pukul *${scheduledTime} WITA*\n`
        : `📅 Jadwal akan dikonfirmasi lebih lanjut oleh tim Prokopim.\n`) +
      `📍 Lokasi: Ruang Pimpinan, Kantor Wali Kota Tarakan\n\n` +
      `Mohon hadir tepat waktu. Hubungi kami jika ada kendala.\n\n` +
      `_Prokopim — Pemerintah Kota Tarakan_`;

  } else if (response === "disposed") {
    updateData.disposed_to = disposedTo || "";
    waMessage =
      `📋 *Update Permohonan Audiensi*\n\n` +
      `Yth. *${tamu.name}*,\n\n` +
      `Permohonan Anda telah *didisposisi* kepada ${disposedTo || "pejabat terkait"} untuk ditindaklanjuti.\n` +
      `Tim terkait akan segera menghubungi Anda.\n\n` +
      `_Prokopim — Pemerintah Kota Tarakan_`;

  } else if (response === "rejected") {
    updateData.rejection_reason = rejectionReason || "";
    waMessage =
      `📋 *Update Permohonan Audiensi*\n\n` +
      `Yth. *${tamu.name}*,\n\n` +
      `Mohon maaf, permohonan audiensi Anda *belum dapat dipenuhi* saat ini` +
      (rejectionReason ? ` dengan alasan: ${rejectionReason}` : "") + `.\n\n` +
      `Anda dapat mengajukan kembali pada waktu lain.\n\n` +
      `_Prokopim — Pemerintah Kota Tarakan_`;
  }

  await sbPatch("audiences", `id=eq.${id}`, updateData);

  // Kirim WA ke tamu
  if (waMessage && tamu.phone) {
    await sendWA(tamu.phone, waMessage);
    await sbPatch("audiences", `id=eq.${id}`, {
      wa_sent_at: new Date().toISOString(),
      wa_status: "sent",
    });
  }

  return { ok: true, response, message: "Respons berhasil dicatat & WA terkirim ✓" };
}

// ACTION: check_conflict — endpoint dedicated untuk cek bentrok
async function actionCheckConflict(body) {
  const { dateStr, timeStr, durationMin, pimpinan } = body;
  if (!dateStr || !timeStr) throw new Error("dateStr dan timeStr wajib");

  const result = await checkScheduleConflict({
    dateStr, timeStr,
    durationMin: durationMin || 30,
    pimpinan: pimpinan || "walikota",
  });

  let availableSlots = [];
  if (result.hasConflict) {
    availableSlots = await findAvailableSlots({
      dateStr, pimpinan: pimpinan || "walikota",
      durationMin: durationMin || 30,
    });
  }

  return { ...result, availableSlots };
}

// ACTION: available_slots — ambil slot kosong di tanggal tertentu
async function actionAvailableSlots(query) {
  const { date, pimpinan, duration } = query;
  if (!date) throw new Error("Param date wajib");

  const slots = await findAvailableSlots({
    dateStr: date,
    pimpinan: pimpinan || "walikota",
    durationMin: parseInt(duration || "30"),
  });

  return { ok: true, date, slots };
}

// ACTION: queue — ambil antrian tamu
async function actionQueue(query) {
  const { status, limit = 20 } = query;
  let filter = `order=created_at.asc&limit=${limit}`;
  if (status) filter = `status=eq.${status}&${filter}`;
  else        filter = `status=in.(waiting,screened)&${filter}`;
  return sbGet(`audiences?${filter}`);
}

// ── MAIN HANDLER ─────────────────────────────────────────────
export default async function handler(req, res) {
  const action = req.query.action;

  // Endpoint checkin publik tidak perlu auth
  // Endpoint lain sebaiknya tambahkan validasi API_SECRET

  try {
    let result;
    if (req.method === "GET") {
      if      (action === "queue")           result = await actionQueue(req.query);
      else if (action === "available_slots") result = await actionAvailableSlots(req.query);
      else return res.status(400).json({ error: "Action tidak dikenal" });
    } else if (req.method === "POST") {
      const body = req.body;
      if      (action === "checkin")         result = await actionCheckin(body);
      else if (action === "screen")          result = await actionScreen(body);
      else if (action === "respond")         result = await actionRespond(body);
      else if (action === "check_conflict")  result = await actionCheckConflict(body);
      else return res.status(400).json({ error: "Action tidak dikenal" });
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("[GUEST]", err.message);
    return res.status(500).json({ error: err.message });
  }
}