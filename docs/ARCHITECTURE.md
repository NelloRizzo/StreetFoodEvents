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

## Visibilità pubblica evento (isPublic)
- Campo `Event.isPublic` (default `true`): se `false` l'evento è nascosto dalla parte pubblica ma resta gestibile dagli operatori.
- **Pattern `optionalAuthMiddleware`**: gli endpoint di listing pubblici che devono filtrare in base all'utente usano `optionalAuthMiddleware` (imposta `req.user` se la sessione è valida, NON blocca mai) e fanno il check nel controller. Esempio: `GET /api/events` — se l'utente ha un ruolo platform-scope o event-scope (`isEventManager`) vede TUTTI gli eventi, altrimenti solo `isPublic: true`.
- **Parametro `?public=true` su `GET /api/events`**: le superfici PUBBLICHE (HomePage "Eventi in programma", dropdown Eventi della Navbar) chiamano `GET /api/events?public=true`, che forza `isPublic: true` anche per i gestori — un evento nascosto NON deve mai comparire in una lista pubblica, nemmeno all'operatore loggato. Le superfici operative (EventsPage Gestione, dropdown Resoconti, EventProductsPage, ecc.) chiamano `GET /api/events` senza parametro e vedono TUTTI gli eventi. Il dropdown Resoconti della Navbar carica gli eventi da solo (`/events` senza `public`): NON riusare lo stato degli eventi pubblici del dropdown Eventi, o gli eventi nascosti sparirebbero anche dai Resoconti.
- `GET /api/events/home` (`homeEvents`) esclude sempre gli eventi non pubblici da `activeEvents` (il dashboard "utente" è una superficie pubblica).
- **Cosa NON fare**: NON nascondere l'evento da `GET /events/:eventId` — molte pagine pubbliche/operative (ricevute ordine, contest, galleria, menu stand) risolvono l'evento per ID e verrebbero rotte. La visibilità si controlla solo nei listing. Non confondere il filtro client-side di `EventsPage` (`adminEventIds`) con quello server-side: il backend filtra già per gestore, il client filtra ulteriormente per mostrare solo gli eventi assegnati.

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

## Liquidazione stand (StandSettlement)
- **Scopo**: a fine serata il gestore (ruolo `exchange-admin`/`platform-admin`) corrisponde in euro i crediti guadagnati da uno stand, con eventuale percentuale di trattenuta (default 0).
- **Modello `StandSettlement`**: `{ eventId, standId, standName (denormalizzato), amount (crediti), exchangeRate (snapshot al momento della liquidazione), feePercent, grossEuro, feeEuro, payoutEuro, description, performedByUserId, occurredAt }`. I valori in euro sono **calcolati e memorizzati** (non ricalcolati al volo) per evitare drift di arrotondamento.
- **Matematica**: `grossEuro = round(amount / exchangeRate, 2)`, `feeEuro = round(grossEuro * feePercent/100, 2)`, `payoutEuro = round(grossEuro - feeEuro, 2)`.
- **Il report è solo informativo**: `GET /api/exchange/:eventId/settlements/summary` restituisce i crediti guadagnati (somma `creditAmountUsed` degli ordini `paid`) e i già liquidati per stand, ma **NON vincola l'importo inserito**. Non tutti gli stand usano il sistema, quindi lo standista presenta l'importo e il gestore lo digita liberamente. Niente check "saldo residuo" sul backend.
- **NON rientra nel wallet/cassa**: le liquidazioni NON vengono sommate a `getBalance` (top-up/refund). La cassa evento resta gestita dai resoconti ordini; lo storico liquidazioni ha i propri totali (crediti liquidati + erogato €).
- **Cosa NON fare**: non creare un `EventUserTransaction` per la liquidazione — non esiste un wallet per gli stand (i crediti degli ordini sono registrati come `creditAmountUsed`, non accreditati a un EventUser). Usare sempre `referenceType`/`referenceId` NO: lo StandSettlement è un modello dedicato, con `eventUserId` non previsto.

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
- **Modelli separati**: `EventPhoto` (type, image, video, sequenceNumber, frameId, takenAt) e `EventFrame` (name, image overlay PNG).
- **Media type**: `EventPhoto.type` è `'image' | 'video'` (default `'image'`, backward compatible). `image` e `video` sono subdocument opzionali: le foto usano `image`, i video `video` (con `duration` in secondi). `POST /photos` accetta multipart con campo `image` OPPURE `video`.
- **SequenceNumber auto-incrementale**: calcolato come `max(seq) + 1` per evento all'upload. Pattern nel controller, non usa CounterModel (dedicato agli ordini). La sequenza è condivisa tra foto e video (un numero unico per l'evento).
- **Cloudinary folder**: `events/{eventId}/photos/` e `events/{eventId}/frames/`. Upload diretto nei controller con `uploadImageBuffer` (resource_type `image`, trasformazione quality/fetch_format auto) o `uploadVideoBuffer` (resource_type `video`, nessuna trasformazione).
- **Multer**: il gallery router usa `multerMediaUpload` (accetta immagini e video, limite 100 MB per video). Le immagini continuano a usare `multerImageUpload` (10 MB) per frames e upload generici.
- **Delete resource_type-aware**: la distruzione Cloudinary deve sapere il tipo di risorsa (`deleteImage` vs `deleteVideo`, entrambi → `destroy` con `resource_type`). `deleteAllEventPhotos` seleziona `type image.publicId video.publicId` e usa la funzione corretta per ogni item.
- **API nidificate**: montate in `app.ts` come `app.use('/api/events/:eventId/photos', eventPhotosRouter)` con `mergeParams: true` per ereditare `eventId`.
- **Permessi**: `POST /photos` richiede solo auth (chiunque può caricare). `DELETE /photos` (massiva) richiede `photo-admin` o `platform-admin`. `DELETE /photos/:photoId` richiede solo auth. `POST /frames` e `DELETE /frames/:frameId` richiedono `photo-admin`.
- **Ruoli in seed**: `photo-admin` (scope event, permessi photos:read/create/delete, frames:read/create/delete). `photo-print` (scope event, solo photos:read).
- **Stampa galleria**: finestra HTML pura via `window.open()` + `document.write()` + `window.print()`, stesso pattern del Menu Print e della ricevuta. Evita conflitti CSS SPA. La stampa include solo foto (`type === 'image'`), i video vengono saltati; l'invio email è disabilitato per i video (400).
- **Slideshow**: i video in griglia girano muted/loop/autoplay/playsInline (display pubblico senza audio); nel modale fullscreen i controlli sono attivi.
- **Cosa NON fare**: non eliminare foto da Cloudinary senza prima cancellare il record DB — il controller fa prima `findOneAndDelete` poi delete (con il giusto `resource_type`). Non usare `fs` per foto/video — tutto su Cloudinary. Non usare `multerImageUpload` per i video (limite 10 MB e fileFilter solo immagini). Non fare `deleteImage()` su un video — il `destroy` di default è `resource_type: image` e fallirebbe.

## Frontend
- React 19 + Vite 8 + TypeScript ~6.0 + SCSS Modules + React Router 7.
- Vite proxy: `/api` → `http://127.0.0.1:4000`.
- No `@/*` alias — imports are relative.
- SCSS uses `@use` for token imports (`_tokens.scss`), not `@import`.
- Build runs typecheck first (`tsc -b`), so type errors block the build.

## Dashboard — link cassa stand
- La sezione "Gestione stand" mostra gli stand di `GET /auth/me/stands` (già il set autorizzato che usa `CashierOrderPage` per il suo check).
- Il link "Cassa" → `/events/{eventId}/stands/{standId}/order` è mostrato SOLO se l'utente è autorizzato, calcolato da `GET /auth/me/roles`: platform-admin, oppure ruolo stand-scope `cashier` per quello stand, oppure ruolo evento `event-admin`/`event-cashier` per uno degli `eventIds` dello stand.
- Il link "Coda Ordini" (pubblico) e "Cassa" (privato) stanno nella stessa riga di azioni; `eventIds[0]` è usato come evento di riferimento per lo stand.

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

## ContestPOI — Stand collegato (Aug 2026)
- **Campo `standId`** (ObjectId ref 'Stand', `default: null`) su ContestPOI: uno stand dell'evento può essere un POI del contest, con `hints` come enigmi per individuarlo.
- **Validazione**: in `createContestPoi`/`updateContestPoi`, se `standId` è fornito deve puntare a uno stand con `eventIds` contenente l'`eventId` del POI (400 altrimenti). `standId: null` in PATCH rimuove il collegamento.
- **Nome derivato**: se il POI è collegato a uno stand e `name` non è fornito, il backend usa automaticamente lo `stand.name`. `toCpoiResponse` espone `standId` (string | null).
- **Nome pubblico**: in `getContest` e `getContestPoiQrCodes` il nome mostrato ai partecipanti è `stand.name` (risolto con una sola query `StandModel.find`) quando il POI è collegato; il campo `standId` è incluso nella risposta pubblica dei POI.
- **QR code**: il QR di un POI collegato a uno stand codifica l'URL dello stand nell'evento (`/events/{eventId}/stands/{standId}`), IDENTICO a quello generato da `GET /api/stands/:standId/qrcode?eventId=` — così il QR resta sempre quello dello stand, mai un QR di contest. Solo i POI liberi codificano `/contest/{contestId}/play?poi={poiId}`. `getContestPoiQrCodes` espone `standId` per item e usa `req.headers.origin` (come gli altri QR).
- **Scanner**: in `ContestPlayPage.handleQrScan`, oltre all'URL `play?poi=`, il decoder riconosce il path `/events/{eventId}/stands/{standId}` e lo mappa al POI del contest corrente tramite `standId`. Il mapping serve perché il QR dello stand porta alla pagina menu, non al play del contest.
- **Unique index**: resta `{ eventId: 1, name: 1 }` — collegare due volte lo stesso stand genererebbe un nome duplicato e fallirebbe. Non fare il workaround deduplicando i nomi.

## ContestPOI — Pool sincronizzato da evento (Aug 2026)
- **Sync automatica** (`syncContestPoisForEvent` in `contests.controller.ts`, invocata in cima a `listContestPois` quando `?eventId=` è presente): il pool dei POI disponibili di un contest contiene SEMPRE TUTTI gli stand (`StandModel.find({ eventIds })`) e TUTTI i POI dell'evento (`POIModel.find({ eventId })`).
- **Idempotente e non distruttiva**: la sync non elimina mai nulla. Se un ente (stand o POI evento) non ha un ContestPOI, ne crea uno nuovo (o collega un POI libero già esistente con lo stesso nome tramite `byName`, case-insensitive). Se il POI libero è già collegato ad altro, non viene toccato. Errore della sync NON rompe la lista (try/catch) — la lista torna comunque.
- **Campo `poiId`** (ObjectId ref 'POI', `default: null`, mutuamente esclusivo con `standId`): in `createContestPoi`/`updateContestPoi` `poiId` deve puntare a un POI con `eventId` uguale a quello del contest (400 altrimenti), e non può essere combinato con `standId`. `toCpoiResponse`, `getContest` e `getContestPoiQrCodes` espongono `poiId` (e risolvono il nome reale del POI).
- **QR code**: gli stand-POI codificano il menu dello stand (vedi sopra); i POI collegati a un POI evento codificano la scan URL del contest (`/contest/{contestId}/play?poi={poiId}`) come i POI liberi. `getContestPoiQrCodes` espone `eventPoiId` per gli item collegati.
- **Nome pubblico**: in `getContest` il nome mostrato ai partecipanti è `stand.name` (se collegato a uno stand), altrimenti `poi.name` (se collegato a un POI evento), altrimenti il nome del ContestPOI.

## Station Reorder (Aug 2026)
- **Campo `sequenceOrder`** (Number, default 0) su Station per ordinare le postazioni di uno stand. Stesso pattern di `EventProduct.sequenceOrder` e `ContestPOI.sequenceOrder`.
- **Auto-increment** in `createStation`: `findOne({ standId }).sort({ sequenceOrder: -1 })` → `+1`. Ordine gestito per stand, non globale.
- **Sort lista**: `listStations` ordina per `sequenceOrder: 1, name: 1` (fallback alfabetico per postazioni legacy con sequenceOrder 0). I tab della cassa e le liste ereditano l'ordine dall'API.
- **Endpoint bulk**: `PATCH /api/stations/reorder` con `{ items: [{ stationId, sequenceOrder }] }` aggiorna più postazioni in una chiamata. Registrato PRIMA di `PATCH /:stationId` altrimenti `/reorder` verrebbe catturato come `:stationId`.
- **Validazione reorder**: tutti gli item devono appartenere allo stesso stand (`standId` unico) e devono esistere (404 altrimenti). Return 204.
- **Cosa NON fare**: non rinumerare con `sequenceOrder = index` senza considerare lo scope. Il frontend rinumerizza solo le postazioni dello stand corrente (1..N); i numeri possono collidere con postazioni di altri stand — accettabile perché `listStations` filtra sempre per `standId`, i pareggi sono risolti dal fallback `name`.

## EventProduct Reorder (Aug 2026)
- **Campo `sequenceOrder`** (Number, default 0) su EventProduct per ordinare il menu per stand+evento. Pattern identico a `ContestPOI.sequenceOrder`.
- **Auto-increment** in `createEventProduct`: `findOne({ eventId, standId }).sort({ sequenceOrder: -1 })` → `+1`. Ordine gestito per (evento, stand), non globale.
- **Sort lista**: `listEventProducts` ordina per `sequenceOrder: 1, createdAt: 1` (era `createdAt: -1`). Tutti i consumatori (menu, cassa, stampa, StandDetailPage) ereditano l'ordine dall'API.
- **Endpoint bulk**: `PATCH /api/event-products/reorder` con `{ items: [{ epId, sequenceOrder }] }` aggiorna più prodotti in una chiamata. Registrato PRIMA di `PATCH /:epId` altrimenti `/reorder` verrebbe catturato come `:epId`.
- **Validazione reorder**: tutti gli item devono appartenere allo stesso stand (`standId` unico) e devono esistere (404 altrimenti). Il frontend rinumerizza solo la lista filtrata per evento selezionato.
- **Cosa NON fare**: non rinumerare con `sequenceOrder = index` senza considerare lo scope. Il frontend rinumerizza solo il sottoinsieme filtrato per evento (1..N), quindi i numeri possono collidere con prodotti di altri eventi dello stesso stand — è accettabile perché le query del menu filtrano sempre per `eventId`; i pareggi in ordinamento sono risolti dal fallback `createdAt`.

## Stand Numbers (Aug 2026)
- **Campo `numbers`** su Stand: array di subdocument `{ eventId, number }` — il numero è per-evento, NON un singolo valore globale. Uno stand condiviso tra più eventi ha un numero diverso per ciascuno.
- **Auto-assign**: alla creazione dello stand e quando `updateStand` collega un nuovo evento, `number` = `count` degli stand già nell'evento (o 1). Quando un evento viene rimosso, la sua entry in `numbers` viene eliminata.
- **Sort lista**: `listStands` con `?eventId=` ordina per `numbers.number` (fallback `name` per gli stand senza numero, es. legacy). `GET /api/stands` e `/api/stands/:standId` espongono `numbers` anche senza filtro evento.
- **Endpoint bulk**: `PATCH /api/stands/reorder` con `{ eventId, items: [{ standId, number }] }`. Registrato PRIMA di `PATCH /:standId`. Valida che ogni stand abbia `eventId` tra i suoi `eventIds` (400 altrimenti), poi imposta `numbers` per ogni stand.
- **Cosa NON fare**: non usare un campo `number` singolo sullo stand — il numero deve restare coerente quando lo stand appartiene a più eventi. Al riordino il frontend invia l'intera lista degli stand dell'evento rinumerata (1..N).
- **Gotcha assegnazione `numbers`**: assegnare un array plain al campo `numbers` (DocumentArray) fallisce a compile-time in TS; usare `stand.set('numbers', array)`.

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

## Reset completo evento (Aug 2026)
- **Endpoint**: `POST /api/orders/event/:eventId/reset` (solo `platform-admin`). Elimina in un'unica transazione: `Order`, `EventUserTransaction` (acquisti E cambio), `StandSettlement`; azzera i saldi `EventUser` (balance: 0, NON elimina i portafogli), elimina i `Counter` degli stand e azzera `Event.cashRegisterResetAt`.
- **Perché azzerare i saldi**: eliminando TUTTE le transazioni (inclusi i top-up), i saldi residui sarebbero inconsistenti (crediti senza top-up a supporto). Il reset riporta ogni portafoglio a 0.
- **Cosa NON fare - Promise.all in transazione**: operazioni Mongo sulla stessa session lanciate con `Promise.all` dentro una transazione sono **flaky** (500 intermittente). Usare SEMPRE await sequenziali (vedi `resetEventOrders` in orders.controller.ts).
- **UI**: doppia conferma in `EventDetailPage` (bottone "Azzera ordini" → modale riepilogo → modale prompt con digitazione "AZZERA"). L'endpoint DELETE `/api/orders/event/:eventId` (solo ordini) esiste ancora ed è separato.

## POI form centrato sull'evento (Aug 2026)
- **MapPicker**: quando `lat`/`lng` sono vuoti (nuova entità) e viene passato `resetCenter`, il centro iniziale della mappa, il marker e le coordinate precompilate via `onChange` usano `resetCenter`. Fallback a Roma (default) solo se mancano entrambi. Questo rende il componente "anchor-aware": aprire un form legato a un evento parte già dal punto giusto.
- **Form "Nuovo POI"** in `EventDetailPage`: passa le coordinate dell'evento (`event.location.coordinates`, formato `[lng, lat]`) come `resetCenter` con label "Centra sull'evento". Il marker parte quindi sull'evento e il pulsante di reset riporta lì la vista.
- **Effetto su altri usi**: `StandsPage` passava già `resetCenter` (coordinate evento) — con il nuovo fallback anche i form stand partono centrati sull'evento. `EventsPage` non passa `resetCenter`: resta su Roma.
- **Cosa NON fare**: non chiamare `onChange` a ogni render quando le coordinate sono già valide — il prefill avviene SOLO nel mount effect quando `!hasValidCoords && hasResetCenter`.

## Ordini omaggio (gift orders) — Aug 2026
- **Modello**: `Order.isGift` (boolean, default `false`). Alla creazione (`createOrder`) con `isGift: true` il sistema forza `status: 'confirmed'`, `total: 0`, `creditAmountUsed: 0`, `paymentStatus: 'paid'`, `paidAt: now`, `performedByUserId` e `paymentTransactionId: null`. La logica di pagamento è completamente saltata (`if (paymentOnCreate && !isGift)`): un omaggio non tocca né crediti né cassa.
- **Gli item restano a prezzo reale**: ogni `orderItem` conserva `unitPrice`/`subtotal` reali (es. burger 12 € × 2 = 24), serve SOLO per contare i prodotti omaggiati. Il `total` dell'ordine resta 0.
- **Prefisso "O" solo in UI**: il `orderNumber` in DB resta il progressivo sequenziale; il prefisso "O" e il badge OMAGGIO sono puramente a livello di rendering (display coda, liste, dettaglio, ricevuta, cassa).
- **Contatore omaggi** (`GET /api/orders/gift-stats`): conta solo ordini con `status !== 'cancelled'`. `thresholdExceeded = giftPercentage > giftThreshold` (STRETTO: al 5% esatto non scatta, viene calcolato su valori non arrotondati; la percentuale esposta è arrotondata a 1 decimale). **Route registrata PRIMA di `get('/:orderId')`**, altrimenti `gift-stats` verrebbe catturato dal param route.
- **GOTCHA resoconti**: i gift sono esclusi da `paidOrders`, `cashPaymentOrders` e `mixedPaymentOrders` per costruzione (quasi tutti usano `creditAmountUsed`), MA `creditPaymentOrders` li esclude ESPLICITAMENTE con `$ne: ['$isGift', true]` perché un gift ha `creditAmountUsed === total` (0 === 0) e verrebbe contato come pagamento in crediti. Stessa logica nei `productQuantities`: `quantity` e `revenue` escludono i gift, `giftQuantity` li somma.
- **Cosa NON fare**: non applicare la soglia omaggi come blocco backend — il contatore è solo informativo (il gestore decide). Non rimuovere il prefisso "O" dalle stampa ricevute, è il segno distintivo che il cliente finale deve riconoscere.

## Dashboard eventi terminati + Resoconti con dropdown (Aug 2026)
- **Evento terminato**: `isEventFinished(eventId)` confronta `endOfDay(event.endDate) < now` con `now` catturato UNA volta al mount (`useState(() => Date.now())`). Il lint React (`react-hooks/purity`) vieta `Date.now()` nel corpo di render — NON chiamare funzioni impure direttamente in render.
- **Comportamento**: per un evento finito la dashboard non mostra più azioni (niente link Cassa/Ordini/Coda/Coda combinata, niente chip postazioni, niente Liquidazione). La sezione stand mostra comunque il select evento quando `eventIds.length > 1` per poter cambiare; uno stand senza `eventIds` non è mai "terminato". Nessun gating lato backend: è una scelta UX della dashboard operatore.
- **Resoconti**: due dropdown (evento → `/events/:id/report`; stand → `/stands/:id/orders`) + "Menu stampa", al posto della lista di pulsanti. La sezione si rende quando `eventRoles.length > 0 || stands.length > 0`.
