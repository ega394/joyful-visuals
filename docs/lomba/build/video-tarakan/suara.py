"""Narasi otomatis per adegan dengan suara neural bahasa Indonesia (Piper id_ID-news_tts-medium via sherpa-onnx).

KERJA=<folder kerja> MODEL=<folder model piper> python3 suara.py [adegan ...]

Menulis KERJA/narasi/<adegan>.wav (48 kHz, sudah dirapikan) dan KERJA/narasi/waktu.json:
awal-akhir tiap kalimat dan titik potong takarir (jeda nyata di dalam kalimat), sehingga
grafis dan takarir mengikuti suara, bukan sebaliknya.
"""
import json, os, re, subprocess, sys
import numpy as np
import soundfile as sf
import sherpa_onnx

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from naskah import ADEGAN

KERJA = os.environ.get("KERJA", os.path.dirname(os.path.abspath(__file__)))
MODEL = os.environ["MODEL"]
OUT = os.path.join(KERJA, "narasi")
os.makedirs(OUT, exist_ok=True)
AWAL = 0.25          # senyap di depan tiap adegan
MAKS_TAKARIR = 64    # karakter per keping takarir (dua baris)
LAJU = float(os.environ.get("LAJU", "0.93"))   # pengali length_scale naskah: <1 lebih cepat
JEDA = float(os.environ.get("JEDA", "0.85"))   # pengali jeda antarkalimat

_tts = {}
TAKE = int(os.environ.get("TAKE", "3"))   # jumlah ambilan per kalimat; dipilih yang paling jelas menurut ASR
ASR = os.environ.get("ASR")                # folder Whisper (sherpa-onnx); tanpa ini ambilan pertama dipakai
_asr = None


def dengar(x, sr):
    global _asr
    if _asr is None:
        _asr = sherpa_onnx.OfflineRecognizer.from_whisper(
            encoder=f"{ASR}/turbo-encoder.int8.onnx", decoder=f"{ASR}/turbo-decoder.int8.onnx",
            tokens=f"{ASR}/turbo-tokens.txt", language="id", task="transcribe", num_threads=4)
    pad = np.zeros(int(0.2 * sr), np.float32)
    s = _asr.create_stream(); s.accept_waveform(sr, np.concatenate([pad, x, pad])); _asr.decode_stream(s)
    return s.result.text


def kemiripan(a, b):
    import difflib
    n = lambda s: re.sub(r"[^a-z0-9 ]", " ", s.lower().replace("-", " ")).split()
    return difflib.SequenceMatcher(None, n(a), n(b)).ratio()


def mesin(laju):
    if laju not in _tts:
        cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(
            model=f"{MODEL}/id_ID-news_tts-medium.onnx", tokens=f"{MODEL}/tokens.txt", data_dir=f"{MODEL}/espeak-ng-data",
            noise_scale=0.667, noise_scale_w=0.8, length_scale=laju), num_threads=4, provider="cpu"), max_num_sentences=4)
        _tts[laju] = sherpa_onnx.OfflineTts(cfg)
    return _tts[laju]


def energi(x, sr, hop=0.01):
    h = int(sr * hop)
    n = len(x) // h
    return np.sqrt(np.mean(x[: n * h].reshape(n, h) ** 2, axis=1) + 1e-12)


def pangkas(x, sr):
    """Buang senyap di ujung, sisakan 60 ms di depan dan 120 ms di belakang (konsonan akhir lirih)."""
    e = energi(x, sr)
    ada = np.where(e > 0.005)[0]
    if not len(ada):
        return x
    h = int(sr * 0.01)
    a = max(0, ada[0] * h - int(0.06 * sr)); b = min(len(x), (ada[-1] + 1) * h + int(0.12 * sr))
    return x[a:b]


def celah(x, sr):
    """Jeda di dalam kalimat: (tengah, lama) dalam detik, ≥ 90 ms senyap."""
    e = energi(x, sr); sepi = e < 0.008
    out, i = [], 0
    while i < len(sepi):
        if sepi[i]:
            j = i
            while j < len(sepi) and sepi[j]:
                j += 1
            if j - i >= 9 and i > 5 and j < len(sepi) - 5:
                out.append(((i + j) / 2 * 0.01, (j - i) * 0.01))
            i = j
        else:
            i += 1
    return out


def keping(teks):
    """Pecah takarir panjang di tanda baca (koma, titik dua, tanda tanya) menjadi keping ≤ MAKS_TAKARIR."""
    if len(teks) <= MAKS_TAKARIR:
        return [teks]
    bagian = re.split(r"(?<=[,:?…])\s+", teks)
    out = []
    for b in bagian:
        if out and len(out[-1]) + 1 + len(b) <= MAKS_TAKARIR:
            out[-1] += " " + b
        else:
            out.append(b)
    hasil = []
    for k in out:   # keping yang masih terlalu panjang dipotong di spasi terdekat dari tengah
        while len(k) > MAKS_TAKARIR + 12:
            m = len(k) // 2; c = min((abs(i - m), i) for i, ch in enumerate(k) if ch == " ")[1]
            hasil.append(k[:c]); k = k[c + 1:]
        hasil.append(k)
    return hasil


def main():
    pilih = set(sys.argv[1:])
    waktu = json.load(open(f"{OUT}/waktu.json")) if os.path.exists(f"{OUT}/waktu.json") else {}
    for no, bag, ks in ADEGAN:
        if not ks or (pilih and no not in pilih):
            continue
        sr = 22050
        potong, kal, t = [np.zeros(int(AWAL * sr), np.float32)], [], AWAL
        for takarir, ucap, jeda, laju in ks:
            terbaik = None
            for _ in range(TAKE if ASR else 1):
                a = mesin(round(laju * LAJU, 3)).generate(ucap or takarir, sid=0, speed=1.0)
                sr = a.sample_rate
                x = pangkas(np.array(a.samples, np.float32), sr)
                nilai = kemiripan(takarir, dengar(x, sr)) if ASR else 1.0
                if terbaik is None or nilai > terbaik[0]:
                    terbaik = (nilai, x)
                if nilai >= 0.97:
                    break
            nilai, x = terbaik
            if nilai < 0.85:
                print(f"   ! {nilai:.2f} {takarir}", flush=True)
            d = len(x) / sr
            # titik potong takarir: keping ke-i berakhir di jeda nyata terdekat dari perkiraan panjang huruf
            kp = keping(takarir)
            batas, cs = [], [cl for cl, lm in celah(x, sr)]
            tot = sum(len(k) for k in kp); acc = 0
            for k in kp[:-1]:
                acc += len(k); kira = d * acc / tot
                dekat = min(cs, key=lambda c: abs(c - kira)) if cs else kira
                batas.append(round(dekat if abs(dekat - kira) < 0.9 else kira, 3))
            kal.append({"takarir": takarir, "keping": kp, "batas": batas, "awal": round(t, 3), "akhir": round(t + d, 3)})
            jeda *= JEDA
            potong += [x, np.zeros(int(jeda * sr), np.float32)]
            t += d + jeda
        mentah = f"{OUT}/_{no}.wav"
        sf.write(mentah, np.concatenate(potong), sr)
        # rapikan: buang dengung rendah, hangatkan sedikit, redam desis, padatkan, samakan keras
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mentah, "-af",
                        "aresample=48000:resampler=soxr,highpass=f=75,equalizer=f=220:t=q:w=1.0:g=2,"
                        "equalizer=f=3200:t=q:w=1.2:g=1.5,deesser=i=0.35,"
                        "acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=2,"
                        "aecho=0.9:0.5:28|46:0.10|0.06,loudnorm=I=-16:TP=-1.5:LRA=8",
                        "-ar", "48000", "-ac", "1", f"{OUT}/{no}.wav"], check=True)
        os.remove(mentah)
        waktu[no] = {"bagian": bag, "panjang": round(t, 3), "kalimat": kal}
        print(f"{no:9s} {t:6.1f} dtk  {len(kal)} kalimat", flush=True)
    json.dump(waktu, open(f"{OUT}/waktu.json", "w"), ensure_ascii=False, indent=1)
    print("total narasi", round(sum(w["panjang"] for w in waktu.values()), 1), "dtk")


if __name__ == "__main__":
    main()
