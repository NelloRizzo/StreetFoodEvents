import os
import subprocess
import tempfile
from pathlib import Path

from config import Config


def _capture_opencv(output_path: str) -> str | None:
    return None


try:
    import cv2

    def _capture_opencv(output_path: str) -> str | None:
        w, h = (int(x) for x in Config.CAPTURE_RESOLUTION.split('x'))
        try:
            cap = cv2.VideoCapture(Config.CAMERA_DEVICE)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, w)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, h)
            ret, frame = cap.read()
            cap.release()
            if ret:
                cv2.imwrite(output_path, frame)
                return output_path
            return None
        except Exception:
            return None
except ImportError:
    pass


def _capture_fswebcam(output_path: str) -> str | None:
    try:
        subprocess.run(
            ['fswebcam', '--no-banner', f'--resolution={Config.CAPTURE_RESOLUTION}',
             '-d', f'/dev/video{Config.CAMERA_DEVICE}', output_path],
            check=True, capture_output=True, timeout=15)
        return output_path
    except (subprocess.CalledProcessError, FileNotFoundError, TimeoutError):
        return None


def capture(output_path: str | None = None) -> str | None:
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix='.jpg', dir=Config.CAPTURES_DIR)
        os.close(fd)

    Path(Config.CAPTURES_DIR).mkdir(parents=True, exist_ok=True)

    result = _capture_opencv(output_path)
    if result:
        return result

    result = _capture_fswebcam(output_path)
    if result:
        return result

    return None
