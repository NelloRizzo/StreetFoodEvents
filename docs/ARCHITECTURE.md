# ARCHITECTURE — Street Food Events

Considerazioni progettuali e decisioni architetturali.

> **Per una descrizione completa dell'applicazione vedere `APPLICAZIONE.md`**

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

### Download file con nome forzato (cross-origin)
- **Problema**: un `<a href="https://res.cloudinary.com/..." download="nome.pdf">` NON forza il nome del file quando l'URL è **cross-origin** — i browser (Chrome in testa) ignorano l'attributo `download` e usano il filename originale del server. Vale per i documenti `raw` di Cloudinary come per le immagini.
- **Pattern adottato** (pulsante "Scarica Regolamento" in `EventDetailPage`, funzione `downloadRegulation`): `fetch(doc.url)` → `res.blob()` → `URL.createObjectURL(blob)` → crea un `<a>` temporaneo in `document.body` con `anchor.download = nome-desiderato` → `click()` → rimozione e `URL.revokeObjectURL`. Funziona perché ora l'URL è same-origin (object URL) e il `download` viene rispettato.
- **Prerequisito CORS**: Cloudinary serve le risposte con `Access-Control-Allow-Origin: *`, quindi la fetch cross-origin funziona dal browser (stesso requisito già usato dalle immagini del poster social).
- **Fallback**: se la `fetch` fallisce (blob nella cache, rete, o futuro hosting non-CORS), `catch` → `window.open(doc.url, '_blank', 'noopener,noreferrer')` per non perdere l'accesso al documento.

## CORS — header custom nel frontend
- **Prerequisito**: ogni header custom inviato dal browser in una richiesta cross-origin (es. `x-access-token` per l'adesione stand anonima) DEVE essere elencato in `allowedHeaders` della config `cors()` in `backend/src/app.ts` (più `Access-Control-Allow-Headers` nel preflight). Header non dichiarati → blocco preflight (`Request header field ... is not allowed by Access-Control-Allow-Headers`), errore solo in produzione (in locale non scatta perché il Vite proxy è same-origin).
- **Come evitarlo**: quando si aggiunge un header custom sul fronte (`getsTokenHeaders`, `Authorization`, ecc.), verificare subito che sia in `allowedHeaders: ['Content-Type', 'Cookie', 'Authorization', 'x-access-token']`. I test vitest NON lo coprono (non passano da CORS) — il check va fatto manualmente su Render.
- **Nome file**: `regolamento-<nome-evento-normalizzato>-<anno-inizio>.pdf` — normalizzazione ASCII (`normalize('NFD')` + rimozione diacritici + `[^a-zA-Z0-9_-]` → `-`, lowercase, ripiegamento `-+`/trim).
- **Cosa NON fare**: NON affidarsi solo all'attributo `download` su URL Cloudinary cross-origin per forzare il nome; NON usare `<a target="_blank">` come unica modalità quando serve scaricare il file col nome giusto.

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
- **Parametro `?public=true` su `GET /api/events`**: le superfici PUBBLICHE (HomePage "Eventi in programma", dropdown Eventi della Navbar) chiamano `GET /api/events?public=true`, che forza `isPublic: { $ne: false }` anche per i gestori — un evento nascosto NON deve mai comparire in una lista pubblica, nemmeno all'operatore loggato. Il filtro `$ne: false` (invece di `true`) include anche gli eventi creati prima dell'aggiunta del campo `isPublic` (campo assente nel documento = non false = pubblico). Le superfici operative (EventsPage Gestione, dropdown Resoconti, EventProductsPage, ecc.) chiamano `GET /api/events` senza parametro e vedono TUTTI gli eventi. Il dropdown Resoconti della Navbar carica gli eventi da solo (`/events` senza `public`): NON riusare lo stato degli eventi pubblici del dropdown Eventi, o gli eventi nascosti sparirebbero anche dai Resoconti.
- `GET /api/events/home` (`homeEvents`) esclude sempre gli eventi non pubblici da `activeEvents` (il dashboard "utente" è una superficie pubblica).
- **Cosa NON fare**: NON nascondere l'evento da `GET /events/:eventId` — molte pagine pubbliche/operative (ricevute ordine, contest, galleria, menu stand) risolvono l'evento per ID e verrebbero rotte. La visibilità si controlla solo nei listing. Non confondere il filtro client-side di `EventsPage` (`adminEventIds`) con quello server-side: il backend filtra già per gestore, il client filtra ulteriormente per mostrare solo gli eventi assegnati.

## Backend
- Express + Mongoose + argon2 session auth. ESM, TypeScript, Node ≥22.
- MongoDB requires a replica set (`replicaSet=rs0`) because Mongoose transactions are used.
- Path alias: `@/*` maps to `./src/*`.
- Env vars validated at startup via Zod. Missing vars cause immediate `process.exit(1)`.
- Cloudinary for all image uploads.

## Pattern Architetturali Fondamentali
- **Controller Pattern**: ogni entità ha un controller (`*.controller.ts`) con funzioni esportate
- **Routes Pattern**: ogni entità ha routes (`*.routes.ts`) che usano i controller
- **Model Pattern**: ogni entità ha un modello Mongoose (`*.model.ts`) con Schema e tipo
- **Response Pattern**: funzioni `toXxxResponse()` per trasformare i documenti Mongoose in risposte API
- **Error Pattern**: `AppError` per errori custom, status code nel constructor
- **Auth Pattern**: `authMiddleware` per route protette, `optionalAuthMiddleware` per route pubbliche con filtro utente
- **Pagination Pattern**: `page`/`limit` query params, risposta con `{ items, total, page, limit }`
- **Sort Pattern**: `sortBy`/`sortOrder` query params con default per ogni entità
- **Filter Pattern**: query params per filtrare (`?status=`, `?eventId=`, ecc.)
- **Bulk Pattern**: endpoint `PATCH /reorder` per aggiornamenti multipli (POST/DELETE multipli)
- **Nested Route Pattern**: route annidate con `mergeParams: true` (es. `/api/events/:eventId/photos`)
- **Transaction Pattern**: `mongoose.startSession()` + `session.withTransaction()` per operazioni atomiche
- **Image Upload Pattern**: multer middleware → Cloudinary upload → salva solo metadata in DB
- **QR Code Pattern**: `qrcode` npm package → data URL → HTML puro per stampa
- **Print Pattern**: `window.open()` + `document.write()` + `window.print()` per stampa senza conflitti CSS

## AdminEventContext — selezione evento centralizzata (admin)
- **Pattern**: `AdminLayout` carica gli eventi (`GET /api/events` senza `public`) e fornisce via `AdminEventContext.Provider` `{ selectedEventId, selectedEvent, events }` a sidebar e pagine. `AdminSidebar` (combo "Evento attivo") e `AdminTopBar` consumano lo stesso context — mai due sorgenti di verità.
- **Risoluzione `selectedEventId`**: (1) evento nell'URL (solo route `/admin/events/:eventId/...`), (2) `localStorage['adminSelectedEventId']`, (3) default primo evento in corso (`endOfDay(endDate) >= now`), fallback `events[0]`.
- **`handleSelectEvent`**: salva in `localStorage`, aggiorna il context e **naviga SEMPRE a `/admin/dashboard`** quando l'evento scelto è diverso da quello corrente. Niente rewrite URL sulla stessa pagina: pagine come StandDetailPage/StandManagePage mostrano tutti gli eventi di uno stand, quindi si torna alla dashboard per evitare stati incoerenti col nuovo evento.
- **Cosa NON fare**: NON aggiungere una propria combo/nuovo fetch eventi a una pagina admin fisica — il context arriva dall'alto e gli eventi context sono minimali (`{ id, name, endDate? }`). Se una pagina serve l'evento completo (currencyName, logo, coverImage, promo) il fetch locale `GET /events` per i DETTAGLI è lecito, ma la SELEZIONE dell'evento mai. Eccezioni legittime (selettori come campi di modulo, non come filtro pagina): form prodotto in `EventProductsPage`/`StandDetailPage`, assegnazione ruolo event-scope in `UserRolesPage`, evento nel form contratto.
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

## Pubblicazione social Meta (Aug 2026)
- **Decisioni**: account UNICO della piattaforma (no OAuth multi-tenant: Standard Access senza App Review, token Page long-lived via env), trigger manuale dalla galleria (photo-admin seleziona e pubblica), solo Meta. TikTok escluso (richiede audit app). Env opzionali: `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`, `META_IG_USER_ID` - se assenti la feature e' silenziosamente disattivata (`GET /social/config` risponde false).
- **Variante Facebook Login per Instagram**: SI usa `graph.facebook.com` con lo STESSO Page access token (permessi `instagram_content_publish`), NON `graph.instagram.com`. Flusso IG asincrono a 3 step: container (`POST /{ig-user-id}/media` con `image_url`) -> polling `status_code` fino a FINISHED -> `media_publish` con `creation_id`. Solo immagini JPEG; le foto sono gia' su Cloudinary con URL pubblico (Meta fa fetch dall'URL).
- **Coda in-process** (`social-publish.service.ts`): modello `SocialPost { eventId, photoId, platform, caption, status pending/processing/published/failed, attempts, nextAttemptAt, lastError }`. Worker = `setInterval` avviato da `server.ts` (Render free = 1 processo, quindi in-process va bene); batch di 10, retry max 3 con backoff `attempts * 60s`. Export `runSocialPublishQueueOnce()` per i test. Piattaforma non configurata => post `failed` IMMEDIATO alla creazione (feedback istantaneo all'utente, non dopo il retry).
- **Validazioni**: solo immagini (video -> 400), foto devono appartenere all'evento (altrimenti 404), caption opzionale trimmata.
- **Test**: mock di `@/config/env` con getter mutabili via `vi.hoisted` (per testare sia configurato che non configurato nello stesso file) + `vi.stubGlobal('fetch', ...)` che instrada sugli URL Graph attesi.
- **GOTCHA insertMany + tipi**: `insertMany` restituisce documenti con tipi parziali (campi default non inferiti) - per rispondere con tipi completi ricaricare con `find({ _id: { $in: ids } })`.
- **Cosa NON fare**: non pubblicare al momento dell'upload della foto (rate limit Meta, rischio errore 368 anti-spam su burst di foto simili) - la coda con backoff e' obbligatoria. Non usare `Set`/`includes` per deduplicare: ogni foto x piattaforma e' un post separato (N foto x M piattaforme = N*M documenti).

## Photo booth pubblico + cornice di evento (Aug 2026)
- **Upload anonimo immagini**: `POST /api/events/:eventId/photos` usa `optionalAuthMiddleware` (NON piu' authMiddleware); nel controller, upload video senza utente -> 401. `createdBy` resta null per gli anonimi (`GET /photos/mine` aggrega su createdBy e li ignora naturalmente). Non aggiungere rate-limit lato client: se serve protezione, farla a livello Render/proxy.
- **Cornice di evento**: `Event.defaultFrameId` riferisce il modello Frame GLOBALE (`/api/frames`, quello usato dal photo booth), NON EventFrame (per-evento, endpoint `/api/events/:eventId/frames` - sistema separato non usato dal booth). Set via PATCH evento con validazione null|ObjectId; esposto in `toEventResponse` quindi visibile anche pubblicamente.
- **PhotoBoothPage**: se `defaultFrameId` impostata ed esiste nella lista frame -> auto-selezionata e selettore NASCOSTO al visitatore. Se la cornice di default e' stata cancellata ma il campo punta ancora ad essa, il booth mostra comunque la cornice "attiva" senza nome: accettabile, l'admin vede la dropdown incoerente in galleria.

## Analytics / Google Tag Manager con Consent Mode v2 (Set 2026)
- **Consent Mode v2**: il consenso analytics/ads parte `denied` di default. `initGTM(consent)` pusha i default (`consent: 'default'`) PRIMA di caricare `gtm.js` e poi applica il consenso scelto via `updateConsent(consent)`. La scelta del banner (Accept/Reject) aggiorna il consenso e, se GTM non era ancora caricato, lo carica. Consent Mode e' il pattern corretto per caricare GTM/GA4 in modo GDPR-compliant.
- **ID GTM**: si legge da `VITE_GTM_ID` (vuoto = analytics disattivo). NON esiste piu' un GA4 ID hardcoded: i tag (GA4, eventi, ecc.) si configurano SOLO nel container GTM ascoltando gli eventi del dataLayer.
- **Eventi custom (namespace `sfe_*`)**: `sfe_order_created` (creazione ordine da menu), `sfe_currency_exchange` (top-up/refund cassa cambio), `sfe_poi_scanned` (scansione POI contest), `sfe_photos_email_sent` (invio foto via email dalla galleria). Definizioni in `frontend/src/lib/analytics.ts`.
- **Contesto nel dataLayer**: `PublicLayout` pusha `context_set` con `user_role` (guest/user/admin), `analytics_event_id`, `analytics_stand_id` presi dai param di route, per segmentare in GTM.
- **Scope**: il tracking riguarda le pagine pubbliche (dentro `PublicLayout`); le pagine admin (AdminLayout) NON sono tracciate.
- **GOTCHA**: `trackPageView` e gli eventi passano SEMPRE dal dataLayer; i tag GTM rispettano il consent (Consent Mode) cosi' i tag analitici non sparano prima del consenso. Non riattaccare `gtag('config', 'G-...')` fisso: verrebbe ignorato e reintrodurrebbe l'ID segnaposto.
- **Cosa NON fare**: non caricare GA4 direttamente con script proprio a fianco di GTM (double-instrumentation); non pushare PII (email, nomi) negli eventi del dataLayer.

## Modulo di adesione stand (Set 2026)
- **Modello**: `AdhesionForm` (collezione `adhesionforms`) — UNA per evento (`eventId` con unique index), `sections` array di subdocument `{ slug, title, content, generatedFrom }` (`_id: false`), più `eventFingerprint`, `generatedAt`, `stale`. Content è HTML string.
- **Sezioni (11, ordine esatto)**: `event-header`, `stand-data`, `products`, `haccp`, `currency`, `energy`, `fees`, `participation-price`, `deposit`, `regulation`, `outcome`. `GUIDED_SLUGS = ['event-header','currency','fees']` sono RITRATTE dal servizio (`generatedFrom` set) e sovrascritte a ogni rigenerazione; le altre sezioni con `generatedFrom: null` sono "manuali" e vengono PRESERVATE (fino al loro titolo) quando si rigenera il modulo. Salvate rigorosamente in ordine `buildSectionsFromEvent` (currency intercalata dopo haccp, fees dopo energy).
- **Staleness**: `computeEventFingerprint(event)` = sha256 su name/location(startDate/endDate/currencyName/currencySymbol.url/exchangeRate/feeBands. Se il fingerprint cambia alla PATCH evento (`updateEvent` in `events.controller.ts`, dopo `event.save()`) → `markAdhesionFormStaleIfChanged` set `stale: true` e la risposta PATCH include `adhesionFormStale: true`. Campo testato: modificare `shortDescription` NON marca stale (fuori dal fingerprint). Niente watcher Database Change Streams: la staleness è calcolata nel punto di scrittura.
- **API**: `GET /api/events/:eventId/adhesion-form` (PUBBLICO, 200 `{item}` o 404); `POST /generate` (crea 201 o rigenera 200); `PATCH` con `{ sections }` non vuoto (sostituisce TUTTE le sezioni, `generatedFrom` preservato lato server — il client adatta solo content/title); `DELETE` → 204. Guard PATCH/DELETE/generate: `event-admin` / `platform-admin`.
- **Layout route con `mergeParams: true`** (pattern per router nidificati sotto `/api/events/:eventId/...`, vedi adesione, foto, menu-qrcode).
- **Sanitizer contenuti**: sul backend si sanitizzano i content in PATCH/generate (whitelist tag p/br/strong/em/u/s/**mark**/h1-h6/ul/ol/li/blockquote/pre/code/a/**img** con attributi src/alt/width/height — `img` e `mark` introdotti per il logo e l'evidenziazione della moneta, scheme http/https via `allowedSchemesAppliedToAttributes`). MAI generare `<table>` proveniente dall'HTML dell'evento: il sanitizer lo scarta. Nei contenuti generati gli importi/valori monetari non si mettono mai come simbolo nudo (`€`/`euro`) ma come **logo della moneta** (`currencySymbol.url` come `<img>`) oppure iniziale in circoletto unicode (`Ⓣ`); il nome della moneta appare **evidenziato** (`<mark><strong>NOME</strong></mark>`) accanto al logo. Stessa regola degli export social. La logica è isolata in `backend/src/services/adhesion-form.service.ts` (`isBareCurrencySymbol` regex `/^[^\p{L}\p{N}]$/u`), non condivisa col frontend.
- **Frontend**:
  - Pagina stampabile PUBBLICA `AdhesionFormPublicPage` su `/events/:eventId/adhesion-form` (standalone, fuori AdminLayout): fetch `GET .../adhesion-form` (404 → "non ancora disponibile"), sezioni renderizzate in A4 portrait con `@media print` (bottone stampa `.no-print`). Linkato da "Scarica modulo di adesione" in `EventDetailPage`.
  - Pagina GESTIONE `AdhesionFormManagePage` su `/admin/events/:eventId/adhesion-form` (solo event-admin/platform-admin): genera/rigenera/salva (PATCH con TUTTE le sezioni), elimina con ConfirmModal, banner giallo "obsoleto" quando `stale`; ogni sezione ha titolo editabile + `RichEditor` (remount via `editorVersion` quando cambia sezione selezionata); badge "Auto dall'evento" (GUIDED) / "Manuale". Link "Adesione" su ogni card evento in `EventsPage` (Gestione).
  - **Alert stale da `EventsPage`**: la PATCH evento (edit) ora legge `data.adhesionFormStale` dalla risposta: se `true` mostra un avviso che invita a rigenerare il modulo dalla pagina di gestione.
- **GOTCHA**: il contenuto del modulo è HTML; quando si salva PATCH il client manda `{ sections: [...] }` con le stesse `slug`/`title`/`content` che ha ricevuto (mai nuovo slug), altrimenti 400. Non usare `content` proveniente da utenti non fidati senza sanitizer.

## Wizard di adesione stand (Set 2026)

- **Modello**: `StandAdhesion` (collezione `standadhesions`), index `{ eventId, standId }` **non unico** (`standId` è nullable: per uno stand NUOVO è `null`, quindi servono righe multiple con lo stesso `eventId` + `standId: null` — un indice unico le bloccherebbe). Denormalizza i dati dello stand (`standName`, `standType`, `coverImage`, `logo`, `pitch`, `contact`) così lo storico resta valido anche se lo stand cambia. `products` (array di subdocument senza `_id`), `haccp.confirmed`, `energyNeeds` (righe `{ description, powerKw, connectionType }`, optional), flags di accettazione (`acceptsPointLight`, `participationFeeAccepted`, `depositAccepted`, `regulationAccepted`, `exclusionAccepted`, `energyConditionsAccepted`), `signature` (str) e `status` + `submittedAt`. `review` subdocument per il rifiuto (`{ status, note, reviewedBy, reviewedAt }`). Campi nuovi: **`userId`** (ObjectId→User, default null — proprietario utente dell'adesione, posto al create se loggato oppure al submit per i nuovi stand) e **`accessTokenHash`** (sha256 dell'access token, default null).
- **`Event.participationFee`/`deposit` (Number, default null)**: SOLO informativi, esposti in `toEventResponse` e copiati da `duplicateEvent`. Aggiunte le scadenze **`participationFeeDeadline`/`depositDeadline`** (Date, default null) accanto ai due importi, gestite in create/update/response; il **duplicato evento NON le copia** (nuova edizione → null). Il wizard li mostra come importi (+ scadenza "saldo entro il …") + checkbox di accettazione: NESSUN pagamento online (Payment Gateway fuori scope).
- **Accesso pubblico e anonimo**: `createAdhesion` è su `optionalAuthMiddleware` — senza login si può creare UN'ADESIONE PER UNO STAND NUOVO (senza `standId`); con `standId` servono admin di evento o owner dello stand. **Gate regolamento**: senza `event.regulationDocument` → 400 ("disponibile solo se l'organizzazione ha pubblicato il regolamento"); il wizard frontend non compila e mostra l'avviso. Ogni create genera un **access token** (random 32 byte, solo l'**hash** sha256 finisce in `accessTokenHash`) restituito nella response (`accessToken`); il browser lo conserva in `localStorage` (`sfe_adhesion_access_token_<eventId>`) e lo invia come header **`x-access-token`**. Tutte le route CRUD/mine/submit/withdraw sono su `optionalAuthMiddleware` e autorizzano per (a) utente: `userId` match, admin evento, possesso stand, OPPURE (b) token valido (`hashAdhesionToken(token) === accessTokenHash`). `hasRole` NON è usato per queste (solo per approve/reject).
- **Creazione utente al submit** (solo per nuovi stand, `!standId`): `ensureOwnerUser` crea un utente **INATTIVO** (`passwordHash: null`, token attivazione, invito via `sendActivationEmail`) da `contactName`/`contactEmail` OPPURE riusa l'utente esistente con la stessa email; setta `adhesion.userId`. La response del submit include `activationUrl` (quando l'email non è inviabile) e `emailSent`. La completezza del submit per i nuovi stand richiede ANCHE `contactName` + `contactEmail`.
- **Transizioni**: `draft → submitted → approved/rejected`. `submit` valida la completezza (`completenessErrors` → 400, campi: standName, haccpConfirmed, acceptsPointLight, participationFeeAccepted, depositAccepted, regulationAccepted, exclusionAccepted, signature non vuota; + nome/email referente se nuovo stand); il edit di una `submitted` la riporta a `draft` con `submittedAt: null`; `approved` → 409 su edit e withdraw; `withdraw` solo da `submitted`.
- **Guard**: approvare/rifiutare = `authMiddleware` + `hasRole(['event-admin'], { eventParam: 'eventId' })` — match per SLUG quindi **platform-admin è ESCLUSO** (il suo ruolo ha slug `platform-admin`). TUTTE le altre route (CRUD/mine/submit/withdraw) usano `optionalAuthMiddleware` + check custom: `isAdminForEvent` (ruoli platform/event, incluso `eventId: null`/assente) OPPURE possesso dello stand (ruoli stand-scope) OPPURE `userId` dell'adesione OPPURE access token (vedi sopra). Chi non ha alcun titolo → **404** (nessun leak informativo). `GET /adhesions/mine` → `{ item: null }` quando non esiste, `{ item }` altrimenti (anche rejected).
- **Approvazione CREA lo stand per le adesioni senza `standId`**: `approve` quando `!adhesion.standId` crea uno `Stand` con `type`/`name`/`slogan`/`description`, `coverImage` = banner dell'adesione, `logo`, `eventIds: [event]`, **numero progressivo per evento** (`nextStandNumber` in `utils/stand-number.ts`, estratto da `stands.controller`) e se `adhesion.userId` esiste assegna il ruolo **`stand-admin`** (scope stand, upsert `UserRoleModel`) all'utente. NON importa `EventProduct` dall'adesione. Per le adesioni CON `standId` l'approvazione non tocca lo stand (collegamento già esistente).
- **Frontend lint GOTCHA** (Set 2026): la regola `react-hooks/set-state-in-effect` (arrivata con react-hooks v7) è **disattivata di proposito** in `frontend/eslint.config.js` — flagga `void load()` / `void fetchItems()` invocati sincronicamente nel corpo di un `useEffect`, anche se la funzione è async e le setState avvengono solo dopo gli await. Pattern comunque preferito nel repo: catene `.then(...)` INLINE nel useEffect oppure IIFE async con tutte le setState dopo il primo await; per il re-fetch post-azione (approve/reject) si tiene la funzione `useCallback` usata fuori dal primo effect. `react-refresh/only-export-components` è anch'essa disattivata (helper condivisi esportati da `CurrencyDisplay`/`CategorySelect` + hook da `auth-context`/`ThemeProvider` usati in molti file). `ConfirmModal` NON accetta `children` → la nota di rifiuto passa da `variant="prompt"`.
- **Rotte frontend**: il wizard è PUBLIC su `/events/:eventId/stand-adhesion` (PublicLayout) e resta sotto AdminLayout su `/admin/events/:eventId/stand-adhesion` (stesso componente); `EventDetailPage` linka quello pubblico. In `router.tsx` le due viste (public/admin) montano lo STESSO elemento.

## Promozioni e Coupon (Set 2026)

### Modello e tipi
- **`Promotion`** (collezione `promotions`): `eventId`, `code` (unique per codice normalizzato uppercase), `title`, `type` (`discount` | `product` | `value`), `standId` (null = tutti gli stand), `isActive`, `expiresAt`, `maxPresentations` (limite totale, null = illimitato) e `perUserLimit` (limite per cliente). Campi specifici per tipo:
  - `discount`: `discountType` (`percent` | `fixed`, default `percent`) + `discountValue` (percentuale 1-100 oppure importo in crediti).
  - `product`: `eventProductId` (prodotto del menu dell'evento) + `formula { paid, total }` (null = regalo semplice; 2x1 = {1,2}, 3x2 = {2,3}) + `formulaMaxFree` (cap pezzi gratis per presentazione, null = illimitato).
  - `value`: `valueAmount` (importo del buono in crediti, riscattabile sul wallet del cliente).
- **`PromotionUsage`** (collezione `promotionusages`): una riga per utilizzo del coupon — `promotionId`, `code`, `eventId`, `orderId`, `eventUserId`, `type`, `discountAmount`, `freeUnits`, `valueAmount`, `appliedBy`. Storico per report e per il conteggio per-user.

### Regole di consumo
- Ogni **ordine** con coupon applicato = **1 presentazione** (`usedCount++`, incrementato in `consumePromotion`) — NON restituita se l'ordine viene annullato.
- `maxPresentations` = limitazioni per presentazione TOTALE; `perUserLimit` = limite per cliente, verificato contando i `PromotionUsage` per `promotionId` + `eventUserId`.
- Le formule valgono su un prodotto specifico: nel riepilogo si accoppiano le righe con `eventProductId === coupon.eventProductId`; `freeUnits = floor(quantity/total) * (total - paid)` con cap `formulaMaxFree` sulla presentazione; il resto non multiplo si paga per intero.
- **Sconto percentuale vs crediti**: uno sconto `percent` NON puo` essere usato in un pagamento in crediti (sarebbe un doppio sconto ambiguo). Blocco **server** in `createOrder`/`payOrder` (PromotionError) e guardia **client** in `handleSubmit` delle due cacce.

### API
- `/api/events/:eventId/promotions` (CRUD, `event-admin`/`platform-admin`), `GET /:promotionId/qrcode`, `GET /:promotionId/usage`, `POST /validate` (auth, restituisce `{ valid, item }` o `{ valid:false, message }`), `POST /redeem-value` (riscatto buono valore — accredita crediti al cliente con `EventUserTransaction` `type: 'promotion'` `direction: 'credit'`). DELETE rifiutato se il coupon ha gi� `usedCount > 0` (disattivare invece di eliminare per conservare lo storico).
- Il QR codifica il `code` del coupon (`qrcode.toDataURL(code)`), incluso nella lista `GET /promotions` e scaricabile.

### Gestione quantita` (GOTCHAS importanti)
- **Express 5 + `Router({ mergeParams: true })`**: ogni sub-router montato sotto `/api/events/:eventId/...` (promotions, photos, frames, social, adhesion-form) DEVE usare `Router({ mergeParams: true })`, altrimenti `req.params` risulta vuoto `{}` e `req.params.eventId` e` `undefined`.
- **Filtri campo-vs-campo con `$expr`**: un filtro che confronta due path numerici dello stesso documento (es. promozioni non esaurite: `maxPresentations > usedCount`) NON si scrive `{ maxPresentations: { $gt: '$usedCount' } }` (causa `Cast to Number failed for value "$usedCount"` perché` Mongo cerca di castare la STRINGA `$usedCount` a numero). Si usa `$expr` con array: `{ $expr: { $or: [ { $eq: ['$maxPresentations', null] }, { $gt: ['$maxPresentations', '$usedCount'] } ] } }`.
- **Per-user limit**: serve che il `PromotionUsage` degli ORDINI abbia `eventUserId` valorizzato. In `createOrder` si risolve l'EventUser con `EventUserModel.findOne({ eventId, userId: effectiveCustomerId })` (il cliente puo` essere anonimo senza userId → `eventUserId: null`).

### Report
- Report event/stand includono `coupons = { totalAppliedOrders, totalDiscountAmount, byPromotion: [{ promotionId, code, title, type, presentations, discountAmount, freeUnits, valueAmount }] }` e `discountAmount` nei `totals`/`summary`. Gli importi sconto NON riducono il fatturato lordo (restano una misura separata informativa).

### Frontend
- Componente riusabile `CouponPanel` (input codice + scan QR via `QRScanner` 7 `validatePromotionCode`; anteprima sconto speculare al server con `computeCouponDiscount`; buoni valore mostrano info + link a Cambio Valuta senza riscatto inline - manca una rotta "lista eventUsers per evento" accessibile senza permessi exchange). Le due cacce lo montano dentro il blocco carrello (nascosto quando `isGift`).
- Pagina admin `/admin/events/:eventId/promotions`: lista con QR inline + download (`QRCodeDownload`-like via `<a download>` su object URL generato da fetch), form condizionale per tipo, storico utilizzi (`fetchPromotionUsage`), attiva/disattiva. Voce in `AdminSidebar` (Gestione).
- Ricevute (stampa inclusa) e modale di conferma cassa mostrano le righe "Sconto (CODE) -X" e "Prodotti in omaggio: N" dai campi `discountAmount`/`freeUnits` dell'ordine.

## Sync remoto — password per stand (Set 2026)

### Autenticazione a due livelli
- **Gate infrastrutturale**: `SYNC_API_TOKEN` globale (env) protege TUTTE le API `/api/sync` (`Authorization: Bearer`). È il "client autorizzato".
- **Autorizzazione per entità**: la **password di sincronizzazione per-stand** (`Stand.syncPasswordHash`, hash argon2, min 8 max 128 char) autorizza il notebook a importare QUELLO stand e a pusherare LE SUE modifiche. Inviata nell'header **`X-Sync-Password`** su snapshot e push.
- Root cause della scelta "per stand" (non per evento): ogni stand ha un operatore autonomo sul proprio notebook; una password di evento sarebbe condivisa tra stand concorrenti. Revoca semplice: il platform/event-admin cambia/rimuove la password → i notebook con la vecchia non si sincronizzano più.

### Semantica errori della password
- **403** = stand NON ha password configurata ("Password di sincronizzazione non configurata per questo stand"); **401** = password mancante o errata ("Password di sincronizzazione non valida"). Distinte per non confondere l'operatore (403 = problema di configurazione remota, 401 = password sbagliata).
- `GET /api/stands` e la lista remota `/sync/events/:eventId/stands` espongono `syncEnabled: Boolean(syncPasswordHash)` (senza la password) così l'UI locale marca gli stand pronti e blocca l'import di stand con sync disabilitata.

### Gestione password
- `PATCH /api/stands/:standId/sync-password` (guard `hasRole(['platform-admin','event-admin'])` — gli stand-admin NON possono). Body `{ syncPassword }`: stringa >= 8 → argon2.hash e salva; stringa vuota/null/undefined → azzera (hash → null). Risposta `{ item: { id, syncPasswordSet } }` (bool), MAI l'hash.
- **UI solo cloud** in `StandManagePage` (sezione "Sincronizzazione app locale (notebook)"), visibile a platform-admin o event-admin dell'evento selezionato. Il valore della password NON è mai esposto in chiaro — solo lo stato attiva/non attiva.

### Lato app locale (`.local/`)
- `LocalState.syncPassword` memorizza la password in **plaintext sul device dell'operatore** (necessaria per i push successivi; la UI non la mostra mai, solo `hasSyncPassword` dal meta). Salvata automaticamente al primo import riuscito; endpooint locale `POST /api/sync/password` per salvarla a priori (usata in push senza re-import).
- Il push locale invia `body.standId` (l'`remoteStandId` dell'import) + header `X-Sync-Password`; senza stand importato o senza password il push locale non parte (`errors` con messaggio chiaro nel pannello Sync).
- **GOTCHA**: cambiare password sul cloud NON invalida un notebook già importato (continuerebbe a pusherare con la vecchia? NO — il push fallisce con 401 e il messaggio d'errore appare nel pannello; il `SyncLedger` resta `pending` finché l'operatore non salva la nuova password dal `POST /api/sync/password`).
- **GOTCHA**: `getSyncSnapshot` NON deve mai rispondere con `syncPasswordHash` (strip via clone+delete). Risolverlo col `delete (standSafe as any).syncPasswordHash` evita il lint `no-unused-vars` di un `_destructure`.

### GOTCHAS visti nella pratica
- **Mai** passare la password nella query string o nei log; solo header.
- Validazione password SOLO al momento dell'impostazione (argon2 lato server); confronto in `verifyStandSyncPassword` con `argon2.verify` asincrono — dentro `pushSyncChanges` va fatto PRIMA di iniziare gli upsert (nessun dato scritto se la password è errata).
