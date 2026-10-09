import { describe, it, expect } from "vitest";
import {
  bolehSantai, namaPanggil, sapaanSantai, kutipanHarian, barisNuansa, KUTIPAN, hitungJulukan,
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

describe("kutipanHarian", () => {
  it("sama sepanjang hari dan berganti esoknya", () => {
    const pagi = kutipanHarian(wita("2026-10-08", "07:00"));
    expect(kutipanHarian(wita("2026-10-08", "23:00"))).toBe(pagi);
    expect(KUTIPAN).toContain(pagi);
    expect(kutipanHarian(wita("2026-10-09", "07:00"))).not.toBe(pagi);
  });
});

describe("hitungJulukan", () => {
  const users = [
    { username: "rina", role: "staf" }, { username: "fajar", role: "staf" },
    { username: "agus", role: "timkom" }, { username: "ksp", role: "kasubbag_protokol" },
    { username: "adm", role: "admin_rk" },
  ];
  const ev = (id: number, personil: string[], timeline: any[] = []) =>
    ({ id, alur: "disetujui", tanggal: "2026-10-05", personil, timeline });
  const tl = (submit: string, forward: string) => [
    { action: "submit", at: submit, actor: "adm" },
    { action: "forward_to_kabag", at: forward, actor: "ksp" },
  ];
  const events = [
    ev(1, ["rina", "agus"], tl("2026-10-05T01:00:00Z", "2026-10-05T01:20:00Z")),
    ev(2, ["rina", "agus"], tl("2026-10-06T01:00:00Z", "2026-10-06T01:10:00Z")),
    ev(3, ["rina", "fajar"], tl("2026-10-07T01:00:00Z", "2026-10-07T01:30:00Z")),
  ];
  const oktober = (t: string) => t.startsWith("2026-10");
  const j = hitungJulukan(events, users, oktober);

  it("penugasan terbanyak dan dokumentasi terbanyak", () => {
    expect(j.rina).toContain("lapangan");
    expect(j.agus).toContain("kamera");
  });
  it("input jadwal, penuntas antrean, dan verifikasi tercepat (minimal 3 kali)", () => {
    expect(j.adm).toContain("ketik");
    expect(j.ksp).toEqual(expect.arrayContaining(["sapu", "gercep"]));
  });
  it("di luar periode tidak dihitung", () => {
    expect(hitungJulukan(events, users, (t: string) => t.startsWith("2026-09"))).toEqual({});
  });
  it("seri di puncak tidak memberi julukan", () => {
    const seri = [ev(1, ["rina", "fajar"]), ev(2, ["rina", "fajar"])];
    expect(hitungJulukan(seri, users, oktober).rina).toBeUndefined();
  });
});
