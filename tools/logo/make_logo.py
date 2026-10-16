"""Genera el logo de Neon Dash 3D en SVG (texto convertido en trazos, sin depender de la fuente instalada).

Uso: python tools/logo/make_logo.py   (necesita fonttools y brotli: pip install fonttools brotli)
Salida en assets/logo/: emblema.svg, logo.svg (horizontal), logo-vertical.svg y sus versiones *-plano.svg sin
efectos de brillo (para fondos claros o impresión). Los PNG para las tiendas los saca tools/logo/export.html.
"""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FONT = os.path.join(ROOT, 'node_modules', '@fontsource', 'chakra-petch', 'files', 'chakra-petch-latin-700-normal.woff2')
OUT = os.path.join(ROOT, 'assets', 'logo')
os.makedirs(OUT, exist_ok=True)

CYAN, PINK, GOLD, INK, WHITE = '#27e3ff', '#ff3bd4', '#ffd23a', '#05040c', '#f2fbff'

font = TTFont(FONT)
gs = font.getGlyphSet()
cmap = font.getBestCmap()
UPM = font['head'].unitsPerEm


def text_path(text, size, x0=0.0, y0=0.0, skew=0.0, track=0.0):
    """Trazo SVG del texto (línea base en y0) y su ancho. skew inclina (cursiva falsa), track separa letras."""
    k = size / UPM
    pen = SVGPathPen(gs)
    x = 0.0
    for ch in text:
        g = cmap.get(ord(ch))
        if g is None:
            continue
        # (x, y) de la fuente → SVG: escala, invierte y y aplica la inclinación
        tp = TransformPen(pen, (k, 0, -k * skew, -k, x0 + x, y0))
        gs[g].draw(tp)
        x += gs[g].width * k + track
    return pen.getCommands(), x - track


def emblem(cx, cy, s, glow=True):
    """Emblema: cubo inclinado (en pleno salto) con la doble flecha recortada y estelas de velocidad detrás."""
    h = s / 2
    r = s * 0.16  # esquinas cortadas, como los paneles del juego
    sq = (f'M{-h + r},{-h} L{h},{-h} L{h},{h - r} L{h - r},{h} L{-h},{h} L{-h},{-h + r} Z')
    w = s * 0.17
    def chev(x):
        return (f'M{x - w},{-s * 0.25} L{x - w + s * 0.11},{-s * 0.25} L{x + w + s * 0.02},0 '
                f'L{x - w + s * 0.11},{s * 0.25} L{x - w},{s * 0.25} L{x + w - s * 0.09},0 Z')
    streaks = ''.join(
        f'<rect x="{-h - s * (0.2 + 0.1 * i)}" y="{-s * 0.06 + (i - 1) * s * 0.26}" width="{s * (0.22 + 0.06 * (2 - i))}" '
        f'height="{s * 0.075}" fill="url(#streak)"/>' for i in range(3))
    f = ' filter="url(#glow)"' if glow else ''
    return f'''<g transform="translate({cx},{cy})">
    {streaks}
    <g transform="rotate(-12)">
      <path d="{sq}" transform="translate({s * 0.06},{s * 0.06})" fill="{PINK}" opacity="0.85"/>
      <path d="{sq}" fill="{INK}" stroke="{CYAN}" stroke-width="{s * 0.075}" stroke-linejoin="miter"{f}/>
      <path d="{chev(-s * 0.1)}" fill="{CYAN}"{f}/>
      <path d="{chev(s * 0.13)}" fill="{CYAN}"{f}/>
    </g>
  </g>'''


def defs(glow=True):
    g = '''<filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>''' if glow else ''
    return f'''<defs>
    {g}
    <linearGradient id="streak" x1="0" x2="1"><stop offset="0" stop-color="{CYAN}" stop-opacity="0"/><stop offset="1" stop-color="{CYAN}"/></linearGradient>
    <linearGradient id="word" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#bff4ff"/></linearGradient>
  </defs>'''


def wordmark(x, base, size, glow=True):
    """'NEON DASH' en cursiva con sombra magenta desplazada y la etiqueta '3D' dorada en paralelogramo."""
    p, wdt = text_path('NEON DASH', size, x, base, skew=0.2, track=size * 0.02)
    f = ' filter="url(#glow)"' if glow else ''
    tag_h = size * 0.62
    tx = x + wdt + size * 0.16
    t3, w3 = text_path('3D', size * 0.5, tx + size * 0.14, base - size * 0.12, skew=0, track=0)
    tag_w = w3 + size * 0.3
    tag = (f'<path d="M{tx + size * 0.08},{base - size * 0.12 - tag_h * 0.86} L{tx + tag_w + size * 0.08},{base - size * 0.12 - tag_h * 0.86} '
           f'L{tx + tag_w - size * 0.06},{base - size * 0.12 + tag_h * 0.18} L{tx - size * 0.06},{base - size * 0.12 + tag_h * 0.18} Z" fill="{GOLD}"/>')
    svg = f'''<path d="{p}" transform="translate({size * 0.045},{size * 0.045})" fill="{PINK}" opacity="0.8"/>
  <path d="{p}" fill="url(#word)"{f}/>
  <path d="{p}" fill="none" stroke="{CYAN}" stroke-width="{size * 0.012}" opacity="0.9"/>
  {tag}
  <path d="{t3}" fill="{INK}"/>'''
    return svg, tx + tag_w + size * 0.1 - x


def write(name, w, h, body, bg=None):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    open(os.path.join(OUT, name), 'w', encoding='utf-8').write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">\n  {rect}\n  {body}\n</svg>\n')


for glow in (True, False):
    suf = '' if glow else '-plano'
    # emblema solo (íconos de app, favicon, avatar)
    write(f'emblema{suf}.svg', 512, 512, defs(glow) + emblem(292, 256, 240, glow))
    # horizontal: emblema + texto
    size = 150
    wm, ww = wordmark(350, 215, size, glow)
    W = int(350 + ww + 40)
    write(f'logo{suf}.svg', W, 300, defs(glow) + emblem(190, 150, 150, glow) + wm)
    # vertical: emblema arriba, texto debajo
    size = 120
    _, ww2 = wordmark(0, 0, size, glow)
    W2 = int(ww2 + 120)
    wm2, _ = wordmark(60, 470, size, glow)
    write(f'logo-vertical{suf}.svg', W2, 540, defs(glow) + emblem(W2 / 2 + 20, 200, 220, glow) + wm2)
print('ok', os.listdir(OUT))
