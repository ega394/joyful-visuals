import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
// @ts-expect-error — modul JS tanpa berkas tipe
import { idAcara, isiAcara, perluAda, pimpinanHadir, awalanJudul } from "../lib/kalender.js";

const HARI = "2026-09-27";
const jadwal = (x: any = {}) => ({
  id: 1759000000001, alur: "disetujui", tanggal: "2026-09-28", jam: "09:00",
  namaAcara: "Rapat Koordinasi", lokasi: "Ruang Imbaya", untukPimpinan: ["walikota"],
  penyelenggara: "Dinas PUPR", pakaian: "PDH", jenisKegiatan: "Sambutan",
  kontak: "Budi 0812-3456-7890", catatan: "catatan internal", buktiUndangan: "No.045/PUPR/2026",
  ...x,
});

describe("aturan isi kalender", () => {
  it("ID acara stabil dan hanya memakai huruf a–v serta angka", () => {
    expect(idAcara(1759000000001)).toBe("prokopim1759000000001");
    expect(idAcara(1759000000001)).toBe(idAcara("1759000000001"));
    expect(/^[a-v0-9]{5,}$/.test(idAcara("ev-XYZ_42"))).toBe(true);
  });

  it("hanya jadwal disetujui, tidak disembunyikan, mulai hari ini", () => {
    expect(perluAda(jadwal(), HARI)).toBe(true);
    expect(perluAda(jadwal({ tanggal: HARI }), HARI)).toBe(true);
    expect(perluAda(jadwal({ tanggal: "2026-09-26" }), HARI)).toBe(false);
    expect(perluAda(jadwal({ alur: "menunggu_kabag" }), HARI)).toBe(false);
    expect(perluAda(jadwal({ tersembunyi: true }), HARI)).toBe(false);
    expect(perluAda(null, HARI)).toBe(false);
  });

  it("disposisi ke Wakil memindahkan pimpinan yang hadir", () => {
    expect(pimpinanHadir(jadwal({ delegasiKeWWK: true }))).toEqual(["wakilwalikota"]);
    expect(awalanJudul(jadwal())).toBe("[WK] ");
    expect(awalanJudul(jadwal({ untukPimpinan: ["walikota", "wakilwalikota"] }))).toBe("[WK & WWK] ");
    expect(awalanJudul(jadwal({ untukPimpinan: [] }))).toBe("");
  });

  it("narahubung, catatan internal, dan nomor surat TIDAK ikut", () => {
    const teks = JSON.stringify(isiAcara(jadwal()));
    expect(teks).not.toContain("0812");
    expect(teks).not.toContain("catatan internal");
    expect(teks).not.toContain("045/PUPR");
    expect(teks).toContain("Penyelenggara: Dinas PUPR");
    expect(teks).toContain("Pakaian: PDH");
  });

  it("waktu WITA; tanpa jam selesai memakai 2 jam; lewat tengah malam pindah hari", () => {
    const a = isiAcara(jadwal());
    expect(a.start).toEqual({ dateTime: "2026-09-28T09:00:00", timeZone: "Asia/Makassar" });
    expect(a.end.dateTime).toBe("2026-09-28T11:00:00");
    expect(isiAcara(jadwal({ jamSelesai: "10:30" })).end.dateTime).toBe("2026-09-28T10:30:00");
    expect(isiAcara(jadwal({ jam: "23:00" })).end.dateTime).toBe("2026-09-29T01:00:00");
  });

  it("sidik berubah hanya bila isi yang tampil berubah", () => {
    const s = (x: any) => isiAcara(jadwal(x)).extendedProperties.private.sidik;
    expect(s({})).toBe(s({ kontak: "lain" }));
    expect(s({})).not.toBe(s({ lokasi: "Aula" }));
  });
});

// ── Modul peladen terhadap Google Calendar tiruan ─────────────────
describe("api/_kalender.mjs", () => {
  let K: any;
  let kalender: Map<string, any>, terhapus: Set<string>, db: any[];
  // Balapan: aplikasi dan pencocokan terjadwal menyimpan jadwal yang sama
  // bersamaan, sehingga pembuatan menjawab 409.
  let balapan = false;

  beforeAll(async () => {
    const pasangan = await crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true, ["sign", "verify"]);
    const pkcs8 = Buffer.from(await crypto.subtle.exportKey("pkcs8", (pasangan as CryptoKeyPair).privateKey)).toString("base64");
    process.env.GOOGLE_SA_EMAIL = "prokopim@proyek.iam.gserviceaccount.com";
    process.env.GOOGLE_SA_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\\n${pkcs8}\\n-----END PRIVATE KEY-----`;
    process.env.SUPABASE_URL = "https://db.contoh";
    process.env.SUPABASE_KEY = "k";
    // @ts-expect-error — modul JS tanpa berkas tipe
    K = await import("../../api/_kalender.mjs");
  });

  beforeEach(() => {
    kalender = new Map(); terhapus = new Set(); db = []; balapan = false;
    process.env.GOOGLE_CALENDAR_ID = "kal@group.calendar.google.com";
    vi.stubGlobal("fetch", async (url: string, o: any = {}) => {
      const jawab = (status: number, body: any = {}) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
      if (url.startsWith("https://oauth2")) return jawab(200, { access_token: "t", expires_in: 3600 });
      if (url.startsWith("https://db.contoh")) {
        const id = /id=eq\.([^&]+)/.exec(url)?.[1];
        if (id) return jawab(200, db.filter((d) => String(d.id) === decodeURIComponent(id)).map((data) => ({ data })));
        const dari = +(/offset=(\d+)/.exec(url)?.[1] || 0);
        return jawab(200, dari ? [] : db.filter((d) => d.tanggal >= HARI).map((data) => ({ data })));
      }
      const m = /events\/?([a-v0-9]*)(\?.*)?$/.exec(url)!;
      const id = m[1], metode = o.method || "GET";
      if (metode === "GET") return jawab(200, { items: [...kalender.values()] });
      if (metode === "PUT") {
        if (!kalender.has(id) && !terhapus.has(id)) {
          // Balapan: pihak lain membuat acara yang sama tepat sesudah jawaban 404 ini.
          if (balapan) { balapan = false; kalender.set(id, { id, oleh: "pihak lain" }); }
          return jawab(404);
        }
        terhapus.delete(id); kalender.set(id, JSON.parse(o.body)); return jawab(200);
      }
      if (metode === "POST") {
        const b = JSON.parse(o.body);
        if (kalender.has(b.id) || terhapus.has(b.id)) return jawab(409);
        kalender.set(b.id, b); return jawab(200);
      }
      if (metode === "DELETE") {
        if (!kalender.has(id)) return jawab(terhapus.has(id) ? 410 : 404);
        kalender.delete(id); terhapus.add(id); return jawab(204);
      }
      return jawab(500);
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-27T02:00:00Z"));   // 10.00 WITA
  });

  it("memakai akun layanan yang sudah ada; akun khusus hanya bila pasangannya lengkap", async () => {
    expect(K.kalenderAktif()).toBe(true);
    process.env.GOOGLE_CALENDAR_SA_EMAIL = "kalender@lain.iam.gserviceaccount.com";   // tanpa kunci
    expect(K.kalenderAktif()).toBe(true);    // tetap pakai pasangan lama, tidak dicampur
    delete process.env.GOOGLE_CALENDAR_SA_EMAIL;
  });

  it("diam sepenuhnya selama GOOGLE_CALENDAR_ID belum diisi", async () => {
    delete process.env.GOOGLE_CALENDAR_ID;
    expect(await K.sinkronSatu("1")).toEqual({ nonaktif: true });
    expect(await K.rekonsiliasi()).toEqual({ nonaktif: true });
  });

  it("jadwal disetujui dibuat; disetujui ulang tidak menggandakan", async () => {
    db.push(jadwal());
    await K.sinkronSatu(String(jadwal().id));
    await K.sinkronSatu(String(jadwal().id));
    expect(kalender.size).toBe(1);
    expect([...kalender.values()][0].summary).toBe("[WK] Rapat Koordinasi");
  });

  it("ditarik atau disembunyikan → dicabut; disetujui lagi → pulih walau ID pernah dihapus", async () => {
    db.push(jadwal());
    await K.sinkronSatu(String(jadwal().id));
    db[0] = jadwal({ tersembunyi: true });
    await K.sinkronSatu(String(jadwal().id));
    expect(kalender.size).toBe(0);
    db[0] = jadwal();
    await K.sinkronSatu(String(jadwal().id));
    expect(kalender.size).toBe(1);
  });

  it("balapan penyimpanan bersamaan: 409 diselesaikan dengan pembaruan, tanpa galat", async () => {
    db.push(jadwal());
    balapan = true;
    expect((await K.sinkronSatu(String(jadwal().id))).hasil).toBe("disimpan");
    expect([...kalender.values()][0].summary).toBe("[WK] Rapat Koordinasi");
  });

  it("jadwal dihapus dari aplikasi → dicabut; acara lampau dibiarkan", async () => {
    db.push(jadwal());
    await K.sinkronSatu(String(jadwal().id));
    db.length = 0;
    expect((await K.sinkronSatu(String(jadwal().id))).hasil).toBe("dihapus");
    db.push(jadwal({ id: 5, tanggal: "2026-09-20", alur: "menunggu_kasubbag" }));
    expect((await K.sinkronSatu("5")).hasil).toBe("lampau, dibiarkan");
  });

  it("pencocokan: buat yang kurang, perbarui yang berubah, cabut yang tak semestinya, lewati yang sama", async () => {
    db.push(jadwal({ id: 1 }), jadwal({ id: 2 }), jadwal({ id: 3, alur: "menunggu_kabag" }), jadwal({ id: 4, tanggal: "2026-09-01" }));
    expect(await K.rekonsiliasi()).toMatchObject({ dibuat: 2, dicabut: 0, gagal: 0 });
    expect(await K.rekonsiliasi()).toMatchObject({ dibuat: 0, diperbarui: 0, tetap: 2 });
    db[0] = jadwal({ id: 1, lokasi: "Aula Utama" });
    db[1] = jadwal({ id: 2, alur: "draft" });
    expect(await K.rekonsiliasi()).toMatchObject({ diperbarui: 1, dicabut: 1, tetap: 0 });
    expect([...kalender.keys()]).toEqual([idAcara(1)]);
  });
});
