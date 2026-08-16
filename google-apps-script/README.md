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

---

## Cara pakai

**Membuat acara** — di aplikasi: **LAPORAN & TOOLS → ✍️ Daftar Hadir Digital**.
Tersedia untuk Kabag, kedua Kasubbag, staf Protokol, dan Admin RK.

Isi judul acara, lalu pilih isian yang ditampilkan (Jabatan, Instansi, Nomor
Ponsel, Foto Selfie) — bisa ditambah hingga 3 isian bebas. Tekan **Buat &
Dapatkan Tautan**, lalu bagikan tautannya ke tamu.

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

---

## Batas yang perlu diketahui

- Kuota Drive akun gratis **15 GB**, dipakai bersama Gmail. Foto terkompres
  ±150 KB, jadi ±100.000 foto — sangat lapang.
- Apps Script punya batas waktu eksekusi 6 menit per permintaan; pengisian satu
  orang hanya butuh hitungan detik.
- Pemeriksaan ganda membaca seluruh tab `Hadir`. Bila daftar sudah mencapai
  puluhan ribu baris, pengisian akan terasa melambat — arsipkan ke Spreadsheet
  lain bila sudah sebesar itu.
