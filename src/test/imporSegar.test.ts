import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { chunkBasi, imporSegar, ambilAset, PESAN_BASI, bolehMuatUlangOtomatis } from "../lib/imporSegar.js";

describe("pemuatan malas setelah aplikasi diperbarui", () => {
  afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

  it("mengenali galat berkas basi dari Safari, Chrome, dan Firefox", () => {
    // Pesan persis dari laporan 21 Oktober 2026 (iPhone)
    expect(chunkBasi(new TypeError("'text/html' is not a valid JavaScript MIME type for module script 'https://prokopim.tarakankota.go.id/assets/pdfmake-ZrZWQz_J.js'."))).toBe(true);
    expect(chunkBasi(new TypeError("Importing a module script failed."))).toBe(true);
    expect(chunkBasi(new TypeError("Failed to fetch dynamically imported module: https://x/assets/a.js"))).toBe(true);
    expect(chunkBasi(new TypeError("error loading dynamically imported module: https://x/assets/a.js"))).toBe(true);
    expect(chunkBasi(new Error("Nomor surat kosong"))).toBe(false);
    expect(chunkBasi(null)).toBe(false);
  });

  it("imporSegar mengganti galat basi dengan pesan yang bisa ditindaklanjuti", async () => {
    const g = await imporSegar(() => Promise.reject(new TypeError("Importing a module script failed."))).catch((e) => e);
    expect(g.message).toBe(PESAN_BASI);
    expect(g.basi).toBe(true);
    await expect(imporSegar(() => Promise.reject(new Error("lain")))).rejects.toThrow("lain");
    await expect(imporSegar(() => Promise.resolve({ default: 1 }))).resolves.toEqual({ default: 1 });
  });

  it("aset yang dibalas index.html tidak ikut tertanam ke PDF", async () => {
    vi.stubGlobal("fetch", async () => new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }));
    await expect(ambilAset("/assets/arial-regular-abc.ttf")).rejects.toMatchObject({ basi: true });
    vi.stubGlobal("fetch", async () => new Response("x", { status: 404 }));
    await expect(ambilAset("/assets/arial-regular-abc.ttf")).rejects.toMatchObject({ basi: true });
    vi.stubGlobal("fetch", async () => new Response("ttf", { status: 200, headers: { "content-type": "font/ttf" } }));
    await expect(ambilAset("/assets/arial-regular-abc.ttf")).resolves.toBeInstanceOf(Response);
  });

  it("muat ulang otomatis paling banyak sekali per menit", () => {
    expect(bolehMuatUlangOtomatis(1_000_000)).toBe(true);
    expect(bolehMuatUlangOtomatis(1_030_000)).toBe(false);
    expect(bolehMuatUlangOtomatis(1_061_000)).toBe(true);
  });

  it("berkas /assets yang hilang dibalas 404, bukan index.html", () => {
    const v = JSON.parse(readFileSync("vercel.json", "utf8"));
    const spa = v.rewrites.find((r: { destination: string }) => r.destination === "/index.html");
    const pola = new RegExp("^" + spa.source + "$");
    expect(pola.test("/assets/pdfmake-ZrZWQz_J.js")).toBe(false);
    expect(pola.test("/tamu")).toBe(true);
    expect(pola.test("/pinjamruangan")).toBe(true);
  });
});
