-- ================================================================
-- Sistem Peminjaman Ruangan — Prokopim Tarakan
-- ================================================================

-- 1. Tambah kolom can_manage_rooms ke tabel users
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_rooms BOOLEAN DEFAULT FALSE;

-- 2. Tabel rooms (ruangan yang bisa dipinjam)
CREATE TABLE IF NOT EXISTS rooms (
  id        SERIAL PRIMARY KEY,
  name      TEXT    NOT NULL UNIQUE,
  capacity  INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed dua ruangan
INSERT INTO rooms (id, name, capacity) VALUES
  (1, 'Kenawai', 20),
  (2, 'Imbaya',  40)
ON CONFLICT (id) DO NOTHING;

-- 3. Tabel room_bookings (pengajuan peminjaman)
CREATE TABLE IF NOT EXISTS room_bookings (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           INTEGER     NOT NULL REFERENCES rooms(id),
  instansi          TEXT        NOT NULL,
  pic_name          TEXT        NOT NULL,
  pic_wa            TEXT        NOT NULL,
  event_name        TEXT        NOT NULL,
  participant_count INTEGER     NOT NULL,
  start_date        DATE        NOT NULL,
  end_date          DATE        NOT NULL,
  session           TEXT        NOT NULL CHECK (session IN ('Pagi','Siang','Full_Day')),
  srikandi_ref      TEXT,
  document_path     TEXT,
  status            TEXT        NOT NULL DEFAULT 'Pending'
                                CHECK (status IN ('Pending','Approved','Rejected','Cancelled')),
  booking_code      TEXT        UNIQUE NOT NULL
                                DEFAULT upper(left(replace(gen_random_uuid()::text,'-',''), 8)),
  notes             TEXT,
  reviewed_by       TEXT,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk conflict check
CREATE INDEX IF NOT EXISTS idx_rb_room_date
  ON room_bookings(room_id, start_date, end_date, session, status);

-- Trigger update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_rb_updated_at ON room_bookings;
CREATE TRIGGER trg_rb_updated_at
  BEFORE UPDATE ON room_bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. RLS (Row Level Security)
ALTER TABLE rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_bookings ENABLE ROW LEVEL SECURITY;

-- Rooms: publik bisa baca
DROP POLICY IF EXISTS "public_read_rooms" ON rooms;
CREATE POLICY "public_read_rooms" ON rooms
  FOR SELECT USING (true);

-- Bookings: publik hanya baca Pending/Approved (untuk kalender & tracker)
DROP POLICY IF EXISTS "public_read_bookings" ON room_bookings;
CREATE POLICY "public_read_bookings" ON room_bookings
  FOR SELECT USING (status IN ('Pending','Approved','Rejected','Cancelled'));

-- Bookings: siapapun bisa submit (INSERT) — validasi di serverless
DROP POLICY IF EXISTS "public_insert_bookings" ON room_bookings;
CREATE POLICY "public_insert_bookings" ON room_bookings
  FOR INSERT WITH CHECK (true);

-- Bookings: UPDATE diizinkan via anon key (validasi role di serverless)
DROP POLICY IF EXISTS "anon_update_bookings" ON room_bookings;
CREATE POLICY "anon_update_bookings" ON room_bookings
  FOR UPDATE USING (true) WITH CHECK (true);

-- 5. Storage bucket untuk file surat (buat via Supabase Dashboard atau command berikut)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('room-documents', 'room-documents', true)
-- ON CONFLICT (id) DO NOTHING;
