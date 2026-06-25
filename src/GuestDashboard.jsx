/**
 * src/GuestDashboard.jsx — Prokopim v2.0
 * Manajemen Tamu Berjenjang:
 *   Admin RK → Kasubbag Protokol → Kabag Prokopim → Wali Kota/Wakil → Ajudan
 *
 * STATUS FLOW:
 *   pending_rk → pending_kasubbag → pending_kabag → pending_pimpinan
 *   → approved | rejected | disposed
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { TAMU_STATUS, PRIORITY_COLORS } from "./lib/statusColors.js";

// ── Design Tokens ─────────────────────────────────────────────
var NAVY     = "#0A1628";
var NAVY_MID = "#163265";
var NAVY_L   = "#1E3A6E";
var GOLD     = "#C9A84C";
var GOLD_L   = "#F5E6BE";
var API      = "/api/guest";

var SUPA_URL = typeof import.meta !== "undefined" && import.meta.env
  ? (import.meta.env.VITE_SUPABASE_URL || "") : "";
var SUPA_KEY = typeof import.meta !== "undefined" && import.meta.env
  ? (import.meta.env.VITE_SUPABASE_ANON_KEY || "") : "";

// ── Konfigurasi Status ────────────────────────────────────────
// Diimpor dari src/lib/statusColors.js agar warna status konsisten
// dengan dashboard jadwal & komponen lainnya.
var STATUS_CFG   = TAMU_STATUS;
var PRIORITY_CFG = PRIORITY_COLORS;

// ── Helpers ───────────────────────────────────────────────────
function todayStr() { return new Date(Date.now()+8*3600000).toISOString().slice(0,10); }
function tomorrowStr() { return new Date(Date.now()+8*3600000+86400000).toISOString().slice(0,10); }
function toMin(jam) { if(!jam)return 0; var p=jam.split(":"); return +p[0]*60+(+p[1]||0); }
function fmtTs(str) {
  if(!str) return "-";
  return new Date(str).toLocaleString("id-ID",{timeZone:"Asia/Makassar",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function fmtDate(str) {
  if(!str) return "-";
  var HARI  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  var BULAN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
  var d = new Date(str+"T00:00:00+08:00");
  return HARI[d.getDay()]+", "+d.getDate()+" "+BULAN[d.getMonth()]+" "+d.getFullYear();
}
function gName(g)     { return g.nama     || g.name         || "–"; }
function gInstansi(g) { return g.instansi || g.organization || "–"; }
function gPhone(g)    { return g.no_wa    || g.phone        || "–"; }
function gTujuan(g)   { return g.tujuan_pejabat || "–"; }
function gMaksud(g)   { return g.maksud_keperluan || g.purpose || "–"; }
function gPesan(g)    { return g.pesan   || g.message      || ""; }
function gPrioritas(g){ return g.prioritas|| g.priority     || "biasa"; }

async function apiPost(action, body) {
  var r = await fetch(API+"?action="+action, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify(body),
  });
  var data = await r.json().catch(function(){return{};});
  if(!r.ok) throw new Error(data.error || "Gagal (HTTP "+r.status+")");
  return data;
}

// ══════════════════════════════════════════════════════════════
//  GLOBAL CSS
// ══════════════════════════════════════════════════════════════
var GD_CSS = `
  @keyframes gd-fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  @keyframes gd-spin    { to{transform:rotate(360deg)} }
  .gd-card { animation: gd-fadein .25s ease both; }
  .gd-card:hover { box-shadow: 0 6px 28px rgba(10,22,40,0.13)!important; transform: translateY(-1px); transition: all .18s; }
  .gd-btn-act:active { transform: scale(.97); }
  .gd-inp:focus { border-color: ${NAVY}!important; box-shadow: 0 0 0 3px rgba(10,22,40,0.12)!important; outline:none; }
  .gd-tab-active { background: ${NAVY}!important; color: white!important; border-color: ${NAVY}!important; }
`;

// ══════════════════════════════════════════════════════════════
//  ROOT ROUTER
// ══════════════════════════════════════════════════════════════
export default function GuestDashboard({ role, user, events, showT, isMobile }) {
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
      <style>{GD_CSS}</style>
      {(role==="admin_rk") &&
        <AdminRKView    user={user} events={events} showT={showT} isMobile={isMobile}/>}
      {(role==="kasubbag_protokol") &&
        <KasubbagView   user={user} showT={showT} isMobile={isMobile}/>}
      {(role==="kabag") &&
        <KabagView      user={user} showT={showT} isMobile={isMobile}/>}
      {(role==="walikota"||role==="wakilwalikota") &&
        <PimpinanView   role={role} user={user} events={events} showT={showT} isMobile={isMobile}/>}
      {(role==="ajudan_walikota"||role==="ajudan_wakilwalikota") &&
        <AjudanView     role={role} user={user} events={events} showT={showT} isMobile={isMobile}/>}
      {(role==="kasubbag_komdokpim"||role==="timkom") &&
        <ReadOnlyView   isMobile={isMobile}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  VIEW 1 — ADMIN RK: Pintu Pertama
// ══════════════════════════════════════════════════════════════
function AdminRKView({ user, events, showT, isMobile }) {
  var [guests,     setGuests]     = useState([]);
  var [loading,    setLoading]    = useState(true);
  var [tab,        setTab]        = useState("pending_rk");
  var [detail,     setDetail]     = useState(null);
  var [lastLoaded, setLastLoaded] = useState(null);
  var [q,          setQ]          = useState("");

  var load = useCallback(function() {
    setLoading(true);
    fetch(API+"?action=queue&status="+tab+"&limit=60")
      .then(function(r){return r.json();})
      .then(function(d){setGuests(Array.isArray(d)?d:[]); setLastLoaded(new Date());})
      .catch(function(){setGuests([]);})
      .finally(function(){setLoading(false);});
  }, [tab]);

  useEffect(function(){load();}, [load]);

  var removeFromList = function(){setGuests(function(prev){return prev.filter(function(g){return g.id!==detail.id;});}); setDetail(null);};

  if(detail) {
    // Permohonan di tahap akhir → Admin RK boleh menetapkan jadwal
    if(detail.status==="pending_pimpinan") return (
      <PimpinanDetail
        guest={detail} role="admin_rk" user={user} events={events}
        showT={showT} isMobile={isMobile}
        onBack={function(){setDetail(null);}} onDone={removeFromList}
      />
    );
    return (
      <AdminRKDetail
        guest={detail} user={user} showT={showT} isMobile={isMobile}
        onBack={function(){setDetail(null);}} onDone={removeFromList}
      />
    );
  }

  var TABS = [
    {k:"pending_rk",       l:"Baru Masuk"},
    {k:"pending_kasubbag", l:"Diteruskan"},
    {k:"pending_pimpinan", l:"📅 Siap Dijadwalkan"},
    {k:"rejected",         l:"Ditolak"},
    {k:"all",              l:"🔎 Lacak Semua"},
  ];
  var shown = tab==="all" ? filterByQuery(guests, q) : guests;

  return (
    <div style={{flex:1,overflowY:"auto",background:"#F0F4FA",paddingBottom:40}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,"+NAVY+" 0%,"+NAVY_L+" 100%)",padding:isMobile?"20px 16px":"28px 32px"}}>
        <div style={{color:GOLD,fontSize:10,fontWeight:700,letterSpacing:2.5,textTransform:"uppercase",marginBottom:6}}>
          Manajemen Tamu — Lapis Pertama
        </div>
        <div style={{color:"white",fontSize:isMobile?20:24,fontWeight:900,marginBottom:12,letterSpacing:-.3}}>
          📋 Monitoring Tamu Masuk
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <ChipStat label="Baru masuk" value={guests.filter(g=>g.status==="pending_rk").length} color="#FCA5A5"/>
        </div>
      </div>

      {/* Tabs */}
      <div style={{padding:"14px 16px 0",display:"flex",gap:6,flexWrap:"wrap"}}>
        {TABS.map(function(t){
          return <TabBtn key={t.k} label={t.l} active={tab===t.k} onClick={function(){setTab(t.k);}}/>;
        })}
      </div>

      {tab==="all" && <TrackSearch value={q} onChange={setQ}/>}
      <MetaBar lastLoaded={lastLoaded} onRefresh={load} loading={loading}/>

      {/* List */}
      <div style={{padding:"12px 16px"}}>
        {loading ? <SkeletonList/> : shown.length===0 ? <EmptyState label="Tidak ada permohonan di kategori ini"/> :
          shown.map(function(g){
            return <GuestCard key={g.id} guest={g} onClick={function(){setDetail(g);}} showChain={tab==="all"}/>;
          })
        }
      </div>
    </div>
  );
}

function AdminRKDetail({ guest, user, showT, isMobile, onBack, onDone }) {
  var [catatan, setCatatan] = useState(guest.catatan_rk || "");
  var [loading, setLoading] = useState(false);
  var [konfirm, setKonfirm] = useState(null); // "teruskan"|"tolak"
  var done = onDone || onBack;

  async function teruskan() {
    setLoading(true);
    try {
      await apiPost("verify_rk", {
        id: guest.id,
        catatan_rk: catatan.trim(),
        admin_name: user?.nama || user?.username,
      });
      showT("✅ Diteruskan ke Kasubbag Protokol");
      done();
    } catch(e) { showT("❌ "+e.message); }
    finally { setLoading(false); setKonfirm(null); }
  }

  async function tolak() {
    setLoading(true);
    try {
      await apiPost("respond", {
        id: guest.id,
        response: "rejected",
        alasan_tolak: catatan.trim() || "(Ditolak di level Admin RK)",
        responded_by: user?.username,
      });
      showT("Permohonan ditolak");
      done();
    } catch(e) { showT("❌ "+e.message); }
    finally { setLoading(false); setKonfirm(null); }
  }

  return (
    <DetailLayout
      onBack={onBack} isMobile={isMobile}
      title={gName(guest)} subtitle="Detail Permohonan Tamu"
      badge={<StatusBadge status={guest.status}/>}
    >
      <DataTamu guest={guest}/>

      {/* Catatan/Instruksi dari Kasubbag — tampil mencolok bila dikembalikan */}
      {guest.status==="pending_rk" && guest.catatan_staf && (
        <div style={{background:"linear-gradient(135deg,#FEF3C7,#FDE68A)",border:"2px solid #F59E0B",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:800,color:"#92400E",letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>
            ↩ Catatan Kasubbag — Mohon Ditindaklanjuti
          </div>
          <div style={{fontSize:14,color:"#78350F",lineHeight:1.55,fontWeight:600,whiteSpace:"pre-wrap"}}>
            {guest.catatan_staf}
          </div>
        </div>
      )}

      <CardSection title="📝 Catatan Admin RK" accent="#3B82F6">
        <textarea
          className="gd-inp"
          value={catatan}
          onChange={function(e){setCatatan(e.target.value);}}
          rows={3}
          placeholder="Tambahkan catatan verifikasi awal (opsional)..."
          style={inpStyle}
        />
        <div style={{fontSize:11,color:"#94A3B8",marginTop:4}}>
          Catatan ini akan terlihat oleh Kasubbag Protokol dan Kabag.
        </div>
      </CardSection>

      {konfirm==="teruskan" && (
        <KonfirmasiBox
          pesan={"Teruskan permohonan dari "+gName(guest)+" ke Kasubbag Protokol?"}
          onYa={teruskan} onBatal={function(){setKonfirm(null);}} loading={loading}
          warna="#059669"
        />
      )}
      {konfirm==="tolak" && (
        <KonfirmasiBox
          pesan={"Tolak permohonan dari "+gName(guest)+"? Pastikan catatan alasan sudah diisi."}
          onYa={tolak} onBatal={function(){setKonfirm(null);}} loading={loading}
          warna="#DC2626"
        />
      )}

      {!konfirm && guest.status==="pending_rk" && (
        <div style={{display:"flex",gap:10,marginTop:4}}>
          <ActionBtn
            label="✅ Verifikasi & Teruskan ke Kasubbag"
            color="#059669" flex={3}
            onClick={function(){setKonfirm("teruskan");}}
          />
          <ActionBtn
            label="❌ Tolak"
            color="#DC2626" flex={1} outline
            onClick={function(){setKonfirm("tolak");}}
          />
        </div>
      )}
      {guest.status!=="pending_rk" && (
        <InfoBox type="info" msg={"Permohonan ini sudah "+STATUS_CFG[guest.status]?.label+". Tidak ada aksi lebih lanjut di level ini."}/>
      )}
    </DetailLayout>
  );
}

// ══════════════════════════════════════════════════════════════
//  VIEW 2 — KASUBBAG PROTOKOL
// ══════════════════════════════════════════════════════════════
function KasubbagView({ user, showT, isMobile }) {
  var [guests,     setGuests]     = useState([]);
  var [loading,    setLoading]    = useState(true);
  var [tab,        setTab]        = useState("pending_kasubbag");
  var [detail,     setDetail]     = useState(null);
  var [lastLoaded, setLastLoaded] = useState(null);
  var [q,          setQ]          = useState("");

  var load = useCallback(function() {
    setLoading(true);
    fetch(API+"?action=queue&status="+tab+"&limit=60")
      .then(function(r){return r.json();})
      .then(function(d){setGuests(Array.isArray(d)?d:[]); setLastLoaded(new Date());})
      .catch(function(){setGuests([]);})
      .finally(function(){setLoading(false);});
  }, [tab]);

  useEffect(function(){load();}, [load]);

  if(detail) return (
    <KasubbagDetail
      guest={detail} user={user} showT={showT} isMobile={isMobile}
      onBack={function(){setDetail(null);}}
      onDone={function(){setGuests(function(prev){return prev.filter(function(g){return g.id!==detail.id;});}); setDetail(null);}}
    />
  );

  var TABS = [
    {k:"pending_kasubbag", l:"Menunggu Verifikasi"},
    {k:"pending_kabag",    l:"Sudah ke Kabag"},
    {k:"rejected",         l:"Ditolak"},
    {k:"all",              l:"🔎 Lacak Semua"},
  ];
  var shown = tab==="all" ? filterByQuery(guests, q) : guests;

  return (
    <div style={{flex:1,overflowY:"auto",background:"#F0F4FA",paddingBottom:40}}>
      <div style={{background:"linear-gradient(135deg,#1E3A6E 0%,#2D4F8E 100%)",padding:isMobile?"20px 16px":"28px 32px"}}>
        <div style={{color:GOLD,fontSize:10,fontWeight:700,letterSpacing:2.5,textTransform:"uppercase",marginBottom:6}}>
          Manajemen Tamu — Lapis Kedua
        </div>
        <div style={{color:"white",fontSize:isMobile?20:24,fontWeight:900,marginBottom:12,letterSpacing:-.3}}>
          🔍 Verifikasi Kasubbag Protokol
        </div>
        <ChipStat label="Menunggu verifikasi Anda" value={guests.filter(g=>g.status==="pending_kasubbag").length} color="#93C5FD"/>
      </div>

      <div style={{padding:"14px 16px 0",display:"flex",gap:6,flexWrap:"wrap"}}>
        {TABS.map(function(t){
          return <TabBtn key={t.k} label={t.l} active={tab===t.k} onClick={function(){setTab(t.k);}}/>;
        })}
      </div>

      {tab==="all" && <TrackSearch value={q} onChange={setQ}/>}
      <MetaBar lastLoaded={lastLoaded} onRefresh={load} loading={loading}/>

      <div style={{padding:"12px 16px"}}>
        {loading ? <SkeletonList/> : shown.length===0 ? <EmptyState label="Tidak ada permohonan"/> :
          shown.map(function(g){
            return <GuestCard key={g.id} guest={g} onClick={function(){setDetail(g);}} showChain={tab==="all"}/>;
          })
        }
      </div>
    </div>
  );
}

function KasubbagDetail({ guest, user, showT, isMobile, onBack, onDone }) {
  var done = onDone || onBack;
  var [priority,  setPriority]  = useState(gPrioritas(guest));
  var [catatan,   setCatatan]   = useState(guest.catatan_staf || "");
  var [loading,   setLoading]   = useState(false);
  var [konfirm,   setKonfirm]   = useState(null);
  var [waLoading, setWaLoading] = useState(false);

  async function naikkanKabag() {
    setLoading(true);
    try {
      await apiPost("screen", {
        id: guest.id,
        priority: priority,
        catatan_staf: catatan.trim(),
        screened_by: user?.username,
      });
      showT("✅ Diteruskan ke Kabag Prokopim");
      done();
    } catch(e) { showT("❌ "+e.message); }
    finally { setLoading(false); setKonfirm(null); }
  }

  async function tolak() {
    setLoading(true);
    try {
      await apiPost("respond", {
        id: guest.id, response:"rejected",
        alasan_tolak: catatan.trim() || "(Ditolak di level Kasubbag Protokol)",
        responded_by: user?.username,
      });
      showT("Permohonan ditolak");
      done();
    } catch(e) { showT("❌ "+e.message); }
    finally { setLoading(false); setKonfirm(null); }
  }

  async function kembalikanRK() {
    setLoading(true);
    try {
      await apiPost("return_to_rk", {
        id: guest.id,
        catatan_staf: catatan.trim(),
        returned_by: user?.username,
      });
      showT("Dikembalikan ke Admin RK");
      done();
    } catch(e) { showT("❌ "+e.message); }
    finally { setLoading(false); setKonfirm(null); }
  }

  async function kirimWA() {
    setWaLoading(true);
    try {
      await apiPost("verify_wa", { id: guest.id });
      showT("📱 WA verifikasi terkirim ke "+gPhone(guest));
    } catch(e) { showT("❌ "+e.message); }
    finally { setWaLoading(false); }
  }

  return (
    <DetailLayout
      onBack={onBack} isMobile={isMobile}
      title={gName(guest)} subtitle="Verifikasi Kasubbag Protokol"
      badge={<StatusBadge status={guest.status}/>}
    >
      <DataTamu guest={guest}/>

      {/* Instruksi Kabag — tampil mencolok bila dikembalikan untuk klarifikasi */}
      {guest.status==="pending_kasubbag" && guest.telaah_kabag && (
        <div style={{background:"linear-gradient(135deg,#FEF3C7,#FDE68A)",border:"2px solid #F59E0B",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:800,color:"#92400E",letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>
            ↩ Dikembalikan oleh Kabag — Mohon Ditindaklanjuti
          </div>
          <div style={{fontSize:14,color:"#78350F",lineHeight:1.55,fontWeight:600,whiteSpace:"pre-wrap"}}>
            {guest.telaah_kabag}
          </div>
        </div>
      )}

      {/* Catatan Admin RK */}
      {guest.catatan_rk && (
        <CatatanBox label="📋 Catatan Admin RK" isi={guest.catatan_rk} color="#3B82F6" bg="#EFF6FF"/>
      )}

      {/* WA Verifikasi */}
      <button onClick={kirimWA} disabled={waLoading} style={{
        width:"100%",padding:"11px",borderRadius:12,border:"2px solid #25D366",
        background:"white",color:"#128C7E",fontSize:13,fontWeight:700,cursor:"pointer",
        display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:14,
      }}>
        {waLoading ? <Spin color="#128C7E"/> : "📱"}
        {waLoading ? "Mengirim..." : "Kirim WA Verifikasi ke Tamu"}
      </button>

      {/* Prioritas */}
      {guest.status==="pending_kasubbag" && (
        <CardSection title="🏷 Tetapkan Prioritas" accent="#F59E0B">
          <div style={{fontSize:13,color:"#64748B",marginBottom:8,lineHeight:1.5}}>
            ⚡ <b>Mendesak</b>: perlu respons hari ini &nbsp;·&nbsp;
            ⭐ <b>Penting</b>: respons 1–2 hari &nbsp;·&nbsp;
            📌 <b>Biasa</b>: antrian normal
          </div>
          <div style={{display:"flex",gap:8}}>
            {Object.entries(PRIORITY_CFG).map(function(e){
              var k=e[0]; var c=e[1];
              var active=priority===k;
              return (
                <button key={k} onClick={function(){setPriority(k);}} title={c.label} style={{
                  flex:1,padding:"10px 6px",borderRadius:12,
                  border:"2px solid "+(active?c.color:"#E2E8F0"),
                  background:active?c.bg:"white",color:active?c.color:"#64748B",
                  fontSize:11,fontWeight:700,cursor:"pointer",
                  display:"flex",flexDirection:"column",alignItems:"center",gap:5,
                }}>
                  <span style={{fontSize:18,lineHeight:1}} aria-hidden="true">{c.icon}</span>
                  {c.label}
                  {active&&<span style={{fontSize:9}}>✓ Dipilih</span>}
                </button>
              );
            })}
          </div>
        </CardSection>
      )}

      {/* Catatan */}
      {guest.status==="pending_kasubbag" && (
        <CardSection title="📝 Catatan Verifikasi Kasubbag" accent="#3B82F6">
          <textarea className="gd-inp" value={catatan} onChange={function(e){setCatatan(e.target.value);}}
            rows={3} placeholder="Catatan hasil verifikasi untuk Kabag..." style={inpStyle}/>
        </CardSection>
      )}

      {/* Konfirmasi */}
      {konfirm==="naik" && (
        <KonfirmasiBox
          pesan={"Teruskan ke Kabag Prokopim dengan prioritas "+PRIORITY_CFG[priority]?.label+"?"}
          onYa={naikkanKabag} onBatal={function(){setKonfirm(null);}} loading={loading} warna="#059669"
        />
      )}
      {konfirm==="tolak" && (
        <KonfirmasiBox
          pesan={"Tolak permohonan dari "+gName(guest)+"?"}
          onYa={tolak} onBatal={function(){setKonfirm(null);}} loading={loading} warna="#DC2626"
        />
      )}
      {konfirm==="kembali" && (
        <KonfirmasiBox
          pesan="Kembalikan ke Admin RK untuk ditinjau ulang?"
          onYa={kembalikanRK} onBatal={function(){setKonfirm(null);}} loading={loading} warna="#F59E0B"
        />
      )}

      {!konfirm && guest.status==="pending_kasubbag" && (
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <ActionBtn label="⬆ Teruskan ke Kabag" color="#059669" flex={3}
            onClick={function(){setKonfirm("naik");}}/>
          <ActionBtn label="↩ Ke Admin RK" color="#F59E0B" flex={2} outline
            onClick={function(){setKonfirm("kembali");}}/>
          <ActionBtn label="❌ Tolak" color="#DC2626" flex={2} outline
            onClick={function(){setKonfirm("tolak");}}/>
        </div>
      )}
      {guest.status!=="pending_kasubbag" && (
        <InfoBox type="info" msg={"Status: "+STATUS_CFG[guest.status]?.label}/>
      )}
    </DetailLayout>
  );
}

// ══════════════════════════════════════════════════════════════
//  VIEW 3 — KABAG PROKOPIM: Gatekeeper Eksekutif
// ══════════════════════════════════════════════════════════════
function KabagView({ user, showT, isMobile }) {
  var [guests,     setGuests]     = useState([]);
  var [loading,    setLoading]    = useState(true);
  var [tab,        setTab]        = useState("pending_kabag");
  var [detail,     setDetail]     = useState(null);
  var [lastLoaded, setLastLoaded] = useState(null);
  var [q,          setQ]          = useState("");

  var load = useCallback(function() {
    setLoading(true);
    fetch(API+"?action=queue&status="+tab+"&limit=60")
      .then(function(r){return r.json();})
      .then(function(d){setGuests(Array.isArray(d)?d:[]); setLastLoaded(new Date());})
      .catch(function(){setGuests([]);})
      .finally(function(){setLoading(false);});
  }, [tab]);

  useEffect(function(){load();}, [load]);

  if(detail) return (
    <KabagDetail
      guest={detail} user={user} showT={showT} isMobile={isMobile}
      onBack={function(){setDetail(null);}}
      onDone={function(){setGuests(function(prev){return prev.filter(function(g){return g.id!==detail.id;});}); setDetail(null);}}
    />
  );

  var TABS = [
    {k:"pending_kabag",    l:"Menunggu Telaah Anda"},
    {k:"pending_pimpinan", l:"Di Pimpinan"},
    {k:"approved",         l:"Disetujui"},
    {k:"rejected",         l:"Ditolak"},
    {k:"all",              l:"🔎 Lacak Semua"},
  ];

  return (
    <div style={{flex:1,overflowY:"auto",background:"#F0F4FA",paddingBottom:40}}>
      <div style={{background:"linear-gradient(135deg,#78350F 0%,#92400E 100%)",padding:isMobile?"20px 16px":"28px 32px"}}>
        <div style={{color:GOLD_L,fontSize:10,fontWeight:700,letterSpacing:2.5,textTransform:"uppercase",marginBottom:6}}>
          Manajemen Tamu — Gatekeeper Eksekutif
        </div>
        <div style={{color:"white",fontSize:isMobile?20:24,fontWeight:900,marginBottom:12,letterSpacing:-.3}}>
          ⚖️ Telaah Kabag Prokopim
        </div>
        <ChipStat label="Menunggu telaah Anda" value={guests.filter(g=>g.status==="pending_kabag").length} color="#FDE68A"/>
      </div>

      <div style={{padding:"14px 16px 0",display:"flex",gap:6,flexWrap:"wrap"}}>
        {TABS.map(function(t){
          return <TabBtn key={t.k} label={t.l} active={tab===t.k} onClick={function(){setTab(t.k);}}/>;
        })}
      </div>

      {tab==="all" && <TrackSearch value={q} onChange={setQ}/>}
      <MetaBar lastLoaded={lastLoaded} onRefresh={load} loading={loading}/>

      <div style={{padding:"12px 16px"}}>
        {loading ? <SkeletonList/> : (tab==="all"?filterByQuery(guests,q):guests).length===0 ? <EmptyState label="Tidak ada permohonan"/> :
          (tab==="all"?filterByQuery(guests,q):guests).map(function(g){
            return <GuestCard key={g.id} guest={g} onClick={function(){setDetail(g);}} showChain/>;
          })
        }
      </div>
    </div>
  );
}

function KabagDetail({ guest, user, showT, isMobile, onBack, onDone }) {
  var done = onDone || onBack;
  var [priority,   setPriority]   = useState(gPrioritas(guest));
  var [telaah,     setTelaah]     = useState(guest.telaah_kabag || "");
  var [instruksi,  setInstruksi]  = useState("");
  var [alasanCabut,setAlasanCabut]= useState("");
  var [loading,    setLoading]    = useState(false);
  var [konfirm,    setKonfirm]    = useState(null);

  async function cabutDariPimpinan() {
    if(!alasanCabut.trim()) { showT("⚠ Isi alasan pencabutan dulu"); setKonfirm(null); return; }
    setLoading(true);
    try {
      await apiPost("recall_from_pimpinan", {
        id: guest.id,
        alasan: alasanCabut.trim(),
        recalled_by: user?.username,
      });
      showT("🔄 Permohonan dicabut dari Pimpinan");
      done();
    } catch(e) { showT("❌ "+e.message); }
    finally { setLoading(false); setKonfirm(null); }
  }

  async function teruskanPimpinan() {
    if(!telaah.trim()) { showT("⚠ Isi telaah untuk Pimpinan terlebih dahulu"); return; }
    setLoading(true);
    try {
      await apiPost("forward", {
        id: guest.id,
        priority: priority,
        kabag_notes: telaah.trim(),
        forwarded_by: user?.username,
      });
      showT("✅ Diteruskan ke Pimpinan");
      done();
    } catch(e) { showT("❌ "+e.message); }
    finally { setLoading(false); setKonfirm(null); }
  }

  async function kembalikan() {
    if(!instruksi.trim()) { showT("⚠ Isi instruksi untuk Kasubbag Protokol"); return; }
    setLoading(true);
    try {
      await apiPost("return_to_kasubbag", {
        id: guest.id,
        instruksi: instruksi.trim(),
        returned_by: user?.username,
      });
      showT("↩ Dikembalikan ke Kasubbag Protokol");
      done();
    } catch(e) { showT("❌ "+e.message); }
    finally { setLoading(false); setKonfirm(null); }
  }

  async function tolak() {
    setLoading(true);
    try {
      await apiPost("respond", {
        id: guest.id, response:"rejected",
        alasan_tolak: telaah.trim() || "(Ditolak di level Kabag Prokopim)",
        responded_by: user?.username,
      });
      showT("Permohonan ditolak");
      done();
    } catch(e) { showT("❌ "+e.message); }
    finally { setLoading(false); setKonfirm(null); }
  }

  return (
    <DetailLayout
      onBack={onBack} isMobile={isMobile}
      title={gName(guest)} subtitle="Telaah Eksekutif Kabag"
      badge={<StatusBadge status={guest.status}/>}
    >
      <DataTamu guest={guest}/>

      {/* Riwayat catatan */}
      {guest.catatan_rk && (
        <CatatanBox label="📋 Catatan Admin RK" isi={guest.catatan_rk} color="#3B82F6" bg="#EFF6FF"/>
      )}
      {guest.catatan_staf && (
        <CatatanBox label="🔍 Catatan Kasubbag" isi={guest.catatan_staf} color="#F59E0B" bg="#FFFBEB"/>
      )}

      {guest.status==="pending_kabag" && (
        <>
          {/* Koreksi Prioritas */}
          <CardSection title="🏷 Koreksi Prioritas" accent="#F59E0B">
            <div style={{fontSize:13,color:"#64748B",marginBottom:8,lineHeight:1.5}}>
              ⚡ <b>Mendesak</b>: respons hari ini &nbsp;·&nbsp;
              ⭐ <b>Penting</b>: 1–2 hari &nbsp;·&nbsp;
              📌 <b>Biasa</b>: antrian normal
            </div>
            <div style={{display:"flex",gap:8}}>
              {Object.entries(PRIORITY_CFG).map(function(e){
                var k=e[0]; var c=e[1]; var active=priority===k;
                return (
                  <button key={k} onClick={function(){setPriority(k);}} title={c.label} style={{
                    flex:1,padding:"10px 6px",borderRadius:12,
                    border:"2px solid "+(active?c.color:"#E2E8F0"),
                    background:active?c.bg:"white",color:active?c.color:"#64748B",
                    fontSize:11,fontWeight:700,cursor:"pointer",
                    display:"flex",flexDirection:"column",alignItems:"center",gap:5,
                  }}>
                    <span style={{fontSize:18,lineHeight:1}} aria-hidden="true">{c.icon}</span>
                    {c.label}
                    {active&&<span style={{fontSize:9}}>✓</span>}
                  </button>
                );
              })}
            </div>
          </CardSection>

          {/* Telaah */}
          <CardSection title="📄 Telaah Eksekutif untuk Pimpinan *" accent="#7C3AED">
            <textarea className="gd-inp" value={telaah} onChange={function(e){setTelaah(e.target.value);}}
              rows={4} placeholder="Uraikan poin-poin penting sebagai bahan pertimbangan Pimpinan dalam mengambil keputusan..."
              style={inpStyle}/>
            <div style={{fontSize:11,color:"#94A3B8",marginTop:4}}>
              ⚠ Wajib diisi sebelum meneruskan ke Pimpinan
            </div>
          </CardSection>
        </>
      )}

      {/* Telaah yang sudah tersimpan (view-only) */}
      {guest.telaah_kabag && guest.status!=="pending_kabag" && (
        <CatatanBox label="⚖️ Telaah Kabag" isi={guest.telaah_kabag} color="#7C3AED" bg="#EDE9FE"/>
      )}

      {/* Konfirmasi */}
      {konfirm==="terus" && (
        <KonfirmasiBox
          pesan={"Teruskan ke Pimpinan ("+gTujuan(guest)+") dengan telaah yang sudah ditulis?"}
          onYa={teruskanPimpinan} onBatal={function(){setKonfirm(null);}} loading={loading} warna="#5B21B6"
        />
      )}
      {konfirm==="tolak" && (
        <KonfirmasiBox
          pesan={"Tolak permohonan dari "+gName(guest)+"?"}
          onYa={tolak} onBatal={function(){setKonfirm(null);}} loading={loading} warna="#DC2626"
        />
      )}
      {konfirm==="kembali" && (
        <div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(15,23,42,0.55)",backdropFilter:"blur(3px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
          onClick={function(){ if(!loading) setKonfirm(null); }}>
          <div style={{background:"white",borderRadius:18,width:"100%",maxWidth:440,boxShadow:"0 24px 60px rgba(0,0,0,0.3)",overflow:"hidden"}}
            onClick={function(e){e.stopPropagation();}}>
            <div style={{background:"linear-gradient(135deg,#F59E0B,#D97706)",padding:"16px 20px"}}>
              <div style={{color:"white",fontSize:16,fontWeight:900}}>↩ Kembalikan ke Kasubbag Protokol</div>
              <div style={{color:"rgba(255,255,255,0.85)",fontSize:12,marginTop:2}}>Permohonan a.n. {gName(guest)}</div>
            </div>
            <div style={{padding:"18px 20px"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#92400E",marginBottom:6}}>
                Instruksi untuk Kasubbag Protokol *
              </div>
              <textarea className="gd-inp" value={instruksi} autoFocus
                onChange={function(e){setInstruksi(e.target.value);}}
                rows={4}
                placeholder="Cth: Mohon klarifikasi keperluan audiensi & pastikan ada surat rekomendasi resmi sebelum diteruskan kembali..."
                style={inpStyle}/>
              <div style={{fontSize:11,color:"#94A3B8",marginTop:6,lineHeight:1.5}}>
                ℹ Instruksi ini wajib diisi. Kasubbag Protokol akan menerima permohonan ini kembali beserta instruksi Anda dan notifikasi WhatsApp.
              </div>
              <div style={{display:"flex",gap:10,marginTop:16}}>
                <button onClick={function(){setKonfirm(null);}} disabled={loading}
                  style={{flex:1,padding:"12px",borderRadius:11,border:"1.5px solid #E2E8F0",background:"white",color:"#64748B",cursor:"pointer",fontSize:13,fontWeight:700}}>
                  Batal
                </button>
                <button onClick={kembalikan} disabled={loading||!instruksi.trim()}
                  style={{flex:2,padding:"12px",borderRadius:11,border:"none",
                    background:instruksi.trim()?"linear-gradient(135deg,#F59E0B,#D97706)":"#E2E8F0",
                    color:instruksi.trim()?"white":"#94A3B8",
                    cursor:instruksi.trim()&&!loading?"pointer":"default",fontSize:13,fontWeight:800}}>
                  {loading?"Mengirim...":"↩ Kembalikan & Kirim Instruksi"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!konfirm && guest.status==="pending_kabag" && (
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <ActionBtn label="📤 Teruskan ke Pimpinan" color="#5B21B6" flex={3}
            onClick={function(){setKonfirm("terus");}}/>
          <ActionBtn label="↩ Kembalikan" color="#F59E0B" flex={2} outline
            onClick={function(){setKonfirm("kembali");}}/>
          <ActionBtn label="❌ Tolak" color="#DC2626" flex={2} outline
            onClick={function(){setKonfirm("tolak");}}/>
        </div>
      )}
      {guest.status!=="pending_kabag" && (
        <InfoBox type="info" msg={"Status: "+STATUS_CFG[guest.status]?.label}/>
      )}

      {/* Cabut dari Pimpinan — hanya saat status pending_pimpinan */}
      {guest.status==="pending_pimpinan" && (
        <CardSection title="🔄 Cabut dari Meja Pimpinan" accent="#DC2626">
          <div style={{fontSize:12,color:"#64748B",marginBottom:8,lineHeight:1.5}}>
            Gunakan jika permohonan ini perlu diperbaiki atau dihapus.
            Permohonan akan kembali ke tahap Kabag.
          </div>
          <textarea className="gd-inp" value={alasanCabut}
            onChange={function(e){setAlasanCabut(e.target.value);}}
            rows={2} placeholder="Alasan pencabutan (wajib)..."
            style={inpStyle}/>
          {konfirm==="cabut" ? (
            <KonfirmasiBox
              pesan="Cabut permohonan ini dari meja Pimpinan? Status kembali ke Kabag."
              onYa={cabutDariPimpinan} onBatal={function(){setKonfirm(null);}}
              loading={loading} warna="#DC2626"
            />
          ) : (
            <ActionBtn label="🔄 Cabut dari Pimpinan" color="#DC2626"
              onClick={function(){setKonfirm("cabut");}}/>
          )}
        </CardSection>
      )}
    </DetailLayout>
  );
}

// ══════════════════════════════════════════════════════════════
//  VIEW 4 — PIMPINAN: Keputusan Akhir + Penjadwalan
// ══════════════════════════════════════════════════════════════
function PimpinanView({ role, user, events, showT, isMobile }) {
  var [guests,     setGuests]     = useState([]);
  var [loading,    setLoading]    = useState(true);
  var [tab,        setTab]        = useState("pending_pimpinan");
  var [detail,     setDetail]     = useState(null);
  var [lastLoaded, setLastLoaded] = useState(null);

  var load = useCallback(function() {
    var pimpinanLabel = role==="wakilwalikota" ? "Wakil Wali Kota" : "Wali Kota";
    var statusQ = tab;
    var url = API+"?action=queue&status="+statusQ+"&limit=50";
    setLoading(true);
    fetch(url)
      .then(function(r){return r.json();})
      .then(function(d){
        var list = Array.isArray(d) ? d : [];
        // Filter hanya untuk pimpinan ini
        list = list.filter(function(g){
          return g.tujuan_pejabat === pimpinanLabel;
        });
        setGuests(list);
        setLastLoaded(new Date());
      })
      .catch(function(){setGuests([]);})
      .finally(function(){setLoading(false);});
  }, [tab, role]);

  useEffect(function(){load();}, [load]);

  if(detail) return (
    <PimpinanDetail
      guest={detail} role={role} user={user} events={events}
      showT={showT} isMobile={isMobile}
      onBack={function(){setDetail(null);}}
      onDone={function(){setGuests(function(prev){return prev.filter(function(g){return g.id!==detail.id;});}); setDetail(null);}}
    />
  );

  var TABS = [
    {k:"pending_pimpinan", l:"Menunggu Keputusan"},
    {k:"approved",         l:"Sudah Disetujui"},
    {k:"rejected",         l:"Ditolak"},
    {k:"disposed",         l:"Didisposisi"},
  ];
  var pimpinanLabel = role==="wakilwalikota"?"Wakil Wali Kota":"Wali Kota";

  return (
    <div style={{flex:1,overflowY:"auto",background:"#F0F4FA",paddingBottom:40}}>
      <div style={{background:"linear-gradient(135deg,"+NAVY+" 0%,#0D2347 100%)",padding:isMobile?"20px 16px":"28px 32px"}}>
        <div style={{color:GOLD,fontSize:10,fontWeight:700,letterSpacing:2.5,textTransform:"uppercase",marginBottom:6}}>
          Permohonan Audiensi
        </div>
        <div style={{color:"white",fontSize:isMobile?20:24,fontWeight:900,marginBottom:4,letterSpacing:-.3}}>
          🏛 {pimpinanLabel}
        </div>
        <div style={{color:"rgba(255,255,255,.5)",fontSize:12,marginBottom:12}}>
          dr. H. Khairul, M.Kes {role==="wakilwalikota"?" — Wakil":""}
        </div>
        <ChipStat label="Menunggu keputusan" value={guests.filter(g=>g.status==="pending_pimpinan").length} color={GOLD}/>
      </div>

      <div style={{padding:"14px 16px 0",display:"flex",gap:6,flexWrap:"wrap"}}>
        {TABS.map(function(t){
          return <TabBtn key={t.k} label={t.l} active={tab===t.k} onClick={function(){setTab(t.k);}}/>;
        })}
      </div>

      <MetaBar lastLoaded={lastLoaded} onRefresh={load} loading={loading}/>

      <div style={{padding:"12px 16px"}}>
        {loading ? <SkeletonList/> : guests.length===0 ? <EmptyState label="Tidak ada permohonan"/> :
          guests.map(function(g){
            return <GuestCard key={g.id} guest={g} onClick={function(){setDetail(g);}} showChain premium/>;
          })
        }
      </div>
    </div>
  );
}

function PimpinanDetail({ guest, role, user, events, showT, isMobile, onBack, onDone }) {
  var done = onDone || onBack;
  var [loading,    setLoading]    = useState(false);
  var [mode,       setMode]       = useState(null); // "jadwal"|"tolak"|"disposisi"|"cabut"
  var [jadwalTgl,  setJadwalTgl]  = useState(guest.preferensi_tanggal || "");
  var [jadwalJam,  setJadwalJam]  = useState(guest.preferensi_jam     || "");
  var [alasan,     setAlasan]     = useState("");
  var [disposisiKe,setDisposisiKe]= useState("");
  var [alasanCabut,setAlasanCabut]= useState("");

  // Kabag & Admin RK bisa mencabut permohonan dari Pimpinan untuk perbaikan
  var dapatCabut = role==="kabag" || role==="admin_rk";

  async function cabutDariPimpinan() {
    if(!alasanCabut.trim()) { showT("⚠ Isi alasan pencabutan dulu"); return; }
    setLoading(true);
    try {
      await apiPost("recall_from_pimpinan", {
        id: guest.id, alasan: alasanCabut.trim(),
        recalled_by: user?.username,
      });
      showT("🔄 Permohonan dicabut dari Pimpinan");
      done();
    } catch(e) { showT("❌ "+e.message); }
    finally { setLoading(false); setMode(null); }
  }

  // Deteksi konflik agenda
  var konflikAgenda = useMemo(function() {
    if(!jadwalTgl||!jadwalJam||!events) return [];
    var targetStart = toMin(jadwalJam);
    var targetEnd   = targetStart + 60;
    var BUFFER      = 30;
    return (events||[]).filter(function(ev){
      if(ev.tanggal!==jadwalTgl||ev.alur!=="disetujui") return false;
      var evStart = toMin(ev.jam);
      var evEnd   = evStart + (ev.durasiMenit||60);
      return targetStart < evEnd + BUFFER && targetEnd > evStart - BUFFER;
    });
  }, [jadwalTgl, jadwalJam, events]);

  async function setujui() {
    setLoading(true);
    try {
      var bodyResp = {
        id: guest.id,
        response: "approved",
        responded_by: user?.username,
      };
      if(jadwalTgl) bodyResp.scheduled_date = jadwalTgl;
      if(jadwalJam) bodyResp.scheduled_time = jadwalJam;

      await apiPost("respond", bodyResp);

      // Jika ada jadwal, buat juga di tabel jadwal utama
      if(jadwalTgl && jadwalJam && SUPA_URL && SUPA_KEY) {
        // Pejabat tujuan diturunkan dari data tamu (bukan role), agar benar
        // saat dijadwalkan oleh ajudan / admin RK yang menjadwalkan untuk
        // pimpinan mana pun.
        var pejabatKey = gTujuan(guest)==="Wakil Wali Kota" ? "wakilwalikota" : "walikota";
        var newEvent = {
          id: Date.now(),
          tanggal: jadwalTgl, jam: jadwalJam,
          namaAcara: "Audiensi: "+gName(guest)+(gInstansi(guest)!=="–"?" ("+gInstansi(guest)+")":""),
          penyelenggara: gInstansi(guest)||gName(guest),
          kontak: gPhone(guest)||"-",
          buktiUndangan: "Permohonan Tamu #"+(String(guest.id).slice(-6)),
          pakaian: "Batik Lengan Panjang", jenisKegiatan:"Menghadiri",
          lokasi: "Ruang Pimpinan, Kantor Wali Kota Tarakan",
          untukPimpinan: [pejabatKey], alur:"disetujui",
          catatan: "Maksud: "+gMaksud(guest)+(guest.telaah_kabag?" | Telaah Kabag: "+guest.telaah_kabag:""),
          statusWK:  pejabatKey==="walikota"?"hadir":null,
          statusWWK: pejabatKey==="wakilwalikota"?"hadir":null,
          submittedBy: user?.username||"pimpinan",
          personil:[], evaluasi:{}, created_from:"guest_module",
        };
        await fetch(SUPA_URL+"/rest/v1/jadwal",{
          method:"POST",
          headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Prefer":"return=minimal"},
          body: JSON.stringify({id:newEvent.id, data:newEvent}),
        });
      }

      showT("✅ Permohonan disetujui"+(jadwalTgl?" & masuk ke Agenda":""));
      done();
    } catch(e) { showT("❌ "+e.message); }
    finally { setLoading(false); }
  }

  async function tolak() {
    setLoading(true);
    try {
      await apiPost("respond", {
        id:guest.id, response:"rejected",
        alasan_tolak: alasan.trim()||"(Tidak memenuhi kriteria audiensi saat ini)",
        responded_by: user?.username,
      });
      showT("Permohonan ditolak");
      done();
    } catch(e) { showT("❌ "+e.message); }
    finally { setLoading(false); }
  }

  async function disposisi() {
    if(!disposisiKe.trim()){showT("⚠ Isi tujuan disposisi");return;}
    setLoading(true);
    try {
      await apiPost("respond", {
        id:guest.id, response:"disposed",
        disposed_to: disposisiKe.trim(),
        responded_by: user?.username,
      });
      showT("Permohonan didisposisi ke "+disposisiKe);
      done();
    } catch(e) { showT("❌ "+e.message); }
    finally { setLoading(false); }
  }

  var pc = PRIORITY_CFG[gPrioritas(guest)] || PRIORITY_CFG.biasa;

  return (
    <DetailLayout
      onBack={onBack} isMobile={isMobile}
      title={gName(guest)} subtitle="Permohonan Audiensi — Keputusan Pimpinan"
      badge={<StatusBadge status={guest.status}/>}
      premium
    >
      {/* Priority banner */}
      <div style={{
        background:"linear-gradient(135deg,"+pc.bg+",white)",
        border:"2px solid "+pc.color+"30",
        borderRadius:14, padding:"12px 16px", marginBottom:14,
        display:"flex",alignItems:"center",gap:10,
      }}>
        <span aria-hidden="true" style={{fontSize:16,lineHeight:1}}>{pc.icon}</span>
        <span style={{fontSize:13,fontWeight:700,color:pc.color}}>Prioritas: {pc.label}</span>
      </div>

      <DataTamu guest={guest}/>

      {/* Riwayat Lengkap — hanya Admin RK + Telaahan Staf (tidak menampilkan catatan kasubbag agar tidak membingungkan Pimpinan) */}
      {guest.catatan_rk && (
        <CatatanBox label="📋 Catatan Admin RK" isi={guest.catatan_rk} color="#3B82F6" bg="#EFF6FF"/>
      )}
      {guest.telaah_kabag && (
        <CatatanBox label="⚖️ Telaahan Staf" isi={guest.telaah_kabag} color="#7C3AED" bg="#EDE9FE"/>
      )}

      {guest.status==="pending_pimpinan" && (
        <>
          {/* Mode: Jadwalkan */}
          {mode==="jadwal" && (
            <CardSection title="📅 Tentukan Jadwal Audiensi" accent="#059669">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div>
                  <div style={subLabel}>Tanggal</div>
                  <input type="date" className="gd-inp" value={jadwalTgl} min={todayStr()}
                    onChange={function(e){setJadwalTgl(e.target.value);}} style={inpStyle}/>
                </div>
                <div>
                  <div style={subLabel}>Jam (WITA)</div>
                  <input type="time" className="gd-inp" value={jadwalJam}
                    onChange={function(e){setJadwalJam(e.target.value);}} style={inpStyle}/>
                </div>
              </div>

              {/* Peringatan konflik */}
              {konflikAgenda.length>0 && (
                <div style={{background:"#FEF2F2",border:"2px solid #FECACA",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:800,color:"#DC2626",marginBottom:8}}>
                    ⚠️ Peringatan — Waktu Berdekatan dengan Agenda Pimpinan
                  </div>
                  {konflikAgenda.map(function(ev,i){
                    return (
                      <div key={i} style={{fontSize:12,color:"#991B1B",marginBottom:4,display:"flex",alignItems:"flex-start",gap:6}}>
                        <span>•</span>
                        <span><strong>{ev.jam} WITA</strong> — {ev.namaAcara} ({ev.lokasi||"–"})</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Preferensi tamu */}
              {(guest.preferensi_tanggal||guest.preferensi_jam) && (
                <div style={{background:"#F0FDF4",border:"1px solid #86EFAC",borderRadius:10,padding:"9px 12px",marginBottom:12,fontSize:12,color:"#166534"}}>
                  💡 Preferensi tamu: {guest.preferensi_tanggal ? fmtDate(guest.preferensi_tanggal) : ""}
                  {guest.preferensi_jam ? " pukul "+guest.preferensi_jam+" WITA" : ""}
                </div>
              )}

              <div style={{display:"flex",gap:8}}>
                <ActionBtn
                  label={konflikAgenda.length>0 ? "⚠ Tetap Konfirmasi Jadwal" : "✅ Konfirmasi & Buat Agenda"}
                  color={konflikAgenda.length>0?"#F59E0B":"#059669"} flex={3}
                  onClick={setujui} loading={loading}
                />
                <ActionBtn label="Batal" color="#64748B" flex={1} outline
                  onClick={function(){setMode(null);}}/>
              </div>
            </CardSection>
          )}

          {/* Mode: Tolak */}
          {mode==="tolak" && (
            <CardSection title="❌ Alasan Penolakan" accent="#DC2626">
              <input className="gd-inp" value={alasan} onChange={function(e){setAlasan(e.target.value);}}
                placeholder="Isi alasan penolakan (opsional)..." style={inpStyle}/>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <ActionBtn label="❌ Konfirmasi Penolakan" color="#DC2626" flex={3}
                  onClick={tolak} loading={loading}/>
                <ActionBtn label="Batal" color="#64748B" flex={1} outline
                  onClick={function(){setMode(null);}}/>
              </div>
            </CardSection>
          )}

          {/* Mode: Disposisi */}
          {mode==="disposisi" && (
            <CardSection title="↩ Disposisi ke Pejabat / OPD" accent="#7C3AED">
              <input className="gd-inp" value={disposisiKe} onChange={function(e){setDisposisiKe(e.target.value);}}
                placeholder="Contoh: Kadis Kesehatan, Kepala BPKAD..." style={inpStyle}/>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <ActionBtn label="↩ Konfirmasi Disposisi" color="#7C3AED" flex={3}
                  onClick={disposisi} loading={loading}/>
                <ActionBtn label="Batal" color="#64748B" flex={1} outline
                  onClick={function(){setMode(null);}}/>
              </div>
            </CardSection>
          )}

          {/* Tombol utama (tidak ada mode aktif) */}
          {!mode && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <button className="gd-btn-act" onClick={function(){setMode("jadwal");}} style={{
                padding:"16px 8px",borderRadius:14,border:"none",
                background:"linear-gradient(135deg,#059669,#047857)",
                color:"white",fontSize:12,fontWeight:800,cursor:"pointer",
                display:"flex",flexDirection:"column",alignItems:"center",gap:6,
              }}>
                <span style={{fontSize:22}}>✅</span>Terima &amp;<br/>Jadwalkan
              </button>
              <button className="gd-btn-act" onClick={function(){setMode("disposisi");}} style={{
                padding:"16px 8px",borderRadius:14,border:"none",
                background:"linear-gradient(135deg,#7C3AED,#5B21B6)",
                color:"white",fontSize:12,fontWeight:800,cursor:"pointer",
                display:"flex",flexDirection:"column",alignItems:"center",gap:6,
              }}>
                <span style={{fontSize:22}}>↩</span>Disposisi
              </button>
              <button className="gd-btn-act" onClick={function(){setMode("tolak");}} style={{
                padding:"16px 8px",borderRadius:14,border:"1.5px solid #FECACA",
                background:"#FEF2F2",color:"#DC2626",fontSize:12,fontWeight:800,
                cursor:"pointer",
                display:"flex",flexDirection:"column",alignItems:"center",gap:6,
              }}>
                <span style={{fontSize:22}}>❌</span>Tolak
              </button>
            </div>
          )}

          {/* Mode: Cabut dari Pimpinan (Kabag & Admin RK) */}
          {mode==="cabut" && (
            <CardSection title="🔄 Cabut Permohonan dari Pimpinan" accent="#DC2626">
              <div style={{fontSize:12,color:"#64748B",marginBottom:8,lineHeight:1.5}}>
                Permohonan akan dikembalikan ke tahap Kabag untuk diperbaiki atau dihapus.
                Kabag akan menerima notifikasi WA.
              </div>
              <textarea className="gd-inp" value={alasanCabut}
                onChange={function(e){setAlasanCabut(e.target.value);}}
                rows={3} placeholder="Alasan pencabutan (wajib diisi)..."
                style={inpStyle}/>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <ActionBtn label="Batal" color="#64748B" outline flex={1}
                  onClick={function(){setMode(null);}}/>
                <ActionBtn label="🔄 Cabut Sekarang" color="#DC2626" flex={2}
                  onClick={cabutDariPimpinan} loading={loading}/>
              </div>
            </CardSection>
          )}

          {/* Tombol pemicu cabut untuk Kabag & Admin RK */}
          {dapatCabut && mode==null && (
            <button onClick={function(){setMode("cabut");}} style={{
              width:"100%",marginTop:12,padding:"12px",borderRadius:12,
              border:"1.5px dashed #DC2626",background:"white",
              color:"#DC2626",cursor:"pointer",fontSize:13,fontWeight:700,
            }}>🔄 Cabut Permohonan dari Pimpinan</button>
          )}
        </>
      )}

      {/* Keputusan yang sudah diambil */}
      {guest.status==="approved" && (
        <InfoBox type="success" msg={"✅ Disetujui"+(guest.jadwal_tanggal?" — "+fmtDate(guest.jadwal_tanggal)+(guest.jadwal_jam?" pk "+guest.jadwal_jam+" WITA":""):"")}/>
      )}
      {guest.status==="rejected" && (
        <InfoBox type="error" msg={"❌ Ditolak"+(guest.alasan_tolak?" — "+guest.alasan_tolak:"")}/>
      )}
      {guest.status==="disposed" && (
        <InfoBox type="info" msg={"↩ Didisposisi ke "+(guest.disposisi_ke||"–")}/>
      )}
    </DetailLayout>
  );
}

// ══════════════════════════════════════════════════════════════
//  VIEW 5 — AJUDAN: Tamu Hari Ini & Besok
// ══════════════════════════════════════════════════════════════
function AjudanView({ role, user, events, showT, isMobile }) {
  var [guests,  setGuests]  = useState([]);
  var [loading, setLoading] = useState(true);
  var [subtab,  setSubtab]  = useState("sambut"); // "sambut" | "jadwal"
  var [jadwalList, setJadwalList] = useState([]);
  var [jadwalLoading, setJadwalLoading] = useState(false);
  var [detail,  setDetail]  = useState(null);
  var pimpinanLabel = role==="ajudan_walikota"?"Wali Kota":"Wakil Wali Kota";
  var today    = todayStr();
  var tomorrow = tomorrowStr();

  // Mode penyambutan: tamu disetujui hari ini & besok
  useEffect(function() {
    setLoading(true);
    fetch(API+"?action=queue&status=approved&limit=100")
      .then(function(r){return r.json();})
      .then(function(d){
        var list = Array.isArray(d)?d:[];
        list = list.filter(function(g){
          return g.tujuan_pejabat===pimpinanLabel &&
            (g.jadwal_tanggal===today||g.jadwal_tanggal===tomorrow);
        });
        list.sort(function(a,b){
          return ((a.jadwal_tanggal||"")+(a.jadwal_jam||"")).localeCompare((b.jadwal_tanggal||"")+(b.jadwal_jam||""));
        });
        setGuests(list);
      })
      .catch(function(){setGuests([]);})
      .finally(function(){setLoading(false);});
  }, [pimpinanLabel]);

  // Mode penjadwalan: permohonan tahap akhir (pending_pimpinan)
  var loadJadwal = useCallback(function() {
    setJadwalLoading(true);
    fetch(API+"?action=queue&status=pending_pimpinan&limit=80")
      .then(function(r){return r.json();})
      .then(function(d){
        var list = Array.isArray(d)?d:[];
        setJadwalList(list.filter(function(g){return g.tujuan_pejabat===pimpinanLabel;}));
      })
      .catch(function(){setJadwalList([]);})
      .finally(function(){setJadwalLoading(false);});
  }, [pimpinanLabel]);

  useEffect(function(){ if(subtab==="jadwal") loadJadwal(); }, [subtab, loadJadwal]);

  if(detail) return (
    <PimpinanDetail
      guest={detail} role={role} user={user} events={events}
      showT={showT} isMobile={isMobile}
      onBack={function(){setDetail(null);}}
      onDone={function(){setJadwalList(function(prev){return prev.filter(function(g){return g.id!==detail.id;});}); setDetail(null);}}
    />
  );

  var todayList    = guests.filter(g=>g.jadwal_tanggal===today);
  var tomorrowList = guests.filter(g=>g.jadwal_tanggal===tomorrow);

  return (
    <div style={{flex:1,overflowY:"auto",background:"#F0F4FA",paddingBottom:40}}>
      <div style={{background:"linear-gradient(135deg,"+NAVY+" 0%,#163265 100%)",padding:isMobile?"20px 16px":"28px 32px"}}>
        <div style={{color:GOLD,fontSize:10,fontWeight:700,letterSpacing:2.5,textTransform:"uppercase",marginBottom:6}}>
          Ajudan {pimpinanLabel}
        </div>
        <div style={{color:"white",fontSize:isMobile?20:24,fontWeight:900,marginBottom:4,letterSpacing:-.3}}>
          {subtab==="sambut" ? "🤝 Tamu Disetujui Pimpinan" : "📅 Penjadwalan Audiensi"}
        </div>
        <div style={{color:"rgba(255,255,255,.5)",fontSize:12}}>
          {subtab==="sambut" ? "Hari ini & Besok" : "Tetapkan jadwal untuk permohonan yang menunggu keputusan"}
        </div>
      </div>

      <div style={{padding:"14px 16px 0",display:"flex",gap:6,flexWrap:"wrap"}}>
        <TabBtn label="🤝 Penyambutan" active={subtab==="sambut"} onClick={function(){setSubtab("sambut");}}/>
        <TabBtn label={"📅 Penjadwalan"+(jadwalList.length?" ("+jadwalList.length+")":"")} active={subtab==="jadwal"} onClick={function(){setSubtab("jadwal");}}/>
      </div>

      {subtab==="jadwal" ? (
        <>
          <MetaBar lastLoaded={null} onRefresh={loadJadwal} loading={jadwalLoading}/>
          <div style={{padding:"12px 16px"}}>
            {jadwalLoading ? <SkeletonList/> : jadwalList.length===0 ? (
              <EmptyState label="Tidak ada permohonan yang menunggu penjadwalan"/>
            ) : jadwalList.map(function(g){
              return <GuestCard key={g.id} guest={g} onClick={function(){setDetail(g);}} showChain premium/>;
            })}
          </div>
        </>
      ) : (
        <div style={{padding:"16px"}}>
          {loading ? <SkeletonList/> : guests.length===0 ? (
            <EmptyState label="Belum ada tamu terjadwal untuk hari ini dan besok"/>
          ) : (
            <>
              {todayList.length>0 && (
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:800,color:NAVY,textTransform:"uppercase",letterSpacing:.8,marginBottom:10,paddingBottom:6,borderBottom:"2px solid "+GOLD}}>
                    🗓 Hari Ini — {fmtDate(today)}
                  </div>
                  {todayList.map(function(g){return <AjudanCard key={g.id} guest={g}/>;}) }
                </div>
              )}
              {tomorrowList.length>0 && (
                <div>
                  <div style={{fontSize:12,fontWeight:800,color:NAVY,textTransform:"uppercase",letterSpacing:.8,marginBottom:10,paddingBottom:6,borderBottom:"2px solid #CBD5E1"}}>
                    🗓 Besok — {fmtDate(tomorrow)}
                  </div>
                  {tomorrowList.map(function(g){return <AjudanCard key={g.id} guest={g}/>;}) }
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AjudanCard({ guest }) {
  var pc = PRIORITY_CFG[gPrioritas(guest)]||PRIORITY_CFG.biasa;
  return (
    <div className="gd-card" style={{
      background:"white",borderRadius:18,marginBottom:12,overflow:"hidden",
      boxShadow:"0 3px 14px rgba(10,22,40,0.08)",border:"1.5px solid "+pc.color+"30",
    }}>
      <div style={{background:"linear-gradient(135deg,"+NAVY+","+NAVY_MID+")",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{color:GOLD,fontSize:15,fontWeight:900}}>
          {guest.jadwal_jam ? guest.jadwal_jam+" WITA" : "Jam belum ditentukan"}
        </div>
        <span title={"Prioritas: "+pc.label} style={{background:pc.bg,color:pc.color,borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4}}><span aria-hidden="true">{pc.icon}</span>{pc.label}</span>
      </div>
      <div style={{padding:"14px 16px"}}>
        <div style={{fontSize:16,fontWeight:800,color:NAVY,marginBottom:3}}>{gName(guest)}</div>
        {gInstansi(guest)!=="–" && <div style={{fontSize:12,color:"#64748B",marginBottom:4}}>🏢 {gInstansi(guest)}</div>}
        <div style={{fontSize:12,color:"#64748B",marginBottom:8}}>📱 {gPhone(guest)}</div>
        <div style={{background:"#F8FAFC",borderRadius:10,padding:"9px 12px",fontSize:13,color:NAVY,lineHeight:1.55}}>
          {gMaksud(guest)}
        </div>
        {guest.telaah_kabag && (
          <div style={{marginTop:8,background:"#EDE9FE",borderRadius:9,padding:"8px 11px",fontSize:12,color:"#4C1D95"}}>
            📌 Telaah Kabag: {guest.telaah_kabag}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  VIEW 6 — READ-ONLY (Komdokpim / Timkom)
// ══════════════════════════════════════════════════════════════
function ReadOnlyView({ isMobile }) {
  var [guests,  setGuests]  = useState([]);
  var [loading, setLoading] = useState(true);
  var [tab,     setTab]     = useState("approved");

  useEffect(function(){
    setLoading(true);
    fetch(API+"?action=queue&status="+tab+"&limit=50")
      .then(function(r){return r.json();})
      .then(function(d){setGuests(Array.isArray(d)?d:[]);})
      .catch(function(){setGuests([]);})
      .finally(function(){setLoading(false);});
  }, [tab]);

  return (
    <div style={{flex:1,overflowY:"auto",background:"#F0F4FA",paddingBottom:40}}>
      <div style={{background:NAVY,padding:isMobile?"20px 16px":"28px 32px"}}>
        <div style={{color:GOLD,fontSize:10,fontWeight:700,letterSpacing:2.5,textTransform:"uppercase",marginBottom:6}}>
          Manajemen Tamu — Hanya Lihat
        </div>
        <div style={{color:"white",fontSize:isMobile?20:24,fontWeight:900}}>Daftar Tamu Audiensi</div>
      </div>
      <div style={{padding:"14px 16px 0",display:"flex",gap:6}}>
        {[{k:"approved",l:"Disetujui"},{k:"pending_pimpinan",l:"Di Proses"},{k:"all",l:"Semua"}].map(function(t){
          return <TabBtn key={t.k} label={t.l} active={tab===t.k} onClick={function(){setTab(t.k);}}/>;
        })}
      </div>
      <div style={{padding:"12px 16px"}}>
        {loading ? <SkeletonList/> : guests.length===0 ? <EmptyState label="Belum ada data"/> :
          guests.map(function(g){return <GuestCard key={g.id} guest={g} readonly/>;})
        }
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  SHARED: DataTamu — tampilkan semua isi formulir
// ══════════════════════════════════════════════════════════════
function DataTamu({ guest }) {
  return (
    <>
      <CardSection title="👤 Data Tamu">
        <InfoRow icon="👤" label="Nama Lengkap"   value={gName(guest)}     bold/>
        <InfoRow icon="🏢" label="Instansi / Org."value={gInstansi(guest)}/>
        <InfoRow icon="📱" label="No. WhatsApp"   value={gPhone(guest)}/>
        <InfoRow icon="🏛" label="Tujuan Pimpinan"value={gTujuan(guest)}/>
        <InfoRow icon="📅" label="Waktu Daftar"   value={fmtTs(guest.created_at)}/>
      </CardSection>

      <CardSection title="📋 Maksud & Keperluan">
        <div style={{fontSize:14,color:NAVY,lineHeight:1.7,fontWeight:500}}>
          {gMaksud(guest)}
        </div>
      </CardSection>

      {gPesan(guest) && (
        <CardSection title="💬 Pesan Tambahan">
          <div style={{fontSize:13,color:"#475569",lineHeight:1.65}}>{gPesan(guest)}</div>
        </CardSection>
      )}

      {(guest.preferensi_tanggal||guest.preferensi_jam) && (
        <CardSection title="🗓 Preferensi Waktu Tamu" accent="#059669">
          <div style={{display:"flex",gap:10}}>
            {guest.preferensi_tanggal && (
              <div style={{background:"#D1FAE5",borderRadius:10,padding:"8px 14px",fontSize:13,fontWeight:700,color:"#065F46"}}>
                📅 {fmtDate(guest.preferensi_tanggal)}
              </div>
            )}
            {guest.preferensi_jam && (
              <div style={{background:"#D1FAE5",borderRadius:10,padding:"8px 14px",fontSize:13,fontWeight:700,color:"#065F46"}}>
                🕐 {guest.preferensi_jam} WITA
              </div>
            )}
          </div>
        </CardSection>
      )}

      {guest.butuh_aksesibilitas && (
        <CardSection title="♿ Kebutuhan Aksesibilitas" accent="#F59E0B">
          <InfoBox type="warn" msg={guest.detail_aksesibilitas || "Membutuhkan aksesibilitas khusus (detail tidak diisi)"}/>
        </CardSection>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
//  UI BUILDING BLOCKS
// ══════════════════════════════════════════════════════════════

function DetailLayout({ onBack, isMobile, title, subtitle, badge, children, premium }) {
  return (
    <div style={{flex:1,overflowY:"auto",background:"#F0F4FA",paddingBottom:48}}>
      {/* Header */}
      <div style={{
        background: premium
          ? "linear-gradient(135deg,"+NAVY+" 0%,#0D2347 100%)"
          : "linear-gradient(135deg,"+NAVY_MID+" 0%,"+NAVY_L+" 100%)",
        padding: isMobile?"16px":"22px 28px",
        display:"flex",alignItems:"center",gap:12,
      }}>
        <button onClick={onBack} style={{
          background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",
          borderRadius:10,padding:"8px 14px",color:"white",cursor:"pointer",fontSize:12,fontWeight:700,flexShrink:0,
        }}>← Kembali</button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:GOLD,fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:2}}>
            {subtitle}
          </div>
          <div style={{color:"white",fontSize:15,fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {title}
          </div>
        </div>
        {badge}
      </div>
      <div style={{padding:isMobile?"14px":"20px 28px",maxWidth:640,margin:"0 auto"}}>
        {children}
      </div>
    </div>
  );
}

function GuestCard({ guest, onClick, showChain, premium, readonly }) {
  var sc = STATUS_CFG[guest.status] || STATUS_CFG.pending_rk;
  var pc = PRIORITY_CFG[gPrioritas(guest)] || PRIORITY_CFG.biasa;

  return (
    <div
      className="gd-card"
      onClick={readonly ? undefined : onClick}
      style={{
        background:"white",borderRadius:18,marginBottom:10,overflow:"hidden",
        boxShadow:"0 2px 10px rgba(10,22,40,0.06)",
        border:"1.5px solid "+(premium?GOLD+"40":"#E8EDF4"),
        cursor: readonly?"default":"pointer",
        transition:"all .18s",
      }}
    >
      {/* Status bar */}
      <div style={{height:4,background:sc.bar}}/>

      <div style={{padding:"13px 15px"}}>
        {/* Baris atas */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:15,fontWeight:800,color:NAVY,marginBottom:2,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {gName(guest)}
            </div>
            {gInstansi(guest)!=="–" && (
              <div style={{fontSize:11,color:"#64748B"}}>🏢 {gInstansi(guest)}</div>
            )}
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
            <span style={{background:sc.bg,color:sc.color,borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:700}}>
              {sc.label}
            </span>
            {gPrioritas(guest)!=="biasa" && (
              <span title={"Prioritas: "+pc.label} style={{background:pc.bg,color:pc.color,borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",gap:4}}>
                <span aria-hidden="true">{pc.icon}</span>
                {pc.label}
              </span>
            )}
          </div>
        </div>

        {/* Maksud */}
        <div style={{fontSize:12,color:"#475569",lineHeight:1.5,marginBottom:8,
          overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
          📋 {gMaksud(guest)}
        </div>

        {/* Chain: catatan-catatan (hanya showChain) */}
        {showChain && (guest.catatan_rk || guest.catatan_staf) && (
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
            {guest.catatan_rk    && <span style={{fontSize:10,background:"#EFF6FF",color:"#1D4ED8",borderRadius:8,padding:"2px 8px",fontWeight:600}}>📋 Admin RK</span>}
            {guest.catatan_staf  && <span style={{fontSize:10,background:"#FFFBEB",color:"#92400E",borderRadius:8,padding:"2px 8px",fontWeight:600}}>🔍 Kasubbag</span>}
            {guest.telaah_kabag  && <span style={{fontSize:10,background:"#EDE9FE",color:"#5B21B6",borderRadius:8,padding:"2px 8px",fontWeight:600}}>⚖️ Kabag</span>}
          </div>
        )}

        {/* Footer */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,color:"#94A3B8"}}>📱 {gPhone(guest)}</span>
          <span style={{fontSize:11,color:"#94A3B8"}}>{fmtTs(guest.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

function CardSection({ title, accent, children }) {
  return (
    <div style={{
      background:"white",borderRadius:14,marginBottom:12,overflow:"hidden",
      border:"1px solid "+(accent?accent+"40":"#E8EDF4"),
      boxShadow:"0 1px 6px rgba(10,22,40,0.04)",
    }}>
      {title && (
        <div style={{
          padding:"9px 14px",fontSize:11,fontWeight:800,color:NAVY,letterSpacing:.4,
          borderBottom:"1px solid "+(accent?accent+"30":"#F1F5F9"),
          background:accent?accent+"12":"#FAFBFF",
        }}>
          {title}
        </div>
      )}
      <div style={{padding:"12px 14px"}}>{children}</div>
    </div>
  );
}

function InfoRow({ icon, label, value, bold }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,padding:"6px 0",borderBottom:"1px solid #F8FAFC"}}>
      <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:.4,flexShrink:0,paddingTop:2}}>
        {icon} {label}
      </div>
      <div style={{fontSize:13,color:NAVY,fontWeight:bold?700:500,textAlign:"right",lineHeight:1.4}}>
        {value||"–"}
      </div>
    </div>
  );
}

function CatatanBox({ label, isi, color, bg }) {
  return (
    <div style={{background:bg||"#F8FAFC",border:"1.5px solid "+color+"30",borderRadius:12,padding:"11px 14px",marginBottom:12}}>
      <div style={{fontSize:10,fontWeight:700,color:color,textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>
        {label}
      </div>
      <div style={{fontSize:13,color:"#334155",lineHeight:1.6}}>{isi}</div>
    </div>
  );
}

function InfoBox({ type, msg }) {
  var cfg = {
    success: {bg:"#D1FAE5",color:"#065F46",border:"#86EFAC"},
    error:   {bg:"#FEE2E2",color:"#991B1B",border:"#FECACA"},
    warn:    {bg:"#FEF3C7",color:"#92400E",border:"#FDE68A"},
    info:    {bg:"#EFF6FF",color:"#1D4ED8",border:"#BFDBFE"},
  }[type]||{bg:"#F1F5F9",color:"#475569",border:"#CBD5E1"};
  return (
    <div style={{background:cfg.bg,border:"1.5px solid "+cfg.border,borderRadius:12,
      padding:"11px 14px",marginBottom:12,fontSize:13,fontWeight:600,color:cfg.color,lineHeight:1.55}}>
      {msg}
    </div>
  );
}

function KonfirmasiBox({ pesan, onYa, onBatal, loading, warna }) {
  return (
    <div style={{background:"#FAFBFF",border:"2px solid "+(warna||NAVY)+"30",borderRadius:14,padding:"14px",marginBottom:12}}>
      <div style={{fontSize:13,color:NAVY,fontWeight:600,lineHeight:1.55,marginBottom:12}}>{pesan}</div>
      <div style={{display:"flex",gap:8}}>
        <ActionBtn label={loading?"Memproses...":"Ya, Lanjutkan"} color={warna||NAVY} flex={2}
          onClick={onYa} loading={loading}/>
        <ActionBtn label="Batal" color="#64748B" flex={1} outline onClick={onBatal}/>
      </div>
    </div>
  );
}

function ActionBtn({ label, color, flex, outline, onClick, loading }) {
  return (
    <button
      className="gd-btn-act"
      disabled={!!loading}
      onClick={onClick}
      style={{
        flex: flex||1, padding:"12px 10px", borderRadius:11, cursor:loading?"not-allowed":"pointer",
        border: outline?"1.5px solid "+color+"60":"none",
        background: outline?"white":(loading?"#94A3B8":color),
        color: outline?color:"white",
        fontSize:12,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:7,
        transition:"all .15s",
      }}
    >
      {loading && <Spin/>}
      {label}
    </button>
  );
}

// Indikator "Data per HH:MM" + tombol segarkan manual
// Filter daftar tamu berdasarkan kata kunci (nama / instansi / no WA / maksud)
function filterByQuery(list, q) {
  var s = String(q || "").trim().toLowerCase();
  if (!s) return list;
  return (list || []).filter(function (g) {
    return [gName(g), gInstansi(g), gPhone(g), gMaksud(g), gTujuan(g)]
      .join(" ").toLowerCase().indexOf(s) !== -1;
  });
}

// Kotak pencarian untuk tab "Lacak Semua"
function TrackSearch({ value, onChange }) {
  return (
    <div style={{ padding: "10px 16px 0" }}>
      <input
        className="gd-inp"
        value={value}
        onChange={function (e) { onChange(e.target.value); }}
        placeholder="🔎 Cari nama, instansi, atau nomor WA…"
        style={{
          width: "100%", boxSizing: "border-box", padding: "10px 14px",
          borderRadius: 12, border: "1.5px solid #D8E0EC", fontSize: 13,
          background: "white", color: NAVY,
        }}
      />
    </div>
  );
}

function MetaBar({ lastLoaded, onRefresh, loading }) {
  var ts = lastLoaded
    ? lastLoaded.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : "—";
  return (
    <div style={{ padding: "8px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "#64748B" }}>
      <span>Data per: <b style={{ color: NAVY }}>{ts}</b></span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={!!loading}
        style={{
          background: "white", border: "1px solid " + NAVY + "33",
          color: NAVY, borderRadius: 6, padding: "4px 10px",
          fontSize: 11, fontWeight: 700, cursor: loading ? "wait" : "pointer",
        }}>
        {loading ? "Memuat…" : "↻ Segarkan"}
      </button>
    </div>
  );
}

function TabBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={active?"gd-tab-active":""}
      style={{
        padding:"6px 14px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",
        border:"1.5px solid "+(active?NAVY:"#D1D9E6"),
        background:active?NAVY:"white",
        color:active?"white":"#64748B",
        transition:"all .15s",
      }}
    >
      {label}
    </button>
  );
}

function ChipStat({ label, value, color }) {
  return (
    <div style={{
      display:"inline-flex",alignItems:"center",gap:7,
      background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",
      borderRadius:20,padding:"5px 12px",
    }}>
      <span style={{fontSize:16,fontWeight:900,color:color||"white"}}>{value}</span>
      <span style={{fontSize:10,color:"rgba(255,255,255,0.55)"}}>{label}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  var sc = STATUS_CFG[status]||STATUS_CFG.pending_rk;
  return (
    <span style={{background:sc.bg,color:sc.color,borderRadius:20,padding:"4px 12px",fontSize:10,fontWeight:700,flexShrink:0}}>
      {sc.label}
    </span>
  );
}

function EmptyState({ label }) {
  return (
    <div style={{textAlign:"center",padding:"60px 24px",background:"white",borderRadius:24,
      boxShadow:"0 4px 20px rgba(0,0,0,0.03)",marginTop:8}}>
      <div style={{fontSize:48,marginBottom:16}}>🛋️</div>
      <div style={{fontSize:17,fontWeight:800,color:NAVY,marginBottom:6}}>Ruang Tunggu Kosong</div>
      <div style={{fontSize:13,color:"#64748B"}}>{label}</div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div>
      {[0,1,2].map(function(i){
        return (
          <div key={i} style={{
            background:"white",borderRadius:18,marginBottom:10,padding:"16px",
            border:"1px solid #E8EDF4",opacity:1-i*0.25,
          }}>
            <div style={{height:14,borderRadius:6,background:"#F1F5F9",width:"55%",marginBottom:9}}/>
            <div style={{height:11,borderRadius:5,background:"#F8FAFC",width:"35%",marginBottom:7}}/>
            <div style={{height:10,borderRadius:5,background:"#F8FAFC",width:"70%"}}/>
          </div>
        );
      })}
    </div>
  );
}

function Spin({ color }) {
  return (
    <span style={{
      width:13,height:13,borderRadius:"50%",
      border:"2.5px solid rgba(255,255,255,0.25)",
      borderTopColor:color||"white",
      animation:"gd-spin .7s linear infinite",
      display:"inline-block",flexShrink:0,
    }}/>
  );
}

var inpStyle = {
  width:"100%",padding:"11px 13px",minHeight:44,borderRadius:11,
  border:"1.5px solid #D1D9E6",fontSize:14,color:NAVY,background:"white",
  outline:"none",fontFamily:"inherit",WebkitAppearance:"none",resize:"vertical",
  lineHeight:1.55,boxSizing:"border-box",
};

var subLabel = {
  display:"block",fontSize:11,fontWeight:700,color:"#4b6280",
  letterSpacing:.5,textTransform:"uppercase",marginBottom:5,
};