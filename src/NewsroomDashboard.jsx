import React, { useState } from "react";

// ═══════════════════════════════════════════════════════════════
//  NEWSROOM DASHBOARD — Prokopim Hibot v2.0
//  Timkom → draft caption berita → ajukan ke Kasubbag
//  Kasubbag → review → setujui → AI generate caption WK/WWK
//  Kabag → monitor (kembalikan jika darurat)
//  WK/WWK → lihat caption di kartu agenda (ProkopimApp.jsx)
// ═══════════════════════════════════════════════════════════════

const NAMA_WK  = "dr. H. Khairul, M.Kes.";
const NAMA_WWK = "Ibnu Saud Is";
const KOTA     = "Kota Tarakan";

function buildPromptBerita(ev, poin) {
  const hadirWK  = (ev.untukPimpinan||[]).includes("walikota") && !ev.delegasiKeWWK;
  const hadirWWK = (ev.untukPimpinan||[]).includes("wakilwalikota") || ev.delegasiKeWWK;
  const pimpinan = hadirWK && hadirWWK
    ? `Wali Kota Tarakan, ${NAMA_WK}, bersama Wakil Wali Kota ${NAMA_WWK}`
    : ev.delegasiKeWWK
    ? `Mewakili Wali Kota Tarakan, Wakil Wali Kota ${NAMA_WWK}`
    : hadirWK
    ? `Wali Kota Tarakan, ${NAMA_WK},`
    : `Wakil Wali Kota Tarakan, ${NAMA_WWK},`;

  return `Kamu adalah staf Humas Prokopim Kota Tarakan. Tulis caption Instagram dengan gaya akun @humas_tarakan:
- Diawali "Tarakan —"
- Pimpinan yang hadir: "${pimpinan}"
- Kata kerja formal: menghadiri, membuka, menyerahkan, menegaskan
- Paragraf 1: siapa-apa-kapan-di mana. Paragraf 2: poin penting dari lapangan.
- Akhiri dengan #TarakanHibot #KotaTarakan
- Tone formal, informatif, netral positif. Panjang 5-8 kalimat.

Nama acara: ${ev.namaAcara}
Tanggal: ${ev.tanggal}
Lokasi: ${ev.lokasi||KOTA}
Penyelenggara: ${ev.penyelenggara||"-"}
Poin penting: ${poin}

Tulis hanya caption-nya saja.`;
}

function buildPromptPimpinan(ev, captionBerita, isWWK) {
  const jabatan = isWWK ? `Wakil Wali Kota Tarakan, ${NAMA_WWK}` : `Wali Kota Tarakan, ${NAMA_WK}`;
  return `Kamu adalah ${jabatan}. Ubah caption berita ini menjadi caption Instagram orang pertama.
Gaya: hangat, rendah hati, berbicara langsung ke warga.
Diawali "Hari ini saya..." atau "Alhamdulillah..." atau "Bersama..."
Pesan personal yang relevan. Panjang 4-6 kalimat.
Akhiri dengan #TarakanHibot #KotaTarakan

Caption berita:
${captionBerita}

Tulis hanya caption orang pertama-nya saja.`;
}

export default function NewsroomDashboard({ events, user, showT, isMobile, upd }) {
  const NAVY = "#0A1628", GOLD = "#C9A84C", GREEN = "#059669";
  const role = user?.role || "";
  const isTimkom   = role === "timkom";
  const isKasubbag = role === "kasubbag_komdokpim";
  const isKabag    = role === "kabag";
  // Kasubbag Komdokpim juga bisa draft caption (bukan hanya Timkom)
  const canDraft   = isTimkom || isKasubbag;

  const [selectedEv,    setSelectedEv]    = useState(null);
  const [activeTab,     setActiveTab]     = useState("caption");
  const [poinPenting,   setPoinPenting]   = useState("");
  const [loadingAI,     setLoadingAI]     = useState(false);
  const [captionBerita, setCaptionBerita] = useState("");
  const [captionWK,     setCaptionWK]     = useState("");
  const [captionWWK,    setCaptionWWK]    = useState("");
  const [catatanReview, setCatatanReview] = useState("");
  const [teksBerita,    setTeksBerita]    = useState("");
  const [catatanBerita, setCatatanBerita] = useState("");

  const jadwal = events
    .filter(e => e.alur === "disetujui")
    .sort((a,b) => new Date(b.tanggal)-new Date(a.tanggal))
    .slice(0, 60);

  const fmtDate = d => {
    if (!d) return "";
    const [y,m,dd] = d.split("-");
    const M=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    return `${dd} ${M[parseInt(m)-1]} ${y}`;
  };
  const isPast = ev => new Date(ev.tanggal+"T"+(ev.jam||"23:59")) < new Date();

  const getBeritaData = ev => {
    let d = ev.evaluasi;
    if (typeof d==="string"){try{d=JSON.parse(d);}catch{d={};}}
    return d||{};
  };

  const openEditor = ev => {
    const bd = getBeritaData(ev);
    setSelectedEv(ev);
    setTeksBerita(bd.news_text||"");
    setCatatanBerita(bd.news_notes||"");
    setCaptionBerita(ev.captionBerita||"");
    setCaptionWK(ev.captionWK||"");
    setCaptionWWK(ev.captionWWK||"");
    setCatatanReview(ev.captionCatatan||"");
    setPoinPenting("");
    setActiveTab("caption");
  };

  const callAI = async (systemPrompt, extra={}) => {
    const res = await fetch("/api/ai-newsroom", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ namaAcara: selectedEv?.namaAcara, systemPrompt, ...extra })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error||"Gagal");
    return data.result || data.text || "";
  };

  const generateCaptionBerita = async () => {
    if (!poinPenting.trim()) { showT("Isi poin penting dulu","warn"); return; }
    setLoadingAI(true);
    try {
      const result = await callAI(buildPromptBerita(selectedEv, poinPenting), {format:"caption"});
      setCaptionBerita(result);
      showT("Caption berita berhasil di-generate ✨");
    } catch(err) {
      showT("AI error: "+err.message,"warn");
      setCaptionBerita(`Tarakan — Wali Kota Tarakan menghadiri ${selectedEv.namaAcara} di ${selectedEv.lokasi||KOTA} pada ${fmtDate(selectedEv.tanggal)}.\n\n${poinPenting}\n\n#TarakanHibot #KotaTarakan`);
    } finally { setLoadingAI(false); }
  };

  const generateCaptionPimpinan = async () => {
    if (!captionBerita.trim()) { showT("Caption berita belum ada","warn"); return; }
    setLoadingAI(true);
    try {
      const hadirWK  = (selectedEv.untukPimpinan||[]).includes("walikota") && !selectedEv.delegasiKeWWK;
      const hadirWWK = (selectedEv.untukPimpinan||[]).includes("wakilwalikota") || selectedEv.delegasiKeWWK;
      let wk="", wwk="";
      if (hadirWK || (!hadirWK&&!hadirWWK)) {
        wk = await callAI(buildPromptPimpinan(selectedEv, captionBerita, false));
        setCaptionWK(wk);
      }
      if (hadirWWK) {
        wwk = await callAI(buildPromptPimpinan(selectedEv, captionBerita, true));
        setCaptionWWK(wwk);
      }
      showT("Caption WK/WWK berhasil di-generate ✨");
      return { wk, wwk };
    } catch(err) {
      showT("Gagal generate caption pimpinan: "+err.message,"warn");
      return { wk:"", wwk:"" };
    } finally { setLoadingAI(false); }
  };

  const saveCaption = async action => {
    let patch = {};
    if (action==="draft") {
      patch = { captionBerita, captionStatus:"draft" };
      showT("Draft tersimpan");
    } else if (action==="ajukan") {
      if (!captionBerita.trim()) { showT("Caption berita belum diisi","warn"); return; }
      patch = { captionBerita, captionStatus:"menunggu", captionCatatan:"" };
      showT("Caption diajukan ke Kasubbag Komdokpim ✓");
    } else if (action==="setujui") {
      setLoadingAI(true);
      const { wk, wwk } = await generateCaptionPimpinan();
      patch = {
        captionBerita, captionWK: wk||captionWK, captionWWK: wwk||captionWWK,
        captionStatus:"disetujui", captionCatatan: catatanReview
      };
      showT("Caption disetujui & caption WK/WWK tersimpan ✓");
    } else if (action==="revisi") {
      if (!catatanReview.trim()) { showT("Tulis catatan revisi dulu","warn"); return; }
      patch = { captionStatus:"revisi", captionCatatan: catatanReview };
      showT("Dikembalikan ke Timkom untuk revisi","warn");
    } else if (action==="kembalikan") {
      if (!catatanReview.trim()) { showT("Tulis alasan darurat dulu","warn"); return; }
      patch = { captionStatus:"revisi", captionCatatan:"[Kabag] "+catatanReview };
      showT("Caption dikembalikan (darurat)","warn");
    }
    if (upd && Object.keys(patch).length>0) { upd(selectedEv.id, patch); setSelectedEv(null); }
  };

  const saveBerita = ns => {
    if (!upd) { showT("Fungsi simpan belum terhubung","error"); return; }
    if (!teksBerita.trim() && ns!=="draft") { showT("Teks berita kosong","warn"); return; }
    const bd = getBeritaData(selectedEv);
    upd(selectedEv.id, { evaluasi:{ ...bd, news_text:teksBerita, news_status:ns, news_notes:catatanBerita, news_updated_by:user?.username }});
    showT(ns==="review"?"Dikirim ke Kasubbag ✓":"Tersimpan ✓");
    setSelectedEv(null);
  };

  const Badge = ({st,size=10}) => {
    const m = {draft:{bg:"#F1F5F9",c:"#64748B",l:"Draft"},menunggu:{bg:"#FEF3C7",c:"#92400E",l:"⏳ Menunggu Review"},disetujui:{bg:"#D1FAE5",c:"#065F46",l:"✅ Disetujui"},revisi:{bg:"#FEE2E2",c:"#991B1B",l:"⟲ Perlu Revisi"},review:{bg:"#FEF3C7",c:"#92400E",l:"⏳ Menunggu"},approved:{bg:"#D1FAE5",c:"#065F46",l:"✅ Disetujui"}};
    const s = m[st]||m.draft;
    return <span style={{background:s.bg,color:s.c,padding:`${size===10?"3px 8px":"4px 11px"}`,borderRadius:20,fontSize:size,fontWeight:800}}>{s.l}</span>;
  };

  // ══ EDITOR ══════════════════════════════════════════════
  if (selectedEv) {
    const bd = getBeritaData(selectedEv);
    const stB = bd.news_status||"draft";
    const stC = selectedEv.captionStatus||"draft";

    return (
      <div style={{padding:isMobile?"14px":"24px",maxWidth:800,margin:"0 auto",paddingBottom:80}}>
        <button onClick={()=>setSelectedEv(null)} style={{background:"transparent",border:"none",color:NAVY,fontWeight:700,cursor:"pointer",marginBottom:16,fontSize:14}}>← Kembali</button>

        {/* Header acara */}
        <div style={{background:"white",borderRadius:14,padding:"16px 20px",border:"1px solid #E2E8F0",marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
          <div style={{fontSize:11,color:GOLD,fontWeight:800,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Target Liputan</div>
          <div style={{fontSize:17,fontWeight:900,color:NAVY,marginBottom:4}}>{selectedEv.namaAcara}</div>
          <div style={{fontSize:12,color:"#64748B"}}>📅 {fmtDate(selectedEv.tanggal)} · 📍 {selectedEv.lokasi||KOTA}</div>
          {!isPast(selectedEv)&&<div style={{marginTop:8,fontSize:11,color:"#F59E0B",fontWeight:700}}>⏳ Acara belum selesai — bisa disiapkan lebih awal</div>}
        </div>

        {/* Tab switch */}
        <div style={{display:"flex",gap:3,background:"#F1F5F9",borderRadius:12,padding:3,marginBottom:16}}>
          {[{v:"caption",l:"📱 Caption Instagram"},{v:"berita",l:"📰 Rilis Berita"}].map(t=>(
            <button key={t.v} onClick={()=>setActiveTab(t.v)}
              style={{flex:1,padding:"9px",borderRadius:9,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,
                background:activeTab===t.v?NAVY:"transparent",color:activeTab===t.v?"white":"#64748B",transition:"all 0.15s"}}>{t.l}</button>
          ))}
        </div>

        {/* ── Caption Instagram Tab ── */}
        {activeTab==="caption"&&<>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <Badge st={stC} size={11}/>
            {stC==="revisi"&&selectedEv.captionCatatan&&<div style={{flex:1,background:"#FFF1F2",borderRadius:8,padding:"6px 12px",fontSize:12,color:"#B91C1C",fontWeight:600}}>📝 {selectedEv.captionCatatan}</div>}
          </div>

          {/* Poin penting & generate (Timkom, draft/revisi) */}
          {canDraft&&(stC==="draft"||stC==="revisi")&&(
            <div style={{background:"#F8FAFC",borderRadius:14,padding:"16px",border:"1px solid #E2E8F0",marginBottom:14}}>
              <label style={{display:"block",fontSize:13,fontWeight:700,color:NAVY,marginBottom:8}}>Poin Penting dari Lapangan 📝</label>
              <textarea value={poinPenting} onChange={e=>setPoinPenting(e.target.value)}
                placeholder="Contoh: WK serahkan bantuan ke 50 nelayan, dihadiri Dandim, sambutan positif warga..."
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #CBD5E1",minHeight:80,fontSize:13,fontFamily:"inherit",boxSizing:"border-box",marginBottom:10}}/>
              <button onClick={generateCaptionBerita} disabled={loadingAI}
                style={{width:"100%",padding:"11px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#0A1628,#1A305E)",color:"white",fontWeight:800,fontSize:13,cursor:loadingAI?"not-allowed":"pointer",opacity:loadingAI?0.7:1}}>
                {loadingAI?"⏳ Meracik caption...":"✨ Generate Draft Caption via AI"}
              </button>
            </div>
          )}

          {/* Editor caption berita */}
          <div style={{background:"white",borderRadius:14,padding:"16px",border:"1px solid #E2E8F0",marginBottom:14,boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:800,color:NAVY}}>📰 Caption Berita (Sudut Wartawan)</div>
              {captionBerita&&<button onClick={()=>{navigator.clipboard.writeText(captionBerita);showT("Disalin!");}}
                style={{padding:"5px 10px",borderRadius:7,border:"none",background:"#F1F5F9",color:NAVY,fontWeight:700,cursor:"pointer",fontSize:11}}>📋 Salin</button>}
            </div>
            <textarea value={captionBerita} onChange={e=>setCaptionBerita(e.target.value)}
              disabled={isKabag||stC==="disetujui"}
              placeholder={isTimkom?"Tulis atau generate caption berita di sini...":"Caption belum diajukan Timkom"}
              style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #E2E8F0",minHeight:180,fontSize:13,lineHeight:1.7,fontFamily:"inherit",boxSizing:"border-box",
                background:isKabag||stC==="disetujui"?"#F8FAFC":"white"}}/>
          </div>

          {/* Caption WK/WWK */}
          {(stC==="disetujui"||(isKasubbag&&stC==="menunggu"))&&<>
            {isKasubbag&&stC==="menunggu"&&(
              <div style={{background:"#F0FDF4",borderRadius:12,padding:"14px",border:"1px solid #86EFAC",marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,color:"#065F46",marginBottom:6}}>🤖 Generate Caption Versi Pimpinan</div>
                <div style={{fontSize:11,color:"#475569",marginBottom:10}}>AI akan generate dari caption berita di atas, disesuaikan siapa yang hadir.</div>
                <button onClick={generateCaptionPimpinan} disabled={loadingAI}
                  style={{width:"100%",padding:"10px",borderRadius:9,border:"none",background:GREEN,color:"white",fontWeight:800,fontSize:12,cursor:loadingAI?"not-allowed":"pointer",opacity:loadingAI?0.7:1}}>
                  {loadingAI?"⏳ Generating...":"✨ Generate Caption WK/WWK via AI"}
                </button>
              </div>
            )}
            {captionWK&&(
              <div style={{background:"white",borderRadius:14,padding:"16px",border:"1.5px solid #BFDBFE",marginBottom:12,boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:800,color:"#1D4ED8"}}>👤 Caption Wali Kota (Orang Pertama)</div>
                  <button onClick={()=>{navigator.clipboard.writeText(captionWK);showT("Caption WK disalin!");}}
                    style={{padding:"5px 10px",borderRadius:7,border:"none",background:"#EFF6FF",color:"#1D4ED8",fontWeight:700,cursor:"pointer",fontSize:11}}>📋 Salin</button>
                </div>
                <div style={{fontSize:13,lineHeight:1.7,color:"#1E293B",background:"#F8FBFF",padding:"12px",borderRadius:9,whiteSpace:"pre-wrap"}}>{captionWK}</div>
              </div>
            )}
            {captionWWK&&(
              <div style={{background:"white",borderRadius:14,padding:"16px",border:"1.5px solid #C4B5FD",marginBottom:12,boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:800,color:"#6D28D9"}}>👤 Caption Wakil Wali Kota (Orang Pertama)</div>
                  <button onClick={()=>{navigator.clipboard.writeText(captionWWK);showT("Caption WWK disalin!");}}
                    style={{padding:"5px 10px",borderRadius:7,border:"none",background:"#F5F3FF",color:"#6D28D9",fontWeight:700,cursor:"pointer",fontSize:11}}>📋 Salin</button>
                </div>
                <div style={{fontSize:13,lineHeight:1.7,color:"#1E293B",background:"#FAF8FF",padding:"12px",borderRadius:9,whiteSpace:"pre-wrap"}}>{captionWWK}</div>
              </div>
            )}
          </>}

          {/* Catatan review */}
          {(isKasubbag||isKabag)&&stC!=="draft"&&(
            <div style={{background:"#FFFBEB",borderRadius:14,padding:"14px",border:"1.5px solid #FDE68A",marginBottom:14}}>
              <label style={{display:"block",fontSize:13,fontWeight:800,color:"#92400E",marginBottom:8}}>
                {isKabag?"⚠️ Alasan Kembalikan (Darurat)":"📌 Catatan Review"}
              </label>
              <textarea value={catatanReview} onChange={e=>setCatatanReview(e.target.value)}
                disabled={stC==="disetujui"&&!isKabag}
                placeholder={isKabag?"Tulis alasan darurat...":isKasubbag?"Tulis koreksi atau instruksi revisi...":"-"}
                style={{width:"100%",padding:"10px",borderRadius:8,border:"1px solid #FCD34D",minHeight:60,fontSize:13,fontFamily:"inherit",boxSizing:"border-box",background:"white"}}/>
            </div>
          )}

          {/* Tombol aksi */}
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {canDraft&&(stC==="draft"||stC==="revisi")&&<>
              <button onClick={()=>saveCaption("draft")}
                style={{padding:"12px 16px",borderRadius:11,border:"1.5px solid #E2E8F0",background:"white",color:"#64748B",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                💾 Simpan Draft
              </button>
              <button onClick={()=>saveCaption("ajukan")}
                style={{flex:1,padding:"13px",borderRadius:11,border:"none",background:NAVY,color:"white",fontWeight:800,fontSize:13,cursor:"pointer"}}>
                📤 Ajukan ke Kasubbag Komdokpim
              </button>
            </>}
            {isKasubbag&&stC==="menunggu"&&<>
              <button onClick={()=>saveCaption("setujui")} disabled={loadingAI}
                style={{flex:2,padding:"13px",borderRadius:11,border:"none",background:GREEN,color:"white",fontWeight:800,fontSize:13,cursor:"pointer",opacity:loadingAI?0.7:1}}>
                {loadingAI?"⏳ Menyimpan...":"✅ Setujui & Simpan Caption WK/WWK"}
              </button>
              <button onClick={()=>saveCaption("revisi")}
                style={{flex:1,padding:"13px",borderRadius:11,border:"1.5px solid #EF4444",background:"white",color:"#DC2626",fontWeight:800,fontSize:13,cursor:"pointer"}}>
                ↩ Kembalikan
              </button>
            </>}
            {isKabag&&stC==="disetujui"&&(
              <button onClick={()=>saveCaption("kembalikan")}
                style={{flex:1,padding:"13px",borderRadius:11,border:"1.5px solid #F59E0B",background:"white",color:"#B45309",fontWeight:800,fontSize:13,cursor:"pointer"}}>
                ⚠️ Kembalikan (Darurat)
              </button>
            )}
            {stC==="disetujui"&&!isKabag&&<div style={{flex:1,padding:"12px",textAlign:"center",borderRadius:11,background:"#F0FDF4",color:"#065F46",fontWeight:700,fontSize:13}}>✅ Caption sudah disetujui</div>}
            {stC==="menunggu"&&canDraft&&!isKasubbag&&<div style={{flex:1,padding:"12px",textAlign:"center",borderRadius:11,background:"#FFFBEB",color:"#92400E",fontWeight:700,fontSize:13}}>⏳ Caption sedang direview Kasubbag Komdokpim</div>}
          </div>
        </>}

        {/* ── Berita/Rilis Tab ── */}
        {activeTab==="berita"&&<>
          <div style={{background:"white",borderRadius:14,padding:"16px",border:"1px solid #E2E8F0",marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:800,color:NAVY}}>📰 Teks Rilis / Berita Web</div>
              {teksBerita&&<button onClick={()=>{navigator.clipboard.writeText(teksBerita);showT("Disalin!");}}
                style={{padding:"5px 10px",borderRadius:7,border:"none",background:"#F1F5F9",color:NAVY,fontWeight:700,cursor:"pointer",fontSize:11}}>📋 Salin</button>}
            </div>
            <textarea value={teksBerita} onChange={e=>setTeksBerita(e.target.value)}
              disabled={isKabag||stB==="approved"}
              placeholder="Tulis naskah berita lengkap di sini..."
              style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #E2E8F0",minHeight:250,fontSize:13,lineHeight:1.7,fontFamily:"inherit",boxSizing:"border-box",
                background:isKabag||stB==="approved"?"#F8FAFC":"white"}}/>
          </div>
          {(isKasubbag||bd.news_notes)&&(
            <div style={{background:"#FFFBEB",borderRadius:12,padding:"14px",border:"1.5px solid #FDE68A",marginBottom:14}}>
              <label style={{display:"block",fontSize:13,fontWeight:800,color:"#92400E",marginBottom:8}}>📌 Catatan Kasubbag</label>
              <textarea value={catatanBerita} onChange={e=>setCatatanBerita(e.target.value)}
                disabled={!isKasubbag||stB==="approved"}
                placeholder={isKasubbag?"Tulis koreksi atau instruksi revisi...":"-"}
                style={{width:"100%",padding:"10px",borderRadius:8,border:"1px solid #FCD34D",minHeight:60,fontSize:13,fontFamily:"inherit",boxSizing:"border-box",background:isKasubbag?"white":"transparent"}}/>
            </div>
          )}
          <div style={{display:"flex",gap:10}}>
            {canDraft&&(stB==="draft"||stB==="revisi"||!stB)&&(
              <button onClick={()=>saveBerita("review")} style={{flex:1,padding:"13px",borderRadius:11,border:"none",background:NAVY,color:"white",fontWeight:800,fontSize:13,cursor:"pointer"}}>📤 Ajukan ke Kasubbag</button>
            )}
            {isKasubbag&&stB==="review"&&<>
              <button onClick={()=>saveBerita("approved")} style={{flex:2,padding:"13px",borderRadius:11,border:"none",background:GREEN,color:"white",fontWeight:800,fontSize:13,cursor:"pointer"}}>✅ Setujui Publikasi</button>
              <button onClick={()=>saveBerita("revisi")} style={{flex:1,padding:"13px",borderRadius:11,border:"1.5px solid #EF4444",background:"white",color:"#DC2626",fontWeight:800,fontSize:13,cursor:"pointer"}}>↩ Revisi</button>
            </>}
            {isKabag&&<div style={{flex:1,padding:"12px",textAlign:"center",borderRadius:11,background:"#F1F5F9",color:"#64748B",fontWeight:700,fontSize:13}}>Mode Pemantauan</div>}
          </div>
        </>}
      </div>
    );
  }

  // ══ DAFTAR VIEW ═════════════════════════════════════════
  const getCapBadge = ev => {
    const st = ev.captionStatus||"draft";
    if (st==="menunggu")  return <span style={{background:"#FEF3C7",color:"#92400E",padding:"3px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>⏳ Menunggu Review</span>;
    if (st==="disetujui") return <span style={{background:"#D1FAE5",color:"#065F46",padding:"3px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>✅ Disetujui</span>;
    if (st==="revisi")    return <span style={{background:"#FEE2E2",color:"#991B1B",padding:"3px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>⟲ Perlu Revisi</span>;
    return <span style={{fontSize:10,color:"#94A3B8"}}>Belum ada caption</span>;
  };

  const list = jadwal; // Semua role lihat semua jadwal disetujui

  return (
    <div style={{padding:isMobile?"14px":"24px",maxWidth:800,margin:"0 auto",paddingBottom:60}}>
      <div style={{background:"linear-gradient(135deg,#0A1628,#1A305E)",padding:"20px 24px",borderRadius:16,color:"white",marginBottom:20}}>
        <div style={{color:GOLD,fontSize:11,fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",marginBottom:4}}>Prokopim Studio</div>
        <div style={{fontSize:20,fontWeight:900,marginBottom:4}}>
          {isTimkom?"📱 AI Newsroom — Timkom":isKasubbag?"📱 Review Caption":"📱 Monitoring Newsroom"}
        </div>
        <div style={{fontSize:12,opacity:0.8}}>
          {isTimkom?"Draft caption berita & ajukan ke Kasubbag Komdokpim":
           isKasubbag?"Review caption dari Timkom · Setujui untuk generate caption WK/WWK":
           "Pantau status seluruh caption agenda"}
        </div>
      </div>

      {/* Ringkasan Kabag */}
      {isKabag&&(()=>{
        const tot=jadwal.length, ok=jadwal.filter(e=>e.captionStatus==="disetujui").length,
          mn=jadwal.filter(e=>e.captionStatus==="menunggu").length, rv=jadwal.filter(e=>e.captionStatus==="revisi").length;
        return <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          {[{l:"Total",v:tot,bg:"#E2E8F0",c:"#1E293B"},{l:"Disetujui",v:ok,bg:"#D1FAE5",c:"#065F46"},{l:"Menunggu",v:mn,bg:"#FEF3C7",c:"#92400E"},{l:"Revisi",v:rv,bg:"#FEE2E2",c:"#991B1B"}].map(s=>(
            <div key={s.l} style={{flex:1,minWidth:70,background:s.bg,borderRadius:12,padding:"12px",textAlign:"center"}}>
              <div style={{fontSize:22,fontWeight:900,color:s.c}}>{s.v}</div>
              <div style={{fontSize:10,color:s.c,fontWeight:700,marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>;
      })()}

      <div style={{fontSize:13,fontWeight:800,color:NAVY,marginBottom:10}}>
        {isTimkom?"Semua Agenda Tayang:":isKasubbag?"Agenda Perlu Review & Riwayat:":"Status Caption Per Agenda:"}
      </div>

      {list.length===0
        ?<div style={{textAlign:"center",padding:"48px 20px",background:"white",borderRadius:16,color:"#94A3B8"}}>
          <div style={{fontSize:40,marginBottom:10}}>✨</div>
          <div style={{fontSize:14,fontWeight:700,color:"#475569"}}>Belum ada agenda yang perlu ditindaklanjuti</div>
        </div>
        :<div style={{display:"flex",flexDirection:"column",gap:10}}>
          {list.map(ev=>(
            <div key={ev.id} onClick={()=>openEditor(ev)}
              style={{background:"white",borderRadius:12,padding:"14px 16px",cursor:"pointer",
                border:"1.5px solid "+(ev.captionStatus==="menunggu"?"#FDE68A":ev.captionStatus==="revisi"?"#FECACA":"#E2E8F0"),
                boxShadow:"0 2px 8px rgba(0,0,0,0.05)",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.15s"}}>
              <div style={{flex:1,paddingRight:12}}>
                <div style={{fontSize:13,fontWeight:800,color:NAVY,marginBottom:4}}>{ev.namaAcara}</div>
                <div style={{fontSize:11,color:"#64748B"}}>📅 {fmtDate(ev.tanggal)}{!isPast(ev)?" · ⏰ Belum selesai":""}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
                {getCapBadge(ev)}
                <div style={{fontSize:10,fontWeight:700,color:"#94A3B8"}}>{isKabag?"Lihat →":isKasubbag?"Review →":"Buka Studio →"}</div>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}