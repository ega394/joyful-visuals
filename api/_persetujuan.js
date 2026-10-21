// api/_persetujuan.js — persetujuan Kebijakan Privasi & Ketentuan Penggunaan
// pada formulir publik (permohonan audiensi /tamu, peminjaman ruangan
// /pinjamruangan).
//
// UU 27/2022 tentang Pelindungan Data Pribadi meminta persetujuan yang
// eksplisit, untuk tujuan tertentu, dan dapat dibuktikan. Karena itu:
//  1. peladen menolak pengajuan yang tidak membawa `setuju_privasi: true`
//     (kotak centang di layar bisa dilewati dengan memanggil API langsung);
//  2. waktu persetujuan (jam peladen, bukan jam HP pemohon) dan versi
//     kebijakan yang berlaku disimpan bersama baris pengajuannya.
//
// CommonJS seperti _walog.js: dimuat api/guest.js (ditranspilasi menjadi
// require) maupun api/room-booking.mjs (`import persetujuan from ...`).
//
// Kolom: supabase-migrations/2026-10-21_persetujuan_privasi.sql. Bila migrasi
// belum dijalankan, pengajuan tetap disimpan tanpa kedua kolom itu — formulir
// warga tidak boleh mati karena urutan pemasangan.

// Sama dengan tanggal berlaku di src/pages/PrivasiPage.jsx (src/lib/persetujuan.js);
// src/test/persetujuan.test.ts memastikan keduanya tidak bercabang.
const VERSI_KEBIJAKAN = "13 Oktober 2026";

const PESAN_TOLAK =
  "Centang persetujuan Kebijakan Privasi dan Ketentuan Penggunaan terlebih dahulu.";

// Hanya nilai true sungguhan; "false", "0", atau string kosong bukan persetujuan.
function sudahSetuju(body) {
  return !!body && (body.setuju_privasi === true || body.setuju_privasi === "true");
}

function kolomPersetujuan(sekarang) {
  return {
    persetujuan_privasi_at: (sekarang || new Date()).toISOString(),
    persetujuan_versi: VERSI_KEBIJAKAN,
  };
}

function kolomBelumAda(e) {
  const m = String((e && e.message) || e || "");
  return /persetujuan_(privasi_at|versi)/.test(m) && /PGRST204|42703|column/i.test(m);
}

function tanpaKolom(baris) {
  const buang = (r) => {
    const salin = Object.assign({}, r);
    delete salin.persetujuan_privasi_at;
    delete salin.persetujuan_versi;
    return salin;
  };
  return Array.isArray(baris) ? baris.map(buang) : buang(baris);
}

// Simpan dengan kolom persetujuan; bila kolomnya belum ada, ulangi tanpa.
async function simpanDenganPersetujuan(simpan, baris) {
  try {
    return await simpan(baris);
  } catch (e) {
    if (!kolomBelumAda(e)) throw e;
    console.warn("[persetujuan] kolom belum ada — jalankan migrasi 2026-10-21_persetujuan_privasi.sql");
    return simpan(tanpaKolom(baris));
  }
}

module.exports = {
  VERSI_KEBIJAKAN, PESAN_TOLAK, sudahSetuju, kolomPersetujuan,
  kolomBelumAda, tanpaKolom, simpanDenganPersetujuan,
};
