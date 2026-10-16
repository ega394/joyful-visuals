import { describe, it, expect } from "vitest";
import {
  zonaSah, zonaAcara, zonaPerangkat, ubahJam, jamMenurut, fmtJamZona, fmtJamDuaZona,
  epochMulai, epochSelesai, menitWita, urutAcara, waktuBertumpuk, tebakZonaLokasi,
  // @ts-expect-error — modul JS tanpa berkas tipe
} from "../lib/zona.js";

const ev = (x: any = {}) => ({ tanggal: "2026-10-16", jam: "09:00", ...x });

describe("zona acara", () => {
  it("jadwal lama tanpa zona dianggap WITA; nilai asing ditolak", () => {
    expect(zonaAcara(ev())).toBe("WITA");
    expect(zonaAcara(ev({ zona: "WIB" }))).toBe("WIB");
    expect(zonaSah("GMT")).toBe("WITA");
    expect(zonaSah("__proto__")).toBe("WITA");
    expect(zonaAcara(null)).toBe("WITA");
  });

  it("zona perangkat dari selisih jam lokal", () => {
    const pada = (menitOffset: number) => ({ getTimezoneOffset: () => menitOffset }) as any;
    expect(zonaPerangkat(pada(-420))).toBe("WIB");
    expect(zonaPerangkat(pada(-480))).toBe("WITA");
    expect(zonaPerangkat(pada(-540))).toBe("WIT");
    expect(zonaPerangkat(pada(-180))).toBe("WITA"); // di luar Indonesia → waktu kantor
  });

  it("mengubah jam antarzona, termasuk lewat tengah malam", () => {
    expect(ubahJam("09:00", "WIB", "WITA")).toEqual({ jam: "10:00", hari: 0 });
    expect(ubahJam("09:00", "WIT", "WIB")).toEqual({ jam: "07:00", hari: 0 });
    expect(ubahJam("23:30", "WIB", "WIT")).toEqual({ jam: "01:30", hari: 1 });
    expect(ubahJam("00:30", "WITA", "WIB")).toEqual({ jam: "23:30", hari: -1 });
    expect(ubahJam("", "WIB", "WITA")).toEqual({ jam: "", hari: 0 });
  });

  it("jam selesai ikut diubah hanya bila sah", () => {
    expect(jamMenurut(ev({ zona: "WIB", jamSelesai: "11:00" }), "WITA").teks).toBe("10:00 – 12:00");
    expect(jamMenurut(ev({ zona: "WIB", jamSelesai: "08:00" }), "WITA").teks).toBe("10:00");
  });
});

describe("format jam", () => {
  it("layar: menurut zona perangkat, plus jam setempat bila berbeda", () => {
    expect(fmtJamZona(ev({ jamSelesai: "11:00" }), "WITA")).toBe("09:00 – 11:00 WITA");
    expect(fmtJamZona(ev({ zona: "WIB", jamSelesai: "11:00" }), "WITA")).toBe("10:00 – 12:00 WITA (09:00 – 11:00 WIB setempat)");
    // Pimpinan sedang di Jakarta melihat acara Jakarta tanpa konversi.
    expect(fmtJamZona(ev({ zona: "WIB" }), "WIB")).toBe("09:00 WIB");
    // ... dan acara Tarakan dalam jam Jakarta.
    expect(fmtJamZona(ev(), "WIB")).toBe("08:00 WIB (09:00 WITA setempat)");
    expect(fmtJamZona(ev({ jam: "" }), "WITA")).toBe("");
  });

  it("pesan: jam setempat dengan padanan WITA", () => {
    expect(fmtJamDuaZona(ev())).toBe("09:00 WITA");
    expect(fmtJamDuaZona(ev(), { wita: false })).toBe("09:00");
    expect(fmtJamDuaZona(ev({ zona: "WIB", jamSelesai: "11:00" }))).toBe("09:00 – 11:00 WIB (10:00 – 12:00 WITA)");
    expect(fmtJamDuaZona(ev({ zona: "WIB" }), { wita: false })).toBe("09:00 WIB (10:00 WITA)");
    expect(fmtJamDuaZona(ev({ zona: "WIT", jam: "07:30" }))).toBe("07:30 WIT (06:30 WITA)");
    expect(fmtJamDuaZona(ev({ zona: "WIB", jam: "23:30" }))).toBe("23:30 WIB (00:30 WITA (keesokan harinya))");
  });
});

describe("waktu mutlak, urutan, benturan", () => {
  it("epoch memperhitungkan zona", () => {
    expect(epochMulai(ev({ zona: "WIB" }))).toBe(Date.parse("2026-10-16T02:00:00Z"));
    expect(epochMulai(ev())).toBe(Date.parse("2026-10-16T01:00:00Z"));
    expect(epochSelesai(ev())).toBe(Date.parse("2026-10-16T03:00:00Z"));
    expect(epochSelesai(ev({ jamSelesai: "09:30" }))).toBe(Date.parse("2026-10-16T01:30:00Z"));
    expect(Number.isNaN(epochMulai(ev({ jam: "" })))).toBe(true);
  });

  it("09.00 WIB sesudah 09.30 WITA pada hari yang sama", () => {
    const wib = ev({ id: 1, zona: "WIB" }), wita = ev({ id: 2, jam: "09:30" });
    expect(menitWita(wib)).toBe(600);
    expect([wib, wita].sort(urutAcara).map((e) => e.id)).toEqual([2, 1]);
    // Tanggal tetap kunci pertama.
    expect([ev({ id: 3, tanggal: "2026-10-17", jam: "07:00" }), wib].sort(urutAcara).map((e: any) => e.id)).toEqual([1, 3]);
  });

  it("benturan dihitung pada waktu nyata", () => {
    // 09.00–10.00 WIB = 10.00–11.00 WITA, tidak bertumpuk dengan 09.00–10.00 WITA.
    expect(waktuBertumpuk(ev({ zona: "WIB", jamSelesai: "10:00" }), ev({ jamSelesai: "10:00" }))).toBe(false);
    expect(waktuBertumpuk(ev({ zona: "WIB", jamSelesai: "10:00" }), ev({ jam: "10:30", jamSelesai: "11:30" }))).toBe(true);
    expect(waktuBertumpuk(ev({ jam: "" }), ev())).toBe(false);
  });
});

describe("menebak zona", () => {
  it("dari lokasi", () => {
    expect(tebakZonaLokasi("Hotel Borobudur, Jakarta Pusat")).toBe("WIB");
    expect(tebakZonaLokasi("Gedung Gadis, Tanjung Selor")).toBe("WITA");
    expect(tebakZonaLokasi("Swiss-Belhotel Jayapura")).toBe("WIT");
    expect(tebakZonaLokasi("Ruang Imbaya")).toBe(null);
    expect(tebakZonaLokasi("Mess Jakarta, Tarakan")).toBe(null); // ambigu → tidak menebak
  });
});

describe("salinan CommonJS api/_zona.js", () => {
  it("hasilnya sama persis dengan src/lib/zona.js", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const kode = fs.readFileSync(path.resolve(__dirname, "../../api/_zona.js"), "utf8");
    const mod: any = { exports: {} };
    new Function("module", "exports", kode)(mod, mod.exports);
    const cjs = mod.exports.fmtJamDuaZona;
    const jamUji = ["", "00:30", "07:30", "09:00", "23:30"];
    for (const zona of [undefined, "WIB", "WITA", "WIT", "GMT"])
      for (const jam of jamUji)
        for (const jamSelesai of ["", "08:00", "11:00", "23:59"])
          for (const opsi of [undefined, { wita: false }]) {
            const e = { jam, jamSelesai, zona };
            expect(cjs(e, opsi)).toBe(fmtJamDuaZona(e, opsi));
          }
    expect(cjs(null)).toBe("");
  });
});
