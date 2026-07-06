#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# Street Food Events — Printer Agent Installer
# Target: Raspberry Pi 2 Model B (ARMv7)
# ──────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="streetfood-printer-agent"
INSTALL_DIR="/opt/$SERVICE_NAME"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
USER="${SUDO_USER:-pi}"
NODE_VERSION="22"
NODE_DIST_VERSION="22.14.0"

echo "=== Street Food Events — Printer Agent Installer ==="
echo "Target: $INSTALL_DIR"
echo ""

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root (sudo)." >&2
  exit 1
fi

# ── 1. System packages ──
echo "[1/5] Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq curl gnupg ca-certificates

# ── 2. Node.js (binary download, ARMv7-compatible) ──
echo "[2/5] Installing Node.js $NODE_VERSION..."
if ! command -v node &>/dev/null; then
  ARCH="linux-armv7l"
  NODE_DIST="node-v${NODE_DIST_VERSION}-${ARCH}"
  curl -fsSL "https://nodejs.org/dist/v${NODE_DIST_VERSION}/${NODE_DIST}.tar.xz" \
    | tar -xJ -C /usr/local --strip-components=1
fi
echo "  Node: $(node --version)"
echo "  npm:  $(npm --version)"

# ── 3. Whitelist USB printer (lp group) ──
echo "[3/5] Configuring USB printer access..."
usermod -a -G lp "$USER"

PRINTER_DEV="/dev/usb/lp0"
if [[ -c "$PRINTER_DEV" ]]; then
  echo "  Printer detected at $PRINTER_DEV ✓"
  chmod 666 "$PRINTER_DEV" 2>/dev/null || true
else
  echo "  WARNING: No printer at $PRINTER_DEV."
  echo "  Connect the thermal printer via USB and try again."
  echo "  The agent will start in preview mode (health check only)."
fi

# ── 4. Install project ──
echo "[4/5] Installing printer agent..."

mkdir -p "$INSTALL_DIR"
cp -r "$SCRIPT_DIR/src" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/package.json" "$SCRIPT_DIR/tsconfig.json" "$INSTALL_DIR/"

cd "$INSTALL_DIR"
npm install --no-audit --no-fund
npx tsup src/server.ts --format esm --platform node --target node20 --out-dir dist --clean
rm -rf src node_modules
npm install --omit=dev --no-audit --no-fund

chown -R "$USER:$USER" "$INSTALL_DIR"

# ── 5. systemd service ──
echo "[5/5] Installing systemd service..."
cp "$SCRIPT_DIR/$SERVICE_NAME.service" "$SERVICE_FILE"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo ""
echo "=== Installation complete ==="
echo "  Service: $SERVICE_NAME"
echo "  Port:    9300"
echo ""
echo "Commands:"
echo "  sudo systemctl status $SERVICE_NAME"
echo "  sudo journalctl -u $SERVICE_NAME -f"
echo "  curl http://localhost:9300/health"
echo ""
echo "IMPORTANT: Configure a static IP via DHCP reservation"
echo "on your router so the tablet can find this printer."
echo "Then set the PRINTER_AGENT_URL in the frontend .env to:"
echo "  http://<STATIC_IP>:9300"
