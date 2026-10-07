// Peladen tiruan: Supabase REST, /api/*, Apps Script daftar hadir, cuaca.
import fs from "node:fs";
import { chromium } from "playwright";
import * as D from "./data.mjs";

export const BASE = "http://127.0.0.1:4180";
const PDF = fs.readFileSync(new URL("./undangan-contoh.pdf", import.meta.url));

export function buatState() {
  return {
    jadwal: new Map(D.JADWAL.map((e) => [String(e.id), structuredClone(e)])),
    users: structuredClone(D.USERS),
    bookings: structuredClone(D.BOOKINGS),
    tamu: structuredClone(D.TAMU),
  };
}
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

export async function pasang(ctx, st) {
  await ctx.route("https://contoh.supabase.co/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), m = req.method();
    if (url.pathname.startsWith("/storage/")) {
      if (m === "GET") return route.fulfill({ status: 200, contentType: "application/pdf", body: PDF });
      return json(route, { Key: "x" });
    }
    const tabel = url.pathname.split("/").pop();
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    if (tabel === "jadwal") {
      if (m === "GET") {
        if (url.search.includes("updated_at=gt")) return json(route, []);
        const off = +(url.searchParams.get("offset") || 0);
        const rows = off ? [] : [...st.jadwal.values()].map((d) => ({ data: d, updated_at: "2026-10-06T00:00:00+00:00" }));
        return json(route, rows);
      }
      if (m === "POST") { for (const r of [].concat(body)) st.jadwal.set(String(r.id), r.data); return json(route, [], 201); }
      if (m === "DELETE") return json(route, []);
    }
    if (tabel === "users") {
      if (m === "GET") return json(route, st.users);
      if (m === "POST") { for (const u of [].concat(body)) { const i = st.users.findIndex((x) => x.username === u.username); if (i >= 0) st.users[i] = { ...st.users[i], ...u }; } return json(route, [], 201); }
      return json(route, []);
    }
    return json(route, m === "GET" ? [] : {});
  });

  await ctx.route(BASE + "/api/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), m = req.method(), q = url.searchParams;
    const ep = url.pathname.replace("/api/", "");
    if (ep === "room-booking") {
      if (q.get("op") === "rooms") return json(route, D.ROOMS);
      if (q.get("op") === "auth") {
        const b = JSON.parse(req.postData() || "{}"); const u = st.users.find((x) => x.username === b.username);
        return json(route, { ok: true, token: "tok-" + b.username, ttl_ms: 43200000, username: b.username, nama: u?.nama, role: u?.role, can_manage_rooms: !!u?.can_manage_rooms });
      }
      if (q.get("op") === "internal") return json(route, { ok: true, booking_code: "INT00001" }, 201);
      if (m === "GET" && q.get("admin") === "1") return json(route, st.bookings);
      if (m === "GET" && q.get("code")) return json(route, st.bookings.filter((b) => b.booking_code === q.get("code").toUpperCase()));
      if (m === "GET") {
        const mon = q.get("month") || "2026-10";
        return json(route, st.bookings.filter((b) => b.start_date.startsWith(mon) && ["Pending", "Approved"].includes(b.status)));
      }
      return json(route, { ok: true });
    }
    if (ep === "guest") {
      if (m === "GET") {
        const s = q.get("status"); const p = q.get("pimpinan");
        let r = st.tamu;
        if (s && s !== "all") r = r.filter((x) => x.status === s);
        if (p) r = r.filter((x) => x.tujuan_pejabat === (p === "wakilwalikota" ? "Wakil Wali Kota" : "Wali Kota"));
        return json(route, r);
      }
      return json(route, { ok: true });
    }
    if (ep.startsWith("jarak")) return json(route, { ok: true, distance: "4,2 km", duration: "12 menit" });
    return json(route, { ok: true });
  });

  await ctx.route("https://absen.contoh/**", async (route) => {
    const url = new URL(route.request().url()); const a = url.searchParams.get("action");
    if (a === "acara") return json(route, { ok: true, acara: D.ACARA_HADIR });
    if (a === "daftar_acara") return json(route, { ok: true, acara: D.DAFTAR_ACARA, sheetUrl: "https://docs.google.com/spreadsheets/d/contoh" });
    return json(route, { ok: true });
  });

  await ctx.route("https://api.openweathermap.org/**", (route) => {
    const now = { cod: 200, weather: [{ description: "berawan", icon: "03d", main: "Clouds" }], main: { temp: 30.4, feels_like: 34.1, humidity: 74 }, wind: { speed: 2.1 }, name: "Tarakan", dt: 1791247200 };
    if (route.request().url().includes("/forecast")) return json(route, { cod: "200", list: Array.from({ length: 40 }, (_, i) => ({ ...now, dt: 1791247200 + i * 10800, dt_txt: "2026-10-06 00:00:00", pop: 0.2 })) , city: { name: "Tarakan" } });
    return json(route, now);
  });
}

export async function mulai() {
  const b = await chromium.launch({ args: ["--no-sandbox", "--lang=id-ID"], env: { ...process.env, LANG: "id_ID.UTF-8", LANGUAGE: "id" } });
  return b;
}
export async function konteks(b, st, vp, opsi = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, locale: "id-ID", timezoneId: "Asia/Makassar", serviceWorkers: "block", isMobile: vp.width < 600, hasTouch: vp.width < 600, ...opsi });
  await pasang(ctx, st);
  return ctx;
}
export async function halaman(ctx, jam = "08:40") {
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date(`2026-10-06T${jam}:00+08:00`));
  p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  return p;
}
export async function masuk(p, u, pw) {
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  const i = p.locator("input");
  await i.nth(0).fill(u); await i.nth(1).fill(pw);
  await p.getByRole("button", { name: /masuk|login/i }).first().click();
  await p.waitForTimeout(2500);
  for (const re of [/Siap, Mulai/i, /Nanti saja/i, /Lewati/i, /Tutup/i]) {
    const m = p.getByRole("button", { name: re }); if (await m.count()) { await m.first().click().catch(() => {}); await p.waitForTimeout(400); }
  }
  await p.evaluate(() => document.querySelectorAll("button").forEach((x) => { if (x.textContent.trim() === "✕") x.click(); }));
  await p.waitForTimeout(500);
}
