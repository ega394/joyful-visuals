import * as M from "./mock.mjs";
const OUT = new URL("./out/", import.meta.url).pathname;
const pilih = process.argv.slice(2);
const b = await M.mulai();
const DESK = { width: 1280, height: 860 }, HP = { width: 390, height: 844 };
const tunggu = (p, ms = 900) => p.waitForTimeout(ms);
const nav = async (p, teks) => { await p.locator("aside button", { hasText: teks }).first().click(); await tunggu(p, 1500); };
const klik = async (p, teks, o = {}) => { const l = (o.role ? p.getByRole(o.role, { name: teks }) : p.getByText(teks, { exact: !!o.exact })); await l.first().click(o.force ? { force: true } : {}); await tunggu(p, o.ms ?? 900); };
const foto = async (p, nama, o = {}) => { await p.screenshot({ path: OUT + nama + ".png", fullPage: !!o.full }); console.log("ok", nama); };

const SHOT = {
  async kabag_antrian(ctx) {
    const p = await M.halaman(ctx); await M.masuk(p, "kabag", "Kabag@2025");
    await klik(p, "Apel Gabungan ASN Lingkup Pemerintah Kota");
    const buka = p.getByText(/Buka undangan|Lihat undangan|Undangan-Apel/i).first();
    if (await buka.count()) { const [pop] = await Promise.all([p.waitForEvent("popup").catch(() => null), buka.click()]); if (pop) await pop.close(); await tunggu(p); }
    const kotak = p.locator('input[type="checkbox"]');
    for (let k = 0; k < await kotak.count(); k++) { const c = kotak.nth(k); if (!(await c.isChecked()) && await c.isEnabled()) await c.click({ force: true }); }
    await tunggu(p);
    await p.getByText(/Apel Gabungan ASN Lingkup/).first().evaluate((el) => el.scrollIntoView({ block: "start" }));
    await p.mouse.wheel(0, -40); await tunggu(p);
    await foto(p, "kabag_antrian");
  },
  async kabag_riwayat(ctx) {
    const p = await M.halaman(ctx); await M.masuk(p, "kabag", "Kabag@2025");
    await klik(p, "Riwayat Alur"); await klik(p, "Rapat Koordinasi Percepatan Infrastruktur Kota");
    await foto(p, "kabag_riwayat");
  },
  async kabag_usulan(ctx) {
    const p = await M.halaman(ctx); await M.masuk(p, "kabag", "Kabag@2025");
    await klik(p, "Usulan Ubah"); await klik(p, "Penyerahan Bantuan Sosial Lanjut Usia").catch(() => {});
    await foto(p, "kabag_usulan");
  },
  async kasubbag_jadwal(ctx) {
    const p = await M.halaman(ctx); await M.masuk(p, "kasubbag_protokol", "Ksbg@2025");
    await p.locator("button", { hasText: /^🗓️\s*Jadwal$/ }).first().click().catch(async () => klik(p, "Jadwal", { exact: true }));
    await tunggu(p, 1200); await foto(p, "kasubbag_jadwal");
  },
  async kasubbag_personil(ctx) {
    const p = await M.halaman(ctx); await M.masuk(p, "kasubbag_protokol", "Ksbg@2025");
    await p.locator("button", { hasText: /Personil/ }).first().click(); await tunggu(p, 1200);
    await foto(p, "kasubbag_personil");
  },
  async kabag_plh(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "kabag", "Kabag@2025"); await nav(p, "Pelaksana Harian"); await foto(p, "kabag_plh"); },
  async kabag_ruangan(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "kabag", "Kabag@2025"); await nav(p, "Peminjaman Ruangan"); await tunggu(p, 1500); await foto(p, "kabag_ruangan"); },
  async staf_kalender_ruangan(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "rina", "Staf@2025"); await nav(p, "Kalender Ruangan"); await tunggu(p, 1500); await foto(p, "staf_kalender_ruangan"); },
  async kabag_tamu(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "kabag", "Kabag@2025"); await nav(p, "Manajemen Tamu"); await tunggu(p, 1500); await foto(p, "kabag_tamu"); },
  async kabag_komdok(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "kabag", "Kabag@2025"); await nav(p, "Monitoring Komdok"); await foto(p, "kabag_komdok"); },
  async kabag_rekap_evaluasi(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "kabag", "Kabag@2025"); await nav(p, "Rekap Evaluasi Kinerja"); await foto(p, "kabag_rekap_evaluasi"); },
  async kabag_rekap_penugasan(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "kabag", "Kabag@2025"); await nav(p, "Rekap Penugasan Bulanan"); await foto(p, "kabag_rekap_penugasan"); },
  async kabag_laporan(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "kabag", "Kabag@2025"); await nav(p, "Laporan Mingguan/Bulanan"); await tunggu(p, 1500); await foto(p, "kabag_laporan"); },
  async kabag_rekap_wa(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "kabag", "Kabag@2025"); await nav(p, "Rekap WA Hari Ini"); await foto(p, "kabag_rekap_wa"); },
  async kabag_kalender_bersama(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "kabag", "Kabag@2025"); await nav(p, "Tampilan Kalender Bersama"); await foto(p, "kabag_kalender_bersama"); },
  async kabag_agenda(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "kabag", "Kabag@2025"); await nav(p, "Agenda"); await foto(p, "kabag_agenda"); },
  async staf_ekinerja(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "rina", "Staf@2025"); await nav(p, "E-Kinerja"); await klik(p, "Bulan Ini"); await klik(p, /Generate Laporan/, { role: "button", ms: 2000 }); await foto(p, "staf_ekinerja"); },
  async kabag_ruangan_kalender(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "kabag", "Kabag@2025"); await nav(p, "Peminjaman Ruangan"); await p.locator("button", { hasText: /^\W*Kalender$/ }).first().click(); await tunggu(p, 1800); await foto(p, "kabag_ruangan_kalender"); },
  async komdokpim_newsroom(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "kasubbag_komdokpim", "Kdp@2025"); await nav(p, "AI Newsroom"); await tunggu(p, 1500); await foto(p, "komdokpim_newsroom"); },
  async dewi_plh(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "dewi", "Staf@2025"); await tunggu(p, 1500); await foto(p, "dewi_plh"); },
  async mitra(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "mitra_dkisp", "Mitra@2025"); await tunggu(p, 1500); await foto(p, "mitra"); },
  async staf_rekap_saya(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "rina", "Staf@2025"); await nav(p, "Rekap Kinerja Saya"); await foto(p, "staf_rekap_saya"); },
  async staf_daftar_hadir(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "rina", "Staf@2025"); await nav(p, "Daftar Hadir Digital"); await tunggu(p, 1500); await foto(p, "staf_daftar_hadir"); },
  async undangan(ctx) {
    const p = await M.halaman(ctx); await M.masuk(p, "admin_undangan", "AdminUnd@2025");
    await tunggu(p, 1500); await foto(p, "undangan_awal");
    await klik(p, "Data Acara");
    await p.locator('input[type="date"]').first().fill("2026-10-08");
    const jam = p.locator('input[type="time"]'); await jam.nth(0).fill("09:00"); await jam.nth(1).fill("11:00");
    await p.locator("select").filter({ has: p.locator('option[value="Ruang Imbaya"]') }).first().selectOption("Ruang Imbaya");
    await tunggu(p, 2500);
    const ta = p.locator("textarea").last(); await ta.fill("Rapat Koordinasi Persiapan Hari Jadi Kota Tarakan");
    const n = p.locator('input[type="number"]'); if (await n.count()) await n.first().fill("30");
    await tunggu(p, 2500);
    await p.getByText("Kalender Peminjaman Ruangan").first().evaluate((el) => el.scrollIntoView({ block: "center" }));
    await tunggu(p, 800); await foto(p, "undangan_imbaya");
  },
  // ── Ponsel ──
  async hp_walikota(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "walikota", "WK@2025"); await tunggu(p, 1500); await foto(p, "hp_walikota"); },
  async hp_ajudan(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "ajudan_wk", "Ajudan@2025"); await tunggu(p, 1500); await foto(p, "hp_ajudan"); },
  async hp_staf(ctx) { const p = await M.halaman(ctx); await M.masuk(p, "rina", "Staf@2025"); await p.locator("nav button, div button", { hasText: /Penugasan/ }).last().click(); await tunggu(p, 1500); await foto(p, "hp_staf"); },
  async hp_tamu(ctx) { const p = await M.halaman(ctx); await p.goto(M.BASE + "/tamu", { waitUntil: "networkidle" }); await tunggu(p, 1500); await foto(p, "hp_tamu"); },
  async hp_ruangan(ctx) { const p = await M.halaman(ctx); await p.goto(M.BASE + "/pinjamruangan", { waitUntil: "networkidle" }); await tunggu(p, 2000); await foto(p, "hp_ruangan"); },
  async hp_hadir(ctx) { const p = await M.halaman(ctx, "09:05"); await p.goto(M.BASE + "/daftarhadir?e=RKINFRA", { waitUntil: "networkidle" }); await tunggu(p, 1500); await foto(p, "hp_hadir"); },
};

for (const [nama, fn] of Object.entries(SHOT)) {
  if (pilih.length && !pilih.includes(nama)) continue;
  const st = M.buatState();
  const VP = { kabag_antrian: { width: 1280, height: 1060 }, kabag_riwayat: { width: 1280, height: 1060 } };
  const ctx = await M.konteks(b, st, VP[nama] || (nama.startsWith("hp_") ? HP : DESK));
  try { await fn(ctx); } catch (e) { console.log("GAGAL", nama, e.message.split("\n")[0]); }
  await ctx.close();
}
await b.close();
