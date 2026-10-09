import React from "react";

/**
 * Penjaga galat tampilan.
 *
 * Tanpa ini, satu galat saat menggambar halaman (mis. data agenda yang
 * isinya bukan teks) membuat seluruh layar menjadi putih kosong tanpa
 * keterangan apa pun. Penjaga ini menggantinya dengan pesan dan tombol pulih.
 */
export default class PenjagaGalat extends React.Component {
  constructor(props) {
    super(props);
    this.state = { galat: null };
  }

  static getDerivedStateFromError(galat) {
    return { galat };
  }

  componentDidCatch(galat, info) {
    console.error("[PenjagaGalat]", galat, info && info.componentStack);
  }

  render() {
    if (!this.state.galat) return this.props.children;
    const pesan = String((this.state.galat && this.state.galat.message) || this.state.galat).slice(0, 200);
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 20, background: "#F1F5F9", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ background: "white", borderRadius: 16, padding: "28px 24px", maxWidth: 420, width: "100%",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.08)", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#0A1628", marginBottom: 6 }}>
            Terjadi kendala menampilkan halaman
          </div>
          <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, marginBottom: 18 }}>
            Data Anda aman. Silakan muat ulang. Bila terulang, sampaikan keterangan di bawah ini kepada admin.
          </div>
          <button onClick={() => window.location.reload()}
            style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#0A1628",
                     color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 12 }}>
            Muat ulang
          </button>
          <div style={{ fontSize: 11, color: "#94A3B8", wordBreak: "break-word" }}>{pesan}</div>
        </div>
      </div>
    );
  }
}
