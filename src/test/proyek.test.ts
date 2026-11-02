import { describe, it, expect } from "vitest";
import { proyekResmi } from "../../api/_proyek.mjs";

describe("jadwal otomatis hanya di proyek resmi", () => {
  it("proyek resmi (domain kustom) berjalan", () => {
    expect(proyekResmi({ VERCEL_PROJECT_PRODUCTION_URL: "prokopim.tarakankota.go.id" })).toBe(true);
    expect(proyekResmi({ VERCEL_PROJECT_PRODUCTION_URL: "https://prokopim.tarakankota.go.id/" })).toBe(true);
    expect(proyekResmi({ VERCEL_PROJECT_PRODUCTION_URL: "jadwal-pimpinan-anugrahyegapranatha-1962s-projects.vercel.app" })).toBe(true);
  });
  it("proyek lama joyfulprokopim dilewati", () => {
    expect(proyekResmi({ VERCEL_PROJECT_PRODUCTION_URL: "joyfulprokopim-anugrahyegapranatha-1962s-projects.vercel.app" })).toBe(false);
    expect(proyekResmi({ VERCEL_PROJECT_PRODUCTION_URL: "joyfulprokopim.vercel.app" })).toBe(false);
  });
  it("tanpa variabel sistem: dikenali dari VERCEL_URL atau Host", () => {
    expect(proyekResmi({}, "joyfulprokopim-anugrahyegapranatha-1962s-projects.vercel.app")).toBe(false);
    expect(proyekResmi({ VERCEL_URL: "joyfulprokopim-abc123-anugrahyegapranatha-1962s-projects.vercel.app" })).toBe(false);
    expect(proyekResmi({}, "prokopim.tarakankota.go.id")).toBe(true);
    expect(proyekResmi({ VERCEL_URL: "jadwal-pimpinan-abc123-anugrahyegapranatha-1962s-projects.vercel.app" })).toBe(true);
    expect(proyekResmi({}, "contoh-lain.vercel.app")).toBe(false);
  });
  it("nama proyek lama di tanda mana pun berarti bukan resmi", () => {
    expect(proyekResmi({ VERCEL_PROJECT_PRODUCTION_URL: "prokopim.tarakankota.go.id" }, "joyfulprokopim-x.vercel.app")).toBe(false);
  });
  it("di luar Vercel tetap berjalan", () => {
    expect(proyekResmi({}, "localhost:5173")).toBe(true);
    expect(proyekResmi({})).toBe(true);
  });
});
