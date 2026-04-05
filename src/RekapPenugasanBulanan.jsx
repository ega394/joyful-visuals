import React from "react";

const BULAN_LABEL = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember"
];
const MEDAL = ["🥇","🥈","🥉"];

export default function RekapPenugasanBulanan({ events, user, isMobile, allUsers: allUsersProp }) {
  const NAVY = "#0A1628", GOLD = "#C9A84C";

  const now  = new Date();
  const [bulan,  setBulan]  = React.useState(now.getMonth());
  const [tahun,  setTahun]  = React.useState(now.getFullYear());
  const [timTab, setTimTab] = React.useState("protokol");

  const isKabag  = user?.role === "kabag";
  const isProto  = user?.role === "kasubbag_protokol";
  const isKomdok = user?.role === "kasubbag_komdokpim";

  // ── Semua hooks WAJIB di atas, sebelum return apapun ──
  React.useEffect(() => {
    if (isKomdok) setTimTab("komdok");
    else if (isProto) setTimTab("protokol");
  }, [isKomdok, isProto]);

  const tahunList = [];
  for (let y = 2024; y <= now.getFullYear() + 1; y++) tahunList.push(y);

  const allUsers = React.useMemo(() => allUsersProp || [], [allUsersProp]);

  const stafProto  = React.useMemo(
    () => allUsers.filter(u => ["staf","admin_rk"].includes(u.role)),
    [allUsers]
  );
  const stafKomdok = React.useMemo(
    () => allUsers.filter(u => u.role === "timkom"),
    [allUsers]
  );

  const evBulan = React.useMemo(() => events.filter(e => {
    const d = new Date(e.tanggal);
    return d.getMonth() === bulan && d.getFullYear() === tahun && e.alur === "disetujui";
  }), [events, bulan, tahun]);

  const buildRanking = (stafList) =>
    stafList.map(s => {
      const kegiatan = evBulan.filter(e => (e.personil || []).includes(s.username));
      return { ...s, jumlah: kegiatan.length, kegiatan };
    }).sort((a, b) => b.jumlah - a.jumlah);

  const rankProto  = buildRanking(stafProto);
  const rankKomdok = buildRanking(stafKomdok);

  const activeRank  = timTab === "komdok" ? rankKomdok : rankProto;
  const activeLabel = timTab === "komdok" ? "📸 Tim Kasubbag Komdokpim" : "🎗️ Tim Kasubbag Protokol";

  const totalTugas = activeRank.reduce((s, x) => s + x.jumlah, 0);
  const sudahTugas = activeRank.filter(x => x.jumlah > 0).length;
  const maxTugas   = activeRank.length ? activeRank[0].jumlah : 0;

  // ── Guard akses — setelah SEMUA hooks ──
  if (!isKabag && !isProto && !isKomdok) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>
        Fitur ini tersedia untuk Kabag dan Kasubbag.
      </div>
    );
  }

  // ── Kartu ranking ──
  const RankCard = ({ s, rank }) => {
    const pct    = maxTugas > 0 ? s.jumlah / maxTugas : 0;
    const barClr = rank === 0 ? "#059669" : rank === 1 ? "#3B82F6" : rank === 2 ? "#F59E0B" : "#94A3B8";
    const [open, setOpen] = React.useState(false);

    return (
      <div style={{
        background: "white", borderRadius: 12, marginBottom: 8, overflow: "hidden",
        border: `1.5px solid ${rank < 3 && s.jumlah > 0 ? barClr + "44" : "#E2E8F0"}`,
        boxShadow: rank === 0 && s.jumlah > 0 ? "0 2px 12px rgba(5,150,105,0.12)" : "none",
      }}>
        <div
          style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: s.jumlah > 0 ? "pointer" : "default" }}
          onClick={() => s.jumlah > 0 && setOpen(o => !o)}
        >
          <div style={{ width: 32, textAlign: "center", flexShrink: 0 }}>
            {rank < 3 && s.jumlah > 0
              ? <span style={{ fontSize: 20 }}>{MEDAL[rank]}</span>
              : <span style={{ fontSize: 13, fontWeight: 800, color: "#CBD5E1" }}>#{rank + 1}</span>
            }
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#0F172A", marginBottom: 4 }}>
              {s.nama || s.username}
            </div>
            <div style={{ height: 6, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: (pct * 100) + "%",
                background: barClr, borderRadius: 3, transition: "width 0.5s ease"
              }}/>
            </div>
          </div>

          <div style={{ textAlign: "center", flexShrink: 0, minWidth: 44 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.jumlah > 0 ? NAVY : "#E2E8F0", lineHeight: 1 }}>
              {s.jumlah}
            </div>
            <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
              tugas
            </div>
          </div>

          {s.jumlah > 0 && (
            <div style={{ fontSize: 12, color: "#CBD5E1", flexShrink: 0 }}>{open ? "▲" : "▼"}</div>
          )}
        </div>

        {open && s.jumlah > 0 && (
          <div style={{ borderTop: "1px solid #F1F5F9", padding: "10px 14px 12px 58px", background: "#FAFBFF" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              Kegiatan bulan ini
            </div>
            {s.kegiatan.map((ev, i) => (
              <div key={i} style={{ fontSize: 12, color: "#374151", marginBottom: 3, display: "flex", gap: 6 }}>
                <span style={{ color: "#CBD5E1", flexShrink: 0 }}>·</span>
                <span>{ev.namaAcara} <span style={{ color: "#94A3B8" }}>— {ev.tanggal}</span></span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: isMobile ? "12px 14px" : "20px 28px", overflowY: "auto", flex: 1, background: "#F4F7FF" }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg,${NAVY},#1A2F50)`, borderRadius: 16, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ color: GOLD, fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>
          Rekap Penugasan
        </div>
        <div style={{ color: "white", fontSize: isMobile ? 16 : 20, fontWeight: 900, marginBottom: 2 }}>
          {BULAN_LABEL[bulan]} {tahun}
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
          {evBulan.length} kegiatan disetujui pada periode ini
        </div>
      </div>

      {/* Pilih periode */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={bulan} onChange={e => setBulan(+e.target.value)}
          style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #CBD5E1", fontSize: 13, fontWeight: 600, color: NAVY, background: "white" }}>
          {BULAN_LABEL.map((b, i) => <option key={i} value={i}>{b}</option>)}
        </select>
        <select value={tahun} onChange={e => setTahun(+e.target.value)}
          style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #CBD5E1", fontSize: 13, fontWeight: 600, color: NAVY, background: "white" }}>
          {tahunList.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Toggle tim — hanya Kabag */}
      {isKabag && (
        <div style={{ display: "flex", gap: 4, background: "white", padding: "4px", borderRadius: 12, border: "1px solid #E2E8F0", marginBottom: 16, width: "fit-content" }}>
          {[["protokol","🎗️ Tim Protokol"],["komdok","📸 Tim Komdokpim"]].map(([k,l]) => (
            <button key={k} onClick={() => setTimTab(k)} style={{
              padding: "8px 16px", borderRadius: 9, border: "none",
              background: timTab === k ? NAVY : "transparent",
              color: timTab === k ? "white" : "#64748B",
              cursor: "pointer", fontSize: 12, fontWeight: 700, transition: "all 0.15s"
            }}>{l}</button>
          ))}
        </div>
      )}

      {/* Statistik */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { val: evBulan.length,                lbl: "Total Kegiatan",    c: NAVY      },
          { val: totalTugas,                     lbl: "Total Penugasan",   c: "#1D4ED8" },
          { val: sudahTugas,                     lbl: "Personil Bertugas", c: "#059669" },
          { val: activeRank.length - sudahTugas, lbl: "Belum Ditugaskan",  c: "#94A3B8" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, minWidth: 80, background: "white", borderRadius: 12, padding: "12px 14px", border: "1px solid #E2E8F0", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.c, lineHeight: 1, marginBottom: 2 }}>{s.val}</div>
            <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Ranking */}
      <div style={{ background: "#F8FAFC", borderRadius: 14, padding: "14px 16px", border: "1px solid #E2E8F0" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          {activeLabel}
        </div>

        {activeRank.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px", color: "#94A3B8", fontSize: 13 }}>
            Tidak ada personil terdaftar di tim ini
          </div>
        ) : (
          activeRank.map((s, i) => <RankCard key={s.username} s={s} rank={i} />)
        )}

        <div style={{ marginTop: 12, padding: "8px 12px", background: "#F1F5F9", borderRadius: 8, fontSize: 11, color: "#94A3B8", lineHeight: 1.5 }}>
          ℹ️ Ranking berdasarkan jumlah penugasan — bukan penilaian kinerja.
          Data hanya dapat diakses oleh Kabag dan Kasubbag.
        </div>
      </div>
    </div>
  );
}