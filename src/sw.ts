/// <reference lib="webworker" />
// ============================================================
// FILE: src/sw.ts  ← BARU
// LOKASI: /src/sw.ts  (bukan /public!)
// FUNGSI: Custom Service Worker untuk Prokopim PWA
//
// Kenapa di /src bukan /public?
//   File ini di-compile oleh Vite saat build.
//   Workbox akan inject daftar file cache ke dalam file ini
//   secara otomatis (via self.__WB_MANIFEST).
//
// Isi file ini:
//   1. Precaching (Workbox inject otomatis)
//   2. Runtime caching (Supabase & API)
//   3. Push Notification handler
//   4. notificationclick → click-to-redirect (Tugas 3)
//   5. Install & Activate lifecycle
// ============================================================

import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkFirst, NetworkOnly } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

// ── 1. PRECACHING ────────────────────────────────────────────
// self.__WB_MANIFEST diisi otomatis oleh VitePWA saat build
// berisi semua file JS/CSS/HTML yang perlu di-cache
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── 2. NAVIGATION ROUTING ────────────────────────────────────
// Semua navigasi ke halaman app → ambil index.html dari cache
// KECUALI /api/* → tidak boleh dicegat SW
const navigationHandler = createHandlerBoundToURL("/index.html");
const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [
    /^\/api\/.*/,   // Jangan intercept API calls
    /^\/sw\.js$/,   // Jangan intercept SW itu sendiri
  ],
});
registerRoute(navigationRoute);

// ── 3. RUNTIME CACHING ───────────────────────────────────────
// Supabase → Network First (prioritaskan data segar)
registerRoute(
  ({ url }) => url.hostname.includes("supabase.co"),
  new NetworkFirst({
    cacheName: "supabase-cache",
    networkTimeoutSeconds: 5,
  })
);

// API Vercel → Network Only (tidak pernah di-cache)
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new NetworkOnly()
);

// ── 4. PUSH NOTIFICATION HANDLER ─────────────────────────────
// Dipanggil saat server kirim push via web-push library
self.addEventListener("push", (event) => {
  let data: {
    title?: string;
    body?: string;
    url?: string;
    agendaId?: string | null;
    tag?: string;
    icon?: string;
    badge?: string;
    requireInteraction?: boolean;
  } = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Jika payload bukan JSON, gunakan sebagai body text
    data = {
      title: "Prokopim",
      body: event.data?.text() ?? "Ada notifikasi baru.",
    };
  }

  const options: NotificationOptions = {
    body:              data.body              ?? "",
    icon:              data.icon              ?? "/pwa-192x192.png",
    badge:             data.badge             ?? "/icon-72x72.png",
    tag:               data.tag               ?? "prokopim-notif",
    requireInteraction: data.requireInteraction ?? false,
    vibrate:           [200, 100, 200],
    // ✅ TUGAS 3: Simpan URL & agendaId di data notifikasi
    // Akan dibaca oleh notificationclick di bawah
    data: {
      url:      data.url      ?? "/",
      agendaId: data.agendaId ?? null,
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title ?? "Prokopim", options)
  );
});

// ── 5. NOTIFICATIONCLICK → CLICK-TO-REDIRECT ─────────────────
// Tugas 3: Saat notifikasi diklik, buka/fokuskan app ke URL tujuan
self.addEventListener("notificationclick", (event) => {
  // Tutup notifikasi setelah diklik
  event.notification.close();

  // Baca URL dari data notifikasi (diset saat push diterima)
  const targetUrl: string = event.notification.data?.url ?? "/";

  event.waitUntil(
    // Cari semua tab/window yang sedang buka aplikasi ini
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {

        // Cari tab yang sudah buka domain aplikasi ini
        const existingTab = clientList.find(
          (client) =>
            client.url.startsWith(self.location.origin) &&
            "focus" in client
        );

        if (existingTab) {
          // ✅ Tab sudah ada → fokuskan tab itu lalu navigasi ke URL tujuan
          return (existingTab as WindowClient).focus().then((focused) =>
            focused.navigate(targetUrl)
          );
        }

        // ✅ Belum ada tab → buka window baru langsung ke URL tujuan
        return self.clients.openWindow(targetUrl);
      })
  );
});

// ── 6. INSTALL & ACTIVATE LIFECYCLE ─────────────────────────
// Paksa SW baru langsung aktif tanpa menunggu tab lama ditutup
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
