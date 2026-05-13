/**
 * PinjamRuanganPage.jsx — Halaman Publik Peminjaman Ruangan
 * Dapat diakses tanpa login di /pinjamruangan
 */
import React, { useState, useEffect, useCallback, useRef } from "react";

// ── Design tokens ─────────────────────────────────────────────
const NAVY   = "#0A1628";
const NAVY2  = "#1E3A5F";
const GOLD   = "#C9A84C";
const GREEN  = "#059669";
const GREEN_BG = "#ECFDF5";
const GREEN_BORDER = "#6EE7B7";
const YELLOW = "#D97706";
const YELLOW_BG = "#FFFBEB";
const YELLOW_BORDER = "#FCD34D";
const RED    = "#DC2626";
const RED_BG = "#FEF2F2";
const RED_BORDER = "#FECACA";
const GRAY   = "#6B7280";
const GRAY_LIGHT = "#F9FAFB";
const BORDER = "#E5E7EB";

const SLOT_STATUS = {
  available: { bg:"#D1FAE5", color:"#065F46", label:"Kosong" },
  pending:   { bg:"#FEF3C7", color:"#92400E", label:"Proses" },
  approved:  { bg:"#FEE2E2", color:"#991B1B", label:"Terisi" },
};

const SESSION_INFO = {
  Pagi:     { label:"Pagi",     sub:"07.30–12.00", color:"#2563EB", light:"#EFF6FF" },
  Siang:    { label:"Siang",    sub:"12.30–16.30", color:"#7C3AED", light:"#F5F3FF" },
  Full_Day: { label:"Full Day", sub:"Seharian",    color:"#D97706", light:"#FFFBEB" },
};

const DAYS_SHORT   = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
const MONTH_NAMES  = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

// ── Helpers ──────────────────────────────────────────────────
const toYMD = d => (d instanceof Date ? d : new Date(d)).toISOString().slice(0,10);

function addDays(dateStr, n) {
  const d = new Date(dateStr); d.setDate(d.getDate()+n); return toYMD(d);
}

function slotStatus(bookings, roomId, dateStr, session) {
  const conflict = session === "Full_Day" ? ["Pagi","Siang","Full_Day"]
                 : session === "Pagi"     ? ["Pagi","Full_Day"]
                 :                          ["Siang","Full_Day"];
  const relevant = bookings.filter(b =>
    b.room_id === roomId &&
    b.start_date <= dateStr && b.end_date >= dateStr &&
    conflict.includes(b.session)
  );
  if (relevant.some(b => b.status==="Approved")) return "approved";
  if (relevant.some(b => b.status==="Pending"))  return "pending";
  return "available";
}

function fmtTgl(s, short=false) {
  if (!s) return "-";
  const d = new Date(s+"T00:00:00");
  return short
    ? d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})
    : d.toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
}

function daysSince(s) {
  return s ? Math.floor((Date.now()-new Date(s).getTime())/86400000) : 0;
}

// ── Slot indicator cell (dalam kalender) ──────────────────────
function SlotBar({ status }) {
  const s = SLOT_STATUS[status] || SLOT_STATUS.available;
  return (
    <div style={{
      borderRadius:4, padding:"2px 0",
      background:s.bg, color:s.color,
      fontSize:9, fontWeight:700, textAlign:"center",
      letterSpacing:0.2,
    }}>{s.label}</div>
  );
}

// ── Kalender bulanan ──────────────────────────────────────────
function RoomCalendar({ bookings, rooms, year, month, highlightRange }) {
  const firstOfMonth = new Date(year, month-1, 1);
  const daysInMonth  = new Date(year, month, 0).getDate();
  const startDow     = firstOfMonth.getDay();
  const today        = toYMD(new Date());

  const cells = [];
  for (let i=0; i<startDow; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++)
    cells.push(`${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`);

  // Highlight membantu: cek apakah tanggal & ruangan masuk pilihan user
  const inHighlight = (dateStr, roomId, session) => {
    if (!highlightRange?.start || !highlightRange?.end) return false;
    if (dateStr < highlightRange.start || dateStr > highlightRange.end) return false;
    if (highlightRange.room_id && highlightRange.room_id !== roomId) return false;
    if (!highlightRange.session) return true;
    if (highlightRange.session === "Full_Day") return true;
    return highlightRange.session === session;
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:28}}>
      {rooms.map(room => (
        <div key={room.id}>
          {/* Room header */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{
              background:NAVY, color:"white", borderRadius:10,
              padding:"6px 16px", fontSize:14, fontWeight:800, letterSpacing:0.3,
            }}>{room.name}</div>
            <div style={{
              background:"#F3F4F6", color:GRAY, borderRadius:20,
              padding:"4px 12px", fontSize:12, fontWeight:600,
            }}>Kapasitas {room.capacity} orang</div>
          </div>

          {/* Hari header */}
          <div style={{overflowX:"auto"}}>
            <div style={{minWidth:560}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:3}}>
                {DAYS_SHORT.map(d => (
                  <div key={d} style={{textAlign:"center",fontSize:11,fontWeight:700,color:GRAY,padding:"4px 0"}}>
                    {d}
                  </div>
                ))}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
                {cells.map((dateStr,i) => {
                  if (!dateStr) return <div key={i}/>;
                  const pagi  = slotStatus(bookings,room.id,dateStr,"Pagi");
                  const siang = slotStatus(bookings,room.id,dateStr,"Siang");
                  const isToday = dateStr===today;
                  const isPast  = dateStr<today;
                  const isHighlighted = highlightRange && inHighlight(dateStr,room.id,null);
                  const pagiHL  = highlightRange && inHighlight(dateStr,room.id,"Pagi");
                  const siangHL = highlightRange && inHighlight(dateStr,room.id,"Siang");
                  return (
                    <div key={dateStr} style={{
                      border:isHighlighted
                        ? `2px solid ${"#2563EB"}`
                        : `2px solid ${isToday ? GOLD : BORDER}`,
                      borderRadius:8,
                      padding:"5px 4px 4px",
                      background:isHighlighted?"#EFF6FF":(isPast?"#FAFAFA":"white"),
                      opacity:isPast?0.55:1,
                      boxShadow:isHighlighted
                        ? "0 0 0 2px rgba(37,99,235,0.25)"
                        : (isToday?"0 0 0 2px rgba(201,168,76,0.25)":undefined),
                    }}>
                      <div style={{
                        textAlign:"center",
                        fontSize:12,
                        fontWeight:(isToday||isHighlighted)?900:500,
                        color:isHighlighted?"#1D4ED8":(isToday?NAVY:"#374151"),
                        marginBottom:4,
                      }}>
                        {parseInt(dateStr.slice(8))}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:2}}>
                        <div style={pagiHL?{outline:"1.5px solid #2563EB",borderRadius:5}:undefined}>
                          <SlotBar status={pagi}/>
                        </div>
                        <div style={siangHL?{outline:"1.5px solid #2563EB",borderRadius:5}:undefined}>
                          <SlotBar status={siang}/>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Legenda ───────────────────────────────────────────────────
function Legend() {
  return (
    <div style={{
      display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",
      background:GRAY_LIGHT, borderRadius:10, padding:"10px 14px",
      marginTop:20,
    }}>
      <span style={{fontSize:12,fontWeight:700,color:GRAY}}>Keterangan:</span>
      {Object.entries(SLOT_STATUS).map(([k,v])=>(
        <div key={k} style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{
            width:28,height:16,borderRadius:4,
            background:v.bg,border:`1px solid ${v.color}22`,
          }}/>
          <span style={{fontSize:12,color:"#374151"}}>{v.label}</span>
        </div>
      ))}
      <span style={{fontSize:12,color:GRAY}}>|</span>
      <span style={{fontSize:12,color:GRAY}}>Baris 1 = Pagi (07.30–12.00), Baris 2 = Siang (12.30–16.30)</span>
    </div>
  );
}

// ── Status tracker ────────────────────────────────────────────
function StatusTracker() {
  const [mode,setMode]     = useState("code");
  const [query,setQuery]   = useState("");
  const [results,setRes]   = useState(null);
  const [loading,setLoad]  = useState(false);
  const [err,setErr]       = useState("");
  const [cancelling,setCan]= useState(false);
  const inputRef = useRef();

  // Baca ?cek= dari URL
  useEffect(()=>{
    const p = new URLSearchParams(window.location.search).get("cek");
    if(p){ setMode("code"); setQuery(p); }
  },[]);

  const search = async () => {
    if(!query.trim()){inputRef.current?.focus();return;}
    setLoad(true);setErr("");setRes(null);
    try{
      const param = mode==="code"
        ? `code=${encodeURIComponent(query.trim().toUpperCase())}`
        : `pic_wa=${encodeURIComponent(query.trim())}`;
      const r = await fetch(`/api/room-booking?${param}`);
      if(!r.ok) throw new Error(await r.text());
      setRes(await r.json());
    }catch(e){setErr("Gagal terhubung ke server. Coba lagi.")}
    setLoad(false);
  };

  const doCancel = async (id,code) => {
    if(!window.confirm("Yakin ingin membatalkan peminjaman ini?")) return;
    setCan(true);
    try{
      const r = await fetch(`/api/room-booking?id=${id}&code=${code}`,{method:"DELETE"});
      const d = await r.json();
      if(!r.ok) throw new Error(d.error);
      alert("Peminjaman berhasil dibatalkan.");
      search();
    }catch(e){ alert("Gagal: "+e.message); }
    setCan(false);
  };

  const statusCfg = {
    Pending:   {label:"Menunggu Konfirmasi",color:YELLOW,bg:YELLOW_BG,border:YELLOW_BORDER},
    Approved:  {label:"Disetujui",          color:GREEN, bg:GREEN_BG, border:GREEN_BORDER },
    Rejected:  {label:"Ditolak",            color:RED,   bg:RED_BG,   border:RED_BORDER   },
    Cancelled: {label:"Dibatalkan",         color:GRAY,  bg:"#F3F4F6",border:BORDER        },
  };

  return (
    <div>
      {/* Mode toggle */}
      <div style={{display:"flex",gap:4,marginBottom:14,background:"#F3F4F6",borderRadius:10,padding:4}}>
        {[{k:"code",l:"Kode Booking"},{k:"wa",l:"Nomor WhatsApp"}].map(({k,l})=>(
          <button key={k} onClick={()=>{setMode(k);setRes(null);setQuery("");}}
            style={{
              flex:1,padding:"8px",borderRadius:7,border:"none",cursor:"pointer",
              fontSize:13,fontWeight:600,
              background:mode===k?"white":"transparent",
              color:mode===k?NAVY:GRAY,
              boxShadow:mode===k?"0 1px 4px rgba(0,0,0,0.12)":undefined,
              transition:"all 0.15s",
            }}>{l}</button>
        ))}
      </div>

      {/* Input */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&search()}
          placeholder={mode==="code"?"Contoh: AB12CD34":"Contoh: 08123456789"}
          style={{
            flex:1,padding:"11px 14px",borderRadius:10,
            border:`1.5px solid ${BORDER}`,fontSize:14,outline:"none",
            transition:"border 0.15s",fontFamily:"inherit",
          }}
          onFocus={e=>e.target.style.border=`1.5px solid ${NAVY}`}
          onBlur={e=>e.target.style.border=`1.5px solid ${BORDER}`}
        />
        <button onClick={search} disabled={loading}
          style={{
            padding:"11px 22px",borderRadius:10,border:"none",
            background:loading?"#9CA3AF":NAVY,
            color:"white",fontWeight:700,fontSize:14,cursor:loading?"not-allowed":"pointer",
            whiteSpace:"nowrap",transition:"background 0.15s",
          }}>
          {loading?"...":"Cek Status"}
        </button>
      </div>

      {err && (
        <div style={{padding:"10px 14px",background:RED_BG,color:RED,borderRadius:8,fontSize:13,marginBottom:12}}>
          {err}
        </div>
      )}

      {/* Hasil */}
      {results !== null && (
        results.length===0
          ? <div style={{
              textAlign:"center",padding:"32px 16px",
              background:GRAY_LIGHT,borderRadius:12,color:GRAY,fontSize:14,
            }}>
              Tidak ditemukan peminjaman dengan {mode==="code"?"kode":"nomor WA"} tersebut.
            </div>
          : <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {results.map(b=>{
                const cfg = statusCfg[b.status]||statusCfg.Pending;
                const ses = SESSION_INFO[b.session]||{};
                const tgl = b.start_date===b.end_date
                  ? fmtTgl(b.start_date)
                  : `${fmtTgl(b.start_date,true)} – ${fmtTgl(b.end_date,true)}`;
                return (
                  <div key={b.id} style={{
                    border:`1.5px solid ${cfg.border}`,borderRadius:12,
                    background:cfg.bg,overflow:"hidden",
                  }}>
                    <div style={{padding:"12px 16px",borderBottom:`1px solid ${cfg.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <div>
                          <div style={{fontFamily:"monospace",fontWeight:900,color:NAVY,fontSize:16,letterSpacing:1}}>
                            {b.booking_code}
                          </div>
                          <div style={{fontWeight:700,color:"#111827",fontSize:14,marginTop:2}}>
                            {b.event_name}
                          </div>
                        </div>
                        <div style={{
                          padding:"5px 12px",borderRadius:20,
                          background:"white",color:cfg.color,
                          fontSize:12,fontWeight:800,
                          border:`1.5px solid ${cfg.border}`,whiteSpace:"nowrap",
                        }}>{cfg.label}</div>
                      </div>
                    </div>
                    <div style={{padding:"12px 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 16px",fontSize:13}}>
                      <div><span style={{color:GRAY}}>Ruangan: </span><b>{b.rooms?.name}</b></div>
                      <div><span style={{color:GRAY}}>Instansi: </span>{b.instansi}</div>
                      <div><span style={{color:GRAY}}>Tanggal: </span>{tgl}</div>
                      <div><span style={{color:GRAY}}>Sesi: </span>
                        <span style={{color:ses.color,fontWeight:600}}>{ses.label} ({ses.sub})</span>
                      </div>
                      <div><span style={{color:GRAY}}>PIC: </span>{b.pic_name}</div>
                      <div><span style={{color:GRAY}}>Peserta: </span>{b.participant_count} orang</div>
                    </div>
                    {b.notes && (
                      <div style={{
                        margin:"0 14px 12px",padding:"8px 12px",
                        background:"white",borderRadius:8,fontSize:13,color:b.status==="Rejected"?RED:GRAY,
                        border:`1px solid ${BORDER}`,
                      }}>
                        <b>Keterangan:</b> {b.notes}
                      </div>
                    )}
                    {(b.status==="Pending" || b.status==="Approved") && (
                      <div style={{padding:"0 14px 14px",display:"flex",gap:8,flexWrap:"wrap"}}>
                        {b.status==="Pending" && (
                          <button onClick={()=>doCancel(b.id,b.booking_code)} disabled={cancelling}
                            style={{
                              padding:"8px 18px",borderRadius:8,border:`1.5px solid ${RED}`,
                              background:"white",color:RED,fontWeight:700,fontSize:13,
                              cursor:cancelling?"not-allowed":"pointer",
                            }}>
                            Batalkan Peminjaman
                          </button>
                        )}
                        {b.status==="Approved" && (
                          <button onClick={()=>printBookingPublic(b)}
                            style={{
                              padding:"8px 18px",borderRadius:8,border:"none",
                              background:NAVY,color:"white",fontWeight:700,fontSize:13,cursor:"pointer",
                            }}>
                            🖨️ Cetak Surat Konfirmasi
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
      )}
    </div>
  );
}

// ── Print helper untuk peminjam publik ────────────────────────
function printBookingPublic(b) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) { alert("Mohon izinkan popup untuk mencetak."); return; }
  const esc = s => String(s||"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtFull = s => s ? new Date(s+"T00:00:00").toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}) : "-";
  const ST = { Pagi:"07.30 – 12.00 WITA", Siang:"12.30 – 16.30 WITA", Full_Day:"Seharian (07.30 – 16.30 WITA)" };
  const today = new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
  const tgl = b.start_date===b.end_date ? fmtFull(b.start_date) : `${fmtFull(b.start_date)} s/d ${fmtFull(b.end_date)}`;

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Konfirmasi ${esc(b.booking_code)}</title><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11pt;margin:28px;color:#111;line-height:1.5}
    .head{text-align:center;border-bottom:3px double #0A1628;padding-bottom:12px;margin-bottom:24px}
    .head h2{margin:2px 0 4px;font-size:14pt;color:#0A1628}.head p{margin:0;font-size:10pt;color:#444}
    .code{font-family:monospace;font-size:14pt;font-weight:900;color:#0A1628;background:#FEF3C7;border:2px solid #C9A84C;padding:6px 14px;border-radius:8px;letter-spacing:2px;display:inline-block}
    .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-weight:700;font-size:10pt;background:#D1FAE5;color:#065F46;border:1px solid #6EE7B7}
    h1{font-size:14pt;text-align:center;margin:14px 0 20px;text-decoration:underline}
    table{width:100%;border-collapse:collapse;margin:14px 0}
    td{padding:8px 10px;border-bottom:1px solid #E5E7EB;vertical-align:top;font-size:11pt}
    td.lbl{width:35%;color:#555;font-weight:600}
    .footer{margin-top:34px;text-align:right}.sp{height:72px}
    @media print{body{margin:16mm}}</style></head><body>
    <div class="head"><p>PEMERINTAH KOTA TARAKAN</p><h2>BAGIAN PROTOKOL &amp; KOMUNIKASI PIMPINAN</h2><p style="font-size:9pt">prokopim.tarakankota.go.id</p></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:14px"><div><div style="font-size:9pt;color:#666">Kode Booking</div><div class="code">${esc(b.booking_code)}</div></div><div style="text-align:right"><div style="font-size:9pt;color:#666;margin-bottom:4px">Status</div><span class="badge">DISETUJUI</span></div></div>
    <h1>SURAT KONFIRMASI PEMINJAMAN RUANGAN</h1>
    <p style="text-align:justify;margin-bottom:14px">
      Sehubungan dengan permohonan peminjaman ruangan yang telah diajukan kepada Bagian
      Protokol &amp; Komunikasi Pimpinan Setda Kota Tarakan, dengan ini disampaikan rincian
      permohonan sebagai berikut:
    </p>
    <table>
      <tr><td class="lbl">Nama Acara / Kegiatan</td><td><b>${esc(b.event_name)}</b></td></tr>
      <tr><td class="lbl">Instansi / Pemohon</td><td>${esc(b.instansi)}</td></tr>
      <tr><td class="lbl">Penanggung Jawab (PIC)</td><td>${esc(b.pic_name)}</td></tr>
      <tr><td class="lbl">Nomor Kontak WhatsApp</td><td>${esc(b.pic_wa)}</td></tr>
      <tr><td class="lbl">Ruangan yang Dipinjam</td><td><b>${esc(b.rooms?.name||"-")}</b> (kapasitas ${b.rooms?.capacity||"-"} orang)</td></tr>
      <tr><td class="lbl">Jumlah Peserta</td><td>${b.participant_count} orang</td></tr>
      <tr><td class="lbl">Tanggal Penggunaan</td><td>${tgl}</td></tr>
      <tr><td class="lbl">Sesi / Waktu Penggunaan</td><td>${esc(ST[b.session]||b.session)}</td></tr>
      ${b.srikandi_ref ? `<tr><td class="lbl">Nomor Surat (Srikandi)</td><td>${esc(b.srikandi_ref)}</td></tr>` : ""}
    </table>
    <p style="margin-top:14px;text-align:justify">
      Berdasarkan ketersediaan ruangan dan kelengkapan administrasi, dengan ini permohonan
      peminjaman ruangan tersebut di atas dinyatakan <b>DISETUJUI</b>. Kepada pemohon diharapkan
      untuk memperhatikan ketentuan berikut:
    </p>
    <ol style="margin:6px 0 14px 22px">
      <li>Hadir tepat waktu sesuai jadwal yang telah ditentukan.</li>
      <li>Menjaga kebersihan, ketertiban, dan kerapian ruangan selama kegiatan berlangsung.</li>
      <li>Mengembalikan ruangan dalam kondisi semula setelah kegiatan selesai.</li>
      <li>Segera menghubungi staf Bagian Prokopim apabila terdapat perubahan jadwal atau pembatalan.</li>
      <li>Bertanggung jawab atas seluruh fasilitas yang digunakan selama peminjaman berlangsung.</li>
    </ol>
    <p style="margin-top:14px;text-align:justify">
      Demikian konfirmasi ini disampaikan untuk dapat dipergunakan sebagaimana mestinya.
      Atas perhatian dan kerja samanya, diucapkan terima kasih.
    </p>
    <div class="footer"><div style="display:inline-block;text-align:center;min-width:240px"><p>Tarakan, ${today}</p><p>Pengelola Ruangan,</p><div class="sp"></div><p><b><u>${esc(b.reviewed_by||"_____________________")}</u></b></p><p style="font-size:9pt;color:#666">Bagian Prokopim Kota Tarakan</p></div></div>
    <script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script></body></html>`);
  w.document.close();
}

// ── Form peminjaman ───────────────────────────────────────────
function BookingForm({ rooms, bookings, onSuccess }) {
  const today = toYMD(new Date());
  const [form,setForm] = useState({
    room_id:"",instansi:"",pic_name:"",pic_wa:"",event_name:"",
    participant_count:"",start_date:today,end_date:today,session:"",srikandi_ref:"",
  });
  const [file,setFile]         = useState(null);
  const [submitting,setSub]    = useState(false);
  const [uploading,setUpl]     = useState(false);
  const [err,setErr]           = useState("");

  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const isMultiDay = form.end_date && form.start_date && form.end_date!==form.start_date;
  const selectedRoom = rooms.find(r=>r.id===Number(form.room_id));

  // Kalender bulan = ambil dari start_date
  const [calOffset, setCalOffset] = useState(0); // 0 = bulan dari start_date
  const baseDate = new Date(form.start_date+"T00:00:00");
  const calDate  = new Date(baseDate.getFullYear(), baseDate.getMonth()+calOffset, 1);
  const calYear  = calDate.getFullYear();
  const calMonth = calDate.getMonth()+1;

  // Filter rooms yang ditampilkan: jika user pilih ruangan, hanya itu
  const calRooms = selectedRoom ? [selectedRoom] : rooms;

  // Cek apakah slot yang dipilih user konflik
  const slotConflict = (() => {
    if (!form.room_id || !form.session || !form.start_date || !form.end_date) return null;
    const conflict = form.session === "Full_Day" ? ["Pagi","Siang","Full_Day"]
                   : form.session === "Pagi"     ? ["Pagi","Full_Day"]
                   :                                ["Siang","Full_Day"];
    const overlap = (bookings||[]).find(b =>
      b.room_id === Number(form.room_id) &&
      b.status !== "Cancelled" && b.status !== "Rejected" &&
      b.start_date <= form.end_date && b.end_date >= form.start_date &&
      conflict.includes(b.session)
    );
    return overlap || null;
  })();

  const handleSubmit = async e => {
    e.preventDefault();
    if(!form.session){setErr("Pilih sesi terlebih dahulu.");return;}
    if(isMultiDay&&!form.srikandi_ref&&!file){
      setErr("Peminjaman lebih dari 1 hari wajib melampirkan nomor Srikandi atau file surat.");return;
    }
    setErr("");setSub(true);
    try{
      let document_path=null;
      if(file){
        setUpl(true);
        const SUPA_URL=import.meta.env.VITE_SUPABASE_URL;
        const SUPA_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY;
        const path=`booking-docs/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
        const up = await fetch(`${SUPA_URL}/storage/v1/object/room-documents/${path}`,{
          method:"POST",
          headers:{"apikey":SUPA_KEY,"Authorization":`Bearer ${SUPA_KEY}`,"Content-Type":file.type||"application/pdf"},
          body:file,
        });
        if(!up.ok) throw new Error("Upload gagal: "+await up.text());
        document_path=`${SUPA_URL}/storage/v1/object/public/room-documents/${path}`;
        setUpl(false);
      }
      const r = await fetch("/api/room-booking",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...form,room_id:Number(form.room_id),participant_count:Number(form.participant_count),document_path}),
      });
      const d = await r.json();
      if(!r.ok) throw new Error(d.error||"Gagal mengirim");
      onSuccess(d.booking);
    }catch(e){setErr(e.message);}
    setSub(false);setUpl(false);
  };

  const inp = {
    width:"100%",padding:"11px 13px",borderRadius:10,
    border:`1.5px solid ${BORDER}`,fontSize:14,outline:"none",
    boxSizing:"border-box",fontFamily:"inherit",background:"white",
    transition:"border 0.15s",
  };
  const lbl = {fontSize:13,fontWeight:600,color:"#374151",marginBottom:5,display:"block"};
  const section = {
    background:"white",borderRadius:14,border:`1.5px solid ${BORDER}`,
    padding:"18px 18px",marginBottom:16,
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Info banner */}
      <div style={{
        background:"#EFF6FF",border:`1.5px solid #BFDBFE`,borderRadius:10,
        padding:"11px 14px",marginBottom:18,
        display:"flex",alignItems:"flex-start",gap:10,fontSize:13,color:"#1D4ED8",
      }}>
        <span style={{fontSize:16,flexShrink:0,marginTop:1}}>ℹ️</span>
        <span>Pengajuan akan diproses oleh staf Bagian Protokol & Komunikasi Pimpinan. Konfirmasi dikirim ke WhatsApp Anda.</span>
      </div>

      {/* Kalender ketersediaan (compact) */}
      <div style={{
        background:"white",borderRadius:14,padding:"16px 16px 14px",
        border:`1.5px solid ${BORDER}`,marginBottom:16,
        boxShadow:"0 1px 4px rgba(0,0,0,0.05)",
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:NAVY,letterSpacing:1,textTransform:"uppercase"}}>
              Cek Ketersediaan
            </div>
            <div style={{fontSize:11,color:GRAY,marginTop:1}}>
              {selectedRoom
                ? `Menampilkan jadwal ${selectedRoom.name}`
                : "Pilih ruangan untuk lihat detail per ruangan"}
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button type="button" onClick={()=>setCalOffset(o=>o-1)}
              style={{width:28,height:28,borderRadius:7,border:`1.5px solid ${BORDER}`,
                background:"white",cursor:"pointer",fontWeight:700,fontSize:13}}>‹</button>
            <div style={{fontSize:13,fontWeight:700,color:NAVY,minWidth:120,textAlign:"center"}}>
              {MONTH_NAMES[calMonth-1]} {calYear}
            </div>
            <button type="button" onClick={()=>setCalOffset(o=>o+1)}
              style={{width:28,height:28,borderRadius:7,border:`1.5px solid ${BORDER}`,
                background:"white",cursor:"pointer",fontWeight:700,fontSize:13}}>›</button>
          </div>
        </div>
        <RoomCalendar
          bookings={bookings||[]}
          rooms={calRooms}
          year={calYear}
          month={calMonth}
          highlightRange={form.start_date && form.end_date ? {start:form.start_date,end:form.end_date,room_id:Number(form.room_id)||null,session:form.session||null} : null}
        />
        <Legend/>
      </div>

      {/* Warning konflik */}
      {slotConflict && (
        <div style={{
          background:RED_BG,border:`1.5px solid ${RED_BORDER}`,
          borderRadius:10,padding:"12px 14px",marginBottom:16,
          display:"flex",alignItems:"flex-start",gap:10,
        }}>
          <span style={{fontSize:18,flexShrink:0}}>⚠️</span>
          <div style={{fontSize:13,color:RED}}>
            <b>Slot tidak tersedia.</b> Sudah ada {slotConflict.status === "Approved" ? "booking disetujui" : "pengajuan menunggu"}:
            {" "}<i>{slotConflict.event_name}</i> ({slotConflict.start_date}{slotConflict.end_date!==slotConflict.start_date?` s/d ${slotConflict.end_date}`:""}, sesi {slotConflict.session}).
            <br/>Silakan pilih tanggal/sesi lain.
          </div>
        </div>
      )}

      {/* Bagian 1: Identitas */}
      <div style={section}>
        <div style={{fontSize:12,fontWeight:700,color:NAVY,letterSpacing:1,textTransform:"uppercase",marginBottom:14}}>
          Identitas Pemohon
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
          <div>
            <label style={lbl}>Instansi / Organisasi <span style={{color:RED}}>*</span></label>
            <input required value={form.instansi} onChange={e=>f("instansi",e.target.value)}
              placeholder="Dinas / OPD / Organisasi / Komunitas"
              style={inp}
              onFocus={e=>e.target.style.border=`1.5px solid ${NAVY}`}
              onBlur={e=>e.target.style.border=`1.5px solid ${BORDER}`}
            />
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={lbl}>Nama PIC <span style={{color:RED}}>*</span></label>
              <input required value={form.pic_name} onChange={e=>f("pic_name",e.target.value)}
                placeholder="Nama penanggung jawab"
                style={inp}
                onFocus={e=>e.target.style.border=`1.5px solid ${NAVY}`}
                onBlur={e=>e.target.style.border=`1.5px solid ${BORDER}`}
              />
            </div>
            <div>
              <label style={lbl}>WhatsApp PIC <span style={{color:RED}}>*</span></label>
              <input required value={form.pic_wa} onChange={e=>f("pic_wa",e.target.value)}
                placeholder="08xxxxxxxxxx" type="tel"
                style={inp}
                onFocus={e=>e.target.style.border=`1.5px solid ${NAVY}`}
                onBlur={e=>e.target.style.border=`1.5px solid ${BORDER}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bagian 2: Detail Kegiatan */}
      <div style={section}>
        <div style={{fontSize:12,fontWeight:700,color:NAVY,letterSpacing:1,textTransform:"uppercase",marginBottom:14}}>
          Detail Kegiatan
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
          <div>
            <label style={lbl}>Nama Acara / Kegiatan <span style={{color:RED}}>*</span></label>
            <input required value={form.event_name} onChange={e=>f("event_name",e.target.value)}
              placeholder="Nama kegiatan yang akan diselenggarakan"
              style={inp}
              onFocus={e=>e.target.style.border=`1.5px solid ${NAVY}`}
              onBlur={e=>e.target.style.border=`1.5px solid ${BORDER}`}
            />
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={lbl}>Pilih Ruangan <span style={{color:RED}}>*</span></label>
              <select required value={form.room_id} onChange={e=>f("room_id",e.target.value)} style={{...inp,color:form.room_id?"#111827":GRAY}}>
                <option value="">-- Pilih Ruangan --</option>
                {rooms.map(r=>(
                  <option key={r.id} value={r.id}>{r.name} (maks. {r.capacity} orang)</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>
                Jumlah Peserta <span style={{color:RED}}>*</span>
                {selectedRoom&&<span style={{fontWeight:400,color:GRAY}}> (maks. {selectedRoom.capacity})</span>}
              </label>
              <input required type="number" min={1} max={selectedRoom?.capacity||999}
                value={form.participant_count} onChange={e=>f("participant_count",e.target.value)}
                placeholder="Estimasi peserta"
                style={inp}
                onFocus={e=>e.target.style.border=`1.5px solid ${NAVY}`}
                onBlur={e=>e.target.style.border=`1.5px solid ${BORDER}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bagian 3: Jadwal */}
      <div style={section}>
        <div style={{fontSize:12,fontWeight:700,color:NAVY,letterSpacing:1,textTransform:"uppercase",marginBottom:14}}>
          Jadwal Penggunaan
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div>
            <label style={lbl}>Tanggal Mulai <span style={{color:RED}}>*</span></label>
            <input required type="date" min={today} value={form.start_date}
              onChange={e=>{f("start_date",e.target.value);if(e.target.value>form.end_date)f("end_date",e.target.value);}}
              style={inp}
              onFocus={e=>e.target.style.border=`1.5px solid ${NAVY}`}
              onBlur={e=>e.target.style.border=`1.5px solid ${BORDER}`}
            />
          </div>
          <div>
            <label style={lbl}>Tanggal Selesai <span style={{color:RED}}>*</span></label>
            <input required type="date" min={form.start_date||today} value={form.end_date}
              onChange={e=>f("end_date",e.target.value)}
              style={inp}
              onFocus={e=>e.target.style.border=`1.5px solid ${NAVY}`}
              onBlur={e=>e.target.style.border=`1.5px solid ${BORDER}`}
            />
          </div>
        </div>

        {/* Sesi picker */}
        <label style={{...lbl,marginBottom:8}}>Sesi <span style={{color:RED}}>*</span></label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {Object.entries(SESSION_INFO).map(([key,info])=>{
            const active = form.session===key;
            return (
              <button key={key} type="button" onClick={()=>f("session",key)}
                style={{
                  padding:"12px 8px",borderRadius:10,cursor:"pointer",
                  border:`2px solid ${active?info.color:BORDER}`,
                  background:active?info.color:info.light,
                  color:active?"white":info.color,
                  fontWeight:700,fontSize:13,
                  transition:"all 0.15s",
                  display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                }}>
                <span>{info.label}</span>
                <span style={{fontSize:11,fontWeight:400,opacity:0.8}}>{info.sub}</span>
              </button>
            );
          })}
        </div>
        {!form.session&&<p style={{fontSize:12,color:RED,margin:"6px 0 0"}}>Pilih sesi wajib</p>}
      </div>

      {/* Bagian 4: Surat (hanya multi-hari) */}
      {isMultiDay && (
        <div style={{...section,border:`1.5px solid ${YELLOW_BORDER}`,background:YELLOW_BG}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:14}}>
            <span style={{fontSize:18,flexShrink:0}}>📋</span>
            <div>
              <div style={{fontWeight:700,color:"#92400E",fontSize:13}}>Peminjaman Lebih dari 1 Hari</div>
              <div style={{color:"#B45309",fontSize:13,marginTop:2}}>
                Wajib melampirkan salah satu: nomor surat Srikandi atau upload surat permohonan (PDF).
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={{...lbl,color:"#92400E"}}>Nomor Surat Srikandi</label>
              <input value={form.srikandi_ref} onChange={e=>f("srikandi_ref",e.target.value)}
                placeholder="Contoh: 005/XXXX/2026"
                style={{...inp,border:`1.5px solid ${YELLOW_BORDER}`,background:"white"}}
                onFocus={e=>e.target.style.border=`1.5px solid ${YELLOW}`}
                onBlur={e=>e.target.style.border=`1.5px solid ${YELLOW_BORDER}`}
              />
            </div>
            <div>
              <label style={{...lbl,color:"#92400E"}}>Upload Surat (PDF)</label>
              <input type="file" accept=".pdf,application/pdf" onChange={e=>setFile(e.target.files?.[0]||null)}
                style={{...inp,padding:"8px 10px",border:`1.5px solid ${YELLOW_BORDER}`,cursor:"pointer"}}
              />
            </div>
          </div>
          {!form.srikandi_ref&&!file&&(
            <p style={{fontSize:12,color:RED,margin:"8px 0 0"}}>Wajib isi salah satu di atas.</p>
          )}
        </div>
      )}

      {err && (
        <div style={{
          padding:"12px 14px",background:RED_BG,color:RED,
          borderRadius:10,fontSize:13,marginBottom:14,
          border:`1.5px solid ${RED_BORDER}`,
          display:"flex",alignItems:"flex-start",gap:8,
        }}>
          <span style={{flexShrink:0}}>⚠️</span>{err}
        </div>
      )}

      <button type="submit"
        disabled={submitting||!form.session||(isMultiDay&&!form.srikandi_ref&&!file)}
        style={{
          width:"100%",padding:"14px",borderRadius:12,border:"none",
          background:submitting?"#9CA3AF":`linear-gradient(135deg,${NAVY} 0%,${NAVY2} 100%)`,
          color:"white",fontWeight:800,fontSize:15,cursor:submitting?"not-allowed":"pointer",
          boxShadow:submitting?"none":"0 4px 14px rgba(10,22,40,0.3)",
          transition:"all 0.2s",letterSpacing:0.3,
        }}>
        {uploading?"Mengupload surat..."
          :submitting?"Mengirim pengajuan..."
          :"Kirim Pengajuan Peminjaman →"}
      </button>
    </form>
  );
}

// ── Success view ──────────────────────────────────────────────
function SuccessView({ booking, onReset }) {
  return (
    <div style={{
      background:GREEN_BG,border:`2px solid ${GREEN_BORDER}`,
      borderRadius:16,padding:"32px 24px",textAlign:"center",
    }}>
      <div style={{
        width:64,height:64,borderRadius:"50%",background:"#D1FAE5",
        border:`3px solid ${GREEN}`,display:"flex",alignItems:"center",
        justifyContent:"center",margin:"0 auto 16px",fontSize:30,
      }}>✓</div>
      <div style={{fontSize:20,fontWeight:800,color:GREEN,marginBottom:6}}>
        Pengajuan Berhasil Dikirim!
      </div>
      <div style={{fontSize:14,color:"#065F46",marginBottom:20}}>
        Simpan kode berikut untuk memantau status pengajuan Anda:
      </div>
      <div style={{
        fontFamily:"monospace",fontSize:32,fontWeight:900,
        color:NAVY,letterSpacing:6,
        background:"white",padding:"14px 28px",
        borderRadius:12,display:"inline-block",
        border:`2px solid ${GREEN_BORDER}`,marginBottom:20,
        boxShadow:"0 2px 10px rgba(0,0,0,0.08)",
      }}>{booking.booking_code}</div>
      <div style={{fontSize:13,color:"#065F46",marginBottom:24,lineHeight:1.6}}>
        Konfirmasi dan notifikasi perubahan status akan dikirim ke WhatsApp Anda.<br/>
        Tim Prokopim akan memproses dalam waktu 1×24 jam.
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
        <button onClick={()=>onReset("calendar")}
          style={{
            padding:"11px 22px",borderRadius:10,border:"none",
            background:NAVY,color:"white",fontWeight:700,cursor:"pointer",
            fontSize:14,
          }}>
          Lihat Kalender
        </button>
        <button onClick={()=>onReset("tracker")}
          style={{
            padding:"11px 22px",borderRadius:10,
            border:`1.5px solid ${NAVY}`,background:"white",
            color:NAVY,fontWeight:700,cursor:"pointer",fontSize:14,
          }}>
          Cek Status Booking
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function PinjamRuanganPage() {
  const [rooms,setRooms]     = useState([]);
  const [bookings,setBook]   = useState([]);
  const [loading,setLoad]    = useState(true);
  const [section,setSection] = useState("calendar");
  const [success,setSuccess] = useState(null);

  const [calYear,setCalYear]   = useState(new Date().getFullYear());
  const [calMonth,setCalMonth] = useState(new Date().getMonth()+1);

  const monthStr = `${calYear}-${String(calMonth).padStart(2,"0")}`;

  // Handle ?cek= param → buka tracker
  useEffect(()=>{
    if(new URLSearchParams(window.location.search).get("cek")) setSection("tracker");
  },[]);

  const load = useCallback(async ()=>{
    setLoad(true);
    try{
      const [r,b] = await Promise.all([
        fetch("/api/room-booking?op=rooms").then(r=>r.json()),
        fetch(`/api/room-booking?month=${monthStr}`).then(r=>r.json()),
      ]);
      setRooms(Array.isArray(r)?r:[]);
      setBook(Array.isArray(b)?b:[]);
    }catch{}
    setLoad(false);
  },[monthStr]);

  useEffect(()=>{ load(); },[load]);

  const prevMonth = ()=>{ if(calMonth===1){setCalYear(y=>y-1);setCalMonth(12);}else setCalMonth(m=>m-1); };
  const nextMonth = ()=>{ if(calMonth===12){setCalYear(y=>y+1);setCalMonth(1);}else setCalMonth(m=>m+1); };

  const gotoSection = s => { setSection(s); setSuccess(null); window.scrollTo({top:0,behavior:"smooth"}); };

  const NAV_TABS = [
    { k:"calendar", icon:"📅", label:"Kalender" },
    { k:"form",     icon:"✏️",  label:"Ajukan" },
    { k:"tracker",  icon:"🔍", label:"Cek Status" },
  ];

  return (
    <div style={{minHeight:"100vh",background:"#F1F5F9",fontFamily:"Inter,system-ui,sans-serif"}}>
      {/* ── HEADER ── */}
      <div style={{
        background:`linear-gradient(135deg,${NAVY} 0%,${NAVY2} 100%)`,
        boxShadow:"0 4px 24px rgba(0,0,0,0.3)",
        position:"sticky",top:0,zIndex:100,
      }}>
        <div style={{maxWidth:860,margin:"0 auto",padding:"16px 16px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <img src="/logo_tarakan.png" alt="Logo"
              style={{height:44,width:"auto",objectFit:"contain",flexShrink:0,filter:"drop-shadow(0 2px 4px rgba(0,0,0,0.3))"}}
              onError={e=>e.target.style.display="none"}/>
            <div>
              <div style={{color:GOLD,fontSize:9,letterSpacing:2.5,fontWeight:800,textTransform:"uppercase"}}>
                Pemerintah Kota Tarakan
              </div>
              <div style={{color:"white",fontSize:18,fontWeight:900,lineHeight:1.2,letterSpacing:-0.3}}>
                Peminjaman Ruang Rapat
              </div>
              <div style={{color:"rgba(255,255,255,0.5)",fontSize:11.5,marginTop:1}}>
                Bagian Protokol & Komunikasi Pimpinan
              </div>
            </div>
          </div>

          {/* Tab navigasi */}
          <div style={{display:"flex",gap:2}}>
            {NAV_TABS.map(({k,icon,label})=>{
              const active=section===k;
              return (
                <button key={k} onClick={()=>gotoSection(k)}
                  style={{
                    display:"flex",alignItems:"center",gap:6,
                    padding:"10px 16px",border:"none",cursor:"pointer",
                    background:active?"rgba(255,255,255,0.15)":"transparent",
                    color:active?"white":"rgba(255,255,255,0.5)",
                    fontWeight:active?700:500,fontSize:13,
                    borderBottom:active?`3px solid ${GOLD}`:"3px solid transparent",
                    borderRadius:"8px 8px 0 0",
                    transition:"all 0.15s",
                    whiteSpace:"nowrap",
                  }}>
                  <span style={{fontSize:14}}>{icon}</span>{label}
                  {active&&<span style={{
                    width:6,height:6,borderRadius:"50%",
                    background:GOLD,flexShrink:0,
                  }}/>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{maxWidth:860,margin:"0 auto",padding:"24px 16px 60px"}}>

        {/* ── Kalender ── */}
        {section==="calendar" && (
          <div>
            {/* Nav bulan */}
            <div style={{
              display:"flex",alignItems:"center",justifyContent:"space-between",
              marginBottom:22,background:"white",borderRadius:14,
              padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,0.07)",
              border:`1.5px solid ${BORDER}`,
            }}>
              <button onClick={prevMonth}
                style={{
                  width:36,height:36,borderRadius:9,border:`1.5px solid ${BORDER}`,
                  background:"white",cursor:"pointer",fontSize:16,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontWeight:700,color:"#374151",
                }}>‹</button>
              <div style={{fontWeight:800,fontSize:18,color:NAVY}}>
                {MONTH_NAMES[calMonth-1]} {calYear}
              </div>
              <button onClick={nextMonth}
                style={{
                  width:36,height:36,borderRadius:9,border:`1.5px solid ${BORDER}`,
                  background:"white",cursor:"pointer",fontSize:16,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontWeight:700,color:"#374151",
                }}>›</button>
            </div>

            {loading
              ? <div style={{
                  textAlign:"center",padding:"60px 0",color:GRAY,
                  background:"white",borderRadius:14,border:`1.5px solid ${BORDER}`,
                }}>
                  <div style={{fontSize:28,marginBottom:8}}>⏳</div>
                  Memuat kalender...
                </div>
              : (
                <div style={{background:"white",borderRadius:14,padding:"20px",border:`1.5px solid ${BORDER}`,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
                  <RoomCalendar bookings={bookings} rooms={rooms} year={calYear} month={calMonth}/>
                  <Legend/>
                </div>
              )
            }

            {/* CTA */}
            <div style={{marginTop:20,textAlign:"center"}}>
              <button onClick={()=>gotoSection("form")}
                style={{
                  padding:"14px 36px",borderRadius:12,border:"none",
                  background:`linear-gradient(135deg,${NAVY} 0%,${NAVY2} 100%)`,
                  color:"white",fontWeight:800,fontSize:15,cursor:"pointer",
                  boxShadow:"0 4px 16px rgba(10,22,40,0.28)",
                  letterSpacing:0.3,transition:"transform 0.15s",
                }}
                onMouseEnter={e=>e.target.style.transform="translateY(-1px)"}
                onMouseLeave={e=>e.target.style.transform="translateY(0)"}>
                Ajukan Peminjaman →
              </button>
            </div>
          </div>
        )}

        {/* ── Form ── */}
        {section==="form" && (
          success
            ? <SuccessView booking={success} onReset={gotoSection}/>
            : <BookingForm rooms={rooms} bookings={bookings} onSuccess={setSuccess}/>
        )}

        {/* ── Tracker ── */}
        {section==="tracker" && (
          <div style={{
            background:"white",borderRadius:14,padding:"24px 22px",
            border:`1.5px solid ${BORDER}`,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",
          }}>
            <h3 style={{margin:"0 0 6px",fontSize:18,fontWeight:800,color:NAVY}}>
              Cek Status Peminjaman
            </h3>
            <p style={{margin:"0 0 18px",fontSize:13,color:GRAY}}>
              Masukkan kode booking yang Anda terima via WhatsApp, atau nomor WA PIC.
            </p>
            <StatusTracker/>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={{
        background:NAVY,color:"rgba(255,255,255,0.4)",
        textAlign:"center",padding:"16px",fontSize:12,letterSpacing:0.3,
      }}>
        Bagian Protokol & Komunikasi Pimpinan — Pemerintah Kota Tarakan
      </div>
    </div>
  );
}
