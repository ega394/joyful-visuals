/**
 * src/lib/undanganPdf.js — PDF undangan Wali Kota berteks asli.
 *
 * Dulu PDF dibuat lewat dialog cetak peramban ("Simpan sebagai PDF"). Cara itu
 * tidak andal di PWA dan di HP — terutama iPhone — dan tidak menghasilkan
 * berkas yang bisa langsung diunduh atau dibagikan. Sekarang PDF dibangun di
 * peramban dengan pdfmake:
 *
 *   - TEKS ASLI, bukan gambar. Srikandi mengisi variabel ${nomor_naskah},
 *     ${tanggal_naskah}, ${sifat}, dan ${ttd_pengirim} dengan mencari teksnya
 *     di dalam PDF; PDF berupa gambar tidak bisa diisi.
 *   - ARIAL TERTANAM. Font dibawa aplikasi sendiri (src/assets/fonts, dipangkas
 *     ke huruf Latin), jadi hasilnya sama di Windows, Android, maupun iPhone —
 *     tidak lagi bergantung pada font yang terpasang di perangkat.
 *
 * Ukuran mengikuti templat HTML sebelumnya: A4, margin 20/20/20/25 mm,
 * Arial 11 pt (keterangan 10 pt), kop Garuda + "WALI KOTA TARAKAN" 20 pt.
 *
 * pdfmake (±1 MB) dan font dimuat hanya saat PDF pertama kali dibuat.
 */

import urlRegular from "../assets/fonts/arial-regular.ttf?url";
import urlBold from "../assets/fonts/arial-bold.ttf?url";
import urlItalic from "../assets/fonts/arial-italic.ttf?url";
import urlBoldItalic from "../assets/fonts/arial-bolditalic.ttf?url";

const MM = 72 / 25.4;
// CSS memakai line-height 1.5; tinggi baris bawaan Arial di pdfmake ±1,15 em.
const SPASI = 1.5 / 1.15;

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function formatTanggalIndo(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

export function teksPukul(form) {
  if (!form.waktuMulai) return "";
  const mulai = form.waktuMulai.replace(/:/g, ".");
  const tz = form.zonaWaktu || "Wita";
  return form.waktuSelesai
    ? `${mulai} - ${form.waktuSelesai.replace(/:/g, ".")} ${tz}`
    : `${mulai} ${tz} s.d. selesai`;
}

/** Sesi peminjaman ruangan dari jam acara; tanpa jam selesai dianggap 2 jam. */
export function sesiDariJam(mulai, selesai) {
  const m = (t) => { const x = /^(\d{1,2}):(\d{2})/.exec(t || ""); return x ? +x[1] * 60 + +x[2] : null; };
  const a = m(mulai);
  if (a === null) return "";
  const b = m(selesai) ?? a + 120;
  if (b <= 12 * 60) return "Pagi";
  if (a >= 12 * 60) return "Siang";
  return "Full_Day";
}

// ── Pemuatan malas ──────────────────────────────────────────────
let _pdfMake = null;
const keBase64 = (buf) => {
  let s = "";
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
};

async function siapkanPdfMake() {
  if (_pdfMake) return _pdfMake;
  const mod = await import("pdfmake/build/pdfmake");
  const pdfMake = mod.default || mod;
  const [r, b, i, bi] = await Promise.all(
    [urlRegular, urlBold, urlItalic, urlBoldItalic].map(async (u) => keBase64(await (await fetch(u)).arrayBuffer()))
  );
  pdfMake.vfs = { "arial.ttf": r, "arialbd.ttf": b, "ariali.ttf": i, "arialbi.ttf": bi };
  pdfMake.fonts = { Arial: { normal: "arial.ttf", bold: "arialbd.ttf", italics: "ariali.ttf", bolditalics: "arialbi.ttf" } };
  _pdfMake = pdfMake;
  return pdfMake;
}

const _gambar = {};
async function gambar(url) {
  if (url in _gambar) return _gambar[url];
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    const blob = await r.blob();
    _gambar[url] = await new Promise((ok, gagal) => {
      const fr = new FileReader();
      fr.onload = () => ok(fr.result);
      fr.onerror = gagal;
      fr.readAsDataURL(blob);
    });
  } catch {
    _gambar[url] = null;   // gambar tidak ada → bagian itu dilewati, PDF tetap jadi
  }
  return _gambar[url];
}

// ── Susunan dokumen ─────────────────────────────────────────────
const barisInfo = (label, isi, lebarLabel) => [
  { text: label, width: lebarLabel },
  { text: ":", width: 15, alignment: "center" },
  typeof isi === "object" ? isi : { text: isi },
];

const tabelInfo = (baris, lebarLabel, marginBawah) => ({
  table: { widths: [lebarLabel, 15, "*"], body: baris.map(([l, isi]) => barisInfo(l, isi, lebarLabel)) },
  layout: { defaultBorder: false, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 1.5, paddingBottom: () => 1.5 },
  margin: [0, 0, 0, marginBawah],
});

// Ruang tanda tangan disamakan dengan QR TTE pada surat Sekda ber-TTE yang
// terukur (500.10.30.2/1122/SETDA/2026): QR 2,7 x 2,7 cm, menggantikan
// variabel ${ttd_pengirim} dan mengalir ke bawah, nama tepat di bawahnya.
// Variabel ditaruh di sudut kiri atas kotak 2,7 cm di tengah kolom tanda
// tangan; ruang di bawahnya ±2,8 cm.
const KOTAK_QR = 27 * MM;
const RUANG_TTD = 28 * MM;

function areaTtd(form, img, marginAtas) {
  const LEBAR = 187;   // 250 px
  let tengah;
  if (form.jenisTtd === "tte") {
    tengah = {
      columns: [
        { width: "*", text: "" },
        { width: KOTAK_QR, text: "${ttd_pengirim}", noWrap: true, fontSize: 9.5, bold: true, color: "#0056b3", background: "#e9ecef" },
        { width: "*", text: "" },
      ],
      margin: [0, 2, 0, RUANG_TTD - 14],
    };
  } else if (form.jenisTtd === "scan" && img.gabungan) {
    // Stempel dan tanda tangan sudah digabung menjadi satu gambar (gabungTtd),
    // sedikit menimpa baris jabatan seperti cap basah pada umumnya.
    tengah = { image: img.gabungan, fit: [LEBAR, RUANG_TTD + 18], alignment: "center", margin: [0, -10, 0, 0] };
  } else {
    tengah = { text: " ", margin: [0, 0, 0, RUANG_TTD - 13] };
  }
  return {
    columns: [
      { width: "*", text: "" },
      {
        width: LEBAR,
        stack: [
          { text: "WALI KOTA TARAKAN", alignment: "center" },
          tengah,
          { text: "dr. H. KHAIRUL, M.Kes.", bold: true, alignment: "center" },
        ],
      },
    ],
    margin: [0, marginAtas, 0, 0],
  };
}

/**
 * Stempel + tanda tangan pindaian disusun menjadi SATU gambar, meniru templat
 * lama: kolom 250 px, stempel 145 px di kiri, tanda tangan setinggi 140 px di
 * kanan, keduanya "multiply" sehingga cap menimpa goresan seperti aslinya.
 * pdfmake menumpuk gambar berurutan ke bawah dan tidak bisa menindih, itu
 * sebabnya keduanya dulu berhamburan.
 */
async function gabungTtd(stempel, ttd) {
  if (!stempel && !ttd) return null;
  const muat = (src) => new Promise((ok) => {
    if (!src) return ok(null);
    const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src;
  });
  const [s, t] = await Promise.all([muat(stempel), muat(ttd)]);
  const SK = 3, W = 250, H = 150;
  const c = document.createElement("canvas");
  c.width = W * SK; c.height = H * SK;
  const x = c.getContext("2d");
  x.scale(SK, SK);
  x.fillStyle = "white"; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "multiply";
  if (t) { const h = 140, w = h * t.width / t.height; x.drawImage(t, W - w, 5, w, h); }
  if (s) { const w = 145, h = w * s.height / s.width; x.drawImage(s, 0, 2, w, h); }
  // Latar putih dijadikan transparan supaya cap boleh menimpa baris jabatan
  // tanpa menutupi tulisannya — seperti stempel basah di atas kertas.
  const data = x.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const terang = Math.min(px[i], px[i + 1], px[i + 2]);
    if (terang > 235) px[i + 3] = 0;
    else if (terang > 200) px[i + 3] = Math.round(255 * (235 - terang) / 35);
  }
  x.putImageData(data, 0, 0);
  return c.toDataURL("image/png");
}

/**
 * Teks berbaris yang dapat berupa daftar bernomor ("1. …", "10. …").
 *
 * Ditulis apa adanya, "10." lebih lebar daripada "9." sehingga teks setelah
 * nomor bergeser mulai butir kesepuluh. Karena itu baris bernomor disusun dua
 * kolom: kolom nomor selebar nomor terpanjang, lalu kolom teks — teks selalu
 * rata, termasuk baris lanjutan yang terbungkus. Baris tanpa nomor sesudah
 * sebuah butir dianggap lanjutan butir itu dan ikut menjorok.
 */
const POLA_NOMOR = /^\s*(\d{1,3}[.)])\s+(.*)$/;
function teksDaftar(teks, gaya = {}) {
  const baris = String(teks ?? "").split("\n");
  const nomor = baris.map((b) => POLA_NOMOR.exec(b));
  if (!nomor.some(Boolean)) return { text: teks, preserveLeadingSpaces: true, ...gaya };
  const uk = gaya.fontSize || 11;
  const digit = Math.max(...nomor.filter(Boolean).map((m) => m[1].length - 1));
  // Lebar huruf Arial: angka 0,556 em; titik/kurung ±0,33 em; ditambah jarak.
  const lebar = (digit * 0.556 + 0.333 + 0.5) * uk;
  let sudahBernomor = false;
  const isi = baris.map((b, i) => {
    const m = nomor[i];
    if (m) {
      sudahBernomor = true;
      return { columns: [{ width: lebar, text: m[1] }, { width: "*", text: m[2] || " " }], columnGap: 0 };
    }
    return { text: b.trim() ? b : " ", preserveLeadingSpaces: true, margin: [sudahBernomor ? lebar : 0, 0, 0, 0] };
  });
  return { stack: isi, ...gaya };
}

function keterangan(form) {
  const item = (judul, isi) => ({
    stack: [{ text: judul, bold: true, decoration: "underline" }, teksDaftar(isi, { fontSize: 10 })],
    margin: [0, 0, 0, 4.5],
  });
  const isi = [];
  if (form.showTembusan) isi.push(item("Tembusan:", form.tembusan));
  if (form.showNarahubung) isi.push(item("Narahubung:", form.narahubung));
  if (form.showPakaian) isi.push(item("Pakaian:", form.pakaian));
  if ((form.catatan || "").trim()) isi.push(item("Catatan:", form.catatan));
  return isi.length ? { stack: isi, fontSize: 10, margin: [0, 19, 0, 0] } : null;
}

export async function buatDokumenUndangan(form) {
  const asal = window.location.origin;
  const [garuda, stempel, ttd] = await Promise.all([
    gambar(`${asal}/image001.jpg`),
    form.jenisTtd === "scan" ? gambar(`${asal}/stempel.png`) : null,
    form.jenisTtd === "scan" ? gambar(`${asal}/image.jpeg`) : null,
  ]);
  const img = { gabungan: form.jenisTtd === "scan" ? await gabungTtd(stempel, ttd) : null };

  const utama = [
    {
      stack: [
        garuda ? { image: garuda, width: 66, alignment: "center", margin: [0, 0, 0, 4] } : { text: "" },
        { text: "WALI KOTA TARAKAN", fontSize: 20, bold: true, alignment: "center", characterSpacing: 0.4 },
      ],
      margin: [0, 0, 0, 19],
    },
    { text: form.tanggalSurat, alignment: "right", margin: [0, 0, 0, 11] },
    tabelInfo([
      ["Nomor", form.nomor],
      ["Sifat", form.sifat],
      ["Lampiran", form.lampiranCount],
      ["Hal", { text: "Undangan", bold: true, decoration: "underline" }],
    ], 70, 11),
    {
      stack: [
        "Yth:",
        teksDaftar(form.yth, { bold: true }),
        "di-",
        { text: "TARAKAN", bold: true },
      ],
      margin: [0, 0, 0, 11],
    },
    { text: "Mengharapkan dengan hormat kehadiran Bapak/Ibu/Saudara (i) pada:", alignment: "justify", leadingIndent: 36.75, margin: [0, 7.5, 0, 4] },
    tabelInfo([
      ["hari/tanggal", formatTanggalIndo(form.tanggalAcaraInput)],
      ["pukul", teksPukul(form)],
      ["tempat", form.tempat],
      ["acara", teksDaftar(form.acara, { bold: true })],
    ], 113, 7.5),
    { text: "Demikian, atas perhatian serta kehadirannya diucapkan terima kasih.", alignment: "justify", leadingIndent: 36.75, margin: [0, 7.5, 0, 4] },
    areaTtd(form, img, 11),
    keterangan(form),
  ].filter(Boolean);

  const lampiran = form.pilihanCetak === "utama" ? [] : [
    { text: "LAMPIRAN SURAT", pageBreak: "before", margin: [0, 0, 0, 11] },
    tabelInfo([["Nomor", form.nomor]], 70, 19),
    { text: form.judulLampiran, bold: true, decoration: "underline", alignment: "center", margin: [0, 0, 0, 15] },
    teksDaftar(form.lampiran, { lineHeight: (Number(form.spasiLampiran) || 1.5) / 1.15, margin: [0, 0, 0, 15] }),
    areaTtd(form, img, 22),
  ];

  return {
    pageSize: "A4",
    // Margin bawah memberi ruang alamat kaki surat, yang dulu berada 20 mm
    // dari tepi bawah halaman pertama.
    pageMargins: [25 * MM, 20 * MM, 20 * MM, 20 * MM + 30],
    defaultStyle: { font: "Arial", fontSize: 11, lineHeight: SPASI },
    info: { title: namaBerkasUndangan(form).replace(/\.pdf$/, ""), creator: "Prokopim Hibot" },
    footer: (hal) => hal !== 1 ? null : {
      text: "Jalan Kalimantan No. 1, Kota Tarakan\nTelp. (0551) 21620, 34320 Fax. (0551) 23782",
      alignment: "center", fontSize: 10, lineHeight: 1.1, margin: [0, 4, 0, 0],
    },
    content: [...utama, ...lampiran],
  };
}

export function namaBerkasUndangan(form) {
  // Nomor yang masih variabel Srikandi (${nomor_naskah}) belum bernomor → "Draft".
  const mentah = String(form.nomor || "").trim();
  const nomor = /^\$\{.*\}$/.test(mentah) ? "" : mentah.replace(/[\/\\]/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
  const ttd = form.jenisTtd === "tte" ? "_TTE" : form.jenisTtd === "scan" ? "_Scan" : "";
  const awal = form.pilihanCetak === "utama" ? "Undangan_Utama" : "Undangan";
  return `${awal}${ttd}_${nomor || "Draft"}.pdf`;
}

/** Blob PDF undangan. */
export async function buatPdfUndangan(form) {
  const [pdfMake, dok] = await Promise.all([siapkanPdfMake(), buatDokumenUndangan(form)]);
  return new Promise((ok, gagal) => {
    try { pdfMake.createPdf(dok).getBlob(ok); } catch (e) { gagal(e); }
  });
}
