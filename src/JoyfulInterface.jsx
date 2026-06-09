// ============================================================
// FILE: src/JoyfulInterface.jsx  ← FILE BARU
// TUGAS 5: Role-based "Joyful" Interface
//
// Berisi:
//   1. ZenModeView      → Walikota & Wakil Wali Kota (mode tenang)
//   2. AjudanView       → Ajudan WK & WWK (mode aksi cepat)
//   3. useDynamicTheme  → Hook warna kartu berdasarkan waktu
//   4. EmptyState       → Tampilan estetik saat jadwal kosong
//   5. SkeletonLoader   → Animasi loading saat fetch data API
//
// CARA PAKAI di ProkopimApp.jsx:
//   1. Tambah import di atas file:
//      import { ZenModeView, AjudanView, SkeletonLoader, EmptyState } from "./JoyfulInterface.jsx";
//
//   2. Cari baris (sekitar 7037):
//      ?<PimpinanView events={events} role={role} .../>
//
//   3. Ganti dengan:
//      ?(role==="walikota"||role==="wakilwalikota")
//        ?<ZenModeView events={events} role={role} user={user} upd={upd} showT={showT} isMobile={isMobile} setDelegTarget={setDelegTarget}/>
//      :(role==="ajudan_walikota"||role==="ajudan_wakilwalikota")
//        ?<AjudanView events={events} role={role} user={user} upd={upd} showT={showT} isMobile={isMobile}/>
//      :<PimpinanView events={events} role={role} user={user} upd={upd} showT={showT} isMobile={isMobile} setDelegTarget={setDelegTarget} initialExpandedId={pendingExpandTarget} onExpandConsumed={()=>setPendingExpandTarget(null)}/>
// ============================================================

import React, { useState, useEffect, useRef, useMemo } from "react";

// ── Warna tema ───────────────────────────────────────────────
const NAVY    = "#0A1628";
const GOLD    = "#C9A84C";
const GREEN   = "#0D6B4F";

// ── Helper: format jam & tanggal ────────────────────────────
const HARI_ID = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const BULAN   = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function fmtJam(str)  { return str || "--:--"; }
function fmtTgl(str) {
  if (!str) return "--";
  const d = new Date(str + "T00:00:00");
  return HARI_ID[d.getDay()] + ", " + d.getDate() + " " + BULAN[d.getMonth()];
}
function localDateStr(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}


// ════════════════════════════════════════════════════════════
// HOOK: useDynamicTheme
// Mengembalikan warna kartu berdasarkan jarak waktu acara
// ════════════════════════════════════════════════════════════
export function useDynamicTheme(tanggal, jam) {
  const [theme, setTheme] = useState(getTheme(tanggal, jam));

  useEffect(() => {
    const interval = setInterval(() => {
      setTheme(getTheme(tanggal, jam));
    }, 30_000); // update setiap 30 detik
    return () => clearInterval(interval);
  }, [tanggal, jam]);

  return theme;
}

function getTheme(tanggal, jam) {
  if (!tanggal || !jam) return THEMES.future;
  const evTime = new Date(tanggal + "T" + jam);
  const now    = new Date();
  const diffMs = evTime - now;
  const diffH  = diffMs / (1000 * 60 * 60);

  if (diffMs < 0)         return THEMES.past;       // sudah lewat
  if (diffH <= 0.5)       return THEMES.imminent;   // < 30 menit → merah darurat
  if (diffH <= 1.5)       return THEMES.urgent;     // < 1.5 jam  → oranye
  if (diffH <= 3)         return THEMES.soon;       // < 3 jam    → kuning
  if (tanggal === localDateStr()) return THEMES.today; // hari ini  → biru navy
  return THEMES.future;                               // mendatang  → abu netral
}

const THEMES = {
  past:     { card: "#F8FAFC", border: "#E2E8F0", strip: "#94A3B8", stripText: "#F8FAFC", label: "Selesai",       icon: "✓" },
  future:   { card: "#FFFFFF", border: "#E4EAF2", strip: NAVY,      stripText: GOLD,      label: "",              icon: "📅" },
  today:    { card: "#FFFFFF", border: GOLD,      strip: NAVY,      stripText: GOLD,      label: "Hari Ini",      icon: "📅" },
  soon:     { card: "#FFFDF0", border: "#FDE68A", strip: "#D97706", stripText: "#FFFDF0", label: "3 Jam Lagi",    icon: "⏰" },
  urgent:   { card: "#FFF7ED", border: "#FCA5A5", strip: "#EA580C", stripText: "#FFF7ED", label: "Segera!",       icon: "⚡" },
  imminent: { card: "#FEF2F2", border: "#EF4444", strip: "#DC2626", stripText: "#FEF2F2", label: "SEKARANG!",     icon: "🔴" },
};


// ════════════════════════════════════════════════════════════
// KOMPONEN: EmptyState
// Tampil saat tidak ada jadwal
// ════════════════════════════════════════════════════════════
export function EmptyState({ message, sub, icon }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "56px 24px", textAlign: "center",
    }}>
      {/* Lingkaran dekoratif */}
      <div style={{
        position: "relative", width: 100, height: 100,
        marginBottom: 20,
      }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(201,168,76,0.12), rgba(10,22,40,0.06))",
          animation: "prokopim-pulse 3s ease infinite",
        }}/>
        <div style={{
          position: "absolute", inset: 12, borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(201,168,76,0.18), rgba(10,22,40,0.1))",
        }}/>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 38,
        }}>
          {icon || "📭"}
        </div>
      </div>

      <div style={{
        fontSize: 17, fontWeight: 800, color: NAVY,
        marginBottom: 8, letterSpacing: -0.3,
      }}>
        {message || "Tidak ada agenda"}
      </div>
      <div style={{
        fontSize: 13, color: "#94A3B8", maxWidth: 260,
        lineHeight: 1.6,
      }}>
        {sub || "Jadwal akan muncul di sini setelah disetujui."}
      </div>

      {/* Garis dekoratif */}
      <div style={{
        marginTop: 28, display: "flex", gap: 6, alignItems: "center",
      }}>
        {[16, 8, 4].map((w, i) => (
          <div key={i} style={{
            width: w, height: 3, borderRadius: 99,
            background: i === 0
              ? "linear-gradient(90deg, " + GOLD + ", transparent)"
              : "rgba(201,168,76,0.25)",
          }}/>
        ))}
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════
// KOMPONEN: SkeletonLoader
// Animasi loading saat data sedang diambil dari Supabase
// ════════════════════════════════════════════════════════════
export function SkeletonLoader({ count = 3 }) {
  const shimmer = {
    background: "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)",
    backgroundSize: "200% 100%",
    animation: "prokopim-slide 1.6s ease infinite",
    borderRadius: 8,
  };

  return (
    <div style={{ padding: "14px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          background: "white", borderRadius: 18, marginBottom: 10,
          padding: "16px", border: "1.5px solid #E8EDF4",
          boxShadow: "0 2px 8px rgba(10,22,40,0.05)",
        }}>
          <div style={{ display: "flex", gap: 14 }}>
            {/* Date block skeleton */}
            <div style={{ ...shimmer, width: 52, height: 70, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              {/* Title */}
              <div style={{ ...shimmer, height: 16, width: "75%", marginBottom: 8 }} />
              {/* Subtitle */}
              <div style={{ ...shimmer, height: 12, width: "45%", marginBottom: 10 }} />
              {/* Badge */}
              <div style={{ ...shimmer, height: 22, width: 90, borderRadius: 20 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


// ════════════════════════════════════════════════════════════
// KOMPONEN: ZenModeView
// Untuk: Walikota & Wakil Wali Kota
// Desain: Tenang, 1 kartu highlight besar, agenda lain di-minimize
// Tidak ada tombol edit sama sekali
// ════════════════════════════════════════════════════════════
export function ZenModeView({ events, role, user, upd, showT, isMobile, setDelegTarget }) {
  const now   = new Date();
  const today = localDateStr();

  const myEvs = useMemo(() => {
    const base = role === "walikota"
      ? events.filter(e => e.alur === "disetujui" && (e.untukPimpinan||[]).includes("walikota"))
      : events.filter(e => e.alur === "disetujui" && ((e.untukPimpinan||[]).includes("wakilwalikota") || e.delegasiKeWWK));
    return base.sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam));
  }, [events, role]);

  const upcoming = myEvs.filter(e => new Date(e.tanggal + "T" + e.jam) >= now);
  const past     = myEvs.filter(e => new Date(e.tanggal + "T" + e.jam) <  now).reverse().slice(0, 3);
  const next     = upcoming[0] || null;
  const rest     = upcoming.slice(1);

  const hour     = now.getHours();
  const greeting = hour < 11 ? "Selamat Pagi" : hour < 15 ? "Selamat Siang" : hour < 18 ? "Selamat Sore" : "Selamat Malam";
  const roleLabel = role === "walikota" ? "Wali Kota Tarakan" : "Wakil Wali Kota Tarakan";

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#F4F7FF", paddingBottom: 32 }}>

      {/* ── Header Zen ── */}
      <div style={{
        background: "linear-gradient(160deg, " + NAVY + " 0%, #112040 100%)",
        padding: isMobile ? "24px 20px 28px" : "32px 40px 36px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Lingkaran dekoratif */}
        {[[140, -30, -30, 0.07], [80, "auto", 50, 0.04], [200, -60, "auto", 0.03]].map(([s, t, r, o], i) => (
          <div key={i} style={{
            position: "absolute", width: s, height: s, borderRadius: "50%",
            top: t, right: r, background: "rgba(201,168,76," + o + ")",
            pointerEvents: "none",
          }}/>
        ))}
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginBottom: 6, position: "relative" }}>
          {greeting},
        </div>
        <div style={{ color: "white", fontSize: isMobile ? 22 : 26, fontWeight: 900, marginBottom: 4, position: "relative" }}>
          {user?.nama || roleLabel}
        </div>
        <div style={{ color: GOLD, fontSize: 12, fontWeight: 600, position: "relative" }}>
          {fmtTgl(today)} &nbsp;·&nbsp; {upcoming.length} agenda mendatang
        </div>
      </div>

      <div style={{ padding: isMobile ? "16px" : "20px 32px" }}>

        {/* ── KARTU HIGHLIGHT UTAMA (agenda berikutnya) ── */}
        {next ? (
          <ZenHeroCard ev={next} role={role} upd={upd} showT={showT} setDelegTarget={setDelegTarget} />
        ) : (
          <EmptyState
            icon="🌿"
            message="Tidak ada agenda mendatang"
            sub="Nikmati waktu Anda. Jadwal akan muncul di sini setelah disetujui tim Prokopim."
          />
        )}

        {/* ── AGENDA SELANJUTNYA (minimized list) ── */}
        {rest.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: "#94A3B8",
              textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10,
            }}>
              Agenda Selanjutnya
            </div>
            {rest.slice(0, 5).map(ev => (
              <ZenMiniCard key={ev.id} ev={ev} role={role} />
            ))}
            {rest.length > 5 && (
              <div style={{ textAlign: "center", padding: "8px", fontSize: 12, color: "#94A3B8" }}>
                +{rest.length - 5} agenda lainnya
              </div>
            )}
          </div>
        )}

        {/* ── RIWAYAT SINGKAT ── */}
        {past.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: "#CBD5E1",
              textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10,
            }}>
              Baru Selesai
            </div>
            {past.map(ev => (
              <ZenMiniCard key={ev.id} ev={ev} role={role} isPast />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Kartu hero besar — agenda paling dekat
function ZenHeroCard({ ev, role, upd, showT, setDelegTarget }) {
  const theme    = useDynamicTheme(ev.tanggal, ev.jam);
  const now      = new Date();
  const evTime   = new Date(ev.tanggal + "T" + ev.jam);
  const diffMs   = evTime - now;
  const diffH    = diffMs / (1000 * 60 * 60);
  const diffMin  = Math.ceil(diffMs / (1000 * 60));

  const etaText = diffMs <= 0
    ? "Sedang berlangsung"
    : diffH < 1
      ? diffMin + " menit lagi"
      : diffH < 24
        ? Math.floor(diffH) + " jam " + (diffMin % 60) + " menit lagi"
        : fmtTgl(ev.tanggal);

  const isWK     = role === "walikota";
  const statusMe = isWK ? ev.statusWK : ev.statusWWK;

  return (
    <div style={{
      background: theme.card,
      border: "2px solid " + theme.border,
      borderRadius: 24,
      overflow: "hidden",
      boxShadow: "0 8px 32px rgba(10,22,40,0.12)",
      transition: "border-color 0.5s ease",
    }}>
      {/* Strip warna dinamis */}
      <div style={{
        background: theme.strip,
        padding: "8px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ color: theme.stripText, fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" }}>
          {theme.icon} {theme.label || "Berikutnya"}
        </span>
        <span style={{ color: theme.stripText, fontSize: 11, fontWeight: 700, opacity: 0.8 }}>
          {etaText}
        </span>
      </div>

      {/* Konten utama */}
      <div style={{ padding: "20px 20px 8px" }}>
        {/* Jam besar */}
        <div style={{
          fontSize: 52, fontWeight: 900, color: NAVY,
          letterSpacing: -2, lineHeight: 1, marginBottom: 4,
        }}>
          {fmtJam(ev.jam)}
          <span style={{ fontSize: 16, fontWeight: 600, color: "#94A3B8", marginLeft: 6 }}>WITA</span>
        </div>

        {/* Nama acara */}
        <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", lineHeight: 1.3, marginBottom: 10 }}>
          {ev.namaAcara}
        </div>

        {/* Detail row */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {ev.lokasi && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📍</span>
              <span style={{ fontSize: 14, color: "#334155", fontWeight: 600, lineHeight: 1.4 }}>{ev.lokasi}</span>
            </div>
          )}
          {ev.penyelenggara && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>🏢</span>
              <span style={{ fontSize: 13, color: "#64748B" }}>{ev.penyelenggara}</span>
            </div>
          )}
          {ev.pakaian && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>👔</span>
              <span style={{ fontSize: 13, color: "#64748B" }}>{ev.pakaian}</span>
            </div>
          )}
          {ev.tanggal !== localDateStr() && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>🗓</span>
              <span style={{ fontSize: 13, color: "#64748B" }}>{fmtTgl(ev.tanggal)}</span>
            </div>
          )}
        </div>

        {/* Naskah sambutan */}
        {ev.sambutanFile && (
          <div style={{
            background: "#F0FDF4", border: "1.5px solid #6EE7B7",
            borderRadius: 12, padding: "12px 14px", marginBottom: 14,
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: GREEN, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              📄 Naskah Sambutan Tersedia
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => window.open(ev.sambutanFile, "_blank")}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: GREEN, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
              >
                Baca Naskah
              </button>
              <a
                href={ev.sambutanFile} download={ev.sambutanNama}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid " + GREEN, background: "white", color: GREEN, textDecoration: "none", textAlign: "center", fontSize: 13, fontWeight: 700, display: "block" }}
              >
                Unduh PDF
              </a>
            </div>
          </div>
        )}

        {/* Catatan pimpinan */}
        {ev.catatanPimpinan && (
          <div style={{ background: "#EEF2FF", borderRadius: 10, padding: "10px 13px", marginBottom: 12, fontSize: 13, color: "#3730A3", fontStyle: "italic", lineHeight: 1.5 }}>
            💬 {ev.catatanPimpinan}
          </div>
        )}

        {/* Status kehadiran */}
        <ZenKehadiran ev={ev} role={role} upd={upd} showT={showT} setDelegTarget={setDelegTarget} />
      </div>
    </div>
  );
}

// Konfirmasi kehadiran versi zen — tombol besar, no clutter
function ZenKehadiran({ ev, role, upd, showT, setDelegTarget }) {
  const isWK      = role === "walikota";
  const statusMe  = isWK ? ev.statusWK : ev.statusWWK;
  const byKey     = isWK ? "statusWK_by" : "statusWWK_by";
  const statusKey = isWK ? "statusWK" : "statusWWK";

  // Kunci jika sudah lewat 2 hari
  const evTime  = new Date(ev.tanggal + "T" + ev.jam);
  const locked  = (new Date() - evTime) > 2 * 24 * 60 * 60 * 1000;

  if (locked) return null;

  return (
    <div style={{ padding: "16px 0 8px", borderTop: "1px solid #F1F5F9" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
        Konfirmasi Kehadiran
      </div>
      {statusMe ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            padding: "8px 18px", borderRadius: 20,
            background: statusMe === "hadir" ? "#D1FAE5" : statusMe === "tidak_hadir" ? "#FEE2E2" : "#FEF3C7",
            color: statusMe === "hadir" ? "#065F46" : statusMe === "tidak_hadir" ? "#991B1B" : "#92400E",
            fontSize: 13, fontWeight: 800,
          }}>
            {statusMe === "hadir" ? "✓ Konfirmasi Hadir"
             : statusMe === "tidak_hadir" ? "✗ Tidak Hadir"
             : ev.delegasiKeWWK ? "→ Didelegasi ke Wakil"
             : "→ Diwakilkan"}
          </div>
          <button
            onClick={() => upd(ev.id, { [statusKey]: null, [byKey]: null })}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "white", color: "#64748B", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
          >
            Ubah
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { upd(ev.id, { [statusKey]: "hadir", [byKey]: role }); showT("Konfirmasi hadir tercatat ✓"); }}
              style={{ flex: 1, padding: "14px", borderRadius: 14, border: "2px solid " + GREEN, background: "white", color: GREEN, cursor: "pointer", fontWeight: 800, fontSize: 14, transition: "all 0.15s" }}
            >
              ✓  Saya Hadir
            </button>
            <button
              onClick={() => { upd(ev.id, { [statusKey]: "tidak_hadir", [byKey]: role }); showT("Dicatat tidak hadir", "warn"); }}
              style={{ flex: 1, padding: "14px", borderRadius: 14, border: "2px solid #991B1B", background: "white", color: "#991B1B", cursor: "pointer", fontWeight: 800, fontSize: 14 }}
            >
              ✗  Tidak Hadir
            </button>
          </div>
          {isWK && (
            <button
              onClick={() => { upd(ev.id, { statusWK: "diwakilkan", delegasiKeWWK: true, perwakilanWK: "", statusWK_by: "walikota" }); showT("Didelegasi ke Wakil Wali Kota"); }}
              style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1.5px solid #7C3AED", background: ev.delegasiKeWWK ? "#7C3AED" : "white", color: ev.delegasiKeWWK ? "white" : "#7C3AED", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
            >
              {ev.delegasiKeWWK ? "✓ Delegasi ke Wakil Wali Kota" : "↩ Delegasi ke Wakil Wali Kota"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Kartu mini untuk agenda berikutnya (bukan highlight)
function ZenMiniCard({ ev, role, isPast }) {
  const theme = useDynamicTheme(ev.tanggal, ev.jam);
  const st    = role === "walikota" ? ev.statusWK : ev.statusWWK;
  const stColor = st === "hadir" ? "#065F46" : st === "tidak_hadir" ? "#991B1B" : "#B45309";
  const stBg    = st === "hadir" ? "#D1FAE5"  : st === "tidak_hadir" ? "#FEE2E2"  : "#FEF3C7";
  const stText  = st === "hadir" ? "Hadir" : st === "tidak_hadir" ? "Tidak Hadir" : st === "diwakilkan" ? "Diwakilkan" : "Belum konfirmasi";

  return (
    <div style={{
      background: isPast ? "#F8FAFC" : "white",
      border: "1.5px solid " + (isPast ? "#E2E8F0" : theme.border),
      borderRadius: 14, padding: "12px 14px", marginBottom: 8,
      display: "flex", alignItems: "center", gap: 12,
      opacity: isPast ? 0.65 : 1,
    }}>
      {/* Jam */}
      <div style={{
        minWidth: 48, textAlign: "center",
        background: isPast ? "#F1F5F9" : "linear-gradient(135deg," + NAVY + ",#1B3360)",
        borderRadius: 10, padding: "6px 4px", flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: isPast ? "#94A3B8" : GOLD, lineHeight: 1 }}>{ev.jam?.slice(0,5)}</div>
        <div style={{ fontSize: 9, color: isPast ? "#CBD5E1" : "rgba(255,255,255,0.6)", marginTop: 2 }}>{fmtTgl(ev.tanggal).split(",")[0]}</div>
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: isPast ? "#64748B" : "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ev.namaAcara}
        </div>
        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
          {ev.lokasi || ev.penyelenggara || "—"}
        </div>
      </div>
      {/* Status badge */}
      {!isPast && st && (
        <span style={{ background: stBg, color: stColor, borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
          {stText}
        </span>
      )}
      {ev.tanggal !== localDateStr() && !isPast && (
        <span style={{ fontSize: 10, color: "#94A3B8", flexShrink: 0 }}>
          {fmtTgl(ev.tanggal).split(",")[0]}
        </span>
      )}
    </div>
  );
}


// ════════════════════════════════════════════════════════════
// KOMPONEN: AjudanView
// Untuk: Ajudan Wali Kota & Ajudan Wakil Wali Kota
// Desain: Padat informasi, aksi cepat, tombol Maps langsung
// ════════════════════════════════════════════════════════════
export function AjudanView({ events, role, user, upd, showT, isMobile }) {
  const now     = new Date();
  const today   = localDateStr();
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); })();

  const isWK    = role === "ajudan_walikota";
  const pimLabel = isWK ? "Wali Kota" : "Wakil Wali Kota";

  const myEvs = useMemo(() => {
    return events
      .filter(e => {
        if (e.alur !== "disetujui") return false;
        if (isWK) return (e.untukPimpinan||[]).includes("walikota");
        return (e.untukPimpinan||[]).includes("wakilwalikota") || e.delegasiKeWWK;
      })
      .sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam));
  }, [events, role]);

  const todayEvs    = myEvs.filter(e => e.tanggal === today);
  const tomorrowEvs = myEvs.filter(e => e.tanggal === tomorrow);
  const upcoming    = myEvs.filter(e => e.tanggal > tomorrow);
  const unconfirmed = myEvs.filter(e => {
    const st = isWK ? e.statusWK : e.statusWWK;
    return !st && new Date(e.tanggal + "T" + e.jam) > now;
  });

  const hour     = now.getHours();
  const greeting = hour < 11 ? "Pagi" : hour < 15 ? "Siang" : hour < 18 ? "Sore" : "Malam";

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#F0F4FA", paddingBottom: 32 }}>

      {/* ── Header Ajudan ── */}
      <div style={{
        background: "linear-gradient(135deg, #0A1628 0%, #0D2B3E 100%)",
        padding: isMobile ? "20px 18px 22px" : "28px 36px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(13,107,79,0.15)" }}/>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 4 }}>
          Selamat {greeting}, Ajudan
        </div>
        <div style={{ color: "white", fontSize: isMobile ? 18 : 22, fontWeight: 900, marginBottom: 6 }}>
          {user?.nama || "Ajudan Pimpinan"}
        </div>
        {/* Badge ringkasan */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { v: todayEvs.length, l: "Hari Ini",  c: GOLD },
            { v: tomorrowEvs.length, l: "Besok",  c: "#6EE7B7" },
            { v: unconfirmed.length, l: "Belum Konfirmasi", c: unconfirmed.length > 0 ? "#FCA5A5" : "#6EE7B7" },
          ].map(({ v, l, c }) => (
            <div key={l} style={{
              background: "rgba(255,255,255,0.08)", borderRadius: 8,
              padding: "5px 12px", display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 15, fontWeight: 900, color: c }}>{v}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: isMobile ? "12px" : "16px 28px" }}>

        {/* Alert: belum konfirmasi */}
        {unconfirmed.length > 0 && (
          <div style={{
            background: "#FEF3C7", border: "1.5px solid #F59E0B",
            borderRadius: 12, padding: "12px 14px", marginBottom: 14,
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>
                {unconfirmed.length} agenda belum dikonfirmasi {pimLabel}
              </div>
              <div style={{ fontSize: 12, color: "#B45309", marginTop: 2 }}>
                Segera koordinasi dan input konfirmasi kehadiran.
              </div>
            </div>
          </div>
        )}

        {/* Hari ini */}
        {todayEvs.length > 0 && (
          <AjudanSection label="Hari Ini" events={todayEvs} isWK={isWK} pimLabel={pimLabel} upd={upd} showT={showT} now={now} />
        )}

        {/* Besok */}
        {tomorrowEvs.length > 0 && (
          <AjudanSection label="Besok" events={tomorrowEvs} isWK={isWK} pimLabel={pimLabel} upd={upd} showT={showT} now={now} />
        )}

        {/* Mendatang */}
        {upcoming.length > 0 && (
          <AjudanSection label="Mendatang" events={upcoming.slice(0, 5)} isWK={isWK} pimLabel={pimLabel} upd={upd} showT={showT} now={now} compact />
        )}

        {myEvs.length === 0 && (
          <EmptyState icon="📋" message={"Tidak ada agenda " + pimLabel} sub="Jadwal akan muncul setelah disetujui." />
        )}
      </div>
    </div>
  );
}

function AjudanSection({ label, events, isWK, pimLabel, upd, showT, now, compact }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: "#64748B",
        textTransform: "uppercase", letterSpacing: 1.5,
        marginBottom: 10, display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ width: 3, height: 14, background: GOLD, borderRadius: 2 }} />
        {label}
      </div>
      {events.map(ev => (
        <AjudanCard key={ev.id} ev={ev} isWK={isWK} pimLabel={pimLabel} upd={upd} showT={showT} now={now} compact={compact} />
      ))}
    </div>
  );
}

function AjudanCard({ ev, isWK, pimLabel, upd, showT, now, compact }) {
  const [expanded, setExpanded] = useState(false);
  const theme   = useDynamicTheme(ev.tanggal, ev.jam);
  const evTime  = new Date(ev.tanggal + "T" + ev.jam);
  const diffMs  = evTime - now;
  const diffH   = diffMs / (1000 * 60 * 60);
  const isToday = ev.tanggal === localDateStr();

  const statusKey = isWK ? "statusWK" : "statusWWK";
  const byKey     = isWK ? "statusWK_by" : "statusWWK_by";
  const st        = isWK ? ev.statusWK : ev.statusWWK;

  const stColor = st === "hadir" ? "#065F46" : st === "tidak_hadir" ? "#991B1B" : "#B45309";
  const stBg    = st === "hadir" ? "#D1FAE5"  : st === "tidak_hadir" ? "#FEE2E2"  : "#FFFBEB";
  const stText  = st === "hadir" ? "✓ Hadir" : st === "tidak_hadir" ? "✗ Tidak Hadir" : st === "diwakilkan" ? "→ Diwakilkan" : "⏳ Belum Konfirmasi";

  const mapsUrl = ev.lokasi
    ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(ev.lokasi + " Tarakan")
    : null;

  return (
    <div style={{
      background: "white",
      border: "1.5px solid " + theme.border,
      borderRadius: 16, marginBottom: 8, overflow: "hidden",
      boxShadow: "0 2px 12px rgba(10,22,40,0.07)",
      transition: "border-color 0.4s ease",
    }}>
      {/* Strip waktu kritis */}
      {isToday && diffH >= 0 && diffH <= 3 && (
        <div style={{ background: theme.strip, padding: "4px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: theme.stripText, letterSpacing: 1 }}>
            {theme.icon} {theme.label}
          </span>
          <span style={{ fontSize: 10, color: theme.stripText, opacity: 0.8 }}>
            {diffH < 1 ? Math.ceil(diffMs/60000) + " menit lagi" : Math.floor(diffH) + " jam lagi"}
          </span>
        </div>
      )}

      {/* Baris utama */}
      <div
        onClick={() => !compact && setExpanded(e => !e)}
        style={{ padding: "12px 14px", cursor: compact ? "default" : "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}
      >
        {/* Jam */}
        <div style={{
          minWidth: 50, textAlign: "center", flexShrink: 0,
          background: isToday ? "linear-gradient(135deg," + NAVY + ",#1B3360)" : "#F8FAFF",
          borderRadius: 10, padding: "7px 4px",
        }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: isToday ? GOLD : "#334155", lineHeight: 1 }}>
            {ev.jam?.slice(0, 5)}
          </div>
          {!isToday && (
            <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 2 }}>
              {fmtTgl(ev.tanggal).split(",")[0]}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Nama acara */}
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", lineHeight: 1.3, marginBottom: 3 }}>
            {ev.namaAcara}
          </div>
          {/* Lokasi */}
          {ev.lokasi && (
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <span>📍</span> {ev.lokasi}
            </div>
          )}
          {/* Status badge */}
          <span style={{ background: stBg, color: stColor, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
            {stText}
          </span>
        </div>

        {/* Expand arrow */}
        {!compact && (
          <div style={{ color: "#CBD5E1", fontSize: 11, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none", flexShrink: 0, marginTop: 4 }}>▼</div>
        )}
      </div>

      {/* ── PANEL AKSI CEPAT (expanded) ── */}
      {expanded && !compact && (
        <div style={{ borderTop: "1px solid #F1F5F9", padding: "12px 14px", background: "#FAFBFF" }}>

          {/* Info tambahan */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {[
              { l: "Penyelenggara", v: ev.penyelenggara },
              { l: "Pakaian", v: ev.pakaian },
              { l: "Kontak", v: ev.kontak },
            ].filter(f => f.v).map(f => (
              <div key={f.l} style={{ background: "#F1F5F9", borderRadius: 8, padding: "5px 10px" }}>
                <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>{f.l}</div>
                <div style={{ fontSize: 12, color: "#334155", fontWeight: 600 }}>{f.v}</div>
              </div>
            ))}
          </div>

          {/* ── TOMBOL AKSI CEPAT ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

            {/* Tombol Maps */}
            {mapsUrl && (
              <a
                href={mapsUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px", borderRadius: 12,
                  background: "linear-gradient(135deg, #1A73E8, #0D5DBE)",
                  color: "white", textDecoration: "none",
                  fontSize: 13, fontWeight: 700,
                  boxShadow: "0 4px 14px rgba(26,115,232,0.3)",
                }}
              >
                🗺️ Buka di Google Maps
              </a>
            )}

            {/* Konfirmasi kehadiran pimpinan */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                Kehadiran {pimLabel}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { s: "hadir",       l: "✓ Hadir",      c: GREEN },
                  { s: "tidak_hadir", l: "✗ Tidak Hadir", c: "#991B1B" },
                ].map(({ s, l, c }) => (
                  <button
                    key={s}
                    onClick={() => { upd(ev.id, { [statusKey]: s, [byKey]: "ajudan" }); showT("Kehadiran " + pimLabel + " dicatat"); }}
                    style={{
                      flex: 1, padding: "11px 8px", borderRadius: 11,
                      cursor: "pointer", fontWeight: 800, fontSize: 12,
                      border: "2px solid " + c,
                      background: st === s ? c : "white",
                      color: st === s ? "white" : c,
                      transition: "all 0.15s",
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {isWK && (
                <button
                  onClick={() => { upd(ev.id, { statusWK: "diwakilkan", delegasiKeWWK: true, perwakilanWK: "", statusWK_by: "ajudan" }); showT("Delegasi ke Wakil WK dicatat"); }}
                  style={{
                    width: "100%", marginTop: 8, padding: "10px", borderRadius: 10,
                    border: "1.5px solid #7C3AED",
                    background: ev.delegasiKeWWK ? "#7C3AED" : "white",
                    color: ev.delegasiKeWWK ? "white" : "#7C3AED",
                    cursor: "pointer", fontSize: 12, fontWeight: 700,
                  }}
                >
                  {ev.delegasiKeWWK ? "✓ Delegasi ke Wakil WK" : "↩ Delegasi ke Wakil WK"}
                </button>
              )}
            </div>

            {/* Naskah sambutan */}
            {ev.sambutanFile && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => window.open(ev.sambutanFile, "_blank")}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid " + GREEN, background: "white", color: GREEN, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                >
                  📄 Baca Naskah
                </button>
                <a
                  href={ev.sambutanFile} download={ev.sambutanNama}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: GREEN, color: "white", textDecoration: "none", textAlign: "center", fontSize: 12, fontWeight: 700, display: "block" }}
                >
                  ⬇ Unduh PDF
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// ════════════════════════════════════════════════════════════
// KOMPONEN: StafView
// Untuk: staf, timkom, admin_rk  (tab jadwal)
// Desain: Personal, hangat, fokus pada penugasan & hari ini
// ════════════════════════════════════════════════════════════
export function StafView({ events, role, user, isMobile }) {
  const now   = new Date();
  const today = localDateStr();
  const tomorrow = (() => {
    const d = new Date(); d.setDate(d.getDate()+1);
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  })();

  const hour     = now.getHours();
  const greeting = hour < 11 ? "Selamat Pagi" : hour < 15 ? "Selamat Siang" : hour < 18 ? "Selamat Sore" : "Selamat Malam";

  const roleLabel = {
    staf:     "Staf Protokol",
    timkom:   "Tim Komunikasi & Dokumentasi",
    admin_rk: "Admin Rencana Kegiatan",
  }[role] || "Staf";

  const roleColor = {
    staf:     "#1D4ED8",
    timkom:   "#7C3AED",
    admin_rk: "#0D6B4F",
  }[role] || NAVY;

  const roleGradient = {
    staf:     "linear-gradient(160deg,#0A1628,#1A2F5E)",
    timkom:   "linear-gradient(160deg,#2D1B6E,#4C1D95)",
    admin_rk: "linear-gradient(160deg,#0A1628,#0D3B28)",
  }[role] || "linear-gradient(160deg," + NAVY + ",#1A2F5E)";

  // Semua agenda yang disetujui & bisa dilihat sesuai role
  const allApproved = events.filter(e => e.alur === "disetujui")
    .sort((a,b) => (a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));

  // Penugasan milik user ini
  const myAssignments = allApproved.filter(e =>
    (e.personil || []).includes(user?.username)
  );

  const myToday    = myAssignments.filter(e => e.tanggal === today);
  const myTomorrow = myAssignments.filter(e => e.tanggal === tomorrow);
  const myUpcoming = myAssignments.filter(e =>
    new Date(e.tanggal + "T" + e.jam) >= now && e.tanggal > today
  );

  // Untuk timkom: agenda yang butuh naskah sambutan
  const needsSambutan = role === "timkom"
    ? allApproved.filter(e =>
        !e.sambutanFile &&
        (e.jenisKegiatan === "Sambutan" || e.jenisKegiatan === "Sambutan membuka acara") &&
        new Date(e.tanggal + "T" + e.jam) > now
      )
    : [];

  // Untuk admin_rk: draft & ditolak milik user
  const myDrafts = role === "admin_rk"
    ? events.filter(e => (e.alur === "draft" || e.alur === "ditolak") && e.submittedBy === user?.username)
    : [];

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#F4F7FF", paddingBottom: 32 }}>

      {/* ── Header Personal ── */}
      <div style={{
        background: roleGradient,
        padding: isMobile ? "20px 18px 24px" : "28px 36px 32px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }}/>
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginBottom: 4 }}>
          {greeting},
        </div>
        <div style={{ color: "white", fontSize: isMobile ? 20 : 24, fontWeight: 900, marginBottom: 4 }}>
          {user?.nama || roleLabel}
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 14 }}>
          {roleLabel}
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { v: myToday.length,    l: "Tugas Hari Ini",    c: GOLD },
            { v: myTomorrow.length, l: "Tugas Besok",        c: "#6EE7B7" },
            { v: myAssignments.filter(e => new Date(e.tanggal+"T"+e.jam) >= now).length, l: "Total Mendatang", c: "#93C5FD" },
            ...(needsSambutan.length > 0 ? [{ v: needsSambutan.length, l: "Sambutan Pending", c: "#FCA5A5" }] : []),
            ...(myDrafts.length > 0 ? [{ v: myDrafts.length, l: "Draft/Dikembalikan", c: "#FCA5A5" }] : []),
          ].map(({ v, l, c }) => (
            <div key={l} style={{
              background: "rgba(255,255,255,0.08)", borderRadius: 10,
              padding: "6px 12px", display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: c }}>{v}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: isMobile ? "14px" : "20px 32px" }}>

        {/* ── Alert Sambutan Mendesak (Timkom) ── */}
        {needsSambutan.filter(e => {
          const h = (new Date(e.tanggal+"T"+e.jam) - now) / 3600000;
          return h <= 24;
        }).length > 0 && (
          <div style={{
            background: "#FEF2F2", border: "1.5px solid #EF4444",
            borderRadius: 12, padding: "12px 14px", marginBottom: 14,
            display: "flex", gap: 10, alignItems: "center",
          }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>🚨</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#991B1B" }}>
                Naskah sambutan belum diupload!
              </div>
              <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 2 }}>
                {needsSambutan.filter(e => (new Date(e.tanggal+"T"+e.jam)-now)/3600000 <= 24).length} kegiatan sambutan dalam 24 jam ke depan tanpa naskah.
              </div>
            </div>
          </div>
        )}

        {/* ── Alert Draft Dikembalikan (Admin RK) ── */}
        {myDrafts.filter(e => e.alur === "ditolak").length > 0 && (
          <div style={{
            background: "#FFF7ED", border: "1.5px solid #F59E0B",
            borderRadius: 12, padding: "12px 14px", marginBottom: 14,
            display: "flex", gap: 10, alignItems: "center",
          }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>↩️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#92400E" }}>
                {myDrafts.filter(e => e.alur === "ditolak").length} jadwal dikembalikan
              </div>
              <div style={{ fontSize: 12, color: "#B45309", marginTop: 2 }}>
                Perlu diperbaiki dan dikirim ulang.
              </div>
            </div>
          </div>
        )}

        {/* ── Tugas Hari Ini ── */}
        {myToday.length > 0 ? (
          <StafSection label="🎯 Tugas Hari Ini" events={myToday} now={now} accentColor={roleColor} user={user} />
        ) : (
          <div style={{
            background: "white", borderRadius: 16, padding: "18px",
            marginBottom: 16, border: "1.5px solid #E8EDF4",
            display: "flex", gap: 12, alignItems: "center",
          }}>
            <span style={{ fontSize: 28 }}>☀️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>Tidak ada tugas hari ini</div>
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>Nikmati harimu! Cek tugas mendatang di bawah.</div>
            </div>
          </div>
        )}

        {/* ── Tugas Besok ── */}
        {myTomorrow.length > 0 && (
          <StafSection label="📅 Besok" events={myTomorrow} now={now} accentColor={roleColor} user={user} />
        )}

        {/* ── Tugas Mendatang ── */}
        {myUpcoming.filter(e => e.tanggal > tomorrow).length > 0 && (
          <StafSection
            label="🗓 Mendatang"
            events={myUpcoming.filter(e => e.tanggal > tomorrow).slice(0, 6)}
            now={now} accentColor={roleColor} compact user={user}
          />
        )}

        {/* ── Sambutan Menunggu (Timkom) ── */}
        {needsSambutan.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: "#7C3AED",
              textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{ width: 3, height: 14, background: "#7C3AED", borderRadius: 2 }} />
              📝 Sambutan Perlu Naskah ({needsSambutan.length})
            </div>
            {needsSambutan.slice(0, 5).map(ev => (
              <div key={ev.id} style={{
                background: "#FAF5FF", border: "1.5px solid #C4B5FD",
                borderRadius: 12, padding: "10px 14px", marginBottom: 8,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  minWidth: 46, textAlign: "center",
                  background: "#7C3AED", borderRadius: 9, padding: "6px 4px",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "white", lineHeight: 1 }}>{ev.jam?.slice(0,5)}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{fmtTgl(ev.tanggal).split(",")[0]}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#4C1D95", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.namaAcara}</div>
                  <div style={{ fontSize: 11, color: "#7C3AED", marginTop: 2 }}>📍 {ev.lokasi || ev.penyelenggara || "—"}</div>
                </div>
                <span style={{ background: "#EDE9FE", color: "#5B21B6", borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                  ⏳ Belum ada naskah
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Empty state jika tidak ada tugas sama sekali */}
        {myAssignments.length === 0 && (
          <EmptyState
            icon="🌱"
            message="Belum ada penugasan"
            sub="Kasubbag akan menugaskan Anda pada kegiatan yang relevan. Pantau terus ya!"
          />
        )}
      </div>
    </div>
  );
}

function StafSection({ label, events, now, accentColor, user, compact }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: "#64748B",
        textTransform: "uppercase", letterSpacing: 1.5,
        marginBottom: 10, display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ width: 3, height: 14, background: accentColor, borderRadius: 2 }} />
        {label}
      </div>
      {events.map(ev => (
        <StafCard key={ev.id} ev={ev} now={now} accentColor={accentColor} compact={compact} />
      ))}
    </div>
  );
}

function StafCard({ ev, now, accentColor, compact }) {
  const [expanded, setExpanded] = useState(false);
  const theme   = useDynamicTheme(ev.tanggal, ev.jam);
  const isToday = ev.tanggal === localDateStr();
  const evTime  = new Date(ev.tanggal + "T" + ev.jam);
  const diffH   = (evTime - now) / 3600000;

  const mapsUrl = ev.lokasi
    ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(ev.lokasi + " Tarakan")
    : null;

  return (
    <div style={{
      background: "white",
      border: "1.5px solid " + theme.border,
      borderRadius: 16, marginBottom: 8, overflow: "hidden",
      boxShadow: "0 2px 12px rgba(10,22,40,0.06)",
    }}>
      {/* Strip kritis */}
      {isToday && diffH >= 0 && diffH <= 3 && (
        <div style={{ background: theme.strip, padding: "4px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: theme.stripText, letterSpacing: 1 }}>{theme.icon} {theme.label}</span>
          <span style={{ fontSize: 10, color: theme.stripText, opacity: 0.8 }}>
            {diffH < 1 ? Math.ceil(diffH*60) + " menit" : Math.floor(diffH) + " jam lagi"}
          </span>
        </div>
      )}

      <div
        onClick={() => !compact && setExpanded(e => !e)}
        style={{ padding: "12px 14px", cursor: compact ? "default" : "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}
      >
        <div style={{
          minWidth: 50, textAlign: "center", flexShrink: 0,
          background: isToday ? "linear-gradient(135deg," + NAVY + ",#1B3360)" : "#F8FAFF",
          borderRadius: 10, padding: "7px 4px",
        }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: isToday ? GOLD : "#334155", lineHeight: 1 }}>
            {ev.jam?.slice(0,5)}
          </div>
          {!isToday && <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 2 }}>{fmtTgl(ev.tanggal).split(",")[0]}</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", lineHeight: 1.3, marginBottom: 3 }}>
            {ev.namaAcara}
          </div>
          {ev.lokasi && (
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 4, display: "flex", gap: 4, alignItems: "center" }}>
              <span>📍</span> {ev.lokasi}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ev.pakaian && (
              <span style={{ background: "#F1F5F9", color: "#475569", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>
                👔 {ev.pakaian}
              </span>
            )}
            {ev.sambutanFile && (
              <span style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                📄 Ada Naskah
              </span>
            )}
          </div>
        </div>
        {!compact && (
          <div style={{ color: "#CBD5E1", fontSize: 11, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none", flexShrink: 0, marginTop: 4 }}>▼</div>
        )}
      </div>

      {expanded && !compact && (
        <div style={{ borderTop: "1px solid #F1F5F9", padding: "12px 14px", background: "#FAFBFF" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {[{ l: "Penyelenggara", v: ev.penyelenggara }, { l: "Kontak", v: ev.kontak }, { l: "Catatan", v: ev.catatan }]
              .filter(f => f.v).map(f => (
                <div key={f.l} style={{ background: "#F1F5F9", borderRadius: 8, padding: "5px 10px" }}>
                  <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>{f.l}</div>
                  <div style={{ fontSize: 12, color: "#334155", fontWeight: 600 }}>{f.v}</div>
                </div>
              ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "11px", borderRadius: 11,
                background: "linear-gradient(135deg,#1A73E8,#0D5DBE)",
                color: "white", textDecoration: "none", fontSize: 13, fontWeight: 700,
                boxShadow: "0 4px 12px rgba(26,115,232,0.25)",
              }}>
                🗺️ Buka Lokasi di Maps
              </a>
            )}
            {ev.sambutanFile && (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => window.open(ev.sambutanFile, "_blank")} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid " + GREEN, background: "white", color: GREEN, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                  📄 Baca Naskah
                </button>
                <a href={ev.sambutanFile} download={ev.sambutanNama} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: GREEN, color: "white", textDecoration: "none", textAlign: "center", fontSize: 12, fontWeight: 700, display: "block" }}>
                  ⬇ Unduh PDF
                </a>
              </div>
            )}
            {ev.catatanPimpinan && (
              <div style={{ background: "#EEF2FF", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#3730A3", fontStyle: "italic" }}>
                💬 Arahan Pimpinan: {ev.catatanPimpinan}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// ════════════════════════════════════════════════════════════
// KOMPONEN: MitraView
// Untuk: mitra_kerja (Mitra Kerja Pemkot)
// Desain: Bersih, read-only, elegan, public-friendly
// ════════════════════════════════════════════════════════════
export function MitraView({ events, isMobile }) {
  const now   = new Date();
  const today = localDateStr();
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter]     = useState("upcoming");

  const approved = events
    .filter(e => e.alur === "disetujui")
    .sort((a,b) => (a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));

  const filtered = filter === "today"
    ? approved.filter(e => e.tanggal === today)
    : filter === "upcoming"
      ? approved.filter(e => new Date(e.tanggal+"T"+e.jam) >= now)
      : approved;

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#F4F7FF", paddingBottom: 32 }}>

      {/* ── Header Publik ── */}
      <div style={{
        background: "linear-gradient(135deg," + NAVY + " 0%,#1A3060 100%)",
        padding: isMobile ? "20px 18px 22px" : "28px 36px 30px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(201,168,76,0.08)" }}/>
        <div style={{ color: GOLD, fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
          🏛️ Pemerintah Kota Tarakan
        </div>
        <div style={{ color: "white", fontSize: isMobile ? 18 : 22, fontWeight: 900, marginBottom: 4 }}>
          Agenda Kegiatan Pimpinan
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
          {fmtTgl(today)} · {approved.filter(e => e.tanggal === today).length} kegiatan hari ini
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {[
            { k: "upcoming", l: "Mendatang" },
            { k: "today",    l: "Hari Ini" },
            { k: "all",      l: "Semua" },
          ].map(({ k, l }) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              style={{
                padding: "5px 14px", borderRadius: 20,
                border: "1.5px solid " + (filter === k ? GOLD : "rgba(255,255,255,0.2)"),
                background: filter === k ? GOLD : "rgba(255,255,255,0.08)",
                color: filter === k ? NAVY : "rgba(255,255,255,0.7)",
                cursor: "pointer", fontSize: 11, fontWeight: 700,
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: isMobile ? "14px" : "20px 32px" }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="📭"
            message="Tidak ada agenda"
            sub={filter === "today" ? "Tidak ada kegiatan pimpinan hari ini." : "Belum ada agenda mendatang yang dijadwalkan."}
          />
        ) : (
          filtered.map(ev => (
            <MitraCard key={ev.id} ev={ev} now={now} expanded={expanded === ev.id} onToggle={() => setExpanded(expanded === ev.id ? null : ev.id)} />
          ))
        )}
      </div>
    </div>
  );
}

function MitraCard({ ev, now, expanded, onToggle }) {
  const theme   = useDynamicTheme(ev.tanggal, ev.jam);
  const isToday = ev.tanggal === localDateStr();
  const evTime  = new Date(ev.tanggal + "T" + ev.jam);
  const mapsUrl = ev.lokasi
    ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(ev.lokasi + " Tarakan")
    : null;

  // ── Kehadiran per pimpinan (untuk mitra: siapa hadir & siapa diwakili) ──
  const STATUS_MAP = {
    hadir:       { label: "Hadir",                bg: "#D1FAE5", color: "#065F46" },
    tidak_hadir: { label: "Tidak Hadir",          bg: "#FEE2E2", color: "#991B1B" },
    diwakilkan:  { label: "Diwakilkan",           bg: "#EDE9FE", color: "#5B21B6" },
    delegasi:    { label: "Didelegasi ke Wakil",  bg: "#FEF3C7", color: "#92400E" },
    pending:     { label: "Belum dikonfirmasi",   bg: "#F1F5F9", color: "#475569" },
  };
  const kehadiran = [];
  const untuk = ev.untukPimpinan || [];
  if (untuk.includes("walikota")) {
    if (ev.delegasiKeWWK) {
      kehadiran.push({ jabatan: "Wali Kota", st: STATUS_MAP.delegasi, oleh: "Wakil Wali Kota" });
    } else if (ev.statusWK === "diwakilkan") {
      kehadiran.push({ jabatan: "Wali Kota", st: STATUS_MAP.diwakilkan, oleh: ev.perwakilanWK || "(belum ditentukan)" });
    } else {
      kehadiran.push({ jabatan: "Wali Kota", st: STATUS_MAP[ev.statusWK] || STATUS_MAP.pending });
    }
  }
  if (untuk.includes("wakilwalikota") || ev.delegasiKeWWK) {
    if (ev.statusWWK === "diwakilkan") {
      kehadiran.push({ jabatan: "Wakil Wali Kota", st: STATUS_MAP.diwakilkan, oleh: ev.perwakilanWWK || "(belum ditentukan)" });
    } else {
      kehadiran.push({ jabatan: "Wakil Wali Kota", st: STATUS_MAP[ev.statusWWK] || STATUS_MAP.pending });
    }
  }

  // Pill ringkas di kartu collapsed
  const pillRingkas = kehadiran.map(k =>
    k.oleh ? k.jabatan + " → " + k.oleh : k.jabatan + " · " + k.st.label
  );

  return (
    <div style={{
      background: theme.card,
      border: "1.5px solid " + theme.border,
      borderRadius: 18, marginBottom: 10, overflow: "hidden",
      boxShadow: "0 2px 16px rgba(10,22,40,0.07)",
      transition: "border-color 0.4s ease",
    }}>
      {isToday && (
        <div style={{ background: theme.strip, padding: "5px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: theme.stripText, letterSpacing: 1, textTransform: "uppercase" }}>
            {theme.icon} {theme.label || "Hari Ini"}
          </span>
          <span style={{ fontSize: 10, color: theme.stripText, opacity: 0.8 }}>{ev.jam} WITA</span>
        </div>
      )}

      <div onClick={onToggle} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{
          minWidth: 52, textAlign: "center", flexShrink: 0,
          background: isToday ? "linear-gradient(135deg," + NAVY + ",#1B3360)" : "#F8FAFF",
          borderRadius: 12, padding: "8px 4px",
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: isToday ? GOLD : "#94A3B8", textTransform: "uppercase" }}>
            {fmtTgl(ev.tanggal).split(",")[0]}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: isToday ? "white" : "#0F172A", lineHeight: 1.1 }}>
            {ev.tanggal.slice(8)}
          </div>
          <div style={{ fontSize: 10, color: isToday ? "rgba(255,255,255,0.6)" : "#94A3B8", fontWeight: 600 }}>{ev.jam?.slice(0,5)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", lineHeight: 1.3, marginBottom: 5 }}>
            {ev.namaAcara}
          </div>
          {ev.lokasi && (
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 5, display: "flex", gap: 4 }}>
              <span>📍</span> {ev.lokasi}
            </div>
          )}
          {kehadiran.length > 0 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {kehadiran.map((k, i) => (
                <span key={i} style={{ background: k.st.bg, color: k.st.color, borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                  🎖️ {k.oleh ? k.jabatan + " → " + k.oleh : k.jabatan + " · " + k.st.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ color: "#CBD5E1", fontSize: 11, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none", flexShrink: 0, marginTop: 4 }}>▼</div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #F1F5F9", padding: "12px 16px", background: "#FAFBFF" }}>
          {/* Kehadiran Pimpinan */}
          {kehadiran.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Kehadiran Pimpinan
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {kehadiran.map((k, i) => (
                  <div key={i} style={{
                    background: "white", border: "1px solid #E2E8F0", borderRadius: 10,
                    padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>
                        🎖️ {k.jabatan}
                      </div>
                      {k.oleh && (
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                          Diwakili oleh: <b style={{ color: "#5B21B6" }}>{k.oleh}</b>
                        </div>
                      )}
                    </div>
                    <span style={{
                      background: k.st.bg, color: k.st.color, borderRadius: 20,
                      padding: "3px 10px", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap",
                    }}>
                      {k.st.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {[
              { l: "Penyelenggara", v: ev.penyelenggara },
              { l: "Tanggal", v: fmtTgl(ev.tanggal) },
              { l: "Pakaian Tamu", v: ev.pakaian },
            ].filter(f => f.v).map(f => (
              <div key={f.l} style={{ background: "#F1F5F9", borderRadius: 8, padding: "6px 10px", flex: "1 1 120px" }}>
                <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>{f.l}</div>
                <div style={{ fontSize: 12, color: "#334155", fontWeight: 600, marginTop: 2 }}>{f.v}</div>
              </div>
            ))}
          </div>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "11px", borderRadius: 11,
              background: "linear-gradient(135deg,#1A73E8,#0D5DBE)",
              color: "white", textDecoration: "none", fontSize: 13, fontWeight: 700,
              boxShadow: "0 3px 12px rgba(26,115,232,0.2)",
            }}>
              🗺️ Lihat Lokasi di Google Maps
            </a>
          )}
        </div>
      )}
    </div>
  );
}
