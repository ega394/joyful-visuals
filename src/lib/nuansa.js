/**
 * src/lib/nuansa.js — sapaan santai, kutipan harian, dan "Baitul Arsip".
 *
 * Semua kalimat di sini DISARING SATU PER SATU oleh Kabag (Oktober 2026).
 * Menambah atau mengganti kalimat cukup di berkas ini; nadanya: pendek,
 * bahasa kantor sehari-hari, tidak menggurui, emoji seperlunya.
 *
 * Aturan tampil:
 *  - Wali Kota dan Wakil Wali Kota tetap melihat tampilan formal.
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
  "Rencana A boleh bagus. Rencana B harus ada.",
  "Jangan lupa ngopi.",
  "Kalau ada yang aneh di lapangan, jangan toleh-toleh :D",
];

/** Satu kutipan per hari (sama sepanjang hari, berganti esoknya). */
export function kutipanHarian(saat = Date.now()) {
  const t = hariIniWita(saat);
  const urut = Math.floor(Date.parse(t + "T00:00:00Z") / 86400000);
  return KUTIPAN[((urut % KUTIPAN.length) + KUTIPAN.length) % KUTIPAN.length];
}

/** Baris nuansa di bawah judul halaman: sapaan bila ada, selain itu kutipan. */
export function barisNuansa(role, nama, saat = Date.now()) {
  if (!bolehSantai(role)) return null;
  return sapaanSantai(nama, saat) || kutipanHarian(saat);
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

// ── Julukan bulanan (Rekap Kinerja) ─────────────────────────────────
export const JULUKAN = {
  gercep:   { label: "Paling Gercep",       ikon: "⚡", ket: "Verifikasi/persetujuan tercepat" },
  lapangan: { label: "Langganan Lapangan",  ikon: "🎗️", ket: "Penugasan lapangan terbanyak" },
  sapu:     { label: "Tukang Sapu Antrean", ikon: "🧹", ket: "Paling banyak menuntaskan antrean" },
  ketik:    { label: "Juru Ketik Andalan",  ikon: "⌨️", ket: "Input jadwal terbanyak" },
  kamera:   { label: "Mata Kamera",         ikon: "📸", ket: "Dokumentasi terbanyak" },
};

const AKSI_PUTUS = ["forward_to_kabag", "publish", "return_by_kasubbag", "reject_by_kabag"];
const AKSI_AWAL = { forward_to_kabag: ["submit", "resubmit"], publish: ["forward_to_kabag"] };

function tglWita(iso) {
  const t = Date.parse(iso || "");
  return Number.isFinite(t) ? new Date(t + 8 * 3600000).toISOString().slice(0, 10) : "";
}

function juara(skor, { kecil = false, minimal = 1 } = {}) {
  let terbaik = null;
  for (const [un, v] of Object.entries(skor)) {
    if (!(kecil ? v.n >= minimal : v >= minimal)) continue;
    const nilai = kecil ? v.median : v;
    if (terbaik === null || (kecil ? nilai < terbaik.nilai : nilai > terbaik.nilai)) terbaik = { un, nilai };
    else if (nilai === terbaik.nilai) terbaik.seri = true;
  }
  // Seri di puncak tidak memberi julukan, supaya tidak berebut gelar.
  return terbaik && !terbaik.seri ? terbaik.un : null;
}

/**
 * Pemegang julukan pada suatu periode → { username: [kode,…] }.
 *  events    : seluruh jadwal
 *  users     : daftar pengguna (untuk peran Komdokpim)
 *  dalamPeriode(tglYYYYMMDD) → boolean
 */
export function hitungJulukan(events, users, dalamPeriode) {
  const peran = {};
  for (const u of users || []) peran[u.username] = u.role;
  const tugas = {}, kamera = {}, ketik = {}, sapu = {}, cepat = {};

  for (const e of events || []) {
    if (e && e.alur === "disetujui" && dalamPeriode(String(e.tanggal || ""))) {
      for (const un of e.personil || []) {
        if (["timkom", "kasubbag_komdokpim"].includes(peran[un])) kamera[un] = (kamera[un] || 0) + 1;
        else tugas[un] = (tugas[un] || 0) + 1;
      }
    }
    const tl = Array.isArray(e && e.timeline) ? e.timeline : [];
    tl.forEach((x, i) => {
      if (!x || !x.actor || !dalamPeriode(tglWita(x.at))) return;
      if (x.action === "submit") ketik[x.actor] = (ketik[x.actor] || 0) + 1;
      if (AKSI_PUTUS.includes(x.action)) sapu[x.actor] = (sapu[x.actor] || 0) + 1;
      const awal = AKSI_AWAL[x.action];
      if (awal) {
        for (let j = i - 1; j >= 0; j--) {
          if (awal.includes(tl[j] && tl[j].action)) {
            const menit = (Date.parse(x.at) - Date.parse(tl[j].at)) / 60000;
            if (Number.isFinite(menit) && menit >= 0) (cepat[x.actor] = cepat[x.actor] || []).push(menit);
            break;
          }
        }
      }
    });
  }

  const median = (a) => { const s = [...a].sort((p, q) => p - q); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const skorCepat = {};
  for (const [un, a] of Object.entries(cepat)) skorCepat[un] = { n: a.length, median: median(a) };

  const hasil = {};
  const beri = (un, kode) => { if (un) (hasil[un] = hasil[un] || []).push(kode); };
  beri(juara(skorCepat, { kecil: true, minimal: 3 }), "gercep");
  beri(juara(tugas, { minimal: 2 }), "lapangan");
  beri(juara(sapu, { minimal: 3 }), "sapu");
  beri(juara(ketik, { minimal: 3 }), "ketik");
  beri(juara(kamera, { minimal: 2 }), "kamera");
  return hasil;
}
