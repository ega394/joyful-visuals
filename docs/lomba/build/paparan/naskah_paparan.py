"""Naskah bicara paparan Tahap II (target 9:15, batas panitia 10:00).

Satu sumber untuk: lembar naskah cetak (buat-naskah-paparan.py) dan catatan pembicara PPTX (naskah-paparan.json).
Teks dalam [[...]] boleh dilewati bila waktu mepet.
"""
import json, os

SLIDE = [
 dict(no=1, judul="Pembuka", mulai="0:00", selesai="0:25",
  ucap=["Assalamualaikum warahmatullahi wabarakatuh. Selamat [pagi/siang], Bapak dan Ibu Dewan Juri yang kami hormati.",
        "Izin kami sampaikan Prokopim Hibot, satu alur digital terverifikasi untuk agenda Pimpinan Daerah, dari Bagian Protokol dan Komunikasi Pimpinan, Sekretariat Daerah Kota Tarakan. Kami mengikuti kategori Inovasi Terapan, ASN Pemerintah Kabupaten/Kota."],
  isyarat="Berdiri tegak, tatap juri, senyum. Jangan buru-buru; kalimat pertama menentukan kesan."),
 dict(no=2, judul="Latar belakang: peristiwa Januari", mulai="0:25", selesai="1:10",
  ucap=["Awal Januari 2026, dua lembar disposisi agenda turun dari meja Pimpinan: rencana kegiatan dan rencana audiensi.",
        "Yang ini sampai kepada kami, karena difoto dan dikirim ke grup. Yang ini, rencana audiensi untuk Senin, 5 Januari, tertinggal.",
        "Tidak ada yang lalai. Tetapi tidak ada pula yang bisa mengetahuinya, karena tidak ada catatan berapa lembar yang seharusnya kami terima.",
        "Saat itu rencana kegiatan disusun di spreadsheet lalu dicetak, penelaahan hanya sempat sekitar 30 menit menjelang jam pulang, [[disposisi beredar sebagai foto,]] dan dari pengajuan sampai tayang diperkirakan 18 sampai 24 jam."],
  isyarat="Tunjuk foto atas saat 'yang ini sampai', foto bawah saat 'yang ini tertinggal'. Pelankan suara di 'tidak ada yang lalai', beri jeda sejenak."),
 dict(no=3, judul="Akar masalah", mulai="1:10", selesai="1:40",
  ucap=["Kami lalu menelaah bersama seluruh Bagian, dan menemukan pola yang sama di banyak tempat: keputusan tidak meninggalkan jejak, beberapa versi cetakan beredar bersamaan, [[pengetahuan kerja melekat pada orang.]]",
        "Akarnya satu: tidak ada satu sumber data yang dapat dirujuk semua pihak."],
  isyarat="Tunjuk kotak 'Akar masalah'. Kalimat terakhir diucapkan pelan dan tegas."),
 dict(no=4, judul="Terobosan: pilihan dan alur", mulai="1:40", selesai="2:15",
  ucap=["Kami menimbang empat pilihan. Menambah pengawasan tidak menyentuh akar masalah. Merapikan spreadsheet tetap menyisakan banyak versi. Membeli aplikasi jadi butuh anggaran, padahal alur keprotokolan sangat khas.",
        "Maka kami membangun sendiri, tanpa belanja pengadaan. Hasilnya satu alur berjenjang: Admin Rencana Kegiatan, Kepala Sub Bagian, Kepala Bagian, lalu tayang di HP Pimpinan."],
  isyarat="Sapukan tangan dari kiri ke kanan mengikuti empat kartu, lalu empat langkah alur."),
 dict(no=5, judul="Enam unsur kebaruan", mulai="2:15", selesai="2:40",
  ucap=["Kebaruannya ada pada cara menjaga mutu keputusan: setiap langkah tercatat, persetujuan baru aktif setelah daftar periksa dicentang, dan kewenangan Pelaksana Harian padam sendiri pada tanggal akhirnya.",
        "[[Sejak proposal, aplikasi terus dikembangkan dari kendala pengguna.]] Izin kami tunjukkan langsung di aplikasi."],
  isyarat="Pada 'izin kami tunjukkan', beri anggukan ke Admin RK: tanda demo dimulai."),
 dict(no=6, judul="DEMONSTRASI (3 menit)", mulai="2:40", selesai="5:40",
  ucap=["(1) Admin RK, laptop · 0:00–0:35 — \"Admin kami menerima undangan. Cukup dipindai: nama acara, tanggal, jam, lokasi, dan zona waktunya terisi sendiri. Aplikasi juga memeriksa benturan jadwal. Admin memeriksa, lalu mengirim.\"",
        "(2) Kasubbag, HP · 0:35–1:05 — \"Kepala Sub Bagian langsung menerima notifikasi, di mana pun berada. Tombol teruskan baru aktif setelah undangan dibuka dan daftar periksa dicentang. Kekeliruan tertahan sebelum sampai ke Pimpinan.\"",
        "(3) Kabag, HP · 1:05–1:25 — \"Saya memutus dari HP saya. Setujui, dan agenda langsung tayang, tanpa cetak ulang.\"",
        "(4) HP Wali Kota · 1:25–2:05 — \"Saat itu juga agenda tiba di HP Wali Kota. Beliau atau ajudan cukup menekan Hadir, atau mendisposisikan kepada Wakil Wali Kota. Disposisi inilah yang dulu beredar sebagai foto.\"",
        "(5) Admin RK, laptop · 2:05–2:35 — \"Petugas ditugaskan dan langsung diberi tahu. Di Riwayat Alur, setiap langkah tadi tercatat: siapa, kapan, dan apa keputusannya.\"",
        "(6) Kabag, HP · 2:35–3:00 — \"Dan di Monitor WA kami memastikan pesan penugasan itu terkirim dan dibaca. Tidak ada lagi lembar yang tertinggal tanpa ada yang tahu.\""],
  isyarat="Kabag memandu dan berbicara; Admin RK dan Kasubbag hanya mengoperasikan. Semua memakai instans demo berdata contoh. Bila aplikasi atau jaringan bermasalah lebih dari 10 detik, langsung putar video demo cadangan di laptop. Admin RK memberi isyarat pada menit 5:40."),
 dict(no=7, judul="Manfaat terukur", mulai="5:40", selesai="6:30",
  ucap=["Hasilnya terukur dari basis data, per 24 September 2026. Dari pengajuan sampai tayang, yang dulu diperkirakan 18 sampai 24 jam, kini median 1,99 jam, dan 99,3 persen tayang kurang dari sehari.",
        "589 kegiatan terkelola dan 3.072 keputusan terekam. [[92,4 persen kegiatan sudah ada petugasnya.]] Hampir separuh penelaahan, 47,5 persen, dilakukan di luar jam kerja: pekerjaan tidak lagi menunggu jendela 30 menit.",
        "Dan hemat kertas: rencana kegiatan tidak lagi dicetak ulang, 452 berkas undangan terarsip digital."],
  isyarat="Beri jeda dua detik sesudah '1,99 jam'. Ini angka utama; biarkan juri mencernanya."),
 dict(no=8, judul="Dirasakan Pimpinan", mulai="6:30", selesai="7:00",
  ucap=["Manfaatnya dirasakan langsung oleh Pimpinan. Wali Kota menyampaikan: \"Yang terpenting bagi saya adalah kepastian: ke mana saya harus hadir, kapan, dan siapa yang menyiapkannya.\"",
        "62 kegiatan telah beliau disposisikan kepada Wakil langsung dari aplikasi, dan ajudan sudah 341 kali mengonfirmasi kehadiran."],
  isyarat="Bacakan kutipan dengan nada hormat dan pelan, sambil menunjuk kotak kutipan."),
 dict(no=9, judul="Fitur lain: kanal publik", mulai="7:00", selesai="7:25",
  ucap=["Di luar alur agenda, ada fitur tersendiri untuk masyarakat: kanal publik. Tanpa akun, 66 instansi mengajukan peminjaman ruangan dan 53 instansi mengajukan audiensi, lalu memantau statusnya sendiri dengan kode penelusuran, tanpa datang atau menelepon berulang."],
  isyarat="Tegaskan 'fitur tersendiri', supaya juri tidak mencampurnya dengan alur agenda."),
 dict(no=10, judul="Pemanfaatan sumber daya", mulai="7:25", selesai="7:55",
  ucap=["Seluruhnya dibangun tim sendiri, tanpa belanja pengadaan, dengan layanan tanpa biaya.",
        "Bagaimana bila pengelolanya pindah? Kewenangan melekat pada jabatan, sebelas SOP disiapkan, kode dan riwayat tersimpan lengkap atas nama instansi, dan pengelola kedua didampingi mulai 2027."],
  isyarat="Pertanyaan 'bila Kabag pindah' hampir pasti muncul; dengan menjawabnya lebih dulu, Bapak menguasai arah tanya jawab."),
 dict(no=11, judul="Diseminasi", mulai="7:55", selesai="8:25",
  ucap=["Pemakaiannya sudah melampaui Bagian kami: Pimpinan, ajudan, pengawal, mitra di DKISP, dan Tim Koordinasi lintas perangkat daerah.",
        "Inovasi ini siap direplikasi sesuai kebutuhan; yang disesuaikan hanya nama jabatan, pengguna, dan tata naskah. [[Sebelas SOP disahkan Sekretaris Daerah pada Oktober sampai Desember 2026.]]"],
  isyarat="Sebut 'siap direplikasi' dengan yakin; jangan menjanjikan daerah tertentu."),
 dict(no=12, judul="Kompatibilitas", mulai="8:25", selesai="8:50",
  ucap=["Inovasi ini selaras dengan Undang-Undang Pelayanan Publik dan Keprotokolan, Peraturan Pemerintah tentang Inovasi Daerah, dan SPBE, serta mendukung Misi 3 RPJMD Kalimantan Utara dan Misi 4 Kota Tarakan.",
        "[[Aplikasi menyesuaikan cara kerja Pimpinan, bukan sebaliknya: naskah sambutan tetap tersedia tercetak.]]"],
  isyarat="Cukup sebut garis besar; nomor peraturan sudah tertulis di slide."),
 dict(no=13, judul="Penutup", mulai="8:50", selesai="9:15",
  ucap=["Bapak dan Ibu Dewan Juri, Januari lalu satu lembar tertinggal tanpa ada yang tahu. Hari ini, setiap lembar dan setiap keputusan tercatat.",
        "Prokopim Hibot: satu alur, satu data, setiap keputusan tercatat. Terima kasih. Wassalamualaikum warahmatullahi wabarakatuh."],
  isyarat="Ucapkan slogan perlahan, satu frasa satu tarikan napas, lalu diam dan tatap juri. Jangan menambah kalimat sesudah 'terima kasih'."),
 dict(no=14, judul="CADANGAN: bila ditanya perbedaan dengan proposal", mulai="—", selesai="—",
  ucap=["Proposal memuat keadaan per 24 September 2026. Pembaruan Oktober 2026 berangkat dari pemakaian: pengingat dirampingkan menjadi tiga waktu, WhatsApp hanya untuk acara hari ini atau besok, notifikasi tamu berjenjang, Monitor WA, masuk dengan sidik jari dan akun Google, dan jam acara mengikuti zona waktu.",
        "Koreksi data: di proposal kami menulis tiga lembar berdasarkan ingatan. Saat menyiapkan paparan ini kami menelusuri lembar aslinya; ternyata dua lembar, rencana kegiatan sampai dan rencana audiensi tertinggal. Inilah alasan aplikasi ini dibangun: tanpa catatan, bahkan jumlah lembar pun bergantung pada ingatan."],
  isyarat="Tampilkan hanya bila ditanya. Jawab jujur dan tenang; koreksi yang disampaikan terbuka menambah kepercayaan."),
]

TANYA = [
 ("Apa bedanya dengan kalender atau grup WhatsApp biasa?", "Kalender hanya menyimpan jadwal. Prokopim Hibot menjaga alurnya: siapa mengusulkan, siapa menelaah, siapa memutus, dan semuanya tercatat. Agenda baru tampil setelah melewati daftar periksa dan disetujui."),
 ("Bila Bapak dimutasi, apakah aplikasi ini berhenti?", "Tidak. Kewenangan melekat pada jabatan, bukan orang. Sebelas SOP disiapkan, kode dan riwayat tersimpan lengkap, akun layanan atas nama instansi, dan pengelola kedua didampingi mulai 2027."),
 ("Berapa biayanya?", "Belanja pengadaan nol rupiah; dikerjakan tim sendiri dengan layanan berpaket tanpa biaya. Ketika lalu lintas data sempat melampaui kuota, cara pengambilan data kami ubah sehingga turun dari 6,4 GB menjadi sekitar 1 GB per bulan."),
 ("Bagaimana keamanan data agenda Pimpinan?", "Hanya akun terdaftar yang dapat masuk, dengan sidik jari atau wajah dan akun Google. Kalender ruangan untuk umum hanya menampilkan keterpakaian slot, tanpa identitas pemohon. Kebijakan privasi mengikuti UU 27 Tahun 2022."),
 ("Angka 18–24 jam itu dari mana?", "Itu perkiraan alur lama, karena dulu memang tidak pernah dicatat; justru itu masalahnya. Angka 1,99 jam sekarang terukur langsung dari basis data."),
 ("Di proposal tertulis tiga lembar, di sini dua?", "Gunakan jawaban pada slide 14 (cadangan): koreksi berdasarkan lembar asli; peristiwanya sama."),
 ("Apakah bisa dipakai daerah lain?", "Bisa, sesuai kebutuhan. Yang disesuaikan hanya nama jabatan, pengguna, dan tata naskah; cukup peramban dan sebelas SOP yang dapat diadaptasi."),
 ("Apa manfaatnya bagi masyarakat?", "Lewat kanal publik, 66 instansi meminjam ruangan dan 53 instansi mengajukan audiensi tanpa akun, dan memantau statusnya sendiri dengan kode penelusuran."),
]

KIAT = [
 ("Alur cerita", "Cerita → bukti → demo → angka → keberlanjutan. Juri mengingat cerita lembar yang tertinggal; angka dan demo membuktikan cerita itu sudah terjawab."),
 ("Jangan membaca slide", "Slide adalah bukti, bukan naskah. Hafalkan kalimat pertama tiap slide; sisanya cukup ingat poinnya. Lembar ini untuk latihan, bukan untuk dibaca di depan juri."),
 ("Pos waktu", "Slide 2 mulai paling lambat 0:30 · demo mulai 2:40 · slide 7 mulai 5:40 · penutup mulai 8:50. Bila terlambat di satu pos, lewati kalimat bertanda [[ ]] berikutnya."),
 ("Tempo", "Sekitar 110–120 kata per menit. Jeda dua detik sesudah angka utama (1,99 jam) dan sesudah kutipan Wali Kota. Diam sejenak lebih meyakinkan daripada 'eee'."),
 ("Mata dan tangan", "Tatap juri bergantian, kiri, tengah, kanan. Tunjuk layar hanya untuk foto lembar, angka utama, dan kutipan. Berdiri di samping layar, jangan membelakangi juri."),
 ("Demo", "Kabag yang berbicara; operator diam dan cepat. Latih tiga kali dengan stopwatch. Siapkan video demo cadangan di laptop dan diska lepas; bila macet lebih dari 10 detik, langsung pindah ke video tanpa minta maaf panjang."),
 ("Tanya jawab", "Dengarkan sampai selesai, ucapkan terima kasih, ulangi inti pertanyaan dalam satu kalimat, lalu jawab paling lama 30 detik dengan pola: jawaban → bukti (angka atau fitur) → manfaat. Bila belum tahu: 'Izin, akan kami lengkapi secara tertulis.'"),
 ("Bahasa", "Pakai istilah pengguna: rencana kegiatan, disposisi, Pelaksana Harian. Hindari istilah teknis seperti server, basis data cloud, atau nama layanan."),
 ("Latihan", "H-2: baca keras tiga kali dengan stopwatch, rekam suara dengan HP, dengarkan ulang. H-1: gladi lengkap bersama tim demo di ruangan dengan proyektor. Target 9:15; bila lebih dari 9:30, pangkas kalimat bertanda [[ ]]."),
 ("H-1 dan hari H", "Baterai laptop dan HP penuh; kabel HDMI dan adaptor; hotspot cadangan; akun demo sudah masuk; video cadangan di laptop dan diska lepas; paparan PDF cadangan; lembar ini dan stopwatch."),
]

def bersih(t):
    return t.replace("[[", "").replace("]]", "")

def kata(t):
    return len(bersih(t).split())

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "naskah-paparan.json")
    notes = {}
    for s in SLIDE:
        badan = "\n".join(bersih(u) for u in s["ucap"])
        notes[str(s["no"])] = f"{s['mulai']}–{s['selesai']} · {s['judul']}\n\n{badan}\n\nIsyarat: {s['isyarat']}"
    json.dump(notes, open(out, "w"), ensure_ascii=False, indent=1)
    tot = 0
    for s in SLIDE[:13]:
        k = sum(kata(u) for u in s["ucap"]); m, d = s["mulai"].split(":"), s["selesai"].split(":")
        jatah = (int(d[0]) * 60 + int(d[1])) - (int(m[0]) * 60 + int(m[1]))
        est = k / 115 * 60
        tot += est if s["no"] != 6 else 180
        print(f"{s['no']:>2} {k:>4} kata  perkiraan {est:5.1f} dtk  jatah {jatah:>3} dtk")
    print("total perkiraan", round(tot), "detik =", f"{int(tot//60)}:{int(tot%60):02d}")
