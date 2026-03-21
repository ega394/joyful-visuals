// FILE: public/push-handler.js
// Diload oleh Service Worker via importScripts
// Menangani Tugas 3: Push notification + Click-to-redirect
//
// Tidak butuh npm packages — vanilla JS murni
// Otomatis tersedia di semua browser yang support SW

// ── PUSH: Tampilkan notifikasi saat server kirim push ──────
self.addEventListener("push", function (event) {
  var data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: "Prokopim",
      body: event.data ? event.data.text() : "Ada notifikasi baru.",
    };
  }

  var options = {
    body:              data.body              || "",
    icon:              data.icon              || "/pwa-192x192.png",
    badge:             data.badge             || "/icon-72x72.png",
    tag:               data.tag               || "prokopim-notif",
    requireInteraction: data.requireInteraction || false,
    vibrate:           [200, 100, 200],
    // ✅ Simpan URL & agendaId — akan dibaca saat notif diklik
    data: {
      url:      data.url      || "/",
      agendaId: data.agendaId || null,
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Prokopim", options)
  );
});

// ── NOTIFICATIONCLICK: Click-to-redirect (Tugas 3) ─────────
self.addEventListener("notificationclick", function (event) {
  // Tutup notifikasi
  event.notification.close();

  // Baca URL tujuan dari data notifikasi
  var targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : "/";

  event.waitUntil(
    // Cari tab yang sudah buka aplikasi ini
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        // Cari tab yang URL-nya dari domain yang sama
        var existingTab = null;
        for (var i = 0; i < clientList.length; i++) {
          if (clientList[i].url.indexOf(self.location.origin) === 0) {
            existingTab = clientList[i];
            break;
          }
        }

        if (existingTab) {
          // ✅ Tab sudah ada → fokus lalu navigasi ke URL tujuan
          return existingTab.focus().then(function (focused) {
            return focused.navigate(targetUrl);
          });
        }

        // ✅ Belum ada tab → buka window baru
        return self.clients.openWindow(targetUrl);
      })
  );
});
