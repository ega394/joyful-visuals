// ============================================================
//  /api/whatsapp.js  —  Notifikasi WhatsApp via Fonnte
//  Prokopim Hibot v2.0 — Bagian Protokol dan Komunikasi Pimpinan
//  ENV: FONNTE_TOKEN (dari https://fonnte.com)
// ============================================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
    penyelenggara,
    lokasi,
    event,
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
    pesan: pesanCustom,
  } = req.body || {};

  if (!to) {
    return res.status(400).json({ error: "Nomor tujuan (to) wajib diisi" });
  }

  const nomor = to.trim().replace(/^0/, "62").replace(/\D/g, "");
  if (nomor.length < 10) {
    return res.status(400).json({ error: "Nomor tidak valid: " + to });
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
  const infoJadwal = [
    `📋 *${namaAcara || "-"}*`,
    `📅 ${fmtTgl(tanggal)}, pukul ${jam || "-"} WITA`,
    penyelenggara ? `🏢 ${penyelenggara}` : null,
    lokasi        ? `📍 ${lokasi}`        : null,
  ].filter(Boolean).join("\n");

  // ── Broadcast custom ──────────────────────────────────────
  if (event === "broadcast" && pesanCustom) {
    try {
      const r = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: { "Authorization": FONNTE_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ target: nomor, message: pesanCustom }),
      });
      const d = await r.json();
      if (!r.ok || d.status === false) return res.status(500).json({ error: "Gagal kirim WA", detail: d });
      return res.status(200).json({ ok: true, detail: d });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
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

  // ── konfirmasi_kehadiran: Ajudan/Admin RK input kehadiran ──
  } else if (event === "konfirmasi_kehadiran") {
    const pim   = labelPimpinan || "Pimpinan";
    const aktor = jabatanPengirim || "Ajudan";
    const statusLabel = {
      hadir:       "✅ *Hadir*",
      tidak_hadir: "❌ *Tidak Hadir*",
      diwakilkan:  "↩️ *Diwakilkan/Delegasi*",
      delegasi:    "↩️ *Didelegasikan ke Wakil*",
    }[statusKehadiran] || statusKehadiran || "-";
    pesan = HEADER +
      sapa +
      `📣 *Update konfirmasi kehadiran ${pim}*\n` +
      `(diinput oleh ${aktor})\n\n` +
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
  } else {
    pesan = HEADER + sapa + `🔔 *Notifikasi Jadwal*\n\n` + infoJadwal + FOOTER;
  }

  // ── Kirim via Fonnte ──────────────────────────────────────
  try {
    const fonnteRes = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { "Authorization": FONNTE_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ target: nomor, message: pesan }),
    });
    const data = await fonnteRes.json();
    if (!fonnteRes.ok || data.status === false) {
      console.error("Fonnte error:", data);
      return res.status(500).json({ error: "Gagal kirim WA", detail: data });
    }
    return res.status(200).json({ ok: true, detail: data });
  } catch (err) {
    console.error("Fetch ke Fonnte gagal:", err.message);
    return res.status(500).json({ error: err.message });
  }
}