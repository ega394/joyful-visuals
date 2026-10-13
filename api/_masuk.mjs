/**
 * api/_masuk.mjs — cara masuk tambahan: passkey (sidik jari / Face ID / PIN
 * layar) dan "Masuk dengan Google". Dilayani lewat /api/room-booking?op=masuk_*
 * (berawalan garis bawah = modul, bukan fungsi Vercel; kuota 12 fungsi penuh).
 *
 * Aturan yang ditegakkan di sini, bukan di peramban:
 *  - Tidak ada pendaftaran akun. Passkey dan akun Google hanya dapat DITAUTKAN
 *    oleh pegawai yang sedang masuk (sesi peladen sah), dari menu Profil.
 *  - Masuk lewat passkey/Google hanya untuk akun yang tertaut DAN aktif;
 *    akun yang dinonaktifkan langsung tertolak.
 *  - Google dicocokkan lewat `sub` (nomor akun tetap), bukan email.
 *  - Setiap tantangan passkey sekali pakai, 5 menit. Token Google diperiksa
 *    ke Google (tokeninfo) dan harus diterbitkan untuk GOOGLE_CLIENT_ID ini.
 *  - Batas percobaan per alamat IP; setiap masuk/tautkan/lepas tercatat di
 *    audit_log.
 *
 * Konfigurasi: GOOGLE_CLIENT_ID (Vercel). Tanpa itu tombol Google tidak tampil.
 * Passkey tidak butuh konfigurasi; nama domain diambil dari permintaan dan
 * dibatasi ke daftar domain sah (MASUK_HOST).
 */

import {
  generateAuthenticationOptions, verifyAuthenticationResponse,
  generateRegistrationOptions, verifyRegistrationResponse,
} from "@simplewebauthn/server";
// CommonJS (lihat kepala _middleware.js) — impor bawaan, lalu ambil fungsinya.
import mw from "./_middleware.js";
const { rateLimit, getIP } = mw;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
// Token akses dari jendela masuk Google diperiksa ke Google sendiri: sah,
// belum kedaluwarsa, dan diterbitkan untuk aplikasi INI (aud = client ID).
const GOOGLE_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo?access_token=";
const UMUR_TANTANGAN_MS = 5 * 60 * 1000;
const MAKS_PASSKEY = 10;

// Domain tempat passkey boleh dibuat/dipakai. Passkey terikat pada domain,
// jadi yang dibuat di prokopim.tarakankota.go.id tidak berlaku di domain lain.
const HOST_SAH = [
  /(^|\.)tarakankota\.go\.id$/i,
  // Pratinjau Vercel hanya milik proyek sendiri, bukan sembarang *.vercel.app.
  /^(joyfulprokopim|jadwal-pimpinan)[a-z0-9-]*\.vercel\.app$/i,
  /^localhost$/i,
  /^127\.0\.0\.1$/,
  ...String(process.env.MASUK_HOST || "").split(",").map((s) => s.trim()).filter(Boolean)
    .map((h) => new RegExp("^" + h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i")),
];


function asalPermintaan(req) {
  const hostPenuh = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  const host = hostPenuh.replace(/:\d+$/, "");
  if (!host || !HOST_SAH.some((re) => re.test(host))) return null;
  const lokal = /^(localhost|127\.0\.0\.1)$/i.test(host);
  const proto = String(req.headers["x-forwarded-proto"] || (lokal ? "http" : "https")).split(",")[0].trim();
  return { rpID: host, origin: `${proto}://${hostPenuh}` };
}

const b64u = {
  dari: (bytes) => Buffer.from(bytes).toString("base64url"),
  ke: (s) => new Uint8Array(Buffer.from(String(s), "base64url")),
};

function idAcak(n = 24) { return b64u.dari(globalThis.crypto.getRandomValues(new Uint8Array(n))); }

const bersih = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);

/**
 * @param alat { sbGet, sbPost, sbPatch, sbDelete, verifySession, terbitkanSesi,
 *               tabelBelumAda, SUPA_URL, H }
 */
export async function tanganiMasuk(req, res, alat) {
  const { sbGet, sbPost, sbPatch, sbDelete, verifySession, terbitkanSesi, tabelBelumAda, SUPA_URL, H } = alat;
  const { method, query } = req;
  const body = req.body || {};
  const op = String(query.op || "");
  const ip = getIP(req);

  const gagal = (status, error) => res.status(status).json({ error });

  // ── utilitas ───────────────────────────────────────────────
  const audit = (actor, role, action, target, detail) =>
    sbPost("audit_log", {
      actor: actor || "-", actor_role: role || null, action, target: target || null,
      detail: detail || null, ip, user_agent: bersih(req.headers["user-agent"], 300),
    }).catch((e) => console.warn("[masuk] audit gagal:", e.message));

  const simpanTantangan = async (jenis, tantangan, username = null) => {
    const id = idAcak(18);
    // Buang tantangan basi sesekali supaya tabel tidak menumpuk.
    if (Math.random() < 0.1) sbDelete(`tantangan_masuk?kedaluwarsa=lt.${encodeURIComponent(new Date().toISOString())}`).catch(() => {});
    await sbPost("tantangan_masuk", {
      id, tantangan, jenis, username, kedaluwarsa: new Date(Date.now() + UMUR_TANTANGAN_MS).toISOString(),
    });
    return id;
  };

  // Ambil sekaligus hapus (sekali pakai). DELETE … return=representation
  // atomik: dua permintaan yang memakai id sama tidak bisa sama-sama berhasil.
  const pakaiTantangan = async (id, jenis, username = null) => {
    if (!/^[A-Za-z0-9_-]{10,64}$/.test(String(id || ""))) return null;
    const r = await fetch(`${SUPA_URL}/rest/v1/tantangan_masuk?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE", headers: { ...H(), Prefer: "return=representation" },
    });
    if (!r.ok) throw new Error(await r.text());
    const t = (await r.json())?.[0];
    if (!t || t.jenis !== jenis) return null;
    if (new Date(t.kedaluwarsa).getTime() < Date.now()) return null;
    if (username !== null && t.username !== username) return null;
    return t;
  };

  const penggunaAktif = async (username) => {
    const u = (await sbGet(
      `users?username=eq.${encodeURIComponent(username)}&select=username,nama,role,can_manage_rooms,disabled`
    ))?.[0];
    return u && !u.disabled ? u : null;
  };

  const verifikasiGoogle = async (tokenAkses) => {
    if (!GOOGLE_CLIENT_ID) throw Object.assign(new Error("Masuk dengan Google belum diaktifkan."), { status: 503 });
    const tok = String(tokenAkses || "");
    if (!/^[A-Za-z0-9._~+/=-]{20,4096}$/.test(tok)) throw new Error("Token Google tidak sah.");
    const r = await fetch(GOOGLE_TOKENINFO + encodeURIComponent(tok));
    if (!r.ok) throw new Error("Token Google tidak sah atau kedaluwarsa.");
    const info = await r.json();
    // Token milik aplikasi lain tidak boleh dipakai di sini, walau sah.
    if (info.aud !== GOOGLE_CLIENT_ID) throw new Error("Token Google bukan untuk aplikasi ini.");
    if (!info.sub) throw new Error("Token Google tidak memuat identitas akun.");
    if (!(Number(info.expires_in) > 0)) throw new Error("Token Google kedaluwarsa.");
    return { sub: String(info.sub), email: info.email || null };
  };

  const batasPublik = () => {
    const b = rateLimit("masuk:" + ip, 60, 60 * 1000);
    if (!b.allowed) { gagal(429, "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi."); return false; }
    return true;
  };

  try {
    // ── konfigurasi untuk layar login (publik) ─────────────────
    if (op === "masuk_konfig" && method === "GET") {
      return res.status(200).json({ google: GOOGLE_CLIENT_ID || null, passkey: !!asalPermintaan(req) });
    }

    // ── PASSKEY: masuk ─────────────────────────────────────────
    if (op === "masuk_passkey_mulai" && method === "POST") {
      if (!batasPublik()) return;
      const asal = asalPermintaan(req);
      if (!asal) return gagal(400, "Passkey tidak tersedia pada alamat ini.");
      // Tanpa daftar kredensial: perangkat menawarkan passkey milik situs ini
      // yang tersimpan, jadi pegawai tidak perlu mengetik nama pengguna.
      const options = await generateAuthenticationOptions({ rpID: asal.rpID, userVerification: "required", timeout: 60000 });
      const id = await simpanTantangan("passkey_masuk", options.challenge);
      return res.status(200).json({ id, options });
    }

    if (op === "masuk_passkey_selesai" && method === "POST") {
      if (!batasPublik()) return;
      const asal = asalPermintaan(req);
      if (!asal) return gagal(400, "Passkey tidak tersedia pada alamat ini.");
      const respons = body.respons;
      const t = await pakaiTantangan(body.id, "passkey_masuk");
      if (!t) return gagal(400, "Permintaan kedaluwarsa. Silakan ulangi.");
      const kred = (await sbGet(
        `kredensial_passkey?id=eq.${encodeURIComponent(String(respons?.id || ""))}&select=*`
      ))?.[0];
      if (!kred) {
        await audit("-", null, "login.passkey_gagal", null, { alasan: "tidak terdaftar" });
        return gagal(401, "Passkey ini tidak terdaftar. Masuk dengan sandi, lalu daftarkan ulang di Profil → Cara Masuk.");
      }
      let hasil;
      try {
        hasil = await verifyAuthenticationResponse({
          response: respons, expectedChallenge: t.tantangan,
          expectedOrigin: asal.origin, expectedRPID: asal.rpID, requireUserVerification: true,
          credential: { id: kred.id, publicKey: b64u.ke(kred.kunci_publik), counter: Number(kred.penghitung) || 0, transports: kred.transports || undefined },
        });
      } catch (e) {
        await audit(kred.username, null, "login.passkey_gagal", kred.username, { alasan: e.message.slice(0, 120) });
        return gagal(401, "Verifikasi passkey gagal. Silakan coba lagi atau masuk dengan sandi.");
      }
      if (!hasil.verified) return gagal(401, "Verifikasi passkey gagal.");
      const u = await penggunaAktif(kred.username);
      if (!u) {
        await audit(kred.username, null, "login.passkey_ditolak", kred.username, { alasan: "akun nonaktif" });
        return gagal(403, "Akun Anda dinonaktifkan. Hubungi Administrator.");
      }
      await sbPatch(`kredensial_passkey?id=eq.${encodeURIComponent(kred.id)}`, {
        penghitung: hasil.authenticationInfo.newCounter, terakhir_dipakai: new Date().toISOString(),
      }).catch(() => {});
      const sesi = await terbitkanSesi(u);
      await audit(u.username, u.role, "login.passkey", u.username, { perangkat: kred.nama_perangkat || null });
      return res.status(200).json({ ok: true, cara: "passkey", ...sesi });
    }

    // ── GOOGLE: masuk ─────────────────────────────────────────
    if (op === "masuk_google_selesai" && method === "POST") {
      if (!batasPublik()) return;
      let p;
      try { p = await verifikasiGoogle(body.access_token); }
      catch (e) {
        if (e.status) return gagal(e.status, e.message);
        await audit("-", null, "login.google_gagal", null, { alasan: e.message.slice(0, 120) });
        return gagal(401, "Verifikasi akun Google gagal. Silakan coba lagi.");
      }
      const tautan = (await sbGet(
        `tautan_login?penyedia=eq.google&sub=eq.${encodeURIComponent(p.sub)}&select=username`
      ))?.[0];
      if (!tautan) {
        await audit("-", null, "login.google_ditolak", null, { alasan: "belum tertaut" });
        return gagal(403, "Akun Google ini belum terhubung ke akun Prokopim. Masuk dengan sandi, lalu hubungkan di Profil → Cara Masuk.");
      }
      const u = await penggunaAktif(tautan.username);
      if (!u) {
        await audit(tautan.username, null, "login.google_ditolak", tautan.username, { alasan: "akun nonaktif" });
        return gagal(403, "Akun Anda dinonaktifkan. Hubungi Administrator.");
      }
      await sbPatch(`tautan_login?penyedia=eq.google&sub=eq.${encodeURIComponent(p.sub)}`, {
        terakhir_dipakai: new Date().toISOString(), email: bersih(p.email, 120) || null,
      }).catch(() => {});
      const sesi = await terbitkanSesi(u);
      await audit(u.username, u.role, "login.google", u.username, null);
      return res.status(200).json({ ok: true, cara: "google", ...sesi });
    }

    // ══ Mulai di sini wajib sesi: pegawai mengatur cara masuknya sendiri ══
    const pemohon = await verifySession(req);
    if (!pemohon) return gagal(401, "Sesi tidak valid — silakan login ulang.");
    const un = pemohon.username;

    if (op === "masuk_cara" && method === "GET") {
      const [kunci, tautan] = await Promise.all([
        sbGet(`kredensial_passkey?username=eq.${encodeURIComponent(un)}&select=id,nama_perangkat,dicadangkan,dibuat_pada,terakhir_dipakai&order=dibuat_pada.desc`),
        sbGet(`tautan_login?username=eq.${encodeURIComponent(un)}&select=penyedia,email,dibuat_pada,terakhir_dipakai`),
      ]);
      return res.status(200).json({ passkey: kunci || [], tautan: tautan || [], google: GOOGLE_CLIENT_ID || null });
    }

    if (op === "masuk_passkey_daftar_mulai" && method === "POST") {
      const asal = asalPermintaan(req);
      if (!asal) return gagal(400, "Passkey tidak tersedia pada alamat ini.");
      const ada = await sbGet(`kredensial_passkey?username=eq.${encodeURIComponent(un)}&select=id,transports`);
      if ((ada || []).length >= MAKS_PASSKEY) return gagal(400, `Paling banyak ${MAKS_PASSKEY} perangkat. Hapus perangkat lama terlebih dahulu.`);
      const options = await generateRegistrationOptions({
        rpName: "Prokopim Hibot", rpID: asal.rpID,
        userID: new TextEncoder().encode(un), userName: un, userDisplayName: pemohon.nama || un,
        attestationType: "none",
        excludeCredentials: (ada || []).map((k) => ({ id: k.id, transports: k.transports || undefined })),
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        timeout: 60000,
      });
      const id = await simpanTantangan("passkey_daftar", options.challenge, un);
      return res.status(200).json({ id, options });
    }

    if (op === "masuk_passkey_daftar_selesai" && method === "POST") {
      const asal = asalPermintaan(req);
      if (!asal) return gagal(400, "Passkey tidak tersedia pada alamat ini.");
      const t = await pakaiTantangan(body.id, "passkey_daftar", un);
      if (!t) return gagal(400, "Permintaan kedaluwarsa. Silakan ulangi.");
      let hasil;
      try {
        hasil = await verifyRegistrationResponse({
          response: body.respons, expectedChallenge: t.tantangan,
          expectedOrigin: asal.origin, expectedRPID: asal.rpID, requireUserVerification: true,
        });
      } catch (e) {
        return gagal(400, "Pendaftaran passkey gagal: " + e.message.slice(0, 120));
      }
      if (!hasil.verified) return gagal(400, "Pendaftaran passkey gagal.");
      const { credential, credentialBackedUp } = hasil.registrationInfo;
      const nama = bersih(body.nama_perangkat, 60) || "Perangkat";
      await sbPost("kredensial_passkey", {
        id: credential.id, username: un, kunci_publik: b64u.dari(credential.publicKey),
        penghitung: credential.counter || 0, transports: credential.transports || null,
        nama_perangkat: nama, dicadangkan: !!credentialBackedUp,
      });
      await audit(un, pemohon.role, "cara_masuk.passkey_tambah", un, { perangkat: nama });
      return res.status(200).json({ ok: true, id: credential.id, nama_perangkat: nama });
    }

    if (op === "masuk_passkey_hapus" && method === "POST") {
      const id = String(body.id || "");
      if (!/^[A-Za-z0-9_-]{8,1024}$/.test(id)) return gagal(400, "ID passkey tidak sah.");
      await sbDelete(`kredensial_passkey?id=eq.${encodeURIComponent(id)}&username=eq.${encodeURIComponent(un)}`);
      await audit(un, pemohon.role, "cara_masuk.passkey_hapus", un, null);
      return res.status(200).json({ ok: true });
    }

    if (op === "masuk_google_hubungkan" && method === "POST") {
      let p;
      try { p = await verifikasiGoogle(body.access_token); }
      catch (e) { return gagal(e.status || 400, e.status ? e.message : "Verifikasi akun Google gagal. Silakan coba lagi."); }
      const lain = (await sbGet(`tautan_login?penyedia=eq.google&sub=eq.${encodeURIComponent(p.sub)}&select=username`))?.[0];
      if (lain && lain.username !== un)
        return gagal(409, "Akun Google ini sudah terhubung ke akun pegawai lain.");
      // Satu akun Google per pegawai: tautan lama (bila ada) diganti.
      await sbDelete(`tautan_login?penyedia=eq.google&username=eq.${encodeURIComponent(un)}`);
      await sbPost("tautan_login", { penyedia: "google", sub: p.sub, username: un, email: bersih(p.email, 120) || null });
      await audit(un, pemohon.role, "cara_masuk.google_hubung", un, { email: bersih(p.email, 120) || null });
      return res.status(200).json({ ok: true, email: bersih(p.email, 120) || null });
    }

    if (op === "masuk_google_putus" && method === "POST") {
      await sbDelete(`tautan_login?penyedia=eq.google&username=eq.${encodeURIComponent(un)}`);
      await audit(un, pemohon.role, "cara_masuk.google_putus", un, null);
      return res.status(200).json({ ok: true });
    }

    // Superadmin mencabut semua cara masuk tambahan milik seorang pegawai
    // (mis. HP hilang). Sandi tidak tersentuh.
    if (op === "masuk_cabut" && method === "POST") {
      if (pemohon.role !== "superadmin") return gagal(403, "Hanya superadmin.");
      const target = String(body.username || "").toLowerCase().trim();
      if (!/^[a-z0-9._-]{2,40}$/.test(target)) return gagal(400, "Username tidak sah.");
      await sbDelete(`kredensial_passkey?username=eq.${encodeURIComponent(target)}`);
      await sbDelete(`tautan_login?username=eq.${encodeURIComponent(target)}`);
      await audit(un, pemohon.role, "cara_masuk.cabut", target, null);
      return res.status(200).json({ ok: true });
    }

    return gagal(404, "Operasi tidak dikenal.");
  } catch (e) {
    if (tabelBelumAda(e)) return gagal(503, "Fitur cara masuk belum aktif — jalankan migrasi 2026-10-13_cara_masuk.sql.");
    console.error("[masuk]", op, e.message);
    return gagal(500, "Terjadi kesalahan pada peladen.");
  }
}
