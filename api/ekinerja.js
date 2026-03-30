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

// Template kalimat per role (identik dengan frontend)
const TEMPLATE = {
  kabag:                (nama) => `Melakukan executive review dan persetujuan akhir terhadap draf jadwal pimpinan pada acara ${nama}.`,
  kasubbag_protokol:    (nama) => `Mengoordinasikan pembagian tugas dan menetapkan penugasan personel staf protokol untuk kegiatan ${nama}.`,
  kasubbag_komdokpim:   (nama) => `Menetapkan penugasan personel Tim Komdokpim dan mengarahkan angle pemberitaan untuk kegiatan ${nama}.`,
  admin_rk:             (nama) => `Melakukan data entry dan menginput draf usulan jadwal pimpinan ke dalam sistem untuk kegiatan ${nama}.`,
  admin_undangan:       (nama) => `Melakukan data entry dan menginput draf usulan jadwal pimpinan ke dalam sistem untuk kegiatan ${nama}.`,
  staf:                 (nama) => `Melaksanakan tugas pendampingan teknis dan memastikan kesiapan lokasi pimpinan pada acara ${nama}.`,
  timkom:               (nama) => `Melaksanakan pengambilan dokumentasi visual dan menyusun draf rilis/caption untuk kegiatan ${nama}.`,
  ajudan_walikota:      (nama) => `Mendampingi dan memfasilitasi kehadiran Wali Kota pada acara ${nama}.`,
  ajudan_wakilwalikota: (nama) => `Mendampingi dan memfasilitasi kehadiran Wakil Wali Kota pada acara ${nama}.`,
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

    // Bangun output E-Kinerja
    const getTemplate = (nama) => {
      const fn = TEMPLATE[role];
      return fn ? fn(nama) : `Melaksanakan tugas pada acara ${nama}.`;
    };

    const lines = events.map(ev => {
      return ev.tanggal + " | " + getTemplate(ev.namaAcara);
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