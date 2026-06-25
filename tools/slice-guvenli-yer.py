"""Rehber ızgarasından 15 seviye — keskin, abartısız ölçek (512px genişlik)."""
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(
    r"C:\Users\AMD\.cursor\projects\c-Users-AMD-Desktop-yeralti-imparatorlugu\assets"
    r"\c__Users_AMD_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images"
    r"_Gemini_Generated_Image_jknqtnjknqtnjknq-3f537371-247c-4007-a46c-7ec1096e00a4.png"
)
OUT = ROOT / "public" / "images" / "guvenli-yer" / "levels"

# Oyun alanı boyutu — kaynak hücreden ~2.9x (1000px'e zorlamadan)
TARGET_W = 512
GRID = dict(left=8, top=72, right=1016, bottom=548)
COLS, ROWS = 5, 3
INNER = dict(top=0.12, bottom=0.84, left=0.05, right=0.95)


def keskinlestir(img):
    img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=140, threshold=2))
    img = ImageEnhance.Contrast(img).enhance(1.06)
    img = ImageEnhance.Sharpness(img).enhance(1.15)
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    im = Image.open(SRC).convert("RGB")
    gw = GRID["right"] - GRID["left"]
    gh = GRID["bottom"] - GRID["top"]
    cw, ch = gw / COLS, gh / ROWS

    n = 1
    for row in range(ROWS):
        for col in range(COLS):
            cx0 = GRID["left"] + col * cw
            cy0 = GRID["top"] + row * ch
            x0 = int(cx0 + cw * INNER["left"])
            y0 = int(cy0 + ch * INNER["top"])
            x1 = int(cx0 + cw * INNER["right"])
            y1 = int(cy0 + ch * INNER["bottom"])
            cell = im.crop((x0, y0, x1, y1))
            ratio = cell.height / cell.width
            target_h = int(TARGET_W * ratio)
            cell = cell.resize((TARGET_W, target_h), Image.Resampling.LANCZOS)
            cell = keskinlestir(cell)
            dest = OUT / f"seviye-{n:02d}.png"
            cell.save(dest, format="PNG", compress_level=3)
            print(dest.name, cell.size)
            n += 1


if __name__ == "__main__":
    main()
