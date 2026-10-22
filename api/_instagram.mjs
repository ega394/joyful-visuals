// api/_instagram.mjs — membaca postingan akun Instagram resmi (@humas_tarakan)
//
// Untuk IKU 3 (komunikasi pimpinan tepat waktu): berita kegiatan dianggap
// selesai saat TERBIT di akun resmi, paling lambat 24 jam sesudah acara
// (keputusan Kabag 22 Oktober 2026). Pencocokan postingan dengan agenda
// dilakukan di peramban (src/lib/beritaInstagram.js); modul ini hanya
// mengambil dan menyimpan postingannya.
//
// Jalur resmi Meta "Instagram API with Instagram Login", izin hanya-baca
// `instagram_business_basic`. Tidak ada yang bisa diunggah atau dihapus.
//
// TOKEN
//   - Token awal diisi di Vercel sebagai IG_TOKEN (lihat docs/PANDUAN-INSTAGRAM.md).
//   - Masa berlakunya 60 hari. Jadwal harian (notif-cron) memperpanjangnya
//     sebelum habis; token hasil perpanjangan disimpan di tabel
//     `instagram_akun` (tertutup bagi kunci publik) dan diutamakan daripada
//     IG_TOKEN. Mengganti IG_TOKEN di Vercel dengan token baru tetap bisa:
//     token di tabel ditimpa bila IG_TOKEN berbeda dari yang terakhir dipasang.
//   - Token tidak pernah dikirim ke peramban dan tidak pernah dicatat di log.
//
// Tabel: supabase-migrations/2026-10-22_instagram.sql. Hanya kunci layanan.

const API = "https://graph.instagram.com";
const KOLOM = "id,caption,permalink,timestamp,media_type";
export const JEDA_SINKRON_MS = 15 * 60 * 1000;   // paling sering sekali per 15 menit
const PERPANJANG_BILA_SISA_HARI = 30;
const MAKS_HALAMAN = 20;                          // 20 × 100 postingan sekali jalan

const SUPA_URL = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPA_KEY = () => process.env.SUPABASE_SERVICE_KEY || "";
const H = (prefer) => ({
  "Content-Type": "application/json", apikey: SUPA_KEY(), Authorization: "Bearer " + SUPA_KEY(),
  ...(prefer ? { Prefer: prefer } : {}),
});

export const instagramDisiapkan = () => !!(process.env.IG_TOKEN && SUPA_KEY());

// Sidik token: cukup untuk mengenali "IG_TOKEN sudah diganti" tanpa
// menyimpan atau membandingkan tokennya sendiri di mana-mana selain tabel.
function sidik(t) {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return String(t.length) + ":" + (h >>> 0).toString(36);
}

async function sb(path, init = {}) {
  const r = await fetch(`${SUPA_URL()}/rest/v1/${path}`, { ...init, headers: { ...H(init.prefer), ...(init.headers || {}) } });
  const teks = await r.text();
  if (!r.ok) throw new Error(`supabase ${r.status}: ${teks.slice(0, 200)}`);
  // return=minimal membalas 201/204 tanpa isi.
  return teks ? JSON.parse(teks) : null;
}

async function bacaAkun() {
  const rows = await sb("instagram_akun?id=eq.1&select=*");
  return rows?.[0] || null;
}
async function simpanAkun(patch) {
  await sb("instagram_akun?on_conflict=id", {
    method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify([{ id: 1, ...patch }]),
  });
}

// Tautan `paging.next` dari Meta sudah memuat token; buang token dan host,
// karena ig() memasangnya sendiri.
export function jalurBerikut(next) {
  const u = new URL(next);
  u.searchParams.delete("access_token");
  return u.pathname.replace(/^\/(v[\d.]+\/)?/, "") + (u.search ? u.search : "");
}

// Galat Graph API memuat pesan yang aman ditampilkan; token tidak pernah ikut.
async function ig(path, token, f = fetch) {
  const url = `${API}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`;
  const r = await f(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = new Error((j.error && j.error.message) || `Instagram ${r.status}`);
    e.kode = j.error && j.error.code;
    throw e;
  }
  return j;
}

/** Token yang berlaku: dari tabel bila masih milik IG_TOKEN yang sama, selain itu IG_TOKEN. */
async function tokenBerlaku(akun) {
  const env = process.env.IG_TOKEN || "";
  if (akun?.token && akun.sumber_sidik === sidik(env)) return { token: akun.token, akun };
  // IG_TOKEN baru (atau pertama kali): pasang ulang dari awal.
  const baru = { token: env, sumber_sidik: sidik(env), token_kedaluwarsa: null, token_diperbarui: new Date().toISOString(), galat: null, galat_perpanjang: null };
  await simpanAkun(baru);
  return { token: env, akun: { ...(akun || {}), ...baru } };
}

/** Perpanjang token bila sisa masa berlakunya kurang dari 30 hari (atau belum diketahui). */
export async function perpanjangToken({ f = fetch, sekarang = Date.now() } = {}) {
  if (!instagramDisiapkan()) return { nonaktif: true };
  const { token, akun } = await tokenBerlaku(await bacaAkun());
  const habis = akun.token_kedaluwarsa ? Date.parse(akun.token_kedaluwarsa) : 0;
  const umur = sekarang - Date.parse(akun.token_diperbarui || 0);
  if (habis && habis - sekarang > PERPANJANG_BILA_SISA_HARI * 86400000) return { diperpanjang: false };
  if (umur < 24 * 3600000) return { diperpanjang: false };   // Meta: token minimal berumur 24 jam
  try {
    const j = await ig(`refresh_access_token?grant_type=ig_refresh_token`, token, f);
    await simpanAkun({
      token: j.access_token, token_kedaluwarsa: new Date(sekarang + (j.expires_in || 0) * 1000).toISOString(),
      token_diperbarui: new Date(sekarang).toISOString(), galat_perpanjang: null,
    });
    return { diperpanjang: true };
  } catch (e) {
    await simpanAkun({ galat_perpanjang: e.message.slice(0, 200) });
    return { diperpanjang: false, galat: e.message };
  }
}

/**
 * Ambil postingan terbaru dan simpan. Berhenti di postingan yang lebih tua
 * dari `sejak` (YYYY-MM-DD) atau yang sudah tersimpan sebelumnya.
 */
export async function sinkronPostingan({ sejak, paksa = false, f = fetch, sekarang = Date.now() } = {}) {
  if (!instagramDisiapkan()) return { nonaktif: true };
  let { token, akun } = await tokenBerlaku(await bacaAkun());
  if (!paksa && akun.sinkron_at && sekarang - Date.parse(akun.sinkron_at) < JEDA_SINKRON_MS) {
    return { dilewati: true };
  }
  try {
    if (!akun.username) {
      const me = await ig("me?fields=user_id,username", token, f);
      await simpanAkun({ username: me.username, ig_user_id: String(me.user_id || me.id || "") });
    }
    // Cukup ambil yang belum tersimpan: berhenti begitu bertemu postingan
    // lama (kecuali `sejak` lebih awal dari isi tabel — pengisian awal).
    const terakhir = (await sb("instagram_postingan?select=terbit_at&order=terbit_at.desc&limit=1"))?.[0]?.terbit_at;
    const tertua = (await sb("instagram_postingan?select=terbit_at&order=terbit_at.asc&limit=1"))?.[0]?.terbit_at;
    const batasSejak = sejak ? Date.parse(sejak + "T00:00:00+08:00") : 0;
    const isiAwal = !tertua || (batasSejak && Date.parse(tertua) > batasSejak + 86400000);

    let url = `me/media?fields=${KOLOM}&limit=100`;
    let baru = 0;
    for (let hal = 0; hal < MAKS_HALAMAN && url; hal++) {
      const j = await ig(url, token, f);
      const rows = (j.data || []).map((m) => ({
        id: String(m.id), caption: m.caption || "", permalink: m.permalink || null,
        terbit_at: m.timestamp ? new Date(m.timestamp).toISOString() : null, media_type: m.media_type || null,
        diambil_at: new Date(sekarang).toISOString(),
      })).filter((r) => r.terbit_at);
      if (rows.length) {
        await sb("instagram_postingan?on_conflict=id", {
          method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: JSON.stringify(rows),
        });
        baru += rows.length;
      }
      const paling = rows.length ? Date.parse(rows[rows.length - 1].terbit_at) : 0;
      const lewatSejak = batasSejak && paling && paling < batasSejak;
      const sudahAda = !isiAwal && terakhir && paling && paling < Date.parse(terakhir) - 3 * 86400000;
      const next = j.paging && j.paging.next;
      // Tautan `next` dari Meta sudah memuat token; ambil hanya bagian setelah host.
      url = !lewatSejak && !sudahAda && next ? jalurBerikut(next) : null;
    }
    await simpanAkun({ sinkron_at: new Date(sekarang).toISOString(), sinkron_ok_at: new Date(sekarang).toISOString(), galat: null });
    return { ok: true, diambil: baru };
  } catch (e) {
    await simpanAkun({ sinkron_at: new Date(sekarang).toISOString(), galat: e.message.slice(0, 300) });
    return { ok: false, galat: e.message };
  }
}

/** Status sambungan dan postingan sejak tanggal tertentu — untuk peramban. */
export async function bacaPostingan({ sejak }) {
  if (!instagramDisiapkan()) return { status: { tersambung: false, alasan: "IG_TOKEN belum diisi di Vercel." }, postingan: [] };
  const akun = await bacaAkun().catch(() => null);
  const batas = sejak ? new Date(sejak + "T00:00:00+08:00").toISOString() : new Date(Date.now() - 400 * 86400000).toISOString();
  const postingan = await sb(
    `instagram_postingan?select=id,caption,permalink,terbit_at,media_type&terbit_at=gte.${encodeURIComponent(batas)}&order=terbit_at.desc&limit=3000`
  );
  return {
    status: {
      tersambung: !!akun?.sinkron_ok_at && !akun.galat,
      username: akun?.username || null,
      sinkron_at: akun?.sinkron_ok_at || null,
      token_kedaluwarsa: akun?.token_kedaluwarsa || null,
      galat: akun?.galat || akun?.galat_perpanjang || null,
    },
    postingan: postingan || [],
  };
}
