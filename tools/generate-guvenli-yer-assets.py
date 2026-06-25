"""
Güvenli Yer — 15 seviye için keskin vektör sahneler (1000×600 SVG).
Çalıştır: python tools/generate-guvenli-yer-assets.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "images" / "guvenli-yer" / "levels"
W, H = 1000, 600

# İzometrik parsel köşeleri
PLOT = [(500, 175), (760, 310), (500, 455), (240, 310)]


def pts(coords):
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in coords)


def svg_header():
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a1220"/>
      <stop offset="55%" stop-color="#142238"/>
      <stop offset="100%" stop-color="#1a2e1a"/>
    </linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0d2840"/>
      <stop offset="100%" stop-color="#123550"/>
    </linearGradient>
    <linearGradient id="dirt" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4a3d2a"/>
      <stop offset="100%" stop-color="#2e2418"/>
    </linearGradient>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2d4a28"/>
      <stop offset="100%" stop-color="#1a3018"/>
    </linearGradient>
    <linearGradient id="stone" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6a6a72"/>
      <stop offset="100%" stop-color="#3a3a42"/>
    </linearGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6b4a2a"/>
      <stop offset="100%" stop-color="#3d2814"/>
    </linearGradient>
    <linearGradient id="roof" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2a2a32"/>
      <stop offset="100%" stop-color="#121218"/>
    </linearGradient>
    <linearGradient id="energy" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4fc3ff" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#1a8fd4" stop-opacity="0.35"/>
    </linearGradient>
    <linearGradient id="underground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#0088aa" stop-opacity="0.08"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="softglow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
'''


def layer_sky():
    return f'''
  <rect width="{W}" height="{H}" fill="url(#sky)"/>
  <ellipse cx="820" cy="95" rx="55" ry="55" fill="#e8e4d0" opacity="0.92"/>
  <ellipse cx="820" cy="95" rx="48" ry="48" fill="#f4f0dc" opacity="0.5"/>
'''


def layer_forest():
    trees = []
    for i, (x, y, s) in enumerate(
        [
            (60, 420, 1.0),
            (120, 480, 0.8),
            (30, 500, 0.7),
            (900, 430, 1.1),
            (960, 490, 0.85),
            (850, 510, 0.75),
            (180, 130, 0.6),
            (820, 120, 0.65),
        ]
    ):
        trees.append(
            f'<g transform="translate({x},{y}) scale({s})" opacity="0.9">'
            f'<polygon points="0,-38 22,8 -22,8" fill="#0d1a10"/>'
            f'<polygon points="0,-28 16,4 -16,4" fill="#142818"/>'
            f'<rect x="-5" y="8" width="10" height="18" fill="#1a1208"/>'
            f"</g>"
        )
    return (
        f'<polygon points="0,340 200,260 400,300 0,520" fill="#0a1810" opacity="0.85"/>'
        f'<polygon points="{W},350 800,270 600,310 {W},530" fill="#0a1810" opacity="0.85"/>'
        + "".join(trees)
        + f'<polygon points="0,520 {W},530 {W},{H} 0,{H}" fill="#081208"/>'
    )


def layer_water():
    return f'''
  <polygon points="0,155 260,95 520,120 780,88 {W},130 {W},210 0,240" fill="url(#water)" opacity="0.75"/>
  <path d="M0,175 Q120,165 240,178 T480,172 T720,180 T1000,168" fill="none" stroke="#2a6088" stroke-width="2" opacity="0.35"/>
'''


def layer_road():
    return f'''
  <path d="M-20,520 C180,470 320,430 500,400 C680,370 820,350 1020,320" fill="none" stroke="#3a3428" stroke-width="42" opacity="0.55"/>
  <path d="M-20,520 C180,470 320,430 500,400 C680,370 820,350 1020,320" fill="none" stroke="#524a38" stroke-width="28" opacity="0.45"/>
'''


def layer_plot():
    inner = [(500, 210), (700, 310), (500, 410), (300, 310)]
    return f'''
  <polygon points="{pts(PLOT)}" fill="url(#grass)" stroke="#1a2818" stroke-width="2"/>
  <polygon points="{pts(inner)}" fill="url(#dirt)" opacity="0.55"/>
'''


def layer_wood_fence():
    posts = []
    fence_pts = [
        (280, 298),
        (370, 248),
        (500, 188),
        (630, 248),
        (720, 298),
        (720, 340),
        (630, 390),
        (500, 450),
        (370, 390),
        (280, 340),
        (280, 298),
    ]
    for i in range(len(fence_pts) - 1):
        x1, y1 = fence_pts[i]
        x2, y2 = fence_pts[i + 1]
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        posts.append(
            f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" stroke="#5a3c1e" stroke-width="5"/>'
            f'<line x1="{x1:.0f}" y1="{y1 - 14:.0f}" x2="{x2:.0f}" y2="{y2 - 14:.0f}" stroke="#7a5530" stroke-width="3"/>'
        )
    return (
        f'<polygon points="{pts(fence_pts)}" fill="none" stroke="#4a3018" stroke-width="3" opacity="0.5"/>'
        + "".join(posts)
    )


def layer_mansion():
    return f'''
  <g id="mansion">
    <!-- gölge -->
    <ellipse cx="500" cy="340" rx="95" ry="28" fill="#000" opacity="0.35"/>
    <!-- ana gövde -->
    <polygon points="420,310 500,270 580,310 580,355 420,355" fill="#3a3530"/>
    <polygon points="410,310 500,265 590,310 500,330" fill="#4a4540"/>
    <!-- çatı -->
    <polygon points="400,310 500,235 600,310" fill="url(#roof)"/>
    <polygon points="430,300 500,250 570,300" fill="#2a2a34" opacity="0.6"/>
    <!-- pencereler -->
    <rect x="445" y="318" width="22" height="26" fill="#ffd878" opacity="0.9" filter="url(#softglow)"/>
    <rect x="485" y="318" width="22" height="26" fill="#ffd878" opacity="0.85" filter="url(#softglow)"/>
    <rect x="525" y="318" width="22" height="26" fill="#ffd878" opacity="0.75"/>
    <rect x="465" y="290" width="18" height="16" fill="#ffe8a0" opacity="0.8"/>
    <rect x="505" y="290" width="18" height="16" fill="#ffe8a0" opacity="0.7"/>
    <!-- kapı -->
    <rect x="488" y="335" width="24" height="20" fill="#2a1810" rx="2"/>
    <rect x="492" y="338" width="16" height="17" fill="#4a3020"/>
  </g>
'''


def layer_stone_wall():
  # Outer stone wall around plot
    wall_outer = [
        (255, 305),
        (360, 240),
        (500, 178),
        (640, 240),
        (745, 305),
        (745, 355),
        (640, 420),
        (500, 478),
        (360, 420),
        (255, 355),
        (255, 305),
    ]
    segments = []
    for i in range(len(wall_outer) - 1):
        x1, y1 = wall_outer[i]
        x2, y2 = wall_outer[i + 1]
        segments.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="url(#stone)" stroke-width="14" stroke-linecap="square"/>'
            f'<line x1="{x1}" y1="{y1 - 8}" x2="{x2}" y2="{y2 - 8}" stroke="#8a8a94" stroke-width="4" opacity="0.5"/>'
        )
    gate = f'''
    <g id="gate">
      <rect x="468" y="448" width="64" height="32" fill="url(#stone)" rx="2"/>
      <rect x="476" y="440" width="48" height="24" fill="#5a5a62"/>
      <rect x="488" y="448" width="24" height="22" fill="#1a1410"/>
    </g>
    '''
    return f'<g id="stone-wall">{"".join(segments)}{gate}</g>'


def layer_garden():
    bushes = []
    positions = [(360, 330), (400, 360), (600, 330), (640, 360), (450, 380), (550, 380)]
    for x, y in positions:
        bushes.append(
            f'<ellipse cx="{x}" cy="{y}" rx="22" ry="14" fill="#1e4018"/>'
            f'<ellipse cx="{x}" cy="{y - 8}" rx="16" ry="12" fill="#2a5822"/>'
            f'<ellipse cx="{x + 6}" cy="{y - 4}" rx="10" ry="8" fill="#34682a" opacity="0.8"/>'
        )
    paths = f'''
    <path d="M500,400 L450,370 L420,355" fill="none" stroke="#5a5040" stroke-width="6" opacity="0.5"/>
    <path d="M500,400 L550,370 L580,355" fill="none" stroke="#5a5040" stroke-width="6" opacity="0.5"/>
    '''
    return f'<g id="garden">{paths}{"".join(bushes)}</g>'


def layer_gatehouse():
    return f'''
  <g id="gatehouse">
    <polygon points="455,430 500,405 545,430 545,465 455,465" fill="#4a4038"/>
    <polygon points="448,430 500,398 552,430 500,418" fill="#5a5048"/>
    <rect x="488" y="442" width="24" height="23" fill="#1a1008"/>
    <circle cx="500" cy="418" r="6" fill="#c9a227" filter="url(#softglow)"/>
  </g>
'''


def layer_energy_wall():
    energy_pts = [
        (248, 300),
        (355, 232),
        (500, 170),
        (645, 232),
        (752, 300),
        (752, 360),
        (645, 428),
        (500, 486),
        (355, 428),
        (248, 360),
        (248, 300),
    ]
    return f'''
  <polygon points="{pts(energy_pts)}" fill="none" stroke="url(#energy)" stroke-width="6" filter="url(#glow)" opacity="0.9"/>
  <polygon points="{pts(energy_pts)}" fill="none" stroke="#8ee8ff" stroke-width="2" stroke-dasharray="12 8" opacity="0.65"/>
'''


def layer_watchtowers():
    towers = []
    for x, y in [(300, 268), (700, 268), (270, 350), (730, 350)]:
        towers.append(
            f'<g transform="translate({x},{y})">'
            f'<rect x="-12" y="-5" width="24" height="40" fill="#4a4a52"/>'
            f'<rect x="-16" y="-18" width="32" height="16" fill="#3a3a42"/>'
            f'<rect x="-8" y="2" width="6" height="8" fill="#ffd060" opacity="0.8"/>'
            f'<rect x="2" y="2" width="6" height="8" fill="#ffd060" opacity="0.6"/>'
            f"</g>"
        )
    return f'<g id="towers">{"".join(towers)}</g>'


def layer_underground():
    inner = [(500, 215), (690, 310), (500, 405), (310, 310)]
    return f'''
  <polygon points="{pts(inner)}" fill="url(#underground)" stroke="#00d4ee" stroke-width="2" opacity="0.85" filter="url(#glow)"/>
  <text x="500" y="318" text-anchor="middle" fill="#7ef0ff" font-family="Arial,sans-serif" font-size="13" opacity="0.7" letter-spacing="3">YERALTI</text>
'''


def layer_holograms():
    marks = []
    for x, y in [(500, 290), (420, 340), (580, 340)]:
        marks.append(
            f'<g transform="translate({x},{y})" filter="url(#glow)">'
            f'<polygon points="0,-16 14,8 -14,8" fill="none" stroke="#4af" stroke-width="2"/>'
            f'<circle cx="0" cy="0" r="4" fill="#6cf"/>'
            f"</g>"
        )
    return f'<g id="holograms" opacity="0.9">{"".join(marks)}</g>'


def layer_sniper_tower():
    return f'''
  <g id="sniper-tower" transform="translate(710,248)">
    <rect x="-14" y="0" width="28" height="55" fill="#3a3a44"/>
    <rect x="-20" y="-22" width="40" height="24" fill="#2a2a34"/>
    <rect x="-6" y="12" width="12" height="10" fill="#ffcc55" opacity="0.85" filter="url(#softglow)"/>
    <line x1="20" y1="-10" x2="45" y2="-18" stroke="#555" stroke-width="4"/>
    <circle cx="46" cy="-18" r="5" fill="#444"/>
  </g>
'''


def layer_tunnels():
    return f'''
  <g id="tunnels" opacity="0.75">
    <path d="M350,380 Q400,400 450,385" fill="none" stroke="#00aabb" stroke-width="3" stroke-dasharray="6 4"/>
    <path d="M550,385 Q600,405 650,380" fill="none" stroke="#00aabb" stroke-width="3" stroke-dasharray="6 4"/>
    <circle cx="380" cy="392" r="8" fill="none" stroke="#00ccdd" stroke-width="2"/>
    <circle cx="620" cy="388" r="8" fill="none" stroke="#00ccdd" stroke-width="2"/>
  </g>
'''


def layer_warehouse():
    return f'''
  <g id="warehouse" transform="translate(335,355)">
    <polygon points="0,0 55,-20 110,0 110,40 0,40" fill="#3a3830"/>
    <polygon points="0,0 55,-28 110,0 55,10" fill="#4a4840"/>
    <rect x="40" y="12" width="30" height="28" fill="#2a2820"/>
    <rect x="48" y="20" width="14" height="20" fill="#1a1810"/>
  </g>
'''


def layer_helipad():
    return f'''
  <g id="helipad" transform="translate(300,370)">
    <ellipse cx="0" cy="0" rx="58" ry="32" fill="#3a3a3a" stroke="#666" stroke-width="2"/>
    <ellipse cx="0" cy="0" rx="48" ry="26" fill="#2a2a2a"/>
    <text x="0" y="6" text-anchor="middle" fill="#ccc" font-family="Arial Black,Arial,sans-serif" font-size="28" font-weight="bold">H</text>
    <line x1="-40" y1="0" x2="40" y2="0" stroke="#888" stroke-width="2"/>
    <line x1="0" y1="-22" x2="0" y2="22" stroke="#888" stroke-width="2"/>
  </g>
'''


def layer_bunker():
    return f'''
  <g id="bunker" transform="translate(580,355)">
    <ellipse cx="0" cy="35" rx="70" ry="18" fill="#000" opacity="0.3"/>
    <rect x="-55" y="-10" width="110" height="45" fill="#4a4a50" rx="4"/>
    <rect x="-50" y="-22" width="100" height="18" fill="#3a3a40" rx="3"/>
    <rect x="-20" y="5" width="40" height="30" fill="#2a2828"/>
    <rect x="-12" y="12" width="24" height="23" fill="#1a1818"/>
    <circle cx="35" cy="5" r="5" fill="#ff4444" opacity="0.8" filter="url(#softglow)"/>
  </g>
'''


def layer_bunker_entrance():
    return f'''
  <g id="bunker-entrance" transform="translate(520,420)">
    <ellipse cx="0" cy="18" rx="38" ry="12" fill="#000" opacity="0.4"/>
    <path d="M-35,18 L-35,-5 Q0,-28 35,-5 L35,18 Z" fill="#3a3a40" stroke="#6a6a70" stroke-width="2"/>
    <rect x="-22" y="0" width="44" height="20" fill="#1a1a1e"/>
    <line x1="-22" y1="0" x2="22" y2="0" stroke="#c9a227" stroke-width="3"/>
    <circle cx="0" cy="-8" r="6" fill="#ffaa22" filter="url(#glow)"/>
  </g>
'''


def layer_vignette():
    return f'''
  <rect width="{W}" height="{H}" fill="url(#sky)" opacity="0.08"/>
  <rect x="0" y="0" width="{W}" height="80" fill="#000" opacity="0.25"/>
  <rect x="0" y="{H - 60}" width="{W}" height="60" fill="#000" opacity="0.2"/>
'''


def layer_badge(level):
    return f'''
  <g id="badge">
    <rect x="24" y="24" width="120" height="36" rx="4" fill="#0a0a0c" fill-opacity="0.72" stroke="#b8942a" stroke-width="1.5"/>
    <text x="84" y="48" text-anchor="middle" fill="#e8d48a" font-family="Georgia,serif" font-size="16" font-weight="bold">Seviye {level}</text>
  </g>
'''


# Kümülatif özellikler — her seviye öncekileri içerir
LEVEL_FEATURES = [
    ["sky", "forest", "water", "road", "plot"],
    ["wood_fence", "mansion"],
    ["stone_wall"],
    ["garden"],
    ["gatehouse"],
    ["energy_wall"],
    ["watchtowers"],
    ["underground"],
    ["holograms"],
    ["sniper_tower"],
    ["tunnels"],
    ["warehouse"],
    ["helipad"],
    ["bunker"],
    ["bunker_entrance"],
]

DRAWERS = {
    "sky": layer_sky,
    "forest": layer_forest,
    "water": layer_water,
    "road": layer_road,
    "plot": layer_plot,
    "wood_fence": layer_wood_fence,
    "mansion": layer_mansion,
    "stone_wall": layer_stone_wall,
    "garden": layer_garden,
    "gatehouse": layer_gatehouse,
    "energy_wall": layer_energy_wall,
    "watchtowers": layer_watchtowers,
    "underground": layer_underground,
    "holograms": layer_holograms,
    "sniper_tower": layer_sniper_tower,
    "tunnels": layer_tunnels,
    "warehouse": layer_warehouse,
    "helipad": layer_helipad,
    "bunker": layer_bunker,
    "bunker_entrance": layer_bunker_entrance,
}


def build_level(level):
    active = []
    for i in range(level):
        active.extend(LEVEL_FEATURES[i])
    parts = [svg_header()]
    for key in active:
        parts.append(DRAWERS[key]())
    parts.append(layer_vignette())
    parts.append("</svg>")
    return "\n".join(parts)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for lvl in range(1, 16):
        svg = build_level(lvl)
        dest = OUT / f"seviye-{lvl:02d}.svg"
        dest.write_text(svg, encoding="utf-8")
        print("wrote", dest.name)

    # Eski bulanık PNG'leri kaldır
    for old in OUT.glob("seviye-*.png"):
        old.unlink()
        print("removed", old.name)


if __name__ == "__main__":
    main()
