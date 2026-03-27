/**
 * src/GuestDashboard.jsx — Prokopim v1.7 (Full Sync)
 * Manajemen Tamu — Alur Berjenjang: Admin RK -> Kasubbag -> Kabag -> Pimpinan
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";

// ── Konstanta ────────────────────────────────────────────────
var NAVY     = "#0A1628";
var NAVY_MID = "#163265";
var GOLD     = "#C9A84C";
var API      = "/api/guest";

var PRIORITY_CONFIG = {
  mendesak: { label:"Mendesak",  dot:"#EF4444", bg:"#FEF2F2", color:"#991B1B", ring:"#FECACA" },
  penting:  { label:"Penting",   dot:"#F59E0B", bg:"#FEF3C7", color:"#92400E", ring:"#FDE68A" },
  biasa:    { label:"Biasa",     dot:"#10B981", bg:"#D1FAE5", color:"#065F46", ring:"#6EE7B7" },
};

var STATUS_LABEL = {
  pending_rk:       { text:"Baru Masuk (Admin RK)",    bg:"#F1F5F9", color:"#475569" },
  pending_kasubbag: { text:"Menunggu Kasubbag",       bg:"#EFF6FF", color:"#1D4ED8" },
  pending_kabag:    { text:"Siap Ditelaah Kabag",      bg:"#FEF3C7", color:"#92400E" },
  pending_pimpinan: { text:"Di Meja Pimpinan",         bg:"#EDE9FE", color:"#5B21B6" },
  approved:         { text:"Disetujui",                bg:"#D1FAE5", color:"#065F46" },
  rejected:         { text:"Ditolak",                  bg:"#FEF2F2", color:"#991B1B" },
  disposed:         { text:"Didisposisi",              bg:"#F1F5F9", color:"#475569" },
};

// ── Helpers ──────────────────────────────────────────────────
function todayStr() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
function fmtTs(str) {
  if (!str) return "-";
  return new Date(str).toLocaleString("id-ID", { timeZone: "Asia/Makassar", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function getPejabatLabel(id) {
  return id === "wakilwalikota" ? "Wakil Wali Kota" : "Wali Kota";
}

// ══════════════════════════════════════════════════════════
//  KOMPONEN UTAMA
// ══════════════════════════════════════════════════════════
export default function GuestDashboard({ role, user, events, showT, isMobile }) {
  if (role === "walikota" || role === "wakilwalikota") return <PimpinanView role={role} user={user} events={events} showT={showT} isMobile={isMobile} />;
  if (role === "kabag") return <KabagView user={user} showT={showT} isMobile={isMobile} />;
  // admin_rk, kasubbag_protokol
  return <KasubbagView role={role} user={user} showT={showT} isMobile={isMobile} />;
}

// ══════════════════════════════════════════════════════════
//  VIEW 1: ADMIN RK / KASUBBAG PROTOKOL
// ══════════════════════════════════════════════════════════
function KasubbagView({ role, user, showT, isMobile }) {
  var [guests, setGuests] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filterStatus, setFilterStatus] = useState("pending_rk"); // Default ke Admin RK
  var [detailId, setDetailId] = useState(null);

  var load = useCallback(function() {
    setLoading(true);
    fetch(API + "?action=queue&status=" + filterStatus + "&limit=50")
      .then(function(r) { return r.json(); })
      .then(function(data) { setGuests(Array.isArray(data) ? data : []); })
      .catch(function() { setGuests([]); })
      .finally(function() { setLoading(false); });
  }, [filterStatus]);

  useEffect(function() { load(); }, [load]);

  var detail = guests.find(function(g) { return g.id === detailId; }) || null;

  if (detailId && detail) {
    return (
      <KasubbagDetailView guest={detail} user={user} onBack={function() { setDetailId(null); load(); }} showT={showT} isMobile={isMobile} role={role} />
    );
  }

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(160deg," + NAVY + ",#1A2F5E)", padding: isMobile ? "20px 16px" : "24px 28px" }}>
        <div style={{ color:GOLD, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>
          Manajemen Tamu — Lapis 1
        </div>
        <div style={{ color:"white", fontSize:isMobile?18:21, fontWeight:900, marginBottom:8 }}>
          {role === "admin_rk" ? "Monitoring Tamu Masuk" : "Verifikasi Protokol"}
        </div>
        <div style={{ display:"flex", gap:8 }}>
           <StatPill label="Menunggu Admin RK" value={guests.filter(g => g.status === "pending_rk").length} color="#FCA5A5"/>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding:"12px 16px 0", display:"flex", gap:6, flexWrap:"wrap" }}>
        {[
          { k:"pending_rk",       l:"Baru Masuk" },
          { k:"pending_kasubbag", l:"Di Kasubbag" },
          { k:"pending_kabag",    l:"Di Kabag" },
          { k:"approved",         l:"Disetujui" },
        ].map(function(f) {
          var active = filterStatus === f.k;
          return (
            <button key={f.k} onClick={function() { setFilterStatus(f.k); }} style={{ padding:"5px 13px", borderRadius:20, fontSize:11, fontWeight:700, border:"1.5px solid " + (active ? NAVY : "#D1D9E6"), background: active ? NAVY : "white", color: active ? "white" : "#64748B", cursor:"pointer" }}>
              {f.l}
            </button>
          );
        })}
      </div>

      <div style={{ padding:"12px 16px" }}>
        {loading ? <SkeletonList/> : guests.length === 0 ? <EmptyGuest label="Tidak ada tamu"/> : 
          guests.map(g => <GuestCardItem key={g.id} guest={g} onClick={() => setDetailId(g.id)} showPriority showStaffNote />)
        }
      </div>
    </div>
  );
}

// ── Detail Verifikasi ───────────────────────────────────────
function KasubbagDetailView({ guest, user, role, onBack, showT, isMobile }) {
  var [priority, setPriority] = useState(guest.prioritas || "biasa");
  var [catatan,  setCatatan]  = useState(guest.catatan_staf || "");
  var [loading,  setLoading]  = useState(false);

  // Fungsi Verifikasi Admin RK
  async function verifikasiRK() {
    setLoading(true);
    try {
      var r = await fetch(API + "?action=verify_rk", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ id: guest.id, notes: catatan, admin_name: user?.username })
      });
      if (!r.ok) throw new Error("Gagal verifikasi");
      showT("Berhasil diverifikasi Admin RK dan diteruskan ke Kasubbag");
      onBack();
    } catch(e) { showT(e.message); }
    finally { setLoading(false); }
  }

  // Fungsi Naikkan ke Kabag (Oleh Kasubbag)
  async function naikkanKabag() {
    setLoading(true);
    try {
      var r = await fetch(API + "?action=screen", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ id: guest.id, priority: priority, catatan_staf: catatan, screened_by: user?.username })
      });
      if (!r.ok) throw new Error("Gagal meneruskan");
      showT("Tamu dinaikkan ke Kabag");
      onBack();
    } catch(e) { showT(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>
      <div style={{ background:NAVY, padding:"16px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={onBack} style={backBtnStyle}>← Kembali</button>
        <div style={{ color:"white", fontWeight:800 }}>{guest.nama || guest.name}</div>
      </div>

      <div style={{ padding:"16px" }}>
        <SectionCard title="Data Tamu">
          <InfoGrid rows={[
            { l:"Instansi", v: guest.instansi || guest.organization },
            { l:"Tujuan",   v: guest.tujuan_pejabat },
            { l:"Maksud",   v: guest.maksud_keperluan || guest.purpose },
          ]}/>
        </SectionCard>

        <SectionCard title="Aksi Lapis 1">
          <textarea value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Tambahkan catatan jika perlu..." style={textareaStyle} />
          
          <div style={{ marginTop:12 }}>
            {/* Tombol Khusus Admin RK */}
            {role === "admin_rk" && guest.status === "pending_rk" && (
              <button onClick={verifikasiRK} disabled={loading} style={{ width:"100%", padding:12, borderRadius:10, background:GOLD, color:NAVY, fontWeight:800, border:"none" }}>
                {loading ? "Memproses..." : "✅ Verifikasi Admin RK"}
              </button>
            )}

            {/* Tombol Khusus Kasubbag */}
            {role === "kasubbag_protokol" && guest.status === "pending_kasubbag" && (
              <button onClick={naikkanKabag} disabled={loading} style={{ width:"100%", padding:12, borderRadius:10, background:NAVY_MID, color:"white", fontWeight:800, border:"none" }}>
                {loading ? "Memproses..." : "⬆ Teruskan ke Kabag"}
              </button>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ... (Sisa komponen KabagView, PimpinanView, dll tetap sama dengan file Anda sebelumnya)
// Pastikan semua referensi 'guest.name' diganti ke 'guest.nama' jika data tidak muncul karena skema DB.

function StatPill({ label, value, color }) {
  return <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:20, padding:"4px 12px", display:"flex", alignItems:"center", gap:6 }}><span style={{ color, fontWeight:900 }}>{value}</span><span style={{ color:"white", fontSize:10 }}>{label}</span></div>;
}

function SectionCard({ title, children }) {
  return <div style={{ background:"white", borderRadius:12, padding:14, marginBottom:12, border:"1px solid #E2E8F0" }}><div style={{ fontSize:11, fontWeight:800, color:NAVY, marginBottom:10, textTransform:"uppercase" }}>{title}</div>{children}</div>;
}

function InfoGrid({ rows }) {
  return rows.map(r => <div key={r.l} style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6 }}><span style={{ color:"#64748B" }}>{r.l}</span><span style={{ fontWeight:600, color:NAVY }}>{r.v}</span></div>);
}

function EmptyGuest({ label }) {
  return <div style={{ textAlign:"center", padding:40, color:"#94A3B8" }}>{label}</div>;
}

function SkeletonList() { return <div style={{ padding:20, color:"#94A3B8" }}>Memuat...</div>; }

function GuestCardItem({ guest, onClick }) {
  var sc = STATUS_LABEL[guest.status] || STATUS_LABEL.pending_rk;
  return (
    <div onClick={onClick} style={{ background:"white", borderRadius:12, padding:14, marginBottom:10, border:"1px solid #E2E8F0", cursor:"pointer" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <div style={{ fontWeight:800, color:NAVY }}>{guest.nama || guest.name}</div>
        <span style={{ background:sc.bg, color:sc.color, fontSize:10, padding:"2px 8px", borderRadius:10, fontWeight:700 }}>{sc.text}</span>
      </div>
      <div style={{ fontSize:12, color:"#64748B" }}>{guest.maksud_keperluan || guest.purpose}</div>
    </div>
  );
}

var backBtnStyle = { background:"rgba(255,255,255,0.2)", border:"none", color:"white", padding:"6px 12px", borderRadius:8, cursor:"pointer" };
var textareaStyle = { width:"100%", padding:10, borderRadius:8, border:"1px solid #D1D9E6", fontSize:13 };
