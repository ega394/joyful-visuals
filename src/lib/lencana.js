// Angka lencana pada ikon aplikasi di layar utama (Badging API).
//
// Di iPhone, lencana hanya berlaku untuk aplikasi yang sudah "Tambahkan ke Layar
// Utama" (iOS 16.4 ke atas) dan sudah diberi izin notifikasi. Di peramban yang
// tidak mendukung, fungsi ini diam saja.
//
// Hitungannya juga disimpan di Cache Storage, supaya Service Worker
// (public/push-handler.js) dapat menambah angka saat push masuk ketika
// aplikasi tertutup, lalu aplikasi menimpanya dengan angka sebenarnya saat dibuka.

export const CACHE_LENCANA = "prokopim-lencana";
export const KUNCI_LENCANA = "/__lencana";

export function hitungLencana({ pending = 0, notif = 0 } = {}) {
  const n = Math.max(0, (pending | 0) + (notif | 0));
  return Number.isFinite(n) ? n : 0;
}

export async function pasangLencana(n) {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  try {
    if (nav && "setAppBadge" in nav) {
      if (n > 0) await nav.setAppBadge(n);
      else await nav.clearAppBadge?.();
    }
  } catch { /* izin notifikasi belum diberikan, atau mode peramban biasa */ }
  try {
    if (typeof caches !== "undefined") {
      const c = await caches.open(CACHE_LENCANA);
      await c.put(KUNCI_LENCANA, new Response(String(n)));
    }
  } catch { /* penyimpanan diblokir: lencana tetap jalan tanpa hitungan latar */ }
}
