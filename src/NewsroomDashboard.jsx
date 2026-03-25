import React, { useState } from "react";

export default function NewsroomDashboard({ events, user, showT, isMobile, upd }) {
  const NAVY = "#0A1628";
  const GOLD = "#C9A84C";
  const role = user?.role || "";

  // Hak Akses
  const isTimkom = role === "timkom";
  const isKasubbag = role === "kasubbag_komdokpim";
  const isKabag = role === "kabag" || role === "admin_rk";

  const [selectedEv, setSelectedEv] = useState(null);
  const [poinPenting, setPoinPenting] = useState("");
  const [format, setFormat] = useState("rilis");
  const [loading, setLoading] = useState(false);
  
  // State Editor
  const [teksBerita, setTeksBerita] = useState("");
  const [catatanKasubbag, setCatatanKasubbag] = useState("");

  // Ambil jadwal disetujui 40 terakhir
  const jadwalTayang = events
    .filter((e) => e.alur === "disetujui")
    .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
    .slice(0, 40);

  const fmtDate = (d) => {
    if (!d) return "";
    const [y, m, dd] = d.split("-");
    const M = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
    return `${dd} ${M[parseInt(m)-1]} ${y}`;
  };

  // Helper membaca data JSON evaluasi tanpa error
  const getNewsData = (ev) => {
    let evData = ev.evaluasi;
    if (typeof evData === "string") {
      try { evData = JSON.parse(evData); } catch(e) { evData = {}; }
    }
    return evData || {};
  };

  const openEditor = (ev) => {
    const d = getNewsData(ev);
    setSelectedEv(ev);
    setTeksBerita(d.news_text || "");
    setCatatanKasubbag(d.news_notes || "");
    setPoinPenting("");
  };

  const generateNews = async () => {
    if (!poinPenting.trim()) { showT("Masukkan poin penting dulu", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/ai-newsroom", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namaAcara: selectedEv.namaAcara, tanggal: fmtDate(selectedEv.tanggal),
          lokasi: selectedEv.lokasi || "Kota Tarakan", penyelenggara: selectedEv.penyelenggara,
          poinPenting: poinPenting, format: format
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghubungi AI");
      setTeksBerita(data.result || data.text || "Tidak ada hasil dari AI");
      showT("Berita berhasil diracik AI! 🪄", "ok");
    } catch (err) {
      showT(err.message, "error");
      setTeksBerita(`[DRAF SIMULASI]\nPada ${fmtDate(selectedEv.tanggal)}, bertempat di ${selectedEv.lokasi}, berlangsung acara ${selectedEv.namaAcara}.\n\nPoin Utama:\n${poinPenting}`);
    } finally {
      setLoading(false);
    }
  };

  // Simpan ke database menggunakan fungsi upd() dari App.jsx
  const saveNews = (newStatus) => {
    if (!upd) { showT("Fungsi simpan belum terhubung (cek upd={upd})", "error"); return; }
    if (!teksBerita.trim() && newStatus !== 'draft') { showT("Teks berita tidak boleh kosong!", "warn"); return; }
    
    const currentData = getNewsData(selectedEv);
    upd(selectedEv.id, {
      evaluasi: {
        ...currentData,
        news_text: teksBerita,
        news_status: newStatus,
        news_notes: catatanKasubbag,
        news_updated_by: user?.username
      }
    });
    
    showT("Draf berita berhasil " + (newStatus==='review'?"dikirim ke Kasubbag":"disimpan!"), "ok");
    setSelectedEv(null);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(teksBerita);
    showT("Teks berhasil disalin!", "ok");
  };

  // === TAMPILAN EDITOR ===
  if (selectedEv) {
    const d = getNewsData(selectedEv);
    const st = d.news_status || "draft";

    return (
      <div style={{ padding: isMobile ? "16px" : "24px", maxWidth: 800, margin: "0 auto", paddingBottom: 60 }}>
        <button onClick={() => setSelectedEv(null)} style={{ background:"transparent", border:"none", color:NAVY, fontWeight:700, cursor:"pointer", marginBottom:16, fontSize:14 }}>
          ← Kembali ke Daftar
        </button>
        
        {/* Header Acara */}
        <div style={{ background: "white", borderRadius: 16, padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", border: "1px solid #E2E8F0", marginBottom: 16 }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <div style={{ fontSize: 12, color: GOLD, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>Target Liputan</div>
            {st === "review" && <span style={{background:"#FEF3C7",color:"#92400E",padding:"4px 10px",borderRadius:20,fontSize:10,fontWeight:800}}>Menunggu Kasubbag</span>}
            {st === "approved" && <span style={{background:"#D1FAE5",color:"#065F46",padding:"4px 10px",borderRadius:20,fontSize:10,fontWeight:800}}>Disetujui Publikasi</span>}
            {st === "revisi" && <span style={{background:"#FEE2E2",color:"#991B1B",padding:"4px 10px",borderRadius:20,fontSize:10,fontWeight:800}}>Revisi Timkom</span>}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: NAVY, marginBottom: 4 }}>{selectedEv.namaAcara}</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>📅 {fmtDate(selectedEv.tanggal)} · 📍 {selectedEv.lokasi || "-"}</div>
        </div>

        {/* Form AI (Hanya untuk Timkom jika belum disetujui) */}
        {isTimkom && st !== "approved" && st !== "review" && (
          <div style={{ background: "#F8FAFC", borderRadius: 16, padding: "20px", border: "1px solid #E2E8F0", marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Poin Penting Liputan 📝</label>
            <textarea 
              value={poinPenting} onChange={(e) => setPoinPenting(e.target.value)}
              placeholder="Masukkan catatan lapangan di sini untuk dibantu tuliskan oleh AI..."
              style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1.5px solid #CBD5E1", minHeight: 80, fontSize: 14, marginBottom: 12, fontFamily:"inherit" }}
            />
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={() => setFormat("rilis")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: format === "rilis" ? "none" : "1px solid #E2E8F0", background: format === "rilis" ? NAVY : "white", color: format === "rilis" ? "white" : "#64748B", fontWeight: 700, cursor: "pointer", fontSize:12 }}>📰 Rilis Web</button>
              <button onClick={() => setFormat("caption")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: format === "caption" ? "none" : "1px solid #E2E8F0", background: format === "caption" ? GOLD : "white", color: format === "caption" ? "white" : "#64748B", fontWeight: 700, cursor: "pointer", fontSize:12 }}>📱 Caption IG</button>
            </div>
            <button onClick={generateNews} disabled={loading} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #0A1628, #1A305E)", color: "white", fontWeight: 800, fontSize: 13, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "⏳ Meracik Berita..." : "✨ Generate Draft Berita via AI"}
            </button>
          </div>
        )}

        {/* Editor Teks Berita */}
        <div style={{ background: "white", borderRadius: 16, padding: "20px", border: "1px solid #E2E8F0", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>📝 Teks Rilis / Berita</div>
            <button onClick={copyToClipboard} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "#F1F5F9", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>📋 Salin</button>
          </div>
          <textarea 
            value={teksBerita} onChange={(e) => setTeksBerita(e.target.value)}
            disabled={isKabag || (isTimkom && st === "review") || st === "approved"}
            placeholder="Teks berita akan muncul di sini..."
            style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1.5px solid #E2E8F0", minHeight: 250, fontSize: 14, lineHeight: 1.6, fontFamily: "inherit", background: (isKabag || st === "approved") ? "#F8FAFC" : "white" }}
          />
        </div>

        {/* Catatan Kasubbag */}
        {(isKasubbag || d.news_notes) && (
          <div style={{ background: "#FFFBEB", borderRadius: 16, padding: "20px", border: "1.5px solid #FDE68A", marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#92400E", marginBottom: 8 }}>📌 Catatan / Koreksi Kasubbag</label>
            <textarea 
              value={catatanKasubbag} onChange={(e) => setCatatanKasubbag(e.target.value)}
              disabled={!isKasubbag || st === "approved"}
              placeholder={isKasubbag ? "Tulis koreksi atau instruksi revisi untuk Timkom..." : "-"}
              style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #FCD34D", minHeight: 60, fontSize: 13, fontFamily: "inherit", background: isKasubbag ? "white" : "transparent" }}
            />
          </div>
        )}

        {/* Tombol Aksi Berdasarkan Role */}
        <div style={{ display:"flex", gap:10 }}>
          {isTimkom && (st === "draft" || st === "revisi" || !st) && (
             <button onClick={() => saveNews("review")} style={{ flex:1, padding: "14px", borderRadius: 12, border: "none", background: NAVY, color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
               📤 Simpan & Ajukan ke Kasubbag
             </button>
          )}
          
          {isKasubbag && st === "review" && (
            <>
              <button onClick={() => saveNews("approved")} style={{ flex:2, padding: "14px", borderRadius: 12, border: "none", background: "#059669", color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                ✅ Setujui Publikasi
              </button>
              <button onClick={() => saveNews("revisi")} style={{ flex:1, padding: "14px", borderRadius: 12, border: "1.5px solid #EF4444", background: "white", color: "#DC2626", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                ↩️ Kembalikan (Revisi)
              </button>
            </>
          )}
          
          {(isKabag || st === "approved") && (
            <div style={{ flex:1, padding: "12px", textAlign:"center", borderRadius: 12, background: "#F1F5F9", color: "#64748B", fontWeight: 700, fontSize: 13 }}>
              {st === "approved" ? "Selesai: Draf ini sudah disetujui Kasubbag." : "Mode Pemantauan (Read-Only)"}
            </div>
          )}
        </div>
      </div>
    );
  }

  // === TAMPILAN DAFTAR (LIST) ===
  return (
    <div style={{ padding: isMobile ? "16px" : "24px", maxWidth: 800, margin: "0 auto", paddingBottom: 60 }}>
      <div style={{ background: "linear-gradient(135deg, #0A1628, #1A305E)", padding: "24px", borderRadius: 16, color: "white", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: GOLD, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Prokopim Studio</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>AI Newsroom 📰</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
            {isTimkom ? "Buat dan ajukan draf berita kegiatan." : isKasubbag ? "Review dan setujui draf berita dari Timkom." : "Pantau progres publikasi berita kegiatan."}
          </div>
        </div>
        <div style={{ fontSize: 40 }}>{isKabag ? "👁️" : "🤖"}</div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 12 }}>Daftar Kegiatan Tayang:</div>
      
      {jadwalTayang.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: "white", borderRadius: 16, border: "1px solid #E2E8F0" }}>Belum ada jadwal tayang.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {jadwalTayang.map(ev => {
            const d = getNewsData(ev);
            const st = d.news_status;
            let badge = <span style={{fontSize:11, color:"#94A3B8"}}>Belum ada draf</span>;
            if (st === "review") badge = <span style={{background:"#FEF3C7",color:"#92400E",padding:"4px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>Menunggu Kasubbag</span>;
            if (st === "approved") badge = <span style={{background:"#D1FAE5",color:"#065F46",padding:"4px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>✅ Disetujui</span>;
            if (st === "revisi") badge = <span style={{background:"#FEE2E2",color:"#991B1B",padding:"4px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>Revisi Timkom</span>;

            return (
              <div key={ev.id} onClick={() => openEditor(ev)} style={{ background: "white", borderRadius: 12, padding: "16px", border: "1px solid #E2E8F0", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                <div style={{ flex:1, paddingRight:12 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{ev.namaAcara}</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>📅 {fmtDate(ev.tanggal)}</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                  {badge}
                  <div style={{ fontSize: 11, fontWeight: 700, color: NAVY }}>{isKabag ? "Lihat Detail →" : "Buka Studio →"}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
