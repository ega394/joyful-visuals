"""Musik latar sintetis (akor C–Am–F–G, 8 detik per akor), sangat pelan, bebas hak cipta.

python3 musik.py <detik>  -> musik.wav
"""
import subprocess, sys
dur = float(sys.argv[1]) if len(sys.argv) > 1 else 280
k = "floor(mod(t,32)/8)"
pilih = lambda a, b, c, d: f"if(eq({k},0),{a},if(eq({k},1),{b},if(eq({k},2),{c},{d})))"
f1, f2, f3 = pilih(261.63, 220.00, 174.61, 196.00), pilih(329.63, 261.63, 220.00, 246.94), pilih(392.00, 329.63, 261.63, 293.66)
env = "pow(sin(PI*mod(t,8)/8),2)"
sig = (f"{env}*(0.45*sin(2*PI*{f1}*t)+0.35*sin(2*PI*{f2}*t)+0.30*sin(2*PI*{f3}*t)"
       f"+0.40*sin(PI*{f1}*t)+0.08*sin(4*PI*{f1}*t))*0.25")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"aevalsrc=exprs='{sig}|{sig}':s=48000:d={dur}",
                "-af", f"lowpass=f=1600,aecho=0.8:0.6:70|140:0.25|0.15,loudnorm=I=-33:TP=-6:LRA=7,"
                       f"afade=t=in:st=0:d=3,afade=t=out:st={dur - 4}:d=4",
                "-ar", "48000", "musik.wav"], check=True)
print("musik.wav", dur)
