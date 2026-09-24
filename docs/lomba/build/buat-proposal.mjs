/**
 * Pembuat proposal Kaltara Innovation Awards 2026 — Prokopim Hibot.
 *
 *   cd docs/lomba/build && npm install && npm run buat
 *
 * Menghasilkan docs/lomba/Proposal-Prokopim-Hibot.docx (dapat disunting) dan
 * .pdf (untuk diunggah). Seluruh angka dibaca dari ../data-statistik.json,
 * yaitu keluaran ../STATISTIK-proposal.sql. Memperbarui angka cukup dengan
 * mengganti berkas data itu lalu menjalankan ulang skrip ini — persentase,
 * rata-rata, dan kenaikan dihitung ulang dengan sendirinya.
 *
 * Ketentuan teknis panduan (Bab 4.2): A4, Arial 11 pt, spasi 1,15, paling
 * banyak 20 halaman di luar sampul dan lampiran, PDF paling besar 15 MB.
 * Halaman isi dinomori mulai 1 supaya batas 20 halaman terlihat langsung.
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
const KELUAR = path.join(LOMBA, "Proposal-Prokopim-Hibot");

// ═══════════════════════════════════════════════════════════════════
//  ANGKA
// ═══════════════════════════════════════════════════════════════════
const D = JSON.parse(fs.readFileSync(path.join(LOMBA, "data-statistik.json"), "utf8"));

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

// Masa implementasi: dari kegiatan pertama sampai penutupan pendaftaran.
function selisihBulanHari(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number), [y2, m2, d2] = b.split("-").map(Number);
  let bulan = (y2 - y1) * 12 + (m2 - m1), hari = d2 - d1;
  if (hari < 0) { bulan -= 1; hari += new Date(y2, m2 - 1, 0).getDate(); }
  return { bulan, hari };
}
const masa = selisihBulanHari(D.tanggal_kegiatan.awal, "2026-09-30");
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
const NOMOR_SURAT_SEKDA = "300.2.10/[[XXX]]/SETDA/2026";
const SK_SEKDA = "100.3.3.6/98/HK/VIII/2026";
const SE_WALIKOTA = "000.7.2.4/70/Bappeda Litbang/2026";
const JUDUL = "PROKOPIM HIBOT";
const SUBJUDUL = "Satu Alur Digital Terverifikasi untuk Tata Kelola Agenda dan Keprotokolan Pimpinan Daerah";

// Judul bab — dipakai juga oleh daftar isi dan pencarian nomor halaman.
const BAB = {
  b2:  "2. RINGKASAN EKSEKUTIF",
  b3:  "3. PROFIL INOVATOR/TIM",
  b4:  "4. LATAR BELAKANG DAN ANALISIS MASALAH",
  b5:  "5. KESELARASAN DENGAN BIDANG FOKUS DAN RPJMD",
  b6:  "6. DESKRIPSI DAN KEBARUAN INOVASI",
  b7:  "7. PELAKSANAAN INOVASI",
  b8:  "8. PEMANFAATAN SUMBER DAYA DAN KOLABORASI",
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
  tambah(P(`Bagian Protokol dan Komunikasi Pimpinan (Bagian Prokopim) Sekretariat Daerah Kota Tarakan bertugas menyusun, memeriksa, dan mengawal agenda Wali Kota dan Wakil Wali Kota. Volume yang ditangani rata-rata mencapai ${rataBulan} kegiatan setiap bulan, dan setiap kegiatan melewati paling sedikit tiga jenjang pemeriksaan sebelum ditetapkan.`));
  tambah(P(`**Masalah.** Sampai awal tahun 2026 seluruh proses tersebut berjalan secara manual. Rencana kegiatan disusun pada lembar sebar lalu dicetak, penelaahan hanya dapat dilakukan dalam satu jendela waktu sekitar 30 menit menjelang jam pulang kantor, dokumen disposisi diteruskan dalam bentuk foto melalui grup percakapan, dan penugasan petugas bergantung pada ingatan perorangan. Pada Januari 2026 satu lembar disposisi agenda tidak ikut terkirim tanpa ada pihak yang dapat mengetahuinya. Peristiwa itu memperlihatkan akar masalahnya, yaitu tidak tersedianya satu sumber data yang sahih dan dapat diperiksa oleh semua pihak.`));
  tambah(P(`**Solusi.** Prokopim Hibot adalah aplikasi web progresif yang menyatukan sebelas alur kerja keprotokolan dan komunikasi pimpinan dalam satu sistem, mulai dari penetapan jadwal berjenjang, penugasan petugas, pelayanan audiensi dan peminjaman ruangan, sampai daftar hadir digital dan evaluasi kinerja petugas. Setiap perpindahan status terekam dalam jejak audit beserta nama pelaku dan waktunya, sehingga setiap keputusan atas agenda Pimpinan dapat ditelusuri kembali.`));
  tambah(P(`**Pelaksanaan.** Aplikasi mulai digunakan pada Maret 2026. Kegiatan pertama tercatat pada ${tglPanjang(D.tanggal_kegiatan.awal)}, dan penggunaannya dikuatkan Surat Sekretaris Daerah Kota Tarakan Nomor ${NOMOR_SURAT_SEKDA} tanggal 11 Maret 2026. Pada saat pendaftaran ditutup, inovasi ini telah berjalan ${MASA}. Pelaksanaannya didukung Keputusan Sekretaris Daerah Kota Tarakan Nomor ${SK_SEKDA} dan sebelas standar operasional prosedur (SOP).`));
  tambah(P(`**Penerima manfaat.** Sebanyak ${D.pengguna.aktif} pemegang akun aktif pada ${jumlahPeran} jenis peran, meliputi Pimpinan Daerah, ajudan, pengawal pribadi, pejabat struktural, petugas protokol dan dokumentasi, serta mitra kerja Pemerintah Kota. Masyarakat dan instansi memanfaatkan kanal publiknya: permohonan audiensi datang dari ${D.tamu.instansi_berbeda} instansi dan layanan peminjaman ruangan telah dipakai oleh ${D.ruang.instansi_berbeda} instansi.`));
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
  tambah(P(`Seluruh capaian tersebut diperoleh tanpa belanja pengadaan. Aplikasi berjalan pada layanan komputasi awan dengan kuota tanpa biaya dan dapat dipasang langsung pada telepon pintar pengguna.`));

  // ── 3. PROFIL INOVATOR/TIM ──────────────────────────────────────
  tambah(h1("b3"));
  tambah(P(`Inovasi ini diusulkan oleh Tim Inovasi Prokopim Hibot dari Bagian Protokol dan Komunikasi Pimpinan Sekretariat Daerah Kota Tarakan. Susunan tim diambil dari Keputusan Sekretaris Daerah Kota Tarakan Nomor ${SK_SEKDA} tentang Tim Koordinasi Peningkatan Pelayanan Keprotokolan dan Komunikasi Pimpinan Pemerintah Kota Tarakan. Karena panduan membatasi tim paling banyak lima orang, lima anggota berikut mewakili Tim Koordinasi yang beranggotakan 42 orang.`));
  tambah(tabel({
    judul: "Susunan dan pembagian tugas tim inovasi",
    kolom: [7, 35, 15, 43],
    rataTengah: [0],
    baris: [
      ["No", "Nama dan Jabatan", "Kedudukan pada SK", "Peran dalam Inovasi"],
      ["1", ["**Anugrah Yega Pranatha, M.Si.**", "Kepala Bagian Protokol dan Komunikasi Pimpinan"], "Ketua", "Ketua tim; penggagas; perancang alur kerja dan aturan kewenangan; pengembang aplikasi secara swakelola; penanggung jawab pendaftaran"],
      ["2", ["**Saifullah, S.H.**", "Kepala Subbagian Protokol"], "Sekretaris I", "Penyelia penerapan pada alur keprotokolan; penguji; pemberi pertimbangan rancangan"],
      ["3", ["**Juliyanti, S.AP.**", "Kepala Subbagian Komunikasi dan Dokumentasi Pimpinan"], "Sekretaris II", "Penyelia penerapan pada alur komunikasi dan dokumentasi; penguji; pemberi pertimbangan rancangan"],
      ["4", ["**Nuraini Wiliadewi, S.IP.**", "Penelaah Teknis Kebijakan"], "Anggota", "Pelaksana dan penguji di lapangan; penghimpun kendala pemakaian sehari-hari"],
      ["5", ["**Ni Kade Sari Handayani, S.AP.**", "Penata Keprotokolan"], "Anggota", "Pelaksana dan penguji di lapangan; penghimpun kendala pemakaian sehari-hari"],
    ],
    sumber: `Sumber: Keputusan Sekretaris Daerah Kota Tarakan Nomor ${SK_SEKDA} (Lampiran 6).`,
  }));
  tambah(PN(`**Instansi:** Bagian Protokol dan Komunikasi Pimpinan, Sekretariat Daerah Kota Tarakan, Provinsi Kalimantan Utara.`, { after: 40 }));
  tambah(PN(`**Kontak ketua tim:** telepon [[nomor telepon]]; surel [[alamat surel]].`));
  tambah(P(`Ketua tim merancang alur kerja dan mengembangkan aplikasi secara swakelola. Keempat anggota lainnya menguji setiap perubahan, menerapkannya dalam pekerjaan sehari-hari, dan menghimpun kendala dari pengguna, sehingga setiap penyempurnaan berangkat dari hambatan yang benar-benar dialami di lapangan.`));

  // ── 4. LATAR BELAKANG ───────────────────────────────────────────
  tambah(h1("b4"));
  tambah(h2("4.1 Data Dasar"));
  tambah(P(`Bagian Prokopim mengelola agenda dua Pimpinan Daerah dengan volume yang tinggi. Data yang kini terekam memperlihatkan besarnya beban tersebut: sejak Maret sampai ${PER_TGL} tercatat ${n(T)} kegiatan, dengan rata-rata ${rataBulan} kegiatan per bulan dan puncak ${D.kegiatan_per_bulan[puncakBulan]} kegiatan pada ${namaBulan(puncakBulan)}. Sebanyak ${n(D.kegiatan_per_pimpinan.walikota)} kegiatan ditujukan kepada Wali Kota dan ${n(D.kegiatan_per_pimpinan.wakilwalikota)} kepada Wakil Wali Kota.`));
  tambah(P(`Setiap kegiatan memerlukan pemeriksaan undangan, penelaahan kelayakan kehadiran, penugasan petugas protokol dan dokumentasi, serta penyiapan bahan. Hampir separuhnya (${n(sambutanKeg)} kegiatan) merupakan kegiatan sambutan yang memerlukan naskah. Beban sebesar ini sebelumnya ditangani secara manual dan tidak pernah tercatat dalam satu sistem.`));

  tambah(h2("4.2 Kondisi Sebelum Inovasi"));
  tambah(P(`Sebelum Maret 2026, alur kerja Bagian Prokopim berjalan sebagaimana Tabel 3.`, { keepNext: true }));
  tambah(tabel({
    judul: "Cara kerja sebelum inovasi",
    kolom: [26, 74],
    baris: [
      ["Aspek", "Keadaan sebelum Maret 2026"],
      ["Penyusunan agenda", "Rencana kegiatan (RK) disusun pada lembar sebar, dicetak, lalu diperiksa berjenjang"],
      ["Penelaahan", "Kepala Subbagian dan Kepala Bagian memeriksa dalam satu jendela waktu sekitar 30 menit menjelang jam pulang kantor, hanya pada hari kerja; disposisi Pimpinan diterima malam atau pagi harinya"],
      ["Kegiatan mendesak", "RK dicetak ulang untuk menyisipkannya; bila tidak sempat, Pimpinan hadir tanpa RK"],
      ["Dokumen disposisi", "Diteruskan dalam bentuk foto melalui grup percakapan"],
      ["Naskah sambutan", "Disusun, dicetak, diperiksa berjenjang, dan dikembalikan secara fisik"],
      ["Penugasan petugas", "Tidak tercatat terpusat; bergantung pada ingatan perorangan"],
      ["Ketersediaan ruangan", "Dicatat pada papan tulis dan dikoordinasikan melalui grup percakapan"],
      ["Permohonan audiensi", "Pemohon datang atau menelepon untuk menanyakan kepastian"],
    ],
  }));

  tambah(h2("4.3 Peristiwa Pemicu"));
  tambah(P(`Informasi agenda Pimpinan datang dari banyak arah: surat yang diantar ke rumah jabatan, berkas yang ditinggalkan di meja, dan pesan yang dikirim langsung kepada Wali Kota. Karena tidak ada satu pintu masuk, beberapa rencana kegiatan pernah tidak terinput sama sekali.`));
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

  tambah(h2("4.5 Urgensi"));
  tambah(P(`Agenda Pimpinan menentukan kehadiran pemerintah daerah di tengah masyarakat. Kegiatan yang tidak tercatat berarti tidak ada pendampingan protokol, tidak ada peliputan dan dokumentasi, tidak ada naskah sambutan, dan ajudan tidak siap. Kegiatan itu juga hilang dari rekam jejak kinerja pemerintah daerah. Dengan volume yang terus meningkat, dari ${vAwal} kegiatan pada ${BULAN[+bPenuhAwal.slice(5) - 1]} menjadi ${vAkhir} kegiatan pada ${namaBulan(bPenuhAkhir)}, ketergantungan pada ketelitian perorangan tidak dapat dipertahankan.`));
  tambah(P(`Kebutuhan perubahan juga ditegaskan kebijakan daerah. Surat Edaran Wali Kota Tarakan Nomor ${SE_WALIKOTA} tanggal 11 Februari 2026 tentang Inovasi Daerah mendorong setiap perangkat daerah melahirkan inovasi, sejalan dengan arahan Wali Kota untuk meningkatkan Indeks Inovasi Daerah dengan prioritas inovasi berbasis digital.`));

  tambah(h2("4.6 Kelompok Sasaran"));
  tambah(tabel({
    judul: "Kelompok sasaran dan kebutuhannya",
    kolom: [40, 60],
    baris: [
      ["Kelompok sasaran", "Kebutuhan utama"],
      ["Wali Kota dan Wakil Wali Kota", "Agenda yang pasti, terkini, dan dapat dibuka dari mana saja"],
      ["Ajudan dan pengawal pribadi Pimpinan", "Pemberitahuan dini dan kesiapan bahan kegiatan"],
      ["Kepala Bagian dan Kepala Subbagian", "Kendali atas mutu jadwal dan sebaran beban petugas"],
      ["Petugas protokol, pramu tamu, dan tim dokumentasi", "Kejelasan penugasan dan bahan kerja"],
      ["Masyarakat, instansi, dan mitra kerja", "Kanal permohonan audiensi dan peminjaman ruangan yang dapat ditelusuri"],
    ],
    sumber: `Sumber data: keadaan sebelum inovasi bersumber dari telaah alur kerja dan keterangan pelaksana karena memang tidak pernah tercatat; data sesudah inovasi ditarik dari basis data aplikasi ${PER_LENGKAP}.`,
  }));

  // ── 5. KESELARASAN ──────────────────────────────────────────────
  tambah(h1("b5"));
  tambah(h2("5.1 Bidang Fokus Utama"));
  tambah(P(`Inovasi ini diajukan pada **Bidang Fokus 3, Tata Kelola Kolaboratif dan Pelayanan Publik**, yang terkait dengan Misi 3 RPJMD Provinsi Kalimantan Utara. Empat subfokus pada bidang tersebut dijawab secara langsung sebagaimana Tabel 5.`, { keepNext: true }));
  tambah(tabel({
    judul: "Subfokus Bidang Fokus 3 yang dijawab inovasi",
    kolom: [34, 66],
    baris: [
      ["Subfokus pada panduan", "Wujud dalam inovasi"],
      ["Digitalisasi pelayanan dan SPBE", "Sebelas alur kerja manual dipindahkan ke satu aplikasi; kanal publik untuk audiensi dan peminjaman ruangan"],
      ["Penyederhanaan proses bisnis", "Penelaahan tidak lagi menunggu jendela waktu harian; kegiatan mendesak tidak lagi memerlukan cetak ulang"],
      ["Integrasi data", "Agenda, penugasan, naskah, undangan, daftar hadir, dan evaluasi merujuk pada satu data kegiatan yang sama"],
      ["Transparansi dan akuntabilitas", "Jejak audit mencatat pelaku dan waktu setiap keputusan; pemohon dapat menelusuri status permohonannya"],
    ],
  }));

  tambah(h2("5.2 Keselarasan dengan RPJMD Provinsi Kalimantan Utara 2025–2029"));
  tambah(P(`RPJMD Provinsi Kalimantan Utara Tahun 2025–2029 menetapkan visi *"Terwujudnya Fondasi Transformasi Kalimantan Utara yang Kokoh sebagai Beranda Depan NKRI yang Maju, Makmur dan Berkelanjutan"*. Inovasi ini mendukung dua misi:`, { keepNext: true }));
  tambah(butir([
    `**Misi 3: Mewujudkan Transformasi Tata Kelola yang Kolaboratif dan Inovatif** (dukungan utama). Tata kelola agenda pimpinan berubah dari proses manual yang bergantung pada orang menjadi proses digital yang terukur, terekam, dan melibatkan banyak pihak dalam satu alur.`,
    `**Misi 8: Mewujudkan Kesinambungan Pembangunan Kalimantan Utara untuk Mengawal Indonesia Emas** (dukungan sekunder). Subfokus replikasi dan perluasan inovasi dijawab melalui rancangan yang dapat diterapkan pemerintah daerah lain tanpa pengadaan, sebagaimana diuraikan pada Bagian 11.`,
  ]));

  tambah(h2("5.3 Keselarasan dengan RPJMD Kota Tarakan 2025–2029"));
  tambah(P(`Visi Wali Kota dan Wakil Wali Kota Tarakan periode 2025–2030 adalah *"Terwujudnya Tarakan sebagai Kota Cerdas yang bertumpu pada Sektor Jasa, Perdagangan, Perikanan Kelautan dan Ekonomi Kreatif yang Berdaya Saing dan Maju menuju Masyarakat Sejahtera"*. Prokopim Hibot merupakan wujud Kota Cerdas pada sisi tata kelola pemerintahan dan menjawab langsung **Misi 4: Mewujudkan tata kelola pemerintahan yang adaptif, responsif dan menjaga stabilitas ketertiban dan ketentraman kota**:`, { keepNext: true }));
  tambah(butir([
    `**Adaptif:** kewenangan dapat dilimpahkan kepada Pelaksana Harian ketika pejabat berhalangan, dan jadwal yang telah terbit dapat diubah melalui usulan berjenjang tanpa menurunkannya dari publikasi.`,
    `**Responsif:** median waktu dari pengajuan sampai jadwal tayang ${dk(K.median_ajukan_tayang_jam, 2)} jam, dan ${pct(luarJam, putusanTotal)} penelaahan dilakukan di luar jam kerja.`,
  ]));
  tambah(P(`Nama inovasi ini mengusung semboyan pembangunan Kota Tarakan periode 2025–2030, **"Tarakan HIBOT"**. *Hibot* dalam bahasa Tidung berarti hebat, dan sekaligus merupakan akronim dari Handal, Inovatif, Berbudaya, Unggul, dan Tangguh. Kelima nilai itu diterjemahkan ke dalam rancangan aplikasi sebagaimana Tabel 6.`, { keepNext: true }));
  tambah(tabel({
    judul: "Nilai HIBOT dalam rancangan Prokopim Hibot",
    kolom: [18, 82],
    baris: [
      ["Nilai", "Wujud dalam aplikasi"],
      ["Handal", "Satu sumber data kegiatan; agenda tidak lagi bergantung pada ingatan dan ketelitian perorangan"],
      ["Inovatif", "Jejak audit dan daftar periksa wajib menggantikan pemeriksaan melalui kertas dan grup percakapan"],
      ["Berbudaya", "Mengikuti tata naskah dinas dan menghormati kebiasaan Pimpinan, misalnya membaca naskah sambutan tercetak"],
      ["Unggul", `Jadwal ditetapkan dalam hitungan jam; ${pct(K.tayang_dalam_24_jam, K.kegiatan_jejak_lengkap)} tayang kurang dari 24 jam`],
      ["Tangguh", "Alur tetap berjalan ketika pejabat berhalangan melalui Pelaksana Harian, dan tetap beroperasi tanpa anggaran pengadaan"],
    ],
  }));

  tambah(h2("5.4 Keterkaitan dengan Kebijakan dan Regulasi"));
  tambah(angka([
    `Undang-Undang Nomor 25 Tahun 2009 tentang Pelayanan Publik, melalui kanal permohonan audiensi dan peminjaman ruangan yang dapat ditelusuri pemohon;`,
    `Undang-Undang Nomor 9 Tahun 2010 tentang Keprotokolan, dalam tata kelola acara dan pendampingan Pimpinan Daerah;`,
    `Peraturan Pemerintah Nomor 38 Tahun 2017 tentang Inovasi Daerah, sebagai inovasi tata kelola pemerintahan daerah;`,
    `Peraturan Presiden Nomor 95 Tahun 2018 tentang Sistem Pemerintahan Berbasis Elektronik dan Peraturan Presiden Nomor 82 Tahun 2023 tentang Percepatan Transformasi Digital dan Keterpaduan Layanan Digital Nasional;`,
    `Peraturan Menteri PANRB Nomor 35 Tahun 2012 tentang Pedoman Penyusunan Standar Operasional Prosedur Administrasi Pemerintahan, sebagai dasar penyusunan sebelas SOP;`,
    `Surat Edaran Wali Kota Tarakan Nomor ${SE_WALIKOTA} tentang Inovasi Daerah;`,
    `Keputusan Sekretaris Daerah Kota Tarakan Nomor ${SK_SEKDA} tentang Tim Koordinasi Peningkatan Pelayanan Keprotokolan dan Komunikasi Pimpinan; dan`,
    `Surat Sekretaris Daerah Kota Tarakan Nomor ${NOMOR_SURAT_SEKDA} tanggal 11 Maret 2026 perihal Permohonan Subdomain.`,
  ]));
  tambah(P(`Tema kompetisi tahun 2026 berfokus pada kedaulatan pangan dan energi. Panduan menegaskan bahwa tema tersebut merupakan arah prioritas dan bukan pembatasan tunggal, sehingga inovasi pada bidang lain tetap dapat diikutsertakan sepanjang selaras dengan salah satu bidang fokus dan misi RPJMD.`, { before: 60 }));

  // ── 6. DESKRIPSI DAN KEBARUAN ───────────────────────────────────
  tambah(h1("b6"));
  tambah(h2("6.1 Konsep"));
  tambah(P(`Prinsip dasar Prokopim Hibot adalah **setiap kegiatan Pimpinan memiliki satu data yang sama bagi semua pihak, dan setiap keputusan atasnya tercatat.** Seluruh jenjang, dari Admin Rencana Kegiatan sampai Wali Kota, membuka data kegiatan yang sama, sehingga tidak ada lagi versi cetakan yang beredar ganda maupun lembar yang hilang tanpa diketahui.`));
  tambah(h2("6.2 Cara Kerja"));
  tambah(P(`Prokopim Hibot berbentuk aplikasi web progresif yang dapat dibuka melalui peramban atau dipasang pada telepon pintar tanpa melalui toko aplikasi. Pengguna masuk sesuai peran masing-masing, dan setiap peran hanya melihat serta mengerjakan yang menjadi kewenangannya. Alur inti penetapan jadwal ditunjukkan Gambar 1.`, { keepNext: true }));
  tambah(bagan(
    [["Admin Rencana Kegiatan", "input jadwal dan undangan"], ["Kepala Subbagian Protokol", "telaah dan verifikasi"], ["Kepala Bagian", "persetujuan"], ["Tayang", "Pimpinan, ajudan, petugas"]],
    "Setiap tahap tercatat pada jejak audit: pelaku, waktu, dan catatan keputusan.",
    "Alur penetapan jadwal kegiatan Pimpinan",
  ));
  tambah(P(`Setelah jadwal tayang, aplikasi memberi tahu pihak terkait melalui notifikasi aplikasi dan pesan WhatsApp, menugaskan petugas protokol dan dokumentasi, serta mengirim pengingat terjadwal lima kali sehari menurut waktu WITA. Ajudan mengonfirmasi kehadiran Pimpinan, dan Wali Kota dapat mendisposisikan kegiatan kepada Wakil Wali Kota langsung dari aplikasi.`));

  tambah(h2("6.3 Cakupan Alur Kerja"));
  tambah(tabel({
    judul: "Sebelas alur kerja dalam Prokopim Hibot",
    kolom: [7, 28, 65],
    rataTengah: [0],
    baris: [
      ["No", "Alur kerja", "Cara kerja pokok"],
      ["1", "Penetapan jadwal", "Tiga jenjang; pemeriksaan benturan jadwal Pimpinan secara otomatis"],
      ["2", "Perubahan jadwal terbit", "Diajukan berjenjang; jadwal tetap tayang dengan data lama selama usulan diproses"],
      ["3", "Penarikan dan pembatalan", "Wajib disertai alasan; data tidak dihapus"],
      ["4", "Penugasan petugas", "Pemberitahuan hanya kepada petugas yang penugasannya berubah"],
      ["5", "Audiensi dan tamu", "Permohonan daring berjenjang; otomatis menjadi agenda bila disetujui"],
      ["6", "Peminjaman ruangan", "Kanal publik dengan kalender ketersediaan dan kode penelusuran"],
      ["7", "Daftar hadir digital", "Pindai kode QR; tanda tangan layar sentuh; buka-tutup mengikuti jam acara"],
      ["8", "Naskah sambutan", "Penyusun, penyelia, dan pengesah dalam satu alur"],
      ["9", "Peliputan dan publikasi", "Rancangan naskah berita berbantuan kecerdasan buatan, wajib disunting petugas"],
      ["10", "Penerbitan undangan", "Tata letak baku; penomoran tetap melalui aplikasi persuratan"],
      ["11", "Evaluasi kinerja", "Butir penilaian berbeda untuk petugas protokol dan dokumentasi"],
    ],
  }));

  tambah(h2("6.4 Unsur Kebaruan"));
  tambah(P(`Unsur kebaruan Prokopim Hibot berkaitan dengan cara aplikasi menjaga mutu keputusan dan kesinambungan alur kerja, yaitu:`, { keepNext: true }));
  tambah(huruf([
    `**Jejak audit yang melekat pada setiap kegiatan.** Riwayat setiap kegiatan dapat dibuka pengguna: siapa yang mengajukan, menelaah, dan memutus, kapan, serta dengan catatan apa. Sampai ${PER_TGL} tercatat ${n(D.jejak.peristiwa_total)} peristiwa pada ${n(D.jejak.kegiatan_berjejak)} kegiatan.`,
    `**Daftar periksa wajib sebelum persetujuan.** Tombol persetujuan baru aktif setelah pejabat mengonfirmasi butir pemeriksaan, dan butir yang dikonfirmasi ikut tercatat pada jejak audit. Butir "undangan sudah dibuka" hanya tercentang apabila berkas undangan benar-benar dibuka.`,
    `**Kewenangan melekat pada jabatan, dengan Pelaksana Harian bermasa berlaku.** Ketika pejabat berhalangan, kewenangannya dapat dilimpahkan sementara dengan tanggal berakhir yang tegas dan padam dengan sendirinya. Jejak audit tetap mencatat pelaku sebenarnya beserta jabatan yang diampu, dan Pelaksana Harian tidak dapat memutus jadwal yang diajukannya sendiri.`,
    `**Pengawasan berdasarkan kegentingan.** Usulan perubahan jadwal yang tertahan ditandai menurut umur usulan dan kedekatan hari pelaksanaan, sehingga usulan untuk acara esok hari langsung menonjol. Kepala Bagian dapat memantau usulan yang masih di tingkat Kepala Subbagian tanpa melangkahi jenjang.`,
    `**Kanal publik yang dapat ditelusuri sendiri.** Pemohon audiensi dan peminjam ruangan memantau permohonannya dengan kode penelusuran. Kalender ketersediaan ruangan untuk umum hanya menampilkan keterpakaian slot, tanpa identitas maupun kontak pemohon.`,
    `**Prosedur yang terlembaga.** Seluruh alur dituangkan dalam sebelas SOP format PermenPAN-RB 35/2012 yang sesuai dengan alur di aplikasi.`,
  ]));

  tambah(h2("6.5 Perbedaan dari Cara Lama dan Solusi Sejenis"));
  tambah(tabel({
    judul: "Perbandingan cara lama dan Prokopim Hibot",
    kolom: [26, 34, 40],
    baris: [
      ["Aspek", "Cara lama", "Prokopim Hibot"],
      ["Kesempatan penelaahan", "Sekali sehari, ±30 menit, hari kerja", `Setiap saat; ${pct(luarJam, putusanTotal)} di luar jam kerja`],
      ["Kegiatan mendesak", "Cetak ulang seluruh RK", "Masuk antrean tersendiri"],
      ["Rujukan jadwal", "Beberapa versi cetakan", "Satu data, terkini bagi semua peran"],
      ["Penelusuran keputusan", "Tidak ada", "Jejak audit setiap kegiatan"],
      ["Pemberitahuan petugas", "Manual, mudah terlewat", "Otomatis, hanya kepada yang berubah"],
      ["Pejabat berhalangan", "Alur berhenti", "Pelaksana Harian bermasa berlaku"],
      ["Layanan publik", "Datang atau menelepon", "Kanal daring dengan kode penelusuran"],
      ["Prosedur", "Melekat pada orang", "Sebelas SOP baku"],
    ],
  }));
  tambah(P(`Dibandingkan kalender bersama atau grup percakapan yang lazim dipakai, Prokopim Hibot memiliki jenjang persetujuan, pembagian kewenangan menurut jabatan, dan jejak keputusan yang tidak dimiliki keduanya. Aplikasi ini juga tidak menggantikan aplikasi persuratan: nomor surat tetap diterbitkan melalui aplikasi persuratan resmi, sedangkan Prokopim Hibot mengelola tindak lanjut kegiatannya.`));

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
      [{ t: "Bukti tertulis", bold: true, shade: ABU_MUDA }, `Surat Sekda Nomor ${NOMOR_SURAT_SEKDA} tanggal 11 Maret 2026, yang menyatakan sistem telah dikembangkan dan memohon subdomain prokopim.tarakankota.go.id`],
      [{ t: "Masa implementasi", bold: true, shade: ABU_MUDA }, `${MASA} pada 30 September 2026, melampaui syarat minimal 6 bulan`],
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
      ["Memperbaiki tata kelola lembar sebar bersama", "Tetap menyisakan banyak versi dan tidak mencatat jejak keputusan"],
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
      ["September 2026", "Pelaksana Harian; daftar periksa wajib sebelum persetujuan; penanda kegentingan dan pemantauan usulan perubahan"],
    ],
  }));
  if (pembaruan) tambah(P(`Sepanjang Maret sampai September 2026 tercatat lebih dari ${bulatBawah(pembaruan, 10)} pembaruan aplikasi dalam lebih dari ${bulatBawah(hariKembang, 10)} hari pengembangan. Sebagian besar pembaruan berangkat dari kendala yang dilaporkan pengguna, sehingga aplikasi berkembang mengikuti kebutuhan nyata.`));

  tambah(h2("7.4 SOP, Keputusan Pendukung, dan Dokumentasi"));
  tambah(P(`Seluruh alur dituangkan dalam sebelas SOP format PermenPAN-RB 35/2012, masing-masing dilengkapi bagian identitas dan diagram alir, yang disusun untuk disahkan Sekretaris Daerah Kota Tarakan (Lampiran 7):`, { keepNext: true }));
  const SOP = [
    "Penyusunan dan Penetapan Jadwal Kegiatan Pimpinan", "Perubahan Jadwal Kegiatan yang Telah Ditetapkan",
    "Penarikan dan Pembatalan Jadwal Kegiatan", "Penugasan Petugas Protokol dan Dokumentasi",
    "Pelayanan Permohonan Audiensi dan Kunjungan Tamu Pimpinan", "Pelayanan Peminjaman Ruangan",
    "Penyelenggaraan Daftar Hadir Digital", "Penyusunan dan Pengesahan Naskah Sambutan Pimpinan",
    "Peliputan dan Publikasi Kegiatan Pimpinan", "Penerbitan Undangan Kedinasan",
    "Evaluasi Kinerja Petugas Protokol dan Dokumentasi",
  ];
  const sopBaris = [];
  for (let i = 0; i < 6; i++) sopBaris.push([`SOP ${i + 1}. ${SOP[i]}`, SOP[i + 6] ? `SOP ${i + 7}. ${SOP[i + 6]}` : ""]);
  tambah(tabel({ kolom: [50, 50], kepala: false, baris: sopBaris }));
  tambah(P(`Keputusan pendukung berupa Keputusan Sekretaris Daerah Nomor ${SK_SEKDA} dan Surat Sekretaris Daerah tanggal 11 Maret 2026 (Lampiran 6). Dokumentasi berupa tangkapan layar setiap alur dan video demonstrasi disertakan pada Lampiran 4 dan Lampiran 5.`));

  // ── 8. SUMBER DAYA ──────────────────────────────────────────────
  tambah(h1("b8"));
  tambah(P(`Prokopim Hibot dijalankan tanpa belanja pengadaan. Keterbatasan anggaran diatasi dengan memanfaatkan secara optimal sumber daya yang sudah tersedia.`));
  tambah(h2("8.1 Personil dan Tim"));
  tambah(P(`Pengembangan dilakukan secara swakelola oleh Ketua Tim selaku Kepala Bagian, dengan memanfaatkan asisten pemrograman berbasis kecerdasan buatan, sehingga tidak memerlukan jasa pengembang dari pihak ketiga. Anggota tim dan sebelas pelaksana Bagian Prokopim berperan sebagai pengguna harian sekaligus penguji, serta menjadi sumber kebutuhan setiap penyempurnaan. Pelaksanaannya diperkuat Tim Koordinasi beranggotakan 42 orang berdasarkan Keputusan Sekretaris Daerah, yang juga melibatkan para Sekretaris Dinas di lingkungan Pemerintah Kota Tarakan.`));
  tambah(h2("8.2 Dukungan Pemangku Kepentingan"));
  tambah(butir([
    `**Sekretaris Daerah Kota Tarakan:** menetapkan Tim Koordinasi dan menguatkan penggunaan sistem melalui surat resmi.`,
    `**Wali Kota dan Wakil Wali Kota:** pengguna langsung; Wali Kota memakai fitur disposisi kepada Wakil Wali Kota pada ${aksi.delegasi_to_wwk || 0} kegiatan.`,
    `**Ajudan dan pengawal pribadi Pimpinan:** mengonfirmasi kehadiran Pimpinan melalui aplikasi sebanyak ${n(konfirmasiHadir)} kali.`,
    `**Dinas Komunikasi, Informatika, Statistik dan Persandian:** dimohonkan memfasilitasi subdomain prokopim.tarakankota.go.id.`,
    `**Bappeda Litbang:** pengampu kebijakan inovasi daerah dan penerima tembusan surat penguatan.`,
    `**Mitra kerja Pemerintah Kota:** ${peran.mitra_kerja || 0} akun mitra kerja memantau agenda yang telah tayang.`,
  ]));
  tambah(h2("8.3 Sumber Daya Lainnya dan Efisiensi"));
  tambah(tabel({
    judul: "Pemanfaatan sumber daya",
    kolom: [20, 60, 20],
    baris: [
      ["Komponen", "Pemanfaatan", "Biaya"],
      ["Peladen", "12 fungsi peladen tanpa server pada kuota tanpa biaya (12 dari 12 terpakai)", "Rp0"],
      ["Basis data", "Layanan basis data terkelola, paket tanpa biaya", "Rp0"],
      ["Daftar hadir", "Menumpang lembar sebar dan penyimpanan berkas milik instansi", "Rp0"],
      ["Notifikasi", "Notifikasi aplikasi tanpa biaya; pesan WhatsApp melalui layanan gerbang pesan", "Langganan gerbang pesan"],
      ["Perangkat", "Telepon pintar milik pengguna; tanpa toko aplikasi", "Rp0"],
      ["Pengembangan", "Swakelola oleh Ketua Tim", "Rp0"],
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
      ["    menunggu penelaahan Kepala Subbagian", jamMenit(K.median_ajukan_teruskan_jam)],
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
    sumber: `Waktu penetapan dihitung dari ${n(K.kegiatan_jejak_lengkap)} kegiatan yang jejak auditnya lengkap. Jejak audit mulai merekam pada ${tglPanjang(D.jejak.pertama)}, sehingga angka kecepatan mencakup Mei–September 2026. Di luar jam kerja berarti sebelum pukul 07.30, sejak pukul 16.00 WITA, atau pada hari Sabtu dan Minggu; hari libur nasional tidak dihitung sehingga angka tersebut cenderung lebih rendah dari keadaan sebenarnya.`,
  }));

  tambah(h2("9.2 Pertumbuhan Penggunaan"));
  const kepalaBulan = ["Bulan", ...bulanTampil.map((k) => BLN3[+k.slice(5) - 1] + (k === bulanKini ? "*" : ""))];
  const nilaiBulan = ["Kegiatan", ...bulanTampil.map((k) => String(D.kegiatan_per_bulan[k]))];
  tambah(tabel({
    judul: "Jumlah kegiatan per bulan tahun 2026",
    kolom: [22, ...bulanTampil.map(() => 78 / bulanTampil.length)],
    rataTengah: bulanTampil.map((_, i) => i + 1),
    baris: [kepalaBulan, nilaiBulan],
    sumber: `*Sampai ${PER_TGL}.${terjadwalDepan ? ` Selain itu, ${terjadwalDepan} kegiatan untuk bulan berikutnya telah terjadwal.` : ""}`,
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
  tambah(P(`**Dasar estimasi.** Kolom "sebelum" tidak berasal dari pencatatan karena keadaan tersebut memang tidak pernah dicatat. Angka 18–24 jam diturunkan dari alur pada Tabel 3: undangan yang masuk pagi hari menunggu jendela periksa menjelang jam pulang kantor (±8 jam), kemudian menunggu disposisi yang diterima malam atau pagi harinya (±12–15 jam).`));
  tambah(P(`Dengan median ${dk(K.median_ajukan_tayang_jam, 2)} jam, penetapan jadwal menjadi sekitar ${cepatLo} sampai ${cepatHi} kali lebih cepat pada jalur tercepat, dan jauh lebih cepat bagi undangan yang sebelumnya terlewat jendela periksa atau melintasi akhir pekan. Rincian waktunya juga menunjukkan bahwa setelah sampai kepada Kepala Bagian, keputusan hanya memerlukan ${jamMenit(K.median_teruskan_tayang_jam)}. Dengan demikian, hambatan pada cara lama bersumber dari jendela waktu penelaahan, sedangkan pengambilan keputusannya sendiri berlangsung cepat.`));

  tambah(h2("9.4 Mutu Layanan dan Akuntabilitas"));
  tambah(P(`Sebanyak ${D.dikembalikan_untuk_diperbaiki} kegiatan (${pct(D.dikembalikan_untuk_diperbaiki, T)}) dikembalikan untuk diperbaiki sebelum ditetapkan. Hal ini menunjukkan bahwa penelaahan dilakukan secara cermat. Sebanyak ${aksi.recall_published || 0} jadwal yang telah tayang ditarik kembali untuk dikoreksi, dan ${aksi.usulan_edit_diajukan || 0} usulan perubahan jadwal diproses berjenjang tanpa menurunkan jadwal dari publikasi. Sejak daftar periksa wajib diberlakukan pada 22 September 2026, ${D.jejak.dengan_daftar_periksa} keputusan telah melewati pemeriksaan butir yang tercatat pada jejak audit. Fitur Pelaksana Harian telah dipakai dalam ${D.jejak.oleh_plh} tindakan, sehingga alur tidak terhenti ketika pejabat berhalangan.`));

  tambah(h2("9.5 Jangkauan Layanan Publik"));
  tambah(butir([
    `**Peminjaman ruangan:** ${D.ruang.pengajuan} pengajuan dari ${D.ruang.instansi_berbeda} instansi; ${D.ruang.per_status.Approved || 0} disetujui dengan total ${n(D.ruang.peserta_disetujui)} peserta kegiatan.`,
    `**Permohonan audiensi:** ${D.tamu.total} permohonan dari ${D.tamu.instansi_berbeda} instansi; ${D.tamu.per_status.selesai || 0} telah selesai diproses dan ${D.agenda_dari_permohonan_tamu} di antaranya menjadi agenda Pimpinan.`,
    `**Pengguna di luar Bagian Prokopim:** ${akunLuar} akun, terdiri atas Pimpinan Daerah, ajudan, pengawal pribadi, dan mitra kerja Pemerintah Kota. Notifikasi aplikasi telah aktif pada ${D.perangkat_notifikasi.perangkat} perangkat milik ${D.perangkat_notifikasi.pengguna} pengguna.`,
  ]));

  tambah(h2("9.6 Manfaat Sosial dan Ekonomi"));
  tambah(P(`Masyarakat dan instansi tidak perlu lagi datang atau menelepon berulang kali untuk menanyakan kepastian permohonan. Bagi pemerintah daerah, hilangnya cetak ulang rencana kegiatan dan pemakaian perangkat milik pengguna menghemat kertas dan waktu kerja, sementara seluruh sistem berjalan tanpa belanja pengadaan. Jadwal yang ditetapkan lebih cepat juga berarti pendampingan protokol, peliputan, dan penyiapan naskah dapat dimulai lebih awal.`));

  tambah(h2("9.7 Catatan atas Modul Naskah Sambutan"));
  tambah(P(`Dari ${n(sambutanKeg)} kegiatan sambutan, baru ${D.sambutan_disahkan} naskah yang disahkan melalui aplikasi. Wali Kota dan Wakil Wali Kota masih lebih nyaman membaca naskah tercetak karena memberi keleluasaan berimprovisasi. Inovasi ini tidak memaksakan perubahan kebiasaan tersebut; modul naskah sambutan tetap tersedia lengkap bila sewaktu-waktu dibutuhkan. Prinsip yang dipegang adalah aplikasi menyesuaikan diri dengan cara kerja Pimpinan.`));

  tambah(h2("9.8 Testimoni Pengguna"));
  tambah(P(`Testimoni tertulis dari tiga jenjang pengguna dilampirkan pada Lampiran 9. Ringkasannya sebagai berikut.`, { keepNext: true }));
  tambah(tabel({
    judul: "Ringkasan testimoni pengguna",
    kolom: [28, 72],
    baris: [
      ["Narasumber", "Keterangan"],
      ["Wali Kota Tarakan", "[[kutipan singkat testimoni Wali Kota]]"],
      ["Ajudan Wakil Wali Kota", "[[kutipan singkat testimoni ajudan]]"],
      ["Staf Protokol", "[[kutipan singkat testimoni staf protokol]]"],
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
      ["Dukungan kebijakan", "Keputusan Sekda tentang Tim Koordinasi; Surat Sekda tanggal 11 Maret 2026; Surat Edaran Wali Kota tentang Inovasi Daerah"],
      ["Kelembagaan", "Kewenangan melekat pada jabatan dan dapat dilimpahkan kepada Pelaksana Harian, sehingga mutasi pejabat tidak memutus alur kerja"],
    ],
  }));
  tambah(h2("10.1 Rencana Pengembangan"));
  tambah(tabel({
    judul: "Rencana pengembangan",
    kolom: [24, 76],
    baris: [
      ["Waktu", "Rencana"],
      ["Oktober–Desember 2026", "Pemindahan ke subdomain resmi prokopim.tarakankota.go.id; pengesahan SOP; pengalihan akun layanan ke akun resmi instansi"],
      ["Januari–Juni 2027", "Pendampingan pengelola kedua dan penyusunan dokumentasi teknis untuk alih pengetahuan; pengetatan kebijakan akses basis data"],
      ["Juli–Desember 2027", "Paket replikasi bagi pemerintah daerah di Kalimantan Utara (Bagian 11)"],
    ],
  }));
  tambah(h2("10.2 Mitigasi Risiko"));
  tambah(tabel({
    judul: "Risiko dan mitigasinya",
    kolom: [28, 72],
    baris: [
      ["Risiko", "Mitigasi"],
      ["Ketergantungan pada satu pengembang", "Prosedur telah terdokumentasi dalam sebelas SOP; kode tersimpan dalam repositori dengan riwayat perubahan lengkap; alih pengetahuan kepada pengelola kedua dijadwalkan pada 2027"],
      ["Batas kuota layanan tanpa biaya", "Pemakaian dipantau; fungsi baru digabungkan ke fungsi yang ada; pengambilan data hanya untuk data yang berubah"],
      ["Kehilangan data", "Pencadangan berkala; peringatan pencadangan pada setiap jalur penghapusan"],
      ["Perlindungan data pribadi", "Kanal publik tidak menampilkan identitas maupun kontak pemohon; penelusuran menuntut kode lengkap; pengetatan kebijakan akses basis data berjalan bertahap"],
      ["Pejabat berhalangan", "Pelaksana Harian bermasa berlaku yang padam dengan sendirinya"],
    ],
  }));

  // ── 11. REPLIKASI ───────────────────────────────────────────────
  tambah(h1("b11"));
  tambah(h2("11.1 Potensi Adopsi"));
  tambah(P(`Tugas keprotokolan dan komunikasi pimpinan dijalankan oleh setiap pemerintah daerah. Di Kalimantan Utara, sasaran replikasi langsung meliputi Pemerintah Provinsi Kalimantan Utara, Pemerintah Kabupaten Bulungan, Malinau, Nunukan, dan Tana Tidung, serta sekretariat DPRD yang mengelola agenda pimpinan dewan. Yang perlu disesuaikan hanya nama jabatan, daftar pengguna, dan tata naskah dinas setempat.`));
  tambah(h2("11.2 Syarat Replikasi"));
  tambah(tabel({
    judul: "Kebutuhan untuk mereplikasi",
    kolom: [22, 78],
    baris: [
      ["Kebutuhan", "Keterangan"],
      ["Perangkat", "Peramban dan sambungan internet; tanpa perangkat keras khusus"],
      ["Biaya", "Layanan komputasi awan pada kuota tanpa biaya"],
      ["Prosedur", "Sebelas SOP siap diadaptasi"],
      ["Sumber daya manusia", "Satu pengelola dengan pendampingan; pengguna cukup dengan pengenalan singkat"],
    ],
  }));
  tambah(h2("11.3 Dokumentasi Pengetahuan"));
  tambah(P(`Pengetahuan kerja telah didokumentasikan dalam sebelas SOP, panduan pemasangan layanan daftar hadir, dan catatan teknis pada kode aplikasi. Perangkat daerah lain dapat mengadopsi prosedurnya lebih dahulu, bahkan sebelum menerapkan aplikasinya.`));
  tambah(h2("11.4 Diseminasi yang Telah Dilakukan"));
  tambah(butir([
    `**Lintas perangkat daerah melalui Tim Koordinasi.** Keputusan Sekretaris Daerah melibatkan para Sekretaris Dinas di lingkungan Pemerintah Kota Tarakan dalam Tim Koordinasi, sehingga pelaksanaan inovasi ini diketahui dan melibatkan perangkat daerah lain.`,
    `**Melalui layanan publik.** Sebanyak ${D.ruang.instansi_berbeda} instansi telah menggunakan layanan peminjaman ruangan dan ${D.tamu.instansi_berbeda} instansi mengajukan audiensi melalui kanal daring, sehingga mengenal langsung cara kerja baru ini.`,
    `**Pengguna di luar Bagian Prokopim.** Pimpinan Daerah, ajudan, pengawal pribadi, dan ${peran.mitra_kerja || 0} akun mitra kerja Pemerintah Kota menggunakan aplikasi secara rutin.`,
    `**Koordinasi dengan perangkat daerah teknis.** Dinas Komunikasi, Informatika, Statistik dan Persandian serta Bappeda Litbang telah menerima pemberitahuan resmi melalui Surat Sekretaris Daerah tanggal 11 Maret 2026.`,
  ]));
  tambah(h2("11.5 Rencana Diseminasi"));
  tambah(tabel({
    judul: "Rencana diseminasi",
    kolom: [24, 76],
    baris: [
      ["Waktu", "Kegiatan"],
      ["Oktober 2026", "Publikasi praktik baik melalui kanal resmi Pemerintah Kota Tarakan"],
      ["November 2026", "Penyusunan paket replikasi: SOP, panduan konfigurasi, dan templat data awal"],
      ["Desember 2026", "Paparan kepada unit keprotokolan pemerintah provinsi dan kabupaten di Kalimantan Utara"],
      ["Semester I 2027", "Pendampingan uji coba pada pemerintah daerah yang berminat"],
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
    const isi = [...atas, ...(o.meterai ? ["", "[[meterai Rp10.000]]", ""] : ["", "", "", ""]), nama.startsWith("[[") ? nama : `**${nama}**`, ...bawah];
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
      ["2", "Surat usulan dari Sekretariat Daerah Kota Tarakan"],
      ["3", "Bukti identitas anggota tim"],
      ["4", "Tangkapan layar aplikasi"],
      ["5", "Tautan video demonstrasi"],
      ["6", `Dokumen keputusan: (a) Keputusan Sekretaris Daerah Nomor ${SK_SEKDA}; (b) Surat Sekretaris Daerah Nomor ${NOMOR_SURAT_SEKDA}`],
      ["7", "Sebelas SOP format PermenPAN-RB 35/2012"],
      ["8", `Keluaran statistik penggunaan per ${PER_TGL}`],
      ["9", "Testimoni pengguna"],
      ["10", "Tautan aplikasi untuk verifikasi"],
    ],
  }));

  // ── Lampiran 1: Pakta integritas ──
  judulL(1, "Pakta Integritas");
  out.push(tengahTebal("PAKTA INTEGRITAS", { size: 24, after: 280, garis: true }));
  out.push(PN("Saya yang bertanda tangan di bawah ini:"));
  out.push(baris2([["Nama", NAMA_KETUA], ["NIP", "[[NIP]]"], ["Jabatan", "Kepala Bagian Protokol dan Komunikasi Pimpinan"], ["Instansi", "Sekretariat Daerah Kota Tarakan"], ["Kedudukan", "Ketua Tim Inovasi Prokopim Hibot"]]));
  out.push(P(`selaku ketua tim peserta Lomba Inovasi Daerah Provinsi Kalimantan Utara Tahun 2026 (Kaltara Innovation Awards) kategori Inovasi Terapan – ASN Pemerintah Kabupaten/Kota dengan judul *${JUDUL_LENGKAP}*, dengan ini menyatakan bahwa:`, { before: 120, indent: false }));
  tambah(angka([
    "usulan inovasi merupakan karya asli tim, tidak mengandung plagiarisme, tidak melanggar hak kekayaan intelektual pihak lain, dan tidak sedang dalam sengketa;",
    "usulan yang sama belum pernah menjadi Juara I, II, atau III pada Kaltara Innovation Awards maupun memperoleh penghargaan tingkat nasional;",
    "seluruh data, informasi, dan dokumen yang disampaikan adalah benar dan dapat dipertanggungjawabkan;",
    "perangkat lunak, data, dan materi pihak lain yang digunakan telah memenuhi ketentuan lisensi dan ketentuan penggunaannya;",
    "bersedia mengikuti seluruh tahapan penilaian, termasuk klarifikasi, presentasi, demonstrasi, dan verifikasi; dan",
    "bersedia didiskualifikasi atau dicabut penghargaannya apabila di kemudian hari terbukti melanggar pernyataan ini.",
  ]));
  out.push(P("Demikian pakta integritas ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.", { before: 120 }));
  out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  out.push(tandaTangan(["Tarakan, [[tanggal]] September 2026", "Yang membuat pernyataan,"], NAMA_KETUA, ["NIP [[NIP]]"], { meterai: true }));

  // ── Lampiran 2: Surat usulan ──
  judulL(2, "Surat Usulan");
  const lLogo = 1300, lKop = LEBAR - lLogo;
  out.push(new Table({ width: { size: LEBAR, type: WidthType.DXA }, columnWidths: [lLogo, lKop],
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: lLogo, type: WidthType.DXA }, borders: tanpaGaris, verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [gambar("logo_tarakan.png", 70)] })] }),
      sel(["**PEMERINTAH KOTA TARAKAN**", "**SEKRETARIAT DAERAH**", "[[alamat kantor, telepon, laman]]", "**TARAKAN**"], lKop, { borders: tanpaGaris, align: AlignmentType.CENTER, size: 24, vAlign: VerticalAlign.CENTER }),
    ] })] }));
  out.push(new Paragraph({ border: { bottom: { style: BorderStyle.THICK_THIN_SMALL_GAP, size: 18, color: HITAM, space: 1 } }, spacing: { after: 200 }, children: [] }));
  out.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 120 }, children: runs("Tarakan, [[tanggal]] September 2026", { size: UK, font: FONT }) }));
  out.push(baris2([["Nomor", "[[nomor surat]]"], ["Sifat", "Biasa"], ["Lampiran", "1 (satu) berkas"], ["Hal", "Usulan Peserta Kaltara Innovation Awards Tahun 2026"]], 0.16));
  out.push(PN("Yth. Kepala Badan Perencanaan Pembangunan, Riset dan Inovasi Daerah Provinsi Kalimantan Utara", { before: 200, after: 0 }));
  out.push(PN("di", { after: 0 }));
  out.push(PN("Tanjung Selor", { after: 200 }));
  out.push(P(`Menindaklanjuti Panduan Teknis Lomba Inovasi Daerah Provinsi Kalimantan Utara Tahun 2026 (Kaltara Innovation Awards), dengan ini kami mengusulkan inovasi dari lingkungan Sekretariat Daerah Kota Tarakan sebagai peserta dengan keterangan sebagai berikut:`));
  out.push(baris2([
    ["Judul inovasi", JUDUL_LENGKAP],
    ["Kategori", "Inovasi Terapan – ASN Pemerintah Kabupaten/Kota"],
    ["Bidang fokus", "3. Tata Kelola Kolaboratif dan Pelayanan Publik"],
    ["Ketua tim", `${NAMA_KETUA} (Kepala Bagian Protokol dan Komunikasi Pimpinan)`],
    ["Anggota tim", "Saifullah, S.H.; Juliyanti, S.AP.; Nuraini Wiliadewi, S.IP.; Ni Kade Sari Handayani, S.AP."],
    ["Unit pelaksana", "Bagian Protokol dan Komunikasi Pimpinan"],
  ]));
  out.push(P(`Inovasi tersebut telah diterapkan sejak Maret 2026 dan didukung Keputusan Sekretaris Daerah Kota Tarakan Nomor ${SK_SEKDA}. Bersama ini kami sampaikan proposal beserta kelengkapannya. Demikian disampaikan, atas perhatian Bapak/Ibu kami ucapkan terima kasih.`, { before: 160 }));
  out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  out.push(tandaTangan(["SEKRETARIS DAERAH KOTA TARAKAN,"], "[[nama Sekretaris Daerah]]", ["[[pangkat/golongan]]", "NIP [[NIP]]"]));

  // ── Lampiran 3 ──
  pembatas(3, "Bukti Identitas Anggota Tim", "Sisipkan pindaian KTP atau kartu pegawai kelima anggota tim pada halaman ini");

  // ── Lampiran 4: Tangkapan layar ──
  judulL(4, "Tangkapan Layar Aplikasi");
  out.push(PN("Tangkapan layar diambil dari aplikasi Prokopim Hibot yang dijalankan dengan data contoh, untuk menghindari penyebaran nomor telepon narahubung dan agenda Pimpinan yang belum terbuka untuk umum. Seluruh tampilan dan alurnya sama dengan sistem yang berjalan.", { size: UK_TABEL, after: 160 }));
  const tangkap = (file, lebarPx) => {
    const data = fs.readFileSync(path.join(LOMBA, "lampiran/tangkapan", file));
    const w = data.readUInt32BE(16), h = data.readUInt32BE(20);
    return new ImageRun({ type: "png", data, transformation: { width: lebarPx, height: Math.round(lebarPx * h / w) } });
  };
  const keterangan = (teks) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200 }, children: [new TextRun({ text: teks, bold: true, size: UK_TABEL, font: FONT })] });
  let g = 0;
  const layarLebar = [
    ["01-antrian-persetujuan.png", "Antrian persetujuan Kepala Bagian dengan daftar periksa wajib"],
    ["02-riwayat-alur.png", "Riwayat alur (jejak audit) mencatat pelaku, waktu, dan butir pemeriksaan"],
    ["04-kartu-kegiatan.png", "Jadwal tayang pada dasbor Kepala Subbagian, dengan peringatan kegiatan yang belum berpetugas"],
  ];
  for (const [f, t] of layarLebar) {
    out.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { after: 0, line: 240, lineRule: AUTO }, children: [tangkap(f, 540)] }));
    out.push(keterangan(`Gambar L.${++g}. ${t}`));
  }
  const lk = Math.floor(LEBAR / 2);
  out.push(new Table({ width: { size: LEBAR, type: WidthType.DXA }, columnWidths: [lk, LEBAR - lk], rows: [new TableRow({ cantSplit: true, children: [
    ["03-agenda-pimpinan-ponsel.png", "Agenda Wali Kota pada telepon pintar"],
    ["06-permohonan-audiensi-publik.png", "Halaman publik permohonan audiensi"],
  ].map(([f, t], i) => new TableCell({ width: { size: i ? LEBAR - lk : lk, type: WidthType.DXA }, borders: tanpaGaris, children: [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 240, lineRule: AUTO }, children: [tangkap(f, 200)] }),
    keterangan(`Gambar L.${++g}. ${t}`),
  ] })) })] }));

  // ── Lampiran 5 ──
  judulL(5, "Tautan Video Demonstrasi");
  out.push(PN("Video demonstrasi paling lama lima menit yang memuat latar belakang inovasi, penjaringan ide, pemilihan ide, manfaat, dan dampak inovasi dapat diakses melalui tautan berikut:"));
  out.push(PN("[[tautan video]]", { before: 120 }));

  // ── Lampiran 6 ──
  pembatas(6, "Dokumen Keputusan", `Sisipkan pindaian (a) Keputusan Sekretaris Daerah Nomor ${SK_SEKDA} dan (b) Surat Sekretaris Daerah tanggal 11 Maret 2026 pada halaman ini`);

  // ── Lampiran 7 (isi disisipkan dari SOP-Prokopim.pdf) ──
  judulL(7, "Sebelas Standar Operasional Prosedur");
  out.push(PN("Halaman-halaman berikut memuat sebelas SOP format PermenPAN-RB 35/2012 yang menjadi dasar alur kerja Prokopim Hibot."));

  // ── Lampiran 8 ──
  judulL(8, `Keluaran Statistik Penggunaan per ${PER_LENGKAP}`);
  out.push(PN(`Ditarik langsung dari basis data Prokopim Hibot menggunakan kueri baca-saja. Seluruh angka pada naskah proposal bersumber dari keluaran ini.`, { size: UK_TABEL }));
  const LABEL_AKSI = {
    create: "Jadwal dibuat", submit: "Diajukan Admin Rencana Kegiatan", forward_to_kabag: "Diteruskan Kepala Subbagian",
    publish: "Disetujui dan tayang", return_by_kasubbag: "Dikembalikan Kepala Subbagian", reject_by_kabag: "Ditolak Kepala Bagian",
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
    kasubbag_protokol: "Kepala Subbagian Protokol", kasubbag_komdokpim: "Kepala Subbagian Komunikasi dan Dokumentasi", ajudan_wakilwalikota: "Ajudan Wakil Wali Kota",
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
    ["[[nama]]", "Ajudan Wakil Wali Kota Tarakan", "Bagaimana Bapak/Ibu mengetahui agenda dan menyiapkan bahannya dahulu, dan apa yang berubah sekarang?"],
    ["[[nama]]", "Staf Protokol, Bagian Protokol dan Komunikasi Pimpinan", "Dahulu bagaimana mengetahui diri sedang ditugaskan, dan apakah pernah terjadi pemberitahuan yang terlambat atau tidak sampai?"],
  ];
  narasumber.forEach(([nama, jabatan, tanya], i) => {
    judulL(9, `Testimoni Pengguna (${i + 1} dari ${narasumber.length})`);
    out.push(tengahTebal("KETERANGAN PENGGUNA APLIKASI PROKOPIM HIBOT", { after: 240 }));
    out.push(PN("Yang bertanda tangan di bawah ini:"));
    out.push(baris2([["Nama", nama], ["Jabatan", jabatan], ["Instansi", "Pemerintah Kota Tarakan"]]));
    out.push(PN(`memberikan keterangan atas pemakaian aplikasi Prokopim Hibot, menjawab pertanyaan: *${tanya}*`, { before: 160 }));
    out.push(new Table({ width: { size: LEBAR, type: WidthType.DXA }, columnWidths: [LEBAR],
      rows: [new TableRow({ height: { value: 4200, rule: "atLeast" }, children: [sel("[[keterangan dua sampai empat kalimat; sebutkan keadaan sebelum dan sesudah]]", LEBAR, { size: UK })] })] }));
    out.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
    out.push(tandaTangan(["Tarakan, [[tanggal]] September 2026"], nama, i === 0 ? [] : ["NIP [[NIP]]"]));
  });

  // ── Lampiran 10 ──
  judulL(10, "Tautan Aplikasi untuk Verifikasi");
  out.push(PN("Halaman publik berikut dapat dibuka tanpa akun. Demonstrasi seluruh alur dengan akun pengguna disiapkan pada Tahap II."));
  tambah(tabel({ kolom: [45, 55], baris: [
    ["Layanan", "Alamat"],
    ["Permohonan audiensi", "[[alamat aplikasi]]/tamu"],
    ["Peminjaman ruangan", "[[alamat aplikasi]]/pinjamruangan"],
    ["Daftar hadir digital (contoh acara)", "[[alamat aplikasi]]/daftarhadir"],
  ] }));
  return out;
}

// ═══════════════════════════════════════════════════════════════════
//  SAMPUL DAN DAFTAR ISI
// ═══════════════════════════════════════════════════════════════════
function sampul() {
  const tengah = (teks, o = {}) => new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: o.before ?? 0, after: o.after ?? 0, line: o.line ?? 276, lineRule: AUTO },
    children: [new TextRun({ text: teks, bold: o.bold ?? true, size: o.size ?? UK, font: FONT })],
  });
  const identitas = [
    ["Kategori", "Inovasi Terapan – ASN Pemerintah Kabupaten/Kota"],
    ["Bidang Fokus", "3. Tata Kelola Kolaboratif dan Pelayanan Publik"],
    ["Nama Inovator/Tim", "Tim Inovasi Prokopim Hibot\nKetua: Anugrah Yega Pranatha, M.Si."],
    ["Instansi", "Bagian Protokol dan Komunikasi Pimpinan, Sekretariat Daerah Kota Tarakan"],
    ["Kabupaten/Kota", "Kota Tarakan"],
    ["Tahun", "2026"],
  ];
  const lebarLabel = Math.round(LEBAR * 0.30), lebarIsi = LEBAR - lebarLabel;
  const tabelIdentitas = new Table({
    width: { size: LEBAR, type: WidthType.DXA }, columnWidths: [lebarLabel, lebarIsi],
    rows: identitas.map(([a, b]) => new TableRow({ children: [
      sel(`**${a}**`, lebarLabel, { borders: tanpaGaris, size: UK }),
      sel(b.split("\n"), lebarIsi, { borders: tanpaGaris, size: UK }),
    ] })),
  });
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 280, line: 240, lineRule: AUTO }, children: [gambar("logo_tarakan.png", 118)] }),
    tengah("PROPOSAL INOVASI TERAPAN", { size: 30, after: 60 }),
    tengah("LOMBA INOVASI DAERAH PROVINSI KALIMANTAN UTARA", { size: 22 }),
    tengah("KALTARA INNOVATION AWARDS TAHUN 2026", { size: 22, after: 420 }),
    tengah(JUDUL, { size: 40, after: 100 }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360, line: 300, lineRule: AUTO }, indent: { left: 500, right: 500 }, children: [new TextRun({ text: SUBJUDUL, bold: true, size: 26, font: FONT })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 480, line: 240, lineRule: AUTO }, children: [gambar("logo-transparent.png", 128)] }),
    tabelIdentitas,
    tengah("PEMERINTAH KOTA TARAKAN", { before: 900, size: 24 }),
    tengah("SEKRETARIAT DAERAH", { size: 24 }),
    tengah("BAGIAN PROTOKOL DAN KOMUNIKASI PIMPINAN", { size: 24 }),
    tengah("2026", { size: 24 }),
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
  out.push(new Paragraph({ spacing: { before: 200 }, children: runs("*Halaman isi dinomori mulai Bagian 2. Sampul dan lampiran tidak termasuk dalam batas 20 halaman.*", { size: UK_KECIL, font: FONT }) }));
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
    title: "Proposal Inovasi Terapan — Prokopim Hibot",
    description: "Kaltara Innovation Awards 2026",
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

async function tulisDanRender(halaman) {
  const buf = await Packer.toBuffer(buatDokumen(halaman));
  fs.writeFileSync(KELUAR + ".docx", buf);
  execFileSync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", LOMBA, KELUAR + ".docx"], { stdio: "ignore" });
}

// Lintasan 1: render untuk mencari letak judul. Lintasan 2: isi nomor halaman.
await tulisDanRender(null);
const judulSemua = urutanJudul.map((j) => j.teks);
const hasil = JSON.parse(execFileSync("python3", [path.join(DIR, "halaman.py"), KELUAR + ".pdf", BAB.b2, ...judulSemua], { encoding: "utf8" }));
await tulisDanRender(hasil.halaman);
const akhir = JSON.parse(execFileSync("python3", [path.join(DIR, "halaman.py"), KELUAR + ".pdf", BAB.b2, ...judulSemua], { encoding: "utf8" }));
execFileSync("python3", [path.join(DIR, "gabung.py"), KELUAR + ".pdf", path.join(REPO, "docs/sop/SOP-Prokopim.pdf")], { stdio: "inherit" });
console.log(JSON.stringify({ ...akhir, keluaran: [KELUAR + ".docx", KELUAR + ".pdf"] }, null, 2));
