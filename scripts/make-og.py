#!/usr/bin/env python3
"""Rebuilds public/og.jpg (1200x630 link preview) from the flyer.

The top of the flyer (logo, title, ribbon, theme band) is centred on a blurred copy of itself.
  python3 scripts/make-og.py "brand/wives hangout - flyer.png"
After changing the image, the og:image URL hash changes automatically at build (vite.config.ts).
"""
import sys

from PIL import Image, ImageEnhance, ImageFilter

FLYER = sys.argv[1] if len(sys.argv) > 1 else 'brand/wives hangout - flyer.png'
TOP_UNTIL = 2280  # px in the 3600x4400 flyer: just below the "Marriage, Motherhood and Ministry" band
W, H = 1200, 630

top = Image.open(FLYER).convert('RGB').crop((0, 0, 3600, TOP_UNTIL))

# Background: the same crop scaled to cover, blurred and slightly darkened.
scale = max(W / top.width, H / top.height)
bg = top.resize((round(top.width * scale), round(top.height * scale)), Image.LANCZOS)
bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))
bg = ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(28))).enhance(0.85)

# Foreground: the crop scaled to the full height, centred.
fg = top.resize((round(top.width * H / top.height), H), Image.LANCZOS)
bg.paste(fg, ((W - fg.width) // 2, 0))
bg.save('public/og.jpg', quality=86, optimize=True, progressive=True)
print('wrote public/og.jpg', bg.size)
