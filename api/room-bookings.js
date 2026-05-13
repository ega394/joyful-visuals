/**
 * api/room-bookings.js — Public Room Booking Endpoints
 *
 * GET  /api/room-bookings
 *      ?month=YYYY-MM  → kalender bulan tertentu (Pending+Approved)
 *      ?code=XXX       → tracker by booking_code
 *      ?pic_wa=XXX     → tracker by nomor WA
 *
 * POST /api/room-bookings → submit pengajuan baru (conflict check vs Approved)
 *
 * DELETE /api/room-bookings?id=XXX&code=XXX → cancel oleh peminjam (verifikasi kode)
 */

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const FONNTE   = process.env.FONNTE_TOKEN;

const H = () => ({
  "Content-Type": "application/json",
  "apikey": SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
});

// ── Helpers ──────────────────────────────────────────────────

async function sbGet(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: H() });
  if (!r.ok) { const t = await r.text(); throw new Error(t); }
  return r.json();
}

async function sbPost(path, body) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: { ...H(), "Prefer": "return=representation" },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(t); }
  return r.json();
}

async function sbPatch(path, body) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...H(), "Prefer": "return=representation" },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(t); }
  return r.json();
}

async function sendWA(to, message) {
  if (!FONNTE || !to) return;
  try {
    await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { "Authorization": FONNTE, "Content-Type": "application/json" },
      body: JSON.stringify({ target: to.replace(/\D/g, ""), message }),
    });
  } catch { /* non-critical */ }
}

// Sesi yang dianggap konflik dengan sesi tertentu
function conflictingSessions(session) {
  if (session === "Pagi")    return ["Pagi", "Full_Day"];
  if (session === "Siang")   return ["Siang", "Full_Day"];
  if (session === "Full_Day") return ["Pagi", "Siang", "Full_Day"];
  return [session];
}

function sessionLabel(s) {
  if (s === "Pagi")     return "Pagi (07.30–12.00)";
  if (s === "Siang")    return "Siang (12.30–16.30)";
  if (s === "Full_Day") return "Full Day (Seharian)";
  return s;
}

// ── Handler ──────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { method, query, body } = req;

  // ── GET ──────────────────────────────────────────────────
  if (method === "GET") {
    // Tracker by booking_code
    if (query.code) {
      const rows = await sbGet(
        `room_bookings?booking_code=eq.${encodeURIComponent(query.code.toUpperCase())}&select=*,rooms(name,capacity)`
      );
      return res.status(200).json(rows);
    }

    // Tracker by WA number
    if (query.pic_wa) {
      const wa = query.pic_wa.replace(/\D/g, "");
      const rows = await sbGet(
        `room_bookings?pic_wa=ilike.*${wa}*&select=*,rooms(name,capacity)&order=created_at.desc&limit=20`
      );
      return res.status(200).json(rows);
    }

    // Kalender bulan tertentu (default: bulan ini)
    const monthStr = query.month || new Date().toISOString().slice(0, 7);
    const [year, month] = monthStr.split("-").map(Number);
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay  = new Date(year, month, 0).toISOString().slice(0, 10);

    const rows = await sbGet(
      `room_bookings?select=*,rooms(name,capacity)` +
      `&status=in.(Pending,Approved)` +
      `&start_date=lte.${lastDay}` +
      `&end_date=gte.${firstDay}` +
      `&order=start_date.asc`
    );
    return res.status(200).json(rows);
  }

  // ── POST — submit pengajuan ───────────────────────────────
  if (method === "POST") {
    const {
      room_id, instansi, pic_name, pic_wa, event_name,
      participant_count, start_date, end_date, session,
      srikandi_ref, document_path,
    } = body || {};

    // Validasi wajib
    const required = { room_id, instansi, pic_name, pic_wa, event_name, participant_count, start_date, end_date, session };
    for (const [k, v] of Object.entries(required)) {
      if (!v && v !== 0) return res.status(400).json({ error: `Field '${k}' wajib diisi` });
    }

    if (!["Pagi", "Siang", "Full_Day"].includes(session)) {
      return res.status(400).json({ error: "Sesi tidak valid" });
    }

    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ error: "Tanggal selesai tidak boleh sebelum tanggal mulai" });
    }

    // Multi-hari → wajib srikandi_ref ATAU document_path
    const isMultiDay = end_date !== start_date;
    if (isMultiDay && !srikandi_ref && !document_path) {
      return res.status(400).json({
        error: "Peminjaman lebih dari 1 hari wajib melampirkan nomor Srikandi atau file surat",
      });
    }

    // Cek kapasitas ruangan
    const rooms = await sbGet(`rooms?id=eq.${room_id}&select=*`);
    const room  = rooms?.[0];
    if (!room) return res.status(400).json({ error: "Ruangan tidak ditemukan" });
    if (Number(participant_count) > room.capacity) {
      return res.status(400).json({
        error: `Jumlah peserta (${participant_count}) melebihi kapasitas ruangan ${room.name} (${room.capacity} orang)`,
      });
    }

    // Cek konflik dengan booking Approved yang overlapping
    const conflictSessions = conflictingSessions(session);
    const sessionFilter = `session=in.(${conflictSessions.join(",")})`;
    const conflicts = await sbGet(
      `room_bookings?room_id=eq.${room_id}&status=eq.Approved` +
      `&start_date=lte.${end_date}&end_date=gte.${start_date}` +
      `&${sessionFilter}&select=id,start_date,end_date,session,event_name`
    );
    if (conflicts?.length > 0) {
      const c = conflicts[0];
      return res.status(409).json({
        error: `Ruangan sudah dipesan (${c.event_name}) pada ${c.start_date}–${c.end_date} sesi ${sessionLabel(c.session)}`,
        conflicts,
      });
    }

    // Simpan booking
    const newBooking = await sbPost("room_bookings", {
      room_id: Number(room_id),
      instansi, pic_name,
      pic_wa: String(pic_wa).replace(/\D/g, ""),
      event_name,
      participant_count: Number(participant_count),
      start_date, end_date, session,
      srikandi_ref: srikandi_ref || null,
      document_path: document_path || null,
      status: "Pending",
    });
    const booking = Array.isArray(newBooking) ? newBooking[0] : newBooking;

    // Notifikasi ke semua pengelola ruangan (can_manage_rooms=true)
    const managers = await sbGet(`users?can_manage_rooms=eq.true&select=nama,noWA`);
    const kabagList = await sbGet(`users?role=eq.kabag&select=nama,noWA`);
    const notifTargets = [...(managers || []), ...(kabagList || [])];
    const uniqueTargets = notifTargets.filter(
      (u, i, arr) => u.noWA && arr.findIndex(x => x.noWA === u.noWA) === i
    );

    const tanggalStr = start_date === end_date
      ? start_date
      : `${start_date} s/d ${end_date}`;

    const adminMsg =
      `*[PENGAJUAN RUANGAN BARU]*\n` +
      `Kode: *${booking.booking_code}*\n` +
      `Ruangan: ${room.name}\n` +
      `Instansi: ${instansi}\n` +
      `Acara: ${event_name}\n` +
      `PIC: ${pic_name} (${pic_wa})\n` +
      `Tanggal: ${tanggalStr}\n` +
      `Sesi: ${sessionLabel(session)}\n` +
      `Peserta: ${participant_count} orang\n` +
      (srikandi_ref ? `Srikandi: ${srikandi_ref}\n` : "") +
      `\nSilakan validasi di dashboard Kelola Ruangan.`;

    for (const u of uniqueTargets) await sendWA(u.noWA, adminMsg);

    // Konfirmasi ke peminjam
    const peminjamMsg =
      `*[PROKOPIM TARAKAN]* Pengajuan peminjaman ruangan berhasil diterima.\n\n` +
      `Kode Booking: *${booking.booking_code}*\n` +
      `Ruangan: ${room.name}\n` +
      `Acara: ${event_name}\n` +
      `Tanggal: ${tanggalStr} | Sesi: ${sessionLabel(session)}\n\n` +
      `Simpan kode ini untuk cek status: https://prokopim.tarakankota.go.id/pinjamruangan?cek=${booking.booking_code}\n` +
      `Status saat ini: *Menunggu Konfirmasi*. Kami akan memberitahu jika ada perubahan status.`;

    await sendWA(pic_wa, peminjamMsg);

    return res.status(201).json({ ok: true, booking });
  }

  // ── DELETE — cancel oleh peminjam ────────────────────────
  if (method === "DELETE") {
    const { id, code } = query;
    if (!id || !code) return res.status(400).json({ error: "Parameter id dan code wajib ada" });

    const rows = await sbGet(
      `room_bookings?id=eq.${id}&booking_code=eq.${code.toUpperCase()}&select=*`
    );
    if (!rows?.length) return res.status(404).json({ error: "Booking tidak ditemukan atau kode tidak cocok" });

    const booking = rows[0];
    if (!["Pending"].includes(booking.status)) {
      return res.status(400).json({
        error: `Booking berstatus '${booking.status}' tidak bisa dibatalkan oleh peminjam. Hubungi pengelola ruangan.`,
      });
    }

    await sbPatch(`room_bookings?id=eq.${id}`, { status: "Cancelled", notes: "Dibatalkan oleh peminjam" });

    // Beritahu pengelola
    const managers = await sbGet(`users?can_manage_rooms=eq.true&select=noWA`);
    const kabagList = await sbGet(`users?role=eq.kabag&select=noWA`);
    const targets = [...(managers || []), ...(kabagList || [])].filter(
      (u, i, arr) => u.noWA && arr.findIndex(x => x.noWA === u.noWA) === i
    );
    const cancelMsg =
      `*[PEMBATALAN RUANGAN]* Kode *${booking.booking_code}* — ${booking.event_name}\n` +
      `Dibatalkan oleh peminjam (${booking.pic_name}).`;
    for (const u of targets) await sendWA(u.noWA, cancelMsg);

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
