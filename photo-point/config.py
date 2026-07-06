import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    HOST = os.getenv('PHOTO_POINT_HOST', '0.0.0.0')
    PORT = int(os.getenv('PHOTO_POINT_PORT', '9400'))
    DEBUG = os.getenv('PHOTO_POINT_DEBUG', 'false').lower() == 'true'

    CAPTURES_DIR = os.getenv('PHOTO_POINT_CAPTURES', os.path.join(os.path.dirname(__file__), 'captures'))
    FRAMES_DIR = os.getenv('PHOTO_POINT_FRAMES', os.path.join(os.path.dirname(__file__), 'frames'))

    CAMERA_DEVICE = int(os.getenv('PHOTO_POINT_CAMERA', '0'))
    CAPTURE_RESOLUTION = os.getenv('PHOTO_POINT_RESOLUTION', '1920x1080')

    PRINTER_NAME = os.getenv('PHOTO_POINT_PRINTER', '')
    PRINTER_ENABLED = os.getenv('PHOTO_POINT_PRINTER_ENABLED', 'true').lower() == 'true'

    SMTP_HOST = os.getenv('PHOTO_POINT_SMTP_HOST', '')
    SMTP_PORT = int(os.getenv('PHOTO_POINT_SMTP_PORT', '587'))
    SMTP_USER = os.getenv('PHOTO_POINT_SMTP_USER', '')
    SMTP_PASS = os.getenv('PHOTO_POINT_SMTP_PASS', '')
    SMTP_FROM = os.getenv('PHOTO_POINT_SMTP_FROM', '')
    EMAIL_ENABLED = os.getenv('PHOTO_POINT_EMAIL_ENABLED', 'false').lower() == 'true'

    SECRET_KEY = os.getenv('PHOTO_POINT_SECRET', 'change-me-in-production')
