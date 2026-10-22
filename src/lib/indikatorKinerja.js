/**
 * src/lib/indikatorKinerja.js — Indikator Kinerja Bagian Prokopim
 *
 * Kinerja: Meningkatnya kualitas pelayanan keprotokolan dan komunikasi pimpinan.
 *
 *  IKU 1  Nilai kepuasan pimpinan atas layanan keprotokolan & komunikasi
 *         pimpinan — survei triwulanan WK/WWK (tahap berikutnya).
 *  IKU 2  Persentase kegiatan pimpinan yang dilayani sesuai standar
 *         keprotokolan — Kasubbag Protokol (tahap berikutnya).
 *  IKU 3  Persentase layanan komunikasi pimpinan yang diselesaikan tepat
 *         waktu — Kasubbag Komdokpim. Dihitung di berkas ini.
 *
 * Keputusan Kabag (22 Oktober 2026): target ketiganya 90; naskah sambutan
 * paling lambat 24 jam sebelum acara; berita paling lambat 24 jam sesudah
 * acara; kegiatan yang diwakilkan ke pejabat lain tidak dihitung.
 *
 * IKU 3 — dua satuan layanan:
 *
 *  Naskah sambutan  setiap agenda tayang berjenis Sambutan. Selesai = saat
 *                   Kabag mengesahkan (`sambutanSelesaiAt`). Tenggat = 24 jam
 *                   sebelum acara dimulai. Naskah tetap dihitung bila pimpinan
 *                   akhirnya diwakilkan: naskahnya tetap harus siap.
 *  Berita kegiatan  setiap agenda tayang yang DIHADIRI WK atau WWK. Selesai =
 *                   saat caption berita atau rilis disetujui Kasubbag
 *                   Komdokpim (mana yang lebih dulu), dibaca dari riwayat
 *                   `timeline`. Tenggat = 24 jam sesudah acara selesai.
 *
 * Persentase = tepat waktu ÷ (tepat waktu + terlambat). Layanan yang
 * tenggatnya belum lewat ("berjalan") belum dihitung; yang selesai tanpa
 * catatan waktu ("tak terukur") disisihkan dan ditampilkan apa adanya.
 */
import { epochMulai, epochSelesai } from "./zona.js";

export const TARGET = 90;
export const BATAS_SAMBUTAN_JAM = 24;
export const BATAS_BERITA_JAM = 24;

// Waktu persetujuan caption/rilis baru dicatat sejak fitur ini dipasang.
// Berita untuk acara sebelum tanggal ini tidak punya catatan waktu, sehingga
// tidak dihitung sama sekali — bukan dianggap terlambat.
export const BERITA_DICATAT_SEJAK = "2026-10-23";

const JAM = 3600000;
const SAMBUTAN_JENIS = ["Sambutan", "Sambutan membuka acara"];

export function perluSambutan(ev) {
  return !!ev && SAMBUTAN_JENIS.includes(ev.jenisKegiatan);
}

/** "hadir" | "tidak" | "belum" — kehadiran WK/WWK sendiri pada agenda. */
export function kehadiranPimpinan(ev) {
  if (!ev) return "belum";
  if (ev.statusWK === "hadir" || ev.statusWWK === "hadir") return "hadir";
  const untukWK = (ev.untukPimpinan || []).includes("walikota");
  const untukWWK = (ev.untukPimpinan || []).includes("wakilwalikota") || !!ev.delegasiKeWWK;
  const belumWK = untukWK && !ev.delegasiKeWWK && !ev.statusWK;
  const belumWWK = untukWWK && !ev.statusWWK;
  return belumWK || belumWWK ? "belum" : "tidak";
}

/** Waktu entri riwayat TERAKHIR dengan salah satu aksi, atau null. */
export function waktuTerakhir(ev, aksi) {
  const tl = Array.isArray(ev && ev.timeline) ? ev.timeline : [];
  let t = null;
  for (const e of tl) {
    if (!e || !aksi.includes(e.action)) continue;
    const at = Date.parse(e.at);
    if (!Number.isNaN(at) && (t === null || at > t)) t = at;
  }
  return t;
}

function pelakuTerakhir(ev, aksi) {
  const tl = Array.isArray(ev && ev.timeline) ? ev.timeline : [];
  for (let i = tl.length - 1; i >= 0; i--) if (tl[i] && aksi.includes(tl[i].action)) return tl[i].actor || null;
  return null;
}

function bacaEvaluasi(ev) {
  let d = ev && ev.evaluasi;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = {}; } }
  return d || {};
}

function nilaiStatus(selesai, tenggat, sekarang) {
  if (selesai != null) return selesai <= tenggat ? "tepat" : "terlambat";
  return sekarang > tenggat ? "terlambat" : "berjalan";
}

/** Satuan layanan komunikasi pimpinan dari satu agenda (0, 1, atau 2 butir). */
export function layananKomunikasi(ev, sekarang = Date.now()) {
  if (!ev || ev.alur !== "disetujui") return [];
  const mulai = epochMulai(ev);
  if (Number.isNaN(mulai)) return [];
  const out = [];

  if (perluSambutan(ev)) {
    const tenggat = mulai - BATAS_SAMBUTAN_JAM * JAM;
    const t = Date.parse(ev.sambutanSelesaiAt || "");
    const selesai = ev.sambutanSah ? (Number.isNaN(t) ? undefined : t) : null;
    out.push({
      jenis: "sambutan", ev, tenggat, selesai: selesai ?? null,
      status: selesai === undefined ? "tak_terukur" : nilaiStatus(selesai, tenggat, sekarang),
      pj: ev.sambutanPenyusun || null,
    });
  }

  if (ev.tanggal >= BERITA_DICATAT_SEJAK) {
    const hadir = kehadiranPimpinan(ev);
    const tenggat = epochSelesai(ev) + BATAS_BERITA_JAM * JAM;
    if (hadir === "hadir" || (hadir === "belum" && sekarang > mulai)) {
      const ev2 = bacaEvaluasi(ev);
      const calon = [];
      let tanpaWaktu = false;
      if (ev.captionStatus === "disetujui") {
        const t = waktuTerakhir(ev, ["caption_disetujui"]);
        t === null ? (tanpaWaktu = true) : calon.push(t);
      }
      if (ev2.news_status === "approved") {
        const t = waktuTerakhir(ev, ["rilis_disetujui"]);
        t === null ? (tanpaWaktu = true) : calon.push(t);
      }
      const selesai = calon.length ? Math.min(...calon) : null;
      out.push({
        jenis: "berita", ev, tenggat, selesai,
        // Kehadiran belum dikonfirmasi: belum tentu berita diperlukan, jadi
        // tidak dihitung — tetapi ditampilkan agar konfirmasinya dilengkapi.
        status: hadir === "belum" ? "tanpa_kehadiran"
          : selesai === null && tanpaWaktu ? "tak_terukur"
          : nilaiStatus(selesai, tenggat, sekarang),
        pj: pelakuTerakhir(ev, ["caption_diajukan", "rilis_diajukan"]) || ev2.news_updated_by || null,
      });
    }
  }
  return out;
}

export function persen(tepat, terlambat) {
  const n = tepat + terlambat;
  return n ? Math.round((tepat / n) * 1000) / 10 : null;
}

function hitung(butir) {
  const c = { tepat: 0, terlambat: 0, berjalan: 0, tak_terukur: 0, tanpa_kehadiran: 0 };
  for (const b of butir) c[b.status]++;
  return { ...c, jumlah: butir.length, persen: persen(c.tepat, c.terlambat) };
}

/**
 * Rekap IKU 3 untuk agenda bertanggal [dari, sampai] (YYYY-MM-DD, inklusif).
 * Mengembalikan seluruh butir (untuk dirinci) dan hitungan per jenis.
 */
export function rekapKomunikasi(events, { dari, sampai, sekarang = Date.now() } = {}) {
  const butir = [];
  for (const ev of events || []) {
    if (!ev || !ev.tanggal) continue;
    if (dari && ev.tanggal < dari) continue;
    if (sampai && ev.tanggal > sampai) continue;
    butir.push(...layananKomunikasi(ev, sekarang));
  }
  butir.sort((a, b) => a.tenggat - b.tenggat);
  return {
    butir,
    semua: hitung(butir),
    sambutan: hitung(butir.filter((b) => b.jenis === "sambutan")),
    berita: hitung(butir.filter((b) => b.jenis === "berita")),
  };
}

/** Rentang tanggal untuk pilihan periode. `acuan` = tanggal hari ini (YYYY-MM-DD). */
export function rentangPeriode(jenis, acuan) {
  const [y, m] = acuan.split("-").map(Number);
  const p2 = (n) => String(n).padStart(2, "0");
  const akhirBulan = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  if (jenis === "bulan") return { dari: `${y}-${p2(m)}-01`, sampai: `${y}-${p2(m)}-${p2(akhirBulan(y, m))}` };
  if (jenis === "triwulan") {
    const a = Math.floor((m - 1) / 3) * 3 + 1, b = a + 2;
    return { dari: `${y}-${p2(a)}-01`, sampai: `${y}-${p2(b)}-${p2(akhirBulan(y, b))}` };
  }
  return { dari: `${y}-01-01`, sampai: `${y}-12-31` };
}
