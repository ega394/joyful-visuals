// Render grafis.html per bingkai.
//   KERJA=<folder> node render.mjs pratinjau 12.5 40 ...   -> KERJA/pratinjau/t<detik>.jpg
//   KERJA=<folder> node render.mjs penuh [pekerja]          -> KERJA/segmen/s<n>.mp4 (dibagi rata antarpekerja)
import { chromium } from "/home/user/joyful-visuals/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import fs from "node:fs";

const KERJA = process.env.KERJA || new URL("./", import.meta.url).pathname;
const [mode = "pratinjau", ...arg] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--allow-file-access-from-files", "--disable-web-security"] });

async function halaman() {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on("pageerror", (e) => console.log("GALAT", e.message));
  p.on("console", (m) => { if (m.type() === "error") console.log("KONSOL", m.text()); });
  await p.goto("file://" + KERJA + "/grafis.html");
  await p.evaluate(() => window.siap);
  return p;
}

if (mode === "pratinjau") {
  fs.mkdirSync(KERJA + "/pratinjau", { recursive: true });
  const p = await halaman();
  for (const t of arg.map(Number)) {
    await p.evaluate((x) => window.perbarui(x), t);
    await p.screenshot({ path: `${KERJA}/pratinjau/t${t.toFixed(2)}.jpg`, type: "jpeg", quality: 85 });
  }
} else {
  const total = await (await halaman()).evaluate(() => window.TOTAL);
  const N = Math.round(total * 25), W = Number(arg[0] || 4), per = Math.ceil(N / W);
  fs.mkdirSync(KERJA + "/segmen", { recursive: true });
  const t0 = Date.now();
  await Promise.all(Array.from({ length: W }, async (_, w) => {
    const a = w * per, z = Math.min(N, a + per);
    const p = await halaman();
    const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", "25", "-c:v", "mjpeg", "-i", "-",
      "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-r", "25", `${KERJA}/segmen/s${w}.mp4`], { stdio: ["pipe", "inherit", "inherit"] });
    for (let i = a; i < z; i++) {
      await p.evaluate((x) => window.perbarui(x), i / 25);
      const buf = await p.screenshot({ type: "jpeg", quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      if ((i - a) % 250 === 0) console.log(`pekerja ${w}: ${i - a}/${z - a}  ${((Date.now() - t0) / 1000).toFixed(0)} dtk`);
    }
    ff.stdin.end(); await new Promise((r) => ff.on("close", r));
  }));
  fs.writeFileSync(`${KERJA}/segmen/daftar.txt`, Array.from({ length: W }, (_, w) => `file 's${w}.mp4'`).join("\n") + "\n");
  console.log("selesai", N, "bingkai", ((Date.now() - t0) / 1000).toFixed(0), "dtk");
}
await b.close();
