// ============================================================
//  /api/jarak.js — Estimasi Jarak & Durasi Perjalanan
//  Menggunakan Google Maps Distance Matrix API (server-side)
//  ENV: GOOGLE_MAPS_API_KEY
// ============================================================

const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

// Titik keberangkatan default: Kantor Wali Kota Tarakan
const ORIGIN_DEFAULT = "Jalan Kalimantan No.1, Kota Tarakan, Kalimantan Utara";

export default async function handler(req, res) {
  // Allow GET dan POST
  const destination =
    req.query?.destination ||
    req.body?.destination ||
    "";

  const origin =
    req.query?.origin ||
    req.body?.origin ||
    ORIGIN_DEFAULT;

  if (!destination) {
    return res.status(400).json({ error: "destination wajib diisi" });
  }

  if (!MAPS_KEY) {
    return res.status(500).json({ error: "GOOGLE_MAPS_API_KEY belum diset" });
  }

  // Tambahkan "Kota Tarakan" jika tidak disebutkan agar hasil Maps lebih akurat
  const dest = /tarakan|kaltara|kalimantan/i.test(destination)
    ? destination
    : destination + ", Kota Tarakan, Kalimantan Utara";

  const url =
    "https://maps.googleapis.com/maps/api/distancematrix/json" +
    "?origins=" + encodeURIComponent(origin) +
    "&destinations=" + encodeURIComponent(dest) +
    "&mode=driving" +
    "&language=id" +
    "&region=ID" +
    "&key=" + MAPS_KEY;

  try {
    const r = await fetch(url);
    const data = await r.json();

    if (data.status !== "OK") {
      return res.status(200).json({ ok: false, error: data.status });
    }

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") {
      return res.status(200).json({ ok: false, error: element?.status || "NO_RESULT" });
    }

    return res.status(200).json({
      ok: true,
      jarak:  element.distance?.text || "-",          // e.g. "4,2 km"
      durasi: element.duration?.text || "-",           // e.g. "12 menit"
      jarakM: element.distance?.value || 0,            // meter
      durasiS: element.duration?.value || 0,           // detik
      origin: data.origin_addresses?.[0] || origin,
      destination: data.destination_addresses?.[0] || dest,
    });
  } catch (err) {
    console.error("[api/jarak]", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
