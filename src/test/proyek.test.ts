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
  it("di luar Vercel tetap berjalan", () => {
    expect(proyekResmi({})).toBe(true);
  });
});
