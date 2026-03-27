/**
 * src/GuestDashboard.jsx — Prokopim v1.6
 * Manajemen Tamu — Alur Berjenjang: Admin RK -> Kasubbag -> Kabag -> Pimpinan
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

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
  waiting:   { text:"Baru Masuk (Ke Kasubbag)", bg:"#EFF6FF", color:"#1D4ED8" },
  screened:  { text:"Siap Ditelaah Kabag",      bg:"#FEF3C7", color:"#92400E" },
  forwarded: { text:"Di Meja Pimpinan",         bg:"#EDE9FE", color:"#5B21B6" },
  accepted:  { text:"Disetujui",                bg:"#D1FAE5", color:"#065F46" },
  rejected:  { text:"Ditolak",                  bg:"#FEF2F2", color:"#991B1B" },
  disposed:  { text:"Didisposisi",              bg:"#F1F5F9", color:"#475569" },
};

// ── Data SOP Lengkap ─────────────────────────────────────────
var SOP_DISCLAIMER = "Panduan ini bersifat referensi. Keputusan akhir sepenuhnya merupakan hak prerogatif Bagian Prokopim Setda Kota Tarakan.";

var SOP_BAGIAN = [
  {
    bagian: "BAGIAN 1", judul: "Klasifikasi Status Tamu", icon: "🎖️", warna: "#1D4ED8", warnaBg: "#EFF6FF", warnaBorder: "#BFDBFE",
    kelompok: [
      { label: "1. Tamu VVIP / VIP", sublabel: "Prioritas Utama", warna: "#7C3AED", warnaBg: "#F5F3FF", warnaBorder: "#C4B5FD",
        isi: [
          { bold: "Pejabat Negara/Pusat:", teks: "Menteri, Wamen, Pimpinan Lembaga Tinggi Negara." },
          { bold: "Forkopimda:", teks: "Kapolres, Dandim, Kajari, Ketua PN/PA, Danlanal, Danlanud." },
        ],
      },
      { label: "2. Tamu Reguler", sublabel: "Standar", warna: "#0369A1", warnaBg: "#F0F9FF", warnaBorder: "#BAE6FD",
        isi: [
          { bold: null, teks: "Pimpinan Ormas, LSM, OKP, Paguyuban tingkat kota." },
          { bold: null, teks: "Warga masyarakat umum, RT/RW, tokoh masyarakat." },
        ],
      },
    ],
  },
  {
    bagian: "BAGIAN 2", judul: "Klasifikasi Tingkat Urgensi", icon: "⚡", warna: "#B45309", warnaBg: "#FFFBEB", warnaBorder: "#FDE68A",
    kelompok: [
      { label: "🔴 TINGGI — Sangat Mendesak", sublabel: "Jadwalkan H-0 s/d H-2", warna: "#991B1B", warnaBg: "#FEF2F2", warnaBorder: "#FECACA",
        isi: [{ bold: "Krisis & Keamanan:", teks: "Bencana alam, konflik sosial, demonstrasi." }] },
      { label: "🟡 SEDANG — Penting tapi Fleksibel", sublabel: "Jadwalkan 3-7 hari ke depan", warna: "#92400E", warnaBg: "#FFFBEB", warnaBorder: "#FDE68A",
        isi: [{ bold: "Koordinasi Program:", teks: "Rapat pembahasan program kerja antar instansi." }] },
      { label: "🟢 RENDAH — Biasa / Rutin", sublabel: "Waiting list atau Disposisi ke OPD", warna: "#065F46", warnaBg: "#D1FAE5", warnaBorder: "#6EE7B7",
        isi: [{ bold: "Silaturahmi / Courtesy Call:", teks: "Audiensi perkenalan pengurus baru." }] },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────
function todayStr() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
function tomorrowStr() { return new Date(Date.now() + 8 * 3600000 + 86400000).toISOString().slice(0, 10); }
function toMin(jam) { if (!jam) return 0; var p = jam.split(":"); return parseInt(p[0], 10) * 60 + parseInt(p[1] || 0, 10); }
function fmtTs(str) {
  if (!str) return "-";
  return new Date(str).toLocaleString("id-ID", { timeZone: "Asia/Makassar", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtDateLong(str) {
  if (!str) return "";
  var HARI = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  var BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  var d = new Date(str + "T00:00:00+08:00");
  return HARI[d.getDay()] + ", " + d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear();
}
function getPejabatLabel(id) {
  if (id === "walikota") return "Wali Kota";
  if (id === "wakilwalikota") return "Wakil Wali Kota";
  return id || "-";
}

function detectConflict(events, tanggal, jam, pimpinan) {
  if (!tanggal || !jam) return [];
  var newStart = toMin(jam);
  var newEnd   = newStart + 60;
  return events.filter(function(ev) {
    if (ev.tanggal !== tanggal || ev.alur !== "disetujui") return false;
    if (!ev.untukPimpinan || !ev.untukPimpinan.includes(pimpinan)) return false;
    var evStart = toMin(ev.jam);
    var evEnd   = evStart + 120;
    return newStart < evEnd && newEnd > evStart;
  });
}

// ══════════════════════════════════════════════════════════
//  KOMPONEN UTAMA
// ══════════════════════════════════════════════════════════
export default function GuestDashboard({ role, user, events, showT, isMobile }) {
  if (role === "walikota" || role === "wakilwalikota") return <PimpinanView role={role} user={user} events={events} showT={showT} isMobile={isMobile} />;
  if (role === "ajudan_walikota" || role === "ajudan_wakilwalikota") return <AjudanView role={role} user={user} showT={showT} isMobile={isMobile} />;
  if (role === "kabag") return <KabagView user={user} showT={showT} isMobile={isMobile} />;
  if (role === "kasubbag_komdokpim" || role === "timkom") return <ReadOnlyView role={role} isMobile={isMobile} />;
  // admin_rk, kasubbag_protokol
  return <KasubbagView role={role} user={user} showT={showT} isMobile={isMobile} />;
}

// ══════════════════════════════════════════════════════════
//  VIEW 1: ADMIN RK / KASUBBAG PROTOKOL — Filter Lapis 1
// ══════════════════════════════════════════════════════════
function KasubbagView({ role, user, showT, isMobile }) {
  var [guests, setGuests] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filterStatus, setFilterStatus] = useState("waiting");
  var [showBukuSOP, setShowBukuSOP] = useState(false);
  var [showManual, setShowManual] = useState(false);
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
      <div style={{ background: "linear-gradient(160deg," + NAVY + ",#1A2F5E)", padding: isMobile ? "20px 16px" : "24px 28px", position: "relative" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
          <div>
            <div style={{ color:GOLD, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>
              Manajemen Tamu — Lapis 1
            </div>
            <div style={{ color:"white", fontSize:isMobile?18:21, fontWeight:900, marginBottom:8 }}>
              {role === "admin_rk" ? "Monitoring Tamu Masuk" : "Verifikasi Kasubbag"}
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <StatPill label="Baru (Menunggu Kasubbag)" value={guests.filter(function(g){return g.status==="waiting";}).length} color="#FCA5A5"/>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
            <button onClick={function() { setShowBukuSOP(true); }} style={{ padding:"7px 13px", borderRadius:10, background:"rgba(201,168,76,0.15)", border:"1.5px solid rgba(201,168,76,0.4)", color:GOLD, fontSize:11, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>
              📖 Buku SOP
            </button>
            <button onClick={function() { setShowManual(true); }} style={{ padding:"7px 12px", borderRadius:10, background:GOLD, border:"none", color:NAVY, fontSize:11, fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}>
              + Input Manual
            </button>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ padding:"12px 16px 0", display:"flex", gap:6, flexWrap:"wrap" }}>
        {[
          { k:"waiting",   l:"Baru Masuk" },
          { k:"screened",  l:"Siap ke Kabag" },
          { k:"forwarded", l:"Di Pimpinan" },
          { k:"accepted",  l:"Disetujui" },
          { k:"rejected",  l:"Ditolak" },
        ].map(function(f) {
          var active = filterStatus === f.k;
          return (
            <button key={f.k} onClick={function() { setFilterStatus(f.k); }} style={{ padding:"5px 13px", borderRadius:20, fontSize:11, fontWeight:700, border:"1.5px solid " + (active ? NAVY : "#D1D9E6"), background: active ? NAVY : "white", color: active ? "white" : "#64748B", cursor:"pointer" }}>
              {f.l}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={{ padding:"12px 16px" }}>
        {loading
          ? <SkeletonList/>
          : guests.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 20px", background: "white", borderRadius: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.03)", marginTop: 20 }}><div style={{ fontSize: 64, marginBottom: 16 }}>🛋️</div><div style={{ fontSize: 18, fontWeight: 800, color: "#0A1628", marginBottom: 8 }}>Ruang Tunggu Kosong</div><div style={{ fontSize: 14, color: "#64748B", maxWidth: 320, margin: "0 auto", lineHeight: 1.5 }}>Tidak ada tamu dengan status ini.</div></div>
            : guests.map(function(g) {
                return <GuestCardItem key={g.id} guest={g} onClick={function() { setDetailId(g.id); }} showPriority showStaffNote />;
              })
        }
      </div>

      {showBukuSOP && <BukuPanduanModal onClose={function() { setShowBukuSOP(false); }}/>}
      {showManual && <InputManualModal user={user} onClose={function() { setShowManual(false); }} onSuccess={function() { setShowManual(false); load(); showT("Tamu berhasil diinput manual"); }} />}
    </div>
  );
}

// ── Detail Verifikasi Kasubbag ─────────────────────────────
function KasubbagDetailView({ guest, user, role, onBack, showT, isMobile }) {
  var [priority, setPriority] = useState(guest.priority || "biasa");
  var [catatan,  setCatatan]  = useState(guest.staff_notes || "");
  var [loading,  setLoading]  = useState(false);
  var [waLoading,setWaLoading]= useState(false);

  var isKasubbag = role === "kasubbag_protokol";

  async function verifikasiWA() {
    setWaLoading(true);
    try {
      var r = await fetch(API + "?action=verify_wa", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ id: guest.id }) });
      var data = await r.json();
      if (!r.ok) throw new Error(data.error || "Gagal");
      showT("WA verifikasi terkirim ke " + guest.phone);
    } catch(e) { showT("Gagal: " + e.message); }
    finally { setWaLoading(false); }
  }

  async function naikkanKabag() {
    setLoading(true);
    try {
      // Endpoint screen kita gunakan untuk menaikkan ke status "screened" (siap ke Kabag)
      var r = await fetch(API + "?action=screen", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          id: guest.id,
          priority: priority,
          staff_notes: catatan.trim(),
          screened_by: user?.username,
        }),
      });
      var data = await r.json();
      if (!r.ok) throw new Error(data.error || "Gagal");
      showT("Tamu telah diverifikasi dan dinaikkan ke Kabag");
      onBack();
    } catch(e) { showT("Gagal: " + e.message); }
    finally { setLoading(false); }
  }

  var pc = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.biasa;

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>
      {/* Header */}
      <div style={{ background:"linear-gradient(135deg," + NAVY + "," + NAVY_MID + ")", padding: isMobile ? "16px" : "20px 28px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={onBack} style={backBtnStyle}>← Kembali</button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:GOLD, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase" }}>Detail Tamu</div>
          <div style={{ color:"white", fontSize:15, fontWeight:800, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{guest.name}</div>
        </div>
      </div>

      <div style={{ padding: isMobile ? "14px" : "20px 28px" }}>
        <SectionCard title="Informasi Tamu">
          <InfoGrid rows={[
            { l:"Nama",       v: guest.name },
            { l:"Instansi",   v: guest.organization || "-" },
            { l:"WhatsApp",   v: guest.phone },
            { l:"Tujuan",     v: getPejabatLabel(guest.tujuan_pejabat) },
            { l:"Keperluan",  v: guest.purpose },
            { l:"Daftar",     v: fmtTs(guest.created_at) },
          ]}/>
          {guest.message && <div style={{ marginTop:10, background:"#F8FAFC", borderRadius:9, padding:"9px 11px", fontSize:13, color:"#334155", lineHeight:1.6 }}>💬 {guest.message}</div>}
        </SectionCard>

        <button onClick={verifikasiWA} disabled={waLoading} style={{ width:"100%", padding:"11px", borderRadius:11, border:"2px solid #25D366", background:"white", color:"#128C7E", fontSize:13, fontWeight:700, cursor: waLoading ? "not-allowed" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:14 }}>
          {waLoading ? <Spinner color="#128C7E"/> : "📱"} {waLoading ? "Mengirim..." : "Verifikasi via WhatsApp"}
        </button>

        {/* Verifikasi Internal hanya bisa diklik Kasubbag (Admin RK read-only) */}
        <SectionCard title="Verifikasi Lapis 1 (Kasubbag)" accent="#FDE68A">
          <div style={{ marginBottom:12 }}>
            <div style={sectionSubLabel}>Label Prioritas Awal</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {Object.entries(PRIORITY_CONFIG).map(function([k, c]) {
                var active = priority === k;
                return (
                  <button key={k} disabled={!isKasubbag} onClick={function() { setPriority(k); }} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", minHeight:38, borderRadius:20, border:"2px solid " + (active ? c.color : "#E2E8F0"), background: active ? c.bg : "white", color: active ? c.color : "#64748B", fontSize:12, fontWeight:700, cursor:isKasubbag?"pointer":"default", opacity:!isKasubbag&&!active?0.5:1 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background: c.dot, flexShrink:0 }}/> {c.label} {active && " ✓"}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={sectionSubLabel}>Catatan Verifikasi Kasubbag</label>
            <textarea value={catatan} disabled={!isKasubbag} onChange={function(e) { setCatatan(e.target.value); }} rows={3} placeholder={isKasubbag?"Tuliskan hasil verifikasi untuk dibaca Kabag...":"Hanya Kasubbag yang dapat mengisi catatan"} style={textareaStyle} />
          </div>
          {isKasubbag && guest.status === "waiting" && (
            <button onClick={naikkanKabag} disabled={loading} style={{ width:"100%", padding:"13px", borderRadius:12, border:"none", background: loading ? "#94A3B8" : ("linear-gradient(135deg," + NAVY + "," + NAVY_MID + ")"), color:"white", fontSize:14, fontWeight:800, cursor: loading ? "not-allowed" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              {loading ? <Spinner/> : null} ⬆ Setujui & Naikkan ke Kabag
            </button>
          )}
          {!isKasubbag && guest.status === "waiting" && (
             <div style={{ background:"#F1F5F9", padding:"10px", borderRadius:10, fontSize:12, color:"#64748B", textAlign:"center", fontWeight:600 }}>Menunggu verifikasi Kasubbag Protokol</div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  VIEW 2: KABAG PROKOPIM — Telaah Akhir / Gatekeeper
// ══════════════════════════════════════════════════════════
function KabagView({ user, showT, isMobile }) {
  var [guests, setGuests] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filterSt, setFilterSt] = useState("screened");
  var [detailId, setDetailId] = useState(null);

  var load = useCallback(function() {
    setLoading(true);
    fetch(API + "?action=queue&status=" + filterSt + "&limit=100")
      .then(function(r) { return r.json(); })
      .then(function(d) { setGuests(Array.isArray(d) ? d : []); })
      .catch(function() { setGuests([]); })
      .finally(function() { setLoading(false); });
  }, [filterSt]);

  useEffect(function() { load(); }, [load]);

  var detail = guests.find(function(g) { return g.id === detailId; }) || null;

  if (detailId && detail) {
    return (
      <KabagDetailView guest={detail} user={user} onBack={function() { setDetailId(null); load(); }} showT={showT} isMobile={isMobile} />
    );
  }

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>
      {/* Header */}
      <div style={{ background:"linear-gradient(160deg," + NAVY + ",#1A2F5E)", padding: isMobile ? "20px 16px" : "24px 28px" }}>
        <div style={{ color:GOLD, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>Manajemen Tamu — Gatekeeper</div>
        <div style={{ color:"white", fontSize:isMobile?18:21, fontWeight:900, marginBottom:10 }}>Telaah Eksekutif Kabag</div>
      </div>

      {/* Filter */}
      <div style={{ padding:"12px 16px 0", display:"flex", gap:6, flexWrap:"wrap" }}>
        {[
          { k:"screened",  l:"Menunggu Telaah Anda" },
          { k:"forwarded", l:"Diteruskan ke Pimpinan" },
          { k:"accepted",  l:"Disetujui Pimpinan" },
          { k:"rejected",  l:"Ditolak" },
        ].map(function(f) {
          var active = filterSt === f.k;
          return (
            <button key={f.k} onClick={function() { setFilterSt(f.k); }} style={{ padding:"5px 13px", borderRadius:20, fontSize:11, fontWeight:700, border:"1.5px solid " + (active ? NAVY : "#D1D9E6"), background: active ? NAVY : "white", color: active ? "white" : "#64748B", cursor:"pointer" }}>
              {f.l}
            </button>
          );
        })}
      </div>

      <div style={{ padding:"12px 16px" }}>
        {loading
          ? <SkeletonList/>
          : guests.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 20px", background: "white", borderRadius: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.03)", marginTop: 20 }}><div style={{ fontSize: 64, marginBottom: 16 }}>🛋️</div><div style={{ fontSize: 18, fontWeight: 800, color: "#0A1628", marginBottom: 8 }}>Ruang Tunggu Kosong</div><div style={{ fontSize: 14, color: "#64748B", maxWidth: 320, margin: "0 auto", lineHeight: 1.5 }}>Tidak ada tamu yang menunggu telaah Bapak saat ini.</div></div>
            : guests.map(function(g) {
                return <GuestCardItem key={g.id} guest={g} onClick={function() { setDetailId(g.id); }} showPriority showStaffNote />;
              })
        }
      </div>
    </div>
  );
}

// ── Detail Telaah Kabag ───────────────────────────────────────
function KabagDetailView({ guest, user, onBack, showT, isMobile }) {
  var [catatanKabag, setCatatanKabag] = useState(guest.kabag_notes || "");
  var [priority, setPriority] = useState(guest.priority || "biasa");
  var [loading, setLoading] = useState(false);

  async function teruskan() {
    setLoading(true);
    try {
      var r = await fetch(API + "?action=forward", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          id: guest.id,
          priority: priority, // Kabag bisa mengkoreksi prioritas dari kasubbag
          kabag_notes: catatanKabag.trim(),
          forwarded_by: user?.username,
        }),
      });
      var data = await r.json();
      if (!r.ok) throw new Error(data.error || "Gagal");
      showT("Diteruskan ke Pimpinan");
      onBack();
    } catch(e) { showT("Gagal: " + e.message); }
    finally { setLoading(false); }
  }

  async function kembalikan() {
    setLoading(true);
    try {
      var r = await fetch(API + "?action=return_to_staff", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          id: guest.id,
          kabag_notes: catatanKabag.trim() || "(Dikembalikan oleh Kabag)",
          returned_by: user?.username,
        }),
      });
      var data = await r.json();
      if (!r.ok) throw new Error(data.error || "Gagal");
      showT("Dikembalikan ke Kasubbag");
      onBack();
    } catch(e) { showT("Gagal: " + e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>
      <div style={{ background:"linear-gradient(135deg," + NAVY + "," + NAVY_MID + ")", padding: isMobile ? "16px" : "20px 28px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={onBack} style={backBtnStyle}>← Kembali</button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:GOLD, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase" }}>Telaah Eksekutif</div>
          <div style={{ color:"white", fontSize:15, fontWeight:800, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{guest.name}</div>
        </div>
      </div>

      <div style={{ padding: isMobile ? "14px" : "20px 28px" }}>
        <SectionCard title="Informasi Tamu">
          <InfoGrid rows={[
            { l:"Nama",      v: guest.name },
            { l:"Instansi",  v: guest.organization || "-" },
            { l:"WhatsApp",  v: guest.phone },
            { l:"Tujuan",    v: getPejabatLabel(guest.tujuan_pejabat) },
            { l:"Keperluan", v: guest.purpose },
          ]}/>
        </SectionCard>

        {guest.staff_notes && (
          <div style={{ background:"#FFFBEB", border:"1.5px solid #FDE68A", borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#92400E", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Catatan Kasubbag</div>
            <p style={{ fontSize:13, color:"#78350F", lineHeight:1.6, margin:0 }}>{guest.staff_notes}</p>
          </div>
        )}

        <SectionCard title="Keputusan Kabag (Gatekeeper)" accent="#C4B5FD">
           <div style={{ marginBottom:12 }}>
            <div style={sectionSubLabel}>Koreksi Prioritas (Jika Perlu)</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {Object.entries(PRIORITY_CONFIG).map(function([k, c]) {
                var active = priority === k;
                return (
                  <button key={k} onClick={function() { setPriority(k); }} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", minHeight:38, borderRadius:20, border:"2px solid " + (active ? c.color : "#E2E8F0"), background: active ? c.bg : "white", color: active ? c.color : "#64748B", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background: c.dot, flexShrink:0 }}/> {c.label} {active && " ✓"}
                  </button>
                );
              })}
            </div>
          </div>
          <label style={sectionSubLabel}>Catatan Eksekutif untuk Pimpinan</label>
          <textarea value={catatanKabag} onChange={function(e) { setCatatanKabag(e.target.value); }} rows={3} placeholder="Sampaikan poin penting untuk pimpinan..." style={textareaStyle} />
          {guest.status === "screened" && (
            <div style={{ display:"flex", gap:10, marginTop:10 }}>
              <button onClick={teruskan} disabled={loading} style={{ flex:3, padding:"12px", borderRadius:11, border:"none", background: loading ? "#94A3B8" : ("linear-gradient(135deg," + NAVY + "," + NAVY_MID + ")"), color:"white", fontSize:13, fontWeight:800, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? <Spinner/> : null} 📤 Teruskan ke Pimpinan
              </button>
              <button onClick={kembalikan} disabled={loading} style={{ flex:2, padding:"12px", borderRadius:11, border:"1.5px solid #CBD5E1", background:"white", color:"#64748B", fontSize:13, fontWeight:700, cursor: loading ? "not-allowed" : "pointer" }}>
                ↩ Kembalikan
              </button>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  VIEW 3: PIMPINAN (Wali Kota / Wawali) — Zen Mode
// ══════════════════════════════════════════════════════════
function PimpinanView({ role, user, events, showT, isMobile }) {
  var [guests, setGuests] = useState([]);
  var [loading, setLoading] = useState(true);
  var [idx, setIdx] = useState(0);
  var [modal, setModal] = useState(null);
  var [schedDate,setSchedDate]= useState("");
  var [schedTime,setSchedTime]= useState("");
  var [dispTo, setDispTo] = useState("");
  var [rejectR, setRejectR] = useState("");
  var [actLoading,setActLoad] = useState(false);

  useEffect(function() {
    setLoading(true);
    fetch(API + "?action=queue&status=forwarded&pimpinan=" + role + "&limit=20")
      .then(function(r) { return r.json(); })
      .then(function(d) { setGuests(Array.isArray(d) ? d : []); })
      .catch(function() { setGuests([]); })
      .finally(function() { setLoading(false); });
  }, [role]);

  var current = guests[idx] || null;

  var conflicts = useMemo(function() {
    if (!current || !schedDate || !schedTime) return [];
    return detectConflict(events, schedDate, schedTime, role);
  }, [current, schedDate, schedTime, events, role]);

  async function respond(action, extra) {
    if (!current) return;
    setActLoad(true);

    var SUPA_URL = (typeof import.meta !== "undefined" && import.meta.env) ? (import.meta.env.VITE_SUPABASE_URL || "") : "";
    var SUPA_KEY = (typeof import.meta !== "undefined" && import.meta.env) ? (import.meta.env.VITE_SUPABASE_ANON_KEY || "") : "";
    var supaHeaders = { "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY };

    try {
      if (action === "accepted" && extra.scheduled_date && extra.scheduled_time) {
        var schedTanggal = extra.scheduled_date;
        var schedJam     = extra.scheduled_time;
        var newEventId   = Date.now();
        var pejabatKey = current.tujuan_pejabat === "wakilwalikota" ? "wakilwalikota" : "walikota";

        var newEvent = {
          id: newEventId, tanggal: schedTanggal, jam: schedJam,
          namaAcara: "Audiensi: " + current.name + (current.organization ? " (" + current.organization + ")" : ""),
          penyelenggara: current.organization || current.name, kontak: current.phone || "-",
          buktiUndangan: "Permohonan Tamu #" + String(current.id).slice(-4),
          pakaian: "Batik Lengan Panjang", jenisKegiatan: "Menghadiri", lokasi: "Kantor Wali Kota Tarakan",
          untukPimpinan: [pejabatKey], alur: "disetujui",
          catatan: "Maksud: " + current.purpose + (current.kabag_notes ? " | Telaah Kabag: " + current.kabag_notes : ""),
          statusWK: pejabatKey === "walikota" ? "hadir" : null, statusWWK: pejabatKey === "wakilwalikota" ? "hadir" : null,
          submittedBy: user?.username || "pimpinan", personil: [], evaluasi: {}, created_from: "guest_module"
        };

        var resJadwal = await fetch(SUPA_URL + "/rest/v1/jadwal", { method: "POST", headers: Object.assign({}, supaHeaders, { "Prefer": "resolution=merge-duplicates" }), body: JSON.stringify({ id: newEventId, data: newEvent }) });
        if (!resJadwal.ok) throw new Error("Gagal membuat agenda otomatis");

        await fetch(SUPA_URL + "/rest/v1/permohonan_tamu?id=eq." + current.id, { method: "PATCH", headers: supaHeaders, body: JSON.stringify({ status: "accepted", jadwal_id: String(newEventId), jadwal_tanggal: schedTanggal, jadwal_jam: schedJam, diputuskan_oleh: user?.username }) });
        showT("✅ Berhasil! Tamu dijadwalkan & otomatis masuk Agenda.");
      } else {
        var body = Object.assign({ id: current.id, response: action, pimpinan: role, responded_by: user?.username }, extra || {});
        var r = await fetch(API + "?action=respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error("Gagal memproses keputusan");
        showT(action === "rejected" ? "❌ Permohonan ditolak" : "↩️ Disposisi berhasil");
      }

      setGuests(function(prev) { return prev.filter(function(g) { return g.id !== current.id; }); });
      setIdx(0); setModal(null);
    } catch(e) { showT("Gagal: " + e.message, "error"); } finally { setActLoad(false); }
  }

  function closeModal() { setModal(null); setSchedDate(""); setSchedTime(""); setDispTo(""); setRejectR(""); }

  if (loading) return <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:"#F0F4FA" }}><div style={{ fontSize:14, color:"#94A3B8" }}>Memuat permohonan...</div></div>;
  if (guests.length === 0) return <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"#F0F4FA", padding:40, textAlign:"center" }}><div style={{ fontSize:48, marginBottom:16 }}>✅</div><div style={{ fontSize:18, fontWeight:800, color:NAVY, marginBottom:8 }}>Tidak ada permohonan</div><div style={{ fontSize:13, color:"#64748B", lineHeight:1.6 }}>Semua permohonan audiensi sudah ditangani.<br/>Permohonan baru akan muncul setelah ditelaah Kabag Prokopim.</div></div>;

  var pc = current ? (PRIORITY_CONFIG[current.priority] || PRIORITY_CONFIG.biasa) : null;

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>
      <div style={{ background:"linear-gradient(160deg," + NAVY + ",#1A2F5E)", padding: isMobile ? "20px 16px" : "24px 28px" }}>
        <div style={{ color:GOLD, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>Permohonan Audiensi</div>
        <div style={{ color:"white", fontSize:isMobile?18:21, fontWeight:900, marginBottom:4 }}>{role === "walikota" ? "Wali Kota" : "Wakil Wali Kota"}</div>
        <div style={{ color:"rgba(255,255,255,0.45)", fontSize:12 }}>{guests.length} permohonan menunggu keputusan Anda</div>
      </div>

      <div style={{ padding: isMobile ? "14px" : "20px 28px" }}>
        {guests.length > 1 && (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <button onClick={function() { setIdx(function(i) { return Math.max(0, i-1); }); }} disabled={idx === 0} style={navBtnStyle(idx === 0)}>← Sebelumnya</button>
            <span style={{ fontSize:13, color:"#64748B", fontWeight:600 }}>{idx + 1} / {guests.length}</span>
            <button onClick={function() { setIdx(function(i) { return Math.min(guests.length-1, i+1); }); }} disabled={idx === guests.length - 1} style={navBtnStyle(idx === guests.length - 1)}>Berikutnya →</button>
          </div>
        )}

        {current && (
          <div style={{ background:"white", borderRadius:22, overflow:"hidden", boxShadow:"0 12px 48px rgba(10,22,40,0.12), 0 2px 8px rgba(10,22,40,0.06)", border:"1.5px solid " + (pc ? pc.ring : "#E8EDF4") }}>
            <div style={{ height:5, background: current.priority === "mendesak" ? "linear-gradient(90deg,#DC2626,#B91C1C)" : current.priority === "penting" ? "linear-gradient(90deg,#F59E0B,#D97706)" : "linear-gradient(90deg," + NAVY + "," + NAVY_MID + ")" }}/>
            <div style={{ padding: isMobile ? "18px 16px" : "22px 20px" }}>
              <div style={{ marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:4 }}>
                  <div style={{ fontSize: isMobile?19:23, fontWeight:900, color:NAVY, letterSpacing:-0.5, lineHeight:1.2 }}>{current.name}</div>
                  {pc && <span style={{ background:pc.bg, color:pc.color, borderRadius:20, padding:"3px 11px", fontSize:10, fontWeight:700, flexShrink:0 }}>{pc.label}</span>}
                </div>
                {current.organization && <div style={{ fontSize:13, color:"#64748B", marginBottom:4 }}>🏢 {current.organization}</div>}
                <div style={{ fontSize:12, color:"#94A3B8" }}>📱 {current.phone} · 🕐 {fmtTs(current.created_at)}</div>
              </div>

              <div style={{ background:"#F8FAFC", borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Tujuan & Keperluan</div>
                <div style={{ fontSize:14, color:NAVY, lineHeight:1.6 }}>{current.purpose}</div>
              </div>

              {current.kabag_notes && (
                <div style={{ background:"#EDE9FE", border:"1.5px solid #C4B5FD", borderRadius:11, padding:"11px 13px", marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#5B21B6", textTransform:"uppercase", letterSpacing:1, marginBottom:5 }}>Telaah Kabag Prokopim</div>
                  <p style={{ fontSize:13, color:"#4C1D95", lineHeight:1.6, margin:0 }}>{current.kabag_notes}</p>
                </div>
              )}

              {modal === "schedule" && (
                <div style={{ background:"#F0F4FA", borderRadius:13, padding:"14px", border:"1.5px solid #D1D9E6", marginBottom:14 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:NAVY, marginBottom:10 }}>📅 Jadwalkan Audiensi</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                    <div><div style={sectionSubLabel}>Tanggal</div><input type="date" value={schedDate} min={todayStr()} onChange={function(e) { setSchedDate(e.target.value); }} style={inputStyle} /></div>
                    <div><div style={sectionSubLabel}>Jam (WITA)</div><input type="time" value={schedTime} onChange={function(e) { setSchedTime(e.target.value); }} style={inputStyle}/></div>
                  </div>
                  {conflicts.length > 0 && (
                    <div style={{ background:"#FEF2F2", border:"2px solid #FECACA", borderRadius:11, padding:"12px 14px", marginBottom:12 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:"#DC2626", marginBottom:7 }}>⚠️ Jadwal Bentrok!</div>
                      {conflicts.map(function(c, i) { return <div key={i} style={{ fontSize:12, color:"#991B1B", marginBottom:3 }}>• {c.jam} WITA — {c.namaAcara}</div>; })}
                    </div>
                  )}
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={function() { if (!schedDate || !schedTime) { showT("Pilih tanggal dan jam dulu"); return; } respond("accepted", { scheduled_date: schedDate, scheduled_time: schedTime }); }} disabled={actLoading} style={{ flex:2, padding:"11px", borderRadius:11, border:"none", background: conflicts.length > 0 ? "#F59E0B" : "linear-gradient(135deg,#059669,#047857)", color:"white", fontSize:13, fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                      {actLoading ? <Spinner/> : null} {conflicts.length > 0 ? "⚠ Tetap Konfirmasi" : "✅ Konfirmasi & Masuk Agenda"}
                    </button>
                    <button onClick={closeModal} style={cancelBtnStyle}>Batal</button>
                  </div>
                </div>
              )}

              {modal === "disposisi" && (
                <div style={{ background:"#EDE9FE", borderRadius:13, padding:"14px", border:"1.5px solid #C4B5FD", marginBottom:14 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#5B21B6", marginBottom:8 }}>Disposisi ke:</div>
                  <input value={dispTo} onChange={function(e) { setDispTo(e.target.value); }} placeholder="Pejabat / Instansi penerima disposisi" style={inputStyle} />
                  <div style={{ display:"flex", gap:8, marginTop:10 }}>
                    <button onClick={function() { if (!dispTo.trim()) { showT("Isi tujuan disposisi"); return; } respond("disposed", { disposed_to: dispTo }); }} disabled={actLoading} style={{ flex:2, padding:"10px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#7C3AED,#5B21B6)", color:"white", fontSize:13, fontWeight:800, cursor:"pointer" }}>
                      {actLoading ? <Spinner/> : "↩ Konfirmasi Disposisi"}
                    </button>
                    <button onClick={closeModal} style={cancelBtnStyle}>Batal</button>
                  </div>
                </div>
              )}

              {modal === "tolak" && (
                <div style={{ background:"#FEF2F2", borderRadius:13, padding:"14px", border:"1.5px solid #FECACA", marginBottom:14 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#DC2626", marginBottom:8 }}>Alasan penolakan (opsional):</div>
                  <input value={rejectR} onChange={function(e) { setRejectR(e.target.value); }} placeholder="Contoh: Jadwal penuh" style={inputStyle} />
                  <div style={{ display:"flex", gap:8, marginTop:10 }}>
                    <button onClick={function() { respond("rejected", { rejection_reason: rejectR }); }} disabled={actLoading} style={{ flex:2, padding:"10px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#DC2626,#B91C1C)", color:"white", fontSize:13, fontWeight:800, cursor:"pointer" }}>
                      {actLoading ? <Spinner/> : "❌ Konfirmasi Penolakan"}
                    </button>
                    <button onClick={closeModal} style={cancelBtnStyle}>Batal</button>
                  </div>
                </div>
              )}

              {!modal && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                  <button onClick={function() { setModal("schedule"); }} style={{ padding:"13px 8px", minHeight:52, borderRadius:14, border:"none", background:"linear-gradient(135deg,#059669,#047857)", color:"white", fontSize:12, fontWeight:800, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <span style={{ fontSize:18 }}>✅</span> Terima & Jadwalkan
                  </button>
                  <button onClick={function() { setModal("disposisi"); }} style={{ padding:"13px 8px", minHeight:52, borderRadius:14, border:"none", background:"linear-gradient(135deg,#7C3AED,#5B21B6)", color:"white", fontSize:12, fontWeight:800, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <span style={{ fontSize:18 }}>↩</span> Disposisi
                  </button>
                  <button onClick={function() { setModal("tolak"); }} style={{ padding:"13px 8px", minHeight:52, borderRadius:14, background:"#FEF2F2", color:"#DC2626", fontSize:12, fontWeight:800, cursor:"pointer", border:"1.5px solid #FECACA", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <span style={{ fontSize:18 }}>❌</span> Tolak
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  VIEW 4 & 5 (Ajudan & ReadOnly) - Tetap persis sama
// ══════════════════════════════════════════════════════════
// ... (Kode AjudanView dan ReadOnlyView tetap sama persis seperti versi Bapak sebelumnya. Tidak ada logika yang berubah di sana, karena mereka berurusan dengan tamu yang statusnya sudah "accepted" / selesai).

// (Disalin ulang dari kode original Bapak agar utuh)
function AjudanView({ role, isMobile }) {
  var [guests,  setGuests]  = useState([]);
  var [loading, setLoading] = useState(true);
  var pimpinanTarget = role === "ajudan_walikota" ? "walikota" : "wakilwalikota";

  useEffect(function() {
    setLoading(true);
    fetch(API + "?action=queue&status=accepted&pimpinan=" + pimpinanTarget + "&limit=50")
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var today    = todayStr();
        var tomorrow = tomorrowStr();
        var filtered = (Array.isArray(d) ? d : []).filter(function(g) {
          var sd = g.scheduled_date || "";
          return sd === today || sd === tomorrow;
        });
        filtered.sort(function(a, b) {
          var ka = (a.scheduled_date || "") + (a.scheduled_time || "");
          var kb = (b.scheduled_date || "") + (b.scheduled_time || "");
          return ka.localeCompare(kb);
        });
        setGuests(filtered);
      })
      .catch(function() { setGuests([]); })
      .finally(function() { setLoading(false); });
  }, [pimpinanTarget]);

  var today    = todayStr();
  var tomorrow = tomorrowStr();
  var todayList    = guests.filter(function(g) { return g.scheduled_date === today; });
  var tomorrowList = guests.filter(function(g) { return g.scheduled_date === tomorrow; });

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>
      <div style={{ background:"linear-gradient(160deg," + NAVY + ",#1A2F5E)", padding: isMobile ? "20px 16px" : "24px 28px" }}>
        <div style={{ color:GOLD, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>Mode Penyambutan</div>
        <div style={{ color:"white", fontSize:isMobile?18:21, fontWeight:900, marginBottom:4 }}>Tamu Disetujui Pimpinan</div>
        <div style={{ color:"rgba(255,255,255,0.45)", fontSize:12 }}>{role === "ajudan_walikota" ? "Wali Kota" : "Wakil Wali Kota"} · Hari ini &amp; Besok</div>
      </div>
      <div style={{ padding: isMobile ? "14px" : "20px 28px" }}>
        {loading ? <SkeletonList/> : guests.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px 24px" }}><div style={{ fontSize:40, marginBottom:14 }}>📋</div><div style={{ fontSize:16, fontWeight:700, color:NAVY, marginBottom:8 }}>Belum ada tamu terjadwal</div></div>
          ) : (
            <>
              {todayList.length > 0 && <div><div style={dayHeader}>🗓 Hari Ini — {fmtDateLong(today)}</div>{todayList.map(function(g) { return <AjudanCard key={g.id} guest={g}/>; })}</div>}
              {tomorrowList.length > 0 && <div style={{ marginTop: todayList.length > 0 ? 20 : 0 }}><div style={dayHeader}>🗓 Besok — {fmtDateLong(tomorrow)}</div>{tomorrowList.map(function(g) { return <AjudanCard key={g.id} guest={g}/>; })}</div>}
            </>
          )}
      </div>
    </div>
  );
}

function AjudanCard({ guest }) {
  var pc = PRIORITY_CONFIG[guest.priority] || PRIORITY_CONFIG.biasa;
  return (
    <div style={{ background:"white", borderRadius:16, marginBottom:10, overflow:"hidden", boxShadow:"0 2px 10px rgba(10,22,40,0.07)", border:"1.5px solid " + pc.ring }}>
      <div style={{ background: "linear-gradient(135deg," + NAVY + "," + NAVY_MID + ")", padding:"8px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ color:GOLD, fontSize:15, fontWeight:900 }}>{guest.scheduled_time ? guest.scheduled_time + " WITA" : "Jam belum ditentukan"}</span>
        <span style={{ background:pc.bg, color:pc.color, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:700 }}>{pc.label}</span>
      </div>
      <div style={{ padding:"12px 16px" }}>
        <div style={{ fontSize:16, fontWeight:800, color:NAVY, marginBottom:3 }}>{guest.name}</div>
        {guest.organization && <div style={{ fontSize:12, color:"#64748B", marginBottom:4 }}>🏢 {guest.organization}</div>}
        <div style={{ fontSize:12, color:"#64748B", marginBottom:6 }}>📱 {guest.phone}{guest.tujuan_pejabat && <span style={{ marginLeft:8 }}>→ {getPejabatLabel(guest.tujuan_pejabat)}</span>}</div>
        <div style={{ background:"#F8FAFC", borderRadius:9, padding:"8px 11px", fontSize:13, color:NAVY, lineHeight:1.5 }}>{guest.purpose}</div>
        {guest.kabag_notes && <div style={{ marginTop:7, background:"#EDE9FE", borderRadius:8, padding:"7px 10px", fontSize:12, color:"#4C1D95" }}>📌 Catatan Kabag: {guest.kabag_notes}</div>}
      </div>
    </div>
  );
}

function ReadOnlyView({ role, isMobile }) {
  var [guests,  setGuests]  = useState([]);
  var [loading, setLoading] = useState(true);
  var [filterSt, setFilterSt] = useState("accepted");

  useEffect(function() {
    setLoading(true);
    fetch(API + "?action=queue&status=" + filterSt + "&limit=50").then(function(r) { return r.json(); }).then(function(d) { setGuests(Array.isArray(d) ? d : []); }).catch(function() { setGuests([]); }).finally(function() { setLoading(false); });
  }, [filterSt]);

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>
      <div style={{ background:"linear-gradient(160deg," + NAVY + ",#1A2F5E)", padding: isMobile ? "20px 16px" : "24px 28px" }}>
        <div style={{ color:GOLD, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>Manajemen Tamu — Hanya Lihat</div>
        <div style={{ color:"white", fontSize:isMobile?18:21, fontWeight:900, marginBottom:4 }}>Daftar Tamu Audiensi</div>
      </div>
      <div style={{ padding:"12px 16px 0", display:"flex", gap:6, flexWrap:"wrap" }}>
        {[{ k:"accepted", l:"Disetujui Pimpinan" },{ k:"forwarded", l:"Di Proses Pimpinan" },{ k:"all", l:"Semua" }].map(function(f) {
          var active = filterSt === f.k;
          return <button key={f.k} onClick={function() { setFilterSt(f.k); }} style={{ padding:"5px 13px", borderRadius:20, fontSize:11, fontWeight:700, border:"1.5px solid " + (active ? NAVY : "#D1D9E6"), background: active ? NAVY : "white", color: active ? "white" : "#64748B", cursor:"pointer" }}>{f.l}</button>;
        })}
      </div>
      <div style={{ padding:"12px 16px" }}>
        {loading ? <SkeletonList/> : guests.length === 0 ? <EmptyGuest label="Belum ada data" /> : guests.map(function(g) { return <ReadOnlyCard key={g.id} guest={g}/>; })}
      </div>
    </div>
  );
}

function ReadOnlyCard({ guest }) {
  var pc = PRIORITY_CONFIG[guest.priority] || PRIORITY_CONFIG.biasa;
  var sc = STATUS_LABEL[guest.status]       || STATUS_LABEL.waiting;
  return (
    <div style={{ background:"white", borderRadius:14, marginBottom:9, overflow:"hidden", border:"1.5px solid #E8EDF4", boxShadow:"0 1px 6px rgba(10,22,40,0.05)" }}>
      <div style={{ padding:"12px 14px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:6 }}>
          <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:14, fontWeight:800, color:NAVY, marginBottom:2 }}>{guest.name}</div>{guest.organization && <div style={{ fontSize:11, color:"#64748B" }}>🏢 {guest.organization}</div>}</div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}><span style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:700 }}>{sc.text}</span></div>
        </div>
        <div style={{ fontSize:12, color:"#334155", lineHeight:1.5, marginBottom:6 }}>📋 {guest.purpose}</div>
      </div>
    </div>
  );
}

// Komponen Pembantu UI Tetap Sama
function ModalOverlay({ onClose, children }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(10,22,40,0.65)", backdropFilter:"blur(3px)", display:"flex", alignItems:"flex-end", padding: 0 }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ width:"100%", maxWidth:520, margin:"0 auto", background:"white", borderRadius:"20px 20px 0 0", padding:"20px 18px 28px", maxHeight:"92vh", overflowY:"auto", boxShadow:"0 -12px 40px rgba(10,22,40,0.2)" }}>
        {children}
      </div>
    </div>
  );
}

function SectionCard({ title, accent, children }) {
  return (
    <div style={{ background:"white", borderRadius:14, marginBottom:14, overflow:"hidden", border:"1px solid " + (accent ? accent : "#E8EDF4"), boxShadow:"0 1px 6px rgba(10,22,40,0.04)" }}>
      <div style={{ padding:"10px 14px", borderBottom:"1px solid " + (accent ? accent + "60" : "#F1F5F9"), background: accent ? (accent + "12") : "#FAFBFF", fontSize:12, fontWeight:800, color:NAVY }}>{title}</div>
      <div style={{ padding:"12px 14px" }}>{children}</div>
    </div>
  );
}

function InfoGrid({ rows }) {
  return (
    <dl style={{ margin:0 }}>
      {rows.map(function(row) { return <div key={row.l} style={{ display:"grid", gridTemplateColumns:"110px 1fr", gap:8, padding:"5px 0", borderBottom:"1px solid #F1F5F9" }}><dt style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:.4, paddingTop:2 }}>{row.l}</dt><dd style={{ fontSize:13, color:NAVY, fontWeight:500, margin:0, lineHeight:1.5 }}>{row.v}</dd></div>; })}
    </dl>
  );
}

function StatPill({ label, value, color }) {
  return <div style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:20, padding:"5px 12px", display:"flex", alignItems:"center", gap:6 }}><span style={{ fontSize:15, fontWeight:900, color: color }}>{value}</span><span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>{label}</span></div>;
}

function SkeletonList() {
  return <div>{[0,1,2,3].map(function(i) { return <div key={i} style={{ background:"white", borderRadius:14, marginBottom:9, padding:14, border:"1px solid #E8EDF4", opacity: 1 - i * 0.18 }}><div style={{ height:14, borderRadius:6, background:"#F1F5F9", width:"60%", marginBottom:8 }}/><div style={{ height:11, borderRadius:5, background:"#F8FAFC", width:"40%" }}/></div>; })}</div>;
}

function EmptyGuest({ label }) {
  return <div style={{ textAlign:"center", padding:"48px 24px" }}><div style={{ fontSize:40, marginBottom:12 }}>👥</div><div style={{ fontSize:15, fontWeight:700, color:NAVY, marginBottom:6 }}>Tidak ada data</div><div style={{ fontSize:13, color:"#64748B" }}>{label}</div></div>;
}

function Spinner({ color }) {
  return <span style={{ width:14, height:14, borderRadius:"50%", border:"2.5px solid rgba(255,255,255,0.25)", borderTopColor: color || "white", animation:"gd_spin .7s linear infinite", display:"inline-block", flexShrink:0 }}/>;
}

// ── BukuPanduanModal: Panduan SOP lengkap ──────────────────
function BukuPanduanModal({ onClose }) {
  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontSize:17, fontWeight:900, color:NAVY }}>📖 Buku Panduan SOP Tamu</div>
        <button onClick={onClose} style={closeXStyle}>✕</button>
      </div>
      <div style={{ fontSize:11, color:"#92400E", marginBottom:14, background:"#FFFBEB", borderRadius:9, padding:"9px 12px", border:"1px solid #FDE68A", lineHeight:1.5 }}>
        ⚠️ {SOP_DISCLAIMER}
      </div>
      {SOP_BAGIAN.map(function(bagian) {
        return (
          <div key={bagian.bagian} style={{ marginBottom:16, borderRadius:12, border:"1.5px solid " + bagian.warnaBorder, background:bagian.warnaBg, overflow:"hidden" }}>
            <div style={{ background:bagian.warna, padding:"9px 14px", display:"flex", alignItems:"center", gap:9 }}>
              <span style={{ fontSize:18 }}>{bagian.icon}</span>
              <div>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.65)", fontWeight:700, letterSpacing:1, textTransform:"uppercase" }}>{bagian.bagian}</div>
                <div style={{ fontSize:13, color:"white", fontWeight:800 }}>{bagian.judul}</div>
              </div>
            </div>
            {bagian.kelompok.map(function(kel, ki) {
              return (
                <div key={ki} style={{ padding:"11px 14px", borderBottom: ki < bagian.kelompok.length - 1 ? ("1px solid " + bagian.warnaBorder) : "none" }}>
                  <div style={{ fontSize:12, fontWeight:800, color:kel.warna, marginBottom:2 }}>{kel.label}</div>
                  {kel.sublabel && <div style={{ fontSize:10, color:kel.warna, opacity:0.75, marginBottom:6 }}>{kel.sublabel}</div>}
                  {kel.isi.map(function(item, ii) {
                    return (
                      <div key={ii} style={{ fontSize:12, color:"#334155", marginBottom:3, lineHeight:1.55 }}>
                        {item.bold && <strong style={{ color:kel.warna }}>{item.bold} </strong>}
                        {item.teks}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
      <button onClick={onClose} style={Object.assign({}, cancelBtnStyle, { width:"100%", marginTop:6, textAlign:"center" })}>Tutup</button>
    </ModalOverlay>
  );
}

// ── InputManualModal: Form input manual tamu oleh Admin RK ──
function InputManualModal({ user, onClose, onSuccess }) {
  var emptyForm = { name:"", organization:"", phone:"", tujuan_pejabat:"walikota", purpose:"", message:"", priority:"biasa" };
  var [form, setForm] = useState(emptyForm);
  var [loading, setLoading] = useState(false);
  var [errors, setErrors] = useState({});

  function set(field, val) {
    setForm(function(prev) {
      var next = {};
      Object.keys(prev).forEach(function(k) { next[k] = prev[k]; });
      next[field] = val;
      return next;
    });
    if (errors[field]) {
      setErrors(function(prev) {
        var next = {};
        Object.keys(prev).forEach(function(k) { next[k] = prev[k]; });
        delete next[field];
        return next;
      });
    }
  }

  function validate() {
    var e = {};
    if (!form.name.trim())    e.name    = "Nama wajib diisi";
    if (!form.phone.trim())   e.phone   = "Nomor WhatsApp wajib diisi";
    if (!form.purpose.trim()) e.purpose = "Keperluan wajib diisi";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      var SUPA_URL = (typeof import.meta !== "undefined" && import.meta.env)
        ? (import.meta.env.VITE_SUPABASE_URL || "") : "";
      var SUPA_KEY = (typeof import.meta !== "undefined" && import.meta.env)
        ? (import.meta.env.VITE_SUPABASE_ANON_KEY || "") : "";

      if (!SUPA_URL || !SUPA_KEY) {
        throw new Error("Konfigurasi sistem belum lengkap. Hubungi Admin.");
      }

      // Normalisasi nomor HP: pastikan diawali 62
      var rawPhone = form.phone.trim().replace(/\D/g, "");
      var noWa = rawPhone.startsWith("62") ? rawPhone
               : rawPhone.startsWith("0")  ? "62" + rawPhone.slice(1)
               : rawPhone.startsWith("8")  ? "62" + rawPhone
               : rawPhone;

      // Kolom Supabase mengikuti skema TamuPage (nama, instansi, no_wa, dst.)
      var insertPayload = {
        nama:             form.name.trim(),
        instansi:         form.organization.trim() || "-",
        no_wa:            noWa,
        tujuan_pejabat:   form.tujuan_pejabat === "wakilwalikota" ? "Wakil Wali Kota" : "Wali Kota",
        maksud_keperluan: form.purpose.trim(),
        pesan:            form.message.trim() || null,
        status:           "pending_kasubbag", // langsung masuk antrian Kasubbag
      };

      var r = await fetch(SUPA_URL + "/rest/v1/permohonan_tamu", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "apikey":        SUPA_KEY,
          "Authorization": "Bearer " + SUPA_KEY,
          "Prefer":        "return=minimal",
        },
        body: JSON.stringify(insertPayload),
      });

      if (!r.ok) {
        var errData = await r.json().catch(function() { return {}; });
        var pgMsg   = errData.message || errData.details || errData.hint || "";
        // Pesan error spesifik
        if (pgMsg.toLowerCase().includes("no_wa") && pgMsg.toLowerCase().includes("unique")) {
          throw new Error("Nomor WhatsApp " + form.phone + " sudah memiliki permohonan aktif.");
        }
        if (pgMsg.toLowerCase().includes("violates") || pgMsg.toLowerCase().includes("duplicate")) {
          throw new Error("Data duplikat: " + (pgMsg || "Periksa kembali isian formulir."));
        }
        throw new Error(pgMsg || "Gagal menyimpan. Coba lagi atau hubungi Admin.");
      }

      onSuccess();
    } catch(e) {
      setErrors({ submit: e.message });
    } finally {
      setLoading(false);
    }
  }

  var fieldBox = { marginBottom:13 };
  var errStyle = { fontSize:11, color:"#DC2626", marginTop:4, fontWeight:600 };

  return (
    <ModalOverlay onClose={onClose}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <div>
          <div style={{ fontSize:17, fontWeight:900, color:NAVY }}>✍️ Input Manual Tamu</div>
          <div style={{ fontSize:11, color:"#64748B", marginTop:2 }}>Diinput oleh staf Admin RK · Langsung masuk antrian Kasubbag</div>
        </div>
        <button onClick={onClose} style={closeXStyle}>✕</button>
      </div>

      {/* Nama */}
      <div style={fieldBox}>
        <label style={sectionSubLabel}>Nama Lengkap *</label>
        <input
          value={form.name}
          onChange={function(e) { set("name", e.target.value); }}
          placeholder="Nama lengkap tamu..."
          style={Object.assign({}, inputStyle, errors.name ? { borderColor:"#EF4444" } : {})}
        />
        {errors.name && <div style={errStyle}>⚠ {errors.name}</div>}
      </div>

      {/* Instansi */}
      <div style={fieldBox}>
        <label style={sectionSubLabel}>Instansi / Organisasi</label>
        <input
          value={form.organization}
          onChange={function(e) { set("organization", e.target.value); }}
          placeholder="Opsional — cth: DPR Tarakan, FKUB, dst."
          style={inputStyle}
        />
      </div>

      {/* WhatsApp */}
      <div style={fieldBox}>
        <label style={sectionSubLabel}>Nomor WhatsApp *</label>
        <input
          type="tel"
          value={form.phone}
          onChange={function(e) { set("phone", e.target.value); }}
          placeholder="08xx-xxxx-xxxx"
          style={Object.assign({}, inputStyle, errors.phone ? { borderColor:"#EF4444" } : {})}
        />
        {errors.phone && <div style={errStyle}>⚠ {errors.phone}</div>}
      </div>

      {/* Tujuan Pimpinan */}
      <div style={fieldBox}>
        <label style={sectionSubLabel}>Tujuan Pimpinan *</label>
        <select
          value={form.tujuan_pejabat}
          onChange={function(e) { set("tujuan_pejabat", e.target.value); }}
          style={inputStyle}
        >
          <option value="walikota">Wali Kota</option>
          <option value="wakilwalikota">Wakil Wali Kota</option>
        </select>
      </div>

      {/* Keperluan */}
      <div style={fieldBox}>
        <label style={sectionSubLabel}>Keperluan / Maksud Kunjungan *</label>
        <textarea
          value={form.purpose}
          onChange={function(e) { set("purpose", e.target.value); }}
          rows={3}
          placeholder="Uraikan maksud dan keperluan tamu..."
          style={Object.assign({}, textareaStyle, errors.purpose ? { borderColor:"#EF4444" } : {})}
        />
        {errors.purpose && <div style={errStyle}>⚠ {errors.purpose}</div>}
      </div>

      {/* Pesan Tambahan */}
      <div style={fieldBox}>
        <label style={sectionSubLabel}>Keterangan Tambahan</label>
        <textarea
          value={form.message}
          onChange={function(e) { set("message", e.target.value); }}
          rows={2}
          placeholder="Opsional — informasi lain yang perlu disampaikan..."
          style={textareaStyle}
        />
      </div>

      {/* Prioritas */}
      <div style={{ marginBottom:18 }}>
        <label style={sectionSubLabel}>Prioritas Awal</label>
        <div style={{ display:"flex", gap:8 }}>
          {Object.entries(PRIORITY_CONFIG).map(function(entry) {
            var k = entry[0]; var c = entry[1];
            var active = form.priority === k;
            return (
              <button
                key={k}
                onClick={function() { set("priority", k); }}
                style={{ flex:1, padding:"9px 6px", borderRadius:11, border:"2px solid " + (active ? c.color : "#E2E8F0"), background: active ? c.bg : "white", color: active ? c.color : "#64748B", fontSize:11, fontWeight:700, cursor:"pointer", transition:"all 0.15s", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}
              >
                <span style={{ width:9, height:9, borderRadius:"50%", background:c.dot, flexShrink:0 }}/>
                {c.label}
                {active && <span style={{ fontSize:9 }}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error submit */}
      {errors.submit && (
        <div style={{ background:"#FEF2F2", borderRadius:9, padding:"10px 12px", marginBottom:12, fontSize:12, color:"#DC2626", fontWeight:600 }}>
          ❌ {errors.submit}
        </div>
      )}

      {/* Tombol */}
      <div style={{ display:"flex", gap:8 }}>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ flex:2, padding:"13px", borderRadius:11, border:"none", background: loading ? "#94A3B8" : ("linear-gradient(135deg," + NAVY + "," + NAVY_MID + ")"), color:"white", fontSize:13, fontWeight:800, cursor: loading ? "not-allowed" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
        >
          {loading ? <Spinner/> : null}
          {loading ? "Menyimpan..." : "💾 Simpan & Masukkan ke Antrian"}
        </button>
        <button onClick={onClose} style={cancelBtnStyle}>Batal</button>
      </div>
    </ModalOverlay>
  );
}

// ── GuestCardItem: Kartu tamu untuk list KasubbagView ──────
function GuestCardItem({ guest, onClick, showPriority, showStaffNote }) {
  var pc = PRIORITY_CONFIG[guest.priority] || PRIORITY_CONFIG.biasa;
  var sc = STATUS_LABEL[guest.status]     || STATUS_LABEL.waiting;
  return (
    <div
      onClick={onClick}
      style={{ background:"white", borderRadius:16, marginBottom:10, overflow:"hidden", boxShadow:"0 2px 8px rgba(10,22,40,0.06)", border:"1.5px solid #E8EDF4", cursor:"pointer", WebkitTapHighlightColor:"transparent" }}
    >
      {/* Priority bar */}
      <div style={{ height:4, background: guest.priority === "mendesak" ? "linear-gradient(90deg,#EF4444,#B91C1C)" : guest.priority === "penting" ? "linear-gradient(90deg,#F59E0B,#D97706)" : "linear-gradient(90deg,#10B981,#059669)" }}/>

      <div style={{ padding:"12px 14px" }}>
        {/* Baris atas: nama + badge */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:6 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:800, color:NAVY, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{guest.name}</div>
            {guest.organization && <div style={{ fontSize:11, color:"#64748B" }}>🏢 {guest.organization}</div>}
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
            {showPriority && (
              <span style={{ background:pc.bg, color:pc.color, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:700 }}>{pc.label}</span>
            )}
            <span style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:700 }}>{sc.text}</span>
          </div>
        </div>

        {/* Keperluan */}
        <div style={{ fontSize:12, color:"#475569", lineHeight:1.5, marginBottom:6, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
          📋 {guest.purpose}
        </div>

        {/* Catatan staf */}
        {showStaffNote && guest.staff_notes && (
          <div style={{ background:"#F0F9FF", borderRadius:8, padding:"6px 10px", fontSize:11, color:"#0369A1", marginBottom:6, lineHeight:1.45 }}>
            📝 {guest.staff_notes}
          </div>
        )}

        {/* Footer: telp + waktu */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:11, color:"#94A3B8" }}>📱 {guest.phone}</span>
          <span style={{ fontSize:11, color:"#94A3B8" }}>{fmtTs(guest.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

var backBtnStyle = { background:"rgba(255,255,255,0.1)", border:"none", borderRadius:10, padding:"8px 13px", color:"white", cursor:"pointer", fontSize:12, fontWeight:700, flexShrink:0 };
var closeXStyle = { width:32, height:32, borderRadius:8, border:"1.5px solid #E2E8F0", background:"white", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"#64748B" };
var cancelBtnStyle = { padding:"10px 14px", borderRadius:10, border:"1.5px solid #E2E8F0", background:"white", color:"#64748B", fontSize:12, fontWeight:700, cursor:"pointer" };
var inputStyle = { width:"100%", padding:"11px 13px", minHeight:44, borderRadius:11, border:"1.5px solid #D1D9E6", fontSize:14, color:NAVY, background:"white", outline:"none", fontFamily:"inherit", WebkitAppearance:"none" };
var textareaStyle = { width:"100%", padding:"11px 13px", borderRadius:11, border:"1.5px solid #D1D9E6", fontSize:14, color:NAVY, background:"white", outline:"none", resize:"vertical", lineHeight:1.55, fontFamily:"inherit" };
var sectionSubLabel = { display:"block", fontSize:11, fontWeight:700, color:"#4b6280", letterSpacing:.5, textTransform:"uppercase", marginBottom:6 };
var dayHeader = { fontSize:12, fontWeight:800, color:NAVY, textTransform:"uppercase", letterSpacing:.8, marginBottom:10, paddingBottom:6, borderBottom:"2px solid " + GOLD };
function navBtnStyle(disabled) { return { padding:"7px 14px", borderRadius:10, border:"1.5px solid #E2E8F0", background: disabled ? "#F8FAFC" : "white", color: disabled ? "#CBD5E1" : NAVY, cursor: disabled ? "default" : "pointer", fontSize:12, fontWeight:700 }; }
