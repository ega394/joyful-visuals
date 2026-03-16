import React, { useState, useRef, useEffect, useCallback } from "react";


// ═══════════════════════════════════════════════════════
// PENDAFTARAN AKUN (Register → Menunggu Persetujuan Kabag)
// ═══════════════════════════════════════════════════════
const REG_KEY="pending_registrations";
function loadPendingRegs(){try{return JSON.parse(localStorage.getItem(REG_KEY)||"[]");}catch{return[];}}
function savePendingRegs(regs){localStorage.setItem(REG_KEY,JSON.stringify(regs));}

// ═══════════════════════════════════════════════════════
// KEAMANAN: Rate Limiter Login (anti brute-force)
// ═══════════════════════════════════════════════════════
const LOGIN_MAX_ATTEMPTS=5;
const LOGIN_LOCKOUT_MS=3*60*1000;
function getLoginAttempts(){try{return JSON.parse(sessionStorage.getItem("jp_login_attempts")||'{"count":0,"firstAt":0,"lockedUntil":0}');}catch{return{count:0,firstAt:0,lockedUntil:0};}}
function recordLoginAttempt(success){
  if(success){sessionStorage.removeItem("jp_login_attempts");return;}
  const a=getLoginAttempts();const now=Date.now();
  if(now-a.firstAt>LOGIN_LOCKOUT_MS){a.count=1;a.firstAt=now;a.lockedUntil=0;}else{a.count++;}
  if(a.count>=LOGIN_MAX_ATTEMPTS)a.lockedUntil=now+LOGIN_LOCKOUT_MS;
  sessionStorage.setItem("jp_login_attempts",JSON.stringify(a));
}
function isLoginLocked(){const a=getLoginAttempts();if(a.lockedUntil&&Date.now()<a.lockedUntil)return Math.ceil((a.lockedUntil-Date.now())/1000);return 0;}

// ═══════════════════════════════════════════════════════
// KEAMANAN: Session Timeout (auto-logout 12 jam idle)
// ═══════════════════════════════════════════════════════
const SESSION_TIMEOUT_MS=12*60*60*1000;
let _lastActivity=Date.now();
function touchActivity(){_lastActivity=Date.now();}

// ═══════════════════════════════════════════════════════
// KEAMANAN: Input Sanitizer (anti XSS)
// ═══════════════════════════════════════════════════════
function sanitize(str){if(typeof str!=="string")return str;return str.replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;");}

// ═══════════════════════════════════════════════════════
// UX: Global Toast Bridge (agar komponen tanpa prop showT bisa tampilkan notifikasi)
// ═══════════════════════════════════════════════════════
const _toast={fn:null};
function globalToast(msg,type="error"){if(_toast.fn)_toast.fn(msg,type);else console.warn("[Toast]",msg);}

// ═══════════════════════════════════════════════════════
// UX: Waktu Relatif ("Hari Ini", "Besok", "3 hari lagi")
// ═══════════════════════════════════════════════════════
function relativeDate(dateStr){
  if(!dateStr)return"";
  const now=new Date();const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const target=new Date(dateStr+"T00:00:00");
  const diffDays=Math.round((target-today)/(1000*60*60*24));
  if(diffDays===0)return"Hari Ini";if(diffDays===1)return"Besok";if(diffDays===-1)return"Kemarin";
  if(diffDays>1&&diffDays<=7)return diffDays+" hari lagi";if(diffDays>7&&diffDays<=14)return"Minggu depan";
  if(diffDays<-1&&diffDays>=-7)return Math.abs(diffDays)+" hari lalu";if(diffDays<-7&&diffDays>=-14)return"Minggu lalu";
  return"";
}

// ═══════════════════════════════════════════════════════
// UX: Haptic Feedback (getaran ringan di mobile)
// ═══════════════════════════════════════════════════════
function haptic(ms=50){try{navigator?.vibrate?.(ms);}catch{}}

// ═══════════════════════════════════════════════════════
// UX: Undo Toast (batal aksi destruktif selama 5 detik)
// ═══════════════════════════════════════════════════════
let _undoTimer=null;let _undoCallback=null;
function clearUndo(){if(_undoTimer){clearTimeout(_undoTimer);_undoTimer=null;}_undoCallback=null;}
function triggerUndo(){if(_undoCallback){_undoCallback();clearUndo();}}

// ═══════════════════════════════════════════════════════
// UX: Password Strength Meter
// ═══════════════════════════════════════════════════════
function getPasswordStrength(pw){
  if(!pw)return{score:0,label:"",color:"#E2E8F0"};
  let s=0;if(pw.length>=6)s++;if(pw.length>=10)s++;
  if(/[A-Z]/.test(pw))s++;if(/[0-9]/.test(pw))s++;if(/[^A-Za-z0-9]/.test(pw))s++;
  if(s<=1)return{score:20,label:"Lemah",color:"#EF4444"};
  if(s===2)return{score:40,label:"Cukup",color:"#F59E0B"};
  if(s===3)return{score:60,label:"Sedang",color:"#EAB308"};
  if(s===4)return{score:80,label:"Kuat",color:"#22C55E"};
  return{score:100,label:"Sangat Kuat",color:"#059669"};
}
function PasswordStrengthBar({password}){
  const s=getPasswordStrength(password);
  if(!password)return null;
  return <div style={{marginTop:6}}>
    <div style={{height:4,borderRadius:4,background:"#F1F5F9",overflow:"hidden",marginBottom:3}}>
      <div style={{height:"100%",width:s.score+"%",background:s.color,borderRadius:4,transition:"all 0.4s cubic-bezier(0.34,1.56,0.64,1)"}}/>
    </div>
    <div style={{fontSize:10,fontWeight:700,color:s.color,textAlign:"right"}}>{s.label}</div>
  </div>;
}

// ── CaptchaBox: CAPTCHA matematika sederhana, tanpa layanan eksternal ──
function CaptchaBox({onValid}){
  const gen=()=>{
    const ops=["+","-","×"];
    const op=ops[Math.floor(Math.random()*ops.length)];
    let a=Math.floor(Math.random()*9)+1, b=Math.floor(Math.random()*9)+1;
    if(op==="-"&&b>a){const t=a;a=b;b=t;} // pastikan hasil positif
    const ans=op==="+"?a+b:op==="-"?a-b:a*b;
    return {soal:`${a} ${op} ${b}`,ans};
  };
  const[q,setQ]=React.useState(gen);
  const[val,setVal]=React.useState("");
  const[status,setStatus]=React.useState("idle"); // idle|ok|err
  const NAVY="#0A1628";

  const cek=()=>{
    if(parseInt(val,10)===q.ans){setStatus("ok");onValid(true);}
    else{setStatus("err");setVal("");onValid(false);setTimeout(()=>{setQ(gen());setStatus("idle");},900);}
  };

  return <div style={{marginBottom:16}}>
    <label style={{display:"block",fontSize:12,fontWeight:700,color:"#475569",marginBottom:6}}>
      Verifikasi Anti-Bot
    </label>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      {/* Kotak soal */}
      <div style={{
        padding:"10px 16px",borderRadius:10,fontWeight:800,fontSize:16,letterSpacing:2,
        background:status==="ok"?"#DCFCE7":status==="err"?"#FEE2E2":"#F1F5F9",
        color:status==="ok"?"#166534":status==="err"?"#991B1B":NAVY,
        border:"1.5px solid "+(status==="ok"?"#86EFAC":status==="err"?"#FECACA":"#CBD5E1"),
        minWidth:90,textAlign:"center",fontFamily:"monospace",transition:"all 0.2s",userSelect:"none",
      }}>
        {status==="ok"?"✓ OK":status==="err"?"✗":q.soal+" = ?"}
      </div>
      {/* Input jawaban */}
      {status!=="ok"&&<input
        type="number" value={val} placeholder="Jawaban"
        onChange={e=>{setVal(e.target.value);setStatus("idle");onValid(false);}}
        onKeyDown={e=>e.key==="Enter"&&cek()}
        style={{width:80,padding:"10px 12px",borderRadius:10,border:"1.5px solid "+(status==="err"?"#FECACA":"#e2e8f0"),
          fontSize:14,textAlign:"center",outline:"none",boxSizing:"border-box"}}
      />}
      {status!=="ok"&&<button type="button" onClick={cek}
        style={{padding:"10px 14px",borderRadius:10,border:"none",background:NAVY,color:"white",
          cursor:"pointer",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>
        Cek ✓
      </button>}
      {/* Refresh soal */}
      {status!=="ok"&&<button type="button" onClick={()=>{setQ(gen());setVal("");setStatus("idle");onValid(false);}}
        title="Ganti soal" style={{padding:"10px",borderRadius:10,border:"1.5px solid #e2e8f0",
          background:"white",cursor:"pointer",fontSize:13,color:"#64748B"}}>
        🔄
      </button>}
    </div>
    {status==="err"&&<div style={{fontSize:11,color:"#DC2626",marginTop:4}}>Jawaban salah, soal diganti otomatis.</div>}
    {status==="ok"&&<div style={{fontSize:11,color:"#166534",marginTop:4}}>✓ Verifikasi berhasil.</div>}
  </div>;
}

function RegisterModal({onClose, onSuccess}){
  const NAVY="#0A1628",GOLD="#C9A84C";

  const [form,setForm]=React.useState({nama:"",jabatan:"",noWA:"",username:"",password:"",konfirmasi:"",role:"staf",alasan:""});
  const [err,setErr]=React.useState("");
  const [sent,setSent]=React.useState(false);
  const [captchaOK,setCaptchaOK]=React.useState(false);
  const ROLE_OPTS=[{v:"staf",l:"Staf Protokol"},{v:"admin_rk",l:"Admin Rencana Kegiatan (Input Jadwal)"},{v:"timkom",l:"Staf Komunikasi & Dokumentasi"},{v:"ajudan_walikota",l:"Ajudan Wali Kota"},{v:"ajudan_wakilwalikota",l:"Ajudan Wakil Wali Kota"},{v:"mitra_kerja",l:"Mitra Kerja Pemkot (Hanya Lihat Agenda)"}];
  const inp={width:"100%",padding:"10px 13px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:14,outline:"none",background:"white",boxSizing:"border-box"};
  const submit=async()=>{
    setErr("");
    if(!captchaOK)return setErr("Selesaikan verifikasi anti-bot terlebih dahulu.");
    if(!form.nama||!form.username||!form.password||!form.jabatan)return setErr("Nama, jabatan, username & password wajib diisi.");
    if(form.password!==form.konfirmasi)return setErr("Konfirmasi password tidak cocok.");
    if(form.password.length<6)return setErr("Password minimal 6 karakter.");
    const existing=loadUsers().find(u=>u.username===form.username.toLowerCase().trim());
    if(existing)return setErr("Username sudah digunakan.");
    const pending=loadPendingRegs();
    if(pending.find(r=>r.username===form.username.toLowerCase().trim()))return setErr("Username sudah pernah didaftarkan, menunggu persetujuan.");
    const hash=await sha256(form.password);
    const reg={...form,username:form.username.toLowerCase().trim(),password:hash,id:Date.now(),tanggal:new Date().toISOString()};
    savePendingRegs([...pending,reg]);
    // Simpan juga ke Supabase agar Kabag bisa lihat dari device lain
    dbSavePendingReg(reg).catch(e=>console.warn("Sync:",e?.message||e));
    window.dispatchEvent(new StorageEvent("storage",{key:"pending_registrations"}));
    setSent(true);
  };
  if(sent)return(
    <div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"white",borderRadius:20,padding:"36px 28px",maxWidth:380,textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{fontSize:52,marginBottom:12}}>✅</div>
        <div style={{fontSize:18,fontWeight:800,color:NAVY,marginBottom:8}}>Pendaftaran Terkirim</div>
        <div style={{fontSize:13,color:"#64748B",lineHeight:1.6,marginBottom:20}}>Permohonan akun Anda sedang menunggu persetujuan Kabag Protokol dan Komunikasi Pimpinan. Anda akan dihubungi setelah akun diaktifkan.</div>
        <button onClick={onClose} style={{padding:"12px 32px",borderRadius:10,border:"none",background:"linear-gradient(135deg,"+NAVY+",#1B4080)",color:"white",cursor:"pointer",fontWeight:700,fontSize:14}}>Tutup</button>
      </div>
    </div>
  );
  return(
    <div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(4px)",overflowY:"auto",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px 0 40px"}}>
      <div style={{background:"white",borderRadius:20,width:"100%",maxWidth:440,margin:"0 16px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{background:"linear-gradient(135deg,"+NAVY+",#1B4080)",padding:"20px",borderRadius:"20px 20px 0 0"}}>
          <div style={{color:GOLD,fontSize:11,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>Prokopim Tarakan</div>
          <div style={{color:"white",fontSize:18,fontWeight:800,marginTop:3}}>Daftar Akun Baru</div>
          <div style={{color:"rgba(255,255,255,0.6)",fontSize:12,marginTop:3}}>Perlu persetujuan Kabag sebelum aktif</div>
        </div>
        <div style={{padding:"20px"}}>
          {err&&<div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:9,padding:"10px 13px",marginBottom:14,color:"#991B1B",fontSize:13}}>{err}</div>}
          {[
            {l:"Nama Lengkap",k:"nama",ph:"Nama sesuai NIP/SK"},
            {l:"Jabatan",k:"jabatan",ph:"Contoh: Staf Protokol"},
            {l:"No. WhatsApp",k:"noWA",ph:"08xxxx (opsional)"},
            {l:"Username",k:"username",ph:"Huruf kecil, tanpa spasi"},
          ].map(f=>(
            <div key={f.k} style={{marginBottom:12}}>
              <label style={{display:"block",fontSize:12,fontWeight:700,color:"#475569",marginBottom:4}}>{f.l}</label>
              <input value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={inp}/>
            </div>
          ))}
          <div style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:"#475569",marginBottom:4}}>Posisi/Role</label>
            <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} style={{...inp}}>
              {ROLE_OPTS.map(r=><option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
          </div>
          {[{l:"Password",k:"password"},{l:"Konfirmasi Password",k:"konfirmasi"}].map(f=>(
            <div key={f.k} style={{marginBottom:12}}>
              <label style={{display:"block",fontSize:12,fontWeight:700,color:"#475569",marginBottom:4}}>{f.l}</label>
              <input type="password" value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={inp}/>
              {f.k==="password"&&<PasswordStrengthBar password={form.password}/>}
            </div>
          ))}
          <div style={{marginBottom:18}}>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:"#475569",marginBottom:4}}>Alasan Mendaftar (opsional)</label>
            <textarea value={form.alasan} onChange={e=>setForm(p=>({...p,alasan:e.target.value}))} rows={2} placeholder="Contoh: Staf baru Kasubbag Protokol..." style={{...inp,resize:"none"}}/>
          </div>
          <CaptchaBox onValid={ok=>setCaptchaOK(ok)}/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose} style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",color:"#64748B",cursor:"pointer",fontWeight:600,fontSize:13}}>Batal</button>
            <button onClick={submit} style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:"linear-gradient(135deg,"+NAVY+",#1B4080)",color:"white",cursor:"pointer",fontWeight:800,fontSize:14}}>Kirim Permohonan</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== CONSTANTS ====================
const NAVY="#0A1628", GOLD="#D4AF5A", GREEN="#0D6B4F";
const C={
  navy:"#0A1628", navyMid:"#142238", navyLight:"#1E3254",
  gold:"#D4AF5A", goldLight:"rgba(212,175,90,0.15)",
  green:"#0D6B4F", greenBg:"#ECFDF5",
  red:"#DC2626", redBg:"#FEF2F2",
  amber:"#D97706", amberBg:"#FFFBEB",
  surface:"#F0F4FA", surfaceCard:"#FFFFFF",
  border:"#E4EAF2", borderLight:"rgba(0,0,0,0.06)",
  text:"#0F1C2E", textMid:"#4A5568", textLight:"#94A3B8",
  glass:"rgba(255,255,255,0.08)", glassBorder:"rgba(255,255,255,0.14)",
};
const ALL_ROLE_DEFS=[
  {key:"walikota",      label:"Wali Kota",                     icon:"circle"},
  {key:"wakilwalikota", label:"Wakil Wali Kota",               icon:"circle2"},
  {key:"ajudan_walikota",label:"Ajudan WK",icon:"clip"},{key:"ajudan_wakilwalikota",label:"Ajudan WWK",icon:"clip"},
  {key:"timkom",        label:"Tim Komunikasi & Dokumentasi",  icon:"attach"},
  {key:"staf",          label:"Staf Protokol",                 icon:"pencil"},
  {key:"admin_rk",      label:"Admin Rencana Kegiatan",        icon:"pencil"},
  {key:"kasubbag_protokol",      label:"Kasubbag Protokol",             icon:"search"},
  {key:"kabag",         label:"Kabag Prokopim",                icon:"check"},
  {key:"mitra_kerja",    label:"Mitra Kerja Pemkot",              icon:"eye"},
];
const WF={
  draft:             {label:"Draft",             color:"#64748b",bg:"#f1f5f9"},
  menunggu_kasubbag: {label:"Menunggu Kasubbag", color:"#d97706",bg:"#fef3c7"},
  menunggu_kabag:    {label:"Menunggu Kabag",    color:"#7c3aed",bg:"#ede9fe"},
  disetujui:         {label:"Disetujui",         color:"#065f46",bg:"#d1fae5"},
  ditolak:           {label:"Ditolak",           color:"#991b1b",bg:"#fee2e2"},
};
// Label display per role
const ROLE_LABEL={
  walikota:"Wali Kota",wakilwalikota:"Wakil Wali Kota",
  kabag:"Kabag Prokopim",
  kasubbag_protokol:"Kasubbag Protokol",kasubbag_komdokpim:"Kasubbag Komdokpim",
  ajudan:"Ajudan",
  staf:"Staf Protokol",admin_rk:"Admin Rencana Kegiatan",
  timkom:"Staf Komunikasi & Dokumentasi",
  mitra_kerja:"Mitra Kerja Pemkot",
};
// Role hierarchy untuk penugasan: siapa bisa menugaskan siapa
const ASSIGN_ROLES={
  kasubbag_protokol:["staf","admin_rk","kasubbag_protokol"],
  kasubbag_komdokpim:["timkom","kasubbag_komdokpim"],
  kabag:["staf","admin_rk","timkom","ajudan_walikota","ajudan_wakilwalikota","kasubbag_protokol","kasubbag_komdokpim"],
  timkom:["timkom"],
  admin_rk:["admin_rk"],
};

// Inject CSS animasi untuk SambutanBlock loading state
if(typeof document!=="undefined"&&!document.getElementById("prokopim-anim")){
  const s=document.createElement("style");
  s.id="prokopim-anim";
  s.textContent=`
    @keyframes prokopim-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
    @keyframes prokopim-slide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
    @keyframes prokopim-pulse{0%,100%{opacity:1}50%{opacity:0.5}}
    .prokopim-spin{animation:prokopim-spin 1s linear infinite}
    .prokopim-pulse{animation:prokopim-pulse 1.5s ease infinite}
    .prokopim-slide{animation:prokopim-slide 1.8s ease infinite}
  `;
  document.head.appendChild(s);
}

const PAKAIAN=["PDH","PDH Batik Tarakan","Batik Lengan Panjang","Batik Korpri","Pakaian Muslim","PSL","PSR","PSH","PDUB","Pakaian Lapangan","Olahraga","Bebas Rapi","Lainnya"];
const JENIS=["Menghadiri","Sambutan","Pengarahan"];
const PEJABAT=["Sekda","Asisten Pemerintahan dan Kesra","Asisten Perekonomian dan Pembangunan","Asisten Administrasi Umum"];
const ROLES_WITH_REPORT=["staf","admin_rk","kasubbag_protokol","kasubbag_komdokpim","kabag","timkom"];
const STAF_ROLES=["staf","admin_rk","timkom"];
const KASUBBAG_ROLES=["kasubbag_protokol","kasubbag_komdokpim"];

// ==================== USERS ====================
// ══ HASH ENGINE (SHA-256 via Web Crypto, tidak butuh library) ══
async function sha256(str){
  const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
// Verifikasi password: hash input, bandingkan dengan stored hash
async function verifyPassword(plain,hash){
  // Support legacy plaintext selama masa transisi
  if(!hash.startsWith("$sha256$"))return plain===hash;
  return ("$sha256$"+await sha256(plain))===hash;
}
async function hashPassword(plain){
  return "$sha256$"+await sha256(plain);
}
// Hash semua password di array users (untuk migrasi)
async function migratePasswords(users){
  return Promise.all(users.map(async u=>{
    if(u.password&&!u.password.startsWith("$sha256$")){
      return{...u,password:await hashPassword(u.password)};
    }
    return u;
  }));
}

const DEFAULT_USERS=[
  {username:"walikota",      password:"WK@2025",      role:"walikota",      nama:"Wali Kota Tarakan",                jabatan:"Wali Kota Tarakan"},
  {username:"wakilwalikota", password:"WWK@2025",     role:"wakilwalikota", nama:"Wakil Wali Kota Tarakan",          jabatan:"Wakil Wali Kota Tarakan"},
  {username:"ajudan_wk",     password:"Ajudan@2025",  role:"ajudan_walikota",     nama:"Ajudan Wali Kota",          jabatan:"Ajudan Wali Kota"},
  {username:"ajudan_wwk",    password:"Ajudan@2025",  role:"ajudan_wakilwalikota",nama:"Ajudan Wakil Wali Kota",    jabatan:"Ajudan Wakil Wali Kota"},
  {username:"timkom",        password:"Timkom@2025",  role:"timkom",        nama:"Tim Komunikasi & Dokumentasi",     jabatan:"Tim Komunikasi & Dokumentasi Pimpinan"},
  {username:"staf",          password:"Staf@2025",    role:"staf",          nama:"Staf Protokol",                    jabatan:"Staf Protokol"},
  {username:"kasubbag_protokol",      password:"Ksbg@2025",    role:"kasubbag_protokol",      nama:"Kasubbag Protokol",                jabatan:"Kasubbag Protokol"},
  {username:"kasubbag_komdokpim",password:"Kdp@2025",    role:"kasubbag_komdokpim",nama:"Kasubbag Komdokpim",           jabatan:"Kasubbag Komunikasi dan Pendokumentasian Tugas Pimpinan"},
  {username:"kabag",         password:"Kabag@2025",   role:"kabag",         nama:"Kabag Protokol & Komunikasi",      jabatan:"Kepala Bagian Protokol & Komunikasi Pimpinan"},
  {username:"admin_rk",      password:"AdminRK@2025", role:"admin_rk",      nama:"Admin Rencana Kegiatan",           jabatan:"Admin Rencana Kegiatan Pimpinan"},
];
function loadUsers(){
  // Pakai cache jika sudah diisi oleh initUsers()
  if(_usersCache)return _usersCache;
  try{
    const s=localStorage.getItem("jp_users");
    const users=s?JSON.parse(s):DEFAULT_USERS;
    const hasPlain=users.some(u=>u.password&&!u.password.startsWith("$sha256$"));
    if(hasPlain){
      migratePasswords(users).then(migrated=>{
        _usersCache=migrated;
        try{localStorage.setItem("jp_users",JSON.stringify(migrated));}catch{}
      });
    }
    return users;
  }catch{return DEFAULT_USERS;}
}
function saveUsers(u){
  _usersCache=u;
  // Simpan ke localStorage sebagai cache offline
  try{localStorage.setItem("jp_users",JSON.stringify(u));}catch{}
  // Sync ke Supabase (fire-and-forget)
  if(SUPA_OK){
    Promise.all(u.map(user=>dbUpsertUser(user))).catch(e=>console.warn("saveUsers Supabase sync error:",e));
  }
}

// ==================== BIOMETRIC (WebAuthn) ====================
function bioKey(username){return "jp_bio_"+username;}
async function bioRegister(username){
  if(!window.PublicKeyCredential)throw new Error("WebAuthn tidak didukung browser ini");
  const challenge=crypto.getRandomValues(new Uint8Array(32));
  const cred=await navigator.credentials.create({publicKey:{
    challenge,
    rp:{name:"Jadwal Pimpinan Tarakan",id:window.location.hostname},
    user:{id:new TextEncoder().encode(username),name:username,displayName:username},
    pubKeyCredParams:[{alg:-7,type:"public-key"},{alg:-257,type:"public-key"}],
    authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required"},
    timeout:60000
  }});
  const id=btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
  localStorage.setItem(bioKey(username),id);
  return id;
}
async function bioAuthenticate(username){
  const stored=localStorage.getItem(bioKey(username));
  if(!stored)throw new Error("Biometrik belum didaftarkan");
  const rawId=Uint8Array.from(atob(stored),c=>c.charCodeAt(0));
  const challenge=crypto.getRandomValues(new Uint8Array(32));
  await navigator.credentials.get({publicKey:{
    challenge,
    allowCredentials:[{id:rawId,type:"public-key"}],
    userVerification:"required",
    timeout:60000
  }});
  return true;
}
function bioIsRegistered(username){return!!localStorage.getItem(bioKey(username));}
function bioSupported(){return!!(window.PublicKeyCredential&&window.isSecureContext);}

// ==================== SUPABASE ====================
const SUPA_URL=import.meta.env.VITE_SUPABASE_URL||"";
const SUPA_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY||"";
const SUPA_OK=!!(SUPA_URL&&SUPA_KEY);
const H=()=>({"Content-Type":"application/json",apikey:SUPA_KEY,Authorization:"Bearer "+SUPA_KEY});
const forDB=ev=>{const d={...ev};if(d.sambutanFile?.startsWith("data:"))d.sambutanFile=null;if(d.sambutanDocx?.startsWith("blob:")||d.sambutanDocx?.startsWith("data:"))d.sambutanDocx=null;if(d.undanganFile?.startsWith("data:"))d.undanganFile=null;return d;};
async function dbLoadAll(){if(!SUPA_OK)return null;const r=await fetch(SUPA_URL+"/rest/v1/jadwal?select=data&order=id",{headers:H()});if(!r.ok)throw new Error(await r.text());return(await r.json()).map(x=>x.data);}
async function dbUpsert(ev){if(!SUPA_OK)return;await fetch(SUPA_URL+"/rest/v1/jadwal",{method:"POST",headers:{...H(),Prefer:"resolution=merge-duplicates"},body:JSON.stringify({id:ev.id,data:forDB(ev)})});}
async function dbDelete(id){if(!SUPA_OK)return;await fetch(SUPA_URL+"/rest/v1/jadwal?id=eq."+id,{method:"DELETE",headers:H()});}

// ── Pending registrations via Supabase (tabel: pending_regs) ──
async function dbLoadPendingRegs(){
  if(!SUPA_OK)return null;
  try{const r=await fetch(SUPA_URL+"/rest/v1/pending_regs?select=data&order=id",{headers:H()});if(!r.ok)return null;return(await r.json()).map(x=>x.data);}catch{return null;}
}
async function dbSavePendingReg(reg){
  if(!SUPA_OK)return;
  await fetch(SUPA_URL+"/rest/v1/pending_regs",{method:"POST",headers:{...H(),Prefer:"resolution=merge-duplicates"},body:JSON.stringify({id:reg.id,data:reg})});
}
async function dbDeletePendingReg(id){
  if(!SUPA_OK)return;
  await fetch(SUPA_URL+"/rest/v1/pending_regs?id=eq."+id,{method:"DELETE",headers:H()});
}
async function storageUpload(bucket,evId,file){
  if(!SUPA_OK)return null;
  const path=evId+"/"+Date.now()+"_"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const r=await fetch(SUPA_URL+"/storage/v1/object/"+bucket+"/"+path,{method:"POST",headers:{apikey:SUPA_KEY,Authorization:"Bearer "+SUPA_KEY,"Content-Type":file.type},body:file});
  if(!r.ok)return null;
  return SUPA_URL+"/storage/v1/object/public/"+bucket+"/"+path;
}
// Kompresi file ke maks 1MB sebelum upload
// - Gambar: iterasi turunkan kualitas JPEG sampai ≤1MB
// - PDF  : tidak bisa dikompres di browser, upload apa adanya
async function compressFileTo1MB(file){
  const MAX=1*1024*1024;
  if(file.type==="application/pdf"){
    // PDF tak bisa dikompres di browser — kembalikan apa adanya
    return file;
  }
  return new Promise(resolve=>{
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{
      URL.revokeObjectURL(url);
      // Scale-down dimensi jika sangat besar
      const MAX_DIM=2560;
      let w=img.width,h=img.height;
      if(w>MAX_DIM||h>MAX_DIM){
        if(w>h){h=Math.round(h*MAX_DIM/w);w=MAX_DIM;}
        else{w=Math.round(w*MAX_DIM/h);h=MAX_DIM;}
      }
      const canvas=document.createElement("canvas");
      canvas.width=w;canvas.height=h;
      canvas.getContext("2d").drawImage(img,0,0,w,h);
      // Iterasi turunkan kualitas sampai ≤ 1MB
      const toFile=(dataUrl)=>{
        const arr=dataUrl.split(","),mime="image/jpeg";
        const bstr=atob(arr[1]);const n=bstr.length;
        const u8=new Uint8Array(n);
        for(let i=0;i<n;i++)u8[i]=bstr.charCodeAt(i);
        return new File([u8],file.name.replace(/\.[^.]+$/,"")+"_compressed.jpg",{type:mime});
      };
      const tryQ=(q)=>{
        const dataUrl=canvas.toDataURL("image/jpeg",q);
        // estimasi ukuran dari base64 length
        const est=Math.round((dataUrl.length-dataUrl.indexOf(",")-1)*3/4);
        if(est<=MAX||q<=0.08){resolve(toFile(dataUrl));}
        else{tryQ(parseFloat((q-0.08).toFixed(2)));}
      };
      tryQ(0.82);
    };
    img.onerror=()=>resolve(file);
    img.src=url;
  });
}

async function storageDelete(bucket,url){
  if(!SUPA_OK||!url)return;
  const m=url.match(/\/object\/public\/[^/]+\/(.+)$/);
  if(m)await fetch(SUPA_URL+"/storage/v1/object/"+bucket+"/"+m[1],{method:"DELETE",headers:{apikey:SUPA_KEY,Authorization:"Bearer "+SUPA_KEY}});
}

// ==================== SUPABASE USERS ====================
let _usersCache = null; // module-level cache

async function dbLoadUsers(){
  if(!SUPA_OK)return null;
  const r=await fetch(SUPA_URL+"/rest/v1/users?select=*&order=username",{headers:H()});
  if(!r.ok)throw new Error(await r.text());
  return await r.json();
}
async function dbUpsertUser(u){
  if(!SUPA_OK)return;
  const{_newPw,...clean}=u; // jangan simpan field temp
  await fetch(SUPA_URL+"/rest/v1/users",{
    method:"POST",
    headers:{...H(),Prefer:"resolution=merge-duplicates"},
    body:JSON.stringify(clean)
  });
}
async function dbDeleteUser(username){
  if(!SUPA_OK)return;
  await fetch(SUPA_URL+"/rest/v1/users?username=eq."+encodeURIComponent(username),{method:"DELETE",headers:H()});
}
async function initUsers(){
  // Prioritas: Supabase → localStorage → DEFAULT_USERS
  if(!SUPA_OK){
    _usersCache=null; // biarkan loadUsers() pakai localStorage
    return loadUsers();
  }
  try{
    const rows=await dbLoadUsers();
    if(rows&&rows.length>0){
      _usersCache=rows;
      try{localStorage.setItem("jp_users",JSON.stringify(rows));}catch{}
      // Migrasi password plaintext jika ada
      const hasPlain=rows.some(u=>u.password&&!u.password.startsWith("$sha256$"));
      if(hasPlain){
        const migrated=await migratePasswords(rows);
        _usersCache=migrated;
        await Promise.all(migrated.map(u=>dbUpsertUser(u))).catch(e=>console.warn("Sync:",e?.message||e));
        try{localStorage.setItem("jp_users",JSON.stringify(migrated));}catch{}
      }
      return _usersCache;
    } else {
      // Supabase kosong — seed dari localStorage
      const local=loadUsers();
      const migrated=await migratePasswords(local);
      _usersCache=migrated;
      await Promise.all(migrated.map(u=>dbUpsertUser(u))).catch(console.warn);
      return migrated;
    }
  }catch(e){
    console.warn("initUsers Supabase error, fallback localStorage:",e.message);
    _usersCache=null;
    return loadUsers();
  }
}

// ==================== HELPERS ====================
const HARI_ID=["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const getHari=d=>d?HARI_ID[new Date(d+"T00:00:00").getDay()]:"";
const fmt=d=>d?new Date(d+"T00:00:00").toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"}):"--";
const localDateStr=(d=new Date())=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fmtShort=d=>d?new Date(d+"T00:00:00").toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"--";
const toMin=t=>{if(!t)return 0;const[h,m]=t.split(":").map(Number);return h*60+m;};
const todayStr=()=>localDateStr();
const tomorrowStr=()=>{const d=new Date();d.setDate(d.getDate()+1);return localDateStr(d);};
const weekStart=()=>{const d=new Date();d.setDate(d.getDate()-d.getDay()+1);return localDateStr(d);};
const weekEnd=()=>{const d=new Date();d.setDate(d.getDate()-d.getDay()+7);return localDateStr(d);};
const monthStart=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-01";};
const monthEnd=()=>{const _d=new Date();return localDateStr(new Date(_d.getFullYear(),_d.getMonth()+1,0));};
const hasConflict=(events,ev)=>{const s=toMin(ev.jam),e2=s+120;return events.some(e=>e.id!==ev.id&&e.alur==="disetujui"&&e.tanggal===ev.tanggal&&e.untukPimpinan.some(p=>ev.untukPimpinan?.includes(p))&&(()=>{const es=toMin(e.jam),ee=es+120;return s<ee&&e2>es;})());};
function makeICS(ev){
  const[y,mo,d]=ev.tanggal.split("-");
  const[hh,mm]=(ev.jam||"08:00").split(":");
  const pad=n=>String(n).padStart(2,"0");
  const dtStart=y+mo+d+"T"+pad(hh)+pad(mm)+"00";
  const endHr=parseInt(hh)+2;
  const dtEnd=y+mo+d+"T"+pad(endHr)+pad(mm)+"00";
  const desc=[
    ev.penyelenggara&&"Penyelenggara: "+ev.penyelenggara,
    ev.kontak&&"Kontak: "+ev.kontak,
    ev.pakaian&&"Pakaian: "+ev.pakaian,
    ev.jenisKegiatan&&"Jenis: "+ev.jenisKegiatan,
    ev.catatan&&"Catatan: "+ev.catatan,
  ].filter(Boolean).join("\n");
  const lines=[
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Protokol Tarakan//ID",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:ev"+ev.id+"-"+ev.tanggal+"@protokol.tarakankota.go.id",
    "DTSTART:"+dtStart,
    "DTEND:"+dtEnd,
    "SUMMARY:"+ev.namaAcara,
    ...(ev.lokasi?["LOCATION:"+ev.lokasi]:[]),
    ...(desc?["DESCRIPTION:"+desc.split("\n").join("\\n")]:[]),
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Pengingat: "+ev.namaAcara,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return "data:text/calendar;charset=utf8,"+encodeURIComponent(lines.join("\r\n"));
}
function useWindowWidth(){const[w,setW]=useState(typeof window!=="undefined"?window.innerWidth:1280);useEffect(()=>{const h=()=>setW(window.innerWidth);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);return w;}

// ==================== SEED ====================
const T=todayStr(),TMR=tomorrowStr();
const mkEv=o=>({alur:"disetujui",catatanTolak:"",catatanKasubbag:"",catatanKabag:"",statusWK:null,statusWWK:null,perwakilanWK:"",perwakilanWWK:"",delegasiKeWWK:false,delegasiWWKJajaran:false,besertaIstriWK:false,besertaIstriWWK:false,sambutanFile:null,sambutanNama:"",sambutanDocx:null,sambutanDocxNama:"",undanganFile:null,undanganNama:"",catatanPimpinan:"",tersembunyi:false,alurHapus:null,lokasi:"",personil:[],catatanPenugasan:"",evaluasi:{},...o});
const seed=[
  mkEv({id:1,tanggal:T,jam:"09:00",namaAcara:"Rapat Koordinasi Infrastruktur",penyelenggara:"Dinas PUPR",kontak:"Budi 0812-3456-7890",buktiUndangan:"No.045/PUPR/2025",pakaian:"PDH",lokasi:"Ruang Rapat Lt.3 Balaikota Tarakan",jenisKegiatan:"Sambutan",catatan:"Ruang Rapat Lt.3",untukPimpinan:["walikota","wakilwalikota"]}),
  mkEv({id:2,tanggal:T,jam:"14:00",namaAcara:"Peresmian Taman Kota Baru",penyelenggara:"Dinas LH",kontak:"Sari 0813-9876-5432",buktiUndangan:"No.023/DLH/2025",pakaian:"Batik Lengan Panjang",lokasi:"Taman Kota Baru Tarakan",jenisKegiatan:"Sambutan",catatan:"Outdoor, bawa payung.",untukPimpinan:["walikota"],statusWK:"hadir"}),
  mkEv({id:3,tanggal:TMR,jam:"10:00",namaAcara:"Audiensi DPRD - Pembahasan APBD",penyelenggara:"Sekretariat DPRD",kontak:"Ahmad 0811-2222-3333",buktiUndangan:"No.110/DPRD/2025",pakaian:"PSH",lokasi:"Gedung DPRD Kota Tarakan",jenisKegiatan:"Pengarahan",catatan:"Bawa dokumen APBD",untukPimpinan:["walikota","wakilwalikota"],alur:"menunggu_kasubbag"}),
  mkEv({id:4,tanggal:TMR,jam:"08:00",namaAcara:"Apel Pagi Gabungan",penyelenggara:"Sekretariat Daerah",kontak:"Hendra 0815-1111-2222",buktiUndangan:"Memo No.5/2025",pakaian:"PDH",lokasi:"Halaman Kantor Wali Kota Tarakan",jenisKegiatan:"Menghadiri",catatan:"",untukPimpinan:["walikota"],alur:"menunggu_kabag"}),
];
const emptyForm={tanggal:"",jam:"",namaAcara:"",penyelenggara:"",kontak:"",buktiUndangan:"",pakaian:"PDH",jenisKegiatan:"Menghadiri",catatan:"",lokasi:"",untukPimpinan:["walikota"],besertaIstriWK:false,besertaIstriWWK:false,undanganFile:null,undanganNama:"",personil:[],catatanPenugasan:""};

// ==================== SMALL COMPONENTS ====================
const StatusPill=({alur,hapus})=>{
  if(hapus)return <span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:"#fff1f2",color:"#e11d48",whiteSpace:"nowrap"}}>Minta Hapus</span>;
  const c=WF[alur]||WF.draft;
  return <span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:c.bg,color:c.color,whiteSpace:"nowrap"}}>{c.label}</span>;
};
const JenisBadge=({j})=>{const m={Sambutan:{bg:"#fdf4ff",c:"#9333ea"},Pengarahan:{bg:"#eff6ff",c:"#2563eb"},Menghadiri:{bg:"#f0fdf4",c:"#16a34a"}};const x=m[j]||{bg:"#f1f5f9",c:"#64748b"};return <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:x.bg,color:x.c}}>{j}</span>;};
function Toast({msg,type}){
  const bg=type==="error"?"rgba(220,38,38,0.96)":type==="warn"?"rgba(217,119,6,0.96)":"rgba(10,22,40,0.95)";
  const icon=type==="error"?"⚠️":type==="warn"?"⚡":"✓";
  const dur=type==="error"?"5s":type==="warn"?"4s":"3s";
  return <div role="alert" aria-live="assertive" style={{position:"fixed",top:"env(safe-area-inset-top,20px)",marginTop:20,left:"50%",transform:"translateX(-50%)",zIndex:9999,padding:"12px 20px",borderRadius:16,background:bg,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",color:"white",boxShadow:"0 8px 32px rgba(0,0,0,0.28)",fontSize:13,fontWeight:600,whiteSpace:"pre-wrap",display:"flex",alignItems:"center",gap:8,animation:"toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1)",maxWidth:"calc(100vw - 40px)",textAlign:"center",lineHeight:1.4,overflow:"hidden"}}>
    <span style={{fontSize:15,flexShrink:0}}>{icon}</span><span style={{flex:1}}>{msg}</span>
    <div style={{position:"absolute",bottom:0,left:12,right:12,height:2,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",background:"rgba(255,255,255,0.35)",borderRadius:2,animation:"toastProgress "+dur+" linear forwards"}}/></div>
  </div>;
}

// ==================== DELEGATE MODAL ====================
function DelegateModal({label,onConfirm,onCancel}){
  const[sel,setSel]=useState("");const[cust,setCust]=useState("");const fin=sel==="__c__"?cust:sel;
  return <div style={{position:"fixed",inset:0,zIndex:8200,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:"white",borderRadius:16,padding:20,width:"100%",maxWidth:400}} onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:15,fontWeight:700,color:NAVY,marginBottom:4}}>Wakilkan Tugas</div>
      <div style={{fontSize:13,color:"#64748b",marginBottom:12}}>Pilih pejabat mewakili <strong>{label}</strong>:</div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
        {PEJABAT.map(p=><button key={p} onClick={()=>setSel(p===sel?"":p)} style={{padding:"10px 13px",borderRadius:9,border:"1.5px solid "+(sel===p?NAVY:"#e2e8f0"),background:sel===p?"#EBF0FA":"white",color:sel===p?NAVY:"#334155",cursor:"pointer",fontSize:13,textAlign:"left",fontWeight:sel===p?700:400}}>{p}</button>)}
        <button onClick={()=>setSel("__c__")} style={{padding:"10px 13px",borderRadius:9,border:"1.5px solid "+(sel==="__c__"?NAVY:"#e2e8f0"),background:sel==="__c__"?"#EBF0FA":"white",color:sel==="__c__"?NAVY:"#334155",cursor:"pointer",fontSize:13,textAlign:"left"}}>Pejabat lainnya...</button>
      </div>
      {sel==="__c__"&&<input placeholder="Nama pejabat..." value={cust} onChange={e=>setCust(e.target.value)} style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",fontSize:14,marginBottom:12}}/>}
      {fin&&<div style={{background:"#f0f9ff",borderRadius:8,padding:"8px 11px",marginBottom:12,border:"1px solid #bae6fd",fontSize:13,color:"#0284c7"}}><strong>{fin}</strong> akan mewakili.</div>}
      <div style={{display:"flex",gap:8}}>
        <button onClick={onCancel} style={{flex:1,padding:"11px",borderRadius:9,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600}}>Batal</button>
        <button onClick={()=>fin.trim()&&onConfirm(fin)} disabled={!fin.trim()} style={{flex:2,padding:"11px",borderRadius:9,border:"none",background:fin.trim()?NAVY:"#e2e8f0",color:fin.trim()?"white":"#94a3b8",cursor:fin.trim()?"pointer":"default",fontSize:13,fontWeight:700}}>Konfirmasi</button>
      </div>
    </div>
  </div>;
}

// ==================== PDF/IMAGE VIEWER MODAL ====================
function FileViewModal({file,nama,onClose}){
  const isImg=nama&&(nama.match(/\.(jpg|jpeg|png|gif|webp)$/i)||file?.startsWith("data:image"));
  return <div style={{position:"fixed",inset:0,zIndex:8500,background:"rgba(0,0,0,0.88)",display:"flex",flexDirection:"column"}} onClick={onClose}>
    <div style={{background:NAVY,padding:"11px 16px",display:"flex",alignItems:"center",gap:10}} onClick={e=>e.stopPropagation()}>
      <span style={{color:"white",fontSize:14,fontWeight:700,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nama}</span>
      <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:7,color:"white",padding:"6px 12px",cursor:"pointer",fontSize:13,fontWeight:700}}>Tutup</button>
    </div>
    <div style={{flex:1,overflow:"auto",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.stopPropagation()}>
      {isImg?<img src={file} alt={nama} style={{maxWidth:"100%",maxHeight:"80vh",borderRadius:8,boxShadow:"0 4px 24px rgba(0,0,0,0.5)"}}/>:<iframe src={file} title={nama} style={{width:"100%",height:"80vh",border:"none",borderRadius:8}}/>}
    </div>
    <div style={{background:NAVY,padding:"10px 16px"}} onClick={e=>e.stopPropagation()}>
      <a href={file} download={nama} style={{display:"block",padding:"11px",borderRadius:9,background:GOLD,color:NAVY,textAlign:"center",fontSize:14,fontWeight:700,textDecoration:"none"}}>Unduh File</a>
    </div>
  </div>;
}

// ==================== UNDANGAN UPLOAD ====================
function UndanganBlock({ev,canEdit,onUpload,onRemove}){
  const ref=useRef();const[load,setL]=useState(false);const[view,setV]=useState(false);
  const handleFile=f=>{
    if(!f)return;
    const ok=f.type==="application/pdf"||f.type.startsWith("image/");
    if(!ok){globalToast("Hanya file PDF atau gambar (JPG/PNG) yang didukung.");return;}
    if(f.size>15*1024*1024){globalToast("Ukuran file maksimal 15MB.");return;}
    setL(true);onUpload(f,f.name).finally(()=>setL(false));
  };
  const isImg=ev.undanganNama?.match(/\.(jpg|jpeg|png|webp)$/i);
  if(ev.undanganFile)return <>
    {view&&<FileViewModal file={ev.undanganFile} nama={ev.undanganNama||"Berkas Undangan"} onClose={()=>setV(false)}/>}
    <div style={{background:"#f0f9ff",borderRadius:10,padding:11,border:"1.5px solid #bae6fd"}}>
      <div style={{fontSize:12,color:"#0284c7",fontWeight:700,marginBottom:7}}>Berkas Undangan</div>
      <div style={{display:"flex",alignItems:"center",gap:8,background:"white",borderRadius:8,padding:"8px 10px",border:"1px solid #bae6fd",marginBottom:7}}>
        <span style={{fontSize:16}}>{isImg?"IMG":"PDF"}</span>
        <div style={{flex:1,minWidth:0,fontSize:12,fontWeight:600,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.undanganNama||"Berkas Undangan"}</div>
      </div>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>setV(true)} style={{flex:1,padding:"8px",borderRadius:8,border:"1.5px solid #0284c7",background:"white",color:"#0284c7",cursor:"pointer",fontSize:12,fontWeight:700}}>Lihat</button>
        <a href={ev.undanganFile} download={ev.undanganNama} style={{flex:1,padding:"8px",borderRadius:8,border:"none",background:"#0284c7",color:"white",textDecoration:"none",textAlign:"center",fontSize:12,fontWeight:700,display:"block"}}>Unduh</a>
        {canEdit&&<><input ref={ref} type="file" accept="application/pdf,image/*" onChange={e=>{handleFile(e.target.files[0]);e.target.value="";}} style={{display:"none"}}/><button onClick={()=>ref.current.click()} disabled={load} style={{padding:"8px 10px",borderRadius:8,border:"1.5px solid #94a3b8",background:"white",color:"#64748b",cursor:load?"default":"pointer",fontSize:11,fontWeight:700}}>{load?"...":"Ganti"}</button><button onClick={onRemove} style={{padding:"8px 10px",borderRadius:8,border:"1.5px solid #fca5a5",background:"white",color:"#ef4444",cursor:"pointer",fontSize:11,fontWeight:700}}>Hapus</button></>}
      </div>
    </div>
  </>;
  if(!canEdit)return <div style={{padding:"8px 10px",background:"#fef9c3",borderRadius:8,fontSize:12,color:"#92400e",fontWeight:600}}>Berkas undangan belum diupload</div>;
  return <div style={{background:"#fafafa",borderRadius:10,padding:11,border:"1.5px dashed #7dd3fc"}}>
    <div style={{fontSize:12,color:"#64748b",fontWeight:700,marginBottom:6}}>Upload Berkas Undangan (Opsional)</div>
    <input ref={ref} type="file" accept="application/pdf,image/*" onChange={e=>{handleFile(e.target.files[0]);e.target.value="";}} style={{display:"none"}}/>
    <button onClick={()=>ref.current.click()} disabled={load} style={{width:"100%",padding:"11px",borderRadius:8,border:"1.5px dashed #0284c7",background:load?"#f1f5f9":"white",color:"#0284c7",cursor:load?"default":"pointer",fontSize:13,fontWeight:700}}>{load?"Mengunggah...":"Upload PDF / Foto Undangan"}</button>
  </div>;
}

// ==================== SAMBUTAN BLOCK (DOCX→PDF) ====================
function SambutanBlock({ev,canUpload,onUploadDocx,onUploadPdf,onRemove}){
  const NAVY_="#0A1628",GREEN_="#0D6B4F",GOLD_="#C9A84C";
  const ref=useRef();
  const[step,setStep]=React.useState("idle");
  const[progress,setProgress]=React.useState("");
  const[pdfPreview,setPdfPreview]=React.useState(null);
  const[errMsg,setErrMsg]=React.useState("");
  const[viewPdf,setViewPdf]=React.useState(false);
  const[drag,setDrag]=React.useState(false);

  const DOCX_MIME="application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const PDF_MIME="application/pdf";

  const handleFile=async(f)=>{
    if(!f)return;
    const isDocx=f.type===DOCX_MIME||f.name.toLowerCase().endsWith(".docx");
    const isPdf=f.type===PDF_MIME||f.name.toLowerCase().endsWith(".pdf");
    if(!isDocx&&!isPdf){globalToast("Format tidak didukung. Gunakan file .docx atau .pdf.");return;}
    if(f.size>10*1024*1024){globalToast("Ukuran file maksimal 10MB.");return;}
    if(isPdf){
      setStep("processing");setErrMsg("");setProgress("Mengupload PDF...");
      try{await onUploadPdf(f,f.name);setStep("done");setProgress("");}
      catch(e){setStep("error");setErrMsg(e.message||"Gagal upload PDF");}
      return;
    }
    if(f.size>5*1024*1024){globalToast("Ukuran file DOCX maksimal 5MB.");return;}
    setStep("processing");setErrMsg("");
    try{
      setProgress("Membaca dokumen DOCX...");await new Promise(r=>setTimeout(r,300));
      setProgress("Mengolah isi naskah...");await new Promise(r=>setTimeout(r,400));
      setProgress("Membuat PDF resmi...");
      const result=await onUploadDocx(f);
      if(result?.pdfBase64)setPdfPreview("data:application/pdf;base64,"+result.pdfBase64);
      setStep("done");setProgress("");
    }catch(e){setStep("error");setErrMsg(e.message||"Gagal memproses file");}
  };

  const handleDrop=e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);};

  if(ev.sambutanFile){
    const previewUrl=pdfPreview||ev.sambutanFile;
    const isPdfDirect=!ev.sambutanDocxNama;
    return <>
      {viewPdf&&<div style={{position:"fixed",inset:0,zIndex:8500,background:"rgba(0,0,0,0.92)",display:"flex",flexDirection:"column"}}>
        <div style={{background:NAVY_,padding:"11px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <span style={{color:"white",fontWeight:700,fontSize:13,flex:1}}>{"📄 "+ev.sambutanNama}</span>
          {ev.sambutanDocx&&<a href={ev.sambutanDocx} download={ev.sambutanDocxNama||"naskah.docx"} style={{padding:"6px 12px",borderRadius:7,background:GOLD_,color:NAVY_,textDecoration:"none",fontSize:11,fontWeight:700}}>⬇ DOCX Asli</a>}
          <a href={ev.sambutanFile} download={ev.sambutanNama} style={{padding:"6px 12px",borderRadius:7,background:"white",color:NAVY_,textDecoration:"none",fontSize:11,fontWeight:700}}>⬇ PDF</a>
          <button onClick={()=>setViewPdf(false)} style={{padding:"6px 12px",borderRadius:7,background:"rgba(255,255,255,0.15)",border:"none",color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>✕ Tutup</button>
        </div>
        <div style={{flex:1,overflow:"hidden",background:"#1a1a2e",display:"flex",alignItems:"stretch"}}>
          <iframe src={previewUrl+"#toolbar=1&navpanes=0"} title="Naskah Sambutan" style={{width:"100%",border:"none"}}/>
        </div>
      </div>}
      <div style={{background:"linear-gradient(135deg,#ECFDF5,#D1FAE5)",borderRadius:12,padding:13,border:"1.5px solid #6EE7B7"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <div style={{width:36,height:36,borderRadius:9,background:GREEN_,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📄</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{fontSize:12,fontWeight:800,color:GREEN_}}>Naskah Sambutan</div>
              {isPdfDirect&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:10,background:"#e0f2fe",color:"#0369a1",fontWeight:700}}>PDF</span>}
            </div>
            <div style={{fontSize:11,color:"#065f46",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.sambutanNama}</div>
            {ev.sambutanDocxNama&&<div style={{fontSize:10,color:"#6B7280",marginTop:1}}>{"📎 DOCX: "+ev.sambutanDocxNama}</div>}
          </div>
        </div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          <button onClick={()=>setViewPdf(true)} style={{flex:1,minWidth:80,padding:"9px 8px",borderRadius:9,border:"none",background:NAVY_,color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>👁 Baca PDF</button>
          <a href={ev.sambutanFile} download={ev.sambutanNama} style={{flex:1,minWidth:80,padding:"9px 8px",borderRadius:9,border:"1.5px solid "+NAVY_,background:"white",color:NAVY_,textDecoration:"none",textAlign:"center",fontSize:12,fontWeight:700}}>⬇ Unduh PDF</a>
          {canUpload&&<><button onClick={()=>{if(ref.current)ref.current.click();}} style={{padding:"9px 10px",borderRadius:9,border:"1.5px solid #94A3B8",background:"white",color:"#475569",cursor:"pointer",fontSize:11,fontWeight:700}}>🔄 Ganti</button><button onClick={onRemove} style={{padding:"9px 10px",borderRadius:9,border:"1.5px solid #FCA5A5",background:"white",color:"#EF4444",cursor:"pointer",fontSize:11,fontWeight:700}}>🗑</button><input ref={ref} type="file" accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" onChange={e=>{handleFile(e.target.files[0]);e.target.value="";}} style={{display:"none"}}/></>}
        </div>
      </div>
    </>;
  }

  if(canUpload){
    const isProcessing=step==="processing";
    return <div
      onDragOver={e=>{e.preventDefault();setDrag(true);}}
      onDragLeave={()=>setDrag(false)}
      onDrop={handleDrop}
      style={{borderRadius:12,border:"2px dashed "+(drag?"#6366F1":isProcessing?"#A5B4FC":"#C4B5FD"),background:drag?"#F5F3FF":isProcessing?"#F8F7FF":"#FAFAFA",padding:"20px 16px",transition:"all 0.2s"}}>
      <input ref={ref} type="file" accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" onChange={e=>{handleFile(e.target.files[0]);e.target.value="";}} style={{display:"none"}}/>
      <div style={{textAlign:"center"}}>
        {isProcessing
          ?<>
            <div style={{fontSize:28,marginBottom:8}}>⚙️</div>
            <div style={{fontSize:13,fontWeight:700,color:"#4F46E5",marginBottom:4}}>Memproses...</div>
            <div style={{fontSize:11,color:"#818CF8"}}>{progress}</div>
            <div style={{marginTop:12,height:4,background:"#E0E7FF",borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",background:"linear-gradient(90deg,#6366F1,#A5B4FC)",borderRadius:4}}/>
            </div>
          </>
          :step==="error"
          ?<>
            <div style={{fontSize:28,marginBottom:6}}>❌</div>
            <div style={{fontSize:13,fontWeight:700,color:"#DC2626",marginBottom:4}}>{errMsg}</div>
            <button onClick={()=>{setStep("idle");setErrMsg("");}} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #94A3B8",background:"white",color:"#475569",cursor:"pointer",fontSize:12,fontWeight:600}}>Coba Lagi</button>
          </>
          :<>
            <div style={{fontSize:32,marginBottom:8}}>📝</div>
            <div style={{fontSize:13,fontWeight:700,color:"#4F46E5",marginBottom:6}}>Upload Naskah Sambutan</div>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:12,flexWrap:"wrap"}}>
              <span style={{fontSize:10,padding:"3px 9px",borderRadius:10,background:"#EDE9FE",color:"#5B21B6",fontWeight:700}}>📝 DOCX → PDF Otomatis</span>
              <span style={{fontSize:10,padding:"3px 9px",borderRadius:10,background:"#E0F2FE",color:"#0369A1",fontWeight:700}}>📄 PDF Langsung</span>
            </div>
            <button onClick={()=>ref.current.click()} style={{padding:"10px 22px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#6366F1,#4F46E5)",color:"white",cursor:"pointer",fontSize:13,fontWeight:700,boxShadow:"0 3px 10px rgba(99,102,241,0.35)"}}>Pilih File</button>
            <div style={{fontSize:10,color:"#9CA3AF",marginTop:8}}>DOCX atau PDF · Maks 10MB · atau seret & lepas di sini</div>
          </>
        }
      </div>
    </div>;
  }
  return <div style={{padding:"9px 12px",background:"#FEF9C3",borderRadius:8,fontSize:12,color:"#92400E",fontWeight:600}}>⏳ Naskah sambutan belum diupload</div>;
}
// ==================== AI MODAL ====================
function AIModal({onFill,onClose}){
  const ref=useRef();const undanganRef=useRef();const[drag,setDrag]=useState(false);const[loading,setLoading]=useState(false);const[result,setResult]=useState(null);const[edited,setEdited]=useState(null);const[err,setErr]=useState("");const[undanganFile,setUndanganFile]=useState(null);const[undanganNama,setUndanganNama]=useState("");const[validErr,setValidErr]=useState("");
  const REQUIRED_FIELDS=["namaAcara","tanggal","jam","penyelenggara","kontak","buktiUndangan","pakaian","jenisKegiatan","lokasi"];
  // Kompres gambar ke maks 1024px & kualitas 0.75 sebelum kirim ke API
  const compressImage=async(file)=>{
    return new Promise((resolve)=>{
      const img=new Image();
      const url=URL.createObjectURL(file);
      img.onload=()=>{
        URL.revokeObjectURL(url);
        const MAX=1024;
        let w=img.width,h=img.height;
        if(w>MAX||h>MAX){if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;}}
        const canvas=document.createElement("canvas");
        canvas.width=w;canvas.height=h;
        canvas.getContext("2d").drawImage(img,0,0,w,h);
        const compressed=canvas.toDataURL("image/jpeg",0.75);
        resolve(compressed.split(",")[1]);
      };
      img.onerror=()=>{
        // Gagal kompres, pakai original
        const r=new FileReader();
        r.onload=e=>resolve(e.target.result.split(",")[1]);
        r.readAsDataURL(file);
      };
      img.src=url;
    });
  };

  const analyze=async f=>{
    setLoading(true);setErr("");setResult(null);setEdited(null);
    try{
      const isPdf=f.type==="application/pdf";
      let b64,mimeType;
      if(isPdf){
        // PDF: baca langsung, cek ukuran max 4MB
        if(f.size>4*1024*1024){setErr("PDF terlalu besar (maks 4MB). Coba PDF yang lebih kecil.");setLoading(false);return;}
        b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(f);});
        mimeType="application/pdf";
      } else {
        // Gambar: kompres dulu ke maks 1024px / JPEG 75%
        b64=await compressImage(f);
        mimeType="image/jpeg";
      }
      const PROMPT='Balas HANYA JSON ini tanpa penjelasan. Tanggal: YYYY-MM-DD, Jam: HH:MM: {"namaAcara":"","tanggal":"","jam":"","penyelenggara":"","kontak":"","pakaian":"","jenisKegiatan":"","catatan":"","buktiUndangan":"","lokasi":"","untukPimpinan":["walikota"]}';
      const bodyContent=isPdf
        ?[{type:"document",source:{type:"base64",media_type:mimeType,data:b64}},{type:"text",text:PROMPT}]
        :[{type:"image",source:{type:"base64",media_type:mimeType,data:b64}},{type:"text",text:PROMPT}];
      // Call via /api/ai proxy (Vercel serverless function) to avoid CORS & hide API key
      const resp=await fetch("/api/ai",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{role:"user",content:bodyContent}]
        })
      });
      const data=await resp.json().catch(()=>null);
      if(!resp.ok){
        const errMsg=data&&data.error?(typeof data.error==="string"?data.error:JSON.stringify(data.error)):"Server error HTTP "+resp.status+" — cek Vercel Function Logs";
        throw new Error(errMsg);
      }
      if(data&&data.error){const em=typeof data.error==="string"?data.error:JSON.stringify(data.error);throw new Error(em);}
      if(!data||!data.content){throw new Error("Respons tidak valid: "+(data?JSON.stringify(data).slice(0,200):"null"));}
      const txt=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
      const cleaned=txt.replace(/```(?:json)?\s*/gi,"").replace(/```/g,"").trim();
      const m=cleaned.match(/{[\s\S]*}/);
      if(!m)throw new Error("AI tidak mengembalikan JSON. Respons: "+cleaned.slice(0,120));
      const parsed=JSON.parse(m[0]);
      setResult(parsed);
      setEdited({...emptyForm,...parsed});
    }catch(e){
      if(e.message.includes("Failed to fetch")||e.message.includes("NetworkError")){
        setErr("Koneksi gagal. Periksa: (1) File api/ai.js sudah ada di GitHub, (2) GEMINI_API_KEY sudah diset di Vercel Environment Variables, (3) Klik Redeploy di Vercel setelah menambah env variable.");
      } else {
        setErr(typeof e.message==="string"?e.message:JSON.stringify(e.message));
      }
    }
    setLoading(false);
  };
  const handleFile=f=>{if(!f)return;if(!f.type.match(/pdf|image/)){setErr("Gunakan PDF atau gambar.");return;}setUndanganFile(f);setUndanganNama(f.name);analyze(f);};
  const inp={width:"100%",padding:"9px 11px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:14,background:"white",color:"#1e293b"};
  return <div style={{position:"fixed",inset:0,zIndex:8100,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:"white",borderRadius:16,width:"100%",maxWidth:520,maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"16px 20px 12px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1}}><div style={{fontSize:16,fontWeight:700,color:NAVY}}>Analisa Undangan AI</div><div style={{fontSize:12,color:"#64748b"}}>Upload PDF/foto undangan, form terisi otomatis</div></div>
        <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:13,fontWeight:700,color:"#64748b"}}>Tutup</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px 20px"}}>
        {!result&&!loading&&<>
          <input ref={ref} type="file" accept="application/pdf,image/*" onChange={e=>{handleFile(e.target.files[0]);e.target.value="";}} style={{display:"none"}}/>
          <div onClick={()=>ref.current.click()} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}} style={{border:"2px dashed "+(drag?"#6366f1":"#c7d2fe"),borderRadius:12,padding:"36px 20px",textAlign:"center",cursor:"pointer",background:drag?"#eef2ff":"#f8faff"}}>
            <div style={{fontSize:36,marginBottom:10}}>Unggah</div>
            <div style={{fontSize:15,fontWeight:700,color:NAVY,marginBottom:4}}>Seret atau klik untuk upload</div>
            <div style={{fontSize:13,color:"#64748b"}}>PDF, JPG, atau PNG undangan</div>
          </div>
          {err&&<div style={{marginTop:12,padding:"10px 12px",background:"#fee2e2",borderRadius:8,fontSize:13,color:"#991b1b"}}>{err}</div>}
        </>}
        {loading&&<div style={{textAlign:"center",padding:"40px 20px"}}>
          <div style={{width:48,height:48,border:"4px solid #e0e7ff",borderTopColor:"#6366f1",borderRadius:"50%",animation:"spin 0.9s linear infinite",margin:"0 auto 16px"}}/>
          <div style={{fontSize:14,fontWeight:700,color:NAVY,marginBottom:6}}>{result?"Mengompresi & mengunggah berkas...":"AI sedang membaca dokumen..."}</div>
          <div style={{fontSize:12,color:"#64748b"}}>{result?"Berkas dikompresi ke maks 1MB lalu dikirim ke server":"Menganalisa isi undangan, mohon tunggu"}</div>
          <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
        </div>}
        {edited&&<>
          <div style={{background:"#d1fae5",borderRadius:9,padding:"9px 12px",marginBottom:14,fontSize:13,color:GREEN,fontWeight:700}}>Analisa selesai. Periksa dan edit sebelum digunakan.</div>
          {[{k:"namaAcara",l:"Nama Acara *"},{k:"tanggal",l:"Tanggal *",t:"date"},{k:"jam",l:"Jam *",t:"time"},{k:"penyelenggara",l:"Penyelenggara *"},{k:"kontak",l:"Kontak *"},{k:"buktiUndangan",l:"No. Surat *"},{k:"lokasi",l:"Lokasi *"},{k:"catatan",l:"Catatan"}].map(f=><div key={f.k} style={{marginBottom:9}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:3}}>{f.l}</label><input type={f.t||"text"} value={edited[f.k]||""} onChange={e=>setEdited(p=>({...p,[f.k]:e.target.value}))} style={inp}/></div>)}
          <div style={{marginBottom:9}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:3}}>Pakaian *</label><select value={edited.pakaian||"PDH"} onChange={e=>setEdited(p=>({...p,pakaian:e.target.value}))} style={{...inp,WebkitAppearance:"none"}}>{PAKAIAN.map(x=><option key={x}>{x}</option>)}</select></div>
          <div style={{marginBottom:9}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:3}}>Jenis Kegiatan *</label><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{JENIS.map(j=><button key={j} type="button" onClick={()=>setEdited(p=>({...p,jenisKegiatan:j}))} style={{padding:"6px 12px",borderRadius:8,border:"1.5px solid "+(edited.jenisKegiatan===j?NAVY:"#e2e8f0"),background:edited.jenisKegiatan===j?NAVY:"white",color:edited.jenisKegiatan===j?"white":"#64748b",cursor:"pointer",fontSize:12,fontWeight:700}}>{j}</button>)}</div></div>
          <div style={{marginBottom:9}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:3}}>Berkas Undangan</label>
            <input ref={undanganRef} type="file" accept="application/pdf,image/*" onChange={e=>{const f=e.target.files[0];if(f){setUndanganFile(f);setUndanganNama(f.name);}e.target.value="";}} style={{display:"none"}}/>
            {undanganFile
              ?<div style={{borderRadius:9,overflow:"hidden",border:"1.5px solid #86efac"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"#f0fdf4"}}>
                    <span style={{fontSize:13}}>✅</span>
                    <span style={{fontSize:11,color:"#15803d",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600}}>{undanganNama}</span>
                    <button type="button" onClick={()=>{setUndanganFile(null);setUndanganNama("");}} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:13,fontWeight:700}}>✕</button>
                  </div>
                  <div style={{display:"flex",gap:0}}>
                    <button type="button" onClick={()=>undanganRef.current.click()} style={{flex:1,padding:"6px 8px",border:"none",borderTop:"1px solid #bbf7d0",background:"#f8fffe",color:"#15803d",cursor:"pointer",fontSize:11,fontWeight:600}}>🔄 Ganti File</button>
                  </div>
                </div>
              :<button type="button" onClick={()=>undanganRef.current.click()} style={{width:"100%",padding:"9px",borderRadius:8,border:"2px dashed #c7d2fe",background:"#f8faff",color:NAVY,cursor:"pointer",fontSize:12,fontWeight:600}}>📎 Klik untuk upload berkas undangan</button>}
          </div>
          {validErr&&<div style={{padding:"8px 12px",background:"#fee2e2",borderRadius:8,fontSize:12,color:"#991b1b",marginBottom:8}}>{validErr}</div>}
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <button onClick={()=>{setResult(null);setEdited(null);setErr("");setUndanganFile(null);setUndanganNama("");setValidErr("");}} style={{flex:1,padding:"11px",borderRadius:9,border:"1.5px solid #e2e8f0",background:"white",cursor:"pointer",fontSize:13,fontWeight:600,color:"#64748b"}}>Ulangi</button>
            <button onClick={async()=>{
              const missing=REQUIRED_FIELDS.filter(k=>!edited[k]||!String(edited[k]).trim());
              if(missing.length>0){setValidErr("Wajib diisi: "+missing.map(k=>({namaAcara:"Nama Acara",tanggal:"Tanggal",jam:"Jam",penyelenggara:"Penyelenggara",kontak:"Kontak",buktiUndangan:"No. Surat",pakaian:"Pakaian",jenisKegiatan:"Jenis Kegiatan",lokasi:"Lokasi"})[k]).join(", "));return;}
              setValidErr("");
              let finalUndanganFile=null;let finalUndanganNama=undanganNama;
              if(undanganFile){
                setLoading(true);
                try{
                  // Kompres ke maks 1MB
                  const compressed=await compressFileTo1MB(undanganFile);
                  finalUndanganNama=compressed.name||undanganNama;
                  // Upload ke Supabase storage
                  if(SUPA_OK){
                    const path="ai-"+Date.now();
                    const url=await storageUpload("undangan",path,compressed).catch(()=>null);
                    if(url){finalUndanganFile=url;}
                    else{
                      // Fallback: simpan base64 jika upload gagal
                      finalUndanganFile=await new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsDataURL(compressed);});
                    }
                  } else {
                    // Offline: simpan base64
                    const compressed2=await compressFileTo1MB(undanganFile);
                    finalUndanganFile=await new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsDataURL(compressed2);});
                  }
                }catch(e){console.error("Upload undangan gagal:",e);}
                setLoading(false);
              }
              onFill({...edited,undanganFile:finalUndanganFile,undanganNama:finalUndanganNama});
            }} style={{flex:2,padding:"11px",borderRadius:9,border:"none",background:NAVY,color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>Gunakan Data Ini</button>
          </div>
        </>}
      </div>
    </div>
  </div>;
}

// ==================== SUMMARY MODAL ====================
function SummaryModal({events,onToggleHide,onClose}){
  const NAVY="#0A1628";
  const[mode,setMode]=React.useState("today");
  const[from,setFrom]=React.useState(todayStr());
  const[to,setTo]=React.useState(tomorrowStr());
  const filtered=events.filter(e=>{
    if(e.alur!=="disetujui")return false;
    if(mode==="today")return e.tanggal===todayStr();
    if(mode==="tomorrow")return e.tanggal===tomorrowStr();
    if(mode==="range")return e.tanggal>=from&&e.tanggal<=to;
    return false;
  }).sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));
  const pub=filtered.filter(e=>!e.tersembunyi);
  const modeLabel=mode==="today"?getHari(todayStr())+", "+fmt(todayStr()):mode==="tomorrow"?getHari(tomorrowStr())+", "+fmt(tomorrowStr()):fmt(from)+" s/d "+fmt(to);
  const NL="\n";
  const shareLines=["*AGENDA KEGIATAN PIMPINAN*","*"+modeLabel+"*",""];
  pub.forEach((ev,i)=>{
    shareLines.push("*"+(i+1)+". "+ev.namaAcara+"*");
    const tglStr=mode==="range"?(getHari(ev.tanggal)||"")+", "+(fmt(ev.tanggal)||"")+" | ":"";
    shareLines.push(tglStr+ev.jam+" WITA");
    if(ev.penyelenggara)shareLines.push("Penyelenggara: "+ev.penyelenggara);
    if(ev.lokasi)shareLines.push("Lokasi: "+ev.lokasi);
    // Keterangan kehadiran pimpinan
    const hadirParts=[];
    const forWK=(ev.untukPimpinan||[]).includes("walikota");
    const forWWK=(ev.untukPimpinan||[]).includes("wakilwalikota")||ev.delegasiKeWWK;
    if(forWK){
      if((ev.statusWK==="diwakilkan"&&ev.perwakilanWK)||(ev.delegasiKeWWK&&ev.perwakilanWK))hadirParts.push(ev.perwakilanWK);
      else if(ev.delegasiKeWWK)hadirParts.push("Wakil Wali Kota");
      else hadirParts.push("Wali Kota");
    }
    if(forWWK&&!ev.delegasiKeWWK){
      if(ev.statusWWK==="diwakilkan"&&ev.perwakilanWWK)hadirParts.push(ev.perwakilanWWK);
      else hadirParts.push("Wakil Wali Kota");
    }
    if(hadirParts.length>0)shareLines.push("Dihadiri: "+[...new Set(hadirParts)].join(" & "));
    shareLines.push("");
  });
  shareLines.push("_Disiapkan oleh Protokol & Komunikasi Pimpinan Setda Kota Tarakan_");
  const shareText=shareLines.join(NL);
  const copy=()=>{navigator.clipboard.writeText(shareText).catch(()=>{const ta=document.createElement("textarea");ta.value=shareText;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);});};
  const printF4L=()=>{
    const _now=new Date();
    const printDate=_now.toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
    const printTime=_now.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
    const rows=pub.map((ev,i)=>{
      const tgl=ev.tanggal?`<b>${getHari(ev.tanggal)}, ${fmt(ev.tanggal)}</b>`:"";
      const pim=(ev.untukPimpinan||[]).map(p=>{if(p==="walikota")return "WK"+(ev.besertaIstriWK?" + Istri":"");if(p==="wakilwalikota")return "WWK"+(ev.besertaIstriWWK?" + Istri":"");return p;}).join(", ")||"-";
      return `<tr><td class="c">${i+1}</td><td class="nw">${tgl}</td><td class="c"><b>${ev.jam}</b> WITA</td><td><b>${ev.namaAcara}</b><br><span class="sub">${ev.penyelenggara||""}</span></td><td>${ev.lokasi||"-"}</td><td class="c">${pim}</td></tr>`;
    }).join("");
    const w=window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Agenda ${modeLabel}</title>
<style>@page{size:330mm 210mm landscape;margin:1.2cm 1.8cm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Arial,sans-serif;font-size:9pt;color:#1a1a1a;margin:0}.kop{display:flex;align-items:center;gap:14px;border-bottom:3px solid #0B2545;padding-bottom:8px;margin-bottom:8px}.kop img{width:46px;height:46px;object-fit:contain}.kop h1{font-size:11pt;font-weight:900;color:#0B2545;margin:0 0 1px}.kop h2{font-size:8.5pt;font-weight:700;color:#0B2545;margin:0 0 2px}.kop p{font-size:7.5pt;color:#475569;margin:0}.jdl{text-align:center;margin:6px 0 10px}.jdl h3{font-size:12pt;font-weight:900;color:#0B2545;margin:0;text-transform:uppercase;letter-spacing:1px}.jdl p{font-size:8.5pt;color:#475569;margin:3px 0 0}table{width:100%;border-collapse:collapse}thead th{background:#0B2545;color:#FFFFFF;padding:7px 8px;text-align:left;font-size:8.5pt;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}thead th.c{text-align:center}tbody td{padding:7px 8px;border:1px solid #dde4ef;vertical-align:top;line-height:1.5}tbody tr:nth-child(even) td:not(.nw){background:#f8fafc}.c{text-align:center}.nw{white-space:nowrap}.sub{font-size:8pt;color:#64748b}.info{font-size:8pt;color:#64748b;text-align:right;margin-bottom:6px}.foot{margin-top:10px;font-size:7.5pt;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:5px}</style></head><body>
<div class="kop"><img src="/logo_tarakan.png" onerror="this.style.display='none'"/><div><h1>PEMERINTAH KOTA TARAKAN</h1><h2>BAGIAN PROTOKOL DAN KOMUNIKASI PIMPINAN</h2><p>Sekretariat Daerah Kota Tarakan</p></div></div>
<div class="jdl"><h3>Agenda Kegiatan Pimpinan</h3><p>${modeLabel} &bull; Total: <b>${pub.length} agenda</b></p></div>
<div class="info">Dicetak: ${printDate} pukul ${printTime} WITA</div>
<table><thead><tr><th class="c" style="width:24px">No</th><th style="width:110px">Hari/Tanggal</th><th class="c" style="width:65px">Pukul</th><th>Nama Acara / Penyelenggara</th><th style="width:170px">Lokasi</th><th class="c" style="width:55px">Pimpinan</th></tr></thead><tbody>${rows}</tbody></table>
<p class="foot">Sistem Terpadu Jadwal dan Agenda Kegiatan Pimpinan &bull; Bagian Protokol dan Komunikasi Pimpinan Setda Kota Tarakan &bull; #TarakanHibot</p>
</body></html>`);
    w.document.close();w.print();
  };
  return <div style={{position:"fixed",inset:0,zIndex:8100,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:"white",borderRadius:16,width:"100%",maxWidth:500,maxHeight:"88vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"16px 20px 12px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1}}><div style={{fontSize:16,fontWeight:700,color:NAVY}}>Rekap Agenda WA</div><div style={{fontSize:12,color:"#94A3B8",marginTop:2}}>{pub.length} agenda aktif</div></div>
        <button onClick={onClose} aria-label="Tutup" style={{background:"#f1f5f9",border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:13}}>&#x2715;</button>
      </div>
      <div style={{padding:"12px 20px",borderBottom:"1px solid #f1f5f9",display:"flex",gap:6,flexWrap:"wrap"}}>
        {[{k:"today",l:"Hari Ini"},{k:"tomorrow",l:"Besok"},{k:"range",l:"Rentang"}].map(m=>(
          <button key={m.k} onClick={()=>setMode(m.k)} style={{padding:"6px 14px",borderRadius:20,border:"none",background:mode===m.k?NAVY:"#f1f5f9",color:mode===m.k?"white":"#334155",fontSize:12,fontWeight:mode===m.k?700:400,cursor:"pointer"}}>
            {m.l}
          </button>
        ))}
        {mode==="range"&&<div style={{display:"flex",gap:6,alignItems:"center",width:"100%",marginTop:6}}>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{flex:1,padding:"7px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:12}}/>
          <span style={{color:"#94a3b8",fontSize:12}}>s/d</span>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{flex:1,padding:"7px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:12}}/>
        </div>}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px 20px 20px"}}>
        {filtered.length===0?<div style={{textAlign:"center",padding:"30px",color:"#94a3b8",fontSize:14}}>Tidak ada agenda pada periode ini</div>:
        <>{filtered.map(ev=><div key={ev.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,marginBottom:8,background:ev.tersembunyi?"#f8fafc":"white",border:"1px solid #f1f5f9",opacity:ev.tersembunyi?0.5:1}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700,color:"#0F2040",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.namaAcara}</div>
            <div style={{fontSize:11,color:"#64748b"}}>{mode==="range"?fmt(ev.tanggal)+" · ":""}{ev.jam} WITA | {ev.penyelenggara}</div>
          </div>
          <button onClick={()=>onToggleHide(ev.id)} style={{flexShrink:0,padding:"5px 10px",borderRadius:8,border:"1.5px solid "+(ev.tersembunyi?"#94a3b8":NAVY),background:ev.tersembunyi?"#f1f5f9":"white",color:ev.tersembunyi?"#94a3b8":NAVY,cursor:"pointer",fontSize:11,fontWeight:600}}>
            {ev.tersembunyi?"Tampilkan":"Sembunyikan"}
          </button>
        </div>)}
        {pub.length>0&&<>
          <div style={{background:"#f8fafc",borderRadius:10,padding:12,border:"1px solid #e2e8f0",marginTop:6,marginBottom:12}}><textarea readOnly value={shareText} style={{width:"100%",border:"none",background:"transparent",resize:"none",fontSize:12,color:"#334155",fontFamily:"sans-serif",lineHeight:1.7,outline:"none",height:"auto",minHeight:120}} rows={shareLines.length}/></div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button onClick={copy} style={{padding:"12px",borderRadius:10,border:"none",background:NAVY,color:"white",cursor:"pointer",fontWeight:700,fontSize:13}}>Salin Teks WA</button>
            <button onClick={printF4L} style={{padding:"12px",borderRadius:10,border:"1.5px solid "+NAVY,background:"white",color:NAVY,cursor:"pointer",fontWeight:700,fontSize:13}}>🖨️ Cetak F4 Landscape</button>
          </div>
        </>}</>}
      </div>
    </div>
  </div>;
}

// Helper: label tujuan pimpinan detail
function tujuanPimpinanLabel(ev){
  const parts=[];
  const forWK=(ev.untukPimpinan||[]).includes("walikota");
  const forWWK=(ev.untukPimpinan||[]).includes("wakilwalikota")||ev.delegasiKeWWK;
  if(forWK){
    if(ev.besertaIstriWK) parts.push("Wali Kota dan Istri");
    else parts.push("Wali Kota");
  }
  if(forWWK){
    if(ev.delegasiKeWWK){
      if(ev.besertaIstriWWK) parts.push("Wakil Wali Kota dan Istri (Delegasi)");
      else parts.push("Wakil Wali Kota (Delegasi)");
    } else {
      if(ev.besertaIstriWWK) parts.push("Wakil Wali Kota dan Istri");
      else parts.push("Wakil Wali Kota");
    }
  }
  return parts.join(", ")||"-";
}
const TujuanBadge=({ev})=>{
  const label=tujuanPimpinanLabel(ev);
  return <div style={{fontSize:11,color:"#1E40AF",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,padding:"3px 9px",fontWeight:700,display:"inline-flex",alignItems:"center",gap:4}}>
    <span style={{fontSize:12}}>🎯</span> {label}
  </div>;
};


// ==================== BROADCAST MODAL ====================
function BroadcastModal({onClose,showT,senderNama}){
  const NAVY="#0A1628";
  const DEFAULT_MSG=`📢 *PENGUMUMAN*
Yth. teman-teman Bagian Protokol dan Komunikasi Pimpinan Setda Kota Tarakan dan para mitra kerja yang baik hatinya.
━━━━━━━━━━━━━━━━━━━━━

Dengan hormat,

Diinformasikan kepada seluruh tim Prokopim bahwa Sistem Terpadu Jadwal dan Agenda Kegiatan Pimpinan kini telah resmi beroperasi melalui domain:

🌐 *https://prokopim.tarakankota.go.id*

Mulai hari ini, seluruh aktivitas penginputan, persetujuan, dan pemantauan jadwal pimpinan dilakukan melalui alamat tersebut.

📌 *Yang perlu dilakukan:*
• Akses melalui link di atas
• Simpan/bookmark di browser Anda
• Bagi pengguna HP: tambahkan ke layar utama (Add to Home Screen)
• Login menggunakan akun yang sudah dimiliki

⚠️ Link lama (Vercel) tidak lagi digunakan.

Apabila mengalami kendala akses, jangan ragu untuk bertanya.

Terima kasih dan salam sayang 🫶

_${senderNama||"Kabag Protokol dan Komunikasi Pimpinan"}_
_Setda Kota Tarakan_`;

  const[pesan,setPesan]=React.useState(DEFAULT_MSG);
  const[status,setStatus]=React.useState("idle"); // idle|sending|done|error
  const[log,setLog]=React.useState([]);
  const[errMsg,setErrMsg]=React.useState("");

  const allUsers=loadUsers();
  const targets=allUsers.filter(u=>u.noWA&&u.noWA.trim());

  const kirim=async()=>{
    if(!pesan.trim()){showT("Pesan tidak boleh kosong","warn");return;}
    if(targets.length===0){showT("Tidak ada pengguna dengan nomor WA","warn");return;}
    setStatus("sending");setLog([]);setErrMsg("");
    const results=[];
    for(const u of targets){
      try{
        const resp=await fetch("/api/whatsapp",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({to:u.noWA,pesan,event:"broadcast"})
        });
        const ok=resp.ok;
        results.push({nama:u.nama||u.username,ok});
      }catch(e){
        results.push({nama:u.nama||u.username,ok:false});
      }
      setLog([...results]);
      await new Promise(r=>setTimeout(r,350)); // jeda antar kirim
    }
    const berhasil=results.filter(r=>r.ok).length;
    setStatus("done");
    showT(`Pengumuman terkirim ke ${berhasil}/${results.length} pengguna`,"ok");
  };

  const berhasil=log.filter(r=>r.ok).length;
  const gagal=log.filter(r=>!r.ok).length;

  return <div style={{position:"fixed",inset:0,zIndex:8100,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:"white",borderRadius:16,width:"100%",maxWidth:520,maxHeight:"92vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"16px 20px 12px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:10,background:"linear-gradient(135deg,#0A1628,#1B4080)",borderRadius:"16px 16px 0 0"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:16,fontWeight:700,color:"white"}}>📢 Kirim Pengumuman</div>
          <div style={{fontSize:12,color:"#93C5FD",marginTop:2}}>WA blast ke {targets.length} pengguna terdaftar</div>
        </div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:13,color:"white",fontWeight:700}}>✕</button>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 20px 20px"}}>
        {status==="idle"&&<>
          {/* Daftar penerima */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:"#475569",marginBottom:8}}>Penerima ({targets.length} orang)</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {targets.map(u=><span key={u.username} style={{fontSize:10,padding:"3px 8px",borderRadius:10,background:"#EFF6FF",color:"#1D4ED8",fontWeight:600}}>{u.nama||u.username}</span>)}
            </div>
            {targets.length===0&&<div style={{padding:"10px",background:"#fef3c7",borderRadius:8,fontSize:12,color:"#92400e"}}>⚠️ Belum ada pengguna dengan nomor WA terdaftar</div>}
          </div>

          {/* Isi pesan */}
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:"#475569",marginBottom:6}}>Isi Pengumuman</label>
            <textarea value={pesan} onChange={e=>setPesan(e.target.value)} rows={14}
              style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:12,fontFamily:"monospace",lineHeight:1.6,resize:"vertical",boxSizing:"border-box",color:"#1e293b"}}/>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:4,textAlign:"right"}}>{pesan.length} karakter</div>
          </div>

          <button onClick={kirim} disabled={targets.length===0}
            style={{width:"100%",padding:"14px",borderRadius:12,border:"none",
              background:targets.length>0?"linear-gradient(135deg,#0A1628,#1B4080)":"#E2E8F0",
              color:targets.length>0?"white":"#94A3B8",cursor:targets.length>0?"pointer":"default",
              fontWeight:700,fontSize:14}}>
            📤 Kirim ke Semua ({targets.length} orang)
          </button>
        </>}

        {status==="sending"&&<>
          <div style={{textAlign:"center",padding:"12px 0 18px"}}>
            <div style={{width:48,height:48,border:"4px solid #e0e7ff",borderTopColor:NAVY,borderRadius:"50%",animation:"spin 0.9s linear infinite",margin:"0 auto 14px"}}/>
            <div style={{fontSize:14,fontWeight:700,color:NAVY,marginBottom:4}}>Mengirim pengumuman...</div>
            <div style={{fontSize:12,color:"#64748b"}}>{log.length} / {targets.length} terkirim</div>
            <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
          </div>
          {/* Progress bar */}
          <div style={{height:6,background:"#e2e8f0",borderRadius:4,overflow:"hidden",marginBottom:14}}>
            <div style={{height:"100%",background:"linear-gradient(90deg,#0A1628,#3B82F6)",borderRadius:4,width:(log.length/targets.length*100)+"%",transition:"width 0.3s"}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {log.map((r,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:8,background:r.ok?"#f0fdf4":"#fef2f2"}}>
              <span style={{fontSize:13}}>{r.ok?"✅":"❌"}</span>
              <span style={{fontSize:12,color:r.ok?"#15803d":"#b91c1c",fontWeight:600}}>{r.nama}</span>
            </div>)}
          </div>
        </>}

        {status==="done"&&<>
          <div style={{textAlign:"center",padding:"20px 0 16px"}}>
            <div style={{fontSize:42,marginBottom:10}}>🎉</div>
            <div style={{fontSize:16,fontWeight:800,color:NAVY,marginBottom:4}}>Pengumuman Terkirim!</div>
            <div style={{fontSize:13,color:"#64748b"}}>
              <span style={{color:"#15803d",fontWeight:700}}>{berhasil} berhasil</span>
              {gagal>0&&<> · <span style={{color:"#b91c1c",fontWeight:700}}>{gagal} gagal</span></>}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:16}}>
            {log.map((r,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:8,background:r.ok?"#f0fdf4":"#fef2f2"}}>
              <span style={{fontSize:13}}>{r.ok?"✅":"❌"}</span>
              <span style={{fontSize:12,color:r.ok?"#15803d":"#b91c1c",fontWeight:600}}>{r.nama}</span>
            </div>)}
          </div>
          <button onClick={onClose} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:NAVY,color:"white",fontWeight:700,fontSize:14,cursor:"pointer"}}>Tutup</button>
        </>}
      </div>
    </div>
  </div>;
}


function ReportingModal({events,onClose,kabagNama,cetakOleh}){
  const[mode,setMode]=useState("today");const[from,setFrom]=useState(todayStr());const[to,setTo]=useState(todayStr());const[printMode,setPrintMode]=useState("a4");
  const modeLabel={today:"Hari Ini",tomorrow:"Besok",week:"Minggu Ini",month:"Bulan Ini",range:"Rentang"};
  const filtered=events.filter(e=>{
    if(mode==="today")return e.tanggal===todayStr();if(mode==="tomorrow")return e.tanggal===tomorrowStr();
    if(mode==="week")return e.tanggal>=weekStart()&&e.tanggal<=weekEnd();if(mode==="month")return e.tanggal>=monthStart()&&e.tanggal<=monthEnd();
    if(mode==="range")return e.tanggal>=from&&e.tanggal<=to;return true;
  }).filter(e=>e.alur==="disetujui").sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));
  const rangeLabel=()=>{if(mode==="today")return fmt(todayStr());if(mode==="tomorrow")return fmt(tomorrowStr());if(mode==="week")return fmt(weekStart())+" s.d. "+fmt(weekEnd());if(mode==="month"){const d=new Date();return d.toLocaleDateString("id-ID",{month:"long",year:"numeric"});}if(mode==="range"&&from&&to)return fmt(from)+" s.d. "+fmt(to);return "-";};
  const printPDF=()=>{
    const w=window.open("","_blank");
    const _now=new Date();
    const printDate=_now.toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
    const printTime=_now.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
    // Group by tanggal — no rowspan, each row shows its own date (same as F4)
    const byTgl={};
    filtered.forEach(ev=>{if(!byTgl[ev.tanggal])byTgl[ev.tanggal]=[];byTgl[ev.tanggal].push(ev);});
    let nomor=0;
    const rows=Object.keys(byTgl).sort().flatMap(tgl=>{
      return byTgl[tgl].map((ev,iInGroup)=>{
        nomor++;
        const hadir=(function(e){var l=[];var wk=(e.untukPimpinan||[]).includes("walikota");var wwk=(e.untukPimpinan||[]).includes("wakilwalikota")||e.delegasiKeWWK;if(wk&&!e.delegasiKeWWK){if(e.statusWK==="hadir")l.push("Wali Kota"+(e.besertaIstriWK?" (beserta Istri)":""));else if(e.statusWK==="diwakilkan"&&e.perwakilanWK)l.push(e.perwakilanWK);else if(e.statusWK==="diwakilkan")l.push("Perwakilan WK");}if(wwk){if(e.statusWWK==="hadir")l.push("Wakil Wali Kota"+(e.besertaIstriWWK?" (beserta Istri)":""));else if(e.statusWWK==="diwakilkan"&&e.perwakilanWWK)l.push(e.perwakilanWWK);else if(e.statusWWK==="diwakilkan")l.push("Perwakilan WWK");}return l.join(", ");})(ev);
        return (iInGroup===0?"<tr class=\'ds\'>":"<tr>")
          +"<td class=\'c\'>"+nomor+"</td>"
          +"<td class=\'nw\'><b>"+getHari(tgl)+"</b><br><span class=\'sub\'>"+fmtShort(tgl)+"</span></td>"
          +"<td class=\'c\'><b>"+ev.jam+"</b><br><span class=\'sub\'>WITA</span></td>"
          +"<td><b class=\'acara\'>"+ev.namaAcara+"</b><br><span class=\'sub\'>"+(ev.penyelenggara||"")+"</span></td>"
          +"<td class=\'c "+(ev.jenisKegiatan==="Sambutan"?"u":ev.jenisKegiatan==="Pengarahan"?"b":"g")+"\'>"+ev.jenisKegiatan+"</td>"
          +"<td>"+(ev.lokasi||"<em class=\'nil\'>-</em>")+"</td>"
          +"<td class=\'sub\'>"+(ev.kontak||"<em class=\'nil\'>-</em>")+"</td>"
          +"<td class=\'c\'>"+ev.pakaian+"</td>"
          +"<td>"+(hadir||"<em class=\'nil\'>-</em>")+"</td>"
          +"<td class=\'cat\'></td>"
          +"</tr>";
      });
    }).join("");
    w.document.write("<!DOCTYPE html><html><head><meta charset=\'UTF-8\'><title>Rekap Agenda Kegiatan Pimpinan</title><style>@page{size:A4 landscape;margin:1.2cm 1.5cm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Arial,sans-serif;font-size:10pt;color:#1a1a1a;margin:0}.kop{display:flex;align-items:center;gap:14px;border-bottom:3px solid #0B2545;padding-bottom:8px;margin-bottom:8px}.kop img{width:50px;height:50px;object-fit:contain}.kop h1{font-size:12pt;font-weight:900;color:#0B2545;margin:0 0 1px}.kop h2{font-size:9pt;font-weight:700;color:#0B2545;margin:0 0 2px}.kop p{font-size:8pt;color:#475569;margin:0}.jdl{text-align:center;margin:6px 0 8px}.jdl h3{font-size:13pt;font-weight:900;color:#0B2545;margin:0;text-transform:uppercase;letter-spacing:1px}.jdl p{font-size:9pt;color:#475569;margin:3px 0 0}.info{font-size:8pt;color:#64748b;text-align:right;margin-bottom:5px}table{width:100%;border-collapse:collapse}thead th{background:#0B2545;color:#fff;padding:8px 9px;text-align:left;font-size:9.5pt;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}thead th.c{text-align:center}tbody td{padding:8px 9px;border:1px solid #d1d9ef;vertical-align:top;line-height:1.55;font-size:10pt}tbody tr:nth-child(even) td{background:#f3f6fb}.c{text-align:center}.nw{white-space:nowrap}.acara{font-size:11pt}.sub{font-size:8.5pt;color:#4b5563}.nil{color:#cbd5e1}.ds td{border-top:2.5px solid #0B2545!important}.cat{min-width:80px}.u{color:#7c3aed;font-weight:700}.b{color:#2563eb;font-weight:700}.g{color:#065f46;font-weight:700}.ttd{margin-top:20px;display:flex;justify-content:space-between;align-items:flex-end}.ttd-info{font-size:8pt;color:#64748b;line-height:1.9}.ttd-info b{color:#1a1a1a}.ttd-box{text-align:center;min-width:240px}.ttd-box .ld{font-size:8.5pt;color:#334155;margin:0 0 3px}.ttd-box .jab{font-size:9pt;font-weight:700;color:#0B2545;margin:0 0 54px;line-height:1.4}.ttd-box p{margin:0;border:none;padding:0}.ttd-box .nm{font-size:10pt;font-weight:900;color:#0B2545;margin:0 0 2px}.ttd-box .nip{font-size:8pt;color:#64748b}.foot{margin-top:8px;font-size:7.5pt;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:5px}</style></head><body><div class=\'kop\'><img src=\'/logo_tarakan.png\' onerror=\"this.style.display=\'none\'\"  /><div><h1>PEMERINTAH KOTA TARAKAN</h1><h2>BAGIAN PROTOKOL DAN KOMUNIKASI PIMPINAN</h2><p>Sekretariat Daerah Kota Tarakan</p></div></div><div class=\'jdl\'><h3>REKAP AGENDA KEGIATAN PIMPINAN</h3><p>Periode: "+rangeLabel()+" &bull; Total: <b>"+filtered.length+" kegiatan</b></p></div><div class=\'info\'>Dicetak: "+printDate+" pukul "+printTime+" WITA</div><table><thead><tr><th class=\'c\' style=\'width:26px\'>No</th><th style=\'width:100px\'>Hari/Tanggal</th><th class=\'c\' style=\'width:56px\'>Pukul</th><th>Nama Acara / Penyelenggara</th><th class=\'c\' style=\'width:68px\'>Jenis</th><th style=\'width:130px\'>Tempat/Lokasi</th><th style=\'width:90px\'>Contact Person</th><th class=\'c\' style=\'width:76px\'>Pakaian</th><th style=\'width:105px\'>Dihadiri Oleh</th><th style=\'width:82px\'>Catatan<br>Kepala Daerah</th></tr></thead><tbody>"+rows+"</tbody></table><div class=\'ttd\'><div class=\'ttd-info\'><b>Dicetak oleh:</b> "+cetakOleh+"<br><b>Sistem:</b> Bagian Protokol dan Komunikasi Pimpinan Setda Kota Tarakan</div><div class=\'ttd-box\'><p class=\'ld\'>Tarakan, "+printDate+"</p><p class=\'jab\'>Kepala Bagian Protokol dan Komunikasi Pimpinan</p><p class=\'nm\'>Anugrah Yega Pranatha, M.Si.</p><p class=\'nip\'>NIP. 198811032007011003</p></div></div><p class=\'foot\'>Sistem Terpadu Jadwal dan Agenda Kegiatan Pimpinan &bull; Bagian Protokol dan Komunikasi Pimpinan Setda Kota Tarakan &bull; #TarakanHibot</p></body></html>");
    w.document.close();w.focus();setTimeout(()=>w.print(),500);
  };
const printF4L=()=>{
    const _now=new Date();
    const printDate=_now.toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
    const printTime=_now.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
    const printDateTime=printDate+" pukul "+printTime+" WITA";
    const byTgl={};
    filtered.forEach((ev,i)=>{if(!byTgl[ev.tanggal])byTgl[ev.tanggal]=[];byTgl[ev.tanggal].push({...ev,_idx:i});});
    let nomor=0;
    const rows=Object.keys(byTgl).sort().flatMap(tgl=>{
      const evs=byTgl[tgl];
      return evs.map((ev,iG)=>{
        nomor++;
function hadirOleh(ev){var list=[];var fWK=(ev.untukPimpinan||[]).includes("walikota");var fWWK=(ev.untukPimpinan||[]).includes("wakilwalikota")||ev.delegasiKeWWK;if(fWK&&!ev.delegasiKeWWK){if(ev.statusWK==="hadir")list.push("Wali Kota"+(ev.besertaIstriWK?" (beserta Istri)":""));else if(ev.statusWK==="diwakilkan"&&ev.perwakilanWK)list.push(ev.perwakilanWK);else if(ev.statusWK==="diwakilkan")list.push("Perwakilan WK");}if(fWWK){if(ev.statusWWK==="hadir")list.push("Wakil Wali Kota"+(ev.besertaIstriWWK?" (beserta Istri)":""));else if(ev.statusWWK==="diwakilkan"&&ev.perwakilanWWK)list.push(ev.perwakilanWWK);else if(ev.statusWWK==="diwakilkan")list.push("Perwakilan WWK");}return list.join(", ");}
            const tglCell=iG===0?"<td class='nw' rowspan='"+evs.length+"' style='background:#EBF0FA;font-weight:700;color:#0B2545;vertical-align:middle'><b>"+getHari(tgl)+"</b><br>"+fmt(tgl)+"</td>":"";
        const pkn=ev.pakaian==="Lainnya"?(ev.pakaianLainnya||"Lainnya"):ev.pakaian||"-";
        return (iG===0?"<tr class='ds'>":"<tr>")+"<td class='c'>"+nomor+"</td>"+tglCell+"<td class='c'><b>"+ev.jam+"</b></td><td><b>"+ev.namaAcara+"</b><br><span style='font-size:7.5pt;color:#64748b'>"+ev.penyelenggara+"</span></td><td>"+ev.lokasi+"</td><td style='font-size:8pt'>"+pkn+"</td><td style='font-size:8pt'>"+hadirOleh(ev)+"</td><td class='cat'></td></tr>";
      });
    }).join("");
    const w=window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Rekap Agenda F4</title>
<style>
@page{size:330mm 210mm landscape;margin:1.2cm 1.8cm}
*{box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:8.5pt;color:#1a1a1a;margin:0}
.kop{display:flex;align-items:center;gap:14px;border-bottom:3px solid #0B2545;padding-bottom:10px;margin-bottom:8px}
.kop img{width:52px;height:52px;object-fit:contain}
.kop h1{font-size:12pt;font-weight:900;color:#0B2545;margin:0 0 1px}
.kop h2{font-size:9pt;font-weight:700;color:#0B2545;margin:0 0 2px}
.kop p{font-size:7.5pt;color:#475569;margin:0}
.jdl{text-align:center;margin:8px 0}
.jdl h3{font-size:12pt;font-weight:900;color:#0B2545;margin:0;text-transform:uppercase;letter-spacing:1px}
.jdl p{font-size:8.5pt;color:#475569;margin:3px 0 0}
table{width:100%;border-collapse:collapse;font-size:8pt}
thead th{background:#0B2545;color:#FFFFFF;padding:6px 5px;text-align:left;font-size:7.5pt;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
thead th.c{text-align:center}
tbody td{padding:5px;border:1px solid #dde4ef;vertical-align:top;line-height:1.4}
tbody tr:nth-child(even) td:not(.nw){background:#f8fafc}
.c{text-align:center}.nw{white-space:nowrap}.ds td{border-top:2.5px solid #0B2545!important}.cat{min-width:80px}
.ttd{margin-top:20px;display:flex;justify-content:space-between;align-items:flex-end}
.ttd-info{font-size:7.5pt;color:#64748b;line-height:1.8}
.ttd-info b{color:#1a1a1a;font-size:8pt}
.ttd-box{text-align:center;min-width:200px}
.ttd-box .loc-date{font-size:8pt;color:#334155;margin:0 0 4px}
.ttd-box .jab{font-size:8pt;font-weight:700;color:#0B2545;margin:0 0 54px;line-height:1.4}
.ttd-box p{margin:0;border:none;padding:0}
.ttd-box .nm{font-size:9pt;font-weight:900;color:#0B2545;margin:0 0 2px}
.ttd-box .nip{font-size:7.5pt;color:#64748b}
.foot{margin-top:8px;font-size:7pt;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:5px}
</style></head><body>
<div class="kop">
  <img src="/logo_tarakan.png" onerror="this.style.display='none'"/>
  <div>
    <h1>PEMERINTAH KOTA TARAKAN</h1>
    <h2>BAGIAN PROTOKOL DAN KOMUNIKASI PIMPINAN</h2>
    <p>Sekretariat Daerah Kota Tarakan</p>
  </div>
</div>
<div class="jdl">
  <h3>Rekap Agenda Kegiatan Pimpinan</h3>
  <p>Periode: ${rangeLabel()} &bull; Dicetak: ${printDateTime} &bull; Total: <strong>${filtered.length} kegiatan</strong></p>
</div>
<table>
  <thead><tr>
    <th class="c" style="width:20px">No</th>
    <th style="width:72px">Hari/Tgl</th>
    <th class="c" style="width:40px">Pukul</th>
    <th>Nama Acara / Penyelenggara</th>
    <th style="width:100px">Lokasi</th>
    <th class="c" style="width:65px">Pakaian</th>
    <th style="width:110px">Dihadiri Oleh</th>
    <th style="width:80px">Catatan<br>Kepala Daerah</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="ttd">
  <div class="ttd-info"><b>Dicetak oleh:</b> ${cetakOleh}<br><b>Sistem:</b> Bagian Protokol dan Komunikasi Pimpinan Setda Kota Tarakan</div>
  <div class="ttd-box">
    <p class="loc-date">Tarakan, ${printDate}</p>
    <p class="jab">Kepala Bagian Protokol dan Komunikasi Pimpinan</p>
    <p class="nm">Anugrah Yega Pranatha, M.Si.</p>
    <p class="nip">NIP. 198811032007011003</p>
  </div>
</div>
<p class="foot">Sistem Terpadu Jadwal dan Agenda Kegiatan Pimpinan #TarakanHibot</p>
</body></html>`);
    w.document.close();w.print();
  };

  return <div style={{position:"fixed",inset:0,zIndex:8100,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:"white",borderRadius:16,width:"100%",maxWidth:500,maxHeight:"88vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"16px 20px 12px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1}}><div style={{fontSize:16,fontWeight:700,color:NAVY}}>Rekap Kegiatan</div><div style={{fontSize:12,color:"#64748b"}}>Cetak PDF A4 Landscape + TTD Kabag</div></div>
        <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:13,fontWeight:700,color:"#64748b"}}>Tutup</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px 20px 20px"}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
          {["today","tomorrow","week","month","range"].map(m=><button key={m} onClick={()=>setMode(m)} style={{padding:"6px 14px",borderRadius:20,border:"1.5px solid "+(mode===m?NAVY:"#e2e8f0"),background:mode===m?NAVY:"white",color:mode===m?"white":"#475569",cursor:"pointer",fontSize:12,fontWeight:700}}>{modeLabel[m]}</button>)}
        </div>
        {mode==="range"&&<div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
          <div style={{flex:1}}><label style={{fontSize:11,color:"#64748b",fontWeight:600,display:"block",marginBottom:2}}>Dari</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:14}}/></div>
          <span style={{color:"#94a3b8",marginTop:14}}>s.d.</span>
          <div style={{flex:1}}><label style={{fontSize:11,color:"#64748b",fontWeight:600,display:"block",marginBottom:2}}>Sampai</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:14}}/></div>
        </div>}
        <div style={{background:"#f8fafc",borderRadius:10,padding:"10px 14px",marginBottom:12,border:"1.5px solid #e2e8f0"}}>
          <div style={{fontSize:13,fontWeight:700,color:NAVY}}>{filtered.length} kegiatan tayang</div>
          <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Periode: {rangeLabel()}</div>
        </div>
        <div style={{background:"#EBF0FA",borderRadius:10,padding:"10px 14px",marginBottom:16,border:"1.5px solid "+NAVY,fontSize:12,color:NAVY,lineHeight:1.8}}>
          Isi PDF: kop surat &bull; lokasi acara &bull; kolom catatan kepala daerah &bull; TTD Kabag Prokopim
        </div>
        <div style={{display:"flex",gap:4,marginBottom:12,background:"#f1f5f9",borderRadius:10,padding:4}}>
          {[{k:"a4",l:"A4 Landscape (297×210mm)"},{k:"f4",l:"F4 Landscape (330×210mm)"}].map(o=>
            <button key={o.k} onClick={()=>setPrintMode(o.k)} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,
              background:printMode===o.k?NAVY:"transparent",color:printMode===o.k?"white":"#64748b",transition:"all 0.15s"}}>{o.l}</button>
          )}
        </div>
        <button onClick={printMode==="a4"?printPDF:printF4L} disabled={filtered.length===0} style={{width:"100%",padding:"13px",borderRadius:11,border:"none",background:filtered.length?NAVY:"#e2e8f0",color:filtered.length?"white":"#94a3b8",cursor:filtered.length?"pointer":"default",fontSize:14,fontWeight:700}}>🖨️ Cetak {printMode==="a4"?"A4":"F4"} Landscape</button>
      </div>
    </div>
  </div>;
}

// ==================== LAPORAN MINGGUAN/BULANAN ====================
function LaporanModal({events,onClose,kabagNama,cetakOleh}){
  const[mode,setMode]=useState("week");const[selYear,setSelYear]=useState(new Date().getFullYear());const[selMonth,setSelMonth]=useState(new Date().getMonth());const[printModeL,setPrintModeL]=useState("a4");const[selWeek,setSelWeek]=useState(weekStart());
  const years=Array.from({length:3},(_,i)=>new Date().getFullYear()-1+i);
  const months=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const getRange=()=>{
    if(mode==="week"){const ws=selWeek;const we=new Date(ws);we.setDate(we.getDate()+6);return{from:ws,to:localDateStr(we),label:"Minggu "+fmt(ws)+" s.d. "+fmt(localDateStr(we))};}
    const ym=selYear+"-"+String(selMonth+1).padStart(2,"0");const ms=ym+"-01";const me=localDateStr(new Date(selYear,selMonth+1,0));return{from:ms,to:me,label:"Bulan "+months[selMonth]+" "+selYear};
  };
  const range=getRange();
  const filtered=events.filter(e=>e.alur==="disetujui"&&e.tanggal>=range.from&&e.tanggal<=range.to).sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));
  const byDay=filtered.reduce((acc,ev)=>{(acc[ev.tanggal]=acc[ev.tanggal]||[]).push(ev);return acc;},{});
  const stats={total:filtered.length,wk:filtered.filter(e=>e.untukPimpinan.includes("walikota")).length,wwk:filtered.filter(e=>e.untukPimpinan.includes("wakilwalikota")||e.delegasiKeWWK).length,sambutan:filtered.filter(e=>e.jenisKegiatan==="Sambutan").length,pengarahan:filtered.filter(e=>e.jenisKegiatan==="Pengarahan").length,menghadiri:filtered.filter(e=>e.jenisKegiatan==="Menghadiri").length};
  const printPDF=()=>{
    const w=window.open("","_blank");
    const _now=new Date();
    const printDate=_now.toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
    const printTime=_now.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
    const printDateTime=printDate+" pukul "+printTime+" WITA";
    const kabag=kabagNama||"Kabag Protokol & Komunikasi Pimpinan";
    const rows=Object.keys(byDay).sort().flatMap(tgl=>byDay[tgl].map((ev,i)=>(i===0?"<tr class='ds'>":"<tr>")+(i===0?"<td class='c' rowspan='"+byDay[tgl].length+"' style='background:#EBF0FA;font-weight:700;color:#0B2545'>"+getHari(tgl)+"<br><span style='font-size:7pt'>"+fmtShort(tgl)+"</span></td>":"")+"<td class='c'><strong>"+ev.jam+" WITA</strong></td><td><strong>"+ev.namaAcara+"</strong><br><span style='font-size:7.5pt;color:#64748b'>"+ev.penyelenggara+"</span></td><td class='c "+(ev.jenisKegiatan==="Sambutan"?"u":ev.jenisKegiatan==="Pengarahan"?"b":"g")+"'>"+ev.jenisKegiatan+"</td><td>"+(ev.lokasi||"<em style='color:#cbd5e1'>-</em>")+"</td><td class='c' style='font-size:7pt'>"+ev.pakaian+"</td><td class='c'>"+(function(e){var l=[];var wk=(e.untukPimpinan||[]).includes("walikota");var wwk=(e.untukPimpinan||[]).includes("wakilwalikota")||e.delegasiKeWWK;if(wk&&!e.delegasiKeWWK){if(e.statusWK==="hadir")l.push("Wali Kota"+(e.besertaIstriWK?" (beserta Istri)":""));else if(e.statusWK==="diwakilkan"&&e.perwakilanWK)l.push(e.perwakilanWK);else if(e.statusWK==="diwakilkan")l.push("Perwakilan WK");}if(wwk){if(e.statusWWK==="hadir")l.push("Wakil Wali Kota"+(e.besertaIstriWWK?" (beserta Istri)":""));else if(e.statusWWK==="diwakilkan"&&e.perwakilanWWK)l.push(e.perwakilanWWK);else if(e.statusWWK==="diwakilkan")l.push("Perwakilan WWK");}return l.join(", ");})(ev)+"</td></tr>")).join("");
    const statRow="<div style='display:flex;gap:10px;margin:8px 0;flex-wrap:wrap'>"+[["Total",stats.total,"#0B2545"],["Wali Kota",stats.wk,"#1B4080"],["Wakil WK",stats.wwk,"#065f46"],["Sambutan",stats.sambutan,"#7c3aed"],["Pengarahan",stats.pengarahan,"#2563eb"],["Menghadiri",stats.menghadiri,"#16a34a"]].map(([l,v,c])=>"<div style='background:"+c+";color:white;border-radius:8px;padding:6px 12px;font-size:10pt;font-weight:700;text-align:center'><div style='font-size:8pt;font-weight:400;opacity:0.8'>"+l+"</div>"+v+"</div>").join("")+"</div>";
    w.document.write("<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Laporan Kegiatan</title><style>@page{size:A4 landscape;margin:1.5cm 1.8cm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Arial,sans-serif;font-size:8.5pt;color:#1a1a1a}.kop{display:flex;align-items:center;gap:14px;border-bottom:3px solid #0B2545;padding-bottom:10px;margin-bottom:8px}.kop img{width:52px;height:52px;object-fit:contain}.kop h1{font-size:12pt;font-weight:900;color:#0B2545;margin:0 0 1px}.kop h2{font-size:9pt;font-weight:700;color:#0B2545;margin:0 0 2px}.kop p{font-size:7.5pt;color:#475569;margin:0}.jdl{text-align:center;margin:8px 0}.jdl h3{font-size:12pt;font-weight:900;color:#0B2545;margin:0;text-transform:uppercase;letter-spacing:1px}.jdl p{font-size:8.5pt;color:#475569;margin:3px 0 0}table{width:100%;border-collapse:collapse;font-size:8pt}thead th{background:#0B2545;color:#FFFFFF;padding:7px 6px;text-align:left;font-size:7.5pt;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}thead th.c{text-align:center}tbody td{padding:6px;border:1px solid #dde4ef;vertical-align:middle;line-height:1.4}tbody tr:nth-child(even) td:not(.nw){background:#f8fafc}.c{text-align:center}.ds td{border-top:2.5px solid #0B2545!important}.cat{min-width:80px}.u{color:#7c3aed;font-weight:700}.b{color:#2563eb;font-weight:700}.g{color:#065f46;font-weight:700}.ttd{margin-top:22px;display:flex;justify-content:space-between;align-items:flex-end}.ttd-info{font-size:7.5pt;color:#64748b;line-height:1.8}.ttd-info b{color:#1a1a1a;font-size:8pt}.ttd-box{text-align:center;min-width:240px}.ttd-box .loc-date{font-size:8pt;color:#334155;margin:0 0 4px}.ttd-box .jab{font-size:8.5pt;font-weight:700;color:#0B2545;margin:0 0 56px;line-height:1.4}.ttd-box p{margin:0;border:none;padding:0}.ttd-box .nm{font-size:9pt;font-weight:900;color:#0B2545;margin:0 0 2px;letter-spacing:-0.2px;border:none}.ttd-box .nip{font-size:7.5pt;color:#64748b;display:flex;align-items:center;justify-content:center;gap:4px}.ttd-box .nip-line{display:inline-block;border-bottom:1px solid #94a3b8;width:160px;height:12px}.foot{margin-top:8px;font-size:7pt;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:5px}</style></head><body><div class='kop'><img src='/logo_tarakan.png' onerror=\"this.style.display='none'\"/><div><h1>PEMERINTAH KOTA TARAKAN</h1><h2>BAGIAN PROTOKOL DAN KOMUNIKASI PIMPINAN</h2><p>Sekretariat Daerah Kota Tarakan</p></div></div><div class='jdl'><h3>LAPORAN KEGIATAN PIMPINAN</h3><p>"+range.label+" &bull; Dicetak: "+printDateTime+"</p></div>"+statRow+"<table><thead><tr><th style='width:80px'>Hari/Tgl</th><th class='c' style='width:52px'>Pukul<br>(WITA)</th><th style='width:200px'>Nama Acara</th><th class='c' style='width:62px'>Jenis</th><th style='width:130px'>Tempat/Lokasi</th><th class='c' style='width:78px'>Pakaian</th><th style='width:110px'>Dihadiri Oleh</th></tr></thead><tbody>"+rows+"</tbody></table><div class='ttd'><div class='ttd-info'><b>Dicetak oleh:</b> "+cetakOleh+"<br><b>Sistem:</b> Bagian Protokol dan Komunikasi Pimpinan Setda Kota Tarakan</div><div class='ttd-box'><p class='loc-date'>Tarakan, "+printDate+"</p><p class='jab'>Kepala Bagian Protokol dan Komunikasi Pimpinan</p><p class='nm'>Anugrah Yega Pranatha, M.Si.</p><p class='nip'>NIP. 198811032007011003</p></div></div><p class='foot'>Sistem Terpadu Jadwal dan Agenda Kegiatan Pimpinan #TarakanHibot</p></body></html>");
    w.document.close();w.focus();setTimeout(()=>w.print(),500);
  }
const printF4L_lap=()=>{
    const w=window.open("","_blank");
    const _now=new Date();
    const printDate=_now.toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
    const printTime=_now.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
    const printDateTime=printDate+" pukul "+printTime+" WITA";
    const kabag=kabagNama||"Kabag Protokol & Komunikasi Pimpinan";
    const rows=Object.keys(byDay).sort().flatMap(tgl=>byDay[tgl].map((ev,i)=>(i===0?"<tr class='ds'>":"<tr>")+(i===0?"<td class='c' rowspan='"+byDay[tgl].length+"' style='background:#EBF0FA;font-weight:700;color:#0B2545'>"+getHari(tgl)+"<br><span style='font-size:7pt'>"+fmtShort(tgl)+"</span></td>":"")+"<td class='c'><strong>"+ev.jam+" WITA</strong></td><td><strong>"+ev.namaAcara+"</strong><br><span style='font-size:7.5pt;color:#64748b'>"+ev.penyelenggara+"</span></td><td class='c "+(ev.jenisKegiatan==="Sambutan"?"u":ev.jenisKegiatan==="Pengarahan"?"b":"g")+"'>"+ev.jenisKegiatan+"</td><td>"+(ev.lokasi||"<em style='color:#cbd5e1'>-</em>")+"</td><td class='c' style='font-size:7pt'>"+ev.pakaian+"</td><td class='c'>"+(function(e){var l=[];var wk=(e.untukPimpinan||[]).includes("walikota");var wwk=(e.untukPimpinan||[]).includes("wakilwalikota")||e.delegasiKeWWK;if(wk&&!e.delegasiKeWWK){if(e.statusWK==="hadir")l.push("Wali Kota"+(e.besertaIstriWK?" (beserta Istri)":""));else if(e.statusWK==="diwakilkan"&&e.perwakilanWK)l.push(e.perwakilanWK);}if(wwk){if(e.statusWWK==="hadir")l.push("Wakil Wali Kota"+(e.besertaIstriWWK?" (beserta Istri)":""));else if(e.statusWWK==="diwakilkan"&&e.perwakilanWWK)l.push(e.perwakilanWWK);}return l.join(", ");})(ev)+"</td><td class='cat'></td></tr>")).join("");
    const statRow="<div style='display:flex;gap:10px;margin:8px 0;flex-wrap:wrap'>"+[["Total",stats.total,"#0B2545"],["Wali Kota",stats.wk,"#1B4080"],["Wakil WK",stats.wwk,"#065f46"],["Sambutan",stats.sambutan,"#7c3aed"],["Pengarahan",stats.pengarahan,"#2563eb"],["Menghadiri",stats.menghadiri,"#16a34a"]].map(([l,v,c])=>"<div style='background:"+c+";color:white;border-radius:8px;padding:6px 12px;font-size:10pt;font-weight:700;text-align:center'><div style='font-size:8pt;font-weight:400;opacity:0.8'>"+l+"</div>"+v+"</div>").join("")+"</div>";
    w.document.write("<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Laporan Kegiatan</title><style>@page{size:330mm 210mm;margin:1.5cm 1.8cm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Arial,sans-serif;font-size:8.5pt;color:#1a1a1a}.kop{display:flex;align-items:center;gap:14px;border-bottom:3px solid #0B2545;padding-bottom:10px;margin-bottom:8px}.kop img{width:52px;height:52px;object-fit:contain}.kop h1{font-size:12pt;font-weight:900;color:#0B2545;margin:0 0 1px}.kop h2{font-size:9pt;font-weight:700;color:#0B2545;margin:0 0 2px}.kop p{font-size:7.5pt;color:#475569;margin:0}.jdl{text-align:center;margin:8px 0}.jdl h3{font-size:12pt;font-weight:900;color:#0B2545;margin:0;text-transform:uppercase;letter-spacing:1px}.jdl p{font-size:8.5pt;color:#475569;margin:3px 0 0}table{width:100%;border-collapse:collapse;font-size:8pt}thead th{background:#0B2545;color:#FFFFFF;padding:7px 6px;text-align:left;font-size:7.5pt;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}thead th.c{text-align:center}tbody td{padding:6px;border:1px solid #dde4ef;vertical-align:middle;line-height:1.4}tbody tr:nth-child(even) td:not(.nw){background:#f8fafc}.c{text-align:center}.ds td{border-top:2.5px solid #0B2545!important}.cat{min-width:80px}.u{color:#7c3aed;font-weight:700}.b{color:#2563eb;font-weight:700}.g{color:#065f46;font-weight:700}.ttd{margin-top:22px;display:flex;justify-content:space-between;align-items:flex-end}.ttd-info{font-size:7.5pt;color:#64748b;line-height:1.8}.ttd-info b{color:#1a1a1a;font-size:8pt}.ttd-box{text-align:center;min-width:240px}.ttd-box .loc-date{font-size:8pt;color:#334155;margin:0 0 4px}.ttd-box .jab{font-size:8.5pt;font-weight:700;color:#0B2545;margin:0 0 56px;line-height:1.4}.ttd-box p{margin:0;border:none;padding:0}.ttd-box .nm{font-size:9pt;font-weight:900;color:#0B2545;margin:0 0 2px;letter-spacing:-0.2px;border:none}.ttd-box .nip{font-size:7.5pt;color:#64748b;display:flex;align-items:center;justify-content:center;gap:4px}.ttd-box .nip-line{display:inline-block;border-bottom:1px solid #94a3b8;width:160px;height:12px}.foot{margin-top:8px;font-size:7pt;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:5px}</style></head><body><div class='kop'><img src='/logo_tarakan.png' onerror=\"this.style.display='none'\"/><div><h1>PEMERINTAH KOTA TARAKAN</h1><h2>BAGIAN PROTOKOL DAN KOMUNIKASI PIMPINAN</h2><p>Sekretariat Daerah Kota Tarakan</p></div></div><div class='jdl'><h3>LAPORAN KEGIATAN PIMPINAN</h3><p>"+range.label+" &bull; Dicetak: "+printDateTime+"</p></div>"+statRow+"<table><thead><tr><th style='width:80px'>Hari/Tgl</th><th class='c' style='width:52px'>Pukul<br>(WITA)</th><th style='width:200px'>Nama Acara</th><th class='c' style='width:62px'>Jenis</th><th style='width:130px'>Tempat/Lokasi</th><th class='c' style='width:78px'>Pakaian</th><th style='width:110px'>Dihadiri Oleh</th><th style='width:80px'>Catatan<br>Kepala Daerah</th></tr></thead><tbody>"+rows+"</tbody></table><div class='ttd'><div class='ttd-info'><b>Dicetak oleh:</b> "+cetakOleh+"<br><b>Sistem:</b> Bagian Protokol dan Komunikasi Pimpinan Setda Kota Tarakan</div><div class='ttd-box'><p class='loc-date'>Tarakan, "+printDate+"</p><p class='jab'>Kepala Bagian Protokol dan Komunikasi Pimpinan</p><p class='nm'>Anugrah Yega Pranatha, M.Si.</p><p class='nip'>NIP. 198811032007011003</p></div></div><p class='foot'>Sistem Terpadu Jadwal dan Agenda Kegiatan Pimpinan #TarakanHibot</p></body></html>");
    w.document.close();w.focus();setTimeout(()=>w.print(),500);
  }
;
  const inp={borderRadius:8,border:"1.5px solid #e2e8f0",padding:"8px 10px",fontSize:13};
  return <div style={{position:"fixed",inset:0,zIndex:8100,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:"white",borderRadius:16,width:"100%",maxWidth:520,maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"16px 20px 12px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1}}><div style={{fontSize:16,fontWeight:700,color:NAVY}}>Laporan Mingguan / Bulanan</div><div style={{fontSize:12,color:"#64748b"}}>Rekap agenda kegiatan pimpinan</div></div>
        <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:13,fontWeight:700,color:"#64748b"}}>Tutup</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px 20px 20px"}}>
        <div style={{display:"flex",gap:0,marginBottom:16,borderRadius:10,overflow:"hidden",border:"1.5px solid #e2e8f0"}}>
          {["week","month"].map(m=><button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"11px",border:"none",background:mode===m?NAVY:"white",color:mode===m?"white":"#475569",cursor:"pointer",fontSize:13,fontWeight:700}}>{m==="week"?"Mingguan":"Bulanan"}</button>)}
        </div>
        {mode==="week"&&<div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:4}}>Pilih Minggu (isi tanggal hari Senin)</label>
          <input type="date" value={selWeek} onChange={e=>setSelWeek(e.target.value)} style={{...inp,width:"100%"}}/>
          <div style={{fontSize:11,color:"#64748b",marginTop:4}}>{range.label}</div>
        </div>}
        {mode==="month"&&<div style={{display:"flex",gap:8,marginBottom:14}}>
          <div style={{flex:2}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:4}}>Bulan</label><select value={selMonth} onChange={e=>setSelMonth(parseInt(e.target.value))} style={{...inp,width:"100%"}}>{months.map((m,i)=><option key={i} value={i}>{m}</option>)}</select></div>
          <div style={{flex:1}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:4}}>Tahun</label><select value={selYear} onChange={e=>setSelYear(parseInt(e.target.value))} style={{...inp,width:"100%"}}>{years.map(y=><option key={y}>{y}</option>)}</select></div>
        </div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
          {[["Total",stats.total,NAVY],["Wali Kota",stats.wk,"#1B4080"],["Wakil WK",stats.wwk,GREEN],["Sambutan",stats.sambutan,"#7c3aed"],["Pengarahan",stats.pengarahan,"#2563eb"],["Menghadiri",stats.menghadiri,"#16a34a"]].map(([l,v,c])=><div key={l} style={{background:c,borderRadius:10,padding:"10px 12px",textAlign:"center"}}><div style={{color:"rgba(255,255,255,0.7)",fontSize:10,marginBottom:2}}>{l}</div><div style={{color:"white",fontSize:20,fontWeight:900}}>{v}</div></div>)}
        </div>
        <div style={{background:"#f8fafc",borderRadius:10,padding:"10px 14px",marginBottom:16,border:"1px solid #e2e8f0",maxHeight:200,overflowY:"auto"}}>
          {filtered.length===0?<div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:"16px"}}>Tidak ada kegiatan pada periode ini</div>:
          filtered.map((ev,i)=><div key={ev.id} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:i<filtered.length-1?"1px solid #f1f5f9":"none"}}>
            <div style={{width:44,flexShrink:0,textAlign:"center"}}><div style={{fontSize:10,fontWeight:700,color:NAVY}}>{getHari(ev.tanggal).slice(0,3)}</div><div style={{fontSize:12,fontWeight:800,color:"#334155"}}>{ev.tanggal.slice(8)}</div><div style={{fontSize:9,color:"#94a3b8"}}>{ev.jam}</div></div>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:700,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.namaAcara}</div><div style={{fontSize:11,color:"#64748b"}}>{ev.penyelenggara}</div></div>
          </div>)}
        </div>
        <div style={{display:"flex",gap:4,marginBottom:12,background:"#f1f5f9",borderRadius:10,padding:4}}>
          {[{k:"a4",l:"A4 Landscape"},{k:"f4",l:"F4 Landscape"}].map(o=>
            <button key={o.k} onClick={()=>setPrintModeL(o.k)} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,background:printModeL===o.k?NAVY:"transparent",color:printModeL===o.k?"white":"#64748b"}}>📄 {o.l}</button>
          )}
        </div>
        <button onClick={printModeL==="a4"?printPDF:printF4L_lap} disabled={filtered.length===0} style={{width:"100%",padding:"13px",borderRadius:11,border:"none",background:filtered.length?NAVY:"#e2e8f0",color:filtered.length?"white":"#94a3b8",cursor:filtered.length?"pointer":"default",fontSize:14,fontWeight:700}}>🖨️ Cetak {printModeL==="a4"?"A4":"F4"} Landscape</button>
        
      </div>
    </div>
  </div>;
}

// ==================== NOTIF TAB ====================
function NotifTab({user,showT}){
  const[status,setStatus]=useState(()=>{
    if(!("Notification" in window))return "unsupported";
    return Notification.permission; // "default"|"granted"|"denied"
  });
  const[subbed,setSubbed]=useState(false);
  const[loading,setLoading]=useState(false);
  const[msg,setMsg]=useState("");

  // Cek apakah sudah subscribe
  useEffect(()=>{
    if(!("serviceWorker" in navigator)||!("PushManager" in navigator))return;
    navigator.serviceWorker.ready.then(reg=>
      reg.pushManager.getSubscription().then(sub=>setSubbed(!!sub))
    ).catch(e=>console.warn("Sync:",e?.message||e));
  },[]);

  const activate=async()=>{
    setLoading(true);setMsg("");
    try{
      if(!("serviceWorker" in navigator)||!("PushManager" in navigator)){
        setMsg("Browser ini tidak mendukung push notification.");setLoading(false);return;
      }
      // Minta izin
      const perm=await Notification.requestPermission();
      setStatus(perm);
      if(perm!=="granted"){
        setMsg("Izin ditolak. Di iOS: Settings → [Nama App] → Notifications → Allow.");
        setLoading(false);return;
      }
      // Register SW & subscribe
      await registerPush(user.username,user.role);
      setSubbed(true);
      showT("Notifikasi berhasil diaktifkan ✓");
    }catch(e){setMsg("Gagal: "+e.message);}
    setLoading(false);
  };

  const deactivate=async()=>{
    setLoading(true);
    try{
      if(!("serviceWorker" in navigator))return;
      const reg=await navigator.serviceWorker.ready;
      const sub=await reg.pushManager.getSubscription();
      if(sub){
        await fetch("/api/webpush",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({action:"unsubscribe",subscription:sub})});
        await sub.unsubscribe();
      }
      setSubbed(false);setStatus("default");
      showT("Notifikasi dinonaktifkan","warn");
    }catch(e){setMsg("Gagal: "+e.message);}
    setLoading(false);
  };

  // Deteksi detail
  const isStandalone=window.navigator.standalone===true||window.matchMedia("(display-mode: standalone)").matches;
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
  const iosVer=(()=>{const m=navigator.userAgent.match(/OS (\d+)_(\d+)/);return m?parseFloat(m[1]+"."+m[2]):0;})();
  const hasSW="serviceWorker" in navigator;
  const hasPush="PushManager" in window;
  const hasNotif="Notification" in window;
  const supported=hasSW&&hasPush&&hasNotif;

  return <div>
    {/* Status card */}
    <div style={{borderRadius:12,padding:"14px 16px",marginBottom:16,
      background:status==="granted"?"#f0fdf4":status==="denied"?"#fef2f2":"#f0f9ff",
      border:"1px solid "+(status==="granted"?"#bbf7d0":status==="denied"?"#fecaca":"#bae6fd")}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:28}}>{status==="granted"?"🔔":status==="denied"?"🔕":"🔔"}</span>
        <div>
          <div style={{fontWeight:700,fontSize:14,color:status==="granted"?"#166534":status==="denied"?"#991b1b":"#0284c7"}}>
            {status==="granted"?"Notifikasi Aktif":status==="denied"?"Notifikasi Diblokir":"Notifikasi Belum Diaktifkan"}
          </div>
          <div style={{fontSize:12,color:"#64748b",marginTop:2}}>
            {status==="granted"&&subbed?"Perangkat ini terdaftar dan akan menerima notifikasi.":
             status==="granted"&&!subbed?"Izin diberikan tapi belum terdaftar. Klik Aktifkan.":
             status==="denied"?"Izin diblokir oleh browser/sistem. Lihat panduan di bawah.":
             "Tap tombol di bawah untuk mengaktifkan."}
          </div>
        </div>
      </div>
    </div>

    {/* Tombol aksi */}
    {supported&&status!=="denied"&&!subbed&&
      <button onClick={activate} disabled={loading} style={{width:"100%",padding:"13px",borderRadius:11,border:"none",
        background:loading?"#e2e8f0":"linear-gradient(135deg,#0A1628,#1B4080)",
        color:loading?"#94a3b8":"white",cursor:loading?"default":"pointer",fontSize:14,fontWeight:700,marginBottom:10}}>
        {loading?"Mengaktifkan...":"🔔 Aktifkan Notifikasi"}
      </button>}

    {supported&&status==="granted"&&subbed&&
      <button onClick={deactivate} disabled={loading} style={{width:"100%",padding:"12px",borderRadius:11,
        border:"1.5px solid #fca5a5",background:"white",color:"#ef4444",cursor:"pointer",fontSize:13,fontWeight:700,marginBottom:10}}>
        {loading?"Memproses...":"🔕 Nonaktifkan Notifikasi"}
      </button>}

    {/* Panduan jika diblokir */}
    {status==="denied"&&<div style={{background:"#fef9c3",borderRadius:10,padding:"12px 14px",fontSize:12,color:"#92400e",border:"1px solid #fde68a",lineHeight:1.7}}>
      <div style={{fontWeight:700,marginBottom:6}}>Cara mengaktifkan kembali:</div>
      <div><strong>iOS (Safari):</strong> Settings → Safari → Advanced → Website Data → cari domain app → hapus. Atau: Hapus app dari Home Screen lalu install ulang.</div>
      <div style={{marginTop:6}}><strong>Android (Chrome):</strong> Tap ikon kunci di address bar → Permissions → Notifications → Allow.</div>
    </div>}

    {!supported&&<div>
      {/* Info diagnostik */}
      <div style={{background:"#f8fafc",borderRadius:10,padding:"13px 14px",marginBottom:12,border:"1px solid #e2e8f0",fontSize:12,color:"#475569",lineHeight:2}}>
        <div style={{fontWeight:700,color:"#0A1628",marginBottom:4}}>🔍 Diagnostik Perangkat</div>
        <div>Mode standalone (PWA): <strong style={{color:isStandalone?"#166534":"#991b1b"}}>{isStandalone?"✅ Ya":"❌ Tidak"}</strong></div>
        <div>Platform: <strong>{isIOS?"iOS "+iosVer:"Android/Lainnya"}</strong></div>
        <div>Service Worker: <strong style={{color:hasSW?"#166534":"#991b1b"}}>{hasSW?"✅ Didukung":"❌ Tidak"}</strong></div>
        <div>Push Manager: <strong style={{color:hasPush?"#166534":"#991b1b"}}>{hasPush?"✅ Didukung":"❌ Tidak"}</strong></div>
        <div>Notification API: <strong style={{color:hasNotif?"#166534":"#991b1b"}}>{hasNotif?"✅ Didukung":"❌ Tidak"}</strong></div>
      </div>
      {/* Panduan sesuai kondisi */}
      {isIOS&&!isStandalone&&<div style={{background:"#fef3c7",borderRadius:12,padding:"14px",border:"1px solid #fde68a",fontSize:13,color:"#92400e"}}>
        <div style={{fontWeight:800,marginBottom:8}}>📱 Buka dari Home Screen dulu</div>
        <div style={{lineHeight:2}}>
          <div>1. Tap ikon <strong>Share</strong> (kotak+panah) di Safari</div>
          <div>2. Tap <strong>"Add to Home Screen"</strong></div>
          <div>3. Buka app dari ikon Home Screen</div>
          <div>4. Login ulang → aktifkan notifikasi</div>
        </div>
      </div>}
      {isIOS&&isStandalone&&iosVer>0&&iosVer<16.4&&<div style={{background:"#fee2e2",borderRadius:12,padding:"14px",border:"1px solid #fecaca",fontSize:13,color:"#991b1b"}}>
        <div style={{fontWeight:800,marginBottom:6}}>⚠️ iOS {iosVer} — Perlu Update</div>
        <div>Push notification di iOS membutuhkan minimal <strong>iOS 16.4</strong>. Silakan update iPhone Anda di Settings → General → Software Update.</div>
      </div>}
      {isIOS&&isStandalone&&iosVer>=16.4&&<div style={{background:"#fef3c7",borderRadius:12,padding:"14px",border:"1px solid #fde68a",fontSize:13,color:"#92400e"}}>
        <div style={{fontWeight:800,marginBottom:6}}>⚠️ iOS {iosVer} — Coba Langkah Ini</div>
        <div style={{lineHeight:1.8}}>iOS Anda sudah mendukung, tapi Push API belum aktif. Kemungkinan penyebab:<br/>
        • Hapus app dari Home Screen → install ulang<br/>
        • Pastikan Settings → [App] → Notifications → Allow<br/>
        • Restart iPhone lalu buka ulang app</div>
      </div>}
      {!isIOS&&<div style={{background:"#fef3c7",borderRadius:10,padding:"12px 14px",fontSize:13,color:"#92400e",border:"1px solid #fde68a"}}>
        Push notification membutuhkan Android Chrome 90+ atau iOS 16.4+. Pastikan browser diperbarui.
      </div>}
    </div>}

    {msg&&<div style={{marginTop:10,background:"#fee2e2",borderRadius:8,padding:"9px 12px",fontSize:13,color:"#991b1b"}}>{msg}</div>}

    {/* Syarat */}
    <div style={{marginTop:14,padding:"10px 13px",background:"#f8fafc",borderRadius:9,border:"1px solid #e2e8f0",fontSize:11,color:"#64748b",lineHeight:1.8}}>
      <div style={{fontWeight:700,color:"#475569",marginBottom:4}}>Syarat push notification:</div>
      <div>✅ App sudah di-install ke Home Screen</div>
      <div>✅ Dibuka dari ikon Home Screen (bukan browser)</div>
      <div>✅ iOS 16.4+ atau Android Chrome 90+</div>
      <div>✅ Koneksi internet aktif saat pertama aktivasi</div>
    </div>
  </div>;
}

// ==================== PROFILE MODAL (ganti username & password) ====================
function ProfileModal({user,onClose,showT}){
  const[tabP,setTabP]=useState("profile");
  const[form,setForm]=useState({nama:user.nama,jabatan:user.jabatan,noWA:user.noWA||""});
  const[pw,setPw]=useState({old:"",next:"",confirm:""});
  const[uname,setUname]=useState({newUsername:"",pwConfirm:""});
  const[err,setErr]=useState("");
  const inp={width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",fontSize:14,background:"white",color:"#1e293b"};

  const saveProfile=()=>{
    setErr("");if(!form.nama.trim())return setErr("Nama wajib diisi.");
    const users=loadUsers();const updated=users.map(u=>u.username===user.username?{...u,nama:form.nama,jabatan:form.jabatan,noWA:form.noWA}:u);
    saveUsers(updated);showT("Profil disimpan ✓");onClose({...user,nama:form.nama,jabatan:form.jabatan,noWA:form.noWA});
  };
  const changePassword=async()=>{
    setErr("");
    if(!pw.old||!pw.next||!pw.confirm)return setErr("Semua kolom wajib diisi.");
    if(pw.next.length<6)return setErr("Password minimal 6 karakter.");
    if(pw.next!==pw.confirm)return setErr("Konfirmasi tidak cocok.");
    const users=loadUsers();const cur=users.find(u=>u.username===user.username);
    if(!cur)return setErr("Akun tidak ditemukan.");
    const oldOk=await verifyPassword(pw.old,cur.password);
    if(!oldOk)return setErr("Password lama salah.");
    const hashed=await hashPassword(pw.next);
    saveUsers(users.map(u=>u.username===user.username?{...u,password:hashed}:u));
    setPw({old:"",next:"",confirm:""});showT("Password berhasil diubah ✓");
  };
  const changeUsername=async()=>{
    setErr("");
    if(!uname.newUsername.trim())return setErr("Username baru wajib diisi.");
    const un=uname.newUsername.toLowerCase().trim();
    const users=loadUsers();const cur=users.find(u=>u.username===user.username);
    if(!cur)return setErr("Akun tidak ditemukan.");
    const pwOk=await verifyPassword(uname.pwConfirm,cur.password);
    if(!pwOk)return setErr("Password tidak cocok.");
    if(users.find(u=>u.username===un&&u.username!==user.username))return setErr("Username sudah dipakai.");
    saveUsers(users.map(u=>u.username===user.username?{...u,username:un}:u));
    try{localStorage.setItem("jp_session",JSON.stringify({username:un}));}catch{}
    localStorage.removeItem(bioKey(user.username));
    showT("Username diubah. Silakan login ulang.","warn");
    setTimeout(()=>{localStorage.removeItem("jp_session");window.location.reload();},1800);
  };
  const tabs=[{k:"profile",l:"Profil"},{k:"password",l:"Ganti Password"},{k:"username",l:"Ganti Username"},{k:"biometric",l:"Biometrik"},{k:"notif",l:"🔔 Notifikasi"}];
  return <div style={{position:"fixed",inset:0,zIndex:8200,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:"white",borderRadius:16,width:"100%",maxWidth:480,maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"16px 20px 0",borderBottom:"1px solid #f1f5f9",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <div style={{flex:1,fontSize:16,fontWeight:700,color:NAVY}}>Pengaturan Akun</div>
          <button onClick={()=>onClose(null)} style={{background:"#f1f5f9",border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:13,fontWeight:700,color:"#64748b"}}>Tutup</button>
        </div>
        <div style={{display:"flex",gap:0,overflowX:"auto"}}>
          {tabs.map(t=><button key={t.k} onClick={()=>{setTabP(t.k);setErr("");}} style={{padding:"9px 14px",border:"none",background:"transparent",color:tabP===t.k?NAVY:"#94a3b8",fontWeight:tabP===t.k?700:500,fontSize:12,cursor:"pointer",borderBottom:tabP===t.k?"2.5px solid "+NAVY:"2.5px solid transparent",whiteSpace:"nowrap"}}>{t.l}</button>)}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px 20px"}}>
        {err&&<div style={{background:"#fee2e2",borderRadius:8,padding:"9px 12px",marginBottom:12,fontSize:13,color:"#991b1b"}}>{err}</div>}
        {tabP==="profile"&&<><div style={{marginBottom:12}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:4}}>Nama Lengkap</label><input value={form.nama} onChange={e=>setForm(p=>({...p,nama:e.target.value}))} style={inp}/></div><div style={{marginBottom:12}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:4}}>Jabatan</label><input value={form.jabatan} onChange={e=>setForm(p=>({...p,jabatan:e.target.value}))} style={inp}/></div><div style={{marginBottom:16}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:4}}>No. WhatsApp</label><input value={form.noWA} onChange={e=>setForm(p=>({...p,noWA:e.target.value}))} placeholder="08123456789" style={inp}/><div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>📱 Digunakan untuk menerima kode OTP reset password</div></div><button onClick={saveProfile} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:NAVY,color:"white",cursor:"pointer",fontSize:14,fontWeight:700}}>Simpan Profil</button></>}
        {tabP==="password"&&<><div style={{marginBottom:12}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:4}}>Password Lama</label><input type="password" value={pw.old} onChange={e=>setPw(p=>({...p,old:e.target.value}))} style={inp}/></div><div style={{marginBottom:12}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:4}}>Password Baru (min. 6 karakter)</label><input type="password" value={pw.next} onChange={e=>setPw(p=>({...p,next:e.target.value}))} style={inp}/><PasswordStrengthBar password={pw.next}/></div><div style={{marginBottom:16}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:4}}>Konfirmasi Password Baru</label><input type="password" value={pw.confirm} onChange={e=>setPw(p=>({...p,confirm:e.target.value}))} style={inp}/></div><button onClick={changePassword} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:GREEN,color:"white",cursor:"pointer",fontSize:14,fontWeight:700}}>Ubah Password</button></>}
        {tabP==="username"&&<><div style={{background:"#fef3c7",borderRadius:9,padding:"9px 12px",marginBottom:14,fontSize:13,color:"#92400e",border:"1px solid #fde68a"}}>Setelah ubah username, Anda akan diminta login ulang.</div><div style={{marginBottom:12}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:4}}>Username Baru</label><input value={uname.newUsername} onChange={e=>setUname(p=>({...p,newUsername:e.target.value}))} autoCapitalize="none" style={inp}/></div><div style={{marginBottom:16}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:4}}>Konfirmasi dengan Password Anda</label><input type="password" value={uname.pwConfirm} onChange={e=>setUname(p=>({...p,pwConfirm:e.target.value}))} style={inp}/></div><button onClick={changeUsername} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:"#d97706",color:"white",cursor:"pointer",fontSize:14,fontWeight:700}}>Ubah Username</button></>}
        {tabP==="biometric"&&<BiometricTab user={user} showT={showT}/>}
        {tabP==="notif"&&<NotifTab user={user} showT={showT}/>}
      </div>
    </div>
  </div>;
}

function BiometricTab({user,showT}){
  const[supported]=useState(bioSupported());const[registered,setRegistered]=useState(()=>bioIsRegistered(user.username));const[loading,setLoading]=useState(false);const[msg,setMsg]=useState("");
  const doRegister=async()=>{setLoading(true);setMsg("");try{await bioRegister(user.username);setRegistered(true);showT("Biometrik berhasil didaftarkan ✓");}catch(e){setMsg("Gagal: "+e.message);}setLoading(false);};
  const doRemove=()=>{localStorage.removeItem(bioKey(user.username));setRegistered(false);showT("Biometrik dihapus","warn");};
  if(!supported)return <div style={{background:"#fef3c7",borderRadius:10,padding:"14px 16px",fontSize:13,color:"#92400e",border:"1px solid #fde68a"}}>Biometrik (WebAuthn) tidak didukung oleh browser atau perangkat ini. Pastikan menggunakan HTTPS dan browser modern.</div>;
  return <div>
    <div style={{background:"#f0f9ff",borderRadius:10,padding:"12px 14px",marginBottom:16,fontSize:13,color:"#0284c7",border:"1px solid #bae6fd",lineHeight:1.7}}>
      Biometrik menggunakan sidik jari, Face ID, atau PIN perangkat untuk login tanpa password. Data biometrik tidak pernah meninggalkan perangkat Anda.
    </div>
    {registered?<><div style={{background:"#d1fae5",borderRadius:10,padding:"12px 14px",marginBottom:14,fontSize:13,color:GREEN,fontWeight:700,border:"1px solid #a7f3d0"}}>Biometrik aktif untuk akun ini</div><button onClick={doRemove} style={{width:"100%",padding:"12px",borderRadius:10,border:"1.5px solid #fca5a5",background:"white",color:"#ef4444",cursor:"pointer",fontSize:14,fontWeight:700}}>Hapus / Nonaktifkan Biometrik</button></>:
    <><div style={{background:"#fafafa",borderRadius:10,padding:"12px 14px",marginBottom:14,fontSize:13,color:"#64748b",border:"1px solid #e2e8f0"}}>Biometrik belum didaftarkan. Klik tombol di bawah dan ikuti instruksi perangkat Anda.</div><button onClick={doRegister} disabled={loading} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:loading?"#e2e8f0":NAVY,color:loading?"#94a3b8":"white",cursor:loading?"default":"pointer",fontSize:14,fontWeight:700}}>{loading?"Memproses...":"Daftarkan Biometrik"}</button></>}
    {msg&&<div style={{marginTop:10,background:"#fee2e2",borderRadius:8,padding:"9px 12px",fontSize:13,color:"#991b1b"}}>{msg}</div>}
  </div>;
}


// ==================== DRAFT PROGRESS VIEW (Staf) ====================
function DraftProgressView({events,user,upd,showT,askConfirm,setTab,isMobile}){
  const NAVY="#0A1628",GOLD="#C9A84C";
  const mine=events.filter(e=>e.submittedBy===user?.username);
  const steps=[
    {key:"draft",label:"Draft",color:"#64748b"},
    {key:"menunggu_kasubbag",label:"Kasubbag",color:"#d97706"},
    {key:"menunggu_kabag",label:"Kabag",color:"#7c3aed"},
    {key:"disetujui",label:"Tayang",color:"#16a34a"},
  ];
  const getStep=(alur)=>steps.findIndex(s=>s.key===alur);
  const fmt=d=>{if(!d)return"";const[y,m,dd]=d.split("-");const M=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];return dd+" "+M[parseInt(m)-1]+" "+y;};
  if(mine.length===0)return <div style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:14}}>
    <div style={{fontSize:32,marginBottom:12}}>📝</div>
    <div>Belum ada jadwal yang Anda ajukan.</div>
    <button onClick={()=>setTab("input")} style={{marginTop:16,padding:"10px 24px",borderRadius:10,border:"none",background:NAVY,color:"white",cursor:"pointer",fontSize:14,fontWeight:700}}>+ Input Jadwal Baru</button>
  </div>;
  return <div style={{padding:isMobile?"12px":"20px",maxWidth:680,margin:"0 auto"}}>
    <div style={{fontSize:15,fontWeight:700,color:NAVY,marginBottom:16}}>📝 Draft & Progress Jadwal Anda</div>
    {mine.sort((a,b)=>b.tanggal?.localeCompare(a.tanggal||"")||0).map(ev=>{
      const stepIdx=getStep(ev.alur);
      const isDraft=ev.alur==="draft";
      const isDitolak=ev.alur==="ditolak";
      const isDisetujui=ev.alur==="disetujui";
      return <div key={ev.id} style={{background:"white",borderRadius:14,padding:"14px 16px",marginBottom:14,boxShadow:"0 2px 8px rgba(0,0,0,0.07)",border:"1.5px solid "+(isDitolak?"#fca5a5":isDraft?"#e2e8f0":isDisetujui?"#86efac":"#e2e8f0")}}>
        <div style={{fontSize:13,fontWeight:700,color:"#0F2040",marginBottom:4}}>{ev.namaAcara}</div>
        <div style={{fontSize:11,color:"#64748b",marginBottom:10}}>{fmt(ev.tanggal)} · {ev.jam} WITA · {ev.penyelenggara}</div>
        {/* Progress bar */}
        {!isDraft&&!isDitolak&&<div style={{display:"flex",alignItems:"center",gap:0,marginBottom:12}}>
          {steps.map((s,i)=><React.Fragment key={s.key}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:0,flex:1}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:i<=stepIdx?s.color:"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"white",fontWeight:700}}>{i<stepIdx?"✓":i===stepIdx?"●":"○"}</div>
              <div style={{fontSize:9,color:i<=stepIdx?s.color:"#94a3b8",marginTop:2,textAlign:"center",fontWeight:i===stepIdx?700:400}}>{s.label}</div>
            </div>
            {i<steps.length-1&&<div style={{flex:1,height:2,background:i<stepIdx?s.color:"#e2e8f0",minWidth:8,marginBottom:14}}/>}
          </React.Fragment>)}
        </div>}
        {isDraft&&!ev.catatanKasubbag&&!ev.catatanKabag&&<div style={{background:"#f1f5f9",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#64748b",marginBottom:10}}>Status: Draft — belum dikirim ke Kasubbag</div>}
        {isDraft&&ev.catatanKasubbag&&<div style={{background:"#fffbeb",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#b45309",marginBottom:10,border:"1px solid #fde68a"}}>
          <div style={{fontWeight:700}}>↩ Dikembalikan oleh Kasubbag — perlu perbaikan</div>
          <div style={{marginTop:4}}>Catatan: {ev.catatanKasubbag}</div>
        </div>}
        {isDraft&&ev.catatanKabag&&<div style={{background:"#fffbeb",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#b45309",marginBottom:10,border:"1px solid #fde68a"}}>
          <div style={{fontWeight:700}}>↩ Dikembalikan oleh Kabag — perlu perbaikan</div>
          <div style={{marginTop:4}}>Catatan: {ev.catatanKabag}</div>
        </div>}
        {isDitolak&&<div style={{background:"#fff1f2",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#dc2626",marginBottom:10}}>
          <div style={{fontWeight:700}}>❌ Ditolak</div>
          {ev.catatanTolak&&<div style={{marginTop:4}}>Catatan: {ev.catatanTolak}</div>}
        </div>}
        {isDisetujui&&<div style={{background:"#f0fdf4",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#16a34a",fontWeight:700,marginBottom:10}}>✅ Disetujui & Tayang</div>}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {(isDraft||isDitolak)&&<button onClick={()=>{if(typeof onEditDraft==="function")onEditDraft(ev);else setTab("input");}} style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid "+NAVY,background:"white",color:NAVY,cursor:"pointer",fontSize:12,fontWeight:600}}>✏️ Edit</button>}
          {isDraft&&<button onClick={()=>{upd(ev.id,{alur:"menunggu_kasubbag"});showT("Dikirim ke Kasubbag","ok");loadUsers().filter(u=>(u.role==="kasubbag_protokol")&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"submit",submittedBy:user?.nama}));sendPush({targetRole:"kasubbag_protokol",title:"📋 Jadwal Baru Masuk",body:ev.namaAcara+" — "+ev.jam+" WITA",url:"/",tag:"submit-"+ev.id});sendPush({targetRole:"kasubbag_komdokpim",title:"📋 Jadwal Baru Masuk",body:ev.namaAcara+" — "+ev.jam+" WITA",url:"/",tag:"submit-"+ev.id});}} style={{padding:"7px 14px",borderRadius:8,border:"none",background:NAVY,color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>Kirim ke Kasubbag →</button>}
          {isDitolak&&<button onClick={()=>{upd(ev.id,{alur:"menunggu_kasubbag",catatanTolak:""});showT("Dikirim ulang ke Kasubbag","ok");loadUsers().filter(u=>(u.role==="kasubbag_protokol")&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"submit",submittedBy:user?.nama}));sendPush({targetRole:"kasubbag_protokol",title:"📋 Jadwal Dikirim Ulang",body:ev.namaAcara,url:"/",tag:"resubmit-"+ev.id});sendPush({targetRole:"kasubbag_komdokpim",title:"📋 Jadwal Dikirim Ulang",body:ev.namaAcara,url:"/",tag:"resubmit-"+ev.id});}} style={{padding:"7px 14px",borderRadius:8,border:"none",background:"#d97706",color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>Kirim Ulang →</button>}
        </div>
      </div>;
    })}
  </div>;
}

// ==================== APPROVAL QUEUE VIEW (Kasubbag / Kabag) ====================
function ApprovalQueueView({events,role,upd,showT,askConfirm,isMobile}){
  const NAVY="#0A1628",GOLD="#C9A84C";
  const[rejectTexts,setRT]=React.useState({});
  // LocalTextarea: simpan state lokal agar tidak re-render list saat mengetik
  function LocalTextarea({evId,placeholder,rows,onCommit}){
    const[v,setV]=React.useState(rejectTexts[evId]||"");
    React.useEffect(()=>{setV(rejectTexts[evId]||"");},[evId]);
    return <textarea placeholder={placeholder} value={v} rows={rows||2}
      style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:12,resize:"vertical",boxSizing:"border-box",marginBottom:10}}
      onChange={e=>setV(e.target.value)}
      onBlur={e=>onCommit(evId,e.target.value)}/>;
  }
  const KASUBBAG_ROLES=["kasubbag_protokol","kasubbag_komdokpim"];
  const isKasubbag=KASUBBAG_ROLES.includes(role);
  const pending=events.filter(e=>isKasubbag?e.alur==="menunggu_kasubbag":e.alur==="menunggu_kabag")
    .sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
  const recent=events.filter(e=>e.alur==="disetujui"||e.alur==="ditolak")
    .sort((a,b)=>b.tanggal.localeCompare(a.tanggal)).slice(0,5);
  const fmt=d=>{if(!d)return"";const[y,m,dd]=d.split("-");const M=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];return dd+" "+M[parseInt(m)-1]+" "+y;};
  return <div style={{padding:isMobile?"12px":"20px",maxWidth:700,margin:"0 auto"}}>
    <div style={{fontSize:15,fontWeight:700,color:NAVY,marginBottom:4}}>
      {isKasubbag?"🔍 Antrian Verifikasi Kasubbag":"✅ Antrian Persetujuan Kabag"}
    </div>
    <div style={{fontSize:12,color:"#94a3b8",marginBottom:16}}>{pending.length} jadwal menunggu</div>
    {pending.length===0&&<div style={{background:"#f8fafc",borderRadius:12,padding:24,textAlign:"center",color:"#94a3b8",fontSize:13,marginBottom:20}}>
      <div style={{fontSize:28,marginBottom:8}}>✅</div>
      Tidak ada jadwal yang menunggu {isKasubbag?"verifikasi":"persetujuan"}.
    </div>}
    {pending.map(ev=><div key={ev.id} style={{background:"white",borderRadius:14,padding:"14px 16px",marginBottom:14,boxShadow:"0 2px 8px rgba(0,0,0,0.07)",border:"1.5px solid #fde68a"}}>
      <div style={{fontSize:13,fontWeight:700,color:"#0F2040",marginBottom:4}}>{ev.namaAcara}</div>
      <div style={{fontSize:11,color:"#64748b",marginBottom:2}}>{fmt(ev.tanggal)} · {ev.jam} WITA · {ev.penyelenggara}</div>
      {ev.lokasi&&<div style={{fontSize:11,color:"#64748b",marginBottom:2}}>📍 {ev.lokasi}</div>}
      <div style={{marginBottom:4,marginTop:2}}><TujuanBadge ev={ev}/></div>
      {ev.pakaian&&<div style={{fontSize:11,color:"#64748b",marginBottom:8}}>Pakaian: {ev.pakaian}</div>}
      {ev.submittedBy&&<div style={{fontSize:11,color:"#94a3b8",marginBottom:6}}>Diajukan oleh: {getNamaByUsername(ev.submittedBy)}</div>}
      {ev.undanganFile&&<div style={{display:"flex",gap:7,marginBottom:10}}>
        <a href={ev.undanganFile} target="_blank" rel="noopener noreferrer" style={{flex:1,padding:"7px",borderRadius:8,border:"1.5px solid #0284c7",background:"white",color:"#0284c7",textDecoration:"none",textAlign:"center",fontSize:12,fontWeight:700}}>👁 Lihat Undangan</a>
        <a href={ev.undanganFile} download={ev.undanganNama||"undangan"} style={{flex:1,padding:"7px",borderRadius:8,border:"none",background:"#0284c7",color:"white",textDecoration:"none",textAlign:"center",fontSize:12,fontWeight:700}}>⬇ Unduh</a>
      </div>}
      <LocalTextarea evId={ev.id} placeholder="Catatan penolakan (wajib diisi untuk kembalikan ke staf)..." rows={2} onCommit={(id,v)=>setRT(p=>({...p,[id]:v}))}/>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={()=>askConfirm("Kembalikan ke Staf?","Jadwal dikembalikan ke staf input dengan catatan perbaikan.",()=>{upd(ev.id,{alur:"ditolak",catatanTolak:rejectTexts[ev.id]||"Perlu perbaikan",_requiresEdit:true});showT("Dikembalikan ke Admin RK","warn");const _ur=loadUsers().find(u=>u.username===ev.submittedBy);if(_ur?.noWA)sendWA({to:_ur.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,event:"rejected",catatanTolak:rejectTexts[ev.id]||"",submittedBy:getNamaByUsername(ev.submittedBy)});sendPush({targetRole:"admin_rk",title:"❌ Jadwal Dikembalikan",body:ev.namaAcara+": "+(rejectTexts[ev.id]||"Perlu diperbaiki"),url:"/",tag:"rejected-"+ev.id});},"Kembalikan","#f59e0b")} style={{padding:"8px 16px",borderRadius:8,border:"1.5px solid #f59e0b",background:"white",color:"#b45309",cursor:"pointer",fontSize:12,fontWeight:600}}>↩ Kembalikan ke Staf</button>
        {isKasubbag&&<button onClick={()=>{upd(ev.id,{alur:"menunggu_kabag"});showT("Diteruskan ke Kabag","ok");loadUsers().filter(u=>u.role==="kabag"&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"kasubbag_approve"}));sendPush({targetRole:"kabag",title:"✅ Menunggu Persetujuan Anda",body:ev.namaAcara+" — "+ev.jam+" WITA",url:"/",tag:"approve-"+ev.id});}} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#7c3aed",color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>Teruskan ke Kabag →</button>}
        {!isKasubbag&&<button onClick={()=>askConfirm("Batalkan Tayang & Kembalikan ke Kasubbag?","Jadwal akan ditarik dari tampilan publik dan dikembalikan ke Kasubbag untuk perbaikan.",()=>{upd(ev.id,{alur:"menunggu_kasubbag",catatanKabag:rejectTexts[ev.id]||"Perlu perbaikan"});showT("Dikembalikan ke Kasubbag","warn");},"Kembalikan","#f59e0b")} style={{padding:"8px 16px",borderRadius:8,border:"1.5px solid #f59e0b",background:"white",color:"#b45309",cursor:"pointer",fontSize:12,fontWeight:600}}>↩ Kembalikan ke Kasubbag</button>}
        {!isKasubbag&&<button onClick={()=>{upd(ev.id,{alur:"disetujui"});showT("Jadwal disetujui & tayang!","ok");const _u=loadUsers().find(u=>u.username===ev.submittedBy);if(_u?.noWA)sendWA({to:_u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"approved",submittedBy:getNamaByUsername(ev.submittedBy)});sendPush({targetRole:"admin_rk",title:"✅ Jadwal Disetujui",body:ev.namaAcara+" sudah dipublikasi",url:"/",tag:"approved-"+ev.id});loadUsers().filter(u=>(u.role==="ajudan_walikota"||u.role==="ajudan_wakilwalikota")&&u.noWA).forEach(u=>{const isWK=u.role==="ajudan_walikota"&&(ev.untukPimpinan||[]).includes("walikota");const isWWK=u.role==="ajudan_wakilwalikota"&&((ev.untukPimpinan||[]).includes("wakilwalikota")||ev.delegasiKeWWK);if(isWK||isWWK)sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"approved"});});}} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#16a34a",color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>✅ Setujui & Publikasi</button>}
      </div>
    </div>)}
    {recent.length>0&&<><div style={{fontSize:13,fontWeight:700,color:"#64748b",marginTop:8,marginBottom:10}}>Riwayat Terkini</div>
    {recent.map(ev=><div key={ev.id} style={{background:"#f8fafc",borderRadius:10,padding:"10px 14px",marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:14}}>{ev.alur==="disetujui"?"✅":"❌"}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:600,color:"#0F2040",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.namaAcara}</div>
          <div style={{fontSize:10,color:"#94a3b8"}}>{fmt(ev.tanggal)} · {ev.alur==="disetujui"?"Disetujui":"Ditolak"}</div>
        </div>
      </div>
      {!isKasubbag&&ev.alur==="disetujui"&&<div style={{marginTop:8,display:"flex",gap:6,alignItems:"center"}}>
        <textarea placeholder="Catatan perbaikan..." value={rejectTexts[ev.id+"_recall"]||""} onChange={e=>setRT(p=>({...p,[ev.id+"_recall"]:e.target.value}))} rows={1} style={{flex:1,padding:"6px 10px",borderRadius:7,border:"1.5px solid #fde68a",fontSize:11,resize:"none",boxSizing:"border-box"}}/>
        <button onClick={()=>askConfirm("Batalkan Tayang?","Jadwal ini akan ditarik dan dikembalikan ke Kasubbag untuk perbaikan.",()=>{upd(ev.id,{alur:"menunggu_kasubbag",catatanKabag:rejectTexts[ev.id+"_recall"]||"Perlu perbaikan"});showT("Jadwal ditarik & dikembalikan","warn");},"Tarik","#f59e0b")} style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #f59e0b",background:"white",color:"#b45309",cursor:"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>↩ Batalkan Tayang</button>
      </div>}
      {isKasubbag&&ev.alur==="menunggu_kasubbag"&&ev.catatanKabag&&<div style={{marginTop:6,padding:"5px 10px",background:ev._kabagRecall?"#FEF2F2":"#fffbeb",borderRadius:7,fontSize:11,color:ev._kabagRecall?"#991B1B":"#b45309",border:"1px solid "+(ev._kabagRecall?"#FECACA":"#fde68a"),fontWeight:600}}>{ev._kabagRecall?"↩ Ditarik Kabag: ":"📝 Catatan Kabag: "}{ev.catatanKabag}</div>}
    </div>)}</>}
  </div>;
}

// ==================== IMPORT USERS TAB ====================
function ImportUsersTab({users,save,showT}){
  const NAVY="#0A1628";
  const[preview,setPreview]=React.useState([]);
  const[loading,setLoading]=React.useState(false);
  const[done,setDone]=React.useState(false);
  const ROLES=["staf","admin_rk","kasubbag_protokol","kasubbag_komdokpim","kabag","ajudan_walikota","ajudan_wakilwalikota","timkom","walikota","wakilwalikota","mitra_kerja"];
  const parseCSV=(text)=>{
    const lines=text.trim().split('\n').filter(Boolean);
    if(lines.length<2)return[];
    const header=lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/[^a-z]/g,''));
    const colIdx={nama:header.findIndex(h=>h.includes('nama')),nip:header.findIndex(h=>h.includes('nip')||h.includes('username')),jabatan:header.findIndex(h=>h.includes('jabatan')||h.includes('jabat')),wa:header.findIndex(h=>h.includes('wa')||h.includes('hp')||h.includes('telp'))};
    return lines.slice(1).map(line=>{const cols=line.split(',').map(c=>c.trim().replace(/^"|"$/g,''));return{nama:colIdx.nama>=0?cols[colIdx.nama]:'',nip:colIdx.nip>=0?cols[colIdx.nip]:'',jabatan:colIdx.jabatan>=0?cols[colIdx.jabatan]:'',noWA:colIdx.wa>=0?cols[colIdx.wa]:'',role:'staf'};}).filter(r=>r.nama);
  };
  const loadXLSX=(file)=>{
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload=()=>{
        const r=new FileReader();
        r.onload=e=>{
          try{const wb=XLSX.read(e.target.result,{type:'binary'});const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_csv(ws);resolve(parseCSV(rows));}catch(err){reject(err);}
        };
        r.readAsBinaryString(file);
      };
      s.onerror=reject;
      if(!window.XLSX)document.head.appendChild(s);else{const r=new FileReader();r.onload=e=>{try{const wb=XLSX.read(e.target.result,{type:'binary'});const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_csv(ws);resolve(parseCSV(rows));}catch(err){reject(err);}};r.readAsBinaryString(file);}
    });
  };
  const handleFile=async(e)=>{
    const file=e.target.files[0];if(!file)return;
    setLoading(true);
    try{
      let rows;
      if(file.name.endsWith('.csv')){const text=await file.text();rows=parseCSV(text);}
      else{rows=await loadXLSX(file);}
      setPreview(rows);setDone(false);
    }catch(err){showT("Gagal baca file: "+err.message,"err");}
    setLoading(false);
  };
  const doImport=async()=>{
    setLoading(true);
    const toAdd=preview.filter(r=>r.nama&&r.nip&&!users.find(u=>u.username===r.nip.toLowerCase()));
    const hashed=await Promise.all(toAdd.map(r=>hashPassword('12345678').then(pw=>({username:r.nip.toLowerCase(),password:pw,nama:r.nama,jabatan:r.jabatan,noWA:r.noWA,role:r.role}))));
    save([...users,...hashed]);
    setDone(true);setLoading(false);
    showT(`${hashed.length} pengguna berhasil diimport ✓`);
  };
  return <div>
    <div style={{fontSize:13,color:"#64748b",marginBottom:12}}>Upload file Excel (.xlsx, .xls) atau CSV dengan kolom: Nama, NIP, Jabatan, No WA. Password default: <strong>12345678</strong></div>
    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{marginBottom:12,width:"100%"}}/>
    {loading&&<div style={{textAlign:"center",padding:16,color:"#64748b"}}>Memproses...</div>}
    {preview.length>0&&!done&&<>
      <div style={{fontSize:12,fontWeight:700,color:NAVY,marginBottom:8}}>{preview.length} baris ditemukan</div>
      <div style={{overflowX:"auto",marginBottom:12}}>
        <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
          <thead><tr style={{background:"#f1f5f9"}}><th style={{padding:"6px 8px",textAlign:"left"}}>Nama</th><th style={{padding:"6px 8px",textAlign:"left"}}>NIP/Username</th><th style={{padding:"6px 8px",textAlign:"left"}}>Jabatan</th><th style={{padding:"6px 8px",textAlign:"left"}}>Role</th></tr></thead>
          <tbody>{preview.map((r,i)=><tr key={i} style={{borderBottom:"1px solid #f1f5f9"}}>
            <td style={{padding:"6px 8px"}}>{r.nama}</td>
            <td style={{padding:"6px 8px",color:users.find(u=>u.username===r.nip.toLowerCase())?"#ef4444":"#16a34a"}}>{r.nip}{users.find(u=>u.username===r.nip.toLowerCase())&&" (sudah ada)"}</td>
            <td style={{padding:"6px 8px"}}>{r.jabatan}</td>
            <td style={{padding:"4px 8px"}}><select value={r.role} onChange={e=>setPreview(p=>p.map((x,j)=>j===i?{...x,role:e.target.value}:x))} style={{fontSize:11,padding:"3px 6px",borderRadius:6,border:"1px solid #e2e8f0"}}>{ROLES.map(ro=><option key={ro}>{ro}</option>)}</select></td>
          </tr>)}</tbody>
        </table>
      </div>
      <button onClick={doImport} disabled={loading} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:NAVY,color:"white",cursor:"pointer",fontWeight:700,fontSize:13}}>Import {preview.filter(r=>!users.find(u=>u.username===r.nip.toLowerCase())).length} Pengguna Baru</button>
    </>}
    {done&&<div style={{background:"#f0fdf4",borderRadius:10,padding:"12px 16px",color:"#16a34a",fontWeight:700,textAlign:"center"}}>✅ Import selesai! Minta pengguna ganti password 12345678.</div>}
  </div>;
}

// ==================== MITRA KERJA VIEW ====================
function MitraKerjaView({events,isMobile}){
  const NAVY="#0A1628",GOLD="#C9A84C";
  const fmt=t=>new Date(t).toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const fmtShort=t=>new Date(t).toLocaleDateString("id-ID",{day:"numeric",month:"short"});
  const todayStr=()=>new Date().toLocaleDateString("id-ID",{timeZone:"Asia/Makassar"}).split("/").reverse().map((v,i)=>i===1?v.padStart(2,"0"):v.padStart(2,"0")).join("-");
  const today=new Date().toISOString().slice(0,10);

  const [filter,setFilter]=React.useState("upcoming"); // upcoming | today | all
  const [search,setSearch]=React.useState("");

  const visible=events
    .filter(e=>e.alur==="disetujui")
    .filter(e=>{
      if(filter==="today")return e.tanggal===today;
      if(filter==="upcoming")return e.tanggal>=today;
      return true;
    })
    .filter(e=>!search||e.namaAcara?.toLowerCase().includes(search.toLowerCase())||e.penyelenggara?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));

  const hadir=(ev)=>{
    const list=[];
    if((ev.untukPimpinan||[]).includes("walikota")){
      if(ev.statusWK==="diwakilkan")list.push("Wali Kota (diwakili "+( ev.perwakilanWK||"…")+")"+(ev.besertaIstriWK?" & Istri":""));
      else if(ev.delegasiKeWWK)list.push("Wali Kota → Delegasi ke Wakil WK");
      else list.push("Wali Kota"+(ev.besertaIstriWK?" & Istri":""));
    }
    if((ev.untukPimpinan||[]).includes("wakilwalikota")){
      if(ev.statusWWK==="diwakilkan")list.push("Wakil WK (diwakili "+(ev.perwakilanWWK||"…")+")"+(ev.besertaIstriWWK?" & Istri":""));
      else list.push("Wakil Wali Kota"+(ev.besertaIstriWWK?" & Istri":""));
    }
    if(ev.delegasiKeWWK&&!(ev.untukPimpinan||[]).includes("wakilwalikota"))list.push("Wakil Wali Kota (delegasi)");
    return list;
  };

  const tim=(ev)=>(ev.personil||[]).map(un=>{
    const u=loadUsers().find(x=>x.username===un);
    return u?.nama||un;
  });

  return <div style={{maxWidth:720,margin:"0 auto",padding:isMobile?"12px 8px":"20px 0"}}>
    {/* Search & filter bar */}
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
      <input value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="🔍 Cari nama acara atau penyelenggara…"
        style={{flex:1,minWidth:180,padding:"10px 14px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,outline:"none"}}/>
      {["upcoming","today","all"].map(f=>(
        <button key={f} onClick={()=>setFilter(f)}
          style={{padding:"9px 14px",borderRadius:10,border:"1.5px solid "+(filter===f?NAVY:"#e2e8f0"),
            background:filter===f?NAVY:"white",color:filter===f?"white":"#475569",
            cursor:"pointer",fontSize:12,fontWeight:700}}>
          {f==="upcoming"?"Mendatang":f==="today"?"Hari Ini":"Semua"}
        </button>
      ))}
    </div>

    {visible.length===0&&<div style={{textAlign:"center",padding:"60px 24px",background:"white",borderRadius:16,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
      <div style={{fontSize:42,marginBottom:10}}>📭</div>
      <div style={{fontSize:15,fontWeight:700,color:"#334155"}}>Tidak ada agenda ditemukan</div>
      <div style={{fontSize:12,color:"#94A3B8",marginTop:4}}>Coba ubah filter atau kata kunci pencarian</div>
    </div>}

    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {visible.map(ev=>{
        const hadirList=hadir(ev);
        const timList=tim(ev);
        const isToday=ev.tanggal===today;
        return <div key={ev.id} style={{background:"white",borderRadius:14,overflow:"hidden",
          boxShadow:"0 2px 12px rgba(0,0,0,0.07)",
          border:"1.5px solid "+(isToday?"#93C5FD":"#F1F5F9")}}>
          {/* Top accent bar */}
          {isToday&&<div style={{height:3,background:"linear-gradient(90deg,"+NAVY+",#3B82F6)"}}/>}
          <div style={{padding:"14px 16px"}}>
            {/* Tanggal + jam */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{background:isToday?"#EFF6FF":"#F8FAFC",border:"1px solid "+(isToday?"#BFDBFE":"#E2E8F0"),
                borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,color:isToday?"#1D4ED8":"#64748B",whiteSpace:"nowrap"}}>
                {isToday?"🔵 HARI INI":fmtShort(ev.tanggal)}
              </div>
              <div style={{fontSize:12,color:"#64748B",fontWeight:600}}>⏰ {ev.jam} WITA</div>
              {ev.jenisKegiatan&&<div style={{fontSize:10,padding:"2px 7px",borderRadius:6,background:"#F1F5F9",color:"#64748B",fontWeight:600}}>{ev.jenisKegiatan}</div>}
            </div>
            {/* Nama acara */}
            <div style={{fontSize:15,fontWeight:800,color:NAVY,marginBottom:4,lineHeight:1.3}}>{ev.namaAcara}</div>
            {/* Penyelenggara + lokasi */}
            <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:10,fontSize:12,color:"#64748B"}}>
              {ev.penyelenggara&&<span>🏢 {ev.penyelenggara}</span>}
              {ev.lokasi&&<span>📍 {ev.lokasi}</span>}
            </div>
            {/* Siapa yang hadir */}
            {hadirList.length>0&&<div style={{background:"#F0F9FF",borderRadius:9,padding:"8px 12px",marginBottom:8}}>
              <div style={{fontSize:10,fontWeight:700,color:"#0369A1",marginBottom:4,textTransform:"uppercase",letterSpacing:0.8}}>Pimpinan yang Hadir</div>
              {hadirList.map((h,i)=><div key={i} style={{fontSize:12,color:"#0C4A6E",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:14}}>👤</span>{h}
              </div>)}
            </div>}
            {/* Tim bertugas */}
            {timList.length>0&&<div style={{background:"#F0FDF4",borderRadius:9,padding:"8px 12px"}}>
              <div style={{fontSize:10,fontWeight:700,color:"#15803D",marginBottom:4,textTransform:"uppercase",letterSpacing:0.8}}>Tim Bertugas ({timList.length} orang)</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {timList.map((n,i)=><span key={i} style={{fontSize:11,padding:"3px 8px",borderRadius:8,background:"#DCFCE7",color:"#166534",fontWeight:600}}>
                  🟢 {n}
                </span>)}
              </div>
            </div>}
            {timList.length===0&&hadirList.length===0&&<div style={{fontSize:11,color:"#CBD5E1",fontStyle:"italic"}}>Belum ada data kehadiran & penugasan</div>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}

// ==================== ADMIN MODAL ====================
function AdminModal({onClose,showT}){
  const[users,setUsers]=useState(loadUsers);const[tabA,setTabA]=useState("users");const[pendRegs,setPendRegs]=React.useState(()=>loadPendingRegs());
  // Fungsi refresh: gabung localStorage + Supabase
  const refreshPendRegs=async()=>{
    const local=loadPendingRegs();
    const remote=await dbLoadPendingRegs();
    if(remote){
      // Gabung: tambah entry dari remote yang belum ada di local
      const merged=[...local];
      remote.forEach(r=>{if(!merged.find(x=>x.id===r.id))merged.push(r);});
      // Update localStorage dengan data terbaru
      savePendingRegs(merged);
      setPendRegs(merged);
    } else {
      setPendRegs(local);
    }
  };
  // Refresh pendRegs setiap kali tab pendaftaran dibuka
  React.useEffect(()=>{
    refreshPendRegs();
    const iv=setInterval(()=>refreshPendRegs(),5000);
    const onStorage=()=>refreshPendRegs();
    window.addEventListener("storage",onStorage);
    return ()=>{clearInterval(iv);window.removeEventListener("storage",onStorage);};
  },[]);
  React.useEffect(()=>{if(tabA==="pendaftaran")refreshPendRegs();},[tabA]);const[editUser,setEditUser]=useState(null);const[newUser,setNewUser]=useState({username:"",password:"",nama:"",jabatan:"",role:"staf",noWA:""});const[err,setErr]=useState("");
  const save=u=>{setUsers(u);saveUsers(u);};
  const doAdd=async()=>{
    setErr("");
    if(!newUser.username||!newUser.password||!newUser.nama)return setErr("Username, password & nama wajib.");
    if(users.find(u=>u.username===newUser.username.toLowerCase()))return setErr("Username sudah ada.");
    const hashed=await hashPassword(newUser.password);
    save([...users,{...newUser,username:newUser.username.toLowerCase(),password:hashed}]);
    setNewUser({username:"",password:"",nama:"",jabatan:"",role:"staf",noWA:""});
    showT("Pengguna ditambahkan ✓");
  };
  const doDelete=async un=>{
    setConfirmDlg({title:"Hapus Pengguna?",body:"Akun "+un+" akan dihapus permanen.",confirmLabel:"Hapus",confirmColor:"#DC2626",onConfirm:()=>dbDeleteUser(un).then(()=>{initUsers().catch(e=>console.warn("Sync:",e?.message||e));showT("Pengguna dihapus");})});return;
    const updated=users.filter(u=>u.username!==un);
    save(updated);
    await dbDeleteUser(un).catch(e=>console.warn("dbDeleteUser error:",e));
    showT("Pengguna dihapus");
  };
  const doSaveEdit=async()=>{
    setErr("");
    if(!editUser.nama)return setErr("Nama wajib.");
    let toSave={...editUser};
    // Jika password diisi dan belum di-hash, hash dulu
    if(toSave._newPw){
      toSave.password=await hashPassword(toSave._newPw);
      delete toSave._newPw;
    }
    save(users.map(u=>u.username===toSave.username?toSave:u));
    setEditUser(null);
    showT("Data disimpan ✓");
  };
  const inp={width:"100%",padding:"9px 11px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:13,background:"white",color:"#1e293b"};
  return <div style={{position:"fixed",inset:0,zIndex:8200,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:"white",borderRadius:16,width:"100%",maxWidth:560,maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"16px 20px 0",borderBottom:"1px solid #f1f5f9",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><div style={{flex:1,fontSize:16,fontWeight:700,color:NAVY}}>Panel Admin</div><button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:13,fontWeight:700,color:"#64748b"}}>Tutup</button></div>
        <div style={{display:"flex",gap:0,overflowX:"auto"}}>{[{k:"users",l:"Pengguna"},{k:"pendaftaran",l:"Pendaftaran"+(pendRegs.length>0?" ("+pendRegs.length+")":"")},{k:"add",l:"Tambah"},{k:"pw",l:"Reset PW"},{k:"import",l:"Import"},{k:"export",l:"📦 Backup"}].map(t=><button key={t.k} onClick={()=>{setTabA(t.k);setErr("");}} style={{padding:"9px 14px",border:"none",background:"transparent",color:tabA===t.k?NAVY:t.k==="pendaftaran"&&pendRegs.length>0?"#DC2626":"#94a3b8",fontWeight:tabA===t.k?700:500,fontSize:12,cursor:"pointer",borderBottom:tabA===t.k?"2.5px solid "+NAVY:"2.5px solid transparent",whiteSpace:"nowrap"}}>{t.l}</button>)}</div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px 20px"}}>
        {err&&<div style={{background:"#fee2e2",borderRadius:8,padding:"9px 12px",marginBottom:12,fontSize:13,color:"#991b1b"}}>{err}</div>}
        {tabA==="users"&&<>{users.map(u=><div key={u.username} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,marginBottom:7,border:"1.5px solid #e2e8f0",background:"#f8fafc"}}>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.nama}</div><div style={{fontSize:11,color:"#64748b"}}>{u.username} | {ALL_ROLE_DEFS.find(r=>r.key===u.role)?.label||u.role}</div></div>
          <button onClick={()=>setEditUser({...u,_newPw:""})} style={{padding:"5px 10px",borderRadius:7,border:"1.5px solid "+NAVY,background:"white",color:NAVY,cursor:"pointer",fontSize:11,fontWeight:700}}>Edit</button>
          <button onClick={()=>doDelete(u.username)} style={{padding:"5px 10px",borderRadius:7,border:"1.5px solid #fca5a5",background:"white",color:"#ef4444",cursor:"pointer",fontSize:11,fontWeight:700}}>Hapus</button>
        </div>)}
        {editUser&&<div style={{background:"#EBF0FA",borderRadius:12,padding:14,marginTop:8,border:"1.5px solid "+NAVY}}>
          <div style={{fontSize:13,fontWeight:700,color:NAVY,marginBottom:10}}>Edit: {editUser.username}</div>
          {[{k:"nama",l:"Nama"},{k:"jabatan",l:"Jabatan"}].map(f=><div key={f.k} style={{marginBottom:8}}><label style={{display:"block",fontSize:11,color:"#64748b",fontWeight:600,marginBottom:2}}>{f.l}</label><input value={editUser[f.k]||""} onChange={e=>setEditUser(p=>({...p,[f.k]:e.target.value}))} style={inp}/></div>)}
          <div style={{marginBottom:8}}><label style={{display:"block",fontSize:11,color:"#64748b",fontWeight:600,marginBottom:2}}>No. WhatsApp</label><input value={editUser.noWA||""} onChange={e=>setEditUser(p=>({...p,noWA:e.target.value}))} placeholder="08123456789" style={inp}/><div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>📱 Untuk OTP reset password</div></div>
          <div style={{marginBottom:8}}><label style={{display:"block",fontSize:11,color:"#64748b",fontWeight:600,marginBottom:2}}>Password Baru (kosong = tidak ubah)</label><input type="password" placeholder="Isi untuk reset password" onChange={e=>setEditUser(p=>({...p,_newPw:e.target.value||undefined}))} style={inp}/></div>
            <div style={{background:"#fef9c3",borderRadius:7,padding:"7px 10px",fontSize:11,color:"#92400e",marginBottom:6}}>💡 Kabag bisa reset password langsung dari sini tanpa OTP.</div>
          <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,color:"#64748b",fontWeight:600,marginBottom:2}}>Role / Hak Akses</label><select value={editUser.role} onChange={e=>setEditUser(p=>({...p,role:e.target.value}))} style={{...inp,WebkitAppearance:"none"}}>{ALL_ROLE_DEFS.map(r=><option key={r.key} value={r.key}>{r.label}</option>)}</select></div>
          <div style={{display:"flex",gap:8}}><button onClick={()=>setEditUser(null)} style={{flex:1,padding:"10px",borderRadius:9,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600}}>Batal</button><button onClick={doSaveEdit} style={{flex:2,padding:"10px",borderRadius:9,border:"none",background:NAVY,color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>Simpan</button></div>
        </div>}</>}
        {tabA==="add"&&<>{[{k:"username",l:"Username *"},{k:"nama",l:"Nama Lengkap *"},{k:"jabatan",l:"Jabatan"}].map(f=><div key={f.k} style={{marginBottom:10}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:3}}>{f.l}</label><input value={newUser[f.k]||""} onChange={e=>setNewUser(p=>({...p,[f.k]:e.target.value}))} autoCapitalize="none" style={inp}/></div>)}
          <div style={{marginBottom:10}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:3}}>Password *</label><input type="password" value={newUser.password||""} onChange={e=>setNewUser(p=>({...p,password:e.target.value}))} style={inp}/></div>
          <div style={{marginBottom:16}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:3}}>Role / Hak Akses</label><select value={newUser.role} onChange={e=>setNewUser(p=>({...p,role:e.target.value}))} style={{...inp,WebkitAppearance:"none"}}>{ALL_ROLE_DEFS.map(r=><option key={r.key} value={r.key}>{r.label}</option>)}</select></div>
          <div style={{marginBottom:16}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:3}}>No. WhatsApp (opsional)</label><input value={newUser.noWA||""} onChange={e=>setNewUser(p=>({...p,noWA:e.target.value}))} placeholder="08123456789" style={inp}/><div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>Untuk menerima notifikasi otomatis</div></div>
          <button onClick={doAdd} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:NAVY,color:"white",cursor:"pointer",fontSize:14,fontWeight:700}}>Tambahkan Pengguna</button></>}
        {tabA==="pendaftaran"&&<div>{pendRegs.length===0
          ?<div style={{textAlign:"center",padding:"30px 10px",color:"#94a3b8"}}><div style={{fontSize:36,marginBottom:8}}>📭</div><div style={{fontWeight:700}}>Tidak ada permohonan</div></div>
          :pendRegs.map(r=><div key={r.id} style={{background:"#FAFAFA",borderRadius:10,border:"1.5px solid #E2E8F0",marginBottom:10,padding:"12px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,color:NAVY,fontSize:14}}>{r.nama}</div>
                <div style={{fontSize:11,color:"#64748B",marginTop:2}}>{r.jabatan} · {ROLE_LABEL[r.role]||r.role}</div>
                <div style={{fontSize:11,color:"#94A3B8",marginTop:1}}>@{r.username}{r.noWA?" · "+r.noWA:""}</div>
                {r.alasan&&<div style={{fontSize:11,color:"#475569",fontStyle:"italic",marginTop:4,background:"#F0F4FF",borderRadius:5,padding:"4px 8px"}}>{r.alasan}</div>}
                <div style={{fontSize:10,color:"#CBD5E1",marginTop:4}}>{new Date(r.tanggal).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})}</div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button onClick={()=>{
                  const regs=loadPendingRegs().filter(x=>x.id!==r.id);
                  savePendingRegs(regs);setPendRegs(regs);
                  dbDeletePendingReg(r.id).catch(e=>console.warn("Sync:",e?.message||e));
                  const newU={username:r.username,password:r.password,nama:r.nama,jabatan:r.jabatan,role:r.role,noWA:r.noWA||""};
                  const all=loadUsers();saveUsers([...all,newU]);setUsers([...all,newU]);
                  dbUpsertUser(newU).catch(e=>console.warn("Sync:",e?.message||e));
                  showT("Akun "+r.username+" diaktifkan ✓");
                }} style={{padding:"6px 12px",borderRadius:8,border:"none",background:"#10b981",color:"white",cursor:"pointer",fontSize:11,fontWeight:700}}>✓ Setujui</button>
                <button onClick={()=>{const regs=loadPendingRegs().filter(x=>x.id!==r.id);savePendingRegs(regs);setPendRegs(regs);dbDeletePendingReg(r.id).catch(e=>console.warn("Sync:",e?.message||e));showT("Permohonan ditolak","warn");}} style={{padding:"6px 10px",borderRadius:8,border:"1.5px solid #fca5a5",background:"white",color:"#ef4444",cursor:"pointer",fontSize:11,fontWeight:700}}>✕ Tolak</button>
              </div>
            </div>
          </div>)
        }</div>}
        {tabA==="pw"&&<div style={{background:"#fef3c7",borderRadius:10,padding:"12px 14px",fontSize:13,color:"#92400e"}}>Untuk reset password pengguna, gunakan tab Pengguna lalu klik Edit pada akun yang bersangkutan.</div>}
        {tabA==="import"&&<ImportUsersTab users={users} save={save} showT={showT}/>}
        {tabA==="export"&&<div>
          <div style={{background:"#EFF6FF",borderRadius:10,padding:"12px 14px",marginBottom:14,border:"1px solid #BFDBFE",fontSize:12,color:"#1D4ED8",lineHeight:1.7}}>
            📦 Backup data pengguna ke file JSON. Gunakan untuk cadangan atau migrasi ke sistem lain.
          </div>
          <button onClick={()=>{
            const data={exportDate:new Date().toISOString(),users:users.map(u=>({username:u.username,nama:u.nama,jabatan:u.jabatan,role:u.role,noWA:u.noWA||""})),totalUsers:users.length};
            const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
            const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="prokopim-users-backup-"+new Date().toISOString().slice(0,10)+".json";a.click();URL.revokeObjectURL(url);
            showT("Backup pengguna berhasil diunduh ✓");
          }} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:NAVY,color:"white",cursor:"pointer",fontSize:14,fontWeight:700,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span style={{fontSize:18}}>👥</span> Export Data Pengguna (JSON)
          </button>
          <button onClick={async()=>{
            try{
              let evts=[];
              if(SUPA_OK){const rows=await dbLoadAll();if(rows)evts=rows;}
              else{try{evts=JSON.parse(localStorage.getItem("jp_events")||"[]");}catch{}}
              const data={exportDate:new Date().toISOString(),events:evts,totalEvents:evts.length};
              const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
              const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="prokopim-jadwal-backup-"+new Date().toISOString().slice(0,10)+".json";a.click();URL.revokeObjectURL(url);
              showT("Backup jadwal berhasil diunduh ("+evts.length+" jadwal) ✓");
            }catch(e){showT("Gagal mengekspor: "+e.message,"error");}
          }} style={{width:"100%",padding:"14px",borderRadius:12,border:"1.5px solid "+NAVY,background:"white",color:NAVY,cursor:"pointer",fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span style={{fontSize:18}}>📅</span> Export Data Jadwal (JSON)
          </button>
          <div style={{marginTop:14,padding:"10px 13px",background:"#f8fafc",borderRadius:9,border:"1px solid #e2e8f0",fontSize:11,color:"#64748b",lineHeight:1.8}}>
            <div style={{fontWeight:700,color:"#475569",marginBottom:4}}>Catatan:</div>
            <div>• Password tidak disertakan dalam export pengguna</div>
            <div>• File backup bisa dibuka di text editor atau diolah di Excel</div>
            <div>• Simpan file backup di tempat aman secara berkala</div>
          </div>
        </div>}
      </div>
    </div>
  </div>;
}


// ==================== FORM UNDANGAN UPLOAD (inline, for FormView) ====================
function FormUndanganUpload({onFile,compact,label}){
  const ref=useRef();
  const[load,setLoad]=useState(false);
  const handle=f=>{
    if(!f)return;
    if(!f.type.match(/pdf|image/)){globalToast("Hanya file PDF atau gambar yang didukung.");return;}
    if(f.size>15*1024*1024){globalToast("Ukuran file maksimal 15MB.");return;}
    setLoad(true);
    const reader=new FileReader();
    reader.onload=e=>{onFile(f,f.name,e.target.result);setLoad(false);};
    reader.onerror=()=>setLoad(false);
    reader.readAsDataURL(f);
  };
  if(compact){
    return <div style={{flex:1}}>
      <input ref={ref} type="file" accept="application/pdf,image/*"
        onChange={e=>{handle(e.target.files[0]);e.target.value="";}}
        style={{display:"none"}}/>
      <button type="button" onClick={()=>ref.current.click()} disabled={load}
        style={{width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #0284c7",
          background:"white",color:"#0284c7",cursor:load?"default":"pointer",fontSize:12,fontWeight:700}}>
        {load?"Memuat...":(label||"📎 Upload")}
      </button>
    </div>;
  }
  return(
    <div style={{background:"#f8fafc",borderRadius:10,padding:11,border:"1.5px dashed #7dd3fc"}}>
      <input ref={ref} type="file" accept="application/pdf,image/*"
        onChange={e=>{handle(e.target.files[0]);e.target.value="";}}
        style={{display:"none"}}/>
      <button type="button" onClick={()=>ref.current.click()} disabled={load}
        style={{width:"100%",padding:"11px",borderRadius:8,border:"1.5px dashed #0284c7",
          background:load?"#f1f5f9":"white",color:"#0284c7",
          cursor:load?"default":"pointer",fontSize:13,fontWeight:700,
          display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        <span style={{fontSize:16}}>📎</span>
        {load?"Memuat...":"Upload PDF / Foto Undangan"}
      </button>
    </div>
  );
}

// ==================== FORM VIEW (top-level - prevents re-mount on every keystroke) ====================

// ═══════════════════════════════════════════════════════
// PENUGASAN PERSONIL MODAL
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// EVALUASI PASCA KEGIATAN MODAL
// ═══════════════════════════════════════════════════════
const EVAL_PROTOKOL=[
  "Persiapan tata acara & koordinasi dengan panitia",
  "Pengaturan posisi pimpinan, tamu, dan alur acara",
  "Koordinasi antar petugas protokol di lapangan",
  "Pelaksanaan acara sesuai rundown yang disusun",
  "Penanganan kendala di lapangan secara cepat & tepat",
];
const EVAL_KOMDOK=[
  "Pengambilan foto/video menangkap momen penting",
  "Koordinasi dengan tim protokol terkait momen penting",
  "Kesiapan peralatan dokumentasi & komunikasi",
  "Kecepatan penyiapan bahan publikasi pasca kegiatan",
  "Kelayakan hasil dokumentasi untuk publikasi pimpinan",
];

function EvaluasiModal({ev, onClose, onSave, currentUser}){
  const NAVY="#0A1628",GOLD="#C9A84C",GREEN="#0D6B4F";
  const isKominfo=currentUser.role==="timkom"||currentUser.role==="kasubbag_komdokpim";
  const pertanyaan=isKominfo?EVAL_KOMDOK:EVAL_PROTOKOL;
  const tipeTugas=isKominfo?"Komdok":"Protokol";

  // Load existing eval jika ada
  const existing=(ev.evaluasi||{})[currentUser.username]||{};
  const[scores,setScores]=React.useState(
    Object.fromEntries(pertanyaan.map((_,i)=>[i, existing["s"+i]!==undefined?existing["s"+i]:60]))
  );
  const[catatan,setCatatan]=React.useState(existing.catatan||"");
  const[submitted,setSubmitted]=React.useState(!!existing.submitted);

  const scoreLabel=(v)=>{
    if(v<=20)return{text:"Sangat Kurang",color:"#dc2626"};
    if(v<=40)return{text:"Kurang",color:"#ea580c"};
    if(v<=60)return{text:"Cukup",color:"#d97706"};
    if(v<=80)return{text:"Baik",color:"#16a34a"};
    return{text:"Sangat Baik",color:"#0d6b4f"};
  };

  const avgScore=Math.round(Object.values(scores).reduce((a,b)=>a+b,0)/pertanyaan.length);
  const avgLabel=scoreLabel(avgScore);

  const handleSave=()=>{
    const entry={...Object.fromEntries(Object.entries(scores).map(([i,v])=>["s"+i,v])),catatan,submitted:true,tipe:tipeTugas,savedAt:new Date().toISOString()};
    onSave(entry);
    setSubmitted(true);
  };

  const inp={width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:14,outline:"none",background:"#f8fafc",resize:"vertical"};

  return(
    <div style={{position:"fixed",inset:0,zIndex:3100,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"white",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:600,maxHeight:"94vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 -8px 40px rgba(0,0,0,0.25)"}}>

        {/* Header */}
        <div style={{background:"linear-gradient(135deg,"+NAVY+",#1B4080)",padding:"18px 20px 14px",flexShrink:0}}>
          <div style={{width:36,height:4,background:"rgba(255,255,255,0.3)",borderRadius:4,margin:"0 auto 14px"}}/>
          <div style={{color:GOLD,fontSize:11,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>Evaluasi Pasca Kegiatan · {tipeTugas}</div>
          <div style={{color:"white",fontSize:16,fontWeight:800,lineHeight:1.3}}>{ev.namaAcara}</div>
          <div style={{color:"rgba(255,255,255,0.6)",fontSize:12,marginTop:3}}>{ev.tanggal} · {ev.jam} WITA</div>
        </div>

        {/* Info header */}
        <div style={{background:"#f8fafc",padding:"10px 16px",borderBottom:"1px solid #e2e8f0",display:"flex",gap:16,flexShrink:0}}>
          <div><div style={{fontSize:10,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Nama</div><div style={{fontSize:13,fontWeight:700,color:NAVY}}>{currentUser.nama}</div></div>
          <div><div style={{fontSize:10,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Jabatan</div><div style={{fontSize:13,fontWeight:700,color:NAVY}}>{currentUser.jabatan}</div></div>
          {avgScore>0&&<div style={{marginLeft:"auto",textAlign:"right"}}>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Rata-rata</div>
            <div style={{fontSize:20,fontWeight:900,color:avgLabel.color}}>{avgScore}<span style={{fontSize:11,fontWeight:500}}>&nbsp;{"/"}100</span></div>
          </div>}
        </div>

        <div style={{overflowY:"auto",flex:1,padding:"16px"}}>
          {submitted&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",gap:8,alignItems:"center",fontSize:13,color:"#166534",fontWeight:600}}>
            <span>✅</span> Evaluasi sudah dikirim. Anda masih bisa mengedit dan mengirim ulang.
          </div>}

          {/* Pertanyaan slider */}
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            {pertanyaan.map((q,i)=>{
              const v=scores[i];
              const lbl=scoreLabel(v);
              return(
                <div key={i} style={{background:"#fafbff",borderRadius:12,padding:"14px",border:"1px solid #e8edf4"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,gap:8}}>
                    <div style={{fontSize:12,color:"#334155",fontWeight:600,lineHeight:1.5,flex:1}}>
                      <span style={{color:GOLD,fontWeight:800,marginRight:6}}>{i+1}.</span>{q}
                    </div>
                    <div style={{textAlign:"center",flexShrink:0,minWidth:64}}>
                      <div style={{fontSize:22,fontWeight:900,color:lbl.color,lineHeight:1}}>{v}</div>
                      <div style={{fontSize:9,color:lbl.color,fontWeight:700}}>{lbl.text}</div>
                    </div>
                  </div>
                  {/* Slider */}
                  <div style={{position:"relative",height:36,display:"flex",alignItems:"center"}}>
                    <style>{`
                      .eval-slider-${i}{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:8px;outline:none;cursor:pointer;}
                      .eval-slider-${i}::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:${lbl.color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:pointer;}
                      .eval-slider-${i}::-moz-range-thumb{width:24px;height:24px;border-radius:50%;background:${lbl.color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:pointer;}
                    `}</style>
                    <input type="range" min={0} max={100} step={20}
                      value={v}
                      onChange={e=>setScores(p=>({...p,[i]:Number(e.target.value)}))}
                      className={"eval-slider-"+i}
                      style={{background:`linear-gradient(to right, ${lbl.color} ${v}%, #e2e8f0 ${v}%)`}}
                    />
                  </div>
                  {/* Tick marks */}
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                    {[0,20,40,60,80,100].map(n=><span key={n} style={{fontSize:9,color:v===n?lbl.color:"#cbd5e1",fontWeight:v===n?800:400,transition:"color 0.2s"}}>{n}</span>)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Catatan */}
          <div style={{marginTop:16,marginBottom:4}}>
            <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:700,marginBottom:6,letterSpacing:0.5}}>CATATAN / SARAN (Opsional)</label>
            <textarea value={catatan} onChange={e=>setCatatan(e.target.value)} rows={3} placeholder="Catatan penting terkait pelaksanaan acara, kendala, atau saran perbaikan..." style={inp}/>
          </div>
        </div>

        {/* Footer */}
        <div style={{padding:"12px 16px",borderTop:"1px solid #e2e8f0",display:"flex",gap:8,flexShrink:0,background:"white"}}>
          <button onClick={onClose} style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600}}>Tutup</button>
          <button onClick={handleSave} style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:"linear-gradient(135deg,"+NAVY+",#1B4080)",color:"white",cursor:"pointer",fontSize:14,fontWeight:800}}>
            {submitted?"✓ Kirim Ulang Evaluasi":"Kirim Evaluasi"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PenugasanModal({ev, onClose, onSave, currentUser, allUsers, allEvents}){
  // Guard: penugasan hanya boleh untuk jadwal yang sudah disetujui
  if(ev && ev.alur !== "disetujui") return(
    <div style={{position:"fixed",inset:0,zIndex:9500,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(10,22,40,0.6)",padding:16}}>
      <div style={{background:"white",borderRadius:18,padding:"28px 24px",maxWidth:340,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:36,marginBottom:12}}>🔒</div>
        <div style={{fontSize:16,fontWeight:800,color:"#0A1628",marginBottom:8}}>Belum Bisa Ditugaskan</div>
        <div style={{fontSize:13,color:"#64748B",marginBottom:20}}>Penugasan personil hanya dapat dilakukan setelah jadwal <strong>disetujui & dipublikasi</strong> oleh Kepala Bagian.</div>
        <button onClick={onClose} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:"#0A1628",color:"white",cursor:"pointer",fontSize:14,fontWeight:700}}>Mengerti</button>
      </div>
    </div>
  );
  const NAVY="#0A1628",GOLD="#C9A84C",GREEN="#0D6B4F";

  // Hanya staf, admin_rk, kasubbag, timkom yang bisa ditugaskan
  const eligibleForAssigner=ASSIGN_ROLES[currentUser.role]||["staf","admin_rk","timkom"];
  // Kasubbag bisa menugaskan diri sendiri juga
  const isKasubbag=["kasubbag_protokol","kasubbag_komdokpim"].includes(currentUser.role);
  const candidates=allUsers.filter(u=>eligibleForAssigner.includes(u.role)||(isKasubbag&&u.username===currentUser.username));

  const[selected,setSelected]=React.useState(ev.personil||[]);
  const[catatan,setCatatan]=React.useState(ev.catatanPenugasan||"");

  // Cek konflik jadwal untuk satu personil (dalam 2 jam)
  function getConflicts(username){
    const evDate=new Date(ev.tanggal+"T"+ev.jam);
    return allEvents.filter(e=>
      e.id!==ev.id &&
      e.alur==="disetujui" &&
      (e.personil||[]).includes(username)
    ).filter(e=>{
      const d=new Date(e.tanggal+"T"+e.jam);
      return Math.abs(d-evDate)<2*60*60*1000; // dalam 2 jam
    });
  }

  // Cek deadline 12 jam
  const evDateTime=new Date(ev.tanggal+"T"+ev.jam);
  const now=new Date();
  const hoursLeft=(evDateTime-now)/(1000*60*60);
  const past12h=hoursLeft<12;

  const toggle=(username)=>{
    setSelected(p=>p.includes(username)?p.filter(x=>x!==username):[...p,username]);
  };

  const inp={width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:14,outline:"none",background:"#f8fafc",resize:"vertical"};

  return(
    <div style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(4px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"white",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:600,maxHeight:"92vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 -8px 40px rgba(0,0,0,0.2)"}}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,"+NAVY+",#1B4080)",padding:"18px 20px 14px",flexShrink:0}}>
          <div style={{width:36,height:4,background:"rgba(255,255,255,0.3)",borderRadius:4,margin:"0 auto 14px"}}/>
          <div style={{color:GOLD,fontSize:11,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>Penugasan Personil</div>
          <div style={{color:"white",fontSize:16,fontWeight:800,lineHeight:1.3}}>{ev.namaAcara}</div>
          <div style={{color:"rgba(255,255,255,0.6)",fontSize:12,marginTop:4}}>{ev.tanggal} · {ev.jam} WITA · {ev.lokasi||"-"}</div>
        </div>

        {/* Warning 12 jam */}
        {past12h&&<div style={{background:"#fff7ed",padding:"9px 16px",borderBottom:"1px solid #fed7aa",display:"flex",gap:8,alignItems:"center",fontSize:12,color:"#9a3412"}}>
          <span>⚠️</span><span><strong>Kurang dari 12 jam</strong> sebelum acara. Penugasan sebaiknya diselesaikan segera.</span>
        </div>}

        <div style={{overflowY:"auto",flex:1,padding:"16px"}}>
          {/* List kandidat */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:"#475569",fontWeight:700,marginBottom:8,letterSpacing:0.5}}>PILIH PERSONIL BERTUGAS</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {candidates.map(u=>{
                const conflicts=getConflicts(u.username);
                const isMe=u.username===currentUser.username;
                const checked=selected.includes(u.username);
                return(
                  <div key={u.username} onClick={()=>toggle(u.username)}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"1.5px solid "+(checked?"#0A1628":"#e2e8f0"),background:checked?"#EEF2FF":"#fafafa",cursor:"pointer",transition:"all 0.15s"}}>
                    <div style={{width:22,height:22,borderRadius:6,border:"2px solid "+(checked?NAVY:"#cbd5e1"),background:checked?NAVY:"white",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                      {checked&&<span style={{color:"white",fontSize:13,lineHeight:1}}>✓</span>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:NAVY,display:"flex",alignItems:"center",gap:6}}>
                        {u.nama}{isMe&&<span style={{fontSize:10,background:"#dbeafe",color:"#1d4ed8",borderRadius:4,padding:"1px 6px",fontWeight:600}}>Saya</span>}
                      </div>
                      <div style={{fontSize:11,color:"#64748b"}}>{u.jabatan}</div>
                    </div>
                    {conflicts.length>0&&<div style={{fontSize:10,background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",borderRadius:6,padding:"2px 8px",fontWeight:700,flexShrink:0}}>
                      ⚡ {conflicts.length} acara berdekatan
                    </div>}
                  </div>
                );
              })}
              {candidates.length===0&&<div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:20}}>Belum ada akun staf terdaftar</div>}
            </div>
          </div>

          {/* Catatan penugasan */}
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:700,marginBottom:6}}>CATATAN UNTUK PERSONIL</label>
            <textarea value={catatan} onChange={e=>setCatatan(e.target.value)} rows={3} placeholder="Catatan khusus, persiapan, atau arahan untuk personil bertugas..." style={inp}/>
          </div>

          {/* Summary terpilih */}
          {selected.length>0&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"10px 12px",marginBottom:16}}>
            <div style={{fontSize:11,color:"#166534",fontWeight:700,marginBottom:6}}>✓ {selected.length} PERSONIL DITUGASKAN</div>
            {selected.map(un=>{
              const u=candidates.find(x=>x.username===un);
              const cf=getConflicts(un);
              return <div key={un} style={{fontSize:12,color:"#15803d",display:"flex",justifyContent:"space-between"}}>
                <span>• {u?.nama||un}</span>
                {cf.length>0&&<span style={{color:"#dc2626",fontWeight:600}}>⚡ berdekatan dengan {cf.length} acara</span>}
              </div>;
            })}
          </div>}
        </div>

        {/* Footer */}
        <div style={{padding:"12px 16px",borderTop:"1px solid #e2e8f0",display:"flex",gap:8,flexShrink:0}}>
          <button onClick={onClose} style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600}}>Batal</button>
          <button onClick={()=>onSave(selected,catatan)} style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:NAVY,color:"white",cursor:"pointer",fontSize:14,fontWeight:800}}>
            Simpan Penugasan ({selected.length})
          </button>
        </div>
      </div>
    </div>
  );
}

function FormView({form,setForm,editId,isMobile,onSubmit,onCancel,onOpenAI,onUndanganUpload,showT,canUploadUndangan=false}){
  const fld=(k,l,type="text",full=false)=>(
    <div key={k} style={{marginBottom:12,gridColumn:full?"1 / -1":"auto"}}>
      <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:600,marginBottom:4}}>{l}</label>
      <input
        type={type}
        value={form[k]||""}
        onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
        style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",
          color:"#1e293b",background:"white",fontSize:14,boxSizing:"border-box"}}
      />
      {k==="tanggal"&&form.tanggal&&
        <div style={{marginTop:4,fontSize:12,color:"#0B2545",fontWeight:700}}>
          {getHari(form.tanggal)}, {fmt(form.tanggal)}
        </div>}
    </div>
  );
  const QUICK_TIMES=["07:00","08:00","09:00","10:00","13:00","14:00","15:00","16:00"];
  const JENIS_COLORS={Sambutan:{bg:"#fdf4ff",a:"#9333ea"},Pengarahan:{bg:"#eff6ff",a:"#2563eb"},Menghadiri:{bg:"#f0fdf4",a:"#16a34a"}};
  const NAVY2="#0B2545",GOLD2="#C9A84C";
  const [wizStep, setWizStep] = React.useState(editId?2:1);
  const step1Valid = form.tanggal && form.jam && form.namaAcara && form.untukPimpinan.length>0;

  const StepDot = ({n, label}) => (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
      <div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
        fontWeight:800,fontSize:13,
        background:wizStep>=n?NAVY2:"#E2E8F0",
        color:wizStep>=n?"white":"#94A3B8",
        boxShadow:wizStep===n?"0 0 0 3px rgba(11,37,69,0.2)":"none",
        transition:"all 0.2s"}}>
        {wizStep>n?"✓":n}
      </div>
      <div style={{fontSize:10,fontWeight:600,color:wizStep>=n?NAVY2:"#94A3B8",whiteSpace:"nowrap"}}>{label}</div>
    </div>
  );

  return(
    <div style={{background:"white",borderRadius:12,padding:isMobile?"14px":"24px",
      boxShadow:"0 2px 12px rgba(0,0,0,0.07)",border:"1.5px solid "+GOLD2}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <h2 style={{margin:0,color:NAVY2,fontSize:isMobile?15:18,fontWeight:800}}>
          {editId?"Edit Jadwal":"Input Jadwal Baru"}
        </h2>
        {!editId&&<button type="button" onClick={onOpenAI}
          style={{padding:"8px 14px",borderRadius:9,border:"none",
            background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"white",
            cursor:"pointer",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:6,
            boxShadow:"0 4px 14px rgba(99,102,241,0.35)"}}>
          <span style={{fontSize:15}}>&#x1F916;</span>{isMobile?"AI":"AI Auto-Isi"}
        </button>}
      </div>

      {/* Wizard steps indicator */}
      {!editId&&<div style={{display:"flex",alignItems:"center",marginBottom:20,gap:0}}>
        <StepDot n={1} label="Pokok"/>
        <div style={{flex:1,height:2,background:wizStep>1?NAVY2:"#E2E8F0",margin:"0 6px",marginBottom:14,transition:"background 0.3s"}}/>
        <StepDot n={2} label="Detail"/>
      </div>}

      {/* ── Langkah 1: Data pokok ── */}
      {(wizStep===1||editId)&&<>
        <div style={{background:"#EFF6FF",borderRadius:10,padding:"10px 14px",marginBottom:16,
          border:"1px solid #BFDBFE",fontSize:12,color:"#1D4ED8",fontWeight:600}}>
          📝 Isi informasi utama — tanggal, jam, nama acara, dan untuk pimpinan yang mana
        </div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 20px"}}>
          {fld("tanggal","Tanggal *","date")}
          <div style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:600,marginBottom:4}}>Jam * <span style={{fontSize:10,fontWeight:400,color:"#94a3b8"}}>(WITA)</span></label>
            <input type="time" value={form.jam||""} onChange={e=>setForm(p=>({...p,jam:e.target.value}))}
              style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",
                color:"#1e293b",background:"white",fontSize:15,fontWeight:700,boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
              {QUICK_TIMES.map(t=>(
                <button key={t} type="button" onClick={()=>setForm(p=>({...p,jam:t}))}
                  style={{padding:"3px 8px",borderRadius:14,
                    border:"1.5px solid "+(form.jam===t?NAVY2:"#e2e8f0"),
                    background:form.jam===t?NAVY2:"white",
                    color:form.jam===t?"white":"#475569",cursor:"pointer",fontSize:10,fontWeight:700}}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {fld("namaAcara","Nama Acara *","text",true)}
        </div>
        {/* Untuk Pimpinan — di step 1 karena wajib */}
        <div style={{marginBottom:16,padding:form.untukPimpinan.length===0?"10px":"0",borderRadius:10,border:form.untukPimpinan.length===0?"2px solid #FCA5A5":"none",background:form.untukPimpinan.length===0?"#FFF5F5":"transparent",transition:"all 0.2s"}}>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,marginBottom:6,color:form.untukPimpinan.length===0?"#DC2626":"#475569"}}>Untuk Pimpinan&nbsp;{form.untukPimpinan.length===0?<span style={{fontSize:10,background:"#FEE2E2",color:"#DC2626",padding:"1px 6px",borderRadius:4,fontWeight:700}}>wajib dipilih</span>:<span style={{fontSize:10,background:"#DCFCE7",color:"#16a34a",padding:"1px 6px",borderRadius:4,fontWeight:700}}>✓</span>}</label>
          <div style={{display:"flex",gap:10}}>
            {[{key:"walikota",label:"🏛 Wali Kota",istriKey:"besertaIstriWK"},{key:"wakilwalikota",label:"🏛 Wakil Wali Kota",istriKey:"besertaIstriWWK"}].map(p=>{
              const aktif=form.untukPimpinan.includes(p.key);
              return <div key={p.key} style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
                <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                  padding:"12px 8px",borderRadius:10,cursor:"pointer",
                  border:aktif?"2px solid "+NAVY2:"2px solid #e2e8f0",
                  background:aktif?"#EBF0FA":"white",
                  fontSize:12,fontWeight:700,color:aktif?NAVY2:"#94a3b8"}}>
                  <input type="checkbox" checked={aktif} style={{display:"none"}}
                    onChange={e=>{const v=e.target.checked?[...form.untukPimpinan,p.key]:form.untukPimpinan.filter(x=>x!==p.key);
                      setForm(prev=>({...prev,untukPimpinan:v,...(!e.target.checked?{[p.istriKey]:false}:{})}));}}/>
                  {aktif?"✓ ":"○ "}{p.label}
                </label>
                {aktif&&<label style={{display:"flex",alignItems:"center",gap:7,padding:"7px 10px",borderRadius:8,cursor:"pointer",
                  border:form[p.istriKey]?"1.5px solid #db2777":"1.5px solid #fce7f3",
                  background:form[p.istriKey]?"#fdf2f8":"#fff9fc",fontSize:11,fontWeight:600,
                  color:form[p.istriKey]?"#be185d":"#f9a8d4"}}>
                  <input type="checkbox" checked={!!form[p.istriKey]} style={{display:"none"}}
                    onChange={e=>setForm(prev=>({...prev,[p.istriKey]:e.target.checked}))}/>
                  <span style={{fontSize:15}}>{form[p.istriKey]?"💑":"👤"}</span>
                  {form[p.istriKey]?"✓ Beserta Istri":"+ Beserta Istri"}
                </label>}
              </div>;
            })}
          </div>
        </div>
        {!editId&&<button type="button" onClick={()=>{if(!step1Valid){globalToast("Lengkapi dulu: Tanggal, Jam, Nama Acara, dan pilih Pimpinan","warn");return;}setWizStep(2);}}
          style={{width:"100%",padding:"14px",borderRadius:12,border:"none",
            background:step1Valid?"linear-gradient(135deg,"+NAVY2+",#1E3254)":"#E2E8F0",
            color:step1Valid?"white":"#94A3B8",cursor:step1Valid?"pointer":"default",
            fontSize:14,fontWeight:800,marginBottom:8,transition:"all 0.2s"}}>
          Lanjut ke Detail →
        </button>}
        {!editId&&<button type="button" onClick={()=>{if(!step1Valid){globalToast("Lengkapi dulu field wajib sebelum menyimpan","warn");return;}onSubmit();}}
          style={{width:"100%",padding:"11px",borderRadius:12,border:"1.5px dashed #CBD5E1",
            background:"white",color:"#64748B",cursor:"pointer",fontSize:13,fontWeight:600}}>
          Simpan Draft Cepat (tanpa detail)
        </button>}
      </>}

      {/* ── Langkah 2: Detail opsional ── */}
      {wizStep===2&&!editId&&<>
        <button onClick={()=>setWizStep(1)} style={{display:"flex",alignItems:"center",gap:6,
          background:"none",border:"none",color:"#64748B",cursor:"pointer",fontSize:12,fontWeight:600,marginBottom:14,padding:0}}>
          ← Kembali ke Data Pokok
        </button>
        <div style={{background:"#F0FDF4",borderRadius:10,padding:"10px 14px",marginBottom:16,
          border:"1px solid #BBFAFE",fontSize:12,color:"#065F46",fontWeight:600}}>
          ✅ Data pokok sudah tersimpan. Tambahkan detail berikut (opsional)
        </div>
        {fld("penyelenggara","Penyelenggara")}
        {fld("kontak","Kontak / Narahubung")}
        {fld("buktiUndangan","No. Surat / Bukti Undangan")}
        {/* Jenis Kegiatan */}
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:600,marginBottom:4}}>Jenis Kegiatan</label>
          <div style={{display:"flex",gap:6}}>
            {["Sambutan","Pengarahan","Menghadiri"].map(j=>(
              <button key={j} type="button" onClick={()=>setForm(p=>({...p,jenisKegiatan:j}))}
                style={{flex:1,padding:"9px 4px",borderRadius:8,
                  border:"1.5px solid "+(form.jenisKegiatan===j?JENIS_COLORS[j].a:"#e2e8f0"),
                  background:form.jenisKegiatan===j?JENIS_COLORS[j].bg:"white",
                  color:form.jenisKegiatan===j?JENIS_COLORS[j].a:"#64748b",
                  cursor:"pointer",fontSize:12,fontWeight:700}}>
                {j}
              </button>
            ))}
          </div>
        </div>
        {/* Pakaian */}
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:600,marginBottom:4}}>Pakaian</label>
          <select value={form.pakaian||"PDH"} onChange={e=>setForm(p=>({...p,pakaian:e.target.value}))}
            style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",
              background:"white",color:"#1e293b",fontSize:14,WebkitAppearance:"none",boxSizing:"border-box"}}>
            {PAKAIAN.map(x=><option key={x}>{x}</option>)}
          </select>
          {(form.pakaian==="Lainnya")&&<input type="text" placeholder="Tulis nama pakaian..." value={form.pakaianLainnya||""} onChange={e=>setForm(p=>({...p,pakaianLainnya:e.target.value}))} style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:13,marginTop:6}}/>}
        </div>
        {/* Lokasi */}
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:600,marginBottom:4}}>Lokasi Acara</label>
          <div style={{display:"flex",gap:8}}>
            <input type="text" value={form.lokasi||""} onChange={e=>setForm(p=>({...p,lokasi:e.target.value}))}
              placeholder="Nama tempat / alamat"
              style={{flex:1,padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",
                color:"#1e293b",background:"white",fontSize:14,boxSizing:"border-box"}}/>
            {form.lokasi&&<a href={"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(form.lokasi)}
              target="_blank" rel="noopener noreferrer"
              style={{padding:"10px 14px",borderRadius:9,background:"#1a73e8",color:"white",
                textDecoration:"none",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",flexShrink:0}}>Maps</a>}
          </div>
        </div>
        {/* Catatan */}
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:600,marginBottom:4}}>Catatan Penting</label>
          <textarea value={form.catatan||""} onChange={e=>setForm(p=>({...p,catatan:e.target.value}))} rows={2}
            style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",
              color:"#1e293b",resize:"vertical",background:"white",fontSize:14,boxSizing:"border-box"}}/>
        </div>
        {/* Upload Undangan - hanya admin_rk */}
        {canUploadUndangan&&<div style={{marginBottom:16}}>
          <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:600,marginBottom:6}}>
            Berkas Undangan <span style={{color:"#94a3b8",fontWeight:400}}>(Opsional)</span>
          </label>
          {form.undanganFile
            ?<div style={{background:"#f0fdf4",borderRadius:10,padding:11,border:"1.5px solid #86efac"}}>
              {form._undanganFromAI&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,padding:"5px 8px",background:"linear-gradient(90deg,#ede9fe,#ddd6fe)",borderRadius:7,fontSize:11,fontWeight:700,color:"#5b21b6"}}>
                <span>🤖</span> Berkas ini otomatis tersimpan dari AI Auto-Isi
              </div>}
              <div style={{display:"flex",alignItems:"center",gap:8,background:"white",borderRadius:8,padding:"8px 10px",border:"1px solid #bbf7d0",marginBottom:7}}>
                <span style={{fontSize:18,flexShrink:0}}>{form.undanganNama?.match(/\.(jpg|jpeg|png|webp)$/i)?"🖼️":"📄"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#15803d",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{form.undanganNama||"Berkas Undangan"}</div>
                  <div style={{fontSize:10,color:"#64748b",marginTop:1}}>✓ Siap diunggah bersama jadwal</div>
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <FormUndanganUpload label="🔄 Ganti File" compact onFile={(file,name,b64)=>{setForm(p=>({...p,undanganFile:b64,undanganNama:name,_undanganFromAI:false}));}}/>
                <button type="button" onClick={()=>setForm(p=>({...p,undanganFile:null,undanganNama:"",_undanganFromAI:false}))}
                  style={{flex:1,padding:"7px",borderRadius:8,border:"1.5px solid #fca5a5",background:"white",color:"#ef4444",cursor:"pointer",fontSize:12,fontWeight:700}}>
                  Hapus Berkas
                </button>
              </div>
            </div>
            :<FormUndanganUpload onFile={(file,name,b64)=>{setForm(p=>({...p,undanganFile:b64,undanganNama:name,_undanganFromAI:false}));}}/>
          }
        </div>}
        <div style={{display:"flex",gap:10}}>
          <button type="button" onClick={onCancel}
            style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",
              background:"white",cursor:"pointer",fontSize:13,fontWeight:600,color:"#64748b"}}>
            Batal
          </button>
          <button type="button" onClick={onSubmit}
            style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:NAVY2,
              color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>
            {editId?"Simpan Perubahan":"Simpan sebagai Draft"}
          </button>
        </div>
      </>}

      {/* Edit mode: tampilkan semua sekaligus + tombol simpan */}
      {editId&&<>
        {fld("penyelenggara","Penyelenggara")}
        {fld("kontak","Kontak")}
        {fld("buktiUndangan","No. Surat")}
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:600,marginBottom:4}}>Jenis Kegiatan</label>
          <div style={{display:"flex",gap:6}}>
            {["Sambutan","Pengarahan","Menghadiri"].map(j=>(
              <button key={j} type="button" onClick={()=>setForm(p=>({...p,jenisKegiatan:j}))}
                style={{flex:1,padding:"9px 4px",borderRadius:8,
                  border:"1.5px solid "+(form.jenisKegiatan===j?JENIS_COLORS[j].a:"#e2e8f0"),
                  background:form.jenisKegiatan===j?JENIS_COLORS[j].bg:"white",
                  color:form.jenisKegiatan===j?JENIS_COLORS[j].a:"#64748b",cursor:"pointer",fontSize:12,fontWeight:700}}>
                {j}
              </button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:600,marginBottom:4}}>Pakaian</label>
          <select value={form.pakaian||"PDH"} onChange={e=>setForm(p=>({...p,pakaian:e.target.value}))}
            style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",
              background:"white",color:"#1e293b",fontSize:14,WebkitAppearance:"none",boxSizing:"border-box"}}>
            {PAKAIAN.map(x=><option key={x}>{x}</option>)}
          </select>
          {(form.pakaian==="Lainnya")&&<input type="text" placeholder="Tulis nama pakaian..." value={form.pakaianLainnya||""} onChange={e=>setForm(p=>({...p,pakaianLainnya:e.target.value}))} style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:13,marginTop:6}}/>}
        </div>
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:600,marginBottom:4}}>Lokasi</label>
          <div style={{display:"flex",gap:8}}>
            <input type="text" value={form.lokasi||""} onChange={e=>setForm(p=>({...p,lokasi:e.target.value}))}
              style={{flex:1,padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",color:"#1e293b",background:"white",fontSize:14,boxSizing:"border-box"}}/>
            {form.lokasi&&<a href={"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(form.lokasi)} target="_blank" rel="noopener noreferrer"
              style={{padding:"10px 14px",borderRadius:9,background:"#1a73e8",color:"white",textDecoration:"none",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",flexShrink:0}}>Maps</a>}
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:600,marginBottom:4}}>Catatan</label>
          <textarea value={form.catatan||""} onChange={e=>setForm(p=>({...p,catatan:e.target.value}))} rows={2}
            style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",color:"#1e293b",resize:"vertical",background:"white",fontSize:14,boxSizing:"border-box"}}/>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button type="button" onClick={onCancel}
            style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",cursor:"pointer",fontSize:13,fontWeight:600,color:"#64748b"}}>
            Batal
          </button>
          <button type="button" onClick={onSubmit}
            style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:NAVY2,color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>
            Simpan Perubahan
          </button>
        </div>
      </>}
    </div>
  );
}

// ==================== MAIN APP ====================
// ── API Secret Header Helper ──
const API_SECRET = import.meta.env.VITE_API_SECRET || "";
const apiHeaders = () => ({
  "Content-Type": "application/json",
  ...(API_SECRET ? {"X-API-Secret": API_SECRET} : {})
});

// ==================== LUPA PASSWORD MODAL ====================
function ForgotPasswordModal({onClose}){
  const[step,setStep]=useState("username"); // username → otp → success
  const[un,setUn]=useState("");
  const[otp,setOtp]=useState("");
  const[pw1,setPw1]=useState("");
  const[pw2,setPw2]=useState("");
  const[masked,setMasked]=useState("");
  const[nama,setNama]=useState("");
  const[loading,setLoading]=useState(false);
  const[err,setErr]=useState("");
  const[captchaOK,setCaptchaOK]=useState(false);
  const inp={width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:14,background:"#f8fafc",color:"#1e293b",boxSizing:"border-box",outline:"none"};

  const[channel,setChannel]=useState("wa");
  const[screenCode,setScreenCode]=useState("");

  const requestOTP=async()=>{
    setErr("");
    if(!captchaOK)return setErr("Selesaikan verifikasi anti-bot terlebih dahulu.");
    if(!un.trim())return setErr("Masukkan username terlebih dahulu.");
    setLoading(true);
    try{
      const r=await fetch("/api/otp",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"request",username:un.toLowerCase().trim()})});
      const d=await r.json();
      if(!r.ok){setErr(d.error||"Gagal mengirim OTP.");setLoading(false);return;}
      setNama(d.nama);setChannel(d.channel);
      if(d.channel==="screen"){setScreenCode(d.code);setOtp(d.code);}
      else{setMasked(d.masked);}
      setStep("otp");
    }catch{setErr("Koneksi gagal.");}
    setLoading(false);
  };

  const verifyOTP=async()=>{
    setErr("");
    if(!otp.trim())return setErr("Masukkan kode OTP.");
    if(!pw1)return setErr("Masukkan password baru.");
    if(pw1.length<6)return setErr("Password minimal 6 karakter.");
    if(pw1!==pw2)return setErr("Konfirmasi password tidak cocok.");
    setLoading(true);
    try{
      const r=await fetch("/api/otp",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"verify",username:un.toLowerCase().trim(),otp,newPassword:pw1})});
      const d=await r.json();
      if(!r.ok)return setErr(d.error||"Verifikasi gagal.");
      setStep("success");
    }catch{setErr("Koneksi gagal.");}
    setLoading(false);
  };

  return <div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{background:"white",borderRadius:20,width:"100%",maxWidth:400,overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,0.35)"}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#0A1628,#1B4080)",padding:"20px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{color:"white",fontWeight:800,fontSize:16}}>🔑 Lupa Password</div>
          <div style={{color:"rgba(255,255,255,0.6)",fontSize:12,marginTop:2}}>
            {step==="username"?"Masukkan username akun Anda":step==="otp"?"Masukkan kode OTP & password baru":"Password berhasil direset"}
          </div>
        </div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:"white",fontSize:13,fontWeight:700}}>✕</button>
      </div>

      <div style={{padding:"24px"}}>
        {err&&<div style={{background:"#fee2e2",borderRadius:9,padding:"10px 13px",marginBottom:14,fontSize:13,color:"#991b1b",fontWeight:600}}>{err}</div>}

        {/* Step 1: Username */}
        {step==="username"&&<>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:700,marginBottom:5}}>USERNAME</label>
            <input value={un} onChange={e=>setUn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&requestOTP()} placeholder="Masukkan username" autoCapitalize="none" style={inp}/>
          </div>
          <div style={{background:"#f0f9ff",borderRadius:9,padding:"10px 13px",marginBottom:16,fontSize:12,color:"#0284c7",border:"1px solid #bae6fd"}}>
            📱 Kode reset akan dikirim ke nomor WhatsApp yang terdaftar pada akun Anda.
          </div>
          <CaptchaBox onValid={ok=>setCaptchaOK(ok)}/>
          <button onClick={requestOTP} disabled={loading} style={{width:"100%",padding:"13px",borderRadius:11,border:"none",background:loading?"#e2e8f0":"linear-gradient(135deg,#0A1628,#1B4080)",color:loading?"#94a3b8":"white",cursor:loading?"default":"pointer",fontSize:14,fontWeight:700}}>
            {loading?"Mengirim...":"Kirim Kode OTP via WhatsApp"}
          </button>
        </>}

        {/* Step 2: OTP + password baru */}
        {step==="otp"&&<>
          {channel==="wa"
            ?<div style={{background:"#f0fdf4",borderRadius:9,padding:"10px 13px",marginBottom:16,fontSize:12,color:"#166534",border:"1px solid #bbf7d0"}}>
              ✅ Kode OTP dikirim ke WA <strong>{masked}</strong> atas nama <strong>{nama}</strong>. Berlaku 10 menit.
            </div>
            :<div style={{background:"#fef3c7",borderRadius:9,padding:"14px",marginBottom:16,border:"1px solid #fde68a",textAlign:"center"}}>
              <div style={{fontSize:11,color:"#92400e",fontWeight:700,marginBottom:6}}>⚠️ WhatsApp belum aktif — Kode OTP Anda:</div>
              <div style={{fontSize:36,fontWeight:900,color:"#0A1628",letterSpacing:8,fontFamily:"monospace"}}>{screenCode}</div>
              <div style={{fontSize:11,color:"#92400e",marginTop:6}}>Berlaku 10 menit. Salin kode ini dan masukkan di bawah.</div>
            </div>
          }
          <div style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:700,marginBottom:5}}>KODE OTP (6 digit)</label>
            <input value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="123456" inputMode="numeric" style={{...inp,letterSpacing:8,fontSize:20,textAlign:"center",fontWeight:800}}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:700,marginBottom:5}}>PASSWORD BARU</label>
            <input type="password" value={pw1} onChange={e=>setPw1(e.target.value)} placeholder="Min. 6 karakter" style={inp}/>
          </div>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:12,color:"#475569",fontWeight:700,marginBottom:5}}>KONFIRMASI PASSWORD</label>
            <input type="password" value={pw2} onChange={e=>setPw2(e.target.value)} onKeyDown={e=>e.key==="Enter"&&verifyOTP()} placeholder="Ulangi password baru" style={inp}/>
          </div>
          <button onClick={verifyOTP} disabled={loading} style={{width:"100%",padding:"13px",borderRadius:11,border:"none",background:loading?"#e2e8f0":"#0D6B4F",color:loading?"#94a3b8":"white",cursor:loading?"default":"pointer",fontSize:14,fontWeight:700,marginBottom:8}}>
            {loading?"Memverifikasi...":"Reset Password"}
          </button>
          <button onClick={()=>{setStep("username");setOtp("");setPw1("");setPw2("");setErr("");}} style={{width:"100%",padding:"10px",borderRadius:11,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600}}>
            ← Ganti Username
          </button>
        </>}

        {/* Step 3: Sukses */}
        {step==="success"&&<div style={{textAlign:"center",padding:"16px 0"}}>
          <div style={{fontSize:56,marginBottom:12}}>✅</div>
          <div style={{fontSize:17,fontWeight:800,color:"#0D6B4F",marginBottom:6}}>Password Berhasil Direset!</div>
          <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Silakan login dengan password baru Anda.</div>
          <button onClick={onClose} style={{width:"100%",padding:"13px",borderRadius:11,border:"none",background:"linear-gradient(135deg,#0A1628,#1B4080)",color:"white",cursor:"pointer",fontSize:14,fontWeight:700}}>
            Kembali ke Login
          </button>
        </div>}
      </div>
    </div>
  </div>;
}

// ── WhatsApp Notifikasi Helper ──
// ── Helper: username → nama display ──
function getNamaByUsername(username){
  if(!username)return "-";
  try{
    const u=loadUsers().find(u=>u.username===username);
    return u?.nama||username;
  }catch{return username;}
}

async function sendWA(params){
  if(!params.to){console.warn("sendWA: skip - nomor WA kosong untuk",params.event||"");return;}
  // Normalisasi nomor: 08xxx → 628xxx
  const nomor=params.to.trim().replace(/^0/,"62").replace(/\D/g,"");
  if(nomor.length<10){console.warn("sendWA: nomor tidak valid",params.to);return;}
  try{
    const r=await fetch("/api/whatsapp",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({...params,to:nomor})
    });
    if(!r.ok){const t=await r.text().catch(()=>"");console.warn("WA gagal",r.status,t);}
    else{console.info("WA terkirim →",params.to,"event:",params.event||"-");}
  }catch(e){console.warn("WA notif error:",e);}
}

// ── PWA Push Notifikasi Helper ──
async function sendPush({targetRole,title,body,url,tag}){
  try{
    await fetch("/api/webpush",{
      method:"POST",
      headers:apiHeaders(),
      body:JSON.stringify({action:"send",notify:{title,body,url:url||"/",targetRole,tag}})
    });
  }catch(e){console.warn("Push notif failed:",e);}
}

// ── Daftarkan service worker + subscribe push ──
async function registerPush(username,role){
  if(!("serviceWorker" in navigator)||!("PushManager" in navigator))return;
  try{
    const reg=await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    // Ambil VAPID public key dari server
    const r=await fetch("/api/webpush",{headers:apiHeaders()});
    if(!r.ok)return;
    const{publicKey}=await r.json();
    // Cek apakah sudah subscribe
    let sub=await reg.pushManager.getSubscription();
    if(!sub){
      // Minta izin notifikasi
      const perm=await Notification.requestPermission();
      if(perm!=="granted")return;
      // Subscribe
      sub=await reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:urlBase64ToUint8Array(publicKey)
      });
    }
    // Simpan subscription ke server
    await fetch("/api/webpush",{
      method:"POST",
      headers:apiHeaders(),
      body:JSON.stringify({action:"subscribe",subscription:sub,username,role})
    });
  }catch(e){console.warn("Push register failed:",e);}
}

function urlBase64ToUint8Array(base64String){
  const padding="=".repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
  const rawData=window.atob(base64);
  return Uint8Array.from([...rawData].map(c=>c.charCodeAt(0)));
}

// ── PersonilBanner component ──
function PersonilBanner({ev,role,user,setPenugasanEv,setEvaluasiEv}){
  const all=loadUsers();
  const pLabels=(ev.personil||[]).map(un=>{const nm=all.find(u=>u.username===un)?.nama||un;return{nm,isMe:un===user.username};});
  const isAssigned=(ev.personil||[]).includes(user.username);
  const evTime=new Date(ev.tanggal+"T"+ev.jam);
  const hoursLeft=(evTime-new Date())/(1000*60*60);
  const urgent=hoursLeft>0&&hoursLeft<=12&&(!ev.personil||ev.personil.length===0);
  const showNames=pLabels.length>0;
  const sudahEval=!!(ev.evaluasi||{})[user.username]?.submitted;
  const sudahLewat=new Date()>evTime;
  return <div style={{background:isAssigned?"#F0FDF4":urgent?"#FFF7ED":showNames?"#F0F9FF":"#F8FAFC",padding:showNames?"6px 14px":"5px 14px",borderBottom:"1px solid "+(isAssigned?"#BBF7D0":urgent?"#FED7AA":showNames?"#BAE6FD":"#E2E8F0"),display:"flex",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
    <span style={{fontSize:12,flexShrink:0,marginTop:1}}>{urgent?"⚠️":showNames?"👥":"○"}</span>
    <div style={{flex:1,display:"flex",flexWrap:"wrap",gap:4,alignItems:"center",minWidth:0}}>
      {showNames
        ?pLabels.map((p,i)=>(
            <span key={i} style={{display:"inline-flex",alignItems:"center",gap:3,background:p.isMe?"#D1FAE5":"#E0F2FE",color:p.isMe?"#065F46":"#0369A1",borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>
              {p.isMe&&<span style={{fontSize:9}}>🎯</span>}{p.nm}{p.isMe?" (Anda)":""}
            </span>))
        :<span style={{fontSize:11,fontWeight:700,color:urgent?"#9A3412":"#94A3B8"}}>{urgent?"Belum ada personil!":"Belum ada penugasan"}</span>
      }
    </div>
    {["kasubbag_protokol","kasubbag_komdokpim"].includes(role)&&<button onClick={e=>{e.stopPropagation();setPenugasanEv(ev);}} style={{flexShrink:0,padding:"2px 8px",borderRadius:5,border:"1px solid #CBD5E1",background:"white",color:"#334155",cursor:"pointer",fontSize:10,fontWeight:700}}>{(!ev.personil||ev.personil.length===0)?"+ Tugaskan":"Edit"}</button>}
    {isAssigned&&sudahLewat&&<button onClick={e=>{e.stopPropagation();setEvaluasiEv(ev);}} style={{flexShrink:0,padding:"2px 8px",borderRadius:5,border:"1px solid "+(sudahEval?"#16A34A":"#7C3AED"),background:"white",color:sudahEval?"#16A34A":"#7C3AED",cursor:"pointer",fontSize:10,fontWeight:700}}>{sudahEval?"✅ Evaluasi":"📝 Evaluasi"}</button>}
  </div>;
}

// ── WKKehadiran component (Wali Kota & Ajudan WK) ──
// ── Helper: cek apakah konfirmasi kehadiran sudah terkunci (> 3 jam setelah jadwal) ──
function isKehadiranLocked(ev){
  try{
    const evDt=new Date(ev.tanggal+"T"+(ev.jam||"00:00"));
    return (Date.now()-evDt.getTime())>(3*60*60*1000);
  }catch{return false;}
}
function KehadiranLockedBanner(){
  return <div style={{background:"#F1F5F9",border:"1.5px solid #CBD5E1",borderRadius:9,padding:"9px 12px",display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#64748B",fontWeight:600}}>
    <span style={{fontSize:16}}>🔒</span>
    <span>Konfirmasi kehadiran sudah terkunci — lebih dari 3 jam setelah jadwal berlangsung.</span>
  </div>;
}

// ── Komponen catatan terkontrol — moved before first usage ──────────
function CatatanInput({evId, initial, onSave, btnColor, placeholder, label}){
  const NAVY="#0A1628";
  const [val, setVal] = React.useState(initial||"");
  const [saved, setSaved] = React.useState(false);
  React.useEffect(()=>{ setVal(initial||""); },[evId, initial]);
  const handleSave = ()=>{
    onSave(val);
    setSaved(true);
    setTimeout(()=>setSaved(false), 2000);
  };
  return (
    <div>
      {label&&<label style={{display:"block",fontSize:12,color:"#64748B",fontWeight:600,marginBottom:4}}>{label}</label>}
      <textarea
        value={val}
        onChange={e=>{ setVal(e.target.value); setSaved(false); }}
        rows={3}
        placeholder={placeholder||"Ketik catatan..."}
        style={{width:"100%",padding:"10px 12px",borderRadius:10,
          border:"1.5px solid "+(saved?"#6EE7B7":"#E2E8F0"),
          fontSize:13,color:"#0F172A",resize:"vertical",
          background:saved?"#F0FDF4":"white",
          boxSizing:"border-box",transition:"border-color 0.2s,background 0.2s",
          outline:"none"}}
        onKeyDown={e=>{ if((e.ctrlKey||e.metaKey)&&e.key==="Enter") handleSave(); }}
      />
      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
        <button
          onClick={e=>{e.stopPropagation();handleSave();}}
          style={{padding:"9px 20px",borderRadius:9,border:"none",
            background:saved?"#059669":(btnColor||NAVY),
            color:"white",cursor:"pointer",fontSize:12,fontWeight:700,
            transition:"background 0.2s",flexShrink:0}}>
          {saved?"✓ Tersimpan":"Simpan Catatan"}
        </button>
        <span style={{fontSize:10,color:"#94A3B8"}}>Ctrl+Enter untuk simpan cepat</span>
      </div>
    </div>
  );
}


function WKKehadiran({ev,upd,showT,setDelegTarget,role}){
  const isAjudan=role==="ajudan_walikota";
  const locked=isKehadiranLocked(ev);
  if(locked)return <div><KehadiranLockedBanner/></div>;
  return <div>
    {isAjudan&&<div style={{background:"#FFF8E1",border:"1.5px solid #FBC02D",borderRadius:9,padding:"8px 12px",marginBottom:12,display:"flex",gap:8,alignItems:"flex-start"}}>
      <span style={{fontSize:16,flexShrink:0}}>⚠️</span>
      <div style={{fontSize:11,color:"#7C4D00",lineHeight:1.5}}><strong>Perhatian Ajudan:</strong> Pastikan Anda telah mengkonfirmasi langsung ke Bapak/Ibu Wali Kota sebelum mengisi disposisi ini. Semua input yang Anda buat akan tercatat sebagai <em>"diisi oleh Ajudan"</em>.</div>
    </div>}
    {ev.statusWK&&ev.statusWK_by==="ajudan"&&!isAjudan&&<div style={{background:"#FFF3E0",border:"1px solid #FFB74D",borderRadius:7,padding:"6px 10px",marginBottom:8,fontSize:11,color:"#E65100"}}>ℹ️ Status kehadiran ini diisi oleh Ajudan — harap konfirmasi langsung ke Bapak Wali Kota.</div>}
    <div style={{fontSize:12,fontWeight:700,color:NAVY,marginBottom:7}}>{isAjudan?"Input Kehadiran Wali Kota":"Konfirmasi Kehadiran"}</div>
    <div style={{display:"flex",gap:8,marginBottom:10}}>{[{s:"hadir",l:"✓ Hadir",c:GREEN},{s:"tidak_hadir",l:"✗ Tidak Hadir",c:"#991b1b"}].map(({s,l,c})=><button key={s} onClick={()=>{upd(ev.id,{statusWK:s,delegasiKeWWK:false,perwakilanWK:"",statusWK_by:isAjudan?"ajudan":"walikota"});showT(isAjudan?"Kehadiran Wali Kota berhasil diinput":"Status diperbarui");}} style={{flex:1,padding:"12px",borderRadius:10,cursor:"pointer",fontWeight:800,fontSize:13,border:"1.5px solid "+c,background:ev.statusWK===s?c:"white",color:ev.statusWK===s?"white":c}}>{l}</button>)}</div>
    <div style={{background:"#f0fdf4",borderRadius:11,padding:12,border:"1.5px solid #bbf7d0",marginBottom:10}}>
      <div style={{fontSize:12,fontWeight:700,color:GREEN,marginBottom:7}}>Disposisi</div>
      <button onClick={()=>{upd(ev.id,{statusWK:"diwakilkan",delegasiKeWWK:true,perwakilanWK:"",statusWK_by:isAjudan?"ajudan":"walikota"});showT(isAjudan?"Delegasi ke WWK diinput oleh Ajudan":"Didelegasi ke Wakil Wali Kota");}} style={{width:"100%",padding:"10px",borderRadius:9,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,marginBottom:6,background:ev.delegasiKeWWK?GREEN:"#d1fae5",color:ev.delegasiKeWWK?"white":GREEN}}>{ev.delegasiKeWWK?"✓ Didelegasi ke Wakil Wali Kota":"Delegasi ke Wakil Wali Kota"}</button>
      {ev.delegasiKeWWK&&<button onClick={()=>{upd(ev.id,{statusWK:null,delegasiKeWWK:false,perwakilanWK:""});showT("Delegasi dibatalkan","warn");}} style={{width:"100%",padding:"8px",borderRadius:9,border:"1.5px solid #fca5a5",background:"white",color:"#e11d48",cursor:"pointer",fontSize:12,fontWeight:700,marginBottom:6}}>Batalkan Delegasi ke WWK</button>}
      <button onClick={()=>setDelegTarget({id:ev.id,side:"wk"})} style={{width:"100%",padding:"9px",borderRadius:9,border:"1.5px solid #94a3b8",background:"white",color:"#334155",cursor:"pointer",fontSize:12}}>Wakilkan ke Pejabat Lain</button>
      {ev.statusWK==="diwakilkan"&&ev.perwakilanWK&&<><div style={{marginTop:6,padding:"5px 10px",background:"#fef3c7",borderRadius:7,fontSize:12,color:"#92400e",fontWeight:600}}>Diwakilkan ke: {ev.perwakilanWK}</div><button onClick={()=>{upd(ev.id,{statusWK:null,perwakilanWK:"",delegasiKeWWK:false});showT("Disposisi dibatalkan","warn");}} style={{marginTop:5,width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #fca5a5",background:"white",color:"#e11d48",cursor:"pointer",fontSize:11,fontWeight:700}}>Batalkan Disposisi</button></>}
    </div>
    {!isAjudan&&<div><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:4}}>Catatan untuk Tim</label>
      <CatatanInput evId={ev.id} initial={ev.catatanPimpinan} onSave={v=>{upd(ev.id,{catatanPimpinan:v});showT("Catatan disimpan");}} btnColor={NAVY} placeholder="Arahan atau permintaan khusus..."/>
    </div>}
  </div>;
}

// ── WWKKehadiran component (Wakil Wali Kota & Ajudan WWK) ──
function WWKKehadiran({ev,upd,showT,setDelegTarget,role}){
  const isAjudan=role==="ajudan_wakilwalikota";
  const locked=isKehadiranLocked(ev);
  if(locked)return <div style={{marginTop:isAjudan?12:0}}><KehadiranLockedBanner/></div>;
  return <div style={{marginTop:isAjudan?12:0}}>
    {isAjudan&&<div style={{background:"#FFF8E1",border:"1.5px solid #FBC02D",borderRadius:9,padding:"8px 12px",marginBottom:12,display:"flex",gap:8,alignItems:"flex-start"}}>
      <span style={{fontSize:16,flexShrink:0}}>⚠️</span>
      <div style={{fontSize:11,color:"#7C4D00",lineHeight:1.5}}><strong>Perhatian Ajudan:</strong> Pastikan Anda telah mengkonfirmasi ke Bapak/Ibu Wakil Wali Kota. Input ini akan tercatat <em>"diisi oleh Ajudan"</em>.</div>
    </div>}
    {ev.statusWWK&&ev.statusWWK_by==="ajudan"&&!isAjudan&&<div style={{background:"#FFF3E0",border:"1px solid #FFB74D",borderRadius:7,padding:"6px 10px",marginBottom:8,fontSize:11,color:"#E65100"}}>ℹ️ Status kehadiran ini diisi oleh Ajudan — harap konfirmasi ke Ibu/Bapak Wakil Wali Kota.</div>}
    <div style={{fontSize:12,fontWeight:700,color:GREEN,marginBottom:7}}>{isAjudan?"Input Kehadiran Wakil Wali Kota":"Konfirmasi Kehadiran"}</div>
    {ev.delegasiKeWWK&&role==="wakilwalikota"&&<button onClick={()=>{upd(ev.id,{statusWK:null,delegasiKeWWK:false,perwakilanWK:"",statusWWK:"",statusWWK_by:""});showT("Disposisi dari WK dibatalkan","warn");}} style={{width:"100%",padding:"8px",borderRadius:9,border:"1.5px dashed #fca5a5",background:"white",color:"#dc2626",cursor:"pointer",fontSize:12,fontWeight:700,marginBottom:8}}>↩ Batalkan Disposisi dari Wali Kota</button>}
    <div style={{display:"flex",gap:8,marginBottom:10}}>{[{s:"hadir",l:"✓ Hadir",c:GREEN},{s:"tidak_hadir",l:"✗ Tidak Hadir",c:"#991b1b"}].map(({s,l,c})=><button key={s} onClick={()=>{upd(ev.id,{statusWWK:s,statusWWK_by:isAjudan?"ajudan":"wakilwalikota"});showT(isAjudan?"Kehadiran Wakil Wali Kota diinput":"Status diperbarui");}} style={{flex:1,padding:"12px",borderRadius:10,cursor:"pointer",fontWeight:800,fontSize:13,border:"1.5px solid "+c,background:ev.statusWWK===s?c:"white",color:ev.statusWWK===s?"white":c}}>{l}</button>)}</div>
    <div style={{background:"#f8fafc",borderRadius:10,padding:11,border:"1.5px solid #e2e8f0",marginBottom:10}}>
      <div style={{fontSize:12,color:"#64748b",fontWeight:700,marginBottom:6}}>Wakilkan ke Pejabat Lain</div>
      <button onClick={()=>setDelegTarget({id:ev.id,side:"wwk"})} style={{width:"100%",padding:"10px",borderRadius:9,cursor:"pointer",fontSize:12,fontWeight:ev.statusWWK==="diwakilkan"?700:500,border:"1.5px solid "+(ev.statusWWK==="diwakilkan"?NAVY:"#94a3b8"),background:ev.statusWWK==="diwakilkan"?"#EBF0FA":"white",color:ev.statusWWK==="diwakilkan"?NAVY:"#334155"}}>{ev.statusWWK==="diwakilkan"&&ev.perwakilanWWK?"Diwakilkan ke: "+ev.perwakilanWWK:"Pilih Pejabat Perwakilan"}</button>
      {ev.statusWWK==="diwakilkan"&&ev.perwakilanWWK&&<button onClick={()=>{upd(ev.id,{statusWWK:null,perwakilanWWK:""});showT("Disposisi dibatalkan","warn");}} style={{marginTop:5,width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #fca5a5",background:"white",color:"#e11d48",cursor:"pointer",fontSize:11,fontWeight:700}}>Batalkan Disposisi</button>}
    </div>
    {!isAjudan&&<div><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:4}}>Catatan untuk Tim</label>
      <CatatanInput evId={ev.id} initial={ev.catatanPimpinan} onSave={v=>{upd(ev.id,{catatanPimpinan:v});showT("Catatan disimpan");}} btnColor={GREEN} placeholder="Arahan..."/>
    </div>}
  </div>;
}

// ── AdminRK Konfirmasi Kehadiran component ──
function AdminRKKehadiran({ev,upd,showT,setDelegTarget}){
  const locked=isKehadiranLocked(ev);
  const forWK=(ev.untukPimpinan||[]).includes("walikota");
  const forWWK=(ev.untukPimpinan||[]).includes("wakilwalikota")||ev.delegasiKeWWK;
  const notifAtasan=()=>loadUsers().filter(u=>(u.role==="kabag"||u.role==="kasubbag_protokol"||u.role==="kasubbag_komdokpim")&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"konfirmasi_kehadiran",labelPimpinan:"Wali Kota",statusKehadiran:"delegasi"}));
  const Badge=()=><span style={{fontSize:10,color:"#92400E",background:"#FEF3C7",padding:"2px 7px",borderRadius:20,border:"1px solid #FDE68A",fontWeight:600}}>✏️ Admin RK</span>;
  if(locked)return <div style={{marginBottom:14}}><KehadiranLockedBanner/></div>;
  return <div style={{marginBottom:14,borderRadius:12,border:"1.5px solid #FDE68A",overflow:"hidden"}}>
    <div style={{background:"#FFFBEB",padding:"8px 12px",display:"flex",alignItems:"center",gap:7,borderBottom:"1px solid #FDE68A"}}>
      <span style={{fontSize:14}}>✏️</span>
      <span style={{fontSize:11,fontWeight:700,color:"#92400E"}}>Input Kehadiran Pimpinan</span>
      <span style={{fontSize:10,color:"#92400E",marginLeft:"auto",background:"#FEF3C7",padding:"2px 7px",borderRadius:20,border:"1px solid #FDE68A"}}>dicatat sebagai Admin RK</span>
    </div>
    <div style={{padding:"10px 12px"}}>
      {/* ── WALI KOTA ── */}
      {forWK&&!ev.delegasiKeWWK&&<div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:800,color:"#475569",textTransform:"uppercase",letterSpacing:0.5,marginBottom:7}}>Wali Kota</div>
        {(ev.statusWK||ev.delegasiKeWWK)&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,padding:"6px 10px",borderRadius:8,background:ev.delegasiKeWWK?"#EDE9FE":ev.statusWK==="hadir"?"#DCFCE7":ev.statusWK==="tidak_hadir"?"#FEE2E2":"#FEF3C7",border:"1px solid "+(ev.delegasiKeWWK?"#C4B5FD":ev.statusWK==="hadir"?"#86EFAC":ev.statusWK==="tidak_hadir"?"#FCA5A5":"#FDE68A")}}>
          <span style={{fontSize:14}}>{ev.delegasiKeWWK?"↩":ev.statusWK==="hadir"?"✅":ev.statusWK==="tidak_hadir"?"❌":"↗"}</span>
          <span style={{fontSize:12,fontWeight:700,color:ev.delegasiKeWWK?"#7C3AED":ev.statusWK==="hadir"?"#065F46":ev.statusWK==="tidak_hadir"?"#991B1B":"#92400E",flex:1}}>
            {ev.delegasiKeWWK?"Didelegasikan ke Wakil Wali Kota":ev.statusWK==="hadir"?"Wali Kota Hadir":ev.statusWK==="tidak_hadir"?"Wali Kota Tidak Hadir":ev.statusWK==="diwakilkan"?"Diwakilkan"+(ev.perwakilanWK?" ke "+ev.perwakilanWK:""):"—"}
          </span>
          <Badge/>
        </div>}
        {!ev.statusWK&&!ev.delegasiKeWWK&&<>
          <div style={{display:"flex",gap:7,marginBottom:7}}>
            <button onClick={e=>{e.stopPropagation();upd(ev.id,{statusWK:"hadir",delegasiKeWWK:false,perwakilanWK:"",statusWK_by:"admin_rk"});showT("WK Hadir — dicatat Admin RK");notifAtasan();}}
              style={{flex:1,padding:"10px 6px",borderRadius:10,cursor:"pointer",fontWeight:800,fontSize:12,border:"2px solid #15803D",background:"white",color:"#15803D"}}>✓ Hadir</button>
            <button onClick={e=>{e.stopPropagation();upd(ev.id,{statusWK:"tidak_hadir",statusWK_by:"admin_rk"});showT("WK Tidak Hadir — dicatat Admin RK");notifAtasan();}}
              style={{flex:1,padding:"10px 6px",borderRadius:10,cursor:"pointer",fontWeight:800,fontSize:12,border:"2px solid #991B1B",background:"white",color:"#991B1B"}}>✗ Tidak Hadir</button>
          </div>
          <div style={{display:"flex",gap:7}}>
            <button onClick={e=>{e.stopPropagation();upd(ev.id,{statusWK:"diwakilkan",delegasiKeWWK:true,perwakilanWK:"",statusWK_by:"admin_rk"});showT("WK Delegasi ke WWK — dicatat Admin RK");notifAtasan();}}
              style={{flex:1,padding:"9px 6px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:11,border:"2px solid #7C3AED",background:"white",color:"#7C3AED"}}>↩ Delegasi ke Wakil WK</button>
            <button onClick={e=>{e.stopPropagation();setDelegTarget({id:ev.id,side:"wk_adminrk"});}}
              style={{flex:1,padding:"9px 6px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:11,border:"2px solid #0284C7",background:"white",color:"#0284C7"}}>↗ Wakilkan ke Jajaran</button>
          </div>
        </>}
        {ev.statusWK==="diwakilkan"&&!ev.delegasiKeWWK&&<div style={{marginTop:8}}>
          <div style={{fontSize:11,color:"#64748B",marginBottom:5,fontWeight:600}}>Pilih pejabat yang mewakili:</div>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:7}}>
            {PEJABAT.map(p=><button key={p} onClick={e=>{e.stopPropagation();upd(ev.id,{perwakilanWK:p});showT("Diwakilkan ke "+p);}}
              style={{padding:"8px 11px",borderRadius:8,border:"1.5px solid "+(ev.perwakilanWK===p?"#0284C7":"#E2E8F0"),background:ev.perwakilanWK===p?"#EFF6FF":"white",color:ev.perwakilanWK===p?"#0284C7":"#334155",cursor:"pointer",fontSize:12,textAlign:"left",fontWeight:ev.perwakilanWK===p?700:400}}>{p}</button>)}
            <input value={ev.perwakilanWK&&!PEJABAT.includes(ev.perwakilanWK)?ev.perwakilanWK:""} onChange={e=>upd(ev.id,{perwakilanWK:e.target.value})}
              placeholder="Pejabat lainnya (ketik nama)..." style={{padding:"8px 10px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:12}}/>
          </div>
        </div>}
        {(ev.statusWK||ev.delegasiKeWWK)&&<button onClick={e=>{e.stopPropagation();upd(ev.id,{statusWK:null,delegasiKeWWK:false,perwakilanWK:"",statusWK_by:null});showT("Status WK direset","warn");}}
          style={{width:"100%",marginTop:6,padding:"7px",borderRadius:9,border:"1.5px dashed #94A3B8",background:"#F8FAFC",color:"#64748B",cursor:"pointer",fontSize:11,fontWeight:600}}>↩ Reset Status Wali Kota</button>}
      </div>}
      {/* ── WAKIL WALI KOTA ── */}
      {(forWWK||ev.delegasiKeWWK)&&<div>
        <div style={{fontSize:11,fontWeight:800,color:"#475569",textTransform:"uppercase",letterSpacing:0.5,marginBottom:7}}>
          Wakil Wali Kota{ev.delegasiKeWWK&&<span style={{fontSize:10,fontWeight:700,color:"#7C3AED",background:"#EDE9FE",padding:"2px 7px",borderRadius:20,marginLeft:6}}>menerima delegasi WK</span>}
        </div>
        {ev.statusWWK&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,padding:"6px 10px",borderRadius:8,background:ev.statusWWK==="hadir"?"#DCFCE7":ev.statusWWK==="tidak_hadir"?"#FEE2E2":"#FEF3C7",border:"1px solid "+(ev.statusWWK==="hadir"?"#86EFAC":ev.statusWWK==="tidak_hadir"?"#FCA5A5":"#FDE68A")}}>
          <span style={{fontSize:14}}>{ev.statusWWK==="hadir"?"✅":ev.statusWWK==="tidak_hadir"?"❌":"↗"}</span>
          <span style={{fontSize:12,fontWeight:700,color:ev.statusWWK==="hadir"?"#065F46":ev.statusWWK==="tidak_hadir"?"#991B1B":"#92400E",flex:1}}>
            {ev.statusWWK==="hadir"?"Wakil Wali Kota Hadir":ev.statusWWK==="tidak_hadir"?"Wakil Wali Kota Tidak Hadir":"Diwakilkan"+(ev.perwakilanWWK?" ke "+ev.perwakilanWWK:"")}
          </span>
          <Badge/>
        </div>}
        {!ev.statusWWK&&<>
          <div style={{display:"flex",gap:7,marginBottom:7}}>
            <button onClick={e=>{e.stopPropagation();upd(ev.id,{statusWWK:"hadir",statusWWK_by:"admin_rk",delegasiWWKJajaran:false,perwakilanWWK:""});showT("WWK Hadir — dicatat Admin RK");loadUsers().filter(u=>(u.role==="kabag"||u.role==="kasubbag_protokol"||u.role==="kasubbag_komdokpim")&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"konfirmasi_kehadiran",labelPimpinan:"Wakil Wali Kota",statusKehadiran:"hadir"}));}}
              style={{flex:1,padding:"10px 6px",borderRadius:10,cursor:"pointer",fontWeight:800,fontSize:12,border:"2px solid #15803D",background:"white",color:"#15803D"}}>✓ Hadir</button>
            <button onClick={e=>{e.stopPropagation();upd(ev.id,{statusWWK:"tidak_hadir",statusWWK_by:"admin_rk"});showT("WWK Tidak Hadir — dicatat Admin RK");loadUsers().filter(u=>(u.role==="kabag"||u.role==="kasubbag_protokol"||u.role==="kasubbag_komdokpim")&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"konfirmasi_kehadiran",labelPimpinan:"Wakil Wali Kota",statusKehadiran:"tidak_hadir"}));}}
              style={{flex:1,padding:"10px 6px",borderRadius:10,cursor:"pointer",fontWeight:800,fontSize:12,border:"2px solid #991B1B",background:"white",color:"#991B1B"}}>✗ Tidak Hadir</button>
          </div>
          <button onClick={e=>{e.stopPropagation();upd(ev.id,{statusWWK:"diwakilkan",delegasiWWKJajaran:true,statusWWK_by:"admin_rk"});showT("WWK Diwakilkan — pilih pejabat");}}
            style={{width:"100%",padding:"9px 6px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:11,border:"2px solid #0284C7",background:"white",color:"#0284C7"}}>↗ Wakilkan ke Jajaran</button>
        </>}
        {ev.statusWWK==="diwakilkan"&&<div style={{marginTop:8}}>
          <div style={{fontSize:11,color:"#64748B",marginBottom:5,fontWeight:600}}>Pilih pejabat yang mewakili:</div>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:7}}>
            {PEJABAT.map(p=><button key={p} onClick={e=>{e.stopPropagation();upd(ev.id,{perwakilanWWK:p});showT("WWK diwakilkan ke "+p);}}
              style={{padding:"8px 11px",borderRadius:8,border:"1.5px solid "+(ev.perwakilanWWK===p?"#0284C7":"#E2E8F0"),background:ev.perwakilanWWK===p?"#EFF6FF":"white",color:ev.perwakilanWWK===p?"#0284C7":"#334155",cursor:"pointer",fontSize:12,textAlign:"left",fontWeight:ev.perwakilanWWK===p?700:400}}>{p}</button>)}
            <input value={ev.perwakilanWWK&&!PEJABAT.includes(ev.perwakilanWWK)?ev.perwakilanWWK:""} onChange={e=>upd(ev.id,{perwakilanWWK:e.target.value})}
              placeholder="Pejabat lainnya (ketik nama)..." style={{padding:"8px 10px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:12}}/>
          </div>
        </div>}
        {ev.statusWWK&&<button onClick={e=>{e.stopPropagation();upd(ev.id,{statusWWK:null,statusWWK_by:null,perwakilanWWK:"",delegasiWWKJajaran:false});showT("Status WWK direset","warn");}}
          style={{width:"100%",marginTop:6,padding:"7px",borderRadius:9,border:"1.5px dashed #94A3B8",background:"#F8FAFC",color:"#64748B",cursor:"pointer",fontSize:11,fontWeight:600}}>↩ Reset Status Wakil Wali Kota</button>}
      </div>}
    </div>
  </div>;
}

// ── App-level context (avoids Rules-of-Hooks violation from inner component definitions) ──
const AppCtx = React.createContext({});


// ── AppCtx: provides App-scope deps to components outside App ──

// ==================== EVENT CARD (mobile) ====================
function EventCard({ev}){
  const {expandedId,setExp,role,user,isMobile,getHari,fmt,fmtShort,todayStr,handleUndanganUpload,handleSambutanDocx,handleSambutanUpload,updAndSync,storageDelete,showT,upd,setDelegTarget,setTab,setForm,setEditId,setPenugasanEv,setEvaluasiEv,rejectTexts,setRT,askConfirm,deleteAndSync,makeICS,PersonilBanner}=React.useContext(AppCtx);
  const exp=expandedId===ev.id;const hariEv=getHari(ev.tanggal);const isToday=ev.tanggal===todayStr();
  const isPending=ev.alur==="menunggu_kasubbag"||ev.alur==="menunggu_kabag";
  const isDraft=ev.alur==="draft"||ev.alur==="ditolak";
  // Status waktu
  const nowDt=new Date();
  const evDt=new Date(ev.tanggal+"T"+(ev.jam||"00:00"));
  const isPast=ev.alur==="disetujui"&&evDt<nowDt;
  const isUpcoming=ev.alur==="disetujui"&&evDt>=nowDt;
  const borderColor=isPending?"#F59E0B":isDraft?"#94A3B8":ev.alur==="ditolak"?"#EF4444":isToday&&isUpcoming?NAVY:"transparent";
  const cardBg="white";
  const cardOpacity=isPast?0.72:1;
  return <div id={"ev-"+ev.id} className="ev-card" style={{background:cardBg,borderRadius:16,marginBottom:10,boxShadow:"0 2px 12px rgba(0,0,0,0.07),0 0 0 1px rgba(0,0,0,0.04)",border:"1.5px solid "+borderColor,overflow:"hidden",opacity:cardOpacity}}>
    {ev.catatanPimpinan&&<div style={{background:"linear-gradient(90deg,#EEF2FF,#F5F3FF)",padding:"6px 14px",fontSize:11,color:"#4338CA",fontWeight:600,borderBottom:"1px solid #E0E7FF",display:"flex",alignItems:"center",gap:5}}>
      <span style={{fontSize:12}}>💬</span>{ev.catatanPimpinan}
    </div>}
    {/* Banner penugasan — semua role yang terlibat penugasan */}
    {["kabag","ajudan_walikota","ajudan_wakilwalikota","kasubbag_protokol","kasubbag_komdokpim","timkom","staf","admin_rk"].includes(role)&&ev.alur==="disetujui"&&<PersonilBanner ev={ev} role={role} user={user} setPenugasanEv={setPenugasanEv} setEvaluasiEv={setEvaluasiEv}/>}
    <div onClick={()=>setExp(exp?null:ev.id)} style={{padding:"14px",cursor:"pointer",userSelect:"none"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:11}}>
        {/* Date badge */}
        <div style={{background:isToday?"linear-gradient(145deg,"+NAVY+",#1E3254)":"#F6F8FC",borderRadius:12,padding:"8px 7px",textAlign:"center",minWidth:46,flexShrink:0,boxShadow:isToday?"0 4px 12px rgba(10,22,40,0.25)":"none"}}>
          <div style={{fontSize:8,color:isToday?"rgba(212,175,90,0.9)":"#94A3B8",fontWeight:800,textTransform:"uppercase",letterSpacing:1}}>{hariEv.slice(0,3)}</div>
          <div style={{fontSize:18,fontWeight:900,color:isToday?"white":"#1E293B",lineHeight:1.1}}>{ev.tanggal.slice(8)}</div>
          <div style={{fontSize:9,color:isToday?"rgba(255,255,255,0.6)":"#94A3B8",fontWeight:500,marginTop:1}}>{ev.jam}</div>
        </div>
        {/* Info */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap",marginBottom:5}}>
            <JenisBadge j={ev.jenisKegiatan}/><StatusPill alur={ev.alur} hapus={ev.alurHapus}/>
            {isPast&&<span style={{fontSize:9,background:"#E2E8F0",color:"#64748B",borderRadius:4,padding:"1px 5px",fontWeight:700,letterSpacing:0.3}}>SELESAI</span>}
            {isPending&&<span style={{fontSize:9,background:"#FEF3C7",color:"#92400E",borderRadius:4,padding:"1px 5px",fontWeight:700,letterSpacing:0.3}}>DIPROSES</span>}
            {isUpcoming&&!isToday&&<span style={{fontSize:9,background:"#EFF6FF",color:"#1D4ED8",borderRadius:4,padding:"1px 5px",fontWeight:700,letterSpacing:0.3}}>{relativeDate(ev.tanggal)||"AKAN DATANG"}</span>}
            {isToday&&isUpcoming&&<span style={{fontSize:9,background:"linear-gradient(90deg,#0A1628,#1B4080)",color:"#C9A84C",borderRadius:4,padding:"1px 5px",fontWeight:700,letterSpacing:0.3}}>HARI INI</span>}
            <span style={{fontSize:9,padding:"2px 6px",borderRadius:10,background:"#EFF6FF",color:"#1E40AF",fontWeight:700,border:"1px solid #BFDBFE"}}>🎯 {tujuanPimpinanLabel(ev)}</span>
          </div>
          <div style={{fontSize:14,fontWeight:700,color:"#0F1C2E",lineHeight:1.35,marginBottom:3,letterSpacing:"-0.1px"}}>{ev.namaAcara}</div>
          <div style={{fontSize:12,color:"#64748B",display:"flex",alignItems:"center",gap:4}}>
            <span>{ev.penyelenggara}</span>
            {ev.lokasi&&<><span style={{color:"#CBD5E1"}}>·</span><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:130}}>{ev.lokasi}</span></>}
          </div>
        </div>
        {/* Chevron */}
        <div style={{color:"#CBD5E1",fontSize:11,flexShrink:0,transition:"transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",transform:exp?"rotate(180deg)":"none",marginTop:4}}>▼</div>
      </div>
    </div>
    {exp&&<ExpandedDetail ev={ev} hariEv={hariEv}/>}
  </div>;
};

// ==================== DESKTOP TABLE ROW ====================
function TableView({evList}){
  const {expandedId,setExp,role,user,isMobile,getHari,fmt,fmtShort,todayStr,handleUndanganUpload,handleSambutanDocx,handleSambutanUpload,updAndSync,storageDelete,showT,upd,setDelegTarget,setTab,setForm,setEditId,setPenugasanEv,setEvaluasiEv,rejectTexts,setRT,askConfirm,deleteAndSync,makeICS,PersonilBanner}=React.useContext(AppCtx);
  return <div style={{background:"white",borderRadius:12,boxShadow:"0 1px 8px rgba(0,0,0,0.07)",overflow:"hidden"}}>
  <table className="ev-table">
    <thead><tr>
      <th>Tanggal</th><th>Pukul</th><th style={{minWidth:220}}>Nama Acara</th><th>Jenis</th><th>Penyelenggara</th><th>Lokasi</th><th>Pakaian</th><th>Status</th><th>Aksi</th>
    </tr></thead>
    <tbody>
      {evList.map(ev=>{
        const exp=expandedId===ev.id;const hariEv=getHari(ev.tanggal);const isToday=ev.tanggal===todayStr();
        return <><tr key={ev.id} id={"ev-"+ev.id} className="card-row" style={{cursor:"pointer"}} onClick={()=>setExp(exp?null:ev.id)}>
          <td><div style={{fontWeight:700,fontSize:12,color:isToday?NAVY:"#334155",whiteSpace:"nowrap"}}>{hariEv}, {fmtShort(ev.tanggal)}</div>{(isToday||relativeDate(ev.tanggal))&&<span style={{fontSize:10,color:isToday?"#2563eb":"#64748B",fontWeight:700}}>{isToday?"Hari ini":relativeDate(ev.tanggal)}</span>}</td>
          <td><span style={{fontWeight:700,fontSize:13,color:NAVY}}>{ev.jam}</span></td>
          <td><div style={{fontWeight:700,fontSize:13,color:"#0F2040",lineHeight:1.3}}>{ev.namaAcara}</div>
            <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
              <span style={{fontSize:9,padding:"1px 5px",borderRadius:10,background:"#EFF6FF",color:"#1E40AF",fontWeight:700,border:"1px solid #BFDBFE"}}>🎯 {tujuanPimpinanLabel(ev)}</span>
            </div>
          </td>
          <td><JenisBadge j={ev.jenisKegiatan}/></td>
          <td style={{fontSize:12,color:"#475569",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.penyelenggara}</td>
          <td style={{fontSize:12,color:"#475569",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.lokasi||<span style={{color:"#cbd5e1"}}>-</span>}</td>
          <td style={{fontSize:11,color:"#475569",whiteSpace:"nowrap"}}>{ev.pakaian}</td>
          <td><StatusPill alur={ev.alur} hapus={ev.alurHapus}/></td>
          <td><button onClick={e=>{e.stopPropagation();setExp(exp?null:ev.id);}} style={{padding:"5px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",background:exp?"#EBF0FA":"white",color:exp?NAVY:"#64748b",cursor:"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{exp?"Tutup":"Detail"}</button></td>
        </tr>
        {exp&&<tr key={ev.id+"_exp"}><td colSpan={9} style={{padding:0,background:"#fafbfc",borderBottom:"2px solid #EBF0FA"}}>
          <div style={{padding:"16px 20px"}}><ExpandedDetail ev={ev} hariEv={hariEv}/></div>
        </td></tr>}</>
      })}
    </tbody>
  </table>
</div>;
}
// ==================== EXPANDED DETAIL ====================
function ExpandedDetail({ev,hariEv}){
  const {role,user,isMobile,handleUndanganUpload,handleSambutanDocx,handleSambutanUpload,updAndSync,storageDelete,showT,upd,setDelegTarget,setTab,setForm,setEditId,setPenugasanEv,setEvaluasiEv,rejectTexts,setRT,askConfirm,deleteAndSync,makeICS,getNamaByUsername,setExp}=React.useContext(AppCtx);
  return <div>
    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":ev.jenisKegiatan==="Sambutan"?"1fr 1fr":"1fr",gap:"0 24px",marginBottom:14}}>
      <div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {[{i:"Tgl",l:"Tanggal",v:hariEv+", "+fmt(ev.tanggal)},{i:"Jam",l:"Waktu",v:ev.jam+" WITA"},{i:"Org",l:"Penyelenggara",v:ev.penyelenggara},{i:"Tel",l:"Kontak",v:ev.kontak},{i:"No",l:"Bukti Undangan",v:ev.buktiUndangan},{i:"Bj",l:"Pakaian",v:ev.pakaian},{i:"Ket",l:"Catatan",v:ev.catatan}].filter(f=>f.v).map(f=>(
            <div key={f.l} style={{display:"flex",gap:8,padding:"6px 10px",background:"#f8fafc",borderRadius:8}}>
              <div style={{minWidth:80,fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase"}}>{f.l}</div>
              <div style={{fontSize:12,color:"#1e293b",flex:1}}>{f.v}</div>
            </div>
          ))}
          {ev.lokasi&&<div style={{display:"flex",gap:8,padding:"6px 10px",background:"#f0f9ff",borderRadius:8,border:"1px solid #bae6fd",alignItems:"center"}}>
            <div style={{minWidth:80,fontSize:10,color:"#0284c7",fontWeight:700,textTransform:"uppercase"}}>Lokasi</div>
            <div style={{flex:1,fontSize:12,color:"#0c4a6e",fontWeight:600}}>{ev.lokasi}</div>
            <a href={"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(ev.lokasi)} target="_blank" rel="noopener noreferrer" style={{padding:"5px 10px",borderRadius:7,background:"#1a73e8",color:"white",textDecoration:"none",fontSize:11,fontWeight:700,flexShrink:0}}>Maps</a>
          </div>}
          <div style={{marginTop:4}}>
            <UndanganBlock ev={ev} canEdit={role==="admin_rk"&&ev.alur!=="disetujui"} onUpload={(file,name)=>handleUndanganUpload(ev.id,file,name).then(()=>showT("Berkas undangan diupload"))} onRemove={()=>{if(ev.undanganFile&&!ev.undanganFile.startsWith("data:"))storageDelete("undangan",ev.undanganFile).catch(e=>console.warn("Sync:",e?.message||e));updAndSync(ev.id,{undanganFile:null,undanganNama:""}); }}/>
          </div>
        </div>
        <div style={{display:"flex",gap:7,marginTop:8}}>
          <a href={makeICS(ev)} download={(ev.namaAcara||"jadwal")+".ics"} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"9px",borderRadius:9,border:"1.5px solid #e2e8f0",background:"white",color:"#334155",textDecoration:"none",fontSize:12,fontWeight:700}}>
            <span style={{fontSize:14}}>&#x1F4C5;</span>Simpan .ics
          </a>
          <a href={"https://calendar.google.com/calendar/render?action=TEMPLATE&text="+encodeURIComponent(ev.namaAcara||"")+"&dates="+((ev.tanggal||"").replace(/-/g,"")+"T"+(ev.jam||"0800").replace(":","")+"00")+"/"+((ev.tanggal||"").replace(/-/g,"")+"T"+String(parseInt((ev.jam||"08:00").split(":")[0])+2).padStart(2,"0")+(ev.jam||"08:00").split(":")[1]+"00")+"&location="+encodeURIComponent(ev.lokasi||"")+"&details="+encodeURIComponent("Penyelenggara: "+(ev.penyelenggara||"")+"%0APakaian: "+(ev.pakaian||""))} target="_blank" rel="noopener noreferrer" style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"9px",borderRadius:9,border:"none",background:"#1a73e8",color:"white",textDecoration:"none",fontSize:12,fontWeight:700}}>
            <span style={{fontSize:14}}>&#x1F4C6;</span>Google Cal
          </a>
        </div>
      </div>
      {ev.jenisKegiatan==="Sambutan"&&<div>
        <SambutanBlock ev={ev} canUpload={role==="timkom"||role==="kasubbag_komdokpim"} onUploadDocx={(f)=>handleSambutanDocx(ev.id,f,ev)} onUploadPdf={(f,name)=>handleSambutanUpload(ev.id,f,name).then(()=>showT("Naskah sambutan (PDF) diupload"))} onRemove={()=>{if(ev.sambutanFile&&!ev.sambutanFile.startsWith("data:"))storageDelete("sambutan",ev.sambutanFile).catch(e=>console.warn("Sync:",e?.message||e));if(ev.sambutanDocx&&!ev.sambutanDocx.startsWith("data:")&&!ev.sambutanDocx.startsWith("blob:"))storageDelete("sambutan",ev.sambutanDocx).catch(e=>console.warn("Sync:",e?.message||e));updAndSync(ev.id,{sambutanFile:null,sambutanNama:"",sambutanDocx:null,sambutanDocxNama:""});showT("Naskah sambutan dihapus","warn");}}/>
      </div>}
    </div>

    {/* KONFIRMASI KEHADIRAN — Admin RK bisa isi untuk WK dan WWK */}
    {role==="admin_rk"&&ev.alur==="disetujui"&&<AdminRKKehadiran ev={ev} upd={upd} showT={showT} setDelegTarget={setDelegTarget}/>}
    {/* REKAN KERJA — tampilkan untuk staf & timkom yang ditugaskan */}
    {["staf","timkom"].includes(role)&&(ev.personil||[]).includes(user.username)&&ev.alur==="disetujui"&&<div style={{marginBottom:12,padding:"11px 14px",borderRadius:11,background:"linear-gradient(90deg,#ECFDF5,#F0FDF4)",border:"1.5px solid #6EE7B7"}}>
      <div style={{fontSize:10,fontWeight:800,color:"#065F46",letterSpacing:1,textTransform:"uppercase",marginBottom:8,display:"flex",alignItems:"center",gap:5}}>
        🎯 Tim Bertugas di Acara Ini
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {(ev.personil||[]).map(un=>{
          const isMe=un===user.username;
          const u=loadUsers().find(x=>x.username===un);
          const nama=u?.nama||un;
          const roleLabel=(u?.role||"").replace(/_/g," ");
          return <div key={un} style={{display:"flex",alignItems:"center",gap:9,padding:"6px 10px",borderRadius:8,background:isMe?"#D1FAE5":"white",border:"1px solid "+(isMe?"#A7F3D0":"#E2E8F0")}}>
            <div style={{width:28,height:28,borderRadius:8,background:isMe?"#059669":NAVY,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"white",flexShrink:0}}>{nama.slice(0,1)}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:isMe?800:600,color:isMe?"#065F46":"#1E293B"}}>{nama}{isMe?" — Anda":""}</div>
              <div style={{fontSize:10,color:"#94A3B8",textTransform:"capitalize"}}>{roleLabel}</div>
            </div>
          </div>;
        })}
        {ev.catatanPenugasan&&<div style={{marginTop:5,padding:"6px 10px",background:"#EEF2FF",borderRadius:8,fontSize:11,color:"#4338CA",fontStyle:"italic"}}>💬 Catatan: {ev.catatanPenugasan}</div>}
      </div>
    </div>}
    {/* ADMIN RK ACTIONS — hierarki: Primary → Secondary → Destructive */}
    {role==="admin_rk"&&<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:8}}>
      {/* ── DRAFT: Kirim (primary) + Edit (secondary) ── */}
      {ev.alur==="draft"&&<>
        <button onClick={()=>{upd(ev.id,{alur:"menunggu_kasubbag"});showT("Dikirim ke Kasubbag");
          loadUsers().filter(u=>(u.role==="kasubbag_protokol")&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"submit",submittedBy:user?.nama}));sendPush({targetRole:"kasubbag_protokol",title:"📋 Jadwal Baru Masuk",body:ev.namaAcara+" — "+ev.jam+" WITA",url:"/",tag:"submit-"+ev.id});sendPush({targetRole:"kasubbag_komdokpim",title:"📋 Jadwal Baru Masuk",body:ev.namaAcara+" — "+ev.jam+" WITA",url:"/",tag:"submit-"+ev.id});}}
          style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:NAVY,color:"white",cursor:"pointer",fontSize:13,fontWeight:800,boxShadow:"0 4px 12px rgba(10,22,40,0.25)"}}>
          📤 Kirim ke Kasubbag
        </button>
        <button onClick={()=>{setForm({tanggal:ev.tanggal,jam:ev.jam,namaAcara:ev.namaAcara,penyelenggara:ev.penyelenggara,kontak:ev.kontak||"",buktiUndangan:ev.buktiUndangan||"",pakaian:ev.pakaian,jenisKegiatan:ev.jenisKegiatan,catatan:ev.catatan||"",lokasi:ev.lokasi||"",untukPimpinan:ev.untukPimpinan,undanganFile:ev.undanganFile||null,undanganNama:ev.undanganNama||""});setEditId(ev.id);setTab("form");}}
          style={{width:"100%",padding:"10px",borderRadius:10,border:"1.5px solid "+NAVY,background:"white",color:NAVY,cursor:"pointer",fontSize:13,fontWeight:700}}>
          ✏️ Edit Jadwal
        </button>
      </>}
      {/* ── DITOLAK: wajib edit dulu, baru bisa kirim ulang ── */}
      {ev.alur==="ditolak"&&<>
        {/* Banner alasan penolakan */}
        <div style={{background:"#FEF2F2",border:"1.5px solid #FECACA",borderRadius:10,padding:"12px 14px",display:"flex",gap:10,alignItems:"flex-start",marginBottom:2}}>
          <span style={{fontSize:18,flexShrink:0}}>❌</span>
          <div>
            <div style={{fontSize:12,fontWeight:800,color:"#991B1B",marginBottom:3}}>Dikembalikan oleh Kabag</div>
            <div style={{fontSize:12,color:"#7F1D1D",lineHeight:1.5}}>{ev.catatanTolak||"Perlu diperbaiki"}</div>
          </div>
        </div>
        {/* Pilihan tindakan */}
        <div style={{background:"#FAFAFA",borderRadius:10,border:"1px solid #E2E8F0",overflow:"hidden"}}>
          <div style={{padding:"10px 14px",fontSize:11,color:"#64748B",fontWeight:600,borderBottom:"1px solid #E2E8F0",background:"white"}}>
            Pilih tindakan untuk jadwal ini:
          </div>
          {/* Opsi 1: Edit & Kirim Ulang */}
          <button onClick={()=>{setForm({tanggal:ev.tanggal,jam:ev.jam,namaAcara:ev.namaAcara,penyelenggara:ev.penyelenggara,kontak:ev.kontak||"",buktiUndangan:ev.buktiUndangan||"",pakaian:ev.pakaian,jenisKegiatan:ev.jenisKegiatan,catatan:ev.catatan||"",lokasi:ev.lokasi||"",untukPimpinan:ev.untukPimpinan,besertaIstriWK:ev.besertaIstriWK||false,besertaIstriWWK:ev.besertaIstriWWK||false,undanganFile:ev.undanganFile||null,undanganNama:ev.undanganNama||""});setEditId(ev.id);setTab("form");}}
            style={{width:"100%",padding:"14px",border:"none",borderBottom:"1px solid #E2E8F0",background:"white",cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
            <span style={{width:36,height:36,borderRadius:9,background:"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>✏️</span>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#1D4ED8"}}>Edit & Kirim Ulang</div>
              <div style={{fontSize:11,color:"#64748B",marginTop:1}}>Perbaiki jadwal lalu kirim kembali ke Kasubbag</div>
            </div>
            <span style={{marginLeft:"auto",fontSize:16,color:"#94A3B8"}}>›</span>
          </button>
          {/* Opsi 2: Hapus */}
          <button onClick={()=>askConfirm("Hapus Jadwal?","Jadwal '"+ev.namaAcara+"' akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.",()=>{deleteAndSync(ev.id);showT("Jadwal dihapus","warn");},"Hapus","#DC2626")}
            style={{width:"100%",padding:"14px",border:"none",background:"white",cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
            <span style={{width:36,height:36,borderRadius:9,background:"#FEF2F2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🗑️</span>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#DC2626"}}>Hapus Jadwal</div>
              <div style={{fontSize:11,color:"#64748B",marginTop:1}}>Hapus permanen, tidak bisa dikembalikan</div>
            </div>
            <span style={{marginLeft:"auto",fontSize:16,color:"#94A3B8"}}>›</span>
          </button>
        </div>
      </>}
      {/* ── DISETUJUI: Ajukan Pembatalan (destructive, terpisah) ── */}
      {ev.alur==="disetujui"&&!ev.alurHapus&&ev.submittedBy===user?.username&&<>
        <div style={{height:1,background:"#E2E8F0",margin:"4px 0"}}/>
        <button onClick={()=>{upd(ev.id,{alurHapus:"menunggu_kasubbag"});showT("Permintaan pembatalan dikirim","warn");}}
          style={{width:"100%",padding:"9px",borderRadius:9,border:"1.5px solid #FECACA",background:"#FFF5F5",color:"#991B1B",cursor:"pointer",fontSize:12,fontWeight:700}}>
          Ajukan Pembatalan Jadwal
        </button>
      </>}
    </div>}

    {/* KASUBBAG — Primary: Verifikasi | Destructive: Tolak (terpisah visual) */}
    {(role==="kasubbag_protokol"||role==="kasubbag_komdokpim")&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
      {ev.alur==="menunggu_kasubbag"&&!ev.alurHapus&&<>
        {/* PRIMARY */}
        <button onClick={()=>{upd(ev.id,{alur:"menunggu_kabag"});showT("Diteruskan ke Kabag");
          loadUsers().filter(u=>u.role==="kabag"&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"kasubbag_approve"}));sendPush({targetRole:"kabag",title:"✅ Menunggu Persetujuan Anda",body:ev.namaAcara+" — "+ev.jam+" WITA",url:"/",tag:"approve-"+ev.id});}}
          style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:"#10B981",color:"white",cursor:"pointer",fontSize:13,fontWeight:800,boxShadow:"0 4px 12px rgba(16,185,129,0.3)"}}>
          ✅ Verifikasi & Teruskan ke Kabag
        </button>
        {/* DESTRUCTIVE — dipisah garis */}
        <div style={{display:"flex",alignItems:"center",gap:8,margin:"2px 0"}}>
          <div style={{flex:1,height:1,background:"#E2E8F0"}}/>
          <span style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>atau tolak</span>
          <div style={{flex:1,height:1,background:"#E2E8F0"}}/>
        </div>
        <div style={{borderRadius:10,border:"1.5px solid #FECACA",overflow:"hidden"}}>
          <textarea placeholder="Tulis alasan penolakan (wajib)..." value={rejectTexts[ev.id]||""} onChange={e=>setRT(p=>({...p,[ev.id]:e.target.value}))} rows={2} style={{width:"100%",padding:"9px 11px",border:"none",resize:"none",color:"#334155",background:"#FFF5F5",fontSize:13,boxSizing:"border-box"}}/>
          <button onClick={()=>{if(!(rejectTexts[ev.id]||"").trim()){showT("Tulis alasan penolakan dulu","warn");return;}askConfirm("Tolak & Kembalikan ke Admin RK?","Jadwal '"+ev.namaAcara+"' akan dikembalikan dengan catatan penolakan.",()=>{upd(ev.id,{alur:"ditolak",catatanTolak:rejectTexts[ev.id]||"Perlu perbaikan",_requiresEdit:true});showT("Dikembalikan ke Admin RK","warn");{const _ur=loadUsers().find(u=>u.username===ev.submittedBy);if(_ur?.noWA)sendWA({to:_ur.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,event:"rejected",catatanTolak:rejectTexts[ev.id]||"",submittedBy:getNamaByUsername(ev.submittedBy)});}sendPush({targetRole:"admin_rk",title:"❌ Jadwal Dikembalikan",body:ev.namaAcara+": "+(rejectTexts[ev.id]||"Perlu diperbaiki"),url:"/",tag:"rejected-"+ev.id});},"Tolak","#991B1B");}}
            style={{width:"100%",padding:"10px",border:"none",background:"#FEE2E2",color:"#991B1B",cursor:"pointer",fontSize:12,fontWeight:700}}>
            ✕ Tolak & Kembalikan ke Admin RK
          </button>
        </div>
      </>}
      {ev.alurHapus==="menunggu_kasubbag"&&<><div style={{background:"#fff1f2",borderRadius:9,padding:"9px 12px",fontSize:13,color:"#e11d48"}}>Staf mengajukan pembatalan jadwal ini</div>
        <div style={{display:"flex",gap:8}}><button onClick={()=>{upd(ev.id,{alurHapus:"menunggu_kabag"});showT("Diteruskan ke Kabag","warn");}} style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:"#e11d48",color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>Setuju ke Kabag</button><button onClick={()=>{upd(ev.id,{alurHapus:null});showT("Ditolak");}} style={{flex:1,padding:"10px",borderRadius:10,border:"1.5px solid #94a3b8",background:"white",color:"#334155",cursor:"pointer",fontSize:12,fontWeight:700}}>Tolak Hapus</button></div></>}
      {ev.alur==="disetujui"&&<button onClick={()=>setPenugasanEv(ev)} style={{width:"100%",padding:"10px",borderRadius:10,border:"1.5px dashed #cbd5e1",background:"#f8fafc",color:"#475569",cursor:"pointer",fontSize:12,fontWeight:700}}>
        {(!ev.personil||ev.personil.length===0)?"👥 Tugaskan Personil":"👥 Edit Penugasan ("+(ev.personil?.length||0)+" personil)"}
      </button>}
    </div>}

    {/* KABAG */}
    {role==="kabag"&&<div style={{display:"flex",flexDirection:"column",gap:7}}>
      {ev.alur==="menunggu_kabag"&&!ev.alurHapus&&<>
        {/* PRIMARY */}
        <button onClick={()=>{upd(ev.id,{alur:"disetujui"});showT("Jadwal disetujui & dipublikasi");
          {const _u=loadUsers().find(u=>u.username===ev.submittedBy);if(_u?.noWA)sendWA({to:_u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"approved",submittedBy:getNamaByUsername(ev.submittedBy)});}sendPush({targetRole:"admin_rk",title:"✅ Jadwal Disetujui",body:ev.namaAcara+" sudah dipublikasi",url:"/",tag:"approved-"+ev.id});loadUsers().filter(u=>(u.role==="ajudan_walikota"||u.role==="ajudan_wakilwalikota")&&u.noWA).forEach(u=>{const isWK=u.role==="ajudan_walikota"&&(ev.untukPimpinan||[]).includes("walikota");const isWWK=u.role==="ajudan_wakilwalikota"&&((ev.untukPimpinan||[]).includes("wakilwalikota")||ev.delegasiKeWWK);if(isWK||isWWK)sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"approved"});});}}
          style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:NAVY,color:"white",cursor:"pointer",fontSize:14,fontWeight:800,boxShadow:"0 4px 14px rgba(10,22,40,0.3)"}}>
          ✅ Setujui & Publikasi
        </button>
        {/* DESTRUCTIVE — dipisah garis */}
        <div style={{display:"flex",alignItems:"center",gap:8,margin:"2px 0"}}>
          <div style={{flex:1,height:1,background:"#E2E8F0"}}/>
          <span style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>atau tolak</span>
          <div style={{flex:1,height:1,background:"#E2E8F0"}}/>
        </div>
        <div style={{borderRadius:10,border:"1.5px solid #FECACA",overflow:"hidden"}}>
          <textarea placeholder="Tulis alasan penolakan (wajib)..." value={rejectTexts[ev.id]||""} onChange={e=>setRT(p=>({...p,[ev.id]:e.target.value}))} rows={2} style={{width:"100%",padding:"9px 11px",border:"none",resize:"none",color:"#334155",background:"#FFF5F5",fontSize:13,boxSizing:"border-box"}}/>
          <button onClick={()=>{if(!(rejectTexts[ev.id]||"").trim()){showT("Tulis alasan penolakan dulu","warn");return;}askConfirm("Tolak Jadwal?","Jadwal '"+ev.namaAcara+"' akan dikembalikan ke Admin RK.",()=>{upd(ev.id,{alur:"ditolak",catatanTolak:rejectTexts[ev.id]||"Perlu perbaikan",_requiresEdit:true});showT("Ditolak","warn");{const _ur=loadUsers().find(u=>u.username===ev.submittedBy);if(_ur?.noWA)sendWA({to:_ur.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,event:"rejected",catatanTolak:rejectTexts[ev.id]||"",submittedBy:getNamaByUsername(ev.submittedBy)});}sendPush({targetRole:"admin_rk",title:"❌ Jadwal Ditolak Kabag",body:ev.namaAcara+": "+(rejectTexts[ev.id]||"Perlu diperbaiki"),url:"/",tag:"rejected-"+ev.id});},"Tolak","#991B1B");}}
            style={{width:"100%",padding:"10px",border:"none",background:"#FEE2E2",color:"#991B1B",cursor:"pointer",fontSize:12,fontWeight:700}}>
            ✕ Tolak & Kembalikan ke Admin RK
          </button>
        </div>
      </>}
      {ev.alurHapus==="menunggu_kabag"&&<><div style={{background:"#fff1f2",borderRadius:9,padding:"9px 12px",fontSize:13,color:"#e11d48"}}>Permintaan penghapusan (sudah disetujui Kasubbag)</div>
        <div style={{display:"flex",gap:8}}><button onClick={()=>askConfirm("Hapus Jadwal Permanen?","Tindakan ini tidak dapat dibatalkan. Jadwal '"+ev.namaAcara+"' akan dihapus selamanya.",()=>{deleteAndSync(ev.id);setExp(null);showT("Jadwal dihapus");},"Hapus Permanen")} style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:"#e11d48",color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>Hapus Permanen</button><button onClick={()=>{upd(ev.id,{alurHapus:null});showT("Ditolak");}} style={{flex:1,padding:"10px",borderRadius:10,border:"1.5px solid #94a3b8",background:"white",color:"#334155",cursor:"pointer",fontSize:12,fontWeight:700}}>Tolak Hapus</button></div></>}
    </div>}

    {/* TIMKOM / KASUBBAG_KOMINFO PENUGASAN */}
    {(role==="timkom"||role==="kasubbag_komdokpim")&&ev.alur==="disetujui"&&<div style={{marginBottom:8}}>
      <button onClick={()=>setPenugasanEv(ev)} style={{width:"100%",padding:"10px",borderRadius:10,border:"1.5px dashed #7dd3fc",background:"#f0f9ff",color:"#0369a1",cursor:"pointer",fontSize:12,fontWeight:700}}>
        {(!ev.personil||ev.personil.length===0)?"👥 Tugaskan Personil":"👥 Edit Penugasan ("+(ev.personil?.length||0)+" personil)"}
      </button>
    </div>}

    {/* WALI KOTA */}
    {(role==="walikota"||(role==="ajudan_walikota"&&ev.untukPimpinan.includes("walikota")))&&ev.alur==="disetujui"&&ev.untukPimpinan.includes("walikota")&&<WKKehadiran ev={ev} upd={upd} showT={showT} setDelegTarget={setDelegTarget} role={role}/>}

    {/* WAKIL WALI KOTA — dan ajudan bisa input kehadiran WWK */}
    {(role==="wakilwalikota"||(role==="ajudan_wakilwalikota"&&(ev.untukPimpinan.includes("wakilwalikota")||ev.delegasiKeWWK)))&&ev.alur==="disetujui"&&(ev.untukPimpinan.includes("wakilwalikota")||ev.delegasiKeWWK)&&<WWKKehadiran ev={ev} upd={upd} showT={showT} setDelegTarget={setDelegTarget} role={role}/>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════
// FITUR 3: TIMELINE VISUAL
// ═══════════════════════════════════════════════════════════════
function TimelineView({evList}){
  const {expandedId,setExp,getHari,todayStr}=React.useContext(AppCtx);
  const [showPast,setShowPast]=React.useState(false);
  const now=new Date();
  const nowStr=now.toISOString().slice(0,16).replace("T"," ");
  const toMin=t=>{const[h,m]=(t||"00:00").split(":");return parseInt(h)*60+parseInt(m);};
  const nowMin=now.getHours()*60+now.getMinutes();

  // Pisah upcoming (termasuk sekarang) dan past, sort masing-masing
  const upcoming=[...evList.filter(e=>(e.tanggal+" "+e.jam)>=nowStr)]
    .sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));
  const past=[...evList.filter(e=>(e.tanggal+" "+e.jam)<nowStr)]
    .sort((a,b)=>(b.tanggal+b.jam).localeCompare(a.tanggal+a.jam)); // terbaru di atas

  const fmtTgl=t=>{
    const d=new Date(t+"T00:00:00");
    const hr=getHari(t);
    const day=d.getDate();
    const bulan=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][d.getMonth()];
    const thn=d.getFullYear();
    return hr.slice(0,3)+", "+day+" "+bulan+" "+thn;
  };

  const renderCard=(ev,i,arr)=>{
    const evMin=toMin(ev.jam);
    const isPast=(ev.tanggal+" "+ev.jam)<nowStr;
    const isNow=ev.tanggal===todayStr()&&Math.abs(evMin-nowMin)<60;
    const isFuture=!isPast&&!isNow;
    const isToday=ev.tanggal===todayStr();
    // Tampilkan pemisah tanggal jika berbeda dari item sebelumnya
    const prevTgl=i>0?arr[i-1].tanggal:null;
    const showDateSep=ev.tanggal!==prevTgl;

    return <React.Fragment key={ev.id}>
      {/* Pemisah tanggal */}
      {showDateSep&&<div style={{display:"flex",alignItems:"center",gap:8,margin:"10px 0 8px",marginLeft:-4}}>
        <div style={{width:20,height:20,borderRadius:"50%",background:isToday?"linear-gradient(135deg,#0A1628,#1E3254)":"#E8EDF4",
          border:"2px solid "+(isToday?"#C9A84C":"#CBD5E1"),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:isToday?"#C9A84C":"#94A3B8"}}/>
        </div>
        <span style={{fontSize:11,fontWeight:800,color:isToday?"#0A1628":"#64748B",letterSpacing:0.3,
          background:isToday?"linear-gradient(90deg,#FEF9EC,transparent)":isPast?"transparent":"#F8FAFF",
          padding:isToday?"3px 8px":"0",borderRadius:6,
          borderLeft:isToday?"3px solid #C9A84C":"none",paddingLeft:isToday?"8px":"0"}}>
          {isToday?"● HARI INI — "+fmtTgl(ev.tanggal):fmtTgl(ev.tanggal)}
        </span>
      </div>}
      <div style={{position:"relative",marginBottom:i<arr.length-1?6:0,animation:"upSpring 0.35s ease both",animationDelay:(i*0.04)+"s"}}>
        {/* Dot */}
        <div style={{position:"absolute",left:-22,top:16,width:12,height:12,borderRadius:"50%",
          background:isNow?"linear-gradient(135deg,#C9A84C,#E8C86A)":isPast?"#E2E8F0":NAVY,
          border:"2px solid white",
          boxShadow:isNow?"0 0 0 4px rgba(201,168,76,0.2)":"0 0 0 3px #F0F4FA",
          zIndex:2}}/>
        {isNow&&<div style={{position:"absolute",left:-46,top:12,fontSize:8,fontWeight:800,color:"#C9A84C",
          letterSpacing:0.5,transform:"rotate(-90deg)",transformOrigin:"center"}}>NOW</div>}
        <div onClick={()=>setExp(expandedId===ev.id?null:ev.id)} style={{
          background:"white",borderRadius:14,padding:"11px 14px",cursor:"pointer",
          border:"1.5px solid "+(isNow?"#C9A84C":isPast?"#F1F5F9":"#E8EDF4"),
          boxShadow:isNow?"0 4px 16px rgba(201,168,76,0.15)":"0 1px 4px rgba(0,0,0,0.04)",
          transition:"all 0.15s ease"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {/* Jam box */}
            <div style={{background:isNow?"linear-gradient(135deg,#0A1628,#1E3254)":isPast?"#F8FAFC":"#F0F4FF",
              borderRadius:9,padding:"5px 8px",textAlign:"center",minWidth:44,flexShrink:0}}>
              <div style={{fontSize:13,fontWeight:900,color:isNow?"#C9A84C":isPast?"#94A3B8":"#0A1628",lineHeight:1}}>{ev.jam}</div>
              <div style={{fontSize:8,color:isNow?"rgba(201,168,76,0.7)":isPast?"#CBD5E1":"#94A3B8",fontWeight:700,marginTop:1}}>WITA</div>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:isPast?"#94A3B8":"#0F172A",lineHeight:1.3,
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.namaAcara}</div>
              <div style={{fontSize:11,color:isPast?"#CBD5E1":"#64748B",marginTop:2,
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {ev.penyelenggara}{ev.lokasi?" · "+ev.lokasi:""}
              </div>
            </div>
            {isNow&&<span style={{fontSize:9,background:"linear-gradient(90deg,#0A1628,#1B4080)",color:"#C9A84C",
              borderRadius:4,padding:"2px 7px",fontWeight:800,flexShrink:0,animation:"pulse 2s ease infinite"}}>Berlangsung</span>}
            {isFuture&&<span style={{fontSize:11,color:"#CBD5E1",flexShrink:0}}>▼</span>}
          </div>
        </div>
        {expandedId===ev.id&&<div style={{marginTop:4}}><ExpandedDetail ev={ev} hariEv={getHari(ev.tanggal)}/></div>}
      </div>
    </React.Fragment>;
  };

  return <div style={{position:"relative",paddingLeft:28}}>
    {/* Garis vertikal */}
    <div style={{position:"absolute",left:11,top:0,bottom:0,width:2,background:"linear-gradient(to bottom,#0A1628 0%,#E2E8F0 40%,#F1F5F9 100%)",borderRadius:2}}/>

    {/* Empty state */}
    {upcoming.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:"#94A3B8"}}>
      <div style={{fontSize:36,marginBottom:8}}>✅</div>
      <div style={{fontSize:13,fontWeight:600,color:"#475569"}}>Tidak ada agenda mendatang</div>
    </div>}

    {/* Agenda mendatang */}
    {upcoming.map((ev,i)=>renderCard(ev,i,upcoming))}

    {/* Tombol lihat agenda lampau */}
    {past.length>0&&<div style={{marginTop:16,marginBottom:4}}>
      <button onClick={()=>setShowPast(p=>!p)} style={{
        display:"flex",alignItems:"center",gap:8,width:"100%",padding:"10px 14px",
        borderRadius:12,border:"1.5px dashed #CBD5E1",background:"#F8FAFC",
        color:"#64748B",cursor:"pointer",fontSize:12,fontWeight:700,
        transition:"all 0.15s"}}>
        <div style={{width:12,height:12,borderRadius:"50%",background:"#CBD5E1",flexShrink:0}}/>
        <span style={{flex:1,textAlign:"left"}}>
          {showPast?"▲ Sembunyikan":"▼ Lihat"} {past.length} agenda yang sudah berlalu
        </span>
        <span style={{fontSize:10,background:"#E2E8F0",borderRadius:20,padding:"2px 8px",color:"#94A3B8"}}>
          {past.length}
        </span>
      </button>
      {showPast&&<div style={{marginTop:8,opacity:0.8}}>
        {past.map((ev,i)=>renderCard(ev,i,past))}
      </div>}
    </div>}
  </div>;
}

export default function App(){
  const width=useWindowWidth();const isMobile=width<768;
  const[user,setUser]=useState(null);const role=user?.role||null;
  const[loginForm,setLF]=useState({username:"",password:""});const[loginErr,setLE]=useState("");const[showPass,setShowPass]=useState(false);
  const[bioLoading,setBioLoading]=useState(false);const[bioErr,setBioErr]=useState("");
  const[events,setEvents]=useState([]);const[dbReady,setDbReady]=useState(false);const[dbError,setDbError]=useState("");
  const[tab,setTab]=useState("jadwal");const[form,setForm]=useState(emptyForm);const[editId,setEditId]=useState(null);
  const[toast,setToast]=useState(null);const[confirmDlg,setConfirmDlg]=useState(null);const[showOnboarding,setShowOnboarding]=useState(false);const[filterDate,setFDate]=useState("");const[filterFrom,setFilterFrom]=useState("");const[filterTo,setFilterTo]=useState("");const[showRangeFilter,setShowRangeFilter]=useState(false);const[searchQ,setSearchQ]=useState("");const[showSearch,setShowSearch]=useState(false);
  const[showAI,setShowAI]=useState(false);const[showReport,setShowReport]=useState(false);const[showSummary,setShowSummary]=useState(false);const[showAdmin,setShowAdmin]=useState(false);const[showProfile,setShowProfile]=useState(false);const[showLaporan,setShowLaporan]=useState(false);const[showBroadcast,setShowBroadcast]=useState(false);
  const[showForgot,setShowForgot]=useState(false);const[showRegister,setShowRegister]=useState(false);const[pendingRegs,setPendingRegs]=useState(()=>loadPendingRegs());
  const[loginLoading,setLoginLoading]=useState(false);const[loginPhase,setLoginPhase]=useState("");
  const[delegTarget,setDelegTarget]= useState(null);const[expandedId,setExp]=useState(null);const[rejectTexts,setRT]=useState({});const[catatanInput,setCatatanInput]=useState({});const[penugasanEv,setPenugasanEv]=useState(null);const[notifPenugasan,setNotifPenugasan]=useState([]);const[evaluasiEv,setEvaluasiEv]=useState(null);const[showMobMenu,setMobMenu]=useState(false);const[showNotifCenter,setShowNotifCenter]=useState(false);
  const undanganRef=useRef({});
  // ── UX & Security States ──
  const[sessionWarn,setSessionWarn]=useState(false);
  const[isOffline,setIsOffline]=useState(!navigator.onLine);
  const[showScrollTop,setShowScrollTop]=useState(false);
  const[lockSeconds,setLockSeconds]=useState(0);
  const[pullRefreshing,setPullRefreshing]=useState(false);
  const[morningDismissed,setMorningDismissed]=useState(false);
  const[viewMode,setViewMode]=useState("cards");

  // Session restore dilakukan di boot() useEffect di atas

  const doLogin=async()=>{
    setLE("");
    const lockLeft=isLoginLocked();
    if(lockLeft>0){setLE("Terlalu banyak percobaan. Silakan tunggu "+Math.ceil(lockLeft/60)+" menit lagi.");setLockSeconds(lockLeft);return;}
    if(!loginForm.username.trim()||!loginForm.password){setLE("Silakan isi username dan password Anda.");return;}
    const users=loadUsers();
    const candidate=users.find(u=>u.username===loginForm.username.toLowerCase().trim());
    if(!candidate){recordLoginAttempt(false);setLE("Username atau password tidak sesuai. Silakan coba lagi.");return;}
    const ok=await verifyPassword(loginForm.password,candidate.password);
    if(!ok){recordLoginAttempt(false);const att=getLoginAttempts();const remain=LOGIN_MAX_ATTEMPTS-att.count;if(remain>0&&remain<=2)setLE("Password tidak sesuai. "+remain+" percobaan tersisa sebelum akun dikunci sementara.");else setLE("Username atau password tidak sesuai. Silakan coba lagi.");return;}
    recordLoginAttempt(true);touchActivity();
    setLoginLoading(true);
    setLoginPhase("Memverifikasi identitas...");
    await new Promise(r=>setTimeout(r,600));
    setLoginPhase("Memuat data jadwal...");
    await new Promise(r=>setTimeout(r,700));
    setLoginPhase("Menyiapkan dashboard...");
    await new Promise(r=>setTimeout(r,500));
    setLoginLoading(false);
    setUser(candidate);setTab(["ajudan_walikota","ajudan_wakilwalikota"].includes(candidate.role)?"ajudan":["kabag","kasubbag_protokol","kasubbag_komdokpim"].includes(candidate.role)?"dashboard":candidate.role==="mitra_kerja"?"mitra":"jadwal");
    try{const seen=JSON.parse(localStorage.getItem("jp_seen_onboarding")||"{}");if(!seen[candidate.username]){setShowOnboarding(true);}}catch{}
    try{localStorage.setItem("jp_session",JSON.stringify({username:candidate.username}));}catch{}
    registerPush(candidate.username,candidate.role);
  };
  const doBioLogin=async()=>{
    const un=loginForm.username.toLowerCase().trim();if(!un){setLE("Silakan isi username terlebih dahulu.");return;}
    const u=loadUsers().find(u=>u.username===un);if(!u){setLE("Username tidak ditemukan.");return;}
    if(!bioIsRegistered(un)){setBioErr("Biometrik belum didaftarkan untuk akun ini. Login dengan password terlebih dahulu, lalu daftarkan biometrik di Pengaturan Akun.");return;}
    setBioLoading(true);setBioErr("");
    try{
      await bioAuthenticate(un);touchActivity();
      setLoginLoading(true);setLoginPhase("Memverifikasi biometrik...");
      await new Promise(r=>setTimeout(r,600));
      setLoginPhase("Memuat data jadwal...");
      await new Promise(r=>setTimeout(r,700));
      setLoginPhase("Menyiapkan dashboard...");
      await new Promise(r=>setTimeout(r,500));
      setLoginLoading(false);
      setUser(u);setTab("jadwal");try{localStorage.setItem("jp_session",JSON.stringify({username:un}));}catch{}registerPush(un,u.role);}
    catch(e){setBioErr("Verifikasi biometrik gagal. Silakan coba lagi atau gunakan password.");}
    setBioLoading(false);
  };
  const doLogout=(reason)=>{setUser(null);setSessionWarn(false);try{localStorage.removeItem("jp_session");}catch{}if(reason==="timeout")setLE("Sesi Anda berakhir karena tidak aktif selama 12 jam. Silakan login kembali.");};

  useEffect(()=>{
    // Load users DAN events bersamaan dari Supabase
    const boot=async()=>{
      // 1. Init users (Supabase → localStorage → default)
      await initUsers().catch(e=>console.warn("initUsers error:",e));
      // 2. Restore session setelah users tersedia
      try{
        const s=localStorage.getItem("jp_session");
        if(s){const d=JSON.parse(s);const u=loadUsers().find(u=>u.username===d.username);if(u)setUser(u);}
      }catch{}
      // 3. Load events
      if(SUPA_OK){
        try{const rows=await dbLoadAll();setEvents(rows&&rows.length>0?rows:seed);}
        catch(err){setDbError(err.message);setEvents(seed);}
      } else {setEvents(seed);}
      setDbReady(true);
    };
    boot();
  },[]);

  useEffect(()=>{setSearchQ("");setShowSearch(false);},[tab]);

  // ── UX: Keyboard Shortcuts ──
  useEffect(()=>{
    const onKey=e=>{
      // Escape → tutup modal/drawer teratas
      if(e.key==="Escape"){
        if(confirmDlg){setConfirmDlg(null);return;}
        if(showMobMenu){setMobMenu(false);return;}
        if(showProfile){setShowProfile(false);return;}
        if(showAdmin){setShowAdmin(false);return;}
        if(showReport){setShowReport(false);return;}
        if(showSummary){setShowSummary(false);return;}
        if(showBroadcast){setShowBroadcast(false);return;}
        if(showLaporan){setShowLaporan(false);return;}
        if(showAI){setShowAI(false);return;}
        if(showForgot){setShowForgot(false);return;}
        if(showRegister){setShowRegister(false);return;}
        if(penugasanEv){setPenugasanEv(null);return;}
        if(evaluasiEv){setEvaluasiEv(null);return;}
        if(showNotifCenter){setShowNotifCenter(false);return;}
        if(showSearch){setShowSearch(false);setSearchQ("");return;}
      }
      // Ctrl+K atau / → buka search (jika tidak sedang mengetik di input)
      if((e.key==="k"&&(e.ctrlKey||e.metaKey))||(e.key==="/"&&!["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))){
        e.preventDefault();setShowSearch(true);
      }
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[confirmDlg,showMobMenu,showProfile,showAdmin,showReport,showSummary,showBroadcast,showLaporan,showAI,showForgot,showRegister,penugasanEv,evaluasiEv,showNotifCenter,showSearch]);

  // ── KEAMANAN: Session Timeout Watcher (12 jam) ──
  useEffect(()=>{
    if(!user)return;
    const evts=["mousedown","mousemove","keydown","scroll","touchstart","click"];
    const onActivity=()=>{touchActivity();setSessionWarn(false);};
    evts.forEach(e=>window.addEventListener(e,onActivity,{passive:true}));
    const checker=setInterval(()=>{
      const idle=Date.now()-_lastActivity;
      if(idle>SESSION_TIMEOUT_MS){doLogout("timeout");}
      else if(idle>SESSION_TIMEOUT_MS-5*60*1000){setSessionWarn(true);}
      else{setSessionWarn(false);}
    },30000);
    return()=>{evts.forEach(e=>window.removeEventListener(e,onActivity));clearInterval(checker);};
  },[user]);

  // ── UX: Online/Offline Detection ──
  useEffect(()=>{
    const goOn=()=>setIsOffline(false);const goOff=()=>setIsOffline(true);
    window.addEventListener("online",goOn);window.addEventListener("offline",goOff);
    return()=>{window.removeEventListener("online",goOn);window.removeEventListener("offline",goOff);};
  },[]);

  // ── UX: Scroll-to-top visibility ──
  useEffect(()=>{
    const onScroll=()=>setShowScrollTop(window.scrollY>400);
    window.addEventListener("scroll",onScroll,{passive:true});
    return()=>window.removeEventListener("scroll",onScroll);
  },[]);

  // ── KEAMANAN: Lockout countdown timer ──
  useEffect(()=>{
    if(lockSeconds<=0)return;
    const t=setInterval(()=>{const left=isLoginLocked();setLockSeconds(left);if(left<=0){clearInterval(t);setLE("");}},1000);
    return()=>clearInterval(t);
  },[lockSeconds]);

  // ── UX: Pull-to-refresh (mobile) ──
  useEffect(()=>{
    if(!user||!isMobile)return;
    let startY=0,pulling=false;
    const onTS=e=>{if(window.scrollY<=0){startY=e.touches[0].clientY;pulling=true;}};
    const onTM=e=>{
      if(!pulling)return;
      const diff=e.touches[0].clientY-startY;
      if(diff>90&&!pullRefreshing){
        pulling=false;setPullRefreshing(true);
        (async()=>{
          try{if(SUPA_OK){const rows=await dbLoadAll();if(rows&&rows.length>0)setEvents(rows);}}catch{}
          setTimeout(()=>{setPullRefreshing(false);showT("Data diperbarui ✓");},600);
        })();
      }
    };
    const onTE=()=>{pulling=false;};
    window.addEventListener("touchstart",onTS,{passive:true});
    window.addEventListener("touchmove",onTM,{passive:true});
    window.addEventListener("touchend",onTE,{passive:true});
    return()=>{window.removeEventListener("touchstart",onTS);window.removeEventListener("touchmove",onTM);window.removeEventListener("touchend",onTE);};
  },[user,isMobile,pullRefreshing]);

  // ── Realtime: poll Supabase setiap 10 detik ──
  React.useEffect(()=>{
    if(!SUPA_OK||!user)return;
    const poll=async()=>{
      try{
        const rows=await dbLoadAll();
        if(rows&&rows.length>0){
          setEvents(prev=>{
            const prevStr=JSON.stringify(prev.map(e=>e.id+e.alur+(e.alurHapus||"")));
            const newStr=JSON.stringify(rows.map(e=>e.id+e.alur+(e.alurHapus||"")));
            return prevStr===newStr?prev:rows;
          });
        }
      }catch{}
    };
    const interval=setInterval(poll,10000);
    return ()=>clearInterval(interval);
  },[user]);

  const showT=(msg,type="ok")=>{if(type==="ok")haptic(40);else if(type==="warn")haptic(80);else if(type==="error")haptic([50,30,50]);setToast({msg,type});setTimeout(()=>setToast(null),type==="error"?5000:type==="warn"?4000:3000);};
  _toast.fn=showT; // bridge for components without showT prop
  const updAndSync=useCallback((id,patch)=>{setEvents(p=>{const next=p.map(e=>e.id===id?{...e,...patch}:e);const ev=next.find(e=>e.id===id);if(ev)dbUpsert(ev).catch(console.error);return next;});},[]);
  const askConfirm=(title,body,onConfirm,confirmLabel="Ya, Lanjutkan",confirmColor="#DC2626")=>{
    setConfirmDlg({title,body,onConfirm,confirmLabel,confirmColor});
  };

  const deleteAndSync=useCallback((id)=>{setEvents(p=>{const ev=p.find(e=>e.id===id);if(ev?.sambutanFile&&!ev.sambutanFile.startsWith("data:"))storageDelete("sambutan",ev.sambutanFile).catch(e=>console.warn("Sync:",e?.message||e));if(ev?.undanganFile&&!ev.undanganFile.startsWith("data:"))storageDelete("undangan",ev.undanganFile).catch(e=>console.warn("Sync:",e?.message||e));dbDelete(id).catch(console.error);return p.filter(e=>e.id!==id);});},[]);
  const upd=(id,patch)=>updAndSync(id,patch);
  const getNamaByUsername=un=>loadUsers().find(u=>u.username===un)?.nama||un;

  // ── DOCX → PDF via /api/sambutan ──
  const handleSambutanDocx=useCallback(async(evId,file,ev)=>{
    // 1. Baca DOCX sebagai base64
    const docxBase64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});
    // 2. Kirim ke /api/sambutan
    const resp=await fetch("/api/sambutan",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({docxBase64,namaAcara:ev.namaAcara,tanggal:ev.tanggal,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi||""})
    });
    if(!resp.ok){const e=await resp.json().catch(()=>({}));throw new Error(e.error||"Gagal konversi");}
    const {pdfBase64,fileName}=await resp.json();
    // 3. Upload ke Supabase storage
    const pdfName=fileName+".pdf";
    const docxName=fileName+".docx";
    let pdfUrl=null,docxUrl=null;
    if(SUPA_OK){
      // Upload PDF
      const pdfBlob=new Blob([Uint8Array.from(atob(pdfBase64),ch=>ch.charCodeAt(0))],{type:"application/pdf"});
      const pdfFile=new File([pdfBlob],pdfName,{type:"application/pdf"});
      pdfUrl=await storageUpload("sambutan",evId+"/pdf",pdfFile).catch(()=>null);
      // Upload DOCX asli
      const docxFile=new File([file],docxName,{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
      docxUrl=await storageUpload("sambutan",evId+"/docx",docxFile).catch(()=>null);
    }
    // Fallback ke data-URI jika storage belum aktif
    if(!pdfUrl) pdfUrl="data:application/pdf;base64,"+pdfBase64;
    if(!docxUrl) docxUrl=URL.createObjectURL(file);
    updAndSync(evId,{sambutanFile:pdfUrl,sambutanNama:pdfName,sambutanDocx:docxUrl,sambutanDocxNama:docxName});
    return {pdfBase64,pdfUrl};
  },[updAndSync]);

  const handleSambutanUpload=useCallback(async(evId,file,name)=>{
    if(SUPA_OK){const url=await storageUpload("sambutan",evId,file);if(url){updAndSync(evId,{sambutanFile:url,sambutanNama:name});return;}}
    const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsDataURL(file);});updAndSync(evId,{sambutanFile:b64,sambutanNama:name});
  },[updAndSync]);

  // ── Simpan penugasan personil ──
  // ── Simpan evaluasi pasca kegiatan ──
  const saveEvaluasi=(evId, entry)=>{
    const ev=events.find(e=>e.id===evId);
    const existing=ev?.evaluasi||{};
    const updated={...existing,[user.username]:entry};
    upd(evId,{evaluasi:updated});
    showT("Evaluasi berhasil dikirim ✓");
  };

    const savePenugasan=async(evId,personilArr,catatanPenugasan)=>{
    upd(evId,{personil:personilArr,catatanPenugasan});
    setPenugasanEv(null);
    showT("Penugasan disimpan untuk "+personilArr.length+" personil ✓");
    // Kirim notifikasi push + WA ke masing-masing personil
    const ev=events.find(e=>e.id===evId);
    for(const un of personilArr){
      const u=loadUsers().find(x=>x.username===un);
      if(u){
        await sendPush({targetRole:u.role,title:"📋 Anda Ditugaskan",body:ev?.namaAcara+" · "+ev?.tanggal+" "+ev?.jam+" WITA"+(catatanPenugasan?" · "+catatanPenugasan:""),url:"/",tag:"penugasan-"+evId+"-"+un});
        // WA langsung ke personil (selalu, bukan hanya darurat)
        if(u.noWA){
          // Kirim WA penugasan langsung hanya jika:
          // - Event BUKAN besok (jadwal hari ini/lusa → langsung), ATAU
          // - Event besok tapi sudah lewat 16:10 WITA (batch sudah jalan)
          const _nowWITA=new Date(Date.now()+8*60*60*1000);
          const _h=_nowWITA.getUTCHours(),_m=_nowWITA.getUTCMinutes();
          const _totalMin=_h*60+_m;
          const _tmrw=new Date(Date.now()+8*60*60*1000+24*60*60*1000).toISOString().slice(0,10);
          const _isBatchWindow=_totalMin>=7*60+25&&_totalMin<16*60+10;
          const _skipWA=ev?.tanggal===_tmrw&&_isBatchWindow;
          if(!_skipWA){
            const _rekan=(ev?.personil||[]).filter(x=>x!==un).map(x=>{const _xu=loadUsers().find(lu=>lu.username===x);return _xu?.nama||x;});
            sendWA({to:u.noWA,namaAcara:ev?.namaAcara,tanggal:ev?.tanggal,jam:ev?.jam,penyelenggara:ev?.penyelenggara,lokasi:ev?.lokasi,event:"penugasan",namaPersonil:u.nama,catatanPenugasan:catatanPenugasan||"",rekanBertugas:_rekan});
          }
        }
      }
    }
    // ── WA darurat ke staf jika acara < 6 jam lagi ──────────────────────
    if(ev&&personilArr.length>0){
      try{
        await fetch("/api/notif-penugasan",{
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":"Bearer "+(window.__CRON_SECRET||"")},
          body:JSON.stringify({
            evId,
            namaAcara:ev.namaAcara,
            tanggal:ev.tanggal,
            jam:ev.jam,
            lokasi:ev.lokasi||"",
            pakaian:ev.pakaian||"",
            penyelenggara:ev.penyelenggara||"",
            catatanPenugasan:catatanPenugasan||"",
            personil:personilArr,
            pimpinan:ev.untukPimpinan||[],
            delegasiKeWWK:ev.delegasiKeWWK||false,
          })
        });
      }catch(e){console.warn("notif-penugasan API error:",e);}
    }
  };

  // ── Cek jadwal belum ditugaskan (notif H-12) ──
  React.useEffect(()=>{
    if(!["kasubbag_protokol","kasubbag_komdokpim","timkom"].includes(role))return;
    const now=new Date();
    const unassigned=events.filter(ev=>{
      if(ev.alur!=="disetujui")return false;
      const evTime=new Date(ev.tanggal+"T"+ev.jam);
      const hoursLeft=(evTime-now)/(1000*60*60);
      return hoursLeft>0&&hoursLeft<=12&&(!ev.personil||ev.personil.length===0);
    });
    setNotifPenugasan(unassigned);
  },[events,role]);

  const handleUndanganUpload=useCallback(async(evId,file,name)=>{
    if(SUPA_OK){const url=await storageUpload("undangan",evId,file);if(url){updAndSync(evId,{undanganFile:url,undanganNama:name});return;}}
    const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsDataURL(file);});updAndSync(evId,{undanganFile:b64,undanganNama:name});
  },[updAndSync]);

  const getVisible=()=>{
    if(tab==="tayang"){
      const ws=weekStart(),we=weekEnd();
      return events.filter(e=>{
        if(e.alur!=="disetujui")return false;
        if(filterDate==="range")return(!filterFrom||e.tanggal>=filterFrom)&&(!filterTo||e.tanggal<=filterTo);
        if(filterDate==="week")return e.tanggal>=ws&&e.tanggal<=we;
        if(filterDate)return e.tanggal===filterDate;
        return true;
      }).sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));
    }
    let base=events;
    // Staf: lihat semua jadwal disetujui sebagai konteks agenda mendatang
    // Admin RK: lihat draft milik sendiri + semua disetujui
    if(role==="staf"){
      const base=events.filter(e=>e.alur==="disetujui");
      const filtered=filterDate?base.filter(e=>e.tanggal===filterDate):base;
      return filtered.sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));
    }
    if(role==="admin_rk"){
      const base=events.filter(e=>e.alur==="disetujui"||e.submittedBy===user.username);
      const filtered=filterDate?base.filter(e=>e.tanggal===filterDate):base;
      return filtered.sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));
    }
    if(role==="walikota")base=events.filter(e=>e.untukPimpinan.includes("walikota")&&e.alur==="disetujui");
    else if(role==="wakilwalikota")base=events.filter(e=>e.alur==="disetujui"&&(e.untukPimpinan.includes("wakilwalikota")||e.delegasiKeWWK));
    else if(role==="ajudan_walikota"||role==="ajudan_wakilwalikota")base=events.filter(e=>e.alur==="disetujui");
    else if(role==="timkom")base=events.filter(e=>e.alur!=="ditolak");
    else if(role==="mitra_kerja")base=events.filter(e=>e.alur==="disetujui");
    else if(role==="kasubbag_protokol"||role==="kasubbag_komdokpim")
      base=tab==="semua"?events:tab==="tayang"?events.filter(e=>e.alur==="disetujui"):events.filter(e=>e.alur==="menunggu_kasubbag"||(e.alurHapus&&e.alur==="disetujui"));
    else if(role==="kabag")
      base=tab==="semua"?events:tab==="tayang"?events.filter(e=>e.alur==="disetujui"):events.filter(e=>e.alur==="menunggu_kabag"||(e.alurHapus==="menunggu_kabag"));
    if(filterDate==="range"&&(filterFrom||filterTo)){
      base=base.filter(e=>(!filterFrom||e.tanggal>=filterFrom)&&(!filterTo||e.tanggal<=filterTo));
    }else if(filterDate==="week"){
      const ws=weekStart(),we=weekEnd();base=base.filter(e=>e.tanggal>=ws&&e.tanggal<=we);
    }else if(filterDate){
      base=base.filter(e=>e.tanggal===filterDate);
    }
    // Urutkan: yang belum lewat (mulai besok s/d mendatang) duluan, lalu lampau di bawah
    const nowStr=new Date().toISOString().slice(0,16).replace("T"," ");
    const upcoming2=base.filter(e=>(e.tanggal+" "+e.jam)>=nowStr).sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));
    const past2=base.filter(e=>(e.tanggal+" "+e.jam)<nowStr).sort((a,b)=>(b.tanggal+b.jam).localeCompare(a.tanggal+a.jam));
    return [...upcoming2,...past2];
  };
  const pendingList=events.filter(e=>{
    if(role==="kasubbag_protokol"||role==="kasubbag_komdokpim")return e.alur==="menunggu_kasubbag"||(e.alurHapus==="menunggu_kasubbag");if(role==="kabag")return e.alur==="menunggu_kabag"||(e.alurHapus==="menunggu_kabag");
    if(role==="timkom")return e.alur==="disetujui"&&!e.sambutanFile&&e.jenisKegiatan==="Sambutan";
    if(role==="walikota")return e.untukPimpinan.includes("walikota")&&e.alur==="disetujui"&&!e.statusWK;
    if(role==="wakilwalikota")return e.alur==="disetujui"&&(e.untukPimpinan.includes("wakilwalikota")||e.delegasiKeWWK)&&!e.statusWWK;
    return false;
  });
  const [pendingExpandTarget,setPendingExpandTarget]=React.useState(null);
  const goToPending=()=>{
    if(!pendingList.length)return;
    const targetId=pendingList[0].id;
    if(role==="walikota"||role==="wakilwalikota")setTab("jadwal");
    else if(role==="ajudan_walikota"||role==="ajudan_wakilwalikota")setTab("ajudan");
    else if(KASUBBAG_ROLES.includes(role)||role==="kabag")setTab("jadwal");
    else if(role==="admin_rk")setTab("draft");
    else setTab("jadwal");
    setFDate("");
    setExp(targetId);
    setPendingExpandTarget(targetId);
    setTimeout(()=>{
      const el=document.getElementById("ev-"+targetId);
      if(el)el.scrollIntoView({behavior:"smooth",block:"center"});
    },400);
  };

  const submit=async()=>{
    if(!form.namaAcara||!form.tanggal||!form.jam){showT("Nama acara, tanggal & jam wajib diisi.","error");return;}if(!form.untukPimpinan||!form.untukPimpinan.length){showT("Pilih tujuan undangan (Wali Kota dan/atau Wakil Wali Kota) sebelum menyimpan.","error");return;}
    const conflict=hasConflict(events,{...form,id:editId||0,alur:"disetujui"});
    if(editId!==null){const evSebelum=events.find(e=>e.id===editId);setEvents(p=>{const next=p.map(e=>e.id===editId?{...e,...form}:e);const u=next.find(e=>e.id===editId);if(u)dbUpsert(u).catch(console.error);return next;});
      // Jika jadwal sebelumnya ditolak → otomatis kirim ulang ke Kasubbag
      if(evSebelum?.alur==="ditolak"){
        upd(editId,{alur:"menunggu_kasubbag",catatanTolak:"",_requiresEdit:false});
        showT("Jadwal diperbaiki & dikirim ulang ke Kasubbag","ok");
        loadUsers().filter(u=>(u.role==="kasubbag_protokol")&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:form.namaAcara,tanggal:form.tanggal,jam:form.jam,penyelenggara:form.penyelenggara,lokasi:form.lokasi,event:"submit",submittedBy:user?.nama}));
        sendPush({targetRole:"kasubbag_protokol",title:"📋 Jadwal Dikirim Ulang",body:form.namaAcara,url:"/",tag:"resubmit-"+editId});sendPush({targetRole:"kasubbag_komdokpim",title:"📋 Jadwal Dikirim Ulang",body:form.namaAcara,url:"/",tag:"resubmit-"+editId});
      } else {
        showT("Jadwal diperbarui");
      }
      setEditId(null);
      // Notif WA jika jadwal sudah disetujui (tayang) yang diedit
      if(evSebelum?.alur==="disetujui"){const _allU=loadUsers();const _editor=user?.nama||user?.username||"Admin";// Notif ke ajudan yang relevan
        _allU.filter(u=>(u.role==="ajudan_walikota"||u.role==="ajudan_wakilwalikota")&&u.noWA).forEach(u=>{const _isWK=u.role==="ajudan_walikota"&&(evSebelum.untukPimpinan||[]).includes("walikota");const _isWWK=u.role==="ajudan_wakilwalikota"&&((evSebelum.untukPimpinan||[]).includes("wakilwalikota")||evSebelum.delegasiKeWWK);if(_isWK||_isWWK)sendWA({to:u.noWA,namaAcara:form.namaAcara,tanggal:form.tanggal,jam:form.jam,penyelenggara:form.penyelenggara,lokasi:form.lokasi,event:"jadwal_diubah",namaEditor:_editor});});// Notif ke personil yang ditugaskan
        (evSebelum.personil||[]).forEach(un=>{const _u=_allU.find(x=>x.username===un);if(_u?.noWA)sendWA({to:_u.noWA,namaAcara:form.namaAcara,tanggal:form.tanggal,jam:form.jam,penyelenggara:form.penyelenggara,lokasi:form.lokasi,event:"jadwal_diubah",namaEditor:_editor});});
      }
    }
    else{const n={...form,id:Date.now(),alur:"draft",submittedBy:user?.username,catatanTolak:"",statusWK:null,statusWWK:null,perwakilanWK:"",perwakilanWWK:"",delegasiKeWWK:false,besertaIstriWK:!!form.besertaIstriWK,besertaIstriWWK:!!form.besertaIstriWWK,sambutanFile:null,sambutanNama:"",catatanPimpinan:"",tersembunyi:false,alurHapus:null};setEvents(p=>[...p,n]);dbUpsert(n).catch(console.error);if(conflict)showT("Potensi tabrakan jadwal!","warn");else showT("Draft disimpan. Kirim ke Kasubbag.");
      // ── Notif WA ke Ajudan jika undangan masuk setelah 16.00 WITA ───
      const jamWITA=new Date().getUTCHours()+8;const jamLokal=jamWITA>=24?jamWITA-24:jamWITA;
      if(jamLokal>=16){
        const tgtRoles=[];
        if((form.untukPimpinan||[]).includes("walikota"))tgtRoles.push("ajudan_walikota");
        if((form.untukPimpinan||[]).includes("wakilwalikota"))tgtRoles.push("ajudan_wakilwalikota");
        const allU=loadUsers();
        for(const tRole of tgtRoles){
          const ajudan=allU.filter(u=>u.role===tRole&&u.noWA);
          const labelPim=tRole==="ajudan_walikota"?"Wali Kota":"Wakil Wali Kota";
          for(const aj of ajudan){
            // undangan_sore: diganti dengan cron notif-ajudan (16:00 WITA)
          }
          await sendPush({targetRole:tRole,title:"🔔 Undangan Baru Masuk",body:form.namaAcara+" · "+form.tanggal+" "+form.jam+" WITA — Mohon konfirmasi ke "+labelPim,url:"/",tag:"undangan-sore-"+Date.now()});sendPush({targetRole:"kasubbag_protokol",title:"📋 Undangan Sore Masuk",body:form.namaAcara+" — "+form.tanggal+" "+form.jam+" WITA",url:"/",tag:"undangan-sore-ksbg-"+Date.now()});sendPush({targetRole:"kasubbag_komdokpim",title:"📋 Undangan Sore Masuk",body:form.namaAcara+" — "+form.tanggal+" "+form.jam+" WITA",url:"/",tag:"undangan-sore-ksbg2-"+Date.now()});
        }
      }
    }
    setForm(emptyForm);setTab(role==="admin_rk"?"draft":"jadwal");
  };

  // Palet konsisten: semua pakai navy, hanya aksen yang berbeda per peran
const TH={
  walikota:        {g:"linear-gradient(160deg,#0A1628 0%,#1A2F50 100%)",a:GOLD},
  wakilwalikota:   {g:"linear-gradient(160deg,#0A1628 0%,#0D2B1E 100%)",a:"#6EE7B7"},
  ajudan_walikota: {g:"linear-gradient(160deg,#0A1628 0%,#1E293B 100%)",a:"#93C5FD"},
  ajudan_wakilwalikota:{g:"linear-gradient(160deg,#0A1628 0%,#1E293B 100%)",a:"#86EFAC"},
  timkom:          {g:"linear-gradient(160deg,#0A1628 0%,#1A2F50 100%)",a:"#A5B4FC"},
  staf:            {g:"linear-gradient(160deg,#0A1628 0%,#1A2F50 100%)",a:GOLD},
  admin_rk:        {g:"linear-gradient(160deg,#0A1628 0%,#1A2F50 100%)",a:"#FCD34D"},
  kasubbag_protokol:   {g:"linear-gradient(160deg,#0A1628 0%,#1A2F50 100%)",a:"#FDE68A"},
  kasubbag_komdokpim:  {g:"linear-gradient(160deg,#0A1628 0%,#1A2F50 100%)",a:"#7DD3FC"},
  kabag:           {g:"linear-gradient(160deg,#0A1628 0%,#1A2F50 100%)",a:"#6EE7B7"},
};
  const th=TH[role]||TH.staf;
  const roleInfo=ALL_ROLE_DEFS.find(r=>r.key===role)||{icon:"circle",label:"",key:""};
  const kabagNama=loadUsers().find(u=>u.role==="kabag")?.nama||"Kabag Protokol & Komunikasi Pimpinan";
  const canReport=ROLES_WITH_REPORT.includes(role);
  const isStafAny=STAF_ROLES.includes(role);
  const isKasubbagAny=KASUBBAG_ROLES.includes(role);
  const listEvents=(()=>{
    const base=getVisible();
    if(!searchQ.trim())return base;
    const q=searchQ.trim().toLowerCase();
    return base.filter(e=>
      (e.namaAcara||"").toLowerCase().includes(q)||
      (e.penyelenggara||"").toLowerCase().includes(q)||
      (e.lokasi||"").toLowerCase().includes(q)||
      (e.catatan||"").toLowerCase().includes(q)||
      (e.pakaian||"").toLowerCase().includes(q)||
      (e.tanggal||"").includes(q)
    );
  })();
  const showForm=tab==="form"&&role==="admin_rk";
  const showPenugasan=tab==="penugasan";

  const CSS=`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
    html,body{margin:0;padding:0;width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%;background:#0A1628;scroll-behavior:smooth;}
    *{box-sizing:border-box;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;}
    input,select,textarea,button{font-family:inherit;}
    input[type=text],input[type=password],input[type=date],input[type=time],input[type=email],select,textarea{font-size:16px!important;-webkit-appearance:none;appearance:none;}
    a{-webkit-tap-highlight-color:transparent;color:inherit;}
    button{-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.15);border-radius:4px;}

    /* ── Reduced Motion ── */
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:0.01ms!important;animation-iteration-count:1!important;transition-duration:0.01ms!important;}}

    /* ── Keyframes ── */
    @keyframes up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes upSpring{0%{opacity:0;transform:translateY(20px) scale(0.97)}60%{transform:translateY(-3px) scale(1.005)}100%{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes slideIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
    @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
    @keyframes tapIn{0%{transform:scale(1)}50%{transform:scale(0.95)}100%{transform:scale(1)}}
    @keyframes gentleShake{0%,100%{transform:translateX(0)}15%,45%,75%{transform:translateX(-4px)}30%,60%,90%{transform:translateX(4px)}}
    @keyframes toastIn{0%{opacity:0;transform:translateY(-20px) translateX(-50%) scale(0.92)}60%{transform:translateY(4px) translateX(-50%) scale(1.02)}100%{opacity:1;transform:translateY(0) translateX(-50%) scale(1)}}
    @keyframes toastProgress{0%{width:100%}100%{width:0%}}
    @keyframes pullSpin{to{transform:rotate(360deg)}}

    /* ── Nav ── */
    .nav-btn{transition:all 0.18s cubic-bezier(0.34,1.56,0.64,1);border-radius:10px!important;}
    .nav-btn:hover{background:rgba(255,255,255,0.13)!important;opacity:1!important;transform:translateX(3px);}
    .nav-btn:active{transform:scale(0.97)!important;}
    .sidebar-link{transition:all 0.18s ease;}
    .sidebar-link:hover{background:rgba(255,255,255,0.11)!important;}

    /* ── Cards ── */
    .ev-card{transition:transform 0.18s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.18s ease;animation:upSpring 0.35s ease both;}
    .ev-card:active{transform:scale(0.985)!important;}
    .card-row{transition:background 0.12s;}
    .card-row:hover{background:#F5F8FF!important;}

    /* ── Buttons ── */
    .btn-ios{transition:all 0.15s cubic-bezier(0.34,1.56,0.64,1);}
    .btn-ios:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(10,22,40,0.22);}
    .btn-ios:active{transform:scale(0.96)!important;}
    .btn-primary{transition:all 0.15s ease;}
    .btn-primary:hover{opacity:0.88;transform:translateY(-1px);}
    .btn-primary:active{transform:scale(0.97);}
    button:disabled{opacity:0.5;cursor:not-allowed!important;transform:none!important;}

    /* ── Table ── */
    table.ev-table{width:100%;border-collapse:collapse;font-size:13px;}
    table.ev-table thead th{background:#F6F9FE;color:#64748B;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;padding:11px 14px;text-align:left;border-bottom:1.5px solid #E4EAF2;white-space:nowrap;}
    table.ev-table tbody td{padding:12px 14px;border-bottom:1px solid #F0F4FA;vertical-align:middle;}
    table.ev-table tbody tr{transition:background 0.15s ease;}
    table.ev-table tbody tr:hover td{background:#F5F8FF;}
    table.ev-table tbody tr:last-child td{border-bottom:none;}

    /* ── Chips & Badges ── */
    .chip{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.3px;white-space:nowrap;}
    .chip-wk{background:rgba(10,22,40,0.08);color:#0A1628;}
    .chip-wwk{background:#ECFDF5;color:#0D6B4F;}
    .badge-pill{display:inline-block;padding:3px 10px;border-radius:20px;font-size:10.5px;font-weight:700;white-space:nowrap;}

    /* ── Modals ── */
    .modal-overlay{position:fixed;inset:0;z-index:8100;background:rgba(5,12,25,0.65);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease;}
    @media(min-width:768px){.modal-overlay{align-items:center;padding:24px;}}
    .modal-box{background:white;border-radius:24px 24px 0 0;width:100%;max-width:600px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.2);animation:sheetUp 0.32s cubic-bezier(0.34,1.3,0.64,1);}
    @media(min-width:768px){.modal-box{border-radius:20px;animation:up 0.25s cubic-bezier(0.34,1.3,0.64,1);box-shadow:0 24px 60px rgba(0,0,0,0.25);}}
    .modal-handle{width:36px;height:4px;background:#E2E8F0;border-radius:4px;margin:10px auto 0;flex-shrink:0;}

    /* ── Forms ── */
    .form-section{background:white;border-radius:16px;padding:20px;box-shadow:0 2px 16px rgba(0,0,0,0.06);border:1px solid #E8EDF4;margin-bottom:14px;}
    .form-section h3{margin:0 0 14px;font-size:14px;font-weight:800;color:#0A1628;letter-spacing:-0.2px;}
    input:focus,select:focus,textarea:focus{outline:none;border-color:#0A1628!important;box-shadow:0 0 0 3px rgba(10,22,40,0.07)!important;transition:border-color 0.2s,box-shadow 0.2s;}
    button:focus-visible{outline:2px solid ${GOLD};outline-offset:2px;}
    input,select,textarea{transition:border-color 0.2s ease,box-shadow 0.2s ease;}

    /* ── iOS Tab Bar ── */
    .ios-tab-bar{position:fixed;bottom:0;left:0;right:0;z-index:300;background:rgba(248,250,255,0.88);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border-top:0.5px solid rgba(0,0,0,0.1);padding-bottom:env(safe-area-inset-bottom,0px);display:flex;}
    .ios-tab-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 4px 6px;border:none;background:transparent;cursor:pointer;-webkit-tap-highlight-color:transparent;gap:3px;transition:transform 0.15s cubic-bezier(0.34,1.56,0.64,1);}
    .ios-tab-btn:active{transform:scale(0.88);}
    .ios-tab-icon{font-size:22px;line-height:1;transition:transform 0.2s cubic-bezier(0.34,1.56,0.64,1);}
    .ios-tab-btn.active .ios-tab-icon{transform:scale(1.1);}
    .ios-tab-label{font-size:10px;font-weight:600;letter-spacing:0.1px;}

    /* ── Session Timeout Warning ── */
    .session-warn{position:fixed;top:0;left:0;right:0;z-index:10000;background:linear-gradient(135deg,#D97706,#B45309);color:white;padding:12px 20px;text-align:center;font-size:13px;font-weight:700;animation:slideDown 0.3s ease;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;}
    .session-warn button{background:white;color:#92400E;border:none;border-radius:8px;padding:6px 16px;font-weight:700;font-size:12px;cursor:pointer;transition:transform 0.1s;}
    .session-warn button:active{transform:scale(0.95);}

    /* ── Offline Banner ── */
    .offline-banner{position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:9990;background:rgba(239,68,68,0.95);color:white;padding:8px 20px;border-radius:20px;font-size:12px;font-weight:700;box-shadow:0 4px 20px rgba(0,0,0,0.2);animation:upSpring 0.3s ease;display:flex;align-items:center;gap:8px;}

    /* ── Scroll-to-top ── */
    .scroll-top-btn{position:fixed;bottom:76px;right:14px;z-index:250;width:38px;height:38px;border-radius:50%;border:none;background:rgba(10,22,40,0.8);color:white;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(0,0,0,0.25);transition:all 0.2s ease;backdrop-filter:blur(10px);}
    .scroll-top-btn:active{transform:scale(0.88);}

    /* ── Pull-to-refresh ── */
    .pull-refresh-bar{position:fixed;top:0;left:0;right:0;z-index:9998;display:flex;align-items:center;justify-content:center;padding:10px;background:linear-gradient(135deg,#0A1628,#1B4080);animation:slideDown 0.25s ease;}
    .pull-refresh-spinner{width:20px;height:20px;border:2.5px solid rgba(255,255,255,0.25);border-top-color:#C9A84C;border-radius:50%;animation:pullSpin 0.7s linear infinite;}
  `;

  // ── LOGIN LOADING SCREEN (harus SEBELUM if(!user) agar tidak ter-override) ──
  if(loginLoading)return(
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"linear-gradient(160deg,"+NAVY+" 0%,#142238 60%,#0D1F35 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:0,overflow:"hidden"}}>
      <style>{CSS}</style>
      {/* Lingkaran dekoratif latar */}
      <div style={{position:"absolute",width:400,height:400,borderRadius:"50%",border:"1px solid rgba(201,168,76,0.08)",top:"50%",left:"50%",transform:"translate(-50%,-50%)"}}/>
      <div style={{position:"absolute",width:260,height:260,borderRadius:"50%",border:"1px solid rgba(201,168,76,0.12)",top:"50%",left:"50%",transform:"translate(-50%,-50%)"}}/>
      {/* Logo */}
      <img src="/logo_tarakan.png" alt="" style={{height:80,width:"auto",objectFit:"contain",filter:"drop-shadow(0 4px 24px rgba(201,168,76,0.35))",marginBottom:20,animation:"pulse 2s ease infinite"}} onError={e=>e.target.style.display="none"}/>
      {/* Nama sistem */}
      <div style={{color:"white",fontSize:20,fontWeight:800,letterSpacing:"1px",marginBottom:4}}>Prokopim Tarakan</div>
      <div style={{color:"rgba(201,168,76,0.7)",fontSize:11,fontWeight:500,letterSpacing:"2px",textTransform:"uppercase",marginBottom:32}}>Sistem Informasi Jadwal Pimpinan</div>
      {/* Spinner emas */}
      <div style={{width:44,height:44,position:"relative",marginBottom:20}}>
        <div style={{position:"absolute",inset:0,border:"3px solid rgba(201,168,76,0.15)",borderTopColor:"#C9A84C",borderRadius:"50%",animation:"spin 0.9s linear infinite"}}/>
      </div>
      {/* Fase loading */}
      <div style={{color:"#C9A84C",fontSize:13,fontWeight:600,letterSpacing:"0.5px",marginBottom:40,minHeight:20,animation:"pulse 1.2s ease infinite"}}>{loginPhase}</div>
      {/* Tagline di bawah */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"28px 20px 32px",textAlign:"center",background:"linear-gradient(to top,rgba(0,0,0,0.5),transparent)"}}>
        <div style={{color:"rgba(255,255,255,0.45)",fontSize:10,fontWeight:500,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:8}}>Motto Pelayanan</div>
        <div style={{color:"rgba(255,255,255,0.75)",fontSize:13,fontWeight:600,fontStyle:"italic",lineHeight:1.6}}>
          "Berikan yang terbaik, untuk kota kita"
        </div>
        <div style={{color:"#C9A84C",fontSize:12,fontWeight:800,letterSpacing:"2px",marginTop:6}}>#TARAKANHIBOT</div>
      </div>
    </div>
  );

  // ==================== LOGIN ====================
  if(!user){
    const features=[
      ["📋","Approval Berjenjang","Staf → Kasubbag → Kabag"],
      ["🤖","AI Auto-Isi","Scan undangan, form terisi otomatis"],
      ["📊","Briefing & Statistik","Ringkasan pagi + rekap kinerja tim"],
      ["⏱️","Timeline Realtime","Jadwal visual dengan penanda waktu"],
      ["🔔","Notifikasi WA & Push","Update instan ke seluruh tim"],
      ["🔐","Keamanan Berlapis","Biometrik, sesi otomatis, anti brute-force"],
    ];

    // Warna tema
    const BG="hsl(215,30%,10%)";
    const CARD="hsl(215,35%,14%)";
    const CARD2="hsl(215,30%,16%)";
    const GOLD2="hsl(42,78%,55%)";
    const GOLD_LIGHT="hsl(42,85%,70%)";
    const SEC="hsl(215,25%,20%)";
    const MUTED="hsl(215,15%,55%)";
    const BORDER="hsl(215,20%,22%)";
    const FG="hsl(210,20%,90%)";
    const inpStyle={
      width:"100%",height:48,padding:"0 14px",borderRadius:10,
      border:"1.5px solid "+BORDER,
      background:"hsla(215,25%,20%,0.5)",
      color:FG,fontSize:14,outline:"none",boxSizing:"border-box",
      fontFamily:"'Plus Jakarta Sans',sans-serif",
    };
    return(
    <div style={{minHeight:"100vh",width:"100%",background:BG,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:isMobile?"flex-start":"center",padding:isMobile?"0":"24px",overflowY:"auto",position:"relative",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{CSS+`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideRight{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
        @keyframes pulseGlow{0%,100%{box-shadow:0 0 40px -10px hsla(42,78%,55%,0.2)}50%{box-shadow:0 0 40px -10px hsla(42,78%,55%,0.45)}}
        @keyframes focusBorder{to{border-color:hsl(42,78%,55%)}}
        .login-inp:focus{border-color:hsl(42,78%,55%)!important;box-shadow:0 0 0 3px hsla(42,78%,55%,0.15)!important;}
        .login-btn-primary{background:hsl(42,78%,55%);color:hsl(215,30%,10%);border:none;font-weight:800;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;}
        .login-btn-primary:hover{background:hsl(42,85%,70%);box-shadow:0 4px 20px hsla(42,78%,55%,0.4);transform:translateY(-1px);}
        .login-btn-primary:active{transform:scale(0.97);}
        .login-btn-outline{background:transparent;border:1.5px solid hsla(215,20%,60%,0.25);color:${MUTED};font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;}
        .login-btn-outline:hover{border-color:hsla(42,78%,55%,0.4);color:${FG};}
        .feat-item{animation:fadeUp 0.6s ease both;}
        .login-card{animation:slideRight 0.6s ease both;}
      `}</style>

      {/* Dekorasi latar — lingkaran blur */}
      <div style={{position:"fixed",top:"-10%",right:"-5%",width:400,height:400,borderRadius:"50%",background:"hsla(42,78%,55%,0.03)",filter:"blur(80px)",pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:"-15%",left:"-10%",width:500,height:500,borderRadius:"50%",background:"hsla(42,78%,55%,0.02)",filter:"blur(100px)",pointerEvents:"none"}}/>

      {/* ── MOBILE LAYOUT ── */}
      {isMobile&&<>
        {/* Hero strip */}
        <div style={{width:"100%",background:"hsla(215,35%,14%,0.9)",backdropFilter:"blur(20px)",borderBottom:"1px solid "+BORDER,padding:"28px 24px 22px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <img src="/logo_tarakan.png" alt="Logo" style={{height:48,width:"auto",objectFit:"contain",filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.5))",flexShrink:0}} onError={e=>e.target.style.display="none"}/>
            <div>
              <div style={{color:GOLD2,fontSize:9,letterSpacing:2.5,textTransform:"uppercase",fontWeight:700,marginBottom:3}}>Pemerintah Kota Tarakan</div>
              <div style={{color:FG,fontSize:15,fontWeight:800,lineHeight:1.3}}>Protokol &amp; Komunikasi Pimpinan</div>
            </div>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {features.map(([ic,t])=><span key={t} style={{background:"hsla(42,78%,55%,0.12)",border:"1px solid hsla(42,78%,55%,0.3)",borderRadius:20,padding:"3px 10px",fontSize:10,color:GOLD2,fontWeight:700}}>{ic} {t}</span>)}
          </div>
        </div>

        {/* Login card mobile */}
        <div style={{width:"100%",flex:1,padding:"28px 24px 40px",display:"flex",flexDirection:"column",background:BG}}>
          <div style={{marginBottom:24}}>
            <div style={{backgroundImage:"linear-gradient(135deg,"+GOLD2+","+GOLD_LIGHT+")",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontSize:22,fontWeight:800,marginBottom:4}}>Masuk ke Sistem</div>
            <div style={{fontSize:13,color:MUTED}}>Masukkan kredensial akun Anda</div>
          </div>

          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,color:MUTED,fontWeight:700,marginBottom:6,letterSpacing:1.2,textTransform:"uppercase"}}>Username</label>
            <input className="login-inp" type="text" value={loginForm.username} onChange={e=>setLF(p=>({...p,username:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doLogin()} placeholder="Masukkan username" autoCapitalize="none" autoCorrect="off" style={inpStyle}/>
          </div>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:11,color:MUTED,fontWeight:700,marginBottom:6,letterSpacing:1.2,textTransform:"uppercase"}}>Password</label>
            <div style={{position:"relative"}}>
              <input className="login-inp" type={showPass?"text":"password"} value={loginForm.password} onChange={e=>setLF(p=>({...p,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doLogin()} placeholder="Masukkan password" style={{...inpStyle,paddingRight:44}}/>
              <button onClick={()=>setShowPass(p=>!p)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:MUTED,fontSize:18,padding:4}}>{showPass?"👁️":"👁️‍🗨️"}</button>
            </div>
          </div>

          {loginErr&&<div style={{background:"hsla(0,84%,60%,0.15)",borderRadius:9,padding:"10px 13px",marginBottom:12,fontSize:13,color:"hsl(0,84%,75%)",fontWeight:600,border:"1px solid hsla(0,84%,60%,0.3)",animation:"gentleShake 0.4s ease"}}>
            {loginErr}
            {lockSeconds>0&&<div style={{marginTop:6,fontSize:11,opacity:0.8}}>⏳ Coba lagi dalam {Math.floor(lockSeconds/60)}:{String(lockSeconds%60).padStart(2,"0")}</div>}
          </div>}
          {(bioErr||bioLoading)&&<div style={{background:"hsla(210,80%,55%,0.12)",borderRadius:9,padding:"10px 13px",marginBottom:12,fontSize:13,color:"hsl(210,80%,75%)",fontWeight:600,border:"1px solid hsla(210,80%,55%,0.25)"}}>{bioLoading?"Memverifikasi biometrik...":bioErr}</div>}

          <button className="login-btn-primary" onClick={doLogin} disabled={lockSeconds>0} style={{width:"100%",height:48,borderRadius:12,fontSize:15,fontWeight:800,marginBottom:10,animation:lockSeconds>0?"none":"pulseGlow 3s ease infinite"}}>{lockSeconds>0?"Dikunci Sementara":"Masuk"}</button>
          <button className="login-btn-outline" onClick={()=>setShowForgot(true)} style={{width:"100%",height:44,borderRadius:12,fontSize:13,fontWeight:600,marginBottom:8}}>🔑 Lupa Password?</button>
          <button onClick={()=>setShowRegister(true)} style={{width:"100%",height:42,borderRadius:12,border:"1.5px dashed rgba(201,168,76,0.5)",background:"transparent",color:GOLD2,cursor:"pointer",fontSize:13,fontWeight:600,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <span>📝</span> Belum punya akun? Daftar di sini
            </button>

          {bioSupported()&&<>
            <button className="login-btn-outline" onClick={doBioLogin} disabled={bioLoading} style={{width:"100%",height:44,borderRadius:12,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:18}}>🔐</span>{bioLoading?"Memproses...":"Login Biometrik / PIN"}
            </button>
            {loginForm.username&&!bioIsRegistered(loginForm.username.toLowerCase().trim())&&
              <div style={{background:"hsla(42,78%,55%,0.1)",borderRadius:8,padding:"8px 11px",fontSize:12,color:GOLD2,display:"flex",gap:6,alignItems:"flex-start",marginBottom:8,border:"1px solid hsla(42,78%,55%,0.2)"}}>
                <span>⚠️</span><span>Biometrik belum aktif. Login dulu lalu aktifkan di <strong>Pengaturan Akun</strong>.</span>
              </div>}
          </>}

          <div style={{marginTop:"auto",paddingTop:24,textAlign:"center",color:MUTED,fontSize:10,letterSpacing:1.5,opacity:0.5}}>v1.0 · Prokopim Tarakan · 2026</div>
        </div>
      </>}

      {/* ── DESKTOP LAYOUT ── */}
      {!isMobile&&<div style={{width:"100%",maxWidth:960,display:"flex",gap:0,borderRadius:20,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px "+BORDER,animation:"pulseGlow 3s ease infinite"}}>
        {/* Left panel hero */}
        <div style={{flex:1,background:"linear-gradient(160deg,hsla(215,35%,14%,0.95),hsla(215,30%,11%,0.98))",backdropFilter:"blur(20px)",padding:"48px 44px",display:"flex",flexDirection:"column",justifyContent:"space-between",borderRight:"1px solid "+BORDER}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:32}}>
              <img src="/logo_tarakan.png" alt="Logo" style={{height:64,width:"auto",objectFit:"contain",filter:"drop-shadow(0 2px 12px rgba(0,0,0,0.5))",flexShrink:0}} onError={e=>e.target.style.display="none"}/>
              <div>
                <div style={{color:GOLD2,fontSize:9,letterSpacing:2.5,textTransform:"uppercase",fontWeight:700,marginBottom:4}}>Pemerintah Kota Tarakan</div>
                <div style={{color:FG,fontSize:17,fontWeight:800,lineHeight:1.25}}>Bagian Protokol &amp;</div>
                <div style={{color:FG,fontSize:17,fontWeight:800}}>Komunikasi Pimpinan</div>
              </div>
            </div>
            <div style={{width:40,height:3,background:"linear-gradient(90deg,"+GOLD2+","+GOLD_LIGHT+")",borderRadius:3,marginBottom:20}}/>
            <div style={{color:MUTED,fontSize:12.5,lineHeight:1.8,marginBottom:28}}>
              Sistem Informasi Jadwal Kegiatan Pimpinan Daerah Kota Tarakan. Mengelola agenda, approval workflow, dan koordinasi tim Protokol dan Komunikasi Pimpinan secara terpadu.
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 16px"}}>
              {features.map(([ic,t,d],i)=><div key={t} className="feat-item" style={{display:"flex",alignItems:"flex-start",gap:10,animationDelay:(i*0.06)+"s"}}>
                <div style={{width:30,height:30,borderRadius:8,background:"hsla(42,78%,55%,0.1)",border:"1px solid hsla(42,78%,55%,0.18)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginTop:1}}>{ic}</div>
                <div><div style={{color:FG,fontSize:12,fontWeight:700,lineHeight:1.3}}>{t}</div><div style={{color:MUTED,fontSize:10,lineHeight:1.4,marginTop:1}}>{d}</div></div>
              </div>)}
            </div>
          </div>
          <div style={{color:MUTED,fontSize:10,letterSpacing:1.5,opacity:0.5,marginTop:20}}>v1.0 · Prokopim Tarakan · 2026</div>
        </div>

        {/* Right panel login */}
        <div className="login-card" style={{width:370,background:"linear-gradient(160deg,hsla(215,35%,14%,0.8),hsla(215,30%,16%,0.6))",backdropFilter:"blur(20px)",padding:"44px 38px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <div style={{marginBottom:28}}>
            <div style={{backgroundImage:"linear-gradient(135deg,"+GOLD2+","+GOLD_LIGHT+")",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontSize:24,fontWeight:800,marginBottom:6}}>Masuk ke Sistem</div>
            <div style={{fontSize:13,color:MUTED}}>Masukkan kredensial akun Anda</div>
          </div>

          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,color:MUTED,fontWeight:700,marginBottom:6,letterSpacing:1.2,textTransform:"uppercase"}}>Username</label>
            <input className="login-inp" type="text" value={loginForm.username} onChange={e=>setLF(p=>({...p,username:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doLogin()} placeholder="Masukkan username" autoCapitalize="none" autoCorrect="off" style={inpStyle}/>
          </div>
          <div style={{marginBottom:18}}>
            <label style={{display:"block",fontSize:11,color:MUTED,fontWeight:700,marginBottom:6,letterSpacing:1.2,textTransform:"uppercase"}}>Password</label>
            <div style={{position:"relative"}}>
              <input className="login-inp" type={showPass?"text":"password"} value={loginForm.password} onChange={e=>setLF(p=>({...p,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doLogin()} placeholder="Masukkan password" style={{...inpStyle,paddingRight:44}}/>
              <button onClick={()=>setShowPass(p=>!p)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:MUTED,fontSize:16,padding:4}}>{showPass?"👁️":"👁️‍🗨️"}</button>
            </div>
          </div>

          {loginErr&&<div style={{background:"hsla(0,84%,60%,0.15)",borderRadius:9,padding:"9px 13px",marginBottom:12,fontSize:13,color:"hsl(0,84%,75%)",fontWeight:600,border:"1px solid hsla(0,84%,60%,0.3)",animation:"gentleShake 0.4s ease"}}>
            {loginErr}
            {lockSeconds>0&&<div style={{marginTop:6,fontSize:11,opacity:0.8}}>⏳ Coba lagi dalam {Math.floor(lockSeconds/60)}:{String(lockSeconds%60).padStart(2,"0")}</div>}
          </div>}
          {(bioErr||bioLoading)&&<div style={{background:"hsla(210,80%,55%,0.12)",borderRadius:9,padding:"9px 13px",marginBottom:12,fontSize:13,color:"hsl(210,80%,75%)",fontWeight:600,border:"1px solid hsla(210,80%,55%,0.25)"}}>{bioLoading?"Memverifikasi biometrik perangkat...":bioErr}</div>}

          <button className="login-btn-primary" onClick={doLogin} disabled={lockSeconds>0} style={{width:"100%",height:48,borderRadius:12,fontSize:15,fontWeight:800,marginBottom:10}}>{lockSeconds>0?"Dikunci Sementara":"Masuk"}</button>
          <button className="login-btn-outline" onClick={()=>setShowForgot(true)} style={{width:"100%",height:42,borderRadius:12,fontSize:13,fontWeight:600,marginBottom:8}}>🔑 Lupa Password?</button>
          <button onClick={()=>setShowRegister(true)} style={{width:"100%",height:42,borderRadius:12,border:"1.5px dashed rgba(201,168,76,0.5)",background:"transparent",color:GOLD2,cursor:"pointer",fontSize:13,fontWeight:600,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <span>📝</span> Belum punya akun? Daftar di sini
            </button>

          {bioSupported()&&<>
            <button className="login-btn-outline" onClick={doBioLogin} disabled={bioLoading} style={{width:"100%",height:42,borderRadius:12,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:16}}>🔐</span>{bioLoading?"Memproses...":"Login dengan Biometrik / PIN"}
            </button>
            {loginForm.username&&!bioIsRegistered(loginForm.username.toLowerCase().trim())&&
              <div style={{background:"hsla(42,78%,55%,0.1)",borderRadius:8,padding:"7px 11px",fontSize:11,color:GOLD2,display:"flex",gap:6,alignItems:"flex-start",border:"1px solid hsla(42,78%,55%,0.2)"}}>
                <span>⚠️</span><span>Biometrik belum aktif. Login dulu, lalu aktifkan di <strong>Pengaturan Akun</strong>.</span>
              </div>}
          </>}


        </div>
      </div>}

      {/* ForgotPassword harus di sini — sebelum user login */}
      {showForgot&&<ForgotPasswordModal onClose={()=>setShowForgot(false)}/> }
    {showRegister&&<RegisterModal onClose={()=>setShowRegister(false)}/>}
    </div>
  );}



  if(!dbReady)return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,"+NAVY+" 0%,#142238 60%,#0D1F35 100%)",display:"flex",alignItems:"center",justifyContent:"center",gap:16,flexDirection:"column"}}><style>{CSS}</style>
      <img src="/logo_tarakan.png" alt="" style={{height:56,width:"auto",objectFit:"contain",filter:"drop-shadow(0 4px 16px rgba(0,0,0,0.4))",marginBottom:8,animation:"pulse 2s ease infinite"}} onError={e=>e.target.style.display="none"}/>
      <div style={{width:40,height:40,border:"3px solid rgba(212,175,90,0.2)",borderTopColor:GOLD,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <div style={{color:"white",fontSize:14,fontWeight:600,letterSpacing:"0.3px",opacity:0.85}}>Memuat data...</div>
      {dbError&&<div style={{color:"#FCA5A5",fontSize:12,maxWidth:260,textAlign:"center",padding:"8px 16px",background:"rgba(220,38,38,0.15)",borderRadius:10,border:"1px solid rgba(220,38,38,0.3)"}}>{dbError}</div>}
    </div>
  );

  // ==================== SIDEBAR ====================
  const navGroups=[
    {label:"MENU UTAMA",items:[
      ...(role==="staf"?[{key:"jadwal",icon:"📅",label:"Jadwal"},{key:"penugasan",icon:"🎯",label:"Penugasan"}]:[]),
      ...(role==="admin_rk"?[{key:"form",icon:"✏️",label:"Input Jadwal"},{key:"draft",icon:"📝",label:"Draft & Progress"},{key:"jadwal",icon:"📅",label:"Jadwal Disetujui"},{key:"rk",icon:"📋",label:"Rencana Kegiatan"}]:[]),
      ...(KASUBBAG_ROLES.includes(role)?[{key:"jadwal",icon:"📋",label:"Antrian"},{key:"semua",icon:"🗓️",label:"Semua Jadwal"}]:[]),
      ...(role==="kabag"?[{key:"jadwal",icon:"📋",label:"Antrian"},{key:"semua",icon:"🗓️",label:"Semua Jadwal"}]:[]),
      ...((role==="ajudan_walikota"||role==="ajudan_wakilwalikota")?[{key:"ajudan",icon:"✅",label:"Konfirmasi"},{key:"jadwal",icon:"📅",label:"Jadwal"},{key:"penugasan",icon:"🎯",label:"Penugasan"}]:[]),
      ...(role==="timkom"?[{key:"jadwal",icon:"📅",label:"Jadwal"},{key:"penugasan",icon:"🎯",label:"Penugasan"}]:[]),
      ...(role==="mitra_kerja"?[{key:"mitra",icon:"📅",label:"Agenda"}]:[]),
      ...(role==="walikota"||role==="wakilwalikota"?[{key:"jadwal",icon:"📅",label:"Jadwal Saya"}]:[]),
      {key:"tayang",icon:"🏛️",label:"Agenda Tayang"},
    ]},
    {label:"LAPORAN & TOOLS",items:[
      {key:"action:summary",icon:"💬",label:"Rekap WA Hari Ini"},
      {key:"action:report",icon:"📄",label:"Cetak Rekap PDF"},
      ...(canReport?[{key:"action:laporan",icon:"📊",label:"Laporan Mingguan/Bulanan"}]:[]),
      ...((KASUBBAG_ROLES.includes(role)||role==="kabag")?[{key:"penugasan",icon:"📈",label:"Rekap Evaluasi Kinerja"}]:[]),
    ]},
    {label:"AKUN",items:[
      {key:"action:profile",icon:"👤",label:"Pengaturan Akun"},
      ...(role==="kabag"?[{key:"action:admin",icon:"⚙️",label:"Kelola Pengguna"}]:[]),
      ...(role==="kabag"?[{key:"action:broadcast",icon:"📢",label:"Kirim Pengumuman"}]:[]),
    ]},
  ];

  const handleNavClick=key=>{
    if(key==="action:summary"){setShowSummary(true);return;}if(key==="action:report"){setShowReport(true);return;}if(key==="action:laporan"){setShowLaporan(true);return;}if(key==="action:admin"){setShowAdmin(true);return;}if(key==="action:broadcast"){setShowBroadcast(true);return;}if(key==="action:profile"){setShowProfile(true);return;}
    setTab(key);if(key==="form"){setForm(emptyForm);setEditId(null);}
  };

  const sidebarJSX=(<aside style={{width:260,minHeight:"100vh",background:th.g,display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh",overflowY:"auto",boxShadow:"4px 0 20px rgba(0,0,0,0.18)"}}>
    <div style={{padding:"20px 16px 14px",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <img src="/logo_tarakan.png" alt="Logo" style={{height:36,width:"auto",objectFit:"contain",filter:"drop-shadow(0 1px 4px rgba(0,0,0,0.3))",flexShrink:0}} onError={e=>e.target.style.display="none"}/>
        <div><div style={{color:th.a,fontSize:8,letterSpacing:1.5,textTransform:"uppercase",fontWeight:700}}>Pemkot Tarakan</div><div style={{color:"white",fontSize:11,fontWeight:700,lineHeight:1.3}}>Protokol &amp; Komunikasi</div></div>
      </div>
      <button onClick={()=>setShowProfile(true)} style={{width:"100%",background:"rgba(255,255,255,0.09)",borderRadius:11,padding:"10px 12px",display:"flex",alignItems:"center",gap:10,border:"1px solid rgba(255,255,255,0.12)",cursor:"pointer",textAlign:"left",transition:"all 0.15s"}} onMouseOver={e=>e.currentTarget.style.background="rgba(255,255,255,0.16)"} onMouseOut={e=>e.currentTarget.style.background="rgba(255,255,255,0.09)"}>
        <div style={{width:34,height:34,borderRadius:9,background:"rgba(255,255,255,0.12)",border:"1.5px solid "+th.a,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,color:"white",fontWeight:700}}>{user?.nama?.slice(0,1)}</div>
        <div style={{flex:1,minWidth:0}}><div style={{color:"white",fontSize:12,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.nama}</div><div style={{color:"rgba(255,255,255,0.5)",fontSize:9,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{roleInfo.label}</div></div>
        <div title={SUPA_OK?"DB OK":"Mode Lokal"} style={{width:7,height:7,borderRadius:"50%",background:SUPA_OK?"#34d399":"#f87171",flexShrink:0}}/>
      </button>
    </div>
    <nav style={{flex:1,padding:"10px 10px",overflowY:"auto"}}>
      {navGroups.map(group=><div key={group.label} style={{marginBottom:8}}>
        <div style={{color:"rgba(255,255,255,0.3)",fontSize:9,fontWeight:800,letterSpacing:1.5,padding:"6px 10px 4px",textTransform:"uppercase"}}>{group.label}</div>
        {group.items.map(item=>{const isActive=tab===item.key&&!item.key.startsWith("action:");return(
          <button key={item.key+item.label} className="nav-btn sidebar-link" onClick={()=>handleNavClick(item.key)} style={{width:"100%",padding:"9px 14px",borderRadius:9,border:"none",background:isActive?"rgba(255,255,255,0.18)":"transparent",color:"white",cursor:"pointer",fontSize:12.5,fontWeight:isActive?700:400,textAlign:"left",display:"flex",alignItems:"center",gap:10,marginBottom:2,borderLeft:isActive?"3px solid "+th.a:"3px solid transparent",opacity:isActive?1:0.72}}>
            <span style={{fontSize:15,minWidth:22,textAlign:"center"}}>{item.icon}</span>{item.label}
          </button>);})}
      </div>)}
    </nav>
    <div style={{padding:"10px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
      {pendingList.length>0&&<button onClick={goToPending} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#ef4444,#dc2626)",color:"white",cursor:"pointer",fontSize:12,fontWeight:700,textAlign:"left",display:"flex",alignItems:"center",gap:10,marginBottom:8,boxShadow:"0 4px 12px rgba(239,68,68,0.3)"}}>
        <span style={{background:"white",color:"#ef4444",borderRadius:"50%",width:18,height:18,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,flexShrink:0}}>{pendingList.length}</span>Pending Approval
      </button>}
      <button onClick={doLogout} style={{width:"100%",padding:"9px 12px",borderRadius:9,border:"1px solid rgba(255,255,255,0.18)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:"pointer",fontSize:12,fontWeight:600,textAlign:"left"}}>Keluar</button>
    </div>
  </aside>);

  // ==================== MOBILE HEADER + iOS BOTTOM TAB BAR ====================
  const mobTabs=[
    ...(role==="staf"?[{key:"jadwal",label:"Jadwal",icon:"📅"},{key:"penugasan",label:"Penugasan",icon:"🎯"}]:[]),
    ...(role==="admin_rk"?[{key:"form",label:"Input",icon:"✏️"},{key:"draft",label:"Draft",icon:"📝"},{key:"jadwal",label:"Jadwal",icon:"📅"},{key:"rk",label:"RK",icon:"📋"}]:[]),
    ...(KASUBBAG_ROLES.includes(role)?[{key:"jadwal",label:"Antrian",icon:"📋"},{key:"semua",label:"Jadwal",icon:"🗓️"}]:[]),
    ...(role==="kabag"?[{key:"jadwal",label:"Antrian",icon:"📋"},{key:"semua",label:"Jadwal",icon:"🗓️"}]:[]),
    ...((role==="ajudan_walikota"||role==="ajudan_wakilwalikota")?[{key:"ajudan",label:"Konfirmasi",icon:"✅"},{key:"jadwal",label:"Jadwal",icon:"📅"},{key:"penugasan",label:"Penugasan",icon:"🎯"}]:[]),
    ...(role==="timkom"?[{key:"jadwal",label:"Jadwal",icon:"📅"},{key:"penugasan",label:"Penugasan",icon:"🎯"}]:[]),
    ...(role==="mitra_kerja"?[{key:"mitra",label:"Agenda",icon:"📅"}]:[]),
    ...(role==="walikota"||role==="wakilwalikota"?[{key:"jadwal",label:"Jadwal",icon:"📅"}]:[]),
    {key:"tayang",label:"Tayang",icon:"🏛️"},
    {key:"action:more",label:"Lainnya",icon:"⋯"},
  ];
  const TAB_BAR_H=56;
  const mobileHeaderJSX=(<>
    {/* ── TOP NAV BAR ── */}
    <div style={{background:"linear-gradient(to bottom,"+NAVY+" 0%,"+NAVY+" 100%)",position:"sticky",top:0,zIndex:200,paddingTop:"env(safe-area-inset-top,0px)"}}>
      <div style={{padding:"10px 16px 10px",display:"flex",alignItems:"center",gap:10,borderBottom:"0.5px solid rgba(255,255,255,0.1)"}}>
        <img src="/logo_tarakan.png" alt="" style={{height:32,width:"auto",objectFit:"contain",flexShrink:0,filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.3))"}} onError={e=>e.target.style.display="none"}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:"white",fontSize:13,fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",letterSpacing:"-0.2px"}}>{user?.nama}</div>
          <div style={{color:GOLD,fontSize:9.5,fontWeight:600,letterSpacing:"0.5px",textTransform:"uppercase"}}>{roleInfo.label}</div>
        </div>
        {pendingList.length>0&&<button onClick={goToPending} className="btn-ios" style={{background:"#EF4444",color:"white",borderRadius:20,padding:"4px 11px",fontSize:11,fontWeight:800,border:"none",cursor:"pointer",flexShrink:0,boxShadow:"0 2px 10px rgba(239,68,68,0.5)",display:"flex",alignItems:"center",gap:5}}>
          <span style={{background:"rgba(255,255,255,0.25)",borderRadius:"50%",width:16,height:16,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900}}>{pendingList.length}</span>Pending
        </button>}
        <button aria-label="Notifikasi" onClick={()=>setShowNotifCenter(true)} style={{position:"relative",width:32,height:32,borderRadius:9,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.1)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
          🔔
          {notifPenugasan.length>0&&<span style={{position:"absolute",top:-3,right:-3,background:"#EF4444",color:"white",borderRadius:"50%",width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900}}>{notifPenugasan.length}</span>}
        </button>
        <div title={SUPA_OK?"Terhubung ke Database":"Mode Lokal"} style={{width:8,height:8,borderRadius:"50%",background:SUPA_OK?"#34D399":"#F87171",flexShrink:0,boxShadow:SUPA_OK?"0 0 6px rgba(52,211,153,0.6)":"none"}}/>
      </div>
    </div>

    {/* ── iOS BOTTOM TAB BAR ── */}
    <div className="ios-tab-bar" style={{height:TAB_BAR_H+"px"}}>
      {mobTabs.map(t=>{
        const isActive=t.key==="action:more"?showMobMenu:(tab===t.key&&!showMobMenu);
        const handleTab=()=>{
          if(t.key==="action:more"){setMobMenu(v=>!v);return;}
          setMobMenu(false);
          if(t.key==="form"){setForm(emptyForm);setEditId(null);}
          setTab(t.key);
        };
        return <button key={t.key} className={"ios-tab-btn"+(isActive?" active":"")} onClick={handleTab} style={{color:isActive?NAVY:"#94A3B8"}}>
          <span className="ios-tab-icon" style={{filter:isActive?"none":"grayscale(0.3)"}}>{t.icon}</span>
          <span className="ios-tab-label" style={{fontWeight:isActive?700:500,color:isActive?NAVY:"#94A3B8"}}>{t.label}</span>
          {t.key==="action:more"&&!showMobMenu&&(
            (pendingList.length>0?<span style={{position:"absolute",top:6,right:"calc(50% - 14px)",background:"#EF4444",color:"white",borderRadius:"50%",width:16,height:16,fontSize:9,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>{pendingList.length}</span>:null)
          )}
        </button>;
      })}
    </div>

    {/* ── MORE DRAWER (bottom sheet style) ── */}
    {showMobMenu&&<>
      <div style={{position:"fixed",inset:0,zIndex:290,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",animation:"fadeIn 0.2s ease"}} onClick={()=>setMobMenu(false)}/>
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:295,background:"white",borderRadius:"20px 20px 0 0",boxShadow:"0 -8px 40px rgba(0,0,0,0.2)",animation:"sheetUp 0.3s cubic-bezier(0.34,1.3,0.64,1)",maxHeight:"70vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
        {/* Handle + scrollable content */}
        <div style={{flexShrink:0,padding:"0 16px"}}>
          <div style={{width:36,height:4,background:"#E2E8F0",borderRadius:4,margin:"12px auto 16px"}}/>
          <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:10,paddingLeft:2}}>MENU</div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"0 16px",WebkitOverflowScrolling:"touch"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            {[
              {icon:"💬",label:"Rekap WA",action:()=>{setShowSummary(true);setMobMenu(false);}},
              {icon:"📄",label:"Cetak PDF",action:()=>{setShowReport(true);setMobMenu(false);}},
              ...(canReport?[{icon:"📊",label:"Laporan",action:()=>{setShowLaporan(true);setMobMenu(false);}}]:[]),
              ...((KASUBBAG_ROLES.includes(role)||role==="kabag")?[{icon:"📈",label:"Rekap Evaluasi",action:()=>{setTab("penugasan");setMobMenu(false);}}]:[]),
              {icon:"👤",label:"Profil",action:()=>{setShowProfile(true);setMobMenu(false);}},
              ...(role==="kabag"?[{icon:"⚙️",label:"Kelola User"+(loadPendingRegs().length>0?" ("+loadPendingRegs().length+")":""),action:()=>{setShowAdmin(true);setMobMenu(false);}}]:[]),
              ...(role==="kabag"?[{icon:"📢",label:"Kirim Pengumuman",action:()=>{setShowBroadcast(true);setMobMenu(false);}}]:[]),
            ].map((btn,i)=>(
              <button key={i} onClick={btn.action} className="btn-ios" style={{padding:"14px 12px",borderRadius:14,border:"1.5px solid #E4EAF2",background:"#F8FAFF",color:NAVY,cursor:"pointer",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{fontSize:20}}>{btn.icon}</span>{btn.label}
              </button>
            ))}
          </div>
        </div>
        {/* Logout button - ALWAYS visible, sticky at bottom */}
        <div style={{flexShrink:0,padding:"8px 16px",paddingBottom:"calc(env(safe-area-inset-bottom,0px) + 12px)",borderTop:"1px solid #F1F5F9",background:"white"}}>
          <button onClick={()=>{doLogout();setMobMenu(false);}} className="btn-ios" style={{width:"100%",padding:"14px",borderRadius:14,border:"2px solid #FCA5A5",background:"#FEF2F2",color:"#DC2626",cursor:"pointer",fontSize:14,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span style={{fontSize:18}}>🚪</span>Keluar dari Akun
          </button>
        </div>
      </div>
    </>}
  </>);

  
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// RENCANA KEGIATAN (RK) VIEW — hanya untuk admin_rk
// ═══════════════════════════════════════════════════════
function RKView({events,user,upd,updAndSync,showT,isMobile}){
  const NAVY="0A1628";const _NAVY="#0A1628";
  const[rkList,setRkList]=useState(()=>{try{return JSON.parse(localStorage.getItem("prokopim_rk")||"[]");}catch{return[];}});
  const[showForm,setShowForm]=useState(false);
  const[form,setForm]=useState({judul:"",perihal:"",tanggalMulai:"",tanggalSelesai:"",uraian:"",catatan:""});
  const[showAI,setShowAI]=useState(false);
  const saveRk=(list)=>{localStorage.setItem("prokopim_rk",JSON.stringify(list));setRkList(list);};
  const submitRk=()=>{
    if(!form.judul||!form.tanggalMulai)return showT("Judul dan tanggal mulai wajib diisi","error");
    const item={...form,id:Date.now(),dibuat:new Date().toISOString(),dibuatOleh:user.username,dibuatOlehNama:user.nama};
    saveRk([item,...rkList]);
    setForm({judul:"",perihal:"",tanggalMulai:"",tanggalSelesai:"",uraian:"",catatan:""});
    setShowForm(false);showT("Rencana Kegiatan berhasil disimpan ✓");
  };
  const hapusRk=(id)=>saveRk(rkList.filter(r=>r.id!==id));
  const inp={width:"100%",padding:"9px 11px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:13,boxSizing:"border-box"};
  return <div style={{padding:isMobile?"12px":"20px"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
      <div><div style={{fontSize:16,fontWeight:700,color:_NAVY}}>📋 Rencana Kegiatan (RK)</div><div style={{fontSize:12,color:"#64748b",marginTop:2}}>{rkList.length} entri tersimpan</div></div>
      <div style={{display:"flex",gap:8}}><button onClick={()=>setShowAI(true)} style={{padding:"9px 14px",borderRadius:9,border:"1.5px solid #6366f1",background:"white",color:"#6366f1",cursor:"pointer",fontSize:12,fontWeight:700}}>✨ Input dengan AI</button><button onClick={()=>setShowForm(true)} style={{padding:"9px 14px",borderRadius:9,border:"none",background:_NAVY,color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>+ Input Manual</button></div>
    </div>
    {showForm&&<div style={{background:"white",borderRadius:12,border:"1.5px solid #e2e8f0",padding:16,marginBottom:16}}>
      <div style={{fontWeight:700,color:_NAVY,marginBottom:12}}>Input Rencana Kegiatan Baru</div>
      {[{k:"judul",l:"Judul RK *"},{k:"perihal",l:"Perihal"},{k:"uraian",l:"Uraian Kegiatan"},{k:"catatan",l:"Catatan"}].map(f=><div key={f.k} style={{marginBottom:10}}>
        <label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:3}}>{f.l}</label>
        <input value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={inp}/>
      </div>)}
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <div style={{flex:1}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:3}}>Tanggal Mulai *</label><input type="date" value={form.tanggalMulai} onChange={e=>setForm(p=>({...p,tanggalMulai:e.target.value}))} style={inp}/></div>
        <div style={{flex:1}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:3}}>Tanggal Selesai</label><input type="date" value={form.tanggalSelesai} onChange={e=>setForm(p=>({...p,tanggalSelesai:e.target.value}))} style={inp}/></div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"10px",borderRadius:9,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600}}>Batal</button>
        <button onClick={submitRk} style={{flex:2,padding:"10px",borderRadius:9,border:"none",background:_NAVY,color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>Simpan RK</button>
      </div>
    </div>}
    {rkList.length===0&&!showForm?<div style={{textAlign:"center",padding:"40px 20px",background:"white",borderRadius:12,border:"1.5px solid #e2e8f0",color:"#94a3b8"}}>
      <div style={{fontSize:36,marginBottom:8}}>📋</div><div style={{fontWeight:700}}>Belum ada rencana kegiatan</div>
      <div style={{fontSize:12,marginTop:4}}>Gunakan tombol Input Manual atau Input AI untuk menambahkan RK</div>
    </div>:rkList.map(r=><div key={r.id} style={{background:"white",borderRadius:12,border:"1.5px solid #e2e8f0",padding:"12px 16px",marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,color:_NAVY,fontSize:14}}>{r.judul}</div>
          {r.perihal&&<div style={{fontSize:12,color:"#475569",marginTop:2}}>{r.perihal}</div>}
          <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>{r.tanggalMulai}{r.tanggalSelesai&&" s.d. "+r.tanggalSelesai} · Oleh: {r.dibuatOlehNama}</div>
          {r.uraian&&<div style={{fontSize:12,color:"#334155",marginTop:6,padding:"6px 8px",background:"#f8fafc",borderRadius:6}}>{r.uraian}</div>}
          {r.catatan&&<div style={{fontSize:11,color:"#64748b",marginTop:4,fontStyle:"italic"}}>{r.catatan}</div>}
        </div>
        <button onClick={()=>hapusRk(r.id)} style={{flexShrink:0,padding:"6px 10px",borderRadius:8,border:"1.5px solid #fca5a5",background:"white",color:"#ef4444",cursor:"pointer",fontSize:11,fontWeight:700}}>✕</button>
      </div>
    </div>)}
    {showAI&&<AIModalRK onFill={d=>{setForm(p=>({...p,...d}));setShowForm(true);setShowAI(false);showT("Data terisi dari AI ✓","warn");}} onClose={()=>setShowAI(false)}/>}
  </div>;
}

// AIModal khusus RK — upload langsung tersimpan
function AIModalRK({onFill,onClose}){
  const ref=useRef();const[drag,setDrag]=useState(false);const[loading,setLoading]=useState(false);const[edited,setEdited]=useState(null);const[err,setErr]=useState("");const[savedFile,setSavedFile]=useState(null);
  const analyze=async f=>{
    setLoading(true);setErr("");
    try{
      let b64,mimeType;
      if(f.type==="application/pdf"){b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(f);});mimeType="application/pdf";}
      else{const img=new Image();const url=URL.createObjectURL(f);b64=await new Promise(res=>{img.onload=()=>{URL.revokeObjectURL(url);const c=document.createElement("canvas");let w=img.width,h=img.height;if(w>1024||h>1024){if(w>h){h=Math.round(h*1024/w);w=1024;}else{w=Math.round(w*1024/h);h=1024;}}c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);res(c.toDataURL("image/jpeg",0.75).split(",")[1]);};img.onerror=()=>{const r=new FileReader();r.onload=e=>res(e.target.result.split(",")[1]);r.readAsDataURL(f);};img.src=url;});mimeType="image/jpeg";}
      const PROMPT='Baca dokumen ini dan balas HANYA JSON: {"judul":"","perihal":"","tanggalMulai":"YYYY-MM-DD","tanggalSelesai":"YYYY-MM-DD","uraian":"","catatan":""}';
      const resp=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:[{type:f.type==="application/pdf"?"document":"image",source:{type:"base64",media_type:mimeType,data:b64}},{type:"text",text:PROMPT}]}]})});
      const data=await resp.json().catch(()=>null);
      if(!resp.ok)throw new Error(data?.error||"Server error");
      const txt=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").replace(/```(?:json)?\s*/gi,"").replace(/```/g,"").trim();
      const m=txt.match(/{[\s\S]*}/);
      if(!m)throw new Error("AI tidak mengembalikan JSON");
      setEdited(JSON.parse(m[0]));
      // Simpan file otomatis ke storage
      try{
        let url;
        if(SUPA_OK){url=await storageUpload("undangan",f,f.name);}
        else{url=await new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsDataURL(f);});}
        setSavedFile({url,nama:f.name});
      }catch(e2){console.warn("Gagal simpan file:",e2);}
    }catch(e){setErr(e.message);}
    setLoading(false);
  };
  const inp={width:"100%",padding:"9px 11px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:13};
  return <div style={{position:"fixed",inset:0,zIndex:8200,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:"white",borderRadius:16,width:"100%",maxWidth:500,maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"16px 20px 12px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1}}><div style={{fontSize:16,fontWeight:700,color:"#0A1628"}}>✨ Input RK dengan AI</div><div style={{fontSize:12,color:"#64748b"}}>Upload dokumen — data & file tersimpan otomatis</div></div>
        <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:13,fontWeight:700,color:"#64748b"}}>Tutup</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px 20px"}}>
        {!edited&&!loading&&<>
          <input ref={ref} type="file" accept="application/pdf,image/*" onChange={e=>{if(e.target.files[0])analyze(e.target.files[0]);e.target.value="";}} style={{display:"none"}}/>
          <div onClick={()=>ref.current.click()} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);if(e.dataTransfer.files[0])analyze(e.dataTransfer.files[0]);}} style={{border:"2px dashed "+(drag?"#6366f1":"#c7d2fe"),borderRadius:12,padding:"36px 20px",textAlign:"center",cursor:"pointer",background:drag?"#eef2ff":"#f8faff"}}>
            <div style={{fontSize:36,marginBottom:10}}>📄</div>
            <div style={{fontSize:15,fontWeight:700,color:"#0A1628",marginBottom:4}}>Upload Dokumen RK</div>
            <div style={{fontSize:13,color:"#64748b"}}>PDF, JPG, atau PNG • File otomatis tersimpan ke sistem</div>
          </div>
          {err&&<div style={{marginTop:12,padding:"10px 12px",background:"#fee2e2",borderRadius:8,fontSize:13,color:"#991b1b"}}>{err}</div>}
        </>}
        {loading&&<div style={{textAlign:"center",padding:"40px 20px"}}><div style={{width:48,height:48,border:"4px solid #e0e7ff",borderTopColor:"#6366f1",borderRadius:"50%",animation:"spin 0.9s linear infinite",margin:"0 auto 16px"}}/><div style={{fontSize:14,fontWeight:700,color:"#0A1628"}}>AI menganalisa dokumen...</div><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style></div>}
        {edited&&<>
          <div style={{background:"#d1fae5",borderRadius:9,padding:"9px 12px",marginBottom:12,fontSize:13,color:"#065f46",fontWeight:700}}>✓ Analisa selesai{savedFile?" — file tersimpan: "+savedFile.nama:""}. Edit jika perlu.</div>
          {[{k:"judul",l:"Judul RK"},{k:"perihal",l:"Perihal"},{k:"uraian",l:"Uraian"},{k:"catatan",l:"Catatan"}].map(f=><div key={f.k} style={{marginBottom:9}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:3}}>{f.l}</label><input value={edited[f.k]||""} onChange={e=>setEdited(p=>({...p,[f.k]:e.target.value}))} style={inp}/></div>)}
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:1}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:3}}>Tanggal Mulai</label><input type="date" value={edited.tanggalMulai||""} onChange={e=>setEdited(p=>({...p,tanggalMulai:e.target.value}))} style={inp}/></div>
            <div style={{flex:1}}><label style={{display:"block",fontSize:12,color:"#64748b",fontWeight:600,marginBottom:3}}>Tanggal Selesai</label><input type="date" value={edited.tanggalSelesai||""} onChange={e=>setEdited(p=>({...p,tanggalSelesai:e.target.value}))} style={inp}/></div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <button onClick={()=>setEdited(null)} style={{flex:1,padding:"11px",borderRadius:9,border:"1.5px solid #e2e8f0",background:"white",cursor:"pointer",fontSize:13,fontWeight:600,color:"#64748b"}}>Ulangi</button>
            <button onClick={()=>onFill(edited)} style={{flex:2,padding:"11px",borderRadius:9,border:"none",background:"#0A1628",color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>Gunakan Data Ini</button>
          </div>
        </>}
      </div>
    </div>
  </div>;
}

// PENUGASAN SAYA VIEW
// ═══════════════════════════════════════════════════════
function PenugasanSayaView({events, user, onOpenEvaluasi, isMobile}){
  const NAVY="#0A1628",GOLD="#C9A84C";
  const canSeeAll=["kabag","ajudan_walikota","ajudan_wakilwalikota","kasubbag_protokol","kasubbag_komdokpim"].includes(user.role);
  const approved=events.filter(e=>e.alur==="disetujui").sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));
  // Untuk kabag/ajudan/kasubbag: semua jadwal disetujui; untuk staf: hanya yang ditugaskan ke mereka
  const myEvents=canSeeAll?approved:approved.filter(e=>(e.personil||[]).includes(user.username));
  const allApproved=approved;

  const now=new Date();
  const fmt=t=>{const d=new Date(t);return d.toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"});};
  const upcoming=myEvents.filter(e=>new Date(e.tanggal+"T"+e.jam)>=now);
  const past=myEvents.filter(e=>new Date(e.tanggal+"T"+e.jam)<now);

  const PenCard=({ev,isMyTask})=>{
    const evDt=new Date(ev.tanggal+"T"+ev.jam);
    const isPast=evDt<now;
    const hoursLeft=(evDt-now)/(1000*60*60);
    const isUrgent=hoursLeft>0&&hoursLeft<=24;
    const sudahEval=!!(ev.evaluasi||{})[user.username]?.submitted;
    return(
      <div style={{background:isMyTask?(isPast?"#F8FFFE":"#FAFFFD"):"#FAFBFF",borderRadius:14,border:"1.5px solid "+(isMyTask?(isPast?"#a7f3d0":"#6ee7b7"):"#E2E8F0"),marginBottom:8,overflow:"hidden",opacity:isPast&&!isMyTask?0.6:1}}>
        {isMyTask&&<div style={{background:isPast?"linear-gradient(90deg,#d1fae5,#a7f3d0)":"linear-gradient(90deg,#ECFDF5,#d1fae5)",padding:"5px 14px",fontSize:10,color:isPast?"#065f46":"#047857",fontWeight:800,letterSpacing:0.5,display:"flex",alignItems:"center",gap:5,borderBottom:"1px solid "+(isPast?"#a7f3d0":"#bbf7d0")}}>
          <span>🎯</span> {isPast?"SUDAH BERTUGAS":"ANDA BERTUGAS"}
          {isUrgent&&<span style={{marginLeft:"auto",background:"#FEF3C7",color:"#92400E",borderRadius:4,padding:"1px 7px",fontSize:9}}>⚠️ {Math.round(hoursLeft)} JAM LAGI</span>}
          {isPast&&!sudahEval&&onOpenEvaluasi&&<button onClick={()=>onOpenEvaluasi(ev)} style={{marginLeft:"auto",background:"#7c3aed",color:"white",border:"none",borderRadius:5,padding:"2px 8px",fontSize:9,fontWeight:700,cursor:"pointer"}}>📝 Isi Evaluasi</button>}
          {isPast&&sudahEval&&<span style={{marginLeft:"auto",background:"#d1fae5",color:"#065f46",borderRadius:4,padding:"1px 7px",fontSize:9,fontWeight:700}}>✅ Dievaluasi</span>}
        </div>}
        <div style={{padding:"12px 14px",display:"flex",gap:12,alignItems:"flex-start"}}>
          <div style={{minWidth:44,textAlign:"center",background:isMyTask?(isPast?"#d1fae5":"#ecfdf5"):"#f1f5f9",borderRadius:10,padding:"6px 0"}}>
            <div style={{fontSize:9,fontWeight:800,color:isMyTask?"#065f46":"#64748B",letterSpacing:0.5,textTransform:"uppercase"}}>{new Date(ev.tanggal).toLocaleDateString("id-ID",{weekday:"short"})}</div>
            <div style={{fontSize:20,fontWeight:900,color:isMyTask?(isPast?"#047857":NAVY):"#334155",lineHeight:1}}>{ev.tanggal.slice(8)}</div>
            <div style={{fontSize:10,color:isMyTask?"#059669":"#94A3B8",fontWeight:600}}>{ev.jam}</div>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:800,color:"#0F1C2E",marginBottom:3,lineHeight:1.3}}>{ev.namaAcara}</div>
            <div style={{fontSize:11,color:"#64748B",marginBottom:3}}>{ev.penyelenggara}{ev.lokasi?" · "+ev.lokasi:""}</div>
            {ev.catatanPenugasan&&<div style={{fontSize:11,color:"#4338CA",background:"#EEF2FF",borderRadius:6,padding:"4px 8px",marginTop:4,fontStyle:"italic"}}>💬 {ev.catatanPenugasan}</div>}
            {(ev.personil||[]).length>0&&isMyTask&&<div style={{fontSize:10,color:"#64748B",marginTop:4}}>Rekan: {(ev.personil||[]).filter(u=>u!==user.username).map(u=>getNamaByUsername(u)).join(", ")||"-"}</div>}
          </div>
        </div>
      </div>
    );
  };

  return(
    <div style={{padding:isMobile?"12px 14px":"24px 32px",overflowY:"auto"}}>
      {/* SUMMARY BAR */}
      <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
        {[{n:upcoming.length,l:"Akan Datang",c:NAVY,ic:"📅"},{n:past.length,l:"Selesai",c:"#059669",ic:"✅"},{n:myEvents.filter(e=>!(e.evaluasi||{})[user.username]?.submitted&&new Date(e.tanggal+"T"+e.jam)<now).length,l:"Belum Dievaluasi",c:"#7c3aed",ic:"📝"}].map(it=>(
          <div key={it.l} style={{flex:1,minWidth:90,background:"white",borderRadius:12,padding:"12px",boxShadow:"0 1px 8px rgba(0,0,0,0.06)",border:"1.5px solid #E8EDF4",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:900,color:it.c}}>{it.n}</div>
            <div style={{fontSize:10,color:"#94A3B8",fontWeight:600,marginTop:2}}>{it.ic} {it.l}</div>
          </div>
        ))}
      </div>

      {/* AKAN DATANG */}
      {upcoming.length>0&&<>
        <div style={{fontSize:11,fontWeight:800,color:NAVY,letterSpacing:1.2,textTransform:"uppercase",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
          <span>{user.role==="kabag"?"📊":"📅"}</span> {user.role==="kabag"?"Kegiatan Mendatang":"Penugasan Mendatang"}
        </div>
        {upcoming.map(ev=><PenCard key={ev.id} ev={ev} isMyTask={(ev.personil||[]).includes(user.username)}/>)}
      </>}

      {upcoming.length===0&&past.length===0&&(
        <div style={{textAlign:"center",padding:"50px 20px",color:"#94A3B8"}}>
          <div style={{fontSize:48,marginBottom:10}}>🎯</div>
          <div style={{fontSize:16,fontWeight:700,color:"#334155",marginBottom:6}}>Belum Ada Penugasan</div>
          <div style={{fontSize:13}}>Anda belum ditugaskan ke jadwal manapun saat ini.</div>
        </div>
      )}

      {/* RIWAYAT */}
      {past.length>0&&<>
        <div style={{fontSize:11,fontWeight:800,color:"#64748B",letterSpacing:1.2,textTransform:"uppercase",margin:"18px 0 8px",display:"flex",alignItems:"center",gap:6}}>
          <span>📁</span> Riwayat Penugasan
        </div>
        {past.map(ev=><PenCard key={ev.id} ev={ev} isMyTask={(ev.personil||[]).includes(user.username)}/>)}
      </>}

      {/* SEMUA JADWAL DISETUJUI */}
      <div style={{fontSize:11,fontWeight:800,color:"#64748B",letterSpacing:1.2,textTransform:"uppercase",margin:"22px 0 8px",display:"flex",alignItems:"center",gap:6,borderTop:"1px solid #E2E8F0",paddingTop:16}}>
        <span>🗓️</span> Semua Jadwal Aktif
      </div>
      <div style={{fontSize:11,color:"#94A3B8",marginBottom:10}}>Jadwal yang sudah disetujui — termasuk yang tidak ada penugasan Anda</div>
      {allApproved.length===0
        ?<div style={{textAlign:"center",padding:"20px",color:"#94A3B8",fontSize:13}}>Belum ada jadwal aktif</div>
        :allApproved.map(ev=>{
          const isMy=(ev.personil||[]).includes(user.username);
          return <PenCard key={ev.id} ev={ev} isMyTask={isMy}/>;
        })
      }
    </div>
  );
}





// ── Modal konfirmasi untuk aksi berbahaya ──────────────────────────────
function ConfirmModal({title, body, confirmLabel="Ya, Lanjutkan", confirmColor="#DC2626", onConfirm, onCancel}){
  return (
    <div style={{position:"fixed",inset:0,zIndex:9800,display:"flex",alignItems:"center",
      justifyContent:"center",background:"rgba(0,0,0,0.5)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",padding:16,animation:"fadeIn 0.2s ease"}} onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={e=>e.stopPropagation()}
        style={{background:"white",borderRadius:20,padding:"28px 24px",maxWidth:380,width:"100%",
          boxShadow:"0 24px 60px rgba(0,0,0,0.25)",animation:"up 0.25s cubic-bezier(0.34,1.3,0.64,1)"}}>
        <div style={{width:56,height:56,borderRadius:16,background:confirmColor==="#DC2626"?"#FEF2F2":"#FFFBEB",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
          <span style={{fontSize:28}}>{confirmColor==="#DC2626"?"🗑️":"⚠️"}</span>
        </div>
        <div style={{fontSize:17,fontWeight:800,color:"#0F172A",textAlign:"center",marginBottom:8,lineHeight:1.3}}>{title}</div>
        {body&&<div style={{fontSize:13,color:"#64748B",textAlign:"center",marginBottom:24,lineHeight:1.6}}>{body}</div>}
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel}
            style={{flex:1,padding:"13px",borderRadius:12,border:"1.5px solid #E2E8F0",
              background:"white",color:"#475569",cursor:"pointer",fontSize:13,fontWeight:700}}>
            Batal
          </button>
          <button onClick={()=>{onConfirm();onCancel();}}
            style={{flex:1,padding:"13px",borderRadius:12,border:"none",
              background:confirmColor,color:"white",cursor:"pointer",fontSize:13,fontWeight:800,boxShadow:"0 2px 8px "+confirmColor+"44"}}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// DASHBOARD AJUDAN — ringkas, fokus konfirmasi kehadiran hari ini/besok
// ═══════════════════════════════════════════════════════════════════════
function AjudanDashboard({events, user, upd, showT, setDelegTarget, isMobile}){
  const role=user?.role;
  const NAVY="#0A1628",GOLD="#C9A84C",GREEN="#0D6B4F";
  const now = new Date();
  const toStr = d => localDateStr(d);
  const todayS = toStr(now);
  const tmrw = new Date(); tmrw.setDate(tmrw.getDate()+1);
  const tmrwS = toStr(tmrw);
  const fmt = t => new Date(t).toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long"});

  const approved = events.filter(e=>e.alur==="disetujui").sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));
  const isAjWK = role==="ajudan_walikota";
  const isAjWWK = role==="ajudan_wakilwalikota";
  const needsConfirm = approved.filter(e=>{
    const hasWK = isAjWK && e.untukPimpinan.includes("walikota") && !e.statusWK && !e.delegasiKeWWK;
    const hasWWK = isAjWWK && (e.untukPimpinan.includes("wakilwalikota")||e.delegasiKeWWK) && (!e.statusWWK||e.statusWWK==="");
    return (hasWK||hasWWK) && (e.tanggal===todayS||e.tanggal===tmrwS);
  });
  const allToday = approved.filter(e=>e.tanggal===todayS);
  const allTmrw  = approved.filter(e=>e.tanggal===tmrwS);

  const StatusBtn = ({label, active, color, onClick}) => (
    <button onClick={onClick} style={{
      flex:1, padding:"11px 6px", borderRadius:10, cursor:"pointer",
      fontWeight:800, fontSize:13, transition:"all 0.15s",
      border:"2px solid "+color,
      background:active?color:"white",
      color:active?"white":color}}>
      {label}
    </button>
  );

  const AjudanCard = ({ev}) => {
    const forWK  = isAjWK  && ev.untukPimpinan.includes("walikota");
    const forWWK = isAjWWK && (ev.untukPimpinan.includes("wakilwalikota")||ev.delegasiKeWWK);
    const needWK  = forWK  && !ev.statusWK && !ev.delegasiKeWWK;
    const needWWK = forWWK && !ev.statusWWK;
    const urgent  = (new Date(ev.tanggal+"T"+ev.jam)-now)<3*3600*1000 && new Date(ev.tanggal+"T"+ev.jam)>now;
    return (
      <div style={{background:"white",borderRadius:16,marginBottom:10,overflow:"hidden",
        border:"1.5px solid "+(urgent?"#FCA5A5":needWK||needWWK?"#FDE68A":"#DBEAFE"),
        boxShadow:"0 2px 12px rgba(10,22,40,0.07)"}}>
        {/* Strip urgent */}
        {urgent&&<div style={{background:"#FEF2F2",padding:"4px 14px",fontSize:10,fontWeight:800,color:"#DC2626",letterSpacing:1}}>
          ⚠️ SEGERA — {Math.round((new Date(ev.tanggal+"T"+ev.jam)-now)/3600000)} JAM LAGI
        </div>}
        {(needWK||needWWK)&&!urgent&&<div style={{background:"#FFFBEB",padding:"4px 14px",fontSize:10,fontWeight:800,color:"#B45309",letterSpacing:1}}>
          📋 BELUM DIKONFIRMASI
        </div>}
        <div style={{padding:"12px 14px"}}>
          <div style={{fontSize:14,fontWeight:800,color:"#0F172A",marginBottom:3}}>{ev.namaAcara}</div>
          <div style={{fontSize:12,color:"#64748B",marginBottom:10}}>
            🕐 {ev.jam} WITA &nbsp;·&nbsp; 📍 {ev.lokasi||ev.penyelenggara||"-"}
          </div>
          {/* WK */}
          {forWK&&<div style={{marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:NAVY,textTransform:"uppercase",letterSpacing:0.5,marginBottom:5}}>
              Wali Kota &nbsp;
              {ev.statusWK_by==="ajudan"&&<span style={{background:"#FEF9C3",color:"#92400E",borderRadius:4,padding:"1px 5px",fontSize:9,fontWeight:800}}>diisi Ajudan</span>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <StatusBtn label="✓ Hadir" active={ev.statusWK==="hadir"} color={GREEN}
                onClick={()=>{upd(ev.id,{statusWK:"hadir",delegasiKeWWK:false,perwakilanWK:"",statusWK_by:"ajudan"});showT("Kehadiran WK diinput");loadUsers().filter(u=>(u.role==="kabag"||u.role==="kasubbag_protokol"||u.role==="kasubbag_komdokpim")&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"konfirmasi_kehadiran",labelPimpinan:"Wali Kota",statusKehadiran:"hadir"}));}}/>
              <StatusBtn label="✗ Tidak Hadir" active={ev.statusWK==="tidak_hadir"} color="#991b1b"
                onClick={()=>{upd(ev.id,{statusWK:"tidak_hadir",statusWK_by:"ajudan"});showT("WK: Tidak Hadir");loadUsers().filter(u=>(u.role==="kabag"||u.role==="kasubbag_protokol"||u.role==="kasubbag_komdokpim")&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"konfirmasi_kehadiran",labelPimpinan:"Wali Kota",statusKehadiran:"tidak_hadir"}));}}/>
              <StatusBtn label="→ Delegasi WWK" active={ev.delegasiKeWWK} color="#7C3AED"
                onClick={()=>{upd(ev.id,{statusWK:"diwakilkan",delegasiKeWWK:true,perwakilanWK:"",statusWK_by:"ajudan"});showT("Delegasi ke WWK diinput");
                  sendPush({targetRole:"ajudan_wakilwalikota",title:"↩ Disposisi dari Wali Kota",body:ev.namaAcara+" — "+ev.jam+" WITA: Wali Kota mendelegasikan ke Wakil WK",url:"/",tag:"delegasi-wwk-"+ev.id});
                  loadUsers().filter(u=>u.role==="ajudan_wakilwalikota"&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"delegasi_wwk"}));sendPush({targetRole:"kabag",title:"🔄 Delegasi ke WWK",body:ev.namaAcara+" didelegasikan ke Wakil Wali Kota",url:"/",tag:"delegasi-"+ev.id});sendPush({targetRole:"kasubbag_protokol",title:"🔄 Delegasi ke WWK",body:ev.namaAcara,url:"/",tag:"delegasi-"+ev.id});sendPush({targetRole:"kasubbag_komdokpim",title:"🔄 Delegasi ke WWK",body:ev.namaAcara,url:"/",tag:"delegasi-"+ev.id});}}/>
              {ev.statusWK&&<button onClick={()=>{upd(ev.id,{statusWK:"",delegasiKeWWK:false,perwakilanWK:"",statusWK_by:""});showT("Kehadiran WK dibatalkan","warn");}} style={{width:"100%",marginTop:6,padding:"7px",borderRadius:9,border:"1.5px dashed #94a3b8",background:"#f8fafc",color:"#64748b",cursor:"pointer",fontSize:11,fontWeight:600}}>↩ Batalkan Input Kehadiran WK</button>}
            </div>
            <button onClick={()=>setDelegTarget({id:ev.id,side:"wk"})}
              style={{marginTop:6,width:"100%",padding:"8px",borderRadius:9,border:"1.5px solid #CBD5E1",
                background:"white",color:"#475569",cursor:"pointer",fontSize:11,fontWeight:600}}>
              Wakilkan ke Pejabat Lain
            </button>
          </div>}
          {/* WWK */}
          {forWWK&&<div>
            {/* Info disposisi WK — ditampilkan ke ajudan WWK */}
            {(ev.statusWK||ev.delegasiKeWWK)&&<div style={{background:ev.delegasiKeWWK?"#EDE9FE":ev.statusWK==="hadir"?"#F0FDF4":ev.statusWK==="tidak_hadir"?"#FFF1F2":"#F8FAFC",border:"1.5px solid "+(ev.delegasiKeWWK?"#7c3aed":ev.statusWK==="hadir"?"#6ee7b7":ev.statusWK==="tidak_hadir"?"#fca5a5":"#e2e8f0"),borderRadius:9,padding:"8px 12px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18,flexShrink:0}}>{ev.delegasiKeWWK?"↩":ev.statusWK==="hadir"?"✅":"❌"}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:10,fontWeight:800,color:"#475569",textTransform:"uppercase",letterSpacing:0.5,marginBottom:1}}>Info Kehadiran Wali Kota</div>
                <div style={{fontSize:12,fontWeight:700,color:ev.delegasiKeWWK?"#7c3aed":ev.statusWK==="hadir"?"#065f46":"#991b1b"}}>
                  {ev.delegasiKeWWK?"Didelegasikan ke Wakil Wali Kota":ev.statusWK==="hadir"?"Wali Kota Hadir":ev.statusWK==="tidak_hadir"?"Wali Kota Tidak Hadir":ev.perwakilanWK?"Diwakilkan ke "+ev.perwakilanWK:"—"}
                </div>
                {ev.statusWK_by&&<div style={{fontSize:9,color:"#94a3b8",marginTop:1}}>Diisi: {ev.statusWK_by==="ajudan"?"Ajudan WK":ev.statusWK_by==="walikota"?"Wali Kota langsung":"—"}</div>}
              </div>
            </div>}
            {ev.delegasiKeWWK&&<div style={{background:"#7c3aed",borderRadius:6,padding:"5px 10px",marginBottom:8,fontSize:10,fontWeight:800,color:"white",letterSpacing:0.5}}>↩ ANDA MENERIMA DISPOSISI DARI WALI KOTA</div>}
            <div style={{fontSize:11,fontWeight:700,color:GREEN,textTransform:"uppercase",letterSpacing:0.5,marginBottom:5}}>
              Wakil Wali Kota &nbsp;
              {ev.statusWWK_by==="ajudan"&&<span style={{background:"#FEF9C3",color:"#92400E",borderRadius:4,padding:"1px 5px",fontSize:9,fontWeight:800}}>diisi Ajudan</span>}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <StatusBtn label="✓ Hadir" active={ev.statusWWK==="hadir"} color={GREEN}
                onClick={()=>{upd(ev.id,{statusWWK:"hadir",statusWWK_by:"ajudan",delegasiWWKJajaran:false,perwakilanWWK:""});showT("Kehadiran WWK diinput");loadUsers().filter(u=>(u.role==="kabag"||u.role==="kasubbag_protokol"||u.role==="kasubbag_komdokpim")&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"konfirmasi_kehadiran",labelPimpinan:"Wakil Wali Kota",statusKehadiran:"hadir"}));}}/>
              <StatusBtn label="✗ Tidak Hadir" active={ev.statusWWK==="tidak_hadir"} color="#991b1b"
                onClick={()=>{upd(ev.id,{statusWWK:"tidak_hadir",statusWWK_by:"ajudan",delegasiWWKJajaran:false});showT("WWK: Tidak Hadir");loadUsers().filter(u=>(u.role==="kabag"||u.role==="kasubbag_protokol"||u.role==="kasubbag_komdokpim")&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"konfirmasi_kehadiran",labelPimpinan:"Wakil Wali Kota",statusKehadiran:"tidak_hadir"}));}}/>
              <StatusBtn label="→ Delegasikan" active={ev.statusWWK==="diwakilkan"} color="#7c3aed"
                onClick={()=>{upd(ev.id,{statusWWK:"diwakilkan",delegasiWWKJajaran:true,statusWWK_by:"ajudan"});showT("WWK: Pilih Jajaran");}}/>
            </div>
            {ev.statusWWK==="diwakilkan"&&<div style={{marginTop:8}}>
              <input value={ev.perwakilanWWK||""} onChange={e=>upd(ev.id,{perwakilanWWK:e.target.value})}
                placeholder="Nama pejabat yang mewakili WWK..." style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #CBD5E1",fontSize:12,boxSizing:"border-box",marginBottom:4}}/>
              <button onClick={()=>setDelegTarget({id:ev.id,side:"wwk"})} style={{width:"100%",padding:"7px",borderRadius:8,border:"1.5px dashed #7c3aed",background:"#faf5ff",color:"#7c3aed",cursor:"pointer",fontSize:11,fontWeight:700}}>Pilih dari Daftar Pejabat</button>
            </div>}
            {ev.statusWWK&&<button onClick={()=>{upd(ev.id,{statusWWK:"",statusWWK_by:"",perwakilanWWK:"",delegasiWWKJajaran:false});showT("Kehadiran WWK dibatalkan","warn");}} style={{width:"100%",marginTop:6,padding:"7px",borderRadius:9,border:"1.5px dashed #94a3b8",background:"#f8fafc",color:"#64748b",cursor:"pointer",fontSize:11,fontWeight:600}}>↩ Batalkan Input Kehadiran WWK</button>}
          </div>}
        </div>
      </div>
    );
  };

  const greetHr = now.getHours();
  const greet = greetHr<11?"Selamat Pagi":greetHr<15?"Selamat Siang":greetHr<18?"Selamat Sore":"Selamat Malam";
  return (
    <div style={{flex:1,overflowY:"auto",background:"#F4F7FF"}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,"+NAVY+" 0%,#1B3360 100%)",padding:isMobile?"18px 16px 22px":"26px 32px 30px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:130,height:130,borderRadius:"50%",background:"rgba(201,168,76,0.07)"}}/>
        <div style={{color:"rgba(255,255,255,0.55)",fontSize:12,marginBottom:3}}>{greet},</div>
        <div style={{color:"white",fontSize:isMobile?18:22,fontWeight:900,marginBottom:2}}>{user?.nama||"Ajudan Pimpinan"}</div>
        <div style={{color:GOLD,fontSize:12,fontWeight:600}}>{fmt(todayS)} &nbsp;·&nbsp; {needsConfirm.length} perlu konfirmasi</div>
      </div>

      <div style={{padding:isMobile?"12px 14px":"20px 28px"}}>
        {/* Alert konfirmasi */}
        {needsConfirm.length>0&&<div style={{background:"#FFFBEB",border:"2px solid #F59E0B",borderRadius:14,padding:"14px 16px",marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:24,flexShrink:0}}>🔔</span>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:"#92400E"}}>{needsConfirm.length} jadwal belum dikonfirmasi</div>
            <div style={{fontSize:12,color:"#B45309",marginTop:2}}>Hari ini & besok — segera konfirmasi kehadiran pimpinan</div>
          </div>
        </div>}
        {needsConfirm.length===0&&<div style={{background:"#F0FDF4",border:"1.5px solid #6EE7B7",borderRadius:14,padding:"14px 16px",marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:22,flexShrink:0}}>✅</span>
          <div style={{fontSize:13,fontWeight:700,color:"#065F46"}}>Semua jadwal hari ini & besok sudah terkonfirmasi</div>
        </div>}

        {/* Jadwal perlu konfirmasi */}
        {needsConfirm.length>0&&<>
          <div style={{fontSize:11,fontWeight:800,color:"#B45309",letterSpacing:1.5,textTransform:"uppercase",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
            <span>📋</span> Perlu Konfirmasi Sekarang
          </div>
          {needsConfirm.map(ev=><AjudanCard key={ev.id} ev={ev}/>)}
          <div style={{marginBottom:14}}/>
        </>}

        {/* Jadwal hari ini */}
        {allToday.length>0&&<>
          <div style={{fontSize:11,fontWeight:800,color:NAVY,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
            <span>📅</span> Semua Jadwal Hari Ini ({allToday.length})
          </div>
          {allToday.filter(e=>!needsConfirm.includes(e)).map(ev=>{
            const personilList=(ev.personil||[]).map(un=>{const u=loadUsers().find(x=>x.username===un);return u?.nama||un;});
            return(
            <div key={ev.id} style={{background:"white",borderRadius:12,padding:"12px 14px",marginBottom:8,border:"1px solid #E2E8F0",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{width:44,textAlign:"center",background:"#F0F4FF",borderRadius:10,padding:"6px 4px",flexShrink:0}}>
                  <div style={{fontSize:18,fontWeight:900,color:NAVY}}>{ev.tanggal.slice(8)}</div>
                  <div style={{fontSize:10,color:"#94A3B8"}}>{ev.jam}</div>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#0F172A",marginBottom:2}}>{ev.namaAcara}</div>
                  <div style={{fontSize:11,color:"#64748B",marginBottom:4}}>
                    {ev.statusWK==="hadir"?"✅ WK Hadir":ev.statusWK==="tidak_hadir"?"❌ WK Tidak Hadir":ev.delegasiKeWWK?"↩ WK Delegasi":"⏳ WK Belum"}
                    {(ev.untukPimpinan.includes("wakilwalikota")||ev.delegasiKeWWK)&&
                      " · "+(ev.statusWWK==="hadir"?"✅ WWK Hadir":ev.statusWWK==="tidak_hadir"?"❌ WWK Tidak Hadir":"⏳ WWK Belum")}
                  </div>
                  {personilList.length>0&&<div style={{background:"#F0F9FF",borderRadius:7,padding:"5px 8px",fontSize:11,color:"#0369A1"}}>
                    <span style={{fontWeight:700}}>👥 Personil: </span>{personilList.join(", ")}
                  </div>}
                  {personilList.length===0&&<div style={{fontSize:11,color:"#D97706",fontWeight:600}}>⚠️ Belum ada personil ditugaskan</div>}
                </div>
              </div>
            </div>
          );})}
          <div style={{marginBottom:14}}/>
        </>}

        {/* Jadwal besok */}
        {allTmrw.filter(e=>!needsConfirm.includes(e)).length>0&&<>
          <div style={{fontSize:11,fontWeight:800,color:"#64748B",letterSpacing:1.5,textTransform:"uppercase",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
            <span>🗓️</span> Jadwal Besok
          </div>
          {allTmrw.filter(e=>!needsConfirm.includes(e)).map(ev=>{
            const personilList=(ev.personil||[]).map(un=>{const u=loadUsers().find(x=>x.username===un);return u?.nama||un;});
            return(
            <div key={ev.id} style={{background:"white",borderRadius:12,padding:"12px 14px",marginBottom:8,border:"1px solid #E2E8F0"}}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{width:44,textAlign:"center",background:"#F8FAFF",borderRadius:10,padding:"6px 4px",flexShrink:0}}>
                  <div style={{fontSize:18,fontWeight:900,color:"#475569"}}>{ev.tanggal.slice(8)}</div>
                  <div style={{fontSize:10,color:"#94A3B8"}}>{ev.jam}</div>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#0F172A",marginBottom:2}}>{ev.namaAcara}</div>
                  <div style={{fontSize:11,color:"#64748B",marginBottom:4}}>{ev.penyelenggara||ev.lokasi||""}</div>
                  {personilList.length>0&&<div style={{background:"#F0F9FF",borderRadius:7,padding:"5px 8px",fontSize:11,color:"#0369A1"}}>
                    <span style={{fontWeight:700}}>👥 </span>{personilList.join(", ")}
                  </div>}
                </div>
              </div>
            </div>
          );})}
        </>}
        {approved.length===0&&<div style={{textAlign:"center",padding:"48px 20px",color:"#94A3B8"}}>
          <div style={{fontSize:40,marginBottom:10}}>📭</div>
          <div style={{fontSize:14,fontWeight:700,color:"#475569"}}>Belum ada jadwal disetujui</div>
        </div>}
      </div>
    </div>
  );
}


// ── Onboarding hint untuk user pertama kali login ─────────────────────
function OnboardingModal({role, onClose}){
  const NAVY="#0A1628",GOLD="#C9A84C";
  const hints = {
    staf:[
      {icon:"✏️",title:"Input Jadwal Baru",desc:"Tab 'Input Jadwal' → isi tanggal, jam, nama acara, pilih pimpinan → Simpan Draft"},
      {icon:"📤",title:"Kirim ke Kasubbag",desc:"Setelah draft tersimpan, buka kartu → tombol 'Kirim ke Kasubbag'"},
      {icon:"🎯",title:"Lihat Penugasan",desc:"Tab 'Penugasan Saya' menampilkan kegiatan di mana Anda ditugaskan"},
    ],

    kasubbag_protokol:[
      {icon:"📋",title:"Review Jadwal",desc:"Tab 'Antrian Approval' → klik kartu → Setujui ke Kabag atau Tolak"},
      {icon:"👥",title:"Tugaskan Personil",desc:"Setelah jadwal disetujui, klik kartu → tombol 'Tugaskan Personil'"},
      {icon:"📅",title:"Semua Jadwal",desc:"Tab 'Semua Jadwal' untuk melihat seluruh jadwal yang sudah tayang"},
    ],
    kabag:[
      {icon:"✅",title:"Setujui & Publikasi",desc:"Tab 'Jadwal Saya' → klik kartu menunggu → tombol 'Setujui & Publikasi'"},
      {icon:"👁","title":"Semua Jadwal",desc:"Tab 'Semua Jadwal' untuk memonitor seluruh kegiatan pimpinan"},
      {icon:"👤",title:"Kelola Pengguna",desc:"Menu 'Admin' di sidebar untuk tambah, edit, atau hapus akun pengguna"},
    ],
    timkom:[
      {icon:"📝",title:"Upload Sambutan",desc:"Buka kartu jadwal → bagian 'Naskah Sambutan' → upload file DOCX"},
      {icon:"🎯",title:"Penugasan Saya",desc:"Tab 'Penugasan Saya' menampilkan kegiatan dokumentasi Anda"},
      {icon:"📊",title:"Evaluasi",desc:"Setelah kegiatan selesai → buka kartu → tombol 'Isi Evaluasi'"},
    ],
    ajudan:[
      {icon:"✅",title:"Dashboard Ajudan",desc:"Tampilan utama menampilkan jadwal hari ini & besok yang perlu konfirmasi kehadiran pimpinan"},
      {icon:"📋",title:"Input Kehadiran",desc:"Klik tombol Hadir / Tidak Hadir / Delegasi di setiap kartu jadwal"},
      {icon:"⚠️",title:"Peringatan Penting",desc:"Semua input Anda tercatat sebagai 'diisi Ajudan' — pastikan sudah konfirmasi ke pimpinan"},
    ],
    walikota:[
      {icon:"📅",title:"Jadwal Anda",desc:"Semua agenda yang dijadwalkan untuk Bapak/Ibu tampil di halaman utama"},
      {icon:"✓","title":"Konfirmasi Kehadiran",desc:"Klik kartu agenda → tombol Hadir / Tidak Hadir / Delegasi"},
      {icon:"💬",title:"Catatan untuk Tim",desc:"Buka kartu → bagian 'Arahan / Catatan' → ketik → Simpan Catatan (Ctrl+Enter)"},
    ],
    wakilwalikota:[
      {icon:"📅",title:"Jadwal Anda",desc:"Agenda yang dijadwalkan untuk Bapak/Ibu ditampilkan di halaman utama"},
      {icon:"✓","title":"Konfirmasi Kehadiran",desc:"Klik kartu → tombol Hadir / Tidak Hadir"},
      {icon:"💬",title:"Catatan untuk Tim",desc:"Buka kartu → bagian 'Catatan' → ketik → Ctrl+Enter untuk simpan cepat"},
    ],
    kasubbag_komdokpim:[
      {icon:"📝",title:"Upload Sambutan",desc:"Buka kartu jadwal yang disetujui → bagian 'Naskah Sambutan' → upload DOCX"},
      {icon:"👥",title:"Tugaskan Timkom",desc:"Buka kartu → tombol 'Tugaskan Personil' untuk menentukan siapa yang mendokumentasi"},
      {icon:"🎯",title:"Penugasan",desc:"Tab 'Penugasan Saya' menampilkan jadwal yang melibatkan tim Anda"},
    ],
  };
  const myHints = hints[role]||hints.staf;
  return (
    <div style={{position:"fixed",inset:0,zIndex:9900,display:"flex",alignItems:"center",
      justifyContent:"center",background:"rgba(10,22,40,0.85)",padding:16}}>
      <div style={{background:"white",borderRadius:22,maxWidth:400,width:"100%",overflow:"hidden",
        boxShadow:"0 24px 64px rgba(0,0,0,0.4)"}}>
        <div style={{background:"linear-gradient(135deg,"+NAVY+" 0%,#1B3360 100%)",padding:"24px 22px 20px",textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:8}}>👋</div>
          <div style={{color:"white",fontSize:18,fontWeight:800,marginBottom:4}}>Selamat Datang!</div>
          <div style={{color:"rgba(255,255,255,0.65)",fontSize:12}}>Panduan cepat menggunakan sistem ini</div>
        </div>
        <div style={{padding:"20px 22px"}}>
          {myHints.map((h,i)=>(
            <div key={i} style={{display:"flex",gap:14,marginBottom:i<myHints.length-1?16:0,
              paddingBottom:i<myHints.length-1?16:0,
              borderBottom:i<myHints.length-1?"1px solid #F1F5F9":"none"}}>
              <div style={{width:40,height:40,borderRadius:12,background:"#F0F4FF",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                {h.icon}
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:800,color:"#0F172A",marginBottom:3}}>{h.title}</div>
                <div style={{fontSize:12,color:"#64748B",lineHeight:1.5}}>{h.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{padding:"0 22px 22px"}}>
          <button onClick={onClose}
            style={{width:"100%",padding:"14px",borderRadius:12,border:"none",
              background:"linear-gradient(135deg,"+NAVY+",#1B3360)",color:"white",
              cursor:"pointer",fontSize:14,fontWeight:800,
              boxShadow:"0 6px 20px rgba(10,22,40,0.3)"}}>
            Siap, Mulai! →
          </button>
          <div style={{textAlign:"center",marginTop:10,fontSize:11,color:"#94A3B8"}}>
            Panduan ini tidak akan muncul lagi
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PUSAT NOTIFIKASI (semua role)
// ═══════════════════════════════════════════════════════
function NotifCenter({events, user, onClose, isMobile}){
  const NAVY="#0A1628",GOLD="#C9A84C";
  const role=user?.role;
  const now=new Date();
  const todayS=localDateStr(now);
  const fmt=t=>new Date(t).toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short"});

  // Kumpulkan notifikasi sesuai role
  const notifs=React.useMemo(()=>{
    const list=[];
    const approved=events.filter(e=>e.alur==="disetujui");
    const pending=events.filter(e=>e.alur==="menunggu_kasubbag"||e.alur==="menunggu_kabag");

    // Semua role: jadwal hari ini
    const todayEvs=approved.filter(e=>e.tanggal===todayS&&(e.untukPimpinan?.length>0));
    todayEvs.forEach(e=>list.push({id:"today-"+e.id,icon:"📅",type:"info",title:"Jadwal Hari Ini",body:e.namaAcara+" · "+e.jam+" WITA",ev:e}));

    // Staf & admin_rk: draft lama (>3 hari)
    if(["staf","admin_rk"].includes(role)){
      const drafts=events.filter(e=>e.alur==="draft"&&e.submittedBy===user.username);
      drafts.forEach(e=>{
        const age=(now-new Date(e.id))/86400000;
        if(age>3)list.push({id:"draft-"+e.id,icon:"⏳",type:"warn",title:"Draft Menunggu",body:e.namaAcara+" — sudah "+Math.floor(age)+" hari belum dikirim"});
      });
      // Jadwal ditolak
      events.filter(e=>e.alur==="ditolak"&&e.submittedBy===user.username).forEach(e=>
        list.push({id:"tolak-"+e.id,icon:"❌",type:"error",title:"Jadwal Dikembalikan",body:e.namaAcara+(e.catatanTolak?" — "+e.catatanTolak:"")})
      );
    }

    // Kasubbag: antrian menunggu review
    if(["kasubbag_protokol","kasubbag_komdokpim"].includes(role)){
      const antrian=events.filter(e=>e.alur==="menunggu_kasubbag"&&!e.alurHapus);
      if(antrian.length>0)list.push({id:"antrian-kasub",icon:"📋",type:"warn",title:antrian.length+" Jadwal Menunggu Review",body:antrian.map(e=>e.namaAcara).join(", ")});
      // H-12 belum ditugaskan
      const unassigned=approved.filter(e=>{
        const h=(new Date(e.tanggal+"T"+e.jam)-now)/3600000;
        return h>0&&h<=12&&(!e.personil||e.personil.length===0);
      });
      if(unassigned.length>0)list.push({id:"unassigned-kasub",icon:"⚠️",type:"error",title:unassigned.length+" Jadwal Tanpa Personil (H-12)",body:unassigned.map(e=>e.namaAcara).join(", ")});
    }

    // Kabag: antrian menunggu persetujuan final
    if(role==="kabag"){
      const antrianKabag=events.filter(e=>e.alur==="menunggu_kabag"&&!e.alurHapus);
      if(antrianKabag.length>0)list.push({id:"antrian-kabag",icon:"✅",type:"warn",title:antrianKabag.length+" Jadwal Menunggu Persetujuan Anda",body:antrianKabag.map(e=>e.namaAcara).join(", ")});
      const hapus=events.filter(e=>e.alurHapus==="menunggu_kabag");
      if(hapus.length>0)list.push({id:"hapus-kabag",icon:"🗑️",type:"error",title:hapus.length+" Permintaan Batal Tayang",body:hapus.map(e=>e.namaAcara).join(", ")});
    }

    // Ajudan: belum konfirmasi kehadiran (hari ini + besok)
    if(role==="ajudan_walikota"||role==="ajudan_wakilwalikota"){
      const tmrwS=localDateStr(new Date(now.getTime()+86400000));
      const isWK=role==="ajudan_walikota";
      const belum=approved.filter(e=>{
        const tgl=e.tanggal;
        if(tgl!==todayS&&tgl!==tmrwS)return false;
        if(isWK)return e.untukPimpinan.includes("walikota")&&!e.statusWK&&!e.delegasiKeWWK;
        return (e.untukPimpinan.includes("wakilwalikota")||e.delegasiKeWWK)&&!e.statusWWK;
      });
      if(belum.length>0)list.push({id:"konfirmasi-ajudan",icon:"🔔",type:"warn",title:belum.length+" Jadwal Belum Dikonfirmasi",body:"Hari ini & besok — segera konfirmasi kehadiran pimpinan"});
    }

    // Timkom: penugasan baru H-12
    if(role==="timkom"){
      const myNew=approved.filter(e=>{
        const h=(new Date(e.tanggal+"T"+e.jam)-now)/3600000;
        return h>0&&h<=24&&(e.personil||[]).includes(user.username);
      });
      if(myNew.length>0)list.push({id:"tugas-timkom",icon:"🎯",type:"info",title:"Penugasan Mendatang (24 Jam)",body:myNew.map(e=>e.namaAcara+" ("+e.jam+")").join(", ")});
    }

    if(list.length===0)list.push({id:"kosong",icon:"✅",type:"ok",title:"Tidak Ada Notifikasi",body:"Semua jadwal berjalan normal"});
    return list;
  },[events,role,user,todayS]);

  const colorMap={info:{bg:"#EFF6FF",border:"#BFDBFE",title:"#1D4ED8"},warn:{bg:"#FFFBEB",border:"#FDE68A",title:"#92400E"},error:{bg:"#FFF1F2",border:"#FECDD3",title:"#B91C1C"},ok:{bg:"#F0FDF4",border:"#BBF7D0",title:"#065F46"}};

  return(
    <div style={{position:"fixed",inset:0,zIndex:9800,display:"flex",alignItems:"flex-end",justifyContent:isMobile?"center":"flex-end",background:"rgba(10,22,40,0.5)",padding:isMobile?"0":"20px 24px"}} onClick={onClose}>
      <div style={{background:"white",borderRadius:isMobile?"20px 20px 0 0":16,width:isMobile?"100%":380,maxHeight:"80vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.35)"}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,"+NAVY+" 0%,#1B3360 100%)",padding:"16px 18px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{color:"white",fontSize:15,fontWeight:800}}>🔔 Pusat Notifikasi</div>
            <div style={{color:"rgba(255,255,255,0.55)",fontSize:11,marginTop:2}}>{notifs.filter(n=>n.type!=="ok").length} notifikasi aktif</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.12)",border:"none",color:"white",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        {/* List */}
        <div style={{overflowY:"auto",padding:"12px 14px 20px",flex:1}}>
          {notifs.map(n=>{
            const c=colorMap[n.type]||colorMap.info;
            return(
              <div key={n.id} style={{background:c.bg,border:"1.5px solid "+c.border,borderRadius:12,padding:"12px 14px",marginBottom:10}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <span style={{fontSize:20,flexShrink:0}}>{n.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:800,color:c.title,marginBottom:3}}>{n.title}</div>
                    <div style={{fontSize:12,color:"#475569",lineHeight:1.5}}>{n.body}</div>
                    {n.ev&&<div style={{marginTop:5,fontSize:11,color:"#64748B",fontWeight:600}}>📍 {n.ev.lokasi||n.ev.penyelenggara||"—"}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// REKAP EVALUASI — Organizational CPI (penilaian kinerja tim, bukan individu)
// Setiap kegiatan: skor dirata-rata dari seluruh evaluator yang mengisi
// ═══════════════════════════════════════════════════════
const EVAL_PROTOKOL_KEYS=["Persiapan tata acara","Pengaturan posisi & alur","Koordinasi lapangan","Pelaksanaan rundown","Penanganan kendala"];
const EVAL_KOMDOK_KEYS=["Tangkapan foto/video","Koordinasi protokol","Kesiapan peralatan","Kecepatan publikasi","Kelayakan dokumentasi"];

// calcCPIOrg: agregasi semua evaluator per kegiatan, lalu hitung CPI organisasi
function calcCPIOrg(evList){
  // Untuk setiap kegiatan, rata-ratakan semua evaluasi yang submitted
  const records=evList.map(e=>{
    const allEvals=Object.values(e.evaluasi||{}).filter(v=>v.submitted);
    if(allEvals.length===0)return null;
    const nK=5;
    const avgScores=Array(nK).fill(0).map((_,k)=>
      allEvals.reduce((a,v)=>a+(v["s"+k]??60),0)/allEvals.length
    );
    // Tipe dominan
    const tipes=allEvals.map(v=>v.tipe||"Protokol");
    const tipe=tipes.sort((a,b)=>tipes.filter(x=>x===b).length-tipes.filter(x=>x===a).length)[0];
    return{
      date:new Date(e.tanggal),
      scores:avgScores,
      tipe,
      eventName:e.namaAcara,
      evalCount:allEvals.length,
      eventId:e.id,
    };
  }).filter(Boolean).sort((a,b)=>a.date-b.date);

  if(records.length===0)return null;

  const eventScores=records.map(r=>r.scores.reduce((a,b)=>a+b,0)/r.scores.length);
  const now=new Date();
  const λ=0.08;
  const weights=records.map(r=>{
    const monthsAgo=(now-r.date)/(1000*60*60*24*30.44);
    return Math.exp(-λ*monthsAgo);
  });
  const wSum=weights.reduce((a,b)=>a+b,0);
  const WPS=weights.reduce((acc,w,i)=>acc+w*eventScores[i],0)/wSum;

  const mean=eventScores.reduce((a,b)=>a+b,0)/eventScores.length;
  const variance=eventScores.reduce((a,s)=>a+(s-mean)**2,0)/eventScores.length;
  const stdDev=Math.sqrt(variance);
  const CV=mean>0?stdDev/mean:0;
  const CS=Math.max(0,100*(1-CV));

  let trendScore=50;
  if(records.length>=3){
    const n=eventScores.length,xMean=(n-1)/2,yMean=mean;
    const num=eventScores.reduce((a,y,x)=>a+(x-xMean)*(y-yMean),0);
    const den=eventScores.reduce((a,_,x)=>a+(x-xMean)**2,0);
    const slope=den!==0?num/den:0;
    trendScore=Math.min(100,Math.max(0,50+slope*2.5));
  }

  const CPI=Math.round(0.60*WPS+0.25*CS+0.15*trendScore);
  const nKriteria=5;
  const kriteriaScores=Array(nKriteria).fill(0).map((_,k)=>{
    const wS=records.reduce((a,r,i)=>a+weights[i]*r.scores[k],0);
    return Math.round(wS/wSum);
  });
  const grade=CPI>=85?"A":CPI>=70?"B":CPI>=55?"C":CPI>=40?"D":"E";
  const gradeColor=CPI>=85?"#065F46":CPI>=70?"#1D4ED8":CPI>=55?"#D97706":CPI>=40?"#B45309":"#991B1B";
  const gradeBg=CPI>=85?"#D1FAE5":CPI>=70?"#DBEAFE":CPI>=55?"#FEF3C7":CPI>=40?"#FEF9C3":"#FEE2E2";
  return{
    records,eventScores,WPS:Math.round(WPS),CS:Math.round(CS),
    trendScore:Math.round(trendScore),CPI,grade,gradeColor,gradeBg,
    kriteriaScores,stdDev:Math.round(stdDev),
    trend:trendScore>60?"naik":trendScore<40?"turun":"stabil",
  };
}

function RekapEvaluasi({events,user,isMobile}){
  const NAVY="#0A1628",GOLD="#C9A84C",GREEN="#0D6B4F";
  const [filterPeriod,setFilterPeriod]=React.useState("semua");
  const [activeTeam,setActiveTeam]=React.useState("semua"); // semua|Protokol|Komdok
  const now=new Date();

  // Filter periode
  const periodFiltered=React.useMemo(()=>events.filter(e=>{
    if(filterPeriod==="semua")return true;
    const d=new Date(e.tanggal);
    const mo=(now-d)/(1000*60*60*24*30.44);
    if(filterPeriod==="bulan")return mo<=1;
    if(filterPeriod==="triwulan")return mo<=3;
    if(filterPeriod==="semester")return mo<=6;
    return true;
  }),[events,filterPeriod]);

  // CPI per tim (berdasarkan tipe evaluasi dominan per kegiatan)
  const evProto=periodFiltered.filter(e=>{
    const vals=Object.values(e.evaluasi||{}).filter(v=>v.submitted);
    if(!vals.length)return false;
    const tipes=vals.map(v=>v.tipe||"Protokol");
    const proto=tipes.filter(t=>t==="Protokol").length;
    return proto>=tipes.length/2;
  });
  const evKomdok=periodFiltered.filter(e=>{
    const vals=Object.values(e.evaluasi||{}).filter(v=>v.submitted);
    if(!vals.length)return false;
    const tipes=vals.map(v=>v.tipe||"Protokol");
    const komdok=tipes.filter(t=>t==="Komdok"||t==="Komdok").length;
    return komdok>tipes.length/2;
  });

  const evAll=periodFiltered.filter(e=>Object.values(e.evaluasi||{}).some(v=>v.submitted));
  const cpiSemua=calcCPIOrg(evAll);
  const cpiProto=calcCPIOrg(evProto);
  const cpiKomdok=calcCPIOrg(evKomdok);

  // Yang ditampilkan di tabel berdasarkan filter
  const activeEv=activeTeam==="Protokol"?evProto:activeTeam==="Komdok"?evKomdok:evAll;
  const cpiActive=activeTeam==="Protokol"?cpiProto:activeTeam==="Komdok"?cpiKomdok:cpiSemua;
  const activeKeys=activeTeam==="Komdok"?EVAL_KOMDOK_KEYS:EVAL_PROTOKOL_KEYS;

  // Ring chart
  const Ring=({value,size=52,stroke=7,color="#065F46"})=>{
    if(!value&&value!==0)return<div style={{width:size,height:size,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#94A3B8"}}>—</div>;
    const r=(size-stroke)/2;
    const circ=2*Math.PI*r;
    const filled=circ*(value/100);
    return(
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{flexShrink:0}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}/>
        <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={size*0.22} fontWeight="900">{value}</text>
      </svg>
    );
  };

  const Sparkline=({scores,color="#1D4ED8",w=80,h=28})=>{
    if(!scores||scores.length<2)return null;
    const mn=Math.min(...scores),mx=Math.max(...scores);
    const range=mx-mn||1;
    const pts=scores.map((s,i)=>{
      const x=i*(w/(scores.length-1));
      const y=h-(((s-mn)/range)*(h-6)+3);
      return`${x},${y}`;
    }).join(" ");
    const lx=(scores.length-1)*(w/(scores.length-1));
    const ly=h-(((scores[scores.length-1]-mn)/range)*(h-6)+3);
    return(
      <svg width={w} height={h} style={{overflow:"visible"}}>
        <polyline points={pts} fill="none" stroke={color+"44"} strokeWidth={1.5}/>
        <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}/>
        <circle cx={lx} cy={ly} r={3} fill={color}/>
      </svg>
    );
  };

  const CPICard=({label,cpi,icon,onClick,active})=>{
    const hasData=!!cpi;
    return(
      <div onClick={onClick} style={{flex:1,background:active?"white":"#F8FAFC",borderRadius:14,padding:"14px",border:`2px solid ${active?(cpi?.gradeColor||NAVY):"#E2E8F0"}`,cursor:"pointer",boxShadow:active?"0 4px 16px rgba(10,22,40,0.1)":"none",transition:"all 0.2s"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:hasData?10:0}}>
          <div>
            <div style={{fontSize:10,color:"#94A3B8",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>{icon} {label}</div>
            {hasData&&<div style={{fontSize:10,color:"#94A3B8",marginTop:1}}>{cpi.records.length} kegiatan dievaluasi</div>}
          </div>
          {hasData?<Ring value={cpi.CPI} size={48} stroke={7} color={cpi.gradeColor}/>
            :<div style={{fontSize:11,color:"#CBD5E1"}}>Belum ada data</div>}
        </div>
        {hasData&&<>
          <div style={{display:"flex",gap:6,marginTop:8}}>
            {[{l:"WPS",v:cpi.WPS},{l:"CS",v:cpi.CS},{l:"Tren",v:cpi.trendScore}].map(m=>(
              <div key={m.l} style={{flex:1,textAlign:"center",background:"#F1F5F9",borderRadius:7,padding:"5px 4px"}}>
                <div style={{fontSize:13,fontWeight:900,color:NAVY}}>{m.v}</div>
                <div style={{fontSize:9,color:"#94A3B8",fontWeight:700}}>{m.l}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10}}>
            <div style={{flex:1,height:6,borderRadius:3,background:"#F1F5F9",overflow:"hidden"}}>
              <div style={{height:"100%",width:cpi.CPI+"%",background:cpi.gradeColor,borderRadius:3,transition:"width 0.6s ease"}}/>
            </div>
            <span style={{padding:"2px 8px",borderRadius:5,background:cpi.gradeBg,color:cpi.gradeColor,fontSize:11,fontWeight:800}}>{cpi.grade}</span>
          </div>
          <div style={{fontSize:10,color:"#94A3B8",marginTop:5}}>Tren: {cpi.trend==="naik"?"↑ Meningkat":cpi.trend==="turun"?"↓ Menurun":"→ Stabil"}</div>
        </>}
      </div>
    );
  };

  const noData=!cpiSemua;

  return(
    <div style={{padding:isMobile?"12px 14px":"20px 28px",overflowY:"auto",flex:1,background:"#F4F7FF"}}>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${NAVY},#1A2F50)`,borderRadius:16,padding:"20px",marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,width:120,height:120,borderRadius:"50%",background:"rgba(201,168,76,0.08)"}}/>
        <div style={{color:GOLD,fontSize:11,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>Rekap Kinerja Tim</div>
        <div style={{color:"white",fontSize:isMobile?16:20,fontWeight:900,marginBottom:3}}>Evaluasi Kinerja Organisasi</div>
        <div style={{color:"rgba(255,255,255,0.55)",fontSize:11}}>
          Skor digabungkan dari seluruh personil · {evAll.length} kegiatan terevaluasi
        </div>
      </div>

      {/* Filter Periode */}
      <div style={{display:"flex",gap:4,background:"white",padding:"4px",borderRadius:10,border:"1px solid #E2E8F0",marginBottom:14,width:"fit-content"}}>
        {[["semua","Semua"],["bulan","30 Hari"],["triwulan","3 Bulan"],["semester","6 Bulan"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilterPeriod(v)} style={{padding:"5px 12px",borderRadius:8,border:"none",background:filterPeriod===v?NAVY:"transparent",color:filterPeriod===v?"white":"#64748B",cursor:"pointer",fontSize:11,fontWeight:700,transition:"all 0.15s"}}>{l}</button>
        ))}
      </div>

      {noData&&<div style={{textAlign:"center",padding:"60px 24px",background:"white",borderRadius:16}}>
        <div style={{fontSize:40,marginBottom:10}}>📊</div>
        <div style={{fontSize:14,fontWeight:700,color:"#475569"}}>Belum ada data evaluasi</div>
        <div style={{fontSize:12,color:"#94A3B8",marginTop:4}}>Data akan muncul setelah personil mengisi evaluasi pasca kegiatan</div>
      </div>}

      {!noData&&<>
        {/* 3 CPI Card — Semua / Protokol / Komdok */}
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <CPICard label="Semua Tim" icon="🏛️" cpi={cpiSemua} active={activeTeam==="semua"} onClick={()=>setActiveTeam("semua")}/>
          <CPICard label="Tim Protokol" icon="🎗️" cpi={cpiProto} active={activeTeam==="Protokol"} onClick={()=>setActiveTeam("Protokol")}/>
          <CPICard label="Tim Komdok" icon="📸" cpi={cpiKomdok} active={activeTeam==="Komdok"} onClick={()=>setActiveTeam("Komdok")}/>
        </div>

        {cpiActive&&<>
          {/* Per Kriteria */}
          <div style={{background:"white",borderRadius:14,padding:"16px",marginBottom:14,border:"1px solid #E2E8F0"}}>
            <div style={{fontSize:11,fontWeight:800,color:NAVY,letterSpacing:1,textTransform:"uppercase",marginBottom:14}}>🎯 Skor Per Kriteria (Rata-rata Tertimbang Waktu)</div>
            {(activeTeam==="Komdok"?EVAL_KOMDOK_KEYS:EVAL_PROTOKOL_KEYS).map((k,i)=>{
              const s=cpiActive.kriteriaScores[i];
              const barColor=s>=80?"#059669":s>=60?"#2563EB":s>=40?"#D97706":"#DC2626";
              return(
                <div key={i} style={{marginBottom:11}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:12,color:"#334155",fontWeight:600}}>{i+1}. {k}</span>
                    <span style={{fontSize:13,fontWeight:900,color:barColor}}>{s}</span>
                  </div>
                  <div style={{height:8,borderRadius:5,background:"#F1F5F9",overflow:"hidden"}}>
                    <div style={{height:"100%",width:s+"%",background:barColor,borderRadius:5,transition:"width 0.6s ease"}}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Riwayat per kegiatan */}
          <div style={{background:"white",borderRadius:14,overflow:"hidden",border:"1px solid #E2E8F0",marginBottom:14}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #F1F5F9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:12,fontWeight:800,color:NAVY}}>📋 Riwayat Evaluasi Per Kegiatan</div>
              <div style={{fontSize:10,color:"#94A3B8"}}>{cpiActive.records.length} kegiatan · skor = rata-rata semua evaluator</div>
            </div>
            {[...cpiActive.records].reverse().map((r,i)=>{
              const s=Math.round(cpiActive.eventScores[cpiActive.records.length-1-i]);
              const c=s>=80?"#059669":s>=60?"#2563EB":s>=40?"#D97706":"#DC2626";
              const bg=s>=80?"#D1FAE5":s>=60?"#DBEAFE":s>=40?"#FEF3C7":"#FEE2E2";
              return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",borderBottom:"1px solid #F8FAFC",background:i%2===0?"white":"#FAFBFF"}}>
                  <div style={{width:38,textAlign:"center",flexShrink:0,background:"#F8FAFC",borderRadius:9,padding:"5px 4px",border:"1px solid #E2E8F0"}}>
                    <div style={{fontSize:14,fontWeight:900,color:NAVY}}>{r.date.getDate()}</div>
                    <div style={{fontSize:9,color:"#94A3B8"}}>{r.date.toLocaleDateString("id-ID",{month:"short"})}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#1E293B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.eventName}</div>
                    <div style={{fontSize:10,color:"#94A3B8",marginTop:2}}>{r.tipe} · {r.evalCount} evaluator</div>
                  </div>
                  {!isMobile&&<div style={{width:64,flexShrink:0}}>
                    <Sparkline scores={[s]} color={c} w={50} h={20}/>
                  </div>}
                  <div style={{textAlign:"center",flexShrink:0}}>
                    <div style={{fontSize:17,fontWeight:900,color:c}}>{s}</div>
                    <div style={{padding:"1px 6px",borderRadius:4,background:bg,color:c,fontSize:9,fontWeight:800}}>{"/ 100"}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Metodologi */}
          <div style={{background:"white",borderRadius:12,padding:"14px 16px",border:"1px solid #E2E8F0"}}>
            <div style={{fontSize:11,fontWeight:800,color:NAVY,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>📐 Metodologi Skoring CPI</div>
            <div style={{fontSize:11,color:"#475569",lineHeight:1.8}}>
              <span style={{fontWeight:700,color:NAVY}}>CPI</span> = 0.60 × WPS + 0.25 × CS + 0.15 × Tren<br/>
              <span style={{color:"#94A3B8",fontSize:10}}>
                · Setiap kegiatan: skor dirata-rata dari semua personil yang mengisi evaluasi<br/>
                · <b>WPS</b>: Rata-rata tertimbang waktu (kegiatan terbaru bobot lebih tinggi, λ=0.08/bln)<br/>
                · <b>CS</b>: Konsistensi antar kegiatan — 100×(1−CV) di mana CV=σ/μ<br/>
                · <b>Tren</b>: Regresi linier skor kegiatan, dinormalisasi ke 0–100 (50=stabil)
              </span>
            </div>
            <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
              {[["A","≥85","#065F46","#D1FAE5"],["B","≥70","#1D4ED8","#DBEAFE"],["C","≥55","#D97706","#FEF3C7"],["D","≥40","#B45309","#FEF9C3"],["E","<40","#991B1B","#FEE2E2"]].map(([g,r,c,bg])=>(
                <div key={g} style={{padding:"3px 10px",borderRadius:6,background:bg,color:c,fontSize:11,fontWeight:700,border:`1px solid ${c}22`}}>{g} {r}</div>
              ))}
            </div>
          </div>
        </>}
      </>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ── Komponen textarea isolasi agar typing tidak re-render seluruh dashboard ──
function RejectTextarea({evId,placeholder,rows,style,onCommit}){
  const[val,setVal]=useState("");
  // Sync nilai keluar ke parent hanya onBlur (bukan tiap keystroke)
  const commit=v=>onCommit(evId,v);
  return <textarea
    placeholder={placeholder}
    value={val}
    rows={rows||2}
    style={style}
    onChange={e=>setVal(e.target.value)}
    onBlur={e=>commit(e.target.value)}
  />;
}

// DASHBOARD KABAG — Antrian, Jadwal+Penugasan, Batal Tayang
// ═══════════════════════════════════════════════════════
function KabagDashboard({events, user, upd, showT, askConfirm, deleteAndSync, isMobile}){
  const NAVY="#0A1628",GOLD="#C9A84C",GREEN="#0D6B4F";
  const [activeTab, setActiveTab] = useState("antrian");
  const [expandedId, setExpanded] = useState(null);
  const [rejectTexts, setRT] = useState({});
  const now=new Date();
  const fmt=t=>new Date(t).toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long"});
  const fmtShort=t=>new Date(t).toLocaleDateString("id-ID",{day:"numeric",month:"short"});
  const getNamaByUsername=un=>loadUsers().find(u=>u.username===un)?.nama||un;

  const antrian=events.filter(e=>e.alur==="menunggu_kabag"&&!e.alurHapus).sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));
  const permintaanBatal=events.filter(e=>e.alurHapus==="menunggu_kabag");
  const approved=events.filter(e=>e.alur==="disetujui").sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));

  const tabs=[
    {key:"antrian",label:"Antrian",icon:"📋",badge:antrian.length},
    {key:"jadwal",label:"Jadwal Tayang",icon:"🗓️",badge:0},
    {key:"batal",label:"Batal Tayang",icon:"🚫",badge:permintaanBatal.length},
  ];

  const StatusChip=({alur})=>{
    const map={disetujui:{bg:"#D1FAE5",c:"#065F46",l:"Disetujui"},menunggu_kabag:{bg:"#FEF9C3",c:"#92400E",l:"Menunggu Kabag"},menunggu_kasubbag:{bg:"#DBEAFE",c:"#1E40AF",l:"Menunggu Kasubbag"},ditolak:{bg:"#FEE2E2",c:"#991B1B",l:"Ditolak"},draft:{bg:"#F1F5F9",c:"#475569",l:"Draft"}};
    const s=map[alur]||{bg:"#F1F5F9",c:"#475569",l:alur};
    return <span style={{background:s.bg,color:s.c,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:800}}>{s.l}</span>;
  };

  const AntrianCard=({ev})=>{
    const exp=expandedId===ev.id;
    return(
      <div style={{background:"white",borderRadius:14,marginBottom:10,overflow:"hidden",border:"1.5px solid #DBEAFE",boxShadow:"0 2px 10px rgba(10,22,40,0.07)"}}>
        <div style={{padding:"14px 16px",cursor:"pointer",display:"flex",gap:12,alignItems:"flex-start"}} onClick={()=>setExpanded(exp?null:ev.id)}>
          <div style={{width:46,textAlign:"center",background:"#EFF6FF",borderRadius:10,padding:"6px 4px",flexShrink:0}}>
            <div style={{fontSize:17,fontWeight:900,color:NAVY}}>{ev.tanggal.slice(8)}</div>
            <div style={{fontSize:9,color:"#64748B"}}>{fmtShort(ev.tanggal).split(" ")[1]}</div>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:800,color:"#0F172A",marginBottom:3}}>{ev.namaAcara}</div>
            <div style={{fontSize:11,color:"#64748B"}}>🕐 {ev.jam} · {ev.penyelenggara||ev.lokasi||"—"}</div>
            <div style={{marginTop:3,marginBottom:2}}><TujuanBadge ev={ev}/></div>
            <div style={{fontSize:11,color:"#94A3B8",marginTop:2}}>Diajukan oleh: {getNamaByUsername(ev.submittedBy)}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            <StatusChip alur={ev.alur}/>
            <span style={{fontSize:14,color:"#94A3B8"}}>{exp?"▲":"▼"}</span>
          </div>
        </div>
        {exp&&<div style={{borderTop:"1px solid #EFF6FF",padding:"12px 16px",background:"#FAFBFF"}}>
          {/* Detail event */}
          {[{l:"Tanggal",v:fmt(ev.tanggal)},{l:"Jam",v:ev.jam+" WITA"},{l:"Penyelenggara",v:ev.penyelenggara},{l:"Lokasi",v:ev.lokasi},{l:"Pakaian",v:ev.pakaian},{l:"Catatan",v:ev.catatan}].filter(f=>f.v).map(f=>(
            <div key={f.l} style={{display:"flex",gap:8,marginBottom:5}}>
              <span style={{minWidth:90,fontSize:11,color:"#94A3B8",fontWeight:600}}>{f.l}</span>
              <span style={{fontSize:12,color:"#1E293B",flex:1}}>{f.v}</span>
            </div>
          ))}
          {/* Keterangan beserta istri */}
          {(ev.besertaIstriWK||ev.besertaIstriWWK)&&<div style={{display:"flex",gap:6,marginTop:4,marginBottom:6,flexWrap:"wrap"}}>
            {ev.besertaIstriWK&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:"#fdf2f8",border:"1px solid #f9a8d4",color:"#be185d",fontWeight:600}}>💑 WK beserta Istri</span>}
            {ev.besertaIstriWWK&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:"#fdf2f8",border:"1px solid #f9a8d4",color:"#be185d",fontWeight:600}}>💑 WWK beserta Istri</span>}
          </div>}
          {/* Aksi */}
          <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
            <button onClick={()=>{upd(ev.id,{alur:"disetujui"});showT("Jadwal disetujui & dipublikasi");const u=loadUsers().find(x=>x.username===ev.submittedBy);if(u?.noWA)sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"approved",submittedBy:getNamaByUsername(ev.submittedBy)});sendPush({targetRole:"admin_rk",title:"✅ Jadwal Disetujui",body:ev.namaAcara+" sudah dipublikasi",url:"/",tag:"approved-"+ev.id});loadUsers().filter(u=>(u.role==="ajudan_walikota"||u.role==="ajudan_wakilwalikota")&&u.noWA).forEach(u=>{const isWK=u.role==="ajudan_walikota"&&(ev.untukPimpinan||[]).includes("walikota");const isWWK=u.role==="ajudan_wakilwalikota"&&((ev.untukPimpinan||[]).includes("wakilwalikota")||ev.delegasiKeWWK);if(isWK||isWWK)sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"approved"});});setExpanded(null);}}
              style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:NAVY,color:"white",cursor:"pointer",fontSize:13,fontWeight:800}}>
              ✅ Setujui & Publikasi
            </button>
            <div style={{borderRadius:10,overflow:"hidden",border:"1.5px solid #FECACA"}}>
              <RejectTextarea evId={ev.id} placeholder="Catatan penolakan..." rows={2}
                style={{width:"100%",padding:"9px 11px",border:"none",resize:"none",color:"#334155",background:"white",fontSize:12,boxSizing:"border-box"}}
                onCommit={(id,v)=>setRT(p=>({...p,[id]:v}))}/>
              <button onClick={()=>{if(!(rejectTexts[ev.id]||"").trim()){showT("Tulis alasan penolakan dulu","warn");return;}askConfirm("Tolak Jadwal?","Jadwal '"+ev.namaAcara+"' akan dikembalikan ke staf dengan catatan penolakan.",()=>{const catatan=rejectTexts[ev.id]||"Perlu diperbaiki";upd(ev.id,{alur:"ditolak",catatanTolak:catatan,_requiresEdit:true});showT("Dikembalikan ke Admin RK","warn");const u=loadUsers().find(x=>x.username===ev.submittedBy);if(u?.noWA)sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,event:"rejected",catatanTolak:catatan,submittedBy:getNamaByUsername(ev.submittedBy)});sendPush({targetRole:"admin_rk",title:"❌ Jadwal Dikembalikan Kabag",body:ev.namaAcara+": "+catatan,url:"/",tag:"rejected-"+ev.id});setExpanded(null);},"Tolak","#991B1B")}}
                style={{width:"100%",padding:"10px",border:"none",background:"#FEE2E2",color:"#991B1B",cursor:"pointer",fontSize:12,fontWeight:700}}>
                ❌ Tolak & Kembalikan ke Staf
              </button>
            </div>
          </div>
        </div>}
      </div>
    );
  };

  const JadwalCard=({ev})=>{
    const exp=expandedId===ev.id;
    const personilList=(ev.personil||[]).map(un=>({un,nama:getNamaByUsername(un)}));
    const pctConfirm=[ev.statusWK,ev.statusWWK].filter(Boolean).length;
    return(
      <div style={{background:"white",borderRadius:14,marginBottom:10,overflow:"hidden",border:"1.5px solid #D1FAE5",boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
        <div style={{padding:"13px 16px",cursor:"pointer",display:"flex",gap:12,alignItems:"flex-start"}} onClick={()=>setExpanded(exp?null:ev.id)}>
          <div style={{width:46,textAlign:"center",background:"#ECFDF5",borderRadius:10,padding:"6px 4px",flexShrink:0}}>
            <div style={{fontSize:17,fontWeight:900,color:GREEN}}>{ev.tanggal.slice(8)}</div>
            <div style={{fontSize:9,color:"#64748B"}}>{fmtShort(ev.tanggal).split(" ")[1]}</div>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:800,color:"#0F172A",marginBottom:3}}>{ev.namaAcara}</div>
            <div style={{fontSize:11,color:"#64748B"}}>🕐 {ev.jam} · {ev.penyelenggara||"—"}</div>
            <div style={{marginTop:3}}><TujuanBadge ev={ev}/></div>
            <div style={{fontSize:11,color:"#94A3B8",marginTop:2}}>
              👥 {personilList.length>0?personilList.map(p=>p.nama).join(", "):"Belum ada personil"}
            </div>
          </div>
          <span style={{fontSize:14,color:"#94A3B8",flexShrink:0}}>{exp?"▲":"▼"}</span>
        </div>
        {exp&&<div style={{borderTop:"1px solid #ECFDF5",padding:"12px 16px",background:"#FAFFFC"}}>
          {/* Penugasan detail */}
          {personilList.length>0&&<div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:800,color:"#475569",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Personil Bertugas</div>
            {personilList.map(p=>(
              <div key={p.un} style={{display:"flex",gap:8,alignItems:"center",padding:"7px 10px",background:"white",borderRadius:9,marginBottom:5,border:"1px solid #E2E8F0"}}>
                <div style={{width:28,height:28,borderRadius:8,background:"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:NAVY,flexShrink:0}}>{p.nama.slice(0,1)}</div>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:"#1E293B"}}>{p.nama}</div>
                  <div style={{fontSize:10,color:"#94A3B8"}}>{loadUsers().find(u=>u.username===p.un)?.role?.replace("_"," ")||""}</div>
                </div>
              </div>
            ))}
          </div>}
          {personilList.length===0&&<div style={{background:"#FFF7ED",borderRadius:9,padding:"10px 12px",marginBottom:12,fontSize:12,color:"#92400E",fontWeight:600}}>⚠️ Belum ada personil yang ditugaskan</div>}
          {/* Catatan penolakan pembatalan */}
          {ev.alurHapus&&<div style={{background:"#FFF1F2",borderRadius:9,padding:"10px 12px",marginBottom:12,fontSize:12,color:"#B91C1C",fontWeight:600}}>🚫 Ada permintaan batal tayang dari staf — lihat tab Batal Tayang</div>}
          {/* Kabag: batalkan tayang (setelah disetujui) */}
          {ev.alur==="disetujui"&&!ev.alurHapus&&<>
            <div style={{display:"flex",alignItems:"center",gap:8,margin:"8px 0 6px"}}>
              <div style={{flex:1,height:1,background:"#E2E8F0"}}/>
              <span style={{fontSize:10,color:"#94A3B8",fontWeight:600}}>tindakan koreksi</span>
              <div style={{flex:1,height:1,background:"#E2E8F0"}}/>
            </div>
            <div style={{borderRadius:10,overflow:"hidden",border:"1.5px solid #FCD34D",background:"#FFFBEB"}}>
              <div style={{padding:"8px 11px",fontSize:11,color:"#92400E",fontWeight:600}}>
                ⚠️ Batalkan tayang & kembalikan ke Kasubbag untuk diperbaiki atau dihapus
              </div>
              <RejectTextarea evId={ev.id+"_recall"} placeholder="Alasan pembatalan tayang (wajib)..." rows={2}
                style={{width:"100%",padding:"8px 11px",border:"none",borderTop:"1px solid #FCD34D",resize:"none",fontSize:12,boxSizing:"border-box",color:"#334155",background:"white"}}
                onCommit={(id,v)=>setRT(p=>({...p,[id]:v}))}/>
              <button onClick={()=>{
                if(!(rejectTexts[ev.id+"_recall"]||"").trim()){showT("Tulis alasan pembatalan dulu","warn");return;}
                askConfirm(
                  "Batalkan Tayang Jadwal?",
                  "Jadwal '"+ev.namaAcara+"' akan ditarik dari tampilan publik dan dikembalikan ke Kasubbag untuk diedit atau dihapus.",
                  ()=>{
                    upd(ev.id,{alur:"menunggu_kasubbag",catatanKabag:rejectTexts[ev.id+"_recall"]||"Perlu perbaikan",_kabagRecall:true});
                    showT("Jadwal ditarik & dikembalikan ke Kasubbag","warn");
                    // Notifikasi kasubbag
                    loadUsers().filter(u=>(u.role==="kasubbag_protokol")&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"recalled"}));
                    sendPush({targetRole:"kasubbag_protokol",title:"↩ Jadwal Ditarik Kabag",body:ev.namaAcara+": "+(rejectTexts[ev.id+"_recall"]||"Perlu perbaikan"),url:"/",tag:"recall-"+ev.id});sendPush({targetRole:"kasubbag_komdokpim",title:"↩ Jadwal Ditarik Kabag",body:ev.namaAcara+": "+(rejectTexts[ev.id+"_recall"]||"Perlu perbaikan"),url:"/",tag:"recall-"+ev.id});
                    sendPush({targetRole:"admin_rk",title:"↩ Jadwal Ditarik Kabag",body:ev.namaAcara+" — dikembalikan ke Kasubbag",url:"/",tag:"recall-admin-"+ev.id});{const _subU=loadUsers().find(u=>u.username===ev.submittedBy);if(_subU?.noWA)sendWA({to:_subU.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"recalled",submittedBy:getNamaByUsername(ev.submittedBy)});}
                    setExpanded(null);
                  },"Batalkan Tayang","#D97706"
                );
              }} style={{width:"100%",padding:"10px",border:"none",background:"#FEF3C7",color:"#92400E",cursor:"pointer",fontSize:12,fontWeight:700}}>
                ↩ Batalkan Tayang & Kembalikan ke Kasubbag
              </button>
            </div>
          </>}
        </div>}
      </div>
    );
  };

  return(
    <div style={{flex:1,overflowY:"auto",background:"#F4F7FF"}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,"+NAVY+" 0%,#1B3360 100%)",padding:isMobile?"16px 16px 20px":"22px 28px 26px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,width:100,height:100,borderRadius:"50%",background:"rgba(201,168,76,0.08)"}}/>
        <div style={{color:"rgba(255,255,255,0.55)",fontSize:11,marginBottom:2}}>Dashboard</div>
        <div style={{color:"white",fontSize:isMobile?17:21,fontWeight:900,marginBottom:3}}>{user?.nama||"Kepala Bagian"}</div>
        <div style={{color:GOLD,fontSize:11,fontWeight:600}}>{antrian.length} menunggu persetujuan · {approved.length} jadwal aktif</div>
      </div>

      {/* Sub-tab */}
      <div style={{background:"white",display:"flex",borderBottom:"1px solid #E2E8F0",padding:"0 12px",flexShrink:0}}>
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>setActiveTab(t.key)} style={{flex:1,padding:"12px 6px",border:"none",background:"none",borderBottom:"2.5px solid "+(activeTab===t.key?NAVY:"transparent"),color:activeTab===t.key?NAVY:"#94A3B8",cursor:"pointer",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:5,transition:"all 0.15s"}}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {t.badge>0&&<span style={{background:"#EF4444",color:"white",borderRadius:"50%",width:17,height:17,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900}}>{t.badge}</span>}
          </button>
        ))}
      </div>

      <div style={{padding:isMobile?"12px 14px":"18px 24px"}}>
        {/* TAB ANTRIAN */}
        {activeTab==="antrian"&&<>
          {antrian.length===0
            ?<div style={{textAlign:"center",padding:"48px 20px",color:"#94A3B8"}}>
              <div style={{fontSize:40,marginBottom:10}}>✅</div>
              <div style={{fontSize:14,fontWeight:700,color:"#475569"}}>Tidak ada jadwal dalam antrian</div>
            </div>
            :antrian.map(ev=><AntrianCard key={ev.id} ev={ev}/>)}
        </>}

        {/* TAB JADWAL TAYANG */}
        {activeTab==="jadwal"&&<>
          {(()=>{const _n=new Date();const _fp=approved.filter(e=>new Date(e.tanggal+"T"+(e.jam||"00:00"))>=_n);const _pr=getOverlappingPairs(_fp);if(!_pr.length)return null;return(
            <div style={{background:"#FEF2F2",border:"1.5px solid #FECACA",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
              <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <span style={{fontSize:18,flexShrink:0}}>⚡</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#991B1B",marginBottom:5}}>{_pr.length} pasang agenda berdekatan</div>
                  {_pr.map((p,i)=>(
                    <div key={i} style={{background:"white",borderRadius:7,padding:"6px 9px",marginBottom:i<getOverlappingPairs(approved).length-1?4:0,border:"1px solid #FECACA",fontSize:11,color:"#374151"}}>
                      <span style={{fontWeight:800,color:"#991B1B"}}>{p.a.jam}</span> {p.a.namaAcara}
                      <span style={{color:"#9CA3AF",margin:"0 5px"}}>↔</span>
                      <span style={{fontWeight:800,color:"#991B1B"}}>{p.b.jam}</span> {p.b.namaAcara}
                      <span style={{color:"#9CA3AF",marginLeft:6,fontSize:10}}>({p.diff} mnt)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>);})()}
          <div style={{fontSize:11,fontWeight:800,color:"#64748B",letterSpacing:1.2,textTransform:"uppercase",marginBottom:12}}>
            {approved.length} Jadwal Disetujui
          </div>
          {approved.length===0
            ?<div style={{textAlign:"center",padding:"40px 20px",color:"#94A3B8"}}><div style={{fontSize:36,marginBottom:8}}>📭</div><div style={{fontSize:13,fontWeight:600}}>Belum ada jadwal tayang</div></div>
            :approved.map(ev=><JadwalCard key={ev.id} ev={ev}/>)}
        </>}

        {/* TAB BATAL TAYANG */}
        {activeTab==="batal"&&<>
          <div style={{background:"#FFF1F2",borderRadius:12,padding:"12px 14px",marginBottom:14,border:"1.5px solid #FECDD3",fontSize:12,color:"#B91C1C",fontWeight:600}}>
            🚫 Berikut adalah jadwal yang diminta untuk dibatalkan tayangnya. Setujui untuk menghapus, atau tolak untuk mempertahankan.
          </div>
          {permintaanBatal.length===0
            ?<div style={{textAlign:"center",padding:"40px 20px",color:"#94A3B8"}}><div style={{fontSize:36,marginBottom:8}}>✅</div><div style={{fontSize:13,fontWeight:600}}>Tidak ada permintaan batal tayang</div></div>
            :permintaanBatal.map(ev=>(
              <div key={ev.id} style={{background:"white",borderRadius:14,marginBottom:10,border:"2px solid #FECDD3",overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
                <div style={{background:"#FFF1F2",padding:"10px 14px",borderBottom:"1px solid #FECDD3"}}>
                  <div style={{fontSize:13,fontWeight:800,color:"#B91C1C"}}>{ev.namaAcara}</div>
                  <div style={{fontSize:11,color:"#64748B",marginTop:2}}>🕐 {ev.jam} · 📅 {fmt(ev.tanggal)}</div>
                  <div style={{fontSize:11,color:"#94A3B8",marginTop:1}}>Diajukan oleh: {getNamaByUsername(ev.submittedBy)}</div>
                </div>
                <div style={{padding:"12px 14px",display:"flex",gap:8}}>
                  <button onClick={()=>askConfirm("Hapus Jadwal Permanen?","Tindakan ini tidak dapat dibatalkan. Jadwal '"+ev.namaAcara+"' akan dihapus selamanya.",()=>{deleteAndSync(ev.id);showT("Jadwal dihapus");},"Hapus Permanen")}
                    style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:"#B91C1C",color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>
                    🗑️ Hapus Permanen
                  </button>
                  <button onClick={()=>{upd(ev.id,{alurHapus:null});showT("Permintaan batal ditolak");}}
                    style={{flex:1,padding:"10px",borderRadius:10,border:"1.5px solid #94A3B8",background:"white",color:"#334155",cursor:"pointer",fontSize:12,fontWeight:700}}>
                    ↩ Tolak, Pertahankan
                  </button>
                </div>
              </div>
            ))}
        </>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DASHBOARD KASUBBAG — Antrian + Penugasan Staf Hierarki
// ═══════════════════════════════════════════════════════
function KasubbagDashboard({events, user, upd, showT, askConfirm, isMobile, onPenugasan}){
  const NAVY="#0A1628",GOLD="#C9A84C",GREEN="#0D6B4F";
  const role=user?.role;
  const isProto=role==="kasubbag_protokol";
  const [activeTab, setActiveTab] = useState("antrian");
  const [expandedId, setExpanded] = useState(null);
  const [rejectTexts, setRT] = useState({});
  const [cabutTarget, setCabutTarget] = useState(null); // {evId, un, nama}
  const [alasanCabut, setAlasanCabut] = useState("");
  // LocalRejectTA — textarea terisolasi agar tidak re-render list saat mengetik
  function LocalRejectTA({evId, onCommit}){
    const[v,setV]=useState(rejectTexts[evId]||"");
    React.useEffect(()=>{setV(rejectTexts[evId]||"");},[evId]);
    return <textarea placeholder="Catatan penolakan (wajib diisi untuk kembalikan)..." value={v} rows={2}
      style={{width:"100%",padding:"9px 11px",border:"none",resize:"none",fontSize:12,boxSizing:"border-box",color:"#334155"}}
      onChange={e=>setV(e.target.value)} onBlur={e=>onCommit(evId,e.target.value)}/>;
  }
  const fmt=t=>new Date(t).toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long"});
  const fmtShort=t=>new Date(t).toLocaleDateString("id-ID",{day:"numeric",month:"short"});
  const getNamaByUsername=un=>loadUsers().find(u=>u.username===un)?.nama||un;

  // Hierarki staf sesuai kasubbag
  const stafBawahan=React.useMemo(()=>{
    const allUsers=loadUsers();
    if(isProto)return allUsers.filter(u=>["staf","admin_rk"].includes(u.role));
    return allUsers.filter(u=>u.role==="timkom");
  },[role]);

  const antrian=events.filter(e=>e.alur==="menunggu_kasubbag"&&!e.alurHapus).sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));
  const approved=events.filter(e=>e.alur==="disetujui").sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));

  // Penugasan per staf
  const penugasanPerStaf=React.useMemo(()=>{
    return stafBawahan.map(staf=>{
      const tugasan=approved.filter(e=>(e.personil||[]).includes(staf.username));
      return {...staf,tugasan};
    });
  },[stafBawahan,approved]);

  const tabs=[
    {key:"antrian",label:"Antrian",icon:"📋",badge:antrian.length},
    {key:"jadwal",label:"Jadwal",icon:"🗓️",badge:0},
    {key:"personil",label:"Personil",icon:"👥",badge:0},
  ];

  const AntrianCard=({ev})=>{
    const exp=expandedId===ev.id;
    return(
      <div style={{background:"white",borderRadius:14,marginBottom:10,overflow:"hidden",border:"1.5px solid #DBEAFE",boxShadow:"0 2px 8px rgba(10,22,40,0.06)"}}>
        <div style={{padding:"13px 16px",cursor:"pointer",display:"flex",gap:12,alignItems:"flex-start"}} onClick={()=>setExpanded(exp?null:ev.id)}>
          <div style={{width:46,textAlign:"center",background:"#EFF6FF",borderRadius:10,padding:"6px 4px",flexShrink:0}}>
            <div style={{fontSize:17,fontWeight:900,color:NAVY}}>{ev.tanggal.slice(8)}</div>
            <div style={{fontSize:9,color:"#64748B"}}>{fmtShort(ev.tanggal).split(" ")[1]}</div>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:800,color:"#0F172A",marginBottom:3}}>{ev.namaAcara}</div>
            <div style={{fontSize:11,color:"#64748B"}}>🕐 {ev.jam} · {ev.penyelenggara||ev.lokasi||"—"}</div>
            <div style={{fontSize:11,color:"#94A3B8",marginTop:2}}>Diajukan: {getNamaByUsername(ev.submittedBy)}</div>
          </div>
          <span style={{fontSize:14,color:"#94A3B8",flexShrink:0}}>{exp?"▲":"▼"}</span>
        </div>
        {exp&&<div style={{borderTop:"1px solid #EFF6FF",padding:"12px 16px",background:"#FAFBFF"}}>
          {ev._kabagRecall&&<div style={{background:"#FEF2F2",border:"1.5px solid #FECACA",borderRadius:9,padding:"9px 12px",marginBottom:10,fontSize:12,color:"#991B1B",fontWeight:600}}>
            ↩ Jadwal ini ditarik oleh Kabag — periksa, edit, atau ajukan ulang
          </div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button onClick={()=>{upd(ev.id,{alur:"menunggu_kabag",_kabagRecall:false});showT("Diteruskan ke Kabag");loadUsers().filter(u=>u.role==="kabag"&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"kasubbag_approve"}));sendPush({targetRole:"kabag",title:"✅ Menunggu Persetujuan Anda",body:ev.namaAcara+" — "+ev.jam+" WITA",url:"/",tag:"approve-"+ev.id});setExpanded(null);}}
              style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:GREEN,color:"white",cursor:"pointer",fontSize:13,fontWeight:800}}>
              ✅ Verifikasi & Teruskan ke Kabag
            </button>
            <div style={{borderRadius:10,overflow:"hidden",border:"1.5px solid #FECACA"}}>
              <LocalRejectTA evId={ev.id} onCommit={(id,v)=>setRT(p=>({...p,[id]:v}))}/>
              <button onClick={()=>askConfirm("Tolak & Kembalikan ke Staf?","Jadwal '"+ev.namaAcara+"' akan dikembalikan.",()=>{upd(ev.id,{alur:"ditolak",catatanTolak:rejectTexts[ev.id]||"",_requiresEdit:true});showT("Dikembalikan ke Admin RK","warn");const u=loadUsers().find(x=>x.username===ev.submittedBy);if(u?.noWA)sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,event:"rejected",catatanTolak:rejectTexts[ev.id]||"",submittedBy:getNamaByUsername(ev.submittedBy)});sendPush({targetRole:"admin_rk",title:"❌ Jadwal Dikembalikan",body:ev.namaAcara+": "+(rejectTexts[ev.id]||"Perlu perbaikan"),url:"/",tag:"rejected-"+ev.id});setExpanded(null);},"Tolak","#991B1B")}
                style={{width:"100%",padding:"10px",border:"none",background:"#FEE2E2",color:"#991B1B",cursor:"pointer",fontSize:12,fontWeight:700}}>
                ❌ Tolak & Kembalikan ke Admin RK
              </button>
            </div>
          </div>
        </div>}
      </div>
    );
  };

  const JadwalKasubbagCard=({ev})=>{
    const exp=expandedId===ev.id;
    const personilList=(ev.personil||[]).map(un=>({un,nama:getNamaByUsername(un)}));
    return(
      <div style={{background:"white",borderRadius:14,marginBottom:10,overflow:"hidden",border:"1.5px solid #D1FAE5",boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
        <div style={{padding:"13px 16px",cursor:"pointer",display:"flex",gap:12,alignItems:"flex-start"}} onClick={()=>setExpanded(exp?null:ev.id)}>
          <div style={{width:46,textAlign:"center",background:"#ECFDF5",borderRadius:10,padding:"6px 4px",flexShrink:0}}>
            <div style={{fontSize:17,fontWeight:900,color:GREEN}}>{ev.tanggal.slice(8)}</div>
            <div style={{fontSize:9,color:"#64748B"}}>{fmtShort(ev.tanggal).split(" ")[1]}</div>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:800,color:"#0F172A",marginBottom:3}}>{ev.namaAcara}</div>
            <div style={{fontSize:11,color:"#64748B"}}>🕐 {ev.jam} · {ev.penyelenggara||"—"}</div>
            <div style={{fontSize:11,color:personilList.length>0?"#065F46":"#D97706",marginTop:2,fontWeight:600}}>
              {personilList.length>0?"👥 "+personilList.map(p=>p.nama).join(", "):"⚠️ Belum ada personil"}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            <button onClick={e=>{e.stopPropagation();onPenugasan(ev);}} style={{padding:"5px 10px",borderRadius:8,border:"none",background:NAVY,color:"white",cursor:"pointer",fontSize:10,fontWeight:700}}>
              {personilList.length>0?"Edit Tugas":"+ Tugaskan"}
            </button>
            <span style={{fontSize:14,color:"#94A3B8"}}>{exp?"▲":"▼"}</span>
          </div>
        </div>
        {exp&&<div style={{borderTop:"1px solid #ECFDF5",padding:"12px 16px",background:"#FAFFFC"}}>
          {ev.undanganFile&&<div style={{display:"flex",gap:7,marginBottom:10}}>
            <a href={ev.undanganFile} target="_blank" rel="noopener noreferrer" style={{flex:1,padding:"7px",borderRadius:8,border:"1.5px solid #0284c7",background:"white",color:"#0284c7",textDecoration:"none",textAlign:"center",fontSize:12,fontWeight:700}}>👁 Lihat Undangan</a>
            <a href={ev.undanganFile} download={ev.undanganNama||"undangan"} style={{flex:1,padding:"7px",borderRadius:8,border:"none",background:"#0284c7",color:"white",textDecoration:"none",textAlign:"center",fontSize:12,fontWeight:700}}>⬇ Unduh</a>
          </div>}
          {personilList.length>0&&<><div style={{fontSize:11,fontWeight:800,color:"#475569",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Personil Bertugas</div>
          {personilList.map(p=>{
            const uObj=loadUsers().find(u=>u.username===p.un);
            const pRole=uObj?.role||"";
            const myScope=isProto?["staf","admin_rk","kasubbag_protokol"]:["timkom","kasubbag_komdokpim"];
            const bisaCabut=myScope.includes(pRole);
            return <div key={p.un} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 10px",background:bisaCabut?"#FAFCFF":"white",borderRadius:9,marginBottom:5,border:"1.5px solid "+(bisaCabut?"#BFDBFE":"#E2E8F0")}}>
              <div style={{width:30,height:30,borderRadius:8,background:"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:NAVY,flexShrink:0}}>{p.nama.slice(0,1)}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:"#1E293B"}}>{p.nama}</div>
                <div style={{fontSize:10,color:"#94A3B8",textTransform:"capitalize"}}>{pRole.replace(/_/g," ")}</div>
              </div>
              {bisaCabut&&<button onClick={e=>{e.stopPropagation();setCabutTarget({evId:ev.id,un:p.un,nama:p.nama});setAlasanCabut("");}}
                style={{padding:"5px 10px",borderRadius:8,border:"1.5px solid #FCA5A5",background:"white",color:"#DC2626",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>Cabut</button>}
            </div>;
          })}
          </>}
        </div>}
      </div>
    );
  };

  return(
    <div style={{flex:1,overflowY:"auto",background:"#F4F7FF"}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,"+NAVY+" 0%,#1B3360 100%)",padding:isMobile?"16px 16px 20px":"22px 28px 26px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,width:100,height:100,borderRadius:"50%",background:"rgba(201,168,76,0.08)"}}/>
        <div style={{color:"rgba(255,255,255,0.55)",fontSize:11,marginBottom:2}}>Dashboard</div>
        <div style={{color:"white",fontSize:isMobile?16:20,fontWeight:900,marginBottom:3}}>
          {user?.nama||(isProto?"Kasubbag Protokol":"Kasubbag Komunikasi & Dokumentasi")}
        </div>
        <div style={{color:GOLD,fontSize:11,fontWeight:600}}>
          {antrian.length} menunggu review · {stafBawahan.length} personil di bawah
        </div>
      </div>

      {/* Sub-tab */}
      <div style={{background:"white",display:"flex",borderBottom:"1px solid #E2E8F0",padding:"0 12px"}}>
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>setActiveTab(t.key)} style={{flex:1,padding:"12px 6px",border:"none",background:"none",borderBottom:"2.5px solid "+(activeTab===t.key?NAVY:"transparent"),color:activeTab===t.key?NAVY:"#94A3B8",cursor:"pointer",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {t.badge>0&&<span style={{background:"#EF4444",color:"white",borderRadius:"50%",width:17,height:17,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900}}>{t.badge}</span>}
          </button>
        ))}
      </div>

      <div style={{padding:isMobile?"12px 14px":"18px 24px"}}>
        {/* TAB ANTRIAN */}
        {activeTab==="antrian"&&<>
          {antrian.length===0
            ?<div style={{textAlign:"center",padding:"48px 20px",color:"#94A3B8"}}>
              <div style={{fontSize:40,marginBottom:10}}>✅</div>
              <div style={{fontSize:14,fontWeight:700,color:"#475569"}}>Tidak ada jadwal dalam antrian</div>
            </div>
            :antrian.map(ev=><AntrianCard key={ev.id} ev={ev}/>)}
        </>}

        {/* TAB JADWAL */}
        {activeTab==="jadwal"&&<>
          <div style={{fontSize:11,fontWeight:800,color:"#64748B",letterSpacing:1.2,textTransform:"uppercase",marginBottom:12}}>{approved.length} Jadwal Disetujui</div>
          {approved.length===0
            ?<div style={{textAlign:"center",padding:"40px 20px",color:"#94A3B8"}}><div style={{fontSize:36,marginBottom:8}}>📭</div><div style={{fontSize:13,fontWeight:600}}>Belum ada jadwal</div></div>
            :approved.map(ev=><JadwalKasubbagCard key={ev.id} ev={ev}/>)}
        </>}

        {/* TAB PERSONIL */}
        {activeTab==="personil"&&<>
          <div style={{background:"#EFF6FF",borderRadius:12,padding:"11px 14px",marginBottom:14,border:"1px solid #BFDBFE",fontSize:12,color:"#1D4ED8",fontWeight:600}}>
            👥 {isProto?"Di bawah Kasubbag Protokol: Staf Protokol, Staf Input, Admin RK":"Di bawah Kasubbag Komunikasi: Staf Komunikasi Pimpinan (Timkom)"}
          </div>
          {stafBawahan.map(staf=>{
            const ps=penugasanPerStaf.find(p=>p.username===staf.username);
            const tugasan=ps?.tugasan||[];
            return(
              <div key={staf.username} style={{background:"white",borderRadius:14,marginBottom:12,border:"1.5px solid #E2E8F0",overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
                <div style={{padding:"13px 16px",display:"flex",gap:12,alignItems:"center"}}>
                  <div style={{width:40,height:40,borderRadius:11,background:"linear-gradient(135deg,"+NAVY+",#1E3254)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"white",flexShrink:0}}>{staf.nama.slice(0,1)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:800,color:"#0F172A"}}>{staf.nama}</div>
                    <div style={{fontSize:10,color:"#94A3B8",textTransform:"capitalize"}}>{staf.role?.replace(/_/g," ")||""}</div>
                    <div style={{fontSize:11,color:tugasan.length>0?GREEN:"#94A3B8",fontWeight:600,marginTop:2}}>
                      {tugasan.length>0?tugasan.length+" jadwal ditugaskan":"Belum ada penugasan"}
                    </div>
                  </div>
                </div>
                {tugasan.length>0&&<div style={{borderTop:"1px solid #F1F5F9",padding:"8px 14px 12px"}}>
                  {tugasan.slice(0,3).map(ev=>(
                    <div key={ev.id} style={{display:"flex",gap:8,alignItems:"center",padding:"6px 8px",background:"#F8FAFF",borderRadius:8,marginBottom:4}}>
                      <span style={{fontSize:10,fontWeight:700,color:NAVY,minWidth:40}}>{ev.tanggal.slice(5)}</span>
                      <span style={{fontSize:11,color:"#334155",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.namaAcara}</span>
                      <span style={{fontSize:10,color:"#64748B"}}>{ev.jam}</span>
                    </div>
                  ))}
                  {tugasan.length>3&&<div style={{fontSize:11,color:"#94A3B8",textAlign:"center",paddingTop:4}}>+{tugasan.length-3} lainnya</div>}
                </div>}
              </div>
            );
          })}
          {stafBawahan.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:"#94A3B8"}}><div style={{fontSize:36,marginBottom:8}}>👤</div><div style={{fontSize:13,fontWeight:600}}>Belum ada staf terdaftar di bawah Anda</div></div>}
        </>}
    {/* ── MODAL CABUT PENUGASAN ── */}
    {cabutTarget&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",zIndex:9999}}
      onClick={e=>{if(e.target===e.currentTarget){setCabutTarget(null);setAlasanCabut("");}}}>
      <div style={{background:"white",borderRadius:"18px 18px 0 0",padding:"20px 18px 32px",width:"100%",maxWidth:520,margin:"0 auto",boxSizing:"border-box"}}>
        <div style={{fontSize:15,fontWeight:800,color:"#1E293B",marginBottom:4}}>Cabut Penugasan</div>
        <div style={{fontSize:12,color:"#64748B",marginBottom:12}}>Cabut penugasan <strong>{cabutTarget.nama}</strong> dari kegiatan ini?</div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:12,fontWeight:700,color:"#475569",display:"block",marginBottom:5}}>Alasan pencabutan <span style={{color:"#DC2626"}}>*</span></label>
          <textarea value={alasanCabut} onChange={e=>setAlasanCabut(e.target.value)}
            placeholder="Contoh: Berhalangan hadir, ditugaskan kegiatan lain..."
            rows={2} style={{width:"100%",padding:"9px 11px",borderRadius:9,border:"1.5px solid #E2E8F0",fontSize:12,resize:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{background:"#EFF6FF",borderRadius:9,padding:"8px 11px",marginBottom:14,fontSize:11,color:"#1E40AF"}}>📱 Notifikasi WA akan dikirim ke <strong>{cabutTarget.nama}</strong> secara otomatis.</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setCabutTarget(null);setAlasanCabut("");}} style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #E2E8F0",background:"white",color:"#64748B",cursor:"pointer",fontWeight:700,fontSize:13}}>Batal</button>
          <button onClick={()=>{
            if(!alasanCabut.trim()){showT("Alasan pencabutan wajib diisi","error");return;}
            const ev=events.find(e=>e.id===cabutTarget.evId);if(!ev)return;
            upd(cabutTarget.evId,{personil:(ev.personil||[]).filter(x=>x!==cabutTarget.un)});
            const tUser=loadUsers().find(u=>u.username===cabutTarget.un);
            if(tUser?.noWA){
              const sby=role==="kasubbag_protokol"?"Kasubbag Protokol":"Kasubbag Komdokpim";
              const pesan="\u274C *Pencabutan Penugasan*\n\nYth. "+cabutTarget.nama+",\n\nPenugasan Anda pada kegiatan berikut telah dicabut:\n\n\uD83D\uDCCC *"+ev.namaAcara+"*\n\uD83D\uDCC5 "+ev.tanggal+"\n\u23F0 "+ev.jam+" WITA"+(ev.lokasi?"\n\uD83D\uDCCD "+ev.lokasi:"")+"\n\n\uD83D\uDCDD Alasan: "+alasanCabut+"\n\nJika ada pertanyaan silakan hubungi "+sby+".\n\n_Prokopim Kota Tarakan_\n_prokopim.tarakankota.go.id_";
              fetch("/api/whatsapp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"broadcast",pesanCustom:pesan,target:tUser.noWA})}).catch(e=>console.warn("Sync:",e?.message||e));
            }
            showT("Penugasan "+cabutTarget.nama+" dicabut & WA terkirim","warn");
            setCabutTarget(null);setAlasanCabut("");
          }} style={{flex:1,padding:"12px",borderRadius:10,border:"none",background:"#DC2626",color:"white",cursor:"pointer",fontWeight:800,fontSize:13}}>Ya, Cabut & Kirim WA</button>
        </div>
      </div>
    </div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TAMPILAN KHUSUS WALI KOTA / WAKIL WALI KOTA
// Simpel, elegan, fokus acara + disposisi
// ═══════════════════════════════════════════════════════
// ─── Helper: cari pasangan jadwal yang berdekatan (< 90 menit selisih) ───
function getOverlappingPairs(evList){
  const pairs=[];
  const approved=evList.filter(e=>e.alur==="disetujui");
  for(let i=0;i<approved.length;i++){
    for(let j=i+1;j<approved.length;j++){
      const a=approved[i],b=approved[j];
      if(a.tanggal!==b.tanggal)continue;
      // Hanya jika ada pimpinan yang sama
      const shared=a.untukPimpinan.some(p=>b.untukPimpinan.includes(p))||
                   (a.delegasiKeWWK&&b.untukPimpinan.includes("wakilwalikota"))||
                   (b.delegasiKeWWK&&a.untukPimpinan.includes("wakilwalikota"));
      if(!shared)continue;
      const aMin=toMin(a.jam),bMin=toMin(b.jam);
      const diff=Math.abs(aMin-bMin);
      if(diff>0&&diff<90)pairs.push({a,b,diff});
    }
  }
  return pairs;
}

function PimpinanView({events, role, user, onDisposisi, onCatatanSave, setDelegTarget, upd, showT, isMobile, initialExpandedId, onExpandConsumed}){
  const NAVY="#0A1628",GOLD="#C9A84C",GREEN="#0D6B4F";
  const now=new Date();
  const todayStr=()=>localDateStr();
  const tomorrowStr=()=>{const d=new Date();d.setDate(d.getDate()+1);return localDateStr(d);};
  const getHari=t=>{const d=new Date(t);return d.toLocaleDateString("id-ID",{weekday:"long"});};
  const fmt=t=>{const d=new Date(t);return d.toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});};

  const myEvs=(
    role==="walikota"
      ?events.filter(e=>e.alur==="disetujui"&&e.untukPimpinan.includes("walikota"))
    :role==="wakilwalikota"
      ?events.filter(e=>e.alur==="disetujui"&&(e.untukPimpinan.includes("wakilwalikota")||e.delegasiKeWWK))
    :role==="kasubbag_protokol"||role==="kasubbag_komdokpim"
      ?events.filter(e=>e.alur==="menunggu_kasubbag"||e.alur==="disetujui")
    :role==="kabag"
      ?events.filter(e=>e.alur==="menunggu_kabag"||e.alur==="menunggu_kasubbag"||e.alur==="disetujui")
    :(role==="ajudan_walikota"||role==="ajudan_wakilwalikota")
      ?events.filter(e=>e.alur==="disetujui")
    // staf, admin_rk, timkom — jadwal disetujui + yang ditugaskan ke mereka
    :events.filter(e=>e.alur==="disetujui")
  ).sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));

  // Mulai dari besok ke atas, lalu hari ini, lalu lampau di bawah
  const tomorrow = tomorrowStr();
  const today = todayStr();
  // Untuk kasubbag_protokol/kabag: pisahkan antrian vs disetujui
  const isPending = e => e.alur==="menunggu_kasubbag"||e.alur==="menunggu_kabag";
  const upcoming = myEvs.filter(e=>!isPending(e)&&new Date(e.tanggal+"T"+e.jam)>=now);
  const pendingApproval = myEvs.filter(e=>isPending(e));
  const past = myEvs.filter(e=>!isPending(e)&&new Date(e.tanggal+"T"+e.jam)<now).reverse();

  const [expandedId, setExpanded] = React.useState(null);
  const [catatanLocal, setCatatanLocal] = React.useState({});
  // Auto-expand dari goToPending
  React.useEffect(()=>{
    if(initialExpandedId){
      setExpanded(initialExpandedId);
      if(onExpandConsumed)onExpandConsumed();
      setTimeout(()=>{const el=document.getElementById("ev-"+initialExpandedId);if(el)el.scrollIntoView({behavior:"smooth",block:"center"});},250);
    }
  },[initialExpandedId]);

  const statusWK = role==="walikota" 
    ? (ev) => ev.statusWK
    : (ev) => ev.statusWWK;
  const byAjudan = role==="walikota"
    ? (ev) => ev.statusWK_by
    : (ev) => ev.statusWWK_by;
  const KonfirmasiByBadge = ({by}) => {
    if(!by || by==="walikota" || by==="wakilwalikota") return null;
    const label = by==="ajudan"?"diisi oleh Ajudan":by==="admin_rk"?"diisi oleh Admin RK":"diisi oleh "+by;
    const bg = by==="ajudan"?"#FFF8DC":by==="admin_rk"?"#FEF3C7":"#F1F5F9";
    const color = by==="ajudan"?"#B45309":by==="admin_rk"?"#92400E":"#64748B";
    const border = by==="ajudan"?"1px solid #FCD34D":by==="admin_rk"?"1px solid #FDE68A":"1px solid #E2E8F0";
    return <span style={{background:bg,color,borderRadius:4,padding:"1px 5px",fontSize:9,fontWeight:800,border}}>✏️ {label}</span>;
  };

  const DisposisiBar = ({ev}) => {
    const st = statusWK(ev);
    const byAdj = byAjudan(ev);
    // Untuk role non-pimpinan: hanya tampilkan status kehadiran + badge ajudan
    const isViewer = !["walikota","wakilwalikota"].includes(role);
    if(isViewer) {
      // Kumpulkan status kedua pimpinan yang relevan untuk event ini
      const items = [];
      if(ev.untukPimpinan.includes("walikota")) {
        const stWK = ev.statusWK;
        const byWK = ev.statusWK_by;
        const labWK = ev.delegasiKeWWK?"Delegasi ke Wawali":stWK==="hadir"?"Hadir":stWK==="tidak_hadir"?"Tidak Hadir":stWK==="diwakilkan"?(ev.perwakilanWK?"→ "+ev.perwakilanWK:"Diwakilkan"):"Belum konfirmasi";
        const clrWK = ev.delegasiKeWWK||stWK==="hadir"?"#065f46":stWK==="tidak_hadir"?"#991b1b":stWK?"#92400e":"#b45309";
        const bgWK  = ev.delegasiKeWWK||stWK==="hadir"?"#D1FAE5":stWK==="tidak_hadir"?"#FEE2E2":stWK?"#FEF3C7":"#FFFBEB";
        items.push({label:"WK",status:labWK,color:clrWK,bg:bgWK,byAdj:byWK});
      }
      if(ev.untukPimpinan.includes("wakilwalikota")||ev.delegasiKeWWK) {
        const stWWK = ev.statusWWK;
        const byWWK = ev.statusWWK_by==="ajudan";
        const labWWK = stWWK==="hadir"?"Hadir":stWWK==="tidak_hadir"?"Tidak Hadir":stWWK==="diwakilkan"?(ev.perwakilanWWK?"→ "+ev.perwakilanWWK:"Diwakilkan"):"Belum konfirmasi";
        const clrWWK = stWWK==="hadir"?"#065f46":stWWK==="tidak_hadir"?"#991b1b":stWWK?"#92400e":"#b45309";
        const bgWWK  = stWWK==="hadir"?"#D1FAE5":stWWK==="tidak_hadir"?"#FEE2E2":stWWK?"#FEF3C7":"#FFFBEB";
        items.push({label:ev.delegasiKeWWK?"WWK (delegasi)":"WWK",status:labWWK,color:clrWWK,bg:bgWWK,byAdj:byWWK});
      }
      if(items.length===0) return null;
      return (
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
          {items.map(it=>(
            <div key={it.label} style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{fontSize:9,fontWeight:700,color:"#94A3B8",textTransform:"uppercase"}}>{it.label}:</span>
              <span style={{background:it.bg,color:it.color,borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700}}>{it.status}</span>
              {it.byAdj&&<span style={{background:"#FFF8DC",color:"#B45309",borderRadius:4,padding:"1px 5px",fontSize:9,fontWeight:800,border:"1px solid #FCD34D"}}>✏️ Ajudan</span>}
            </div>
          ))}
        </div>
      );
    }
    if(!st && !ev.delegasiKeWWK) return (
      <div style={{background:"#FEF9EC",border:"1px solid #F59E0B",borderRadius:8,padding:"8px 12px",display:"flex",alignItems:"center",gap:8,fontSize:12}}>
        <span>🔔</span><span style={{color:"#92400E",fontWeight:600}}>Belum ada konfirmasi kehadiran</span>
      </div>
    );
    const badges = {
      hadir: {bg:"#D1FAE5",color:"#065F46",icon:"✓",text:"Hadir"},
      tidak_hadir: {bg:"#FEE2E2",color:"#991B1B",icon:"✗",text:"Tidak Hadir"},
      diwakilkan: {bg:"#FEF3C7",color:"#92400E",icon:"↗",text:ev.delegasiKeWWK?"Delegasi ke Wakil":"Diwakilkan"},
    };
    const bk = st==="diwakilkan"||ev.delegasiKeWWK?"diwakilkan":st;
    const b = badges[bk]||{bg:"#F1F5F9",color:"#64748B",icon:"–",text:"–"};
    return (
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{background:b.bg,color:b.color,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:800}}>{b.icon} {b.text}</span>
        {byAdj&&<span style={{fontSize:10,color:"#D97706",background:"#FFF3CD",borderRadius:4,padding:"2px 6px",fontWeight:600}}>diisi Ajudan</span>}
        {ev.delegasiKeWWK&&role==="walikota"&&<span style={{fontSize:10,color:"#7C3AED",background:"#EDE9FE",borderRadius:4,padding:"2px 6px"}}>→ Wawali</span>}
        {ev.perwakilanWK&&role==="walikota"&&<span style={{fontSize:10,color:"#92400E",background:"#FEF3C7",borderRadius:4,padding:"2px 6px"}}>→ {ev.perwakilanWK}</span>}
        {ev.perwakilanWWK&&role==="wakilwalikota"&&<span style={{fontSize:10,color:"#92400E",background:"#FEF3C7",borderRadius:4,padding:"2px 6px"}}>→ {ev.perwakilanWWK}</span>}
      </div>
    );
  };

  const EventBlock = ({ev}) => {
    const isToday = ev.tanggal===today;
    const isTomorrow = ev.tanggal===tomorrow;
    const evDt = new Date(ev.tanggal+"T"+ev.jam);
    const hoursLeft = (evDt-now)/(1000*60*60);
    const isExpanded = expandedId===ev.id;
    const isUrgent = hoursLeft>0&&hoursLeft<=3;
    const st = statusWK(ev);
    const kehadiranLocked = isKehadiranLocked(ev);

    return (
      <div style={{background:"white",borderRadius:18,marginBottom:10,overflow:"hidden",boxShadow:"0 2px 16px rgba(10,22,40,0.08)",border:"1.5px solid "+(isToday?"#C9A84C":isUrgent?"#FCA5A5":"#E8EDF4")}}>
        {/* Header strip */}
        {(isToday||isTomorrow||isUrgent)&&<div style={{background:isToday?"linear-gradient(90deg,"+NAVY+",#1B4080)":isUrgent?"#FEF2F2":"#F0F4FF",padding:"5px 16px",display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:10,fontWeight:800,color:isToday?GOLD:isUrgent?"#DC2626":"#4F46E5",letterSpacing:1,textTransform:"uppercase"}}>
            {isToday?"● HARI INI":isUrgent?"⚠️ "+Math.round(hoursLeft)+" JAM LAGI":"BESOK"}
          </span>
        </div>}

        {/* Main card — clickable to expand */}
        <div onClick={()=>setExpanded(isExpanded?null:ev.id)} style={{padding:"16px",cursor:"pointer",userSelect:"none"}}>
          <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
            {/* Date block */}
            <div style={{minWidth:52,textAlign:"center",background:isToday?"linear-gradient(135deg,"+NAVY+",#1B4080)":"#F8FAFF",borderRadius:12,padding:"8px 4px",flexShrink:0}}>
              <div style={{fontSize:9,fontWeight:800,color:isToday?GOLD:"#94A3B8",textTransform:"uppercase",letterSpacing:0.5}}>{getHari(ev.tanggal).slice(0,3)}</div>
              <div style={{fontSize:22,fontWeight:900,color:isToday?"white":"#0F172A",lineHeight:1}}>{ev.tanggal.slice(8)}</div>
              <div style={{fontSize:10,color:isToday?"rgba(255,255,255,0.7)":"#94A3B8",fontWeight:600}}>{ev.jam}</div>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:800,color:"#0F172A",lineHeight:1.3,marginBottom:5}}>{ev.namaAcara}</div>
              <div style={{fontSize:12,color:"#64748B",marginBottom:8}}>{ev.penyelenggara}</div>
              <DisposisiBar ev={ev}/>
              {/* Personil ditugaskan — tampil untuk kabag & kasubbag */}
              {["kabag","kasubbag_protokol","kasubbag_komdokpim"].includes(role)&&(
                (ev.personil||[]).length===0
                  ?<div style={{display:"flex",alignItems:"center",gap:5,marginTop:6}}>
                    <span style={{fontSize:10,color:"#CBD5E1"}}>○</span>
                    <span style={{fontSize:11,color:"#CBD5E1",fontStyle:"italic"}}>Belum ada personil ditugaskan</span>
                  </div>
                  :<div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:7,alignItems:"center"}}>
                    <span style={{fontSize:10,color:"#64748B",fontWeight:600,marginRight:2}}>👥</span>
                    {(ev.personil||[]).map((un,i)=>(
                      <span key={i} style={{background:"#EFF6FF",color:"#1D4ED8",borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700,border:"1px solid #BFDBFE"}}>
                        {loadUsers().find(u=>u.username===un)?.nama||un}
                      </span>
                    ))}
                  </div>
              )}
            </div>
            <div style={{color:"#C8D4E0",transition:"transform 0.2s",transform:isExpanded?"rotate(180deg)":"none",marginTop:4,fontSize:12}}>▼</div>
          </div>
        </div>

        {/* Detail panel */}
        {isExpanded&&<div style={{borderTop:"1px solid #F1F5F9",padding:"14px 16px",background:"#FAFBFF"}}>
          {/* Info acara */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            {[
              {l:"Tanggal",v:getHari(ev.tanggal)+", "+fmt(ev.tanggal)},
              {l:"Pukul",v:ev.jam+" WITA"},
              {l:"Lokasi",v:ev.lokasi||"-"},
              {l:"Pakaian",v:ev.pakaian},
              {l:"Penyelenggara",v:ev.penyelenggara},
              ev.kontak?{l:"Kontak",v:ev.kontak}:null,
              ev.catatan?{l:"Catatan",v:ev.catatan}:null,
            ].filter(Boolean).map(f=>(
              <div key={f.l} style={{gridColumn:f.l==="Tanggal"||f.l==="Catatan"||f.l==="Penyelenggara"?"span 2":"span 1"}}>
                <div style={{fontSize:10,color:"#94A3B8",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2}}>{f.l}</div>
                <div style={{fontSize:13,color:"#0F172A",fontWeight:600}}>{f.v}</div>
              </div>
            ))}
          </div>

          {/* Naskah sambutan untuk pimpinan */}
          {ev.sambutanFile&&<div style={{background:"#F0FDF4",border:"1.5px solid #6EE7B7",borderRadius:10,padding:"10px 12px",marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:800,color:"#065F46",marginBottom:7,display:"flex",alignItems:"center",gap:6}}>
              <span>📄</span> Naskah Sambutan Tersedia
            </div>
            <div style={{display:"flex",gap:7}}>
              <button onClick={e=>{e.stopPropagation();window.open(ev.sambutanFile,"_blank");}} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:"#065F46",color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>Baca Naskah</button>
              <a href={ev.sambutanFile} download={ev.sambutanNama} onClick={e=>e.stopPropagation()} style={{flex:1,padding:"9px",borderRadius:8,border:"1.5px solid #065F46",background:"white",color:"#065F46",textDecoration:"none",textAlign:"center",fontSize:12,fontWeight:700}}>Unduh PDF</a>
            </div>
          </div>}
          {/* Catatan pimpinan jika ada */}
          {ev.catatanPimpinan&&<div style={{background:"#EEF2FF",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:12,color:"#3730A3",fontStyle:"italic"}}>
            💬 {ev.catatanPimpinan}
          </div>}

          {/* Aksi kehadiran — hanya untuk Wali Kota (WWK punya panel disposisi sendiri di bawah) */}
          {role==="walikota"&&!ev.delegasiKeWWK&&<div style={{marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Konfirmasi Kehadiran</div>
            {kehadiranLocked
              ?<KehadiranLockedBanner/>
              :<div style={{display:"flex",gap:8}}>
                {[{s:"hadir",l:"✓  Saya Hadir",c:GREEN},{s:"tidak_hadir",l:"✗  Tidak Hadir",c:"#991B1B"}].map(({s,l,c})=>(
                  <button key={s} onClick={e=>{e.stopPropagation();
                    upd(ev.id,{statusWK:s,delegasiKeWWK:false,perwakilanWK:"",statusWK_by:"walikota"});
                    showT("Kehadiran berhasil dikonfirmasi");
                  }} style={{flex:1,padding:"13px 8px",borderRadius:12,cursor:"pointer",fontWeight:800,fontSize:13,border:"2px solid "+c,background:statusWK(ev)===s?c:"white",color:statusWK(ev)===s?"white":c,transition:"all 0.15s"}}>{l}</button>
                ))}
              </div>
            }
          </div>}

          {/* Disposisi — hanya Wali Kota */}
          {role==="walikota"&&!kehadiranLocked&&<div style={{marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Disposisi Kehadiran</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button onClick={e=>{e.stopPropagation();upd(ev.id,{statusWK:"diwakilkan",delegasiKeWWK:true,perwakilanWK:"",statusWK_by:"walikota"});showT("Didelegasi ke Wakil Wali Kota");
                sendPush({targetRole:"ajudan_wakilwalikota",title:"↩ Disposisi dari Wali Kota",body:ev.namaAcara+" — "+ev.jam+" WITA",url:"/",tag:"delegasi-wwk-"+ev.id});
                sendPush({targetRole:"kabag",title:"🔄 Delegasi ke WWK",body:ev.namaAcara+" didelegasikan Wali Kota ke Wakil",url:"/",tag:"delegasi-wk-"+ev.id});
                sendPush({targetRole:"kasubbag_protokol",title:"🔄 Delegasi ke WWK",body:ev.namaAcara,url:"/",tag:"delegasi-ksbg-"+ev.id});
                sendPush({targetRole:"kasubbag_komdokpim",title:"🔄 Delegasi ke WWK",body:ev.namaAcara,url:"/",tag:"delegasi-ksbg2-"+ev.id});
                loadUsers().filter(u=>u.role==="ajudan_wakilwalikota"&&u.noWA).forEach(u=>sendWA({to:u.noWA,namaAcara:ev.namaAcara,tanggal:ev.tanggal,jam:ev.jam,penyelenggara:ev.penyelenggara,lokasi:ev.lokasi,event:"delegasi_wwk"}));
              }} style={{flex:1,minWidth:140,padding:"11px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,background:ev.delegasiKeWWK?GREEN:"#ECFDF5",color:ev.delegasiKeWWK?"white":GREEN}}>
                {ev.delegasiKeWWK?"✓ Delegasi ke Wawali":"Delegasi ke Wakil WK"}
              </button>
              <button onClick={e=>{e.stopPropagation();setDelegTarget({id:ev.id,side:"wk"});}} style={{flex:1,minWidth:140,padding:"11px",borderRadius:10,border:"1.5px solid #CBD5E1",cursor:"pointer",fontWeight:600,fontSize:12,background:"white",color:"#475569"}}>
                Wakilkan Pejabat Lain
              </button>
            </div>
            {(ev.delegasiKeWWK||ev.perwakilanWK)&&<button onClick={e=>{e.stopPropagation();upd(ev.id,{statusWK:null,delegasiKeWWK:false,perwakilanWK:""});showT("Disposisi dicabut","warn");}} style={{marginTop:8,width:"100%",padding:"9px",borderRadius:9,border:"1.5px solid #FCA5A5",background:"white",color:"#EF4444",cursor:"pointer",fontSize:12,fontWeight:700}}>
              Cabut Disposisi
            </button>}
          </div>}

          
          {/* Info disposisi WK — untuk Wakil Wali Kota (terima disposisi) */}
          {role==="wakilwalikota"&&ev.delegasiKeWWK&&<div style={{background:"#EDE9FE",border:"1.5px solid #7c3aed",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:18}}>↩</span>
              <div>
                <div style={{fontSize:10,fontWeight:800,color:"#5b21b6",textTransform:"uppercase",letterSpacing:0.5}}>Disposisi dari Wali Kota</div>
                <div style={{fontSize:12,fontWeight:700,color:"#7c3aed"}}>
                  {ev.statusWK_by==="walikota"?"Ditetapkan langsung oleh Wali Kota":"Diinput oleh Ajudan WK"}
                </div>
              </div>
            </div>
            <div style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Konfirmasi Kehadiran Wakil Wali Kota</div>
            {kehadiranLocked
              ?<KehadiranLockedBanner/>
              :<><div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
                {[{s:"hadir",l:"✓  Saya Hadir",c:GREEN},{s:"tidak_hadir",l:"✗  Tidak Hadir",c:"#991B1B"}].map(({s,l,c})=>(
                  <button key={s} onClick={e=>{e.stopPropagation();upd(ev.id,{statusWWK:s,statusWWK_by:"wakilwalikota",delegasiWWKJajaran:false,perwakilanWWK:""});showT("Kehadiran berhasil dikonfirmasi");}}
                    style={{flex:1,padding:"11px 8px",borderRadius:11,cursor:"pointer",fontWeight:800,fontSize:12,border:"2px solid "+c,background:ev.statusWWK===s?c:"white",color:ev.statusWWK===s?"white":c,transition:"all 0.15s"}}>{l}</button>
                ))}
              </div>
              <button onClick={e=>{e.stopPropagation();upd(ev.id,{statusWWK:"diwakilkan",delegasiWWKJajaran:true,statusWWK_by:"wakilwalikota"});showT("Pilih pejabat yang mewakili");}}
              style={{width:"100%",padding:"10px",borderRadius:10,border:"1.5px solid #7c3aed",background:ev.statusWWK==="diwakilkan"?"#7c3aed":"white",color:ev.statusWWK==="diwakilkan"?"white":"#7c3aed",cursor:"pointer",fontSize:12,fontWeight:700,marginBottom:ev.statusWWK==="diwakilkan"?8:0}}>
              {ev.statusWWK==="diwakilkan"?"✓ Didelegasikan ke Jajaran Lain":"→ Delegasikan ke Jajaran Lain"}
            </button>
            {ev.statusWWK==="diwakilkan"&&<div style={{marginTop:4}}>
              <input value={ev.perwakilanWWK||""} onChange={e=>upd(ev.id,{perwakilanWWK:e.target.value})}
                placeholder="Nama pejabat yang mewakili..." style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #CBD5E1",fontSize:12,boxSizing:"border-box"}}/>
            </div>}
            </>}
          </div>}
          {/* Wakilwalikota tanpa disposisi WK — konfirmasi langsung */}
          {role==="wakilwalikota"&&!ev.delegasiKeWWK&&ev.untukPimpinan.includes("wakilwalikota")&&<div style={{marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Konfirmasi Kehadiran</div>
            {kehadiranLocked
              ?<KehadiranLockedBanner/>
              :<><div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
                {[{s:"hadir",l:"✓  Saya Hadir",c:GREEN},{s:"tidak_hadir",l:"✗  Tidak Hadir",c:"#991B1B"}].map(({s,l,c})=>(
                  <button key={s} onClick={e=>{e.stopPropagation();upd(ev.id,{statusWWK:s,statusWWK_by:"wakilwalikota",delegasiWWKJajaran:false,perwakilanWWK:""});showT("Kehadiran berhasil dikonfirmasi");}}
                    style={{flex:1,padding:"13px 8px",borderRadius:12,cursor:"pointer",fontWeight:800,fontSize:13,border:"2px solid "+c,background:ev.statusWWK===s?c:"white",color:ev.statusWWK===s?"white":c,transition:"all 0.15s"}}>{l}</button>
                ))}
              </div>
              <button onClick={e=>{e.stopPropagation();upd(ev.id,{statusWWK:"diwakilkan",delegasiWWKJajaran:true,statusWWK_by:"wakilwalikota"});}}
                style={{width:"100%",padding:"10px",borderRadius:10,border:"1.5px solid #7c3aed",background:ev.statusWWK==="diwakilkan"?"#7c3aed":"white",color:ev.statusWWK==="diwakilkan"?"white":"#7c3aed",cursor:"pointer",fontSize:12,fontWeight:700}}>
                {ev.statusWWK==="diwakilkan"?"✓ Didelegasikan":"→ Delegasikan ke Jajaran Lain"}
              </button>
              {ev.statusWWK==="diwakilkan"&&<input value={ev.perwakilanWWK||""} onChange={e=>upd(ev.id,{perwakilanWWK:e.target.value})}
                placeholder="Nama pejabat yang mewakili..." style={{width:"100%",marginTop:8,padding:"8px 10px",borderRadius:8,border:"1.5px solid #CBD5E1",fontSize:12,boxSizing:"border-box"}}/>}
              </>
            }
          </div>}

          {/* Catatan pimpinan — hanya pimpinan yang bisa edit */}
          {(role==="walikota"||role==="wakilwalikota")&&<div>
            <div style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Arahan / Catatan untuk Tim</div>
            <CatatanInput
              evId={ev.id}
              initial={ev.catatanPimpinan}
              onSave={v=>{upd(ev.id,{catatanPimpinan:v});showT("Catatan disimpan");}}
              label={null}
              placeholder="Ketik arahan atau catatan khusus..."
            />
          </div>}
          {/* Catatan pimpinan — tampil saja untuk role lain jika ada isi */}
          {!(role==="walikota"||role==="wakilwalikota")&&ev.catatanPimpinan&&<div style={{background:"#EEF2FF",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#3730A3",fontStyle:"italic"}}>
            💬 Arahan: {ev.catatanPimpinan}
          </div>}
        </div>}
      </div>
    );
  };

  const greetingHour = new Date().getHours();
  const greeting = greetingHour<11?"Selamat Pagi":greetingHour<15?"Selamat Siang":greetingHour<18?"Selamat Sore":"Selamat Malam";
  const roleTitle = {
    walikota:"Wali Kota Tarakan",wakilwalikota:"Wakil Wali Kota Tarakan",
    kabag:"Kabag Protokol & Komunikasi Pimpinan",
    kasubbag_protokol:"Kasubbag Protokol",kasubbag_komdokpim:"Kasubbag Komdokpim",
    ajudan:"Ajudan Pimpinan",
    staf:"Staf Protokol",
    timkom:"Staf Komunikasi & Dokumentasi",
  mitra_kerja:"Mitra Kerja Pemkot",
  };
  const title = roleTitle[role]||"Pengguna";

  return (
    <div style={{flex:1,overflowY:"auto",background:"#F4F7FF"}}>
      {/* Greeting header */}
      <div style={{background:"linear-gradient(135deg,"+NAVY+" 0%,#1B3360 100%)",padding:isMobile?"20px 18px 24px":"28px 36px 32px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:140,height:140,borderRadius:"50%",background:"rgba(201,168,76,0.08)"}}/>
        <div style={{position:"absolute",bottom:-20,right:40,width:80,height:80,borderRadius:"50%",background:"rgba(201,168,76,0.05)"}}/>
        <div style={{color:"rgba(255,255,255,0.6)",fontSize:12,marginBottom:4}}>{greeting},</div>
        <div style={{color:"white",fontSize:isMobile?20:24,fontWeight:900,marginBottom:2}}>{user?.nama||title}</div>
        <div style={{color:GOLD,fontSize:12,fontWeight:600}}>
          {fmt(todayStr())} &nbsp;·&nbsp;{" "}
          {(role==="kasubbag_protokol"||role==="kasubbag_komdokpim"||role==="kabag")
            ?pendingApproval.length+" menunggu approval · "+upcoming.length+" akan datang"
            :upcoming.length+" agenda akan datang"
          }
        </div>
      </div>

      <div style={{padding:isMobile?"14px":"20px 28px"}}>
        {/* Alert kontekstual per role */}
        {(role==="walikota"||role==="wakilwalikota")&&upcoming.filter(e=>!statusWK(e)&&!e.delegasiKeWWK).length>0&&(
          <div style={{background:"#FFFBEB",border:"1.5px solid #F59E0B",borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:20}}>📋</span>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#92400E"}}>Ada agenda yang belum dikonfirmasi</div>
              <div style={{fontSize:12,color:"#B45309",marginTop:2}}>{upcoming.filter(e=>!statusWK(e)&&!e.delegasiKeWWK).length} jadwal menunggu konfirmasi kehadiran</div>
            </div>
          </div>
        )}
        {(role==="kasubbag_protokol"||role==="kasubbag_komdokpim"||role==="kabag")&&pendingApproval.length>0&&(
          <div style={{background:"#F5F3FF",border:"1.5px solid #A78BFA",borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:20}}>⏳</span>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#5B21B6"}}>{pendingApproval.length} jadwal menunggu persetujuan Anda</div>
              <div style={{fontSize:12,color:"#7C3AED",marginTop:2}}>Klik kartu untuk review dan setujui</div>
            </div>
          </div>
        )}
        {/* Evaluasi reminder untuk staf/timkom */}
        {myEvs.filter(e=>(e.personil||[]).includes(user.username)&&new Date(e.tanggal+"T"+e.jam)<now&&!(e.evaluasi||{})[user.username]?.submitted&&e.alur==="disetujui").length>0&&(
            <div style={{background:"#FEF3C7",border:"1.5px solid #F59E0B",borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",gap:10,alignItems:"center",cursor:"pointer"}}
              onClick={()=>showT("Buka kartu kegiatan → tombol 📝 Isi Evaluasi","info")}>
              <span style={{fontSize:20,flexShrink:0}}>📝</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:"#92400E"}}>{myEvs.filter(e=>(e.personil||[]).includes(user.username)&&new Date(e.tanggal+"T"+e.jam)<now&&!(e.evaluasi||{})[user.username]?.submitted&&e.alur==="disetujui").length} kegiatan belum dievaluasi</div>
                <div style={{fontSize:12,color:"#B45309",marginTop:2}}>Buka kartu kegiatan yang sudah selesai → tombol "Isi Evaluasi"</div>
              </div>
              <span style={{fontSize:18,color:"#B45309"}}>→</span>
            </div>
        )}

        {/* Peringatan acara berdekatan — hanya untuk agenda hari ini atau mendatang */}
        {(()=>{const _now=new Date();const _futureEvs=myEvs.filter(e=>new Date(e.tanggal+"T"+(e.jam||"00:00"))>=_now);const _pairs=getOverlappingPairs(_futureEvs);if(_pairs.length===0)return null;return(
            <div style={{background:"#FEF2F2",border:"1.5px solid #FECACA",borderRadius:12,padding:"12px 16px",marginBottom:14,cursor:"default"}}>
              <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontSize:20,flexShrink:0}}>⚡</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#991B1B",marginBottom:5}}>
                    {_pairs.length} pasang agenda berdekatan
                  </div>
                  {_pairs.map((p,i)=>(
                    <div key={i} style={{background:"white",borderRadius:8,padding:"7px 10px",marginBottom:i<_pairs.length-1?5:0,border:"1px solid #FECACA"}}>
                      <div style={{fontSize:11,color:"#374151",fontWeight:600,lineHeight:1.4}}>
                        <span style={{color:"#991B1B",fontWeight:800}}>{p.a.jam}</span> {p.a.namaAcara}
                        <span style={{color:"#9CA3AF",margin:"0 6px"}}>vs</span>
                        <span style={{color:"#991B1B",fontWeight:800}}>{p.b.jam}</span> {p.b.namaAcara}
                      </div>
                      <div style={{fontSize:10,color:"#9CA3AF",marginTop:3}}>
                        Selisih {p.diff} menit · {new Date(p.a.tanggal).toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short"})}
                        {p.a.untukPimpinan.some(x=>p.b.untukPimpinan.includes(x))&&
                          <span style={{marginLeft:6,background:"#FEE2E2",color:"#991B1B",padding:"1px 5px",borderRadius:4,fontWeight:700}}>
                            {p.a.untukPimpinan.filter(x=>p.b.untukPimpinan.includes(x)).map(x=>x==="walikota"?"WK":"WWK").join(" & ")}
                          </span>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
        );})()}
        {/* Antrian Approval untuk kasubbag_protokol/kabag */}
        {pendingApproval.length>0&&<>
          <div style={{fontSize:11,fontWeight:800,color:"#7C3AED",letterSpacing:1.5,textTransform:"uppercase",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
            <span>⏳</span> Menunggu Persetujuan Anda ({pendingApproval.length})
          </div>
          {pendingApproval.map(ev=><EventBlock key={ev.id} ev={ev}/>)}
          <div style={{marginBottom:14}}/>
        </>}
        {/* Agenda akan datang */}
        {upcoming.length>0&&<>
          <div style={{fontSize:11,fontWeight:800,color:NAVY,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
            <span>📅</span> Agenda Mendatang
          </div>
          {upcoming.map(ev=><EventBlock key={ev.id} ev={ev}/>)}
        </>}

        {upcoming.length===0&&(
          <div style={{textAlign:"center",padding:"50px 20px",color:"#94A3B8"}}>
            <div style={{fontSize:48,marginBottom:10}}>✅</div>
            <div style={{fontSize:16,fontWeight:700,color:"#334155",marginBottom:4}}>Tidak ada agenda mendatang</div>
            <div style={{fontSize:13}}>Semua agenda telah selesai atau belum dijadwalkan.</div>
          </div>
        )}

        {/* Riwayat singkat */}
        {past.length>0&&<>
          <div style={{fontSize:11,fontWeight:800,color:"#94A3B8",letterSpacing:1.5,textTransform:"uppercase",margin:"20px 0 8px",borderTop:"1px solid #E2E8F0",paddingTop:16,display:"flex",alignItems:"center",gap:6}}>
            <span>📁</span> Riwayat Terakhir
          </div>
          {past.slice(0,3).map(ev=><EventBlock key={ev.id} ev={ev}/>)}
          {past.length>3&&<div style={{textAlign:"center",fontSize:12,color:"#94A3B8",marginTop:4}}>+ {past.length-3} agenda sebelumnya</div>}
        </>}
      </div>
    </div>
  );
}

// ==================== FORM ====================
  // FormView is a top-level component (defined outside App) to prevent re-mount on every keystroke


  // ==================== MAIN CONTENT ====================
  const pageTitle=tab==="tayang"?"Agenda Kegiatan Pimpinan":tab==="form"?"Input Jadwal Baru":tab==="semua"?"Semua Jadwal":tab==="penugasan"?"Penugasan Saya":tab==="jadwal"?KASUBBAG_ROLES.includes(role)||role==="kabag"?"Antrian Approval":role==="admin_rk"?"Jadwal Saya":"Jadwal Saya":"Jadwal";

  // ═══════════════════════════════════════════════════════════════
  // FITUR 1: SAPAAN CERDAS + RINGKASAN PAGI
  // ═══════════════════════════════════════════════════════════════
  const nowHr=new Date().getHours();
  const isMorningWindow=nowHr>=5&&nowHr<10;
  const todayEvents=events.filter(e=>e.alur==="disetujui"&&e.tanggal===todayStr()).sort((a,b)=>a.jam.localeCompare(b.jam));
  const tmrwEvents=events.filter(e=>e.alur==="disetujui"&&e.tanggal===tomorrowStr());
  const pendingMyAction=events.filter(e=>{
    if(role==="admin_rk"&&(e.alur==="draft"||e.alur==="ditolak")&&e.submittedBy===user?.username)return true;
    if(KASUBBAG_ROLES.includes(role)&&e.alur==="menunggu_kasubbag")return true;
    if(role==="kabag"&&e.alur==="menunggu_kabag")return true;
    if((role==="ajudan_walikota")&&e.alur==="disetujui"&&e.untukPimpinan?.includes("walikota")&&!e.statusWK&&!e.delegasiKeWWK)return true;
    if((role==="ajudan_wakilwalikota")&&e.alur==="disetujui"&&(e.untukPimpinan?.includes("wakilwalikota")||e.delegasiKeWWK)&&!e.statusWWK)return true;
    return false;
  });
  const myAssigned=events.filter(e=>e.alur==="disetujui"&&(e.personil||[]).includes(user?.username));
  const nextEvent=todayEvents.find(e=>{const evTime=new Date(e.tanggal+"T"+e.jam);return evTime>new Date();});

  const smartGreetText=(()=>{
    const nm=user?.nama||"";
    const greetW=nowHr<11?"Pagi":nowHr<15?"Siang":nowHr<18?"Sore":"Malam";
    if(pendingMyAction.length>0)return`${greetW}, ${nm} — ${pendingMyAction.length} hal menunggu tindakan Anda`;
    if(nextEvent)return`${greetW}, ${nm} — acara berikutnya: ${nextEvent.namaAcara} pukul ${nextEvent.jam}`;
    if(todayEvents.length>0)return`${greetW}, ${nm} — ${todayEvents.length} jadwal hari ini`;
    if(tmrwEvents.length>0)return`${greetW}, ${nm} — besok ada ${tmrwEvents.length} jadwal`;
    return`${greetW}, ${nm} — tidak ada jadwal mendekati, semua terkendali`;
  })();

  const showMorningSummary=isMorningWindow&&!morningDismissed&&(todayEvents.length>0||pendingMyAction.length>0);

  const MorningSummaryCard=()=>{
    if(!showMorningSummary)return null;
    return <div style={{background:"linear-gradient(135deg,#0A1628,#1B3360)",borderRadius:16,padding:"18px",marginBottom:14,position:"relative",overflow:"hidden",animation:"upSpring 0.4s ease both"}}>
      <div style={{position:"absolute",top:-20,right:-20,width:100,height:100,borderRadius:"50%",background:"rgba(201,168,76,0.08)"}}/>
      <button onClick={()=>setMorningDismissed(true)} style={{position:"absolute",top:10,right:12,background:"rgba(255,255,255,0.15)",border:"none",borderRadius:6,color:"rgba(255,255,255,0.6)",cursor:"pointer",padding:"2px 8px",fontSize:11}}>✕</button>
      <div style={{color:"#C9A84C",fontSize:10,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Briefing Pagi</div>
      <div style={{color:"white",fontSize:15,fontWeight:800,lineHeight:1.4,marginBottom:12}}>{smartGreetText}</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {todayEvents.length>0&&<div style={{background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 12px",flex:1,minWidth:100}}>
          <div style={{fontSize:20,fontWeight:900,color:"white"}}>{todayEvents.length}</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",fontWeight:600}}>Jadwal hari ini</div>
        </div>}
        {pendingMyAction.length>0&&<div style={{background:"rgba(245,158,11,0.15)",borderRadius:10,padding:"8px 12px",flex:1,minWidth:100,border:"1px solid rgba(245,158,11,0.3)"}}>
          <div style={{fontSize:20,fontWeight:900,color:"#FCD34D"}}>{pendingMyAction.length}</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",fontWeight:600}}>Perlu tindakan</div>
        </div>}
        {myAssigned.length>0&&<div style={{background:"rgba(34,197,94,0.12)",borderRadius:10,padding:"8px 12px",flex:1,minWidth:100}}>
          <div style={{fontSize:20,fontWeight:900,color:"#86EFAC"}}>{myAssigned.length}</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",fontWeight:600}}>Ditugaskan ke Anda</div>
        </div>}
        {nextEvent&&<div style={{width:"100%",background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",gap:10,marginTop:2}}>
          <div style={{background:"#C9A84C",color:"#0A1628",borderRadius:8,padding:"4px 8px",fontSize:13,fontWeight:900,flexShrink:0}}>{nextEvent.jam}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:700,color:"white",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nextEvent.namaAcara}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>{nextEvent.penyelenggara} · {nextEvent.lokasi||"-"}</div>
          </div>
        </div>}
      </div>
    </div>;
  };

  // ═══════════════════════════════════════════════════════════════
  // FITUR 2: STREAK & STATISTIK PRIBADI
  // ═══════════════════════════════════════════════════════════════
  const UserStreakCard=()=>{
    const mySubmitted=events.filter(e=>e.submittedBy===user?.username);
    const approved=mySubmitted.filter(e=>e.alur==="disetujui");
    const rejected=mySubmitted.filter(e=>e.alur==="ditolak");
    const thisMonth=mySubmitted.filter(e=>{const d=new Date(e.tanggal);const now=new Date();return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
    // Streak: berapa hari berturut-turut ada jadwal disetujui tanpa ditolak
    const approvedDates=[...new Set(approved.map(e=>e.tanggal))].sort().reverse();
    let streak=0;
    if(approvedDates.length>0){
      const today=new Date();
      for(let i=0;i<60;i++){
        const d=new Date(today);d.setDate(d.getDate()-i);
        const ds=d.toISOString().slice(0,10);
        if(approvedDates.includes(ds))streak++;
        else if(i>0)break;
      }
    }
    const successRate=mySubmitted.length>0?Math.round(approved.length/mySubmitted.length*100):0;
    if(mySubmitted.length===0)return null;
    return <div style={{background:"white",borderRadius:14,padding:"14px 16px",marginBottom:14,boxShadow:"0 2px 8px rgba(0,0,0,0.04)",border:"1px solid #E8EDF4"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
        <span style={{fontSize:16}}>📊</span>
        <div style={{fontSize:12,fontWeight:800,color:NAVY}}>Statistik Anda</div>
        <div style={{marginLeft:"auto",fontSize:10,color:"#94A3B8"}}>{new Date().toLocaleDateString("id-ID",{month:"long",year:"numeric"})}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <div style={{textAlign:"center",padding:"10px 4px",background:"#F8FAFF",borderRadius:10}}>
          <div style={{fontSize:22,fontWeight:900,color:NAVY}}>{thisMonth.length}</div>
          <div style={{fontSize:9,color:"#64748B",fontWeight:700,marginTop:2}}>Bulan Ini</div>
        </div>
        <div style={{textAlign:"center",padding:"10px 4px",background:successRate>=80?"#F0FDF4":"#FFFBEB",borderRadius:10}}>
          <div style={{fontSize:22,fontWeight:900,color:successRate>=80?GREEN:"#D97706"}}>{successRate}%</div>
          <div style={{fontSize:9,color:"#64748B",fontWeight:700,marginTop:2}}>Approval Rate</div>
        </div>
        <div style={{textAlign:"center",padding:"10px 4px",background:streak>0?"#EEF2FF":"#F8FAFF",borderRadius:10}}>
          <div style={{fontSize:22,fontWeight:900,color:streak>0?"#4F46E5":"#94A3B8"}}>{streak||"-"}</div>
          <div style={{fontSize:9,color:"#64748B",fontWeight:700,marginTop:2}}>{streak>0?"Hari Streak":"Streak"}</div>
        </div>
      </div>
      {streak>=7&&<div style={{marginTop:10,background:"linear-gradient(90deg,#EEF2FF,#F5F3FF)",borderRadius:8,padding:"6px 10px",fontSize:11,color:"#4338CA",fontWeight:700,textAlign:"center"}}>🔥 {streak} hari berturut-turut jadwal disetujui!</div>}
    </div>;
  };

  // ═══════════════════════════════════════════════════════════════
  // FITUR 4: VIEW TOGGLE (Cards / Timeline) + FAB
  // ═══════════════════════════════════════════════════════════════

  // ── AppCtx value ──
  const _ctxValue={
    expandedId,setExp,role,user,isMobile,
    getHari,fmt,fmtShort,todayStr,
    handleUndanganUpload,handleSambutanDocx,handleSambutanUpload,updAndSync,storageDelete,
    showT,upd,setDelegTarget,setTab,setForm,setEditId,setPenugasanEv,setEvaluasiEv,
    rejectTexts,setRT,askConfirm,deleteAndSync,makeICS,PersonilBanner,
    getNamaByUsername,
  };

  const mainContentJSX=(<div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",background:"#F0F4FA",overflow:"hidden"}}>
    {/* ── Desktop top bar ── */}
    {!isMobile&&<div style={{background:"white",borderBottom:"1px solid #E4EAF2",padding:"14px 32px",display:"flex",alignItems:"center",gap:16,flexShrink:0,boxShadow:"0 1px 8px rgba(0,0,0,0.04)"}}>
      <div style={{flex:1}}>
        <div style={{fontSize:20,fontWeight:800,color:NAVY,letterSpacing:"-0.4px"}}>{pageTitle}</div>
        <div style={{fontSize:11.5,color:"#64748B",marginTop:2,fontWeight:500}}>{smartGreetText}</div>
      </div>
      {pendingList.length>0&&<button onClick={goToPending} className="btn-ios" style={{padding:"9px 16px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#EF4444,#DC2626)",color:"white",cursor:"pointer",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:7,boxShadow:"0 4px 14px rgba(220,38,38,0.35)"}}>
        <span style={{background:"rgba(255,255,255,0.25)",borderRadius:"50%",width:20,height:20,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900}}>{pendingList.length}</span>Pending Approval
      </button>}
      <button aria-label="Notifikasi" onClick={()=>setShowNotifCenter(true)} style={{position:"relative",width:38,height:38,borderRadius:10,border:"1.5px solid #E2E8F0",background:"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
        🔔
        {notifPenugasan.length>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#EF4444",color:"white",borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900}}>{notifPenugasan.length}</span>}
      </button>
      {role==="admin_rk"&&tab==="jadwal"&&<button onClick={()=>{setTab("form");setForm(emptyForm);setEditId(null);}} className="btn-ios" style={{padding:"9px 18px",borderRadius:10,border:"none",background:"linear-gradient(135deg,"+NAVY+",#1E3254)",color:"white",cursor:"pointer",fontSize:13,fontWeight:700,boxShadow:"0 4px 14px rgba(10,22,40,0.3)"}}>+ Input Jadwal Baru</button>}
    </div>}

    {/* ── Filters — hanya tampil di tab yang menampilkan list event ── */}
    {!showForm&&(tab==="tayang"||tab==="semua"||(tab==="jadwal"&&!["kasubbag_protokol","kasubbag_komdokpim","kabag"].includes(role))||tab==="mitra")&&<>
    {/* Search bar — expandable */}
    <div style={{background:"white",borderBottom:"1px solid #E4EAF2",padding:"8px "+(isMobile?"14px":"32px"),display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
      {showSearch
        ?<div style={{flex:1,display:"flex",gap:7,alignItems:"center"}}>
          <div style={{flex:1,display:"flex",alignItems:"center",gap:8,background:"#F8FAFC",borderRadius:12,padding:"8px 12px",border:"2px solid "+NAVY}}>
            <span style={{fontSize:15,flexShrink:0}}>🔍</span>
            <input
              autoFocus
              value={searchQ}
              onChange={e=>setSearchQ(e.target.value)}
              placeholder="Cari nama acara, penyelenggara, lokasi, catatan..."
              style={{flex:1,border:"none",background:"transparent",fontSize:13,color:"#1E293B",outline:"none",minWidth:0}}
            />
            {searchQ&&<button onClick={()=>setSearchQ("")} style={{border:"none",background:"none",color:"#94A3B8",cursor:"pointer",fontSize:16,lineHeight:1,padding:"0 2px",flexShrink:0}}>✕</button>}
          </div>
          <button onClick={()=>{setShowSearch(false);setSearchQ("");}} style={{padding:"8px 14px",borderRadius:10,border:"1.5px solid #E2E8F0",background:"white",color:"#64748B",cursor:"pointer",fontSize:12,fontWeight:700,flexShrink:0}}>Tutup</button>
        </div>
        :<>
          <button onClick={()=>setShowSearch(true)} className="btn-ios" style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:20,border:"1.5px solid #E4EAF2",background:"white",color:"#64748B",cursor:"pointer",fontSize:12,fontWeight:700,flexShrink:0}}>
            <span style={{fontSize:14}}>🔍</span> Cari
          </button>
          {/* View toggle */}
          <div style={{display:"flex",gap:0,background:"#F1F5F9",borderRadius:8,padding:2,flexShrink:0}}>
            <button onClick={()=>setViewMode("cards")} style={{padding:"5px 10px",borderRadius:6,border:"none",background:viewMode==="cards"?"white":"transparent",color:viewMode==="cards"?NAVY:"#94A3B8",cursor:"pointer",fontSize:11,fontWeight:700,boxShadow:viewMode==="cards"?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>Kartu</button>
            <button onClick={()=>setViewMode("timeline")} style={{padding:"5px 10px",borderRadius:6,border:"none",background:viewMode==="timeline"?"white":"transparent",color:viewMode==="timeline"?NAVY:"#94A3B8",cursor:"pointer",fontSize:11,fontWeight:700,boxShadow:viewMode==="timeline"?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>Timeline</button>
          </div>
          <div style={{flex:1}}/>
          <span style={{fontSize:11,color:"#94A3B8",fontWeight:500,flexShrink:0}}>{listEvents.length} agenda</span>
        </>}
    </div>
    {searchQ.trim()&&<div style={{background:"#EFF6FF",padding:"5px "+(isMobile?"14px":"32px"),borderBottom:"1px solid #DBEAFE",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
      <span style={{fontSize:11,background:NAVY,color:"white",borderRadius:20,padding:"2px 10px",fontWeight:700,letterSpacing:0.5}}>CARI</span>
      <span style={{fontSize:12,color:"#1D4ED8",fontWeight:600}}>"{searchQ}" — {listEvents.length} hasil ditemukan</span>
      <button onClick={()=>{setSearchQ("");setShowSearch(false);}} style={{marginLeft:"auto",padding:"3px 10px",borderRadius:8,border:"1.5px solid #BFDBFE",background:"white",color:"#1D4ED8",cursor:"pointer",fontSize:11,fontWeight:700}}>✕ Hapus</button>
    </div>}
    <div style={{background:"white",borderBottom:"1px solid #E4EAF2",padding:"10px "+(isMobile?"14px":"32px"),display:"flex",gap:6,overflowX:"auto",flexShrink:0,alignItems:"center",scrollbarWidth:"none"}}>
      <style>{"div::-webkit-scrollbar{display:none;}"}</style>
      {[{l:"Hari Ini",v:todayStr()},{l:"Besok",v:tomorrowStr()},{l:"Minggu Ini",v:"week"},{l:"Semua",v:""}].map(q=>{
        const active=(q.v==="week"?filterDate==="week":filterDate===q.v)&&(q.v!==""||filterDate==="");
        return <button key={q.l} onClick={()=>setFDate(q.v==="week"?"week":q.v)} className="btn-ios" style={{padding:"6px 14px",borderRadius:20,border:"1.5px solid "+(active?NAVY:"#E4EAF2"),background:active?"linear-gradient(135deg,"+NAVY+",#1E3254)":"white",color:active?"white":"#64748B",cursor:"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap",flexShrink:0,boxShadow:active?"0 2px 8px rgba(10,22,40,0.2)":"none"}}>{q.l}</button>;
      })}
      <input type="date" value={filterDate==="week"||filterDate==="range"?"":filterDate} onChange={e=>setFDate(e.target.value)} style={{padding:"5px 12px",borderRadius:20,border:"1.5px solid #E4EAF2",fontSize:11,color:"#64748B",background:"white",flexShrink:0}}/>
      <button onClick={()=>{setFDate("range");setShowRangeFilter(p=>!p);}} className="btn-ios" style={{padding:"6px 14px",borderRadius:20,border:"1.5px solid "+(filterDate==="range"?NAVY:"#E4EAF2"),background:filterDate==="range"?"linear-gradient(135deg,"+NAVY+",#1E3254)":"white",color:filterDate==="range"?"white":"#64748B",cursor:"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>📆 Rentang</button>
      {filterDate&&<button onClick={()=>{setFDate("");setFilterFrom("");setFilterTo("");setShowRangeFilter(false);}} className="btn-ios" style={{padding:"6px 11px",borderRadius:20,border:"none",background:"#FEF2F2",color:"#DC2626",cursor:"pointer",fontSize:11,fontWeight:700,flexShrink:0}}>✕ Reset</button>}
    </div>
    {(filterDate&&filterDate!=="all")&&<div style={{background:"#EFF6FF",padding:"6px "+(isMobile?"14px":"32px"),borderBottom:"1px solid #DBEAFE",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
      <span style={{fontSize:11,background:"#0A1628",color:"white",borderRadius:20,padding:"2px 10px",fontWeight:700,letterSpacing:0.5}}>FILTER AKTIF</span>
      <span style={{fontSize:12,color:"#1D4ED8",fontWeight:600}}>{filterDate==="today"?"Hari Ini":filterDate==="week"?"Minggu Ini":"Rentang: "+filterFrom+" — "+filterTo}</span>
      <button onClick={()=>{setFDate("");setFilterFrom("");setFilterTo("");setShowRangeFilter(false);}} style={{marginLeft:"auto",padding:"3px 10px",borderRadius:8,border:"1.5px solid #BFDBFE",background:"white",color:"#1D4ED8",cursor:"pointer",fontSize:11,fontWeight:700}}>✕ Hapus</button>
    </div>}
    {showRangeFilter&&filterDate==="range"&&<div style={{background:"#F0F4FF",padding:"10px "+(isMobile?"14px":"32px"),borderBottom:"1px solid #E4EAF2",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <span style={{fontSize:11,color:"#475569",fontWeight:700}}>Dari</span>
      <input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} style={{padding:"5px 12px",borderRadius:9,border:"1.5px solid #CBD5E1",fontSize:12,color:"#334155",background:"white"}}/>
      <span style={{fontSize:11,color:"#475569",fontWeight:700}}>Sampai</span>
      <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} style={{padding:"5px 12px",borderRadius:9,border:"1.5px solid #CBD5E1",fontSize:12,color:"#334155",background:"white"}}/>
      {filterFrom&&filterTo&&<span style={{fontSize:11,color:"#0A1628",fontWeight:700,background:"#C9A84C22",padding:"4px 10px",borderRadius:6,border:"1px solid #C9A84C44"}}>{filterFrom} — {filterTo}</span>}
    </div>}
    </>}

    {/* ── Content area ── */}
    <div style={{flex:1,overflowY:"auto",padding:isMobile?"12px 14px calc(env(safe-area-inset-bottom,0px) + 72px)":"24px 32px 48px"}}>
      {/* ── Morning Summary + Streak — hanya di tab tayang/semua dan role tanpa dashboard khusus ── */}
      {(tab==="tayang"||tab==="semua")&&<>
        <MorningSummaryCard/>
        {["admin_rk","staf","timkom"].includes(role)&&<UserStreakCard/>}
      </>}
      {tab==="tayang"&&!isMobile&&<div style={{background:"linear-gradient(135deg,"+NAVY+" 0%,#1E3254 100%)",padding:"18px 22px",borderRadius:16,marginBottom:20,display:"flex",alignItems:"center",gap:14,boxShadow:"0 6px 24px rgba(10,22,40,0.22)"}}>
        <div style={{width:46,height:46,borderRadius:14,background:"rgba(212,175,90,0.18)",border:"1.5px solid rgba(212,175,90,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🏛️</div>
        <div>
          <div style={{fontSize:15,fontWeight:800,color:"white",letterSpacing:"-0.2px"}}>Agenda Pimpinan Kota Tarakan</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.55)",marginTop:2}}>{listEvents.length} kegiatan disetujui · terlihat semua pengguna</div>
        </div>
      </div>}
      {/* ══ CONTENT ROUTING — setiap tab×role HARUS punya handler ══ */}
      {/* 1. Penugasan (semua role yang punya tab ini) */}
      {showPenugasan&&(role==="kabag"||KASUBBAG_ROLES.includes(role))
        ?<RekapEvaluasi events={events} user={user} isMobile={isMobile}/>
      :showPenugasan
        ?<PenugasanSayaView events={events} user={user} onOpenEvaluasi={setEvaluasiEv} isMobile={isMobile}/>

      /* 2. Ajudan dashboard */
      :(role==="ajudan_walikota"||role==="ajudan_wakilwalikota")&&tab==="ajudan"
        ?<AjudanDashboard events={events} user={user} upd={upd} showT={showT} setDelegTarget={setDelegTarget} isMobile={isMobile} initialExpandedId={pendingExpandTarget} onExpandConsumed={()=>setPendingExpandTarget(null)}/>

      /* 3. Kabag dashboard */
      :role==="kabag"&&tab==="dashboard"
        ?<KabagDashboard events={events} user={user} upd={upd} showT={showT} askConfirm={askConfirm} deleteAndSync={deleteAndSync} isMobile={isMobile}/>

      /* 4. Kasubbag dashboard */
      :KASUBBAG_ROLES.includes(role)&&tab==="dashboard"
        ?<KasubbagDashboard events={events} user={user} upd={upd} showT={showT} askConfirm={askConfirm} isMobile={isMobile} onPenugasan={ev=>setPenugasanEv(ev)}/>

      /* 5. Admin RK: Draft & Progress */
      :(role==="admin_rk"&&tab==="draft")
        ?<DraftProgressView events={events} user={user} upd={upd} showT={showT} askConfirm={askConfirm} setTab={setTab} isMobile={isMobile}/>

      /* 6. Admin RK: Form input jadwal */
      :showForm
        ?<FormView form={form} setForm={setForm} editId={editId} setEditId={setEditId} setTab={setTab} isMobile={isMobile} onSubmit={submit} onCancel={()=>{setForm(emptyForm);setEditId(null);setTab("jadwal");}} onOpenAI={()=>setShowAI(true)} onUndanganUpload={handleUndanganUpload} showT={showT} canUploadUndangan={role==="admin_rk"}/>

      /* 7. Admin RK: Rencana Kegiatan */
      :(role==="admin_rk"&&tab==="rk")
        ?<RKView events={events} user={user} upd={upd} updAndSync={updAndSync} showT={showT} isMobile={isMobile}/>

      /* 8. Kasubbag/Kabag: Antrian Approval (tab jadwal) */
      :(["kasubbag_protokol","kasubbag_komdokpim","kabag"].includes(role)&&tab==="jadwal")
        ?<ApprovalQueueView events={events} role={role} upd={upd} showT={showT} askConfirm={askConfirm} isMobile={isMobile}/>

      /* 9. Mitra Kerja */
      :role==="mitra_kerja"&&(tab==="mitra"||tab==="jadwal")
        ?<MitraKerjaView events={events} isMobile={isMobile}/>

      /* 10. Pimpinan View (WK, WWK, ajudan, staf, timkom, admin_rk — tab jadwal) */
      :tab==="jadwal"
        ?<PimpinanView events={events} role={role} user={user} upd={upd} showT={showT} isMobile={isMobile} setDelegTarget={setDelegTarget} initialExpandedId={pendingExpandTarget} onExpandConsumed={()=>setPendingExpandTarget(null)}/>

      /* 11. Tayang / Semua — generic event list untuk semua role */
      :(tab==="tayang"||tab==="semua")
        ?<>{listEvents.length===0
          ?<div style={{textAlign:"center",padding:"60px 24px",background:"white",borderRadius:20,boxShadow:"0 2px 16px rgba(0,0,0,0.06)"}}>
            {filterDate&&filterDate!=="all"
              ?<>
                <div style={{fontSize:48,marginBottom:12}}>🔍</div>
                <div style={{fontSize:16,fontWeight:700,color:"#334155",marginBottom:8}}>Tidak ada jadwal ditemukan</div>
                <div style={{fontSize:13,color:"#94A3B8",marginBottom:16}}>Filter aktif: <strong style={{color:"#0A1628"}}>{filterDate==="today"?"Hari Ini":filterDate==="week"?"Minggu Ini":"Rentang Tanggal"}</strong></div>
                <button onClick={()=>{setFDate("");setFilterFrom("");setFilterTo("");setShowRangeFilter(false);}}
                  style={{padding:"10px 20px",borderRadius:10,border:"1.5px solid #0A1628",background:"white",color:"#0A1628",cursor:"pointer",fontSize:13,fontWeight:700}}>
                  Hapus Filter
                </button>
              </>
              :<>
                <div style={{fontSize:52,marginBottom:12}}>📭</div>
                <div style={{fontSize:16,fontWeight:700,color:"#334155",marginBottom:6}}>Belum ada jadwal</div>
                <div style={{fontSize:13,color:"#94A3B8"}}>Belum ada jadwal yang tersedia untuk ditampilkan</div>
              </>
            }
          </div>
          :viewMode==="timeline"
              ?<TimelineView evList={listEvents}/>
              :isMobile
                ?<div>{listEvents.map(ev=><EventCard key={ev.id} ev={ev}/>)}</div>
                :<TableView evList={listEvents}/>
        }</>

      /* 12. Notif — ditangani oleh bell icon, tidak perlu render */
      :tab==="notif"
        ?null

      /* 13. FALLBACK SAFETY NET — tidak pernah blank */
      :<div style={{textAlign:"center",padding:"60px 24px",background:"white",borderRadius:20,boxShadow:"0 2px 16px rgba(0,0,0,0.06)"}}>
          <div style={{fontSize:52,marginBottom:12}}>📋</div>
          <div style={{fontSize:16,fontWeight:700,color:"#334155",marginBottom:6}}>Tidak ada konten</div>
          <div style={{fontSize:13,color:"#94A3B8",marginBottom:16}}>Halaman ini belum tersedia</div>
          <button onClick={()=>setTab("jadwal")} style={{padding:"10px 20px",borderRadius:10,border:"none",background:NAVY,color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>Kembali ke Jadwal</button>
        </div>
      }
    </div>
  </div>);

  // ==================== RENDER ====================
  return (<AppCtx.Provider value={_ctxValue}>
  <div style={{minHeight:"100vh",width:"100%",background:NAVY,display:"flex"}}>
    <style>{CSS}</style>
    {toast&&<Toast msg={toast.msg} type={toast.type}/>}

    {/* ── Pull-to-refresh indicator ── */}
    {pullRefreshing&&<div className="pull-refresh-bar">
      <div className="pull-refresh-spinner"/>
      <span style={{color:"white",fontSize:12,fontWeight:700,marginLeft:10}}>Memperbarui data...</span>
    </div>}

    {/* ── Session Timeout Warning ── */}
    {sessionWarn&&<div className="session-warn">
      <span>⏱️</span>
      <span>Sesi akan berakhir dalam 5 menit karena tidak aktif</span>
      <button onClick={()=>{touchActivity();setSessionWarn(false);}}>Perpanjang</button>
    </div>}

    {/* ── Offline Banner ── */}
    {isOffline&&<div className="offline-banner">
      <span>📡</span> Koneksi terputus — data belum tersinkron
    </div>}

    {/* ── Scroll to Top ── */}
    {showScrollTop&&isMobile&&<button className="scroll-top-btn" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} aria-label="Kembali ke atas">↑</button>}

    {/* ── FAB: Quick Add for admin_rk ── */}
    {isMobile&&role==="admin_rk"&&tab==="jadwal"&&!showForm&&<button onClick={()=>{setTab("form");setForm(emptyForm);setEditId(null);haptic(60);}} aria-label="Input jadwal baru" style={{position:"fixed",bottom:76,right:isMobile&&showScrollTop?60:16,zIndex:260,width:52,height:52,borderRadius:16,border:"none",background:"linear-gradient(135deg,#0A1628,#1E3254)",color:"#C9A84C",cursor:"pointer",fontSize:24,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 24px rgba(10,22,40,0.4),0 0 0 3px rgba(201,168,76,0.15)",transition:"all 0.2s cubic-bezier(0.34,1.56,0.64,1)"}}>+</button>}

    {showOnboarding&&user&&<OnboardingModal role={user.role} onClose={()=>{
      setShowOnboarding(false);
      try{const s=JSON.parse(localStorage.getItem("jp_seen_onboarding")||"{}");s[user.username]=true;localStorage.setItem("jp_seen_onboarding",JSON.stringify(s));}catch{}
    }}/>}
    {confirmDlg&&<ConfirmModal
      title={confirmDlg.title}
      body={confirmDlg.body}
      confirmLabel={confirmDlg.confirmLabel}
      confirmColor={confirmDlg.confirmColor}
      onConfirm={confirmDlg.onConfirm}
      onCancel={()=>setConfirmDlg(null)}
    />}

    {/* Notif bar jadwal belum ditugaskan (H-12) */}
    {(role==="kasubbag_protokol"||role==="kasubbag_komdokpim"||role==="timkom")&&notifPenugasan.length>0&&tab!=="form"&&
      <div style={{position:"fixed",bottom:isMobile?70:20,left:"50%",transform:"translateX(-50%)",zIndex:2000,background:"#7c2d12",color:"white",borderRadius:12,padding:"10px 18px",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:10,boxShadow:"0 4px 20px rgba(0,0,0,0.3)",maxWidth:360,width:"calc(100% - 32px)",cursor:"pointer"}}
        onClick={()=>showT(notifPenugasan.map(e=>e.namaAcara).join(", ")+" — belum ada personil","warn")}>
        <span style={{fontSize:18}}>⚠️</span>
        <div>
          <div>{notifPenugasan.length} jadwal belum ditugaskan personil</div>
          <div style={{fontSize:11,opacity:0.8,fontWeight:500}}>Kurang dari 12 jam sebelum acara dimulai</div>
        </div>
        <button onClick={e=>{e.stopPropagation();setNotifPenugasan([]);}} style={{marginLeft:"auto",background:"rgba(255,255,255,0.2)",border:"none",color:"white",borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:12}}>✕</button>
      </div>
    }

    {/* PenugasanModal */}
    {evaluasiEv&&<EvaluasiModal
      ev={evaluasiEv}
      onClose={()=>setEvaluasiEv(null)}
      onSave={(entry)=>{saveEvaluasi(evaluasiEv.id,entry);}}
      currentUser={user}
    />}

    {penugasanEv&&<PenugasanModal
      ev={penugasanEv}
      onClose={()=>setPenugasanEv(null)}
      onSave={(personil,catatan)=>savePenugasan(penugasanEv.id,personil,catatan)}
      currentUser={user}
      allUsers={loadUsers()}
      allEvents={events}
    />}
    {showNotifCenter&&<NotifCenter events={events} user={user} onClose={()=>setShowNotifCenter(false)} isMobile={isMobile}/>}
    {showForgot&&<ForgotPasswordModal onClose={()=>setShowForgot(false)}/>}
    {showAI&&<AIModal onFill={d=>{
      // undanganFile sudah berupa URL Supabase (atau base64 fallback) — sudah dikompresi & diupload di dalam AIModal
      const{undanganFile,undanganNama,...formData}=d;
      setForm(p=>({...p,...formData,...(undanganFile?{undanganFile,undanganNama,_undanganFromAI:true}:{})}));
      setShowAI(false);setTab("form");
      showT(undanganFile?"Form terisi dari AI ✓ — berkas undangan tersimpan":"Form terisi dari AI ✓","warn");
    }} onClose={()=>setShowAI(false)}/>}
    {showSummary&&<SummaryModal events={events} onToggleHide={id=>upd(id,{tersembunyi:!events.find(e=>e.id===id)?.tersembunyi})} onClose={()=>setShowSummary(false)}/>}
    {showAdmin&&<AdminModal onClose={()=>setShowAdmin(false)} showT={showT}/>}
    {showBroadcast&&<BroadcastModal onClose={()=>setShowBroadcast(false)} showT={showT} senderNama={user?.nama||"Kabag Protokol dan Komunikasi Pimpinan"}/>}
    {showReport&&<ReportingModal events={events} kabagNama={kabagNama} cetakOleh={user?.nama||user?.username||""} onClose={()=>setShowReport(false)}/>}
    {showProfile&&<ProfileModal user={user} onClose={updated=>{setShowProfile(false);if(updated)setUser(updated);}} showT={showT}/>}
    {showLaporan&&<LaporanModal events={events} kabagNama={kabagNama} cetakOleh={user?.nama||user?.username||""} onClose={()=>setShowLaporan(false)}/>}
    {delegTarget&&<DelegateModal label={delegTarget.side==="wk"||delegTarget.side==="wk_adminrk"?"Wali Kota":"Wakil Wali Kota"} onConfirm={name=>{if(delegTarget.side==="wk")upd(delegTarget.id,{statusWK:"diwakilkan",perwakilanWK:name,delegasiKeWWK:false,statusWK_by:"ajudan"});else if(delegTarget.side==="wk_adminrk")upd(delegTarget.id,{statusWK:"diwakilkan",perwakilanWK:name,delegasiKeWWK:false,statusWK_by:"admin_rk"});else upd(delegTarget.id,{statusWWK:"diwakilkan",perwakilanWWK:name,statusWWK_by:"ajudan"});setDelegTarget(null);showT("Diwakilkan ke "+name);}} onCancel={()=>setDelegTarget(null)}/>}
    {isMobile
      ?<div style={{width:"100%",minHeight:"100vh",display:"flex",flexDirection:"column",background:"#F0F4FA",paddingTop:"env(safe-area-inset-top,0px)"}}>
        {mobileHeaderJSX}
        {mainContentJSX}
       </div>
      :<div style={{width:"100%",minHeight:"100vh",display:"flex",background:NAVY}}>{sidebarJSX}{mainContentJSX}</div>
    }
  </div>
  </AppCtx.Provider>);
}
