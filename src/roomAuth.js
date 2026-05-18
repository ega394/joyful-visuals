/**
 * roomAuth.js — token sesi admin untuk endpoint pengelola ruangan.
 *
 * Login aplikasi tetap client-side (localStorage). Untuk mengamankan
 * endpoint admin (/api/room-booking PUT, ?admin=1, op=set_manager),
 * klien menukar (username + hash password yang sudah dimilikinya)
 * dengan token acak yang diterbitkan & diverifikasi server.
 */

const KEY = "rb_admin_token";

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}

export function clearAdminToken() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/**
 * Mengembalikan token admin yang valid untuk `user`. Memakai cache bila
 * masih berlaku & milik user yang sama; jika tidak, minta token baru.
 * @throws Error jika kredensial tidak valid / bukan pengelola.
 */
export async function getAdminToken(user) {
  if (!user?.username || !user?.password) {
    throw new Error("Sesi tidak valid. Silakan login ulang.");
  }
  const cached = read();
  if (
    cached &&
    cached.username === user.username &&
    cached.exp && Date.now() < cached.exp - 60_000
  ) {
    return cached.token;
  }

  const r = await fetch("/api/room-booking?op=auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user.username, pass: user.password }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.token) {
    throw new Error(d.error || "Gagal memverifikasi akses pengelola.");
  }
  try {
    localStorage.setItem(KEY, JSON.stringify({
      username: user.username,
      token: d.token,
      exp: Date.now() + (d.ttl_ms || 12 * 3600 * 1000),
    }));
  } catch { /* ignore */ }
  return d.token;
}

/** fetch dengan header Authorization Bearer token admin. */
export async function adminFetch(user, url, opts = {}) {
  const token = await getAdminToken(user);
  const headers = { ...(opts.headers || {}), "Authorization": `Bearer ${token}` };
  return fetch(url, { ...opts, headers });
}
