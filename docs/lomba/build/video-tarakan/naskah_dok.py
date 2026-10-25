"""Naskah video per adegan beserta menit tayang dan unsur penilaian yang dijawab.

KERJA=<folder kerja> python3 naskah_dok.py -> KERJA/keluaran/Naskah-Video-Prokopim-Hibot-Tarakan-2026.txt
"""
import json, os, sys

D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
from naskah import ADEGAN

KERJA = os.environ.get("KERJA", D)
L = json.load(open(os.path.join(KERJA, "linimasa.json")))

JUDUL = {"pembuka": "Pembuka (kait cerita)", "judul": "Judul", "dulu": "Data dasar dan cara kerja lama", "akar": "Akar masalah dan urgensi",
         "ide": "Penjaringan dan pemilihan ide", "lahir": "Lahirnya Prokopim Hibot", "alur": "Ikuti satu undangan",
         "layanan": "Layanan pendukung", "jejak": "Jejak keputusan dan kebaruan lain", "bangun": "Pelaksanaan",
         "daya": "Sumber daya dan kolaborasi", "dampak": "Bukti dampak", "walikota": "Pernyataan Wali Kota",
         "testimoni": "Testimoni tertulis pengguna", "lanjut": "Keselarasan, keberlanjutan, replikasi", "tim": "Profil tim inovasi",
         "tutup": "Penutup"}
UNSUR = {
    "pembuka": "Latar belakang: peristiwa pemicu Januari 2026",
    "dulu": "Latar belakang: data dasar (tugas menurut Perwali 50/2021, 91 kegiatan/bulan) dan kondisi sebelum inovasi (18–24 jam)",
    "akar": "Masalah: akar masalah (tidak ada satu sumber data yang sahih) dan urgensi",
    "ide": "Pelaksanaan: penjaringan ide (7.1) dan pemilihan ide dari empat pilihan (7.2)",
    "lahir": "Solusi: superapp, 11 alur kerja, semboyan Tarakan HIBOT",
    "alur": "Solusi dan kebaruan: AI isi otomatis, daftar periksa wajib, keputusan berjenjang, disposisi, penugasan",
    "layanan": "Solusi: kalender otomatis, undangan siap TTE Srikandi, daftar hadir QR, naskah sambutan dan berita, kanal publik berkode",
    "jejak": "Kebaruan: jejak audit, Pelaksana Harian bermasa berlaku, pengawasan menurut kegentingan, pelindungan data pribadi (UU 27/2022), log WhatsApp",
    "bangun": "Implementasi: swakelola Rp0, Surat dan Keputusan Sekda, 11 SOP, lebih dari 140 pembaruan",
    "daya": "Sumber daya dan kolaborasi: tim 5 orang, Tim Koordinasi 42 orang, Sekda, DKISP, Bappeda Litbang, layanan awan Rp0, efisiensi kuota 6,4 GB → ±1 GB",
    "dampak": "Dampak: 617 kegiatan (naik 58%), median 1,94 jam (9–12× lebih cepat), 99,3% < 24 jam, 47,9% di luar jam kerja, 3.331 jejak, 29 dikembalikan, 92,5% berpetugas, 68 dan 55 instansi, Rp0",
    "walikota": "Dampak dan kepuasan: pernyataan langsung Wali Kota",
    "testimoni": "Kepuasan pengguna: testimoni tertulis Ajudan Wakil Wali Kota, Staf Protokol, Pelaksana Harian (Lampiran 9)",
    "lanjut": "Keselarasan Misi 4 RPJMD dan 7 unsur Kategori A; keberlanjutan (biaya, kewenangan pada jabatan, SOP, rencana 2027, mitigasi); replikasi",
    "tim": "Profil inovator: Tim Inovasi Prokopim Hibot",
    "tutup": "Penutup: tema lomba dan identitas Pemerintah Kota Tarakan",
}


def mmss(s):
    return f"{int(s // 60)}:{int(s % 60):02d}"


def main():
    teks = {no: ks for no, _, ks in ADEGAN}
    out = ["NASKAH VIDEO — PROKOPIM HIBOT", "Lomba Inovasi Daerah Kota Tarakan 2026 · Kategori A, Inovasi Tata Kelola Pemerintahan",
           f"Durasi {mmss(L['total'])} · 1920×1080 · narasi suara otomatis · takarir bawaan + berkas SRT",
           "Angka sama dengan proposal Tarakan (data aplikasi per 5 Oktober 2026 pukul 15.47 WITA).", "",
           "Alur cerita: mengikuti perjalanan satu undangan, dulu (tidak sampai tanpa ada yang tahu) dan sekarang (tercatat dari ujung ke ujung).",
           "Urutan memenuhi Juknis Bab 4.4: latar belakang → masalah → solusi → implementasi → dampak, dengan thumbnail dan identitas Pemerintah Kota Tarakan.",
           "Bab proposal lain ikut ditampilkan: penjaringan/pemilihan ide, sumber daya dan kolaborasi, kepuasan pengguna, keselarasan RPJMD,",
           "keberlanjutan, replikasi, dan profil tim.", ""]
    for a in L["adegan"]:
        i = a["id"]
        out += ["=" * 72, f"{mmss(a['mulai'])}–{mmss(a['mulai'] + a['lama'])}  {JUDUL.get(i, i).upper()}  [{a['bagian']}]"]
        if i in UNSUR:
            out.append(f"Menjawab: {UNSUR[i]}")
        out.append("")
        if i == "judul":
            out.append("(Tanpa narasi) Prokopim Hibot — Superapp Pelayanan Keprotokolan dan Komunikasi Pimpinan · Pemerintah Kota Tarakan")
        elif i == "walikota":
            out += [f"Wali Kota: {u['takarir']}" for u in a["ucapan"]]
        else:
            out += [k[0] for k in teks.get(i, [])]
        out.append("")
    os.makedirs(os.path.join(KERJA, "keluaran"), exist_ok=True)
    f = os.path.join(KERJA, "keluaran", "Naskah-Video-Prokopim-Hibot-Tarakan-2026.txt")
    open(f, "w").write("\n".join(out))
    print(f)


if __name__ == "__main__":
    main()
