// ============================================================
//  /api/whatsapp.js  —  Notifikasi WhatsApp via Fonnte
//  Prokopim Hibot v2.0 — Bagian Protokol dan Komunikasi Pimpinan
//  ENV: FONNTE_TOKEN (dari https://fonnte.com)
// ============================================================

import { wajibSesi, penggunaNomor, normalNomor } from "./_sesi.js";
import { catatWA, hasilFonnte } from "./_walog.js";

// Pesan bebas (event "broadcast") hanya untuk pejabat yang memang mengirim
// pengumuman/pemberitahuan dari aplikasi: Kabag (Kirim Pengumuman) dan
// Kasubbag (pencabutan penugasan), termasuk PLH-nya, serta superadmin.
const PERAN_BROADCAST = ["kabag", "kasubbag_protokol", "kasubbag_komdokpim", "superadmin"];

// Event yang punya templat di bawah. Event lain ditolak (lihat handler).
const EVENT_DIKENAL = [
  "broadcast", "submit", "kasubbag_approve", "approved", "rejected", "recalled",
  "penugasan", "konfirmasi_kehadiran", "jadwal_diubah", "delegasi_wwk", "undangan_sore",
  "ajukan_batal", "batal_ke_kabag", "batal_disetujui_kabag", "batal_ditolak",
  "ajukan_edit", "edit_ke_kabag", "edit_disetujui", "edit_ditolak", "kabar_lapangan",
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Wajib sesi aplikasi: tanpa ini siapa pun dapat mengirim WhatsApp atas nama
  // nomor resmi Prokopim ke nomor mana pun.
  const pengirim = await wajibSesi(req, res, (req.body || {}).event === "broadcast" ? { peran: PERAN_BROADCAST } : undefined);
  if (!pengirim) return;

  const FONNTE_TOKEN = process.env.FONNTE_TOKEN;
  if (!FONNTE_TOKEN) {
    console.error("FONNTE_TOKEN tidak diset");
    return res.status(500).json({ error: "WA service not configured" });
  }

  const {
    to,
    namaAcara,
    tanggal,
    jam,
    jamSelesai,         // opsional — hanya dikirim bila jam berakhir diketahui
    penyelenggara,
    lokasi,
    event,
    alasanHapus,        // alasan pembatalan berjenjang
    alasanEdit,         // alasan usulan perubahan jadwal terbit
    ringkasEdit,        // daftar nama field yang diusulkan berubah
    submittedBy,        // nama yang mengajukan
    jabatanPengirim,    // jabatan yang melakukan aksi (misal "Kasubbag Protokol")
    namaPenerima,       // nama penerima untuk sapaan
    catatanTolak,
    labelPimpinan,
    statusKehadiran,
    namaPersonil,
    catatanPenugasan,
    rekanBertugas,      // array nama rekan yang bertugas
    namaEditor,
    jenisKabar,         // kabar_lapangan: disetujui | diubah | ditarik | dibatalkan
    jenis,              // label pencatatan untuk broadcast (mis. "pengumuman")
    pesan: pesanCustom,
  } = req.body || {};

  // Hanya event yang punya templat. Dulu event tak dikenal jatuh ke pesan
  // generik "Notifikasi Jadwal" — memakan kuota tanpa isi yang berguna.
  if (!EVENT_DIKENAL.includes(event)) {
    return res.status(400).json({ error: "Event WA tidak dikenal: " + String(event).slice(0, 40) });
  }
  // Jenis pesan untuk wa_log: event, atau label broadcast yang lebih rinci.
  const jenisLog = event === "broadcast" && /^[a-z_]{2,40}$/.test(String(jenis || "")) ? jenis : event;

  if (!to) {
    return res.status(400).json({ error: "Nomor tujuan (to) wajib diisi" });
  }

  const nomor = normalNomor(to);
  if (nomor.length < 10) {
    return res.status(400).json({ error: "Nomor tidak valid: " + to });
  }

  // Hanya ke nomor pegawai yang terdaftar (lihat penggunaNomor di _sesi.js).
  let penerima;
  try {
    penerima = await penggunaNomor(nomor);
    if (!penerima) {
      return res.status(403).json({ error: "Nomor tujuan bukan nomor pengguna terdaftar." });
    }
  } catch (e) {
    console.error("[whatsapp] daftar pengguna tidak terbaca:", e.message);
    return res.status(503).json({ error: "Daftar pengguna tidak terbaca — coba lagi." });
  }

  // Isian bebas dibatasi panjangnya supaya notifikasi bertemplat tidak bisa
  // dipakai sebagai pesan bebas yang panjang.
  const BATAS_TEKS = 600;
  for (const k of Object.keys(req.body || {})) {
    if (k !== "pesan" && typeof req.body[k] === "string" && req.body[k].length > BATAS_TEKS) {
      return res.status(400).json({ error: "Isian '" + k + "' terlalu panjang." });
    }
  }
  if (event === "broadcast" && !(typeof pesanCustom === "string" && pesanCustom.trim())) {
    return res.status(400).json({ error: "Pesan broadcast kosong." });
  }
  if (typeof pesanCustom === "string" && pesanCustom.length > 4000) {
    return res.status(400).json({ error: "Pesan terlalu panjang." });
  }

  // ── Format tanggal ─────────────────────────────────────────
  function fmtTgl(tgl) {
    if (!tgl) return "-";
    const HARI  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    const BULAN = ["","Januari","Februari","Maret","April","Mei","Juni",
                   "Juli","Agustus","September","Oktober","November","Desember"];
    try {
      const [y, m, d] = tgl.split("-").map(Number);
      return HARI[new Date(y,m-1,d).getDay()] + ", " + d + " " + BULAN[m] + " " + y;
    } catch { return tgl; }
  }

  // ── Header & footer standar ────────────────────────────────
  const HEADER = `🏛️ *Prokopim Kota Tarakan*\n`;
  const FOOTER = `\n\n_Bagian Protokol dan Komunikasi Pimpinan_\n_Setda Kota Tarakan_\n_prokopim.tarakankota.go.id_`;

  // ── Sapaan personal ────────────────────────────────────────
  const sapa = namaPenerima ? `Yth. *${namaPenerima}*,\n\n` : "";

  // ── Blok info jadwal ──────────────────────────────────────
  // Jam selesai opsional; ditampilkan sebagai rentang hanya bila diketahui dan
  // lebih besar dari jam mulai. Jadwal lama tidak punya field ini sama sekali.
  const _mnt = (t) => { const [h, m] = String(t || "").split(":").map(Number); return (h * 60 + m) || 0; };
  const rentangJam = (jam && jamSelesai && _mnt(jamSelesai) > _mnt(jam))
    ? `${jam} – ${jamSelesai}`
    : (jam || "-");

  const infoJadwal = [
    `📋 *${namaAcara || "-"}*`,
    `📅 ${fmtTgl(tanggal)}, pukul ${rentangJam} WITA`,
    penyelenggara ? `🏢 ${penyelenggara}` : null,
    lokasi        ? `📍 ${lokasi}`        : null,
  ].filter(Boolean).join("\n");

  // ── Broadcast custom ──────────────────────────────────────
  if (event === "broadcast" && pesanCustom) {
    return kirim(pesanCustom);
  }

  let pesan = "";

  // ── submit: Admin RK mengajukan jadwal baru ────────────────
  if (event === "submit") {
    const pengirim = jabatanPengirim || "Admin Rencana Kegiatan";
    const nama     = submittedBy ? ` oleh *${submittedBy}* (${pengirim})` : ` oleh ${pengirim}`;
    pesan = HEADER +
      sapa +
      `Disampaikan bahwa terdapat *jadwal baru yang diajukan*${nama} dan memerlukan verifikasi Anda.\n\n` +
      infoJadwal +
      `\n\nSilakan buka sistem untuk memeriksa dan meneruskan ke Kabag.` +
      FOOTER;

  // ── kasubbag_approve: Kasubbag meneruskan ke Kabag ────────
  } else if (event === "kasubbag_approve") {
    const verifikator = jabatanPengirim || "Kasubbag Protokol";
    pesan = HEADER +
      sapa +
      `*${verifikator}* telah memverifikasi jadwal berikut dan meneruskannya untuk persetujuan akhir Anda.\n\n` +
      infoJadwal +
      `\n\nSilakan buka sistem untuk meninjau dan memberikan keputusan.` +
      FOOTER;

  // ── approved: Kabag menyetujui ────────────────────────────
  } else if (event === "approved") {
    const approver = jabatanPengirim || "Kepala Bagian Prokopim";
    pesan = HEADER +
      sapa +
      `✅ *Jadwal Anda telah disetujui* oleh *${approver}* dan resmi dipublikasikan.\n\n` +
      infoJadwal +
      `\n\nSilakan buka sistem untuk melihat detail, menyiapkan naskah, dan mengatur penugasan personil.` +
      FOOTER;

  // ── rejected: Dikembalikan ke Admin RK ────────────────────
  } else if (event === "rejected") {
    const penolak  = jabatanPengirim || "Kasubbag";
    const catatan  = catatanTolak ? `\n\n📝 *Catatan dari ${penolak}:*\n${catatanTolak}` : "";
    pesan = HEADER +
      sapa +
      `*${penolak}* telah mengembalikan jadwal berikut untuk diperbaiki.\n\n` +
      infoJadwal +
      catatan +
      `\n\nSilakan perbaiki sesuai catatan di atas dan kirim ulang melalui sistem.` +
      FOOTER;

  // ── recalled: Kabag menarik jadwal yang sudah tayang ──────
  } else if (event === "recalled") {
    const penarik = jabatanPengirim || "Kepala Bagian Prokopim";
    pesan = HEADER +
      sapa +
      `↩️ *${penarik}* telah menarik jadwal berikut dari publikasi dan mengembalikannya untuk ditinjau ulang.\n\n` +
      infoJadwal +
      `\n\nSilakan buka sistem, periksa kembali jadwal ini, lalu ajukan ulang setelah diperbaiki.` +
      FOOTER;

  // ── penugasan: Staf ditugaskan ke suatu acara ─────────────
  } else if (event === "penugasan") {
    const nama    = namaPersonil ? `*${namaPersonil}*` : "Anda";
    const penugasByJabatan = jabatanPengirim || "Kasubbag";
    const catPen  = catatanPenugasan ? `\n\n📝 *Catatan:* ${catatanPenugasan}` : "";
    const rekan   = rekanBertugas && rekanBertugas.length > 0
      ? `\n\n👥 *Rekan bertugas:* ${rekanBertugas.join(", ")}`
      : "";
    pesan = HEADER +
      sapa +
      `${nama} mendapat *penugasan baru* dari *${penugasByJabatan}*.\n\n` +
      infoJadwal +
      catPen +
      rekan +
      `\n\nSilakan buka sistem untuk melihat detail penugasan dan mempersiapkan diri.` +
      FOOTER;

  // ── konfirmasi_kehadiran: WK/WWK sendiri, atau Ajudan/Admin RK ──
  } else if (event === "konfirmasi_kehadiran") {
    const pim   = labelPimpinan || "Pimpinan";
    const statusLabel = {
      hadir:       "✅ *Hadir*",
      tidak_hadir: "❌ *Tidak Hadir*",
      diwakilkan:  "↩️ *Diwakilkan/Delegasi*",
      delegasi:    "↩️ *Didelegasikan ke Wakil*",
    }[statusKehadiran] || statusKehadiran || "-";

    // Deteksi siapa yang melakukan konfirmasi berdasarkan role
    const ROLE_LABEL = {
      "walikota":             null,                    // pimpinan sendiri — tidak perlu keterangan
      "wakilwalikota":        null,                    // pimpinan sendiri — tidak perlu keterangan
      "ajudan_walikota":      "Ajudan Wali Kota",
      "ajudan_wakilwalikota": "Ajudan Wakil Wali Kota",
      "admin_rk":             "Admin Rencana Kegiatan",
      "kabag":                "Kabag Prokopim",
    };
    const labelAktor = jabatanPengirim in ROLE_LABEL
      ? ROLE_LABEL[jabatanPengirim]       // null jika pimpinan sendiri
      : jabatanPengirim || null;          // fallback ke nilai mentah
    const keteranganAktor = labelAktor
      ? `(diinput oleh ${labelAktor})\n`
      : "";

    pesan = HEADER +
      sapa +
      `📣 *Update konfirmasi kehadiran ${pim}*\n` +
      keteranganAktor +
      `\n` +
      infoJadwal +
      `\n\n👤 *${pim}:* ${statusLabel}\n\n` +
      `Silakan buka sistem untuk melihat detail persiapan dan penugasan personil.` +
      FOOTER;

  // ── jadwal_diubah: Jadwal yang sudah tayang diedit ────────
  } else if (event === "jadwal_diubah") {
    const editor = namaEditor
      ? `*${namaEditor}*${jabatanPengirim ? " (" + jabatanPengirim + ")" : ""}`
      : jabatanPengirim || "petugas sistem";
    pesan = HEADER +
      sapa +
      `✏️ Jadwal yang sudah dipublikasikan *baru saja diperbarui* oleh ${editor}.\n\n` +
      infoJadwal +
      `\n\n⚠️ Harap periksa kembali detail jadwal di sistem untuk memastikan kesiapan Anda.` +
      FOOTER;

  // ── delegasi_wwk: WK mendelegasikan ke WWK ────────────────
  } else if (event === "delegasi_wwk") {
    pesan = HEADER +
      sapa +
      `↩️ *Wali Kota Tarakan* telah mendelegasikan kehadiran pada kegiatan berikut kepada Wakil Wali Kota.\n\n` +
      infoJadwal +
      `\n\n📌 Mohon segera:\n` +
      `1️⃣ Informasikan kepada Wakil Wali Kota\n` +
      `2️⃣ Input konfirmasi kehadiran Wakil WK di sistem\n` +
      `3️⃣ Siapkan berkas dan naskah yang diperlukan` +
      FOOTER;

  // ── undangan_sore: Undangan masuk setelah jam 16.00 ───────
  } else if (event === "undangan_sore") {
    const pim = labelPimpinan ? `*${labelPimpinan}*` : "Pimpinan";
    pesan = HEADER +
      sapa +
      `🔔 *Undangan masuk setelah pukul 16.00 WITA* — mohon ditindaklanjuti segera.\n\n` +
      infoJadwal +
      `\n\nMohon segera:\n` +
      `1️⃣ Informasikan kepada ${pim}\n` +
      `2️⃣ Konfirmasi kehadiran melalui sistem\n` +
      `3️⃣ Pastikan semua persiapan matang sebelum hari H` +
      FOOTER;

  // ── fallback generik ───────────────────────────────────────
  
  } else if (event === "ajukan_batal") {
    // Admin RK → Kasubbag: permintaan pembatalan jadwal final
    const pengaju = submittedBy || "Admin RK";
    const alasan  = alasanHapus ? `\n\n📝 *Alasan:*\n${alasanHapus}` : "";
    pesan = HEADER +
      sapa +
      `⚠️ *Permintaan Pembatalan Jadwal*\n\n` +
      `*${pengaju}* mengajukan pembatalan jadwal berikut:${alasan}\n\n` +
      infoJadwal +
      `\n\nMohon ditinjau dan diputuskan:\n` +
      `✅ Teruskan ke Kabag, atau\n` +
      `❌ Tolak — jadwal tetap aktif.` +
      FOOTER;

  } else if (event === "batal_ke_kabag") {
    // Kasubbag → Kabag: meneruskan permintaan pembatalan
    const pengaju = submittedBy || "Kasubbag";
    const alasan  = alasanHapus ? `\n\n📝 *Alasan:*\n${alasanHapus}` : "";
    pesan = HEADER +
      sapa +
      `⚠️ *Permintaan Pembatalan — Keputusan Akhir Kabag*\n\n` +
      `Kasubbag Protokol meneruskan permintaan pembatalan berikut:${alasan}\n\n` +
      infoJadwal +
      `\n\nSebagai Kabag, Anda dapat:\n` +
      `🗑️ Setujui & hapus permanen, atau\n` +
      `❌ Tolak — jadwal tetap aktif.` +
      FOOTER;

  } else if (event === "batal_disetujui_kabag") {
    // Kabag → Admin RK: pembatalan disetujui, jadwal dihapus
    const kabag = submittedBy || "Kabag";
    pesan = HEADER +
      sapa +
      `✅ *Pembatalan Jadwal Disetujui*\n\n` +
      `*${kabag}* telah menyetujui permintaan pembatalan.\n\n` +
      infoJadwal +
      `\n\nJadwal tersebut telah *dihapus permanen* dari sistem.` +
      FOOTER;

  } else if (event === "batal_ditolak") {
    // Kasubbag/Kabag → Admin RK: permintaan ditolak
    const penolak = submittedBy || jabatanPengirim || "Pejabat terkait";
    pesan = HEADER +
      sapa +
      `❌ *Permintaan Pembatalan Ditolak*\n\n` +
      `*${penolak}* tidak menyetujui pembatalan jadwal berikut:\n\n` +
      infoJadwal +
      `\n\nJadwal tetap aktif. Hubungi ${penolak} untuk informasi lebih lanjut.` +
      FOOTER;

  // ── Usulan perubahan jadwal yang sudah terbit ──────────────
  } else if (event === "ajukan_edit") {
    // Admin RK → Kasubbag Protokol: usulan perubahan jadwal terbit
    const pengaju = submittedBy || "Admin RK";
    const alasan  = alasanEdit  ? `\n\n📝 *Alasan:*\n${alasanEdit}`      : "";
    const ringkas = ringkasEdit ? `\n\n🔧 *Yang diubah:* ${ringkasEdit}` : "";
    pesan = HEADER +
      sapa +
      `✏️ *Usulan Perubahan Jadwal Terbit*\n\n` +
      `*${pengaju}* mengajukan perubahan atas jadwal berikut:${alasan}${ringkas}\n\n` +
      infoJadwal +
      `\n\n_Data di atas masih data lama — jadwal tetap tayang sampai usulan disetujui._\n\n` +
      `Mohon ditinjau di aplikasi:\n` +
      `✅ Teruskan ke Kabag, atau\n` +
      `❌ Tolak — jadwal tetap seperti semula.` +
      FOOTER;

  } else if (event === "edit_ke_kabag") {
    // Kasubbag Protokol → Kabag: meneruskan usulan perubahan
    const alasan  = alasanEdit  ? `\n\n📝 *Alasan:*\n${alasanEdit}`      : "";
    const ringkas = ringkasEdit ? `\n\n🔧 *Yang diubah:* ${ringkasEdit}` : "";
    pesan = HEADER +
      sapa +
      `✏️ *Usulan Perubahan — Keputusan Akhir Kabag*\n\n` +
      `Kasubbag Protokol meneruskan usulan perubahan berikut:${alasan}${ringkas}\n\n` +
      infoJadwal +
      `\n\n_Data di atas masih data lama — jadwal tetap tayang sampai Anda menyetujui._\n\n` +
      `Sebagai Kabag, Anda dapat:\n` +
      `✅ Setujui — data jadwal langsung diperbarui, atau\n` +
      `❌ Tolak — jadwal tetap seperti semula.` +
      FOOTER;

  } else if (event === "edit_disetujui") {
    // Kabag → Admin RK: usulan disetujui, nilai baru sudah berlaku
    const kabag = submittedBy || "Kabag";
    pesan = HEADER +
      sapa +
      `✅ *Usulan Perubahan Jadwal Disetujui*\n\n` +
      `*${kabag}* telah menyetujui usulan perubahan Anda. Jadwal kini tayang dengan data terbaru:\n\n` +
      infoJadwal +
      FOOTER;

  } else if (event === "edit_ditolak") {
    // Kasubbag/Kabag → Admin RK: usulan perubahan ditolak
    const penolak = submittedBy || jabatanPengirim || "Pejabat terkait";
    const catatan = catatanTolak ? `\n\n📝 *Alasan:*\n${catatanTolak}` : "";
    pesan = HEADER +
      sapa +
      `❌ *Usulan Perubahan Ditolak*\n\n` +
      `*${penolak}* tidak menyetujui usulan perubahan atas jadwal berikut:${catatan}\n\n` +
      infoJadwal +
      `\n\nJadwal tetap tayang dengan data lama. Anda dapat memperbaiki usulan lalu mengajukannya kembali.` +
      FOOTER;

  // ── kabar_lapangan: ajudan & petugas, jadwal hari ini/besok ──
  // Klien hanya memakai WA untuk acara yang sudah dekat; selebihnya push.
  } else if (event === "kabar_lapangan") {
    const KABAR = {
      disetujui:  ["📅 *Agenda Baru Pimpinan*", "Jadwal berikut baru saja *disetujui dan tayang*."],
      diubah:     ["✏️ *Perubahan Jadwal*", "Jadwal berikut *berubah*. Mohon sesuaikan persiapan Anda."],
      ditarik:    ["↩️ *Jadwal Ditarik Sementara*", "Jadwal berikut *ditarik dari publikasi* untuk ditinjau ulang. Mohon jangan dijalankan sampai jadwal tayang kembali."],
      dibatalkan: ["❌ *Jadwal Dibatalkan*", "Jadwal berikut *dibatalkan*."],
    }[jenisKabar];
    if (!KABAR) return res.status(400).json({ error: "jenisKabar tidak dikenal." });
    const untuk  = labelPimpinan ? `\n👤 Untuk: *${labelPimpinan}*` : "";
    const ubah   = ringkasEdit ? `\n\n🔄 *Yang berubah:* ${ringkasEdit}` : "";
    const alasan = alasanHapus ? `\n\n📝 *Keterangan:* ${alasanHapus}` : "";
    pesan = HEADER +
      sapa +
      KABAR[0] + `\n` + KABAR[1] + `\n\n` +
      infoJadwal + untuk + ubah + alasan +
      `\n\nDetail lengkap ada di aplikasi Prokopim.` +
      FOOTER;
  }

  return kirim(pesan);

  // ── Kirim via Fonnte (+ catat di wa_log) ───────────────────
  async function kirim(teks) {
    let hasil = { ok: false, detail: null };
    try {
      const r = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: { "Authorization": FONNTE_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ target: nomor, message: teks }),
      });
      hasil = await hasilFonnte(r);
    } catch (err) {
      console.error("Fetch ke Fonnte gagal:", err.message);
      await catatWA({ jenis: jenisLog, sumber: "aplikasi", peran: penerima.role, berhasil: false, catatan: err.message });
      return res.status(500).json({ error: err.message });
    }
    await catatWA({ jenis: jenisLog, sumber: "aplikasi", peran: penerima.role, berhasil: hasil.ok,
                    catatan: hasil.ok ? null : JSON.stringify(hasil.detail || {}).slice(0, 200) });
    if (!hasil.ok) {
      console.error("Fonnte error:", hasil.detail);
      return res.status(500).json({ error: "Gagal kirim WA", detail: hasil.detail });
    }
    return res.status(200).json({ ok: true, detail: hasil.detail });
  }
}