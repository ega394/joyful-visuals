"""Suara pemandu otomatis (espeak-ng + MBROLA bahasa Indonesia), per kalimat.

Menulis narasi/adegan-NN.wav dan narasi/waktu.json (awal tiap kalimat, untuk menyelaraskan takarir).
Suara ini sintetis, penanda sementara: berkas rekaman Dubber Protokol dengan nama yang sama menggantikannya.
"""
import json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from naskah import S  # lembar naskah dubber (angka dieja)

D = os.path.dirname(os.path.abspath(__file__)) + "/"
os.makedirs(D + "narasi", exist_ok=True)
DUR = {"01":20,"02":35,"03":25,"04":25,"05":10,"06":15,"07":15,"08":10,"09":20,"10":15,"11":20,"12":35,"13":15,"14":15,"15":10}
LEWAT = {"13"}                     # kutipan Wali Kota tampil di layar tanpa narasi
JEDA = 0.35                        # detik antarkalimat
SISA = 1.0                         # sisa di ujung adegan

def ucap(teks):
    t = re.sub(r"\bSOP\b", "es-o-pe", teks)
    t = t.replace("Prokopim Hibot", "Prokopim Hibot").replace("Bagian Prokopim", "Bagian Prokopim")
    return t

def sintesis(teks, laju, keluar):
    subprocess.run(["espeak-ng", "-v", "mb-id1", "-s", str(laju), "-p", "45", "-g", "3", "-w", keluar, ucap(teks)], check=True)

def lama(f):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).decode())

waktu = {}
for no, _, _, _, teks, _ in S:
    if no in LEWAT:
        continue
    kal = [k for k in re.split(r"(?<=[.!?])\s+", teks.strip()) if k]
    laju = 135
    while True:
        sub = []
        for i, k in enumerate(kal):
            f = D + f"narasi/_{no}_{i}.wav"; sintesis(k, laju, f); sub.append((f, lama(f)))
        tot = sum(d for _, d in sub) + JEDA * (len(sub) - 1)
        if tot <= DUR[no] - SISA - 0.3 or laju >= 185:
            break
        laju += 6
    # gabung kalimat dengan jeda senyap, catat awal tiap kalimat
    awal, t, lst = [], 0.0, []
    for i, (f, d) in enumerate(sub):
        awal.append(round(t, 2)); t += d + JEDA
        lst += ["-i", f]
    flt = ";".join(f"[{i}:a]aresample=24000,apad=pad_dur={JEDA}[a{i}]" for i in range(len(sub))) + ";" + "".join(f"[a{i}]" for i in range(len(sub))) + f"concat=n={len(sub)}:v=0:a=1,loudnorm=I=-17:TP=-1.5:LRA=7[o]"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *lst, "-filter_complex", flt, "-map", "[o]", "-ar", "48000", D + f"narasi/adegan-{no}.wav"], check=True)
    waktu[no] = {"awal": awal, "kalimat": kal, "panjang": round(t - JEDA, 2), "laju": laju}
    print(no, "laju", laju, "panjang", round(t - JEDA, 1), "dari", DUR[no])
json.dump(waktu, open(D + "narasi/waktu.json", "w"), ensure_ascii=False, indent=1)
for f in os.listdir(D + "narasi"):
    if f.startswith("_"):
        os.remove(D + "narasi/" + f)
