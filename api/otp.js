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

function maskEmail(email) {
  if (!email || !email.includes("@")) return "****";
  const [local, domain] = email.split("@");
  const visible = Math.min(2, Math.max(1, Math.floor(local.length / 3)));
  return local.slice(0, visible) + "****@" + domain;
}

async function sendOTPviaEmail(toEmail, otp, nama) {
  const apiKey  = process.env.RESEND_API_KEY;
  const from    = process.env.MAIL_FROM || "Prokopim Hibot <onboarding@resend.dev>";

  if (!apiKey) {
    console.error("[OTP] RESEND_API_KEY tidak diset di environment variables!");
    return { ok: false, reason: "no_api_key" };
  }

  const subject = "Kode OTP Prokopim Hibot";
  const html = [
    "<div style=\"font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F172A\">",
    "<div style=\"background:linear-gradient(135deg,#0A1628,#1B4080);color:white;padding:18px 22px;border-radius:12px 12px 0 0\">",
    "<div style=\"font-weight:700;font-size:18px\">Prokopim Hibot Kota Tarakan</div>",
    "<div style=\"opacity:.75;font-size:13px;margin-top:4px\">Kode Verifikasi (OTP)</div>",
    "</div>",
    "<div style=\"background:#F8FAFC;padding:24px 22px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px\">",
    "<p style=\"margin:0 0 12px;font-size:14px\">Halo <b>" + escapeHtml(nama || "") + "</b>,</p>",
    "<p style=\"margin:0 0 14px;font-size:14px\">Berikut adalah kode verifikasi Anda:</p>",
    "<div style=\"background:white;border:2px dashed #1E40AF;border-radius:10px;padding:18px;text-align:center;margin:14px 0\">",
    "<div style=\"font-size:30px;letter-spacing:8px;font-weight:800;color:#1E40AF\">" + otp + "</div>",
    "</div>",
    "<p style=\"margin:0 0 6px;font-size:13px;color:#475569\">Kode berlaku <b>10 menit</b>. Jangan berikan kepada siapa pun.</p>",
    "<p style=\"margin:0;font-size:12px;color:#94A3B8\">Abaikan email ini jika Anda tidak meminta kode tersebut.</p>",
    "</div>",
    "<p style=\"text-align:center;font-size:11px;color:#94A3B8;margin-top:14px\">© Bagian Prokopim Setda Kota Tarakan</p>",
    "</div>",
  ].join("");

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body:    JSON.stringify({ from, to: toEmail, subject, html }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("[OTP] Resend gagal:", r.status, d?.message || JSON.stringify(d));
      return { ok: false, reason: d?.name || "resend_error", detail: d };
    }
    return { ok: true };
  } catch (e) {
    console.error("[OTP] Fetch ke Resend error:", e.message);
    return { ok: false, reason: "fetch_error", message: e.message };
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
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

  const { action, username, otp, newPassword, channel: wantChannel } = req.body || {};
  if (!username) return res.status(400).json({ error: "Username wajib diisi" });

  // ── REQUEST OTP ──────────────────────────────────────────
  if (action === "request") {
    let user;
    try   { user = await getUser(username.toLowerCase().trim()); }
    catch (e) { return res.status(500).json({ error: "Gagal membaca data: " + e.message }); }

    if (!user) return res.status(404).json({ error: "Username tidak ditemukan" });

    // Tentukan channel: "wa" | "email" | "auto"
    // - "auto" (default): pakai WA jika ada noWA, kalau tidak fallback ke email
    // - "wa"            : paksa WA (gagal kalau noWA kosong)
    // - "email"         : paksa email (gagal kalau email kosong)
    const ch = (wantChannel || "auto").toLowerCase();

    if (ch === "wa" && !user.noWA) {
      return res.status(400).json({ error: "Akun ini belum punya nomor WhatsApp terdaftar. Pilih channel email atau hubungi admin." });
    }
    if (ch === "email" && !user.email) {
      return res.status(400).json({ error: "Akun ini belum punya email terdaftar. Pilih channel WhatsApp atau hubungi admin." });
    }
    if (ch === "auto" && !user.noWA && !user.email) {
      return res.status(400).json({ error: "Akun ini belum punya nomor WhatsApp atau email. Hubungi admin untuk melengkapi data." });
    }

    console.log("[OTP] User:", user.username, "| channel:", ch, "| noWA:", user.noWA ? "ada" : "kosong", "| email:", user.email ? "ada" : "kosong");

    const code    = generateOTP();
    const expires = new Date(Date.now() + OTP_TTL_MS).toISOString();

    try   { await updateUser(user.username, { otp_code: code, otp_expires: expires }); }
    catch (e) { return res.status(500).json({ error: "Gagal menyimpan OTP: " + e.message }); }

    // Pengiriman dengan strategi:
    //  - "wa"    : paksa WA (no fallback)
    //  - "email" : paksa email (no fallback)
    //  - "auto"  : coba WA dulu, kalau gagal (atau noWA kosong) → fallback email
    const trySendWA = async () => {
      const r = await sendOTPviaWA(user.noWA, code, user.nama || username);
      return r.ok ? { ok: true, channel: "wa", masked: maskPhone(user.noWA), reason: null }
                  : { ok: false, channel: "wa", reason: r.reason || "wa_failed" };
    };
    const trySendEmail = async () => {
      const r = await sendOTPviaEmail(user.email, code, user.nama || username);
      return r.ok ? { ok: true, channel: "email", masked: maskEmail(user.email), reason: null }
                  : { ok: false, channel: "email", reason: r.reason || "email_failed" };
    };

    if (ch === "wa") {
      const r = await trySendWA();
      if (r.ok) return res.status(200).json({ channel: r.channel, masked: r.masked, nama: user.nama || username });
      return res.status(500).json({ error: "Gagal mengirim OTP via WhatsApp. Coba lagi atau pakai saluran email." });
    }

    if (ch === "email") {
      const r = await trySendEmail();
      if (r.ok) return res.status(200).json({ channel: r.channel, masked: r.masked, nama: user.nama || username });
      return res.status(500).json({ error: "Gagal mengirim email OTP. Coba lagi atau pakai saluran WhatsApp." });
    }

    // auto: WA dulu, fallback ke email
    if (user.noWA) {
      const r = await trySendWA();
      if (r.ok) return res.status(200).json({ channel: r.channel, masked: r.masked, nama: user.nama || username });
      console.warn("[OTP] WA gagal di mode auto, fallback ke email. Alasan:", r.reason);
      if (user.email) {
        const r2 = await trySendEmail();
        if (r2.ok) return res.status(200).json({ channel: r2.channel, masked: r2.masked, nama: user.nama || username, _fallbackFrom: "wa" });
      }
      return res.status(500).json({ error: "Gagal mengirim OTP via WhatsApp dan email. Coba lagi nanti." });
    }
    if (user.email) {
      const r = await trySendEmail();
      if (r.ok) return res.status(200).json({ channel: r.channel, masked: r.masked, nama: user.nama || username });
      return res.status(500).json({ error: "Gagal mengirim email OTP. Coba lagi nanti." });
    }
    return res.status(400).json({ error: "Akun ini belum punya nomor WhatsApp atau email." });
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
