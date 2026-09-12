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

App locale offline in `.local/` (backend+frontend+seed in un solo container, vedi `.local/README.md`). Distribuzione su notebook tramite immagine esportata in `distro/local-app.tar` (cartella **gitignorata**). **Regola operativa**: ad ogni modifica ai sorgenti di `.local/` (o `Dockerfile`/`entrypoint.sh`/compose), una volta verificato `docker compose up --build` (o `npm run local:up`), rieseguire `docker save local-app -o distro/local-app.tar` — mai lasciare l'immagine indietro rispetto al codice.

**DO WHAT THE USER ASKED**: whenever a session touches a source file under `.local/` (or `Dockerfile`/`entrypoint.sh`/compose/.env.example) and the change is verified working, the agent MUST: (1) explicitly tell the user in the final summary that `distro/local-app.tar` needs regeneration (or was regenerated); (2) regenerate the image automatically by running `docker compose up --build` / `npm run local:up` followed by `docker save local-app -o ../distro/local-app.tar` (from `.local/`), unless the changes are still unverified or the user asks to skip. If a change makes the image stale without the agent regenerating it, note it prominently so the user can decide.

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
- `StandSettlement.direction` è `'debit' | 'credit'` (default `'credit'`). `'debit'` (DARE) = carico crediti allo stand, NESSUN pagamento in euro (`grossEuro`/`feeEuro`/`payoutEuro` = 0, `feePercent` ignorato e forzato a 0); `'credit'` (AVERE) = liquidazione con pagamento in euro. `toReturnCredits` (da restituire) = caricati − liquidati, mai negativo. Record esistenti senza `direction` valgono come `'credit'` (`$ifNull` negli aggregate).

### API routes
`GET /health` (no auth). All `/api/*` routes: GET are public except users/event-users/event-products/favorites/orders/upload. POST/PATCH/DELETE are protected.

### API routes — Auth & utenti
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/activate` | no | Attiva account su invito: body `{ token, password }` (≥8), imposta passwordHash (argon2) + isActive, invalida il token |
| POST | `/api/users` | auth | SOLO invito: niente password — crea utente inattivo con token attivazione (SHA-256, 7 giorni) e invia email `${CLIENT_URL}/attiva/:token`; se Brevo non configurata → 201 con `emailSent: false` + `activationUrl` |
| POST | `/api/users/:userId/resend-invite` | auth | Rigenera token attivazione e reinvia email (400 se già attivato) |

Login: utente inattivo o senza password → 403 con messaggio distinto ("non ancora attivato" vs "disattivato"). `passwordHash` è nullable.

### API routes — Events
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/events?public=true` | optional | Lista eventi pubblici e non terminati (`endDate >= now`). Senza `public=true`: tutti gli eventi (solo gestori/platform). |
| GET | `/api/events/:eventId/menu-qrcode` | no | QR code (data URL) che linka al menu del primo stand visibile (`showOnMap !== false`) dell'evento. 404 se nessuno stand visibile. |
| POST | `/api/events/:eventId/duplicate` | auth | Duplica l'evento come base operativa per la prossima edizione: copia configurazione (moneta, tema, fasce, tagli, categorie), collega gli stand con rinumerazione progressiva, copia EventProduct e POI. NON copia wallet/ordini/transazioni/foto/contest, né le scadenze `participationFeeDeadline`/`depositDeadline` (nuova edizione → null). Body opzionale `{ name, startDate, endDate, isPublic }` (default: nome+" (copia)", date +1 anno). |

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
| GET | `/api/events/:eventId/photos` | no | Lista media evento (foto e video) |
| POST | `/api/events/:eventId/photos` | no (immagini) / auth (video) | Carica media: multipart con campo `image` (foto, 10 MB, anche anonimo) oppure `video` (fino a 100 MB, richiede auth — anonimo → 401) |
| POST | `/api/events/:eventId/photos/send-email` | photo-print / photo-admin / platform-admin | Invia più foto selezionate a un unico indirizzo email (body: `email`, `photoIds[]`, `marketingConsent`) |
| POST | `/api/events/:eventId/photos/:photoId/send-email` | photo-print / photo-admin / platform-admin | Invia una singola foto via email (body: `email`, `marketingConsent`) |
| DELETE | `/api/events/:eventId/photos` | photo-admin | Cancella tutte le foto/video (delete Cloudinary con `resource_type` corretto) |
| DELETE | `/api/events/:eventId/photos/:photoId` | auth | Cancella singola foto/video |

### API routes — Frames
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/events/:eventId/frames` | no | Lista cornici evento |
| POST | `/api/events/:eventId/frames` | photo-admin | Carica cornice (multipart image + name) |
| DELETE | `/api/events/:eventId/frames/:frameId` | photo-admin | Elimina cornice |

### API routes — Pubblicazione social
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/photos/mine` | auth | Foto scattate dall'utente autenticato, raggruppate per evento (max 30 per evento, thumbnail generate server-side) |
| GET | `/api/events/:eventId/social/config` | photo-admin / platform-admin | Piattaforme configurate (`{ facebook, instagram }`) |
| POST | `/api/events/:eventId/social/posts` | photo-admin / platform-admin | Accoda pubblicazione: body `{ photoIds[], platforms[], caption? }`. Solo immagini (video → 400); foto di altro evento → 404; piattaforma non configurata → post con `status: 'failed'` immediato |
| GET | `/api/events/:eventId/social/posts?ids=a,b` | photo-admin / platform-admin | Stato dei post social (polling esito) |

Pubblicazione Meta: account UNICO della piattaforma via env opzionali `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`, `META_IG_USER_ID` (Facebook Page + Instagram professional, variante Facebook Login su graph.facebook.com). Coda in-process con worker `setInterval` avviato da `server.ts`; retry max 3 con backoff. Se le env non sono impostate la feature resta silenziosamente disattivata.

### Frontend — Alias routes
| Route | Element | Description |
|---|---|---|
| `/show/:entityType/:alias` | AliasRedirectPage | Redirect verso pagina reale |
| `/attiva/:token` | ActivationPage | Attivazione account su invito: imposta password, attiva utente |

### Frontend — Gallery route
| Route | Element | Description |
|---|---|---|
| `/events/:eventId/galleria` | EventGalleryPage | Galleria foto con stampa, selezione, invio email e pubblicazione social |
| `/events/:eventId/slideshow` | SlideshowPage | Slideshow automatico con rotazione e cornici |
| `/events/:eventId/menu` | EventMenuPage | Menù pubblico dell'evento: vista per stand o per categorie, ordine alfabetico |

### Frontend — Stand display route
| Route | Element | Description |
|---|---|---|
| `/events/:eventId/stands/:standId/ordersqueue` | StandDisplayPage | Coda Ordini: display fullscreen pubblico ordini in lavorazione (auto-refresh 5s) |

### Frontend — Adesione stand
| Route | Element | Description |
|---|---|---|
| `/events/:eventId/stand-adhesion` | StandAdhesionWizardPage | Wizard adesione PUBBLICO (anche anonimo, solo stand nuovi; gate regolamento, ripresa via access token in localStorage) |
| `/admin/events/:eventId/stand-adhesion` | StandAdhesionWizardPage | Stesso wizard sotto AdminLayout (admin evento / owner stand) |
| `/admin/events/:eventId/adhesions` | AdhesionsManagePage | Gestione/approvazione adesioni (solo event-admin; platform-admin escluso) |
| `/admin/events/:eventId/adhesion-form` | AdhesionFormManagePage | Modulo di adesione generato dall'evento (stampa/gestione) |
| `/events/:eventId/adhesion-form` | AdhesionFormPublicPage | Modulo di adesione stampabile pubblico |

### Frontend — Exchange route
| Route | Element | Description |
|---|---|---|
| `/events/:eventId/exchange` | EventExchangePage | Cambio valuta (crediti), solo exchange-admin / platform-admin |
| `/events/:eventId/settlements` | StandSettlementsPage | Liquidazione stand (crediti → euro con percentuale trattenuta), solo exchange-admin / platform-admin |
| `/events/:eventId/settlements/report` | SettlementsReportPage | Resoconto liquidazioni aggregato per evento (stampa + filtro date), solo exchange-admin / platform-admin |

### Frontend — Contest routes
| Route | Element | Description |
|---|---|---|
| `/admin/events/:eventId/contest-manage` | EventContestManagePage | Gestione contest (POI contest, contest, avvio/stop, stampa QR), solo contest-admin / platform-admin |
| Richieste API gestite da `EventDetailPage.tsx` nelle sezioni Contest POI, poi create/edit contest | | |

### API routes — Orders
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/orders/stand/:standId/ordersqueue` | no | Coda Ordini: ordini confirmed/preparing/ready (minimi dati, niente prezzi/clienti) |
| GET | `/api/orders/gift-stats?eventId=&standId=` | auth | Contatore omaggi per stand/evento (totalOrders, giftOrders, giftPercentage, giftThreshold=5, thresholdExceeded). Conta solo ordini non cancellati. Registrata PRIMA di `/:orderId` |
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
| GET | `/api/exchange/:eventId/balance` | exchange-admin / platform-admin | Saldo cassa (top-up/refund aggregati + fondo cassa e contenuto euro/token) |
| GET | `/api/exchange/:eventId/transactions` | exchange-admin / platform-admin | Storico transazioni (paginato) |
| POST | `/api/exchange/:eventId/top-up` | exchange-admin / platform-admin | Carica crediti (reale → virtuale) |
| POST | `/api/exchange/:eventId/refund` | exchange-admin / platform-admin | Rimborsa crediti (virtuale → reale) |
| GET | `/api/exchange/:eventId/settlements/summary` | exchange-admin / platform-admin | Riepilogo crediti guadagnati/liquidati per stand (informativo) |
| GET | `/api/exchange/:eventId/settlements/report` | exchange-admin / platform-admin | Resoconto aggregato liquidazioni per stand (numero, crediti, lordo/trattenuta/erogato €, residuo), filtro `from`/`to`, totali evento |
| GET | `/api/exchange/:eventId/settlements` | exchange-admin / platform-admin | Storico liquidazioni stand (paginato, filtro standId) |
| POST | `/api/exchange/:eventId/settlements` | exchange-admin / platform-admin | Crea liquidazione stand (standId, amount crediti libero, feePercent default 0) |
| POST | `/api/exchange/:eventId/guests` | exchange-admin / platform-admin | Crea cliente al volo (displayName opzionale) |
| POST | `/api/exchange/:eventId/cash-float` | exchange-admin / platform-admin | Imposta/modifica fondo cassa (euro, credits) |
| GET | `/api/exchange/:eventId/cash-movements` | exchange-admin / platform-admin | Storico movimenti cassa (paginato) |
| POST | `/api/exchange/:eventId/cash-movements` | exchange-admin / platform-admin | Registra movimento carico/prelievo (currency euro/credits, direction in/out) |
| POST | `/api/exchange/:eventId/reset-cash-register` | exchange-admin / platform-admin | Azzera cassa |
| GET | `/api/exchange/:eventId/cash-register-reset` | exchange-admin / platform-admin | Data ultimo azzeramento |

### API routes — Contest POI
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/contests/contest-pois?eventId=` | contest-admin / platform-admin | Lista POI contest |
| POST | `/api/contests/contest-pois` | contest-admin / platform-admin | Crea POI contest (name, hints[], groups[], standId opzionale — stand dell'evento come POI) |
| PATCH | `/api/contests/contest-pois/:poiId` | contest-admin / platform-admin | Modifica POI contest (standId: null per scollegare) |
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

### API routes — Adesione stand (wizard elettronico)
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/events/:eventId/adhesions` | auth | Lista adesioni (admin vede tutto; gli altri solo le proprie: stands possesso o `userId`) |
| POST | `/api/events/:eventId/adhesions` | optional auth | Crea adesione. **Gate**: 400 se l'evento non ha `regulationDocument`. Anonimo SOLO per stand nuovo (senza `standId`); con `standId` → admin/owner. Response include `accessToken` (da conservare e inviare come header `x-access-token`) — nel DB solo `accessTokenHash` sha256 |
| GET | `/api/events/:eventId/adhesions/mine` | optional auth | Adesione dell'utente (o via `x-access-token`) → `{ item }` o `{ item: null }` |
| GET | `/api/events/:eventId/adhesions/:adhesionId` | optional auth | Dettaglio (admin/owner/utente/token; altrimenti 404) |
| PATCH | `/api/events/:eventId/adhesions/:adhesionId` | optional auth | Modifica bozza (409 se approved; `submitted` → `draft`) |
| POST | `/api/events/:eventId/adhesions/:adhesionId/submit` | optional auth | Invia per approvazione (400 con campi mancanti; per i nuovi stand crea/riusa utente inattivo con invito email; response `activationUrl`/`emailSent`) |
| POST | `/api/events/:eventId/adhesions/:adhesionId/withdraw` | optional auth | Ritira da `submitted` → `draft` |
| POST | `/api/events/:eventId/adhesions/:adhesionId/approve` | event-admin | Approva. Se l'adesione non ha `standId` CREA lo `Stand` (numero progressivo + ruoli/logo) e assegna `stand-admin` all'utente. **platform-admin ESCLUSO** (`hasRole` matcha per slug) |
| POST | `/api/events/:eventId/adhesions/:adhesionId/reject` | event-admin | Rifiuta con `{ reviewNote }` |
| POST | `/api/events/:eventId/adhesions/:adhesionId/integration` | event-admin | Richiede integrazioni → stato `integration` ("Da integrare"), `reviewNote` obbligatoria |

### API routes — Advertisement
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/advertisements` | no | Lista advertisement ABILITATI (per lo slideshow); trasversali, non legati a un evento |
| GET | `/api/advertisements/manage` | platform-admin / photo-admin | Lista completa (abilitati e disabilitati) |
| POST | `/api/advertisements` | platform-admin / photo-admin | Crea advertisement (multipart `image` + `name` opzionale + `weight` default 1) |
| POST | `/api/advertisements/reset-appearances` | platform-admin / photo-admin | Azzera i contatori `appearances` di tutti gli advertisement |
| POST | `/api/advertisements/:advertisementId/appearance` | no | Incrementa `appearances` ($inc) — chiamato dalla slideshow ogni volta che mostra l'advertisement |
| PATCH | `/api/advertisements/:advertisementId` | platform-admin / photo-admin | Attiva/disattiva (`enabled`), aggiorna `name` o `weight` |
| DELETE | `/api/advertisements/:advertisementId` | platform-admin / photo-admin | Elimina (rimuove asset da Cloudinary) |

Nota: `weight` (min 1) guida la **selezione casuale ponderata** nel pannello slideshow — piú alto = piú spesso mostrato. Il campo `appearances` (default 0) è il totale persistito di apparizioni, incrementato lato server a ogni display; il totale è mostrato in admin accanto alla thumbnail e azzerabile dal pulsante "Azzera contatori apparizioni". La schermata slideshow ha in testata titolo editabile + sottotitolo (nome evento) + aggiorna + velocità; il pannello Advertisement aperto NON ha titolo né contatore (solo × per chiudere). `useKeepAlive` (ping anti-idle ogni 9 min) è montato SOLO su `SlideshowPage` (era sulle pagine cassa, tolto da lì a Set 2026).

### API routes — Email Subscriptions
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/email-subscriptions` | no | Subscribe (crea/aggiorna consenso per email) |
| POST | `/api/email-subscriptions/unsubscribe` | no | Disiscrizione by email |
| GET | `/api/email-subscriptions` | platform-admin | Lista iscrizioni (paginata, filtrabile per eventId/isActive/search) |
| DELETE | `/api/email-subscriptions/:id` | platform-admin | Cancella iscrizione |

### API routes — Promozioni e Coupon
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/events/:eventId/promotions` | event-admin / platform-admin | Lista coupon dell'evento (QR inline incluso) |
| POST | `/api/events/:eventId/promotions` | event-admin / platform-admin | Crea coupon (code, type discount/product/value, formula, maxPresentations, perUserLimit, expiresAt, standId) |
| PATCH | `/api/events/:eventId/promotions/:promotionId` | event-admin / platform-admin | Modifica coupon (o `isActive` per attiva/disattiva) |
| DELETE | `/api/events/:eventId/promotions/:promotionId` | event-admin / platform-admin | Elimina coupon (400 se già usato: disattivare per conservare lo storico) |
| GET | `/api/events/:eventId/promotions/:promotionId/qrcode` | event-admin / platform-admin | QR del codice coupon (data URL) |
| GET | `/api/events/:eventId/promotions/:promotionId/usage` | event-admin / platform-admin | Storico utilizzi (max 200) |
| POST | `/api/events/:eventId/promotions/validate` | auth | Valida un codice: `{ valid, item }` o `{ valid:false, message }` |
| POST | `/api/events/:eventId/promotions/redeem-value` | auth (cassa) | Riscatta buono valore accreditando crediti al cliente (body `{ code, eventUserId }`) |

Tipi coupon: `discount` (sconto `%` o `fixed` in crediti), `product` (prodotto in omaggio / formula `formula {paid,total}` con `formulaMaxFree`), `value` (buono valore al riscatto). **Gli sconti percentuali NON si applicano ai pagamenti in crediti** (blocco server+client). Nella cassa: componente `CouponPanel` (input + scan QR) su `CashierOrderPage`/`EventCashierPage`; gestione in `/admin/events/:eventId/promotions`. Report: `coupons` per promozione + `discountAmount` nei totali. Gotcha: router nidificato usa `Router({ mergeParams: true })`; filtri campo-vs-campo numerici con `$expr`.

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
- Evento admin: `AdminEventContext` esposto da `AdminLayout` fornisce `selectedEventId`/`selectedEvent`/`events` a sidebar e pagine — MAI aggiungere una combo evento locale in una pagina admin (la selezione vive solo nella sidebar "Evento attivo"; cambia evento → sempre `/admin/dashboard`). Dettagli in ARCHITECTURE.md.

## Render deploy

`render.yaml` configura due servizi web (backend + frontend), piano free, regione Frankfurt.

### Files esclusi dal deploy
Modifiche ai file in `docs/` non attivano un deploy. Imposta su Render dashboard per ogni servizio:
**Settings → Build Filters → Ignored Paths**: `docs/**`

## Session state (Set 2026 — pulizia lint pre-esistenti)
### Completed
- **Lint a 0 errori** su entrambi i package (era 33 errori backend + 58 errori frontend, tutti pre-esistenti).
- Frontend `eslint.config.js`: **regole disattivate di proposito** — `react-hooks/set-state-in-effect` (39 errori: il pattern repo `void load()` con `setLoading(true)` sincrono la scatena; era assente con react-hooks ≤6, nessun refactor in remoto) e `react-refresh/only-export-components` (7: helper esportati da `CurrencyDisplay`/`CategorySelect` usati in ~18 file + hook da `auth-context`/`ThemeProvider`). Il resto di react-hooks/ts rules resta attivo.
- Fix banali frontend: `no-empty` ×9 (`catch { /* noop */ }` su catch intenzionali), `no-useless-assignment` (`PhotoBoothModal` `let dateStr: string`), `no-require-imports` (`vite.config.ts`: import ESM `node:fs` + `new URL('./dist/…', import.meta.url)` al posto di `require`/`__dirname`).
- Backend: rimosso dead import `hashActivationToken` da `users.controller.ts` + **32 unused vars nei test** (import morti rimossi; fixture per side-effect senza assegnazione destructure o destructured ridotte a `{ role }`).
- VERIFICA: frontend build ✓ + 43 test vitest ✓ + lint 0 errori (restano 13 warning `exhaustive-deps` pre-esistenti); backend typecheck ✓ + **372 test ✓** + lint 0 errori. Nessun tocco a `.local/`: nessuna rigenerazione di `distro/local-app.tar` necessaria. COMMIT `chore`.

## Session state (Set 2026 — promozioni e coupon)
### Completed
- Sistema **Promozioni e Coupon** completo (backend + frontend): tre tipi di coupon applicabili in cassa via input manuale o **QR scan** — `discount` (sconto `%` o `fixed` in crediti, mai su pagamenti in crediti per la versione percentuale, blocco server+client), `product` (prodotto del menu omaggio — semplici o con **formula** 2x1/3x2 via `formula { paid, total }` e cap `formulaMaxFree`; ogni ordine = 1 presentazione `maxPresentations`, non restituita se l'ordine viene annullato) e `value` (buono valore riscattato accreditando crediti al cliente). Modelli `Promotion` + `PromotionUsage`. API `/api/events/:eventId/promotions` (`Router({ mergeParams: true })`). Integrazione in `createOrder`/`payOrder` con campi `promotionId/promotionCode/discountAmount/freeUnits` sull'ordine, report con sezione `coupons` + `discountAmount`. Frontend: `CouponPanel` nelle due cacce, pagina `/admin/events/:eventId/promotions`, sezione coupon nei report e righe Sconto/Omaggi su ricevuta e modale conferma.
- **GOTCHAS applicati**: Express 5 sub-router su `/api/events/:eventId/...` con `mergeParams: true`; filtri campo-vs-campo numerici con `$expr` (mai `{ field: { $gt: '$other' } }`); per-user limit richiede `eventUserId` sui `PromotionUsage` (risolto in `createOrder`).
- Verifica: backend typecheck ✓, **341 test ✓** (incl. `integration-promotions.test.ts`, 27 test), frontend build (tsc+vite) ✓, 41 test vitest ✓, lint senza errori NUOVI (backend da 36 a 33 errori solo per rimozione degli unused-import miei; i restanti 33 sono pre-esistenti). COMMIT precedente "Revert feat(slideshow)" esiste. Solo cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria** (`.local/` non toccato).

## Session state (Set 2026 — esportazione social moneta + regolamento PDF su evento)
### Completed
- **Regolamento PDF su evento**: `Event.regulationDocument` (subdocumento `document.schema`, default null) caricabile in `EventsPage`; endpoint `POST /api/upload/document` (solo `application/pdf`, 20 MB, Cloudinary `resource_type: 'raw'`) e `DELETE /api/upload/document`. Pulsante "Scarica Regolamento" nella hero di `EventDetailPage` (solo se presente) che scarica con nome **`regolamento-<manifestazione>-<anno>.pdf`** — **GOTCHA**: un `<a download>` cross-origin su Cloudinary NON forza il nome; usare `fetch`→`blob`→`URL.createObjectURL`→anchor `download` (fallback `window.open`).
- **Esportazione social**: il nome della moneta appare SOLO nella riga "Moneta evento: NOME (1 NOME = €)"; nei prezzi di poster+caption si usa il **logo della moneta** (`currencySymbol.url`) o l'**iniziale in un circoletto unicode** (`Ⓣ`, U+24B6.. via `circledInitialText`); simboli nudi ('€', 'euro') restano testo. La **descrizione evento nella caption è ripulita dai tag HTML** (`stripHtml` in `lib/socialMenu.ts`).
- Documentazione: `docs/ADESIONE_STAND.md` Sezione E — Energia elettrica (un solo punto luce; esigenze aggiuntive elencate nel modulo con potenza kW/kWh; contributo a carico dello stand); `docs/regolamenti/notti-cilentane-2027.md` aggiornato.
- Verifica: backend non toccato; frontend build (tsc+vite) ✓, 41 test vitest ✓, lint solo warning pre-esistenti. Nessun tocco a `.local/`: nessuna rigenerazione di `distro/local-app.tar` necessaria.

## Session state (Set 2026 — saldo utente in pagina evento pubblica)
### Completed
- `GET /api/events/:eventId` ora usa `optionalAuthMiddleware` e, se `req.user` è presente, restituisce anche `wallet: { balance } | null` (saldo crediti dell'utente per quell'evento, via `EventUserModel`). `EventDetailPage` mostra un badge "saldo" con l'ammontare (o 0) nella moneta dell'evento accanto al badge moneta, solo per utenti autenticati (ai visitatori anonimi resta nascosto).
- Verifica: backend typecheck ✓, 303 test ✓, frontend build ✓.
- Nota: la modifica tocca solo `backend/` e `frontend/` cloud — NON `.local/`, quindi nessuna rigenerazione di `distro/local-app.tar` necessaria.

## Session state (Set 2026 — parametri coupon in eventi GA4/GTM)
### Completed
- `trackCashierOrderCreated` e `trackOrderCreated` in `analytics.ts` ora accettano i parametri opzionali `promotionCode`, `discountAmount`, `couponType` (esposti nel dataLayer come `promotion_code`, `discount_amount`, `coupon_type`). Call sites: `CashierOrderPage.tsx` e `EventCashierPage.tsx` passano i valori dalla response API (`response.item.promotionCode`, `response.item.discountAmount`, `coupon?.item.type`). `EventStandMenuPage` (menu pubblico, nessun coupon) mantiene i default vuoti — nessun cambio.
- Fix `CouponPanel.tsx`: `trackCouponApplied` ora riceve `discountAmount` e `freeUnits` calcolati da `computeCouponDiscount(coupon.item, lines)` al momento della validazione, invece dei valori zero hardcoded.
- Verifica: frontend build ✓, 43 test vitest ✓, lint 0 errori (13 warning pre-esistenti). Nessun tocco a `.local/`: nessuna rigenerazione di `distro/local-app.tar` necessaria.

## Session state (Set 2026 — fix "stand collegato" per nome nel wizard adesione)
### Completed
- **Bug**: nel campo "Stand collegato" (gestori evento) si digitava il NOME dello stand che finiva in `standId` del payload → nella creazione/modifica adesione mongoose lanciava `Cast to ObjectId failed for value "…" at path "standId"`.
- **Modello di adesione**: l'adesione è per UN NUOVO stand (nome scritto nella prima riga "Nome attività", `standId` vuoto → lo Stand viene creato all'approvazione) OPPURE uno stand GIÀ registrato di proprietà dell'utente. Il campo "Stand collegato" NON è un campo libero.
- **Fix backend** (`stand-adhesions.controller.ts`): nuova helper `resolveStandReference(eventId, ref)` — accetta sia un ObjectId valido sia il **nome** dello stand (match case-insensitive esatto tra gli stand dell'evento, `name` escaped per la regex); usata in `createAdhesion` e `updateAdhesion` (se il nome non esiste → 400 "Nessuno stand trovato…"). `data.standId`/`body.standId` assegnato con l'ObjectId risolto così il modello non vede più la stringa. Defence-in-depth: il frontend ora NON invia più nomi, solo id.
- **Fix frontend** (`StandAdhesionWizardPage.tsx`): il campo "Stand collegato" da free-text `<input>` con datalist è diventato un `<select>` con gli stand dell'evento (per admin/gestori) o "I tuoi stand" (per l'utente) — prima opzione "— Nuovo stand: scrivi il nome qui sotto —". Label spiegata ("solo stand GIÀ registrati…; se lo stand è NUOVO lascia vuoto"). Selezione di uno stand esistente precompila `standName`; deselezione lo svuota se vuoto.
- Test: +2 in `integration-stand-adhesions.test.ts` (creazione per nome → id risolto; nome inesistente → 400). Suite backend **374 test ✓**, typecheck ✓, lint 0 errori; frontend build (tsc+vite) ✓, lint 0 errori (13 warning pre-esistenti). Nessun tocco a `.local/`: nessuna rigenerazione di `distro/local-app.tar` necessaria.

## Session state (Set 2026 — fix submit adesione: quota/caparra opzionali + persist pre-submit)
### Completed
- **Bug**: "Compilazione incompleta: accettazione del prezzo di partecipazione, accettazione della caparra, firma del richiedente" — ma l'evento NON ha quota/caparra e la firma è compilata nel form.
- **Fix ① (backend)**: `completenessErrors(adhesion, event)` ora richiede `participationFeeAccepted`/`depositAccepted` SOLO se `event.participationFee`/`event.deposit` sono definiti (`!= null`), come già faceva la `missing` list del wizard. `submitAdhesion` carica l'evento (`select('participationFee deposit')`) e lo passa.
- **Fix ② (frontend)**: `handleSubmit` in `StandAdhesionWizardPage.tsx` chiamava il submit coi dati SALVATI, ignorando modifiche non ancora persistite (es. firma digitata dopo l'ultimo salvataggio). Ora fa SEMPRE `persist(buildPayload(form))` (PATCH se l'adesione esiste, POST altrimenti) prima del POST `/submit`.
- Test: +1 in `integration-stand-adhesions.test.ts` (evento senza fee/caparra → submit OK senza acceptance). Suite backend **375 test ✓**, typecheck ✓, frontend build ✓.

## Session state (Set 2026 — stato "Da integrare" + referente dello stand nel wizard adesione)
### Completed
- **Stato `integration` ("Da integrare")** per le adesioni stand: nuovo endpoint `POST /api/events/:eventId/adhesions/:adhesionId/integration` (solo event-admin, `reviewNote` obbligatoria, 400 se manca) richiesto dal terzo pulsante "Da integrare" su `AdhesionsManagePage`. Setta `status: 'integration'`, `reviewedAt`, `reviewNote`. Lo stand riapre l'adesione in modifica dal wizard (stato `editable` come draft/rejected), può ritirarla (da `submitted` o `integration`) e reinviarla (`submit` funziona da `integration`; azzera `reviewedAt`/`reviewNote`). Il gestore può da `integration` approvare/rifiutare/chiedere ulteriori integrazioni.
- **Sezione referente**: estratta dalla sezione ① e spostata in campo dedicato finale ⑦ "Referente dello stand" nel wizard — "Nome e cognome del referente" (campo unico), email, telefono, **recapito social** opzionale (`contactSocial`, nuovo campo modello + API). Regole: nome referente obbligatorio per TUTTI; stand NUOVO (standId vuoto) → email obbligatoria (serve per creare/attivare l'account di gestione); stand GIÀ registrato → email O telefono. Validazione identica in `completenessErrors` (backend) e `missing` (frontend).
- Test: suite backend **377 test ✓** (+2: flusso integration, regole referente), typecheck ✓, frontend build (tsc+vite) ✓, lint 0 errori (13 warning pre-esistenti). Nessun tocco a `.local/`: nessuna rigenerazione di `distro/local-app.tar` necessaria.

## Session state (Set 2026 — advertisement nel pannello slideshow)
### Completed
- **Advertisement trasversali**: modello `Advertisement` (collezione `advertisements`, NON legato a evento — campi `image`/`enabled`/`weight`/`name`/`appearances`) con API `/api/advertisements`: `GET /` pubblico (solo `enabled: true`), `GET /manage` (platform-admin/photo-admin, tutte), `POST` (multipart `image`, guard same-role), `POST /reset-appearances` (azzeramento contatori, guard same-role), `POST /:advertisementId/appearance` (pubblico, `$inc` apparizioni), `PATCH /:advertisementId` (toggle `enabled`/nome/`weight`), `DELETE` (rimuove asset Cloudinary).
- **Pannello collassabile in `SlideshowPage`**: a destra della griglia foto — chiuso = tab verticale sottile "Advertisement"; aperto = occupa `min(30vw, 100vh*0.7071)` (proporzione portrait A4) a tutta l'altezza, riducendo la larghezza della griglia. Ruota con lo stesso timer `rotateSec` dei pulsanti velocità ma con **selezione casuale ponderata** sul `weight` (`weightedPickIndex` — probabilità ∝ peso, mai ripetuto consecutivo se esistono alternative); dissolvenza `adFade`. Struct layout: `.fullscreen` (colonna) → `.body` (riga: `.stage` + `.adPanel`). Il pannello aperto NON ha titolo né contatore (solo × per chiudere). La schermata ha in testata **titolo slideshow editabile + sottotitolo (nome evento)** + aggiorna + velocità; `useKeepAlive` (ping anti-idle 9 min) è montato solo qui (tolto dalle pagine cassa).
- **Contatori apparizioni**: ogni display di un advertisement (pannello aperto) chiama `POST /:id/appearance` che fa `$inc` su `appearances` — il **totale è mostrato in admin accanto alla thumbnail** di ogni card; pulsante "Azzera contatori apparizioni" in `AdvertisementsPage` (conferma) → `POST /reset-appearances`.
- **Pagina admin** `AdvertisementsPage` (`/admin/advertisements`, sezione sidebar Foto, solo platform-admin): upload (nome opzionale + peso), input peso numerico accanto alla thumbnail di ogni card, badge apparizioni, attiva/disattiva, elimina.
- Test: `integration-advertisements.test.ts` (15 test: public only enabled, auth/403 su manage, create platform-admin, peso custom, clamp peso a 1, PATCH peso, appearance increment, 400/404 appearance, reset counters, 401 reset, toggle, delete + deleteImage, 400/404). Suite backend **392 test ✓** (45 file), typecheck ✓, lint ✓; frontend build (tsc+vite) ✓, lint 0 errori (13 warning pre-esistenti). Nessun tocco a `.local/`: nessuna rigenerazione di `distro/local-app.tar` necessaria.

## Session state (Aug 2026 — evento admin centralizzato con AdminEventContext)
### Completed
- Nuovo `frontend/src/layouts/AdminEventContext.ts`: `AdminEventContext` + hook `useAdminEvent()` che espone `{ selectedEventId, selectedEvent, events }` a sidebar e pagine.
- `AdminLayout` è l'unica sorgente di verità: carica gli eventi (`GET /api/events` senza `public`), li fornisce via `AdminEventContext.Provider`, delega `handleSelectEvent` ad `AdminSidebar`. Risoluzione `selectedEventId`: (1) evento nell'URL (solo `/admin/events/:id/...`), (2) `localStorage['adminSelectedEventId']`, (3) primo evento in corso (`endOfDay(endDate) >= now`), fallback `events[0]`.
- `handleSelectEvent`: aggiorna context + `localStorage`; se il nuovo evento è DIVERSO da quello corrente → **navigate SEMPRE a `/admin/dashboard`** (mai rewrite URL sulla stessa pagina — StandDetailPage/StandManagePage mostrano tutti gli eventi dello stand e resterebbero incoerenti).
- Combo locali rimosse (ora leggono `selectedEventId` dal context negli effect): `EventUsersPage`, `MenuPrintPage`, `StandDetailPage` (selettore azioni), `StandManagePage`, `UsageContractsPage` (filtro contratti), `EventProductsPage` (filtro prodotti). Le pagine che servono l'evento COMPLETO (currencyName, logo, coverImage, promo) mantengono un fetch locale `GET /events` SOLO per i dettagli — mai per la SELEZIONE.
- Selettori evento che restano come campi di modulo (NON rimuovere): ruolo event-scope in `UserRolesPage`, form prodotto in `EventProductsPage`/`StandDetailPage`, evento nel form contratto. `NewOrderPage`/`OrdersPage` sono dead code (non in `router.tsx`) e non toccate.
- Verifica: `npm run build` (tsc + vite) ✓, `vitest` 16 test ✓, lint senza errori NUOVI (`EventProductsPage` è stata ristrutturata per evitare un nuovo `set-state-in-effect`; restano solo quelli pre-esistenti).

## Session state (Aug 2026 — ordini omaggio + dashboard eventi terminati)
### Completed
- Ordini omaggio: `Order.isGift` (default `false`). `createOrder` con `isGift: true` forza `status: 'confirmed'`, `total: 0`, `creditAmountUsed: 0`, `paymentStatus: 'paid'`, `paidAt`, `paymentTransactionId: null`; la logica pagamento è saltata (`if (paymentOnCreate && !isGift)`). Gli item conservano `unitPrice`/`subtotal` reali per il conteggio prodotti. Numero ordine con prefisso "O" e badge OMAGGIO a livello UI (display coda, liste ordini, dettaglio, ricevuta, cassa).
- `GET /api/orders/gift-stats?eventId=&standId=` (auth): conta solo ordini non cancellati; `thresholdExceeded = giftPercentage > 5` (STRETTO — al 5% esatto non scatta). Route registrata PRIMA di `get('/:orderId')`. `GiftCounter` (frontend) mostra "Omaggi: X/Y (Z%)" verde ok / rosso pulsante se superata.
- Resoconti: `giftOrders` (non cancellati) per stand e nei totali; `giftProducts` nel summary stand; `productQuantities` split `quantity`/`giftQuantity`/`revenue` (i gift NON generano revenue). I gift sono esclusi da `paidOrders`, `cashPaymentOrders` e `mixedPaymentOrders` per costruzione, ma `creditPaymentOrders` li esclude ESPLICITAMENTE (`$ne: ['$isGift', true]`) perché `creditAmountUsed === total` (0===0) li matcha di default.
- Dashboard operatore: eventi terminati (fine giornata `endDate` passata) → badge "Terminato — nessuna operazione", niente link Cassa/Ordini/Coda/Coda combinata né chip postazioni né Liquidazione. `isEventFinished` usa `endOfDay(end) < now` con `now` catturato una volta via `useState(() => Date.now())` (il lint React vieta `Date.now()` in render). Sezione Resoconti con dropdown per evento e dropdown per stand + "Menu stampa", invece della lista di pulsanti.
- Test: `orders.test.ts` (creazione gift forzata, gift-stats con soglia al 5% esatto e oltre, cancellazione esclusa dal conteggio) e `integration-reports.test.ts` (report stand/evento: gift esclusi dal fatturato, quantità omaggio separate). 249 test backend, typecheck pulito sia backend che frontend. Lint frontend: nessun errore NUOVO (restano solo i pre-esistenti in AliasManager/ConfirmModal e i `no-empty`/`set-state-in-effect` già presenti).

## Session state (Aug 2026 — invio email bulk galleria + lightbox + timeout "Pronto" display)
### Completed
- Endpoint bulk `POST /api/events/:eventId/photos/send-email` (photo-print / photo-admin / platform-admin): body `{ email, photoIds[], marketingConsent }`. Invia tutte le foto a un unico indirizzo via `email.service.sendPhotosEmail` (una email con N immagini; se tra le selezionate c'è un video → 400). `sendPhotoEmail` (singola) delega a `sendPhotosEmail` con un array di 1. La registrazione della subscription è estratta in `recordEmailSubscription`.
- `EventGalleryPage`: click su foto/video → lightbox a schermo intero (`lightboxPhoto` state, overlay + media contenuto, numero in basso a destra, click fuori chiude). La selezione multipla avviene SOLO col pallino in alto a destra (button `.check`, `e.stopPropagation()`), non col click sulla card. Pulsante toolbar "Invia selezionate via email" (photo-print+) quando `selectedIds.size > 0`; filtra solo immagini.
- Timeout "Pronto" nel display coda: campo `Order.readyAt` (Date, default null) valorizzato in `updateOrderStatus`/`markStationReady`/`markItemReady`/`cancelOrderItems` quando l'ordine passa a `ready`. `getStandDisplayOrders` esclude i `ready` più vecchi di `STAND_DISPLAY_READY_TIMEOUT_MINUTES` (env, default 2). Test in `orders.test.ts` (17 test) e `integration-event-photos.test.ts` (12 test).

## Session state (Aug 2026 — numeri progressivi stand per evento)
### Completed
- `Stand.numbers`: array di `{ eventId, number }`. `number` = progressivo per-evento, auto-assign alla creazione dello stand e quando uno stand viene collegato a un evento. `GET /api/stands` include `numbers` (filter per `eventId`), `/api/stands/:standId` pure.
- `Stand.numbers[].showOnMap` (default `true`): se `false` lo stand non viene mostrato in mappa (marker + combo `EventMapPage`) ma conserva il numero. Gestito da `PATCH /stands/reorder` con `showOnMap` opzionale per item.
- Endpoint bulk `PATCH /api/stands/reorder` (auth): body `{ eventId, items: [{ standId, number }] }`. Valida che tutti gli stand facciano parte dell'evento, poi imposta `numbers` per ogni stand. Pattern identico a `/stations/reorder` e `/event-products/reorder`.
- Sort liste per numero: `listStands` usa `numbers` quando filtrato per evento (fallback `name` per gli stand senza numero). `EventDetailPage` ordina per numero (fallback nome).
- `EventDetailPage`: badge col numero su ogni card stand; la numerazione è GLOBALE per evento (senza distinzione di categoria) e si gestisce nella sezione admin "Numerazione stand" — lista unica di tutti gli stand ordinata per numero (mista, con badge categoria) con pulsanti ▲/▼. `EventMapPage`: marker numerati (divIcon con badge circolare) e legenda; combo degli stand con numero.
- `EventStandMenuPage`: prezzo nascosto quando è 0 (menu omaggio), sia nelle card che nel modale dettaglio.
- Test: `backend/src/__tests__/controllers/stands.test.ts` (11 test: assign on create/link, reorder + rinumerazione, validazione stand non nell'evento).

## Session state (Aug 2026 — video in galleria + cassa stand dalla dashboard)
### Completed
- `EventPhoto` supporta `type: 'image' | 'video'` (default `'image'`) con subdocument `video` (`{ url, publicId, width, height, format, bytes, duration }`); `image` e `video` sono opzionali. `POST /api/events/:eventId/photos` usa `multerMediaUpload.fields([{ name: 'image' }, { name: 'video' }])` e salva il tipo giusto.
- Cloudinary: `uploadVideoBuffer` (resource_type `video`), `deleteVideo`/`deleteMedia` (destroy con `resource_type`); `deleteAllEventPhotos`/`deleteEventPhoto` scelgono la funzione in base a `type`.
- `EventGalleryPage`: pulsante "Carica video" (photo-admin, input file → multipart `video`), card `<video controls>`, badge 🎬, contatore "elementi", stampa e invio email solo per foto.
- `SlideshowPage`: i video in griglia girano muted/loop/autoplay/playsInline; nel modale fullscreen con controlli.
- Dashboard: link "Cassa" per stand → `/events/:eventId/stands/:standId/order`, mostrato solo se autorizzato (`canAccessStandCash`: platform-admin, ruolo stand-scope `cashier` per quello stand, oppure `event-admin`/`event-cashier` per un evento dello stand). Sta nella riga `standActions` accanto a "Coda Ordini".
- Test: `backend/src/__tests__/controllers/integration-event-photos.test.ts` (9 test: upload video/immagine, sequenza condivisa, delete singola/all con resource_type corretto, email video → 400).

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
