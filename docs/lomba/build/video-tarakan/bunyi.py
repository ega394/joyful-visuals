"""Musik latar dan efek suara sintetis (bebas hak cipta), diselaraskan dengan linimasa video.

KERJA=<folder kerja> python3 bunyi.py   -> KERJA/audio/musik.wav dan KERJA/audio/efek.wav (48 kHz, stereo)

Musik mengikuti alur cerita: tegang dan gelap (masalah), hentakan saat judul, berangsur
cerah dan berirama (solusi, dampak), mereda saat Wali Kota berbicara, lalu ditutup akor mayor.
"""
import json, os
import numpy as np
from scipy import signal

KERJA = os.environ.get("KERJA", os.path.dirname(os.path.abspath(__file__)))
SR = 48000
L = json.load(open(os.path.join(KERJA, "linimasa.json")))
A = {a["id"]: a for a in L["adegan"]}
TOTAL = L["total"] + 1.0
N = int(TOTAL * SR)
rng = np.random.default_rng(29)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def kata(adegan, i, k, urut=0):
    """Saat (detik, global) sebuah kata diucapkan — sama dengan perkiraan di grafis.html."""
    a = A[adegan]; s = a["kalimat"][i]; u = (s.get("ucap") or s["takarir"]).lower(); idx, dari = -1, 0
    for _ in range(urut + 1):
        idx = u.find(k.lower(), dari)
        if idx < 0:
            break
        dari = idx + 1
    lok = s["awal"] if idx < 0 else s["awal"] + (s["akhir"] - s["awal"]) * idx / len(u)
    return a["mulai"] + lok


def k(adegan, i):
    return A[adegan]["mulai"] + A[adegan]["kalimat"][i]["awal"]


def tambah(buf, t, x, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= len(buf) or i + len(x) <= 0:
        return
    if x.ndim == 1:
        x = np.stack([x * np.sqrt(0.5 * (1 - pan)), x * np.sqrt(0.5 * (1 + pan))], 1) * np.sqrt(2)
    a, b = max(0, i), min(len(buf), i + len(x))
    buf[a:b] += gain * x[a - i:b - i]


def tt(d):
    return np.arange(int(d * SR)) / SR


def lowpass(x, f, orde=2):
    return signal.sosfilt(signal.butter(orde, f, "low", fs=SR, output="sos"), x, axis=0)


def highpass(x, f, orde=2):
    return signal.sosfilt(signal.butter(orde, f, "high", fs=SR, output="sos"), x, axis=0)


def bandpass(x, a, b, orde=2):
    return signal.sosfilt(signal.butter(orde, [a, b], "band", fs=SR, output="sos"), x, axis=0)


def gema(x, rt=1.8, campur=0.25, pre=0.02):
    """Gema konvolusi sederhana (derau meluruh), stereo terdekorelasi."""
    n = int(rt * SR)
    t = np.arange(n) / SR
    ir = np.stack([rng.standard_normal(n), rng.standard_normal(n)], 1) * np.exp(-6.9 * t / rt)[:, None]
    ir = lowpass(ir, 6000); ir[: int(pre * SR)] = 0; ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    basah = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return (1 - campur) * x + campur * basah


# ---------- alat musik ----------
def petik(m, d=1.6, kuat=1.0, cerah=1.0):
    t = tt(d); f = hz(m); y = np.zeros_like(t)
    for h in range(1, 8):
        y += (1 / h ** 1.25) * np.exp(-t * (2.2 + 1.6 * h / cerah)) * np.sin(2 * np.pi * f * h * t * (1 + 0.0004 * h * h))
    y *= np.minimum(1, t / 0.004)
    return kuat * y * 0.35


def piano(m, d=2.2, kuat=1.0):
    t = tt(d); f = hz(m); y = np.zeros_like(t)
    for h, a in zip(range(1, 9), [1, .55, .32, .22, .14, .09, .06, .04]):
        y += a * np.exp(-t * (1.1 + 0.9 * h)) * np.sin(2 * np.pi * f * h * t * (1 + 0.0003 * h * h))
    y *= np.minimum(1, t / 0.006)
    return kuat * lowpass(y, 3800) * 0.3


def pad(nada, d, kuat=1.0, gelap=1400):
    t = tt(d); y = np.zeros_like(t)
    for m in nada:
        for det in (-0.08, 0.0, 0.07):
            f = hz(m + det)
            for h in range(1, 9):
                y += (1 / h) * np.sin(2 * np.pi * f * h * t + rng.uniform(0, 6.28))
    serang, lepas = min(1.5, d / 3), min(1.8, d / 3)
    env = np.minimum(1, t / serang) * np.minimum(1, (d - t) / lepas)
    y = lowpass(y * env, gelap) / (len(nada) * 9)
    return kuat * y


def bas(m, d=0.6, kuat=1.0):
    while m < 36:          # jangan lebih rendah dari C2: tak terdengar di ponsel dan memakan ruang
        m += 12
    t = tt(d); f = hz(m)
    y = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 3.5) * np.minimum(1, t / 0.005)
    return kuat * np.tanh(1.5 * y) * 0.5


def kik(kuat=1.0):
    t = tt(0.45); fr = 48 + 95 * np.exp(-t * 32)
    y = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 9) + 0.15 * rng.standard_normal(len(t)) * np.exp(-t * 300)
    return kuat * y * 0.7


def tepuk(kuat=1.0):
    t = tt(0.25); n = rng.standard_normal(len(t))
    env = np.exp(-t * 22) + 0.6 * np.exp(-((t - 0.012) % 0.011) * 600) * (t < 0.035)
    return kuat * bandpass(n, 900, 3200) * env * 0.35


def hihat(kuat=1.0, d=0.06):
    t = tt(d); return kuat * highpass(rng.standard_normal(len(t)), 7000) * np.exp(-t * 70) * 0.18


# ---------- efek ----------
def ketik():
    t = tt(0.05); return bandpass(rng.standard_normal(len(t)), 1800, 6000) * np.exp(-t * 160) * 0.5


def jepret():
    t = tt(0.25); n = rng.standard_normal(len(t))
    y = bandpass(n, 1500, 8000) * (np.exp(-t * 90) + 0.8 * np.exp(-np.maximum(0, t - 0.09) * 70) * (t > 0.09))
    return y * 0.6


def kertas(d=0.7):
    t = tt(d); n = rng.standard_normal(len(t))
    mod = np.abs(signal.sosfilt(signal.butter(2, 18, "low", fs=SR, output="sos"), rng.standard_normal(len(t)))) * 6
    return bandpass(n, 1200, 7000) * mod * np.sin(np.pi * t / d) * 0.25


def hentak():
    t = tt(0.6); fr = 40 + 60 * np.exp(-t * 18)
    y = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 7) + lowpass(rng.standard_normal(len(t)), 900) * np.exp(-t * 25) * 0.6
    return y * 0.7


def desir(d=0.8, naik=True):
    t = tt(d); n = rng.standard_normal(len(t))
    pot = [bandpass(n[i:i + 2400], 300 + 4000 * ((i / len(t)) if naik else 1 - i / len(t)), 600 + 6000 * ((i / len(t)) if naik else 1 - i / len(t)))
           for i in range(0, len(t), 2400)]
    y = np.concatenate(pot)[: len(t)]
    return y * np.sin(np.pi * t / d) ** 2 * 0.35


def dentang(nada=(88, 93), jarak=0.11, kuat=1.0):
    y = np.zeros(int(1.4 * SR))
    for i, m in enumerate(nada):
        t = tt(1.4 - i * jarak); f = hz(m)
        s = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t * 5.5) * np.minimum(1, t / 0.002)
        y[int(i * jarak * SR): int(i * jarak * SR) + len(s)] += s
    return kuat * y * 0.22


def letup(kuat=1.0, m=84):
    t = tt(0.18); f = hz(m) * (1 + 0.5 * np.exp(-t * 40))
    return kuat * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 28) * 0.25


def tik():
    t = tt(0.03); return highpass(rng.standard_normal(len(t)), 3000) * np.exp(-t * 250) * 0.35


def dering(d=1.6):
    t = tt(d); on = ((t % 0.6) < 0.4).astype(float)
    return (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 480 * t)) * on * 0.08 * np.minimum(1, (d - t) / 0.1)


def printer(d=1.0):
    t = tt(d); n = rng.standard_normal(len(t))
    return (bandpass(n, 300, 1800) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * t)) + 0.3 * np.sign(np.sin(2 * np.pi * 110 * t))) * np.sin(np.pi * t / d) * 0.12


def naik(d=2.0):
    t = tt(d); f = 180 * (2000 / 180) ** (t / d)
    y = 0.4 * np.sin(2 * np.pi * np.cumsum(f) / SR) + desir(d, True) / 0.35 * 0.5
    return y * (t / d) ** 2 * 0.5


def gong(kuat=1.0):
    """Hentakan sinematik: dentum rendah + derau + akor terang."""
    y = np.zeros(int(3.0 * SR)); h = hentak(); y[: len(h)] += h * 1.2
    for m in (48, 55, 60, 64, 67, 72):
        p = piano(m, 3.0, 0.5); y[: len(p)] += p
    return kuat * y


# ---------- susun musik ----------
def musik():
    M = np.zeros((N, 2))
    # A. pembuka: pad gelap A minor, denyut pelan
    a0, a1 = 0.0, A["judul"]["mulai"]
    tambah(M, a0, pad([45, 52, 57, 60], a1 - a0 + 1.0, 0.9, 900), 0.55)
    for b in np.arange(1.2, a1 - 1.0, 1.5):
        tambah(M, b, bas(33, 0.9, 0.6), 0.5)
    tambah(M, a1 - 2.0, naik(2.0), 0.35)
    # B. judul
    tambah(M, a1, gong(0.9), 0.55)
    # C. masalah: 96 bpm, Am-F-C-G, petikan arpeggio, kik lembut
    c0, c1 = A["dulu"]["mulai"], A["lahir"]["mulai"]
    bar = 60 / 96 * 4
    AKOR_C = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
    AKAR_C = [45, 41, 48, 43]
    t, j = c0, 0
    while t < c1 - 0.05:
        ak, rt = AKOR_C[(j // 2) % 4], AKAR_C[(j // 2) % 4]
        if j % 2 == 0:
            tambah(M, t, pad([x - 12 for x in ak], bar * 2 + 0.8, 0.8, 1100), 0.45)
        for s in range(8):
            ts = t + s * bar / 8
            if ts >= c1 - 0.1:
                break
            m = ak[[0, 1, 2, 1, 0, 2, 1, 2][s]] + (12 if s in (2, 5) else 0)
            tambah(M, ts, petik(m, 1.4, 0.55 + 0.15 * (s % 2 == 0), 0.8), 0.5, pan=-0.3 + 0.6 * (s % 3) / 2)
        for s in (0, 2):
            if t + s * bar / 4 < c1 - 0.1:
                tambah(M, t + s * bar / 4, kik(0.5), 0.45)
                tambah(M, t + s * bar / 4, bas(rt - 12, 0.9, 0.7), 0.45)
        t += bar; j += 1
    tambah(M, c1 - 2.2, naik(2.2), 0.4)
    # D-E-G. solusi & dampak: 100 bpm, C-G-Am-F, empat ketuk
    d0 = A["lahir"]["mulai"]
    tambah(M, d0, gong(1.0), 0.6)
    bar = 60 / 100 * 4
    AKOR = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]
    AKAR = [48, 43, 45, 41]
    wk0, wk1 = A["walikota"]["mulai"], A["lanjut"]["mulai"]
    tutup0 = A["tutup"]["mulai"]
    dampak0 = A["dampak"]["mulai"]
    t, j = d0 + 0.6, 0
    while t < tutup0 - 0.05:
        ak, rt = AKOR[j % 4], AKAR[j % 4]
        diam = wk0 - 0.6 <= t < wk1 - 0.2            # Wali Kota berbicara: hanya pad
        awal_lanjut = wk1 - 0.2 <= t < wk1 + bar * 2   # masuk perlahan sesudahnya
        besar = dampak0 <= t < wk0
        tambah(M, t, pad([x - 12 for x in ak] + [ak[0]], bar + 0.9, 0.9 if not diam else 0.7, 1800 if besar else 1300), 0.42 if not diam else 0.35)
        if not diam:
            for s in range(8):
                ts = t + s * bar / 8
                m = ak[[0, 1, 2, 1, 2, 1, 0, 2][s]] + 12
                tambah(M, ts, piano(m, 1.6, 0.45 + 0.2 * (s % 4 == 0)), 0.5, pan=-0.35 + 0.7 * (s % 4) / 3)
            if besar:
                for s in range(16):
                    tambah(M, t + s * bar / 16, petik(ak[s % 3] + 24, 0.5, 0.28, 1.4), 0.4, pan=0.5 - (s % 2))
            if not awal_lanjut:
                for s in range(4):
                    tambah(M, t + s * bar / 4, kik(0.55), 0.5)
                    tambah(M, t + s * bar / 4, bas(rt - 12, 0.55, 0.8), 0.5)
                    if s in (1, 3):
                        tambah(M, t + s * bar / 4, tepuk(0.6), 0.4)
                for s in range(8):
                    tambah(M, t + s * bar / 8 + bar / 16, hihat(0.6), 0.22, pan=0.3)
        t += bar; j += 1
    # H. penutup: akor besar C-G-Am-F lalu C, berdering
    t = tutup0
    for i, (ak, rt) in enumerate(zip(AKOR + [[60, 64, 67, 72]], AKAR + [36])):
        d = bar if i < 4 else 6.0
        tambah(M, t, pad([x - 12 for x in ak] + list(ak), d + 1.2, 1.0, 2200), 0.45)
        for m in ak:
            tambah(M, t, piano(m + 12, min(d + 1.5, 5), 0.6), 0.45)
        tambah(M, t, bas(rt, 1.6, 0.8), 0.45)
        t += d
    tambah(M, tutup0, gong(0.8), 0.45)
    M = gema(M, 2.2, 0.28)
    M = highpass(M, 38)
    # ujung: pudar
    n0 = int((L["total"] - 2.5) * SR)
    M[n0:] *= np.linspace(1, 0, len(M) - n0)[:, None] ** 2
    return M


def efek():
    E = np.zeros((N, 2))
    p = A["pembuka"]["mulai"]
    for i in range(12):
        tambah(E, p + 0.8 + i * 0.095, ketik(), 0.5, pan=0.2)
    tambah(E, p + 3.9, kertas(0.8), 0.6, -0.4); tambah(E, p + 4.2, kertas(0.7), 0.5, -0.3)
    t_foto = kata("pembuka", 1, "terfoto") - 1.1
    tambah(E, t_foto, jepret(), 0.8)
    tambah(E, p + 4.5, letup(0.7, 79), 0.6, 0.5); tambah(E, t_foto + 0.75, letup(0.8, 84), 0.6, 0.5)
    tambah(E, kata("pembuka", 1, "grup") + 0.3, letup(0.7, 79), 0.6, 0.5)
    tambah(E, k("pembuka", 2) + 0.7, hentak(), 0.7)
    # dulu
    d = A["dulu"]
    tambah(E, k("dulu", 1) + 0.5, hentak(), 0.8)
    tambah(E, kata("dulu", 2, "dicetak"), printer(1.0), 0.8, 0.4)
    tambah(E, kata("dulu", 3, "cetak"), printer(1.2), 0.8, 0.4)
    for b in np.arange(k("dulu", 4), k("dulu", 5) - 0.2, 0.5):
        tambah(E, b, tik(), 0.5, 0.3)
    for i in range(3):
        tambah(E, k("dulu", 5) + 0.45 + i * 0.55, jepret(), 0.45, 0.4)
    for i in range(4):
        tambah(E, k("dulu", 7) + 0.3 + i * 0.35, letup(0.5, 74), 0.4, -0.3 + 0.2 * i)
    tambah(E, kata("dulu", 8, "menelepon"), dering(1.6), 0.9, 0.3)
    tambah(E, kata("dulu", 9, "delapan") - 0.2, hentak(), 0.5)
    # akar
    for nm in ("kertas", "spredsit", "grup", "papan", "telepon"):
        tambah(E, kata("akar", 0, nm) - 0.25, letup(0.6, 72), 0.6, rng.uniform(-0.6, 0.6))
    for nm in ("pendampingan", "peliputan", "naskah"):
        tambah(E, kata("akar", 2, nm) - 0.15, letup(0.6, 69), 0.5)
    tk = kata("akar", 3, "jawabannya") - 0.2
    tambah(E, tk, desir(0.9, True), 0.8)
    tambah(E, tk + 0.75, dentang((76, 83, 88), 0.08, 1.0), 0.7)
    # ide: kartu penjaringan, tiga pilihan dicoret, satu dipilih
    for i, (kk, nm) in enumerate(((0, "pekerjaan"), (1, "sesudah"), (1, "menelaah"))):
        tambah(E, kata("ide", kk, nm) - 0.3, letup(0.6, 72 + 2 * i), 0.5)
    tambah(E, k("ide", 2) - 0.2, desir(0.6, False), 0.4)
    for kk in (3, 4, 5):
        tambah(E, k("ide", kk) + 0.15, hentak(), 0.35)
    tambah(E, k("ide", 6) - 0.1, dentang((79, 84, 88), 0.08, 0.9), 0.6)
    # lahir
    l0 = A["lahir"]["mulai"]
    tambah(E, l0 + 0.35, dentang((84, 88, 91, 96), 0.07, 1.0), 0.6)
    t11 = kata("lahir", 2, "sebelas") - 0.9
    for i in range(11):
        tambah(E, t11 + i * 0.11, tik(), 0.35, -0.5 + i / 10)
    tH = k("lahir", 3) - 0.25
    tambah(E, tH, desir(0.7, True), 0.5)
    # alur
    tambah(E, A["alur"]["mulai"] + 0.2, kertas(0.6), 0.5)
    for nm in (1, 2, 4, 5, 8):
        tambah(E, k("alur", nm) - 0.25, desir(0.5, False), 0.35)
    tambah(E, kata("alur", 1, "kecerdasan") - 0.1, dentang((91, 96), 0.06, 0.8), 0.5)
    for nm in ("dibuka", "dicentang"):
        tambah(E, kata("alur", 3, nm) - 0.1, letup(0.7, 86), 0.6)
    tambah(E, A["alur"]["mulai"] + A["alur"]["kalimat"][3]["akhir"] - 0.35, dentang((84, 91), 0.05, 0.7), 0.5)
    tambah(E, k("alur", 5), dentang((81, 88, 93), 0.08, 0.9), 0.5)
    tk2 = kata("alur", 7, "ketukan") - 0.2
    tambah(E, tk2, ketik(), 0.9); tambah(E, tk2 + 0.05, dentang((88, 95), 0.06, 0.8), 0.5)
    tambah(E, kata("alur", 8, "wotsap") - 0.35, dentang((86, 93), 0.12, 1.0), 0.7, 0.4)
    # layanan, jejak, bangun
    for nm, kk in (("undangan", 0), ("daftar", 0)):
        tambah(E, kata("layanan", kk, nm) - 0.25, desir(0.5, False), 0.35)
    tambah(E, k("layanan", 1) - 0.2, desir(0.5, False), 0.35)
    tambah(E, k("layanan", 2) - 0.2, desir(0.6, True), 0.35)
    tambah(E, kata("layanan", 3, "kode") - 0.35, letup(0.9, 84), 0.7)
    for i in range(7):
        tambah(E, A["jejak"]["mulai"] + 0.35 + i * 0.28, tik(), 0.3, 0.3)
    tambah(E, k("jejak", 2) - 0.25, desir(0.6, False), 0.4)
    tambah(E, kata("jejak", 3, "berakhir"), dentang((84, 88), 0.06, 0.6), 0.45)
    tambah(E, k("jejak", 4) - 0.25, desir(0.6, False), 0.4)
    for kk in (4, 5, 6):
        tambah(E, k("jejak", kk) - 0.15, letup(0.6, 76 + kk), 0.5)
    tambah(E, k("bangun", 1) - 0.2, desir(0.6, False), 0.35)
    tambah(E, k("bangun", 2) - 0.25, desir(0.6, True), 0.35)
    # daya
    for i in range(5):
        tambah(E, A["daya"]["mulai"] + 0.7 + i * 0.15, tik(), 0.3, -0.4 + 0.2 * i)
    tambah(E, k("daya", 1) - 0.25, desir(0.6, False), 0.35)
    for nm in ("sekretaris", "de ka", "bapeda"):
        tambah(E, kata("daya", 1, nm) - 0.3, letup(0.6, 74), 0.5)
    tambah(E, k("daya", 2) - 0.25, desir(0.6, False), 0.35)
    tambah(E, kata("daya", 3, "satu gigabita") - 0.4, desir(0.8, False), 0.5)
    # dampak: tiap angka diberi letupan
    for i in range(1, 9):
        tambah(E, k("dampak", i) - 0.25, letup(0.8, 76 + i), 0.55)
    tambah(E, kata("dampak", 8, "nol") - 0.15, gong(0.8), 0.6)
    # testimoni
    for nm in ("ajudan", "staf", "pelaksana"):
        tambah(E, kata("testimoni", 0, nm) - 0.25, letup(0.5, 79), 0.4)
    # lanjut, tutup
    for kk in (1, 2, 4):
        tambah(E, k("lanjut", kk) - 0.25, desir(0.6, False), 0.35)
    for nm in ("tata kelola, proses", "proses bisnis", "digitalisasi", "data, manajemen", "manajemen", "pengawasan", "efisiensi"):
        tambah(E, kata("lanjut", 1, nm) - 0.25, letup(0.45, 77), 0.35)
    tambah(E, k("lanjut", 5) - 0.25, desir(0.8, True), 0.45)
    tambah(E, kata("tim", 0, "tim inovasi") - 0.2, dentang((79, 84), 0.08, 0.7), 0.45)
    tambah(E, A["tutup"]["mulai"] + 0.2, dentang((84, 88, 91, 96, 100), 0.06, 0.9), 0.55)
    return gema(E, 1.2, 0.18)


def simpan(nama, x):
    import soundfile as sf
    os.makedirs(os.path.join(KERJA, "audio"), exist_ok=True)
    pk = np.max(np.abs(x)) + 1e-9
    sf.write(os.path.join(KERJA, "audio", nama), (x / pk * 0.89).astype(np.float32), SR, subtype="FLOAT")
    print(nama, round(len(x) / SR, 1), "dtk, puncak asli", round(float(pk), 3))


if __name__ == "__main__":
    simpan("musik.wav", musik())
    simpan("efek.wav", efek())
