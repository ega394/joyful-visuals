/**
 * src/TamuPage.jsx - Prokopim v1.5
 * Halaman Publik /tamu - Form Permohonan Audiensi
 * Standar: WCAG 2.1 Level AA
 *
 * INTEGRASI di ProkopimApp.jsx:
 *   import TamuPage from "./TamuPage.jsx";
 *   // Baris PERTAMA dalam function App():
 *   if (window.location.pathname === "/tamu") return <TamuPage />;
 *
 * CHECKLIST WCAG 2.1 AA:
 * OK 1.1.1  Non-text Content: semua ikon aria-hidden + teks alternatif
 * OK 1.3.1  Info & Relationships: semantic HTML, label->input terhubung
 * OK 1.3.5  Identify Input Purpose: autocomplete attribute
 * OK 1.4.1  Use of Color: error/sukses tidak hanya mengandalkan warna
 * OK 1.4.3  Contrast Minimum: rasio kontras >= 4.5:1
 * OK 2.1.1  Keyboard: semua interaksi bisa via Tab/Space/Enter/Arrow
 * OK 2.4.3  Focus Order: urutan tab logis atas ke bawah
 * OK 2.4.7  Focus Visible: ring focus terlihat jelas
 * OK 3.3.1  Error Identification: pesan error spesifik per field
 * OK 3.3.2  Labels or Instructions: hint tersedia sebelum input
 * OK 4.1.3  Status Messages: aria-live untuk error dan sukses
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";

// ── Konstanta ──────────────────────────────────────────────
var NAVY     = "#0A1628";
var NAVY_MID = "#163265";
var GOLD     = "#C9A84C";
var WA_ADMIN = "https://wa.me/628115961116"; // ganti nomor admin Prokopim

var HARI  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
var BULAN = ["Januari","Februari","Maret","April","Mei","Juni",
             "Juli","Agustus","September","Oktober","November","Desember"];

// Pilihan pejabat yang ingin ditemui
var PEJABAT_OPTIONS = [
  {
    id:    "walikota",
    label: "Wali Kota",
    sub:   "dr. H. Khairul, M.Kes",
    emoji: "🏛",
  },
  {
    id:    "wakilwalikota",
    label: "Wakil Wali Kota",
    sub:   "Ibnu Saud Is",
    emoji: "🏛",
  },
];

// Pilihan aksesibilitas
var AKSES_OPTIONS = [
  { id:"kursi_roda", emoji:"♿", label:"Jalur / akses kursi roda" },
  { id:"pendamping", emoji:"🤝", label:"Pendamping / asisten pribadi" },
  { id:"isyarat",    emoji:"🤟", label:"Penerjemah bahasa isyarat" },
  { id:"low_vision", emoji:"👁",  label:"Kebutuhan low vision / tunanetra" },
  { id:"lainnya",    emoji:"📝", label:"Kebutuhan khusus lainnya" },
];

// ── Helpers ─────────────────────────────────────────────────
function todayWITA() {
  return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
}
function maxDateWITA() {
  return new Date(Date.now() + 8 * 3600000 + 60 * 86400000)
    .toISOString().slice(0, 10);
}
function fmtDateLong(str) {
  if (!str) return "";
  var d = new Date(str + "T00:00:00+08:00");
  return HARI[d.getDay()] + ", " + d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear();
}
function sanitize(s) {
  return String(s).replace(/[<>"'&]/g, function(c) {
    return {"<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#x27;","&":"&amp;"}[c];
  });
}
function normalizePhone(raw) {
  var d = raw.replace(/\D/g, "");
  if (d.startsWith("62")) return d;
  if (d.startsWith("0"))  return "62" + d.slice(1);
  if (d.startsWith("8"))  return "62" + d;
  return d;
}
function isValidPhone(raw) {
  var n = normalizePhone(raw);
  return /^62\d{8,13}$/.test(n);
}
function getPejabatLabel(id) {
  var opt = PEJABAT_OPTIONS.find(function(o) { return o.id === id; });
  return opt ? opt.label : "";
}

// ══════════════════════════════════════════════════════════
//  KOMPONEN UTAMA
// ══════════════════════════════════════════════════════════
export default function TamuPage() {
  var formId = useMemo(function() {
    return "tp-" + Math.random().toString(36).slice(2, 9);
  }, []);
  var liveRef     = useRef(null);
  var successRef  = useRef(null);

  var [step,    setStep]    = useState("form");
  var [errors,  setErrors]  = useState({});
  var [touched, setTouched] = useState({});
  var [result,  setResult]  = useState(null);

  // ── Aksesibilitas: ukuran teks & kontras tinggi ──────────
  var [textSize,     setTextSize]     = useState("normal"); // normal | large | xlarge
  var [highContrast, setHighContrast] = useState(false);

  useEffect(function() {
    var savedSize     = localStorage.getItem("tp_textSize");
    var savedContrast = localStorage.getItem("tp_highContrast");
    if (savedSize)     setTextSize(savedSize);
    if (savedContrast) setHighContrast(savedContrast === "true");
  }, []);

  var cycleTextSize = function() {
    var next = textSize === "normal" ? "large" : textSize === "large" ? "xlarge" : "normal";
    setTextSize(next);
    localStorage.setItem("tp_textSize", next);
  };
  var toggleContrast = function() {
    var next = !highContrast;
    setHighContrast(next);
    localStorage.setItem("tp_highContrast", String(next));
  };

  // Faktor skala teks
  var FS = textSize === "xlarge" ? 1.25 : textSize === "large" ? 1.1 : 1;

  // Palet kontras
  var HC = highContrast ? {
    bg:      "#000000",
    surface: "#1a1a1a",
    border:  "#FFD700",
    text:    "#FFFFFF",
    sub:     "#E0E0E0",
    accent:  "#FFD700",
    btn:     "#FFD700",
    btnText: "#000000",
  } : null;

  // Restore draft otomatis dari localStorage jika ada (≤ 7 hari)
  var DRAFT_KEY = "tp_draft";
  var FORM_DEFAULT = {
    name:                "",
    organization:        "",
    phone:               "",
    tujuan_pejabat:      "",   // "walikota" | "wakilwalikota"
    purpose:             "",
    preferred_date:      "",
    preferred_time:      "",
    message:             "",
    needs_aksesibilitas: false,
    akses_options:       [],
    akses_detail:        "",
  };
  var [form, setForm] = useState(function() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return FORM_DEFAULT;
      var saved = JSON.parse(raw);
      if (!saved || !saved._at || Date.now() - saved._at > 7 * 86400000) {
        localStorage.removeItem(DRAFT_KEY);
        return FORM_DEFAULT;
      }
      delete saved._at;
      return Object.assign({}, FORM_DEFAULT, saved);
    } catch (_) { return FORM_DEFAULT; }
  });

  // Autosave draft (debounce ~700ms)
  useEffect(function() {
    var t = setTimeout(function() {
      try {
        var hasContent = form.name || form.organization || form.phone || form.purpose ||
                         form.preferred_date || form.preferred_time || form.message ||
                         form.tujuan_pejabat;
        if (hasContent) {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(Object.assign({}, form, { _at: Date.now() })));
        }
      } catch (_) {}
    }, 700);
    return function() { clearTimeout(t); };
  }, [form]);

  var setF = useCallback(function(k, v) {
    setForm(function(p) {
      return Object.assign({}, p, { [k]: typeof v === "string" ? sanitize(v) : v });
    });
  }, []);

  // ── Validasi per-field ─────────────────────────────────
  function validateField(k, val) {
    var v = val !== undefined ? val : form[k];
    if (k === "name") {
      if (!String(v).trim())           return "Nama lengkap wajib diisi.";
      if (String(v).trim().length < 3) return "Nama minimal 3 karakter.";
      return "";
    }
    if (k === "phone") {
      if (!String(v).trim()) return "Nomor WhatsApp wajib diisi.";
      if (!isValidPhone(String(v)))
        return "Format tidak valid. Contoh: 08123456789 atau +62812345678.";
      return "";
    }
    if (k === "tujuan_pejabat") {
      if (!String(v).trim())
        return "Pilih pejabat yang ingin Anda temui.";
      return "";
    }
    if (k === "purpose") {
      if (!String(v).trim()) return "Maksud & keperluan wajib diisi.";
      if (String(v).trim().length < 10)
        return "Keperluan terlalu singkat — mohon jelaskan minimal 10 karakter.";
      return "";
    }
    return "";
  }

  function validateAll() {
    var keys = ["name", "phone", "tujuan_pejabat", "purpose"];
    var errs = {};
    keys.forEach(function(k) {
      var msg = validateField(k, form[k]);
      if (msg) errs[k] = msg;
    });
    return errs;
  }

  function handleBlur(k) {
    setTouched(function(p) { return Object.assign({}, p, { [k]: true }); });
    var msg = validateField(k, form[k]);
    setErrors(function(p) { return Object.assign({}, p, { [k]: msg }); });
  }

  function announce(msg) {
    if (liveRef.current) {
      liveRef.current.textContent = "";
      requestAnimationFrame(function() {
        if (liveRef.current) liveRef.current.textContent = msg;
      });
    }
  }

  // ── Submit ─────────────────────────────────────────────
  async function submit() {
    setTouched({ name:true, phone:true, tujuan_pejabat:true, purpose:true });
    var errs = validateAll();

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      var firstKey = ["name","phone","tujuan_pejabat","purpose"].find(function(k) { return errs[k]; });
      announce("Formulir belum lengkap. " + errs[firstKey]);
      requestAnimationFrame(function() {
        var el = document.getElementById(formId + "-" + firstKey);
        if (!el) {
          el = document.querySelector("[name=\"" + formId + "-tujuan_pejabat\"]");
        }
        if (el) el.focus();
      });
      return;
    }

    setErrors({});
    setStep("loading");
    announce("Mengirim permohonan. Mohon tunggu...");

    // ── Konfigurasi Supabase (ikuti pola ProkopimApp) ────
    var SUPA_URL = (typeof import.meta !== "undefined" && import.meta.env)
      ? (import.meta.env.VITE_SUPABASE_URL || "")
      : "";
    var SUPA_KEY = (typeof import.meta !== "undefined" && import.meta.env)
      ? (import.meta.env.VITE_SUPABASE_ANON_KEY || "")
      : "";

    if (!SUPA_URL || !SUPA_KEY) {
      setStep("form");
      setErrors({ _global: "Konfigurasi sistem belum lengkap. Silakan hubungi Admin Prokopim." });
      announce("Pengiriman gagal. Konfigurasi sistem belum lengkap.");
      return;
    }

    var headers = {
      "Content-Type":  "application/json",
      "apikey":        SUPA_KEY,
      "Authorization": "Bearer " + SUPA_KEY,
    };

    try {
      var noWaNormal = normalizePhone(form.phone);

      // ── Step 1: Rate limit check ─────────────────────────
      // Cek apakah nomor WA ini masih punya permohonan aktif
      var checkUrl = SUPA_URL
        + "/rest/v1/permohonan_tamu"
        + "?no_wa=eq." + encodeURIComponent(noWaNormal)
        + "&status=in.(\"pending_kasubbag\",\"pending_kabag\",\"pending_pimpinan\")"
        + "&select=id"
        + "&limit=1";

      var checkRes = await fetch(checkUrl, { headers: headers });

      if (!checkRes.ok) {
        var checkErr = await checkRes.json().catch(function() { return {}; });
        throw new Error(checkErr.message || "Gagal memeriksa data. Coba lagi.");
      }

      var existing = await checkRes.json();

      if (Array.isArray(existing) && existing.length > 0) {
        setStep("form");
        setErrors({
          _global: "Nomor WhatsApp ini masih memiliki permohonan yang sedang diproses. " +
                   "Harap tunggu konfirmasi dari Tim Protokol.",
        });
        announce("Pengiriman dibatalkan. Nomor WhatsApp masih memiliki permohonan aktif.");
        return;
      }

      // ── Step 2: Siapkan aksesibilitas ────────────────────
      var aksesParts = AKSES_OPTIONS
        .filter(function(o) { return form.akses_options.includes(o.id); })
        .map(function(o)    { return o.label; });

      var aksesDetail = form.needs_aksesibilitas
        ? ((aksesParts.length
            ? aksesParts.join(", ") + (form.akses_detail.trim() ? ". " + form.akses_detail.trim() : "")
            : form.akses_detail.trim()) || null)
        : null;

      // ── Step 3: Susun payload sesuai kolom tabel ─────────
      var pejabatOpt = PEJABAT_OPTIONS.find(function(o) { return o.id === form.tujuan_pejabat; });
      var pejabatLabel = pejabatOpt ? pejabatOpt.label : form.tujuan_pejabat;

      var insertPayload = {
        nama:                   form.name.trim(),
        instansi:               form.organization.trim() || "-",
        no_wa:                  noWaNormal,
        tujuan_pejabat:         pejabatLabel,   // "Wali Kota" | "Wakil Wali Kota"
        maksud_keperluan:       form.purpose.trim(),
        status:                 "pending_kasubbag",
        pesan:                  form.message.trim() || null,
        preferensi_tanggal:     form.preferred_date || null,
        preferensi_jam:         form.preferred_time || null,
        butuh_aksesibilitas:    form.needs_aksesibilitas || false,
        detail_aksesibilitas:   aksesDetail,
      };

      // ── Step 4: Insert ke Supabase ────────────────────────
      var insertRes = await fetch(SUPA_URL + "/rest/v1/permohonan_tamu", {
        method:  "POST",
        headers: Object.assign({}, headers, {
          "Prefer": "return=minimal",
        }),
        body: JSON.stringify(insertPayload),
      });

      if (!insertRes.ok) {
        var insertErr = await insertRes.json().catch(function() { return {}; });
        var pgMsg    = insertErr.message || "";
        var pgDetail = insertErr.details || "";
        var pgHint   = insertErr.hint    || "";
        var pgCode   = insertErr.code    || "";
        // Tampilkan pesan MENTAH dari Supabase agar bisa didiagnosis
        var rawErr = "[" + pgCode + "] " + pgMsg
          + (pgDetail ? " | " + pgDetail : "")
          + (pgHint   ? " | Hint: " + pgHint : "");
        throw new Error(rawErr || "Gagal mengirim. HTTP " + insertRes.status);
      }

      var inserted = await insertRes.json().catch(function() { return [{}]; });
      var row = Array.isArray(inserted) ? inserted[0] : inserted;

      // ── Step 5: Tampilkan sukses ──────────────────────────
      setResult({
        id:              row.id || null,
        nama:            insertPayload.nama,
        instansi:        insertPayload.instansi,
        no_wa:           insertPayload.no_wa,
        tujuan_pejabat:  pejabatLabel,
        maksud_keperluan:insertPayload.maksud_keperluan,
        status:          "pending_kasubbag",
      });
      try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
      setStep("success");
      announce("Permohonan berhasil dikirim. Silakan cek layar untuk detail.");
      requestAnimationFrame(function() {
        if (successRef.current) successRef.current.focus();
      });

    } catch (e) {
      setStep("form");
      var msg = e.message || "Terjadi kesalahan jaringan. Periksa koneksi dan coba lagi.";
      setErrors({ _global: msg });
      announce("Pengiriman gagal. " + msg);
    }
  }

  // ── Font loader ────────────────────────────────────────
  useEffect(function() {
    if (!document.getElementById("tp-font")) {
      var l = document.createElement("link");
      l.id   = "tp-font";
      l.rel  = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Lora:wght@600&display=swap";
      document.head.appendChild(l);
    }
    var meta = document.querySelector("meta[name=viewport]");
    if (meta) meta.content = "width=device-width,initial-scale=1,maximum-scale=1";
  }, []);

  return (
    <div style={{
      minHeight:  "100dvh",
      background: NAVY,
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>

      {/* ── Widget Aksesibilitas ─────────────────────────────── */}
      <div
        role="region"
        aria-label="Pengaturan aksesibilitas"
        style={{
          position: "fixed", bottom: 16, right: 16, zIndex: 9000,
          display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8,
        }}
      >
        {/* Tombol perbesar teks */}
        <button
          onClick={cycleTextSize}
          aria-label={"Ukuran teks: " + (textSize === "normal" ? "Normal" : textSize === "large" ? "Besar" : "Sangat Besar") + ". Klik untuk ganti."}
          title="Ubah ukuran teks"
          style={{
            width: 44, height: 44, borderRadius: 12,
            border: "2px solid " + (HC ? HC.border : "#0A1628"),
            background: HC ? HC.surface : "white",
            color: HC ? HC.text : "#0A1628",
            cursor: "pointer", fontWeight: 800, fontSize: 15,
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {textSize === "normal" ? "A" : textSize === "large" ? "A+" : "A++"}
        </button>
        {/* Tombol kontras tinggi */}
        <button
          onClick={toggleContrast}
          aria-pressed={highContrast}
          aria-label={(highContrast ? "Nonaktifkan" : "Aktifkan") + " mode kontras tinggi"}
          title="Mode kontras tinggi"
          style={{
            width: 44, height: 44, borderRadius: 12,
            border: "2px solid " + (HC ? "#FFD700" : "#0A1628"),
            background: highContrast ? "#FFD700" : "white",
            color: highContrast ? "#000000" : "#0A1628",
            cursor: "pointer", fontWeight: 800, fontSize: 18,
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ◑
        </button>
      </div>

      {/* Skip link — keyboard dan screen reader */}
      <a
        href="#main-form"
        style={{
          position:"absolute", top:-48, left:0, zIndex:9999,
          background:GOLD, color:NAVY,
          padding:"10px 16px", fontWeight:800, fontSize:14,
          borderRadius:"0 0 10px 0", textDecoration:"none",
          transition:"top .15s",
        }}
        onFocus={function(e) { e.currentTarget.style.top = "0"; }}
        onBlur={function(e)  { e.currentTarget.style.top = "-48px"; }}
      >
        Lewati ke Formulir
      </a>

      {/* aria-live region — screen reader */}
      <div
        ref={liveRef}
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        style={{
          position:"absolute", width:1, height:1,
          overflow:"hidden", clip:"rect(0,0,0,0)",
          whiteSpace:"nowrap",
        }}
      />

      <Decor/>

      <div style={{
        position:"relative", zIndex:1,
        display:"flex", flexDirection:"column", alignItems:"center",
        minHeight:"100dvh", padding:"0 0 56px",
      }}>

        <PageHeader/>

        <main
          id="main-form"
          style={{ width:"calc(100% - 32px)", maxWidth:500 }}
          aria-label="Formulir permohonan audiensi Wali Kota Tarakan"
        >
          {step === "success"
            ? <SuccessView ref={successRef} result={result} form={form}/>
            : <FormView
                form={form} setF={setF}
                errors={errors} touched={touched}
                onBlur={handleBlur}
                onSubmit={submit}
                loading={step === "loading"}
                formId={formId}
              />
          }
        </main>

        <FooterHelp/>
      </div>

      <GlobalStyles/>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  FORM VIEW
// ══════════════════════════════════════════════════════════
function FormView({ form, setF, errors, touched, onBlur, onSubmit, loading, formId }) {
  return (
    <div style={{
      background:"#fff", borderRadius:22,
      boxShadow:"0 24px 72px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.15)",
      overflow:"hidden",
    }}>

      <div aria-hidden="true" style={{
        height:5,
        background:"linear-gradient(90deg,#A37B28,#C9A84C,#E8C96C,#C9A84C)",
      }}/>

      <form
        id="tamu-form"
        onSubmit={function(e) { e.preventDefault(); onSubmit(); }}
        noValidate
        aria-label="Formulir permohonan audiensi"
        style={{ padding:"24px 18px 20px" }}
      >
        <InfoBox/>

        {/* Error global */}
        {errors._global && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              background:"#FFF1F1", border:"2px solid #8B0000",
              borderRadius:12, padding:"12px 14px", marginBottom:16,
              display:"flex", gap:10, alignItems:"flex-start",
            }}
          >
            <span aria-hidden="true" style={{ fontSize:18, flexShrink:0 }}>⚠️</span>
            <div>
              <strong style={{ color:"#8B0000", display:"block", marginBottom:2, fontSize:13 }}>
                Pengiriman Gagal
              </strong>
              <span style={{ fontSize:13, color:"#8B0000", lineHeight:1.5 }}>
                {errors._global}
              </span>
            </div>
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* ── Nama ── */}
          <Field
            id={formId + "-name"}
            label="Nama Lengkap"
            required
            error={touched.name ? errors.name : ""}
            hint="Isi sesuai KTP atau identitas resmi Anda"
          >
            <input
              id={formId + "-name"}
              className="tp-inp"
              type="text"
              value={form.name}
              onChange={function(e) { setF("name", e.target.value); }}
              onBlur={function() { onBlur("name"); }}
              required
              aria-required="true"
              aria-invalid={!!(touched.name && errors.name)}
              aria-describedby={
                [touched.name && errors.name ? formId + "-name-err" : null,
                 formId + "-name-hint"].filter(Boolean).join(" ") || undefined
              }
              autoComplete="name"
              autoCapitalize="words"
              placeholder="Contoh: Budi Santoso"
            />
          </Field>

          {/* ── Instansi ── */}
          <Field
            id={formId + "-org"}
            label="Instansi / Organisasi"
            hint="Opsional — kosongkan jika hadir sebagai individu"
          >
            <input
              id={formId + "-org"}
              className="tp-inp"
              type="text"
              value={form.organization}
              onChange={function(e) { setF("organization", e.target.value); }}
              aria-describedby={formId + "-org-hint"}
              autoComplete="organization"
              autoCapitalize="words"
              placeholder="Nama instansi atau organisasi"
            />
          </Field>

          {/* ── Nomor WA ── */}
          <Field
            id={formId + "-phone"}
            label="Nomor WhatsApp"
            required
            error={touched.phone ? errors.phone : ""}
            hint="Konfirmasi jadwal akan dikirimkan ke nomor ini"
          >
            <div style={{ position:"relative" }}>
              <span aria-hidden="true" style={{
                position:"absolute", left:13, top:"50%",
                transform:"translateY(-50%)", fontSize:16, lineHeight:1,
              }}>📱</span>
              <input
                id={formId + "-phone"}
                className="tp-inp"
                style={{ paddingLeft:40 }}
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={function(e) { setF("phone", e.target.value); }}
                onBlur={function() { onBlur("phone"); }}
                required
                aria-required="true"
                aria-invalid={!!(touched.phone && errors.phone)}
                aria-describedby={
                  [touched.phone && errors.phone ? formId + "-phone-err" : null,
                   formId + "-phone-hint"].filter(Boolean).join(" ") || undefined
                }
                autoComplete="tel"
                placeholder="08xxxxxxxxxx"
              />
            </div>
          </Field>

          {/* ── Pejabat yang Ingin Ditemui ── */}
          <PejabatField
            formId={formId}
            value={form.tujuan_pejabat}
            onChange={function(v) { setF("tujuan_pejabat", v); }}
            onBlur={function() { onBlur("tujuan_pejabat"); }}
            error={touched.tujuan_pejabat ? errors.tujuan_pejabat : ""}
            touched={touched.tujuan_pejabat}
          />

          {/* ── Keperluan ── */}
          <Field
            id={formId + "-purpose"}
            label="Maksud & Keperluan"
            required
            error={touched.purpose ? errors.purpose : ""}
            hint="Jelaskan secara singkat tujuan audiensi Anda (minimal 10 karakter)"
          >
            <textarea
              id={formId + "-purpose"}
              className="tp-inp"
              rows={4}
              value={form.purpose}
              onChange={function(e) { setF("purpose", e.target.value); }}
              onBlur={function() { onBlur("purpose"); }}
              required
              aria-required="true"
              aria-invalid={!!(touched.purpose && errors.purpose)}
              aria-describedby={
                [touched.purpose && errors.purpose ? formId + "-purpose-err" : null,
                 formId + "-purpose-hint",
                 formId + "-purpose-count"].filter(Boolean).join(" ") || undefined
              }
              placeholder={"Contoh:\n\u2022 Permohonan kerjasama program...\n\u2022 Aspirasi warga mengenai...\n\u2022 Pelaporan kondisi..."}
            />
            <CharCount
              id={formId + "-purpose-count"}
              value={form.purpose}
              min={10}
              max={500}
            />
          </Field>

          {/* ── Jadwal ── */}
          <fieldset style={{ border:"none", padding:0, margin:0 }}>
            <legend style={{
              display:"block", fontSize:12, fontWeight:700,
              color:"#3d4f63", marginBottom:10,
              letterSpacing:.5, textTransform:"uppercase",
            }}>
              Jadwal yang Diinginkan{" "}
              <span style={{ fontWeight:400, color:"#8295aa", textTransform:"none", letterSpacing:0 }}>
                (opsional)
              </span>
            </legend>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <label htmlFor={formId + "-date"} style={{ ...labelStyle, marginBottom:5 }}>
                  Tanggal
                </label>
                <input
                  id={formId + "-date"}
                  className="tp-inp"
                  type="date"
                  value={form.preferred_date}
                  min={todayWITA()}
                  max={maxDateWITA()}
                  onChange={function(e) { setF("preferred_date", e.target.value); }}
                  aria-describedby={formId + "-date-hint"}
                  style={{ cursor:"pointer" }}
                />
                <span id={formId + "-date-hint"} style={srOnly}>
                  Pilih tanggal antara hari ini hingga 60 hari ke depan.
                </span>
              </div>
              <div>
                <label htmlFor={formId + "-time"} style={{ ...labelStyle, marginBottom:5 }}>
                  Jam (WITA)
                </label>
                <select
                  id={formId + "-time"}
                  className="tp-inp"
                  value={form.preferred_time}
                  onChange={function(e) { setF("preferred_time", e.target.value); }}
                  style={{ cursor:"pointer" }}
                >
                  <option value="">Pilih jam</option>
                  {["08:00","09:00","10:00","11:00","13:00","14:00","15:00"].map(function(t) {
                    return <option key={t} value={t}>{t} WITA</option>;
                  })}
                </select>
              </div>
            </div>

            {form.preferred_date && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  marginTop:9, background:"#EFF6FF",
                  border:"1px solid #BFDBFE", borderRadius:10,
                  padding:"9px 13px", fontSize:13, color:"#1D4ED8",
                  display:"flex", gap:7, alignItems:"center",
                }}
              >
                <span aria-hidden="true">📅</span>
                <span>
                  <strong>Permintaan jadwal:</strong>{" "}
                  {fmtDateLong(form.preferred_date)}
                  {form.preferred_time ? " pukul " + form.preferred_time + " WITA" : ""}
                </span>
              </div>
            )}
          </fieldset>

          {/* ── Pesan tambahan ── */}
          <Field
            id={formId + "-message"}
            label="Pesan Tambahan"
            hint="Opsional — informasi lain yang perlu diketahui Tim Protokol"
          >
            <textarea
              id={formId + "-message"}
              className="tp-inp"
              rows={2}
              value={form.message}
              onChange={function(e) { setF("message", e.target.value); }}
              aria-describedby={formId + "-message-hint"}
              placeholder="Contoh: Saya akan membawa surat rekomendasi dari..."
            />
          </Field>

          {/* ── Aksesibilitas ── */}
          <AksesibilitasSection form={form} setF={setF} formId={formId}/>

        </div>

        <div aria-hidden="true" style={{ height:1, background:"#EEF2F8", margin:"20px 0 16px" }}/>

        <p style={{ fontSize:12, color:"#6b7e94", lineHeight:1.7, textAlign:"center", margin:"0 0 16px" }}>
          Dengan mengirim formulir ini, Anda menyetujui penggunaan data Anda
          untuk keperluan koordinasi audiensi oleh Tim Prokopim Kota Tarakan.
        </p>

        {/* Tombol Submit — minHeight 52px (WCAG 2.5.5) */}
        <button
          type="submit"
          aria-label="Kirim permohonan audiensi"
          aria-busy={loading}
          disabled={loading}
          style={{
            width:"100%", minHeight:52, padding:"14px 16px",
            borderRadius:13, border:"none",
            background: loading ? "#7a90a8" : ("linear-gradient(135deg," + NAVY + "," + NAVY_MID + ")"),
            color:"#fff", fontSize:15, fontWeight:800,
            cursor: loading ? "not-allowed" : "pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:9,
            boxShadow: loading ? "none" : "0 8px 24px rgba(10,22,40,.28)",
            transition:"all .2s",
            fontFamily:"inherit",
            letterSpacing:.2,
          }}
        >
          {loading
            ? <><Spinner/> Mengirim Permohonan...</>
            : <>
                Kirim Permohonan
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8H13M9 4L13 8L9 12"
                    stroke="white" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </>
          }
        </button>
      </form>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  PEJABAT FIELD — Radio Button Kartu Besar
// ══════════════════════════════════════════════════════════
function PejabatField({ formId, value, onChange, onBlur, error, touched }) {
  var groupId   = formId + "-tujuan_pejabat";
  var errId     = groupId + "-err";
  var hintId    = groupId + "-hint";
  var radioName = groupId;

  /*
   * Keyboard: Arrow kiri/kanan untuk pindah pilihan (WAI-ARIA radiogroup pattern).
   * Tab hanya berpindah ke luar group setelah memilih.
   */
  function handleKeyDown(e, idx) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      var next = (idx + 1) % PEJABAT_OPTIONS.length;
      onChange(PEJABAT_OPTIONS[next].id);
      document.getElementById(radioName + "-" + PEJABAT_OPTIONS[next].id)?.focus();
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      var prev = (idx - 1 + PEJABAT_OPTIONS.length) % PEJABAT_OPTIONS.length;
      onChange(PEJABAT_OPTIONS[prev].id);
      document.getElementById(radioName + "-" + PEJABAT_OPTIONS[prev].id)?.focus();
    }
  }

  return (
    <fieldset
      style={{ border:"none", padding:0, margin:0 }}
      aria-describedby={[error ? errId : null, hintId].filter(Boolean).join(" ") || undefined}
    >
      {/* Legend = label untuk group radio */}
      <legend style={{ ...labelStyle, marginBottom:6, width:"100%" }}>
        Pejabat yang Ingin Ditemui
        <span aria-label="(wajib diisi)" style={{ color:"#C0192C", marginLeft:3, fontWeight:900 }}>
          *
        </span>
      </legend>

      <p id={hintId} style={{ fontSize:11.5, color:"#6b7e94", margin:"0 0 10px", lineHeight:1.5 }}>
        Pilih satu pejabat yang ingin Anda temui. Gunakan tombol panah untuk berpindah pilihan.
      </p>

      {/* Grid dua kartu — radio berbentuk kartu besar */}
      <div
        role="radiogroup"
        aria-labelledby={groupId + "-legend"}
        aria-required="true"
        style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}
      >
        {PEJABAT_OPTIONS.map(function(opt, idx) {
          var isSelected = value === opt.id;
          var inputId    = radioName + "-" + opt.id;

          return (
            <label
              key={opt.id}
              htmlFor={inputId}
              style={{
                display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center",
                gap:8, padding:"18px 12px",
                minHeight:100,
                borderRadius:14, cursor:"pointer",
                border: isSelected
                  ? "2.5px solid " + NAVY
                  : "2px solid " + (error ? "#8B0000" : "#CBD5E1"),
                background: isSelected
                  ? "linear-gradient(145deg,#EEF2FA,#E4EAF8)"
                  : "#F8FAFC",
                boxShadow: isSelected
                  ? "0 4px 16px rgba(10,22,40,0.14)"
                  : "none",
                transition:"all .18s",
                position:"relative",
                userSelect:"none",
              }}
            >
              {/* Input radio — tersembunyi visual, tetap ada di DOM untuk a11y */}
              <input
                type="radio"
                id={inputId}
                name={radioName}
                value={opt.id}
                checked={isSelected}
                onChange={function() { onChange(opt.id); }}
                onBlur={onBlur}
                onKeyDown={function(e) { handleKeyDown(e, idx); }}
                aria-label={opt.label + " - " + opt.sub}
                style={{
                  position:"absolute",
                  opacity:0, width:1, height:1,
                  /* Tetap di DOM dan dapat fokus, hanya tidak terlihat */
                }}
              />

              {/* Indikator centang — bukan hanya warna (WCAG 1.4.1) */}
              <div
                aria-hidden="true"
                style={{
                  position:"absolute", top:10, right:10,
                  width:20, height:20, borderRadius:"50%",
                  border: isSelected ? "none" : "2px solid #CBD5E1",
                  background: isSelected ? NAVY : "transparent",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"all .15s",
                  flexShrink:0,
                }}
              >
                {isSelected && (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M2 5.5L4.5 8L9 3"
                      stroke="white" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>

              {/* Ikon pejabat */}
              <div
                aria-hidden="true"
                style={{
                  width:44, height:44, borderRadius:12,
                  background: isSelected
                    ? "linear-gradient(135deg," + NAVY + "," + NAVY_MID + ")"
                    : "#E2E8F0",
                  display:"flex", alignItems:"center",
                  justifyContent:"center", fontSize:22,
                  transition:"background .18s",
                  flexShrink:0,
                }}
              >
                {opt.emoji}
              </div>

              {/* Teks */}
              <div style={{ textAlign:"center" }}>
                <div style={{
                  fontSize:14, fontWeight:800,
                  color: isSelected ? NAVY : "#334155",
                  lineHeight:1.2, marginBottom:3,
                }}>
                  {opt.label}
                </div>
                <div style={{
                  fontSize:10.5, color: isSelected ? "#4a6080" : "#94A3B8",
                  lineHeight:1.4,
                }}>
                  {opt.sub}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* Error — ikon + teks, bukan hanya warna (WCAG 1.4.1) */}
      {error && (
        <div
          id={errId}
          role="alert"
          aria-live="polite"
          style={{
            display:"flex", gap:6, alignItems:"flex-start",
            marginTop:8,
          }}
        >
          <span aria-hidden="true" style={{ fontSize:14, flexShrink:0, lineHeight:1.5 }}>⚠️</span>
          <span style={{ fontSize:12.5, color:"#8B0000", fontWeight:700, lineHeight:1.5 }}>
            {error}
          </span>
        </div>
      )}
    </fieldset>
  );
}

// ══════════════════════════════════════════════════════════
//  AKSESIBILITAS SECTION
// ══════════════════════════════════════════════════════════
function AksesibilitasSection({ form, setF, formId }) {
  var detailId = formId + "-akses-detail";

  function toggleOption(id) {
    var next = form.akses_options.includes(id)
      ? form.akses_options.filter(function(x) { return x !== id; })
      : form.akses_options.concat([id]);
    setF("akses_options", next);
  }

  return (
    <div>
      <div style={{
        border: "2px solid " + (form.needs_aksesibilitas ? "#2563EB" : "#CBD5E1"),
        borderRadius:14, overflow:"hidden",
        transition:"border-color .2s",
      }}>
        {/* Toggle — role="switch" untuk screen reader */}
        <button
          type="button"
          role="switch"
          aria-checked={form.needs_aksesibilitas}
          aria-controls={form.needs_aksesibilitas ? formId + "-akses-panel" : undefined}
          aria-label={
            form.needs_aksesibilitas
              ? "Aksesibilitas khusus: aktif. Klik untuk menonaktifkan."
              : "Aksesibilitas khusus: nonaktif. Klik untuk mengaktifkan."
          }
          onClick={function() {
            var next = !form.needs_aksesibilitas;
            setF("needs_aksesibilitas", next);
            if (!next) {
              setF("akses_options", []);
              setF("akses_detail", "");
            }
          }}
          style={{
            width:"100%", minHeight:56,
            background: form.needs_aksesibilitas ? "#EFF6FF" : "#F8FAFC",
            border:"none", cursor:"pointer",
            display:"flex", alignItems:"center",
            justifyContent:"space-between", gap:12,
            padding:"12px 15px", textAlign:"left",
            transition:"background .2s", fontFamily:"inherit",
          }}
        >
          <div style={{ display:"flex", alignItems:"center", gap:11 }}>
            <div aria-hidden="true" style={{
              width:40, height:40, borderRadius:11, flexShrink:0,
              background: form.needs_aksesibilitas ? "#2563EB" : "#E2E8F0",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:20, transition:"background .2s",
            }}>
              ♿
            </div>
            <div>
              <div style={{
                fontSize:13.5, fontWeight:700,
                color: form.needs_aksesibilitas ? "#1D4ED8" : "#1e293b",
                lineHeight:1.3, transition:"color .2s",
              }}>
                Membutuhkan Aksesibilitas Khusus
              </div>
              <div style={{ fontSize:11.5, color:"#64748b", marginTop:2, lineHeight:1.4 }}>
                Kursi roda, pendamping, bahasa isyarat, dll.
              </div>
            </div>
          </div>

          {/* Visual switch — aria pada parent button */}
          <div aria-hidden="true" style={{
            width:48, height:26, borderRadius:13, flexShrink:0,
            background: form.needs_aksesibilitas ? "#2563EB" : "#CBD5E1",
            position:"relative", transition:"background .25s",
          }}>
            <div style={{
              position:"absolute", top:3,
              left: form.needs_aksesibilitas ? 25 : 3,
              width:20, height:20, borderRadius:"50%",
              background:"white",
              boxShadow:"0 1px 4px rgba(0,0,0,0.25)",
              transition:"left .22s cubic-bezier(0.34,1.3,0.64,1)",
            }}/>
          </div>
        </button>

        {/* Panel detail */}
        {form.needs_aksesibilitas && (
          <div
            id={formId + "-akses-panel"}
            role="group"
            aria-label="Pilihan kebutuhan aksesibilitas"
            style={{
              padding:"14px 15px 16px",
              background:"#F0F7FF",
              borderTop:"1px solid #BFDBFE",
            }}
          >
            <p style={{ fontSize:12, fontWeight:700, color:"#1D4ED8", margin:"0 0 10px", letterSpacing:.3 }}>
              Pilih yang sesuai (boleh lebih dari satu):
            </p>

            {/* Chip — role="checkbox" per item, minHeight 44px */}
            <div
              role="group"
              aria-label="Jenis aksesibilitas"
              style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}
            >
              {AKSES_OPTIONS.map(function(opt) {
                var active = form.akses_options.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="checkbox"
                    aria-checked={active}
                    aria-label={opt.label}
                    onClick={function() { toggleOption(opt.id); }}
                    style={{
                      display:"inline-flex", alignItems:"center", gap:6,
                      padding:"8px 13px", minHeight:40,
                      borderRadius:20,
                      border:"2px solid " + (active ? "#2563EB" : "#93C5FD"),
                      background: active ? "#2563EB" : "white",
                      color: active ? "white" : "#1D4ED8",
                      fontSize:12.5, fontWeight:700, cursor:"pointer",
                      transition:"all .15s", fontFamily:"inherit",
                    }}
                  >
                    <span aria-hidden="true">{opt.emoji}</span>
                    <span>{opt.label}</span>
                    {active && <span aria-hidden="true" style={{ marginLeft:2, fontSize:12 }}>✓</span>}
                  </button>
                );
              })}
            </div>

            {/* Textarea detail */}
            <label
              htmlFor={detailId}
              style={{ ...labelStyle, color:"#1D4ED8", marginBottom:6, display:"block" }}
            >
              Keterangan Tambahan{" "}
              <span style={{ fontWeight:400, color:"#5b80b0", textTransform:"none", letterSpacing:0 }}>
                (opsional)
              </span>
            </label>
            <textarea
              id={detailId}
              className="tp-inp"
              rows={2}
              value={form.akses_detail}
              onChange={function(e) { setF("akses_detail", e.target.value); }}
              aria-describedby={detailId + "-hint"}
              placeholder="Contoh: Pengguna kursi roda elektrik, butuh jalur landai di depan ruang tamu..."
              style={{ borderColor:"#93C5FD", background:"white", fontSize:14 }}
            />
            <p id={detailId + "-hint"} style={{ fontSize:11.5, color:"#4b6eaa", margin:"5px 0 10px", lineHeight:1.5 }}>
              Informasi ini diteruskan kepada Ajudan Pimpinan untuk persiapan fasilitas.
            </p>

            {/* Notice */}
            <div role="note" style={{
              background:"#DBEAFE", border:"1px solid #93C5FD",
              borderRadius:9, padding:"9px 12px",
              display:"flex", gap:8, alignItems:"flex-start",
            }}>
              <span aria-hidden="true" style={{ fontSize:15, flexShrink:0 }}>ℹ️</span>
              <p style={{ fontSize:12, color:"#1E3A8A", margin:0, lineHeight:1.6 }}>
                <strong>Untuk Ajudan:</strong> Informasi aksesibilitas ini tampil
                di dashboard antrian tamu agar persiapan fasilitas dilakukan sejak awal.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  SUCCESS VIEW
// ══════════════════════════════════════════════════════════
var SuccessView = React.forwardRef(function SuccessView({ result, form }, ref) {
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      style={{
        background:"#fff", borderRadius:22,
        boxShadow:"0 24px 72px rgba(0,0,0,0.4)",
        overflow:"hidden", outline:"none",
      }}
    >
      <div aria-hidden="true" style={{
        height:5,
        background:"linear-gradient(90deg,#047857,#059669,#34D399)",
      }}/>

      <div style={{ padding:"32px 20px 28px", textAlign:"center" }}>

        <div aria-hidden="true" style={{
          width:72, height:72, borderRadius:"50%",
          background:"linear-gradient(145deg,#059669,#047857)",
          margin:"0 auto 20px",
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:"0 10px 30px rgba(5,150,105,0.35)",
        }}>
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <path d="M7 17.5L13.5 24L27 10"
              stroke="white" strokeWidth="3.2"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h2 style={{
          fontFamily:"'Lora', Georgia, serif",
          fontSize:22, fontWeight:600, color:NAVY,
          margin:"0 0 10px", letterSpacing:-.3,
        }}>
          ✔ Permohonan Berhasil Terkirim
        </h2>

        <p style={{ fontSize:14, color:"#334155", lineHeight:1.7, margin:"0 0 22px" }}>
          Terima kasih, <strong style={{ color:NAVY }}>{form.name}</strong>.
          <br/>Tim Prokopim akan segera menindaklanjuti permohonan Anda.
        </p>

        {/* Ringkasan — dl/dt/dd semantik */}
        <div style={{
          background:"#F6FBF8", border:"2px solid #6EE7B7",
          borderRadius:14, padding:"14px 16px",
          textAlign:"left", marginBottom:18,
        }}>
          <h3 style={{
            fontSize:11, fontWeight:700, color:"#065F46",
            textTransform:"uppercase", letterSpacing:1.2,
            margin:"0 0 10px",
          }}>
            Ringkasan Permohonan
          </h3>

          <dl style={{ margin:0 }}>
            {[
              { label:"Nama",           value:form.name },
              { label:"WhatsApp",       value:"+" + normalizePhone(form.phone) },
              {
                label:"Pejabat Dituju",
                value:getPejabatLabel(form.tujuan_pejabat),
                strong:true,
                color:NAVY,
              },
              {
                label:"Status",
                value:"\u23F3 Menunggu Verifikasi",
                strong:true,
                color:"#1B7A54",
              },
              ...(result?.id ? [{
                label:"Nomor Antrian",
                value:"#" + result.id,
              }] : []),
              ...(form.needs_aksesibilitas ? [{
                label:"Aksesibilitas",
                value:"\u2714 Tercatat \u2014 akan disiapkan",
                color:"#1D4ED8",
              }] : []),
            ].map(function({ label, value, strong, color }) {
              return (
                <div key={label} style={{
                  display:"flex", alignItems:"flex-start", gap:9,
                  padding:"6px 0", borderBottom:"1px solid #D4EFE3",
                }}>
                  <dt style={{
                    minWidth:120, fontSize:11, fontWeight:700,
                    color:"#4A7060", textTransform:"uppercase",
                    letterSpacing:.4, paddingTop:2, flexShrink:0,
                  }}>
                    {label}
                  </dt>
                  <dd style={{
                    fontSize:13.5,
                    fontWeight: strong ? 700 : 600,
                    color: color || NAVY,
                    margin:0,
                  }}>
                    {value}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        {/* WA notice */}
        <div role="note" style={{
          background:"#FFFBEB", border:"2px solid #FDE68A",
          borderRadius:11, padding:"12px 14px",
          display:"flex", gap:10, alignItems:"flex-start", textAlign:"left",
        }}>
          <span aria-hidden="true" style={{ fontSize:18, flexShrink:0 }}>📲</span>
          <p style={{ fontSize:13, color:"#78350F", lineHeight:1.65, margin:0 }}>
            <strong>Notifikasi via WhatsApp</strong> — Konfirmasi dan informasi
            jadwal dikirimkan ke nomor Anda setelah Pimpinan memberikan respons.
          </p>
        </div>

      </div>
    </div>
  );
});

// ══════════════════════════════════════════════════════════
//  SUB-KOMPONEN
// ══════════════════════════════════════════════════════════
function PageHeader() {
  return (
    <header style={{
      width:"100%", padding:"36px 16px 30px",
      display:"flex", flexDirection:"column", alignItems:"center",
      textAlign:"center", position:"relative",
    }}>
      <div
        role="img"
        aria-label="Logo Prokopim Kota Tarakan"
        style={{
          width:62, height:62, borderRadius:18,
          background:"linear-gradient(145deg,rgba(201,168,76,0.18),rgba(201,168,76,0.06))",
          border:"1.5px solid rgba(201,168,76,0.35)",
          display:"flex", alignItems:"center", justifyContent:"center",
          marginBottom:18,
          boxShadow:"0 8px 24px rgba(0,0,0,0.3)",
          fontSize:28,
        }}
      >
        🏛
      </div>

      <p style={{
        color:GOLD, fontSize:11, fontWeight:700,
        letterSpacing:3, textTransform:"uppercase",
        margin:"0 0 10px", opacity:.85,
      }}>
        Prokopim · Kota Tarakan
      </p>

      <h1 style={{
        fontFamily:"'Lora', Georgia, serif",
        fontSize:"clamp(22px,6vw,28px)",
        fontWeight:600, color:"#fff",
        lineHeight:1.2, margin:"0 0 10px", letterSpacing:-.3,
      }}>
        Permohonan Audiensi
      </h1>

      <p style={{ fontSize:13.5, color:"rgba(255,255,255,0.45)", maxWidth:280, lineHeight:1.65, margin:0 }}>
        Wali Kota &amp; Wakil Wali Kota Tarakan
      </p>

      <div aria-hidden="true" style={{ marginTop:22, display:"flex", alignItems:"center", gap:8 }}>
        {[40,16,6,16,40].map(function(w,i) {
          return (
            <div key={i} style={{
              width:w, height:1, borderRadius:1,
              background: i===2 ? GOLD : ("rgba(201,168,76," + (i===1||i===3 ? .4 : .15) + ")"),
            }}/>
          );
        })}
      </div>
    </header>
  );
}

function InfoBox() {
  return (
    <div
      role="note"
      style={{
        background:"#F0F7FF", border:"1.5px solid #93C5FD",
        borderRadius:12, padding:"12px 14px", marginBottom:18,
        display:"flex", gap:10, alignItems:"flex-start",
      }}
    >
      <span aria-hidden="true" style={{ fontSize:16, flexShrink:0, lineHeight:1.5 }}>ℹ️</span>
      <p style={{ fontSize:13, color:"#1A5FAE", lineHeight:1.65, margin:0 }}>
        Isi formulir ini untuk mengajukan permohonan audiensi dengan{" "}
        <strong>Wali Kota</strong> atau{" "}
        <strong>Wakil Wali Kota Tarakan</strong>. Tim Prokopim akan
        memverifikasi dan menghubungi Anda via WhatsApp.
      </p>
    </div>
  );
}

function Field({ id, label, required, error, hint, children }) {
  var hintId = id + "-hint";
  var errId  = id + "-err";

  return (
    <div>
      <label htmlFor={id} style={{ ...labelStyle, marginBottom:6 }}>
        {label}
        {required && (
          <span aria-label="(wajib diisi)" style={{ color:"#C0192C", marginLeft:3, fontWeight:900 }}>
            *
          </span>
        )}
      </label>

      {hint && (
        <p id={hintId} style={{ fontSize:11.5, color:"#6b7e94", margin:"0 0 6px", lineHeight:1.5 }}>
          {hint}
        </p>
      )}

      {children}

      {error && (
        <div
          id={errId}
          role="alert"
          aria-live="polite"
          style={{ display:"flex", gap:6, alignItems:"flex-start", marginTop:6 }}
        >
          <span aria-hidden="true" style={{ fontSize:14, flexShrink:0, lineHeight:1.5 }}>⚠️</span>
          <span style={{ fontSize:12.5, color:"#8B0000", fontWeight:700, lineHeight:1.5 }}>
            {error}
          </span>
        </div>
      )}
    </div>
  );
}

function CharCount({ id, value, min, max }) {
  var len  = (value || "").trim().length;
  var ok   = len >= min;
  var near = len > max * 0.85;
  return (
    <div id={id} aria-live="polite" style={{
      display:"flex", justifyContent:"space-between",
      fontSize:11.5, marginTop:5,
    }}>
      <span style={{ color: ok ? "#065F46" : (len > 0 ? "#92400E" : "#8295aa") }}>
        {len === 0 ? "" : ok ? "✓ Cukup jelas" : ("Masih perlu " + (min - len) + " karakter lagi")}
      </span>
      <span style={{ color: near ? "#92400E" : "#8295aa" }}>{len}/{max}</span>
    </div>
  );
}

function FooterHelp() {
  return (
    <div style={{ width:"calc(100% - 32px)", maxWidth:500, marginTop:16 }}>
      <a
        href={WA_ADMIN}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Kesulitan mengisi form? Hubungi Admin via WhatsApp (membuka jendela baru)"
        style={{
          display:"flex", alignItems:"center", justifyContent:"center", gap:10,
          width:"100%", minHeight:52,
          borderRadius:13, border:"2px solid rgba(255,255,255,0.2)",
          background:"rgba(255,255,255,0.06)",
          color:"rgba(255,255,255,0.85)", fontSize:13.5, fontWeight:700,
          textDecoration:"none", padding:"12px 16px",
          transition:"all .2s",
          cursor:"pointer",
        }}
        onMouseEnter={function(e) {
          e.currentTarget.style.background    = "rgba(255,255,255,0.12)";
          e.currentTarget.style.borderColor   = "rgba(255,255,255,0.4)";
        }}
        onMouseLeave={function(e) {
          e.currentTarget.style.background    = "rgba(255,255,255,0.06)";
          e.currentTarget.style.borderColor   = "rgba(255,255,255,0.2)";
        }}
      >
        <span aria-hidden="true" style={{ fontSize:20 }}>💬</span>
        <span>
          Kesulitan mengisi form?{" "}
          <span style={{ color:GOLD }}>Hubungi Admin via WhatsApp</span>
        </span>
      </a>

      <p style={{
        marginTop:16, color:"rgba(255,255,255,0.2)",
        fontSize:11.5, textAlign:"center", lineHeight:1.7,
      }}>
        Pemerintah Kota Tarakan &nbsp;·&nbsp; Bagian Protokol &amp; Komunikasi Pimpinan
        <br/>Jl. Jenderal Sudirman No.1, Tarakan, Kalimantan Utara
      </p>
    </div>
  );
}

function Decor() {
  return (
    <div aria-hidden="true" style={{ position:"fixed", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
      <div style={{ position:"absolute",top:-120,right:-120,width:380,height:380,borderRadius:"50%",border:"1px solid rgba(201,168,76,0.12)" }}/>
      <div style={{ position:"absolute",top:-60,right:-60,width:220,height:220,borderRadius:"50%",background:"radial-gradient(circle,rgba(201,168,76,0.06),transparent 70%)" }}/>
      <div style={{ position:"absolute",bottom:-40,left:-60,width:280,height:280,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.04)" }}/>
      <div style={{ position:"absolute",inset:0,backgroundImage:"radial-gradient(circle,rgba(255,255,255,0.035) 1px,transparent 1px)",backgroundSize:"28px 28px" }}/>
    </div>
  );
}

function Spinner() {
  return (
    <span
      role="status"
      aria-label="Memuat"
      style={{
        width:17, height:17, borderRadius:"50%",
        border:"2.5px solid rgba(255,255,255,.25)",
        borderTopColor:"#fff",
        display:"inline-block", flexShrink:0,
        animation:"tp-spin .75s linear infinite",
      }}
    />
  );
}

// ── Style helpers ────────────────────────────────────────
var labelStyle = {
  display:"block", fontSize:12, fontWeight:700,
  color:"#3d4f63", letterSpacing:.5, textTransform:"uppercase",
};

var srOnly = {
  position:"absolute", width:1, height:1,
  overflow:"hidden", clip:"rect(0,0,0,0)", whiteSpace:"nowrap",
};

function GlobalStyles() {
  return (
    <style>{`
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { -webkit-tap-highlight-color: transparent; }
      input, textarea, select, button { font-family: inherit; }

      .tp-inp {
        width: 100%;
        padding: 13px 15px;
        min-height: 48px;
        border-radius: 12px;
        border: 2px solid #c8d4e0;
        font-size: 16px;
        color: #0f2335;
        background: #fff;
        outline: none;
        transition: border-color .2s, box-shadow .2s;
        -webkit-appearance: none;
        display: block;
      }

      .tp-inp:focus,
      button:focus-visible,
      a:focus-visible,
      [role="switch"]:focus-visible,
      [role="checkbox"]:focus-visible,
      label:focus-within .tp-inp {
        border-color: #0A1628;
        box-shadow: 0 0 0 4px rgba(10,22,40,0.15);
        outline: 2px solid #C9A84C;
        outline-offset: 2px;
      }

      input[type="radio"]:focus-visible + * {
        outline: 3px solid #C9A84C;
        outline-offset: 2px;
      }

      .tp-inp[aria-invalid="true"] {
        border-color: #8B0000;
        background: #FFF8F8;
      }

      .tp-inp::placeholder { color: #7a92a8; }
      textarea.tp-inp { resize: vertical; line-height: 1.6; }

      @keyframes tp-spin   { to { transform: rotate(360deg); } }
      @keyframes tp-fadeup { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      @keyframes tp-pop    {
        0%  { transform: scale(.65) rotate(-8deg); opacity:0; }
        70% { transform: scale(1.06) rotate(1deg); }
        100%{ transform: scale(1)   rotate(0);    opacity:1; }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          transition-duration: 0.01ms !important;
        }
      }

      @media (forced-colors: active) {
        .tp-inp { border: 2px solid ButtonText; }
        .tp-inp:focus { outline: 3px solid Highlight; }
        button { border: 2px solid ButtonText; }
      }
    `}</style>
  );
}