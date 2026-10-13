/**
 * src/lib/caraMasuk.js — passkey (sidik jari / Face ID / PIN layar) dan
 * "Masuk dengan Google" di sisi peramban.
 *
 * Peramban hanya meneruskan: tantangan dibuat dan jawabannya diperiksa peladen
 * (/api/room-booking?op=masuk_*, lihat api/_masuk.mjs). Hasil yang sah berupa
 * token sesi peladen, sama seperti masuk dengan sandi.
 */

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { sesiFetch } from "../roomAuth";

const API = "/api/room-booking?op=";

async function kirim(op, data, pakaiSesi = false) {
  const f = pakaiSesi ? sesiFetch : fetch;
  const r = await f(API + op, {
    method: data === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || "Gagal (HTTP " + r.status + ")"), { status: r.status });
  return d;
}

/** Apakah peramban ini mendukung passkey. */
export function passkeyDidukung() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential && !!window.isSecureContext;
}

/** Pembatalan oleh pengguna (menutup jendela sidik jari) tidak perlu tampil sebagai galat. */
export function dibatalkan(e) {
  return e && (e.name === "NotAllowedError" || e.name === "AbortError");
}

let _konfig = null;
/** { google: clientId|null, passkey: boolean } — sekali per pemuatan halaman. */
export function konfigMasuk() {
  if (!_konfig) _konfig = kirim("masuk_konfig").catch(() => ({ google: null, passkey: false }));
  return _konfig;
}

/** Masuk dengan passkey. Mengembalikan data sesi dari peladen. */
export async function masukPasskey() {
  const { id, options } = await kirim("masuk_passkey_mulai", {});
  const respons = await startAuthentication({ optionsJSON: options });
  return kirim("masuk_passkey_selesai", { id, respons });
}

/** Nama perangkat yang mudah dikenali, mis. "iPhone · Safari". */
export function namaPerangkat(ua = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Perangkat";
  const br = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return br ? os + " · " + br : os;
}

/** Daftarkan passkey untuk pengguna yang sedang masuk. */
export async function daftarPasskey() {
  const { id, options } = await kirim("masuk_passkey_daftar_mulai", {}, true);
  const respons = await startRegistration({ optionsJSON: options });
  return kirim("masuk_passkey_daftar_selesai", { id, respons, nama_perangkat: namaPerangkat() }, true);
}

export const daftarCaraMasuk = () => kirim("masuk_cara", undefined, true);
export const hapusPasskey = (id) => kirim("masuk_passkey_hapus", { id }, true);
export const putuskanGoogle = () => kirim("masuk_google_putus", {}, true);

// ── Google Identity Services ─────────────────────────────────
let _gis = null;
function muatGIS() {
  if (typeof window !== "undefined" && window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!_gis) {
    _gis = new Promise((ok, gagal) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => (window.google?.accounts?.id ? ok(window.google) : gagal(new Error("Layanan Google tidak termuat")));
      s.onerror = () => { _gis = null; gagal(new Error("Layanan Google tidak dapat dihubungi")); };
      document.head.appendChild(s);
    });
  }
  return _gis;
}

/**
 * Pasang tombol resmi Google pada elemen `el`.
 *   mode "masuk"     → hasil: data sesi (pengguna belum masuk)
 *   mode "hubungkan" → hasil: { email } (pengguna sedang masuk)
 * Setiap tombol memakai nonce sekali pakai dari peladen; setelah dipakai
 * (berhasil atau gagal) tombol dipasang ulang dengan nonce baru.
 */
export async function pasangTombolGoogle(el, { mode = "masuk", onHasil, onGalat, onProses, lebar = 300, tema = "outline" } = {}) {
  const [{ id, nonce, clientId }, google] = await Promise.all([
    kirim("masuk_google_mulai", {}),
    muatGIS(),
  ]);
  google.accounts.id.initialize({
    client_id: clientId,
    nonce,
    ux_mode: "popup",
    auto_select: false,
    cancel_on_tap_outside: true,
    itp_support: true,
    callback: async (resp) => {
      onProses && onProses(true);
      try {
        const op = mode === "hubungkan" ? "masuk_google_hubungkan" : "masuk_google_selesai";
        const hasil = await kirim(op, { id, credential: resp.credential }, mode === "hubungkan");
        onHasil && onHasil(hasil);
      } catch (e) {
        onGalat && onGalat(e);
        // Nonce sudah terpakai — siapkan tombol baru untuk percobaan berikutnya.
        pasangTombolGoogle(el, { mode, onHasil, onGalat, onProses, lebar, tema }).catch(() => {});
      } finally {
        onProses && onProses(false);
      }
    },
  });
  if (!el || !el.isConnected) return;
  el.innerHTML = "";
  google.accounts.id.renderButton(el, {
    // Tema resmi Google: "filled_black" untuk latar gelap, "outline" untuk latar terang.
    type: "standard", theme: tema, size: "large", shape: "pill",
    text: mode === "hubungkan" ? "continue_with" : "signin_with",
    locale: "id", width: Math.max(200, Math.min(400, Math.round(lebar))),
  });
}
