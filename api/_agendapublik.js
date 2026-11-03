// api/_agendapublik.js — agenda Wali Kota/Wakil Wali Kota hari ini untuk
// halaman masuk (publik, tanpa sesi). Dilayani lewat
// /api/guest?action=agenda_hari_ini (kuota 12 fungsi Vercel penuh).
//
// Keputusan Kabag (November 2026):
//  - Semua agenda yang telah disetujui pada hari ini (WITA).
//  - Tempat TIDAK ditampilkan. Bidang yang keluar hanya jam, nama acara,
//    pimpinan, dan keterangan bila diwakilkan — tanpa lokasi, pakaian,
//    catatan, personil, maupun berkas.
//  - Acara yang diwakilkan tetap tampil dengan keterangan "Diwakili …".
// Agenda yang ditandai tidak tampil di kalender bersama (`sembunyiKalender`)
// atau disembunyikan di Rekap WA (`tersembunyi`) ikut disaring. Pimpinan yang
// dinyatakan tidak hadir tanpa perwakilan tidak dicantumkan pada acara itu.

const { fmtJamDuaZona, epochMulai, epochSelesai } = require("./_zona.js");

function pimpinanPublik(e) {
  const untuk = e.untukPimpinan || [];
  const pim = [];
  if (untuk.includes("walikota")) {
    let ket = null;
    if (e.delegasiKeWWK) ket = "Diwakili Wakil Wali Kota";
    else if (e.statusWK === "diwakilkan") ket = "Diwakili " + (e.perwakilanWK || "pejabat yang ditunjuk");
    if (ket || e.statusWK !== "tidak_hadir") pim.push({ siapa: "Wali Kota", ket });
  }
  // Disposisi Wali Kota ke Wakil sudah tercantum sebagai keterangan di atas.
  if (untuk.includes("wakilwalikota") && !e.delegasiKeWWK) {
    let ket = null;
    if (e.delegasiWWKJajaran || e.statusWWK === "diwakilkan") ket = "Diwakili " + (e.perwakilanWWK || "pejabat yang ditunjuk");
    if (ket || e.statusWWK !== "tidak_hadir") pim.push({ siapa: "Wakil Wali Kota", ket });
  }
  return pim;
}

function agendaPublik(daftar) {
  const hasil = [];
  for (const e of daftar || []) {
    if (!e || e.alur !== "disetujui" || e.sembunyiKalender || e.tersembunyi) continue;
    const pimpinan = pimpinanPublik(e);
    if (!pimpinan.length) continue;
    const mulai = epochMulai(e);
    hasil.push({
      acara: String(e.namaAcara || "Agenda").slice(0, 200),
      jam: fmtJamDuaZona(e),
      mulai: Number.isNaN(mulai) ? null : mulai,
      selesai: Number.isNaN(mulai) ? null : epochSelesai(e),
      pimpinan,
    });
  }
  const k = (a) => (a.mulai == null ? Infinity : a.mulai);
  return hasil.sort((a, b) => k(a) - k(b));
}

module.exports = { agendaPublik };
