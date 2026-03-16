// api/_middleware.js — shared auth + rate limit untuk semua endpoint
// Cara pakai: require('./middleware') di setiap api/*.js

const RATE_STORE = new Map(); // { key: { count, resetAt } }

/**
 * Verifikasi API_SECRET dari header X-API-Secret
 * Set env variable API_SECRET di Vercel
 */
function verifySecret(req) {
  const secret = process.env.API_SECRET;
  if (!secret) return true; // jika belum diset, lewati (development)
  const provided = req.headers["x-api-secret"] || req.headers["x-api-key"];
  return provided === secret;
}

/**
 * Rate limiter sederhana pakai in-memory Map
 * @param {string} key   — identifier (IP atau username)
 * @param {number} max   — max request
 * @param {number} windowMs — jendela waktu dalam ms
 */
function rateLimit(key, max = 30, windowMs = 60_000) {
  const now = Date.now();
  const entry = RATE_STORE.get(key) || { count: 0, resetAt: now + windowMs };

  // Reset jika jendela sudah lewat
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }

  entry.count++;
  RATE_STORE.set(key, entry);

  // Bersihkan entri lama setiap 1000 request
  if (RATE_STORE.size > 1000) {
    for (const [k, v] of RATE_STORE) {
      if (now > v.resetAt) RATE_STORE.delete(k);
    }
  }

  return { allowed: entry.count <= max, remaining: Math.max(0, max - entry.count), resetAt: entry.resetAt };
}

/**
 * Ambil IP dari request (support Vercel proxy)
 */
function getIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

/**
 * Middleware utama — panggil di awal setiap handler
 * Returns null jika OK, atau langsung kirim error response
 *
 * Opsi:
 *   requireSecret: true  → wajib X-API-Secret header
 *   maxPerMin: number    → max request per menit per IP
 */
function guard(req, res, opts = {}) {
  const { requireSecret = true, maxPerMin = 30 } = opts;

  // 1. CORS
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Secret");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return "handled";
  }

  // 2. Rate Limit per IP
  const ip = getIP(req);
  const rl = rateLimit(ip, maxPerMin, 60_000);
  res.setHeader("X-RateLimit-Remaining", rl.remaining);

  if (!rl.allowed) {
    res.status(429).json({
      error: "Terlalu banyak permintaan. Coba lagi dalam 1 menit.",
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
    return "blocked";
  }

  // 3. Secret verification
  if (requireSecret && !verifySecret(req)) {
    res.status(401).json({ error: "Akses tidak sah." });
    return "blocked";
  }

  return null; // semua OK
}

module.exports = { guard, rateLimit, getIP, verifySecret };
