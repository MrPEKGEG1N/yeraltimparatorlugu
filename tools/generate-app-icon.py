"""Racon raporu banner'indan kare uygulama ikonu uretir (sol emblem)."""
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Pillow gerekli: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "images" / "racon-raporu.png"
OUT = ROOT / "resources" / "icon.png"

img = Image.open(SRC).convert("RGBA")
w, h = img.size
# Sol dairesel emblem (fedora + silahlar); metin sagda kalir
side = int(h * 0.88)
left = int(w * 0.015)
top = int(h * 0.06)
right = left + side
bottom = top + side
crop = img.crop((left, top, right, bottom))

icon = crop.resize((1024, 1024), Image.Resampling.LANCZOS)
OUT.parent.mkdir(parents=True, exist_ok=True)
icon.save(OUT, format="PNG", optimize=True)
print(f"source: {w}x{h}")
print(f"crop: ({left}, {top}, {right}, {bottom})")
print(f"OK: {OUT} ({icon.size[0]}x{icon.size[1]})")
