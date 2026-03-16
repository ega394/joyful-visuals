// api/webpush.js — Vercel Serverless: simpan subscription & kirim push
// Requires: npm install web-push (tambah ke package.json)
const webpush = require("web-push");
const { guard } = require("./_middleware");

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const VAPID_EMAIL   = process.env.VAPID_EMAIL || "mailto:prokopim@tarakankota.go.id";
const SUPA_URL      = process.env.VITE_SUPABASE_URL;
const SUPA_KEY      = process.env.VITE_SUPABASE_ANON_KEY;

const supaHeaders = () => ({
  "Content-Type": "application/json",
  "apikey": SUPA_KEY,
  "Authorization": "Bearer " + SUPA_KEY,
});

// Simpan/ambil subscription dari tabel Supabase 'push_subscriptions'
async function getSubs(role) {
  const url = SUPA_URL + "/rest/v1/push_subscriptions?select=subscription,role"
    + (role ? "&role=eq." + role : "");
  const r = await fetch(url, { headers: supaHeaders() });
  return r.ok ? await r.json() : [];
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
      const { title, body, url, targetRole, tag } = notify;
      const subs = await getSubs(targetRole);
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
