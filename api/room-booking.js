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

// ── Push notification helper ──────────────────────────────────
async function sendPushToManagers({ title, body, url, tag }) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  let webpush;
  try { webpush = (await import("web-push")).default || (await import("web-push")); }
  catch { return; }
  try { webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE); }
  catch { return; }

  // Ambil username pengelola ruangan + kabag
  const [managers, kabagList] = await Promise.all([
    sbGet("users?can_manage_rooms=eq.true&select=username").catch(()=>[]),
    sbGet("users?role=eq.kabag&select=username").catch(()=>[]),
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
function genBookingCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
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

    // ── POST — submit pengajuan publik (multi-slot) ────────────
    if (method === "POST") {
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
        `Kode: *${booking_code}*\n` +
        `Ruangan: ${room.name}\nInstansi: ${instansi}\nAcara: ${event_name}\n` +
        `PIC: ${pic_name} (${pic_wa})\nPeserta: ${participant_count} orang\n` +
        `Jadwal (${slots.length} slot):\n${slotLines}\n` +
        (srikandi_ref ? `Srikandi: ${srikandi_ref}\n` : "") +
        `\nSilakan validasi di dashboard Kelola Ruangan.`;
      for (const u of targets) await sendWA(u.noWA, adminMsg);

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
        `Status saat ini: *Menunggu Konfirmasi*`
      );

      return res.status(201).json({
        ok: true,
        booking: { booking_code, slots: slots.length },
      });
    }

    // ── PUT — admin update status ──────────────────────────────
    if (method === "PUT") {
      const username = req.headers["x-username"] || query.username;
      const admin = await verifyAdmin(username);
      if (!admin) return res.status(403).json({ error: "Akses ditolak." });

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
        { status, notes: notes || null, reviewed_by: admin.username, reviewed_at: new Date().toISOString() }
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
          `*[PROKOPIM TARAKAN]* Peminjaman Anda *DIBATALKAN* oleh pengelola.\n\n` +
          `Kode: *${head.booking_code}*\n` +
          (notes ? `Keterangan: ${notes}\n` : "") +
          `Hubungi Bagian Prokopim jika ada pertanyaan.`,
      };
      if (msgs[status] && head.pic_wa) await sendWA(head.pic_wa, msgs[status]);

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
          error: `Pengajuan sudah diproses (status '${booking.status}') dan tidak bisa dibatalkan. Hubungi pengelola ruangan.`,
        });

      await sbPatch(`room_bookings?booking_code=eq.${booking.booking_code}`, { status:"Cancelled", notes:"Dibatalkan oleh peminjam" });

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
