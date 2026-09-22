/**
 * src/lib/usulan.js — umur usulan perubahan jadwal
 *
 * Usulan perubahan mudah mengendap, dan justru karena tidak ada yang rusak
 * secara terlihat: jadwal lamanya tetap tayang selama usulannya didiamkan,
 * sehingga tidak ada gejala yang menagih.
 *
 * Penandanya sengaja TIDAK menghitung umur saja. Usulan berumur lima hari
 * untuk acara bulan depan masih longgar; usulan yang baru masuk pagi ini untuk
 * acara besok sudah mendesak. Penanda yang hanya melihat umur akan berteriak
 * pada yang pertama dan diam pada yang kedua — tepat terbalik.
 *
 * Karena itu kelonggarannya MENYUSUT seiring dekatnya hari H:
 *
 *   Acara ≥ 4 hari lagi    kuning 2 hari · merah 4 hari
 *   Acara 2–3 hari lagi     kuning 1 hari · merah 2 hari
 *   Acara hari ini/besok    tidak ada kelonggaran — langsung merah
 *
 * Acara yang sudah berlalu ditandai kelabu, bukan merah: usulannya bukan
 * terlambat, melainkan sudah tidak bermakna dan sebaiknya dibersihkan.
 */

import { hariIniWita } from "./plh.js";

/** Kelonggaran menurut sisa hari menuju acara. Diurut dari yang paling longgar. */
export const UMUR_AMBANG = [
  { sisaMin: 4, kuning: 2, merah: 4 },
  { sisaMin: 2, kuning: 1, merah: 2 },
  { sisaMin: 0, kuning: 0, merah: 0 },   // hari ini / besok — tanpa kelonggaran
];

/** Selisih hari kalender WITA antara dua YYYY-MM-DD (b − a), atau null. */
export function selisihHari(a, b) {
  const t = (s) => Date.parse(s + "T00:00:00+08:00");
  const x = t(a), y = t(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return Math.round((y - x) / 86400000);
}

/**
 * Kapan usulan ini diajukan, sebagai YYYY-MM-DD WITA — atau null.
 *
 * `usulanEditPada` baru ditulis sejak 21 Agustus 2026; usulan yang lebih tua
 * tidak memilikinya, jadi jejak audit dipakai sebagai cadangan. Bila keduanya
 * tidak ada, penandanya sengaja TIDAK muncul: menerka umur dari tanggal acara
 * akan menghasilkan angka yang terlihat pasti padahal karangan.
 */
export function tanggalUsulan(ev) {
  if (ev?.usulanEditPada) {
    const d = new Date(ev.usulanEditPada);
    if (!Number.isNaN(d.getTime())) return hariIniWita(d.getTime());
  }
  const jejak = (ev?.timeline || []).filter(t => t.action === "usulan_edit_diajukan");
  const akhir = jejak[jejak.length - 1];
  if (akhir?.at) {
    const d = new Date(akhir.at);
    if (!Number.isNaN(d.getTime())) return hariIniWita(d.getTime());
  }
  return null;
}

const hariKata = (n) => (n === 0 ? "hari ini" : n === 1 ? "1 hari" : n + " hari");

/**
 * Tingkat kegentingan usulan `ev`, atau null bila belum perlu ditandai.
 *
 * Mengembalikan { tingkat, umur, sisa, label, warna, bg, garis }, dengan
 * `tingkat` salah satu dari "lewat" | "merah" | "kuning".
 */
export function umurUsulan(ev, hari = hariIniWita()) {
  if (!ev || !ev.alurEdit) return null;

  const mulai = tanggalUsulan(ev);
  if (!mulai) return null;

  const umur = selisihHari(mulai, hari);
  if (umur === null || umur < 0) return null;   // cap waktu di masa depan — jangan diterka

  const sisa = ev.tanggal ? selisihHari(hari, ev.tanggal) : null;

  // Acara sudah berlalu — usulannya tidak lagi bermakna.
  if (sisa !== null && sisa < 0) {
    return {
      tingkat: "lewat", umur, sisa,
      label: "Acara sudah berlalu — usulan ini tidak lagi bermakna",
      warna: "#475569", bg: "#F1F5F9", garis: "#CBD5E1",
    };
  }

  // Tanpa tanggal acara, pakai kelonggaran yang paling longgar.
  const baris = UMUR_AMBANG.find(b => (sisa === null ? b.sisaMin === 4 : sisa >= b.sisaMin))
    || UMUR_AMBANG[UMUR_AMBANG.length - 1];

  if (umur >= baris.merah) {
    const sebab = sisa !== null && sisa <= 1
      ? (sisa === 0 ? "acara HARI INI" : "acara BESOK")
      : "menunggu " + hariKata(umur);
    return {
      tingkat: "merah", umur, sisa,
      label: "Perlu segera diputus — " + sebab,
      warna: "#991B1B", bg: "#FEF2F2", garis: "#FCA5A5",
    };
  }

  if (umur >= baris.kuning && umur > 0) {
    return {
      tingkat: "kuning", umur, sisa,
      label: "Menunggu " + hariKata(umur)
        + (sisa !== null ? " · acara " + hariKata(sisa) + " lagi" : ""),
      warna: "#92400E", bg: "#FFFBEB", garis: "#FCD34D",
    };
  }

  return null;
}

/**
 * Urutan tampil antrian usulan, paling perlu ditindak lebih dulu.
 *
 * Mengurutkan menurut tanggal acara saja membuat usulan yang acaranya SUDAH
 * BERLALU justru memimpin daftar — yang paling tidak perlu diputus berada di
 * paling atas. Karena itu kegentingan menjadi kunci pertama, tanggal acara
 * kunci kedua.
 */
const PRIORITAS = { merah: 0, kuning: 1, lewat: 3 };

export function bandingUsulan(a, b, hari = hariIniWita()) {
  const p = (ev) => {
    const u = umurUsulan(ev, hari);
    return u ? (PRIORITAS[u.tingkat] ?? 2) : 2;   // belum ditandai → di antara kuning dan lewat
  };
  const d = p(a) - p(b);
  if (d !== 0) return d;
  return ((a.tanggal || "") + (a.jam || "")).localeCompare((b.tanggal || "") + (b.jam || ""));
}
