# App Locale Offline — `.local/`

Deployment dell'app su laptop per eventi senza connessione. Backend Express+Mongoose + MongoDB locale (replica set single-node) + frontend React servito statico.

## Stack
- `backend/` — API locale (Express + Mongoose, TypeScript, `tsx`)
- `frontend/` — UI (React + Vite), buildata e copiata in `backend/public`
- `docker-compose.yml` — container con MongoDB + seed + server su porta **4000**

## Porte
- API locale: **4000** (default). Override con `PORT`.
- Frontend dev (vite): **5173**, proxy `/api` → `http://127.0.0.1:4000`.
- Docker compose: `4000:4000`, `PORT=4000`.

## Distribuzione pronta all'uso — `../distro/`
L'immagine Docker già costruita è esportata in **`../distro/local-app.tar`** per installarla su un altro notebook senza compilare nulla (basta Docker Engine).

> **⚠️ IMPORTANTE — mantenere aggiornata l'immagine `distro/`**
> Ad **ogni modifica** ai sorgenti (backend `src`, frontend `src`, `Dockerfile`, `entrypoint.sh`, `docker-compose.yml`, `.env.example`) va **riesportata l'immagine**, altrimenti il notebook va in giro con una versione vecchia:
> ```
> docker compose up --build        # o: npm run local:up
> docker save local-app -o ../distro/local-app.tar
> ```
> Il file `distro/local-app.tar` NON deve restare indietro rispetto al codice: se una modifica non viene ribuildata, fare distro = distribuire una regressione.
>
> **Per gli agenti AI**: dopo aver modificato un sorgente di `.local/` (o `Dockerfile`/`entrypoint.sh`/compose/.env.example) e averlo **verificato funzionante**, rigenerare in automatico l'immagine con i comandi qui sopra (da `.local/`: `docker save local-app -o ../distro/local-app.tar`) e segnalare SEMPRE all'utente nel riepilogo finale se `distro/local-app.tar` è stata rigenerata o se serve rigenerarla. Se la modifica non è verificata o l'utente chiede di saltare, NON rigenerare ma segnalarlo in modo evidente.

### Installazione su notebook (Docker Engine)
```
# sul notebook
docker load -i local-app.tar
docker run -d --name streetfood-events-local \
  -p 4000:4000 \
  -e PORT=4000 -e MACHINE_ID=notebook-demo \
  -e REMOTE_URL=https://streetfoodevents-api.onrender.com/api \
  -e REMOTE_TOKEN=<condiviso con SYNC_API_TOKEN cloud> \
  -e SEED=1 \
  -v mongo-data:/data/db \
  -v local-media:/data/media \
  local-app
```
Poi apri `http://localhost:4000` e importa evento/stand dal pannello Sync (i volumi partono vuoti, il seed crea i dati demo di partenza).

## Avvio rapido
### Deploy (tutto-in-uno, consigliato)
Un solo comando costruisce e avvia l'app completa (MongoDB replica set + seed + API + UI statica):
```
npm run local:up        # = docker compose up --build
```
Poi apri `http://localhost:4000`. Le variabili si impostano copiando `.env.example` → `.env`. Per fermare tutto: `npm run local:down`.

#### Variabili di deploy (via `.env` accanto al compose)
| Var | Default |
|---|---|
| `PORT` | `4000` |
| `MACHINE_ID` | `prototipo-demo` |
| `REMOTE_URL` | `https://streetfoodevents-api.onrender.com/api` |
| `REMOTE_TOKEN` | (vuoto) |
| `SEED` | `1` |
| `ASSETS_URL_PREFIX` | `/assets` |

### Sviluppo (senza Docker per l'app)
Un MongoDB dedicato (via Docker) + seed + backend/frontend dev in un solo comando:
```
npm run setup:local
```
MongoDB gira nel container di `docker-compose.db.yml` (replica set `rs0`, porta 27017); backend su :4000 e frontend vite su :5173.

## Variabili d'ambiente (backend locale)
| Var | Default | Descrizione |
|---|---|---|
| `PORT` | `4000` | Porta API |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/street-food-events-local?replicaSet=rs0` | URI Mongo (richiede replica set `rs0`) |
| `MACHINE_ID` | `laptop-local-default` | Identificativo macchina |
| `REMOTE_URL` | `https://streetfoodevents-api.onrender.com/api` | Base URL del backend cloud, es. `https://streetfoodevents-api.onrender.com/api` |
| `REMOTE_TOKEN` | (vuoto) | Bearer token per le API `/api/sync` del cloud (deve combaciare con `SYNC_API_TOKEN` sul cloud) |
| `MEDIA_DIR` | `<cwd>/.local-assets` | Cartella in cui vengono scaricate le immagini durante l'import |
| `ASSETS_URL_PREFIX` | `/assets` | Prefisso URL dell'endpoint statico per le immagini locali |

## Sync remoto
1. Nel pannello **Sync** selezionare l'evento remoto → lo stand remoto.
2. Se esistono modifiche locali non sincronizzate, il pannello richiede di **pushearle** (`/api/sync/push`) prima dell'import.
3. **Import**: scarica lo snapshot remoto, sostituisce TUTTI i dati locali e **scarica in locale** le immagini di evento/stand/prodotto (puntate a `/assets/*`, cartella `MEDIA_DIR`). Le immagini locali non vengono MAI rimandate al cloud.

### Configurazione cloud (sorgente di verità)
Sul backend cloud va impostata la variabile `SYNC_API_TOKEN` (stessa value di `REMOTE_TOKEN` locale). Le API `/api/sync` sono accessibili solo con `Authorization: Bearer <token>`.

## Comandi (backend locale)
| Comando | Cosa |
|---|---|
| `npm run dev` | `tsx watch src/server.ts` |
| `npm start` | `tsx src/server.ts` |
| `npm run seed` | `tsx src/seed.ts` (seme demo) |
| `npm run typecheck` | `tsc --noEmit` |

## Comandi (frontend locale)
| Comando | Cosa |
|---|---|
| `npm run dev` | vite dev (:5173) |
| `npm run build` | `vite build` → `dist/` (poi copiare in `backend/public`) |
