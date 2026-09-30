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
    ("2", "Saifullah, S.H.", "Anggota"),
    ("3", "Juliyanti, S.AP.", "Anggota"),
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
# Satu halaman A4: dua kolom x tiga baris, kartu selebar ±85 mm (ukuran KTP asli).
doc = pymupdf.open()
hal = doc.new_page(width=210 * mm, height=297 * mm)
KOL, TEPI, SELA = 85 * mm, 15 * mm, 10 * mm
TINGGI_BARIS = 80 * mm
kurang = []
for k, (no, nama, peran) in enumerate(TIM):
    x = TEPI + (k % 2) * (KOL + SELA)
    y = 20 * mm + (k // 2) * TINGGI_BARIS
    hal.insert_text((x, y), f"{no}. {nama}", fontname="helv", fontsize=9)
    hal.insert_text((x, y + 4.2 * mm), peran, fontname="helv", fontsize=8, color=(0.3, 0.3, 0.3))
    y += 7 * mm
    f = cari(no)
    maks = pymupdf.Rect(x, y, x + KOL, y + 62 * mm)
    if f:
        sp = pymupdf.open("pdf", pymupdf.open(f).convert_to_pdf())
        r = sp[0].rect
        klip = None
        if no in potong:
            x0, y0, x1, y1 = potong[no]
            px = pymupdf.Pixmap(f)
            sx, sy = r.width / px.width, r.height / px.height
            klip = pymupdf.Rect(x0 * sx, y0 * sy, x1 * sx, y1 * sy)
        w, h = (klip or r).width, (klip or r).height
        tinggi = min(KOL * h / w, maks.height)
        lebar = tinggi * w / h
        hal.show_pdf_page(pymupdf.Rect(x, y, x + lebar, y + tinggi), sp, 0, clip=klip)
    else:
        kotak = pymupdf.Rect(x, y, x + KOL, y + KOL * 54 / 85.6)
        hal.draw_rect(kotak, color=(0.8, 0.5, 0), fill=(1, 0.97, 0.85), dashes="[4] 0", width=1)
        hal.insert_textbox(kotak + (0, kotak.height / 2 - 8, 0, 0), "Pindaian KTP menyusul", fontname="helv",
                           fontsize=10, align=1, color=(0.6, 0.3, 0))
        kurang.append(nama)
doc.save(keluar, garbage=3, deflate=True)
print(json.dumps({"halaman": doc.page_count, "menyusul": kurang}))
