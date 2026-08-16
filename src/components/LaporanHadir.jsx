import React, { useState, useEffect, useCallback } from "react";

/**
 * Laporan kehadiran satu acara — pratinjau, cetak A4 berkop, dan unduh CSV.
 *
 * Data diambil lewat action "laporan" pada Apps Script (menuntut token, dan
 * hanya melayani satu acara per permintaan).
 *
 * Soal foto: berkas selfie di Drive bersifat PRIVAT, sehingga URL-nya tidak
 * bisa dipakai langsung sebagai <img> oleh browser. Karena itu foto dikirim
 * sebagai thumbnail base64 — berkas aslinya tetap tidak dibuka aksesnya.
 * Pengambilannya lambat, jadi tidak dinyalakan secara bawaan.
 */

const NAVY = "#0A1628", GOLD = "#C9A84C", GREEN = "#0D6B4F", RED = "#991B1B";
const ABSEN_URL   = import.meta.env.VITE_ABSEN_URL   || "";
const ABSEN_TOKEN = import.meta.env.VITE_ABSEN_TOKEN || "";

const BATAS_FOTO = 80;   // harus sama dengan batas di daftar-hadir.gs

const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export default function LaporanHadir({ acara, user, onClose, showT }) {
  const [data, setData]     = useState(null);
  const [muat, setMuat]     = useState(true);
  const [err, setErr]       = useState("");
  const [pakaiFoto, setPakaiFoto] = useState(false);

  const ambil = useCallback(async (foto) => {
    setMuat(true); setErr("");
    try {
      const u = `${ABSEN_URL}?action=laporan&kode=${encodeURIComponent(acara.kode)}`
        + `&token=${encodeURIComponent(ABSEN_TOKEN)}${foto ? "&foto=1" : ""}`;
      const d = await fetch(u).then(r => r.json());
      if (!d.ok) throw new Error(d.error || "Gagal memuat laporan");
      setData(d);
    } catch (e) {
      setErr(e.message || "Gagal memuat laporan.");
      setData(null);
    }
    setMuat(false);
  }, [acara.kode]);

  useEffect(() => { ambil(false); }, [ambil]);

  const aktif = (k) => (data?.acara?.fieldAktif || []).includes(k);
  const tambahan = data?.acara?.fieldTambahan || [];
  const peserta = data?.peserta || [];

  const toggleFoto = async () => {
    const baru = !pakaiFoto;
    setPakaiFoto(baru);
    await ambil(baru);
  };

  const unduhCsv = () => {
    const kolom = ["No", "Waktu Isi", "Nama"];
    if (aktif("jabatan"))  kolom.push("Jabatan");
    if (aktif("instansi")) kolom.push("Instansi");
    if (aktif("noHP"))     kolom.push("Nomor Ponsel");
    tambahan.forEach(t => kolom.push(t.label));
    if (aktif("selfie"))   kolom.push("Tautan Foto");

    // Bungkus setiap sel dengan tanda kutip & gandakan kutip di dalamnya —
    // nama instansi kerap memuat koma dan akan memecah kolom bila dibiarkan.
    const sel = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const baris = peserta.map((p, i) => {
      const b = [i + 1, p.waktu, p.nama];
      if (aktif("jabatan"))  b.push(p.jabatan);
      if (aktif("instansi")) b.push(p.instansi);
      if (aktif("noHP"))     b.push(p.noHP);
      tambahan.forEach(t => b.push(p.tambahan?.[t.label] || ""));
      if (aktif("selfie"))   b.push(p.fotoUrl);
      return b.map(sel).join(",");
    });

    // BOM di depan supaya Excel membaca UTF-8 dengan benar (nama berimbuhan
    // dan tanda baca Indonesia jadi tidak berantakan).
    const isi = "﻿" + [kolom.map(sel).join(","), ...baris].join("\r\n");
    const url = URL.createObjectURL(new Blob([isi], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Daftar-Hadir-${acara.kode}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showT?.("Berkas CSV diunduh", "ok");
  };

  const cetak = () => {
    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) { alert("Mohon izinkan popup untuk mencetak."); return; }

    const kolom = ["No"];
    if (pakaiFoto && aktif("selfie")) kolom.push("Foto");
    kolom.push("Nama");
    if (aktif("jabatan"))  kolom.push("Jabatan");
    if (aktif("instansi")) kolom.push("Instansi");
    if (aktif("noHP"))     kolom.push("No. Ponsel");
    tambahan.forEach(t => kolom.push(t.label));
    kolom.push("Waktu Isi");

    const baris = peserta.map((p, i) => {
      const sel = [`<td class="c">${i + 1}</td>`];
      if (pakaiFoto && aktif("selfie")) {
        sel.push(`<td class="c">${p.fotoData
          ? `<img class="f" src="${p.fotoData}" alt=""/>`
          : `<span class="kosong">—</span>`}</td>`);
      }
      sel.push(`<td><b>${esc(p.nama)}</b></td>`);
      if (aktif("jabatan"))  sel.push(`<td>${esc(p.jabatan)}</td>`);
      if (aktif("instansi")) sel.push(`<td>${esc(p.instansi)}</td>`);
      if (aktif("noHP"))     sel.push(`<td class="c">${esc(p.noHP)}</td>`);
      tambahan.forEach(t => sel.push(`<td>${esc(p.tambahan?.[t.label] || "")}</td>`));
      sel.push(`<td class="c">${esc(p.waktu)}</td>`);
      return `<tr>${sel.join("")}</tr>`;
    }).join("");

    const now = new Date();
    const cetakTgl = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const cetakJam = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const a = data.acara;

    w.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
<title>Laporan Kehadiran — ${esc(a.judul)}</title>
<style>
@page { size: A4 ${pakaiFoto ? "portrait" : "portrait"}; margin: 1.4cm 1.5cm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 10pt; color: #1a1a1a; margin: 0; }
.kop { display:flex; align-items:center; gap:14px; padding-bottom:10px;
       border-bottom:3px double #0B2545; margin-bottom:10px; }
.kop img { width:56px; height:56px; object-fit:contain; }
.kop h1 { font-size:12pt; font-weight:900; color:#0B2545; margin:0 0 2px; }
.kop h2 { font-size:10pt; font-weight:700; color:#0B2545; margin:0 0 2px; }
.kop p  { font-size:8.5pt; color:#475569; margin:0; }
.jdl { text-align:center; margin:14px 0 10px; }
.jdl h3 { font-size:13pt; font-weight:900; color:#0B2545; margin:0;
          text-transform:uppercase; letter-spacing:1.2px; }
.jdl .sub { font-size:10pt; color:#334155; margin:5px 0 0; font-weight:600; }
.box { background:#F8FAFC; border:1px solid #CBD5E1; border-radius:6px;
       padding:9px 13px; margin-bottom:12px; }
.box .row { display:flex; gap:8px; padding:2px 0; font-size:9.5pt; }
.box .row b { min-width:120px; color:#475569; font-weight:600; }
table { width:100%; border-collapse:collapse; margin-top:4px; }
thead { display: table-header-group; }   /* judul kolom berulang tiap halaman */
tr { page-break-inside: avoid; }
thead th { background:#0B2545; color:white; padding:6px 7px; text-align:left;
           font-size:8.5pt; font-weight:700; border:1px solid #0B2545; }
tbody td { padding:5px 7px; border:1px solid #CBD5E1; font-size:9pt; vertical-align:middle; }
tbody tr:nth-child(even) td { background:#F8FAFC; }
.c { text-align:center; }
.f { width:26mm; height:26mm; object-fit:cover; border-radius:3px; display:block; margin:0 auto; }
.kosong { color:#CBD5E1; }
.empty { text-align:center; padding:26px; color:#94A3B8; font-style:italic; }
.ttd { margin-top:26px; display:flex; justify-content:flex-end; page-break-inside:avoid; }
.ttd-box { text-align:center; min-width:240px; }
.ttd-box .kota { font-size:10pt; color:#334155; margin:0 0 3px; }
.ttd-box .jab { font-size:10pt; font-weight:700; color:#0B2545; margin:0 0 52px; }
.ttd-box .nm { font-size:10.5pt; font-weight:900; color:#0B2545;
               text-decoration:underline; margin:0; }
.foot { margin-top:12px; font-size:7.5pt; color:#94A3B8; text-align:center;
        border-top:1px solid #E2E8F0; padding-top:5px; }
</style></head><body>
<div class="kop">
  <img src="/logo_tarakan.png" alt="" onerror="this.style.display='none'"/>
  <div>
    <h1>PEMERINTAH KOTA TARAKAN</h1>
    <h2>BAGIAN PROTOKOL DAN KOMUNIKASI PIMPINAN</h2>
    <p>Sekretariat Daerah Kota Tarakan</p>
  </div>
</div>

<div class="jdl">
  <h3>Laporan Kehadiran</h3>
  <p class="sub">${esc(a.judul)}</p>
</div>

<div class="box">
  ${a.subjudul ? `<div class="row"><b>Keterangan</b><span>: ${esc(a.subjudul)}</span></div>` : ""}
  ${a.tanggal ? `<div class="row"><b>Tanggal</b><span>: ${esc(a.tanggal)}</span></div>` : ""}
  ${a.lokasi ? `<div class="row"><b>Lokasi</b><span>: ${esc(a.lokasi)}</span></div>` : ""}
  <div class="row"><b>Kode Acara</b><span>: ${esc(a.kode)}</span></div>
  <div class="row"><b>Jumlah Hadir</b><span>: ${peserta.length} orang</span></div>
</div>

${peserta.length
  ? `<table><thead><tr>${kolom.map(k => `<th class="${k === "No" || k === "Foto" ? "c" : ""}">${esc(k)}</th>`).join("")}</tr></thead><tbody>${baris}</tbody></table>`
  : `<div class="empty">Belum ada peserta yang mengisi daftar hadir.</div>`}

<div class="ttd">
  <div class="ttd-box">
    <p class="kota">Tarakan, ${cetakTgl}</p>
    <p class="jab">Mengetahui,</p>
    <p class="nm">${esc(user?.nama || user?.username || "")}</p>
  </div>
</div>

<p class="foot">Dicetak otomatis oleh Sistem Prokopim Hibot pada ${cetakTgl} ${cetakJam} WITA.</p>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  const btn = {
    padding: "10px 14px", borderRadius: 10, border: "1.5px solid #D1D5DB",
    background: "white", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#334155",
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(10,22,40,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 560,
        maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ background: `linear-gradient(135deg,${NAVY},#1A2F50)`, padding: "16px 18px",
          display: "flex", alignItems: "flex-start", gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: GOLD, fontSize: 10, fontWeight: 800, letterSpacing: 1.4,
              textTransform: "uppercase" }}>Laporan Kehadiran</div>
            <div style={{ color: "white", fontSize: 15, fontWeight: 800, marginTop: 2,
              lineHeight: 1.3, overflowWrap: "anywhere" }}>{acara.judul}</div>
          </div>
          <button onClick={onClose} aria-label="Tutup"
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8,
              padding: "5px 10px", cursor: "pointer", color: "white", fontWeight: 700, flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 18px" }}>
          {muat ? (
            <div style={{ textAlign: "center", padding: 30, color: "#64748B" }}>
              {pakaiFoto ? "Mengambil foto peserta… (bisa agak lama)" : "Memuat laporan…"}
            </div>
          ) : err ? (
            <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", color: "#991B1B",
              borderRadius: 10, padding: "12px 14px", fontSize: 13, lineHeight: 1.6 }}>⚠ {err}</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {[
                  { l: "Peserta Hadir", v: peserta.length, c: NAVY },
                  { l: "Kode Acara", v: acara.kode, c: GREEN, mono: true },
                ].map(s => (
                  <div key={s.l} style={{ flex: 1, minWidth: 120, background: "#F8FAFC",
                    borderRadius: 11, padding: "11px 13px", border: "1px solid #E2E8F0", textAlign: "center" }}>
                    <div style={{ fontSize: s.mono ? 16 : 22, fontWeight: 900, color: s.c,
                      fontFamily: s.mono ? "monospace" : undefined, letterSpacing: s.mono ? 2 : 0 }}>{s.v}</div>
                    <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{s.l}</div>
                  </div>
                ))}
              </div>

              {aktif("selfie") && (
                <label style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 14,
                  background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10,
                  padding: "10px 12px", cursor: peserta.length > BATAS_FOTO ? "not-allowed" : "pointer" }}>
                  <input type="checkbox" checked={pakaiFoto} onChange={toggleFoto}
                    disabled={peserta.length > BATAS_FOTO}
                    style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0 }}/>
                  <span style={{ fontSize: 12.5, color: "#334155", lineHeight: 1.6 }}>
                    <b>Sertakan foto selfie</b> pada cetakan
                    {peserta.length > BATAS_FOTO ? (
                      <span style={{ color: RED }}> — tidak tersedia, peserta lebih dari {BATAS_FOTO} orang</span>
                    ) : (
                      <span style={{ color: "#94A3B8" }}> — pengambilan foto memakan waktu lebih lama</span>
                    )}
                  </span>
                </label>
              )}

              {peserta.length === 0 ? (
                <div style={{ textAlign: "center", padding: 24, background: "#F8FAFC",
                  borderRadius: 10, color: "#94A3B8", fontSize: 13 }}>
                  Belum ada peserta yang mengisi daftar hadir.
                </div>
              ) : (
                <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
                  {peserta.slice(0, 8).map((p, i) => (
                    <div key={i} style={{ display: "flex", gap: 9, padding: "8px 11px", fontSize: 12.5,
                      borderBottom: i < Math.min(peserta.length, 8) - 1 ? "1px solid #F1F5F9" : "none" }}>
                      <span style={{ color: "#CBD5E1", minWidth: 18 }}>{i + 1}.</span>
                      <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                        <b style={{ color: "#0F172A" }}>{p.nama}</b>
                        {(p.jabatan || p.instansi) && (
                          <span style={{ color: "#64748B" }}> — {[p.jabatan, p.instansi].filter(Boolean).join(", ")}</span>
                        )}
                      </span>
                    </div>
                  ))}
                  {peserta.length > 8 && (
                    <div style={{ padding: "8px 11px", fontSize: 12, color: "#94A3B8",
                      background: "#F8FAFC", textAlign: "center" }}>
                      …dan {peserta.length - 8} peserta lainnya
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, padding: "12px 18px 16px", borderTop: "1px solid #F1F5F9",
          flexShrink: 0, flexWrap: "wrap" }}>
          <button onClick={unduhCsv} disabled={muat || !!err || peserta.length === 0}
            style={{ ...btn, flex: 1, minWidth: 130,
              opacity: (muat || err || !peserta.length) ? 0.5 : 1 }}>
            ⬇ Unduh CSV
          </button>
          <button onClick={cetak} disabled={muat || !!err}
            style={{ ...btn, flex: 1, minWidth: 130, border: "none", background: NAVY, color: "white",
              opacity: (muat || err) ? 0.5 : 1 }}>
            🖨️ Cetak Laporan
          </button>
        </div>
      </div>
    </div>
  );
}
