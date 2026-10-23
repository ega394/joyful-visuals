/**
 * src/lib/jejakKehadiran.js — jejak dan kabar perubahan kehadiran pimpinan
 *
 * Laporan Kabag 23 Oktober 2026 (Pembukaan Kemah Pramuka Madrasah): kartu
 * agenda menampilkan "Hadir: Asisten Pemerintahan dan Kesra", sedangkan
 * riwayat alur berhenti di "Wali Kota Diwakilkan — Sekda", dan tidak ada
 * yang dikabari. Penyebabnya:
 *   1. Riwayat hanya mencatat bila STATUS berubah. Mengganti pejabat yang
 *      mewakili (Sekda → Asisten) tidak mengubah status "diwakilkan",
 *      sehingga tidak tercatat.
 *   2. Pembatalan konfirmasi (status dikosongkan) tidak tercatat, sehingga
 *      "Tidak Hadir" tampak tercatat tiga kali berturut-turut.
 *   3. Catatan "Tidak Hadir" memakai nama perwakilan yang sudah usang.
 *   4. Kabar kepada Kabag/Kasubbag dikirim dari masing-masing tombol; sebagian
 *      layar (dasbor Wali Kota, pilihan pejabat, Admin RK) tidak mengirim apa pun.
 *
 * Berkas ini membandingkan keadaan kehadiran sebelum dan sesudah sebuah
 * perubahan — dari layar mana pun asalnya — untuk riwayat dan untuk kabar.
 */

const PIM = {
  wk:  { status: "statusWK",  wakil: "perwakilanWK",  label: "Wali Kota" },
  wwk: { status: "statusWWK", wakil: "perwakilanWWK", label: "Wakil Wali Kota" },
};

/** Keadaan kehadiran satu pimpinan: { status, wakil }. */
export function keadaanKehadiran(ev, pim) {
  const k = PIM[pim];
  const status = (ev && ev[k.status]) || "";
  let wakil = "";
  if (status === "diwakilkan") {
    wakil = pim === "wk" && ev.delegasiKeWWK ? "Wakil Wali Kota" : String(ev[k.wakil] || "").trim();
  }
  return { status, wakil };
}

/** Ringkasan untuk dibaca manusia, mis. "Diwakilkan kepada Sekda". */
export function labelKeadaan({ status, wakil }) {
  if (status === "hadir") return "Hadir";
  if (status === "tidak_hadir") return "Tidak Hadir";
  if (status === "diwakilkan") return wakil ? "Diwakilkan kepada " + wakil : "Diwakilkan (pejabat belum ditentukan)";
  return status ? status : "Belum dikonfirmasi";
}

/**
 * Perubahan kehadiran antara dua keadaan agenda.
 * jenis: "status" (status berganti) | "ganti_wakil" (tetap diwakilkan,
 * pejabatnya berganti) | "batal" (konfirmasi dikosongkan).
 */
export function perubahanKehadiran(lama, baru) {
  const out = [];
  for (const pim of ["wk", "wwk"]) {
    const a = keadaanKehadiran(lama || {}, pim);
    const b = keadaanKehadiran(baru || {}, pim);
    if (a.status === b.status && a.wakil === b.wakil) continue;
    if (!b.status) {
      if (a.status) out.push({ pim, jenis: "batal", dari: a, ke: b });
    } else if (b.status !== a.status) {
      out.push({ pim, jenis: "status", dari: a, ke: b });
    } else if (b.status === "diwakilkan" && b.wakil) {
      out.push({ pim, jenis: "ganti_wakil", dari: a, ke: b });
    }
  }
  return out;
}

const AKSI_STATUS = { hadir: "_hadir", tidak_hadir: "_tidak_hadir", diwakilkan: "_diwakilkan" };

/** Entri riwayat (`timeline`) untuk perubahan di atas. `base` = {actor, actor_role, at, …}. */
export function entriJejakKehadiran(perubahan, base) {
  return perubahan.map(({ pim, jenis, dari, ke }) => {
    if (jenis === "batal") {
      return { ...base, action: pim + "_batal", from: dari.status, to: null, note: "sebelumnya: " + labelKeadaan(dari) };
    }
    if (jenis === "ganti_wakil") {
      return { ...base, action: pim + "_ganti_wakil", from: dari.wakil || null, to: ke.wakil, note: (dari.wakil ? dari.wakil + " → " : "") + ke.wakil };
    }
    return { ...base, action: pim + (AKSI_STATUS[ke.status] || "_update"), from: dari.status || null, to: ke.status, note: ke.status === "diwakilkan" ? (ke.wakil || null) : null };
  });
}

/**
 * Tambahkan entri baru ke riwayat. Penggantian pejabat oleh orang yang sama
 * dalam 3 menit digabung menjadi satu entri ("Sekda → Asisten …"), supaya
 * mengetik nama tidak meninggalkan satu baris per huruf.
 */
export function gabungkanJejak(lama, baru, jendelaMs = 3 * 60000) {
  const hasil = [...(lama || [])];
  for (const e of baru || []) {
    const akhir = hasil[hasil.length - 1];
    // "Diwakilkan" hanya digabung bila namanya belum diisi; nama yang sudah
    // tercatat tidak ditimpa, supaya pergantian pejabat tetap terbaca.
    const bolehGabung = akhir && (akhir.action.endsWith("_ganti_wakil") || (akhir.action.endsWith("_diwakilkan") && !akhir.note));
    const gabung = bolehGabung && e.action.endsWith("_ganti_wakil") &&
      akhir.action.split("_")[0] === e.action.split("_")[0] && akhir.actor === e.actor &&
      Date.parse(e.at) - Date.parse(akhir.at) <= jendelaMs;
    if (gabung) {
      // "Diwakilkan" yang namanya baru diisi sesudahnya: cukup lengkapi namanya.
      if (akhir.action.endsWith("_diwakilkan")) hasil[hasil.length - 1] = { ...akhir, note: e.to, at: e.at };
      else hasil[hasil.length - 1] = { ...akhir, to: e.to, note: (akhir.from ? akhir.from + " → " : "") + e.to, at: e.at };
    } else hasil.push(e);
  }
  return hasil;
}

/**
 * Isi kabar untuk satu perubahan. kanal: "wa" bila menyangkut persiapan di
 * lapangan dan acaranya dekat (ditentukan pemanggil), selain itu "push".
 */
export function isiKabarKehadiran(ev, { pim, jenis, dari, ke }) {
  const label = PIM[pim].label;
  if (jenis === "batal") return { judul: "↩️ Konfirmasi " + label + " dibatalkan", isi: label + " belum dikonfirmasi lagi (sebelumnya: " + labelKeadaan(dari) + ")" };
  if (jenis === "ganti_wakil") return { judul: dari.wakil ? "🔁 Perwakilan " + label + " berganti" : "⚠️ Kehadiran " + label, isi: label + " kini diwakilkan kepada " + ke.wakil + (dari.wakil ? " (sebelumnya: " + dari.wakil + ")" : "") };
  const ikon = ke.status === "hadir" ? "✅ " : "⚠️ ";
  return { judul: ikon + "Kehadiran " + label, isi: label + ": " + labelKeadaan(ke) + (dari.status ? " (sebelumnya: " + labelKeadaan(dari) + ")" : "") };
}

export const LABEL_PIMPINAN = { wk: PIM.wk.label, wwk: PIM.wwk.label };
