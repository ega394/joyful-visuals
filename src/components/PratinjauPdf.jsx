/**
 * PratinjauPdf — menampilkan halaman-halaman sebuah PDF (Blob) sebagai gambar.
 *
 * Yang ditampilkan adalah PDF yang SAMA dengan yang diunduh atau dicetak,
 * dirender oleh pdf.js. Di HP dan PWA peramban tidak bisa menampilkan PDF di
 * dalam halaman, jadi iframe tidak dapat dipakai; pdf.js berjalan di mana saja.
 *
 * Juga berisi JendelaPdf: jendela layar penuh dengan tombol Unduh, Bagikan,
 * Cetak, dan Tutup — dipakai di HP/PWA dan dapat juga dibuka di desktop.
 */
import React, { useEffect, useRef, useState } from "react";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.js?url";

let _pdfjs = null;
async function muatPdfjs() {
  if (_pdfjs) return _pdfjs;
  const lib = await import("pdfjs-dist");
  lib.GlobalWorkerOptions.workerSrc = workerUrl;
  _pdfjs = lib;
  return lib;
}

export function PratinjauPdf({ blob, latar = "#525659", jarak = 16 }) {
  const wadah = useRef(null);
  const [lebar, setLebar] = useState(0);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    const el = wadah.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLebar(el.clientWidth));
    ro.observe(el);
    setLebar(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = wadah.current;
    if (!blob || !el || !lebar) return;
    let batal = false, dok = null;
    (async () => {
      try {
        const pdfjs = await muatPdfjs();
        dok = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        const kanvas = [];
        const lebarHal = Math.min(lebar - jarak * 2, 820);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= dok.numPages; n++) {
          const hal = await dok.getPage(n);
          const skala = lebarHal / hal.getViewport({ scale: 1 }).width;
          const vp = hal.getViewport({ scale: skala * dpr });
          const c = document.createElement("canvas");
          c.width = vp.width; c.height = vp.height;
          c.style.cssText = `width:${lebarHal}px;height:${vp.height / dpr}px;background:white;box-shadow:0 4px 15px rgba(0,0,0,.4);display:block;margin:0 auto ${jarak}px;`;
          await hal.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
          if (batal) return;
          kanvas.push(c);
        }
        if (batal) return;
        el.replaceChildren(...kanvas);
        setGalat("");
      } catch (e) {
        if (!batal) setGalat("Pratinjau gagal dimuat: " + (e?.message || e));
      } finally {
        dok?.destroy?.();
      }
    })();
    return () => { batal = true; };
  }, [blob, lebar, jarak]);

  return (
    <div style={{ background: latar, padding: `${jarak}px 0`, minHeight: "100%" }}>
      {galat && <div style={{ color: "#FECACA", fontSize: 12, textAlign: "center", padding: 12 }}>{galat}</div>}
      <div ref={wadah} style={{ width: "100%" }} />
    </div>
  );
}

// ── Tindakan atas berkas PDF ────────────────────────────────────
export function unduhPdf(blob, nama) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nama;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export const bisaBagikan = (blob, nama) => {
  try {
    const f = new File([blob], nama, { type: "application/pdf" });
    return !!(navigator.canShare && navigator.canShare({ files: [f] }));
  } catch { return false; }
};

export async function bagikanPdf(blob, nama) {
  const f = new File([blob], nama, { type: "application/pdf" });
  await navigator.share({ files: [f], title: nama.replace(/\.pdf$/, "") });
}

/**
 * Cetak. Di desktop PDF dimuat ke iframe tersembunyi lalu dialog cetak dibuka.
 * Di HP peramban tidak bisa mencetak PDF dari dalam halaman, jadi PDF dibuka
 * di penampil bawaan perangkat, yang menyediakan tombol cetak sendiri.
 */
export function cetakPdf(blob, diHp) {
  const url = URL.createObjectURL(blob);
  if (diHp) {
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    return;
  }
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  f.src = url;
  f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { window.open(url, "_blank"); } };
  document.body.appendChild(f);
  setTimeout(() => { f.remove(); URL.revokeObjectURL(url); }, 120000);
}

const tombol = (utama) => ({
  flex: "1 1 0", minWidth: 0, padding: "11px 6px", borderRadius: 10, cursor: "pointer",
  border: utama ? "none" : "1.5px solid rgba(255,255,255,.35)",
  background: utama ? "#C9A84C" : "transparent", color: utama ? "#0A1628" : "white",
  fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
});

export function JendelaPdf({ blob, nama, onTutup, diHp, showT }) {
  const bagikan = bisaBagikan(blob, nama);
  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") onTutup(); };
    window.addEventListener("keydown", esc);
    const lama = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = lama; };
  }, [onTutup]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Pratinjau undangan"
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#3B3E41", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", paddingTop: "max(10px, env(safe-area-inset-top))", background: "#0A1628", color: "white", flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>📄 {nama}</span>
        <button onClick={onTutup} aria-label="Tutup"
          style={{ background: "rgba(255,255,255,.12)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✕ Tutup</button>
      </div>
      <div style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
        <PratinjauPdf blob={blob} latar="#3B3E41" jarak={diHp ? 10 : 18} />
      </div>
      <div style={{ display: "flex", gap: 8, padding: "10px 12px", paddingBottom: "max(10px, env(safe-area-inset-bottom))", background: "#0A1628", flexShrink: 0 }}>
        <button style={tombol(true)} onClick={() => { unduhPdf(blob, nama); showT?.("PDF diunduh", "ok"); }}>⬇ Unduh</button>
        {bagikan && (
          <button style={tombol(false)} onClick={() => bagikanPdf(blob, nama).catch((e) => { if (e?.name !== "AbortError") showT?.("Gagal membagikan: " + e.message, "error"); })}>
            📤 Bagikan
          </button>
        )}
        <button style={tombol(false)} onClick={() => cetakPdf(blob, diHp)}>🖨️ Cetak</button>
      </div>
    </div>
  );
}
