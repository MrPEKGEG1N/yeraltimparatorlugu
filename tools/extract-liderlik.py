"""Liderlik — referans satır şablonları + köşe süsleri (bdfd238a)."""
from PIL import Image
import os

SRC = r'C:\Users\AMD\.cursor\projects\c-Users-AMD-Desktop-yeralti-imparatorlugu\assets\c__Users_AMD_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-bdfd238a-e85a-4b2c-ace7-d864296fd59a.png'
OUT = r'c:\Users\AMD\Desktop\yeralti-imparatorlugu\public\images\ui'
os.makedirs(OUT, exist_ok=True)
img = Image.open(SRC).convert('RGBA')

X0, X1 = 218, 1000
ROW_N_Y = (105, 137)
ROW_L_Y = (84, 116)
HDR_Y = (62, 84)

COLS = [
    ('rank', 218, 276, 14),
    ('name', 296, 512, 32),
    ('grup', 532, 750, 32),
    ('puan', 770, 980, 24),
]


def clear_rect(c, x1, y1, x2, y2):
    px = c.load()
    w, h = c.size
    for y in range(max(0, y1), min(h, y2)):
        for x in range(max(0, x1), min(w, x2)):
            px[x, y] = (0, 0, 0, 0)


def fill_rect(c, x1, y1, x2, y2, rgba):
    px = c.load()
    w, h = c.size
    for y in range(max(0, y1), min(h, y2)):
        for x in range(max(0, x1), min(w, x2)):
            px[x, y] = rgba


def save_row_skin(name, y1, y2, inner=(14, 9, 7, 255)):
    row = img.crop((X0, y1, X1, y2)).copy()
    h = y2 - y1
    for _, x1, x2, _wing in COLS:
        lx = x1 - X0
        cw = x2 - x1
        fill_rect(row, lx + 5, 2, lx + cw - 5, h - 2, inner)
    row.save(os.path.join(OUT, name + '.png'))
    print(name, row.size)


def save_hdr():
    img.crop((X0, HDR_Y[0], X1, HDR_Y[1])).save(os.path.join(OUT, 'lt-skin-hdr.png'))
    print('lt-skin-hdr', (X1 - X0, HDR_Y[1] - HDR_Y[0]))


def save_corners():
    y1, y2 = ROW_N_Y
    h = y2 - y1
    for tip, x1, x2, wing in COLS:
        cell = img.crop((x1, y1, x2, y2))
        cell.crop((0, 0, wing, h)).save(os.path.join(OUT, f'lt2-{tip}-l.png'))
        cell.crop((x2 - x1 - wing, 0, x2 - x1, h)).save(os.path.join(OUT, f'lt2-{tip}-r.png'))
        cx = (x2 - x1) // 2
        cell.crop((max(wing, cx - 12), 0, min(x2 - x1 - wing, cx + 12), h)).save(
            os.path.join(OUT, f'lt2-{tip}-body.png'))
    print('corners ok')


for x1, x2, prefix in [(668, 808, 'lt2-tab-off'), (818, 988, 'lt2-tab-on')]:
    t = img.crop((x1, 78, x2, 108))
    tw = 40
    t.crop((0, 0, tw, t.size[1])).save(os.path.join(OUT, prefix + '-l.png'))
    t.crop((tw, 0, tw + 20, t.size[1])).save(os.path.join(OUT, prefix + '-body.png'))
    t.crop((t.size[0] - tw, 0, t.size[0], t.size[1])).save(os.path.join(OUT, prefix + '-r.png'))

save_hdr()
save_row_skin('lt-skin-row', *ROW_N_Y)
save_row_skin('lt-skin-row-leader', *ROW_L_Y, inner=(42, 12, 12, 255))
save_corners()
print('lt extract ok', img.size)
