import React, { useState } from "react";
import { HUT, hutAktif } from "../lib/hut.js";

/**
 * Logo HUT Kota Tarakan, hanya selama periode HUT (lib/hut.js). Bila berkas
 * gagal dimuat, logo cukup tidak tampil — tata letak di sekitarnya tetap.
 * varian: "putih" untuk latar gelap, "warna" untuk latar terang.
 */
export default function LogoHUT({ varian = "putih", tinggi = 56, style }) {
  const [gagal, setGagal] = useState(false);
  if (gagal || !hutAktif()) return null;
  return (
    <img src={HUT[varian] || HUT.putih} alt={HUT.judul} title={HUT.judul}
      onError={() => setGagal(true)}
      style={{ height: tinggi, width: "auto", objectFit: "contain", flexShrink: 0, ...style }} />
  );
}
