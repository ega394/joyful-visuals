// src/lib/statusColors.js
// Token warna semantik tunggal yang dipakai semua dashboard.
// Tujuan: status yang sama selalu tampil dengan warna & nuansa yang sama
// di seluruh aplikasi (ProkopimApp, GuestDashboard, dsb.).

export const SEMANTIC = {
  draft:    { color: "#475569", bg: "#F1F5F9", bar: "#94A3B8", border: "#E2E8F0" },
  info:     { color: "#1D4ED8", bg: "#EFF6FF", bar: "#3B82F6", border: "#BFDBFE" },
  pending:  { color: "#92400E", bg: "#FEF3C7", bar: "#F59E0B", border: "#FDE68A" },
  review:   { color: "#5B21B6", bg: "#EDE9FE", bar: "#7C3AED", border: "#DDD6FE" },
  approved: { color: "#065F46", bg: "#D1FAE5", bar: "#10B981", border: "#A7F3D0" },
  rejected: { color: "#991B1B", bg: "#FEE2E2", bar: "#EF4444", border: "#FECACA" },
};

// Status workflow jadwal (ProkopimApp): draft → menunggu_kasubbag → menunggu_kabag → disetujui/ditolak
export const JADWAL_STATUS = {
  draft:             { label: "Draft",             ...SEMANTIC.draft },
  menunggu_kasubbag: { label: "Menunggu Kasubbag", ...SEMANTIC.pending },
  menunggu_kabag:    { label: "Menunggu Kabag",    ...SEMANTIC.review },
  disetujui:         { label: "Disetujui",         ...SEMANTIC.approved },
  ditolak:           { label: "Ditolak",           ...SEMANTIC.rejected },
};

// Status alur tamu (GuestDashboard): pending_rk → pending_kasubbag → pending_kabag → pending_pimpinan → approved/rejected
export const TAMU_STATUS = {
  pending_rk:       { label: "Baru Masuk",   ...SEMANTIC.draft },
  pending_kasubbag: { label: "Di Kasubbag",  ...SEMANTIC.info },
  pending_kabag:    { label: "Di Kabag",     ...SEMANTIC.pending },
  pending_pimpinan: { label: "Di Pimpinan",  ...SEMANTIC.review },
  approved:         { label: "Disetujui",    ...SEMANTIC.approved },
  rejected:         { label: "Ditolak",      ...SEMANTIC.rejected },
  disposed:         { label: "Didisposisi",  ...SEMANTIC.draft },
};

export const PRIORITY_COLORS = {
  mendesak: { label: "Mendesak", icon: "⚡", dot: SEMANTIC.rejected.bar, bg: SEMANTIC.rejected.bg, color: SEMANTIC.rejected.color },
  penting:  { label: "Penting",  icon: "⭐", dot: SEMANTIC.pending.bar,  bg: SEMANTIC.pending.bg,  color: SEMANTIC.pending.color },
  biasa:    { label: "Biasa",    icon: "📌", dot: SEMANTIC.approved.bar, bg: SEMANTIC.approved.bg, color: SEMANTIC.approved.color },
};
