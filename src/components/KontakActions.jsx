import React from "react";

/**
 * Tombol Telepon + WhatsApp untuk nomor narahubung.
 *
 * Dipakai bersama oleh modul Agenda (field `kontak` berupa teks bebas, mis.
 * "Budi 0812-3456-7890") dan modul Peminjaman Ruangan (field `pic_wa` yang
 * umumnya sudah berupa angka). Karena itu nomornya selalu diekstrak dengan
 * regex, bukan diasumsikan sudah bersih.
 */

// Mengembalikan "" bila tidak ada nomor yang valid, sehingga tombolnya cukup
// disembunyikan — lebih baik daripada menampilkan tombol yang tidak berfungsi.
export function extractPhone(s) {
  const m = String(s || "").match(/(?:\+62|62|0)[\d\s().-]{7,17}\d/);
  if (!m) return "";
  let d = m[0].replace(/[^\d]/g, "");
  if (d.startsWith("62")) d = "0" + d.slice(2);
  return /^0\d{8,13}$/.test(d) ? d : "";
}

// 0812… → 62812… (format wa.me)
export function waNumber(tel) { return tel ? "62" + tel.slice(1) : ""; }

// Seluler Indonesia selalu diawali "08"; selain itu telepon kabel (0551, 021, …)
// → tombol WA disembunyikan karena tidak akan berfungsi.
export function isMobileNumber(tel) { return /^08/.test(tel || ""); }

// Logo WhatsApp (inline SVG, mengikuti warna teks tombol via currentColor).
// SVG dipilih agar tampil identik di semua sistem operasi — emoji dirender
// berbeda-beda tiap OS.
export function WaGlyph({ size = 13 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor"
      aria-hidden="true" focusable="false" style={{ display: "block", flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

export default function KontakActions({ kontak, size = "sm" }) {
  const tel = extractPhone(kontak);
  if (!tel) return null;
  const pad = size === "sm" ? "3px 8px" : "5px 10px";
  const fs  = size === "sm" ? 11 : 13;
  const st  = { padding: pad, borderRadius: 7, textDecoration: "none", fontSize: fs,
                fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap", lineHeight: 1.4 };
  // stopPropagation: tombol ini sering berada di dalam kartu yang bisa diklik
  // untuk membuka/menutup — tanpa ini, menelepon ikut men-toggle kartunya.
  return (
    <span style={{ display: "inline-flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
      <a href={"tel:" + tel} onClick={e => e.stopPropagation()} title={"Telepon " + tel}
        style={{ ...st, background: "#1D4ED8", color: "white" }}>📞 Telepon</a>
      {isMobileNumber(tel) && (
        <a href={"https://wa.me/" + waNumber(tel)} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()} title={"WhatsApp " + tel} aria-label={"WhatsApp " + tel}
          style={{ ...st, background: "#25D366", color: "white",
                   display: "inline-flex", alignItems: "center", gap: 4 }}>
          <WaGlyph size={size === "sm" ? 12 : 14} />WA
        </a>
      )}
    </span>
  );
}
