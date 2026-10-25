"""Naskah video Lomba Inovasi Daerah Kota Tarakan 2026 — Prokopim Hibot.

Cerita: mengikuti perjalanan satu undangan, dulu dan sekarang. Urutannya memenuhi
Petunjuk Teknis Bab 4.4 (latar belakang, masalah, solusi, implementasi, dampak) dan
mengikuti bab proposal Tarakan: data dasar dan urgensi, penjaringan dan pemilihan ide,
superapp sebelas alur, kebaruan, sumber daya dan kolaborasi, bukti dampak, kepuasan
pengguna, keselarasan RPJMD dan Kategori A, keberlanjutan, replikasi, dan profil tim.

Angka sama persis dengan proposal Tarakan (data aplikasi per 5 Oktober 2026 pukul 15.47 WITA).

Tiap kalimat: (takarir, ucapan, jeda sesudahnya dalam detik, laju).
- takarir: teks layar, angka berupa digit.
- ucapan: teks untuk suara otomatis, angka dieja dan istilah asing ditulis menurut bunyinya.
  None berarti sama dengan takarir.
- laju: length_scale Piper (1.0 = biasa; >1 lebih pelan).
"""

BAGIAN = {
    "latar": "LATAR BELAKANG",
    "masalah": "MASALAH",
    "solusi": "SOLUSI",
    "implementasi": "IMPLEMENTASI",
    "dampak": "DAMPAK",
    "lanjut": "KEBERLANJUTAN",
}

ADEGAN = [
    ("pembuka", "latar", [
        ("Januari 2026.", "Januari, dua ribu dua puluh enam.", 0.6, 1.08),
        ("Satu lembar disposisi agenda Pimpinan tidak ikut terfoto saat diteruskan di grup percakapan.", None, 0.5, 1.03),
        ("Lembar itu tidak sampai ke meja kami.", None, 0.7, 1.04),
        ("Tidak ada yang lalai…", "Tidak ada yang lalai.", 0.3, 1.06),
        ("tapi juga tidak ada yang tahu.", "Tapi, juga tidak ada yang tahu.", 1.0, 1.1),
    ]),
    ("dulu", "latar", [
        ("Kami menyiapkan jadwal, koordinasi, naskah sambutan, dan dokumentasi untuk rata-rata 91 kegiatan Wali Kota dan Wakil Wali Kota setiap bulan.",
         "Kami menyiapkan jadwal, koordinasi, naskah sambutan, dan dokumentasi, untuk rata-rata sembilan puluh satu kegiatan Wali Kota dan Wakil Wali Kota, setiap bulan.", 0.4, 1.0),
        ("Dulu, semuanya serba manual.", None, 0.45, 1.04),
        ("Jadwal diketik di spreadsheet, lalu dicetak.", "Jadwal diketik di spredsit, lalu dicetak.", 0.25, 1.0),
        ("Ada kegiatan mendesak? Cetak ulang.", None, 0.35, 1.0),
        ("Pemeriksaannya hanya sempat sekitar 30 menit, menjelang jam pulang, dan hanya pada hari kerja.",
         "Pemeriksaannya hanya sempat sekitar tiga puluh menit, menjelang jam pulang, dan hanya pada hari kerja.", 0.3, 1.0),
        ("Disposisi dikirim sebagai foto.", None, 0.2, 1.0),
        ("Petugas? Tergantung ingatan.", None, 0.3, 1.02),
        ("Ruang rapat hanya tercatat di papan tulis.", None, 0.25, 1.0),
        ("Mau bertemu Wali Kota? Harus datang, atau menelepon.", None, 0.4, 1.0),
        ("Dari undangan masuk sampai tercantum di agenda, diperkirakan butuh 18 sampai 24 jam.",
         "Dari undangan masuk sampai tercantum di agenda, diperkirakan butuh delapan belas sampai dua puluh empat jam.", 0.8, 1.02),
    ]),
    ("akar", "masalah", [
        ("Datanya tercerai-berai: di kertas, spreadsheet, grup percakapan, papan tulis, dan telepon.",
         "Masalahnya, data tercerai berai. Di kertas, spredsit, grup percakapan, papan tulis, dan telepon.", 0.35, 1.0),
        ("Tidak ada satu sumber yang bisa dipercaya semua pihak.", None, 0.4, 1.02),
        ("Taruhannya besar: Pimpinan bisa hadir tanpa pendampingan, peliputan, dan naskah yang matang.",
         "Taruhannya besar. Pimpinan bisa hadir tanpa pendampingan, peliputan, dan naskah yang matang.", 0.5, 1.0),
        ("Kalau masalahnya ada di banyak tempat, jawabannya harus satu.", None, 0.9, 1.04),
    ]),
    ("ide", "solusi", [   # penjaringan dan pemilihan ide (proposal 7.1 dan 7.2)
        ("Ide ini tidak lahir dari survei, tetapi dari pekerjaan sehari-hari.", None, 0.3, 1.0),
        ("Sesudah peristiwa Januari, seluruh Bagian menelaah alur kerja bersama, dan menemukan pola yang sama.", None, 0.45, 1.0),
        ("Ada empat pilihan.", None, 0.3, 1.02),
        ("Menambah pengawasan tidak menyentuh akar masalah.", None, 0.2, 1.0),
        ("Merapikan spreadsheet tetap menyisakan banyak versi.", "Merapikan spredsit tetap menyisakan banyak versi.", 0.2, 1.0),
        ("Membeli aplikasi jadi butuh anggaran, padahal alur keprotokolan sangat khas.", None, 0.4, 1.0),
        ("Kami memilih membangun sendiri: satu sumber data, setiap keputusan tercatat, tanpa anggaran pengadaan.",
         "Kami memilih membangun sendiri. Satu sumber data, setiap keputusan tercatat, tanpa anggaran pengadaan.", 0.8, 1.02),
    ]),
    ("lahir", "solusi", [
        ("Inilah Prokopim Hibot:", "Inilah, Prokopim Hibot.", 0.3, 1.06),
        ("aplikasi super untuk pelayanan keprotokolan dan komunikasi pimpinan.",
         "Aplikasi super, untuk pelayanan keprotokolan, dan komunikasi pimpinan.", 0.35, 1.0),
        ("Satu aplikasi, satu pintu, satu data, untuk 11 alur kerja.",
         "Satu aplikasi, satu pintu, satu data, untuk sebelas alur kerja.", 0.4, 1.0),
        ("Hibot, dalam bahasa Tidung, berarti hebat, sejalan dengan semboyan Tarakan HIBOT.",
         "Hibot, dalam bahasa Tidung, berarti hebat. Sejalan dengan semboyan, Tarakan Hibot.", 0.8, 1.02),
    ]),
    ("alur", "solusi", [
        ("Mari ikuti satu undangan.", None, 0.35, 1.02),
        ("Admin cukup memindai undangannya, dan kecerdasan buatan mengisi datanya.", None, 0.45, 1.0),
        ("Kepala Sub Bagian memeriksa dari ponsel.", None, 0.2, 1.0),
        ("Tombol setuju baru menyala setelah undangan dibuka dan daftar periksa dicentang.", None, 0.45, 1.0),
        ("Kepala Bagian memutuskan, umumnya hanya 8 menit setelah berkas sampai.",
         "Kepala Bagian memutuskan, umumnya hanya delapan menit setelah berkas sampai.", 0.45, 1.0),
        ("Begitu disetujui, agenda langsung tampil di ponsel Wali Kota dan Wakil Wali Kota.", None, 0.3, 1.0),
        ("Berhalangan? Wali Kota bisa langsung mendisposisikannya.", None, 0.35, 1.0),
        ("Ajudan mengonfirmasi kehadiran, cukup satu ketukan.", None, 0.35, 1.0),
        ("Petugas ditugaskan, dan langsung dikabari lewat WhatsApp.",
         "Petugas ditugaskan, dan langsung dikabari lewat wotsap.", 0.55, 1.0),
    ]),
    ("layanan", "solusi", [
        ("Kalender bersama terisi otomatis, undangan siap ditandatangani elektronik, dan daftar hadir cukup pindai kode QR.",
         "Kalender bersama terisi otomatis, undangan siap ditandatangani elektronik, dan daftar hadir, cukup pindai kode kiu ar.", 0.35, 1.0),
        ("Naskah sambutan dan rancangan berita pun dikelola dalam alur yang sama.", None, 0.4, 1.0),
        ("Instansi dan masyarakat bisa meminjam ruang rapat dan mengajukan audiensi secara daring,",
         "Instansi dan masyarakat bisa meminjam ruang rapat, dan mengajukan audiensi secara daring,", 0.2, 1.0),
        ("lalu memantau statusnya sendiri dengan kode.", None, 0.55, 1.0),
    ]),
    ("jejak", "solusi", [
        ("Yang terpenting: setiap langkah tercatat.", "Yang terpenting, setiap langkah tercatat.", 0.3, 1.04),
        ("Siapa, kapan, dan apa keputusannya.", None, 0.4, 1.04),
        ("Pejabat berhalangan? Pelaksana Harian melanjutkan alurnya,", None, 0.15, 1.0),
        ("dan kewenangannya berakhir sendiri pada tanggal akhir tugasnya.", None, 0.45, 1.0),
        ("Usulan perubahan jadwal dipantau menurut kegentingannya.", None, 0.25, 1.0),
        ("Data pribadi pemohon dilindungi sejak formulir, sesuai Undang-Undang Pelindungan Data Pribadi.",
         "Data pribadi pemohon dilindungi sejak formulir, sesuai undang-undang pelindungan data pribadi.", 0.25, 1.0),
        ("Dan setiap pesan WhatsApp tercatat beserta status terkirimnya.",
         "Dan setiap pesan wotsap tercatat, beserta status terkirimnya.", 0.8, 1.0),
    ]),
    ("bangun", "implementasi", [
        ("Semua ini kami bangun sendiri, tanpa belanja pengadaan.", None, 0.35, 1.02),
        ("Dipakai sejak Maret 2026, dikuatkan Surat dan Keputusan Sekretaris Daerah, dengan 11 SOP.",
         "Dipakai sejak Maret dua ribu dua puluh enam, dikuatkan surat dan keputusan Sekretaris Daerah, dengan sebelas es o pe.", 0.3, 1.0),
        ("Lebih dari 140 pembaruan sudah dilakukan, semuanya berangkat dari masukan pengguna.",
         "Lebih dari seratus empat puluh pembaruan sudah dilakukan, semuanya berangkat dari masukan pengguna.", 0.7, 1.0),
    ]),
    ("daya", "implementasi", [   # sumber daya dan kolaborasi (proposal bab 8)
        ("Tim inovasi beranggotakan lima orang, diperkuat Tim Koordinasi 42 orang yang melibatkan para Sekretaris Dinas.",
         "Tim inovasi beranggotakan lima orang, diperkuat tim koordinasi empat puluh dua orang, yang melibatkan para sekretaris dinas.", 0.35, 1.0),
        ("Sekretaris Daerah menguatkan penggunaannya, DKISP menyiapkan alamat resmi, dan Bappeda Litbang mengampu inovasi daerah.",
         "Sekretaris daerah menguatkan penggunaannya, de ka i es pe menyiapkan alamat resmi, dan Bapeda Litbang mengampu inovasi daerah.", 0.35, 1.0),
        ("Teknologinya memakai layanan awan tanpa biaya.", None, 0.25, 1.0),
        ("Saat lalu lintas data melampaui kuota, kami merampingkannya dari 6,4 gigabita menjadi sekitar 1 gigabita per bulan.",
         "Saat lalu lintas data melampaui kuota, kami merampingkannya, dari enam koma empat gigabita, menjadi sekitar satu gigabita per bulan.", 0.8, 1.0),
    ]),
    ("dampak", "dampak", [
        ("Hasilnya?", None, 0.45, 1.06),
        ("617 kegiatan Pimpinan sudah dikelola, naik dari 72 kegiatan pada April menjadi 114 pada September.",
         "Enam ratus tujuh belas kegiatan Pimpinan sudah dikelola. Naik dari tujuh puluh dua kegiatan pada April, menjadi seratus empat belas pada September.", 0.35, 1.0),
        ("Dari pengajuan sampai tayang, yang dulu 18 sampai 24 jam, kini median 1,94 jam: 9 sampai 12 kali lebih cepat.",
         "Dari pengajuan sampai tayang, yang dulu delapan belas sampai dua puluh empat jam, kini median satu koma sembilan puluh empat jam. Sembilan sampai dua belas kali lebih cepat.", 0.3, 1.0),
        ("99,3% tayang kurang dari sehari.", "Sembilan puluh sembilan koma tiga persen, tayang kurang dari sehari.", 0.35, 1.0),
        ("Hampir separuh pemeriksaan terjadi di luar jam kerja, karena kini bisa dari mana saja.", None, 0.35, 1.0),
        ("3.331 jejak keputusan terekam, dan 29 kegiatan dikembalikan untuk diperbaiki sebelum ditetapkan.",
         "Tiga ribu tiga ratus tiga puluh satu jejak keputusan terekam, dan dua puluh sembilan kegiatan dikembalikan untuk diperbaiki, sebelum ditetapkan.", 0.35, 1.0),
        ("92,5% kegiatan punya petugas yang tercatat.", "Sembilan puluh dua koma lima persen kegiatan, punya petugas yang tercatat.", 0.35, 1.0),
        ("68 instansi meminjam ruangan dan 55 instansi mengajukan audiensi secara daring.",
         "Enam puluh delapan instansi meminjam ruangan, dan lima puluh lima instansi mengajukan audiensi secara daring.", 0.4, 1.0),
        ("Biaya pengadaannya? Nol rupiah.", None, 0.9, 1.06),
    ]),
    ("walikota", "dampak", []),   # suara asli Wali Kota
    ("testimoni", "dampak", [
        ("Testimoni tertulis juga datang dari ajudan, staf protokol, dan Pelaksana Harian.", None, 0.6, 1.0),
    ]),
    ("lanjut", "lanjut", [
        ("Prokopim Hibot menjawab Misi Keempat RPJMD Kota Tarakan: tata kelola pemerintahan yang adaptif, responsif, dan menjaga stabilitas.",
         "Prokopim Hibot menjawab misi keempat, er pe je em de, Kota Tarakan. Tata kelola pemerintahan yang adaptif, responsif, dan menjaga stabilitas.", 0.35, 1.0),
        ("Ketujuh unsur Kategori A terjawab: tata kelola, proses bisnis, digitalisasi, data, manajemen, pengawasan, dan efisiensi.",
         "Ketujuh unsur kategori A terjawab. Tata kelola, proses bisnis, digitalisasi, data, manajemen, pengawasan, dan efisiensi.", 0.45, 1.0),
        ("Biaya berjalannya mendekati nol, dan kewenangan melekat pada jabatan,",
         "Biaya berjalannya mendekati nol. Dan kewenangan melekat pada jabatan,", 0.15, 1.0),
        ("jadi pergantian pejabat tidak memutus alur.", None, 0.3, 1.0),
        ("Sebelas SOP disiapkan untuk disahkan, dan pada 2027 pengelola kedua didampingi, agar aplikasi tidak bergantung pada satu orang.",
         "Sebelas es o pe disiapkan untuk disahkan. Dan pada tahun dua ribu dua puluh tujuh, pengelola kedua didampingi, agar aplikasi tidak bergantung pada satu orang.", 0.45, 1.0),
        ("Karena setiap pemerintah daerah punya tugas keprotokolan, inovasi ini bisa ditiru, dari Sekretariat DPRD hingga seluruh pemerintah daerah di Indonesia.",
         "Karena setiap pemerintah daerah punya tugas keprotokolan, inovasi ini bisa ditiru. Dari sekretariat de pe er de, hingga seluruh pemerintah daerah di Indonesia.", 0.9, 1.0),
    ]),
    ("tim", "lanjut", [
        ("Inovasi ini dikerjakan Tim Inovasi Prokopim Hibot, Bagian Protokol dan Komunikasi Pimpinan, Sekretariat Daerah Kota Tarakan.", None, 0.8, 1.0),
    ]),
    ("tutup", "lanjut", [
        ("Prokopim Hibot.", None, 0.45, 1.08),
        ("Satu aplikasi. Satu data. Setiap keputusan tercatat.", "Satu aplikasi. Satu data. Setiap keputusan, tercatat.", 0.6, 1.08),
        ("Inovasi berdampak, Tarakan maju dan berdaya saing.", None, 1.2, 1.04),
    ]),
]


def kata():
    return sum(len(t.split()) for _, _, ks in ADEGAN for t, *_ in ks)


if __name__ == "__main__":
    for no, bag, ks in ADEGAN:
        print(no, BAGIAN[bag], len(ks), "kalimat", sum(len(t.split()) for t, *_ in ks), "kata")
    print("total", kata(), "kata")
