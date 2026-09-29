"""
Lampiran 3 — bukti identitas anggota tim, dari pindaian di docs/lomba/rahasia/identitas/.

    python3 identitas.py <folder-identitas> <keluaran.pdf>

Berkas bernama menurut nomor urut tim: 1.jpg ... 5.jpg (jpg/jpeg/png). Pemotongan
opsional di potong.json: {"5": [x0, y0, x1, y1]} dalam piksel. Anggota yang
belum ada pindaiannya ditandai kotak "menyusul" agar kekurangannya terlihat.

KTP memuat NIK: folder masukan dan PDF keluaran berada di docs/lomba/rahasia/
yang dikecualikan dari git.
"""
import json
import os
import sys

import pymupdf

TIM = [
    ("1", "Anugrah Yega Pranatha, M.Si.", "Ketua"),
    ("2", "Saifullah, S.H.", "Sekretaris I"),
    ("3", "Juliyanti, S.AP.", "Sekretaris II"),
    ("4", "Mastura, S.Sos.", "Anggota"),
    ("5", "Ni Kade Sari Handayani, S.AP.", "Anggota"),
]
folder, keluar = sys.argv[1:3]
potong = {}
if os.path.exists(os.path.join(folder, "potong.json")):
    potong = json.load(open(os.path.join(folder, "potong.json")))

def cari(no):
    for ext in ("jpg", "jpeg", "png"):
        f = os.path.join(folder, f"{no}.{ext}")
        if os.path.exists(f):
            return f
    return None

mm = 72 / 25.4
doc = pymupdf.open()
LEBAR = 120 * mm            # lebar gambar kartu di halaman
KIRI = (210 * mm - LEBAR) / 2
kurang = []
for k, (no, nama, peran) in enumerate(TIM):
    if k % 2 == 0:
        hal = doc.new_page(width=210 * mm, height=297 * mm)
        y = 25 * mm
    hal.insert_text((KIRI, y), f"{no}. {nama} ({peran})", fontname="helv", fontsize=11)
    y += 4 * mm
    f = cari(no)
    if f:
        src = pymupdf.open(f)
        pdfbytes = src.convert_to_pdf()
        sp = pymupdf.open("pdf", pdfbytes)
        r = sp[0].rect
        klip = None
        if no in potong:
            x0, y0, x1, y1 = potong[no]
            px = pymupdf.Pixmap(f)
            sx, sy = r.width / px.width, r.height / px.height
            klip = pymupdf.Rect(x0 * sx, y0 * sy, x1 * sx, y1 * sy)
        w, h = (klip or r).width, (klip or r).height
        tinggi = LEBAR * h / w
        hal.show_pdf_page(pymupdf.Rect(KIRI, y, KIRI + LEBAR, y + tinggi), sp, 0, clip=klip)
    else:
        tinggi = LEBAR * 54 / 85.6
        kotak = pymupdf.Rect(KIRI, y, KIRI + LEBAR, y + tinggi)
        hal.draw_rect(kotak, color=(0.8, 0.5, 0), fill=(1, 0.97, 0.85), dashes="[4] 0", width=1)
        hal.insert_textbox(kotak + (0, tinggi / 2 - 8, 0, 0), "Pindaian KTP menyusul", fontname="helv",
                           fontsize=11, align=1, color=(0.6, 0.3, 0))
        kurang.append(nama)
    y += tinggi + 14 * mm
doc.save(keluar, garbage=3, deflate=True)
print(json.dumps({"halaman": doc.page_count, "menyusul": kurang}))
