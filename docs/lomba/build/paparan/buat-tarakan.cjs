// Paparan finalis Lomba Inovasi Daerah Kota Tarakan 2026 — Prokopim Hibot.
// Wawancara Bappeda Litbang, 9 November 2026: penyajian 15 menit.
//
// Disusun sebagai cerita empat bab (Masalah → Jalan keluar → Hasil → Ke depan),
// berawal dari satu lembar disposisi yang tidak sampai dan ditutup kembali pada
// lembar itu. Setiap slide memuat label unsur penilaian (Juknis Bab 4.4: latar
// belakang, masalah, solusi, implementasi, dampak) dan kalimat jembatan ke slide
// berikutnya. Angka sama persis dengan proposal Tarakan (5 Oktober 2026);
// volume kegiatan disebut mengikuti agenda Pimpinan, yang ditegaskan aplikasi
// mencatat dan memfasilitasinya. Menu Indikator Kinerja ditandai "siap diterapkan".
//
// Huruf: Plus Jakarta Sans, sama dengan aplikasi. Pasang hurufnya di laptop
// presentasi; tanpa itu PowerPoint memakai huruf pengganti.
//
// Membangun:
//   python3 naskah_tarakan.py
//   ASET_PPT=<folder aset> NODE_PATH=<node_modules> APPLY_THEME=<apply_theme.js> \
//     node docs/lomba/build/paparan/buat-tarakan.cjs <keluaran.pptx>
// Folder aset (berdata contoh) dirakit dari aset/ (hibot, tarakan, qr, hp_walikota,
// kabag_riwayat), aset-tarakan/ (monitorwa.jpg, iku.jpg). Foto nyata (foto-*.jpg,
// dari rekaman video) tidak masuk repo; tanpa foto, slide memakai bidang navy.
const pptxgen = require("pptxgenjs");
const fs = require("fs");
const NASKAH = require("./naskah-tarakan.json");
const applyTheme = process.env.APPLY_THEME ? require(process.env.APPLY_THEME).applyTheme : async () => {};
const A = (process.env.ASET_PPT || __dirname + "/aset") + "/";
const KELUAR = process.argv[2] || __dirname + "/Paparan-Prokopim-Hibot-Tarakan-2026.pptx";
const ada = (f) => fs.existsSync(A + f);

const F = "Plus Jakarta Sans", FX = "Plus Jakarta Sans ExtraBold";
const THEME = {
  name: "Prokopim Hibot",
  headFontFace: F,
  bodyFontFace: F,
  colors: {
    dk1: "0F172A", lt1: "FFFFFF", dk2: "0A1628", lt2: "F6F4EE",
    accent1: "C9A84C", accent2: "1E3A6E", accent3: "059669", accent4: "B91C1C",
    accent5: "64748B", accent6: "E2E1DA", hlink: "1E3A6E", folHlink: "1E3A6E",
  },
};
// Warna langsung (heksa) agar tampil sama di PowerPoint, Keynote, dan LibreOffice.
const NAVY = "0A1628", NAVY2 = "14243F", EMAS = "C9A84C", EMAS_TUA = "8A6A12", EMAS_MUDA = "F4ECD6",
  TINTA = "0F172A", ABU = "64748B", GARIS = "E2E1DA", KERTAS = "F6F4EE", PUTIH = "FFFFFF", HIJAU = "059669", MERAH = "B91C1C";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: F, bodyFontFace: F };
pres.title = "Prokopim Hibot — Paparan Finalis Lomba Inovasi Daerah Kota Tarakan 2026";
pres.author = "Tim Inovasi Prokopim Hibot, Setda Kota Tarakan";
pres.company = "Pemerintah Kota Tarakan";

const W = 13.333, H = 7.5, M = 0.65;
const KAKI = "Prokopim Hibot  ·  Lomba Inovasi Daerah Kota Tarakan 2026";
const SUMBER = "Sumber: basis data Prokopim Hibot, 5 Oktober 2026 pukul 15.47 WITA (sama dengan proposal).";
const BAB = ["Masalah", "Jalan keluar", "Hasil", "Ke depan"];

pres.defineSlideMaster({
  title: "TERANG",
  background: { color: KERTAS },
  objects: [{ text: { text: KAKI, options: { x: M, y: 7.04, w: 8, h: 0.26, fontFace: F, fontSize: 9, color: ABU, margin: 0 } } }],
  slideNumber: { x: W - M - 0.5, y: 7.04, w: 0.5, h: 0.26, fontFace: F, fontSize: 9, color: ABU, align: "right" },
});
pres.defineSlideMaster({ title: "GELAP", background: { color: NAVY }, objects: [] });

// ── Pembantu ───────────────────────────────────────────────────────
// Batas bawah 14 pt agar terbaca di proyektor; label kapital (charSpacing)
// dan catatan kecil (kecil: true) boleh lebih kecil.
const teks = (s, t, x, y, w, h, o = {}) => {
  const { kecil, ...opsi } = o;
  const ukuran = opsi.fontSize ?? 14;
  return s.addText(t, { x, y, w, h, isTextBox: true, margin: 0, fontFace: F, color: TINTA, valign: "top", ...opsi,
    fontSize: kecil || opsi.charSpacing ? ukuran : Math.max(14, ukuran) });
};
const kotak = (s, x, y, w, h, isi, o = {}) =>
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: o.r ?? 0.08, fill: { color: isi }, line: { color: o.garis || isi, width: o.tebal || 0.75 }, objectName: o.nama });
const garis = (s, x, y, w, warna = GARIS, tebal = 0.75) => s.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color: warna, width: tebal } });
const panah = (s, x1, y1, x2, y2, warna = ABU) =>
  s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1, line: { color: warna, width: 1.5, endArrowType: "triangle" } });
const nomor = (s, x, y, d, isi, label, warna, garisTepi) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: isi }, line: { color: garisTepi || isi, width: 1 } });
  s.addText(label, { x, y, w: d, h: d, isTextBox: true, margin: 0, align: "center", valign: "middle", fontFace: F, fontSize: Math.round(d * 28), bold: true, color: warna });
};
// Foto dipotong memenuhi bingkai; pelapis navy (persen tembus) agar teks terbaca.
const foto = (s, f, x, y, w, h, tembus) => {
  if (!ada(f)) { s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: NAVY2 }, line: { color: NAVY2 } }); return; }
  s.addImage({ path: A + f, x, y, w, h, sizing: { type: "cover", w, h } });
  if (tembus != null) s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: NAVY, transparency: tembus }, line: { color: NAVY, transparency: 100 } });
};
const gambar = (s, f, x, y, w, px, py) => {
  const h = w * py / px;
  s.addImage({ path: A + f, x, y, w, h });
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { type: "none" }, line: { color: GARIS, width: 0.75 } });
  return h;
};
const status = (s, x, y, siap) => {
  const t = siap ? "SIAP DITERAPKAN" : "AKTIF", w = siap ? 1.6 : 0.78;
  kotak(s, x, y, w, 0.26, siap ? EMAS_MUDA : "E3F2EA", { r: 0.13, garis: siap ? EMAS : "B7DFC9" });
  s.addText(t, { x, y, w, h: 0.26, isTextBox: true, margin: 0, align: "center", valign: "middle", fontFace: F, fontSize: 9, bold: true, charSpacing: 1.5, color: siap ? EMAS_TUA : HIJAU });
};
// Penanda bab (01–04) di kiri atas dan unsur penilaian di kanan atas.
const kepala = (s, bab, unsur, gelap = false, x0 = M) => {
  teks(s, String(bab).padStart(2, "0") + "  " + BAB[bab - 1].toUpperCase(), x0, 0.42, 2.4, 0.3, { fontSize: 11, bold: true, charSpacing: 2.5, color: gelap ? EMAS : EMAS_TUA });
  BAB.forEach((_, i) => s.addShape(pres.shapes.RECTANGLE, { x: x0 + 2.45 + i * 0.4, y: 0.555, w: 0.32, h: 0.05, fill: { color: i + 1 === bab ? EMAS : gelap ? "2A3B57" : GARIS }, line: { type: "none" } }));
  if (unsur) teks(s, unsur, W - M - 5.2, 0.42, 5.2, 0.3, { fontSize: 10, charSpacing: 1.5, color: gelap ? "A7B1C2" : ABU, align: "right" });
};
const judul = (s, t, gelap = false, w = W - 2 * M, x = M) => teks(s, t, x, 0.85, w, 0.95, { fontFace: FX, fontSize: 30, color: gelap ? PUTIH : NAVY });
// Kalimat jembatan: penghubung cerita ke slide berikutnya.
const jembatan = (s, t, gelap = false) => {
  garis(s, W - M - 4.7, 6.64, 0.35, EMAS, 1.5);
  teks(s, t, W - M - 4.25, 6.5, 4.25, 0.3, { fontSize: 13, kecil: true, italic: true, bold: true, color: gelap ? EMAS : EMAS_TUA, valign: "middle" });
};
const slide = (gelap = false) => pres.addSlide({ masterName: gelap ? "GELAP" : "TERANG" });
const catat = (s, n) => s.addNotes(NASKAH[String(n)]);
const logo = (s, x, y) => {
  kotak(s, x, y, 1.6, 0.74, PUTIH, { r: 0.12 });
  s.addImage({ path: A + "tarakan.png", x: x + 0.14, y: y + 0.07, w: 0.6, h: 0.6 });
  s.addImage({ path: A + "hibot.png", x: x + 0.86, y: y + 0.07, w: 0.6, h: 0.6 });
};

// ══ 1. Sampul ══════════════════════════════════════════════════════
{
  const s = slide(true);
  foto(s, "foto-hp.jpg", 6.9, 0, W - 6.9, H, 30);
  logo(s, M, 0.6);
  teks(s, "LOMBA INOVASI DAERAH KOTA TARAKAN 2026", M, 1.95, 6, 0.3, { fontSize: 11, bold: true, charSpacing: 2.5, color: EMAS });
  teks(s, "Prokopim Hibot", M, 2.35, 6.2, 1.0, { fontFace: FX, fontSize: 50, color: PUTIH });
  teks(s, "Superapp Pelayanan Keprotokolan dan Komunikasi Pimpinan Pemerintah Kota Tarakan", M, 3.4, 5.6, 0.95, { fontSize: 19, color: "D9DEE7" });
  garis(s, M, 4.6, 0.6, EMAS, 2.5);
  teks(s, "Kategori A  ·  Inovasi Tata Kelola Pemerintahan", M, 4.8, 6, 0.35, { fontSize: 15, bold: true, color: PUTIH });
  teks(s, "Bagian Protokol dan Komunikasi Pimpinan, Sekretariat Daerah Kota Tarakan", M, 5.2, 5.9, 0.35, { fontSize: 13, kecil: true, color: "A7B1C2" });
  teks(s, [
    { text: "TIM INOVASI   ", options: { bold: true, color: EMAS, charSpacing: 1.5, fontSize: 10 } },
    { text: "Anugrah Yega Pranatha, M.Si. (Ketua) · Saifullah, S.H. · Juliyanti, S.AP. · Pebriadi Banne, S.IP. · Nuraini Wiliadewi, S.IP.", options: { color: "D9DEE7", fontSize: 11 } },
  ], M, 6.1, 5.9, 0.7, { kecil: true, fontSize: 11 });
  teks(s, "Presentasi dan Wawancara Finalis  ·  Bappeda Litbang  ·  9 November 2026", 7.3, 6.85, W - 7.3 - M, 0.3, { fontSize: 10, kecil: true, color: PUTIH, align: "right" });
  catat(s, 1);
}

// ══ BAB 1 · MASALAH ════════════════════════════════════════════════
// 2. Pembuka cerita: lembar yang tidak sampai
{
  const s = slide(true);
  foto(s, "foto-berkas.jpg", 0, 0, W, H, 22);
  kepala(s, 1, "LATAR BELAKANG  ·  PERISTIWA PEMICU", true);
  teks(s, "Januari 2026.", M, 2.0, 8, 0.6, { fontSize: 20, bold: true, color: EMAS });
  teks(s, "Satu lembar disposisi agenda tidak ikut terfoto.", M, 2.6, 8.6, 1.9, { fontFace: FX, fontSize: 40, color: PUTIH });
  teks(s, "Berkas diteruskan sebagai foto di grup percakapan. Lembar itu tidak sampai ke meja kami — dan tidak ada yang dapat mengetahuinya.", M, 4.55, 7.2, 1.0, { fontSize: 17, color: "E5E9F0" });
  teks(s, "Tidak ada yang lalai. Rantainya yang rapuh.", M, 5.65, 7, 0.45, { fontSize: 17, bold: true, italic: true, color: EMAS });
  jembatan(s, "Bagaimana hal itu bisa terjadi?", true);
  catat(s, 2);
}
// 3. Agenda padat, cara kerja manual
{
  const s = slide();
  kepala(s, 1, "LATAR BELAKANG  ·  DATA DASAR DAN KONDISI AWAL");
  judul(s, "Agenda Pimpinan yang padat, dikerjakan secara manual");
  const angka = [["617", "kegiatan Wali Kota dan Wakil Wali Kota tercatat, Maret–5 Oktober 2026"], ["91", "kegiatan per bulan rata-rata; puncak 120 pada Agustus"], ["294", "kegiatan sambutan yang memerlukan naskah"]];
  angka.forEach(([a, k], i) => {
    const y = 2.0 + i * 1.25;
    teks(s, a, M, y, 1.9, 0.9, { fontFace: FX, fontSize: 44, color: i === 0 ? EMAS_TUA : NAVY, valign: "middle" });
    teks(s, k, M + 1.95, y + 0.1, 2.5, 0.8, { fontSize: 13, kecil: true, color: ABU, valign: "middle" });
    if (i < 2) garis(s, M, y + 1.08, 4.4);
  });
  teks(s, "Volume ini mengikuti agenda Pimpinan. Yang berubah: kini setiap kegiatan tercatat.", M, 5.75, 4.4, 0.6, { fontSize: 12, kecil: true, italic: true, color: EMAS_TUA });
  const X = 5.55, Wt = W - M - X;
  kotak(s, X, 1.95, Wt, 4.3, PUTIH, { garis: GARIS });
  teks(s, "CARA KERJA SEBELUM MARET 2026", X + 0.35, 2.15, Wt - 0.7, 0.3, { fontSize: 10, bold: true, charSpacing: 2, color: ABU });
  const baris = [
    ["Rencana kegiatan", "Disusun di spreadsheet, dicetak, diperiksa berjenjang"],
    ["Penelaahan", "±30 menit menjelang jam pulang, hanya hari kerja"],
    ["Kegiatan mendesak", "Rencana kegiatan dicetak ulang"],
    ["Disposisi", "Diteruskan sebagai foto di grup percakapan"],
    ["Penugasan petugas", "Bergantung pada ingatan perorangan"],
    ["Ruangan dan audiensi", "Papan tulis; pemohon datang atau menelepon"],
  ];
  baris.forEach(([a, b], i) => {
    const y = 2.55 + i * 0.6;
    if (i) garis(s, X + 0.35, y, Wt - 0.7);
    teks(s, a, X + 0.35, y, 2.3, 0.58, { fontSize: 14, bold: true, color: NAVY, valign: "middle" });
    teks(s, b, X + 2.7, y, Wt - 3.05, 0.58, { fontSize: 14, color: TINTA, valign: "middle" });
  });
  teks(s, SUMBER, M, 6.5, 6.5, 0.3, { kecil: true, fontSize: 9, color: ABU });
  jembatan(s, "Masalahnya bukan pada orang, tetapi rantainya.");
  catat(s, 3);
}
// 4. Akar masalah
{
  const s = slide();
  kepala(s, 1, "MASALAH  ·  ANALISIS AKAR MASALAH");
  judul(s, "Akarnya satu: tidak ada satu sumber data yang sahih");
  kotak(s, M, 2.55, 3.55, 2.4, NAVY);
  teks(s, "AKAR MASALAH", M + 0.35, 2.8, 3, 0.3, { fontSize: 10, bold: true, charSpacing: 2, color: EMAS });
  teks(s, "Tidak tersedia satu sumber data yang sahih dan dapat dirujuk semua pihak", M + 0.35, 3.2, 2.9, 1.6, { fontSize: 18, bold: true, color: PUTIH });
  const cabang = ["Penelaahan terikat jendela waktu", "Keputusan tidak meninggalkan jejak", "Versi dokumen beredar ganda", "Pengetahuan kerja melekat pada orang", "Layanan publik tanpa kanal yang dapat ditelusuri"];
  const X = 5.0;
  cabang.forEach((c, i) => {
    const y = 1.95 + i * 0.84;
    panah(s, M + 3.55, 3.75, X - 0.08, y + 0.3, "B9B8B0");
    nomor(s, X, y + 0.08, 0.44, KERTAS, String.fromCharCode(97 + i), EMAS_TUA, EMAS);
    teks(s, c, X + 0.6, y, 3.9, 0.6, { fontSize: 15, color: TINTA, valign: "middle" });
  });
  const XP = 9.75, WP = W - M - XP;
  garis(s, XP, 2.05, 0.5, EMAS, 2.5);
  teks(s, "Persoalannya tersebar di kertas, spreadsheet, grup percakapan, papan tulis, dan telepon.", XP, 2.25, WP, 1.3, { fontSize: 15, color: ABU });
  teks(s, "Memperbaiki satu saluran tidak menyelesaikan yang lain. Jawabannya harus satu wadah dengan satu data: superapp.", XP, 3.6, WP, 2.0, { fontSize: 17, bold: true, color: NAVY });
  jembatan(s, "Lalu, pilihan apa yang kami punya?");
  catat(s, 4);
}

// ══ BAB 2 · JALAN KELUAR ═══════════════════════════════════════════
// 5. Pemilihan ide
{
  const s = slide();
  kepala(s, 2, "SOLUSI  ·  PENJARINGAN DAN PEMILIHAN IDE");
  judul(s, "Dari empat pilihan, kami memilih membangun sendiri");
  teks(s, "Ide dijaring dari pekerjaan sehari-hari, bukan survei: banyaknya pintu masuk agenda, peristiwa Januari, dan telaah bersama seluruh Bagian.", M, 1.72, 11.5, 0.6, { fontSize: 14, color: ABU });
  const pilihan = [
    ["Menambah pengawasan dan pengingat manual", "Tidak menyentuh akar masalah; peristiwa Januari terjadi saat semua sudah bekerja benar"],
    ["Memperbaiki spreadsheet bersama", "Tetap banyak versi dan tidak mencatat jejak keputusan"],
    ["Mengadakan aplikasi jadi", "Butuh anggaran dan pengadaan; alur keprotokolan sangat khas"],
    ["Membangun sendiri: satu data dan jejak audit", "Menyelesaikan akar masalah, sesuai alur nyata, tanpa anggaran pengadaan"],
  ];
  const lw = (W - 2 * M - 3 * 0.25) / 4;
  pilihan.forEach(([j, k], i) => {
    const x = M + i * (lw + 0.25), pilih = i === 3, y = 2.55;
    kotak(s, x, y, lw, 3.6, pilih ? NAVY : PUTIH, { garis: pilih ? NAVY : GARIS });
    teks(s, pilih ? "DIPILIH" : "PILIHAN " + (i + 1), x + 0.3, y + 0.3, lw - 0.6, 0.3, { fontSize: 10, bold: true, charSpacing: 2, color: pilih ? EMAS : ABU });
    teks(s, j, x + 0.3, y + 0.7, lw - 0.6, 1.25, { fontSize: 17, bold: true, color: pilih ? PUTIH : NAVY });
    garis(s, x + 0.3, y + 2.05, 0.4, pilih ? EMAS : GARIS, 2);
    teks(s, k, x + 0.3, y + 2.2, lw - 0.6, 1.25, { fontSize: 13, kecil: true, color: pilih ? "D9DEE7" : ABU });
  });
  jembatan(s, "Mari ikuti satu undangan.");
  catat(s, 5);
}
// 6. Perjalanan satu undangan
{
  const s = slide();
  kepala(s, 2, "SOLUSI  ·  CARA KERJA");
  judul(s, "Mari ikuti satu undangan, dari meja admin sampai HP Wali Kota", false, 8.6);
  const langkah = [
    ["Admin Rencana Kegiatan", "Memindai undangan; formulir terisi, benturan jadwal diperiksa", ""],
    ["Kasubbag Protokol", "Menelaah dari ponsel, di mana pun", "1 jam 17 menit"],
    ["Kepala Bagian", "Memutus; tombol setuju aktif sesudah daftar periksa", "8 menit"],
    ["HP Wali Kota", "Agenda tiba; hadir atau disposisi ke Wakil", "tayang"],
    ["Petugas", "Ditugaskan dan langsung dikabari WhatsApp", ""],
  ];
  const X0 = M, Wl = 8.4, y0 = 2.05, dy = 0.74;
  s.addShape(pres.shapes.LINE, { x: X0 + 0.23, y: y0 + 0.25, w: 0, h: dy * 4, line: { color: EMAS, width: 2 } });
  langkah.forEach(([j, k, w], i) => {
    const y = y0 + i * dy;
    nomor(s, X0, y, 0.46, i === 3 ? EMAS : NAVY, String(i + 1), i === 3 ? NAVY : PUTIH);
    teks(s, j, X0 + 0.7, y - 0.04, 2.8, 0.55, { fontSize: 15, bold: true, color: NAVY, valign: "middle" });
    teks(s, k, X0 + 3.5, y - 0.04, Wl - 3.5 - 1.45, 0.55, { fontSize: 13, kecil: true, color: TINTA, valign: "middle" });
    if (w) teks(s, w, X0 + Wl - 1.4, y - 0.04, 1.4, 0.55, { fontSize: 12, kecil: true, bold: true, color: EMAS_TUA, align: "right", valign: "middle" });
  });
  teks(s, "Waktu tunggu: median pada jenjang tersebut.", M, 6.25, 5, 0.25, { fontSize: 10, kecil: true, italic: true, color: ABU });
  kotak(s, M, 5.65, Wl, 0.5, NAVY, { r: 0.06 });
  teks(s, [{ text: "Median pengajuan sampai tayang   ", options: { color: "D9DEE7" } }, { text: "1,94 jam", options: { bold: true, color: EMAS } }], M + 0.3, 5.65, Wl - 0.6, 0.5, { fontSize: 15, valign: "middle" });
  s.addImage({ path: A + "hp_walikota.jpg", x: 9.9, y: 1.0, w: 2.4, h: 5.2 });
  jembatan(s, "Satu undangan menyentuh banyak urusan.");
  catat(s, 6);
}
// 7. Sebelas alur, satu data
{
  const s = slide();
  kepala(s, 2, "SOLUSI  ·  CAKUPAN SUPERAPP");
  judul(s, "Satu undangan, sebelas urusan, satu data");
  const alur = ["Penetapan jadwal", "Perubahan jadwal", "Penarikan dan pembatalan", "Penugasan petugas", "Audiensi dan tamu", "Peminjaman ruangan",
    "Daftar hadir digital", "Naskah sambutan", "Peliputan dan publikasi", "Penerbitan undangan", "Evaluasi kinerja"];
  const gw = 2.4, gh = 0.62, g = 0.14;
  alur.forEach((t, i) => {
    const x = M + (i % 3) * (gw + g), y = 1.95 + Math.floor(i / 3) * (gh + g);
    kotak(s, x, y, gw, gh, PUTIH, { garis: GARIS });
    teks(s, String(i + 1).padStart(2, "0"), x + 0.2, y, 0.45, gh, { fontSize: 11, kecil: true, bold: true, color: EMAS_TUA, valign: "middle" });
    teks(s, t, x + 0.62, y, gw - 0.75, gh, { fontSize: 14, bold: true, color: NAVY, valign: "middle" });
  });
  teks(s, "Dasar tugas setiap alur: Peraturan Wali Kota Tarakan Nomor 50 Tahun 2021.", M, 5.05, 7.6, 0.3, { fontSize: 11, kecil: true, italic: true, color: ABU });
  const X = M + 3 * (gw + g) + 0.35, Wl = W - M - X;
  teks(s, "SETIAP PERAN, DATA YANG SAMA", X, 1.95, Wl, 0.3, { fontSize: 10, bold: true, charSpacing: 2, color: ABU });
  const lapis = [["Pimpinan Daerah", "agenda pasti, disposisi langsung"], ["Ajudan dan pengawal", "pemberitahuan dini, konfirmasi hadir"], ["Pejabat struktural", "persetujuan, Plh, sebaran beban"], ["Petugas", "penugasan, daftar hadir, evaluasi"], ["Masyarakat dan instansi", "audiensi dan ruangan dengan kode"]];
  lapis.forEach(([j, k], i) => {
    const y = 2.35 + i * 0.58;
    teks(s, j, X, y, 2.0, 0.55, { fontSize: 13, kecil: true, bold: true, color: NAVY, valign: "middle" });
    teks(s, k, X + 2.05, y, Wl - 2.05, 0.55, { fontSize: 13, kecil: true, color: ABU, valign: "middle" });
    garis(s, X, y + 0.56, Wl);
  });
  kotak(s, M, 5.5, W - 2 * M, 0.75, NAVY, { r: 0.06 });
  teks(s, [{ text: "Tersambung   ", options: { bold: true, color: EMAS } }, { text: "Google Calendar bersama · notifikasi aplikasi dan WhatsApp · undangan siap TTE Srikandi · daftar hadir di spreadsheet instansi", options: { color: PUTIH } }], M + 0.3, 5.5, W - 2 * M - 0.6, 0.75, { fontSize: 14, valign: "middle" });
  jembatan(s, "Yang membuatnya berbeda: jejaknya.");
  catat(s, 7);
}
// 8. Kebaruan: setiap langkah meninggalkan jejak
{
  const s = slide();
  kepala(s, 2, "SOLUSI  ·  UNSUR KEBARUAN");
  judul(s, "Setiap langkah meninggalkan jejak");
  const utama = [["a", "Jejak audit di setiap kegiatan", "Siapa, kapan, apa keputusannya: 3.331 peristiwa"], ["b", "Daftar periksa wajib", "Tombol setuju aktif sesudah butir dicentang"],
    ["c", "Pelaksana Harian bermasa berlaku", "Kewenangan padam sendiri pada tanggal akhirnya"], ["d", "Pengawasan menurut kegentingan", "Usulan ditandai menurut umur dan dekatnya hari H"]];
  utama.forEach(([h, j, k], i) => {
    const y = 1.95 + i * 0.95;
    nomor(s, M, y + 0.05, 0.5, NAVY, h, EMAS);
    teks(s, j, M + 0.75, y - 0.02, 5.7, 0.42, { fontSize: 18, bold: true, color: NAVY });
    teks(s, k, M + 0.75, y + 0.42, 5.7, 0.4, { fontSize: 14, color: ABU });
  });
  teks(s, "DAN JUGA", M, 5.82, 2, 0.28, { fontSize: 10, bold: true, charSpacing: 2, color: ABU });
  teks(s, butirLain(), M, 6.1, 6.4, 0.6, { fontSize: 11, kecil: true, color: NAVY });
  const X = 7.4, Wg = W - M - X;
  const h = gambar(s, "kabag_riwayat.jpg", X, 1.95, Wg, 1280, 1060);
  teks(s, "Riwayat Alur satu kegiatan (data contoh)", X, 1.98 + h, Wg, 0.26, { fontSize: 9, kecil: true, italic: true, color: ABU });
  catat(s, 8);
}
function butirLain() {
  return ["e  kanal publik terlacak dengan kode", "f  kalender bersama terisi otomatis", "g  undangan siap TTE Srikandi", "h  data pribadi dilindungi sejak formulir", "i  setiap pesan WhatsApp dapat diperiksa"].join("   ·   ");
}
// 9. Pelaksanaan
{
  const s = slide();
  kepala(s, 2, "IMPLEMENTASI  ·  TAHAPAN DAN PELEMBAGAAN");
  judul(s, "Berjalan sejak Maret 2026, dikuatkan Sekretaris Daerah");
  const tahap = [["Jan 2026", "Peristiwa pemicu; telaah alur kerja seluruh Bagian"], ["Feb–Mar", "Dibangun dan diuji; kegiatan pertama 9 Maret"], ["Mei", "Jejak audit mulai merekam; kanal ruangan dibuka"],
    ["Jul–Agu", "Audiensi terhubung ke agenda; daftar hadir digital"], ["Sep", "Pelaksana Harian; daftar periksa wajib; kalender bersama"], ["Okt", "Undangan TTE; masuk tanpa kata sandi; zona waktu"]];
  s.addShape(pres.shapes.LINE, { x: M + 0.14, y: 2.1, w: 0, h: 3.95, line: { color: GARIS, width: 2 } });
  tahap.forEach(([t, k], i) => {
    const y = 1.98 + i * 0.79;
    s.addShape(pres.shapes.OVAL, { x: M + 0.03, y: y + 0.09, w: 0.22, h: 0.22, fill: { color: i === 0 ? MERAH : EMAS }, line: { color: KERTAS, width: 2 } });
    teks(s, t, M + 0.5, y, 1.25, 0.4, { fontSize: 15, bold: true, color: NAVY, valign: "middle" });
    teks(s, k, M + 1.8, y, 5.3, 0.4, { fontSize: 14, color: TINTA, valign: "middle" });
  });
  const X = 8.0, Wb = W - M - X;
  kotak(s, X, 1.95, Wb, 1.25, NAVY);
  teks(s, "6 bulan 22 hari", X + 0.3, 2.07, Wb - 0.6, 0.6, { fontFace: FX, fontSize: 28, color: EMAS });
  teks(s, "masa implementasi per 1 Oktober 2026; syarat paling singkat 3 bulan", X + 0.3, 2.65, Wb - 0.6, 0.5, { fontSize: 12, kecil: true, color: "D9DEE7" });
  const fakta = [["Surat Sekda", "Nomor 300.2.10/265/SETDA/2026, 12 Maret 2026"], ["Keputusan Sekda", "Nomor 100.3.3.6/98/HK/VIII/2026, Tim Koordinasi"], ["11 SOP", "Format PermenPAN-RB 35/2012, satu tiap alur"], ["140+ pembaruan", "Sebagian besar dari kendala pengguna"]];
  fakta.forEach(([a, k], i) => {
    const y = 3.4 + i * 0.68;
    teks(s, a, X, y, 1.85, 0.6, { fontSize: 14, bold: true, color: NAVY, valign: "middle" });
    teks(s, k, X + 1.9, y, Wb - 1.9, 0.6, { fontSize: 12, kecil: true, color: ABU, valign: "middle" });
    garis(s, X, y + 0.64, Wb);
  });
  jembatan(s, "Semuanya tanpa belanja pengadaan.");
  catat(s, 9);
}
// 10. Sumber daya dan kolaborasi
{
  const s = slide();
  foto(s, "foto-meja.jpg", 7.95, 1.95, W - M - 7.95, 2.05, null);
  kepala(s, 2, "IMPLEMENTASI  ·  SUMBER DAYA", false);
  judul(s, "Dibangun tim sendiri, tanpa belanja pengadaan", false, 7.0);
  const baris = [["Pengembangan", "Swakelola Ketua Tim; tidak membebani APBD", "Rp0"], ["Peladen", "12 fungsi tanpa server, kuota tanpa biaya", "Rp0"], ["Basis data", "Layanan terkelola, paket tanpa biaya", "Rp0"],
    ["Kalender bersama", "Akun layanan atas nama instansi", "Rp0"], ["Perangkat", "Telepon pintar pengguna", "Rp0"], ["Pesan WhatsApp", "Layanan gerbang pesan", "Langganan"]];
  baris.forEach(([a, b, c], i) => {
    const y = 2.0 + i * 0.6;
    teks(s, a, M, y, 1.95, 0.55, { fontSize: 14, bold: true, color: NAVY, valign: "middle" });
    teks(s, b, M + 2.0, y, 3.9, 0.55, { fontSize: 13, kecil: true, color: TINTA, valign: "middle" });
    teks(s, c, M + 5.9, y, 1.1, 0.55, { fontSize: 14, bold: true, color: c === "Rp0" ? HIJAU : ABU, align: "right", valign: "middle" });
    garis(s, M, y + 0.58, 7.0);
  });
  teks(s, "Efisiensi: lalu lintas data sempat 6,4 GB/bulan (kuota 5 GB); pengambilan data diubah hanya untuk yang berubah, turun ke ±1 GB.", M, 5.7, 7.0, 0.6, { fontSize: 12, kecil: true, italic: true, color: ABU });
  const X = 7.95, Wb = W - M - X;
  teks(s, "KOLABORASI", X, 4.25, 3, 0.28, { fontSize: 10, bold: true, charSpacing: 2, color: ABU });
  const mitra = [["5 + 42", "tim inovasi dan Tim Koordinasi, termasuk para Sekretaris Dinas"], ["DKISP", "memfasilitasi alamat resmi prokopim.tarakankota.go.id"], ["Bappeda Litbang", "pengampu kebijakan inovasi daerah"]];
  mitra.forEach(([a, k], i) => {
    const y = 4.5 + i * 0.62;
    teks(s, a, X, y, 1.9, 0.58, { fontSize: 15, bold: true, color: NAVY, valign: "middle" });
    teks(s, k, X + 1.95, y, Wb - 1.95, 0.58, { fontSize: 12, kecil: true, color: ABU, valign: "middle" });
  });
  jembatan(s, "Lalu, apa hasilnya?");
  catat(s, 10);
}

// ══ BAB 3 · HASIL ══════════════════════════════════════════════════
// 11. Dampak terukur
{
  const s = slide();
  kepala(s, 3, "DAMPAK  ·  BUKTI TERUKUR DARI BASIS DATA");
  judul(s, "Dari hitungan hari menjadi hitungan jam");
  teks(s, "SEBELUM", M, 2.0, 3, 0.3, { fontSize: 10, bold: true, charSpacing: 2, color: ABU });
  teks(s, "±18–24 jam", M, 2.3, 3.6, 0.85, { fontFace: FX, fontSize: 38, color: "9AA3B2" });
  teks(s, "undangan masuk sampai tercantum di agenda (estimasi alur lama)", M, 3.15, 3.4, 0.6, { fontSize: 12, kecil: true, color: ABU });
  panah(s, M + 3.7, 2.75, M + 4.25, 2.75, NAVY);
  const ax = M + 4.45;
  teks(s, "SESUDAH", ax, 2.0, 3, 0.3, { fontSize: 10, bold: true, charSpacing: 2, color: EMAS_TUA });
  teks(s, "1,94 jam", ax, 2.25, 4.2, 1.0, { fontFace: FX, fontSize: 54, color: NAVY });
  teks(s, "median pengajuan sampai tayang · 9–12 kali lebih cepat · 99,3% kurang dari 24 jam", ax, 3.2, 4.0, 0.6, { fontSize: 12, kecil: true, color: TINTA });
  const X = 9.45, Wr = W - M - X;
  const bukti = [["8 menit", "keputusan Kabag (median)"], ["47,9%", "telaah di luar jam kerja"], ["3.331", "peristiwa jejak audit"], ["92,5%", "kegiatan ada petugasnya"], ["29", "kegiatan dikembalikan"], ["Rp0", "belanja pengadaan"]];
  bukti.forEach(([a, k], i) => {
    const y = 1.95 + i * 0.37;
    teks(s, a, X, y, 1.2, 0.36, { fontSize: 15, bold: true, color: NAVY, valign: "middle" });
    teks(s, k, X + 1.2, y, Wr - 1.2, 0.36, { fontSize: 11, kecil: true, color: ABU, valign: "middle" });
  });
  garis(s, M, 4.3, W - 2 * M);
  teks(s, "VOLUME KEGIATAN PIMPINAN YANG TERCATAT DAN DIFASILITASI, PER BULAN 2026", M, 4.45, 8.5, 0.3, { fontSize: 10, bold: true, charSpacing: 1.5, color: ABU });
  s.addChart(pres.charts.BAR, [{ name: "Kegiatan", labels: ["Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep"], values: [45, 72, 71, 71, 99, 120, 114] }], {
    x: M - 0.1, y: 4.7, w: 8.4, h: 1.7, barDir: "col", chartColors: [NAVY], showValue: true, dataLabelFontSize: 11, dataLabelFontFace: F, dataLabelColor: TINTA,
    catAxisLabelFontSize: 11, catAxisLabelFontFace: F, catAxisLabelColor: ABU, valAxisHidden: true, valGridLine: { style: "none" }, catAxisLineShow: false, barGapWidthPct: 45,
  });
  teks(s, [{ text: "617 kegiatan", options: { bold: true, fontSize: 20, color: NAVY, breakLine: true } }, { text: "rata-rata 91 per bulan. Volume mengikuti agenda Pimpinan; aplikasi mencatat dan memfasilitasinya.", options: { fontSize: 12, color: ABU } }], 9.3, 4.75, W - M - 9.3, 1.5, { kecil: true, valign: "middle" });
  teks(s, SUMBER + " Angka \"sebelum\" adalah estimasi dari alur lama.", M, 6.5, 7.1, 0.3, { kecil: true, fontSize: 9, color: ABU });
  jembatan(s, "Bagi Pimpinan, artinya kepastian.");
  catat(s, 11);
}
// 12. Kepastian bagi Pimpinan, kanal bagi publik
{
  const s = slide();
  foto(s, "foto-walikota.jpg", 0, 0, 5.2, H, null);
  const X = 5.75, Wq = W - M - X;
  kepala(s, 3, "MANFAAT  ·  PIMPINAN DAN PUBLIK", false, X);
  teks(s, "“Yang terpenting bagi saya adalah kepastian: ke mana saya harus hadir, kapan, dan siapa yang menyiapkannya.”", X, 1.0, Wq, 1.9, { fontSize: 22, bold: true, italic: true, color: NAVY });
  teks(s, "dr. H. Khairul, M.Kes. — Wali Kota Tarakan", X, 2.95, Wq, 0.35, { fontSize: 13, kecil: true, bold: true, color: EMAS_TUA });
  garis(s, X, 3.5, Wq);
  const pim = [["67", "kegiatan didisposisikan Wali Kota kepada Wakil Wali Kota langsung dari aplikasi"], ["386", "konfirmasi kehadiran Pimpinan oleh ajudan"]];
  pim.forEach(([a, k], i) => {
    const x = X + i * (Wq / 2);
    teks(s, a, x, 3.65, Wq / 2 - 0.2, 0.7, { fontFace: FX, fontSize: 34, color: NAVY });
    teks(s, k, x, 4.35, Wq / 2 - 0.3, 0.7, { fontSize: 12, kecil: true, color: ABU });
  });
  kotak(s, X, 5.2, Wq, 1.1, PUTIH, { garis: GARIS });
  teks(s, "LAYANAN PUBLIK", X + 0.3, 5.32, 3, 0.28, { fontSize: 10, bold: true, charSpacing: 2, color: ABU });
  teks(s, [{ text: "129 ", options: { bold: true, color: NAVY } }, { text: "pengajuan ruangan dari 68 instansi   ·   ", options: { color: TINTA } }, { text: "59 ", options: { bold: true, color: NAVY } }, { text: "permohonan audiensi dari 55 instansi; 31 menjadi agenda Pimpinan", options: { color: TINTA } }], X + 0.3, 5.62, Wq - 0.6, 0.6, { fontSize: 13, kecil: true });
  jembatan(s, "Dari data yang sama, ada bonusnya.");
  catat(s, 12);
}
// 13. Bonus 1: monitoring internal
{
  const s = slide();
  kepala(s, 3, "BONUS DARI SATU DATA  ·  MONITORING INTERNAL");
  judul(s, "Bonus pertama: setiap pesan dan keputusan terpantau");
  const ih = gambar(s, "monitorwa.jpg", M, 1.95, 5.3, 1960, 1540);
  teks(s, "Monitor WA (data contoh)", M, 1.98 + ih, 5.3, 0.26, { fontSize: 9, kecil: true, italic: true, color: ABU });
  const X = M + 5.75, Wb = W - M - X;
  const fitur = [["Monitor WA", "Meteran hari ini, 7 dan 30 hari; terkirim, sampai di HP, dibaca; kirim ulang sekaligus"], ["Peringatan dini", "Perangkat gerbang pesan terputus atau 3 pesan berturut-turut gagal"],
    ["Usulan menurut kegentingan", "Kuning dan merah menurut umur usulan dan dekatnya hari H"], ["Riwayat Alur", "Telusur setiap jadwal: siapa, kapan, apa keputusannya"], ["Ringkasan terjadwal", "06.30 briefing Pimpinan · 07.30 rekap pagi · 16.00 agenda besok"]];
  fitur.forEach(([j, k], i) => {
    const y = 1.95 + i * 0.84;
    teks(s, j, X, y, Wb - 1.0, 0.36, { fontSize: 16, bold: true, color: NAVY });
    status(s, X + Wb - 0.78, y + 0.05, false);
    teks(s, k, X, y + 0.38, Wb, 0.4, { fontSize: 12, kecil: true, color: ABU });
    garis(s, X, y + 0.78, Wb);
  });
  teks(s, "Isi pesan dihapus otomatis sesudah 90 hari; nomor penerima disamarkan.", X, 6.2, Wb, 0.26, { fontSize: 10, kecil: true, italic: true, color: ABU });
  jembatan(s, "Bonus kedua: kinerja yang terbaca.");
  catat(s, 13);
}
// 14. Bonus 2: kinerja dan evaluasi
{
  const s = slide();
  kepala(s, 3, "BONUS DARI SATU DATA  ·  KINERJA DAN EVALUASI");
  judul(s, "Bonus kedua: kinerja yang terbaca setiap hari");
  const Wk = 5.9;
  const kiri = [["Evaluasi pasca kegiatan", "Lima butir, berbeda untuk protokol dan dokumentasi", false, "341 kegiatan (55,3%) sudah dievaluasi petugas"], ["Rekap Evaluasi Kinerja tim", "Nilai terkini 60% · konsistensi 25% · tren 15%; peringkat A–E", false, ""],
    ["Rekap Penugasan Bulanan", "Bukti dukung kinerja pegawai untuk e-Kinerja", false, ""], ["Indikator Kinerja Bagian", "Ketepatan waktu layanan komunikasi dihitung otomatis; kepuasan Pimpinan dan standar keprotokolan tahap berikutnya", true, ""]];
  kiri.forEach(([j, k, siap, angka], i) => {
    const y = 1.95 + i * 1.04;
    if (siap) kotak(s, M - 0.15, y - 0.12, Wk + 0.3, 1.06, EMAS_MUDA, { r: 0.06 });
    teks(s, j, M, y, Wk - 1.8, 0.36, { fontSize: 16, bold: true, color: NAVY });
    status(s, M + Wk - (siap ? 1.6 : 0.78), y + 0.05, siap);
    teks(s, k, M, y + 0.38, Wk, 0.5, { fontSize: 12, kecil: true, color: ABU });
    if (angka) teks(s, angka, M, y + 0.62, Wk, 0.28, { fontSize: 12, kecil: true, bold: true, color: HIJAU });
    if (!siap) garis(s, M, y + 0.94, Wk);
  });
  teks(s, "IKU ketepatan waktu: naskah sambutan ≤ 24 jam sebelum acara; berita ≤ 24 jam sesudah acara, dicocokkan dengan unggahan Instagram @humas_tarakan.", M, 6.1, Wk, 0.4, { fontSize: 10, kecil: true, italic: true, color: ABU });
  const X = M + Wk + 0.45, Wg = W - M - X;
  const h1 = gambar(s, "iku.jpg", X, 1.95, Wg - 0.7, 1980, 1280);
  teks(s, "Indikator Kinerja (data contoh)", X, 1.98 + h1, Wg, 0.26, { fontSize: 9, kecil: true, italic: true, color: ABU });
  teks(s, "Keduanya lahir dari data yang sama: tanpa aplikasi tambahan, tanpa biaya.", X, 2.35 + h1, Wg, 0.7, { fontSize: 15, bold: true, color: NAVY });
  jembatan(s, "Ke mana semua ini bermuara?");
  catat(s, 14);
}

// ══ BAB 4 · KE DEPAN ═══════════════════════════════════════════════
// 15. Keselarasan
{
  const s = slide();
  kepala(s, 4, "KESELARASAN DENGAN RPJMD DAN KATEGORI A");
  judul(s, "Untuk Tarakan yang adaptif, responsif, dan HIBOT");
  teks(s, [{ text: "Misi 4 RPJMD Kota Tarakan 2025–2029   ", options: { bold: true, color: EMAS_TUA } }, { text: "Mewujudkan tata kelola pemerintahan yang adaptif, responsif dan menjaga stabilitas ketertiban dan ketentraman kota", options: { color: TINTA } }], M, 1.8, W - 2 * M, 0.65, { fontSize: 15 });
  const unsur = [["Tata kelola", "Kewenangan melekat pada jabatan; Plh bermasa berlaku"], ["Proses bisnis", "Tanpa jendela waktu; tanpa cetak ulang"], ["Digitalisasi", "Sebelas alur dalam satu superapp"], ["Data", "Satu data; 617 kegiatan tercatat"],
    ["Manajemen", "Sebaran beban, rekap kinerja, evaluasi"], ["Pengawasan", "3.331 peristiwa jejak audit"], ["Efisiensi", "Median 1,94 jam; Rp0 pengadaan"]];
  teks(s, "TUJUH UNSUR KATEGORI A", M, 2.65, 5, 0.28, { fontSize: 10, bold: true, charSpacing: 2, color: ABU });
  const kw = (W - 2 * M - 6 * 0.14) / 7;
  unsur.forEach(([j, k], i) => {
    const x = M + i * (kw + 0.14);
    kotak(s, x, 2.98, kw, 1.75, PUTIH, { garis: GARIS });
    teks(s, j, x + 0.15, 3.1, kw - 0.3, 0.38, { fontSize: 14, bold: true, color: NAVY });
    teks(s, k, x + 0.15, 3.52, kw - 0.3, 1.15, { fontSize: 11, kecil: true, color: ABU });
  });
  teks(s, "SEMBOYAN TARAKAN HIBOT DALAM RANCANGAN", M, 5.0, 6, 0.28, { fontSize: 10, bold: true, charSpacing: 2, color: ABU });
  const hibot = [["H", "Handal", "satu sumber data"], ["I", "Inovatif", "jejak audit, daftar periksa"], ["B", "Berbudaya", "tata naskah, naskah tercetak"], ["O", "Oenggoel", "99,3% tayang < 24 jam"], ["T", "Tangguh", "Plh; tanpa anggaran"]];
  const hw = (W - 2 * M - 4 * 0.15) / 5;
  hibot.forEach(([h, j, k], i) => {
    const x = M + i * (hw + 0.15);
    teks(s, h, x, 5.3, 0.55, 0.65, { fontFace: FX, fontSize: 32, color: EMAS, valign: "middle" });
    teks(s, j, x + 0.6, 5.3, hw - 0.6, 0.32, { fontSize: 14, bold: true, color: NAVY });
    teks(s, k, x + 0.6, 5.62, hw - 0.6, 0.4, { fontSize: 11, kecil: true, color: ABU });
  });
  jembatan(s, "Agar tidak berhenti di kami.");
  catat(s, 15);
}
// 16. Keberlanjutan dan replikasi
{
  const s = slide();
  kepala(s, 4, "KEBERLANJUTAN DAN REPLIKASI");
  judul(s, "Tidak bergantung pada anggaran maupun satu orang");
  const aspek = [["Pembiayaan", "Biaya berjalan mendekati nol"], ["Kelembagaan", "Kewenangan melekat pada jabatan; mutasi tidak memutus alur"], ["Prosedur", "Sebelas SOP disusun untuk disahkan Sekda"], ["Pemeliharaan", "140+ pembaruan dari masukan pengguna"]];
  aspek.forEach(([j, k], i) => {
    const y = 1.95 + i * 0.85;
    teks(s, j, M, y, 1.9, 0.75, { fontSize: 15, bold: true, color: NAVY, valign: "middle" });
    teks(s, k, M + 1.95, y, 2.5, 0.75, { fontSize: 12, kecil: true, color: ABU, valign: "middle" });
    garis(s, M, y + 0.8, 4.45);
  });
  const X = M + 4.95, Wj = 3.4;
  teks(s, "RENCANA", X, 1.95, Wj, 0.28, { fontSize: 10, bold: true, charSpacing: 2, color: ABU });
  const jalan = [["Okt–Des 2026", "Pengesahan SOP oleh Sekretaris Daerah"], ["Jan–Jun 2027", "Pendampingan pengelola kedua; dokumentasi teknis"], ["Jul–Des 2027", "Paket replikasi, dimulai dari Kalimantan Utara"]];
  s.addShape(pres.shapes.LINE, { x: X + 0.1, y: 2.45, w: 0, h: 2.75, line: { color: GARIS, width: 2 } });
  jalan.forEach(([t, k], i) => {
    const y = 2.3 + i * 1.15;
    s.addShape(pres.shapes.OVAL, { x: X, y: y + 0.1, w: 0.2, h: 0.2, fill: { color: EMAS }, line: { color: KERTAS, width: 2 } });
    teks(s, t, X + 0.45, y, Wj - 0.45, 0.38, { fontSize: 15, bold: true, color: NAVY });
    teks(s, k, X + 0.45, y + 0.4, Wj - 0.45, 0.6, { fontSize: 13, kecil: true, color: TINTA });
  });
  const XR = X + Wj + 0.4, WR = W - M - XR;
  kotak(s, XR, 1.95, WR, 4.3, NAVY);
  teks(s, "SIAP DITIRU", XR + 0.35, 2.2, WR - 0.7, 0.3, { fontSize: 10, bold: true, charSpacing: 2, color: EMAS });
  teks(s, "Utuh atau per modul", XR + 0.35, 2.55, WR - 0.7, 0.45, { fontSize: 18, bold: true, color: PUTIH });
  teks(s, ["Sekretariat DPRD: agenda pimpinan dewan", "Perangkat daerah: ruangan, audiensi, daftar hadir", "Pemprov Kaltara dan kabupaten di Kaltara", "Seluruh pemerintah daerah di Indonesia"].map((b, n, a) => ({ text: b, options: { bullet: true, breakLine: n < a.length - 1 } })),
    XR + 0.35, 3.1, WR - 0.7, 2.3, { fontSize: 12, kecil: true, color: "D9DEE7", paraSpaceAfter: 5 });
  teks(s, "Syarat: peramban, kuota tanpa biaya, 11 SOP siap diadaptasi, satu pengelola.", XR + 0.35, 5.5, WR - 0.7, 0.7, { fontSize: 12, kecil: true, bold: true, color: EMAS });
  catat(s, 16);
}

// ══ 17. Penutup: kembali ke lembar Januari ═════════════════════════
{
  const s = slide(true);
  foto(s, "foto-berkas.jpg", 0, 0, W, H, 12);
  logo(s, M, 0.6);
  teks(s, "Januari itu, satu lembar tidak sampai, dan tidak ada yang tahu.", M, 1.9, 8.2, 1.0, { fontSize: 20, italic: true, color: "C9D1DD" });
  teks(s, "Kini, setiap agenda punya satu data, dan setiap keputusan tercatat.", M, 2.85, 8.0, 1.9, { fontFace: FX, fontSize: 36, color: PUTIH });
  garis(s, M, 4.95, 0.6, EMAS, 2.5);
  teks(s, "Inovasi Berdampak, Tarakan Maju dan Berdaya Saing", M, 5.15, 8, 0.45, { fontSize: 18, bold: true, color: EMAS });
  teks(s, "Terima kasih  ·  Tim Inovasi Prokopim Hibot, Bagian Protokol dan Komunikasi Pimpinan, Setda Kota Tarakan", M, 5.7, 8.2, 0.5, { fontSize: 12, kecil: true, color: "C9D1DD" });
  kotak(s, 9.55, 1.9, 3.13, 3.75, PUTIH, { r: 0.1 });
  s.addImage({ path: A + "qr.png", x: 9.82, y: 2.12, w: 2.6, h: 2.6 });
  teks(s, "prokopim.tarakankota.go.id", 9.65, 4.85, 2.93, 0.35, { fontSize: 13, kecil: true, bold: true, color: NAVY, align: "center" });
  teks(s, "alamat resmi aplikasi", 9.65, 5.18, 2.93, 0.3, { fontSize: 11, kecil: true, color: ABU, align: "center" });
  catat(s, 17);
}

// ══ 18. Cadangan ═══════════════════════════════════════════════════
{
  const s = slide();
  teks(s, "CADANGAN  ·  BILA DITANYA", M, 0.42, 5, 0.3, { fontSize: 11, bold: true, charSpacing: 2.5, color: ABU });
  judul(s, "Sejak proposal, inovasi ini terus disempurnakan");
  teks(s, "Proposal memuat keadaan per 5 Oktober 2026. Pembaruan berikut berangkat dari pemakaian dan masukan pengguna, tanpa belanja pengadaan.", M, 1.75, W - 2 * M, 0.45, { fontSize: 13, kecil: true, color: ABU });
  const unsur = [["Pengingat dirampingkan", "Dari lima kali sehari menjadi tiga waktu (06.30, 07.30, 16.00) ditambah kabar seketika."], ["Monitor WA lengkap", "Status sampai di HP dan dibaca, peringatan dini, kirim ulang sekaligus."],
    ["Beranda Pimpinan", "Agenda yang perlu dikonfirmasi tampil di halaman pertama Wali Kota dan Wakil."], ["Indikator Kinerja", "Menu IKU Bagian Prokopim siap diterapkan; ketepatan waktu dihitung otomatis."],
    ["Widget agenda publik", "Agenda Pimpinan hari ini, tanpa lokasi, siap dipasang di www.tarakankota.go.id."], ["Buku petunjuk", "Buku petunjuk aplikasi dan panduan pemohon audiensi serta ruangan."]];
  const gw = (W - 2 * M - 2 * 0.25) / 3, gh = 1.55;
  unsur.forEach(([j, k], i) => {
    const x = M + (i % 3) * (gw + 0.25), y = 2.4 + Math.floor(i / 3) * (gh + 0.2);
    kotak(s, x, y, gw, gh, PUTIH, { garis: GARIS });
    teks(s, String(i + 1).padStart(2, "0"), x + 0.25, y + 0.2, 0.5, 0.3, { fontSize: 11, kecil: true, bold: true, color: EMAS_TUA });
    teks(s, j, x + 0.75, y + 0.15, gw - 0.95, 0.4, { fontSize: 15, bold: true, color: NAVY });
    teks(s, k, x + 0.25, y + 0.62, gw - 0.5, gh - 0.7, { fontSize: 12, kecil: true, color: TINTA });
  });
  kotak(s, M, 6.0, W - 2 * M, 0.72, NAVY, { r: 0.06 });
  teks(s, [{ text: "Modul yang belum optimal (proposal 9.7)   ", options: { bold: true, color: EMAS } }, { text: "Baru 3 naskah sambutan disahkan lewat aplikasi, karena Pimpinan lebih nyaman naskah tercetak. Aplikasi menyesuaikan cara kerja Pimpinan.", options: { color: PUTIH } }], M + 0.3, 6.0, W - 2 * M - 0.6, 0.72, { fontSize: 12, kecil: true, valign: "middle" });
  catat(s, 18);
}

(async () => {
  await pres.writeFile({ fileName: KELUAR });
  await applyTheme(KELUAR, THEME);
  console.log("tersimpan", KELUAR);
})();
