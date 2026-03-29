/**
 * UndanganGenerator.jsx — Prokopim Hibot v2.0
 * Generator PDF Undangan Resmi Wali Kota Tarakan
 *
 * GAMBAR STATIS — letakkan di folder public/:
 *   public/image001.jpg   → Logo Garuda Pancasila (kop surat)
 *   public/stempel.png    → Stempel Wali Kota Tarakan
 *   public/image.jpeg     → Tanda tangan Wali Kota
 *
 * Library html2pdf.js dimuat dari CDN (cdnjs.cloudflare.com)
 * saat tombol generate diklik — tidak perlu install npm.
 */

import React, { useState, useRef, useEffect } from "react";

const NAVY = "#0A1628";
const GOLD = "#C9A84C";

// ── Muat html2pdf.js dari CDN ──────────────────────────────
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
  // ── State form ──────────────────────────────────────────
  const [form, setForm] = useState({
    tanggalSurat:   "Tarakan, " + new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
    nomor:          "8400/XXX/SETDA/" + new Date().getFullYear(),
    sifat:          "Biasa",
    lampiranCount:  "1 (satu) halaman",
    yth:            "(daftar terlampir)",
    waktuAcara:     "",
    pukul:          "14.00 WITA s/d selesai",
    tempat:         "Ruang Rapat Wali Kota",
    acara:          "1. ...;\n2. ...; dan\n3. Hal-hal lain yang dianggap perlu.",
    narahubung:     "Kasubbag Protokol (0811-5961-116)",
    pakaian:        "PDH Batik Daerah/menyesuaikan",
    catatan:        "Hadir 15 menit sebelum acara dimulai.",
    jenisTtd:       "tte",
    pilihanCetak:   "semua",
    judulLampiran:  "DAFTAR UNDANGAN",
    spasiLampiran:  "1.5",
    lampiran:       "1. Asisten Pemerintahan dan Kesejahteraan Rakyat;\n2. Kepala Bagian Protokol dan Komunikasi Pimpinan;",
  });

  const [loading, setLoading] = useState(false);
  const cetakRef = useRef(null);

  const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  // ── TTD content berdasarkan pilihan ─────────────────────
  const ttdContent = () => {
    if (form.jenisTtd === "scan") {
      return `
        <img src="/stempel.png"  style="position:absolute;right:140px;top:-20px;width:145px;z-index:1;mix-blend-mode:multiply;" onerror="this.style.display='none'">
        <img src="/image.jpeg"   style="position:absolute;right:30px;top:-20px;height:140px;z-index:2;mix-blend-mode:multiply;" onerror="this.style.display='none'" alt="TTD">
      `;
    }
    if (form.jenisTtd === "tte") {
      return '<br><br><span class="tte-marker">${ttd_pengirim}</span><br><br>';
    }
    return "<br><br><br>";
  };

  // ── Bangun HTML dokumen cetak ────────────────────────────
  const buildDocHtml = () => {
    const showLampiran = form.pilihanCetak !== "utama";
    const catatanHtml  = form.catatan.trim()
      ? `<div id="wadah_catatan"><b><u>catatan:</u></b><br><span style="white-space:pre-wrap">${form.catatan}</span></div>`
      : "";

    return `
      <div class="halaman-a4">
        <div class="kop">
          <img src="/image001.jpg" alt="Garuda Pancasila"
            onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/National_emblem_of_Indonesia_Garuda_Pancasila.svg/300px-National_emblem_of_Indonesia_Garuda_Pancasila.svg.png'">
          <div class="kop-teks">WALI KOTA TARAKAN</div>
        </div>

        <div class="tanggal-kanan">${form.tanggalSurat}</div>

        <table class="tabel-info">
          <tr><td class="col-label">Nomor</td><td class="col-titikdua">:</td><td>${form.nomor}</td></tr>
          <tr><td>Sifat</td><td>:</td><td>${form.sifat}</td></tr>
          <tr><td>Lampiran</td><td>:</td><td>${form.lampiranCount}</td></tr>
          <tr><td>Hal</td><td>:</td><td><b><u>Undangan</u></b></td></tr>
        </table>

        <div class="tujuan-surat">
          Yth:<br>
          <b><span style="white-space:pre-wrap">${form.yth}</span></b><br>
          di-<br><b>TARAKAN</b>
        </div>

        <div class="paragraf-indent">
          Mengharapkan dengan hormat kehadiran Bapak/Ibu/Saudara (i) pada:
        </div>

        <table class="tabel-acara">
          <tr><td class="col-label-acara">hari/tanggal</td><td class="col-titikdua">:</td><td>${form.waktuAcara}</td></tr>
          <tr><td>pukul</td><td>:</td><td>${form.pukul}</td></tr>
          <tr><td>tempat</td><td>:</td><td>${form.tempat}</td></tr>
          <tr><td>acara</td><td>:</td><td><b><div style="white-space:pre-wrap">${form.acara}</div></b></td></tr>
        </table>

        <div class="paragraf-indent">
          Demikian, atas perhatian serta kehadirannya diucapkan terima kasih.
        </div>

        <div class="area-ttd">
          WALI KOTA TARAKAN<br>
          <div style="min-height:80px;position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;">
            ${ttdContent()}
          </div>
          <b>dr. H. KHAIRUL, M.Kes.</b>
        </div>

        <div class="area-kiri-bawah">
          <b><u>Narahubung:</u></b><br>
          <span>${form.narahubung}</span><br>
          <b><u>Pakaian:</u></b><br>
          <span>${form.pakaian}</span><br>
          ${catatanHtml}
        </div>

        <div class="footer-alamat">
          Jalan Kalimantan No. 1, Kota Tarakan<br>
          Telp. (0551) 21620, 34320 Fax. (0551) 23782
        </div>
      </div>

      ${showLampiran ? `
      <div class="halaman-a4 html2pdf__page-break">
        <div style="margin-bottom:15px;">LAMPIRAN SURAT</div>
        <table style="border-collapse:collapse;margin-bottom:25px;">
          <tr><td style="width:70pt;">Nomor</td><td style="width:15pt;">:</td><td>${form.nomor}</td></tr>
        </table>
        <div style="text-align:center;margin-bottom:20px;">
          <b><u>${form.judulLampiran}</u></b>
        </div>
        <div style="white-space:pre-wrap;line-height:${form.spasiLampiran};margin-bottom:20px;">${form.lampiran}</div>
        <div class="area-ttd" style="margin-top:30px;">
          WALI KOTA TARAKAN<br>
          <div style="min-height:80px;position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;">
            ${ttdContent()}
          </div>
          <b>dr. H. KHAIRUL, M.Kes.</b>
        </div>
      </div>` : ""}
    `;
  };

  // ── Generate PDF ─────────────────────────────────────────
  const generatePDF = async () => {
    setLoading(true);
    if (showT) showT("Sedang menyiapkan PDF...", "ok");
    try {
      const html2pdf = await loadHtml2Pdf();

      // Buat container tersembunyi
      const container = document.createElement("div");
      container.id = "dokumen-cetak";
      container.style.cssText = "position:fixed;left:-9999px;top:0;z-index:-1;";

      // ── CSS persis dari undangan.html asli ──
      const style = document.createElement("style");
      style.textContent = `
        #dokumen-cetak, #dokumen-cetak * { font-family: Arial, Helvetica, sans-serif !important; }
        #dokumen-cetak { width: 210mm; background: transparent; }
        .halaman-a4 { width:210mm; min-height:297mm; background:white; padding:20mm 20mm 20mm 25mm; box-sizing:border-box; font-size:11pt; color:black; line-height:1.5; position:relative; }
        .kop { text-align:center; margin-bottom:25px; }
        .kop img { width:88px; margin-bottom:5px; }
        .kop-teks { font-size:20pt; font-weight:bold; margin-top:5px; letter-spacing:0.5px; }
        .tanggal-kanan { text-align:right; margin-bottom:15px; }
        .tabel-info { border-collapse:collapse; width:100%; margin-bottom:15px; }
        .tabel-info td { vertical-align:top; padding:2px 0; }
        .col-label { width:70pt; }
        .col-titikdua { width:15pt; text-align:center; }
        .tujuan-surat { margin-bottom:15px; line-height:1.5; }
        .paragraf-indent { text-align:justify; text-indent:36.75pt; margin-bottom:5px; margin-top:10px; }
        .tabel-acara { border-collapse:collapse; width:100%; margin-bottom:10px; }
        .tabel-acara td { vertical-align:top; padding:2px 0; }
        .col-label-acara { width:113pt; }
        .area-ttd { float:right; width:250px; text-align:center; margin-top:15px; position:relative; }
        .area-kiri-bawah { clear:both; margin-top:20px; line-height:1.5; }
        .footer-alamat { position:absolute; bottom:20mm; left:0; right:0; text-align:center; font-size:10pt; line-height:1.3; }
        .tte-marker { color:black; font-family:monospace !important; padding:2px 5px; border-radius:3px; font-weight:bold; }
        .html2pdf__page-break { page-break-before:always; }
      `;
      container.appendChild(style);
      container.innerHTML += buildDocHtml();
      document.body.appendChild(container);

      const nomor = form.nomor.replace(/\//g, "-");
      const suffix = form.jenisTtd === "tte" ? "_TTE" : form.jenisTtd === "scan" ? "_Scan" : "";
      const prefix = form.pilihanCetak === "utama" ? "Undangan_Utama" : "Undangan";
      const namaFile = `${prefix}${suffix}_${nomor}.pdf`;

      await html2pdf().set({
        margin:      0,
        filename:    namaFile,
        image:       { type: "jpeg", quality: 1 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true },
        jsPDF:       { unit: "mm", format: "a4", orientation: "portrait" },
      }).from(container).save();

      document.body.removeChild(container);
      if (showT) showT("PDF berhasil diunduh ✓", "ok");
    } catch (err) {
      if (showT) showT("Gagal: " + err.message, "error");
      else alert("Gagal membuat PDF: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Field helper ─────────────────────────────────────────
  const Field = ({ label, id, children, hint }) => (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={id} style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
        {label}
      </label>
      {children}
      {hint && <span style={{ fontSize: 10, color: "#94A3B8", display: "block", marginTop: 3 }}>{hint}</span>}
    </div>
  );

  const inputStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 8,
    border: "1.5px solid #E2E8F0", fontSize: 13, fontFamily: "inherit",
    boxSizing: "border-box", background: "white", color: "#1E293B",
  };
  const taStyle = { ...inputStyle, resize: "vertical" };

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", gap: 0, height: "calc(100vh - 60px)", overflow: "hidden",
      flexDirection: isMobile ? "column" : "row" }}>

      {/* ── Panel Form (kiri) ── */}
      <div style={{ width: isMobile ? "100%" : 380, flexShrink: 0, overflowY: "auto",
        background: "white", borderRight: "1px solid #E2E8F0", padding: "16px 18px" }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${NAVY}, #1E3A5F)`, borderRadius: 12,
          padding: "14px 16px", marginBottom: 16, color: "white" }}>
          <div style={{ fontSize: 11, color: GOLD, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>
            Prokopim Hibot
          </div>
          <div style={{ fontSize: 16, fontWeight: 900 }}>📄 Generator Undangan Resmi</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
            Isi form → Preview langsung → Unduh PDF
          </div>
        </div>

        {/* Pilihan cetak */}
        <div style={{ background: "#EFF6FF", borderRadius: 10, padding: "10px 12px", border: "1px solid #BFDBFE", marginBottom: 14 }}>
          <Field label="Pilihan Cetak PDF" id="in_pilihanCetak">
            <select id="in_pilihanCetak" value={form.pilihanCetak} onChange={set("pilihanCetak")} style={inputStyle}>
              <option value="semua">Semua Halaman (Utama + Lampiran)</option>
              <option value="utama">Hanya Halaman Utama</option>
            </select>
          </Field>
        </div>

        {/* Data surat */}
        <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Data Surat</div>
        <Field label="Tempat, Tanggal Surat" id="in_tanggalSurat">
          <input id="in_tanggalSurat" value={form.tanggalSurat} onChange={set("tanggalSurat")} style={inputStyle}/>
        </Field>
        <Field label="Nomor Surat" id="in_nomor">
          <input id="in_nomor" value={form.nomor} onChange={set("nomor")} style={inputStyle}/>
        </Field>
        <Field label="Sifat" id="in_sifat">
          <input id="in_sifat" value={form.sifat} onChange={set("sifat")} style={inputStyle}/>
        </Field>
        <Field label="Lampiran" id="in_lampiranCount">
          <input id="in_lampiranCount" value={form.lampiranCount} onChange={set("lampiranCount")} style={inputStyle}/>
        </Field>

        <hr style={{ border: 0, borderTop: "1px dashed #E2E8F0", margin: "14px 0" }}/>

        {/* Tujuan & isi */}
        <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Tujuan & Isi Acara</div>
        <Field label="Yth (Tujuan Surat)" id="in_yth">
          <textarea id="in_yth" rows={2} value={form.yth} onChange={set("yth")} style={taStyle}/>
        </Field>
        <Field label="Hari / Tanggal Acara" id="in_waktuAcara">
          <input id="in_waktuAcara" value={form.waktuAcara} onChange={set("waktuAcara")} style={inputStyle} placeholder="Contoh: Kamis, 3 April 2026"/>
        </Field>
        <Field label="Pukul" id="in_pukul">
          <input id="in_pukul" value={form.pukul} onChange={set("pukul")} style={inputStyle}/>
        </Field>
        <Field label="Tempat Acara" id="in_tempat">
          <input id="in_tempat" value={form.tempat} onChange={set("tempat")} style={inputStyle}/>
        </Field>
        <Field label="Nama / Susunan Acara" id="in_acara" hint="Tekan Enter untuk baris baru">
          <textarea id="in_acara" rows={4} value={form.acara} onChange={set("acara")} style={taStyle}/>
        </Field>

        <hr style={{ border: 0, borderTop: "1px dashed #E2E8F0", margin: "14px 0" }}/>

        {/* Keterangan tambahan */}
        <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Keterangan Tambahan</div>
        <Field label="Narahubung & No. HP" id="in_narahubung">
          <input id="in_narahubung" value={form.narahubung} onChange={set("narahubung")} style={inputStyle}/>
        </Field>
        <Field label="Pakaian" id="in_pakaian">
          <input id="in_pakaian" value={form.pakaian} onChange={set("pakaian")} style={inputStyle}/>
        </Field>
        <Field label="Catatan (kosongkan jika tidak ada)" id="in_catatan">
          <textarea id="in_catatan" rows={2} value={form.catatan} onChange={set("catatan")} style={taStyle}/>
        </Field>

        <hr style={{ border: 0, borderTop: "1px dashed #E2E8F0", margin: "14px 0" }}/>

        {/* Tanda tangan */}
        <div style={{ background: "#FFFBEB", borderRadius: 10, padding: "10px 12px", border: "1px solid #FDE68A", marginBottom: 14 }}>
          <Field label="Jenis Tanda Tangan" id="in_jenisTtd">
            <select id="in_jenisTtd" value={form.jenisTtd} onChange={set("jenisTtd")} style={inputStyle}>
              <option value="kosong">Kosong (Ruang TTD Basah)</option>
              <option value="scan">Scan (TTD + Stempel otomatis)</option>
              <option value="tte">TTE (Variabel BSrE)</option>
            </select>
          </Field>
          {form.jenisTtd === "scan" && (
            <div style={{ fontSize: 11, color: "#92400E", marginTop: 4 }}>
              ⚠️ Pastikan <code>stempel.png</code> dan <code>image.jpeg</code> ada di folder <code>public/</code>
            </div>
          )}
        </div>

        {/* Lampiran */}
        {form.pilihanCetak === "semua" && <>
          <hr style={{ border: 0, borderTop: "1px dashed #E2E8F0", margin: "14px 0" }}/>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Halaman Lampiran</div>
          <Field label="Judul Lampiran" id="in_judulLampiran">
            <input id="in_judulLampiran" value={form.judulLampiran} onChange={set("judulLampiran")} style={inputStyle}/>
          </Field>
          <Field label="Spasi Daftar Lampiran" id="in_spasiLampiran">
            <select id="in_spasiLampiran" value={form.spasiLampiran} onChange={set("spasiLampiran")} style={inputStyle}>
              <option value="1.0">1.0 (Rapat)</option>
              <option value="1.15">1.15</option>
              <option value="1.5">1.5 (Standar)</option>
              <option value="2.0">2.0 (Renggang)</option>
            </select>
          </Field>
          <Field label="Isi Lampiran" id="in_lampiran" hint="Tekan Enter untuk baris baru">
            <textarea id="in_lampiran" rows={6} value={form.lampiran} onChange={set("lampiran")} style={taStyle}/>
          </Field>
        </>}

        {/* Tombol generate */}
        <button
          onClick={generatePDF}
          disabled={loading}
          style={{
            width: "100%", padding: "13px", borderRadius: 11, border: "none",
            background: loading ? "#94A3B8" : `linear-gradient(135deg, ${NAVY}, #1E3A5F)`,
            color: "white", fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
            marginTop: 8, position: "sticky", bottom: 0,
            boxShadow: loading ? "none" : "0 4px 16px rgba(10,22,40,0.3)",
          }}
        >
          {loading ? "⏳ Memproses PDF..." : "⬇ Unduh PDF Undangan"}
        </button>
      </div>

      {/* ── Panel Preview (kanan) ── */}
      {!isMobile && (
        <div style={{ flex: 1, overflowY: "auto", background: "#525659", display: "flex",
          flexDirection: "column", alignItems: "center", padding: "20px 20px 40px" }}>

          {/* Label preview */}
          <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 14px",
            color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, marginBottom: 16, letterSpacing: 1 }}>
            PRATINJAU — Tampilan aktual PDF mungkin sedikit berbeda
          </div>

          {/* Kertas A4 preview */}
          <div style={{
            width: 595, background: "white", padding: "75px 75px 75px 95px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)", fontFamily: "Arial, sans-serif",
            fontSize: 11.5, color: "black", lineHeight: 1.5, position: "relative",
            minHeight: 842,
          }}>
            {/* Kop */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <img src="/image001.jpg" alt="Garuda" style={{ width: 66, marginBottom: 4 }}
                onError={e => { e.target.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/National_emblem_of_Indonesia_Garuda_Pancasila.svg/300px-National_emblem_of_Indonesia_Garuda_Pancasila.svg.png"; }}/>
              <div style={{ fontSize: 15, fontWeight: "bold", marginTop: 4, letterSpacing: 0.5 }}>WALI KOTA TARAKAN</div>
              <hr style={{ border: 0, borderTop: "2px solid black", marginTop: 6 }}/>
            </div>

            <div style={{ textAlign: "right", marginBottom: 12 }}>{form.tanggalSurat}</div>

            <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 12, fontSize: 11.5 }}>
              <tbody>
                {[["Nomor", form.nomor],["Sifat", form.sifat],["Lampiran", form.lampiranCount],["Hal", <b><u>Undangan</u></b>]].map(([k,v])=>(
                  <tr key={k}><td style={{ width: 70, verticalAlign: "top" }}>{k}</td><td style={{ width: 15, textAlign: "center" }}>:</td><td style={{ verticalAlign: "top" }}>{v}</td></tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginBottom: 12, lineHeight: 1.5 }}>
              Yth:<br/>
              <b><span style={{ whiteSpace: "pre-wrap" }}>{form.yth}</span></b><br/>
              di-<br/><b>TARAKAN</b>
            </div>

            <div style={{ textIndent: 35, textAlign: "justify", marginBottom: 8, marginTop: 8 }}>
              Mengharapkan dengan hormat kehadiran Bapak/Ibu/Saudara (i) pada:
            </div>

            <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 8, fontSize: 11.5 }}>
              <tbody>
                {[["hari/tanggal", form.waktuAcara],["pukul", form.pukul],["tempat", form.tempat]].map(([k,v])=>(
                  <tr key={k}><td style={{ width: 90, verticalAlign: "top" }}>{k}</td><td style={{ width: 12, textAlign: "center" }}>:</td><td>{v}</td></tr>
                ))}
                <tr>
                  <td style={{ verticalAlign: "top", width: 90 }}>acara</td>
                  <td style={{ textAlign: "center", width: 12 }}>:</td>
                  <td><b><span style={{ whiteSpace: "pre-wrap" }}>{form.acara}</span></b></td>
                </tr>
              </tbody>
            </table>

            <div style={{ textIndent: 35, textAlign: "justify", marginBottom: 16 }}>
              Demikian, atas perhatian serta kehadirannya diucapkan terima kasih.
            </div>

            {/* TTD preview */}
            <div style={{ float: "right", width: 220, textAlign: "center", marginTop: 10, position: "relative" }}>
              WALI KOTA TARAKAN<br/>
              <div style={{ minHeight: 70, position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                {form.jenisTtd === "scan" && (
                  <>
                    <img src="/stempel.png" alt="Stempel" style={{ position: "absolute", right: 110, top: -15, width: 110, opacity: 0.9, mixBlendMode: "multiply" }} onError={e=>e.target.style.display="none"}/>
                    <img src="/image.jpeg" alt="TTD" style={{ position: "absolute", right: 20, top: -15, height: 105, mixBlendMode: "multiply" }} onError={e=>e.target.style.display="none"}/>
                  </>
                )}
                {form.jenisTtd === "tte" && (
                  <span style={{ fontFamily: "monospace", fontSize: 10, background: "#e9ecef", color: "#0056b3", padding: "2px 5px", borderRadius: 3, fontWeight: "bold" }}>
                    {"${ttd_pengirim}"}
                  </span>
                )}
              </div>
              <b>dr. H. KHAIRUL, M.Kes.</b>
            </div>

            <div style={{ clear: "both", marginTop: 16, lineHeight: 1.5, fontSize: 11.5 }}>
              <b><u>Narahubung:</u></b><br/>
              {form.narahubung}<br/>
              <b><u>Pakaian:</u></b><br/>
              {form.pakaian}<br/>
              {form.catatan.trim() && <>
                <b><u>catatan:</u></b><br/>
                <span style={{ whiteSpace: "pre-wrap" }}>{form.catatan}</span>
              </>}
            </div>

            <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", fontSize: 9.5, color: "#333" }}>
              Jalan Kalimantan No. 1, Kota Tarakan<br/>
              Telp. (0551) 21620, 34320 Fax. (0551) 23782
            </div>
          </div>

          {/* Halaman lampiran preview */}
          {form.pilihanCetak === "semua" && (
            <div style={{
              width: 595, background: "white", padding: "75px 75px 75px 95px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)", fontFamily: "Arial, sans-serif",
              fontSize: 11.5, color: "black", lineHeight: 1.5,
              marginTop: 20, minHeight: 400,
            }}>
              <div style={{ marginBottom: 12 }}>LAMPIRAN SURAT</div>
              <table style={{ borderCollapse: "collapse", marginBottom: 20 }}>
                <tbody>
                  <tr><td style={{ width: 70 }}>Nomor</td><td style={{ width: 15, textAlign: "center" }}>:</td><td>{form.nomor}</td></tr>
                </tbody>
              </table>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <b><u>{form.judulLampiran}</u></b>
              </div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: form.spasiLampiran, marginBottom: 20 }}>
                {form.lampiran}
              </div>
              <div style={{ float: "right", width: 220, textAlign: "center", marginTop: 10 }}>
                WALI KOTA TARAKAN<br/>
                <div style={{ minHeight: 60 }}></div>
                <b>dr. H. KHAIRUL, M.Kes.</b>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}