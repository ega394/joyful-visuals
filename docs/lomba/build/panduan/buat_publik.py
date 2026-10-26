"""Panduan singkat untuk pemohon layanan publik Prokopim Hibot.

- Panduan Permohonan Audiensi   (halaman /tamu)
- Panduan Peminjaman Ruang Rapat (halaman /pinjamruangan)

Isinya mengikuti SOP 5 dan SOP 6, ditulis dari sisi pemohon, serta aturan yang
dijalankan aplikasi (api/guest.js dan api/room-booking.mjs: jeda 10 menit, paling
banyak 3 permohonan yang masih diproses per nomor WhatsApp).

python3 buat_publik.py <folder keluaran>   -> audiensi.html, ruangan.html
lalu  node pdf.mjs <html> <pdf> "<judul kaki halaman>"
"""
import os, sys

D = os.path.dirname(os.path.abspath(__file__))
GBR = os.path.join(D, "gambar")
AKAR = os.path.abspath(os.path.join(D, "..", "..", "..", ".."))
IKON = os.path.join(AKAR, "public", "icon-512x512.png")

CSS = """
@page { size: A4; margin: 15mm 16mm 17mm; }
* { box-sizing: border-box; }
body { font-family: "Plus Jakarta Sans", "DejaVu Sans", Arial, sans-serif; color: #0F172A; font-size: 10.5pt; line-height: 1.55; margin: 0; }
.kepala { display: flex; align-items: center; gap: 14px; background: #0A1628; color: white; border-radius: 12px; padding: 16px 20px; margin-bottom: 14px; }
.kepala img { width: 52px; border-radius: 12px; }
.kepala .k { font-size: 8.5pt; letter-spacing: 2px; color: #C9A84C; font-weight: 700; }
.kepala h1 { font-size: 18pt; margin: 2px 0 0; }
.kepala .a { font-size: 9.5pt; color: #A7B6CC; }
h2 { page-break-after: avoid; font-size: 12.5pt; color: #0A1628; margin: 14px 0 6px; border-bottom: 2px solid #C9A84C; padding-bottom: 2px; }
p { margin: 0 0 7px; }
ol, ul { margin: 0 0 8px; padding-left: 18px; }
li { margin-bottom: 3px; }
.dua { display: flex; gap: 14px; align-items: flex-start; }
.dua > div { flex: 1; }
.dua figure { flex: 1 1 100%; }
.dua figure img { max-height: 125mm; }
.gbr { display: flex; justify-content: center; gap: 10px; margin: 6px 0 10px; page-break-inside: avoid; }
figure { margin: 0; flex: 0 1 31%; }
figure img { width: 100%; max-height: 92mm; object-fit: contain; object-position: top; border: 1px solid #CBD5E1; border-radius: 8px; display: block; }
figcaption { font-size: 8.5pt; color: #64748B; text-align: center; margin-top: 3px; }
table { border-collapse: collapse; width: 100%; margin: 4px 0 8px; font-size: 9.5pt; }
td, th { border: 1px solid #CBD5E1; padding: 4px 7px; text-align: left; vertical-align: top; }
th { background: #F1F5F9; }
.kotak { background: #FFFBEB; border: 1.5px solid #F59E0B; border-radius: 8px; padding: 8px 12px; margin: 8px 0; page-break-inside: avoid; }
.kotak b.j { color: #92400E; }
.biru { background: #EFF6FF; border-color: #93C5FD; }
.kaki { color: #64748B; font-size: 9pt; margin-top: 12px; }
.pecah { page-break-before: always; }
"""


def gambar(*daftar):
    isi = "".join(f'<figure><img src="file://{os.path.join(GBR, f)}"><figcaption>{k}</figcaption></figure>' for f, k in daftar)
    return f'<div class="gbr">{isi}</div>'


def halaman(judul, alamat, isi):
    return f"""<!doctype html><html lang="id"><head><meta charset="utf-8"><title>{judul}</title><style>{CSS}</style></head><body>
<div class="kepala"><img src="file://{IKON}"><div><div class="k">PEMERINTAH KOTA TARAKAN · BAGIAN PROTOKOL DAN KOMUNIKASI PIMPINAN</div>
<h1>{judul}</h1><div class="a">{alamat}</div></div></div>
{isi}
<p class="kaki">Gambar dalam panduan ini memakai data contoh. Data pribadi pemohon hanya dipergunakan untuk pelayanan permohonan,
sesuai Kebijakan Privasi di prokopim.tarakankota.go.id/privasi.</p>
</body></html>"""


AUDIENSI = halaman("Panduan Permohonan Audiensi", "prokopim.tarakankota.go.id/tamu · Wali Kota dan Wakil Wali Kota Tarakan", f"""
<p>Masyarakat, organisasi, dan instansi dapat mengajukan permohonan audiensi (pertemuan) dengan Wali Kota atau Wakil Wali Kota
Tarakan secara daring, tanpa perlu datang atau menelepon terlebih dahulu. Pengajuan tidak memerlukan akun dan tidak dipungut biaya.</p>

<h2>1. Yang perlu disiapkan</h2>
<ul>
<li>Nomor <b>WhatsApp yang aktif</b>. Seluruh kabar tentang permohonan dikirim ke nomor ini.</li>
<li>Maksud dan keperluan audiensi yang jelas, misalnya kerja sama program, aspirasi warga, atau laporan kondisi.</li>
<li>Bila ada, usulan tanggal dan jam pertemuan (boleh dikosongkan).</li>
</ul>

<h2>2. Cara mengajukan</h2>
<div class="dua"><div>
<ol>
<li>Buka <b>prokopim.tarakankota.go.id/tamu</b> dari ponsel atau komputer.</li>
<li>Isi <b>Nama Lengkap</b> sesuai KTP atau identitas resmi.</li>
<li>Isi <b>Instansi/Organisasi</b> (kosongkan bila datang sebagai perorangan).</li>
<li>Isi <b>Nomor WhatsApp</b>, contoh 0812xxxxxxxx.</li>
<li>Pilih <b>pejabat yang ingin ditemui</b>: Wali Kota atau Wakil Wali Kota.</li>
<li>Tulis <b>Maksud &amp; Keperluan</b> secara singkat dan jelas (paling sedikit 10 karakter, paling banyak 500).</li>
<li>Bila ada, pilih <b>tanggal dan jam (WITA)</b> yang diinginkan, lalu tulis <b>pesan tambahan</b>.</li>
<li>Aktifkan <b>Membutuhkan Aksesibilitas Khusus</b> bila memerlukan kursi roda, pendamping, juru bahasa isyarat, dan sebagainya.</li>
<li>Baca dan centang persetujuan <b>Kebijakan Privasi</b>, lalu ketuk <b>Kirim Permohonan</b>.</li>
</ol>
</div><div style="flex:0 0 30%">{gambar(("tamu1.jpg", "Bagian awal formulir"))}</div></div>
{gambar(("tamu2.jpg", "Pejabat yang dituju dan maksud keperluan"), ("tamu3.jpg", "Persetujuan privasi dan tombol kirim"))}

<h2>3. Setelah permohonan terkirim</h2>
<ul>
<li>Layar menampilkan <b>Permohonan Berhasil Terkirim</b> beserta <b>Nomor Antrian</b> dan status <b>Menunggu Verifikasi</b>.
Simpan atau catat nomor antrian tersebut.</li>
<li>Permohonan diperiksa berjenjang oleh Bagian Protokol dan Komunikasi Pimpinan, lalu diputuskan oleh Pimpinan.
Bila data kurang jelas, petugas akan menghubungi Anda melalui WhatsApp.</li>
<li>Keputusan dikirim melalui WhatsApp, berupa salah satu dari:
  <ul>
  <li><b>Disetujui</b>, beserta tanggal, jam, dan tempat audiensi;</li>
  <li><b>Ditolak</b>, beserta alasannya; atau</li>
  <li><b>Diteruskan (didisposisikan)</b> kepada Perangkat Daerah yang berwenang menangani keperluan Anda.</li>
  </ul></li>
<li>Bila disetujui, mohon <b>hadir 15 menit sebelum jadwal</b> dan membawa identitas diri.</li>
</ul>

<h2>4. Ketentuan</h2>
<ul>
<li>Setelah mengirim, permohonan berikutnya baru dapat dikirim <b>10 menit</b> kemudian.</li>
<li>Satu nomor WhatsApp paling banyak memiliki <b>3 permohonan</b> yang masih diproses.</li>
<li>Permohonan dengan maksud, identitas, atau nomor yang tidak jelas tidak dapat diteruskan.</li>
<li>Keputusan menerima, menolak, atau meneruskan permohonan merupakan kewenangan Pimpinan.</li>
</ul>

<div class="kotak biru"><b class="j">Butuh bantuan?</b> Ketuk tombol <b>Kesulitan mengisi form? Hubungi Admin via WhatsApp</b>
di bagian bawah halaman formulir.</div>
""")

RUANGAN = halaman("Panduan Peminjaman Ruang Rapat", "prokopim.tarakankota.go.id/pinjamruangan · Bagian Protokol dan Komunikasi Pimpinan", f"""
<p>Instansi dan masyarakat dapat meminjam ruang rapat yang dikelola Bagian Protokol dan Komunikasi Pimpinan secara daring:
melihat jadwal yang masih kosong, mengajukan peminjaman, dan memantau statusnya sendiri. Tidak memerlukan akun.</p>

<h2>1. Halaman peminjaman</h2>
<p>Halaman ini memiliki tiga menu di bagian atas: <b>Kalender</b>, <b>Ajukan</b>, dan <b>Cek Status</b>.</p>
<table><tr><th>Sesi</th><th>Waktu (WITA)</th><th>Keterangan</th></tr>
<tr><td>Pagi</td><td>07.30 – 12.00</td><td>Tidak dapat dipakai bersamaan dengan Full Day</td></tr>
<tr><td>Siang</td><td>12.30 – 16.30</td><td>Tidak dapat dipakai bersamaan dengan Full Day</td></tr>
<tr><td>Full Day</td><td>07.30 – 16.30</td><td>Memakai sesi Pagi dan Siang sekaligus</td></tr></table>

<h2>2. Yang perlu disiapkan</h2>
<ul>
<li>Nomor <b>WhatsApp aktif</b> penanggung jawab (PIC). Kode peminjaman dan keputusan dikirim ke nomor ini.</li>
<li>Nama acara dan perkiraan jumlah peserta; jumlah peserta <b>tidak boleh melebihi kapasitas</b> ruangan.</li>
<li>Bila meminjam <b>lebih dari satu sesi atau tanggal</b>: nomor surat <b>Srikandi</b> dengan format nomor/nomor/instansi/tahun
(contoh 005/1234/SETDA/2026) <b>atau</b> berkas surat permohonan.</li>
</ul>

<h2>3. Cara mengajukan</h2>
<div class="dua"><div>
<ol>
<li>Buka <b>prokopim.tarakankota.go.id/pinjamruangan</b>.</li>
<li>Di menu <b>Kalender</b>, pilih ruangan dan bulan. Slot berwarna hijau masih tersedia; slot bertanda <b>TERISI</b> sudah dipakai.
Ketuk slot yang tersedia untuk langsung mengisi formulir.</li>
<li>Di menu <b>Ajukan</b>, centang daftar persiapan, lalu ketuk <b>Lanjutkan ke Formulir</b>.</li>
<li>Isi tiga tahap formulir:
 <ul>
 <li><b>Identitas &amp; Kegiatan</b>: instansi, nama PIC, WhatsApp PIC, nama acara, ruangan, jumlah peserta;</li>
 <li><b>Jadwal</b>: pilih tanggal dan sesi (boleh lebih dari satu);</li>
 <li><b>Konfirmasi</b>: periksa kembali, lalu kirim.</li>
 </ul></li>
<li>Catat <b>kode peminjaman</b> yang tampil di layar. Kode yang sama juga dikirim melalui WhatsApp.</li>
</ol>
</div><div style="flex:0 0 30%">{gambar(("ruang1.jpg", "Kalender ketersediaan ruangan"))}</div></div>
{gambar(("ruang2.jpg", "Daftar persiapan sebelum mengisi"), ("ruang3.jpg", "Formulir tahap Identitas & Kegiatan"), ("ruang5.jpg", "Menu Cek Status"))}

<h2>4. Memantau, mencetak, dan membatalkan</h2>
<ul>
<li>Buka menu <b>Cek Status</b>, lalu masukkan <b>kode peminjaman</b> atau <b>nomor WhatsApp PIC</b> (ditulis lengkap).</li>
<li>Permohonan diputuskan oleh pengelola ruangan; keputusan <b>disetujui</b> atau <b>ditolak beserta alasannya</b> dikirim melalui WhatsApp.</li>
<li>Bila <b>disetujui</b>: ketuk <b>Cetak Surat Konfirmasi</b> dan bawa saat menggunakan ruangan.</li>
<li>Bila masih <b>menunggu</b> dan batal dipakai: ketuk <b>Batalkan Pengajuan</b>.</li>
<li>Bila sudah <b>disetujui</b> lalu batal: ketuk <b>Ajukan Pembatalan</b> dan tuliskan alasannya. Pembatalan diproses pengelola ruangan
agar slot dapat dipakai pemohon lain.</li>
</ul>

<h2>5. Ketentuan</h2>
<ul>
<li>Setelah mengajukan, pengajuan berikutnya baru dapat dikirim <b>10 menit</b> kemudian.</li>
<li>Satu nomor WhatsApp paling banyak memiliki <b>3 pengajuan</b> yang masih menunggu keputusan.</li>
<li>Satu kode peminjaman dapat memuat beberapa tanggal dan sesi, dan diputuskan sekaligus.</li>
<li>Slot yang sudah disetujui untuk pemohon lain tidak dapat dipinjam pada sesi yang sama.</li>
<li>Kalender umum hanya menampilkan slot terisi atau kosong, tanpa nama maupun nomor pemohon lain.</li>
<li>Hubungi staf Bagian Protokol dan Komunikasi Pimpinan bila ada perubahan jadwal atau pembatalan mendadak.</li>
</ul>
""")


def main(keluar):
    os.makedirs(keluar, exist_ok=True)
    for nama, isi in (("audiensi.html", AUDIENSI), ("ruangan.html", RUANGAN)):
        p = os.path.join(keluar, nama)
        open(p, "w", encoding="utf-8").write(isi)
        print(p)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else D)
