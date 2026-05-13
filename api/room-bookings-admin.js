/**
 * api/room-bookings-admin.js — Admin Room Booking Endpoints
 *
 * Semua endpoint ini memerlukan header X-Username yang valid
 * dengan role kabag ATAU can_manage_rooms=true.
 *
 * GET /api/room-bookings-admin
 *   ?status=Pending|Approved|Rejected|Cancelled (opsional, default semua)
 *   ?room_id=1|2 (opsional)
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD (opsional)
 *
 * PUT /api/room-bookings-admin
 *   body: { id, status: 'Approved'|'Rejected'|'Cancelled', notes? }
 */

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const FONNTE   = process.env.FONNTE_TOKEN;

const H = () => ({
  "Content-Type": "application/json",
  "apikey": SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
});

async function sbGet(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: H() });
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
      body: JSON.stringify({ target: String(to).replace(/\D/g, ""), message }),
    });
  } catch { /* non-critical */ }
}

// Verifikasi user boleh akses admin endpoint
async function verifyAdmin(username) {
  if (!username) return null;
  const rows = await sbGet(
    `users?username=eq.${encodeURIComponent(username)}&select=username,nama,role,can_manage_rooms,disabled`
  );
  const u = rows?.[0];
  if (!u || u.disabled) return null;
  if (u.role === "kabag" || u.can_manage_rooms) return u;
  return null;
}

function sessionLabel(s) {
  if (s === "Pagi")     return "Pagi (07.30–12.00)";
  if (s === "Siang")    return "Siang (12.30–16.30)";
  if (s === "Full_Day") return "Full Day (Seharian)";
  return s;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Username");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Autentikasi
  const username = req.headers["x-username"] || req.query.username;
  const adminUser = await verifyAdmin(username);
  if (!adminUser) {
    return res.status(403).json({ error: "Akses ditolak. Hanya Kabag atau Staf Pengelola Ruangan." });
  }

  const { method, query, body } = req;

  // ── GET — list semua booking untuk dashboard ──────────────
  if (method === "GET") {
    let filters = "select=*,rooms(name,capacity)";

    if (query.status) filters += `&status=eq.${query.status}`;
    if (query.room_id) filters += `&room_id=eq.${query.room_id}`;
    if (query.from)    filters += `&start_date=gte.${query.from}`;
    if (query.to)      filters += `&end_date=lte.${query.to}`;

    const rows = await sbGet(
      `room_bookings?${filters}&order=created_at.desc&limit=200`
    );
    return res.status(200).json(rows);
  }

  // ── PUT — approve / reject / cancel ──────────────────────
  if (method === "PUT") {
    const { id, status, notes } = body || {};

    if (!id) return res.status(400).json({ error: "Field 'id' wajib ada" });
    if (!["Approved", "Rejected", "Cancelled"].includes(status)) {
      return res.status(400).json({ error: "Status tidak valid. Gunakan: Approved, Rejected, Cancelled" });
    }

    // Pastikan booking ada
    const rows = await sbGet(`room_bookings?id=eq.${id}&select=*,rooms(name,capacity)`);
    const booking = rows?.[0];
    if (!booking) return res.status(404).json({ error: "Booking tidak ditemukan" });

    // Jika approve, cek konflik ulang (ada kemungkinan booking lain juga di-approve sementara itu)
    if (status === "Approved") {
      const { room_id, start_date, end_date, session } = booking;
      const conflictSessions = session === "Pagi"    ? ["Pagi", "Full_Day"]
                              : session === "Siang"   ? ["Siang", "Full_Day"]
                              : ["Pagi", "Siang", "Full_Day"];
      const conflicts = await sbGet(
        `room_bookings?room_id=eq.${room_id}&status=eq.Approved` +
        `&start_date=lte.${end_date}&end_date=gte.${start_date}` +
        `&session=in.(${conflictSessions.join(",")})` +
        `&id=neq.${id}&select=id,event_name,start_date,end_date,session`
      );
      if (conflicts?.length) {
        return res.status(409).json({
          error: `Konflik: ${conflicts[0].event_name} sudah Approved di tanggal/sesi yang sama`,
        });
      }
    }

    // Update status
    const patch = {
      status,
      notes: notes || null,
      reviewed_by: adminUser.username,
      reviewed_at: new Date().toISOString(),
    };
    const updated = await sbPatch(`room_bookings?id=eq.${id}`, patch);
    const updatedBooking = Array.isArray(updated) ? updated[0] : updated;

    // Notifikasi WA ke peminjam
    const tanggalStr = booking.start_date === booking.end_date
      ? booking.start_date
      : `${booking.start_date} s/d ${booking.end_date}`;

    let peminjamMsg = "";
    if (status === "Approved") {
      peminjamMsg =
        `*[PROKOPIM TARAKAN]* Selamat! Permohonan peminjaman ruangan Anda telah *DISETUJUI*.\n\n` +
        `Kode: *${booking.booking_code}*\n` +
        `Ruangan: ${booking.rooms?.name || booking.room_id}\n` +
        `Acara: ${booking.event_name}\n` +
        `Tanggal: ${tanggalStr}\n` +
        `Sesi: ${sessionLabel(booking.session)}\n\n` +
        `Harap datang tepat waktu. Pastikan ruangan dikembalikan dalam kondisi bersih dan rapi.\n` +
        `Info: Bagian Prokopim Kota Tarakan.`;
    } else if (status === "Rejected") {
      peminjamMsg =
        `*[PROKOPIM TARAKAN]* Mohon maaf, permohonan peminjaman ruangan Anda *DITOLAK*.\n\n` +
        `Kode: *${booking.booking_code}*\n` +
        `Ruangan: ${booking.rooms?.name || booking.room_id}\n` +
        `Acara: ${booking.event_name}\n` +
        (notes ? `Alasan: ${notes}\n` : "") +
        `\nSilakan ajukan permohonan baru atau hubungi Bagian Prokopim untuk informasi lebih lanjut.`;
    } else if (status === "Cancelled") {
      peminjamMsg =
        `*[PROKOPIM TARAKAN]* Peminjaman ruangan Anda telah *DIBATALKAN* oleh pengelola.\n\n` +
        `Kode: *${booking.booking_code}*\n` +
        `Acara: ${booking.event_name}\n` +
        (notes ? `Keterangan: ${notes}\n` : "") +
        `\nHubungi Bagian Prokopim jika ada pertanyaan.`;
    }

    if (peminjamMsg && booking.pic_wa) await sendWA(booking.pic_wa, peminjamMsg);

    return res.status(200).json({ ok: true, booking: updatedBooking });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
