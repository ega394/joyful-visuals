import { describe, it, expect } from "vitest";
import { hutAktif } from "../lib/hut.js";

describe("logo HUT ke-29 Kota Tarakan", () => {
  const wita = (s: string) => Date.parse(s + "+08:00");
  it("tampil 23 Oktober s.d. 31 Desember 2026 (WITA)", () => {
    expect(hutAktif(wita("2026-10-22T23:59:00"))).toBe(false);
    expect(hutAktif(wita("2026-10-23T00:00:00"))).toBe(true);
    expect(hutAktif(wita("2026-12-15T09:00:00"))).toBe(true);
    expect(hutAktif(wita("2026-12-31T23:59:00"))).toBe(true);
    expect(hutAktif(wita("2027-01-01T00:00:00"))).toBe(false);
  });
});
