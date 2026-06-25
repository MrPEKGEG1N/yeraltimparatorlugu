"""Hedef liderlik referansı (54e0c1f7) — asset çıkarımı."""
from PIL import Image
import os

SRC = r'C:\Users\AMD\.cursor\projects\c-Users-AMD-Desktop-yeralti-imparatorlugu\assets\c__Users_AMD_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-54e0c1f7-1ce8-47ac-8bd0-359cf0702af8.png'
OUT = r'c:\Users\AMD\Desktop\yeralti-imparatorlugu\public\images\ui'
os.makedirs(OUT, exist_ok=True)
img = Image.open(SRC).convert('RGBA')

HDR_Y = (108, 132)
ROW_Y = (205, 237)
WING = 58

ORNS = [
    ('name', 308, 548),
    ('grup', 558, 798),
    ('puan', 808, 990),
]


def fill_rect(c, x1, y1, x2, y2, rgba):
    px = c.load()
    w, h = c.size
    for y in range(max(0, y1), min(h, y2)):
        for x in range(max(0, x1), min(w, x2)):
            px[x, y] = rgba


def clean_orn(tip, x1, x2):
    cell = img.crop((x1, ROW_Y[0], x2, ROW_Y[1])).copy()
    w, h = cell.size
    fill_rect(cell, WING + 4, 4, w - WING - 4, h - 4, (18, 12, 10, 215))
    return cell


def save_orn(tip, cell):
    w, h = cell.size
    cell.save(os.path.join(OUT, f'lt-ref-{tip}-tpl.png'))
    cell.crop((0, 0, WING, h)).save(os.path.join(OUT, f'lt-ref-{tip}-l.png'))
    cell.crop((w - WING, 0, w, h)).save(os.path.join(OUT, f'lt-ref-{tip}-r.png'))
    cell.crop((WING, 0, WING + 32, h)).save(os.path.join(OUT, f'lt-ref-{tip}-body.png'))
    print(tip, cell.size)


img.crop((218, HDR_Y[0], 1000, HDR_Y[1])).save(os.path.join(OUT, 'lt-ref-hdr-bar.png'))
print('hdr', (782, HDR_Y[1] - HDR_Y[0]))

for tip, x1, x2 in ORNS:
    save_orn(tip, clean_orn(tip, x1, x2))

for x1, x2, prefix in [(668, 808, 'lt-ref-tab-off'), (818, 988, 'lt-ref-tab-on')]:
    t = img.crop((x1, 52, x2, 82))
    tw = 48
    t.crop((0, 0, tw, t.size[1])).save(os.path.join(OUT, prefix + '-l.png'))
    t.crop((tw, 0, tw + 24, t.size[1])).save(os.path.join(OUT, prefix + '-body.png'))
    t.crop((t.size[0] - tw, 0, t.size[0], t.size[1])).save(os.path.join(OUT, prefix + '-r.png'))

print('ref extract ok')
