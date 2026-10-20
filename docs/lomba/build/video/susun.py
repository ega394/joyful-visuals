"""Susun video Prokopim Hibot: adegan aplikasi dibingkai, takarir ASS, gabung MP4.

python3 susun.py            -> keluaran/Video-Prokopim-Hibot-Kaltara-2026.mp4
Narasi dubber (opsional) dibaca dari narasi/adegan-NN.(wav|m4a|mp3) bila ada.
"""
import json, os, re, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__)) + "/"
LAYAR = {"laptop": (240, 112, 1440, 790), "hp": (230, 96, 406, 880)}

# Pernyataan Wali Kota (video 19 Oktober 2026): kutipan terpilih, dipotong di jeda antarkalimat.
PERNYATAAN = [("pernyataan-walikota.mp4", 1.0, 5.25), ("pernyataan-walikota.mp4", 6.0, 8.7),
              ("pernyataan-walikota.mp4", 36.1, 44.35), ("pernyataan-walikota.mp4", 44.6, 51.3),
              ("pernyataan-walikota.mp4", 62.1, 66.2)]
# Gambar adegan 13: rekaman Wali Kota mengakses aplikasi; suaranya pernyataan di atas.
WALIKOTA_HP = [("IMG_1729.MOV", 0.0, 4.1), ("IMG_1730.MOV", 0.0, 5.5), ("IMG_1731.MOV", 0.0, 3.3),
               ("IMG_1727.MOV", 0.0, 6.35), ("IMG_1728.MOV", 0.0, 7.5)]
SUARA_KLIP = {"13": PERNYATAAN}
# Takarir ucapan beliau, waktu menurut video sumber.
UCAPAN = {"13": [(1.2, 5.1, "Yang penting bagi saya adalah kepastian:"),
                 (6.2, 8.6, "kegiatan apa yang harus saya hadiri."),
                 (36.6, 39.5, "Dan saya kira sangat membantu,"),
                 (39.5, 41.6, "karena dari jauh pun saya bisa melihat"),
                 (41.6, 44.3, "kegiatan-kegiatan yang ada setiap hari,"),
                 (45.1, 49.2, "dan bisa mendisposisi kalau memang saya tidak bisa hadir"),
                 (49.3, 51.2, "ke pejabat yang lain."),
                 (62.3, 66.15, "Luar biasa, saya kira, inovasi yang dikerjakan ini.")]}
SILANG_NYATA = {"13": 0.3}

# (nomor, durasi, sumber). Sumber grafis: ("g", id). Aplikasi: ("a", latar, jenis, [(klip, durasi_bagian, potong_s|None)]).
ADEGAN = [
    ("01", 20, ("g", "s01")),
    ("02", 25, ("c", [("n", [("IMG_1345.MOV", 0.3, 5.6), ("IMG_1346.MOV", 0.2, 5.3)], "o02", 10), ("g", "s02", 15, 10.0)])),
    ("03", 25, ("g", "s03")),
    ("04", 25, ("g", "s04")),
    ("05", 10, ("g", "s05")),
    ("06", 20, ("c", [("n", [("IMG_1347.MOV", 0.0, 5.0)], "o06", 5), ("a", "b06", "laptop", "a06_admin", 15, None)])),
    ("07", 15, ("a", [("b07", "hp", "a07_kasubbag", 15, None)])),
    ("08", 10, ("a", [("b08", "laptop", "a08_kabag", 10, None)])),
    ("09", 20, ("a", [("b09", "hp", "a09_walikota", 10, None), ("b09b", "hp", "a09b_ajudan", 10, None)])),
    ("10", 20, ("a", [("b10", "laptop", "a10_penugasan", 20, None)])),
    ("11", 20, ("a", [("b11r", "hp", "a11b_ruangan", 9, None), ("b11a", "hp", "a11a_tamu", 11, None)])),
    ("12", 35, ("g", "s12")),
    ("13", 25, ("c", [("n", WALIKOTA_HP, "o13", 25)])),
    ("14", 15, ("c", [("g", "s14a", 7), ("a", "b14", "laptop", "a14_monitorwa", 8, None)])),
    ("15", 10, ("g", "s15")),
]

# Takarir = narasi dengan angka berbentuk digit (naskah dubber mengeja angka).
TAKARIR = {
    "01": "Januari 2026. Dua lembar disposisi agenda diturunkan: rencana kegiatan dan rencana audiensi. Yang sampai ke Bagian Prokopim hanya satu. Tidak ada yang lalai, tetapi tidak ada pula yang bisa mengetahuinya.",
    "02": "Rencana kegiatan disusun di spreadsheet lalu dicetak. Penelaahan hanya sempat sekitar 30 menit menjelang jam pulang. Disposisi beredar sebagai foto, penugasan bergantung pada ingatan. Dari pengajuan sampai tayang diperkirakan 18 sampai 24 jam.",
    "03": "Ide ini tidak lahir dari survei, tetapi dari pekerjaan sehari-hari. Undangan masuk dari banyak pintu. Sesudah peristiwa Januari, seluruh Bagian menelaah alur kerja bersama dan menemukan pola yang sama: penugasan tersimpan dalam ingatan, ruangan hanya tercatat di papan tulis, arsip tersebar.",
    "04": "Ada empat pilihan. Menambah pengawasan tidak menyentuh akar masalah. Merapikan spreadsheet tetap menyisakan banyak versi. Membeli aplikasi jadi butuh anggaran, padahal alur keprotokolan sangat khas. Kami memilih membangun sendiri: satu sumber data, setiap keputusan tercatat, tanpa anggaran pengadaan.",
    "05": "Lahirlah Prokopim Hibot: satu alur digital terverifikasi untuk agenda Pimpinan Daerah.",
    "06": "Admin Rencana Kegiatan cukup memindai undangan. Kecerdasan buatan mengisi nama acara, tanggal, jam, lokasi, dan zona waktunya. Admin tinggal memeriksa, lalu mengirimkannya ke Kepala Sub Bagian.",
    "07": "Kepala Sub Bagian menelaah dari mana saja, cukup lewat telepon. Tombol persetujuan baru aktif setelah undangan dibuka dan butir pemeriksaan dicentang.",
    "08": "Kepala Bagian memeriksa dan memutus, dari mana saja. Sekali disetujui, agenda langsung tayang, tanpa cetak ulang.",
    "09": "Begitu tayang, agenda langsung ada di telepon Wali Kota dan Wakil Wali Kota. Ajudan mengonfirmasi kehadiran, dan Wali Kota dapat mendisposisikan kepada Wakil Wali Kota. Tidak ada lagi foto disposisi yang berpindah dari grup ke grup.",
    "10": "Petugas ditugaskan dan langsung diberi tahu. Setiap langkah tercatat di Riwayat Alur: siapa, kapan, dan apa keputusannya. Bila Kepala Bagian berhalangan, Pelaksana Harian melanjutkan alur, dan kewenangannya padam sendiri pada tanggal akhirnya.",
    "11": "Selain agenda Pimpinan, ada dua layanan pendukung. Bagi instansi, peminjaman ruang rapat secara daring. Bagi instansi dan masyarakat, permohonan audiensi dan bertamu kepada Pimpinan, yang statusnya dipantau sendiri dengan kode.",
    "12": "Per 24 September 2026: 589 kegiatan terkelola. Waktu sampai tayang turun menjadi median 1,99 jam, dan 99,3% tayang kurang dari sehari. 3.072 keputusan terekam. 92,4% kegiatan memiliki penugasan petugas. Belanja pengadaannya nol rupiah.",
    "13": "",
    "14": "Sebelas SOP dan Pelaksana Harian menjaga alur tetap berjalan, bahkan ketika pejabat berhalangan. Sejak proposal, aplikasi terus dikembangkan dari kendala pengguna.",
    "15": "Prokopim Hibot. Satu alur. Satu data. Setiap keputusan tercatat.",
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


def bagian_nyata(klips, lapis, T, keluar, silang=0.4, suara=None, suara_klips=None):
    """Rekaman nyata (kamera): potong, perbesar perlahan, sambung dengan transisi, beri lapisan, pas T detik.
    Suara dibisukan kecuali `suara` diisi: diambil dari `suara_klips` (rekaman lain) atau dari klip gambarnya sendiri."""
    ins, flt, lens = [], [], []
    for i, (f, a, b) in enumerate(klips):
        d = b - a; lens.append(d)
        ins += ["-i", D + "nyata/" + f]
        flt.append(f"[{i}:v]trim=start={a}:end={b},setpts=PTS-STARTPTS,fps=25,"
                   f"scale=w='trunc(max(1920,1080*iw/ih)*(1+0.06*t/{d:.3f})/2)*2':h=-2:eval=frame:flags=lanczos,crop=1920:1080,unsharp=5:5:0.5,setsar=1,format=yuv420p[v{i}]")
    cur, off = "v0", lens[0]
    for i in range(1, len(klips)):
        off -= silang
        flt.append(f"[{cur}][v{i}]xfade=transition=fade:duration={silang}:offset={off:.3f}[x{i}]")
        cur, off = f"x{i}", off + lens[i]
    total = sum(lens) - silang * (len(klips) - 1)
    sf = 1.0 if suara and not suara_klips else max(1.0, min(1.3, T / total))
    sisa = max(0.0, T - total * sf)
    n = len(klips)
    ins += ["-loop", "1", "-i", D + "gr/" + lapis + ".png"]
    flt.append(f"[{cur}]setpts=PTS*{sf:.4f},fps=25,tpad=stop_mode=clone:stop_duration={sisa + 0.5:.3f}[isi]")
    flt.append(f"[isi][{n}:v]overlay=0:0:shortest=0,trim=duration={T},setsar=1,format=yuv420p")
    jalankan("ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", ";".join(flt), "-t", str(T), "-r", "25",
             "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-an", keluar)
    if suara:  # suara asli Wali Kota: disambung dengan silang yang sama, dibersihkan, disamakan kerasnya dengan narasi
        ains, af = [], []
        klips = suara_klips or klips
        total = sum(b - a for _, a, b in klips) - silang * (len(klips) - 1)
        for i, (f, a, b) in enumerate(klips):
            ains += ["-i", D + "nyata/" + f]
            af.append(f"[{i}:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,aresample=48000[a{i}]")
        cur = "a0"
        for i in range(1, len(klips)):
            af.append(f"[{cur}][a{i}]acrossfade=d={silang}[c{i}]"); cur = f"c{i}"
        af.append(f"[{cur}]highpass=f=90,afftdn=nf=-30,loudnorm=I=-17:TP=-1.5:LRA=9,afade=t=in:d=0.15,atrim=0:{min(total, T):.3f},afade=t=out:st={min(total, T) - 0.3:.3f}:d=0.3[o]")
        jalankan("ffmpeg", "-y", "-loglevel", "error", *ains, "-filter_complex", ";".join(af), "-map", "[o]", "-ac", "2", "-ar", "48000", suara)


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


# Adegan ponsel: bingkai HP besar di kiri, jadi takarir digeser ke ruang kanan.
PONSEL = {"07", "09", "11"}
PONSEL_SESUDAH = {}   # adegan campuran: {nomor: detik mulai bagian ponsel}
def _hp(no, rel):
    return no in PONSEL or (no in PONSEL_SESUDAH and rel >= PONSEL_SESUDAH[no] - 0.2)
ML = lambda no, rel=0: 720 if _hp(no, rel) else 0
MR = lambda no, rel=0: 60 if _hp(no, rel) else 0


# Adegan yang memakai suara asli Wali Kota; narasi adegan itu digeser (detik) agar tidak bertumpuk.
# (Klip IMG_1727-1731 hanya berisi suara ruangan; adegan 13 memakai suara dari video pernyataan.)
SUARA_ASLI = {"13"}
NARASI_GESER = {}


def waktu_ucapan(no, mulai):
    """Petakan waktu video sumber ke waktu video utama melalui urutan potongan rekaman nyata."""
    klips, sil = PERNYATAAN, SILANG_NYATA.get(no, 0.4)
    t, peta = mulai, []
    for f, a, b in klips:
        peta.append((a, b, t)); t += (b - a) - sil
    out = []
    for s0, s1, teks in UCAPAN.get(no, []):
        a, b, t0 = next(x for x in peta if x[0] <= s0 < x[1])
        out.append((t0 + s0 - a, t0 + min(s1, b) - a, teks))
    return out


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
    waktu = {}
    if os.path.exists(D + "narasi/waktu.json"):
        waktu = json.load(open(D + "narasi/waktu.json"))
    for no, dur, _ in ADEGAN:
        for a, b, x in waktu_ucapan(no, mulai[no]):
            ev.append(f"Dialogue: 0,{ts(a)},{ts(b)},Takarir,,0,0,46,,{x}")
        kal = [k for k in re.split(r"(?<=[.!?])\s+", TAKARIR.get(no, "").strip()) if k]
        if not kal:
            continue
        if no in waktu and len(waktu[no]["awal"]) == len(kal):
            # selaras suara: tiap kalimat tampil sebesar rentang ucapannya
            w = waktu[no]; base = mulai[no] + 0.3 + NARASI_GESER.get(no, 0.0)
            for i, k in enumerate(kal):
                a0 = base + w["awal"][i]
                a1 = base + (w["awal"][i + 1] - 0.05 if i + 1 < len(kal) else w["panjang"] + 0.15)
                pot = potong_kalimat(k); tot = sum(len(x) for x in pot); t = a0
                for x in pot:
                    t2 = t + (a1 - a0) * len(x) / tot
                    ev.append(f"Dialogue: 0,{ts(t)},{ts(t2 - 0.03)},Takarir,,{ML(no, t - mulai[no])},{MR(no, t - mulai[no])},46,,{x}"); t = t2
            continue
        k = potong_kalimat(TAKARIR.get(no, ""))
        a0, a1 = mulai[no] + 0.4, mulai[no] + dur - 0.3
        tot = sum(len(x) for x in k)
        t = a0
        for x in k:
            t2 = t + (a1 - a0) * len(x) / tot
            ev.append(f"Dialogue: 0,{ts(t)},{ts(t2 - 0.05)},Takarir,,{ML(no, t - mulai[no])},{MR(no, t - mulai[no])},46,,{x}")
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
    mulai, t, berkas, suara_asli = {}, 0.0, [], []
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
                if it[0] == "n":
                    sw = D + f"bagian/suara_{no}.wav" if no in SUARA_ASLI else None
                    bagian_nyata(it[1], it[2], it[3], p, silang=SILANG_NYATA.get(no, 0.4), suara=sw, suara_klips=SUARA_KLIP.get(no))
                    if sw: suara_asli.append((sw, mulai[no] + sum(x[3] for x in items[:j] if x[0] == "n")))
                elif it[0] == "g":  # ("g", id, durasi[, mulai_dari])
                    jalankan("ffmpeg", "-y", "-loglevel", "error", "-ss", str(it[3] if len(it) > 3 else 0), "-i", D + "gr/" + it[1] + ".mp4", "-t", str(it[2]), "-vf", "fps=25,format=yuv420p", "-c:v", "libx264", "-crf", "17", p)
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
    if os.environ.get("TANPA_NARASI"):  # untuk diisi suara sendiri (CapCut dsb.): musik dan suara asli Wali Kota saja
        narasi, hasil = [], hasil.replace(".mp4", "-tanpa-narasi.mp4")
    vf = f"subtitles={ass}:fontsdir={os.path.expanduser('~/.fonts')},fade=t=in:st=0:d=0.6,fade=t=out:st={t - 0.8}:d=0.8"
    if narasi or suara_asli:
        ins, flt = ["-i", mentah], []
        for i, (no, st) in enumerate(narasi, 1):
            f = next(D + f"narasi/adegan-{no}.{e}" for e in ("wav", "m4a", "mp3") if os.path.exists(D + f"narasi/adegan-{no}.{e}"))
            g = int((st + NARASI_GESER.get(no, 0.0)) * 1000 + 300); ins += ["-i", f]; flt.append(f"[{i}:a]adelay={g}|{g}[n{i}]")
        n = len(narasi)
        if os.path.exists(D + "musik.wav"):   # musik latar pelan (musik.py), di bawah narasi
            ins += ["-i", D + "musik.wav"]; n += 1
            redam = "+".join(f"between(t,{a:.2f},{a + durasi(f):.2f})" for f, a in suara_asli) or "0"
            flt.append(f"[{n}:a]atrim=0:{t},volume='if({redam},0.22,1.0)':eval=frame[n{n}]")
        for f, a in suara_asli:
            ins += ["-i", f]; n += 1
            flt.append(f"[{n}:a]adelay={int(a * 1000)}|{int(a * 1000)}[n{n}]")
        flt.append("".join(f"[n{i}]" for i in range(1, n + 1)) + f"amix=inputs={n}:normalize=0,apad,atrim=0:{t}[a]")
        jalankan("ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", f"[0:v]{vf}[v];" + ";".join(flt), "-map", "[v]", "-map", "[a]",
                 "-c:v", "libx264", "-crf", "19", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-t", str(t), hasil)
    else:
        jalankan("ffmpeg", "-y", "-loglevel", "error", "-i", mentah, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-vf", vf,
                 "-c:v", "libx264", "-crf", "19", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", "-t", str(t), hasil)
    print("selesai", hasil, round(durasi(hasil), 2), "detik,", round(os.path.getsize(hasil) / 1e6, 1), "MB")


if __name__ == "__main__":
    main()
