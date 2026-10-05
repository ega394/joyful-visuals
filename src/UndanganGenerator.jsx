/**
 * UndanganGenerator.jsx — Prokopim Hibot
 *
 * Keluaran berupa PDF berteks asli dengan Arial tertanam (src/lib/undanganPdf.js),
 * sehingga variabel Srikandi (${nomor_naskah} dan seterusnya) tetap bisa diisi.
 * Pratinjau menampilkan PDF yang sama persis dengan yang diunduh atau dicetak.
 */

import React, { useState, useEffect } from "react";
import { buatPdfUndangan, namaBerkasUndangan, sesiDariJam } from "./lib/undanganPdf";
import { PratinjauPdf, JendelaPdf, unduhPdf, cetakPdf } from "./components/PratinjauPdf";
import { userFetch, adminFetch } from "./roomAuth";

// ── Tempat acara ──────────────────────────────────────────────
// Dua ruangan terakhir dikelola layanan Peminjaman Ruangan, jadi ketersediaannya
// diperiksa dan pemesanannya dicatat langsung dari generator ini.
const TEMPAT = ["Ruang Rapat Wali Kota", "Rumah Jabatan Wali Kota", "Ruang Imbaya", "Ruang Kenawai"];
const RUANG_TERKELOLA = { "Ruang Imbaya": "imbaya", "Ruang Kenawai": "kenawai" };
const LABEL_SESI = { Pagi: "Pagi (07.30–12.00)", Siang: "Siang (12.30–16.30)", Full_Day: "Seharian (07.30–16.30)" };
const SESI_BENTROK = { Pagi: ["Pagi", "Full_Day"], Siang: ["Siang", "Full_Day"], Full_Day: ["Pagi", "Siang", "Full_Day"] };


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

export default function UndanganGenerator({ isMobile, showT, user }) {
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
    // Pemesanan ruangan terkelola (Imbaya/Kenawai) — tidak tercetak di surat.
    sesiRuang:     "",      // kosong = mengikuti jam acara
    pesertaRuang:  "",
    namaKegiatanRuang: "",
    pesanRuang:    null,    // { kode, ruang, tanggal, sesi } setelah dipesan
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

  // ── PDF ───────────────────────────────────────────────────────
  const lengkap = () => {
    if (!form.nomor.trim() || !form.tanggalAcaraInput || !form.tempat.trim()) {
      if (showT) showT("Isi minimal: Nomor Surat, Hari/Tanggal Acara, dan Tempat", "warn");
      return false;
    }
    return true;
  };

  const buatPdf = async () => {
    setLoading(true);
    try { return await buatPdfUndangan(form); }
    catch (err) { if (showT) showT("Gagal menyusun PDF: " + err.message, "error"); return null; }
    finally { setLoading(false); }
  };

  const [jendela, setJendela] = useState(null);   // Blob PDF yang sedang dibuka di jendela
  const bukaPratinjau = async () => { if (!lengkap()) return; const b = await buatPdf(); if (b) setJendela(b); };
  const unduhLangsung = async () => {
    if (!lengkap()) return;
    const b = await buatPdf();
    if (b) { unduhPdf(b, namaBerkasUndangan(form)); if (showT) showT("PDF diunduh", "ok"); }
  };
  const cetakLangsung = async () => { if (!lengkap()) return; const b = await buatPdf(); if (b) cetakPdf(b, isMobile); };

  // Pratinjau langsung di desktop: PDF disusun ulang sejenak setelah berhenti mengetik.
  const [pratinjau, setPratinjau] = useState(null);
  useEffect(() => {
    if (isMobile) return;
    let batal = false;
    const t = setTimeout(async () => {
      try { const b = await buatPdfUndangan(form); if (!batal) setPratinjau(b); } catch { /* biarkan pratinjau lama */ }
    }, 700);
    return () => { batal = true; clearTimeout(t); };
  }, [form, isMobile]);

  // ── Ruangan terkelola (Imbaya, Kenawai) ──────────────────────
  const kunciRuang = RUANG_TERKELOLA[form.tempat] || "";
  const sesiOtomatis = sesiDariJam(form.waktuMulai, form.waktuSelesai);
  const sesi = form.sesiRuang || sesiOtomatis;
  const [ruang, setRuang] = useState(null);          // baris tabel rooms
  const [cek, setCek] = useState({ status: "idle" }); // idle | memuat | tersedia | bentrok | galat
  const [memesan, setMemesan] = useState(false);

  useEffect(() => {
    if (!kunciRuang) { setRuang(null); return; }
    let batal = false;
    fetch("/api/room-booking?op=rooms").then(r => r.json()).then(list => {
      if (batal) return;
      setRuang((Array.isArray(list) ? list : []).find(r => String(r.name || "").toLowerCase().includes(kunciRuang)) || false);
    }).catch(() => { if (!batal) setRuang(false); });
    return () => { batal = true; };
  }, [kunciRuang]);

  const muatKetersediaan = async () => {
    if (!ruang || !form.tanggalAcaraInput || !sesi) return;
    setCek({ status: "memuat" });
    try {
      const r = await userFetch(user, `/api/room-booking?month=${form.tanggalAcaraInput.slice(0, 7)}`);
      const rows = r.ok ? await r.json() : [];
      const tgl = form.tanggalAcaraInput;
      const bentrok = (Array.isArray(rows) ? rows : []).filter(b =>
        Number(b.room_id) === Number(ruang.id) && b.start_date <= tgl && b.end_date >= tgl &&
        SESI_BENTROK[sesi].includes(b.session));
      setCek(bentrok.length ? { status: "bentrok", bentrok } : { status: "tersedia" });
    } catch (e) {
      setCek({ status: "galat", pesan: e.message });
    }
  };
  useEffect(() => { setCek({ status: "idle" }); if (ruang && form.tanggalAcaraInput && sesi) muatKetersediaan(); }, [ruang, form.tanggalAcaraInput, sesi]);

  const namaKegiatanBawaan = () => {
    const baris = (form.acara || "").split("\n").map(x => x.replace(/^\d+\.\s*/, "").replace(/[;.]\s*(dan|atau)?\s*$/i, "").trim())
      .find(x => x && !/^\.+$/.test(x) && !/^hal-hal lain/i.test(x));
    return baris || "Kegiatan Wali Kota Tarakan";
  };

  const pesanRuang = async () => {
    const nama = (form.namaKegiatanRuang || namaKegiatanBawaan()).trim();
    const peserta = parseInt(form.pesertaRuang, 10);
    if (!peserta || peserta < 1) { if (showT) showT("Isi perkiraan jumlah peserta untuk pemesanan ruangan", "warn"); return; }
    if (!window.confirm(`Pesan ${ruang.name} pada ${form.tanggalAcaraInput}, sesi ${LABEL_SESI[sesi]}, untuk "${nama}"?\n\nPemesanan internal langsung disetujui dan slot tertutup bagi pemohon lain.`)) return;
    setMemesan(true);
    try {
      const r = await adminFetch(user, "/api/room-booking?op=internal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: ruang.id, date: form.tanggalAcaraInput, session: sesi, event_name: nama, participant_count: peserta }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setForm(p => ({ ...p, pesanRuang: { kode: j.booking_code, ruang: ruang.name, tempat: form.tempat, tanggal: form.tanggalAcaraInput, sesi } }));
      if (showT) showT(`${ruang.name} dipesan — kode ${j.booking_code}`, "ok");
      muatKetersediaan();
    } catch (e) {
      if (showT) showT("Pemesanan gagal: " + e.message, "error");
    } finally {
      setMemesan(false);
    }
  };

  const [tempatLain, setTempatLain] = useState(() => !!form.tempat && !TEMPAT.includes(form.tempat));
  useEffect(() => { if (form.tempat && !TEMPAT.includes(form.tempat)) setTempatLain(true); }, [form.tempat]);

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
              <div style={{ marginBottom: 12 }}>
                <Label text="Tempat Acara" required/>
                <select className="ug-input" style={inputSt}
                  value={tempatLain ? "__lain" : (TEMPAT.includes(form.tempat) ? form.tempat : "")}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__lain") { setTempatLain(true); setForm(p => ({ ...p, tempat: TEMPAT.includes(p.tempat) ? "" : p.tempat })); }
                    else { setTempatLain(false); setForm(p => ({ ...p, tempat: v })); }
                  }}>
                  <option value="">— Pilih tempat —</option>
                  {TEMPAT.map(t => <option key={t} value={t}>{t}</option>)}
                  <option value="__lain">Lainnya (ketik sendiri)</option>
                </select>
                {tempatLain && <input className="ug-input" style={{ ...inputSt, marginTop: 6 }} placeholder="Ketik tempat acara" value={form.tempat} onChange={set("tempat")}/>}
              </div>
              {kunciRuang && (
                <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, border: "1.5px solid #CBD5E1", background: "white" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, marginBottom: 8 }}>🏛️ Kalender Peminjaman Ruangan</div>
                  {ruang === null && <div style={{ fontSize: 12, color: "#64748B" }}>Memuat data ruangan…</div>}
                  {ruang === false && <div style={{ fontSize: 12, color: "#B91C1C" }}>{form.tempat} tidak ditemukan pada layanan Peminjaman Ruangan.</div>}
                  {ruang && (!form.tanggalAcaraInput || !sesiOtomatis) && <div style={{ fontSize: 12, color: "#64748B" }}>Isi tanggal dan pukul acara untuk melihat ketersediaan.</div>}
                  {ruang && form.tanggalAcaraInput && sesiOtomatis && (<>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11.5, color: "#475569", fontWeight: 700 }}>Sesi</span>
                      <select className="ug-input" style={{ ...inputSt, width: "auto", flex: 1, padding: "6px 8px", fontSize: 12 }}
                        value={sesi} onChange={(e) => setForm(p => ({ ...p, sesiRuang: e.target.value === sesiOtomatis ? "" : e.target.value }))}>
                        {Object.entries(LABEL_SESI).map(([k, v]) => <option key={k} value={k}>{v}{k === sesiOtomatis ? " — sesuai jam acara" : ""}</option>)}
                      </select>
                    </div>
                    {cek.status === "memuat" && <div style={{ fontSize: 12, color: "#64748B" }}>Memeriksa ketersediaan…</div>}
                    {cek.status === "galat" && <div style={{ fontSize: 12, color: "#B91C1C" }}>Gagal memeriksa: {cek.pesan} <button onClick={muatKetersediaan} style={{ border: "none", background: "none", color: NAVY, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Coba lagi</button></div>}
                    {cek.status === "bentrok" && (
                      <div style={{ fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 8, padding: "8px 10px" }}>
                        ⚠️ Sudah terpakai pada sesi ini:
                        {cek.bentrok.map(b => (
                          <div key={b.id} style={{ marginTop: 4, color: "#78350F" }}>
                            • <b>{b.event_name || "Peminjaman"}</b>{b.instansi ? ` — ${b.instansi}` : ""} · {LABEL_SESI[b.session] || b.session} · {b.status === "Approved" ? "disetujui" : "menunggu persetujuan"}
                          </div>
                        ))}
                        <div style={{ marginTop: 6, color: "#78350F" }}>Pilih sesi atau tanggal lain, atau hubungi Pengelola Ruangan.</div>
                      </div>
                    )}
                    {cek.status === "tersedia" && (form.pesanRuang && form.pesanRuang.tanggal === form.tanggalAcaraInput && form.pesanRuang.tempat === form.tempat ? null : (
                      <div>
                        <div style={{ fontSize: 12, color: "#166534", background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                          ✅ {ruang.name} tersedia pada {LABEL_SESI[sesi]}.
                        </div>
                        <Label text="Nama kegiatan di kalender ruangan"/>
                        <input className="ug-input" style={{ ...inputSt, marginBottom: 6 }} placeholder={namaKegiatanBawaan()} value={form.namaKegiatanRuang} onChange={set("namaKegiatanRuang")}/>
                        <Label text="Perkiraan jumlah peserta" required/>
                        <input type="number" min="1" inputMode="numeric" className="ug-input" style={{ ...inputSt, marginBottom: 8 }} value={form.pesertaRuang} onChange={set("pesertaRuang")}/>
                        <button onClick={pesanRuang} disabled={memesan}
                          style={{ width: "100%", padding: "10px 0", borderRadius: 9, border: "none", background: memesan ? "#94A3B8" : "#166534", color: "white", fontWeight: 800, fontSize: 12.5, cursor: memesan ? "not-allowed" : "pointer" }}>
                          {memesan ? "Memesan…" : `📌 Pesan ${ruang.name} (langsung disetujui)`}
                        </button>
                      </div>
                    ))}
                    {form.pesanRuang && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#1E3A8A", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "8px 10px" }}>
                        📌 Dipesan: <b>{form.pesanRuang.ruang}</b>, {form.pesanRuang.tanggal}, {LABEL_SESI[form.pesanRuang.sesi] || form.pesanRuang.sesi} — kode <b>{form.pesanRuang.kode}</b>.
                        {(form.pesanRuang.tanggal !== form.tanggalAcaraInput || form.pesanRuang.tempat !== form.tempat) &&
                          <div style={{ marginTop: 4, color: "#B45309" }}>Tanggal atau tempat undangan sudah berubah dari pemesanan ini. Pemesanan lama tidak ikut pindah — batalkan melalui Pengelola Ruangan bila tidak dipakai.</div>}
                      </div>
                    )}
                  </>)}
                </div>
              )}
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
            <button onClick={bukaPratinjau} disabled={loading}
              style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none", background: loading ? "#94A3B8" : "linear-gradient(135deg," + NAVY + ",#1A2F50)", color: "white", fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: loading ? "none" : "0 4px 14px rgba(10,22,40,0.25)", marginBottom: 8 }}>
              {loading ? <><span style={{ width:16,height:16,borderRadius:"50%",border:"2.5px solid rgba(255,255,255,0.3)",borderTopColor:"white",display:"inline-block",animation:"spin 0.7s linear infinite" }}/>&nbsp;Menyusun PDF...</> : <><span style={{ fontSize:18 }}>👁</span>&nbsp;Pratinjau, Unduh &amp; Bagikan</>}
            </button>

            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button onClick={unduhLangsung} disabled={loading}
                style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "2px solid " + NAVY, background: "white", color: NAVY, fontWeight: 800, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <span style={{ fontSize:16 }}>⬇</span> Unduh PDF
              </button>
              <button onClick={cetakLangsung} disabled={loading}
                style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "2px solid " + NAVY, background: "white", color: NAVY, fontWeight: 800, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <span style={{ fontSize:16 }}>🖨️</span> Cetak
              </button>
            </div>

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
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>👁 Pratinjau PDF</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Sama persis dengan berkas yang diunduh · Arial tertanam</span>
            </div>
            <div style={{ flex: 1, overflow: "auto" }}>
              {pratinjau
                ? <PratinjauPdf blob={pratinjau} />
                : <div style={{ color: "rgba(255,255,255,.6)", fontSize: 13, textAlign: "center", padding: 40 }}>Menyusun pratinjau…</div>}
            </div>
          </div>
        )}
      </div>
      {jendela && <JendelaPdf blob={jendela} nama={namaBerkasUndangan(form)} diHp={isMobile} showT={showT} onTutup={() => setJendela(null)} />}
    </>
  );
}
