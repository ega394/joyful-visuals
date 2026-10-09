"""
Surat usulan Sekretaris Daerah untuk Lomba Inovasi Daerah Kota Tarakan 2026.

    python3 buat-surat-usulan-tarakan.py ../lampiran/Templat-Surat-Usulan-Tarakan.docx ../tarakan/Surat-Usulan-Sekda-Lomba-Inovasi-Tarakan.docx

Templat = surat usulan Tarakan yang sudah dirapikan Kabag di Word (kop, letak
logo, susunan Nomor/Sifat/Lampiran/Perihal, Yth./di-/TARAKAN, blok tanda
tangan Srikandi, tembusan 10 pt). Susunan itu dipertahankan; isinya dibuat
SATU HALAMAN sesuai Lampiran 3 Petunjuk Teknis Kota Tarakan: Lampiran "-",
kalimat pembuka pedoman, lalu Inovasi, Nama Inovator, Lama Implementasi
Inovasi, dan Kategori di badan surat, dan kalimat penutup pedoman. Halaman
lampiran pada templat dibuang. Variabel Srikandi tetap utuh.
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
def ts(e): return re.findall(r'<w:t(?: [^>]*)?>([^<]*)</w:t>', e)
def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
def isi(e, teks):
    """Ganti isi <w:t> berurutan; yang tidak diberi teks dikosongkan (format run tetap)."""
    it = iter(teks + [""] * 200)
    return re.sub(r'<w:t(?: [^>]*)?>[^<]*</w:t>', lambda m: f'<w:t xml:space="preserve">{esc(next(it))}</w:t>', e)
def cari(el, awal):
    """Indeks elemen pertama yang teksnya diawali `awal` — tidak bergantung urutan pasti."""
    return next(i for i, e in enumerate(el) if "".join(ts(e)).strip().startswith(awal))

SUMBER = sys.argv[1]; KELUAR = sys.argv[2]
with zipfile.ZipFile(SUMBER) as z: x = z.read("word/document.xml").decode("utf8")
kepala, el, ekor = pecah(x)
el = [re.sub(r"<w:lastRenderedPageBreak/>", "", e) for e in el]

JUDUL = "Prokopim Hibot: Superapp Pelayanan Keprotokolan dan Komunikasi Pimpinan Pemerintah Kota Tarakan"
TIM = ["Anugrah Yega Pranatha, M.Si. (Ketua)", "Saifullah, S.H.", "Juliyanti, S.AP.",
       "Pebriadi Banne, S.IP.", "Nuraini Wiliadewi, S.IP."]
IDENTITAS = [
    ("Inovasi", JUDUL),
    ("Nama Inovator", "Tim Inovasi Prokopim Hibot: " + ", ".join(TIM[:-1]) + ", dan " + TIM[-1]),
    ("Lama Implementasi Inovasi", "±7 bulan (sejak Maret 2026)"),
    ("Kategori", "A. Inovasi Tata Kelola Pemerintahan"),
]

iLamp, iP1, iP2, iP3 = cari(el, "Lampiran"), cari(el, "Dalam rangka"), cari(el, "Adapun inovasi"), cari(el, "Demikian")
el[iLamp] = isi(el[iLamp], ["  Lampiran", ": ", "-"])

# Paragraf isi: spasi 1,15 (templat: 2), seperti contoh pada pedoman, supaya
# seluruh isi pedoman muat satu halaman.
def spasi(e, line, before):
    return re.sub(r'<w:spacing [^>]*/>', f'<w:spacing w:before="{before}" w:after="0" w:line="{line}" w:lineRule="auto"/>', e, count=1)
el[iP1] = spasi(isi(el[iP1], [
  "Dalam rangka mendukung pelaksanaan Lomba Inovasi Daerah Kota Tarakan Tahun 2026 yang diselenggarakan "
  "oleh Bappeda Litbang Kota Tarakan serta sebagai upaya meningkatkan budaya inovasi di lingkungan "
  "Pemerintah Daerah, bersama surat ini kami sampaikan usulan nama staf dan inovasi dari Sekretariat "
  "Daerah Kota Tarakan untuk dapat dipertimbangkan dan diikutsertakan dalam kompetisi tersebut."]), 276, 160)

# Identitas usulan: gaya baris "label : nilai" milik templat (label tebal, rata
# kiri seperti tabel identitas pada lampiran templat), titik dua dan nilai
# sejajar, baris lanjutan rata nilai. Label terpanjang "Lama Implementasi
# Inovasi" menentukan letak titik dua.
i_kv = cari(el, "Inovasi")  # baris identitas pada halaman lampiran templat
KIRI, TITIK2, NILAI = 0, 3402, 3544
gaya = re.sub(r"<w:tabs>.*?</w:tabs>", f'<w:tabs><w:tab w:val="left" w:pos="{TITIK2}"/><w:tab w:val="left" w:pos="{NILAI}"/></w:tabs>', el[i_kv], count=1, flags=re.S)
gaya = re.sub(r'<w:ind [^>]*/>', f'<w:ind w:left="{NILAI}" w:hanging="{NILAI - KIRI}"/>', gaya, count=1)
gaya = re.sub(r'<w:spacing [^>]*/>', '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>', gaya, count=1)
el[iP2] = "".join(isi(gaya, [a, ":", b]) for a, b in IDENTITAS)

el[iP3] = spasi(isi(el[iP3], ["Atas perhatian dan perkenan Bapak/Ibu, kami ucapkan terima kasih."]), 276, 120)

# "TARAKAN" berspasi tunggal (templat: ganda) dan baris kosong sebelum tembusan
# tanpa jarak tambahan — sisa ruang untuk QR TTE di blok tanda tangan tetap.
iKota = cari(el, "TARAKAN")
el[iKota] = el[iKota].replace('w:line="480"', 'w:line="240"', 1)
iTemb0 = cari(el, "Tembusan") - 1
el[iTemb0] = el[iTemb0].replace('w:before="240" ', '', 1)
# Jarak sebelum tujuan surat dan "di-" sedikit dirapatkan (templat: 240).
for awal in ("Kepala Bappeda", "di-"):
    k = cari(el, awal); el[k] = el[k].replace('w:before="240"', 'w:before="120"', 1)

# Buang halaman lampiran templat: dari paragraf berpindah-halaman sesudah
# tembusan sampai sebelum sectPr akhir.
iTemb = cari(el, "Tembusan")
akhir = len(el) - 1
assert el[akhir].startswith("<w:sectPr")
el = el[:iTemb + 2] + [el[akhir]]

baru = kepala + "".join(el) + ekor
shutil.copy(SUMBER, KELUAR)
with zipfile.ZipFile(SUMBER) as zi, zipfile.ZipFile(KELUAR, "w", zipfile.ZIP_DEFLATED) as zo:
    for item in zi.infolist():
        data = zi.read(item.filename)
        if item.filename == "word/document.xml": data = baru.encode("utf8")
        zo.writestr(item, data)
print("ok", KELUAR)
