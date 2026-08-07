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
- `Contest.orderedPOIIds` can contain **duplicates** — the same POI ID can appear multiple times. `scannedPOIIds` also stores duplicates (one entry per scan). Completion = `scannedPOIIds.length === orderedPOIIds.length` (total slots, NOT unique count). Do NOT use `Set` or `includes()` to check if a specific occurrence has been scanned — use occurrence-based counting (see ARCHITECTURE.md).
- `StandSettlement` stores computed euro values (`grossEuro`/`feeEuro`/`payoutEuro`) + `exchangeRate` snapshot. `amount` (crediti) è libero — il report stand è solo informativo, nessun check di saldo residuo. Le liquidazioni NON entrano in `getBalance`.

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

### Frontend — Stand display route
| Route | Element | Description |
|---|---|---|
| `/events/:eventId/stands/:standId/ordersqueue` | StandDisplayPage | Coda Ordini: display fullscreen pubblico ordini in lavorazione (auto-refresh 5s) |

### Frontend — Exchange route
| Route | Element | Description |
|---|---|---|
| `/events/:eventId/exchange` | EventExchangePage | Cambio valuta (crediti), solo exchange-admin / platform-admin |
| `/events/:eventId/settlements` | StandSettlementsPage | Liquidazione stand (crediti → euro con percentuale trattenuta), solo exchange-admin / platform-admin |
| `/events/:eventId/settlements/report` | SettlementsReportPage | Resoconto liquidazioni aggregato per evento (stampa + filtro date), solo exchange-admin / platform-admin |

### Frontend — Contest routes
| Route | Element | Description |
|---|---|---|
| Richieste API gestite da `EventDetailPage.tsx` nelle sezioni Contest POI, poi create/edit contest | | |

### API routes — Orders
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/orders/stand/:standId/ordersqueue` | no | Coda Ordini: ordini confirmed/preparing/ready (minimi dati, niente prezzi/clienti) |
| GET | `/api/orders` | auth | Lista ordini (filtri eventId, standId, status comma-separated, userId, customerId, stationId, date) |
| POST | `/api/orders/event/:eventId/reset` | platform-admin | Reset completo evento: elimina ordini, TUTTE le transazioni (acquisti + cambio), liquidazioni stand, azzera saldi portafogli, contatori e `cashRegisterResetAt`. In transazione. |

### API routes — Reports
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/orders/report/stand/:standId` | auth | Report per singolo stand (stand owner) |
| GET | `/orders/report/event/:eventId` | auth | Report evento aggregato per-stand (event-admin/event-cashier) |

### API routes — Cambio valuta
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/exchange/:eventId/users` | exchange-admin / platform-admin | Lista utenti cambio (auto-crea anonimo se mancante) |
| GET | `/api/exchange/:eventId/balance` | exchange-admin / platform-admin | Saldo cassa (top-up/refund aggregati) |
| GET | `/api/exchange/:eventId/transactions` | exchange-admin / platform-admin | Storico transazioni (paginato) |
| POST | `/api/exchange/:eventId/top-up` | exchange-admin / platform-admin | Carica crediti (reale → virtuale) |
| POST | `/api/exchange/:eventId/refund` | exchange-admin / platform-admin | Rimborsa crediti (virtuale → reale) |
| GET | `/api/exchange/:eventId/settlements/summary` | exchange-admin / platform-admin | Riepilogo crediti guadagnati/liquidati per stand (informativo) |
| GET | `/api/exchange/:eventId/settlements/report` | exchange-admin / platform-admin | Resoconto aggregato liquidazioni per stand (numero, crediti, lordo/trattenuta/erogato €, residuo), filtro `from`/`to`, totali evento |
| GET | `/api/exchange/:eventId/settlements` | exchange-admin / platform-admin | Storico liquidazioni stand (paginato, filtro standId) |
| POST | `/api/exchange/:eventId/settlements` | exchange-admin / platform-admin | Crea liquidazione stand (standId, amount crediti libero, feePercent default 0) |
| POST | `/api/exchange/:eventId/guests` | exchange-admin / platform-admin | Crea cliente al volo (displayName opzionale) |
| POST | `/api/exchange/:eventId/reset-cash-register` | exchange-admin / platform-admin | Azzera cassa |
| GET | `/api/exchange/:eventId/cash-register-reset` | exchange-admin / platform-admin | Data ultimo azzeramento |

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
| POST | `/api/contests/:contestId/complete` | no | Completa partecipazione (premia, classifica) |
| GET | `/api/contests/:contestId/participation/:participantId` | no | Stato partecipazione |
| PATCH | `/api/contests/:contestId/participation/:participantId/award` | contest-admin / platform-admin | Consegna premio |
| GET | `/api/contests/:contestId/poi-qrcodes` | contest-admin / platform-admin | QR code per ogni POI del contest |

### API routes — Email Subscriptions
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/email-subscriptions` | no | Subscribe (crea/aggiorna consenso per email) |
| POST | `/api/email-subscriptions/unsubscribe` | no | Disiscrizione by email |
| GET | `/api/email-subscriptions` | platform-admin | Lista iscrizioni (paginata, filtrabile per eventId/isActive/search) |
| DELETE | `/api/email-subscriptions/:id` | platform-admin | Cancella iscrizione |

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

## Session state (Aug 2026 — menu pubblico stand con immagini)
### Completed
- `EventStandMenuPage` (`/events/:eventId/stands/:standId`): `Stand.coverImage` mostrata come banner cover in testata e come logo circolare accanto al titolo; thumbnail `product.coverImage` per ogni voce di menu. Lo Stand ha un SOLO campo immagine (`coverImage`) — niente logo separato.

## Session state (Aug 2026 — resoconto liquidazioni per evento)
### Completed
- Endpoint `GET /api/exchange/:eventId/settlements/report` (exchange-admin / platform-admin): aggrega per stand tutte le liquidazioni (`StandSettlement`) — numero, crediti liquidati, lordo €, trattenuta €, erogato € — più colonne di riferimento `earnedCredits` (dal report ordini, intero evento) e `remainingCredits`. Supporta filtro `from`/`to` su `occurredAt` (le colonne di riferimento restano per tutto l'evento). Totali evento inclusi.
- `SettlementsReportPage` su `/events/:eventId/settlements/report`: riepilogo con card totali, tabella per stand con riga TOTALE, filtro date e pulsante stampa (stili print in `EventReportPage.module.scss`). Riusa i moduli SCSS di `EventReportPage`.
- Navigazione: link "Resoconto liquidazioni" nella header di `StandSettlementsPage` e nella sezione Cambio valuta di `EventDetailPage`.
- Test: `integration-settlements.test.ts` (report aggregato con euro, filtro date, evento vuoto).

## Session state (Aug 2026 — moneta evento + resoconti in euro)
### Completed
- `CurrencyDisplay` condiviso (`frontend/src/components/CurrencyDisplay.tsx` + `.module.scss`): icona moneta (immagine `currencySymbol.url` o iniziale di `currencyName` in circoletto). Helper `currencyInitial(name)` e `currencyBadgeHtml(name)` per HTML inline (stampa).
- Moneta evento visibile in: DashboardPage, EventStandMenuPage, NewOrderPage, CashierOrderPage, EventCashierPage (cassa unica), OrderDetailPage, ReceiptPage (stampa + schermo), OrdersPage, EventOrdersPage, StandOrdersPage, MenuPrintPage, EventProductsPage, StandDetailPage, EventUsersPage, EventDetailPage.
- Resoconto in euro: `fmt(n, rate)` divide per rate in `EventReportPage`; `StandOrdersPage` report con `(value / (report.exchangeRate ?? 1))`. Backend `getEventReport` seleziona `exchangeRate`; `getStandReport` carica l'evento e restituisce `currencyName`/`currencySymbol`/`exchangeRate`.
- `lib/orders.ts`: tipi `StandReport`/`EventReport` includono `currencyName`/`currencySymbol`/`exchangeRate`; `StandReport` ha anche `eventId`.
- Ordini multi-evento (OrdersPage/StandOrdersPage senza filtro evento): moneta risolta dal fetch `/events` per eventId, fallback alla moneta del report se filtro attivo.
- Backend `getOrderReceipt` seleziona `currencyName currencySymbol` e risposta include `eventId`, `currencyName`, `currencySymbol`.

## Session state (Aug 2026 — liquidazione stand)
### Completed
- Modello `StandSettlement` (`backend/src/models/stand-settlement.model.ts`): `eventId`, `standId`, `standName` (denormalizzato), `amount` (crediti, libero), `exchangeRate` (snapshot), `feePercent` (0-100), `grossEuro`/`feeEuro`/`payoutEuro` (calcolati e memorizzati), `description`, `performedByUserId`, `occurredAt`.
- API: `GET /api/exchange/:eventId/settlements/summary` (crediti guadagnati dai report + già liquidati per stand — SOLO informativo), `GET /api/exchange/:eventId/settlements` (storico paginato con totali), `POST /api/exchange/:eventId/settlements` (crea liquidazione, nessun check di saldo residuo). Guard: `exchange-admin`/`platform-admin`.
- `StandSettlementsPage` su `/events/:eventId/settlements`: selezione stand, importo presentato (default = crediti guadagnati dal report, modificabile), percentuale trattenuta (default 0), anteprima in euro (lordo ÷ cambio, trattenuta, da corrispondere), storico con totali.
- Navigazione: link in `EventDetailPage` (sezione Cambio valuta), in `EventExchangePage` header, e in `DashboardPage` (Gestione wallet, per evento con ruolo exchange-admin).
- Test: `backend/src/__tests__/controllers/integration-settlements.test.ts` (9 test). `exchangeRouter` montato in `createTestApp`; collezione `standsettlements` aggiunta al reset di setup.ts.

## Session state (Aug 2026 — postazione clienti stand display)
### Completed
- Endpoint pubblico `GET /api/orders/stand/:standId/ordersqueue` (confirmed/preparing/ready, minimi dati: niente prezzi, nomi clienti o pagamenti)
- `StandDisplayPage` fullscreen pubblico su `/events/:eventId/stands/:standId/ordersqueue` (polling 5s, avanzamento articoli per postazione, badge "Pronto")
- `hideChrome` in AppLayout include le route `/display` (navbar e footer nascosti)
- Link "Coda Ordini" (nuova tab) nella header di `StandOrdersPage` e nella dashboard operatore
- Helper `fetchStandDisplayOrders` in `frontend/src/lib/orders.ts`
- Test backend: filtro stati, esclusione pending/completed, 404 stand inesistente
- I comandi display NON sono protetti: la route è registrata PRIMA di `authMiddleware` in `orders.routes.ts`

## Session state (Aug 2026 — reset evento + cambio auto-select + POI centrato)
### Completed
- `POST /api/orders/event/:eventId/reset` (platform-admin): in transazione elimina ordini, TUTTE le `EventUserTransaction` (acquisti + cambio), le `StandSettlement`, azzera i saldi `EventUser`, elimina i `Counter` degli stand e azzera `Event.cashRegisterResetAt`. Implementato in `resetEventOrders` (orders.controller.ts) con await SEQUENZIALI dentro la transazione — MAI `Promise.all` su operazioni con session Mongo (flaky: 500 intermittente).
- UI doppia conferma in `EventDetailPage`: bottone "Azzera ordini" → modale riepilogo → modale `prompt` che richiede la digitazione di "AZZERA". Test: `integration-order-reset.test.ts` (3 test).
- `EventExchangePage`: al caricamento, se nessun utente è selezionato viene selezionato di default il Cliente Generico (`isAnonymous`); il pulsante "+ Crea" seleziona automaticamente il nuovo cliente creato (usa `res.item.id`). Ref `selectedUserIdRef` per evitare closure stantie in `fetchData`.
- `MapPicker`: se non ci sono coordinate valide ma c'è `resetCenter`, usa `resetCenter` come centro iniziale + posizione marker e precompila le coordinate via `onChange` (fallback a Roma solo se niente `resetCenter`). Il form "Nuovo POI" di `EventDetailPage` passa le coordinate dell'evento come `resetCenter` con label "Centra sull'evento".

## Session state (Jul 2026 — email subscription + fix cassa ordini)
### Completed
- EmailSubscription model + CRUD API (pubblica subscribe, admin list/delete)
- `sendEventPhotoEmail` registra email + consenso marketing dopo invio
- ConfirmModal: checkbox consenso privacy per prompt mode
- EventGalleryPage: consenso marketing nel modale email
- docs/INFORMATIVA_PRIVACY_EMAIL.md (GDPR + modulo firmabile)
- `listOrders` / `listMyStationOrders`: supporto comma-separated per `?status=`
- `CashierOrderPage`: ordine avanza a `preparing` dopo creazione
- `CashierOrderPage`: mostra ordini `preparing` + `ready` (non solo `ready`)
- BUG: due pagine cassa (`CashierOrderPage` e `EventCashierPage`) avevano logica diversa — allineata
