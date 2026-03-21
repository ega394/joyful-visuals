# 🏛️ Prokopim — Sistem Agenda Pimpinan Kota Tarakan

**Sistem Informasi Terpadu Jadwal dan Agenda Kegiatan Pimpinan**
Bagian Protokol dan Komunikasi Pimpinan — Setda Kota Tarakan

[![Vercel](https://img.shields.io/badge/deployed-Vercel-black?logo=vercel)](https://prokopim.tarakankota.go.id)
[![PWA](https://img.shields.io/badge/PWA-ready-blue?logo=googlechrome)](https://prokopim.tarakankota.go.id)
[![Supabase](https://img.shields.io/badge/database-Supabase-green?logo=supabase)](https://supabase.com)

---

## 📋 Deskripsi

Prokopim adalah aplikasi web progressif (PWA) yang dirancang untuk membantu tim Bagian Protokol dan Komunikasi Pimpinan Setda Kota Tarakan dalam mengelola, menyetujui, dan memantau jadwal kegiatan Wali Kota dan Wakil Wali Kota Tarakan.

### Fitur Utama

- **Multi-role dashboard** — tampilan berbeda & personal untuk setiap jabatan
- **Workflow approval bertingkat** — Draft → Kasubbag → Kabag → Tayang
- **Push notification** — pengingat otomatis via browser (PWA)
- **Notifikasi keberangkatan** — hitung jarak via Google Maps, kirim notif saat waktunya berangkat
- **Upload naskah sambutan** — DOCX → PDF otomatis via server
- **Analisa undangan AI** — ekstrak data jadwal dari foto/PDF undangan
- **WhatsApp broadcast** — rekap agenda harian ke seluruh tim via Fonnte
- **Mode offline** — data tersedia meskipun tanpa koneksi (cache PWA)

---

## 👥 Role Pengguna

| Role | Akses |
|---|---|
| `walikota` | Zen Mode — lihat & konfirmasi kehadiran |
| `wakilwalikota` | Zen Mode — lihat, konfirmasi, terima disposisi |
| `ajudan_walikota` / `ajudan_wakilwalikota` | Action Mode — konfirmasi kehadiran pimpinan, buka Maps |
| `kabag` | Approval final, dashboard rekap, broadcast |
| `kasubbag_protokol` | Approval awal, penugasan personil protokol |
| `kasubbag_komdokpim` | Approval awal, upload naskah sambutan |
| `staf` / `admin_rk` | Input jadwal, lihat penugasan |
| `timkom` | Upload naskah sambutan, lihat penugasan |
| `mitra_kerja` | Lihat agenda publik (read-only) |

---

## 🛠️ Teknologi

| Layer | Stack |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5 |
| UI | shadcn/ui + Tailwind CSS |
| Backend | Vercel Serverless Functions (Node.js) |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage (sambutan, undangan) |
| PWA | vite-plugin-pwa + Workbox |
| Push Notification | Web Push API + VAPID |
| Jarak/Maps | Google Distance Matrix API |
| WhatsApp | Fonnte API |
| AI | Claude API (Anthropic) via `/api/ai` |

---

## ⚙️ Requirements

- Node.js 18+ (disarankan 24.x)
- npm 9+
- Akun Vercel (deploy)
- Akun Supabase (database & storage)
- Google Cloud Console (Distance Matrix API)
- Akun Fonnte (WhatsApp gateway)
- Anthropic API key (fitur AI undangan)

---

## 🚀 Cara Install & Menjalankan Lokal

```bash
# 1. Clone repository
git clone https://github.com/ega394/joyful-visuals.git
cd joyful-visuals

# 2. Install dependencies
npm install

# 3. Salin file environment
cp .env.example .env.local

# 4. Isi .env.local (lihat bagian Setup .env di bawah)

# 5. Jalankan development server
npm run dev
# App berjalan di http://localhost:8080
```

---

## 🔑 Setup Environment Variables

### Untuk development lokal — buat file `.env.local`:

```env
# ── SUPABASE ─────────────────────────────────────────
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# Untuk serverless functions (tanpa VITE_ prefix)
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGci...

# ── VAPID (Push Notification) ─────────────────────────
# Generate sekali dengan: npx web-push generate-vapid-keys
VAPID_PUBLIC=Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_EMAIL=mailto:prokopim@tarakankota.go.id

# ── GOOGLE MAPS ───────────────────────────────────────
# Aktifkan Distance Matrix API di console.cloud.google.com
GOOGLE_MAPS_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEFAULT_ORIGIN=-3.3265,117.5789

# ── WHATSAPP (FONNTE) ─────────────────────────────────
FONNTE_TOKEN=xxxxxxxxxxxxxxxxxxxx

# ── AI (ANTHROPIC) ────────────────────────────────────
VITE_GEMINI_API_KEY=sk-ant-xxxxxxx   # nama lama, isinya Anthropic key

# ── KEAMANAN ──────────────────────────────────────────
API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CRON_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ALLOWED_ORIGIN=http://localhost:8080
```

### Untuk production — set di Vercel Dashboard:

`Vercel Dashboard → Project → Settings → Environment Variables`

Tambahkan semua variable di atas dengan `ALLOWED_ORIGIN=https://prokopim.tarakankota.go.id`

---

## 🗄️ Setup Database Supabase

### 1. Buat tabel yang diperlukan

Jalankan di **Supabase Dashboard → SQL Editor**:

```sql
-- Tabel jadwal utama
CREATE TABLE jadwal (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel users
CREATE TABLE users (
  username TEXT PRIMARY KEY,
  nama TEXT,
  jabatan TEXT,
  role TEXT,
  password TEXT,
  noWA TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel push subscriptions
CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  subscription JSONB,
  username TEXT,
  role TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel pending registrations
CREATE TABLE pending_regs (
  id BIGINT PRIMARY KEY,
  data JSONB
);

-- Tabel log notifikasi keberangkatan
CREATE TABLE departure_notif_log (
  id BIGSERIAL PRIMARY KEY,
  agenda_id TEXT UNIQUE,
  agenda_name TEXT,
  notified_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Buat Supabase Storage buckets

Di **Supabase Dashboard → Storage → New Bucket**:
- `sambutan` — untuk naskah sambutan (PDF/DOCX)
- `undangan` — untuk berkas undangan

Set policy: **Public read**, authenticated write.

### 3. Jalankan migration koordinat (Tugas 2)

```sql
-- File: supabase/migrations/001_add_location_coords.sql
-- Jalankan setelah tabel jadwal dibuat
```

---

## 📦 Deploy ke Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy production
vercel --prod
```

Atau cukup push ke branch `main` — Vercel auto-deploy via GitHub integration.

---

## 🕐 Jadwal Cron Jobs

Diatur di `vercel.json` (waktu UTC, zona WITA = UTC+8):

| Jadwal | Waktu WITA | Fungsi |
|---|---|---|
| `30 23 * * *` | 07:30 | Rekap agenda pagi ke semua tim |
| `55 7 * * *` | 15:55 | Pengingat penugasan belum diisi |
| `0 8 * * *` | 16:00 | Notif besok ke Ajudan |
| `10 8 * * *` | 16:10 | Notif penugasan ke Personil |
| `*/5 23-14 * * 1-5` | Setiap 5 menit (kerja) | Notif keberangkatan *(butuh Vercel Pro)* |

> Cron `*/5` membutuhkan **Vercel Pro plan**. Untuk Free plan, hapus baris `notif-departure` dari `vercel.json`.

---

## 🔐 Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

Salin output ke environment variables `VAPID_PUBLIC` dan `VAPID_PRIVATE`.

---

## 📁 Struktur Proyek

```
joyful-visuals/
├── api/                        # Vercel Serverless Functions
│   ├── _middleware.js          # Auth + rate limiting shared
│   ├── ai.js                   # Proxy ke Claude API
│   ├── distance.js             # Google Maps Distance Matrix
│   ├── notif-cron.js           # Cron dispatcher (WA)
│   ├── notif-departure.js      # Notif keberangkatan
│   ├── notif-penugasan.js      # Notif penugasan personil
│   ├── otp.js                  # OTP via WA
│   ├── sambutan.js             # Konversi DOCX→PDF
│   ├── sendOTP.js              # Kirim OTP
│   ├── webpush.js              # Push notification
│   └── whatsapp.js             # WhatsApp via Fonnte
├── public/
│   ├── push-handler.js         # SW push + click-to-redirect
│   └── [icons PWA]
├── src/
│   ├── JoyfulInterface.jsx     # Role-based UI components
│   ├── ProkopimApp.jsx         # Komponen utama (7000+ baris)
│   ├── native-feel.css         # PWA native UX styles
│   ├── main.tsx                # Entry point
│   └── App.tsx
├── supabase/
│   └── migrations/
│       └── 001_add_location_coords.sql
├── index.html                  # Viewport + PWA meta
├── vite.config.ts              # Vite + PWA config
├── vercel.json                 # Routing + cron jobs
└── .env.example                # Template environment variables
```

---

## 🧪 Testing

```bash
# Unit test
npm run test

# Watch mode
npm run test:watch

# E2E (Playwright)
npx playwright test
```

---

## 📞 Kontak & Support

**Bagian Protokol dan Komunikasi Pimpinan**
Sekretariat Daerah Kota Tarakan
Email: prokopim@tarakankota.go.id
Website: prokopim.tarakankota.go.id

---

*Dibangun dengan ❤️ untuk Prokopim Kota Tarakan — #TarakanHibot*
