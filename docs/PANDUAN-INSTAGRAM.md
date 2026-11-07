# Panduan Menyambungkan Instagram @humas_tarakan

Untuk **IKU 3 — persentase layanan komunikasi pimpinan yang diselesaikan tepat
waktu**. Setelah tersambung, aplikasi membaca postingan @humas_tarakan sendiri
dan menganggap berita kegiatan selesai saat postingannya **terbit**, paling
lambat 24 jam sesudah acara.

- **Izin yang diberikan hanya-baca** (`instagram_business_basic`): profil dan
  daftar postingan. Aplikasi tidak dapat mengunggah, menghapus, membalas
  komentar, atau membaca pesan.
- **Cukup sekali.** Token berlaku 60 hari dan diperpanjang otomatis oleh
  aplikasi setiap hari; tidak ada yang perlu login ulang.
- Perkiraan waktu: 20–30 menit, lebih nyaman di komputer.
- Nama menu di situs Meta kadang berubah sedikit; ikuti yang paling mirip.

> **Token adalah kunci.** Jangan kirim lewat WhatsApp, surel, atau ke siapa pun —
> termasuk ke Claude. Tempelkan langsung di Vercel (Langkah 5).

---

## Persiapan

1. **@humas_tarakan harus akun Profesional** (Bisnis atau Kreator).
   Periksa di aplikasi Instagram: Profil → ☰ → *Pengaturan dan aktivitas* →
   *Jenis akun dan alat*. Bila masih akun pribadi, ubah ke *akun profesional*
   (sebaiknya dengan sepengetahuan pengelola Humas).
2. **Akun Facebook pribadi Bapak** untuk masuk ke developers.facebook.com.
   Aplikasi Meta hanya "wadah" token; tidak terhubung ke Halaman Facebook mana pun.
3. **Sebaiknya Humas diberi tahu**: aplikasi "Prokopim Hibot" akan tampil di
   menu *Aplikasi dan situs web* milik @humas_tarakan. Bila dicabut dari sana,
   pembacaan berhenti dan menu Indikator Kinerja langsung memberi peringatan.

## Langkah 1 — Buat aplikasi Meta

1. Buka **developers.facebook.com/apps**, masuk dengan Facebook Bapak.
   (Bila baru pertama kali, Meta meminta mendaftar sebagai pengembang dan
   memverifikasi nomor HP.)
2. Klik **Buat Aplikasi**.
3. Nama aplikasi: **Prokopim Hibot**. Surel kontak: surel dinas Bapak.
4. Pilih kasus penggunaan **"Kelola pesan dan konten di Instagram"**
   (*Manage messaging & content on Instagram*).
5. Bila ditanya portofolio bisnis, pilih *Saya belum ingin menghubungkan
   portofolio bisnis*. Selesaikan sampai aplikasi dibuat.
6. **Biarkan aplikasi dalam mode Pengembangan.** Tidak perlu diubah ke *Live*
   dan tidak perlu peninjauan Meta, karena yang dibaca hanya akun yang
   didaftarkan sendiri.

## Langkah 2 — Batasi izinnya

Di dasbor aplikasi: **Kasus penggunaan** → *Kelola pesan dan konten di
Instagram* → **Sesuaikan** → **Izin**. Cukup **`instagram_business_basic`**.
Hapus izin lain bila tercantum (pesan, komentar, publikasi konten).

## Langkah 3 — Daftarkan @humas_tarakan sebagai penguji

1. Di dasbor aplikasi: **Peran Aplikasi** → **Peran** → **Tambahkan Orang** →
   pilih **Penguji Instagram** → ketik `humas_tarakan` → Tambahkan.
2. Masuk ke **instagram.com** sebagai **@humas_tarakan** (di komputer lebih mudah).
3. Buka **Pengaturan** → **Aplikasi dan situs web** (atau *Izin situs web*) →
   tab **Undangan penguji** → **Terima** undangan dari *Prokopim Hibot*.
   Bila belum muncul, tunggu beberapa menit lalu muat ulang.

> Langkah 3 paling sering terlewat. Tanpa menerima undangan, token tidak akan jadi.
> (Pada sebagian tampilan baru, langkah ini sudah tergabung di Langkah 4.)

## Langkah 4 — Buat token

1. Kembali ke dasbor aplikasi → **Kasus penggunaan** → *Kelola pesan dan
   konten di Instagram* → **Penyiapan API dengan login Instagram**
   (*API setup with Instagram login*).
2. Di bagian **Buat token akses** (*Generate access tokens*), klik
   **Tambahkan akun** → masuk sebagai **@humas_tarakan** → izinkan.
3. Pada baris @humas_tarakan, klik **Buat token** (*Generate token*).
   Salin token yang muncul (teks panjang). Jangan ditutup sebelum Langkah 5 selesai.

## Langkah 5 — Simpan token di Vercel

1. Buka **vercel.com** → proyek **jadwal-pimpinan** (bukan *joyfulprokopim*).
2. **Settings** → **Environment Variables** → **Add New**.
   - Key: `IG_TOKEN`
   - Value: tempelkan token
   - Environment: **Production**
3. **Save**, lalu **Deployments** → deployment teratas → ⋯ → **Redeploy**
   (nilai baru baru terbaca sesudah dipasang ulang).

## Langkah 6 — Buat tabelnya di Supabase

Supabase → **SQL Editor** → tempel isi berkas
`supabase-migrations/2026-10-22_instagram.sql` → **Run**.
Pemeriksaan di bagian bawah berkas harus menghasilkan 2 baris.

## Langkah 7 — Periksa

Buka aplikasi → **Indikator Kinerja**. Pada kartu IKU 3 harus muncul kotak hijau:

> 📸 Terhubung ke **@humas_tarakan** · diperbarui …

Pengambilan pertama membaca postingan sejak **1 Oktober 2026** dan bisa memakan
beberapa detik. Sesudah itu aplikasi memeriksa postingan baru paling sering
sekali per 15 menit saat menu dibuka, ditambah pemeriksaan terjadwal harian.

---

## Bila ada masalah

| Yang tampil | Artinya | Yang dilakukan |
|---|---|---|
| Kuning: *IG_TOKEN belum diisi di Vercel* | Token belum tersimpan atau belum *Redeploy* | Ulangi Langkah 5 |
| Kuning: *Tabel Instagram belum dibuat* | SQL belum dijalankan | Ulangi Langkah 6 |
| Kuning: *Invalid OAuth access token* / *Error validating access token* | Token salah salin, dicabut Humas, atau kata sandi @humas_tarakan diganti | Ulangi Langkah 4, ganti nilai `IG_TOKEN` di Vercel, *Redeploy*. Aplikasi otomatis memakai token baru |
| Hijau, tetapi ada ⚠️ *Perpanjang token…* | Perpanjangan otomatis gagal | Biasanya pulih sendiri esok hari; bila berulang lebih dari seminggu, buat token baru |

## Cara kerja pencocokan (ringkas)

- Untuk setiap acara yang **dihadiri sendiri** oleh WK/WWK, aplikasi mencari
  postingan @humas_tarakan yang terbit sejak 2 jam sebelum acara sampai 7 hari
  sesudahnya.
- **Otomatis** bila teks postingan memuat caption yang disetujui di Newsroom,
  atau memuat nama acara. Kecocokan yang meragukan **tidak dihitung** sampai
  dipilih manual.
- Kabag dan Kasubbag Komdokpim dapat **Pilih postingan** atau menandai
  **Bukan postingan ini** di rincian IKU 3. Setiap pilihan tercatat di riwayat
  agenda (siapa dan kapan).
- Tautan postingan menjadi **bukti dukung** yang dapat dibuka dari rincian.
