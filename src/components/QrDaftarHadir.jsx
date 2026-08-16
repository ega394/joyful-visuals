import React, { useMemo } from "react";
import qrcode from "qrcode-generator";

/**
 * QR Code tautan daftar hadir — ditampilkan sebagai modal, bisa diunduh
 * atau dicetak untuk ditempel di meja registrasi.
 *
 * Memakai qrcode-generator (tanpa dependensi, ±10 KB) dan dirender di
 * perangkat. Sengaja tidak memakai layanan QR daring: selain menambah
 * ketergantungan jaringan, tautan acaranya jadi ikut terkirim ke pihak ketiga.
 */

const NAVY = "#0A1628", GOLD = "#C9A84C";

// Tingkat koreksi galat "M" (±15%) — cukup tahan terhadap noda/lipatan pada
// lembar cetak, tanpa membuat pola QR jadi terlalu rapat untuk dipindai.
function buatQR(teks, ukuranSel) {
  const qr = qrcode(0, "M");         // 0 = tipe otomatis menyesuaikan panjang teks
  qr.addData(teks);
  qr.make();
  return qr.createDataURL(ukuranSel, 4);
}

export default function QrDaftarHadir({ acara, tautan, onClose }) {
  // Sel besar agar hasil unduhan tetap tajam saat dicetak, bukan sekadar
  // gambar layar yang pecah ketika diperbesar.
  const qrBesar = useMemo(() => buatQR(tautan, 12), [tautan]);
  const qrLayar = useMemo(() => buatQR(tautan, 6),  [tautan]);

  const namaBerkas = `QR-${acara.kode}-${String(acara.judul || "acara")
    .replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40)}.gif`;

  const cetak = () => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { alert("Mohon izinkan popup untuk mencetak."); return; }
    const esc = (s) => String(s || "").replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    w.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
<title>QR Daftar Hadir — ${esc(acara.judul)}</title>
<style>
@page { size: A4 portrait; margin: 2cm; }
body { font-family: Arial, sans-serif; text-align: center; color: #0B2545; margin: 0; }
.kop { font-size: 11pt; font-weight: 700; letter-spacing: .5px; margin-bottom: 2px; }
.sub { font-size: 9.5pt; color: #475569; margin-bottom: 26px; }
h1 { font-size: 21pt; font-weight: 900; margin: 0 0 6px; line-height: 1.25; }
.ket { font-size: 11pt; color: #475569; margin: 0 0 4px; }
.meta { font-size: 10pt; color: #64748B; margin-bottom: 22px; }
img { width: 62mm; height: 62mm; image-rendering: pixelated; }
.ajakan { font-size: 13pt; font-weight: 700; margin-top: 18px; }
.kode { font-family: monospace; font-size: 15pt; font-weight: 700; letter-spacing: 3px; margin-top: 6px; }
.tautan { font-size: 8.5pt; color: #94A3B8; margin-top: 14px; word-break: break-all; }
</style></head><body>
<div class="kop">PEMERINTAH KOTA TARAKAN</div>
<div class="sub">Bagian Protokol dan Komunikasi Pimpinan Setda Kota Tarakan</div>
<h1>${esc(acara.judul)}</h1>
${acara.subjudul ? `<p class="ket">${esc(acara.subjudul)}</p>` : ""}
<p class="meta">${[acara.tanggal, acara.lokasi].filter(Boolean).map(esc).join(" &middot; ")}</p>
<img src="${qrBesar}" alt="QR Daftar Hadir"/>
<div class="ajakan">Pindai untuk mengisi daftar hadir</div>
<div class="kode">${esc(acara.kode)}</div>
<div class="tautan">${esc(tautan)}</div>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const btn = {
    padding: "10px 14px", borderRadius: 10, border: "1.5px solid #D1D5DB",
    background: "white", cursor: "pointer", fontSize: 13, fontWeight: 700,
    color: "#334155", textDecoration: "none", display: "inline-flex",
    alignItems: "center", justifyContent: "center", gap: 6,
  };

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(10,22,40,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 380,
        maxHeight: "92vh", overflowY: "auto" }}>

        <div style={{ background: `linear-gradient(135deg,${NAVY},#1A2F50)`,
          padding: "16px 18px", borderRadius: "16px 16px 0 0",
          display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: GOLD, fontSize: 10, fontWeight: 800, letterSpacing: 1.4,
              textTransform: "uppercase" }}>QR Daftar Hadir</div>
            <div style={{ color: "white", fontSize: 15, fontWeight: 800, marginTop: 2,
              lineHeight: 1.3, overflowWrap: "anywhere" }}>{acara.judul}</div>
          </div>
          <button onClick={onClose} aria-label="Tutup"
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8,
              padding: "5px 10px", cursor: "pointer", color: "white", fontWeight: 700, flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ padding: "18px 18px 20px", textAlign: "center" }}>
          <img src={qrLayar} alt={`QR daftar hadir ${acara.judul}`}
            style={{ width: "100%", maxWidth: 240, imageRendering: "pixelated",
              border: "1.5px solid #E2E8F0", borderRadius: 12, padding: 8, boxSizing: "border-box" }}/>

          <div style={{ fontFamily: "monospace", fontSize: 17, fontWeight: 800, color: NAVY,
            letterSpacing: 3, marginTop: 10 }}>{acara.kode}</div>

          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 8, overflowWrap: "anywhere",
            lineHeight: 1.5 }}>{tautan}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
            {/* download: unduh berkas QR beresolusi cetak, bukan yang tampil di layar */}
            <a href={qrBesar} download={namaBerkas} style={btn}>⬇ Unduh</a>
            <button onClick={cetak} style={{ ...btn, border: "none", background: NAVY, color: "white" }}>
              🖨️ Cetak
            </button>
          </div>

          <div style={{ marginTop: 14, padding: "8px 11px", background: "#F1F5F9", borderRadius: 8,
            fontSize: 11, color: "#64748B", lineHeight: 1.6, textAlign: "left" }}>
            ℹ️ Cetak lalu tempel di meja registrasi. Tamu memindainya dengan kamera
            ponsel — tidak perlu memasang aplikasi apa pun.
          </div>
        </div>
      </div>
    </div>
  );
}
