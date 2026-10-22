import React, { useEffect, useMemo, useState } from "react";
import { rekapKomunikasi, rentangPeriode, TARGET, BERITA_DICATAT_SEJAK, BERITA_TERBIT_SEJAK } from "../lib/indikatorKinerja.js";
import { epochMulai } from "../lib/zona.js";

/**
 * Menu "Indikator Kinerja" — Kabag dan kedua Kasubbag.
 *
 * Kabag melihat ketiga indikator; Kasubbag Protokol melihat IKU 1 dan 2;
 * Kasubbag Komdokpim melihat IKU 1 dan 3. Perhitungan ada di
 * lib/indikatorKinerja.js; berkas ini hanya menampilkan dan merinci.
 *
 * Berita kegiatan dibaca dari akun Instagram resmi (@humas_tarakan) lewat
 * /api/room-booking?op=instagram. Kabag dan Kasubbag Komdokpim dapat
 * memilih postingan secara manual atau menolak tautan otomatis yang keliru;
 * pilihan itu tersimpan di agenda dan tercatat di riwayatnya.
 */

const NAVY = "#0A1628", GOLD = "#C9A84C", ABU = "#64748B", GARIS = "#E4EAF2";
const HIJAU = "#047857", MERAH = "#B91C1C", KUNING = "#B45309";

const PERIODE = [
  { key: "bulan", label: "Bulan" },
  { key: "triwulan", label: "Triwulan" },
  { key: "tahun", label: "Tahun" },
];
const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

const STATUS = {
  tepat:           { label: "Tepat waktu",            warna: HIJAU,  latar: "#ECFDF5" },
  terlambat:       { label: "Terlambat",              warna: MERAH,  latar: "#FEF2F2" },
  berjalan:        { label: "Berjalan",               warna: "#1D4ED8", latar: "#EFF6FF" },
  tak_terukur:     { label: "Tanpa catatan waktu",    warna: ABU,    latar: "#F1F5F9" },
  tanpa_kehadiran: { label: "Kehadiran belum dikonfirmasi", warna: KUNING, latar: "#FFFBEB" },
};

const hariIniWita = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);

function geser(jenis, acuan, langkah) {
  const [y, m] = acuan.split("-").map(Number);
  const tambahBulan = jenis === "bulan" ? langkah : jenis === "triwulan" ? langkah * 3 : langkah * 12;
  const d = new Date(Date.UTC(y, m - 1 + tambahBulan, 1));
  return d.toISOString().slice(0, 10);
}

function judulPeriode(jenis, acuan) {
  const [y, m] = acuan.split("-").map(Number);
  if (jenis === "bulan") return `${BULAN[m - 1]} ${y}`;
  if (jenis === "triwulan") return `Triwulan ${["I","II","III","IV"][Math.floor((m - 1) / 3)]} ${y}`;
  return `Tahun ${y}`;
}

const fmtWaktu = (t) => t == null ? "—" : new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Makassar", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
}).format(new Date(t)).replace(/\./g, ":") + " WITA";

const fmtTanggal = (s) => {
  const [y, m, d] = String(s || "").split("-").map(Number);
  return d ? `${d} ${BULAN[m - 1].slice(0, 3)} ${y}` : "";
};

function Meteran({ nilai }) {
  const n = nilai == null ? 0 : Math.max(0, Math.min(100, nilai));
  const capai = nilai != null && nilai >= TARGET;
  return (
    <div style={{ position: "relative", height: 10, borderRadius: 6, background: "#EEF2F7", overflow: "hidden" }}>
      <div style={{ width: n + "%", height: "100%", borderRadius: 6, background: nilai == null ? "transparent" : capai ? HIJAU : n >= 75 ? "#D97706" : MERAH, transition: "width .3s" }} />
      <div title={"Target " + TARGET} style={{ position: "absolute", left: TARGET + "%", top: -2, bottom: -2, width: 2, background: NAVY, opacity: 0.55 }} />
    </div>
  );
}

function KartuIndikator({ no, judul, pj, nilai, satuan, ket, children, nonaktif }) {
  const capai = nilai != null && nilai >= TARGET;
  return (
    <div style={{ background: "white", border: "1px solid " + GARIS, borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 6px rgba(10,22,40,0.05)", opacity: nonaktif ? 0.85 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: NAVY, color: GOLD, fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{no}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: NAVY, lineHeight: 1.35 }}>{judul}</div>
          <div style={{ fontSize: 11.5, color: ABU, marginTop: 2 }}>Penanggung jawab: {pj}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "12px 0 8px" }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: nonaktif ? "#94A3B8" : nilai == null ? "#94A3B8" : capai ? HIJAU : MERAH, lineHeight: 1 }}>
          {nonaktif ? "—" : nilai == null ? "—" : String(nilai).replace(".", ",") + satuan}
        </div>
        <div style={{ fontSize: 12, color: ABU }}>target {TARGET}{satuan}</div>
        {!nonaktif && nilai != null && (
          <div style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 800, color: capai ? HIJAU : MERAH, background: capai ? "#ECFDF5" : "#FEF2F2", borderRadius: 20, padding: "3px 9px" }}>
            {capai ? "Tercapai" : "Di bawah target"}
          </div>
        )}
      </div>
      {!nonaktif && <Meteran nilai={nilai} />}
      {ket && <div style={{ fontSize: 12, color: ABU, lineHeight: 1.55, marginTop: 10 }}>{ket}</div>}
      {children}
    </div>
  );
}

function Rincian({ jenis, label, data }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: "#F8FAFD", border: "1px solid " + GARIS, borderRadius: 10, padding: "9px 11px" }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: ABU }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: "2px 0" }}>{data.persen == null ? "—" : String(data.persen).replace(".", ",") + "%"}</div>
      <div style={{ fontSize: 11, color: ABU }}>{data.tepat} tepat · {data.terlambat} terlambat{data.berjalan ? ` · ${data.berjalan} berjalan` : ""}</div>
    </div>
  );
}

const SARINGAN = [
  { key: "perhatian", label: "Perlu perhatian", cocok: (b) => b.status === "terlambat" || b.status === "tanpa_kehadiran" || (b.status === "berjalan" && b.tenggat - Date.now() < 24 * 3600000) },
  { key: "semua", label: "Semua", cocok: () => true },
  { key: "tepat", label: "Tepat waktu", cocok: (b) => b.status === "tepat" },
];

export default function IndikatorKinerja({ events, user, isMobile, allUsers, ambil, upd }) {
  const role = user?.role || "";
  const [jenis, setJenis] = useState("bulan");
  const [acuan, setAcuan] = useState(hariIniWita());
  const [saring, setSaring] = useState("perhatian");
  const [ig, setIg] = useState(null);          // { status, postingan } dari peladen
  const [pilih, setPilih] = useState(null);    // butir berita yang sedang dipilihkan postingannya

  const rentang = rentangPeriode(jenis, acuan);
  const sejak = rentang.dari < BERITA_TERBIT_SEJAK ? rentang.dari : BERITA_TERBIT_SEJAK;
  useEffect(() => {
    if (!ambil) return;
    let batal = false;
    ambil("/api/room-booking?op=instagram&sejak=" + sejak)
      .then((r) => r.json())
      .then((d) => { if (!batal) setIg(d && d.status ? d : { status: { tersambung: false, alasan: d?.error || "Gagal memuat" }, postingan: [] }); })
      .catch((e) => { if (!batal) setIg({ status: { tersambung: false, alasan: e.message }, postingan: [] }); });
    return () => { batal = true; };
  }, [ambil, sejak]);
  const igAktif = !!(ig && ig.status && ig.status.tersambung);
  const bolehAtur = !!upd && (role === "kabag" || role === "kasubbag_komdokpim");

  const iku3 = useMemo(
    () => rekapKomunikasi(events, { ...rentang, postingan: igAktif ? ig.postingan : null }),
    [events, rentang.dari, rentang.sampai, igAktif, ig]
  );
  const nama = (u) => (allUsers || []).find((x) => x.username === u)?.nama || u || "—";

  const lihat1 = true;
  const lihat2 = role !== "kasubbag_komdokpim";
  const lihat3 = role !== "kasubbag_protokol";
  const daftar = iku3.butir.filter((SARINGAN.find((s) => s.key === saring) || SARINGAN[1]).cocok);

  const tombol = (aktif) => ({
    padding: "7px 12px", borderRadius: 9, border: "1.5px solid " + (aktif ? NAVY : GARIS), cursor: "pointer",
    background: aktif ? NAVY : "white", color: aktif ? "white" : NAVY, fontWeight: 700, fontSize: 12.5, fontFamily: "inherit",
  });

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: isMobile ? "4px 0 24px" : "8px 0 32px" }}>
      <div style={{ background: `linear-gradient(135deg,${NAVY} 0%,#1E3A6E 100%)`, color: "white", borderRadius: 16, padding: isMobile ? "16px" : "18px 22px", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: GOLD, textTransform: "uppercase" }}>Indikator Kinerja · Bagian Prokopim</div>
        <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, marginTop: 4, lineHeight: 1.35 }}>Meningkatnya kualitas pelayanan keprotokolan dan komunikasi pimpinan</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14 }}>
        {PERIODE.map((p) => (
          <button key={p.key} onClick={() => setJenis(p.key)} style={tombol(jenis === p.key)}>{p.label}</button>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: isMobile ? 0 : "auto", width: isMobile ? "100%" : "auto" }}>
          <button aria-label="Periode sebelumnya" onClick={() => setAcuan(geser(jenis, acuan, -1))} style={tombol(false)}>‹</button>
          <div style={{ flex: 1, minWidth: 150, textAlign: "center", fontWeight: 800, color: NAVY, fontSize: 14 }}>{judulPeriode(jenis, acuan)}</div>
          <button aria-label="Periode berikutnya" onClick={() => setAcuan(geser(jenis, acuan, 1))} style={tombol(false)}>›</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(280px,1fr))", gap: 12, marginBottom: 16 }}>
        {lihat1 && (
          <KartuIndikator no="1" judul="Nilai kepuasan pimpinan atas layanan keprotokolan dan komunikasi pimpinan"
            pj={role === "kasubbag_protokol" ? "Kabag · aspek keprotokolan" : role === "kasubbag_komdokpim" ? "Kabag · aspek komunikasi" : "Kabag"}
            satuan="" nonaktif
            ket="Survei triwulanan yang diisi langsung oleh Wali Kota dan Wakil Wali Kota (skala 1–4, dikonversi ke 0–100). Disiapkan pada tahap berikutnya." />
        )}
        {lihat2 && (
          <KartuIndikator no="2" judul="Persentase kegiatan pimpinan yang dilayani sesuai standar keprotokolan"
            pj="Kasubbag Protokol" satuan="%" nonaktif
            ket="Ceklis standar layanan per kegiatan yang dihadiri pimpinan — sebagian otomatis dari riwayat agenda, sebagian dicentang petugas. Disiapkan pada tahap berikutnya." />
        )}
        {lihat3 && (
          <KartuIndikator no="3" judul="Persentase layanan komunikasi pimpinan yang diselesaikan tepat waktu"
            pj="Kasubbag Komdokpim" satuan="%" nilai={iku3.semua.persen}
            ket={iku3.semua.tepat + iku3.semua.terlambat === 0
              ? "Belum ada layanan yang jatuh tempo pada periode ini."
              : `${iku3.semua.tepat} dari ${iku3.semua.tepat + iku3.semua.terlambat} layanan yang jatuh tempo selesai tepat waktu.`}>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Rincian label="Naskah sambutan · ≤ 24 jam sebelum acara" data={iku3.sambutan} />
              <Rincian label={igAktif ? "Berita terbit di Instagram · ≤ 24 jam sesudah acara" : "Berita kegiatan · ≤ 24 jam sesudah acara"} data={iku3.berita} />
            </div>
            <StatusInstagram ig={ig} />
          </KartuIndikator>
        )}
      </div>

      {lihat3 && (
        <div style={{ background: "white", border: "1px solid " + GARIS, borderRadius: 14, padding: isMobile ? "12px" : "14px 16px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginRight: "auto" }}>Rincian layanan komunikasi</div>
            {SARINGAN.map((s) => (
              <button key={s.key} onClick={() => setSaring(s.key)} style={{ ...tombol(saring === s.key), padding: "5px 10px", fontSize: 12 }}>
                {s.label} ({iku3.butir.filter(s.cocok).length})
              </button>
            ))}
          </div>
          {daftar.length === 0 ? (
            <div style={{ padding: "22px 8px", textAlign: "center", color: ABU, fontSize: 13 }}>
              {saring === "perhatian" ? "Tidak ada yang terlambat atau mendekati tenggat. 👍" : "Tidak ada layanan pada periode ini."}
            </div>
          ) : daftar.map((b, i) => {
            const st = STATUS[b.status] || STATUS.berjalan;
            return (
              <div key={b.jenis + b.ev.id + i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 4px", borderTop: i ? "1px solid #F1F5F9" : "none" }}>
                <div style={{ flexShrink: 0, fontSize: 18, lineHeight: 1.2 }} aria-hidden="true">{b.jenis === "sambutan" ? "🎤" : "📰"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, lineHeight: 1.35 }}>{b.ev.namaAcara || "(tanpa nama acara)"}</div>
                  <div style={{ fontSize: 11.5, color: ABU, marginTop: 2, lineHeight: 1.5 }}>
                    {b.jenis === "sambutan" ? "Naskah sambutan" : "Berita kegiatan"} · acara {fmtTanggal(b.ev.tanggal)} · PJ {nama(b.pj)}
                    <br />Tenggat {fmtWaktu(b.tenggat)} · {b.postingan !== undefined ? "Terbit" : "Selesai"} {fmtWaktu(b.selesai)}
                  </div>
                  {b.postingan !== undefined && (
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 6 }}>
                      {b.postingan ? (
                        <>
                          <a href={b.postingan.permalink} target="_blank" rel="noopener" style={{ fontSize: 12, fontWeight: 700, color: "#1E3A6E" }}>Lihat postingan ↗</a>
                          <span style={{ fontSize: 11, color: ABU }}>{b.cara === "manual" ? "dipilih manual" : "terdeteksi otomatis"}</span>
                          {bolehAtur && (b.cara === "manual"
                            ? <button onClick={() => upd(b.ev.id, { beritaTerbit: null })} style={tombolKecil}>Batalkan pilihan</button>
                            : <button onClick={() => upd(b.ev.id, { beritaTolak: [...(b.ev.beritaTolak || []), b.postingan.id] })} style={tombolKecil}>Bukan postingan ini</button>)}
                        </>
                      ) : bolehAtur && igAktif && b.status !== "tanpa_kehadiran" ? (
                        <button onClick={() => setPilih(b)} style={tombolKecil}>
                          Pilih postingan{b.kandidat && b.kandidat.length ? ` · ${b.kandidat.length} kandidat` : ""}
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
                <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: st.warna, background: st.latar, borderRadius: 20, padding: "3px 9px", whiteSpace: "nowrap" }}>{st.label}</div>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.6, marginTop: 10, borderTop: "1px solid #F1F5F9", paddingTop: 8 }}>
            {igAktif
              ? <>Berita dihitung untuk acara yang dihadiri sendiri oleh Wali Kota atau Wakil Wali Kota, mulai acara tanggal {fmtTanggal(BERITA_TERBIT_SEJAK)}, dari jam terbit postingan di akun resmi. Kecocokan yang meragukan tidak dihitung sampai dipilih manual.</>
              : <>Berita dihitung untuk acara yang dihadiri sendiri oleh Wali Kota atau Wakil Wali Kota, mulai acara tanggal {fmtTanggal(BERITA_DICATAT_SEJAK)}, dari jam persetujuan caption/rilis (Instagram belum tersambung).</>}
            Naskah sambutan dihitung untuk setiap agenda berjenis Sambutan. Layanan yang tenggatnya belum lewat belum masuk hitungan.
          </div>
        </div>
      )}
      {pilih && (
        <PilihPostingan butir={pilih} postingan={ig?.postingan || []} onTutup={() => setPilih(null)}
          onPilih={(p) => {
            upd(pilih.ev.id, { beritaTerbit: { id: p.id, permalink: p.permalink, terbit_at: p.terbit_at, oleh: user?.username, pada: new Date().toISOString() } });
            setPilih(null);
          }} />
      )}
    </div>
  );
}

const tombolKecil = {
  padding: "4px 10px", borderRadius: 8, border: "1.5px solid " + GARIS, background: "white", color: NAVY,
  fontWeight: 700, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit",
};

function StatusInstagram({ ig }) {
  if (!ig) return <div style={{ fontSize: 11.5, color: ABU, marginTop: 10 }}>Memeriksa akun Instagram resmi…</div>;
  const s = ig.status || {};
  const ok = !!s.tersambung;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, padding: "8px 10px", borderRadius: 10, fontSize: 11.5, lineHeight: 1.5,
      background: ok ? "#F0FDF4" : "#FFFBEB", color: ok ? "#166534" : "#92400E", border: "1px solid " + (ok ? "#BBF7D0" : "#FDE68A") }}>
      <span aria-hidden="true">📸</span>
      <span>
        {ok
          ? <>Terhubung ke <b>@{s.username || "akun resmi"}</b> · diperbarui {fmtWaktu(Date.parse(s.sinkron_at))}</>
          : <>Instagram belum tersambung — berita sementara dihitung dari jam persetujuan caption. {s.alasan || s.galat || ""}</>}
        {ok && s.galat && <><br />⚠️ {s.galat}</>}
      </span>
    </div>
  );
}

// Postingan yang terbit sejak 2 jam sebelum acara sampai 7 hari sesudahnya;
// kandidat dengan skor kecocokan tertinggi di atas.
function PilihPostingan({ butir, postingan, onPilih, onTutup }) {
  const mulai = epochMulai(butir.ev);
  const skor = new Map((butir.kandidat || []).map((k) => [k.post.id, k.skor]));
  const daftar = postingan
    .filter((p) => { const t = Date.parse(p.terbit_at); return t >= mulai - 2 * 3600000 && t <= mulai + 7 * 86400000 && !(butir.ev.beritaTolak || []).includes(p.id); })
    .sort((a, b) => (skor.get(b.id) || 0) - (skor.get(a.id) || 0) || Date.parse(a.terbit_at) - Date.parse(b.terbit_at));
  return (
    <div role="dialog" aria-modal="true" aria-label="Pilih postingan" onClick={onTutup}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,.55)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: "white", width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: "16px 16px 22px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>Pilih postingan berita</div>
            <div style={{ fontSize: 12, color: ABU, marginTop: 2 }}>{butir.ev.namaAcara} · {fmtTanggal(butir.ev.tanggal)}</div>
          </div>
          <button onClick={onTutup} aria-label="Tutup" style={{ ...tombolKecil, fontSize: 14 }}>✕</button>
        </div>
        {daftar.length === 0
          ? <div style={{ padding: "20px 4px", color: ABU, fontSize: 13, textAlign: "center" }}>Belum ada postingan di akun resmi dalam 7 hari sejak acara.</div>
          : daftar.map((p) => (
            <div key={p.id} style={{ borderTop: "1px solid #F1F5F9", padding: "10px 2px", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: NAVY }}>
                  {fmtWaktu(Date.parse(p.terbit_at))}
                  {skor.has(p.id) && <span style={{ marginLeft: 6, color: HIJAU }}>· kemiripan {Math.round(skor.get(p.id) * 100)}%</span>}
                </div>
                <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5, marginTop: 3 }}>{String(p.caption || "(tanpa teks)").slice(0, 180)}{String(p.caption || "").length > 180 ? "…" : ""}</div>
                <a href={p.permalink} target="_blank" rel="noopener" style={{ fontSize: 11.5, fontWeight: 700, color: "#1E3A6E" }}>Buka di Instagram ↗</a>
              </div>
              <button onClick={() => onPilih(p)} style={{ ...tombolKecil, background: NAVY, color: "white", borderColor: NAVY }}>Pilih</button>
            </div>
          ))}
      </div>
    </div>
  );
}
