# Catatan: Mode Gelap

Ditunda atas keputusan Kabag, 24 Agustus 2026. Berkas ini menyimpan hasil
penelusurannya supaya tidak perlu diulang saat nanti dikerjakan.

## Keadaan warna saat ini

| Yang dihitung | Jumlah |
| :-- | --: |
| Kode warna heksa tertulis langsung | 4.133 |
| `"white"` / `"black"` polos | 748 |
| `rgba(...)` | 492 |
| **Total titik warna** | **± 5.400** |

`src/ProkopimApp.jsx` menyumbang 2.669 di antaranya.

Penyebabnya: tampilan ditulis dengan `style={{...}}` langsung di dalam
komponen, bukan lewat kelas CSS. Pada 11.600 baris `ProkopimApp.jsx`,
`className` hanya dipakai 37 kali.

## Sistem token sudah ada tapi menganggur

`src/index.css` sudah memuat variabel shadcn (`--background`, `--foreground`,
dan seterusnya) lengkap dengan blok `.dark`. Sistem itu praktis tidak
menyentuh tampilan aplikasi — hanya mengenai segelintir komponen shadcn
seperti toaster dan tooltip. Menyalakan kelas `.dark` hari ini nyaris tidak
mengubah apa pun.

## Paletnya terpusat, jadi pekerjaannya mekanis

Dari 231 warna berbeda:

| Cakupan | Bagian pemakaian |
| :-- | --: |
| 10 warna teratas | 40% |
| 30 warna teratas | 68% |
| 50 warna teratas | 81% |

Sisanya tersebar di 181 warna lain. Artinya sebagian besar cukup dipetakan
sekali (terang → gelap), bukan ditimbang satu per satu.

Sepuluh warna terbanyak, sebagai titik awal pemetaan:

```
#94A3B8  #64748B  #E2E8F0  #475569  #0A1628
#F1F5F9  #92400E  #CBD5E1  #991B1B  #F8FAFC
```

## Yang WAJIB dikecualikan

Ini bagian yang paling mudah terlewat dan akibatnya paling merugikan.

**Seluruh keluaran cetak dan PDF harus tetap terang** — generator undangan,
rekap agenda PDF, laporan daftar hadir, dan poster QR. Semuanya dokumen di
atas kertas putih; bila mode gelap merembes ke sana, hasil cetaknya menjadi
lembar hitam.

Berkas yang menyangkut hal itu:

- `src/UndanganGenerator.jsx` — `CSS_ASLI` dan `buildDocHTML()`
- `src/components/QrDaftarHadir.jsx` — `gambarPoster()` menggambar di kanvas
- `src/components/LaporanHadir.jsx` — tata letak cetak
- `src/ProkopimApp.jsx` — lima templat tabel cetak, dan kartu agenda yang
  digambar di kanvas (cari `ctx.fillText`)

Gambar yang digambar di kanvas juga tetap terang: itu berkas untuk dibagikan,
bukan tampilan layar.

## Pilihan pengerjaan

**A. Bertahap.** Hanya layar yang benar-benar dibuka malam hari — Agenda
pimpinan dan `src/JoyfulInterface.jsx`. Sekitar 300 titik warna, dua berkas,
muat dalam satu PR dan risikonya kecil. **Ini yang disarankan.**

**B. Menyeluruh.** Seluruh layar internal, ± 5.400 titik warna di belasan
berkas. Beberapa PR, bukan satu. Risikonya bukan pada kesulitan melainkan
pada cakupan: setiap layar berpotensi meleset warnanya dan pemeriksaannya
harus satu per satu. Sebaiknya dikerjakan saat tidak ada acara besar dalam
waktu dekat.

## Cara mengukur ulang

```bash
# titik warna heksa per berkas
grep -roh '#[0-9A-Fa-f]\{6\}\b' src/ --include=*.jsx | wc -l

# warna terbanyak
grep -roh '#[0-9A-Fa-f]\{6\}\b' src/ --include=*.jsx \
  | tr 'a-f' 'A-F' | sort | uniq -c | sort -rn | head -30
```
