/**
 * src/lib/plh.js — Pelaksana Harian (PLH)
 *
 * Ketika Kabag atau Kasubbag cuti, antrian persetujuan berhenti total: jadwal
 * mengendap di "menunggu_kabag" dan tidak seorang pun dapat memajukannya,
 * sehingga agenda pimpinan tidak tayang.
 *
 * PLH bekerja dengan menempelkan kewenangan sementara pada akun pengampu:
 *
 *   plh_untuk    peran yang diampu (kabag / kasubbag_protokol / kasubbag_komdokpim)
 *   plh_mulai    tanggal mulai berlaku (YYYY-MM-DD, WITA)
 *   plh_selesai  tanggal terakhir berlaku (inklusif)
 *   plh_dasar    nomor Surat Perintah — boleh kosong
 *
 * Dua sifat yang disengaja:
 *
 * 1. Kewenangan PLH adalah GABUNGAN peran asli + peran yang diampu, bukan
 *    penggantian. Staf yang mengampu Kasubbag tidak boleh kehilangan menu yang
 *    selama ini dipakainya (mis. Kalender Ruangan yang hanya milik staf).
 *
 * 2. Kewenangan PADAM SENDIRI saat lewat plh_selesai. Tidak ada yang perlu
 *    diingat untuk dicabut, sehingga kewenangan pinjaman tidak menggantung.
 *
 * Aplikasi hanya MENCERMINKAN Surat Perintah yang sah — bukan menciptakan
 * kewenangan. Penetapannya tetap keputusan pejabat berwenang.
 */

/** Peran yang boleh diampu oleh seorang PLH. */
export const PERAN_DAPAT_DIAMPU = ["kabag", "kasubbag_protokol", "kasubbag_komdokpim"];

/**
 * Peran asal yang boleh mengampu tiap jabatan.
 *
 * Kabag hanya boleh diampu Kasubbag — staf tidak dapat mengampu Kabag dalam
 * keadaan apa pun. Kasubbag boleh diampu Kasubbag lain maupun pelaksana pada
 * sub bagian yang bersangkutan.
 */
export const PENGAMPU_SAH = {
  kabag:              ["kasubbag_protokol", "kasubbag_komdokpim"],
  kasubbag_protokol:  ["kasubbag_protokol", "kasubbag_komdokpim", "staf", "admin_rk"],
  kasubbag_komdokpim: ["kasubbag_protokol", "kasubbag_komdokpim", "timkom"],
};

export const LABEL_PERAN = {
  kabag: "Kabag Prokopim",
  kasubbag_protokol: "Kasubbag Protokol",
  kasubbag_komdokpim: "Kasubbag Komdokpim",
};

/** Tanggal hari ini menurut WITA (UTC+8) sebagai YYYY-MM-DD. */
export function hariIniWita(saat = Date.now()) {
  return new Date(saat + 8 * 3600000).toISOString().slice(0, 10);
}

/**
 * Pendelegasian yang sedang berlaku bagi `u`, atau null.
 * Rentang tanggalnya inklusif di kedua ujung.
 */
export function plhAktif(u, hari = hariIniWita()) {
  if (!u || !u.plh_untuk || !u.plh_mulai || !u.plh_selesai) return null;
  if (!PERAN_DAPAT_DIAMPU.includes(u.plh_untuk)) return null;
  if (hari < u.plh_mulai || hari > u.plh_selesai) return null;
  // Mengampu peran sendiri tidak menambah apa pun, dan menyesatkan bila
  // muncul sebagai penanda "bertindak sebagai PLH".
  if (u.plh_untuk === u.role) return null;
  return {
    untuk:   u.plh_untuk,
    dasar:   u.plh_dasar || "",
    mulai:   u.plh_mulai,
    selesai: u.plh_selesai,
  };
}

/**
 * Peran yang dipakai untuk gerbang kewenangan.
 *
 * Mengembalikan peran yang diampu bila pendelegasian berlaku — inilah yang
 * membuat ±60 pemeriksaan `role === "kabag"` di seluruh aplikasi ikut berlaku
 * bagi PLH tanpa perlu disentuh satu per satu.
 */
export function peranEfektif(u, hari = hariIniWita()) {
  const p = plhAktif(u, hari);
  return p ? p.untuk : (u?.role || null);
}

/** Seluruh peran yang dipegang (asli + yang diampu), tanpa duplikat. */
export function peranDipegang(u, hari = hariIniWita()) {
  const out = [];
  if (u?.role) out.push(u.role);
  const p = plhAktif(u, hari);
  if (p && !out.includes(p.untuk)) out.push(p.untuk);
  return out;
}

/** Apakah `u` memegang `peran`, baik sebagai peran asli maupun sebagai PLH. */
export function punyaPeran(u, peran, hari = hariIniWita()) {
  return peranDipegang(u, hari).includes(peran);
}

/**
 * Memeriksa usulan penetapan PLH. Mengembalikan pesan kesalahan, atau null
 * bila sah. Dipakai peladen maupun peramban agar aturannya satu.
 */
export function periksaPenetapan({ peranPengampu, plh_untuk, plh_mulai, plh_selesai } = {}) {
  if (!plh_untuk) return "Peran yang diampu wajib dipilih.";
  if (!PERAN_DAPAT_DIAMPU.includes(plh_untuk))
    return "Peran tersebut tidak dapat diampu oleh PLH.";
  if (plh_untuk === peranPengampu)
    return "Pengampu sudah memegang peran tersebut.";

  const boleh = PENGAMPU_SAH[plh_untuk] || [];
  if (!boleh.includes(peranPengampu)) {
    return plh_untuk === "kabag"
      ? "Kabag hanya dapat diampu oleh Kasubbag."
      : "Peran pengampu tidak sesuai untuk jabatan tersebut.";
  }

  if (!plh_mulai || !plh_selesai) return "Tanggal mulai dan selesai wajib diisi.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plh_mulai) || !/^\d{4}-\d{2}-\d{2}$/.test(plh_selesai))
    return "Format tanggal harus YYYY-MM-DD.";
  if (plh_selesai < plh_mulai) return "Tanggal selesai tidak boleh mendahului tanggal mulai.";

  // Pendelegasian yang terlalu panjang menandakan jabatan yang sebenarnya
  // kosong, bukan pejabat yang sedang cuti — itu urusan pengisian jabatan.
  const hari = (new Date(plh_selesai) - new Date(plh_mulai)) / 86400000 + 1;
  if (hari > 90) return "Masa PLH paling lama 90 hari. Untuk masa lebih panjang, tempuh pengisian jabatan.";

  return null;
}

/**
 * Apakah `u` boleh memutus jadwal `ev` — diverifikasi maupun disetujui.
 *
 * Keadaan yang dicegah: Admin RK yang mengampu Kasubbag memasukkan jadwal,
 * lalu berwenang memverifikasi jadwal yang baru saja ia ajukan sendiri.
 * Pengajuan dan pemeriksaan jatuh pada satu orang, dan jejak auditnya
 * kehilangan makna. Antrian tidak ikut macet: Kabag dapat mengambil alih
 * tahap Kasubbag lewat sakelar yang sudah tersedia.
 *
 * Yang TIDAK dibatasi di sini: Kasubbag yang meneruskan sebuah jadwal lalu,
 * sebagai PLH Kabag, menyetujuinya. Dalam keadaan Kabag berhalangan memang
 * tidak ada orang lain — melarangnya berarti mematikan justru fungsi yang
 * hendak disediakan PLH. Pembatasannya hanya pada pengaju aslinya.
 */
export function bolehMemutus(u, ev, hari = hariIniWita()) {
  if (!u || !ev) return true;
  if (!plhAktif(u, hari)) return true;   // pejabat asli — tidak diatur di sini
  return ev.submittedBy !== u.username;
}

/**
 * Keterangan pendelegasian untuk dilekatkan pada jejak audit.
 *
 * Jejak audit tetap mencatat peran ASLI pelakunya; keterangan ini ditambahkan
 * di sebelahnya. Kalau PLH dicatat begitu saja sebagai "kabag", pembaca jejak
 * setahun kemudian akan mengira Kabag yang memutus.
 */
export function jejakPlh(u, hari = hariIniWita()) {
  const p = plhAktif(u, hari);
  if (!p) return null;
  return { atas_nama: p.untuk, plh_dasar: p.dasar || null };
}
