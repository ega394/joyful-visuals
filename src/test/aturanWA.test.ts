import { describe, it, expect } from "vitest";
import {
  acaraDekat, kunciNomor, penerimaUnik, perubahanMaterial,
  kanalKehadiran, perluWALapangan, jamWita,
} from "../lib/aturanWA.js";

// Jumat, 9 Oktober 2026 pukul 10:00 WITA (02:00 UTC).
const PAGI = Date.UTC(2026, 9, 9, 2, 0);
// Hari yang sama pukul 17:00 WITA (09:00 UTC).
const SORE = Date.UTC(2026, 9, 9, 9, 0);
const HARI_INI = "2026-10-09", BESOK = "2026-10-10", LUSA = "2026-10-11", KEMARIN = "2026-10-08";

describe("acaraDekat", () => {
  it("hari ini dan besok (WITA) termasuk, lusa dan kemarin tidak", () => {
    expect(acaraDekat(HARI_INI, PAGI)).toBe(true);
    expect(acaraDekat(BESOK, PAGI)).toBe(true);
    expect(acaraDekat(LUSA, PAGI)).toBe(false);
    expect(acaraDekat(KEMARIN, PAGI)).toBe(false);
  });
  it("cukup salah satu tanggal (lama atau baru) yang dekat", () => {
    expect(acaraDekat([LUSA, BESOK], PAGI)).toBe(true);
    expect(acaraDekat([LUSA, undefined], PAGI)).toBe(false);
  });
  it("memakai WITA, bukan UTC: 23:30 UTC sudah hari berikutnya di Tarakan", () => {
    const tengahMalamUTC = Date.UTC(2026, 9, 8, 23, 30); // 07:30 WITA, 9 Okt
    expect(acaraDekat(KEMARIN, tengahMalamUTC)).toBe(false);
    expect(acaraDekat(BESOK, tengahMalamUTC)).toBe(true);
    expect(jamWita(tengahMalamUTC)).toBe(7);
  });
});

describe("nomor dan penerima", () => {
  it("menyamakan format nomor", () => {
    expect(kunciNomor("0812-3456-7890")).toBe("6281234567890");
    expect(kunciNomor("+62 812 3456 7890")).toBe("6281234567890");
  });
  it("satu nomor sekali, akun nonaktif dan nomor kosong dilewati", () => {
    const hasil = penerimaUnik([
      { username: "a", noWA: "081234567890" },
      { username: "b", noWA: "6281234567890" },
      { username: "c", noWA: "081111111111", disabled: true },
      { username: "d", noWA: "" },
      { username: "e", noWA: "082222222222" },
    ]);
    expect(hasil.map((u) => u.username)).toEqual(["a", "e"]);
  });
});

describe("perubahanMaterial", () => {
  const lama = { tanggal: BESOK, jam: "09:00", lokasi: "Ruang Imbaya", namaAcara: "Rapat" };
  it("tanggal, jam, jam selesai, atau lokasi", () => {
    expect(perubahanMaterial(lama, { ...lama, jam: "10:00" })).toBe(true);
    expect(perubahanMaterial(lama, { ...lama, lokasi: "Kantor Wali Kota" })).toBe(true);
    expect(perubahanMaterial(lama, { ...lama, jamSelesai: "12:00" })).toBe(true);
  });
  it("nama acara atau kontak saja bukan perubahan material", () => {
    expect(perubahanMaterial(lama, { ...lama, namaAcara: "Rapat Koordinasi" })).toBe(false);
    expect(perubahanMaterial(lama, { namaAcara: "x" })).toBe(false);
  });
});

describe("kanalKehadiran (keputusan 1)", () => {
  it("status yang sama tidak dikabarkan ulang", () => {
    expect(kanalKehadiran("hadir", "hadir", HARI_INI, PAGI)).toBe("tidak");
  });
  it("Hadir pertama kali cukup push, bahkan untuk acara hari ini", () => {
    expect(kanalKehadiran("hadir", null, HARI_INI, PAGI)).toBe("push");
    expect(kanalKehadiran("hadir", null, LUSA, PAGI)).toBe("push");
  });
  it("Tidak Hadir dan delegasi selalu WA", () => {
    expect(kanalKehadiran("tidak_hadir", null, LUSA, PAGI)).toBe("wa");
    expect(kanalKehadiran("delegasi", "hadir", LUSA, PAGI)).toBe("wa");
  });
  it("perubahan status untuk acara hari ini/besok → WA; acara jauh → push", () => {
    expect(kanalKehadiran("hadir", "tidak_hadir", BESOK, PAGI)).toBe("wa");
    expect(kanalKehadiran("hadir", "tidak_hadir", LUSA, PAGI)).toBe("push");
    expect(kanalKehadiran("diwakilkan", null, HARI_INI, PAGI)).toBe("wa");
    expect(kanalKehadiran("diwakilkan", null, LUSA, PAGI)).toBe("push");
  });
});

describe("perluWALapangan (keputusan 4)", () => {
  it("acara jauh → push saja", () => {
    expect(perluWALapangan("diubah", { tanggal: LUSA }, PAGI)).toBe(false);
    expect(perluWALapangan("dibatalkan", { tanggal: LUSA }, PAGI)).toBe(false);
  });
  it("acara hari ini/besok → WA", () => {
    expect(perluWALapangan("diubah", { tanggal: HARI_INI }, PAGI)).toBe(true);
    expect(perluWALapangan("ditarik", { tanggal: BESOK }, PAGI)).toBe(true);
    expect(perluWALapangan("dibatalkan", { tanggal: BESOK }, PAGI)).toBe(true);
  });
  it("dipindah DARI besok ke tanggal jauh tetap WA (petugas perlu tahu)", () => {
    expect(perluWALapangan("diubah", { tanggal: LUSA, tanggalLama: BESOK }, PAGI)).toBe(true);
  });
  it("disetujui untuk besok sebelum 16:00 → rekap ajudan 16:00 sudah memuatnya", () => {
    expect(perluWALapangan("disetujui", { tanggal: BESOK }, PAGI)).toBe(false);
    expect(perluWALapangan("disetujui", { tanggal: BESOK }, SORE)).toBe(true);
    expect(perluWALapangan("disetujui", { tanggal: HARI_INI }, PAGI)).toBe(true);
  });
  it("perubahan tidak material → push saja", () => {
    expect(perluWALapangan("diubah", { tanggal: HARI_INI, material: false }, PAGI)).toBe(false);
  });
});
