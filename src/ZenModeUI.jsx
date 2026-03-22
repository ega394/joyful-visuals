/**
 * ══════════════════════════════════════════════════════════
 * FILE: src/ZenModeUI.jsx
 * PROKOPIM — Modular Zen Interface v2.0
 *
 * CARA PAKAI di ProkopimApp.jsx:
 *   import { ZenDashboard } from "./ZenModeUI.jsx";
 *
 *   // Ganti routing tab jadwal dengan:
 *   ?<ZenDashboard
 *       events={events}
 *       role={role}
 *       user={user}
 *       upd={upd}
 *       showT={showT}
 *       isMobile={isMobile}
 *       setDelegTarget={setDelegTarget}
 *     />
 *
 * ARKETIPE:
 *   Executive  → walikota, wakilwalikota, mitra_kerja
 *   Operational → ajudan_walikota, ajudan_wakilwalikota, timkom, staf
 *   Management  → admin_rk, kasubbag_protokol, kasubbag_komdokpim, kabag
 * ══════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";

// ── Design Tokens ────────────────────────────────────────────
const T = {
  navy:    "#0A1628",
  navyMid: "#112240",
  navyLight:"#1E3A5F",
  gold:    "#C9A84C",
  goldSoft:"rgba(201,168,76,0.15)",
  green:   "#0D6B4F",
  greenBg: "#ECFDF5",
  red:     "#DC2626",
  redBg:   "#FEF2F2",
  amber:   "#D97706",
  amberBg: "#FFFBEB",
  slate:   "#64748B",
  border:  "#E2E8F0",
  bg:      "#F0F4FA",
  white:   "#FFFFFF",
};

// ── Role → Arketipe mapping ──────────────────────────────────
const ARCHETYPE = {
  walikota:              "executive",
  wakilwalikota:         "executive",
  mitra_kerja:           "executive",
  ajudan_walikota:       "operational",
  ajudan_wakilwalikota:  "operational",
  timkom:                "operational",
  staf:                  "operational",
  admin_rk:              "management",
  kasubbag_protokol:     "management",
  kasubbag_komdokpim:    "management",
  kabag:                 "management",
};

const HARI  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const BULAN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fmtTgl(str) {
  if (!str) return "";
  const d = new Date(str + "T00:00:00");
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]}`;
}
function timeLeft(tanggal, jam) {
  const diff = new Date(`${tanggal}T${jam}`) - new Date();
  if (diff <= 0) return { text: "Sedang berlangsung", urgent: false, imminent: true };
  const h = Math.floor(diff / 3600000);
  const m = Math.ceil((diff % 3600000) / 60000);
  if (h === 0) return { text: `${m} menit lagi`, urgent: true, imminent: false };
  if (h < 3)   return { text: `${h} jam ${m} menit lagi`, urgent: true, imminent: false };
  return { text: `${h} jam lagi`, urgent: false, imminent: false };
}

// ════════════════════════════════════════════════════════════
// HOOK: useWeather
// Ambil prakiraan cuaca dari OpenWeatherMap berdasarkan koordinat
// Tambahkan VITE_OPENWEATHER_KEY ke Vercel env variables
// ════════════════════════════════════════════════════════════
const weatherCache = new Map();

export function useWeather(lat, lng, tanggal, jam) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lat || !lng) return;
    const key = `${lat},${lng},${tanggal}`;
    if (weatherCache.has(key)) { setData(weatherCache.get(key)); return; }

    const apiKey = import.meta.env.VITE_OPENWEATHER_KEY;
    if (!apiKey) return;

    setLoading(true);
    // OpenWeatherMap One Call 3.0 / forecast
    fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=id&cnt=16`
    )
      .then(r => r.json())
      .then(json => {
        if (!json.list) return;
        // Cari slot forecast yang paling dekat dengan jam acara
        const targetTime = new Date(`${tanggal}T${jam || "08:00"}`).getTime();
        const slot = json.list.reduce((best, item) => {
          const diff = Math.abs(item.dt * 1000 - targetTime);
          return diff < Math.abs((best?.dt ?? 0) * 1000 - targetTime) ? item : best;
        }, null);
        if (!slot) return;
        const result = {
          temp:        Math.round(slot.main.temp),
          feels:       Math.round(slot.main.feels_like),
          condition:   slot.weather[0].main,
          description: slot.weather[0].description,
          icon:        slot.weather[0].icon,
          humidity:    slot.main.humidity,
          wind:        Math.round(slot.wind.speed * 3.6), // m/s → km/h
          isRain:      ["Rain","Drizzle","Thunderstorm"].includes(slot.weather[0].main),
          isStorm:     slot.weather[0].main === "Thunderstorm",
        };
        weatherCache.set(key, result);
        setData(result);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lat, lng, tanggal, jam]);

  return { weather: data, weatherLoading: loading };
}

// ── WeatherBadge: komponen cuaca inline di kartu ─────────────
function WeatherBadge({ lat, lng, tanggal, jam, compact = false }) {
  const { weather, weatherLoading } = useWeather(lat, lng, tanggal, jam);

  if (weatherLoading) return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:4,
      background:"rgba(255,255,255,0.08)", borderRadius:20,
      padding: compact ? "3px 8px" : "4px 10px" }}>
      <div style={{ width:12, height:12, borderRadius:"50%",
        background:"rgba(255,255,255,0.2)",
        animation:"prokopim-pulse 1.5s ease infinite" }}/>
    </div>
  );

  if (!weather) return null;

  const iconUrl = `https://openweathermap.org/img/wn/${weather.icon}.png`;
  const rainAlert = weather.isRain;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:compact ? 3 : 5 }}>
      {/* Info cuaca utama */}
      <div style={{
        display:"inline-flex", alignItems:"center", gap:compact ? 3 : 5,
        background: rainAlert
          ? "rgba(239,68,68,0.12)"
          : "rgba(255,255,255,0.08)",
        border: `1px solid ${rainAlert ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.12)"}`,
        borderRadius:20,
        padding: compact ? "2px 8px 2px 4px" : "4px 12px 4px 6px",
      }}>
        <img src={iconUrl} alt={weather.description}
          style={{ width: compact ? 20 : 24, height: compact ? 20 : 24, objectFit:"contain" }}/>
        <span style={{
          fontSize: compact ? 11 : 12, fontWeight:700,
          color: rainAlert ? "#FCA5A5" : "rgba(255,255,255,0.85)",
        }}>
          {weather.temp}°C
        </span>
        {!compact && (
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.5)", textTransform:"capitalize" }}>
            {weather.description}
          </span>
        )}
      </div>

      {/* Badge peringatan hujan */}
      {rainAlert && (
        <div style={{
          display:"inline-flex", alignItems:"center", gap:5,
          background: weather.isStorm
            ? "linear-gradient(135deg,rgba(239,68,68,0.25),rgba(217,119,6,0.25))"
            : "linear-gradient(135deg,rgba(59,130,246,0.25),rgba(99,102,241,0.25))",
          border: `1.5px solid ${weather.isStorm ? "rgba(239,68,68,0.5)" : "rgba(59,130,246,0.4)"}`,
          borderRadius:8,
          padding: compact ? "4px 8px" : "5px 10px",
          animation: weather.isStorm ? "prokopim-pulse 2s ease infinite" : "none",
        }}>
          <span style={{ fontSize: compact ? 12 : 14 }}>
            {weather.isStorm ? "⛈️" : "☔"}
          </span>
          <span style={{
            fontSize: compact ? 10 : 11, fontWeight:800,
            color: weather.isStorm ? "#FCA5A5" : "#93C5FD",
            letterSpacing:0.3,
          }}>
            {weather.isStorm ? "Waspada Petir!" : "Siapkan Payung / Jas Hujan"}
          </span>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// KOMPONEN: SkeletonLoader — animasi loading premium
// ════════════════════════════════════════════════════════════
export function ZenSkeletonLoader({ archetype = "executive", count = 3 }) {
  const isExec = archetype === "executive";
  const isMgmt = archetype === "management";

  if (isExec) return (
    <div style={{ padding:"20px" }}>
      {/* Hero skeleton */}
      <div style={{
        background:"white", borderRadius:24, marginBottom:16,
        overflow:"hidden", boxShadow:"0 8px 32px rgba(10,22,40,0.08)",
      }}>
        <div style={{ height:6, background:`linear-gradient(90deg,${T.navy},${T.navyLight},${T.navy})`,
          backgroundSize:"200% 100%", animation:"prokopim-slide 2s ease infinite" }}/>
        <div style={{ padding:"28px 24px" }}>
          <SkeletonLine width="35%" height={52} radius={8} mb={16}/>
          <SkeletonLine width="75%" height={22} radius={6} mb={8}/>
          <SkeletonLine width="55%" height={16} radius={6} mb={24}/>
          <div style={{ display:"flex", gap:10 }}>
            <SkeletonLine width="33%" height={52} radius={14}/>
            <SkeletonLine width="33%" height={52} radius={14}/>
            <SkeletonLine width="33%" height={52} radius={14}/>
          </div>
        </div>
      </div>
      {/* Mini skeletons */}
      {[...Array(2)].map((_,i) => (
        <div key={i} style={{ background:"white", borderRadius:14, marginBottom:8,
          padding:"14px 16px", display:"flex", gap:12, alignItems:"center",
          boxShadow:"0 1px 6px rgba(10,22,40,0.05)" }}>
          <SkeletonLine width={48} height={48} radius={12}/>
          <div style={{ flex:1 }}>
            <SkeletonLine width="65%" height={14} radius={5} mb={6}/>
            <SkeletonLine width="40%" height={11} radius={5}/>
          </div>
        </div>
      ))}
    </div>
  );

  if (isMgmt) return (
    <div style={{ padding:"16px 20px" }}>
      {/* Stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:20 }}>
        {[...Array(3)].map((_,i) => (
          <div key={i} style={{ background:"white", borderRadius:14, padding:"16px",
            boxShadow:"0 1px 6px rgba(10,22,40,0.05)" }}>
            <SkeletonLine width="40%" height={28} radius={6} mb={6}/>
            <SkeletonLine width="70%" height={11} radius={4}/>
          </div>
        ))}
      </div>
      {/* List */}
      {[...Array(count)].map((_,i) => (
        <div key={i} style={{ background:"white", borderRadius:14, marginBottom:8,
          padding:"14px 16px", boxShadow:"0 1px 6px rgba(10,22,40,0.05)" }}>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            <SkeletonLine width={44} height={44} radius={10}/>
            <div style={{ flex:1 }}>
              <SkeletonLine width="70%" height={14} radius={5} mb={5}/>
              <div style={{ display:"flex", gap:6 }}>
                <SkeletonLine width={60} height={20} radius={10}/>
                <SkeletonLine width={80} height={20} radius={10}/>
              </div>
            </div>
            <SkeletonLine width={28} height={28} radius={8}/>
          </div>
        </div>
      ))}
    </div>
  );

  // Operational default
  return (
    <div style={{ padding:"14px" }}>
      {[...Array(count)].map((_,i) => (
        <div key={i} style={{ background:"white", borderRadius:16, marginBottom:10,
          overflow:"hidden", boxShadow:"0 2px 12px rgba(10,22,40,0.06)" }}>
          <div style={{ height:4,
            background:`linear-gradient(90deg,${T.navy},${T.navyLight},${T.navy})`,
            backgroundSize:"200% 100%", animation:"prokopim-slide 2s ease infinite",
            animationDelay:`${i*0.2}s` }}/>
          <div style={{ padding:"14px 16px", display:"flex", gap:12 }}>
            <SkeletonLine width={50} height={60} radius={10}/>
            <div style={{ flex:1 }}>
              <SkeletonLine width="75%" height={14} radius={5} mb={6}/>
              <SkeletonLine width="50%" height={11} radius={4} mb={10}/>
              <div style={{ display:"flex", gap:6 }}>
                <SkeletonLine width={90} height={32} radius={10}/>
                <SkeletonLine width={90} height={32} radius={10}/>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonLine({ width, height, radius = 6, mb = 0 }) {
  return (
    <div style={{
      width: typeof width === "number" ? width : width,
      height, borderRadius: radius,
      marginBottom: mb,
      background:"linear-gradient(90deg,#F1F5F9 25%,#E8EDF4 50%,#F1F5F9 75%)",
      backgroundSize:"200% 100%",
      animation:"prokopim-slide 1.6s ease infinite",
    }}/>
  );
}

// ════════════════════════════════════════════════════════════
// KOMPONEN: EmptyState — estetik, berbeda per arketipe
// ════════════════════════════════════════════════════════════
export function ZenEmptyState({ archetype = "executive", isMobile }) {
  const configs = {
    executive: {
      icon: "🌿",
      title: "Tidak ada agenda mendatang",
      sub: "Jadwal Anda bersih. Selamat menikmati waktu.",
      accent: T.gold,
    },
    operational: {
      icon: "📋",
      title: "Belum ada penugasan",
      sub: "Kasubbag akan menugaskan Anda pada kegiatan yang relevan.",
      accent: "#6EE7B7",
    },
    management: {
      icon: "📊",
      title: "Tidak ada jadwal ditemukan",
      sub: "Belum ada jadwal yang sesuai filter aktif.",
      accent: "#93C5FD",
    },
  };

  const cfg = configs[archetype] || configs.executive;

  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding: isMobile ? "56px 24px" : "72px 40px",
      textAlign:"center", minHeight:300,
    }}>
      {/* Lingkaran konsentrik */}
      <div style={{ position:"relative", width:120, height:120, marginBottom:28 }}>
        {[0,14,28].map((inset, i) => (
          <div key={i} style={{
            position:"absolute", inset,
            borderRadius:"50%",
            border:`1.5px solid ${cfg.accent}`,
            opacity: 0.08 + i * 0.07,
            animation:`prokopim-pulse ${2 + i * 0.4}s ease infinite`,
            animationDelay:`${i * 0.3}s`,
          }}/>
        ))}
        <div style={{
          position:"absolute", inset:0,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:42,
        }}>
          {cfg.icon}
        </div>
      </div>

      <div style={{
        fontSize: isMobile ? 17 : 19, fontWeight:800, color:T.navy,
        marginBottom:10, letterSpacing:-0.5,
      }}>
        {cfg.title}
      </div>
      <div style={{
        fontSize:13, color:T.slate, maxWidth:260, lineHeight:1.7,
      }}>
        {cfg.sub}
      </div>

      {/* Garis dekoratif */}
      <div style={{ marginTop:32, display:"flex", gap:5, alignItems:"center" }}>
        {[20,10,5,10,20].map((w,i) => (
          <div key={i} style={{
            width:w, height:2, borderRadius:99,
            background: i === 2
              ? cfg.accent
              : `${cfg.accent}40`,
          }}/>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ARKETIPE 1: ExecutiveView — Pure Zen
// Role: walikota, wakilwalikota, mitra_kerja
// ════════════════════════════════════════════════════════════
function ExecutiveView({ events, role, user, upd, showT, isMobile, setDelegTarget }) {
  const now     = new Date();
  const today   = localDateStr();
  const isVIP   = role === "walikota" || role === "wakilwalikota";
  const isMitra = role === "mitra_kerja";

  const myEvs = useMemo(() => {
    const approved = events.filter(e => e.alur === "disetujui");
    if (role === "walikota")
      return approved.filter(e => (e.untukPimpinan||[]).includes("walikota"));
    if (role === "wakilwalikota")
      return approved.filter(e => (e.untukPimpinan||[]).includes("wakilwalikota") || e.delegasiKeWWK);
    return approved; // mitra_kerja: semua
  }, [events, role]);

  const sorted   = [...myEvs].sort((a,b) => (a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));
  const upcoming = sorted.filter(e => new Date(`${e.tanggal}T${e.jam}`) >= now);
  const past     = sorted.filter(e => new Date(`${e.tanggal}T${e.jam}`) <  now).reverse().slice(0,3);
  const next     = upcoming[0] || null;
  const rest     = upcoming.slice(1);

  const hour     = now.getHours();
  const greeting = hour<11?"Selamat Pagi":hour<15?"Selamat Siang":hour<18?"Selamat Sore":"Selamat Malam";

  return (
    <div style={{ flex:1, overflowY:"auto", background:T.bg, paddingBottom:40,
      WebkitOverflowScrolling:"touch" }}>

      {/* ── Header Executive ── */}
      <div style={{
        background:`linear-gradient(160deg,${T.navy} 0%,${T.navyMid} 60%,${T.navyLight} 100%)`,
        padding: isMobile ? "22px 20px 26px" : "32px 40px 36px",
        position:"relative", overflow:"hidden",
      }}>
        {/* Ornamen geometris */}
        <div style={{ position:"absolute", top:-60, right:-60, width:200, height:200,
          borderRadius:"50%", border:`1.5px solid ${T.goldSoft}`, opacity:0.4 }}/>
        <div style={{ position:"absolute", top:-30, right:-30, width:100, height:100,
          borderRadius:"50%", background:`radial-gradient(circle,${T.goldSoft},transparent)` }}/>
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:1,
          background:`linear-gradient(90deg,transparent,${T.gold}40,transparent)` }}/>

        <div style={{ color:`${T.gold}99`, fontSize:11, fontWeight:700,
          letterSpacing:2.5, textTransform:"uppercase", marginBottom:8, position:"relative" }}>
          {greeting}
        </div>
        <div style={{ color:"white", fontSize: isMobile ? 22 : 26,
          fontWeight:900, marginBottom:6, position:"relative", letterSpacing:-0.5 }}>
          {user?.nama || (isVIP ? "Pimpinan" : "Mitra Kerja")}
        </div>
        <div style={{ color:`${T.gold}CC`, fontSize:12, fontWeight:600, position:"relative" }}>
          {fmtTgl(today)} &nbsp;·&nbsp;
          {upcoming.length} agenda mendatang
        </div>
      </div>

      <div style={{ padding: isMobile ? "16px 16px 0" : "24px 32px 0" }}>

        {/* ── HERO CARD: Agenda Berikutnya ── */}
        {next ? (
          <ExecutiveHeroCard
            ev={next} role={role} isVIP={isVIP} isMobile={isMobile}
            upd={upd} showT={showT} setDelegTarget={setDelegTarget}
          />
        ) : (
          <ZenEmptyState archetype="executive" isMobile={isMobile}/>
        )}

        {/* ── Rest agenda — minimized ── */}
        {rest.length > 0 && (
          <div style={{ marginTop:20 }}>
            <SectionLabel label="Agenda Selanjutnya" color={T.gold}/>
            {rest.slice(0, 6).map(ev => (
              <ExecutiveMiniCard key={ev.id} ev={ev} role={role} now={now}/>
            ))}
          </div>
        )}

        {/* ── Riwayat singkat ── */}
        {past.length > 0 && (
          <div style={{ marginTop:24, paddingBottom:8 }}>
            <SectionLabel label="Baru Selesai" color="#94A3B8"/>
            {past.map(ev => (
              <ExecutiveMiniCard key={ev.id} ev={ev} role={role} now={now} isPast/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Kartu hero besar untuk Executive
function ExecutiveHeroCard({ ev, role, isVIP, isMobile, upd, showT, setDelegTarget }) {
  const now      = new Date();
  const evTime   = new Date(`${ev.tanggal}T${ev.jam}`);
  const diffMs   = evTime - now;
  const isToday  = ev.tanggal === localDateStr();
  const { text: etaText, urgent, imminent } = timeLeft(ev.tanggal, ev.jam);

  const stripColor = imminent
    ? "linear-gradient(90deg,#DC2626,#B91C1C)"
    : urgent
      ? "linear-gradient(90deg,#D97706,#B45309)"
      : `linear-gradient(90deg,${T.navy},${T.navyLight})`;

  const statusKey = role === "walikota" ? "statusWK" : "statusWWK";
  const byKey     = role === "walikota" ? "statusWK_by" : "statusWWK_by";
  const st        = role === "walikota" ? ev.statusWK : ev.statusWWK;
  const locked    = (now - evTime) > 2 * 24 * 60 * 60 * 1000;

  return (
    <div style={{
      background:"white",
      borderRadius:24,
      overflow:"hidden",
      boxShadow:"0 12px 48px rgba(10,22,40,0.12), 0 2px 8px rgba(10,22,40,0.06)",
      border:`1.5px solid ${urgent || imminent ? (imminent?"#FECACA":"#FDE68A") : "#E8EDF4"}`,
      transition:"border-color 0.5s ease",
    }}>
      {/* Strip status */}
      <div style={{ background:stripColor, padding:"8px 20px",
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ color:"white", fontSize:10, fontWeight:900,
          letterSpacing:2, textTransform:"uppercase" }}>
          {imminent ? "🔴 SEKARANG" : urgent ? "⚡ SEGERA" : isToday ? "● HARI INI" : "BERIKUTNYA"}
        </span>
        <span style={{ color:"rgba(255,255,255,0.75)", fontSize:11, fontWeight:600 }}>
          {etaText}
        </span>
      </div>

      <div style={{ padding: isMobile ? "20px 20px 0" : "28px 28px 0" }}>
        {/* Jam besar */}
        <div style={{ marginBottom:6 }}>
          <span style={{ fontSize: isMobile ? 56 : 68, fontWeight:900,
            color:T.navy, letterSpacing:-3, lineHeight:1 }}>
            {ev.jam?.slice(0,5)}
          </span>
          <span style={{ fontSize:14, color:T.slate, fontWeight:600,
            marginLeft:8, verticalAlign:"bottom", paddingBottom:8, display:"inline-block" }}>
            WITA
          </span>
        </div>

        {/* Nama acara */}
        <div style={{ fontSize: isMobile ? 18 : 21, fontWeight:800,
          color:T.navy, lineHeight:1.3, marginBottom:14 }}>
          {ev.namaAcara}
        </div>

        {/* Detail row */}
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
          {ev.lokasi && (
            <DetailRow icon="📍" text={ev.lokasi} bold/>
          )}
          {ev.penyelenggara && (
            <DetailRow icon="🏢" text={ev.penyelenggara}/>
          )}
          {ev.pakaian && (
            <DetailRow icon="👔" text={ev.pakaian}/>
          )}
          {!isToday && (
            <DetailRow icon="🗓" text={fmtTgl(ev.tanggal)}/>
          )}
        </div>

        {/* Widget Cuaca */}
        {(ev.lat || ev.lng) && (
          <div style={{ marginBottom:16 }}>
            <WeatherBadge
              lat={ev.lat} lng={ev.lng}
              tanggal={ev.tanggal} jam={ev.jam}
            />
          </div>
        )}

        {/* Naskah sambutan */}
        {ev.sambutanFile && (
          <div style={{
            background:T.greenBg, border:`1.5px solid #6EE7B7`,
            borderRadius:14, padding:"12px 14px", marginBottom:16,
          }}>
            <div style={{ fontSize:11, fontWeight:800, color:T.green,
              marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
              📄 Naskah Sambutan Tersedia
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button
                onClick={() => window.open(ev.sambutanFile, "_blank")}
                style={btnStyle({ bg:T.green, color:"white", flex:1 })}>
                Baca Naskah
              </button>
              <a href={ev.sambutanFile} download={ev.sambutanNama}
                style={{ ...btnStyle({ bg:"white", color:T.green, flex:1 }),
                  border:`1.5px solid ${T.green}`, textDecoration:"none",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                Unduh PDF
              </a>
            </div>
          </div>
        )}

        {/* ── KONFIRMASI KEHADIRAN — hanya VIP, sangat premium ── */}
        {isVIP && !locked && (
          <KehadiranSection
            ev={ev} role={role} statusKey={statusKey} byKey={byKey}
            st={st} upd={upd} showT={showT} setDelegTarget={setDelegTarget}
            isMobile={isMobile}
          />
        )}
      </div>
    </div>
  );
}

// Panel konfirmasi kehadiran — ultra premium, touch-friendly
function KehadiranSection({ ev, role, statusKey, byKey, st, upd, showT, setDelegTarget, isMobile }) {
  const isWK = role === "walikota";
  const [pressed, setPressed] = useState(null);

  const confirm = (status) => {
    setPressed(status);
    setTimeout(() => {
      upd(ev.id, { [statusKey]: status, [byKey]: role });
      showT("Kehadiran dikonfirmasi ✓");
      setPressed(null);
    }, 250);
  };

  return (
    <div style={{
      borderTop:`1.5px solid #F1F5F9`,
      padding: isMobile ? "16px 0 20px" : "20px 0 24px",
    }}>
      <div style={{ fontSize:10, fontWeight:700, color:"#94A3B8",
        textTransform:"uppercase", letterSpacing:1.5, marginBottom:14 }}>
        Konfirmasi Kehadiran
      </div>

      {st ? (
        // Status sudah terisi — tampilkan badge premium + tombol ubah kecil
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{
            display:"inline-flex", alignItems:"center", gap:10,
            padding:"10px 18px",
            borderRadius:50,
            background: st==="hadir" ? T.greenBg : st==="tidak_hadir" ? T.redBg : T.amberBg,
            border:`1.5px solid ${st==="hadir"?"#6EE7B7":st==="tidak_hadir"?"#FCA5A5":"#FDE68A"}`,
          }}>
            <span style={{ fontSize:18 }}>
              {st==="hadir"?"✅":st==="tidak_hadir"?"❌":"🔄"}
            </span>
            <span style={{
              fontSize:13, fontWeight:800,
              color: st==="hadir"?T.green:st==="tidak_hadir"?T.red:T.amber,
            }}>
              {st==="hadir"?"Konfirmasi Hadir"
               :st==="tidak_hadir"?"Tidak Hadir"
               :ev.delegasiKeWWK?"Delegasi ke Wawali":"Diwakilkan"}
            </span>
          </div>
          <button
            onClick={() => upd(ev.id, { [statusKey]: null, [byKey]: null })}
            style={btnStyle({ bg:"#F1F5F9", color:T.slate, px:12, py:8,
              fontSize:11, radius:20 })}>
            Ubah
          </button>
        </div>
      ) : (
        // Belum ada status — tombol besar premium
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {/* Hadir & Tidak Hadir */}
          <div style={{ display:"flex", gap:10 }}>
            {[
              { s:"hadir",       l:"✓  Saya Hadir",    c:T.green,  bg:T.greenBg },
              { s:"tidak_hadir", l:"✗  Tidak Hadir",   c:T.red,    bg:T.redBg   },
            ].map(({ s, l, c, bg }) => (
              <button
                key={s}
                onClick={() => confirm(s)}
                style={{
                  flex:1, padding:"15px 10px", borderRadius:16,
                  cursor:"pointer", fontWeight:800, fontSize:14,
                  border:`2px solid ${c}`,
                  background: pressed===s ? c : bg,
                  color: pressed===s ? "white" : c,
                  transition:"all 0.15s cubic-bezier(0.34,1.56,0.64,1)",
                  transform: pressed===s ? "scale(0.97)" : "scale(1)",
                  WebkitTapHighlightColor:"transparent",
                  userSelect:"none",
                }}>
                {l}
              </button>
            ))}
          </div>

          {/* Delegasi — hanya Wali Kota */}
          {isWK && (
            <button
              onClick={() => {
                upd(ev.id, { statusWK:"diwakilkan", delegasiKeWWK:true, perwakilanWK:"", statusWK_by:"walikota" });
                showT("Didelegasi ke Wakil Wali Kota");
              }}
              style={{
                width:"100%", padding:"13px", borderRadius:14,
                border:`1.5px solid ${T.navyLight}`,
                background: ev.delegasiKeWWK ? T.navy : "white",
                color: ev.delegasiKeWWK ? T.gold : T.navyLight,
                cursor:"pointer", fontSize:13, fontWeight:700,
                transition:"all 0.2s ease",
                WebkitTapHighlightColor:"transparent",
              }}>
              {ev.delegasiKeWWK ? "✓ Delegasi ke Wakil Wali Kota" : "↩ Delegasi ke Wakil Wali Kota"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Kartu mini untuk "agenda selanjutnya"
function ExecutiveMiniCard({ ev, role, now, isPast }) {
  const isToday = ev.tanggal === localDateStr();
  const { urgent } = timeLeft(ev.tanggal, ev.jam);
  const st = role === "walikota" ? ev.statusWK : ev.statusWWK;
  const stColor = st==="hadir"?T.green:st==="tidak_hadir"?T.red:T.amber;
  const stBg    = st==="hadir"?T.greenBg:st==="tidak_hadir"?T.redBg:T.amberBg;
  const stText  = st==="hadir"?"Hadir":st==="tidak_hadir"?"Tidak Hadir":st?"Diwakilkan":"—";

  return (
    <div style={{
      background:"white", borderRadius:14, marginBottom:8,
      padding:"12px 14px", display:"flex", alignItems:"center", gap:12,
      opacity: isPast ? 0.55 : 1,
      border:`1px solid ${urgent && !isPast ? "#FDE68A" : "#F1F5F9"}`,
      boxShadow:"0 1px 4px rgba(10,22,40,0.05)",
    }}>
      <div style={{
        minWidth:48, textAlign:"center", flexShrink:0,
        background: isToday && !isPast
          ? `linear-gradient(135deg,${T.navy},${T.navyLight})`
          : "#F8FAFF",
        borderRadius:10, padding:"7px 4px",
      }}>
        <div style={{ fontSize:14, fontWeight:900,
          color: isToday && !isPast ? T.gold : "#334155", lineHeight:1 }}>
          {ev.jam?.slice(0,5)}
        </div>
        {!isToday && (
          <div style={{ fontSize:9, color:"#94A3B8", marginTop:2 }}>
            {fmtTgl(ev.tanggal).split(",")[0]}
          </div>
        )}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.navy,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {ev.namaAcara}
        </div>
        <div style={{ fontSize:11, color:T.slate, marginTop:2 }}>
          {ev.lokasi || ev.penyelenggara || "—"}
        </div>
      </div>
      {st && !isPast && (
        <span style={{ background:stBg, color:stColor, borderRadius:20,
          padding:"2px 10px", fontSize:10, fontWeight:700, flexShrink:0 }}>
          {stText}
        </span>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ARKETIPE 2: OperationalView — Actionable Zen
// Role: ajudan_walikota, ajudan_wakilwalikota, timkom, staf
// ════════════════════════════════════════════════════════════
function OperationalView({ events, role, user, upd, showT, isMobile }) {
  const now       = new Date();
  const today     = localDateStr();
  const tomorrow  = (() => {
    const d = new Date(); d.setDate(d.getDate()+1);
    return localDateStr(d);
  })();

  const isAjudan  = role.startsWith("ajudan_");
  const isWK      = role === "ajudan_walikota";
  const pimLabel  = isWK ? "Wali Kota" : "Wakil Wali Kota";

  const myEvs = useMemo(() => {
    const approved = events.filter(e => e.alur === "disetujui");
    if (isAjudan) {
      return approved.filter(e =>
        isWK
          ? (e.untukPimpinan||[]).includes("walikota")
          : (e.untukPimpinan||[]).includes("wakilwalikota") || e.delegasiKeWWK
      );
    }
    // staf/timkom: hanya yang ditugaskan
    return approved.filter(e => (e.personil||[]).includes(user?.username));
  }, [events, role, user]);

  const sorted   = [...myEvs].sort((a,b) => (a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));
  const todayEvs = sorted.filter(e => e.tanggal === today);
  const tmrwEvs  = sorted.filter(e => e.tanggal === tomorrow);
  const moreEvs  = sorted.filter(e => e.tanggal > tomorrow).slice(0,5);

  const unconfirmed = isAjudan
    ? myEvs.filter(e => {
        const st = isWK ? e.statusWK : e.statusWWK;
        return !st && new Date(`${e.tanggal}T${e.jam}`) > now;
      })
    : [];

  const hour = now.getHours();
  const roleColor = {
    ajudan_walikota:       T.gold,
    ajudan_wakilwalikota:  "#6EE7B7",
    timkom:                "#A78BFA",
    staf:                  "#93C5FD",
  }[role] || T.gold;

  const roleGrad = {
    ajudan_walikota:       `linear-gradient(160deg,${T.navy},#1A2F5E)`,
    ajudan_wakilwalikota:  `linear-gradient(160deg,${T.navy},#0D2B3E)`,
    timkom:                `linear-gradient(160deg,#2D1B6E,#4C1D95)`,
    staf:                  `linear-gradient(160deg,${T.navy},#1A2F5E)`,
  }[role] || `linear-gradient(160deg,${T.navy},#1A3060)`;

  return (
    <div style={{ flex:1, overflowY:"auto", background:T.bg, paddingBottom:40 }}>

      {/* ── Header Operational ── */}
      <div style={{
        background:roleGrad,
        padding: isMobile ? "20px 18px 22px" : "28px 36px",
        position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute", top:-20, right:-20, width:100, height:100,
          borderRadius:"50%", background:`radial-gradient(circle,${roleColor}18,transparent)` }}/>

        <div style={{ color:`${roleColor}99`, fontSize:10, fontWeight:700,
          letterSpacing:2, textTransform:"uppercase", marginBottom:5 }}>
          {role === "timkom" ? "Tim Komunikasi" : role === "staf" ? "Staf Protokol" : `Ajudan ${pimLabel}`}
        </div>
        <div style={{ color:"white", fontSize: isMobile ? 19 : 23,
          fontWeight:900, marginBottom:10 }}>
          {user?.nama || "Pengguna"}
        </div>

        {/* Stats pills */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[
            { v:todayEvs.length, l:"Hari Ini",  c:roleColor },
            { v:tmrwEvs.length,  l:"Besok",      c:"rgba(255,255,255,0.6)" },
            ...(unconfirmed.length > 0
              ? [{ v:unconfirmed.length, l:"Belum Konfirmasi", c:"#FCA5A5" }]
              : []),
          ].map(({ v, l, c }) => (
            <div key={l} style={{
              background:"rgba(255,255,255,0.08)",
              border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:20, padding:"5px 12px",
              display:"flex", alignItems:"center", gap:6,
            }}>
              <span style={{ fontSize:15, fontWeight:900, color:c }}>{v}</span>
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.5)" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: isMobile ? "12px" : "16px 28px" }}>

        {/* Alert belum konfirmasi */}
        {unconfirmed.length > 0 && (
          <AlertBanner
            icon="⚠️"
            title={`${unconfirmed.length} agenda belum dikonfirmasi ${pimLabel}`}
            sub="Segera koordinasikan dan input konfirmasi kehadiran."
            color="#D97706" bg="#FFFBEB" border="#FDE68A"
          />
        )}

        {todayEvs.length > 0
          ? <OpSection label="🎯 Hari Ini" events={todayEvs} role={role}
              isAjudan={isAjudan} isWK={isWK} pimLabel={pimLabel}
              upd={upd} showT={showT} now={now} accentColor={roleColor}/>
          : <div style={{
              background:"white", borderRadius:14, padding:"16px 18px",
              marginBottom:14, display:"flex", gap:10, alignItems:"center",
              border:`1px solid #F1F5F9`,
              boxShadow:"0 1px 4px rgba(10,22,40,0.04)",
            }}>
              <span style={{ fontSize:24 }}>☀️</span>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:T.navy }}>Tidak ada tugas hari ini</div>
                <div style={{ fontSize:12, color:T.slate, marginTop:2 }}>Cek tugas mendatang di bawah.</div>
              </div>
            </div>
        }

        {tmrwEvs.length > 0 &&
          <OpSection label="📅 Besok" events={tmrwEvs} role={role}
            isAjudan={isAjudan} isWK={isWK} pimLabel={pimLabel}
            upd={upd} showT={showT} now={now} accentColor={roleColor}/>
        }

        {moreEvs.length > 0 &&
          <OpSection label="🗓 Mendatang" events={moreEvs} role={role}
            isAjudan={isAjudan} isWK={isWK} pimLabel={pimLabel}
            upd={upd} showT={showT} now={now} accentColor={roleColor} compact/>
        }

        {myEvs.length === 0 &&
          <ZenEmptyState archetype="operational" isMobile={isMobile}/>
        }
      </div>
    </div>
  );
}

function OpSection({ label, events, role, isAjudan, isWK, pimLabel, upd, showT, now, accentColor, compact }) {
  return (
    <div style={{ marginBottom:20 }}>
      <SectionLabel label={label} color={accentColor}/>
      {events.map(ev => (
        <OperationalCard
          key={ev.id} ev={ev} role={role}
          isAjudan={isAjudan} isWK={isWK} pimLabel={pimLabel}
          upd={upd} showT={showT} now={now} compact={compact}
        />
      ))}
    </div>
  );
}

function OperationalCard({ ev, role, isAjudan, isWK, pimLabel, upd, showT, now, compact }) {
  const [expanded, setExpanded] = useState(false);
  const { text: etaText, urgent, imminent } = timeLeft(ev.tanggal, ev.jam);
  const isToday = ev.tanggal === localDateStr();
  const statusKey = isWK ? "statusWK" : "statusWWK";
  const byKey     = isWK ? "statusWK_by" : "statusWWK_by";
  const st        = isWK ? ev.statusWK : ev.statusWWK;
  const stColor   = st==="hadir"?T.green:st==="tidak_hadir"?T.red:T.amber;
  const stBg      = st==="hadir"?T.greenBg:st==="tidak_hadir"?T.redBg:T.amberBg;
  const stText    = st==="hadir"?"✓ Hadir":st==="tidak_hadir"?"✗ Tidak":st?"Diwakilkan":"⏳ Belum";

  const mapsUrl = ev.lokasi
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.lokasi+" Tarakan")}`
    : null;

  const borderColor = imminent?"#FECACA":urgent?"#FDE68A":"#E8EDF4";

  return (
    <div style={{
      background:"white", border:`1.5px solid ${borderColor}`,
      borderRadius:16, marginBottom:8, overflow:"hidden",
      boxShadow:"0 2px 12px rgba(10,22,40,0.06)",
      transition:"border-color 0.4s ease",
    }}>
      {/* Kritis strip */}
      {isToday && (imminent || urgent) && (
        <div style={{
          background: imminent
            ? "linear-gradient(90deg,#DC2626,#B91C1C)"
            : "linear-gradient(90deg,#D97706,#B45309)",
          padding:"4px 14px",
          display:"flex", justifyContent:"space-between", alignItems:"center",
        }}>
          <span style={{ fontSize:10, fontWeight:900, color:"white", letterSpacing:1 }}>
            {imminent ? "🔴 SEKARANG" : "⚡ SEGERA"}
          </span>
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.75)" }}>{etaText}</span>
        </div>
      )}

      {/* Baris utama */}
      <div
        onClick={() => !compact && setExpanded(e => !e)}
        style={{ padding:"12px 14px", cursor:compact?"default":"pointer",
          display:"flex", gap:12, alignItems:"flex-start" }}>
        {/* Jam block */}
        <div style={{
          minWidth:50, textAlign:"center", flexShrink:0,
          background: isToday
            ? `linear-gradient(135deg,${T.navy},${T.navyLight})`
            : "#F8FAFF",
          borderRadius:10, padding:"7px 4px",
        }}>
          <div style={{ fontSize:14, fontWeight:900,
            color: isToday ? T.gold : "#334155", lineHeight:1 }}>
            {ev.jam?.slice(0,5)}
          </div>
          {!isToday && (
            <div style={{ fontSize:9, color:"#94A3B8", marginTop:2 }}>
              {fmtTgl(ev.tanggal).split(",")[0]}
            </div>
          )}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.navy,
            lineHeight:1.3, marginBottom:3 }}>
            {ev.namaAcara}
          </div>
          {ev.lokasi && (
            <div style={{ fontSize:12, color:T.slate, marginBottom:4,
              display:"flex", gap:4, alignItems:"center" }}>
              <span>📍</span>{ev.lokasi}
            </div>
          )}
          {/* Cuaca inline */}
          {(ev.lat||ev.lng) && (
            <div style={{ marginTop:4 }}>
              <WeatherBadge lat={ev.lat} lng={ev.lng}
                tanggal={ev.tanggal} jam={ev.jam} compact/>
            </div>
          )}
          {isAjudan && st && (
            <span style={{ background:stBg, color:stColor, borderRadius:20,
              padding:"2px 10px", fontSize:10, fontWeight:700, marginTop:4, display:"inline-block" }}>
              {pimLabel}: {stText}
            </span>
          )}
        </div>
        {!compact && (
          <div style={{ color:"#CBD5E1", fontSize:11,
            transition:"transform 0.2s",
            transform: expanded ? "rotate(180deg)" : "none",
            flexShrink:0, marginTop:4 }}>▼</div>
        )}
      </div>

      {/* ── Panel aksi cepat (expanded) ── */}
      {expanded && !compact && (
        <div style={{ borderTop:"1px solid #F1F5F9", padding:"12px 14px",
          background:"#FAFBFF" }}>

          {/* Info tambahan */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
            {[
              { l:"Penyelenggara", v:ev.penyelenggara },
              { l:"Pakaian", v:ev.pakaian },
              { l:"Kontak", v:ev.kontak },
            ].filter(f=>f.v).map(f => (
              <div key={f.l} style={{ background:"#F1F5F9", borderRadius:8, padding:"4px 10px" }}>
                <div style={{ fontSize:9, color:"#94A3B8", fontWeight:700, textTransform:"uppercase" }}>{f.l}</div>
                <div style={{ fontSize:11, color:"#334155", fontWeight:600 }}>{f.v}</div>
              </div>
            ))}
          </div>

          {/* Tombol aksi cepat */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>

            {/* Maps */}
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                  padding:"12px", borderRadius:12,
                  background:"linear-gradient(135deg,#1A73E8,#0D5DBE)",
                  color:"white", textDecoration:"none", fontSize:13, fontWeight:700,
                  boxShadow:"0 4px 14px rgba(26,115,232,0.3)",
                  WebkitTapHighlightColor:"transparent",
                }}>
                🗺️ Navigasi ke Lokasi
              </a>
            )}

            {/* Konfirmasi kehadiran pimpinan — khusus ajudan */}
            {isAjudan && (
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:"#94A3B8",
                  textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>
                  Kehadiran {pimLabel}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  {[
                    { s:"hadir",       l:"✓ Hadir",      c:T.green },
                    { s:"tidak_hadir", l:"✗ Tidak Hadir", c:T.red   },
                  ].map(({ s, l, c }) => (
                    <button key={s}
                      onClick={() => {
                        upd(ev.id, { [statusKey]:s, [byKey]:"ajudan" });
                        showT(`Kehadiran ${pimLabel} dicatat`);
                      }}
                      style={{
                        flex:1, padding:"11px 8px", borderRadius:11,
                        cursor:"pointer", fontWeight:800, fontSize:12,
                        border:`2px solid ${c}`,
                        background: st===s ? c : "white",
                        color: st===s ? "white" : c,
                        transition:"all 0.15s",
                        WebkitTapHighlightColor:"transparent",
                      }}>
                      {l}
                    </button>
                  ))}
                </div>
                {isWK && (
                  <button
                    onClick={() => {
                      upd(ev.id, { statusWK:"diwakilkan", delegasiKeWWK:true,
                        perwakilanWK:"", statusWK_by:"ajudan" });
                      showT("Delegasi ke Wakil WK dicatat");
                    }}
                    style={{
                      width:"100%", marginTop:8, padding:"10px", borderRadius:10,
                      border:`1.5px solid #7C3AED`,
                      background: ev.delegasiKeWWK ? "#7C3AED" : "white",
                      color: ev.delegasiKeWWK ? "white" : "#7C3AED",
                      cursor:"pointer", fontSize:12, fontWeight:700,
                      WebkitTapHighlightColor:"transparent",
                    }}>
                    {ev.delegasiKeWWK ? "✓ Delegasi ke Wakil WK" : "↩ Delegasi ke Wakil WK"}
                  </button>
                )}
              </div>
            )}

            {/* Naskah sambutan */}
            {ev.sambutanFile && (
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => window.open(ev.sambutanFile, "_blank")}
                  style={btnStyle({ bg:"white", color:T.green, flex:1,
                    border:`1.5px solid ${T.green}` })}>
                  📄 Baca Naskah
                </button>
                <a href={ev.sambutanFile} download={ev.sambutanNama}
                  style={{ ...btnStyle({ bg:T.green, color:"white", flex:1 }),
                    textDecoration:"none", display:"flex",
                    alignItems:"center", justifyContent:"center" }}>
                  ⬇ Unduh
                </a>
              </div>
            )}

            {/* Arahan pimpinan */}
            {ev.catatanPimpinan && (
              <div style={{ background:"#EEF2FF", borderRadius:10, padding:"10px 12px",
                fontSize:12, color:"#3730A3", fontStyle:"italic", lineHeight:1.5 }}>
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
// ARKETIPE 3: ManagementView — Organized Zen
// Role: admin_rk, kasubbag_protokol, kasubbag_komdokpim, kabag
// ════════════════════════════════════════════════════════════
function ManagementView({ events, role, user, upd, showT, isMobile, setTab }) {
  const now    = new Date();
  const today  = localDateStr();
  const [filterDate, setFilterDate]     = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch]             = useState("");

  const isKabag    = role === "kabag";
  const isKasubbag = role.startsWith("kasubbag_");
  const isAdmin    = role === "admin_rk";

  const roleLabel = {
    kabag:              "Kabag Prokopim",
    kasubbag_protokol:  "Kasubbag Protokol",
    kasubbag_komdokpim: "Kasubbag Komdokpim",
    admin_rk:           "Admin Rencana Kegiatan",
  }[role] || "Manajemen";

  const pendingCount = events.filter(e =>
    (isKabag && e.alur === "menunggu_kabag") ||
    (isKasubbag && e.alur === "menunggu_kasubbag")
  ).length;

  const todayEvs   = events.filter(e => e.alur==="disetujui" && e.tanggal===today);
  const weekEvs    = events.filter(e => e.alur==="disetujui");
  const rejectedEvs = isAdmin
    ? events.filter(e => e.alur==="ditolak" && e.submittedBy===user?.username)
    : [];

  const filtered = useMemo(() => {
    let base = events;
    if (filterStatus === "pending") {
      base = base.filter(e =>
        e.alur === "menunggu_kasubbag" || e.alur === "menunggu_kabag"
      );
    } else if (filterStatus === "approved") {
      base = base.filter(e => e.alur === "disetujui");
    } else if (filterStatus === "draft") {
      base = base.filter(e => e.alur === "draft" || e.alur === "ditolak");
    }
    if (filterDate) base = base.filter(e => e.tanggal === filterDate);
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(e =>
        e.namaAcara?.toLowerCase().includes(q) ||
        e.penyelenggara?.toLowerCase().includes(q) ||
        e.lokasi?.toLowerCase().includes(q)
      );
    }
    return [...base].sort((a,b) => (a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));
  }, [events, filterDate, filterStatus, search]);

  const hour = now.getHours();

  return (
    <div style={{ flex:1, overflowY:"auto", background:T.bg, paddingBottom:40 }}>

      {/* ── Header Management ── */}
      <div style={{
        background:`linear-gradient(160deg,${T.navy},${T.navyMid})`,
        padding: isMobile ? "20px 18px 22px" : "28px 36px",
        position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:1,
          background:`linear-gradient(90deg,transparent,${T.gold}30,transparent)` }}/>

        <div style={{ color:`${T.gold}80`, fontSize:10, fontWeight:700,
          letterSpacing:2, textTransform:"uppercase", marginBottom:5 }}>
          {roleLabel}
        </div>
        <div style={{ color:"white", fontSize: isMobile ? 19 : 22, fontWeight:900, marginBottom:12 }}>
          {user?.nama || roleLabel}
        </div>

        {/* Stat cards row */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[
            { v:todayEvs.length,     l:"Hari Ini",   c:T.gold,    icon:"📅" },
            { v:weekEvs.length,      l:"Total Aktif", c:"#93C5FD", icon:"📊" },
            ...(pendingCount > 0
              ? [{ v:pendingCount, l:"Perlu Persetujuan", c:"#FCA5A5", icon:"⏳" }]
              : []),
            ...(rejectedEvs.length > 0
              ? [{ v:rejectedEvs.length, l:"Dikembalikan", c:"#FCA5A5", icon:"↩️" }]
              : []),
          ].map(({ v, l, c, icon }) => (
            <div key={l} style={{
              background:"rgba(255,255,255,0.07)",
              border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:12, padding:"8px 12px",
              display:"flex", alignItems:"center", gap:8,
            }}>
              <span style={{ fontSize:16 }}>{icon}</span>
              <div>
                <div style={{ fontSize:18, fontWeight:900, color:c, lineHeight:1 }}>{v}</div>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.45)", marginTop:1 }}>{l}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter & Search bar ── */}
      <div style={{
        background:"white", borderBottom:`1px solid #E8EDF4`,
        padding: isMobile ? "10px 14px" : "12px 28px",
        display:"flex", gap:8, flexWrap:"wrap", alignItems:"center",
        position:"sticky", top:0, zIndex:10,
      }}>
        {/* Search */}
        <div style={{
          flex:1, minWidth:160, display:"flex", alignItems:"center", gap:8,
          background:"#F8FAFC", borderRadius:10, padding:"7px 12px",
          border:"1.5px solid #E8EDF4",
        }}>
          <span style={{ fontSize:14, color:T.slate }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari acara, lokasi..."
            style={{ flex:1, border:"none", background:"transparent",
              fontSize:12, color:T.navy, outline:"none" }}
          />
          {search && (
            <button onClick={() => setSearch("")}
              style={{ border:"none", background:"none",
                color:T.slate, cursor:"pointer", fontSize:14, lineHeight:1 }}>
              ✕
            </button>
          )}
        </div>

        {/* Status filter pills */}
        {[
          { k:"all", l:"Semua" },
          { k:"pending",  l:"Persetujuan" },
          { k:"approved", l:"Disetujui" },
          { k:"draft",    l:"Draft" },
        ].map(({ k, l }) => (
          <button key={k}
            onClick={() => setFilterStatus(k)}
            style={{
              padding:"6px 14px", borderRadius:20, fontSize:11, fontWeight:700,
              border:`1.5px solid ${filterStatus===k ? T.navy : "#E8EDF4"}`,
              background: filterStatus===k
                ? `linear-gradient(135deg,${T.navy},${T.navyLight})`
                : "white",
              color: filterStatus===k ? "white" : T.slate,
              cursor:"pointer", whiteSpace:"nowrap",
              boxShadow: filterStatus===k ? "0 2px 8px rgba(10,22,40,0.2)" : "none",
              WebkitTapHighlightColor:"transparent",
            }}>
            {l}
          </button>
        ))}

        {/* Date filter */}
        <input type="date" value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          style={{
            padding:"6px 10px", borderRadius:10, fontSize:11,
            border:"1.5px solid #E8EDF4", color:T.slate, background:"white",
            cursor:"pointer",
          }}
        />
        {filterDate && (
          <button onClick={() => setFilterDate("")}
            style={btnStyle({ bg:"#FEF2F2", color:T.red, px:10, py:6,
              fontSize:10, radius:8 })}>
            ✕ Reset
          </button>
        )}
      </div>

      {/* ── Daftar jadwal ── */}
      <div style={{ padding: isMobile ? "12px 12px 0" : "16px 28px 0" }}>
        {filtered.length === 0 ? (
          <ZenEmptyState archetype="management" isMobile={isMobile}/>
        ) : (
          <>
            <div style={{ fontSize:11, color:T.slate, fontWeight:600,
              marginBottom:10, textAlign:"right" }}>
              {filtered.length} jadwal ditemukan
            </div>
            {filtered.map(ev => (
              <ManagementCard key={ev.id} ev={ev} role={role}
                upd={upd} showT={showT} now={now} isMobile={isMobile}/>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function ManagementCard({ ev, role, upd, showT, now, isMobile }) {
  const [expanded, setExpanded] = useState(false);
  const isToday  = ev.tanggal === localDateStr();
  const evTime   = new Date(`${ev.tanggal}T${ev.jam}`);
  const isPast   = evTime < now;

  const STATUS_COLORS = {
    draft:              { color:"#64748B", bg:"#F1F5F9", label:"Draft" },
    menunggu_kasubbag:  { color:"#D97706", bg:"#FEF3C7", label:"Menunggu Kasubbag" },
    menunggu_kabag:     { color:"#7C3AED", bg:"#EDE9FE", label:"Menunggu Kabag" },
    disetujui:          { color:"#065F46", bg:"#D1FAE5", label:"Disetujui" },
    ditolak:            { color:"#991B1B", bg:"#FEE2E2", label:"Ditolak" },
  };
  const sc = STATUS_COLORS[ev.alur] || STATUS_COLORS.draft;

  const konfirmasiWK  = ev.statusWK;
  const konfirmasiWWK = ev.statusWWK;
  const konfBadge = (st, label) => {
    const c = st==="hadir"?T.green:st==="tidak_hadir"?T.red:T.amber;
    const b = st==="hadir"?T.greenBg:st==="tidak_hadir"?T.redBg:T.amberBg;
    const t = st==="hadir"?"Hadir":st==="tidak_hadir"?"Tidak Hadir":st?"Diwakilkan":"Belum";
    return (
      <span key={label} style={{ background:b, color:c, borderRadius:20,
        padding:"2px 8px", fontSize:9, fontWeight:700 }}>
        {label}: {t}
      </span>
    );
  };

  return (
    <div style={{
      background:"white",
      border:`1.5px solid ${isToday && !isPast ? T.gold+"66" : "#E8EDF4"}`,
      borderRadius:16, marginBottom:8, overflow:"hidden",
      boxShadow:"0 1px 6px rgba(10,22,40,0.05)",
      opacity: isPast ? 0.75 : 1,
    }}>
      {/* Klik untuk expand */}
      <div onClick={() => setExpanded(e=>!e)}
        style={{ padding:"12px 14px", cursor:"pointer",
          display:"flex", gap:10, alignItems:"flex-start" }}>

        {/* Tanggal block */}
        <div style={{
          minWidth:50, textAlign:"center", flexShrink:0,
          background: isToday && !isPast
            ? `linear-gradient(135deg,${T.navy},${T.navyLight})`
            : "#F8FAFF",
          borderRadius:10, padding:"7px 4px",
        }}>
          <div style={{ fontSize:9, fontWeight:800,
            color: isToday ? T.gold : "#94A3B8",
            textTransform:"uppercase" }}>
            {fmtTgl(ev.tanggal).split(",")[0]}
          </div>
          <div style={{ fontSize:18, fontWeight:900,
            color: isToday ? "white" : T.navy, lineHeight:1.1 }}>
            {ev.tanggal.slice(8)}
          </div>
          <div style={{ fontSize:10, color: isToday ? "rgba(255,255,255,0.6)" : "#94A3B8" }}>
            {ev.jam?.slice(0,5)}
          </div>
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.navy,
            lineHeight:1.3, marginBottom:3,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {ev.namaAcara}
          </div>
          {ev.lokasi && (
            <div style={{ fontSize:11, color:T.slate, marginBottom:5 }}>
              📍 {ev.lokasi}
            </div>
          )}
          {/* Cuaca kecil */}
          {(ev.lat||ev.lng) && (
            <div style={{ marginBottom:5 }}>
              <WeatherBadge lat={ev.lat} lng={ev.lng}
                tanggal={ev.tanggal} jam={ev.jam} compact/>
            </div>
          )}
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, alignItems:"center" }}>
            {/* Status badge */}
            <span style={{ background:sc.bg, color:sc.color, borderRadius:20,
              padding:"2px 9px", fontSize:9, fontWeight:700 }}>
              {sc.label}
            </span>
            {/* Konfirmasi kehadiran */}
            {ev.untukPimpinan?.includes("walikota") && konfirmasiWK &&
              konfBadge(konfirmasiWK, "WK")}
            {(ev.untukPimpinan?.includes("wakilwalikota")||ev.delegasiKeWWK) && konfirmasiWWK &&
              konfBadge(konfirmasiWWK, "WWK")}
          </div>
        </div>

        <div style={{ color:"#CBD5E1", fontSize:11, flexShrink:0, marginTop:4,
          transition:"transform 0.2s",
          transform: expanded ? "rotate(180deg)" : "none" }}>▼</div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop:"1px solid #F1F5F9", padding:"12px 14px",
          background:"#FAFBFF" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr",
            gap:8, marginBottom:12 }}>
            {[
              { l:"Penyelenggara", v:ev.penyelenggara },
              { l:"Pakaian", v:ev.pakaian },
              { l:"Kontak", v:ev.kontak },
              { l:"No. Surat", v:ev.buktiUndangan },
            ].filter(f=>f.v).map(f=>(
              <div key={f.l}>
                <div style={{ fontSize:9, color:"#94A3B8", fontWeight:700,
                  textTransform:"uppercase", letterSpacing:0.5 }}>{f.l}</div>
                <div style={{ fontSize:12, color:T.navy, fontWeight:600, marginTop:1 }}>{f.v}</div>
              </div>
            ))}
          </div>

          {/* Personil */}
          {ev.personil?.length > 0 && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, color:"#94A3B8", fontWeight:700,
                textTransform:"uppercase", marginBottom:5 }}>Personil Bertugas</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {ev.personil.map(u => (
                  <span key={u} style={{ background:"#EFF6FF", color:"#1D4ED8",
                    borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:700,
                    border:"1px solid #BFDBFE" }}>
                    👤 {u}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Catatan tolak */}
          {ev.catatanTolak && (
            <div style={{ background:T.redBg, borderRadius:8,
              padding:"8px 10px", marginBottom:8,
              fontSize:11, color:T.red, lineHeight:1.5 }}>
              ↩️ Catatan penolakan: {ev.catatanTolak}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ════════════════════════════════════════════════════════════

function SectionLabel({ label, color }) {
  return (
    <div style={{
      fontSize:10, fontWeight:800, color:color || T.slate,
      textTransform:"uppercase", letterSpacing:1.5,
      marginBottom:10, display:"flex", alignItems:"center", gap:8,
    }}>
      <div style={{ width:3, height:14, background:color || T.slate, borderRadius:2 }}/>
      {label}
    </div>
  );
}

function DetailRow({ icon, text, bold }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
      <span style={{ fontSize:15, flexShrink:0, marginTop:1 }}>{icon}</span>
      <span style={{ fontSize:13, color:"#334155",
        fontWeight: bold ? 700 : 500, lineHeight:1.4 }}>
        {text}
      </span>
    </div>
  );
}

function AlertBanner({ icon, title, sub, color, bg, border }) {
  return (
    <div style={{
      background:bg, border:`1.5px solid ${border}`,
      borderRadius:12, padding:"12px 14px", marginBottom:14,
      display:"flex", gap:10, alignItems:"flex-start",
    }}>
      <span style={{ fontSize:22, flexShrink:0 }}>{icon}</span>
      <div>
        <div style={{ fontSize:13, fontWeight:700, color }}>{title}</div>
        {sub && <div style={{ fontSize:12, color, opacity:0.8, marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function btnStyle({ bg, color, flex, border, px = 14, py = 11, fontSize = 13, radius = 11 }) {
  return {
    flex, padding:`${py}px ${px}px`,
    borderRadius:radius,
    border: border || "none",
    background:bg, color,
    cursor:"pointer", fontWeight:700, fontSize,
    WebkitTapHighlightColor:"transparent",
    transition:"all 0.15s ease",
    userSelect:"none",
  };
}

// ════════════════════════════════════════════════════════════
// MAIN ROUTER: ZenDashboard
// Titik masuk tunggal — memilah arketipe berdasarkan role
// ════════════════════════════════════════════════════════════
export function ZenDashboard({
  events = [],
  role,
  user,
  upd,
  showT,
  isMobile,
  setDelegTarget,
  setTab,
  loading = false,
}) {
  const archetype = ARCHETYPE[role] || "management";

  // Tampilkan skeleton saat loading
  if (loading) {
    return <ZenSkeletonLoader archetype={archetype} count={3}/>;
  }

  // Router berdasarkan arketipe
  if (archetype === "executive") {
    return (
      <ExecutiveView
        events={events} role={role} user={user}
        upd={upd} showT={showT} isMobile={isMobile}
        setDelegTarget={setDelegTarget}
      />
    );
  }

  if (archetype === "operational") {
    return (
      <OperationalView
        events={events} role={role} user={user}
        upd={upd} showT={showT} isMobile={isMobile}
      />
    );
  }

  // Management (default)
  return (
    <ManagementView
      events={events} role={role} user={user}
      upd={upd} showT={showT} isMobile={isMobile}
      setDelegTarget={setDelegTarget}
      setTab={setTab}
    />
  );
}

export default ZenDashboard;
