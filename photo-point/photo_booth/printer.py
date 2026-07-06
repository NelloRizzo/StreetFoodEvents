import subprocess
import shutil

from config import Config


def is_available() -> bool:
    if not Config.PRINTER_ENABLED:
        return False
    if Config.PRINTER_NAME:
        return bool(shutil.which('lp'))
    return bool(shutil.which('lp'))


def list_printers() -> list[dict]:
    try:
        result = subprocess.run(['lpstat', '-p'], capture_output=True, text=True, timeout=10)
        printers = []
        for line in result.stdout.splitlines():
            if line.startswith('printer '):
                name = line.split()[1]
                status = 'idle' if 'idle' in line else 'busy'
                printers.append({'name': name, 'status': status})
        return printers
    except (subprocess.CalledProcessError, FileNotFoundError, TimeoutError):
        return []


def print_photo(filepath: str, printer: str | None = None) -> bool:
    printer_name = printer or Config.PRINTER_NAME
    if not printer_name:
        printers = list_printers()
        if not printers:
            return False
        printer_name = printers[0]['name']

    try:
        subprocess.run(
            ['lp', '-d', printer_name, filepath],
            check=True, capture_output=True, timeout=30)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError, TimeoutError):
        return False
