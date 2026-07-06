# Street Food Events — Photo Point

Applicazione per creare un **Photo Point** con Raspberry Pi + camera USB. Scatta foto, applica cornici grafiche, stampa su stampante fotografica USB o invia via email.

## Architettura

```
Tablet / Smartphone  ──WiFi──▶  Raspberry Pi (:9400)  ──USB──▶  Camera
                                                     ──USB──▶  Stampante foto
                                                     ───LAN──▶  (SMTP → email)
```

- **Web UI** reattiva (mobile-first) per scattare, scegliere cornice, stampare e inviare
- **Python/Flask** — indipendente dal resto del progetto, gira su un Pi dedicato
- **Nessuna dipendenza esterna** oltre a camera USB e CUPS

## Requisiti hardware

| Componente | Specifica |
|---|---|
| Raspberry Pi | 3B, 3B+, 4B, Zero 2 W (≥1GB RAM) |
| Camera USB | UVC-compatible webcam (es. Logitech C270, C920) |
| Stampante foto | Supportata da CUPS (es. Canon SELPHY, Polaroid Lab, Epson PictureMate) |
| Scheda SD | ≥16 GB, Classe 10 |
| Connettività | Ethernet o WiFi |

## Requisiti software

- **Raspberry Pi OS** (Debian Bookworm, 32 o 64 bit)
- **Python ≥ 3.11**
- **CUPS** (Common Unix Printing System) — per la stampante foto
- **fswebcam** o **OpenCV** — per la camera

## Installazione rapida

```bash
git clone https://github.com/NelloRizzo/StreetFoodEvents.git
cd StreetFoodEvents/photo-point
sudo bash install.sh
```

Lo script:
1. Installa dipendenze di sistema (python3, numpy, opencv via apt — pre-compilati per ARM, nessun build da sorgente)
2. Copia l'app in `/opt/photo-point`
3. Crea virtualenv Python e installa le dipendenze
4. Genera cornici di esempio
5. Installa e avvia il servizio systemd

## Installazione manuale

```bash
# Dipendenze di sistema (numpy/opencv via apt = pre-compilati ARM)
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv python3-numpy python3-opencv fswebcam cups printer-driver-gutenprint

# Gruppi
sudo usermod -a -G lp pi
sudo usermod -a -G video pi

# Progetto
cd photo-point
python3 -m venv --system-site-packages venv
source venv/bin/activate
pip install -r requirements.txt

# Avvio
python3 app.py
# → http://localhost:9400
```

## Configurazione

Tramite variabili d'ambiente (modificare `photo-point.service` o creare `.env` nella directory):

| Variabile | Default | Descrizione |
|---|---|---|
| `PHOTO_POINT_HOST` | `0.0.0.0` | IP su cui ascoltare |
| `PHOTO_POINT_PORT` | `9400` | Porta |
| `PHOTO_POINT_CAMERA` | `0` | Device index `/dev/videoN` |
| `PHOTO_POINT_RESOLUTION` | `1920x1080` | Risoluzione scatto |
| `PHOTO_POINT_PRINTER` | — | Nome stampante CUPS (se vuoto usa la prima) |
| `PHOTO_POINT_PRINTER_ENABLED` | `true` | Abilita/disabilita stampa |
| `PHOTO_POINT_SMTP_HOST` | — | Server SMTP (es. `smtp.gmail.com`) |
| `PHOTO_POINT_SMTP_PORT` | `587` | Porta SMTP |
| `PHOTO_POINT_SMTP_USER` | — | Utente SMTP |
| `PHOTO_POINT_SMTP_PASS` | — | Password SMTP |
| `PHOTO_POINT_SMTP_FROM` | — | Mittente email |
| `PHOTO_POINT_EMAIL_ENABLED` | `false` | Abilita invio email |
| `PHOTO_POINT_SECRET` | `change-me-in-production` | Chiave sessione Flask |

### Configurazione stampante CUPS

```bash
# Apri l'interfaccia web CUPS
sudo cupsctl --remote-admin
# → http://raspberrypi:631 (o http://<ip>:631)

# Oppure da terminale
lpinfo -v                    # Elenca connessioni
sudo lpadmin -p PhotoPrinter -E -v usb://... -m everywhere
```

### Configurazione email (Gmail esempio)

```env
PHOTO_POINT_SMTP_HOST=smtp.gmail.com
PHOTO_POINT_SMTP_PORT=587
PHOTO_POINT_SMTP_USER=tua.email@gmail.com
PHOTO_POINT_SMTP_PASS=password-app-specifica
PHOTO_POINT_SMTP_FROM=Photo Point <tua.email@gmail.com>
PHOTO_POINT_EMAIL_ENABLED=true
```

> Per Gmail: usa una [password per app](https://support.google.com/accounts/answer/185833).

## API

### `GET /api/status`

Stato del sistema: camera, cornici, stampante, email.

### `POST /api/capture`

Scatta una foto. Body JSON opzionale:

```json
{ "frame_id": "classic" }
```

Risposta:

```json
{ "photo_id": "abc123", "filename": "photo_abc123.jpg", "url": "/api/photo/photo_abc123.jpg" }
```

### `POST /api/print`

Stampa una foto. Body JSON:

```json
{ "filename": "photo_abc123.jpg", "printer": "PhotoPrinter" }
```

### `POST /api/email`

Invia una foto via email. Body JSON:

```json
{ "recipient": "ospite@example.com", "filename": "photo_abc123.jpg" }
```

### `POST /api/frames/upload`

Carica una nuova cornice (multipart form, campo `file`). Solo PNG/JPG.

### `DELETE /api/frames/<id>`

Elimina una cornice.

## Cornici (frames)

Le cornici sono immagini PNG con area trasparente. La foto viene ridimensionata e composta sotto la cornice.

Per creare una cornice personalizzata:
1. Crea un PNG 1920×1080 con trasparenza nella zona della foto
2. Caricalo tramite interfaccia web (sezione "Gestione cornici")
3. La foto verrà composta automaticamente

Per cornici con buchi di forma diversa dal rettangolo pieno (es. cuore, cerchio), crea il PNG con la maschera di trasparenza desiderata.

## Comandi utili

```bash
# Stato servizio
sudo systemctl status photo-point

# Log in tempo reale
sudo journalctl -u photo-point -f

# Riavvio
sudo systemctl restart photo-point

# Test salute
curl http://localhost:9400/api/status

# Test scatto
curl -X POST http://localhost:9400/api/capture -H "Content-Type: application/json" -d '{}'

# Elenca stampanti CUPS
lpstat -p

# Stampa da terminale (test)
lp -d PhotoPrinter /opt/photo-point/captures/photo_*.jpg
```

## Troubleshooting

| Problema | Causa probabile | Soluzione |
|---|---|---|
| `/dev/video0` non esiste | Camera non riconosciuta | `dmesg \| grep video`, `lsusb`, `v4l2-ctl --list-devices` |
| `fswebcam: command not found` | fswebcam non installato | `sudo apt-get install fswebcam` |
| `Permission denied` su camera | Utente non nel gruppo `video` | `sudo usermod -a -G video pi`, riavvia |
| Stampa non funziona | CUPS non configurato | `lpinfo -v`, `lpadmin` per aggiungere stampante |
| Email non inviata | SMTP non configurato | Verifica env var, prova con `openssl s_client` |
| Foto troppo scura | Esposizione camera | Prova a regolare l'illuminazione dell'area |
| Web UI non si carica | Porta bloccata | `sudo netstat -tulpn \| grep 9400` |

## Sviluppo

```bash
# Avvio in modalità sviluppo (con hot-reload)
source venv/bin/activate
PHOTO_POINT_DEBUG=true python3 app.py

# Oppure con gunicorn
gunicorn app:app --bind 0.0.0.0:9400 --workers 2 --reload
```

## Struttura del progetto

```
photo-point/
├── app.py                      # Flask application
├── config.py                   # Configurazione env vars
├── requirements.txt            # Dipendenze Python
├── generate_sample_frames.py   # Generatore cornici di esempio
├── install.sh                  # Script installazione Pi
├── photo-point.service         # Systemd unit
├── photo_booth/
│   ├── __init__.py
│   ├── camera.py               # Acquisizione camera
│   ├── frame.py                # Composizione cornici (Pillow)
│   ├── printer.py              # Stampa CUPS
│   └── emailer.py              # Invio email SMTP
├── templates/
│   └── index.html              # Web UI
├── static/
│   ├── style.css               # Stili
│   └── script.js               # Logica frontend
├── frames/                     # Cornici PNG
├── captures/                   # Foto scattate
└── README.md
```
