/**
 * api/guest.js — Prokopim v1.7 (Synced with Database Schema)
 * Smart Guest Management — Tarakan City
 * ALUR: Tamu -> Admin RK -> Kasubbag -> Kabag -> Pimpinan
 */

const SUPA_URL = process.env.SUPABASE_URL    || process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const FONNTE   = process.env.FONNTE_TOKEN;

function H(prefer) {
  var h = { "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY };
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

// Format tanggal Indonesia (WITA) untuk pesan WA, mis. "Senin, 16 Juni 2026"
function fmtTanggalWA(ymd) {
  if (!ymd) return "";
  try {
    var d = new Date(ymd + "T00:00:00+08:00");
    return d.toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      timeZone: "Asia/Makassar",
    });
  } catch (e) { return ymd; }
}

// 1. GET: queue
async function actionQueue(query) {
  var status   = query.status;
  var pimpinan = query.pimpinan;
  var limit    = parseInt(query.limit || "50", 10);
  var filter   = "order=created_at.desc&limit=" + limit;

  if (status && status !== "all") {
    filter = "status=eq." + encodeURIComponent(status) + "&" + filter;
  } else if (!status) {
    // Menampilkan semua yang masih dalam proses
    filter = "status=in.(pending_rk,pending_kasubbag,pending_kabag,pending_pimpinan)&" + filter;
  }

  if (pimpinan) {
    var label = pimpinan === "wakilwalikota" ? "Wakil Wali Kota" : "Wali Kota";
    filter += "&tujuan_pejabat=eq." + encodeURIComponent(label);
  }

  return sbGet("permohonan_tamu?" + filter);
}

// 2. POST: checkin (Entry Point Baru ke Admin RK)
async function actionCheckin(body) {
  var nama = body.nama || body.name;
  var no_wa = body.no_wa || body.phone;
  
  if (!nama || !no_wa || !body.maksud_keperluan) throw new Error("Field wajib belum lengkap");

  var created = await sbPost({
    nama: nama,
    instansi: body.instansi || "-",
    no_wa: no_wa,
    tujuan_pejabat: body.tujuan_pejabat || "Wali Kota",
    maksud_keperluan: body.maksud_keperluan,
    status: "pending_rk", // Status awal baru
    pesan: body.pesan || null,
    preferensi_tanggal: body.preferred_date || null,
    preferensi_jam: body.preferred_time || null
  });

  await sendWA(no_wa, "✅ *Tamu Terdaftar*\n\nYth. *" + nama + "*,\nPermohonan Anda telah diterima dan sedang diperiksa oleh *Admin RK*.\n\n_Prokopim Tarakan_");
  return { ok: true, id: created[0]?.id };
}

// 3. POST: verify_rk (Admin RK -> Kasubbag)
async function actionVerifyRK(body) {
  if (!body.id) throw new Error("id wajib");
  await sbPatch(body.id, {
    status: "pending_kasubbag",
    catatan_staf: body.notes || "Diverifikasi oleh Admin RK"
  });
  return { ok: true, message: "Diteruskan ke Kasubbag" };
}

// 4. POST: screen (Kasubbag -> Kabag)
async function actionScreen(body) {
  if (!body.id) throw new Error("id wajib");
  await sbPatch(body.id, {
    prioritas: body.prioritas || "Sedang", // Menyesuaikan check constraint ['Tinggi', 'Sedang', 'Rendah']
    catatan_staf: body.catatan_staf || "",
    dikurasi_oleh: body.dikurasi_oleh || "",
    status: "pending_kabag"
  });
  return { ok: true };
}

// 5. POST: forward (Kabag -> Pimpinan)
async function actionForward(body) {
  if (!body.id) throw new Error("id wajib");
  await sbPatch(body.id, {
    telaah_kabag: body.telaah_kabag || "",
    ditelaah_oleh: body.ditelaah_oleh || "",
    status: "pending_pimpinan"
  });
  return { ok: true };
}

// Notifikasi WA konfirmasi penerimaan permohonan (dipanggil dari form publik)
async function actionNotifyNew(body) {
  var nama   = body.nama || body.name || "Pemohon";
  var no_wa  = body.no_wa || body.phone;
  var tujuan = body.tujuan_pejabat || "Pimpinan";
  if (!no_wa) return { ok: false, skipped: true };

  await sendWA(no_wa,
    "✅ *Permohonan Audiensi Diterima*\n\n" +
    "Yth. *" + nama + "*,\n" +
    "Permohonan audiensi Anda kepada *" + tujuan + "* telah kami terima dan sedang diproses oleh Tim Protokol.\n\n" +
    "Anda akan menerima pemberitahuan melalui WhatsApp ini begitu ada keputusan dan penjadwalan dari pimpinan.\n\n" +
    "_Bagian Prokopim Setda Kota Tarakan_");
  return { ok: true };
}

// 6. POST: respond (Pimpinan: approved/rejected/disposed)
async function actionRespond(body) {
  if (!body.id || !body.response) throw new Error("id & response wajib");

  // Ambil data tamu untuk notifikasi WA
  var guest = {};
  try {
    var rows = await sbGet("permohonan_tamu?id=eq." + body.id +
      "&select=nama,no_wa,tujuan_pejabat&limit=1");
    guest = (rows && rows[0]) || {};
  } catch (e) { /* tetap lanjut update walau gagal baca */ }

  var updateData = { status: body.response, diputuskan_oleh: body.responded_by || "" };

  if (body.response === "approved") {
    updateData.jadwal_tanggal = body.scheduled_date || null;
    updateData.jadwal_jam = body.scheduled_time || null;
  } else if (body.response === "rejected") {
    updateData.alasan_tolak = body.reason || body.alasan_tolak || "";
  } else if (body.response === "disposed") {
    updateData.disposisi_ke = body.disposed_to || body.disposisi_ke || "";
  }

  await sbPatch(body.id, updateData);

  // ── Notifikasi WA ke pemohon sesuai keputusan ──
  if (guest.no_wa) {
    var pejabat = guest.tujuan_pejabat || "Pimpinan";
    var nama    = guest.nama || "Pemohon";
    var msg     = null;

    if (body.response === "approved") {
      var jadwalStr = "";
      if (updateData.jadwal_tanggal) {
        jadwalStr = "\n🗓️ *Jadwal:* " + fmtTanggalWA(updateData.jadwal_tanggal) +
          (updateData.jadwal_jam ? ", pukul " + String(updateData.jadwal_jam).slice(0,5) + " WITA" : "");
      }
      msg =
        "✅ *Audiensi Disetujui*\n\n" +
        "Yth. *" + nama + "*,\n" +
        "Permohonan audiensi Anda kepada *" + pejabat + "* telah *DISETUJUI*." +
        jadwalStr + "\n\n" +
        "📍 Lokasi: Ruang Pimpinan, Kantor Wali Kota Tarakan.\n" +
        "Mohon hadir 15 menit sebelum jadwal dan membawa identitas diri.\n\n" +
        "_Bagian Prokopim Setda Kota Tarakan_";
    } else if (body.response === "rejected") {
      msg =
        "🙏 *Pemberitahuan Permohonan Audiensi*\n\n" +
        "Yth. *" + nama + "*,\n" +
        "Mohon maaf, permohonan audiensi Anda kepada *" + pejabat +
        "* belum dapat kami penuhi saat ini." +
        (updateData.alasan_tolak ? "\n\n📝 Keterangan: " + updateData.alasan_tolak : "") +
        "\n\nAnda dipersilakan mengajukan kembali di lain waktu.\n\n" +
        "_Bagian Prokopim Setda Kota Tarakan_";
    } else if (body.response === "disposed") {
      msg =
        "↪️ *Permohonan Diteruskan*\n\n" +
        "Yth. *" + nama + "*,\n" +
        "Permohonan audiensi Anda telah diteruskan kepada *" +
        (updateData.disposisi_ke || "unit terkait") +
        "* untuk ditindaklanjuti. Tim terkait akan menghubungi Anda lebih lanjut.\n\n" +
        "_Bagian Prokopim Setda Kota Tarakan_";
    }
    if (msg) await sendWA(guest.no_wa, msg);
  }

  return { ok: true };
}

// ── HANDLER ──────────────────────────────────────────────────
export default async function handler(req, res) {
  var action = req.query.action;
  try {
    var result;
    if (req.method === "GET" && action === "queue") {
      result = await actionQueue(req.query);
    } else if (req.method === "POST") {
      if      (action === "checkin")    result = await actionCheckin(req.body);
      else if (action === "notify_new") result = await actionNotifyNew(req.body);
      else if (action === "verify_rk")  result = await actionVerifyRK(req.body);
      else if (action === "screen")     result = await actionScreen(req.body);
      else if (action === "forward")    result = await actionForward(req.body);
      else if (action === "respond")    result = await actionRespond(req.body);
      else throw new Error("Action " + action + " tidak dikenal");
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
