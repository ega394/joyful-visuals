// ============================================================
// FILE: /api/notif-departure.js  — BARU (Tugas 2)
// FUNGSI: Cron job — cek agenda yang mendekati waktu keberangkatan
//         dan kirim Push Notification ke role terkait
//
// LOGIKA:
//   Untuk setiap agenda hari ini:
//   1. Hitung waktu tempuh dari lokasi terakhir ke lokasi agenda (Google Maps)
//   2. Waktu berangkat ideal = jam_acara - waktu_tempuh - 15 menit (persiapan)
//   3. Jika waktu sekarang berada dalam jendela ±2 menit dari waktu berangkat → KIRIM PUSH
//
// JADWAL (tambahkan di vercel.json):
//   { "path": "/api/notif-departure", "schedule": "* 0-14 * * 1-5" }
//   → Berjalan setiap menit, Senin–Jumat, jam 07:00–22:00 WITA
//     (WITA = UTC+8, jadi di vercel: jam 23:00–14:00 UTC)
//
// CATATAN: Vercel Cron minimum interval = 1 menit (hanya Pro plan)
//          Untuk Free plan, gunakan interval 5 menit dan cek jendela ±5 menit
// ============================================================

const webpush  = require("web-push");
const { getDistance } = require("./distance");

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPA_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const VAPID_EMAIL   = process.env.VAPID_EMAIL || "mailto:prokopim@tarakankota.go.id";

// Kantor Wali Kota Tarakan sebagai titik awal default
const DEFAULT_ORIGIN = process.env.DEFAULT_ORIGIN || "-3.3265,117.5789";

// Jendela toleransi waktu (menit) — kirim notif jika selisih waktu dalam rentang ini
const WINDOW_MINUTES = 2;

// Waktu persiapan tetap sebelum berangkat (menit)
const PREP_MINUTES = 15;

const H = () => ({
  "Content-Type": "application/json",
  "apikey": SUPA_KEY,
  "Authorization": "Bearer " + SUPA_KEY,
});

async function getJadwalHariIni() {
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = SUPA_URL + "/rest/v1/jadwal?select=data&order=id";
  const r = await fetch(url, { headers: H() });
  if (!r.ok) throw new Error("Gagal ambil jadwal: " + r.status);
  return (await r.json())
    .map(x => x.data)
    .filter(ev =>
      ev &&
      ev.tanggal === today &&
      ev.alur === "disetujui" &&
      !ev.tersembunyi
    );
}

async function getPushSubs(role) {
  const url = SUPA_URL + "/rest/v1/push_subscriptions?select=subscription,username,role"
    + (role ? "&role=eq." + encodeURIComponent(role) : "");
  const r = await fetch(url, { headers: H() });
  return r.ok ? await r.json() : [];
}

async function deleteSub(endpoint) {
  await fetch(
    SUPA_URL + "/rest/v1/push_subscriptions?endpoint=eq." + encodeURIComponent(endpoint),
    { method: "DELETE", headers: H() }
  );
}

async function getAlreadyNotified(agendaId) {
  // Cek tabel departure_notif_log agar tidak kirim duplikat
  const url = SUPA_URL + "/rest/v1/departure_notif_log?agenda_id=eq." + encodeURIComponent(agendaId);
  const r = await fetch(url, { headers: H() });
  if (!r.ok) return false;
  const rows = await r.json();
  return rows.length > 0;
}

async function markNotified(agendaId, agendaName) {
  await fetch(SUPA_URL + "/rest/v1/departure_notif_log", {
    method: "POST",
    headers: { ...H(), "Prefer": "resolution=ignore-duplicates" },
    body: JSON.stringify({
      agenda_id:   agendaId,
      agenda_name: agendaName,
      notified_at: new Date().toISOString(),
    }),
  });
}

async function sendPush(subscription, payload) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (e) {
    if (e.statusCode === 410 || e.statusCode === 404) {
      await deleteSub(subscription.endpoint).catch(() => {});
    }
    return false;
  }
}

module.exports = async function handler(req, res) {
  // Hanya boleh dipanggil oleh Vercel Cron atau manual dengan CRON_SECRET
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  const cronSecret   = process.env.CRON_SECRET || "";
  const authHeader   = req.headers["authorization"] || "";
  const isManual     = cronSecret && authHeader === "Bearer " + cronSecret;

  if (!isVercelCron && !isManual) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ error: "Supabase env belum diset" });
  }

  try {
    const nowUTC      = Date.now();
    // Waktu sekarang dalam WITA (UTC+8)
    const nowWITA     = new Date(nowUTC + 8 * 60 * 60 * 1000);
    const nowMinutes  = nowWITA.getHours() * 60 + nowWITA.getMinutes();

    const events = await getJadwalHariIni();
    const results = [];

    for (const ev of events) {
      if (!ev.jam || !ev.id) continue;

      // Parse jam acara → dalam menit sejak tengah malam
      const [jamH, jamM] = ev.jam.split(":").map(Number);
      const eventMinutes = jamH * 60 + jamM;

      // Tentukan origin: gunakan koordinat lokasi sebelumnya jika ada,
      // fallback ke Kantor Wali Kota
      const origin = ev.originLat && ev.originLng
        ? `${ev.originLat},${ev.originLng}`
        : DEFAULT_ORIGIN;

      // Tentukan destination: gunakan koordinat lokasi acara jika ada,
      // fallback ke nama lokasi (Google Maps bisa resolve nama)
      const destination = ev.lat && ev.lng
        ? `${ev.lat},${ev.lng}`
        : ev.lokasi || "";

      if (!destination) continue;

      // Hitung waktu tempuh (dengan cache agar tidak terlalu banyak API call)
      let durationMinutes = ev.cachedDurationMinutes || null;

      if (durationMinutes === null) {
        try {
          const dist = await getDistance(origin, destination);
          durationMinutes = Math.ceil(dist.durationValue / 60);

          // Simpan cache ke agenda agar tidak hitung ulang
          await fetch(SUPA_URL + "/rest/v1/jadwal?id=eq." + ev.id, {
            method: "PATCH",
            headers: { ...H(), "Prefer": "return=minimal" },
            body: JSON.stringify({
              data: { ...ev, cachedDurationMinutes: durationMinutes }
            }),
          });
        } catch (distErr) {
          console.warn("[departure] Gagal hitung jarak untuk:", ev.namaAcara, distErr.message);
          durationMinutes = 30; // fallback: asumsi 30 menit
        }
      }

      // Hitung waktu ideal keberangkatan
      // Formula: jam_acara - waktu_tempuh - 15 menit persiapan
      const departureMinutes = eventMinutes - durationMinutes - PREP_MINUTES;

      // Cek apakah sekarang dalam jendela ±WINDOW_MINUTES dari waktu berangkat
      const diff = Math.abs(nowMinutes - departureMinutes);
      if (diff > WINDOW_MINUTES) continue;

      // Cek apakah sudah pernah dikirim notif untuk agenda ini hari ini
      const alreadySent = await getAlreadyNotified(ev.id);
      if (alreadySent) continue;

      // Format pesan
      const jamAcara = ev.jam;
      const etaText  = durationMinutes + " menit";
      const title    = "🚗 Saatnya Berangkat!";
      const body     = `${ev.namaAcara} pukul ${jamAcara} WITA\n📍 ${ev.lokasi || "—"}\n🕐 Estimasi perjalanan: ${etaText}`;

      // Kirim ke semua role terkait
      const targetRoles = [];
      if ((ev.untukPimpinan || []).includes("walikota")) {
        targetRoles.push("ajudan_walikota", "walikota");
      }
      if ((ev.untukPimpinan || []).includes("wakilwalikota") || ev.delegasiKeWWK) {
        targetRoles.push("ajudan_wakilwalikota", "wakilwalikota");
      }
      // Personil yang bertugas
      if (ev.personil?.length) {
        targetRoles.push(...ev.personil.map(un => "personil:" + un));
      }

      let totalSent = 0;

      for (const roleOrPersonil of [...new Set(targetRoles)]) {
        // Jika format "personil:username", ambil sub berdasarkan username
        const isPersonil = roleOrPersonil.startsWith("personil:");
        const subs = isPersonil
          ? await (async () => {
              const username = roleOrPersonil.replace("personil:", "");
              const url = SUPA_URL + "/rest/v1/push_subscriptions?select=subscription&username=eq." + encodeURIComponent(username);
              const r = await fetch(url, { headers: H() });
              return r.ok ? await r.json() : [];
            })()
          : await getPushSubs(roleOrPersonil);

        for (const row of subs) {
          const ok = await sendPush(row.subscription, {
            title,
            body,
            url:     "/agenda/" + ev.id,   // ✅ click-to-redirect ke detail agenda
            agendaId: ev.id,
            tag:     "departure-" + ev.id,
            requireInteraction: true,       // Notif tidak hilang sendiri
            icon:  "/pwa-192x192.png",
            badge: "/icon-72x72.png",
          });
          if (ok) totalSent++;
        }
      }

      // Catat di log agar tidak kirim duplikat
      await markNotified(ev.id, ev.namaAcara);

      results.push({
        agendaId:   ev.id,
        namaAcara:  ev.namaAcara,
        jam:        jamAcara,
        lokasi:     ev.lokasi,
        eta:        etaText,
        pushSent:   totalSent,
      });
    }

    console.log("[notif-departure] Selesai. Notif dikirim:", results.length, "agenda");
    return res.status(200).json({ ok: true, triggered: results.length, results });

  } catch (err) {
    console.error("[notif-departure] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
