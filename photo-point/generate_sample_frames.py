#!/usr/bin/env python3
"""Generate sample frame PNGs for the Photo Point app."""

import sys
import os
from PIL import Image, ImageDraw, ImageFont


W, H = 1920, 1080


def create_frame(path: str, name: str,
                 bg_color: tuple[int, int, int, int],
                 border_color: tuple[int, int, int],
                 border_width: int,
                 corner_text: str = '',
                 radius: int = 60) -> None:
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle(
        [(border_width, border_width), (W - border_width - 1, H - border_width - 1)],
        radius=radius, fill=bg_color
    )

    draw.rounded_rectangle(
        [(0, 0), (W - 1, H - 1)],
        radius=radius, outline=border_color, width=border_width
    )

    if corner_text:
        try:
            font = ImageFont.truetype('DejaVuSans.ttf', 48)
        except (OSError, IOError):
            font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), corner_text, font=font)
        tx = (W - (bbox[2] - bbox[0])) // 2
        ty = H - (bbox[3] - bbox[1]) - 40
        draw.text((tx, ty), corner_text, fill=border_color, font=font)

    img.save(path, 'PNG')
    print(f'  Created: {path}')


def create_slide_frame(path: str, mount_color: tuple = (30, 28, 26),
                       label: str = '35mm', frame_no: str = '00') -> None:
    margin = 100
    inner_radius = 50

    img = Image.new('RGBA', (W, H), (*mount_color, 255))
    draw = ImageDraw.Draw(img)

    mask = Image.new('L', (W, H), 255)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(
        [(margin, margin), (W - margin, H - margin)],
        radius=inner_radius, fill=0
    )

    r, g, b, a = img.split()
    a = Image.composite(Image.new('L', (W, H), 0), a, mask)
    img = Image.merge('RGBA', (r, g, b, a))

    draw = ImageDraw.Draw(img)

    try:
        font_sm = ImageFont.truetype('DejaVuSans.ttf', 36)
        font_lg = ImageFont.truetype('DejaVuSans.ttf', 52)
    except (OSError, IOError):
        font_sm = font_lg = ImageFont.load_default()

    tag = '#notticilentaneascea'
    bbox = draw.textbbox((0, 0), tag, font=font_sm)
    draw.text(((W - (bbox[2] - bbox[0])) // 2, H - 70), tag,
              fill=(180, 175, 160, 255), font=font_sm)

    info = f'{label}  #{frame_no}'
    bbox = draw.textbbox((0, 0), info, font=font_sm)
    draw.text(((W - (bbox[2] - bbox[0])) // 2, 30), info,
              fill=(180, 175, 160, 255), font=font_sm)

    draw.rounded_rectangle(
        [(margin, margin), (W - margin, H - margin)],
        radius=inner_radius, outline=(60, 55, 50, 255), width=4
    )

    img.save(path, 'PNG')
    print(f'  Created: {path} (diapositiva)')


def create_guide_frame(path: str) -> None:
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    CX, CY = W // 2, H // 2

    # semi-transparent dark overlay for edges (vignetta)
    for i in range(200):
        alpha = max(0, int(80 * (1 - i / 200)))
        draw.rectangle(
            [(i, i), (W - 1 - i, H - 1 - i)],
            outline=(0, 0, 0, alpha)
        )

    # safe zone rounded rectangle (4:3 crop area)
    margin_x, margin_y = 160, 120
    draw.rounded_rectangle(
        [(margin_x, margin_y), (W - margin_x, H - margin_y)],
        radius=40, outline=(255, 255, 255, 120), width=3
    )
    # corner markers
    c_len = 40
    for (sx, sy) in [(margin_x, margin_y), (W - margin_x, margin_y),
                     (margin_x, H - margin_y), (W - margin_x, H - margin_y)]:
        for dx, dy, hx, hy in [(1, 1, 1, 0), (-1, 1, -1, 0), (1, -1, 1, 0), (-1, -1, -1, 0)]:
            continue

    # corner marks — L shapes
    corners = [
        (margin_x, margin_y, 1, 1),
        (W - margin_x, margin_y, -1, 1),
        (margin_x, H - margin_y, 1, -1),
        (W - margin_x, H - margin_y, -1, -1),
    ]
    for cx, cy, dx, dy in corners:
        draw.line([(cx, cy), (cx + dx * c_len, cy)], fill=(255, 255, 255, 180), width=4)
        draw.line([(cx, cy), (cx, cy + dy * c_len)], fill=(255, 255, 255, 180), width=4)

    # crosshair
    draw.line([(CX, CY - 80), (CX, CY + 80)], fill=(255, 255, 255, 100), width=2)
    draw.line([(CX - 80, CY), (CX + 80, CY)], fill=(255, 255, 255, 100), width=2)
    draw.ellipse([(CX - 8, CY - 8), (CX + 8, CY + 8)], outline=(255, 255, 255, 120), width=2)

    # head/shoulders silhouette
    sil_color = (255, 255, 255, 60)
    shoulder_y = CY + 180
    # shoulders arc
    draw.arc([(CX - 240, shoulder_y - 40), (CX + 240, shoulder_y + 80)],
             0, 180, fill=sil_color, width=6)
    # neck
    draw.line([(CX - 40, CY - 100), (CX - 40, shoulder_y)], fill=sil_color, width=3)
    draw.line([(CX + 40, CY - 100), (CX + 40, shoulder_y)], fill=sil_color, width=3)
    # head circle
    draw.ellipse([(CX - 70, CY - 220), (CX + 70, CY - 80)], outline=sil_color, width=4)

    # height markers on the left
    try:
        font_sm = ImageFont.truetype('DejaVuSans.ttf', 28)
    except (OSError, IOError):
        font_sm = ImageFont.load_default()

    for label, y_pos in [('Testa', CY - 150), ('Spalle', CY + 60), ('Vita', CY + 280)]:
        draw.line([(30, y_pos), (80, y_pos)], fill=(255, 255, 255, 100), width=2)
        bbox = draw.textbbox((0, 0), label, font=font_sm)
        draw.text((90, y_pos - (bbox[3] - bbox[1]) // 2), label,
                  fill=(255, 255, 255, 100), font=font_sm)

    # instruction text
    try:
        font_inst = ImageFont.truetype('DejaVuSans.ttf', 40)
    except (OSError, IOError):
        font_inst = ImageFont.load_default()
    inst_text = 'Posizionati al centro, testa nel cerchio'
    bbox = draw.textbbox((0, 0), inst_text, font=font_inst)
    tx = (W - (bbox[2] - bbox[0])) // 2
    ty = H - 100
    draw.text((tx, ty), inst_text, fill=(255, 255, 255, 160), font=font_inst)

    # bottom hashtag
    try:
        font_tag = ImageFont.truetype('DejaVuSans.ttf', 36)
    except (OSError, IOError):
        font_tag = ImageFont.load_default()
    tag = '#notticilentaneascea'
    bbox = draw.textbbox((0, 0), tag, font=font_tag)
    tx = (W - (bbox[2] - bbox[0])) // 2
    draw.text((tx, 30), tag, fill=(255, 255, 255, 80), font=font_tag)

    img.save(path, 'PNG')
    print(f'  Created: {path} (guida posizionamento)')


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(__file__), 'frames')
    os.makedirs(out_dir, exist_ok=True)

    frames = [
        ('classic.png',       'Classic',    (255, 255, 255, 180), (0, 0, 0),       20, '#notticilentaneascea', 50),
        ('gold.png',          'Gold',       (255, 215, 0, 80),    (212, 175, 55),  30, '#notticilentaneascea', 60),
        ('polaroid.png',      'Polaroid',   (255, 255, 255, 230), (200, 200, 200), 15, '#notticilentaneascea', 80),
        ('party.png',         'Party',      (255, 0, 128, 100),   (255, 0, 128),   15, '#notticilentaneascea', 70),
        ('elegance.png',      'Elegance',   (0, 0, 0, 120),       (192, 192, 192), 8,  '#notticilentaneascea', 40),
    ]

    for filename, name, bg, border, bw, text, radius in frames:
        create_frame(os.path.join(out_dir, filename), name, bg, border, bw, text, radius)

    create_slide_frame(os.path.join(out_dir, 'diapositiva.png'))
    create_guide_frame(os.path.join(out_dir, 'guida.png'))

    print(f'\n{len(frames) + 2} sample frames generated in {out_dir}')


if __name__ == '__main__':
    main()
