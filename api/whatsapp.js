// ============================================================
//  /api/whatsapp.js  —  Notifikasi WhatsApp via Fonnte
//  Deploy di Vercel sebagai file: api/whatsapp.js
//
//  ENV yang wajib diset di Vercel Dashboard:
//    FONNTE_TOKEN = token dari https://fonnte.com
// ============================================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const FONNTE_TOKEN = process.env.FONNTE_TOKEN;
  if (!FONNTE_TOKEN) {
    console.error("FONNTE_TOKEN tidak diset di environment variables");
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
    submittedBy,
    catatanTolak,
    labelPimpinan,
    statusKehadiran,
    namaPersonil,
    catatanPenugasan,
    namaEditor,
    pesan: pesanCustom,
  } = req.body || {};

  if (!to) {
    return res.status(400).json({ error: "Nomor tujuan (to) wajib diisi" });
  }

  // Normalisasi nomor: 08xxx → 628xxx
  const nomor = to.trim().replace(/^0/, "62").replace(/\D/g, "");
  if (nomor.length < 10) {
    return res.status(400).json({ error: "Nomor tidak valid: " + to });
  }

  // ── Format tanggal Indonesia ─────────────────────────────
  function fmtTglIndo(tgl) {
    if (!tgl) return "-";
    const HARI  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    const BULAN = ["","Januari","Februari","Maret","April","Mei","Juni",
                   "Juli","Agustus","September","Oktober","November","Desember"];
    try {
      const [y, m, d] = tgl.split("-").map(Number);
      const hari = HARI[new Date(y, m - 1, d).getDay()];
      return hari + ", " + d + " " + BULAN[m] + " " + y;
    } catch { return tgl; }
  }

  // ── Blok info jadwal standar ─────────────────────────────
  const infoJadwal = [
    `📋 *${namaAcara || "-"}*`,
    `📅 ${fmtTglIndo(tanggal)}, pukul ${jam || "-"} WITA`,
    penyelenggara ? `🏢 ${penyelenggara}` : null,
    lokasi        ? `📍 ${lokasi}`        : null,
  ]
    .filter(Boolean)
    .join("\n");

  const FOOTER = `\n_Sistem Jadwal Pimpinan Kota Tarakan_\n_prokopim.tarakankota.go.id_`;

  // ── Susun isi pesan berdasarkan jenis event ──────────────
  // Broadcast: kirim pesan custom langsung tanpa template
  if (event === "broadcast" && pesanCustom) {
    try {
      const fonnteRes = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: { "Authorization": FONNTE_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ target: nomor, message: pesanCustom }),
      });
      const data = await fonnteRes.json();
      if (!fonnteRes.ok || data.status === false) return res.status(500).json({ error: "Gagal kirim WA", detail: data });
      return res.status(200).json({ ok: true, detail: data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  let pesan = "";

  if (event === "submit") {
    const oleh = submittedBy ? ` oleh *${submittedBy}*` : "";
    pesan =
      `📬 *Jadwal Baru Masuk${oleh}*\n\n` +
      infoJadwal +
      `\n\nSilakan buka sistem untuk mereview & menyetujui jadwal ini.` +
      FOOTER;

  } else if (event === "kasubbag_approve") {
    pesan =
      `📤 *Jadwal Diteruskan ke Kabag*\n\n` +
      infoJadwal +
      `\n\nJadwal ini sudah disetujui Kasubbag dan menunggu persetujuan akhir Kabag.` +
      FOOTER;

  } else if (event === "approved") {
    pesan =
      `✅ *Jadwal Disetujui & Dipublikasi*\n\n` +
      infoJadwal +
      `\n\nJadwal ini sudah resmi dipublikasikan.\nSilakan buka sistem untuk melihat detail dan menyiapkan penugasan.` +
      FOOTER;

  } else if (event === "rejected") {
    const catatan = catatanTolak ? `\n\n📝 *Catatan:* ${catatanTolak}` : "";
    pesan =
      `❌ *Jadwal Dikembalikan*\n\n` +
      infoJadwal +
      catatan +
      `\n\nSilakan perbaiki dan kirim ulang melalui sistem.` +
      FOOTER;

  } else if (event === "recalled") {
    // Kabag menarik kembali jadwal dari Kasubbag
    pesan =
      `↩️ *Jadwal Ditarik Kembali oleh Kabag*\n\n` +
      infoJadwal +
      `\n\nJadwal ini ditarik dari proses persetujuan dan dikembalikan ke review Kasubbag.\n` +
      `Silakan buka sistem untuk meninjau kembali.` +
      FOOTER;

  } else if (event === "penugasan") {
    const nama       = namaPersonil ? `*${namaPersonil}*` : "Anda";
    const catatanPen = catatanPenugasan
      ? `\n\n📝 *Catatan penugasan:*\n${catatanPenugasan}`
      : "";
    pesan =
      `🎯 *Penugasan Baru untuk ${nama}*\n\n` +
      infoJadwal +
      catatanPen +
      `\n\nSilakan buka sistem untuk melihat detail penugasan dan mempersiapkan diri.` +
      FOOTER;

  } else if (event === "konfirmasi_kehadiran") {
    // Ajudan menginput status kehadiran pimpinan → notif ke Kabag/Kasubbag
    const pim = labelPimpinan || "Pimpinan";
    const statusLabel = {
      hadir:       "✅ Hadir",
      tidak_hadir: "❌ Tidak Hadir",
      diwakilkan:  "↩️ Diwakilkan/Delegasi",
    }[statusKehadiran] || statusKehadiran || "-";
    pesan =
      `📣 *Update Kehadiran ${pim}*\n\n` +
      infoJadwal +
      `\n\n👤 *${pim}:* ${statusLabel}\n` +
      `Konfirmasi ini diinput oleh Ajudan.\n` +
      `Silakan buka sistem untuk melihat detail persiapan.` +
      FOOTER;

  } else if (event === "jadwal_diubah") {
    // Jadwal yang sudah disetujui diedit oleh admin/kabag
    const editor = namaEditor ? ` oleh *${namaEditor}*` : "";
    pesan =
      `✏️ *Jadwal Telah Diubah${editor}*\n\n` +
      infoJadwal +
      `\n\n⚠️ Jadwal yang sudah dipublikasikan ini *baru saja diperbarui*.\n` +
      `Harap cek kembali detail jadwal di sistem untuk memastikan kesiapan Anda.` +
      FOOTER;

  } else if (event === "undangan_sore") {
    const pim = labelPimpinan ? `*${labelPimpinan}*` : "Pimpinan";
    pesan =
      `🔔 *Undangan Baru Masuk (Petang/Malam)*\n\n` +
      infoJadwal +
      `\n\n⏰ Undangan ini baru diterima *setelah pukul 16.00 WITA*.\n\n` +
      `Mohon segera:\n` +
      `1️⃣ Informasikan ke ${pim}\n` +
      `2️⃣ Konfirmasi kehadiran melalui sistem\n` +
      `3️⃣ Pastikan persiapan sudah matang sebelum hari pelaksanaan` +
      FOOTER;

  } else if (event === "delegasi_wwk") {
    pesan =
      `↩️ *Disposisi dari Wali Kota*\n\n` +
      `Wali Kota telah *mendelegasikan* kehadiran berikut kepada Wakil Wali Kota:\n\n` +
      infoJadwal +
      `\n\n📌 Mohon segera:\n` +
      `1️⃣ Informasikan ke Wakil Wali Kota\n` +
      `2️⃣ Input konfirmasi kehadiran Wakil WK di sistem\n` +
      `3️⃣ Siapkan berkas/naskah yang diperlukan` +
      FOOTER;

  } else {
    // Fallback generik
    pesan =
      `🔔 *Notifikasi Jadwal*\n\n` +
      infoJadwal +
      FOOTER;
  }

  // ── Kirim via Fonnte API ─────────────────────────────────
  try {
    const fonnteRes = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        "Authorization": FONNTE_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target:  nomor,
        message: pesan,
      }),
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
