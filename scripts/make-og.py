#!/usr/bin/env python3
"""Rebuilds public/og.jpg (1200x630 link preview) in the temporary theme.

Needs Pillow and three Google Fonts TTFs (not shipped; download from fonts.google.com):
  python3 scripts/make-og.py CormorantGaramond-SemiBoldItalic.ttf Figtree-SemiBold.ttf Figtree-Bold.ttf
Colours mirror src/styles/theme.css. Edit the text lines below for a new event.
After changing the image, the og:image URL hash changes automatically at build.
"""
import sys

from PIL import Image, ImageDraw, ImageFont

DISPLAY, TEXT, TEXT_BOLD = sys.argv[1:4]
TITLE = 'Wives Hangout'
EYEBROW = "YOU'RE INVITED TO"
LINES = ['Saturday, 24 October 2026 · 4PM', 'Freedom Place, Ilesanmi Bus Stop,', 'Tanke, Ilorin']
CTA = 'Register free'

ivory, linen, wine, ink, gold, gold700 = (251, 245, 238), (243, 230, 218), (90, 26, 48), (43, 20, 25), (212, 175, 98), (122, 87, 27)
W, H, S = 1200, 630, 2
im = Image.new('RGB', (W * S, H * S), ivory)
d = ImageDraw.Draw(im)

# Wine band on the left with the church logo on an ivory disc.
band = 400 * S
d.rectangle((0, 0, band, H * S), fill=wine)
d.rectangle((band - 10 * S, 0, band - 6 * S, H * S), fill=gold)
cx, cy, r = band // 2, H * S // 2, 140 * S
d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=ivory)
logo = Image.open('brand/clc-logo.png').convert('RGBA')
bbox = logo.getbbox()
logo = logo.crop(bbox)
lh = 180 * S
lw = int(logo.width * lh / logo.height)
logo = logo.resize((lw, lh), Image.LANCZOS)
im.paste(logo, (cx - lw // 2, cy - lh // 2), logo)

x = band + 70 * S
eyebrow = ImageFont.truetype(TEXT_BOLD, 24 * S)
d.text((x, 95 * S), EYEBROW, font=eyebrow, fill=gold700, spacing=0)
title = ImageFont.truetype(DISPLAY, 112 * S)
d.text((x - 4 * S, 128 * S), TITLE, font=title, fill=wine)
# Ornament: rule, diamond, rule.
oy = 290 * S
d.rectangle((x, oy, x + 90 * S, oy + 2 * S), fill=gold700)
dx = x + 110 * S
d.polygon([(dx, oy - 9 * S), (dx + 10 * S, oy + 1 * S), (dx, oy + 11 * S), (dx - 10 * S, oy + 1 * S)], outline=gold700, width=2 * S)
d.rectangle((dx + 20 * S, oy, dx + 110 * S, oy + 2 * S), fill=gold700)

body = ImageFont.truetype(TEXT, 34 * S)
y = 325 * S
for i, line in enumerate(LINES):
    d.text((x, y), line, font=body, fill=ink)
    y += (54 if i == 0 else 44) * S

cta = ImageFont.truetype(TEXT_BOLD, 32 * S)
cw = d.textbbox((0, 0), CTA, font=cta)[2]
by = 490 * S
d.rounded_rectangle((x, by, x + cw + 64 * S, by + 72 * S), 36 * S, fill=wine)
d.text((x + 32 * S, by + 16 * S), CTA, font=cta, fill=ivory)

im.resize((W, H), Image.LANCZOS).save('public/og.jpg', quality=86, optimize=True, progressive=True)
print('wrote public/og.jpg')
