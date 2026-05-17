// vite.config.ts
// TUGAS 3 FIX: Kembali ke generateSW (tidak butuh workbox npm packages)
// Push notification handler diload via importScripts dari /public/push-handler.js

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// ✅ 1. Import package.json untuk mengambil nomor versi secara otomatis
import pkg from "./package.json";

// ✅ 2. Buat penanda waktu otomatis zona WITA (Makassar/Tarakan)
const buildTime = new Date().toLocaleString('id-ID', { 
  timeZone: 'Asia/Makassar', 
  day: '2-digit', 
  month: 'short', 
  year: 'numeric', 
  hour: '2-digit', 
  minute: '2-digit' 
});

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      external: [
        "@aparajita/capacitor-biometric-auth",
        "@capacitor/core",
        "@capacitor/app",
        "@capacitor/haptics",
        "@capacitor/keyboard",
        "@capacitor/status-bar",
      ],
    },
  },
  
  // ✅ 3. Suntikkan variabel ini agar bisa dibaca di seluruh aplikasi React Bapak
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime)
  },

  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "Prokopim Kota Tarakan",
        short_name: "Prokopim",
        description: "Aplikasi Agenda Pimpinan Kota Tarakan",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "icon-72x72.png",   sizes: "72x72",   type: "image/png" },
          { src: "icon-96x96.png",   sizes: "96x96",   type: "image/png" },
          { src: "icon-128x128.png", sizes: "128x128", type: "image/png" },
          { src: "icon-144x144.png", sizes: "144x144", type: "image/png" },
          { src: "icon-152x152.png", sizes: "152x152", type: "image/png" },
          { src: "pwa-192x192.png",  sizes: "192x192", type: "image/png" },
          { src: "icon-384x384.png", sizes: "384x384", type: "image/png" },
          { src: "pwa-512x512.png",  sizes: "512x512", type: "image/png" },
          { src: "pwa-512x512.png",  sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],

        // ✅ Hindari bundle basi: bersihkan precache lama & ambil alih segera
        // Mencegah index.html lama memuat chunk JS yang sudah terhapus
        // (penyebab React gagal mount → form tidak bisa diketik)
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,

        // ✅ FIX: Jangan intercept /api/* — biarkan ke server
        navigateFallbackDenylist: [
          /^\/api\/.*/,
          /^\/sw\.js$/,
          /^\/push-handler\.js$/,
        ],

        runtimeCaching: [
          {
            // API Vercel → tidak pernah di-cache
            urlPattern: /^\/api\/.*/,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],

        // ✅ TUGAS 3: Load push handler dari /public/push-handler.js
        // File ini menangani event 'push' dan 'notificationclick'
        // Tanpa butuh npm packages tambahan
        importScripts: ["/push-handler.js"],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
