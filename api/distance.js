// ============================================================
// FILE: /api/distance.js  — BARU (Tugas 2)
// FUNGSI: Hitung jarak & waktu tempuh via Google Maps Distance Matrix API
//         Dipanggil oleh: notif-cron.js saat memproses agenda
//
// ENDPOINT: POST /api/distance
// BODY: { origin: "lat,lng" atau nama tempat, destination: "lat,lng" atau nama tempat }
// RETURN: { distanceText, distanceValue (meter), durationText, durationValue (detik) }
// ============================================================

const { guard } = require("./_middleware");

const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

/**
 * Hitung jarak dan waktu tempuh dari A ke B menggunakan mobil
 * @param {string} origin      - "lat,lng" atau nama lokasi
 * @param {string} destination - "lat,lng" atau nama lokasi
 * @returns {{ distanceText, distanceValue, durationText, durationValue }}
 */
async function getDistance(origin, destination) {
  if (!MAPS_KEY) throw new Error("GOOGLE_MAPS_API_KEY belum diset di Vercel.");

  const params = new URLSearchParams({
    origins:      origin,
    destinations: destination,
    mode:         "driving",          // Mobil
    language:     "id",               // Bahasa Indonesia
    key:          MAPS_KEY,
  });

  const url = "https://maps.googleapis.com/maps/api/distancematrix/json?" + params;
  const r = await fetch(url);
  const data = await r.json();

  if (data.status !== "OK") {
    throw new Error("Google Maps error: " + data.status + " — " + (data.error_message || ""));
  }

  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    throw new Error("Rute tidak ditemukan antara: " + origin + " → " + destination);
  }

  return {
    distanceText:  element.distance.text,            // contoh: "12,3 km"
    distanceValue: element.distance.value,           // dalam meter
    durationText:  element.duration.text,            // contoh: "25 menit"
    durationValue: element.duration.value,           // dalam detik
  };
}

module.exports = async (req, res) => {
  const g = guard(req, res, { requireSecret: true, maxPerMin: 100 });
  if (g) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Gunakan method POST" });
  }

  const { origin, destination } = req.body || {};

  if (!origin || !destination) {
    return res.status(400).json({
      error: "Butuh: origin dan destination",
      contoh: { origin: "-3.3265,117.5789", destination: "Kantor Wali Kota Tarakan" }
    });
  }

  try {
    const result = await getDistance(origin, destination);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error("[distance] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

// Export fungsi agar bisa diimport oleh notif-cron.js
module.exports.getDistance = getDistance;
