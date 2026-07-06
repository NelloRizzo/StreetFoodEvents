import os
from pathlib import Path
from PIL import Image

from config import Config


def list_frames() -> list[dict]:
    frames_dir = Path(Config.FRAMES_DIR)
    frames_dir.mkdir(parents=True, exist_ok=True)
    result = []
    for f in sorted(frames_dir.iterdir()):
        if f.suffix.lower() in ('.png', '.jpg', '.jpeg'):
            result.append({'id': f.stem, 'filename': f.name, 'path': str(f)})
    return result


def apply_frame(photo_path: str, frame_path: str, output_path: str) -> str | None:
    try:
        photo = Image.open(photo_path).convert('RGBA')
        frame = Image.open(frame_path).convert('RGBA')

        fw, fh = frame.size
        photo_resized = photo.resize((fw, fh), Image.LANCZOS)

        composite = Image.alpha_composite(photo_resized, frame)

        rgb = Image.new('RGB', composite.size, (255, 255, 255))
        rgb.paste(composite, mask=composite.split()[3])
        rgb.save(output_path, quality=95)

        return output_path
    except Exception:
        return None
