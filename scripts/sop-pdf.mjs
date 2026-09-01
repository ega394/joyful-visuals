/**
 * scripts/sop-pdf.mjs — merangkai berkas SOP di docs/sop/ menjadi satu PDF A4.
 *
 *   node scripts/sop-pdf.mjs [keluaran.pdf]
 *
 * Markdown di docs/sop/ adalah satu-satunya sumber; berkas ini hanya menata
 * tampilannya untuk cetak. Pengurai markdown-nya sengaja sederhana karena
 * bentuk berkasnya kita kendalikan sendiri: judul, tabel, daftar bernomor,
 * kutipan, paragraf, dan pemisah.
 *
 * Tata letak: A4 tegak untuk sampul dan pengantar, A4 lanskap untuk lembar SOP
 * — tabel prosedur berkolom tujuh tidak terbaca pada halaman tegak.
 */

import { readFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const DIR    = resolve("docs/sop");
const TUJUAN = resolve(process.argv[2] || "docs/sop/SOP-Prokopim.pdf");

// ── Pengurai markdown ────────────────────────────────────────────
const lolos = (s) => s
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Sebaris: **tebal**, *miring*, `kode`, dan <br> yang memang kita tulis sendiri.
function sebaris(s) {
  return lolos(s)
    .replace(/&lt;br&gt;/g, "<br>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+?)\*/g, "$1<em>$2</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

const selDari = (baris) =>
  baris.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map(s => s.trim());

const pemisahTabel = (b) => /^\|[\s:|-]+\|$/.test(b.trim());

function keHTML(md) {
  const baris = md.split("\n");
  const out = [];
  let i = 0;

  const tutupDaftar = (jenis) => { if (jenis) out.push(`</${jenis}>`); };
  let daftar = null;

  while (i < baris.length) {
    const b = baris[i];

    // Tabel: baris berawalan "|" yang diikuti baris pemisah.
    if (b.trim().startsWith("|") && pemisahTabel(baris[i + 1] || "")) {
      tutupDaftar(daftar); daftar = null;
      const kepala = selDari(b);
      const lebar  = kepala.length;
      i += 2;
      const isi = [];
      while (i < baris.length && baris[i].trim().startsWith("|")) {
        isi.push(selDari(baris[i])); i++;
      }
      // Tabel identitas = 2 kolom; tabel prosedur = 7 kolom.
      const kelas = lebar === 7 ? "prosedur" : lebar === 2 ? "identitas" : "ringkas";
      out.push(`<table class="${kelas}"><thead><tr>` +
        kepala.map(h => `<th>${sebaris(h)}</th>`).join("") +
        `</tr></thead><tbody>` +
        isi.map(r => `<tr>` +
          r.map((c, k) => `<td class="k${k}">${sebaris(c)}</td>`).join("") +
        `</tr>`).join("") +
        `</tbody></table>`);
      continue;
    }

    // Kutipan (blok peringatan)
    if (b.startsWith(">")) {
      tutupDaftar(daftar); daftar = null;
      const isi = [];
      while (i < baris.length && baris[i].startsWith(">")) {
        isi.push(baris[i].replace(/^>\s?/, "")); i++;
      }
      out.push(`<div class="sorot">${keHTML(isi.join("\n"))}</div>`);
      continue;
    }

    const judul = b.match(/^(#{1,4})\s+(.*)$/);
    if (judul) {
      tutupDaftar(daftar); daftar = null;
      out.push(`<h${judul[1].length}>${sebaris(judul[2])}</h${judul[1].length}>`);
      i++; continue;
    }

    if (/^---+$/.test(b.trim())) {
      tutupDaftar(daftar); daftar = null;
      out.push(`<hr>`); i++; continue;
    }

    const bernomor = b.match(/^(\d+)\.\s+(.*)$/);
    const berbutir = b.match(/^[-*]\s+(.*)$/);
    if (bernomor || berbutir) {
      const jenis = bernomor ? "ol" : "ul";
      if (daftar !== jenis) { tutupDaftar(daftar); out.push(`<${jenis}>`); daftar = jenis; }
      // Baris lanjutan sebuah butir ditulis menjorok.
      let teks = (bernomor ? bernomor[2] : berbutir[1]);
      i++;
      while (i < baris.length && /^\s{2,}\S/.test(baris[i])) { teks += " " + baris[i].trim(); i++; }
      out.push(`<li>${sebaris(teks)}</li>`);
      continue;
    }

    if (!b.trim()) { tutupDaftar(daftar); daftar = null; i++; continue; }

    // Paragraf: kumpulkan sampai baris kosong.
    tutupDaftar(daftar); daftar = null;
    let par = b.trim(); i++;
    while (i < baris.length && baris[i].trim() && !baris[i].trim().startsWith("|")
           && !baris[i].startsWith(">") && !/^#{1,4}\s/.test(baris[i])
           && !/^---+$/.test(baris[i].trim()) && !/^(\d+\.|[-*])\s/.test(baris[i])) {
      par += " " + baris[i].trim(); i++;
    }
    out.push(`<p>${sebaris(par)}</p>`);
  }
  tutupDaftar(daftar);
  return out.join("\n");
}

// ── Gaya cetak ───────────────────────────────────────────────────
const GAYA = `
@page { size: A4 landscape; margin: 12mm 10mm 14mm; }
@page tegak { size: A4 portrait; margin: 20mm 18mm; }

* { box-sizing: border-box; }
body {
  font-family: Arial, "Liberation Sans", Arimo, Helvetica, sans-serif;
  font-size: 8.4pt; line-height: 1.45; color: #111; margin: 0;
}
.tegak { page: tegak; }
.lembar { page-break-before: always; }
.lembar:first-child { page-break-before: avoid; }

h1 { font-size: 15pt; margin: 0 0 10pt; letter-spacing: .2px; }
h2 { font-size: 10.5pt; margin: 14pt 0 5pt; padding-bottom: 3pt;
     border-bottom: 1.2pt solid #0A1628; text-transform: uppercase; letter-spacing: .6px; }
h3 { font-size: 9.5pt; margin: 10pt 0 4pt; }
p  { margin: 4pt 0; text-align: justify; }
ol, ul { margin: 4pt 0 4pt 16pt; padding: 0; }
li { margin: 2pt 0; }
hr { border: 0; border-top: .6pt solid #CBD5E1; margin: 9pt 0; }
code { font-family: "DejaVu Sans Mono", monospace; font-size: 7.6pt;
       background: #F1F5F9; padding: 0 2px; border-radius: 2px; }

table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt;
        page-break-inside: auto; }
th, td { border: .6pt solid #64748B; padding: 3.2pt 4.5pt; vertical-align: top; }
th { background: #0A1628; color: #fff; font-size: 8pt; text-align: left;
     font-weight: 700; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
tbody tr:nth-child(even) { background: #F8FAFC; }

/* Tabel identitas: label sempit, isi lebar */
table.identitas td.k0 { width: 22%; background: #F1F5F9; font-weight: 700; }
table.identitas thead { display: none; }

/* Tabel prosedur: tujuh kolom, lebar diatur agar Uraian & Keterangan lega */
table.prosedur td.k0, table.prosedur th:nth-child(1) { width: 3%;  text-align: center; }
table.prosedur td.k1 { width: 25%; }
table.prosedur td.k2 { width: 14%; }
table.prosedur td.k3 { width: 12%; }
table.prosedur td.k4 { width: 8%;  }
table.prosedur td.k5 { width: 13%; }
table.prosedur td.k6 { width: 25%; }

.sorot { border: .8pt solid #F59E0B; background: #FFFBEB; border-radius: 3pt;
         padding: 7pt 10pt; margin: 8pt 0; page-break-inside: avoid; }
.sorot h3 { margin-top: 0; color: #92400E; }
.sorot p, .sorot li { text-align: left; }

/* Sampul */
.sampul { page: tegak; page-break-after: always; text-align: center;
          padding-top: 55mm; }
/* Tempat lambang daerah — dibubuhkan saat dokumen dicetak & disahkan */
.sampul .lambang { width: 32mm; height: 32mm; margin: 0 auto 10mm;
  border: .8pt dashed #94A3B8; border-radius: 3pt; color: #94A3B8;
  font-size: 7.5pt; display: flex; align-items: center;
  justify-content: center; text-align: center; line-height: 1.4; }
.sampul h1 { font-size: 26pt; letter-spacing: 1px; margin-bottom: 4mm; }
.sampul .sub { font-size: 13pt; font-weight: 700; margin-bottom: 2mm; }
.sampul .ins { font-size: 11pt; margin-bottom: 22mm; line-height: 1.7; }
.sampul .acuan { font-size: 9.5pt; color: #334155; border-top: .8pt solid #94A3B8;
                 border-bottom: .8pt solid #94A3B8; padding: 5mm 0; margin: 0 22mm; }
.sampul .tahun { margin-top: 24mm; font-size: 12pt; font-weight: 700; }
`;

// ── Rakit dokumen ────────────────────────────────────────────────
const berkas = readdirSync(DIR).filter(f => /^\d\d-.*\.md$/.test(f)).sort();
if (!berkas.length) { console.error("Tidak ada berkas SOP di " + DIR); process.exit(1); }

const bagian = berkas.map(f => {
  const isi = keHTML(readFileSync(`${DIR}/${f}`, "utf8"));
  // Pengantar dibiarkan tegak; lembar SOP lanskap.
  const tegak = f.startsWith("00-");
  return `<section class="lembar${tegak ? " tegak" : ""}">${isi}</section>`;
}).join("\n");

const SAMPUL = `
<section class="sampul">
  <div class="lambang">Lambang<br>Daerah</div>
  <div class="sub">STANDAR OPERASIONAL PROSEDUR</div>
  <h1>BAGIAN PROTOKOL DAN<br>KOMUNIKASI PIMPINAN</h1>
  <div class="ins">Sekretariat Daerah Kota Tarakan</div>
  <div class="acuan">
    Disusun mengikuti Peraturan Menteri Pendayagunaan Aparatur Negara<br>
    dan Reformasi Birokrasi Nomor 35 Tahun 2012 tentang<br>
    Pedoman Penyusunan Standar Operasional Prosedur Administrasi Pemerintahan
  </div>
  <div class="tahun">TAHUN ${new Date().getFullYear()}</div>
</section>`;

const html = `<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>SOP Bagian Prokopim Setda Kota Tarakan</title>
<style>${GAYA}</style></head><body>${SAMPUL}${bagian}</body></html>`;

// ── Cetak ────────────────────────────────────────────────────────
mkdirSync(dirname(TUJUAN), { recursive: true });

// Chromium bawaan lingkungan ini kadang berbeda versi dengan yang dicari
// Playwright. Bila ada, pakai yang tersedia daripada mengunduh ulang.
const BAWAAN = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const peramban = await chromium.launch({
  args: ["--no-sandbox"],
  ...(existsSync(BAWAAN) ? { executablePath: BAWAAN } : {}),
});
const halaman  = await peramban.newPage();
await halaman.setContent(html, { waitUntil: "load" });
await halaman.pdf({
  path: TUJUAN,
  format: "A4",
  landscape: true,
  printBackground: true,
  preferCSSPageSize: true,   // hormati @page agar sampul & pengantar tetap tegak
  displayHeaderFooter: true,
  headerTemplate: `<div></div>`,
  footerTemplate:
    `<div style="width:100%;font-family:Arial,sans-serif;font-size:7pt;color:#64748B;
      padding:0 12mm;display:flex;justify-content:space-between;">
       <span>SOP Bagian Prokopim — Setda Kota Tarakan</span>
       <span>Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></span>
     </div>`,
});
await peramban.close();

console.log(`PDF tersimpan: ${TUJUAN}`);
console.log(`Berkas sumber: ${berkas.length} lembar SOP`);
