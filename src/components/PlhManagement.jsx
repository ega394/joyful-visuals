/**
 * PlhManagement.jsx — Penetapan Pelaksana Harian (PLH)
 *
 * Diakses Kabag dan Superadmin. Kabag menetapkan PLH untuk seluruh jabatan,
 * termasuk PLH bagi dirinya sendiri sebelum cuti; Superadmin menjadi jalur
 * kedua bila Kabag mendadak berhalangan dan belum sempat menunjuk.
 *
 * Layar ini hanya MENCERMINKAN Surat Perintah yang sah — bukan menciptakan
 * kewenangan. Karena itu nomor Surat Perintah dapat dicantumkan, dan masa
 * berlakunya wajib diisi sehingga kewenangannya padam sendiri.
 */
import React, { useState, useEffect, useCallback } from "react";
import { adminFetch } from "../roomAuth";
import {
  PERAN_DAPAT_DIAMPU, PENGAMPU_SAH, LABEL_PERAN,
  plhAktif, periksaPenetapan, hariIniWita,
} from "../lib/plh.js";

const NAVY = "#0A1628", GRAY = "#6b7280", RED = "#dc2626", GREEN = "#16a34a";
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const LABEL_ASAL = {
  kabag: "Kabag Prokopim",
  kasubbag_protokol: "Kasubbag Protokol",
  kasubbag_komdokpim: "Kasubbag Komdokpim",
  staf: "Staf Protokol",
  admin_rk: "Admin Rencana Kegiatan",
  timkom: "Staf Komunikasi & Dokumentasi",
};

// Semua peran yang pernah muncul sebagai pengampu sah, tanpa duplikat.
const PERAN_CALON = [...new Set(Object.values(PENGAMPU_SAH).flat())];

const fmtTgl = (s) => {
  if (!s) return "-";
  const [y, m, d] = s.split("-");
  const B = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
  return `${+d} ${B[+m - 1]} ${y}`;
};

async function muatCalon() {
  const r = await fetch(
    `${SUPA_URL}/rest/v1/users?role=in.(${PERAN_CALON.join(",")})&disabled=neq.true` +
    `&select=username,nama,role,plh_untuk,plh_mulai,plh_selesai,plh_dasar&order=nama`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function simpanPlh(penetap, muatan) {
  const r = await adminFetch(penetap, "/api/room-booking?op=set_plh", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(muatan),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Gagal menyimpan penetapan PLH.");
  return d;
}

export default function PlhManagement({ user, isMobile }) {
  const [daftar, setDaftar]   = useState([]);
  const [memuat, setMemuat]   = useState(true);
  const [sibuk, setSibuk]     = useState(null);
  const [err, setErr]         = useState("");
  const [pesan, setPesan]     = useState("");
  const [buka, setBuka]       = useState(null);      // username yang formulirnya terbuka
  const [form, setForm]       = useState({ plh_untuk: "", plh_mulai: "", plh_selesai: "", plh_dasar: "" });

  const muat = useCallback(async () => {
    setMemuat(true); setErr("");
    try { setDaftar(await muatCalon()); }
    catch { setErr("Gagal memuat daftar pegawai. Periksa koneksi lalu coba lagi."); }
    setMemuat(false);
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const bukaForm = (u) => {
    const p = plhAktif(u);
    setBuka(u.username);
    setForm(p
      ? { plh_untuk: p.untuk, plh_mulai: p.mulai, plh_selesai: p.selesai, plh_dasar: p.dasar }
      : { plh_untuk: "", plh_mulai: hariIniWita(), plh_selesai: "", plh_dasar: "" });
    setErr("");
  };

  const simpan = async (u) => {
    const salah = periksaPenetapan({ peranPengampu: u.role, ...form });
    if (salah) { setErr(salah); return; }
    setSibuk(u.username); setErr("");
    try {
      await simpanPlh(user, { target: u.username, ...form });
      setPesan(`${u.nama} ditetapkan sebagai PLH ${LABEL_PERAN[form.plh_untuk]}`);
      setBuka(null); await muat();
    } catch (e) { setErr(e.message); }
    setSibuk(null);
  };

  const cabut = async (u) => {
    setSibuk(u.username); setErr("");
    try {
      await simpanPlh(user, { target: u.username });
      setPesan(`Penetapan PLH ${u.nama} dicabut`);
      await muat();
    } catch (e) { setErr(e.message); }
    setSibuk(null);
  };

  useEffect(() => {
    if (!pesan) return;
    const t = setTimeout(() => setPesan(""), 4000);
    return () => clearTimeout(t);
  }, [pesan]);

  const inp = { padding: "8px 10px", borderRadius: 8, border: "1.5px solid #D1D5DB",
                fontSize: 13, outline: "none", background: "white", width: "100%" };
  const lbl = { fontSize: 11, fontWeight: 700, color: GRAY, display: "block", marginBottom: 3 };

  return (
    <div style={{ padding: isMobile ? "12px" : "20px 24px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>

        <div style={{ background: `linear-gradient(135deg,${NAVY},#1A2F50)`, borderRadius: 16,
          padding: "18px 20px", marginBottom: 16 }}>
          <div style={{ color: "#C9A84C", fontSize: 11, fontWeight: 800, letterSpacing: 1.5,
            textTransform: "uppercase", marginBottom: 2 }}>Kepegawaian</div>
          <div style={{ color: "white", fontSize: isMobile ? 16 : 20, fontWeight: 900 }}>
            Penetapan Pelaksana Harian
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 3 }}>
            Kewenangan padam sendiri pada tanggal terakhir — tidak perlu diingat untuk dicabut
          </div>
        </div>

        <div style={{ background: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: 10,
          padding: "10px 13px", marginBottom: 16, fontSize: 12, color: "#78350F", lineHeight: 1.6 }}>
          Aplikasi hanya mencerminkan Surat Perintah yang sah. Pastikan penunjukan telah
          dituangkan dalam Surat Perintah sebelum ditetapkan di sini.
          <br />Kabag hanya dapat diampu oleh Kasubbag. Masa PLH paling lama 90 hari.
        </div>

        {err && <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", color: "#991B1B",
          borderRadius: 10, padding: "10px 13px", marginBottom: 14, fontSize: 13 }}>⚠ {err}</div>}
        {pesan && <div style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC", color: "#166534",
          borderRadius: 10, padding: "10px 13px", marginBottom: 14, fontSize: 13 }}>✓ {pesan}</div>}

        {memuat ? (
          <div style={{ textAlign: "center", padding: 40, color: GRAY }}>Memuat…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {daftar.map(u => {
              const aktif = plhAktif(u);
              const bolehAmpu = PERAN_DAPAT_DIAMPU.filter(r => (PENGAMPU_SAH[r] || []).includes(u.role));
              if (!bolehAmpu.length) return null;
              const terbuka = buka === u.username;
              return (
                <div key={u.username} style={{ background: "white", borderRadius: 12,
                  border: `1.5px solid ${aktif ? "#FCD34D" : "#E5E7EB"}`, padding: "13px 15px" }}>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: NAVY, fontSize: 14 }}>{u.nama}</div>
                      <div style={{ fontSize: 11.5, color: GRAY }}>{LABEL_ASAL[u.role] || u.role}</div>
                    </div>
                    {aktif && (
                      <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8,
                        padding: "5px 10px", fontSize: 11.5, color: "#78350F", fontWeight: 700 }}>
                        PLH {LABEL_PERAN[aktif.untuk]} · s.d. {fmtTgl(aktif.selesai)}
                      </div>
                    )}
                    <button onClick={() => (terbuka ? setBuka(null) : bukaForm(u))} disabled={sibuk === u.username}
                      style={{ padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${NAVY}`,
                        background: "white", color: NAVY, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                      {terbuka ? "Tutup" : aktif ? "Ubah" : "Tetapkan"}
                    </button>
                    {aktif && (
                      <button onClick={() => cabut(u)} disabled={sibuk === u.username}
                        style={{ padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${RED}`,
                          background: "white", color: RED, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                        Cabut
                      </button>
                    )}
                  </div>

                  {aktif?.dasar && !terbuka && (
                    <div style={{ marginTop: 6, fontSize: 11.5, color: GRAY }}>
                      Dasar: {aktif.dasar}
                    </div>
                  )}

                  {terbuka && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #E5E7EB",
                      display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                      <div style={{ gridColumn: isMobile ? "auto" : "1/-1" }}>
                        <label style={lbl}>Jabatan yang diampu *</label>
                        <select value={form.plh_untuk} style={inp}
                          onChange={e => setForm(f => ({ ...f, plh_untuk: e.target.value }))}>
                          <option value="">— pilih jabatan —</option>
                          {bolehAmpu.map(r => <option key={r} value={r}>{LABEL_PERAN[r]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>Mulai *</label>
                        <input type="date" value={form.plh_mulai} style={inp}
                          onChange={e => setForm(f => ({ ...f, plh_mulai: e.target.value }))} />
                      </div>
                      <div>
                        <label style={lbl}>Sampai dengan *</label>
                        <input type="date" value={form.plh_selesai} style={inp}
                          onChange={e => setForm(f => ({ ...f, plh_selesai: e.target.value }))} />
                      </div>
                      <div style={{ gridColumn: isMobile ? "auto" : "1/-1" }}>
                        <label style={lbl}>Nomor Surat Perintah (boleh dikosongkan)</label>
                        <input value={form.plh_dasar} style={inp} placeholder="mis. SP/12/PROKOPIM/2026"
                          onChange={e => setForm(f => ({ ...f, plh_dasar: e.target.value }))} />
                      </div>
                      <div style={{ gridColumn: isMobile ? "auto" : "1/-1" }}>
                        <button onClick={() => simpan(u)} disabled={sibuk === u.username}
                          style={{ padding: "9px 18px", borderRadius: 9, border: "none",
                            background: sibuk === u.username ? "#9CA3AF" : GREEN, color: "white",
                            cursor: sibuk === u.username ? "not-allowed" : "pointer",
                            fontSize: 13, fontWeight: 700 }}>
                          {sibuk === u.username ? "Menyimpan…" : "Simpan Penetapan"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 14, padding: "9px 12px", background: "#F1F5F9", borderRadius: 8,
          fontSize: 11, color: "#64748B", lineHeight: 1.6 }}>
          ℹ️ Selama masa PLH, yang bersangkutan memegang kewenangan jabatan yang diampu
          <b> sekaligus</b> kewenangan jabatannya sendiri. Dua hal tidak diwariskan:
          penghapusan acara daftar hadir tetap menunggu Kabag, dan rekap kinerja tim tidak
          terbuka bagi pelaksana yang sedang mengampu.
        </div>
      </div>
    </div>
  );
}
