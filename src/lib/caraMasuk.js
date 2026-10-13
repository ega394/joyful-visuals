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
// Tombol dibuat sendiri (tampilan mengikuti aplikasi); jendela masuknya tetap
// jendela resmi Google. Hasilnya token akses yang diperiksa peladen ke Google
// (tokeninfo) — harus sah, belum kedaluwarsa, dan diterbitkan untuk aplikasi ini.
let _gis = null;
/** Muat pustaka Google lebih awal, supaya jendela masuk terbuka langsung saat tombol diketuk. */
export function muatGIS() {
  if (typeof window !== "undefined" && window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (!_gis) {
    _gis = new Promise((ok, gagal) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => (window.google?.accounts?.oauth2 ? ok(window.google) : gagal(new Error("Layanan Google tidak termuat")));
      s.onerror = () => { _gis = null; gagal(new Error("Layanan Google tidak dapat dihubungi")); };
      document.head.appendChild(s);
    });
  }
  return _gis;
}

/** Buka jendela masuk Google dan kembalikan token aksesnya. Panggil dari ketukan tombol. */
export async function mintaTokenGoogle(clientId) {
  const google = await muatGIS();
  return new Promise((ok, gagal) => {
    const klien = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      prompt: "select_account",
      callback: (r) => (r && r.access_token ? ok(r.access_token) : gagal(new Error(r?.error_description || "Masuk dengan Google gagal"))),
      error_callback: (e) => gagal(Object.assign(
        new Error(e?.type === "popup_failed_to_open" ? "Jendela Google diblokir peramban. Izinkan pop-up lalu coba lagi." : "Masuk dengan Google dibatalkan"),
        { name: e?.type === "popup_closed" ? "AbortError" : "Error" })),
    });
    klien.requestAccessToken();
  });
}

export const masukGoogle = (access_token) => kirim("masuk_google_selesai", { access_token });
export const hubungkanGoogle = (access_token) => kirim("masuk_google_hubungkan", { access_token }, true);
