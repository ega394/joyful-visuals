"""
Mengecilkan PDF final: setiap gambar diturunkan resolusinya sesuai ukuran
tampilnya di halaman, lalu disimpan ulang sebagai JPEG.

    python3 kecilkan.py masukan.pdf keluaran.pdf [dpi] [mutu]

Gambar bertransparansi (SMask: tanda tangan, logo) tidak disentuh supaya
latarnya tetap bening. Gambar kecil atau yang sudah di bawah target hanya
disimpan ulang bila hasilnya memang lebih kecil.
"""
import sys
import pymupdf

masuk, keluar = sys.argv[1:3]
DPI = float(sys.argv[3]) if len(sys.argv) > 3 else 150
MUTU = int(sys.argv[4]) if len(sys.argv) > 4 else 60

doc = pymupdf.open(masuk)
# Ukuran tampil terbesar (inci) tiap gambar di seluruh dokumen.
tampil, halaman = {}, {}
for p in doc:
    for info in p.get_image_info(xrefs=True):
        x = info.get("xref")
        if not x:
            continue
        b = pymupdf.Rect(info["bbox"])
        w, h = b.width / 72, b.height / 72
        lama = tampil.get(x, (0, 0))
        tampil[x] = (max(lama[0], w), max(lama[1], h))
        halaman.setdefault(x, p.number)

hemat = 0
for x, (wi, hi) in tampil.items():
    if doc.xref_get_key(x, "SMask")[0] != "null":
        continue
    lama = len(doc.xref_stream_raw(x))
    if lama < 30_000:
        continue
    pix = pymupdf.Pixmap(doc, x)
    if pix.alpha:
        continue
    if pix.n > 3 or (pix.colorspace and pix.colorspace.n > 3):
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    tw, th = max(1, round(wi * DPI)), max(1, round(hi * DPI))
    if pix.width > tw * 1.05 and pix.height > th * 1.05:
        pix = pymupdf.Pixmap(pix, tw, th, None)
    baru = pix.tobytes("jpeg", jpg_quality=MUTU)
    if len(baru) < lama * 0.95:
        doc[halaman[x]].replace_image(x, stream=baru)
        hemat += lama - len(baru)
doc.save(keluar, garbage=4, deflate=True, clean=True)
print(f"hemat {hemat/1048576:.1f} MB")
