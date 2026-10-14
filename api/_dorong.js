// api/_dorong.js — notifikasi aplikasi (web push) kepada pemegang jabatan.
//
// Berawalan garis bawah = modul, bukan fungsi Vercel. CommonJS seperti
// _sesi.js supaya dapat dimuat api/*.js maupun api/*.mjs.
//
// Dipakai peringatan Monitor WA: perangkat Fonnte terputus atau WA gagal
// beruntun → Admin RK, Kasubbag Protokol, dan Kabag (beserta PLH yang sedang
// berlaku) diberi tahu. Satu jenis peringatan paling sering sekali per jam,
// dicatat di pengaturan_aplikasi (kunci "wa_peringatan").

const webpush = require("web-push");
const { peranDipegang } = require("./_sesi.js");

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || "";
const H = (prefer) => ({
  "Content-Type": "application/json", apikey: SUPA_KEY,
  Authorization: "Bearer " + SUPA_KEY, ...(prefer ? { Prefer: prefer } : {}),
});

const PERAN_PEMANTAU_WA = ["admin_rk", "kasubbag_protokol", "kabag"];
const JEDA_PERINGATAN_MS = 60 * 60 * 1000;

async function sbGet(path) {
  const r = await fetch(SUPA_URL + "/rest/v1/" + path, { headers: H() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** Kirim push ke semua pengguna aktif yang memegang salah satu `daftarPeran`. */
async function pushKePeran(daftarPeran, notif) {
  const VPUB = process.env.VAPID_PUBLIC, VPRIV = process.env.VAPID_PRIVATE;
  if (!VPUB || !VPRIV || !SUPA_URL || !SUPA_KEY) return 0;
  webpush.setVapidDetails(process.env.VAPID_EMAIL || "mailto:prokopim@tarakankota.go.id", VPUB, VPRIV);
  const users = await sbGet("users?select=username,role,plh_untuk,plh_mulai,plh_selesai,disabled");
  const nama = (users || [])
    .filter((u) => !u.disabled && peranDipegang(u).some((p) => daftarPeran.includes(p)))
    .map((u) => encodeURIComponent(u.username));
  if (!nama.length) return 0;
  const subs = await sbGet("push_subscriptions?select=subscription&username=in.(" + nama.join(",") + ")");
  const payload = JSON.stringify({ title: notif.title, body: notif.body, url: notif.url || "/", tag: notif.tag || "monitor-wa" });
  let n = 0;
  for (const s of subs || []) {
    try { await webpush.sendNotification(s.subscription, payload); n++; } catch { /* langganan basi */ }
  }
  return n;
}

/**
 * Peringatan Monitor WA ke Admin RK, Kasubbag Protokol, Kabag (+PLH).
 * `kunci` membedakan jenis peringatan (mis. "perangkat_putus", "gagal_beruntun");
 * jenis yang sama tidak dikirim ulang dalam satu jam.
 */
async function peringatkanAdmin(kunci, notif) {
  if (!SUPA_URL || !SUPA_KEY) return false;
  let catatan = {};
  try {
    const r = await sbGet("pengaturan_aplikasi?kunci=eq.wa_peringatan&select=nilai");
    catatan = (r && r[0] && r[0].nilai) || {};
  } catch { /* tabel belum ada → tetap kirim */ }
  const terakhir = Date.parse(catatan[kunci] || "");
  if (Number.isFinite(terakhir) && Date.now() - terakhir < JEDA_PERINGATAN_MS) return false;
  try {
    await fetch(SUPA_URL + "/rest/v1/pengaturan_aplikasi?on_conflict=kunci", {
      method: "POST", headers: H("resolution=merge-duplicates,return=minimal"),
      body: JSON.stringify({ kunci: "wa_peringatan", nilai: { ...catatan, [kunci]: new Date().toISOString() }, diubah_oleh: "sistem", diubah_pada: new Date().toISOString() }),
    });
  } catch { /* abaikan */ }
  try { await pushKePeran(PERAN_PEMANTAU_WA, { ...notif, url: "/?tab=monitor_wa", tag: "monitor-wa-" + kunci }); }
  catch (e) { console.warn("[peringatan WA]", e && e.message); }
  return true;
}

module.exports = { pushKePeran, peringatkanAdmin, PERAN_PEMANTAU_WA };
