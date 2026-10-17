// node render.mjs pratinjau | penuh [id...] | latar
import { chromium } from "/home/user/joyful-visuals/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
const D = new URL("./", import.meta.url).pathname;
const [mode, ...pilih] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
p.on("pageerror", (e) => console.log("GALAT", e.message));
await p.goto("file://" + D + "grafis.html"); await p.waitForTimeout(300);
const ids = await p.evaluate(() => window.ADEGAN_ID), latar = await p.evaluate(() => window.LATAR_ID);
if (mode === "latar") {
  for (const id of latar) { await p.evaluate((i) => window.siapkan(i), id); await p.screenshot({ path: D + "gr/" + id + ".png" }); }
  console.log(JSON.stringify(await p.evaluate(() => window.LAYAR)));
} else for (const id of ids) {
  if (pilih.length && !pilih.includes(id)) continue;
  const dur = await p.evaluate((i) => window.siapkan(i), id);
  if (mode === "pratinjau") {
    for (const f of [0.35, 0.6, 0.98]) { const t = dur * f; await p.evaluate((x) => window.perbarui(x), t); await p.screenshot({ path: `${D}pratinjau/${id}_${Math.round(f * 100)}.jpg`, type: "jpeg", quality: 80 }); }
  } else {
    const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", "25", "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-r", "25", D + "gr/" + id + ".mp4"], { stdio: ["pipe", "inherit", "inherit"] });
    const n = Math.round(dur * 25), t0 = Date.now();
    for (let i = 0; i < n; i++) { await p.evaluate((x) => window.perbarui(x), i / 25); const buf = await p.screenshot({ type: "jpeg", quality: 93 }); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r)); }
    ff.stdin.end(); await new Promise((r) => ff.on("close", r));
    console.log(id, n, "bingkai", ((Date.now() - t0) / 1000).toFixed(0) + "s");
  }
}
await b.close();
