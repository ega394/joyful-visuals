import { describe, it, expect } from "vitest";
// @ts-expect-error — modul JS tanpa berkas tipe
import { umurUsulan, selisihHari, tanggalUsulan, UMUR_AMBANG, bandingUsulan } from "../lib/usulan.js";

/** Jadwal dengan usulan berjalan. `pada` = tanggal usulan diajukan (WITA). */
const ev = (pada: string | null, tanggalAcara: string | null, extra: any = {}) => ({
  id: 1,
  alurEdit: "menunggu_kasubbag",
  ...(pada ? { usulanEditPada: pada + "T02:00:00.000Z" } : {}),   // 10:00 WITA
  ...(tanggalAcara ? { tanggal: tanggalAcara } : {}),
  ...extra,
});

const HARI = "2026-09-22";

describe("selisihHari", () => {
  it("menghitung selisih hari kalender", () => {
    expect(selisihHari("2026-09-22", "2026-09-26")).toBe(4);
    expect(selisihHari("2026-09-26", "2026-09-22")).toBe(-4);
    expect(selisihHari("2026-09-22", "2026-09-22")).toBe(0);
  });

  it("melewati batas bulan dengan benar", () => {
    expect(selisihHari("2026-09-30", "2026-10-02")).toBe(2);
  });

  it("mengembalikan null untuk tanggal yang tidak sah", () => {
    expect(selisihHari("bukan-tanggal", "2026-09-22")).toBeNull();
  });
});

describe("tanggalUsulan", () => {
  it("memakai usulanEditPada bila ada", () => {
    expect(tanggalUsulan(ev("2026-09-20", null))).toBe("2026-09-20");
  });

  it("jatuh ke jejak audit bila usulanEditPada tidak ada", () => {
    const e = ev(null, null, {
      timeline: [
        { action: "submit", at: "2026-09-01T02:00:00.000Z" },
        { action: "usulan_edit_diajukan", at: "2026-09-19T02:00:00.000Z" },
      ],
    });
    expect(tanggalUsulan(e)).toBe("2026-09-19");
  });

  it("memakai entri jejak TERAKHIR bila usulannya diajukan berulang", () => {
    const e = ev(null, null, {
      timeline: [
        { action: "usulan_edit_diajukan", at: "2026-09-10T02:00:00.000Z" },
        { action: "usulan_edit_ditolak", at: "2026-09-11T02:00:00.000Z" },
        { action: "usulan_edit_diajukan", at: "2026-09-21T02:00:00.000Z" },
      ],
    });
    expect(tanggalUsulan(e)).toBe("2026-09-21");
  });

  it("mengembalikan null bila tidak ada cap waktu sama sekali", () => {
    expect(tanggalUsulan(ev(null, "2026-10-01"))).toBeNull();
  });

  it("mengabaikan cap waktu yang tidak sah", () => {
    expect(tanggalUsulan({ usulanEditPada: "bukan-waktu" })).toBeNull();
  });
});

describe("umurUsulan — tidak menandai apa pun", () => {
  it("bila tidak ada usulan berjalan", () => {
    expect(umurUsulan({ id: 1, alurEdit: null, usulanEditPada: "2026-09-01T02:00:00Z" }, HARI)).toBeNull();
  });

  it("bila umurnya tidak dapat diketahui — tidak menerka", () => {
    expect(umurUsulan(ev(null, "2026-10-30"), HARI)).toBeNull();
  });

  it("bila baru diajukan hari ini untuk acara yang masih jauh", () => {
    expect(umurUsulan(ev(HARI, "2026-10-30"), HARI)).toBeNull();
  });

  it("bila berumur 1 hari untuk acara yang masih jauh — masih longgar", () => {
    expect(umurUsulan(ev("2026-09-21", "2026-10-30"), HARI)).toBeNull();
  });

  it("bila cap waktunya di masa depan — jangan diterka", () => {
    expect(umurUsulan(ev("2026-09-25", "2026-10-30"), HARI)).toBeNull();
  });
});

describe("umurUsulan — acara masih jauh (≥ 4 hari): kuning 2 · merah 4", () => {
  const acara = "2026-10-30";
  it("2 hari → kuning", () => {
    const u = umurUsulan(ev("2026-09-20", acara), HARI);
    expect(u.tingkat).toBe("kuning");
    expect(u.umur).toBe(2);
    expect(u.label).toContain("Menunggu 2 hari");
  });
  it("3 hari → masih kuning", () => {
    expect(umurUsulan(ev("2026-09-19", acara), HARI).tingkat).toBe("kuning");
  });
  it("4 hari → merah", () => {
    const u = umurUsulan(ev("2026-09-18", acara), HARI);
    expect(u.tingkat).toBe("merah");
    expect(u.label).toContain("menunggu 4 hari");
  });
  it("10 hari → tetap merah", () => {
    expect(umurUsulan(ev("2026-09-12", acara), HARI).tingkat).toBe("merah");
  });
});

describe("umurUsulan — acara 2–3 hari lagi: kelonggaran menyusut", () => {
  const acara = "2026-09-24";   // 2 hari lagi
  it("baru diajukan hari ini → belum ditandai", () => {
    expect(umurUsulan(ev(HARI, acara), HARI)).toBeNull();
  });
  it("1 hari → kuning (di acara jauh masih tenang)", () => {
    expect(umurUsulan(ev("2026-09-21", acara), HARI).tingkat).toBe("kuning");
    expect(umurUsulan(ev("2026-09-21", "2026-10-30"), HARI)).toBeNull();
  });
  it("2 hari → merah (di acara jauh baru kuning)", () => {
    expect(umurUsulan(ev("2026-09-20", acara), HARI).tingkat).toBe("merah");
    expect(umurUsulan(ev("2026-09-20", "2026-10-30"), HARI).tingkat).toBe("kuning");
  });
});

describe("umurUsulan — acara hari ini / besok: tanpa kelonggaran", () => {
  it("acara BESOK, baru diajukan hari ini → langsung merah", () => {
    const u = umurUsulan(ev(HARI, "2026-09-23"), HARI);
    expect(u.tingkat).toBe("merah");
    expect(u.label).toContain("acara BESOK");
  });
  it("acara HARI INI, baru diajukan hari ini → langsung merah", () => {
    const u = umurUsulan(ev(HARI, HARI), HARI);
    expect(u.tingkat).toBe("merah");
    expect(u.label).toContain("acara HARI INI");
  });
});

describe("umurUsulan — acara sudah berlalu", () => {
  it("ditandai kelabu, bukan merah", () => {
    const u = umurUsulan(ev("2026-09-10", "2026-09-15"), HARI);
    expect(u.tingkat).toBe("lewat");
    expect(u.label).toContain("tidak lagi bermakna");
  });

  it("berlaku juga bila usulannya baru diajukan hari ini", () => {
    expect(umurUsulan(ev(HARI, "2026-09-15"), HARI).tingkat).toBe("lewat");
  });
});

describe("umurUsulan — jadwal tanpa tanggal acara", () => {
  it("memakai kelonggaran yang paling longgar", () => {
    expect(umurUsulan(ev("2026-09-21", null), HARI)).toBeNull();          // 1 hari
    expect(umurUsulan(ev("2026-09-20", null), HARI).tingkat).toBe("kuning"); // 2 hari
    expect(umurUsulan(ev("2026-09-18", null), HARI).tingkat).toBe("merah");  // 4 hari
  });

  it("labelnya tidak menyebut sisa hari yang tidak diketahui", () => {
    expect(umurUsulan(ev("2026-09-20", null), HARI).label).not.toContain("acara");
  });
});

describe("umurUsulan — berlaku pada kedua tahap", () => {
  it("usulan yang tertahan di Kabag ikut ditandai", () => {
    const e = { ...ev("2026-09-18", "2026-10-30"), alurEdit: "menunggu_kabag" };
    expect(umurUsulan(e, HARI).tingkat).toBe("merah");
  });
});

describe("UMUR_AMBANG", () => {
  it("terurut dari yang paling longgar, agar find() memilih baris yang benar", () => {
    const sisa = UMUR_AMBANG.map((b: any) => b.sisaMin);
    expect(sisa).toEqual([...sisa].sort((a, b) => b - a));
  });

  it("kelonggarannya tidak pernah bertambah saat acara mendekat", () => {
    for (let i = 1; i < UMUR_AMBANG.length; i++) {
      expect(UMUR_AMBANG[i].kuning).toBeLessThanOrEqual(UMUR_AMBANG[i - 1].kuning);
      expect(UMUR_AMBANG[i].merah).toBeLessThanOrEqual(UMUR_AMBANG[i - 1].merah);
    }
  });
});

describe("bandingUsulan — urutan antrian", () => {
  const A = { ...ev("2026-09-18", "2026-10-30"), id: 1 };  // merah (4 hari)
  const B = { ...ev("2026-09-20", "2026-10-30"), id: 2 };  // kuning (2 hari)
  const C = { ...ev("2026-09-22", "2026-10-30"), id: 3 };  // belum ditandai
  const D = { ...ev("2026-09-19", "2026-09-15"), id: 4 };  // acara sudah berlalu
  const urut = (xs: any[]) => [...xs].sort((a, b) => bandingUsulan(a, b, HARI)).map(x => x.id);

  it("merah dulu, lewat paling belakang", () => {
    expect(urut([D, C, B, A])).toEqual([1, 2, 3, 4]);
  });

  it("acara yang sudah berlalu tidak lagi memimpin daftar", () => {
    // inilah cacat yang diperbaiki: urut menurut tanggal acara menaruh D di depan
    expect(urut([D, A])[0]).toBe(1);
    expect([D, A].sort((x, y) => (x.tanggal + "").localeCompare(y.tanggal + ""))[0].id).toBe(4);
  });

  it("pada kegentingan yang sama, acara terdekat lebih dulu", () => {
    const P = { ...ev("2026-09-18", "2026-10-01"), id: 11 };
    const Q = { ...ev("2026-09-18", "2026-10-30"), id: 12 };
    expect(urut([Q, P])).toEqual([11, 12]);
  });

  it("stabil — tidak melempar pada jadwal tanpa tanggal", () => {
    const R = { ...ev("2026-09-18", null), id: 21 };
    expect(() => urut([R, A, D])).not.toThrow();
  });
});

describe("labelPantau — kalimat bagi yang belum berwenang memutus", () => {
  it("tingkat merah tidak menyuruh memutus", () => {
    const u = umurUsulan(ev("2026-09-18", "2026-10-30"), HARI);
    expect(u.label).toContain("Perlu segera diputus");
    expect(u.labelPantau).toBe("Sudah mendesak — menunggu 4 hari");
    expect(u.labelPantau).not.toContain("diputus");
  });

  it("acara besok tetap menyebut sebabnya", () => {
    const u = umurUsulan(ev(HARI, "2026-09-23"), HARI);
    expect(u.labelPantau).toBe("Sudah mendesak — acara BESOK");
  });

  it("tingkat kuning dan lewat sudah netral — tanpa labelPantau tersendiri", () => {
    expect(umurUsulan(ev("2026-09-20", "2026-10-30"), HARI).labelPantau).toBeUndefined();
    expect(umurUsulan(ev("2026-09-10", "2026-09-15"), HARI).labelPantau).toBeUndefined();
  });
});
