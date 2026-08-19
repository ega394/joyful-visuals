import React from "react";

const BULAN_LABEL = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember"
];
const MEDAL = ["🥇","🥈","🥉"];

// Jam selesai agenda bersifat opsional dan tidak dimiliki agenda lama, jadi
// rentang hanya ditampilkan bila terisi dan lebih besar dari jam mulai.
const _mnt = t => { const [h,m] = String(t||"").split(":").map(Number); return (h*60+m)||0; };
function fmtRentangJam(ev){
  const mulai = (ev && ev.jam) || "";
  if(!mulai) return "";
  const selesai = (ev && ev.jamSelesai) || "";
  return selesai && _mnt(selesai) > _mnt(mulai) ? mulai+" – "+selesai : mulai;
}

// Daftar username unik yang dikreditkan untuk satu naskah sambutan yang DISAHKAN.
function sambutanKredit(ev){
  if(!ev||!ev.sambutanSah)return [];
  const out=[];
  [ev.sambutanPenyusun,ev.sambutanKasubbag,ev.sambutanKabag].forEach(u=>{
    if(u && out.indexOf(u)===-1) out.push(u);
  });
  return out;
}
function sambutanPeran(ev, username){
  const p=[];
  if(ev.sambutanPenyusun===username) p.push("Penyusun");
  if(ev.sambutanKasubbag===username) p.push("Penyelia");
  if(ev.sambutanKabag===username)    p.push("Pengesah");
  return p.join(" & ");
}

// mode "tim"  → papan peringkat satu tim (Kabag & Kasubbag)
// mode "saya" → HANYA data pegawai yang sedang login, tanpa peringkat rekan
export default function RekapPenugasanBulanan({ events, user, isMobile, allUsers: allUsersProp, mode = "tim" }) {
  const NAVY = "#0A1628", GOLD = "#C9A84C";
  const selfMode = mode === "saya";

  const now  = new Date();
  const [bulan,  setBulan]  = React.useState(now.getMonth());
  const [tahun,  setTahun]  = React.useState(now.getFullYear());
  const [timTab, setTimTab] = React.useState("protokol");
  const [periodeMode, setPeriodeMode] = React.useState("bulan"); // "bulan" | "rentang"
  const [dari,   setDari]   = React.useState("");
  const [sampai, setSampai] = React.useState("");

  const isKabag  = user?.role === "kabag";
  const isProto  = user?.role === "kasubbag_protokol";
  const isKomdok = user?.role === "kasubbag_komdokpim";

  // Ajudan tidak masuk daftar `personil`; kinerjanya adalah pendampingan
  // pimpinan yang diikutinya, jadi dasarnya jadwal sang pimpinan.
  const isAjudanWK  = user?.role === "ajudan_walikota";
  const isAjudanWWK = user?.role === "ajudan_wakilwalikota";
  const isAjudan    = isAjudanWK || isAjudanWWK;
  const [hanyaHadir, setHanyaHadir] = React.useState(true);

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
    () => allUsers.filter(u => u.role === "timkom" || u.role === "kasubbag_komdokpim"),
    [allUsers]
  );

  // Perbandingan langsung pada string YYYY-MM-DD. new Date("YYYY-MM-DD")
  // diurai sebagai UTC lalu dibaca dengan getMonth() waktu lokal, sehingga
  // tanggal di awal/akhir bulan bisa bergeser sehari di sebagian zona waktu.
  const inPeriode = React.useCallback((tgl) => {
    const t = String(tgl || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
    if (periodeMode === "rentang") {
      if (!dari || !sampai) return false;
      return t >= dari && t <= sampai;
    }
    return Number(t.slice(0, 4)) === tahun && Number(t.slice(5, 7)) === bulan + 1;
  }, [periodeMode, dari, sampai, bulan, tahun]);

  const evBulan = React.useMemo(
    () => events.filter(e => e.alur === "disetujui" && inPeriode(e.tanggal)),
    [events, inPeriode]
  );

  const fmtRingkas = (d) => {
    const t = String(d || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    return Number(t.slice(8, 10)) + " " + BULAN_LABEL[Number(t.slice(5, 7)) - 1].slice(0, 3) + " " + t.slice(0, 4);
  };
  const periodeLabel = (periodeMode === "rentang" && dari && sampai)
    ? fmtRingkas(dari) + " – " + fmtRingkas(sampai)
    : BULAN_LABEL[bulan] + " " + tahun;

  // Naskah sambutan yang disahkan pada periode dipilih
  const sambutanBulan = React.useMemo(
    () => evBulan.filter(e => e.sambutanSah),
    [evBulan]
  );

  const buildRanking = (stafList) =>
    stafList.map(s => {
      const kegiatan = evBulan.filter(e => (e.personil || []).includes(s.username));
      const naskah   = sambutanBulan.filter(e => sambutanKredit(e).includes(s.username));
      return {
        ...s,
        jumlah: kegiatan.length + naskah.length,
        kegiatan,
        naskah,
        jumlahTugas: kegiatan.length,
        jumlahNaskah: naskah.length,
      };
    }).sort((a, b) => b.jumlah - a.jumlah);

  const rankProto  = buildRanking(stafProto);
  const rankKomdok = buildRanking(stafKomdok);

  // Baris kinerja pegawai yang sedang login (dipakai mode "saya")
  const meRow = React.useMemo(() => {
    const un = user?.username;
    const base = allUsers.find(u => u.username === un) || user || {};

    let kegiatan;
    if (isAjudan) {
      // Jadwal pimpinan yang didampingi. Bawaan: hanya yang benar-benar
      // DIHADIRI pimpinan — yang diwakilkan/tidak hadir bukan pendampingan.
      kegiatan = evBulan.filter(e => {
        const untuk = e.untukPimpinan || [];
        if (isAjudanWK) {
          if (!untuk.includes("walikota") || e.delegasiKeWWK) return false;
          return hanyaHadir ? e.statusWK === "hadir" : true;
        }
        if (!untuk.includes("wakilwalikota") && !e.delegasiKeWWK) return false;
        return hanyaHadir ? e.statusWWK === "hadir" : true;
      });
    } else {
      kegiatan = evBulan.filter(e => (e.personil || []).includes(un));
    }

    const naskah = sambutanBulan.filter(e => sambutanKredit(e).includes(un));
    return {
      ...base, username: un,
      jumlah: kegiatan.length + naskah.length,
      kegiatan, naskah,
      jumlahTugas: kegiatan.length, jumlahNaskah: naskah.length,
    };
  }, [allUsers, user, evBulan, sambutanBulan, isAjudan, isAjudanWK, hanyaHadir]);

  // Label menyesuaikan jenis kinerja: ajudan = pendampingan, bukan penugasan
  const labelTugas = isAjudan ? "Pendampingan Pimpinan" : "Penugasan Lapangan";

  const activeRank  = timTab === "komdok" ? rankKomdok : rankProto;
  const activeLabel = timTab === "komdok" ? "📸 Tim Kasubbag Komdokpim" : "🎗️ Tim Kasubbag Protokol";

  const totalTugas = activeRank.reduce((s, x) => s + x.jumlah, 0);
  const sudahTugas = activeRank.filter(x => x.jumlah > 0).length;
  const maxTugas   = activeRank.length ? activeRank[0].jumlah : 0;

  // ── Guard akses — setelah SEMUA hooks ──
  // Mode "saya" terbuka untuk semua pegawai (hanya menampilkan datanya sendiri);
  // papan peringkat tim tetap dibatasi Kabag & Kasubbag.
  if (!selfMode && !isKabag && !isProto && !isKomdok) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>
        Fitur ini tersedia untuk Kabag dan Kasubbag.
      </div>
    );
  }

  // ── Cetak bukti dukung per pegawai (lampiran e-Kinerja) ──
  const cetakBukti = (s) => {
    const periode = periodeLabel;
    const fmtTgl = (d) => {
      try {
        const x = new Date(d + "T00:00:00+08:00");
        const H=["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
        const B=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
        return H[x.getDay()]+", "+x.getDate()+" "+B[x.getMonth()]+" "+x.getFullYear();
      } catch(_) { return d; }
    };
    const rowsTugas = s.kegiatan.map((ev,i)=>(
      "<tr><td class='c'>"+(i+1)+"</td><td>"+fmtTgl(ev.tanggal)+"</td><td>"+(ev.namaAcara||"-")+"</td>"+
      "<td>"+(ev.penyelenggara||"-")+"</td><td class='c'>"+(fmtRentangJam(ev)||"-")+"</td><td>"+(ev.lokasi||"-")+"</td>"+
      "<td class='c'>"+(ev.jenisKegiatan||"-")+"</td></tr>"
    )).join("");
    const rowsNaskah = s.naskah.map((ev,i)=>(
      "<tr><td class='c'>"+(i+1)+"</td><td>"+fmtTgl(ev.tanggal)+"</td><td>"+(ev.namaAcara||"-")+"</td>"+
      "<td>"+(ev.penyelenggara||"-")+"</td><td class='c'>"+sambutanPeran(ev,s.username)+"</td>"+
      "<td class='c'>"+(ev.sambutanSelesaiAt?new Date(ev.sambutanSelesaiAt).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"-")+"</td></tr>"
    )).join("");
    const now = new Date();
    const printDate = now.toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
    const printTime = now.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
    const jabatan = s.jabatan || (s.role||"").replace(/_/g," ");
    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
<title>Bukti Dukung Kinerja — ${s.nama||s.username}</title>
<style>
@page { size: A4 portrait; margin: 1.5cm 1.6cm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 10pt; color: #1a1a1a; margin: 0; }
.kop { display:flex; align-items:center; gap:14px; padding-bottom:10px; border-bottom:3px double #0B2545; margin-bottom:10px; }
.kop img { width:58px; height:58px; object-fit:contain; }
.kop h1 { font-size:12pt; font-weight:900; color:#0B2545; margin:0 0 2px; letter-spacing:.3px; }
.kop h2 { font-size:10pt; font-weight:700; color:#0B2545; margin:0 0 2px; }
.kop p  { font-size:8.5pt; color:#475569; margin:0; }
.jdl { text-align:center; margin:14px 0 10px; }
.jdl h3 { font-size:13pt; font-weight:900; color:#0B2545; margin:0; text-transform:uppercase; letter-spacing:1.3px; }
.jdl .sub { font-size:9pt; color:#64748B; margin:4px 0 0; }
.box { background:#F8FAFC; border:1px solid #CBD5E1; border-radius:6px; padding:10px 14px; margin-bottom:12px; }
.box .row { display:flex; gap:8px; padding:3px 0; font-size:10pt; }
.box .row b { min-width:140px; color:#475569; font-weight:600; }
table { width:100%; border-collapse:collapse; margin-top:6px; margin-bottom:14px; }
thead th { background:#0B2545; color:white; padding:7px; text-align:left; font-size:8.5pt; font-weight:700; border:1px solid #0B2545; }
thead th.c { text-align:center; }
tbody td { padding:6px 7px; border:1px solid #CBD5E1; font-size:9pt; vertical-align:top; }
tbody tr:nth-child(even) td { background:#F8FAFC; }
.c { text-align:center; }
.section-title { font-size:11pt; font-weight:800; color:#0B2545; margin:14px 0 4px; border-left:4px solid #C9A84C; padding-left:8px; }
.empty { font-size:9pt; color:#94A3B8; font-style:italic; padding:8px; }
.ttd { margin-top:24px; display:flex; justify-content:flex-end; }
.ttd-box { text-align:center; min-width:240px; }
.ttd-box .kota-tgl { font-size:10pt; color:#334155; margin:0 0 3px; }
.ttd-box .jabatan { font-size:10pt; font-weight:700; color:#0B2545; margin:0 0 54px; }
.ttd-box .nama { font-size:10.5pt; font-weight:900; color:#0B2545; text-decoration:underline; margin:0 0 2px; }
.ttd-box .nip { font-size:8.5pt; color:#475569; margin:0; }
.foot { margin-top:12px; font-size:7.5pt; color:#94A3B8; text-align:center; border-top:1px solid #E2E8F0; padding-top:5px; }
</style></head><body>
<div class="kop">
  <img src="/logo_tarakan.png" alt="Logo Pemkot Tarakan" onerror="this.style.display='none'"/>
  <div>
    <h1>PEMERINTAH KOTA TARAKAN</h1>
    <h2>BAGIAN PROTOKOL DAN KOMUNIKASI PIMPINAN</h2>
    <p>Sekretariat Daerah Kota Tarakan</p>
  </div>
</div>
<div class="jdl">
  <h3>Bukti Dukung Kinerja Pegawai</h3>
  <p class="sub">Periode: <b>${periode}</b></p>
</div>
<div class="box">
  <div class="row"><b>Nama Pegawai</b><span>: ${s.nama||s.username}</span></div>
  <div class="row"><b>Jabatan</b><span>: ${jabatan}</span></div>
  <div class="row"><b>Periode</b><span>: ${periode}</span></div>
  <div class="row"><b>Total ${labelTugas}</b><span>: ${s.jumlahTugas} kegiatan</span></div>
  <div class="row"><b>Total Naskah Sambutan</b><span>: ${s.jumlahNaskah} naskah (disahkan Kabag)</span></div>
</div>

<div class="section-title">A. ${labelTugas}</div>
${s.jumlahTugas>0
  ? `<table><thead><tr><th class="c" style="width:30px">No</th><th style="width:130px">Tanggal</th><th>Nama Acara</th><th>Penyelenggara</th><th class="c" style="width:55px">Jam</th><th>Lokasi</th><th class="c" style="width:90px">Jenis</th></tr></thead><tbody>${rowsTugas}</tbody></table>`
  : `<div class="empty">Tidak ada ${labelTugas.toLowerCase()} pada periode ini.</div>`
}

<div class="section-title">B. Naskah Sambutan</div>
${s.jumlahNaskah>0
  ? `<table><thead><tr><th class="c" style="width:30px">No</th><th style="width:130px">Tanggal Acara</th><th>Nama Acara</th><th>Penyelenggara</th><th class="c" style="width:120px">Peran</th><th class="c" style="width:100px">Disahkan</th></tr></thead><tbody>${rowsNaskah}</tbody></table>`
  : `<div class="empty">Tidak ada naskah sambutan yang disahkan pada periode ini.</div>`
}

<div class="ttd">
  <div class="ttd-box">
    <p class="kota-tgl">Tarakan, ${printDate}</p>
    <p class="jabatan">Kepala Bagian Protokol dan Komunikasi Pimpinan</p>
    <p class="nama">Anugrah Yega Pranatha, M.Si.</p>
    <p class="nip">NIP. 198811032007011003</p>
  </div>
</div>

<p class="foot">Dokumen ini dicetak otomatis oleh Sistem Prokopim Hibot pada ${printDate} ${printTime} WITA · sebagai lampiran bukti dukung e-Kinerja.</p>
</body></html>`;
    const w = window.open("","_blank");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(()=>w.print(), 600);
  };

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
            {s.jumlahTugas > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                  Penugasan ({s.jumlahTugas})
                </div>
                {s.kegiatan.map((ev, i) => (
                  <div key={"t"+i} style={{ fontSize: 12, color: "#374151", marginBottom: 3, display: "flex", gap: 6 }}>
                    <span style={{ color: "#CBD5E1", flexShrink: 0 }}>·</span>
                    <span>{ev.namaAcara} <span style={{ color: "#94A3B8" }}>— {ev.tanggal}</span></span>
                  </div>
                ))}
              </>
            )}
            {s.jumlahNaskah > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#7C3AED", textTransform: "uppercase", letterSpacing: 1, margin: s.jumlahTugas>0?"10px 0 6px":"0 0 6px" }}>
                  🎤 Naskah Sambutan ({s.jumlahNaskah})
                </div>
                {s.naskah.map((ev, i) => (
                  <div key={"n"+i} style={{ fontSize: 12, color: "#374151", marginBottom: 3, display: "flex", gap: 6 }}>
                    <span style={{ color: "#C4B5FD", flexShrink: 0 }}>·</span>
                    <span>{ev.namaAcara} <span style={{ color: "#94A3B8" }}>— {ev.tanggal} · {sambutanPeran(ev, s.username)}</span></span>
                  </div>
                ))}
              </>
            )}
            <button
              onClick={(e)=>{ e.stopPropagation(); cetakBukti(s); }}
              style={{ marginTop: 10, padding: "7px 12px", borderRadius: 8, border: "1.5px solid #CBD5E1", background: "white", color: NAVY, cursor: "pointer", fontSize: 11, fontWeight: 800 }}
            >
              🖨️ Cetak Bukti Dukung Kinerja
            </button>
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
          {selfMode ? "Rekap Kinerja Saya" : "Rekap Penugasan"}
        </div>
        <div style={{ color: "white", fontSize: isMobile ? 16 : 20, fontWeight: 900, marginBottom: 2 }}>
          {selfMode ? (meRow.nama || meRow.username || "-") : periodeLabel}
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
          {selfMode ? "Periode " + periodeLabel : evBulan.length + " kegiatan disetujui pada periode ini"}
        </div>
      </div>

      {/* Pilih periode — bulanan (bawaan) atau rentang tanggal bebas */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 4, background: "white", padding: 4, borderRadius: 12, border: "1px solid #E2E8F0", width: "fit-content", marginBottom: 8 }}>
          {[["bulan", "📅 Bulanan"], ["rentang", "🗓️ Rentang Tanggal"]].map(([k, l]) => (
            <button key={k} onClick={() => setPeriodeMode(k)} style={{
              padding: "7px 14px", borderRadius: 9, border: "none",
              background: periodeMode === k ? NAVY : "transparent",
              color: periodeMode === k ? "white" : "#64748B",
              cursor: "pointer", fontSize: 12, fontWeight: 700,
            }}>{l}</button>
          ))}
        </div>

        {periodeMode === "bulan" ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={bulan} onChange={e => setBulan(+e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #CBD5E1", fontSize: 13, fontWeight: 600, color: NAVY, background: "white" }}>
              {BULAN_LABEL.map((b, i) => <option key={i} value={i}>{b}</option>)}
            </select>
            <select value={tahun} onChange={e => setTahun(+e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #CBD5E1", fontSize: 13, fontWeight: 600, color: NAVY, background: "white" }}>
              {tahunList.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input type="date" value={dari} onChange={e => setDari(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #CBD5E1", fontSize: 13, fontWeight: 600, color: NAVY, background: "white" }}/>
            <span style={{ color: "#94A3B8", fontSize: 13, fontWeight: 700 }}>s.d.</span>
            <input type="date" value={sampai} onChange={e => setSampai(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #CBD5E1", fontSize: 13, fontWeight: 600, color: NAVY, background: "white" }}/>
            {(!dari || !sampai) && (
              <span style={{ fontSize: 11, color: "#B45309", fontWeight: 600 }}>Isi kedua tanggal untuk menampilkan data</span>
            )}
          </div>
        )}
      </div>

      {/* ── MODE SAYA: hanya data pegawai yang login, tanpa peringkat rekan ── */}
      {selfMode && (
        <>
          {/* Ajudan: bawaan hanya jadwal yang benar-benar dihadiri pimpinan */}
          {isAjudan && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 4, background: "white", padding: 4, borderRadius: 12, border: "1px solid #E2E8F0", width: "fit-content" }}>
                {[[true, "✅ Hanya yang Dihadiri"], [false, "📋 Semua Jadwal Pimpinan"]].map(([v, l]) => (
                  <button key={String(v)} onClick={() => setHanyaHadir(v)} style={{
                    padding: "7px 14px", borderRadius: 9, border: "none",
                    background: hanyaHadir === v ? NAVY : "transparent",
                    color: hanyaHadir === v ? "white" : "#64748B",
                    cursor: "pointer", fontSize: 12, fontWeight: 700,
                  }}>{l}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 6 }}>
                Kinerja ajudan dihitung dari pendampingan {isAjudanWK ? "Wali Kota" : "Wakil Wali Kota"}
                {hanyaHadir ? " yang benar-benar dihadiri (yang diwakilkan/tidak hadir tidak dihitung)." : " — termasuk yang diwakilkan atau belum dikonfirmasi."}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { val: meRow.jumlahTugas,  lbl: labelTugas,         c: "#1D4ED8" },
              { val: meRow.jumlahNaskah, lbl: "Naskah Sambutan",  c: "#7C3AED" },
              { val: meRow.jumlah,       lbl: "Total Skor",       c: NAVY      },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, minWidth: 90, background: "white", borderRadius: 12, padding: "12px 14px", border: "1px solid #E2E8F0", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.c, lineHeight: 1, marginBottom: 2 }}>{s.val}</div>
                <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.lbl}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#F8FAFC", borderRadius: 14, padding: "14px 16px", border: "1px solid #E2E8F0" }}>
            {meRow.jumlah === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#94A3B8", fontSize: 13 }}>
                {isAjudan
                  ? "Belum ada pendampingan pimpinan pada periode ini."
                  : "Belum ada penugasan atau naskah sambutan pada periode ini."}
              </div>
            ) : (
              <>
                {meRow.jumlahTugas > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                      {labelTugas} ({meRow.jumlahTugas})
                    </div>
                    {meRow.kegiatan.map((ev, i) => (
                      <div key={"mt" + i} style={{ fontSize: 12.5, color: "#374151", marginBottom: 4, display: "flex", gap: 6 }}>
                        <span style={{ color: "#CBD5E1", flexShrink: 0 }}>·</span>
                        <span>{ev.namaAcara} <span style={{ color: "#94A3B8" }}>— {ev.tanggal}{ev.jam ? " · " + fmtRentangJam(ev) : ""}</span></span>
                      </div>
                    ))}
                  </>
                )}
                {meRow.jumlahNaskah > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#7C3AED", textTransform: "uppercase", letterSpacing: 1, margin: meRow.jumlahTugas > 0 ? "12px 0 6px" : "0 0 6px" }}>
                      🎤 Naskah Sambutan ({meRow.jumlahNaskah})
                    </div>
                    {meRow.naskah.map((ev, i) => (
                      <div key={"mn" + i} style={{ fontSize: 12.5, color: "#374151", marginBottom: 4, display: "flex", gap: 6 }}>
                        <span style={{ color: "#C4B5FD", flexShrink: 0 }}>·</span>
                        <span>{ev.namaAcara} <span style={{ color: "#94A3B8" }}>— {ev.tanggal} · {sambutanPeran(ev, meRow.username)}</span></span>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}

            <button onClick={() => cetakBukti(meRow)}
              style={{ marginTop: 14, width: "100%", padding: "11px", borderRadius: 10, border: "none", background: NAVY, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 800 }}>
              🖨️ Cetak Bukti Dukung Kinerja Saya
            </button>

            <div style={{ marginTop: 12, padding: "8px 12px", background: "#F1F5F9", borderRadius: 8, fontSize: 11, color: "#64748B", lineHeight: 1.6 }}>
              ℹ️ Skor = jumlah {labelTugas.toLowerCase()}
              {!isAjudan && " + jumlah naskah sambutan yang telah disahkan Kabag"}.
              Halaman ini hanya menampilkan data Anda sendiri.
            </div>
          </div>
        </>
      )}

      {/* Toggle tim — hanya Kabag */}
      {!selfMode && isKabag && (
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
      {!selfMode && <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { val: evBulan.length,                lbl: "Total Kegiatan",    c: NAVY      },
          { val: totalTugas,                     lbl: "Total Skor Tim",    c: "#1D4ED8" },
          { val: sudahTugas,                     lbl: "Personil Aktif",    c: "#059669" },
          ...(timTab==="komdok"
            ? [{ val: sambutanBulan.length, lbl: "Naskah Disahkan", c: "#7C3AED" }]
            : [{ val: activeRank.length - sudahTugas, lbl: "Belum Aktif", c: "#94A3B8" }]),
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, minWidth: 80, background: "white", borderRadius: 12, padding: "12px 14px", border: "1px solid #E2E8F0", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.c, lineHeight: 1, marginBottom: 2 }}>{s.val}</div>
            <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.lbl}</div>
          </div>
        ))}
      </div>}

      {/* Ranking */}
      {!selfMode && <div style={{ background: "#F8FAFC", borderRadius: 14, padding: "14px 16px", border: "1px solid #E2E8F0" }}>
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

        <div style={{ marginTop: 12, padding: "8px 12px", background: "#F1F5F9", borderRadius: 8, fontSize: 11, color: "#64748B", lineHeight: 1.6 }}>
          ℹ️ Skor = jumlah penugasan lapangan + jumlah naskah sambutan yang disahkan Kabag.
          Setiap naskah dihitung 1 untuk penyusun, Kasubbag Komdokpim, dan Kabag (dedup jika satu orang merangkap).
          Klik baris pegawai untuk melihat rinciannya & mencetak bukti dukung kinerja.
        </div>
      </div>}
    </div>
  );
}