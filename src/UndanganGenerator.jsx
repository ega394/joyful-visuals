/**
 * UndanganGenerator.jsx — Prokopim Hibot v2.0
 *
 * Strategi integrasi:
 * - CSS asli (#dokumen-cetak, .halaman-a4, dll) disuntikkan UTUH via <style> tag
 * - HTML #dokumen-cetak dirender via dangerouslySetInnerHTML — TIDAK diubah sama sekali
 * - updatePreview() berjalan via useEffect + DOM manipulation langsung (getElementById)
 * — persis sama seperti di file HTML asli
 * - generatePDF() identik dengan versi asli
 *
 * GAMBAR STATIS — letakkan di:
 * public/image001.jpg   ← Logo Garuda Pancasila (kop surat)
 * public/stempel.png    ← Stempel Wali Kota Tarakan
 * public/image.jpeg     ← Tanda tangan Wali Kota
 */

import React, { useState, useEffect, useRef } from "react";

// ── CSS asli dari undangan.html — tidak diubah sama sekali ──
const CSS_ASLI = `
  /* KERTAS A4 & PENGUNCIAN FONT ARIAL */
  #dokumen-cetak, #dokumen-cetak * {
    font-family: Arial, Helvetica, sans-serif !important;
  }
  #dokumen-cetak { width: 210mm; background: transparent; margin-top: 20px; }

  .halaman-a4 {
    width: 210mm;
    min-height: 297mm;
    background: white;
    padding: 20mm 20mm 20mm 25mm;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    margin-bottom: 20px;
    box-sizing: border-box;
    font-size: 11pt;
    color: black;
    line-height: 1.5;
    position: relative;
  }

  /* TATA NASKAH KOP SURAT */
  .kop { text-align: center; margin-bottom: 25px; }
  .kop img { width: 88px; margin-bottom: 5px; }
  .kop-teks { font-size: 20pt; font-weight: bold; margin-top: 5px; letter-spacing: 0.5px; }

  /* TANGGAL & TABEL INFO */
  .tanggal-kanan { text-align: right; margin-bottom: 15px; font-style: normal; }
  .tabel-info { border-collapse: collapse; width: 100%; margin-bottom: 15px; }
  .tabel-info td { vertical-align: top; padding: 2px 0; }
  .col-label { width: 70pt; }
  .col-titikdua { width: 15pt; text-align: center; }

  /* YTH & TUJUAN */
  .tujuan-surat { margin-bottom: 15px; line-height: 1.5; }

  /* PARAGRAF DENGAN INDENTASI */
  .paragraf-indent {
    text-align: justify;
    text-indent: 36.75pt;
    margin-bottom: 5px;
    margin-top: 10px;
  }

  /* TABEL ACARA */
  .tabel-acara { border-collapse: collapse; width: 100%; margin-bottom: 10px; }
  .tabel-acara td { vertical-align: top; padding: 2px 0; }
  .col-label-acara { width: 113pt; }

  /* AREA TANDA TANGAN */
  .area-ttd {
    float: right;
    width: 250px;
    text-align: center;
    margin-top: 15px;
    position: relative;
  }

  /* Penanda Visual Variabel TTE di Web */
  .tte-marker {
    color: #0056b3;
    font-family: monospace !important;
    background: #e9ecef;
    padding: 2px 5px;
    border-radius: 3px;
    font-weight: bold;
  }

  /* AREA NARAHUBUNG */
  .area-kiri-bawah {
    clear: both;
    margin-top: 20px;
    line-height: 1.5;
  }

  /* ALAMAT FOOTER ABSOLUT */
  .footer-alamat {
    position: absolute;
    bottom: 20mm;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 10pt;
    line-height: 1.3;
  }

  .teks-multibaris { white-space: pre-wrap; }
  .page-break { page-break-before: always; }
`;

// ── HTML #dokumen-cetak asli — tidak diubah sama sekali ──
const HTML_DOKUMEN_CETAK = `
  <div class="halaman-a4">
    <div class="kop">
      <img src="/image001.jpg" alt="Garuda"
        onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/National_emblem_of_Indonesia_Garuda_Pancasila.svg/300px-National_emblem_of_Indonesia_Garuda_Pancasila.svg.png'">
      <div class="kop-teks">WALI KOTA TARAKAN</div>
    </div>

    <div class="tanggal-kanan" id="out_tanggalSurat">Tarakan, 27 Maret 2026</div>

    <table class="tabel-info">
      <tr><td class="col-label">Nomor</td><td class="col-titikdua">:</td><td><span id="out_nomor">8400/XXX/SETDA/2026</span></td></tr>
      <tr><td>Sifat</td><td>:</td><td><span id="out_sifat">Biasa</span></td></tr>
      <tr><td>Lampiran</td><td>:</td><td><span id="out_lampiranCount">1 (satu) halaman</span></td></tr>
      <tr><td>Hal</td><td>:</td><td><b><u>Undangan</u></b></td></tr>
    </table>

    <div class="tujuan-surat">
      Yth:<br>
      <b><span id="out_yth" class="teks-multibaris">(daftar terlampir)</span></b><br>
      di-<br>
      <b>TARAKAN</b>
    </div>

    <div class="paragraf-indent">
      Mengharapkan dengan hormat kehadiran Bapak/Ibu/Saudara (i) pada:
    </div>

    <table class="tabel-acara">
      <tr><td class="col-label-acara">hari/tanggal</td><td class="col-titikdua">:</td><td><span id="out_waktuAcara">Jumat, 27 Maret 2026</span></td></tr>
      <tr><td>pukul</td><td>:</td><td><span id="out_pukul">14.00 WITA s/d selesai</span></td></tr>
      <tr><td>tempat</td><td>:</td><td><span id="out_tempat">Ruang Rapat Wali Kota</span></td></tr>
      <tr><td>acara</td><td>:</td><td><b><div id="out_acara" class="teks-multibaris">1. Pemilihan Ketua BAZNAS Tarakan;
2. Pengarahan Wali Kota Tarakan; dan
3. Hal-hal lain yang dianggap perlu.</div></b></td></tr>
    </table>

    <div class="paragraf-indent">
      Demikian, atas perhatian serta kehadirannya diucapkan terima kasih.
    </div>

    <div class="area-ttd">
      WALI KOTA TARAKAN<br>
      <div id="ttd_utama_space" style="min-height: 80px; position: relative; display: flex; flex-direction: column; justify-content: center; align-items: center;"></div>
      <b>dr. H. KHAIRUL, M.Kes.</b>
    </div>

    <div class="area-kiri-bawah">
      <b><u>Narahubung:</u></b><br>
      <span id="out_narahubung">Kasubbag Protokol (0811-5961-116)</span><br>
      <b><u>Pakaian:</u></b><br>
      <span id="out_pakaian">PDH Batik Daerah/menyesuaikan</span><br>
      <div id="wadah_catatan">
        <b><u>catatan:</u></b><br>
        <span id="out_catatan" class="teks-multibaris">Hadir 15 menit sebelum acara dimulai.</span>
      </div>
    </div>

    <div class="footer-alamat">
      Jalan Kalimantan No. 1, Kota Tarakan<br>
      Telp. (0551) 21620, 34320 Fax. (0551) 23782
    </div>
  </div>

  <div class="halaman-a4 html2pdf__page-break" id="halaman-lampiran">
    <div style="margin-bottom: 15px;">LAMPIRAN SURAT</div>

    <table style="border-collapse: collapse; margin-bottom: 25px;">
      <tr>
        <td style="width: 70pt;">Nomor</td>
        <td style="width: 15pt;">:</td>
        <td><span id="out_nomor_lampiran">8400/XXX/SETDA/2026</span></td>
      </tr>
    </table>

    <div style="text-align: center; margin-bottom: 20px;">
      <b><u><span id="out_judulLampiran">DAFTAR UNDANGAN</span></u></b>
    </div>

    <div id="out_lampiran" class="teks-multibaris" style="line-height: 1.5; margin-bottom: 20px;">1. Asisten Pemerintahan dan Kesejahteraan Rakyat;
2. Kepala Kantor Kementerian Agama Kota Tarakan;
3. Kepala Bagian Kesejahteraan Rakyat;
4. Kepala Bagian Hukum;
5. Ketua BAZNAS Tarakan (K.H. Zainuddin Dalila);</div>

    <div class="area-ttd" style="margin-top: 30px;">
      WALI KOTA TARAKAN<br>
      <div id="ttd_lampiran_space" style="min-height: 80px; position: relative; display: flex; flex-direction: column; justify-content: center; align-items: center;"></div>
      <b>dr. H. KHAIRUL, M.Kes.</b>
    </div>
  </div>
`;

// ── Muat html2pdf.js dari CDN ─────────────────────────────
function loadHtml2Pdf() {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) { resolve(window.html2pdf); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    s.onload  = () => resolve(window.html2pdf);
    s.onerror = () => reject(new Error("Gagal memuat html2pdf.js — cek koneksi internet"));
    document.head.appendChild(s);
  });
}

// =====================================================================
// HELPER UI: Didefinisikan DI LUAR komponen utama agar tidak re-render
// =====================================================================
const NAVY = "#0A1628";
const GOLD = "#C9A84C";

const inputSt = {
  width: "100%", padding: "9px 11px", borderRadius: 8,
  border: "1.5px solid #E2E8F0", fontSize: 13, color: NAVY,
  background: "white", outline: "none", fontFamily: "inherit",
  boxSizing: "border-box",
};

const textareaSt = Object.assign({}, inputSt, { resize: "vertical", lineHeight: 1.55, minHeight: 72 });

const Label = ({ text, required, hint }) => (
  <div style={{ marginBottom: 5 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 4 }}>
      {text}
      {required && <span style={{ color: "#DC2626", fontSize: 10 }}>*</span>}
    </div>
    {hint && <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 1 }}>{hint}</div>}
  </div>
);

const SectionBtn = ({ isActive, onClick, icon, title, subtitle }) => (
  <button onClick={onClick}
    style={{ width: "100%", background: isActive ? NAVY : "#F8FAFC",
      border: "1.5px solid " + (isActive ? NAVY : "#E2E8F0"),
      borderRadius: 10, padding: "11px 14px", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 10, marginBottom: 2, textAlign: "left" }}>
    <span style={{ fontSize: 18 }}>{icon}</span>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? "white" : NAVY }}>{title}</div>
      <div style={{ fontSize: 11, color: isActive ? "rgba(255,255,255,0.65)" : "#94A3B8", marginTop: 1 }}>{subtitle}</div>
    </div>
    <span style={{ fontSize: 12, color: isActive ? "white" : "#94A3B8" }}>{isActive ? "▲" : "▼"}</span>
  </button>
);

const SectionBody = ({ isActive, children }) => isActive
  ? <div style={{ background: "white", border: "1.5px solid #E2E8F0", borderRadius: 10, padding: "16px", marginBottom: 10 }}>{children}</div>
  : null;


// =====================================================================
// KOMPONEN UTAMA
// =====================================================================
export default function UndanganGenerator({ isMobile, showT }) {
  const EMPTY = {
    pilihanCetak:  "semua",
    tanggalSurat:  "",
    nomor:         "",
    sifat:         "Biasa",
    lampiranCount: "",
    yth:           "",
    waktuAcara:    "",
    pukul:         "",
    tempat:        "",
    acara:         "",
    narahubung:    "",
    pakaian:       "",
    catatan:       "",
    jenisTtd:      "kosong",
    judulLampiran: "DAFTAR UNDANGAN",
    spasiLampiran: "1.5",
    lampiran:      "",
  };

  const [form, setForm]       = React.useState(EMPTY);
  const [loading, setLoading] = React.useState(false);
  const [section, setSection] = React.useState("surat");
  const dokumenRef             = React.useRef(null);

  const set = (key) => (e) => setForm(function(p){ return Object.assign({}, p, {[key]: e.target.value}); });

  const resetForm = () => {
    if (window.confirm("Reset semua kolom? Data yang belum disimpan akan hilang.")) {
      setForm(EMPTY);
    }
  };

  // ── buildIframeSrcDoc: ZERO nested template literal ──────────────────────
  const buildIframeSrcDoc = () => {
    var f = form;

    var ttdContent = "<br><br><br>";
    if (f.jenisTtd === "scan") {
      ttdContent =
        "<img src='/stempel.png' style='position:absolute;left:0;top:-30px;width:145px;z-index:1;mix-blend-mode:multiply' onerror=\"this.style.display='none'\">" +
        "<img src='/image.jpeg' style='position:absolute;right:0;top:-30px;height:140px;z-index:2;mix-blend-mode:multiply' alt='TTD'>";
    } else if (f.jenisTtd === "tte") {
      ttdContent = "<br><br>${ttd_pengirim}<br><br>";
    }

    var esc = function(s) {
      return (s || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\r?\n/g, "\\n");
    };

    var script =
      "function updatePreview(){" +
      "var p='" + esc(f.pilihanCetak) + "';" +
      "var hl=document.getElementById('halaman-lampiran');" +
      "if(hl)hl.style.display=p==='utama'?'none':'block';" +
      "var tc='" + esc(ttdContent) + "';" +
      "var tu=document.getElementById('ttd_utama_space');" +
      "var tl=document.getElementById('ttd_lampiran_space');" +
      "if(tu)tu.innerHTML=tc;" +
      "if(tl)tl.innerHTML=tc;" +
      "document.getElementById('out_tanggalSurat').innerText='" + esc(f.tanggalSurat) + "';" +
      "document.getElementById('out_nomor').innerText='" + esc(f.nomor) + "';" +
      "document.getElementById('out_nomor_lampiran').innerText='" + esc(f.nomor) + "';" +
      "document.getElementById('out_sifat').innerText='" + esc(f.sifat) + "';" +
      "document.getElementById('out_lampiranCount').innerText='" + esc(f.lampiranCount) + "';" +
      "document.getElementById('out_yth').innerText='" + esc(f.yth) + "';" +
      "document.getElementById('out_waktuAcara').innerText='" + esc(f.waktuAcara) + "';" +
      "document.getElementById('out_pukul').innerText='" + esc(f.pukul) + "';" +
      "document.getElementById('out_tempat').innerText='" + esc(f.tempat) + "';" +
      "document.getElementById('out_acara').innerText='" + esc(f.acara) + "';" +
      "document.getElementById('out_narahubung').innerText='" + esc(f.narahubung) + "';" +
      "document.getElementById('out_pakaian').innerText='" + esc(f.pakaian) + "';" +
      "var cat='" + esc(f.catatan) + "';" +
      "document.getElementById('out_catatan').innerText=cat;" +
      "document.getElementById('wadah_catatan').style.display=cat.trim()===''?'none':'block';" +
      "document.getElementById('out_judulLampiran').innerText='" + esc(f.judulLampiran) + "';" +
      "var al=document.getElementById('out_lampiran');" +
      "al.innerText='" + esc(f.lampiran) + "';" +
      "al.style.lineHeight='" + esc(f.spasiLampiran) + "';" +
      "}" +
      "window.onload=updatePreview;";

    return (
      "<!DOCTYPE html><html lang='id'><head><meta charset='UTF-8'><style>" +
      "body{margin:0;padding:20px;background-color:#525659;display:flex;justify-content:center;}" +
      CSS_ASLI +
      "</style></head><body>" +
      "<div id='dokumen-cetak'>" + HTML_DOKUMEN_CETAK + "</div>" +
      "<script>" + script + "<\/script>" +
      "</body></html>"
    );
  };

  // ── generatePDF: string concatenation, zero template literal ─────────────
  const generatePDF = async () => {
    if (!form.nomor.trim() || !form.waktuAcara.trim() || !form.tempat.trim()) {
      if (showT) showT("Isi minimal: Nomor Surat, Hari/Tanggal Acara, dan Tempat", "warn");
      return;
    }
    setLoading(true);
    try {
      var html2pdf = await loadHtml2Pdf();
      var f = form;

      var ttdPdf = "<br><br><br>";
      if (f.jenisTtd === "scan") {
        ttdPdf =
          "<img src='/stempel.png' style='position:absolute;left:0;top:-30px;width:145px;z-index:1;mix-blend-mode:multiply' onerror=\"this.style.display='none'\">" +
          "<img src='/image.jpeg' style='position:absolute;right:0;top:-30px;height:140px;z-index:2;mix-blend-mode:multiply' alt='TTD'>";
      } else if (f.jenisTtd === "tte") {
        ttdPdf = "<br><br>" + f.nomor + "<br><br>";
      }

      var catatanHtml = f.catatan.trim()
        ? "<div><b><u>catatan:</u></b><br><span class='teks-multibaris'>" + f.catatan + "</span></div>"
        : "";

      var halamanLampiran = "";
      if (f.pilihanCetak !== "utama") {
        halamanLampiran =
          "<div class='halaman-a4 html2pdf__page-break'>" +
          "<div style='margin-bottom:15px;'>LAMPIRAN SURAT</div>" +
          "<table style='border-collapse:collapse;margin-bottom:25px;'>" +
          "<tr><td style='width:70pt;'>Nomor</td><td style='width:15pt;'>:</td><td>" + f.nomor + "</td></tr>" +
          "</table>" +
          "<div style='text-align:center;margin-bottom:20px;'><b><u>" + f.judulLampiran + "</u></b></div>" +
          "<div class='teks-multibaris' style='line-height:" + f.spasiLampiran + ";margin-bottom:20px;'>" + f.lampiran + "</div>" +
          "<div class='area-ttd' style='margin-top:30px;'>WALI KOTA TARAKAN<br>" +
          "<div style='min-height:80px;position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;'>" + ttdPdf + "</div>" +
          "<b>dr. H. KHAIRUL, M.Kes.</b></div>" +
          "</div>";
      }

      var htmlPdf =
        "<div class='halaman-a4'>" +
        "<div class='kop'>" +
        "<img src='/image001.jpg' alt='Garuda' onerror=\"this.src='https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/National_emblem_of_Indonesia_Garuda_Pancasila.svg/300px-National_emblem_of_Indonesia_Garuda_Pancasila.svg.png'\">" +
        "<div class='kop-teks'>WALI KOTA TARAKAN</div>" +
        "</div>" +
        "<div class='tanggal-kanan'>" + f.tanggalSurat + "</div>" +
        "<table class='tabel-info'>" +
        "<tr><td class='col-label'>Nomor</td><td class='col-titikdua'>:</td><td>" + f.nomor + "</td></tr>" +
        "<tr><td>Sifat</td><td>:</td><td>" + f.sifat + "</td></tr>" +
        "<tr><td>Lampiran</td><td>:</td><td>" + f.lampiranCount + "</td></tr>" +
        "<tr><td>Hal</td><td>:</td><td><b><u>Undangan</u></b></td></tr>" +
        "</table>" +
        "<div class='tujuan-surat'>Yth:<br><b><span class='teks-multibaris'>" + f.yth + "</span></b><br>di-<br><b>TARAKAN</b></div>" +
        "<div class='paragraf-indent'>Mengharapkan dengan hormat kehadiran Bapak/Ibu/Saudara (i) pada:</div>" +
        "<table class='tabel-acara'>" +
        "<tr><td class='col-label-acara'>hari/tanggal</td><td class='col-titikdua'>:</td><td>" + f.waktuAcara + "</td></tr>" +
        "<tr><td>pukul</td><td>:</td><td>" + f.pukul + "</td></tr>" +
        "<tr><td>tempat</td><td>:</td><td>" + f.tempat + "</td></tr>" +
        "<tr><td>acara</td><td>:</td><td><b><div class='teks-multibaris'>" + f.acara + "</div></b></td></tr>" +
        "</table>" +
        "<div class='paragraf-indent'>Demikian, atas perhatian serta kehadirannya diucapkan terima kasih.</div>" +
        "<div class='area-ttd'>WALI KOTA TARAKAN<br>" +
        "<div style='min-height:80px;position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;'>" + ttdPdf + "</div>" +
        "<b>dr. H. KHAIRUL, M.Kes.</b></div>" +
        "<div class='area-kiri-bawah'>" +
        "<b><u>Narahubung:</u></b><br>" + f.narahubung + "<br>" +
        "<b><u>Pakaian:</u></b><br>" + f.pakaian + "<br>" +
        catatanHtml +
        "</div>" +
        "<div class='footer-alamat'>Jalan Kalimantan No. 1, Kota Tarakan<br>Telp. (0551) 21620, 34320 Fax. (0551) 23782</div>" +
        "</div>" +
        halamanLampiran;

      var styleEl = document.createElement("style");
      styleEl.textContent = CSS_ASLI;
      document.head.appendChild(styleEl);

      var container = document.createElement("div");
      container.style.cssText = "position:fixed;left:-9999px;top:0;width:210mm;background:transparent;z-index:-9999;";
      container.innerHTML = htmlPdf;
      document.body.appendChild(container);

      var nomorSurat = f.nomor.replace(/\//g, "-");
      var suffixTtd  = f.jenisTtd === "tte" ? "_TTE" : f.jenisTtd === "scan" ? "_Scan" : "";
      var prefix     = f.pilihanCetak === "utama" ? "Undangan_Utama" : "Undangan";
      var namaFile   = prefix + suffixTtd + "_" + nomorSurat + ".pdf";

      await html2pdf().set({
        margin: 0, filename: namaFile,
        image: { type: "jpeg", quality: 1 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      }).from(container).save();

      document.body.removeChild(container);
      document.head.removeChild(styleEl);

      if (showT) showT("PDF berhasil diunduh: " + namaFile, "ok");
    } catch (err) {
      if (showT) showT("Gagal membuat PDF: " + err.message, "error");
      else alert("Gagal: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS_ASLI }} />
      <style dangerouslySetInnerHTML={{ __html:
        ".ug-input:focus{border-color:" + NAVY + "!important;box-shadow:0 0 0 3px rgba(10,22,40,0.08)}" +
        ".ug-input::placeholder{color:#CBD5E1}" +
        "@keyframes fadeDown{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}" +
        "@keyframes spin{to{transform:rotate(360deg)}}"
      }} />

      <div style={{ display: "flex", height: isMobile ? "auto" : "calc(100vh - 60px)", overflow: "hidden", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

        {/* ══ PANEL FORM ══════════════════════════════════════════ */}
        <div style={{ flex: "0 0 400px", background: "#F8FAFC", overflowY: "auto", display: "flex", flexDirection: "column", borderRight: "1px solid #E2E8F0" }}>

          {/* Header */}
          <div style={{ background: "linear-gradient(135deg," + NAVY + ",#1A2F50)", padding: "20px 20px 16px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>📄</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "white" }}>Generator Undangan</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Wali Kota Tarakan · Format Resmi</div>
              </div>
            </div>
            {/* Pilihan Cetak */}
            <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Pilihan Cetak PDF</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["semua","Utama + Lampiran"],["utama","Hanya Utama"]].map(function(item){
                  var v = item[0], l = item[1];
                  return (
                    <button key={v} onClick={() => setForm(function(p){ return Object.assign({},p,{pilihanCetak:v}); })}
                      style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer",
                        background: form.pilihanCetak === v ? GOLD : "rgba(255,255,255,0.15)",
                        color: form.pilihanCetak === v ? NAVY : "white",
                        fontSize: 11, fontWeight: 700 }}>
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, padding: "14px 14px 0", overflowY: "auto" }}>

            {/* Info */}
            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 9, padding: "10px 12px", marginBottom: 12, display: "flex", gap: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>ℹ️</span>
              <div style={{ fontSize: 11, color: "#1D4ED8", lineHeight: 1.6 }}>
                Isi kolom sesuai kebutuhan. Kolom bertanda <span style={{ color: "#DC2626", fontWeight: 700 }}>*</span> wajib diisi sebelum mengunduh. Preview memperbarui otomatis.
              </div>
            </div>

            {/* ── SEKSI 1: Data Surat ── */}
            <SectionBtn isActive={section === "surat"} onClick={() => setSection(s => s === "surat" ? "" : "surat")} icon="🗂" title="Data Surat" subtitle="Nomor, tanggal, sifat, lampiran"/>
            <SectionBody isActive={section === "surat"}>
              <div style={{ marginBottom: 12 }}>
                <Label text="Tempat, Tanggal Surat" hint="Contoh: Tarakan, 1 April 2026"/>
                <input className="ug-input" style={inputSt} placeholder="Tarakan, ..." value={form.tanggalSurat} onChange={set("tanggalSurat")}/>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Label text="Nomor Surat" required hint="Contoh: 8400/XXX/SETDA/2026"/>
                <input className="ug-input" style={inputSt} placeholder="8400/…/SETDA/2026" value={form.nomor} onChange={set("nomor")}/>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <Label text="Sifat"/>
                  <select className="ug-input" style={inputSt} value={form.sifat} onChange={set("sifat")}>
                    <option>Biasa</option><option>Penting</option><option>Segera</option><option>Rahasia</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <Label text="Lampiran" hint="Contoh: 1 (satu) halaman"/>
                  <input className="ug-input" style={inputSt} placeholder="1 (satu) halaman" value={form.lampiranCount} onChange={set("lampiranCount")}/>
                </div>
              </div>
              <div style={{ marginBottom: 4 }}>
                <Label text="Yth (Tujuan Surat)" hint="Tulis per baris. Contoh: (daftar terlampir)"/>
                <textarea className="ug-input" style={Object.assign({},textareaSt,{minHeight:56})} placeholder="(daftar terlampir)" value={form.yth} onChange={set("yth")}/>
              </div>
            </SectionBody>

            {/* ── SEKSI 2: Data Acara ── */}
            <SectionBtn isActive={section === "acara"} onClick={() => setSection(s => s === "acara" ? "" : "acara")} icon="📋" title="Data Acara" subtitle="Waktu, tempat, dan susunan kegiatan"/>
            <SectionBody isActive={section === "acara"}>
              <div style={{ marginBottom: 12 }}>
                <Label text="Hari/Tanggal Acara" required hint="Contoh: Senin, 1 April 2026"/>
                <input className="ug-input" style={inputSt} placeholder="Senin, 1 April 2026" value={form.waktuAcara} onChange={set("waktuAcara")}/>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Label text="Pukul" hint="Contoh: 09.00 WITA s/d selesai"/>
                <input className="ug-input" style={inputSt} placeholder="09.00 WITA s/d selesai" value={form.pukul} onChange={set("pukul")}/>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Label text="Tempat Acara" required/>
                <input className="ug-input" style={inputSt} placeholder="Ruang Rapat Wali Kota" value={form.tempat} onChange={set("tempat")}/>
              </div>
              <div style={{ marginBottom: 4 }}>
                <Label text="Nama / Susunan Acara" hint="Gunakan Enter untuk baris baru"/>
                <textarea className="ug-input" style={Object.assign({},textareaSt,{minHeight:90})} placeholder={"1. …;\n2. …; dan\n3. Hal-hal lain yang dianggap perlu."} value={form.acara} onChange={set("acara")}/>
              </div>
            </SectionBody>

            {/* ── SEKSI 3: Keterangan ── */}
            <SectionBtn isActive={section === "keterangan"} onClick={() => setSection(s => s === "keterangan" ? "" : "keterangan")} icon="📌" title="Keterangan Tambahan" subtitle="Narahubung, pakaian, catatan"/>
            <SectionBody isActive={section === "keterangan"}>
              <div style={{ marginBottom: 12 }}>
                <Label text="Narahubung & Nomor HP" hint="Contoh: Kasubbag Protokol (0811-5961-116)"/>
                <input className="ug-input" style={inputSt} placeholder="Kasubbag Protokol (…)" value={form.narahubung} onChange={set("narahubung")}/>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Label text="Pakaian" hint="Contoh: PDH Batik Daerah / PSH / Menyesuaikan"/>
                <input className="ug-input" style={inputSt} placeholder="PDH Batik Daerah / Menyesuaikan" value={form.pakaian} onChange={set("pakaian")}/>
              </div>
              <div style={{ marginBottom: 4 }}>
                <Label text="Catatan" hint="Kosongkan jika tidak ada — tidak muncul di surat"/>
                <textarea className="ug-input" style={Object.assign({},textareaSt,{minHeight:56})} placeholder="Hadir 15 menit sebelum acara dimulai." value={form.catatan} onChange={set("catatan")}/>
              </div>
            </SectionBody>

            {/* ── SEKSI 4: TTD ── */}
            <SectionBtn isActive={section === "ttd"} onClick={() => setSection(s => s === "ttd" ? "" : "ttd")} icon="✍️" title="Tanda Tangan" subtitle="Pilih jenis TTD yang akan dicetak"/>
            <SectionBody isActive={section === "ttd"}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  ["kosong","Kosong","Ruang TTD basah — tanda tangan tulis tangan setelah cetak","⬜"],
                  ["scan","Scan","Otomatis sisipkan TTD + Stempel dari file public/","🖊"],
                  ["tte","TTE","Variabel BSrE untuk Tanda Tangan Elektronik","🔐"],
                ].map(function(item){
                  var v=item[0],l=item[1],hint=item[2],icon=item[3];
                  return (
                    <button key={v} onClick={() => setForm(function(p){ return Object.assign({},p,{jenisTtd:v}); })}
                      style={{ padding:"10px 12px",borderRadius:9,cursor:"pointer",textAlign:"left",
                        border:"1.5px solid "+(form.jenisTtd===v?NAVY:"#E2E8F0"),
                        background:form.jenisTtd===v?"#EEF2FF":"white",
                        display:"flex",alignItems:"center",gap:10 }}>
                      <span style={{ fontSize:20 }}>{icon}</span>
                      <div>
                        <div style={{ fontSize:12,fontWeight:700,color:NAVY }}>{l}</div>
                        <div style={{ fontSize:10.5,color:"#64748B" }}>{hint}</div>
                      </div>
                      {form.jenisTtd===v&&<span style={{ marginLeft:"auto",color:NAVY,fontSize:14 }}>✓</span>}
                    </button>
                  );
                })}
                {form.jenisTtd==="scan"&&(
                  <div style={{ background:"#FFF8E1",borderRadius:8,padding:"8px 11px",fontSize:11,color:"#856404",border:"1px solid #FDE68A" }}>
                    ⚠️ Pastikan <code>stempel.png</code> dan <code>image.jpeg</code> ada di folder <code>public/</code>
                  </div>
                )}
              </div>
            </SectionBody>

            {/* ── SEKSI 5: Lampiran ── */}
            <SectionBtn isActive={section === "lampiran"} onClick={() => setSection(s => s === "lampiran" ? "" : "lampiran")} icon="📎" title="Lampiran Daftar Undangan" subtitle="Isi jika pilihan cetak Semua Halaman"/>
            <SectionBody isActive={section === "lampiran"}>
              <div style={{ marginBottom: 12 }}>
                <Label text="Judul Lampiran"/>
                <input className="ug-input" style={inputSt} placeholder="DAFTAR UNDANGAN" value={form.judulLampiran} onChange={set("judulLampiran")}/>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Label text="Spasi Baris"/>
                <select className="ug-input" style={inputSt} value={form.spasiLampiran} onChange={set("spasiLampiran")}>
                  <option value="1.0">1.0 (Rapat)</option>
                  <option value="1.15">1.15</option>
                  <option value="1.5">1.5 (Standar)</option>
                  <option value="2.0">2.0 (Renggang)</option>
                </select>
              </div>
              <div style={{ marginBottom: 4 }}>
                <Label text="Isi Daftar Undangan" hint="Satu per baris, gunakan Enter"/>
                <textarea className="ug-input" style={Object.assign({},textareaSt,{minHeight:130})} placeholder={"1. …;\n2. …;\n3. …."} value={form.lampiran} onChange={set("lampiran")}/>
              </div>
            </SectionBody>

            <div style={{ height: 16 }}/>
          </div>

          {/* Tombol aksi sticky */}
          <div style={{ padding: "12px 14px 16px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", flexShrink: 0 }}>
            <button onClick={generatePDF} disabled={loading}
              style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
                background: loading ? "#94A3B8" : "linear-gradient(135deg," + NAVY + ",#1A2F50)",
                color: "white", fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: loading ? "none" : "0 4px 14px rgba(10,22,40,0.25)", marginBottom: 8 }}>
              {loading
                ? <><span style={{ width:16,height:16,borderRadius:"50%",border:"2.5px solid rgba(255,255,255,0.3)",borderTopColor:"white",display:"inline-block",animation:"spin 0.7s linear infinite" }}/>&nbsp;Memproses PDF...</>
                : <><span style={{ fontSize:18 }}>⬇</span>&nbsp;Unduh PDF Undangan</>}
            </button>
            <button onClick={resetForm}
              style={{ width:"100%",padding:"9px 0",borderRadius:10,border:"1.5px solid #E2E8F0",background:"white",color:"#64748B",fontWeight:600,fontSize:12,cursor:"pointer" }}>
              🔄 Reset Semua Kolom
            </button>
          </div>
        </div>

        {/* ══ PANEL PREVIEW ═══════════════════════════════════════ */}
        {!isMobile && (
          <div style={{ flex: 1, background: "#525659", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ background: "rgba(0,0,0,0.35)", padding: "9px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>👁 Pratinjau Dokumen</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Memperbarui otomatis saat Anda mengetik</span>
            </div>
            <iframe ref={dokumenRef} title="Preview Undangan" srcDoc={buildIframeSrcDoc()}
              style={{ flex: 1, border: "none", width: "100%", background: "#525659" }}/>
          </div>
        )}

        {isMobile && (
          <div style={{ padding: 16 }}>
            <div style={{ background:"#FFF3CD",borderRadius:9,padding:"11px 14px",fontSize:12,color:"#856404",border:"1px solid #FFD97D" }}>
              ℹ️ Preview tidak tersedia di mobile. Isi semua kolom lalu tekan <strong>Unduh PDF</strong>.
            </div>
          </div>
        )}
      </div>
    </>
  );
}