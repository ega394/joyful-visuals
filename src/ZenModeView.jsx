// ============================================================
// FILE: src/ZenModeView.jsx  ← BARU
// IMPORT DI: src/ProkopimApp.jsx
//   1. Tambah di atas: import ZenModeView from "./ZenModeView";
//   2. Ganti kondisi render /* 10. Pimpinan View */ menjadi:
//
//   :tab==="jadwal"&&(role==="walikota"||role==="wakilwalikota")
//     ?<ZenModeView events={events} role={role} user={user}/>
//
//   :tab==="jadwal"
//     ?<PimpinanView .../>  ← sisanya tetap
//
// FUNGSI: Tampilan "Zen Mode" khusus Wali Kota & Wakil Wali Kota
//   - 1 kartu besar: agenda BERIKUTNYA (jam, lokasi, pimpinan)
//   - Sisa agenda: list ringkas di bawah
//   - Tanpa tombol edit / approve / form apapun
//   - Dynamic color: merah <1j, kuning <3j, biru >3j
// ============================================================

import React, { useState, useEffect } from "react";

// ── Helper: hitung menit sampai acara ──────────────────────
function menitLagi(tanggal, jam) {
  const now = new Date();
  const target = new Date(tanggal + "T" + jam + ":00");
  return Math.round((target - now) / 60000);
}

// ── Helper: warna dinamis berdasarkan jarak waktu ──────────
// Ini adalah "Dynamic Theming" yang diminta di Tugas 5
function getTimeColor(menit) {
  if (menit < 0)   return { bg: "#F1F5F9", border: "#CBD5E1", accent: "#94A3B8", label: "Selesai",   emoji: "✅" };
  if (menit < 60)  return { bg: "#FEF2F2", border: "#FCA5A5", accent: "#DC2626", label: "Segera",    emoji: "🔴" };
  if (menit < 180) return { bg: "#FFFBEB", border: "#FCD34D", accent: "#D97706", label: "Mendekati", emoji: "🟡" };
  if (menit < 480) return { bg: "#EFF6FF", border: "#93C5FD", accent: "#2563EB", label: "Hari Ini",  emoji: "🔵" };
  return             { bg: "#F0FDF4", border: "#86EFAC", accent: "#059669", label: "Besok",    emoji: "🟢" };
}

// ── Helper: format jam countdown ──────────────────────────
function formatSisa(menit) {
  if (menit < 0)   return "Sudah selesai";
  if (menit < 60)  return menit + " menit lagi";
  if (menit < 120) return "1 jam " + (menit % 60 > 0 ? (menit % 60) + " menit" : "") + " lagi";
  return Math.floor(menit / 60) + " jam lagi";
}

// ── Helper: nama hari + tanggal ────────────────────────────
function formatTanggal(tgl) {
  if (!tgl) return "";
  return new Date(tgl + "T00:00:00").toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long"
  });
}

// ── Skeleton Loader ────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="skeleton-card" style={{
      background: "white", borderRadius: 20, padding: 24, marginBottom: 16,
      boxShadow: "0 4px 24px rgba(10,22,40,0.08)"
    }}>
      <div className="skeleton" style={{ height: 12, width: "40%", borderRadius: 6, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 22, width: "75%", borderRadius: 6, marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 16, width: "55%", borderRadius: 6, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 16, width: "45%", borderRadius: 6 }} />
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────
function EmptyState({ role }) {
  const isWK = role === "walikota";
  return (
    <div style={{
      textAlign: "center", padding: "60px 32px",
      background: "white", borderRadius: 24,
      boxShadow: "0 4px 24px rgba(10,22,40,0.07)"
    }}>
      {/* Ilustrasi SVG minimalis */}
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ marginBottom: 20 }}>
        <circle cx="40" cy="40" r="36" fill="#F0F4FA" />
        <rect x="22" y="28" width="36" height="4" rx="2" fill="#CBD5E1" />
        <rect x="22" y="36" width="24" height="4" rx="2" fill="#E2E8F0" />
        <rect x="22" y="44" width="28" height="4" rx="2" fill="#E2E8F0" />
        <circle cx="56" cy="52" r="12" fill="#0A1628" />
        <path d="M50 52l4 4 6-6" stroke="#D4AF5A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#0A1628", marginBottom: 8 }}>
        Tidak Ada Agenda
      </div>
      <div style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.7 }}>
        Tidak ada agenda yang terjadwal untuk{" "}
        <strong style={{ color: "#0A1628" }}>
          {isWK ? "Bapak Wali Kota" : "Bapak Wakil Wali Kota"}
        </strong>{" "}
        hari ini dan besok.
        <br />Selamat beristirahat 🌿
      </div>
    </div>
  );
}

// ── Kartu Utama (agenda berikutnya — 1 kartu besar) ────────
function HeroCard({ ev, role }) {
  const menit = menitLagi(ev.tanggal, ev.jam);
  const color = getTimeColor(menit);
  const isWK  = role === "walikota";

  // Konfirmasi kehadiran pimpinan
  const statusKehadiran = isWK ? ev.statusWK : ev.statusWWK;
  const labelStatus = statusKehadiran === "hadir" ? "✅ Hadir"
    : statusKehadiran === "tidak_hadir" ? "❌ Tidak Hadir"
    : statusKehadiran === "diwakilkan"
      ? ("🔄 " + (isWK ? ev.perwakilanWK || "Diwakilkan" : ev.perwakilanWWK || "Diwakilkan"))
    : ev.delegasiKeWWK && isWK ? "↩️ Delegasi ke WWK"
    : "⏳ Belum dikonfirmasi";

  return (
    <div style={{
      background: color.bg,
      border: "2px solid " + color.border,
      borderRadius: 24,
      padding: 24,
      marginBottom: 16,
      position: "relative",
      overflow: "hidden",
      boxShadow: "0 8px 32px rgba(10,22,40,0.10)",
      transition: "all 0.4s ease",
    }}>
      {/* Label waktu di pojok kanan atas */}
      <div style={{
        position: "absolute", top: 16, right: 16,
        background: color.accent, color: "white",
        borderRadius: 20, padding: "4px 12px",
        fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
      }}>
        {color.emoji} {color.label}
      </div>

      {/* Tanggal */}
      <div style={{ fontSize: 12, color: color.accent, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>
        {formatTanggal(ev.tanggal)}
      </div>

      {/* Jam — besar */}
      <div style={{ fontSize: 48, fontWeight: 900, color: "#0A1628", lineHeight: 1, marginBottom: 8, fontVariantNumeric: "tabular-nums" }}>
        {ev.jam} <span style={{ fontSize: 16, fontWeight: 600, color: "#94A3B8" }}>WITA</span>
      </div>

      {/* Nama acara */}
      <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", marginBottom: 10, lineHeight: 1.4 }}>
        {ev.namaAcara}
      </div>

      {/* Penyelenggara + Lokasi */}
      {ev.penyelenggara && (
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <span>🏢</span> {ev.penyelenggara}
        </div>
      )}
      {ev.lokasi && (
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span>📍</span> {ev.lokasi}
        </div>
      )}

      {/* Pakaian */}
      {ev.pakaian && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "white", border: "1px solid " + color.border, borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#475569", marginBottom: 10 }}>
          👔 {ev.pakaian}
        </div>
      )}

      {/* Status kehadiran */}
      <div style={{
        background: "white", borderRadius: 12, padding: "10px 14px",
        border: "1px solid " + color.border,
        fontSize: 13, fontWeight: 700,
        color: statusKehadiran === "hadir" ? "#065F46"
          : statusKehadiran === "tidak_hadir" ? "#991B1B" : "#92400E",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        {labelStatus}
      </div>

      {/* Countdown */}
      {menit >= 0 && (
        <div style={{ marginTop: 12, fontSize: 13, color: color.accent, fontWeight: 700, textAlign: "right" }}>
          ⏱ {formatSisa(menit)}
        </div>
      )}
    </div>
  );
}

// ── Kartu Mini (agenda lainnya — diperkecil) ───────────────
function MiniCard({ ev, role }) {
  const menit = menitLagi(ev.tanggal, ev.jam);
  const color = getTimeColor(menit);
  return (
    <div style={{
      background: "white",
      border: "1.5px solid " + color.border,
      borderLeft: "4px solid " + color.accent,
      borderRadius: 12,
      padding: "10px 14px",
      marginBottom: 8,
      display: "flex",
      alignItems: "center",
      gap: 12,
      opacity: menit < 0 ? 0.5 : 1,
    }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: "#0A1628", minWidth: 50, fontVariantNumeric: "tabular-nums" }}>
        {ev.jam}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ev.namaAcara}
        </div>
        {ev.lokasi && (
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📍 {ev.lokasi}
          </div>
        )}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: color.accent, flexShrink: 0 }}>
        {color.emoji}
      </div>
    </div>
  );
}

// ── Komponen Utama ─────────────────────────────────────────
export default function ZenModeView({ events, role, user }) {
  const [loading, setLoading] = useState(true);
  const now = new Date();

  useEffect(() => {
    // Simulasi loading data — di real app ini akan tunggu fetch selesai
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  // Filter events untuk pimpinan ini
  const myEvs = events
    .filter(e => {
      if (e.alur !== "disetujui") return false;
      if (role === "walikota") return e.untukPimpinan?.includes("walikota");
      if (role === "wakilwalikota") return e.untukPimpinan?.includes("wakilwalikota") || e.delegasiKeWWK;
      return false;
    })
    .sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam));

  // Pisahkan: akan datang vs lampau
  const upcoming = myEvs.filter(e => menitLagi(e.tanggal, e.jam) >= -30);
  const past     = myEvs.filter(e => menitLagi(e.tanggal, e.jam) < -30);

  // Agenda utama = yang paling dekat waktunya
  const hero   = upcoming[0] || null;
  const others = upcoming.slice(1);

  const isWK   = role === "walikota";
  const nama   = user?.nama || (isWK ? "Bapak Wali Kota" : "Bapak Wakil Wali Kota");
  const sapaan = (() => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 18) return "Selamat sore";
    return "Selamat malam";
  })();

  if (loading) {
    return (
      <div style={{ padding: "0 0 32px" }}>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 32px" }}>

      {/* Sapaan */}
      <div style={{ marginBottom: 20, paddingTop: 4 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 2 }}>
          {sapaan},
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "white", lineHeight: 1.2 }}>
          {nama.split(" ").slice(0, 3).join(" ")}
        </div>
      </div>

      {/* Tidak ada agenda */}
      {myEvs.length === 0 && <EmptyState role={role} />}

      {/* Hero card — agenda berikutnya */}
      {hero && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Agenda Berikutnya
          </div>
          <HeroCard ev={hero} role={role} />
        </>
      )}

      {/* Agenda lainnya hari ini / besok */}
      {others.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, marginTop: 8 }}>
            Agenda Lainnya ({others.length})
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 12 }}>
            {others.map(ev => <MiniCard key={ev.id} ev={ev} role={role} />)}
          </div>
        </>
      )}

      {/* Agenda lampau (hari ini yang sudah selesai) */}
      {past.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 20 }}>
            Sudah Selesai Hari Ini
          </div>
          <div style={{ opacity: 0.5 }}>
            {past.map(ev => <MiniCard key={ev.id} ev={ev} role={role} />)}
          </div>
        </>
      )}
    </div>
  );
}
