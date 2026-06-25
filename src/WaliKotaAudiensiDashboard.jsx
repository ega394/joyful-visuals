import React from "react";

const SUPA_URL = typeof import.meta !== "undefined" && import.meta.env
  ? (import.meta.env.VITE_SUPABASE_URL || "") : "";
const SUPA_KEY = typeof import.meta !== "undefined" && import.meta.env
  ? (import.meta.env.VITE_SUPABASE_ANON_KEY || "") : "";

export default function WaliKotaAudiensiDashboard({ role, user, showT, isMobile }) {
  const NAVY = "#0A1628", GREEN = "#0D6B4F", RED = "#991B1B";
  const labelPimpinan = role === "wakilwalikota" ? "Wakil Wali Kota" : "Wali Kota";

  const [guests, setGuests]      = React.useState([]);
  const [loading, setLoading]    = React.useState(true);
  const [expanded, setExpanded]  = React.useState(null);
  const [decideId, setDecideId]  = React.useState(null);
  const [decideMode, setMode]    = React.useState("");
  const [tgl, setTgl]            = React.useState("");
  const [jam, setJam]            = React.useState("");
  const [catatanPim, setCatatan] = React.useState("");
  const [alasan, setAlasan]      = React.useState("");
  const [saving, setSaving]      = React.useState(false);

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
    fetch("/api/guest?action=queue&status=pending_pimpinan&limit=100")
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
    const body = decideMode === "approve"
      ? { id:decideId, response:"approved", responded_by:decidedBy, scheduled_date:tgl, scheduled_time:jam||null }
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
          lokasi: "Ruang Pimpinan, Kantor Wali Kota Tarakan",
          untukPimpinan: [pejabatKey], alur:"disetujui",
          catatan: "Maksud: "+(g.maksud_keperluan||g.purpose||"-")+(g.telaah_kabag?" | Telaah Kabag: "+g.telaah_kabag:""),
          statusWK:  pejabatKey==="walikota"?"hadir":null,
          statusWWK: pejabatKey==="wakilwalikota"?"hadir":null,
          submittedBy: decidedBy, personil:[], evaluasi:{}, created_from:"guest_module",
        };
        try {
          await fetch(SUPA_URL+"/rest/v1/jadwal",{
            method:"POST",
            headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Prefer":"return=minimal"},
            body: JSON.stringify({id:evId, data:newEvent}),
          });
        } catch (_) { /* agenda gagal dibuat tidak membatalkan keputusan */ }
      }

      showT(decideMode==="approve" ? "✅ Audiensi dijadwalkan & masuk Agenda!" : "Permohonan ditolak", decideMode==="approve"?"ok":"warn");
      setDecideId(null); setMode(""); setTgl(""); setJam(""); setCatatan(""); setAlasan("");
      load();
    } catch { showT("Gagal menyimpan keputusan", "error"); }
    finally { setSaving(false); }
  };

  const openDecide = (id, mode) => {
    setDecideId(id); setMode(mode);
    setTgl(""); setJam(""); setCatatan(""); setAlasan("");
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
          g.telaah_kabag ? { label:"Telaahan Staf", c:"#92400E", bg:"#FEF3C7", val:g.telaah_kabag } : null,
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
    </div>
  );
}