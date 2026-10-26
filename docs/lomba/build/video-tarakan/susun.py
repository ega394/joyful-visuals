"""Susun video akhir: gambar (render.mjs), narasi, suara asli Wali Kota, musik, efek, takarir.

KERJA=<folder kerja> NYATA=<rekaman nyata> python3 susun.py
  -> KERJA/keluaran/Video-Prokopim-Hibot-Tarakan-2026.mp4, takarir .ass/.srt, audio campuran

Musik diredam otomatis setiap kali ada suara (narasi atau Wali Kota) agar ucapan tetap jelas.
"""
import json, os, re, subprocess
import numpy as np
import soundfile as sf

KERJA = os.environ.get("KERJA", os.path.dirname(os.path.abspath(__file__)))
NYATA = os.environ.get("NYATA", os.path.join(KERJA, "..", "video", "nyata"))
SR = 48000
L = json.load(open(os.path.join(KERJA, "linimasa.json")))
TOTAL = L["total"]
N = int(TOTAL * SR)
OUT = os.path.join(KERJA, "keluaran")
NAMA = os.environ.get("NAMA", "Video-Prokopim-Hibot-Tarakan-2026")


def jalankan(*a):
    subprocess.run(a, check=True)


def baca(f):
    x, sr = sf.read(f, dtype="float32", always_2d=True)
    assert sr == SR, (f, sr)
    return x.mean(1)


def taruh(buf, t, x, g=1.0):
    i = int(round(t * SR)); a, b = max(0, i), min(len(buf), i + len(x))
    if b > a:
        buf[a:b] += g * x[a - i:b - i]


# ---------- suara ----------
def suara_walikota(a):
    """Potongan pernyataan Wali Kota, disambung silang, dibersihkan, disamakan keras dengan narasi."""
    tmp = os.path.join(KERJA, "audio", "_wk.wav")
    ins, af = [], []
    for i, k in enumerate(a["klip"]):
        x0, x1 = k["sumber"]
        ins += ["-i", os.path.join(NYATA, "pernyataan-walikota.mp4")]
        af.append(f"[{i}:a]atrim=start={x0}:end={x1},asetpts=PTS-STARTPTS,aresample={SR}[a{i}]")
    cur = "a0"
    for i in range(1, len(a["klip"])):
        af.append(f"[{cur}][a{i}]acrossfade=d={a['silang']}[c{i}]"); cur = f"c{i}"
    af.append(f"[{cur}]highpass=f=90,afftdn=nf=-30,acompressor=threshold=-22dB:ratio=2.5:attack=10:release=150,"
              f"loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=in:d=0.12[o]")
    jalankan("ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", ";".join(af), "-map", "[o]", "-ac", "1", "-ar", str(SR), tmp)
    return baca(tmp)


def selubung(x, serang=0.05, lepas=0.45):
    """Selubung suara (untuk peredaman musik): RMS 20 ms, naik cepat turun pelan."""
    h = int(0.02 * SR); n = len(x) // h
    r = np.sqrt(np.mean(x[: n * h].reshape(n, h) ** 2, axis=1) + 1e-12)
    on = (r > 0.01).astype(float)
    a, b = np.exp(-1 / (serang / 0.02)), np.exp(-1 / (lepas / 0.02))
    y = np.zeros_like(on); s = 0.0
    for i, v in enumerate(on):
        s = (a if v > s else b) * s + (1 - (a if v > s else b)) * v; y[i] = s
    y = np.repeat(y, h)
    return np.pad(y, (0, len(x) - len(y)), mode="edge")[: len(x)]


def campur():
    os.makedirs(os.path.join(KERJA, "audio"), exist_ok=True)
    suara = np.zeros(N, np.float32)
    for a in L["adegan"]:
        f = os.path.join(KERJA, "narasi", a["id"] + ".wav")
        if "narasi" in a and os.path.exists(f):
            taruh(suara, a["narasi"], baca(f))
        if a["id"] == "walikota":
            taruh(suara, a["mulai"] + a["lead"], suara_walikota(a))
    musik, _ = sf.read(os.path.join(KERJA, "audio", "musik.wav"), dtype="float32", always_2d=True)
    efek, _ = sf.read(os.path.join(KERJA, "audio", "efek.wav"), dtype="float32", always_2d=True)
    musik, efek = musik[:N], efek[:N]
    if len(musik) < N:
        musik = np.pad(musik, ((0, N - len(musik)), (0, 0)))
    if len(efek) < N:
        efek = np.pad(efek, ((0, N - len(efek)), (0, 0)))
    env = selubung(suara)
    g = 0.5 * (1 - 0.6 * env)                  # musik ±6 dB di bawah narasi, ±14 dB lebih pelan lagi saat ada ucapan
    akhir = suara[:, None] * 1.0 + musik * g[:, None] + efek * 0.55
    sf.write(os.path.join(KERJA, "audio", "_campur.wav"), akhir.astype(np.float32), SR, subtype="FLOAT")
    sf.write(os.path.join(KERJA, "audio", "suara.wav"), suara, SR, subtype="FLOAT")
    jalankan("ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(KERJA, "audio", "_campur.wav"),
             "-af", "loudnorm=I=-15:TP=-1.5:LRA=11", "-ar", str(SR), os.path.join(KERJA, "audio", "campur.wav"))
    print("audio campuran siap")


# ---------- takarir ----------
def ts(s):
    cs = int(round(s * 100)); return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def srt_ts(s):
    ms = int(round(s * 1000)); return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


EMAS = r"{\c&H4EC1F2&}"  # #F2C14E dalam urutan BGR ASS
def sorot(teks):
    """Angka dan satuannya diberi warna emas."""
    return re.sub(r"(Rp0|±?\d+(?:[.,]\d+)*(?:\s?(?:%|jam|menit|kegiatan|instansi|alur kerja|SOP|pembaruan))?)", lambda m: EMAS + m.group(1) + r"{\c}", teks)


def peristiwa():
    """Keping takarir (awal, akhir, teks) dalam waktu global video utama."""
    ev = []
    for a in L["adegan"]:
        m = a["mulai"]
        for k in a.get("kalimat", []):
            batas = [0.0] + list(k["batas"]) + [k["akhir"] - k["awal"]]
            for i, kp in enumerate(k["keping"]):
                t0 = m + k["awal"] + batas[i] - (0.08 if i == 0 else 0)
                t1 = m + k["awal"] + batas[i + 1] + (0.25 if i == len(k["keping"]) - 1 else 0)
                ev.append((t0, t1, kp.rstrip("…") if kp.endswith("…") and i < len(k["keping"]) - 1 else kp))
        for u in a.get("ucapan", []):
            ev.append((m + u["awal"], m + u["akhir"], u["takarir"]))
    ev.sort()
    for i in range(len(ev) - 1):                 # jangan bertumpuk
        if ev[i][1] > ev[i + 1][0] - 0.02:
            ev[i] = (ev[i][0], ev[i + 1][0] - 0.02, ev[i][2])
    return ev


def takarir():
    ev = peristiwa()
    head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: T,Plus Jakarta Sans,48,&H00FFFFFF,&H00FFFFFF,&H28120A05,&H00000000,1,0,0,0,100,100,0,0,3,16,0,2,220,220,42,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "takarir.ass"), "w") as f:
        f.write(head + "\n".join(f"Dialogue: 0,{ts(a)},{ts(b)},T,,0,0,0,,{sorot(x)}" for a, b, x in ev) + "\n")
    with open(os.path.join(OUT, NAMA + ".srt"), "w") as f:
        f.write("\n".join(f"{i}\n{srt_ts(a)} --> {srt_ts(b)}\n{x}\n" for i, (a, b, x) in enumerate(ev, 1)))
    print(len(ev), "keping takarir")
    return os.path.join(OUT, "takarir.ass")


def main():
    campur()
    ass = takarir()
    seg = os.path.join(KERJA, "segmen")
    mentah = os.path.join(seg, "_gambar.mp4")
    jalankan("ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", os.path.join(seg, "daftar.txt"), "-c", "copy", mentah)
    hasil = os.path.join(OUT, NAMA + ".mp4")
    jalankan("ffmpeg", "-y", "-loglevel", "error", "-i", mentah, "-i", os.path.join(KERJA, "audio", "campur.wav"),
             "-vf", f"subtitles={ass}:fontsdir={os.path.expanduser('~/.fonts')}", "-map", "0:v", "-map", "1:a",
             "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
             "-movflags", "+faststart", "-t", str(TOTAL), hasil)
    # versi tanpa takarir (untuk diunggah dengan takarir terpisah atau disunting ulang)
    jalankan("ffmpeg", "-y", "-loglevel", "error", "-i", mentah, "-i", os.path.join(KERJA, "audio", "campur.wav"),
             "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
             "-t", str(TOTAL), os.path.join(OUT, NAMA + "-tanpa-takarir.mp4"))
    d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", hasil]).decode())
    print("selesai", hasil, round(d, 2), "dtk,", round(os.path.getsize(hasil) / 1e6, 1), "MB")


if __name__ == "__main__":
    main()
