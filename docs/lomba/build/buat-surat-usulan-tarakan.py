"""
Surat usulan Sekretaris Daerah untuk Lomba Inovasi Daerah Kota Tarakan 2026.

    python3 buat-surat-usulan-tarakan.py ../lampiran/Templat-Surat-Srikandi-Setda.docx ../tarakan/Surat-Usulan-Sekda-Lomba-Inovasi-Tarakan.docx

Isi mengikuti Lampiran 3 Petunjuk Teknis (Surat Usulan Perangkat Daerah):
Yth. Kepala Bappeda Litbang Kota Tarakan, Hal "Usulan Staf dan Inovasi",
Lampiran "-", lalu Inovasi, Nama Inovator, Lama Implementasi Inovasi, dan
Kategori di badan surat. Templat Srikandi yang sama dengan surat Kaltara
dipakai (lihat buat-surat-usulan.py); halaman lampirannya dibuang karena
format Tarakan tidak memakai lampiran.
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

def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
def isi(e, teks):
    """Ganti isi <w:t> berurutan; yang tidak diberi teks dikosongkan (format run tetap)."""
    it = iter(teks + [""] * 200)
    return re.sub(r'<w:t(?: [^>]*)?>[^<]*</w:t>', lambda m: f'<w:t xml:space="preserve">{esc(next(it))}</w:t>', e)

SUMBER = sys.argv[1]; KELUAR = sys.argv[2]
with zipfile.ZipFile(SUMBER) as z: x = z.read("word/document.xml").decode("utf8")
kepala, el, ekor = pecah(x)

JUDUL = "Prokopim Hibot: Superapp Pelayanan Keprotokolan dan Komunikasi Pimpinan Pemerintah Kota Tarakan"
TIM = ["Anugrah Yega Pranatha, M.Si. (Ketua)", "Saifullah, S.H.", "Juliyanti, S.AP.",
       "Pebriadi Banne, S.IP.", "Nuraini Wiliadewi, S.IP."]

el[6]  = isi(el[6],  ["  Lampiran", ": ", "-"])
el[7]  = isi(el[7],  ["  Perihal", ": ", "Usulan Staf dan Inovasi"])
el[10] = isi(el[10], ["Kepala Bappeda Litbang", "Kota Tarakan"])
el[12] = isi(el[12], ["TARAKAN"])
el[13] = isi(el[13], [
  "Dalam rangka mendukung pelaksanaan Lomba Inovasi Daerah Kota Tarakan Tahun 2026 yang diselenggarakan oleh "
  "Bappeda Litbang Kota Tarakan serta sebagai upaya meningkatkan budaya inovasi di lingkungan Pemerintah Daerah, "
  "bersama surat ini kami sampaikan usulan nama staf dan inovasi dari Sekretariat Daerah Kota Tarakan untuk dapat "
  "dipertimbangkan dan diikutsertakan dalam kompetisi tersebut."])

# Baris identitas usulan memakai gaya baris "label : nilai" dari templat (el[37]),
# dengan inden gantung supaya baris lanjutan sejajar sesudah titik dua.
TITIK2, NILAI = 3260, 3460                      # posisi titik dua dan nilai (DXA)
templat = re.sub(r'<w:tabs>.*?</w:tabs>', f'<w:tabs><w:tab w:val="left" w:pos="{TITIK2}"/><w:tab w:val="left" w:pos="{NILAI}"/></w:tabs>'
                 f'<w:ind w:left="{NILAI}" w:hanging="{NILAI}"/>', el[37], count=1, flags=re.S)
templat = templat.replace("<w:b/>", "").replace("<w:bCs/>", "")
kv = [("Inovasi", ":", JUDUL),
      ("Nama Inovator", ":", "Tim Inovasi Prokopim Hibot: " + ", ".join(TIM[:-1]) + ", dan " + TIM[-1]),
      ("Lama Implementasi Inovasi", ":", "±7 bulan (sejak Maret 2026)"),
       ("Kategori", ":", "A. Inovasi Tata Kelola Pemerintahan")]
baris = "".join(isi(templat, list(r)) for r in kv)

# Spasi badan surat 1,5 (templat: 2) supaya surat muat satu halaman.
for k in (13, 15):
    el[k] = el[k].replace('w:line="480"', 'w:line="360"', 1)
for k in (1, 3):                               # baris kosong di atas dan di bawah tanggal
    el[k] = el[k].replace('w:line="360"', 'w:line="240"', 1)
el[13] = el[13] + baris
el[15] = isi(el[15], ["Atas perhatian dan perkenan Bapak/Ibu, kami ucapkan terima kasih."])
# Dibuang: paragraf kedua templat (format Tarakan langsung menutup surat),
# tembusan (contoh format tidak memakainya), dan seluruh halaman lampiran
# templat (dokumentasi teknis).
buang = {14, *range(23, 75)}
el = [e for k, e in enumerate(el) if k not in buang]

baru = kepala + "".join(el) + ekor
shutil.copy(SUMBER, KELUAR)
with zipfile.ZipFile(SUMBER) as zi, zipfile.ZipFile(KELUAR, "w", zipfile.ZIP_DEFLATED) as zo:
    for item in zi.infolist():
        data = zi.read(item.filename)
        if item.filename == "word/document.xml": data = baru.encode("utf8")
        zo.writestr(item, data)
print("ok", KELUAR)
