#!/usr/bin/env python3
"""Combine the viewport crops created by audit-browser.mjs (requires Pillow)."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument('--crops', type=Path, default=Path('/tmp/ddg-crops'))
parser.add_argument('--output', type=Path, default=Path('docs/screenshots'))
args = parser.parse_args()
files = sorted(args.crops.glob('*.jpg'))
if len(files) != 21:
    raise SystemExit(f'Expected exactly 21 crops in {args.crops}; found {len(files)}. Run the full browser audit first.')
args.output.mkdir(parents=True, exist_ok=True)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
except OSError:
    font = ImageFont.load_default()
for part in range(3):
    sheet = Image.new('RGB', (1200, 1080), (246, 247, 242))
    draw = ImageDraw.Draw(sheet)
    for j, file in enumerate(files[part*7:(part+1)*7]):
        x, y = (j % 2) * 600, (j // 2) * 270
        with Image.open(file) as source:
            image = source.convert('RGB')
            image.thumbnail((580, 230))
            sheet.paste(image, (x+10, y+28))
        draw.text((x+12, y+7), file.stem, fill=(45, 65, 53), font=font)
    output = args.output / f'review-{part+1:02}.jpg'
    sheet.save(output, quality=88)
    print(output)
