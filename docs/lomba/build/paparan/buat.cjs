// Paparan Tahap II — Prokopim Hibot, Kaltara Innovation Awards 2026.
// Urutan mengikuti Tabel 3.1 (Latar Belakang → Kompatibilitas); angka hanya
// dari kartu angka (data proposal 24 September 2026).
//
// Membangun:  npm install pptxgenjs (di folder kerja), lalu
//   NODE_PATH=<node_modules> APPLY_THEME=<apply_theme.js> node docs/lomba/build/paparan/buat.cjs <keluaran.pptx>
const pptxgen = require("pptxgenjs");
// Menulis warna tema ke dalam berkas; jalurnya diberikan lewat APPLY_THEME
// (skrip apply_theme.js dari skill pptx). Tanpa itu warna tema bawaan Office.
const applyTheme = process.env.APPLY_THEME ? require(process.env.APPLY_THEME).applyTheme : async () => {};
const A = __dirname + "/aset/";
const KELUAR = process.argv[2] || __dirname + "/Paparan-Prokopim-Hibot-Kaltara-2026.pptx";

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
pres.title = "Prokopim Hibot — Paparan Tahap II Kaltara Innovation Awards 2026";
pres.author = "Tim Inovasi Prokopim Hibot, Setda Kota Tarakan";
pres.company = "Pemerintah Kota Tarakan";
const C = pres.SchemeColor;

const W = 13.333, M = 0.6;
const KAKI = "Prokopim Hibot  ·  Kaltara Innovation Awards 2026  ·  Kategori ASN Pemerintah Kabupaten/Kota";

// ── Layout ─────────────────────────────────────────────────────────
pres.defineSlideMaster({
  title: "ISI",
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "aspek", type: "body", x: M, y: 0.32, w: 9, h: 0.32, fontSize: 12, bold: true, color: C.accent5, charSpacing: 2, margin: 0, valign: "middle" }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.66, w: W - 2 * M, h: 0.85, fontSize: 28, bold: true, color: C.text2, margin: 0, valign: "top", align: "left" }, text: "" } },
    { text: { text: KAKI, options: { x: M, y: 7.02, w: 9, h: 0.3, fontSize: 10, color: C.accent5, margin: 0 } } },
    { image: { path: A + "kaltara.png", x: W - M - 1.55, y: 6.95, w: 0.3, h: 0.4 } },
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
    { text: { text: KAKI, options: { x: M, y: 7.02, w: 9, h: 0.3, fontSize: 10, color: C.accent6, margin: 0 } } },
  ],
  slideNumber: { x: W - M - 0.6, y: 7.02, w: 0.6, h: 0.3, fontSize: 10, color: C.accent6, align: "right" },
});

// ── Pembantu ───────────────────────────────────────────────────────
const bayang = () => ({ type: "outer", color: "0A1628", opacity: 0.12, blur: 8, offset: 2, angle: 90 });
const kartu = (s, x, y, w, h, o = {}) =>
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: o.isi || C.background2 }, line: { color: o.garis || o.isi || C.background2, width: o.tebal || 0.75 }, shadow: o.bayang ? bayang() : undefined, objectName: o.nama });
const teks = (s, t, x, y, w, h, o = {}) =>
  s.addText(t, { x, y, w, h, isTextBox: true, margin: 0, fontSize: 14, color: C.text1, valign: "top", ...o });
const bulat = (s, x, y, d, warna, label, warnaTeks) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: warna }, line: { color: warna } });
  s.addText(label, { x, y, w: d, h: d, isTextBox: true, margin: 0, align: "center", valign: "middle", fontSize: 14, bold: true, color: warnaTeks });
};
const panah = (s, x1, y1, x2, y2, warna = C.accent5) =>
  s.addShape(pres.shapes.LINE, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color: warna, width: 1.75, endArrowType: "triangle" } });
const logo = (s) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 0.45, w: 1.95, h: 0.95, rectRadius: 0.14, fill: { color: C.background1 }, line: { color: C.background1 }, objectName: "alas logo" });
  s.addImage({ path: A + "kaltara.png", x: M + 0.2, y: 0.53, w: 0.6, h: 0.8 });
  s.addImage({ path: A + "tarakan.png", x: M + 0.98, y: 0.53, w: 0.8, h: 0.8 });
};
const isi = (aspek, judul, gelap = false) => {
  const s = pres.addSlide({ masterName: gelap ? "GELAP" : "ISI", sectionTitle: BAGIAN });
  if (aspek) s.addText(aspek, { placeholder: "aspek" });
  s.addText(judul, { placeholder: "title" });
  return s;
};
let BAGIAN = "Pembuka";
const bagian = (t) => { BAGIAN = t; pres.addSection({ title: t }); };

// ══ 1. Judul ═══════════════════════════════════════════════════════
bagian("Pembuka");
{
  const s = pres.addSlide({ masterName: "GELAP", sectionTitle: BAGIAN });
  logo(s);
  teks(s, "KALTARA INNOVATION AWARDS 2026  ·  PENILAIAN TAHAP II", M, 1.55, 8.4, 0.3, { fontSize: 12, bold: true, color: C.accent1, charSpacing: 1 });
  teks(s, "Prokopim Hibot", M, 2.0, 8.2, 1.1, { fontSize: 54, bold: true, color: C.background1, fontFace: "Arial" });
  teks(s, "Satu Alur Digital Terverifikasi untuk Tata Kelola Agenda dan Keprotokolan Pimpinan Daerah", M, 3.15, 7.8, 1.0, { fontSize: 22, color: C.accent1 });
  teks(s, "Inovasi Terapan – ASN Pemerintah Kabupaten/Kota\nBagian Protokol dan Komunikasi Pimpinan, Sekretariat Daerah Kota Tarakan", M, 4.4, 7.8, 0.75, { fontSize: 15, color: C.accent6, paraSpaceAfter: 2 });
  teks(s, [
    { text: "Tim Inovasi  ", options: { bold: true, color: C.accent1 } },
    { text: "Anugrah Yega Pranatha, M.Si. (Ketua)  ·  Saifullah, S.H.  ·  Juliyanti, S.AP.  ·  Mastura, S.Sos.  ·  Ni Kade Sari Handayani, S.AP.", options: { color: C.background1 } },
  ], M, 5.55, 7.8, 0.75, { fontSize: 13 });
  s.addImage({ path: A + "hp_walikota.jpg", x: 9.35, y: 0.55, w: 2.95, h: 6.38, shadow: { type: "outer", color: "000000", opacity: 0.35, blur: 12, offset: 4, angle: 90 } });
  s.addNotes("Izin kami sampaikan Prokopim Hibot, satu alur digital terverifikasi untuk agenda Pimpinan Daerah. (±20 detik)");
}

// ══ 2–3. Latar belakang ════════════════════════════════════════════
bagian("Latar belakang");
{
  const s = isi("LATAR BELAKANG  ·  20%", "Satu lembar disposisi hilang, dan tak ada yang tahu");
  // Tiga lembar disposisi
  const lembar = [["Disposisi 1", "Difoto, terkirim ke grup WA", false], ["Disposisi 2", "Difoto, terkirim ke grup WA", false], ["Disposisi 3", "Tertinggal — tidak ada yang tahu", true]];
  lembar.forEach(([j, k, hilang], i) => {
    const y = 1.85 + i * 1.32;
    kartu(s, M, y, 4.9, 1.1, { isi: hilang ? "FDECEC" : C.background2, garis: hilang ? C.accent4 : C.background2, tebal: hilang ? 1.5 : 0.75, nama: "lembar" + (i + 1) });
    bulat(s, M + 0.25, y + 0.27, 0.56, hilang ? C.accent4 : C.accent3, hilang ? "✗" : "✓", C.background1);
    teks(s, j, M + 1.05, y + 0.2, 3.7, 0.36, { fontSize: 16, bold: true, color: C.text2 });
    teks(s, k, M + 1.05, y + 0.58, 3.7, 0.34, { fontSize: 14, color: hilang ? C.accent4 : C.accent5, bold: hilang });
  });
  teks(s, "Januari 2026 — semua pihak bekerja dengan benar. Rantainya yang rapuh.", M, 5.95, 4.9, 0.7, { fontSize: 15, italic: true, color: C.text2 });

  // Cara kerja lama
  const X = 6.2, Wt = W - M - X;
  teks(s, "Cara kerja sebelum Maret 2026", X, 1.85, Wt, 0.4, { fontSize: 18, bold: true, color: C.text2 });
  const baris = [
    ["Rencana kegiatan", "Disusun di spreadsheet, lalu dicetak"],
    ["Penelaahan", "±30 menit menjelang jam pulang (16.00)"],
    ["Disposisi", "Beredar sebagai foto di grup percakapan"],
    ["Penugasan petugas", "Bergantung pada ingatan"],
    ["Ketersediaan ruangan", "Hanya tercatat di papan tulis"],
    ["Dari undangan sampai tayang", "Diperkirakan 18–24 jam"],
  ];
  s.addTable(baris.map(([a, b], i) => [
    { text: a, options: { bold: true, color: C.text2, fill: { color: i % 2 ? "FFFFFF" : HEX.lt2 } } },
    { text: b, options: { color: i === 5 ? C.accent4 : C.text1, bold: i === 5, fill: { color: i % 2 ? "FFFFFF" : HEX.lt2 } } },
  ]), { x: X, y: 2.35, w: Wt, colW: [2.55, Wt - 2.55], fontSize: 14, fontFace: "Arial", border: { type: "none" }, rowH: 0.62, valign: "middle", margin: [0, 0.12, 0, 0.12] });
  s.addNotes("Januari 2026. Tiga lembar disposisi agenda diturunkan; yang sampai ke kami hanya dua. Tidak ada yang lalai, tetapi tidak ada pula yang bisa mengetahuinya. Sebelum Maret 2026: rencana kegiatan di spreadsheet lalu dicetak, penelaahan hanya sempat sekitar 30 menit menjelang jam pulang, disposisi beredar sebagai foto, penugasan bergantung pada ingatan. (±40 detik)");
}
{
  const s = isi("LATAR BELAKANG  ·  20%", "Akar masalahnya satu: tidak ada sumber data yang sahih");
  // Akar di kiri, lima cabang di kanan
  kartu(s, M, 2.9, 3.6, 1.9, { isi: C.text2, nama: "akar" });
  teks(s, "AKAR MASALAH", M + 0.3, 3.15, 3.0, 0.3, { fontSize: 12, bold: true, color: C.accent1, charSpacing: 1 });
  teks(s, "Tidak ada satu sumber data yang dapat dirujuk semua pihak", M + 0.3, 3.5, 3.05, 1.2, { fontSize: 18, bold: true, color: C.background1 });
  const cabang = [
    "Penelaahan terikat jendela ±30 menit",
    "Keputusan tidak meninggalkan jejak",
    "Beberapa versi cetakan beredar bersamaan",
    "Pengetahuan kerja melekat pada orang",
    "Kanal publik tidak dapat ditelusuri",
  ];
  const X = 5.35;
  cabang.forEach((c, i) => {
    const y = 1.78 + i * 0.86;
    panah(s, M + 3.6, 3.85, X - 0.05, y + 0.33);
    kartu(s, X, y, 4.3, 0.66, { isi: C.background2, nama: "cabang" + (i + 1) });
    teks(s, c, X + 0.22, y, 3.95, 0.66, { fontSize: 15, color: C.text1, valign: "middle" });
  });
  // Penjaringan ide
  const XP = 9.95, WP = W - M - XP;
  kartu(s, XP, 1.78, WP, 3.2, { isi: "FFFFFF", garis: C.accent6, nama: "penjaringan" });
  teks(s, "Ide dijaring dari pekerjaan sehari-hari", XP + 0.22, 1.98, WP - 0.44, 0.7, { fontSize: 15, bold: true, color: C.text2 });
  teks(s, [
    { text: "Banyak pintu masuk informasi agenda", options: { bullet: true, breakLine: true } },
    { text: "Peristiwa Januari 2026", options: { bullet: true, breakLine: true } },
    { text: "Telaah bersama seluruh Bagian Prokopim", options: { bullet: true } },
  ], XP + 0.22, 2.8, WP - 0.44, 2.8, { fontSize: 14, color: C.text1, paraSpaceAfter: 8 });
  s.addNotes("Telaah bersama seluruh Bagian sesudah peristiwa Januari menemukan pola yang sama di banyak tempat: penugasan tersimpan dalam ingatan, ruangan hanya tercatat di papan tulis, arsip tersebar. Akarnya satu: tidak ada satu sumber data yang sahih. Data pembanding: dari undangan sampai tayang diperkirakan 18–24 jam. (±40 detik)");
}

// ══ 4–5. Terobosan ═════════════════════════════════════════════════
bagian("Terobosan inovasi");
{
  const s = isi("TEROBOSAN INOVASI  ·  20%", "Bukan menambah pengawasan, tetapi mengganti rantainya");
  const pilihan = [
    ["Menambah pengawasan dan pengingat manual", "Tidak menyentuh akar masalah"],
    ["Merapikan spreadsheet bersama", "Tetap banyak versi, tanpa jejak keputusan"],
    ["Membeli aplikasi jadi", "Butuh anggaran; alur keprotokolan sangat khas"],
    ["Membangun sendiri: satu data, setiap keputusan tercatat", "Dipilih — tanpa anggaran pengadaan"],
  ];
  const lw = (W - 2 * M - 3 * 0.25) / 4;
  pilihan.forEach(([j, k], i) => {
    const x = M + i * (lw + 0.25), pilih = i === 3;
    kartu(s, x, 1.75, lw, 2.2, { isi: pilih ? C.text2 : C.background2, bayang: pilih, nama: "pilihan" + (i + 1) });
    bulat(s, x + 0.22, 1.95, 0.42, pilih ? C.accent1 : C.accent6, pilih ? "✓" : "✗", pilih ? C.text2 : C.accent5);
    teks(s, j, x + 0.22, 2.45, lw - 0.44, 0.85, { fontSize: 14, bold: true, color: pilih ? C.background1 : C.text2 });
    teks(s, k, x + 0.22, 3.38, lw - 0.44, 0.5, { fontSize: 12, color: pilih ? C.accent1 : C.accent5 });
  });
  // Alur
  teks(s, "Satu alur berjenjang, satu data untuk semua peran", M, 4.2, 8, 0.4, { fontSize: 18, bold: true, color: C.text2 });
  const langkah = [
    ["Admin RK", "Memindai undangan; formulir terisi"],
    ["Kasubbag", "Menelaah dari mana saja; daftar periksa wajib"],
    ["Kabag", "Memutus dan menayangkan"],
    ["HP Pimpinan", "Agenda tiba; ajudan mengonfirmasi"],
  ];
  const sw = (W - 2 * M - 3 * 0.5) / 4;
  langkah.forEach(([j, k], i) => {
    const x = M + i * (sw + 0.5), y = 4.72;
    kartu(s, x, y, sw, 1.85, { isi: i === 3 ? "FBF6E7" : "FFFFFF", garis: i === 3 ? C.accent1 : C.accent6, tebal: i === 3 ? 1.5 : 0.75, nama: "langkah" + (i + 1) });
    bulat(s, x + 0.22, y + 0.22, 0.46, C.text2, String(i + 1), C.background1);
    teks(s, j, x + 0.82, y + 0.22, sw - 1.0, 0.46, { fontSize: 17, bold: true, color: C.text2, valign: "middle" });
    teks(s, k, x + 0.22, y + 0.9, sw - 0.44, 0.9, { fontSize: 14, color: C.text1 });
    if (i < 3) panah(s, x + sw + 0.06, y + 0.97, x + sw + 0.44, y + 0.97, C.text2);
  });
  s.addNotes("Ada empat pilihan. Menambah pengawasan tidak menyentuh akar masalah. Merapikan spreadsheet tetap menyisakan banyak versi. Membeli aplikasi jadi butuh anggaran, padahal alur keprotokolan sangat khas. Kami memilih membangun sendiri. Hasilnya satu alur: Admin RK → Kasubbag → Kabag → tayang di HP Pimpinan. Sebut daftar periksa wajib, Pelaksana Harian, dan kanal publik. (±40 detik)");
}
{
  const s = isi("TEROBOSAN INOVASI  ·  20%", "Enam unsur kebaruan, dan terus bertambah");
  const unsur = [
    ["Jejak audit di setiap kegiatan", "Siapa, kapan, apa keputusannya — 3.072 peristiwa"],
    ["Daftar periksa wajib", "Tombol setuju baru aktif sesudah butir dicentang"],
    ["Pelaksana Harian bermasa berlaku", "Kewenangan padam sendiri pada tanggal akhirnya"],
    ["Pengawasan menurut kegentingan", "Usulan tertahan ditandai menurut umur dan hari H"],
    ["Kanal publik terlacak", "Pemohon memantau sendiri dengan kode penelusuran"],
    ["Tersambung kalender bersama", "Agenda tersetujui tampil sendiri di Google Calendar"],
  ];
  const gw = 2.62, gh = 2.1, g = 0.22;
  unsur.forEach(([j, k], i) => {
    const x = M + (i % 3) * (gw + g), y = 1.8 + Math.floor(i / 3) * (gh + g);
    kartu(s, x, y, gw, gh, { isi: C.background2, nama: "unsur" + (i + 1) });
    bulat(s, x + 0.2, y + 0.2, 0.46, C.text2, String.fromCharCode(97 + i), C.accent1);
    teks(s, j, x + 0.2, y + 0.78, gw - 0.4, 0.62, { fontSize: 15, bold: true, color: C.text2 });
    teks(s, k, x + 0.2, y + 1.38, gw - 0.4, 0.62, { fontSize: 12, color: C.accent5 });
  });
  const X = M + 3 * (gw + g) + 0.15, Wb = W - M - X;
  kartu(s, X, 1.8, Wb, 2 * gh + g, { isi: C.text2, nama: "sejakproposal" });
  teks(s, "SEJAK PROPOSAL\nOKTOBER 2026", X + 0.3, 2.02, Wb - 0.6, 0.55, { fontSize: 12, bold: true, color: C.accent1, charSpacing: 1 });
  teks(s, [
    { text: "Notifikasi tamu berjenjang tanpa mengganggu Pimpinan", options: { bullet: true, breakLine: true } },
    { text: "Monitor WA: setiap pesan terlacak terkirim/terbaca", options: { bullet: true, breakLine: true } },
    { text: "Masuk dengan sidik jari dan akun Google", options: { bullet: true, breakLine: true } },
    { text: "Zona waktu WIB/WITA/WIT mengikuti lokasi Pimpinan", options: { bullet: true, breakLine: true } },
    { text: "Kebijakan privasi sesuai UU 27/2022", options: { bullet: true } },
  ], X + 0.3, 2.75, Wb - 0.55, 3.3, { fontSize: 15, color: C.background1, paraSpaceAfter: 9 });
  s.addNotes("Kebaruan ada pada cara aplikasi menjaga mutu keputusan: jejak audit, daftar periksa wajib, Pelaksana Harian bermasa berlaku, pengawasan menurut kegentingan, kanal publik terlacak, dan kalender bersama. Sejak proposal, aplikasi terus dikembangkan dari kendala pengguna (sebut bulannya: Oktober 2026). Lalu: 'Izin kami tunjukkan langsung di aplikasi.' → masuk demo. (±30 detik)");
}

// ══ 6–8. Manfaat ═══════════════════════════════════════════════════
bagian("Manfaat inovasi");
{
  const s = isi("MANFAAT INOVASI  ·  25%  ·  DEMONSTRASI", "Satu kegiatan, dari undangan sampai HP Pimpinan", true);
  const langkah = [
    ["Admin RK", "Pindai undangan → cek benturan → kirim"],
    ["Kasubbag", "Notifikasi → daftar periksa → teruskan"],
    ["Kabag", "Setujui dan tayangkan"],
    ["HP Wali Kota", "Agenda tiba → Hadir / disposisi ke Wawali"],
    ["Admin RK", "Tugaskan petugas → Riwayat Alur"],
    ["Kabag", "Monitor WA → pesan penugasan terkirim"],
  ];
  const kw = (W - 2 * M - 3 * 0.3) / 4;
  langkah.forEach(([j, k], i) => {
    const baris = i < 4 ? 0 : 1, kol = i < 4 ? i : i - 4;
    const x = M + kol * (kw + 0.3), y = 1.85 + baris * 2.35;
    kartu(s, x, y, kw, 2.0, { isi: "13233F", garis: i === 3 ? C.accent1 : "2A3B57", tebal: i === 3 ? 1.5 : 0.75, nama: "demo" + (i + 1) });
    bulat(s, x + 0.22, y + 0.22, 0.5, C.accent1, String(i + 1), C.text2);
    teks(s, j, x + 0.88, y + 0.22, kw - 1.05, 0.5, { fontSize: 17, bold: true, color: C.background1, valign: "middle" });
    teks(s, k, x + 0.22, y + 0.95, kw - 0.44, 0.9, { fontSize: 14, color: C.accent6 });
  });
  const x = M + 2 * (kw + 0.3);
  teks(s, "Langkah 1–4: satu alur sampai ke Pimpinan.\nLangkah 5–6: setiap keputusan dan pesan tercatat.", x, 4.3, 2 * kw + 0.3, 1.6, { fontSize: 16, italic: true, color: C.accent1, paraSpaceAfter: 6 });
  s.addNotes("DEMO 3 menit (menit 2:50–5:50 paparan). Admin RK memegang laptop, Kasubbag dan Kabag memegang HP; Kabag memandu. Semua memakai instans demo berdata contoh. Kanal publik tidak didemokan di sini; ia fitur terpisah (slide 9). Cadangan: video demo luring di laptop dan diska lepas. Admin RK memberi isyarat pada 5:50.");
}
{
  const s = isi("MANFAAT INOVASI  ·  25%", "Dari 18–24 jam menjadi 1,99 jam, dan setiap keputusan tercatat");
  // Sebelum → sesudah, dibaca kiri ke kanan
  const bw = 3.55, by = 1.85, bh = 2.85;
  kartu(s, M, by, bw, bh, { isi: C.background2, nama: "sebelum" });
  teks(s, "SEBELUM", M + 0.3, by + 0.22, bw - 0.6, 0.3, { fontSize: 12, bold: true, color: C.accent5, charSpacing: 2 });
  teks(s, "±18–24 jam", M + 0.3, by + 0.65, bw - 0.6, 0.9, { fontSize: 36, bold: true, color: C.accent5 });
  teks(s, "dari pengajuan sampai tayang; perkiraan alur lama yang tidak pernah dicatat", M + 0.3, by + 1.6, bw - 0.6, 1.0, { fontSize: 13, color: C.accent5 });
  panah(s, M + bw + 0.1, by + bh / 2, M + bw + 0.55, by + bh / 2, C.text2);
  const ax = M + bw + 0.65, aw = 4.0;
  kartu(s, ax, by, aw, bh, { isi: C.text2, nama: "sesudah" });
  teks(s, "SESUDAH", ax + 0.3, by + 0.22, aw - 0.6, 0.3, { fontSize: 12, bold: true, color: C.accent1, charSpacing: 2 });
  teks(s, "1,99 jam", ax + 0.3, by + 0.6, aw - 0.6, 1.0, { fontSize: 50, bold: true, color: C.background1 });
  teks(s, "median terukur dari basis data; 99,3% tayang kurang dari 24 jam", ax + 0.3, by + 1.75, aw - 0.6, 0.9, { fontSize: 13, color: C.accent6 });
  // Bukti di sisi kanan, berurutan menurut alur: volume → keputusan → jejak → penugasan → biaya
  const X = ax + aw + 0.4, Wr = W - M - X;
  teks(s, "Yang menopang angka itu", X, by, Wr, 0.35, { fontSize: 15, bold: true, color: C.text2 });
  const bukti = [
    ["589", "kegiatan terkelola"],
    ["47,5%", "telaah di luar jam kerja"],
    ["3.072", "peristiwa jejak audit"],
    ["92,4%", "kegiatan ada petugasnya"],
    ["Rp0", "belanja pengadaan"],
  ];
  bukti.forEach(([a, k], i) => {
    const y = by + 0.5 + i * 0.4;
    teks(s, a, X, y, 1.05, 0.38, { fontSize: 15, bold: true, color: C.text2, valign: "middle" });
    teks(s, k, X + 1.1, y, Wr - 1.1, 0.38, { fontSize: 12, color: C.accent5, valign: "middle" });
  });
  // Alur singkat di bawah: mengapa bisa secepat itu
  teks(s, "Mengapa lebih cepat", M, 4.95, 6, 0.35, { fontSize: 15, bold: true, color: C.text2 });
  const sebab = [["Tanpa jendela 30 menit", "telaah dan persetujuan bisa dilakukan kapan saja, dari mana saja"], ["Satu sumber data", "tidak ada versi ganda, foto disposisi, atau grup yang harus ditelusuri"], ["Daftar periksa wajib", "kekeliruan tertahan sebelum tayang, bukan sesudahnya"]];
  const sw = (W - 2 * M - 2 * 0.25) / 3;
  sebab.forEach(([j, k], i) => {
    const x = M + i * (sw + 0.25);
    kartu(s, x, 5.35, sw, 1.2, { isi: "FFFFFF", garis: C.accent6, nama: "sebab" + (i + 1) });
    teks(s, j, x + 0.22, 5.45, sw - 0.44, 0.4, { fontSize: 14, bold: true, color: C.text2, valign: "middle" });
    teks(s, k, x + 0.22, 5.85, sw - 0.44, 0.65, { fontSize: 12, color: C.text1 });
  });
  teks(s, "Sumber: basis data Prokopim Hibot, 24 September 2026. Angka \"sebelum\" adalah estimasi dari alur lama.", M, 6.65, W - 2 * M, 0.3, { fontSize: 10, color: C.accent5 });
  s.addNotes("Baca dari kiri ke kanan: sebelumnya diperkirakan 18–24 jam (tidak pernah dicatat), sekarang median 1,99 jam yang terukur, dan 99,3% tayang kurang dari sehari. Sebutkan tiga angka saja: 1,99 jam, 99,3%, dan 47,5% penelaahan di luar jam kerja (405 dari 852), artinya pekerjaan tidak lagi menunggu jendela 30 menit. Jejak audit: 3.072 peristiwa pada 438 kegiatan; penugasan petugas pada 92,4% kegiatan. (±50 detik)");
}
{
  const s = isi("MANFAAT INOVASI  ·  25%", "Dirasakan langsung oleh Pimpinan dan jajarannya");
  s.addImage({ path: A + "hp_walikota.jpg", x: M, y: 1.75, w: 2.35, h: 5.08, shadow: bayang() });
  const X = M + 2.75, Wq = 5.3;
  kartu(s, X, 1.75, Wq, 2.75, { isi: C.text2, nama: "kutipanwk" });
  teks(s, "“Yang terpenting bagi saya adalah kepastian: ke mana saya harus hadir, kapan, dan siapa yang menyiapkannya.”", X + 0.3, 1.98, Wq - 0.6, 1.6, { fontSize: 18, italic: true, color: C.background1 });
  teks(s, "dr. H. Khairul, M.Kes. — Wali Kota Tarakan", X + 0.3, 3.85, Wq - 0.6, 0.4, { fontSize: 13, bold: true, color: C.accent1 });
  kartu(s, X, 4.72, Wq, 2.1, { isi: C.background2, nama: "kutipanajudan" });
  teks(s, "“Perubahan jadwal yang mendadak pun tidak lagi terlewat.”", X + 0.3, 4.95, Wq - 0.6, 0.85, { fontSize: 16, italic: true, color: C.text2 });
  teks(s, "Muhammad Rizky Dinata Putra, S.Tr.IP. — Ajudan Wakil Wali Kota", X + 0.3, 5.9, Wq - 0.6, 0.7, { fontSize: 12, bold: true, color: C.accent5 });
  const XA = X + Wq + 0.3, WA = W - M - XA;
  const angka = [["62", "kegiatan didisposisikan Wali Kota kepada Wakil langsung dari aplikasi"], ["341", "konfirmasi kehadiran oleh ajudan"], ["67", "tindakan Pelaksana Harian tercatat atas nama pelakunya"], ["37", "perangkat dengan notifikasi aktif, milik 21 pengguna"]];
  angka.forEach(([a, k], i) => {
    const y = 1.75 + i * 1.29;
    teks(s, a, XA, y, WA, 0.55, { fontSize: 30, bold: true, color: C.text2 });
    teks(s, k, XA, y + 0.55, WA, 0.6, { fontSize: 12, color: C.accent5 });
  });
  s.addNotes("Bacakan satu kutipan Wali Kota. Lalu: 62 kegiatan didisposisikan langsung dari aplikasi, 341 konfirmasi ajudan, 67 tindakan Pelaksana Harian tercatat, dan notifikasi aktif di 37 perangkat. (±25 detik)");
}

// ══ Fitur lain: kanal publik ══════════════════════════════════════
bagian("Fitur lain: kanal publik");
{
  const s = isi("FITUR LAIN  ·  MANFAAT BAGI MASYARAKAT", "Kanal publik: warga dan instansi mengurus sendiri, tanpa akun");
  teks(s, "Terpisah dari alur agenda Pimpinan, kanal ini melayani masyarakat dan instansi lewat peramban.", M, 1.5, W - 2 * M, 0.4, { fontSize: 14, color: C.accent5 });
  const dua = [
    ["Peminjaman ruang rapat", "123", "pengajuan dari 66 instansi", ["98 disetujui, total 3.023 peserta kegiatan", "Kalender ketersediaan terbuka untuk umum", "Hanya keterpakaian slot; tanpa identitas atau kontak pemohon"]],
    ["Permohonan audiensi", "55", "permohonan dari 53 instansi", ["48 telah selesai diproses", "31 di antaranya menjadi agenda Pimpinan", "Pemberitahuan berjenjang; Pimpinan tidak diganggu per permohonan"]],
  ];
  const cw = (W - 2 * M - 0.3) / 2;
  dua.forEach(([j, a, k, butir], i) => {
    const x = M + i * (cw + 0.3);
    kartu(s, x, 2.1, cw, 3.2, { isi: i === 0 ? C.background2 : C.text2, nama: "kanal" + (i + 1) });
    teks(s, j, x + 0.35, 2.3, cw - 0.7, 0.4, { fontSize: 17, bold: true, color: i === 0 ? C.text2 : C.accent1 });
    teks(s, a, x + 0.35, 2.75, 1.8, 0.95, { fontSize: 54, bold: true, color: i === 0 ? C.text2 : C.background1 });
    teks(s, k, x + 2.1, 2.95, cw - 2.4, 0.7, { fontSize: 14, color: i === 0 ? C.accent5 : C.accent6, valign: "middle" });
    teks(s, butir.map((b, n) => ({ text: b, options: { bullet: true, breakLine: n < butir.length - 1 } })), x + 0.35, 3.85, cw - 0.7, 1.35, { fontSize: 13, color: i === 0 ? C.text1 : C.background1, paraSpaceAfter: 5 });
  });
  kartu(s, M, 5.55, W - 2 * M, 1.05, { isi: "FFFFFF", garis: C.accent6, nama: "kode" });
  bulat(s, M + 0.3, 5.82, 0.5, C.accent1, "#", C.text2);
  teks(s, [{ text: "Kode penelusuran  ", options: { bold: true, color: C.text2 } }, { text: "Pemohon memantau statusnya sendiri dengan kode, tanpa datang atau menelepon berulang. Layanan ini selaras dengan UU 25/2009 tentang Pelayanan Publik.", options: { color: C.text1 } }], M + 1.0, 5.55, W - 2 * M - 1.3, 1.05, { fontSize: 14, valign: "middle" });
  s.addNotes("Sampaikan sebagai fitur tersendiri, bukan bagian dari alur agenda. Peminjaman ruangan: 123 pengajuan dari 66 instansi, 98 disetujui. Audiensi: 55 permohonan dari 53 instansi, 48 selesai diproses, 31 menjadi agenda Pimpinan. Pemohon memantau dengan kode penelusuran. Data per 24 September 2026. (±30 detik)");
}

// ══ 9. Pemanfaatan sumber daya ═════════════════════════════════════
bagian("Pemanfaatan sumber daya");
{
  const s = isi("PEMANFAATAN SUMBER DAYA  ·  15%", "Dibangun tim sendiri, tanpa belanja pengadaan");
  const baris = [
    ["Pengembangan", "Swakelola oleh Ketua Tim", "Rp0"],
    ["Peladen", "12 fungsi tanpa server, kuota tanpa biaya", "Rp0"],
    ["Basis data", "Layanan terkelola, paket tanpa biaya", "Rp0"],
    ["Kalender bersama", "Akun layanan atas nama instansi", "Rp0"],
    ["Perangkat", "Telepon pintar pengguna, tanpa toko aplikasi", "Rp0"],
    ["Pesan WhatsApp", "Gerbang pesan", "Langganan"],
  ];
  const Wt = 7.1;
  s.addTable([
    [{ text: "Komponen", options: { bold: true, color: C.background1, fill: { color: HEX.dk2 } } }, { text: "Pemanfaatan", options: { bold: true, color: C.background1, fill: { color: HEX.dk2 } } }, { text: "Biaya", options: { bold: true, color: C.background1, fill: { color: HEX.dk2 }, align: "right" } }],
    ...baris.map(([a, b, c], i) => [
      { text: a, options: { bold: true, color: C.text2, fill: { color: i % 2 ? "FFFFFF" : HEX.lt2 } } },
      { text: b, options: { color: C.text1, fill: { color: i % 2 ? "FFFFFF" : HEX.lt2 } } },
      { text: c, options: { bold: true, color: c === "Rp0" ? C.accent3 : C.accent5, align: "right", fill: { color: i % 2 ? "FFFFFF" : HEX.lt2 } } },
    ]),
  ], { x: M, y: 1.8, w: Wt, colW: [1.95, 3.85, 1.3], fontSize: 14, fontFace: "Arial", border: { type: "none" }, rowH: 0.58, valign: "middle", margin: [0, 0.12, 0, 0.12] });
  teks(s, "Efisiensi: ketika lalu lintas data mencapai 6,4 GB/bulan (kuota 5 GB), pengambilan data diubah hanya untuk data yang berubah — turun ke ±1 GB.", M, 6.0, Wt, 0.7, { fontSize: 13, color: C.accent5 });
  const X = M + Wt + 0.4, Wb = W - M - X;
  const tim = [["5 orang", "Tim inovasi: perancang, penyelia, penguji"], ["42 orang", "Tim Koordinasi lintas unit (Keputusan Sekda)"], ["DKISP", "Memfasilitasi subdomain resmi prokopim.tarakankota.go.id"]];
  tim.forEach(([a, k], i) => {
    const y = 1.8 + i * 1.12;
    kartu(s, X, y, Wb, 0.95, { isi: C.background2, nama: "tim" + (i + 1) });
    teks(s, a, X + 0.25, y, 1.6, 0.95, { fontSize: 20, bold: true, color: C.text2, valign: "middle" });
    teks(s, k, X + 1.85, y, Wb - 2.05, 0.95, { fontSize: 13, color: C.text1, valign: "middle" });
  });
  kartu(s, X, 5.25, Wb, 1.45, { isi: C.text2, nama: "keberlanjutan" });
  teks(s, "KEBERLANJUTAN", X + 0.25, 5.4, Wb - 0.5, 0.3, { fontSize: 12, bold: true, color: C.accent1, charSpacing: 1 });
  teks(s, "11 SOP  ·  Pelaksana Harian  ·  kode dan riwayat lengkap tersimpan  ·  alih pengetahuan ke pengelola kedua 2027", X + 0.25, 5.72, Wb - 0.5, 0.9, { fontSize: 14, color: C.background1 });
  s.addNotes("Jawab lebih dulu pertanyaan 'bila Kabag dimutasi': kewenangan melekat pada jabatan, 11 SOP, kode dan riwayat tersimpan lengkap, akun layanan atas nama instansi, pengelola kedua didampingi mulai 2027. Biaya berjalan mendekati nol. (±40 detik)");
}

// ══ 10. Diseminasi ═════════════════════════════════════════════════
bagian("Diseminasi inovasi");
{
  const s = isi("DISEMINASI INOVASI  ·  10%", "Dipakai melampaui Bagian Prokopim, siap direplikasi");
  const lingkar = [["40 akun", "14 jenis peran pengguna"], ["21 akun", "di luar Bagian: Pimpinan, ajudan, pengawal, mitra DKISP"], ["66 + 53", "instansi memakai kanal publik ruangan dan audiensi"], ["42 orang", "Tim Koordinasi lintas perangkat daerah"]];
  const cw = 2.85;
  lingkar.forEach(([a, k], i) => {
    const x = M + (i % 2) * (cw + 0.25), y = 1.8 + Math.floor(i / 2) * 2.1;
    kartu(s, x, y, cw, 1.85, { isi: i === 1 ? C.text2 : C.background2, nama: "jangkauan" + (i + 1) });
    teks(s, a, x + 0.25, y + 0.2, cw - 0.5, 0.6, { fontSize: 28, bold: true, color: i === 1 ? C.accent1 : C.text2 });
    teks(s, k, x + 0.25, y + 0.85, cw - 0.5, 0.9, { fontSize: 13, color: i === 1 ? C.background1 : C.accent5 });
  });
  teks(s, [{ text: "Siap direplikasi sesuai kebutuhan: ", options: { bold: true } }, { text: "cukup peramban, kuota tanpa biaya, dan 11 SOP yang dapat diadaptasi.", options: {} }], M, 6.05, 2 * cw + 0.25, 0.7, { fontSize: 14, color: C.text2 });
  // Peta jalan
  const X = M + 2 * cw + 0.75, Wr = W - M - X;
  teks(s, "Pelembagaan dan rencana", X, 1.8, Wr, 0.4, { fontSize: 18, bold: true, color: C.text2 });
  const jalan = [
    ["Maret 2026", "Mulai digunakan; Surat Sekda 12 Maret 2026 memohon subdomain resmi prokopim.tarakankota.go.id"],
    ["Okt–Des 2026", "Pengesahan 11 SOP oleh Sekretaris Daerah, disesuaikan dengan nomenklatur baru"],
    ["Jan–Jun 2027", "Pendampingan pengelola kedua; dokumentasi teknis"],
  ];
  s.addShape(pres.shapes.LINE, { x: X + 0.21, y: 2.6, w: 0, h: 3.6, line: { color: C.accent6, width: 2 } });
  jalan.forEach(([t, k], i) => {
    const y = 2.45 + i * 1.35;
    bulat(s, X, y, 0.42, i === 0 ? C.accent1 : C.text2, String(i + 1), i === 0 ? C.text2 : C.background1);
    teks(s, t, X + 0.65, y - 0.02, Wr - 0.65, 0.4, { fontSize: 15, bold: true, color: C.text2 });
    teks(s, k, X + 0.65, y + 0.38, Wr - 0.65, 0.85, { fontSize: 14, color: C.text1 });
  });
  s.addNotes("Penyebarluasan: 21 akun di luar Bagian, kanal publik dipakai 66 dan 53 instansi, Tim Koordinasi lintas perangkat daerah. Inovasi ini siap direplikasi sesuai kebutuhan: yang disesuaikan hanya nama jabatan, pengguna, dan tata naskah. Sebelas SOP disahkan Sekretaris Daerah pada Oktober–Desember 2026, disesuaikan dengan nomenklatur baru. (±30 detik)");
}

// ══ 11. Kompatibilitas ═════════════════════════════════════════════
bagian("Kompatibilitas");
{
  const s = isi("KOMPATIBILITAS  ·  5%", "Selaras regulasi, visi daerah, dan cara kerja Pimpinan");
  const kol = [
    ["Regulasi", ["UU 25/2009 Pelayanan Publik", "UU 9/2010 Keprotokolan", "PP 38/2017 Inovasi Daerah", "Perpres 95/2018 SPBE", "PermenPAN-RB 35/2012 (dasar 11 SOP)"]],
    ["Visi dan misi daerah", ["RPJMD Kaltara 2025–2029, Misi 3: transformasi tata kelola yang kolaboratif dan inovatif", "RPJMD Kota Tarakan, Misi 4: tata kelola pemerintahan", "Semboyan \"Tarakan HIBOT\" — hibot berarti hebat dalam bahasa Tidung"]],
    ["Kebutuhan pengguna", ["Naskah sambutan tetap tersedia tercetak, sesuai kebiasaan Pimpinan", "Kewenangan melekat pada jabatan, bukan orang", "WA hanya untuk yang perlu bertindak", "Jam acara mengikuti zona tempat Pimpinan berada"]],
  ];
  const kw = (W - 2 * M - 2 * 0.3) / 3;
  kol.forEach(([j, butir], i) => {
    const x = M + i * (kw + 0.3);
    kartu(s, x, 1.8, kw, 4.4, { isi: i === 1 ? C.text2 : C.background2, nama: "kompat" + (i + 1) });
    teks(s, j, x + 0.3, 2.0, kw - 0.6, 0.45, { fontSize: 18, bold: true, color: i === 1 ? C.accent1 : C.text2, fit: "none" });
    teks(s, butir.map((b, n) => ({ text: b, options: { bullet: true, breakLine: n < butir.length - 1 } })), x + 0.3, 2.6, kw - 0.55, 4.0, { fontSize: 14, color: i === 1 ? C.background1 : C.text1, paraSpaceAfter: 9 });
  });
  s.addNotes("Kompatibilitas: dasar regulasi pelayanan publik, keprotokolan, inovasi daerah, SPBE; selaras Misi 3 RPJMD Kaltara dan Misi 4 Kota Tarakan. Aplikasi menyesuaikan cara kerja Pimpinan — contohnya naskah sambutan tetap tercetak. (±30 detik)");
}

// ══ 12. Penutup ════════════════════════════════════════════════════
bagian("Penutup");
{
  const s = pres.addSlide({ masterName: "GELAP", sectionTitle: BAGIAN });
  logo(s);
  teks(s, "Satu alur.\nSatu data.\nSetiap keputusan tercatat.", M, 1.85, 8.4, 2.9, { fontSize: 42, bold: true, color: C.background1, paraSpaceAfter: 4 });
  teks(s, "Terima kasih", M, 5.0, 7.6, 0.6, { fontSize: 24, color: C.accent1 });
  teks(s, "Tim Inovasi Prokopim Hibot  ·  Bagian Protokol dan Komunikasi Pimpinan, Setda Kota Tarakan", M, 5.65, 7.8, 0.4, { fontSize: 13, color: C.accent6 });
  kartu(s, 9.3, 1.6, 3.43, 4.35, { isi: "FFFFFF", nama: "qr" });
  s.addImage({ path: A + "qr.png", x: 9.62, y: 1.9, w: 2.8, h: 2.8 });
  teks(s, "prokopim.tarakankota.go.id", 9.45, 4.9, 3.13, 0.4, { fontSize: 14, bold: true, color: C.text2, align: "center" });
  teks(s, "Akses juri baca-saja tersedia saat demonstrasi", 9.45, 5.3, 3.13, 0.5, { fontSize: 11, color: C.accent5, align: "center" });
  s.addNotes("Penutup: 'Satu alur. Satu data. Setiap keputusan tercatat.' Terima kasih. Tawarkan akun juri baca-saja bila juri ingin mencoba.");
}

// ══ 13. Cadangan penjelasan: yang berubah sejak proposal ════════════
bagian("Cadangan penjelasan");
{
  const s = isi("CADANGAN PENJELASAN  ·  JIKA DITANYA", "Sejak proposal, inovasi ini terus disempurnakan");
  teks(s, "Proposal memuat keadaan per 24 September 2026. Pembaruan Oktober 2026 berikut berangkat dari pemakaian dan masukan pengguna.", M, 1.5, W - 2 * M, 0.4, { fontSize: 13, color: C.accent5 });
  const unsur = [
    ["Pengingat dirampingkan", "Proposal: lima kali sehari. Kini tiga waktu (06.30, 07.30, 16.00) ditambah kabar seketika, berdasarkan data pemakaian agar pesan tidak berulang."],
    ["WhatsApp hanya yang perlu", "Pesan WhatsApp hanya untuk acara hari ini atau besok; selebihnya lewat notifikasi aplikasi, sehingga tidak ada pesan penting yang tenggelam."],
    ["Pemberitahuan tamu berjenjang", "Pimpinan menerima ringkasan pagi, bukan kabar per permohonan, dengan jam tenang 21.00–06.00. Admin dapat mengirim ulang pemberitahuan ke tamu dengan jeda anti-spam."],
    ["Monitor WA", "Meteran dan arsip pesan keluar dengan status terkirim atau dibaca, peringatan dini bila gagal beruntun. Isi pesan dihapus setelah 90 hari; OTP tidak disimpan."],
    ["Masuk lebih mudah dan aman", "Sidik jari atau wajah (passkey) dan akun Google, tetap hanya untuk akun yang didaftarkan Admin. Kebijakan privasi dan ketentuan mengikuti UU 27/2022."],
    ["Jam acara mengikuti zona", "Acara di zona WIB, WITA, atau WIT ditulis menurut undangan dan ditampilkan menurut tempat pengguna, sehingga jam tidak lagi tertukar."],
  ];
  const gw = (W - 2 * M - 2 * 0.25) / 3, gh = 2.0, top = 1.95;
  unsur.forEach(([j, k], i) => {
    const x = M + (i % 3) * (gw + 0.25), y = top + Math.floor(i / 3) * (gh + 0.2);
    kartu(s, x, y, gw, gh, { isi: C.background2, nama: "baru" + (i + 1) });
    bulat(s, x + 0.2, y + 0.18, 0.4, C.text2, String(i + 1), C.accent1);
    teks(s, j, x + 0.75, y + 0.18, gw - 0.95, 0.4, { fontSize: 15, bold: true, color: C.text2, valign: "middle" });
    teks(s, k, x + 0.2, y + 0.68, gw - 0.4, gh - 0.75, { fontSize: 12, color: C.text1 });
  });
  kartu(s, M, 6.2, W - 2 * M, 0.7, { isi: C.text2, nama: "nilaitambah" });
  teks(s, [
    { text: "Nilai tambah  ", options: { bold: true, color: C.accent1 } },
    { text: "Setiap pembaruan berangkat dari kendala pengguna, dikerjakan tim sendiri tanpa belanja pengadaan, dan dicatat dalam riwayat perubahan aplikasi.", options: { color: C.background1 } },
  ], M + 0.3, 6.2, W - 2 * M - 0.6, 0.7, { fontSize: 13, valign: "middle" });
  s.addNotes("Gunakan hanya bila juri menanyakan perbedaan dengan proposal. Jujur dan ringkas: pengingat lima kali sehari dirampingkan menjadi tiga waktu berdasarkan data pemakaian; WhatsApp hanya untuk acara hari ini atau besok; notifikasi tamu berjenjang; Monitor WA; masuk dengan sidik jari dan Google; jam acara berzona. Semua pembaruan berangkat dari kendala pengguna dan tanpa belanja pengadaan.");
}

(async () => {
  await pres.writeFile({ fileName: KELUAR });
  await applyTheme(KELUAR, THEME);
  console.log("tersimpan", KELUAR);
})();
