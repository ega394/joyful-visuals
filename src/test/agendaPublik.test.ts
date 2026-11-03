import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { agendaPublik } = require("../../api/_agendapublik.js");

const ev = (o: Record<string, unknown>) => ({
  alur: "disetujui", tanggal: "2026-11-03", jam: "09:00", namaAcara: "Rapat",
  lokasi: "Ruang Rapat Rahasia", pakaian: "PDH", personil: [{ nama: "x" }],
  untukPimpinan: ["walikota"], ...o,
});

describe("agenda pimpinan publik (halaman masuk)", () => {
  it("hanya mengirim bidang publik — tanpa lokasi", () => {
    const [a] = agendaPublik([ev({ jamSelesai: "10:30" })]);
    expect(Object.keys(a).sort()).toEqual(["acara", "jam", "mulai", "pimpinan", "selesai"]);
    expect(JSON.stringify(a)).not.toContain("Rahasia");
    expect(a.jam).toBe("09:00 – 10:30 WITA");
    expect(a.selesai - a.mulai).toBe(90 * 60000);
    expect(a.pimpinan).toEqual([{ siapa: "Wali Kota", ket: null }]);
  });
  it("menyaring yang disembunyikan dan yang belum disetujui", () => {
    expect(agendaPublik([
      ev({ sembunyiKalender: true }), ev({ tersembunyi: true }), ev({ alur: "menunggu_kabag" }), null,
    ])).toEqual([]);
  });
  it("menampilkan keterangan bila diwakilkan", () => {
    const [a, b, c] = agendaPublik([
      ev({ jam: "08:00", delegasiKeWWK: true, untukPimpinan: ["walikota", "wakilwalikota"] }),
      ev({ jam: "10:00", statusWK: "diwakilkan", perwakilanWK: "Sekretaris Daerah" }),
      ev({ jam: "13:00", untukPimpinan: ["wakilwalikota"], delegasiWWKJajaran: true, perwakilanWWK: "Asisten I" }),
    ]);
    expect(a.pimpinan).toEqual([{ siapa: "Wali Kota", ket: "Diwakili Wakil Wali Kota" }]);
    expect(b.pimpinan).toEqual([{ siapa: "Wali Kota", ket: "Diwakili Sekretaris Daerah" }]);
    expect(c.pimpinan).toEqual([{ siapa: "Wakil Wali Kota", ket: "Diwakili Asisten I" }]);
  });
  it("tidak mencantumkan pimpinan yang tidak hadir tanpa perwakilan", () => {
    expect(agendaPublik([ev({ statusWK: "tidak_hadir" })])).toEqual([]);
    const [a] = agendaPublik([ev({ untukPimpinan: ["walikota", "wakilwalikota"], statusWK: "tidak_hadir" })]);
    expect(a.pimpinan.map((p: { siapa: string }) => p.siapa)).toEqual(["Wakil Wali Kota"]);
  });
  it("berurutan menurut jam mulai lintas zona", () => {
    const r = agendaPublik([ev({ jam: "10:00", namaAcara: "B" }), ev({ jam: "09:30", zona: "WIB", namaAcara: "A WIB" }), ev({ jam: "", namaAcara: "Tanpa jam" })]);
    expect(r.map((x: { acara: string }) => x.acara)).toEqual(["B", "A WIB", "Tanpa jam"]);
  });
});
