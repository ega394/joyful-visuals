# 🏛️ Prokopim Hibot (TarakanHibot)

**Sistem Terpadu Jadwal, Agenda Kegiatan Pimpinan, dan Manajemen Tamu** *Aplikasi web progresif (PWA) cerdas untuk digitalisasi alur kerja Bagian Protokol dan Komunikasi Pimpinan (Prokopim) Setda Kota Tarakan.*

---

## 📖 Deskripsi Proyek
Prokopim Hibot adalah platform manajemen birokrasi berbasis *cloud* yang dirancang khusus untuk mengotomatisasi seluruh alur keprotokolan dan jadwal pimpinan daerah (Wali Kota dan Wakil Wali Kota Tarakan). Sistem ini memangkas proses manual melalui *workflow* persetujuan berjenjang, manajemen tamu cerdas, pengarsipan dokumen otomatis, hingga sistem notifikasi *real-time*, memastikan setiap agenda tersusun dengan presisi dan aman.

## ✨ Fitur Unggulan
* **Alur Persetujuan Berlapis (Multi-Role Workflow):** Sistem *routing* dokumen cerdas mulai dari Staf (Input) ➔ Kasubbag (Verifikasi) ➔ Kabag (Telaah & Persetujuan) ➔ Pimpinan & Ajudan (Tayang).
* **Manajemen Tamu Terintegrasi (Guest to Agenda Bridge):** Modul penerimaan tamu dengan sistem kurasi prioritas (VVIP/Reguler). Tamu yang disetujui pimpinan secara otomatis dibuatkan jadwal di tabel Agenda utama tanpa perlu input ulang.
* **Integrasi Google Drive Workspace:** Pengarsipan otomatis yang mengamankan *storage* server dengan mengirim langsung file lampiran (Undangan PDF & Teks Sambutan) ke Google Drive Prokopim secara terorganisir.
* **Notifikasi & Keamanan (OTP) via WhatsApp:** Terhubung dengan *Gateway* WhatsApp untuk memberikan notifikasi jadwal harian otomatis (*Cron Jobs*) dan pemulihan *password* (*One-Time Password*) bagi pengguna secara *real-time*.
* **Otomasi Ekstraksi Teks (AI OCR):** Kemampuan membaca surat undangan (PDF/Gambar) dan secara otomatis mengisi draf form jadwal (Tanggal, Jam, Tempat, Acara).
* **Laporan Eksekutif Cerdas:** Pembuatan rekapitulasi PDF (Kertas F4/A4) sekali klik untuk Agenda Kegiatan dan Histori Tamu, lengkap dengan Kop Surat resmi dan Tanda Tangan digital Kabag.

## 🔐 Manajemen Hak Akses (Role-Based Access)
Sistem ini memisahkan tampilan dan wewenang operasional berdasarkan *role* pengguna:
1. **Admin RK / Staf:** Memasukkan draf jadwal, memonitor progres, dan mengelola personil acara.
2. **Kasubbag Protokol / Komdokpim:** Melakukan verifikasi dokumen lapis pertama dan koordinasi dokumentasi.
3. **Kabag Prokopim:** Melakukan telaah eksekutif, memberikan catatan, disposisi, dan persetujuan final.
4. **Ajudan (WK/WWK):** Memantau jadwal H-0 & H-1 dan mengakses jalur *bypass* input tamu dadakan.
5. **Pimpinan (Wali Kota / Wakil):** Akses *Zen Mode* eksklusif untuk menyetujui, menolak, atau mendisposisi permohonan audiensi tamu.

## 🛠️ Tech Stack
* **Frontend:** React.js (Vite), PWA (Vite PWA Plugin)
* **Styling:** CSS-in-JS / Custom UI Components
* **Backend & Database:** Supabase (PostgreSQL, REST API)
* **Cloud Storage:** Google Drive API (Google Cloud Console)
* **Messaging:** WhatsApp API Gateway (Fonnte/Watzap)
* **Deployment & Otomasi:** Vercel (Hosting & Cron Jobs)

## ⚙️ Variabel Lingkungan (Environment Variables)
Untuk menjalankan aplikasi ini secara lokal atau *deploy* ke server, pastikan Anda mengatur file `.env` berikut:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_CRON_SECRET=your_secret_key_for_cron_jobs
FONNTE_TOKEN=your_whatsapp_gateway_token
GDRIVE_CLIENT_EMAIL=your_google_service_account_email
GDRIVE_PRIVATE_KEY="your_google_service_account_private_key"
GDRIVE_FOLDER_ID=your_target_folder_id
