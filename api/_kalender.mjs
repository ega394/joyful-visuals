/**
 * api/_kalender.mjs — sinkron agenda Pimpinan ke Google Calendar bersama.
 *
 * Berawalan garis bawah supaya Vercel TIDAK menghitungnya sebagai fungsi
 * peladen: jatah paket Hobby sudah penuh 12/12. Modul ini menumpang pada
 *   - api/room-booking.mjs  ?op=kalender   → sinkron satu jadwal seketika
 *   - api/notif-cron.mjs    (5x sehari)    → pencocokan menyeluruh
 *
 * JANGAN diganti menjadi .js dan jangan diimpor dari api/*.js: api/ bertipe
 * CommonJS, sehingga require() atas modul ESM mati saat dimuat
 * (ERR_REQUIRE_ESM). Lihat scripts/cek-api.mjs.
 *
 * Pemasangan (Vercel → Settings → Environment Variables):
 *   GOOGLE_CALENDAR_ID               ID kalender tujuan
 *   GOOGLE_CALENDAR_SA_EMAIL         client_email akun layanan KHUSUS kalender
 *   GOOGLE_CALENDAR_SA_PRIVATE_KEY   private_key akun layanan tersebut
 * Kalender dibagikan kepada GOOGLE_CALENDAR_SA_EMAIL dengan izin "Buat
 * perubahan pada acara", dan Google Calendar API diaktifkan pada proyeknya.
 *
 * Sengaja TIDAK memakai GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY: akun itu
 * milik layanan lain (Drive). Tidak ada jatuh-balik ke sana, supaya kalender
 * tidak pernah diam-diam berjalan dengan akun yang salah.
 *
 * Selama ketiga pengaturan di atas belum lengkap, seluruh fungsi di sini diam
 * — tidak ada galat dan tidak ada panggilan ke Google.
 *
 * Aman diulang: ID acara diturunkan dari nomor jadwal, dan hanya acara yang
 * bertanda milik aplikasi ini yang pernah diubah atau dihapus. Acara lain di
 * kalender yang sama tidak disentuh.
 */

import { hariIniWita } from "../src/lib/plh.js";
import { idAcara, isiAcara, perluAda, PENANDA } from "../src/lib/kalender.js";

const CAL_ID   = () => process.env.GOOGLE_CALENDAR_ID;
const SA_EMAIL = () => process.env.GOOGLE_CALENDAR_SA_EMAIL;
const SA_KEY   = () => process.env.GOOGLE_CALENDAR_SA_PRIVATE_KEY;
const SUPA_URL = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_KEY = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export const kalenderAktif = () => !!(CAL_ID() && SA_EMAIL() && SA_KEY());

// ── Token Google (cara yang sama dengan api/drive.js, cakupan kalender saja) ────
const b64u = (x) => Buffer.from(typeof x === "string" ? Buffer.from(x, "utf8") : x)
  .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
let _tok = null, _tokExp = 0;
async function token() {
  const now = Math.floor(Date.now() / 1000);
  if (_tok && now < _tokExp - 60) return _tok;
  const pem = SA_KEY().replace(/\\n/g, "\n");
  const raw = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const kunci = await crypto.subtle.importKey("pkcs8", Buffer.from(raw, "base64"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const pesan = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + b64u(JSON.stringify({
    iss: SA_EMAIL(), scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }));
  const ttd = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", kunci, Buffer.from(pesan));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: pesan + "." + b64u(new Uint8Array(ttd)) }),
  });
  if (!r.ok) throw new Error("Token Google gagal: " + (await r.text()).slice(0, 300));
  const d = await r.json();
  _tok = d.access_token; _tokExp = now + d.expires_in;
  return _tok;
}

async function gcal(method, jalur, body) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL_ID())}/${jalur}`;
  return fetch(url, {
    method,
    headers: { Authorization: "Bearer " + await token(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const galat = async (r, apa) => new Error(`${apa} → ${r.status} ${(await r.text()).slice(0, 300)}`);

// ── Operasi dasar ─────────────────────────────────────────────────
/**
 * Membuat atau memperbarui acara untuk satu jadwal.
 *
 * Diperbarui lebih dulu; bila belum ada (404) baru dibuat. Acara yang pernah
 * dihapus tetap tercatat Google dengan ID yang sama, sehingga pembuatan ulang
 * ditolak (409) — pembaruan dengan status "confirmed" memulihkannya.
 */
export async function simpanAcara(ev) {
  const id = idAcara(ev.id);
  const isi = { id, ...isiAcara(ev) };
  let r = await gcal("PUT", `events/${id}`, isi);
  if (r.status === 404) {
    r = await gcal("POST", "events", isi);
    if (r.status === 409) r = await gcal("PUT", `events/${id}`, isi);
  }
  if (!r.ok) throw await galat(r, `simpan ${id}`);
  return "disimpan";
}

export async function hapusAcara(idJadwal) {
  const id = idAcara(idJadwal);
  const r = await gcal("DELETE", `events/${id}`);
  if (r.ok || r.status === 404 || r.status === 410) return r.ok ? "dihapus" : "tidak ada";
  throw await galat(r, `hapus ${id}`);
}

// ── Supabase ──────────────────────────────────────────────────────
async function sb(jalur) {
  const r = await fetch(`${SUPA_URL()}/rest/v1/${jalur}`, { headers: { apikey: SUPA_KEY(), Authorization: `Bearer ${SUPA_KEY()}` } });
  if (!r.ok) throw new Error(`Supabase ${jalur.split("?")[0]} → ${r.status}`);
  return r.json();
}

// ── Sinkron satu jadwal (dipanggil aplikasi seketika) ─────────────
/**
 * Menyamakan kalender dengan KEADAAN TERSIMPAN satu jadwal. Data diambil dari
 * basis data, bukan dari kiriman peramban, sehingga permintaan ini tidak
 * dapat dipakai menyisipkan isi apa pun ke kalender.
 */
export async function sinkronSatu(idJadwal) {
  if (!kalenderAktif()) return { nonaktif: true };
  const hariIni = hariIniWita();
  const ev = (await sb(`jadwal?id=eq.${encodeURIComponent(idJadwal)}&select=data`))?.[0]?.data;
  if (ev && perluAda(ev, hariIni)) return { hasil: await simpanAcara(ev) };
  // Acara yang sudah lewat dibiarkan sebagai catatan; yang lain dicabut.
  if (ev && typeof ev.tanggal === "string" && ev.tanggal < hariIni) return { hasil: "lampau, dibiarkan" };
  return { hasil: await hapusAcara(idJadwal) };
}

// ── Pencocokan menyeluruh (dipanggil cron) ────────────────────────
/**
 * Menambal setiap selisih antara basis data dan kalender untuk hari ini ke
 * depan: yang belum ada dibuat, yang berubah diperbarui, yang tidak lagi
 * semestinya ada dicabut. Pengiriman seketika yang sempat gagal tertutup di
 * sini, begitu pula agenda yang dibuat peladen lain (mis. dari permohonan
 * tamu).
 */
export async function rekonsiliasi() {
  if (!kalenderAktif()) return { nonaktif: true };
  const hariIni = hariIniWita();

  const jadwal = [];
  for (let dari = 0; ; ) {
    const hal = await sb(`jadwal?select=data&data->>tanggal=gte.${hariIni}&order=id&limit=1000&offset=${dari}`);
    jadwal.push(...hal.map((x) => x.data).filter(Boolean));
    if (!hal.length) break;
    dari += hal.length;
  }
  const semestinya = new Map(jadwal.filter((ev) => perluAda(ev, hariIni)).map((ev) => [idAcara(ev.id), ev]));

  const ada = new Map();
  for (let halaman = null; ; ) {
    const q = new URLSearchParams({
      privateExtendedProperty: `${PENANDA}=1`, timeMin: `${hariIni}T00:00:00+08:00`,
      singleEvents: "true", showDeleted: "false", maxResults: "2500",
    });
    if (halaman) q.set("pageToken", halaman);
    const r = await gcal("GET", `events?${q}`);
    if (!r.ok) throw await galat(r, "daftar acara");
    const d = await r.json();
    for (const a of d.items || []) ada.set(a.id, a.extendedProperties?.private?.sidik);
    if (!(halaman = d.nextPageToken)) break;
  }

  const hasil = { dibuat: 0, diperbarui: 0, tetap: 0, dicabut: 0, gagal: 0 };
  for (const [id, ev] of semestinya) {
    const sidikBaru = isiAcara(ev).extendedProperties.private.sidik;
    if (ada.get(id) === sidikBaru) { hasil.tetap++; continue; }
    try { await simpanAcara(ev); ada.has(id) ? hasil.diperbarui++ : hasil.dibuat++; }
    catch (e) { hasil.gagal++; console.error("[kalender]", e.message); }
  }
  for (const id of ada.keys()) {
    if (semestinya.has(id)) continue;
    try { await gcal("DELETE", `events/${id}`); hasil.dicabut++; }
    catch (e) { hasil.gagal++; console.error("[kalender]", e.message); }
  }
  return hasil;
}
