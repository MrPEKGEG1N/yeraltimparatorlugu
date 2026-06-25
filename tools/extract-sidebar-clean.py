"""Sidebar cerceve — temiz kenarlar, alt/ust kose tam dolgu."""
from PIL import Image
import os

SRC = r'C:\Users\AMD\.cursor\projects\c-Users-AMD-Desktop-yeralti-imparatorlugu\assets\c__Users_AMD_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-656c15dc-76c4-4c9f-b87b-1af658940d8b.png'
OUT = r'c:\Users\AMD\Desktop\yeralti-imparatorlugu\public\images\ui'
os.makedirs(OUT, exist_ok=True)

img = Image.open(SRC).convert('RGBA')
W, H = img.size


def keep_left(crop, cols=5):
    c = crop.copy()
    px = c.load()
    w, h = c.size
    for y in range(h):
        for x in range(w):
            if x >= cols:
                px[x, y] = (0, 0, 0, 0)
    return c


def keep_right(crop, cols=5):
    c = crop.copy()
    px = c.load()
    w, h = c.size
    for y in range(h):
        for x in range(w):
            if x < w - cols:
                px[x, y] = (0, 0, 0, 0)
    return c


# Ust koseler — tam dolgu (maskesiz)
img.crop((0, 0, 46, 46)).save(os.path.join(OUT, 'sm-tl.png'))
img.crop((W - 46, 0, W, 46)).save(os.path.join(OUT, 'sm-tr.png'))

# Alt koseler + alt serit — tam dolgu (eski hali)
img.crop((0, H - 58, 46, H)).save(os.path.join(OUT, 'sm-bl.png'))
img.crop((W - 46, H - 58, W, H)).save(os.path.join(OUT, 'sm-br.png'))
img.crop((8, H - 20, W - 40, H)).save(os.path.join(OUT, 'sm-bot.png'))

# Ust kenar — baslik satirinin ustundeki filigran (metin yok)
img.crop((40, 0, W - 40, 14)).save(os.path.join(OUT, 'sm-top.png'))

plaque = img.crop((0, 0, W, 28)).copy()
px = plaque.load()
for y in range(28):
    for x in range(W):
        if 22 <= x < W - 22 and 4 <= y < 24:
            px[x, y] = (0, 0, 0, 0)
plaque.save(os.path.join(OUT, 'sm-title-ring.png'))
img.crop((8, 4, 22, 24)).save(os.path.join(OUT, 'sm-crown.png'))
img.crop((W - 24, 4, W - 8, 24)).save(os.path.join(OUT, 'sm-wreath.png'))

# Dikey kenar — satir arasi bosluktan ince serit (buton hayaleti yok)
GAP_Y, GAP_H = 122, 48
keep_left(img.crop((0, GAP_Y, 10, GAP_Y + GAP_H)), 5).save(os.path.join(OUT, 'sm-edge-l.png'))
keep_right(img.crop((W - 10, GAP_Y, W, GAP_Y + GAP_H)), 5).save(os.path.join(OUT, 'sm-edge-r.png'))

# Kapsul buton parcalari
ROW_Y, ROW_H = 144, 26
img.crop((0, ROW_Y, 34, ROW_Y + ROW_H)).save(os.path.join(OUT, 'sm-cap-l.png'))
img.crop((34, ROW_Y, 168, ROW_Y + ROW_H)).save(os.path.join(OUT, 'sm-cap-m.png'))
img.crop((168, ROW_Y, W, ROW_Y + ROW_H)).save(os.path.join(OUT, 'sm-cap-r.png'))

print('sidebar frame v2 done', W, H)
