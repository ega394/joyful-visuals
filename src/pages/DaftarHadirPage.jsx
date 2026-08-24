import React, { useState, useEffect, useCallback, useRef } from "react";

/**
 * /daftarhadir?e=KODE — halaman publik pengisian daftar hadir.
 *
 * Memanggil Google Apps Script LANGSUNG dari browser tamu. Serverless Vercel
 * proyek ini sudah penuh (12/12), jadi tidak ada endpoint perantara. Datanya
 * pun sengaja tidak di Supabase: selfie itu gambar, dan egress Supabase baru
 * saja ditekan dari 6,4 GB ke ~1 GB.
 */

const NAVY = "#0A1628", GOLD = "#C9A84C", GREEN = "#0D6B4F", RED = "#991B1B";
const ABSEN_URL = import.meta.env.VITE_ABSEN_URL || "";

// Content-Type sengaja text/plain: itu "simple request" sehingga browser tidak
// mengirim preflight OPTIONS, yang tidak dilayani Apps Script.
//
// Penulisan ke Sheets dijaga satu kunci di sisi server, jadi pada acara ramai
// (ratusan orang memindai QR serentak saat pintu dibuka) sebagian permintaan
// bisa tertolak karena antre. Dicoba ulang otomatis dengan jeda ACAK — kalau
// jedanya tetap, semua yang tertolak akan kembali menumpuk di detik yang sama
// dan masalahnya berulang.
async function kirimAbsen(payload, percobaan = 0) {
  const r = await fetch(ABSEN_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  const d = await r.json();
  if (!d.ok && /sibuk/i.test(d.error || "") && percobaan < 4) {
    await new Promise(res => setTimeout(res, 700 + Math.random() * 1800));
    return kirimAbsen(payload, percobaan + 1);
  }
  return d;
}

/**
 * Kompres di browser sebelum kirim. Selfie mentah dari kamera ponsel bisa
 * 3–5 MB; tanpa langkah ini pengisian jadi lambat di jaringan kantor dan
 * kuota Drive cepat habis. 800px + kualitas 0.7 ≈ 120–200 KB, masih jelas
 * untuk bukti kehadiran.
 */
function kompresFoto(file, maksSisi = 800, mutu = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("File bukan gambar yang bisa dibaca"));
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > h && w > maksSisi) { h = Math.round(h * maksSisi / w); w = maksSisi; }
        else if (h >= w && h > maksSisi) { w = Math.round(w * maksSisi / h); h = maksSisi; }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", mutu));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const LABEL = {
  jabatan:  { l: "Jabatan",       ph: "mis. Kepala Bagian" },
  instansi: { l: "Instansi",      ph: "mis. Dinas Pendidikan Kota Tarakan" },
  noHP:     { l: "Nomor Ponsel",  ph: "08xxxxxxxxxx" },
};

export default function DaftarHadirPage() {
  const kode = (new URLSearchParams(window.location.search).get("e") || "").toUpperCase();

  const [acara, setAcara]   = useState(null);
  const [muat, setMuat]     = useState(true);
  const [err, setErr]       = useState("");
  const [kirim, setKirim]   = useState(false);
  const [sukses, setSukses] = useState(false);

  const [f, setF] = useState({ nama: "", jabatan: "", instansi: "", noHP: "" });
  const [tambahan, setTambahan] = useState({});
  const [foto, setFoto] = useState("");      // data URI hasil kompresi
  const [fotoErr, setFotoErr] = useState("");
  const kameraRef = useRef(null);
  const galeriRef = useRef(null);

  const ambilAcara = useCallback(async () => {
    if (!ABSEN_URL) { setErr("Sistem daftar hadir belum dikonfigurasi."); setMuat(false); return; }
    if (!kode) { setErr("Tautan tidak lengkap — kode acara tidak ada."); setMuat(false); return; }
    try {
      const d = await fetch(`${ABSEN_URL}?action=acara&kode=${encodeURIComponent(kode)}`).then(r => r.json());
      if (!d.ok) throw new Error(d.error || "Acara tidak ditemukan");
      setAcara(d.acara);
    } catch (e) {
      setErr(e.message || "Gagal memuat data acara.");
    }
    setMuat(false);
  }, [kode]);

  useEffect(() => { ambilAcara(); }, [ambilAcara]);

  const pilihFoto = async (file) => {
    if (!file) return;
    setFotoErr("");
    try { setFoto(await kompresFoto(file)); }
    catch (e) { setFotoErr(e.message || "Gagal memproses foto"); }
  };

  const aktif = (k) => (acara?.fieldAktif || []).includes(k);

  const submit = async () => {
    if (!f.nama.trim()) { setErr("Nama wajib diisi."); return; }
    if (aktif("noHP") && !f.noHP.trim()) { setErr("Nomor ponsel wajib diisi."); return; }
    if (aktif("selfie") && !foto) { setErr("Foto selfie wajib diambil."); return; }
    for (const t of acara?.fieldTambahan || []) {
      if (t.wajib && !String(tambahan[t.label] || "").trim()) {
        setErr(`"${t.label}" wajib diisi.`); return;
      }
    }
    setErr(""); setKirim(true);
    try {
      const d = await kirimAbsen({
        action: "daftar", kode,
        nama: f.nama.trim(), jabatan: f.jabatan.trim(),
        instansi: f.instansi.trim(), noHP: f.noHP.trim(),
        foto: aktif("selfie") ? foto : "",
        tambahan,
      });
      if (!d.ok) throw new Error(d.error || "Gagal menyimpan");
      setSukses(true);
    } catch (e) {
      setErr(e.message || "Gagal mengirim. Periksa koneksi lalu coba lagi.");
    }
    setKirim(false);
  };

  const inp = {
    width: "100%", padding: "11px 13px", borderRadius: 10,
    border: "1.5px solid #CBD5E1", fontSize: 15, boxSizing: "border-box",
    outline: "none", color: "#1e293b",
  };
  const lbl = { display: "block", fontSize: 12.5, fontWeight: 700, color: "#475569", marginBottom: 5 };
  const kotak = {
    minHeight: "100dvh", background: "#F4F7FF", padding: "18px 14px 40px",
    fontFamily: "Inter, system-ui, sans-serif",
  };

  // Halaman tidak lagi ditahan menunggu jawaban Apps Script. Layanan itu sering
  // baru bangun dari dingin dan butuh 1–3 detik; menahan seluruh halaman selama
  // itu membuat tamu menatap layar kosong. Kini identitas acara saja yang
  // menyusul, sementara tamu sudah bisa mulai mengetik namanya.
  if (muat && !acara && !err) return (
    <div style={kotak}>
      <div style={{ maxWidth: 460, margin: "0 auto", paddingTop: 28 }}>
        <div aria-live="polite" style={{ background: "white", borderRadius: 16, padding: "22px 20px",
          border: "1.5px solid #E2E8F0", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: GOLD,
            textTransform: "uppercase", marginBottom: 6 }}>Daftar Hadir Digital</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>Menyiapkan formulir…</div>
          <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 6, lineHeight: 1.6 }}>
            Mohon tunggu sebentar, identitas acara sedang dimuat.
          </div>
          {/* Rangka isian, supaya tamu melihat bentuk formulirnya lebih dulu */}
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 42, borderRadius: 9, background:
                "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 37%,#F1F5F9 63%)",
                backgroundSize: "400% 100%", animation: "dhKilau 1.4s ease infinite" }}/>
            ))}
          </div>
        </div>
      </div>
      <style>{"@keyframes dhKilau{0%{background-position:100% 0}100%{background-position:-100% 0}}"}</style>
    </div>
  );

  if (err && !acara) return (
    <div style={kotak}>
      <div style={{ maxWidth: 460, margin: "60px auto", background: "white", borderRadius: 16,
        padding: "28px 22px", textAlign: "center", border: "1.5px solid #FECDD3" }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
        <div style={{ fontWeight: 800, color: RED, marginBottom: 6 }}>Tidak dapat dibuka</div>
        <div style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.6 }}>{err}</div>
      </div>
    </div>
  );

  if (sukses) return (
    <div style={kotak}>
      <div style={{ maxWidth: 460, margin: "60px auto", background: "white", borderRadius: 16,
        padding: "32px 22px", textAlign: "center", border: "1.5px solid #86EFAC" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: GREEN, marginBottom: 6 }}>Terima kasih!</div>
        <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
          Kehadiran Anda pada <b>{acara.judul}</b> sudah tercatat.
        </div>
      </div>
    </div>
  );

  const ditutup = acara.status === "tutup";

  return (
    <div style={kotak}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>

        <div style={{ background: `linear-gradient(135deg,${NAVY},#1A2F50)`, borderRadius: 16,
          padding: "20px 20px 18px", marginBottom: 14 }}>
          <div style={{ color: GOLD, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6,
            textTransform: "uppercase", marginBottom: 6 }}>Daftar Hadir</div>
          <div style={{ color: "white", fontSize: 19, fontWeight: 900, lineHeight: 1.3 }}>{acara.judul}</div>
          {acara.subjudul && <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 4 }}>{acara.subjudul}</div>}
          {(acara.tanggal || acara.lokasi) && (
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
              {acara.tanggal && <div>🗓️ {acara.tanggal}</div>}
              {acara.lokasi && <div>📍 {acara.lokasi}</div>}
            </div>
          )}
        </div>

        {ditutup ? (
          // Tamu yang datang kepagian perlu tahu KAPAN dibuka; tanpa itu
          // tautannya disangka rusak dan panitia yang dihubungi.
          acara.alasan === "belum_dibuka" ? (
            <div style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: 12,
              padding: "18px 16px", fontSize: 13.5, color: "#1D4ED8", textAlign: "center", lineHeight: 1.7 }}>
              <div style={{ fontSize: 30, marginBottom: 6 }}>🕐</div>
              Pengisian daftar hadir <b>belum dibuka</b>.
              {acara.bukaPukul && <>
                <div style={{ fontSize: 22, fontWeight: 900, margin: "10px 0 4px" }}>
                  Dibuka pukul {acara.bukaPukul} WITA
                </div>
                <div style={{ fontSize: 12.5, color: "#3B82F6" }}>
                  Silakan buka kembali tautan ini saat waktunya tiba.
                </div>
              </>}
            </div>
          ) : (
            <div style={{ background: "#FFF7ED", border: "1.5px solid #FDBA74", borderRadius: 12,
              padding: "16px 16px", fontSize: 13.5, color: "#9A3412", textAlign: "center", lineHeight: 1.7 }}>
              🔒 Daftar hadir untuk acara ini <b>sudah ditutup</b>.
              {acara.alasan === "sudah_lewat" && acara.tutupPukul && (
                <div style={{ fontSize: 12.5, marginTop: 6, color: "#B45309" }}>
                  Pengisian ditutup pukul {acara.tutupPukul} WITA.
                </div>
              )}
            </div>
          )
        ) : (
          <div style={{ background: "white", borderRadius: 16, padding: "18px 16px",
            border: "1.5px solid #E2E8F0" }}>

            <div style={{ marginBottom: 13 }}>
              <label style={lbl}>Nama Lengkap <span style={{ color: RED }}>*</span></label>
              <input value={f.nama} onChange={e => setF(p => ({ ...p, nama: e.target.value }))}
                placeholder="Nama dan gelar" style={inp}/>
            </div>

            {["jabatan", "instansi", "noHP"].filter(aktif).map(k => (
              <div key={k} style={{ marginBottom: 13 }}>
                <label style={lbl}>
                  {LABEL[k].l}{k === "noHP" && <span style={{ color: RED }}> *</span>}
                </label>
                <input value={f[k]} onChange={e => setF(p => ({ ...p, [k]: e.target.value }))}
                  placeholder={LABEL[k].ph}
                  type={k === "noHP" ? "tel" : "text"}
                  inputMode={k === "noHP" ? "numeric" : undefined}
                  style={inp}/>
              </div>
            ))}

            {(acara.fieldTambahan || []).map(t => (
              <div key={t.label} style={{ marginBottom: 13 }}>
                <label style={lbl}>{t.label}{t.wajib && <span style={{ color: RED }}> *</span>}</label>
                <input value={tambahan[t.label] || ""}
                  onChange={e => setTambahan(p => ({ ...p, [t.label]: e.target.value }))}
                  style={inp}/>
              </div>
            ))}

            {aktif("selfie") && (
              <div style={{ marginBottom: 15 }}>
                <label style={lbl}>Foto Selfie <span style={{ color: RED }}>*</span></label>
                {foto ? (
                  <div style={{ position: "relative" }}>
                    <img src={foto} alt="Selfie" style={{ width: "100%", borderRadius: 12, display: "block" }}/>
                    <button onClick={() => setFoto("")}
                      style={{ position: "absolute", top: 8, right: 8, padding: "6px 12px", borderRadius: 8,
                        border: "none", background: "rgba(0,0,0,0.65)", color: "white",
                        cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                      Ganti
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => kameraRef.current?.click()}
                      style={{ flex: 1, padding: "13px", borderRadius: 11, border: "none",
                        background: NAVY, color: "white", cursor: "pointer", fontSize: 13.5, fontWeight: 800 }}>
                      📷 Kamera
                    </button>
                    <button onClick={() => galeriRef.current?.click()}
                      style={{ flex: 1, padding: "13px", borderRadius: 11, border: `1.5px solid ${NAVY}`,
                        background: "white", color: NAVY, cursor: "pointer", fontSize: 13.5, fontWeight: 800 }}>
                      🖼️ Galeri
                    </button>
                  </div>
                )}
                {/* capture="user" mengarahkan ke kamera depan; input kedua tanpa
                    capture agar pengguna tetap bisa memilih dari galeri */}
                <input ref={kameraRef} type="file" accept="image/*" capture="user"
                  onChange={e => { pilihFoto(e.target.files?.[0]); e.target.value = ""; }}
                  style={{ display: "none" }}/>
                <input ref={galeriRef} type="file" accept="image/*"
                  onChange={e => { pilihFoto(e.target.files?.[0]); e.target.value = ""; }}
                  style={{ display: "none" }}/>
                {fotoErr && <div style={{ fontSize: 12, color: RED, marginTop: 6 }}>{fotoErr}</div>}
              </div>
            )}

            {err && (
              <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", color: "#991B1B",
                borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 13 }}>{err}</div>
            )}

            <button onClick={submit} disabled={kirim}
              style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none",
                background: kirim ? "#94A3B8" : `linear-gradient(135deg,${NAVY},#1B4080)`,
                color: "white", cursor: kirim ? "default" : "pointer", fontSize: 15, fontWeight: 800 }}>
              {kirim ? "Mengirim… mohon tunggu" : "Kirim Daftar Hadir"}
            </button>
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 11, color: "#94A3B8", marginTop: 16, lineHeight: 1.7 }}>
          Bagian Protokol dan Komunikasi Pimpinan<br/>Setda Kota Tarakan
        </div>
      </div>
    </div>
  );
}
