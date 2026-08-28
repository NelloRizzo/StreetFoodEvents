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
| POST | `/api/events/:eventId/duplicate` | auth | Duplica l'evento come base operativa per la prossima edizione: copia configurazione (moneta, tema, fasce, tagli, categorie), collega gli stand con rinumerazione progressiva, copia EventProduct e POI. NON copia wallet/ordini/transazioni/foto/contest. Body opzionale `{ name, startDate, endDate, isPublic }` (default: nome+" (copia)", date +1 anno). |

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
- Evento admin: `AdminEventContext` esposto da `AdminLayout` fornisce `selectedEventId`/`selectedEvent`/`events` a sidebar e pagine — MAI aggiungere una combo evento locale in una pagina admin (la selezione vive solo nella sidebar "Evento attivo"; cambia evento → sempre `/admin/dashboard`). Dettagli in ARCHITECTURE.md.

## Render deploy

`render.yaml` configura due servizi web (backend + frontend), piano free, regione Frankfurt.

### Files esclusi dal deploy
Modifiche ai file in `docs/` non attivano un deploy. Imposta su Render dashboard per ogni servizio:
**Settings → Build Filters → Ignored Paths**: `docs/**`

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
