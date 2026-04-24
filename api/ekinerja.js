// ============================================================
//  /api/ekinerja.js  — Query aman jadwal untuk Generator E-Kinerja
//
//  GET  /api/ekinerja?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&role=kabag
//
//  ENV: VITE_SUPABASE_URL, SUPABASE_KEY (atau VITE_SUPABASE_ANON_KEY)
//       API_SECRET
// ============================================================

const SUPA_URL = process.env.VITE_SUPABASE_URL  || process.env.SUPABASE_URL  || "";
const SUPA_KEY = process.env.SUPABASE_KEY        || process.env.VITE_SUPABASE_ANON_KEY || "";

// Template kalimat per role — 8 variasi per role, dirotasi per-index agar
// laporan tidak terlihat sebagai copy-paste. Struktur identik dengan
// frontend (EKinerjaGenerator) sehingga output client & server sinkron.
const TEMPLATE = {
  kabag: [
    (n) => `Melakukan executive review dan persetujuan akhir terhadap draf jadwal pimpinan pada acara ${n}.`,
    (n) => `Menelaah substansi dan memberikan persetujuan akhir atas usulan agenda ${n}.`,
    (n) => `Melaksanakan telaah eksekutif dan mengotorisasi jadwal pimpinan untuk kegiatan ${n}.`,
    (n) => `Memberikan disposisi persetujuan final atas draf jadwal pimpinan pada kegiatan ${n}.`,
    (n) => `Melakukan verifikasi tingkat akhir dan menetapkan kelayakan jadwal pimpinan pada acara ${n}.`,
    (n) => `Melakukan kajian akhir dan memutuskan penetapan jadwal pimpinan pada kegiatan ${n}.`,
    (n) => `Menelaah kelayakan substantif dan administratif serta menandatangani persetujuan jadwal pimpinan untuk acara ${n}.`,
    (n) => `Mengesahkan hasil telaah jadwal pimpinan dan memberikan persetujuan tayang pada kegiatan ${n}.`,
  ],
  kasubbag_protokol: [
    (n) => `Mengoordinasikan pembagian tugas dan menetapkan penugasan personel staf protokol untuk kegiatan ${n}.`,
    (n) => `Melakukan verifikasi kelengkapan dokumen dan mengatur penugasan personel protokol pada acara ${n}.`,
    (n) => `Menyusun skenario keprotokolan dan menetapkan tim pendamping pimpinan untuk kegiatan ${n}.`,
    (n) => `Mengkaji teknis keprotokolan dan mendistribusikan penugasan staf pada acara ${n}.`,
    (n) => `Mengoordinasikan persiapan protokoler dan menetapkan personel bertugas pada kegiatan ${n}.`,
    (n) => `Melakukan supervisi teknis keprotokolan dan memetakan penugasan personel pada acara ${n}.`,
    (n) => `Mengatur distribusi tugas dan memastikan kesiapan tim protokol untuk kegiatan ${n}.`,
    (n) => `Melakukan verifikasi teknis dan menetapkan jadwal pendampingan pimpinan pada acara ${n}.`,
  ],
  kasubbag_komdokpim: [
    (n) => `Menetapkan penugasan personel Tim Komdokpim dan mengarahkan angle pemberitaan untuk kegiatan ${n}.`,
    (n) => `Mengoordinasikan tim dokumentasi dan menyusun rencana peliputan pada acara ${n}.`,
    (n) => `Mengarahkan strategi publikasi dan menugaskan personel Tim Komdokpim untuk kegiatan ${n}.`,
    (n) => `Menetapkan tim peliput dan merumuskan sudut pandang pemberitaan pada acara ${n}.`,
    (n) => `Mengoordinasikan kegiatan dokumentasi dan komunikasi publik untuk acara ${n}.`,
    (n) => `Melakukan supervisi kegiatan dokumentasi dan menetapkan narasi publikasi untuk acara ${n}.`,
    (n) => `Merumuskan rencana peliputan dan mengatur penugasan tim komunikasi pada kegiatan ${n}.`,
    (n) => `Menyusun strategi komunikasi publik dan mengoordinasikan tim dokumentasi untuk acara ${n}.`,
  ],
  admin_rk: [
    (n) => `Melakukan data entry dan menginput draf usulan jadwal pimpinan ke dalam sistem untuk kegiatan ${n}.`,
    (n) => `Menginput data administratif dan menyiapkan draf jadwal pimpinan pada acara ${n}.`,
    (n) => `Melaksanakan pencatatan dan pengarsipan digital draf jadwal pimpinan untuk kegiatan ${n}.`,
    (n) => `Menyusun draf administrasi dan memverifikasi kelengkapan data jadwal pimpinan pada acara ${n}.`,
    (n) => `Mendokumentasikan usulan jadwal pimpinan ke sistem dan memastikan kelengkapan atribut data untuk kegiatan ${n}.`,
    (n) => `Melakukan entry data dan memastikan validasi informasi draf jadwal pimpinan pada acara ${n}.`,
    (n) => `Menyiapkan kelengkapan administrasi dan menginput draf jadwal pimpinan ke sistem untuk kegiatan ${n}.`,
    (n) => `Melakukan administrasi dan rekapitulasi draf usulan jadwal pimpinan pada kegiatan ${n}.`,
  ],
  admin_undangan: [
    (n) => `Menyusun draf undangan resmi dan memverifikasi kelengkapan administrasi untuk kegiatan ${n}.`,
    (n) => `Membuat konsep undangan dan melakukan pencatatan arsip administrasi pada acara ${n}.`,
    (n) => `Melakukan penyusunan surat undangan dan validasi data penerima untuk kegiatan ${n}.`,
    (n) => `Menyiapkan naskah undangan dan mendistribusikan salinan administrasi pada acara ${n}.`,
    (n) => `Menyusun format undangan resmi dan mengarsipkan dokumen pendukung untuk kegiatan ${n}.`,
    (n) => `Melaksanakan pembuatan undangan dan verifikasi daftar penerima pada acara ${n}.`,
    (n) => `Mengoordinasikan penerbitan undangan dan memastikan akurasi data pejabat pada kegiatan ${n}.`,
    (n) => `Menyusun draf undangan dan melakukan pengecekan kelengkapan dokumen untuk acara ${n}.`,
  ],
  staf: [
    (n) => `Melaksanakan tugas pendampingan teknis dan memastikan kesiapan lokasi pimpinan pada acara ${n}.`,
    (n) => `Melakukan pengecekan kesiapan teknis venue dan mendampingi pelaksanaan keprotokolan pada kegiatan ${n}.`,
    (n) => `Melaksanakan dukungan teknis keprotokolan dan memfasilitasi kelancaran acara ${n}.`,
    (n) => `Mendampingi tim protokol dan melakukan sinkronisasi teknis pelaksanaan pada kegiatan ${n}.`,
    (n) => `Memastikan kesiapan sarana dan pendampingan operasional pimpinan pada acara ${n}.`,
    (n) => `Melakukan persiapan teknis lapangan dan mendampingi pelaksanaan kegiatan ${n}.`,
    (n) => `Mengatur kesiapan sarana prasarana dan melakukan pendampingan protokoler pada acara ${n}.`,
    (n) => `Menjalankan tugas keprotokolan di lapangan dan memastikan kelancaran pelaksanaan kegiatan ${n}.`,
  ],
  timkom: [
    (n) => `Melaksanakan pengambilan dokumentasi visual dan menyusun draf rilis/caption untuk kegiatan ${n}.`,
    (n) => `Melakukan peliputan foto/video dan menyiapkan materi publikasi acara ${n}.`,
    (n) => `Melaksanakan dokumentasi kegiatan dan menyusun narasi pemberitaan untuk acara ${n}.`,
    (n) => `Mengambil dokumentasi audiovisual dan merumuskan draf siaran pers pada kegiatan ${n}.`,
    (n) => `Melakukan peliputan dan menyusun konten komunikasi publik untuk acara ${n}.`,
    (n) => `Melakukan dokumentasi fotografi dan videografi serta menyusun draf rilis untuk acara ${n}.`,
    (n) => `Menjalankan peliputan dan menyiapkan materi publikasi digital pada kegiatan ${n}.`,
    (n) => `Melaksanakan pendokumentasian dan menyusun konten pemberitaan resmi untuk acara ${n}.`,
  ],
  ajudan_walikota: [
    (n) => `Mendampingi dan memfasilitasi kehadiran Wali Kota pada acara ${n}.`,
    (n) => `Melaksanakan tugas pendampingan protokoler Wali Kota pada kegiatan ${n}.`,
    (n) => `Menjalankan fungsi ajudansi dan koordinasi kehadiran Wali Kota pada acara ${n}.`,
    (n) => `Menyiapkan dan mendampingi agenda kehadiran Wali Kota pada kegiatan ${n}.`,
    (n) => `Melakukan pengawalan dan pendampingan teknis Wali Kota pada acara ${n}.`,
    (n) => `Memfasilitasi mobilitas dan kelancaran agenda Wali Kota pada kegiatan ${n}.`,
    (n) => `Menyelenggarakan dukungan ajudansi dan koordinasi protokoler Wali Kota pada acara ${n}.`,
    (n) => `Mendampingi Wali Kota serta memastikan kesiapan agenda pada kegiatan ${n}.`,
  ],
  ajudan_wakilwalikota: [
    (n) => `Mendampingi dan memfasilitasi kehadiran Wakil Wali Kota pada acara ${n}.`,
    (n) => `Melaksanakan tugas pendampingan protokoler Wakil Wali Kota pada kegiatan ${n}.`,
    (n) => `Menjalankan fungsi ajudansi dan koordinasi kehadiran Wakil Wali Kota pada acara ${n}.`,
    (n) => `Menyiapkan dan mendampingi agenda kehadiran Wakil Wali Kota pada kegiatan ${n}.`,
    (n) => `Melakukan pengawalan dan pendampingan teknis Wakil Wali Kota pada acara ${n}.`,
    (n) => `Memfasilitasi mobilitas dan kelancaran agenda Wakil Wali Kota pada kegiatan ${n}.`,
    (n) => `Menyelenggarakan dukungan ajudansi dan koordinasi protokoler Wakil Wali Kota pada acara ${n}.`,
    (n) => `Mendampingi Wakil Wali Kota serta memastikan kesiapan agenda pada kegiatan ${n}.`,
  ],
};

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Auth via API_SECRET header (opsional tapi dianjurkan)
  const secret = (req.headers["x-api-secret"] || "").trim();
  if (process.env.API_SECRET && secret !== process.env.API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { startDate, endDate, role, username } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate dan endDate wajib diisi (YYYY-MM-DD)" });
  }

  // Validasi format tanggal
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return res.status(400).json({ error: "Format tanggal harus YYYY-MM-DD" });
  }

  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ error: "Supabase env belum dikonfigurasi" });
  }

  try {
    // Ambil semua jadwal dari Supabase dalam rentang tanggal
    const url = SUPA_URL + "/rest/v1/jadwal" +
      "?select=id,data" +
      "&order=data->tanggal.asc";

    const r = await fetch(url, {
      headers: {
        "Content-Type":  "application/json",
        "apikey":        SUPA_KEY,
        "Authorization": "Bearer " + SUPA_KEY,
      },
    });

    if (!r.ok) throw new Error("Supabase error " + r.status);

    const rows = await r.json();

    // Filter di server: tanggal dalam rentang, alur disetujui
    let events = rows
      .map(row => ({ id: row.id, ...(row.data || {}) }))
      .filter(ev => {
        if (ev.alur !== "disetujui") return false;
        if (!ev.tanggal) return false;
        if (ev.tanggal < startDate || ev.tanggal > endDate) return false;
        // Untuk staf/timkom: hanya jadwal yang mereka ditugaskan
        if (["staf", "timkom"].includes(role) && username) {
          return (ev.personil || []).includes(username);
        }
        return true;
      })
      .sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam));

    // Bangun output E-Kinerja — rotasi varian per-index agar kalimat bervariasi
    const getTemplate = (nama, idx) => {
      const variants = TEMPLATE[role];
      if (!variants || !variants.length) return `Melaksanakan tugas pada acara ${nama}.`;
      return variants[idx % variants.length](nama);
    };

    const lines = events.map((ev, i) => {
      return ev.tanggal + " | " + getTemplate(ev.namaAcara, i);
    });

    return res.status(200).json({
      ok: true,
      count: lines.length,
      startDate,
      endDate,
      role: role || "unknown",
      output: lines.join("\n"),
      lines,
    });

  } catch (err) {
    console.error("[api/ekinerja]", err.message);
    return res.status(500).json({ error: err.message });
  }
}