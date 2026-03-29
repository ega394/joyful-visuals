/**
 * UndanganGenerator.jsx — Prokopim Hibot v2.0
 *
 * Strategi integrasi:
 * - CSS asli (#dokumen-cetak, .halaman-a4, dll) disuntikkan UTUH via <style> tag
 * - HTML #dokumen-cetak dirender via dangerouslySetInnerHTML — TIDAK diubah sama sekali
 * - updatePreview() berjalan via useEffect + DOM manipulation langsung (getElementById)
 *   — persis sama seperti di file HTML asli
 * - generatePDF() identik dengan versi asli
 *
 * GAMBAR STATIS — letakkan di:
 *   public/image001.jpg   ← Logo Garuda Pancasila (kop surat)
 *   public/stempel.png    ← Stempel Wali Kota Tarakan
 *   public/image.jpeg     ← Tanda tangan Wali Kota
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
// (hanya path gambar disesuaikan ke /public/)
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

export default function UndanganGenerator({ isMobile, showT }) {
  // ── State form (identik dengan nilai default di HTML asli) ──
  const [form, setForm] = useState({
    pilihanCetak:   "semua",
    tanggalSurat:   "Tarakan, 27 Maret 2026",
    nomor:          "8400/XXX/SETDA/2026",
    sifat:          "Biasa",
    lampiranCount:  "1 (satu) halaman",
    yth:            "(daftar terlampir)",
    waktuAcara:     "Jumat, 27 Maret 2026",
    pukul:          "14.00 WITA s/d selesai",
    tempat:         "Ruang Rapat Wali Kota",
    acara:          "1. Pemilihan Ketua BAZNAS Tarakan;\n2. Pengarahan Wali Kota Tarakan; dan\n3. Hal-hal lain yang dianggap perlu.",
    narahubung:     "Kasubbag Protokol (0811-5961-116)",
    pakaian:        "PDH Batik Daerah/menyesuaikan",
    catatan:        "Hadir 15 menit sebelum acara dimulai.",
    jenisTtd:       "tte",
    judulLampiran:  "DAFTAR UNDANGAN",
    spasiLampiran:  "1.5",
    lampiran:       "1. Asisten Pemerintahan dan Kesejahteraan Rakyat;\n2. Kepala Kantor Kementerian Agama Kota Tarakan;\n3. Kepala Bagian Kesejahteraan Rakyat;\n4. Kepala Bagian Hukum;\n5. Ketua BAZNAS Tarakan (K.H. Zainuddin Dalila);",
  });

  const [loading, setLoading] = useState(false);
  const dokumenRef = useRef(null);

  const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  // ── updatePreview() — persis sama seperti di HTML asli ──
  // Dijalankan setiap kali form berubah via useEffect
  const updatePreview = () => {
    const el = (id) => document.getElementById(id);
    if (!el("out_tanggalSurat")) return; // dokumen belum render

    // Visibilitas halaman lampiran
    const halamanLampiran = el("halaman-lampiran");
    if (halamanLampiran) {
      halamanLampiran.style.display = form.pilihanCetak === "utama" ? "none" : "block";
    }

    // Logika tanda tangan
    let ttdContent = "<br><br><br>";
    if (form.jenisTtd === "scan") {
      ttdContent = `
        <img src="/stempel.png" style="position: absolute; right: 140px; top: -20px; width: 145px; z-index: 1; mix-blend-mode: multiply;" onerror="this.style.display='none'">
        <img src="/image.jpeg" style="position: absolute; right: 30px; top: -20px; height: 140px; z-index: 2; mix-blend-mode: multiply;" alt="TTD">
      `;
    } else if (form.jenisTtd === "tte") {
      ttdContent = '<br><br><span class="tte-marker">${ttd_pengirim}</span><br><br>';
    }

    const ttdUtama = el("ttd_utama_space");
    const ttdLampiran = el("ttd_lampiran_space");
    if (ttdUtama)    ttdUtama.innerHTML    = ttdContent;
    if (ttdLampiran) ttdLampiran.innerHTML = ttdContent;

    // Update teks — persis urutan yang sama seperti updatePreview() asli
    if (el("out_tanggalSurat"))    el("out_tanggalSurat").innerText    = form.tanggalSurat;
    if (el("out_nomor"))           el("out_nomor").innerText           = form.nomor;
    if (el("out_nomor_lampiran"))  el("out_nomor_lampiran").innerText  = form.nomor;
    if (el("out_sifat"))           el("out_sifat").innerText           = form.sifat;
    if (el("out_lampiranCount"))   el("out_lampiranCount").innerText   = form.lampiranCount;
    if (el("out_yth"))             el("out_yth").innerText             = form.yth;
    if (el("out_waktuAcara"))      el("out_waktuAcara").innerText      = form.waktuAcara;
    if (el("out_pukul"))           el("out_pukul").innerText           = form.pukul;
    if (el("out_tempat"))          el("out_tempat").innerText          = form.tempat;
    if (el("out_acara"))           el("out_acara").innerText           = form.acara;
    if (el("out_narahubung"))      el("out_narahubung").innerText      = form.narahubung;
    if (el("out_pakaian"))         el("out_pakaian").innerText         = form.pakaian;

    const teksCatatan = form.catatan;
    if (el("out_catatan"))   el("out_catatan").innerText = teksCatatan;
    if (el("wadah_catatan")) el("wadah_catatan").style.display = teksCatatan.trim() === "" ? "none" : "block";

    if (el("out_judulLampiran")) el("out_judulLampiran").innerText = form.judulLampiran;

    const areaLampiran = el("out_lampiran");
    if (areaLampiran) {
      areaLampiran.innerText     = form.lampiran;
      areaLampiran.style.lineHeight = form.spasiLampiran;
    }
  };

  // Jalankan updatePreview setiap kali form berubah
  useEffect(() => {
    updatePreview();
  }, [form]);

  // ── generatePDF() — persis sama seperti di HTML asli ──
  const generatePDF = async () => {
    setLoading(true);
    try {
      const html2pdf = await loadHtml2Pdf();

      // Hilangkan warna biru TTE marker saat cetak
      const tteMarkers = document.querySelectorAll(".tte-marker");
      tteMarkers.forEach(m => {
        m.style.color      = "black";
        m.style.background = "transparent";
      });

      const elemenDokumen = document.getElementById("dokumen-cetak");
      const nomorSurat    = form.nomor.replace(/\//g, "-");
      const suffixTtd     = form.jenisTtd === "tte" ? "_TTE" : form.jenisTtd === "scan" ? "_Scan" : "";
      let   namaFile      = "Undangan" + suffixTtd + "_" + nomorSurat + ".pdf";
      if (form.pilihanCetak === "utama") {
        namaFile = "Undangan_Utama" + suffixTtd + "_" + nomorSurat + ".pdf";
      }

      const opsi = {
        margin:      0,
        filename:    namaFile,
        image:       { type: "jpeg", quality: 1 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true },
        jsPDF:       { unit: "mm", format: "a4", orientation: "portrait" },
      };

      await html2pdf().set(opsi).from(elemenDokumen).save();

      // Kembalikan warna TTE marker
      tteMarkers.forEach(m => {
        m.style.color      = "#0056b3";
        m.style.background = "#e9ecef";
      });

      if (showT) showT("PDF berhasil diunduh ✓", "ok");
    } catch (err) {
      if (showT) showT("Gagal membuat PDF: " + err.message, "error");
      else alert("Gagal membuat PDF! Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── CSS form UI (terpisah dari CSS dokumen cetak) ──
  const cssForm = `
    .ug-body { font-family: 'Segoe UI', Tahoma, sans-serif; display: flex; gap: 0; height: 100%; overflow: hidden; }
    .ug-panel-form { flex: 0 0 420px; background: white; padding: 20px; overflow-y: auto; height: 100%; border-right: 1px solid #ddd; box-sizing: border-box; }
    .ug-panel-preview { flex: 2; display: flex; flex-direction: column; align-items: center; overflow-y: auto; height: 100%; padding-bottom: 20px; background-color: #525659; }
    .ug-panel-form h3 { margin-top: 0; color: #333; position: sticky; top: 0; background: white; padding-bottom: 10px; border-bottom: 1px solid #ddd; z-index: 10; }
    .ug-form-group { margin-bottom: 12px; }
    .ug-form-group label { display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px; color: #555; }
    .ug-form-group input,
    .ug-form-group textarea,
    .ug-form-group select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-family: inherit; font-size: 13px; }
    .ug-hint { font-size: 11px; color: #666; display: block; margin-top: 3px; }
    .ug-btn { background-color: #0d6efd; color: white; border: none; padding: 12px; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%; font-size: 15px; margin-top: 10px; position: sticky; bottom: 0; }
    .ug-btn:hover { background-color: #0b5ed7; }
    .ug-btn:disabled { background-color: #6c757d; cursor: not-allowed; }
    .ug-hr { margin: 20px 0; border: 0; border-top: 1px dashed #ccc; }
  `;

  return (
    <>
      {/* Suntikkan CSS asli dokumen cetak + CSS form UI */}
      <style>{CSS_ASLI}</style>
      <style>{cssForm}</style>

      <div className="ug-body" style={{ height: isMobile ? "auto" : "calc(100vh - 60px)" }}>

        {/* ── Panel Form — identik dengan panel-form asli ── */}
        <div className="ug-panel-form">
          <h3>Formulir Undangan 2026</h3>

          {/* Pilihan cetak */}
          <div className="ug-form-group" style={{ background:"#eef2f7", padding:10, borderRadius:6, border:"1px solid #cce5ff" }}>
            <label style={{ color:"#004085" }}>Pilihan Cetak PDF:</label>
            <select value={form.pilihanCetak} onChange={set("pilihanCetak")}>
              <option value="semua">Semua Halaman (Utama + Lampiran)</option>
              <option value="utama">Hanya Halaman Utama</option>
            </select>
          </div>

          {/* Data surat */}
          <div className="ug-form-group">
            <label>Tempat, Tanggal Surat:</label>
            <input type="text" value={form.tanggalSurat} onChange={set("tanggalSurat")}/>
          </div>
          <div className="ug-form-group">
            <label>Nomor Surat:</label>
            <input type="text" value={form.nomor} onChange={set("nomor")}/>
          </div>
          <div className="ug-form-group">
            <label>Sifat:</label>
            <input type="text" value={form.sifat} onChange={set("sifat")}/>
          </div>
          <div className="ug-form-group">
            <label>Lampiran:</label>
            <input type="text" value={form.lampiranCount} onChange={set("lampiranCount")}/>
          </div>

          <hr className="ug-hr"/>

          {/* Tujuan & acara */}
          <div className="ug-form-group">
            <label>Yth (Tujuan Surat):</label>
            <textarea rows={2} value={form.yth} onChange={set("yth")}/>
          </div>
          <div className="ug-form-group">
            <label>Hari/Tanggal Acara:</label>
            <input type="text" value={form.waktuAcara} onChange={set("waktuAcara")}/>
          </div>
          <div className="ug-form-group">
            <label>Pukul:</label>
            <input type="text" value={form.pukul} onChange={set("pukul")}/>
          </div>
          <div className="ug-form-group">
            <label>Tempat Acara:</label>
            <input type="text" value={form.tempat} onChange={set("tempat")}/>
          </div>
          <div className="ug-form-group">
            <label>Nama Acara (Bisa Enter):</label>
            <textarea rows={3} value={form.acara} onChange={set("acara")}/>
          </div>

          <hr className="ug-hr"/>

          {/* Keterangan */}
          <div className="ug-form-group">
            <label>Narahubung & Nomor HP:</label>
            <input type="text" value={form.narahubung} onChange={set("narahubung")}/>
          </div>
          <div className="ug-form-group">
            <label>Pakaian:</label>
            <input type="text" value={form.pakaian} onChange={set("pakaian")}/>
          </div>
          <div className="ug-form-group">
            <label>Catatan (Kosongkan jika tak ada):</label>
            <textarea rows={2} value={form.catatan} onChange={set("catatan")}/>
          </div>

          <hr className="ug-hr"/>

          {/* Tanda tangan */}
          <div className="ug-form-group" style={{ background:"#fff8e1", padding:10, borderRadius:6, border:"1px solid #ffe082" }}>
            <label style={{ color:"#b97700" }}>Jenis Tanda Tangan:</label>
            <select value={form.jenisTtd} onChange={set("jenisTtd")}>
              <option value="kosong">Kosong (Ruang TTD Basah)</option>
              <option value="scan">Scan (Otomatis TTD + Stempel)</option>
              <option value="tte">TTE (Variabel BSrE)</option>
            </select>
            {form.jenisTtd === "scan" && (
              <span className="ug-hint">⚠️ Pastikan <code>stempel.png</code> dan <code>image.jpeg</code> ada di folder <code>public/</code></span>
            )}
          </div>

          {/* Lampiran */}
          <div className="ug-form-group">
            <label>Judul Lampiran:</label>
            <input type="text" value={form.judulLampiran} onChange={set("judulLampiran")}/>
          </div>
          <div className="ug-form-group">
            <label>Spasi Daftar Lampiran:</label>
            <select value={form.spasiLampiran} onChange={set("spasiLampiran")}>
              <option value="1.0">1.0 (Rapat)</option>
              <option value="1.15">1.15</option>
              <option value="1.5">1.5 (Standar)</option>
              <option value="2.0">2.0 (Renggang)</option>
            </select>
          </div>
          <div className="ug-form-group">
            <label>Isi Lampiran (Bisa Enter):</label>
            <textarea rows={8} value={form.lampiran} onChange={set("lampiran")}/>
          </div>

          {/* Tombol generate */}
          <button
            className="ug-btn"
            onClick={generatePDF}
            disabled={loading}
          >
            {loading ? "⏳ Sedang memproses PDF..." : "⬇ Unduh PDF Undangan"}
          </button>
        </div>

        {/* ── Panel Preview — identik dengan panel-preview asli ── */}
        {!isMobile && (
          <div className="ug-panel-preview">
            {/* #dokumen-cetak — HTML persis dari aslinya, dirender via dangerouslySetInnerHTML */}
            <div
              id="dokumen-cetak"
              ref={dokumenRef}
              dangerouslySetInnerHTML={{ __html: HTML_DOKUMEN_CETAK }}
            />
          </div>
        )}

        {/* Mobile: hanya tombol, tanpa preview */}
        {isMobile && (
          <div style={{ padding:20 }}>
            <div style={{ background:"#fff3cd", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#856404", marginBottom:12 }}>
              ℹ️ Preview tidak tersedia di mobile. Isi form lalu tekan tombol Unduh untuk menghasilkan PDF.
            </div>
            <button
              className="ug-btn"
              onClick={generatePDF}
              disabled={loading}
              style={{ position:"static" }}
            >
              {loading ? "⏳ Sedang memproses PDF..." : "⬇ Unduh PDF Undangan"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}