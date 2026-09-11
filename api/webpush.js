// api/webpush.js — Vercel Serverless: simpan subscription & kirim push
// Requires: npm install web-push (tambah ke package.json)
const webpush = require("web-push");
const { guard } = require("./_middleware");

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const VAPID_EMAIL   = process.env.VAPID_EMAIL || "mailto:prokopim@tarakankota.go.id";
const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supaHeaders = () => ({
  "Content-Type": "application/json",
  "apikey": SUPA_KEY,
  "Authorization": "Bearer " + SUPA_KEY,
});

// Simpan/ambil subscription dari tabel Supabase 'push_subscriptions'
//
// `username` didahulukan atas `role`. Notifikasi yang menyapa satu orang
// — "Anda Ditugaskan", "Jadwal Disetujui" — sebelumnya dikirim ke SELURUH
// pemegang peran, karena hanya penyaringan peran yang tersedia di sini.
// Kolom username sudah ada di tabel sejak awal; hanya penyaringnya yang
// belum pernah dipakai.
const PILIH_SUB = "select=endpoint,subscription,role,username";

// PLH yang sedang mengampu `role` hari ini.
//
// Masa berlakunya disaring lewat kueri, bukan lewat src/lib/plh.js, supaya
// berkas ini tetap CommonJS murni. Aturannya sama: rentang tanggal inklusif di
// kedua ujung, menurut WITA (UTC+8).
async function pengampuJabatan(role) {
  const hari = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  try {
    const r = await fetch(
      SUPA_URL + "/rest/v1/users?select=username" +
      "&plh_untuk=eq." + encodeURIComponent(role) +
      "&plh_mulai=lte." + hari + "&plh_selesai=gte." + hari +
      "&disabled=not.is.true",
      { headers: supaHeaders() }
    );
    return r.ok ? await r.json() : [];
  } catch { return []; }   // kolom PLH belum ada → berjalan seperti semula
}

async function getSubs(role, username) {
  let url = SUPA_URL + "/rest/v1/push_subscriptions?" + PILIH_SUB;
  if (username)  url += "&username=eq." + encodeURIComponent(username);
  else if (role) url += "&role=eq." + encodeURIComponent(role);
  const r = await fetch(url, { headers: supaHeaders() });
  const subs = r.ok ? await r.json() : [];

  // Notifikasi yang ditujukan ke sebuah JABATAN harus sampai ke pengampunya.
  // `push_subscriptions.role` berisi peran ASLI pemasang langganan, sehingga
  // tanpa tambahan ini seorang PLH tidak pernah diberi tahu ada jadwal yang
  // menunggu diputus — antrian macet tanpa seorang pun menyadarinya, yang
  // justru keadaan yang hendak dicegah PLH.
  //
  // Ditambahkan DI ATAS hasil pencocokan peran, tidak menggantikannya: PLH
  // tetap menerima notifikasi jabatannya sendiri.
  if (!username && role) {
    const plh = await pengampuJabatan(role);
    if (plh.length) {
      const daftar = plh.map(u => encodeURIComponent(u.username)).join(",");
      const r2 = await fetch(
        SUPA_URL + "/rest/v1/push_subscriptions?" + PILIH_SUB + "&username=in.(" + daftar + ")",
        { headers: supaHeaders() }
      ).catch(() => null);
      const tambahan = (r2 && r2.ok) ? await r2.json() : [];
      // Satu perangkat bisa terjaring dua kali bila peran aslinya kebetulan sama.
      const sudah = new Set(subs.map(s => s.endpoint));
      for (const s of tambahan) if (!sudah.has(s.endpoint)) { sudah.add(s.endpoint); subs.push(s); }
    }
  }
  return subs;
}

async function saveSub(sub, username, role) {
  const endpoint = sub.endpoint;
  // Upsert: pakai endpoint sebagai key unik
  await fetch(SUPA_URL + "/rest/v1/push_subscriptions", {
    method: "POST",
    headers: { ...supaHeaders(), "Prefer": "resolution=merge-duplicates" },
    body: JSON.stringify({ endpoint, subscription: sub, username, role }),
  });
}

async function deleteSub(endpoint) {
  await fetch(SUPA_URL + "/rest/v1/push_subscriptions?endpoint=eq." + encodeURIComponent(endpoint), {
    method: "DELETE",
    headers: supaHeaders(),
  });
}

module.exports = async (req, res) => {
  // Rate limit: 60 push per menit per IP
  const g = guard(req, res, { requireSecret: false, maxPerMin: 60 });
  if (g) return;

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return res.status(500).json({ error: "VAPID keys belum diset di Vercel env" });
  }

  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

  // GET /api/webpush → kembalikan public key untuk subscribe di frontend
  if (req.method === "GET") {
    return res.status(200).json({ publicKey: VAPID_PUBLIC });
  }

  // POST /api/webpush — dua fungsi: subscribe atau send
  if (req.method === "POST") {
    const { action, subscription, username, role, notify } = req.body || {};

    // ── SUBSCRIBE: simpan subscription ──
    if (action === "subscribe") {
      if (!subscription || !username || !role) {
        return res.status(400).json({ error: "Butuh subscription, username, role" });
      }
      await saveSub(subscription, username, role);
      return res.status(200).json({ ok: true });
    }

    // ── UNSUBSCRIBE ──
    if (action === "unsubscribe") {
      if (!subscription?.endpoint) return res.status(400).json({ error: "Butuh endpoint" });
      await deleteSub(subscription.endpoint);
      return res.status(200).json({ ok: true });
    }

    // ── SEND: kirim push ke role tertentu ──
    if (action === "send" && notify) {
      const { title, body, url, targetRole, targetUser, tag } = notify;
      // Tanpa sasaran sama sekali, getSubs() akan mengambil SELURUH langganan
      // dan menyiarkannya ke semua orang. Ditolak, bukan dibiarkan lolos.
      if (!targetUser && !targetRole) {
        return res.status(400).json({ error: "Butuh targetUser atau targetRole" });
      }
      const subs = await getSubs(targetRole, targetUser);
      if (!subs.length) return res.status(200).json({ ok: true, sent: 0 });

      const payload = JSON.stringify({ title, body, url: url || "/", tag: tag || "prokopim" });
      let sent = 0; let failed = 0;

      await Promise.all(subs.map(async row => {
        try {
          await webpush.sendNotification(row.subscription, payload);
          sent++;
        } catch (e) {
          // Subscription kadaluarsa / tidak valid → hapus
          if (e.statusCode === 410 || e.statusCode === 404) {
            await deleteSub(row.subscription?.endpoint || "").catch(() => {});
          }
          failed++;
        }
      }));

      return res.status(200).json({ ok: true, sent, failed });
    }

    return res.status(400).json({ error: "action tidak dikenal" });
  }

  // DELETE /api/webpush — hapus subscription
  if (req.method === "DELETE") {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: "Butuh endpoint" });
    await deleteSub(endpoint);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
