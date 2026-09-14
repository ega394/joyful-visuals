import { describe, it, expect } from "vitest";
import {
  plhAktif, peranEfektif, peranDipegang, punyaPeran,
  periksaPenetapan, jejakPlh, hariIniWita, bolehMemutus,
} from "../lib/plh.js";

const staf = { username: "budi", role: "staf" };
const ksbP = { username: "sari", role: "kasubbag_protokol" };

const ampu = (u, untuk, mulai, selesai, dasar) =>
  ({ ...u, plh_untuk: untuk, plh_mulai: mulai, plh_selesai: selesai, plh_dasar: dasar });

describe("masa berlaku", () => {
  const u = ampu(ksbP, "kabag", "2026-09-10", "2026-09-20", "SP/12/2026");

  it("belum berlaku sebelum tanggal mulai", () => {
    expect(plhAktif(u, "2026-09-09")).toBeNull();
    expect(peranEfektif(u, "2026-09-09")).toBe("kasubbag_protokol");
  });

  it("berlaku pada hari pertama dan hari terakhir", () => {
    expect(plhAktif(u, "2026-09-10")?.untuk).toBe("kabag");
    expect(plhAktif(u, "2026-09-20")?.untuk).toBe("kabag");
  });

  it("padam sendiri sehari setelah tanggal selesai", () => {
    expect(plhAktif(u, "2026-09-21")).toBeNull();
    expect(peranEfektif(u, "2026-09-21")).toBe("kasubbag_protokol");
  });

  it("mengabaikan pendelegasian yang datanya tidak lengkap", () => {
    expect(plhAktif({ ...ksbP, plh_untuk: "kabag" }, "2026-09-15")).toBeNull();
    expect(plhAktif({ ...ksbP, plh_mulai: "2026-09-10" }, "2026-09-15")).toBeNull();
  });

  it("mengabaikan pengampuan atas peran sendiri", () => {
    const sama = ampu(ksbP, "kasubbag_protokol", "2026-09-10", "2026-09-20");
    expect(plhAktif(sama, "2026-09-15")).toBeNull();
  });
});

describe("kewenangan bersifat gabungan, bukan penggantian", () => {
  // Inti keputusan I: staf yang mengampu Kasubbag tidak boleh kehilangan
  // menu miliknya sendiri, mis. Kalender Ruangan yang hanya untuk staf.
  const u = ampu(staf, "kasubbag_protokol", "2026-09-10", "2026-09-20");

  it("memegang kedua peran selama masa berlaku", () => {
    expect(peranDipegang(u, "2026-09-15").sort())
      .toEqual(["kasubbag_protokol", "staf"]);
    expect(punyaPeran(u, "staf", "2026-09-15")).toBe(true);
    expect(punyaPeran(u, "kasubbag_protokol", "2026-09-15")).toBe(true);
  });

  it("gerbang kewenangan memakai peran yang diampu", () => {
    expect(peranEfektif(u, "2026-09-15")).toBe("kasubbag_protokol");
  });

  it("kembali ke peran asli saja setelah masa berlaku habis", () => {
    expect(peranDipegang(u, "2026-10-01")).toEqual(["staf"]);
    expect(punyaPeran(u, "kasubbag_protokol", "2026-10-01")).toBe(false);
  });
});

describe("aturan siapa boleh mengampu siapa", () => {
  const tgl = { plh_mulai: "2026-09-10", plh_selesai: "2026-09-20" };

  it("Kabag hanya boleh diampu Kasubbag", () => {
    expect(periksaPenetapan({ peranPengampu: "kasubbag_komdokpim", plh_untuk: "kabag", ...tgl }))
      .toBeNull();
    expect(periksaPenetapan({ peranPengampu: "staf", plh_untuk: "kabag", ...tgl }))
      .toMatch(/hanya dapat diampu oleh Kasubbag/i);
    expect(periksaPenetapan({ peranPengampu: "admin_rk", plh_untuk: "kabag", ...tgl }))
      .toMatch(/hanya dapat diampu oleh Kasubbag/i);
  });

  it("Kasubbag Protokol boleh diampu staf senior", () => {
    expect(periksaPenetapan({ peranPengampu: "staf", plh_untuk: "kasubbag_protokol", ...tgl }))
      .toBeNull();
  });

  it("menolak peran yang memang tidak dapat diampu", () => {
    expect(periksaPenetapan({ peranPengampu: "kasubbag_protokol", plh_untuk: "walikota", ...tgl }))
      .toMatch(/tidak dapat diampu/i);
    expect(periksaPenetapan({ peranPengampu: "staf", plh_untuk: "superadmin", ...tgl }))
      .toMatch(/tidak dapat diampu/i);
  });

  it("menolak pengampuan atas peran sendiri", () => {
    expect(periksaPenetapan({ peranPengampu: "kabag", plh_untuk: "kabag", ...tgl }))
      .toMatch(/sudah memegang/i);
  });
});

describe("pemeriksaan tanggal", () => {
  const dasar = { peranPengampu: "kasubbag_protokol", plh_untuk: "kabag" };

  it("menuntut kedua tanggal terisi", () => {
    expect(periksaPenetapan({ ...dasar, plh_mulai: "2026-09-10" })).toMatch(/wajib diisi/i);
  });

  it("menolak selesai mendahului mulai", () => {
    expect(periksaPenetapan({ ...dasar, plh_mulai: "2026-09-20", plh_selesai: "2026-09-10" }))
      .toMatch(/mendahului/i);
  });

  it("menerima masa satu hari", () => {
    expect(periksaPenetapan({ ...dasar, plh_mulai: "2026-09-10", plh_selesai: "2026-09-10" }))
      .toBeNull();
  });

  it("membatasi masa PLH sampai 90 hari", () => {
    expect(periksaPenetapan({ ...dasar, plh_mulai: "2026-01-01", plh_selesai: "2026-03-31" }))
      .toBeNull();                                   // 90 hari
    expect(periksaPenetapan({ ...dasar, plh_mulai: "2026-01-01", plh_selesai: "2026-04-01" }))
      .toMatch(/90 hari/);                           // 91 hari
  });

  it("menolak format tanggal yang bukan YYYY-MM-DD", () => {
    expect(periksaPenetapan({ ...dasar, plh_mulai: "10-09-2026", plh_selesai: "2026-09-20" }))
      .toMatch(/format tanggal/i);
  });
});

describe("jejak audit", () => {
  it("mencatat jabatan yang diampu beserta dasarnya", () => {
    const u = ampu(ksbP, "kabag", "2026-09-10", "2026-09-20", "SP/12/2026");
    expect(jejakPlh(u, "2026-09-15")).toEqual({ atas_nama: "kabag", plh_dasar: "SP/12/2026" });
  });

  it("dasar boleh kosong karena nomor Surat Perintah bersifat opsional", () => {
    const u = ampu(ksbP, "kabag", "2026-09-10", "2026-09-20");
    expect(jejakPlh(u, "2026-09-15")).toEqual({ atas_nama: "kabag", plh_dasar: null });
  });

  it("tidak melekat apa pun bila tidak sedang mengampu", () => {
    expect(jejakPlh(ksbP, "2026-09-15")).toBeNull();
  });
});

describe("PLH tidak memutus usulannya sendiri", () => {
  const arsipRk = { username: "rina", role: "admin_rk" };
  const HARI = "2026-09-15";
  const rkAmpu = ampu(arsipRk, "kasubbag_protokol", "2026-09-10", "2026-09-20");

  it("menolak jadwal yang diajukan oleh pengampu itu sendiri", () => {
    expect(bolehMemutus(rkAmpu, { submittedBy: "rina" }, HARI)).toBe(false);
  });

  it("meloloskan jadwal yang diajukan orang lain", () => {
    expect(bolehMemutus(rkAmpu, { submittedBy: "tono" }, HARI)).toBe(true);
  });

  it("tidak membatasi pejabat asli atas jadwal yang ia ajukan sendiri", () => {
    // Kasubbag bukan PLH — aturan pemisahan tugas di sini tidak mengaturnya.
    expect(bolehMemutus(ksbP, { submittedBy: "sari" }, HARI)).toBe(true);
  });

  it("tidak membatasi Kasubbag yang mengampu Kabag atas jadwal yang ia teruskan", () => {
    // Kabag berhalangan; bila ini dilarang, antrian justru berhenti total —
    // persis keadaan yang hendak dicegah PLH.
    const ksbAmpuKabag = ampu(ksbP, "kabag", "2026-09-10", "2026-09-20");
    expect(bolehMemutus(ksbAmpuKabag, { submittedBy: "rina" }, HARI)).toBe(true);
  });

  it("kembali tidak membatasi setelah masa PLH lewat", () => {
    expect(bolehMemutus(rkAmpu, { submittedBy: "rina" }, "2026-09-21")).toBe(true);
  });

  it("aman terhadap masukan kosong", () => {
    expect(bolehMemutus(null, { submittedBy: "rina" }, HARI)).toBe(true);
    expect(bolehMemutus(rkAmpu, null, HARI)).toBe(true);
  });
});

describe("kewenangan PLH bersifat gabungan", () => {
  const HARI = "2026-09-15";
  const rkAmpu = ampu({ username: "rina", role: "admin_rk" },
                      "kasubbag_protokol", "2026-09-10", "2026-09-20");

  it("Admin RK pengampu tetap memegang peran aslinya", () => {
    // Inilah yang menjaga menu Input & Pantau tetap ada; tanpa itu,
    // menunjuk Admin RK sebagai PLH mematikan pemasukan jadwal.
    expect(punyaPeran(rkAmpu, "admin_rk", HARI)).toBe(true);
    expect(punyaPeran(rkAmpu, "kasubbag_protokol", HARI)).toBe(true);
    expect(peranEfektif(rkAmpu, HARI)).toBe("kasubbag_protokol");
  });

  it("staf pengampu tetap memegang peran staf", () => {
    const stafAmpu = ampu(staf, "kasubbag_protokol", "2026-09-10", "2026-09-20");
    expect(peranDipegang(stafAmpu, HARI)).toEqual(["staf", "kasubbag_protokol"]);
  });

  it("Kasubbag Protokol yang mengampu Komdokpim tidak kehilangan kewenangan sendiri", () => {
    // Penting bagi gerbang tayang ulang agenda tamu: daftar yang berwenang
    // memuat kasubbag_protokol tetapi tidak kasubbag_komdokpim. Kalau
    // gerbangnya memakai peran efektif (mengganti), kewenangan yang sudah
    // dimilikinya justru hilang selama ia mengampu.
    const ksbAmpuKomdok = ampu(ksbP, "kasubbag_komdokpim", "2026-09-10", "2026-09-20");
    const BOLEH = ["kabag", "kasubbag_protokol", "admin_rk"];
    expect(BOLEH.some(r => punyaPeran(ksbAmpuKomdok, r, HARI))).toBe(true);
    expect(peranEfektif(ksbAmpuKomdok, HARI)).toBe("kasubbag_komdokpim");
  });

  it("staf yang mengampu Kasubbag Protokol memperoleh kewenangan tayang ulang", () => {
    const stafAmpu = ampu(staf, "kasubbag_protokol", "2026-09-10", "2026-09-20");
    const BOLEH = ["kabag", "kasubbag_protokol", "admin_rk"];
    expect(BOLEH.some(r => punyaPeran(stafAmpu, r, HARI))).toBe(true);
    // Dan padam sendiri sesudah masa PLH lewat.
    expect(BOLEH.some(r => punyaPeran(stafAmpu, r, "2026-09-21"))).toBe(false);
  });
});

describe("hariIniWita", () => {
  it("memakai WITA, bukan UTC", () => {
    // 2026-09-15T18:00Z = 2026-09-16 pukul 02.00 WITA — sudah berganti hari.
    expect(hariIniWita(Date.parse("2026-09-15T18:00:00Z"))).toBe("2026-09-16");
    expect(hariIniWita(Date.parse("2026-09-15T15:00:00Z"))).toBe("2026-09-15");
  });
});
