# Video Lomba Inovasi Daerah Kota Tarakan 2026 — Prokopim Hibot

Cerita: mengikuti perjalanan satu undangan, dulu (satu lembar disposisi tidak sampai, tanpa ada yang tahu) dan
sekarang (tercatat dari ujung ke ujung). Urutannya memenuhi Petunjuk Teknis Bab 4.4: latar belakang,
masalah, solusi, implementasi, dan dampak, dengan thumbnail dan identitas Pemerintah Kota Tarakan.
Angka sama dengan proposal Tarakan (data per 5 Oktober 2026 pukul 15.47 WITA).

Semua langkah memakai folder kerja `KERJA` di luar repo. Rekaman nyata (wajah Pimpinan, foto lembar
disposisi asli) dan video keluaran tidak masuk repo publik.

1. `naskah.py` — naskah per adegan: teks takarir, teks ucapan (angka dieja), jeda, dan laju.
2. `suara.py` — narasi otomatis dengan suara neural bahasa Indonesia (Piper `id_ID-news_tts-medium`,
   dijalankan lewat `sherpa-onnx`). Tiap kalimat dibuat beberapa kali dan dipilih yang paling jelas menurut
   Whisper (`ASR=<folder model>`). Menulis `narasi/<adegan>.wav` dan `narasi/waktu.json`.
3. `siapkan.py` — linimasa dari narasi, aset (logo, huruf, tangkapan layar data contoh), ikon Lucide,
   peta Indonesia (`@svg-maps/indonesia`), dan bingkai JPG dari rekaman layar aplikasi dan rekaman nyata.
4. `render.mjs penuh 4` — merender `grafis.html` per bingkai (25 fps) dengan empat pekerja. Grafis
   mengikuti waktu tiap kalimat narasi. `render.mjs pratinjau <detik ...>` untuk memeriksa bingkai tertentu.
5. `bunyi.py` — musik latar dan efek suara sintetis (bebas hak cipta), mengikuti alur cerita.
6. `susun.py` — narasi, suara asli Wali Kota, musik (diredam otomatis saat ada ucapan), efek, takarir ASS
   dengan angka berwarna emas, lalu MP4 akhir (dengan dan tanpa takarir) dan SRT.
7. `vertikal.py` — potongan 9:16 ±86 detik untuk Reels, TikTok, dan Shorts.
8. `potret.mjs sampul.html …` — sampul 16:9 dan 9:16.

Contoh:

```
export KERJA=/path/kerja REK=/path/rek NYATA=/path/nyata ASET=/path/aset NPM=/path/node_modules
MODEL=/path/vits-piper-id_ID-news_tts-medium ASR=/path/sherpa-onnx-whisper-turbo LAJU=0.9 python3 suara.py
python3 siapkan.py && node render.mjs penuh 4 && python3 bunyi.py && python3 susun.py && python3 vertikal.py
```

## Versi RISDA (isian Indeks Inovasi Daerah, indikator Kualitas Inovasi)

`VERSI=risda` membuat video paling lama 5 menit (±4:43) dari narasi yang sama: hanya adegan
yang menjawab 5 substansi RISDA (latar belakang, penjaringan ide, pemilihan ide, manfaat, dampak),
label bagian mengikuti substansi itu, dan logo Kemendagri (`ASET/kemendagri.png`) tampil di sudut
layar dan penutup. Sampulnya `sampul-risda.html`.

```
export KERJA=/path/kerja-risda VERSI=risda   # salin narasi/ dari folder kerja Tarakan
python3 siapkan.py --tanpa-bingkai && node render.mjs penuh 4 && python3 bunyi.py
NAMA=Video-RISDA-Prokopim-Hibot python3 susun.py
node potret.mjs $KERJA/sampul-risda.html $KERJA/keluaran/Sampul-Video-RISDA-Prokopim-Hibot.jpg 1920 1080 datar
```
