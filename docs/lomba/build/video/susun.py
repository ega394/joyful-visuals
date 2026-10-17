"""Susun video Prokopim Hibot: adegan aplikasi dibingkai, takarir ASS, gabung MP4.

python3 susun.py            -> keluaran/Video-Prokopim-Hibot-Kaltara-2026.mp4
Narasi dubber (opsional) dibaca dari narasi/adegan-NN.(wav|m4a|mp3) bila ada.
"""
import json, os, re, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__)) + "/"
LAYAR = {"laptop": (352, 128, 1216, 760), "hp": (420, 128, 351, 760)}

# (nomor, durasi, sumber). Sumber grafis: ("g", id). Aplikasi: ("a", latar, jenis, [(klip, durasi_bagian, potong_s|None)]).
ADEGAN = [
    ("01", 20, ("g", "s01")),
    ("02", 35, ("g", "s02")),
    ("03", 25, ("g", "s03")),
    ("04", 25, ("g", "s04")),
    ("05", 10, ("g", "s05")),
    ("06", 15, ("a", [("b06", "laptop", "a06_admin", 15, None)])),
    ("07", 15, ("a", [("b07", "hp", "a07_kasubbag", 15, None)])),
    ("08", 10, ("a", [("b08", "laptop", "a08_kabag", 10, None)])),
    ("09", 20, ("a", [("b09", "hp", "a09_walikota", 10, None), ("b09b", "hp", "a09b_ajudan", 10, None)])),
    ("10", 15, ("a", [("b10", "laptop", "a10_penugasan", 15, 12.6)])),
    ("11", 20, ("a", [("b11", "hp", "a11a_tamu", 10, None), ("b11", "hp", "a11b_ruangan", 10, None)])),
    ("12", 35, ("g", "s12")),
    ("13", 15, ("g", "s13")),
    ("14", 15, ("c", [("g", "s14a", 7), ("a", "b14", "laptop", "a14_monitorwa", 8, None)])),
    ("15", 10, ("g", "s15")),
]

# Takarir = narasi dengan angka berbentuk digit (naskah dubber mengeja angka).
TAKARIR = {
    "01": "Januari 2026. Tiga lembar disposisi agenda diturunkan. Yang sampai ke Bagian Prokopim hanya dua. Tidak ada yang lalai, tetapi tidak ada pula yang bisa mengetahuinya.",
    "02": "Rencana kegiatan disusun di spreadsheet lalu dicetak. Penelaahan hanya sempat sekitar 30 menit menjelang jam pulang. Disposisi beredar sebagai foto, penugasan bergantung pada ingatan. Dari pengajuan sampai tayang diperkirakan 18 sampai 24 jam.",
    "03": "Ide ini tidak lahir dari survei, tetapi dari pekerjaan sehari-hari. Undangan masuk dari banyak pintu. Sesudah peristiwa Januari, seluruh Bagian menelaah alur kerja bersama dan menemukan pola yang sama: penugasan tersimpan dalam ingatan, ruangan hanya tercatat di papan tulis, arsip tersebar.",
    "04": "Ada empat pilihan. Menambah pengawasan tidak menyentuh akar masalah. Merapikan spreadsheet tetap menyisakan banyak versi. Membeli aplikasi jadi butuh anggaran, padahal alur keprotokolan sangat khas. Kami memilih membangun sendiri: satu sumber data, setiap keputusan tercatat, tanpa anggaran pengadaan.",
    "05": "Lahirlah Prokopim Hibot: satu alur digital terverifikasi untuk agenda Pimpinan Daerah.",
    "06": "Admin Rencana Kegiatan memasukkan undangan, cukup dengan memindainya.",
    "07": "Kepala Sub Bagian menelaah dari mana saja. Tombol persetujuan baru aktif setelah butir pemeriksaan dicentang.",
    "08": "Kepala Bagian memutus. Median waktunya 8 menit.",
    "09": "Begitu tayang, agenda langsung ada di telepon Pimpinan. Ajudan mengonfirmasi kehadiran, dan Wali Kota dapat mendisposisikan kepada Wakil Wali Kota.",
    "10": "Petugas ditugaskan dan diberi tahu, daftar hadir cukup dengan kode QR, dan setiap langkah tercatat: siapa, kapan, apa keputusannya.",
    "11": "Masyarakat dan instansi mengajukan audiensi atau meminjam ruangan secara daring, lalu memantau sendiri statusnya.",
    "12": "Per 24 September 2026: 589 kegiatan terkelola. Waktu sampai tayang turun menjadi median 1,99 jam, dan 99,3% tayang kurang dari sehari. 3.072 keputusan terekam. 66 instansi meminjam ruangan dan 53 instansi mengajukan audiensi. Belanja pengadaannya nol rupiah.",
    "13": "",
    "14": "Sebelas SOP dan Pelaksana Harian menjaga alur tetap berjalan, bahkan ketika pejabat berhalangan. Sejak proposal, aplikasi terus dikembangkan dari kendala pengguna.",
    "15": "Satu alur. Satu data. Setiap keputusan tercatat.",
}


def jalankan(*a):
    subprocess.run(a, check=True)


def durasi(f):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).decode().strip())


def bagian_aplikasi(latar, jenis, klip, T, potong, keluar):
    x, y, w, h = LAYAR[jenis]
    src = D + "rek/" + klip + ".mp4"
    c = min(durasi(src), potong or 1e9)
    sf = max(0.65, min(1.25, T / c))  # >1 = diperlambat
    sisa = max(0.0, T - c * sf)
    vf = (f"[1:v]trim=duration={c:.3f},setpts=(PTS-STARTPTS)*{sf:.4f},fps=25,scale={w}:{h}:flags=lanczos,"
          f"tpad=stop_mode=clone:stop_duration={sisa + 0.5:.3f}[k];[0:v][k]overlay={x}:{y}:shortest=0,trim=duration={T},setsar=1,format=yuv420p")
    jalankan("ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-framerate", "25", "-i", D + "gr/" + latar + ".png", "-i", src,
             "-filter_complex", vf, "-t", str(T), "-r", "25", "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", keluar)


def gabung(daftar, keluar):
    lst = keluar + ".txt"
    with open(lst, "w") as f:
        for p in daftar:
            f.write(f"file '{p}'\n")
    jalankan("ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", keluar)


def potong_kalimat(teks, maks=78):
    """Pecah narasi menjadi kepingan takarir: per kalimat, kalimat panjang dipecah di koma/titik dua."""
    out = []
    for k in re.split(r"(?<=[.!?])\s+", teks.strip()):
        while len(k) > maks:
            cut = max(k.rfind(", ", 0, maks), k.rfind(": ", 0, maks))
            if cut < 25:
                cut = k.rfind(" ", 0, maks)
            out.append(k[:cut + 1].strip())
            k = k[cut + 1:].strip()
        if k:
            out.append(k)
    return out


def ts(s):
    h = int(s // 3600); m = int(s % 3600 // 60); d = s % 60
    return f"{h}:{m:02d}:{d:05.2f}"


def buat_ass(mulai, jalur):
    head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Takarir,Plus Jakarta Sans,46,&H00FFFFFF,&H00FFFFFF,&H00281A0A,&H96281A0A,0,0,0,0,100,100,0,0,3,14,0,2,200,200,46,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    for no, dur, _ in ADEGAN:
        k = potong_kalimat(TAKARIR.get(no, ""))
        if not k:
            continue
        a0, a1 = mulai[no] + 0.4, mulai[no] + dur - 0.3
        tot = sum(len(x) for x in k)
        t = a0
        for x in k:
            t2 = t + (a1 - a0) * len(x) / tot
            ev.append(f"Dialogue: 0,{ts(t)},{ts(t2 - 0.05)},Takarir,,0,0,0,,{x}")
            t = t2
    with open(jalur, "w") as f:
        f.write(head + "\n".join(ev) + "\n")
    # SRT pendamping untuk diunggah terpisah bila diperlukan
    srt = []
    for i, line in enumerate(ev, 1):
        _, a, b, *_r = line.split(",", 9)
        teks = line.split(",", 9)[9]
        f2 = lambda s: (lambda h, m, sec: f"{int(h):02d}:{int(m):02d}:{float(sec):06.3f}".replace(".", ","))(*s.split(":"))
        srt.append(f"{i}\n{f2(a)} --> {f2(b)}\n{teks}\n")
    with open(jalur.replace(".ass", ".srt"), "w") as f:
        f.write("\n".join(srt))


def main():
    os.makedirs(D + "bagian", exist_ok=True); os.makedirs(D + "keluaran", exist_ok=True)
    mulai, t, berkas = {}, 0.0, []
    for no, dur, src in ADEGAN:
        mulai[no] = t; t += dur
        out = D + f"bagian/{no}.mp4"
        if src[0] == "g":
            jalankan("ffmpeg", "-y", "-loglevel", "error", "-i", D + "gr/" + src[1] + ".mp4", "-t", str(dur), "-vf", "fps=25,format=yuv420p", "-c:v", "libx264", "-crf", "17", out)
        else:
            subs = []
            items = src[1]
            for j, it in enumerate(items):
                p = D + f"bagian/{no}_{j}.mp4"
                if it[0] == "g":
                    jalankan("ffmpeg", "-y", "-loglevel", "error", "-i", D + "gr/" + it[1] + ".mp4", "-t", str(it[2]), "-vf", "fps=25,format=yuv420p", "-c:v", "libx264", "-crf", "17", p)
                elif it[0] == "a":
                    bagian_aplikasi(it[1], it[2], it[3], it[4], it[5], p)
                else:
                    bagian_aplikasi(it[0], it[1], it[2], it[3], it[4], p)
                subs.append(p)
            gabung(subs, out)
        berkas.append(out)
        print(no, f"{mulai[no]:.0f}s", round(durasi(out), 2))
    mentah = D + "bagian/_mentah.mp4"
    gabung(berkas, mentah)
    ass = D + "keluaran/takarir.ass"
    buat_ass(mulai, ass)
    # Narasi: gabungkan berkas per adegan bila tersedia, selain itu senyap.
    narasi = [(no, mulai[no]) for no, *_ in ADEGAN for ext in ("wav", "m4a", "mp3") if os.path.exists(D + f"narasi/adegan-{no}.{ext}")]
    hasil = D + "keluaran/Video-Prokopim-Hibot-Kaltara-2026.mp4"
    vf = f"subtitles={ass}:fontsdir={os.path.expanduser('~/.fonts')},fade=t=in:st=0:d=0.6,fade=t=out:st={t - 0.8}:d=0.8"
    if narasi:
        ins, flt = ["-i", mentah], []
        for i, (no, st) in enumerate(narasi, 1):
            f = next(D + f"narasi/adegan-{no}.{e}" for e in ("wav", "m4a", "mp3") if os.path.exists(D + f"narasi/adegan-{no}.{e}"))
            ins += ["-i", f]; flt.append(f"[{i}:a]adelay={int(st * 1000 + 300)}|{int(st * 1000 + 300)}[n{i}]")
        flt.append("".join(f"[n{i}]" for i in range(1, len(narasi) + 1)) + f"amix=inputs={len(narasi)}:normalize=0,apad,atrim=0:{t}[a]")
        jalankan("ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", f"[0:v]{vf}[v];" + ";".join(flt), "-map", "[v]", "-map", "[a]",
                 "-c:v", "libx264", "-crf", "19", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-t", str(t), hasil)
    else:
        jalankan("ffmpeg", "-y", "-loglevel", "error", "-i", mentah, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-vf", vf,
                 "-c:v", "libx264", "-crf", "19", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", "-t", str(t), hasil)
    print("selesai", hasil, round(durasi(hasil), 2), "detik,", round(os.path.getsize(hasil) / 1e6, 1), "MB")


if __name__ == "__main__":
    main()
