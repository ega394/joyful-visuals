// Data contoh untuk tangkapan layar proposal. Seluruh nama orang, nomor, dan
// kegiatan adalah rekaan; tidak ada data dari basis data sungguhan.
const pad = (n) => String(n).padStart(2, "0");
const HARI_INI = new Date(Date.UTC(2026, 9, 6)); // Selasa, 6 Oktober 2026 (WITA)
export const tgl = (k) => { const d = new Date(HARI_INI); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
// ISO dengan zona WITA (+08:00)
const pada = (k, jam) => `${tgl(k)}T${jam}:00+08:00`;

export const USERS = [
  ["walikota", "WK@2025", "walikota", "Wali Kota Tarakan", "Wali Kota Tarakan"],
  ["wakilwalikota", "WWK@2025", "wakilwalikota", "Wakil Wali Kota Tarakan", "Wakil Wali Kota Tarakan"],
  ["ajudan_wk", "Ajudan@2025", "ajudan_walikota", "Rahmat Hidayat", "Ajudan Wali Kota"],
  ["ajudan_wwk", "Ajudan@2025", "ajudan_wakilwalikota", "Bayu Saputra", "Ajudan Wakil Wali Kota"],
  ["kabag", "Kabag@2025", "kabag", "Kabag Prokopim", "Kepala Bagian Protokol dan Komunikasi Pimpinan"],
  ["kasubbag_protokol", "Ksbg@2025", "kasubbag_protokol", "Kasubbag Protokol", "Kepala Sub Bagian Protokol"],
  ["kasubbag_komdokpim", "Kdp@2025", "kasubbag_komdokpim", "Kasubbag Komdokpim", "Kepala Sub Bagian Komunikasi dan Dokumentasi Pimpinan"],
  ["admin_rk", "AdminRK@2025", "admin_rk", "Admin Rencana Kegiatan", "Admin Rencana Kegiatan Pimpinan"],
  ["admin_undangan", "AdminUnd@2025", "admin_undangan", "Admin Undangan", "Admin Surat dan Undangan Pimpinan"],
  ["rina", "Staf@2025", "staf", "Rina Amelia", "Staf Protokol"],
  ["fajar", "Staf@2025", "staf", "Fajar Ramadhan", "Staf Protokol"],
  ["dewi", "Staf@2025", "staf", "Dewi Lestari", "Staf Protokol"],
  ["yusuf", "Staf@2025", "staf", "Yusuf Pratama", "Staf Protokol"],
  ["agus", "Timkom@2025", "timkom", "Agus Setiawan", "Tim Komunikasi dan Dokumentasi"],
  ["nanda", "Timkom@2025", "timkom", "Nanda Safitri", "Tim Komunikasi dan Dokumentasi"],
  ["sri", "Pramu@2025", "pramu_tamu", "Sri Wahyuni", "Pramu Tamu"],
  ["walpri", "Walpri@2025", "walpri", "Walpri Wali Kota", "Pengawal Pribadi Pimpinan"],
  ["mitra_dkisp", "Mitra@2025", "mitra_kerja", "DKISP Kota Tarakan", "Mitra Kerja Pemerintah Kota"],
].map(([username, password, role, nama, jabatan], i) => ({
  id: i + 1, username, password, role, nama, jabatan,
  noWA: "62811000" + pad(i + 10) + "00", disabled: false,
  can_manage_rooms: username === "kasubbag_protokol" || username === "rina",
  plh_untuk: null, plh_mulai: null, plh_selesai: null, plh_dasar: null,
}));
// Pelaksana Harian aktif: Dewi (staf) mengampu Kasubbag Protokol selama cuti.
Object.assign(USERS.find((u) => u.username === "dewi"), {
  plh_untuk: "kasubbag_protokol", plh_mulai: tgl(-1), plh_selesai: tgl(3), plh_dasar: "800.1.11.1/412/SETDA/2026",
});

const t = (action, k, jam, actor, actor_role, note) => ({ action, at: pada(k, jam), actor, actor_role, ...(note ? { note } : {}) });
// Jejak lengkap sampai tayang, relatif terhadap hari pengajuan k.
const jejakTayang = (k, extra = []) => [
  t("create", k, "08:12", "admin_rk", "admin_rk"),
  t("upload_undangan", k, "08:13", "admin_rk", "admin_rk"),
  t("submit", k, "08:15", "admin_rk", "admin_rk"),
  t("forward_to_kabag", k, "09:02", "kasubbag_protokol", "kasubbag_protokol", "Undangan sesuai; tidak bentrok"),
  t("publish", k, "09:20", "kabag", "kabag", "Undangan sudah dibuka · Tidak bentrok dengan agenda pimpinan · Kehadiran pimpinan pada acara ini layak"),
  ...extra,
];
const nilai = (a) => ({ s0: a[0], s1: a[1], s2: a[2], s3: a[3], s4: a[4], catatan: "", submitted: true, savedAt: Date.now(), tipe: "Protokol" });
const nilaiK = (a) => ({ ...nilai(a), tipe: "Komdok" });

const dasar = {
  alur: "disetujui", catatanTolak: "", catatanKasubbag: "", catatanKabag: "", statusWK: null, statusWWK: null,
  perwakilanWK: "", perwakilanWWK: "", delegasiKeWWK: false, delegasiWWKJajaran: false, besertaIstriWK: false,
  besertaIstriWWK: false, sambutanFile: null, sambutanNama: "", sambutanDocx: null, sambutanDocxNama: "",
  undanganFile: null, undanganNama: "", catatanPimpinan: "", tersembunyi: false, alurHapus: null, alurEdit: null,
  usulanEdit: null, lokasi: "", personil: [], catatanPenugasan: "", evaluasi: {}, pakaian: "PDH",
  jenisKegiatan: "Menghadiri", catatan: "", submittedBy: "admin_rk", untukPimpinan: ["walikota"],
};
export const UNDANGAN_URL = "https://contoh.supabase.co/storage/v1/object/public/undangan/contoh.pdf";
let nid = 1780000000000;
const ev = (o) => ({ ...dasar, id: nid++, ...o });

export const JADWAL = [
  // ── Hari ini ──
  ev({ tanggal: tgl(0), jam: "09:00", jamSelesai: "11:00", namaAcara: "Rapat Koordinasi Percepatan Infrastruktur Kota", penyelenggara: "Dinas PUPR", kontak: "Budi 0812-0000-1001", buktiUndangan: "000.1.5/214/PUPR/2026", lokasi: "Ruang Imbaya, Kantor Wali Kota Tarakan", jenisKegiatan: "Pengarahan", untukPimpinan: ["walikota", "wakilwalikota"], statusWK: "hadir", statusWWK: "hadir", personil: ["rina", "agus"], undanganFile: UNDANGAN_URL, undanganNama: "Undangan-Rakor-PUPR.pdf", timeline: jejakTayang(-2, [t("penugasan_personil", -2, "10:05", "kasubbag_protokol", "kasubbag_protokol", "2 personil"), t("wk_hadir", -1, "07:40", "ajudan_wk", "ajudan_walikota"), t("wwk_hadir", -1, "08:02", "ajudan_wwk", "ajudan_wakilwalikota")]) }),
  ev({ tanggal: tgl(0), jam: "14:00", jamSelesai: "15:30", namaAcara: "Peresmian Taman Kota Baru", penyelenggara: "Dinas Lingkungan Hidup", kontak: "Sari 0813-0000-2002", buktiUndangan: "600.4/88/DLH/2026", lokasi: "Taman Kota Baru, Kelurahan Karang Anyar", pakaian: "Batik Lengan Panjang", jenisKegiatan: "Sambutan", personil: ["fajar", "nanda"], undanganFile: UNDANGAN_URL, timeline: jejakTayang(-3, [t("penugasan_personil", -3, "11:00", "kasubbag_protokol", "kasubbag_protokol", "2 personil")]) }),
  ev({ tanggal: tgl(0), jam: "19:30", jamSelesai: "22:00", namaAcara: "Malam Ramah Tamah Musyawarah Daerah KONI", penyelenggara: "KONI Kota Tarakan", kontak: "Hendra 0815-0000-3003", buktiUndangan: "045/KONI-TRK/X/2026", lokasi: "Gedung Serbaguna Kota Tarakan", pakaian: "Batik Lengan Panjang", untukPimpinan: ["wakilwalikota"], statusWWK: "hadir", timeline: jejakTayang(-1) }),
  // ── Menunggu ──
  ev({ tanggal: tgl(1), jam: "08:00", jamSelesai: "09:00", namaAcara: "Apel Gabungan ASN Lingkup Pemerintah Kota", penyelenggara: "Sekretariat Daerah", kontak: "Hendra 0815-0000-3003", buktiUndangan: "800.1.11/530/SETDA/2026", lokasi: "Halaman Kantor Wali Kota Tarakan", alur: "menunggu_kabag", undanganFile: UNDANGAN_URL, undanganNama: "Undangan-Apel-Gabungan.pdf", timeline: [t("create", 0, "07:51", "admin_rk", "admin_rk"), t("upload_undangan", 0, "07:52", "admin_rk", "admin_rk"), t("submit", 0, "07:55", "admin_rk", "admin_rk"), t("forward_to_kabag", 0, "08:31", "kasubbag_protokol", "kasubbag_protokol", "Undangan lengkap; tidak bentrok")] }),
  ev({ tanggal: tgl(1), jam: "10:00", jamSelesai: "11:00", namaAcara: "Audiensi Pengurus Forum Anak Kota Tarakan", penyelenggara: "Forum Anak Kota Tarakan", kontak: "Putri 0812-0000-4004", buktiUndangan: "Permohonan audiensi daring", lokasi: "Ruang Kerja Wali Kota", alur: "menunggu_kasubbag", jenisKegiatan: "Audiensi", timeline: [t("create", 0, "09:14", "admin_rk", "admin_rk", "Dari permohonan audiensi daring"), t("submit", 0, "09:16", "admin_rk", "admin_rk")] }),
  // ── Disposisi ke Wakil Wali Kota ──
  ev({ tanggal: tgl(2), jam: "09:00", jamSelesai: "12:00", namaAcara: "Pembukaan Musrenbang Kecamatan Tarakan Barat", penyelenggara: "Bappeda Litbang", kontak: "Andi 0811-0000-5005", buktiUndangan: "000.1.5/310/BAPPEDA/2026", lokasi: "Aula Kantor Camat Tarakan Barat", jenisKegiatan: "Sambutan", untukPimpinan: ["walikota"], delegasiKeWWK: true, statusWK: "diwakilkan", perwakilanWK: "Wakil Wali Kota Tarakan", statusWWK: "hadir", personil: ["dewi", "agus"], undanganFile: UNDANGAN_URL, timeline: jejakTayang(-4, [t("delegasi_to_wwk", -3, "20:12", "walikota", "walikota", "Mohon diwakili Wakil Wali Kota"), t("wwk_hadir", -3, "21:05", "ajudan_wwk", "ajudan_wakilwalikota"), t("penugasan_personil", -2, "08:10", "kasubbag_protokol", "kasubbag_protokol", "2 personil")]) }),
  // ── Usulan perubahan yang tertahan ──
  ev({ tanggal: tgl(3), jam: "13:30", jamSelesai: "15:00", namaAcara: "Penyerahan Bantuan Sosial Lanjut Usia", penyelenggara: "Dinas Sosial dan Pemberdayaan Masyarakat", kontak: "Rudi 0812-0000-6006", buktiUndangan: "400.9/77/DINSOS/2026", lokasi: "Kantor Dinas Sosial dan Pemberdayaan Masyarakat", jenisKegiatan: "Sambutan", statusWK: "hadir", personil: ["yusuf"], undanganFile: UNDANGAN_URL,
    alurEdit: "menunggu_kabag", usulanEdit: "ISI", alasanEdit: "Penyelenggara memajukan waktu dan memindahkan lokasi (surat susulan)", usulanEditOleh: "admin_rk", usulanEditPada: pada(-3, "10:20"),
    timeline: jejakTayang(-6, [t("penugasan_personil", -5, "09:00", "kasubbag_protokol", "kasubbag_protokol", "1 personil"), t("usulan_edit_diajukan", -3, "10:20", "admin_rk", "admin_rk", "Jam Mulai, Jam Selesai, Lokasi"), t("usulan_edit_ke_kabag", -3, "11:02", "kasubbag_protokol", "kasubbag_protokol")]) }),
  ev({ tanggal: tgl(4), jam: "08:30", jamSelesai: "10:00", namaAcara: "Pencanangan Bulan Imunisasi Anak Nasional", penyelenggara: "Dinas Kesehatan", kontak: "dr. Lina 0813-0000-7007", buktiUndangan: "400.7/215/DINKES/2026", lokasi: "Puskesmas Juata Permai", jenisKegiatan: "Sambutan", statusWK: "hadir", personil: ["rina", "nanda"], undanganFile: UNDANGAN_URL, timeline: jejakTayang(-2) }),
  ev({ tanggal: tgl(7), jam: "09:00", jamSelesai: "11:00", namaAcara: "Rapat Paripurna DPRD Penyampaian Nota Keuangan", penyelenggara: "Sekretariat DPRD", kontak: "Ahmad 0811-0000-8008", buktiUndangan: "005/412/DPRD/2026", lokasi: "Gedung DPRD Kota Tarakan", pakaian: "PSL", untukPimpinan: ["walikota", "wakilwalikota"], undanganFile: UNDANGAN_URL, timeline: jejakTayang(-1) }),
];

{ const e = JADWAL.find((x) => x.usulanEdit === "ISI"); const { timeline, evaluasi, usulanEdit, alurEdit, alasanEdit, usulanEditOleh, usulanEditPada, id, ...isi } = e; e.usulanEdit = { ...isi, jam: "09:00", jamSelesai: "10:30", lokasi: "Aula Kantor Wali Kota Tarakan" }; }
// ── Kegiatan yang sudah lewat, dengan evaluasi petugas (untuk rekap kinerja) ──
const lalu = [
  ["Rapat Evaluasi Penanganan Banjir", "BPBD", "Pengarahan", ["rina", "agus"]],
  ["Peletakan Batu Pertama Gedung Sekolah", "Dinas Pendidikan", "Sambutan", ["fajar", "nanda"]],
  ["Pelantikan Pengurus Karang Taruna", "Dinas Sosial dan Pemberdayaan Masyarakat", "Sambutan", ["dewi", "agus"]],
  ["Festival Iraw Tengkayu", "Dinas Kebudayaan, Pemuda dan Olahraga", "Sambutan", ["rina", "fajar", "nanda"]],
  ["Penandatanganan Nota Kesepahaman dengan Universitas Borneo Tarakan", "Bagian Kerja Sama", "Menghadiri", ["yusuf", "agus"]],
  ["Rapat Koordinasi Pengendalian Inflasi Daerah", "Bagian Perekonomian", "Pengarahan", ["dewi", "nanda"]],
  ["Peresmian Pasar Rakyat Tenguyun", "Dinas Koperasi, UMKM dan Perdagangan", "Sambutan", ["rina", "agus"]],
  ["Penyerahan SK PPPK", "BKPSDM", "Pengarahan", ["fajar", "yusuf", "nanda"]],
  ["Lomba Kebersihan Antar-Kelurahan", "Dinas Lingkungan Hidup", "Menghadiri", ["dewi", "agus"]],
  ["Pembukaan Pameran UMKM", "Dinas Koperasi, UMKM dan Perdagangan", "Sambutan", ["rina", "nanda"]],
  ["Rapat Pleno Penurunan Stunting", "Dinas Kesehatan", "Pengarahan", ["yusuf", "agus"]],
  ["Safari Jumat di Masjid Agung", "Bagian Kesejahteraan Rakyat", "Menghadiri", ["fajar", "nanda"]],
];
lalu.forEach(([nama, pyl, jenis, pers], i) => {
  const k = -(i * 2 + 1);
  const ev_ = ev({ tanggal: tgl(k), jam: ["08:00", "09:00", "10:00", "13:30", "14:00", "19:30"][i % 6], namaAcara: nama, penyelenggara: pyl, jenisKegiatan: jenis,
    kontak: "Narahubung 0812-0000-9" + pad(i) + "0", buktiUndangan: `000.1.5/${300 + i}/2026`, lokasi: "Kota Tarakan", personil: pers,
    untukPimpinan: i % 3 === 2 ? ["wakilwalikota"] : ["walikota"], statusWK: i % 3 === 2 ? null : (i % 4 === 1 ? "diwakilkan" : "hadir"),
    perwakilanWK: i % 4 === 1 ? "Sekretaris Daerah" : "", statusWWK: i % 3 === 2 ? "hadir" : null, undanganFile: UNDANGAN_URL,
    timeline: jejakTayang(k - 3, [t("penugasan_personil", k - 2, "09:00", "kasubbag_protokol", "kasubbag_protokol", pers.length + " personil"), t("evaluasi_diisi", k, "21:00", pers[0], "staf")]),
  });
  if (i < 5) Object.assign(ev_, { captionStatus: "disetujui", captionWK: `Wali Kota Tarakan menghadiri ${nama}. Dalam kesempatan itu Wali Kota menyampaikan apresiasi kepada ${pyl} atas penyelenggaraan kegiatan.`, captionBerita: "" });
  else if (i === 5) Object.assign(ev_, { captionStatus: "revisi", captionWK: "Rancangan keterangan foto kegiatan.", captionCatatan: "Lengkapi nama pejabat yang hadir" });
  ev_.evaluasi = Object.fromEntries(pers.filter((u) => i % 2 === 0 || u === "agus" || u === "nanda").map((u, j) => [u, (u === "agus" || u === "nanda") ? nilaiK([80 + j * 5, 85, 75 + (i % 3) * 5, 80, 90]) : nilai([85, 80 + (i % 2) * 10, 90, 75 + j * 5, 85])]));
  JADWAL.push(ev_);
});

// ── Ruangan ──
export const ROOMS = [{ id: 1, name: "Kenawai", capacity: 20 }, { id: 2, name: "Imbaya", capacity: 40 }];
const bk = (room_id, k, session, status, instansi, event_name, peserta, kode) => ({
  id: "b" + kode, booking_code: kode, room_id, start_date: tgl(k), end_date: tgl(k), session, status, instansi, event_name,
  pic_name: "PIC " + instansi.split(" ").slice(-1)[0], pic_wa: "0812000011" + kode.slice(-2), participant_count: peserta, notes: null,
  created_at: pada(k - 5, "10:00"), reviewed_at: status === "Pending" ? null : pada(k - 4, "09:00"), reviewed_by: status === "Pending" ? null : "Kasubbag Protokol",
  rooms: ROOMS.find((r) => r.id === room_id),
});
for (const e of JADWAL.filter((x) => x.tanggal === tgl(0) && x.alur === "disetujui").slice(0, 2)) Object.assign(e, { captionStatus: "menunggu", captionWK: `Wali Kota Tarakan menghadiri ${e.namaAcara}.` });
export const BOOKINGS = [
  bk(2, 0, "Pagi", "Approved", "Dinas PUPR", "Rapat Koordinasi Percepatan Infrastruktur Kota", 35, "A1B2C301"),
  bk(1, 0, "Siang", "Approved", "Bappeda Litbang", "Rapat Penyusunan Renja 2027", 18, "A1B2C302"),
  bk(2, 1, "Full_Day", "Approved", "BKPSDM", "Bimbingan Teknis Manajemen Kinerja ASN", 40, "A1B2C303"),
  bk(1, 2, "Pagi", "Pending", "Dinas Kesehatan", "Rapat Persiapan Bulan Imunisasi", 15, "A1B2C304"),
  bk(2, 3, "Siang", "Approved", "Bagian Hukum", "Sosialisasi Peraturan Daerah Baru", 30, "A1B2C305"),
  bk(1, 7, "Pagi", "Approved", "Dinas Pendidikan", "Rapat Kepala Sekolah SMP", 20, "A1B2C306"),
  bk(2, 8, "Pagi", "Pending", "Kecamatan Tarakan Timur", "Rapat Koordinasi Kelurahan", 25, "A1B2C307"),
  bk(2, 9, "Full_Day", "Approved", "Dinas Sosial dan Pemberdayaan Masyarakat", "Pelatihan Pendamping Sosial", 38, "A1B2C308"),
  bk(1, 10, "Siang", "Approved", "Inspektorat", "Entry Meeting Audit Kinerja", 12, "A1B2C309"),
  bk(1, 14, "Pagi", "Approved", "Bagian Organisasi", "Penyusunan Standar Pelayanan", 16, "A1B2C310"),
  bk(2, 15, "Siang", "Pending", "Dinas Koperasi, UMKM dan Perdagangan", "Temu Usaha Pelaku UMKM", 40, "A1B2C311"),
  bk(1, -3, "Pagi", "Approved", "Bagian Umum", "Rapat Pengelolaan Aset", 14, "A1B2C312"),
  bk(2, -6, "Full_Day", "Approved", "BPBD", "Rapat Kesiapsiagaan Bencana", 36, "A1B2C313"),
];

// ── Permohonan audiensi ──
export const TAMU = [
  ["Forum Anak Kota Tarakan", "Putri Ayuningtyas", "Wali Kota", "Menyampaikan hasil Musyawarah Anak Kota dan undangan Hari Anak", "pending_pimpinan"],
  ["Ikatan Pelajar Tarakan", "Muhammad Rizal", "Wali Kota", "Audiensi rencana kegiatan Pekan Pelajar", "pending_kabag"],
  ["Himpunan Pengusaha Muda Tarakan", "Kevin Tandiono", "Wali Kota", "Silaturahmi pengurus baru dan paparan program kerja", "pending_kabag"],
  ["Lembaga Adat Tidung", "H. Abdul Latief", "Wakil Wali Kota", "Koordinasi pelaksanaan ritual adat", "pending_kasubbag"],
  ["Persatuan Nelayan Juata Laut", "Hasan Basri", "Wakil Wali Kota", "Menyampaikan aspirasi tentang dermaga nelayan", "pending_rk"],
  ["PT Contoh Energi Nusantara", "Ir. Daniel Wijaya", "Wali Kota", "Paparan rencana investasi energi terbarukan", "approved"],
  ["Paguyuban Seni Budaya Tidung", "Siti Aminah", "Wakil Wali Kota", "Undangan Festival Budaya Tidung", "selesai"],
  ["Komunitas Peduli Mangrove", "Yohanes Lie", "Wali Kota", "Kolaborasi penanaman mangrove", "selesai"],
].map(([instansi, nama, tujuan, maksud, status], i) => ({
  id: 900 + i, nama, instansi, no_wa: "62812000022" + i, tujuan_pejabat: tujuan, maksud_keperluan: maksud, status,
  preferensi_tanggal: tgl(2 + i), preferensi_jam: "10:00", created_at: pada(-i - 1, "09:30"), catatan_staf: status === "pending_rk" ? null : "Diverifikasi oleh Admin RK",
}));

// ── Daftar hadir ──
export const ACARA_HADIR = {
  kode: "RKINFRA", judul: "Rapat Koordinasi Percepatan Infrastruktur Kota", subjudul: "Dinas PUPR Kota Tarakan",
  tanggal: "Selasa, 6 Oktober 2026", lokasi: "Ruang Imbaya, Kantor Wali Kota Tarakan", status: "buka",
  fieldAktif: ["jabatan", "instansi", "noHP", "ttd"], fieldTambahan: [],
};
export const DAFTAR_ACARA = [
  { ...ACARA_HADIR, tanggalISO: tgl(0), jamMulai: "09:00", jamSelesai: "11:00", jumlahHadir: 31, dibuatOleh: "Rina Amelia" },
  { kode: "PRSMTMN", judul: "Peresmian Taman Kota Baru", tanggal: tgl(0), jamMulai: "14:00", jamSelesai: "15:30", status: "buka", jumlahHadir: 0, fieldAktif: ["jabatan", "instansi", "selfie", "ttd"] },
  { kode: "EVBNJR", judul: "Rapat Evaluasi Penanganan Banjir", tanggal: tgl(-1), jamMulai: "08:00", jamSelesai: "10:00", status: "tutup", jumlahHadir: 27, fieldAktif: ["jabatan", "instansi", "ttd"] },
];
