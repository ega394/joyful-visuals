import { chromium } from "/home/user/joyful-visuals/node_modules/playwright/index.mjs";
const D = new URL("./", import.meta.url).pathname;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto("file://" + D + "sampul.html"); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
await p.screenshot({ path: D + "keluaran/Sampul-Prokopim-Hibot-Kaltara-2026.png" });
await p.screenshot({ path: D + "keluaran/Sampul-Prokopim-Hibot-Kaltara-2026.jpg", type: "jpeg", quality: 92 });
await b.close();
