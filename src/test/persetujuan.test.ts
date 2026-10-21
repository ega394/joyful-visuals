import { describe, it, expect, vi } from "vitest";
import { createRequire } from "module";
import { VERSI_KEBIJAKAN as VERSI_LAYAR } from "../lib/persetujuan.js";

const require = createRequire(import.meta.url);
const p = require("../../api/_persetujuan.js");

describe("persetujuan privasi formulir publik", () => {
  it("versi di peladen sama dengan tanggal berlaku di halaman /privasi", () => {
    expect(p.VERSI_KEBIJAKAN).toBe(VERSI_LAYAR);
  });

  it("hanya true yang dihitung sebagai persetujuan", () => {
    expect(p.sudahSetuju({ setuju_privasi: true })).toBe(true);
    expect(p.sudahSetuju({ setuju_privasi: "true" })).toBe(true);
    for (const v of [undefined, null, false, "false", "", 0, 1, "ya"]) {
      expect(p.sudahSetuju({ setuju_privasi: v })).toBe(false);
    }
    expect(p.sudahSetuju(null)).toBe(false);
  });

  it("bukti memakai jam peladen dan versi yang berlaku", () => {
    const k = p.kolomPersetujuan(new Date("2026-10-21T02:00:00Z"));
    expect(k).toEqual({ persetujuan_privasi_at: "2026-10-21T02:00:00.000Z", persetujuan_versi: VERSI_LAYAR });
  });

  it("tetap tersimpan tanpa kolom bukti bila migrasi belum dijalankan", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const diterima: unknown[] = [];
    const simpan = async (b: any) => {
      const baris = Array.isArray(b) ? b : [b];
      if (baris.some((r: any) => "persetujuan_versi" in r)) {
        throw new Error('{"code":"PGRST204","message":"Could not find the \'persetujuan_privasi_at\' column of \'room_bookings\' in the schema cache"}');
      }
      diterima.push(b);
      return [{ id: 1 }];
    };
    const rows = [{ nama: "A", ...p.kolomPersetujuan() }, { nama: "B", ...p.kolomPersetujuan() }];
    await expect(p.simpanDenganPersetujuan(simpan, rows)).resolves.toEqual([{ id: 1 }]);
    expect(diterima).toEqual([[{ nama: "A" }, { nama: "B" }]]);
    warn.mockRestore();
  });

  it("galat lain tidak ditelan", async () => {
    const simpan = async () => { throw new Error("duplicate key value violates unique constraint"); };
    await expect(p.simpanDenganPersetujuan(simpan, { nama: "A" })).rejects.toThrow(/duplicate key/);
  });
});
