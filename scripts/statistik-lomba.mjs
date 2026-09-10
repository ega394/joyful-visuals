/**
 * scripts/statistik-lomba.mjs — angka bukti manfaat dari data yang sudah ada
 *
 * Kriteria "Manfaat Inovasi" pada Lomba Inovasi Daerah Kalimantan Utara
 * berbobot 25% — yang terbesar — dan menuntut "data sebelum-sesudah" serta
 * "bukti-bukti yang aktual". Skrip ini mengeluarkan sisi SESUDAH-nya dari
 * data yang memang sudah terekam aplikasi.
 *
 * CARA PAKAI
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_KEY=<anon atau service key> \
 *   node scripts/statistik-lomba.mjs
 *
 * Atau simpan keduanya di berkas .env pada akar proyek, lalu:
 *
 *   node --env-file=.env scripts/statistik-lomba.mjs
 *
 * BERSIFAT BACA SAJA. Tidak ada satu pun perintah tulis di berkas ini.
 *
 * BATASNYA
 *
 * Angka di sini adalah keadaan SESUDAH aplikasi dipakai. Keadaan SEBELUMNYA
 * tidak ada di mana pun — tidak pernah tercatat — sehingga harus direkonstruksi
 * dari arsip manual atau keterangan pelaksana, dan pada proposal WAJIB ditandai
 * sebagai estimasi. Memalsukan garis dasar adalah alasan diskualifikasi menurut
 * panduan lomba.
 */

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY
         || process.env.VITE_SUPABASE_ANON_KEY;

if (!URL || !KEY) {
  console.error("Set SUPABASE_URL dan SUPABASE_KEY lebih dahulu. Lihat keterangan di kepala berkas ini.");
  process.exit(1);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function ambil(path) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path} → ${r.status} ${await r.text()}`);
  return r.json();
}

// Mengambil bertahap: tabel jadwal bisa besar dan PostgREST membatasi barisnya.
async function ambilSemua(path, hal = 1000) {
  const out = [];
  for (let dari = 0; ; dari += hal) {
    const r = await fetch(`${URL}/rest/v1/${path}`, {
      headers: { ...H, Range: `${dari}-${dari + hal - 1}` },
    });
    if (!r.ok) throw new Error(`${path} → ${r.status} ${await r.text()}`);
    const b = await r.json();
    out.push(...b);
    if (b.length < hal) return out;
  }
}

const jam = (ms) => ms / 3600000;
const med = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const t = s.length >> 1;
  return s.length % 2 ? s[t] : (s[t - 1] + s[t]) / 2;
};
const rata = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const angka = (n, d = 1) => (n == null ? "—" : n.toFixed(d));
const BULAN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
const labelBulan = (k) => `${BULAN[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;

function bagian(judul) {
  console.log("\n" + "─".repeat(64));
  console.log(judul.toUpperCase());
  console.log("─".repeat(64));
}

const jadwal = (await ambilSemua("jadwal?select=data,updated_at&order=id"))
  .map(r => r.data).filter(Boolean);

bagian("cakupan data");
const semuaTgl = jadwal.map(e => e.tanggal).filter(Boolean).sort();
console.log(`Jumlah jadwal tercatat      : ${jadwal.length}`);
console.log(`Rentang tanggal kegiatan    : ${semuaTgl[0] || "—"} s.d. ${semuaTgl.at(-1) || "—"}`);

// Jejak audit paling awal menandai kapan aplikasi mulai benar-benar dipakai —
// keterangan yang menentukan kelayakan mengikuti kategori inovasi terapan.
const semuaJejak = jadwal.flatMap(e => e.timeline || []).filter(t => t?.at).sort((a, b) => a.at.localeCompare(b.at));
console.log(`Jejak audit paling awal     : ${semuaJejak[0]?.at?.slice(0, 10) || "— (belum ada)"}`);
console.log(`Jejak audit terakhir        : ${semuaJejak.at(-1)?.at?.slice(0, 10) || "—"}`);
console.log(`Total peristiwa terekam     : ${semuaJejak.length}`);

bagian("kecepatan penetapan jadwal");
// Dari pengajuan Admin RK sampai jadwal tayang — inti manfaat yang terukur.
const durasi = [], durasiKasubbag = [], durasiKabag = [];
let adaRework = 0;
for (const e of jadwal) {
  const tl = e.timeline || [];
  const t = (aksi) => tl.find(x => x.action === aksi)?.at;
  const submit = t("submit"), fwd = t("forward_to_kabag"), pub = t("publish");
  if (submit && pub) durasi.push(jam(Date.parse(pub) - Date.parse(submit)));
  if (submit && fwd) durasiKasubbag.push(jam(Date.parse(fwd) - Date.parse(submit)));
  if (fwd && pub)    durasiKabag.push(jam(Date.parse(pub) - Date.parse(fwd)));
  if (tl.some(x => x.action === "return_by_kasubbag" || x.action === "reject_by_kabag")) adaRework++;
}
console.log(`Jadwal dengan jejak lengkap : ${durasi.length}`);
console.log(`Pengajuan → tayang  median  : ${angka(med(durasi))} jam   (rata-rata ${angka(rata(durasi))} jam)`);
console.log(`  ├─ menunggu Kasubbag      : ${angka(med(durasiKasubbag))} jam`);
console.log(`  └─ menunggu Kabag         : ${angka(med(durasiKabag))} jam`);
console.log(`Jadwal yang sempat dikembalikan untuk diperbaiki: ${adaRework}` +
            (jadwal.length ? ` (${(adaRework / jadwal.length * 100).toFixed(1)}%)` : ""));

bagian("volume kegiatan per bulan");
const perBulan = {};
for (const e of jadwal) if (e.tanggal) perBulan[e.tanggal.slice(0, 7)] = (perBulan[e.tanggal.slice(0, 7)] || 0) + 1;
const bulanUrut = Object.keys(perBulan).sort();
for (const k of bulanUrut) {
  console.log(`  ${labelBulan(k).padEnd(10)} ${String(perBulan[k]).padStart(4)}  ${"█".repeat(Math.min(48, perBulan[k]))}`);
}
if (bulanUrut.length) {
  const nilai = bulanUrut.map(k => perBulan[k]);
  console.log(`  Rata-rata ${angka(rata(nilai))} kegiatan per bulan`);
}

bagian("cakupan pemakaian");
const jenis = {}, dgnPersonil = jadwal.filter(e => (e.personil || []).length).length;
for (const e of jadwal) jenis[e.jenisKegiatan || "(kosong)"] = (jenis[e.jenisKegiatan || "(kosong)"] || 0) + 1;
console.log(`Jadwal yang sudah ada penugasan personil : ${dgnPersonil}` +
            (jadwal.length ? ` (${(dgnPersonil / jadwal.length * 100).toFixed(1)}%)` : ""));
console.log(`Naskah sambutan disahkan                : ${jadwal.filter(e => e.sambutanSah).length}`);
console.log(`Berkas undangan terarsip                : ${jadwal.filter(e => e.undanganFile).length}`);
console.log(`Kegiatan yang sudah dievaluasi petugas   : ${jadwal.filter(e => Object.keys(e.evaluasi || {}).length).length}`);
console.log(`Agenda hasil konversi permohonan tamu    : ${jadwal.filter(e => e.created_from === "guest_module").length}`);
console.log("Jenis kegiatan:");
for (const [k, v] of Object.entries(jenis).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);

bagian("pelayanan permohonan tamu");
try {
  const tamu = await ambilSemua("permohonan_tamu?select=*");
  console.log(`Total permohonan masuk      : ${tamu.length}`);
  const st = {};
  for (const g of tamu) st[g.status || "(kosong)"] = (st[g.status || "(kosong)"] || 0) + 1;
  for (const [k, v] of Object.entries(st).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
  const putus = tamu
    .filter(g => g.created_at && g.responded_at)
    .map(g => jam(Date.parse(g.responded_at) - Date.parse(g.created_at)));
  if (putus.length) console.log(`Masuk → diputuskan  median : ${angka(med(putus))} jam  (dari ${putus.length} permohonan)`);
  else console.log("Masuk → diputuskan  median : — (kolom waktu keputusan belum terisi)");
} catch (e) { console.log("Tidak terbaca:", e.message.slice(0, 120)); }

bagian("peminjaman ruangan");
try {
  const bk = await ambilSemua("room_bookings?select=booking_code,status,created_at");
  const kode = new Set(bk.map(b => b.booking_code).filter(Boolean));
  console.log(`Baris slot            : ${bk.length}`);
  console.log(`Pengajuan (kode unik) : ${kode.size}`);
  const st = {};
  for (const b of bk) st[b.status] = (st[b.status] || 0) + 1;
  for (const [k, v] of Object.entries(st).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
} catch (e) { console.log("Tidak terbaca:", e.message.slice(0, 120)); }

bagian("pengguna");
try {
  const users = await ambil("users?select=role,disabled");
  const per = {};
  for (const u of users) if (!u.disabled) per[u.role] = (per[u.role] || 0) + 1;
  console.log(`Akun aktif : ${users.filter(u => !u.disabled).length} dari ${users.length}`);
  for (const [k, v] of Object.entries(per).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`);
} catch (e) { console.log("Tidak terbaca:", e.message.slice(0, 120)); }

try {
  const subs = await ambil("push_subscriptions?select=username");
  console.log(`Perangkat berlangganan notifikasi : ${subs.length}` +
              ` (${new Set(subs.map(s => s.username)).size} pengguna)`);
} catch { /* tabel opsional */ }

console.log("\n" + "─".repeat(64));
console.log("Angka di atas adalah keadaan SESUDAH aplikasi dipakai.");
console.log("Garis dasar SEBELUMNYA tidak pernah tercatat — rekonstruksikan dari");
console.log("arsip manual atau keterangan pelaksana, dan tandai sebagai estimasi");
console.log("pada proposal. Memalsukannya adalah alasan diskualifikasi.");
console.log("─".repeat(64));
