/**
 * api/drive.js — Prokopim v1.5
 * Arsitektur Cloud-to-Cloud — Tidak ada payload besar lewat Vercel
 *
 * Actions:
 *   POST ?action=sync_one_from_db   ← UTAMA: fetch jadwal Supabase → upload Drive
 *   POST ?action=get_credentials    ← beri token + folderId ke frontend
 *   POST ?action=finalize           ← set permission + catat DB
 *   POST ?action=delete             ← hapus file dari Drive + DB
 *
 * Flow Cloud-to-Cloud (tidak ada payload besar melewati Vercel):
 *   Browser → Supabase Storage  (langsung, tidak lewat Vercel)
 *   Vercel  → Supabase (fetch URL kecil) → Download file → Google Drive
 */

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
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
  await sbPost("drive_folder_cache",{folder_path:folderPath,folder_id:parentId}).catch(()=>null);
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

// ── Ambil file dari URL → Buffer ──────────────────────────────
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
  return d.getUTCFullYear()+"/"+BULAN[d.getUTCMonth()]+"/"+(fileType==="sambutan"?"Sambutan":"Undangan");
}

function buildFileName(ev, fileType) {
  const cleanName=(ev.namaAcara||"agenda").replace(/[^a-zA-Z0-9 \-]/g,"").substring(0,40).trim();
  return (ev.tanggal||"")+" - "+fileType.toUpperCase()+" - "+cleanName+".pdf";
}

// ── Proses satu file: URL/base64 → Drive URL ─────────────────
async function syncOneFile(token, ev, fileType) {
  const fileUrl = fileType==="sambutan" ? ev.sambutanFile : ev.undanganFile;
  const isUrl   = typeof fileUrl==="string" && (fileUrl.startsWith("http://") || fileUrl.startsWith("https://"));
  const isB64   = typeof fileUrl==="string" && fileUrl.startsWith("data:");

  let buffer, mimeType;
  if (isUrl) {
    ({ buffer, mimeType } = await fetchBuf(fileUrl));
  } else if (isB64) {
    const arr=fileUrl.split(",");
    mimeType=arr[0].match(/:(.*?);/)?.[1]||"application/pdf";
    buffer=Buffer.from(arr[1],"base64");
  } else {
    return null; // tidak ada file atau sudah Drive URL
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
    uploaded_by:"Sistem Pengarsipan",
  }).catch(()=>null);

  return driveUrl;
}

// ════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  const action=req.query.action;
  try {

    // ──────────────────────────────────────────────────────
    // sync_one_from_db — INTI CLOUD-TO-CLOUD
    // Payload: { agendaId: string }  (hanya ID, tidak ada file)
    // ──────────────────────────────────────────────────────
    if (req.method==="POST" && action==="sync_one_from_db") {
      const { agendaId } = req.body;
      if (!agendaId) return res.status(400).json({ error:"agendaId wajib ada" });

      // 1. Fetch data jadwal dari Supabase (server → Supabase)
      const rows=await sbGet("jadwal?id=eq."+encodeURIComponent(agendaId)+"&select=data&limit=1");
      if (!rows||rows.length===0) return res.status(404).json({ error:"Agenda tidak ditemukan: "+agendaId });
      const ev=rows[0].data;

      const isDriveUrl=(s)=>typeof s==="string"&&s.includes("drive.google.com");
      const hasFile   =(s)=>typeof s==="string"&&s.length>10&&!isDriveUrl(s);

      const token=await getToken();
      const patch={};

      // 2. Proses undanganFile jika ada dan bukan sudah Drive URL
      if (hasFile(ev.undanganFile)) {
        const driveUrl=await syncOneFile(token,ev,"undangan");
        if (driveUrl) patch.undanganFile=driveUrl;
      }

      // 3. Proses sambutanFile jika ada dan bukan sudah Drive URL
      if (hasFile(ev.sambutanFile)) {
        const driveUrl=await syncOneFile(token,ev,"sambutan");
        if (driveUrl) patch.sambutanFile=driveUrl;
      }

      // 4. Patch tabel jadwal di Supabase dengan URL Drive yang baru
      if (Object.keys(patch).length>0) {
        const updatedData={ ...ev, ...patch };
        await sbPatch("jadwal","id=eq."+encodeURIComponent(agendaId),{ data:updatedData });
      }

      return res.status(200).json({
        ok:      Object.keys(patch).length>0,
        patched: Object.keys(patch),
        undangan: patch.undanganFile||null,
        sambutan: patch.sambutanFile||null,
        message:  Object.keys(patch).length>0
          ? Object.keys(patch).length+" file berhasil dipindahkan ke Drive"
          : "Tidak ada file yang perlu dipindahkan",
      });
    }

    // ──────────────────────────────────────────────────────
    // get_credentials — beri token + folderId ke frontend
    // ──────────────────────────────────────────────────────
    else if (req.method==="POST" && action==="get_credentials") {
      const { targetYear,targetMonth,targetSub }=req.body;
      const token=await getToken();
      const folderPath=targetYear+"/"+targetMonth+"/"+targetSub;
      const folderId=await getOrCreateFolder(token,folderPath);
      return res.status(200).json({ ok:true, token, folderId, folderPath });
    }

    // ──────────────────────────────────────────────────────
    // finalize — set permission + catat DB
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
    // delete — hapus file dari Drive + DB
    // ──────────────────────────────────────────────────────
    else if (req.method==="POST" && action==="delete") {
      const { driveFileId,dbId }=req.body;
      const token=await getToken();
      await fetch("https://www.googleapis.com/drive/v3/files/"+driveFileId,{ method:"DELETE",headers:{"Authorization":"Bearer "+token} });
      if (dbId) await sbPatch("drive_files","id=eq."+dbId,{ drive_file_id:null });
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
