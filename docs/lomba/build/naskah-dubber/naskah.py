import sys
S = [
("01","0:00","0:20","Latar belakang","Januari 2026. Tiga lembar disposisi agenda diturunkan. Yang sampai ke Bagian Prokopim hanya dua. Tidak ada yang lalai, tetapi tidak ada pula yang bisa mengetahuinya.","Pelan dan datar; jeda 1 detik setelah \"hanya dua\"."),
("02","0:20","0:55","Latar belakang","Rencana kegiatan disusun di spreadsheet lalu dicetak. Penelaahan hanya sempat sekitar tiga puluh menit menjelang jam pulang. Disposisi beredar sebagai foto, penugasan bergantung pada ingatan. Dari pengajuan sampai tayang diperkirakan delapan belas sampai dua puluh empat jam.","Tempo naik sedikit; tekan \"delapan belas sampai dua puluh empat jam\"."),
("03","0:55","1:20","Penjaringan ide","Ide ini tidak lahir dari survei, tetapi dari pekerjaan sehari-hari. Undangan masuk dari banyak pintu. Sesudah peristiwa Januari, seluruh Bagian menelaah alur kerja bersama dan menemukan pola yang sama: penugasan tersimpan dalam ingatan, ruangan hanya tercatat di papan tulis, arsip tersebar.","Tiga hal di akhir dibaca dengan jeda pendek di antaranya."),
("04","1:20","1:45","Pemilihan ide","Ada empat pilihan. Menambah pengawasan tidak menyentuh akar masalah. Merapikan spreadsheet tetap menyisakan banyak versi. Membeli aplikasi jadi butuh anggaran, padahal alur keprotokolan sangat khas. Kami memilih membangun sendiri: satu sumber data, setiap keputusan tercatat, tanpa anggaran pengadaan.","Jeda 1 detik sebelum \"Kami memilih\"; nada mantap."),
("05","1:45","1:55","Pemilihan ide","Lahirlah Prokopim Hibot: satu alur digital terverifikasi untuk agenda Pimpinan Daerah.","Dibaca \"Prokopim Hibot\" (bukan dieja). Nada bangga, tenang."),
("06","1:55","2:10","Manfaat","Admin Rencana Kegiatan memasukkan undangan, cukup dengan memindainya.","Ceria, ringan."),
("07","2:10","2:25","Manfaat","Kepala Sub Bagian menelaah dari mana saja. Tombol persetujuan baru aktif setelah butir pemeriksaan dicentang.","Jelas; tekan \"baru aktif\"."),
("08","2:25","2:35","Manfaat","Kepala Bagian memutus. Median waktunya delapan menit.","Singkat, tegas."),
("09","2:35","2:55","Manfaat","Begitu tayang, agenda langsung ada di telepon Pimpinan. Ajudan mengonfirmasi kehadiran, dan Wali Kota dapat mendisposisikan kepada Wakil Wali Kota.","Satu napas per kalimat."),
("10","2:55","3:10","Manfaat","Petugas ditugaskan dan diberi tahu, daftar hadir cukup dengan kode QR, dan setiap langkah tercatat: siapa, kapan, apa keputusannya.","\"Siapa, kapan, apa keputusannya\" dibaca dengan tiga hentakan."),
("11","3:10","3:30","Manfaat","Masyarakat dan instansi mengajukan audiensi atau meminjam ruangan secara daring, lalu memantau sendiri statusnya.","Hangat, lugas."),
("12","3:30","4:05","Dampak","Per dua puluh empat September dua ribu dua puluh enam: lima ratus delapan puluh sembilan kegiatan terkelola. Waktu sampai tayang turun menjadi median satu koma sembilan puluh sembilan jam, dan sembilan puluh sembilan koma tiga persen tayang kurang dari sehari. Tiga ribu tujuh puluh dua keputusan terekam. Enam puluh enam instansi meminjam ruangan dan lima puluh tiga instansi mengajukan audiensi. Belanja pengadaannya nol rupiah.","Bagian terpadat: baca angka satu per satu, jeda 0,5 detik antarangka. \"Nol rupiah\" ditutup dengan nada turun, tegas."),
("13","4:05","4:20","Dampak","(Tanpa suara bila cuplikan Wali Kota atau ajudan tersedia. Bila hanya teks, dubber membaca kutipan:) Yang terpenting bagi saya adalah kepastian: ke mana saya harus hadir, kapan, dan siapa yang menyiapkannya.","Opsional. Bila dibaca, tenang dan hormat."),
("14","4:20","4:35","Dampak","Sebelas SOP dan Pelaksana Harian menjaga alur tetap berjalan, bahkan ketika pejabat berhalangan. Sejak proposal, aplikasi terus dikembangkan dari kendala pengguna.","Nada optimis."),
("15","4:35","4:45","Penutup","Satu alur. Satu data. Setiap keputusan tercatat.","Tiga kalimat, tiga hentakan, jeda 0,7 detik; kalimat terakhir paling kuat."),
]
def sec(t):
    m,s=t.split(":"); return int(m)*60+int(s)
if __name__=="__main__":
    for n,a,b,sub,txt,_ in S:
        d=sec(b)-sec(a); w=len(txt.split()); print(n,d,"s",w,"kata",round(w/d*60),"kpm")
