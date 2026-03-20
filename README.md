# Prokopim Kota Tarakan

Sistem Informasi Jadwal dan Agenda Kegiatan Pimpinan Kota Tarakan.
Dikelola oleh Bagian Protokol dan Komunikasi Pimpinan, Setda Kota Tarakan.

## Tentang Aplikasi

Aplikasi web PWA (Progressive Web App) untuk mengelola jadwal dan agenda kegiatan pimpinan Kota Tarakan. Dapat diinstall di perangkat mobile seperti aplikasi native.

### Fitur Utama

- Manajemen jadwal dan agenda kegiatan pimpinan
- Push notification untuk pengingat agenda
- Autentikasi OTP via WhatsApp
- Fitur AI untuk penyusunan sambutan
- Progressive Web App (installable di HP)

### Teknologi

- **Frontend:** React 18, TypeScript, Vite
- **UI:** shadcn/ui, Tailwind CSS, Radix UI
- **Backend:** Vercel Serverless Functions (Node.js)
- **Database:** Supabase
- **PWA:** vite-plugin-pwa (Workbox)
- **Push:** web-push (VAPID protocol)

## Persyaratan

- Node.js >= 18.x (disarankan 20.x atau terbaru)
- npm >= 9.x
- Akun Vercel (untuk deployment)
- Akun Supabase (untuk database)

## Instalasi Lokal

### 1. Clone Repository

```bash
git clone https://github.com/ega394/joyful-visuals.git
cd joyful-visuals
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Konfigurasi Environment Variables

Buat file `.env` di root proyek:

```env
# === SUPABASE ===
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key

# === PUSH NOTIFICATION (VAPID) ===
# Generate VAPID keys: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=BHyn6m5zFHYd...your-public-key
VAPID_PRIVATE_KEY=your-private-key-here
VAPID_SUBJECT=mailto:admin@tarakankota.go.id

# === WHATSAPP API ===
WHATSAPP_API_URL=https://your-wa-api-endpoint
WHATSAPP_API_TOKEN=your-token

# === AI / SAMBUTAN ===
AI_API_KEY=your-ai-api-key

# === KEAMANAN ===
API_SECRET=your-secret-for-cron-jobs
```

> **Penting:** JANGAN commit file `.env` ke repository. Pastikan `.env` sudah tercantum di `.gitignore`.

### 4. Generate VAPID Keys (Jika Belum Ada)

```bash
npx web-push generate-vapid-keys
```

Salin output `Public Key` ke `VAPID_PUBLIC_KEY` dan `Private Key` ke `VAPID_PRIVATE_KEY` di file `.env`.

### 5. Jalankan Development Server

```bash
npm run dev
```

Buka http://localhost:8080 di browser.

## Struktur Proyek

```
joyful-visuals/
├── api/                    # Vercel Serverless Functions
│   ├── webpush.js          # Push notification (subscribe/send)
│   ├── notif-cron.js       # Cron job notifikasi terjadwal
│   ├── notif-penugasan.js  # Notifikasi penugasan
│   ├── otp.js              # Verifikasi OTP
│   ├── sendOTP.js          # Kirim OTP via WhatsApp
│   ├── whatsapp.js         # Integrasi WhatsApp API
│   ├── sambutan.js         # Generator sambutan AI
│   ├── aibackup.js         # Backup AI endpoint
│   └── _middleware.js      # Middleware API
├── public/                 # File statis (icons, manifest)
├── src/                    # Kode sumber frontend React
│   ├── components/         # Komponen UI
│   ├── pages/              # Halaman-halaman
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilitas dan konfigurasi
│   └── main.tsx            # Entry point
├── index.html              # HTML template
├── vite.config.ts          # Konfigurasi Vite + PWA
├── tailwind.config.ts      # Konfigurasi Tailwind CSS
├── package.json            # Dependencies dan scripts
└── vercel.json             # Konfigurasi deployment Vercel
```

## Deployment ke Vercel

### 1. Hubungkan Repository

- Buka https://vercel.com dan login
- Import repo `ega394/joyful-visuals`
- Framework otomatis terdeteksi sebagai Vite

### 2. Set Environment Variables

Di Vercel Dashboard → Project Settings → Environment Variables, tambahkan semua variabel dari file `.env` di atas.

### 3. Konfigurasi Domain

Di Vercel Dashboard → Project Settings → Domains, tambahkan domain `prokopim.tarakankota.go.id`.

**DNS Setup (Cloudflare):**

|Tipe |Name    |Target              |Proxy   |
|-----|--------|--------------------|--------|
|CNAME|prokopim|cname.vercel-dns.com|DNS Only|

### 4. Deploy

Setiap push ke branch `main` akan otomatis trigger deployment.

## Perintah yang Tersedia

|Perintah            |Fungsi                         |
|--------------------|-------------------------------|
|`npm run dev`       |Jalankan development server    |
|`npm run build`     |Build untuk production         |
|`npm run preview`   |Preview hasil build lokal      |
|`npm run lint`      |Cek kode dengan ESLint         |
|`npm test`          |Jalankan unit tests            |
|`npm run test:watch`|Jalankan tests dalam mode watch|

## Prosedur Update (SOP)

1. Buat perubahan di branch `dev` (bukan langsung di `main`)
1. Push ke `dev` — Vercel akan buat Preview URL otomatis
1. Test di Preview URL
1. Jika oke, buat Pull Request dari `dev` ke `main`
1. Merge PR — deployment production otomatis berjalan
1. Catat perubahan di `CHANGELOG.md`

**Waktu update aman:** sebelum 07.00, 12.00–13.00, atau setelah 17.00 WITA.

## Kontributor

- **Pengelola:** Bagian Protokol dan Komunikasi Pimpinan, Setda Kota Tarakan

## Lisensi

Proyek internal Pemerintah Kota Tarakan.
Hak cipta © 2026 Bagian Prokopim Setda Kota Tarakan.