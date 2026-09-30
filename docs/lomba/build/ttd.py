"""
Mengganti halaman kosong-tanda-tangan pada PDF final dengan pindaian yang
sudah ditandatangani.

    python3 ttd.py final.pdf rahasia/ttd.json

ttd.json: {"berkas": "<pindaian>.pdf", "ganti": [["<awal teks halaman>", <nomor halaman pindaian>], ...]}
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
for awal, nomor in k["ganti"]:
    teks = [re.sub(r"\s+", " ", p.get_text()).strip() for p in doc]
    i = next((j for j, t in enumerate(teks) if t.startswith(awal)), None)
    if i is None:
        hasil.append(f"TIDAK DITEMUKAN: {awal}"); continue
    sp = pindai[nomor - 1]
    jpg = sp.get_pixmap(dpi=150).tobytes("jpeg", jpg_quality=80)
    doc.delete_page(i)
    hal = doc.new_page(pno=i, width=sp.rect.width, height=sp.rect.height)
    hal.insert_image(hal.rect, stream=jpg)
    hasil.append(f"hal {i + 1} ← pindaian {nomor}: {awal}")
doc.save(sasaran + ".tmp", garbage=3, deflate=True); doc.close()
os.replace(sasaran + ".tmp", sasaran)
print("\n".join(hasil))
