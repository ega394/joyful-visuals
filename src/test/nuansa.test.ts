import { describe, it, expect } from "vitest";
import {
  bolehSantai, namaPanggil, sapaanSantai, barisNuansa, kutipanHarian, KUTIPAN,
} from "../lib/nuansa.js";

// Waktu WITA → epoch (WITA = UTC+8). 9 Okt 2026 = Jumat, 12 Okt 2026 = Senin.
const wita = (tgl: string, jam: string) => Date.parse(`${tgl}T${jam}:00+08:00`);

describe("siapa yang mendapat nuansa santai", () => {
  it("pimpinan formal; ajudan dan staf santai", () => {
    expect(bolehSantai("walikota")).toBe(false);
    expect(bolehSantai("wakilwalikota")).toBe(false);
    expect(bolehSantai("ajudan_walikota")).toBe(true);
    expect(bolehSantai("kabag")).toBe(true);
    expect(barisNuansa("walikota", "Bapak", wita("2026-10-09", "12:00"))).toBeNull();
  });
  it("nama panggilan diambil dari kata pertama tanpa gelar", () => {
    expect(namaPanggil("ANUGRAH YEGA PRANATHA, M.Si")).toBe("Anugrah");
    expect(namaPanggil("")).toBe("");
  });
});

describe("sapaanSantai", () => {
  it("Senin pagi", () => {
    expect(sapaanSantai("Rina", wita("2026-10-12", "08:00"))).toBe("Senin lagi. Habis apel langsung buka antrean ya, Rina.");
  });
  it("siang", () => {
    expect(sapaanSantai("Rina", wita("2026-10-08", "12:30"))).toBe("Selamat siang, Rina, semangat dan jangan lupa makan.");
  });
  it("Jumat menjelang shalat Jumat mendahului sapaan siang", () => {
    expect(sapaanSantai("Rina", wita("2026-10-09", "11:15"))).toBe("Yuk siap-siap shalat Jumat bagi yang muslim.");
    expect(sapaanSantai("Rina", wita("2026-10-09", "10:00"))).toBeNull();
  });
  it("sore dan malam", () => {
    expect(sapaanSantai("Rina", wita("2026-10-08", "16:00"))).toBe("Sore, Rina. Sedikit lagi, habis itu pulang.");
    expect(sapaanSantai("Rina", wita("2026-10-08", "22:10"))).toContain("Tidur.");
  });
  it("pagi selain Senin dan malam sebelum 21.00 tidak ada sapaan khusus", () => {
    expect(sapaanSantai("Rina", wita("2026-10-08", "08:00"))).toBeNull();
    expect(sapaanSantai("Rina", wita("2026-10-08", "19:00"))).toBeNull();
  });
});

describe("barisNuansa", () => {
  it("Kata-kata Hari Ini dari Kabag didahulukan", () => {
    expect(barisNuansa("staf", "Rina", wita("2026-10-08", "12:30"), "Apel jam 7.30 ya"))
      .toBe("💬 Apel jam 7.30 ya");
  });
  it("tanpa kata hari ini → putaran biasa: sapaan sesuai waktu, atau kutipan harian", () => {
    expect(barisNuansa("staf", "Rina", wita("2026-10-08", "12:30"), "")).toContain("Selamat siang");
    expect(barisNuansa("staf", "Rina", wita("2026-10-08", "08:00"), "  ")).toBe(kutipanHarian(wita("2026-10-08", "08:00")));
  });
  it("kata hari ini juga menggantikan sapaan dan kutipan", () => {
    expect(barisNuansa("staf", "Rina", wita("2026-10-08", "08:00"), "Rapat jam 9")).toBe("💬 Rapat jam 9");
  });
  it("pimpinan tidak melihat apa pun", () => {
    expect(barisNuansa("wakilwalikota", "X", wita("2026-10-08", "12:30"), "Halo")).toBeNull();
  });
});

describe("kutipanHarian", () => {
  it("sama sepanjang hari, berganti esoknya, tanpa kutipan yang sudah dicoret", () => {
    expect(kutipanHarian(wita("2026-10-08", "06:00"))).toBe(kutipanHarian(wita("2026-10-08", "20:00")));
    expect(kutipanHarian(wita("2026-10-08", "08:00"))).not.toBe(kutipanHarian(wita("2026-10-09", "08:00")));
    expect(KUTIPAN.join(" ")).not.toContain("Rencana A");
  });
});

describe("kalimat putaran dari Kabag", () => {
  it("daftar dari Profil menggantikan bawaan; daftar kosong kembali ke bawaan", () => {
    const d = ["Satu", "Dua", "Tiga"];
    const hasil = new Set([8, 9, 10, 11].map((h) => kutipanHarian(wita(`2026-10-${String(h).padStart(2, "0")}`, "08:00"), d)));
    expect([...hasil].every((x) => d.includes(x))).toBe(true);
    expect(hasil.size).toBe(3);
    expect(KUTIPAN).toContain(kutipanHarian(wita("2026-10-08", "08:00"), []));
    expect(KUTIPAN).toContain(kutipanHarian(wita("2026-10-08", "08:00"), ["  "]));
  });
  it("barisNuansa memakai daftar Kabag bila tidak ada kata hari ini", () => {
    expect(barisNuansa("staf", "Rina", wita("2026-10-08", "08:00"), "", ["Hanya ini"])).toBe("Hanya ini");
  });
});
