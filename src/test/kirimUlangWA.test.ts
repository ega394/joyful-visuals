import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
let calonUlang: (lingkup: string) => Promise<Array<{ id: number }>>;
const asli = globalThis.fetch;
let url: string[] = [];

beforeAll(() => {
  process.env.SUPABASE_URL = "https://contoh.supabase.co";
  process.env.SUPABASE_SERVICE_KEY = "kunci-uji";
  ({ calonUlang } = require("../../api/_monitorwa.js"));
  globalThis.fetch = vi.fn(async (u: string) => {
    url.push(String(u));
    const body = String(u).includes("rujukan=like.ulang")
      ? [{ rujukan: "ulang:2" }]
      : [
          { id: 1, nomor: "6281111", isi: "Rekap pagi", jenis: "rekap_pagi_ajudan" },
          { id: 2, nomor: "6282222", isi: "Kabar lapangan", jenis: "kabar_lapangan" },
          { id: 3, nomor: "6281111", isi: "Rekap pagi", jenis: "rekap_pagi_ajudan" },
          { id: 4, nomor: "6283333", isi: "Disposisi", jenis: "delegasi_wwk" },
        ];
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
});
afterAll(() => { globalThis.fetch = asli; });

describe("kirim ulang WA yang gagal karena perangkat terputus", () => {
  it("melewati yang sudah dikirim ulang dan pesan kembar", async () => {
    url = [];
    const c = await calonUlang("");
    expect(c.map((r) => r.id)).toEqual([1, 4]);
  });
  it("hanya mengambil kegagalan perangkat terputus, 48 jam, tanpa OTP", async () => {
    url = [];
    await calonUlang("&peran=eq.pemohon");
    const q = url.find((u) => u.includes("berhasil=is.false"))!;
    expect(q).toContain("catatan=ilike.*disconnected*");
    expect(q).toContain("jenis=neq.otp");
    expect(q).toContain("&peran=eq.pemohon");
    expect(q).toContain("isi=not.is.null");
  });
});
