"""Liderlik tablosu — hedef referans görselinden lb-* asset çıkarımı."""
from PIL import Image
import os

SRC = r'C:\Users\AMD\.cursor\projects\c-Users-AMD-Desktop-yeralti-imparatorlugu\assets\c__Users_AMD_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-04c6fcba-bf06-4b0f-ba51-726c49f41718.png'
OUT = r'c:\Users\AMD\Desktop\yeralti-imparatorlugu\public\images\ui'
os.makedirs(OUT, exist_ok=True)
img = Image.open(SRC).convert('RGBA')

HDR_Y = (108, 132)
ROW_Y = (205, 237)

PARTS = [
    ('rank', 218, 298, 16),
    ('orn', 308, 548, 58),
    ('puan', 808, 990, 46),
]


def fill_rect(c, x1, y1, x2, y2, rgba):
    px = c.load()
    w, h = c.size
    for y in range(max(0, y1), min(h, y2)):
        for x in range(max(0, x1), min(w, x2)):
            px[x, y] = rgba


def save_part(name, x1, x2, wing):
    cell = img.crop((x1, ROW_Y[0], x2, ROW_Y[1])).copy()
    w, h = cell.size
    fill_rect(cell, wing + 2, 3, w - wing - 2, h - 3, (16, 10, 8, 228))
    cell.crop((0, 0, wing, h)).save(os.path.join(OUT, f'lb-{name}-l.png'))
    cell.crop((w - wing, 0, w, h)).save(os.path.join(OUT, f'lb-{name}-r.png'))
    mid = max(wing + 8, w // 2 - 16)
    cell.crop((mid, 0, mid + 32, h)).save(os.path.join(OUT, f'lb-{name}-body.png'))
    print(name, w, h, 'wing', wing)


img.crop((218, HDR_Y[0], 1000, HDR_Y[1])).save(os.path.join(OUT, 'lb-hdr.png'))
print('hdr', (782, HDR_Y[1] - HDR_Y[0]))

for name, x1, x2, wing in PARTS:
    save_part(name, x1, x2, wing)

for x1, x2, prefix in [(818, 988, 'lb-tab-on')]:
    t = img.crop((x1, 52, x2, 82))
    tw = 48
    t.crop((0, 0, tw, t.size[1])).save(os.path.join(OUT, prefix + '-l.png'))
    t.crop((tw, 0, tw + 24, t.size[1])).save(os.path.join(OUT, prefix + '-body.png'))
    t.crop((t.size[0] - tw, 0, t.size[0], t.size[1])).save(os.path.join(OUT, prefix + '-r.png'))

print('lb extract ok', img.size)
