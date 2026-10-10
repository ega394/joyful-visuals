/**
 * src/lib/nuansa.js — sapaan santai, kutipan harian, dan "Baitul Arsip".
 *
 * Semua kalimat di sini DISARING SATU PER SATU oleh Kabag (Oktober 2026).
 * Menambah atau mengganti kalimat cukup di berkas ini; nadanya: pendek,
 * bahasa kantor sehari-hari, tidak menggurui, emoji seperlunya.
 *
 * Aturan tampil:
 *  - Wali Kota dan Wakil Wali Kota tetap melihat tampilan formal.
 *  - "Kata-kata Hari Ini" dan kalimat putaran harian diatur Kabag dari
 *    menu Profil (tabel pengaturan_aplikasi); KUTIPAN di bawah hanya bawaan
 *    bila Kabag belum mengisi daftarnya sendiri.
 *  - Ajudan, Kabag, Kasubbag, staf, dan admin ikut nuansa santai.
 *  - Tidak pernah dipakai di pesan ke pemohon/warga, WA, surat, atau PDF.
 */

import { hariIniWita } from "./plh.js";

const PERAN_FORMAL = ["walikota", "wakilwalikota"];

/** Apakah peran ini mendapat nuansa santai. */
export function bolehSantai(role) {
  return !!role && !PERAN_FORMAL.includes(role);
}

/** "ANUGRAH YEGA PRANATHA, M.Si" → "Anugrah". */
export function namaPanggil(nama) {
  const depan = String(nama || "").split(",")[0].trim().split(/\s+/)[0] || "";
  if (!depan) return "";
  return depan.charAt(0).toUpperCase() + depan.slice(1).toLowerCase();
}

function waktuWita(saat) {
  const d = new Date(saat + 8 * 3600000);
  return { hari: d.getUTCDay(), jam: d.getUTCHours(), menit: d.getUTCMinutes() };
}

/**
 * Sapaan santai sesuai waktu (WITA), atau null bila tidak ada yang cocok
 * (pada jam itu cukup sapaan biasa).
 */
export function sapaanSantai(nama, saat = Date.now()) {
  const n = namaPanggil(nama);
  const { hari, jam, menit } = waktuWita(saat);
  if (jam >= 21 || jam < 4) return `Masih buka aplikasi jam segini? Jadwal besok sudah aman${n ? ", " + n : ""}. Tidur.`;
  if (hari === 5 && ((jam === 10 && menit >= 30) || jam === 11)) return "Yuk siap-siap shalat Jumat bagi yang muslim.";
  if (hari === 1 && jam >= 6 && jam < 11) return `Senin lagi. Habis apel langsung buka antrean ya${n ? ", " + n : ""}.`;
  if (jam >= 11 && jam < 15) return `Selamat siang${n ? ", " + n : ""}, semangat dan jangan lupa makan.`;
  if (jam >= 15 && jam < 18) return `Sore${n ? ", " + n : ""}. Sedikit lagi, habis itu pulang.`;
  return null;
}

export const KUTIPAN = [
  "Jangan lupa ngopi.",
  "Kalau ada yang aneh di lapangan, jangan toleh-toleh :D",
];

/**
 * Satu kutipan per hari (sama sepanjang hari, berganti esoknya). `daftar`
 * berasal dari menu Profil Kabag; bila kosong dipakai KUTIPAN bawaan.
 */
export function kutipanHarian(saat = Date.now(), daftar) {
  const d = (Array.isArray(daftar) ? daftar : []).map((x) => String(x || "").trim()).filter(Boolean);
  const pakai = d.length ? d : KUTIPAN;
  const t = hariIniWita(saat);
  const urut = Math.floor(Date.parse(t + "T00:00:00Z") / 86400000);
  return pakai[((urut % pakai.length) + pakai.length) % pakai.length];
}

/**
 * Baris di bawah judul halaman. "Kata-kata Hari Ini" yang ditulis Kabag
 * (menu Profil) didahulukan; bila kosong, putaran biasa: sapaan sesuai
 * waktu, atau kutipan harian bila jam itu tidak punya sapaan khusus.
 */
export function barisNuansa(role, nama, saat = Date.now(), kata = "", putaran) {
  if (!bolehSantai(role)) return null;
  const k = String(kata || "").trim();
  if (k) return "💬 " + k;
  return sapaanSantai(nama, saat) || kutipanHarian(saat, putaran);
}

export const TEKS_MEMUAT = ["Lagi diambilkan datanya…", "Bentar, servernya lagi ngopi."];

export const TEKS_KOSONG = {
  antrean: "Kosong. Kalau Kabag tanya, bilang sudah beres semua.",
  hariIni: "Hari ini kosong. Jarang-jarang. HP tetap jangan dimatikan.",
};

export const BAITUL_ARSIP = {
  judul: "Baitul Arsip",
  sub: "Rumahnya semua berkas Prokopim",
  keterangan: "Namanya terinspirasi Baitul Hikmah, perpustakaan besar di Baghdad dulu.",
  kosong: "Masih lapang. Belum ada berkas yang mampir.",
  masuk: "Sudah masuk Baitul Arsip.",
};

export const KEJUTAN = "Aplikasi ini dibuat pakai kopi, sabar, dan revisi berkali-kali.";
