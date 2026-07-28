import React from "react";

const SUPA_URL = typeof import.meta !== "undefined" && import.meta.env
  ? (import.meta.env.VITE_SUPABASE_URL || "") : "";
const SUPA_KEY = typeof import.meta !== "undefined" && import.meta.env
  ? (import.meta.env.VITE_SUPABASE_ANON_KEY || "") : "";

export default function WaliKotaAudiensiDashboard({ role, user, showT, isMobile, reloadEvents }) {
  const NAVY = "#0A1628", GREEN = "#0D6B4F", RED = "#991B1B";
  const labelPimpinan = role === "wakilwalikota" ? "Wakil Wali Kota" : "Wali Kota";

  const [guests, setGuests]      = React.useState([]);
  const [loading, setLoading]    = React.useState(true);
  const [expanded, setExpanded]  = React.useState(null);
  const [decideId, setDecideId]  = React.useState(null);
  const [decideMode, setMode]    = React.useState("");
  const [tgl, setTgl]            = React.useState("");
  const [jam, setJam]            = React.useState("");
  const [tempat, setTempat]      = React.useState("Ruang Kerja");
  const [catatanPim, setCatatan] = React.useState("");
  const [alasan, setAlasan]      = React.useState("");
  const [saving, setSaving]      = React.useState(false);
  const [viewTab, setViewTab]    = React.useState("pending"); // "pending" | "terjadwal"

  const BULAN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
  const fmtTs = s => {
    if (!s) return "-";
    const d = new Date(s);
    return d.getDate()+" "+BULAN[d.getMonth()]+" "+d.getFullYear()+", "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
  };
  const PRIORITY = {
    mendesak: { l:"Mendesak", bg:"#FEE2E2", c:"#991B1B" },
    penting:  { l:"Penting",  bg:"#FEF3C7", c:"#92400E" },
    biasa:    { l:"Biasa",    bg:"#D1FAE5", c:"#065F46" },
  };

  const load = () => {
    setLoading(true);
    fetch("/api/guest?action=queue&status=pending_pimpinan&limit=100&pimpinan="+role)
      .then(r => r.json())
      .then(d => setGuests(Array.isArray(d) ? d.sort((a,b) => {
        const po = { mendesak:0, penting:1, biasa:2 };
        return (po[a.prioritas]??2) - (po[b.prioritas]??2)
          || new Date(a.created_at) - new Date(b.created_at);
      }) : []))
      .catch(() => showT("Gagal memuat data", "error"))
      .finally(() => setLoading(false));
  };
  React.useEffect(load, []);

  const doDecide = async () => {
    if (!decideId) return;
    if (decideMode === "approve" && !tgl) { showT("Pilih tanggal jadwal dulu", "warn"); return; }
    if (decideMode === "reject" && !alasan.trim()) { showT("Isi alasan penolakan", "warn"); return; }
    setSaving(true);
    const decidedBy = user?.username || user?.nama || labelPimpinan;
    const tempatFinal = String(tempat||"").trim() || "Ruang Kerja";
    const body = decideMode === "approve"
      ? { id:decideId, response:"approved", responded_by:decidedBy, scheduled_date:tgl, scheduled_time:jam||null, tempat:tempatFinal }
      : { id:decideId, response:"rejected", responded_by:decidedBy, reason:alasan };
    try {
      const r = await fetch("/api/guest?action=respond", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify(body)
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || (j && j.error)) throw new Error(j && j.error ? j.error : "Gagal");

      // Audiensi yang disetujui & terjadwal langsung masuk ke Agenda Kegiatan
      let agendaOk = true;
      if (decideMode==="approve" && tgl && jam && SUPA_URL && SUPA_KEY) {
        const g = guests.find(x => x.id === decideId) || {};
        const pejabatKey = (g.tujuan_pejabat==="Wakil Wali Kota") ? "wakilwalikota" : "walikota";
        const nama = g.nama || g.name || "Tamu";
        const inst = g.instansi || g.organization || "";
        const evId = Date.now();
        const newEvent = {
          id: evId, tanggal: tgl, jam: jam,
          namaAcara: "Audiensi: "+nama+(inst?" ("+inst+")":""),
          penyelenggara: inst||nama,
          kontak: g.no_wa || g.phone || "-",
          buktiUndangan: "Permohonan Tamu #"+(String(decideId).slice(-6)),
          pakaian: "Batik Lengan Panjang", jenisKegiatan:"Menghadiri",
          lokasi: tempatFinal,
          untukPimpinan: [pejabatKey], alur:"disetujui",
          catatan: "Maksud: "+(g.maksud_keperluan||g.purpose||"-")+(g.telaah_kabag?" | Telaah Kabag: "+g.telaah_kabag:""),
          statusWK:  pejabatKey==="walikota"?"hadir":null,
          statusWWK: pejabatKey==="wakilwalikota"?"hadir":null,
          submittedBy: decidedBy, personil:[], evaluasi:{}, created_from:"guest_module", guest_id: decideId,
        };
        try {
          const ra = await fetch(SUPA_URL+"/rest/v1/jadwal",{
            method:"POST",
            headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Prefer":"return=minimal"},
            body: JSON.stringify({id:evId, data:newEvent}),
          });
          if(!ra.ok) agendaOk = false;
        } catch (_) { agendaOk = false; /* keputusan tetap tersimpan */ }
      }

      showT(
        decideMode!=="approve" ? "Permohonan ditolak"
          : agendaOk ? "✅ Audiensi dijadwalkan & masuk Agenda!"
          : "✅ Audiensi dijadwalkan — ⚠ gagal masuk Agenda, sinkronkan manual.",
        decideMode==="approve" ? (agendaOk?"ok":"warn") : "warn"
      );
      setDecideId(null); setMode(""); setTgl(""); setJam(""); setTempat("Ruang Kerja"); setCatatan(""); setAlasan("");
      load();
    } catch { showT("Gagal menyimpan keputusan", "error"); }
    finally { setSaving(false); }
  };

  const openDecide = (id, mode) => {
    setDecideId(id); setMode(mode);
    setTgl(""); setJam(""); setTempat("Ruang Kerja"); setCatatan(""); setAlasan("");
  };

  return (
    <div style={{padding:isMobile?"12px 14px":"20px 28px", overflowY:"auto", flex:1, background:"#F4F7FF"}}>

      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${NAVY},#1A2F50)`,borderRadius:16,padding:"18px 20px",marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
        <div style={{fontSize:32}}>🏛️</div>
        <div>
          <div style={{color:"#C9A84C",fontSize:11,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>Permohonan Audiensi</div>
          <div style={{color:"white",fontSize:18,fontWeight:900}}>{labelPimpinan}</div>
          <div style={{color:"rgba(255,255,255,0.5)",fontSize:12,marginTop:2}}>
            {loading ? "Memuat..." : `${guests.length} permohonan menunggu keputusan`}
          </div>
        </div>
      </div>

      {/* Tab: Menunggu Keputusan | Terjadwal */}
      <div style={{display:"flex",gap:6,marginBottom:14,background:"white",padding:5,borderRadius:12,border:"1px solid #E2E8F0"}}>
        {[["pending","🕐 Menunggu Keputusan"],["terjadwal","📅 Terjadwal"]].map(t=>{
          const act = viewTab===t[0];
          return <button key={t[0]} onClick={()=>setViewTab(t[0])} style={{flex:1,padding:"9px 8px",borderRadius:9,border:"none",cursor:"pointer",fontSize:12.5,fontWeight:800,background:act?NAVY:"transparent",color:act?"white":"#64748B"}}>{t[1]}</button>;
        })}
      </div>

      {viewTab==="terjadwal" && <TerjadwalPimpinan labelPimpinan={labelPimpinan} user={user} showT={showT} PRIORITY={PRIORITY} fmtTs={fmtTs} reloadEvents={reloadEvents}/>}

      {viewTab==="pending" && <>
      {loading && <div style={{textAlign:"center",padding:"40px",color:"#94A3B8"}}>⏳ Mengambil data...</div>}

      {!loading && guests.length === 0 && (
        <div style={{textAlign:"center",padding:"60px 20px",background:"white",borderRadius:16,border:"1px solid #E2E8F0"}}>
          <div style={{fontSize:40,marginBottom:10}}>✅</div>
          <div style={{fontWeight:700,color:"#475569"}}>Tidak ada permohonan yang menunggu</div>
          <div style={{fontSize:12,color:"#94A3B8",marginTop:4}}>Semua permohonan sudah diputuskan</div>
        </div>
      )}

      {guests.map(g => {
        const pr  = PRIORITY[g.prioritas||"biasa"] || PRIORITY.biasa;
        const exp = expanded === g.id;
        const notes = [
          g.catatan_rk   ? { label:"Admin RK",      c:"#0369A1", bg:"#E0F2FE", val:g.catatan_rk }   : null,
        ].filter(Boolean);

        return (
          <div key={g.id} style={{background:"white",borderRadius:14,marginBottom:12,border:"1.5px solid #E2E8F0",boxShadow:"0 2px 10px rgba(10,22,40,0.06)",overflow:"hidden",borderLeft:`4px solid ${pr.c}`}}>

            {/* Card header */}
            <div style={{padding:"14px 16px",cursor:"pointer"}} onClick={()=>setExpanded(exp?null:g.id)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:5,flexWrap:"wrap"}}>
                    <span style={{fontWeight:800,fontSize:14,color:"#0F172A"}}>{g.nama||g.name||"-"}</span>
                    <span style={{background:pr.bg,color:pr.c,fontSize:10,fontWeight:700,borderRadius:5,padding:"2px 7px"}}>{pr.l}</span>
                  </div>
                  <div style={{fontSize:12,color:"#64748B",marginBottom:3}}>🏛 {g.instansi||g.organization||"Perorangan"}</div>
                  <div style={{fontSize:12,color:"#475569"}}>📋 {g.tujuan_pejabat||"-"}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:11,color:"#94A3B8"}}>{fmtTs(g.created_at)}</div>
                  <div style={{fontSize:18,color:"#CBD5E1",marginTop:4}}>{exp?"▲":"▼"}</div>
                </div>
              </div>
            </div>

            {/* Detail panel */}
            {exp && (
              <div style={{borderTop:"1px solid #F1F5F9",padding:"14px 16px",background:"#FAFBFF"}}>

                {/* Maksud & keperluan */}
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:800,color:"#94A3B8",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Maksud & Keperluan</div>
                  <div style={{fontSize:13,color:"#1F2937",lineHeight:1.6,background:"#F8FAFC",borderRadius:8,padding:"10px 12px",border:"1px solid #E2E8F0"}}>
                    {g.maksud_keperluan||g.purpose||"-"}
                  </div>
                </div>

                {/* Telaahan Staf — ditonjolkan untuk pimpinan */}
                {g.telaah_kabag && (
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:10,fontWeight:800,color:"#7C3AED",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>⚖️ Telaahan Staf</div>
                    <div style={{fontSize:13,color:"#3B0764",lineHeight:1.6,background:"#F5F3FF",borderRadius:8,padding:"10px 12px",border:"1.5px solid #DDD6FE",whiteSpace:"pre-wrap"}}>
                      {g.telaah_kabag}
                    </div>
                  </div>
                )}

                {/* Info kontak */}
                <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                  <div style={{background:"#F1F5F9",borderRadius:8,padding:"8px 12px",flex:1,minWidth:140}}>
                    <div style={{fontSize:10,color:"#94A3B8",fontWeight:700}}>📱 WhatsApp</div>
                    <div style={{fontSize:13,fontWeight:700,color:NAVY}}>{g.no_wa||g.phone||"-"}</div>
                  </div>
                  <div style={{background:"#F1F5F9",borderRadius:8,padding:"8px 12px",flex:1,minWidth:140}}>
                    <div style={{fontSize:10,color:"#94A3B8",fontWeight:700}}>📅 Tanggal Masuk</div>
                    <div style={{fontSize:12,color:"#475569"}}>{fmtTs(g.created_at)}</div>
                  </div>
                </div>

                {/* Catatan berjenjang */}
                {notes.length > 0 && (
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:10,fontWeight:800,color:"#94A3B8",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Catatan Berjenjang</div>
                    {notes.map((n,i) => (
                      <div key={i} style={{background:n.bg,borderRadius:8,padding:"8px 12px",marginBottom:6,borderLeft:`3px solid ${n.c}`}}>
                        <span style={{fontSize:10,fontWeight:800,color:n.c}}>{n.label}</span>
                        <div style={{fontSize:12,color:"#1F2937",marginTop:2}}>{n.val}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tombol keputusan */}
                {decideId !== g.id ? (
                  <div style={{display:"flex",gap:8,marginTop:4}}>
                    <button onClick={()=>openDecide(g.id,"approve")} style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:GREEN,color:"white",cursor:"pointer",fontWeight:800,fontSize:13}}>
                      ✅ Setujui & Jadwalkan
                    </button>
                    <button onClick={()=>openDecide(g.id,"reject")} style={{flex:1,padding:"12px",borderRadius:10,border:`1.5px solid #FECACA`,background:"white",color:RED,cursor:"pointer",fontWeight:700,fontSize:13}}>
                      ❌ Tolak
                    </button>
                  </div>
                ) : (
                  <div style={{background:"#F8FAFC",borderRadius:12,padding:"14px",border:"1.5px solid #E2E8F0",marginTop:4}}>
                    <div style={{fontSize:12,fontWeight:800,color:decideMode==="approve"?GREEN:RED,marginBottom:10}}>
                      {decideMode==="approve" ? "✅ Jadwalkan Audiensi" : "❌ Tolak Permohonan"}
                    </div>

                    {decideMode==="approve" ? (<>
                      <div style={{display:"flex",gap:8,marginBottom:8}}>
                        <div style={{flex:2}}>
                          <label style={{display:"block",fontSize:10,fontWeight:700,color:"#64748B",marginBottom:4}}>Tanggal *</label>
                          <input type="date" value={tgl} onChange={e=>setTgl(e.target.value)}
                            style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1.5px solid #CBD5E1",fontSize:13,boxSizing:"border-box"}}/>
                        </div>
                        <div style={{flex:1}}>
                          <label style={{display:"block",fontSize:10,fontWeight:700,color:"#64748B",marginBottom:4}}>Jam WITA</label>
                          <input type="time" value={jam} onChange={e=>setJam(e.target.value)}
                            style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1.5px solid #CBD5E1",fontSize:13,boxSizing:"border-box"}}/>
                        </div>
                      </div>
                      <div style={{marginBottom:10}}>
                        <label style={{display:"block",fontSize:10,fontWeight:700,color:"#64748B",marginBottom:4}}>Tempat</label>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {[["Rumah Jabatan","🏠"],["Ruang Kerja","🏢"]].map(o=>{
                            const act = tempat===o[0];
                            return <button key={o[0]} type="button" onClick={()=>setTempat(o[0])}
                              style={{flex:1,minWidth:100,padding:"9px 6px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,
                                border:"1.5px solid "+(act?NAVY:"#CBD5E1"),background:act?"#EEF2FF":"white",color:act?NAVY:"#64748B"}}>{o[1]} {o[0]}</button>;
                          })}
                          <button type="button" onClick={()=>setTempat("")}
                            style={{flex:1,minWidth:100,padding:"9px 6px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,
                              border:"1.5px solid "+((tempat!=="Rumah Jabatan"&&tempat!=="Ruang Kerja")?NAVY:"#CBD5E1"),background:(tempat!=="Rumah Jabatan"&&tempat!=="Ruang Kerja")?"#EEF2FF":"white",color:(tempat!=="Rumah Jabatan"&&tempat!=="Ruang Kerja")?NAVY:"#64748B"}}>✏️ Lainnya</button>
                        </div>
                        {(tempat!=="Rumah Jabatan"&&tempat!=="Ruang Kerja") && (
                          <input type="text" value={tempat} onChange={e=>setTempat(e.target.value)}
                            placeholder="Tulis tempat, mis. Pendopo / Ruang Rapat Lt.2..."
                            style={{width:"100%",marginTop:6,padding:"9px 10px",borderRadius:8,border:"1.5px solid #CBD5E1",fontSize:13,boxSizing:"border-box"}}/>
                        )}
                      </div>
                      <div style={{marginBottom:10}}>
                        <label style={{display:"block",fontSize:10,fontWeight:700,color:"#64748B",marginBottom:4}}>Catatan Khusus Pimpinan (opsional)</label>
                        <textarea value={catatanPim} onChange={e=>setCatatan(e.target.value)} rows={2}
                          placeholder="Misal: harap bawa proposal tertulis..."
                          style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1.5px solid #CBD5E1",fontSize:13,resize:"vertical",boxSizing:"border-box"}}/>
                      </div>
                    </>) : (<>
                      <div style={{marginBottom:10}}>
                        <label style={{display:"block",fontSize:10,fontWeight:700,color:"#64748B",marginBottom:4}}>Alasan Penolakan *</label>
                        <textarea value={alasan} onChange={e=>setAlasan(e.target.value)} rows={2}
                          placeholder="Tuliskan alasan singkat..."
                          style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1.5px solid #FECACA",fontSize:13,resize:"vertical",boxSizing:"border-box"}}/>
                      </div>
                    </>)}

                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>{setDecideId(null);setMode("");}} style={{flex:1,padding:"10px",borderRadius:9,border:"1.5px solid #E2E8F0",background:"white",color:"#64748B",cursor:"pointer",fontWeight:700}}>
                        Batal
                      </button>
                      <button onClick={doDecide} disabled={saving} style={{flex:2,padding:"10px",borderRadius:9,border:"none",background:decideMode==="approve"?GREEN:RED,color:"white",cursor:"pointer",fontWeight:800,fontSize:13,opacity:saving?0.6:1}}>
                        {saving ? "Menyimpan..." : decideMode==="approve" ? "Konfirmasi Jadwal" : "Konfirmasi Tolak"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      </>}
    </div>
  );
}

// ── Terjadwal: WK/Wakil mengedit jam & tempat audiensi yang sudah disetujui ──
function TerjadwalPimpinan({ labelPimpinan, user, showT, PRIORITY, fmtTs, reloadEvents }) {
  const NAVY = "#0A1628", GREEN = "#0D6B4F";
  const [list, setList]       = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [editId, setEditId]   = React.useState(null);
  const [eTgl, setETgl]       = React.useState("");
  const [eJam, setEJam]       = React.useState("");
  const [eTempat, setETempat] = React.useState("Ruang Kerja");
  const [saving, setSaving]   = React.useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/guest?action=queue&status=approved&limit=100&pimpinan="+(labelPimpinan==="Wakil Wali Kota"?"wakilwalikota":"walikota"))
      .then(r => r.json())
      .then(d => setList((Array.isArray(d)?d:[]).filter(g => g.tujuan_pejabat===labelPimpinan)
        .sort((a,b)=>((a.jadwal_tanggal||"")+(a.jadwal_jam||"")).localeCompare((b.jadwal_tanggal||"")+(b.jadwal_jam||"")))))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };
  React.useEffect(load, [labelPimpinan]);

  const openEdit = (g) => {
    setEditId(g.id);
    setETgl(g.jadwal_tanggal || "");
    setEJam(g.jadwal_jam || "");
    setETempat("Ruang Kerja");
  };

  const simpan = async (g) => {
    if(!eTgl || !eJam){ showT("Isi tanggal & jam", "warn"); return; }
    const tempatFinal = String(eTempat||"").trim() || "Ruang Kerja";
    setSaving(true);
    try {
      const r = await fetch("/api/guest?action=update_jadwal", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ id:g.id, scheduled_date:eTgl, scheduled_time:eJam, tempat:tempatFinal, updated_by:user?.username }),
      });
      const j = await r.json().catch(()=>({}));
      if(!r.ok || (j && j.error)) throw new Error(j && j.error ? j.error : "Gagal");

      // Agenda kini disesuaikan oleh backend — di sini cukup laporkan hasilnya
      const ag = (j && j.agenda) || {};
      if(ag.error)       showT("✅ Jadwal tamu tersimpan — ⚠ agenda gagal disesuaikan, sinkronkan manual", "warn");
      else if(!ag.linked) showT("✅ Jadwal & tempat diperbarui — belum ada agenda tertaut", "warn");
      else                showT("✅ Jadwal, tempat & agenda diperbarui"+(ag.removed?" ("+ag.removed+" agenda ganda dirapikan)":""), "ok");

      if(reloadEvents) reloadEvents();   // agar tab Agenda langsung ikut berubah
      setEditId(null);
      load();
    } catch(e){ showT("Gagal: "+e.message, "error"); }
    finally { setSaving(false); }
  };

  const inp = { width:"100%", padding:"9px 10px", borderRadius:8, border:"1.5px solid #CBD5E1", fontSize:13, boxSizing:"border-box" };
  const isLain = (v) => v!=="Rumah Jabatan" && v!=="Ruang Kerja";

  if(loading) return <div style={{textAlign:"center",padding:"40px",color:"#94A3B8"}}>⏳ Mengambil data...</div>;
  if(list.length===0) return (
    <div style={{textAlign:"center",padding:"50px 20px",background:"white",borderRadius:16,border:"1px solid #E2E8F0"}}>
      <div style={{fontSize:36,marginBottom:8}}>📅</div>
      <div style={{fontWeight:700,color:"#475569"}}>Belum ada audiensi terjadwal</div>
    </div>
  );

  return (
    <div>
      {list.map(g => {
        const pr = PRIORITY[g.prioritas||"biasa"] || PRIORITY.biasa;
        const ed = editId===g.id;
        return (
          <div key={g.id} style={{background:"white",borderRadius:14,marginBottom:12,border:"1.5px solid #E2E8F0",overflow:"hidden",borderLeft:`4px solid ${pr.c}`}}>
            <div style={{padding:"14px 16px"}}>
              <div style={{fontWeight:800,fontSize:14,color:"#0F172A",marginBottom:3}}>{g.nama||g.name||"-"}</div>
              <div style={{fontSize:12,color:"#64748B",marginBottom:6}}>🏛 {g.instansi||g.organization||"Perorangan"}</div>
              <div style={{fontSize:13,color:GREEN,fontWeight:700}}>
                🗓️ {g.jadwal_tanggal ? fmtTs(g.jadwal_tanggal+"T00:00:00") : "-"}{g.jadwal_jam?" · "+g.jadwal_jam+" WITA":""}
              </div>

              {!ed ? (
                <button onClick={()=>openEdit(g)} style={{marginTop:10,padding:"9px 14px",borderRadius:9,border:"1.5px solid #CBD5E1",background:"white",color:NAVY,cursor:"pointer",fontSize:12.5,fontWeight:800}}>
                  ✏️ Edit Jam &amp; Tempat
                </button>
              ) : (
                <div style={{marginTop:12,background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,padding:"12px"}}>
                  <div style={{display:"flex",gap:8,marginBottom:8}}>
                    <div style={{flex:2}}>
                      <label style={{display:"block",fontSize:10,fontWeight:700,color:"#64748B",marginBottom:4}}>Tanggal</label>
                      <input type="date" value={eTgl} onChange={e=>setETgl(e.target.value)} style={inp}/>
                    </div>
                    <div style={{flex:1}}>
                      <label style={{display:"block",fontSize:10,fontWeight:700,color:"#64748B",marginBottom:4}}>Jam WITA</label>
                      <input type="time" value={eJam} onChange={e=>setEJam(e.target.value)} style={inp}/>
                    </div>
                  </div>
                  <label style={{display:"block",fontSize:10,fontWeight:700,color:"#64748B",marginBottom:4}}>Tempat</label>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:isLain(eTempat)?6:0}}>
                    {[["Rumah Jabatan","🏠"],["Ruang Kerja","🏢"]].map(o=>{
                      const act = eTempat===o[0];
                      return <button key={o[0]} type="button" onClick={()=>setETempat(o[0])} style={{flex:1,minWidth:100,padding:"9px 6px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,border:"1.5px solid "+(act?NAVY:"#CBD5E1"),background:act?"#EEF2FF":"white",color:act?NAVY:"#64748B"}}>{o[1]} {o[0]}</button>;
                    })}
                    <button type="button" onClick={()=>setETempat("")} style={{flex:1,minWidth:100,padding:"9px 6px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,border:"1.5px solid "+(isLain(eTempat)?NAVY:"#CBD5E1"),background:isLain(eTempat)?"#EEF2FF":"white",color:isLain(eTempat)?NAVY:"#64748B"}}>✏️ Lainnya</button>
                  </div>
                  {isLain(eTempat) && (
                    <input type="text" value={eTempat} onChange={e=>setETempat(e.target.value)} placeholder="Tulis tempat..." style={{...inp, marginBottom:0}}/>
                  )}
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button onClick={()=>setEditId(null)} style={{flex:1,padding:"9px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"white",color:"#64748B",cursor:"pointer",fontWeight:700,fontSize:12.5}}>Batal</button>
                    <button onClick={()=>simpan(g)} disabled={saving} style={{flex:2,padding:"9px",borderRadius:8,border:"none",background:GREEN,color:"white",cursor:"pointer",fontWeight:800,fontSize:12.5,opacity:saving?0.6:1}}>{saving?"Menyimpan...":"💾 Simpan Perubahan"}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}