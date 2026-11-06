// Paparan finalis Lomba Inovasi Daerah Kota Tarakan 2026 — Prokopim Hibot.
// Wawancara Bappeda Litbang, 9 November 2026: penyajian 15 menit.
// Urutan mengikuti bab proposal Tarakan; angka sama persis dengan proposal
// (data 5 Oktober 2026 pukul 15.47 WITA). Yang dibangun sesudah proposal
// ditandai "pembaruan sejak proposal"; menu Indikator Kinerja ditandai
// "siap diterapkan" karena belum dibuka bagi pengguna.
//
// Membangun:
//   python3 naskah_tarakan.py          (catatan pembicara → naskah-tarakan.json)
//   ASET_PPT=<folder aset> NODE_PATH=<node_modules> APPLY_THEME=<apply_theme.js> \
//     node docs/lomba/build/paparan/buat-tarakan.cjs <keluaran.pptx>
// Folder aset (semua berdata contoh) dirakit dari: aset/ (hibot, tarakan, qr, hp_walikota),
// aset-tarakan/ (monitorwa.jpg, iku.jpg), dan ../../tarakan/tangkapan/.
const pptxgen = require("pptxgenjs");
const NASKAH = require("./naskah-tarakan.json");
const applyTheme = process.env.APPLY_THEME ? require(process.env.APPLY_THEME).applyTheme : async () => {};
const A = (process.env.ASET_PPT || __dirname + "/aset") + "/";
const KELUAR = process.argv[2] || __dirname + "/Paparan-Prokopim-Hibot-Tarakan-2026.pptx";

const THEME = {
  name: "Prokopim Hibot",
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  colors: {
    dk1: "0F172A", lt1: "FFFFFF", dk2: "0A1628", lt2: "EEF2F8",
    accent1: "C9A84C", accent2: "1E3A6E", accent3: "059669", accent4: "B91C1C",
    accent5: "64748B", accent6: "CBD5E1", hlink: "1E3A6E", folHlink: "1E3A6E",
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Prokopim Hibot — Paparan Finalis Lomba Inovasi Daerah Kota Tarakan 2026";
pres.author = "Tim Inovasi Prokopim Hibot, Setda Kota Tarakan";
pres.company = "Pemerintah Kota Tarakan";
const C = pres.SchemeColor;

const W = 13.333, M = 0.6;
const KAKI = "Prokopim Hibot  ·  Lomba Inovasi Daerah Kota Tarakan 2026  ·  Kategori A, Inovasi Tata Kelola Pemerintahan";
const SUMBER = "Sumber: basis data Prokopim Hibot, 5 Oktober 2026 pukul 15.47 WITA (sama dengan proposal).";

pres.defineSlideMaster({
  title: "ISI",
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "aspek", type: "body", x: M, y: 0.32, w: 9, h: 0.32, fontSize: 12, bold: true, color: C.accent5, charSpacing: 2, margin: 0, valign: "middle" }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.66, w: W - 2 * M, h: 0.85, fontSize: 28, bold: true, color: C.text2, margin: 0, valign: "top", align: "left" }, text: "" } },
    { text: { text: KAKI, options: { x: M, y: 7.02, w: 10, h: 0.3, fontSize: 10, color: C.accent5, margin: 0 } } },
    { image: { path: A + "tarakan.png", x: W - M - 1.15, y: 6.95, w: 0.4, h: 0.4 } },
  ],
  slideNumber: { x: W - M - 0.6, y: 7.02, w: 0.6, h: 0.3, fontSize: 10, color: C.accent5, align: "right" },
});
pres.defineSlideMaster({
  title: "GELAP",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "aspek", type: "body", x: M, y: 0.32, w: 9, h: 0.32, fontSize: 12, bold: true, color: C.accent1, charSpacing: 2, margin: 0, valign: "middle" }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.66, w: W - 2 * M, h: 0.85, fontSize: 28, bold: true, color: C.background1, margin: 0, valign: "top", align: "left" }, text: "" } },
    { text: { text: KAKI, options: { x: M, y: 7.02, w: 10, h: 0.3, fontSize: 10, color: C.accent6, margin: 0 } } },
  ],
  slideNumber: { x: W - M - 0.6, y: 7.02, w: 0.6, h: 0.3, fontSize: 10, color: C.accent6, align: "right" },
});

// ── Pembantu ───────────────────────────────────────────────────────
const bayang = () => ({ type: "outer", color: "0A1628", opacity: 0.12, blur: 8, offset: 2, angle: 90 });
const kartu = (s, x, y, w, h, o = {}) =>
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: o.isi || C.background2 }, line: { color: o.garis || o.isi || C.background2, width: o.tebal || 0.75 }, shadow: o.bayang ? bayang() : undefined, objectName: o.nama });
// Batas bawah 14 pt agar terbaca di proyektor; hanya label kapital (charSpacing)
// dan catatan sumber (kecil: true) yang boleh lebih kecil.
const teks = (s, t, x, y, w, h, o = {}) => {
  const { kecil, ...opsi } = o;
  const ukuran = opsi.fontSize ?? 14;
  return s.addText(t, { x, y, w, h, isTextBox: true, margin: 0, color: C.text1, valign: "top", ...opsi,
    fontSize: kecil || opsi.charSpacing ? ukuran : Math.max(14, ukuran) });
};
const bulat = (s, x, y, d, warna, label, warnaTeks) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: warna }, line: { color: warna } });
  s.addText(label, { x, y, w: d, h: d, isTextBox: true, margin: 0, align: "center", valign: "middle", fontSize: 14, bold: true, color: warnaTeks });
};
const panah = (s, x1, y1, x2, y2, warna = C.accent5) =>
  s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1, line: { color: warna, width: 1.75, endArrowType: "triangle" } });
const butir = (arr, o = {}) => arr.map((b, n) => ({ text: b, options: { bullet: true, breakLine: n < arr.length - 1, ...o } }));
// Gambar dengan bingkai tipis; ukuran asli (piksel) menjaga rasio.
const gambar = (s, f, x, y, w, px, py) => {
  const h = w * py / px;
  s.addImage({ path: A + f, x, y, w, h, shadow: bayang() });
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { type: "none" }, line: { color: C.accent6, width: 0.75 } });
  return h;
};
// Label status kecil: AKTIF (hijau) atau SIAP DITERAPKAN (emas).
const status = (s, x, y, siap) => {
  const t = siap ? "SIAP DITERAPKAN" : "AKTIF", w = siap ? 1.75 : 0.85;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.28, rectRadius: 0.06, fill: { color: siap ? "FBF3DF" : "E3F5EC" }, line: { color: siap ? C.accent1 : C.accent3, width: 0.75 } });
  s.addText(t, { x, y, w, h: 0.28, isTextBox: true, margin: 0, align: "center", valign: "middle", fontSize: 10, bold: true, charSpacing: 1, color: siap ? "8A6A12" : C.accent3 });
};
const logo = (s) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 0.45, w: 1.95, h: 0.95, rectRadius: 0.14, fill: { color: C.background1 }, line: { color: C.background1 }, objectName: "alas logo" });
  s.addImage({ path: A + "tarakan.png", x: M + 0.2, y: 0.53, w: 0.8, h: 0.8 });
  s.addImage({ path: A + "hibot.png", x: M + 1.08, y: 0.55, w: 0.76, h: 0.76 });
};
let BAGIAN = "Pembuka";
const bagian = (t) => { BAGIAN = t; pres.addSection({ title: t }); };
const isi = (aspek, judul, gelap = false) => {
  const s = pres.addSlide({ masterName: gelap ? "GELAP" : "ISI", sectionTitle: BAGIAN });
  if (aspek) s.addText(aspek, { placeholder: "aspek" });
  s.addText(judul, { placeholder: "title" });
  return s;
};
const catat = (s, n) => s.addNotes(NASKAH[String(n)]);

// ══ 1. Pembuka ═════════════════════════════════════════════════════
bagian("Pembuka");
{
  const s = pres.addSlide({ masterName: "GELAP", sectionTitle: BAGIAN });
  logo(s);
  teks(s, "LOMBA INOVASI DAERAH KOTA TARAKAN 2026  ·  PRESENTASI DAN WAWANCARA FINALIS", M, 1.6, 8.6, 0.3, { fontSize: 12, bold: true, color: C.accent1, charSpacing: 1 });
  teks(s, "Prokopim Hibot", M, 2.0, 8.2, 1.0, { fontSize: 54, bold: true, color: C.background1 });
  teks(s, "Superapp Pelayanan Keprotokolan dan Komunikasi Pimpinan Pemerintah Kota Tarakan", M, 3.05, 8.0, 0.95, { fontSize: 22, color: C.accent1 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 4.15, w: 8.2, h: 1.12, rectRadius: 0.08, fill: { color: C.accent1, transparency: 85 }, line: { color: C.accent1, width: 1.25 } });
  teks(s, "KATEGORI", M + 0.25, 4.22, 1.8, 0.46, { fontSize: 12, bold: true, color: C.accent1, charSpacing: 1, valign: "middle" });
  teks(s, "A. Inovasi Tata Kelola Pemerintahan", M + 2.05, 4.22, 6.05, 0.46, { fontSize: 18, bold: true, color: C.background1, valign: "middle" });
  teks(s, "BIDANG FOKUS", M + 0.25, 4.72, 1.8, 0.46, { fontSize: 12, bold: true, color: C.accent1, charSpacing: 1, valign: "middle" });
  teks(s, "Misi 4 RPJMD Kota Tarakan 2025–2029", M + 2.05, 4.72, 6.05, 0.46, { fontSize: 18, bold: true, color: C.background1, valign: "middle" });
  teks(s, "Bagian Protokol dan Komunikasi Pimpinan, Sekretariat Daerah Kota Tarakan", M, 5.4, 8.0, 0.36, { fontSize: 15, color: C.accent6 });
  teks(s, [
    { text: "Tim Inovasi  ", options: { bold: true, color: C.accent1 } },
    { text: "Anugrah Yega Pranatha, M.Si. (Ketua)  ·  Saifullah, S.H.  ·  Juliyanti, S.AP.  ·  Pebriadi Banne, S.IP.  ·  Nuraini Wiliadewi, S.IP.", options: { color: C.background1 } },
  ], M, 5.88, 8.0, 0.75, { fontSize: 13, kecil: true });
  s.addImage({ path: A + "hp_walikota.jpg", x: 9.35, y: 0.55, w: 2.95, h: 6.38, shadow: { type: "outer", color: "000000", opacity: 0.35, blur: 12, offset: 4, angle: 90 } });
  catat(s, 1);
}

// ══ 2. Latar belakang ══════════════════════════════════════════════
bagian("Latar belakang");
{
  const s = isi("LATAR BELAKANG", "617 kegiatan Pimpinan, dan semuanya dulu manual");
  const angka = [["617", "kegiatan sejak Maret–5 Oktober 2026"], ["91", "kegiatan per bulan rata-rata; puncak 120 (Agustus)"], ["498 · 180", "kegiatan Wali Kota · Wakil Wali Kota"], ["294", "kegiatan sambutan yang memerlukan naskah"]];
  angka.forEach(([a, k], i) => {
    const y = 1.8 + i * 1.12;
    kartu(s, M, y, 3.7, 0.95, { isi: i === 0 ? C.text2 : C.background2, nama: "angka" + (i + 1) });
    teks(s, a, M + 0.25, y, 1.65, 0.95, { fontSize: 26, bold: true, color: i === 0 ? C.accent1 : C.text2, valign: "middle" });
    teks(s, k, M + 1.95, y, 1.65, 0.95, { fontSize: 12, kecil: true, color: i === 0 ? C.background1 : C.accent5, valign: "middle" });
  });
  const X = 4.75, Wt = 4.6;
  teks(s, "Cara kerja sebelum Maret 2026", X, 1.8, Wt, 0.4, { fontSize: 17, bold: true, color: C.text2 });
  const baris = [
    ["Penyusunan agenda", "Spreadsheet, dicetak, diperiksa berjenjang"],
    ["Penelaahan", "±30 menit menjelang jam pulang, hari kerja"],
    ["Kegiatan mendesak", "Cetak ulang rencana kegiatan"],
    ["Disposisi", "Foto di grup percakapan"],
    ["Penugasan petugas", "Bergantung ingatan perorangan"],
    ["Ruangan dan audiensi", "Papan tulis; pemohon datang atau menelepon"],
  ];
  s.addTable(baris.map(([a, b], i) => [
    { text: a, options: { bold: true, color: C.text2, fill: { color: i % 2 ? "FFFFFF" : HEX.lt2 } } },
    { text: b, options: { color: C.text1, fill: { color: i % 2 ? "FFFFFF" : HEX.lt2 } } },
  ]), { x: X, y: 2.3, w: Wt, colW: [1.75, Wt - 1.75], fontSize: 13, fontFace: "Arial", border: { type: "none" }, rowH: 0.6, valign: "middle", margin: [0, 0.1, 0, 0.1] });
  const XP = 9.65, WP = W - M - XP;
  kartu(s, XP, 1.8, WP, 4.5, { isi: "FDECEC", garis: C.accent4, tebal: 1.5, nama: "pemicu" });
  teks(s, "PERISTIWA PEMICU · JANUARI 2026", XP + 0.25, 2.0, WP - 0.5, 0.3, { fontSize: 11, bold: true, color: C.accent4, charSpacing: 1 });
  teks(s, "Satu lembar disposisi agenda tidak ikut terfoto saat berkas diteruskan di grup percakapan.", XP + 0.25, 2.45, WP - 0.5, 1.6, { fontSize: 16, bold: true, color: C.text2 });
  teks(s, "Tidak ada yang lalai, tetapi tidak ada pula yang dapat mengetahuinya. Rantai penyampaiannya yang rapuh.", XP + 0.25, 4.15, WP - 0.5, 1.6, { fontSize: 14, color: C.text1 });
  teks(s, SUMBER, M, 6.55, W - 2 * M, 0.3, { kecil: true, fontSize: 11, color: C.accent5 });
  catat(s, 2);
}

// ══ 3. Akar masalah ════════════════════════════════════════════════
{
  const s = isi("LATAR BELAKANG  ·  ANALISIS MASALAH", "Akarnya satu: tidak ada satu sumber data yang sahih");
  kartu(s, M, 2.75, 3.6, 2.0, { isi: C.text2, nama: "akar" });
  teks(s, "AKAR MASALAH", M + 0.3, 2.98, 3.0, 0.3, { fontSize: 12, bold: true, color: C.accent1, charSpacing: 1 });
  teks(s, "Tidak tersedia satu sumber data yang sahih dan dapat dirujuk semua pihak", M + 0.3, 3.35, 3.05, 1.3, { fontSize: 17, bold: true, color: C.background1 });
  const cabang = [
    ["a", "Penelaahan terikat jendela waktu"],
    ["b", "Keputusan tidak meninggalkan jejak"],
    ["c", "Versi dokumen beredar ganda"],
    ["d", "Pengetahuan kerja melekat pada orang"],
    ["e", "Layanan publik tanpa kanal yang dapat ditelusuri"],
  ];
  const X = 5.3;
  cabang.forEach(([h, c], i) => {
    const y = 1.75 + i * 0.86;
    panah(s, M + 3.6, 3.75, X - 0.05, y + 0.33);
    kartu(s, X, y, 4.2, 0.66, { isi: C.background2, nama: "cabang" + (i + 1) });
    bulat(s, X + 0.15, y + 0.13, 0.4, C.text2, h, C.accent1);
    teks(s, c, X + 0.7, y, 3.4, 0.66, { fontSize: 15, color: C.text1, valign: "middle" });
  });
  const XP = 9.85, WP = W - M - XP;
  kartu(s, XP, 1.75, WP, 4.2, { isi: "FBF6E7", garis: C.accent1, tebal: 1.25, nama: "superapp" });
  teks(s, "MENGAPA SUPERAPP", XP + 0.25, 1.95, WP - 0.5, 0.3, { fontSize: 12, bold: true, color: "8A6A12", charSpacing: 1 });
  teks(s, "Persoalannya tersebar di kertas, spreadsheet, grup percakapan, papan tulis, dan telepon.", XP + 0.25, 2.35, WP - 0.5, 1.4, { fontSize: 15, color: C.text1 });
  teks(s, "Jawabannya satu wadah dengan satu data untuk seluruh layanan keprotokolan dan komunikasi pimpinan.", XP + 0.25, 3.85, WP - 0.5, 1.6, { fontSize: 15, bold: true, color: C.text2 });
  catat(s, 3);
}

// ══ 4. Pemilihan ide dan alur ══════════════════════════════════════
bagian("Deskripsi dan kebaruan");
{
  const s = isi("PEMILIHAN IDE", "Bukan menambah pengawasan, tetapi mengganti rantainya");
  const pilihan = [
    ["Menambah pengawasan dan pengingat manual", "Tidak menyentuh akar masalah"],
    ["Memperbaiki spreadsheet bersama", "Tetap banyak versi, tanpa jejak keputusan"],
    ["Mengadakan aplikasi jadi", "Butuh anggaran; alur keprotokolan sangat khas"],
    ["Membangun sendiri: satu data dan jejak audit", "Dipilih — tanpa anggaran pengadaan"],
  ];
  const lw = (W - 2 * M - 3 * 0.25) / 4;
  pilihan.forEach(([j, k], i) => {
    const x = M + i * (lw + 0.25), pilih = i === 3;
    kartu(s, x, 1.75, lw, 2.2, { isi: pilih ? C.text2 : C.background2, bayang: pilih, nama: "pilihan" + (i + 1) });
    bulat(s, x + 0.22, 1.95, 0.42, pilih ? C.accent1 : C.accent6, pilih ? "✓" : "✗", pilih ? C.text2 : C.accent5);
    teks(s, j, x + 0.22, 2.45, lw - 0.44, 0.85, { fontSize: 14, bold: true, color: pilih ? C.background1 : C.text2 });
    teks(s, k, x + 0.22, 3.38, lw - 0.44, 0.5, { fontSize: 12, kecil: true, color: pilih ? C.accent1 : C.accent5 });
  });
  teks(s, "Alur inti penetapan jadwal: tiga jenjang, satu data", M, 4.2, 9, 0.4, { fontSize: 18, bold: true, color: C.text2 });
  const langkah = [
    ["Admin Rencana Kegiatan", "Input jadwal dan undangan; benturan jadwal diperiksa otomatis"],
    ["Kasubbag Protokol", "Telaah dan verifikasi dari mana saja"],
    ["Kepala Bagian", "Persetujuan dengan daftar periksa wajib"],
    ["Tayang", "Pimpinan, ajudan, dan petugas"],
  ];
  const sw = (W - 2 * M - 3 * 0.5) / 4;
  langkah.forEach(([j, k], i) => {
    const x = M + i * (sw + 0.5), y = 4.72;
    kartu(s, x, y, sw, 1.75, { isi: i === 3 ? "FBF6E7" : "FFFFFF", garis: i === 3 ? C.accent1 : C.accent6, tebal: i === 3 ? 1.5 : 0.75, nama: "langkah" + (i + 1) });
    bulat(s, x + 0.2, y + 0.2, 0.46, C.text2, String(i + 1), C.background1);
    teks(s, j, x + 0.8, y + 0.2, sw - 0.95, 0.5, { fontSize: 15, bold: true, color: C.text2, valign: "middle" });
    teks(s, k, x + 0.2, y + 0.85, sw - 0.4, 0.85, { fontSize: 13, kecil: true, color: C.text1 });
    if (i < 3) panah(s, x + sw + 0.06, y + 0.87, x + sw + 0.44, y + 0.87, C.text2);
  });
  teks(s, "Setiap tahap tercatat pada jejak audit: pelaku, waktu, dan catatan keputusan.", M, 6.6, W - 2 * M, 0.3, { fontSize: 12, kecil: true, italic: true, color: C.accent5 });
  catat(s, 4);
}

// ══ 5. Superapp: sebelas alur kerja ════════════════════════════════
{
  const s = isi("DESKRIPSI  ·  CAKUPAN ALUR KERJA", "Satu superapp, sebelas alur kerja, satu data");
  const alur = ["Penetapan jadwal", "Perubahan jadwal terbit", "Penarikan dan pembatalan", "Penugasan petugas", "Audiensi dan tamu", "Peminjaman ruangan",
    "Daftar hadir digital", "Naskah sambutan", "Peliputan dan publikasi", "Penerbitan undangan", "Evaluasi kinerja"];
  const gw = 2.55, gh = 0.7, g = 0.15;
  alur.forEach((t, i) => {
    const x = M + (i % 3) * (gw + g), y = 1.75 + Math.floor(i / 3) * (gh + g);
    kartu(s, x, y, gw, gh, { isi: i === 10 ? "FBF6E7" : C.background2, garis: i === 10 ? C.accent1 : undefined, nama: "alur" + (i + 1) });
    bulat(s, x + 0.12, y + 0.15, 0.4, C.text2, String(i + 1), C.accent1);
    teks(s, t, x + 0.62, y, gw - 0.7, gh, { fontSize: 14, bold: true, color: C.text2, valign: "middle" });
  });
  teks(s, "Dasar tugas setiap alur: Peraturan Wali Kota Tarakan Nomor 50 Tahun 2021.", M, 5.25, 3 * gw + 2 * g, 0.3, { fontSize: 12, kecil: true, italic: true, color: C.accent5 });
  const X = M + 3 * (gw + g) + 0.25, Wl = W - M - X;
  teks(s, "Lapisan layanan menurut peran", X, 1.75, Wl, 0.35, { fontSize: 16, bold: true, color: C.text2 });
  const lapis = [
    ["Pimpinan Daerah", "Agenda pasti di telepon pintar; disposisi langsung"],
    ["Ajudan dan pengawal", "Pemberitahuan dini; konfirmasi kehadiran"],
    ["Pejabat struktural", "Antrean persetujuan, Pelaksana Harian, sebaran beban"],
    ["Petugas", "Penugasan, daftar hadir, evaluasi, rekap kinerja"],
    ["Masyarakat dan instansi", "Audiensi dan ruangan daring dengan kode"],
  ];
  lapis.forEach(([j, k], i) => {
    const y = 2.2 + i * 0.66;
    teks(s, j, X, y, 1.9, 0.6, { fontSize: 13, kecil: true, bold: true, color: C.text2, valign: "middle" });
    teks(s, k, X + 1.95, y, Wl - 1.95, 0.6, { fontSize: 12, kecil: true, color: C.text1, valign: "middle" });
    if (i) s.addShape(pres.shapes.LINE, { x: X, y, w: Wl, h: 0, line: { color: C.accent6, width: 0.5 } });
  });
  kartu(s, M, 5.7, W - 2 * M, 0.95, { isi: C.text2, nama: "integrasi" });
  teks(s, [
    { text: "Terintegrasi  ", options: { bold: true, color: C.accent1 } },
    { text: "Google Calendar bersama terisi otomatis · notifikasi aplikasi dan WhatsApp · undangan siap TTE Srikandi · daftar hadir tersimpan di spreadsheet instansi", options: { color: C.background1 } },
  ], M + 0.3, 5.7, W - 2 * M - 0.6, 0.95, { fontSize: 14, valign: "middle" });
  catat(s, 5);
}

// ══ 6. Unsur kebaruan ══════════════════════════════════════════════
{
  const s = isi("DESKRIPSI  ·  UNSUR KEBARUAN", "Kebaruannya ada pada cara menjaga mutu keputusan");
  const utama = [
    ["a", "Jejak audit di setiap kegiatan", "Siapa, kapan, dan apa keputusannya; 3.331 peristiwa"],
    ["b", "Daftar periksa wajib", "Tombol setuju baru aktif sesudah butir dicentang"],
    ["c", "Pelaksana Harian bermasa berlaku", "Kewenangan padam sendiri pada tanggal akhirnya"],
    ["d", "Pengawasan menurut kegentingan", "Usulan ditandai menurut umur dan dekatnya hari H"],
  ];
  const gw = (W - 2 * M - 0.3) / 2, gh = 1.45;
  utama.forEach(([h, j, k], i) => {
    const x = M + (i % 2) * (gw + 0.3), y = 1.75 + Math.floor(i / 2) * (gh + 0.2);
    kartu(s, x, y, gw, gh, { isi: C.background2, nama: "unsur" + h });
    bulat(s, x + 0.25, y + 0.3, 0.55, C.text2, h, C.accent1);
    teks(s, j, x + 1.05, y + 0.22, gw - 1.3, 0.5, { fontSize: 18, bold: true, color: C.text2, valign: "middle" });
    teks(s, k, x + 1.05, y + 0.75, gw - 1.3, 0.55, { fontSize: 14, color: C.accent5 });
  });
  teks(s, "Unsur kebaruan lainnya", M, 5.15, 6, 0.35, { fontSize: 15, bold: true, color: C.text2 });
  const lain = [["e", "Kanal publik terlacak dengan kode"], ["f", "Kalender bersama terisi otomatis"], ["g", "Undangan siap TTE Srikandi"], ["h", "Data pribadi dilindungi sejak formulir"], ["i", "Setiap pesan WhatsApp dapat diperiksa"]];
  const lw = (W - 2 * M - 4 * 0.15) / 5;
  lain.forEach(([h, t], i) => {
    const x = M + i * (lw + 0.15);
    kartu(s, x, 5.55, lw, 1.1, { isi: "FFFFFF", garis: C.accent6, nama: "lain" + h });
    teks(s, h, x + 0.15, 5.62, 0.3, 0.3, { fontSize: 12, bold: true, color: C.accent1, charSpacing: 1 });
    teks(s, t, x + 0.15, 5.9, lw - 0.3, 0.7, { fontSize: 13, kecil: true, bold: true, color: C.text2 });
  });
  catat(s, 6);
}

// ══ 7. Pelaksanaan ═════════════════════════════════════════════════
bagian("Pelaksanaan");
{
  const s = isi("PELAKSANAAN INOVASI", "Berjalan sejak Maret 2026, dikuatkan Sekretaris Daerah");
  const tahap = [
    ["Jan 2026", "Peristiwa pemicu; telaah alur kerja seluruh Bagian"],
    ["Feb–Mar", "Pembangunan dan uji coba; kegiatan pertama 9 Maret"],
    ["Mei", "Jejak audit mulai merekam; kanal peminjaman ruangan"],
    ["Jul–Agu", "Audiensi terhubung ke agenda; notifikasi; daftar hadir digital"],
    ["Sep", "Pelaksana Harian; daftar periksa wajib; kalender bersama"],
    ["Okt", "Undangan TTE Srikandi; masuk tanpa kata sandi; pemantauan WA; zona waktu"],
  ];
  const X0 = M, Wt = 7.6;
  s.addShape(pres.shapes.LINE, { x: X0 + 0.21, y: 1.95, w: 0, h: 4.4, line: { color: C.accent6, width: 2 } });
  tahap.forEach(([t, k], i) => {
    const y = 1.78 + i * 0.78;
    bulat(s, X0, y, 0.42, i === 0 ? C.accent4 : C.text2, "", C.background1);
    teks(s, t, X0 + 0.6, y - 0.02, 1.35, 0.46, { fontSize: 15, bold: true, color: C.text2, valign: "middle" });
    teks(s, k, X0 + 1.95, y - 0.02, Wt - 1.95, 0.46, { fontSize: 14, color: C.text1, valign: "middle" });
  });
  const X = M + Wt + 0.35, Wb = W - M - X;
  const fakta = [
    ["6 bln 22 hari", "masa implementasi per 1 Oktober 2026; syarat paling singkat 3 bulan"],
    ["Surat Sekda", "Nomor 300.2.10/265/SETDA/2026, 12 Maret 2026"],
    ["Keputusan Sekda", "Nomor 100.3.3.6/98/HK/VIII/2026 tentang Tim Koordinasi"],
    ["11 SOP", "format PermenPAN-RB 35/2012, satu untuk setiap alur"],
    ["140+ pembaruan", "sebagian besar dari kendala yang dilaporkan pengguna"],
  ];
  fakta.forEach(([a, k], i) => {
    const y = 1.75 + i * 0.93;
    kartu(s, X, y, Wb, 0.8, { isi: i === 0 ? C.text2 : C.background2, nama: "fakta" + (i + 1) });
    teks(s, a, X + 0.2, y, 1.7, 0.8, { fontSize: 15, bold: true, color: i === 0 ? C.accent1 : C.text2, valign: "middle" });
    teks(s, k, X + 1.95, y, Wb - 2.1, 0.8, { fontSize: 12, kecil: true, color: i === 0 ? C.background1 : C.text1, valign: "middle" });
  });
  catat(s, 7);
}

// ══ 8. Sumber daya dan kolaborasi ══════════════════════════════════
{
  const s = isi("SUMBER DAYA DAN KOLABORASI", "Dibangun tim sendiri, tanpa belanja pengadaan");
  const baris = [
    ["Pengembangan", "Swakelola oleh Ketua Tim; tidak membebani APBD", "Rp0"],
    ["Peladen", "12 fungsi tanpa server, kuota tanpa biaya", "Rp0"],
    ["Basis data", "Layanan terkelola, paket tanpa biaya", "Rp0"],
    ["Kalender bersama", "Akun layanan atas nama instansi", "Rp0"],
    ["Perangkat", "Telepon pintar pengguna, tanpa toko aplikasi", "Rp0"],
    ["Pesan WhatsApp", "Layanan gerbang pesan", "Langganan"],
  ];
  const Wt = 7.1;
  const kepala = (t, al) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: HEX.dk2 }, align: al } });
  s.addTable([
    [kepala("Komponen"), kepala("Pemanfaatan"), kepala("Biaya", "right")],
    ...baris.map(([a, b, c], i) => [
      { text: a, options: { bold: true, color: C.text2, fill: { color: i % 2 ? "FFFFFF" : HEX.lt2 } } },
      { text: b, options: { color: C.text1, fill: { color: i % 2 ? "FFFFFF" : HEX.lt2 } } },
      { text: c, options: { bold: true, color: c === "Rp0" ? C.accent3 : C.accent5, align: "right", fill: { color: i % 2 ? "FFFFFF" : HEX.lt2 } } },
    ]),
  ], { x: M, y: 1.8, w: Wt, colW: [1.95, 3.85, 1.3], fontSize: 14, fontFace: "Arial", border: { type: "none" }, rowH: 0.56, valign: "middle", margin: [0, 0.12, 0, 0.12] });
  teks(s, "Efisiensi: lalu lintas data sempat 6,4 GB/bulan (kuota 5 GB); pengambilan data diubah hanya untuk data yang berubah, turun ke ±1 GB.", M, 5.95, Wt, 0.7, { fontSize: 13, kecil: true, color: C.text2 });
  const X = M + Wt + 0.4, Wb = W - M - X;
  const mitra = [["5 orang", "Tim inovasi: perancang, penyelia, penguji"], ["42 orang", "Tim Koordinasi, termasuk para Sekretaris Dinas"], ["DKISP", "Memfasilitasi alamat resmi prokopim.tarakankota.go.id"], ["Bappeda Litbang", "Pengampu kebijakan inovasi daerah"]];
  mitra.forEach(([a, k], i) => {
    const y = 1.8 + i * 1.18;
    kartu(s, X, y, Wb, 1.0, { isi: i === 1 ? C.text2 : C.background2, nama: "mitra" + (i + 1) });
    teks(s, a, X + 0.25, y, 1.75, 1.0, { fontSize: 18, bold: true, color: i === 1 ? C.accent1 : C.text2, valign: "middle" });
    teks(s, k, X + 2.05, y, Wb - 2.25, 1.0, { fontSize: 13, kecil: true, color: i === 1 ? C.background1 : C.text1, valign: "middle" });
  });
  catat(s, 8);
}

// ══ 9. Dampak terukur ══════════════════════════════════════════════
bagian("Hasil dan dampak");
{
  const s = isi("HASIL, MANFAAT, DAN BUKTI DAMPAK", "Dari 18–24 jam menjadi 1,94 jam, dan setiap keputusan tercatat");
  const bw = 3.55, by = 1.8, bh = 2.75;
  kartu(s, M, by, bw, bh, { isi: C.background2, nama: "sebelum" });
  teks(s, "SEBELUM", M + 0.3, by + 0.22, bw - 0.6, 0.3, { fontSize: 12, bold: true, color: C.accent5, charSpacing: 2 });
  teks(s, "±18–24 jam", M + 0.3, by + 0.65, bw - 0.6, 0.9, { fontSize: 36, bold: true, color: C.accent5 });
  teks(s, "undangan masuk sampai tercantum di agenda (estimasi alur lama, jalur tercepat)", M + 0.3, by + 1.6, bw - 0.6, 1.0, { fontSize: 13, kecil: true, color: C.accent5 });
  panah(s, M + bw + 0.1, by + bh / 2, M + bw + 0.55, by + bh / 2, C.text2);
  const ax = M + bw + 0.65, aw = 4.0;
  kartu(s, ax, by, aw, bh, { isi: C.text2, nama: "sesudah" });
  teks(s, "SESUDAH", ax + 0.3, by + 0.22, aw - 0.6, 0.3, { fontSize: 12, bold: true, color: C.accent1, charSpacing: 2 });
  teks(s, "1,94 jam", ax + 0.3, by + 0.6, aw - 0.6, 1.0, { fontSize: 50, bold: true, color: C.background1 });
  teks(s, "median pengajuan sampai tayang; 9–12 kali lebih cepat; 99,3% kurang dari 24 jam", ax + 0.3, by + 1.7, aw - 0.6, 0.9, { fontSize: 13, kecil: true, color: C.accent6 });
  const X = ax + aw + 0.4, Wr = W - M - X;
  teks(s, "Yang menopang angka itu", X, by, Wr, 0.35, { fontSize: 15, bold: true, color: C.text2 });
  const bukti = [["8 menit", "keputusan Kabag (median)"], ["47,9%", "telaah di luar jam kerja"], ["3.331", "peristiwa jejak audit"], ["92,5%", "kegiatan ada petugasnya"], ["29", "kegiatan dikembalikan"], ["Rp0", "belanja pengadaan"]];
  bukti.forEach(([a, k], i) => {
    const y = by + 0.45 + i * 0.38;
    teks(s, a, X, y, 1.15, 0.36, { fontSize: 15, bold: true, color: C.text2, valign: "middle" });
    teks(s, k, X + 1.2, y, Wr - 1.2, 0.36, { fontSize: 12, kecil: true, color: C.accent5, valign: "middle" });
  });
  teks(s, "Pertumbuhan penggunaan: kegiatan per bulan, 2026", M, 4.8, 7, 0.35, { fontSize: 15, bold: true, color: C.text2 });
  s.addChart(pres.charts.BAR, [{ name: "Kegiatan", labels: ["Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep"], values: [45, 72, 71, 71, 99, 120, 114] }], {
    x: M, y: 5.12, w: 8.2, h: 1.45, barDir: "col", chartColors: [HEX.accent2], showValue: true, dataLabelFontSize: 11, dataLabelColor: HEX.dk1,
    catAxisLabelFontSize: 11, valAxisHidden: true, valGridLine: { style: "none" }, catAxisLineShow: false, barGapWidthPct: 40,
  });
  kartu(s, M + 8.5, 5.12, W - 2 * M - 8.5, 1.45, { isi: "ECFDF5", garis: C.accent3, tebal: 1.25, nama: "naik" });
  teks(s, [{ text: "+58%", options: { bold: true, fontSize: 24, color: C.accent3, breakLine: true } }, { text: "April (72) ke September (114)", options: { fontSize: 13, color: C.text1 } }], M + 8.75, 5.2, W - 2 * M - 9.0, 1.3, { valign: "middle" });
  teks(s, SUMBER + " Angka \"sebelum\" adalah estimasi dari alur lama.", M, 6.65, W - 2 * M, 0.3, { kecil: true, fontSize: 11, color: C.accent5 });
  catat(s, 9);
}

// ══ 10. Manfaat bagi Pimpinan dan publik ═══════════════════════════
{
  const s = isi("HASIL DAN MANFAAT", "Kepastian bagi Pimpinan, kanal yang terlacak bagi publik");
  s.addImage({ path: A + "hp_walikota.jpg", x: M, y: 1.75, w: 2.3, h: 4.98, shadow: bayang() });
  const X = M + 2.7, Wq = 5.0;
  kartu(s, X, 1.75, Wq, 2.6, { isi: C.text2, nama: "kutipanwk" });
  teks(s, "“Yang terpenting bagi saya adalah kepastian: ke mana saya harus hadir, kapan, dan siapa yang menyiapkannya.”", X + 0.3, 1.98, Wq - 0.6, 1.6, { fontSize: 18, italic: true, color: C.background1 });
  teks(s, "dr. H. Khairul, M.Kes. — Wali Kota Tarakan", X + 0.3, 3.8, Wq - 0.6, 0.4, { fontSize: 13, kecil: true, bold: true, color: C.accent1 });
  const pim = [["67", "kegiatan didisposisikan Wali Kota kepada Wakil Wali Kota dari aplikasi"], ["386", "konfirmasi kehadiran Pimpinan oleh ajudan"], ["67", "tindakan Pelaksana Harian tercatat atas nama pelakunya"]];
  pim.forEach(([a, k], i) => {
    const y = 4.6 + i * 0.72;
    teks(s, a, X, y, 1.0, 0.62, { fontSize: 26, bold: true, color: C.text2, valign: "middle" });
    teks(s, k, X + 1.05, y, Wq - 1.05, 0.62, { fontSize: 13, kecil: true, color: C.text1, valign: "middle" });
  });
  const XA = X + Wq + 0.35, WA = W - M - XA;
  kartu(s, XA, 1.75, WA, 4.98, { isi: C.background2, nama: "publik" });
  teks(s, "LAYANAN PUBLIK", XA + 0.25, 1.95, WA - 0.5, 0.3, { fontSize: 12, bold: true, color: C.accent5, charSpacing: 1 });
  const pub = [["129", "pengajuan ruangan dari 68 instansi; 104 disetujui, 3.153 peserta"], ["59", "permohonan audiensi dari 55 instansi; 31 menjadi agenda Pimpinan"], ["21", "akun di luar Bagian, termasuk mitra DKISP"]];
  pub.forEach(([a, k], i) => {
    const y = 2.4 + i * 1.4;
    teks(s, a, XA + 0.25, y, WA - 0.5, 0.6, { fontSize: 30, bold: true, color: C.text2 });
    teks(s, k, XA + 0.25, y + 0.6, WA - 0.5, 0.7, { fontSize: 13, kecil: true, color: C.text1 });
  });
  catat(s, 10);
}

// ══ 11. Bonus 1: monitoring internal ═══════════════════════════════
bagian("Bonus: monitoring, kinerja, evaluasi");
{
  const s = isi("BONUS DARI SATU DATA  ·  1", "Monitoring internal: setiap pesan dan keputusan terpantau");
  const ih = gambar(s, "monitorwa.jpg", M, 1.7, 5.25, 1960, 1540);
  teks(s, "Monitor WA (data contoh)", M, 1.75 + ih, 5.25, 0.3, { fontSize: 11, kecil: true, italic: true, color: C.accent5 });
  const X = M + 5.6, Wb = W - M - X;
  const fitur = [
    ["Monitor WA", "Meteran hari ini, 7 dan 30 hari; status terkirim, sampai di HP, dibaca; kirim ulang sekaligus", false],
    ["Peringatan dini", "Pejabat diberi tahu bila perangkat gerbang pesan terputus atau 3 pesan berturut-turut gagal", false],
    ["Usulan menurut kegentingan", "Kuning dan merah menurut umur usulan dan dekatnya hari pelaksanaan", false],
    ["Riwayat Alur", "Telusur setiap jadwal: siapa, kapan, apa keputusannya", false],
    ["Ringkasan terjadwal", "06.30 briefing Pimpinan · 07.30 rekap pagi · 16.00 agenda besok", false],
  ];
  fitur.forEach(([j, k, siap], i) => {
    const y = 1.7 + i * 0.98;
    kartu(s, X, y, Wb, 0.86, { isi: C.background2, nama: "pantau" + (i + 1) });
    teks(s, j, X + 0.2, y + 0.08, Wb - 1.4, 0.32, { fontSize: 15, bold: true, color: C.text2 });
    status(s, X + Wb - 1.05, y + 0.1, siap);
    teks(s, k, X + 0.2, y + 0.42, Wb - 0.4, 0.42, { fontSize: 12, kecil: true, color: C.text1 });
  });
  teks(s, "Isi pesan dihapus otomatis sesudah 90 hari · nomor penerima disamarkan", X, 6.6, Wb, 0.3, { fontSize: 11, kecil: true, italic: true, color: C.accent5 });
  catat(s, 11);
}

// ══ 12. Bonus 2: kinerja dan evaluasi ══════════════════════════════
{
  const s = isi("BONUS DARI SATU DATA  ·  2", "Kinerja dan evaluasi: terukur seketika, siap untuk IKU");
  const Wk = 6.0;
  const kiri = [
    ["Evaluasi pasca kegiatan", "Lima butir, berbeda untuk protokol dan dokumentasi; 341 kegiatan (55,3%) sudah dievaluasi petugas", false],
    ["Rekap Evaluasi Kinerja tim", "Nilai terkini 60% · konsistensi 25% · tren 15%; peringkat A–E per tim", false],
    ["Rekap Penugasan Bulanan", "Bukti dukung kinerja pegawai, siap ditempel ke e-Kinerja", false],
    ["Indikator Kinerja Bagian", "Ketepatan waktu layanan komunikasi dihitung otomatis; kepuasan Pimpinan dan standar keprotokolan pada tahap berikutnya", true],
  ];
  kiri.forEach(([j, k, siap], i) => {
    const y = 1.7 + i * 1.2;
    kartu(s, M, y, Wk, 1.06, { isi: siap ? "FBF6E7" : C.background2, garis: siap ? C.accent1 : undefined, tebal: siap ? 1.25 : 0.75, nama: "kinerja" + (i + 1) });
    teks(s, j, M + 0.2, y + 0.1, Wk - 2.2, 0.34, { fontSize: 15, bold: true, color: C.text2 });
    status(s, M + Wk - (siap ? 1.95 : 1.05), y + 0.12, siap);
    teks(s, k, M + 0.2, y + 0.48, Wk - 0.4, 0.56, { fontSize: 12, kecil: true, color: C.text1 });
  });
  teks(s, "IKU ketepatan waktu: naskah sambutan ≤ 24 jam sebelum acara; berita ≤ 24 jam sesudah acara, dicocokkan dengan unggahan Instagram @humas_tarakan.", M, 6.5, Wk, 0.45, { fontSize: 11, kecil: true, italic: true, color: C.accent5 });
  const X = M + Wk + 0.35, Wg = W - M - X;
  const h1 = gambar(s, "iku.jpg", X, 1.7, Wg, 1980, 1280);
  teks(s, "Indikator Kinerja (data contoh)", X, 1.72 + h1, Wg, 0.26, { fontSize: 10, kecil: true, italic: true, color: C.accent5 });
  const y2 = 2.15 + h1;
  kartu(s, X, y2, Wg, 6.85 - y2, { isi: C.text2, nama: "satudata" });
  teks(s, "Dua bonus ini lahir dari data yang sama: tanpa aplikasi tambahan, tanpa biaya.", X + 0.3, y2, Wg - 0.6, 6.85 - y2, { fontSize: 16, bold: true, color: C.background1, valign: "middle" });
  catat(s, 12);
}

// ══ 13. Keselarasan RPJMD dan Kategori A ═══════════════════════════
bagian("Keselarasan");
{
  const s = isi("KESELARASAN DENGAN RPJMD", "Menjawab Misi 4 dan ketujuh unsur Kategori A");
  kartu(s, M, 1.7, W - 2 * M, 1.05, { isi: "FBF6E7", garis: C.accent1, tebal: 1.25, nama: "misi4" });
  teks(s, [
    { text: "Misi 4 RPJMD Kota Tarakan 2025–2029  ", options: { bold: true, color: C.text2, breakLine: true } },
    { text: "Mewujudkan tata kelola pemerintahan yang adaptif, responsif dan menjaga stabilitas ketertiban dan ketentraman kota", options: { color: C.text1 } },
  ], M + 0.3, 1.7, W - 2 * M - 0.6, 1.05, { fontSize: 15, valign: "middle" });
  const unsur = [
    ["Tata kelola", "Kewenangan melekat pada jabatan; Plh bermasa berlaku"],
    ["Proses bisnis", "Tanpa jendela waktu; tanpa cetak ulang"],
    ["Digitalisasi", "Sebelas alur dalam satu superapp"],
    ["Data", "Satu data kegiatan; 617 kegiatan tercatat"],
    ["Manajemen", "Sebaran beban, rekap kinerja, evaluasi"],
    ["Pengawasan", "3.331 peristiwa jejak audit; daftar periksa"],
    ["Efisiensi", "Median 1,94 jam; Rp0 pengadaan"],
  ];
  const kw = (W - 2 * M - 6 * 0.15) / 7;
  unsur.forEach(([j, k], i) => {
    const x = M + i * (kw + 0.15);
    kartu(s, x, 3.0, kw, 1.95, { isi: C.background2, nama: "kategori" + (i + 1) });
    teks(s, j, x + 0.12, 3.12, kw - 0.24, 0.4, { fontSize: 14, bold: true, color: C.text2 });
    teks(s, k, x + 0.12, 3.6, kw - 0.24, 1.3, { fontSize: 12, kecil: true, color: C.text1 });
  });
  teks(s, "Semboyan Tarakan HIBOT dalam rancangan aplikasi", M, 5.2, 8, 0.35, { fontSize: 15, bold: true, color: C.text2 });
  const hibot = [["H", "Handal", "satu sumber data"], ["I", "Inovatif", "jejak audit, daftar periksa"], ["B", "Berbudaya", "tata naskah dinas, naskah tercetak"], ["O", "Unggul/Oenggoel", "99,3% tayang < 24 jam"], ["T", "Tangguh", "Pelaksana Harian; tanpa anggaran"]];
  const hw = (W - 2 * M - 4 * 0.15) / 5;
  hibot.forEach(([h, j, k], i) => {
    const x = M + i * (hw + 0.15);
    bulat(s, x, 5.65, 0.5, C.text2, h, C.accent1);
    teks(s, j, x + 0.6, 5.62, hw - 0.6, 0.32, { fontSize: 14, bold: true, color: C.text2 });
    teks(s, k, x + 0.6, 5.95, hw - 0.6, 0.6, { fontSize: 12, kecil: true, color: C.accent5 });
  });
  catat(s, 13);
}

// ══ 14. Keberlanjutan dan replikasi ════════════════════════════════
bagian("Keberlanjutan dan replikasi");
{
  const s = isi("KEBERLANJUTAN DAN REPLIKASI", "Tidak bergantung anggaran maupun satu orang, siap ditiru");
  const aspek = [["Pembiayaan", "Biaya berjalan mendekati nol"], ["Kelembagaan", "Kewenangan melekat pada jabatan; mutasi tidak memutus alur"], ["Prosedur", "Sebelas SOP disusun untuk disahkan Sekda"], ["Pemeliharaan", "140+ pembaruan dari masukan pengguna"]];
  aspek.forEach(([j, k], i) => {
    const y = 1.75 + i * 1.02;
    kartu(s, M, y, 4.3, 0.88, { isi: C.background2, nama: "lanjut" + (i + 1) });
    teks(s, j, M + 0.2, y, 1.5, 0.88, { fontSize: 15, bold: true, color: C.text2, valign: "middle" });
    teks(s, k, M + 1.75, y, 2.45, 0.88, { fontSize: 12, kecil: true, color: C.text1, valign: "middle" });
  });
  const X = M + 4.65, Wj = 3.6;
  teks(s, "Rencana pengembangan", X, 1.75, Wj, 0.4, { fontSize: 16, bold: true, color: C.text2 });
  const jalan = [["Okt–Des 2026", "Pengesahan SOP oleh Sekretaris Daerah"], ["Jan–Jun 2027", "Pendampingan pengelola kedua; dokumentasi teknis"], ["Jul–Des 2027", "Paket replikasi, dimulai dari Kalimantan Utara"]];
  s.addShape(pres.shapes.LINE, { x: X + 0.21, y: 2.45, w: 0, h: 3.2, line: { color: C.accent6, width: 2 } });
  jalan.forEach(([t, k], i) => {
    const y = 2.3 + i * 1.25;
    bulat(s, X, y, 0.42, i === 0 ? C.accent1 : C.text2, String(i + 1), i === 0 ? C.text2 : C.background1);
    teks(s, t, X + 0.6, y - 0.02, Wj - 0.6, 0.4, { fontSize: 15, bold: true, color: C.text2 });
    teks(s, k, X + 0.6, y + 0.38, Wj - 0.6, 0.75, { fontSize: 13, kecil: true, color: C.text1 });
  });
  const XR = X + Wj + 0.35, WR = W - M - XR;
  kartu(s, XR, 1.75, WR, 4.95, { isi: C.text2, nama: "replikasi" });
  teks(s, "REPLIKASI", XR + 0.25, 1.95, WR - 0.5, 0.3, { fontSize: 12, bold: true, color: C.accent1, charSpacing: 1 });
  teks(s, "Utuh atau per modul", XR + 0.25, 2.3, WR - 0.5, 0.4, { fontSize: 17, bold: true, color: C.background1 });
  teks(s, butir(["Sekretariat DPRD: alur agenda pimpinan dewan", "Perangkat daerah: ruangan, audiensi, daftar hadir", "Pemprov Kaltara dan kabupaten di Kaltara", "Seluruh pemerintah daerah di Indonesia"]), XR + 0.25, 2.8, WR - 0.5, 2.3, { fontSize: 13, kecil: true, color: C.background1, paraSpaceAfter: 6 });
  teks(s, "Syarat: peramban, kuota tanpa biaya, 11 SOP siap diadaptasi, satu pengelola.", XR + 0.25, 5.35, WR - 0.5, 1.2, { fontSize: 13, kecil: true, bold: true, color: C.accent1 });
  catat(s, 14);
}

// ══ 15. Penutup ════════════════════════════════════════════════════
bagian("Penutup");
{
  const s = pres.addSlide({ masterName: "GELAP", sectionTitle: BAGIAN });
  logo(s);
  teks(s, "Satu aplikasi.\nSatu data.\nSetiap keputusan tercatat.", M, 1.85, 8.4, 2.9, { fontSize: 42, bold: true, color: C.background1, paraSpaceAfter: 4 });
  teks(s, "Inovasi Berdampak, Tarakan Maju dan Berdaya Saing", M, 4.95, 8.0, 0.5, { fontSize: 20, color: C.accent1 });
  teks(s, "Terima kasih  ·  Tim Inovasi Prokopim Hibot, Bagian Protokol dan Komunikasi Pimpinan, Setda Kota Tarakan", M, 5.6, 8.2, 0.6, { fontSize: 13, kecil: true, color: C.accent6 });
  kartu(s, 9.3, 1.6, 3.43, 4.35, { isi: "FFFFFF", nama: "qr" });
  s.addImage({ path: A + "qr.png", x: 9.62, y: 1.9, w: 2.8, h: 2.8 });
  teks(s, "prokopim.tarakankota.go.id", 9.45, 4.9, 3.13, 0.4, { fontSize: 14, bold: true, color: C.text2, align: "center" });
  teks(s, "Alamat resmi aplikasi", 9.45, 5.3, 3.13, 0.5, { fontSize: 14, color: C.accent5, align: "center" });
  catat(s, 15);
}

// ══ 16. Cadangan: pembaruan sejak proposal ═════════════════════════
bagian("Cadangan penjelasan");
{
  const s = isi("CADANGAN PENJELASAN  ·  JIKA DITANYA", "Sejak proposal, inovasi ini terus disempurnakan");
  teks(s, "Proposal memuat keadaan per 5 Oktober 2026. Pembaruan berikut berangkat dari pemakaian dan masukan pengguna, dikerjakan tim sendiri tanpa belanja pengadaan.", M, 1.5, W - 2 * M, 0.45, { fontSize: 13, kecil: true, color: C.accent5 });
  const unsur = [
    ["Pengingat dirampingkan", "Dari lima kali sehari menjadi tiga waktu (06.30, 07.30, 16.00) ditambah kabar seketika, agar pesan tidak berulang."],
    ["Monitor WA lengkap", "Status sampai di HP dan dibaca, peringatan dini, serta kirim ulang sekaligus."],
    ["Beranda Pimpinan", "Wali Kota dan Wakil melihat agenda yang perlu dikonfirmasi langsung di halaman pertama."],
    ["Indikator Kinerja", "Menu IKU Bagian Prokopim siap diterapkan; ketepatan waktu layanan komunikasi dihitung otomatis."],
    ["Widget agenda publik", "Agenda Pimpinan hari ini, tanpa lokasi, siap dipasang di www.tarakankota.go.id."],
    ["Buku petunjuk", "Buku petunjuk aplikasi dan panduan pemohon audiensi serta peminjaman ruangan."],
  ];
  const gw = (W - 2 * M - 2 * 0.25) / 3, gh = 1.72, top = 2.1;
  unsur.forEach(([j, k], i) => {
    const x = M + (i % 3) * (gw + 0.25), y = top + Math.floor(i / 3) * (gh + 0.2);
    kartu(s, x, y, gw, gh, { isi: C.background2, nama: "baru" + (i + 1) });
    bulat(s, x + 0.2, y + 0.18, 0.4, C.text2, String(i + 1), C.accent1);
    teks(s, j, x + 0.75, y + 0.18, gw - 0.95, 0.4, { fontSize: 15, bold: true, color: C.text2, valign: "middle" });
    teks(s, k, x + 0.2, y + 0.68, gw - 0.4, gh - 0.75, { fontSize: 12, kecil: true, color: C.text1 });
  });
  kartu(s, M, 5.95, W - 2 * M, 0.85, { isi: C.text2, nama: "belumoptimal" });
  teks(s, [
    { text: "Modul yang belum optimal (proposal 9.7)  ", options: { bold: true, color: C.accent1 } },
    { text: "Baru 3 naskah sambutan disahkan lewat aplikasi, karena Pimpinan lebih nyaman membaca naskah tercetak. Aplikasi menyesuaikan diri dengan cara kerja Pimpinan, bukan sebaliknya.", options: { color: C.background1 } },
  ], M + 0.3, 5.95, W - 2 * M - 0.6, 0.85, { fontSize: 13, kecil: true, valign: "middle" });
  catat(s, 16);
}

(async () => {
  await pres.writeFile({ fileName: KELUAR });
  await applyTheme(KELUAR, THEME);
  console.log("tersimpan", KELUAR);
})();
