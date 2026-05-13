/**
 * api/room-booking.js — Unified Room Booking Handler
 * Menggabungkan rooms.js + room-bookings.js + room-bookings-admin.js
 * agar tetap dalam batas 12 serverless functions Vercel Hobby.
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

const SUPA_URL = process.env.SUPABASE_URL  || process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY  || process.env.VITE_SUPABASE_ANON_KEY;
const FONNTE   = process.env.FONNTE_TOKEN;

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

// ── WA helper ─────────────────────────────────────────────────
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

// ── Auth helper — verifikasi admin ───────────────────────────
async function verifyAdmin(username) {
  if (!username) return null;
  const rows = await sbGet(
    `users?username=eq.${encodeURIComponent(username)}&select=username,nama,role,can_manage_rooms,disabled`
  );
  const u = rows?.[0];
  if (!u || u.disabled) return null;
  return (u.role === "kabag" || u.can_manage_rooms) ? u : null;
}

// ── Main handler ──────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Username");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { method, query, body } = req;

  try {
    // ── GET ────────────────────────────────────────────────────
    if (method === "GET") {

      // ?op=rooms → list ruangan
      if (query.op === "rooms") {
        const data = await sbGet("rooms?select=*&order=id");
        return res.status(200).json(data);
      }

      // ?admin=1 → admin list (protected)
      if (query.admin === "1") {
        const username = req.headers["x-username"] || query.username;
        const admin = await verifyAdmin(username);
        if (!admin) return res.status(403).json({ error: "Akses ditolak." });

        let filters = "select=*,rooms(name,capacity)";
        if (query.status)  filters += `&status=eq.${query.status}`;
        if (query.room_id) filters += `&room_id=eq.${query.room_id}`;
        if (query.from)    filters += `&start_date=gte.${query.from}`;
        if (query.to)      filters += `&end_date=lte.${query.to}`;

        const rows = await sbGet(`room_bookings?${filters}&order=created_at.desc&limit=200`);
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
      if (query.pic_wa) {
        const wa = query.pic_wa.replace(/\D/g, "");
        const rows = await sbGet(
          `room_bookings?pic_wa=ilike.*${wa}*&select=*,rooms(name,capacity)&order=created_at.desc&limit=20`
        );
        return res.status(200).json(rows);
      }

      // ?month=YYYY-MM → kalender (default: bulan ini)
      const monthStr = query.month || new Date().toISOString().slice(0, 7);
      const [year, month] = monthStr.split("-").map(Number);
      const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay  = new Date(year, month, 0).toISOString().slice(0, 10);

      const rows = await sbGet(
        `room_bookings?select=*,rooms(name,capacity)` +
        `&status=in.(Pending,Approved)` +
        `&start_date=lte.${lastDay}&end_date=gte.${firstDay}` +
        `&order=start_date.asc`
      );
      return res.status(200).json(rows);
    }

    // ── POST — submit pengajuan publik ─────────────────────────
    if (method === "POST") {
      const {
        room_id, instansi, pic_name, pic_wa, event_name,
        participant_count, start_date, end_date, session,
        srikandi_ref, document_path,
      } = body || {};

      const required = { room_id, instansi, pic_name, pic_wa, event_name, participant_count, start_date, end_date, session };
      for (const [k, v] of Object.entries(required)) {
        if (v === undefined || v === null || v === "") {
          return res.status(400).json({ error: `Field '${k}' wajib diisi` });
        }
      }
      if (!["Pagi", "Siang", "Full_Day"].includes(session))
        return res.status(400).json({ error: "Sesi tidak valid" });
      if (new Date(end_date) < new Date(start_date))
        return res.status(400).json({ error: "Tanggal selesai tidak boleh sebelum tanggal mulai" });

      const isMultiDay = end_date !== start_date;
      if (isMultiDay && !srikandi_ref && !document_path)
        return res.status(400).json({
          error: "Peminjaman lebih dari 1 hari wajib melampirkan nomor Srikandi atau file surat",
        });

      const rooms = await sbGet(`rooms?id=eq.${room_id}&select=*`);
      const room  = rooms?.[0];
      if (!room) return res.status(400).json({ error: "Ruangan tidak ditemukan" });
      if (Number(participant_count) > room.capacity)
        return res.status(400).json({
          error: `Jumlah peserta (${participant_count}) melebihi kapasitas ${room.name} (${room.capacity} orang)`,
        });

      const cs = conflictSessions(session);
      const conflicts = await sbGet(
        `room_bookings?room_id=eq.${room_id}&status=eq.Approved` +
        `&start_date=lte.${end_date}&end_date=gte.${start_date}` +
        `&session=in.(${cs.join(",")})&select=id,start_date,end_date,session,event_name`
      );
      if (conflicts?.length) {
        const c = conflicts[0];
        return res.status(409).json({
          error: `Ruangan sudah dipesan (${c.event_name}) pada ${c.start_date}–${c.end_date} sesi ${sessionLabel(c.session)}`,
          conflicts,
        });
      }

      const newRows = await sbPost("room_bookings", {
        room_id: Number(room_id), instansi, pic_name,
        pic_wa: String(pic_wa).replace(/\D/g, ""),
        event_name, participant_count: Number(participant_count),
        start_date, end_date, session,
        srikandi_ref: srikandi_ref || null,
        document_path: document_path || null,
        status: "Pending",
      });
      const booking = Array.isArray(newRows) ? newRows[0] : newRows;

      const tanggalStr = start_date === end_date ? start_date : `${start_date} s/d ${end_date}`;

      // WA ke pengelola
      const [managers, kabagList] = await Promise.all([
        sbGet("users?can_manage_rooms=eq.true&select=nama,noWA"),
        sbGet("users?role=eq.kabag&select=nama,noWA"),
      ]);
      const targets = [...(managers||[]),...(kabagList||[])].filter(
        (u,i,a) => u.noWA && a.findIndex(x=>x.noWA===u.noWA)===i
      );
      const adminMsg =
        `*[PENGAJUAN RUANGAN BARU]*\n` +
        `Kode: *${booking.booking_code}*\n` +
        `Ruangan: ${room.name} | Sesi: ${sessionLabel(session)}\n` +
        `Instansi: ${instansi}\nAcara: ${event_name}\n` +
        `PIC: ${pic_name} (${pic_wa})\nTanggal: ${tanggalStr}\n` +
        `Peserta: ${participant_count} orang\n` +
        (srikandi_ref ? `Srikandi: ${srikandi_ref}\n` : "") +
        `\nSilakan validasi di dashboard Kelola Ruangan.`;
      for (const u of targets) await sendWA(u.noWA, adminMsg);

      // WA ke peminjam
      await sendWA(pic_wa,
        `*[PROKOPIM TARAKAN]* Pengajuan peminjaman ruangan diterima.\n\n` +
        `Kode Booking: *${booking.booking_code}*\n` +
        `Ruangan: ${room.name} | ${sessionLabel(session)}\n` +
        `Tanggal: ${tanggalStr}\n\n` +
        `Cek status: prokopim.tarakankota.go.id/pinjamruangan?cek=${booking.booking_code}\n` +
        `Status saat ini: *Menunggu Konfirmasi*`
      );

      return res.status(201).json({ ok: true, booking });
    }

    // ── PUT — admin update status ──────────────────────────────
    if (method === "PUT") {
      const username = req.headers["x-username"] || query.username;
      const admin = await verifyAdmin(username);
      if (!admin) return res.status(403).json({ error: "Akses ditolak." });

      const { id, status, notes } = body || {};
      if (!id) return res.status(400).json({ error: "Field 'id' wajib ada" });
      if (!["Approved","Rejected","Cancelled"].includes(status))
        return res.status(400).json({ error: "Status tidak valid" });

      const rows = await sbGet(`room_bookings?id=eq.${id}&select=*,rooms(name,capacity)`);
      const booking = rows?.[0];
      if (!booking) return res.status(404).json({ error: "Booking tidak ditemukan" });

      if (status === "Approved") {
        const { room_id, start_date, end_date, session } = booking;
        const cs = conflictSessions(session);
        const conflicts = await sbGet(
          `room_bookings?room_id=eq.${room_id}&status=eq.Approved` +
          `&start_date=lte.${end_date}&end_date=gte.${start_date}` +
          `&session=in.(${cs.join(",")})&id=neq.${id}` +
          `&select=id,event_name,start_date,end_date,session`
        );
        if (conflicts?.length)
          return res.status(409).json({
            error: `Konflik: ${conflicts[0].event_name} sudah Approved di tanggal/sesi yang sama`,
          });
      }

      const updated = await sbPatch(`room_bookings?id=eq.${id}`, {
        status, notes: notes || null,
        reviewed_by: admin.username,
        reviewed_at: new Date().toISOString(),
      });

      const tanggalStr = booking.start_date === booking.end_date
        ? booking.start_date : `${booking.start_date} s/d ${booking.end_date}`;

      const msgs = {
        Approved:
          `*[PROKOPIM TARAKAN]* Permohonan peminjaman Anda *DISETUJUI* ✅\n\n` +
          `Kode: *${booking.booking_code}*\n` +
          `Ruangan: ${booking.rooms?.name}\nTanggal: ${tanggalStr}\n` +
          `Sesi: ${sessionLabel(booking.session)}\n\n` +
          `Harap datang tepat waktu. Pastikan ruangan dikembalikan bersih dan rapi.`,
        Rejected:
          `*[PROKOPIM TARAKAN]* Permohonan Anda *DITOLAK* ❌\n\n` +
          `Kode: *${booking.booking_code}*\n` +
          `Ruangan: ${booking.rooms?.name}\nAcara: ${booking.event_name}\n` +
          (notes ? `Alasan: ${notes}\n` : "") +
          `\nSilakan ajukan ulang atau hubungi Bagian Prokopim.`,
        Cancelled:
          `*[PROKOPIM TARAKAN]* Peminjaman Anda *DIBATALKAN* oleh pengelola.\n\n` +
          `Kode: *${booking.booking_code}*\n` +
          (notes ? `Keterangan: ${notes}\n` : "") +
          `Hubungi Bagian Prokopim jika ada pertanyaan.`,
      };
      if (msgs[status] && booking.pic_wa) await sendWA(booking.pic_wa, msgs[status]);

      return res.status(200).json({ ok: true, booking: Array.isArray(updated)?updated[0]:updated });
    }

    // ── DELETE — cancel oleh peminjam ─────────────────────────
    if (method === "DELETE") {
      const { id, code } = query;
      if (!id || !code) return res.status(400).json({ error: "Parameter id dan code wajib ada" });

      const rows = await sbGet(
        `room_bookings?id=eq.${id}&booking_code=eq.${code.toUpperCase()}&select=*`
      );
      if (!rows?.length) return res.status(404).json({ error: "Booking tidak ditemukan atau kode tidak cocok" });

      const booking = rows[0];
      if (booking.status !== "Pending")
        return res.status(400).json({
          error: `Booking berstatus '${booking.status}' tidak bisa dibatalkan. Hubungi pengelola ruangan.`,
        });

      await sbPatch(`room_bookings?id=eq.${id}`, { status:"Cancelled", notes:"Dibatalkan oleh peminjam" });

      const [managers, kabagList] = await Promise.all([
        sbGet("users?can_manage_rooms=eq.true&select=noWA"),
        sbGet("users?role=eq.kabag&select=noWA"),
      ]);
      const targets = [...(managers||[]),...(kabagList||[])].filter(
        (u,i,a) => u.noWA && a.findIndex(x=>x.noWA===u.noWA)===i
      );
      const msg = `*[PEMBATALAN RUANGAN]* Kode *${booking.booking_code}* — ${booking.event_name}\nDibatalkan oleh peminjam (${booking.pic_name}).`;
      for (const u of targets) await sendWA(u.noWA, msg);

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
