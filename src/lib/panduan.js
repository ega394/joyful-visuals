// Buku petunjuk dan panduan pemohon (PDF di public/panduan, dibuat dengan
// docs/lomba/build/panduan). Tidak ikut disimpan untuk mode luring karena
// ukurannya besar; navigasi ke /panduan/ dikecualikan dari service worker.
export const PANDUAN = {
  aplikasi: "/panduan/Buku-Petunjuk-Prokopim-Hibot.pdf",
  audiensi: "/panduan/Panduan-Permohonan-Audiensi.pdf",
  ruangan:  "/panduan/Panduan-Peminjaman-Ruang-Rapat.pdf",
};

export const bukaPanduan = (jenis) => window.open(PANDUAN[jenis], "_blank", "noopener");
