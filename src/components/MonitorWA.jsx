/**
 * MonitorWA — meteran dan arsip WA keluar (keputusan Kabag, Oktober 2026).
 *
 * Untuk Admin RK, Kasubbag Protokol, Kabag (+PLH), dan superadmin. Data dari
 * /api/whatsapp?op=monitor_wa (api/_monitorwa.js); peladen yang menentukan
 * lingkup: Admin RK hanya melihat WA ke pihak luar (pemohon audiensi dan
 * peminjam ruangan), yang lain melihat semua. Nomor selalu disamarkan.
 *
 * Prop `ambil(url, opsi)` → Promise<Response> yang membawa token sesi:
 * sesiFetch di aplikasi utama, adminFetch di konsol superadmin.
 */
import React, { useCallback, useEffect, useState } from "react";

const NAVY = "#0A1628";
const JENIS = {
  tamu_tanda_terima: "Tanda terima permohonan audiensi",
  tamu_keputusan_approved: "Audiensi disetujui",
  tamu_keputusan_rejected: "Audiensi ditolak",
  tamu_keputusan_disposed: "Audiensi didisposisikan",
  tamu_jadwal_diubah: "Jadwal audiensi diubah",
  tamu_kirim_ulang: "Kirim ulang ke pemohon",
  tamu_mendesak: "Permohonan tamu mendesak (internal)",
  tamu_disetujui_ajudan: "Audiensi disetujui (ke ajudan)",
  ruangan_tanda_terima: "Tanda terima peminjaman ruangan",
  ruangan_keputusan_approved: "Peminjaman ruangan disetujui",
  ruangan_keputusan_rejected: "Peminjaman ruangan ditolak",
  ruangan_keputusan_cancelled: "Peminjaman ruangan dibatalkan",
  ruangan_batal_ditolak: "Pembatalan ruangan ditolak",
  ruangan_pengajuan_baru: "Pengajuan ruangan baru (internal)",
  ruangan_minta_batal: "Permintaan batal ruangan (internal)",
  rekap_pagi_ajudan: "Rekap pagi ajudan",
  rekap_ajudan_besok: "Rekap ajudan untuk besok",
  briefing_pimpinan: "Briefing pimpinan",
  ringkasan_sore: "Ringkasan sore",
  otp: "Kode OTP (isi tidak disimpan)",
  newsroom_review: "Draft berita untuk ditinjau",
  newsroom_revisi: "Draft berita perlu revisi",
  broadcast: "Pengumuman",
  penugasan: "Penugasan",
  kabar_lapangan: "Kabar lapangan",
  konfirmasi_kehadiran: "Konfirmasi kehadiran pimpinan",
};
const labelJenis = (j) => JENIS[j] || String(j || "-").replace(/_/g, " ");

/** Status kiriman → [label, warna]. */
function statusKiriman(r) {
  if (!r.berhasil) return ["❌ Gagal", "#DC2626"];
  const st = String(r.state || "").toLowerCase(), sk = String(r.status_kirim || "").toLowerCase();
  if (["read", "dibaca"].includes(st)) return ["✓✓ Dibaca", "#2563EB"];
  if (["delivered", "received", "diterima"].includes(st)) return ["✓✓ Sampai di HP", "#059669"];
  if (st === "0") return ["⚠️ Tidak sampai (dibatasi WhatsApp)", "#D97706"];
  if (sk === "sent") return ["✓ Terkirim", "#059669"];
  if (["pending", "processing", "waiting", "diterima", ""].includes(sk)) return ["⏳ Diterima Fonnte", "#64748B"];
  return [sk, "#64748B"];
}

const waktu = (t) => t ? new Date(t).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export default function MonitorWA({ ambil, isMobile, showT }) {
  const [saring, setSaring] = useState("semua");
  const [q, setQ] = useState("");
  const [cari, setCari] = useState("");
  const [data, setData] = useState(null);
  const [arsip, setArsip] = useState([]);
  const [hal, setHal] = useState(0);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [buka, setBuka] = useState(null);
  const [sibuk, setSibuk] = useState(null);

  const muat = useCallback(async (halaman = 0, segarkan = false) => {
    setMemuat(true); setGalat("");
    try {
      const p = new URLSearchParams({ op: "monitor_wa", saring, hal: String(halaman) });
      if (cari) p.set("q", cari);
      if (segarkan) p.set("segarkan", "1");
      const r = await ambil("/api/whatsapp?" + p.toString());
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Gagal memuat (HTTP " + r.status + ")");
      // Balasan yang tidak lengkap tidak boleh merobohkan seluruh layar.
      const arsipBaru = Array.isArray(d && d.arsip) ? d.arsip : [];
      setData(d || {}); setHal(halaman);
      setArsip((lama) => (halaman === 0 ? arsipBaru : [...(lama || []), ...arsipBaru]));
    } catch (e) { setGalat(e.message); }
    finally { setMemuat(false); }
  }, [ambil, saring, cari]);

  useEffect(() => { muat(0); }, [muat]);

  const kirimUlang = async (r) => {
    const id = String(r.rujukan || "").replace(/^tamu:/, "");
    if (!id) return;
    setSibuk(r.id);
    try {
      const kirim = async (pratinjau) => {
        const x = await ambil("/api/guest?action=kirim_ulang_wa", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, pratinjau }),
        });
        const d = await x.json().catch(() => ({}));
        if (!x.ok) throw new Error(d.error || "Gagal (HTTP " + x.status + ")");
        return d;
      };
      const pr = await kirim(true);
      if (pr.kuotaHabis) throw new Error("Sudah 3 kali dikirim ulang hari ini untuk permohonan ini.");
      if (pr.tungguMenit) throw new Error("Baru saja dikirim ulang. Coba lagi dalam " + pr.tungguMenit + " menit.");
      if (!window.confirm("Kirim ulang pemberitahuan terbaru kepada " + (r.nama_penerima || "pemohon") + "?\n\n" + String(pr.pesan || "").slice(0, 400))) return;
      await kirim(false);
      showT && showT("✅ Pemberitahuan dikirim ulang ke pemohon");
      muat(0);
    } catch (e) { showT ? showT("❌ " + e.message) : alert(e.message); }
    finally { setSibuk(null); }
  };

  // Kirim ulang semua WA yang gagal karena perangkat Fonnte terputus (48 jam
  // terakhir); peladen mengirim paling banyak 10 per ketukan dan menolak bila
  // perangkat masih terputus.
  const kirimUlangSemua = async () => {
    const n = data?.ulang?.jumlah || 0;
    if (!n || !window.confirm("Kirim ulang " + n + " WA yang gagal karena perangkat terputus?\n\nIsi pesannya sama persis dengan aslinya. Pastikan kabarnya masih relevan.")) return;
    setSibuk("ulang");
    try {
      let total = 0, gagal = 0, sisa = n;
      while (sisa > 0) {
        const x = await ambil("/api/whatsapp?op=wa_kirim_ulang_gagal", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const d = await x.json().catch(() => ({}));
        if (!x.ok) throw new Error(d.error || "Gagal (HTTP " + x.status + ")");
        total += d.terkirim || 0; gagal += d.gagal || 0;
        if ((d.terkirim || 0) + (d.gagal || 0) === 0) break;
        sisa = d.sisa || 0;
      }
      showT && showT(gagal ? "⚠️ " + total + " terkirim ulang, " + gagal + " masih gagal" : "✅ " + total + " WA terkirim ulang");
      muat(0);
    } catch (e) { showT ? showT("❌ " + e.message) : alert(e.message); }
    finally { setSibuk(null); }
  };

  const perangkat = data?.perangkat;
  const putus = perangkat?.status === "terputus";
  const kotak = { background: "white", border: "1px solid #E2E8F0", borderRadius: 12, padding: isMobile ? "12px 14px" : "14px 18px", marginBottom: 12 };
  const chip = (k, l) => (
    <button key={k} onClick={() => setSaring(k)} style={{
      padding: "6px 12px", borderRadius: 999, border: "1.5px solid " + (saring === k ? NAVY : "#CBD5E1"),
      background: saring === k ? NAVY : "white", color: saring === k ? "white" : "#475569", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
    }}>{l}</button>
  );
  const angka = (judul, v) => (
    <div style={{ ...kotak, marginBottom: 0, flex: 1, minWidth: isMobile ? "30%" : 150 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>{judul}</div>
      <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: NAVY }}>{(v?.ok || 0) + (v?.gagal || 0)}</div>
      <div style={{ fontSize: 12, color: "#64748B" }}>✓ {v?.ok || 0} · <span style={{ color: v?.gagal ? "#DC2626" : "#64748B" }}>✗ {v?.gagal || 0}</span></div>
    </div>
  );

  return (
    <div style={{ padding: isMobile ? "12px" : "20px 24px", fontFamily: "var(--font-sans)", maxWidth: 980 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: isMobile ? 19 : 22, fontWeight: 800, color: NAVY }}>📊 Monitor WA</div>
        <div style={{ fontSize: 13, color: "#64748B" }}>
          Meteran dan arsip WhatsApp yang dikirim aplikasi
          {data?.lingkup === "eksternal" ? " · menampilkan WA ke pemohon audiensi dan peminjam ruangan" : data ? " · semua WA" : ""}
        </div>
      </div>

      {galat && <div style={{ ...kotak, background: "#FEF2F2", borderColor: "#FECACA", color: "#991B1B", fontSize: 13 }}>{galat}</div>}

      {perangkat && (
        <div style={{ ...kotak, background: putus ? "#FEF2F2" : "#F0FDF4", borderColor: putus ? "#FECACA" : "#BBF7D0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: putus ? "#B91C1C" : "#15803D", flex: 1, minWidth: 200 }}>
              {putus ? "⚠️ Perangkat WhatsApp TERPUTUS — WA tidak akan terkirim" : perangkat.status === "tersambung" ? "🟢 Perangkat WhatsApp tersambung" : "Perangkat WhatsApp: status belum diketahui"}
            </div>
            <button onClick={() => muat(0, true)} disabled={memuat} style={{ border: "1.5px solid #CBD5E1", background: "white", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>↻ Periksa sekarang</button>
          </div>
          <div style={{ fontSize: 12.5, color: "#475569", marginTop: 4, lineHeight: 1.6 }}>
            {perangkat.kuota !== null && perangkat.kuota !== undefined && <>Sisa kuota: <b>{String(perangkat.kuota)}</b> · </>}
            {perangkat.kedaluwarsa && <>Masa aktif: <b>{String(perangkat.kedaluwarsa)}</b> · </>}
            {perangkat.paket && <>Paket: {String(perangkat.paket)} · </>}
            {perangkat.diperbarui_pada && <>diperiksa {waktu(perangkat.diperbarui_pada)}</>}
            {perangkat.galat && <div style={{ color: "#B45309" }}>{perangkat.galat}</div>}
            {putus && <div style={{ marginTop: 4, color: "#991B1B" }}>Sambungkan ulang: buka dasbor fonnte.com → Device → Connect, lalu pindai kode QR dengan WhatsApp di HP nomor resmi.</div>}
          </div>
        </div>
      )}

      {data?.ulang?.jumlah > 0 && (
        <div style={{ ...kotak, background: "#FFFBEB", borderColor: "#FDE68A" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#92400E" }}>🔁 {data.ulang.jumlah} WA gagal karena perangkat terputus (48 jam terakhir)</div>
          <div style={{ fontSize: 12.5, color: "#78350F", marginTop: 4, lineHeight: 1.6 }}>
            {(data.ulang.contoh || []).map((c, i) => <div key={i}>{waktu(c.waktu)} · {labelJenis(c.jenis)} · {c.nama_penerima || c.nomor}</div>)}
            {data.ulang.jumlah > (data.ulang.contoh || []).length && <div>dan {data.ulang.jumlah - (data.ulang.contoh || []).length} lainnya</div>}
          </div>
          <button onClick={kirimUlangSemua} disabled={sibuk === "ulang" || putus} style={{ marginTop: 8, padding: "9px 14px", borderRadius: 9, border: "none", background: putus ? "#CBD5E1" : "#D97706", color: "white", fontWeight: 800, fontSize: 13, cursor: putus ? "not-allowed" : "pointer" }}>
            {sibuk === "ulang" ? "Mengirim ulang…" : putus ? "Sambungkan perangkat dulu" : "🔁 Kirim ulang semua"}
          </button>
        </div>
      )}

      {data && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          {angka("Hari ini", data.ringkas?.hari)}
          {angka("7 hari", data.ringkas?.minggu)}
          {angka("30 hari", data.ringkas?.bulan)}
        </div>
      )}

      {data?.perJenis?.length > 0 && (
        <details style={{ ...kotak }}>
          <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 800, color: NAVY }}>Rincian per jenis pesan (30 hari)</summary>
          <div style={{ marginTop: 8 }}>
            {data.perJenis.map((j) => (
              <div key={j.jenis} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderTop: "1px solid #F1F5F9", fontSize: 13 }}>
                <span style={{ color: "#334155" }}>{labelJenis(j.jenis)}</span>
                <span style={{ whiteSpace: "nowrap", color: "#64748B" }}>{j.ok + j.gagal}{j.gagal ? <span style={{ color: "#DC2626" }}> · {j.gagal} gagal</span> : ""}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {chip("semua", "Semua")}{chip("gagal", "❌ Gagal")}{chip("tamu", "Tamu")}{chip("ruangan", "Ruangan")}
        {data?.lingkup === "semua" && chip("internal", "Internal")}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setCari(q.trim()); }} style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama penerima, jenis, atau kode…"
          style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E2E8F0", fontSize: 14, fontFamily: "inherit" }} />
        <button type="submit" style={{ padding: "0 14px", borderRadius: 9, border: "none", background: NAVY, color: "white", fontWeight: 700, cursor: "pointer" }}>Cari</button>
      </form>

      {!data && !galat && <div style={{ color: "#94A3B8", fontSize: 13, padding: 20, textAlign: "center" }}>Memuat…</div>}
      {data && arsip.length === 0 && <div style={{ ...kotak, color: "#94A3B8", fontSize: 13, textAlign: "center" }}>Belum ada WA pada saringan ini.</div>}

      {arsip.map((r) => {
        const [lbl, warna] = statusKiriman(r);
        const terbuka = buka === r.id;
        const tamuId = /^tamu:/.test(String(r.rujukan || ""));
        return (
          <div key={r.id} style={{ ...kotak, padding: 0, overflow: "hidden", borderColor: r.berhasil ? "#E2E8F0" : "#FECACA" }}>
            <button onClick={() => setBuka(terbuka ? null : r.id)} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: isMobile ? "10px 12px" : "11px 16px", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1E293B" }}>{r.nama_penerima || r.peran || "Penerima"}{r.nomor ? <span style={{ fontWeight: 500, color: "#94A3B8" }}> · {r.nomor}</span> : null}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: warna, whiteSpace: "nowrap" }}>{lbl}</span>
              </div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{waktu(r.waktu)} · {labelJenis(r.jenis)}{r.rujukan ? " · " + r.rujukan : ""}</div>
            </button>
            {terbuka && (
              <div style={{ borderTop: "1px solid #F1F5F9", padding: isMobile ? "10px 12px" : "12px 16px", background: "#F8FAFC" }}>
                {!r.berhasil && r.catatan && <div style={{ fontSize: 12.5, color: "#B91C1C", marginBottom: 8 }}>Alasan gagal: {r.catatan}</div>}
                {r.isi
                  ? <div style={{ whiteSpace: "pre-wrap", fontSize: 12.5, lineHeight: 1.55, color: "#1E293B", background: "white", border: "1px solid #E2E8F0", borderRadius: 8, padding: "9px 11px", maxHeight: 260, overflowY: "auto" }}>{r.isi}</div>
                  : <div style={{ fontSize: 12.5, color: "#94A3B8" }}>{r.jenis === "otp" ? "Isi pesan OTP tidak disimpan." : "Isi pesan tidak tersimpan (pesan lama atau sudah lewat " + (data?.masaArsipHari || 90) + " hari)."}</div>}
                <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 6 }}>
                  Status Fonnte: {r.status_kirim || "-"}{r.state ? " · state " + r.state : ""}{r.diperbarui_pada ? " · diperbarui " + waktu(r.diperbarui_pada) : ""}
                </div>
                {tamuId && (
                  <button onClick={() => kirimUlang(r)} disabled={sibuk === r.id} style={{ marginTop: 8, padding: "8px 12px", borderRadius: 9, border: "none", background: "#16A34A", color: "white", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                    {sibuk === r.id ? "Menyiapkan…" : "🔁 Kirim ulang pemberitahuan terbaru"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {data?.lanjut && (
        <button onClick={() => muat(hal + 1)} disabled={memuat} style={{ width: "100%", padding: 11, borderRadius: 10, border: "1.5px dashed #CBD5E1", background: "white", color: "#475569", fontWeight: 700, cursor: "pointer" }}>
          {memuat ? "Memuat…" : "Muat lagi"}
        </button>
      )}

      {data?.webhook && (
        <details style={{ ...kotak, marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 800, color: NAVY }}>⚙️ Sambungan status dari Fonnte (sekali atur)</summary>
          <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.6, marginTop: 8 }}>
            Supaya status <b>terkirim / sampai di HP / dibaca</b> dan <b>perangkat terputus</b> masuk otomatis, isikan dua alamat berikut di pengaturan perangkat pada dasbor fonnte.com, lalu aktifkan <b>Auto Read</b>. Alamat ini rahasia; jangan dibagikan.
            {[["Webhook status pesan (update message status)", data.webhook.status], ["Webhook status perangkat (device status / connect)", data.webhook.perangkat]].map(([j, url]) => (
              <div key={j} style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 700 }}>{j}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input readOnly value={url} onFocus={(e) => e.target.select()} style={{ flex: 1, padding: "7px 9px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, fontFamily: "monospace" }} />
                  <button onClick={() => { navigator.clipboard?.writeText(url); showT && showT("Alamat disalin"); }} style={{ padding: "0 10px", borderRadius: 8, border: "1px solid #CBD5E1", background: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Salin</button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 12, lineHeight: 1.6 }}>
        "Diterima Fonnte" berarti pesan sudah masuk antrean pengiriman; status sampai di HP dan dibaca muncul bila sambungan status dari Fonnte sudah diatur. Nomor, nama, dan isi pesan dihapus otomatis sesudah {data?.masaArsipHari || 90} hari.
      </div>
    </div>
  );
}
