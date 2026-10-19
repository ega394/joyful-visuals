# Video Tahap II — Prokopim Hibot

Semua adegan aplikasi direkam dari aplikasi berdata contoh (`../tangkapan/mock.mjs`), tanpa data sungguhan.

1. Bangun aplikasi untuk peladen tiruan dan jalankan di 127.0.0.1:4180 (lihat `../tangkapan/README.md`).
2. `node adegan.mjs` — rekam adegan aplikasi 6–11 dan 14 ke `rek/` (screencast CDP + kursor tampak).
3. `node render.mjs latar` lalu `node render.mjs penuh` — latar perangkat dan adegan grafis (`grafis.html`) per bingkai ke `gr/`.
4. `python3 susun.py` — bingkai perangkat, takarir ASS (huruf Plus Jakarta Sans terpasang di `~/.fonts`), gabung MP4 4:55.
   Narasi dubber diletakkan di `narasi/adegan-NN.wav|m4a|mp3`; bila ada, otomatis dicampur pada awal tiap adegan.
   Rekaman nyata Wali Kota (`IMG_1727-1731.MOV`, `pernyataan-walikota.mp4`) disimpan di `nyata/` dan tidak dimasukkan ke repo.
   Adegan 13: gambar beliau mengakses aplikasi, suara dari video pernyataan dengan takarir ucapan (`UCAPAN` di `susun.py`);
   musik diredam selama beliau berbicara.
5. `python3 vertikal.py` — potongan 9:16, 60 detik. `node sampul.mjs` — sampul berlogo Pemprov Kaltara.

Aset (logo, huruf, tangkapan) diambil dari `../paparan/aset/` dan `public/fonts/`; salin ke `aset/` sebelum menjalankan.
