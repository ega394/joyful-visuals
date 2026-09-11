/**
 * scripts/proposal-pdf.mjs — proposal lomba dalam format yang dituntut panitia
 *
 *   node scripts/proposal-pdf.mjs [keluaran.pdf]
 *
 * Ketentuan teknis Kaltara Innovation Awards 2026 untuk kategori inovasi
 * terapan: kertas A4, huruf Arial 11 pt, spasi 1,15, dan **paling banyak 20
 * halaman di luar sampul dan lampiran**.
 *
 * Batas 20 halaman itulah alasan skrip ini mencetak dua kali: sekali seluruh
 * dokumen untuk dibaca, sekali lagi hanya bagian isi (2–11) untuk dihitung
 * halamannya. Tanpa itu, batasnya baru ketahuan terlampaui setelah berkas
 * ditolak pada seleksi administrasi.
 */

import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { keHTML } from "./_markdown.mjs";

const SUMBER = resolve("docs/lomba/proposal-inovasi.md");
const TUJUAN = resolve(process.argv[2] || "docs/lomba/Proposal-Inovasi.pdf");

// ── Gaya cetak ───────────────────────────────────────────────────
// Ukuran huruf badan teks dikunci 11 pt sesuai ketentuan. Tabel diturunkan ke
// 9,5 pt karena tabel berkolom banyak tidak muat pada 11 pt di kertas A4 —
// kelaziman yang diterima, dan ketentuan panitia menyebut huruf naskah.
const GAYA = `
@page { size: A4 portrait; margin: 25mm 22mm 25mm 28mm; }

* { box-sizing: border-box; }
body {
  font-family: Arial, "Liberation Sans", Arimo, Helvetica, sans-serif;
  font-size: 11pt; line-height: 1.15; color: #111; margin: 0;
  text-align: justify;
}
h1 { font-size: 16pt; margin: 0 0 10pt; }
h2 { font-size: 13pt; margin: 16pt 0 6pt; padding-bottom: 3pt;
     border-bottom: 1.2pt solid #0A1628; page-break-after: avoid; }
h3 { font-size: 11.5pt; margin: 12pt 0 4pt; page-break-after: avoid; }
p  { margin: 5pt 0; }
ol, ul { margin: 5pt 0 5pt 18pt; padding: 0; }
li { margin: 3pt 0; }
hr { border: 0; border-top: .6pt solid #CBD5E1; margin: 10pt 0; }
code { font-family: "DejaVu Sans Mono", monospace; font-size: 9pt;
       background: #F1F5F9; padding: 0 2px; border-radius: 2px; }

table { width: 100%; border-collapse: collapse; margin: 7pt 0 11pt;
        font-size: 9.5pt; text-align: left; }
th, td { border: .6pt solid #64748B; padding: 4pt 5pt; vertical-align: top;
         overflow-wrap: break-word; }
th { background: #0A1628; color: #fff; font-weight: 700; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
tbody tr:nth-child(even) { background: #F8FAFC; }
table.identitas td.k0 { width: 24%; background: #F1F5F9; font-weight: 700; }

/* Kutipan dipakai untuk catatan penyusun — ditandai agar tidak terbaca
   sebagai bagian naskah resmi. */
.sorot { border-left: 3pt solid #F59E0B; background: #FFFBEB;
         padding: 7pt 11pt; margin: 9pt 0; page-break-inside: avoid;
         text-align: left; }
.sorot p, .sorot li { margin: 3pt 0; }

pre.blok { font-family: "DejaVu Sans Mono", "Liberation Mono", monospace;
  font-size: 8.5pt; line-height: 1.3; background: #F8FAFC;
  border: .6pt solid #CBD5E1; border-radius: 3pt; padding: 7pt 9pt;
  margin: 7pt 0; white-space: pre; overflow-x: auto; text-align: left;
  page-break-inside: avoid; }

.sampul { page-break-after: always; text-align: center; padding-top: 45mm; }
.sampul h1, .sampul h2 { border: 0; text-align: center; }
.putus { page-break-before: always; }
`;

const md = readFileSync(SUMBER, "utf8");

// Bagian isi yang dihitung terhadap batas 20 halaman: bab 2 sampai 11.
// Sampul (bab 1) dan lampiran (bab 12 dan sesudahnya) dikecualikan panitia.
const awalIsi   = md.indexOf("\n## 2. ");
const awalLamp  = md.indexOf("\n## 12. ");
if (awalIsi < 0 || awalLamp < 0) {
  console.error("Tidak menemukan batas bab 2 atau bab 12 — periksa judul bab pada berkas sumber.");
  process.exit(1);
}
const bagianIsi = md.slice(awalIsi, awalLamp);

const bungkus = (isi) => `<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>Proposal Inovasi Prokopim</title><style>${GAYA}</style></head>
<body>${isi}</body></html>`;

const BAWAAN = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const peramban = await chromium.launch({
  args: ["--no-sandbox"],
  ...(existsSync(BAWAAN) ? { executablePath: BAWAAN } : {}),
});

async function cetak(html, tujuan) {
  const h = await peramban.newPage();
  await h.setContent(html, { waitUntil: "load" });
  const pdf = await h.pdf({
    path: tujuan, format: "A4", printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: "<div></div>",
    footerTemplate: `<div style="width:100%;font-family:Arial,sans-serif;font-size:8pt;
      color:#64748B;padding:0 22mm;text-align:right;">
      <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
  });
  await h.close();
  return pdf;
}

mkdirSync(dirname(TUJUAN), { recursive: true });
await cetak(bungkus(keHTML(md)), TUJUAN);

// Hitung halaman bagian isi saja — inilah yang dibatasi 20 halaman.
const pdfIsi = await cetak(bungkus(keHTML(bagianIsi)), undefined);
await peramban.close();

const hitungHalaman = (buf) =>
  (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
const halIsi = hitungHalaman(pdfIsi);
const total  = hitungHalaman(readFileSync(TUJUAN));

console.log(`PDF tersimpan : ${TUJUAN}`);
console.log(`Total halaman : ${total}`);
console.log(`Bagian isi (bab 2–11) : ${halIsi} halaman — batas panitia 20`);
console.log(halIsi <= 20
  ? `✓ Memenuhi batas, sisa ruang ${20 - halIsi} halaman.`
  : `✗ MELEBIHI batas sebanyak ${halIsi - 20} halaman. Perlu dipadatkan.`);
