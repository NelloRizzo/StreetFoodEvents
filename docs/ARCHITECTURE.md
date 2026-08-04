# ARCHITECTURE — Street Food Events

Considerazioni progettuali e decisioni architetturali.

## Theming System
- **Seasonal themes**: 6 palettes (spring, summer, autumn, winter, christmas, easter) auto-applied via date detection (Easter via Computus, Christmas 15 Dec–6 Jan, meteorological seasons).
- **Per-event colors**: 4 custom fields (themeBrand, themeText, themeSurface, themeHighlight) on Event model + color pickers in EventsPage form. CSS `color-mix()` derives soft/deep/line/glow from these 4.
- **Architecture**: `ThemeProvider` wraps app in `main.tsx`, applies `.theme-*` class on `<html>`; `useEventTheme` hook applies `[data-event-theme]` + inline `--theme-*` vars per component.

## Printing approach
- **Window.print() su HTML puro**: per stampare senza conflitti CSS SPA, si usa `window.open('', '_blank')`, si scrive HTML puro con `document.write()`, si chiama `window.print()` + `window.close()`. Evita problemi di `min-height: 100vh` e `overflow: hidden` di React/SPA.

### Flyer page — lessons learned
- **React Page dentro SPA (FlyerPage) con reset CSS aggressivo** è la soluzione adottata.
- **Cosa NON fare**:
  - Non usare server custom (`server.js`) — il problema è solo CSS, non va risolto a livello di routing/serving
  - Non usare HTML standalone in `public/` se servito da `serve -s` — `serve` single-page mode non serve file da subdirectory
  - Non dimenticare di override `min-height: 0 !important` su `#root` e `body` nel `@media print` di pagine che devono stampare

### Menu Print
- **Pagina React dentro AppLayout** per la selezione (evento → stand checkbox), poi finestra HTML puro per la stampa A3 landscape.
- `@page { size: A3 landscape; margin: 1cm }` + `page-break-before: always` tra stand.

## Map & Location
- **Per-event stand locations**: array `locations[{ eventId, location }]` sul modello Stand per supportare posizioni diverse per ogni evento.
- **MapPicker**: componente Leaflet riutilizzabile con marker draggabile SVG custom brand `#bf5a2a`.
- **Tile layer**: Esri World_Street_Map (mappa) e World_Imagery (satellite), maxZoom 20-22.

## Printer-agent (rimosso Jul 2026)
- Il progetto `printer-agent/` è stato eliminato.
- La stampante termica si collega direttamente alla macchina Windows della cassa.
- La stampa avviene via `window.print()` con HTML puro — nessun ESC/POS, nessun Raspberry Pi.

## Auth
- Session token in httpOnly cookie named `sid` (configurable). `argon2` for password hashing.
- `auth.middleware` validates on every protected route.
- Frontend: `AuthContext` wraps the app, calls `GET /api/auth/me` on mount.

## Backend
- Express + Mongoose + argon2 session auth. ESM, TypeScript, Node ≥22.
- MongoDB requires a replica set (`replicaSet=rs0`) because Mongoose transactions are used.
- Path alias: `@/*` maps to `./src/*`.
- Env vars validated at startup via Zod. Missing vars cause immediate `process.exit(1)`.
- Cloudinary for all image uploads.

## Reports & aggregations
- **Stand report** (`GET /orders/report/stand/:standId`): aggregazione per singolo stand, usata in StandOrdersPage.
- **Event report** (`GET /orders/report/event/:eventId`): aggregazione per tutti gli stand di un evento, con split contanti (`total - creditAmountUsed`) e crediti (`creditAmountUsed`).
- **Permessi**: event report accessibile solo a ruoli `event-admin` e `event-cashier` (oltre a `platform-admin`).
- **Cassa unica**: il flag `unifiedCashierEnabled` nell'evento determina se mostrare la colonna contanti nel report.
- **Cash disabled**: se `cashPaymentsEnabled = false`, il report mostra solo colonna crediti.

## Navbar grouping
- La Navbar raggruppa le voci in dropdown per ambito: **Piattaforma** (admin), **Ordini**, **Resoconti**, **Personale**.
- Ogni dropdown ha `useRef` + `handleClickOutside` per chiusura.
- Gli event items dinamici sono un dropdown separato "Eventi" a sé stante.

## Alias / Link brevi
- **Modello Alias**: `{ text (unique, lowercase, regex ^[a-z0-9_-]+$), entityType ('event'|'stand'), entityRef (ObjectId) }`
- **CRUD**: `/api/aliases` — tutte le route sono protette (authMiddleware). Filtrabili per `?entityType=&entityRef=`.
- **Resolve pubblico**: `/api/resolve/:entityType/:alias` → JSON con `{ entityType, entityId, entityName }`. Nessuna auth.
- **Frontend redirect**: la rotta `/show/:entityType/:alias` è gestita dalla SPA. `AliasRedirectPage` chiama la resolve API e fa `window.location.href` verso la pagina reale. Scelta architetturale: con frontend e backend come servizi separati su Render, un 303 lato server richiederebbe di escludere `/show/*` dal catch-all della SPA.
- **AliasManager**: componente riutilizzabile che mostra la lista alias e permette aggiunta/eliminazione. Usato in EventDetailPage e StandDetailPage.
- **Cosa NON fare**: non permettere caratteri speciali come `#`, `?`, spazi nell'alias — causerebbero problemi di parsing URL. La regex `^[a-z0-9_-]+$` è restrittiva di proposito.

## Photo Gallery
- **Modelli separati**: `EventPhoto` (image, sequenceNumber, frameId, takenAt) e `EventFrame` (name, image overlay PNG).
- **SequenceNumber auto-incrementale**: calcolato come `max(seq) + 1` per evento all'upload. Pattern nel controller, non usa CounterModel (dedicato agli ordini).
- **Cloudinary folder**: `events/{eventId}/photos/` e `events/{eventId}/frames/`. Upload diretto nei controller con `uploadImageBuffer`.
- **API nidificate**: montate in `app.ts` come `app.use('/api/events/:eventId/photos', eventPhotosRouter)` con `mergeParams: true` per ereditare `eventId`.
- **Permessi**: `POST /photos` richiede solo auth (chiunque può caricare). `DELETE /photos` (massiva) richiede `photo-admin` o `platform-admin`. `DELETE /photos/:photoId` richiede solo auth. `POST /frames` e `DELETE /frames/:frameId` richiedono `photo-admin`.
- **Ruoli in seed**: `photo-admin` (scope event, permessi photos:read/create/delete, frames:read/create/delete). `photo-print` (scope event, solo photos:read).
- **Stampa galleria**: finestra HTML pura via `window.open()` + `document.write()` + `window.print()`, stesso pattern del Menu Print e della ricevuta. Evita conflitti CSS SPA.
- **Cosa NON fare**: non eliminare foto da Cloudinary senza prima cancellare il record DB — il controller fa prima `findOneAndDelete` poi `deleteImage`. Non usare `fs` per le foto — tutto su Cloudinary.

## Frontend
- React 19 + Vite 8 + TypeScript ~6.0 + SCSS Modules + React Router 7.
- Vite proxy: `/api` → `http://127.0.0.1:4000`.
- No `@/*` alias — imports are relative.
- SCSS uses `@use` for token imports (`_tokens.scss`), not `@import`.
- Build runs typecheck first (`tsc -b`), so type errors block the build.

## CSS Grid + Flex overflow — gotcha
- **Problema**: in un layout flex column (`display: flex; flex-direction: column`), una griglia CSS interna con `grid-template-rows: repeat(N, 1fr)` può sovrapporsi al footer. Le righe CSS Grid hanno un `min-height: auto` di default che impedisce loro di restringersi sotto il contenuto intrinseco delle cella (immagini, testo). Questo "spinge" la griglia oltre il suo flex allocation, e il footer (con z-index più alto e background opaco) copre le righe inferiori.
- **Fix**: usare `grid-template-rows: repeat(N, minmax(0, 1fr))` — il `minmax(0, ...)` permette alle righe di restringersi a 0. Combinare con `min-height: 0` sul container flex, `overflow: hidden` sulla griglia, e `min-height: 0; overflow: hidden` sugli item della griglia (`.photoWrapper`).
- **Cosa NON fare**: non usare `backdrop-filter: blur()` su elementi con `z-index` più alto di un container semi-trasparente — il blur si estende visivamente oltre i bounds dell'elemento e copre il contenuto sottostante. Usare background opaco al suo posto.
- **object-fit in griglie**: `object-fit: cover` riempie la cella ma ritaglia; `object-fit: contain` mostra l'intera immagine ma lascia spazi vuoti. Con poche righe (es. 4×2) le celle sono abbastanza alte per `contain`. Con molte righe (es. 4×4) le celle sono basse e `cover` è preferibile per evitare spazi vuoti che il footer può coprire.
-
- ## Contest / Exchange
- - **Contest prizes** are stored as `prizes: [{ label: string, awarded: boolean }]` array on the Contest model, not a single `prize` string.
- - **Auto-stop**: when all prizes are awarded, `contest.isActive` becomes `false` automatically.
- - **Winner selection**: first N participants to scan all POIs win prizes in order. `registerScan` assigns the next un-awarded prize on completion.
- - **Anonymous EventUser**: `EventUser.userId` is optional (`null`). The `{ eventId: 1, userId: 1 }` unique index uses `partialFilterExpression: { userId: { $type: 'objectId' } }` to allow multiple null userIds (though only one anonymous Customer per event).
- - **Exchange admin**: `exchange-admin` role (scope event) with permissions `exchanges:read`, `exchanges:create`, `payments:read`, `payments:create`, `payments:refund`.
- - **Exchange operations**: top-up (real→virtual) is `EventUserTransaction` type `top-up`, direction `credit`. Refund (virtual→real) is type `refund`, direction `debit`. Both use reference type `cambio`.
- - **EndsAt** is always required on Contest model. If not provided on creation, it's calculated from `startsAt + durationMinutes`. The `endsAt` field allows manual early termination.

## Contest — Duplicate POIs in orderedPOIIds
- **`orderedPOIIds` can contain duplicates**: the same POI can appear multiple times in the ordered list (e.g., visited at different times or locations). This means `orderedPOIIds.length` (total slots) differs from the unique POI count.
- **`scannedPOIIds` stores duplicates**: each scan pushes one entry. If POI A appears 3 times and the user scans it 3 times, `scannedPOIIds` will contain `[A, A, A]`.
- **Occurrence-based marking**: for each position `i` in `orderedPOIIds`, count how many times that POI ID appears in `orderedPOIIds[0..i]` (occurrence number). A position is "found" only when the total scan count for that POI ID ≥ the occurrence number.
- **Cosa NON fare**: 
  - **Non usare** `scannedIds.includes(poi.id)` per marcare un POI come trovato — marcherebbe TUTTE le occorrenze quando ne è stata scansionata solo una.
  - **Non usare** `i < scannedIds.length` (position-based) — se `orderedPOIIds = [A, B, A]` e `scannedIds = [A, A]`, la posizione 1 (B) verrebbe marchiata come trovata pur non essendo stata scansionata.
  - **Non usare** `new Set(scannedPOIIds).size` per il conteggio — perderebbe i duplicati e il conteggio sarebbe errato.
- **Completion check**: `scannedPOIIds.length === orderedPOIIds.length` (conta totale, non unici). Il backend `completeParticipation` usa questo check.
- **Backend `registerScan`**: prima di push, verifica che `scannedCount < orderedCount` per quel POI ID. Se `scannedCount >= orderedCount`, errore "All occurrences already scanned".
- **Frontend griglia**: mostra tutti gli `orderedPOIIds` (inclusi duplicati), con i POI trovati spostati in fondo e separati da un divider.

## EventProduct Reorder (Aug 2026)
- **Campo `sequenceOrder`** (Number, default 0) su EventProduct per ordinare il menu per stand+evento. Pattern identico a `ContestPOI.sequenceOrder`.
- **Auto-increment** in `createEventProduct`: `findOne({ eventId, standId }).sort({ sequenceOrder: -1 })` → `+1`. Ordine gestito per (evento, stand), non globale.
- **Sort lista**: `listEventProducts` ordina per `sequenceOrder: 1, createdAt: 1` (era `createdAt: -1`). Tutti i consumatori (menu, cassa, stampa, StandDetailPage) ereditano l'ordine dall'API.
- **Endpoint bulk**: `PATCH /api/event-products/reorder` con `{ items: [{ epId, sequenceOrder }] }` aggiorna più prodotti in una chiamata. Registrato PRIMA di `PATCH /:epId` altrimenti `/reorder` verrebbe catturato come `:epId`.
- **Validazione reorder**: tutti gli item devono appartenere allo stesso stand (`standId` unico) e devono esistere (404 altrimenti). Il frontend rinumerizza solo la lista filtrata per evento selezionato.
- **Cosa NON fare**: non rinumerare con `sequenceOrder = index` senza considerare lo scope. Il frontend rinumerizza solo il sottoinsieme filtrato per evento (1..N), quindi i numeri possono collidere con prodotti di altri eventi dello stesso stand — è accettabile perché le query del menu filtrano sempre per `eventId`; i pareggi in ordinamento sono risolti dal fallback `createdAt`.

## Email Subscription System (Jul 2026)
- **Modello `EmailSubscription`**: archivia email per comunicazioni future. `email` indicizzato, `eventId` opzionale. `marketingConsent` separato dal consenso all'invio foto.
- **UPSERT per email**: `EmailSubscriptionModel.findOneAndUpdate` con `{ upsert: true }` sulla chiave email. Una sola entry per email, aggiornata a ogni nuovo consenso.
- **API pubblica**: `POST /api/email-subscriptions` non richiede auth (subscribe da qualsiasi contesto). `GET /` e `DELETE /:id` richiedono `platform-admin`.
- **Consenso tracciato**: `consentTimestamp`, `consentIp`, `source` ('photo-email'|'manual'|'event-registration') permettono di dimostrare la raccolta del consenso.

## Cashier Order Flow — Bug noto (Jul 2026)
- **Due pagine cassa**: `CashierOrderPage` (stand-level, `/events/:eventId/stands/:standId/order`) e `EventCashierPage` (event-level, `/events/:eventId/cashier`). Condividono `CashierOrderPage.module.scss` ma hanno logica diversa.
- **Problema**: `CashierOrderPage.handleSubmit` creava l'ordine senza avanzare a `preparing`, a differenza di `EventCashierPage`. L'ordine restava bloccato a `confirmed`/`pending`.
- **Fix**: aggiunto `updateOrderStatus(response.item.id, 'preparing')` in `CashierOrderPage.handleSubmit`.
- **Filtro ordini**: `CashierOrderPage.loadActiveOrders` ora usa `status: 'preparing,ready'`. Backend `listOrders` supporta comma-separated per `?status=` → converte in `$in`.
- **Cosa NON fare**: non dare per scontato che due pagine simili abbiano la stessa logica di flusso ordini. Verificare sempre lo stato dopo la creazione.
