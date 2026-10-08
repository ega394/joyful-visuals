/**
 * Pembuat proposal Lomba Inovasi Daerah Kota Tarakan 2026 — Prokopim Hibot,
 * Kategori A (Inovasi Tata Kelola Pemerintahan). Versi Kaltara Innovation
 * Awards tetap dibuat oleh buat-proposal.mjs; berkas ini salinan yang
 * disesuaikan dengan Petunjuk Teknis Lomba Inovasi Daerah Kota Tarakan.
 *
 *   cd docs/lomba/build && npm install && npm run buat:tarakan
 *
 * Menghasilkan docs/lomba/tarakan/Proposal-Tarakan-Prokopim-Hibot.docx dan
 * .pdf. Seluruh angka dibaca dari ../tarakan/data-statistik.json, yaitu
 * keluaran ../STATISTIK-proposal.sql.
 *
 * Ketentuan teknis Petunjuk Teknis (Bab 4.2 dan 4.4): A4, Arial 11 pt, spasi
 * 1,15, paling banyak 20 halaman di luar sampul dan lampiran, PDF paling
 * besar 20 MB. Halaman isi dinomori mulai 1 supaya batas 20 halaman terlihat.
 *
 * Daftar isi dibuat dua lintasan: lintasan pertama dirender ke PDF untuk
 * mencari letak setiap judul, lintasan kedua mengisi nomor halamannya.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType, VerticalAlign,
  Footer, PageNumber, NumberFormat, LevelFormat, TabStopType, SectionType, PageBreak, LineRuleType,
} from "docx";

// Jarak baris selalu dengan aturan "auto". Tanpa aturan eksplisit, LibreOffice
// membacanya sebagai tinggi baris tetap dan memotong gambar sebaris.
const AUTO = LineRuleType.AUTO;

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOMBA = path.resolve(DIR, "..");
const REPO = path.resolve(LOMBA, "../..");
// TANPA_SOP=1 menghasilkan versi tanpa sisipan sebelas SOP (Lampiran 7 hanya
// berisi keterangan bahwa SOP sedang dalam proses pengesahan). Penomoran
// lampiran tetap sama pada kedua versi.
const TANPA_SOP = process.env.TANPA_SOP === "1";
const AKHIRAN = TANPA_SOP ? "-tanpa-SOP" : "";
const TARAKAN = path.join(LOMBA, "tarakan");
// PRIBADI=1 menghasilkan berkas final untuk diunggah: data pribadi ketua tim
// (NIK, tempat/tanggal lahir, alamat) untuk pakta integritas dan pindaian KTP
// (Lampiran 3). Masukan dan keluarannya hanya di docs/lomba/rahasia/tarakan/
// yang dikecualikan dari git; salinan repositori memuat isian kosong.
const RAHASIA = path.join(LOMBA, "rahasia", "tarakan");
const PRIBADI = process.env.PRIBADI === "1" ? JSON.parse(fs.readFileSync(path.join(LOMBA, "rahasia", "pribadi.json"), "utf8")) : null;
const KELUAR = PRIBADI
  ? path.join(RAHASIA, "Proposal-Tarakan-Prokopim-Hibot" + AKHIRAN + "-FINAL")
  : path.join(TARAKAN, "Proposal-Tarakan-Prokopim-Hibot" + AKHIRAN);
// Surat usulan Sekda (ditandatangani elektronik melalui Srikandi) disisipkan
// pada Lampiran 2 bila berkasnya sudah ada.
const SURAT_USULAN_TTE = path.join(TARAKAN, "Surat-Usulan-Sekda-TTE.pdf");

// ═══════════════════════════════════════════════════════════════════
//  ANGKA
// ═══════════════════════════════════════════════════════════════════
const D = JSON.parse(fs.readFileSync(path.join(TARAKAN, "data-statistik.json"), "utf8"));

const n  = (x) => Number(x).toLocaleString("id-ID");
const dk = (x, k = 1) => Number(x).toLocaleString("id-ID", { minimumFractionDigits: k, maximumFractionDigits: k });
const pct = (a, b, k = 1) => dk((a / b) * 100, k) + "%";
const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const BLN3  = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const namaBulan = (k) => `${BULAN[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;
const tglPanjang = (s) => `${+s.slice(8, 10)} ${BULAN[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}`;
const jamMenit = (h) => {
  const m = Math.round(h * 60);
  if (m < 60) return `${m} menit`;
  return `${Math.floor(m / 60)} jam${m % 60 ? ` ${m % 60} menit` : ""}`;
};

const tglData  = D.dihitung_pada.slice(0, 10);
const jamData  = (D.dihitung_pada.match(/(\d{2}):(\d{2})/) || []).slice(1).join(".");
const PER_TGL  = tglPanjang(tglData);                                   // 24 September 2026
const PER_LENGKAP = jamData ? `${PER_TGL} pukul ${jamData} WITA` : PER_TGL;

// Bulan: dari awal implementasi sampai bulan pengambilan data. Kegiatan yang
// sudah terjadwal untuk bulan berikutnya dicatat terpisah.
const bulanKini = tglData.slice(0, 7);
const semuaBulan = Object.keys(D.kegiatan_per_bulan).sort();
const bulanTampil = semuaBulan.filter((k) => k >= "2026-03" && k <= bulanKini);
const terjadwalDepan = semuaBulan.filter((k) => k > bulanKini).reduce((s, k) => s + D.kegiatan_per_bulan[k], 0);
// Bulan penuh: di antara bulan pertama (baru mulai) dan bulan berjalan.
const bulanPenuh = bulanTampil.slice(1).filter((k) => k < bulanKini);
const nilaiPenuh = bulanPenuh.map((k) => D.kegiatan_per_bulan[k]);
const rataBulan = Math.round(nilaiPenuh.reduce((a, b) => a + b, 0) / nilaiPenuh.length);
const bPenuhAwal = bulanPenuh[0], bPenuhAkhir = bulanPenuh.at(-1);
const vAwal = D.kegiatan_per_bulan[bPenuhAwal], vAkhir = D.kegiatan_per_bulan[bPenuhAkhir];
const naik = Math.round(((vAkhir - vAwal) / vAwal) * 100);
const puncakBulan = bulanPenuh.reduce((a, k) => (D.kegiatan_per_bulan[k] > D.kegiatan_per_bulan[a] ? k : a), bulanPenuh[0]);

const T = D.kegiatan_total;
const K = D.kecepatan;
const aksi = D.jejak.per_aksi || {};
const jml = (...ks) => ks.reduce((s, k) => s + (aksi[k] || 0), 0);
const konfirmasiHadir = jml("wk_hadir", "wk_diwakilkan", "wk_tidak_hadir", "wwk_hadir", "wwk_diwakilkan", "wwk_tidak_hadir");
const sambutanKeg = Object.entries(D.jenis_kegiatan).filter(([k]) => /sambutan/i.test(k)).reduce((s, [, v]) => s + v, 0);
const peran = D.pengguna.per_peran;
const jumlahPeran = Object.keys(peran).length;
const akunLuar = ["walikota", "wakilwalikota", "ajudan_walikota", "ajudan_wakilwalikota", "walpri", "mitra_kerja"]
  .reduce((s, k) => s + (peran[k] || 0), 0);
const luarJam = D.penelaahan_waktu.di_luar_jam_kerja, putusanTotal = D.penelaahan_waktu.total;
const cepatLo = Math.round(18 / K.median_ajukan_tayang_jam), cepatHi = Math.round(24 / K.median_ajukan_tayang_jam);

// Masa implementasi: dari kegiatan pertama sampai 1 Oktober 2026, tanggal
// patokan syarat paling singkat 3 bulan pada Petunjuk Teknis.
function selisihBulanHari(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number), [y2, m2, d2] = b.split("-").map(Number);
  let bulan = (y2 - y1) * 12 + (m2 - m1), hari = d2 - d1;
  if (hari < 0) { bulan -= 1; hari += new Date(y2, m2 - 1, 0).getDate(); }
  return { bulan, hari };
}
const masa = selisihBulanHari(D.tanggal_kegiatan.awal, "2026-10-01");
const MASA = `${masa.bulan} bulan ${masa.hari} hari`;

// Riwayat pengembangan dari git (bila tersedia).
let pembaruan = null, hariKembang = null;
try {
  const log = execFileSync("git", ["log", "--format=%ad", "--date=short", "origin/main"], { cwd: REPO, encoding: "utf8" })
    .trim().split("\n").filter((t) => t >= "2026-03-01");
  pembaruan = log.length; hariKembang = new Set(log).size;
} catch { /* tanpa git: kalimatnya dilewati */ }
const bulatBawah = (x, k) => Math.floor(x / k) * k;

// ═══════════════════════════════════════════════════════════════════
//  TATA LETAK
// ═══════════════════════════════════════════════════════════════════
const FONT = "Arial";
const CM = 567;
const MARGIN = { top: Math.round(2.5 * CM), bottom: Math.round(2.5 * CM), left: 3 * CM, right: Math.round(2.5 * CM) };
const LEBAR = 11906 - MARGIN.left - MARGIN.right;        // lebar isi, DXA
const UK = 22, UK_TABEL = 20, UK_KECIL = 18;             // setengah-poin
const HITAM = "000000", ABU = "D9D9D9", ABU_MUDA = "F2F2F2";

// Penanda isian yang wajib dilengkapi sebelum diunggah: [[...]] → sorot kuning.
function runs(teks, dasar = {}) {
  const out = [];
  for (const bag of String(teks).split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[\[[^\]]+\]\])/g)) {
    if (!bag) continue;
    if (bag.startsWith("**")) out.push(new TextRun({ ...dasar, text: bag.slice(2, -2), bold: true }));
    else if (bag.startsWith("[[")) out.push(new TextRun({ ...dasar, text: bag.slice(2, -2), highlight: "yellow" }));
    else if (bag.startsWith("*")) out.push(new TextRun({ ...dasar, text: bag.slice(1, -1), italics: true }));
    else out.push(new TextRun({ ...dasar, text: bag }));
  }
  return out;
}

const P = (teks, o = {}) => new Paragraph({
  alignment: o.align ?? AlignmentType.JUSTIFIED,
  indent: o.indent === false ? undefined : { firstLine: o.indent ?? CM },
  spacing: { after: o.after ?? 100, before: o.before ?? 0, line: 276, lineRule: AUTO },
  keepNext: o.keepNext,
  children: runs(teks, { size: o.size ?? UK, font: FONT }),
});
const PN = (teks, o = {}) => P(teks, { ...o, indent: false });   // tanpa inden
const catatan = (teks) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED, spacing: { before: 40, after: 140, line: 250, lineRule: AUTO },
  children: runs(teks, { size: UK_KECIL, italics: true, font: FONT }),
});

const H1 = (teks) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun({ text: teks, font: FONT })] });
const H2 = (teks) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text: teks, font: FONT })] });

let nomorDaftar = 0;
function daftar(ref, butir, o = {}) {
  const inst = ++nomorDaftar;
  return butir.map((b) => new Paragraph({
    numbering: { reference: ref, level: 0, instance: inst },
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: o.after ?? 60, line: 276, lineRule: AUTO },
    children: runs(b, { size: UK, font: FONT }),
  }));
}
const butir = (x, o) => daftar("butir", x, o);
const huruf = (x, o) => daftar("huruf", x, o);
const angka = (x, o) => daftar("angka", x, o);

// ── Tabel ──────────────────────────────────────────────────────────
let nomorTabel = 0, nomorGambar = 0, awalanTabel = "";
const garis = { style: BorderStyle.SINGLE, size: 4, color: HITAM };
const semuaGaris = { top: garis, bottom: garis, left: garis, right: garis };
const tanpaGaris = { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } };

function sel(isi, lebar, o = {}) {
  const baris = Array.isArray(isi) ? isi : [isi];
  return new TableCell({
    width: { size: lebar, type: WidthType.DXA },
    borders: o.borders ?? semuaGaris,
    shading: o.shade ? { fill: o.shade, type: ShadingType.CLEAR, color: "auto" } : undefined,
    verticalAlign: o.vAlign ?? VerticalAlign.TOP,
    margins: { top: 40, bottom: 40, left: 90, right: 90 },
    columnSpan: o.span,
    children: baris.map((t) => new Paragraph({
      alignment: o.align ?? AlignmentType.LEFT,
      spacing: { after: 0, line: 240, lineRule: AUTO },
      children: runs(t, { size: o.size ?? UK_TABEL, bold: o.bold, font: FONT }),
    })),
  });
}

function judulTabel(teks) {
  return new Paragraph({
    alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 },
    children: [new TextRun({ text: `Tabel ${awalanTabel}${++nomorTabel}. ${teks}`, bold: true, size: UK_TABEL, font: FONT })],
  });
}

/**
 * kolom: lebar relatif; baris: larik sel (string atau {t, bold, shade, align, span}).
 * Baris pertama menjadi kepala tabel kecuali kepala:false.
 */
function tabel({ judul, kolom, baris, sumber, kepala = true, ukuran = UK_TABEL, rataTengah = [] }) {
  const total = kolom.reduce((a, b) => a + b, 0);
  const lebar = kolom.map((k) => Math.floor((k / total) * LEBAR));
  lebar[lebar.length - 1] += LEBAR - lebar.reduce((a, b) => a + b, 0);
  const rows = baris.map((r, i) => {
    const isKepala = kepala && i === 0;
    let c = 0;
    const cells = r.map((isi) => {
      const o = typeof isi === "object" && !Array.isArray(isi) ? isi : { t: isi };
      const span = o.span || 1;
      const w = lebar.slice(c, c + span).reduce((a, b) => a + b, 0);
      const cellIdx = c; c += span;
      return sel(o.t, w, {
        span: span > 1 ? span : undefined,
        bold: isKepala || o.bold, size: ukuran,
        shade: isKepala ? ABU : o.shade,
        align: isKepala ? AlignmentType.CENTER : (o.align ?? (rataTengah.includes(cellIdx) ? AlignmentType.CENTER : AlignmentType.LEFT)),
        vAlign: isKepala ? VerticalAlign.CENTER : VerticalAlign.TOP,
      });
    });
    return new TableRow({ children: cells, tableHeader: isKepala, cantSplit: true });
  });
  const out = [];
  if (judul) out.push(judulTabel(judul));
  out.push(new Table({ width: { size: LEBAR, type: WidthType.DXA }, columnWidths: lebar, rows }));
  out.push(sumber ? catatan(sumber) : new Paragraph({ spacing: { after: 100 }, children: [] }));
  return out;
}

const gambar = (file, lebarPx) => {
  const data = fs.readFileSync(path.join(REPO, "public", file));
  return new ImageRun({ type: "png", data, transformation: { width: lebarPx, height: lebarPx } });
};

// Alur penetapan jadwal sebagai bagan kotak-panah.
function bagan(kotak, keterangan, judul) {
  const panah = 420;
  const lebarKotak = Math.floor((LEBAR - panah * (kotak.length - 1)) / kotak.length);
  const kol = [];
  kotak.forEach((_, i) => { kol.push(lebarKotak); if (i < kotak.length - 1) kol.push(panah); });
  kol[kol.length - 1] += LEBAR - kol.reduce((a, b) => a + b, 0);
  const cells = [];
  kotak.forEach(([atas, bawah], i) => {
    cells.push(sel([`**${atas}**`, bawah], kol[cells.length], { shade: i === kotak.length - 1 ? "E2EFDA" : "DEEAF6", align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER, size: UK_TABEL }));
    if (i < kotak.length - 1) cells.push(sel("→", kol[cells.length], { borders: tanpaGaris, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER, size: 28, bold: true }));
  });
  return [
    new Table({ width: { size: LEBAR, type: WidthType.DXA }, columnWidths: kol, rows: [new TableRow({ children: cells, cantSplit: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 20 }, children: runs(keterangan, { size: UK_KECIL, italics: true, font: FONT }) }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 140 }, children: [new TextRun({ text: `Gambar ${++nomorGambar}. ${judul}`, bold: true, size: UK_TABEL, font: FONT })] }),
  ];
}

// ═══════════════════════════════════════════════════════════════════
//  NASKAH
// ═══════════════════════════════════════════════════════════════════
const NOMOR_SURAT_SEKDA = "300.2.10/265/SETDA/2026";
const SK_SEKDA = "100.3.3.6/98/HK/VIII/2026";
const SE_WALIKOTA = "000.7.2.4/70/Bappeda Litbang/2026";
const JUDUL = "PROKOPIM HIBOT";
const SUBJUDUL = "Superapp Pelayanan Keprotokolan dan Komunikasi Pimpinan Pemerintah Kota Tarakan";
const KATEGORI = "Kategori A. Inovasi Tata Kelola Pemerintahan";
const BIDANG_FOKUS = "Tata kelola pemerintahan yang adaptif dan responsif (Misi 4 RPJMD Kota Tarakan 2025–2029)";
const TIM = [
  ["Anugrah Yega Pranatha, M.Si.", "Kepala Bagian Protokol dan Komunikasi Pimpinan", "Ketua", "Ketua tim; penggagas; perancang alur kerja dan aturan kewenangan; pengembang aplikasi secara swakelola; penanggung jawab pendaftaran"],
  ["Saifullah, S.H.", "Kepala Sub Bagian Protokol", "Anggota", "Penyelia penerapan pada alur keprotokolan; penguji; pemberi pertimbangan rancangan"],
  ["Juliyanti, S.AP.", "Kepala Sub Bagian Komunikasi dan Dokumentasi Pimpinan", "Anggota", "Penyelia penerapan pada alur komunikasi dan dokumentasi; penguji; pemberi pertimbangan rancangan"],
  ["Pebriadi Banne, S.IP.", "Pengelola Layanan Operasional", "Anggota", "Pelaksana dan penguji di lapangan; penghimpun kendala pemakaian sehari-hari"],
  ["Nuraini Wiliadewi, S.IP.", "Penelaah Teknis Kebijakan", "Anggota", "Pelaksana dan penguji di lapangan; penghimpun kendala pemakaian sehari-hari"],
];

// Konsep keterangan — wajib dibaca, disesuaikan, dan ditandatangani sendiri
// oleh narasumber sebelum diunggah.
const isiTestimoni = [
    "Sebelumnya saya menerima rencana kegiatan dalam bentuk cetakan yang kerap berubah, sehingga kepastian sebuah acara sering harus saya tanyakan kembali kepada ajudan. Sejak Prokopim Hibot digunakan, agenda yang telah disetujui dapat saya lihat langsung di telepon genggam dan selalu dalam keadaan terbaru. Kegiatan yang perlu diwakilkan dapat saya disposisikan kepada Wakil Wali Kota langsung dari aplikasi, tanpa menunggu surat atau pesan berantai. Yang terpenting bagi saya adalah kepastian: ke mana saya harus hadir, kapan, dan siapa yang menyiapkannya.",
    "Dahulu saya mengetahui agenda Bapak Wakil Wali Kota dari foto disposisi dan pesan di grup percakapan yang sering datang terlambat atau tidak lengkap, sehingga bahan dan pakaian kerap disiapkan terburu-buru. Sekarang setiap agenda yang ditetapkan untuk Wakil Wali Kota langsung sampai sebagai pemberitahuan, lengkap dengan lokasi, pakaian, dan narahubung penyelenggara. Pengingat sehari sebelumnya membantu saya menyiapkan keperluan lebih awal, dan kesediaan hadir Pimpinan cukup saya konfirmasikan melalui aplikasi. Perubahan jadwal yang mendadak pun tidak lagi terlewat.",
    "Dahulu penugasan disampaikan secara lisan atau melalui pesan pribadi, dan pernah terjadi saya baru mengetahui ditugaskan menjelang acara dimulai. Sekarang penugasan langsung masuk ke aplikasi dan WhatsApp saya, dan pemberitahuan hanya dikirim apabila penugasan saya berubah, sehingga tidak ada pesan penting yang tenggelam. Rekap agenda setiap pagi membuat saya dapat menyiapkan diri sejak awal hari, dan catatan kinerja saya tersedia tanpa perlu menyusunnya sendiri.",
  "Ketika ditunjuk sebagai Pelaksana Harian, saya dapat langsung menjalankan kewenangan jabatan yang saya ampu melalui aplikasi tanpa menunggu pejabat definitif kembali, sehingga jadwal Pimpinan tetap diproses tepat waktu. Kewenangan itu hanya berlaku selama masa yang tercantum pada Surat Perintah dan berakhir dengan sendirinya, sehingga saya tidak khawatir melampaui batas tugas. Setiap keputusan yang saya ambil tercatat atas nama saya beserta keterangan jabatan yang diampu, sehingga pertanggungjawabannya jelas.",
];

// Judul bab — dipakai juga oleh daftar isi dan pencarian nomor halaman.
const BAB = {
  b2:  "2. RINGKASAN EKSEKUTIF",
  b3:  "3. PROFIL INOVATOR/TIM",
  b4:  "4. LATAR BELAKANG DAN ANALISIS MASALAH",
  b5:  "5. KESELARASAN DENGAN RPJMD",
  b6:  "6. DESKRIPSI DAN KEBARUAN",
  b7:  "7. PELAKSANAAN INOVASI",
  b8:  "8. SUMBER DAYA DAN KOLABORASI",
  b9:  "9. HASIL, MANFAAT, DAN BUKTI DAMPAK",
  b10: "10. KEBERLANJUTAN DAN PELEMBAGAAN",
  b11: "11. REPLIKASI, PERLUASAN, DAN DISEMINASI",
  b12: "12. LAMPIRAN",
};
const SUB = {};   // diisi saat H2 dibuat, untuk daftar isi
const urutanJudul = [];
const h1 = (k) => { urutanJudul.push({ tingkat: 1, teks: BAB[k] }); return H1(BAB[k]); };
const h2 = (teks) => { urutanJudul.push({ tingkat: 2, teks }); return H2(teks); };

function isi() {
  const out = [];
  const tambah = (...x) => out.push(...x.flat());

  // ── 2. RINGKASAN EKSEKUTIF ──────────────────────────────────────
  tambah(h1("b2"));
  tambah(P(`Bagian Protokol dan Komunikasi Pimpinan (Bagian Prokopim) Sekretariat Daerah Kota Tarakan memiliki tugas antara lain menyusun, memeriksa, dan mengawal agenda Wali Kota dan Wakil Wali Kota. Volume yang ditangani rata-rata mencapai 2–3 kegiatan per hari atau dalam rentang 60–100 kegiatan setiap bulan (estimasi sebelum 2026), dan setiap kegiatan melewati paling sedikit tiga jenjang pemeriksaan sebelum ditetapkan.`));
  tambah(P(`**Masalah.** Sampai awal tahun 2026 seluruh proses tersebut berjalan secara manual. Rencana kegiatan disusun pada *spreadsheet* lalu dicetak, penelaahan hanya dapat dilakukan dalam satu jendela waktu sekitar 30 menit menjelang jam pulang kantor, dokumen disposisi diteruskan dalam bentuk foto melalui grup percakapan, dan penugasan petugas bergantung pada ingatan perorangan. Pada praktiknya, pola demikian ini sangat bergantung pada kecermatan dan kejelian pegawai. Pada Januari 2026, satu lembar disposisi agenda tidak ikut terkirim tanpa ada pihak yang dapat mengetahuinya. Peristiwa itu memperlihatkan akar masalahnya, yaitu tidak tersedianya satu sumber data yang sahih dan dapat diperiksa oleh semua pihak yang memiliki kewenangan.`));
  tambah(P(`**Solusi.** Prokopim Hibot adalah *superapp* pelayanan keprotokolan dan komunikasi pimpinan: satu aplikasi web progresif yang menyatukan sebelas alur kerja dalam satu data dan satu pintu, mulai dari penetapan jadwal berjenjang, penugasan petugas, pelayanan audiensi dan peminjaman ruangan, penerbitan undangan siap tanda tangan elektronik, sampai daftar hadir digital dan evaluasi kinerja petugas. Wali Kota dan Wakil Wali Kota, ajudan, pejabat, petugas, dan masyarakat masing-masing mendapat tampilan sesuai perannya dari data yang sama. Setiap perpindahan status terekam dalam jejak audit beserta nama pelaku dan waktunya, sehingga setiap keputusan atas agenda Pimpinan dapat ditelusuri kembali.`));
  tambah(P(`**Pelaksanaan.** Aplikasi mulai digunakan pada Maret 2026. Kegiatan pertama tercatat pada ${tglPanjang(D.tanggal_kegiatan.awal)}, dan penggunaannya dikuatkan Surat Sekretaris Daerah Kota Tarakan Nomor ${NOMOR_SURAT_SEKDA} tanggal 12 Maret 2026. Per 1 Oktober 2026 inovasi ini telah berjalan ${MASA}, melampaui syarat paling singkat 3 bulan. Pelaksanaannya didukung Keputusan Sekretaris Daerah Kota Tarakan Nomor ${SK_SEKDA} dan sebelas standar operasional prosedur (SOP).`));
  tambah(P(`**Penerima manfaat.** Sebanyak ${D.pengguna.aktif} pemegang akun aktif pada ${jumlahPeran} jenis peran, meliputi Pimpinan Daerah, ajudan, pengawal pribadi, pejabat struktural, petugas protokol dan dokumentasi, serta mitra kerja lintas unit, termasuk Dinas Komunikasi, Informatika, Statistik dan Persandian. Masyarakat dan instansi memanfaatkan kanal publiknya: permohonan audiensi datang dari ${D.tamu.instansi_berbeda} instansi dan layanan peminjaman ruangan telah dipakai oleh ${D.ruang.instansi_berbeda} instansi.`));
  tambah(P(`**Bukti dampak.** Capaian utama ditunjukkan pada Tabel 1.`, { keepNext: true }));
  tambah(tabel({
    judul: `Capaian utama per ${PER_TGL}`,
    kolom: [58, 42],
    baris: [
      ["Indikator", "Capaian"],
      ["Kegiatan Pimpinan yang terkelola", `${n(T)} kegiatan`],
      ["Waktu dari pengajuan sampai jadwal tayang (median)", `${dk(K.median_ajukan_tayang_jam, 2)} jam; sebelumnya diperkirakan 18–24 jam`],
      ["Jadwal yang tayang kurang dari 24 jam", pct(K.tayang_dalam_24_jam, K.kegiatan_jejak_lengkap)],
      ["Penelaahan dan persetujuan di luar jam kerja", `${pct(luarJam, putusanTotal)} (${n(luarJam)} dari ${n(putusanTotal)} keputusan)`],
      ["Peristiwa terekam pada jejak audit", n(D.jejak.peristiwa_total)],
      ["Kegiatan dengan penugasan petugas tercatat", pct(D.dengan_penugasan_petugas, T)],
      ["Instansi yang dilayani melalui kanal publik", `${D.ruang.instansi_berbeda} instansi (ruangan), ${D.tamu.instansi_berbeda} instansi (audiensi)`],
      ["Belanja pengadaan", "Rp0"],
    ],
    sumber: `Sumber: basis data Prokopim Hibot, ditarik ${PER_LENGKAP}. Angka "sebelum" merupakan estimasi (lihat Bagian 9.3).`,
  }));
  tambah(P(`Seluruh capaian tersebut diperoleh tanpa belanja pengadaan. Aplikasi berjalan pada layanan komputasi awan dengan kuota tanpa biaya dan dapat dipasang langsung pada telepon pintar pengguna. Hasilnya, pelayanan keprotokolan dan komunikasi pimpinan kepada Kepala Daerah menjadi lebih cepat, pasti, dan dapat dipertanggungjawabkan.`));

  // ── 3. PROFIL INOVATOR/TIM ──────────────────────────────────────
  tambah(h1("b3"));
  tambah(P(`Inovasi ini diusulkan oleh Tim Inovasi Prokopim Hibot dari Bagian Protokol dan Komunikasi Pimpinan Sekretariat Daerah Kota Tarakan. Susunan tim diambil dari Keputusan Sekretaris Daerah Kota Tarakan Nomor ${SK_SEKDA} tentang Tim Koordinasi Peningkatan Pelayanan Keprotokolan dan Komunikasi Pimpinan Pemerintah Kota Tarakan. Karena Petunjuk Teknis membatasi tim paling banyak lima orang termasuk ketua, lima anggota berikut mewakili Tim Koordinasi yang beranggotakan 42 orang.`));
  tambah(tabel({
    judul: "Susunan dan pembagian tugas tim inovasi",
    kolom: [7, 35, 15, 43],
    rataTengah: [0],
    baris: [
      ["No", "Nama dan Jabatan", "Kedudukan", "Peran dalam Inovasi"],
      ...TIM.map(([nama, jabatan, kedudukan, peranTim], i) => [String(i + 1), [`**${nama}**`, jabatan], kedudukan, peranTim]),
    ],
    sumber: `Sumber: Keputusan Sekretaris Daerah Kota Tarakan Nomor ${SK_SEKDA} (Lampiran 6).`,
  }));
  tambah(PN(`**Instansi:** Bagian Protokol dan Komunikasi Pimpinan, Sekretariat Daerah Kota Tarakan, Provinsi Kalimantan Utara.`, { after: 40 }));
  tambah(PN(`**Kontak ketua tim:** ponsel/WA 0811-5900-394; surel anugrahyegapranatha@gmail.com.`));
  tambah(P(`Ketua tim merancang alur kerja dan mengembangkan aplikasi secara swakelola. Keempat anggota lainnya menguji setiap perubahan, menerapkannya dalam pekerjaan sehari-hari, dan menghimpun kendala dari pengguna, sehingga setiap penyempurnaan berangkat dari hambatan yang benar-benar dialami di lapangan.`));

  // ── 4. LATAR BELAKANG ───────────────────────────────────────────
  tambah(h1("b4"));
  tambah(h2("4.1 Data Dasar"));
  tambah(P(`Berdasarkan Peraturan Wali Kota Tarakan Nomor 50 Tahun 2021 tentang Kedudukan, Susunan Organisasi, Tugas dan Fungsi serta Tata Kerja Sekretariat Daerah, Bagian Prokopim membantu Asisten Administrasi Umum di bidang protokol, komunikasi pimpinan, dan dokumentasi (Pasal 49). Tugas itu dijalankan oleh dua unit: Sub Bagian Protokol, antara lain menyiapkan bahan informasi acara dan jadwal kegiatan Kepala Daerah dan Wakil Kepala Daerah serta mengoordinasikan dan memfasilitasi kegiatannya (Pasal 52); dan Sub Bagian Komunikasi dan Dokumentasi Pimpinan, antara lain menyusun naskah sambutan, mendokumentasikan kegiatan, dan memfasilitasi peliputan media (Pasal 54).`));
  tambah(P(`Bagian Prokopim mengelola agenda dua Pimpinan Daerah dengan volume yang tinggi. Data yang kini terekam memperlihatkan besarnya beban tersebut: sejak Maret sampai ${PER_TGL} tercatat ${n(T)} kegiatan, dengan rata-rata ${rataBulan} kegiatan per bulan dan puncak ${D.kegiatan_per_bulan[puncakBulan]} kegiatan pada ${namaBulan(puncakBulan)}. Sebanyak ${n(D.kegiatan_per_pimpinan.walikota)} kegiatan ditujukan kepada Wali Kota dan ${n(D.kegiatan_per_pimpinan.wakilwalikota)} kepada Wakil Wali Kota.`));
  tambah(P(`Setiap kegiatan memerlukan pemeriksaan undangan, penelaahan kelayakan kehadiran, penugasan petugas protokol dan dokumentasi, serta penyiapan bahan. Hampir separuhnya (${n(sambutanKeg)} kegiatan) merupakan kegiatan sambutan yang memerlukan naskah. Beban sebesar ini sebelumnya ditangani secara manual dan tidak pernah tercatat dalam satu sistem.`));

  tambah(h2("4.2 Kondisi Sebelum Inovasi"));
  tambah(P(`Sebelum Maret 2026, alur kerja Bagian Prokopim berjalan sebagaimana Tabel 3.`, { keepNext: true }));
  tambah(tabel({
    judul: "Cara kerja sebelum inovasi",
    kolom: [26, 74],
    baris: [
      ["Aspek", "Keadaan sebelum Maret 2026"],
      ["Penyusunan agenda", "Rencana kegiatan (RK) disusun pada *spreadsheet*, dicetak, lalu diperiksa berjenjang"],
      ["Penelaahan", "Kepala Sub Bagian dan Kepala Bagian memeriksa dalam satu jendela waktu sekitar 30 menit menjelang jam pulang kantor, hanya pada hari kerja; disposisi Pimpinan diterima malam atau pagi harinya"],
      ["Kegiatan mendesak", "RK dicetak ulang untuk menyisipkannya; bila tidak sempat, Pimpinan hadir tanpa RK"],
      ["Dokumen disposisi", "Diteruskan dalam bentuk foto melalui grup percakapan"],
      ["Naskah sambutan", "Disusun, dicetak, diperiksa berjenjang, dan dikembalikan secara fisik"],
      ["Penugasan petugas", "Tidak tercatat terpusat; bergantung pada ingatan perorangan"],
      ["Ketersediaan ruangan", "Dicatat pada papan tulis dan dikoordinasikan melalui grup percakapan"],
      ["Permohonan audiensi", "Pemohon datang atau menelepon untuk menanyakan kepastian"],
    ],
  }));

  tambah(h2("4.3 Peristiwa Pemicu"));
  tambah(P(`Informasi agenda Pimpinan datang dari banyak arah, dapat bersumber dari surat yang diantar ke rumah jabatan, surat masuk resmi melalui tata usaha, dan pesan yang dikirim langsung kepada Wali Kota. Karena tidak ada satu pintu masuk, beberapa rencana kegiatan pernah tidak terinput sama sekali.`));
  tambah(P(`Pada awal Januari 2026 satu berkas disposisi agenda dan tamu diturunkan sebanyak tiga lembar, tetapi yang diterima Bagian Prokopim hanya dua. Kedua lembar itu ditindaklanjuti dengan keyakinan bahwa hanya itulah yang diturunkan. Belakangan diketahui ketiga lembar telah didisposisi; satu lembar tidak ikut terfoto ketika berkas diteruskan melalui grup percakapan.`));
  tambah(P(`Tidak ada pihak yang lalai dalam peristiwa tersebut. Kegagalan terletak pada rantai penyampaiannya. Ketika dokumen berpindah dalam bentuk foto, penerima tidak dapat mengetahui ada lembar yang kurang dan pengirim tidak dapat memastikan seluruhnya telah terkirim. Peristiwa ini menjadi perhatian Pimpinan dan menjadi titik tolak penyusunan inovasi.`));

  tambah(h2("4.4 Akar Masalah"));
  tambah(P(`Telaah atas seluruh alur kerja Bagian Prokopim menemukan satu akar masalah utama, yaitu tidak tersedianya satu sumber data yang sahih dan dapat dirujuk semua pihak. Akar masalah tersebut menimbulkan lima persoalan turunan:`, { keepNext: true }));
  tambah(huruf([
    `**Penelaahan terikat pada jendela waktu.** Undangan yang masuk pagi hari menunggu sekitar delapan jam sebelum mulai ditelaah, sedangkan yang masuk setelah jendela lewat menunggu hari kerja berikutnya. Keterlambatan ini bersumber dari bentuk prosedurnya.`,
    `**Keputusan tidak meninggalkan jejak.** Ketika terjadi kekeliruan, tidak ada rujukan untuk menelusuri pada jenjang mana kekeliruan itu masuk.`,
    `**Versi dokumen beredar ganda.** Setiap pencetakan ulang melahirkan versi baru, sementara versi lama masih berada di tangan pihak lain.`,
    `**Pengetahuan kerja melekat pada orang.** Pergantian personel memutus kesinambungan karena prosedur tidak terdokumentasi, dan beban kerja petugas tidak terlihat sehingga tidak terbagi merata.`,
    `**Layanan publik tanpa kanal yang dapat ditelusuri.** Pemohon audiensi dan peminjam ruangan tidak dapat memantau permohonannya sendiri.`,
  ]));
  tambah(P(`Kelima persoalan itu tersebar pada saluran yang berbeda-beda: kertas, *spreadsheet*, grup percakapan, papan tulis, dan telepon. Memperbaiki satu saluran tidak menyelesaikan saluran lainnya. Karena itu jawabannya bukan aplikasi tunggal untuk satu urusan, melainkan satu wadah bagi seluruh layanan keprotokolan dan komunikasi pimpinan yang berbagi satu data, yaitu sebuah *superapp*.`, { before: 60 }));

  tambah(h2("4.5 Urgensi"));
  tambah(P(`Agenda Pimpinan menentukan kehadiran pemerintah daerah di tengah masyarakat. Kegiatan yang tidak tercatat berarti tidak ada pendampingan protokol/pendampingan yang tergesa-gesa dan tidak matang, termasuk dalam hal peliputan dan dokumentasi, tidak ada naskah sambutan, dan ajudan tidak siap. Kegiatan itu juga hilang dari rekam jejak kinerja pemerintah daerah. Dengan volume kegiatan yang bervariasi (contoh: ${vAwal} kegiatan pada ${BULAN[+bPenuhAwal.slice(5) - 1]} menjadi ${vAkhir} kegiatan pada ${namaBulan(bPenuhAkhir)}), ketergantungan pada ketelitian perorangan tidak dapat dipertahankan.`));
  tambah(P(`Kebutuhan perubahan juga ditegaskan kebijakan daerah. Surat Edaran Wali Kota Tarakan Nomor ${SE_WALIKOTA} tanggal 11 Februari 2026 tentang Inovasi Daerah mendorong setiap perangkat daerah melahirkan inovasi, sejalan dengan arahan Wali Kota untuk meningkatkan Indeks Inovasi Daerah dengan prioritas inovasi berbasis digital.`));


  tambah(h2("4.6 Kelompok Sasaran dan Sumber Data"));
  tambah(P(`Kelompok sasaran inovasi ini adalah (a) Wali Kota dan Wakil Wali Kota, yang membutuhkan agenda pasti dan terkini; (b) ajudan dan pengawal pribadi, yang membutuhkan pemberitahuan dini; (c) Kepala Bagian dan Kepala Sub Bagian, yang membutuhkan kendali mutu jadwal dan sebaran beban petugas; (d) petugas protokol, pramu tamu, dan tim dokumentasi, yang membutuhkan kejelasan penugasan; serta (e) masyarakat, instansi, dan mitra kerja, yang membutuhkan kanal permohonan yang dapat ditelusuri.`));
  tambah(P(`Data keadaan sebelum inovasi bersumber dari telaah alur kerja dan keterangan pelaksana, karena keadaan itu memang tidak pernah dicatat. Data sesudah inovasi ditarik langsung dari basis data aplikasi ${PER_LENGKAP} menggunakan kueri baca-saja (Lampiran 8).`));

  // ── 5. KESELARASAN ──────────────────────────────────────────────
  tambah(h1("b5"));
  tambah(h2("5.1 Visi, Misi, dan Bidang Fokus yang Didukung"));
  tambah(P(`RPJMD Kota Tarakan Tahun 2025–2029 (Peraturan Daerah Kota Tarakan Nomor 2 Tahun 2025) menetapkan visi *"Terwujudnya Tarakan sebagai Kota Cerdas yang bertumpu pada Sektor Jasa, Perdagangan, Perikanan Kelautan dan Ekonomi Kreatif yang Berdaya Saing dan Maju menuju Masyarakat Sejahtera"*. Prokopim Hibot merupakan wujud Kota Cerdas pada sisi tata kelola pemerintahan dan mendukung langsung **Misi 4: Mewujudkan tata kelola pemerintahan yang adaptif, responsif dan menjaga stabilitas ketertiban dan ketentraman kota**:`, { keepNext: true }));
  tambah(butir([
    `**Adaptif:** proses kerja pindah dari kertas dan grup percakapan ke satu aplikasi tanpa kertas yang dapat diakses dari telepon pintar, perangkat yang sehari-hari dipegang hampir semua orang, dan terus menyesuaikan diri dengan cara kerja Pimpinan.`,
    `**Responsif:** jadwal Pimpinan ditetapkan dalam hitungan jam, bukan hari; permohonan masyarakat dapat ditelusuri sendiri tanpa harus datang atau menelepon.`,
    `**Menjaga stabilitas:** agenda yang pasti dan terkoordinasi memastikan kehadiran Pimpinan Daerah di tengah masyarakat didampingi petugas yang siap, sehingga acara berjalan tertib.`,
  ]));
  tambah(P(`Inovasi ini diajukan pada **Kategori A, Inovasi Tata Kelola Pemerintahan**. Setiap unsur kategori tersebut dijawab secara langsung sebagaimana Tabel 4.`, { keepNext: true }));
  tambah(tabel({
    judul: "Unsur Kategori A yang dijawab inovasi",
    kolom: [24, 76],
    baris: [
      ["Unsur kategori", "Wujud dalam inovasi"],
      ["Tata kelola", "Kewenangan melekat pada jabatan dan dapat dilimpahkan kepada Pelaksana Harian bermasa berlaku; persetujuan berjenjang tiga tingkat"],
      ["Proses bisnis", "Penelaahan tidak lagi menunggu jendela waktu harian; kegiatan mendesak tidak lagi memerlukan cetak ulang; sebelas alur kerja dibakukan dalam SOP"],
      ["Digitalisasi", "Sebelas alur kerja manual dipindahkan ke satu *superapp*; undangan terbit dalam format siap tanda tangan elektronik Srikandi"],
      ["Data", `Agenda, penugasan, naskah, undangan, ruangan, daftar hadir, dan evaluasi merujuk pada satu data kegiatan yang sama; ${n(T)} kegiatan tercatat`],
      ["Manajemen", "Sebaran beban petugas terlihat; rekap kinerja dan evaluasi petugas tersedia seketika"],
      ["Pengawasan", `Jejak audit mencatat pelaku dan waktu setiap keputusan (${n(D.jejak.peristiwa_total)} peristiwa); daftar periksa wajib sebelum persetujuan`],
      ["Efisiensi", `Median ${dk(K.median_ajukan_tayang_jam, 2)} jam dari pengajuan sampai jadwal tayang; tanpa belanja pengadaan`],
    ],
  }));

  tambah(h2("5.2 Semboyan Tarakan HIBOT"));
  tambah(P(`Nama inovasi ini mengusung semboyan pembangunan Kota Tarakan periode 2025–2030, **"Tarakan HIBOT"**. *Hibot* dalam bahasa Tidung berarti hebat, dan sekaligus merupakan akronim dari Handal, Inovatif, Berbudaya, Unggul/Oenggoel, dan Tangguh. Kelima nilai itu diterjemahkan ke dalam rancangan aplikasi sebagaimana Tabel 5.`, { keepNext: true }));
  tambah(tabel({
    judul: "Nilai HIBOT dalam rancangan Prokopim Hibot",
    kolom: [18, 82],
    baris: [
      ["Nilai", "Wujud dalam aplikasi"],
      ["Handal", "Satu sumber data kegiatan; agenda tidak lagi bergantung pada ingatan dan ketelitian perorangan"],
      ["Inovatif", "Jejak audit dan daftar periksa wajib menggantikan pemeriksaan melalui kertas dan grup percakapan"],
      ["Berbudaya", "Mengikuti tata naskah dinas dan menghormati kebiasaan Pimpinan, misalnya membaca naskah sambutan tercetak"],
      ["Unggul/Oenggoel", `Jadwal ditetapkan dalam hitungan jam; ${pct(K.tayang_dalam_24_jam, K.kegiatan_jejak_lengkap)} tayang kurang dari 24 jam`],
      ["Tangguh", "Alur tetap berjalan ketika pejabat berhalangan melalui Pelaksana Harian, dan tetap beroperasi tanpa anggaran pengadaan"],
    ],
  }));
  tambah(P(`Inovasi ini juga sejalan dengan tema lomba, **"Inovasi Berdampak, Tarakan Maju dan Berdaya Saing"**: dampaknya terukur langsung dari basis data, dan tata kelola agenda Pimpinan yang cepat dan akuntabel menjadi bagian dari daya saing pemerintahan kota.`));

  tambah(h2("5.3 Keterkaitan dengan Kebijakan dan Regulasi"));
  tambah(angka([
    `Undang-Undang Nomor 23 Tahun 2014 tentang Pemerintahan Daerah, yang menempatkan inovasi sebagai upaya meningkatkan kinerja penyelenggaraan pemerintahan daerah;`,
    `Undang-Undang Nomor 25 Tahun 2009 tentang Pelayanan Publik, melalui kanal permohonan audiensi dan peminjaman ruangan yang dapat ditelusuri pemohon;`,
    `Undang-Undang Nomor 9 Tahun 2010 tentang Keprotokolan, dalam tata kelola acara dan pendampingan Pimpinan Daerah;`,
    `Peraturan Pemerintah Nomor 38 Tahun 2017 tentang Inovasi Daerah dan Peraturan Menteri Dalam Negeri Nomor 104 Tahun 2018 tentang Penilaian dan Pemberian Penghargaan dan/atau Insentif Inovasi Daerah, sebagai inovasi tata kelola pemerintahan daerah;`,
    `Peraturan Presiden Nomor 95 Tahun 2018 tentang Sistem Pemerintahan Berbasis Elektronik dan Peraturan Presiden Nomor 82 Tahun 2023 tentang Percepatan Transformasi Digital dan Keterpaduan Layanan Digital Nasional;`,
    `Peraturan Menteri PANRB Nomor 35 Tahun 2012 tentang Pedoman Penyusunan Standar Operasional Prosedur Administrasi Pemerintahan, sebagai dasar penyusunan sebelas SOP;`,
    `Peraturan Daerah Kota Tarakan Nomor 2 Tahun 2025 tentang RPJMD Kota Tarakan Tahun 2025–2029 dan Peraturan Wali Kota Tarakan Nomor 20 Tahun 2025 tentang RKPD Kota Tarakan Tahun 2026, yang menjadi kerangka pelaksanaan inovasi pada tahun berjalan;`,
    `Peraturan Wali Kota Tarakan Nomor 41 Tahun 2025 tentang Penyelenggaraan Inovasi Daerah;`,
    `Peraturan Wali Kota Tarakan Nomor 50 Tahun 2021 tentang Kedudukan, Susunan Organisasi, Tugas dan Fungsi serta Tata Kerja Sekretariat Daerah, sebagai dasar tugas setiap alur kerja (Tabel 7);`,
    `Surat Edaran Wali Kota Tarakan Nomor ${SE_WALIKOTA} tentang Inovasi Daerah; dan`,
    `Keputusan Sekretaris Daerah Kota Tarakan Nomor ${SK_SEKDA} tentang Tim Koordinasi Peningkatan Pelayanan Keprotokolan dan Komunikasi Pimpinan.`,
  ]));

  // ── 6. DESKRIPSI DAN KEBARUAN ───────────────────────────────────
  tambah(h1("b6"));
  tambah(h2("6.1 Konsep"));
  tambah(P(`Prinsip dasar Prokopim Hibot adalah **setiap kegiatan Pimpinan memiliki satu data yang sama bagi semua pihak, dan setiap keputusan atasnya tercatat.** Seluruh jenjang, dari Admin Rencana Kegiatan sampai Wali Kota, membuka data kegiatan yang sama, sehingga tidak ada lagi versi cetakan yang beredar ganda maupun lembar yang hilang tanpa diketahui.`));
  tambah(P(`Di atas satu data itu dibangun sebuah *superapp*, yaitu satu aplikasi dengan satu pintu masuk yang memuat banyak layanan. Pengguna tidak perlu berpindah antara kertas, *spreadsheet*, grup percakapan, dan aplikasi lain: setiap peran membuka aplikasi yang sama dan langsung melihat layanan yang menjadi haknya, sebagaimana Tabel 6. Tangkapan layar setiap lapisan disertakan pada Lampiran 4.`, { keepNext: true }));
  tambah(tabel({
    judul: "Lapisan layanan superapp Prokopim Hibot",
    kolom: [22, 78],
    baris: [
      ["Lapisan", "Layanan yang diterima"],
      ["Pimpinan Daerah", "Agenda pasti dan terkini di telepon pintar; disposisi kegiatan kepada Wakil Wali Kota atau jajaran langsung dari aplikasi"],
      ["Ajudan dan pengawal pribadi", "Pemberitahuan dini setiap agenda beserta lokasi, pakaian, dan narahubung; konfirmasi kehadiran Pimpinan; pengingat sehari sebelumnya"],
      ["Pejabat struktural", "Antrean persetujuan dengan daftar periksa wajib; pemantauan usulan perubahan menurut kegentingan; Pelaksana Harian; sebaran beban petugas"],
      ["Petugas", "Penugasan melalui aplikasi dan WhatsApp; rekap agenda setiap pagi; daftar hadir digital; evaluasi dan rekap kinerja pribadi"],
      ["Masyarakat dan instansi", "Permohonan audiensi dan peminjaman ruangan secara daring dengan kode penelusuran; kalender ketersediaan ruangan; daftar hadir dengan kode QR"],
      ["Integrasi", "Google Calendar bersama terisi otomatis; notifikasi aplikasi dan WhatsApp; undangan siap tanda tangan elektronik Srikandi; daftar hadir tersimpan di *spreadsheet* instansi"],
    ],
  }));
  tambah(h2("6.2 Cara Kerja"));
  tambah(P(`Prokopim Hibot berbentuk aplikasi web progresif yang dapat dibuka melalui peramban atau dipasang pada telepon pintar tanpa melalui toko aplikasi. Pengguna masuk sesuai peran masing-masing, dan setiap peran hanya melihat serta mengerjakan yang menjadi kewenangannya. Alur inti penetapan jadwal ditunjukkan Gambar 1.`, { keepNext: true }));
  tambah(bagan(
    [["Admin Rencana Kegiatan", "input jadwal dan undangan"], ["Kepala Sub Bagian Protokol", "telaah dan verifikasi"], ["Kepala Bagian", "persetujuan"], ["Tayang", "Pimpinan, ajudan, petugas"]],
    "Setiap tahap tercatat pada jejak audit: pelaku, waktu, dan catatan keputusan.",
    "Alur penetapan jadwal kegiatan Pimpinan",
  ));
  tambah(P(`Setelah jadwal tayang, aplikasi memberi tahu pihak terkait melalui notifikasi aplikasi dan pesan WhatsApp, menugaskan petugas protokol dan dokumentasi, serta mengirim pengingat terjadwal lima kali sehari menurut waktu WITA. Ajudan mengonfirmasi kehadiran Pimpinan, dan Wali Kota dapat mendisposisikan kegiatan kepada Wakil Wali Kota langsung dari aplikasi.`));

  tambah(h2("6.3 Cakupan Alur Kerja"));
  tambah(tabel({
    judul: "Sebelas alur kerja dalam Prokopim Hibot",
    kolom: [6, 22, 46, 26],
    rataTengah: [0],
    baris: [
      ["No", "Alur kerja", "Cara kerja pokok", "Dasar tugas"],
      ["1", "Penetapan jadwal", "Tiga jenjang; pemeriksaan benturan jadwal Pimpinan secara otomatis", "Pasal 52 huruf c, d"],
      ["2", "Perubahan jadwal terbit", "Diajukan berjenjang; jadwal tetap tayang dengan data lama selama usulan diproses", "Pasal 52 huruf c, d"],
      ["3", "Penarikan dan pembatalan", "Wajib disertai alasan; data tidak dihapus", "Pasal 52 huruf c, d"],
      ["4", "Penugasan petugas", "Pemberitahuan hanya kepada petugas yang penugasannya berubah", "Pasal 52 huruf e; Pasal 54 huruf h"],
      ["5", "Audiensi dan tamu", "Permohonan daring berjenjang; otomatis menjadi agenda bila disetujui", "Pasal 52 huruf a, e"],
      ["6", "Peminjaman ruangan", "Kanal publik dengan kalender ketersediaan dan kode penelusuran", "Pasal 52 huruf b"],
      ["7", "Daftar hadir digital", "Pindai kode QR; tanda tangan layar sentuh; buka-tutup mengikuti jam acara", "Pasal 52 huruf e"],
      ["8", "Naskah sambutan", "Penyusun, penyelia, dan pengesah dalam satu alur", "Pasal 54 huruf g"],
      ["9", "Peliputan dan publikasi", "Rancangan naskah berita berbantuan kecerdasan buatan, wajib disunting petugas", "Pasal 54 huruf h, j"],
      ["10", "Penerbitan undangan", "PDF siap tanda tangan elektronik Srikandi; ruang rapat Imbaya dan Kenawai dipesan langsung dari formulir undangan", "Pasal 52 huruf f"],
      ["11", "Evaluasi kinerja", "Butir penilaian berbeda untuk petugas protokol dan dokumentasi", "Pasal 50 huruf c"],
    ],
    sumber: "Dasar tugas: Peraturan Wali Kota Tarakan Nomor 50 Tahun 2021.",
  }));

  tambah(h2("6.4 Unsur Kebaruan"));
  tambah(P(`Unsur kebaruan Prokopim Hibot berkaitan dengan cara aplikasi menjaga mutu keputusan dan kesinambungan alur kerja, yaitu:`, { keepNext: true }));
  tambah(huruf([
    `**Jejak audit yang melekat pada setiap kegiatan.** Riwayat setiap kegiatan mencatat siapa yang mengajukan, menelaah, dan memutus, kapan, serta dengan catatan apa. Sampai ${PER_TGL} tercatat ${n(D.jejak.peristiwa_total)} peristiwa pada ${n(D.jejak.kegiatan_berjejak)} kegiatan.`,
    `**Daftar periksa wajib sebelum persetujuan.** Tombol persetujuan baru aktif setelah pejabat mengonfirmasi butir pemeriksaan, dan butir yang dikonfirmasi ikut tercatat pada jejak audit. Butir "undangan sudah dibuka" hanya tercentang apabila berkas undangan benar-benar dibuka.`,
    `**Kewenangan melekat pada jabatan, dengan Pelaksana Harian bermasa berlaku.** Kewenangan pejabat yang berhalangan dapat dilimpahkan sementara dan padam sendiri pada tanggal berakhirnya; jejak audit tetap mencatat pelaku sebenarnya, dan Pelaksana Harian tidak dapat memutus jadwal yang diajukannya sendiri.`,
    `**Pengawasan berdasarkan kegentingan.** Usulan perubahan yang tertahan ditandai menurut umurnya dan kedekatan hari pelaksanaan, dan Kepala Bagian dapat memantau usulan tanpa melangkahi jenjang di bawahnya.`,
    `**Kanal publik yang dapat ditelusuri sendiri.** Pemohon audiensi dan peminjam ruangan memantau permohonannya dengan kode penelusuran. Kalender ketersediaan ruangan untuk umum hanya menampilkan keterpakaian slot, tanpa identitas maupun kontak pemohon.`,
    `**Tersambung ke kalender bersama.** Kegiatan yang telah disetujui tampil sendiri, termasuk perubahan dan pembatalannya, di Google Calendar bersama yang dapat dilanggani pihak terkait tanpa akun aplikasi. Nomor narahubung dan catatan internal tidak ikut dikirim, dan kegiatan tertentu dapat ditahan agar tidak ditampilkan.`,
    `**Undangan siap tanda tangan elektronik.** Generator undangan menghasilkan PDF berhuruf Arial yang langsung dapat diunggah ke Srikandi; letak kode QR tanda tangan elektronik telah disesuaikan, dan ruang rapat Imbaya atau Kenawai dapat diperiksa ketersediaannya serta dipesan sekaligus dari formulir yang sama.`,
  ]));

  tambah(h2("6.5 Perbedaan dari Cara Lama dan Solusi Sejenis"));
  tambah(tabel({
    judul: "Perbandingan cara lama dan Prokopim Hibot",
    kolom: [26, 34, 40],
    baris: [
      ["Aspek", "Cara lama", "Prokopim Hibot"],
      ["Kegiatan mendesak", "Cetak ulang seluruh RK", "Masuk antrean tersendiri"],
      ["Rujukan jadwal", "Beberapa versi cetakan", "Satu data, terkini bagi semua peran"],
      ["Pemberitahuan petugas", "Manual, mudah terlewat", "Otomatis, hanya kepada yang berubah"],
      ["Pejabat berhalangan", "Alur berhenti", "Pelaksana Harian bermasa berlaku"],
      ["Kalender bersama", "Diisi admin satu per satu secara manual", "Terisi otomatis sesudah persetujuan"],
      ["Saluran kerja", "Kertas, grup percakapan, papan tulis, telepon", "Satu *superapp* untuk seluruh layanan"],
      ["Layanan publik", "Datang atau menelepon", "Kanal daring dengan kode penelusuran"],
      ["Prosedur", "Melekat pada orang", "Sebelas SOP baku"],
    ],
  }));
  tambah(P(`Kalender bersama dan grup percakapan yang lazim dipakai tidak memiliki jenjang persetujuan, pembagian kewenangan menurut jabatan, dan jejak keputusan. Prokopim Hibot tidak menggantikan kalender bersama, tetapi mengisinya secara otomatis, sehingga kalender hanya memuat kegiatan yang telah disetujui. Aplikasi ini juga tidak menggantikan aplikasi persuratan: nomor surat tetap diterbitkan melalui aplikasi persuratan resmi, sedangkan Prokopim Hibot mengelola tindak lanjut kegiatannya.`));

  tambah(h2("6.6 Nilai Tambah bagi Pemangku Kepentingan"));
  tambah(tabel({
    judul: "Nilai tambah menurut pemangku kepentingan",
    kolom: [30, 70],
    baris: [
      ["Pemangku kepentingan", "Nilai tambah"],
      ["Pimpinan Daerah", `Agenda pasti dan terkini di telepon pintar; disposisi kepada Wakil Wali Kota langsung dari aplikasi (${aksi.delegasi_to_wwk || 0} kegiatan)`],
      ["Ajudan dan pengawal pribadi", `Pemberitahuan dini; konfirmasi kehadiran Pimpinan terekam (${n(konfirmasiHadir)} konfirmasi)`],
      ["Pejabat struktural", "Kendali mutu melalui daftar periksa; sebaran beban petugas terlihat"],
      ["Petugas", "Penugasan jelas; rekap kinerja pribadi tersedia seketika"],
      ["Masyarakat dan instansi", "Tidak perlu datang berulang untuk menanyakan kepastian permohonan"],
    ],
  }));

  // ── 7. PELAKSANAAN ──────────────────────────────────────────────
  tambah(h1("b7"));
  tambah(tabel({
    judul: "Identitas pelaksanaan inovasi",
    kolom: [26, 74],
    kepala: false,
    baris: [
      [{ t: "Mulai digunakan", bold: true, shade: ABU_MUDA }, `Maret 2026; kegiatan pertama tercatat ${tglPanjang(D.tanggal_kegiatan.awal)}`],
      [{ t: "Bukti tertulis", bold: true, shade: ABU_MUDA }, `Surat Sekda Nomor ${NOMOR_SURAT_SEKDA} tanggal 12 Maret 2026, yang menyatakan sistem telah dikembangkan dan memohon subdomain prokopim.tarakankota.go.id`],
      [{ t: "Masa implementasi", bold: true, shade: ABU_MUDA }, `${MASA} per 1 Oktober 2026, melampaui syarat paling singkat 3 bulan`],
      [{ t: "Lokasi", bold: true, shade: ABU_MUDA }, "Bagian Prokopim Setda Kota Tarakan; dapat diakses dari mana saja"],
      [{ t: "Pengguna", bold: true, shade: ABU_MUDA }, `${D.pengguna.aktif} akun aktif pada ${jumlahPeran} jenis peran`],
      [{ t: "Volume", bold: true, shade: ABU_MUDA }, `${n(T)} kegiatan; ${n(D.jejak.peristiwa_total)} peristiwa terekam`],
    ],
  }));

  tambah(h2("7.1 Penjaringan Ide"));
  tambah(P(`Kebutuhan tidak dijaring melalui survei, tetapi dari pengalaman kerja sehari-hari yang berulang:`, { keepNext: true }));
  tambah(angka([
    `beragamnya pintu masuk informasi agenda, sehingga beberapa rencana kegiatan pernah tidak terinput;`,
    `peristiwa Januari 2026, ketika satu lembar disposisi tidak ikut terfoto dan tidak ada pihak yang dapat mengetahuinya; dan`,
    `telaah bersama seluruh Bagian Prokopim sesudah peristiwa tersebut, yang menemukan pola serupa di banyak tempat: penugasan yang tersimpan dalam ingatan, ketersediaan ruangan yang hanya tercatat di papan tulis, dan arsip yang tersebar.`,
  ]));
  tambah(P(`Telaah tersebut menyimpulkan bahwa persoalan utamanya adalah tidak tersedianya satu sumber data yang dapat dirujuk semua pihak.`, { before: 60 }));

  tambah(h2("7.2 Pemilihan Ide"));
  tambah(tabel({
    judul: "Pertimbangan pemilihan solusi",
    kolom: [36, 64],
    baris: [
      ["Pilihan", "Pertimbangan"],
      ["Menambah pengawasan dan pengingat manual", "Tidak menyentuh akar masalah; peristiwa Januari terjadi ketika semua pihak sudah bekerja dengan benar"],
      ["Memperbaiki tata kelola *spreadsheet* bersama", "Tetap menyisakan banyak versi dan tidak mencatat jejak keputusan"],
      ["Mengadakan aplikasi jadi dari pihak ketiga", "Memerlukan anggaran dan proses pengadaan, sementara alur keprotokolan pimpinan sangat khas"],
      [{ t: "Membangun sistem sendiri dengan satu sumber data dan jejak audit", bold: true, shade: "E2EFDA" }, { t: "**Dipilih.** Menyelesaikan akar masalah, dapat disesuaikan dengan alur yang sesungguhnya, dan tanpa anggaran pengadaan", shade: "E2EFDA" }],
    ],
  }));

  tambah(h2("7.3 Tahapan Pelaksanaan"));
  tambah(tabel({
    judul: "Tahapan pelaksanaan",
    kolom: [22, 78],
    baris: [
      ["Waktu", "Tahapan"],
      ["Januari 2026", "Peristiwa pemicu; telaah alur kerja seluruh Bagian Prokopim"],
      ["Februari–Maret 2026", `Pembangunan dan uji coba; mulai digunakan (kegiatan pertama ${tglPanjang(D.tanggal_kegiatan.awal)})`],
      ["Mei 2026", `Jejak audit mulai merekam (${tglPanjang(D.jejak.pertama)}); kanal peminjaman ruangan dibuka`],
      ["Juli–Agustus 2026", "Permohonan audiensi terhubung ke agenda; notifikasi aplikasi; kalender ketersediaan ruangan; daftar hadir digital"],
      ["September 2026", "Pelaksana Harian; daftar periksa wajib sebelum persetujuan; penanda kegentingan dan pemantauan usulan perubahan; sinkron otomatis ke kalender bersama"],
      ["Oktober 2026", "Generator undangan siap tanda tangan elektronik Srikandi; pemesanan ruang rapat Imbaya dan Kenawai langsung dari formulir undangan; pratinjau undangan pada telepon pintar"],
    ],
  }));
  if (pembaruan) tambah(P(`Sepanjang Maret sampai awal Oktober 2026 tercatat lebih dari ${bulatBawah(pembaruan, 10)} pembaruan aplikasi dalam lebih dari ${bulatBawah(hariKembang, 10)} hari pengembangan. Sebagian besar pembaruan berangkat dari kendala yang dilaporkan pengguna, sehingga aplikasi berkembang mengikuti kebutuhan nyata.`));

  tambah(h2("7.4 SOP, Keputusan Pendukung, dan Dokumentasi"));
  tambah(P(`Seluruh alur pada Tabel 7 dituangkan dalam sebelas SOP format PermenPAN-RB 35/2012, satu SOP untuk setiap alur, masing-masing dilengkapi bagian identitas, dasar hukum, dan diagram alir. SOP disusun untuk disahkan Sekretaris Daerah Kota Tarakan (Lampiran 7).`));
  tambah(P(`Keputusan pendukung berupa Keputusan Sekretaris Daerah Nomor ${SK_SEKDA} dan Surat Sekretaris Daerah tanggal 12 Maret 2026 (Lampiran 6). Dokumentasi berupa tangkapan layar setiap alur dan video demonstrasi disertakan pada Lampiran 4 dan Lampiran 5.`));

  // ── 8. SUMBER DAYA ──────────────────────────────────────────────
  tambah(h1("b8"));
  tambah(P(`Prokopim Hibot dijalankan tanpa belanja pengadaan. Keterbatasan anggaran diatasi dengan memanfaatkan secara optimal sumber daya yang sudah tersedia.`));
  tambah(h2("8.1 Sumber Daya Manusia"));
  tambah(P(`Pengembangan dilakukan secara swakelola oleh Ketua Tim selaku Kepala Bagian, dengan memanfaatkan asisten pemrograman berbasis kecerdasan buatan, sehingga tidak memerlukan jasa pengembang dari pihak ketiga dan tidak membebani APBD. Anggota tim dan sebelas pelaksana Bagian Prokopim berperan sebagai pengguna harian sekaligus penguji, serta menjadi sumber kebutuhan setiap penyempurnaan. Pelaksanaannya diperkuat Tim Koordinasi beranggotakan 42 orang berdasarkan Keputusan Sekretaris Daerah, yang juga melibatkan para Sekretaris Dinas di lingkungan Pemerintah Kota Tarakan.`));
  tambah(h2("8.2 Mitra dan Peran Pemangku Kepentingan"));
  tambah(butir([
    `**Sekretaris Daerah Kota Tarakan:** menetapkan Tim Koordinasi dan menguatkan penggunaan sistem melalui surat resmi.`,
    `**Wali Kota dan Wakil Wali Kota:** pengguna langsung; Wali Kota memakai fitur disposisi kepada Wakil Wali Kota pada ${aksi.delegasi_to_wwk || 0} kegiatan.`,
    `**Ajudan dan pengawal pribadi Pimpinan:** mengonfirmasi kehadiran Pimpinan melalui aplikasi sebanyak ${n(konfirmasiHadir)} kali.`,
    `**Dinas Komunikasi, Informatika, Statistik dan Persandian:** memfasilitasi subdomain prokopim.tarakankota.go.id yang kini menjadi alamat resmi aplikasi.`,
    `**Bappeda Litbang:** pengampu kebijakan inovasi daerah dan penerima tembusan surat penguatan.`,
    `**Mitra kerja lintas unit:** ${peran.mitra_kerja || 0} akun mitra kerja dipakai Dinas Komunikasi, Informatika, Statistik dan Persandian (DKISP), pengawal pribadi, ajudan pejabat pimpinan tinggi di Sekretariat Daerah, pengemudi Pimpinan, dan tenaga ahli media untuk memantau agenda yang telah tayang.`,
  ]));
  tambah(h2("8.3 Anggaran, Teknologi, Sarana, dan Efisiensi"));
  tambah(tabel({
    judul: "Pemanfaatan sumber daya",
    kolom: [20, 60, 20],
    baris: [
      ["Komponen", "Pemanfaatan", "Biaya"],
      ["Peladen", "12 fungsi peladen tanpa server pada kuota tanpa biaya (12 dari 12 terpakai)", "Rp0"],
      ["Basis data", "Layanan basis data terkelola, paket tanpa biaya", "Rp0"],
      ["Daftar hadir", "Menumpang *spreadsheet* dan penyimpanan berkas milik instansi", "Rp0"],
      ["Notifikasi", "Notifikasi aplikasi tanpa biaya; pesan WhatsApp melalui layanan gerbang pesan", "Langganan gerbang pesan"],
      ["Kalender bersama", "Layanan kalender pada kuota tanpa biaya, memakai akun layanan atas nama instansi", "Rp0"],
      ["Perangkat", "Telepon pintar milik pengguna; tanpa toko aplikasi", "Rp0"],
      ["Pengembangan", "Swakelola oleh Ketua Tim; tidak membebani APBD", "Rp0"],
    ],
  }));
  tambah(P(`Keterbatasan kuota diatasi melalui penyesuaian teknis tanpa menambah biaya. Ketika lalu lintas data basis data sempat mencapai 6,4 GB per bulan dan melampaui kuota tanpa biaya sebesar 5 GB, pengambilan data diubah agar hanya menarik data yang berubah, sehingga pemakaian turun menjadi sekitar 1 GB. Ketika jumlah fungsi peladen mencapai batas 12, fungsi baru digabungkan ke fungsi yang sudah ada.`));

  // ── 9. HASIL ────────────────────────────────────────────────────
  tambah(h1("b9"));
  tambah(h2("9.1 Capaian Indikator"));
  tambah(P(`Data berikut ditarik langsung dari basis data aplikasi pada ${PER_LENGKAP}.`, { keepNext: true }));
  tambah(tabel({
    judul: "Capaian indikator",
    kolom: [62, 38],
    baris: [
      ["Indikator", "Capaian"],
      ["Kegiatan terkelola", n(T)],
      ["Median waktu pengajuan sampai jadwal tayang", `${dk(K.median_ajukan_tayang_jam, 2)} jam (rata-rata ${dk(K.rata_ajukan_tayang_jam, 2)} jam)`],
      ["    menunggu penelaahan Kepala Sub Bagian", jamMenit(K.median_ajukan_teruskan_jam)],
      ["    menunggu keputusan Kepala Bagian", jamMenit(K.median_teruskan_tayang_jam)],
      ["Jadwal tayang kurang dari 4 jam / 24 jam", `${pct(K.tayang_dalam_4_jam, K.kegiatan_jejak_lengkap)} / ${pct(K.tayang_dalam_24_jam, K.kegiatan_jejak_lengkap)}`],
      ["Penelaahan dan persetujuan di luar jam kerja", `${n(luarJam)} dari ${n(putusanTotal)} (${pct(luarJam, putusanTotal)})`],
      ["Peristiwa terekam pada jejak audit", `${n(D.jejak.peristiwa_total)} pada ${n(D.jejak.kegiatan_berjejak)} kegiatan`],
      ["Kegiatan dengan penugasan petugas", `${n(D.dengan_penugasan_petugas)} (${pct(D.dengan_penugasan_petugas, T)})`],
      ["Berkas undangan terarsip", `${n(D.undangan_terarsip)} (${pct(D.undangan_terarsip, T)})`],
      ["Kegiatan yang telah dievaluasi petugas", `${n(D.sudah_dievaluasi)} (${pct(D.sudah_dievaluasi, T)})`],
      ["Kegiatan dikembalikan untuk diperbaiki", `${n(D.dikembalikan_untuk_diperbaiki)} (${pct(D.dikembalikan_untuk_diperbaiki, T)})`],
      ["Konfirmasi kehadiran Pimpinan oleh ajudan", n(konfirmasiHadir)],
      ["Tindakan oleh Pelaksana Harian", n(D.jejak.oleh_plh)],
      ["Akun aktif", `${D.pengguna.aktif} pada ${jumlahPeran} jenis peran`],
    ],
    sumber: `Waktu penetapan dihitung dari ${n(K.kegiatan_jejak_lengkap)} kegiatan yang jejak auditnya lengkap. Jejak audit mulai merekam pada ${tglPanjang(D.jejak.pertama)}, sehingga angka kecepatan mencakup Mei–Oktober 2026. Di luar jam kerja berarti sebelum pukul 07.30, sejak pukul 16.00 WITA, atau pada hari Sabtu dan Minggu; hari libur nasional tidak dihitung sehingga angka tersebut cenderung lebih rendah dari keadaan sebenarnya.`,
  }));

  tambah(h2("9.2 Pertumbuhan Penggunaan"));
  const kepalaBulan = ["Bulan", ...bulanTampil.map((k) => BLN3[+k.slice(5) - 1] + (k === bulanKini ? "*" : ""))];
  const nilaiBulan = ["Kegiatan", ...bulanTampil.map((k) => String(D.kegiatan_per_bulan[k]))];
  tambah(tabel({
    judul: "Jumlah kegiatan per bulan tahun 2026",
    kolom: [22, ...bulanTampil.map(() => 78 / bulanTampil.length)],
    rataTengah: bulanTampil.map((_, i) => i + 1),
    baris: [kepalaBulan, nilaiBulan],
    sumber: `*Bulan berjalan per ${PER_TGL}, termasuk kegiatan yang telah terjadwal pada sisa bulan.${terjadwalDepan ? ` Selain itu, ${terjadwalDepan} kegiatan untuk bulan berikutnya telah terjadwal.` : ""}`,
  }));
  tambah(P(`Jumlah kegiatan naik dari ${vAwal} pada ${BULAN[+bPenuhAwal.slice(5) - 1]}, bulan penuh pertama, menjadi ${vAkhir} pada ${namaBulan(bPenuhAkhir)}, atau naik ${naik}%. Rata-rata bulan penuh mencapai ${rataBulan} kegiatan. Kenaikan ini menunjukkan semakin banyak kegiatan Pimpinan dikelola melalui aplikasi seiring bertambahnya pengguna.`));

  tambah(h2("9.3 Perbandingan Sebelum dan Sesudah"));
  tambah(tabel({
    judul: "Perbandingan sebelum dan sesudah inovasi",
    kolom: [27, 38, 35],
    baris: [
      ["Indikator", "Sebelum (estimasi)", "Sesudah (terukur)"],
      ["Undangan masuk sampai tercantum di agenda", "±18–24 jam pada jalur tercepat; 24–48 jam bila terlewat jendela periksa; sampai 72 jam bila melintasi akhir pekan", `Median ${dk(K.median_ajukan_tayang_jam, 2)} jam; ${pct(K.tayang_dalam_24_jam, K.kegiatan_jejak_lengkap)} kurang dari 24 jam`],
      ["Kesempatan penelaahan", "Sekali sehari, ±30 menit, hari kerja", `Setiap saat; ${pct(luarJam, putusanTotal)} di luar jam kerja`],
      ["Keputusan Kepala Bagian", "Menunggu jendela periksa", `Median ${jamMenit(K.median_teruskan_tayang_jam)}`],
      ["Penugasan petugas", "Bergantung ingatan, tidak terlaporkan", `${pct(D.dengan_penugasan_petugas, T)} kegiatan berpenugasan tercatat`],
      ["Arsip undangan", "Tersebar", `${n(D.undangan_terarsip)} berkas terarsip`],
      ["Jejak keputusan", "Tidak ada", `${n(D.jejak.peristiwa_total)} peristiwa terekam`],
      ["Ketersediaan ruangan", "Papan tulis dan grup percakapan", `Kalender daring; ${D.ruang.pengajuan} pengajuan dari ${D.ruang.instansi_berbeda} instansi`],
    ],
  }));
  tambah(P(`**Dasar estimasi.** Kolom "sebelum" tidak pernah dicatat; angka 18–24 jam diturunkan dari alur pada Tabel 3, yaitu menunggu jendela periksa (±8 jam) lalu disposisi malam atau pagi harinya (±12–15 jam).`));
  tambah(P(`Dengan median ${dk(K.median_ajukan_tayang_jam, 2)} jam, penetapan jadwal menjadi sekitar ${cepatLo} sampai ${cepatHi} kali lebih cepat pada jalur tercepat, dan jauh lebih cepat bagi undangan yang sebelumnya terlewat jendela periksa atau melintasi akhir pekan. Setelah sampai kepada Kepala Bagian, keputusan hanya memerlukan ${jamMenit(K.median_teruskan_tayang_jam)}; hambatan cara lama terletak pada jendela waktu penelaahan, bukan pada pengambilan keputusannya.`));

  tambah(h2("9.4 Mutu Layanan dan Akuntabilitas"));
  tambah(P(`Sebanyak ${D.dikembalikan_untuk_diperbaiki} kegiatan (${pct(D.dikembalikan_untuk_diperbaiki, T)}) dikembalikan untuk diperbaiki sebelum ditetapkan. Sebanyak ${aksi.recall_published || 0} jadwal yang telah tayang ditarik kembali untuk dikoreksi, dan ${aksi.usulan_edit_diajukan || 0} usulan perubahan jadwal diproses berjenjang tanpa menurunkan jadwal dari publikasi. Sejak daftar periksa wajib diberlakukan pada 22 September 2026, ${D.jejak.dengan_daftar_periksa} keputusan telah melewati pemeriksaan butir yang tercatat pada jejak audit. Fitur Pelaksana Harian telah dipakai dalam ${D.jejak.oleh_plh} tindakan, sehingga alur tidak terhenti ketika pejabat berhalangan.`));

  tambah(h2("9.5 Jangkauan Layanan Publik"));
  tambah(butir([
    `**Peminjaman ruangan:** ${D.ruang.pengajuan} pengajuan dari ${D.ruang.instansi_berbeda} instansi; ${D.ruang.per_status.Approved || 0} disetujui dengan total ${n(D.ruang.peserta_disetujui)} peserta kegiatan.`,
    `**Permohonan audiensi:** ${D.tamu.total} permohonan dari ${D.tamu.instansi_berbeda} instansi; ${D.tamu.per_status.selesai || 0} telah selesai diproses dan ${D.agenda_dari_permohonan_tamu} di antaranya menjadi agenda Pimpinan.`,
    `**Pengguna di luar Bagian Prokopim:** ${akunLuar} akun, terdiri atas Pimpinan Daerah, ajudan, pengawal pribadi, dan mitra kerja dari DKISP serta unit lain di lingkungan Pemerintah Kota. Notifikasi aplikasi telah aktif pada ${D.perangkat_notifikasi.perangkat} perangkat milik ${D.perangkat_notifikasi.pengguna} pengguna.`,
  ]));

  tambah(h2("9.6 Manfaat Sosial dan Ekonomi"));
  tambah(P(`Masyarakat dan instansi tidak perlu lagi datang atau menelepon berulang kali untuk menanyakan kepastian permohonan. Bagi pemerintah daerah, hilangnya cetak ulang rencana kegiatan dan pemakaian perangkat milik pengguna menghemat kertas dan waktu kerja, sementara seluruh sistem berjalan tanpa belanja pengadaan. Jadwal yang ditetapkan lebih cepat juga berarti pendampingan protokol, peliputan, dan penyiapan naskah dapat dimulai lebih awal.`));

  tambah(h2("9.7 Catatan atas Modul yang Belum Optimal"));
  const cap = D.modul?.caption_per_status || {};
  const jmlCaption = Object.values(cap).reduce((a, b) => a + b, 0);
  tambah(P(`Dari ${n(sambutanKeg)} kegiatan sambutan, baru ${D.sambutan_disahkan} naskah yang disahkan melalui aplikasi, karena Wali Kota dan Wakil Wali Kota lebih nyaman membaca naskah tercetak yang memberi keleluasaan berimprovisasi. Modul ini tetap tersedia lengkap; aplikasi menyesuaikan diri dengan cara kerja Pimpinan, bukan sebaliknya. Modul yang lebih baru juga masih pada tahap awal pemakaian: rancangan keterangan foto berbantuan kecerdasan buatan baru dipakai ${jmlCaption} kali, dan pemesanan ruang rapat internal dari generator undangan baru tersedia pada Oktober 2026. Keduanya menjadi sasaran pendampingan pengguna pada periode berikutnya.`));

  tambah(h2("9.8 Kepuasan Pengguna"));
  tambah(P(`Berikut testimoni tertulis dari empat pengguna pada jenjang yang berbeda. Lembar keterangan yang ditandatangani masing-masing narasumber dilampirkan pada Lampiran 9.`, { keepNext: true }));
  tambah(tabel({
    judul: "Testimoni tertulis pengguna",
    kolom: [26, 74],
    baris: [
      ["Narasumber", "Testimoni"],
      [["**dr. H. Khairul, M.Kes.**", "Wali Kota Tarakan"], `\u201C${isiTestimoni[0]}\u201D`],
      [["**Muhammad Rizky Dinata Putra, S.Tr.IP.**", "Ajudan Wakil Wali Kota Tarakan"], `\u201C${isiTestimoni[1]}\u201D`],
      [["**Risca Saputri Samtika, S.Pd.**", "Staf Protokol"], `\u201C${isiTestimoni[2]}\u201D`],
      [["**Putri Yunis Mudhaika**", "Pengadministrasi Perkantoran; pernah menjabat Pelaksana Harian"], `\u201C${isiTestimoni[3]}\u201D`],
    ],
  }));


  // ── 10. KEBERLANJUTAN ───────────────────────────────────────────
  tambah(h1("b10"));
  tambah(tabel({
    judul: "Aspek keberlanjutan inovasi",
    kolom: [24, 76],
    baris: [
      ["Aspek", "Keadaan dan pengaturan"],
      ["Pembiayaan", "Biaya berjalan mendekati nol, sehingga tidak bergantung pada ketersediaan anggaran tahunan"],
      ["Pengelola", "Bagian Protokol dan Komunikasi Pimpinan Setda Kota Tarakan"],
      ["Pemeliharaan", pembaruan ? `Pembaruan berkelanjutan berdasarkan masukan pengguna; lebih dari ${bulatBawah(pembaruan, 10)} pembaruan sejak Maret 2026` : "Pembaruan berkelanjutan berdasarkan masukan pengguna"],
      ["SOP", "Sebelas SOP format PermenPAN-RB 35/2012 disusun untuk disahkan Sekretaris Daerah"],
      ["Dukungan kebijakan", "Keputusan Sekda tentang Tim Koordinasi; Surat Sekda tanggal 12 Maret 2026; Surat Edaran Wali Kota tentang Inovasi Daerah"],
      ["Kelembagaan", "Kewenangan melekat pada jabatan dan dapat dilimpahkan kepada Pelaksana Harian, sehingga mutasi pejabat tidak memutus alur kerja"],
    ],
  }));
  tambah(h2("10.1 Rencana Pengembangan"));
  tambah(tabel({
    judul: "Rencana pengembangan",
    kolom: [24, 76],
    baris: [
      ["Waktu", "Rencana"],
      ["Oktober–Desember 2026", "Pengesahan SOP oleh Sekretaris Daerah"],
      ["Januari–Juni 2027", "Pendampingan pengelola kedua dan penyusunan dokumentasi teknis untuk alih pengetahuan; pengetatan kebijakan akses basis data"],
      ["Juli–Desember 2027", "Paket replikasi bagi perangkat daerah di lingkungan Pemerintah Kota Tarakan dan pemerintah daerah lain di Kalimantan Utara (Bagian 11)"],
    ],
  }));
  tambah(h2("10.2 Mitigasi Risiko"));
  tambah(tabel({
    judul: "Risiko dan mitigasinya",
    kolom: [28, 72],
    baris: [
      ["Risiko", "Mitigasi"],
      ["Ketergantungan pada satu pengembang", "Prosedur telah terdokumentasi dalam sebelas SOP; kode tersimpan dalam repositori dengan riwayat perubahan lengkap; akun layanan terdaftar atas nama instansi; alih pengetahuan kepada pengelola kedua dijadwalkan pada 2027"],
      ["Batas kuota layanan tanpa biaya", "Pemakaian dipantau; fungsi baru digabungkan ke fungsi yang ada; pengambilan data hanya untuk data yang berubah"],
      ["Kehilangan data", "Pencadangan berkala; peringatan pencadangan pada setiap jalur penghapusan"],
      ["Perlindungan data pribadi", "Kanal publik tidak menampilkan identitas maupun kontak pemohon; penelusuran menuntut kode lengkap; pengetatan kebijakan akses basis data berjalan bertahap"],
      ["Pejabat berhalangan", "Pelaksana Harian bermasa berlaku yang padam dengan sendirinya"],
    ],
  }));

  // ── 11. REPLIKASI ───────────────────────────────────────────────
  tambah(h1("b11"));
  tambah(h2("11.1 Potensi Adopsi"));
  tambah(P(`Sebagai *superapp*, Prokopim Hibot dapat direplikasi utuh maupun per modul. Di lingkungan Pemerintah Kota Tarakan, Sekretariat DPRD dapat mengadopsi alur penetapan agenda untuk pimpinan dewan, sedangkan modul peminjaman ruangan, permohonan audiensi, dan daftar hadir digital dapat dipakai perangkat daerah yang mengelola ruang pertemuan atau menerima tamu. Di luar Kota Tarakan, tugas keprotokolan dan komunikasi pimpinan dijalankan oleh setiap pemerintah daerah, termasuk Pemerintah Provinsi Kalimantan Utara serta Kabupaten Bulungan, Malinau, Nunukan, dan Tana Tidung. Yang perlu disesuaikan hanya nama jabatan, daftar pengguna, dan tata naskah dinas setempat.`));
  tambah(h2("11.2 Syarat Replikasi"));
  tambah(P(`Replikasi hanya memerlukan peramban dan sambungan internet tanpa perangkat keras khusus, layanan komputasi awan pada kuota tanpa biaya, sebelas SOP yang siap diadaptasi, serta satu pengelola dengan pendampingan. Pengguna cukup dibekali pengenalan singkat.`));
  tambah(h2("11.3 Dokumentasi Pengetahuan"));
  tambah(P(`Pengetahuan kerja telah didokumentasikan dalam sebelas SOP, panduan pemasangan layanan daftar hadir, dan catatan teknis pada kode aplikasi, sehingga perangkat daerah lain dapat mengadopsi prosedurnya lebih dahulu, bahkan sebelum menerapkan aplikasinya.`));
  tambah(h2("11.4 Diseminasi dan Publikasi"));
  tambah(butir([
    `**Lintas perangkat daerah melalui Tim Koordinasi.** Keputusan Sekretaris Daerah melibatkan para Sekretaris Dinas di lingkungan Pemerintah Kota Tarakan dalam Tim Koordinasi, sehingga pelaksanaan inovasi ini diketahui dan melibatkan perangkat daerah lain.`,
    `**Pengenalan langsung kepada pengguna.** Aplikasi diperkenalkan langsung kepada Wali Kota dan Wakil Wali Kota, para ajudan, mitra kerja, dan seluruh pengguna internal Bagian Prokopim.`,
    `**Melalui layanan publik.** Sebanyak ${D.ruang.instansi_berbeda} instansi telah menggunakan layanan peminjaman ruangan dan ${D.tamu.instansi_berbeda} instansi mengajukan audiensi melalui kanal daring, sehingga mengenal langsung cara kerja baru ini.`,
    `**Pemberitahuan resmi.** Surat Sekretaris Daerah Nomor ${NOMOR_SURAT_SEKDA} tanggal 12 Maret 2026 kepada DKISP, yang menyatakan sistem telah dikembangkan dan memohon subdomain resmi, ditembuskan kepada Wali Kota Tarakan dan Kepala Bappeda Litbang.`,
    `**Kanal resmi yang terbuka untuk umum.** Aplikasi berjalan pada alamat resmi pemerintah, prokopim.tarakankota.go.id, dengan halaman permohonan audiensi, peminjaman ruangan, dan daftar hadir yang dapat diakses siapa saja. Agenda yang telah ditetapkan juga tersebar melalui Google Calendar bersama yang dapat dilanggani pihak terkait.`,
  ]));

  tambah(h2("11.5 Pihak yang Telah Memanfaatkan"));
  tambah(tabel({
    judul: "Pihak di luar Bagian Prokopim yang telah memanfaatkan Prokopim Hibot",
    kolom: [38, 62],
    baris: [
      ["Pihak", "Bentuk pemanfaatan"],
      ["Wali Kota, Wakil Wali Kota, ajudan, dan pengawal pribadi", `Menerima agenda; ${n(konfirmasiHadir)} konfirmasi kehadiran; ${aksi.delegasi_to_wwk || 0} disposisi kepada Wakil Wali Kota`],
      ["Dinas Komunikasi, Informatika, Statistik dan Persandian (DKISP)", "Memantau agenda Pimpinan melalui akun mitra kerja; memfasilitasi subdomain resmi aplikasi"],
      ["Ajudan pejabat pimpinan tinggi di Sekretariat Daerah", "Memantau agenda Pimpinan melalui akun mitra kerja"],
      ["Pengemudi Pimpinan dan tenaga ahli media", "Memantau agenda Pimpinan melalui akun mitra kerja"],
      ["Instansi pemohon layanan publik", `${D.ruang.instansi_berbeda} instansi meminjam ruangan; ${D.tamu.instansi_berbeda} instansi mengajukan audiensi`],
    ],
  }));
  return out;
}

// ── 12. LAMPIRAN ───────────────────────────────────────────────────
// Urutan mengikuti Daftar Lampiran (Tabel L.1), yang mengikuti urutan pedoman.
// Lampiran yang berupa pindaian (identitas, SK, surat) tidak dapat dibuat di
// sini; tempatnya ditandai halaman pembatas supaya urutan tetap utuh saat
// pindaiannya disisipkan. SOP disisipkan dari berkas PDF-nya oleh gabung.py.
const NAMA_KETUA = "Anugrah Yega Pranatha, M.Si.";
const NIP_KETUA = "198811032007011003";
// Tanggal pakta dikosongkan untuk ditulis tangan saat ditandatangani.
const TANGGAL_PAKTA = "........ Oktober 2026";
const JUDUL_LENGKAP = `Prokopim Hibot: ${SUBJUDUL}`;

function lampiran() {
  const out = [];
  const tambah = (...x) => out.push(...x.flat());
  const halamanBaru = () => out.push(new Paragraph({ children: [new PageBreak()] }));
  const judulL = (nomor, teks) => {
    halamanBaru();
    out.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: `Lampiran ${nomor}. ${teks}`, bold: true, size: UK, font: FONT })] }));
  };
  const pembatas = (nomor, teks, keterangan) => {
    judulL(nomor, teks);
    out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 3000, after: 200 }, children: runs(`[[${keterangan}]]`, { size: UK, font: FONT }) }));
  };
  const tengahTebal = (teks, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: o.after ?? 0, before: o.before ?? 0 }, children: [new TextRun({ text: teks, bold: true, size: o.size ?? UK, font: FONT, underline: o.garis ? {} : undefined })] });
  const baris2 = (pasangan, lebarKiri = 0.28) => {
    const l = Math.round(LEBAR * lebarKiri), t = 250, r = LEBAR - l - t;
    return new Table({ width: { size: LEBAR, type: WidthType.DXA }, columnWidths: [l, t, r],
      rows: pasangan.map(([a, b]) => new TableRow({ children: [sel(a, l, { borders: tanpaGaris, size: UK }), sel(":", t, { borders: tanpaGaris, size: UK }), sel(b, r, { borders: tanpaGaris, size: UK })] })) });
  };
  const tandaTangan = (atas, nama, bawah, o = {}) => {
    const kiri = Math.round(LEBAR * 0.5), kanan = LEBAR - kiri;
    const isi = [...atas, ...(o.meterai ? ["", "", "[[meterai Rp10.000]]", "", ""] : ["", "", "", ""]), nama.startsWith("[[") ? nama : `**${nama}**`, ...bawah];
    return new Table({ width: { size: LEBAR, type: WidthType.DXA }, columnWidths: [kiri, kanan],
      rows: [new TableRow({ children: [sel("", kiri, { borders: tanpaGaris }), sel(isi, kanan, { borders: tanpaGaris, size: UK, align: AlignmentType.LEFT })] })] });
  };

  tambah(h1("b12"));
  awalanTabel = "L."; nomorTabel = 0;
  tambah(tabel({
    judul: "Daftar lampiran",
    kolom: [7, 93],
    rataTengah: [0],
    baris: [
      ["No", "Lampiran"],
      ["1", "Pakta integritas"],
      ["2", "Surat usulan perangkat daerah (Sekretariat Daerah Kota Tarakan)"],
      ["3", "Bukti identitas anggota tim"],
      ["4", "Tangkapan layar aplikasi"],
      ["5", "Tautan video (disampaikan bila ditetapkan sebagai finalis Top 9)"],
      ["6", `Dokumen keputusan: (a) Keputusan Sekretaris Daerah Nomor ${SK_SEKDA}; (b) Surat Sekretaris Daerah Nomor ${NOMOR_SURAT_SEKDA}`],
      ["7", "Sebelas SOP format PermenPAN-RB 35/2012"],
      ["8", `Keluaran statistik penggunaan per ${PER_TGL}`],
      ["9", "Testimoni pengguna"],
      ["10", "Tautan aplikasi untuk verifikasi"],
    ],
  }));

  // ── Lampiran 1: Pakta integritas ──
  // Mengikuti format Lampiran 2 Petunjuk Teknis (tanpa meterai).
  judulL(1, "Pakta Integritas");
  out.push(tengahTebal("PAKTA INTEGRITAS", { size: 24, after: 280, garis: true }));
  const pribadi = (k) => PRIBADI ? PRIBADI[k] : "[[diisi pada berkas final]]";
  out.push(baris2([
    ["Nama lengkap", NAMA_KETUA],
    ["Tempat/tanggal lahir", pribadi("ttl")],
    ["Nomor identitas", pribadi("nik")],
    ["Instansi", "Bagian Protokol dan Komunikasi Pimpinan, Sekretariat Daerah Kota Tarakan"],
    ["Nomor telepon", "0811-5900-394"],
    ["Email", "anugrahyegapranatha@gmail.com"],
    ["Alamat", pribadi("alamat")],
    ["Judul inovasi", JUDUL_LENGKAP],
    ["Kategori", KATEGORI],
  ]));
  out.push(PN("Dengan ini menyatakan bahwa:", { before: 120 }));
  tambah(angka([
    "Seluruh data dan informasi yang disampaikan adalah benar, valid, dan dapat dipertanggungjawabkan.",
    "Inovasi merupakan karya asli dan tidak melanggar hak kekayaan intelektual pihak lain.",
    "Usulan tidak sedang dalam sengketa dan tidak diajukan pada lebih dari satu kategori.",
    "Kami bersedia mengikuti seluruh tahapan penilaian, memberikan klarifikasi, dan menerima verifikasi.",
    "Kami memberikan izin non-eksklusif kepada penyelenggara untuk mempublikasikan ringkasan, foto, dan video untuk kepentingan promosi dan pembelajaran inovasi daerah dengan mencantumkan nama inovator.",
    "Kami bersedia menerima diskualifikasi atau pencabutan penghargaan apabila pernyataan ini terbukti tidak benar.",
  ]));
  out.push(baris2([["Dibuat di", "Tarakan"], ["Tanggal", TANGGAL_PAKTA]]));
  out.push(new Paragraph({ spacing: { after: 0 }, children: [] }));
  out.push(tandaTangan(["Yang membuat pernyataan,", "Ketua Tim Inovasi Prokopim Hibot,"], NAMA_KETUA, [`NIP ${NIP_KETUA}`]));

  // ── Lampiran 2: Surat usulan ──
  judulL(2, "Surat Usulan Perangkat Daerah");
  out.push(PN(fs.existsSync(SURAT_USULAN_TTE)
    ? "Halaman berikut memuat surat usulan Sekretaris Daerah Kota Tarakan kepada Kepala Bappeda Litbang Kota Tarakan perihal Usulan Staf dan Inovasi, yang ditandatangani secara elektronik."
    : "[[Surat usulan Sekretaris Daerah Kota Tarakan kepada Kepala Bappeda Litbang Kota Tarakan perihal Usulan Staf dan Inovasi disisipkan di sini sesudah ditandatangani elektronik melalui Srikandi.]]"));

  // ── Lampiran 3 ──
  judulL(3, "Bukti Identitas Anggota Tim");

  // ── Lampiran 4: Tangkapan layar ──
  // Diambil dari aplikasi versi terbaru yang dijalankan dengan data contoh
  // (lihat tarakan/tangkapan/). Dikelompokkan menurut lapisan superapp pada
  // Tabel 6 supaya setiap klaim fitur di naskah terlihat wujudnya.
  judulL(4, "Tangkapan Layar Aplikasi");
  out.push(PN("Tangkapan layar diambil dari aplikasi Prokopim Hibot versi terbaru yang dijalankan dengan data contoh, untuk menghindari penyebaran nomor telepon narahubung, data pemohon, dan agenda Pimpinan yang belum terbuka untuk umum. Seluruh tampilan, menu, dan alurnya sama dengan sistem yang berjalan. Gambar dikelompokkan menurut lapisan layanan superapp pada Tabel 6.", { size: UK_TABEL, after: 160 }));
  const DIR_TK = path.join(TARAKAN, "tangkapan");
  const UKURAN_TK = JSON.parse(fs.readFileSync(path.join(DIR_TK, "ukuran.json"), "utf8"));
  const tangkap = (nama, lebarPx) => {
    const [w, h] = UKURAN_TK[nama];
    return new ImageRun({ type: "jpg", data: fs.readFileSync(path.join(DIR_TK, nama + ".jpg")), transformation: { width: lebarPx, height: Math.round(lebarPx * h / w) } });
  };
  const keterangan = (teks) => new Paragraph({ alignment: AlignmentType.CENTER, keepLines: true, spacing: { before: 60, after: 220 }, children: runs(teks, { size: UK_KECIL, font: FONT }) });
  const subjudulL = (teks) => new Paragraph({ keepNext: true, spacing: { before: 120, after: 120 }, children: [new TextRun({ text: teks, bold: true, size: UK, font: FONT })] });
  let g = 0;
  const lebar = (nama, t) => {
    // Gambar tinggi (antrean, riwayat) dipersempit supaya dua gambar tetap muat satu halaman.
    const [w, h] = UKURAN_TK[nama];
    out.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { after: 0, line: 240, lineRule: AUTO }, children: [tangkap(nama, h / w > 0.75 ? 440 : 530)] }));
    out.push(keterangan(`**Gambar L.${++g}.** ${t}`));
  };
  const ponsel = (daftar) => {
    const k = Math.floor(LEBAR / 3);
    out.push(new Table({ width: { size: LEBAR, type: WidthType.DXA }, columnWidths: [k, k, LEBAR - 2 * k], rows: [new TableRow({ cantSplit: true, children:
      [0, 1, 2].map((i) => new TableCell({ width: { size: i < 2 ? k : LEBAR - 2 * k, type: WidthType.DXA }, borders: tanpaGaris, children: daftar[i] ? [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 240, lineRule: AUTO }, children: [tangkap(daftar[i][0], 180)] }),
        keterangan(`**Gambar L.${++g}.** ${daftar[i][1]}`),
      ] : [new Paragraph({ children: [] })] })) })] }));
  };
  const GRUP = [
    ["A. Pimpinan Daerah, Ajudan, dan Mitra Kerja", [
      ["ponsel", [["hp_walikota", "Agenda Wali Kota di telepon pintar: konfirmasi Hadir, Tidak Hadir, atau disposisi kepada Wakil Wali Kota langsung dari kartu agenda"],
                  ["hp_ajudan", "Layar ajudan: jadwal hari ini dan besok yang belum dikonfirmasi, dengan pilihan hadir, tidak hadir, delegasi, atau diwakilkan"],
                  ["hp_staf", "Layar petugas: penugasan mendatang dengan hitung mundur, rekan bertugas, dan pengingat evaluasi"]]],
      ["lebar", "mitra", "Akun mitra kerja (contoh: DKISP) hanya melihat agenda yang telah ditetapkan, lengkap dengan status kehadiran Pimpinan"],
    ]],
    ["B. Pejabat Struktural: Kendali Mutu dan Akuntabilitas", [
      ["lebar", "kabag_antrian", "Antrean persetujuan Kepala Bagian: rincian kegiatan, riwayat alur, dan daftar periksa wajib. Butir “Undangan sudah dibuka” baru tercentang setelah berkas undangan dibuka"],
      ["lebar", "kabag_riwayat", "Riwayat alur (jejak audit): setiap tahap tercatat dengan pelaku, waktu, dan catatan, berlanjut ke fase pelaksanaan (penugasan, konfirmasi kehadiran)"],
      ["lebar", "kabag_usulan", "Usulan perubahan jadwal yang sudah tayang: perbandingan nilai lama dan baru, penanda umur usulan, dan peringatan bahwa konfirmasi kehadiran akan diulang"],
      ["lebar", "kasubbag_jadwal", "Dasbor Kepala Sub Bagian Protokol: peringatan agenda yang belum berpetugas dan daftar jadwal tayang beserta petugasnya"],
      ["lebar", "kasubbag_personil", "Sebaran beban penugasan per petugas, sehingga penugasan dapat dibagi merata"],
      ["lebar", "kabag_plh", "Penetapan Pelaksana Harian berdasarkan Surat Perintah, dengan masa berlaku yang padam dengan sendirinya"],
      ["lebar", "dewi_plh", "Tampilan Pelaksana Harian: penanda kewenangan yang sedang diampu beserta dasar dan batas waktunya"],
    ]],
    ["C. Petugas: Penugasan, Evaluasi, dan Rekap Kinerja", [
      ["lebar", "staf_rekap_saya", "Rekap Kinerja Saya: jumlah penugasan lapangan dan naskah per bulan, dengan cetak bukti dukung kinerja"],
      ["lebar", "staf_ekinerja", "Generator laporan E-Kinerja: uraian kegiatan harian disusun otomatis dari penugasan, siap disalin ke aplikasi e-Kinerja"],
      ["lebar", "kabag_rekap_evaluasi", "Evaluasi kinerja organisasi: skor per tim dan per kriteria dari evaluasi pascakegiatan yang diisi petugas"],
      ["lebar", "kabag_rekap_penugasan", "Rekap penugasan bulanan per tim dan per petugas"],
    ]],
    ["D. Komunikasi dan Dokumentasi Pimpinan", [
      ["lebar", "komdokpim_newsroom", "Review caption oleh Kepala Sub Bagian Komunikasi dan Dokumentasi Pimpinan, dengan rancangan berbantuan kecerdasan buatan"],
      ["lebar", "kabag_komdok", "Pemantauan status caption seluruh agenda oleh Kepala Bagian"],
    ]],
    ["E. Layanan Publik: Audiensi, Peminjaman Ruangan, dan Daftar Hadir", [
      ["ponsel", [["hp_tamu", "Formulir permohonan audiensi daring untuk masyarakat dan instansi"],
                  ["hp_ruangan", "Kalender ketersediaan ruang rapat untuk umum, tanpa menampilkan identitas pemohon"],
                  ["hp_hadir", "Daftar hadir digital melalui pindai kode QR, dengan tanda tangan di layar"]]],
      ["lebar", "kabag_tamu", "Manajemen tamu: telaah berjenjang permohonan audiensi sampai menjadi agenda Pimpinan"],
      ["lebar", "kabag_ruangan", "Dasbor peminjaman ruangan: pengajuan menunggu, permintaan batal, dan penanda pengajuan yang perlu segera diproses"],
      ["lebar", "kabag_ruangan_kalender", "Kalender peminjaman Ruang Kenawai dan Imbaya untuk pengelola"],
      ["lebar", "staf_daftar_hadir", "Pengelolaan acara daftar hadir: tautan, kode QR, buka-tutup otomatis, dan rekap di spreadsheet instansi"],
    ]],
    ["F. Administrasi dan Integrasi", [
      ["lebar", "undangan_imbaya", "Generator undangan siap tanda tangan elektronik Srikandi, dengan pratinjau PDF serta pemeriksaan dan pemesanan Ruang Imbaya dari formulir yang sama"],
      ["lebar", "kabag_kalender_bersama", "Pengaturan tampilan di Google Calendar bersama: agenda yang disetujui tampil otomatis dan dapat ditahan bila perlu"],
      ["lebar", "kabag_agenda", "Agenda kegiatan Pimpinan dengan sorotan hari ini, prakiraan cuaca, perkiraan waktu tempuh, dan kartu agenda yang dapat dibagikan"],
      ["lebar", "kabag_rekap_wa", "Rekap agenda harian siap kirim melalui WhatsApp"],
      ["lebar", "kabag_laporan", "Laporan mingguan dan bulanan kegiatan Pimpinan, siap cetak"],
    ]],
  ];
  GRUP.forEach(([judul, isiGrup]) => {
    out.push(subjudulL(judul));
    for (const it of isiGrup) it[0] === "ponsel" ? ponsel(it[1]) : lebar(it[1], it[2]);
  });

  // ── Lampiran 5 ──
  judulL(5, "Tautan Video");
  out.push(P("Sesuai Petunjuk Teknis Bab 4.4, video singkat yang memvisualisasikan latar belakang, masalah, solusi, implementasi, dan dampak inovasi, lengkap dengan thumbnail dan identitas Pemerintah Kota Tarakan, disiapkan oleh peserta yang ditetapkan sebagai finalis Top 9. Tautan video akan disampaikan pada tahap tersebut."));

  // ── Lampiran 6 ──
  judulL(6, "Dokumen Keputusan");
  out.push(PN(`Halaman-halaman berikut memuat (a) Keputusan Sekretaris Daerah Kota Tarakan Nomor ${SK_SEKDA} tentang Tim Koordinasi Peningkatan Pelayanan Keprotokolan dan Komunikasi Pimpinan, dan (b) Surat Sekretaris Daerah Kota Tarakan Nomor ${NOMOR_SURAT_SEKDA} tanggal 12 Maret 2026 perihal Permohonan Subdomain.`));

  // ── Lampiran 7 (isi disisipkan dari SOP-Prokopim.pdf) ──
  judulL(7, "Sebelas Standar Operasional Prosedur");
  out.push(PN(TANPA_SOP
    ? "Sebelas SOP sebagaimana tercantum pada Bagian 7.4 telah selesai disusun mengikuti format PermenPAN-RB 35/2012 dan kini dalam proses pengesahan oleh Sekretaris Daerah Kota Tarakan. Dokumen lengkapnya tidak disertakan pada berkas ini dan dapat diserahkan apabila diminta oleh Tim Penilai."
    : "Halaman-halaman berikut memuat sebelas SOP format PermenPAN-RB 35/2012 yang menjadi dasar alur kerja Prokopim Hibot."));

  // ── Lampiran 8 ──
  judulL(8, `Keluaran Statistik Penggunaan per ${PER_LENGKAP}`);
  out.push(PN(`Ditarik langsung dari basis data Prokopim Hibot menggunakan kueri baca-saja. Seluruh angka pada naskah proposal bersumber dari keluaran ini.`, { size: UK_TABEL }));
  const LABEL_AKSI = {
    create: "Jadwal dibuat", submit: "Diajukan Admin Rencana Kegiatan", forward_to_kabag: "Diteruskan Kepala Sub Bagian",
    publish: "Disetujui dan tayang", return_by_kasubbag: "Dikembalikan Kepala Sub Bagian", reject_by_kabag: "Ditolak Kepala Bagian",
    resubmit: "Diajukan ulang", recall_published: "Ditarik dari publikasi", penugasan_personil: "Penugasan petugas",
    evaluasi_diisi: "Evaluasi petugas diisi", wk_hadir: "Wali Kota dikonfirmasi hadir", wk_diwakilkan: "Wali Kota diwakilkan",
    wk_tidak_hadir: "Wali Kota tidak hadir", wwk_hadir: "Wakil Wali Kota dikonfirmasi hadir", wwk_diwakilkan: "Wakil Wali Kota diwakilkan",
    wwk_tidak_hadir: "Wakil Wali Kota tidak hadir", delegasi_to_wwk: "Didisposisi kepada Wakil Wali Kota", cancel_delegasi: "Disposisi dibatalkan",
    delegasi_jajaran: "Didisposisi kepada jajaran", usulan_edit_diajukan: "Usulan perubahan diajukan", usulan_edit_ke_kabag: "Usulan perubahan diteruskan",
    usulan_edit_disetujui: "Usulan perubahan disetujui", upload_undangan: "Berkas undangan diunggah", upload_sambutan: "Naskah sambutan diunggah",
    sambutan_disahkan: "Naskah sambutan disahkan",
  };
  const aksiUrut = Object.entries(D.jejak.per_aksi).sort((a, b) => b[1] - a[1]);
  const separuh = Math.ceil(aksiUrut.length / 2);
  const barisAksi = [["Peristiwa", "Jumlah", "Peristiwa", "Jumlah"]];
  for (let i = 0; i < separuh; i++) {
    const a = aksiUrut[i], b = aksiUrut[i + separuh];
    barisAksi.push([LABEL_AKSI[a[0]] || a[0], n(a[1]), b ? (LABEL_AKSI[b[0]] || b[0]) : "", b ? n(b[1]) : ""]);
  }
  barisAksi.push([{ t: "Jumlah peristiwa", bold: true, span: 3 }, { t: n(D.jejak.peristiwa_total), bold: true }]);
  out.push(...tabel({ judul: "Peristiwa pada jejak audit menurut jenisnya", kolom: [36, 14, 36, 14], rataTengah: [1, 3], baris: barisAksi, ukuran: UK_KECIL }));

  const LABEL_PERAN = {
    staf: "Staf Protokol", kabag: "Kepala Bagian", timkom: "Tim Komunikasi dan Dokumentasi", walpri: "Pengawal pribadi (walpri)",
    admin_rk: "Admin Rencana Kegiatan", walikota: "Wali Kota", superadmin: "Administrator sistem", mitra_kerja: "Mitra Kerja Pemerintah Kota",
    wakilwalikota: "Wakil Wali Kota", admin_undangan: "Admin Undangan", ajudan_walikota: "Ajudan Wali Kota",
    kasubbag_protokol: "Kepala Sub Bagian Protokol", kasubbag_komdokpim: "Kepala Sub Bagian Komunikasi dan Dokumentasi Pimpinan", ajudan_wakilwalikota: "Ajudan Wakil Wali Kota",
    pramu_tamu: "Pramu Tamu",
  };
  const peranUrut = Object.entries(peran).sort((a, b) => b[1] - a[1]);
  const sp = Math.ceil(peranUrut.length / 2);
  const barisPeran = [["Peran", "Akun", "Peran", "Akun"]];
  for (let i = 0; i < sp; i++) {
    const a = peranUrut[i], b = peranUrut[i + sp];
    barisPeran.push([LABEL_PERAN[a[0]] || a[0], String(a[1]), b ? (LABEL_PERAN[b[0]] || b[0]) : "", b ? String(b[1]) : ""]);
  }
  barisPeran.push([{ t: "Jumlah akun aktif", bold: true, span: 3 }, { t: String(D.pengguna.aktif), bold: true }]);
  out.push(...tabel({ judul: "Akun aktif menurut peran", kolom: [36, 14, 36, 14], rataTengah: [1, 3], baris: barisPeran, ukuran: UK_KECIL }));

  const rs = D.ruang.per_status, ts = D.tamu.per_status;
  out.push(...tabel({
    judul: "Layanan publik",
    kolom: [60, 40],
    ukuran: UK_KECIL,
    baris: [
      ["Uraian", "Jumlah"],
      ["Pengajuan peminjaman ruangan", `${D.ruang.pengajuan} (disetujui ${rs.Approved || 0}, ditolak ${rs.Rejected || 0}, dibatalkan ${rs.Cancelled || 0}${rs.Pending ? `, menunggu ${rs.Pending}` : ""})`],
      ["Instansi peminjam ruangan", String(D.ruang.instansi_berbeda)],
      ["Peserta pada peminjaman yang disetujui", n(D.ruang.peserta_disetujui)],
      ["Permohonan audiensi", `${D.tamu.total} (selesai ${ts.selesai || 0}, ditolak ${ts.rejected || 0}, dalam proses ${Object.entries(ts).filter(([k]) => k.startsWith("pending")).reduce((s, [, v]) => s + v, 0)})`],
      ["Instansi pemohon audiensi", String(D.tamu.instansi_berbeda)],
      ["Permohonan audiensi yang menjadi agenda", String(D.agenda_dari_permohonan_tamu)],
      ["Perangkat berlangganan notifikasi", `${D.perangkat_notifikasi.perangkat} perangkat milik ${D.perangkat_notifikasi.pengguna} pengguna`],
    ],
  }));

  // ── Lampiran 9: Testimoni ──
  const narasumber = [
    ["dr. H. Khairul, M.Kes.", "Wali Kota Tarakan", "Bagaimana kepastian agenda dirasakan sebelum dan sesudah aplikasi ini dipakai?"],
    ["Muhammad Rizky Dinata Putra, S.Tr.IP.", "Ajudan Wakil Wali Kota Tarakan", "Bagaimana Bapak/Ibu mengetahui agenda dan menyiapkan bahannya dahulu, dan apa yang berubah sekarang?"],
    ["Risca Saputri Samtika, S.Pd.", "Staf Protokol, Bagian Protokol dan Komunikasi Pimpinan", "Dahulu bagaimana mengetahui diri sedang ditugaskan, dan apakah pernah terjadi pemberitahuan yang terlambat atau tidak sampai?"],
    ["Putri Yunis Mudhaika", "Pengadministrasi Perkantoran, Bagian Protokol dan Komunikasi Pimpinan", "Bagaimana pengalaman Bapak/Ibu menjalankan kewenangan sebagai Pelaksana Harian melalui aplikasi ini?"],
  ];
  const nipNarasumber = [null, "199803252022081001", "199506062025212058", "198206102008012030"];
  narasumber.forEach(([nama, jabatan, tanya], i) => {
    judulL(9, `Testimoni Pengguna (${i + 1} dari ${narasumber.length})`);
    out.push(tengahTebal("KETERANGAN PENGGUNA APLIKASI PROKOPIM HIBOT", { after: 240 }));
    out.push(PN("Yang bertanda tangan di bawah ini:"));
    out.push(baris2([["Nama", nama], ["Jabatan", jabatan], ["Instansi", "Pemerintah Kota Tarakan"]]));
    out.push(PN(`memberikan keterangan atas pemakaian aplikasi Prokopim Hibot, menjawab pertanyaan: *${tanya}*`, { before: 160 }));
    out.push(new Table({ width: { size: LEBAR, type: WidthType.DXA }, columnWidths: [LEBAR],
      rows: [new TableRow({ height: { value: 2800, rule: "atLeast" }, children: [sel(isiTestimoni[i], LEBAR, { size: UK, align: AlignmentType.JUSTIFIED })] })] }));
    out.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
    out.push(tandaTangan(["Tarakan, 30 September 2026", `${jabatan},`], nama, nipNarasumber[i] ? [`NIP ${nipNarasumber[i]}`] : []));
  });

  // ── Lampiran 10 ──
  judulL(10, "Tautan Aplikasi untuk Verifikasi");
  out.push(PN("Halaman publik berikut dapat dibuka tanpa akun. Demonstrasi seluruh alur dengan akun pengguna disiapkan pada Tahap II."));
  tambah(tabel({ kolom: [45, 55], baris: [
    ["Layanan", "Alamat"],
    ["Aplikasi Prokopim Hibot", "https://prokopim.tarakankota.go.id"],
    ["Permohonan audiensi", "https://prokopim.tarakankota.go.id/tamu"],
    ["Peminjaman ruangan", "https://prokopim.tarakankota.go.id/pinjamruangan"],
  ] }));
  return out;
}

// ═══════════════════════════════════════════════════════════════════
//  SAMPUL DAN DAFTAR ISI
// ═══════════════════════════════════════════════════════════════════
function sampul() {
  // Mengikuti format Lampiran 1 Petunjuk Teknis; bidang fokus ditambahkan
  // sesuai paparan sosialisasi.
  const tengah = (teks, o = {}) => new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: o.before ?? 0, after: o.after ?? 0, line: o.line ?? 276, lineRule: AUTO },
    indent: o.inden ? { left: o.inden, right: o.inden } : undefined,
    children: [new TextRun({ text: teks, bold: o.bold ?? true, size: o.size ?? UK, font: FONT })],
  });
  return [
    tengah("PROPOSAL", { size: 32, after: 60 }),
    tengah("LOMBA INOVASI DAERAH KOTA TARAKAN", { size: 28, after: 60 }),
    tengah("TAHUN 2026", { size: 28, after: 520 }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 520, line: 240, lineRule: AUTO }, children: [gambar("logo_tarakan.png", 140)] }),
    tengah(JUDUL, { size: 40, after: 100 }),
    tengah(SUBJUDUL, { size: 26, line: 300, inden: 500, after: 440 }),
    tengah(KATEGORI.toUpperCase(), { size: 24, after: 80 }),
    tengah(`Bidang Fokus: ${BIDANG_FOKUS}`, { size: 20, bold: false, inden: 500, after: 440 }),
    tengah("TIM INOVASI PROKOPIM HIBOT", { size: 24, after: 80 }),
    ...TIM.map(([nama, , kedudukan]) => tengah(`${nama} (${kedudukan})`, { size: 22, bold: false })),
    tengah("BAGIAN PROTOKOL DAN KOMUNIKASI PIMPINAN", { size: 24, before: 440 }),
    tengah("SEKRETARIAT DAERAH KOTA TARAKAN", { size: 24 }),
    tengah("KOTA TARAKAN", { size: 26, before: 700 }),
    tengah("TAHUN 2026", { size: 26 }),
  ];
}

function daftarIsi(halaman) {
  const out = [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: "DAFTAR ISI", bold: true, size: UK, font: FONT })] })];
  const entri = (teks, tingkat, hal) => new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: LEBAR, leader: "dot" }],
    indent: { left: tingkat === 1 ? 0 : 400 },
    spacing: { after: tingkat === 1 ? 30 : 0, before: tingkat === 1 ? 60 : 0, line: 240, lineRule: AUTO },
    children: [new TextRun({ text: hal === null ? teks : `${teks}\t${hal ?? ""}`, bold: tingkat === 1, size: tingkat === 1 ? UK : UK_TABEL, font: FONT })],
  });
  for (const j of urutanJudul) out.push(entri(j.teks, j.tingkat, j.teks === BAB.b12 ? null : (halaman?.[j.teks] ?? "")));
  out.push(new Paragraph({ spacing: { before: 200 }, children: runs("*Penomoran bagian mengikuti Petunjuk Teknis Bab 4.2, yang menempatkan Sampul sebagai Bagian 1. Halaman isi dinomori mulai Bagian 2; sampul dan lampiran tidak termasuk dalam batas 20 halaman.*", { size: UK_KECIL, font: FONT }) }));
  return out;
}

// ═══════════════════════════════════════════════════════════════════
//  DOKUMEN
// ═══════════════════════════════════════════════════════════════════
function buatDokumen(halaman) {
  nomorDaftar = 0; nomorTabel = 0; nomorGambar = 0; awalanTabel = ""; urutanJudul.length = 0;
  const bagianIsi = isi();
  const bagianLampiran = lampiran();
  const kaki = (anak) => ({ default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: anak })] }) });
  const halamanDasar = { margin: MARGIN };

  return new Document({
    creator: "Tim Inovasi Prokopim Hibot",
    title: "Proposal Lomba Inovasi Daerah Kota Tarakan 2026 — Prokopim Hibot",
    description: "Lomba Inovasi Daerah Kota Tarakan 2026, Kategori A",
    styles: {
      default: {
        document: { run: { font: FONT, size: UK }, paragraph: { spacing: { line: 276, lineRule: AUTO } } },
      },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: FONT, size: UK, bold: true, color: HITAM },
          paragraph: { spacing: { before: 280, after: 140, line: 276, lineRule: AUTO }, keepNext: true, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: FONT, size: UK, bold: true, color: HITAM },
          paragraph: { spacing: { before: 180, after: 80, line: 276, lineRule: AUTO }, keepNext: true, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [
        { reference: "butir", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 283 } } } }] },
        { reference: "huruf", levels: [{ level: 0, format: LevelFormat.LOWER_LETTER, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 340 } } } }] },
        { reference: "angka", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 340 } } } }] },
      ],
    },
    sections: [
      { properties: { page: halamanDasar }, footers: kaki([]), children: sampul() },
      { properties: { type: SectionType.NEXT_PAGE, page: { ...halamanDasar, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } } },
        footers: kaki([new TextRun({ children: [PageNumber.CURRENT], size: UK_TABEL, font: FONT })]), children: daftarIsi(halaman) },
      { properties: { type: SectionType.NEXT_PAGE, page: { ...halamanDasar, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
        footers: kaki([new TextRun({ children: [PageNumber.CURRENT], size: UK_TABEL, font: FONT })]), children: bagianIsi },
      { properties: { type: SectionType.NEXT_PAGE, page: halamanDasar },
        footers: kaki([new TextRun({ text: "Lampiran", size: UK_KECIL, italics: true, font: FONT })]), children: bagianLampiran },
    ],
  });
}

// Pedoman mensyaratkan Arial. Tanpa berkas Arial terpasang, LibreOffice diam-diam
// memakai pengganti (Liberation Sans) — hentikan saja agar tidak lolos.
// Pasang ARIAL.TTF, ARIALBD.TTF, ARIALI.TTF, ARIALBI.TTF ke ~/.fonts lalu fc-cache -f.
{
  let cocok = "";
  try { cocok = execFileSync("fc-match", ["-f", "%{family}", "Arial"], { encoding: "utf8" }); } catch {}
  if (!/^Arial\b/.test(cocok)) {
    console.error(`Font Arial belum terpasang (fc-match Arial → "${cocok || "?"}"). Lihat catatan di atas.`);
    process.exit(1);
  }
}

async function tulisDanRender(halaman) {
  const buf = await Packer.toBuffer(buatDokumen(halaman));
  fs.writeFileSync(KELUAR + ".docx", buf);
  execFileSync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", path.dirname(KELUAR), KELUAR + ".docx"], { stdio: "ignore" });
}

// ═══════════════════════════════════════════════════════════════════
//  TEKS ISIAN RISDA
// ═══════════════════════════════════════════════════════════════════
// Ringkasan per bagian untuk disalin ke kolom isian aplikasi RISDA
// (tarakankota.risda.online). Teks polos tanpa tabel atau huruf tebal supaya
// rapi ketika ditempel; angka memakai data yang sama dengan proposal.
function isianRisda() {
  const persen = (a, b) => pct(a, b);
  const bagian = [
    ["IDENTITAS USULAN", [
      `Judul inovasi: ${JUDUL_LENGKAP}`,
      `Kategori: ${KATEGORI.replace(/^Kategori /, "")}`,
      `Bidang fokus: ${BIDANG_FOKUS}`,
      `Inovator: Tim Inovasi Prokopim Hibot — ${TIM.map(([nm, , kd]) => `${nm} (${kd})`).join("; ")}`,
      `Instansi: Bagian Protokol dan Komunikasi Pimpinan, Sekretariat Daerah Kota Tarakan`,
      `Mulai diterapkan: Maret 2026 (kegiatan pertama ${tglPanjang(D.tanggal_kegiatan.awal)}); lama implementasi per 1 Oktober 2026: ${MASA}`,
      `Tautan aplikasi: https://prokopim.tarakankota.go.id`,
      `Kontak ketua tim: 0811-5900-394; anugrahyegapranatha@gmail.com`,
    ]],
    ["2. RINGKASAN EKSEKUTIF", [
      `Masalah. Bagian Protokol dan Komunikasi Pimpinan mengelola agenda Wali Kota dan Wakil Wali Kota dengan volume rata-rata ${rataBulan} kegiatan per bulan. Sampai awal 2026 seluruh prosesnya manual: rencana kegiatan disusun di spreadsheet lalu dicetak, penelaahan hanya dalam satu jendela sekitar 30 menit menjelang jam pulang, disposisi diteruskan sebagai foto di grup percakapan, dan penugasan petugas bergantung pada ingatan. Pada Januari 2026 satu lembar disposisi agenda tidak ikut terkirim tanpa ada yang mengetahuinya. Akar masalahnya: tidak ada satu sumber data yang sahih dan dapat diperiksa semua pihak.`,
      `Solusi. Prokopim Hibot adalah superapp pelayanan keprotokolan dan komunikasi pimpinan: satu aplikasi web progresif yang menyatukan sebelas alur kerja dalam satu data dan satu pintu, mulai dari penetapan jadwal berjenjang, penugasan petugas, audiensi dan peminjaman ruangan, undangan siap tanda tangan elektronik Srikandi, sampai daftar hadir digital dan evaluasi petugas. Setiap keputusan terekam pada jejak audit.`,
      `Implementasi. Digunakan sejak Maret 2026, dikuatkan Surat Sekda Nomor ${NOMOR_SURAT_SEKDA} dan Keputusan Sekda Nomor ${SK_SEKDA}, dengan sebelas SOP. Per 1 Oktober 2026 telah berjalan ${MASA}.`,
      `Penerima manfaat. ${D.pengguna.aktif} akun aktif pada ${jumlahPeran} peran (Pimpinan Daerah, ajudan, pengawal pribadi, pejabat, petugas, mitra kerja lintas unit), serta ${D.ruang.instansi_berbeda} instansi peminjam ruangan dan ${D.tamu.instansi_berbeda} instansi pemohon audiensi.`,
      `Bukti dampak (data aplikasi per ${PER_LENGKAP}): ${n(T)} kegiatan terkelola; median ${dk(K.median_ajukan_tayang_jam, 2)} jam dari pengajuan sampai jadwal tayang (sebelumnya diperkirakan 18–24 jam); ${persen(K.tayang_dalam_24_jam, K.kegiatan_jejak_lengkap)} tayang kurang dari 24 jam; ${persen(luarJam, putusanTotal)} penelaahan dan persetujuan terjadi di luar jam kerja; ${n(D.jejak.peristiwa_total)} peristiwa terekam pada jejak audit; ${persen(D.dengan_penugasan_petugas, T)} kegiatan berpenugasan petugas tercatat; belanja pengadaan Rp0.`,
    ]],
    ["3. PROFIL INOVATOR/TIM", [
      `Tim Inovasi Prokopim Hibot, Bagian Protokol dan Komunikasi Pimpinan Sekretariat Daerah Kota Tarakan. Susunan tim diambil dari Keputusan Sekda Nomor ${SK_SEKDA} tentang Tim Koordinasi Peningkatan Pelayanan Keprotokolan dan Komunikasi Pimpinan (42 anggota).`,
      ...TIM.map(([nm, jb, kd, pr], i) => `${i + 1}. ${nm} — ${jb} — ${kd}: ${pr}.`),
      `Kontak ketua tim: 0811-5900-394; anugrahyegapranatha@gmail.com.`,
    ]],
    ["4. LATAR BELAKANG DAN ANALISIS MASALAH", [
      `Data dasar. Berdasarkan Perwali Tarakan 50/2021, Bagian Prokopim menyiapkan jadwal, mengoordinasikan kegiatan, menyusun naskah sambutan, dan mendokumentasikan kegiatan Kepala Daerah. Sejak Maret sampai ${PER_TGL} tercatat ${n(T)} kegiatan (${n(D.kegiatan_per_pimpinan.walikota)} untuk Wali Kota, ${n(D.kegiatan_per_pimpinan.wakilwalikota)} untuk Wakil Wali Kota), ${n(sambutanKeg)} di antaranya kegiatan sambutan.`,
      `Kondisi sebelum. Rencana kegiatan disusun di spreadsheet dan dicetak; penelaahan hanya sekali sehari ±30 menit pada hari kerja; kegiatan mendesak memerlukan cetak ulang; disposisi diteruskan sebagai foto; penugasan tidak tercatat; ketersediaan ruangan di papan tulis; pemohon audiensi harus datang atau menelepon.`,
      `Peristiwa pemicu. Januari 2026, satu berkas disposisi tiga lembar hanya diterima dua lembar karena satu lembar tidak ikut terfoto saat diteruskan di grup percakapan, dan tidak ada pihak yang dapat mengetahuinya.`,
      `Akar masalah: tidak ada satu sumber data yang sahih. Turunannya: penelaahan terikat jendela waktu; keputusan tidak berjejak; versi dokumen beredar ganda; pengetahuan kerja melekat pada orang; layanan publik tidak dapat ditelusuri. Karena persoalan tersebar di banyak saluran (kertas, spreadsheet, grup percakapan, papan tulis, telepon), jawabannya adalah satu wadah bagi seluruh layanan: superapp.`,
      `Urgensi. Kegiatan yang tidak tercatat berarti Pimpinan hadir tanpa pendampingan, peliputan, dan naskah yang matang. SE Wali Kota Nomor ${SE_WALIKOTA} mendorong inovasi berbasis digital.`,
      `Sasaran: Wali Kota dan Wakil Wali Kota; ajudan dan pengawal pribadi; Kepala Bagian dan Kepala Sub Bagian; petugas protokol, pramu tamu, dan dokumentasi; masyarakat, instansi, dan mitra kerja. Sumber data: telaah alur kerja (kondisi sebelum) dan basis data aplikasi melalui kueri baca-saja (kondisi sesudah).`,
    ]],
    ["5. KESELARASAN DENGAN RPJMD", [
      `Mendukung visi RPJMD Kota Tarakan 2025–2029 "Tarakan sebagai Kota Cerdas" pada sisi tata kelola, khususnya Misi 4: tata kelola pemerintahan yang adaptif, responsif, dan menjaga stabilitas ketertiban dan ketenteraman kota. Adaptif: kerja tanpa kertas dari telepon pintar. Responsif: jadwal ditetapkan dalam hitungan jam dan permohonan masyarakat dapat ditelusuri. Stabilitas: kehadiran Pimpinan selalu didampingi petugas yang siap.`,
      `Kategori A dijawab langsung: tata kelola (kewenangan melekat pada jabatan, Pelaksana Harian bermasa berlaku), proses bisnis (tanpa jendela waktu, sebelas SOP), digitalisasi (sebelas alur dalam satu superapp, undangan siap TTE Srikandi), data (satu data kegiatan), manajemen (sebaran beban dan kinerja petugas), pengawasan (jejak audit dan daftar periksa wajib), efisiensi (median ${dk(K.median_ajukan_tayang_jam, 2)} jam, Rp0 pengadaan).`,
      `Nama inovasi mengusung semboyan "Tarakan HIBOT" (Handal, Inovatif, Berbudaya, Unggul/Oenggoel, Tangguh) dan sejalan dengan tema "Inovasi Berdampak, Tarakan Maju dan Berdaya Saing".`,
      `Regulasi terkait: UU 23/2014; UU 25/2009; UU 9/2010 tentang Keprotokolan; PP 38/2017; Permendagri 104/2018; Perpres 95/2018 dan 82/2023; PermenPAN-RB 35/2012; Perda Kota Tarakan 2/2025 (RPJMD); Perwali 20/2025 (RKPD 2026); Perwali 41/2025 (Penyelenggaraan Inovasi Daerah); Perwali 50/2021; SE Wali Kota ${SE_WALIKOTA}; Keputusan Sekda ${SK_SEKDA}.`,
    ]],
    ["6. DESKRIPSI DAN KEBARUAN", [
      `Konsep: setiap kegiatan Pimpinan memiliki satu data yang sama bagi semua pihak, dan setiap keputusan atasnya tercatat. Di atasnya dibangun superapp: satu aplikasi, satu pintu, banyak layanan, dengan tampilan sesuai peran.`,
      `Lapisan layanan: Pimpinan Daerah (agenda terkini, disposisi kepada Wakil Wali Kota); ajudan dan pengawal pribadi (pemberitahuan dini, konfirmasi kehadiran, pengingat); pejabat struktural (antrean persetujuan dengan daftar periksa, pemantauan usulan perubahan, Pelaksana Harian); petugas (penugasan melalui aplikasi dan WhatsApp, rekap pagi, evaluasi); masyarakat dan instansi (audiensi dan peminjaman ruangan daring dengan kode penelusuran, daftar hadir QR); integrasi (Google Calendar otomatis, notifikasi, undangan siap TTE Srikandi).`,
      `Cara kerja: Admin Rencana Kegiatan menginput jadwal dan undangan → Kepala Sub Bagian Protokol menelaah → Kepala Bagian menyetujui → jadwal tayang kepada Pimpinan, ajudan, dan petugas, lalu tersalin otomatis ke kalender bersama.`,
      `Kebaruan: (a) jejak audit melekat pada setiap kegiatan; (b) daftar periksa wajib sebelum persetujuan; (c) kewenangan melekat pada jabatan dengan Pelaksana Harian yang padam sendiri; (d) pengawasan usulan perubahan menurut kegentingan; (e) kanal publik yang dapat ditelusuri tanpa membuka data pribadi; (f) sinkron otomatis ke Google Calendar; (g) undangan PDF siap TTE Srikandi dengan pemesanan ruang rapat Imbaya/Kenawai sekaligus.`,
      `Perbedaan dengan cara lama: satu data terkini menggantikan beberapa versi cetakan; pemberitahuan otomatis hanya kepada yang berubah; alur tidak berhenti saat pejabat berhalangan; kalender bersama terisi sendiri; satu superapp menggantikan kertas, grup percakapan, papan tulis, dan telepon.`,
    ]],
    ["7. PELAKSANAAN INOVASI", [
      `Waktu mulai: Maret 2026 (kegiatan pertama ${tglPanjang(D.tanggal_kegiatan.awal)}). Lama implementasi per 1 Oktober 2026: ${MASA}. Lokasi: Bagian Prokopim Setda Kota Tarakan, dapat diakses dari mana saja. Pengguna: ${D.pengguna.aktif} akun aktif pada ${jumlahPeran} peran.`,
      `Tahapan: Januari 2026 peristiwa pemicu dan telaah alur kerja; Februari–Maret pembangunan, uji coba, dan mulai digunakan; Mei jejak audit dan kanal peminjaman ruangan; Juli–Agustus audiensi terhubung ke agenda, notifikasi, kalender ruangan, daftar hadir digital; September Pelaksana Harian, daftar periksa wajib, pemantauan usulan perubahan, sinkron Google Calendar; Oktober generator undangan siap TTE Srikandi dan pemesanan ruang rapat internal.${pembaruan ? ` Tercatat lebih dari ${bulatBawah(pembaruan, 10)} pembaruan aplikasi sejak Maret 2026.` : ""}`,
      `SOP dan regulasi: sebelas SOP format PermenPAN-RB 35/2012 (satu untuk setiap alur), Keputusan Sekda Nomor ${SK_SEKDA}, dan Surat Sekda Nomor ${NOMOR_SURAT_SEKDA}. Dokumentasi: tangkapan layar (Lampiran 4) dan video bagi finalis.`,
    ]],
    ["8. SUMBER DAYA DAN KOLABORASI", [
      `SDM: dikembangkan swakelola oleh Ketua Tim dengan asisten pemrograman berbasis kecerdasan buatan; anggota tim dan pelaksana Bagian Prokopim menjadi pengguna sekaligus penguji; diperkuat Tim Koordinasi 42 orang termasuk para Sekretaris Dinas.`,
      `Anggaran: belanja pengadaan Rp0. Teknologi dan sarana: peladen tanpa server dan basis data terkelola pada kuota tanpa biaya, Google Calendar dan spreadsheet milik instansi, telepon pintar milik pengguna; biaya berjalan hanya langganan gerbang pesan WhatsApp. Ketika lalu lintas data sempat 6,4 GB/bulan (kuota 5 GB), pengambilan data diubah sehingga turun menjadi ±1 GB.`,
      `Mitra dan peran: Sekda (menetapkan Tim Koordinasi dan menguatkan penggunaan); Wali Kota dan Wakil Wali Kota (pengguna langsung, ${aksi.delegasi_to_wwk || 0} disposisi); ajudan dan pengawal pribadi (${n(konfirmasiHadir)} konfirmasi kehadiran); DKISP (subdomain prokopim.tarakankota.go.id); Bappeda Litbang (pengampu inovasi daerah); ${peran.mitra_kerja || 0} akun mitra kerja lintas unit.`,
    ]],
    ["9. HASIL, MANFAAT, DAN BUKTI DAMPAK", [
      `Sebelum–sesudah: waktu dari undangan masuk sampai tercantum di agenda ±18–24 jam (jalur tercepat, estimasi) menjadi median ${dk(K.median_ajukan_tayang_jam, 2)} jam; ${persen(K.tayang_dalam_4_jam, K.kegiatan_jejak_lengkap)} tayang kurang dari 4 jam dan ${persen(K.tayang_dalam_24_jam, K.kegiatan_jejak_lengkap)} kurang dari 24 jam. Penelaahan dari sekali sehari menjadi setiap saat (${persen(luarJam, putusanTotal)} di luar jam kerja). Keputusan Kepala Bagian median ${jamMenit(K.median_teruskan_tayang_jam)}.`,
      `Mutu dan akuntabilitas: ${n(D.jejak.peristiwa_total)} peristiwa terekam; ${D.dikembalikan_untuk_diperbaiki} kegiatan dikembalikan untuk diperbaiki sebelum ditetapkan; ${D.jejak.dengan_daftar_periksa} keputusan melalui daftar periksa wajib; ${D.jejak.oleh_plh} tindakan oleh Pelaksana Harian; ${n(D.dengan_penugasan_petugas)} kegiatan (${persen(D.dengan_penugasan_petugas, T)}) berpenugasan petugas; ${n(D.undangan_terarsip)} undangan terarsip; ${n(D.sudah_dievaluasi)} kegiatan dievaluasi.`,
      `Pertumbuhan: ${vAwal} kegiatan pada ${namaBulan(bPenuhAwal)} menjadi ${vAkhir} pada ${namaBulan(bPenuhAkhir)} (naik ${naik}%).`,
      `Jangkauan: ${D.ruang.pengajuan} pengajuan ruangan dari ${D.ruang.instansi_berbeda} instansi (${n(D.ruang.peserta_disetujui)} peserta); ${D.tamu.total} permohonan audiensi dari ${D.tamu.instansi_berbeda} instansi, ${D.agenda_dari_permohonan_tamu} menjadi agenda Pimpinan; notifikasi aktif pada ${D.perangkat_notifikasi.perangkat} perangkat.`,
      `Kepuasan: testimoni tertulis bertanda tangan dari Wali Kota Tarakan, Ajudan Wakil Wali Kota, Staf Protokol, dan Pelaksana Harian (Lampiran 9).`,
      `Sosial-ekonomi: masyarakat tidak perlu datang atau menelepon berulang; hemat kertas dan waktu kerja; tanpa belanja pengadaan.`,
      `Catatan: pengesahan naskah sambutan melalui aplikasi baru ${D.sambutan_disahkan} naskah karena Pimpinan lebih nyaman dengan naskah tercetak; modul keterangan foto berbantuan AI dan pemesanan ruang internal masih tahap awal.`,
    ]],
    ["10. KEBERLANJUTAN DAN PELEMBAGAAN", [
      `Pembiayaan: biaya berjalan mendekati nol, tidak bergantung anggaran tahunan. Pengelola: Bagian Protokol dan Komunikasi Pimpinan Setda. Pemeliharaan: pembaruan berkelanjutan berdasarkan masukan pengguna. SOP: sebelas SOP untuk disahkan Sekda. Kebijakan: Keputusan Sekda tentang Tim Koordinasi, Surat Sekda 12 Maret 2026, SE Wali Kota tentang Inovasi Daerah. Kelembagaan: kewenangan melekat pada jabatan sehingga mutasi pejabat tidak memutus alur.`,
      `Rencana: Oktober–Desember 2026 pengesahan SOP; Januari–Juni 2027 pendampingan pengelola kedua dan dokumentasi teknis; Juli–Desember 2027 paket replikasi.`,
      `Risiko dan mitigasi: ketergantungan pada satu pengembang (SOP, repositori kode, akun atas nama instansi, alih pengetahuan 2027); kuota layanan tanpa biaya (pemantauan, penggabungan fungsi); kehilangan data (pencadangan berkala); data pribadi (kanal publik tanpa identitas pemohon); pejabat berhalangan (Pelaksana Harian bermasa berlaku).`,
    ]],
    ["11. REPLIKASI, PERLUASAN, DAN DISEMINASI", [
      `Potensi adopsi: dapat direplikasi utuh atau per modul. Di lingkungan Pemkot Tarakan: Sekretariat DPRD (agenda pimpinan dewan) serta perangkat daerah yang mengelola ruang pertemuan atau menerima tamu (modul ruangan, audiensi, daftar hadir). Di luar Tarakan: Pemprov Kalimantan Utara dan kabupaten di Kaltara.`,
      `Syarat replikasi: peramban dan internet, layanan awan kuota tanpa biaya, sebelas SOP siap diadaptasi, satu pengelola dengan pendampingan. Dokumentasi: sebelas SOP, panduan pemasangan daftar hadir, catatan teknis kode.`,
      `Diseminasi dan publikasi: Tim Koordinasi lintas perangkat daerah; pengenalan langsung kepada Pimpinan, ajudan, dan mitra kerja; ${D.ruang.instansi_berbeda} instansi peminjam ruangan dan ${D.tamu.instansi_berbeda} instansi pemohon audiensi; Surat Sekda kepada DKISP ditembuskan kepada Wali Kota dan Kepala Bappeda Litbang; alamat resmi prokopim.tarakankota.go.id dan Google Calendar bersama yang dapat dilanggani.`,
    ]],
  ];
  let teks = `TEKS ISIAN RISDA — LOMBA INOVASI DAERAH KOTA TARAKAN 2026\n${JUDUL_LENGKAP}\nData per ${PER_LENGKAP}. Dibuat otomatis oleh buat-proposal-tarakan.mjs; angka sama dengan proposal.\n`;
  for (const [judul, paragraf] of bagian) {
    const isiBagian = paragraf.join("\n\n");
    teks += `\n${"=".repeat(70)}\n${judul}   [${n(isiBagian.length)} karakter]\n${"=".repeat(70)}\n\n${isiBagian}\n`;
  }
  fs.writeFileSync(path.join(TARAKAN, "Isian-RISDA.txt"), teks);
}

// Lintasan 1: render untuk mencari letak judul. Lintasan 2: isi nomor halaman.
await tulisDanRender(null);
const judulSemua = urutanJudul.map((j) => j.teks);
const hasil = JSON.parse(execFileSync("python3", [path.join(DIR, "halaman.py"), KELUAR + ".pdf", BAB.b2, ...judulSemua], { encoding: "utf8" }));
await tulisDanRender(hasil.halaman);
const akhir = JSON.parse(execFileSync("python3", [path.join(DIR, "halaman.py"), KELUAR + ".pdf", BAB.b2, ...judulSemua], { encoding: "utf8" }));
execFileSync("python3", [path.join(DIR, "gabung.py"), KELUAR + ".pdf",
  ...(TANPA_SOP ? [] : ["7=" + path.join(REPO, "docs/sop/SOP-Prokopim.pdf")]),
  ...(fs.existsSync(SURAT_USULAN_TTE) ? ["2=" + SURAT_USULAN_TTE] : []),
  "6=" + path.join(LOMBA, "lampiran/SK-Tim-Koordinasi-2026.pdf") + "," + path.join(LOMBA, "lampiran/Surat-Sekda-300.2.10-265-2026.pdf"),
], { stdio: "inherit" });
const keluaran = [KELUAR + ".docx", KELUAR + ".pdf"];
if (!PRIBADI && !TANPA_SOP) { isianRisda(); keluaran.push(path.join(TARAKAN, "Isian-RISDA.txt")); }
let identitas = null, ttd = null;
if (PRIBADI) {
  const lamp3 = path.join(RAHASIA, "Lampiran-3-Identitas.pdf");
  const timJson = path.join(RAHASIA, "tim.json");
  fs.writeFileSync(timJson, JSON.stringify(TIM.map(([nama, , kedudukan], i) => [String(i + 1), nama, kedudukan])));
  identitas = JSON.parse(execFileSync("python3", [path.join(DIR, "identitas.py"), path.join(RAHASIA, "identitas"), lamp3, timJson], { encoding: "utf8" }));
  // Halaman judul Lampiran 3 diganti halaman KTP yang sudah memuat judulnya.
  execFileSync("python3", [path.join(DIR, "gabung.py"), KELUAR + ".pdf", "3!=" + lamp3], { stdio: "inherit" });
  // Halaman bertanda tangan (pakta, testimoni) menggantikan halaman kosongnya.
  if (fs.existsSync(path.join(RAHASIA, "ttd.json")))
    ttd = execFileSync("python3", [path.join(DIR, "ttd.py"), KELUAR + ".pdf", path.join(RAHASIA, "ttd.json")], { encoding: "utf8" }).trim().split("\n");
}
const ukuranMB = +(fs.statSync(KELUAR + ".pdf").size / 1048576).toFixed(1);
if (ukuranMB > 20) console.error(`PERINGATAN: PDF ${ukuranMB} MB melebihi batas 20 MB.`);
console.log(JSON.stringify({ ...akhir, identitas, ttd, ukuranMB, keluaran }, null, 2));
