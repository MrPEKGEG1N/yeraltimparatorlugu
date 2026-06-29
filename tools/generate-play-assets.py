# Play Store grafikleri (feature graphic 1024x500)
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Pillow gerekli: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "images" / "mafya" / "savas-banner.png"
OUT_DIR = ROOT / "android" / "release" / "play-store-assets"
OUT = OUT_DIR / "feature-graphic-1024x500.png"

if not SRC.exists():
  raise SystemExit(f"Kaynak bulunamadi: {SRC}")

img = Image.open(SRC).convert("RGB")
w, h = img.size
target_w, target_h = 1024, 500
scale = max(target_w / w, target_h / h)
nw, nh = int(w * scale), int(h * scale)
resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
left = (nw - target_w) // 2
top = (nh - target_h) // 2
crop = resized.crop((left, top, left + target_w, top + target_h))

OUT_DIR.mkdir(parents=True, exist_ok=True)
crop.save(OUT, format="PNG", optimize=True)
print(f"OK: {OUT}")
