/**
 * api/guest.js — Prokopim v1.6
 * Smart Guest Management — Backend API
 *
 * TABEL : permohonan_tamu
 * STATUS : pending_kasubbag → pending_kabag → pending_pimpinan
 *          → accepted | rejected | disposed
 */

const SUPA_URL = process.env.SUPABASE_URL  || process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY
              || process.env.SUPABASE_KEY
              || process.env.VITE_SUPABASE_ANON_KEY;
const FONNTE   = process.env.FONNTE_TOKEN;

function H(prefer) {
  var h = {
    "Content-Type":  "application/json",
    "apikey":        SUPA_KEY,
    "Authorization": "Bearer " + SUPA_KEY,
  };
  if (prefer) h["Prefer"] = prefer;
  return h;
}

async function sbGet(path) {
  var r = await fetch(SUPA_URL + "/rest/v1/" + path, { headers: H() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbPost(body) {
  var r = await fetch(SUPA_URL + "/rest/v1/permohonan_tamu", {
    method: "POST",
    headers: H("return=representation"),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function sbPatch(id, body) {
  var r = await fetch(SUPA_URL + "/rest/v1/permohonan_tamu?id=eq." + id, {
    method: "PATCH",
    headers: H("return=minimal"),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return true;
}

async function sendWA(to, message) {
  if (!FONNTE || !to) return;
  try {
    await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { "Authorization": FONNTE, "Content-Type": "application/json" },
      body: JSON.stringify({ target: to, message: message, countryCode: "62" }),
    });
  } catch (e) { console.warn("[WA guest]", e.message); }
}

// GET: queue
async function actionQueue(query) {
  var status   = query.status;
  var pimpinan = query.pimpinan;
  var limit    = parseInt(query.limit || "50", 10);
  var filter   = "order=created_at.asc&limit=" + limit;

  if (status && status !== "all") {
    filter = "status=eq." + encodeURIComponent(status) + "&" + filter;
  } else if (!status) {
    filter = "status=in.(pending_kasubbag,pending_kabag,pending_pimpinan)&" + filter;
  }

  if (pimpinan) {
    var label = pimpinan === "wakilwalikota" ? "Wakil Wali Kota" : "Wali Kota";
    filter += "&tujuan_pejabat=eq." + encodeURIComponent(label);
  }

  return sbGet("permohonan_tamu?" + filter);
}

// POST: checkin
async function actionCheckin(body) {
  var nama             = body.name       || body.nama;
  var instansi         = body.organization || body.instansi || "-";
  var no_wa            = body.phone      || body.no_wa;
  var tujuan_pejabat   = body.tujuan_pejabat || "Wali Kota";
  var maksud_keperluan = body.purpose    || body.maksud_keperluan;
  var pesan            = body.message    || body.pesan    || null;

  if (!nama || !no_wa || !maksud_keperluan) {
    throw new Error("Nama, nomor WhatsApp, dan keperluan wajib diisi");
  }

  var existing = await sbGet(
    "permohonan_tamu?no_wa=eq." + encodeURIComponent(no_wa) +
    "&status=in.(pending_kasubbag,pending_kabag,pending_pimpinan)&select=id&limit=1"
  );
  if (existing.length > 0) {
    throw new Error("Nomor WhatsApp ini masih memiliki permohonan aktif.");
  }

  var created = await sbPost({
    nama: nama, instansi: instansi, no_wa: no_wa,
    tujuan_pejabat: tujuan_pejabat,
    maksud_keperluan: maksud_keperluan,
    pesan: pesan,
    preferensi_tanggal: body.preferred_date || null,
    preferensi_jam:     body.preferred_time || null,
    status: "pending_kasubbag",
    butuh_aksesibilitas:  body.butuh_aksesibilitas  || false,
    detail_aksesibilitas: body.detail_aksesibilitas || null,
  });

  await sendWA(no_wa,
    "✅ *Konfirmasi Pendaftaran Audiensi*\n\n" +
    "Terima kasih, *" + nama + "*, permohonan audiensi Anda di *Kantor Wali Kota Tarakan* telah diterima.\n\n" +
    "📋 Keperluan: " + maksud_keperluan + "\n\n" +
    "Kami akan menghubungi Anda setelah jadwal dikonfirmasi oleh Pimpinan.\n\n" +
    "_Prokopim — Pemerintah Kota Tarakan_"
  );

  return { ok: true, id: created[0] && created[0].id, message: "Pendaftaran berhasil!" };
}

// POST: screen — Kasubbag → pending_kabag
async function actionScreen(body) {
  if (!body.id) throw new Error("id tamu wajib");
  await sbPatch(body.id, {
    prioritas:    body.priority    || body.prioritas    || "biasa",
    catatan_staf: body.staff_notes || body.catatan_staf || "",
    dikurasi_oleh:body.screened_by || body.dikurasi_oleh|| "",
    status:       "pending_kabag",
  });
  return { ok: true, message: "Dinaikkan ke Kabag ✓" };
}

// POST: forward — Kabag → pending_pimpinan
async function actionForward(body) {
  if (!body.id) throw new Error("id tamu wajib");
  await sbPatch(body.id, {
    telaah_kabag:  body.kabag_notes  || body.telaah_kabag  || "",
    prioritas:     body.priority     || body.prioritas      || "biasa",
    ditelaah_oleh: body.forwarded_by || body.ditelaah_oleh  || "",
    status:        "pending_pimpinan",
  });
  return { ok: true, message: "Diteruskan ke Pimpinan ✓" };
}

// POST: return_to_staff — Kabag kembalikan ke pending_kasubbag
async function actionReturnToStaff(body) {
  if (!body.id) throw new Error("id tamu wajib");
  await sbPatch(body.id, {
    telaah_kabag:  body.kabag_notes || body.telaah_kabag || "(Dikembalikan oleh Kabag)",
    dikurasi_oleh: body.returned_by || "",
    status:        "pending_kasubbag",
  });
  return { ok: true, message: "Dikembalikan ke Kasubbag ✓" };
}

// POST: respond — Pimpinan
async function actionRespond(body) {
  if (!body.id || !body.response) throw new Error("id dan response wajib");

  var rows = await sbGet("permohonan_tamu?id=eq." + body.id + "&limit=1");
  if (!rows.length) throw new Error("Tamu tidak ditemukan");
  var tamu = rows[0];

  var updateData = { status: body.response, diputuskan_oleh: body.responded_by || "" };
  var waMessage  = "";

  if (body.response === "accepted") {
    if (body.scheduled_date) updateData.jadwal_tanggal = body.scheduled_date;
    if (body.scheduled_time) updateData.jadwal_jam     = body.scheduled_time;
    waMessage =
      "🎉 *Permohonan Audiensi Diterima*\n\nYth. *" + tamu.nama + "*,\n\n" +
      "Permohonan audiensi Anda telah *DITERIMA*.\n\n" +
      (body.scheduled_date
        ? "📅 Jadwal: *" + body.scheduled_date + "* pukul *" + body.scheduled_time + " WITA*\n"
        : "📅 Jadwal dikonfirmasi lebih lanjut oleh Tim Prokopim.\n") +
      "📍 Lokasi: Ruang Pimpinan, Kantor Wali Kota Tarakan\n\n" +
      "_Prokopim — Pemerintah Kota Tarakan_";

  } else if (body.response === "disposed") {
    updateData.disposisi_ke = body.disposed_to || body.disposisi_ke || "";
    waMessage =
      "📋 *Update Permohonan*\n\nYth. *" + tamu.nama + "*,\n\n" +
      "Permohonan Anda didisposisi kepada " + (updateData.disposisi_ke || "pejabat terkait") + ".\n\n" +
      "_Prokopim — Pemerintah Kota Tarakan_";

  } else if (body.response === "rejected") {
    updateData.alasan_tolak = body.rejection_reason || body.alasan_tolak || "";
    waMessage =
      "📋 *Update Permohonan*\n\nYth. *" + tamu.nama + "*,\n\n" +
      "Mohon maaf, permohonan Anda belum dapat dipenuhi saat ini" +
      (updateData.alasan_tolak ? ": " + updateData.alasan_tolak : "") + ".\n\n" +
      "_Prokopim — Pemerintah Kota Tarakan_";
  }

  await sbPatch(body.id, updateData);
  if (waMessage && tamu.no_wa) await sendWA(tamu.no_wa, waMessage);

  return { ok: true, message: "Respons berhasil ✓" };
}

// POST: verify_wa
async function actionVerifyWA(body) {
  if (!body.id) throw new Error("id tamu wajib");
  var rows = await sbGet("permohonan_tamu?id=eq." + body.id + "&limit=1");
  if (!rows.length) throw new Error("Tamu tidak ditemukan");
  var tamu = rows[0];

  await sendWA(tamu.no_wa,
    "📋 *Verifikasi Permohonan Audiensi*\n\nYth. *" + tamu.nama + "*,\n\n" +
    "Permohonan audiensi Anda sedang diverifikasi oleh Tim Protokol Kota Tarakan.\n\n" +
    "Kami akan segera menghubungi Anda.\n\n_Prokopim — Pemerintah Kota Tarakan_"
  );

  return { ok: true, message: "WA verifikasi terkirim ke " + tamu.no_wa };
}

// ── MAIN HANDLER ─────────────────────────────────────────────
export default async function handler(req, res) {
  var action = req.query.action;
  try {
    var result;
    if (req.method === "GET") {
      if      (action === "queue")           result = await actionQueue(req.query);
      else return res.status(400).json({ error: "Action tidak dikenal: " + action });
    } else if (req.method === "POST") {
      var body = req.body;
      if      (action === "checkin")         result = await actionCheckin(body);
      else if (action === "screen")          result = await actionScreen(body);
      else if (action === "forward")         result = await actionForward(body);
      else if (action === "return_to_staff") result = await actionReturnToStaff(body);
      else if (action === "respond")         result = await actionRespond(body);
      else if (action === "verify_wa")       result = await actionVerifyWA(body);
      else return res.status(400).json({ error: "Action tidak dikenal: " + action });
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error("[GUEST]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
