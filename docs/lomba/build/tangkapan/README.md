# Tangkapan layar Lampiran 4 (proposal Tarakan)

Diambil dari aplikasi versi terbaru dengan **data contoh** (`data.mjs`, seluruhnya rekaan).
Supabase, `/api/*`, Apps Script daftar hadir, dan cuaca dilayani peladen tiruan
(`mock.mjs`) lewat intersepsi Playwright, sehingga tidak ada data sungguhan yang tersentuh.

```bash
# dari akar repositori
VITE_SUPABASE_URL=https://contoh.supabase.co VITE_SUPABASE_ANON_KEY=demo \
VITE_ABSEN_URL=https://absen.contoh/exec VITE_ABSEN_TOKEN=demo VITE_OPENWEATHER_KEY=demo \
  npx vite build --outDir /tmp/dist-demo
npx vite preview --outDir /tmp/dist-demo --port 4180 --strictPort --host 127.0.0.1 &
node docs/lomba/build/tangkapan/tangkap.mjs            # semua, atau sebut nama: kabag_antrian hp_walikota
```

Hasil PNG di `out/` (diabaikan git). Gambar untuk proposal dikompres menjadi JPEG di
`docs/lomba/tarakan/tangkapan/` beserta `ukuran.json`. Jam peramban dipatok
Selasa, 6 Oktober 2026 pukul 08.40 WITA.
