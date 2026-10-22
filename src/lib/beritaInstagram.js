/**
 * src/lib/beritaInstagram.js — mencocokkan postingan @humas_tarakan dengan agenda
 *
 * Dipakai IKU 3: berita kegiatan selesai saat TERBIT di akun resmi.
 *
 * Urutan bukti, dari yang paling kuat:
 *  1. Pilihan manual Kasubbag Komdokpim/Kabag (`ev.beritaTerbit`) — selalu menang.
 *  2. Teks postingan memuat caption yang disetujui di aplikasi (`captionBerita`):
 *     tim biasanya mengunggah caption itulah.
 *  3. Nama acara (dan lokasi/penyelenggara) muncul di teks postingan.
 * Hanya postingan yang terbit sejak 2 jam sebelum acara sampai 7 hari
 * sesudahnya yang dipertimbangkan. Postingan yang pernah ditandai "bukan
 * ini" (`ev.beritaTolak`) dilewati.
 *
 * Skor ≥ YAKIN → ditautkan otomatis. Di bawahnya hanya menjadi "kandidat"
 * untuk dipilih manusia — tidak pernah dihitung sebagai terbit, supaya
 * kecocokan yang meragukan tidak menaikkan angka kinerja.
 */
import { epochMulai } from "./zona.js";

export const YAKIN = 0.6;
export const KANDIDAT = 0.3;
const SEBELUM_MS = 2 * 3600000;
const SESUDAH_MS = 7 * 86400000;

const KATA_UMUM = new Set((
  "dan yang di ke dari untuk dengan pada dalam ini itu atau juga akan oleh sebagai telah sudah " +
  "para bagi serta tersebut adalah kami kita mereka saat secara agar dapat lebih tahun hari " +
  "kota tarakan pemkot pemerintah wali wakil walikota bapak ibu acara kegiatan dr kes hj " +
  "the of and in at sdr selaku bersama dalam rangka kalimantan utara kaltara"
).split(" "));

/** Kata bermakna dari sebuah teks (huruf kecil, tanpa tanda baca/tautan/tagar). */
export function kataKunci(teks) {
  return new Set(String(teks || "")
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#@]\w+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((k) => k.length >= 3 && !KATA_UMUM.has(k)));
}

// Seberapa banyak kata `a` yang muncul di `b` (0–1).
function cakupan(a, b) {
  if (!a.size) return 0;
  let n = 0;
  for (const k of a) if (b.has(k)) n++;
  return n / a.size;
}

export function skorKecocokan(ev, post) {
  const isi = kataKunci(post.caption);
  if (!isi.size) return 0;
  const cap = cakupan(kataKunci(ev.captionBerita), isi);
  const nama = cakupan(kataKunci(ev.namaAcara), isi);
  const tambahan = [ev.lokasi, ev.penyelenggara].some((t) => {
    const k = kataKunci(t);
    return k.size && cakupan(k, isi) >= 0.5;
  }) ? 0.1 : 0;
  return Math.min(1, Math.max(cap, nama * 0.9) + tambahan);
}

/**
 * Pasangkan agenda dengan postingan. Mengembalikan Map id agenda →
 * { post, skor, cara: "manual"|"otomatis"|null, kandidat: [{post, skor}] }.
 * Satu postingan hanya ditautkan otomatis ke satu agenda (skor tertinggi).
 */
export function cocokkanBerita(events, postingan) {
  const posts = (postingan || []).map((p) => ({ ...p, _t: Date.parse(p.terbit_at) })).filter((p) => !Number.isNaN(p._t));
  const hasil = new Map();
  const pasangan = [];
  for (const ev of events || []) {
    if (!ev) continue;
    const manual = ev.beritaTerbit && ev.beritaTerbit.terbit_at ? ev.beritaTerbit : null;
    if (manual) {
      hasil.set(ev.id, { post: manual, skor: 1, cara: "manual", kandidat: [] });
      continue;
    }
    const mulai = epochMulai(ev);
    if (Number.isNaN(mulai)) continue;
    const tolak = new Set(ev.beritaTolak || []);
    const kandidat = [];
    for (const p of posts) {
      if (p._t < mulai - SEBELUM_MS || p._t > mulai + SESUDAH_MS || tolak.has(p.id)) continue;
      const skor = skorKecocokan(ev, p);
      if (skor >= KANDIDAT) kandidat.push({ post: p, skor });
    }
    kandidat.sort((a, b) => b.skor - a.skor || a.post._t - b.post._t);
    hasil.set(ev.id, { post: null, skor: 0, cara: null, kandidat: kandidat.slice(0, 5) });
    for (const k of kandidat) if (k.skor >= YAKIN) pasangan.push({ ev, ...k });
  }
  // Rakus: pasangan terkuat lebih dulu; postingan yang sudah terpakai dilewati.
  pasangan.sort((a, b) => b.skor - a.skor);
  const terpakai = new Set();
  for (const { ev, post, skor } of pasangan) {
    const h = hasil.get(ev.id);
    if (h.post || terpakai.has(post.id)) continue;
    h.post = post; h.skor = skor; h.cara = "otomatis";
    terpakai.add(post.id);
  }
  return hasil;
}
