/**
 * src/lib/aturanWA.js — aturan kapan sebuah kabar memakai WhatsApp (Fonnte).
 *
 * Diputuskan Kabag atas audit pemakaian Fonnte, Oktober 2026: push aplikasi
 * (gratis) untuk kabar biasa; WhatsApp hanya bila penerima harus bertindak dan
 * acaranya sudah dekat, atau penerimanya tidak punya kanal lain. Aturannya
 * dikumpulkan di sini sebagai fungsi murni supaya dapat diuji, dan supaya
 * setiap tombol di aplikasi memakai aturan yang sama.
 */

import { hariIniWita } from "./plh.js";

const SEHARI = 86400000;

/** Jam (0–23) menurut WITA. */
export function jamWita(saat = Date.now()) {
  return new Date(saat + 8 * 3600000).getUTCHours();
}

/** Ada tanggal (YYYY-MM-DD) yang jatuh hari ini atau besok, WITA. */
export function acaraDekat(tanggal, saat = Date.now()) {
  const h = hariIniWita(saat), b = hariIniWita(saat + SEHARI);
  return (Array.isArray(tanggal) ? tanggal : [tanggal]).some((t) => t && t >= h && t <= b);
}

/** "08xx" / "+62 8xx" / "628xx" → "628xx" — untuk mengenali nomor yang sama. */
export function kunciNomor(n) {
  return String(n || "").trim().replace(/^\+/, "").replace(/^0/, "62").replace(/\D/g, "");
}

/** Pengguna aktif dengan nomor sah, satu orang per nomor. */
export function penerimaUnik(daftar) {
  const sudah = new Set();
  return (daftar || []).filter((u) => {
    const k = kunciNomor(u && u.noWA);
    if (!u || u.disabled || k.length < 10 || sudah.has(k)) return false;
    sudah.add(k);
    return true;
  });
}

/** Tanggal, jam, atau lokasi berubah — perubahan yang mengubah tugas lapangan. */
export function perubahanMaterial(lama, baru) {
  if (!lama || !baru) return false;
  return ["tanggal", "jam", "jamSelesai", "lokasi"].some(
    (k) => k in baru && String(lama[k] || "").trim() !== String(baru[k] || "").trim()
  );
}

/**
 * Konfirmasi kehadiran pimpinan → WA ke Kasubbag Protokol (+PLH)?
 *   - status sama dengan sebelumnya: tidak dikabarkan sama sekali;
 *   - TIDAK HADIR atau DIDELEGASIKAN: ya (petugas & persiapan berubah);
 *   - lainnya (Hadir, Diwakilkan): hanya bila acaranya hari ini/besok DAN
 *     merupakan perubahan (Hadir pertama kali cukup push).
 * Mengembalikan "tidak" | "push" | "wa".
 */
export function kanalKehadiran(status, statusLama, tanggal, saat = Date.now()) {
  if (!status || status === statusLama) return "tidak";
  if (status === "tidak_hadir" || status === "delegasi") return "wa";
  if (acaraDekat(tanggal, saat) && (!!statusLama || status !== "hadir")) return "wa";
  return "push";
}

/**
 * Kabar ke ajudan & petugas lapangan (disetujui/diubah/ditarik/dibatalkan)
 * → juga WA? Push selalu dikirim; WA hanya bila acaranya (tanggal baru atau
 * lama) hari ini/besok. Jadwal BESOK yang disetujui sebelum 16:00 tidak perlu
 * WA karena rekap ajudan 16:00 sudah memuatnya. `material:false` (mis. hanya
 * nama/kontak berubah) → push saja.
 */
export function perluWALapangan(jenis, { tanggal, tanggalLama, material = true } = {}, saat = Date.now()) {
  if (material === false) return false;
  if (!acaraDekat([tanggal, tanggalLama], saat)) return false;
  if (jenis === "disetujui" && tanggal === hariIniWita(saat + SEHARI) && jamWita(saat) < 16) return false;
  return true;
}
