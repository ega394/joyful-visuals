/**
 * RoomManagement.jsx — Kabag: Tunjuk Pengelola Ruangan
 * Hanya bisa diakses role kabag.
 * Mengatur flag can_manage_rooms per user staf/admin_rk/kasubbag_protokol.
 */
import React, { useState, useEffect, useCallback } from "react";

const NAVY = "#0A1628";
const GOLD = "#C9A84C";
const GREEN = "#16a34a";
const GRAY  = "#6b7280";
const RED   = "#dc2626";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const ELIGIBLE_ROLES = ["staf", "admin_rk", "kasubbag_protokol", "kasubbag_komdokpim"];

const ROLE_LABELS = {
  staf:               "Staf Protokol",
  admin_rk:           "Admin Rencana Kegiatan",
  kasubbag_protokol:  "Kasubbag Protokol",
  kasubbag_komdokpim: "Kasubbag Komdokpim",
};

async function fetchEligibleUsers() {
  const r = await fetch(
    `${SUPA_URL}/rest/v1/users?role=in.(${ELIGIBLE_ROLES.join(",")})&disabled=neq.true&select=username,nama,role,noWA,can_manage_rooms&order=nama`,
    {
      headers: {
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
      },
    }
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function setCanManageRooms(username, value) {
  const r = await fetch(
    `${SUPA_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}`,
    {
      method: "PATCH",
      headers: {
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({ can_manage_rooms: value }),
    }
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function RoomManagement({ user, isMobile }) {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [toggling, setToggling]   = useState(null);
  const [toast, setToast]         = useState("");
  const [err, setErr]             = useState("");

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const data = await fetchEligibleUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr("Gagal memuat data: " + e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (u) => {
    const newVal = !u.can_manage_rooms;
    const action = newVal ? "menunjuk" : "mencabut akses dari";
    if (!window.confirm(`Yakin ${action} ${u.nama} sebagai pengelola ruangan?`)) return;

    setToggling(u.username);
    try {
      await setCanManageRooms(u.username, newVal);
      showToast(`Berhasil ${action} ${u.nama}`);
      setUsers(prev => prev.map(x => x.username === u.username ? { ...x, can_manage_rooms: newVal } : x));
    } catch (e) {
      showToast("Gagal: " + e.message);
    }
    setToggling(null);
  };

  const managers = users.filter(u => u.can_manage_rooms);
  const others   = users.filter(u => !u.can_manage_rooms);

  return (
    <div style={{ padding: isMobile ? "12px" : "20px 24px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: NAVY }}>
            Pengelola Ruangan
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: GRAY }}>
            Tunjuk staf yang berwenang memvalidasi permohonan peminjaman ruang rapat.
            Pengelola yang ditunjuk akan menerima notifikasi WA setiap ada permohonan baru.
          </p>
        </div>

        {err && (
          <div style={{
            background: "#FEE2E2", color: RED, borderRadius: 10,
            padding: "10px 14px", marginBottom: 16, fontSize: 13,
          }}>
            {err}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: GRAY }}>Memuat data staf...</div>
        ) : (
          <>
            {/* Pengelola aktif */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: GRAY,
                letterSpacing: 1, textTransform: "uppercase", marginBottom: 8,
              }}>
                Pengelola Aktif ({managers.length})
              </div>
              {managers.length === 0 ? (
                <div style={{
                  background: "#FEF3C7", border: "1.5px solid #FCD34D",
                  borderRadius: 10, padding: "12px 14px",
                  fontSize: 13, color: "#92400E",
                }}>
                  Belum ada pengelola ruangan yang ditunjuk. Tunjuk staf di bawah.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {managers.map(u => (
                    <UserCard
                      key={u.username}
                      u={u} isManager
                      onToggle={() => handleToggle(u)}
                      loading={toggling === u.username}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Staf lain yang bisa ditunjuk */}
            <div>
              <div style={{
                fontSize: 12, fontWeight: 700, color: GRAY,
                letterSpacing: 1, textTransform: "uppercase", marginBottom: 8,
              }}>
                Staf Tersedia ({others.length})
              </div>
              {others.length === 0 ? (
                <div style={{ color: GRAY, fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                  Semua staf sudah ditunjuk sebagai pengelola.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {others.map(u => (
                    <UserCard
                      key={u.username}
                      u={u} isManager={false}
                      onToggle={() => handleToggle(u)}
                      loading={toggling === u.username}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Link ke dashboard peminjaman */}
        <div style={{
          marginTop: 28, padding: "14px 16px",
          background: "#F0FDF4", border: "1.5px solid #86EFAC",
          borderRadius: 12, fontSize: 13,
        }}>
          <div style={{ fontWeight: 700, color: "#065F46", marginBottom: 4 }}>
            Halaman Publik Peminjaman Ruangan
          </div>
          <div style={{ color: "#047857", marginBottom: 8 }}>
            Bagikan link berikut agar instansi/OPD dapat mengajukan permohonan peminjaman:
          </div>
          <a
            href="/pinjamruangan"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block", padding: "8px 16px",
              background: "#065F46", color: "white", borderRadius: 8,
              fontWeight: 700, fontSize: 13, textDecoration: "none",
            }}>
            Buka Halaman Peminjaman ↗
          </a>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: NAVY, color: "white", padding: "10px 20px",
          borderRadius: 30, fontSize: 13, fontWeight: 600,
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)", zIndex: 9000,
          whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function UserCard({ u, isManager, onToggle, loading }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px",
      background: isManager ? "#F0FDF4" : "white",
      border: `1.5px solid ${isManager ? "#86EFAC" : "#E5E7EB"}`,
      borderRadius: 10,
    }}>
      {/* Avatar */}
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: isManager ? "#D1FAE5" : "#F3F4F6",
        border: `2px solid ${isManager ? "#6EE7B7" : "#E5E7EB"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, fontWeight: 700, color: isManager ? "#065F46" : GRAY,
        flexShrink: 0,
      }}>
        {u.nama?.slice(0, 1) || "?"}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: NAVY }}>{u.nama}</div>
        <div style={{ fontSize: 12, color: GRAY }}>
          {ROLE_LABELS[u.role] || u.role}
          {u.noWA && <span> · {u.noWA}</span>}
        </div>
      </div>

      {/* Toggle */}
      <button
        onClick={onToggle}
        disabled={loading}
        style={{
          padding: "7px 14px", borderRadius: 8, border: "none",
          background: isManager ? "#FEE2E2" : "#D1FAE5",
          color: isManager ? RED : GREEN,
          fontWeight: 700, fontSize: 12, cursor: loading ? "not-allowed" : "pointer",
          whiteSpace: "nowrap", flexShrink: 0,
          opacity: loading ? 0.6 : 1,
        }}>
        {loading ? "..." : isManager ? "Cabut Akses" : "Tunjuk"}
      </button>
    </div>
  );
}
