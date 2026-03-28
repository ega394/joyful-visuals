/**
 * api/drive.js — Prokopim v2.0 (True Cloud-to-Cloud Sync)
 * * Vercel HANYA menerima ID Jadwal. File raksasa (Base64) akan disedot 
 * langsung dari Supabase oleh Vercel, lalu dilempar ke Google Drive.
 * 100% BEBAS DARI LIMIT 4.5MB VERCEL!
 */

export const config = {
  api: { bodyParser: { sizeLimit: "15mb" } }, // 15MB untuk terima Base64 file undangan/sambutan
};

const SUPA_URL    = process.env.SUPABASE_URL    || process.env.VITE_SUPABASE_URL;
const SUPA_KEY    = process.env.SUPABASE_KEY    || process.env.VITE_SUPABASE_ANON_KEY;
const SA_EMAIL    = process.env.GOOGLE_SA_EMAIL;
const SA_KEY_RAW  = process.env.GOOGLE_SA_PRIVATE_KEY;
const ROOT_FOLDER = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

// ── Supabase helpers ──────────────────────────────────────────
function sh(prefer) {
  const h = { "Content-Type":"application/json", "apikey":SUPA_KEY, "Authorization":"Bearer "+SUPA_KEY };
  if (prefer) h["Prefer"] = prefer;
  return h;
}
async function sbGet(path) {
  const r = await fetch(SUPA_URL+"/rest/v1/"+path, { headers: sh() });
  if (!r.ok) throw new Error("sbGet fail: "+await r.text());
  return r.json();
}
async function sbPost(table, body) {
  const r = await fetch(SUPA_URL+"/rest/v1/"+table, { method:"POST", headers:sh("return=representation"), body:JSON.stringify(body) });
  if (!r.ok) throw new Error("sbPost fail: "+await r.text());
  return r.json();
}
async function sbPatch(table, filter, body) {
  const r = await fetch(SUPA_URL+"/rest/v1/"+table+"?"+filter, { method:"PATCH", headers:sh("return=minimal"), body:JSON.stringify(body) });
  if (!r.ok) throw new Error("sbPatch fail: "+await r.text());
}

// ── JWT / Google OAuth ────────────────────────────────────────
function b64u(x) {
  const s = typeof x==="string" ? Buffer.from(x,"utf8").toString("base64") : Buffer.from(x).toString("base64");
  return s.replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}
async function signJWT(hdr, pay, pem) {
  const msg = b64u(JSON.stringify(hdr))+"."+b64u(JSON.stringify(pay));
  const raw = pem.replace(/-----BEGIN PRIVATE KEY-----/g,"").replace(/-----END PRIVATE KEY-----/g,"").replace(/\s+/g,"");
  const key = await crypto.subtle.importKey("pkcs8",Buffer.from(raw,"base64"),{ name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,Buffer.from(msg));
  return msg+"."+b64u(new Uint8Array(sig));
}
let _tok=null, _tokExp=0;
async function getToken() {
  const now=Math.floor(Date.now()/1000);
  if (_tok && now<_tokExp-60) return _tok;
  if (!SA_EMAIL||!SA_KEY_RAW) throw new Error("Env Google belum lengkap");
  const pem=SA_KEY_RAW.replace(/\\n/g,"\n");
  const jwt=await signJWT({alg:"RS256",typ:"JWT"},{iss:SA_EMAIL,scope:"https://www.googleapis.com/auth/drive",aud:"https://oauth2.googleapis.com/token",exp:now+3600,iat:now},pem);
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:jwt})});
  if (!r.ok) throw new Error("Token Google gagal: "+await r.text());
  const d=await r.json(); _tok=d.access_token; _tokExp=now+d.expires_in;
  return _tok;
}

// ── Folder helper ─────────────────────────────────────────────
async function getOrCreateFolder(token, folderPath) {
  if (!ROOT_FOLDER) throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID belum diset di environment variables Vercel");
  const cached=await sbGet("drive_folder_cache?folder_path=eq."+encodeURIComponent(folderPath)+"&limit=1").catch(()=>[]);
  if (cached&&cached.length>0) return cached[0].folder_id;
  let parentId=ROOT_FOLDER;
  for (const part of folderPath.split("/")) {
    const q=encodeURIComponent("name='"+part.replace(/'/g,"\\'")+"' and mimeType='application/vnd.google-apps.folder' and '"+parentId+"' in parents and trashed=false");
    const sr=await (await fetch("https://www.googleapis.com/drive/v3/files?q="+q+"&fields=files(id)",{headers:{"Authorization":"Bearer "+token}})).json();
    if (sr.files&&sr.files.length>0) { parentId=sr.files[0].id; }
    else {
      const cr=await (await fetch("https://www.googleapis.com/drive/v3/files",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({name:part,mimeType:"application/vnd.google-apps.folder",parents:[parentId]})})).json();
      parentId=cr.id;
    }
  }
  await sbPost("drive_folder_cache",{folder_path:folderPath,folder_id:parentId}).catch(e=>console.warn("[drive] folder cache skip:",e.message));
  return parentId;
}

// ── Upload Buffer ke Drive ────────────────────────────────────
async function uploadToDrive(token, folderId, fileName, mimeType, buffer) {
  const boundary="pkm_"+Date.now();
  const meta=JSON.stringify({name:fileName,parents:[folderId]});
  const body=Buffer.concat([
    Buffer.from("--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+meta+"\r\n--"+boundary+"\r\nContent-Type: "+mimeType+"\r\n\r\n"),
    buffer,
    Buffer.from("\r\n--"+boundary+"--"),
  ]);
  const r=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",{
    method:"POST",
    headers:{"Authorization":"Bearer "+token,"Content-Type":"multipart/related; boundary="+boundary,"Content-Length":body.length.toString()},
    body,
  });
  if (!r.ok) throw new Error("Drive upload gagal: "+await r.text());
  return (await r.json()).id;
}

async function setPublic(token, fileId) {
  await fetch("https://www.googleapis.com/drive/v3/files/"+fileId+"/permissions",{
    method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({role:"reader",type:"anyone"}),
  });
}

// ── Ambil file dari URL ───────────────────────────────────────
async function fetchBuf(url) {
  const headers={};
  if (SUPA_URL && url.startsWith(SUPA_URL)) {
    headers["apikey"]=SUPA_KEY;
    headers["Authorization"]="Bearer "+SUPA_KEY;
  }
  const r=await fetch(url,{headers});
  if (!r.ok) throw new Error("Gagal fetch file ("+r.status+"): "+url);
  return { buffer:Buffer.from(await r.arrayBuffer()), mimeType:r.headers.get("content-type")||"application/pdf" };
}

function datePath(dateStr, fileType) {
  const d=new Date((dateStr||new Date().toISOString().slice(0,10))+"T00:00:00Z");
  return d.getFullYear()+"/"+BULAN[d.getMonth()]+"/"+(fileType==="sambutan"?"Sambutan":"Undangan");
}

function buildFileName(ev, fileType) {
  const cleanName=(ev.namaAcara||"agenda").replace(/[^a-zA-Z0-9 \-]/g,"").substring(0,40).trim();
  return (ev.tanggal||"")+" - "+fileType.toUpperCase()+" - "+cleanName+".pdf";
}

// ── Proses satu file: Base64/URL dari DB → Upload ke Drive ────
async function syncOneFile(token, ev, fileType) {
  const fileUrl = fileType==="sambutan" ? ev.sambutanFile : ev.undanganFile;
  console.log("[drive] syncOneFile", fileType, "ev.id=", ev.id||ev.namaAcara, "fileUrl type=", typeof fileUrl, "starts=", typeof fileUrl==="string" ? fileUrl.substring(0,30) : "N/A");
  const isUrl   = typeof fileUrl==="string" && (fileUrl.startsWith("http://") || fileUrl.startsWith("https://"));
  const isB64   = typeof fileUrl==="string" && fileUrl.startsWith("data:");

  let buffer, mimeType;
  if (isUrl) {
    console.log("[drive] fetching URL...");
    ({ buffer, mimeType } = await fetchBuf(fileUrl));
  } else if (isB64) {
    console.log("[drive] decoding Base64, length=", fileUrl.length);
    const arr=fileUrl.split(",");
    mimeType=arr[0].match(/:(.*?);/)?.[1]||"application/pdf";
    buffer=Buffer.from(arr[1],"base64");
  } else {
    console.log("[drive] skip — bukan URL/Base64, value=", String(fileUrl).substring(0,50));
    return null; 
  }

  const folderPath = datePath(ev.tanggal, fileType);
  const folderId   = await getOrCreateFolder(token, folderPath);
  const fileName   = buildFileName(ev, fileType);
  const fileId     = await uploadToDrive(token, folderId, fileName, mimeType, buffer);
  await setPublic(token, fileId);
  const driveUrl   = "https://drive.google.com/file/d/"+fileId+"/view";

  await sbPost("drive_files",{
    agenda_id:String(ev.id||""), file_name:fileName, file_type:fileType,
    mime_type:mimeType, file_size_bytes:buffer.length,
    drive_file_id:fileId, drive_file_url:driveUrl,
    drive_folder_id:folderId, drive_folder_path:folderPath,
    uploaded_by:"Server Vercel",
  }).catch(()=>null);

  return driveUrl;
}

// ════════════════════════════════════════════════════════════
//  MAIN HANDLER VERCEL
// ════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const action=req.query.action;
  try {

    // ──────────────────────────────────────────────────────
    // 0. DIAGNOSIS TEST — buka /api/drive?action=test
    // ──────────────────────────────────────────────────────
    if (req.method==="GET" && action==="test") {
      const result = { steps:[] };
      const ok   = (s,d) => result.steps.push({step:s, status:"✅ OK",    detail:d});
      const fail = (s,d) => result.steps.push({step:s, status:"❌ GAGAL", detail:d});

      ok("1. GOOGLE_SA_EMAIL",          SA_EMAIL    ? SA_EMAIL.substring(0,30)+"..." : "KOSONG!");
      ok("1. GOOGLE_DRIVE_ROOT_FOLDER", ROOT_FOLDER || "KOSONG!");
      ok("1. SUPABASE_URL",             SUPA_URL    ? SUPA_URL.substring(0,40)+"..." : "KOSONG!");
      ok("1. GOOGLE_SA_PRIVATE_KEY",    SA_KEY_RAW  ? "Ada ("+SA_KEY_RAW.length+" chars)" : "KOSONG!");

      const pem = (SA_KEY_RAW||"").replace(/\\n/g,"\n");
      if (!pem.includes("BEGIN PRIVATE KEY")) {
        fail("2. Format Private Key", "Tidak ada BEGIN PRIVATE KEY — cek format di Vercel env");
      } else {
        ok("2. Format Private Key", "PEM terdeteksi");
      }

      let token = null;
      try {
        token = await getToken();
        ok("3. Google OAuth Token", "Berhasil: "+token.substring(0,20)+"...");
      } catch(e) {
        fail("3. Google OAuth Token", e.message);
      }

      if (token && ROOT_FOLDER) {
        try {
          const r = await fetch("https://www.googleapis.com/drive/v3/files/"+ROOT_FOLDER+"?fields=id,name", {headers:{"Authorization":"Bearer "+token}});
          const d = await r.json();
          d.id ? ok("4. Akses Root Folder", "Folder: '"+d.name+"'") : fail("4. Akses Root Folder", JSON.stringify(d));
        } catch(e) { fail("4. Akses Root Folder", e.message); }
      }

      if (SUPA_URL && SUPA_KEY) {
        try {
          const r = await fetch(SUPA_URL+"/rest/v1/jadwal?select=id,data&limit=1", {headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY}});
          const d = await r.json();
          if (Array.isArray(d) && d.length>0) {
            const ev = d[0].data || d[0];
            ok("5. Supabase jadwal", "id="+d[0].id+" namaAcara="+ev.namaAcara);
            ok("5a. undanganFile", ev.undanganFile ? String(ev.undanganFile).substring(0,60) : "null/kosong");
          } else {
            fail("5. Supabase jadwal", JSON.stringify(d).substring(0,100));
          }
        } catch(e) { fail("5. Supabase jadwal", e.message); }
      }

      if (token && ROOT_FOLDER) {
        try {
          const buf = Buffer.from("TEST Prokopim "+new Date().toISOString());
          const boundary = "pkm_test";
          const meta = JSON.stringify({name:"TEST-prokopim-"+Date.now()+".txt",parents:[ROOT_FOLDER]});
          const body = Buffer.concat([Buffer.from("--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+meta+"\r\n--"+boundary+"\r\nContent-Type: text/plain\r\n\r\n"),buf,Buffer.from("\r\n--"+boundary+"--")]);
          const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"multipart/related; boundary="+boundary},body});
          const d = await r.json();
          d.id ? ok("6. Test Upload ke Drive", "File ID: "+d.id+" — cek di Google Drive ada TEST-prokopim-*.txt") : fail("6. Test Upload ke Drive", JSON.stringify(d));
        } catch(e) { fail("6. Test Upload ke Drive", e.message); }
      }

      const gagal = result.steps.filter(s=>s.status.includes("GAGAL"));
      result.verdict = gagal.length===0 ? "✅ SEMUA OK" : "❌ ADA "+gagal.length+" MASALAH";
      return res.status(200).json(result);
    }

    // ──────────────────────────────────────────────────────
    // 0a. LIST FILES per agendaId (dari tabel drive_files)
    // ──────────────────────────────────────────────────────
    if (req.method==="GET" && action==="files") {
      const { agendaId } = req.query;
      if (!agendaId) return res.status(400).json({ error:"agendaId wajib ada" });
      const rows = await sbGet(
        "drive_files?agenda_id=eq."+encodeURIComponent(agendaId)+"&order=created_at.asc"
      ).catch(()=>[]);
      return res.status(200).json({ ok:true, files: rows||[] });
    }

    // ──────────────────────────────────────────────────────
    // 0b. DIRECT UPLOAD — Frontend kirim Base64, langsung ke Drive
    //     Tidak menyentuh Supabase Storage sama sekali
    // ──────────────────────────────────────────────────────
    if (req.method==="POST" && action==="upload") {
      const { base64, mimeType, fileName, agendaId, agendaDate, fileType, uploadedBy } = req.body;
      if (!base64 || !agendaId) return res.status(400).json({ error:"base64 & agendaId wajib ada" });

      const rawB64 = base64.includes(",") ? base64.split(",")[1] : base64;
      const buffer = Buffer.from(rawB64, "base64");
      const mime   = mimeType || "application/pdf";
      const fType  = (fileType||"undangan").toLowerCase();
      const fName  = fileName || (agendaDate+"-"+fType+".pdf");

      const token      = await getToken();
      const folderPath = datePath(agendaDate, fType);
      const folderId   = await getOrCreateFolder(token, folderPath);
      const fileId     = await uploadToDrive(token, folderId, fName, mime, buffer);
      await setPublic(token, fileId);
      const driveUrl   = "https://drive.google.com/file/d/"+fileId+"/view";

      await sbPost("drive_files", {
        agenda_id:         String(agendaId),
        file_name:         fName,
        file_type:         fType,
        mime_type:         mime,
        file_size_bytes:   buffer.length,
        drive_file_id:     fileId,
        drive_file_url:    driveUrl,
        drive_folder_id:   folderId,
        drive_folder_path: folderPath,
        uploaded_by:       uploadedBy || "Sistem",
      }).catch(()=>null);

      return res.status(200).json({ ok:true, driveUrl, fileId, folderPath });
    }

    // ──────────────────────────────────────────────────────
    // 1. INTI CLOUD-TO-CLOUD (Tarik dari DB -> Upload ke Drive)
    // ──────────────────────────────────────────────────────
    if (req.method==="POST" && action==="sync_one_from_db") {
      const { agendaId } = req.body;
      if (!agendaId) return res.status(400).json({ error:"agendaId wajib ada" });

      // Tarik langsung dari tabel 'jadwal'
      const rows=await sbGet("jadwal?id=eq."+encodeURIComponent(agendaId)+"&limit=1");
      if (!rows||rows.length===0) return res.status(404).json({ error:"Jadwal tidak ditemukan: "+agendaId });
      
      // Tabel jadwal menyimpan: { id, data: { ...eventObj } }
      // Jadi ev ada di rows[0].data, bukan rows[0]
      const rowRaw = rows[0];
      const ev = rowRaw.data || rowRaw; // fallback jika struktur flat
      console.log("[drive] ev parsed, id=", ev.id, "namaAcara=", ev.namaAcara, "hasUndangan=", !!ev.undanganFile, "hasSambutan=", !!ev.sambutanFile);
      console.log("[drive] undanganFile start=", ev.undanganFile ? String(ev.undanganFile).substring(0,40) : "null");
      const isDriveUrl=(s)=>typeof s==="string"&&s.includes("drive.google.com");
      const hasFile   =(s)=>typeof s==="string"&&s.length>50&&!isDriveUrl(s);

      const token=await getToken();
      const dataPatch={}; // patch yang akan masuk ke dalam field 'data' JSONB

      // Eksekusi pemindahan file
      if (hasFile(ev.undanganFile)) {
        const driveUrl=await syncOneFile(token,ev,"undangan");
        if (driveUrl) dataPatch.undanganFile=driveUrl;
      }
      if (hasFile(ev.sambutanFile)) {
        const driveUrl=await syncOneFile(token,ev,"sambutan");
        if (driveUrl) dataPatch.sambutanFile=driveUrl;
      }

      // Update field 'data' JSONB di Supabase dengan cara merge
      if (Object.keys(dataPatch).length>0) {
        const updatedData = { ...ev, ...dataPatch };
        await sbPatch("jadwal","id=eq."+encodeURIComponent(agendaId), { data: updatedData });
      }

      return res.status(200).json({
        ok:      true,
        patched: Object.keys(dataPatch),
        undangan: dataPatch.undanganFile||null,
        sambutan: dataPatch.sambutanFile||null,
        message:  Object.keys(dataPatch).length>0
          ? Object.keys(dataPatch).length+" file berhasil dipindahkan ke Drive"
          : "Selesai. Tidak ada file Base64 yang perlu dipindah.",
      });
    }

    // ──────────────────────────────────────────────────────
    // 2. GET CREDENTIALS (Cadangan untuk Direct Upload)
    // ──────────────────────────────────────────────────────
    else if (req.method==="POST" && action==="get_credentials") {
      const { targetYear,targetMonth,targetSub }=req.body;
      const token=await getToken();
      const folderPath=targetYear+"/"+targetMonth+"/"+targetSub;
      const folderId=await getOrCreateFolder(token,folderPath);
      return res.status(200).json({ ok:true, token, folderId, folderPath });
    }

    // ──────────────────────────────────────────────────────
    // 3. FINALIZE (Cadangan untuk Direct Upload)
    // ──────────────────────────────────────────────────────
    else if (req.method==="POST" && action==="finalize") {
      const { fileId,agendaId,fileName,mimeType,fileSizeBytes,folderId,folderPath,targetSub }=req.body;
      const token=await getToken();
      await setPublic(token,fileId);
      const fileUrl="https://drive.google.com/file/d/"+fileId+"/view";
      await sbPost("drive_files",{ agenda_id:agendaId||null,file_name:fileName,file_type:(targetSub||"undangan").toLowerCase(),mime_type:mimeType,file_size_bytes:fileSizeBytes,drive_file_id:fileId,drive_file_url:fileUrl,drive_folder_id:folderId,drive_folder_path:folderPath,uploaded_by:"Sistem Pengarsipan" }).catch(()=>null);
      return res.status(200).json({ ok:true, fileUrl });
    }

    // ──────────────────────────────────────────────────────
    // 4. DELETE (Hapus File dari Drive)
    // ──────────────────────────────────────────────────────
    else if (req.method==="POST" && action==="delete") {
      const { driveFileId,dbId }=req.body;
      const token=await getToken();
      await fetch("https://www.googleapis.com/drive/v3/files/"+driveFileId,{ method:"DELETE",headers:{"Authorization":"Bearer "+token} });
      if (dbId) await sbPatch("drive_files","id=eq."+dbId,{ drive_file_id:null }).catch(()=>null);
      return res.status(200).json({ ok:true });
    }

    else {
      return res.status(400).json({ error:"Action tidak dikenal" });
    }

  } catch(err) {
    console.error("[DRIVE API ERROR]",err.message);
    return res.status(500).json({ error:err.message });
  }
}
