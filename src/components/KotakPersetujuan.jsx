import React from "react";

/**
 * Kotak persetujuan Kebijakan Privasi & Ketentuan Penggunaan untuk formulir
 * publik (permohonan audiensi /tamu, peminjaman ruangan /pinjamruangan).
 *
 * UU 27/2022 PDP meminta persetujuan yang eksplisit: tidak dicentang lebih
 * dulu, tujuannya disebut, dan tombol kirim baru aktif setelah dicentang.
 * Peladen memeriksa ulang dan menyimpan buktinya (api/_persetujuan.js).
 *
 * Tautan dibuka di tab baru agar isian formulir tidak hilang.
 */
export default function KotakPersetujuan({ id, checked, onChange }) {
  const tautan = { color: "#1E3A6E", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 2 };
  return (
    <label htmlFor={id} style={{
      display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer",
      padding: "12px 14px", margin: "0 0 14px", borderRadius: 12, textAlign: "left",
      border: "1.5px solid " + (checked ? "#1E3A6E" : "#CBD5E1"),
      background: checked ? "#F1F5FB" : "#FFFFFF", transition: "all .15s",
    }}>
      <input
        id={id} type="checkbox" checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 22, height: 22, margin: "1px 0 0", flexShrink: 0, accentColor: "#1E3A6E", cursor: "pointer" }}
      />
      <span style={{ fontSize: 13, lineHeight: 1.6, color: "#1E293B" }}>
        Saya telah membaca dan menyetujui{" "}
        <a href="/privasi" target="_blank" rel="noopener" style={tautan}>Kebijakan Privasi</a>{" "}
        serta tunduk pada{" "}
        <a href="/ketentuan" target="_blank" rel="noopener" style={tautan}>Ketentuan Penggunaan</a>.
        {" "}Saya bersedia nama, nomor WhatsApp, dan instansi saya digunakan untuk memproses permohonan ini
        dan mengirimkan kabar statusnya.
      </span>
    </label>
  );
}
