"""Compone las imágenes originales sin retocar el arte."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
FILES = [
    ('A · Flor', 'a-flor-default.png'),
    ('B · Margarita', 'b-margarita.png'),
    ('C · Girasol', 'c-girasol.png'),
    ('D · Tulipán', 'd-tulipan.png'),
    ('E · Amapola', 'e-amapola-v2.png'),
    ('F · Rosa', 'f-rosa.png'),
]
CREAM = '#FFFDF3'
INK = '#173D2C'
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'

def fit_asset(file, size):
    image = Image.open(ROOT / file).convert('RGBA')
    # Conserva el original y su transparencia; cambia solo escala en la lámina.
    image.thumbnail((size, size), Image.Resampling.LANCZOS)
    return image

def make_sheet():
    sheet = Image.new('RGB', (1560, 1160), CREAM)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(FONT, 27)
    for i, (label, file) in enumerate(FILES):
        col, row = i % 3, i // 3
        art = fit_asset(file, 460)
        x = col * 520 + (520-art.width)//2
        y = row * 580 + 32
        sheet.paste(art, (x, y), art)
        draw.text((col * 520 + 260, row * 580 + 528), label, font=font, fill=INK, anchor='mm')
    sheet.save(ROOT / 'comparison.png')

def make_small_review():
    sheet = Image.new('RGB', (1056, 400), CREAM)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(FONT, 18)
    for i, (label, file) in enumerate(FILES):
        cx = 88 + i * 176
        draw.text((cx, 22), label, font=font, fill=INK, anchor='mm')
        for size, y in [(128, 48), (64, 218), (48, 320)]:
            art = fit_asset(file, size)
            sheet.paste(art, (cx-art.width//2, y), art)
    sheet.save(ROOT / 'small-review.png')

if __name__ == '__main__':
    make_sheet()
    make_small_review()
