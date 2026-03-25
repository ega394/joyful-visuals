// api/distance.js
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

async function getDistance(origin, destination) {
  // Jika titik awal kosong, kita set default dari markas Bapak
  const start = origin || "Kantor Wali Kota Tarakan, Kalimantan Utara";
  const end = destination;

  // Jika tujuan tidak diisi di agenda, beri nilai default 30 menit
  if (!end) {
    return { durationValue: 30 * 60 }; 
  }

  // Jika kunci Google belum dipasang, gunakan default 30 menit agar tidak crash
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn("Kunci Google Maps belum ada. Pakai asumsi 30 menit.");
    return { durationValue: 30 * 60 };
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(start)}&destinations=${encodeURIComponent(end)}&key=${GOOGLE_MAPS_API_KEY}&language=id`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.rows[0].elements[0].status === "OK") {
      // Mengambil waktu tempuh dalam satuan detik
      const durationInSeconds = data.rows[0].elements[0].duration.value;
      return { durationValue: durationInSeconds };
    } else {
      console.error("Google Maps API Error:", data.status);
      return { durationValue: 30 * 60 }; // Fallback jika rute tidak ditemukan
    }
  } catch (error) {
    console.error("Gagal menghubungi Google Maps:", error);
    return { durationValue: 30 * 60 }; // Fallback jika server error
  }
}

module.exports = { getDistance };
