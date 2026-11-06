"""Naskah bicara paparan finalis Lomba Inovasi Daerah Kota Tarakan 2026 (penyajian 15 menit).

Wawancara di Bappeda Litbang, Senin 9 November 2026 pukul 15.00–15.30 WITA:
penyajian materi 15 menit, pemutaran video 5 menit, tanya jawab 10 menit.

Disusun sebagai cerita empat bab yang bersambung (Masalah → Jalan keluar → Hasil →
Ke depan): dibuka dengan satu lembar disposisi yang tidak sampai, ditutup kembali
pada lembar itu. Kalimat terakhir setiap slide menjadi jembatan ke slide berikutnya.

Satu sumber untuk catatan pembicara PPTX (naskah-tarakan.json). Angka dan rumusan
sama persis dengan proposal Tarakan (data per 5 Oktober 2026 pukul 15.47 WITA).
Volume kegiatan mengikuti agenda Pimpinan, bukan karena aplikasi; yang ditegaskan,
aplikasi mencatat dan memfasilitasinya (keputusan Kabag, 6 November 2026).
Target ±14:00; teks dalam [[...]] boleh dilewati bila waktu mepet.
"""
import json, os

SLIDE = [
 dict(no=1, judul="Sampul", mulai="0:00", selesai="0:25",
  ucap=["Assalamualaikum warahmatullahi wabarakatuh. Selamat sore, Bapak dan Ibu Dewan Juri yang kami hormati.",
        "Izin kami memaparkan Prokopim Hibot, Superapp Pelayanan Keprotokolan dan Komunikasi Pimpinan Pemerintah Kota Tarakan, pada Kategori A, Inovasi Tata Kelola Pemerintahan. Izinkan kami memulainya dengan sebuah cerita."],
  isyarat="Jeda sejenak sebelum 'Izinkan kami memulainya dengan sebuah cerita'."),
 # ── BAB 1 · MASALAH ──
 dict(no=2, judul="Bab 1 — Lembar yang tidak sampai", mulai="0:25", selesai="1:10",
  ucap=["Januari 2026. Satu lembar disposisi agenda Pimpinan tidak ikut terfoto ketika berkasnya diteruskan di grup percakapan.",
        "Lembar itu tidak pernah sampai ke meja kami. Dan yang paling mengkhawatirkan: tidak ada satu pun yang dapat mengetahuinya.",
        "Tidak ada yang lalai dalam peristiwa itu. Semua orang bekerja dengan benar. Yang rapuh adalah rantainya.",
        "Pertanyaannya: bagaimana hal itu bisa terjadi?"],
  isyarat="Bicara pelan dan tenang. Bila ditanya jumlah lembarnya: cukup katakan satu lembar tidak ikut terfoto dan baru diketahui belakangan; jangan menyebut angka total."),
 dict(no=3, judul="Agenda padat, cara kerja manual", mulai="1:10", selesai="2:05",
  ucap=["Bagian Prokopim mengelola agenda dua Pimpinan Daerah yang memang padat. Sejak Maret sampai 5 Oktober 2026 tercatat 617 kegiatan, rata-rata 91 setiap bulan, dan hampir separuhnya kegiatan sambutan yang memerlukan naskah. Volume ini adalah beban kerja yang nyata, dan memang demikian adanya.",
        "Sebelum Maret 2026, semua itu dikerjakan secara manual. Rencana kegiatan disusun di spreadsheet lalu dicetak. Penelaahan hanya sempat sekitar 30 menit menjelang jam pulang. Kegiatan mendesak berarti cetak ulang. Disposisi beredar sebagai foto, dan penugasan petugas bergantung pada ingatan.",
        "Jadi masalahnya bukan pada orang, tetapi pada rantainya."]),
 dict(no=4, judul="Akar masalah", mulai="2:05", selesai="2:50",
  ucap=["Kami menelaah seluruh alur kerja dan menemukan satu akar masalah: tidak tersedianya satu sumber data yang sahih dan dapat dirujuk semua pihak.",
        "Dari akar itu tumbuh lima persoalan: penelaahan terikat jendela waktu, keputusan tidak meninggalkan jejak, versi dokumen beredar ganda, pengetahuan kerja melekat pada orang, dan layanan publik tanpa kanal yang dapat ditelusuri.",
        "Persoalannya tersebar di kertas, spreadsheet, grup percakapan, papan tulis, dan telepon. Memperbaiki satu saluran tidak menyelesaikan yang lain. Jawabannya harus satu wadah dengan satu data: sebuah superapp.",
        "Lalu, pilihan apa yang kami punya?"]),
 # ── BAB 2 · JALAN KELUAR ──
 dict(no=5, judul="Bab 2 — Memilih membangun sendiri", mulai="2:50", selesai="3:35",
  ucap=["Idenya tidak lahir dari survei, tetapi dari pekerjaan sehari-hari: banyaknya pintu masuk agenda, peristiwa Januari itu, dan telaah bersama seluruh Bagian.",
        "Kami menimbang empat pilihan. Menambah pengawasan tidak menyentuh akar masalah, karena peristiwa Januari justru terjadi ketika semua sudah bekerja dengan benar. Memperbaiki spreadsheet tetap menyisakan banyak versi. Mengadakan aplikasi jadi memerlukan anggaran, padahal alur keprotokolan sangat khas.",
        "Maka kami memilih membangun sendiri: satu sumber data dan jejak audit, tanpa anggaran pengadaan. Untuk melihat cara kerjanya, mari kita ikuti satu undangan."]),
 dict(no=6, judul="Perjalanan satu undangan", mulai="3:35", selesai="4:35",
  ucap=["Sebuah undangan datang. Admin Rencana Kegiatan cukup memindainya; formulir terisi sendiri, dan aplikasi memeriksa apakah ada benturan dengan jadwal Pimpinan.",
        "Kepala Sub Bagian Protokol menelaahnya dari ponsel, di mana pun berada. Kepala Bagian memutus, dan tombol setuju baru menyala setelah daftar periksa dicentang. Begitu sampai di Kepala Bagian, keputusan rata-rata hanya memerlukan 8 menit.",
        "Saat itu juga, agenda tiba di HP Wali Kota. Beliau cukup menekan hadir, atau mendisposisikannya kepada Wakil Wali Kota. Petugas ditugaskan dan langsung dikabari lewat WhatsApp.",
        "Dari pengajuan sampai tayang, median waktunya 1,94 jam. Dan satu undangan ternyata menyentuh banyak urusan."]),
 dict(no=7, judul="Sebelas urusan, satu data", mulai="4:35", selesai="5:25",
  ucap=["Di balik satu undangan ada penugasan petugas, naskah sambutan, peliputan, undangan rapat, ruangan, hingga daftar hadir. Karena itu Prokopim Hibot menyatukan sebelas alur kerja, masing-masing berdasar tugas pada Perwali 50 Tahun 2021.",
        "Setiap peran membuka aplikasi yang sama dan melihat yang menjadi haknya: Pimpinan, ajudan, pejabat struktural, petugas, serta masyarakat dan instansi. [[Aplikasi ini tersambung ke Google Calendar bersama, notifikasi WhatsApp, undangan siap tanda tangan elektronik Srikandi, dan daftar hadir di spreadsheet instansi.]]",
        "Yang membuatnya berbeda dari aplikasi agenda biasa adalah jejaknya."]),
 dict(no=8, judul="Setiap langkah meninggalkan jejak", mulai="5:25", selesai="6:20",
  ucap=["Setiap langkah tercatat: siapa, kapan, dan apa keputusannya. Sampai 5 Oktober, 3.331 peristiwa terekam pada jejak audit.",
        "Tombol persetujuan baru aktif setelah daftar periksa dicentang. Bila pejabat berhalangan, Pelaksana Harian melanjutkan alurnya, dan kewenangannya padam sendiri pada tanggal akhir tugasnya. Usulan perubahan jadwal diawasi menurut kegentingannya.",
        "[[Selain itu, kanal publik dapat ditelusuri dengan kode, kalender bersama terisi otomatis, data pribadi dilindungi sejak formulir, dan setiap pesan WhatsApp dapat diperiksa.]] Inilah jawaban kami atas peristiwa Januari: kini setiap langkah dapat diketahui dan ditelusuri."],
  isyarat="Tunjuk tangkapan Riwayat Alur di kanan saat menyebut 'siapa, kapan, dan apa keputusannya'."),
 dict(no=9, judul="Berjalan sejak Maret 2026", mulai="6:20", selesai="7:05",
  ucap=["Aplikasi ini mulai digunakan Maret 2026; kegiatan pertama tercatat 9 Maret. Fiturnya tumbuh bertahap mengikuti kebutuhan: jejak audit pada Mei, audiensi dan daftar hadir pada Juli dan Agustus, Pelaksana Harian dan daftar periksa pada September.",
        "Penggunaannya dikuatkan Surat Sekretaris Daerah tanggal 12 Maret 2026 dan Keputusan Sekretaris Daerah tentang Tim Koordinasi. Per 1 Oktober, inovasi ini telah berjalan 6 bulan 22 hari, dengan sebelas SOP dan lebih dari 140 pembaruan yang sebagian besar berangkat dari kendala pengguna.",
        "Dan semuanya kami kerjakan tanpa belanja pengadaan."]),
 dict(no=10, judul="Sumber daya dan kolaborasi", mulai="7:05", selesai="7:50",
  ucap=["Pengembangannya swakelola oleh Ketua Tim. Peladen, basis data, kalender, dan perangkat memakai kuota tanpa biaya; hanya gerbang pesan WhatsApp yang berlangganan.",
        "Ketika lalu lintas data sempat 6,4 gigabita per bulan, melampaui kuota 5 gigabita, kami mengubah cara pengambilan data hingga turun menjadi sekitar 1 gigabita.",
        "Kami tidak bekerja sendiri: ada Tim Koordinasi 42 orang termasuk para Sekretaris Dinas, DKISP yang memfasilitasi alamat resmi, dan Bappeda Litbang sebagai pengampu inovasi daerah.",
        "Lalu, apa hasilnya?"]),
 # ── BAB 3 · HASIL ──
 dict(no=11, judul="Bab 3 — Dari hari menjadi jam", mulai="7:50", selesai="9:00",
  ucap=["Dulu, dari undangan masuk sampai tercantum di agenda diperkirakan butuh 18 sampai 24 jam. Kini median waktunya 1,94 jam, sekitar 9 sampai 12 kali lebih cepat, dan 99,3 persen tayang kurang dari sehari.",
        "Hambatannya ternyata ada pada jendela waktu, bukan pada pengambilan keputusan. 47,9 persen penelaahan kini terjadi di luar jam kerja. 92,5 persen kegiatan memiliki petugas yang tercatat, dan 29 kegiatan dikembalikan untuk diperbaiki sebelum ditetapkan.",
        "Grafik di bawah ini adalah volume kegiatan Pimpinan setiap bulan. Jumlahnya mengikuti agenda Wali Kota dan Wakil Wali Kota; yang ingin kami tegaskan, aplikasi ini telah mencatat dan menjadi sarana utama dalam memfasilitasi 617 kegiatan tersebut, tanpa belanja pengadaan.",
        "Bagi Pimpinan, semua ini bermuara pada satu kata: kepastian."],
  isyarat="Angka 'sebelum' adalah estimasi dari alur lama; bila ditanya, jelaskan dasar estimasinya: menunggu jendela periksa ±8 jam lalu disposisi malam atau pagi harinya."),
 dict(no=12, judul="Kepastian bagi Pimpinan", mulai="9:00", selesai="9:55",
  ucap=["Bapak Wali Kota menyampaikan kepada kami: yang terpenting bagi beliau adalah kepastian, ke mana harus hadir, kapan, dan siapa yang menyiapkannya.",
        "Agenda yang telah disetujui kini beliau lihat langsung di telepon genggam, selalu dalam keadaan terbaru. 67 kegiatan telah beliau disposisikan kepada Wakil Wali Kota langsung dari aplikasi, dan ajudan telah mengonfirmasi kehadiran sebanyak 386 kali.",
        "Masyarakat dan instansi pun merasakannya: 129 pengajuan ruangan dari 68 instansi, dan 59 permohonan audiensi dari 55 instansi, 31 di antaranya menjadi agenda Pimpinan.",
        "Dan karena semuanya kini berada dalam satu data, ada bonus yang tidak kami rencanakan sejak awal."]),
 dict(no=13, judul="Bonus pertama: monitoring internal", mulai="9:55", selesai="10:50",
  ucap=["Bonus pertama adalah pemantauan internal. Monitor WA memperlihatkan setiap pesan yang dikirim aplikasi: terkirim, sampai di HP, atau dibaca. Bila perangkat gerbang pesan terputus atau tiga pesan berturut-turut gagal, pejabat langsung diberi peringatan, dan pesan yang gagal dapat dikirim ulang sekaligus.",
        "Kepala Bagian memantau usulan perubahan menurut kegentingannya, menelusuri Riwayat Alur setiap jadwal, dan menerima ringkasan terjadwal setiap pagi dan sore. [[Isi pesan dihapus otomatis sesudah 90 hari dan nomor penerima disamarkan.]]",
        "Bonus kedua: kinerja yang terbaca setiap hari."]),
 dict(no=14, judul="Bonus kedua: kinerja dan evaluasi", mulai="10:50", selesai="11:55",
  ucap=["Setiap petugas mengisi evaluasi pasca kegiatan, dengan lima butir yang berbeda untuk protokol dan dokumentasi. Sudah 341 kegiatan, atau 55,3 persen, dievaluasi oleh petugasnya.",
        "Hasilnya diolah menjadi Rekap Evaluasi Kinerja per tim, serta Rekap Penugasan Bulanan yang menghasilkan bukti dukung kinerja pegawai untuk e-Kinerja.",
        "Yang siap diterapkan berikutnya adalah menu Indikator Kinerja Bagian Prokopim. Ketepatan waktu layanan komunikasi pimpinan sudah dihitung otomatis: naskah sambutan paling lambat 24 jam sebelum acara, dan berita paling lambat 24 jam sesudah acara. Indikator kepuasan Pimpinan dan standar keprotokolan menyusul pada tahap berikutnya.",
        "Artinya, kinerja Bagian tidak lagi disusun manual pada akhir tahun, tetapi terbaca kapan saja. Ke mana semua ini bermuara?"],
  isyarat="Sebut menu Indikator Kinerja sebagai 'siap diterapkan', bukan 'sudah berjalan'."),
 # ── BAB 4 · KE DEPAN ──
 dict(no=15, judul="Bab 4 — Untuk Tarakan yang HIBOT", mulai="11:55", selesai="12:40",
  ucap=["Semua ini bermuara pada Misi 4 RPJMD Kota Tarakan 2025–2029: tata kelola pemerintahan yang adaptif, responsif, dan menjaga stabilitas.",
        "Ketujuh unsur Kategori A terjawab langsung, dari tata kelola, proses bisnis, dan digitalisasi, sampai data, manajemen, pengawasan, dan efisiensi.",
        "Dan namanya mengusung semboyan kota kita, Tarakan HIBOT: Handal, Inovatif, Berbudaya, Unggul, dan Tangguh. Kami ingin inovasi ini tidak berhenti di kami."]),
 dict(no=16, judul="Keberlanjutan dan replikasi", mulai="12:40", selesai="13:35",
  ucap=["Karena itu kami memastikan inovasi ini tidak bergantung pada anggaran maupun pada satu orang. Biaya berjalannya mendekati nol, kewenangan melekat pada jabatan sehingga mutasi pejabat tidak memutus alur, dan prosedurnya dibakukan dalam sebelas SOP.",
        "Rencananya: pengesahan SOP pada Oktober sampai Desember 2026, pendampingan pengelola kedua pada semester pertama 2027, lalu paket replikasi pada semester kedua 2027.",
        "Karena setiap pemerintah daerah memiliki tugas keprotokolan, inovasi ini dapat ditiru utuh atau per modul, dari Sekretariat DPRD sampai pemerintah daerah lain, dimulai dari Kalimantan Utara."]),
 dict(no=17, judul="Penutup", mulai="13:35", selesai="14:05",
  ucap=["Bapak dan Ibu Juri, kami memulai dengan satu lembar disposisi yang tidak sampai, dan tidak ada yang tahu.",
        "Kini, setiap agenda punya satu data, dan setiap keputusan tercatat. Inovasi berdampak, Tarakan maju dan berdaya saing.",
        "Aplikasinya dapat dibuka di prokopim.tarakankota.go.id. Selanjutnya izin kami memutar video inovasi. Terima kasih. Wassalamualaikum warahmatullahi wabarakatuh."],
  isyarat="Kalimat pertama diucapkan pelan; beri jeda sebelum 'Kini'."),
 dict(no=18, judul="Cadangan: pembaruan sejak proposal", mulai="—", selesai="—",
  ucap=["Slide cadangan, hanya bila ditanya. Proposal memuat keadaan per 5 Oktober 2026; pembaruan berikut berangkat dari pemakaian dan masukan pengguna."],
  isyarat="Pengingat kini tiga waktu (06.30, 07.30, 16.00) ditambah kabar seketika; proposal masih menulis lima kali sehari karena itulah keadaan saat itu. Modul yang belum optimal (proposal 9.7): baru 3 naskah sambutan disahkan lewat aplikasi karena Pimpinan lebih nyaman naskah tercetak; aplikasi menyesuaikan cara kerja Pimpinan."),
]


def catatan(s):
    teks = "\n\n".join(s["ucap"])
    if s.get("isyarat"):
        teks += "\n\n[Isyarat] " + s["isyarat"]
    return f"[{s['mulai']}–{s['selesai']}] {s['judul']}\n\n" + teks


if __name__ == "__main__":
    out = {str(s["no"]): catatan(s) for s in SLIDE}
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "naskah-tarakan.json")
    json.dump(out, open(p, "w"), ensure_ascii=False, indent=1)
    kata = sum(len(" ".join(s["ucap"]).replace("[[", "").replace("]]", "").split()) for s in SLIDE if s["no"] <= 17)
    print("tersimpan", p, "·", kata, "kata ≈", round(kata / 110, 1), "menit pada 110 kata/menit")
