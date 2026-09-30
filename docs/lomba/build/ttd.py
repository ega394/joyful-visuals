"""
Mengganti halaman kosong-tanda-tangan pada PDF final dengan pindaian yang
sudah ditandatangani.

    python3 ttd.py final.pdf rahasia/ttd.json

ttd.json: {"berkas": "<pindaian>.pdf", "ganti": [["<awal teks halaman>", <nomor halaman pindaian>, [[x0, y0, x1, y1, "teks"], ...]?], ...]}
Halaman sasaran dikenali dari awal teksnya (mis. "Lampiran 1. Pakta Integritas").
Pindaian dipadatkan menjadi JPEG 150 dpi agar berkas tetap jauh di bawah 15 MB.
Pindaian memuat data pribadi, jadi hanya dipakai untuk berkas di rahasia/.
"""
import json, os, re, sys
import pymupdf

sasaran, konf = sys.argv[1:3]
k = json.load(open(konf))
pindai = pymupdf.open(os.path.join(os.path.dirname(konf), k["berkas"]))
doc = pymupdf.open(sasaran)
hasil = []
for awal, nomor, *tulis in k["ganti"]:
    teks = [re.sub(r"\s+", " ", p.get_text()).strip() for p in doc]
    i = next((j for j, t in enumerate(teks) if t.startswith(awal)), None)
    if i is None:
        hasil.append(f"TIDAK DITEMUKAN: {awal}"); continue
    # nomor: halaman pada berkas utama, atau ["berkas-lain.pdf", halaman]
    if isinstance(nomor, list):
        sp = pymupdf.open(os.path.join(os.path.dirname(konf), nomor[0]))[nomor[1] - 1]
    else:
        sp = pindai[nomor - 1]
    jpg = sp.get_pixmap(dpi=150).tobytes("jpeg", jpg_quality=80)
    doc.delete_page(i)
    hal = doc.new_page(pno=i, width=sp.rect.width, height=sp.rect.height)
    hal.insert_image(hal.rect, stream=jpg)
    # Isian yang tertinggal kosong pada pindaian (mis. tanggal): titik-titiknya
    # ditutup lalu ditulis ulang. Koordinat dalam poin halaman pindaian.
    for x0, y0, x1, y1, teks, *gaya in (tulis[0] if tulis else []):
        huruf, ukuran = (gaya + ["helv", 10.5])[:2] if gaya else ("helv", 10.5)
        hal.draw_rect(pymupdf.Rect(x0, y0, x1, y1), color=None, fill=(1, 1, 1))
        lebar = pymupdf.get_text_length(teks, fontname=huruf, fontsize=ukuran)
        hal.insert_text(((x0 + x1 - lebar) / 2, y1 - 1.5), teks, fontname=huruf, fontsize=ukuran, color=(0.22, 0.22, 0.22))
    hasil.append(f"hal {i + 1} ← pindaian {nomor}: {awal}")
doc.save(sasaran + ".tmp", garbage=3, deflate=True); doc.close()
os.replace(sasaran + ".tmp", sasaran)
print("\n".join(hasil))
