// Perekam adegan aplikasi: screencast CDP (bingkai JPEG bercap waktu) + kursor tampak.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import * as M from "/home/user/joyful-visuals/docs/lomba/build/tangkapan/mock.mjs";
export { M };
export const OUT = new URL("./rek/", import.meta.url).pathname;

// Kursor dan riak klik, karena screencast tidak menampilkan penunjuk tetikus.
const KURSOR = `(() => {
  const pasang = () => {
    if (document.getElementById("__kursor")) return;
    const k = document.createElement("div"); k.id = "__kursor";
    k.style.cssText = "position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(201,168,76,.35);border:2.5px solid #C9A84C;z-index:2147483647;pointer-events:none;transition:transform .12s;transform:translate(-100px,-100px)";
    document.documentElement.appendChild(k);
    addEventListener("mousemove", (e) => { k.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)"; }, true);
    addEventListener("mousedown", (e) => {
      const r = document.createElement("div");
      r.style.cssText = "position:fixed;left:" + e.clientX + "px;top:" + e.clientY + "px;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:3px solid #C9A84C;z-index:2147483647;pointer-events:none;transition:all .45s ease-out;opacity:1";
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.width = r.style.height = "64px"; r.style.margin = "-32px 0 0 -32px"; r.style.opacity = "0"; });
      setTimeout(() => r.remove(), 600);
    }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", pasang); else pasang();
})();`;

import { chromium } from "/home/user/joyful-visuals/node_modules/playwright/index.mjs";
export async function mulai() { return chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--lang=id-ID"], env: { ...process.env, LANG: "id_ID.UTF-8", LANGUAGE: "id" } }); }
export async function konteks(b, st, vp, opsi = {}) {
  const ctx = await M.konteks(b, st, vp, { deviceScaleFactor: vp.width < 600 ? 2 : 1, ...opsi });
  await ctx.addInitScript(KURSOR);
  return ctx;
}
export const jeda = (p, ms) => p.waitForTimeout(ms);

/** Gerakkan kursor halus ke elemen lalu klik. */
export async function klik(p, loc, o = {}) {
  const l = loc.first ? loc.first() : loc;
  await l.scrollIntoViewIfNeeded().catch(() => {});
  const b = await l.boundingBox();
  if (!b) throw new Error("tak terlihat: " + loc);
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await p.mouse.move(x, y, { steps: o.langkah ?? 18 });
  await jeda(p, 180);
  await p.mouse.down(); await jeda(p, 60); await p.mouse.up();
  await jeda(p, o.ms ?? 500);
}
export async function ketik(p, loc, teks, o = {}) {
  await klik(p, loc, { ms: 150 });
  await loc.first().pressSequentially(teks, { delay: o.delay ?? 45 });
  await jeda(p, o.ms ?? 300);
}

/** Rekam `aksi` menjadi rek/<nama>.mp4 (25 fps, ukuran asli halaman). */
export async function rekam(p, nama, aksi) {
  const dir = OUT + nama + "/"; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cdp = await p.context().newCDPSession(p);
  const bingkai = [];
  cdp.on("Page.screencastFrame", async (f) => {
    bingkai.push({ t: f.metadata.timestamp, data: f.data });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1 });
  await jeda(p, 400);
  await aksi();
  await jeda(p, 700);
  const akhir = Date.now() / 1000;
  await cdp.send("Page.stopScreencast");
  if (!bingkai.length) throw new Error("tak ada bingkai");
  let daftar = "";
  bingkai.forEach((f, i) => {
    const fn = String(i).padStart(5, "0") + ".jpg";
    fs.writeFileSync(dir + fn, Buffer.from(f.data, "base64"));
    const dur = (i + 1 < bingkai.length ? bingkai[i + 1].t : akhir) - f.t;
    daftar += `file '${fn}'\nduration ${Math.max(dur, 0.001).toFixed(4)}\n`;
  });
  daftar += `file '${String(bingkai.length - 1).padStart(5, "0")}.jpg'\n`;
  fs.writeFileSync(dir + "daftar.txt", daftar);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", dir + "daftar.txt",
    "-vf", "fps=25,scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", OUT + nama + ".mp4"]);
  const durasi = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", OUT + nama + ".mp4"]).toString().trim();
  console.log("rekam", nama, bingkai.length, "bingkai,", durasi, "detik");
}

import * as D from "/home/user/joyful-visuals/docs/lomba/build/tangkapan/data.mjs";
export { D };
// Kegiatan yang mengalir dari adegan 6 sampai 10.
export const ACARA = { ...structuredClone(D.JADWAL[0]), id: 1789000000001, tanggal: D.tgl(1), jam: "09:00", jamSelesai: "11:00", zona: "WITA",
  namaAcara: "Rapat Koordinasi Persiapan Hari Jadi Kota Tarakan", penyelenggara: "Bagian Tata Pemerintahan", kontak: "Rudi 0812-0000-8008",
  buktiUndangan: "000.1.5/402/TAPEM/2026", lokasi: "Ruang Imbaya, Kantor Wali Kota Tarakan", jenisKegiatan: "Pengarahan", pakaian: "PDH",
  untukPimpinan: ["walikota"], statusWK: null, statusWWK: null, personil: [], undanganFile: D.UNDANGAN_URL, undanganNama: "Undangan-Rakor-Hari-Jadi.pdf", timeline: [] };
export function keadaan(alur, lain = {}) { const st = M.buatState(); st.jadwal.set(String(ACARA.id), { ...structuredClone(ACARA), alur, ...lain }); return st; }
