"""Potongan vertikal 9:16, 60 detik, dari video utama (tanpa takarir) untuk TikTok/Instagram."""
import os, subprocess

D = os.path.dirname(os.path.abspath(__file__)) + "/"
SUMBER = D + "bagian/_mentah.mp4"
# (mulai di video utama, durasi, takarir)
POTONG = [
    (2, 10, "Januari 2026: satu lembar disposisi tertinggal, dan tak ada yang tahu."),
    (107, 6, "Kini undangan cukup dipindai."),
    (128, 6, "Ditelaah dari mana saja, dengan daftar periksa wajib."),
    (141, 6, "Diputus Kabag, lalu langsung tayang."),
    (150, 7, "Agenda langsung tiba di HP Wali Kota."),
    (212, 15, "589 kegiatan · median 1,99 jam sampai tayang · 99,3% tayang kurang dari sehari."),
    (285, 10, "Satu alur. Satu data. Setiap keputusan tercatat."),
]


def ts(s):
    return f"0:{int(s // 60):02d}:{s % 60:05.2f}"


def main():
    ass = D + "keluaran/vertikal.ass"
    t, ev = 0.0, []
    for _, d, k in POTONG:
        ev.append(f"Dialogue: 0,{ts(t + 0.2)},{ts(t + d - 0.1)},T,,0,0,0,,{k}")
        t += d
    with open(ass, "w") as f:
        f.write("""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: T,Plus Jakarta Sans,64,&H00FFFFFF,&H00FFFFFF,&H00281A0A,&H96281A0A,0,0,0,0,100,100,0,0,3,18,0,2,70,70,330,1
Style: J,Plus Jakarta Sans,96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,-1,0,1,0,0,8,60,60,250,1
Style: S,Plus Jakarta Sans,40,&H004CA8C9,&H004CA8C9,&H00000000,&H00000000,0,0,0,0,100,100,3,0,1,0,0,8,60,60,380,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + f"Dialogue: 1,0:00:00.00,{ts(t)},J,,0,0,0,,Prokopim Hibot\nDialogue: 1,0:00:00.00,{ts(t)},S,,0,0,0,,KALTARA INNOVATION AWARDS 2026\n" + "\n".join(ev) + "\n")
    parts, flt = [], []
    for i, (a, d, _) in enumerate(POTONG):
        parts += ["-ss", str(a), "-t", str(d), "-i", SUMBER]
        flt.append(f"[{i}:v]scale=1080:-2,setsar=1,fps=25[v{i}]")
    n = len(POTONG)
    flt.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[isi]")
    logo = D + "aset/kaltara.png"; logo2 = D + "aset/tarakan.png"
    flt.append(f"color=c=0x0A1628:s=1080x1920:r=25:d={t}[bg]")
    flt.append("[bg][isi]overlay=0:(H-h)/2-40:shortest=1[a1]")
    flt.append(f"movie={logo},scale=-1:110[l1];movie={logo2},scale=-1:110[l2]")
    flt.append("[a1][l1]overlay=380:90[a2];[a2][l2]overlay=550:90[a3]")
    flt.append(f"[a3]subtitles={ass}:fontsdir={os.path.expanduser('~/.fonts')},fade=t=in:st=0:d=0.5,fade=t=out:st={t - 0.6}:d=0.6,format=yuv420p[v]")
    out = D + "keluaran/Video-Prokopim-Hibot-Vertikal-60s.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *parts, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                    "-filter_complex", ";".join(flt), "-map", "[v]", "-map", f"{n}:a", "-t", str(t),
                    "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out], check=True)
    print("selesai", out, t, "detik")


if __name__ == "__main__":
    main()
