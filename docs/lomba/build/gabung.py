"""
Menyisipkan PDF lampiran tepat sesudah halaman judul lampirannya.

    python3 gabung.py proposal.pdf "7=SOP.pdf" "6=SK.pdf,Surat.pdf"

Dijalankan sesudah halaman.py, sehingga penghitungan 20 halaman isi tidak
terpengaruh: sisipan berada di bagian lampiran. Nomor besar disisipkan
lebih dulu supaya letak halaman lampiran bernomor kecil tidak bergeser.
"""
import os
import re
import sys

import pymupdf

berkas, *sisipan = sys.argv[1:]
doc = pymupdf.open(berkas)
teks = [re.sub(r"\s+", " ", p.get_text()) for p in doc]
awal = next(i for i, t in enumerate(teks) if "12. LAMPIRAN" in t and "DAFTAR ISI" not in t)
rencana = []
for s in sisipan:
    nomor, daftar = s.split("=", 1)
    hal = next(i for i, t in enumerate(teks) if i > awal and f"Lampiran {nomor}." in t)
    rencana.append((hal, daftar.split(",")))
for hal, daftar in sorted(rencana, reverse=True):
    posisi = hal + 1
    for f in daftar:
        src = pymupdf.open(f)
        doc.insert_pdf(src, start_at=posisi)
        posisi += src.page_count
doc.save(berkas + ".tmp", garbage=3, deflate=True)
doc.close()
os.replace(berkas + ".tmp", berkas)
print(f"Sisipan selesai; jumlah halaman kini {pymupdf.open(berkas).page_count}")
