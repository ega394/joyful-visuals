"""Daftar perkiraan pertanyaan juri dan jawabannya — wawancara finalis Lomba Inovasi
Daerah Kota Tarakan 2026 (tanya jawab 10 menit; kriteria "jawaban atas pertanyaan" 15%).

Angka sama dengan proposal Tarakan (5 Oktober 2026). Jawaban ditulis untuk diucapkan:
singkat, langsung, dan diakhiri satu bukti. Jangan membandingkan dengan inovasi lain.

  python3 buat-tanya-jawab.py <keluaran.docx>     (perlu python-docx)
"""
import sys
from docx import Document
from docx.shared import Pt, RGBColor, Cm

TJ = [
 ("Penguasaan substansi dan konsistensi (30%)", [
  ("Apa bedanya dengan Google Calendar atau grup WhatsApp yang sudah dipakai?",
   "Kalender dan grup tidak punya jenjang persetujuan, kewenangan menurut jabatan, dan jejak keputusan. Prokopim Hibot tidak menggantikan kalender bersama; kalender justru terisi otomatis dari aplikasi, sehingga hanya memuat kegiatan yang sudah disetujui. Bedanya ada di jejak: 3.331 peristiwa keputusan tercatat."),
  ("Angka 18–24 jam itu dari mana? Apakah terukur?",
   "Angka sebelum inovasi adalah estimasi, karena dulu memang tidak pernah dicatat: menunggu jendela periksa sekitar 8 jam, lalu disposisi malam atau pagi harinya. Angka sesudahnya terukur dari basis data: median 1,94 jam dari 432 kegiatan yang jejak auditnya lengkap, dan 99,3 persen tayang kurang dari sehari."),
  ("Apakah jumlah 617 kegiatan itu bertambah karena aplikasi?",
   "Tidak. Jumlah kegiatan mengikuti agenda Wali Kota dan Wakil Wali Kota. Yang berubah, kini setiap kegiatan itu tercatat dan difasilitasi melalui satu aplikasi, rata-rata 91 kegiatan setiap bulan."),
  ("Apa sebenarnya yang terjadi pada peristiwa Januari?",
   "Disposisi diteruskan dalam bentuk foto melalui grup percakapan. Satu lembar, yaitu rencana audiensi, tidak ikut terfoto dan baru diketahui belakangan. Tidak ada yang lalai; rantai penyampaiannya yang rapuh. Sejak itu setiap agenda punya satu data dan riwayat yang dapat ditelusuri.",
   "Jangan menyebut jumlah total lembar."),
  ("Mengapa disebut superapp, bukan aplikasi agenda?",
   "Karena satu pintu itu memuat sebelas alur kerja: penetapan dan perubahan jadwal, penugasan, audiensi, ruangan, daftar hadir, naskah sambutan, peliputan, undangan, sampai evaluasi kinerja, semuanya berbagi satu data kegiatan."),
  ("Modul apa yang belum optimal?",
   "Pengesahan naskah sambutan: baru 3 naskah lewat aplikasi, karena Pimpinan lebih nyaman membaca naskah tercetak. Modulnya tetap tersedia; aplikasi menyesuaikan cara kerja Pimpinan, bukan sebaliknya."),
 ]),
 ("Demonstrasi (20%)", [
  ("Bisa ditunjukkan sekarang?",
   "Bisa, langsung di alamat resmi prokopim.tarakankota.go.id dengan akun asli.",
   "Jangan menekan ajukan, setuju, hadir, disposisi, atau tugaskan pada data asli; tunjukkan pada kegiatan yang sudah ada."),
  ("Bagaimana jika jaringan atau aplikasi bermasalah?",
   "Aplikasi berupa aplikasi web progresif yang dapat dipasang di HP. Bila jaringan terganggu saat demo, kami siapkan rekaman layar cadangan; dalam operasi harian, peringatan Monitor WA memberi tahu bila gerbang pesan terputus, dan pesan yang gagal dapat dikirim ulang sekaligus."),
  ("Apakah juri dapat mencoba sendiri?",
   "Halaman permohonan audiensi dan peminjaman ruangan terbuka untuk umum tanpa akun. Fitur internal memerlukan akun sesuai peran karena memuat agenda Pimpinan."),
 ]),
 ("Kelayakan dan keberlanjutan (15%)", [
  ("Bagaimana jika Bapak sebagai pengembang dimutasi?",
   "Risiko ini kami mitigasi berlapis: sebelas SOP, kode dan riwayat perubahan lengkap tersimpan di repositori, akun layanan atas nama instansi, dan pendampingan pengelola kedua pada semester pertama 2027. Kewenangan dalam aplikasi melekat pada jabatan, bukan orang."),
  ("Berapa biayanya, sekarang dan ke depan?",
   "Belanja pengadaan nol rupiah. Peladen, basis data, dan kalender memakai kuota tanpa biaya; satu-satunya biaya berjalan adalah langganan gerbang pesan WhatsApp. Ketika lalu lintas data sempat 6,4 gigabita melampaui kuota 5 gigabita, kami rampingkan menjadi sekitar 1 gigabita tanpa menambah biaya."),
  ("Bagaimana jika kuota gratis tidak lagi cukup atau layanan berubah?",
   "Basis datanya PostgreSQL standar dan antarmukanya terbuka, sehingga dapat dipindahkan ke peladen lain, termasuk milik pemerintah daerah, tanpa menulis ulang aplikasi. Pemakaian kuota juga dipantau."),
  ("Bagaimana keamanan dan pelindungan data pribadi?",
   "Setiap peran hanya melihat yang menjadi haknya. Formulir publik mensyaratkan persetujuan eksplisit sesuai UU 27/2022; kanal publik tidak menampilkan identitas pemohon; isi pesan WhatsApp dihapus otomatis setelah 90 hari dan nomor disamarkan. Pengetatan kebijakan akses basis data berjalan bertahap."),
  ("Bagaimana jika pejabat penyetuju berhalangan?",
   "Pelaksana Harian melanjutkan alurnya; kewenangannya padam sendiri pada tanggal akhir tugas, dan setiap keputusannya tercatat atas namanya. Fitur ini sudah dipakai dalam 67 tindakan."),
  ("Apa rencana pengembangan berikutnya?",
   "Pengesahan SOP oleh Sekretaris Daerah pada akhir 2026, pengelola kedua pada semester pertama 2027, lalu paket replikasi. Menu Indikator Kinerja juga baru diaktifkan, dengan ketepatan waktu layanan komunikasi dihitung otomatis."),
 ]),
 ("Manfaat, dampak, dan replikasi", [
  ("Apa manfaat langsung bagi Wali Kota?",
   "Kepastian: agenda yang disetujui tampil di HP beliau dan selalu terbaru. Beliau telah mendisposisikan 67 kegiatan kepada Wakil Wali Kota langsung dari aplikasi, dan ajudan mengonfirmasi kehadiran 386 kali."),
  ("Apa manfaat bagi masyarakat?",
   "Tidak perlu lagi bersurat, datang, atau menelepon berulang untuk menanyakan kepastian. Sudah 129 pengajuan ruangan dari 68 instansi dan 59 permohonan audiensi dari 55 instansi, dipantau sendiri dengan kode penelusuran."),
  ("Bagaimana kepuasan pengguna diukur?",
   "Saat ini melalui testimoni tertulis dari Wali Kota, ajudan, staf protokol, dan Pelaksana Harian, serta evaluasi pasca kegiatan oleh petugas (341 kegiatan). Survei kepuasan Pimpinan disiapkan sebagai IKU 1 pada menu Indikator Kinerja."),
  ("Dapatkah ditiru perangkat daerah lain?",
   "Dapat, utuh atau per modul. Sekretariat DPRD dapat memakai alur agenda pimpinan dewan; perangkat daerah dapat memakai modul ruangan, audiensi, dan daftar hadir. Yang disesuaikan hanya nama jabatan, pengguna, dan tata naskah setempat."),
 ]),
]


def main(keluar):
    d = Document()
    st = d.styles["Normal"]; st.font.name = "Arial"; st.font.size = Pt(11)
    for s in d.sections:
        s.left_margin = s.right_margin = Cm(2.2); s.top_margin = s.bottom_margin = Cm(2)
    d.add_heading("Perkiraan Pertanyaan Juri dan Jawaban", 0)
    p = d.add_paragraph("Prokopim Hibot · Wawancara Finalis Lomba Inovasi Daerah Kota Tarakan 2026 · Senin, 9 November 2026")
    p.runs[0].font.size = Pt(10); p.runs[0].font.color.rgb = RGBColor(0x64, 0x74, 0x8B)
    d.add_paragraph("Pegangan menjawab: jawab langsung, satu bukti angka, lalu berhenti. Akui yang belum optimal dengan tenang. "
                    "Jangan membandingkan dengan inovasi lain. Bila tidak tahu angkanya, sampaikan akan dikirim menyusul.")
    n = 0
    for bab, daftar in TJ:
        d.add_heading(bab, 1)
        for item in daftar:
            n += 1
            t, j = item[0], item[1]
            q = d.add_paragraph(); r = q.add_run(f"{n}. {t}"); r.bold = True
            a = d.add_paragraph(j); a.paragraph_format.left_indent = Cm(0.6)
            if len(item) > 2:
                c = d.add_paragraph(); c.paragraph_format.left_indent = Cm(0.6)
                rc = c.add_run("Catatan: " + item[2]); rc.italic = True; rc.font.color.rgb = RGBColor(0xB9, 0x1C, 0x1C)
    d.save(keluar)
    print("tersimpan", keluar, n, "pertanyaan")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "Tanya-Jawab-Prokopim-Hibot.docx")
