/**
 * src/GuestDashboard.jsx — Prokopim v1.5
 * Manajemen Tamu — 4 Role Views
 *
 * INTEGRASI di ProkopimApp.jsx:
 *   import GuestDashboard from "./GuestDashboard.jsx";
 *
 *   // Di routing tab, tambahkan:
 *   :tab==="tamu"
 *     ?<GuestDashboard
 *         role={role}
 *         user={user}
 *         events={events}
 *         showT={showT}
 *         isMobile={isMobile}
 *       />
 *
 * Role yang dapat akses tab "tamu":
 *   admin_rk, kasubbag_protokol  → AdminKasubbagView
 *   kabag                        → KabagView
 *   walikota, wakilwalikota      → PimpinanView
 *   ajudan_walikota, ajudan_wakilwalikota        → AjudanView
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";

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
  waiting:   { text:"Baru Masuk",        bg:"#EFF6FF", color:"#1D4ED8" },
  screened:  { text:"Siap ke Kabag",     bg:"#FEF3C7", color:"#92400E" },
  forwarded: { text:"Diteruskan ke Pimpinan", bg:"#EDE9FE", color:"#5B21B6" },
  accepted:  { text:"Disetujui",         bg:"#D1FAE5", color:"#065F46" },
  rejected:  { text:"Ditolak",           bg:"#FEF2F2", color:"#991B1B" },
  disposed:  { text:"Didisposisi",       bg:"#F1F5F9", color:"#475569" },
};

// ── Data SOP Lengkap ─────────────────────────────────────────
var SOP_DISCLAIMER = "Panduan ini bersifat sebagai referensi dan standar dasar operasional. Keputusan akhir mengenai pengkategorian, penentuan tingkat urgensi, serta penjadwalan tamu sepenuhnya merupakan hak prerogatif dan berdasarkan hasil penilaian (assessment) situasional dari Bagian Prokopim Setda Kota Tarakan.";

var SOP_BAGIAN = [
  {
    bagian: "BAGIAN 1",
    judul: "Klasifikasi Status Tamu",
    icon: "🎖️",
    warna: "#1D4ED8",
    warnaBg: "#EFF6FF",
    warnaBorder: "#BFDBFE",
    kelompok: [
      {
        label: "1. Tamu VVIP / VIP",
        sublabel: "Prioritas Utama",
        warna: "#7C3AED",
        warnaBg: "#F5F3FF",
        warnaBorder: "#C4B5FD",
        isi: [
          { bold: "Pejabat Negara/Pusat:", teks: "Menteri, Wamen, Pimpinan Lembaga Tinggi Negara." },
          { bold: "Pejabat Provinsi Kaltara:", teks: "Gubernur, Wagub, Sekda, Pimpinan OPD Provinsi." },
          { bold: "Forkopimda:", teks: "Kapolres, Dandim, Kajari, Ketua PN/PA, Danlanal, Danlanud." },
          { bold: "Legislatif:", teks: "Anggota DPR/DPD RI, Pimpinan/Anggota DPRD Provinsi & Kota Tarakan." },
          { bold: "Instansi Vertikal & BUMN/BUMD:", teks: "Kepala BI, BPK, BPS, KPU, Pelindo, PLN, Bankaltimtara." },
          { bold: "Tokoh Sentral:", teks: "Pimpinan Parpol, Ketua MUI, Tokoh Adat/Pemuka Agama, Dubes/Investor." },
        ],
      },
      {
        label: "2. Tamu Reguler",
        sublabel: "Standar",
        warna: "#0369A1",
        warnaBg: "#F0F9FF",
        warnaBorder: "#BAE6FD",
        isi: [
          { bold: null, teks: "Pimpinan Ormas, LSM, OKP, Paguyuban tingkat kota." },
          { bold: null, teks: "Akademisi, Rektor, Guru, Mahasiswa." },
          { bold: null, teks: "Perusahaan Swasta (penawaran produk, CSR)." },
          { bold: null, teks: "Warga masyarakat umum, RT/RW, tokoh masyarakat kelurahan/kecamatan." },
        ],
      },
    ],
  },
  {
    bagian: "BAGIAN 2",
    judul: "Klasifikasi Tingkat Urgensi",
    icon: "⚡",
    warna: "#B45309",
    warnaBg: "#FFFBEB",
    warnaBorder: "#FDE68A",
    kelompok: [
      {
        label: "🔴 TINGGI — Sangat Mendesak",
        sublabel: "Jadwalkan H-0 s/d H-2",
        warna: "#991B1B",
        warnaBg: "#FEF2F2",
        warnaBorder: "#FECACA",
        isi: [
          { bold: "Krisis & Keamanan:", teks: "Bencana alam, konflik sosial, demonstrasi." },
          { bold: "Batas Waktu Legal:", teks: "Penandatanganan MoU, APBD, NPHD krusial." },
          { bold: "Kunjungan Mendadak:", teks: "Pejabat pusat/provinsi yang butuh pendampingan segera." },
          { bold: "Investasi Strategis:", teks: "Investor besar dengan waktu terbatas." },
        ],
      },
      {
        label: "🟡 SEDANG — Penting tapi Fleksibel",
        sublabel: "Jadwalkan 3-7 hari ke depan",
        warna: "#92400E",
        warnaBg: "#FFFBEB",
        warnaBorder: "#FDE68A",
        isi: [
          { bold: "Koordinasi Program:", teks: "Rapat pembahasan program kerja antar instansi." },
          { bold: "Aspirasi Terarah:", teks: "Penyampaian aspirasi penting atau laporan hasil kerja." },
          { bold: "Undangan Seremonial:", teks: "Membuka acara tingkat kota/provinsi yang kredibel." },
        ],
      },
      {
        label: "🟢 RENDAH — Biasa / Rutin",
        sublabel: "Waiting list atau Disposisi ke OPD",
        warna: "#065F46",
        warnaBg: "#D1FAE5",
        warnaBorder: "#6EE7B7",
        isi: [
          { bold: "Silaturahmi / Courtesy Call:", teks: "Audiensi perkenalan pengurus baru." },
          { bold: "Penawaran / Sponsorship:", teks: "Presentasi produk, kerjasama komersial, proposal." },
          { bold: "Wawancara / Riset:", teks: "Kebutuhan akademis mahasiswa/lembaga survei." },
          { bold: "Undangan Skala Kecil:", teks: "Acara RT, sekolah, atau komunitas lokal." },
        ],
      },
    ],
  },
];

// Konstanta lama — tetap dipertahankan agar tidak break komponen lain
var SOP_PANDUAN = [
  { title: "Lihat Buku Panduan SOP lengkap", isi: ["Klik tombol Buku Panduan SOP di header dashboard."] },
];

// ── Helpers ──────────────────────────────────────────────────
function todayStr() {
  return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
}
function tomorrowStr() {
  return new Date(Date.now() + 8 * 3600000 + 86400000).toISOString().slice(0, 10);
}
function toMin(jam) {
  if (!jam) return 0;
  var p = jam.split(":");
  return parseInt(p[0], 10) * 60 + parseInt(p[1] || 0, 10);
}
function fmtTs(str) {
  if (!str) return "-";
  return new Date(str).toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDateLong(str) {
  if (!str) return "";
  var HARI  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  var BULAN = ["Januari","Februari","Maret","April","Mei","Juni",
               "Juli","Agustus","September","Oktober","November","Desember"];
  var d = new Date(str + "T00:00:00+08:00");
  return HARI[d.getDay()] + ", " + d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear();
}
function getPejabatLabel(id) {
  if (id === "walikota")      return "Wali Kota";
  if (id === "wakilwalikota") return "Wakil Wali Kota";
  return id || "-";
}

// Deteksi bentrok jadwal dengan events Supabase
function detectConflict(events, tanggal, jam, pimpinan) {
  if (!tanggal || !jam) return [];
  var newStart = toMin(jam);
  var newEnd   = newStart + 60; // asumsi durasi 60 menit untuk audiensi
  return events.filter(function(ev) {
    if (ev.tanggal !== tanggal) return false;
    if (ev.alur !== "disetujui") return false;
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
  // Route ke view yang tepat berdasarkan role
  if (role === "walikota" || role === "wakilwalikota") {
    return (
      <PimpinanView
        role={role} user={user} events={events}
        showT={showT} isMobile={isMobile}
      />
    );
  }
  if (role === "ajudan_walikota" || role === "ajudan_wakilwalikota") {
    return (
      <AjudanView
        role={role} user={user}
        showT={showT} isMobile={isMobile}
      />
    );
  }
  if (role === "kabag") {
    return (
      <KabagView
        user={user}
        showT={showT} isMobile={isMobile}
      />
    );
  }
  // kasubbag_komdokpim dan timkom: read-only
  if (role === "kasubbag_komdokpim" || role === "timkom") {
    return (
      <ReadOnlyView
        role={role} isMobile={isMobile}
      />
    );
  }
  // admin_rk, kasubbag_protokol
  return (
    <AdminKasubbagView
      role={role} user={user}
      showT={showT} isMobile={isMobile}
    />
  );
}

// ══════════════════════════════════════════════════════════
//  VIEW 1: ADMIN RK / KASUBBAG — Kurasi & Verifikasi
// ══════════════════════════════════════════════════════════
function AdminKasubbagView({ role, user, showT, isMobile }) {
  var [guests,       setGuests]       = useState([]);
  var [loading,      setLoading]      = useState(true);
  var [filterStatus, setFilterStatus] = useState("waiting");
  var [showPanduan,  setShowPanduan]  = useState(false);
  var [showBukuSOP,  setShowBukuSOP]  = useState(false);
  var [showManual,   setShowManual]   = useState(false);
  var [detailId,     setDetailId]     = useState(null);

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
      <KurasiDetailView
        guest={detail}
        user={user}
        onBack={function() { setDetailId(null); load(); }}
        showT={showT}
        isMobile={isMobile}
      />
    );
  }

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>

      {/* Header */}
      <div style={{
        background: "linear-gradient(160deg," + NAVY + ",#1A2F5E)",
        padding: isMobile ? "20px 16px" : "24px 28px",
        position: "relative",
      }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
          <div>
            <div style={{ color:GOLD, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>
              Manajemen Tamu
            </div>
            <div style={{ color:"white", fontSize:isMobile?18:21, fontWeight:900, marginBottom:8 }}>
              Kurasi Permohonan
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <StatPill label="Baru" value={guests.filter(function(g){return g.status==="waiting";}).length} color="#FCA5A5"/>
              <StatPill label="Siap Naik" value={guests.filter(function(g){return g.status==="screened";}).length} color={GOLD}/>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
            {/* Tombol Buku Panduan SOP */}
            <button
              onClick={function() { setShowBukuSOP(true); }}
              style={{
                padding:"7px 13px", borderRadius:10,
                background:"rgba(201,168,76,0.15)",
                border:"1.5px solid rgba(201,168,76,0.4)",
                color:GOLD, fontSize:11, fontWeight:700,
                cursor:"pointer", display:"flex", alignItems:"center", gap:6,
                whiteSpace:"nowrap",
              }}
            >
              📖 Buku Panduan SOP
            </button>
            {/* Tombol input manual */}
            <button
              onClick={function() { setShowManual(true); }}
              style={{
                padding:"7px 12px", borderRadius:10,
                background:GOLD, border:"none",
                color:NAVY, fontSize:11, fontWeight:800,
                cursor:"pointer", display:"flex", alignItems:"center", gap:5,
                whiteSpace:"nowrap",
              }}
            >
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
          { k:"forwarded", l:"Di Kabag" },
          { k:"accepted",  l:"Disetujui" },
          { k:"rejected",  l:"Ditolak" },
        ].map(function(f) {
          var active = filterStatus === f.k;
          return (
            <button
              key={f.k}
              onClick={function() { setFilterStatus(f.k); }}
              style={{
                padding:"5px 13px", borderRadius:20, fontSize:11, fontWeight:700,
                border:"1.5px solid " + (active ? NAVY : "#D1D9E6"),
                background: active ? NAVY : "white",
                color: active ? "white" : "#64748B",
                cursor:"pointer",
              }}
            >
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
            ? <EmptyGuest label={"Tidak ada tamu dengan status ini."}/>
            : guests.map(function(g) {
                return (
                  <GuestCardItem
                    key={g.id}
                    guest={g}
                    onClick={function() { setDetailId(g.id); }}
                    showPriority
                  />
                );
              })
        }
      </div>

      {/* Modal panduan lama (tidak dipakai tapi tetap ada) */}
      {showPanduan && (
        <PanduanModal onClose={function() { setShowPanduan(false); }}/>
      )}

      {/* Modal Buku Panduan SOP lengkap */}
      {showBukuSOP && (
        <BukuPanduanModal onClose={function() { setShowBukuSOP(false); }}/>
      )}

      {/* Modal input manual */}
      {showManual && (
        <InputManualModal
          user={user}
          onClose={function() { setShowManual(false); }}
          onSuccess={function() { setShowManual(false); load(); showT("Tamu berhasil diinput manual"); }}
        />
      )}
    </div>
  );
}

// ── Detail Kurasi (untuk Admin/Kasubbag) ─────────────────────
function KurasiDetailView({ guest, user, onBack, showT, isMobile }) {
  var [priority, setPriority] = useState(guest.priority || "biasa");
  var [catatan,  setCatatan]  = useState(guest.staff_notes || "");
  var [loading,  setLoading]  = useState(false);
  var [waLoading,setWaLoading]= useState(false);

  async function verifikasiWA() {
    setWaLoading(true);
    try {
      var r = await fetch(API + "?action=verify_wa", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ id: guest.id }),
      });
      var data = await r.json();
      if (!r.ok) throw new Error(data.error || "Gagal");
      showT("WA verifikasi terkirim ke " + guest.phone);
    } catch(e) { showT("Gagal: " + e.message); }
    finally { setWaLoading(false); }
  }

  async function naikkanKabag() {
    setLoading(true);
    try {
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
      showT("Tamu dinaikkan ke Kabag");
      onBack();
    } catch(e) { showT("Gagal: " + e.message); }
    finally { setLoading(false); }
  }

  var pc = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.biasa;

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>
      {/* Header */}
      <div style={{
        background:"linear-gradient(135deg," + NAVY + "," + NAVY_MID + ")",
        padding: isMobile ? "16px" : "20px 28px",
        display:"flex", alignItems:"center", gap:12,
      }}>
        <button onClick={onBack} style={backBtnStyle}>
          ← Kembali
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:GOLD, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase" }}>
            Detail Tamu
          </div>
          <div style={{ color:"white", fontSize:15, fontWeight:800, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {guest.name}
          </div>
        </div>
      </div>

      <div style={{ padding: isMobile ? "14px" : "20px 28px" }}>

        {/* Info tamu */}
        <SectionCard title="Informasi Tamu">
          <InfoGrid rows={[
            { l:"Nama",         v: guest.name },
            { l:"Instansi",     v: guest.organization || "-" },
            { l:"WhatsApp",     v: guest.phone },
            { l:"Tujuan",       v: getPejabatLabel(guest.tujuan_pejabat) },
            { l:"Keperluan",    v: guest.purpose },
            { l:"Pref. Jadwal", v: guest.preferred_date
                ? (guest.preferred_date + (guest.preferred_time ? " " + guest.preferred_time + " WITA" : ""))
                : "Tidak ditentukan" },
            { l:"Daftar",       v: fmtTs(guest.created_at) },
          ]}/>
          {guest.message && (
            <div style={{ marginTop:10, background:"#F8FAFC", borderRadius:9, padding:"9px 11px", fontSize:13, color:"#334155", lineHeight:1.6 }}>
              💬 {guest.message}
            </div>
          )}
          {guest.needs_aksesibilitas && (
            <div style={{ marginTop:8, background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:9, padding:"8px 11px", fontSize:12, color:"#1D4ED8" }}>
              ♿ Aksesibilitas: {guest.aksesibilitas_detail || "Dibutuhkan"}
            </div>
          )}
        </SectionCard>

        {/* Tombol Verifikasi WA */}
        <button
          onClick={verifikasiWA}
          disabled={waLoading}
          style={{
            width:"100%", padding:"11px", borderRadius:11,
            border:"2px solid #25D366", background:"white",
            color:"#128C7E", fontSize:13, fontWeight:700,
            cursor: waLoading ? "not-allowed" : "pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            marginBottom:14,
          }}
        >
          {waLoading ? <Spinner color="#128C7E"/> : "📱"}
          {waLoading ? "Mengirim..." : "Verifikasi via WhatsApp"}
        </button>

        {/* Kurasi internal */}
        <SectionCard title="Kurasi Internal" accent="#FDE68A">
          {/* Prioritas */}
          <div style={{ marginBottom:12 }}>
            <div style={sectionSubLabel}>Label Prioritas</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {Object.entries(PRIORITY_CONFIG).map(function([k, c]) {
                var active = priority === k;
                return (
                  <button
                    key={k}
                    onClick={function() { setPriority(k); }}
                    style={{
                      display:"flex", alignItems:"center", gap:6,
                      padding:"7px 14px", minHeight:38, borderRadius:20,
                      border:"2px solid " + (active ? c.color : "#E2E8F0"),
                      background: active ? c.bg : "white",
                      color: active ? c.color : "#64748B",
                      fontSize:12, fontWeight:700, cursor:"pointer",
                    }}
                  >
                    <span style={{
                      width:8, height:8, borderRadius:"50%",
                      background: c.dot, flexShrink:0,
                    }}/>
                    {c.label}
                    {active && " ✓"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Catatan staf */}
          <div style={{ marginBottom:14 }}>
            <label style={sectionSubLabel}>
              Catatan Staf / Rekomendasi Disposisi
            </label>
            <textarea
              value={catatan}
              onChange={function(e) { setCatatan(e.target.value); }}
              rows={3}
              placeholder="Tuliskan rekomendasi disposisi atau catatan penting untuk Kabag..."
              style={textareaStyle}
            />
          </div>

          {/* Tombol naikkan */}
          <button
            onClick={naikkanKabag}
            disabled={loading}
            style={{
              width:"100%", padding:"13px", borderRadius:12, border:"none",
              background: loading ? "#94A3B8" : ("linear-gradient(135deg," + NAVY + "," + NAVY_MID + ")"),
              color:"white", fontSize:14, fontWeight:800,
              cursor: loading ? "not-allowed" : "pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              boxShadow: loading ? "none" : "0 4px 14px rgba(10,22,40,0.22)",
            }}
          >
            {loading ? <Spinner/> : null}
            ⬆ Naikkan ke Kabag
          </button>
        </SectionCard>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  VIEW 2: KABAG — Filter & Telaah Eksekutif
// ══════════════════════════════════════════════════════════
function KabagView({ user, showT, isMobile }) {
  var [guests,     setGuests]     = useState([]);
  var [loading,    setLoading]    = useState(true);
  var [masterView, setMasterView] = useState(false);
  var [filterSt,   setFilterSt]   = useState("screened");
  var [detailId,   setDetailId]   = useState(null);
  var [showBukuSOP, setShowBukuSOP] = useState(false);

  var load = useCallback(function() {
    setLoading(true);
    var st = masterView ? "all" : filterSt;
    fetch(API + "?action=queue&status=" + st + "&limit=100")
      .then(function(r) { return r.json(); })
      .then(function(d) { setGuests(Array.isArray(d) ? d : []); })
      .catch(function() { setGuests([]); })
      .finally(function() { setLoading(false); });
  }, [filterSt, masterView]);

  useEffect(function() { load(); }, [load]);

  var detail = guests.find(function(g) { return g.id === detailId; }) || null;

  if (detailId && detail) {
    return (
      <KabagDetailView
        guest={detail}
        user={user}
        onBack={function() { setDetailId(null); load(); }}
        showT={showT}
        isMobile={isMobile}
      />
    );
  }

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>
      {/* Header */}
      <div style={{
        background:"linear-gradient(160deg," + NAVY + ",#1A2F5E)",
        padding: isMobile ? "20px 16px" : "24px 28px",
      }}>
        <div style={{ color:GOLD, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>
          Manajemen Tamu
        </div>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 }}>
          <div style={{ color:"white", fontSize:isMobile?18:21, fontWeight:900, marginBottom:10 }}>
            Telaah Eksekutif
          </div>
          <button
            onClick={function() { setShowBukuSOP(true); }}
            style={{
              padding:"7px 13px", borderRadius:10, flexShrink:0,
              background:"rgba(201,168,76,0.15)",
              border:"1.5px solid rgba(201,168,76,0.4)",
              color:GOLD, fontSize:11, fontWeight:700,
              cursor:"pointer", display:"flex", alignItems:"center", gap:6,
              whiteSpace:"nowrap",
            }}
          >
            📖 Buku Panduan SOP
          </button>
        </div>
        {/* Toggle master view */}
        <button
          onClick={function() { setMasterView(function(p) { return !p; }); }}
          style={{
            padding:"6px 14px", borderRadius:20, fontSize:11, fontWeight:700,
            border:"1.5px solid " + (masterView ? GOLD : "rgba(255,255,255,0.3)"),
            background: masterView ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.08)",
            color: masterView ? GOLD : "rgba(255,255,255,0.7)",
            cursor:"pointer",
          }}
        >
          {masterView ? "👁 Master View: ON" : "👁 Master View: OFF"}
        </button>
      </div>

      {/* Filter */}
      {!masterView && (
        <div style={{ padding:"12px 16px 0", display:"flex", gap:6, flexWrap:"wrap" }}>
          {[
            { k:"screened",  l:"Siap Ditelaah" },
            { k:"forwarded", l:"Diteruskan" },
            { k:"accepted",  l:"Disetujui" },
            { k:"rejected",  l:"Ditolak" },
          ].map(function(f) {
            var active = filterSt === f.k;
            return (
              <button
                key={f.k}
                onClick={function() { setFilterSt(f.k); }}
                style={{
                  padding:"5px 13px", borderRadius:20, fontSize:11, fontWeight:700,
                  border:"1.5px solid " + (active ? NAVY : "#D1D9E6"),
                  background: active ? NAVY : "white",
                  color: active ? "white" : "#64748B",
                  cursor:"pointer",
                }}
              >
                {f.l}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ padding:"12px 16px" }}>
        {loading
          ? <SkeletonList/>
          : guests.length === 0
            ? <EmptyGuest label="Tidak ada permohonan di kategori ini."/>
            : guests.map(function(g) {
                return (
                  <GuestCardItem
                    key={g.id}
                    guest={g}
                    onClick={function() { setDetailId(g.id); }}
                    showPriority
                    showStaffNote
                  />
                );
              })
        }
      </div>
      {/* Modal Buku Panduan SOP */}
      {showBukuSOP && (
        <BukuPanduanModal onClose={function() { setShowBukuSOP(false); }}/>
      )}
    </div>
  );
}

// ── Detail Telaah Kabag ───────────────────────────────────────
function KabagDetailView({ guest, user, onBack, showT, isMobile }) {
  var [catatanKabag, setCatatanKabag] = useState(guest.kabag_notes || "");
  var [loading,      setLoading]      = useState(false);

  async function teruskan() {
    if (!catatanKabag.trim()) {
      showT("Isi Catatan/Telaah Kabag terlebih dahulu");
      return;
    }
    setLoading(true);
    try {
      var r = await fetch(API + "?action=forward", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          id: guest.id,
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

  var pc = PRIORITY_CONFIG[guest.priority] || PRIORITY_CONFIG.biasa;

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>
      <div style={{
        background:"linear-gradient(135deg," + NAVY + "," + NAVY_MID + ")",
        padding: isMobile ? "16px" : "20px 28px",
        display:"flex", alignItems:"center", gap:12,
      }}>
        <button onClick={onBack} style={backBtnStyle}>← Kembali</button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:GOLD, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase" }}>Telaah Kabag</div>
          <div style={{ color:"white", fontSize:15, fontWeight:800, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {guest.name}
          </div>
        </div>
        <span style={{ background:pc.bg, color:pc.color, borderRadius:20, padding:"3px 11px", fontSize:11, fontWeight:700, flexShrink:0 }}>
          {pc.label}
        </span>
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

        {/* Catatan staf */}
        {guest.staff_notes && (
          <div style={{
            background:"#FFFBEB", border:"1.5px solid #FDE68A",
            borderRadius:12, padding:"12px 14px", marginBottom:14,
          }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#92400E", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>
              Catatan Staf
            </div>
            <p style={{ fontSize:13, color:"#78350F", lineHeight:1.6, margin:0 }}>
              {guest.staff_notes}
            </p>
          </div>
        )}

        {/* Telaah Kabag */}
        <SectionCard title="Catatan / Telaah Kabag" accent="#C4B5FD">
          <label style={sectionSubLabel}>
            Rekomendasi final untuk Pimpinan (wajib sebelum diteruskan)
          </label>
          <textarea
            value={catatanKabag}
            onChange={function(e) { setCatatanKabag(e.target.value); }}
            rows={4}
            placeholder="Contoh: Tamu ini representatif dan mendesak — disarankan diterima segera. Atau: Permohonan bisa didisposisi ke Kepala Dinas terkait."
            style={textareaStyle}
          />
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button
              onClick={teruskan}
              disabled={loading}
              style={{
                flex:3, padding:"12px", borderRadius:11, border:"none",
                background: loading ? "#94A3B8" : ("linear-gradient(135deg," + NAVY + "," + NAVY_MID + ")"),
                color:"white", fontSize:13, fontWeight:800,
                cursor: loading ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:7,
              }}
            >
              {loading ? <Spinner/> : null}
              📤 Teruskan ke Pimpinan
            </button>
            <button
              onClick={kembalikan}
              disabled={loading}
              style={{
                flex:2, padding:"12px", borderRadius:11,
                border:"1.5px solid #CBD5E1", background:"white",
                color:"#64748B", fontSize:13, fontWeight:700,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              ↩ Kembalikan
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  VIEW 3: PIMPINAN — Zen Mode
// ══════════════════════════════════════════════════════════
function PimpinanView({ role, user, events, showT, isMobile }) {
  var [guests,   setGuests]   = useState([]);
  var [loading,  setLoading]  = useState(true);
  var [idx,      setIdx]      = useState(0);
  var [modal,    setModal]    = useState(null); // null | "schedule" | "disposisi" | "tolak"
  var [schedDate,setSchedDate]= useState("");
  var [schedTime,setSchedTime]= useState("");
  var [dispTo,   setDispTo]   = useState("");
  var [rejectR,  setRejectR]  = useState("");
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

  // Deteksi bentrok
  var conflicts = useMemo(function() {
    if (!current || !schedDate || !schedTime) return [];
    return detectConflict(events, schedDate, schedTime, role);
  }, [current, schedDate, schedTime, events, role]);

  async function respond(action, extra) {
    if (!current) return;
    setActLoad(true);

    // ── Ambil konfigurasi Supabase (ikuti pola ProkopimApp) ──
    var SUPA_URL = (typeof import.meta !== "undefined" && import.meta.env)
      ? (import.meta.env.VITE_SUPABASE_URL || "") : "";
    var SUPA_KEY = (typeof import.meta !== "undefined" && import.meta.env)
      ? (import.meta.env.VITE_SUPABASE_ANON_KEY || "") : "";
    var supaHeaders = {
      "Content-Type":  "application/json",
      "apikey":        SUPA_KEY,
      "Authorization": "Bearer " + SUPA_KEY,
    };
    var supaOK = !!(SUPA_URL && SUPA_KEY);

    try {
      // ══════════════════════════════════════════════════
      // AKSI: accepted — INSERT jadwal + UPDATE permohonan
      // ══════════════════════════════════════════════════
      if (action === "accepted" && extra.scheduled_date && extra.scheduled_time) {

        if (!supaOK) throw new Error("Konfigurasi Supabase belum ada. Hubungi Admin.");

        var schedTanggal = extra.scheduled_date;
        var schedJam     = extra.scheduled_time;

        // Tentukan untukPimpinan berdasarkan role + tujuan_pejabat tamu
        var pejabatKey = current.tujuan_pejabat === "wakilwalikota"
          ? "wakilwalikota"
          : "walikota";

        // ── Step A: Bentuk object event lengkap (sesuai mkEv di ProkopimApp) ──
        var newEventId = Date.now();
        var keteranganCatatan = "Maksud: " + (current.purpose || "-");
        if (current.kabag_notes) {
          keteranganCatatan += " | Telaah Kabag: " + current.kabag_notes;
        }
        if (current.needs_aksesibilitas) {
          keteranganCatatan += " | ♿ Aksesibilitas: " + (current.aksesibilitas_detail || "Diperlukan");
        }

        var newEvent = {
          id:               newEventId,
          tanggal:          schedTanggal,
          jam:              schedJam,
          namaAcara:        "Audiensi: " + (current.name || "-") + " - " + (current.organization || "-"),
          penyelenggara:    current.name || "-",
          kontak:           current.phone || "-",
          buktiUndangan:    "Permohonan #" + (current.id ? String(current.id).slice(0, 8) : "-"),
          pakaian:          "PDH",
          jenisKegiatan:    "Menghadiri",
          catatan:          keteranganCatatan,
          lokasi:           "Ruang Pimpinan, Kantor Wali Kota Tarakan",
          untukPimpinan:    [pejabatKey],
          alur:             "disetujui",
          // ── Defaults dari mkEv (wajib ada agar tidak crash di ProkopimApp) ──
          catatanTolak:     "",
          catatanKasubbag:  "",
          catatanKabag:     "",
          statusWK:         null,
          statusWWK:        null,
          perwakilanWK:     "",
          perwakilanWWK:    "",
          delegasiKeWWK:    false,
          delegasiWWKJajaran: false,
          besertaIstriWK:   false,
          besertaIstriWWK:  false,
          sambutanFile:     null,
          sambutanNama:     "",
          sambutanDocx:     null,
          sambutanDocxNama: "",
          undanganFile:     null,
          undanganNama:     "",
          catatanPimpinan:  "",
          tersembunyi:      false,
          alurHapus:        null,
          personil:         [],
          catatanPenugasan: "",
          evaluasi:         {},
          // ── Metadata audiensi ──
          submittedBy:      user ? user.username : "pimpinan",
          _sumberTamu:      true,   // penanda bahwa event berasal dari modul tamu
        };

        // ── Step B: INSERT ke tabel jadwal ────────────────
        // Struktur identik dengan dbUpsert di ProkopimApp:
        // { id: newEventId, data: {...fullEventObject} }
        var insertJadwalRes = await fetch(SUPA_URL + "/rest/v1/jadwal", {
          method:  "POST",
          headers: Object.assign({}, supaHeaders, {
            "Prefer": "return=representation",
          }),
          body: JSON.stringify({ id: newEventId, data: newEvent }),
        });

        if (!insertJadwalRes.ok) {
          var jadwalErr = await insertJadwalRes.json().catch(function() { return {}; });
          throw new Error("Gagal membuat jadwal: " + (jadwalErr.message || jadwalErr.details || insertJadwalRes.status));
        }

        // ── Step C: UPDATE permohonan_tamu ─────────────────
        // SET status='approved', jadwal_id=String(newEventId), jadwal_tanggal, jadwal_jam
        var updateTamuRes = await fetch(
          SUPA_URL + "/rest/v1/permohonan_tamu?id=eq." + encodeURIComponent(current.id),
          {
            method:  "PATCH",
            headers: Object.assign({}, supaHeaders, { "Prefer": "return=minimal" }),
            body: JSON.stringify({
              status:         "approved",
              jadwal_id:      String(newEventId),
              jadwal_tanggal: schedTanggal,
              jadwal_jam:     schedJam,
              diputuskan_oleh: user ? user.username : null,
            }),
          }
        );

        if (!updateTamuRes.ok) {
          // Jadwal sudah terbuat — log warning tapi jangan throw
          // agar UI tidak terjebak di loading state
          var tamuErr = await updateTamuRes.json().catch(function() { return {}; });
          console.warn("GuestDashboard: UPDATE permohonan_tamu gagal —", tamuErr.message || updateTamuRes.status);
        }

        showT("✅ Jadwal audiensi berhasil dibuat");

      // ══════════════════════════════════════════════════
      // AKSI: disposed — UPDATE permohonan_tamu saja
      // ══════════════════════════════════════════════════
      } else if (action === "disposed") {
        if (supaOK && current.id) {
          await fetch(
            SUPA_URL + "/rest/v1/permohonan_tamu?id=eq." + encodeURIComponent(current.id),
            {
              method:  "PATCH",
              headers: Object.assign({}, supaHeaders, { "Prefer": "return=minimal" }),
              body: JSON.stringify({
                status:          "disposed",
                disposisi_ke:    extra.disposed_to || null,
                diputuskan_oleh: user ? user.username : null,
              }),
            }
          ).catch(function(e) { console.warn("GuestDashboard: disposisi update gagal —", e.message); });
        }
        showT("↩ Permohonan didisposisi");

      // ══════════════════════════════════════════════════
      // AKSI: rejected — UPDATE permohonan_tamu saja
      // ══════════════════════════════════════════════════
      } else if (action === "rejected") {
        if (supaOK && current.id) {
          await fetch(
            SUPA_URL + "/rest/v1/permohonan_tamu?id=eq." + encodeURIComponent(current.id),
            {
              method:  "PATCH",
              headers: Object.assign({}, supaHeaders, { "Prefer": "return=minimal" }),
              body: JSON.stringify({
                status:          "rejected",
                alasan_tolak:    extra.rejection_reason || null,
                diputuskan_oleh: user ? user.username : null,
              }),
            }
          ).catch(function(e) { console.warn("GuestDashboard: rejected update gagal —", e.message); });
        }
        showT("❌ Permohonan ditolak");

      } else {
        // Fallback — aksi lain tetap kirim ke /api/guest
        var body = Object.assign({
          id: current.id,
          response: action,
          pimpinan: role,
          responded_by: user ? user.username : null,
        }, extra || {});
        var r = await fetch(API + "?action=respond", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        var data = await r.json();
        if (!r.ok) throw new Error(data.error || "Gagal");
        showT("Berhasil");
      }

      // ── Refresh: hapus kartu yang sudah diproses ──────
      setGuests(function(prev) { return prev.filter(function(g) { return g.id !== current.id; }); });
      setIdx(0);
      setModal(null);
      setSchedDate(""); setSchedTime(""); setDispTo(""); setRejectR("");

    } catch(e) {
      showT("Gagal: " + (e.message || "Terjadi kesalahan"));
    } finally {
      setActLoad(false);
    }
  }

  function closeModal() {
    setModal(null);
    setSchedDate(""); setSchedTime(""); setDispTo(""); setRejectR("");
  }

  if (loading) {
    return (
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:"#F0F4FA" }}>
        <div style={{ fontSize:14, color:"#94A3B8" }}>Memuat permohonan...</div>
      </div>
    );
  }

  if (guests.length === 0) {
    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"#F0F4FA", padding:40, textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
        <div style={{ fontSize:18, fontWeight:800, color:NAVY, marginBottom:8 }}>Tidak ada permohonan</div>
        <div style={{ fontSize:13, color:"#64748B", lineHeight:1.6 }}>
          Semua permohonan audiensi sudah ditangani.<br/>
          Permohonan baru muncul setelah lolos telaah Kabag.
        </div>
      </div>
    );
  }

  var pc = current ? (PRIORITY_CONFIG[current.priority] || PRIORITY_CONFIG.biasa) : null;

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>
      {/* Header */}
      <div style={{
        background:"linear-gradient(160deg," + NAVY + ",#1A2F5E)",
        padding: isMobile ? "20px 16px" : "24px 28px",
      }}>
        <div style={{ color:GOLD, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>
          Permohonan Audiensi
        </div>
        <div style={{ color:"white", fontSize:isMobile?18:21, fontWeight:900, marginBottom:4 }}>
          {role === "walikota" ? "Wali Kota" : "Wakil Wali Kota"}
        </div>
        <div style={{ color:"rgba(255,255,255,0.45)", fontSize:12 }}>
          {guests.length} permohonan menunggu keputusan Anda
        </div>
      </div>

      <div style={{ padding: isMobile ? "14px" : "20px 28px" }}>
        {/* Navigasi kartu */}
        {guests.length > 1 && (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <button
              onClick={function() { setIdx(function(i) { return Math.max(0, i-1); }); }}
              disabled={idx === 0}
              style={navBtnStyle(idx === 0)}
            >
              ← Sebelumnya
            </button>
            <span style={{ fontSize:13, color:"#64748B", fontWeight:600 }}>
              {idx + 1} / {guests.length}
            </span>
            <button
              onClick={function() { setIdx(function(i) { return Math.min(guests.length-1, i+1); }); }}
              disabled={idx === guests.length - 1}
              style={navBtnStyle(idx === guests.length - 1)}
            >
              Berikutnya →
            </button>
          </div>
        )}

        {/* Kartu tamu */}
        {current && (
          <div style={{
            background:"white", borderRadius:22, overflow:"hidden",
            boxShadow:"0 12px 48px rgba(10,22,40,0.12), 0 2px 8px rgba(10,22,40,0.06)",
            border:"1.5px solid " + (pc ? pc.ring : "#E8EDF4"),
          }}>
            {/* Strip prioritas */}
            <div style={{
              height:5,
              background: current.priority === "mendesak"
                ? "linear-gradient(90deg,#DC2626,#B91C1C)"
                : current.priority === "penting"
                  ? "linear-gradient(90deg,#F59E0B,#D97706)"
                  : "linear-gradient(90deg," + NAVY + "," + NAVY_MID + ")",
            }}/>

            <div style={{ padding: isMobile ? "18px 16px" : "22px 20px" }}>
              {/* Identitas */}
              <div style={{ marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:4 }}>
                  <div style={{ fontSize: isMobile?19:23, fontWeight:900, color:NAVY, letterSpacing:-0.5, lineHeight:1.2 }}>
                    {current.name}
                  </div>
                  {pc && (
                    <span style={{ background:pc.bg, color:pc.color, borderRadius:20, padding:"3px 11px", fontSize:10, fontWeight:700, flexShrink:0 }}>
                      {pc.label}
                    </span>
                  )}
                </div>
                {current.organization && (
                  <div style={{ fontSize:13, color:"#64748B", marginBottom:4 }}>
                    🏢 {current.organization}
                  </div>
                )}
                <div style={{ fontSize:12, color:"#94A3B8" }}>
                  📱 {current.phone} · 🕐 {fmtTs(current.created_at)}
                </div>
              </div>

              {/* Keperluan */}
              <div style={{ background:"#F8FAFC", borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>
                  Tujuan Pimpinan & Keperluan
                </div>
                <div style={{ fontSize:12, color:"#7C3AED", fontWeight:700, marginBottom:4 }}>
                  → {getPejabatLabel(current.tujuan_pejabat)}
                </div>
                <div style={{ fontSize:14, color:NAVY, lineHeight:1.6 }}>
                  {current.purpose}
                </div>
                {current.message && (
                  <div style={{ fontSize:12, color:"#64748B", marginTop:6, fontStyle:"italic" }}>
                    💬 "{current.message}"
                  </div>
                )}
              </div>

              {/* Catatan Kabag */}
              {current.kabag_notes && (
                <div style={{
                  background:"#EDE9FE", border:"1.5px solid #C4B5FD",
                  borderRadius:11, padding:"11px 13px", marginBottom:12,
                }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#5B21B6", textTransform:"uppercase", letterSpacing:1, marginBottom:5 }}>
                    Catatan Kabag
                  </div>
                  <p style={{ fontSize:13, color:"#4C1D95", lineHeight:1.6, margin:0 }}>
                    {current.kabag_notes}
                  </p>
                </div>
              )}

              {/* Aksesibilitas */}
              {current.needs_aksesibilitas && (
                <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:10, padding:"9px 12px", marginBottom:12, fontSize:12, color:"#1D4ED8" }}>
                  ♿ Aksesibilitas diperlukan: {current.aksesibilitas_detail || "Dibutuhkan — harap siapkan fasilitas"}
                </div>
              )}

              {/* Permintaan jadwal */}
              {current.preferred_date && (
                <div style={{ background:"#F0F6FF", border:"1px solid #C8DCFF", borderRadius:10, padding:"9px 12px", marginBottom:14, fontSize:12, color:"#2563EB" }}>
                  📅 Permintaan: {fmtDateLong(current.preferred_date)}
                  {current.preferred_time ? " · " + current.preferred_time + " WITA" : ""}
                </div>
              )}

              {/* Modal jadwal */}
              {modal === "schedule" && (
                <div style={{
                  background:"#F0F4FA", borderRadius:13, padding:"14px",
                  border:"1.5px solid #D1D9E6", marginBottom:14,
                }}>
                  <div style={{ fontSize:12, fontWeight:700, color:NAVY, marginBottom:10 }}>
                    📅 Tentukan Jadwal Audiensi
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                    <div>
                      <div style={sectionSubLabel}>Tanggal</div>
                      <input
                        type="date"
                        value={schedDate}
                        min={todayStr()}
                        onChange={function(e) { setSchedDate(e.target.value); }}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <div style={sectionSubLabel}>Jam (WITA)</div>
                      <select
                        value={schedTime}
                        onChange={function(e) { setSchedTime(e.target.value); }}
                        style={inputStyle}
                      >
                        <option value="">Pilih jam</option>
                        {["08:00","09:00","10:00","11:00","13:00","14:00","15:00"].map(function(t) {
                          return <option key={t} value={t}>{t}</option>;
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Peringatan bentrok */}
                  {conflicts.length > 0 && (
                    <div style={{
                      background:"#FEF2F2", border:"2px solid #FECACA",
                      borderRadius:11, padding:"12px 14px", marginBottom:12,
                    }}>
                      <div style={{ fontSize:13, fontWeight:800, color:"#DC2626", marginBottom:7 }}>
                        ⚠️ Jadwal Bentrok!
                      </div>
                      {conflicts.map(function(c, i) {
                        return (
                          <div key={i} style={{ fontSize:12, color:"#991B1B", marginBottom:3 }}>
                            • {c.jam} WITA — {c.namaAcara} ({c.lokasi || "-"})
                          </div>
                        );
                      })}
                      <div style={{ fontSize:11, color:"#7F1D1D", marginTop:6, fontStyle:"italic" }}>
                        Silakan pilih jam lain atau pastikan durasi tidak tumpang tindih.
                      </div>
                    </div>
                  )}

                  <div style={{ display:"flex", gap:8 }}>
                    <button
                      onClick={function() {
                        if (!schedDate || !schedTime) { showT("Pilih tanggal dan jam dulu"); return; }
                        respond("accepted", { scheduled_date: schedDate, scheduled_time: schedTime });
                      }}
                      disabled={actLoading}
                      style={{
                        flex:2, padding:"11px", borderRadius:11, border:"none",
                        background: conflicts.length > 0 ? "#F59E0B" : "linear-gradient(135deg,#059669,#047857)",
                        color:"white", fontSize:13, fontWeight:800, cursor:"pointer",
                        display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                      }}
                    >
                      {actLoading ? <Spinner/> : null}
                      {conflicts.length > 0 ? "⚠ Tetap Konfirmasi" : "✅ Konfirmasi Jadwal"}
                    </button>
                    <button onClick={closeModal} style={cancelBtnStyle}>Batal</button>
                  </div>
                </div>
              )}

              {/* Modal disposisi */}
              {modal === "disposisi" && (
                <div style={{
                  background:"#EDE9FE", borderRadius:13, padding:"14px",
                  border:"1.5px solid #C4B5FD", marginBottom:14,
                }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#5B21B6", marginBottom:8 }}>
                    Disposisi ke:
                  </div>
                  <input
                    value={dispTo}
                    onChange={function(e) { setDispTo(e.target.value); }}
                    placeholder="Nama / Jabatan pejabat penerima disposisi"
                    style={inputStyle}
                  />
                  <div style={{ display:"flex", gap:8, marginTop:10 }}>
                    <button
                      onClick={function() {
                        if (!dispTo.trim()) { showT("Isi tujuan disposisi"); return; }
                        respond("disposed", { disposed_to: dispTo });
                      }}
                      disabled={actLoading}
                      style={{
                        flex:2, padding:"10px", borderRadius:10, border:"none",
                        background:"linear-gradient(135deg,#7C3AED,#5B21B6)",
                        color:"white", fontSize:13, fontWeight:800, cursor:"pointer",
                        display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                      }}
                    >
                      {actLoading ? <Spinner/> : "↩ Konfirmasi Disposisi"}
                    </button>
                    <button onClick={closeModal} style={cancelBtnStyle}>Batal</button>
                  </div>
                </div>
              )}

              {/* Modal tolak */}
              {modal === "tolak" && (
                <div style={{
                  background:"#FEF2F2", borderRadius:13, padding:"14px",
                  border:"1.5px solid #FECACA", marginBottom:14,
                }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#DC2626", marginBottom:8 }}>
                    Alasan penolakan (opsional — akan disampaikan ke tamu via WA):
                  </div>
                  <input
                    value={rejectR}
                    onChange={function(e) { setRejectR(e.target.value); }}
                    placeholder="Contoh: jadwal penuh, bukan kewenangan, harap ke dinas terkait, dll."
                    style={inputStyle}
                  />
                  <div style={{ display:"flex", gap:8, marginTop:10 }}>
                    <button
                      onClick={function() {
                        respond("rejected", { rejection_reason: rejectR });
                      }}
                      disabled={actLoading}
                      style={{
                        flex:2, padding:"10px", borderRadius:10, border:"none",
                        background:"linear-gradient(135deg,#DC2626,#B91C1C)",
                        color:"white", fontSize:13, fontWeight:800, cursor:"pointer",
                        display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                      }}
                    >
                      {actLoading ? <Spinner/> : "❌ Konfirmasi Penolakan"}
                    </button>
                    <button onClick={closeModal} style={cancelBtnStyle}>Batal</button>
                  </div>
                </div>
              )}

              {/* 3 Tombol utama — hanya tampil jika tidak ada modal aktif */}
              {!modal && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                  <button
                    onClick={function() { setModal("schedule"); }}
                    style={{
                      padding:"13px 8px", minHeight:52, borderRadius:14, border:"none",
                      background:"linear-gradient(135deg,#059669,#047857)",
                      color:"white", fontSize:12, fontWeight:800, cursor:"pointer",
                      display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                    }}
                  >
                    <span style={{ fontSize:18 }}>✅</span>
                    Terima &<br/>Jadwalkan
                  </button>
                  <button
                    onClick={function() { setModal("disposisi"); }}
                    style={{
                      padding:"13px 8px", minHeight:52, borderRadius:14, border:"none",
                      background:"linear-gradient(135deg,#7C3AED,#5B21B6)",
                      color:"white", fontSize:12, fontWeight:800, cursor:"pointer",
                      display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                    }}
                  >
                    <span style={{ fontSize:18 }}>↩</span>
                    Disposisi
                  </button>
                  <button
                    onClick={function() { setModal("tolak"); }}
                    style={{
                      padding:"13px 8px", minHeight:52, borderRadius:14,
                      background:"#FEF2F2",
                      color:"#DC2626", fontSize:12, fontWeight:800, cursor:"pointer",
                      border:"1.5px solid #FECACA",
                      display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                    }}
                  >
                    <span style={{ fontSize:18 }}>❌</span>
                    Tolak
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
//  VIEW 4: AJUDAN — Penyambutan (Hari Ini & Besok)
// ══════════════════════════════════════════════════════════
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
      {/* Header */}
      <div style={{
        background:"linear-gradient(160deg," + NAVY + ",#1A2F5E)",
        padding: isMobile ? "20px 16px" : "24px 28px",
      }}>
        <div style={{ color:GOLD, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>
          Mode Penyambutan
        </div>
        <div style={{ color:"white", fontSize:isMobile?18:21, fontWeight:900, marginBottom:4 }}>
          Tamu Disetujui Pimpinan
        </div>
        <div style={{ color:"rgba(255,255,255,0.45)", fontSize:12 }}>
          {role === "ajudan_walikota" ? "Wali Kota" : "Wakil Wali Kota"} · Hari ini &amp; Besok
        </div>
      </div>

      <div style={{ padding: isMobile ? "14px" : "20px 28px" }}>
        {loading
          ? <SkeletonList/>
          : guests.length === 0
            ? (
              <div style={{ textAlign:"center", padding:"48px 24px" }}>
                <div style={{ fontSize:40, marginBottom:14 }}>📋</div>
                <div style={{ fontSize:16, fontWeight:700, color:NAVY, marginBottom:8 }}>Belum ada tamu terjadwal</div>
                <div style={{ fontSize:13, color:"#64748B" }}>
                  Tamu yang sudah disetujui Pimpinan akan muncul di sini.
                </div>
              </div>
            )
            : (
              <>
                {todayList.length > 0 && (
                  <div>
                    <div style={dayHeader}>🗓 Hari Ini — {fmtDateLong(today)}</div>
                    {todayList.map(function(g) {
                      return <AjudanCard key={g.id} guest={g}/>;
                    })}
                  </div>
                )}
                {tomorrowList.length > 0 && (
                  <div style={{ marginTop: todayList.length > 0 ? 20 : 0 }}>
                    <div style={dayHeader}>🗓 Besok — {fmtDateLong(tomorrow)}</div>
                    {tomorrowList.map(function(g) {
                      return <AjudanCard key={g.id} guest={g}/>;
                    })}
                  </div>
                )}
              </>
            )
        }
      </div>
    </div>
  );
}

// ── Kartu tamu untuk ajudan ──────────────────────────────────
function AjudanCard({ guest }) {
  var pc = PRIORITY_CONFIG[guest.priority] || PRIORITY_CONFIG.biasa;
  return (
    <div style={{
      background:"white", borderRadius:16, marginBottom:10, overflow:"hidden",
      boxShadow:"0 2px 10px rgba(10,22,40,0.07)",
      border:"1.5px solid " + pc.ring,
    }}>
      {/* Jam badge */}
      <div style={{
        background: "linear-gradient(135deg," + NAVY + "," + NAVY_MID + ")",
        padding:"8px 16px",
        display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <span style={{ color:GOLD, fontSize:15, fontWeight:900 }}>
          {guest.scheduled_time ? guest.scheduled_time + " WITA" : "Jam belum ditentukan"}
        </span>
        <span style={{ background:pc.bg, color:pc.color, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:700 }}>
          {pc.label}
        </span>
      </div>
      <div style={{ padding:"12px 16px" }}>
        <div style={{ fontSize:16, fontWeight:800, color:NAVY, marginBottom:3 }}>
          {guest.name}
        </div>
        {guest.organization && (
          <div style={{ fontSize:12, color:"#64748B", marginBottom:4 }}>🏢 {guest.organization}</div>
        )}
        <div style={{ fontSize:12, color:"#64748B", marginBottom:6 }}>
          📱 {guest.phone}
          {guest.tujuan_pejabat && (
            <span style={{ marginLeft:8 }}>→ {getPejabatLabel(guest.tujuan_pejabat)}</span>
          )}
        </div>
        <div style={{
          background:"#F8FAFC", borderRadius:9, padding:"8px 11px",
          fontSize:13, color:NAVY, lineHeight:1.5,
        }}>
          {guest.purpose}
        </div>
        {guest.needs_aksesibilitas && (
          <div style={{ marginTop:7, fontSize:12, color:"#1D4ED8", display:"flex", gap:5, alignItems:"center" }}>
            <span>♿</span>
            <span>Aksesibilitas dibutuhkan: {guest.aksesibilitas_detail || "Ya"}</span>
          </div>
        )}
        {guest.kabag_notes && (
          <div style={{ marginTop:7, background:"#EDE9FE", borderRadius:8, padding:"7px 10px", fontSize:12, color:"#4C1D95" }}>
            📌 Catatan Kabag: {guest.kabag_notes}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  MODAL: Panduan Klasifikasi Ringkas (legacy — tetap ada)
// ══════════════════════════════════════════════════════════
function PanduanModal({ onClose }) {
  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <div style={{ color:GOLD, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase" }}>SOP Protokol</div>
          <div style={{ fontSize:17, fontWeight:900, color:NAVY }}>Panduan Klasifikasi Tamu</div>
        </div>
        <button onClick={onClose} style={closeXStyle}>✕</button>
      </div>
      <div style={{ fontSize:12, color:"#64748B", marginBottom:12 }}>
        Lihat panduan lengkap melalui tombol <strong>📖 Buku Panduan SOP</strong> di header.
      </div>
      <button onClick={onClose} style={{
        width:"100%", padding:"11px", borderRadius:11, border:"none",
        background:"linear-gradient(135deg," + NAVY + "," + NAVY_MID + ")",
        color:"white", fontSize:13, fontWeight:800, cursor:"pointer",
      }}>Tutup</button>
    </ModalOverlay>
  );
}

// ══════════════════════════════════════════════════════════
//  MODAL: Buku Panduan SOP Lengkap
// ══════════════════════════════════════════════════════════
function BukuPanduanModal({ onClose }) {
  var [activeBagian, setActiveBagian] = useState(0);

  return (
    <div
      onClick={onClose}
      style={{
        position:"fixed", inset:0, zIndex:1100,
        background:"rgba(10,22,40,0.72)", backdropFilter:"blur(4px)",
        display:"flex", alignItems:"center", justifyContent:"center",
        padding:"16px",
      }}
    >
      <div
        onClick={function(e) { e.stopPropagation(); }}
        style={{
          width:"100%", maxWidth:620,
          background:"white", borderRadius:20,
          maxHeight:"92vh", display:"flex", flexDirection:"column",
          boxShadow:"0 24px 64px rgba(10,22,40,0.35)",
          overflow:"hidden",
        }}
      >
        {/* ── Header modal ── */}
        <div style={{
          background:"linear-gradient(135deg," + NAVY + ",#1A3060)",
          padding:"20px 22px 16px", flexShrink:0,
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ color:GOLD, fontSize:9, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>
                Prokopim Kota Tarakan
              </div>
              <div style={{ color:"white", fontSize:18, fontWeight:900, marginBottom:3 }}>
                📖 Buku Panduan SOP
              </div>
              <div style={{ color:"rgba(255,255,255,0.55)", fontSize:11 }}>
                Standar Operasional Prosedur Manajemen Tamu Pimpinan
              </div>
            </div>
            <button onClick={onClose} style={{
              width:32, height:32, borderRadius:8,
              border:"1.5px solid rgba(255,255,255,0.2)",
              background:"rgba(255,255,255,0.08)",
              color:"rgba(255,255,255,0.8)", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:14, fontWeight:700, flexShrink:0,
            }}>✕</button>
          </div>

          {/* Tab navigasi bagian */}
          <div style={{ display:"flex", gap:6, marginTop:14 }}>
            {SOP_BAGIAN.map(function(b, i) {
              var active = activeBagian === i;
              return (
                <button
                  key={i}
                  onClick={function() { setActiveBagian(i); }}
                  style={{
                    padding:"6px 14px", borderRadius:20, fontSize:11, fontWeight:700,
                    border:"1.5px solid " + (active ? GOLD : "rgba(255,255,255,0.2)"),
                    background: active ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.06)",
                    color: active ? GOLD : "rgba(255,255,255,0.6)",
                    cursor:"pointer",
                  }}
                >
                  {b.icon} {b.bagian}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Disclaimer ── */}
        <div style={{
          background:"#FFF8ED",
          borderBottom:"1px solid #FDE68A",
          padding:"10px 22px",
          flexShrink:0,
        }}>
          <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
            <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>⚠️</span>
            <div>
              <span style={{ fontSize:11, fontWeight:800, color:"#92400E", textTransform:"uppercase", letterSpacing:.5 }}>
                Disclaimer / Catatan Penting
              </span>
              <p style={{ margin:"4px 0 0", fontSize:11.5, color:"#78350F", lineHeight:1.65 }}>
                {SOP_DISCLAIMER}
              </p>
            </div>
          </div>
        </div>

        {/* ── Konten ── */}
        <div style={{ flex:1, overflowY:"auto", padding:"18px 22px 24px" }}>
          {(function() {
            var bagian = SOP_BAGIAN[activeBagian];
            return (
              <div>
                {/* Judul bagian */}
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
                  <div style={{
                    width:38, height:38, borderRadius:11,
                    background: bagian.warnaBg,
                    border:"1.5px solid " + bagian.warnaBorder,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:18, flexShrink:0,
                  }}>
                    {bagian.icon}
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1 }}>
                      {bagian.bagian}
                    </div>
                    <div style={{ fontSize:16, fontWeight:900, color:NAVY }}>
                      {bagian.judul}
                    </div>
                  </div>
                </div>

                {/* Kelompok-kelompok dalam bagian */}
                {bagian.kelompok.map(function(kelompok, ki) {
                  return (
                    <div key={ki} style={{ marginBottom:18 }}>
                      {/* Label kelompok */}
                      <div style={{
                        background: kelompok.warnaBg,
                        border:"1.5px solid " + kelompok.warnaBorder,
                        borderRadius:11, padding:"10px 14px",
                        marginBottom:10,
                        display:"flex", justifyContent:"space-between", alignItems:"center",
                      }}>
                        <div style={{ fontSize:13, fontWeight:800, color:kelompok.warna }}>
                          {kelompok.label}
                        </div>
                        <div style={{
                          fontSize:10, fontWeight:700,
                          color:kelompok.warna,
                          background:"rgba(255,255,255,0.6)",
                          padding:"2px 9px", borderRadius:20,
                          border:"1px solid " + kelompok.warnaBorder,
                          flexShrink:0, marginLeft:8,
                        }}>
                          {kelompok.sublabel}
                        </div>
                      </div>

                      {/* Daftar isi */}
                      <div style={{ paddingLeft:4 }}>
                        {kelompok.isi.map(function(item, ii) {
                          return (
                            <div key={ii} style={{
                              display:"flex", gap:9, alignItems:"flex-start",
                              padding:"6px 0",
                              borderBottom: ii < kelompok.isi.length - 1
                                ? "1px solid #F1F5F9" : "none",
                            }}>
                              <span style={{
                                width:6, height:6, borderRadius:"50%",
                                background:kelompok.warna,
                                flexShrink:0, marginTop:7,
                              }}/>
                              <div style={{ fontSize:13, color:"#334155", lineHeight:1.6 }}>
                                {item.bold && (
                                  <span style={{ fontWeight:700, color:NAVY }}>
                                    {item.bold}{" "}
                                  </span>
                                )}
                                {item.teks}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ── Footer ── */}
        <div style={{
          borderTop:"1px solid #E8EDF4", padding:"12px 22px",
          display:"flex", gap:10, flexShrink:0, background:"#FAFBFF",
        }}>
          {/* Navigasi prev/next */}
          <button
            onClick={function() { setActiveBagian(function(p) { return Math.max(0, p-1); }); }}
            disabled={activeBagian === 0}
            style={{
              padding:"9px 16px", borderRadius:10,
              border:"1.5px solid #E2E8F0",
              background: activeBagian === 0 ? "#F8FAFC" : "white",
              color: activeBagian === 0 ? "#CBD5E1" : NAVY,
              cursor: activeBagian === 0 ? "default" : "pointer",
              fontSize:12, fontWeight:700,
            }}
          >
            ← Sebelumnya
          </button>
          <button
            onClick={function() { setActiveBagian(function(p) { return Math.min(SOP_BAGIAN.length-1, p+1); }); }}
            disabled={activeBagian === SOP_BAGIAN.length - 1}
            style={{
              padding:"9px 16px", borderRadius:10,
              border:"1.5px solid #E2E8F0",
              background: activeBagian === SOP_BAGIAN.length-1 ? "#F8FAFC" : "white",
              color: activeBagian === SOP_BAGIAN.length-1 ? "#CBD5E1" : NAVY,
              cursor: activeBagian === SOP_BAGIAN.length-1 ? "default" : "pointer",
              fontSize:12, fontWeight:700,
            }}
          >
            Berikutnya →
          </button>
          <div style={{ flex:1 }}/>
          <button
            onClick={onClose}
            style={{
              padding:"9px 22px", borderRadius:10, border:"none",
              background:"linear-gradient(135deg," + NAVY + "," + NAVY_MID + ")",
              color:"white", fontSize:13, fontWeight:800, cursor:"pointer",
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  MODAL: Input Tamu Manual (Bypass)
// ══════════════════════════════════════════════════════════
function InputManualModal({ user, onClose, onSuccess }) {
  var [form, setForm]     = useState({
    name:"", organization:"", phone:"",
    tujuan_pejabat:"walikota", purpose:"",
    priority:"penting", staff_notes:"",
  });
  var [loading, setLoading] = useState(false);
  var [err,     setErr]     = useState("");

  function setF(k, v) {
    setForm(function(p) { return Object.assign({}, p, { [k]: v }); });
  }

  async function submit() {
    if (!form.name.trim())    { setErr("Nama wajib diisi"); return; }
    if (!form.phone.trim())   { setErr("Nomor WA wajib diisi"); return; }
    if (!form.purpose.trim()) { setErr("Keperluan wajib diisi"); return; }
    setErr(""); setLoading(true);
    try {
      var r = await fetch(API + "?action=manual_input", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(Object.assign({}, form, {
          input_by: user?.username,
          bypass: true,
        })),
      });
      var data = await r.json();
      if (!r.ok) throw new Error(data.error || "Gagal");
      onSuccess();
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <div style={{ color:"#DC2626", fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase" }}>BYPASS INPUT</div>
          <div style={{ fontSize:16, fontWeight:900, color:NAVY }}>Input Tamu VVIP Manual</div>
        </div>
        <button onClick={onClose} style={closeXStyle}>✕</button>
      </div>
      <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:9, padding:"9px 12px", marginBottom:14, fontSize:12, color:"#991B1B" }}>
        ⚠️ Fitur ini untuk tamu VVIP dadakan yang tidak sempat mendaftar via QR Code.
        Data akan langsung masuk dengan status siap verifikasi Kabag.
      </div>
      {err && (
        <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"8px 11px", marginBottom:12, fontSize:13, color:"#991B1B" }}>
          ⚠️ {err}
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:12, overflowY:"auto", maxHeight:"55vh" }}>
        {[
          { k:"name",         l:"Nama Lengkap",   req:true,  ph:"Nama tamu VVIP" },
          { k:"organization", l:"Instansi",        req:false, ph:"Nama instansi / jabatan" },
          { k:"phone",        l:"Nomor WhatsApp",  req:true,  ph:"08xxxxxxxxxx" },
        ].map(function(f) {
          return (
            <div key={f.k}>
              <label style={sectionSubLabel}>{f.l}{f.req && <span style={{ color:"#DC2626" }}> *</span>}</label>
              <input
                value={form[f.k]}
                onChange={function(e) { setF(f.k, e.target.value); }}
                placeholder={f.ph}
                style={inputStyle}
              />
            </div>
          );
        })}
        <div>
          <label style={sectionSubLabel}>Pejabat yang Ditemui *</label>
          <select value={form.tujuan_pejabat} onChange={function(e) { setF("tujuan_pejabat", e.target.value); }} style={inputStyle}>
            <option value="walikota">Wali Kota</option>
            <option value="wakilwalikota">Wakil Wali Kota</option>
          </select>
        </div>
        <div>
          <label style={sectionSubLabel}>Keperluan *</label>
          <textarea
            value={form.purpose}
            onChange={function(e) { setF("purpose", e.target.value); }}
            rows={3}
            placeholder="Jelaskan keperluan tamu..."
            style={textareaStyle}
          />
        </div>
        <div>
          <label style={sectionSubLabel}>Prioritas Awal</label>
          <select value={form.priority} onChange={function(e) { setF("priority", e.target.value); }} style={inputStyle}>
            <option value="mendesak">🔴 Mendesak</option>
            <option value="penting">🟡 Penting</option>
            <option value="biasa">🟢 Biasa</option>
          </select>
        </div>
        <div>
          <label style={sectionSubLabel}>Catatan Staf</label>
          <textarea
            value={form.staff_notes}
            onChange={function(e) { setF("staff_notes", e.target.value); }}
            rows={2}
            placeholder="Rekomendasi disposisi atau catatan tambahan..."
            style={textareaStyle}
          />
        </div>
      </div>
      <div style={{ display:"flex", gap:10, marginTop:14 }}>
        <button
          onClick={submit}
          disabled={loading}
          style={{
            flex:3, padding:"12px", borderRadius:11, border:"none",
            background: loading ? "#94A3B8" : ("linear-gradient(135deg," + NAVY + "," + NAVY_MID + ")"),
            color:"white", fontSize:13, fontWeight:800, cursor: loading ? "not-allowed" : "pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:7,
          }}
        >
          {loading ? <Spinner/> : null}
          Simpan & Naikkan ke Kabag
        </button>
        <button onClick={onClose} style={Object.assign({}, cancelBtnStyle, { flex:1 })}>Batal</button>
      </div>
    </ModalOverlay>
  );
}

// ══════════════════════════════════════════════════════════
//  SHARED COMPONENTS
// ══════════════════════════════════════════════════════════
function GuestCardItem({ guest, onClick, showPriority, showStaffNote }) {
  var pc = PRIORITY_CONFIG[guest.priority] || PRIORITY_CONFIG.biasa;
  var sc = STATUS_LABEL[guest.status]       || STATUS_LABEL.waiting;

  return (
    <div
      onClick={onClick}
      style={{
        background:"white", borderRadius:14, marginBottom:9, overflow:"hidden",
        border:"1.5px solid " + (guest.status === "waiting" ? "#FDE68A" : "#E8EDF4"),
        boxShadow:"0 1px 6px rgba(10,22,40,0.05)", cursor:"pointer",
      }}
    >
      <div style={{ padding:"12px 14px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:5 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:800, color:NAVY, marginBottom:2 }}>{guest.name}</div>
            {guest.organization && (
              <div style={{ fontSize:11, color:"#64748B" }}>🏢 {guest.organization}</div>
            )}
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
            <span style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:700 }}>
              {sc.text}
            </span>
            {showPriority && guest.priority && (
              <span style={{ background:pc.bg, color:pc.color, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:700 }}>
                {pc.label}
              </span>
            )}
          </div>
        </div>
        <div style={{
          fontSize:12, color:"#334155", lineHeight:1.5, marginBottom:5,
          display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden",
        }}>
          📋 {guest.purpose}
        </div>
        <div style={{ display:"flex", gap:12, fontSize:11, color:"#94A3B8", flexWrap:"wrap" }}>
          <span>📱 {guest.phone}</span>
          <span>→ {getPejabatLabel(guest.tujuan_pejabat)}</span>
          <span>🕐 {fmtTs(guest.created_at)}</span>
        </div>
        {showStaffNote && guest.staff_notes && (
          <div style={{ marginTop:7, background:"#FFFBEB", borderRadius:7, padding:"6px 9px", fontSize:11, color:"#92400E" }}>
            📌 {guest.staff_notes}
          </div>
        )}
      </div>
      <div style={{ background:"#F8FAFC", padding:"5px 14px", borderTop:"1px solid #F1F5F9", display:"flex", justifyContent:"flex-end" }}>
        <span style={{ fontSize:11, color:NAVY, fontWeight:700 }}>Lihat Detail →</span>
      </div>
    </div>
  );
}

function ModalOverlay({ onClose, children }) {
  // Tutup modal saat klik overlay
  return (
    <div
      onClick={onClose}
      style={{
        position:"fixed", inset:0, zIndex:1000,
        background:"rgba(10,22,40,0.65)", backdropFilter:"blur(3px)",
        display:"flex", alignItems:"flex-end",
        padding: 0,
      }}
    >
      <div
        onClick={function(e) { e.stopPropagation(); }}
        style={{
          width:"100%", maxWidth:520, margin:"0 auto",
          background:"white", borderRadius:"20px 20px 0 0",
          padding:"20px 18px 28px",
          maxHeight:"92vh", overflowY:"auto",
          boxShadow:"0 -12px 40px rgba(10,22,40,0.2)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SectionCard({ title, accent, children }) {
  return (
    <div style={{
      background:"white", borderRadius:14, marginBottom:14, overflow:"hidden",
      border:"1px solid " + (accent ? accent : "#E8EDF4"),
      boxShadow:"0 1px 6px rgba(10,22,40,0.04)",
    }}>
      <div style={{ padding:"10px 14px", borderBottom:"1px solid " + (accent ? accent + "60" : "#F1F5F9"),
        background: accent ? (accent + "12") : "#FAFBFF",
        fontSize:12, fontWeight:800, color:NAVY,
      }}>
        {title}
      </div>
      <div style={{ padding:"12px 14px" }}>
        {children}
      </div>
    </div>
  );
}

function InfoGrid({ rows }) {
  return (
    <dl style={{ margin:0 }}>
      {rows.map(function(row) {
        return (
          <div key={row.l} style={{ display:"grid", gridTemplateColumns:"110px 1fr", gap:8, padding:"5px 0", borderBottom:"1px solid #F1F5F9" }}>
            <dt style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:.4, paddingTop:2 }}>
              {row.l}
            </dt>
            <dd style={{ fontSize:13, color:NAVY, fontWeight:500, margin:0, lineHeight:1.5 }}>
              {row.v}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{
      background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.1)",
      borderRadius:20, padding:"5px 12px",
      display:"flex", alignItems:"center", gap:6,
    }}>
      <span style={{ fontSize:15, fontWeight:900, color: color }}>{value}</span>
      <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>{label}</span>
    </div>
  );
}

function SkeletonList() {
  return (
    <div>
      {[0,1,2,3].map(function(i) {
        return (
          <div key={i} style={{
            background:"white", borderRadius:14, marginBottom:9, padding:14,
            border:"1px solid #E8EDF4", opacity: 1 - i * 0.18,
          }}>
            <div style={{ height:14, borderRadius:6, background:"#F1F5F9", width:"60%", marginBottom:8 }}/>
            <div style={{ height:11, borderRadius:5, background:"#F8FAFC", width:"40%" }}/>
          </div>
        );
      })}
    </div>
  );
}

function EmptyGuest({ label }) {
  return (
    <div style={{ textAlign:"center", padding:"48px 24px" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
      <div style={{ fontSize:15, fontWeight:700, color:NAVY, marginBottom:6 }}>Tidak ada data</div>
      <div style={{ fontSize:13, color:"#64748B" }}>{label}</div>
    </div>
  );
}

function Spinner({ color }) {
  return (
    <span style={{
      width:14, height:14, borderRadius:"50%",
      border:"2.5px solid rgba(255,255,255,0.25)",
      borderTopColor: color || "white",
      animation:"gd_spin .7s linear infinite",
      display:"inline-block", flexShrink:0,
    }}/>
  );
}

// ── Style helpers ────────────────────────────────────────────
var backBtnStyle = {
  background:"rgba(255,255,255,0.1)", border:"none", borderRadius:10,
  padding:"8px 13px", color:"white", cursor:"pointer",
  fontSize:12, fontWeight:700, flexShrink:0,
};
var closeXStyle = {
  width:32, height:32, borderRadius:8, border:"1.5px solid #E2E8F0",
  background:"white", cursor:"pointer", display:"flex",
  alignItems:"center", justifyContent:"center", fontSize:14, color:"#64748B",
};
var cancelBtnStyle = {
  padding:"10px 14px", borderRadius:10,
  border:"1.5px solid #E2E8F0", background:"white",
  color:"#64748B", fontSize:12, fontWeight:700, cursor:"pointer",
};
var inputStyle = {
  width:"100%", padding:"11px 13px", minHeight:44,
  borderRadius:11, border:"1.5px solid #D1D9E6",
  fontSize:14, color:NAVY, background:"white",
  outline:"none", fontFamily:"inherit",
  WebkitAppearance:"none",
};
var textareaStyle = {
  width:"100%", padding:"11px 13px",
  borderRadius:11, border:"1.5px solid #D1D9E6",
  fontSize:14, color:NAVY, background:"white",
  outline:"none", resize:"vertical", lineHeight:1.55,
  fontFamily:"inherit",
};
var sectionSubLabel = {
  display:"block", fontSize:11, fontWeight:700,
  color:"#4b6280", letterSpacing:.5, textTransform:"uppercase",
  marginBottom:6,
};
var dayHeader = {
  fontSize:12, fontWeight:800, color:NAVY,
  textTransform:"uppercase", letterSpacing:.8,
  marginBottom:10, paddingBottom:6,
  borderBottom:"2px solid " + GOLD,
};

function navBtnStyle(disabled) {
  return {
    padding:"7px 14px", borderRadius:10,
    border:"1.5px solid #E2E8F0",
    background: disabled ? "#F8FAFC" : "white",
    color: disabled ? "#CBD5E1" : NAVY,
    cursor: disabled ? "default" : "pointer",
    fontSize:12, fontWeight:700,
  };
}

// ══════════════════════════════════════════════════════════
//  VIEW 5: READ-ONLY — Kasubbag Komdokpim & Timkom
//  Hanya melihat daftar tamu disetujui untuk koordinasi dokumen
// ══════════════════════════════════════════════════════════
function ReadOnlyView({ role, isMobile }) {
  var [guests,  setGuests]  = useState([]);
  var [loading, setLoading] = useState(true);
  var [filterSt, setFilterSt] = useState("accepted");

  useEffect(function() {
    setLoading(true);
    fetch(API + "?action=queue&status=" + filterSt + "&limit=50")
      .then(function(r) { return r.json(); })
      .then(function(d) { setGuests(Array.isArray(d) ? d : []); })
      .catch(function() { setGuests([]); })
      .finally(function() { setLoading(false); });
  }, [filterSt]);

  var roleLabel = role === "timkom"
    ? "Staf Komunikasi & Dokumentasi"
    : "Kasubbag Komunikasi & Dokumentasi Pimpinan";

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>

      {/* Header */}
      <div style={{
        background:"linear-gradient(160deg," + NAVY + ",#1A2F5E)",
        padding: isMobile ? "20px 16px" : "24px 28px",
      }}>
        <div style={{ color:GOLD, fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>
          Manajemen Tamu — Hanya Lihat
        </div>
        <div style={{ color:"white", fontSize:isMobile?18:21, fontWeight:900, marginBottom:4 }}>
          Daftar Tamu Audiensi
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{
            background:"rgba(201,168,76,0.18)", border:"1px solid rgba(201,168,76,0.35)",
            borderRadius:20, padding:"3px 11px", color:GOLD, fontSize:10, fontWeight:700,
          }}>
            👁 Read-Only
          </span>
          <span style={{ color:"rgba(255,255,255,0.45)", fontSize:11 }}>
            {roleLabel}
          </span>
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        margin:"12px 16px 0", padding:"10px 14px",
        background:"#EFF6FF", border:"1px solid #BFDBFE",
        borderRadius:11, fontSize:12, color:"#1D4ED8", lineHeight:1.6,
      }}>
        ℹ️ Tampilan ini hanya untuk <strong>koordinasi dokumentasi</strong>.
        Tamu yang disetujui pimpinan akan tampil di sini agar tim Komdokpim
        bisa mempersiapkan kebutuhan dokumentasi audiensi.
      </div>

      {/* Filter */}
      <div style={{ padding:"12px 16px 0", display:"flex", gap:6, flexWrap:"wrap" }}>
        {[
          { k:"accepted",  l:"Disetujui Pimpinan" },
          { k:"forwarded", l:"Di Proses Pimpinan" },
          { k:"all",       l:"Semua" },
        ].map(function(f) {
          var active = filterSt === f.k;
          return (
            <button
              key={f.k}
              onClick={function() { setFilterSt(f.k); }}
              style={{
                padding:"5px 13px", borderRadius:20, fontSize:11, fontWeight:700,
                border:"1.5px solid " + (active ? NAVY : "#D1D9E6"),
                background: active ? NAVY : "white",
                color: active ? "white" : "#64748B",
                cursor:"pointer",
              }}
            >
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
            ? (
              <div style={{ textAlign:"center", padding:"48px 20px" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                <div style={{ fontSize:15, fontWeight:700, color:NAVY, marginBottom:6 }}>
                  Belum ada data
                </div>
                <div style={{ fontSize:12, color:"#64748B" }}>
                  Tamu yang disetujui pimpinan akan tampil di sini.
                </div>
              </div>
            )
            : guests.map(function(g) {
                return <ReadOnlyCard key={g.id} guest={g}/>;
              })
        }
      </div>
    </div>
  );
}

// ── Kartu read-only (tidak bisa diklik untuk aksi) ─────────
function ReadOnlyCard({ guest }) {
  var pc = PRIORITY_CONFIG[guest.priority] || PRIORITY_CONFIG.biasa;
  var sc = STATUS_LABEL[guest.status]       || STATUS_LABEL.waiting;

  return (
    <div style={{
      background:"white", borderRadius:14, marginBottom:9, overflow:"hidden",
      border:"1.5px solid #E8EDF4",
      boxShadow:"0 1px 6px rgba(10,22,40,0.05)",
    }}>
      <div style={{ padding:"12px 14px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:6 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:800, color:NAVY, marginBottom:2 }}>
              {guest.name}
            </div>
            {guest.organization && (
              <div style={{ fontSize:11, color:"#64748B" }}>🏢 {guest.organization}</div>
            )}
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
            <span style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:700 }}>
              {sc.text}
            </span>
            {guest.priority && (
              <span style={{ background:pc.bg, color:pc.color, borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:700 }}>
                {pc.label}
              </span>
            )}
          </div>
        </div>
        <div style={{
          fontSize:12, color:"#334155", lineHeight:1.5, marginBottom:6,
          display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden",
        }}>
          📋 {guest.purpose}
        </div>
        <div style={{ display:"flex", gap:12, fontSize:11, color:"#94A3B8", flexWrap:"wrap" }}>
          <span>→ {getPejabatLabel(guest.tujuan_pejabat)}</span>
          {guest.scheduled_date && (
            <span style={{ color:"#2563EB", fontWeight:600 }}>
              📅 {guest.scheduled_date}{guest.scheduled_time ? " · " + guest.scheduled_time + " WITA" : ""}
            </span>
          )}
          {guest.needs_aksesibilitas && (
            <span style={{ color:"#1D4ED8" }}>♿ Aksesibilitas</span>
          )}
        </div>
      </div>
      {/* Strip bawah — tidak ada tombol aksi */}
      <div style={{
        background:"#F8FAFC", padding:"5px 14px",
        borderTop:"1px solid #F1F5F9",
        display:"flex", justifyContent:"flex-end",
      }}>
        <span style={{ fontSize:10, color:"#CBD5E1", fontStyle:"italic" }}>
          Hanya lihat — tidak ada aksi
        </span>
      </div>
    </div>
  );
}


var _styleInjected = false;
function injectStyle() {
  if (_styleInjected || typeof document === "undefined") return;
  _styleInjected = true;
  var s = document.createElement("style");
  s.textContent = "@keyframes gd_spin{to{transform:rotate(360deg)}}";
  document.head.appendChild(s);
}
injectStyle();
