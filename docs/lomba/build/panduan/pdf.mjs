// node pdf.mjs <masukan.html> <keluaran.pdf> [judul kaki halaman]
import { chromium } from "/home/user/joyful-visuals/node_modules/playwright/index.mjs";
const [masuk, keluar, judul = "Buku Petunjuk Aplikasi Prokopim Hibot"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
const p = await b.newPage();
await p.goto("file://" + masuk, { waitUntil: "load" });
await p.pdf({ path: keluar, format: "A4", printBackground: true, displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="width:100%;font-size:8px;color:#94A3B8;padding:0 15mm;display:flex;justify-content:space-between"><span>${judul}</span><span class="pageNumber"></span></div>`,
  margin: { top: "16mm", bottom: "18mm", left: "15mm", right: "15mm" } });
await b.close();
