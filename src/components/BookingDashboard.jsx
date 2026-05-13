/**
 * BookingDashboard.jsx — Dashboard Admin Peminjaman Ruangan
 * Dapat diakses oleh role kabag atau user dengan can_manage_rooms=true
 */
import React, { useState, useEffect, useCallback } from "react";

const NAVY   = "#0A1628";
const GOLD   = "#C9A84C";
const GREEN  = "#16a34a";
const YELLOW = "#d97706";
const RED    = "#dc2626";
const GRAY   = "#6b7280";

const STATUS_CFG = {
  Pending:   { label: "Menunggu",   color: YELLOW, bg: "#FEF3C7", dot: "#F59E0B" },
  Approved:  { label: "Disetujui", color: GREEN,  bg: "#D1FAE5", dot: "#10B981" },
  Rejected:  { label: "Ditolak",   color: RED,    bg: "#FEE2E2", dot: "#EF4444" },
  Cancelled: { label: "Dibatalkan",color: GRAY,   bg: "#F3F4F6", dot: "#9CA3AF" },
};

const SESSION_INFO = {
  Pagi:     { label: "Pagi",     time: "07.30–12.00", color: "#3B82F6" },
  Siang:    { label: "Siang",    time: "12.30–16.30", color: "#8B5CF6" },
  Full_Day: { label: "Full Day", time: "Seharian",    color: "#F59E0B" },
};

function formatTgl(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function daysSince(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// ── Modal Konfirmasi Approve / Reject ────────────────────────

function ActionModal({ booking, action, onConfirm, onCancel }) {
  const [notes, setNotes] = useState("");
  const isReject = action === "Rejected";
  const isCancel = action === "Cancelled";

  const cfg = {
    Approved:  { title: "Setujui Peminjaman",  btn: "Setujui",  btnColor: GREEN },
    Rejected:  { title: "Tolak Peminjaman",    btn: "Tolak",    btnColor: RED },
    Cancelled: { title: "Batalkan Peminjaman", btn: "Batalkan", btnColor: "#78350F" },
  }[action] || {};

  const ses = SESSION_INFO[booking.session] || {};
  const tanggalStr = booking.start_date === booking.end_date
    ? formatTgl(booking.start_date)
    : `${formatTgl(booking.start_date)} – ${formatTgl(booking.end_date)}`;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 16,
    }} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{
        background: "white", borderRadius: 16, padding: "24px 22px",
        maxWidth: 460, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: NAVY }}>
          {cfg.title}
        </h3>
        <div style={{ fontSize: 13, color: GRAY, marginBottom: 16 }}>
          Kode: <b style={{ fontFamily: "monospace", color: NAVY }}>{booking.booking_code}</b>
        </div>

        <div style={{
          background: "#F9FAFB", borderRadius: 10, padding: "12px 14px",
          fontSize: 13, marginBottom: 16,
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px",
        }}>
          <div><span style={{ color: GRAY }}>Acara:</span> <b>{booking.event_name}</b></div>
          <div><span style={{ color: GRAY }}>Instansi:</span> {booking.instansi}</div>
          <div><span style={{ color: GRAY }}>Ruangan:</span> {booking.rooms?.name}</div>
          <div><span style={{ color: GRAY }}>Sesi:</span> {ses.label} ({ses.time})</div>
          <div><span style={{ color: GRAY }}>Tanggal:</span> {tanggalStr}</div>
          <div><span style={{ color: GRAY }}>Peserta:</span> {booking.participant_count} orang</div>
          <div><span style={{ color: GRAY }}>PIC:</span> {booking.pic_name}</div>
          <div><span style={{ color: GRAY }}>WA PIC:</span> {booking.pic_wa}</div>
        </div>

        {(isReject || isCancel) && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 5 }}>
              {isReject ? "Alasan Penolakan *" : "Keterangan Pembatalan (opsional)"}
            </label>
            <textarea
              required={isReject}
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={isReject ? "Jelaskan alasan penolakan..." : "Keterangan tambahan..."}
              style={{
                width: "100%", padding: "9px 11px", borderRadius: 8,
                border: "1.5px solid #D1D5DB", fontSize: 13, resize: "vertical",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel}
            style={{
              padding: "9px 18px", borderRadius: 8, border: "1.5px solid #D1D5DB",
              background: "white", color: "#374151", fontWeight: 600,
              fontSize: 13, cursor: "pointer",
            }}>
            Batal
          </button>
          <button
            disabled={isReject && !notes.trim()}
            onClick={() => onConfirm(action, notes)}
            style={{
              padding: "9px 18px", borderRadius: 8, border: "none",
              background: isReject && !notes.trim() ? "#9CA3AF" : cfg.btnColor,
              color: "white", fontWeight: 700, fontSize: 13,
              cursor: isReject && !notes.trim() ? "not-allowed" : "pointer",
            }}>
            {cfg.btn}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Booking Row ───────────────────────────────────────────────

function BookingRow({ booking, onAction, isMobile }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CFG[booking.status] || STATUS_CFG.Pending;
  const ses = SESSION_INFO[booking.session] || {};
  const tanggalStr = booking.start_date === booking.end_date
    ? formatTgl(booking.start_date)
    : `${formatTgl(booking.start_date)} – ${formatTgl(booking.end_date)}`;
  const age = daysSince(booking.created_at);
  const isSlaWarning = booking.status === "Pending" && age >= 1;

  return (
    <div style={{
      border: `1.5px solid ${isSlaWarning ? "#FCD34D" : "#E5E7EB"}`,
      borderRadius: 12,
      background: isSlaWarning ? "#FFFBEB" : "white",
      overflow: "hidden",
      transition: "box-shadow 0.15s",
    }}>
      {/* Row header */}
      <div
        onClick={() => setExpanded(x => !x)}
        style={{
          padding: "12px 14px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 10,
        }}
      >
        {/* Dot status */}
        <div style={{
          width: 9, height: 9, borderRadius: "50%",
          background: cfg.dot, flexShrink: 0,
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: NAVY }}>
              {booking.event_name}
            </span>
            <span style={{
              padding: "2px 8px", borderRadius: 20,
              background: cfg.bg, color: cfg.color,
              fontSize: 11, fontWeight: 700,
            }}>{cfg.label}</span>
            {isSlaWarning && (
              <span style={{
                padding: "2px 8px", borderRadius: 20,
                background: "#FEF3C7", color: "#92400E",
                fontSize: 11, fontWeight: 700,
              }}>⚠ {age}h belum diproses</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: GRAY, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span>{booking.rooms?.name}</span>
            <span>·</span>
            <span style={{ color: ses.color, fontWeight: 600 }}>{ses.label}</span>
            <span>·</span>
            <span>{tanggalStr}</span>
            <span>·</span>
            <span>{booking.instansi}</span>
          </div>
        </div>

        <span style={{ color: GRAY, fontSize: 16, flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: "1px solid #F3F4F6", padding: "14px" }}>
          <div style={{
            display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
            gap: "8px 14px", fontSize: 13, marginBottom: 14,
          }}>
            <div><div style={{ color: GRAY, fontSize: 11, fontWeight: 600 }}>PIC</div>{booking.pic_name}</div>
            <div><div style={{ color: GRAY, fontSize: 11, fontWeight: 600 }}>WA PIC</div>{booking.pic_wa}</div>
            <div><div style={{ color: GRAY, fontSize: 11, fontWeight: 600 }}>Peserta</div>{booking.participant_count} orang</div>
            <div><div style={{ color: GRAY, fontSize: 11, fontWeight: 600 }}>Kode</div>
              <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{booking.booking_code}</span>
            </div>
            <div><div style={{ color: GRAY, fontSize: 11, fontWeight: 600 }}>Diajukan</div>{formatTgl(booking.created_at)}</div>
            {booking.reviewed_by && (
              <div><div style={{ color: GRAY, fontSize: 11, fontWeight: 600 }}>Direview oleh</div>{booking.reviewed_by}</div>
            )}
            {booking.srikandi_ref && (
              <div style={{ gridColumn: "1/-1" }}>
                <div style={{ color: GRAY, fontSize: 11, fontWeight: 600 }}>No. Surat Srikandi</div>
                <span style={{ fontWeight: 600, color: NAVY }}>{booking.srikandi_ref}</span>
              </div>
            )}
            {booking.document_path && (
              <div style={{ gridColumn: "1/-1" }}>
                <div style={{ color: GRAY, fontSize: 11, fontWeight: 600 }}>Surat Permohonan</div>
                <a href={booking.document_path} target="_blank" rel="noopener noreferrer"
                  style={{ color: "#2563EB", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
                  Lihat / Unduh Dokumen ↗
                </a>
              </div>
            )}
            {booking.notes && (
              <div style={{ gridColumn: "1/-1" }}>
                <div style={{ color: GRAY, fontSize: 11, fontWeight: 600 }}>Catatan</div>
                <div style={{ color: booking.status === "Rejected" ? RED : "#374151" }}>
                  {booking.notes}
                </div>
              </div>
            )}
          </div>

          {/* Tombol aksi */}
          {booking.status === "Pending" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => onAction(booking, "Approved")}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none",
                  background: GREEN, color: "white", fontWeight: 700,
                  fontSize: 13, cursor: "pointer",
                }}>
                ✓ Setujui
              </button>
              <button onClick={() => onAction(booking, "Rejected")}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none",
                  background: RED, color: "white", fontWeight: 700,
                  fontSize: 13, cursor: "pointer",
                }}>
                ✕ Tolak
              </button>
              <button onClick={() => onAction(booking, "Cancelled")}
                style={{
                  padding: "8px 16px", borderRadius: 8,
                  border: "1.5px solid #D1D5DB", background: "white",
                  color: "#374151", fontWeight: 600,
                  fontSize: 13, cursor: "pointer",
                }}>
                Batalkan
              </button>
            </div>
          )}
          {booking.status === "Approved" && (
            <button onClick={() => onAction(booking, "Cancelled")}
              style={{
                padding: "7px 14px", borderRadius: 8,
                border: `1.5px solid ${YELLOW}`, background: "white",
                color: YELLOW, fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}>
              Batalkan
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────

export default function BookingDashboard({ user, isMobile }) {
  const [bookings, setBookings]   = useState([]);
  const [rooms, setRooms]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null); // { booking, action }
  const [processing, setProcessing] = useState(false);
  const [toast, setToast]         = useState("");

  // Filter state
  const [filterStatus, setFilterStatus] = useState("Pending");
  const [filterRoom, setFilterRoom]     = useState("");

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterRoom)   params.set("room_id", filterRoom);

      const [bR, rR] = await Promise.all([
        fetch(`/api/room-bookings-admin?${params}`, {
          headers: { "X-Username": user?.username || "" },
        }).then(r => r.json()),
        fetch("/api/rooms").then(r => r.json()),
      ]);
      setBookings(Array.isArray(bR) ? bR : []);
      setRooms(Array.isArray(rR) ? rR : []);
    } catch { /* skip */ }
    setLoading(false);
  }, [filterStatus, filterRoom, user]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const handleAction = (booking, action) => setModal({ booking, action });

  const handleConfirm = async (action, notes) => {
    if (!modal) return;
    setProcessing(true);
    try {
      const r = await fetch("/api/room-bookings-admin", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Username": user?.username || "",
        },
        body: JSON.stringify({ id: modal.booking.id, status: action, notes }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      const actionLabel = { Approved: "disetujui", Rejected: "ditolak", Cancelled: "dibatalkan" }[action] || action;
      showToast(`Booking ${modal.booking.booking_code} berhasil ${actionLabel}`);
      setModal(null);
      loadBookings();
    } catch (e) {
      showToast("Gagal: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  // Stats
  const pending   = bookings.filter(b => b.status === "Pending").length;
  const approved  = bookings.filter(b => b.status === "Approved").length;
  const slaAlert  = bookings.filter(b => b.status === "Pending" && daysSince(b.created_at) >= 1).length;

  return (
    <div style={{ padding: isMobile ? "12px 12px" : "20px 24px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: NAVY }}>
            Dashboard Peminjaman Ruangan
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: GRAY }}>
            Validasi dan kelola permohonan peminjaman ruang rapat
          </p>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Menunggu", value: pending, color: YELLOW, bg: "#FEF3C7", icon: "⏳" },
            { label: "Disetujui (tampil)", value: approved, color: GREEN, bg: "#D1FAE5", icon: "✓" },
            { label: "Perlu Segera (>24j)", value: slaAlert, color: RED, bg: "#FEE2E2", icon: "⚠" },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, borderRadius: 12,
              padding: isMobile ? "12px 10px" : "16px 18px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: s.color }}>
                {s.icon} {s.value}
              </div>
              <div style={{ fontSize: isMobile ? 10 : 12, color: s.color, fontWeight: 600, marginTop: 2 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{
              padding: "8px 12px", borderRadius: 8, border: "1.5px solid #D1D5DB",
              fontSize: 13, outline: "none", background: "white",
            }}>
            <option value="">Semua Status</option>
            <option value="Pending">Menunggu</option>
            <option value="Approved">Disetujui</option>
            <option value="Rejected">Ditolak</option>
            <option value="Cancelled">Dibatalkan</option>
          </select>

          <select value={filterRoom} onChange={e => setFilterRoom(e.target.value)}
            style={{
              padding: "8px 12px", borderRadius: 8, border: "1.5px solid #D1D5DB",
              fontSize: 13, outline: "none", background: "white",
            }}>
            <option value="">Semua Ruangan</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          <button onClick={loadBookings}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "1.5px solid #D1D5DB",
              background: "white", cursor: "pointer", fontSize: 13, color: "#374151",
            }}>
            ↻ Refresh
          </button>

          <a href="/pinjamruangan" target="_blank" rel="noopener noreferrer"
            style={{
              padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${NAVY}`,
              background: "white", color: NAVY, fontWeight: 600,
              fontSize: 13, textDecoration: "none", display: "inline-flex",
              alignItems: "center", gap: 5,
            }}>
            ↗ Halaman Publik
          </a>
        </div>

        {/* List bookings */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: GRAY }}>Memuat data...</div>
        ) : bookings.length === 0 ? (
          <div style={{
            textAlign: "center", padding: 40,
            background: "white", borderRadius: 14, border: "1.5px solid #E5E7EB",
            color: GRAY, fontSize: 14,
          }}>
            Tidak ada permohonan ditemukan.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bookings.map(b => (
              <BookingRow key={b.id} booking={b} onAction={handleAction} isMobile={isMobile} />
            ))}
          </div>
        )}

        {/* Modal konfirmasi aksi */}
        {modal && (
          <ActionModal
            booking={modal.booking}
            action={modal.action}
            onConfirm={!processing ? handleConfirm : () => {}}
            onCancel={() => !processing && setModal(null)}
          />
        )}

        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
            background: NAVY, color: "white", padding: "10px 20px",
            borderRadius: 30, fontSize: 13, fontWeight: 600,
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)", zIndex: 9000,
            whiteSpace: "nowrap",
          }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
