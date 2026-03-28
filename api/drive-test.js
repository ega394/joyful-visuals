/**
 * api/drive-test.js — Diagnosis koneksi Google Drive
 * Buka di browser: prokopim.tarakankota.go.id/api/drive-test
 * HAPUS FILE INI setelah selesai diagnosis!
 */

const SA_EMAIL    = process.env.GOOGLE_SA_EMAIL;
const SA_KEY_RAW  = process.env.GOOGLE_SA_PRIVATE_KEY;
const ROOT_FOLDER = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
const SUPA_URL    = process.env.SUPABASE_URL    || process.env.VITE_SUPABASE_URL;
const SUPA_KEY    = process.env.SUPABASE_KEY    || process.env.VITE_SUPABASE_ANON_KEY;

function b64u(x) {
  const s = typeof x==="string" ? Buffer.from(x,"utf8").toString("base64") : Buffer.from(x).toString("base64");
  return s.replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}

async function signJWT(hdr, pay, pem) {
  const msg = b64u(JSON.stringify(hdr))+"."+b64u(JSON.stringify(pay));
  const raw = pem.replace(/-----BEGIN PRIVATE KEY-----/g,"").replace(/-----END PRIVATE KEY-----/g,"").replace(/\s+/g,"");
  const key = await crypto.subtle.importKey("pkcs8",Buffer.from(raw,"base64"),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,Buffer.from(msg));
  return msg+"."+b64u(new Uint8Array(sig));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const result = { steps: [] };

  const ok  = (step, detail) => result.steps.push({ step, status:"✅ OK",    detail });
  const fail = (step, detail) => result.steps.push({ step, status:"❌ GAGAL", detail });

  // 1. Cek env variables
  ok("1. Env GOOGLE_SA_EMAIL",           SA_EMAIL    ? SA_EMAIL.substring(0,30)+"..." : "KOSONG!");
  ok("1. Env GOOGLE_DRIVE_ROOT_FOLDER",  ROOT_FOLDER || "KOSONG!");
  ok("1. Env SUPABASE_URL",              SUPA_URL    ? SUPA_URL.substring(0,40)+"..." : "KOSONG!");
  ok("1. Env GOOGLE_SA_PRIVATE_KEY",     SA_KEY_RAW  ? "Ada ("+SA_KEY_RAW.length+" chars)" : "KOSONG!");

  if (!SA_EMAIL || !SA_KEY_RAW || !ROOT_FOLDER) {
    result.verdict = "❌ ENV TIDAK LENGKAP";
    return res.status(200).json(result);
  }

  // 2. Cek format private key
  const pem = SA_KEY_RAW.replace(/\\n/g, "\n");
  if (!pem.includes("BEGIN PRIVATE KEY")) {
    fail("2. Format Private Key", "Tidak ada '-----BEGIN PRIVATE KEY-----'. Mungkin perlu escape \\n di Vercel.");
  } else {
    ok("2. Format Private Key", "Format PEM terdeteksi");
  }

  // 3. Ambil Google Token
  let token = null;
  try {
    const now = Math.floor(Date.now()/1000);
    const jwt = await signJWT(
      {alg:"RS256",typ:"JWT"},
      {iss:SA_EMAIL, scope:"https://www.googleapis.com/auth/drive", aud:"https://oauth2.googleapis.com/token", exp:now+3600, iat:now},
      pem
    );
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body: new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer", assertion:jwt})
    });
    const d = await r.json();
    if (d.access_token) {
      token = d.access_token;
      ok("3. Google OAuth Token", "Berhasil! Token: "+token.substring(0,20)+"...");
    } else {
      fail("3. Google OAuth Token", JSON.stringify(d));
    }
  } catch(e) {
    fail("3. Google OAuth Token", e.message);
  }

  // 4. Cek akses ke root folder Drive
  if (token) {
    try {
      const r = await fetch(
        "https://www.googleapis.com/drive/v3/files/"+ROOT_FOLDER+"?fields=id,name,mimeType",
        { headers:{"Authorization":"Bearer "+token} }
      );
      const d = await r.json();
      if (d.id) {
        ok("4. Akses Root Folder Drive", "Folder: '"+d.name+"' ("+d.mimeType+")");
      } else {
        fail("4. Akses Root Folder Drive", JSON.stringify(d));
      }
    } catch(e) {
      fail("4. Akses Root Folder Drive", e.message);
    }
  }

  // 5. Cek koneksi Supabase — ambil 1 row dari jadwal
  if (SUPA_URL && SUPA_KEY) {
    try {
      const r = await fetch(SUPA_URL+"/rest/v1/jadwal?select=id,data&limit=1", {
        headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY}
      });
      const d = await r.json();
      if (Array.isArray(d) && d.length > 0) {
        const row = d[0];
        const ev  = row.data || row;
        ok("5. Supabase — jadwal", "id="+row.id+" | namaAcara="+ev.namaAcara);
        ok("5a. Struktur data",    "undanganFile ada: "+(!!ev.undanganFile)+" | starts: "+(ev.undanganFile ? String(ev.undanganFile).substring(0,40) : "null"));
      } else {
        fail("5. Supabase — jadwal", "Tidak ada data. Response: "+JSON.stringify(d).substring(0,100));
      }
    } catch(e) {
      fail("5. Supabase — jadwal", e.message);
    }
  }

  // 6. Test upload file kecil ke Drive
  if (token && ROOT_FOLDER) {
    try {
      const testContent = Buffer.from("TEST FILE dari Prokopim Hibot - "+new Date().toISOString());
      const boundary = "test_boundary_123";
      const meta = JSON.stringify({name:"TEST-prokopim-"+Date.now()+".txt", parents:[ROOT_FOLDER]});
      const body = Buffer.concat([
        Buffer.from("--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+meta+"\r\n--"+boundary+"\r\nContent-Type: text/plain\r\n\r\n"),
        testContent,
        Buffer.from("\r\n--"+boundary+"--")
      ]);
      const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name", {
        method:"POST",
        headers:{"Authorization":"Bearer "+token,"Content-Type":"multipart/related; boundary="+boundary,"Content-Length":body.length.toString()},
        body
      });
      const d = await r.json();
      if (d.id) {
        ok("6. Test Upload ke Drive", "Berhasil! File ID: "+d.id+" | Cek di Google Drive apakah ada file TEST-prokopim-*.txt");
      } else {
        fail("6. Test Upload ke Drive", JSON.stringify(d));
      }
    } catch(e) {
      fail("6. Test Upload ke Drive", e.message);
    }
  }

  // Verdict
  const gagal = result.steps.filter(s=>s.status.includes("GAGAL"));
  result.verdict = gagal.length === 0
    ? "✅ SEMUA OK — Drive harusnya bisa menerima file"
    : "❌ ADA "+gagal.length+" MASALAH — lihat detail di atas";

  return res.status(200).json(result);
}
