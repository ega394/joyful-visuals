/**
 * SurveiKepuasan.jsx — Hasil Survei Kepuasan Masyarakat layanan peminjaman
 * ruang rapat. Untuk Kabag, Kasubbag Protokol, dan pengelola ruangan
 * (termasuk PLH); peladen memeriksa kewenangannya (api/_survei.mjs).
 *
 * IKM dihitung di sini dengan rumus yang sama dengan lib/survei.js
 * (PermenPAN-RB 14/2017): NRR tiap unsur, bobot 1/9, dikali 25.
 */
import React, { useEffect, useMemo, useState } from "react";
import { UNSUR, KODE_UNSUR, hitungIKM } from "../lib/survei.js";

const NAVY = "#0A1628", GOLD = "#C9A84C", GRAY = "#6B7280", BORDER = "#E5E7EB";
const WARNA_MUTU = { A: "#059669", B: "#2563EB", C: "#D97706", D: "#DC2626" };
const BLN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const p2 = (n) => String(n).padStart(2, "0");

function rentang(mode, y, m) {
  if (mode === "bulan") return { dari: `${y}-${p2(m)}-01`, sampai: `${y}-${p2(m)}-31`, label: `${BLN[m - 1]} ${y}` };
  if (mode === "triwulan") { const t = Math.floor((m - 1) / 3); return { dari: `${y}-${p2(t * 3 + 1)}-01`, sampai: `${y}-${p2(t * 3 + 3)}-31`, label: `Triwulan ${t + 1} ${y}` }; }
  if (mode === "tahun") return { dari: `${y}-01-01`, sampai: `${y}-12-31`, label: `Tahun ${y}` };
  return { dari: "0000-01-01", sampai: "9999-12-31", label: "Seluruh periode" };
}
const tglId = (d) => { if (!d) return "-"; const [y, m, h] = d.split("-").map(Number); return `${h} ${BLN[m - 1].slice(0, 3)} ${y}`; };
const rata = (b) => KODE_UNSUR.reduce((a, k) => a + b[k], 0) / KODE_UNSUR.length;

export default function SurveiKepuasan({ ambil, isMobile }) {
  const [baris, setBaris] = useState(null);
  const [galat, setGalat] = useState("");
  const kini = new Date(Date.now() + 8 * 3600000);
  const [mode, setMode] = useState("bulan");
  const [y, setY] = useState(kini.getUTCFullYear());
  const [m, setM] = useState(kini.getUTCMonth() + 1);
  const [ruang, setRuang] = useState("");
  const [saring, setSaring] = useState("saran");

  useEffect(() => {
    let batal = false;
    ambil("/api/room-booking?op=survei_hasil")
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Gagal memuat hasil survei."); return d; })
      .then((d) => { if (!batal) setBaris(d.baris || []); })
      .catch((e) => { if (!batal) setGalat(e.message); });
    return () => { batal = true; };
  }, [ambil]);

  const per = rentang(mode, y, m);
  const geser = (d) => {
    if (mode === "bulan") { const t = m + d; setM(((t - 1 + 12) % 12) + 1); setY(y + Math.floor((t - 1) / 12)); }
    else if (mode === "triwulan") { const t = m + 3 * d; setM(((t - 1 + 12) % 12) + 1); setY(y + Math.floor((t - 1) / 12)); }
    else if (mode === "tahun") setY(y + d);
  };
  const daftarRuang = useMemo(() => [...new Set((baris || []).map((b) => b.ruang).filter(Boolean))].sort(), [baris]);
  const pilih = useMemo(() => (baris || []).filter((b) => b.tanggal_selesai >= per.dari && b.tanggal_selesai <= per.sampai && (!ruang || b.ruang === ruang)), [baris, per.dari, per.sampai, ruang]);
  const terisi = pilih.filter((b) => b.diisi_at);
  const dikirim = pilih.filter((b) => b.terkirim);
  const ikm = hitungIKM(terisi);
  const terendah = ikm.n ? KODE_UNSUR.reduce((a, k) => (ikm.nrr[k] < ikm.nrr[a] ? k : a), KODE_UNSUR[0]) : null;
  const daftar = terisi
    .filter((b) => (saring === "saran" ? b.saran : saring === "rendah" ? rata(b) < 2.5 : true))
    .sort((a, b) => String(b.diisi_at).localeCompare(String(a.diisi_at)));

  const unduhCSV = () => {
    const kepala = ["Kode", "Ruang", "Instansi", "Kegiatan", "Tanggal selesai", "Diisi", ...UNSUR.map((u) => u.unsur), "Saran"];
    const sel = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const isi = terisi.map((b) => [b.booking_code, b.ruang, b.instansi, b.kegiatan, b.tanggal_selesai, (b.diisi_at || "").slice(0, 10), ...KODE_UNSUR.map((k) => b[k]), b.saran].map(sel).join(";"));
    const blob = new Blob(["﻿" + [kepala.map(sel).join(";"), ...isi].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Survei-Kepuasan-Ruangan-${per.label.replace(/\s+/g, "-")}.csv`; a.click();
  };
  const cetak = () => {
    const w = window.open("", "_blank"); if (!w) return;
    const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Survei Kepuasan Ruangan — ${esc(per.label)}</title>
<style>body{font-family:Arial,sans-serif;margin:28px;color:#0F172A}h1{font-size:18px;margin:0}h2{font-size:14px;margin:18px 0 6px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #CBD5E1;padding:5px 7px;text-align:left}th{background:#EEF2F8}.n{text-align:right}</style></head><body>
<h1>Laporan Survei Kepuasan Masyarakat — Layanan Peminjaman Ruang Rapat</h1>
<div style="font-size:12px;color:#475569;margin-top:4px">Bagian Protokol dan Komunikasi Pimpinan, Setda Kota Tarakan · ${esc(per.label)}${ruang ? " · Ruang " + esc(ruang) : ""}</div>
<h2>Indeks Kepuasan Masyarakat</h2>
<table><tr><th>IKM</th><th>Mutu</th><th>Kinerja</th><th>Responden</th><th>Survei terkirim</th></tr>
<tr><td>${ikm.ikm ?? "-"}</td><td>${ikm.mutu ?? "-"}</td><td>${ikm.kinerja ?? "-"}</td><td>${ikm.n}</td><td>${dikirim.length}</td></tr></table>
<h2>Nilai per unsur (skala 1–4)</h2>
<table><tr><th>No</th><th>Unsur</th><th class="n">NRR</th><th class="n">Nilai (×25)</th></tr>
${UNSUR.map((u, i) => `<tr><td>${i + 1}</td><td>${esc(u.unsur)}</td><td class="n">${ikm.nrr[u.kode] == null ? "-" : ikm.nrr[u.kode].toFixed(2)}</td><td class="n">${ikm.nrr[u.kode] == null ? "-" : (ikm.nrr[u.kode] * 25).toFixed(2)}</td></tr>`).join("")}</table>
<h2>Saran responden</h2>
<table><tr><th>Tanggal</th><th>Instansi</th><th>Kegiatan</th><th>Saran</th></tr>
${terisi.filter((b) => b.saran).map((b) => `<tr><td>${tglId(b.tanggal_selesai)}</td><td>${esc(b.instansi)}</td><td>${esc(b.kegiatan)}</td><td>${esc(b.saran)}</td></tr>`).join("") || '<tr><td colspan="4">Belum ada saran.</td></tr>'}</table>
<div style="font-size:11px;color:#64748B;margin-top:14px">Rumus IKM sesuai Peraturan Menteri PANRB Nomor 14 Tahun 2017. Dicetak ${esc(new Date().toLocaleString("id-ID"))}.</div>
</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };

  const kartu = { background: "white", border: `1px solid ${BORDER}`, borderRadius: 14, padding: isMobile ? 14 : 18 };
  const tombol = (aktif) => ({ padding: "7px 13px", borderRadius: 8, border: `1.5px solid ${aktif ? NAVY : BORDER}`, background: aktif ? NAVY : "white", color: aktif ? "white" : NAVY, fontSize: 13, fontWeight: 700, cursor: "pointer" });

  if (galat) return <div style={{ ...kartu, color: "#B91C1C" }}>{galat}</div>;
  if (!baris) return <div style={{ ...kartu, color: GRAY }}>Memuat hasil survei…</div>;
  const warna = WARNA_MUTU[ikm.mutu] || GRAY;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: `linear-gradient(135deg,${NAVY},#1E3A5F)`, color: "white", borderRadius: 14, padding: isMobile ? "16px 16px" : "18px 22px" }}>
        <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 800, color: GOLD }}>SURVEI KEPUASAN MASYARAKAT · PERMENPAN-RB 14/2017</div>
        <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, marginTop: 4 }}>Layanan Peminjaman Ruang Rapat</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>Dikirim lewat WhatsApp pukul 17.00 WITA pada hari terakhir peminjaman; tautan berlaku 7 hari, sekali isi.</div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {[["bulan", "Bulan"], ["triwulan", "Triwulan"], ["tahun", "Tahun"], ["semua", "Semua"]].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} style={tombol(mode === k)}>{l}</button>
        ))}
        {mode !== "semua" && <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: isMobile ? 0 : "auto" }}>
          <button onClick={() => geser(-1)} style={tombol(false)}>‹</button>
          <div style={{ fontWeight: 800, minWidth: 130, textAlign: "center" }}>{per.label}</div>
          <button onClick={() => geser(1)} style={tombol(false)}>›</button>
        </div>}
        <select value={ruang} onChange={(e) => setRuang(e.target.value)} style={{ padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${BORDER}`, fontSize: 13 }}>
          <option value="">Semua ruangan</option>
          {daftarRuang.map((r) => <option key={r} value={r}>Ruang {r}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1.4fr 1fr 1fr", gap: 10 }}>
        <div style={{ ...kartu, gridColumn: isMobile ? "1 / -1" : undefined, borderColor: ikm.n ? warna : BORDER }}>
          <div style={{ fontSize: 12, color: GRAY, fontWeight: 700 }}>INDEKS KEPUASAN MASYARAKAT</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: ikm.n ? warna : GRAY }}>{ikm.ikm == null ? "—" : ikm.ikm.toFixed(2)}</div>
            {ikm.mutu && <div style={{ background: warna, color: "white", borderRadius: 8, padding: "3px 10px", fontWeight: 800 }}>Mutu {ikm.mutu} · {ikm.kinerja}</div>}
          </div>
          <div style={{ fontSize: 12, color: GRAY }}>{ikm.n ? "Skala 25–100" : "Belum ada survei yang diisi pada periode ini."}</div>
        </div>
        <div style={kartu}>
          <div style={{ fontSize: 12, color: GRAY, fontWeight: 700 }}>RESPONDEN</div>
          <div style={{ fontSize: 30, fontWeight: 900, marginTop: 4 }}>{ikm.n}</div>
          <div style={{ fontSize: 12, color: GRAY }}>dari {dikirim.length} survei terkirim</div>
        </div>
        <div style={kartu}>
          <div style={{ fontSize: 12, color: GRAY, fontWeight: 700 }}>PARTISIPASI</div>
          <div style={{ fontSize: 30, fontWeight: 900, marginTop: 4 }}>{dikirim.length ? Math.round((ikm.n / dikirim.length) * 100) + "%" : "—"}</div>
          <div style={{ fontSize: 12, color: GRAY }}>{pilih.filter((b) => b.terkirim === false).length ? `${pilih.filter((b) => b.terkirim === false).length} WA gagal terkirim` : "peminjam yang mengisi"}</div>
        </div>
      </div>

      <div style={kartu}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Nilai per unsur <span style={{ color: GRAY, fontWeight: 500, fontSize: 13 }}>(rata-rata skala 1–4, dikali 25)</span></div>
        {UNSUR.map((u, i) => {
          const v = ikm.nrr[u.kode], nilai = v == null ? null : v * 25, rendah = terendah === u.kode && ikm.n > 0;
          return (
            <div key={u.kode} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 46px" : "260px 1fr 60px", alignItems: "center", gap: 10, padding: "6px 0", borderTop: i ? `1px solid #F1F5F9` : "none" }}>
              <div style={{ fontSize: 13, fontWeight: rendah ? 800 : 600, color: rendah ? "#B91C1C" : NAVY }}>{i + 1}. {u.unsur}{rendah ? " · terendah" : ""}</div>
              {!isMobile && <div style={{ height: 10, background: "#F1F5F9", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ width: `${nilai == null ? 0 : nilai}%`, height: "100%", background: rendah ? "#DC2626" : NAVY, borderRadius: 5 }} />
              </div>}
              <div style={{ textAlign: "right", fontWeight: 800, fontSize: 14 }}>{nilai == null ? "—" : nilai.toFixed(1)}</div>
            </div>
          );
        })}
      </div>

      <div style={kartu}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 800, marginRight: "auto" }}>Jawaban responden</div>
          {[["saran", "Dengan saran"], ["rendah", "Nilai rendah"], ["semua", "Semua"]].map(([k, l]) => (
            <button key={k} onClick={() => setSaring(k)} style={tombol(saring === k)}>{l}</button>
          ))}
        </div>
        {!daftar.length && <div style={{ color: GRAY, fontSize: 13 }}>Belum ada jawaban untuk tampilan ini.</div>}
        {daftar.slice(0, 50).map((b) => {
          const r = rata(b);
          return (
            <div key={b.booking_code} style={{ padding: "10px 0", borderTop: `1px solid #F1F5F9` }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{b.kegiatan}</div>
                <div style={{ fontWeight: 800, fontSize: 13, color: r < 2.5 ? "#B91C1C" : r < 3 ? "#D97706" : "#059669" }}>{(r * 25).toFixed(0)}</div>
              </div>
              <div style={{ fontSize: 12, color: GRAY }}>{b.instansi} · Ruang {b.ruang} · {tglId(b.tanggal_selesai)}</div>
              {b.saran && <div style={{ fontSize: 13, marginTop: 4, background: "#F8FAFC", borderRadius: 8, padding: "6px 10px" }}>“{b.saran}”</div>}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button onClick={unduhCSV} disabled={!ikm.n} style={tombol(false)}>⬇️ Unduh Excel (CSV)</button>
        <button onClick={cetak} style={tombol(true)}>🖨️ Cetak Laporan</button>
      </div>
    </div>
  );
}
