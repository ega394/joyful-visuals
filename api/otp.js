// api/otp.js — Reset Password via OTP WhatsApp (Fonnte)
// ENV di Vercel Dashboard:
//   VITE_SUPABASE_URL      = URL project Supabase
//   VITE_SUPABASE_ANON_KEY = anon key Supabase
//   FONNTE_TOKEN           = token dari https://fonnte.com

const nodeCrypto = require("crypto");
const { rateLimit, getIP } = require("./_middleware");
const { catatWA } = require("./_walog");

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAKS_SALAH = 5;

const SUPA_URL = process.env.VITE_SUPABASE_URL  || process.env.SUPABASE_URL  || "";
// Utamakan kunci layanan (sama dengan api/room-booking.mjs) supaya OTP tetap
// berjalan ketika tabel users kelak ditutup bagi kunci anon.
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

// ── Penyimpanan OTP ─────────────────────────────────────────
// Kolom users.otp_code terbaca kunci anon selama tabel users belum ber-RLS.
// Karena itu yang disimpan BUKAN kodenya, melainkan HMAC kode dengan kunci
// yang hanya ada di peladen, ditambah hitungan percobaan salah:
//     "h1:<hmac hex>:<jumlah salah>"
// Nilai lama (kode polos dari versi sebelumnya) dianggap kedaluwarsa.
function kunciOtp() {
  // API_SECRET tidak dipakai: salinannya pernah ikut bundel peramban.
  return process.env.OTP_PEPPER || process.env.SUPABASE_SERVICE_KEY ||
         process.env.CRON_SECRET || process.env.FONNTE_TOKEN || process.env.RESEND_API_KEY || "";
}
function sidikOtp(username, code) {
  return nodeCrypto.createHmac("sha256", kunciOtp()).update(String(username) + ":" + String(code)).digest("hex");
}
function bacaOtp(nilai) {
  const m = /^h1:([0-9a-f]{64}):(\d+)$/.exec(String(nilai || ""));
  return m ? { sidik: m[1], salah: Number(m[2]) } : null;
}
function samaAman(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && nodeCrypto.timingSafeEqual(x, y);
}
/**
 * Periksa OTP. Mengembalikan null bila cocok, atau {status, error} bila tidak.
 *
 * Setiap percobaan lebih dulu MEMESAN satu jatah dengan menaikkan hitungan di
 * basis data secara bersyarat (PATCH ... &otp_code=eq.<nilai lama>), baru
 * kemudian kodenya dibandingkan. Dengan begitu tebakan yang dikirim bersamaan
 * tetap terhitung satu per satu, dan paling banyak OTP_MAKS_SALAH tebakan
 * yang pernah dibandingkan untuk satu kode.
 */
async function periksaOtp(user, otp) {
  let nilai = user.otp_code, expires = user.otp_expires;
  for (let coba = 0; coba < 8; coba++) {
    const simpan = bacaOtp(nilai);
    if (!simpan) return { status: 400, error: "OTP belum diminta atau sudah kedaluwarsa. Minta kode baru." };
    if (!expires || new Date(expires) < new Date())
      return { status: 400, error: "Kode OTP sudah kedaluwarsa. Minta kode baru." };
    if (simpan.salah >= OTP_MAKS_SALAH) {
      await updateUser(user.username, { otp_code: null, otp_expires: null });
      return { status: 429, error: "Terlalu banyak percobaan salah. Kode dihanguskan — minta kode baru." };
    }
    const dipakai = simpan.salah + 1;
    const baru = "h1:" + simpan.sidik + ":" + dipakai;
    if (await gantiOtpBersyarat(user.username, nilai, baru)) {
      if (samaAman(simpan.sidik, sidikOtp(user.username, String(otp).trim()))) return null;
      if (dipakai >= OTP_MAKS_SALAH) {
        await updateUser(user.username, { otp_code: null, otp_expires: null });
        return { status: 429, error: "Terlalu banyak percobaan salah. Kode dihanguskan — minta kode baru." };
      }
      return { status: 400, error: "Kode OTP salah. Sisa percobaan: " + (OTP_MAKS_SALAH - dipakai) + "." };
    }
    // Percobaan lain mendahului: baca ulang lalu ulangi pemesanan.
    const segar = await getUser(user.username);
    if (!segar) return { status: 400, error: "OTP belum diminta atau sudah kedaluwarsa. Minta kode baru." };
    nilai = segar.otp_code; expires = segar.otp_expires;
  }
  return { status: 429, error: "Terlalu banyak percobaan bersamaan. Coba lagi." };
}

/** Ganti otp_code hanya bila nilainya masih `lama`. true bila satu baris berubah. */
async function gantiOtpBersyarat(username, lama, baru) {
  const url = SUPA_URL + "/rest/v1/users?username=eq." + encodeURIComponent(username) +
              "&otp_code=eq." + encodeURIComponent(lama);
  const r = await fetch(url, {
    method:  "PATCH",
    headers: Object.assign({}, supaHeaders(), { Prefer: "return=representation" }),
    body:    JSON.stringify({ otp_code: baru }),
  });
  if (!r.ok) {
    console.error("[OTP] pemesanan percobaan gagal, status:", r.status);
    throw new Error(MSG_SERVER_BUSY);
  }
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows.length === 1;
}

/** Cabut semua token sesi peladen milik akun (tabel `sesi` dan kolom lama). */
async function cabutSesi(username) {
  try {
    await fetch(SUPA_URL + "/rest/v1/sesi?username=eq." + encodeURIComponent(username), {
      method: "DELETE", headers: Object.assign({}, supaHeaders(), { Prefer: "return=minimal" }),
    });
  } catch (e) { console.warn("[OTP] cabut sesi gagal:", e.message); }
  try { await updateUser(username, { session_token: null, session_expires: null }); }
  catch (e) { /* kolom lama mungkin sudah tidak ada */ }
}

async function catatAudit(baris) {
  try {
    await fetch(SUPA_URL + "/rest/v1/audit_log", {
      method: "POST",
      headers: Object.assign({}, supaHeaders(), { Prefer: "return=minimal" }),
      body: JSON.stringify(baris),
    });
  } catch (e) { console.warn("[OTP] audit gagal:", e.message); }
}

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
  return String(nodeCrypto.randomInt(100000, 1000000));
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
      await catatWA({ jenis: "otp", sumber: "otp", berhasil: false, catatan: String(d.reason || d.message || "fonnte_error") });
      return { ok: false, reason: d.reason || d.message || "fonnte_error", detail: d };
    }
    await catatWA({ jenis: "otp", sumber: "otp", berhasil: true });
    return { ok: true };
  } catch (e) {
    console.error("[OTP] Fetch ke Fonnte error:", e.message);
    await catatWA({ jenis: "otp", sumber: "otp", berhasil: false, catatan: e.message });
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
  if (!kunciOtp()) {
    return res.status(500).json({ error: "Konfigurasi server belum lengkap (kunci OTP)." });
  }

  const { action, username, otp, newPassword, channel: wantChannel } = req.body || {};
  if (!username) return res.status(400).json({ error: "Username wajib diisi" });

  // ── REQUEST OTP ──────────────────────────────────────────
  if (action === "request") {
    let user;
    try   { user = await getUser(username.toLowerCase().trim()); }
    catch (e) { return res.status(500).json({ error: "Gagal membaca data: " + e.message }); }

    if (!user) return res.status(404).json({ error: "Username tidak ditemukan" });

    // Batas permintaan kode: 3 per 10 menit per akun dan 10 per 10 menit per
    // alamat IP, supaya fitur ini tidak dipakai membanjiri WA/email seseorang.
    // Penyimpanannya di memori instans (perlindungan dasar, bukan mutlak).
    // Jatah per akun dihitung per alamat IP juga, supaya orang lain yang
    // menghabiskan jatah dari jaringannya sendiri tidak serta-merta mengunci
    // pemilik akun; batas per akun total tetap ada sebagai pagar atas.
    const ip = getIP(req);
    if (!rateLimit("otp-akun-ip:" + user.username + ":" + ip, 3, 10 * 60_000).allowed ||
        !rateLimit("otp-akun:" + user.username, 8, 10 * 60_000).allowed ||
        !rateLimit("otp-ip:" + ip, 10, 10 * 60_000).allowed) {
      return res.status(429).json({ error: "Terlalu sering meminta kode. Coba lagi dalam 10 menit." });
    }

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

    try   { await updateUser(user.username, { otp_code: "h1:" + sidikOtp(user.username, code) + ":0", otp_expires: expires }); }
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

  // Batas laju pemeriksaan kode (selain jatah 5 salah per kode).
  if ((action === "verify" || action === "verify_login") &&
      !rateLimit("otp-cek-ip:" + getIP(req), 20, 10 * 60_000).allowed) {
    return res.status(429).json({ error: "Terlalu banyak percobaan. Coba lagi dalam 10 menit." });
  }

  // ── VERIFY OTP UNTUK LOGIN MFA (tanpa ganti password) ───
  if (action === "verify_login") {
    if (!otp) return res.status(400).json({ error: "OTP wajib diisi" });

    let user;
    try   { user = await getUser(username.toLowerCase().trim()); }
    catch (e) { return res.status(500).json({ error: "Gagal membaca data: " + e.message }); }

    if (!user)          return res.status(404).json({ error: "Username tidak ditemukan" });
    let gagal;
    try   { gagal = await periksaOtp(user, otp); }
    catch (e) { return res.status(500).json({ error: "Gagal memeriksa OTP: " + e.message }); }
    if (gagal) return res.status(gagal.status).json({ error: gagal.error });

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
    // Sandi superadmin tidak dipulihkan lewat OTP (WA/email bisa diambil alih).
    // Pemulihannya melalui pemegang kunci lain atau jalur darurat basis data.
    if (user.role === "superadmin")
      return res.status(403).json({ error: "Sandi akun superadmin tidak dapat direset lewat OTP. Hubungi pemegang kunci lain." });
    if (newPassword.length < 6)
                        return res.status(400).json({ error: "Password minimal 6 karakter" });
    let gagal;
    try   { gagal = await periksaOtp(user, otp); }
    catch (e) { return res.status(500).json({ error: "Gagal memeriksa OTP: " + e.message }); }
    if (gagal) return res.status(gagal.status).json({ error: gagal.error });

    const hashed = await hashPassword(newPassword);
    // session_version dinaikkan: semua perangkat yang masih masuk dengan sandi
    // lama dikeluarkan saat memuat aplikasi.
    try   { await updateUser(user.username, { password: hashed, otp_code: null, otp_expires: null,
                                              session_version: (Number(user.session_version) || 0) + 1 }); }
    catch (e) { return res.status(500).json({ error: "Gagal update password: " + e.message }); }
    await cabutSesi(user.username);
    await catatAudit({ actor: user.username, actor_role: user.role, action: "auth.reset_password_otp",
                       target: user.username, detail: { channel: "otp" },
                       ip: String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || null });

    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Action tidak valid" });
};
