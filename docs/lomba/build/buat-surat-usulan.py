"""
Surat usulan Sekretaris Daerah untuk Kaltara Innovation Awards 2026.

    python3 buat-surat-usulan.py ../lampiran/Templat-Surat-Srikandi-Setda.docx ../Surat-Usulan-Sekda-Kaltara-Innovation-Awards.docx

Templatnya adalah surat permohonan integrasi website (Srikandi) yang sudah
dipakai Setda. Berkas itu disalin utuh dan hanya teksnya yang diganti, sehingga
kop, huruf, tata letak, dan variabel Srikandi (${nomor_naskah}, ${tanggal_naskah},
${ttd_pengirim}, dst.) tetap persis sama. Indeks elemen di bawah mengacu pada
urutan paragraf/tabel templat tersebut.
"""
import re, shutil, sys, zipfile

def pecah(x):
    a=x.index('<w:body>')+8; b=x.index('</w:body>')
    body=x[a:b]; el=[]; i=0
    while i<len(body):
        m=re.match(r'<(w:p|w:tbl|w:sectPr)\b',body[i:])
        if not m: i+=1; continue
        tag=m.group(1); depth=0
        pat=re.compile(r'<(/?)'+tag+r'(?=[ >/])[^>]*?(/?)>')
        for mm in pat.finditer(body,i):
            if mm.group(1)=='/': depth-=1
            elif mm.group(2)=='/': pass
            else: depth+=1
            if depth==0: j=mm.end(); break
        el.append(body[i:j]); i=j
    return x[:a], el, x[b:]
def ts(e): return re.findall(r'<w:t(?: [^>]*)?>([^<]*)</w:t>',e)

SUMBER = sys.argv[1]; KELUAR = sys.argv[2]

def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
def isi(e, teks):
    """Ganti isi <w:t> berurutan; yang tidak diberi teks dikosongkan (format run tetap)."""
    it = iter(teks + [""] * 200)
    return re.sub(r'<w:t(?: [^>]*)?>[^<]*</w:t>', lambda m: f'<w:t xml:space="preserve">{esc(next(it))}</w:t>', e)

with zipfile.ZipFile(SUMBER) as z: x = z.read("word/document.xml").decode("utf8")
kepala, el, ekor = pecah(x)

JUDUL = "Prokopim Hibot: Satu Alur Digital Terverifikasi untuk Tata Kelola Agenda dan Keprotokolan Pimpinan Daerah"
el[7]  = isi(el[7],  ["  Perihal", ": ", "Usulan Peserta Lomba Inovasi Daerah Tahun 2026"])
el[10] = isi(el[10], ["Kepala Badan Perencanaan Pembangunan, Riset dan Inovasi Daerah", "Provinsi Kalimantan Utara"])
el[12] = isi(el[12], ["TANJUNG SELOR"])
el[13] = isi(el[13], [
  "Sehubungan dengan dilaksanakannya Lomba Inovasi Daerah Tingkat Provinsi Kalimantan Utara Tahun 2026 dan dengan memperhatikan "
  "Panduan Teknis lomba dimaksud, maka dengan ini disampaikan bahwa Sekretariat Daerah Kota Tarakan berpartisipasi pada lomba tersebut."])
el[14] = isi(el[14], [
  "Adapun inovasi yang diusulkan yaitu " + JUDUL + " dari Bagian Protokol dan Komunikasi Pimpinan Sekretariat Daerah Kota Tarakan, "
  "pada kategori Inovasi Terapan – ASN Pemerintah Kabupaten/Kota dengan Bidang Fokus Tata Kelola Kolaboratif dan Pelayanan Publik. "
  "Inovasi tersebut telah diterapkan sejak Maret 2026 dan pelaksanaannya dikuatkan dengan Keputusan Sekretaris Daerah Kota Tarakan "
  "Nomor 100.3.3.6/98/HK/VIII/2026. Susunan tim inovator dan identitas usulan disertakan pada lampiran surat ini, sedangkan proposal "
  "beserta dokumen pendukungnya diunggah melalui laman sirindaku.kaltaraprov.go.id."])
el[15] = isi(el[15], ["Demikian usulan ini disampaikan. Atas perhatian dan kerja samanya diucapkan terima kasih."])

# ── Lampiran surat ──
el[33] = isi(el[33], ["SUSUNAN TIM DAN IDENTITAS USULAN INOVASI"])
el[34] = isi(el[34], ["Kaltara Innovation Awards Tahun 2026"])
el[35] = isi(el[35], ["IDENTITAS USULAN"])
kv = [("Judul Inovasi", JUDUL),
      ("Kategori", "Inovasi Terapan – ASN Pemerintah Kabupaten/Kota"),
      ("Bidang Fokus", "Tata Kelola Kolaboratif dan Pelayanan Publik"),
      ("Instansi", "Bagian Protokol dan Komunikasi Pimpinan Sekretariat Daerah Kota Tarakan"),
      ("Mulai Diterapkan", "Maret 2026")]
# Semua baris mengikuti baris pertama contoh (label tebal, nilai biasa), dengan
# inden gantung supaya baris lanjutan nilai sejajar setelah titik dua.
templat = el[37].replace("</w:tabs>", '</w:tabs><w:ind w:left="2410" w:hanging="2410"/>', 1)
for k,(a,b) in zip(range(37,42), kv):
    el[k] = isi(templat, [a, ":", b])
el[55] = isi(el[55], ["SUSUNAN TIM INOVASI"])

# Tabel 4 kolom: No | Nama | Jabatan | Kedudukan dalam Tim
tim = [["No", "Nama", "Jabatan", "Kedudukan dalam Tim"],
       ["1", "Anugrah Yega Pranatha, M.Si.", "Kepala Bagian Protokol dan Komunikasi Pimpinan", "Ketua"],
       ["2", "Saifullah, S.H.", "Kepala Sub Bagian Protokol", "Anggota"],
       ["3", "Juliyanti, S.AP.", "Kepala Sub Bagian Komunikasi dan Dokumentasi Pimpinan", "Anggota"],
       ["4", "Mastura, S.Sos.", "Penelaah Teknis Kebijakan", "Anggota"],
       ["5", "Ni Kade Sari Handayani, S.AP.", "Penata Keprotokolan", "Anggota"]]
lebar = [600, 3300, 3760, 1700]
t = el[57]
gi = iter(lebar); t = re.sub(r'<w:gridCol w:w="\d+"/>', lambda m: f'<w:gridCol w:w="{next(gi)}"/>', t)
def baris(tr, nilai):
    sel = iter(nilai); lb = iter(lebar)
    def ganti_sel(m):
        c = re.sub(r'<w:tcW w:w="\d+"', f'<w:tcW w:w="{next(lb)}"', m.group(0))
        return isi(c, [next(sel)])
    return re.sub(r'<w:tc>.*?</w:tc>', ganti_sel, tr, flags=re.S)
tr = iter(tim)
t = re.sub(r'<w:tr[ >].*?</w:tr>', lambda m: baris(m.group(0), next(tr)), t, flags=re.S)
el[57] = t

el[59] = isi(el[59], ["KONTAK KETUA TIM"])
el[60] = isi(el[60], ["Tim Inovasi Prokopim Hibot"])
el[62] = isi(el[62], ["Nama: Anugrah Yega Pranatha, M.Si.", "Jabatan: Kepala Bagian Protokol dan Komunikasi Pimpinan"])
el[64] = isi(el[64], ["WhatsApp", ": 0811-5900-394"])

# Buang dokumentasi teknis yang tidak relevan: subjudul DNS, infrastruktur, spesifikasi, "Kontak Utama:"
buang = {36, *range(42, 55), 60, 61, 65, 74}
el = [e for k, e in enumerate(el) if k not in buang]

baru = kepala + "".join(el) + ekor
shutil.copy(SUMBER, KELUAR)
with zipfile.ZipFile(SUMBER) as zi, zipfile.ZipFile(KELUAR, "w", zipfile.ZIP_DEFLATED) as zo:
    for item in zi.infolist():
        data = zi.read(item.filename)
        if item.filename == "word/document.xml": data = baru.encode("utf8")
        zo.writestr(item, data)
print("ok", KELUAR)
