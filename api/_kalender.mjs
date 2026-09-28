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
 *   GOOGLE_CALENDAR_ID      ID kalender tujuan — satu-satunya yang perlu ditambah
 *   GOOGLE_SA_EMAIL         sudah ada — akun layanan yang juga dipakai Drive
 *   GOOGLE_SA_PRIVATE_KEY   sudah ada
 * Kalender dibagikan kepada GOOGLE_SA_EMAIL dengan izin "Buat perubahan pada
 * acara", dan Google Calendar API diaktifkan pada proyek akun layanan itu.
 *
 * Pilihan: bila kelak ingin akun layanan tersendiri untuk kalender, isi
 * GOOGLE_CALENDAR_SA_EMAIL dan GOOGLE_CALENDAR_SA_PRIVATE_KEY — keduanya
 * diutamakan bila ada, tanpa perlu mengubah kode.
 *
 * Selama GOOGLE_CALENDAR_ID belum diisi, seluruh fungsi di sini diam — tidak
 * ada galat dan tidak ada panggilan ke Google.
 *
 * Aman diulang: ID acara diturunkan dari nomor jadwal, dan hanya acara yang
 * bertanda milik aplikasi ini yang pernah diubah. Acara lain di kalender yang
 * sama hanya disentuh dalam SATU keadaan: salinan manual lama (dari tombol
 * "Google Cal" dulu) yang tanggal, jam mulai, dan nama acaranya persis sama
 * dengan acara kiriman aplikasi — salinan itu dihapus agar tidak tampil dua
 * kali. Acara manual lain, dan semua acara lampau, dibiarkan.
 */

import { hariIniWita } from "../src/lib/plh.js";
import { idAcara, isiAcara, perluAda, PENANDA, kunciAgenda, kunciAcaraGoogle, pilihUnik } from "../src/lib/kalender.js";

const CAL_ID   = () => process.env.GOOGLE_CALENDAR_ID;
// Akun khusus kalender diutamakan bila keduanya diisi; bila tidak, akun
// layanan yang sudah ada. Pasangan tidak dicampur: surel dari satu akun dan
// kunci dari akun lain pasti ditolak Google.
const khusus   = () => !!(process.env.GOOGLE_CALENDAR_SA_EMAIL && process.env.GOOGLE_CALENDAR_SA_PRIVATE_KEY);
const SA_EMAIL = () => khusus() ? process.env.GOOGLE_CALENDAR_SA_EMAIL : process.env.GOOGLE_SA_EMAIL;
const SA_KEY   = () => khusus() ? process.env.GOOGLE_CALENDAR_SA_PRIVATE_KEY : process.env.GOOGLE_SA_PRIVATE_KEY;
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

async function hapusIdGoogle(id) {
  const r = await gcal("DELETE", `events/${encodeURIComponent(id)}`);
  if (r.ok || r.status === 404 || r.status === 410) return r.ok ? "dihapus" : "tidak ada";
  throw await galat(r, `hapus ${id}`);
}

export const hapusAcara = (idJadwal) => hapusIdGoogle(idAcara(idJadwal));

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
 *
 * Jadwal lain pada tanggal yang sama ikut dibaca: bila ada kembarannya,
 * hanya satu yang dikirim (yang paling awal diinput).
 */
export async function sinkronSatu(idJadwal) {
  if (!kalenderAktif()) return { nonaktif: true };
  const hariIni = hariIniWita();
  const ev = (await sb(`jadwal?id=eq.${encodeURIComponent(idJadwal)}&select=data`))?.[0]?.data;
  // Acara yang sudah lewat dibiarkan sebagai catatan.
  if (ev && typeof ev.tanggal === "string" && ev.tanggal < hariIni) return { hasil: "lampau, dibiarkan" };
  if (!ev) return { hasil: await hapusAcara(idJadwal) };

  const sehari = (await sb(`jadwal?select=data&data->>tanggal=eq.${encodeURIComponent(ev.tanggal)}`))
    .map((x) => x.data).filter((x) => x && String(x.id) !== String(ev.id));
  const kunci = kunciAgenda(ev);
  const [utama] = pilihUnik([...sehari, ev].filter((x) => perluAda(x, hariIni) && kunciAgenda(x) === kunci));

  if (!utama) return { hasil: await hapusAcara(ev.id) };
  if (String(utama.id) === String(ev.id)) {
    const hasil = await simpanAcara(ev);
    // Kembaran yang sempat terkirim (mis. sebelum jadwal ini disunting) dicabut.
    for (const x of sehari) if (kunciAgenda(x) === kunci) await hapusAcara(x.id);
    return { hasil };
  }
  // Jadwal ini kembaran: cukup kembarannya yang tampil.
  await hapusAcara(ev.id);
  await simpanAcara(utama);
  return { hasil: "kembar, diwakili " + utama.id };
}

// ── Pencocokan menyeluruh (dipanggil cron) ────────────────────────
/**
 * Menambal setiap selisih antara basis data dan kalender untuk hari ini ke
 * depan: yang belum ada dibuat, yang berubah diperbarui, yang tidak lagi
 * semestinya ada dicabut, dan salinan manual yang kembar dengan kiriman
 * aplikasi dihapus. Pengiriman seketika yang sempat gagal tertutup di sini,
 * begitu pula agenda yang dibuat peladen lain (mis. dari permohonan tamu).
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
  const semestinya = new Map(pilihUnik(jadwal.filter((ev) => perluAda(ev, hariIni))).map((ev) => [idAcara(ev.id), ev]));
  const idPerKunci = new Map([...semestinya].map(([id, ev]) => [kunciAgenda(ev), id]));

  // Seluruh acara kalender hari ini ke depan: milik aplikasi dan salinan manual.
  const ada = new Map(), manual = [];
  for (let halaman = null; ; ) {
    const q = new URLSearchParams({
      timeMin: `${hariIni}T00:00:00+08:00`, singleEvents: "true", showDeleted: "false", maxResults: "2500",
    });
    if (halaman) q.set("pageToken", halaman);
    const r = await gcal("GET", `events?${q}`);
    if (!r.ok) throw await galat(r, "daftar acara");
    const d = await r.json();
    for (const a of d.items || []) {
      const milik = a.extendedProperties?.private;
      if (milik?.[PENANDA] === "1") ada.set(a.id, milik.sidik);
      else manual.push(a);
    }
    if (!(halaman = d.nextPageToken)) break;
  }

  const hasil = { dibuat: 0, diperbarui: 0, tetap: 0, dicabut: 0, gandaDihapus: 0, gagal: 0 };
  const gagalSimpan = new Set();
  for (const [id, ev] of semestinya) {
    const sidikBaru = isiAcara(ev).extendedProperties.private.sidik;
    if (ada.get(id) === sidikBaru) { hasil.tetap++; continue; }
    try { await simpanAcara(ev); ada.has(id) ? hasil.diperbarui++ : hasil.dibuat++; }
    catch (e) { hasil.gagal++; gagalSimpan.add(id); console.error("[kalender]", e.message); }
  }
  for (const id of ada.keys()) {
    if (semestinya.has(id)) continue;
    try { await hapusIdGoogle(id); hasil.dicabut++; }
    catch (e) { hasil.gagal++; console.error("[kalender]", e.message); }
  }
  // Salinan manual dihapus hanya bila salinan otomatisnya pasti ada.
  for (const a of manual) {
    if (a.recurringEventId || a.status === "cancelled") continue;
    const idOtomatis = idPerKunci.get(kunciAcaraGoogle(a));
    if (!idOtomatis || gagalSimpan.has(idOtomatis)) continue;
    try { await hapusIdGoogle(a.id); hasil.gandaDihapus++; }
    catch (e) { hasil.gagal++; console.error("[kalender]", e.message); }
  }
  return hasil;
}
