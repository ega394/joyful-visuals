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

  // Satu permintaan token untuk semua pemanggil yang datang bersamaan, supaya
  // notifikasi yang dikirim beruntun tidak masing-masing meminta sesi baru.
  if (_minta && _minta.username === user.username) return _minta.janji;
  const janji = (async () => {
    const r = await fetch("/api/room-booking?op=auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user.username, pass: user.password }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.token) {
      const e = new Error(d.error || "Gagal memverifikasi akses pengelola.");
      e.status = r.status;
      throw e;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify({
        username: user.username,
        token: d.token,
        exp: Date.now() + (d.ttl_ms || 12 * 3600 * 1000),
      }));
    } catch { /* ignore */ }
    return d.token;
  })();
  _minta = { username: user.username, janji };
  try { return await janji; }
  finally { if (_minta && _minta.janji === janji) _minta = null; }
}

let _minta = null;

/** Hapus token tersimpan hanya bila masih sama dengan `token` (yang ditolak peladen). */
function buangTokenBila(token) {
  const c = read();
  if (c && c.token === token) clearAdminToken();
}

/** fetch dengan header Authorization Bearer token admin. */
export async function adminFetch(user, url, opts = {}) {
  const token = await getAdminToken(user);
  const headers = { ...(opts.headers || {}), "Authorization": `Bearer ${token}` };
  return fetch(url, { ...opts, headers });
}

/**
 * fetch yang melampirkan token bila bisa didapat, dan tetap jalan bila tidak.
 *
 * Dipakai endpoint yang boleh diakses publik tetapi memberi data lebih lengkap
 * kepada pemegang akun — mis. kalender `?month=` yang hanya menyertakan kontak
 * PIC untuk pengguna yang sudah login. Kegagalan token tidak boleh membuat
 * kalender gagal tampil, jadi errornya sengaja ditelan.
 */
export async function userFetch(user, url, opts = {}) {
  let token = null;
  try { token = await getAdminToken(user); } catch { /* lanjut tanpa token */ }
  const headers = { ...(opts.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers });
}

// ── Sesi pengguna yang sedang login (untuk endpoint yang wajib sesi) ─────
//
// Endpoint seperti /api/whatsapp, /api/guest, /api/drive, dan /api/ai-newsroom
// menolak permintaan tanpa token sesi. Pemanggilnya tersebar (termasuk fungsi
// tingkat modul seperti sendWA yang tidak memegang `user`), jadi pengguna aktif
// dicatat sekali di sini oleh aplikasi saat login/keluar.
let _penggunaSesi = null;

/** Dipanggil aplikasi setiap kali pengguna yang login berubah (null saat keluar). */
export function setPenggunaSesi(user) {
  _penggunaSesi = user && user.username ? user : null;
}

/**
 * fetch dengan token sesi pengguna aktif.
 *
 * Token di-cache 12 jam. Bila peladen menolaknya (kedaluwarsa atau dicabut),
 * jawaban 401 dicoba ulang sekali dengan token baru. Tanpa pengguna aktif (halaman publik),
 * permintaan dikirim apa adanya.
 */
export async function sesiFetch(url, opts = {}) {
  const user = _penggunaSesi;
  if (!user) return fetch(url, opts);
  const kirim = async () => {
    let token = null;
    try { token = await getAdminToken(user); }
    catch (e) {
      // Kredensial ditolak (mis. sandi diganti dari perangkat lain): beri tahu
      // aplikasi supaya meminta login ulang, bukan gagal diam-diam.
      if (e && e.status === 401) beritahuSesiHabis("kredensial");
    }
    const headers = { ...(opts.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return { r: await fetch(url, { ...opts, headers }), token };
  };
  const { r, token } = await kirim();
  if (r.status !== 401 || !token) return r;
  // Hanya buang token yang memang ditolak; permintaan paralel lain mungkin
  // sudah menyimpan token baru.
  buangTokenBila(token);
  const ulang = await kirim();
  if (ulang.r.status === 401) beritahuSesiHabis("ditolak");
  return ulang.r;
}

/** Peristiwa "prokopim:sesi-habis" — didengar aplikasi untuk meminta login ulang. */
function beritahuSesiHabis(sebab) {
  try { window.dispatchEvent(new CustomEvent("prokopim:sesi-habis", { detail: { sebab } })); } catch { /* bukan peramban */ }
}
