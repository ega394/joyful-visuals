"""Naskah video Lomba Inovasi Daerah Kota Tarakan 2026 — Prokopim Hibot.

Cerita: mengikuti perjalanan satu undangan, dulu dan sekarang. Urutannya memenuhi
Petunjuk Teknis Bab 4.4 (latar belakang, masalah, solusi, implementasi, dampak) dan
menyinggung unsur proposal Tarakan: superapp sebelas alur, Kategori A, Misi 4 RPJMD,
semboyan Tarakan HIBOT, keberlanjutan, replikasi.

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
        ("Lembar itu tidak pernah sampai ke meja kami.", None, 0.7, 1.04),
        ("Tidak ada yang lalai…", "Tidak ada yang lalai.", 0.3, 1.06),
        ("tapi juga tidak ada yang tahu.", "Tapi, juga tidak ada yang tahu.", 1.0, 1.1),
    ]),
    ("dulu", "latar", [
        ("Setiap bulan, rata-rata 91 kegiatan Wali Kota dan Wakil Wali Kota kami siapkan.",
         "Setiap bulan, rata-rata sembilan puluh satu kegiatan Wali Kota dan Wakil Wali Kota kami siapkan.", 0.35, 1.0),
        ("Dulu, semuanya serba manual.", None, 0.45, 1.04),
        ("Jadwal diketik di spreadsheet, lalu dicetak.", "Jadwal diketik di spredsit, lalu dicetak.", 0.3, 1.0),
        ("Pemeriksaannya hanya sempat sekitar 30 menit, menjelang jam pulang.",
         "Pemeriksaannya hanya sempat sekitar tiga puluh menit, menjelang jam pulang.", 0.3, 1.0),
        ("Disposisi dikirim sebagai foto.", None, 0.2, 1.0),
        ("Petugas? Tergantung ingatan.", None, 0.3, 1.02),
        ("Mau bertemu Wali Kota? Harus datang, atau menelepon.", None, 0.4, 1.0),
        ("Dari undangan masuk sampai tercantum di agenda, diperkirakan butuh 18 sampai 24 jam.",
         "Dari undangan masuk sampai tercantum di agenda, diperkirakan butuh delapan belas sampai dua puluh empat jam.", 0.8, 1.02),
    ]),
    ("akar", "masalah", [
        ("Datanya tercerai-berai: di kertas, spreadsheet, grup percakapan, papan tulis, dan telepon.",
         "Masalahnya, data tercerai berai. Di kertas, spredsit, grup percakapan, papan tulis, dan telepon.", 0.35, 1.0),
        ("Tidak ada satu sumber yang bisa dipercaya semua pihak.", None, 0.45, 1.02),
        ("Kalau masalahnya ada di banyak tempat, jawabannya harus satu.", None, 0.9, 1.04),
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
         "Kalender bersama terisi otomatis, undangan siap ditandatangani elektronik, dan daftar hadir, cukup pindai kode kiu ar.", 0.4, 1.0),
        ("Instansi dan masyarakat bisa meminjam ruang rapat dan mengajukan audiensi secara daring,",
         "Instansi dan masyarakat bisa meminjam ruang rapat, dan mengajukan audiensi secara daring,", 0.2, 1.0),
        ("lalu memantau statusnya sendiri dengan kode.", None, 0.55, 1.0),
    ]),
    ("jejak", "solusi", [
        ("Yang terpenting: setiap langkah tercatat.", "Yang terpenting, setiap langkah tercatat.", 0.3, 1.04),
        ("Siapa, kapan, dan apa keputusannya.", None, 0.4, 1.04),
        ("Pejabat berhalangan? Pelaksana Harian melanjutkan alurnya.", None, 0.8, 1.0),
    ]),
    ("bangun", "implementasi", [
        ("Semua ini kami bangun sendiri, tanpa belanja pengadaan.", None, 0.35, 1.02),
        ("Dipakai sejak Maret 2026, dikuatkan Sekretaris Daerah dan 11 SOP,",
         "Dipakai sejak Maret dua ribu dua puluh enam, dikuatkan Sekretaris Daerah, dan sebelas es o pe,", 0.2, 1.0),
        ("dengan lebih dari 140 pembaruan dari masukan pengguna.",
         "dengan lebih dari seratus empat puluh pembaruan, dari masukan pengguna.", 0.8, 1.0),
    ]),
    ("dampak", "dampak", [
        ("Hasilnya?", None, 0.45, 1.06),
        ("617 kegiatan Pimpinan sudah dikelola.", "Enam ratus tujuh belas kegiatan Pimpinan sudah dikelola.", 0.35, 1.0),
        ("Dari pengajuan sampai tayang, yang dulu 18 sampai 24 jam, kini median 1,94 jam.",
         "Dari pengajuan sampai tayang, yang dulu delapan belas sampai dua puluh empat jam, kini median satu koma sembilan puluh empat jam.", 0.3, 1.0),
        ("99,3% tayang kurang dari sehari.", "Sembilan puluh sembilan koma tiga persen, tayang kurang dari sehari.", 0.35, 1.0),
        ("Hampir separuh pemeriksaan terjadi di luar jam kerja, karena kini bisa dari mana saja.", None, 0.35, 1.0),
        ("3.331 jejak keputusan terekam.", "Tiga ribu tiga ratus tiga puluh satu jejak keputusan terekam.", 0.35, 1.0),
        ("Puluhan instansi meminjam ruangan dan mengajukan audiensi secara daring.", None, 0.4, 1.0),
        ("Biaya pengadaannya? Nol rupiah.", "Biaya pengadaannya? Nol rupiah.", 0.9, 1.06),
    ]),
    ("walikota", "dampak", []),   # suara asli Wali Kota
    ("lanjut", "lanjut", [
        ("Prokopim Hibot menjawab Misi Keempat RPJMD Kota Tarakan: tata kelola pemerintahan yang adaptif dan responsif.",
         "Prokopim Hibot menjawab misi keempat, er pe je em de, Kota Tarakan. Tata kelola pemerintahan yang adaptif, dan responsif.", 0.35, 1.0),
        ("Biaya berjalannya mendekati nol, dan kewenangan melekat pada jabatan,",
         "Biaya berjalannya mendekati nol. Dan kewenangan melekat pada jabatan,", 0.15, 1.0),
        ("jadi pergantian pejabat tidak memutus alur.", None, 0.4, 1.0),
        ("Karena setiap pemerintah daerah punya tugas keprotokolan, inovasi ini bisa ditiru di seluruh Indonesia.",
         "Karena setiap pemerintah daerah punya tugas keprotokolan, inovasi ini bisa ditiru, di seluruh Indonesia.", 0.9, 1.0),
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
