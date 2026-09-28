"""
Mencari nomor halaman setiap judul pada PDF hasil render, untuk daftar isi.

    python3 halaman.py berkas.pdf "<judul pembuka isi>" "<judul 1>" "<judul 2>" ...

Nomor halaman dihitung relatif terhadap halaman pembuka isi (Bagian 2), sama
dengan penomoran pada kaki halaman dokumen. Juga melaporkan jumlah halaman
isi, yaitu dari Bagian 2 sampai sebelum Bagian 12 (Lampiran) — angka inilah
yang dibatasi panduan paling banyak 20 halaman.
"""
import json
import re
import sys

import pymupdf

berkas, pembuka, *judul = sys.argv[1:]
doc = pymupdf.open(berkas)
teks = [re.sub(r"\s+", " ", p.get_text()) for p in doc]

hal_daftar_isi = next((i for i, t in enumerate(teks) if "DAFTAR ISI" in t), 0)
hal_isi = next(i for i, t in enumerate(teks) if i > hal_daftar_isi and pembuka in t)


def cari(j):
    return next((i for i, t in enumerate(teks) if i >= hal_isi and j in t), None)


halaman = {}
for j in judul:
    i = cari(j)
    if i is not None and not j.startswith("12."):
        halaman[j] = i - hal_isi + 1

hal_lampiran = cari("12. LAMPIRAN")
print(json.dumps({
    "halaman": halaman,
    "jumlah_halaman_pdf": len(doc),
    "halaman_isi": (hal_lampiran - hal_isi) if hal_lampiran is not None else None,
    "judul_tak_ditemukan": [j for j in judul if cari(j) is None],
}, ensure_ascii=False))
