/**
 * UndanganGenerator.jsx — Prokopim Hibot v2.0
 * Engine: React Native JSX Rendering (Anti-Blank PDF)
 */

import React, { useState, useEffect, useRef } from "react";

// ── CSS Kertas & Dokumen ──
const CSS_ASLI = `
  #dokumen-cetak, #dokumen-cetak * { font-family: Arial, Helvetica, sans-serif !important; }
  .halaman-a4 { width: 210mm; min-height: 297mm; background: white; padding: 20mm 20mm 20mm 25mm; box-shadow: 0 4px 15px rgba(0,0,0,0.2); margin-bottom: 20px; box-sizing: border-box; font-size: 11pt; color: black; line-height: 1.5; position: relative; }
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
  .tte-marker { color: #0056b3; font-family: monospace !important; background: #e9ecef; padding: 2px 5px; border-radius: 3px; font-weight: bold; }
`;

function loadHtml2Pdf() {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) { resolve(window.html2pdf); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    s.onload  = () => resolve(window.html2pdf);
    s.onerror = () => reject(new Error("Gagal memuat html2pdf.js"));
    document.head.appendChild(s);
  });
}

const formatTanggalIndo = (dateStr) => {
  if (!dateStr) return "";
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

// =====================================================================
// HELPER UI: Desain Input dan Tombol Form
// =====================================================================
const NAVY = "#0A1628";
const GOLD = "#C9A84C";
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

// =====================================================================
// KOMPONEN UTAMA
// =====================================================================
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
  const [iframeSrcDoc, setIframeSrcDoc] = useState("");

  const set = (key) => (e) => setForm((p) => ({...p, [key]: e.target.value}));

  // 1. UPDATE PREVIEW OTOMATIS: Mengambil wujud fisik dokumen cetak
  useEffect(() => {
    const timer = setTimeout(() => {
      const source = document.getElementById("dokumen-cetak");
      if (source) {
        const content = `
          <!DOCTYPE html>
          <html><head><meta charset="utf-8">
          <style>
            body { margin: 0; padding: 20px; background: #525659; display: flex; justify-content: center; }
            ${CSS_ASLI}
          </style></head><body>
          ${source.outerHTML}
          </body></html>
        `;
        setIframeSrcDoc(content);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [form]);

  // 2. FUNGSI UNDUH: Memotret wujud fisik dokumen tanpa perlu manipulasi string
  const generatePDF = async () => {
    if (!form.nomor.trim() || !form.tanggalAcaraInput || !form.tempat.trim()) {
      if (showT) showT("Isi minimal: Nomor Surat, Hari/Tanggal Acara, dan Tempat", "warn");
      return;
    }
    setLoading(true);

    try {
      const html2pdf = await loadHtml2Pdf();
      
      // Ambil dokumen cetak asli dari layar
      const element = document.getElementById("dokumen-cetak");
      
      // Buat kontainer khusus di layar untuk dipotret (z-index ditaruh di belakang)
      const printContainer = document.createElement("div");
      printContainer.style.position = "absolute";
      printContainer.style.left = "0px";
      printContainer.style.top = "0px";
      printContainer.style.zIndex = "-9999";
      printContainer.style.width = "210mm";
      printContainer.style.background = "white"; // Anti putih/transparan
      
      // Kloning isi wujud aslinya ke kontainer
      printContainer.appendChild(element.cloneNode(true));
      document.body.appendChild(printContainer);

      const nomorSurat = form.nomor.replace(/[\/\\]/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
      const suffixTtd  = form.jenisTtd === "tte" ? "_TTE" : (form.jenisTtd === "scan" ? "_Scan" : "");
      const prefix     = form.pilihanCetak === "utama" ? "Undangan_Utama" : "Undangan";
      const namaFile   = `${prefix}${suffixTtd}_${nomorSurat || "Draft"}.pdf`;

      // Foto menjadi PDF
      await html2pdf().set({
        margin: 0, 
        filename: namaFile,
        image: { type: "jpeg", quality: 1 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      }).from(printContainer).save();

      // Hapus kontainer setelah selesai dicetak
      document.body.removeChild(printContainer);

      if (showT) showT("PDF berhasil diunduh: " + namaFile, "ok");
    } catch (err) {
      if (showT) showT("Gagal membuat PDF: " + err.message, "error");
      else alert("Gagal: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    if (window.confirm("Reset semua kolom? Data yang belum disimpan akan hilang.")) setForm(EMPTY);
  };

  const tglText = formatTanggalIndo(form.tanggalAcaraInput);
  const pklText = form.waktuMulai ? (form.waktuSelesai ? `${form.waktuMulai} s.d. ${form.waktuSelesai} WITA` : `${form.waktuMulai} WITA s.d. selesai`) : "";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS_ASLI }} />
      <style dangerouslySetInnerHTML={{ __html: ".ug-input:focus{border-color:"+NAVY+"!important;box-shadow:0 0 0 3px rgba(10,22,40,0.08)} .ug-input::placeholder{color:#CBD5E1} @keyframes spin{to{transform:rotate(360deg)}}" }} />

      <div style={{ display: "flex", height: isMobile ? "auto" : "calc(100vh - 60px)", overflow: "hidden", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

        {/* ══ PANEL KIRI: FORM ══════════════════════════════════════════ */}
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
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}><Label text="Pukul Mulai" required /><input type="time" className="ug-input" style={inputSt} value={form.waktuMulai} onChange={set("waktuMulai")}/></div>
                <div style={{ flex: 1 }}><Label text="Pukul Selesai" hint="Kosong = s.d. selesai"/><input type="time" className="ug-input" style={inputSt} value={form.waktuSelesai} onChange={set("waktuSelesai")}/></div>
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
              {loading ? <><span style={{ width:16,height:16,borderRadius:"50%",border:"2.5px solid rgba(255,255,255,0.3)",borderTopColor:"white",display:"inline-block",animation:"spin 0.7s linear infinite" }}/>&nbsp;Memproses PDF...</> : <><span style={{ fontSize:18 }}>⬇</span>&nbsp;Unduh PDF Undangan</>}
            </button>
            <button onClick={resetForm} style={{ width:"100%",padding:"9px 0",borderRadius:10,border:"1.5px solid #E2E8F0",background:"white",color:"#64748B",fontWeight:600,fontSize:12,cursor:"pointer" }}>🔄 Reset Semua Kolom</button>
          </div>
        </div>

        {/* ══ PANEL KANAN: PREVIEW IFRAME ═══════════════════════════════════════ */}
        {!isMobile && (
          <div style={{ flex: 1, background: "#525659", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ background: "rgba(0,0,0,0.35)", padding: "9px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>👁 Pratinjau Dokumen</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Live Render via React Engine</span>
            </div>
            <iframe title="Preview Undangan" srcDoc={iframeSrcDoc} style={{ flex: 1, border: "none", width: "100%", background: "#525659" }}/>
          </div>
        )}
      </div>

      {/* ══ HIDDEN RENDER: WUJUD FISIK DOKUMEN CETAK ═══════════════════════ */}
      <div style={{ position: "absolute", left: "-9999px", top: 0, width: "210mm", pointerEvents: "none" }}>
        <div id="dokumen-cetak" style={{ backgroundColor: "transparent" }}>
          <div className="halaman-a4">
            <div className="kop">
              <img src="/image001.jpg" alt="Garuda" />
              <div className="kop-teks">WALI KOTA TARAKAN</div>
            </div>
            <div className="tanggal-kanan">{form.tanggalSurat}</div>
            
            <table className="tabel-info">
              <tbody>
                <tr><td className="col-label">Nomor</td><td className="col-titikdua">:</td><td>{form.nomor}</td></tr>
                <tr><td>Sifat</td><td>:</td><td>{form.sifat}</td></tr>
                <tr><td>Lampiran</td><td>:</td><td>{form.lampiranCount}</td></tr>
                <tr><td>Hal</td><td>:</td><td><b><u>Undangan</u></b></td></tr>
              </tbody>
            </table>

            <div className="tujuan-surat">
              Yth:<br/>
              <b><span className="teks-multibaris">{form.yth}</span></b><br/>
              di-<br/>
              <b>TARAKAN</b>
            </div>

            <div className="paragraf-indent">Mengharapkan dengan hormat kehadiran Bapak/Ibu/Saudara (i) pada:</div>

            <table className="tabel-acara">
              <tbody>
                <tr><td className="col-label-acara">hari/tanggal</td><td className="col-titikdua">:</td><td>{tglText}</td></tr>
                <tr><td>pukul</td><td>:</td><td>{pklText}</td></tr>
                <tr><td>tempat</td><td>:</td><td>{form.tempat}</td></tr>
                <tr><td>acara</td><td>:</td><td><b><div className="teks-multibaris">{form.acara}</div></b></td></tr>
              </tbody>
            </table>

            <div className="paragraf-indent">Demikian, atas perhatian serta kehadirannya diucapkan terima kasih.</div>

            <div className="area-ttd">
              WALI KOTA TARAKAN<br/>
              <div style={{ minHeight: 80, position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                {form.jenisTtd === "scan" && (
                  <>
                    <img src="/stempel.png" style={{ position: "absolute", left: 0, top: -30, width: 145, zIndex: 1, mixBlendMode: "multiply" }} alt="" />
                    <img src="/image.jpeg" style={{ position: "absolute", right: 0, top: -30, height: 140, zIndex: 2, mixBlendMode: "multiply" }} alt="" />
                  </>
                )}
                {form.jenisTtd === "tte" && <><br/><br/><span className="tte-marker">${`{ttd_pengirim}`}</span><br/><br/></>}
                {form.jenisTtd === "kosong" && <><br/><br/><br/></>}
              </div>
              <b>dr. H. KHAIRUL, M.Kes.</b>
            </div>

            <div className="area-keterangan">
              {form.showTembusan && <div className="ket-item"><b><u>Tembusan:</u></b><br/><span className="teks-multibaris">{form.tembusan}</span></div>}
              {form.showNarahubung && <div className="ket-item"><b><u>Narahubung:</u></b><br/>{form.narahubung}</div>}
              {form.showPakaian && <div className="ket-item"><b><u>Pakaian:</u></b><br/>{form.pakaian}</div>}
              {form.catatan.trim() !== "" && <div className="ket-item"><b><u>catatan:</u></b><br/><span className="teks-multibaris">{form.catatan}</span></div>}
            </div>

            <div className="footer-alamat">Jalan Kalimantan No. 1, Kota Tarakan<br/>Telp. (0551) 21620, 34320 Fax. (0551) 23782</div>
          </div>

          {form.pilihanCetak !== "utama" && (
            <div className="halaman-a4 html2pdf__page-break">
              <div style={{ marginBottom: 15 }}>LAMPIRAN SURAT</div>
              <table style={{ borderCollapse: "collapse", marginBottom: 25 }}>
                <tbody><tr><td style={{ width: "70pt" }}>Nomor</td><td style={{ width: "15pt" }}>:</td><td>{form.nomor}</td></tr></tbody>
              </table>
              <div style={{ textAlign: "center", marginBottom: 20 }}><b><u>{form.judulLampiran}</u></b></div>
              <div className="teks-multibaris" style={{ lineHeight: form.spasiLampiran, marginBottom: 20 }}>{form.lampiran}</div>
              <div className="area-ttd" style={{ marginTop: 30 }}>
                WALI KOTA TARAKAN<br/>
                <div style={{ minHeight: 80, position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                  {form.jenisTtd === "scan" && (
                    <>
                      <img src="/stempel.png" style={{ position: "absolute", left: 0, top: -30, width: 145, zIndex: 1, mixBlendMode: "multiply" }} alt="" />
                      <img src="/image.jpeg" style={{ position: "absolute", right: 0, top: -30, height: 140, zIndex: 2, mixBlendMode: "multiply" }} alt="" />
                    </>
                  )}
                  {form.jenisTtd === "tte" && <><br/><br/><span className="tte-marker">${`{ttd_pengirim}`}</span><br/><br/></>}
                  {form.jenisTtd === "kosong" && <><br/><br/><br/></>}
                </div>
                <b>dr. H. KHAIRUL, M.Kes.</b>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}