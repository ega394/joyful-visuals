// api/_proyek.mjs — apakah fungsi ini berjalan di proyek Vercel resmi?
//
// Repo yang sama pernah ditayangkan dua proyek Vercel: jadwal-pimpinan (resmi,
// prokopim.tarakankota.go.id) dan joyfulprokopim (lama). Jadwal di vercel.json
// ikut berjalan di keduanya, dan kunci "sudah terkirim hari ini" di
// notif_daily_log dipakai bersama — proyek lama yang jalan lebih dulu dengan
// token Fonnte basi "memakan" jatah hari itu sehingga proyek resmi melewatinya
// (Oktober 2026: briefing pimpinan dan rekap ajudan gagal setiap hari).
//
// Tanda yang dipakai, berurutan:
//  1. VERCEL_PROJECT_PRODUCTION_URL — variabel sistem Vercel (domain kustom
//     terpendek proyek, atau domain vercel.app bila tidak ada).
//  2. VERCEL_URL dan Host permintaan — dipakai bila (1) tidak tersedia. Variabel
//     sistem hanya ada bila "Automatically expose System Environment Variables"
//     aktif; proyek lama ternyata tidak, sehingga dulu dianggap resmi dan tetap
//     mengirim WA dengan token basi ('unknown token', Oktober–November 2026).
// Nama proyek lama di tanda mana pun selalu berarti bukan resmi. Tanpa tanda
// apa pun (uji lokal, bukan Vercel) fungsi dianggap resmi agar tidak terhenti.

export const DOMAIN_RESMI = "prokopim.tarakankota.go.id";
const PROYEK_LAMA = "joyfulprokopim";

const bersih = (v) => String(v || "").toLowerCase().trim().replace(/^https?:\/\//, "").replace(/[/:].*$/, "");
const domainResmi = (d) => d === DOMAIN_RESMI || d.endsWith(".tarakankota.go.id") || d.startsWith("jadwal-pimpinan");

export function proyekResmi(env = process.env, host = "") {
  const prod = bersih(env && env.VERCEL_PROJECT_PRODUCTION_URL);
  const lain = [bersih(env && env.VERCEL_URL), bersih(host)].filter(Boolean);
  if ([prod, ...lain].some((d) => d && d.includes(PROYEK_LAMA))) return false;
  if (prod) return domainResmi(prod);
  const vercel = lain.find((d) => d !== "localhost" && d !== "127.0.0.1");
  if (vercel) return domainResmi(vercel);
  return true;
}
