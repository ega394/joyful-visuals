import { describe, it, expect } from "vitest";
import {
  UNSUR, KODE_UNSUR, periksaJawaban, hitungIKM, mutuIKM, selesaiPadaHari, rentangTanggal,
  // @ts-expect-error — modul JS tanpa berkas tipe
} from "../lib/survei.js";

const penuh = (v: number) => Object.fromEntries(KODE_UNSUR.map((k: string) => [k, v]));

describe("survei kepuasan ruangan — unsur dan validasi", () => {
  it("memuat sembilan unsur SKM PermenPAN-RB 14/2017, masing-masing empat pilihan", () => {
    expect(UNSUR).toHaveLength(9);
    expect(UNSUR.map((u: { unsur: string }) => u.unsur)).toEqual([
      "Persyaratan", "Sistem, mekanisme, dan prosedur", "Waktu penyelesaian", "Biaya/tarif",
      "Produk spesifikasi jenis pelayanan", "Kompetensi pelaksana", "Perilaku pelaksana",
      "Penanganan pengaduan, saran, dan masukan", "Sarana dan prasarana",
    ]);
    UNSUR.forEach((u: { pilihan: string[] }) => expect(u.pilihan).toHaveLength(4));
    expect(UNSUR[3].pilihan[3]).toBe("Gratis");
  });
  it("menolak jawaban kurang, di luar 1–4, atau saran terlalu panjang", () => {
    expect(periksaJawaban(penuh(4), "")).toBeNull();
    const kurang = penuh(3); delete kurang.u5;
    expect(periksaJawaban(kurang, "")).toMatch(/Produk/);
    expect(periksaJawaban({ ...penuh(3), u2: 5 }, "")).toMatch(/prosedur/);
    expect(periksaJawaban({ ...penuh(3), u2: 2.5 }, "")).toMatch(/prosedur/);
    expect(periksaJawaban(penuh(3), "x".repeat(1001))).toMatch(/1000/);
    expect(periksaJawaban(null, "")).toBeTruthy();
  });
});

describe("Indeks Kepuasan Masyarakat", () => {
  it("menghitung IKM = rata-rata NRR × 25 dan mutu sesuai tabel konversi", () => {
    expect(hitungIKM([penuh(4)])).toMatchObject({ n: 1, ikm: 100, mutu: "A", kinerja: "Sangat Baik" });
    expect(hitungIKM([penuh(3)])).toMatchObject({ ikm: 75, mutu: "C" });
    expect(hitungIKM([penuh(4), penuh(3)])).toMatchObject({ n: 2, ikm: 87.5, mutu: "B" });
    expect(hitungIKM([penuh(1)])).toMatchObject({ ikm: 25, mutu: "D" });
    const r = hitungIKM([{ ...penuh(4), u9: 2 }, { ...penuh(4), u9: 3 }]);
    expect(r.nrr.u9).toBe(2.5);
    expect(r.ikm).toBe(Math.round(((8 * 4 + 2.5) / 9) * 25 * 100) / 100);
  });
  it("mengabaikan survei yang belum diisi", () => {
    expect(hitungIKM([{ diisi_at: null }, penuh(4)])).toMatchObject({ n: 1, ikm: 100 });
    expect(hitungIKM([])).toMatchObject({ n: 0, ikm: null, mutu: null });
  });
  it("batas mutu: 88,31 A; 76,61 B; 65 C; di bawahnya D", () => {
    expect(mutuIKM(88.31)?.mutu).toBe("A");
    expect(mutuIKM(88.3)?.mutu).toBe("B");
    expect(mutuIKM(76.61)?.mutu).toBe("B");
    expect(mutuIKM(76.6)?.mutu).toBe("C");
    expect(mutuIKM(65)?.mutu).toBe("C");
    expect(mutuIKM(64.99)?.mutu).toBe("D");
  });
});

describe("peminjaman yang dikirimi survei", () => {
  const slot = (o: Record<string, unknown>) => ({
    booking_code: "AAAA1111", status: "Approved", start_date: "2026-11-14", end_date: "2026-11-14",
    notes: "", pic_wa: "081234567890", event_name: "Rapat", ...o,
  });
  it("hanya yang hari terakhirnya hari ini dan seluruh slotnya disetujui", () => {
    const r = selesaiPadaHari([
      slot({}),
      slot({ booking_code: "BBBB2222", start_date: "2026-11-14" }), slot({ booking_code: "BBBB2222", start_date: "2026-11-15", end_date: "2026-11-15" }),
      slot({ booking_code: "CCCC3333" }), slot({ booking_code: "CCCC3333", start_date: "2026-11-13", end_date: "2026-11-13", status: "Cancelled" }),
      slot({ booking_code: "DDDD4444", notes: "[INTERNAL] Dipesan melalui Generator Undangan" }),
      slot({ booking_code: "EEEE5555", notes: "[MINTA BATAL] tidak jadi" }),
      slot({ booking_code: "FFFF6666", pic_wa: "-" }),
    ], "2026-11-14");
    expect(r.map((x: { booking_code: string }) => x.booking_code)).toEqual(["AAAA1111"]);
    expect(r[0].wa).toBe("081234567890");
  });
  it("peminjaman beberapa hari dikirimi pada hari terakhirnya", () => {
    const g = [slot({ booking_code: "BBBB2222", start_date: "2026-11-12", end_date: "2026-11-12" }), slot({ booking_code: "BBBB2222" })];
    const r = selesaiPadaHari(g, "2026-11-14");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ awal: "2026-11-12", akhir: "2026-11-14" });
    expect(selesaiPadaHari(g, "2026-11-12")).toHaveLength(0);
  });
  it("menulis rentang tanggal Indonesia", () => {
    expect(rentangTanggal("2026-11-14", "2026-11-14")).toBe("14 November 2026");
    expect(rentangTanggal("2026-11-12", "2026-11-14")).toBe("12–14 November 2026");
    expect(rentangTanggal("2026-10-30", "2026-11-02")).toBe("30 Oktober 2026 – 2 November 2026");
  });
});
