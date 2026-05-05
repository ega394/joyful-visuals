// api/otp.js — Reset Password via OTP WhatsApp (Fonnte)
// ENV di Vercel Dashboard:
//   VITE_SUPABASE_URL      = URL project Supabase
//   VITE_SUPABASE_ANON_KEY = anon key Supabase
//   FONNTE_TOKEN           = token dari https://fonnte.com

const OTP_TTL_MS = 10 * 60 * 1000;

const SUPA_URL = process.env.VITE_SUPABASE_URL  || process.env.SUPABASE_URL  || "";
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";

function supaHeaders() {
  return {
    "Content-Type":  "application/json",
    "apikey":        SUPA_KEY,
    "Authorization": "Bearer " + SUPA_KEY,
  };
}

// Pesan error generik untuk frontend (tidak membocorkan info teknis)
const MSG_SERVER_BUSY = "Layanan sedang sibuk. Coba lagi beberapa menit.";

async function getUser(username) {
  const url = SUPA_URL + "/rest/v1/users?username=eq."
    + encodeURIComponent(username) + "&select=*";
  const r = await fetch(url, { headers: supaHeaders() });
  if (!r.ok) {
    console.error("[OTP] getUser gagal, status:", r.status);
    throw new Error(MSG_SERVER_BUSY);
  }
  const rows = await r.json();
  return rows[0] || null;
}

async function updateUser(username, fields) {
  const url = SUPA_URL + "/rest/v1/users?username=eq." + encodeURIComponent(username);
  const r = await fetch(url, {
    method:  "PATCH",
    headers: Object.assign({}, supaHeaders(), { Prefer: "return=minimal" }),
    body:    JSON.stringify(fields),
  });
  if (!r.ok) {
    console.error("[OTP] updateUser gagal, status:", r.status);
    throw new Error(MSG_SERVER_BUSY);
  }
}

async function hashPassword(plain) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
  const hex = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  return "$sha256$" + hex;
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskPhone(phone) {
  const p = phone.replace(/\D/g, "");
  if (p.length < 6) return "****";
  return p.slice(0, 4) + "****" + p.slice(-4);
}

async function sendOTPviaWA(noWA, otp, nama) {
  const token = process.env.FONNTE_TOKEN;

  // ── LOG: cek token ──
  if (!token) {
    console.error("[OTP] FONNTE_TOKEN tidak diset di environment variables!");
    return { ok: false, reason: "no_token" };
  }

  // Normalisasi nomor: 08xxx → 628xxx, strip non-digit
  const nomor = noWA.trim().replace(/^0/, "62").replace(/\D/g, "");
  console.log("[OTP] Mengirim ke nomor:", nomor, "| nama:", nama);

  const pesan = [
    "Reset Password - Prokopim Hibot Kota Tarakan",
    "",
    "Halo " + nama + ",",
    "",
    "Kode verifikasi Anda:",
    "",
    "    " + otp,
    "",
    "Cara pakai:",
    "1. Buka aplikasi Prokopim Hibot",
    "2. Masuk ke halaman \"Lupa Password\"",
    "3. Masukkan kode di atas",
    "4. Buat password baru (min. 6 karakter)",
    "",
    "Kode berlaku 10 menit. Jangan berikan kepada siapa pun.",
    "Abaikan pesan ini bila Anda tidak meminta reset password.",
  ].join("\n");

  try {
    const r = await fetch("https://api.fonnte.com/send", {
      method:  "POST",
      headers: { "Authorization": token, "Content-Type": "application/json" },
      body:    JSON.stringify({ target: nomor, message: pesan }),
    });
    const d = await r.json();

    // ── LOG: respons Fonnte ──
    console.log("[OTP] Respons Fonnte:", JSON.stringify(d));

    if (d.status === false || d.status === "false") {
      console.error("[OTP] Fonnte gagal:", d.reason || d.message || JSON.stringify(d));
      return { ok: false, reason: d.reason || d.message || "fonnte_error", detail: d };
    }
    return { ok: true };
  } catch (e) {
    console.error("[OTP] Fetch ke Fonnte error:", e.message);
    return { ok: false, reason: "fetch_error", message: e.message };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ error: "Konfigurasi server belum lengkap (SUPABASE env)." });
  }

  const { action, username, otp, newPassword } = req.body || {};
  if (!username) return res.status(400).json({ error: "Username wajib diisi" });

  // ── REQUEST OTP ──────────────────────────────────────────
  if (action === "request") {
    let user;
    try   { user = await getUser(username.toLowerCase().trim()); }
    catch (e) { return res.status(500).json({ error: "Gagal membaca data: " + e.message }); }

    if (!user) return res.status(404).json({ error: "Username tidak ditemukan" });

    // ── LOG: cek data user ──
    console.log("[OTP] User ditemukan:", user.username, "| noWA:", user.noWA || "(kosong)");

    const code    = generateOTP();
    const expires = new Date(Date.now() + OTP_TTL_MS).toISOString();

    try   { await updateUser(user.username, { otp_code: code, otp_expires: expires }); }
    catch (e) { return res.status(500).json({ error: "Gagal menyimpan OTP: " + e.message }); }

    if (user.noWA) {
      const result = await sendOTPviaWA(user.noWA, code, user.nama || username);
      if (result.ok) {
        return res.status(200).json({
          channel: "wa",
          masked:  maskPhone(user.noWA),
          nama:    user.nama || username,
        });
      }
      // WA gagal — kembalikan info alasan ke frontend (hanya untuk admin/debug)
      console.warn("[OTP] WA gagal, fallback ke screen. Alasan:", result.reason);
      return res.status(200).json({
        channel: "screen",
        code,
        nama:    user.nama || username,
        _waError: result.reason, // info tambahan (tidak ditampilkan ke user biasa)
      });
    }

    // Tidak ada noWA → screen
    console.warn("[OTP] noWA kosong untuk user:", user.username);
    return res.status(200).json({ channel: "screen", code, nama: user.nama || username });
  }

  // ── VERIFY OTP UNTUK LOGIN MFA (tanpa ganti password) ───
  if (action === "verify_login") {
    if (!otp) return res.status(400).json({ error: "OTP wajib diisi" });

    let user;
    try   { user = await getUser(username.toLowerCase().trim()); }
    catch (e) { return res.status(500).json({ error: "Gagal membaca data: " + e.message }); }

    if (!user)          return res.status(404).json({ error: "Username tidak ditemukan" });
    if (!user.otp_code) return res.status(400).json({ error: "OTP belum diminta atau sudah kedaluwarsa" });
    if (new Date(user.otp_expires) < new Date())
                        return res.status(400).json({ error: "Kode OTP sudah kedaluwarsa. Minta kode baru." });
    if (user.otp_code !== otp.trim())
                        return res.status(400).json({ error: "Kode OTP salah" });

    // Sukses — bersihkan OTP supaya tidak bisa dipakai ulang
    try   { await updateUser(user.username, { otp_code: null, otp_expires: null }); }
    catch (e) { return res.status(500).json({ error: "Gagal membersihkan OTP: " + e.message }); }

    return res.status(200).json({ ok: true, role: user.role, nama: user.nama || username });
  }

  // ── VERIFY OTP ───────────────────────────────────────────
  if (action === "verify") {
    if (!otp || !newPassword)
      return res.status(400).json({ error: "OTP dan password baru wajib diisi" });

    let user;
    try   { user = await getUser(username.toLowerCase().trim()); }
    catch (e) { return res.status(500).json({ error: "Gagal membaca data: " + e.message }); }

    if (!user)          return res.status(404).json({ error: "Username tidak ditemukan" });
    if (!user.otp_code) return res.status(400).json({ error: "OTP belum diminta atau sudah kedaluwarsa" });
    if (new Date(user.otp_expires) < new Date())
                        return res.status(400).json({ error: "Kode OTP sudah kedaluwarsa. Minta kode baru." });
    if (user.otp_code !== otp.trim())
                        return res.status(400).json({ error: "Kode OTP salah" });
    if (newPassword.length < 6)
                        return res.status(400).json({ error: "Password minimal 6 karakter" });

    const hashed = await hashPassword(newPassword);
    try   { await updateUser(user.username, { password: hashed, otp_code: null, otp_expires: null }); }
    catch (e) { return res.status(500).json({ error: "Gagal update password: " + e.message }); }

    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Action tidak valid" });
};
