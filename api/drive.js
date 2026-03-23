/**
 * api/drive.js — Prokopim v1.5: Google Drive Smart Storage
 *
 * ENDPOINT:
 *   POST /api/drive?action=upload   → Upload file ke Drive (otomatis buat folder)
 *   POST /api/drive?action=delete   → Hapus file dari Drive
 *   GET  /api/drive?action=files    → Ambil daftar file terkait agenda
 *
 * CARA SETUP SERVICE ACCOUNT:
 *   1. Buka: console.cloud.google.com
 *   2. APIs & Services → Enable "Google Drive API"
 *   3. IAM & Admin → Service Accounts → Create Service Account
 *   4. Keys → Add Key → JSON → Download file JSON
 *   5. Dari file JSON tersebut, ambil:
 *      - client_email  → GOOGLE_SA_EMAIL
 *      - private_key   → GOOGLE_SA_PRIVATE_KEY (salin seluruh isi termasuk -----BEGIN...----- )
 *   6. Buat folder utama di Drive, share folder tsb ke client_email dengan akses Editor
 *   7. Salin ID folder (dari URL Drive) → GOOGLE_DRIVE_ROOT_FOLDER_ID
 *
 * ENV VARS DIBUTUHKAN:
 *   GOOGLE_SA_EMAIL             → service-account@project.iam.gserviceaccount.com
 *   GOOGLE_SA_PRIVATE_KEY       → -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
 *   GOOGLE_DRIVE_ROOT_FOLDER_ID → ID folder "Prokopim_Files" di Google Drive
 *   SUPABASE_URL                → Supabase project URL
 *   SUPABASE_KEY                → Supabase service key
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

// ── GOOGLE OAUTH VIA SERVICE ACCOUNT (tanpa library) ─────────
/**
 * Google Service Account menggunakan JWT untuk mendapatkan
 * access token. Implementasi manual tanpa google-auth-library
 * agar tidak perlu install npm package baru.
 */

// Base64url encode
function base64url(input) {
  const str = typeof input === "string"
    ? Buffer.from(input, "utf8").toString("base64")
    : Buffer.from(input).toString("base64");
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Sign JWT dengan private key RSA (menggunakan Web Crypto API)
async function signJWT(header, payload, privateKeyPem) {
  const encodedHeader  = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput   = `${encodedHeader}.${encodedPayload}`;

  // Import private key
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

// Token cache (in-memory, reset tiap cold start)
let _tokenCache = null;
let _tokenExpiry = 0;

async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (_tokenCache && now < _tokenExpiry - 60) return _tokenCache;

  if (!SA_EMAIL || !SA_KEY_RAW) {
    throw new Error("GOOGLE_SA_EMAIL dan GOOGLE_SA_PRIVATE_KEY belum diset di env");
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

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google OAuth error: ${err}`);
  }

  const tokenData = await tokenRes.json();
  _tokenCache  = tokenData.access_token;
  _tokenExpiry = now + tokenData.expires_in;
  return _tokenCache;
}

// ── FOLDER MANAGEMENT ─────────────────────────────────────────

const BULAN_INDO = ["","01-Jan","02-Feb","03-Mar","04-Apr","05-Mei",
  "06-Jun","07-Jul","08-Agu","09-Sep","10-Okt","11-Nov","12-Des"];

/**
 * getFolderPath
 * Tentukan path folder berdasarkan tanggal kegiatan (WITA)
 * Output contoh: "2026/03-Mar"
 */
function getFolderPath(dateStr) {
  // dateStr = "YYYY-MM-DD" (WITA, sudah lokal)
  const [year, month] = dateStr.split("-");
  return `${year}/${BULAN_INDO[parseInt(month)] || month}`;
}

/**
 * getOrCreateFolder
 * Cari folder di cache dulu, jika tidak ada buat di Drive
 * Membuat folder secara rekursif: Prokopim_Files → 2026 → 03-Mar
 */
async function getOrCreateFolder(token, folderPath) {
  // Cek cache Supabase
  const cached = await sbGet(
    `drive_folder_cache?folder_path=eq.${encodeURIComponent(folderPath)}&limit=1`
  );
  if (cached.length > 0) {
    console.log(`[Drive] Folder dari cache: ${folderPath} → ${cached[0].folder_id}`);
    return cached[0].folder_id;
  }

  // Buat folder secara rekursif
  const parts = folderPath.split("/");
  let parentId = ROOT_FOLDER;

  for (const part of parts) {
    // Cari subfolder di parent
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?` +
      `q=${encodeURIComponent(`name='${part}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`)}` +
      `&fields=files(id,name)`,
      { headers: { "Authorization": `Bearer ${token}` } }
    );
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
      // Folder sudah ada
      parentId = searchData.files[0].id;
    } else {
      // Buat folder baru
      const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name:     part,
          mimeType: "application/vnd.google-apps.folder",
          parents:  [parentId],
        }),
      });
      const created = await createRes.json();
      parentId = created.id;
      console.log(`[Drive] Folder dibuat: ${part} → ${parentId}`);
    }
  }

  // Simpan ke cache Supabase
  await sbPost("drive_folder_cache", { folder_path: folderPath, folder_id: parentId });

  return parentId;
}

// ── UPLOAD FILE ───────────────────────────────────────────────
/**
 * uploadFileToDrive
 *
 * Upload file ke Google Drive folder yang sesuai tahun/bulan.
 * Menggunakan multipart upload untuk metadata + content sekaligus.
 *
 * @param {Buffer} fileBuffer   - Isi file dalam Buffer
 * @param {string} fileName     - Nama file
 * @param {string} mimeType     - MIME type (application/pdf, image/jpeg, dst)
 * @param {string} agendaDate   - "YYYY-MM-DD" tanggal kegiatan WITA
 * @returns { fileId, fileUrl, folderId, folderPath }
 */
async function uploadFileToDrive(fileBuffer, fileName, mimeType, agendaDate) {
  const token = await getGoogleAccessToken();
  const folderPath = getFolderPath(agendaDate);
  const folderId   = await getOrCreateFolder(token, folderPath);

  // Multipart upload: metadata + file content
  const metadata = JSON.stringify({
    name:    fileName,
    parents: [folderId],
  });

  const boundary = "-------prokopim_boundary_" + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = Buffer.concat([
    Buffer.from(
      delimiter +
      "Content-Type: application/json\r\n\r\n" +
      metadata +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n`
    ),
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

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Drive upload gagal: ${err}`);
  }

  const uploaded = await uploadRes.json();

  // Set permission: anyone with link can view
  await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
    },
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

// ── DELETE FILE ───────────────────────────────────────────────
async function deleteFileFromDrive(driveFileId) {
  const token = await getGoogleAccessToken();
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${driveFileId}`,
    { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } }
  );
  if (!r.ok && r.status !== 404) {
    throw new Error(`Drive delete gagal: ${r.status}`);
  }
}

// ── PARSE MULTIPART FORM DATA (tanpa library) ─────────────────
/**
 * Untuk menerima file upload dari frontend.
 * Vercel menyediakan body sebagai Buffer jika Content-Type multipart.
 * Di sini kita parse manual untuk menghindari dependency tambahan.
 */
async function parseMultipartBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks);
        const contentType = req.headers["content-type"] || "";
        const boundaryMatch = contentType.match(/boundary=(.+)$/);
        if (!boundaryMatch) return reject(new Error("Bukan multipart"));

        const boundary = Buffer.from("--" + boundaryMatch[1]);
        const parts = [];
        let start = 0;

        while (start < body.length) {
          const bIdx = body.indexOf(boundary, start);
          if (bIdx === -1) break;
          const end = body.indexOf(boundary, bIdx + boundary.length);
          if (end === -1) break;

          const part = body.slice(bIdx + boundary.length + 2, end - 2);
          const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
          if (headerEnd === -1) { start = end; continue; }

          const headerStr  = part.slice(0, headerEnd).toString();
          const fileBuffer = part.slice(headerEnd + 4);

          const nameMatch     = headerStr.match(/name="([^"]+)"/);
          const filenameMatch = headerStr.match(/filename="([^"]+)"/);
          const ctMatch       = headerStr.match(/Content-Type:\s*(.+)/i);

          parts.push({
            fieldName: nameMatch?.[1],
            fileName:  filenameMatch?.[1],
            mimeType:  ctMatch?.[1]?.trim(),
            buffer:    fileBuffer,
            text:      filenameMatch ? null : fileBuffer.toString(),
          });
          start = end;
        }

        resolve(parts);
      } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

// ── MAIN HANDLER ─────────────────────────────────────────────
export default async function handler(req, res) {
  const action = req.query.action;

  try {
    if (req.method === "POST" && action === "upload") {
      // Parse multipart form data
      let parts;
      try {
        parts = await parseMultipartBody(req);
      } catch {
        return res.status(400).json({ error: "Gagal parse form data" });
      }

      const filePart    = parts.find(p => p.fileName);
      const agendaIdP   = parts.find(p => p.fieldName === "agendaId");
      const agendaDateP = parts.find(p => p.fieldName === "agendaDate");
      const fileTypeP   = parts.find(p => p.fieldName === "fileType");
      const uploadedByP = parts.find(p => p.fieldName === "uploadedBy");

      if (!filePart) return res.status(400).json({ error: "File tidak ditemukan di request" });

      const agendaId   = agendaIdP?.text   || "";
      const agendaDate = agendaDateP?.text  || new Date().toISOString().slice(0,10);
      const fileType   = fileTypeP?.text    || "other";
      const uploadedBy = uploadedByP?.text  || "";
      const fileName   = filePart.fileName;
      const mimeType   = filePart.mimeType  || "application/octet-stream";

      // Upload ke Drive
      const { fileId, fileUrl, folderId, folderPath, folderUrl } =
        await uploadFileToDrive(filePart.buffer, fileName, mimeType, agendaDate);

      // Simpan ke tabel drive_files
      const record = await sbPost("drive_files", {
        agenda_id: agendaId || null, file_name: fileName,
        file_type: fileType, mime_type: mimeType,
        file_size_bytes: filePart.buffer.length,
        drive_file_id: fileId, drive_file_url: fileUrl,
        drive_folder_id: folderId, drive_folder_path: folderPath,
        uploaded_by: uploadedBy,
      });

      return res.status(200).json({
        ok: true, fileId, fileUrl, folderPath, folderUrl,
        dbId: record[0]?.id,
        message: `File "${fileName}" berhasil diupload ke Drive ✓`,
      });

    } else if (req.method === "POST" && action === "delete") {
      const { driveFileId, dbId } = req.body;
      if (!driveFileId) return res.status(400).json({ error: "driveFileId wajib" });

      await deleteFileFromDrive(driveFileId);
      if (dbId) {
        await sbPatch("drive_files", `id=eq.${dbId}`, { drive_file_id: null });
      }
      return res.status(200).json({ ok: true, message: "File dihapus dari Drive ✓" });

    } else if (req.method === "GET" && action === "files") {
      const { agendaId } = req.query;
      if (!agendaId) return res.status(400).json({ error: "agendaId wajib" });

      const files = await sbGet(
        `drive_files?agenda_id=eq.${agendaId}&order=created_at.desc`
      );
      return res.status(200).json({ ok: true, files });

    } else {
      return res.status(400).json({ error: "Action atau method tidak dikenal" });
    }
  } catch (err) {
    console.error("[DRIVE]", err.message);
    return res.status(500).json({ error: err.message });
  }
}