/**
 * Zona waktu acara — WIB, WITA, WIT.
 *
 * Jam acara disimpan apa adanya menurut undangan (`jam`, `jamSelesai`), dan
 * zonanya di `zona`. Jadwal lama tanpa `zona` dianggap WITA, sehingga tidak
 * ada data yang perlu dimigrasi.
 *
 * Tampilan di layar mengikuti zona perangkat pengguna: staf di Tarakan melihat
 * "10:00 WITA (09:00 WIB setempat)", sedangkan Pimpinan yang sedang di Jakarta
 * melihat "09:00 WIB". Pesan WA dan notifikasi tidak tahu di mana penerimanya,
 * jadi memakai jam setempat ditambah padanan WITA.
 *
 * Indonesia tidak memakai waktu musim panas, jadi selisih tetap dan cukup
 * dihitung dengan angka; tidak perlu basis data zona waktu. Modul murni tanpa
 * DOM agar dapat dipakai juga oleh fungsi peladen di api/.
 */

export const ZONA = {
  WIB: { selisih: 7, tz: "Asia/Jakarta" },
  WITA: { selisih: 8, tz: "Asia/Makassar" },
  WIT: { selisih: 9, tz: "Asia/Jayapura" },
};
export const DAFTAR_ZONA = ["WIB", "WITA", "WIT"];
export const ZONA_BAWAAN = "WITA";
const DURASI_BAWAAN = 120; // menit — sama dengan DURASI_BAWAAN di lib/kalender.js

const p2 = (n) => String(n).padStart(2, "0");
const menit = (jam) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(jam || "");
  return m ? +m[1] * 60 + +m[2] : null;
};

/** Zona yang sah, atau WITA bila kosong/tidak dikenal. */
export const zonaSah = (z) => (Object.prototype.hasOwnProperty.call(ZONA, z) ? z : ZONA_BAWAAN);
/** Zona satu acara. */
export const zonaAcara = (ev) => zonaSah(ev && ev.zona);
/** Zona IANA untuk kalender dan Intl. */
export const tzZona = (z) => ZONA[zonaSah(z)].tz;

/**
 * Zona perangkat pengguna dari selisih jam lokalnya. Perangkat di luar
 * Indonesia (selisih selain +7/+8/+9) tetap ditampilkan dalam WITA, waktu kantor.
 */
export function zonaPerangkat(saat = new Date()) {
  const s = -saat.getTimezoneOffset() / 60;
  return s === 7 ? "WIB" : s === 9 ? "WIT" : "WITA";
}

const jamSelesaiSah = (ev) => {
  const a = menit(ev && ev.jam), b = menit(ev && ev.jamSelesai);
  return a != null && b != null && b > a;
};

/** "HH:MM" dari zona `dari` ke zona `ke`; `hari` = -1/0/1 bila melewati tengah malam. */
export function ubahJam(jam, dari, ke) {
  const m = menit(jam);
  if (m == null) return { jam: jam || "", hari: 0 };
  let x = m + (ZONA[zonaSah(ke)].selisih - ZONA[zonaSah(dari)].selisih) * 60;
  const hari = Math.floor(x / 1440);
  x -= hari * 1440;
  return { jam: p2(Math.floor(x / 60)) + ":" + p2(x % 60), hari };
}

/** Jam mulai dan selesai satu acara menurut zona `ke`. */
export function jamMenurut(ev, ke) {
  const z = zonaAcara(ev);
  const a = ubahJam(ev && ev.jam, z, ke);
  const b = jamSelesaiSah(ev) ? ubahJam(ev.jamSelesai, z, ke) : null;
  return { mulai: a.jam, selesai: b ? b.jam : "", hari: a.hari, teks: b ? a.jam + " – " + b.jam : a.jam };
}

const tandaHari = (h) => (h < 0 ? " (sehari sebelumnya)" : h > 0 ? " (keesokan harinya)" : "");

/**
 * Untuk layar: menurut zona perangkat, ditambah jam setempat bila zonanya beda.
 *   "09:00 – 11:00 WITA"
 *   "10:00 – 12:00 WITA (09:00 – 11:00 WIB setempat)"
 */
export function fmtJamZona(ev, ke = zonaPerangkat()) {
  if (!ev || !ev.jam) return "";
  const z = zonaAcara(ev);
  const lihat = jamMenurut(ev, ke);
  const teks = lihat.teks + " " + ke + tandaHari(lihat.hari);
  return z === ke ? teks : teks + " (" + jamMenurut(ev, z).teks + " " + z + " setempat)";
}

/**
 * Untuk WA, notifikasi, dan cetakan — penerimanya tidak diketahui tempatnya:
 * jam setempat, ditambah padanan WITA bila acaranya di zona lain.
 *   "09:00 – 11:00 WITA"  (atau "09:00 – 11:00" bila `wita: false`)
 *   "09:00 – 11:00 WIB (10:00 – 12:00 WITA)"
 */
export function fmtJamDuaZona(ev, { wita = true } = {}) {
  if (!ev || !ev.jam) return "";
  const z = zonaAcara(ev);
  const asli = jamMenurut(ev, z).teks;
  if (z === "WITA") return wita ? asli + " WITA" : asli;
  const w = jamMenurut(ev, "WITA");
  return asli + " " + z + " (" + w.teks + " WITA" + tandaHari(w.hari) + ")";
}

/** Saat mulai acara (milidetik epoch), atau NaN bila tanggal/jam kosong. */
export function epochMulai(ev) {
  if (!ev || !ev.tanggal || menit(ev.jam) == null) return NaN;
  const [h, m] = ev.jam.split(":");
  return Date.parse(`${ev.tanggal}T${p2(+h)}:${m.slice(0, 2)}:00+${p2(ZONA[zonaAcara(ev)].selisih)}:00`);
}

/** Saat selesai acara; dua jam sesudah mulai bila jam selesai tidak diketahui. */
export function epochSelesai(ev) {
  const a = epochMulai(ev);
  if (Number.isNaN(a)) return NaN;
  return jamSelesaiSah(ev) ? a + (menit(ev.jamSelesai) - menit(ev.jam)) * 60000 : a + DURASI_BAWAAN * 60000;
}

/** Menit sejak tengah malam WITA pada `tanggal` acara (bisa < 0 atau ≥ 1440). */
export function menitWita(ev) {
  const a = epochMulai(ev);
  if (Number.isNaN(a)) return null;
  return Math.round((a - Date.parse(`${ev.tanggal}T00:00:00+08:00`)) / 60000);
}

/** Kunci urut: tanggal acara, lalu jam mulai dalam satu patokan (WITA). */
export function kunciUrut(ev) {
  const m = menitWita(ev);
  return (ev && ev.tanggal || "") + "|" + String((m == null ? -5000 : m) + 5000).padStart(5, "0");
}
export const urutAcara = (a, b) => kunciUrut(a).localeCompare(kunciUrut(b));

/** Dua acara bertumpuk waktunya, memperhitungkan zona masing-masing. */
export function waktuBertumpuk(a, b) {
  const a1 = epochMulai(a), a2 = epochSelesai(a), b1 = epochMulai(b), b2 = epochSelesai(b);
  if ([a1, a2, b1, b2].some(Number.isNaN)) return false;
  return a1 < b2 && a2 > b1;
}

// ── Menebak zona dari teks ─────────────────────────────────────────

// Kota dan provinsi yang sering muncul pada undangan luar daerah. Tidak perlu
// lengkap: hasilnya hanya saran yang dikonfirmasi Admin RK.
const KOTA = {
  WIB: [
    "jakarta", "dki", "bogor", "depok", "bekasi", "tangerang", "serang", "banten", "bandung", "jawa barat",
    "semarang", "jawa tengah", "solo", "surakarta", "yogyakarta", "jogja", "diy", "surabaya", "malang",
    "jawa timur", "aceh", "banda aceh", "medan", "sumatera", "padang", "pekanbaru", "riau", "batam",
    "tanjungpinang", "tanjung pinang", "jambi", "palembang", "bengkulu", "lampung", "pangkalpinang",
    "bangka", "belitung", "pontianak", "kalimantan barat", "kalbar", "palangka raya", "palangkaraya",
    "kalimantan tengah", "kalteng",
  ],
  WITA: [
    "tarakan", "tanjung selor", "bulungan", "nunukan", "malinau", "tana tidung", "kalimantan utara", "kaltara",
    "samarinda", "balikpapan", "bontang", "kalimantan timur", "kaltim", "nusantara", "ikn", "banjarmasin",
    "banjarbaru", "kalimantan selatan", "kalsel", "bali", "denpasar", "badung", "mataram", "lombok", "ntb",
    "kupang", "ntt", "makassar", "sulawesi", "manado", "palu", "kendari", "gorontalo", "mamuju",
  ],
  WIT: [
    "ambon", "maluku", "ternate", "sofifi", "jayapura", "papua", "sorong", "manokwari", "merauke",
    "timika", "nabire", "biak", "wamena",
  ],
};

/** Zona dari nama kota/provinsi di lokasi, atau null bila tidak dikenal atau ambigu. */
export function tebakZonaLokasi(lokasi) {
  const s = " " + String(lokasi || "").toLowerCase().replace(/[^a-z0-9]+/g, " ") + " ";
  const ada = DAFTAR_ZONA.filter((z) => KOTA[z].some((k) => s.includes(" " + k + " ")));
  return ada.length === 1 ? ada[0] : null;
}

// ── Pembantu tampilan ringkas ─────────────────────────────────────

/** Saat mulai acara sebagai Date (Invalid Date bila tanggal/jam kosong). */
export const tglAcara = (ev) => new Date(epochMulai(ev));
/** Jam mulai menurut zona perangkat: "10:00". */
export const jamMulaiLayar = (ev, ke = zonaPerangkat()) => (ev && ev.jam ? jamMenurut(ev, ke).mulai : "");
/** Jam selesai menurut zona perangkat, atau "" bila tidak diketahui. */
export const jamSelesaiLayar = (ev, ke = zonaPerangkat()) => (ev && ev.jam ? jamMenurut(ev, ke).selesai : "");
/** "09:00 WIB setempat" bila zona acara berbeda dari zona perangkat, selain itu "". */
export function keteranganSetempat(ev, ke = zonaPerangkat()) {
  const z = zonaAcara(ev);
  return !ev || !ev.jam || z === ke ? "" : jamMenurut(ev, z).teks + " " + z + " setempat";
}
