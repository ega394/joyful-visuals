// ============================================================
//  api/_zona.js — format jam berzona untuk api/*.js (CommonJS)
//
//  api/*.js ditranspilasi menjadi CommonJS oleh Vercel sehingga tidak boleh
//  mengimpor dari src/ (lihat scripts/cek-api.mjs). Berkas ini salinan kecil
//  fmtJamDuaZona dari src/lib/zona.js; kesamaannya dijaga oleh
//  src/test/zona.test.ts. Ubah keduanya bersamaan.
// ============================================================

const SELISIH = { WIB: 7, WITA: 8, WIT: 9 };
const p2 = (n) => String(n).padStart(2, "0");
const menit = (jam) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(jam || "");
  return m ? +m[1] * 60 + +m[2] : null;
};
const zonaSah = (z) => (Object.prototype.hasOwnProperty.call(SELISIH, z) ? z : "WITA");

function ubah(jam, dari, ke) {
  const m = menit(jam);
  if (m == null) return { jam: jam || "", hari: 0 };
  let x = m + (SELISIH[ke] - SELISIH[dari]) * 60;
  const hari = Math.floor(x / 1440);
  x -= hari * 1440;
  return { jam: p2(Math.floor(x / 60)) + ":" + p2(x % 60), hari };
}

function rentang(ev, ke) {
  const z = zonaSah(ev.zona);
  const a = ubah(ev.jam, z, ke);
  const ma = menit(ev.jam), mb = menit(ev.jamSelesai);
  const sah = ma != null && mb != null && mb > ma;
  return { teks: sah ? a.jam + " – " + ubah(ev.jamSelesai, z, ke).jam : a.jam, hari: a.hari };
}

const tandaHari = (h) => (h < 0 ? " (sehari sebelumnya)" : h > 0 ? " (keesokan harinya)" : "");

/** "09:00 WITA", atau "09:00 WIB (10:00 WITA)" untuk acara di zona lain. */
function fmtJamDuaZona(ev, opsi) {
  const wita = !(opsi && opsi.wita === false);
  if (!ev || !ev.jam) return "";
  const z = zonaSah(ev.zona);
  const asli = rentang(ev, z).teks;
  if (z === "WITA") return wita ? asli + " WITA" : asli;
  const w = rentang(ev, "WITA");
  return asli + " " + z + " (" + w.teks + " WITA" + tandaHari(w.hari) + ")";
}

module.exports = { fmtJamDuaZona };
