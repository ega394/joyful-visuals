import { describe, it, expect } from "vitest";
import { namaPerangkat, dibatalkan } from "../lib/caraMasuk.js";

describe("namaPerangkat", () => {
  it("mengenali perangkat dan peramban yang umum", () => {
    expect(namaPerangkat("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")).toBe("iPhone · Safari");
    expect(namaPerangkat("Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36")).toBe("Android · Samsung Internet");
    expect(namaPerangkat("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36")).toBe("Android · Chrome");
    expect(namaPerangkat("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0")).toBe("Windows · Edge");
    expect(namaPerangkat("")).toBe("Perangkat");
  });
});

describe("dibatalkan", () => {
  it("menutup jendela sidik jari tidak dianggap galat", () => {
    expect(dibatalkan({ name: "NotAllowedError" })).toBe(true);
    expect(dibatalkan(new Error("lain"))).toBe(false);
  });
});
