import { describe, it, expect } from "vitest";
import {
  layananKomunikasi, rekapKomunikasi, rentangPeriode, kehadiranPimpinan, persen, BERITA_DICATAT_SEJAK,
} from "../lib/indikatorKinerja.js";

const J = 3600000;
// Acara Senin 2 Nov 2026 pukul 09.00 WITA, selesai 11.00 WITA.
const MULAI = Date.parse("2026-11-02T09:00:00+08:00");
const SELESAI = Date.parse("2026-11-02T11:00:00+08:00");
const iso = (t: number) => new Date(t).toISOString();

const acara = (o: Record<string, unknown> = {}) => ({
  id: 1, alur: "disetujui", tanggal: "2026-11-02", jam: "09:00", jamSelesai: "11:00", zona: "WITA",
  namaAcara: "Rapat", untukPimpinan: ["walikota"], statusWK: "hadir", timeline: [], ...o,
});

describe("IKU 3 — naskah sambutan paling lambat 24 jam sebelum acara", () => {
  const sambutan = (o = {}) => acara({ jenisKegiatan: "Sambutan", sambutanPenyusun: "tika", ...o });

  it("disahkan tepat 24 jam sebelum acara = tepat waktu", () => {
    const [b] = layananKomunikasi(sambutan({ sambutanSah: true, sambutanSelesaiAt: iso(MULAI - 24 * J) }), MULAI + 10 * J);
    expect(b).toMatchObject({ jenis: "sambutan", status: "tepat", pj: "tika" });
  });
  it("disahkan 23 jam sebelum acara = terlambat", () => {
    const [b] = layananKomunikasi(sambutan({ sambutanSah: true, sambutanSelesaiAt: iso(MULAI - 23 * J) }), MULAI + 10 * J);
    expect(b.status).toBe("terlambat");
  });
  it("belum disahkan: berjalan sebelum tenggat, terlambat sesudahnya", () => {
    expect(layananKomunikasi(sambutan(), MULAI - 30 * J)[0].status).toBe("berjalan");
    expect(layananKomunikasi(sambutan(), MULAI - 20 * J)[0].status).toBe("terlambat");
  });
  it("tetap dihitung walau pimpinan diwakilkan — naskahnya tetap harus siap", () => {
    const ev = sambutan({ statusWK: "diwakilkan", sambutanSah: true, sambutanSelesaiAt: iso(MULAI - 48 * J) });
    expect(layananKomunikasi(ev, MULAI + 48 * J).map((b) => b.jenis)).toEqual(["sambutan"]);
  });
  it("disahkan tanpa catatan waktu = tak terukur, bukan terlambat", () => {
    expect(layananKomunikasi(sambutan({ sambutanSah: true }), MULAI + J)[0].status).toBe("tak_terukur");
  });
  it("acara berzona WIB memakai jam WIB-nya", () => {
    const ev = sambutan({ zona: "WIB", sambutanSah: true, sambutanSelesaiAt: iso(MULAI + J - 24 * J) });
    // 09.00 WIB = 10.00 WITA, jadi tenggatnya satu jam lebih lambat.
    expect(layananKomunikasi(ev, MULAI + 48 * J)[0].status).toBe("tepat");
  });
});

describe("IKU 3 — berita paling lambat 24 jam sesudah acara", () => {
  const tl = (action: string, t: number, actor = "rina") => ({ action, at: iso(t), actor });

  it("caption disetujui 20 jam sesudah acara selesai = tepat", () => {
    const ev = acara({ captionStatus: "disetujui", timeline: [tl("caption_diajukan", SELESAI + 5 * J), tl("caption_disetujui", SELESAI + 20 * J, "kasubbag")] });
    const [b] = layananKomunikasi(ev, SELESAI + 30 * J);
    expect(b).toMatchObject({ jenis: "berita", status: "tepat", pj: "rina" });
  });
  it("yang dipakai adalah persetujuan terakhir (dikembalikan Kabag lalu disetujui lagi)", () => {
    const ev = acara({ captionStatus: "disetujui", timeline: [tl("caption_disetujui", SELESAI + 2 * J), tl("caption_revisi", SELESAI + 3 * J), tl("caption_disetujui", SELESAI + 30 * J)] });
    expect(layananKomunikasi(ev, SELESAI + 40 * J)[0].status).toBe("terlambat");
  });
  it("rilis yang disetujui lebih dulu dari caption ikut dihitung", () => {
    const ev = acara({
      captionStatus: "disetujui", evaluasi: { news_status: "approved" },
      timeline: [tl("rilis_disetujui", SELESAI + 3 * J), tl("caption_disetujui", SELESAI + 40 * J)],
    });
    expect(layananKomunikasi(ev, SELESAI + 50 * J)[0]).toMatchObject({ status: "tepat", selesai: SELESAI + 3 * J });
  });
  it("tanpa jam selesai, acara dianggap berlangsung dua jam", () => {
    const ev = acara({ jamSelesai: "", captionStatus: "disetujui", timeline: [tl("caption_disetujui", MULAI + 2 * J + 24 * J)] });
    expect(layananKomunikasi(ev, MULAI + 60 * J)[0].status).toBe("tepat");
  });
  it("hanya untuk acara yang dihadiri sendiri oleh WK/WWK", () => {
    expect(layananKomunikasi(acara({ statusWK: "diwakilkan" }), SELESAI + 48 * J)).toEqual([]);
    expect(layananKomunikasi(acara({ statusWK: "tidak_hadir" }), SELESAI + 48 * J)).toEqual([]);
    const wwk = acara({ untukPimpinan: ["walikota"], delegasiKeWWK: true, statusWK: null, statusWWK: "hadir" });
    expect(layananKomunikasi(wwk, SELESAI + 48 * J)).toHaveLength(1);
  });
  it("kehadiran belum dikonfirmasi setelah acara lewat: ditampilkan, tidak dihitung", () => {
    const [b] = layananKomunikasi(acara({ statusWK: null }), SELESAI + 2 * J);
    expect(b.status).toBe("tanpa_kehadiran");
    expect(layananKomunikasi(acara({ statusWK: null }), MULAI - J)).toEqual([]);
  });
  it("acara sebelum pencatatan dimulai tidak dihitung", () => {
    expect(BERITA_DICATAT_SEJAK).toBe("2026-10-23");
    expect(layananKomunikasi(acara({ tanggal: "2026-10-20" }), SELESAI)).toEqual([]);
  });
  it("agenda yang belum tayang tidak dihitung", () => {
    expect(layananKomunikasi(acara({ alur: "menunggu_kabag", jenisKegiatan: "Sambutan" }), SELESAI)).toEqual([]);
  });
});

describe("rekap & periode", () => {
  it("persentase hanya dari yang sudah jatuh tempo", () => {
    expect(persen(9, 1)).toBe(90);
    expect(persen(2, 1)).toBe(66.7);
    expect(persen(0, 0)).toBeNull();
  });
  it("rekap menyaring tanggal acara dan memisahkan jenis", () => {
    const evs = [
      acara({ id: 1, captionStatus: "disetujui", timeline: [{ action: "caption_disetujui", at: iso(SELESAI + J) }] }),
      acara({ id: 2, tanggal: "2026-11-03", jenisKegiatan: "Sambutan", sambutanSah: true, sambutanSelesaiAt: iso(MULAI) }),
      acara({ id: 3, tanggal: "2026-12-01" }),
    ];
    const r = rekapKomunikasi(evs, { dari: "2026-11-01", sampai: "2026-11-30", sekarang: Date.parse("2026-11-10T00:00:00+08:00") });
    expect(r.sambutan).toMatchObject({ tepat: 1, terlambat: 0, persen: 100 });
    expect(r.berita).toMatchObject({ tepat: 1, terlambat: 1, persen: 50 });
    expect(r.semua.persen).toBe(66.7);
  });
  it("rentang bulan, triwulan, tahun", () => {
    expect(rentangPeriode("bulan", "2026-02-10")).toEqual({ dari: "2026-02-01", sampai: "2026-02-28" });
    expect(rentangPeriode("triwulan", "2026-11-05")).toEqual({ dari: "2026-10-01", sampai: "2026-12-31" });
    expect(rentangPeriode("tahun", "2026-11-05")).toEqual({ dari: "2026-01-01", sampai: "2026-12-31" });
  });
  it("kehadiran pimpinan", () => {
    expect(kehadiranPimpinan(acara())).toBe("hadir");
    expect(kehadiranPimpinan(acara({ statusWK: null }))).toBe("belum");
    expect(kehadiranPimpinan(acara({ statusWK: "diwakilkan" }))).toBe("tidak");
  });
});
