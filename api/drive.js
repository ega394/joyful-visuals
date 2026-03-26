/**
 * api/drive.js — Prokopim v1.5: Google Drive Smart Storage (REVISI PARSER & FOLDER)
 */

const SUPA_URL   = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_KEY   = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SA_EMAIL   = process.env.GOOGLE_SA_EMAIL;
const SA_KEY_RAW = process.env.GOOGLE_SA_PRIVATE_KEY;
const ROOT_FOLDER= process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

// ── Helper Supabase ──────────────────────────────────────────
const SH = () => ({
  "Content-Type":  "application/json",
  "apikey":        SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
  "Prefer":        "return=representation",
});

async function sbGet(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: SH() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbPost(table, body) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: "POST", headers: SH(), body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbPatch(table, filter, body) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH", headers: SH(), body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── GOOGLE OAUTH VIA SERVICE ACCOUNT ─────────────────────────
function base64url(input) {
  const str = typeof input === "string"
    ? Buffer.from(input, "utf8").toString("base64")
    : Buffer.from(input).toString("base64");
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function signJWT(header, payload, privateKeyPem) {
  const encodedHeader  = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput   = `${encodedHeader}.${encodedPayload}`;

  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const keyData = Buffer.from(pemBody, "base64");

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey,
    Buffer.from(signingInput)
  );

  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

let _tokenCache = null;
let _tokenExpiry = 0;

async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (_tokenCache && now < _tokenExpiry - 60) return _tokenCache;

  if (!SA_EMAIL || !SA_KEY_RAW) {
    throw new Error("Kredensial Google belum lengkap di Environment Variables");
  }

  const privateKey = SA_KEY_RAW.replace(/\\n/g, "\n");
  const iat = now;
  const exp = now + 3600;

  const jwt = await signJWT(
    { alg: "RS256", typ: "JWT" },
    {
      iss:   SA_EMAIL,
      scope: "https://www.googleapis.com/auth/drive",
      aud:   "https://oauth2.googleapis.com/token",
      exp, iat,
    },
    privateKey
  );

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
  });

  if (!tokenRes.ok) throw new Error(await tokenRes.text());
  
  const tokenData = await tokenRes.json();
  _tokenCache  = tokenData.access_token;
  _tokenExpiry = now + tokenData.expires_in;
  return _tokenCache;
}

// ── FOLDER MANAGEMENT ─────────────────────────────────────────

// Membuat path spesifik yang dikirim dari Frontend (Tahun/Bulan/Kategori)
function buildFolderPath(year, month, sub) {
  // Jika Frontend mengirim instruksi folder, pakai itu. Jika tidak, pakai fallback.
  if (year && month && sub) return `${year}/${month}/${sub}`;
  return "Arsip_Umum"; 
}

async function getOrCreateFolder(token, folderPath) {
  const cached = await sbGet(`drive_folder_cache?folder_path=eq.${encodeURIComponent(folderPath)}&limit=1`);
  if (cached && cached.length > 0) return cached[0].folder_id;

  const parts = folderPath.split("/");
  let parentId = ROOT_FOLDER;

  for (const part of parts) {
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${part}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`)}&fields=files(id,name)`,
      { headers: { "Authorization": `Bearer ${token}` } }
    );
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
      parentId = searchData.files[0].id;
    } else {
      const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: part, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
      });
      const created = await createRes.json();
      parentId = created.id;
    }
  }

  // Simpan ID folder yang baru ke cache Supabase
  await sbPost("drive_folder_cache", { folder_path: folderPath, folder_id: parentId }).catch(()=>null);
  return parentId;
}

// ── UPLOAD FILE KE GOOGLE DRIVE ───────────────────────────────
async function uploadFileToDrive(fileBuffer, fileName, mimeType, yearFolder, monthFolder, subFolder) {
  const token = await getGoogleAccessToken();
  const folderPath = buildFolderPath(yearFolder, monthFolder, subFolder);
  const folderId   = await getOrCreateFolder(token, folderPath);

  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const boundary = "-------prokopim_boundary_" + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = Buffer.concat([
    Buffer.from(delimiter + "Content-Type: application/json\r\n\r\n" + metadata + delimiter + `Content-Type: ${mimeType}\r\n\r\n`),
    fileBuffer,
    Buffer.from(closeDelimiter),
  ]);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink",
    {
      method: "POST",
      headers: {
        "Authorization":  `Bearer ${token}`,
        "Content-Type":   `multipart/related; boundary="${boundary}"`,
        "Content-Length": body.length.toString(),
      },
      body,
    }
  );

  if (!uploadRes.ok) throw new Error(await uploadRes.text());

  const uploaded = await uploadRes.json();

  // Beri akses baca publik (anyone with link)
  await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });

  return {
    fileId:     uploaded.id,
    fileUrl:    uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
    folderId,
    folderPath,
    folderUrl:  `https://drive.google.com/drive/folders/${folderId}`,
  };
}

// ── ROBUST MULTIPART PARSER ───────────────────────────────────
// Ini perbaikan utama agar Buffer file tertangkap sempurna tanpa bocor.
async function parseMultipartBodyRobust(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks);
        const contentType = req.headers["content-type"] || "";
        const boundaryMatch = contentType.match(/boundary=(.+)$/);
        if (!boundaryMatch) return reject(new Error("Request bukan tipe multipart"));

        const boundaryStr = "--" + boundaryMatch[1];
        const boundaryBuf = Buffer.from(boundaryStr);
        const parts = [];
        let start = body.indexOf(boundaryBuf);

        while (start !== -1) {
          const nextBoundary = body.indexOf(boundaryBuf, start + boundaryBuf.length);
          if (nextBoundary === -1) break;

          const partBuf = body.slice(start + boundaryBuf.length + 2, nextBoundary - 2);
          const headerEndIdx = partBuf.indexOf(Buffer.from("\r\n\r\n"));

          if (headerEndIdx !== -1) {
            const headerStr  = partBuf.slice(0, headerEndIdx).toString();
            const fileBuffer = partBuf.slice(headerEndIdx + 4);

            const nameMatch     = headerStr.match(/name="([^"]+)"/);
            const filenameMatch = headerStr.match(/filename="([^"]+)"/);
            const ctMatch       = headerStr.match(/Content-Type:\s*([^\s;]+)/i);

            parts.push({
              fieldName: nameMatch ? nameMatch[1] : null,
              fileName:  filenameMatch ? filenameMatch[1] : null,
              mimeType:  ctMatch ? ctMatch[1] : null,
              buffer:    fileBuffer,
              text:      filenameMatch ? null : fileBuffer.toString().trim(),
            });
          }
          start = nextBoundary;
        }
        resolve(parts);
      } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

// Konfigurasi agar Next.js / Vercel tidak merusak Buffer file
export const config = {
  api: { bodyParser: false } 
};

// ── MAIN HANDLER ─────────────────────────────────────────────
export default async function handler(req, res) {
  const action = req.query.action;

  try {
    if (req.method === "POST" && action === "upload") {
      
      const parts = await parseMultipartBodyRobust(req);
      
      const filePart = parts.find(p => p.fileName);
      if (!filePart || filePart.buffer.length === 0) {
         return res.status(400).json({ error: "File kosong atau gagal di-parse oleh sistem" });
      }

      // Ambil data instruksi folder dari Frontend
      const agendaId   = parts.find(p => p.fieldName === "agendaId")?.text || "";
      const targetYear = parts.find(p => p.fieldName === "targetYear")?.text || new Date().getFullYear().toString();
      const targetMonth= parts.find(p => p.fieldName === "targetMonth")?.text || "Arsip";
      const targetSub  = parts.find(p => p.fieldName === "targetSub")?.text || "Umum";
      const uploadedBy = parts.find(p => p.fieldName === "uploadedBy")?.text || "Sistem";
      
      const fileName   = filePart.fileName;
      const mimeType   = filePart.mimeType || "application/octet-stream";

      // Eksekusi Upload ke Drive menggunakan parameter folder baru
      const { fileId, fileUrl, folderId, folderPath, folderUrl } =
        await uploadFileToDrive(filePart.buffer, fileName, mimeType, targetYear, targetMonth, targetSub);

      // Catat ke log Supabase
      const record = await sbPost("drive_files", {
        agenda_id: agendaId || null, 
        file_name: fileName,
        file_type: targetSub.toLowerCase(), 
        mime_type: mimeType,
        file_size_bytes: filePart.buffer.length,
        drive_file_id: fileId, 
        drive_file_url: fileUrl,
        drive_folder_id: folderId, 
        drive_folder_path: folderPath,
        uploaded_by: uploadedBy,
      }).catch(() => null);

      return res.status(200).json({
        ok: true, fileId, fileUrl, folderPath, folderUrl,
        dbId: record && record[0] ? record[0].id : null,
        message: `File sukses diupload ke Drive ✓`,
      });

    } else if (req.method === "POST" && action === "delete") {
      // (Logika delete file tetap sama)
      const { driveFileId, dbId } = parts?.[0]?.text ? JSON.parse(parts[0].text) : req.body;
      const token = await getGoogleAccessToken();
      await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
      if (dbId) await sbPatch("drive_files", `id=eq.${dbId}`, { drive_file_id: null });
      return res.status(200).json({ ok: true, message: "File dihapus dari Drive ✓" });

    } else {
      return res.status(400).json({ error: "Action tidak dikenal" });
    }
  } catch (err) {
    console.error("[DRIVE API ERROR]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
