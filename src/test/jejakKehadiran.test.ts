import { describe, it, expect } from "vitest";
import {
  keadaanKehadiran, perubahanKehadiran, entriJejakKehadiran, gabungkanJejak, isiKabarKehadiran,
} from "../lib/jejakKehadiran.js";

const dasar = { id: 1, namaAcara: "Pembukaan Kemah Pramuka Madrasah", untukPimpinan: ["walikota"], statusWK: null, perwakilanWK: "" };
const jam = (m: number) => new Date(Date.parse("2026-10-23T08:40:00Z") + m * 60000).toISOString();

// Memutar ulang rangkaian perubahan seperti updAndSync: riwayat + gabung.
function putar(langkah: Array<[string, Record<string, unknown>, number]>) {
  let ev: Record<string, unknown> = { ...dasar, timeline: [] };
  for (const [aktor, patch, menit] of langkah) {
    const baru = { ...ev, ...patch };
    const entri = entriJejakKehadiran(perubahanKehadiran(ev, baru), { actor: aktor, at: jam(menit) });
    ev = { ...baru, timeline: gabungkanJejak(ev.timeline as never[], entri) };
  }
  return ev.timeline as Array<{ action: string; actor: string; note: string | null }>;
}

describe("riwayat kehadiran (laporan 23 Oktober 2026)", () => {
  it("pergantian pejabat yang mewakili tercatat: Sekda → Asisten", () => {
    const tl = putar([
      ["adminrk", { statusWK: "diwakilkan", perwakilanWK: "Sekda" }, 2],
      ["walikota", { statusWK: "tidak_hadir", perwakilanWK: "" }, 3],
      ["walikota", { statusWK: null }, 3.2],
      ["walikota", { statusWK: "diwakilkan", perwakilanWK: "Sekda" }, 4],
      ["adminrk", { perwakilanWK: "Asisten Pemerintahan dan Kesra" }, 20],
    ]);
    expect(tl.map((e) => [e.action, e.note])).toEqual([
      ["wk_diwakilkan", "Sekda"],
      ["wk_tidak_hadir", null],            // dulu tertulis "Sekda" — usang
      ["wk_batal", "sebelumnya: Tidak Hadir"], // dulu tidak tercatat sama sekali
      ["wk_diwakilkan", "Sekda"],
      ["wk_ganti_wakil", "Sekda → Asisten Pemerintahan dan Kesra"], // dulu hilang
    ]);
  });

  it("nama yang diketik huruf demi huruf menjadi satu entri", () => {
    const tl = putar([
      ["adminrk", { statusWK: "diwakilkan", perwakilanWK: "Sekda" }, 0],
      ["kabag", { perwakilanWK: "K" }, 30],
      ["kabag", { perwakilanWK: "Ka" }, 30.1],
      ["kabag", { perwakilanWK: "Kadis Pendidikan" }, 30.5],
    ]);
    expect(tl.map((e) => e.note)).toEqual(["Sekda", "Sekda → Kadis Pendidikan"]);
  });

  it("'Diwakilkan' tanpa nama dilengkapi saat nama dipilih; nama yang sudah ada tidak ditimpa", () => {
    const a = putar([
      ["adminrk", { statusWWK: "diwakilkan" }, 0],
      ["adminrk", { perwakilanWWK: "Asisten Administrasi Umum" }, 1],
    ]);
    expect(a.map((e) => [e.action, e.note])).toEqual([["wwk_diwakilkan", "Asisten Administrasi Umum"]]);
    const b = putar([
      ["walikota", { statusWK: "diwakilkan", perwakilanWK: "Sekda" }, 0],
      ["walikota", { perwakilanWK: "Asisten Pemerintahan dan Kesra" }, 1],
    ]);
    expect(b.map((e) => e.action)).toEqual(["wk_diwakilkan", "wk_ganti_wakil"]);
  });

  it("disposisi ke Wakil Wali Kota tercatat sebagai diwakilkan kepada Wakil Wali Kota", () => {
    const d = perubahanKehadiran(dasar, { ...dasar, statusWK: "diwakilkan", delegasiKeWWK: true });
    expect(d).toEqual([{ pim: "wk", jenis: "status", dari: { status: "", wakil: "" }, ke: { status: "diwakilkan", wakil: "Wakil Wali Kota" } }]);
  });

  it("tidak ada perubahan → tidak ada entri; nama usang pada status lain diabaikan", () => {
    expect(perubahanKehadiran({ ...dasar, statusWK: "hadir" }, { ...dasar, statusWK: "hadir", perwakilanWK: "x" })).toEqual([]);
    expect(keadaanKehadiran({ statusWK: "tidak_hadir", perwakilanWK: "Sekda" }, "wk")).toEqual({ status: "tidak_hadir", wakil: "" });
  });
});

describe("isi kabar", () => {
  it("menyebut pejabat baru dan sebelumnya", () => {
    const [d] = perubahanKehadiran({ ...dasar, statusWK: "diwakilkan", perwakilanWK: "Sekda" }, { ...dasar, statusWK: "diwakilkan", perwakilanWK: "Asisten Pemerintahan dan Kesra" });
    expect(isiKabarKehadiran(dasar, d)).toEqual({
      judul: "🔁 Perwakilan Wali Kota berganti",
      isi: "Wali Kota kini diwakilkan kepada Asisten Pemerintahan dan Kesra (sebelumnya: Sekda)",
    });
  });
  it("pembatalan konfirmasi dikabarkan", () => {
    const [d] = perubahanKehadiran({ ...dasar, statusWK: "hadir" }, { ...dasar, statusWK: "" });
    expect(isiKabarKehadiran(dasar, d).judul).toBe("↩️ Konfirmasi Wali Kota dibatalkan");
  });
});
