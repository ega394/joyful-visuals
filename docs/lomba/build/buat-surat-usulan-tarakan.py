"""
Surat usulan Sekretaris Daerah untuk Lomba Inovasi Daerah Kota Tarakan 2026.

    python3 buat-surat-usulan-tarakan.py ../lampiran/Templat-Surat-Srikandi-Setda.docx ../tarakan/Surat-Usulan-Sekda-Lomba-Inovasi-Tarakan.docx

Tata naskah dan kerapiannya mengikuti surat usulan Kaltara versi akhir yang
sudah dirapikan Kabag (Lampiran "1 (satu) halaman", judul inovasi bertanda
kutip, jabatan "SEKRETARIS DAERAH", tembusan 10 pt, "NIP." tidak tebal, kolom
nama tabel tim lebar). Isinya memuat unsur Lampiran 3 Petunjuk Teknis Kota
Tarakan: Hal "Usulan Staf dan Inovasi", kalimat pembuka pedoman, serta
Inovasi, Nama Inovator, Lama Implementasi Inovasi, dan Kategori (pada lampiran
surat). Templat Srikandi yang sama dengan surat Kaltara dipakai; variabel
Srikandi (${nomor_naskah}, ${ttd_pengirim}, dst.) tetap utuh.
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

def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
def isi(e, teks):
    """Ganti isi <w:t> berurutan; yang tidak diberi teks dikosongkan (format run tetap)."""
    it = iter(teks + [""] * 200)
    return re.sub(r'<w:t(?: [^>]*)?>[^<]*</w:t>', lambda m: f'<w:t xml:space="preserve">{esc(next(it))}</w:t>', e)

SUMBER = sys.argv[1]; KELUAR = sys.argv[2]

with zipfile.ZipFile(SUMBER) as z: x = z.read("word/document.xml").decode("utf8")
kepala, el, ekor = pecah(x)

JUDUL = "Prokopim Hibot: Superapp Pelayanan Keprotokolan dan Komunikasi Pimpinan Pemerintah Kota Tarakan"
KATEGORI = "A. Inovasi Tata Kelola Pemerintahan"
TIM = [["1", "Anugrah Yega Pranatha, M.Si.", "Kepala Bagian Protokol dan Komunikasi Pimpinan", "Ketua"],
       ["2", "Saifullah, S.H.", "Kepala Sub Bagian Protokol", "Anggota"],
       ["3", "Juliyanti, S.AP.", "Kepala Sub Bagian Komunikasi dan Dokumentasi Pimpinan", "Anggota"],
       ["4", "Pebriadi Banne, S.IP.", "Pengelola Layanan Operasional", "Anggota"],
       ["5", "Nuraini Wiliadewi, S.IP.", "Penelaah Teknis Kebijakan", "Anggota"]]

def tanpa_tebal_nip(e):
    """ "NIP." biasa, nomornya tetap tebal — seperti pada contoh."""
    i = e.index(">NIP. </w:t>"); j = e.rindex("<w:r", 0, i)
    return e[:j] + e[j:i].replace("<w:b/><w:bCs/>", "") + e[i:]

# ── Halaman 1: surat ──
el[6]  = isi(el[6],  ["  Lampiran", ": ", "1 (satu) halaman"])
el[7]  = isi(el[7],  ["  Perihal", ": ", "Usulan Staf dan Inovasi"])
el[10] = isi(el[10], ["Kepala Bappeda Litbang", "Kota Tarakan"])
el[12] = isi(el[12], ["TARAKAN"])
el[13] = isi(el[13], [
  "Dalam rangka mendukung pelaksanaan Lomba Inovasi Daerah Kota Tarakan Tahun 2026 yang diselenggarakan "
  "oleh Bappeda Litbang Kota Tarakan serta sebagai upaya meningkatkan budaya inovasi di lingkungan "
  "Pemerintah Daerah, bersama surat ini kami sampaikan usulan nama staf dan inovasi dari Sekretariat "
  "Daerah Kota Tarakan untuk dapat dipertimbangkan dan diikutsertakan dalam kompetisi tersebut."])
el[14] = isi(el[14], [
  "Adapun inovasi yang diikutsertakan yaitu “" + JUDUL + "” pada Kategori " + KATEGORI +
  " dengan susunan tim dan identitas usulan terlampir. Proposal dan dokumen pendukungnya diunggah "
  "melalui aplikasi RISDA."])
el[15] = isi(el[15], ["Demikian usulan ini disampaikan. Atas perhatian dan perkenan Bapak/Ibu, diucapkan terima kasih."])
el[16] = isi(el[16], ["SEKRETARIS DAERAH", "", ""])
el[22] = tanpa_tebal_nip(el[22])
# Tembusan 10 pt; satu tujuan saja, tanpa nomor.
for k in (24, 25):
    el[k] = el[k].replace('<w:sz w:val="24"/>', '<w:sz w:val="20"/>').replace('<w:szCs w:val="24"/>', '<w:szCs w:val="20"/>')
el[25] = re.sub(r"<w:pStyle [^>]*/><w:numPr>.*?</w:numPr>", "", el[25], flags=re.S)
el[25] = isi(el[25], ["Wali Kota Tarakan.", ""])

# ── Halaman 2: lampiran surat ──
el[33] = isi(el[33], ["SUSUNAN TIM DAN IDENTITAS USULAN INOVASI"])
el[34] = isi(el[34], ["Lomba Inovasi Daerah Kota Tarakan Tahun 2026"])
el[35] = isi(el[35], ["IDENTITAS USULAN"])
kv = [("Inovasi", JUDUL),
      ("Nama Inovator", "Tim Inovasi Prokopim Hibot (susunan tim di bawah)"),
      ("Lama Implementasi Inovasi", "±7 bulan (sejak Maret 2026)"),
      ("Kategori", KATEGORI),
      ("Instansi", "Bagian Protokol dan Komunikasi Pimpinan Sekretariat Daerah Kota Tarakan")]
# Label terpanjang ("Lama Implementasi Inovasi") menentukan letak titik dua;
# baris lanjutan nilai sejajar sesudah titik dua.
TITIK2, NILAI = 3402, 3544
templat = re.sub(r"<w:tabs>.*?</w:tabs>", f'<w:tabs><w:tab w:val="left" w:pos="{TITIK2}"/><w:tab w:val="left" w:pos="{NILAI}"/></w:tabs>'
                 f'<w:ind w:left="{NILAI}" w:hanging="{NILAI}"/>', el[37], count=1, flags=re.S)
el[37] = "".join(isi(templat, [a, ":", b]) for a, b in kv)
for k in range(38, 42): el[k] = ""
el[55] = isi(el[55], ["SUSUNAN TIM INOVASI"])

# Tabel 4 kolom, lebar kolom seperti contoh (nama tidak terpotong); kolom No
# sedikit lebih lebar supaya "No" tidak terpenggal pada LibreOffice.
tim = [["No", "Nama", "Jabatan", "Kedudukan dalam Tim"]] + TIM
lebar = [620, 3484, 3748, 1508]
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
el[62] = isi(el[62], ["Nama: Anugrah Yega Pranatha, M.Si.", "Jabatan: Kepala Bagian Protokol dan Komunikasi Pimpinan"])
el[64] = isi(el[64], ["WhatsApp", ": 0811-5900-394"])
el[73] = tanpa_tebal_nip(el[73])

# Buang: tembusan kedua, dokumentasi teknis templat (DNS, infrastruktur,
# spesifikasi), subjudul "Support", "Kontak Utama:", dan paragraf kosong sisa.
buang = {26, 36, *range(42, 55), 60, 61, 65, 74}
el = [e for k, e in enumerate(el) if k not in buang]

baru = kepala + "".join(el) + ekor
shutil.copy(SUMBER, KELUAR)
with zipfile.ZipFile(SUMBER) as zi, zipfile.ZipFile(KELUAR, "w", zipfile.ZIP_DEFLATED) as zo:
    for item in zi.infolist():
        data = zi.read(item.filename)
        if item.filename == "word/document.xml": data = baru.encode("utf8")
        zo.writestr(item, data)
print("ok", KELUAR)
