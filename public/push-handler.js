// FILE: public/push-handler.js
// Diload oleh Service Worker via importScripts
// Menangani Tugas 3: Push notification + Click-to-redirect
//
// Tidak butuh npm packages — vanilla JS murni
// Otomatis tersedia di semua browser yang support SW

// ── LENCANA: angka di ikon aplikasi (iPhone 16.4+, Android) ─
// Hitungan disimpan di Cache Storage yang sama dengan src/lib/lencana.js.
// Saat aplikasi tertutup, setiap push menambah 1; saat aplikasi dibuka,
// angka ditimpa dengan jumlah tugas yang sebenarnya.
var CACHE_LENCANA = "prokopim-lencana";
var KUNCI_LENCANA = "/__lencana";
function naikkanLencana(nilai) {
  if (!self.navigator || !("setAppBadge" in self.navigator)) return Promise.resolve();
  return caches.open(CACHE_LENCANA).then(function (c) {
    return c.match(KUNCI_LENCANA)
      .then(function (r) { return r ? r.text() : "0"; })
      .then(function (t) {
        var n = typeof nilai === "number" && nilai >= 0 ? nilai : (parseInt(t, 10) || 0) + 1;
        return c.put(KUNCI_LENCANA, new Response(String(n))).then(function () {
          return n > 0 ? self.navigator.setAppBadge(n) : self.navigator.clearAppBadge();
        });
      });
  }).catch(function () { /* lencana bersifat pelengkap; notifikasi tetap tampil */ });
}

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

  event.waitUntil(Promise.all([
    self.registration.showNotification(data.title || "Prokopim", options),
    // data.lencana (opsional, angka) menimpa hitungan bila server mengetahuinya.
    naikkanLencana(data.lencana),
  ]));
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
