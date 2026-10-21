// api/_proyek.mjs — apakah fungsi ini berjalan di proyek Vercel resmi?
//
// Repo yang sama pernah ditayangkan dua proyek Vercel: jadwal-pimpinan (resmi,
// prokopim.tarakankota.go.id) dan joyfulprokopim (lama). Jadwal di vercel.json
// ikut berjalan di keduanya, dan kunci "sudah terkirim hari ini" di
// notif_daily_log dipakai bersama — proyek lama yang jalan lebih dulu dengan
// token Fonnte basi "memakan" jatah hari itu sehingga proyek resmi melewatinya
// (Oktober 2026: briefing pimpinan dan rekap ajudan gagal setiap hari).
//
// VERCEL_PROJECT_PRODUCTION_URL adalah variabel sistem Vercel: domain kustom
// terpendek proyek, atau domain vercel.app bila tidak ada. Bila tidak tersedia
// (uji lokal, bukan Vercel) fungsi dianggap resmi agar tidak ada yang terhenti.

export const DOMAIN_RESMI = "prokopim.tarakankota.go.id";

export function proyekResmi(env = process.env) {
  const url = String((env && env.VERCEL_PROJECT_PRODUCTION_URL) || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!url) return true;
  return url === DOMAIN_RESMI || url.endsWith(".tarakankota.go.id") || url.startsWith("jadwal-pimpinan");
}
