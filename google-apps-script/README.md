# Daftar Hadir Digital — Panduan Pemasangan

Halaman `/daftarhadir` memakai **Google Sheets + Google Drive** lewat Google
Apps Script, **bukan Supabase**.

## Kenapa bukan Supabase

**Egress.** Selfie itu gambar. Pemakaian egress Supabase baru saja ditekan dari
6,4 GB (melampaui kuota gratis 5 GB) ke sekitar 1 GB. Satu daftar hadir 100
orang dengan foto ±150 KB sudah 15 MB sekali isi — dan setiap kali rekapnya
dibuka, foto-foto itu terunduh lagi. Beberapa acara saja cukup untuk
mengembalikan masalah kuota.

## Kenapa tanpa endpoint di Vercel

Serverless Vercel proyek ini **sudah penuh: 12 dari 12** pada paket Hobby.
Karena itu halaman `/daftarhadir` memanggil Apps Script **langsung dari browser
tamu**, tanpa perantara.

---

## Langkah pemasangan (sekali saja, ±10 menit)

Semua langkah ini **harus dikerjakan sendiri** — perlu akses ke akun Google.

1. Login ke **akun Google khusus absen**.
2. Buat **Spreadsheet** baru, beri nama mis. *Daftar Hadir Prokopim*.
3. Menu **Extensions → Apps Script**. Hapus isi `Code.gs`, tempel seluruh isi
   [`daftar-hadir.gs`](./daftar-hadir.gs).
4. Ganti nilai `TOKEN` di baris atas dengan **kata sandi acak buatan sendiri**.
5. Simpan, lalu jalankan fungsi **`setup`** sekali:
   pilih `setup` pada daftar fungsi → **Run** → izinkan aksesnya saat diminta.
   Ini membuat tab `Acara`, `Hadir`, dan folder Drive untuk foto.
6. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** ← wajib; tamu tidak punya akun Google
   - **Deploy**, lalu salin **Web app URL**.
7. Di **Vercel → Settings → Environment Variables**, tambahkan lalu **redeploy**:

   | Nama | Isi |
   | :--- | :--- |
   | `VITE_ABSEN_URL` | Web app URL dari langkah 6 |
   | `VITE_ABSEN_TOKEN` | `TOKEN` dari langkah 4 |

> **Saat mengubah skrip di kemudian hari:** deploy ulang lewat
> **Deploy → Manage deployments → (pensil) → Version: New version → Deploy**.
> Kalau hanya menekan *Save*, perubahannya **tidak** aktif di URL yang sama.

### Memperbarui pemasangan yang sudah berjalan

Isian **Tanda Tangan** dan **Titik Lokasi** menambah tiga kolom pada tab
`Hadir`: `ttd`, `lokasi`, dan `akurasi_m`. Tab yang
sudah ada tidak mendapat kolom baru dengan sendirinya, karena baris judul hanya
ditulis saat tab-nya pertama kali dibuat. Setelah menempelkan skrip versi baru:

1. Jalankan fungsi **`setup`** sekali lagi — aman diulang, dan kolom yang belum
   ada ditambahkan.
2. Baru **Deploy → New version**.

Kalau langkah 1 terlewat, skrip tetap menambahkannya sendiri pada penyimpanan
pertama yang memuat tanda tangan atau lokasi; menjalankan `setup` hanya
membuatnya pasti lebih dulu.

---

## Cara pakai

**Membuat acara** — di aplikasi: **LAPORAN & TOOLS → ✍️ Daftar Hadir Digital**.
Tersedia untuk Kabag, kedua Kasubbag, staf Protokol, dan Admin RK.

Isi judul acara, lalu pilih isian yang ditampilkan (Jabatan, Instansi, Nomor
Ponsel, Foto Selfie, Tanda Tangan, Titik Lokasi) — bisa ditambah hingga 3 isian
bebas. Tekan
**Buat & Dapatkan Tautan**, lalu bagikan tautannya ke tamu.

**Titik Lokasi tidak tercentang secara bawaan**, dan memang sebaiknya begitu
untuk acara di dalam gedung: GPS di sana jatuh ke triangulasi Wi-Fi/seluler
dengan galat 50–2.000 meter, yang jarang menjawab pertanyaan “apakah beliau ada
di ruangan itu”. Bermanfaat untuk kegiatan lapangan. Koordinat **tidak pernah
menghalangi pengisian**: izin yang ditolak, gagal, atau kehabisan waktu tetap
membiarkan tamu mengirim, dan kolomnya dibiarkan kosong.

**Foto Selfie dan Tanda Tangan berdampingan, bukan saling menggantikan.**
Keduanya boleh dicentang sekaligus, atau salah satu saja. Tanda tangan digores
langsung di layar dengan jari — tidak butuh kamera, bekerja di dalam gedung, dan
merupakan padanan langsung daftar hadir kertas. Kekuatan buktinya setara tanda
tangan di kertas: ia tidak membuktikan identitas.

**Melihat rekap** — tombol **📊 Buka Rekap di Spreadsheet**. Dari sana bisa
disortir, difilter, dan diekspor ke Excel.

---

## Catatan keamanan & privasi

**Apps Script tidak pernah mengembalikan data peserta.** Nama, nomor ponsel,
dan foto hanya bisa dibaca dari Spreadsheet-nya langsung. Ini disengaja:
`VITE_ABSEN_TOKEN` ikut terkirim ke browser dan **secara teknis bisa ditemukan
orang** yang memeriksa berkas aplikasi. Dengan rancangan ini, kalau token
sampai bocor, yang bisa dilakukan hanyalah **membuat acara sampah** — bukan
mengambil data pribadi tamu. Kalau token bocor, ganti nilainya di skrip dan di
Vercel, lalu deploy ulang keduanya.

**Foto selfie disimpan privat** di Drive akun absen (bawaan Drive: hanya
pemilik yang bisa membuka). Jangan mengubahnya menjadi *anyone with link* —
isinya wajah orang.

**Pengisian ganda** dicegah berdasarkan nomor ponsel, tetapi hanya bila isian
Nomor Ponsel diaktifkan pada acara tersebut. Nomor disamakan bentuknya lebih
dulu (`0812…`, `+62812…`, `62812…` dianggap sama), jika tidak pencegahannya
mudah ditembus hanya dengan mengubah format penulisan.

Tamu yang terjaring tidak melihat pesan galat, melainkan layar terima kasih
dengan keterangan **“Kehadiran Anda telah tercatat pada acara ini.”** — sebab
dari sudut pandangnya memang tidak ada yang gagal. Ditambah satu baris bahwa
ia sudah mengisi sebelumnya, supaya tamu yang tadi salah mengetik namanya tidak
mengira perbaikannya tersimpan. Barisnya tetap tidak ditulis ulang.

> Acara yang **tidak** mengaktifkan Nomor Ponsel tidak punya pencegahan ganda
> sama sekali — termasuk acara yang hanya memakai Tanda Tangan.

---

## Batas yang perlu diketahui

- Kuota Drive akun gratis **15 GB**, dipakai bersama Gmail. Foto terkompres
  ±150 KB, jadi ±100.000 foto — sangat lapang.
- Apps Script punya batas waktu eksekusi 6 menit per permintaan; pengisian satu
  orang hanya butuh hitungan detik.
- Pemeriksaan ganda membaca seluruh tab `Hadir`. Bila daftar sudah mencapai
  puluhan ribu baris, pengisian akan terasa melambat — arsipkan ke Spreadsheet
  lain bila sudah sebesar itu.
- **Tanda tangan tidak disimpan di Drive**, melainkan langsung di sel kolom
  `ttd` sebagai gambar base64. Berkasnya kecil — terukur 11.600–23.600 karakter
  — sedangkan batas satu sel Sheets 50.000, jadi lapang. Peramban memangkasnya
  sampai batas goresan dan menyusutkannya hanya bila melewati 35.000.
- **Goresan harus cukup panjang** sebelum diterima sebagai tanda tangan:
  minimal **100 px** panjang lintasan dan **60 px** diagonal kotak pembatas,
  diukur dalam piksel CSS. Satu ketukan bernilai 0 px, paraf pendek 144 px.
  Satuannya sengaja bukan jumlah karakter berkas — itu bergantung kerapatan
  layar, sehingga satu ambang akan ketat di satu ponsel dan longgar di ponsel
  lain. Peladen ikut menolak gambar di bawah 100×25 piksel sebagai jaring
  terakhir, tetapi pagar sesungguhnya ada di peramban.
- Tidak ada uji otomatis yang dapat memastikan goresan itu **tanda tangan orang
  tersebut**. Ambang di atas menaikkan lantai dari “asal tekan” menjadi “sengaja
  menggores” — tidak lebih, sama seperti daftar hadir kertas.
- Pada cetakan laporan, tanda tangan disertakan sampai **250 peserta**. Di atas
  itu laporan tetap terbit lengkap, hanya tanpa kolom tanda tangan, dan
  aplikasi memberi tahu dengan jelas. Batasnya jauh lebih longgar daripada foto
  (80) karena tanda tangan tidak perlu diambil satu per satu dari Drive; yang
  membatasi hanyalah besar berkas yang harus diunduh peramban.
