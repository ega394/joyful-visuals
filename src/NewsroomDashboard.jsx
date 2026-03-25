import React, { useState } from "react";

export default function NewsroomDashboard({ events, user, showT, isMobile }) {
  const NAVY = "#0A1628";
  const GOLD = "#C9A84C";

  const [selectedEv, setSelectedEv] = useState(null);
  const [poinPenting, setPoinPenting] = useState("");
  const [format, setFormat] = useState("rilis"); // 'rilis' atau 'caption'
  const [loading, setLoading] = useState(false);
  const [hasilAI, setHasilAI] = useState("");

  // Ambil jadwal tayang (disetujui) yang terbaru
  const jadwalTayang = events
    .filter((e) => e.alur === "disetujui")
    .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
    .slice(0, 30); // Ambil 30 terakhir

  const fmtDate = (d) => {
    if (!d) return "";
    const [y, m, dd] = d.split("-");
    const M = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
    return `${dd} ${M[parseInt(m)-1]} ${y}`;
  };

  const generateNews = async () => {
    if (!poinPenting.trim()) {
      showT("Masukkan poin penting atau hasil liputan lapangan dulu", "error");
      return;
    }
    setLoading(true);
    try {
      // Panggil backend AI yang sudah Bapak siapkan di api/ai-newsroom.js
      const res = await fetch("/api/ai-newsroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namaAcara: selectedEv.namaAcara,
          tanggal: fmtDate(selectedEv.tanggal),
          lokasi: selectedEv.lokasi || "Kota Tarakan",
          penyelenggara: selectedEv.penyelenggara,
          poinPenting: poinPenting,
          format: format
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghubungi AI");
      
      setHasilAI(data.result || data.text || "Tidak ada hasil dari AI");
      showT("Berita berhasil diracik AI! 🪄", "ok");
    } catch (err) {
      showT(err.message, "error");
      // Fallback jika API belum nyala (Simulasi)
      setHasilAI(`[DRAF SIMULASI]\n\nPada tanggal ${fmtDate(selectedEv.tanggal)}, bertempat di ${selectedEv.lokasi}, telah berlangsung acara ${selectedEv.namaAcara}.\n\nPoin Utama:\n${poinPenting}\n\n(Catatan: Ini adalah draf simulasi karena koneksi ke API AI terputus. Pastikan file api/ai-newsroom.js sudah terhubung ke OpenAI/Gemini)`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(hasilAI);
    showT("Teks berhasil disalin!", "ok");
  };

  if (selectedEv) {
    return (
      <div style={{ padding: isMobile ? "16px" : "24px", maxWidth: 800, margin: "0 auto" }}>
        <button onClick={() => { setSelectedEv(null); setHasilAI(""); setPoinPenting(""); }} style={{ background:"transparent", border:"none", color:NAVY, fontWeight:700, cursor:"pointer", marginBottom:16, fontSize:14 }}>
          ← Kembali ke Daftar Kegiatan
        </button>
        
        <div style={{ background: "white", borderRadius: 16, padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", border: "1px solid #E2E8F0" }}>
          <div style={{ fontSize: 12, color: GOLD, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>Target Liputan</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: NAVY, marginBottom: 4 }}>{selectedEv.namaAcara}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>📅 {fmtDate(selectedEv.tanggal)} · 📍 {selectedEv.lokasi || "-"}</div>

          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Poin Penting Liputan / Catatan Lapangan 📝</label>
          <textarea 
            value={poinPenting}
            onChange={(e) => setPoinPenting(e.target.value)}
            placeholder="Contoh: Wali Kota membuka acara. Dihadiri 500 peserta. Penekanan pada pentingnya kolaborasi antar instansi untuk menekan inflasi daerah..."
            style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1.5px solid #CBD5E1", minHeight: 100, fontSize: 14, marginBottom: 16, fontFamily: "inherit" }}
          />

          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Format Output AI 🤖</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button onClick={() => setFormat("rilis")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: format === "rilis" ? "none" : "1.5px solid #E2E8F0", background: format === "rilis" ? NAVY : "white", color: format === "rilis" ? "white" : "#64748B", fontWeight: 700, cursor: "pointer" }}>📰 Rilis Berita Web</button>
            <button onClick={() => setFormat("caption")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: format === "caption" ? "none" : "1.5px solid #E2E8F0", background: format === "caption" ? "#C9A84C" : "white", color: format === "caption" ? "white" : "#64748B", fontWeight: 700, cursor: "pointer" }}>📱 Caption Instagram</button>
          </div>

          <button onClick={generateNews} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #0A1628, #1A305E)", color: "white", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
            {loading ? "⏳ AI Sedang Menulis..." : "✨ Generate Berita dengan AI"}
          </button>
        </div>

        {hasilAI && (
          <div style={{ background: "#F8FAFC", borderRadius: 16, padding: "20px", marginTop: 20, border: "1px solid #E2E8F0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>📝 Hasil Draf AI</div>
              <button onClick={copyToClipboard} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "#E2E8F0", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>📋 Copy Teks</button>
            </div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "#334155", lineHeight: 1.6 }}>
              {hasilAI}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? "16px" : "24px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ background: "linear-gradient(135deg, #0A1628, #1A305E)", padding: "24px", borderRadius: 16, color: "white", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: GOLD, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Prokopim Studio</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>AI Newsroom 📰</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>Pilih kegiatan yang sudah tayang untuk dibuatkan rilis beritanya.</div>
        </div>
        <div style={{ fontSize: 40 }}>🤖</div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 12 }}>Pilih Kegiatan Terbaru:</div>
      
      {jadwalTayang.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: "white", borderRadius: 16, border: "1px solid #E2E8F0" }}>Belum ada jadwal tayang.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {jadwalTayang.map(ev => (
            <div key={ev.id} onClick={() => setSelectedEv(ev)} style={{ background: "white", borderRadius: 12, padding: "16px", border: "1px solid #E2E8F0", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{ev.namaAcara}</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>📅 {fmtDate(ev.tanggal)} · 📍 {ev.lokasi || "Lokasi tidak diatur"}</div>
              </div>
              <div style={{ background: "#F1F5F9", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, color: NAVY }}>
                Tulis Berita →
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
