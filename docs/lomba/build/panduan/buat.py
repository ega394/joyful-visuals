"""Buku Petunjuk Penggunaan Aplikasi Prokopim Hibot (PDF).

Isi alur kerja diambil langsung dari 11 SOP di docs/sop (Bagian Prosedur dan Peringatan),
sehingga buku ini tidak menyimpang dari SOP. Gambar memakai tangkapan layar berdata contoh
(docs/lomba/tarakan/tangkapan).

python3 buat.py <keluaran.html>   lalu   node pdf.mjs <keluaran.html> <keluaran.pdf>
"""
import html, os, re, sys

D = os.path.dirname(os.path.abspath(__file__))
AKAR = os.path.abspath(os.path.join(D, "..", "..", "..", ".."))
SOP = os.path.join(AKAR, "docs", "sop")
GBR = os.path.join(AKAR, "docs", "lomba", "tarakan", "tangkapan")
LOGO = os.path.join(AKAR, "public")

# Tangkapan layar per SOP: (berkas, keterangan, hp?)
GAMBAR = {
    1: [("kabag_antrian.jpg", "Antrian persetujuan Kepala Bagian", False), ("hp_walikota.jpg", "Agenda di ponsel Wali Kota", True)],
    2: [("kabag_usulan.jpg", "Usulan perubahan jadwal yang menunggu keputusan", False)],
    3: [("kabag_riwayat.jpg", "Riwayat alur: setiap perpindahan status tercatat", False)],
    4: [("kasubbag_personil.jpg", "Penugasan personil oleh Kasubbag", False), ("hp_staf.jpg", "Tugas di ponsel petugas", True)],
    5: [("kabag_tamu.jpg", "Permohonan audiensi dan tamu", False), ("hp_tamu.jpg", "Formulir permohonan audiensi daring", True)],
    6: [("kabag_ruangan_kalender.jpg", "Kalender ruangan", False), ("hp_ruangan.jpg", "Peminjaman ruangan dari ponsel", True)],
    7: [("staf_daftar_hadir.jpg", "Pengelolaan daftar hadir digital", False), ("hp_hadir.jpg", "Pengisian daftar hadir dengan kode QR", True)],
    8: [("kabag_komdok.jpg", "Naskah sambutan dan komunikasi pimpinan", False)],
    9: [("komdokpim_newsroom.jpg", "Newsroom: telaah caption dan bahan publikasi", False)],
    10: [("undangan_imbaya.jpg", "Hasil Generator Undangan", False)],
    11: [("kabag_rekap_evaluasi.jpg", "Rekap evaluasi petugas", False), ("staf_rekap_saya.jpg", "Rekap Kinerja Saya", False)],
}

PERAN = [
    ("Kepala Bagian", "Memutuskan jadwal, perubahan, penarikan, dan pembatalan; mengesahkan naskah sambutan; menetapkan PLH"),
    ("Kasubbag Protokol", "Menelaah jadwal, usulan perubahan, permohonan tamu, dan undangan; menugaskan petugas protokol"),
    ("Kasubbag Komunikasi dan Dokumentasi Pimpinan", "Menunjuk penyusun naskah; menelaah caption dan bahan publikasi; menugaskan petugas dokumentasi"),
    ("Admin Rencana Kegiatan", "Menginput jadwal dari undangan (bisa dengan pindai AI) dan memantau statusnya"),
    ("Admin Undangan", "Menyusun undangan kedinasan pada Generator Undangan"),
    ("Staf Protokol / Staf Komunikasi", "Melihat tugas, mengisi evaluasi, meliput, dan menyusun naskah"),
    ("Wali Kota / Wakil Wali Kota", "Melihat agenda, mengonfirmasi kehadiran, mendisposisi, dan memutuskan audiensi"),
    ("Ajudan", "Mengonfirmasi kehadiran pimpinan dan menerima naskah sambutan"),
    ("Mitra Kerja", "Melihat agenda pimpinan yang sudah dipublikasikan"),
]


def md(s):
    s = html.escape(s.strip())
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    return s.replace("&lt;br&gt;", "<br>")


def baca_sop(f):
    teks = open(os.path.join(SOP, f), encoding="utf-8").read()
    nama = re.search(r"\| \*\*Nama SOP\*\* \| (.+?) \|", teks).group(1).strip()
    m = re.search(r"\| \*\*Peringatan\*\* \| (.+?) \|\n", teks)
    peringatan = [re.sub(r"^\d+\.\s*", "", p) for p in m.group(1).split("<br>")] if m else []
    bagian = []
    for blok in re.split(r"\n(?=## )", teks):
        judul = blok.split("\n", 1)[0].lstrip("# ").strip()
        if not judul.startswith("Bagian Prosedur"):
            continue
        langkah = []
        for b in blok.splitlines():
            k = [x.strip() for x in b.strip().strip("|").split("|")]
            if len(k) >= 7 and k[0].isdigit():
                langkah.append({"no": k[0], "uraian": k[1], "pelaksana": k[2], "output": k[5], "ket": k[6]})
        sub = judul.replace("Bagian Prosedur", "").strip(" —")
        bagian.append((sub, langkah))
    return nama, peringatan, bagian


def gambar(f, ket, hp):
    p = os.path.join(GBR, f)
    if not os.path.exists(p):
        return ""
    kelas = "gbr hp" if hp else "gbr"
    return f'<figure class="{kelas}"><img src="file://{p}"><figcaption>{html.escape(ket)}</figcaption></figure>'


def bab_sop(no, f):
    nama, peringatan, bagian = baca_sop(f)
    out = [f'<section class="bab"><div class="nomor">ALUR {no}</div><h2>{html.escape(nama)}</h2>',
           f'<p class="rujuk">Rujukan: SOP {no} — {html.escape(nama)}</p>']
    gb = GAMBAR.get(no, [])
    if gb:
        out.append('<div class="galeri">' + "".join(gambar(*g) for g in gb) + "</div>")
    for sub, langkah in bagian:
        if sub:
            out.append(f"<h3>{html.escape(sub)}</h3>")
        out.append('<table class="langkah"><thead><tr><th>No</th><th>Yang dilakukan</th><th>Oleh</th><th>Hasil di aplikasi</th></tr></thead><tbody>')
        for l in langkah:
            ket = f'<div class="ket">{md(l["ket"])}</div>' if l["ket"] else ""
            out.append(f'<tr><td class="no">{l["no"]}</td><td>{md(l["uraian"])}{ket}</td><td>{md(l["pelaksana"])}</td><td>{md(l["output"])}</td></tr>')
        out.append("</tbody></table>")
    if peringatan:
        out.append('<div class="penting"><div class="jp">Hal penting</div><ul>' + "".join(f"<li>{md(p)}</li>" for p in peringatan) + "</ul></div>")
    out.append("</section>")
    return "\n".join(out)


def main(keluar):
    sop = sorted(f for f in os.listdir(SOP) if re.match(r"\d\d-.*\.md$", f) and not f.startswith("00"))
    daftar = "".join(f"<li><b>Alur {i}</b> — {html.escape(baca_sop(f)[0])}</li>" for i, f in enumerate(sop, 1))
    peran = "".join(f"<tr><td><b>{html.escape(a)}</b></td><td>{html.escape(b)}</td></tr>" for a, b in PERAN)
    css = open(os.path.join(D, "gaya.css"), encoding="utf-8").read()
    hib = os.path.join(LOGO, "icon-512x512.png")
    isi = f"""<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Buku Petunjuk Prokopim Hibot</title><style>{css}</style></head><body>
<section class="sampul">
  <div class="atas">PEMERINTAH KOTA TARAKAN<br><span>Sekretariat Daerah · Bagian Protokol dan Komunikasi Pimpinan</span></div>
  {f'<img class="ikon" src="file://{hib}">' if hib else ''}
  <h1>Buku Petunjuk Penggunaan<br><span>Aplikasi Prokopim Hibot</span></h1>
  <p class="sub">Superapp Pelayanan Keprotokolan dan Komunikasi Pimpinan</p>
  <p class="alamat">prokopim.tarakankota.go.id</p>
  <div class="bawah">Versi Oktober 2026</div>
</section>

<section class="bab">
<h2>1. Mengenal Prokopim Hibot</h2>
<p>Prokopim Hibot adalah aplikasi web (dapat dipasang di ponsel) yang menyatukan pekerjaan Bagian Protokol dan Komunikasi Pimpinan dalam satu pintu dan satu data: mulai dari undangan masuk, penetapan jadwal Pimpinan, penugasan petugas, naskah sambutan, peliputan, sampai evaluasi. Setiap langkah tercatat siapa, kapan, dan apa keputusannya.</p>
<p>Buku ini menjelaskan cara menggunakan aplikasi untuk setiap alur kerja. Urutan langkah pada setiap alur sama dengan Standar Operasional Prosedur (SOP) Bagian Protokol dan Komunikasi Pimpinan.</p>
<h3>Sebelas alur kerja</h3><ol class="alur">{daftar}</ol>
<h3>Peran pengguna</h3>
<p>Menu yang tampil menyesuaikan peran akun. Seseorang hanya melihat menu dan tombol sesuai kewenangannya.</p>
<table class="peran"><tbody>{peran}</tbody></table>
<div class="galeri">{gambar("kabag_kalender_bersama.jpg", "Kalender bersama agenda Pimpinan", False)}{gambar("hp_ajudan.jpg", "Tampilan ajudan di ponsel", True)}</div>
</section>

<section class="bab">
<h2>2. Memulai</h2>
<h3>Membuka aplikasi</h3>
<ol>
<li>Buka peramban (Chrome, Safari, atau lainnya) dan kunjungi <b>prokopim.tarakankota.go.id</b>.</li>
<li>Masukkan <b>nama pengguna</b> dan <b>kata sandi</b> yang diberikan pengelola aplikasi, lalu ketuk <b>Masuk</b>.</li>
<li>Pada saat pertama masuk, baca dan setujui pemberitahuan pelindungan data pribadi bila diminta.</li>
</ol>
<h3>Memasang di layar utama ponsel</h3>
<ul>
<li><b>iPhone (Safari):</b> ketuk ikon Bagikan, lalu pilih <b>Tambah ke Layar Utama</b>.</li>
<li><b>Android (Chrome):</b> ketuk menu titik tiga, lalu pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</li>
</ul>
<p>Setelah terpasang, aplikasi dibuka dari ikon Prokopim Hibot seperti aplikasi biasa. Izinkan notifikasi agar pemberitahuan tugas dan persetujuan sampai ke ponsel.</p>
<h3>Bagian layar</h3>
<ul>
<li><b>Bilah tab bawah</b> (di ponsel) berisi menu utama sesuai peran, misalnya Antrian, Agenda, Tamu, Penugasan, atau Newsroom. Menu lain ada di <b>Lainnya</b>.</li>
<li><b>Angka merah</b> pada tab menunjukkan jumlah pekerjaan yang menunggu tindakan Anda di tab tersebut.</li>
<li><b>Lonceng</b> di kanan atas membuka Pusat Notifikasi: jadwal hari ini, tugas, dan pengingat.</li>
<li>Pemberitahuan juga dikirim melalui <b>WhatsApp</b>. Waktu yang dipakai adalah <b>WITA</b>.</li>
</ul>
<h3>Pengingat otomatis</h3>
<table class="peran"><tbody>
<tr><td><b>06.30</b></td><td>Rekap agenda harian kepada Pimpinan</td></tr>
<tr><td><b>07.30</b></td><td>Rekap agenda harian kepada seluruh petugas</td></tr>
<tr><td><b>15.55</b></td><td>Pengingat kegiatan H-1</td></tr>
<tr><td><b>16.00</b></td><td>Pengingat kepada ajudan dan pengingat tunggakan persetujuan</td></tr>
<tr><td><b>H-12 jam</b></td><td>Peringatan jadwal yang belum memiliki petugas</td></tr>
</tbody></table>
<h3>Pejabat berhalangan (PLH)</h3>
<p>Bila Kepala Bagian atau Kepala Sub Bagian berhalangan, Kepala Bagian dapat menetapkan Pelaksana Harian (PLH) di aplikasi. Kewenangan PLH berlaku pada rentang tanggal yang ditetapkan dan berakhir sendiri pada tanggal akhirnya.</p>
<div class="galeri">{gambar("kabag_plh.jpg", "Penetapan Pelaksana Harian", False)}</div>
<h3>Keluar</h3>
<p>Buka <b>Lainnya</b>, lalu ketuk <b>Keluar dari Akun</b>. Jangan membagikan kata sandi kepada orang lain.</p>
</section>

{"".join(bab_sop(i, f) for i, f in enumerate(sop, 1))}

<section class="bab">
<h2>Laporan dan rekap</h2>
<p>Kepala Bagian dan Kepala Sub Bagian dapat melihat laporan kegiatan, rekap penugasan, rekap evaluasi, dan rekap pesan WhatsApp. Setiap pegawai dapat melihat <b>Rekap Kinerja Saya</b> dan mencetak bukti dukung kinerja dari menu Lainnya.</p>
<div class="galeri">{gambar("kabag_laporan.jpg", "Laporan kegiatan", False)}{gambar("kabag_rekap_wa.jpg", "Rekap pesan WhatsApp beserta status terkirim", False)}</div>
<h2>Bantuan</h2>
<p>Kendala penggunaan, lupa kata sandi, atau permintaan akun baru disampaikan kepada pengelola aplikasi di Bagian Protokol dan Komunikasi Pimpinan, Sekretariat Daerah Kota Tarakan.</p>
<p class="catatan">Gambar dalam buku ini memakai data contoh.</p>
</section>
</body></html>"""
    open(keluar, "w", encoding="utf-8").write(isi)
    print(keluar)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, "panduan.html"))
