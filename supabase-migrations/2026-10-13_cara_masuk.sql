-- 2026-10-13 — Cara masuk tambahan: passkey (sidik jari / Face ID / PIN layar)
-- dan "Masuk dengan Google". Aman dijalankan berulang kali.
--
-- Prinsip: tidak ada pendaftaran akun lewat Google maupun passkey. Keduanya
-- hanya bisa DITAUTKAN oleh pegawai yang sudah masuk dengan sandinya, dari
-- menu Profil. Pemeriksaan dilakukan peladen (/api/room-booking?op=masuk_*);
-- ketiga tabel di bawah tertutup untuk kunci publik (anon).

-- 1. Kunci publik passkey per perangkat. Kunci rahasianya tidak pernah
--    meninggalkan perangkat pegawai.
CREATE TABLE IF NOT EXISTS kredensial_passkey (
  id                TEXT PRIMARY KEY,        -- ID kredensial (base64url)
  username          TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE,
  kunci_publik      TEXT NOT NULL,           -- kunci publik COSE (base64url)
  penghitung        BIGINT NOT NULL DEFAULT 0,
  transports        TEXT[],
  nama_perangkat    TEXT,
  dicadangkan       BOOLEAN,                 -- tersinkron ke iCloud/Google
  dibuat_pada       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terakhir_dipakai  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS kredensial_passkey_username_idx ON kredensial_passkey (username);

-- 2. Tautan akun luar (Google; Apple disiapkan). Dicocokkan lewat `sub`,
--    nomor akun tetap dari penyedia — bukan alamat email.
CREATE TABLE IF NOT EXISTS tautan_login (
  penyedia          TEXT NOT NULL,           -- 'google' | 'apple'
  sub               TEXT NOT NULL,
  username          TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE,
  email             TEXT,
  dibuat_pada       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terakhir_dipakai  TIMESTAMPTZ,
  PRIMARY KEY (penyedia, sub),
  UNIQUE (penyedia, username)
);

-- 3. Tantangan passkey sekali pakai (berlaku 5 menit).
CREATE TABLE IF NOT EXISTS tantangan_masuk (
  id           TEXT PRIMARY KEY,
  tantangan    TEXT NOT NULL,
  jenis        TEXT NOT NULL,                -- passkey_masuk | passkey_daftar
  username     TEXT,
  kedaluwarsa  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS tantangan_masuk_kedaluwarsa_idx ON tantangan_masuk (kedaluwarsa);

-- Tertutup untuk peramban: RLS menyala TANPA kebijakan apa pun, dan hak
-- peran publik dicabut. Hanya kunci layanan (peladen) yang dapat membaca/menulis.
ALTER TABLE kredensial_passkey ENABLE ROW LEVEL SECURITY;
ALTER TABLE tautan_login       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tantangan_masuk    ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON kredensial_passkey, tautan_login, tantangan_masuk FROM anon, authenticated;

-- Pemeriksaan (opsional): siapa saja yang sudah memakai cara masuk baru.
--   SELECT username, count(*) AS passkey FROM kredensial_passkey GROUP BY 1 ORDER BY 1;
--   SELECT penyedia, username, email FROM tautan_login ORDER BY 2;
