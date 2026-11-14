// Survei Kepuasan Masyarakat (SKM) layanan peminjaman ruang rapat.
//
// Sembilan unsur dan cara menghitung Indeks Kepuasan Masyarakat (IKM) mengikuti
// Peraturan Menteri PANRB Nomor 14 Tahun 2017. Skala setiap jawaban 1–4.
// Dipakai bersama oleh halaman survei, tab hasil, dan peladen (api/_survei.mjs),
// supaya validasi dan rumusnya satu.
//
// Keputusan Kabag (14 November 2026): survei dikirim lewat WhatsApp pada sore
// hari terakhir peminjaman (17.00 WITA), sembilan unsur lengkap, tanpa
// pengingat; hasilnya dilihat Kabag, Kasubbag Protokol, dan pengelola ruangan.

export const UNSUR = [
  { kode: "u1", unsur: "Persyaratan",
    tanya: "Bagaimana kesesuaian persyaratan peminjaman (surat dan data yang diminta) dengan layanan yang Anda terima?",
    pilihan: ["Tidak sesuai", "Kurang sesuai", "Sesuai", "Sangat sesuai"] },
  { kode: "u2", unsur: "Sistem, mekanisme, dan prosedur",
    tanya: "Bagaimana kemudahan prosedur pengajuan peminjaman secara daring?",
    pilihan: ["Tidak mudah", "Kurang mudah", "Mudah", "Sangat mudah"] },
  { kode: "u3", unsur: "Waktu penyelesaian",
    tanya: "Bagaimana kecepatan Anda mendapat kepastian atau persetujuan peminjaman?",
    pilihan: ["Tidak cepat", "Kurang cepat", "Cepat", "Sangat cepat"] },
  { kode: "u4", unsur: "Biaya/tarif",
    tanya: "Bagaimana kewajaran biaya layanan peminjaman ruangan ini?",
    pilihan: ["Sangat mahal", "Cukup mahal", "Murah", "Gratis"] },
  { kode: "u5", unsur: "Produk spesifikasi jenis pelayanan",
    tanya: "Bagaimana kesesuaian ruangan dan sesi yang diberikan dengan yang Anda ajukan?",
    pilihan: ["Tidak sesuai", "Kurang sesuai", "Sesuai", "Sangat sesuai"] },
  { kode: "u6", unsur: "Kompetensi pelaksana",
    tanya: "Bagaimana kemampuan petugas dalam membantu kebutuhan peminjaman Anda?",
    pilihan: ["Tidak kompeten", "Kurang kompeten", "Kompeten", "Sangat kompeten"] },
  { kode: "u7", unsur: "Perilaku pelaksana",
    tanya: "Bagaimana kesopanan dan keramahan petugas?",
    pilihan: ["Tidak sopan dan ramah", "Kurang sopan dan ramah", "Sopan dan ramah", "Sangat sopan dan ramah"] },
  { kode: "u8", unsur: "Penanganan pengaduan, saran, dan masukan",
    tanya: "Bagaimana ketersediaan dan tindak lanjut sarana pengaduan atau saran?",
    pilihan: ["Tidak ada", "Ada tetapi tidak berfungsi", "Berfungsi kurang maksimal", "Dikelola dengan baik"] },
  { kode: "u9", unsur: "Sarana dan prasarana",
    tanya: "Bagaimana kondisi ruangan dan fasilitasnya (kebersihan, pendingin udara, kursi, pengeras suara)?",
    pilihan: ["Buruk", "Cukup", "Baik", "Sangat baik"] },
];

export const KODE_UNSUR = UNSUR.map((u) => u.kode);
export const MASA_BERLAKU_HARI = 7;
export const SARAN_MAKS = 1000;

/** Memeriksa jawaban survei. Mengembalikan pesan kesalahan, atau null bila sah. */
export function periksaJawaban(jawaban, saran) {
  if (!jawaban || typeof jawaban !== "object") return "Jawaban belum diisi.";
  for (const u of UNSUR) {
    const v = jawaban[u.kode];
    if (!Number.isInteger(v) || v < 1 || v > 4) return `Pertanyaan "${u.unsur}" belum dijawab.`;
  }
  if (saran != null && typeof saran !== "string") return "Saran tidak sah.";
  if (saran && saran.length > SARAN_MAKS) return `Saran paling banyak ${SARAN_MAKS} karakter.`;
  return null;
}

/** Mutu pelayanan dari nilai IKM (25–100), sesuai tabel konversi PermenPAN-RB 14/2017. */
export function mutuIKM(ikm) {
  if (ikm == null || Number.isNaN(ikm)) return null;
  if (ikm >= 88.31) return { mutu: "A", kinerja: "Sangat Baik" };
  if (ikm >= 76.61) return { mutu: "B", kinerja: "Baik" };
  if (ikm >= 65.0) return { mutu: "C", kinerja: "Kurang Baik" };
  return { mutu: "D", kinerja: "Tidak Baik" };
}

/**
 * IKM dari kumpulan jawaban yang sudah diisi. Setiap unsur: nilai rata-rata
 * (NRR); NRR tertimbang = Σ NRR × 1/9; IKM = NRR tertimbang × 25.
 */
export function hitungIKM(baris) {
  const isi = (baris || []).filter((b) => b && KODE_UNSUR.every((k) => Number.isInteger(b[k])));
  const n = isi.length;
  const nrr = {};
  for (const k of KODE_UNSUR) nrr[k] = n ? isi.reduce((a, b) => a + b[k], 0) / n : null;
  if (!n) return { n: 0, nrr, ikm: null, mutu: null, kinerja: null };
  const tertimbang = KODE_UNSUR.reduce((a, k) => a + nrr[k], 0) / KODE_UNSUR.length;
  const ikm = Math.round(tertimbang * 25 * 100) / 100;
  return { n, nrr, ikm, ...mutuIKM(ikm) };
}

/**
 * Peminjaman yang SELESAI pada `hari` (WITA) dan layak dikirimi survei:
 * disetujui, bukan pemakaian internal, bukan yang sedang minta batal, dan
 * hari terakhir seluruh slot dalam satu kode jatuh pada `hari`.
 * `baris` adalah slot room_bookings (satu kode bisa banyak baris).
 */
export function selesaiPadaHari(baris, hari) {
  const grup = new Map();
  for (const b of baris || []) {
    if (!b || !b.booking_code) continue;
    if (!grup.has(b.booking_code)) grup.set(b.booking_code, []);
    grup.get(b.booking_code).push(b);
  }
  const hasil = [];
  for (const [kode, slot] of grup) {
    if (slot.some((s) => s.status !== "Approved")) continue;
    const catatan = slot.map((s) => String(s.notes || "")).join(" ");
    if (catatan.includes("[INTERNAL]") || catatan.includes("[MINTA BATAL]")) continue;
    const akhir = slot.reduce((m, s) => (s.end_date > m ? s.end_date : m), "");
    if (akhir !== hari) continue;
    const awal = slot.reduce((m, s) => (s.start_date < m ? s.start_date : m), slot[0].start_date);
    const wa = String(slot[0].pic_wa || "").replace(/\D/g, "");
    if (wa.length < 9) continue;
    hasil.push({ booking_code: kode, slot, awal, akhir, wa, kepala: slot[0] });
  }
  return hasil;
}

/** "3 November 2026" atau "3–5 November 2026". */
export function rentangTanggal(awal, akhir) {
  const BLN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const f = (d) => { const [y, m, h] = d.split("-").map(Number); return { y, m, h }; };
  const a = f(awal), b = f(akhir || awal);
  if (awal === (akhir || awal)) return `${a.h} ${BLN[a.m - 1]} ${a.y}`;
  if (a.y === b.y && a.m === b.m) return `${a.h}–${b.h} ${BLN[b.m - 1]} ${b.y}`;
  return `${a.h} ${BLN[a.m - 1]} ${a.y} – ${b.h} ${BLN[b.m - 1]} ${b.y}`;
}
