/**
 * src/NewsroomDashboard.jsx — Prokopim v1.5
 * AI Newsroom — Dapur Redaksi Digital Komdokpim Kota Tarakan
 *
 * Props: { role, user }
 *
 * Routing view:
 *   role === "timkom"            → TimkomView   (input & generate draf AI)
 *   role === "kasubbag_komdokpim"→ KurasiView   (review, setujui, revisi)
 *   role === "kabag"             → MonitoringView (read-only pantauan)
 *
 * Tabel Supabase: rilis_berita
 * Kolom: id, created_at, judul, poin_lapangan, draf_ai, status,
 *        catatan_revisi, peliput_username, peliput_nama,
 *        dikurasi_oleh, published_at
 *
 * Status flow:
 *   draft_timkom → pending_kasubbag → published
 *                                   → draft_timkom (revisi)
 *
 * INTEGRASI di ProkopimApp.jsx:
 *   import NewsroomDashboard from "./NewsroomDashboard.jsx";
 *   // Di routing tab "newsroom":
 *   :tab === "newsroom"
 *     ? <NewsroomDashboard role={role} user={user}/>
 */

import React, {
  useState, useEffect, useCallback, useRef,
} from "react";

// ── Konstanta warna (sesuai tema app) ────────────────────────
var NAVY     = "#0A1628";
var NAVY_MID = "#163265";
var GOLD     = "#C9A84C";
var GREEN    = "#059669";

// ── Helper: Supabase REST client (pola identik ProkopimApp) ──
function getSupaConfig() {
  var url = (typeof import.meta !== "undefined" && import.meta.env)
    ? (import.meta.env.VITE_SUPABASE_URL || "") : "";
  var key = (typeof import.meta !== "undefined" && import.meta.env)
    ? (import.meta.env.VITE_SUPABASE_ANON_KEY || "") : "";
  return { url: url, key: key, ok: !!(url && key) };
}

function supaHeaders(key) {
  return {
    "Content-Type":  "application/json",
    "apikey":        key,
    "Authorization": "Bearer " + key,
  };
}

// ── Helper: format tanggal ────────────────────────────────────
function fmtTs(str) {
  if (!str) return "-";
  return new Date(str).toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDate(str) {
  if (!str) return "-";
  return new Date(str).toLocaleDateString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric", month: "long", year: "numeric",
  });
}

// ── Status config ─────────────────────────────────────────────
var STATUS_CFG = {
  draft_timkom:     { label: "Draft",           bg: "#F1F5F9", color: "#475569", dot: "#94A3B8" },
  pending_kasubbag: { label: "Menunggu Kurasi",  bg: "#FEF3C7", color: "#92400E", dot: "#F59E0B" },
  published:        { label: "Dipublikasi",      bg: "#D1FAE5", color: "#065F46", dot: "#10B981" },
  revisi:           { label: "Perlu Revisi",     bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
};

// ── CSS animasi global (inject sekali) ────────────────────────
var _nr_injected = false;
function injectNRStyle() {
  if (_nr_injected || typeof document === "undefined") return;
  _nr_injected = true;
  var s = document.createElement("style");
  s.textContent = [
    "@keyframes nr_spin{to{transform:rotate(360deg)}}",
    "@keyframes nr_fadeup{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}",
    "@keyframes nr_pulse{0%,100%{opacity:1}50%{opacity:0.4}}",
    ".nr-card{animation:nr_fadeup 0.3s ease both;}",
    ".nr-card:nth-child(2){animation-delay:0.05s}",
    ".nr-card:nth-child(3){animation-delay:0.1s}",
    ".nr-card:nth-child(4){animation-delay:0.15s}",
    ".nr-spinner{animation:nr_spin 0.7s linear infinite}",
  ].join("\n");
  document.head.appendChild(s);
}
injectNRStyle();

// ════════════════════════════════════════════════════════════
//  KOMPONEN UTAMA
// ════════════════════════════════════════════════════════════
export default function NewsroomDashboard({ role, user }) {
  if (role === "timkom") {
    return <TimkomView user={user}/>;
  }
  if (role === "kasubbag_komdokpim") {
    return <KurasiView user={user}/>;
  }
  if (role === "kabag") {
    return <MonitoringView user={user}/>;
  }
  // Fallback — role tidak punya akses newsroom
  return (
    <div style={{
      flex:1, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      background:"#F0F4FA", padding:40, textAlign:"center",
    }}>
      <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
      <div style={{ fontSize:17, fontWeight:800, color:NAVY, marginBottom:8 }}>
        Akses Terbatas
      </div>
      <div style={{ fontSize:13, color:"#64748B" }}>
        Fitur AI Newsroom hanya tersedia untuk Tim Komdokpim.
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  VIEW 1: TIMKOM — Input & Generate Draf AI
// ════════════════════════════════════════════════════════════
function TimkomView({ user }) {
  var supa = getSupaConfig();

  // ── State form ──────────────────────────────────────────
  var [judul,         setJudul]         = useState("");
  var [poinLapangan,  setPoinLapangan]  = useState("");
  var [submitting,    setSubmitting]    = useState(false);
  var [formErr,       setFormErr]       = useState("");
  var [formSuccess,   setFormSuccess]   = useState("");

  // ── State riwayat ───────────────────────────────────────
  var [riwayat,      setRiwayat]      = useState([]);
  var [loadRiwayat,  setLoadRiwayat]  = useState(true);
  var [expandedId,   setExpandedId]   = useState(null);

  // ── Fetch riwayat milik timkom ini ──────────────────────
  var fetchRiwayat = useCallback(function() {
    if (!supa.ok) { setLoadRiwayat(false); return; }
    setLoadRiwayat(true);
    var url = supa.url + "/rest/v1/rilis_berita"
      + "?peliput_username=eq." + encodeURIComponent(user.username)
      + "&order=created_at.desc"
      + "&limit=30";
    fetch(url, { headers: supaHeaders(supa.key) })
      .then(function(r) { return r.json(); })
      .then(function(d) { setRiwayat(Array.isArray(d) ? d : []); })
      .catch(function() { setRiwayat([]); })
      .finally(function() { setLoadRiwayat(false); });
  }, [user.username, supa.ok, supa.url, supa.key]);

  useEffect(function() { fetchRiwayat(); }, [fetchRiwayat]);

  // ── Submit: Generate draf via Gemini → simpan ke Supabase ──
  async function handleGenerate() {
    setFormErr(""); setFormSuccess("");

    // ── Validasi form ────────────────────────────────────────
    if (!judul.trim()) {
      setFormErr("Judul liputan wajib diisi."); return;
    }
    if (poinLapangan.trim().length < 20) {
      setFormErr("Poin lapangan terlalu singkat — minimal 20 karakter."); return;
    }
    if (!supa.ok) {
      setFormErr("Konfigurasi Supabase belum ada. Hubungi Admin."); return;
    }

    var geminiKey = (typeof import.meta !== "undefined" && import.meta.env)
      ? (import.meta.env.VITE_GEMINI_API_KEY || "") : "";

    setSubmitting(true);
    var drafAi = "";

    try {
      // ══════════════════════════════════════════════════════
      // STEP 1: Panggil Gemini API
      // ══════════════════════════════════════════════════════
      if (!geminiKey) {
        // Fallback jika env key belum diset — tetap simpan dengan catatan
        drafAi = "[Draf AI tidak tersedia — VITE_GEMINI_API_KEY belum dikonfigurasi. "
               + "Silakan isi secara manual atau hubungi Admin.]";
      } else {
        var systemPrompt = [
          "Anda adalah Staf Ahli Komunikasi dan Dokumentasi Pimpinan (Komdokpim)",
          "Sekretariat Daerah Kota Tarakan.",
          "Tugas Anda menyusun draf rilis berita resmi pemerintahan berdasarkan",
          "poin-poin liputan mentah yang diberikan oleh staf lapangan.",
          "",
          "Judul / Topik Liputan:",
          judul.trim(),
          "",
          "Poin-Poin Lapangan:",
          poinLapangan.trim(),
          "",
          "Syarat penulisan:",
          "- Gunakan gaya bahasa jurnalistik pemerintahan yang formal, elegan, positif, dan informatif.",
          "- Susun dalam format paragraf berita yang rapi (minimal 3 paragraf).",
          "- Paragraf pertama adalah teras berita (lead) yang menjawab 5W+1H secara ringkas.",
          "- Paragraf berikutnya mengembangkan detail poin lapangan secara kronologis.",
          "- Paragraf terakhir dapat berisi kutipan fiktif pejabat atau penutup yang menguatkan.",
          "- Hindari kata-kata berulang. Jangan sertakan judul dalam draf.",
          "- Tulis HANYA isi draf berita — tanpa penjelasan tambahan, tanpa preamble.",
        ].join("\n");

        var geminiRes = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
          + "?key=" + geminiKey,
          {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role:  "user",
                  parts: [{ text: systemPrompt }],
                },
              ],
              generationConfig: {
                temperature:     0.7,
                maxOutputTokens: 1024,
                topP:            0.9,
              },
              safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
              ],
            }),
          }
        );

        if (!geminiRes.ok) {
          var geminiErr = await geminiRes.json().catch(function() { return {}; });
          var errMsg = (geminiErr.error && geminiErr.error.message) || ("HTTP " + geminiRes.status);
          throw new Error("Gemini API gagal: " + errMsg);
        }

        var geminiData = await geminiRes.json();

        // Ekstrak teks dari respons Gemini
        drafAi = (
          geminiData.candidates &&
          geminiData.candidates[0] &&
          geminiData.candidates[0].content &&
          geminiData.candidates[0].content.parts &&
          geminiData.candidates[0].content.parts[0] &&
          geminiData.candidates[0].content.parts[0].text
        ) || "";

        if (!drafAi.trim()) {
          // Gemini kadang return finishReason: SAFETY — tangani dengan elegan
          var reason = (
            geminiData.candidates &&
            geminiData.candidates[0] &&
            geminiData.candidates[0].finishReason
          ) || "UNKNOWN";
          drafAi = "[Draf AI tidak dapat dibuat (alasan: " + reason + "). "
                 + "Silakan tulis draf secara manual atau coba lagi dengan poin lapangan yang berbeda.]";
        }
      }

      // ══════════════════════════════════════════════════════
      // STEP 2: INSERT ke Supabase tabel rilis_berita
      // ══════════════════════════════════════════════════════
      var payload = {
        judul:            judul.trim(),
        poin_lapangan:    poinLapangan.trim(),
        draf_ai:          drafAi.trim(),
        status:           "pending_kasubbag",
        peliput_username: user.username,
        peliput_nama:     user.nama || user.username,
      };

      var supaRes = await fetch(supa.url + "/rest/v1/rilis_berita", {
        method:  "POST",
        headers: Object.assign({}, supaHeaders(supa.key), {
          "Prefer": "return=representation",
        }),
        body: JSON.stringify(payload),
      });

      if (!supaRes.ok) {
        var supaErr = await supaRes.json().catch(function() { return {}; });
        throw new Error(supaErr.message || "Draf AI berhasil dibuat tapi gagal disimpan. Coba lagi.");
      }

      // ══════════════════════════════════════════════════════
      // STEP 3: Reset form & refresh riwayat
      // ══════════════════════════════════════════════════════
      setJudul(""); setPoinLapangan("");
      setFormSuccess(
        geminiKey
          ? "✨ Draf AI berhasil dibuat & dikirim ke Kasubbag untuk dikurasi."
          : "📝 Rilis disimpan (tanpa AI). Tambahkan VITE_GEMINI_API_KEY di Vercel untuk mengaktifkan AI."
      );
      fetchRiwayat();

    } catch(e) {
      setFormErr(e.message || "Terjadi kesalahan. Periksa koneksi internet dan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>

      {/* ── Header ── */}
      <div style={{
        background:"linear-gradient(135deg," + NAVY + " 0%,#1A3060 100%)",
        padding:"24px 24px 20px",
      }}>
        <div style={{
          display:"flex", alignItems:"center", gap:12, marginBottom:6,
        }}>
          <div style={{
            width:42, height:42, borderRadius:12,
            background:"rgba(201,168,76,0.18)",
            border:"1.5px solid rgba(201,168,76,0.4)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:20, flexShrink:0,
          }}>📡</div>
          <div>
            <div style={{ color:GOLD, fontSize:9, fontWeight:700, letterSpacing:2, textTransform:"uppercase" }}>
              AI Newsroom
            </div>
            <div style={{ color:"white", fontSize:19, fontWeight:900 }}>
              Input Liputan
            </div>
          </div>
        </div>
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11 }}>
          Masukkan poin lapangan — AI akan membantu menyusun draf berita
        </div>
      </div>

      <div style={{ padding:"18px 18px 0" }}>

        {/* ── Form ── */}
        <div style={{
          background:"white", borderRadius:16, padding:"20px",
          boxShadow:"0 2px 16px rgba(10,22,40,0.08)",
          border:"1.5px solid #E8EDF4", marginBottom:20,
        }}>
          <div style={{
            fontSize:13, fontWeight:800, color:NAVY,
            marginBottom:16, display:"flex", alignItems:"center", gap:7,
          }}>
            <span>✏️</span> Input Berita Baru
          </div>

          {/* Judul */}
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>
              Judul Liputan <span style={{ color:"#EF4444" }}>*</span>
            </label>
            <input
              type="text"
              value={judul}
              onChange={function(e) { setJudul(e.target.value); }}
              placeholder="Contoh: Wali Kota Resmikan Taman Kota Baru di Kelurahan Pamusian"
              style={inputStyle}
            />
          </div>

          {/* Poin lapangan */}
          <div style={{ marginBottom:16 }}>
            <label style={labelStyle}>
              Poin-Poin Lapangan <span style={{ color:"#EF4444" }}>*</span>
            </label>
            <div style={{ fontSize:11, color:"#94A3B8", marginBottom:6 }}>
              Tulis poin-poin penting dari lapangan — satu poin per baris. Semakin detail, semakin baik draf AI-nya.
            </div>
            <textarea
              value={poinLapangan}
              onChange={function(e) { setPoinLapangan(e.target.value); }}
              rows={7}
              placeholder={"- Wali Kota membuka acara pukul 09.00 WITA\n- Dihadiri 300 warga dan seluruh kepala OPD\n- Taman seluas 2 hektare dilengkapi jogging track dan area bermain anak\n- Anggaran Rp 4,2 miliar dari APBD 2025\n- Masyarakat antusias, banyak yang langsung berfoto"}
              style={Object.assign({}, inputStyle, { resize:"vertical", lineHeight:1.65 })}
            />
            <div style={{ fontSize:10, color:"#94A3B8", marginTop:4, textAlign:"right" }}>
              {poinLapangan.length} karakter
            </div>
          </div>

          {/* Pesan error / sukses */}
          {formErr && (
            <div style={{
              background:"#FEF2F2", border:"1px solid #FECACA",
              borderRadius:9, padding:"10px 13px", marginBottom:12,
              fontSize:12, color:"#991B1B", fontWeight:600,
            }}>
              ⚠️ {formErr}
            </div>
          )}
          {formSuccess && (
            <div style={{
              background:"#D1FAE5", border:"1px solid #6EE7B7",
              borderRadius:9, padding:"10px 13px", marginBottom:12,
              fontSize:12, color:"#065F46", fontWeight:600,
            }}>
              ✅ {formSuccess}
            </div>
          )}

          {/* Tombol generate */}
          <button
            onClick={handleGenerate}
            disabled={submitting}
            style={{
              width:"100%", padding:"14px",
              borderRadius:12, border:"none",
              background: submitting
                ? "#94A3B8"
                : "linear-gradient(135deg,#7C3AED,#5B21B6)",
              color:"white", fontSize:14, fontWeight:800,
              cursor: submitting ? "not-allowed" : "pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:10,
              boxShadow: submitting ? "none" : "0 4px 18px rgba(124,58,237,0.35)",
              letterSpacing:"0.3px",
            }}
          >
            {submitting
              ? <><span className="nr-spinner" style={{
                  width:16, height:16, borderRadius:"50%",
                  border:"2.5px solid rgba(255,255,255,0.3)",
                  borderTopColor:"white", display:"inline-block",
                }}/> Memproses AI...</>
              : <><span style={{ fontSize:17 }}>✨</span> Generate Draf AI</>
            }
          </button>

          <div style={{
            marginTop:10, fontSize:11, color:"#94A3B8",
            textAlign:"center", lineHeight:1.5,
          }}>
            Draf akan dikirim otomatis ke Kasubbag untuk dikurasi sebelum dipublikasi
          </div>
        </div>

        {/* ── Riwayat ── */}
        <div style={{ marginBottom:8 }}>
          <div style={{
            fontSize:12, fontWeight:800, color:NAVY,
            textTransform:"uppercase", letterSpacing:1,
            marginBottom:12, display:"flex", alignItems:"center", gap:6,
          }}>
            <span>📋</span> Riwayat Liputan Anda
          </div>

          {loadRiwayat
            ? <SkeletonList count={3}/>
            : riwayat.length === 0
              ? <EmptyState
                  icon="📰"
                  title="Belum Ada Liputan"
                  sub="Liputan yang Anda kirim akan muncul di sini."
                />
              : riwayat.map(function(item) {
                  var exp = expandedId === item.id;
                  return (
                    <div key={item.id} className="nr-card" style={{
                      background:"white", borderRadius:14, marginBottom:10,
                      border:"1.5px solid " + (item.status === "published" ? "#6EE7B7"
                        : item.status === "pending_kasubbag" ? "#FDE68A"
                        : item.catatan_revisi ? "#FECACA" : "#E8EDF4"),
                      overflow:"hidden",
                      boxShadow:"0 1px 8px rgba(10,22,40,0.06)",
                    }}>
                      {/* Kartu header */}
                      <div
                        onClick={function() { setExpandedId(exp ? null : item.id); }}
                        style={{ padding:"13px 16px", cursor:"pointer" }}
                      >
                        <div style={{
                          display:"flex", justifyContent:"space-between",
                          alignItems:"flex-start", gap:8, marginBottom:5,
                        }}>
                          <div style={{
                            fontSize:13, fontWeight:700, color:NAVY,
                            flex:1, minWidth:0, lineHeight:1.35,
                          }}>
                            {item.judul}
                          </div>
                          <StatusBadge status={item.status} hasCatatan={!!item.catatan_revisi}/>
                        </div>
                        <div style={{ fontSize:11, color:"#94A3B8" }}>
                          🕐 {fmtTs(item.created_at)}
                          {item.status === "published" && item.published_at && (
                            <span style={{ marginLeft:8, color:GREEN, fontWeight:600 }}>
                              · Tayang {fmtDate(item.published_at)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {exp && (
                        <div style={{
                          borderTop:"1px solid #F1F5F9",
                          padding:"12px 16px", background:"#FAFBFF",
                        }}>
                          {item.catatan_revisi && (
                            <div style={{
                              background:"#FEF2F2", border:"1px solid #FECACA",
                              borderRadius:9, padding:"10px 12px", marginBottom:12,
                            }}>
                              <div style={{ fontSize:10, fontWeight:700, color:"#991B1B", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>
                                Catatan Revisi dari Kasubbag
                              </div>
                              <p style={{ fontSize:12, color:"#7F1D1D", margin:0, lineHeight:1.6 }}>
                                {item.catatan_revisi}
                              </p>
                            </div>
                          )}
                          <DetailBlock label="Poin Lapangan" value={item.poin_lapangan}/>
                          {item.draf_ai && (
                            <DetailBlock label="Draf AI" value={item.draf_ai} accent/>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
          }
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  VIEW 2: KURASI — Kasubbag Komdokpim
// ════════════════════════════════════════════════════════════
function KurasiView({ user }) {
  var supa = getSupaConfig();

  var [items,      setItems]      = useState([]);
  var [loading,    setLoading]    = useState(true);
  var [actionId,   setActionId]   = useState(null);   // id yang sedang diproses
  var [revisiId,   setRevisiId]   = useState(null);   // id yang buka form revisi
  var [catatanRev, setCatatanRev] = useState("");
  var [actionLoad, setActionLoad] = useState(false);
  var [toast,      setToast]      = useState("");

  function showToast(msg) {
    setToast(msg);
    setTimeout(function() { setToast(""); }, 3000);
  }

  var fetchItems = useCallback(function() {
    if (!supa.ok) { setLoading(false); return; }
    setLoading(true);
    var url = supa.url + "/rest/v1/rilis_berita"
      + "?status=eq.pending_kasubbag"
      + "&order=created_at.asc"
      + "&limit=50";
    fetch(url, { headers: supaHeaders(supa.key) })
      .then(function(r) { return r.json(); })
      .then(function(d) { setItems(Array.isArray(d) ? d : []); })
      .catch(function() { setItems([]); })
      .finally(function() { setLoading(false); });
  }, [supa.ok, supa.url, supa.key]);

  useEffect(function() { fetchItems(); }, [fetchItems]);

  // ── Setujui & Publish ─────────────────────────────────
  async function handlePublish(item) {
    if (!supa.ok) return;
    setActionLoad(true); setActionId(item.id);
    try {
      var res = await fetch(
        supa.url + "/rest/v1/rilis_berita?id=eq." + encodeURIComponent(item.id),
        {
          method:  "PATCH",
          headers: Object.assign({}, supaHeaders(supa.key), { "Prefer": "return=minimal" }),
          body: JSON.stringify({
            status:         "published",
            dikurasi_oleh:  user.username,
            published_at:   new Date().toISOString(),
          }),
        }
      );
      if (!res.ok) throw new Error("Gagal mempublikasi.");
      showToast("✅ Berita berhasil dipublikasi!");
      fetchItems();
    } catch(e) {
      showToast("⚠️ " + (e.message || "Gagal"));
    } finally {
      setActionLoad(false); setActionId(null);
    }
  }

  // ── Minta Revisi ──────────────────────────────────────
  async function handleRevisi(item) {
    if (!catatanRev.trim()) {
      showToast("⚠️ Isi catatan revisi terlebih dahulu.");
      return;
    }
    if (!supa.ok) return;
    setActionLoad(true); setActionId(item.id);
    try {
      var res = await fetch(
        supa.url + "/rest/v1/rilis_berita?id=eq." + encodeURIComponent(item.id),
        {
          method:  "PATCH",
          headers: Object.assign({}, supaHeaders(supa.key), { "Prefer": "return=minimal" }),
          body: JSON.stringify({
            status:          "draft_timkom",
            catatan_revisi:  catatanRev.trim(),
            dikurasi_oleh:   user.username,
          }),
        }
      );
      if (!res.ok) throw new Error("Gagal mengirim revisi.");
      showToast("↩ Berita dikembalikan ke Timkom untuk direvisi.");
      setRevisiId(null); setCatatanRev("");
      fetchItems();
    } catch(e) {
      showToast("⚠️ " + (e.message || "Gagal"));
    } finally {
      setActionLoad(false); setActionId(null);
    }
  }

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>

      {/* Toast notif */}
      {toast && (
        <div style={{
          position:"fixed", top:20, left:"50%", transform:"translateX(-50%)",
          zIndex:9999, padding:"12px 20px", borderRadius:14,
          background: toast.startsWith("✅") ? "#065F46"
            : toast.startsWith("↩") ? NAVY : "#991B1B",
          color:"white", fontSize:13, fontWeight:700,
          boxShadow:"0 8px 24px rgba(0,0,0,0.25)",
          whiteSpace:"nowrap",
        }}>
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        background:"linear-gradient(135deg," + NAVY + " 0%,#1A3060 100%)",
        padding:"24px 24px 20px",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
          <div style={{
            width:42, height:42, borderRadius:12,
            background:"rgba(201,168,76,0.18)",
            border:"1.5px solid rgba(201,168,76,0.4)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:20, flexShrink:0,
          }}>✍️</div>
          <div>
            <div style={{ color:GOLD, fontSize:9, fontWeight:700, letterSpacing:2, textTransform:"uppercase" }}>
              AI Newsroom
            </div>
            <div style={{ color:"white", fontSize:19, fontWeight:900 }}>
              Meja Kurasi
            </div>
          </div>
        </div>
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11 }}>
          {items.length > 0
            ? items.length + " berita menunggu keputusan Anda"
            : "Semua berita sudah dikurasi"}
        </div>
      </div>

      <div style={{ padding:"18px 18px 0" }}>

        {/* Banner instruksi */}
        <div style={{
          background:"#EFF6FF", border:"1px solid #BFDBFE",
          borderRadius:11, padding:"11px 14px", marginBottom:16,
          fontSize:12, color:"#1D4ED8", lineHeight:1.6,
        }}>
          📋 Review setiap draf — cek akurasi, kelengkapan, dan kesesuaian naskah dengan standar
          komunikasi pimpinan sebelum dipublikasi.
        </div>

        {loading
          ? <SkeletonList count={3}/>
          : items.length === 0
            ? <EmptyState
                icon="🎉"
                title="Tidak Ada Antrian"
                sub="Semua berita sudah dikurasi. Kerja bagus!"
              />
            : items.map(function(item) {
                var isRevisi   = revisiId === item.id;
                var isActing   = actionId === item.id && actionLoad;

                return (
                  <div key={item.id} className="nr-card" style={{
                    background:"white", borderRadius:16, marginBottom:16,
                    border:"1.5px solid #FDE68A",
                    boxShadow:"0 4px 18px rgba(10,22,40,0.09)",
                    overflow:"hidden",
                  }}>

                    {/* Strip atas */}
                    <div style={{
                      background:"linear-gradient(90deg,#FEF9EC,#FFFBEB)",
                      padding:"10px 16px",
                      borderBottom:"1px solid #FDE68A",
                      display:"flex", justifyContent:"space-between", alignItems:"center",
                    }}>
                      <div style={{ fontSize:10, fontWeight:700, color:"#B45309", textTransform:"uppercase", letterSpacing:1 }}>
                        Menunggu Kurasi
                      </div>
                      <div style={{ fontSize:11, color:"#94A3B8" }}>
                        📡 {item.peliput_nama || item.peliput_username} · {fmtTs(item.created_at)}
                      </div>
                    </div>

                    <div style={{ padding:"16px" }}>
                      {/* Judul */}
                      <div style={{
                        fontSize:16, fontWeight:900, color:NAVY,
                        lineHeight:1.35, marginBottom:14,
                      }}>
                        {item.judul}
                      </div>

                      {/* Poin lapangan */}
                      <div style={{ marginBottom:14 }}>
                        <div style={sectionLabelStyle}>📍 Poin Lapangan</div>
                        <div style={{
                          background:"#F8FAFC", borderRadius:10,
                          padding:"11px 13px", fontSize:12.5,
                          color:"#334155", lineHeight:1.75,
                          whiteSpace:"pre-wrap",
                          border:"1px solid #E8EDF4",
                        }}>
                          {item.poin_lapangan}
                        </div>
                      </div>

                      {/* Draf AI */}
                      {item.draf_ai && (
                        <div style={{ marginBottom:16 }}>
                          <div style={sectionLabelStyle}>
                            ✨ Draf AI
                          </div>
                          <div style={{
                            background:"linear-gradient(135deg,#F5F3FF,#EDE9FE)",
                            border:"1.5px solid #C4B5FD",
                            borderRadius:10, padding:"12px 14px",
                            fontSize:12.5, color:"#4C1D95",
                            lineHeight:1.75, whiteSpace:"pre-wrap",
                          }}>
                            {item.draf_ai}
                          </div>
                        </div>
                      )}

                      {/* Form revisi */}
                      {isRevisi && (
                        <div style={{
                          background:"#FEF2F2", border:"1.5px solid #FECACA",
                          borderRadius:12, padding:"14px", marginBottom:14,
                        }}>
                          <div style={{ fontSize:12, fontWeight:700, color:"#991B1B", marginBottom:8 }}>
                            ✍️ Catatan Revisi untuk Timkom
                          </div>
                          <textarea
                            value={catatanRev}
                            onChange={function(e) { setCatatanRev(e.target.value); }}
                            rows={3}
                            placeholder="Jelaskan apa yang perlu diperbaiki atau dilengkapi..."
                            style={Object.assign({}, inputStyle, {
                              border:"1.5px solid #FECACA",
                              background:"white", resize:"vertical",
                            })}
                          />
                          <div style={{ display:"flex", gap:8, marginTop:10 }}>
                            <button
                              onClick={function() { handleRevisi(item); }}
                              disabled={isActing}
                              style={{
                                flex:2, padding:"10px", borderRadius:10, border:"none",
                                background: isActing ? "#94A3B8" : "#DC2626",
                                color:"white", fontSize:12, fontWeight:700,
                                cursor: isActing ? "not-allowed" : "pointer",
                              }}
                            >
                              {isActing ? "Mengirim..." : "↩ Kirim Revisi"}
                            </button>
                            <button
                              onClick={function() { setRevisiId(null); setCatatanRev(""); }}
                              style={{
                                flex:1, padding:"10px", borderRadius:10,
                                border:"1.5px solid #E2E8F0", background:"white",
                                color:"#64748B", fontSize:12, fontWeight:600,
                                cursor:"pointer",
                              }}
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tombol aksi */}
                      {!isRevisi && (
                        <div style={{ display:"flex", gap:10 }}>
                          <button
                            onClick={function() { handlePublish(item); }}
                            disabled={isActing}
                            style={{
                              flex:3, padding:"13px", borderRadius:12, border:"none",
                              background: isActing
                                ? "#94A3B8"
                                : "linear-gradient(135deg,#059669,#047857)",
                              color:"white", fontSize:13, fontWeight:800,
                              cursor: isActing ? "not-allowed" : "pointer",
                              display:"flex", alignItems:"center",
                              justifyContent:"center", gap:8,
                              boxShadow: isActing ? "none" : "0 4px 14px rgba(5,150,105,0.3)",
                            }}
                          >
                            {isActing && actionId === item.id
                              ? <NRSpinner/>
                              : <span>✅</span>
                            }
                            Setujui & Publish
                          </button>
                          <button
                            onClick={function() {
                              setRevisiId(item.id);
                              setCatatanRev("");
                            }}
                            disabled={isActing}
                            style={{
                              flex:2, padding:"13px", borderRadius:12,
                              border:"1.5px solid #DC2626", background:"white",
                              color:"#DC2626", fontSize:13, fontWeight:700,
                              cursor: isActing ? "not-allowed" : "pointer",
                            }}
                          >
                            ✍️ Minta Revisi
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
        }
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  VIEW 3: MONITORING — Kabag (Read-Only)
// ════════════════════════════════════════════════════════════
function MonitoringView({ user }) {
  var supa = getSupaConfig();

  var [items,       setItems]      = useState([]);
  var [loading,     setLoading]    = useState(true);
  var [filterSt,    setFilterSt]   = useState("published");
  var [expandedId,  setExpandedId] = useState(null);

  useEffect(function() {
    if (!supa.ok) { setLoading(false); return; }
    setLoading(true);
    var url = supa.url + "/rest/v1/rilis_berita"
      + (filterSt === "all" ? "" : "?status=eq." + filterSt)
      + (filterSt === "all" ? "?" : "&")
      + "order=created_at.desc&limit=60";
    fetch(url, { headers: supaHeaders(supa.key) })
      .then(function(r) { return r.json(); })
      .then(function(d) { setItems(Array.isArray(d) ? d : []); })
      .catch(function() { setItems([]); })
      .finally(function() { setLoading(false); });
  }, [filterSt, supa.ok, supa.url, supa.key]);

  // ── Statistik ringkas ─────────────────────────────────
  var statFilters = [
    { k:"published",        l:"Dipublikasi",   color:GREEN },
    { k:"pending_kasubbag", l:"Menunggu Kurasi", color:"#D97706" },
    { k:"draft_timkom",     l:"Draft / Revisi", color:"#64748B" },
    { k:"all",              l:"Semua",           color:NAVY },
  ];

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F0F4FA", paddingBottom:40 }}>

      {/* ── Header ── */}
      <div style={{
        background:"linear-gradient(135deg," + NAVY + " 0%,#1A3060 100%)",
        padding:"24px 24px 20px",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
          <div style={{
            width:42, height:42, borderRadius:12,
            background:"rgba(201,168,76,0.18)",
            border:"1.5px solid rgba(201,168,76,0.4)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:20, flexShrink:0,
          }}>📊</div>
          <div>
            <div style={{ color:GOLD, fontSize:9, fontWeight:700, letterSpacing:2, textTransform:"uppercase" }}>
              AI Newsroom
            </div>
            <div style={{ color:"white", fontSize:19, fontWeight:900 }}>
              Monitoring Publikasi Komdokpim
            </div>
          </div>
        </div>
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11 }}>
          Pantauan publikasi — mode read-only untuk Kepala Bagian
        </div>
      </div>

      <div style={{ padding:"18px 18px 0" }}>

        {/* Badge read-only */}
        <div style={{
          display:"inline-flex", alignItems:"center", gap:7,
          background:"#F1F5F9", border:"1px solid #CBD5E1",
          borderRadius:20, padding:"5px 14px",
          fontSize:11, fontWeight:700, color:"#64748B",
          marginBottom:14,
        }}>
          <span style={{ fontSize:13 }}>🔒</span>
          Tampilan Pantauan — Tidak Ada Aksi
        </div>

        {/* Filter tab */}
        <div style={{
          display:"flex", gap:6, flexWrap:"wrap", marginBottom:16,
        }}>
          {statFilters.map(function(f) {
            var active = filterSt === f.k;
            return (
              <button
                key={f.k}
                onClick={function() { setFilterSt(f.k); setExpandedId(null); }}
                style={{
                  padding:"6px 14px", borderRadius:20, fontSize:11, fontWeight:700,
                  border:"1.5px solid " + (active ? f.color : "#D1D9E6"),
                  background: active ? f.color : "white",
                  color: active ? "white" : "#64748B",
                  cursor:"pointer",
                }}
              >
                {f.l}
              </button>
            );
          })}
        </div>

        {loading
          ? <SkeletonList count={4}/>
          : items.length === 0
            ? <EmptyState
                icon="📭"
                title="Tidak Ada Data"
                sub="Belum ada berita pada kategori ini."
              />
            : items.map(function(item) {
                var exp = expandedId === item.id;
                return (
                  <div key={item.id} className="nr-card" style={{
                    background:"white", borderRadius:14, marginBottom:10,
                    border:"1.5px solid " + (
                      item.status === "published" ? "#A7F3D0"
                      : item.status === "pending_kasubbag" ? "#FDE68A"
                      : "#E2E8F0"
                    ),
                    boxShadow:"0 1px 8px rgba(10,22,40,0.06)",
                    overflow:"hidden",
                  }}>
                    <div
                      onClick={function() { setExpandedId(exp ? null : item.id); }}
                      style={{ padding:"13px 16px", cursor:"pointer" }}
                    >
                      <div style={{
                        display:"flex", justifyContent:"space-between",
                        alignItems:"flex-start", gap:8, marginBottom:6,
                      }}>
                        <div style={{
                          fontSize:13, fontWeight:700, color:NAVY,
                          flex:1, minWidth:0, lineHeight:1.35,
                        }}>
                          {item.judul}
                        </div>
                        <StatusBadge status={item.status}/>
                      </div>
                      <div style={{
                        display:"flex", gap:12, fontSize:11,
                        color:"#94A3B8", flexWrap:"wrap",
                      }}>
                        <span>📡 {item.peliput_nama || item.peliput_username}</span>
                        <span>🕐 {fmtTs(item.created_at)}</span>
                        {item.dikurasi_oleh && (
                          <span>✍️ Kurator: {item.dikurasi_oleh}</span>
                        )}
                        {item.status === "published" && item.published_at && (
                          <span style={{ color:GREEN, fontWeight:600 }}>
                            🟢 Tayang {fmtDate(item.published_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expanded — hanya baca */}
                    {exp && (
                      <div style={{
                        borderTop:"1px solid #F1F5F9",
                        padding:"13px 16px", background:"#FAFBFF",
                      }}>
                        <DetailBlock label="Poin Lapangan" value={item.poin_lapangan}/>
                        {item.draf_ai && (
                          <DetailBlock label="Draf AI" value={item.draf_ai} accent/>
                        )}
                        {item.catatan_revisi && (
                          <DetailBlock
                            label="Catatan Revisi"
                            value={item.catatan_revisi}
                            warn
                          />
                        )}
                        {/* Label read-only eksplisit */}
                        <div style={{
                          marginTop:12, padding:"7px 11px",
                          background:"#F1F5F9", borderRadius:8,
                          fontSize:11, color:"#94A3B8",
                          display:"flex", alignItems:"center", gap:6,
                        }}>
                          <span>🔒</span>
                          Kabag memiliki akses pantauan saja — kurasi dilakukan oleh Kasubbag Komdokpim
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
        }
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  SHARED COMPONENTS
// ════════════════════════════════════════════════════════════

function StatusBadge({ status, hasCatatan }) {
  var key = hasCatatan && status === "draft_timkom" ? "revisi" : (status || "draft_timkom");
  var cfg = STATUS_CFG[key] || STATUS_CFG.draft_timkom;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:5,
      background:cfg.bg, color:cfg.color,
      borderRadius:20, padding:"3px 10px",
      fontSize:10, fontWeight:700, flexShrink:0,
    }}>
      <span style={{
        width:6, height:6, borderRadius:"50%",
        background:cfg.dot, flexShrink:0,
      }}/>
      {cfg.label}
    </span>
  );
}

function DetailBlock({ label, value, accent, warn }) {
  var bg    = warn ? "#FEF2F2" : accent ? "#F5F3FF" : "#F8FAFC";
  var brd   = warn ? "#FECACA" : accent ? "#C4B5FD" : "#E8EDF4";
  var clr   = warn ? "#7F1D1D" : accent ? "#4C1D95" : "#334155";
  var lclr  = warn ? "#991B1B" : accent ? "#5B21B6" : "#94A3B8";
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{
        fontSize:10, fontWeight:700, color:lclr,
        textTransform:"uppercase", letterSpacing:1, marginBottom:5,
      }}>
        {label}
      </div>
      <div style={{
        background:bg, border:"1px solid " + brd,
        borderRadius:10, padding:"10px 13px",
        fontSize:12.5, color:clr, lineHeight:1.75,
        whiteSpace:"pre-wrap",
      }}>
        {value}
      </div>
    </div>
  );
}

function SkeletonList({ count }) {
  return (
    <div>
      {Array.from({ length: count || 3 }).map(function(_, i) {
        return (
          <div key={i} style={{
            background:"white", borderRadius:14, marginBottom:10,
            padding:16, border:"1px solid #E8EDF4",
            opacity: 1 - i * 0.2,
          }}>
            <div style={{
              height:14, borderRadius:6, background:"#F1F5F9",
              width: (60 + i * 10) + "%", marginBottom:9,
            }}/>
            <div style={{
              height:10, borderRadius:5, background:"#F8FAFC",
              width:"40%",
            }}/>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{
      textAlign:"center", padding:"48px 24px",
      background:"white", borderRadius:16,
      border:"1.5px solid #E8EDF4",
    }}>
      <div style={{ fontSize:44, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:15, fontWeight:800, color:NAVY, marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:12, color:"#64748B", lineHeight:1.6 }}>{sub}</div>
    </div>
  );
}

function NRSpinner() {
  return (
    <span className="nr-spinner" style={{
      width:15, height:15, borderRadius:"50%",
      border:"2.5px solid rgba(255,255,255,0.3)",
      borderTopColor:"white",
      display:"inline-block", flexShrink:0,
    }}/>
  );
}

// ── Style helpers ─────────────────────────────────────────────
var labelStyle = {
  display:"block", fontSize:12, fontWeight:700,
  color:"#475569", marginBottom:6,
  letterSpacing:"0.3px",
};

var inputStyle = {
  width:"100%", padding:"11px 13px",
  borderRadius:11, border:"1.5px solid #D1D9E6",
  fontSize:14, color:NAVY, background:"white",
  outline:"none", fontFamily:"inherit",
  WebkitAppearance:"none",
  boxSizing:"border-box",
};

var sectionLabelStyle = {
  fontSize:10, fontWeight:700, color:"#94A3B8",
  textTransform:"uppercase", letterSpacing:1,
  marginBottom:6,
};
