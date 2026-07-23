/**
 * BookingDashboard.jsx — Dashboard Admin Peminjaman Ruangan
 * Dapat diakses oleh role kabag atau user dengan can_manage_rooms=true
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { adminFetch, clearAdminToken } from "../roomAuth";

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
  // Ambil bagian tanggal YYYY-MM-DD di awal — berlaku untuk tanggal polos maupun
  // timestamp lengkap Supabase (mis. "2026-07-09T08:14:53.721273+00"), sehingga
  // tidak menghasilkan "Invalid Date".
  const s = String(dateStr);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  const d = m ? new Date(m[1] + "T00:00:00") : new Date(s);
  if (isNaN(d.getTime())) return "-";
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

  const slots = (booking.slots && booking.slots.length ? booking.slots : [booking])
    .slice().sort((a,b)=> a.start_date.localeCompare(b.start_date) || (SES_ORDER[a.session]||9)-(SES_ORDER[b.session]||9));

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
          fontSize: 13, marginBottom: 12,
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px",
        }}>
          <div><span style={{ color: GRAY }}>Acara:</span> <b>{booking.event_name}</b></div>
          <div><span style={{ color: GRAY }}>Instansi:</span> {booking.instansi}</div>
          <div><span style={{ color: GRAY }}>Ruangan:</span> {booking.rooms?.name}</div>
          <div><span style={{ color: GRAY }}>Peserta:</span> {booking.participant_count} orang</div>
          <div><span style={{ color: GRAY }}>PIC:</span> {booking.pic_name}</div>
          <div><span style={{ color: GRAY }}>WA PIC:</span> {booking.pic_wa}</div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>
          Jadwal ({slots.length} slot)
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {slots.map(s => {
            const si = SESSION_INFO[s.session] || {};
            return (
              <span key={s.id||s.start_date+s.session} style={{
                fontSize: 12, background: "#F1F5F9", border: "1px solid #E5E7EB",
                borderRadius: 8, padding: "5px 9px",
              }}>
                <b>{formatTgl(s.start_date)}</b> · <span style={{ color: si.color, fontWeight: 700 }}>{si.label}</span>
              </span>
            );
          })}
        </div>

        {slots.length > 1 && (
          <div style={{
            background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1D4ED8",
            borderRadius: 8, padding: "9px 12px", fontSize: 12, marginBottom: 16,
            fontWeight: 600,
          }}>
            ⓘ {cfg.btn} berlaku untuk <b>seluruh {slots.length} slot</b> pengajuan ini sekaligus.
          </div>
        )}

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
  const slots = booking.slots || [booking];
  const tanggalStr = slots.length === 1
    ? formatTgl(slots[0].start_date)
    : `${slots.length} slot · ${formatTgl(slots[0].start_date)} – ${formatTgl(slots[slots.length-1].start_date)}`;
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
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: GRAY, fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
              Jadwal ({slots.length} slot)
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {slots.map(s => {
                const si = SESSION_INFO[s.session] || {};
                return (
                  <span key={s.id||s.start_date+s.session} style={{
                    fontSize: 12, background: "#F8FAFC", border: "1px solid #E5E7EB",
                    borderRadius: 8, padding: "5px 9px",
                  }}>
                    <b>{formatTgl(s.start_date)}</b> · <span style={{ color: si.color, fontWeight: 700 }}>{si.label}</span>
                  </span>
                );
              })}
            </div>
          </div>
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
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button onClick={() => onAction(booking, "Cancelled")}
                style={{
                  padding: "7px 14px", borderRadius: 8,
                  border: `1.5px solid ${YELLOW}`, background: "white",
                  color: YELLOW, fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}>
                Batalkan
              </button>
              <button onClick={() => printSingleBooking(booking, slots)}
                style={{
                  padding: "7px 14px", borderRadius: 8,
                  border: `1.5px solid ${NAVY}`, background: "white",
                  color: NAVY, fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}>
                🖨️ Cetak Surat
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Print/PDF Export Helpers ──────────────────────────────────

function escapeHTML(s) {
  return String(s||"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function fmtTglFull(s) {
  if (!s) return "-";
  const d = new Date(s+"T00:00:00");
  return d.toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
}

const SESSION_TIME = {
  Pagi: "07.30 – 12.00 WITA",
  Siang: "12.30 – 16.30 WITA",
  Full_Day: "Seharian (07.30 – 16.30 WITA)",
};

const STATUS_ID = {
  Pending:   "Menunggu Konfirmasi",
  Approved:  "Disetujui",
  Rejected:  "Ditolak",
  Cancelled: "Dibatalkan",
};

const SES_ORDER = { Pagi: 1, Siang: 2, Full_Day: 3 };

// 1 pengajuan = banyak baris (slot) berbagi booking_code → kelompokkan
function groupByCode(rows) {
  const map = new Map();
  for (const r of (rows || [])) {
    if (!map.has(r.booking_code)) map.set(r.booking_code, []);
    map.get(r.booking_code).push(r);
  }
  const groups = [];
  for (const slots of map.values()) {
    const sorted = slots.slice().sort((a, b) =>
      a.start_date !== b.start_date
        ? a.start_date.localeCompare(b.start_date)
        : (SES_ORDER[a.session] || 9) - (SES_ORDER[b.session] || 9)
    );
    groups.push({ ...sorted[0], slots: sorted });
  }
  groups.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return groups;
}

/** Cetak rekap daftar booking (admin) — diurut berdasarkan tanggal terdekat */
function printBookingList(bookings, filterLabel) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { alert("Mohon izinkan popup untuk mencetak."); return; }
  const today = new Date().toLocaleDateString("id-ID",{ weekday:"long", day:"numeric", month:"long", year:"numeric" });

  // 1 pengajuan = 1 baris; jadwal memuat seluruh slot. Urut tanggal terdekat.
  const groups = groupByCode(bookings).sort((a, b) =>
    (a.slots[0].start_date).localeCompare(b.slots[0].start_date)
  );

  const rows = groups.map((g,i) => {
    const jadwal = g.slots
      .map(s => `${fmtTglFull(s.start_date)} — ${escapeHTML(SESSION_TIME[s.session]||s.session)}`)
      .join("<br/>");
    return `
    <tr>
      <td style="text-align:center">${i+1}</td>
      <td><b>${escapeHTML(g.booking_code)}</b></td>
      <td>${escapeHTML(g.event_name)}<br/><small>${escapeHTML(g.instansi)}</small></td>
      <td>${escapeHTML(g.rooms?.name||"-")}</td>
      <td><small>${jadwal}</small></td>
      <td style="text-align:center">${g.participant_count}</td>
      <td>${escapeHTML(g.pic_name)}<br/><small>${escapeHTML(g.pic_wa)}</small></td>
      <td style="text-align:center"><b>${escapeHTML(STATUS_ID[g.status]||g.status)}</b></td>
    </tr>`;
  }).join("");

  // Statistik singkat — per pengajuan
  const total     = groups.length;
  const menunggu  = groups.filter(g => g.status === "Pending").length;
  const disetujui = groups.filter(g => g.status === "Approved").length;
  const ditolak   = groups.filter(g => g.status === "Rejected").length;

  w.document.write(`
    <!doctype html><html lang="id"><head>
    <meta charset="utf-8"/>
    <title>Rekap Peminjaman Ruangan</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:11pt;margin:24px;color:#111}
      .head{text-align:center;border-bottom:3px double #0A1628;padding-bottom:12px;margin-bottom:18px}
      .head h1{margin:0;font-size:16pt;color:#0A1628}
      .head h2{margin:2px 0 4px;font-size:14pt;color:#0A1628}
      .head p{margin:0;font-size:10pt;color:#444}
      .meta{display:flex;justify-content:space-between;font-size:10pt;color:#444;margin-bottom:10px}
      .stat{display:flex;gap:16px;margin:10px 0 14px;font-size:10pt;background:#F3F4F6;padding:8px 12px;border-radius:6px}
      .stat b{color:#0A1628}
      .intro{font-size:10.5pt;margin-bottom:10px;text-align:justify}
      table{width:100%;border-collapse:collapse;font-size:10pt}
      th,td{border:1px solid #555;padding:6px 8px;vertical-align:top}
      th{background:#0A1628;color:white;text-align:left;font-size:10pt}
      td small{color:#666;font-size:9pt}
      .footer{margin-top:30px;display:flex;justify-content:flex-end}
      .ttd{text-align:center;min-width:240px}
      .ttd p{margin:0}
      .ttd .sp{height:60px}
      @media print { body{margin:14mm} }
    </style></head><body>
    <div class="head">
      <p>PEMERINTAH KOTA TARAKAN</p>
      <h2>BAGIAN PROTOKOL & KOMUNIKASI PIMPINAN</h2>
      <p style="font-size:9pt">Sekretariat Daerah Kota Tarakan</p>
      <h1 style="margin-top:8px">REKAP PERMOHONAN PEMINJAMAN RUANGAN</h1>
    </div>
    <div class="meta">
      <span>Penyaringan data: <b>${escapeHTML(filterLabel)}</b></span>
      <span>Dicetak pada: ${today}</span>
    </div>
    <p class="intro">
      Berikut disampaikan rekapitulasi data permohonan peminjaman ruangan
      di lingkungan Bagian Protokol &amp; Komunikasi Pimpinan Setda Kota Tarakan.
      Data disajikan secara berurutan berdasarkan tanggal pelaksanaan kegiatan,
      mulai dari yang terdekat hingga yang terjauh.
    </p>
    <div class="stat">
      <span>Total permohonan: <b>${total}</b></span>
      <span>Menunggu konfirmasi: <b>${menunggu}</b></span>
      <span>Disetujui: <b>${disetujui}</b></span>
      <span>Ditolak: <b>${ditolak}</b></span>
    </div>
    <table>
      <thead><tr>
        <th style="width:32px">No.</th>
        <th>Kode</th>
        <th>Nama Acara / Instansi</th>
        <th>Ruangan</th>
        <th>Tanggal &amp; Sesi</th>
        <th style="width:60px">Peserta</th>
        <th>Penanggung Jawab</th>
        <th style="width:90px">Status</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:24px">Belum ada data permohonan pada periode ini.</td></tr>'}</tbody>
    </table>
    <p style="font-size:9.5pt;color:#555;margin-top:14px;font-style:italic">
      Demikian rekapitulasi ini disusun sebagai bahan monitoring dan dokumentasi
      penggunaan ruang rapat. Apabila terdapat ketidaksesuaian data, mohon segera
      menghubungi staf peninjau permohonan pada Bagian Protokol &amp; Komunikasi Pimpinan.
    </p>
    <div class="footer">
      <div class="ttd">
        <p>Tarakan, ${today.split(", ")[1]||today}</p>
        <p>Kepala Bagian Protokol &amp; Komunikasi Pimpinan,</p>
        <div class="sp"></div>
        <p><b><u>__________________________</u></b></p>
        <p>NIP. ___________________</p>
      </div>
    </div>
    <script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script>
    </body></html>
  `);
  w.document.close();
}

/** Cetak surat konfirmasi 1 booking */
function printSingleBooking(b, slots) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) { alert("Mohon izinkan popup untuk mencetak."); return; }
  // Tanggal surat = tanggal tahapan diproses (disetujui/ditolak/dibatalkan
  // pakai reviewed_at; masih menunggu pakai tanggal diajukan).
  const tglSumber = (b.status === "Pending" ? b.created_at : b.reviewed_at)
    || b.reviewed_at || b.created_at || Date.now();
  const today = new Date(tglSumber).toLocaleDateString("id-ID",{ day:"numeric", month:"long", year:"numeric" });
  const list = (slots && slots.length ? slots : [b])
    .slice().sort((x,y)=> x.start_date.localeCompare(y.start_date) || (SES_ORDER[x.session]||9)-(SES_ORDER[y.session]||9));
  const jadwalRows = list.map(s =>
    `<tr><td>${fmtTglFull(s.start_date)}</td><td>${escapeHTML(SESSION_TIME[s.session]||s.session)}</td></tr>`
  ).join("");

  const statusUpper = (STATUS_ID[b.status]||b.status).toUpperCase();

  w.document.write(`
    <!doctype html><html lang="id"><head>
    <meta charset="utf-8"/>
    <title>Konfirmasi Peminjaman ${escapeHTML(b.booking_code)}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:11pt;margin:28px;color:#111;line-height:1.55}
      .head{text-align:center;border-bottom:3px double #0A1628;padding-bottom:12px;margin-bottom:24px}
      .head h2{margin:2px 0 4px;font-size:14pt;color:#0A1628}
      .head p{margin:0;font-size:10pt;color:#444}
      .meta{margin-bottom:20px;display:flex;justify-content:space-between}
      .meta .code{font-family:monospace;font-size:14pt;font-weight:900;color:#0A1628;background:#FEF3C7;border:2px solid #C9A84C;padding:6px 14px;border-radius:8px;letter-spacing:2px}
      .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-weight:700;font-size:10pt}
      .approved{background:#D1FAE5;color:#065F46;border:1px solid #6EE7B7}
      .pending{background:#FEF3C7;color:#92400E;border:1px solid #FCD34D}
      .rejected{background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5}
      .cancelled{background:#F3F4F6;color:#374151;border:1px solid #D1D5DB}
      h1{font-size:14pt;text-align:center;margin:14px 0 20px;text-decoration:underline}
      .intro{text-align:justify;margin-bottom:14px}
      table{width:100%;border-collapse:collapse;margin:14px 0}
      td{padding:8px 10px;border-bottom:1px solid #E5E7EB;vertical-align:top;font-size:11pt}
      td.lbl{width:35%;color:#555;font-weight:600}
      .closing{margin-top:18px;text-align:justify}
      .footer{margin-top:34px;display:flex;justify-content:flex-end}
      .ttd{text-align:center;min-width:260px}
      .ttd .sp{height:72px}
      @media print { body{margin:16mm} }
    </style></head><body>
    <div class="head">
      <p>PEMERINTAH KOTA TARAKAN</p>
      <h2>BAGIAN PROTOKOL &amp; KOMUNIKASI PIMPINAN</h2>
      <p style="font-size:9pt">Sekretariat Daerah Kota Tarakan · prokopim.tarakankota.go.id</p>
    </div>

    <div class="meta">
      <div>
        <div style="font-size:9pt;color:#666">Kode Booking</div>
        <div class="code">${escapeHTML(b.booking_code)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:9pt;color:#666;margin-bottom:4px">Status Permohonan</div>
        <span class="badge ${b.status.toLowerCase()}">${statusUpper}</span>
      </div>
    </div>

    <h1>SURAT KONFIRMASI PEMINJAMAN RUANGAN</h1>

    <p class="intro">
      Sehubungan dengan permohonan peminjaman ruangan yang telah diajukan kepada
      Bagian Protokol &amp; Komunikasi Pimpinan Setda Kota Tarakan, dengan ini disampaikan
      rincian permohonan sebagai berikut:
    </p>

    <table>
      <tr><td class="lbl">Nama Acara / Kegiatan</td><td><b>${escapeHTML(b.event_name)}</b></td></tr>
      <tr><td class="lbl">Instansi / Pemohon</td><td>${escapeHTML(b.instansi)}</td></tr>
      <tr><td class="lbl">Penanggung Jawab (PIC)</td><td>${escapeHTML(b.pic_name)}</td></tr>
      <tr><td class="lbl">Nomor Kontak WhatsApp</td><td>${escapeHTML(b.pic_wa)}</td></tr>
      <tr><td class="lbl">Ruangan yang Dipinjam</td><td><b>${escapeHTML(b.rooms?.name||"-")}</b> (kapasitas ${b.rooms?.capacity||"-"} orang)</td></tr>
      <tr><td class="lbl">Jumlah Peserta</td><td>${b.participant_count} orang</td></tr>
      ${b.srikandi_ref ? `<tr><td class="lbl">Nomor Surat (Srikandi)</td><td>${escapeHTML(b.srikandi_ref)}</td></tr>` : ""}
      ${b.notes ? `<tr><td class="lbl">Catatan dari Peninjau Permohonan</td><td>${escapeHTML(b.notes)}</td></tr>` : ""}
    </table>
    <p style="margin:8px 0 4px;font-weight:600;color:#555">Jadwal Penggunaan (${list.length} slot):</p>
    <table><tr><td class="lbl">Tanggal</td><td class="lbl">Sesi / Waktu</td></tr>${jadwalRows}</table>

    ${b.status === "Approved" ? `
      <p class="closing">
        Berdasarkan ketersediaan ruangan dan kelengkapan administrasi, dengan ini
        permohonan peminjaman ruangan tersebut di atas dinyatakan <b>DISETUJUI</b>.
        Kepada pemohon diharapkan untuk memperhatikan ketentuan berikut:
      </p>
      <ol style="margin:6px 0 14px 22px">
        <li>Hadir tepat waktu sesuai jadwal yang telah ditentukan.</li>
        <li>Menjaga kebersihan, ketertiban, dan kerapian ruangan selama kegiatan berlangsung.</li>
        <li>Mengembalikan ruangan dalam kondisi semula setelah kegiatan selesai.</li>
        <li>Segera menghubungi staf Bagian Prokopim apabila terdapat perubahan jadwal atau pembatalan.</li>
        <li>Bertanggung jawab atas seluruh fasilitas yang digunakan selama peminjaman berlangsung.</li>
        <li>Peminjaman ruangan sewaktu-waktu dapat dibatalkan apabila terdapat pertemuan/kegiatan yang diinisiasi dan dilaksanakan oleh Kepala Daerah/Wakil Kepala Daerah.</li>
      </ol>
    ` : b.status === "Rejected" ? `
      <p class="closing">
        Setelah dilakukan verifikasi terhadap data permohonan dan ketersediaan ruangan,
        dengan ini permohonan peminjaman tersebut di atas dinyatakan <b>DITOLAK</b>.
        ${b.notes ? `Adapun alasan penolakan dapat dilihat pada bagian catatan di atas.` : ""}
        Pemohon dipersilakan untuk mengajukan permohonan baru dengan tanggal atau ruangan yang berbeda.
      </p>
    ` : b.status === "Cancelled" ? `
      <p class="closing">
        Permohonan peminjaman ruangan tersebut di atas telah <b>DIBATALKAN</b>.
        ${b.notes ? `Keterangan pembatalan tercantum pada bagian catatan di atas.` : ""}
      </p>
    ` : `
      <p class="closing">
        Permohonan peminjaman ruangan tersebut di atas saat ini berstatus
        <b>MENUNGGU KONFIRMASI</b> dari peninjau permohonan. Konfirmasi akan disampaikan melalui
        nomor WhatsApp pemohon paling lambat 1×24 jam sejak permohonan diajukan.
      </p>
    `}

    <p style="margin-top:14px;text-align:justify">
      Demikian konfirmasi ini disampaikan untuk dapat dipergunakan sebagaimana mestinya.
      Atas perhatian dan kerja samanya, diucapkan terima kasih.
    </p>

    <div class="footer">
      <div class="ttd">
        <p>Tarakan, ${today}</p>
        <p>Peninjau Permohonan,</p>
        <div class="sp"></div>
        <p><b><u>${escapeHTML(b.reviewed_by||"_____________________")}</u></b></p>
        <p style="font-size:9pt;color:#666">Bagian Prokopim Kota Tarakan</p>
      </div>
    </div>

    <script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script>
    </body></html>
  `);
  w.document.close();
}

// ── Admin Calendar View ───────────────────────────────────────

const DAYS_SHORT  = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
const MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function bookingsOnDate(bookings, roomId, dateStr, session) {
  return bookings.filter(b => {
    if (b.status === "Cancelled" || b.status === "Rejected") return false;
    if (b.room_id !== roomId) return false;
    if (b.start_date > dateStr || b.end_date < dateStr) return false;
    if (session === "Full_Day") return ["Pagi","Siang","Full_Day"].includes(b.session);
    if (session === "Pagi")     return ["Pagi","Full_Day"].includes(b.session);
    return ["Siang","Full_Day"].includes(b.session);
  });
}

function AdminCalendar({ bookings, rooms, year, month, roomFilter, onBookingClick }) {
  const firstOfMonth = new Date(year, month-1, 1);
  const daysInMonth  = new Date(year, month, 0).getDate();
  const startDow     = firstOfMonth.getDay();
  const today        = new Date().toISOString().slice(0,10);

  const cells = [];
  for (let i=0;i<startDow;i++) cells.push(null);
  for (let d=1;d<=daysInMonth;d++)
    cells.push(`${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`);

  const filteredRooms = roomFilter
    ? rooms.filter(r => r.id === Number(roomFilter))
    : rooms;

  const colorFor = (status) => {
    if (status === "Approved") return { bg:"#FEE2E2", border:"#FCA5A5", text:"#991B1B" };
    if (status === "Pending")  return { bg:"#FEF3C7", border:"#FCD34D", text:"#92400E" };
    return { bg:"#F3F4F6", border:"#D1D5DB", text:"#374151" };
  };

  // Chip sesi ringkas — hanya label sesi; detail (judul + instansi) tampil saat
  // hover (title) atau klik (buka detail). Menjaga sel kalender tetap seragam.
  const SessionChip = (label, list) => {
    if (!list.length) return null;
    const c = colorFor(list.some(b => b.status === "Approved") ? "Approved" : "Pending");
    // Label chip = nama instansi peminjam (fallback PIC/nama acara). Sesi & detail
    // lengkap tetap tampil saat hover/klik.
    const nama = list[0].instansi || list[0].pic_name || list[0].event_name || label;
    const titleText = list
      .map(b => `${label} — ${b.instansi || "-"} · ${b.event_name} (${b.status === "Approved" ? "Disetujui" : "Menunggu"})`)
      .join("\n");
    return (
      <button type="button" onClick={() => onBookingClick(list[0])} title={titleText}
        style={{
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:4,
          width:"100%", minWidth:0, background:c.bg, color:c.text,
          border:`1px solid ${c.border}`, borderRadius:5, padding:"3px 6px",
          fontSize:9.5, fontWeight:700, cursor:"pointer", lineHeight:1.25,
        }}>
        <span style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{nama}</span>
        {list.length > 1 && <span style={{flexShrink:0, opacity:0.75}}>×{list.length}</span>}
      </button>
    );
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      {filteredRooms.map(room => (
        <div key={room.id}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{background:NAVY,color:"white",borderRadius:9,padding:"5px 14px",fontSize:13,fontWeight:800}}>
              {room.name}
            </div>
            <div style={{background:"#F3F4F6",color:GRAY,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600}}>
              Kapasitas {room.capacity}
            </div>
          </div>
          <div style={{overflowX:"auto"}}>
            <div style={{minWidth:700}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4}}>
                {DAYS_SHORT.map(d => (
                  <div key={d} style={{textAlign:"center",fontSize:11,fontWeight:700,color:GRAY,padding:"3px 0"}}>{d}</div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
                {cells.map((dateStr,i) => {
                  if (!dateStr) return <div key={i}/>;
                  const isToday = dateStr === today;
                  const isPast  = dateStr < today;
                  const pagi  = bookingsOnDate(bookings, room.id, dateStr, "Pagi");
                  const siang = bookingsOnDate(bookings, room.id, dateStr, "Siang");
                  return (
                    <div key={dateStr} style={{
                      border:`2px solid ${isToday?GOLD:"#E5E7EB"}`,
                      borderRadius:8,padding:"5px 4px",height:82,minWidth:0,
                      background:isPast?"#FAFAFA":"white",
                      opacity:isPast?0.6:1,
                      display:"flex",flexDirection:"column",gap:3,overflow:"hidden",
                    }}>
                      <div style={{
                        fontSize:12,fontWeight:isToday?900:600,
                        color:isToday?NAVY:"#374151",textAlign:"center",flexShrink:0,
                      }}>{parseInt(dateStr.slice(8))}</div>

                      {/* Chip sesi ringkas — detail muncul saat hover/klik */}
                      {SessionChip("Pagi", pagi)}
                      {SessionChip("Siang", siang)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Legend */}
      <div style={{
        display:"flex",gap:14,flexWrap:"wrap",
        background:"#F9FAFB",borderRadius:10,padding:"10px 14px",fontSize:12,
      }}>
        <span style={{fontWeight:700,color:GRAY}}>Keterangan:</span>
        {[
          { label:"Disetujui", bg:"#FEE2E2", border:"#FCA5A5" },
          { label:"Menunggu",  bg:"#FEF3C7", border:"#FCD34D" },
        ].map(c => (
          <div key={c.label} style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:24,height:12,borderRadius:3,background:c.bg,border:`1px solid ${c.border}`}}/>
            <span style={{color:"#374151"}}>{c.label}</span>
          </div>
        ))}
        <span style={{color:GRAY}}>Klik kotak booking untuk lihat detail.</span>
      </div>
    </div>
  );
}

// ── Booking Detail Popover ────────────────────────────────────
function BookingDetailModal({ booking, slots, onClose, onAction }) {
  if (!booking) return null;
  const cfg = STATUS_CFG[booking.status] || STATUS_CFG.Pending;
  const allSlots = (slots && slots.length ? slots : [booking])
    .slice().sort((a,b)=> a.start_date.localeCompare(b.start_date) || (SES_ORDER[a.session]||9)-(SES_ORDER[b.session]||9));

  return (
    <div style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",
      display:"flex",alignItems:"center",justifyContent:"center",
      zIndex:9999,padding:16,
    }} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{
        background:"white",borderRadius:16,padding:0,
        maxWidth:520,width:"100%",maxHeight:"90vh",overflowY:"auto",
        boxShadow:"0 20px 60px rgba(0,0,0,0.3)",
      }}>
        {/* Header */}
        <div style={{
          padding:"18px 22px",borderBottom:"1px solid #F3F4F6",
          display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,
        }}>
          <div>
            <div style={{fontFamily:"monospace",fontWeight:900,color:NAVY,fontSize:15,letterSpacing:1}}>
              {booking.booking_code}
            </div>
            <div style={{fontWeight:800,fontSize:16,color:"#111827",marginTop:3}}>
              {booking.event_name}
            </div>
          </div>
          <button onClick={onClose} style={{
            width:30,height:30,borderRadius:7,border:"none",
            background:"#F3F4F6",cursor:"pointer",fontSize:18,
          }}>×</button>
        </div>

        {/* Status badge */}
        <div style={{padding:"12px 22px 0"}}>
          <span style={{
            padding:"5px 12px",borderRadius:20,
            background:cfg.bg,color:cfg.color,
            fontSize:12,fontWeight:700,
          }}>{cfg.label}</span>
        </div>

        {/* Detail grid */}
        <div style={{padding:"14px 22px 18px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 16px",fontSize:13}}>
          <div><div style={{color:GRAY,fontSize:11,fontWeight:600}}>Ruangan</div><b>{booking.rooms?.name}</b></div>
          <div><div style={{color:GRAY,fontSize:11,fontWeight:600}}>Peserta</div>{booking.participant_count} orang</div>
          <div style={{gridColumn:"1/-1"}}>
            <div style={{color:GRAY,fontSize:11,fontWeight:600,marginBottom:5}}>Jadwal ({allSlots.length} slot)</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {allSlots.map(s=>{ const si=SESSION_INFO[s.session]||{}; return (
                <span key={s.id||s.start_date+s.session} style={{fontSize:12,background:"#F8FAFC",border:"1px solid #E5E7EB",borderRadius:8,padding:"5px 9px"}}>
                  <b>{formatTgl(s.start_date)}</b> · <span style={{color:si.color,fontWeight:700}}>{si.label}</span>
                </span>
              ); })}
            </div>
          </div>
          <div style={{gridColumn:"1/-1"}}><div style={{color:GRAY,fontSize:11,fontWeight:600}}>Instansi</div>{booking.instansi}</div>
          <div><div style={{color:GRAY,fontSize:11,fontWeight:600}}>PIC</div>{booking.pic_name}</div>
          <div><div style={{color:GRAY,fontSize:11,fontWeight:600}}>WhatsApp</div>{booking.pic_wa}</div>
          {booking.srikandi_ref && (
            <div style={{gridColumn:"1/-1"}}>
              <div style={{color:GRAY,fontSize:11,fontWeight:600}}>No. Srikandi</div>
              <b style={{color:NAVY}}>{booking.srikandi_ref}</b>
            </div>
          )}
          {booking.document_path && (
            <div style={{gridColumn:"1/-1"}}>
              <div style={{color:GRAY,fontSize:11,fontWeight:600}}>Surat</div>
              <a href={booking.document_path} target="_blank" rel="noopener noreferrer"
                style={{color:"#2563EB",fontWeight:700,textDecoration:"none"}}>
                Lihat / Unduh Dokumen ↗
              </a>
            </div>
          )}
          {booking.notes && (
            <div style={{gridColumn:"1/-1"}}>
              <div style={{color:GRAY,fontSize:11,fontWeight:600}}>Catatan</div>
              <div style={{color:booking.status==="Rejected"?RED:"#374151"}}>{booking.notes}</div>
            </div>
          )}
          <div style={{gridColumn:"1/-1",fontSize:11,color:GRAY,paddingTop:8,borderTop:"1px solid #F3F4F6"}}>
            Diajukan: {formatTgl(booking.created_at)}
            {booking.reviewed_by && <span> · Direview: {booking.reviewed_by}</span>}
          </div>
        </div>

        {allSlots.length > 1 && (
          <div style={{
            margin:"0 22px 12px", background:"#EFF6FF", border:"1px solid #BFDBFE",
            color:"#1D4ED8", borderRadius:8, padding:"9px 12px", fontSize:12, fontWeight:600,
          }}>
            ⓘ Pengajuan ini berisi <b>{allSlots.length} slot</b>. Menyetujui/menolak/membatalkan
            berlaku untuk seluruh slot sekaligus.
          </div>
        )}

        {/* Action buttons */}
        <div style={{padding:"0 22px 18px",display:"flex",gap:8,flexWrap:"wrap"}}>
          {booking.status === "Pending" && (
            <>
              <button onClick={()=>{onAction(booking,"Approved");onClose();}}
                style={{padding:"9px 18px",borderRadius:9,border:"none",
                  background:GREEN,color:"white",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                ✓ Setujui
              </button>
              <button onClick={()=>{onAction(booking,"Rejected");onClose();}}
                style={{padding:"9px 18px",borderRadius:9,border:"none",
                  background:RED,color:"white",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                ✕ Tolak
              </button>
              <button onClick={()=>{onAction(booking,"Cancelled");onClose();}}
                style={{padding:"9px 18px",borderRadius:9,border:`1.5px solid #D1D5DB`,
                  background:"white",color:"#374151",fontWeight:600,fontSize:13,cursor:"pointer"}}>
                Batalkan
              </button>
            </>
          )}
          <button onClick={()=>printSingleBooking(booking, allSlots)}
            style={{padding:"9px 18px",borderRadius:9,border:`1.5px solid ${NAVY}`,
              background:"white",color:NAVY,fontWeight:700,fontSize:13,cursor:"pointer",
              marginLeft:"auto"}}>
            🖨️ Cetak Surat
          </button>
        </div>
      </div>
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
  const [authErr, setAuthErr]     = useState("");

  // Filter state
  const [filterStatus, setFilterStatus] = useState("Pending");
  const [filterRoom, setFilterRoom]     = useState("");

  // View mode: 'list' | 'calendar'
  const [viewMode, setViewMode] = useState("list");
  const now = new Date();
  const [calYear, setCalYear]   = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth()+1);
  const [calRoom, setCalRoom]   = useState(""); // "" = semua
  const [calBooking, setCalBooking] = useState(null); // popover detail

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, rR] = await Promise.all([
        adminFetch(user, `/api/room-booking?admin=1`),
        fetch("/api/room-booking?op=rooms").then(r => r.json()),
      ]);
      const bR = await bRes.json().catch(() => ({}));
      if (!bRes.ok) throw new Error(bR.error || "Akses ditolak.");
      setBookings(Array.isArray(bR) ? bR : []);
      setRooms(Array.isArray(rR) ? rR : []);
      setAuthErr("");
    } catch (e) {
      clearAdminToken();
      setBookings([]);
      setAuthErr(e.message || "Gagal memuat data peninjau permohonan.");
    }
    setLoading(false);
  }, [user]);

  // Kelompokkan per pengajuan (1 booking_code = 1 pengajuan, banyak slot)
  const allGroups = useMemo(() => groupByCode(bookings), [bookings]);
  const filteredGroups = useMemo(() => allGroups.filter(g => {
    if (filterStatus && g.status !== filterStatus) return false;
    if (filterRoom && g.room_id !== Number(filterRoom)) return false;
    // Tanpa filter status eksplisit: sembunyikan Cancelled/Rejected
    // yang lebih lama dari 60 hari (Pending/Approved selalu tampil).
    if (!filterStatus && (g.status === "Cancelled" || g.status === "Rejected")
        && daysSince(g.created_at) > 60) return false;
    return true;
  }), [allGroups, filterStatus, filterRoom]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const handleAction = (booking, action) => {
    // Pastikan modal selalu punya seluruh slot grup (dari kalender = 1 baris)
    const slots = booking.slots
      || bookings.filter(x => x.booking_code === booking.booking_code);
    setModal({ booking: { ...booking, slots }, action });
  };

  const handleConfirm = async (action, notes) => {
    if (!modal) return;
    setProcessing(true);
    try {
      const r = await adminFetch(user, "/api/room-booking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_code: modal.booking.booking_code, status: action, notes }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      const actionLabel = { Approved: "disetujui", Rejected: "ditolak", Cancelled: "dibatalkan" }[action] || action;
      showToast(`Pengajuan ${modal.booking.booking_code} (${data.count||1} slot) berhasil ${actionLabel}`);
      setModal(null);
      loadBookings();
    } catch (e) {
      showToast("Gagal: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  // Stats — dihitung per PENGAJUAN, bukan per baris slot
  const pending   = allGroups.filter(g => g.status === "Pending").length;
  const approved  = allGroups.filter(g => g.status === "Approved").length;
  const slaAlert  = allGroups.filter(g => g.status === "Pending" && daysSince(g.created_at) >= 1).length;

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

        {authErr && (
          <div style={{
            background: "#FEF2F2", border: "1.5px solid #FCA5A5", color: "#991B1B",
            borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          }}>
            <span>⚠ {authErr} Sesi peninjau permohonan perlu diverifikasi ulang.</span>
            <button onClick={() => { clearAdminToken(); loadBookings(); }}
              style={{
                padding: "7px 14px", borderRadius: 8, border: "none",
                background: "#991B1B", color: "white", fontWeight: 700,
                fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
              }}>
              Coba Lagi
            </button>
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Menunggu (pengajuan)", value: pending, color: YELLOW, bg: "#FEF3C7", icon: "⏳" },
            { label: "Disetujui (pengajuan)", value: approved, color: GREEN, bg: "#D1FAE5", icon: "✓" },
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

        {/* View mode toggle */}
        <div style={{
          display:"flex",gap:4,background:"#F3F4F6",borderRadius:10,padding:4,marginBottom:14,
        }}>
          {[
            { k:"list",     icon:"📋", label:"Daftar" },
            { k:"calendar", icon:"📅", label:"Kalender" },
          ].map(({k,icon,label})=>(
            <button key={k} onClick={()=>setViewMode(k)}
              style={{
                flex:1,padding:"9px",borderRadius:7,border:"none",cursor:"pointer",
                fontSize:13,fontWeight:700,
                background:viewMode===k?"white":"transparent",
                color:viewMode===k?NAVY:GRAY,
                boxShadow:viewMode===k?"0 1px 4px rgba(0,0,0,0.12)":undefined,
                display:"flex",alignItems:"center",justifyContent:"center",gap:6,
              }}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {viewMode === "list" && (
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
          )}

          <select value={viewMode === "calendar" ? calRoom : filterRoom}
            onChange={e => viewMode === "calendar" ? setCalRoom(e.target.value) : setFilterRoom(e.target.value)}
            style={{
              padding: "8px 12px", borderRadius: 8, border: "1.5px solid #D1D5DB",
              fontSize: 13, outline: "none", background: "white",
            }}>
            <option value="">Semua Ruangan</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          {viewMode === "calendar" && (
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              <button onClick={()=>{ if(calMonth===1){setCalYear(y=>y-1);setCalMonth(12);}else setCalMonth(m=>m-1); }}
                style={{padding:"8px 12px",borderRadius:8,border:"1.5px solid #D1D5DB",background:"white",cursor:"pointer",fontSize:13}}>‹</button>
              <div style={{padding:"8px 12px",fontWeight:700,fontSize:13,color:NAVY,minWidth:130,textAlign:"center"}}>
                {MONTH_NAMES[calMonth-1]} {calYear}
              </div>
              <button onClick={()=>{ if(calMonth===12){setCalYear(y=>y+1);setCalMonth(1);}else setCalMonth(m=>m+1); }}
                style={{padding:"8px 12px",borderRadius:8,border:"1.5px solid #D1D5DB",background:"white",cursor:"pointer",fontSize:13}}>›</button>
            </div>
          )}

          <button onClick={loadBookings}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "1.5px solid #D1D5DB",
              background: "white", cursor: "pointer", fontSize: 13, color: "#374151",
            }}>
            ↻ Refresh
          </button>

          <button onClick={() => {
              const dataToPrint = viewMode === "calendar"
                ? bookings.filter(b => !calRoom || b.room_id === Number(calRoom))
                : filteredGroups.flatMap(g => g.slots);
              const label = [
                viewMode === "list" ? (filterStatus || "Semua status") : `Bulan ${MONTH_NAMES[calMonth-1]} ${calYear}`,
                (viewMode === "calendar" ? calRoom : filterRoom)
                  ? rooms.find(r => r.id === Number(viewMode === "calendar" ? calRoom : filterRoom))?.name
                  : "Semua ruangan",
              ].filter(Boolean).join(" · ");
              printBookingList(dataToPrint, label);
            }}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "none",
              background: NAVY, color: "white",
              cursor: "pointer", fontSize: 13, fontWeight: 700,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}>
            🖨️ Cetak PDF
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

        {/* Konten — list atau calendar */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: GRAY }}>Memuat data...</div>
        ) : viewMode === "calendar" ? (
          <div style={{
            background:"white",borderRadius:14,padding:"18px 16px",
            border:"1.5px solid #E5E7EB",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",
          }}>
            <AdminCalendar
              bookings={bookings}
              rooms={rooms}
              year={calYear}
              month={calMonth}
              roomFilter={calRoom}
              onBookingClick={setCalBooking}
            />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div style={{
            textAlign: "center", padding: 40,
            background: "white", borderRadius: 14, border: "1.5px solid #E5E7EB",
            color: GRAY, fontSize: 14,
          }}>
            Tidak ada permohonan ditemukan.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredGroups.map(g => (
              <BookingRow key={g.booking_code} booking={g} onAction={handleAction} isMobile={isMobile} />
            ))}
          </div>
        )}

        {/* Booking detail modal (dari kalender) */}
        {calBooking && (
          <BookingDetailModal
            booking={calBooking}
            slots={bookings.filter(x => x.booking_code === calBooking.booking_code)}
            onClose={()=>setCalBooking(null)}
            onAction={handleAction}
          />
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
