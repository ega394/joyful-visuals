import { describe, it, expect } from "vitest";
// @ts-expect-error — modul JS tanpa berkas tipe
import { sesiDariJam, namaBerkasUndangan, teksPukul, formatTanggalIndo } from "../lib/undanganPdf.js";

describe("sesi peminjaman ruangan dari jam acara", () => {
  it("pagi, siang, dan seharian", () => {
    expect(sesiDariJam("08:00", "")).toBe("Pagi");          // tanpa jam selesai = 2 jam → 10.00
    expect(sesiDariJam("10:30", "")).toBe("Full_Day");      // 12.30 melewati batas sesi pagi
    expect(sesiDariJam("09:00", "12:00")).toBe("Pagi");
    expect(sesiDariJam("13:00", "15:00")).toBe("Siang");
    expect(sesiDariJam("09:00", "14:00")).toBe("Full_Day");
    expect(sesiDariJam("", "")).toBe("");
  });
});

describe("teks surat dan nama berkas", () => {
  it("nomor variabel Srikandi dinamai Draft; nomor asli dipakai", () => {
    expect(namaBerkasUndangan({ nomor: "${nomor_naskah}", jenisTtd: "tte", pilihanCetak: "semua" })).toBe("Undangan_TTE_Draft.pdf");
    expect(namaBerkasUndangan({ nomor: "000.1/12/Prokopim", jenisTtd: "kosong", pilihanCetak: "utama" })).toBe("Undangan_Utama_0001-12-Prokopim.pdf");
  });
  it("pukul dan tanggal", () => {
    expect(teksPukul({ waktuMulai: "08:00", waktuSelesai: "", zonaWaktu: "Wita" })).toBe("08.00 Wita s.d. selesai");
    expect(teksPukul({ waktuMulai: "08:00", waktuSelesai: "10:30", zonaWaktu: "Wita" })).toBe("08.00 - 10.30 Wita");
    expect(formatTanggalIndo("2026-10-20")).toBe("Selasa, 20 Oktober 2026");
  });
});
