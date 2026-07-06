#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="streetfood-printer-agent"

echo "=== Street Food Events — Printer Agent ==="

case "${1:-status}" in
  start)
    echo "Avvio del servizio..."
    sudo systemctl start "$SERVICE_NAME"
    sudo systemctl status --no-pager "$SERVICE_NAME"
    ;;
  stop)
    echo "Arresto del servizio..."
    sudo systemctl stop "$SERVICE_NAME"
    ;;
  restart)
    echo "Riavvio del servizio..."
    sudo systemctl restart "$SERVICE_NAME"
    sleep 1
    curl -s http://localhost:9300/health || echo "In attesa del servizio..."
    ;;
  status)
    sudo systemctl status --no-pager "$SERVICE_NAME"
    ;;
  logs)
    sudo journalctl -u "$SERVICE_NAME" -n 50 --no-pager -f
    ;;
  health)
    curl -s http://localhost:9300/health || echo "Servizio non raggiungibile"
    ;;
  *)
    echo "Uso: $0 {start|stop|restart|status|logs|health}"
    exit 1
    ;;
esac
