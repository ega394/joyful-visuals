// Potret satu halaman/elemen HTML menjadi PNG/JPG.
//   node potret.mjs <berkas.html> <keluaran> <lebar> <tinggi> [pilih-id] [transparan]
import { chromium } from "/home/user/joyful-visuals/node_modules/playwright/index.mjs";
const [html, keluar, w, h, pilih, transparan] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
const p = await b.newPage({ viewport: { width: Number(w), height: Number(h) } });
p.on("pageerror", (e) => console.log("GALAT", e.message));
await p.goto("file://" + html);
await p.evaluate(() => window.siap);
if (pilih) await p.evaluate((x) => window.pilih(x), pilih);
await p.screenshot({ path: keluar, omitBackground: !!transparan, ...(keluar.endsWith(".jpg") ? { type: "jpeg", quality: 92 } : {}) });
await b.close();
