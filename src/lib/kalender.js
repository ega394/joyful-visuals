/**
 * src/lib/kalender.js — aturan isi Google Calendar bersama agenda Pimpinan.
 *
 * Kalender ini dilanggani banyak orang, jadi yang menentukan adalah APA YANG
 * BOLEH TERLIHAT, bukan sekadar menyalin jadwal:
 *
 *   - Hanya jadwal berstatus "disetujui" yang dikirim; jadwal yang ditandai
 *     "Tidak ditampilkan" (`sembunyiKalender`) oleh Kabag atau Kasubbag
 *     Komdokpim tidak pernah dikirim, dan dicabut bila sudah terlanjur.
 *     Penanda `tersembunyi` milik Rekap WA sengaja TIDAK berpengaruh di sini:
 *     Rekap WA dapat dibuka hampir semua peran.
 *   - Hanya jadwal mulai HARI INI ke depan. Riwayat lama tidak diisikan, dan
 *     acara yang sudah lewat tidak disentuh lagi (tidak dihapus, tidak diubah).
 *   - Judul acara hanya nama acaranya, tanpa awalan [WK]/[WWK]; pimpinan yang
 *     hadir dicantumkan pada rincian acara.
 *   - Tidak ada acara ganda: jadwal kembar di aplikasi (tanggal, jam mulai,
 *     dan nama acara sama) hanya dikirim satu, dan salinan manual lama di
 *     kalender yang kembar dengan kiriman aplikasi dihapus. Lihat normJudul.
 *   - Yang ikut: nama acara, waktu, lokasi, pimpinan yang hadir, jenis
 *     kegiatan, penyelenggara, pakaian. Nomor narahubung, catatan internal,
 *     dan nomor surat TIDAK ikut — pelanggan kalender bukan pengguna aplikasi.
 *
 * Aturan murni di sini, tanpa jaringan, supaya dapat diuji. Pemanggilan
 * Google ada di api/_kalender.mjs.
 */

export const ZONA = "Asia/Makassar";
export const DURASI_BAWAAN = 120; // menit — sama dengan DURASI_DEFAULT di aplikasi
export const PENANDA = "prokopim";  // extendedProperties.private — hanya acara bertanda ini yang disentuh

/**
 * ID acara Google Calendar yang tetap untuk satu jadwal.
 *
 * Google hanya menerima huruf a–v dan angka 0–9, panjang 5–1024. Karena ID
 * diturunkan dari nomor jadwal, pengiriman ulang tidak pernah menggandakan
 * acara — cukup memperbarui yang sudah ada.
 */
export function idAcara(idJadwal) {
  const bersih = String(idJadwal ?? "").toLowerCase().replace(/[^a-v0-9]/g, "");
  return PENANDA + (bersih || "0");
}

const menit = (jam) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(jam || "");
  return m ? +m[1] * 60 + +m[2] : null;
};

/** Pimpinan yang benar-benar hadir, memperhitungkan disposisi kepada Wakil. */
export function pimpinanHadir(ev) {
  const s = new Set(Array.isArray(ev?.untukPimpinan) ? ev.untukPimpinan : []);
  if (ev?.delegasiKeWWK && s.has("walikota")) { s.delete("walikota"); s.add("wakilwalikota"); }
  return ["walikota", "wakilwalikota"].filter((p) => s.has(p));
}


/** Apakah jadwal ini semestinya ada di kalender pada `hariIni` (YYYY-MM-DD WITA). */
export function perluAda(ev, hariIni) {
  return !!ev && ev.alur === "disetujui" && !ev.sembunyiKalender
    && typeof ev.tanggal === "string" && ev.tanggal >= hariIni;
}

// ── Acara ganda ───────────────────────────────────────────────────
// Dua acara dianggap sama bila tanggal, jam mulai (WITA), dan nama acaranya
// sama — tanpa membedakan huruf besar-kecil, tanda baca, spasi, dan awalan
// [WK]/[WWK] yang dulu dipakai. Sengaja ketat: acara yang hanya mirip tidak
// pernah dianggap ganda.

/** Nama acara yang dinormalkan untuk pembandingan. */
export function normJudul(s) {
  return String(s || "").toLowerCase()
    .replace(/^\s*(\[\s*w?wk\s*\]\s*)+/, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

/** Kunci pembanding satu jadwal: "YYYY-MM-DDTHH:MM|nama acara". */
export function kunciAgenda(ev) {
  const a = isiAcara(ev);
  return a.start.dateTime.slice(0, 16) + "|" + normJudul(a.summary);
}

/**
 * Kunci pembanding satu acara Google Calendar, atau null bila tidak dapat
 * dibandingkan (acara sehari penuh, waktu tanpa zona). null berarti acara itu
 * tidak pernah dianggap ganda.
 */
export function kunciAcaraGoogle(a) {
  const dt = a?.start?.dateTime;
  if (typeof dt !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(dt)) return null;
  const t = Date.parse(dt);
  if (Number.isNaN(t)) return null;
  return new Date(t + 8 * 3600e3).toISOString().slice(0, 16) + "|" + normJudul(a.summary);
}

const urutId = (a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true });

/**
 * Dari jadwal yang semestinya tampil, satu saja untuk setiap kunci — yang
 * paling awal diinput. Jadwal kembar tetap utuh di aplikasi; hanya kalender
 * yang menerima satu.
 */
export function pilihUnik(daftar) {
  const per = new Map();
  for (const ev of [...daftar].sort(urutId)) {
    const k = kunciAgenda(ev);
    if (!per.has(k)) per.set(k, ev);
  }
  return [...per.values()];
}

/** Tanggal + menit sejak tengah malam → "YYYY-MM-DDTHH:MM:00", menggeser hari bila lewat 24.00. */
function waktu(tanggal, m) {
  const [y, mo, d] = tanggal.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0) + m * 60000);
  const p = (n) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}T${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:00`;
}

// Sidik isi, supaya pencocokan berkala hanya menulis ulang acara yang berubah.
function sidik(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}

const NAMA = { walikota: "Wali Kota", wakilwalikota: "Wakil Wali Kota" };

/** Isi acara Google Calendar untuk satu jadwal. */
export function isiAcara(ev) {
  const mulai = menit(ev.jam) ?? 8 * 60;
  const akhirJam = menit(ev.jamSelesai);
  const selesai = akhirJam != null && akhirJam > mulai ? akhirJam : mulai + DURASI_BAWAAN;
  const hadir = pimpinanHadir(ev);

  const keterangan = [
    hadir.length && `Pimpinan: ${hadir.map((p) => NAMA[p]).join(" dan ")}` +
      (ev.delegasiKeWWK ? " (didisposisikan Wali Kota)" : ""),
    ev.jenisKegiatan && `Jenis kegiatan: ${ev.jenisKegiatan}`,
    ev.penyelenggara && `Penyelenggara: ${ev.penyelenggara}`,
    ev.pakaian && `Pakaian: ${ev.pakaian}`,
    "",
    "Agenda resmi yang telah disetujui melalui Prokopim Hibot, Bagian Protokol dan Komunikasi Pimpinan Setda Kota Tarakan.",
  ].filter((x) => x !== false && x !== null && x !== undefined && x !== 0).join("\n");

  const inti = {
    summary: ev.namaAcara || "Kegiatan Pimpinan",
    location: ev.lokasi || "",
    description: keterangan,
    start: { dateTime: waktu(ev.tanggal, mulai), timeZone: ZONA },
    end: { dateTime: waktu(ev.tanggal, selesai), timeZone: ZONA },
  };
  return {
    ...inti,
    status: "confirmed",
    extendedProperties: { private: { [PENANDA]: "1", jadwal: String(ev.id), sidik: sidik(JSON.stringify(inti)) } },
  };
}
