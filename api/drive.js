/**
 * api/drive.js — Prokopim v1.5
 * Server-to-Server Google Drive Upload
 *
 * Actions:
 *   POST ?action=upload      — Terima file Base64/URL dari frontend, upload ke Drive
 *   POST ?action=sync_one    — Sinkronisasi 1 event (Base64 -> Drive URL)
 *   POST ?action=finalize    — Set public permission + catat ke DB (legacy)
 *   POST ?action=delete      — Hapus file dari Drive + DB
 *
 * Env vars yang dibutuhkan di Vercel:
 *   GOOGLE_SA_EMAIL
 *   GOOGLE_SA_PRIVATE_KEY
 *   GOOGLE_DRIVE_ROOT_FOLDER_ID
 *   SUPABASE_URL  (atau VITE_SUPABASE_URL)
 *   SUPABASE_KEY  (atau VITE_SUPABASE_ANON_KEY)
 */

// Vercel: naikkan batas payload ke 30MB
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "30mb",
    },
  },
};

const SUPA_URL    = process.env.SUPABASE_URL    || process.env.VITE_SUPABASE_URL;
const SUPA_KEY    = process.env.SUPABASE_KEY    || process.env.VITE_SUPABASE_ANON_KEY;
const SA_EMAIL    = process.env.GOOGLE_SA_EMAIL;
const SA_KEY_RAW  = process.env.GOOGLE_SA_PRIVATE_KEY;
const ROOT_FOLDER = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

// Supabase helpers
function SH() {
  return {
    "Content-Type":  "application/json",
    "apikey":        SUPA_KEY,
    "Authorization": "Bearer " + SUPA_KEY,
    "Prefer":        "return=representation",
  };
}
async function sbGet(path) {
  const r = await fetch(SUPA_URL + "/rest/v1/" + path, { headers: SH() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbPost(table, body) {
  const r = await fetch(SUPA_URL + "/rest/v1/" + table, {
    method: "POST", headers: SH(), body: JSON.stringify(body),
  });
  return r.json();
}
async function sbPatch(table, filter, body) {
  const r = await fetch(SUPA_URL + "/rest/v1/" + table + "?" + filter, {
    method: "PATCH", headers: SH(), body: JSON.stringify(body),
  });
  return r.json();
}

// JWT helpers
function base64url(input) {
  const str = typeof input === "string"
    ? Buffer.from(input, "utf8").toString("base64")
    : Buffer.from(input).toString("base64");
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function signJWT(header, payload, pem) {
  const enc = base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(payload));
  const raw = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "")
                 .replace(/-----END PRIVATE KEY-----/g, "")
                 .replace(/\s+/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8", Buffer.from(raw, "base64"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, Buffer.from(enc));
  return enc + "." + base64url(new Uint8Array(sig));
}

// Google OAuth token (cached per instance)
let _tok = null, _tokExp = 0;
async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  if (_tok && now < _tokExp - 60) return _tok;
  if (!SA_EMAIL || !SA_KEY_RAW) throw new Error("Kredensial Google belum diset di env.");
  const jwt = await signJWT(
    { alg: "RS256", typ: "JWT" },
    { iss: SA_EMAIL, scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now },
    SA_KEY_RAW.replace(/\\n/g, "\n")
  );
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!r.ok) throw new Error("Token gagal: " + await r.text());
  const d = await r.json();
  _tok = d.access_token; _tokExp = now + d.expires_in;
  return _tok;
}

// Cari atau buat folder di Drive (dengan cache Supabase)
async function getOrCreateFolder(token, folderPath) {
  const cached = await sbGet(
    "drive_folder_cache?folder_path=eq." + encodeURIComponent(folderPath) + "&limit=1"
  ).catch(() => []);
  if (cached && cached.length > 0) return cached[0].folder_id;

  const parts = folderPath.split("/");
  let parentId = ROOT_FOLDER;
  for (const part of parts) {
    const q = encodeURIComponent(
      "name='" + part + "' and mimeType='application/vnd.google-apps.folder' and '" + parentId + "' in parents and trashed=false"
    );
    const sr = await fetch("https://www.googleapis.com/drive/v3/files?q=" + q + "&fields=files(id,name)",
      { headers: { Authorization: "Bearer " + token } });
    const sd = await sr.json();
    if (sd.files && sd.files.length > 0) {
      parentId = sd.files[0].id;
    } else {
      const cr = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ name: part, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
      });
      const cd = await cr.json();
      parentId = cd.id;
    }
  }
  await sbPost("drive_folder_cache", { folder_path: folderPath, folder_id: parentId }).catch(() => null);
  return parentId;
}

// Upload file ke Drive — sepenuhnya di server, aman dari CORS & Vercel size limit
async function uploadFileToDrive(token, folderId, fileName, mimeType, fileBuffer) {
  const boundary = "prokopim_" + Date.now();
  const metaStr  = JSON.stringify({ name: fileName, parents: [folderId] });

  const metaPart = Buffer.from(
    "--" + boundary + "\r\n" +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    metaStr + "\r\n"
  );
  const filePart = Buffer.from(
    "--" + boundary + "\r\n" +
    "Content-Type: " + mimeType + "\r\n\r\n"
  );
  const endPart  = Buffer.from("\r\n--" + boundary + "--");
  const body     = Buffer.concat([metaPart, filePart, fileBuffer, endPart]);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size",
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type":  "multipart/related; boundary=" + boundary,
        "Content-Length": String(body.length),
      },
      body: body,
    }
  );
  if (!uploadRes.ok) throw new Error("Drive upload gagal (" + uploadRes.status + "): " + await uploadRes.text());
  return uploadRes.json();
}

// Set file bisa dilihat publik (siapapun punya link bisa baca)
async function makePublic(token, fileId) {
  await fetch("https://www.googleapis.com/drive/v3/files/" + fileId + "/permissions", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
}

// Konversi sumber file (Base64 data URI / URL / raw base64) ke Buffer
async function srcToBuffer(fileSource) {
  let mimeType = "application/pdf";
  let buf;
  if (fileSource.startsWith("data:")) {
    const [meta, b64] = fileSource.split(",");
    const m = meta.match(/:(.*?);/);
    if (m) mimeType = m[1];
    buf = Buffer.from(b64, "base64");
  } else if (fileSource.startsWith("http://") || fileSource.startsWith("https://")) {
    const r = await fetch(fileSource);
    if (!r.ok) throw new Error("Gagal ambil file dari URL: " + fileSource);
    const ct = r.headers.get("content-type");
    if (ct) mimeType = ct.split(";")[0].trim();
    buf = Buffer.from(await r.arrayBuffer());
  } else {
    buf = Buffer.from(fileSource, "base64");
  }
  if (buf.length === 0) throw new Error("File kosong (0 byte).");
  return { buf, mimeType };
}

const BULAN = ["Januari","Februari","Maret","April","Mei","Juni",
               "Juli","Agustus","September","Oktober","November","Desember"];

// HANDLER UTAMA
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method tidak diizinkan" });

  const action = req.query.action;

  try {

    // ACTION: upload
    // Body JSON: { fileSource, fileName, agendaId, agendaDate, fileType, uploadedBy }
    if (action === "upload") {
      const { fileSource, fileName, agendaId, agendaDate, fileType, uploadedBy } = req.body;
      if (!fileSource) return res.status(400).json({ error: "fileSource wajib diisi." });

      const { buf, mimeType } = await srcToBuffer(fileSource);

      const dateObj     = agendaDate ? new Date(agendaDate) : new Date();
      const yearFolder  = dateObj.getFullYear().toString();
      const monthFolder = BULAN[dateObj.getMonth()];
      const subFolder   = fileType === "sambutan" ? "Sambutan" : "Undangan";
      const folderPath  = yearFolder + "/" + monthFolder + "/" + subFolder;
      const cleanName   = (fileName || "file").replace(/[^a-zA-Z0-9 ._-]/g, "").substring(0, 80);

      const token    = await getToken();
      const folderId = await getOrCreateFolder(token, folderPath);
      const uploaded = await uploadFileToDrive(token, folderId, cleanName, mimeType, buf);
      await makePublic(token, uploaded.id);

      const fileUrl = "https://drive.google.com/file/d/" + uploaded.id + "/view";
      await sbPost("drive_files", {
        agenda_id:         agendaId || null,
        file_name:         cleanName,
        file_type:         subFolder.toLowerCase(),
        mime_type:         mimeType,
        file_size_bytes:   buf.length,
        drive_file_id:     uploaded.id,
        drive_file_url:    fileUrl,
        drive_folder_id:   folderId,
        drive_folder_path: folderPath,
        uploaded_by:       uploadedBy || "sistem",
      }).catch(() => null);

      return res.status(200).json({ ok: true, fileUrl, fileId: uploaded.id, folderPath });
    }

    // ACTION: sync_one
    // Body JSON: { event: {...eventObject} }
    if (action === "sync_one") {
      const ev = req.body.event;
      if (!ev) return res.status(400).json({ error: "event wajib diisi." });

      const token  = await getToken();
      const result = {};

      for (const field of ["undanganFile", "sambutanFile"]) {
        const src = ev[field];
        if (!src || typeof src !== "string" || src.includes("drive.google.com") || src.length < 50) continue;
        try {
          const { buf, mimeType } = await srcToBuffer(src);
          const dateObj     = ev.tanggal ? new Date(ev.tanggal) : new Date();
          const subFolder   = field === "sambutanFile" ? "Sambutan" : "Undangan";
          const folderPath  = dateObj.getFullYear() + "/" + BULAN[dateObj.getMonth()] + "/" + subFolder;
          const nameKey     = field === "sambutanFile" ? "sambutanNama" : "undanganNama";
          const ext         = (ev[nameKey] || "pdf").split(".").pop() || "pdf";
          const cleanName   = ev.tanggal + " - " + subFolder.toUpperCase() + " - " +
                              (ev.namaAcara || "").replace(/[^a-zA-Z0-9 -]/g, "").substring(0, 40) + "." + ext;

          const folderId = await getOrCreateFolder(token, folderPath);
          const uploaded = await uploadFileToDrive(token, folderId, cleanName, mimeType, buf);
          await makePublic(token, uploaded.id);

          const fileUrl = "https://drive.google.com/file/d/" + uploaded.id + "/view";
          await sbPost("drive_files", {
            agenda_id: ev.id || null, file_name: cleanName, file_type: subFolder.toLowerCase(),
            mime_type: mimeType, file_size_bytes: buf.length, drive_file_id: uploaded.id,
            drive_file_url: fileUrl, drive_folder_id: folderId, drive_folder_path: folderPath,
            uploaded_by: "sync_batch",
          }).catch(() => null);
          result[field] = fileUrl;
        } catch (e) {
          result[field + "_error"] = e.message;
        }
      }
      return res.status(200).json({ ok: true, ...result });
    }

    // ACTION: finalize (legacy)
    if (action === "finalize") {
      const { fileId, agendaId, fileName, mimeType, fileSizeBytes, folderId, folderPath, targetSub } = req.body;
      const token = await getToken();
      await makePublic(token, fileId);
      const fileUrl = "https://drive.google.com/file/d/" + fileId + "/view";
      await sbPost("drive_files", {
        agenda_id: agendaId || null, file_name: fileName, file_type: (targetSub || "").toLowerCase(),
        mime_type: mimeType, file_size_bytes: fileSizeBytes, drive_file_id: fileId,
        drive_file_url: fileUrl, drive_folder_id: folderId, drive_folder_path: folderPath,
        uploaded_by: "finalize_legacy",
      }).catch(() => null);
      return res.status(200).json({ ok: true, fileUrl });
    }

    // ACTION: delete
    if (action === "delete") {
      const { driveFileId, dbId } = req.body;
      const token = await getToken();
      await fetch("https://www.googleapis.com/drive/v3/files/" + driveFileId, {
        method: "DELETE", headers: { Authorization: "Bearer " + token },
      });
      if (dbId) await sbPatch("drive_files", "id=eq." + dbId, { drive_file_id: null }).catch(() => null);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Action tidak dikenal: " + action });

  } catch (err) {
    console.error("[DRIVE API ERROR]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
