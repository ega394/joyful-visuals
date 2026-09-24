"""
Menyisipkan PDF sebelas SOP tepat sesudah halaman judul Lampiran 7.

    python3 gabung.py proposal.pdf SOP-Prokopim.pdf

Dijalankan sesudah halaman.py, sehingga penghitungan 20 halaman isi tidak
terpengaruh: SOP berada di bagian lampiran.
"""
import re
import sys

import pymupdf

berkas, sop = sys.argv[1:]
doc = pymupdf.open(berkas)
teks = [re.sub(r"\s+", " ", p.get_text()) for p in doc]
awal_lampiran = next(i for i, t in enumerate(teks) if "12. LAMPIRAN" in t and "DAFTAR ISI" not in t)
hal7 = next(i for i, t in enumerate(teks) if i > awal_lampiran and "Lampiran 7." in t)
doc.insert_pdf(pymupdf.open(sop), start_at=hal7 + 1)
doc.save(berkas + ".tmp", garbage=3, deflate=True)
doc.close()

import os
os.replace(berkas + ".tmp", berkas)
print(f"SOP disisipkan sesudah halaman {hal7 + 1}; jumlah halaman kini {pymupdf.open(berkas).page_count}")
