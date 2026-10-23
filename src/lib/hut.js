// Logo HUT ke-29 Kota Tarakan (15 Desember 2026) — tampil sementara.
//
// Keputusan Kabag 23 Oktober 2026: tampil 23 Oktober s.d. 31 Desember 2026
// di halaman masuk, halaman publik (audiensi, peminjaman ruangan), dan kartu
// agenda yang dibagikan; tidak di dokumen resmi, pesan WA, atau ikon aplikasi.
// Sesudah tanggal selesai, logo hilang sendiri tanpa perlu pembaruan aplikasi.
//
// Berkas di public/ (alamat tetap, tidak berganti nama tiap pembaruan):
//   hut29-putih.png  — tulisan putih, untuk latar gelap
//   hut29-warna.png  — tulisan ungu, untuk latar terang

export const HUT = {
  mulai: "2026-10-23",
  selesai: "2026-12-31",
  judul: "HUT ke-29 Kota Tarakan — Satukan Langkah, Majulah Tarakan",
  putih: "/hut29-putih.png",
  warna: "/hut29-warna.png",
};

/** Tanggal hari ini menurut WITA (YYYY-MM-DD). */
const hariIniWita = (t = Date.now()) => new Date(t + 8 * 3600000).toISOString().slice(0, 10);

export function hutAktif(t = Date.now()) {
  const h = hariIniWita(t);
  return h >= HUT.mulai && h <= HUT.selesai;
}
