# Daftar Centang Lampiran Lomba — Kaltara Innovation Awards 2026

**Tenggat pendaftaran: 30 September 2026** · Diperbarui 24 September 2026 — **sisa 6 hari**

Naskah proposal kini: `Proposal-Prokopim-Hibot.docx` (dapat disunting) dan
`.pdf` (untuk diunggah), dibuat oleh `build/buat-proposal.mjs`. Naskah lama
`proposal-inovasi.md` hanya bahan rujukan dan tidak lagi dipakai.

Penomoran lampiran di bawah mengikuti **Daftar Lampiran pada proposal baru**
(urutan pedoman Bab 4.2), bukan penomoran naskah lama.

---

## A. SUDAH SELESAI

| | Butir | Keterangan |
|---|---|---|
| ✅ | **Naskah proposal 12 bagian** | 16 halaman isi (batas 20); A4, Arial 11, spasi 1,15 |
| ✅ | **Angka statistik diperbarui** | Per 24 September 2026 pukul 15.25 WITA, dari `STATISTIK-proposal.sql` |
| ✅ | **Judul inovasi** | "Prokopim Hibot: Satu Alur Digital Terverifikasi untuk Tata Kelola Agenda dan Keprotokolan Pimpinan Daerah" |
| ✅ | **Nama inovator/tim pada sampul** | Tim Inovasi Prokopim Hibot, Ketua Anugrah Yega Pranatha, M.Si. |
| ✅ | **Visi-misi Kaltara & Tarakan** | Misi 3 & 8 RPJMD Kaltara; visi Kota Cerdas, Misi 4, dan semboyan HIBOT Kota Tarakan |
| ✅ | **Fitur terbaru masuk naskah** | Daftar periksa wajib, Pelaksana Harian, penanda kegentingan usulan |
| ✅ | **Isian diseminasi** | Bagian 11.4 (yang telah dilakukan, berbasis data) dan 11.5 (rencana) |
| ✅ | **Lampiran 7 — Sebelas SOP** | `docs/sop/SOP-Prokopim.pdf` |
| ✅ | **Lampiran 8 — Keluaran statistik** | Sudah tercetak di dalam PDF proposal |

---

## B. BELUM — ISIAN BERSOROT KUNING DI DALAM NASKAH

| | Isian | Letak |
|---|---|---|
| ⬜ | **Nomor Surat Sekda `300.2.10/XXX/SETDA/2026`** | Muncul di beberapa tempat — cari "XXX" |
| ⬜ | Telepon dan surel ketua tim | Bagian 3 |
| ⬜ | Tiga kutipan testimoni | Tabel 17 (Bagian 9.8) |
| ⬜ | Tautan video demonstrasi | Daftar lampiran, nomor 5 |
| ⬜ | Alamat halaman publik aplikasi | Daftar lampiran, nomor 10 |

---

## C. BELUM — LAMPIRAN YANG PERLU TANDA TANGAN ATAU PINDAIAN

| | Lampiran | Catatan |
|---|---|---|
| ⬜ | **1 — Pakta integritas** | Ditandatangani ketua tim |
| ⬜ | **2 — Surat usulan perangkat daerah** | Bagian Prokopim Setda Kota Tarakan |
| ⬜ | **3 — Bukti identitas anggota tim** | 5 orang |
| ⬜ | **4 — Tangkapan layar setiap alur** | Tutupi nomor telepon; jangan tangkap daftar pengguna |
| ⬜ | **6 — Pindaian SK Sekda dan Surat Sekda** | Belum ada berkasnya di repositori |
| ⬜ | **9 — Testimoni bertanda tangan** | Wali Kota, Ajudan Wakil Wali Kota, Staf Protokol |

---

## D. PERLU DIKONFIRMASI

| | Hal | Kenapa |
|---|---|---|
| ❓ | **Pernyataan bantuan kecerdasan buatan** | Bagian 8.1 menyebut pengembangan swakelola dengan asisten pemrograman berbasis kecerdasan buatan. Ditulis terbuka karena riwayat kode mencatatnya dan Tahap II mencakup pemeriksaan sistem |
| ❓ | **Rencana pengembangan dan diseminasi** | Tabel 19 dan 22 memuat komitmen berjadwal (subdomain resmi, pengalihan akun layanan ke akun instansi, alih pengetahuan, paparan ke daerah lain). Pastikan sanggup dijalankan |
| ❓ | **Kata-kata misi Kota Tarakan** | Diambil dari portal resmi Pemkot lewat mesin pencari; halamannya tidak dapat dibuka langsung dari sesi ini. Cocokkan dengan dokumen RPJMD |
| ❓ | **Diseminasi tambahan** | Bila pernah ada paparan, sosialisasi, atau kunjungan studi tentang aplikasi ini, tambahkan ke Bagian 11.4 — kriteria ini berbobot 10% |
| ❓ | **Status pendaftaran** | Sudah membuat akun di sirindaku.kaltaraprov.go.id? |

---

## E. TENGGAT OKTOBER (bila lolos 7 besar)

| | Butir | Tenggat |
|---|---|---|
| ⬜ | Video paling lama 5 menit + thumbnail berlogo Pemprov Kaltara | 15–20 Oktober 2026 |
| ⬜ | Bahan paparan 10 menit + demonstrasi langsung | 21–22 Oktober 2026 |

---

## Memperbarui angka

1. Jalankan `STATISTIK-proposal.sql` di Supabase → SQL Editor (hanya membaca).
2. Ganti isi `data-statistik.json` dengan hasilnya.
3. `cd docs/lomba/build && npm install && npm run buat` — seluruh angka,
   persentase, dan daftar isi dihitung ulang.
