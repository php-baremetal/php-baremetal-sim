"""
php-baremetal fork: every logo/icon file of the site, from the project logo.

    python scripts/brand-icons.py <logos/plan/assets/icon-light.svg> [chromium path]

Needs Playwright (pip install playwright) and a Chromium. Writes into public/:

    brand/php-baremetal-logo-light.svg   slate (#475569), for light backgrounds
    brand/php-baremetal-logo-dark.svg    grey  (#94A3B8), for dark backgrounds
    favicon.svg                          square; switches colour with prefers-color-scheme
    favicon-16x16.png favicon-32x32.png favicon-48x48.png favicon.ico
    apple-touch-icon.png (180)  android-chrome-192.png  android-chrome-512.png

The PNG icons sit on a rounded paper tile (#F1F0EA) so the elephant reads on
light and dark tab bars alike; the 512 one keeps it inside the maskable safe
zone. The logo's own drawing spans x 239..792, y 291..742 of its 574x574 box.
"""
import pathlib
import re
import struct
import sys

from playwright.sync_api import sync_playwright

SRC = pathlib.Path(sys.argv[1])
CHROMIUM = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/chromium-browser'
PUBLIC = pathlib.Path(__file__).resolve().parent.parent / 'public'
SLATE, GREY, PAPER = '#475569', '#94A3B8', '#F1F0EA'

src = SRC.read_text()
src = re.sub(r'<\?xml[^>]*\?>\s*', '', src)
assert SLATE in src, f'expected the {SLATE} fill of icon-light.svg'


def with_box(svg: str, box: str) -> str:
    """The same drawing with another viewBox (and no fixed pixel size)."""
    svg = re.sub(r'viewBox="[^"]*"', f'viewBox="{box}"', svg, count=1)
    return re.sub(r'\s(width|height)="[^"]*"', '', svg, count=2)


TIGHT = '234 286 563 462'      # the drawing + a 5-unit margin (wide)
SQUARE = '226 228 579 579'     # the drawing centred in a square

out = PUBLIC / 'brand'
out.mkdir(exist_ok=True)
(out / 'php-baremetal-logo-light.svg').write_text(with_box(src, TIGHT))
(out / 'php-baremetal-logo-dark.svg').write_text(with_box(src.replace(SLATE, GREY), TIGHT))

favicon = with_box(src, SQUARE).replace(f'fill="{SLATE}"', 'class="ink"')
favicon = favicon.replace('>', f'><style>.ink{{fill:{SLATE}}}@media (prefers-color-scheme: dark){{.ink{{fill:{GREY}}}}}</style>', 1)
(PUBLIC / 'favicon.svg').write_text(favicon)

TILE_SVG = with_box(src, SQUARE)


def tile_html(size: int, pad: float, radius: float) -> str:
    inner = size * (1 - 2 * pad)
    return f'''<html><body style="margin:0;background:transparent">
<div style="width:{size}px;height:{size}px;background:{PAPER};border-radius:{radius * size}px;
            display:flex;align-items:center;justify-content:center">
  <div style="width:{inner}px;height:{inner}px">{TILE_SVG.replace('<svg ', '<svg width="100%" height="100%" ', 1)}</div>
</div></body></html>'''


renders = {
    'favicon-16x16.png': (16, 0.04, 0.18),
    'favicon-32x32.png': (32, 0.05, 0.18),
    'favicon-48x48.png': (48, 0.06, 0.18),
    'apple-touch-icon.png': (180, 0.12, 0.0),     # iOS rounds it itself
    'android-chrome-192.png': (192, 0.12, 0.18),
    'android-chrome-512.png': (512, 0.20, 0.0),   # maskable: drawing in the safe zone
}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROMIUM, args=['--no-sandbox'])
    for name, (size, pad, radius) in renders.items():
        # Chromium cannot capture a viewport under ~64 px: render in a larger one, clip.
        page = browser.new_page(viewport={'width': max(size, 600), 'height': max(size, 600)}, device_scale_factor=1)
        page.set_content(tile_html(size, pad, radius))
        page.screenshot(path=str(PUBLIC / name), omit_background=True,
                        clip={'x': 0, 'y': 0, 'width': size, 'height': size})
        page.close()
    browser.close()

# favicon.ico: the 16/32/48 PNGs as they are (PNG-in-ICO, every browser since 2007)
pngs = [(s, (PUBLIC / f'favicon-{s}x{s}.png').read_bytes()) for s in (16, 32, 48)]
header = struct.pack('<HHH', 0, 1, len(pngs))
offset = 6 + 16 * len(pngs)
entries, blobs = b'', b''
for size, data in pngs:
    entries += struct.pack('<BBBBHHII', size, size, 0, 0, 1, 32, len(data), offset)
    offset += len(data)
    blobs += data
(PUBLIC / 'favicon.ico').write_bytes(header + entries + blobs)
print('written:', ', '.join(['brand/*.svg', 'favicon.svg', *renders, 'favicon.ico']))
