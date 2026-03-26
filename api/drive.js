/**
 * api/drive.js — Prokopim Server-to-Server Sync
 */

const SUPA_URL   = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_KEY   = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SA_EMAIL   = process.env.GOOGLE_SA_EMAIL;
const SA_KEY_RAW = process.env.GOOGLE_SA_PRIVATE_KEY;
const ROOT_FOLDER= process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
const SH = () => ({ "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}`, "Prefer": "return=representation" });
// Wajib ditambahkan agar Vercel mengizinkan file besar masuk
export const config = {
  api: { bodyParser: { sizeLimit: '30mb' } }
};
async function sbGet(path) { const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: SH() }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function sbPost(table, body) { const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, { method: "POST", headers: SH(), body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function sbPatch(table, filter, body) { const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${filter}`, { method: "PATCH", headers: SH(), body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }

function base64url(input) { const str = typeof input === "string" ? Buffer.from(input, "utf8").toString("base64") : Buffer.from(input).toString("base64"); return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""); }
async function signJWT(header, payload, privateKeyPem) { const encodedHeader = base64url(JSON.stringify(header)); const encodedPayload = base64url(JSON.stringify(payload)); const signingInput = `${encodedHeader}.${encodedPayload}`; const pemBody = privateKeyPem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, ""); const keyData = Buffer.from(pemBody, "base64"); const cryptoKey = await crypto.subtle.importKey("pkcs8", keyData, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]); const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, Buffer.from(signingInput)); return `${signingInput}.${base64url(new Uint8Array(signature))}`; }

let _tokenCache = null; let _tokenExpiry = 0;
async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (_tokenCache && now < _tokenExpiry - 60) return _tokenCache;
  if (!SA_EMAIL || !SA_KEY_RAW) throw new Error("Kredensial Google belum lengkap di env");
  const privateKey = SA_KEY_RAW.replace(/\\n/g, "\n");
  const jwt = await signJWT({ alg: "RS256", typ: "JWT" }, { iss: SA_EMAIL, scope: "https://www.googleapis.com/auth/drive", aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now }, privateKey);
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  if (!tokenRes.ok) throw new Error(await tokenRes.text());
  const tokenData = await tokenRes.json(); _tokenCache = tokenData.access_token; _tokenExpiry = now + tokenData.expires_in; return _tokenCache;
}

async function getOrCreateFolder(token, folderPath) {
  const cached = await sbGet(`drive_folder_cache?folder_path=eq.${encodeURIComponent(folderPath)}&limit=1`).catch(()=>[]);
  if (cached && cached.length > 0) return cached[0].folder_id;
  const parts = folderPath.split("/"); let parentId = ROOT_FOLDER;
  for (const part of parts) {
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${part}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`)}&fields=files(id,name)`, { headers: { "Authorization": `Bearer ${token}` } });
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) { parentId = searchData.files[0].id; } 
    else {
      const createRes = await fetch("https://www.googleapis.com/drive/v3/files", { method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: part, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }) });
      const created = await createRes.json(); parentId = created.id;
    }
  }
  await sbPost("drive_folder_cache", { folder_path: folderPath, folder_id: parentId }).catch(()=>null);
  return parentId;
}

export default async function handler(req, res) {
  const action = req.query.action;
  try {
    if (req.method === "POST" && action === "upload_server_to_server") {
      const { fileSource, fileName, targetYear, targetMonth, targetSub, agendaId } = req.body;
      
      // 1. VERCEL MENDOWNLOAD FILE LANGSUNG DARI SUMBERNYA
      let fileBuffer;
      let mimeType = "application/pdf";

      if (fileSource.startsWith("http")) {
        const fetchRes = await fetch(fileSource);
        if (!fetchRes.ok) throw new Error("Gagal mengambil file dari database sumber");
        const arrBuffer = await fetchRes.arrayBuffer();
        fileBuffer = Buffer.from(arrBuffer);
        mimeType = fetchRes.headers.get("content-type") || "application/pdf";
      } else if (fileSource.startsWith("data:")) {
        const parts = fileSource.split(",");
        mimeType = parts[0].match(/:(.*?);/)[1];
        fileBuffer = Buffer.from(parts[1], "base64");
      } else {
        fileBuffer = Buffer.from(fileSource, "base64");
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: "Isi file terdeteksi kosong" });
      }

      // 2. SIAPKAN FOLDER GOOGLE DRIVE
      const token = await getGoogleAccessToken();
      const folderPath = `${targetYear}/${targetMonth}/${targetSub}`;
      const folderId = await getOrCreateFolder(token, folderPath);

      // 3. VERCEL MENGIRIM FILE UTUH KE GOOGLE DRIVE (Tanpa masalah CORS)
      const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
      const boundary = "prokopim_batas_file_" + Date.now();
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
        fileBuffer,
        Buffer.from(`\r\n--${boundary}--`)
      ]);

      const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
        method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": `multipart/related; boundary="${boundary}"`, "Content-Length": body.length.toString() }, body
      });
      
      if (!uploadRes.ok) throw new Error(`Google Drive menolak file: ${await uploadRes.text()}`);
      const uploaded = await uploadRes.json();

      // Buka akses file agar bisa dibaca dari aplikasi
      await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions`, { method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ role: "reader", type: "anyone" }) });

      const fileUrl = uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
      
      // Catat di database
      await sbPost("drive_files", { agenda_id: agendaId || null, file_name: fileName, file_type: targetSub.toLowerCase(), mime_type: mimeType, file_size_bytes: fileBuffer.length, drive_file_id: uploaded.id, drive_file_url: fileUrl, drive_folder_id: folderId, drive_folder_path: folderPath, uploaded_by: "Server Vercel" }).catch(() => null);

      return res.status(200).json({ ok: true, fileUrl });
    }
    
    else if (req.method === "POST" && action === "delete") {
      const { driveFileId, dbId } = req.body; const token = await getGoogleAccessToken();
      await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
      if (dbId) await sbPatch("drive_files", `id=eq.${dbId}`, { drive_file_id: null });
      return res.status(200).json({ ok: true, message: "File dihapus" });
    } else { return res.status(400).json({ error: "Action tidak dikenal" }); }
  } catch (err) { console.error("[DRIVE API ERROR]", err.message); return res.status(500).json({ error: err.message }); }
}
