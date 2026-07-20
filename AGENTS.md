# AGENTS.md — Street Food Events

## ISTRUZIONI
Sistema di gestione di stand enogastronomici per eventi di street food. Utenti con ruoli diversi (applicativi, per evento e per stand). Autenticazione già implementata.

## File di riferimento — destinazione delle attività

I file di documentazione sono in `docs/`. Modifiche a questi file NON attivano un deploy su Render (grazie a Ignored Paths configurato sul dashboard).

| File | Destinazione | Cosa scriverci |
|---|---|---|
| `docs/CHANGELOG.md` | **Cronologia feature** | Ogni volta che una feature viene completata, aggiungere una entry in ordine cronologico (mese anno). Include sia la checklist feature che la session history dettagliata. |
| `docs/ARCHITECTURE.md` | **Decisioni progettuali** | Pattern architetturali, motivazioni delle scelte, "cose da non fare", gotchas che un agente AI deve conoscere per non ripetere errori. Aggiornare quando si introduce un nuovo pattern o si impara una lezione. |
| `docs/TODO.md` | **Task in sospeso** | Feature non ancora implementate, bug aperti, attività pianificate per il futuro. Spostare qui le entry da `docs/CHANGELOG.md` solo quando diventano obsolete, non quando sono completate. |
| `AGENTS.md` (questo file, radice) | **Setup operativo** | Istruzioni di base, comandi, struttura repo, API routes, deploy. NON contiene storia feature né progetti futuri — solo ciò che serve per operare OGGI. |

## Repo structure

Two independent npm packages (`backend/`, `frontend/`). No monorepo tool. The `printer-agent/` package was removed (Jul 2026) — thermal printer connects directly to Windows cash register machine via `window.print()`. The `photo-point/` Python app was removed (Jul 2026) — photo booth functionality now lives in `frontend/src/pages/PhotoBoothPage.tsx`.

## Backend (`backend/`)

Express + Mongoose + argon2 session auth (httpOnly cookie). ESM, TypeScript, Node ≥22.

### Commands

| Command | What |
|---|---|
| `npm run dev` | `tsx watch src/server.ts` |
| `npm run build` | `tsup src/server.ts --format esm --platform node --target node22 --out-dir dist --clean` |
| `npm run start` | `node dist/server.js` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `eslint .` |
| `npm run test` | `vitest run` (187 tests) |
| `npm run populate:database` | `tsx src/scripts/populate-database.ts` |
| `npm run reset:database` | `tsx src/scripts/reset-database.ts --password=<password>` |

### Gotchas
- MongoDB requires a replica set (`replicaSet=rs0`).
- Path alias: `@/*` maps to `./src/*`.
- Auth: httpOnly cookie `sid`, argon2.
- Env vars validated at startup via Zod.
- Cloudinary required.
- ESLint flat config.
- Entrypoint: `src/server.ts` → `src/app.ts` → `src/routes/`.

### Gotchas (backend — data layer)
- `EventUserTransaction.userId` is nullable (`default: null`). Anonymous EventUsers don't have a userId, so transactions for them store `userId: null`.
- `EventUserTransaction.realAmount` stores the EUR equivalent at time of transaction (for top-up: EUR input, for refund: credits input / exchangeRate).
- `Event.exchangeRate` defines how many event currency units = 1 EUR. Default 1 (1:1).
- `ContestPOI.groups` is an array of strings (`[String]`), not a single string. A POI can belong to multiple groups.
- `Contest.pickConfig` (`{ groupPicks: { group, count }[] }`) defines auto-pick rules per group. `Contest.autoPickedPOIIds` tracks which POIs were auto-selected. Manual POI additions are preserved when `pickConfig` changes.

### API routes
`GET /health` (no auth). All `/api/*` routes: GET are public except users/event-users/event-products/favorites/orders/upload. POST/PATCH/DELETE are protected.

### API routes — Alias
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/aliases?entityType=&entityRef=` | auth | Lista alias filtrata per entità |
| POST | `/api/aliases` | auth | Crea alias (text, entityType, entityRef) |
| PATCH | `/api/aliases/:aliasId` | auth | Modifica alias |
| DELETE | `/api/aliases/:aliasId` | auth | Elimina alias |
| GET | `/api/resolve/:entityType/:alias` | no | Risolve alias → entityId |

### API routes — Photos
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/events/:eventId/photos` | no | Lista foto evento |
| POST | `/api/events/:eventId/photos` | auth | Carica foto (multipart image) |
| DELETE | `/api/events/:eventId/photos` | photo-admin | Cancella tutte le foto |
| DELETE | `/api/events/:eventId/photos/:photoId` | auth | Cancella singola foto |

### API routes — Frames
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/events/:eventId/frames` | no | Lista cornici evento |
| POST | `/api/events/:eventId/frames` | photo-admin | Carica cornice (multipart image + name) |
| DELETE | `/api/events/:eventId/frames/:frameId` | photo-admin | Elimina cornice |

### Frontend — Alias routes
| Route | Element | Description |
|---|---|---|
| `/show/:entityType/:alias` | AliasRedirectPage | Redirect verso pagina reale |

### Frontend — Gallery route
| Route | Element | Description |
|---|---|---|
| `/events/:eventId/galleria` | EventGalleryPage | Galleria foto con stampa e selezione |
| `/events/:eventId/slideshow` | SlideshowPage | Slideshow automatico con rotazione e cornici |

### Frontend — Exchange route
| Route | Element | Description |
|---|---|---|
| `/events/:eventId/exchange` | EventExchangePage | Cambio valuta (crediti), solo exchange-admin / platform-admin |

### Frontend — Contest routes
| Route | Element | Description |
|---|---|---|
| Richieste API gestite da `EventDetailPage.tsx` nelle sezioni Contest POI, poi create/edit contest | | |

### API routes — Reports
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/orders/report/stand/:standId` | auth | Report per singolo stand (stand owner) |
| GET | `/orders/report/event/:eventId` | auth | Report evento aggregato per-stand (event-admin/event-cashier) |

### API routes — Cambio valuta
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/cambios/:eventId/users` | exchange-admin / platform-admin | Lista utenti cambio (auto-crea anonimo se mancante) |
| GET | `/api/cambios/:eventId/balance` | exchange-admin / platform-admin | Saldo cassa (top-up/refund aggregati) |
| GET | `/api/cambios/:eventId/transactions` | exchange-admin / platform-admin | Storico transazioni (paginato) |
| POST | `/api/cambios/:eventId/top-up` | exchange-admin / platform-admin | Carica crediti (reale → virtuale) |
| POST | `/api/cambios/:eventId/refund` | exchange-admin / platform-admin | Rimborsa crediti (virtuale → reale) |
| POST | `/api/cambios/:eventId/reset-cash-register` | exchange-admin / platform-admin | Azzera cassa |
| GET | `/api/cambios/:eventId/cash-register-reset` | exchange-admin / platform-admin | Data ultimo azzeramento |

### API routes — Contest POI
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/contests/contest-pois?eventId=` | contest-admin / platform-admin | Lista POI contest |
| POST | `/api/contests/contest-pois` | contest-admin / platform-admin | Crea POI contest (name, hint, groups[]) |
| PATCH | `/api/contests/contest-pois/:poiId` | contest-admin / platform-admin | Modifica POI contest |
| DELETE | `/api/contests/contest-pois/:poiId` | contest-admin / platform-admin | Elimina POI contest |

### API routes — Contests
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/contests?eventId=` | no | Lista contest pubblici |
| GET | `/api/contests/:contestId` | no | Dettaglio contest + POI |
| POST | `/api/contests/` | contest-admin / platform-admin | Crea contest (con pickConfig per auto-pick gruppi) |
| PATCH | `/api/contests/:contestId` | contest-admin / platform-admin | Modifica contest |
| DELETE | `/api/contests/:contestId` | contest-admin / platform-admin | Elimina contest |
| POST | `/api/contests/:contestId/scan` | no | Registra scansione POI |
| GET | `/api/contests/:contestId/participation/:participantId` | no | Stato partecipazione |
| PATCH | `/api/contests/:contestId/participation/:participantId/award` | contest-admin / platform-admin | Consegna premio |
| GET | `/api/contests/:contestId/poi-qrcodes` | contest-admin / platform-admin | QR code per ogni POI del contest |

## Frontend (`frontend/`)

React 19 + Vite 8 + TypeScript ~6.0 + SCSS Modules + React Router 7.

### Commands

| Command | What |
|---|---|
| `npm run dev` | `vite` (:5173) |
| `npm run build` | `tsc -b && vite build` |
| `npm run lint` | `eslint .` |
| `npm run test` | `vitest run` (16 tests) |

### Gotchas
- Vite proxy: `/api` → `http://127.0.0.1:4000`.
- No `@/*` alias — imports are relative.
- SCSS: `@use` for tokens, not `@import`.
- Build runs typecheck first (`tsc -b`).
- Auth: `AuthContext` + `apiRequest` with `credentials: 'include'`.
- Routing: `createBrowserRouter` in `src/router.tsx`.

## Render deploy

`render.yaml` configura due servizi web (backend + frontend), piano free, regione Frankfurt.

### Files esclusi dal deploy
Modifiche ai file in `docs/` non attivano un deploy. Imposta su Render dashboard per ogni servizio:
**Settings → Build Filters → Ignored Paths**: `docs/**`

## Session state (Jul 2026 — exchange rate + per-station reports)
### Completed
- `Event.exchangeRate` (Number, default 1, min 0.01) + create/update/response
- `EventUserTransaction.realAmount` (Number, nullable) per EUR tracking
- topUp: amount in EUR, credits = EUR × rate; refund: amount in credits, EUR = credits / rate
- getBalance: `myTopUp/Refund/NetBalance/Count` (per performedByUserId), `exchangeRate`
- listTransactions: `performedByName` from User model (populated per request)
- EventsPage form: "Tasso di cambio (1 € = X moneta)" field
- EventExchangePage: currency initial in circle (h1 only), EUR equiv via €
- Stat cards: "Tutte le postazioni" (all) + "Questa postazione" (current user)
- EUR fallback per vecchie transazioni (amount/rate se realAmount è null)
- "Saldo dopo" colonna: crediti + EUR equivalent

### API changes
- `POST /api/cambios/:eventId/top-up` — amount in EUR, credits = EUR × exchangeRate
- `POST /api/cambios/:eventId/refund` — amount in credits, EUR returned = credits / exchangeRate
- `GET /api/cambios/:eventId/balance` — response includes `exchangeRate`, `myTopUp`, `myRefund`, `myNetBalance`, `myTopUpCount`, `myRefundCount`, `mySinceResetTopUp`, `mySinceResetRefund`, `myNetSinceReset`
- `GET /api/cambios/:eventId/transactions` — response includes `performedByName` per item

### Next steps
- Trigger deploy on Render after latest pushes
- Verify exchange page end-to-end on production (rate, per-station, operator column)
