"""Potongan vertikal 9:16 (±80 dtk) untuk Reels, TikTok, dan Shorts, dari video utama tanpa takarir.

KERJA=<folder kerja> python3 vertikal.py -> KERJA/keluaran/Video-Prokopim-Hibot-Tarakan-Vertikal.mp4
Batas Reels/Shorts ±3 menit, jadi versi tegak dibuat ringkas: kait cerita, solusi, bukti, suara Wali Kota, penutup.
Potongan selalu jatuh di batas kalimat agar narasi tidak terpenggal.
"""
import os, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
import susun
from susun import L, KERJA, OUT, NAMA, jalankan, sorot, ts

A = {a["id"]: a for a in L["adegan"]}


def utuh(i):
    a = A[i]; return (a["mulai"], a["mulai"] + a["lama"])


def kalimat(i, k0, k1, pra=0.3, pasca=0.35):
    a = A[i]; K = a["kalimat"]
    return (a["mulai"] + max(0.0, K[k0]["awal"] - pra), a["mulai"] + min(a["lama"], K[k1]["akhir"] + pasca))


def klip(i, k0, k1, pasca=0.25):
    a = A[i]; K = a["klip"]
    return (a["mulai"] + K[k0]["awal"] - 0.1, a["mulai"] + K[k1]["akhir"] + pasca)


SEGMEN = [utuh("pembuka"), utuh("judul"), (A["lahir"]["mulai"], kalimat("lahir", 0, 2)[1]),
          kalimat("alur", 1, 1), kalimat("alur", 5, 5), kalimat("dampak", 2, 3), kalimat("dampak", 7, 7, 0.3, 0.6),
          klip("walikota", 0, 1), klip("walikota", 3, 3, 0.4), utuh("tutup")]


def main():
    sumber = os.path.join(OUT, NAMA + "-tanpa-takarir.mp4")
    tmp = os.path.join(KERJA, "vertikal"); os.makedirs(tmp, exist_ok=True)
    daftar, ev, pos = [], [], 0.0
    semua = susun.peristiwa()
    for n, (a, b) in enumerate(SEGMEN):
        f = os.path.join(tmp, f"v{n:02d}.mp4"); d = b - a
        jalankan("ffmpeg", "-y", "-loglevel", "error", "-ss", f"{a:.3f}", "-i", sumber, "-t", f"{d:.3f}",
                 "-vf", "fps=25,format=yuv420p", "-af", f"afade=t=in:d=0.06,afade=t=out:st={d - 0.08:.3f}:d=0.08",
                 "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", f)
        daftar.append(f)
        for x0, x1, teks in semua:
            if x1 > a + 0.05 and x0 < b - 0.05:
                ev.append((pos + max(x0, a) - a, pos + min(x1, b) - a, teks))
        pos += d
    lst = os.path.join(tmp, "daftar.txt")
    open(lst, "w").write("".join(f"file '{f}'\n" for f in daftar))
    datar = os.path.join(tmp, "_datar.mp4")
    jalankan("ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", datar)
    latar = os.path.join(tmp, "latar.png")
    jalankan("node", os.path.join(D, "potret.mjs"), os.path.join(KERJA, "vertikal.html"), latar, "1080", "1920")
    ass = os.path.join(tmp, "vertikal.ass")
    head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: T,Plus Jakarta Sans,64,&H00FFFFFF,&H00FFFFFF,&H28120A05,&H00000000,1,0,0,0,100,100,0,0,3,18,0,8,70,70,1360,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    open(ass, "w").write(head + "\n".join(f"Dialogue: 0,{ts(a)},{ts(b)},T,,0,0,0,,{sorot(x)}" for a, b, x in ev) + "\n")
    hasil = os.path.join(OUT, NAMA + "-Vertikal.mp4")
    # video di tengah layar; garis kemajuan emas di bawahnya
    flt = (f"[0:v]scale=1080:-2:flags=lanczos[v];[1:v][v]overlay=0:660:shortest=1[a];"
           f"[2:v]format=rgba[g];[a][g]overlay=x='-W+W*t/{pos:.3f}':y=1300:shortest=1,"
           f"subtitles={ass}:fontsdir={os.path.expanduser('~/.fonts')},format=yuv420p[o]")
    jalankan("ffmpeg", "-y", "-loglevel", "error", "-i", datar, "-loop", "1", "-framerate", "25", "-i", latar,
             "-f", "lavfi", "-i", f"color=c=0xF2C14E:s=1080x6:r=25:d={pos:.3f}",
             "-filter_complex", flt, "-map", "[o]", "-map", "0:a", "-c:v", "libx264", "-preset", "slow", "-crf", "20",
             "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", f"{pos:.3f}", hasil)
    with open(hasil.replace(".mp4", ".srt"), "w") as f:
        f.write("\n".join(f"{i}\n{susun.srt_ts(a)} --> {susun.srt_ts(b)}\n{x}\n" for i, (a, b, x) in enumerate(ev, 1)))
    print("selesai", hasil, round(pos, 1), "dtk")


if __name__ == "__main__":
    main()
