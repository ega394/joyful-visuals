/**
 * PinjamRuanganPage.jsx — Halaman Publik Peminjaman Ruangan
 */
import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";

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

const SESSION_INFO = {
  Pagi:     { label:"Pagi",     sub:"07.30–12.00", color:"#2563EB", light:"#EFF6FF" },
  Siang:    { label:"Siang",    sub:"12.30–16.30", color:"#7C3AED", light:"#F5F3FF" },
  Full_Day: { label:"Full Day", sub:"07.30–16.30", color:"#D97706", light:"#FFFBEB" },
};

const DAYS_SHORT  = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
const MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

// ── Helpers ──────────────────────────────────────────────────
const toYMD = d => (d instanceof Date ? d : new Date(d)).toISOString().slice(0,10);
const isWeekend = s => { const d = new Date(s+"T00:00:00"); return d.getDay()===0||d.getDay()===6; };

// Format Srikandi wajib: nomor/nomor/instansi/tahun  (cth: 005/1234/SETDA/2026)
const SRIKANDI_RE = /^\d[\d.]*\/\d[\d.]*\/[^/]+\/\d{4}$/;
const isValidSrikandi = s => SRIKANDI_RE.test(String(s||"").trim());

// Deteksi layar mobile (untuk layout responsif tanpa media query)
function useIsMobile(bp = 640) {
  const [m, setM] = useState(
    typeof window !== "undefined" ? window.innerWidth < bp : false
  );
  useEffect(() => {
    const on = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [bp]);
  return m;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr+"T00:00:00"); d.setDate(d.getDate()+n); return toYMD(d);
}

function slotBooking(bookings, roomId, dateStr, session) {
  const conflict = session==="Full_Day" ? ["Pagi","Siang","Full_Day"]
                 : session==="Pagi"     ? ["Pagi","Full_Day"]
                 :                        ["Siang","Full_Day"];
  const rel = (bookings||[]).filter(b =>
    b.room_id===roomId && b.start_date<=dateStr && b.end_date>=dateStr && conflict.includes(b.session)
  );
  return rel.find(b=>b.status==="Approved") || rel.find(b=>b.status==="Pending") || null;
}

function fmtTgl(s, short=false) {
  if (!s) return "-";
  const d = new Date(s+"T00:00:00");
  return short
    ? d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})
    : d.toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
}

// ── Slot cell in calendar ─────────────────────────────────────
function SlotCell({ session, booking, highlighted, onClick, weekend }) {
  if (weekend) return <div style={{height:10,borderRadius:2,background:"#F3F4F6"}}/>;

  if (!booking) {
    return (
      <div
        onClick={onClick}
        title={onClick ? `Klik untuk ajukan sesi ${session}` : undefined}
        style={{
          height:10, borderRadius:2,
          background: highlighted ? "#BFDBFE" : "#D1FAE5",
          border: `1px solid ${highlighted ? "#93C5FD" : "#A7F3D0"}`,
          cursor: onClick ? "pointer" : "default",
          transition:"opacity 0.1s",
        }}
        onMouseEnter={e=>{ if(onClick) e.currentTarget.style.opacity="0.65"; }}
        onMouseLeave={e=>{ e.currentTarget.style.opacity="1"; }}
      />
    );
  }
  const approved = booking.status==="Approved";
  return (
    <div style={{
      height:10, borderRadius:2,
      background: approved?"#FEE2E2":"#FEF3C7",
      border:`1px solid ${approved?"#FCA5A5":"#FCD34D"}`,
      color: approved?"#991B1B":"#92400E",
      fontSize:7, fontWeight:800, letterSpacing:0.3,
      textAlign:"center", lineHeight:"9px", textTransform:"uppercase",
    }}>
      {approved?"Terisi":"Proses"}
    </div>
  );
}

// ── Calendar ──────────────────────────────────────────────────
const RoomCalendar = memo(function RoomCalendar({ bookings, rooms, year, month, highlightRange, onSlotClick }) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDow    = new Date(year, month-1, 1).getDay();
  const today       = toYMD(new Date());

  // Index booking per ruangan sekali saja → lookup sel kalender jadi ringan
  const byRoom = useMemo(() => {
    const m = new Map();
    for (const b of (bookings||[])) {
      if (!m.has(b.room_id)) m.set(b.room_id, []);
      m.get(b.room_id).push(b);
    }
    return m;
  }, [bookings]);

  const cells = useMemo(() => {
    const arr = [];
    for (let i=0; i<startDow; i++) arr.push(null);
    for (let d=1; d<=daysInMonth; d++)
      arr.push(`${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
    return arr;
  }, [year, month, daysInMonth, startDow]);

  const inHL = (dateStr, roomId, session) => {
    if (!highlightRange?.start) return false;
    if (dateStr < highlightRange.start || dateStr > highlightRange.end) return false;
    if (highlightRange.room_id && highlightRange.room_id !== roomId) return false;
    if (!highlightRange.session) return true;
    if (highlightRange.session==="Full_Day") return true;
    return highlightRange.session===session;
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:28}}>
      {rooms.map(room => {
        const roomBk = byRoom.get(room.id) || [];
        return (
        <div key={room.id}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{background:NAVY,color:"white",borderRadius:10,padding:"6px 16px",fontSize:14,fontWeight:800}}>
              {room.name}
            </div>
            <div style={{background:"#F3F4F6",color:GRAY,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:600}}>
              Kapasitas {room.capacity} orang
            </div>
          </div>

          <div style={{position:"relative"}}>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <div style={{minWidth:480}}>
                {/* Day headers */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:3}}>
                  {DAYS_SHORT.map((d,i)=>(
                    <div key={d} style={{
                      textAlign:"center",fontSize:11,fontWeight:700,padding:"4px 0",
                      color:(i===0||i===6)?"#EF4444":GRAY,
                    }}>{d}</div>
                  ))}
                </div>

                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
                  {cells.map((dateStr,i)=>{
                    if (!dateStr) return <div key={i}/>;
                    const dow   = new Date(dateStr+"T00:00:00").getDay();
                    const wknd  = dow===0||dow===6;
                    const pagiB = slotBooking(roomBk,room.id,dateStr,"Pagi");
                    const sngB  = slotBooking(roomBk,room.id,dateStr,"Siang");
                    const isToday = dateStr===today;
                    const isPast  = dateStr<today;
                    const hlCell  = highlightRange && inHL(dateStr,room.id,null);
                    const pagiHL  = highlightRange && inHL(dateStr,room.id,"Pagi");
                    const sngHL   = highlightRange && inHL(dateStr,room.id,"Siang");

                    return (
                      <div key={dateStr} style={{
                        border: hlCell
                          ? "2px solid #2563EB"
                          : `2px solid ${isToday?GOLD:wknd?"#F3F4F6":BORDER}`,
                        borderRadius:8, padding:"4px 3px 3px",
                        background: hlCell?"#EFF6FF":wknd?"#FAFAFA":isPast?"#FAFAFA":"white",
                        opacity:isPast?0.5:1,
                        boxShadow:hlCell?"0 0 0 2px rgba(37,99,235,0.18)":isToday?"0 0 0 2px rgba(201,168,76,0.2)":undefined,
                      }}>
                        <div style={{
                          textAlign:"center",fontSize:11,
                          fontWeight:(isToday||hlCell)?900:500,
                          color:wknd?"#EF4444":hlCell?"#1D4ED8":isToday?NAVY:"#374151",
                          marginBottom:3,
                        }}>
                          {parseInt(dateStr.slice(8))}
                        </div>
                        {wknd ? (
                          <div style={{fontSize:8,color:"#9CA3AF",textAlign:"center",padding:"2px 0"}}>Libur</div>
                        ) : (
                          <div style={{display:"flex",flexDirection:"column",gap:2}}>
                            <div>
                              <div style={{fontSize:7,color:GRAY,fontWeight:600,lineHeight:1,marginBottom:1}}>Pagi</div>
                              <SlotCell
                                session="Pagi" booking={pagiB} highlighted={pagiHL} weekend={false}
                                onClick={(!pagiB&&!isPast&&onSlotClick)?()=>onSlotClick(dateStr,room.id,"Pagi"):undefined}
                              />
                            </div>
                            <div>
                              <div style={{fontSize:7,color:GRAY,fontWeight:600,lineHeight:1,marginBottom:1}}>Siang</div>
                              <SlotCell
                                session="Siang" booking={sngB} highlighted={sngHL} weekend={false}
                                onClick={(!sngB&&!isPast&&onSlotClick)?()=>onSlotClick(dateStr,room.id,"Siang"):undefined}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* Mobile scroll fade */}
            <div style={{
              position:"absolute",right:0,top:0,bottom:0,width:28,pointerEvents:"none",
              background:"linear-gradient(to right,transparent,rgba(255,255,255,0.9))",
            }}/>
          </div>
        </div>
        );
      })}
    </div>
  );
});

// ── Legend ────────────────────────────────────────────────────
function Legend({ showClickHint }) {
  return (
    <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",background:GRAY_LIGHT,borderRadius:10,padding:"10px 14px",marginTop:16,fontSize:11}}>
      <span style={{fontWeight:700,color:GRAY}}>Keterangan:</span>
      {[
        {bg:"#D1FAE5",border:"#A7F3D0",label:"Kosong"},
        {bg:"#FEF3C7",border:"#FCD34D",label:"Menunggu"},
        {bg:"#FEE2E2",border:"#FECACA",label:"Terisi"},
      ].map(({bg,border,label})=>(
        <div key={label} style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:22,height:8,borderRadius:2,background:bg,border:`1px solid ${border}`}}/>
          <span style={{color:"#374151"}}>{label}</span>
        </div>
      ))}
      <div style={{display:"flex",alignItems:"center",gap:5}}>
        <div style={{width:22,height:8,borderRadius:2,background:"#F3F4F6"}}/>
        <span style={{color:"#EF4444"}}>Sabtu/Min</span>
      </div>
      {showClickHint && (
        <div style={{marginLeft:"auto",fontSize:11,color:"#2563EB",fontWeight:600,background:"#EFF6FF",padding:"3px 8px",borderRadius:6,border:"1px solid #BFDBFE"}}>
          Klik slot untuk mulai pengajuan (isi formulir dari awal)
        </div>
      )}
    </div>
  );
}

// ── Pre-form checklist ────────────────────────────────────────
function PreFormChecklist({ onStart }) {
  const [chk,setChk] = useState({});
  const items = [
    { k:"slot",  label:"Saya sudah melihat jadwal ketersediaan di Kalender",         req:true  },
    { k:"wa",    label:"Nomor WhatsApp PIC aktif dan dapat dihubungi",               req:true  },
    { k:"cap",   label:"Jumlah peserta tidak melebihi kapasitas ruangan",            req:true  },
    { k:"srik",  label:"Siapkan nomor surat Srikandi (khusus peminjaman > 1 hari)",  req:false },
  ];
  const ready = items.filter(i=>i.req).every(i=>chk[i.k]);

  return (
    <div style={{background:"white",borderRadius:14,padding:"22px 20px",border:`1.5px solid ${BORDER}`,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
      <div style={{fontWeight:800,fontSize:16,color:NAVY,marginBottom:4}}>Sebelum Mengisi Formulir</div>
      <div style={{fontSize:13,color:GRAY,marginBottom:16}}>Pastikan hal-hal berikut sudah dipersiapkan:</div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
        {items.map(item=>(
          <label key={item.k} style={{
            display:"flex",alignItems:"flex-start",gap:12,cursor:"pointer",
            padding:"12px 14px",borderRadius:10,
            background:chk[item.k]?"#F0FDF4":"#F9FAFB",
            border:`1.5px solid ${chk[item.k]?"#86EFAC":BORDER}`,
            transition:"all 0.15s",
          }}>
            <input type="checkbox" checked={!!chk[item.k]} onChange={e=>setChk(p=>({...p,[item.k]:e.target.checked}))}
              style={{marginTop:2,width:16,height:16,accentColor:GREEN,flexShrink:0}}
            />
            <div style={{fontSize:13,color:chk[item.k]?"#166534":"#374151",fontWeight:chk[item.k]?600:400}}>
              {item.label}
              {!item.req&&<span style={{fontSize:11,color:GRAY,fontWeight:400}}> (opsional)</span>}
            </div>
          </label>
        ))}
      </div>
      <button onClick={onStart} disabled={!ready} style={{
        width:"100%",padding:"14px",borderRadius:12,border:"none",
        background:ready?`linear-gradient(135deg,${NAVY} 0%,${NAVY2} 100%)`:"#E5E7EB",
        color:ready?"white":"#9CA3AF",fontWeight:800,fontSize:14,
        cursor:ready?"pointer":"not-allowed",transition:"all 0.2s",letterSpacing:0.3,
      }}>
        Lanjutkan ke Formulir →
      </button>
      {!ready&&<p style={{fontSize:12,color:GRAY,textAlign:"center",marginTop:8}}>Centang semua poin wajib untuk melanjutkan</p>}
    </div>
  );
}

// ── Form stepper ──────────────────────────────────────────────
function FormStepper({ step }) {
  const labels = ["Identitas & Kegiatan","Jadwal","Konfirmasi"];
  return (
    <div style={{display:"flex",alignItems:"center",marginBottom:20}}>
      {labels.map((label,i)=>(
        <React.Fragment key={i}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,flexShrink:0}}>
            <div style={{
              width:28,height:28,borderRadius:"50%",
              border:`2px solid ${i<step?GREEN:i===step?NAVY:BORDER}`,
              background:i<step?GREEN:i===step?NAVY:"white",
              color:i<=step?"white":GRAY,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:11,fontWeight:800,transition:"all 0.2s",
            }}>{i<step?"✓":i+1}</div>
            <div style={{fontSize:10,fontWeight:600,color:i===step?NAVY:i<step?GREEN:GRAY,whiteSpace:"nowrap"}}>
              {label}
            </div>
          </div>
          {i<labels.length-1&&(
            <div style={{flex:1,height:2,background:i<step?GREEN:BORDER,margin:"0 6px",marginBottom:16,transition:"background 0.2s"}}/>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Confirm step ──────────────────────────────────────────────
function ConfirmView({ form, file, rooms, submitting, uploading, err, onBack, onSubmit }) {
  const room = rooms.find(r=>r.id===Number(form.room_id));
  const slots = form.slots || [];
  const Row = ({label,value,hi})=>(
    <div style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:8,padding:"9px 0",borderBottom:`1px solid ${BORDER}`,alignItems:"start"}}>
      <div style={{fontSize:12,color:GRAY,fontWeight:600}}>{label}</div>
      <div style={{fontSize:13,color:hi?"#1D4ED8":"#111827",fontWeight:hi?700:400}}>{value||"-"}</div>
    </div>
  );
  return (
    <div>
      <div style={{background:"#EFF6FF",border:"1.5px solid #BFDBFE",borderRadius:10,padding:"12px 14px",marginBottom:16,display:"flex",alignItems:"flex-start",gap:10,fontSize:13,color:"#1D4ED8"}}>
        <span style={{fontSize:16,flexShrink:0}}>👁️</span>
        <span>Periksa kembali data Anda sebelum mengirim. Pengajuan yang sudah dikirim tidak dapat diubah.</span>
      </div>
      <div style={{background:"white",borderRadius:14,border:`1.5px solid ${BORDER}`,padding:"18px",marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:700,color:NAVY,letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>Ringkasan Pengajuan</div>
        <Row label="Instansi"      value={form.instansi}/>
        <Row label="Nama PIC"      value={form.pic_name}/>
        <Row label="WhatsApp PIC"  value={form.pic_wa}/>
        <Row label="Nama Acara"    value={form.event_name} hi/>
        <Row label="Ruangan"       value={room?`${room.name} (maks. ${room.capacity} orang)`:"-"} hi/>
        <Row label="Jumlah Peserta" value={form.participant_count?`${form.participant_count} orang`:"-"}/>
        <div style={{padding:"9px 0",borderBottom:`1px solid ${BORDER}`}}>
          <div style={{fontSize:12,color:GRAY,fontWeight:600,marginBottom:6}}>Jadwal ({slots.length} slot)</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {slots.map(s=>{ const i=SESSION_INFO[s.session]||{}; return (
              <div key={s.date+s.session} style={{fontSize:13,color:"#111827"}}>
                <b>{fmtTgl(s.date,true)}</b> — <span style={{color:i.color,fontWeight:700}}>{i.label}</span> <span style={{color:GRAY,fontSize:12}}>({i.sub})</span>
              </div>
            ); })}
          </div>
        </div>
        {form.srikandi_ref&&<Row label="No. Srikandi" value={form.srikandi_ref}/>}
        {file&&<Row label="File Surat" value={file.name}/>}
      </div>
      {err&&<div style={{padding:"12px 14px",background:RED_BG,color:RED,borderRadius:10,fontSize:13,marginBottom:14,border:`1.5px solid ${RED_BORDER}`}}>{err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button type="button" onClick={onBack} disabled={submitting}
          style={{flex:1,padding:"13px",borderRadius:12,border:`1.5px solid ${BORDER}`,background:"white",color:"#374151",fontWeight:700,fontSize:14,cursor:"pointer"}}>
          ← Ubah Data
        </button>
        <button type="button" onClick={onSubmit} disabled={submitting}
          style={{
            flex:2,padding:"13px",borderRadius:12,border:"none",
            background:submitting?"#9CA3AF":`linear-gradient(135deg,${GREEN} 0%,#047857 100%)`,
            color:"white",fontWeight:800,fontSize:14,cursor:submitting?"not-allowed":"pointer",
            boxShadow:submitting?"none":"0 4px 14px rgba(5,150,105,0.3)",letterSpacing:0.3,
          }}>
          {uploading?"Mengupload...":submitting?"Mengirim...":"✓ Kirim Pengajuan"}
        </button>
      </div>
    </div>
  );
}

// ── Print helper ──────────────────────────────────────────────
function printBookingPublic(b, slots) {
  const w = window.open("","_blank","width=800,height=900");
  if (!w) { alert("Mohon izinkan popup untuk mencetak."); return; }
  const esc = s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtFull = s=>s?new Date(s+"T00:00:00").toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}):"-";
  const ST = {Pagi:"07.30 – 12.00 WITA",Siang:"12.30 – 16.30 WITA",Full_Day:"Seharian (07.30 – 16.30 WITA)"};
  const today = new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
  const list = (slots && slots.length ? slots : [{start_date:b.start_date, session:b.session}])
    .slice().sort((x,y)=> x.start_date<y.start_date?-1:x.start_date>y.start_date?1:0);
  const jadwalRows = list.map(s=>`<tr><td>${fmtFull(s.start_date)}</td><td>${esc(ST[s.session]||s.session)}</td></tr>`).join("");
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
    <p style="text-align:justify;margin-bottom:14px">Sehubungan dengan permohonan peminjaman ruangan yang telah diajukan kepada Bagian Protokol &amp; Komunikasi Pimpinan Setda Kota Tarakan, dengan ini disampaikan rincian permohonan sebagai berikut:</p>
    <table>
      <tr><td class="lbl">Nama Acara / Kegiatan</td><td><b>${esc(b.event_name)}</b></td></tr>
      <tr><td class="lbl">Instansi / Pemohon</td><td>${esc(b.instansi)}</td></tr>
      <tr><td class="lbl">Penanggung Jawab (PIC)</td><td>${esc(b.pic_name)}</td></tr>
      <tr><td class="lbl">Nomor Kontak WhatsApp</td><td>${esc(b.pic_wa)}</td></tr>
      <tr><td class="lbl">Ruangan yang Dipinjam</td><td><b>${esc(b.rooms?.name||"-")}</b> (kapasitas ${b.rooms?.capacity||"-"} orang)</td></tr>
      <tr><td class="lbl">Jumlah Peserta</td><td>${b.participant_count} orang</td></tr>
      ${b.srikandi_ref?`<tr><td class="lbl">Nomor Surat (Srikandi)</td><td>${esc(b.srikandi_ref)}</td></tr>`:""}
    </table>
    <p style="margin:6px 0 4px;font-weight:600;color:#555">Jadwal Penggunaan (${list.length} slot):</p>
    <table><tr><td class="lbl">Tanggal</td><td class="lbl">Sesi / Waktu</td></tr>${jadwalRows}</table>
    <p style="margin-top:14px;text-align:justify">Berdasarkan ketersediaan ruangan dan kelengkapan administrasi, dengan ini permohonan peminjaman ruangan tersebut di atas dinyatakan <b>DISETUJUI</b>. Kepada pemohon diharapkan untuk memperhatikan ketentuan berikut:</p>
    <ol style="margin:6px 0 14px 22px">
      <li>Hadir tepat waktu sesuai jadwal yang telah ditentukan.</li>
      <li>Menjaga kebersihan, ketertiban, dan kerapian ruangan selama kegiatan berlangsung.</li>
      <li>Mengembalikan ruangan dalam kondisi semula setelah kegiatan selesai.</li>
      <li>Segera menghubungi staf Bagian Prokopim apabila terdapat perubahan jadwal atau pembatalan.</li>
      <li>Bertanggung jawab atas seluruh fasilitas yang digunakan selama peminjaman berlangsung.</li>
    </ol>
    <p style="margin-top:14px;text-align:justify">Demikian konfirmasi ini disampaikan untuk dapat dipergunakan sebagaimana mestinya. Atas perhatian dan kerja samanya, diucapkan terima kasih.</p>
    <div class="footer"><div style="display:inline-block;text-align:center;min-width:240px"><p>Tarakan, ${today}</p><p>Pengelola Ruangan,</p><div class="sp"></div><p><b><u>${esc(b.reviewed_by||"_____________________")}</u></b></p><p style="font-size:9pt;color:#666">Bagian Prokopim Kota Tarakan</p></div></div>
    <script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script></body></html>`);
  w.document.close();
}

// ── Multi-slot picker: tiap hari boleh sesi berbeda ───────────
const SESSION_KEYS = ["Pagi", "Siang", "Full_Day"];
const sessConflict = (a, b) => a === b || a === "Full_Day" || b === "Full_Day";

function MultiSlotPicker({ room, bookings, slots, onToggle, calY, calM, onPrevMonth, onNextMonth, loading, isMobile }) {
  const today = toYMD(new Date());
  const [activeDay, setActiveDay] = useState("");

  const daysInMonth = new Date(calY, calM, 0).getDate();
  const startDow    = new Date(calY, calM - 1, 1).getDay();
  const cells = useMemo(() => {
    const a = [];
    for (let i = 0; i < startDow; i++) a.push(null);
    for (let d = 1; d <= daysInMonth; d++)
      a.push(`${calY}-${String(calM).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
    return a;
  }, [calY, calM, daysInMonth, startDow]);

  const roomBk = useMemo(() => (bookings||[]).filter(b => b.room_id === room?.id), [bookings, room]);
  const daySlots = (d) => slots.filter(s => s.date === d);

  // status (date, sesi): selected | taken | blocked | free
  const slotStatus = (d, sess) => {
    if (daySlots(d).some(s => s.session === sess)) return "selected";
    if (slotBooking(roomBk, room?.id, d, sess))    return "taken";
    if (daySlots(d).some(s => sessConflict(s.session, sess))) return "blocked";
    return "free";
  };
  const dayOpen = (d) => d && d >= today && !isWeekend(d);
  const dayFull = (d) => SESSION_KEYS.every(s => { const st = slotStatus(d, s); return st === "taken" || st === "blocked"; });

  const navBtn = { width:32, height:32, borderRadius:9, border:`1.5px solid ${BORDER}`, background:"white", cursor:"pointer", fontWeight:700, fontSize:15, color:NAVY, display:"flex", alignItems:"center", justifyContent:"center" };
  const cellH  = isMobile ? 50 : 56;

  const SHORT = { Pagi:"P", Siang:"S", Full_Day:"FD" };

  return (
    <div style={{ background:"white", borderRadius:14, padding: isMobile ? "14px 12px" : "18px", border:`1.5px solid ${BORDER}`, marginBottom:16, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10, gap:8 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:NAVY, letterSpacing:1, textTransform:"uppercase" }}>
            Kalender {loading && <span style={{ fontWeight:500, color:GRAY }}>· memuat…</span>}
          </div>
          <div style={{ fontSize:11, color:GRAY, marginTop:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
            {room ? room.name : "Pilih ruangan dulu"}
          </div>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
          <button type="button" onClick={onPrevMonth} style={navBtn} aria-label="Bulan sebelumnya">‹</button>
          <div style={{ fontSize:13, fontWeight:800, color:NAVY, minWidth: isMobile ? 92 : 120, textAlign:"center" }}>
            {MONTH_NAMES[calM-1]} {calY}
          </div>
          <button type="button" onClick={onNextMonth} style={navBtn} aria-label="Bulan berikutnya">›</button>
        </div>
      </div>

      <div style={{ fontSize:12, fontWeight:600, marginBottom:10, padding:"8px 12px", borderRadius:8, background:"#EFF6FF", color:"#1D4ED8", border:"1px solid #BFDBFE" }}>
        Ketuk tanggal → pilih sesinya. Bisa beda sesi tiap hari (mis. besok Pagi, lusa Siang).
      </div>

      {/* Weekday header */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:4 }}>
        {DAYS_SHORT.map((d,i) => (
          <div key={d} style={{ textAlign:"center", fontSize:11, fontWeight:700, padding:"4px 0", color:(i===0||i===6)?"#EF4444":GRAY }}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
        {cells.map((d,i) => {
          if (!d) return <div key={"b"+i} />;
          const open = dayOpen(d);
          const sel  = daySlots(d);
          const isActive = d === activeDay;
          const full = open && !sel.length && dayFull(d);
          let bg = "white", col = "#111827", bd = BORDER;
          if (!open)            { bg = "#F3F4F6"; col = "#9CA3AF"; }
          if (full)             { bg = "#FEF2F2"; col = "#DC2626"; bd = "#FCA5A5"; }
          if (sel.length)       { bg = "#EFF6FF"; col = NAVY; bd = "#93C5FD"; }
          if (isActive)         { bd = NAVY; }
          return (
            <button
              key={d} type="button"
              disabled={!open}
              onClick={() => open && setActiveDay(d)}
              style={{
                height: cellH, borderRadius:9, border:`${isActive?2:1.5}px solid ${bd}`, background:bg, color:col,
                cursor: open ? "pointer" : "default", padding:"4px 2px",
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start",
                gap:2, fontFamily:"inherit", fontWeight:600, fontSize:isMobile?13:14,
              }}
            >
              <span>{parseInt(d.slice(8))}</span>
              {sel.length > 0 ? (
                <span style={{ display:"flex", gap:2, flexWrap:"wrap", justifyContent:"center" }}>
                  {sel.map(s => (
                    <span key={s.session} style={{ fontSize:8, fontWeight:800, color:"white", background:SESSION_INFO[s.session].color, borderRadius:4, padding:"1px 3px", lineHeight:1.3 }}>
                      {SHORT[s.session]}
                    </span>
                  ))}
                </span>
              ) : full ? (
                <span style={{ fontSize:7, fontWeight:700 }}>penuh</span>
              ) : open ? (
                <span style={{ fontSize:7, color:"#86EFAC", fontWeight:800 }}>●</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Session chooser for active day */}
      {activeDay && (
        <div style={{ marginTop:12, padding:"12px", borderRadius:10, background:"#F8FAFC", border:`1.5px solid ${BORDER}` }}>
          <div style={{ fontSize:13, fontWeight:700, color:NAVY, marginBottom:10 }}>
            Sesi untuk {fmtTgl(activeDay)}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
            {SESSION_KEYS.map(sess => {
              const st = slotStatus(activeDay, sess);
              const info = SESSION_INFO[sess];
              const disabled = st === "taken" || st === "blocked";
              const isSel = st === "selected";
              return (
                <button key={sess} type="button" disabled={disabled}
                  onClick={() => onToggle(activeDay, sess)}
                  title={st === "taken" ? "Sudah terisi" : st === "blocked" ? "Bentrok pilihan lain" : ""}
                  style={{
                    padding:isMobile?"10px 4px":"12px 6px", borderRadius:10, cursor: disabled ? "not-allowed" : "pointer",
                    border:`2px solid ${isSel?info.color:disabled?BORDER:info.color}`,
                    background: isSel ? info.color : disabled ? "#F3F4F6" : info.light,
                    color: isSel ? "white" : disabled ? "#9CA3AF" : info.color,
                    fontWeight:700, fontSize:isMobile?12:13, fontFamily:"inherit",
                    display:"flex", flexDirection:"column", alignItems:"center", gap:2,
                  }}>
                  <span>{info.label}{isSel?" ✓":""}</span>
                  <span style={{ fontSize:isMobile?9:10, fontWeight:400, opacity:0.85 }}>{info.sub}</span>
                  <span style={{ fontSize:8, fontWeight:700, opacity:0.9 }}>
                    {st === "taken" ? "TERISI" : st === "blocked" ? "BENTROK" : isSel ? "DIPILIH" : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setActiveDay("")}
            style={{ marginTop:10, width:"100%", padding:"8px", borderRadius:8, border:`1px solid ${BORDER}`, background:"white", color:GRAY, fontWeight:600, fontSize:12, cursor:"pointer" }}>
            Tutup
          </button>
        </div>
      )}

      {/* Mini legend */}
      <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginTop:12, fontSize:11, color:GRAY }}>
        <span style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ width:14, height:14, borderRadius:4, background:"#EFF6FF", border:"1px solid #93C5FD", display:"inline-block" }} /> Dipilih</span>
        <span style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ width:14, height:14, borderRadius:4, background:"#FEF2F2", border:"1px solid #FCA5A5", display:"inline-block" }} /> Penuh</span>
        <span style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ width:14, height:14, borderRadius:4, background:"#F3F4F6", display:"inline-block" }} /> Libur/Lewat</span>
      </div>
    </div>
  );
}

// ── Booking Form ──────────────────────────────────────────────
function BookingForm({ rooms, bookings, onSuccess, prefill, onClearPrefill }) {
  const today = toYMD(new Date());
  const isMobile = useIsMobile();
  const [formStep,setFormStep] = useState(1);
  const [form,setForm] = useState({
    room_id:"",instansi:"",pic_name:"",pic_wa:"",event_name:"",
    participant_count:"",slots:[],srikandi_ref:"",
  });
  const [file,setFile]       = useState(null);
  const [submitting,setSub]  = useState(false);
  const [uploading,setUpl]   = useState(false);
  const [err,setErr]         = useState("");
  const [step1Err,setS1Err]  = useState("");

  useEffect(()=>{
    if (prefill) {
      // Pra-pilih ruangan + slot dari kalender, TAPI tetap mulai dari
      // Step 1 (Identitas) — jangan lompat ke Step 2 agar form tidak dibypass.
      setForm(p=>({
        ...p,
        room_id: prefill.room_id ?? p.room_id,
        slots: prefill.slot ? [prefill.slot] : p.slots,
      }));
      setFormStep(1);
      onClearPrefill?.();
    }
  },[prefill]);

  const f = useCallback((k,v) => setForm(p=>({...p,[k]:v})), []);
  const slots        = form.slots;
  const multiSlot    = slots.length > 1;
  const selectedRoom = useMemo(()=>rooms.find(r=>r.id===Number(form.room_id)), [rooms, form.room_id]);

  // Bulan kalender: dari slot paling awal atau hari ini
  const [calOff,setCalOff] = useState(0);
  const baseDate = useMemo(() => {
    if (!slots.length) return today;
    return slots.reduce((m,s)=> s.date<m ? s.date : m, slots[0].date);
  }, [slots, today]);
  const { calY, calM } = useMemo(() => {
    const b = new Date(baseDate+"T00:00:00");
    const dt = new Date(b.getFullYear(), b.getMonth()+calOff, 1);
    return { calY: dt.getFullYear(), calM: dt.getMonth()+1 };
  }, [baseDate, calOff]);

  // Bookings akurat untuk bulan yang ditampilkan
  const [calBookings, setCalBookings] = useState(bookings||[]);
  const [calLoading, setCalLoading]   = useState(false);
  useEffect(()=>{ setCalBookings(bookings||[]); }, [bookings]);
  useEffect(()=>{
    let alive = true;
    const ms = `${calY}-${String(calM).padStart(2,"0")}`;
    setCalLoading(true);
    fetch(`/api/room-booking?month=${ms}`)
      .then(r=>r.json())
      .then(d=>{ if(alive && Array.isArray(d)) setCalBookings(d); })
      .catch(()=>{})
      .finally(()=>{ if(alive) setCalLoading(false); });
    return ()=>{ alive=false; };
  },[calY, calM]);

  // Tambah/hapus slot (tanggal + sesi). Cegah bentrok antar slot di hari sama.
  const toggleSlot = useCallback((date, session) => {
    setForm(p => {
      const exists = p.slots.some(s => s.date===date && s.session===session);
      let next;
      if (exists) {
        next = p.slots.filter(s => !(s.date===date && s.session===session));
      } else {
        if (p.slots.some(s => s.date===date && sessConflict(s.session, session))) return p;
        next = [...p.slots, { date, session }];
      }
      next.sort((a,b)=> a.date<b.date?-1 : a.date>b.date?1 : SESSION_KEYS.indexOf(a.session)-SESSION_KEYS.indexOf(b.session));
      return { ...p, slots: next };
    });
    setErr("");
  }, []);
  const prevMonthCal = useCallback(() => setCalOff(o => o - 1), []);
  const nextMonthCal = useCallback(() => setCalOff(o => o + 1), []);

  const nextStep = () => {
    if (formStep===1) {
      if (!form.instansi||!form.pic_name||!form.pic_wa||!form.event_name||!form.room_id||!form.participant_count) {
        setS1Err("Harap lengkapi semua field yang ditandai *"); return;
      }
      if (form.pic_wa.replace(/\D/g,"").length<10) {
        setS1Err("Nomor WhatsApp tidak valid (minimal 10 digit)"); return;
      }
      setS1Err(""); setFormStep(2); return;
    }
    if (formStep===2) {
      if (!slots.length) { setErr("Pilih minimal satu tanggal & sesi pada kalender."); return; }
      if (multiSlot && !form.srikandi_ref && !file) { setErr("Pengajuan lebih dari 1 slot wajib melampirkan nomor Srikandi atau file surat."); return; }
      if (form.srikandi_ref && !isValidSrikandi(form.srikandi_ref)) {
        setErr("Format nomor Srikandi salah. Gunakan: nomor/nomor/instansi/tahun (contoh: 005/1234/SETDA/2026)."); return;
      }
      setErr(""); setFormStep(3); return;
    }
  };

  const handleSubmit = async () => {
    setErr(""); setSub(true);
    try {
      let document_path=null;
      if (file) {
        setUpl(true);
        const SU=import.meta.env.VITE_SUPABASE_URL, SK=import.meta.env.VITE_SUPABASE_ANON_KEY;
        const path=`booking-docs/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
        const up=await fetch(`${SU}/storage/v1/object/room-documents/${path}`,{
          method:"POST",headers:{"apikey":SK,"Authorization":`Bearer ${SK}`,"Content-Type":file.type||"application/pdf"},body:file,
        });
        if(!up.ok) throw new Error("Upload gagal: "+await up.text());
        document_path=`${SU}/storage/v1/object/public/room-documents/${path}`;
        setUpl(false);
      }
      const r=await fetch("/api/room-booking",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          room_id:Number(form.room_id), instansi:form.instansi, pic_name:form.pic_name,
          pic_wa:form.pic_wa, event_name:form.event_name,
          participant_count:Number(form.participant_count),
          slots:form.slots, srikandi_ref:form.srikandi_ref, document_path,
        }),
      });
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||"Gagal mengirim");
      onSuccess(d.booking);
    } catch(e) { setErr(e.message); setFormStep(2); }
    setSub(false); setUpl(false);
  };

  const inp={width:"100%",padding:"11px 13px",borderRadius:10,border:`1.5px solid ${BORDER}`,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit",background:"white",transition:"border 0.15s"};
  const lbl={fontSize:13,fontWeight:600,color:"#374151",marginBottom:5,display:"block"};
  const sec={background:"white",borderRadius:14,border:`1.5px solid ${BORDER}`,padding:"18px",marginBottom:16};

  return (
    <div>
      <FormStepper step={formStep-1}/>

      {/* ── Step 1: Identitas + Kegiatan ── */}
      {formStep===1&&(
        <div>
          <div style={sec}>
            <div style={{fontSize:12,fontWeight:700,color:NAVY,letterSpacing:1,textTransform:"uppercase",marginBottom:14}}>Identitas Pemohon</div>
            <div style={{display:"grid",gap:12}}>
              <div>
                <label style={lbl}>Instansi / Organisasi <span style={{color:RED}}>*</span></label>
                <input value={form.instansi} onChange={e=>f("instansi",e.target.value)} placeholder="Dinas / OPD / Organisasi / Komunitas" style={inp}
                  onFocus={e=>e.target.style.border=`1.5px solid ${NAVY}`} onBlur={e=>e.target.style.border=`1.5px solid ${BORDER}`}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
                <div>
                  <label style={lbl}>Nama PIC <span style={{color:RED}}>*</span></label>
                  <input value={form.pic_name} onChange={e=>f("pic_name",e.target.value)} placeholder="Nama penanggung jawab" style={inp}
                    onFocus={e=>e.target.style.border=`1.5px solid ${NAVY}`} onBlur={e=>e.target.style.border=`1.5px solid ${BORDER}`}/>
                </div>
                <div>
                  <label style={lbl}>WhatsApp PIC <span style={{color:RED}}>*</span></label>
                  <input value={form.pic_wa} onChange={e=>f("pic_wa",e.target.value)} placeholder="08xxxxxxxxxx" type="tel" style={inp}
                    onFocus={e=>e.target.style.border=`1.5px solid ${NAVY}`} onBlur={e=>e.target.style.border=`1.5px solid ${BORDER}`}/>
                  <div style={{fontSize:11,color:GRAY,marginTop:4}}>Pastikan nomor ini aktif di WhatsApp — konfirmasi akan dikirim ke sini</div>
                </div>
              </div>
            </div>
          </div>

          <div style={sec}>
            <div style={{fontSize:12,fontWeight:700,color:NAVY,letterSpacing:1,textTransform:"uppercase",marginBottom:14}}>Detail Kegiatan</div>
            <div style={{display:"grid",gap:12}}>
              <div>
                <label style={lbl}>Nama Acara / Kegiatan <span style={{color:RED}}>*</span></label>
                <input value={form.event_name} onChange={e=>f("event_name",e.target.value)} placeholder="Nama kegiatan yang akan diselenggarakan" style={inp}
                  onFocus={e=>e.target.style.border=`1.5px solid ${NAVY}`} onBlur={e=>e.target.style.border=`1.5px solid ${BORDER}`}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
                <div>
                  <label style={lbl}>Pilih Ruangan <span style={{color:RED}}>*</span></label>
                  <select value={form.room_id} onChange={e=>f("room_id",e.target.value)} style={{...inp,color:form.room_id?"#111827":GRAY}}>
                    <option value="">-- Pilih Ruangan --</option>
                    {rooms.map(r=><option key={r.id} value={r.id}>{r.name} (maks. {r.capacity} orang)</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Jumlah Peserta <span style={{color:RED}}>*</span>{selectedRoom&&<span style={{fontWeight:400,color:GRAY}}> (maks. {selectedRoom.capacity})</span>}</label>
                  <input type="number" min={1} max={selectedRoom?.capacity||999} value={form.participant_count} onChange={e=>f("participant_count",e.target.value)} placeholder="Estimasi peserta" style={inp}
                    onFocus={e=>e.target.style.border=`1.5px solid ${NAVY}`} onBlur={e=>e.target.style.border=`1.5px solid ${BORDER}`}/>
                </div>
              </div>
            </div>
          </div>

          {step1Err&&<div style={{padding:"12px 14px",background:RED_BG,color:RED,borderRadius:10,fontSize:13,marginBottom:14,border:`1.5px solid ${RED_BORDER}`}}>{step1Err}</div>}

          <button type="button" onClick={nextStep} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:`linear-gradient(135deg,${NAVY} 0%,${NAVY2} 100%)`,color:"white",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:"0 4px 14px rgba(10,22,40,0.3)",letterSpacing:0.3}}>
            Lanjut ke Jadwal →
          </button>
        </div>
      )}

      {/* ── Step 2: Jadwal (multi-slot) ── */}
      {formStep===2&&(
        <div>
          <div style={{fontSize:12,fontWeight:700,color:NAVY,letterSpacing:1,textTransform:"uppercase",margin:"0 0 4px 2px"}}>
            Pilih Jadwal Pemakaian
          </div>
          <div style={{fontSize:12,color:GRAY,margin:"0 0 10px 2px"}}>
            {selectedRoom ? <>Ruangan: <b>{selectedRoom.name}</b> (maks. {selectedRoom.capacity} orang)</> : "Ruangan belum dipilih"}
          </div>

          <MultiSlotPicker
            room={selectedRoom}
            bookings={calBookings}
            slots={slots}
            onToggle={toggleSlot}
            calY={calY} calM={calM}
            onPrevMonth={prevMonthCal}
            onNextMonth={nextMonthCal}
            loading={calLoading}
            isMobile={isMobile}
          />

          {/* Daftar slot terpilih */}
          <div style={{...sec, padding: isMobile?"14px":"16px 18px"}}>
            <div style={{fontSize:12,fontWeight:700,color:NAVY,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>
              Jadwal Dipilih ({slots.length})
            </div>
            {slots.length===0
              ? <div style={{fontSize:13,color:GRAY}}>Belum ada. Ketuk tanggal di kalender lalu pilih sesi.</div>
              : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {slots.map(s=>{
                    const info=SESSION_INFO[s.session]||{};
                    return (
                      <div key={s.date+s.session} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"9px 12px",borderRadius:10,background:"#F8FAFC",border:`1px solid ${BORDER}`}}>
                        <div style={{fontSize:13,minWidth:0}}>
                          <b>{fmtTgl(s.date,true)}</b>
                          <span style={{color:info.color,fontWeight:700,marginLeft:8}}>{info.label}</span>
                          <span style={{color:GRAY,fontSize:11}}> · {info.sub}</span>
                        </div>
                        <button type="button" onClick={()=>toggleSlot(s.date,s.session)}
                          style={{flexShrink:0,width:26,height:26,borderRadius:7,border:`1px solid ${RED_BORDER}`,background:"white",color:RED,fontWeight:800,fontSize:13,cursor:"pointer",lineHeight:1}}
                          aria-label="Hapus slot">✕</button>
                      </div>
                    );
                  })}
                </div>
            }
          </div>

          {/* Srikandi (wajib bila lebih dari 1 slot) */}
          {multiSlot&&(
            <div style={{...sec,border:`1.5px solid ${YELLOW_BORDER}`,background:YELLOW_BG}}>
              <div style={{fontWeight:700,color:"#92400E",fontSize:13,marginBottom:4}}>Lampiran Surat Permohonan</div>
              <div style={{fontSize:12,color:"#B45309",marginBottom:12}}>Wajib karena pengajuan lebih dari 1 slot. Isi salah satu.</div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
                <div>
                  <label style={{...lbl,color:"#92400E"}}>Nomor Surat Srikandi</label>
                  {(()=>{ const bad=form.srikandi_ref&&!isValidSrikandi(form.srikandi_ref); const bc=bad?RED:YELLOW_BORDER; return (
                    <input value={form.srikandi_ref} onChange={e=>f("srikandi_ref",e.target.value)} placeholder="005/1234/SETDA/2026"
                      style={{...inp,border:`1.5px solid ${bc}`,background:"white"}}
                      onFocus={e=>e.target.style.border=`1.5px solid ${bad?RED:YELLOW}`} onBlur={e=>e.target.style.border=`1.5px solid ${bc}`}/>
                  ); })()}
                  <div style={{fontSize:11,color:form.srikandi_ref&&!isValidSrikandi(form.srikandi_ref)?RED:GRAY,marginTop:4}}>
                    {form.srikandi_ref&&!isValidSrikandi(form.srikandi_ref)
                      ? "⚠️ Format salah. Wajib: nomor/nomor/instansi/tahun"
                      : "Format: nomor/nomor/instansi/tahun (cth: 005/1234/SETDA/2026)"}
                  </div>
                </div>
                <div>
                  <label style={{...lbl,color:"#92400E"}}>Upload Surat (PDF)</label>
                  <input type="file" accept=".pdf,application/pdf" onChange={e=>setFile(e.target.files?.[0]||null)}
                    style={{...inp,padding:"8px 10px",border:`1.5px solid ${YELLOW_BORDER}`,cursor:"pointer"}}/>
                  {file&&<div style={{fontSize:11,color:"#166534",marginTop:4}}>✓ {file.name}</div>}
                </div>
              </div>
              {!form.srikandi_ref&&!file&&<p style={{fontSize:12,color:RED,margin:"8px 0 0"}}>Wajib isi salah satu di atas.</p>}
            </div>
          )}

          {err&&<div style={{padding:"12px 14px",background:RED_BG,color:RED,borderRadius:10,fontSize:13,marginBottom:14,border:`1.5px solid ${RED_BORDER}`,display:"flex",alignItems:"flex-start",gap:8}}><span style={{flexShrink:0}}>⚠️</span>{err}</div>}

          <div style={{display:"flex",gap:10}}>
            <button type="button" onClick={()=>{setFormStep(1);setErr("");}} style={{flex:1,padding:"13px",borderRadius:12,border:`1.5px solid ${BORDER}`,background:"white",color:"#374151",fontWeight:700,fontSize:14,cursor:"pointer"}}>
              ← Kembali
            </button>
            {(()=>{ const blocked = !slots.length || (multiSlot&&!form.srikandi_ref&&!file) || (form.srikandi_ref&&!isValidSrikandi(form.srikandi_ref)); return (
              <button type="button" onClick={nextStep} disabled={blocked}
                style={{flex:2,padding:"13px",borderRadius:12,border:"none",background:blocked?"#E5E7EB":`linear-gradient(135deg,${NAVY} 0%,${NAVY2} 100%)`,color:blocked?"#9CA3AF":"white",fontWeight:800,fontSize:14,cursor:blocked?"not-allowed":"pointer",boxShadow:"0 4px 14px rgba(10,22,40,0.2)",letterSpacing:0.3}}>
                Lihat Konfirmasi →
              </button>
            ); })()}
          </div>
        </div>
      )}

      {/* ── Step 3: Konfirmasi ── */}
      {formStep===3&&(
        <ConfirmView form={form} file={file} rooms={rooms} submitting={submitting} uploading={uploading} err={err}
          onBack={()=>setFormStep(2)} onSubmit={handleSubmit}/>
      )}
    </div>
  );
}

// ── Success ───────────────────────────────────────────────────
function SuccessView({ booking, onReset }) {
  return (
    <div style={{background:GREEN_BG,border:`2px solid ${GREEN_BORDER}`,borderRadius:16,padding:"32px 24px",textAlign:"center"}}>
      <div style={{width:64,height:64,borderRadius:"50%",background:"#D1FAE5",border:`3px solid ${GREEN}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:30}}>✓</div>
      <div style={{fontSize:20,fontWeight:800,color:GREEN,marginBottom:6}}>Pengajuan Berhasil Dikirim!</div>
      <div style={{fontSize:14,color:"#065F46",marginBottom:20}}>Simpan kode berikut untuk memantau status pengajuan Anda:</div>
      <div style={{fontFamily:"monospace",fontSize:32,fontWeight:900,color:NAVY,letterSpacing:6,background:"white",padding:"14px 28px",borderRadius:12,display:"inline-block",border:`2px solid ${GREEN_BORDER}`,marginBottom:20,boxShadow:"0 2px 10px rgba(0,0,0,0.08)"}}>
        {booking.booking_code}
      </div>
      <div style={{fontSize:13,color:"#065F46",marginBottom:24,lineHeight:1.6}}>
        Konfirmasi dan notifikasi perubahan status akan dikirim ke WhatsApp Anda.<br/>Tim Prokopim akan memproses dalam waktu 1×24 jam.
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
        <button onClick={()=>onReset("calendar")} style={{padding:"11px 22px",borderRadius:10,border:"none",background:NAVY,color:"white",fontWeight:700,cursor:"pointer",fontSize:14}}>Lihat Kalender</button>
        <button onClick={()=>onReset("tracker")} style={{padding:"11px 22px",borderRadius:10,border:`1.5px solid ${NAVY}`,background:"white",color:NAVY,fontWeight:700,cursor:"pointer",fontSize:14}}>Cek Status Booking</button>
      </div>
    </div>
  );
}

// ── Status Tracker ────────────────────────────────────────────
function StatusTracker() {
  const [mode,setMode]    = useState("code");
  const [inputs,setInputs]= useState({code:"",wa:""});
  const [results,setRes]  = useState(null);
  const [loading,setLoad] = useState(false);
  const [err,setErr]      = useState("");
  const [cancelling,setCan]=useState(false);
  const inputRef = useRef();

  const query   = inputs[mode]||"";
  const setQuery = v => setInputs(p=>({...p,[mode]:v}));

  useEffect(()=>{
    const p=new URLSearchParams(window.location.search).get("cek");
    if(p){ setMode("code"); setInputs(prev=>({...prev,code:p})); }
  },[]);

  const search = async () => {
    if(!query.trim()){inputRef.current?.focus();return;}
    setLoad(true);setErr("");setRes(null);
    try{
      const param=mode==="code"?`code=${encodeURIComponent(query.trim().toUpperCase())}`:
        `pic_wa=${encodeURIComponent(query.trim())}`;
      const r=await fetch(`/api/room-booking?${param}`);
      if(!r.ok) throw new Error(await r.text());
      setRes(await r.json());
    }catch(e){setErr("Gagal terhubung ke server. Coba lagi.");}
    setLoad(false);
  };

  const doCancel = async (code) => {
    if(!window.confirm("Batalkan seluruh pengajuan dengan kode ini?")) return;
    setCan(true);
    try{
      const r=await fetch(`/api/room-booking?code=${encodeURIComponent(code)}`,{method:"DELETE"});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error);
      alert("Pengajuan berhasil dibatalkan.");
      search();
    }catch(e){alert("Gagal: "+e.message);}
    setCan(false);
  };

  const statusCfg={
    Pending:  {label:"Menunggu Konfirmasi",color:YELLOW,bg:YELLOW_BG,border:YELLOW_BORDER},
    Approved: {label:"Disetujui",          color:GREEN, bg:GREEN_BG, border:GREEN_BORDER},
    Rejected: {label:"Ditolak",            color:RED,   bg:RED_BG,   border:RED_BORDER},
    Cancelled:{label:"Dibatalkan",         color:GRAY,  bg:"#F3F4F6",border:BORDER},
  };

  return (
    <div>
      <div style={{display:"flex",gap:4,marginBottom:14,background:"#F3F4F6",borderRadius:10,padding:4}}>
        {[{k:"code",l:"Kode Booking"},{k:"wa",l:"Nomor WhatsApp"}].map(({k,l})=>(
          <button key={k} onClick={()=>{setMode(k);setRes(null);setErr("");}}
            style={{flex:1,padding:"8px",borderRadius:7,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:mode===k?"white":"transparent",color:mode===k?NAVY:GRAY,boxShadow:mode===k?"0 1px 4px rgba(0,0,0,0.12)":undefined,transition:"all 0.15s"}}>
            {l}
          </button>
        ))}
      </div>

      <div style={{display:"flex",gap:8,marginBottom:4}}>
        <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&search()}
          placeholder={mode==="code"?"Contoh: AB12CD34":"Contoh: 08123456789"}
          style={{flex:1,padding:"11px 14px",borderRadius:10,border:`1.5px solid ${BORDER}`,fontSize:14,outline:"none",transition:"border 0.15s",fontFamily:"inherit"}}
          onFocus={e=>e.target.style.border=`1.5px solid ${NAVY}`}
          onBlur={e=>e.target.style.border=`1.5px solid ${BORDER}`}
        />
        <button onClick={search} disabled={loading}
          style={{padding:"11px 22px",borderRadius:10,border:"none",background:loading?"#9CA3AF":NAVY,color:"white",fontWeight:700,fontSize:14,cursor:loading?"not-allowed":"pointer",whiteSpace:"nowrap"}}>
          {loading?"...":"Cek Status"}
        </button>
      </div>
      {mode==="wa"&&<div style={{fontSize:11,color:GRAY,marginBottom:12}}>Masukkan nomor WhatsApp yang didaftarkan saat mengajukan</div>}

      {err&&<div style={{padding:"10px 14px",background:RED_BG,color:RED,borderRadius:8,fontSize:13,marginBottom:12}}>{err}</div>}

      {results!==null&&(
        results.length===0
          ?<div style={{textAlign:"center",padding:"32px 16px",background:GRAY_LIGHT,borderRadius:12,color:GRAY,fontSize:14}}>
              Tidak ditemukan peminjaman dengan {mode==="code"?"kode":"nomor WA"} tersebut.
            </div>
          :<div style={{display:"flex",flexDirection:"column",gap:10}}>
              {Object.values(
                (results||[]).reduce((acc,row)=>{
                  (acc[row.booking_code] = acc[row.booking_code] || []).push(row);
                  return acc;
                },{})
              )
              .sort((a,b)=> (b[0].created_at||"").localeCompare(a[0].created_at||""))
              .map(group=>{
                const h=group[0];
                const cfg=statusCfg[h.status]||statusCfg.Pending;
                const sorted=group.slice().sort((a,b)=> a.start_date<b.start_date?-1:a.start_date>b.start_date?1:0);
                return (
                  <div key={h.booking_code} style={{border:`1.5px solid ${cfg.border}`,borderRadius:12,background:cfg.bg,overflow:"hidden"}}>
                    <div style={{padding:"12px 16px",borderBottom:`1px solid ${cfg.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <div>
                          <div style={{fontFamily:"monospace",fontWeight:900,color:NAVY,fontSize:16,letterSpacing:1}}>{h.booking_code}</div>
                          <div style={{fontWeight:700,color:"#111827",fontSize:14,marginTop:2}}>{h.event_name}</div>
                        </div>
                        <div style={{padding:"5px 12px",borderRadius:20,background:"white",color:cfg.color,fontSize:12,fontWeight:800,border:`1.5px solid ${cfg.border}`,whiteSpace:"nowrap"}}>{cfg.label}</div>
                      </div>
                    </div>
                    <div style={{padding:"12px 16px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"6px 16px",fontSize:13}}>
                      <div><span style={{color:GRAY}}>Ruangan: </span><b>{h.rooms?.name}</b></div>
                      <div><span style={{color:GRAY}}>Instansi: </span>{h.instansi}</div>
                      <div><span style={{color:GRAY}}>PIC: </span>{h.pic_name}</div>
                      <div><span style={{color:GRAY}}>Peserta: </span>{h.participant_count} orang</div>
                    </div>
                    <div style={{padding:"0 16px 12px"}}>
                      <div style={{fontSize:12,color:GRAY,fontWeight:600,marginBottom:6}}>Jadwal ({sorted.length} slot):</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {sorted.map(s=>{ const i=SESSION_INFO[s.session]||{}; return (
                          <span key={s.id} style={{fontSize:12,background:"white",border:`1px solid ${BORDER}`,borderRadius:8,padding:"5px 9px"}}>
                            <b>{fmtTgl(s.start_date,true)}</b> · <span style={{color:i.color,fontWeight:700}}>{i.label}</span>
                          </span>
                        ); })}
                      </div>
                    </div>
                    {h.notes&&<div style={{margin:"0 14px 12px",padding:"8px 12px",background:"white",borderRadius:8,fontSize:13,color:h.status==="Rejected"?RED:GRAY,border:`1px solid ${BORDER}`}}><b>Keterangan:</b> {h.notes}</div>}
                    {(h.status==="Pending"||h.status==="Approved")&&(
                      <div style={{padding:"0 14px 14px",display:"flex",gap:8,flexWrap:"wrap"}}>
                        {h.status==="Pending"&&<button onClick={()=>doCancel(h.booking_code)} disabled={cancelling} style={{padding:"8px 18px",borderRadius:8,border:`1.5px solid ${RED}`,background:"white",color:RED,fontWeight:700,fontSize:13,cursor:cancelling?"not-allowed":"pointer"}}>Batalkan Pengajuan</button>}
                        {h.status==="Approved"&&<button onClick={()=>printBookingPublic(h,sorted)} style={{padding:"8px 18px",borderRadius:8,border:"none",background:NAVY,color:"white",fontWeight:700,fontSize:13,cursor:"pointer"}}>🖨️ Cetak Surat Konfirmasi</button>}
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

// ── Main Page ─────────────────────────────────────────────────
export default function PinjamRuanganPage() {
  const [rooms,setRooms]   = useState([]);
  const [bookings,setBook] = useState([]);
  const [loading,setLoad]  = useState(true);
  const [section,setSec]   = useState("calendar");
  const [success,setSuccess]= useState(null);
  const [showChecklist,setShowChecklist] = useState(true);
  const [prefill,setPrefill]= useState(null);

  const [calYear,setCalYear]   = useState(new Date().getFullYear());
  const [calMonth,setCalMonth] = useState(new Date().getMonth()+1);
  const monthStr = `${calYear}-${String(calMonth).padStart(2,"0")}`;

  useEffect(()=>{
    if(new URLSearchParams(window.location.search).get("cek")) setSec("tracker");
  },[]);

  const load = useCallback(async ()=>{
    setLoad(true);
    try {
      const [r,b]=await Promise.all([
        fetch("/api/room-booking?op=rooms").then(r=>r.json()),
        fetch(`/api/room-booking?month=${monthStr}`).then(r=>r.json()),
      ]);
      setRooms(Array.isArray(r)?r:[]);
      setBook(Array.isArray(b)?b:[]);
    }catch{}
    setLoad(false);
  },[monthStr]);

  useEffect(()=>{ load(); },[load]);

  const prevMonth=()=>{ if(calMonth===1){setCalYear(y=>y-1);setCalMonth(12);}else setCalMonth(m=>m-1); };
  const nextMonth=()=>{ if(calMonth===12){setCalYear(y=>y+1);setCalMonth(1);}else setCalMonth(m=>m+1); };

  const gotoSection = s => {
    setSec(s); setSuccess(null);
    if (s==="form") setShowChecklist(true);
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const handleSlotClick = (dateStr,roomId,session) => {
    // Klik kalender hanya mengantar ke form & pra-pilih slot.
    // Tetap mulai dari checklist → Step 1 (form wajib diisi dari awal).
    setPrefill({room_id:String(roomId),slot:{date:dateStr,session}});
    setShowChecklist(true);
    setSec("form"); setSuccess(null);
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const NAV_TABS=[
    {k:"calendar",icon:"📅",label:"Kalender"},
    {k:"form",    icon:"✏️", label:"Ajukan"},
    {k:"tracker", icon:"🔍",label:"Cek Status"},
  ];

  return (
    <div style={{minHeight:"100vh",background:"#F1F5F9",fontFamily:"Inter,system-ui,sans-serif"}}>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${NAVY} 0%,${NAVY2} 100%)`,boxShadow:"0 4px 24px rgba(0,0,0,0.3)",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:860,margin:"0 auto",padding:"16px 16px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <img src="/logo_tarakan.png" alt="Logo" style={{height:44,width:"auto",objectFit:"contain",flexShrink:0,filter:"drop-shadow(0 2px 4px rgba(0,0,0,0.3))"}} onError={e=>e.target.style.display="none"}/>
            <div>
              <div style={{color:GOLD,fontSize:9,letterSpacing:2.5,fontWeight:800,textTransform:"uppercase"}}>Pemerintah Kota Tarakan</div>
              <div style={{color:"white",fontSize:18,fontWeight:900,lineHeight:1.2,letterSpacing:-0.3}}>Peminjaman Ruang Rapat</div>
              <div style={{color:"rgba(255,255,255,0.5)",fontSize:11.5,marginTop:1}}>Bagian Protokol & Komunikasi Pimpinan</div>
            </div>
          </div>
          <div style={{display:"flex",gap:2}}>
            {NAV_TABS.map(({k,icon,label})=>{
              const active=section===k;
              return (
                <button key={k} onClick={()=>gotoSection(k)}
                  style={{display:"flex",alignItems:"center",gap:6,padding:"10px 16px",border:"none",cursor:"pointer",background:active?"rgba(255,255,255,0.15)":"transparent",color:active?"white":"rgba(255,255,255,0.5)",fontWeight:active?700:500,fontSize:13,borderBottom:active?`3px solid ${GOLD}`:"3px solid transparent",borderRadius:"8px 8px 0 0",transition:"all 0.15s",whiteSpace:"nowrap"}}>
                  <span style={{fontSize:14}}>{icon}</span>{label}
                  {active&&<span style={{width:6,height:6,borderRadius:"50%",background:GOLD,flexShrink:0}}/>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:860,margin:"0 auto",padding:"24px 16px 60px"}}>

        {/* Kalender */}
        {section==="calendar"&&(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22,background:"white",borderRadius:14,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,0.07)",border:`1.5px solid ${BORDER}`}}>
              <button onClick={prevMonth} style={{width:36,height:36,borderRadius:9,border:`1.5px solid ${BORDER}`,background:"white",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#374151"}}>‹</button>
              <div style={{fontWeight:800,fontSize:18,color:NAVY}}>{MONTH_NAMES[calMonth-1]} {calYear}</div>
              <button onClick={nextMonth} style={{width:36,height:36,borderRadius:9,border:`1.5px solid ${BORDER}`,background:"white",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#374151"}}>›</button>
            </div>

            {loading
              ?<div style={{textAlign:"center",padding:"60px 0",color:GRAY,background:"white",borderRadius:14,border:`1.5px solid ${BORDER}`}}>
                  <div style={{fontSize:28,marginBottom:8}}>⏳</div>Memuat kalender...
                </div>
              :<div style={{background:"white",borderRadius:14,padding:"20px",border:`1.5px solid ${BORDER}`,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
                  <RoomCalendar bookings={bookings} rooms={rooms} year={calYear} month={calMonth} onSlotClick={handleSlotClick}/>
                  <Legend showClickHint/>
                </div>
            }

            <div style={{marginTop:20,textAlign:"center"}}>
              <button onClick={()=>gotoSection("form")}
                style={{padding:"14px 36px",borderRadius:12,border:"none",background:`linear-gradient(135deg,${NAVY} 0%,${NAVY2} 100%)`,color:"white",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:"0 4px 16px rgba(10,22,40,0.28)",letterSpacing:0.3,transition:"transform 0.15s"}}
                onMouseEnter={e=>e.target.style.transform="translateY(-1px)"}
                onMouseLeave={e=>e.target.style.transform="translateY(0)"}>
                Ajukan Peminjaman →
              </button>
            </div>
          </div>
        )}

        {/* Form */}
        {section==="form"&&(
          success
            ?<SuccessView booking={success} onReset={gotoSection}/>
            :(showChecklist
                ?<PreFormChecklist onStart={()=>setShowChecklist(false)}/>
                :<BookingForm rooms={rooms} bookings={bookings} onSuccess={setSuccess} prefill={prefill} onClearPrefill={()=>setPrefill(null)}/>
              )
        )}

        {/* Tracker */}
        {section==="tracker"&&(
          <div style={{background:"white",borderRadius:14,padding:"24px 22px",border:`1.5px solid ${BORDER}`,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
            <h3 style={{margin:"0 0 6px",fontSize:18,fontWeight:800,color:NAVY}}>Cek Status Peminjaman</h3>
            <p style={{margin:"0 0 18px",fontSize:13,color:GRAY}}>Masukkan kode booking yang Anda terima via WhatsApp, atau nomor WA PIC.</p>
            <StatusTracker/>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{background:NAVY,color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"16px",fontSize:12,letterSpacing:0.3}}>
        Bagian Protokol & Komunikasi Pimpinan — Pemerintah Kota Tarakan
      </div>
    </div>
  );
}
