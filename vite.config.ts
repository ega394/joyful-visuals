import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
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
  { src: "icon-72x72.png",    sizes: "72x72",    type: "image/png" },
  { src: "icon-96x96.png",    sizes: "96x96",    type: "image/png" },
  { src: "icon-128x128.png",  sizes: "128x128",  type: "image/png" },
  { src: "icon-144x144.png",  sizes: "144x144",  type: "image/png" },
  { src: "icon-152x152.png",  sizes: "152x152",  type: "image/png" },
  { src: "pwa-192x192.png",   sizes: "192x192",  type: "image/png" },
  { src: "icon-384x384.png",  sizes: "384x384",  type: "image/png" },
  { src: "pwa-512x512.png",   sizes: "512x512",  type: "image/png" },
  { src: "pwa-512x512.png",   sizes: "512x512",  type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
