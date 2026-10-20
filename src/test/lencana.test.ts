import { describe, it, expect, vi, afterEach } from "vitest";
import { hitungLencana, pasangLencana } from "../lib/lencana.js";

describe("lencana ikon aplikasi", () => {
  afterEach(() => { vi.unstubAllGlobals(); delete (navigator as any).setAppBadge; delete (navigator as any).clearAppBadge; });

  it("menjumlahkan pending dan notifikasi, tidak pernah negatif", () => {
    expect(hitungLencana({ pending: 2, notif: 3 })).toBe(5);
    expect(hitungLencana({})).toBe(0);
    expect(hitungLencana({ pending: -4, notif: 1 })).toBe(0);
  });

  it("memasang angka dan menghapusnya saat nol", async () => {
    (navigator as any).setAppBadge = vi.fn(async () => {});
    (navigator as any).clearAppBadge = vi.fn(async () => {});
    await pasangLencana(4);
    expect((navigator as any).setAppBadge).toHaveBeenCalledWith(4);
    await pasangLencana(0);
    expect((navigator as any).clearAppBadge).toHaveBeenCalled();
  });

  it("diam saja di peramban tanpa Badging API", async () => {
    await expect(pasangLencana(3)).resolves.toBeUndefined();
  });
});
