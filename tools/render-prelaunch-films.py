"""Render neutral chapter intros from existing game art. Requires ffmpeg."""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
scenes = {2: "crew-bridge-v3.webp", 3: "launch-bridge-v3.webp"}
for chapter, scene in scenes.items():
    subprocess.run([
        "ffmpeg", "-nostdin", "-v", "error", "-i", str(root / "art" / scene),
        "-vf", "scale=1620:-2,zoompan=z='1+0.06*on/299':"
        "x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=300:s=540x960:fps=30,"
        "fade=t=in:st=0:d=0.35,fade=t=out:st=9.6:d=0.4,format=yuv420p",
        "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-an",
        "-movflags", "+faststart", "-y", str(root / f"life-{chapter}-prelaunch.mp4"),
    ], check=True)
    print(f"Rendered neutral LIFE #{chapter} intro")
