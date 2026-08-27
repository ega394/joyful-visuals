import React, { useState, useEffect, useCallback } from "react";
import { AdminCalendar, BookingDetailModal, MONTH_NAMES } from "./BookingDashboard.jsx";
import { userFetch } from "../roomAuth";

/**
 * Kalender peminjaman ruangan — LIHAT SAJA.
 *
 * Dipakai staf Protokol yang perlu tahu ruangan mana yang terpakai, tanpa
 * kewenangan meninjau permohonan.
 *
 * Mengambil data lewat endpoint kalender `?month=YYYY-MM` (Pending + Approved
 * pada bulan tsb) — bukan `?admin=1` yang menuntut sesi peninjau permohonan,
 * yang memang tidak dimiliki staf.
 *
 * Permintaan dikirim lewat userFetch: bila token sesi berhasil didapat, server
 * menyertakan rincian peminjam (termasuk WA PIC) sehingga staf bisa menghubungi
 * yang bersangkutan. Tanpa token — kalender tetap tampil, hanya isinya sebatas
 * ketersediaan slot, sama seperti yang dilihat halaman publik.
 */
export default function RoomCalendarView({ isMobile, user }) {
  const NAVY = "#0A1628", GOLD = "#C9A84C";
  const now = new Date();

  const [tahun, setTahun]     = useState(now.getFullYear());
  const [bulan, setBulan]     = useState(now.getMonth() + 1);   // 1–12
  const [rooms, setRooms]     = useState([]);
  const [bookings, setBookings] = useState([]);
  const [ruangFilter, setRuangFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [detail, setDetail]   = useState(null);

  const monthStr = tahun + "-" + String(bulan).padStart(2, "0");

  const muat = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [bk, rm] = await Promise.all([
        userFetch(user, "/api/room-booking?month=" + monthStr).then(r => r.json()),
        fetch("/api/room-booking?op=rooms").then(r => r.json()),
      ]);
      setBookings(Array.isArray(bk) ? bk : []);
      setRooms(Array.isArray(rm) ? rm : []);
    } catch (e) {
      setErr("Gagal memuat kalender. Periksa koneksi lalu coba lagi.");
      setBookings([]);
    }
    setLoading(false);
    // Sengaja bergantung pada username, bukan objek user: bila induk membuat
    // objek baru tiap render, kalender tidak ikut memuat ulang tanpa henti.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStr, user?.username]);

  useEffect(() => { muat(); }, [muat]);

  const geser = (arah) => {
    if (arah < 0) { if (bulan === 1) { setTahun(t => t - 1); setBulan(12); } else setBulan(m => m - 1); }
    else          { if (bulan === 12){ setTahun(t => t + 1); setBulan(1);  } else setBulan(m => m + 1); }
  };

  const sel = {
    padding: "8px 12px", borderRadius: 8, border: "1.5px solid #D1D5DB",
    fontSize: 13, outline: "none", background: "white",
  };
  const nav = {
    padding: "8px 12px", borderRadius: 8, border: "1.5px solid #D1D5DB",
    background: "white", cursor: "pointer", fontSize: 13,
  };

  // Slot lain dengan kode booking sama — modal detail menampilkan seluruh slot
  const slotSekode = detail
    ? bookings.filter(b => b.booking_code === detail.booking_code)
    : [];

  return (
    <div style={{ padding: isMobile ? "12px 12px" : "20px 24px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        <div style={{ background: `linear-gradient(135deg,${NAVY},#1A2F50)`, borderRadius: 16, padding: "18px 20px", marginBottom: 16 }}>
          <div style={{ color: GOLD, fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>
            Peminjaman Ruangan
          </div>
          <div style={{ color: "white", fontSize: isMobile ? 16 : 20, fontWeight: 900, marginBottom: 2 }}>
            Kalender Ketersediaan Ruang
          </div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>
            Hanya untuk dilihat — pengajuan &amp; persetujuan dilakukan peninjau permohonan
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <select value={ruangFilter} onChange={e => setRuangFilter(e.target.value)} style={sel}>
            <option value="">Semua Ruangan</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button onClick={() => geser(-1)} style={nav}>‹</button>
            <div style={{ padding: "8px 12px", fontWeight: 700, fontSize: 13, color: NAVY, minWidth: 130, textAlign: "center" }}>
              {MONTH_NAMES[bulan - 1]} {tahun}
            </div>
            <button onClick={() => geser(1)} style={nav}>›</button>
          </div>

          <button onClick={muat} style={nav}>↻ Muat Ulang</button>
        </div>

        {err && (
          <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", color: "#991B1B",
            borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13 }}>
            ⚠ {err}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Memuat kalender...</div>
        ) : (
          <div style={{ background: "white", borderRadius: 14, padding: "18px 16px",
            border: "1.5px solid #E5E7EB", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <AdminCalendar
              bookings={bookings}
              rooms={rooms}
              year={tahun}
              month={bulan}
              roomFilter={ruangFilter}
              onBookingClick={setDetail}
            />
          </div>
        )}

        <div style={{ marginTop: 12, padding: "9px 12px", background: "#F1F5F9", borderRadius: 8,
          fontSize: 11, color: "#64748B", lineHeight: 1.6 }}>
          ℹ️ Menampilkan peminjaman berstatus <b>Menunggu</b> dan <b>Disetujui</b> pada bulan terpilih.
          Klik salah satu untuk melihat rinciannya.
        </div>
      </div>

      {detail && (
        <BookingDetailModal
          booking={detail}
          slots={slotSekode}
          onClose={() => setDetail(null)}
          readOnly
        />
      )}
    </div>
  );
}
