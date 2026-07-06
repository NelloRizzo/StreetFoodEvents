#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# Street Food Events — Photo Point installer
# Raspberry Pi (Python 3 + Flask)
# ──────────────────────────────────────────────

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PHOTO_POINT_DIR="$REPO_DIR/photo-point"
INSTALL_DIR="/opt/photo-point"

echo "=== Photo Point Installer ==="
echo ""

# ── 1. System dependencies ──
echo "[1/6] Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  python3 \
  python3-pip \
  python3-venv \
  fswebcam \
  cups \
  printer-driver-gutenprint \
  python3-cups 2>/dev/null || true
# python3-cups may not exist on all distros, that's fine

# Add pi to lp group for printer access
sudo usermod -a -G lp pi
sudo usermod -a -G lp "$(whoami)" 2>/dev/null || true

# ── 2. Add pi to video group (camera access) ──
sudo usermod -a -G video pi
sudo usermod -a -G video "$(whoami)" 2>/dev/null || true

# ── 3. Create install directory ──
echo "[2/6] Copying application to $INSTALL_DIR..."
sudo mkdir -p "$INSTALL_DIR"
sudo mkdir -p "$INSTALL_DIR/captures"
sudo mkdir -p "$INSTALL_DIR/frames"
sudo mkdir -p "$INSTALL_DIR/static"
sudo mkdir -p "$INSTALL_DIR/templates"
sudo mkdir -p "$INSTALL_DIR/photo_booth"

sudo cp -r "$PHOTO_POINT_DIR/app.py" "$INSTALL_DIR/"
sudo cp -r "$PHOTO_POINT_DIR/config.py" "$INSTALL_DIR/"
sudo cp -r "$PHOTO_POINT_DIR/requirements.txt" "$INSTALL_DIR/"
sudo cp -r "$PHOTO_POINT_DIR/photo_booth/"*.py "$INSTALL_DIR/photo_booth/"
sudo cp -r "$PHOTO_POINT_DIR/static/"* "$INSTALL_DIR/static/"
sudo cp -r "$PHOTO_POINT_DIR/templates/"* "$INSTALL_DIR/templates/"

# ── 4. Python virtualenv + dependencies ──
echo "[3/6] Installing Python dependencies..."
cd "$INSTALL_DIR"
sudo python3 -m venv venv
sudo "$INSTALL_DIR/venv/bin/pip" install --upgrade pip -q
sudo "$INSTALL_DIR/venv/bin/pip" install -r "$INSTALL_DIR/requirements.txt" -q

# ── 5. Generate sample frames ──
echo "[4/6] Generating sample frames..."
sudo python3 "$PHOTO_POINT_DIR/generate_sample_frames.py" "$INSTALL_DIR/frames"

# ── 6. Set permissions ──
echo "[5/6] Setting permissions..."
sudo chown -R pi:pi "$INSTALL_DIR"
sudo chmod -R 755 "$INSTALL_DIR"

# ── 7. Systemd service ──
echo "[6/6] Installing systemd service..."
sudo cp "$PHOTO_POINT_DIR/photo-point.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable photo-point
sudo systemctl start photo-point

echo ""
echo "=== Installation complete! ==="
echo "Photo Point running at http://$(hostname -I | awk '{print $1}'):9400"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status photo-point"
echo "  sudo journalctl -u photo-point -f"
echo "  sudo systemctl restart photo-point"
echo ""
echo "Configuration via environment (edit /etc/systemd/system/photo-point.service):"
echo "  PHOTO_POINT_PRINTER=YourPrinterName"
echo "  PHOTO_POINT_SMTP_HOST=smtp.example.com"
echo "  PHOTO_POINT_SMTP_PORT=587"
echo "  PHOTO_POINT_SMTP_USER=user@example.com"
echo "  PHOTO_POINT_SMTP_PASS=your-password"
echo "  PHOTO_POINT_SMTP_FROM=photo@example.com"
echo "  PHOTO_POINT_EMAIL_ENABLED=true"
