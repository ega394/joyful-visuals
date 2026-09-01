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

// ── Diagram alir bercabang ───────────────────────────────────────
// PermenPAN-RB 35/2012 menghendaki satu kolom Pelaksana untuk tiap aktor,
// dengan simbol pada kolom pelakunya. Markdown menyimpannya sebagai satu
// kolom teks agar tetap terbaca sebagai naskah; pemecahan menjadi kolom
// dilakukan di sini, saat dicetak.

// Sebutan yang sebenarnya menunjuk pelaku yang sama disatukan supaya tidak
// menghasilkan dua kolom untuk orang yang itu-itu juga.
const SEPADAN = {
  "Petugas Protokol": "Staf Protokol",
  // Penyusun naskah sambutan adalah Staf Komdok yang ditunjuk — satu orang,
  // bukan dua pelaksana yang berbeda.
  "Penyusun": "Staf Komunikasi dan Dokumentasi",
  // Pengaju penghapusan daftar hadir adalah salah satu dari pelaksana yang
  // sudah punya kolom sendiri; disatukan agar tidak muncul kolom kembar.
  "Pengaju penghapusan": "Pengaju",
};
// Kepala kolom dipendekkan — kolom simbol hanya selebar ±13 mm.
const RINGKAS = {
  "Admin Rencana Kegiatan": "Admin RK",
  "Kepala Bagian": "Kabag",
  "Kasubbag Protokol": "Kasubbag Protokol",
  "Kasubbag Komdokpim": "Kasubbag Komdok",
  "Pejabat penanda tangan": "Pejabat TTD",
  "Admin Undangan": "Admin Undangan",
  "Staf Komunikasi dan Dokumentasi": "Staf Komdok",
  "Petugas yang ditugaskan": "Petugas",
  "Pengelola Ruangan": "Pengelola Ruang",
  "Pejabat penanda tangan": "Pejabat TTD",
};

const bakukan = (n) => SEPADAN[n] || n;

function pelakuDari(selPelaksana) {
  return selPelaksana.split(",").map(s => bakukan(s.trim())).filter(Boolean);
}

// Bentuk simbol ditentukan dari isi kolom Keterangan, yang memang sudah
// menyatakan mulai, selesai, dan percabangan keputusan.
function bentukLangkah(ket) {
  const k = ket.replace(/\*\*/g, "");
  if (/^Keputusan:/i.test(k.trim()))            return "keputusan";
  if (/\bMulai\b/.test(k))                       return "mulai";
  if (/\bSelesai\b/.test(k))                     return "selesai";
  return "proses";
}

const SIMBOL = {
  mulai:    `<svg viewBox="0 0 40 20"><rect x="2" y="3" width="36" height="14" rx="7" ry="7"/></svg>`,
  selesai:  `<svg viewBox="0 0 40 20"><rect x="2" y="3" width="36" height="14" rx="7" ry="7"/></svg>`,
  proses:   `<svg viewBox="0 0 40 20"><rect x="3" y="3" width="34" height="14"/></svg>`,
  keputusan:`<svg viewBox="0 0 40 20"><polygon points="20,2 38,10 20,18 2,10"/></svg>`,
};

function tabelAlir(isi) {
  // Urutan kolom mengikuti urutan kemunculan pertama pada alur.
  const aktor = [];
  for (const r of isi) for (const p of pelakuDari(r[2]))
    if (!aktor.includes(p)) aktor.push(p);
  const N = aktor.length;
  const slot = (i) => ((i + 0.5) / N) * 100;

  // Lebar kolom ditetapkan lewat <colgroup>: dengan table-layout:fixed,
  // lebar pada baris kepala kedua diabaikan karena baris pertama memakai
  // colspan, sehingga Mutu Baku sempat menyempit sampai teksnya terpenggal.
  const wAktor = Math.min(34, N * 5);
  const sisa   = 100 - 2.6 - 26.5 - wAktor;
  const wUraian = sisa * 0.55, wKet = sisa * 0.45;
  const kolom =
    `<colgroup>` +
    `<col style="width:2.6%"><col style="width:${wUraian.toFixed(2)}%">` +
    aktor.map(() => `<col style="width:${(wAktor / N).toFixed(2)}%">`).join("") +
    `<col style="width:10%"><col style="width:6.5%"><col style="width:10%">` +
    `<col style="width:${wKet.toFixed(2)}%">` +
    `</colgroup>`;

  const kepala =
    `<tr>` +
    `<th rowspan="2" class="c-no">No</th>` +
    `<th rowspan="2" class="c-uraian">Uraian Kegiatan</th>` +
    `<th colspan="${N}" class="c-pel">Pelaksana</th>` +
    `<th colspan="3" class="c-mutu">Mutu Baku</th>` +
    `<th rowspan="2" class="c-ket">Keterangan</th>` +
    `</tr><tr>` +
    aktor.map(a => `<th class="c-aktor">${lolos(RINGKAS[a] || a)}</th>`).join("") +
    `<th class="c-sub">Kelengkapan</th><th class="c-sub">Waktu</th><th class="c-sub">Output</th>` +
    `</tr>`;

  const badan = isi.map((r, n) => {
    const bentuk = bentukLangkah(r[6]);
    const pelaku = pelakuDari(r[2]).map(p => aktor.indexOf(p)).filter(x => x >= 0);
    const utama  = pelaku.length ? Math.min(...pelaku) : 0;

    // Sambungan ke langkah berikutnya: turun dari simbol, lalu mendatar bila
    // pelaksananya berpindah kolom.
    const brk = isi[n + 1];
    const tujuan = brk
      ? (pelakuDari(brk[2]).map(p => aktor.indexOf(p)).filter(x => x >= 0)[0] ?? utama)
      : null;

    const lapis = [];
    for (const i of pelaku)
      lapis.push(`<div class="simbol ${bentuk}" style="left:${slot(i) - 50 / N}%;width:${100 / N}%">${SIMBOL[bentuk]}</div>`);
    if (tujuan !== null) {
      lapis.push(`<div class="turun" style="left:${slot(utama)}%"></div>`);
      if (tujuan !== utama) {
        const a = Math.min(slot(utama), slot(tujuan)), b = Math.abs(slot(tujuan) - slot(utama));
        lapis.push(`<div class="mendatar" style="left:${a}%;width:${b}%"></div>`);
        lapis.push(`<div class="panah" style="left:${slot(tujuan)}%"></div>`);
      } else {
        lapis.push(`<div class="panah" style="left:${slot(utama)}%"></div>`);
      }
    }
    const pemisah = aktor.slice(1).map((_, k) =>
      `<div class="garis" style="left:${((k + 1) / N) * 100}%"></div>`).join("");

    return `<tr>` +
      `<td class="c-no">${sebaris(r[0])}</td>` +
      `<td class="c-uraian">${sebaris(r[1])}</td>` +
      `<td class="alir" colspan="${N}"><div class="alir-isi">${pemisah}${lapis.join("")}</div></td>` +
      `<td class="c-sub">${sebaris(r[3])}</td>` +
      `<td class="c-sub">${sebaris(r[4])}</td>` +
      `<td class="c-sub">${sebaris(r[5])}</td>` +
      `<td class="c-ket">${sebaris(r[6])}</td>` +
    `</tr>`;
  }).join("");

  return `<table class="alirtabel">${kolom}<thead>${kepala}</thead><tbody>${badan}</tbody></table>` +
    `<div class="legenda">
       <span><i class="lg mulai"></i> Mulai / Selesai</span>
       <span><i class="lg proses"></i> Proses</span>
       <span><i class="lg keputusan"></i> Keputusan</span>
       <span><i class="lg arah"></i> Arah proses</span>
       <span class="lg-ket">Percabangan keputusan dirinci pada kolom Keterangan.</span>
     </div>`;
}

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
      // Tabel prosedur (7 kolom) dirender sebagai diagram alir bercabang:
      // kolom Pelaksana dipecah satu kolom per aktor, berisi simbol.
      if (lebar === 7) { out.push(tabelAlir(isi)); continue; }

      const kelas = lebar === 2 ? "identitas" : "ringkas";
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

/* ── Diagram alir bercabang ─────────────────────────────────── */
table.alirtabel { font-size: 7.1pt; table-layout: fixed; }
table.alirtabel th { font-size: 6.9pt; text-align: center; padding: 2.6pt 2pt; }
/* Lebar tiap kolom ditetapkan lewat <colgroup> di penyusun tabel. */
table.alirtabel td { padding: 2.6pt 3pt; overflow-wrap: break-word; hyphens: none; }
table.alirtabel .c-no { text-align: center; }
/* Pada baris yang uraiannya hanya satu baris, simbol dan panah berdesakan.
   height pada <tr> berlaku sebagai tinggi minimum, jadi ruangnya tetap ada. */
table.alirtabel tbody tr { height: 32pt; }
/* Kolom aktor sempit (±10 mm). Huruf dikecilkan agar nama jabatan pecah di
   antarkata, bukan di tengah kata seperti "Kasubba / g Protokol". */
table.alirtabel th.c-aktor { font-size: 5.8pt; line-height: 1.2; padding: 3pt .5pt;
                             overflow-wrap: break-word; }

/* Sel alir memuat lapisan simbol & penghubung yang diposisikan mutlak. */
table.alirtabel td.alir { padding: 0; position: relative; }
td.alir .alir-isi { position: absolute; inset: 0; }

.alir-isi .garis { position: absolute; top: 0; bottom: 0; width: 0;
                   border-left: .4pt solid #CBD5E1; }
.alir-isi .simbol { position: absolute; top: 4pt; height: 13pt;
                    display: flex; align-items: center; justify-content: center; }
.alir-isi .simbol svg { width: 88%; height: 100%; overflow: visible; }
.alir-isi .simbol svg rect,
.alir-isi .simbol svg polygon { fill: #fff; stroke: #0A1628; stroke-width: 1.6; }
.alir-isi .simbol.mulai svg rect, .alir-isi .simbol.selesai svg rect { fill: #E2E8F0; }
.alir-isi .simbol.keputusan svg polygon { fill: #FEF3C7; }

/* Penghubung: turun dari simbol, mendatar bila pindah kolom, lalu panah. */
.alir-isi .turun { position: absolute; top: 17pt; bottom: 4.5pt; width: 0;
                   border-left: .9pt solid #0A1628; }
.alir-isi .mendatar { position: absolute; bottom: 4.5pt; height: 0;
                      border-top: .9pt solid #0A1628; }
.alir-isi .panah { position: absolute; bottom: 0; width: 0; height: 0;
                   margin-left: -2.4pt;
                   border-left: 2.4pt solid transparent;
                   border-right: 2.4pt solid transparent;
                   border-top: 4.5pt solid #0A1628; }

.legenda { display: flex; gap: 12pt; align-items: center; flex-wrap: wrap;
           font-size: 6.9pt; color: #334155; margin: -4pt 0 10pt; }
.legenda i.lg { display: inline-block; width: 13pt; height: 7pt; margin-right: 3pt;
                vertical-align: -1pt; border: .9pt solid #0A1628; background: #fff; }
.legenda i.lg.mulai { border-radius: 4pt; background: #E2E8F0; }
.legenda i.lg.keputusan { background: #FEF3C7; transform: rotate(45deg) scale(.72); }
.legenda i.lg.arah { border: 0; border-top: .9pt solid #0A1628; height: 0; width: 16pt; }
.legenda .lg-ket { color: #64748B; font-style: italic; }

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
