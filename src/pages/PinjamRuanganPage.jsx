/**
 * PinjamRuanganPage.jsx — Halaman Publik Peminjaman Ruangan
 * Dapat diakses tanpa login di /pinjamruangan
 */
import React, { useState, useEffect, useCallback } from "react";

const NAVY = "#0A1628";
const GOLD = "#C9A84C";
const GREEN = "#16a34a";
const YELLOW = "#d97706";
const RED = "#dc2626";
const GRAY = "#6b7280";

const SESSION_INFO = {
  Pagi:     { label: "Pagi",     time: "07.30–12.00", color: "#3B82F6" },
  Siang:    { label: "Siang",    time: "12.30–16.30", color: "#8B5CF6" },
  Full_Day: { label: "Full Day", time: "Seharian",    color: "#F59E0B" },
};

const DAYS_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTH_NAMES = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
];

// ── Helpers ──────────────────────────────────────────────────

function toYMD(d) {
  return d instanceof Date
    ? d.toISOString().slice(0, 10)
    : String(d).slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return toYMD(d);
}

/** Kembalikan semua tanggal (YYYY-MM-DD) antara start s/d end (inklusif) */
function expandDateRange(start, end) {
  const result = [];
  let cur = start;
  while (cur <= end) { result.push(cur); cur = addDays(cur, 1); }
  return result;
}

/**
 * Untuk sebuah hari (dateStr) dan sesi tertentu,
 * kembalikan status dari list bookings:
 * 'approved' | 'pending' | 'available'
 */
function slotStatus(bookings, roomId, dateStr, session) {
  const relevant = bookings.filter(b => {
    if (b.room_id !== roomId) return false;
    if (b.start_date > dateStr || b.end_date < dateStr) return false;
    const conflicting = session === "Full_Day"
      ? ["Pagi", "Siang", "Full_Day"]
      : session === "Pagi"
        ? ["Pagi", "Full_Day"]
        : ["Siang", "Full_Day"];
    return conflicting.includes(b.session);
  });
  if (relevant.some(b => b.status === "Approved")) return "approved";
  if (relevant.some(b => b.status === "Pending"))  return "pending";
  return "available";
}

function formatTanggal(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function formatTanggalShort(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// ── Sub-komponen ─────────────────────────────────────────────

function SlotBadge({ status, compact }) {
  const cfg = {
    approved:  { bg: "#FEE2E2", color: RED,    label: "Terisi" },
    pending:   { bg: "#FEF3C7", color: YELLOW,  label: "Proses" },
    available: { bg: "#D1FAE5", color: GREEN,   label: "Tersedia" },
  }[status] || { bg: "#F3F4F6", color: GRAY, label: "?" };

  return (
    <span style={{
      display: "inline-block",
      padding: compact ? "1px 5px" : "2px 7px",
      borderRadius: 5,
      background: cfg.bg,
      color: cfg.color,
      fontSize: compact ? 9 : 10,
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}>{cfg.label}</span>
  );
}

function RoomCalendar({ bookings, rooms, year, month }) {
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth  = new Date(year, month, 0).getDate();
  const startDow     = firstOfMonth.getDay(); // 0=Sun

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = toYMD(new Date());

  return (
    <div style={{ overflowX: "auto" }}>
      {rooms.map(room => (
        <div key={room.id} style={{ marginBottom: 28 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            marginBottom: 10,
          }}>
            <div style={{
              background: NAVY, color: "white",
              borderRadius: 8, padding: "5px 12px",
              fontSize: 13, fontWeight: 700,
            }}>
              {room.name}
            </div>
            <div style={{ fontSize: 12, color: GRAY }}>
              Kapasitas {room.capacity} orang
            </div>
          </div>

          {/* Header hari */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, minWidth: 350 }}>
            {DAYS_SHORT.map(d => (
              <div key={d} style={{
                textAlign: "center", fontSize: 11, fontWeight: 700,
                color: GRAY, paddingBottom: 4,
              }}>{d}</div>
            ))}

            {cells.map((dateStr, i) => {
              if (!dateStr) return <div key={i} />;
              const pagiStatus  = slotStatus(bookings, room.id, dateStr, "Pagi");
              const siangStatus = slotStatus(bookings, room.id, dateStr, "Siang");
              const isToday = dateStr === todayStr;
              const isPast  = dateStr < todayStr;

              return (
                <div key={dateStr} style={{
                  border: isToday ? `2px solid ${GOLD}` : "1.5px solid #E5E7EB",
                  borderRadius: 7,
                  padding: "4px 3px",
                  background: isPast ? "#FAFAFA" : "white",
                  opacity: isPast ? 0.65 : 1,
                }}>
                  <div style={{
                    textAlign: "center", fontSize: 11, fontWeight: isToday ? 800 : 500,
                    color: isToday ? NAVY : "#374151", marginBottom: 3,
                  }}>
                    {parseInt(dateStr.slice(8))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                      <span style={{ fontSize: 8, color: "#6B7280", fontWeight: 600 }}>P</span>
                      <SlotBadge status={pagiStatus} compact />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                      <span style={{ fontSize: 8, color: "#6B7280", fontWeight: 600 }}>S</span>
                      <SlotBadge status={siangStatus} compact />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Legenda */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
        {[
          { status: "available", label: "Tersedia" },
          { status: "pending",   label: "Menunggu Konfirmasi" },
          { status: "approved",  label: "Terisi" },
        ].map(({ status, label }) => (
          <div key={status} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <SlotBadge status={status} />
            <span style={{ fontSize: 12, color: GRAY }}>{label}</span>
          </div>
        ))}
        <div style={{ fontSize: 12, color: GRAY }}>
          <b>P</b> = Pagi (07.30–12.00) &nbsp;|&nbsp; <b>S</b> = Siang (12.30–16.30)
        </div>
      </div>
    </div>
  );
}

// ── Status Tracker ────────────────────────────────────────────

function StatusTracker() {
  const [query, setQuery]     = useState("");
  const [mode, setMode]       = useState("code"); // 'code' | 'wa'
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  const [cancelId, setCancelId]     = useState(null);
  const [cancelCode, setCancelCode] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setErr(""); setResults(null);
    try {
      const param = mode === "code"
        ? `code=${encodeURIComponent(query.trim().toUpperCase())}`
        : `pic_wa=${encodeURIComponent(query.trim())}`;
      const r = await fetch(`/api/room-bookings?${param}`);
      const data = await r.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setErr("Gagal menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const doCancel = async (id, code) => {
    if (!window.confirm("Yakin ingin membatalkan peminjaman ini?")) return;
    setCancelling(true);
    try {
      const r = await fetch(`/api/room-bookings?id=${id}&code=${code}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      alert("Peminjaman berhasil dibatalkan.");
      search();
    } catch (e) {
      alert("Gagal membatalkan: " + e.message);
    } finally {
      setCancelling(false);
      setCancelId(null);
    }
  };

  const statusCfg = {
    Pending:   { label: "Menunggu Konfirmasi", color: YELLOW, bg: "#FEF3C7" },
    Approved:  { label: "Disetujui",           color: GREEN,  bg: "#D1FAE5" },
    Rejected:  { label: "Ditolak",             color: RED,    bg: "#FEE2E2" },
    Cancelled: { label: "Dibatalkan",          color: GRAY,   bg: "#F3F4F6" },
  };

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 12 }}>
        Cek Status Peminjaman
      </h3>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {[
          { k: "code", l: "Kode Booking" },
          { k: "wa",   l: "Nomor WhatsApp" },
        ].map(({ k, l }) => (
          <button key={k} onClick={() => { setMode(k); setResults(null); }}
            style={{
              padding: "6px 14px", borderRadius: 8, cursor: "pointer",
              fontSize: 13, fontWeight: 600, border: "none",
              background: mode === k ? NAVY : "#E5E7EB",
              color: mode === k ? "white" : "#374151",
            }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          placeholder={mode === "code" ? "Contoh: AB12CD34" : "Contoh: 08123456789"}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 8,
            border: "1.5px solid #D1D5DB", fontSize: 14,
            outline: "none",
          }}
        />
        <button onClick={search} disabled={loading}
          style={{
            padding: "10px 20px", borderRadius: 8, border: "none",
            background: NAVY, color: "white", fontWeight: 700,
            fontSize: 14, cursor: "pointer", whiteSpace: "nowrap",
          }}>
          {loading ? "..." : "Cek"}
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 10, color: RED, fontSize: 13 }}>{err}</div>
      )}

      {results !== null && (
        <div style={{ marginTop: 14 }}>
          {results.length === 0 ? (
            <div style={{ color: GRAY, fontSize: 14, textAlign: "center", padding: "20px 0" }}>
              Tidak ditemukan peminjaman dengan {mode === "code" ? "kode" : "nomor WA"} tersebut.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {results.map(b => {
                const cfg = statusCfg[b.status] || statusCfg.Pending;
                const tanggalStr = b.start_date === b.end_date
                  ? formatTanggal(b.start_date)
                  : `${formatTanggalShort(b.start_date)} – ${formatTanggalShort(b.end_date)}`;
                const sesInfo = SESSION_INFO[b.session] || {};
                return (
                  <div key={b.id} style={{
                    border: "1.5px solid #E5E7EB", borderRadius: 12,
                    padding: "14px 16px", background: "white",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <span style={{ fontFamily: "monospace", fontWeight: 800, color: NAVY, fontSize: 15 }}>
                          {b.booking_code}
                        </span>
                        <div style={{ fontSize: 13, color: "#374151", marginTop: 2, fontWeight: 600 }}>
                          {b.event_name}
                        </div>
                      </div>
                      <span style={{
                        padding: "4px 10px", borderRadius: 20,
                        background: cfg.bg, color: cfg.color,
                        fontSize: 12, fontWeight: 700,
                      }}>
                        {cfg.label}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontSize: 13 }}>
                      <div><span style={{ color: GRAY }}>Ruangan:</span> <b>{b.rooms?.name || "-"}</b></div>
                      <div><span style={{ color: GRAY }}>Instansi:</span> {b.instansi}</div>
                      <div><span style={{ color: GRAY }}>Tanggal:</span> {tanggalStr}</div>
                      <div>
                        <span style={{ color: GRAY }}>Sesi:</span>{" "}
                        <span style={{ color: sesInfo.color, fontWeight: 600 }}>
                          {sesInfo.label} {sesInfo.time && `(${sesInfo.time})`}
                        </span>
                      </div>
                      <div><span style={{ color: GRAY }}>PIC:</span> {b.pic_name}</div>
                      <div><span style={{ color: GRAY }}>Peserta:</span> {b.participant_count} orang</div>
                    </div>

                    {b.notes && (
                      <div style={{
                        marginTop: 8, padding: "8px 10px",
                        background: b.status === "Rejected" ? "#FEF2F2" : "#F9FAFB",
                        borderRadius: 7, fontSize: 13, color: b.status === "Rejected" ? RED : "#374151",
                      }}>
                        <b>Keterangan:</b> {b.notes}
                      </div>
                    )}

                    {b.status === "Pending" && (
                      <button
                        onClick={() => doCancel(b.id, b.booking_code)}
                        disabled={cancelling}
                        style={{
                          marginTop: 10, padding: "7px 14px", borderRadius: 7,
                          border: `1.5px solid ${RED}`, background: "white",
                          color: RED, fontWeight: 700, fontSize: 13, cursor: "pointer",
                        }}>
                        Batalkan Peminjaman
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Form Peminjaman ───────────────────────────────────────────

function BookingForm({ rooms, onSuccess }) {
  const today = toYMD(new Date());
  const [form, setForm] = useState({
    room_id: "",
    instansi: "",
    pic_name: "",
    pic_wa: "",
    event_name: "",
    participant_count: "",
    start_date: today,
    end_date: today,
    session: "",
    srikandi_ref: "",
  });
  const [file, setFile]         = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]           = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const isMultiDay = form.end_date && form.start_date && form.end_date !== form.start_date;

  const selectedRoom = rooms.find(r => r.id === Number(form.room_id));

  const handleSubmit = async e => {
    e.preventDefault();
    setErr(""); setSubmitting(true);

    try {
      let document_path = null;

      // Upload file jika ada
      if (file) {
        setUploadingFile(true);
        const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
        const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const ts  = Date.now();
        const ext = file.name.split(".").pop();
        const path = `booking-docs/${ts}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

        const uploadR = await fetch(`${SUPA_URL}/storage/v1/object/room-documents/${path}`, {
          method: "POST",
          headers: {
            "apikey": SUPA_KEY,
            "Authorization": `Bearer ${SUPA_KEY}`,
            "Content-Type": file.type || "application/pdf",
          },
          body: file,
        });
        if (!uploadR.ok) {
          const t = await uploadR.text();
          throw new Error("Gagal upload file: " + t);
        }
        document_path = `${SUPA_URL}/storage/v1/object/public/room-documents/${path}`;
        setUploadingFile(false);
      }

      const payload = {
        ...form,
        room_id: Number(form.room_id),
        participant_count: Number(form.participant_count),
        document_path,
      };

      const r = await fetch("/api/room-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Gagal mengirim pengajuan");

      onSuccess(data.booking);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
      setUploadingFile(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1.5px solid #D1D5DB", fontSize: 14, outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
        {/* Instansi */}
        <div style={{ gridColumn: "1/-1" }}>
          <label style={labelStyle}>Instansi / Organisasi *</label>
          <input required value={form.instansi} onChange={e => f("instansi", e.target.value)}
            placeholder="Dinas / OPD / Organisasi" style={inputStyle} />
        </div>

        {/* PIC */}
        <div>
          <label style={labelStyle}>Nama PIC *</label>
          <input required value={form.pic_name} onChange={e => f("pic_name", e.target.value)}
            placeholder="Nama penanggung jawab" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Nomor WhatsApp PIC *</label>
          <input required value={form.pic_wa} onChange={e => f("pic_wa", e.target.value)}
            placeholder="08xxxxxxxxxx" type="tel" style={inputStyle} />
        </div>

        {/* Nama Acara */}
        <div style={{ gridColumn: "1/-1" }}>
          <label style={labelStyle}>Nama Acara / Kegiatan *</label>
          <input required value={form.event_name} onChange={e => f("event_name", e.target.value)}
            placeholder="Nama kegiatan yang akan diselenggarakan" style={inputStyle} />
        </div>

        {/* Ruangan */}
        <div>
          <label style={labelStyle}>Pilih Ruangan *</label>
          <select required value={form.room_id} onChange={e => f("room_id", e.target.value)} style={inputStyle}>
            <option value="">-- Pilih Ruangan --</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name} (maks. {r.capacity} orang)</option>
            ))}
          </select>
        </div>

        {/* Jumlah Peserta */}
        <div>
          <label style={labelStyle}>
            Jumlah Peserta *
            {selectedRoom && (
              <span style={{ fontWeight: 400, color: GRAY }}> (maks. {selectedRoom.capacity})</span>
            )}
          </label>
          <input required type="number" min={1} max={selectedRoom?.capacity || 999}
            value={form.participant_count} onChange={e => f("participant_count", e.target.value)}
            placeholder="Estimasi jumlah peserta" style={inputStyle} />
        </div>

        {/* Tanggal */}
        <div>
          <label style={labelStyle}>Tanggal Mulai *</label>
          <input required type="date" min={today} value={form.start_date}
            onChange={e => {
              f("start_date", e.target.value);
              if (e.target.value > form.end_date) f("end_date", e.target.value);
            }} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Tanggal Selesai *</label>
          <input required type="date" min={form.start_date || today} value={form.end_date}
            onChange={e => f("end_date", e.target.value)} style={inputStyle} />
        </div>

        {/* Sesi */}
        <div style={{ gridColumn: "1/-1" }}>
          <label style={labelStyle}>Sesi *</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(SESSION_INFO).map(([key, info]) => (
              <button
                key={key}
                type="button"
                onClick={() => f("session", key)}
                style={{
                  padding: "9px 18px", borderRadius: 8, cursor: "pointer",
                  border: `2px solid ${form.session === key ? info.color : "#D1D5DB"}`,
                  background: form.session === key ? info.color : "white",
                  color: form.session === key ? "white" : "#374151",
                  fontWeight: 700, fontSize: 13, transition: "all 0.15s",
                }}>
                {info.label}
                <div style={{ fontSize: 11, fontWeight: 400, marginTop: 1, opacity: 0.85 }}>
                  {info.time}
                </div>
              </button>
            ))}
          </div>
          {!form.session && <div style={{ fontSize: 12, color: RED, marginTop: 4 }}>Pilih sesi wajib</div>}
        </div>

        {/* Srikandi / File — hanya jika multi-hari */}
        {isMultiDay && (
          <div style={{ gridColumn: "1/-1" }}>
            <div style={{
              background: "#FEF3C7", border: "1.5px solid #FCD34D",
              borderRadius: 10, padding: "10px 14px", marginBottom: 12,
              fontSize: 13, color: "#92400E",
            }}>
              <b>Peminjaman lebih dari 1 hari</b> memerlukan nomor surat Srikandi
              atau upload surat permohonan (PDF).
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Nomor Surat Srikandi</label>
                <input
                  value={form.srikandi_ref}
                  onChange={e => f("srikandi_ref", e.target.value)}
                  placeholder="Contoh: 005/XXXX/2026"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Upload Surat Permohonan (PDF)</label>
                <input
                  type="file" accept=".pdf,application/pdf"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  style={{ ...inputStyle, padding: "7px 10px" }}
                />
              </div>
            </div>
            {!form.srikandi_ref && !file && (
              <div style={{ fontSize: 12, color: RED, marginTop: 4 }}>
                Wajib isi nomor Srikandi atau upload surat untuk peminjaman lebih dari 1 hari.
              </div>
            )}
          </div>
        )}
      </div>

      {err && (
        <div style={{
          marginTop: 14, padding: "10px 14px",
          background: "#FEE2E2", color: RED, borderRadius: 8, fontSize: 13,
        }}>
          {err}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !form.session || (isMultiDay && !form.srikandi_ref && !file)}
        style={{
          marginTop: 18, width: "100%", padding: "13px",
          borderRadius: 10, border: "none",
          background: submitting ? "#9CA3AF" : NAVY,
          color: "white", fontWeight: 700, fontSize: 15,
          cursor: submitting ? "not-allowed" : "pointer",
          transition: "background 0.2s",
        }}>
        {uploadingFile ? "Mengupload surat..." : submitting ? "Mengirim pengajuan..." : "Kirim Pengajuan Peminjaman"}
      </button>
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function PinjamRuanganPage() {
  const [rooms, setRooms]         = useState([]);
  const [bookings, setBookings]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeSection, setActiveSection] = useState("calendar"); // 'calendar' | 'form' | 'tracker'
  const [successBooking, setSuccessBooking] = useState(null);

  // Bulan kalender
  const now = new Date();
  const [calYear, setCalYear]   = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);

  const monthStr = `${calYear}-${String(calMonth).padStart(2, "0")}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roomsR, bookingsR] = await Promise.all([
        fetch("/api/rooms").then(r => r.json()),
        fetch(`/api/room-bookings?month=${monthStr}`).then(r => r.json()),
      ]);
      setRooms(Array.isArray(roomsR) ? roomsR : []);
      setBookings(Array.isArray(bookingsR) ? bookingsR : []);
    } catch { /* skip */ }
    setLoading(false);
  }, [monthStr]);

  useEffect(() => { loadData(); }, [loadData]);

  // Cek query param ?cek=CODE (dari WA notification link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cekCode = params.get("cek");
    if (cekCode) setActiveSection("tracker");
  }, []);

  const prevMonth = () => {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
  };

  const navTabs = [
    { k: "calendar", l: "Kalender Ketersediaan" },
    { k: "form",     l: "Ajukan Peminjaman" },
    { k: "tracker",  l: "Cek Status" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${NAVY} 0%, #1E3A5F 100%)`,
        padding: "20px 24px 28px",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <img src="/logo_tarakan.png" alt="Logo" style={{ height: 42, width: "auto", objectFit: "contain" }}
              onError={e => e.target.style.display = "none"} />
            <div>
              <div style={{ color: GOLD, fontSize: 9, letterSpacing: 2, fontWeight: 700, textTransform: "uppercase" }}>
                Pemerintah Kota Tarakan
              </div>
              <div style={{ color: "white", fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>
                Peminjaman Ruang Rapat
              </div>
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 1 }}>
                Bagian Protokol & Komunikasi Pimpinan
              </div>
            </div>
          </div>

          {/* Tabs navigasi */}
          <div style={{ display: "flex", gap: 4 }}>
            {navTabs.map(({ k, l }) => (
              <button key={k} onClick={() => { setActiveSection(k); setSuccessBooking(null); }}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: activeSection === k ? "rgba(255,255,255,0.2)" : "transparent",
                  color: activeSection === k ? "white" : "rgba(255,255,255,0.55)",
                  fontWeight: activeSection === k ? 700 : 500,
                  fontSize: 13, borderBottom: activeSection === k ? `2px solid ${GOLD}` : "2px solid transparent",
                }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 48px" }}>

        {/* ── Kalender ── */}
        {activeSection === "calendar" && (
          <div>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 20,
            }}>
              <button onClick={prevMonth}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #D1D5DB", background: "white", cursor: "pointer", fontSize: 16 }}>
                ‹
              </button>
              <div style={{ fontWeight: 800, fontSize: 17, color: NAVY }}>
                {MONTH_NAMES[calMonth - 1]} {calYear}
              </div>
              <button onClick={nextMonth}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #D1D5DB", background: "white", cursor: "pointer", fontSize: 16 }}>
                ›
              </button>
            </div>

            {loading
              ? <div style={{ textAlign: "center", padding: 40, color: GRAY }}>Memuat kalender...</div>
              : <RoomCalendar bookings={bookings} rooms={rooms} year={calYear} month={calMonth} />
            }

            <div style={{ marginTop: 24, textAlign: "center" }}>
              <button onClick={() => setActiveSection("form")}
                style={{
                  padding: "12px 28px", borderRadius: 10, border: "none",
                  background: NAVY, color: "white", fontWeight: 700,
                  fontSize: 15, cursor: "pointer",
                }}>
                Ajukan Peminjaman
              </button>
            </div>
          </div>
        )}

        {/* ── Form ── */}
        {activeSection === "form" && (
          <div>
            {successBooking ? (
              <div style={{
                background: "#D1FAE5", border: "2px solid #6EE7B7",
                borderRadius: 16, padding: "28px 24px", textAlign: "center",
              }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: GREEN, marginBottom: 6 }}>
                  Pengajuan Berhasil Dikirim!
                </div>
                <div style={{ fontSize: 14, color: "#065F46", marginBottom: 16 }}>
                  Kode booking Anda:
                </div>
                <div style={{
                  fontFamily: "monospace", fontSize: 28, fontWeight: 900,
                  color: NAVY, letterSpacing: 4,
                  background: "white", padding: "12px 24px",
                  borderRadius: 10, display: "inline-block", marginBottom: 16,
                }}>
                  {successBooking.booking_code}
                </div>
                <div style={{ fontSize: 13, color: "#065F46", marginBottom: 20 }}>
                  Simpan kode ini untuk cek status. Konfirmasi juga dikirim ke WhatsApp Anda.
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <button onClick={() => { setSuccessBooking(null); setActiveSection("calendar"); }}
                    style={{
                      padding: "10px 20px", borderRadius: 8, border: "none",
                      background: NAVY, color: "white", fontWeight: 700, cursor: "pointer",
                    }}>
                    Lihat Kalender
                  </button>
                  <button onClick={() => { setActiveSection("tracker"); setSuccessBooking(null); }}
                    style={{
                      padding: "10px 20px", borderRadius: 8,
                      border: `1.5px solid ${NAVY}`, background: "white",
                      color: NAVY, fontWeight: 700, cursor: "pointer",
                    }}>
                    Cek Status Booking
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{
                  background: "#EFF6FF", border: "1.5px solid #BFDBFE",
                  borderRadius: 10, padding: "10px 14px", marginBottom: 20,
                  fontSize: 13, color: "#1D4ED8",
                }}>
                  Pengajuan akan diproses oleh staf Bagian Prokopim. Status akan dikonfirmasi melalui WhatsApp Anda.
                </div>
                <BookingForm rooms={rooms} onSuccess={setSuccessBooking} />
              </div>
            )}
          </div>
        )}

        {/* ── Status Tracker ── */}
        {activeSection === "tracker" && (
          <div style={{
            background: "white", borderRadius: 14,
            padding: "24px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          }}>
            <StatusTracker />
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        background: NAVY, color: "rgba(255,255,255,0.45)",
        textAlign: "center", padding: "14px", fontSize: 12,
      }}>
        Bagian Protokol & Komunikasi Pimpinan — Pemerintah Kota Tarakan
      </div>
    </div>
  );
}
