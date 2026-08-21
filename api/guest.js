/**
 * api/guest.js — Prokopim v1.7 (Synced with Database Schema)
 * Smart Guest Management — Tarakan City
 * ALUR: Tamu -> Admin RK -> Kasubbag -> Kabag -> Pimpinan
 */

const SUPA_URL = process.env.SUPABASE_URL    || process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const FONNTE   = process.env.FONNTE_TOKEN;

// Narahubung Admin Prokopim & footer otomatis untuk semua pesan WA
const ADMIN_WA  = "0811-5961-116";
const WA_FOOTER =
  "\n\n_Bagian Prokopim Setda Kota Tarakan_" +
  "\n📞 Narahubung Admin: " + ADMIN_WA +
  "\n\n_🤖 Pesan ini dikirim otomatis oleh sistem #prokopimhibot dan tidak perlu dibalas._";

function H(prefer) {
  var h = { "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY };
  if (prefer) h["Prefer"] = prefer;
  return h;
}

// ── Pengaman halaman publik /tamu ────────────────────────────
// Formulir ini terbuka tanpa login, jadi satu orang bisa menekan kirim
// berkali-kali dan membanjiri antrian Admin RK. Tiga lapis penahan:
//   1. jeda antar pengajuan dari nomor WA yang sama,
//   2. batas permohonan yang masih berjalan per nomor,
//   3. kolom umpan (honeypot) yang hanya terisi oleh bot.
// Semua bersandar pada basis data, bukan memori proses, supaya tetap
// berlaku meski Vercel menyalakan instance baru.
var JEDA_KIRIM_MENIT = 10;
var MAKS_PERMOHONAN_AKTIF = 3;
var STATUS_AKTIF = ["pending_rk", "pending_kasubbag", "pending_kabag", "pending_pimpinan"];

// 0812…, 62812…, dan +62 812… harus dikenali sebagai orang yang sama.
function normalWA(v) {
  var d = String(v || "").replace(/\D/g, "");
  if (d.slice(0, 2) === "62") d = "0" + d.slice(2);
  else if (d.slice(0, 1) === "8") d = "0" + d;
  return d;
}

async function pastikanTidakSpam(noWA) {
  var wa = normalWA(noWA);
  if (wa.length < 8) throw new Error("Nomor WhatsApp tidak valid.");

  // Cocokkan berdasarkan 9 digit terakhir agar tahan beda format penulisan.
  var ekor = wa.slice(-9);
  var rows = await sbGet(
    "permohonan_tamu?no_wa=like.*" + encodeURIComponent(ekor) +
    "&select=created_at,status&order=created_at.desc&limit=20"
  );
  if (!rows || !rows.length) return;

  var terakhir = rows[0] && rows[0].created_at ? new Date(rows[0].created_at).getTime() : 0;
  var selisihMenit = (Date.now() - terakhir) / 60000;
  if (terakhir && selisihMenit < JEDA_KIRIM_MENIT) {
    var sisa = Math.max(1, Math.ceil(JEDA_KIRIM_MENIT - selisihMenit));
    throw new Error(
      "Permohonan Anda sebelumnya baru saja masuk. Mohon tunggu " + sisa +
      " menit lagi sebelum mengirim permohonan baru."
    );
  }

  var aktif = rows.filter(function (r) { return STATUS_AKTIF.indexOf(r.status) !== -1; }).length;
  if (aktif >= MAKS_PERMOHONAN_AKTIF) {
    throw new Error(
      "Masih ada " + aktif + " permohonan Anda yang sedang diproses. " +
      "Mohon tunggu sampai permohonan tersebut selesai sebelum mengajukan yang baru."
    );
  }
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

// Patch/delete generik (sbPatch di atas khusus tabel permohonan_tamu).
//
// PENTING: memakai return=representation, BUKAN return=minimal. Dengan
// return=minimal PostgREST membalas 204 No Content walaupun filternya tidak
// cocok dengan satu baris pun (mis. baris tersaring RLS) — sehingga r.ok
// bernilai true dan penulisan yang sebenarnya gagal terlihat seperti sukses.
// Dengan representation kita bisa memastikan barisnya benar-benar tersentuh.
async function sbPatchRow(table, id, body) {
  var r = await fetch(SUPA_URL + "/rest/v1/" + table + "?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: H("return=representation"),
    body: JSON.stringify(body),
  });
  var txt = await r.text();
  if (!r.ok) throw new Error("PATCH " + table + " gagal (HTTP " + r.status + "): " + txt.slice(0, 200));
  var out = [];
  try { out = JSON.parse(txt); } catch (e) {}
  if (!Array.isArray(out) || out.length === 0) {
    throw new Error("PATCH " + table + " tidak mengenai baris mana pun (id=" + id +
      "). Kemungkinan baris tersaring RLS atau kunci API tidak berwenang menulis.");
  }
  return out[0];
}

async function sbDeleteRow(table, id) {
  var r = await fetch(SUPA_URL + "/rest/v1/" + table + "?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: H("return=minimal"),
  });
  if (!r.ok) throw new Error(await r.text());
  return true;
}

/**
 * Sinkronkan perubahan jadwal tamu ke entri Agenda yang sudah dibuat.
 *
 * Sebelumnya pekerjaan ini dilakukan di browser (dua tempat, dua cara berbeda)
 * sehingga rapuh: hasil PATCH tidak pernah diperiksa, dan bila agenda tertaut
 * tidak ketemu di memori klien maka justru dibuatkan agenda BARU (duplikat).
 * Di sini pencarian dilakukan langsung ke database sehingga hasilnya pasti.
 *
 * Hanya tanggal/jam/lokasi yang ditimpa — judul acara, kontak, dan catatan
 * dibiarkan apa adanya supaya suntingan manual petugas di agenda tidak hilang.
 */
// Bangun entri Agenda dari baris permohonan_tamu (kembaran buildAgendaFromGuest
// di frontend, tapi dijalankan di server memakai service key)
function buildAgendaRow(g, tempat) {
  var pejabatKey = (g.tujuan_pejabat === "Wakil Wali Kota") ? "wakilwalikota" : "walikota";
  var nama = g.nama || g.name || "Tamu";
  var inst = g.instansi || g.organization || "";
  var evId = Date.now();
  return {
    id: evId,
    tanggal: g.jadwal_tanggal || "",
    jam: g.jadwal_jam || "",
    namaAcara: "Audiensi: " + nama + (inst ? " (" + inst + ")" : ""),
    penyelenggara: inst || nama,
    kontak: g.no_wa || g.phone || "-",
    buktiUndangan: "Permohonan Tamu #" + String(g.id).slice(-6),
    pakaian: "Batik Lengan Panjang", jenisKegiatan: "Menghadiri",
    lokasi: tempat || "Ruang Kerja",
    untukPimpinan: [pejabatKey], alur: "disetujui",
    catatan: "Maksud: " + (g.maksud_keperluan || g.purpose || "-") +
             (g.telaah_kabag ? " | Telaah Kabag: " + g.telaah_kabag : ""),
    statusWK:  pejabatKey === "walikota"      ? "hadir" : null,
    statusWWK: pejabatKey === "wakilwalikota" ? "hadir" : null,
    submittedBy: g.diputuskan_oleh || "pimpinan",
    personil: [], evaluasi: {}, created_from: "guest_module", guest_id: g.id,
  };
}

async function sbInsertRow(table, body) {
  var r = await fetch(SUPA_URL + "/rest/v1/" + table, {
    method: "POST",
    headers: H("return=representation"),   // lihat catatan di sbPatchRow
    body: JSON.stringify(body),
  });
  var txt = await r.text();
  if (!r.ok) throw new Error("INSERT " + table + " gagal (HTTP " + r.status + "): " + txt.slice(0, 200));
  var out = [];
  try { out = JSON.parse(txt); } catch (e) {}
  if (!Array.isArray(out) || out.length === 0) {
    throw new Error("INSERT " + table + " tidak menghasilkan baris. " +
      "Kemungkinan tertahan RLS atau kunci API tidak berwenang menulis.");
  }
  return out[0];
}

// Cari seluruh baris agenda yang tertaut ke satu tamu (urut: terlama dulu)
async function findAgendaRows(guestId) {
  var idStr = String(guestId);
  var last6 = idStr.slice(-6);

  var rows = [];
  try {
    rows = await sbGet("jadwal?select=id,data&data->>guest_id=eq." + encodeURIComponent(idStr));
  } catch (e) { rows = []; }

  // Agenda lama dibuat sebelum field guest_id ada → cocokkan lewat buktiUndangan
  if (!rows || !rows.length) {
    try {
      var all = await sbGet("jadwal?select=id,data&data->>created_from=eq.guest_module");
      rows = (all || []).filter(function (r) {
        var d = r.data || {};
        return String(d.guest_id || "") === idStr ||
               String(d.buktiUndangan || "").indexOf(last6) >= 0;
      });
    } catch (e) { rows = []; }
  }
  if (!rows || !rows.length) return [];

  // id terkecil = agenda yang paling dulu dibuat → itu yang dipertahankan
  rows.sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
  return rows;
}

/**
 * Pastikan tamu punya SATU entri agenda yang benar.
 *
 * Bila sudah ada  → perbarui tanggal/jam/lokasi, hapus duplikatnya.
 * Bila belum ada  → buatkan agendanya di sini (dulu pembuatan dilakukan dari
 *                   browser, sehingga bergantung pada kunci Supabase di klien
 *                   dan bisa gagal tanpa pesan yang jelas).
 *
 * Hanya tanggal/jam/lokasi yang ditimpa saat memperbarui — judul acara,
 * kontak, dan catatan dibiarkan agar suntingan manual petugas tidak hilang.
 */
async function syncAgendaJadwal(guestId, agendaPatch, opts) {
  opts = opts || {};
  var rows = await findAgendaRows(guestId);

  if (!rows.length) {
    if (!opts.createIfMissing) return { linked: 0, updated: 0, removed: 0, created: 0 };

    var g = (await sbGet("permohonan_tamu?id=eq." + encodeURIComponent(guestId) + "&select=*&limit=1"))[0];
    if (!g) throw new Error("Data tamu tidak ditemukan");
    if (!g.jadwal_tanggal) throw new Error("Tamu ini belum punya tanggal audiensi");

    var row = buildAgendaRow(g, opts.tempat);
    Object.assign(row, agendaPatch || {});           // hormati tanggal/jam/tempat terbaru
    await sbInsertRow("jadwal", { id: row.id, data: row });
    return {
      linked: 0, updated: 0, removed: 0, created: 1, agenda_id: row.id,
      tanggal: row.tanggal, jam: row.jam, lokasi: row.lokasi,
      alur: row.alur, ditarik: false,
    };
  }

  var keep = rows[0];
  var hasil = Object.assign({}, keep.data, agendaPatch);

  // "Tarik dari Publikasi" tidak menghapus baris agenda — hanya mengubah
  // alur jadi menunggu_kasubbag, sedangkan tab Agenda cuma menampilkan yang
  // "disetujui". Karena penyelarasan hanya menimpa tanggal/jam/lokasi, entri
  // yang ditarik tetap tidak muncul meski jadwalnya sudah benar. Penayangan
  // ulang karena itu harus diminta secara eksplisit, bukan efek samping.
  if (opts.tayangkan) { hasil.alur = "disetujui"; hasil.alurHapus = null; }

  await sbPatchRow("jadwal", keep.id, { data: hasil });

  // Bereskan agenda ganda yang terlanjur dibuat oleh alur lama
  var removed = 0;
  for (var i = 1; i < rows.length; i++) {
    try { await sbDeleteRow("jadwal", rows[i].id); removed++; } catch (e) {}
  }

  var alur = hasil.alur || "disetujui";
  return {
    linked: rows.length, updated: 1, removed: removed, created: 0, agenda_id: keep.id,
    tanggal: hasil.tanggal, jam: hasil.jam, lokasi: hasil.lokasi,
    alur: alur, ditarik: alur !== "disetujui",
  };
}

// Peran yang boleh menayangkan ulang agenda yang ditarik Kabag.
// Catatan: endpoint tamu belum bergerbang token (berbeda dari api/room-booking
// yang memakai verifyAdmin), jadi ini pagar di tingkat antarmuka — mengikuti
// pola modul tamu yang ada, bukan batas keamanan.
var BOLEH_TAYANG_ULANG = ["kabag", "kasubbag_protokol", "admin_rk"];

// POST: sync_agenda — tombol "Tambahkan ke Agenda" (buat bila belum ada,
// perbarui + rapikan duplikat bila sudah ada)
async function actionSyncAgenda(body) {
  if (!body.id) throw new Error("id wajib");

  // Jadwal diambil dari database, bukan dari salinan di browser yang bisa
  // basi — tombol "Selaraskan" harus mengikuti kondisi terkini tamu.
  var g = (await sbGet("permohonan_tamu?id=eq." + encodeURIComponent(body.id) + "&select=*&limit=1"))[0];
  if (!g) throw new Error("Data tamu tidak ditemukan");
  if (!g.jadwal_tanggal) throw new Error("Tamu ini belum punya tanggal audiensi — tetapkan jadwalnya dulu");

  var patch = { tanggal: g.jadwal_tanggal };
  if (g.jadwal_jam)  patch.jam    = g.jadwal_jam;
  if (body.tempat)   patch.lokasi = String(body.tempat).trim();

  // Penayangan ulang membatalkan tindakan koreksi Kabag, jadi dibatasi pada
  // peran yang memang berwenang atas alur tayang.
  var bolehTayang = BOLEH_TAYANG_ULANG.indexOf(String(body.role || "")) >= 0;

  var agenda = await syncAgendaJadwal(body.id, patch, {
    createIfMissing: true,
    tempat: body.tempat ? String(body.tempat).trim() : "",
    tayangkan: !!body.tayangkan && bolehTayang,
  });
  if (body.tayangkan && !bolehTayang) agenda.tayang_ditolak = true;

  return {
    ok: true,
    agenda: agenda,
    message: agenda.created ? "Agenda dibuat"
      : "Agenda diperbarui" + (agenda.removed ? " (" + agenda.removed + " duplikat dirapikan)" : ""),
  };
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

  // Kolom umpan: tidak terlihat manusia, hanya bot pengisi-otomatis yang
  // mengisinya. Dibalas seolah berhasil agar bot tidak belajar menghindar.
  if (String(body.website || body.alamat_web || "").trim()) {
    return { ok: true, id: null };
  }
  await pastikanTidakSpam(no_wa);

  var tujuan = body.tujuan_pejabat || "Wali Kota";
  var created = await sbPost({
    nama: nama,
    instansi: body.instansi || "-",
    no_wa: normalWA(no_wa),
    tujuan_pejabat: tujuan,
    maksud_keperluan: body.maksud_keperluan,
    status: "pending_rk", // Status awal baru
    pesan: body.pesan || null,
    preferensi_tanggal: body.preferensi_tanggal || body.preferred_date || null,
    preferensi_jam: body.preferensi_jam || body.preferred_time || null,
    butuh_aksesibilitas: body.butuh_aksesibilitas || false,
    detail_aksesibilitas: body.detail_aksesibilitas || null
  });

  // Formulir publik memakai sapaan audiensi; pemanggil lain memakai sapaan
  // pendaftaran tamu seperti sebelumnya.
  var pesanWA = body.sumber === "publik"
    ? "✅ *Permohonan Audiensi Diterima*\n\nYth. *" + nama + "*,\n" +
      "Permohonan audiensi Anda kepada *" + tujuan + "* telah kami terima dan sedang diproses oleh Tim Protokol.\n\n" +
      "Anda akan menerima pemberitahuan melalui WhatsApp ini begitu ada keputusan dan penjadwalan dari pimpinan."
    : "✅ *Tamu Terdaftar*\n\nYth. *" + nama + "*,\nPermohonan Anda telah diterima dan sedang diperiksa oleh *Admin RK*.";
  await sendWA(no_wa, pesanWA + WA_FOOTER);

  return { ok: true, id: created[0]?.id, nama: nama, tujuan_pejabat: tujuan };
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

// 3b. POST: return_to_rk (Kasubbag -> Admin RK untuk verifikasi ulang/perbaikan)
async function actionReturnToRK(body) {
  if (!body.id) throw new Error("id wajib");
  var instruksi = (body.instruksi || body.catatan_staf || body.notes || "").trim();
  if (!instruksi) throw new Error("Instruksi/catatan wajib diisi");
  await sbPatch(body.id, {
    catatan_staf: instruksi,
    dikurasi_oleh: body.returned_by || "",
    status: "pending_rk"
  });
  // Notifikasi WA ke Admin RK (best-effort)
  try {
    var rows = await sbGet("users?role=eq.admin_rk&select=nama,no_wa,noWA");
    var pesan =
      "↩️ *Permohonan Tamu Dikembalikan*\n\n" +
      "Permohonan (#" + String(body.id).slice(-6) + ") dikembalikan oleh Kasubbag Protokol untuk ditindaklanjuti.\n\n" +
      "📝 *Instruksi:*\n" + instruksi + WA_FOOTER;
    for (var i=0; i<(rows||[]).length; i++) {
      var no = rows[i].no_wa || rows[i].noWA;
      if (no) await sendWA(no, pesan);
    }
  } catch (e) {}
  return { ok: true, message: "Dikembalikan ke Admin RK" };
}

// 3c. POST: verify_wa (Kasubbag mengirim WA verifikasi data ke pemohon)
async function actionVerifyWA(body) {
  if (!body.id) throw new Error("id wajib");
  var rows = await sbGet("permohonan_tamu?id=eq." + body.id +
    "&select=nama,no_wa,tujuan_pejabat,maksud_keperluan&limit=1");
  var g = (rows && rows[0]) || {};
  if (!g.no_wa) return { ok: false, skipped: true, message: "Nomor WA tidak ada" };
  var msg =
    "🔍 *Verifikasi Data Permohonan*\n\n" +
    "Yth. *" + (g.nama || "Pemohon") + "*,\n" +
    "Tim Protokol sedang memverifikasi permohonan audiensi Anda kepada *" + (g.tujuan_pejabat || "Pimpinan") + "*.\n\n" +
    "📝 Maksud: " + (g.maksud_keperluan || "-") + "\n\n" +
    "Mohon balas pesan ini bila ada informasi tambahan, atau tunggu kabar selanjutnya dari kami." +
    WA_FOOTER;
  await sendWA(g.no_wa, msg);
  return { ok: true, message: "WA verifikasi terkirim" };
}

// Normalisasi prioritas ke nilai yang diizinkan check constraint DB
// (['Tinggi','Sedang','Rendah']). Aplikasi memakai mendesak/penting/biasa,
// sehingga perlu dipetakan agar tidak melanggar constraint.
function normPrioritas(v) {
  var s = String(v || "").toLowerCase();
  if (s === "mendesak" || s === "tinggi") return "Tinggi";
  if (s === "penting"  || s === "sedang") return "Sedang";
  if (s === "biasa"    || s === "rendah") return "Rendah";
  return "Sedang";
}

// 4. POST: screen (Kasubbag -> Kabag)
async function actionScreen(body) {
  if (!body.id) throw new Error("id wajib");
  await sbPatch(body.id, {
    prioritas: normPrioritas(body.prioritas || body.priority),
    catatan_staf: body.catatan_staf || body.staff_notes || "",
    dikurasi_oleh: body.dikurasi_oleh || body.screened_by || "",
    status: "pending_kabag"
  });
  return { ok: true };
}

// 5. POST: forward (Kabag -> Pimpinan)
async function actionForward(body) {
  if (!body.id) throw new Error("id wajib");
  await sbPatch(body.id, {
    telaah_kabag: body.telaah_kabag || body.kabag_notes || "",
    ditelaah_oleh: body.ditelaah_oleh || body.forwarded_by || "",
    status: "pending_pimpinan"
  });
  return { ok: true };
}

// 5d. POST: mark_selesai (Admin RK/Kabag menandai tamu diterima & diarsipkan)
// Admin RK boleh mengarsipkan dari tahap mana pun (terlepas sudah disetujui
// atau belum). Idempoten bila sudah diarsipkan.
async function actionMarkSelesai(body) {
  if (!body.id) throw new Error("id wajib");
  var rows = await sbGet("permohonan_tamu?id=eq." + body.id + "&select=status&limit=1");
  var g = (rows && rows[0]) || {};
  if (g.status === "selesai") {
    return { ok: true, message: "Permohonan sudah diarsipkan" };
  }
  await sbPatch(body.id, { status: "selesai" });
  return { ok: true, message: "Tamu ditandai diterima & diarsipkan" };
}

// 5a. POST: recall_from_pimpinan (Kabag/Admin RK mencabut dari meja Pimpinan)
// Permohonan dikembalikan ke tahap Kabag untuk diperbaiki/dihapus.
async function actionRecallFromPimpinan(body) {
  if (!body.id) throw new Error("id wajib");
  var alasan = (body.alasan || body.reason || body.notes || "").trim();
  if (!alasan) throw new Error("Alasan pencabutan wajib diisi");

  // Pastikan permohonan masih di Pimpinan (belum diputuskan)
  var rows = await sbGet("permohonan_tamu?id=eq." + body.id + "&select=status,nama,no_wa,tujuan_pejabat&limit=1");
  var g = (rows && rows[0]) || {};
  if (g.status !== "pending_pimpinan") {
    throw new Error("Hanya bisa mencabut permohonan yang masih di meja Pimpinan");
  }

  // Kembalikan ke tahap Kabag; simpan alasan pencabutan di telaah_kabag
  await sbPatch(body.id, {
    status: "pending_kabag",
    telaah_kabag: "[DICABUT DARI PIMPINAN] " + alasan,
    ditelaah_oleh: body.recalled_by || ""
  });

  // Notifikasi WA ke Kabag (best-effort)
  try {
    var krows = await sbGet("users?role=eq.kabag&select=nama,no_wa,noWA");
    var pesan =
      "🔄 *Permohonan Tamu Dicabut dari Pimpinan*\n\n" +
      "Permohonan a.n. *" + (g.nama || "-") + "* (#" + String(body.id).slice(-6) + ") telah dicabut dari meja Pimpinan dan dikembalikan ke tahap Kabag untuk diperbaiki atau dihapus.\n\n" +
      "📝 *Alasan:*\n" + alasan + WA_FOOTER;
    for (var i=0; i<(krows||[]).length; i++) {
      var no = krows[i].no_wa || krows[i].noWA;
      if (no) await sendWA(no, pesan);
    }
  } catch (e) {}

  return { ok: true, message: "Permohonan dicabut dari Pimpinan" };
}

// 5b. POST: return_to_kasubbag (Kabag -> Kasubbag Protokol untuk klarifikasi)
async function actionReturnToKasubbag(body) {
  if (!body.id) throw new Error("id wajib");
  var instruksi = (body.instruksi || body.kabag_notes || body.notes || "").trim();
  if (!instruksi) throw new Error("Instruksi/catatan wajib diisi");

  // Catatan dikembalikan disimpan di telaah_kabag agar Kasubbag bisa membacanya
  await sbPatch(body.id, {
    telaah_kabag: instruksi,
    ditelaah_oleh: body.returned_by || "",
    status: "pending_kasubbag"
  });

  // Notifikasi WA ke Kasubbag Protokol (best-effort) — ambil nomor dari tabel users
  try {
    var rows = await sbGet("users?role=eq.kasubbag_protokol&select=nama,no_wa,noWA");
    var pesanWA =
      "↩️ *Permohonan Tamu Dikembalikan*\n\n" +
      "Permohonan tamu (#" + String(body.id).slice(-6) + ") dikembalikan oleh Kabag untuk ditindaklanjuti.\n\n" +
      "📝 *Instruksi Kabag:*\n" + instruksi + WA_FOOTER;
    for (var i=0; i<(rows||[]).length; i++) {
      var no = rows[i].no_wa || rows[i].noWA;
      if (no) await sendWA(no, pesanWA);
    }
  } catch (e) { /* notif gagal tak membatalkan aksi */ }

  return { ok: true, message: "Dikembalikan ke Kasubbag Protokol" };
}

// 5e. POST: update_jadwal (WK/ajudan/Admin RK mengubah jam & tempat audiensi disetujui)
async function actionUpdateJadwal(body) {
  if (!body.id) throw new Error("id wajib");
  var patch = {};
  if (body.scheduled_date) patch.jadwal_tanggal = body.scheduled_date;
  if (body.scheduled_time) patch.jadwal_jam     = body.scheduled_time;
  if (Object.keys(patch).length === 0 && !body.tempat) throw new Error("Tidak ada perubahan");
  if (Object.keys(patch).length) await sbPatch(body.id, patch);

  // Agenda yang sudah terjadwal ikut disesuaikan di sini (bukan lagi dari browser)
  var agendaPatch = {};
  if (body.scheduled_date) agendaPatch.tanggal = body.scheduled_date;
  if (body.scheduled_time) agendaPatch.jam     = body.scheduled_time;
  if (body.tempat)         agendaPatch.lokasi  = String(body.tempat).trim();

  var agenda = { linked: 0, updated: 0, removed: 0, created: 0, error: null };
  if (Object.keys(agendaPatch).length) {
    try {
      // createIfMissing: agenda dibuat di server bila tamu ini belum punya,
      // supaya tidak lagi bergantung pada kunci Supabase di browser
      agenda = await syncAgendaJadwal(body.id, agendaPatch, {
        createIfMissing: true,
        tempat: body.tempat ? String(body.tempat).trim() : "",
      });
    } catch (e) {
      // Jadwal tamu sudah tersimpan — kegagalan agenda dilaporkan, tidak ditelan
      agenda = { linked: 0, updated: 0, removed: 0, error: e.message || "Gagal menyesuaikan agenda" };
    }
  }

  // Notifikasi WA pembaruan jadwal ke pemohon (best-effort)
  try {
    var rows = await sbGet("permohonan_tamu?id=eq." + body.id + "&select=nama,no_wa,tujuan_pejabat&limit=1");
    var g = (rows && rows[0]) || {};
    if (g.no_wa) {
      var msg =
        "🔄 *Pembaruan Jadwal Audiensi*\n\n" +
        "Yth. *" + (g.nama || "Pemohon") + "*,\n" +
        "Jadwal audiensi Anda kepada *" + (g.tujuan_pejabat || "Pimpinan") + "* telah diperbarui:\n" +
        (body.scheduled_date ? "🗓️ " + fmtTanggalWA(body.scheduled_date) + (body.scheduled_time ? ", pukul " + String(body.scheduled_time).slice(0,5) + " WITA" : "") : "") +
        (body.tempat ? "\n📍 Tempat: " + body.tempat : "") +
        "\n\nMohon menyesuaikan. Terima kasih." + WA_FOOTER;
      await sendWA(g.no_wa, msg);
    }
  } catch (e) {}

  return { ok: true, message: "Jadwal diperbarui", agenda: agenda };
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
    "Anda akan menerima pemberitahuan melalui WhatsApp ini begitu ada keputusan dan penjadwalan dari pimpinan." +
    WA_FOOTER);
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
      var lokasiWA = (body.tempat && String(body.tempat).trim()) || "Ruang Kerja";
      msg =
        "✅ *Audiensi Disetujui*\n\n" +
        "Yth. *" + nama + "*,\n" +
        "Permohonan audiensi Anda kepada *" + pejabat + "* telah *DISETUJUI*." +
        jadwalStr + "\n\n" +
        "📍 Tempat: " + lokasiWA + ".\n" +
        "Mohon hadir 15 menit sebelum jadwal dan membawa identitas diri." +
        WA_FOOTER;
    } else if (body.response === "rejected") {
      msg =
        "🙏 *Pemberitahuan Permohonan Audiensi*\n\n" +
        "Yth. *" + nama + "*,\n" +
        "Mohon maaf, permohonan audiensi Anda kepada *" + pejabat +
        "* belum dapat kami penuhi saat ini." +
        (updateData.alasan_tolak ? "\n\n📝 Keterangan: " + updateData.alasan_tolak : "") +
        "\n\nAnda dipersilakan mengajukan kembali di lain waktu." +
        WA_FOOTER;
    } else if (body.response === "disposed") {
      msg =
        "↪️ *Permohonan Diteruskan*\n\n" +
        "Yth. *" + nama + "*,\n" +
        "Permohonan audiensi Anda telah diteruskan kepada *" +
        (updateData.disposisi_ke || "unit terkait") +
        "* untuk ditindaklanjuti. Tim terkait akan menghubungi Anda lebih lanjut." +
        WA_FOOTER;
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
      else if (action === "return_to_rk") result = await actionReturnToRK(req.body);
      else if (action === "verify_wa")  result = await actionVerifyWA(req.body);
      else if (action === "screen")     result = await actionScreen(req.body);
      else if (action === "forward")    result = await actionForward(req.body);
      else if (action === "return_to_kasubbag") result = await actionReturnToKasubbag(req.body);
      else if (action === "recall_from_pimpinan") result = await actionRecallFromPimpinan(req.body);
      else if (action === "mark_selesai") result = await actionMarkSelesai(req.body);
      else if (action === "update_jadwal") result = await actionUpdateJadwal(req.body);
      else if (action === "sync_agenda")  result = await actionSyncAgenda(req.body);
      else if (action === "respond")    result = await actionRespond(req.body);
      else throw new Error("Action " + action + " tidak dikenal");
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
