"""Sol menu referans crop — tam cerceve + kapsul parcalari."""
from PIL import Image
import os

SRC = r'C:\Users\AMD\.cursor\projects\c-Users-AMD-Desktop-yeralti-imparatorlugu\assets\c__Users_AMD_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-656c15dc-76c4-4c9f-b87b-1af658940d8b.png'
OUT = r'c:\Users\AMD\Desktop\yeralti-imparatorlugu\public\images\ui'
os.makedirs(OUT, exist_ok=True)

img = Image.open(SRC).convert('RGBA')
W, H = img.size


def save(name, box):
    c = img.crop(box)
    c.save(os.path.join(OUT, name + '.png'))
    print(name, c.size)
    return c


# Dis cerceve (sidebar crop)
save('sm-tl', (0, 0, 46, 46))
save('sm-tr', (W - 46, 0, W, 46))
save('sm-bl', (0, H - 58, 46, H))
save('sm-br', (W - 46, H - 58, W, H))
save('sm-top', (40, 0, W - 40, 34))
save('sm-bot', (8, H - 20, W - 40, H))
save('sm-edge-l', (0, 42, 12, H - 56))
save('sm-edge-r', (W - 14, 42, W, H - 56))

# Baslik plaketi
save('sm-plaque', (0, 0, W, 28))

# Kapsul satir — Büyüme Adımları (temiz satir y~144)
ROW_Y = 144
ROW_H = 26
save('sm-cap-l', (0, ROW_Y, 34, ROW_Y + ROW_H))
save('sm-cap-m', (34, ROW_Y, 168, ROW_Y + ROW_H))
save('sm-cap-r', (168, ROW_Y, W, ROW_Y + ROW_H))

# Tam cerceve (sadece kenar halkasi)
full = save('_row', (0, ROW_Y, W, ROW_Y + ROW_H))
ring = full.copy()
px = ring.load()
rw, rh = ring.size
for y in range(rh):
    for x in range(rw):
        if 34 <= x < rw - 38 and 4 <= y < rh - 4:
            px[x, y] = (0, 0, 0, 0)
ring.save(os.path.join(OUT, 'sm-btn-ring.png'))
print('sm-btn-ring', ring.size)

print('done')
