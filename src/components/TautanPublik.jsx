import React from "react";

/**
 * Deret tautan layanan publik di beranda HP, untuk petugas yang sudah masuk.
 *
 * Halaman masuk sudah menautkan kedua formulir untuk masyarakat; di sini
 * tujuannya berbeda: petugas sering diminta "kirimkan tautannya" oleh tamu
 * atau instansi, jadi selain dibuka, tautannya bisa langsung dibagikan
 * (lembar bagikan bawaan HP) atau disalin bila peramban tidak mendukungnya.
 */

const LAYANAN = [
  {
    jalur: "/tamu",
    label: "Audiensi / Tamu",
    desc: "Permohonan bertemu Pimpinan",
    pesan: "Formulir permohonan audiensi/tamu Pimpinan Kota Tarakan",
    d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6",
  },
  {
    jalur: "/pinjamruangan",
    label: "Peminjaman Ruangan",
    desc: "Ruang rapat Pemkot",
    pesan: "Formulir peminjaman ruang rapat Pemerintah Kota Tarakan",
    d: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 11h.01M15 11h.01",
  },
];

const Glif = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
    <path d={d} />
  </svg>
);
const IKON_BAGIKAN = "M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13";

export default function TautanPublik({ showT }) {
  const bagikan = async (l) => {
    const url = window.location.origin + l.jalur;
    try {
      if (navigator.share) { await navigator.share({ title: l.label, text: l.pesan, url }); return; }
      await navigator.clipboard.writeText(l.pesan + ": " + url);
      showT?.("Tautan disalin");
    } catch (e) {
      // Lembar bagikan yang ditutup pengguna juga berakhir di sini; bukan galat.
      if (e?.name !== "AbortError") window.prompt("Salin tautan ini:", url);
    }
  };
  return (
    <div style={{ margin: "0 0 14px", background: "white", border: "1px solid #E4EAF2", borderRadius: 14, padding: "10px 12px 12px", boxShadow: "0 1px 6px rgba(10,22,40,0.05)" }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#64748B", marginBottom: 8 }}>
        Tautan layanan publik · tanpa akun
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {LAYANAN.map((l) => (
          <div key={l.jalur} style={{ border: "1px solid #E4EAF2", borderRadius: 11, background: "#F8FAFD", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <a href={l.jalur} target="_blank" rel="noopener" style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 10px 8px", textDecoration: "none", color: "#0A1628", flex: 1 }}>
              <span style={{ color: "#B08A2E", marginTop: 1 }}><Glif d={l.d} /></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 800, lineHeight: 1.25 }}>{l.label}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "#64748B", lineHeight: 1.3, marginTop: 2 }}>{l.desc}</span>
              </span>
            </a>
            <button onClick={() => bagikan(l)} aria-label={"Bagikan tautan " + l.label}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 34, border: "none", borderTop: "1px solid #E4EAF2", background: "white", color: "#1E3A6E", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              <Glif d={IKON_BAGIKAN} size={15} /> Bagikan
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
