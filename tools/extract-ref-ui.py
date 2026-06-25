"""Gorsel 2 referansindan temiz chrome — sadece bos cerceve parcalari."""
from PIL import Image
import os

SRC = r'C:\Users\AMD\.cursor\projects\c-Users-AMD-Desktop-yeralti-imparatorlugu\assets\c__Users_AMD_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_men___er_eve-2ce4c236-e68c-44be-8049-c5fffaea6fd0.png'
OUT = r'c:\Users\AMD\Desktop\yeralti-imparatorlugu\public\images\ui'
os.makedirs(OUT, exist_ok=True)

img = Image.open(SRC).convert('RGBA')


def save_crop(name, box):
    c = img.crop(box)
    c.save(os.path.join(OUT, name + '.png'))
    print(name, c.size)
    return c


def corner_ring(crop, border=18):
    c = crop.copy()
    px = c.load()
    w, h = c.size
    for y in range(h):
        for x in range(w):
            if x >= border and y >= border:
                px[x, y] = (0, 0, 0, 0)
    return c


def edge_strip(crop, axis='h', keep=14):
    c = crop.copy()
    px = c.load()
    w, h = c.size
    for y in range(h):
        for x in range(w):
            if axis == 'h' and y >= keep:
                px[x, y] = (0, 0, 0, 0)
            if axis == 'v' and x >= keep:
                px[x, y] = (0, 0, 0, 0)
    return c


# Panel koseler — sadece filigran kose (46x46)
for name, box in {
    'panel-tl': (202, 76, 248, 122),
    'panel-tr': (974, 76, 1020, 122),
    'panel-bl': (202, 459, 248, 505),
    'panel-br': (974, 459, 1020, 505),
}.items():
    corner_ring(save_crop('_tmp', box), 16).save(os.path.join(OUT, name + '.png'))

# Panel kenarlar — menu-top (temiz) + sag kenar seridi
edge_strip(save_crop('_mt', (66, 36, 172, 72)), 'h', 14).save(os.path.join(OUT, 'panel-edge-t.png'))
edge_strip(save_crop('_mb', (12, 488, 200, 505)), 'h', 12).save(os.path.join(OUT, 'panel-edge-b.png'))
edge_strip(save_crop('_pr', (1008, 170, 1020, 430)), 'v', 10).save(os.path.join(OUT, 'panel-edge-r.png'))
edge_strip(save_crop('_pl', (1008, 170, 1020, 430)), 'v', 10).transpose(Image.FLIP_LEFT_RIGHT).save(
    os.path.join(OUT, 'panel-edge-l.png'))

# Menu koseler — ust filigran bolgesi
for name, box in {
    'menu-tl': (0, 36, 46, 82),
    'menu-tr': (168, 36, 214, 82),
    'menu-bl': (0, 459, 46, 505),
    'menu-br': (168, 459, 214, 505),
}.items():
    corner_ring(save_crop('_m', box), 14).save(os.path.join(OUT, name + '.png'))

edge_strip(save_crop('_mt2', (66, 36, 172, 72)), 'h', 14).save(os.path.join(OUT, 'menu-top.png'))
edge_strip(save_crop('_mr', (204, 80, 214, 440)), 'v', 10).save(os.path.join(OUT, 'menu-edge-r.png'))
edge_strip(save_crop('_ml', (0, 80, 10, 440)), 'v', 8).save(os.path.join(OUT, 'menu-edge-l.png'))
edge_strip(save_crop('_mb2', (12, 488, 200, 505)), 'h', 12).save(os.path.join(OUT, 'menu-edge-b.png'))

# Plaque kanatlari
save_crop('plaque-wing-l', (316, 30, 398, 84))
save_crop('plaque-wing-r', (626, 30, 708, 84))

# Kapsul kanat + celenk
save_crop('cap-wing-l', (256, 138, 292, 182))
save_crop('cap-wing-r', (462, 138, 498, 182))
save_crop('wreath-l', (244, 142, 260, 178))
save_crop('wreath-r', (500, 142, 516, 178))

print('done')
