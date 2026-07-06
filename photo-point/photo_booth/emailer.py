import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders

from config import Config


def is_available() -> bool:
    return bool(Config.EMAIL_ENABLED and Config.SMTP_HOST and Config.SMTP_USER and Config.SMTP_PASS)


def send_photo(recipient: str, photo_path: str, message: str = '') -> bool:
    if not is_available():
        return False

    msg = MIMEMultipart()
    msg['From'] = Config.SMTP_FROM or Config.SMTP_USER
    msg['To'] = recipient
    msg['Subject'] = 'La tua foto — Photo Point'

    body = message or 'Ecco la tua foto scattata al Photo Point!'
    msg.attach(MIMEText(body, 'plain'))

    with open(photo_path, 'rb') as f:
        attachment = MIMEBase('image', 'jpeg')
        attachment.set_payload(f.read())
        encoders.encode_base64(attachment)
        attachment.add_header('Content-Disposition', 'attachment', filename='photo.jpg')
        msg.attach(attachment)

    try:
        server = smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT)
        server.starttls()
        server.login(Config.SMTP_USER, Config.SMTP_PASS)
        server.send_message(msg)
        server.quit()
        return True
    except Exception:
        return False
