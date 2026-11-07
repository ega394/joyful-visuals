import { describe, it, expect, vi, afterEach } from "vitest";
import { kataKunci, skorKecocokan, cocokkanBerita, YAKIN } from "../lib/beritaInstagram.js";
import { rekapKomunikasi } from "../lib/indikatorKinerja.js";
import { jalurBerikut, sinkronPostingan, perpanjangToken, bacaPostingan } from "../../api/_instagram.mjs";

const J = 3600000;
const SELESAI = Date.parse("2026-11-02T11:00:00+08:00");
const iso = (t: number) => new Date(t).toISOString();
const acara = (o: Record<string, unknown> = {}) => ({
  id: 1, alur: "disetujui", tanggal: "2026-11-02", jam: "09:00", jamSelesai: "11:00", zona: "WITA",
  namaAcara: "Peresmian Jembatan Gunung Lingkas", lokasi: "Kelurahan Gunung Lingkas", penyelenggara: "Dinas PUPR",
  untukPimpinan: ["walikota"], statusWK: "hadir", timeline: [], ...o,
});
const post = (id: string, caption: string, t: number) => ({ id, caption, permalink: "https://www.instagram.com/p/" + id + "/", terbit_at: iso(t) });

describe("pencocokan postingan @humas_tarakan dengan agenda", () => {
  it("kata kunci membuang kata umum, tagar, dan tautan", () => {
    expect([...kataKunci("Wali Kota Tarakan meresmikan Jembatan #TarakanHibot https://x.y")]).toEqual(["meresmikan", "jembatan"]);
  });

  it("caption yang disetujui di aplikasi = cocok kuat", () => {
    const cap = "Wali Kota meresmikan jembatan penghubung Gunung Lingkas yang dibangun sejak 2025 dengan anggaran daerah.";
    const s = skorKecocokan(acara({ captionBerita: cap }), post("A", cap + " #TarakanHibot", SELESAI + J));
    expect(s).toBeGreaterThanOrEqual(0.9);
  });

  it("nama acara di caption = cukup untuk otomatis; postingan lain tidak", () => {
    const evs = [acara()];
    const posts = [
      post("B", "Hari ini dilaksanakan peresmian Jembatan Gunung Lingkas oleh Wali Kota.", SELESAI + 3 * J),
      post("C", "Vaksinasi massal di Puskesmas Juata.", SELESAI + 2 * J),
    ];
    const h = cocokkanBerita(evs, posts).get(1)!;
    expect(h.cara).toBe("otomatis");
    expect(h.post.id).toBe("B");
    expect(h.skor).toBeGreaterThanOrEqual(YAKIN);
  });

  it("di luar jendela waktu (lebih dari 7 hari) tidak dipertimbangkan", () => {
    const h = cocokkanBerita([acara()], [post("D", "Peresmian Jembatan Gunung Lingkas", SELESAI + 8 * 24 * J)]).get(1)!;
    expect(h.post).toBeNull();
  });

  it("kecocokan lemah hanya menjadi kandidat, tidak dihitung terbit", () => {
    const h = cocokkanBerita([acara()], [post("E", "Pembangunan jembatan Gunung di Tarakan terus berlanjut.", SELESAI + J)]).get(1)!;
    expect(h.post).toBeNull();
    expect(h.kandidat.map((k: { post: { id: string } }) => k.post.id)).toEqual(["E"]);
  });

  it("pilihan manual menang; postingan yang ditolak dilewati", () => {
    const manual = { id: "M", permalink: "https://www.instagram.com/p/M/", terbit_at: iso(SELESAI + 30 * J) };
    expect(cocokkanBerita([acara({ beritaTerbit: manual })], []).get(1)).toMatchObject({ cara: "manual", post: manual });
    const ditolak = cocokkanBerita([acara({ beritaTolak: ["B"] })], [post("B", "Peresmian Jembatan Gunung Lingkas", SELESAI)]).get(1)!;
    expect(ditolak.post).toBeNull();
  });

  it("satu postingan hanya untuk satu agenda (yang paling cocok)", () => {
    const a = acara({ id: 1 });
    const b = acara({ id: 2, namaAcara: "Rapat Koordinasi Jembatan Gunung Lingkas", jam: "13:00", jamSelesai: "14:00" });
    const m = cocokkanBerita([a, b], [post("P", "Peresmian Jembatan Gunung Lingkas oleh Wali Kota", SELESAI + J)]);
    expect(m.get(1)!.post?.id).toBe("P");
    expect(m.get(2)!.post).toBeNull();
  });
});

describe("IKU 3 mode Instagram: berita dihitung dari jam terbit", () => {
  const sekarang = SELESAI + 72 * J;
  it("terbit ≤ 24 jam sesudah acara = tepat, walau persetujuan caption terlambat", () => {
    const ev = acara({ captionStatus: "disetujui", timeline: [{ action: "caption_disetujui", at: iso(SELESAI + 40 * J) }] });
    const r = rekapKomunikasi([ev], { sekarang, postingan: [post("B", "Peresmian Jembatan Gunung Lingkas", SELESAI + 20 * J)] });
    expect(r.berita).toMatchObject({ tepat: 1, terlambat: 0 });
    expect(r.butir[0].postingan.permalink).toContain("/p/B/");
  });
  it("tidak ada postingan sesudah tenggat = terlambat (belum terbit)", () => {
    const r = rekapKomunikasi([acara()], { sekarang, postingan: [] });
    expect(r.berita).toMatchObject({ tepat: 0, terlambat: 1 });
  });
  it("tanpa sambungan Instagram tetap memakai jam persetujuan", () => {
    const ev = acara({ captionStatus: "disetujui", timeline: [{ action: "caption_disetujui", at: iso(SELESAI + 2 * J) }] });
    expect(rekapKomunikasi([ev], { sekarang }).berita).toMatchObject({ tepat: 1 });
  });
  it("mode Instagram menghitung acara sejak 1 Oktober 2026", () => {
    const r = rekapKomunikasi([acara({ tanggal: "2026-10-05" })], { sekarang: Date.parse("2026-10-20T00:00:00Z"), postingan: [] });
    expect(r.berita.jumlah).toBe(1);
  });
});

describe("api/_instagram.mjs", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("tautan halaman berikutnya dibersihkan dari token", () => {
    const j = jalurBerikut("https://graph.instagram.com/v23.0/1789/media?fields=id%2Ccaption&limit=100&access_token=RAHASIA&after=QVFI");
    expect(j).toBe("1789/media?fields=id%2Ccaption&limit=100&after=QVFI");
    expect(j).not.toContain("RAHASIA");
  });

  // Supabase dan Instagram tiruan dalam memori.
  function pasangTiruan() {
    const db: { akun: Record<string, unknown> | null; postingan: Map<string, Record<string, unknown>> } = { akun: null, postingan: new Map() };
    const igUrl: string[] = [];
    vi.stubEnv("IG_TOKEN", "TOKEN-AWAL");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "kunci-layanan");
    vi.stubEnv("SUPABASE_URL", "https://sb.contoh");
    vi.stubGlobal("fetch", async (url: string, init: { method?: string; body?: string } = {}) => {
      const u = new URL(url);
      const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
      if (u.host === "sb.contoh") {
        const tabel = u.pathname.split("/").pop();
        if (tabel === "instagram_akun") {
          if (init.method === "POST") { db.akun = { ...(db.akun || {}), ...JSON.parse(init.body!)[0] }; return new Response(null, { status: 201 }); }
          return json(db.akun ? [db.akun] : []);
        }
        if (tabel === "instagram_postingan") {
          if (init.method === "POST") { for (const r of JSON.parse(init.body!)) db.postingan.set(r.id, r); return new Response(null, { status: 201 }); }
          const rows = [...db.postingan.values()].sort((a, b) => String(b.terbit_at).localeCompare(String(a.terbit_at)));
          return json(u.searchParams.get("order")?.endsWith("asc") ? rows.reverse() : rows);
        }
      }
      igUrl.push(url);
      if (u.pathname === "/me") return json({ user_id: "1789", username: "humas_tarakan" });
      if (u.pathname === "/me/media") return json({
        data: [{ id: "11", caption: "Peresmian jembatan", permalink: "https://www.instagram.com/p/11/", timestamp: "2026-11-02T05:00:00+0000", media_type: "IMAGE" }],
        paging: { next: "https://graph.instagram.com/v23.0/1789/media?limit=100&access_token=TOKEN-AWAL&after=X" },
      });
      if (u.pathname === "/1789/media") return json({ data: [{ id: "10", caption: "Lama", timestamp: "2026-09-01T00:00:00+0000" }] });
      if (u.pathname === "/refresh_access_token") return json({ access_token: "TOKEN-BARU", token_type: "bearer", expires_in: 5184000 });
      return json({ error: { message: "tak dikenal" } }, 400);
    });
    return { db, igUrl };
  }

  it("sinkron menyimpan postingan dan berhenti di batas tanggal", async () => {
    const { db, igUrl } = pasangTiruan();
    const r = await sinkronPostingan({ sejak: "2026-10-01" });
    expect(r).toMatchObject({ ok: true, diambil: 2 });
    expect([...db.postingan.keys()].sort()).toEqual(["10", "11"]);
    expect(db.akun).toMatchObject({ username: "humas_tarakan", galat: null });
    // Token dikirim tepat sekali per permintaan, tidak tergandakan dari paging.
    for (const u of igUrl) expect(u.match(/access_token=/g)).toHaveLength(1);
    const baca = await bacaPostingan({ sejak: "2026-10-01" });
    expect(baca.status).toMatchObject({ tersambung: true, username: "humas_tarakan" });
    expect(JSON.stringify(baca)).not.toContain("TOKEN");
  });

  it("sinkron berikutnya dalam 15 menit dilewati", async () => {
    pasangTiruan();
    const t = Date.parse("2026-11-03T00:00:00Z");
    await sinkronPostingan({ sekarang: t });
    expect(await sinkronPostingan({ sekarang: t + 5 * 60000 })).toEqual({ dilewati: true });
  });

  it("token baru dipasang tidak diperpanjang sebelum 24 jam; sesudahnya diperpanjang dan dipakai", async () => {
    const { db, igUrl } = pasangTiruan();
    const t = Date.now();
    expect(await perpanjangToken({ sekarang: t })).toEqual({ diperpanjang: false });
    expect(await perpanjangToken({ sekarang: t + 25 * J })).toEqual({ diperpanjang: true });
    expect(db.akun).toMatchObject({ token: "TOKEN-BARU" });
    await sinkronPostingan({ paksa: true });
    expect(igUrl[igUrl.length - 1]).toContain("access_token=TOKEN-BARU");
  });

  it("IG_TOKEN diganti di Vercel → token di tabel ditimpa", async () => {
    const { db } = pasangTiruan();
    await perpanjangToken({ sekarang: Date.now() + 25 * J });
    vi.stubEnv("IG_TOKEN", "TOKEN-GANTI");
    await sinkronPostingan({ paksa: true });
    expect(db.akun).toMatchObject({ token: "TOKEN-GANTI" });
  });
});
