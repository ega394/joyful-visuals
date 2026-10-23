// Pemuatan malas yang tahan pembaruan aplikasi.
//
// Setiap kali versi baru terpasang, nama berkas JS di /assets berganti
// (mis. pdfmake-ZrZWQz_J.js menjadi pdfmake-Ab12Cd34.js). Service worker
// memakai skipWaiting + cleanupOutdatedCaches, jadi begitu versi baru tiba,
// salinan berkas lama di HP ikut dibuang. Halaman yang masih terbuka sejak
// sebelum pembaruan tetap memegang nama berkas lama; ketika fitur yang
// dimuat belakangan (PDF undangan, pratinjau PDF, halaman tertentu) baru
// dipakai, berkas lama itu sudah tidak ada di peladen. Dulu Vercel
// membalasnya dengan index.html, dan pengguna melihat galat teknis
// "'text/html' is not a valid JavaScript MIME type" (21 Oktober 2026).
//
// Modul ini mengenali kejadian itu dan menggantinya dengan pesan yang bisa
// ditindaklanjuti: muat ulang halaman. Isian formulir menjadi tanggung jawab
// pemanggil (lihat UndanganGenerator: isian disimpan sebagai konsep dulu).

export const PESAN_BASI =
  "Aplikasi baru saja diperbarui. Muat ulang halaman, lalu coba lagi.";

// Pesan galat dari Chrome/Android, Safari/iOS, dan Firefox untuk modul yang
// gagal dimuat, ditambah galat preload Vite.
const POLA_BASI = new RegExp([
  "is not a valid JavaScript MIME type",
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "error loading dynamically imported module",
  "Unable to preload CSS",
  "Failed to load module script",
].join("|"), "i");

export function chunkBasi(e) {
  if (!e) return false;
  if (e.basi === true) return true;
  return POLA_BASI.test(String(e.message || e));
}

export function galatBasi(asal) {
  const g = new Error(PESAN_BASI);
  g.basi = true;
  if (asal) g.cause = asal;
  return g;
}

/** import() yang galat basinya diganti PESAN_BASI (ditandai `.basi = true`). */
export async function imporSegar(muat) {
  try {
    return await muat();
  } catch (e) {
    if (chunkBasi(e)) throw galatBasi(e);
    throw e;
  }
}

/**
 * fetch() untuk berkas aset bawaan aplikasi (huruf, gambar). Berkas yang
 * sudah tidak ada dulu dibalas index.html dengan status 200 — tanpa
 * pemeriksaan ini, isi HTML itu ikut tertanam sebagai "huruf" ke PDF.
 */
export async function ambilAset(url) {
  const r = await fetch(url);
  const jenis = r.headers.get("content-type") || "";
  if (!r.ok || jenis.includes("text/html")) throw galatBasi(new Error(`${url}: ${r.status} ${jenis}`));
  return r;
}

// Muat ulang otomatis paling banyak sekali per menit, supaya halaman tidak
// berputar tanpa henti bila masalahnya ternyata bukan versi basi.
const KUNCI_MUAT_ULANG = "prokopim_muat_ulang_basi";
export function bolehMuatUlangOtomatis(sekarang = Date.now()) {
  try {
    const lalu = Number(sessionStorage.getItem(KUNCI_MUAT_ULANG) || 0);
    if (sekarang - lalu < 60000) return false;
    sessionStorage.setItem(KUNCI_MUAT_ULANG, String(sekarang));
    return true;
  } catch { return false; }
}
