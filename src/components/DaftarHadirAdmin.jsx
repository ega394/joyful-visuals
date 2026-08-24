import React, { useState, useEffect, useCallback } from "react";
import QrDaftarHadir from "./QrDaftarHadir.jsx";
import LaporanHadir from "./LaporanHadir.jsx";

/**
 * Kelola acara daftar hadir — dipakai dari dalam aplikasi (sudah login).
 *
 * Rekap peserta SENGAJA tidak ditampilkan di sini. Web App Apps Script tidak
 * pernah mengembalikan data peserta; rekap hanya dibuka lewat Spreadsheet.
 * Konsekuensinya: seandainya token bocor, yang bisa dilakukan orang luar
 * hanyalah membuat acara sampah — bukan mengambil data pribadi tamu.
 */

const NAVY = "#0A1628", GOLD = "#C9A84C", GREEN = "#0D6B4F", RED = "#991B1B";
const ABSEN_URL   = import.meta.env.VITE_ABSEN_URL   || "";
const ABSEN_TOKEN = import.meta.env.VITE_ABSEN_TOKEN || "";

async function kirim(payload) {
  // text/plain = simple request, tidak memicu preflight yang tak dilayani Apps Script
  const r = await fetch(ABSEN_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, token: ABSEN_TOKEN }),
    redirect: "follow",
  });
  return r.json();
}

const FIELD_BAKU = [
  { k: "jabatan",  l: "Jabatan" },
  { k: "instansi", l: "Instansi" },
  { k: "noHP",     l: "Nomor Ponsel" },
  { k: "selfie",   l: "Foto Selfie" },
];

export default function DaftarHadirAdmin({ user, isMobile, showT }) {
  const [acara, setAcara]   = useState([]);
  const [sheetUrl, setSheetUrl] = useState("");
  const [muat, setMuat]     = useState(true);
  const [err, setErr]       = useState("");
  const [buka, setBuka]     = useState(false);   // form buat acara
  const [qrAcara, setQrAcara] = useState(null);  // acara yang QR-nya dibuka
  const [lapAcara, setLapAcara] = useState(null); // acara yang laporannya dibuka
  const [sibuk, setSibuk]   = useState(false);

  const [judul, setJudul]       = useState("");
  const [subjudul, setSubjudul] = useState("");
  const [tanggal, setTanggal]   = useState("");
  const [lokasi, setLokasi]     = useState("");
  const [jamMulai, setJamMulai]     = useState("");
  const [jamSelesai, setJamSelesai] = useState("");
  const [fieldAktif, setFieldAktif] = useState(["jabatan", "instansi", "noHP", "selfie"]);
  const [tambahan, setTambahan] = useState([]);   // [{label,wajib}]

  const muatAcara = useCallback(async () => {
    if (!ABSEN_URL || !ABSEN_TOKEN) {
      setErr("Sistem daftar hadir belum dikonfigurasi. Lihat google-apps-script/daftar-hadir.gs untuk panduan pemasangan.");
      setMuat(false); return;
    }
    setMuat(true); setErr("");
    try {
      const d = await fetch(`${ABSEN_URL}?action=daftar_acara&token=${encodeURIComponent(ABSEN_TOKEN)}`)
        .then(r => r.json());
      if (!d.ok) throw new Error(d.error || "Gagal memuat");
      setAcara(d.acara || []);
      setSheetUrl(d.sheetUrl || "");
    } catch (e) {
      setErr(e.message || "Gagal memuat daftar acara.");
    }
    setMuat(false);
  }, []);

  useEffect(() => { muatAcara(); }, [muatAcara]);

  const toggleField = (k) => setFieldAktif(p =>
    p.includes(k) ? p.filter(x => x !== k) : [...p, k]);

  const buatAcara = async () => {
    if (!judul.trim()) { showT?.("Judul acara wajib diisi", "warn"); return; }
    if (!tanggal)  { showT?.("Tanggal acara wajib diisi", "warn"); return; }
    if (!jamMulai) { showT?.("Jam mulai wajib diisi — dipakai untuk buka-tutup otomatis", "warn"); return; }
    if (jamSelesai && jamSelesai <= jamMulai) {
      showT?.("Jam selesai harus lebih besar dari jam mulai", "warn"); return;
    }
    setSibuk(true);
    try {
      const d = await kirim({
        action: "buat_acara",
        judul: judul.trim(), subjudul: subjudul.trim(),
        tanggal, lokasi: lokasi.trim(),
        jamMulai, jamSelesai,
        fieldAktif,
        fieldTambahan: tambahan.filter(t => t.label.trim()),
        dibuatOleh: user?.nama || user?.username || "",
      });
      if (!d.ok) throw new Error(d.error || "Gagal membuat acara");
      showT?.("✅ Acara daftar hadir dibuat", "ok");
      setBuka(false);
      setJudul(""); setSubjudul(""); setTanggal(""); setLokasi("");
      setJamMulai(""); setJamSelesai("");
      setFieldAktif(["jabatan", "instansi", "noHP", "selfie"]); setTambahan([]);
      muatAcara();
    } catch (e) { showT?.("Gagal: " + e.message, "error"); }
    setSibuk(false);
  };

  // Tiga keadaan: "otomatis" mengikuti jadwal, "buka"/"tutup" memaksa.
  const PESAN_STATUS = {
    buka:     "Pengisian dibuka paksa — jadwal diabaikan",
    tutup:    "Pengisian ditutup paksa — jadwal diabaikan",
    otomatis: "Kembali mengikuti jadwal otomatis",
  };
  const ubahStatus = async (a, baru) => {
    setSibuk(true);
    try {
      const d = await kirim({ action: "ubah_status", kode: a.kode, status: baru });
      if (!d.ok) throw new Error(d.error || "Gagal");
      showT?.(PESAN_STATUS[baru] || "Status diperbarui", "ok");
      muatAcara();
    } catch (e) { showT?.("Gagal: " + e.message, "error"); }
    setSibuk(false);
  };

  const tautan = (kode) => `${window.location.origin}/daftarhadir?e=${kode}`;

  const salin = async (kode) => {
    try {
      await navigator.clipboard.writeText(tautan(kode));
      showT?.("Tautan disalin", "ok");
    } catch {
      // clipboard bisa ditolak di konteks tertentu — tampilkan agar bisa disalin manual
      window.prompt("Salin tautan ini:", tautan(kode));
    }
  };

  const inp = {
    width: "100%", padding: "9px 11px", borderRadius: 9, border: "1.5px solid #CBD5E1",
    fontSize: 13, boxSizing: "border-box", outline: "none", color: "#1e293b",
  };
  const lbl = { display: "block", fontSize: 11.5, fontWeight: 700, color: "#475569", marginBottom: 4 };
  const btn = {
    padding: "8px 13px", borderRadius: 9, border: "1.5px solid #D1D5DB",
    background: "white", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#334155",
  };

  return (
    <div style={{ padding: isMobile ? "12px 12px" : "20px 24px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        <div style={{ background: `linear-gradient(135deg,${NAVY},#1A2F50)`, borderRadius: 16,
          padding: "18px 20px", marginBottom: 16 }}>
          <div style={{ color: GOLD, fontSize: 11, fontWeight: 800, letterSpacing: 1.5,
            textTransform: "uppercase", marginBottom: 2 }}>Daftar Hadir Digital</div>
          <div style={{ color: "white", fontSize: isMobile ? 16 : 20, fontWeight: 900 }}>
            Kelola Acara &amp; Tautan Pengisian
          </div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 2 }}>
            Rekap peserta dibuka langsung di Google Spreadsheet
          </div>
        </div>

        {err && (
          <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", color: "#991B1B",
            borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, lineHeight: 1.6 }}>
            ⚠ {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => setBuka(b => !b)}
            style={{ ...btn, border: "none", background: NAVY, color: "white" }}>
            {buka ? "✕ Batal" : "+ Buat Daftar Hadir"}
          </button>
          <button onClick={muatAcara} style={btn}>↻ Muat Ulang</button>
          {sheetUrl && (
            <a href={sheetUrl} target="_blank" rel="noopener noreferrer"
              style={{ ...btn, textDecoration: "none", display: "inline-flex", alignItems: "center",
                border: `1.5px solid ${GREEN}`, color: GREEN }}>
              📊 Buka Rekap di Spreadsheet
            </a>
          )}
        </div>

        {buka && (
          <div style={{ background: "white", borderRadius: 14, padding: "16px 16px",
            border: "1.5px solid #E2E8F0", marginBottom: 16 }}>

            <div style={{ marginBottom: 11 }}>
              <label style={lbl}>Judul Acara *</label>
              <input value={judul} onChange={e => setJudul(e.target.value)}
                placeholder="mis. Rapat Koordinasi Forkopimda" style={inp}/>
            </div>
            <div style={{ marginBottom: 11 }}>
              <label style={lbl}>Keterangan / Penyelenggara</label>
              <input value={subjudul} onChange={e => setSubjudul(e.target.value)}
                placeholder="mis. Bagian Prokopim Setda Kota Tarakan" style={inp}/>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 13, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 150px" }}>
                <label style={lbl}>Tanggal</label>
                <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} style={inp}/>
              </div>
              <div style={{ flex: "1 1 110px" }}>
                <label style={lbl}>Jam Mulai *</label>
                <input type="time" value={jamMulai} onChange={e => setJamMulai(e.target.value)} style={inp}/>
              </div>
              <div style={{ flex: "1 1 110px" }}>
                <label style={lbl}>Jam Selesai</label>
                <input type="time" value={jamSelesai} onChange={e => setJamSelesai(e.target.value)} style={inp}/>
              </div>
              <div style={{ flex: "2 1 200px" }}>
                <label style={lbl}>Lokasi</label>
                <input value={lokasi} onChange={e => setLokasi(e.target.value)}
                  placeholder="mis. Ruang Rapat Lt.3" style={inp}/>
              </div>
            </div>

            <div style={{ marginBottom: 13, padding: "9px 11px", background: "#EFF6FF",
              border: "1px solid #BFDBFE", borderRadius: 8, fontSize: 11.5, color: "#1D4ED8", lineHeight: 1.6 }}>
              🕐 Pengisian terbuka otomatis <b>30 menit sebelum</b> jam mulai, dan tertutup
              <b> 1 jam setelah</b> jam selesai. Bila jam selesai dikosongkan, tertutup
              <b> 6 jam setelah</b> jam mulai. Bisa dibuka atau ditutup manual kapan saja.
            </div>

            <div style={{ marginBottom: 13 }}>
              <label style={lbl}>Isian yang Ditampilkan</label>
              <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 7 }}>
                Nama selalu ada dan wajib. Pilih isian lain sesuai kebutuhan acara.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {FIELD_BAKU.map(fb => {
                  const on = fieldAktif.includes(fb.k);
                  return (
                    <button key={fb.k} onClick={() => toggleField(fb.k)}
                      style={{ padding: "6px 12px", borderRadius: 20, cursor: "pointer",
                        fontSize: 12, fontWeight: 700,
                        border: "1.5px solid " + (on ? "#1D4ED8" : "#E2E8F0"),
                        background: on ? "#EFF6FF" : "white",
                        color: on ? "#1D4ED8" : "#94A3B8" }}>
                      {on ? "✓ " : ""}{fb.l}
                    </button>
                  );
                })}
              </div>
              {fieldAktif.includes("noHP") && (
                <div style={{ fontSize: 11, color: "#065F46", marginTop: 7 }}>
                  ℹ️ Pengisian ganda dicegah berdasarkan nomor ponsel.
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Isian Tambahan (opsional, maks. 3)</label>
              {tambahan.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                  <input value={t.label} placeholder="Nama isian, mis. Asal Kecamatan"
                    onChange={e => setTambahan(p => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                    style={{ ...inp, flex: 1 }}/>
                  <button onClick={() => setTambahan(p => p.map((x, j) => j === i ? { ...x, wajib: !x.wajib } : x))}
                    style={{ ...btn, fontSize: 11, padding: "7px 10px",
                      border: "1.5px solid " + (t.wajib ? "#1D4ED8" : "#E2E8F0"),
                      color: t.wajib ? "#1D4ED8" : "#94A3B8" }}>
                    {t.wajib ? "Wajib" : "Opsional"}
                  </button>
                  <button onClick={() => setTambahan(p => p.filter((_, j) => j !== i))}
                    style={{ ...btn, fontSize: 12, padding: "7px 10px", color: RED, border: "1.5px solid #FECDD3" }}>✕</button>
                </div>
              ))}
              {tambahan.length < 3 && (
                <button onClick={() => setTambahan(p => [...p, { label: "", wajib: false }])} style={btn}>
                  + Tambah Isian
                </button>
              )}
            </div>

            <button onClick={buatAcara} disabled={sibuk}
              style={{ width: "100%", padding: "12px", borderRadius: 11, border: "none",
                background: sibuk ? "#94A3B8" : NAVY, color: "white",
                cursor: sibuk ? "default" : "pointer", fontSize: 14, fontWeight: 800 }}>
              {sibuk ? "Menyimpan…" : "Buat & Dapatkan Tautan"}
            </button>
          </div>
        )}

        {muat ? (
          <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Memuat…</div>
        ) : acara.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, background: "white", borderRadius: 14,
            border: "1.5px solid #E5E7EB", color: "#94A3B8", fontSize: 14 }}>
            Belum ada acara daftar hadir.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {acara.map(a => {
              // `efektifBuka` sudah memperhitungkan jadwal; acara lama yang
              // belum punya kolom itu jatuh ke pembacaan status apa adanya.
              const terbuka = a.efektifBuka !== undefined ? a.efektifBuka : a.status !== "tutup";
              const tutup = !terbuka;
              const jadwal = a.jamMulai
                ? a.jamMulai + (a.jamSelesai ? "–" + a.jamSelesai : "") + " WITA"
                : "";
              return (
                <div key={a.kode} style={{ background: "white", borderRadius: 13,
                  border: "1.5px solid " + (tutup ? "#E2E8F0" : "#BFDBFE"), padding: "13px 15px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: NAVY, marginBottom: 2 }}>{a.judul}</div>
                      {a.subjudul && <div style={{ fontSize: 12, color: "#64748B" }}>{a.subjudul}</div>}
                      <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 3 }}>
                        {a.tanggal ? `🗓️ ${a.tanggal} · ` : ""}{jadwal ? `🕐 ${jadwal} · ` : ""}
                        {a.lokasi ? `📍 ${a.lokasi} · ` : ""}
                        Kode <b style={{ fontFamily: "monospace", color: NAVY }}>{a.kode}</b>
                      </div>
                    </div>
                    <div style={{ textAlign: "center", flexShrink: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: NAVY, lineHeight: 1 }}>{a.jumlahHadir}</div>
                      <div style={{ fontSize: 9.5, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>hadir</div>
                    </div>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800,
                      background: tutup ? "#F1F5F9" : "#D1FAE5", color: tutup ? "#64748B" : GREEN }}>
                      {tutup ? "Ditutup" : "Terbuka"}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 7, marginTop: 11, flexWrap: "wrap" }}>
                    <button onClick={() => salin(a.kode)} style={{ ...btn, border: "none", background: NAVY, color: "white" }}>
                      🔗 Salin Tautan
                    </button>
                    <button onClick={() => setQrAcara(a)} style={btn}>▦ QR Code</button>
                    <button onClick={() => setLapAcara(a)} style={btn}>📄 Laporan</button>
                    <a href={tautan(a.kode)} target="_blank" rel="noopener noreferrer"
                      style={{ ...btn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                      ↗ Buka
                    </a>
                    <button onClick={() => ubahStatus(a, tutup ? "buka" : "tutup")} disabled={sibuk}
                      style={{ ...btn, color: tutup ? GREEN : "#92400E",
                        border: "1.5px solid " + (tutup ? "#86EFAC" : "#FDE68A") }}>
                      {tutup ? "Buka Paksa" : "Tutup Paksa"}
                    </button>
                    {/* Hanya muncul saat status sedang dipaksa DAN acaranya punya
                        jadwal — kalau tidak, tombolnya tidak berarti apa-apa. */}
                    {a.status !== "otomatis" && a.jamMulai && (
                      <button onClick={() => ubahStatus(a, "otomatis")} disabled={sibuk}
                        style={{ ...btn, color: "#1D4ED8", border: "1.5px solid #BFDBFE" }}>
                        ↺ Ikuti Jadwal
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 14, padding: "9px 12px", background: "#F1F5F9", borderRadius: 8,
          fontSize: 11, color: "#64748B", lineHeight: 1.6 }}>
          ℹ️ Data peserta dan foto tersimpan di Google Spreadsheet akun absen — tidak di aplikasi ini.
          Untuk melihat, menyortir, atau mengekspornya, buka Spreadsheet lewat tombol di atas.
        </div>
      </div>

      {qrAcara && (
        <QrDaftarHadir
          acara={qrAcara}
          tautan={tautan(qrAcara.kode)}
          onClose={() => setQrAcara(null)}
        />
      )}

      {lapAcara && (
        <LaporanHadir
          acara={lapAcara}
          user={user}
          showT={showT}
          onClose={() => setLapAcara(null)}
        />
      )}
    </div>
  );
}
