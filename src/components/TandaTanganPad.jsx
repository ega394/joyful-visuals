import React, { useRef, useEffect, useCallback, useState } from "react";

/**
 * TandaTanganPad — tanda tangan digoreskan langsung di layar.
 *
 * Padanan digital daftar hadir kertas: tidak butuh kamera, bekerja di dalam
 * gedung, dan tidak canggung bagi pejabat yang enggan berswafoto. Kekuatan
 * buktinya setara tanda tangan di kertas — tidak lebih; ia tidak membuktikan
 * identitas, dan menurut UU ITE tergolong tanda tangan elektronik tidak
 * tersertifikasi. Untuk daftar hadir internal itu memang memadai.
 *
 * Hasilnya PNG data URI, bentuk yang sama dengan selfie terkompresi, tetapi
 * disimpan LANGSUNG di sel Google Sheets — bukan diunggah ke Drive. Karena itu
 * ukurannya dijaga di bawah batas sel.
 */

// Batas keras satu sel Google Sheets. Melewatinya membuat baris gagal ditulis.
export const BATAS_SEL = 50000;
// Sasaran kerja, menyisakan ruang aman terhadap batas keras di atas.
const ANGGARAN = 35000;
// Jangan susutkan lebih pendek dari ini — di bawahnya goresan mulai kabur.
const TINGGI_MIN = 90;

const TINTA = "#0A1628";
const NAVY = "#0A1628", RED = "#991B1B", GREEN = "#0D6B4F", AMBER = "#B45309";

/**
 * Memangkas kanvas sampai batas goresan.
 *
 * Tanpa ini tanda tangan tercetak mungil di tengah kotak kosong, sebab orang
 * menandatangani hanya di sebagian kecil bidang yang disediakan.
 */
function pangkas(sumber) {
  const g = sumber.getContext("2d");
  const d = g.getImageData(0, 0, sumber.width, sumber.height).data;
  let x0 = sumber.width, y0 = sumber.height, x1 = -1, y1 = -1;
  for (let p = 3, i = 0; p < d.length; p += 4, i++) {
    if (d[p] > 8) {
      const px = i % sumber.width, py = (i / sumber.width) | 0;
      if (px < x0) x0 = px;
      if (px > x1) x1 = px;
      if (py < y0) y0 = py;
      if (py > y1) y1 = py;
    }
  }
  if (x1 < 0) return null;                       // belum ada goresan sama sekali
  const m = 8;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m);
  x1 = Math.min(sumber.width - 1, x1 + m); y1 = Math.min(sumber.height - 1, y1 + m);
  const keluar = document.createElement("canvas");
  keluar.width = x1 - x0 + 1;
  keluar.height = y1 - y0 + 1;
  keluar.getContext("2d").drawImage(sumber, x0, y0, keluar.width, keluar.height,
                                   0, 0, keluar.width, keluar.height);
  return keluar;
}

function susutkan(sumber, tinggiBaru) {
  const s = tinggiBaru / sumber.height;
  const d = document.createElement("canvas");
  d.width = Math.max(1, Math.round(sumber.width * s));
  d.height = Math.round(tinggiBaru);
  const g = d.getContext("2d");
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(sumber, 0, 0, d.width, d.height);
  return d;
}

/**
 * Pangkas dulu; susutkan HANYA bila melewati anggaran.
 *
 * Menyusutkan tanpa syarat justru merugikan: penyusutan menambah gradasi
 * antialias yang lebih sulit dimampatkan PNG. Terukur pada goresan berukuran
 * wajar, berkasnya membengkak dari 14.738 menjadi 18.310 karakter.
 */
export function eksporTandaTangan(kanvas) {
  const dasar = pangkas(kanvas);
  if (!dasar) return null;
  let kini = dasar;
  let data = kini.toDataURL("image/png");
  let langkah = 0;
  while (data.length > ANGGARAN && kini.height > TINGGI_MIN && langkah < 6) {
    kini = susutkan(kini, Math.max(TINGGI_MIN, Math.round(kini.height * 0.8)));
    data = kini.toDataURL("image/png");
    langkah++;
  }
  return data.length > BATAS_SEL ? null : data;
}

/**
 * Ambang agar goresan dianggap tanda tangan, bukan sekadar ketukan.
 *
 * Diukur dalam piksel CSS, bukan jumlah karakter berkas. Jumlah karakter
 * bergantung kerapatan layar — ponsel ber-DPR 3 menghasilkan berkas jauh lebih
 * besar untuk gerakan yang sama persis — sehingga satu ambang karakter akan
 * ketat di satu perangkat dan longgar di perangkat lain. Piksel CSS sama di
 * mana pun, dan pemisahannya terukur tegas:
 *
 *   satu ketukan          panjang   0 px, diagonal   0 px
 *   tiga ketukan          panjang   0 px, diagonal  40 px
 *   coretan cilik         panjang  25 px, diagonal  18 px
 *   coretan 40 px         panjang  60 px, diagonal  44 px
 *   paraf pendek          panjang 144 px, diagonal 116 px   ← sah
 *   tanda tangan wajar    panjang 478 px, diagonal 243 px   ← sah
 *
 * Ambangnya sengaja tidak ketat: menolak tamu yang sungguh hadir di depan
 * pintu lebih merugikan daripada satu paraf malas yang lolos.
 *
 * Diagonal kotak pembatas dipakai, bukan lebar dan tinggi terpisah, supaya
 * tanda tangan yang tinggi dan ramping — monogram 30×60 — tidak ikut tertolak.
 */
export const PANJANG_MIN  = 100;   // jumlah panjang lintasan seluruh goresan
export const DIAGONAL_MIN = 60;    // diagonal kotak pembatas

export default function TandaTanganPad({ nilai, onChange, tinggi = 170 }) {
  const kanvasRef = useRef(null);
  const ctxRef = useRef(null);
  const menggoresRef = useRef(false);
  const sebelumRef = useRef(null);
  // Diukur dalam piksel CSS sepanjang gerakan, bukan dibaca ulang dari gambar.
  const ukurRef = useRef({ panjang: 0, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  const [adaGoresan, setAdaGoresan] = useState(!!nilai);
  const [ukur, setUkur] = useState({ panjang: 0, diagonal: 0 });
  const cukup = ukur.panjang >= PANJANG_MIN && ukur.diagonal >= DIAGONAL_MIN;

  const siapkan = useCallback((pertahankan) => {
    const k = kanvasRef.current;
    if (!k) return;
    let simpan = null;
    if (pertahankan && k.width > 0) {
      simpan = document.createElement("canvas");
      simpan.width = k.width; simpan.height = k.height;
      simpan.getContext("2d").drawImage(k, 0, 0);
    }
    // Dibatasi 3 supaya kanvas pada ponsel ber-DPR tinggi tidak menjadi
    // gambar raksasa yang lambat dibaca ulang saat dipangkas.
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const kotak = k.getBoundingClientRect();
    k.width = Math.round(kotak.width * dpr);
    k.height = Math.round(kotak.height * dpr);
    const g = k.getContext("2d", { willReadFrequently: true });
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineWidth = 2.2;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = TINTA;
    ctxRef.current = g;
    if (simpan) g.drawImage(simpan, 0, 0, kotak.width, kotak.height);
  }, []);

  useEffect(() => {
    siapkan(false);
    let jeda;
    const onResize = () => {
      clearTimeout(jeda);
      jeda = setTimeout(() => siapkan(true), 180);
    };
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(jeda); window.removeEventListener("resize", onResize); };
  }, [siapkan]);

  const posisi = (ev) => {
    const kotak = kanvasRef.current.getBoundingClientRect();
    return { x: ev.clientX - kotak.left, y: ev.clientY - kotak.top };
  };

  // Kotak pembatas tumbuh mengikuti setiap titik; panjang lintasan hanya
  // bertambah dari perpindahan, sehingga ketukan di tempat tetap bernilai nol.
  const catat = (t, jarak) => {
    const u = ukurRef.current;
    u.panjang += jarak;
    if (t.x < u.x0) u.x0 = t.x;
    if (t.x > u.x1) u.x1 = t.x;
    if (t.y < u.y0) u.y0 = t.y;
    if (t.y > u.y1) u.y1 = t.y;
  };

  const segarkanUkur = () => {
    const u = ukurRef.current;
    const lebar = u.x1 - u.x0, tggi = u.y1 - u.y0;
    setUkur({
      panjang: Math.round(u.panjang),
      diagonal: Number.isFinite(lebar) ? Math.round(Math.hypot(lebar, tggi)) : 0,
    });
  };

  const mulai = (ev) => {
    if (ev.button !== undefined && ev.button !== 0) return;
    ev.preventDefault();
    kanvasRef.current.setPointerCapture(ev.pointerId);
    menggoresRef.current = true;
    const t = posisi(ev);
    catat(t, 0);
    sebelumRef.current = t;
    const g = ctxRef.current;
    g.beginPath();
    g.moveTo(t.x, t.y);
    g.lineTo(t.x + 0.01, t.y);      // ketukan tunggal tetap meninggalkan titik
    g.stroke();
    setAdaGoresan(true);
  };

  // Titik tengah antar-titik dipakai sebagai simpul kurva kuadratik, sehingga
  // goresan mengalir alih-alih patah-patah seperti garis lurus beruntun.
  const lanjut = (ev) => {
    if (!menggoresRef.current) return;
    ev.preventDefault();
    const g = ctxRef.current;
    const daftar = ev.nativeEvent.getCoalescedEvents
      ? ev.nativeEvent.getCoalescedEvents() : [ev.nativeEvent];
    for (const e of daftar) {
      const t = posisi(e);
      const s = sebelumRef.current;
      catat(t, Math.hypot(t.x - s.x, t.y - s.y));
      const tengah = { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.quadraticCurveTo(s.x, s.y, tengah.x, tengah.y);
      g.stroke();
      sebelumRef.current = t;
    }
    segarkanUkur();   // supaya keterangannya hidup selama jari bergerak
  };

  const selesai = (ev) => {
    if (!menggoresRef.current) return;
    menggoresRef.current = false;
    sebelumRef.current = null;
    try { kanvasRef.current.releasePointerCapture(ev.pointerId); } catch { /* sudah lepas */ }
    segarkanUkur();
    const u = ukurRef.current;
    const diagonal = Math.hypot(u.x1 - u.x0, u.y1 - u.y0);
    // Belum cukup → kirim kosong, sehingga tombol Kirim di formulir tetap mati.
    // Titiknya tetap tergambar supaya kanvas tidak terasa tidak menanggapi.
    if (u.panjang < PANJANG_MIN || !(diagonal >= DIAGONAL_MIN)) { onChange(""); return; }
    onChange(eksporTandaTangan(kanvasRef.current) || "");
  };

  const hapus = () => {
    const k = kanvasRef.current, g = ctxRef.current;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, k.width, k.height);
    g.restore();
    setAdaGoresan(false);
    ukurRef.current = { panjang: 0, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    setUkur({ panjang: 0, diagonal: 0 });
    onChange("");
  };

  return (
    <div>
      {/* Tepi kanvas ikut menandakan keadaan: putus-putus saat kosong, kuning
          saat goresannya belum cukup, hijau saat sudah — supaya tamu tahu
          sebelum menekan Kirim, bukan sesudah ditolak. */}
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden",
        background: "white",
        border: `1.5px ${adaGoresan ? "solid" : "dashed"} ${
          !adaGoresan ? "#CBD5E1" : cukup ? GREEN : AMBER}` }}>
        <canvas
          ref={kanvasRef}
          onPointerDown={mulai}
          onPointerMove={lanjut}
          onPointerUp={selesai}
          onPointerCancel={selesai}
          style={{
            display: "block", width: "100%", height: tinggi,
            // Tanpa ini jari menggeser halaman alih-alih menggores, dan
            // tanda tangannya keluar putus-putus.
            touchAction: "none",
            cursor: "crosshair",
          }}
        />
        {!adaGoresan && (
          <>
            <div style={{ position: "absolute", left: 22, right: 22, bottom: 44,
              height: 1, background: "#CBD5E1", pointerEvents: "none" }}/>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 18,
              textAlign: "center", fontSize: 12, color: "#94A3B8", pointerEvents: "none" }}>
              Bubuhkan tanda tangan di sini
            </div>
          </>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7 }}>
        <button type="button" onClick={hapus} disabled={!adaGoresan}
          style={{ padding: "7px 14px", borderRadius: 9, border: `1.5px solid ${NAVY}`,
            background: "white", color: NAVY, fontSize: 12.5, fontWeight: 700,
            cursor: adaGoresan ? "pointer" : "not-allowed", opacity: adaGoresan ? 1 : 0.45 }}>
          Hapus
        </button>
        <span style={{ fontSize: 11.5, fontWeight: cukup ? 700 : 400,
          color: !adaGoresan ? "#94A3B8" : cukup ? GREEN : AMBER }}>
          {!adaGoresan
            ? "Gunakan jari atau stilus"
            : cukup
              ? "✓ Tanda tangan cukup"
              : "Goresan masih terlalu pendek — lanjutkan tanda tangan Anda"}
        </span>
      </div>
      {cukup && !nilai && (
        <div style={{ fontSize: 12, color: RED, marginTop: 6 }}>
          Tanda tangan terlalu besar untuk disimpan. Mohon tekan Hapus lalu bubuhkan lebih ringkas.
        </div>
      )}
    </div>
  );
}
