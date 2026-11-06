"""Naskah bicara paparan finalis Lomba Inovasi Daerah Kota Tarakan 2026 (penyajian 15 menit).

Wawancara di Bappeda Litbang, Senin 9 November 2026 pukul 15.00–15.30 WITA:
penyajian materi 15 menit, pemutaran video 5 menit, tanya jawab 10 menit.

Satu sumber untuk catatan pembicara PPTX (naskah-tarakan.json). Angka dan rumusan
sama persis dengan proposal Tarakan (data per 5 Oktober 2026 pukul 15.47 WITA).
Yang dibangun sesudah proposal disebut "pembaruan sejak proposal".
Target 14:00; teks dalam [[...]] boleh dilewati bila waktu mepet.
"""
import json, os

SLIDE = [
 dict(no=1, judul="Pembuka", mulai="0:00", selesai="0:30",
  ucap=["Assalamualaikum warahmatullahi wabarakatuh. Selamat sore, Bapak dan Ibu Dewan Juri yang kami hormati.",
        "Izin kami memaparkan Prokopim Hibot, Superapp Pelayanan Keprotokolan dan Komunikasi Pimpinan Pemerintah Kota Tarakan, pada Kategori A, Inovasi Tata Kelola Pemerintahan. Kami dari Bagian Protokol dan Komunikasi Pimpinan, Sekretariat Daerah Kota Tarakan."]),
 dict(no=2, judul="Latar belakang", mulai="0:30", selesai="1:45",
  ucap=["Bagian Prokopim mengelola agenda dua Pimpinan Daerah yang memang padat. Sejak Maret sampai 5 Oktober 2026 tercatat 617 kegiatan, rata-rata 91 kegiatan per bulan, dengan puncak 120 kegiatan pada Agustus. Volume ini adalah beban kerja yang nyata, bukan karena aplikasi; bedanya, kini setiap kegiatan itu tercatat.",
        "Sampai awal 2026 semuanya manual. Rencana kegiatan disusun di spreadsheet lalu dicetak, penelaahan hanya sempat sekitar 30 menit menjelang jam pulang, disposisi diteruskan sebagai foto di grup percakapan, dan penugasan petugas bergantung pada ingatan.",
        "Pada awal Januari 2026, satu lembar disposisi agenda tidak ikut terfoto ketika berkas diteruskan, dan tidak ada pihak yang dapat mengetahuinya. Tidak ada yang lalai; rantai penyampaiannya yang rapuh. Peristiwa ini menjadi perhatian Pimpinan dan menjadi titik tolak inovasi kami.",
        "Informasi agenda juga datang dari banyak arah: surat ke rumah jabatan, surat resmi melalui tata usaha, dan pesan langsung kepada Wali Kota. Karena tidak ada satu pintu masuk, beberapa rencana kegiatan pernah tidak terinput sama sekali."],
  isyarat="Bila ditanya jumlah lembarnya: cukup jelaskan bahwa satu lembar tidak ikut terfoto dan baru diketahui belakangan. Jangan menyebut angka total lembar."),
 dict(no=3, judul="Akar masalah", mulai="1:45", selesai="2:30",
  ucap=["Telaah kami atas seluruh alur kerja menemukan satu akar masalah: tidak tersedianya satu sumber data yang sahih dan dapat dirujuk semua pihak.",
        "Dari akar itu lahir lima persoalan: penelaahan terikat jendela waktu, keputusan tidak meninggalkan jejak, versi dokumen beredar ganda, pengetahuan kerja melekat pada orang, dan layanan publik tanpa kanal yang dapat ditelusuri.",
        "Karena persoalannya tersebar di kertas, spreadsheet, grup percakapan, papan tulis, dan telepon, jawabannya bukan aplikasi untuk satu urusan, melainkan satu wadah dengan satu data: sebuah superapp.",
        "Taruhannya besar. Kegiatan yang tidak tercatat berarti Pimpinan bisa hadir tanpa pendampingan protokol yang matang, tanpa peliputan, dan tanpa naskah sambutan; kegiatan itu juga hilang dari rekam jejak kinerja pemerintah daerah."]),
 dict(no=4, judul="Pemilihan ide dan alur", mulai="2:30", selesai="3:15",
  ucap=["Kami menimbang empat pilihan. Menambah pengawasan tidak menyentuh akar masalah. Memperbaiki spreadsheet tetap menyisakan banyak versi. Mengadakan aplikasi jadi memerlukan anggaran, padahal alur keprotokolan sangat khas.",
        "Kami memilih membangun sendiri, dengan satu sumber data dan jejak audit, tanpa anggaran pengadaan. Alur intinya tiga jenjang: Admin Rencana Kegiatan, Kepala Sub Bagian Protokol, Kepala Bagian, lalu tayang kepada Pimpinan, ajudan, dan petugas."]),
 dict(no=5, judul="Superapp: sebelas alur kerja", mulai="3:15", selesai="4:15",
  ucap=["Di atas satu data itu kami bangun superapp yang memuat sebelas alur kerja, masing-masing berdasar tugas pada Perwali 50 Tahun 2021: dari penetapan dan perubahan jadwal, penugasan petugas, audiensi, peminjaman ruangan, daftar hadir digital, naskah sambutan, peliputan, penerbitan undangan, sampai evaluasi kinerja.",
        "Kalender bersama terisi otomatis, undangan terbit dalam format siap tanda tangan elektronik Srikandi, dan daftar hadir cukup dengan memindai kode QR.",
        "Setiap peran membuka aplikasi yang sama dan melihat layanan yang menjadi haknya: Pimpinan, ajudan, pejabat struktural, petugas, serta masyarakat dan instansi. [[Aplikasinya berbentuk aplikasi web progresif, terpasang di telepon pintar tanpa toko aplikasi.]]"]),
 dict(no=6, judul="Unsur kebaruan", mulai="4:15", selesai="5:15",
  ucap=["Kebaruannya ada pada cara menjaga mutu keputusan. Pertama, jejak audit melekat pada setiap kegiatan: siapa, kapan, dan apa keputusannya. Kedua, tombol persetujuan baru aktif setelah daftar periksa dicentang.",
        "Ketiga, kewenangan melekat pada jabatan, dengan Pelaksana Harian yang padam sendiri pada tanggal akhirnya. Keempat, usulan perubahan diawasi menurut kegentingannya.",
        "[[Selain itu, kanal publik dapat ditelusuri sendiri dengan kode, kalender bersama terisi otomatis, undangan siap tanda tangan elektronik Srikandi, data pribadi dilindungi sejak formulir, dan setiap pesan WhatsApp dapat diperiksa.]]"]),
 dict(no=7, judul="Pelaksanaan", mulai="5:15", selesai="6:00",
  ucap=["Aplikasi mulai digunakan Maret 2026; kegiatan pertama tercatat 9 Maret. Penggunaannya dikuatkan Surat Sekretaris Daerah tanggal 12 Maret 2026 dan Keputusan Sekretaris Daerah tentang Tim Koordinasi. Per 1 Oktober, inovasi ini telah berjalan 6 bulan 22 hari.",
        "Sebelas alur dituangkan dalam sebelas SOP format PermenPAN-RB 35 Tahun 2012. Sampai awal Oktober tercatat lebih dari 140 pembaruan, sebagian besar berangkat dari kendala yang dilaporkan pengguna."]),
 dict(no=8, judul="Sumber daya dan kolaborasi", mulai="6:00", selesai="6:45",
  ucap=["Seluruhnya tanpa belanja pengadaan. Pengembangan swakelola oleh Ketua Tim; peladen, basis data, kalender, dan perangkat memakai kuota tanpa biaya; hanya gerbang pesan WhatsApp yang berlangganan.",
        "Ketika lalu lintas data sempat 6,4 gigabita per bulan, melampaui kuota 5 gigabita, kami mengubah pengambilan data sehingga turun menjadi sekitar 1 gigabita.",
        "Kolaborasinya melibatkan Tim Koordinasi 42 orang termasuk para Sekretaris Dinas, DKISP yang memfasilitasi alamat resmi, dan Bappeda Litbang sebagai pengampu inovasi daerah."]),
 dict(no=9, judul="Dampak terukur", mulai="6:45", selesai="8:15",
  ucap=["Dampaknya kami ukur langsung dari basis data. Dari pengajuan sampai jadwal tayang, yang dulu diperkirakan 18 sampai 24 jam, kini median 1,94 jam, sekitar 9 sampai 12 kali lebih cepat. 99,3 persen tayang kurang dari sehari.",
        "Hambatan lama ternyata ada pada jendela waktu, bukan pada pengambilan keputusan: begitu sampai di Kepala Bagian, keputusan hanya memerlukan 8 menit. 47,9 persen penelaahan kini terjadi di luar jam kerja.",
        "3.331 peristiwa terekam pada jejak audit, 92,5 persen kegiatan memiliki petugas tercatat, dan 29 kegiatan dikembalikan untuk diperbaiki sebelum ditetapkan, sehingga kekeliruan tertahan sebelum sampai ke Pimpinan.",
        "Grafik ini memperlihatkan volume kegiatan Pimpinan setiap bulan. Jumlahnya mengikuti agenda Wali Kota dan Wakil Wali Kota; yang kami tegaskan, aplikasi ini telah mencatat dan menjadi sarana utama dalam memfasilitasi 617 kegiatan tersebut, rata-rata 91 kegiatan setiap bulan, tanpa belanja pengadaan."]),
 dict(no=10, judul="Manfaat bagi Pimpinan dan publik", mulai="8:15", selesai="9:15",
  ucap=["Bagi Pimpinan, manfaat utamanya kepastian. Bapak Wali Kota menyampaikan: yang terpenting bagi beliau adalah kepastian, ke mana harus hadir, kapan, dan siapa yang menyiapkannya.",
        "Agenda yang telah disetujui dapat beliau lihat langsung di telepon genggam dan selalu dalam keadaan terbaru, tanpa perlu menanyakan kembali kepada ajudan.",
        "Wali Kota telah mendisposisikan 67 kegiatan kepada Wakil Wali Kota langsung dari aplikasi, dan ajudan mengonfirmasi kehadiran sebanyak 386 kali.",
        "Bagi publik, 129 pengajuan ruangan datang dari 68 instansi, dan 59 permohonan audiensi dari 55 instansi; 31 di antaranya menjadi agenda Pimpinan."]),
 dict(no=11, judul="Bonus 1: monitoring internal", mulai="9:15", selesai="10:15",
  ucap=["Bapak dan Ibu Juri, karena seluruh pekerjaan kini berada dalam satu data, kami mendapat bonus: alat pemantauan internal yang langsung siap dipakai.",
        "Monitor WA memperlihatkan setiap pesan yang dikirim aplikasi, apakah terkirim, sampai di HP, atau dibaca. Bila perangkat gerbang pesan terputus atau tiga pesan berturut-turut gagal, pejabat langsung diberi peringatan, dan pesan yang gagal dapat dikirim ulang sekaligus.",
        "Kepala Bagian juga memantau usulan perubahan menurut kegentingannya, menelusuri Riwayat Alur setiap jadwal, dan memantau naskah berita tim dokumentasi, tanpa melangkahi jenjang di bawahnya.",
        "Setiap pagi dan sore, ringkasan terjadwal dikirim otomatis: briefing Pimpinan pukul 06.30, rekap pagi pukul 07.30, dan agenda esok hari pukul 16.00. Isi pesan dihapus otomatis sesudah 90 hari dan nomor penerima disamarkan, sehingga pemantauan tetap menghormati data pribadi."]),
 dict(no=12, judul="Bonus 2: kinerja dan evaluasi", mulai="10:15", selesai="11:30",
  ucap=["Bonus kedua adalah kinerja dan evaluasi. Setiap petugas mengisi evaluasi pasca kegiatan dengan lima butir yang berbeda untuk protokol dan dokumentasi. Sudah 341 kegiatan, atau 55,3 persen, dievaluasi oleh petugasnya.",
        "Hasilnya diolah menjadi Rekap Evaluasi Kinerja per tim, dengan bobot nilai terkini, konsistensi, dan tren, serta Rekap Penugasan Bulanan yang menghasilkan bukti dukung kinerja pegawai untuk e-Kinerja.",
        "Yang siap diterapkan berikutnya adalah menu Indikator Kinerja Bagian Prokopim. Indikator ketepatan waktu layanan komunikasi pimpinan sudah dihitung otomatis: naskah sambutan paling lambat 24 jam sebelum acara, dan berita paling lambat 24 jam sesudah acara, dicocokkan dengan unggahan Instagram Humas Tarakan. Dua indikator lainnya, kepuasan Pimpinan dan kesesuaian standar keprotokolan, kerangkanya sudah tersedia untuk tahap berikutnya.",
        "Artinya, ukuran kinerja Bagian tidak lagi disusun manual pada akhir tahun, tetapi terbaca kapan saja dari pekerjaan sehari-hari."],
  isyarat="Tekankan: dua bonus ini lahir dari data yang sama, tanpa aplikasi tambahan dan tanpa biaya. Menu Indikator Kinerja disebut 'siap diterapkan', bukan 'sudah berjalan'."),
 dict(no=13, judul="Keselarasan RPJMD dan Kategori A", mulai="11:30", selesai="12:15",
  ucap=["Inovasi ini mendukung langsung Misi 4 RPJMD Kota Tarakan 2025–2029: tata kelola pemerintahan yang adaptif, responsif, dan menjaga stabilitas. Ketujuh unsur Kategori A terjawab: tata kelola, proses bisnis, digitalisasi, data, manajemen, pengawasan, dan efisiensi.",
        "Namanya mengusung semboyan Tarakan HIBOT: Handal, Inovatif, Berbudaya, Unggul, dan Tangguh."]),
 dict(no=14, judul="Keberlanjutan dan replikasi", mulai="12:15", selesai="13:30",
  ucap=["Keberlanjutannya terjaga karena biaya berjalannya mendekati nol, kewenangan melekat pada jabatan sehingga mutasi pejabat tidak memutus alur, dan prosedurnya sudah dibakukan dalam sebelas SOP.",
        "Rencana kami: pengesahan SOP pada Oktober sampai Desember 2026, pendampingan pengelola kedua pada semester pertama 2027, lalu paket replikasi pada semester kedua 2027.",
        "Karena setiap pemerintah daerah memiliki tugas keprotokolan, inovasi ini dapat direplikasi utuh atau per modul, dari Sekretariat DPRD sampai pemerintah daerah lain, dimulai dari Kalimantan Utara. Syaratnya hanya peramban, kuota tanpa biaya, SOP yang siap diadaptasi, dan satu pengelola.",
        "Pengetahuan kerjanya sudah terdokumentasi dalam sebelas SOP, sehingga perangkat daerah lain dapat mengadopsi prosedurnya lebih dahulu, bahkan sebelum menerapkan aplikasinya."]),
 dict(no=15, judul="Penutup", mulai="13:30", selesai="14:00",
  ucap=["Satu aplikasi, satu data, setiap keputusan tercatat. Inovasi berdampak, Tarakan maju dan berdaya saing.",
        "Aplikasinya dapat dibuka di prokopim.tarakankota.go.id. Selanjutnya izin kami memutar video inovasi. Terima kasih. Wassalamualaikum warahmatullahi wabarakatuh."]),
 dict(no=16, judul="Cadangan: pembaruan sejak proposal", mulai="—", selesai="—",
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
    kata = sum(len(" ".join(s["ucap"]).replace("[[", "").replace("]]", "").split()) for s in SLIDE if s["no"] <= 15)
    print("tersimpan", p, "·", kata, "kata ≈", round(kata / 125, 1), "menit pada 125 kata/menit")
