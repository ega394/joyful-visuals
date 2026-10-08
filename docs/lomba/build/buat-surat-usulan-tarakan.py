"""
Surat usulan Sekretaris Daerah untuk Lomba Inovasi Daerah Kota Tarakan 2026.

    python3 buat-surat-usulan-tarakan.py ../lampiran/Templat-Surat-Srikandi-Setda.docx ../tarakan/Surat-Usulan-Sekda-Lomba-Inovasi-Tarakan.docx

Isi dan susunan mengikuti Lampiran 3 Petunjuk Teknis (Surat Usulan Perangkat
Daerah): No / Lampiran "-" / Hal "Usulan Staf dan Inovasi"; "Yth. Kepala
Bappeda Litbang Kota Tarakan", di, Tarakan; "Dengan hormat,"; paragraf pembuka
dengan nama lomba bercetak tebal; Inovasi, Nama Inovator, Lama Implementasi
Inovasi, dan Kategori (label tebal); kalimat penutup. Templat Srikandi yang sama dengan surat Kaltara
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

# Paragraf baru dibangun dengan gaya huruf templat (Arial 12).
RPR = ('<w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Calibri" w:hAnsi="Arial" w:cs="Arial"/>{b}'
       '<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>')
def run(t, tebal=False, tab=False):
    return ("<w:r>" + RPR.format(b="<w:b/><w:bCs/>" if tebal else "") + ("<w:tab/>" if tab else "")
            + f'<w:t xml:space="preserve">{esc(t)}</w:t></w:r>')
def para(runs, ppr):
    return f"<w:p><w:pPr>{ppr}</w:pPr>{''.join(runs)}</w:p>"
SPASI = '<w:spacing w:before="{sb}" w:after="0" w:line="276" w:lineRule="auto"/>'

# ── Kepala surat: No / Lampiran / Hal (Lampiran 3 Petunjuk Teknis) ──
el[4] = el[4].replace(">  Nomor<", ">  No<", 1)
el[6] = isi(el[6], ["  Lampiran", ": ", "-"])
el[7] = isi(el[7].replace('<w:u w:val="single"/>', ""), ["  Hal", ": ", "Usulan Staf dan Inovasi"])
# Titik dua ketiga baris sejajar pada satu tab tetap (tanpa "Sifat", "No" lebih pendek dari "Nomor").
for k in (4, 6, 7):
    el[k] = re.sub(r"<w:tabs>.*?</w:tabs>", "", el[k], flags=re.S)
    el[k] = el[k].replace("<w:pPr>", '<w:pPr><w:tabs><w:tab w:val="left" w:pos="1276"/></w:tabs>', 1)

# ── Tujuan: satu baris "Yth. Kepala Bappeda Litbang Kota Tarakan", lalu di / Tarakan ──
el[9] = isi(el[9], ["  Yth. Kepala Bappeda Litbang Kota Tarakan"])
el[11] = isi(el[11].replace('w:before="240" ', ""), ["di", "", ""])
el[12] = isi(el[11], ["Tarakan", "", ""])

# ── Isi surat ──
rata = '<w:jc w:val="both"/>'
isi_surat = [
  para([run("Dengan hormat,")], SPASI.format(sb=360)),
  para([run("Dalam rangka mendukung pelaksanaan "), run("Lomba Inovasi Daerah Kota Tarakan Tahun 2026", True),
        run(" yang diselenggarakan oleh Bappeda Litbang Kota Tarakan serta sebagai upaya meningkatkan budaya "
            "inovasi di lingkungan Pemerintah Daerah, bersama surat ini kami sampaikan usulan nama staf dan inovasi "
            "dari Sekretariat Daerah Kota Tarakan untuk dapat dipertimbangkan dan diikutsertakan dalam kompetisi tersebut.")],
       SPASI.format(sb=60) + rata),
]
# Baris identitas usulan: label tebal menjorok, titik dua dan nilai sejajar.
KIRI, TITIK2, NILAI = 284, 3828, 4026
tabs = (f'<w:tabs><w:tab w:val="left" w:pos="{TITIK2}"/><w:tab w:val="left" w:pos="{NILAI}"/></w:tabs>'
        f'<w:spacing w:before="40" w:after="0" w:line="264" w:lineRule="auto"/><w:ind w:left="{NILAI}" w:hanging="{NILAI - KIRI}"/>')
for label, nilai in [
    ("Inovasi", JUDUL),
    ("Nama Inovator", "Tim Inovasi Prokopim Hibot: " + ", ".join(TIM[:-1]) + ", dan " + TIM[-1]),
    ("Lama Implementasi Inovasi", "±7 bulan (sejak Maret 2026)"),
    ("Kategori", "A. Inovasi Tata Kelola Pemerintahan"),
]:
    isi_surat.append(para([run(label, True), run(":", True, tab=True), run(nilai, tab=True)], tabs))
isi_surat.append(para([run("Atas perhatian dan perkenan Bapak/Ibu, kami ucapkan terima kasih.")], SPASI.format(sb=120) + rata))
el[13] = "".join(isi_surat)

# Dibuang: Sifat (tidak ada pada format), baris kedua tujuan templat, paragraf
# templat lainnya, tembusan, dan seluruh halaman lampiran templat.
buang = {5, 10, 14, 15, *range(23, 75)}
el = [e for k, e in enumerate(el) if k not in buang]

baru = kepala + "".join(el) + ekor
shutil.copy(SUMBER, KELUAR)
with zipfile.ZipFile(SUMBER) as zi, zipfile.ZipFile(KELUAR, "w", zipfile.ZIP_DEFLATED) as zo:
    for item in zi.infolist():
        data = zi.read(item.filename)
        if item.filename == "word/document.xml": data = baru.encode("utf8")
        zo.writestr(item, data)
print("ok", KELUAR)
