/**
 * UndanganGenerator.jsx — Prokopim Hibot v2.0
 * FIXED: Forced Box-Shadow Removal using !important
 */

import React, { useState, useRef } from "react";

// ── CSS Kertas & Dokumen ──
const CSS_ASLI = `
  /* Arial adalah font baku tata naskah dinas. Bila mesin tidak memilikinya,
     rantai berikut jatuh ke font yang metriknya PERSIS sama dengan Arial —
     Liberation Sans (umum di Linux) dan Arimo — sehingga lebar huruf,
     pemenggalan baris, dan jumlah halaman tetap sama di komputer mana pun.
     Tanpa ini, fallback bisa mendarat di DejaVu Sans yang 12,8% lebih lebar
     dan menggeser tata letak surat. */
  #dokumen-cetak, #dokumen-cetak * {
    font-family: Arial, "Liberation Sans", Arimo, "Helvetica Neue", Helvetica, sans-serif !important;
  }
  #dokumen-cetak { background: white !important; width: 210mm !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
  
  /* FIX UTAMA: Paksa hilangkan bayangan dan margin dengan !important agar kebal dari CSS Global */
  .halaman-a4 { 
    width: 210mm !important; 
    min-height: 297mm !important; 
    background: white !important; 
    padding: 20mm 20mm 20mm 25mm !important; 
    box-sizing: border-box !important; 
    font-size: 11pt !important; 
    color: black !important; 
    line-height: 1.5 !important; 
    position: relative !important; 
    box-shadow: none !important; /* ⬅️ BUNUH BAYANGAN */
    border: none !important; 
    margin: 0 !important;        /* ⬅️ BUNUH JARAK ANTAR HALAMAN */
    outline: none !important;
  }
  
  .kop { text-align: center; margin-bottom: 25px; }
  .kop img { width: 88px; margin-bottom: 5px; }
  .kop-teks { font-size: 20pt; font-weight: bold; margin-top: 5px; letter-spacing: 0.5px; }
  .tanggal-kanan { text-align: right; margin-bottom: 15px; font-style: normal; }
  .tabel-info { border-collapse: collapse; width: 100%; margin-bottom: 15px; }
  .tabel-info td { vertical-align: top; padding: 2px 0; }
  .col-label { width: 70pt; }
  .col-titikdua { width: 15pt; text-align: center; }
  .tujuan-surat { margin-bottom: 15px; line-height: 1.5; }
  .paragraf-indent { text-align: justify; text-indent: 36.75pt; margin-bottom: 5px; margin-top: 10px; }
  .tabel-acara { border-collapse: collapse; width: 100%; margin-bottom: 10px; }
  .tabel-acara td { vertical-align: top; padding: 2px 0; }
  .col-label-acara { width: 113pt; }
  .area-ttd { float: right; width: 250px; text-align: center; margin-top: 15px; position: relative; }
  
  .area-keterangan { clear: both; margin-top: 25px; line-height: 1.5; font-size: 10pt !important; }
  .area-keterangan * { font-size: 10pt !important; }
  .ket-item { margin-bottom: 6px; }
  
  .footer-alamat { position: absolute; bottom: 20mm; left: 0; right: 0; text-align: center; font-size: 10pt; line-height: 1.3; }
  .teks-multibaris { white-space: pre-wrap; }
  .page-break { page-break-before: always; }
  /* Setiap lembar A4 memulai halaman cetak baru. */
  .pecah-halaman { page-break-before: always; break-before: page; }
  /* Penanda TTE ikut Arial seperti seluruh isi surat. Aturan monospace yang
     dulu ada di sini tidak pernah berlaku — kalah spesifisitas dari selektor
     #dokumen-cetak *, jadi dihapus agar tidak menyesatkan. */
  .tte-marker { color: #0056b3; background: #e9ecef; padding: 2px 5px; border-radius: 3px; font-weight: bold; }
`;

const formatTanggalIndo = (dateStr) => {
  if (!dateStr) return "";
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const NAVY = "#0A1628";
const GOLD = "#C9A84C";

// ── Konsep undangan ──────────────────────────────────────────
// Disimpan di perangkat masing-masing (localStorage), bukan di basis data.
// Konsep adalah bahan kerja pribadi yang belum tentu jadi surat; menaruhnya
// di Supabase menambah tabel dan egress tanpa manfaat yang sepadan.
// Konsekuensinya: konsep tidak ikut berpindah antar komputer.
const KEY_KONSEP  = "prokopim_konsep_undangan";
const MAKS_KONSEP = 20;

function bacaKonsep() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY_KONSEP) || "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function tulisKonsep(list) {
  try {
    localStorage.setItem(KEY_KONSEP, JSON.stringify(list.slice(0, MAKS_KONSEP)));
    return true;
  } catch { return false; }   // kuota penyimpanan penuh atau mode privat
}

const fmtWaktuSimpan = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) +
           " · " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch { return ""; }
};

const inputSt = { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 13, color: NAVY, background: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const textareaSt = Object.assign({}, inputSt, { resize: "vertical", lineHeight: 1.55, minHeight: 72 });

const Label = ({ text, required, hint }) => (
  <div style={{ marginBottom: 5 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 4 }}>
      {text}{required && <span style={{ color: "#DC2626", fontSize: 10 }}>*</span>}
    </div>
    {hint && <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 1 }}>{hint}</div>}
  </div>
);

const SectionBtn = ({ isActive, onClick, icon, title, subtitle }) => (
  <button onClick={onClick} style={{ width: "100%", background: isActive ? NAVY : "#F8FAFC", border: "1.5px solid " + (isActive ? NAVY : "#E2E8F0"), borderRadius: 10, padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, marginBottom: 2, textAlign: "left" }}>
    <span style={{ fontSize: 18 }}>{icon}</span>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? "white" : NAVY }}>{title}</div>
      <div style={{ fontSize: 11, color: isActive ? "rgba(255,255,255,0.65)" : "#94A3B8", marginTop: 1 }}>{subtitle}</div>
    </div>
    <span style={{ fontSize: 12, color: isActive ? "white" : "#94A3B8" }}>{isActive ? "▲" : "▼"}</span>
  </button>
);

const SectionBody = ({ isActive, children }) => isActive ? <div style={{ background: "white", border: "1.5px solid #E2E8F0", borderRadius: 10, padding: "16px", marginBottom: 10 }}>{children}</div> : null;

const CheckboxToggle = ({ checked, onChange, label }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
    <input type="checkbox" checked={checked} onChange={onChange} style={{ width: 16, height: 16, cursor: 'pointer' }} />
    <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>Sertakan {label}</span>
  </label>
);

export default function UndanganGenerator({ isMobile, showT }) {
  const EMPTY = {
    pilihanCetak:  "semua",
    tanggalSurat:  "Tarakan, ${tanggal_naskah}",
    nomor:         "${nomor_naskah}",
    sifat:         "${sifat}",
    lampiranCount: "1 (satu) halaman",
    yth:           "(daftar terlampir)",
    tanggalAcaraInput: "",
    waktuMulai:    "08:00",
    waktuSelesai:  "",
    zonaWaktu:     "Wita", // default Wita, opsional WIB / WIT
    tempat:        "",
    acara:         "1. ...;\n2. ...; dan\n3. Hal-hal lain yang dianggap perlu.",
    
    showTembusan:  false,
    tembusan:      "1. Yth. Bapak Wali Kota Tarakan (sebagai laporan);\n2. Arsip.",
    showNarahubung: true,
    narahubung:    "Kasubbag Protokol (0811-5961-116)",
    showPakaian:   true,
    pakaian:       "PDH Batik Daerah/Menyesuaikan",
    catatan:       "",
    
    jenisTtd:      "kosong",
    judulLampiran: "DAFTAR UNDANGAN",
    spasiLampiran: "1.5",
    lampiran:      "1. ...;\n2. ...;\n3. ...",
  };

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState("surat");

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const resetForm = () => {
    if (window.confirm("Reset semua kolom? Data yang belum disimpan akan hilang.")) setForm(EMPTY);
  };

  // ── Konsep ──
  const [konsep, setKonsep] = useState(bacaKonsep);

  // Nama bawaan diambil dari isi yang paling menandai surat, supaya konsep
  // mudah dikenali kembali tanpa pengguna harus mengarang nama.
  const namaBawaanKonsep = () => {
    // Buang penomoran, kata sambung, dan tanda baca penutup agar tersisa intinya.
    const bersihkan = (s) => String(s || "")
      .replace(/^\d+\.\s*/, "")
      .replace(/[;.]\s*(dan|atau)\s*$/i, "")
      .replace(/[;.]+$/, "")
      .trim();
    // Baris bawaan form ("1. ...;", "2. ...; dan", "3. Hal-hal lain...") bukan
    // isi sungguhan, jadi tidak boleh dipakai sebagai nama konsep.
    const bermakna = (s) => {
      const t = bersihkan(s);
      return t && !/^\.+$/.test(t) && !/^hal-hal lain/i.test(t) ? t : "";
    };
    const bukanToken = (s) => (s && !/^\$\{.*\}$/.test(s.trim()) ? s.trim() : "");

    const inti = (form.acara || "").split("\n").map(bermakna).find(Boolean)
      || bukanToken(form.tempat)
      || bukanToken(form.nomor)
      || "Konsep undangan";
    const tgl = form.tanggalAcaraInput ? " — " + form.tanggalAcaraInput : "";
    return (inti.length > 48 ? inti.slice(0, 48) + "…" : inti) + tgl;
  };

  const simpanKonsep = () => {
    const nama = (window.prompt("Simpan konsep dengan nama:", namaBawaanKonsep()) || "").trim();
    if (!nama) return;

    const lama = konsep.find(k => k.nama.toLowerCase() === nama.toLowerCase());
    if (lama && !window.confirm(`Konsep "${nama}" sudah ada. Timpa dengan isi sekarang?`)) return;

    const entri = { id: lama ? lama.id : String(Date.now()), nama, disimpan: new Date().toISOString(), data: { ...form } };
    const berikut = [entri, ...konsep.filter(k => k.id !== entri.id)];

    if (berikut.length > MAKS_KONSEP && !lama) {
      const dibuang = berikut[MAKS_KONSEP];
      if (!window.confirm(`Konsep tersimpan sudah ${MAKS_KONSEP}. Menyimpan yang baru akan membuang konsep terlama, "${dibuang.nama}". Lanjutkan?`)) return;
    }

    if (!tulisKonsep(berikut)) {
      if (showT) showT("Gagal menyimpan konsep — penyimpanan peramban penuh atau diblokir.", "error");
      return;
    }
    setKonsep(berikut.slice(0, MAKS_KONSEP));
    setSection("konsep");
    if (showT) showT(lama ? `Konsep "${nama}" diperbarui` : `Konsep "${nama}" tersimpan`, "ok");
  };

  const bukaKonsep = (k) => {
    // Digabung dengan EMPTY agar konsep lama yang belum punya kolom baru
    // tetap terbuka dengan nilai bawaan, bukan undefined.
    setForm({ ...EMPTY, ...(k.data || {}) });
    setSection("surat");
    if (showT) showT(`Konsep "${k.nama}" dibuka`, "ok");
  };

  const hapusKonsep = (k) => {
    if (!window.confirm(`Hapus konsep "${k.nama}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    const berikut = konsep.filter(x => x.id !== k.id);
    tulisKonsep(berikut);
    setKonsep(berikut);
    if (showT) showT("Konsep dihapus", "warn");
  };

  let tglText = formatTanggalIndo(form.tanggalAcaraInput);
  let pklText = "";
  if (form.waktuMulai) {
    let jamMulai = form.waktuMulai.replace(/:/g, ".");
    let tz = form.zonaWaktu || "Wita";
    if (form.waktuSelesai) {
      let jamSelesai = form.waktuSelesai.replace(/:/g, ".");
      pklText = `${jamMulai} - ${jamSelesai} ${tz}`;
    } else {
      pklText = `${jamMulai} ${tz} s.d. selesai`;
    }
  }

  const buildHTMLString = () => {
    let ttdPdf = "<br><br><br>";
    if (form.jenisTtd === "scan") {
      ttdPdf =
        `<img src="${window.location.origin}/stempel.png" style="position:absolute;left:0;top:-30px;width:145px;z-index:1;mix-blend-mode:multiply" onerror="this.style.display='none'">` +
        `<img src="${window.location.origin}/image.jpeg" style="position:absolute;right:0;top:-30px;height:140px;z-index:2;mix-blend-mode:multiply" alt="TTD">`;
    } else if (form.jenisTtd === "tte") {
      ttdPdf = `<br><br><span class="tte-marker">\${ttd_pengirim}</span><br><br>`;
    }

    let halamanLampiran = "";
    if (form.pilihanCetak !== "utama") {
      halamanLampiran = `
        <div class="halaman-a4 pecah-halaman">
          <div style="margin-bottom:15px;">LAMPIRAN SURAT</div>
          <table style="border-collapse:collapse;margin-bottom:25px;">
            <tr><td style="width:70pt;">Nomor</td><td style="width:15pt;">:</td><td>${form.nomor}</td></tr>
          </table>
          <div style="text-align:center;margin-bottom:20px;"><b><u>${form.judulLampiran}</u></b></div>
          <div class="teks-multibaris" style="line-height:${form.spasiLampiran};margin-bottom:20px;">${form.lampiran}</div>
          <div class="area-ttd" style="margin-top:30px;">
            WALI KOTA TARAKAN<br>
            <div style="min-height:80px;position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;">${ttdPdf}</div>
            <b>dr. H. KHAIRUL, M.Kes.</b>
          </div>
        </div>
      `;
    }

    let areaKeterangan = `
      <div class="area-keterangan">
        ${form.showTembusan ? `<div class="ket-item"><b><u>Tembusan:</u></b><br><span class="teks-multibaris">${form.tembusan}</span></div>` : ""}
        ${form.showNarahubung ? `<div class="ket-item"><b><u>Narahubung:</u></b><br><span class="teks-multibaris">${form.narahubung}</span></div>` : ""}
        ${form.showPakaian ? `<div class="ket-item"><b><u>Pakaian:</u></b><br><span class="teks-multibaris">${form.pakaian}</span></div>` : ""}
        ${form.catatan.trim() ? `<div class="ket-item"><b><u>catatan:</u></b><br><span class="teks-multibaris">${form.catatan}</span></div>` : ""}
      </div>
    `;

    return `
      <div id="dokumen-cetak">
        <div class="halaman-a4">
          <div class="kop">
            <img src="${window.location.origin}/image001.jpg" alt="Garuda" onerror="this.style.display='none'">
            <div class="kop-teks">WALI KOTA TARAKAN</div>
          </div>
          <div class="tanggal-kanan">${form.tanggalSurat}</div>
          <table class="tabel-info">
            <tr><td class="col-label">Nomor</td><td class="col-titikdua">:</td><td>${form.nomor}</td></tr>
            <tr><td class="col-label">Sifat</td><td class="col-titikdua">:</td><td>${form.sifat}</td></tr>
            <tr><td class="col-label">Lampiran</td><td class="col-titikdua">:</td><td>${form.lampiranCount}</td></tr>
            <tr><td class="col-label">Hal</td><td class="col-titikdua">:</td><td><b><u>Undangan</u></b></td></tr>
          </table>
          <div class="tujuan-surat">Yth:<br><b><span class="teks-multibaris">${form.yth}</span></b><br>di-<br><b>TARAKAN</b></div>
          <div class="paragraf-indent">Mengharapkan dengan hormat kehadiran Bapak/Ibu/Saudara (i) pada:</div>
          <table class="tabel-acara">
            <tr><td class="col-label-acara">hari/tanggal</td><td class="col-titikdua">:</td><td>${tglText}</td></tr>
            <tr><td class="col-label-acara">pukul</td><td class="col-titikdua">:</td><td>${pklText}</td></tr>
            <tr><td class="col-label-acara">tempat</td><td class="col-titikdua">:</td><td>${form.tempat}</td></tr>
            <tr><td class="col-label-acara">acara</td><td class="col-titikdua">:</td><td><b><div class="teks-multibaris">${form.acara}</div></b></td></tr>
          </table>
          <div class="paragraf-indent">Demikian, atas perhatian serta kehadirannya diucapkan terima kasih.</div>
          <div class="area-ttd">
            WALI KOTA TARAKAN<br>
            <div style="min-height:80px;position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;">${ttdPdf}</div>
            <b>dr. H. KHAIRUL, M.Kes.</b>
          </div>
          ${areaKeterangan}
          <div class="footer-alamat">Jalan Kalimantan No. 1, Kota Tarakan<br>Telp. (0551) 21620, 34320 Fax. (0551) 23782</div>
        </div>
        ${halamanLampiran}
      </div>
    `;
  };

  // ── Satu sumber dokumen untuk pratinjau, cetak, dan PDF ──
  // Sebelumnya ketiganya memakai jalur render yang berbeda: pratinjau di
  // dalam iframe bersih, PDF di dalam dokumen aplikasi, cetak di iframe
  // berukuran 0×0. Wajar hasilnya tidak pernah sama. Sekarang ketiganya
  // membaca dokumen yang sama persis.
  const buildDocHTML = (extraCSS = "") => `<!DOCTYPE html>
<html lang="id">
  <head>
    <meta charset="utf-8">
    <title>Undangan Prokopim</title>
    <style>
      html, body { margin:0; padding:0; background:white; }
      @page { size: A4 portrait; margin: 0; }
      ${CSS_ASLI}
      ${extraCSS}
    </style>
  </head>
  <body>${buildHTMLString()}</body>
</html>`;

  // Iframe A4 di luar layar. WAJIB berukuran nyata — iframe 0×0 membuat
  // browser menghitung tata letak cetak pada viewport nol, dan marginnya
  // meleset dari template. Juga tidak boleh display:none atau opacity:0,
  // karena html2canvas hanya bisa memotret elemen yang benar-benar dirender.
  const siapkanFrameA4 = () => new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText =
      "position:fixed; left:-20000px; top:0; width:210mm; height:297mm; border:0; background:white;";

    let beres = false;
    const selesai = (fn, arg) => { if (!beres) { beres = true; clearTimeout(pengaman); fn(arg); } };
    const pengaman = setTimeout(
      () => selesai(reject, new Error("Dokumen cetak terlalu lama disiapkan.")), 15000);

    // Menempelkan iframe ke DOM memicu SATU event load untuk dokumen kosong
    // bawaan (about:blank) sebelum srcdoc termuat. Tanpa penjagaan ini,
    // prosesnya lanjut memakai dokumen kosong itu: teks sempat terparse tetapi
    // gambar kop Garuda belum termuat, sehingga hilang dari hasil cetak.
    frame.addEventListener("load", async () => {
      if (beres) return;
      const doc = frame.contentDocument;
      if (!doc || !doc.getElementById("dokumen-cetak")) return;   // masih about:blank
      try {
        // Tunggu seluruh gambar (kop Garuda, stempel, tanda tangan) benar-benar
        // termuat — kalau tidak, hasilnya tercetak tanpa gambar.
        await Promise.all(Array.from(doc.images).map(img =>
          img.complete ? Promise.resolve() : new Promise(r => {
            // Memakai addEventListener, bukan img.onload/onerror, supaya
            // penangan pada atribut onerror bawaan dokumen — yang
            // menyembunyikan gambar gagal muat — tidak ikut tertimpa.
            img.addEventListener("load",  r, { once: true });
            img.addEventListener("error", r, { once: true });
          })
        ));
        if (doc.fonts && doc.fonts.ready) { try { await doc.fonts.ready; } catch { /* abaikan */ } }
        await new Promise(r => setTimeout(r, 120));
        selesai(resolve, frame);
      } catch (e) { selesai(reject, e); }
    });

    document.body.appendChild(frame);
    frame.srcdoc = buildDocHTML();
  });

  const buangFrame = (frame) => {
    if (frame && document.body.contains(frame)) document.body.removeChild(frame);
  };

  // Nama dokumen dipakai sebagai judul halaman, karena browser memakai judul
  // itu sebagai nama berkas bawaan saat pengguna memilih "Simpan sebagai PDF".
  const namaDokumen = () => {
    const nomorSurat = form.nomor.replace(/[\/\\]/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
    const suffixTtd  = form.jenisTtd === "tte" ? "_TTE" : (form.jenisTtd === "scan" ? "_Scan" : "");
    const prefix     = form.pilihanCetak === "utama" ? "Undangan_Utama" : "Undangan";
    return `${prefix}${suffixTtd}_${nomorSurat || "Draft"}`;
  };

  // Satu jalur keluaran untuk cetak maupun simpan PDF: dialog cetak bawaan
  // browser. Inilah yang membuat hasilnya benar-benar WYSIWYG — mesin
  // paginasi yang menghitung halamannya sama persis dengan yang dipakai
  // printer, dan `@page { margin: 0 }` dihormati apa adanya.
  const bukaDialogCetak = async () => {
    if (!form.nomor.trim() || !form.tanggalAcaraInput || !form.tempat.trim()) {
      if (showT) showT("Isi minimal: Nomor Surat, Hari/Tanggal Acara, dan Tempat", "warn");
      return false;
    }
    setLoading(true);
    let frame = null;
    try {
      frame = await siapkanFrameA4();
      frame.contentDocument.title = namaDokumen();
      frame.contentWindow.focus();
      frame.contentWindow.print();
      // Dialog cetak menahan proses; frame dibuang setelah dialog ditutup.
      setTimeout(() => buangFrame(frame), 60000);
      return true;
    } catch (err) {
      if (showT) showT("Gagal menyiapkan dokumen: " + err.message, "error");
      buangFrame(frame);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    const ok = await bukaDialogCetak();
    if (ok && showT) showT('Pada dialog cetak, pilih tujuan "Simpan sebagai PDF"', "warn");
  };

  const cetakLangsung = () => bukaDialogCetak();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ".ug-input:focus{border-color:"+NAVY+"!important;box-shadow:0 0 0 3px rgba(10,22,40,0.08)} .ug-input::placeholder{color:#CBD5E1} @keyframes spin{to{transform:rotate(360deg)}}" }} />

      <div style={{ display: "flex", height: isMobile ? "auto" : "calc(100vh - 60px)", overflow: "hidden", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

        <div style={{ flex: "0 0 400px", background: "#F8FAFC", overflowY: "auto", display: "flex", flexDirection: "column", borderRight: "1px solid #E2E8F0" }}>
          
          <div style={{ background: "linear-gradient(135deg," + NAVY + ",#1A2F50)", padding: "20px 20px 16px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>📄</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "white" }}>Generator Undangan</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Wali Kota Tarakan · Format Resmi</div>
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Pilihan Cetak PDF</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["semua","Utama + Lampiran"],["utama","Hanya Utama"]].map(item => (
                  <button key={item[0]} onClick={() => setForm(p => ({...p, pilihanCetak: item[0]}))}
                    style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: form.pilihanCetak === item[0] ? GOLD : "rgba(255,255,255,0.15)", color: form.pilihanCetak === item[0] ? NAVY : "white", fontSize: 11, fontWeight: 700 }}>
                    {item[1]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, padding: "14px 14px 0", overflowY: "auto" }}>
            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 9, padding: "10px 12px", marginBottom: 12, display: "flex", gap: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>ℹ️</span>
              <div style={{ fontSize: 11, color: "#1D4ED8", lineHeight: 1.6 }}>Kolom bertanda <span style={{ color: "#DC2626", fontWeight: 700 }}>*</span> wajib diisi sebelum mengunduh.</div>
            </div>

            <SectionBtn isActive={section === "konsep"} onClick={() => setSection(s => s === "konsep" ? "" : "konsep")} icon="💾" title="Konsep Tersimpan"
              subtitle={konsep.length ? `${konsep.length} konsep · tersimpan di perangkat ini` : "Belum ada konsep tersimpan"}/>
            <SectionBody isActive={section === "konsep"}>
              {konsep.length === 0
                ? <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.6 }}>
                    Belum ada konsep. Isi undangannya lebih dulu, lalu tekan <b style={{ color: "#475569" }}>Simpan Konsep</b> di bawah untuk menyimpannya dan melanjutkan lain waktu.
                  </div>
                : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {konsep.map(k => (
                      <div key={k.id} style={{ border: "1.5px solid #E2E8F0", borderRadius: 9, padding: "9px 11px", background: "#F8FAFC" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, overflowWrap: "anywhere" }}>{k.nama}</div>
                        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{fmtWaktuSimpan(k.disimpan)}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <button onClick={() => bukaKonsep(k)}
                            style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: "none", background: NAVY, color: "white", cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>
                            Buka
                          </button>
                          <button onClick={() => hapusKonsep(k)}
                            style={{ padding: "6px 12px", borderRadius: 7, border: "1.5px solid #FCA5A5", background: "white", color: "#DC2626", cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.5, marginTop: 2 }}>
                      Konsep tersimpan di peramban komputer ini saja — tidak ikut berpindah ke perangkat lain.
                    </div>
                  </div>}
            </SectionBody>

            <SectionBtn isActive={section === "surat"} onClick={() => setSection(s => s === "surat" ? "" : "surat")} icon="🗂" title="Data Surat" subtitle="Nomor, tanggal, sifat, lampiran"/>
            <SectionBody isActive={section === "surat"}>
              <div style={{ marginBottom: 12 }}><Label text="Tempat, Tanggal Surat"/><input className="ug-input" style={inputSt} value={form.tanggalSurat} onChange={set("tanggalSurat")}/></div>
              <div style={{ marginBottom: 12 }}><Label text="Nomor Surat" required /><input className="ug-input" style={inputSt} value={form.nomor} onChange={set("nomor")}/></div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}><Label text="Sifat"/><input className="ug-input" style={inputSt} value={form.sifat} onChange={set("sifat")}/></div>
                <div style={{ flex: 1 }}><Label text="Lampiran"/><input className="ug-input" style={inputSt} value={form.lampiranCount} onChange={set("lampiranCount")}/></div>
              </div>
              <div style={{ marginBottom: 4 }}><Label text="Yth (Tujuan Surat)" hint="Tulis per baris."/><textarea className="ug-input" style={{...textareaSt, minHeight:56}} value={form.yth} onChange={set("yth")}/></div>
            </SectionBody>

            <SectionBtn isActive={section === "acara"} onClick={() => setSection(s => s === "acara" ? "" : "acara")} icon="📋" title="Data Acara" subtitle="Kalender, waktu, dan susunan kegiatan"/>
            <SectionBody isActive={section === "acara"}>
              <div style={{ marginBottom: 12 }}><Label text="Hari/Tanggal Acara" required hint="Pilih dari kalender"/><input type="date" className="ug-input" style={inputSt} value={form.tanggalAcaraInput} onChange={set("tanggalAcaraInput")}/></div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 130px" }}><Label text="Pukul Mulai" required /><input type="time" className="ug-input" style={inputSt} value={form.waktuMulai} onChange={set("waktuMulai")}/></div>
                <div style={{ flex: "1 1 130px" }}><Label text="Pukul Selesai" hint="Kosong = s.d. selesai"/><input type="time" className="ug-input" style={inputSt} value={form.waktuSelesai} onChange={set("waktuSelesai")}/></div>
                <div style={{ flex: "0 0 110px" }}>
                  <Label text="Zona Waktu" hint="Default: Wita"/>
                  <select className="ug-input" style={inputSt} value={form.zonaWaktu || "Wita"} onChange={set("zonaWaktu")}>
                    <option value="Wita">Wita</option>
                    <option value="WIB">WIB</option>
                    <option value="WIT">WIT</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}><Label text="Tempat Acara" required/><input className="ug-input" style={inputSt} value={form.tempat} onChange={set("tempat")}/></div>
              <div style={{ marginBottom: 4 }}><Label text="Nama / Susunan Acara"/><textarea className="ug-input" style={{...textareaSt, minHeight:90}} value={form.acara} onChange={set("acara")}/></div>
            </SectionBody>

            <SectionBtn isActive={section === "keterangan"} onClick={() => setSection(s => s === "keterangan" ? "" : "keterangan")} icon="📌" title="Keterangan & Tembusan" subtitle="Tembusan, narahubung, pakaian (Font 10)"/>
            <SectionBody isActive={section === "keterangan"}>
              <div style={{ marginBottom: 12, padding: 12, border: "1px solid #E2E8F0", borderRadius: 8, background: form.showTembusan ? "#EEF2FF" : "#F8FAFC" }}>
                <CheckboxToggle checked={form.showTembusan} onChange={(e) => setForm(p => ({...p, showTembusan: e.target.checked}))} label="Tembusan" />
                {form.showTembusan && <textarea className="ug-input" style={{...textareaSt, minHeight: 60}} value={form.tembusan} onChange={set("tembusan")}/>}
              </div>
              <div style={{ marginBottom: 12, padding: 12, border: "1px solid #E2E8F0", borderRadius: 8, background: form.showNarahubung ? "#EEF2FF" : "#F8FAFC" }}>
                <CheckboxToggle checked={form.showNarahubung} onChange={(e) => setForm(p => ({...p, showNarahubung: e.target.checked}))} label="Narahubung" />
                {form.showNarahubung && <input className="ug-input" style={inputSt} value={form.narahubung} onChange={set("narahubung")}/>}
              </div>
              <div style={{ marginBottom: 12, padding: 12, border: "1px solid #E2E8F0", borderRadius: 8, background: form.showPakaian ? "#EEF2FF" : "#F8FAFC" }}>
                <CheckboxToggle checked={form.showPakaian} onChange={(e) => setForm(p => ({...p, showPakaian: e.target.checked}))} label="Pakaian" />
                {form.showPakaian && <input className="ug-input" style={inputSt} value={form.pakaian} onChange={set("pakaian")}/>}
              </div>
              <div style={{ marginBottom: 4 }}><Label text="Catatan Khusus"/><textarea className="ug-input" style={{...textareaSt, minHeight:56}} value={form.catatan} onChange={set("catatan")}/></div>
            </SectionBody>

            <SectionBtn isActive={section === "ttd"} onClick={() => setSection(s => s === "ttd" ? "" : "ttd")} icon="✍️" title="Tanda Tangan" subtitle="Pilih jenis TTD yang akan dicetak"/>
            <SectionBody isActive={section === "ttd"}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[["kosong","Kosong","Ruang TTD basah","⬜"], ["scan","Scan","Sisipkan gambar logo lokal","🖊"], ["tte","TTE","Variabel BSrE","🔐"]].map(item => (
                  <button key={item[0]} onClick={() => setForm(p => ({...p, jenisTtd: item[0]}))}
                    style={{ padding:"10px 12px",borderRadius:9,cursor:"pointer",textAlign:"left", border:"1.5px solid "+(form.jenisTtd===item[0]?NAVY:"#E2E8F0"), background:form.jenisTtd===item[0]?"#EEF2FF":"white", display:"flex",alignItems:"center",gap:10 }}>
                    <span style={{ fontSize:20 }}>{item[3]}</span>
                    <div><div style={{ fontSize:12,fontWeight:700,color:NAVY }}>{item[1]}</div><div style={{ fontSize:10.5,color:"#64748B" }}>{item[2]}</div></div>
                    {form.jenisTtd===item[0]&&<span style={{ marginLeft:"auto",color:NAVY,fontSize:14 }}>✓</span>}
                  </button>
                ))}
              </div>
            </SectionBody>

            <SectionBtn isActive={section === "lampiran"} onClick={() => setSection(s => s === "lampiran" ? "" : "lampiran")} icon="📎" title="Lampiran Daftar Undangan" subtitle="Isi jika pilihan cetak Semua Halaman"/>
            <SectionBody isActive={section === "lampiran"}>
              <div style={{ marginBottom: 12 }}><Label text="Judul Lampiran"/><input className="ug-input" style={inputSt} value={form.judulLampiran} onChange={set("judulLampiran")}/></div>
              <div style={{ marginBottom: 12 }}>
                <Label text="Spasi Baris"/>
                <select className="ug-input" style={inputSt} value={form.spasiLampiran} onChange={set("spasiLampiran")}>
                  <option value="1.0">1.0 (Rapat)</option><option value="1.15">1.15</option><option value="1.5">1.5 (Standar)</option><option value="2.0">2.0 (Renggang)</option>
                </select>
              </div>
              <div style={{ marginBottom: 4 }}><Label text="Isi Daftar Undangan"/><textarea className="ug-input" style={{...textareaSt, minHeight:130}} value={form.lampiran} onChange={set("lampiran")}/></div>
            </SectionBody>

            <div style={{ height: 16 }}/>
          </div>

          <div style={{ padding: "12px 14px 16px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", flexShrink: 0 }}>
            <button onClick={generatePDF} disabled={loading}
              style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none", background: loading ? "#94A3B8" : "linear-gradient(135deg," + NAVY + ",#1A2F50)", color: "white", fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: loading ? "none" : "0 4px 14px rgba(10,22,40,0.25)", marginBottom: 8 }}>
              {loading ? <><span style={{ width:16,height:16,borderRadius:"50%",border:"2.5px solid rgba(255,255,255,0.3)",borderTopColor:"white",display:"inline-block",animation:"spin 0.7s linear infinite" }}/>&nbsp;Menyiapkan...</> : <><span style={{ fontSize:18 }}>⬇</span>&nbsp;Simpan sebagai PDF</>}
            </button>
            
            <button onClick={cetakLangsung} disabled={loading}
              style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "2px solid " + NAVY, background: "white", color: NAVY, fontWeight: 800, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize:18 }}>🖨️</span> Cetak Langsung ke Printer
            </button>

            <button onClick={simpanKonsep}
              style={{ width:"100%",padding:"10px 0",borderRadius:10,border:"1.5px solid "+NAVY,background:"white",color:NAVY,fontWeight:700,fontSize:12.5,cursor:"pointer",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:7 }}>
              <span style={{ fontSize:16 }}>💾</span> Simpan Konsep
            </button>

            <button onClick={resetForm} style={{ width:"100%",padding:"9px 0",borderRadius:10,border:"1.5px solid #E2E8F0",background:"white",color:"#64748B",fontWeight:600,fontSize:12,cursor:"pointer" }}>🔄 Reset Semua Kolom</button>
          </div>
        </div>

        {!isMobile && (
          <div style={{ flex: 1, background: "#525659", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ background: "rgba(0,0,0,0.35)", padding: "9px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>👁 Pratinjau Dokumen</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Live Render Engine</span>
            </div>
            {/* Supaya layarnya tetap estetik, bayangannya kita kembalikan HANYA untuk iframe ini saja */}
            <iframe 
              id="preview-iframe" 
              title="Preview Undangan" 
              srcDoc={buildDocHTML(`
                /* Hanya untuk layar: latar gelap dan bayangan kertas supaya
                   halamannya terbaca sebagai lembaran. Ukuran dan margin isinya
                   tetap sama persis dengan yang dicetak dan diunduh. */
                body { padding:20px; background:#525659; display:flex; flex-direction:column; align-items:center; gap:20px; }
                .halaman-a4 { box-shadow: 0 4px 15px rgba(0,0,0,0.4) !important; margin-bottom: 20px !important; }
              `)}
              style={{ flex: 1, border: "none", width: "100%", background: "#525659" }}
            />
          </div>
        )}
      </div>
    </>
  );
}
