/**
 * scripts/cek-api.mjs — memastikan fungsi peladen benar-benar dapat dimuat
 *
 *   npm run cek:api
 *
 * LATAR
 *
 * api/package.json menyatakan "type": "commonjs", sedangkan package.json akar
 * menyatakan "type": "module". Berkas api/*.js karenanya ditranspilasi menjadi
 * CommonJS oleh pembangun Vercel, sementara berkas di src/ tetap ESM. Sebuah
 * api/*.js yang mengimpor dari src/ akan ditranspilasi menjadi require()
 * terhadap modul ESM, dan fungsinya MATI SAAT DIMUAT:
 *
 *   Error [ERR_REQUIRE_ESM]: require() of ES Module src/lib/plh.js
 *
 * Itu benar-benar terjadi pada 10–11 September 2026: /api/room-booking balas
 * 500 selama sekitar 18 jam, sehingga peminjaman ruangan, penerbitan token
 * sesi, dan penetapan PLH mati bersamaan. Satu-satunya gejala di layar
 * pengguna adalah "gagal memverifikasi akses pengelola".
 *
 * ALAT YANG SALAH — JANGAN DIPAKAI UNTUK MEMASTIKAN
 *
 * Mem-bundel dengan `esbuild --bundle` MENYESATKAN: esbuild menyisipkan
 * src/lib/plh.js ke dalam keluaran, sehingga require()-nya tidak pernah
 * terjadi dan hasilnya selalu bersih. `node --check` juga tidak memadai —
 * delapan berkas api lain memang gagal diperiksa Node karena memakai sintaks
 * ESM di dalam paket CommonJS, dan itu tidak masalah selama mereka tidak
 * mengimpor berkas ESM lain. Kekeliruan menyimpulkan dari kedua alat itulah
 * yang membuat kerusakan di atas lolos.
 *
 * YANG DIPERIKSA DI SINI
 *
 * 1. Statis — tidak boleh ada api/*.js (berekstensi .js) yang mengimpor dari
 *    src/. Kalau memang perlu, berkasnya harus berekstensi .mjs.
 * 2. Dinamis — setiap api/*.mjs benar-benar dimuat oleh Node sungguhan,
 *    beserta seluruh modul yang diimpornya.
 */

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const API = resolve("api");
const berkas = readdirSync(API).filter((n) => /\.(js|mjs)$/.test(n)).sort();
const salah = [];

// ── 1. Pemeriksaan statis ────────────────────────────────────────
const IMPOR_SRC = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["']\.\.\/src\//;
for (const n of berkas) {
  if (!n.endsWith(".js")) continue;
  const isi = readFileSync(resolve(API, n), "utf8");
  if (IMPOR_SRC.test(isi)) {
    salah.push(`${n} mengimpor dari src/ padahal berekstensi .js — ` +
               `ubah menjadi ${n.replace(/\.js$/, ".mjs")}, jika tidak ` +
               `fungsinya mati dengan ERR_REQUIRE_ESM di produksi.`);
  }
}

// ── 2. Pemuatan sungguhan ────────────────────────────────────────
let dimuat = 0;
for (const n of berkas.filter((x) => x.endsWith(".mjs"))) {
  try {
    const m = await import(resolve(API, n));
    if (typeof m.default !== "function") {
      salah.push(`${n} tidak mengekspor default berupa fungsi handler.`);
    } else dimuat++;
  } catch (e) {
    salah.push(`${n} gagal dimuat — ${e.code || ""} ${e.message.split("\n")[0]}`);
  }
}

const statis = berkas.filter((n) => n.endsWith(".js")).length;
console.log(`Diperiksa statis : ${statis} berkas .js`);
console.log(`Dimuat sungguhan : ${dimuat} berkas .mjs`);

if (salah.length) {
  console.error("\n✗ Ada masalah:");
  for (const s of salah) console.error("  • " + s);
  process.exit(1);
}
console.log("\n✓ Tidak ada api/*.js yang mengimpor src/, dan seluruh .mjs dapat dimuat.");
