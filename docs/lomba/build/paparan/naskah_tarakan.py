"""Naskah bicara paparan finalis Lomba Inovasi Daerah Kota Tarakan 2026 (penyajian 15 menit).

Wawancara di Bappeda Litbang, Senin 9 November 2026 pukul 15.00–15.30 WITA:
penyajian materi 15 menit, pemutaran video 5 menit, tanya jawab 10 menit (undangan).
Kriteria Tahap II (Pedoman 3.5): penguasaan substansi dan konsistensi 30%, kejelasan
komunikasi 20%, demonstrasi 20%, kelayakan dan keberlanjutan 15%, jawaban 15%.

Disusun sebagai cerita empat bab yang bersambung (Masalah → Jalan keluar → Hasil →
Ke depan): dibuka dengan satu lembar disposisi yang tidak sampai, ditutup kembali
pada lembar itu. Kalimat terakhir setiap slide menjadi jembatan ke slide berikutnya.
Demonstrasi ±3 menit di slide 17.

Satu sumber untuk catatan pembicara PPTX (naskah-tarakan.json); nomor mengikuti
urutan slide. Angka dan rumusan sama dengan proposal Tarakan (5 Oktober 2026).
Volume kegiatan mengikuti agenda Pimpinan, bukan karena aplikasi; yang ditegaskan,
aplikasi mencatat dan memfasilitasinya (keputusan Kabag, 6 November 2026).
Teks dalam [[...]] boleh dilewati bila waktu mepet.
"""
import json, os

SLIDE = [
 dict(no=1, judul="Sampul", mulai="0:00", selesai="0:20",
  ucap=["Assalamualaikum warahmatullahi wabarakatuh. Selamat sore, Bapak dan Ibu Dewan Juri yang kami hormati.",
        "Izin kami memaparkan Prokopim Hibot, Superapp Pelayanan Keprotokolan dan Komunikasi Pimpinan, pada Kategori A, Inovasi Tata Kelola Pemerintahan. Izinkan kami memulainya dengan sebuah cerita."]),
 # ── BAB 1 · MASALAH ──
 dict(no=2, judul="Bab 1 — Lembar yang tidak sampai", mulai="0:20", selesai="1:00",
  ucap=["Januari 2026. Berkas disposisi agenda Pimpinan diteruskan sebagai foto di grup percakapan. Lembar rencana kegiatan ini terfoto dan sampai kepada kami.",
        "Tetapi lembar rencana audiensi ini tidak ikut terfoto. Ia tidak pernah sampai ke meja kami, dan tidak ada satu pun yang dapat mengetahuinya.",
        "Tidak ada yang lalai. Yang rapuh adalah rantainya. Bagaimana hal itu bisa terjadi?"],
  isyarat="Tunjuk lembar atas saat 'sampai', lembar bawah (bingkai merah) saat 'tidak ikut terfoto'. Bila ditanya jumlah lembarnya: cukup katakan satu lembar tidak ikut terfoto dan baru diketahui belakangan; jangan menyebut angka total."),
 dict(no=3, judul="Agenda padat, cara kerja manual", mulai="1:00", selesai="1:40",
  ucap=["Agenda dua Pimpinan Daerah memang padat. Sejak Maret sampai 5 Oktober tercatat 617 kegiatan, rata-rata 91 setiap bulan, dan hampir separuhnya kegiatan sambutan. Volume itu beban kerja yang nyata, memang demikian adanya.",
        "Dulu semuanya manual: rencana kegiatan dicetak dari spreadsheet, penelaahan hanya sekitar 30 menit menjelang jam pulang, disposisi beredar sebagai foto, dan penugasan bergantung pada ingatan. Masalahnya bukan pada orang, tetapi pada rantainya."]),
 dict(no=4, judul="Akar masalah", mulai="1:40", selesai="2:15",
  ucap=["Akarnya satu: tidak ada satu sumber data yang sahih dan dapat dirujuk semua pihak. Dari sana tumbuh lima persoalan, dari penelaahan yang terikat jendela waktu sampai layanan publik yang tidak dapat ditelusuri.",
        "Karena persoalannya tersebar di kertas, spreadsheet, grup percakapan, papan tulis, dan telepon, jawabannya harus satu wadah dengan satu data: superapp. Lalu, pilihan apa yang kami punya?"]),
 # ── BAB 2 · JALAN KELUAR ──
 dict(no=5, judul="Bab 2 — Memilih membangun sendiri", mulai="2:15", selesai="2:50",
  ucap=["Ide ini lahir dari pekerjaan sehari-hari, bukan survei. Menambah pengawasan tidak menyentuh akar masalah. Memperbaiki spreadsheet tetap menyisakan banyak versi. Membeli aplikasi jadi memerlukan anggaran, padahal alur keprotokolan sangat khas.",
        "Maka kami membangun sendiri: satu data dan jejak audit, tanpa anggaran pengadaan. Mari kita ikuti satu undangan."]),
 dict(no=6, judul="Perjalanan satu undangan", mulai="2:50", selesai="3:35",
  ucap=["Undangan datang; admin cukup memindainya, formulir terisi dan benturan jadwal diperiksa. Kepala Sub Bagian menelaah dari ponsel. Kepala Bagian memutus, dan tombol setuju baru menyala setelah daftar periksa dicentang; keputusannya rata-rata 8 menit.",
        "Saat itu juga agenda tiba di HP Wali Kota: hadir, atau disposisi kepada Wakil Wali Kota. Petugas langsung dikabari lewat WhatsApp. Median dari pengajuan sampai tayang: 1,94 jam."]),
 dict(no=7, judul="Sebelas urusan, satu data", mulai="3:35", selesai="4:05",
  ucap=["Satu undangan ternyata menyentuh sebelas urusan, dari penetapan jadwal sampai evaluasi kinerja, masing-masing berdasar tugas pada Perwali 50 Tahun 2021. Setiap peran membuka aplikasi yang sama dan melihat yang menjadi haknya.",
        "Di balik satu undangan itu, banyak modul bekerja."]),
 dict(no=8, judul="Modul layanan", mulai="4:05", selesai="4:45",
  ucap=["Bila Pimpinan mengundang rapat, Generator Undangan menyusun PDF yang siap ditandatangani elektronik di Srikandi, sekaligus memeriksa dan memesan ruang rapat Imbaya atau Kenawai.",
        "Instansi meminjam ruangan lewat kalender ketersediaan yang terbuka untuk umum; sudah 129 pengajuan dari 68 instansi. Di hari acara, daftar hadir cukup dengan memindai kode QR dan tanda tangan di layar. [[Permohonan audiensi yang disetujui pun otomatis menjadi agenda.]]"]),
 dict(no=9, judul="Modul komunikasi dan laporan", mulai="4:45", selesai="5:20",
  ucap=["Naskah sambutan disusun, diperiksa, dan disahkan dalam satu alur. Tim dokumentasi dibantu AI Newsroom untuk merancang keterangan foto dan berita, yang tetap wajib disunting petugas.",
        "Laporan mingguan dan bulanan, rekap WhatsApp harian, sampai uraian e-Kinerja petugas tersusun dari data yang sama. Yang membuat semuanya bisa dipercaya adalah jejaknya."]),
 dict(no=10, judul="Setiap langkah meninggalkan jejak", mulai="5:20", selesai="6:00",
  ucap=["Setiap langkah tercatat: siapa, kapan, dan apa keputusannya; 3.331 peristiwa terekam. Daftar periksa wajib menahan kekeliruan sebelum sampai ke Pimpinan. Pelaksana Harian melanjutkan alur saat pejabat berhalangan, dan kewenangannya padam sendiri pada tanggal akhirnya.",
        "Inilah jawaban kami atas peristiwa Januari: kini setiap langkah dapat diketahui dan ditelusuri."],
  isyarat="Tunjuk tangkapan Riwayat Alur di kanan."),
 dict(no=11, judul="Berjalan sejak Maret 2026", mulai="6:00", selesai="6:30",
  ucap=["Aplikasi ini digunakan sejak 9 Maret 2026, dikuatkan Surat dan Keputusan Sekretaris Daerah. Per 1 Oktober telah berjalan 6 bulan 22 hari, dengan sebelas SOP dan lebih dari 140 pembaruan dari kendala pengguna. Semuanya tanpa belanja pengadaan."]),
 dict(no=12, judul="Sumber daya dan kolaborasi", mulai="6:30", selesai="7:05",
  ucap=["Pengembangannya swakelola; peladen, basis data, kalender, dan perangkat memakai kuota tanpa biaya, hanya gerbang pesan WhatsApp yang berlangganan. Ketika lalu lintas data sempat melampaui kuota, kami merampingkannya dari 6,4 menjadi sekitar 1 gigabita.",
        "Kami didukung Tim Koordinasi 42 orang, DKISP, dan Bappeda Litbang. Lalu, apa hasilnya?"]),
 # ── BAB 3 · HASIL ──
 dict(no=13, judul="Bab 3 — Dari hari menjadi jam", mulai="7:05", selesai="7:55",
  ucap=["Dari undangan masuk sampai tercantum di agenda, yang dulu diperkirakan 18 sampai 24 jam, kini median 1,94 jam, 9 sampai 12 kali lebih cepat; 99,3 persen tayang kurang dari sehari. 47,9 persen penelaahan terjadi di luar jam kerja, dan 92,5 persen kegiatan memiliki petugas tercatat.",
        "Grafik ini volume kegiatan Pimpinan setiap bulan. Jumlahnya mengikuti agenda Wali Kota dan Wakil Wali Kota; yang kami tegaskan, aplikasi ini telah mencatat dan menjadi sarana utama memfasilitasi 617 kegiatan tersebut. Bagi Pimpinan, artinya kepastian."]),
 dict(no=14, judul="Kepastian bagi Pimpinan", mulai="7:55", selesai="8:35",
  ucap=["Bapak Wali Kota menyampaikan: yang terpenting bagi beliau adalah kepastian, ke mana harus hadir, kapan, dan siapa yang menyiapkannya. 67 kegiatan telah beliau disposisikan kepada Wakil Wali Kota dari aplikasi, dan ajudan mengonfirmasi kehadiran 386 kali.",
        "Publik pun merasakannya: 68 instansi meminjam ruangan dan 55 instansi mengajukan audiensi secara daring. Dan dari data yang sama, ada bonusnya."]),
 dict(no=15, judul="Bonus pertama: monitoring internal", mulai="8:35", selesai="9:10",
  ucap=["Bonus pertama: pemantauan internal. Monitor WA memperlihatkan setiap pesan: terkirim, sampai di HP, atau dibaca. Bila perangkat gerbang pesan terputus atau pesan gagal beruntun, pejabat langsung diberi peringatan dan pesan dapat dikirim ulang sekaligus.",
        "Kepala Bagian juga memantau usulan perubahan menurut kegentingannya dan menelusuri Riwayat Alur setiap jadwal."]),
 dict(no=16, judul="Bonus kedua: beban kerja dan kinerja", mulai="9:10", selesai="9:55",
  ucap=["Bonus kedua: beban kerja dan kinerja terbaca setiap hari. Sebaran penugasan tiap personil terlihat sehingga tugas dapat dibagi merata, dan Rekap Penugasan Bulanan menjadi bukti dukung e-Kinerja.",
        "Petugas mengisi evaluasi pasca kegiatan; sudah 341 kegiatan dievaluasi. Yang siap diterapkan berikutnya adalah menu Indikator Kinerja Bagian, yang menghitung otomatis ketepatan waktu naskah sambutan dan berita. Mari kita lihat langsung."],
  isyarat="Sebut menu Indikator Kinerja 'siap diterapkan', bukan 'sudah berjalan'."),
 dict(no=17, judul="DEMONSTRASI (±3 menit)", mulai="9:55", selesai="12:55",
  ucap=["(1) Admin memindai undangan · 0:00–0:35 — \"Undangan dipindai; nama acara, tanggal, jam, lokasi, dan zona waktunya terisi sendiri, dan benturan jadwal diperiksa.\"",
        "(2) Telaah dan persetujuan · 0:35–1:15 — \"Kasubbag menerima notifikasi; tombol teruskan baru aktif setelah daftar periksa dicentang. Kabag menyetujui, agenda langsung tayang.\"",
        "(3) HP Pimpinan · 1:15–1:55 — \"Agenda tiba di HP Wali Kota; cukup tekan hadir, atau disposisi kepada Wakil Wali Kota.\"",
        "(4) Riwayat Alur · 1:55–2:25 — \"Setiap langkah tadi tercatat: siapa, kapan, apa keputusannya.\"",
        "(5) Monitor WA dan rekap · 2:25–3:00 — \"Pesan penugasan terkirim dan terbaca; sebaran beban personil terlihat. Kini setiap pesan dan langkah dapat diketahui.\""],
  isyarat="Pakai akun asli (keputusan Kabag). Agar tidak mengirim kabar sungguhan: pindai undangan sampai formulir terisi lalu batalkan, jangan diajukan; persetujuan, HP Pimpinan, Riwayat Alur, Monitor WA, dan rekap ditunjukkan pada kegiatan yang sudah ada tanpa menekan setuju, hadir, disposisi, atau tugaskan. Kabag memandu; anggota tim mengoperasikan. Bila jaringan atau aplikasi bermasalah lebih dari 10 detik, putar rekaman peragaan cadangan. Bila waktu mepet, ringkas menjadi langkah 1, 3, dan 4."),
 # ── BAB 4 · KE DEPAN ──
 dict(no=18, judul="Bab 4 — Untuk Tarakan yang HIBOT", mulai="12:55", selesai="13:20",
  ucap=["Semua ini bermuara pada Misi 4 RPJMD: tata kelola yang adaptif, responsif, dan menjaga stabilitas. Ketujuh unsur Kategori A terjawab, dan namanya mengusung semboyan Tarakan HIBOT. Kami ingin inovasi ini tidak berhenti di kami."]),
 dict(no=19, judul="Keberlanjutan dan risiko", mulai="13:20", selesai="13:55",
  ucap=["Biaya berjalannya mendekati nol, kewenangan melekat pada jabatan, dan prosedurnya dibakukan dalam sebelas SOP. Risiko terbesarnya, ketergantungan pada satu pengembang, kami jawab dengan SOP, kode dan riwayat yang tersimpan, akun atas nama instansi, serta pengelola kedua pada 2027."]),
 dict(no=20, judul="Diseminasi dan replikasi", mulai="13:55", selesai="14:25",
  ucap=["Inovasi ini sudah dipakai di luar Bagian: 21 akun Pimpinan, ajudan, dan mitra, serta 68 dan 55 instansi lewat kanal publik. Karena setiap pemerintah daerah memiliki tugas keprotokolan, ia siap ditiru utuh atau per modul, dimulai dari Kalimantan Utara."]),
 dict(no=21, judul="Penutup", mulai="14:25", selesai="14:50",
  ucap=["Kami memulai dengan satu lembar disposisi yang tidak sampai, dan tidak ada yang tahu. Kini, setiap agenda punya satu data, dan setiap keputusan tercatat.",
        "Inovasi berdampak, Tarakan maju dan berdaya saing. Selanjutnya izin kami memutar video inovasi. Terima kasih. Wassalamualaikum warahmatullahi wabarakatuh."],
  isyarat="Kalimat pertama pelan; jeda sebelum 'Kini'."),
 dict(no=22, judul="Cadangan: pembaruan sejak proposal", mulai="—", selesai="—",
  ucap=["Slide cadangan, hanya bila ditanya. Proposal memuat keadaan per 5 Oktober 2026; pembaruan berikut berangkat dari pemakaian dan masukan pengguna."],
  isyarat="Pengingat kini tiga waktu (06.30, 07.30, 16.00) ditambah kabar seketika; proposal masih menulis lima kali sehari karena itulah keadaan saat itu. Modul yang belum optimal (proposal 9.7): baru 3 naskah sambutan disahkan lewat aplikasi karena Pimpinan lebih nyaman naskah tercetak."),
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
    kata = sum(len(" ".join(s["ucap"]).replace("[[", "").replace("]]", "").split()) for s in SLIDE if s["no"] <= 21 and s["no"] != 17)
    print("tersimpan", p, "·", kata, "kata di luar demo ≈", round(kata / 110, 1), "menit pada 110 kata/menit + demo ±3 menit")
