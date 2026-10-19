import sys
S = [
('01', '0:00', '0:20', 'Latar belakang', 'Januari 2026. Tiga lembar disposisi agenda diturunkan. Yang sampai ke Bagian Prokopim hanya dua. Tidak ada yang lalai, tetapi tidak ada pula yang bisa mengetahuinya.', 'Pelan dan datar; jeda 1 detik setelah "hanya dua".'),
('02', '0:20', '0:45', 'Latar belakang', 'Rencana kegiatan disusun di spreadsheet lalu dicetak. Penelaahan hanya sempat sekitar tiga puluh menit menjelang jam pulang. Disposisi beredar sebagai foto, penugasan bergantung pada ingatan. Dari pengajuan sampai tayang diperkirakan delapan belas sampai dua puluh empat jam.', 'Tempo naik sedikit; tekan "delapan belas sampai dua puluh empat jam".'),
('03', '0:45', '1:10', 'Penjaringan ide', 'Ide ini tidak lahir dari survei, tetapi dari pekerjaan sehari-hari. Undangan masuk dari banyak pintu. Sesudah peristiwa Januari, seluruh Bagian menelaah alur kerja bersama dan menemukan pola yang sama: penugasan tersimpan dalam ingatan, ruangan hanya tercatat di papan tulis, arsip tersebar.', 'Tiga hal di akhir dibaca dengan jeda pendek di antaranya.'),
('04', '1:10', '1:35', 'Pemilihan ide', 'Ada empat pilihan. Menambah pengawasan tidak menyentuh akar masalah. Merapikan spreadsheet tetap menyisakan banyak versi. Membeli aplikasi jadi butuh anggaran, padahal alur keprotokolan sangat khas. Kami memilih membangun sendiri: satu sumber data, setiap keputusan tercatat, tanpa anggaran pengadaan.', 'Jeda 1 detik sebelum "Kami memilih"; nada mantap.'),
('05', '1:35', '1:45', 'Pemilihan ide', 'Lahirlah Prokopim Hibot: satu alur digital terverifikasi untuk agenda Pimpinan Daerah.', 'Dibaca "Prokopim Hibot" (bukan dieja). Nada bangga, tenang.'),
('06', '1:45', '2:05', 'Manfaat', 'Admin Rencana Kegiatan cukup memindai undangan. Kecerdasan buatan mengisi nama acara, tanggal, jam, lokasi, dan zona waktunya. Admin tinggal memeriksa, lalu mengirimkannya ke Kepala Sub Bagian.', 'Ceria, ringan; daftar isian dibaca mengalir.'),
('07', '2:05', '2:20', 'Manfaat', 'Kepala Sub Bagian menelaah dari mana saja, cukup lewat telepon. Tombol persetujuan baru aktif setelah undangan dibuka dan butir pemeriksaan dicentang.', 'Jelas; tekan "baru aktif".'),
('08', '2:20', '2:30', 'Manfaat', 'Kepala Bagian memeriksa dan memutus, dari mana saja. Sekali disetujui, agenda langsung tayang, tanpa cetak ulang.', 'Singkat, tegas.'),
('09', '2:30', '2:50', 'Manfaat', 'Ajudan mengonfirmasi kehadiran, dan Wali Kota dapat mendisposisikan kepada Wakil Wali Kota. Tidak ada lagi foto disposisi yang berpindah dari grup ke grup.', 'Masuk di 2:36, sesudah 6 detik suara asli Wali Kota. Satu napas per kalimat; kalimat terakhir lebih pelan.'),
('10', '2:50', '3:10', 'Manfaat', 'Petugas ditugaskan dan langsung diberi tahu. Setiap langkah tercatat: siapa, kapan, dan apa keputusannya. Di lokasi, tamu cukup memindai kode QR untuk mengisi daftar hadir, lengkap dengan tanda tangan, tanpa selembar kertas pun.', '"Siapa, kapan, dan apa keputusannya" dibaca dengan tiga hentakan.'),
('11', '3:10', '3:30', 'Manfaat', 'Selain alur agenda itu, ada kanal publik, fitur tersendiri. Masyarakat dan instansi mengajukan audiensi atau meminjam ruangan secara daring, lalu memantau sendiri statusnya, tanpa perlu datang berulang.', 'Ganti nada sedikit: ini fitur lain.'),
('12', '3:30', '4:05', 'Dampak', 'Per dua puluh empat September dua ribu dua puluh enam: lima ratus delapan puluh sembilan kegiatan terkelola. Waktu sampai tayang turun menjadi median satu koma sembilan puluh sembilan jam, dan sembilan puluh sembilan koma tiga persen tayang kurang dari sehari. Tiga ribu tujuh puluh dua keputusan terekam. Sembilan puluh dua koma empat persen kegiatan memiliki penugasan petugas. Belanja pengadaannya nol rupiah.', 'Bagian terpadat: baca angka satu per satu, jeda 0,5 detik antarangka. "Nol rupiah" ditutup dengan nada turun, tegas.'),
('13', '4:05', '4:15', 'Dampak', '(Tanpa narasi. Suara asli Wali Kota diputar.)', 'Dubber tidak membaca apa pun; jangan menimpa suara beliau.'),
('14', '4:15', '4:30', 'Dampak', 'Sebelas SOP dan Pelaksana Harian menjaga alur tetap berjalan, bahkan ketika pejabat berhalangan. Sejak proposal, aplikasi terus dikembangkan dari kendala pengguna.', 'Nada optimis.'),
('15', '4:30', '4:40', 'Penutup', 'Prokopim Hibot. Satu alur. Satu data. Setiap keputusan tercatat.', 'Empat hentakan, jeda 0,7 detik; kalimat terakhir paling kuat.'),
]
def sec(t):
    m,s=t.split(":"); return int(m)*60+int(s)
if __name__=="__main__":
    for n,a,b,sub,txt,_ in S:
        d=sec(b)-sec(a); w=len(txt.split()); print(n,d,"s",w,"kata",round(w/d*60),"kpm")
