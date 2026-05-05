// ============================================================
//  SuperadminPage.jsx — Halaman Super Administrator
//  Akses: domain/superadmin (perlu login + OTP WhatsApp)
//
//  Fitur:
//   1. Manajemen User (CRUD, ubah role, reset password, force logout)
//   2. Manajemen Data (jadwal, tamu, pending_regs)
//   3. Backup & Restore (JSON download/upload)
//   4. Audit Log (siapa-melakukan-apa)
//   5. System Info (counts, koneksi, env masked)
// ============================================================

import React, { useState, useEffect, useCallback } from "react";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const H = () => ({ "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY });

const ROLES = [
  "superadmin",
  "kabag", "kasubbag_protokol", "kasubbag_komdokpim",
  "admin_rk", "admin_undangan",
  "staf", "timkom",
  "ajudan_walikota", "ajudan_wakilwalikota",
  "walikota", "wakilwalikota",
  "mitra_kerja", "walpri",
];

// ──────────────────────────────────────────────────────────────
//  HELPERS
// ──────────────────────────────────────────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function hashPassword(plain) { return "$sha256$" + await sha256(plain); }
async function verifyPassword(plain, hash) {
  if (!hash) return false;
  if (!hash.startsWith("$sha256$")) return plain === hash;
  return ("$sha256$" + await sha256(plain)) === hash;
}

export async function logAudit({ actor, actor_role, action, target, detail }) {
  if (!SUPA_URL || !SUPA_KEY) return;
  try {
    await fetch(SUPA_URL + "/rest/v1/audit_log", {
      method: "POST",
      headers: { ...H(), Prefer: "return=minimal" },
      body: JSON.stringify({
        actor, actor_role: actor_role || null,
        action, target: target || null,
        detail: detail || null,
        user_agent: (navigator.userAgent || "").slice(0, 200),
      }),
    });
  } catch (e) { console.warn("[audit] gagal:", e.message); }
}

// ─── Fetchers ───
async function fetchUsers() {
  const r = await fetch(SUPA_URL + "/rest/v1/users?select=*&order=username", { headers: H() });
  if (!r.ok) throw new Error("Gagal load users (" + r.status + ")");
  return r.json();
}
async function upsertUser(u) {
  const { _newPw, ...clean } = u;
  const r = await fetch(SUPA_URL + "/rest/v1/users", {
    method: "POST",
    headers: { ...H(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(clean),
  });
  if (!r.ok) throw new Error("Gagal simpan user (" + r.status + ")");
}
async function removeUser(username) {
  const r = await fetch(SUPA_URL + "/rest/v1/users?username=eq." + encodeURIComponent(username), {
    method: "DELETE", headers: H(),
  });
  if (!r.ok) throw new Error("Gagal hapus user (" + r.status + ")");
}
async function fetchTable(name, qs = "") {
  const r = await fetch(SUPA_URL + "/rest/v1/" + name + "?select=*" + qs, { headers: H() });
  if (!r.ok) throw new Error("Gagal load " + name + " (" + r.status + ")");
  return r.json();
}
async function deleteRowById(table, id) {
  const r = await fetch(SUPA_URL + "/rest/v1/" + table + "?id=eq." + encodeURIComponent(id), {
    method: "DELETE", headers: H(),
  });
  if (!r.ok) throw new Error("Gagal hapus (" + r.status + ")");
}
async function countTable(table) {
  try {
    const r = await fetch(SUPA_URL + "/rest/v1/" + table + "?select=*", {
      headers: { ...H(), Prefer: "count=exact", Range: "0-0" },
    });
    const cr = r.headers.get("content-range") || "";
    const m = cr.match(/\/(\d+|\*)/);
    return m && m[1] !== "*" ? Number(m[1]) : 0;
  } catch { return 0; }
}

// ──────────────────────────────────────────────────────────────
//  STYLES (inline tokens)
// ──────────────────────────────────────────────────────────────
const C = {
  bg: "#0F172A", card: "#FFFFFF", text: "#0F172A", muted: "#64748B",
  border: "#E2E8F0", primary: "#1E40AF", danger: "#B91C1C", warn: "#B45309",
  ok: "#047857", soft: "#F8FAFC",
};
const btn = (variant = "primary") => ({
  padding: "8px 14px", borderRadius: 8, border: "1px solid",
  cursor: "pointer", fontWeight: 700, fontSize: 13,
  ...(variant === "primary" ? { background: C.primary, color: "white", borderColor: C.primary } :
      variant === "danger"  ? { background: "white",   color: C.danger,  borderColor: C.danger } :
      variant === "warn"    ? { background: "white",   color: C.warn,    borderColor: C.warn } :
      variant === "ok"      ? { background: C.ok,      color: "white",   borderColor: C.ok } :
                              { background: "white",   color: C.text,    borderColor: C.border }),
});
const inp = { padding: "9px 12px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 14, width: "100%", boxSizing: "border-box" };
const th  = { textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: C.muted, borderBottom: "2px solid " + C.border, background: C.soft };
const td  = { padding: "10px 12px", fontSize: 13, borderBottom: "1px solid " + C.border, verticalAlign: "top" };

// ──────────────────────────────────────────────────────────────
//  MAIN
// ──────────────────────────────────────────────────────────────
export default function SuperadminPage() {
  const [phase, setPhase] = useState("login"); // login | otp | dashboard
  const [un, setUn] = useState("");
  const [pw, setPw] = useState("");
  const [otp, setOtp] = useState("");
  const [user, setUser] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [masked, setMasked] = useState("");
  const [tab, setTab] = useState("users");
  const [toast, setToast] = useState(null);

  const T = useCallback((msg, kind = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2800);
  }, []);

  // ── Restore session (max 30 menit) ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem("jp_sa_session");
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s.username || (Date.now() - s.at) > 30 * 60 * 1000) {
        localStorage.removeItem("jp_sa_session"); return;
      }
      fetchUsers().then(rows => {
        const u = rows.find(x => x.username === s.username);
        if (u && u.role === "superadmin" && !u.disabled) {
          setUser(u); setPhase("dashboard");
        } else {
          localStorage.removeItem("jp_sa_session");
        }
      }).catch(() => {});
    } catch {}
  }, []);

  const submitLogin = async () => {
    setErr(""); setBusy(true);
    try {
      const users = await fetchUsers();
      const cand = users.find(u => u.username === un.toLowerCase().trim());
      const fail = "Username atau password tidak sesuai.";
      if (!cand)                       { setErr(fail); setBusy(false); return; }
      if (cand.disabled)               { setErr("Akun dinonaktifkan."); setBusy(false); return; }
      if (cand.role !== "superadmin")  { setErr("Akses ditolak — akun ini bukan super admin."); setBusy(false); return; }
      const ok = await verifyPassword(pw, cand.password);
      if (!ok) { setErr(fail); setBusy(false); return; }

      // Super admin: paksa channel email (tidak pakai WhatsApp)
      const r = await fetch("/api/otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", username: cand.username, channel: "email" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d.error || "Gagal kirim OTP. Pastikan email super admin sudah terdaftar.");
        setBusy(false); return;
      }
      if (d.channel !== "email") {
        setErr("Saluran email tidak aktif. Periksa konfigurasi RESEND_API_KEY di server.");
        setBusy(false); return;
      }
      setMasked(d.masked || "");
      setUser(cand);
      setPhase("otp");
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const submitOTP = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_login", username: user.username, otp: otp.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "OTP tidak valid"); setBusy(false); return; }

      await logAudit({ actor: user.username, actor_role: user.role, action: "auth.login_superadmin" });
      try { localStorage.setItem("jp_sa_session", JSON.stringify({ username: user.username, at: Date.now() })); } catch {}
      setPhase("dashboard");
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const logout = async () => {
    if (user) await logAudit({ actor: user.username, actor_role: user.role, action: "auth.logout_superadmin" });
    try { localStorage.removeItem("jp_sa_session"); } catch {}
    try { localStorage.removeItem("jp_session"); } catch {}
    window.location.href = "/";
  };

  // ── LOGIN UI ──
  if (phase === "login") {
    return (
      <Shell title="Super Admin Login">
        <p style={{ fontSize: 13, color: C.muted, marginTop: 0 }}>
          Halaman terbatas. Wajib username & password super admin + verifikasi OTP via Email.
        </p>
        {err && <Banner kind="error">{err}</Banner>}
        <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>USERNAME</label>
        <input style={inp} value={un} onChange={e => setUn(e.target.value)} autoFocus disabled={busy}
               onKeyDown={e => e.key === "Enter" && pw && submitLogin()} />
        <div style={{ height: 12 }} />
        <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>PASSWORD</label>
        <input style={inp} type="password" value={pw} onChange={e => setPw(e.target.value)} disabled={busy}
               onKeyDown={e => e.key === "Enter" && un && submitLogin()} />
        <div style={{ height: 18 }} />
        <button style={{ ...btn("primary"), width: "100%", padding: "11px" }}
                onClick={submitLogin} disabled={busy || !un || !pw}>
          {busy ? "Memproses..." : "Lanjut ke Verifikasi OTP →"}
        </button>
      </Shell>
    );
  }

  // ── OTP UI ──
  if (phase === "otp") {
    return (
      <Shell title="Verifikasi OTP">
        <p style={{ fontSize: 13, color: C.muted, marginTop: 0 }}>
          Kode OTP dikirim ke email <b>{masked || "(tersembunyi)"}</b>. Berlaku 10 menit. Cek folder Spam jika tidak terlihat.
        </p>
        {err && <Banner kind="error">{err}</Banner>}
        <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>KODE OTP (6 DIGIT)</label>
        <input style={{ ...inp, letterSpacing: 8, fontWeight: 800, fontSize: 22, textAlign: "center" }}
               value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
               autoFocus disabled={busy} maxLength={6}
               onKeyDown={e => e.key === "Enter" && otp.length === 6 && submitOTP()} />
        <div style={{ height: 18 }} />
        <button style={{ ...btn("primary"), width: "100%", padding: "11px" }}
                onClick={submitOTP} disabled={busy || otp.length !== 6}>
          {busy ? "Memverifikasi..." : "Masuk Dashboard"}
        </button>
        <button style={{ ...btn("ghost"), width: "100%", padding: "9px", marginTop: 8 }}
                onClick={() => { setPhase("login"); setOtp(""); setErr(""); }}>
          ← Kembali
        </button>
      </Shell>
    );
  }

  // ── DASHBOARD ──
  return (
    <div style={{ minHeight: "100vh", background: C.soft }}>
      {/* Header */}
      <div style={{ background: C.bg, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "white" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>SUPER ADMIN — Prokopim Hibot</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{user?.nama || user?.username} · sesi 30 menit</div>
        </div>
        <button style={{ ...btn("ghost"), color: "white", borderColor: "rgba(255,255,255,0.3)", background: "transparent" }} onClick={logout}>
          Keluar
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "0 20px", borderBottom: "1px solid " + C.border, background: "white", overflowX: "auto" }}>
        {[
          ["users",  "Users"],
          ["data",   "Data"],
          ["backup", "Backup & Restore"],
          ["audit",  "Audit Log"],
          ["system", "System Info"],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
                  style={{ padding: "12px 16px", border: "none", background: "transparent",
                           cursor: "pointer", fontSize: 13, fontWeight: 700,
                           color: tab === k ? C.primary : C.muted,
                           borderBottom: "3px solid " + (tab === k ? C.primary : "transparent") }}>
            {l}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
        {tab === "users"  && <UsersTab  user={user} T={T} />}
        {tab === "data"   && <DataTab   user={user} T={T} />}
        {tab === "backup" && <BackupTab user={user} T={T} />}
        {tab === "audit"  && <AuditTab  user={user} T={T} />}
        {tab === "system" && <SystemTab user={user} T={T} />}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: toast.kind === "error" ? C.danger : toast.kind === "warn" ? C.warn : C.ok,
                      color: "white", padding: "10px 16px", borderRadius: 9, fontSize: 13, fontWeight: 700, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
//  Shell (login/otp wrapper)
// ──────────────────────────────────────────────────────────────
function Shell({ title, children }) {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0A1628,#1B4080)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 420, padding: 28, boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: C.danger, marginBottom: 6 }}>SUPER ADMIN</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 18 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}
function Banner({ kind, children }) {
  const bg = kind === "error" ? "#FEE2E2" : kind === "warn" ? "#FEF3C7" : "#D1FAE5";
  const fg = kind === "error" ? C.danger  : kind === "warn" ? C.warn    : C.ok;
  return <div style={{ background: bg, color: fg, padding: "10px 13px", borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{children}</div>;
}

// ──────────────────────────────────────────────────────────────
//  TAB 1: USERS
// ──────────────────────────────────────────────────────────────
function UsersTab({ user, T }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);    // user object atau "new"
  const [search, setSearch] = useState("");

  const reload = async () => {
    setLoading(true);
    try { setUsers(await fetchUsers()); }
    catch (e) { T(e.message, "error"); }
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.username || "").toLowerCase().includes(q)
        || (u.nama || "").toLowerCase().includes(q)
        || (u.role || "").toLowerCase().includes(q);
  });

  const onDisable = async (u) => {
    if (u.username === user.username) { T("Tidak bisa menonaktifkan akun sendiri", "warn"); return; }
    if (!confirm("Nonaktifkan akun " + u.username + "? User tidak bisa login sampai diaktifkan kembali.")) return;
    try {
      await upsertUser({ ...u, disabled: !u.disabled });
      await logAudit({ actor: user.username, actor_role: user.role,
        action: u.disabled ? "user.enable" : "user.disable", target: u.username });
      T(u.disabled ? "Akun diaktifkan" : "Akun dinonaktifkan");
      reload();
    } catch (e) { T(e.message, "error"); }
  };

  const onForceLogout = async (u) => {
    if (!confirm("Paksa logout " + u.username + "? Sesi aktif akan diakhiri saat ia membuka app berikutnya.")) return;
    try {
      await upsertUser({ ...u, session_version: (u.session_version || 0) + 1 });
      await logAudit({ actor: user.username, actor_role: user.role, action: "user.force_logout", target: u.username });
      T("Force logout dijadwalkan");
      reload();
    } catch (e) { T(e.message, "error"); }
  };

  const onResetPassword = async (u) => {
    const newPw = prompt("Password baru untuk " + u.username + " (min 6 karakter):", "");
    if (!newPw) return;
    if (newPw.length < 6) { T("Password minimal 6 karakter", "error"); return; }
    try {
      const hashed = await hashPassword(newPw);
      await upsertUser({ ...u, password: hashed, must_change_pw: true });
      await logAudit({ actor: user.username, actor_role: user.role, action: "user.reset_password", target: u.username });
      T("Password direset. User wajib ganti pada login berikutnya.");
      reload();
    } catch (e) { T(e.message, "error"); }
  };

  const onDelete = async (u) => {
    if (u.username === user.username) { T("Tidak bisa menghapus akun sendiri", "warn"); return; }
    if (!confirm("HAPUS PERMANEN akun " + u.username + "?\nTindakan tidak bisa dibatalkan.")) return;
    try {
      await removeUser(u.username);
      await logAudit({ actor: user.username, actor_role: user.role, action: "user.delete", target: u.username, detail: { role: u.role, nama: u.nama } });
      T("Akun dihapus");
      reload();
    } catch (e) { T(e.message, "error"); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Manajemen User ({users.length})</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inp, width: 220 }} placeholder="Cari username/nama/role..."
                 value={search} onChange={e => setSearch(e.target.value)} />
          <button style={btn("primary")} onClick={() => setEditing("new")}>+ Tambah User</button>
          <button style={btn("ghost")} onClick={reload}>↻</button>
        </div>
      </div>

      {loading ? <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Memuat...</div> : (
        <div style={{ background: "white", borderRadius: 10, border: "1px solid " + C.border, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Username</th>
                <th style={th}>Nama</th>
                <th style={th}>Role</th>
                <th style={th}>WhatsApp</th>
                <th style={th}>Email</th>
                <th style={th}>Status</th>
                <th style={th}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.username} style={{ background: u.disabled ? "#FEF2F2" : "white" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{u.username}</div>
                    {u.role === "superadmin" && <div style={{ fontSize: 11, color: C.danger, fontWeight: 700 }}>SUPER ADMIN</div>}
                  </td>
                  <td style={td}>
                    <div>{u.nama || "—"}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{u.jabatan || ""}</div>
                  </td>
                  <td style={td}><code style={{ fontSize: 12 }}>{u.role}</code></td>
                  <td style={td}>{u.noWA || "—"}</td>
                  <td style={{ ...td, fontSize: 12, wordBreak: "break-all", maxWidth: 200 }}>{u.email || "—"}</td>
                  <td style={td}>
                    {u.disabled ? <span style={{ color: C.danger, fontWeight: 700 }}>Nonaktif</span> :
                                   <span style={{ color: C.ok,     fontWeight: 700 }}>Aktif</span>}
                    {u.must_change_pw && <div style={{ fontSize: 11, color: C.warn }}>wajib ganti pw</div>}
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button style={{ ...btn("ghost"), padding: "5px 9px", fontSize: 12 }} onClick={() => setEditing(u)}>Edit</button>
                      <button style={{ ...btn("warn"),  padding: "5px 9px", fontSize: 12 }} onClick={() => onResetPassword(u)}>Reset PW</button>
                      <button style={{ ...btn("warn"),  padding: "5px 9px", fontSize: 12 }} onClick={() => onForceLogout(u)}>Force Logout</button>
                      <button style={{ ...btn("ghost"), padding: "5px 9px", fontSize: 12 }} onClick={() => onDisable(u)}>{u.disabled ? "Aktifkan" : "Nonaktifkan"}</button>
                      <button style={{ ...btn("danger"),padding: "5px 9px", fontSize: 12 }} onClick={() => onDelete(u)}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: C.muted, padding: 30 }}>Tidak ada user</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && <UserEditModal user={user} target={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} T={T} />}
    </div>
  );
}

function UserEditModal({ user, target, onClose, onSaved, T }) {
  const isNew = target === "new";
  const [form, setForm] = useState(isNew
    ? { username: "", nama: "", jabatan: "", noWA: "", email: "", role: "staf", _newPw: "", disabled: false, must_change_pw: true }
    : { ...target, email: target.email || "", _newPw: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.username.trim()) { T("Username wajib", "error"); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { T("Format email tidak valid", "error"); return; }
    if (isNew && (!form._newPw || form._newPw.length < 6)) { T("Password awal minimal 6 karakter", "error"); return; }
    setSaving(true);
    try {
      const data = { ...form };
      if (isNew || form._newPw) data.password = await hashPassword(form._newPw);
      delete data._newPw;
      data.username = data.username.toLowerCase().trim();
      await upsertUser(data);
      await logAudit({
        actor: user.username, actor_role: user.role,
        action: isNew ? "user.create" : "user.update",
        target: data.username,
        detail: { role: data.role, nama: data.nama },
      });
      T(isNew ? "User dibuat" : "User diperbarui");
      onSaved();
    } catch (e) { T(e.message, "error"); setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 480, padding: 24 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 18 }}>{isNew ? "Tambah User Baru" : "Edit " + target.username}</h3>
        <Field label="Username (huruf kecil, tanpa spasi)">
          <input style={inp} value={form.username} disabled={!isNew}
                 onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })} />
        </Field>
        <Field label="Nama Lengkap">
          <input style={inp} value={form.nama || ""} onChange={e => setForm({ ...form, nama: e.target.value })} />
        </Field>
        <Field label="Jabatan">
          <input style={inp} value={form.jabatan || ""} onChange={e => setForm({ ...form, jabatan: e.target.value })} />
        </Field>
        <Field label="No. WhatsApp (mis. 081234567890)">
          <input style={inp} value={form.noWA || ""} onChange={e => setForm({ ...form, noWA: e.target.value })} />
        </Field>
        <Field label="Email (saluran cadangan / wajib untuk superadmin)">
          <input style={inp} type="email" value={form.email || ""} placeholder="nama@tarakankota.go.id"
                 onChange={e => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Role">
          <select style={inp} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label={isNew ? "Password Awal (wajib)" : "Password Baru (kosongkan jika tidak ganti)"}>
          <input style={inp} type="password" value={form._newPw}
                 onChange={e => setForm({ ...form, _newPw: e.target.value })}
                 placeholder={isNew ? "min 6 karakter" : "biarkan kosong"} />
        </Field>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 13 }}>
          <input type="checkbox" checked={!!form.must_change_pw}
                 onChange={e => setForm({ ...form, must_change_pw: e.target.checked })} />
          Wajib ganti password pada login berikutnya
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button style={btn("ghost")} onClick={onClose} disabled={saving}>Batal</button>
          <button style={btn("primary")} onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
//  TAB 2: DATA
// ──────────────────────────────────────────────────────────────
function DataTab({ user, T }) {
  const [sub, setSub] = useState("jadwal");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const reload = async () => {
    setLoading(true);
    try { setRows(await fetchTable(sub, "&order=id.desc&limit=500")); }
    catch (e) { T(e.message, "error"); setRows([]); }
    setLoading(false);
  };
  useEffect(() => { reload(); }, [sub]);

  const onDelete = async (id) => {
    if (!confirm("Hapus permanen record id=" + id + " dari " + sub + "?")) return;
    try {
      await deleteRowById(sub, id);
      await logAudit({ actor: user.username, actor_role: user.role, action: "data.delete", target: sub + ":" + id });
      T("Record dihapus");
      reload();
    } catch (e) { T(e.message, "error"); }
  };

  const filtered = rows.filter(r => {
    if (!search) return true;
    const blob = JSON.stringify(r).toLowerCase();
    return blob.includes(search.toLowerCase());
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["jadwal", "tamu", "pending_regs"].map(k => (
            <button key={k} onClick={() => setSub(k)}
                    style={{ ...btn(sub === k ? "primary" : "ghost"), textTransform: "capitalize" }}>
              {k.replace("_", " ")}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inp, width: 220 }} placeholder="Cari isi record..."
                 value={search} onChange={e => setSearch(e.target.value)} />
          <button style={btn("ghost")} onClick={reload}>↻</button>
        </div>
      </div>

      {loading ? <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Memuat...</div> : (
        <div style={{ background: "white", borderRadius: 10, border: "1px solid " + C.border, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>ID</th>
                <th style={th}>Ringkasan</th>
                <th style={th}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{r.id}</td>
                  <td style={td}>
                    <DataSummary row={r} table={sub} />
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={{ ...btn("ghost"), padding: "5px 9px", fontSize: 12 }}
                              onClick={() => alert(JSON.stringify(r, null, 2))}>Lihat JSON</button>
                      <button style={{ ...btn("danger"), padding: "5px 9px", fontSize: 12 }}
                              onClick={() => onDelete(r.id)}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={3} style={{ ...td, textAlign: "center", color: C.muted, padding: 30 }}>Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DataSummary({ row, table }) {
  const d = row.data || {};
  if (table === "jadwal") {
    return (
      <div>
        <div style={{ fontWeight: 700 }}>{d.namaAcara || "(tanpa judul)"}</div>
        <div style={{ fontSize: 11, color: C.muted }}>
          {d.tanggal} · {d.jam} · {d.lokasi || "—"} · alur: <b>{d.alur || "—"}</b>
        </div>
      </div>
    );
  }
  if (table === "tamu") {
    return (
      <div>
        <div style={{ fontWeight: 700 }}>{d.nama || row.nama || "(tanpa nama)"}</div>
        <div style={{ fontSize: 11, color: C.muted }}>
          {d.instansi || row.instansi || "—"} · {d.maksud || row.maksud || ""} · alur: <b>{d.alur || row.alur || "—"}</b>
        </div>
      </div>
    );
  }
  return <code style={{ fontSize: 11 }}>{JSON.stringify(row).slice(0, 120)}</code>;
}

// ──────────────────────────────────────────────────────────────
//  TAB 3: BACKUP & RESTORE
// ──────────────────────────────────────────────────────────────
function BackupTab({ user, T }) {
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null);

  const exportAll = async () => {
    setBusy(true); setStats(null);
    try {
      const [users, jadwal, tamu, pendingRegs, audit] = await Promise.all([
        fetchUsers(),
        fetchTable("jadwal"),
        fetchTable("tamu").catch(() => []),
        fetchTable("pending_regs").catch(() => []),
        fetchTable("audit_log", "&order=at.desc&limit=5000").catch(() => []),
      ]);
      const dump = {
        _meta: {
          app: "Prokopim Hibot",
          exportedAt: new Date().toISOString(),
          exportedBy: user.username,
          source: SUPA_URL,
          version: 1,
        },
        users, jadwal, tamu, pending_regs: pendingRegs, audit_log: audit,
      };
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "prokopim-backup-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);

      setStats({ users: users.length, jadwal: jadwal.length, tamu: tamu.length, pending_regs: pendingRegs.length, audit: audit.length });
      await logAudit({ actor: user.username, actor_role: user.role, action: "backup.export",
        detail: { users: users.length, jadwal: jadwal.length, tamu: tamu.length, audit: audit.length } });
      T("Backup berhasil di-download");
    } catch (e) { T(e.message, "error"); }
    setBusy(false);
  };

  const restoreFromFile = async (file) => {
    if (!file) return;
    if (!confirm("PERHATIAN: tindakan ini akan MENGGANTI seluruh data (users, jadwal, tamu) dengan isi backup.\n\nLanjutkan?")) return;
    if (!confirm("Konfirmasi sekali lagi: HAPUS semua data lama lalu IMPOR dari backup?")) return;
    setBusy(true);
    try {
      const text = await file.text();
      const dump = JSON.parse(text);
      if (!dump || !dump._meta || dump._meta.app !== "Prokopim Hibot") {
        T("File backup tidak valid", "error"); setBusy(false); return;
      }

      // Wipe & insert per table
      const wipe = async (table, rows, key) => {
        // Delete semua existing rows (best-effort)
        for (const r of (await fetchTable(table).catch(() => []))) {
          try {
            await fetch(SUPA_URL + "/rest/v1/" + table + "?" + key + "=eq." + encodeURIComponent(r[key]), {
              method: "DELETE", headers: H(),
            });
          } catch {}
        }
        // Insert ulang dalam batch 50
        for (let i = 0; i < rows.length; i += 50) {
          const batch = rows.slice(i, i + 50);
          await fetch(SUPA_URL + "/rest/v1/" + table, {
            method: "POST",
            headers: { ...H(), Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify(batch),
          });
        }
      };

      if (Array.isArray(dump.users))         await wipe("users",        dump.users,        "username");
      if (Array.isArray(dump.jadwal))        await wipe("jadwal",       dump.jadwal,       "id");
      if (Array.isArray(dump.tamu))          await wipe("tamu",         dump.tamu,         "id");
      if (Array.isArray(dump.pending_regs))  await wipe("pending_regs", dump.pending_regs, "id");

      await logAudit({
        actor: user.username, actor_role: user.role, action: "backup.restore",
        detail: { from: dump._meta, counts: {
          users: dump.users?.length || 0,
          jadwal: dump.jadwal?.length || 0,
          tamu: dump.tamu?.length || 0,
        }},
      });
      T("Restore selesai. Aplikasi akan reload.", "warn");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) { T("Gagal restore: " + e.message, "error"); }
    setBusy(false);
  };

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Backup & Restore</h2>

      <div style={{ background: "white", borderRadius: 10, border: "1px solid " + C.border, padding: 20, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Ekspor Backup</h3>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
          Mengunduh seluruh data (users, jadwal, tamu, pending_regs, audit_log) sebagai 1 file JSON. Simpan di tempat aman.
        </p>
        <button style={btn("primary")} onClick={exportAll} disabled={busy}>
          {busy ? "Memproses..." : "↓ Ekspor Semua Data"}
        </button>
        {stats && (
          <div style={{ marginTop: 12, fontSize: 13, color: C.ok }}>
            ✓ {stats.users} users · {stats.jadwal} jadwal · {stats.tamu} tamu · {stats.pending_regs} pending · {stats.audit} audit
          </div>
        )}
      </div>

      <div style={{ background: "white", borderRadius: 10, border: "1px solid " + C.danger, padding: 20, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0, fontSize: 15, color: C.danger }}>Restore dari Backup ⚠ DESTRUKTIF</h3>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
          Mengganti SELURUH data dengan isi backup. Semua perubahan setelah backup akan HILANG. Pastikan Anda sudah ekspor backup terbaru sebelum restore.
        </p>
        <input type="file" accept="application/json" disabled={busy}
               onChange={e => restoreFromFile(e.target.files?.[0])} />
      </div>

      <div style={{ background: "#FFFBEB", borderRadius: 10, border: "1px solid #FDE68A", padding: 20 }}>
        <h3 style={{ marginTop: 0, fontSize: 15, color: C.warn }}>Cara Migrasi Database (Pindah Project Supabase)</h3>
        <ol style={{ fontSize: 13, color: C.text, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Klik <b>Ekspor Semua Data</b> di atas — simpan file JSON yang terunduh.</li>
          <li>Buat project Supabase baru. Jalankan SQL migration dari <code>supabase-migrations/</code>.</li>
          <li>Di Vercel Dashboard, ubah <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> ke project baru.</li>
          <li>Trigger redeploy (Vercel → Deployments → Redeploy).</li>
          <li>Setelah aplikasi naik, login ke <code>/superadmin</code> di project baru, lalu klik <b>Restore</b> dan upload file JSON tadi.</li>
        </ol>
        <p style={{ fontSize: 12, color: C.muted, marginTop: 10, marginBottom: 0 }}>
          Catatan: ganti DB target tidak bisa dilakukan dari UI runtime karena alasan keamanan. Lihat dokumentasi keamanan.
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
//  TAB 4: AUDIT LOG
// ──────────────────────────────────────────────────────────────
function AuditTab({ user, T }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterActor, setFilterActor] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [limit, setLimit] = useState(200);

  const reload = async () => {
    setLoading(true);
    try {
      let qs = "&order=at.desc&limit=" + limit;
      if (filterActor)  qs += "&actor=eq."  + encodeURIComponent(filterActor);
      if (filterAction) qs += "&action=ilike." + encodeURIComponent("*" + filterAction + "*");
      if (filterDate)   qs += "&at=gte." + filterDate + "T00:00:00&at=lte." + filterDate + "T23:59:59";
      setRows(await fetchTable("audit_log", qs));
    } catch (e) { T(e.message, "error"); setRows([]); }
    setLoading(false);
  };
  useEffect(() => { reload(); }, [limit]);

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Audit Log</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <input style={{ ...inp, width: 180 }} placeholder="Actor (username)" value={filterActor} onChange={e => setFilterActor(e.target.value)} />
        <input style={{ ...inp, width: 180 }} placeholder="Action contains..." value={filterAction} onChange={e => setFilterAction(e.target.value)} />
        <input style={{ ...inp, width: 160 }} type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        <button style={btn("primary")} onClick={reload}>Filter</button>
        <select style={{ ...inp, width: 120 }} value={limit} onChange={e => setLimit(Number(e.target.value))}>
          <option value={100}>100 baris</option>
          <option value={200}>200 baris</option>
          <option value={500}>500 baris</option>
          <option value={1000}>1000 baris</option>
        </select>
      </div>

      {loading ? <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Memuat...</div> : (
        <div style={{ background: "white", borderRadius: 10, border: "1px solid " + C.border, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Waktu</th>
                <th style={th}>Aktor</th>
                <th style={th}>Aksi</th>
                <th style={th}>Target</th>
                <th style={th}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>
                    {new Date(r.at).toLocaleString("id-ID", { hour12: false })}
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{r.actor}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{r.actor_role || ""}</div>
                  </td>
                  <td style={td}><code style={{ fontSize: 12 }}>{r.action}</code></td>
                  <td style={td}>{r.target || "—"}</td>
                  <td style={{ ...td, fontSize: 11, color: C.muted, maxWidth: 320, wordBreak: "break-word" }}>
                    {r.detail ? <code>{JSON.stringify(r.detail)}</code> : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: C.muted, padding: 30 }}>Tidak ada catatan</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
//  TAB 5: SYSTEM INFO
// ──────────────────────────────────────────────────────────────
function SystemTab({ user, T }) {
  const [counts, setCounts] = useState(null);
  const [supaPing, setSupaPing] = useState(null);
  const [pinging, setPinging] = useState(false);

  useEffect(() => {
    Promise.all([
      countTable("users"), countTable("jadwal"),
      countTable("tamu"),  countTable("pending_regs"),
      countTable("audit_log"),
    ]).then(([u, j, t, p, a]) =>
      setCounts({ users: u, jadwal: j, tamu: t, pending_regs: p, audit_log: a })
    );
  }, []);

  const testSupabase = async () => {
    setPinging(true);
    const t0 = performance.now();
    try {
      const r = await fetch(SUPA_URL + "/rest/v1/users?select=username&limit=1", { headers: H() });
      const dt = Math.round(performance.now() - t0);
      setSupaPing({ ok: r.ok, status: r.status, ms: dt });
    } catch (e) { setSupaPing({ ok: false, error: e.message }); }
    setPinging(false);
  };

  const mask = (s, head = 8, tail = 4) => {
    if (!s) return "(belum diset)";
    if (s.length <= head + tail) return "***";
    return s.slice(0, head) + "..." + s.slice(-tail);
  };

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>System Info</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 18 }}>
        {counts ? Object.entries(counts).map(([k, v]) => (
          <div key={k} style={{ background: "white", borderRadius: 10, padding: 16, border: "1px solid " + C.border }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{k}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.text }}>{v.toLocaleString("id-ID")}</div>
          </div>
        )) : <div style={{ color: C.muted }}>Memuat...</div>}
      </div>

      <div style={{ background: "white", borderRadius: 10, border: "1px solid " + C.border, padding: 20, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Konfigurasi (masked)</h3>
        <table style={{ fontSize: 13 }}>
          <tbody>
            <tr><td style={{ padding: 4, color: C.muted, fontWeight: 700 }}>VITE_SUPABASE_URL</td>
                <td style={{ padding: 4 }}><code>{mask(SUPA_URL, 30, 8)}</code></td></tr>
            <tr><td style={{ padding: 4, color: C.muted, fontWeight: 700 }}>VITE_SUPABASE_ANON_KEY</td>
                <td style={{ padding: 4 }}><code>{mask(SUPA_KEY)}</code></td></tr>
            <tr><td style={{ padding: 4, color: C.muted, fontWeight: 700 }}>User-Agent</td>
                <td style={{ padding: 4, fontSize: 11 }}>{(navigator.userAgent || "").slice(0, 90)}</td></tr>
            <tr><td style={{ padding: 4, color: C.muted, fontWeight: 700 }}>Timezone</td>
                <td style={{ padding: 4 }}>{Intl.DateTimeFormat().resolvedOptions().timeZone}</td></tr>
          </tbody>
        </table>
      </div>

      <div style={{ background: "white", borderRadius: 10, border: "1px solid " + C.border, padding: 20 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Test Koneksi</h3>
        <button style={btn("primary")} onClick={testSupabase} disabled={pinging}>
          {pinging ? "Testing..." : "Ping Supabase"}
        </button>
        {supaPing && (
          <div style={{ marginTop: 10, fontSize: 13, color: supaPing.ok ? C.ok : C.danger }}>
            {supaPing.ok ? "✓ OK · HTTP " + supaPing.status + " · " + supaPing.ms + "ms" : "✗ Gagal: " + (supaPing.error || supaPing.status)}
          </div>
        )}
      </div>
    </div>
  );
}
