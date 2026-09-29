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
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { keHTML as uraiMd, sebaris, lolos } from "./_markdown.mjs";

const DIR    = resolve("docs/sop");
const TUJUAN = resolve(process.argv[2] || "docs/sop/SOP-Prokopim.pdf");

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

// ── Pemenggalan tabel & simbol penghubung antarhalaman ───────────
// PermenPAN-RB 35/2012 menuliskan diagram alir secara vertikal dan hanya
// mengenal penghubung antarhalaman (segilima), bukan lingkaran penghubung
// di dalam satu halaman. Karena itu tabel prosedur dipenggal sendiri di sini
// — bukan diserahkan kepada peramban — supaya setiap pemenggalan dapat diberi
// sepasang segilima berhuruf sama: di bawah langkah terakhir satu halaman dan
// di atas langkah pertama halaman berikutnya.
let hurufSambung = 0;            // diatur ulang untuk setiap lembar SOP
const HURUF = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Perkiraan tinggi baris (pt) dari panjang teks tiap sel. Sengaja dilebihkan:
// lebih baik satu baris pindah halaman terlalu dini daripada tabel dipenggal
// peramban tanpa segilima.
function tinggiBaris(r, wUraian, wKet) {
  const lebarMm = (persen) => 277 * persen / 100;
  const baris = (teks, persen, faktor = 1) => {
    const polos = String(teks || "").replace(/\*\*|<br>/g, " ").trim();
    const perBaris = Math.max(8, Math.floor(lebarMm(persen) / 1.32 * faktor));
    return Math.max(1, Math.ceil(polos.length / perBaris) + (String(teks).match(/<br>/g) || []).length);
  };
  const n = Math.max(baris(r[1], wUraian), baris(r[6], wKet), baris(r[3], 10), baris(r[4], 6.5), baris(r[5], 10));
  return Math.max(34, n * 10.4 + 7);
}

const SEGILIMA = (h) =>
  `<svg viewBox="0 0 40 22"><polygon points="8,1 32,1 32,12 20,21 8,12"/>` +
  `<text x="20" y="11" text-anchor="middle" dominant-baseline="middle">${h}</text></svg>`;

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

  const kolomPelaku = (r) => pelakuDari(r[2]).map(p => aktor.indexOf(p)).filter(x => x >= 0);

  // Pemenggalan: potongan pertama berbagi halaman dengan judul bagian.
  const potongan = [[]];
  let terpakai = 0, batas = 410;
  isi.forEach((r, n) => {
    const t = tinggiBaris(r, wUraian, wKet) + (potongan.length > 1 && !potongan.at(-1).length ? 12 : 0);
    if (potongan.at(-1).length && terpakai + t > batas) { potongan.push([]); terpakai = 0; batas = 460; }
    potongan.at(-1).push(n); terpakai += t;
  });

  // Huruf segilima untuk tiap sambungan.
  const hurufKe = potongan.slice(1).map(() => HURUF[hurufSambung++ % 26]);

  const baris = (n, keluar, masuk) => {
    const r = isi[n];
    const bentuk = bentukLangkah(r[6]);
    const pelaku = kolomPelaku(r);
    const utama  = pelaku.length ? Math.min(...pelaku) : 0;
    const brk = isi[n + 1];
    const tujuan = brk ? (kolomPelaku(brk)[0] ?? utama) : null;

    const lapis = [];
    if (masuk) lapis.push(`<div class="segilima atas" style="left:${slot(utama) - 50 / N}%;width:${100 / N}%">${SEGILIMA(masuk)}</div>`,
                         `<div class="turun-masuk" style="left:${slot(utama)}%"></div>`);
    for (const i of pelaku)
      lapis.push(`<div class="simbol ${bentuk}" style="left:${slot(i) - 50 / N}%;width:${100 / N}%">${SIMBOL[bentuk]}</div>`);
    if (keluar) {
      // Langkah terakhir pada halaman ini: turun ke segilima, disambung di halaman berikutnya.
      lapis.push(`<div class="turun keluar" style="left:${slot(utama)}%"></div>`,
                 `<div class="segilima bawah" style="left:${slot(utama) - 50 / N}%;width:${100 / N}%">${SEGILIMA(keluar)}</div>`);
    } else if (tujuan !== null) {
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

    return `<tr class="${masuk ? "masuk" : ""}${keluar ? " keluar" : ""}">` +
      `<td class="c-no">${sebaris(r[0])}</td>` +
      `<td class="c-uraian">${sebaris(r[1])}</td>` +
      `<td class="alir" colspan="${N}"><div class="alir-isi${masuk ? " lanjut" : ""}">${pemisah}${lapis.join("")}</div></td>` +
      `<td class="c-sub">${sebaris(r[3])}</td>` +
      `<td class="c-sub">${sebaris(r[4])}</td>` +
      `<td class="c-sub">${sebaris(r[5])}</td>` +
      `<td class="c-ket">${sebaris(r[6])}</td>` +
    `</tr>`;
  };

  const tabel = potongan.map((idx, k) => {
    const badan = idx.map((n, j) => baris(n,
      j === idx.length - 1 && k < potongan.length - 1 ? hurufKe[k] : null,
      j === 0 && k > 0 ? hurufKe[k - 1] : null)).join("");
    return `<table class="alirtabel${k > 0 ? " lanjutan" : ""}">${kolom}<thead>${kepala}</thead><tbody>${badan}</tbody></table>` +
      (k < potongan.length - 1 ? `<div class="bersambung">Bersambung ke halaman berikutnya (penghubung ${hurufKe[k]})</div>` : "");
  }).join("");

  return tabel +
    `<div class="legenda">
       <span><i class="lg mulai"></i> Mulai / Selesai</span>
       <span><i class="lg proses"></i> Proses</span>
       <span><i class="lg keputusan"></i> Keputusan</span>
       <span><i class="lg arah"></i> Arah proses</span>
       <span><i class="lg segi"></i> Penghubung antarhalaman</span>
       <span class="lg-ket">Percabangan keputusan dirinci pada kolom Keterangan.</span>
     </div>`;
}

// ── Bagian Identitas (PermenPAN-RB 35/2012, Gambar 3) ────────────
// Kiri: lambang dan nomenklatur unit pembuat. Kanan: nomor, tanggal,
// pengesahan (jabatan, ruang tanda tangan, nama, NIP), dan nama SOP. Di
// bawahnya enam unsur berpasangan dua kolom.
const LOGO = `data:image/png;base64,${readFileSync(resolve("public/logo_tarakan.png")).toString("base64")}`;
const PENGESAH = {
  jabatan: "SEKRETARIS DAERAH KOTA TARAKAN",
  nama: "ABD. AZIS HASAN, A.P., M.H., CGCAE.",
  pangkat: "Pembina Utama Muda (IV/c)",
  nip: "NIP 19750212 199501 1 001",
};

function tabelIdentitas(isi) {
  const u = {};
  for (const [k, v] of isi) u[k.replace(/\*\*/g, "").trim().toLowerCase()] = v || "";
  const ambil = (k) => u[k.toLowerCase()] ?? "";
  const unit = ambil("Unit Kerja");
  const baris = (label, nilai, kelas = "") =>
    `<tr><td class="lbl">${label}</td><td class="nil ${kelas}">${nilai}</td></tr>`;
  const kanan = [
    baris("Nomor SOP", sebaris(ambil("Nomor SOP"))),
    baris("Tanggal Pembuatan", sebaris(ambil("Tanggal Pembuatan"))),
    baris("Tanggal Revisi", sebaris(ambil("Tanggal Revisi"))),
    baris("Tanggal Efektif", sebaris(ambil("Tanggal Efektif"))),
    baris("Disahkan oleh",
      `<div class="sah">${PENGESAH.jabatan},<div class="ttd"></div>` +
      `<b><u>${PENGESAH.nama}</u></b><br>${PENGESAH.pangkat}<br>${PENGESAH.nip}</div>`),
    baris("Nama SOP", `<b>${sebaris(ambil("Nama SOP"))}</b>`),
  ].join("");
  const pasang = (a, b) =>
    `<tr><th>${a}:</th><th>${b}:</th></tr>` +
    `<tr><td>${sebaris(ambil(a))}</td><td>${sebaris(ambil(b))}</td></tr>`;
  return `<table class="idt-atas"><tr>` +
      `<td class="kop"><img src="${LOGO}" alt="">` +
      `<div class="kop-teks"><b>PEMERINTAH KOTA TARAKAN</b><br><b>SEKRETARIAT DAERAH</b><br>` +
      `BAGIAN PROTOKOL DAN KOMUNIKASI PIMPINAN` +
      (unit ? `<br><span class="unit">${lolos(unit.replace(/\*\*/g, "")).toUpperCase()}</span>` : "") +
      `</div></td>` +
      `<td class="kanan"><table class="idt-kanan">${kanan}</table></td>` +
    `</tr></table>` +
    `<table class="idt-bawah"><colgroup><col style="width:50%"><col style="width:50%"></colgroup>` +
      pasang("Dasar Hukum", "Kualifikasi Pelaksana") +
      pasang("Keterkaitan", "Peralatan/Perlengkapan") +
      pasang("Peringatan", "Pencatatan dan Pendataan") +
    `</table>`;
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

pre.blok { font-family: "DejaVu Sans Mono", "Liberation Mono", monospace;
  font-size: 7.4pt; line-height: 1.3; background: #F8FAFC;
  border: .6pt solid #CBD5E1; padding: 6pt 8pt; margin: 6pt 0;
  white-space: pre; page-break-inside: avoid; }

/* ── Bagian Identitas (Gambar 3) ─────────────────────────────── */
table.idt-atas { margin: 4pt 0 0; }
table.idt-atas > tbody > tr > td { padding: 0; vertical-align: middle; }
table.idt-atas td.kop { width: 50%; text-align: center; padding: 8pt 10pt; }
table.idt-atas td.kop img { width: 22mm; display: block; margin: 0 auto 5pt; }
.kop-teks { font-size: 9pt; line-height: 1.5; }
.kop-teks .unit { font-weight: 700; }
table.idt-atas td.kanan { width: 50%; }
table.idt-kanan { margin: 0; border-style: hidden; }
table.idt-kanan td { font-size: 8pt; }
table.idt-kanan td.lbl { width: 30%; font-weight: 700; background: #F1F5F9; }
.sah { line-height: 1.35; }
.sah .ttd { height: 30pt; }
table.idt-bawah { margin-top: -1px; }
table.idt-bawah th { background: #E2E8F0; color: #0A1628; font-size: 8pt; }
table.idt-bawah td { font-size: 8pt; }
table.idt-bawah tbody tr:nth-child(even) { background: none; }

/* ── Pemenggalan diagram alir ───────────────────────────────── */
h2.prosedur { page-break-before: always; }
table.alirtabel.lanjutan { page-break-before: always; }
.bersambung { font-size: 6.9pt; color: #64748B; font-style: italic; margin: -7pt 0 0; }
table.alirtabel tbody tr.keluar { height: 40pt; }
table.alirtabel tbody tr.masuk  { height: 46pt; }
.alir-isi.lanjut .simbol { top: 18pt; }
.alir-isi.lanjut .turun, .alir-isi.lanjut .turun.keluar { top: 31pt; }
.alir-isi .turun.keluar { bottom: 12pt; }
.alir-isi .turun-masuk { position: absolute; top: 11pt; height: 7pt; width: 0;
                         border-left: .9pt solid #0A1628; }
.alir-isi .segilima { position: absolute; height: 11pt;
                      display: flex; align-items: center; justify-content: center; }
.alir-isi .segilima.atas { top: 1pt; }
.alir-isi .segilima.bawah { bottom: 1pt; }
.alir-isi .segilima svg { width: 60%; height: 100%; overflow: visible; }
.alir-isi .segilima polygon { fill: #fff; stroke: #0A1628; stroke-width: 1.6; }
.alir-isi .segilima text { font-size: 11px; font-weight: 700; fill: #0A1628; font-family: Arial, sans-serif; }
.legenda i.lg.segi { border: 0; background: none; width: 11pt; height: 9pt;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 22'><polygon points='8,1 32,1 32,12 20,21 8,12' fill='white' stroke='%230A1628' stroke-width='2.5'/></svg>");
  background-size: contain; background-repeat: no-repeat; }

/* ── Keputusan penetapan & daftar isi (tegak) ───────────────── */
.naskah { page: tegak; page-break-before: always; font-size: 10pt; line-height: 1.33; }
.naskah .tengah { text-align: center; }
.naskah .rancangan { text-align: right; font-size: 9pt; font-weight: 700; color: #92400E; letter-spacing: 2px; }
.naskah h1 { font-size: 11.5pt; text-align: center; margin: 0; line-height: 1.5; }
.naskah table.pasal { border: 0; margin: 2pt 0; font-size: 10pt; }
.naskah table.pasal td { border: 0; padding: 1pt 3pt; text-align: justify; }
.naskah table.pasal tbody tr:nth-child(even) { background: none; }
.naskah table.pasal td.k { width: 22mm; white-space: nowrap; }
.naskah table.pasal td.t { width: 4mm; }
.naskah table.pasal td.n { width: 6mm; }
.naskah .ttd-blok { margin: 8pt 0 0 52%; line-height: 1.4; }
.naskah .ttd-blok .ruang { height: 40pt; }
.naskah table.isi { font-size: 10.5pt; }
.naskah table.isi td { border: 0; border-bottom: .5pt dotted #94A3B8; padding: 4pt 3pt; }
.naskah table.isi tbody tr:nth-child(even) { background: none; }
.naskah table.isi td.hal { width: 16mm; text-align: right; }

/* Sampul */
.sampul { page: tegak; page-break-after: always; text-align: center;
          padding-top: 30mm; }
.sampul .lambang-img { width: 34mm; display: block; margin: 0 auto 12mm; }
.sampul .alamat { margin-top: 30mm; font-size: 9.5pt; line-height: 1.6; }
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
.sampul .tahun { margin-top: 20mm; font-size: 12pt; font-weight: 700; }
`;

// ── Rakit dokumen ────────────────────────────────────────────────
const berkas = readdirSync(DIR).filter(f => /^\d\d-.*\.md$/.test(f)).sort();
if (!berkas.length) { console.error("Tidak ada berkas SOP di " + DIR); process.exit(1); }

const judulBerkas = {};
const bagian = berkas.map(f => {
  hurufSambung = 0;
  const md = readFileSync(`${DIR}/${f}`, "utf8");
  judulBerkas[f] = (md.match(/^#\s+(.*)$/m) || [, f])[1].trim();
  const isi = uraiMd(md, { tabel7: tabelAlir, identitas: tabelIdentitas })
    // Bagian Prosedur selalu dimulai pada halaman baru.
    .replace(/<h2>(Bagian Prosedur)/g, `<h2 class="prosedur">$1`);
  // Pengantar dibiarkan tegak; lembar SOP lanskap.
  const tegak = f.startsWith("00-");
  return `<section class="lembar${tegak ? " tegak" : ""}">${isi}</section>`;
}).join("\n");

const TAHUN = 2026;
const ALAMAT = "Jalan Pulau Kalimantan No. 1 Kota Tarakan 77113<br>Telp (0551) 21620, 21623 Fax (0551) 33846";

// Halaman judul (PermenPAN-RB 35/2012, Gambar 2): lambang, judul, tahun, alamat.
const SAMPUL = `
<section class="sampul">
  <img class="lambang-img" src="${LOGO}" alt="Lambang Kota Tarakan">
  <div class="sub">STANDAR OPERASIONAL PROSEDUR</div>
  <h1>BAGIAN PROTOKOL DAN<br>KOMUNIKASI PIMPINAN</h1>
  <div class="ins">Sekretariat Daerah Kota Tarakan</div>
  <div class="acuan">
    Disusun berdasarkan Peraturan Menteri Pendayagunaan Aparatur Negara<br>
    dan Reformasi Birokrasi Nomor 35 Tahun 2012 serta<br>
    Peraturan Wali Kota Tarakan Nomor 50 Tahun 2021
  </div>
  <div class="tahun">${TAHUN}</div>
  <div class="alamat"><b>PEMERINTAH KOTA TARAKAN<br>SEKRETARIAT DAERAH</b><br>${ALAMAT}</div>
</section>`;

// Keputusan penetapan (PermenPAN-RB 35/2012, Bab III huruf C angka 1 huruf b).
// Berupa rancangan sampai ditandatangani; nomor dan tanggal sengaja kosong.
const baris3 = (k, isi) => `<tr><td class="k">${k}</td><td class="t">:</td><td colspan="2">${isi}</td></tr>`;
const butir = (k, n, isi) => `<tr><td class="k">${k}</td><td class="t">${k ? ":" : ""}</td><td class="n">${n}</td><td>${isi}</td></tr>`;
const KEPUTUSAN = `
<section class="naskah">
  <div class="rancangan">RANCANGAN</div>
  <div class="tengah"><img src="${LOGO}" style="width:15mm" alt=""></div>
  <h1>KEPUTUSAN SEKRETARIS DAERAH KOTA TARAKAN<br>NOMOR ........................................</h1>
  <p class="tengah">TENTANG</p>
  <h1>STANDAR OPERASIONAL PROSEDUR<br>BAGIAN PROTOKOL DAN KOMUNIKASI PIMPINAN<br>SEKRETARIAT DAERAH KOTA TARAKAN</h1>
  <p class="tengah" style="margin-top:6pt"><b>SEKRETARIS DAERAH KOTA TARAKAN,</b></p>
  <table class="pasal">
    ${butir("Menimbang", "a.", "bahwa dalam rangka meningkatkan tertib, efektivitas, dan akuntabilitas pelaksanaan tugas di bidang protokol, komunikasi pimpinan, dan dokumentasi, perlu disusun standar operasional prosedur sebagai pedoman kerja;")}
    ${butir("", "b.", "bahwa berdasarkan pertimbangan sebagaimana dimaksud dalam huruf a, perlu menetapkan Keputusan Sekretaris Daerah tentang Standar Operasional Prosedur Bagian Protokol dan Komunikasi Pimpinan Sekretariat Daerah Kota Tarakan;")}
    ${butir("Mengingat", "1.", "Undang-Undang Nomor 9 Tahun 2010 tentang Keprotokolan;")}
    ${butir("", "2.", "Peraturan Pemerintah Nomor 39 Tahun 2018 tentang Pelaksanaan Undang-Undang Nomor 9 Tahun 2010 tentang Keprotokolan sebagaimana telah diubah dengan Peraturan Pemerintah Nomor 56 Tahun 2019;")}
    ${butir("", "3.", "Peraturan Menteri Pendayagunaan Aparatur Negara dan Reformasi Birokrasi Nomor 35 Tahun 2012 tentang Pedoman Penyusunan Standar Operasional Prosedur Administrasi Pemerintahan;")}
    ${butir("", "4.", "Peraturan Wali Kota Tarakan Nomor 50 Tahun 2021 tentang Kedudukan, Susunan Organisasi, Tugas dan Fungsi serta Tata Kerja Sekretariat Daerah;")}
  </table>
  <p class="tengah"><b>MEMUTUSKAN:</b></p>
  <table class="pasal">
    ${baris3("Menetapkan", "KEPUTUSAN SEKRETARIS DAERAH TENTANG STANDAR OPERASIONAL PROSEDUR BAGIAN PROTOKOL DAN KOMUNIKASI PIMPINAN SEKRETARIAT DAERAH KOTA TARAKAN.")}
    ${baris3("KESATU", "Menetapkan Standar Operasional Prosedur Bagian Protokol dan Komunikasi Pimpinan Sekretariat Daerah Kota Tarakan sebagaimana tercantum dalam Lampiran yang merupakan bagian tidak terpisahkan dari Keputusan ini.")}
    ${baris3("KEDUA", "Standar Operasional Prosedur sebagaimana dimaksud dalam Diktum KESATU menjadi pedoman bagi pejabat dan pelaksana di lingkungan Bagian Protokol dan Komunikasi Pimpinan dalam melaksanakan tugas.")}
    ${baris3("KETIGA", "Standar Operasional Prosedur sebagaimana dimaksud dalam Diktum KESATU dievaluasi paling sedikit 1 (satu) kali dalam 1 (satu) tahun.")}
    ${baris3("KEEMPAT", "Keputusan ini mulai berlaku pada tanggal ditetapkan.")}
  </table>
  <div class="ttd-blok">
    Ditetapkan di Tarakan<br>pada tanggal ................................<br>
    <b>${PENGESAH.jabatan},</b><div class="ruang"></div>
    <b><u>${PENGESAH.nama}</u></b><br>${PENGESAH.pangkat}<br>${PENGESAH.nip}
  </div>
</section>`;

// Daftar isi — nomor halaman diisi pada lintasan kedua.
const DAFTAR = [
  ["Keputusan Penetapan Standar Operasional Prosedur", "KEPUTUSAN SEKRETARIS DAERAH KOTA TARAKAN"],
  ["Penjelasan Singkat Penggunaan", judulBerkas[berkas[0]] || "Standar Operasional Prosedur"],
  ...berkas.slice(1).map(f => [judulBerkas[f], judulBerkas[f]]),
];
const daftarIsi = (hal) => `
<section class="naskah">
  <h1>DAFTAR ISI</h1>
  <table class="isi" style="margin-top:12pt"><tbody>
    ${DAFTAR.map(([t], k) => `<tr><td>${lolos(t)}</td><td class="hal">${hal[k] ?? ""}</td></tr>`).join("")}
  </tbody></table>
</section>`;

const rakit = (hal) => `<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>SOP Bagian Prokopim Setda Kota Tarakan</title>
<style>${GAYA}</style></head><body>${SAMPUL}${KEPUTUSAN}${daftarIsi(hal)}${bagian}</body></html>`;

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
async function cetak(hal) {
  await halaman.setContent(rakit(hal), { waitUntil: "load" });
  await halaman.pdf({
    path: TUJUAN,
    format: "A4",
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,   // hormati @page agar sampul & naskah tetap tegak
    displayHeaderFooter: true,
    headerTemplate: `<div></div>`,
    footerTemplate:
      `<div style="width:100%;font-family:Arial,sans-serif;font-size:7pt;color:#64748B;
        padding:0 12mm;display:flex;justify-content:space-between;">
         <span>SOP Bagian Prokopim — Setda Kota Tarakan</span>
         <span>Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></span>
       </div>`,
  });
}

// Lintasan pertama tanpa nomor, lalu cari halaman tiap judul di PDF-nya.
// Nomor halaman tidak menggeser tata letak: daftar isi selalu satu halaman.
await cetak([]);
const cari = execFileSync("python3", ["-c", `
import sys, json, pymupdf
d = pymupdf.open(sys.argv[1])
teks = [" ".join(p.get_text().split()) for p in d]
out = []
for j in json.loads(sys.argv[2]):
    k = next((i + 1 for i, t in enumerate(teks) if t.startswith(j) or (" " + j) in t[:400]), None)
    out.append(k)
print(json.dumps(out))
`, TUJUAN, JSON.stringify(DAFTAR.map(d => d[1].replace(/\*\*/g, "")))], { encoding: "utf8" });
const hal = JSON.parse(cari);
await cetak(hal);
await peramban.close();

const hilang = DAFTAR.filter((_, k) => !hal[k]).map(d => d[0]);
if (hilang.length) console.warn("Halaman tidak ditemukan untuk:", hilang.join("; "));
console.log(`PDF tersimpan: ${TUJUAN}`);
console.log(`Berkas sumber: ${berkas.length} lembar SOP`);
