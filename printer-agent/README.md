# Street Food Events — Printer Agent

Agente di stampa ESC/POS per stampanti termiche. Riceve job di stampa via HTTP e li invia alla stampante USB collegata a un Raspberry Pi.

## Architettura

```
Tablet (cassa, Chrome Android)  ──WiFi──▶  Raspberry Pi 2 Model B (:9300)  ──USB──▶  Stampante termica
                                                                                        (ESCPOS compatibile)
```

- **Generazione ESC/POS sul Pi** — zero dipendenze native, funziona offline
- **Fallback frontend**: se l'agente non è raggiungibile, si usa `window.print()`
- **IP statico**: DHCP reservation sul router, niente mDNS

## Requisiti hardware

| Componente              | Specifica                                              |
|-------------------------|--------------------------------------------------------|
| Raspberry Pi            | **2 Model B** (o superiore: 3B, 3B+, 4B, Zero 2 W)    |
| Architettura           | ARMv7 (Pi 2) o ARMv8 (Pi 3+)                          |
| Scheda SD               | ≥8 GB, Classe 10 consigliata                           |
| Stampante termica       | Compatibile ESC/POS, USB (es. Epson TM-T20, TM-T88)   |
| Cavo USB                | Tipo A–B (per stampante)                               |
| Connettività            | Ethernet (Pi 2 ha RJ45) o WiFi con dongle USB          |

> **Pi 2 Model B note**: Ha Ethernet integrata (100Mbps) — ideale per connessione stabile.
> Se serve WiFi, usare un dongle USB WiFi o considerare Pi 3B/Zero 2 W con WiFi integrato.

## Prerequisiti software

- **Raspberry Pi OS** (Debian Bookworm, 64-bit consigliato)
  - Download: https://www.raspberrypi.com/software/
  - User: `pi` (default)
- **Node.js ≥ 20** (installato automaticamente dallo script)

## Installazione rapida

```bash
# 1. Clona il repository sul Pi
git clone https://github.com/NelloRizzo/StreetFoodEvents.git
cd StreetFoodEvents/printer-agent

# 2. Esegui lo script di installazione (come root)
sudo bash install.sh
```

Lo script esegue automaticamente:
1. Installa Node.js 22 via NodeSource
2. Aggiunge l'utente `pi` al gruppo `lp` (accesso stampante USB)
3. Compila il progetto TypeScript
4. Installa il servizio systemd e lo avvia

## Installazione manuale

```bash
# Dipendenze di sistema
sudo apt-get update
sudo apt-get install -y curl gnupg ca-certificates

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs

# Gruppo stampante
sudo usermod -a -G lp pi

# Progetto
cd printer-agent
npm install
npm run build

# Servizio systemd
sudo cp streetfood-printer-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable streetfood-printer-agent
sudo systemctl start streetfood-printer-agent
```

## Configurazione rete (fondamentale)

Il Pi deve avere un **IP statico** perché il tablet (cassa) lo trovi sempre.

### Opzione 1: DHCP Reservation (consigliata)

1. Accedi all'interfaccia del tuo router (di solito `192.168.1.1`)
2. Trova la sezione "DHCP Reservation" o "Static DHCP"
3. Associa l'indirizzo MAC del Pi a un IP fisso (es. `192.168.1.200`)
4. Applica e riavvia il Pi

### Opzione 2: IP statico su Raspberry Pi OS

```bash
sudo nmcli con mod "Wired connection 1" \
  ipv4.addresses 192.168.1.200/24 \
  ipv4.gateway 192.168.1.1 \
  ipv4.dns 8.8.8.8 \
  ipv4.method manual
sudo nmcli con up "Wired connection 1"
```

## Collegamento stampante USB

1. Collega la stampante termica al Pi via USB
2. Verifica che sia riconosciuta:

```bash
ls -l /dev/usb/lp*
# Dovresti vedere /dev/usb/lp0

# Prova a stampare un test
echo -e "Hello Street Food\n\n\n" | sudo tee /dev/usb/lp0
```

Se `/dev/usb/lp*` non appare:
- Controlla il cavo USB
- Verifica che la stampante sia accesa
- Controlla `dmesg | grep usb` per eventuali errori

## API

### `GET /health`

Restituisce lo stato della stampante:

```json
{
  "online": true,
  "printer": "/dev/usb/lp0",
  "label": "thermal"
}
```

### `POST /print`

Invia un job di stampa:

```json
{
  "copies": 1,
  "content": {
    "type": "order",
    "title": "Ordine #42",
    "lines": [
      { "align": "center", "text": "Street Food Events", "bold": true, "size": "double" },
      { "kind": "separator" },
      { "align": "left", "text": "Panino con porchetta x2", "bold": false },
      { "align": "right", "text": "€12.00", "bold": true },
      { "kind": "blank", "lines": 1 },
      { "align": "right", "text": "TOTALE: €24.00", "bold": true, "size": "double" },
      { "kind": "separator" },
      { "kind": "qrcode", "data": "https://streetfood.example.com/receipt/abc123" },
      { "kind": "blank", "lines": 2 },
      { "kind": "cut" }
    ]
  }
}
```

### `POST /preview`

Come `/print` ma non invia alla stampante — restituisce il raw ESC/POS in base64 (utile per debug).

## Tipi di linea supportati

| Tipo         | Campi                                   | Descrizione                          |
|--------------|-----------------------------------------|--------------------------------------|
| Testo        | `align`, `text`, `bold`, `size`         | Riga di testo                        |
| `separator`  | `char` (default: `─`)                   | Linea di separazione                 |
| `blank`      | `lines` (default: 1)                    | Righe vuote                         |
| `barcode`    | `data`, `type` (code128/code39/ean13)   | Barcode                              |
| `qrcode`     | `data`                                  | QR Code                              |
| `cut`        | —                                       | Taglio carta                         |
| `beep`       | —                                       | Beep sonoro (se supportato)          |

## Comandi utili

```bash
# Stato servizio
sudo systemctl status streetfood-printer-agent

# Log in tempo reale
sudo journalctl -u streetfood-printer-agent -f

# Riavvio servizio
sudo systemctl restart streetfood-printer-agent

# Test salute
curl http://localhost:9300/health

# Test stampa
curl -X POST http://localhost:9300/print \
  -H "Content-Type: application/json" \
  -d '{"content":{"lines":[{"text":"TEST STAMPA","bold":true,"align":"center"},{"kind":"cut"}]}}'
```

## Integrazione frontend

Nel frontend, aggiungere al `.env`:

```env
VITE_PRINTER_AGENT_URL=http://192.168.1.200:9300
```

Il frontend tenta di inviare il job all'agente; se non risponde entro 3 secondi, usa `window.print()` come fallback.

## Troubleshooting

| Problema                          | Causa probabile                          | Soluzione                                      |
|-----------------------------------|------------------------------------------|-------------------------------------------------|
| `/dev/usb/lp0` non esiste         | Stampante non riconosciuta               | `dmesg | grep usb`, ricabla, riaccendi          |
| `Permission denied` su `/dev/usb/lp0` | Utente non nel gruppo `lp`           | `sudo usermod -a -G lp pi`, riavvia             |
| Agente non raggiungibile          | IP cambiato                              | Usa DHCP reservation, non IP dinamico           |
| Stampa caratteri illegibili       | Driver sbagliato o charset               | Verifica compatibilità ESC/POS della stampante  |
| Servizio non parte                | Node.js mancante o versione sbagliata     | `node --version` deve essere ≥20                |
| Stampa tagliata                   | Buffer troppo piccolo                     | Il Pi 2 ha 1GB RAM — ample per job tipici       |
| Beep non funziona                 | Stampante senza buzzer                   | Ignorare, è opzionale                           |

## Testing senza stampante termica

Puoi testare l'agente in tre modalità senza avere una stampante collegata.

### Modalità 1: File mode (consigliata)

I job di stampa vengono salvati come file `.bin` nella cartella `prints/`.

```bash
# Avvia in modalità file
PRINTER_MODE=file npm run dev

# Oppure via env var
export PRINTER_MODE=file
npm run dev
```

Ogni stampa genera un file `prints/print-<timestamp>.bin` con i byte ESC/POS grezzi.
Usa `POST /preview/text` per vedere l'anteprima in testo leggibile.

### Modalità 2: No-op mode

Nessun dato viene scritto — utile per testare il flusso HTTP.

```bash
PRINTER_MODE=none npm run dev
```

### Modalità 3: Interfaccia web di test

Avvia il server in qualsiasi modalità e apri:

```
http://localhost:9300/test
```

L'interfaccia permette di:
- Inviare una stampa di test
- Vedere l'anteprima testo (cosa verrebbe stampato)
- Vedere il raw ESC/POS in base64
- Modificare il JSON del job e inviarlo
- Caricare uno scontrino d'esempio precompilato

### Esempio rapido via curl

```bash
# Anteprima testo (leggibile)
curl -s -X POST http://localhost:9300/preview/text \
  -H "Content-Type: application/json" \
  -d '{"content":{"title":"Test","lines":[{"align":"center","text":"CIAO!","bold":true,"size":"double"},{"kind":"cut"}]}}' \
  | jq -r '.text'
```

## Riferimenti

- [ESC/POS Command Reference (Epson)](https://download.epson-biz.com/modules/pos/index.php)
- [Raspberry Pi 2 Model B specs](https://www.raspberrypi.com/products/raspberry-pi-2-model-b/)
- [Node.js su ARM](https://github.com/nodesource/distributions)
