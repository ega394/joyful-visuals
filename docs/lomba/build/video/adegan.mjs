// Rekaman adegan aplikasi 6–11 dan 14. Jalankan: node adegan.mjs [a06 a07 ...]
import { M, mulai, konteks, rekam, klik, ketik, jeda, keadaan, ACARA } from "./rekam.mjs";
// Jendela rekaman dibuat kecil dan bingkainya besar, sehingga isi aplikasi tampil ±1,3× lebih besar di video.
const DESK = { width: 1040, height: 570 }, HP = { width: 360, height: 780 };
const pilih = process.argv.slice(2);
const b = await mulai();
const DESKO = { deviceScaleFactor: 1.9 };

const AI = { namaAcara: ACARA.namaAcara, tanggal: ACARA.tanggal, jam: "09:00", jamSelesai: "11:00", zona: "WITA", penyelenggara: ACARA.penyelenggara, kontak: ACARA.kontak, pakaian: "PDH", jenisKegiatan: "Pengarahan", catatan: "", buktiUndangan: ACARA.buktiUndangan, lokasi: ACARA.lokasi, untukPimpinan: ["walikota"] };

const ADEGAN = {
  // 6. Admin RK memindai undangan → formulir terisi → simpan → kirim ke Kasubbag
  async a06() {
    const ctx = await konteks(b, M.buatState(), DESK, DESKO);
    await ctx.route("**/api/ai", async (r) => { await new Promise((s) => setTimeout(s, 1400)); r.fulfill({ contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: JSON.stringify(AI) }] }) }); });
    const p = await M.halaman(ctx); await M.masuk(p, "admin_rk", "AdminRK@2025");
    await rekam(p, "a06_admin", async () => {
      await jeda(p, 500);
      await klik(p, p.getByRole("button", { name: "+ Input Baru" }), { ms: 600 });
      await klik(p, p.getByRole("button", { name: /AI Auto-Isi/ }), { ms: 700 });
      await p.locator('input[type="file"][accept="application/pdf,image/*"]').first().setInputFiles(new URL("./undangan-contoh.pdf", import.meta.url).pathname);
      await jeda(p, 2600);
      await klik(p, p.getByRole("button", { name: /Gunakan Data Ini/ }), { ms: 1300 });
      await klik(p, p.getByRole("button", { name: /Lanjut ke Detail/ }), { ms: 900 });
      await klik(p, p.getByRole("button", { name: /Simpan sebagai Draft/ }), { ms: 1300 });
      const kirim = p.getByRole("button", { name: /Kirim ke Kasubbag/ });
      if (await kirim.count()) { await klik(p, kirim, { ms: 900 }); const ya = p.getByRole("button", { name: /^Ya|Kirim$/ }); if (await ya.count()) await klik(p, ya.last(), { ms: 1200 }); }
    });
    await ctx.close();
  },
  // 7. Kasubbag (HP): buka undangan, centang daftar periksa, teruskan
  async a07() {
    const ctx = await konteks(b, keadaan("menunggu_kasubbag"), HP);
    const p = await M.halaman(ctx); await M.masuk(p, "kasubbag_protokol", "Ksbg@2025");
    await rekam(p, "a07_kasubbag", async () => {
      await jeda(p, 700);
      await klik(p, p.getByText(ACARA.namaAcara), { ms: 900 });
      const buka = p.getByText(/Lihat Undangan/).first();
      await p.mouse.wheel(0, 380); await jeda(p, 600);
      if (await buka.count()) { const [pop] = await Promise.all([p.waitForEvent("popup").catch(() => null), klik(p, buka, { ms: 300 })]); if (pop) await pop.close(); await jeda(p, 400); }
      const kotak = p.locator('input[type="checkbox"]');
      for (let k = 0; k < await kotak.count(); k++) { const c = kotak.nth(k); if (await c.isVisible() && !(await c.isChecked()) && await c.isEnabled()) await klik(p, c, { ms: 300, langkah: 10 }); }
      await jeda(p, 400);
      await klik(p, p.getByRole("button", { name: /Verifikasi & Teruskan ke Kabag/ }), { ms: 800 });
      const ya = p.getByRole("button", { name: /^Ya|Teruskan$/ });
      if (await ya.count()) await klik(p, ya.last(), { ms: 1400 });
    });
    await ctx.close();
  },
  // 8. Kabag: setujui dan tayangkan
  async a08() {
    const ctx = await konteks(b, keadaan("menunggu_kabag"), DESK, DESKO);
    const p = await M.halaman(ctx); await M.masuk(p, "kabag", "Kabag@2025");
    await rekam(p, "a08_kabag", async () => {
      await jeda(p, 500);
      await klik(p, p.getByText(ACARA.namaAcara), { ms: 800 });
      const buka = p.getByText(/Lihat Undangan/).first();
      if (await buka.count()) { const [pop] = await Promise.all([p.waitForEvent("popup").catch(() => null), klik(p, buka, { ms: 300 })]); if (pop) await pop.close(); await jeda(p, 300); }
      const kotak = p.locator('input[type="checkbox"]');
      for (let k = 0; k < await kotak.count(); k++) { const c = kotak.nth(k); if (await c.isVisible() && !(await c.isChecked()) && await c.isEnabled()) await klik(p, c, { ms: 250, langkah: 10 }); }
      await klik(p, p.getByRole("button", { name: /Setujui & Publikasi/ }), { ms: 800 });
      const ya = p.getByRole("button", { name: /Ya, Tayangkan|^Ya/ });
      if (await ya.count()) await klik(p, ya.last(), { ms: 1600 });
    });
    await ctx.close();
  },
  // 9. HP Wali Kota: agenda tiba → Hadir; tombol disposisi ke Wawali
  async a09() {
    const ctx = await konteks(b, keadaan("disetujui"), HP);
    const p = await M.halaman(ctx); await M.masuk(p, "walikota", "WK@2025");
    await rekam(p, "a09_walikota", async () => {
      await jeda(p, 1000);
      const kartu = p.getByText(ACARA.namaAcara).first();
      await kartu.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" })); await jeda(p, 1400);
      const wawali = p.getByRole("button", { name: /Wawali/ }).nth(1);
      const bx = await wawali.boundingBox(); if (bx) { await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2, { steps: 20 }); await jeda(p, 1200); }
      await klik(p, p.getByRole("button", { name: /✓ Hadir/ }).nth(1), { ms: 1800 });
      await p.mouse.wheel(0, 500); await jeda(p, 1500);
    });
    await ctx.close();
  },
  // 9b. HP ajudan: pemberitahuan agenda, konfirmasi hadir
  async a09b() {
    const ctx = await konteks(b, keadaan("disetujui"), HP);
    const p = await M.halaman(ctx); await M.masuk(p, "ajudan_wk", "Ajudan@2025");
    await rekam(p, "a09b_ajudan", async () => {
      await jeda(p, 1200);
      const kartu = p.getByText(ACARA.namaAcara).first();
      await kartu.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" })); await jeda(p, 1500);
      const hadir = p.getByRole("button", { name: /Hadir/ });
      const n = await hadir.count();
      for (let i = 0; i < n; i++) { const h = hadir.nth(i); const box = await h.boundingBox(); const kb = await kartu.boundingBox(); if (box && kb && Math.abs(box.y - kb.y) < 260 && /^\W*Hadir/.test((await h.innerText()).trim())) { await klik(p, h, { ms: 1800 }); break; } }
      await jeda(p, 1200);
    });
    await ctx.close();
  },
  // 10. Kasubbag: tugaskan personil → Riwayat Alur
  async a10() {
    const ctx = await konteks(b, keadaan("disetujui"), DESK, DESKO);
    const p = await M.halaman(ctx); await M.masuk(p, "kasubbag_protokol", "Ksbg@2025");
    await rekam(p, "a10_penugasan", async () => {
      await jeda(p, 500);
      await klik(p, p.getByRole("button", { name: /🗓️ Jadwal/ }), { ms: 900 });
      const kartu = p.locator("div").filter({ has: p.getByText(ACARA.namaAcara, { exact: true }) }).filter({ has: p.getByRole("button", { name: /Tugaskan!/ }) }).last();
      await kartu.waitFor({ state: "attached" }); await kartu.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" })); await jeda(p, 1100);
      const tombolT = kartu.getByRole("button", { name: /Tugaskan!/ }).first(); await tombolT.waitFor({ state: "visible" });
      await klik(p, tombolT, { ms: 900 });
      for (const n of ["Rina Amelia", "Fajar Ramadhan"]) await klik(p, p.getByText(n, { exact: true }).last(), { ms: 400 });
      await klik(p, p.getByRole("button", { name: /Simpan Penugasan/ }), { ms: 1400 });
      await klik(p, p.getByRole("button", { name: /Riwayat Alur/ }).last(), { ms: 900 });
      const kartuR = p.getByText(ACARA.namaAcara).first();
      await kartuR.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" })); await jeda(p, 1200);
      await p.mouse.move(640, 300, { steps: 12 }); await p.mouse.click(640, 300).catch(() => {}); await jeda(p, 400);
      await kartuR.click({ timeout: 4000, force: true }).catch(() => {}); await jeda(p, 1800);
    });
    await ctx.close();
  },
  // 11. Kanal publik (HP): formulir audiensi, lalu pantau status dengan kode
  async a11() {
    const ctx = await konteks(b, M.buatState(), HP);
    const p = await M.halaman(ctx);
    await p.goto(M.BASE + "/tamu", { waitUntil: "networkidle" });
    await rekam(p, "a11a_tamu", async () => {
      await jeda(p, 600);
      const isian = p.locator("#tamu-form input:not([name=website]):visible");
      await ketik(p, isian.nth(0), "Budi Santoso", { delay: 55 });
      await ketik(p, isian.nth(1), "Forum Anak Kota Tarakan", { delay: 45 });
      await ketik(p, isian.nth(2), "081234567890", { delay: 50 });
      await p.mouse.wheel(0, 450); await jeda(p, 1200);
    });
    await p.goto(M.BASE + "/pinjamruangan", { waitUntil: "networkidle" }); await jeda(p, 1200);
    await rekam(p, "a11b_ruangan", async () => {
      await jeda(p, 900);
      const cek = p.getByText(/Cek Status|Lacak|Pantau|Status Pengajuan/i).first();
      if (await cek.count()) await klik(p, cek, { ms: 800 });
      const kode = p.locator('input:visible').first();
      await ketik(p, kode, "A1B2C304", { delay: 70 });
      await p.keyboard.press("Enter"); await jeda(p, 400);
      const cari = p.getByRole("button", { name: /Cari|Cek|Lacak/i }).first();
      if (await cari.count()) await klik(p, cari, { ms: 1600 }); else await jeda(p, 1600);
    });
    await ctx.close();
  },
  // 14. Monitor WA
  async a14() {
    const ctx = await konteks(b, M.buatState(), DESK, DESKO);
    const kini = Date.parse(M.BASE ? "2026-10-06T08:40:00+08:00" : "");
    const baris = (i, o) => ({ id: i, waktu: new Date(kini - i * 600000).toISOString(), jenis: "tamu_tanda_terima", sumber: "tamu", peran: "pemohon", berhasil: true, catatan: null, nomor: "0812•••8888", nama_penerima: "Budi Santoso", isi: "✅ *Permohonan Audiensi Diterima*\n\nYth. Budi Santoso, …", rujukan: "tamu:905", status_kirim: "sent", state: "read", diperbarui_pada: new Date(kini).toISOString(), ...o });
    const DATA = { lingkup: "semua", hal: 0, lanjut: false, masaArsipHari: 90,
      ringkas: { hari: { ok: 14, gagal: 0 }, minggu: { ok: 86, gagal: 2 }, bulan: { ok: 318, gagal: 6 } },
      perJenis: [{ jenis: "tamu_tanda_terima", ok: 40, gagal: 1 }, { jenis: "rekap_pagi_ajudan", ok: 30, gagal: 0 }, { jenis: "penugasan", ok: 52, gagal: 1 }],
      perangkat: { status: "tersambung", kuota: "980", kedaluwarsa: "2026-12-31", paket: "Regular", diperbarui_pada: new Date(kini).toISOString() },
      arsip: [baris(1), baris(2, { jenis: "penugasan", sumber: "jadwal", peran: "staf", nama_penerima: "Rina Amelia", isi: "📋 *Penugasan*", rujukan: null, state: "delivered" }), baris(3, { jenis: "rekap_pagi_ajudan", sumber: "cron", peran: "ajudan_walikota", nama_penerima: "Rahmat Hidayat", rujukan: null })],
      webhook: null };
    await ctx.route(M.BASE + "/api/whatsapp**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(DATA) }));
    const p = await M.halaman(ctx); await M.masuk(p, "kabag", "Kabag@2025");
    await rekam(p, "a14_monitorwa", async () => {
      await jeda(p, 400);
      await klik(p, p.locator("aside button", { hasText: "Monitor WA" }), { ms: 1500 });
      await klik(p, p.getByText("Budi Santoso").first(), { ms: 1600 });
    });
    await ctx.close();
  },
};

for (const [n, f] of Object.entries(ADEGAN)) {
  if (pilih.length && !pilih.includes(n)) continue;
  try { await f(); } catch (e) { console.log("GAGAL", n, e.message.split("\n")[0]); }
}
await b.close();
