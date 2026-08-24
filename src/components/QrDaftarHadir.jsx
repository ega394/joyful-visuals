import React, { useEffect, useMemo, useRef, useState } from "react";
import qrcode from "qrcode-generator";

/**
 * QR Code tautan daftar hadir — digambar sebagai POSTER A4 di atas kanvas.
 *
 * Satu gambar dipakai untuk ketiganya: pratinjau di layar, unduhan PNG, dan
 * lembar cetak. Sebelumnya ketiganya berbeda — unduhannya QR polos tanpa
 * keterangan apa pun, kartu layarnya tidak memuat tanggal dan lokasi, dan
 * lembar cetaknya disusun terpisah. Dengan satu sumber gambar, apa yang
 * terlihat di layar persis itu yang terunduh dan tercetak.
 *
 * Memakai qrcode-generator (tanpa dependensi, ±10 KB) dan digambar di
 * perangkat. Sengaja tidak memakai layanan QR daring: selain menambah
 * ketergantungan jaringan, tautan acaranya jadi ikut terkirim ke pihak ketiga.
 */

const NAVY = "#0A1628", GOLD = "#C9A84C";

// A4 potret pada 150 dpi. Cukup tajam untuk dicetak maupun dikirim lewat
// WhatsApp, tanpa membuat berkasnya membengkak.
const LEBAR = 1240, TINGGI = 1754;

// Tingkat koreksi galat "M" (±15%) — cukup tahan terhadap noda dan lipatan
// pada lembar cetak, tanpa membuat pola QR jadi terlalu rapat untuk dipindai.
function modulQR(teks) {
  const qr = qrcode(0, "M");        // 0 = tipe otomatis menyesuaikan panjang teks
  qr.addData(teks);
  qr.make();
  return qr;
}

// Memenggal teks agar muat pada lebar tertentu, mengembalikan barisnya.
function penggal(ctx, teks, lebarMaks, maksBaris) {
  const kata = String(teks || "").trim().split(/\s+/).filter(Boolean);
  const baris = [];
  let kini = "";
  for (const k of kata) {
    const coba = kini ? kini + " " + k : k;
    if (ctx.measureText(coba).width <= lebarMaks || !kini) kini = coba;
    else { baris.push(kini); kini = k; }
  }
  if (kini) baris.push(kini);
  if (maksBaris && baris.length > maksBaris) {
    const potong = baris.slice(0, maksBaris);
    potong[maksBaris - 1] = potong[maksBaris - 1].replace(/\s*\S*$/, "") + "…";
    return potong;
  }
  return baris;
}

const fmtTanggal = (t) => {
  if (!t) return "";
  const d = new Date(t + "T00:00:00");
  if (isNaN(d.getTime())) return t;
  const HARI  = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
                 "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};

// Menggambar seluruh poster. Dipisah dari komponen supaya mudah diuji dan
// jelas bahwa keluarannya hanya bergantung pada acara + tautan.
export function gambarPoster(kanvas, acara, tautan) {
  const ctx = kanvas.getContext("2d");
  kanvas.width = LEBAR; kanvas.height = TINGGI;

  const F = (ukuran, tebal = "400") =>
    `${tebal} ${ukuran}px Arial, "Liberation Sans", Arimo, Helvetica, sans-serif`;
  const tengah = (teks, y, font, warna) => {
    ctx.font = font; ctx.fillStyle = warna; ctx.textAlign = "center";
    ctx.fillText(teks, LEBAR / 2, y);
  };

  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, LEBAR, TINGGI);

  // Pita atas sebagai penanda instansi
  ctx.fillStyle = NAVY; ctx.fillRect(0, 0, LEBAR, 150);
  ctx.fillStyle = GOLD; ctx.fillRect(0, 150, LEBAR, 10);
  tengah("PEMERINTAH KOTA TARAKAN", 68, F(30, "800"), GOLD);
  tengah("Bagian Protokol dan Komunikasi Pimpinan", 112, F(26, "400"), "#DCE3EE");

  let y = 250;

  // ── Identitas acara ──
  ctx.font = F(56, "800");
  const judul = penggal(ctx, acara.judul || "Daftar Hadir", LEBAR - 160, 3);
  judul.forEach(b => { tengah(b, y, F(56, "800"), NAVY); y += 68; });

  if (acara.subjudul) {
    y += 6;
    ctx.font = F(32, "400");
    penggal(ctx, acara.subjudul, LEBAR - 200, 2)
      .forEach(b => { tengah(b, y, F(32, "400"), "#475569"); y += 42; });
  }

  const meta = [fmtTanggal(acara.tanggal), acara.lokasi].filter(Boolean).join("  ·  ");
  if (meta) {
    y += 14;
    ctx.font = F(30, "700");
    penggal(ctx, meta, LEBAR - 200, 2)
      .forEach(b => { tengah(b, y, F(30, "700"), "#0F172A"); y += 40; });
  }

  // ── QR ──
  // Digambar modul demi modul, bukan dari gambar yang diperbesar, supaya
  // tepinya tetap tajam pada ukuran cetak berapa pun.
  const qr = modulQR(tautan);
  const n = qr.getModuleCount();
  // Dibuat besar dengan sengaja: poster ini ditempel di meja registrasi dan
  // dipindai sambil berdiri, jadi harus terbaca dari beberapa langkah.
  const sisiQR = 780;
  const sel = Math.floor(sisiQR / (n + 8));       // +8 = zona sunyi 4 modul di tiap sisi
  const sisi = sel * (n + 8);
  const qx = Math.round((LEBAR - sisi) / 2);
  const qy = Math.round(y + 40);

  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(qx, qy, sisi, sisi);
  ctx.strokeStyle = "#E2E8F0"; ctx.lineWidth = 3;
  ctx.strokeRect(qx + 1.5, qy + 1.5, sisi - 3, sisi - 3);
  ctx.fillStyle = "#000000";
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c))
        ctx.fillRect(qx + (c + 4) * sel, qy + (r + 4) * sel, sel, sel);

  y = qy + sisi + 84;

  tengah("PINDAI UNTUK MENGISI DAFTAR HADIR", y, F(34, "800"), NAVY);
  y += 58;
  tengah("Arahkan kamera ponsel ke kode di atas", y, F(26, "400"), "#64748B");

  // ── Kode acara ──
  y += 82;
  const kode = String(acara.kode || "");
  ctx.font = F(46, "800");
  const lebarKode = ctx.measureText(kode).width + 92;
  const kx = (LEBAR - lebarKode) / 2;
  ctx.fillStyle = "#F1F5F9";
  ctx.fillRect(kx, y - 48, lebarKode, 76);
  tengah(kode, y, F(46, "800"), NAVY);

  // ── Tautan di kaki halaman ──
  ctx.font = F(22, "400");
  penggal(ctx, tautan, LEBAR - 160, 2)
    .forEach((b, i) => tengah(b, TINGGI - 96 + i * 30, F(22, "400"), "#94A3B8"));

  return kanvas;
}

export default function QrDaftarHadir({ acara, tautan, onClose }) {
  const kanvasRef = useRef(null);
  const [png, setPng] = useState("");

  const namaBerkas = useMemo(() =>
    `QR-${acara.kode}-${String(acara.judul || "acara")
      .replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40)}.png`,
    [acara.kode, acara.judul]);

  useEffect(() => {
    const k = kanvasRef.current;
    if (!k) return;
    gambarPoster(k, acara, tautan);
    setPng(k.toDataURL("image/png"));
  }, [acara, tautan]);

  // Lembar cetak memuat gambar yang sama persis dengan yang tampil dan
  // terunduh, dipasang memenuhi A4 tanpa margin.
  const cetak = () => {
    if (!png) return;
    const w = window.open("", "_blank", "width=820,height=1000");
    if (!w) { alert("Mohon izinkan popup untuk mencetak."); return; }
    const esc = (s) => String(s || "").replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    w.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
<title>QR Daftar Hadir — ${esc(acara.judul)}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; background: white; }
  img { display: block; width: 210mm; height: 297mm; }
</style></head><body><img src="${png}" alt="Poster QR daftar hadir"></body></html>`);
    w.document.close();
    w.focus();
    const img = w.document.querySelector("img");
    // Cetak baru dijalankan setelah gambarnya benar-benar termuat, kalau tidak
    // lembarnya keluar kosong.
    if (img && !img.complete) img.onload = () => w.print();
    else setTimeout(() => w.print(), 250);
  };

  const btn = {
    padding: "11px 14px", borderRadius: 10, border: "1.5px solid #D1D5DB",
    background: "white", cursor: "pointer", fontSize: 13, fontWeight: 700,
    color: "#334155", textDecoration: "none", display: "inline-flex",
    alignItems: "center", justifyContent: "center", gap: 6,
  };

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(10,22,40,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 420,
        maxHeight: "92vh", overflowY: "auto" }}>

        <div style={{ background: `linear-gradient(135deg,${NAVY},#1A2F50)`,
          padding: "16px 18px", borderRadius: "16px 16px 0 0",
          display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: GOLD, fontSize: 10, fontWeight: 800, letterSpacing: 1.4,
              textTransform: "uppercase" }}>Poster QR Daftar Hadir</div>
            <div style={{ color: "white", fontSize: 15, fontWeight: 800, marginTop: 2,
              lineHeight: 1.3, overflowWrap: "anywhere" }}>{acara.judul}</div>
          </div>
          <button onClick={onClose} aria-label="Tutup"
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8,
              padding: "5px 10px", cursor: "pointer", color: "white", fontWeight: 700, flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ padding: "16px 18px 20px" }}>
          {/* Pratinjau adalah poster yang sesungguhnya, diperkecil — bukan
              tampilan lain yang kebetulan mirip. */}
          <canvas ref={kanvasRef} aria-label={`Poster QR daftar hadir ${acara.judul}`}
            style={{ width: "100%", height: "auto", display: "block",
              border: "1.5px solid #E2E8F0", borderRadius: 10 }}/>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
            <a href={png || "#"} download={namaBerkas} style={btn}>⬇ Unduh PNG</a>
            <button onClick={cetak} style={{ ...btn, border: "none", background: NAVY, color: "white" }}>
              🖨️ Cetak A4
            </button>
          </div>

          <div style={{ marginTop: 12, padding: "9px 11px", background: "#F1F5F9", borderRadius: 8,
            fontSize: 11.5, color: "#64748B", lineHeight: 1.6 }}>
            ℹ️ Cetak A4 untuk ditempel di meja registrasi, atau unduh PNG-nya untuk
            dibagikan lewat WhatsApp. Identitas acara sudah menyatu di gambarnya,
            jadi penerima langsung tahu ini daftar hadir acara apa.
          </div>
        </div>
      </div>
    </div>
  );
}
