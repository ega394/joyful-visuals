"""Siapkan folder kerja video Tarakan: linimasa (dari narasi), aset, ikon, peta, dan bingkai rekaman.

KERJA=<folder kerja> python3 siapkan.py [--tanpa-bingkai]

Sumber (bisa diubah lewat variabel lingkungan):
  REK    rekaman layar aplikasi berdata contoh (a06_admin.mp4 ...), dari video Kaltara
  NYATA  rekaman nyata (IMG_1345-1347, IMG_1727-1731, pernyataan-walikota.mp4) — tidak masuk repo
  ASET   logo, huruf, foto lembar asli (lembar-*.jpg tidak masuk repo)
  NPM    folder node_modules berisi lucide-static dan @svg-maps/indonesia
Tangkapan layar diambil dari docs/lomba/tarakan/tangkapan (data contoh).
"""
import json, os, re, shutil, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__))
KERJA = os.environ.get("KERJA", D)
REK = os.environ.get("REK", os.path.join(KERJA, "..", "video", "rek"))
NYATA = os.environ.get("NYATA", os.path.join(KERJA, "..", "video", "nyata"))
ASET = os.environ.get("ASET", os.path.join(KERJA, "..", "video", "aset"))
NPM = os.environ.get("NPM", os.path.join(KERJA, "npm", "node_modules"))
TANGKAPAN = os.path.join(D, "..", "..", "tarakan", "tangkapan")
FPS = 25

sys.path.insert(0, D)
from naskah import ADEGAN, BAGIAN

# Urutan tayang. lead = jeda sebelum narasi, tail = sesudahnya; lama = adegan tanpa narasi.
SUSUNAN = [
    ("pembuka", {"lead": 0.6, "tail": 0.7}),
    ("judul", {"lama": 3.2, "bagian": "latar"}),
    ("dulu", {"lead": 0.3, "tail": 0.3}),
    ("akar", {"lead": 0.2, "tail": 0.5}),
    ("lahir", {"lead": 0.3, "tail": 0.4}),
    ("alur", {"lead": 0.2, "tail": 0.4}),
    ("layanan", {"lead": 0.0, "tail": 0.3}),
    ("jejak", {"lead": 0.0, "tail": 0.4}),
    ("bangun", {"lead": 0.2, "tail": 0.4}),
    ("dampak", {"lead": 0.6, "tail": 0.8}),
    ("walikota", {"lead": 0.4, "tail": 0.6}),
    ("lanjut", {"lead": 0.4, "tail": 0.4}),
    ("tutup", {"lead": 0.3, "tail": 2.8}),
]

# Pernyataan Wali Kota (video 19 Oktober 2026): potongan di jeda antarkalimat, disambung silang 0,3 dtk.
SILANG_WK = 0.3
PERNYATAAN = [(1.0, 5.25, "wajah"), (6.0, 8.7, "wajah"), (44.6, 51.3, "hp"), (62.1, 66.2, "wajah")]
UCAPAN = [(1.2, 5.1, "Yang penting bagi saya adalah kepastian:"),
          (6.2, 8.6, "kegiatan apa yang harus saya hadiri."),
          (45.1, 49.2, "dan bisa mendisposisi kalau memang saya tidak bisa hadir"),
          (49.3, 51.2, "ke pejabat yang lain."),
          (62.3, 66.15, "Luar biasa, saya kira, inovasi yang dikerjakan ini.")]

# Bingkai rekaman: (id, berkas, mulai, akhir, lebar keluaran atau None)
REKAMAN_NYATA = [
    ("n1345", "IMG_1345.MOV", 0.3, 10.5, 1920), ("n1346", "IMG_1346.MOV", 0.2, 5.3, 1920),
    ("n1347", "IMG_1347.MOV", 0.0, 5.0, 1920), ("n1727", "IMG_1727.MOV", 0.0, 6.35, 1920),
    ("n1728", "IMG_1728.MOV", 0.0, 7.5, 1920), ("n1729", "IMG_1729.MOV", 0.0, 4.1, 1920),
    ("n1730", "IMG_1730.MOV", 0.0, 5.5, 1920), ("n1731", "IMG_1731.MOV", 0.0, 3.3, 1920),
]
REKAMAN_APP = ["a06_admin", "a07_kasubbag", "a08_kabag", "a09_walikota", "a09b_ajudan", "a10_penugasan",
               "a10b_hadir", "a11a_tamu", "a11b_ruangan"]
GAMBAR = ["kabag_kalender_bersama.jpg", "undangan_imbaya.jpg", "hp_walikota.jpg", "hp_staf.jpg", "hp_ajudan.jpg",
          "kabag_riwayat.jpg", "kabag_plh.jpg", "kabag_antrian.jpg", "kasubbag_jadwal.jpg", "hp_ruangan.jpg", "hp_tamu.jpg"]
IKON = ["file-text", "sheet", "messages-square", "presentation", "phone", "printer", "clock", "camera", "user",
        "users", "circle-help", "calendar", "calendar-check", "mail", "circle-check", "shield-check", "timer",
        "bell", "qr-code", "signature", "building-2", "map-pin", "coins", "refresh-cw", "history", "sparkles",
        "smartphone", "laptop", "landmark", "scroll-text", "badge-check", "trophy", "inbox",
        "send", "route", "layers", "zap", "moon", "user-check", "user-x", "repeat", "wallet", "globe",
        "message-circle", "door-open", "database", "check", "x", "arrow-right", "footprints", "brain",
        "clipboard-check", "file-check", "hourglass", "phone-call", "pen-line", "stamp", "award", "star"]


def jalankan(*a):
    subprocess.run(a, check=True)


def lama_berkas(f):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).decode())


def linimasa():
    waktu = json.load(open(os.path.join(KERJA, "narasi", "waktu.json")))
    teks = {no: ks for no, _, ks in ADEGAN}
    bag_adegan = {no: bag for no, bag, _ in ADEGAN}
    out, t = [], 0.0
    for no, o in SUSUNAN:
        a = {"id": no, "mulai": round(t, 3), "lead": o.get("lead", 0.0)}
        bag = o.get("bagian") or bag_adegan.get(no, "latar")
        a["bagian"] = BAGIAN[bag]
        if no in waktu:
            w = waktu[no]
            a["lama"] = round(o["lead"] + w["panjang"] + o["tail"], 3)
            a["narasi"] = round(t + o["lead"], 3)
            a["kalimat"] = [{**k, "awal": round(k["awal"] + o["lead"], 3), "akhir": round(k["akhir"] + o["lead"], 3),
                             "ucap": (n[1] or n[0])} for k, n in zip(w["kalimat"], teks[no])]
        elif no == "walikota":
            klip, u, s = [], [], o["lead"]
            for i, (x0, x1, jenis) in enumerate(PERNYATAAN):
                klip.append({"awal": round(s, 3), "akhir": round(s + x1 - x0, 3), "sumber": [x0, x1], "jenis": jenis})
                for u0, u1, tk in UCAPAN:
                    if x0 <= u0 < x1:
                        u.append({"awal": round(s + u0 - x0, 3), "akhir": round(s + min(u1, x1) - x0, 3), "takarir": tk})
                s += (x1 - x0) - SILANG_WK
            s += SILANG_WK
            a.update({"lama": round(s + o["tail"], 3), "klip": klip, "ucapan": u, "silang": SILANG_WK})
        else:
            a["lama"] = o["lama"]
        out.append(a)
        t += a["lama"]
    return {"fps": FPS, "total": round(t, 3), "adegan": out}


def ikon():
    hasil = {}
    for n in IKON:
        p = os.path.join(NPM, "lucide-static", "icons", n + ".svg")
        if not os.path.exists(p):
            print("ikon tidak ada:", n); continue
        s = open(p).read()
        s = re.sub(r"<!--.*?-->", "", s, flags=re.S).strip()
        hasil[n] = re.sub(r'class="[^"]*"', "", s)
    return hasil


def peta():
    js = open(os.path.join(NPM, "@svg-maps", "indonesia", "index.js")).read()
    d = json.loads(js[js.index("{"): js.rindex("}") + 1])
    return {"viewBox": d["viewBox"], "lokasi": [{"id": x["id"], "nama": x["name"], "d": x["path"]} for x in d["locations"]]}


def bingkai(id_, src, a, b, lebar, tinggi=None):
    out = os.path.join(KERJA, "bingkai", id_)
    if os.path.isdir(out) and len(os.listdir(out)) >= int((b - a) * FPS) - 2:
        return
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    vf = f"fps={FPS}"
    if lebar:
        vf += f",scale={lebar}:{tinggi or -2}:flags=lanczos"
    if id_.startswith("wk"):
        vf += ",unsharp=5:5:0.6"
    jalankan("ffmpeg", "-loglevel", "error", "-ss", str(a), "-i", src, "-t", str(b - a), "-vf", vf, "-q:v", "3",
             os.path.join(out, "%05d.jpg"))


def main():
    os.makedirs(os.path.join(KERJA, "aset"), exist_ok=True)
    for f in ["hibot.png", "tarakan.png", "PlusJakartaSans-Variable.woff2", "lembar-sampai.jpg", "lembar-tertinggal.jpg"]:
        shutil.copy(os.path.join(ASET, f), os.path.join(KERJA, "aset", f))
    for f in GAMBAR:
        shutil.copy(os.path.join(TANGKAPAN, f), os.path.join(KERJA, "aset", f))
    if "--tanpa-bingkai" not in sys.argv:
        for id_, f, a, b, w in REKAMAN_NYATA:
            bingkai(id_, os.path.join(NYATA, f), a, b, w)
        for i, (x0, x1, jenis) in enumerate(PERNYATAAN):
            bingkai(f"wk{i + 1}", os.path.join(NYATA, "pernyataan-walikota.mp4"), x0, x1, 1280, 714)
        for r in REKAMAN_APP:
            src = os.path.join(REK, r + ".mp4")
            bingkai(r, src, 0, lama_berkas(src), None)
    B = os.path.join(KERJA, "bingkai")
    jumlah = {d: len(os.listdir(os.path.join(B, d))) for d in sorted(os.listdir(B))} if os.path.isdir(B) else {}
    L = linimasa()
    data = {"LINI": L, "IKON": ikon(), "PETA": peta(), "JUMLAH": jumlah}
    with open(os.path.join(KERJA, "data.js"), "w") as f:
        for k, v in data.items():
            f.write(f"window.{k} = {json.dumps(v, ensure_ascii=False)};\n")
    json.dump(L, open(os.path.join(KERJA, "linimasa.json"), "w"), ensure_ascii=False, indent=1)
    for f in ("grafis.html", "vertikal.html", "sampul.html"):
        shutil.copy(os.path.join(D, f), os.path.join(KERJA, f))
    print("total", L["total"], "dtk;", len(jumlah), "rekaman")
    for a in L["adegan"]:
        print(f'  {a["id"]:9s} {a["mulai"]:7.2f} +{a["lama"]:6.2f}  {a["bagian"]}')


if __name__ == "__main__":
    main()
