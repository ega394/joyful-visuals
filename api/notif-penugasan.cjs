// ============================================================
//  /api/notif-penugasan.js
//  Dipanggil oleh App.jsx (savePenugasan) saat kasubbag menyimpan
//  penugasan personil. Jika sisa waktu acara < 6 jam, kirim WA
//  darurat langsung ke masing-masing staf yang ditugaskan.
//
//  Method : POST
//  Body   : {
//    evId        : string | number,
//    namaAcara   : string,
//    tanggal     : “YYYY-MM-DD”,
//    jam         : “HH:MM”,
//    lokasi      : string,
//    pakaian     : string,
//    penyelenggara: string,
//    catatanPenugasan: string,
//    personil    : string[],      // array username
//    pimpinan    : string[],      // [“walikota”,“wakilwalikota”]
//    delegasiKeWWK: boolean,
//  }
//
//  ENV :
//    VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, FONNTE_TOKEN, CRON_SECRET
// ============================================================

const SUPA_URL = process.env.VITE_SUPABASE_URL  || process.env.SUPABASE_URL  || “”;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || “”;
const FONNTE   = process.env.FONNTE_TOKEN || “”;

// ─── Ambil user dari Supabase ────────────────────────────────
async function getUsersByUsernames(usernames) {
if (!usernames.length) return [];
// Query: username=in.(a,b,c)
const list = usernames.map(u => encodeURIComponent(u)).join(”,”);
const url  = SUPA_URL + “/rest/v1/users?username=in.(” + list + “)&select=username,nama,jabatan,noWA,role”;
const r    = await fetch(url, {
headers: {
“Content-Type”:  “application/json”,
“apikey”:        SUPA_KEY,
“Authorization”: “Bearer “ + SUPA_KEY,
},
});
if (!r.ok) throw new Error(“Gagal ambil users: “ + r.status);
return await r.json();
}

// ─── Kirim WA via Fonnte ─────────────────────────────────────
async function kirimWA(noWA, pesan) {
const nomor = noWA.trim().replace(/^0/, “62”).replace(/\D/g, “”);
if (nomor.length < 10) return false;
try {
const r = await fetch(“https://api.fonnte.com/send”, {
method:  “POST”,
headers: { “Authorization”: FONNTE, “Content-Type”: “application/json” },
body:    JSON.stringify({ target: nomor, message: pesan }),
});
const d = await r.json();
return d.status !== false;
} catch (e) {
console.error(”[notif-penugasan] WA gagal →”, nomor, e.message);
return false;
}
}

// ─── Format jam → “09:00” ───────────────────────────────────
function fmtJam(jam) { return jam || “-”; }

// ─── Format tanggal → “Senin, 11 Maret 2026” ────────────────
function fmtTgl(tgl) {
const HARI  = [“Minggu”,“Senin”,“Selasa”,“Rabu”,“Kamis”,“Jumat”,“Sabtu”];
const BULAN = [””,“Januari”,“Februari”,“Maret”,“April”,“Mei”,“Juni”,
“Juli”,“Agustus”,“September”,“Oktober”,“November”,“Desember”];
const [y, m, d] = tgl.split(”-”).map(Number);
const hari = HARI[new Date(y, m - 1, d).getDay()];
return hari + “, “ + d + “ “ + BULAN[m] + “ “ + y;
}

// ─── Hitung sisa waktu dalam jam ─────────────────────────────
function sisaJam(tanggal, jam) {
// Waktu acara dalam UTC: tanggal + jam = WITA (UTC+8)
// Jadi UTC = waktu WITA - 8 jam
const [h, m] = jam.split(”:”).map(Number);
const [y, mo, d] = tanggal.split(”-”).map(Number);
const acaraUTC = Date.UTC(y, mo - 1, d, h - 8, m, 0); // WITA→UTC
const now      = Date.now();
return (acaraUTC - now) / (1000 * 60 * 60);
}

// ─── Susun pesan WA untuk staf ────────────────────────────────
function buatPesan(data, namaStaf, jabatanStaf, sisaH) {
const {
namaAcara, tanggal, jam, lokasi, pakaian,
penyelenggara, catatanPenugasan, pimpinan = [], delegasiKeWWK,
} = data;

const pimpinanStr = (() => {
const p = [];
if (pimpinan.includes(“walikota”))
p.push(delegasiKeWWK ? “Wali Kota (Delegasi ke Wakil WK)” : “Wali Kota”);
if (pimpinan.includes(“wakilwalikota”) || delegasiKeWWK)
p.push(“Wakil Wali Kota”);
return p.join(” & “) || “-”;
})();

const sisaStr =
sisaH < 1
? Math.round(sisaH * 60) + “ menit lagi”
: (sisaH < 2
? “sekitar “ + Math.round(sisaH * 60) + “ menit lagi”
: “sekitar “ + sisaH.toFixed(0) + “ jam lagi”);

return [
“🎯 *PENUGASAN BARU*”,
“Anda baru saja ditugaskan pada kegiatan yang *akan berlangsung “ + sisaStr + “.*”,
“”,
“📋 *DETAIL KEGIATAN*”,
“━━━━━━━━━━━━━━━━━━━━”,
“📌 *” + namaAcara + “*”,
“📅 “ + fmtTgl(tanggal),
“⏰ “ + fmtJam(jam) + “ WITA”,
“📍 “ + (lokasi || “-”),
“🏢 Penyelenggara: “ + (penyelenggara || “-”),
“👔 Pakaian: “ + (pakaian || “-”),
“👤 Pimpinan: “ + pimpinanStr,
catatanPenugasan ? “📝 Catatan: “ + catatanPenugasan : “”,
“━━━━━━━━━━━━━━━━━━━━”,
“”,
“Yth. “ + (namaStaf || “Bapak/Ibu”) + (jabatanStaf ? “ (” + jabatanStaf + “)” : “”) + “,”,
“Mohon segera mempersiapkan diri dan hadir tepat waktu.”,
“”,
“✅ Cek penugasan lengkap di:”,
“prokopim.tarakankota.go.id”,
].filter(l => l !== null).join(”\n”);
}

// ─── Main Handler ─────────────────────────────────────────────
module.exports = async function handler(req, res) {
if (req.method !== “POST”) {
return res.status(405).json({ error: “Method not allowed” });
}

// Validasi CRON_SECRET / Bearer token sebagai pengaman
const secret = process.env.CRON_SECRET || “”;
const auth   = req.headers[“authorization”] || “”;
if (secret && auth !== “Bearer “ + secret) {
return res.status(401).json({ error: “Unauthorized” });
}

if (!SUPA_URL || !SUPA_KEY) {
return res.status(500).json({ error: “SUPABASE env belum diset” });
}

try {
const data = req.body || {};
const { tanggal, jam, personil = [] } = data;

```
if (!tanggal || !jam || !personil.length) {
  return res.status(400).json({ error: "tanggal, jam, dan personil wajib diisi" });
}

// Hitung sisa waktu
const sisa = sisaJam(tanggal, jam);

// Hanya kirim WA jika < 6 jam
if (sisa >= 6) {
  return res.status(200).json({
    ok: true,
    skipped: true,
    message: "Sisa waktu " + sisa.toFixed(1) + " jam ≥ 6 jam, WA tidak dikirim",
  });
}

if (sisa <= 0) {
  return res.status(200).json({
    ok: true,
    skipped: true,
    message: "Acara sudah lewat, WA tidak dikirim",
  });
}

if (!FONNTE) {
  console.warn("[notif-penugasan] FONNTE_TOKEN tidak diset");
}

// Ambil data user dari Supabase
const users = await getUsersByUsernames(personil);

let sent = 0, noWA = 0, failed = 0;
const results = [];

for (const u of users) {
  if (!u.noWA) { noWA++; results.push({ username: u.username, skip: "no_wa" }); continue; }
  const pesan = buatPesan(data, u.nama, u.jabatan, sisa);
  const ok    = await kirimWA(u.noWA, pesan);
  if (ok) sent++; else failed++;
  results.push({ username: u.username, ok });
  // Jeda kecil agar tidak spam Fonnte
  await new Promise(r => setTimeout(r, 250));
}

console.log("[notif-penugasan] Sisa:", sisa.toFixed(1), "jam | Terkirim:", sent, "| Gagal:", failed, "| No WA:", noWA);
return res.status(200).json({ ok: true, sisaJam: sisa, sent, failed, noWA, results });
```

} catch (err) {
console.error(”[notif-penugasan] Error:”, err.message);
return res.status(500).json({ error: err.message });
}
};
