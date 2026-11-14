/**
 * SurveiPage.jsx — Survei Kepuasan Layanan Peminjaman Ruang Rapat (publik).
 *
 * Dibuka dari tautan pribadi di WhatsApp: /survei/<token>. Tanpa akun.
 * Sembilan unsur SKM PermenPAN-RB 14/2017 (lib/survei.js), satu ketukan per
 * pertanyaan, ditambah saran yang boleh dikosongkan. Sekali isi; tautan
 * berlaku 7 hari. Peladen: /api/room-booking?op=survei (api/_survei.mjs).
 */
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { UNSUR, SARAN_MAKS } from "../lib/survei.js";

const NAVY = "#0A1628", NAVY2 = "#1E3A5F", GOLD = "#C9A84C", GREEN = "#059669";
const GRAY = "#6B7280", BORDER = "#E5E7EB", BG = "#F6F4EE";
const WARNA = ["#DC2626", "#D97706", "#2563EB", "#059669"];
const WAJAH = ["😞", "😐", "🙂", "😄"];

// Di tingkat modul supaya kolom saran tidak kehilangan fokus setiap ketukan.
function Kepala() {
  return (
  <div style={{ background: `linear-gradient(135deg,${NAVY} 0%,${NAVY2} 100%)`, color: "white", padding: "22px 20px 26px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 620, margin: "0 auto" }}>
      <img src="/logo_tarakan.png" alt="" style={{ height: 40 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
      <div>
        <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 700, color: GOLD }}>BAGIAN PROTOKOL DAN KOMUNIKASI PIMPINAN</div>
        <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>Survei Kepuasan Layanan Peminjaman Ruang Rapat</div>
      </div>
    </div>
  </div>
  );
}
function Bingkai({ children }) {
  return (
  <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: NAVY }}>
    <Kepala />
    <div style={{ maxWidth: 620, margin: "-14px auto 0", padding: "0 14px 40px" }}>{children}</div>
  </div>
  );
}

export default function SurveiPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [galat, setGalat] = useState("");
  const [jawab, setJawab] = useState({});
  const [saran, setSaran] = useState("");
  const [kirim, setKirim] = useState(false);
  const [selesai, setSelesai] = useState(false);

  useEffect(() => {
    document.title = "Survei Kepuasan Layanan Ruang Rapat — Prokopim Tarakan";
    fetch(`/api/room-booking?op=survei&t=${encodeURIComponent(token || "")}`)
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Tautan survei tidak dikenal."); return d; })
      .then(setInfo)
      .catch((e) => setGalat(e.message));
  }, [token]);

  const terjawab = UNSUR.filter((u) => jawab[u.kode]).length;
  const lengkap = terjawab === UNSUR.length;

  const simpan = async () => {
    if (!lengkap || kirim) return;
    setKirim(true); setGalat("");
    try {
      const r = await fetch(`/api/room-booking?op=survei&t=${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jawaban: jawab, saran }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Gagal mengirim survei.");
      setSelesai(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setGalat(e.message); }
    setKirim(false);
  };

  const kartu = { background: "white", borderRadius: 16, border: `1px solid ${BORDER}`, padding: "18px 18px 16px", marginBottom: 12 };
  if (!info && !galat) return <Bingkai><div style={{ ...kartu, textAlign: "center", color: GRAY }}>Memuat survei…</div></Bingkai>;
  if (!info) return <Bingkai><div style={{ ...kartu, textAlign: "center" }}><div style={{ fontSize: 36 }}>🔗</div><div style={{ fontWeight: 800, margin: "8px 0 4px" }}>Tautan tidak dapat dibuka</div><div style={{ color: GRAY, fontSize: 14 }}>{galat}</div></div></Bingkai>;

  if (selesai || info.status === "sudah") return (
    <Bingkai>
      <div style={{ ...kartu, textAlign: "center", padding: "30px 20px" }}>
        <div style={{ fontSize: 48 }}>🙏</div>
        <div style={{ fontWeight: 800, fontSize: 19, margin: "8px 0 6px" }}>Terima kasih atas penilaian Anda</div>
        <div style={{ color: GRAY, fontSize: 14, lineHeight: 1.6 }}>
          {selesai ? "Jawaban Anda telah kami terima dan akan menjadi bahan perbaikan layanan peminjaman ruang rapat." : "Survei untuk peminjaman ini sudah diisi sebelumnya."}
        </div>
      </div>
    </Bingkai>
  );
  if (info.status === "kedaluwarsa") return (
    <Bingkai>
      <div style={{ ...kartu, textAlign: "center" }}>
        <div style={{ fontSize: 36 }}>⏳</div>
        <div style={{ fontWeight: 800, margin: "8px 0 4px" }}>Masa pengisian sudah berakhir</div>
        <div style={{ color: GRAY, fontSize: 14 }}>Tautan survei berlaku 7 hari sejak dikirim. Terima kasih atas perhatian Anda.</div>
      </div>
    </Bingkai>
  );

  return (
    <Bingkai>
      <div style={kartu}>
        <div style={{ fontSize: 12, color: GRAY, fontWeight: 700, letterSpacing: 1 }}>PEMINJAMAN YANG DINILAI</div>
        <div style={{ fontWeight: 800, fontSize: 16, marginTop: 4 }}>{info.kegiatan}</div>
        <div style={{ fontSize: 14, color: GRAY, marginTop: 2 }}>Ruang {info.ruang} · {info.tanggal}{info.instansi ? ` · ${info.instansi}` : ""}</div>
        <div style={{ fontSize: 13, color: GRAY, marginTop: 10, lineHeight: 1.6 }}>
          Mohon pilih satu jawaban untuk setiap pertanyaan. Survei ini mengikuti sembilan unsur Survei Kepuasan Masyarakat (PermenPAN-RB 14/2017) dan memerlukan sekitar 2 menit.
        </div>
      </div>

      {UNSUR.map((u, i) => (
        <div key={u.kode} style={{ ...kartu, borderColor: jawab[u.kode] ? "#C7D2FE" : BORDER }}>
          <div style={{ fontSize: 11, color: GOLD, fontWeight: 800, letterSpacing: 1 }}>{i + 1}. {u.unsur.toUpperCase()}</div>
          <div style={{ fontWeight: 700, fontSize: 15, margin: "6px 0 12px", lineHeight: 1.45 }}>{u.tanya}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
            {u.pilihan.map((p, n) => {
              const v = n + 1, aktif = jawab[u.kode] === v;
              return (
                <button key={p} type="button" onClick={() => setJawab((j) => ({ ...j, [u.kode]: v }))} aria-pressed={aktif}
                  style={{ border: `2px solid ${aktif ? WARNA[n] : BORDER}`, background: aktif ? WARNA[n] + "14" : "white", borderRadius: 12,
                    padding: "10px 4px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minHeight: 78 }}>
                  <span style={{ fontSize: 24, filter: aktif ? "none" : "grayscale(0.6)", opacity: aktif ? 1 : 0.75 }}>{WAJAH[n]}</span>
                  <span style={{ fontSize: 11, fontWeight: aktif ? 800 : 600, color: aktif ? WARNA[n] : GRAY, lineHeight: 1.25, textAlign: "center" }}>{p}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div style={kartu}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Saran untuk perbaikan layanan <span style={{ color: GRAY, fontWeight: 500 }}>(boleh dikosongkan)</span></div>
        <textarea value={saran} onChange={(e) => setSaran(e.target.value.slice(0, SARAN_MAKS))} rows={4} placeholder="Tuliskan saran Anda…"
          style={{ width: "100%", boxSizing: "border-box", borderRadius: 10, border: `1.5px solid ${BORDER}`, padding: 12, fontSize: 14, fontFamily: "inherit", resize: "vertical" }} />
        <div style={{ textAlign: "right", fontSize: 11, color: GRAY }}>{saran.length}/{SARAN_MAKS}</div>
      </div>

      {galat && <div style={{ ...kartu, background: "#FEF2F2", borderColor: "#FECACA", color: "#B91C1C", fontSize: 14 }}>{galat}</div>}

      <div style={{ position: "sticky", bottom: 0, padding: "10px 0 4px", background: `linear-gradient(transparent,${BG} 30%)` }}>
        <button type="button" onClick={simpan} disabled={!lengkap || kirim}
          style={{ width: "100%", height: 52, borderRadius: 14, border: "none", fontSize: 16, fontWeight: 800, cursor: lengkap ? "pointer" : "default",
            background: lengkap ? GREEN : "#D1D5DB", color: "white" }}>
          {kirim ? "Mengirim…" : lengkap ? "Kirim Penilaian" : `Jawab ${UNSUR.length - terjawab} pertanyaan lagi`}
        </button>
      </div>
    </Bingkai>
  );
}
