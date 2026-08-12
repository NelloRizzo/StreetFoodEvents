# CHANGELOG — Street Food Events

Tutte le feature implementate, in ordine cronologico.

## Luglio 2026
- Slideshow, galleria, invio email foto, stampa full-page.
- Contest: caccia ai POI con QR code, partecipazione anonima, ruoli contest-admin.

## Agosto 2026
- Numeri progressivi degli stand per evento: campo `number` in `Stand.numbers` (array per-evento), auto-assign alla creazione/collegamento stand, endpoint bulk `PATCH /stands/reorder` che riordina e rinumerizza, sort liste per numero. In `EventDetailPage` badge con il numero su ogni card + pulsanti ▲/▼ per riordinare; in `EventMapPage` marker numerati con legenda.
- Video nella galleria foto: `EventPhoto` supporta il tipo media (`image` | `video`) con subdocument video (url, publicId, duration). `POST /api/events/:eventId/photos` accetta multipart con campo `image` OPPURE `video` (multer dedicato, limite 100 MB), delete rispetta il `resource_type` Cloudinary. In `EventGalleryPage` pulsante "Carica video" (photo-admin), card video con riproduzione, stampa ed email solo per le foto. In `SlideshowPage` i video girano muted in griglia e con controlli nel modale.
- Invio email di più foto in un'unica email: endpoint `POST /api/events/:eventId/photos/send-email` (photo-print / photo-admin / platform-admin) che accetta `{ email, photoIds, marketingConsent }` e invia tutte le foto selezionate a un unico indirizzo (solo immagini; se tra le selezionate c'è un video → 400). `email.service.sendPhotosEmail` genera una email con una immagine per foto. In `EventGalleryPage` pulsante "Invia selezionate via email" nella toolbar quando ci sono foto selezionate.
- Galleria interattiva: il click su una foto/video la apre in un lightbox a schermo intero (con numero in basso a destra); la selezione multipla avviene solo col pallino in alto a destra di ogni card (toggle con stopPropagation), non più col click sulla card.
- Dashboard: link diretto "Cassa" per ogni stand (`/events/:eventId/stands/:standId/order`) accanto a "Coda Ordini", mostrato solo se autorizzato (platform-admin, ruolo stand `cashier`, oppure `event-admin`/`event-cashier` per l'evento dello stand).
- Resoconto liquidazioni per evento (`/events/:eventId/settlements/report`): riepilogo aggregato per stand di tutte le liquidazioni (numero, crediti liquidati, lordo €, trattenuta €, erogato €) con colonne di riferimento «crediti guadagnati» e «residuo da liquidare» dall'intero evento, totali evento, filtro per data di liquidazione e pulsante stampa. Endpoint `GET /api/exchange/:eventId/settlements/report` (exchange-admin / platform-admin).
- Pagina menu pubblico dello stand (`/events/:eventId/stands/:standId`): mostrata la `coverImage` dello stand come banner grande in testata e come logo circolare accanto al titolo; per ogni prodotto del menu thumbnail dell'immagine cover quando presente.
- Reset completo evento: endpoint `POST /api/orders/event/:eventId/reset` (solo platform-admin) che in un'unica transazione elimina ordini, tutte le transazioni (acquisti e cambio carichi/rimborsi), le liquidazioni stand, azzera i saldi dei portafogli, i contatori ordini e la data di azzeramento cassa. UI in EventDetailPage con doppia conferma: bottone "Azzera ordini" → modale riepilogo → modale prompt con digitazione di "AZZERA".
- Pagina Cambio: quando si crea un nuovo cliente il pulsante lo seleziona automaticamente nella combo laterale; in assenza di selezione, viene selezionato di default il Cliente Generico.
- Form POI: quando si aggiunge un nuovo Punto di Interesse la mappa viene centrata per default sull'evento (marker preimpostato sulle coordinate dell'evento) con pulsante "Centra sull'evento".
- Riordino postazioni per stand: campo `sequenceOrder` su Station, auto-increment per stand, sort lista per `sequenceOrder`, endpoint bulk `PATCH /stations/reorder`, pulsanti ▲/▼ in StandDetailPage. I tab della cassa (CashierOrderPage, EventCashierPage) e le altre liste ereditano l'ordine dall'API.
- Riordino menu per stand: campo `sequenceOrder` su EventProduct, auto-increment per evento+stand, sort lista per `sequenceOrder`, endpoint bulk `PATCH /event-products/reorder`, pulsanti ▲/▼ in StandDetailPage (per evento selezionato).
- Coda Ordini per stand: display pubblico fullscreen degli ordini in lavorazione (confirmed/preparing/ready) con avanzamento articoli per postazione, polling ogni 5s. Route: `/events/:eventId/stands/:standId/ordersqueue`.
- Timeout ordini "Pronto" nel display: campo `readyAt` su Order valorizzato alla transizione a `ready` (updateStatus, markStationReady, markItemReady, cancelOrderItems). La coda display (`GET /api/orders/stand/:standId/ordersqueue`) esclude gli ordini `ready` più vecchi di `STAND_DISPLAY_READY_TIMEOUT_MINUTES` (default 2), così le card "Pronto" spariscono dopo il ritiro.
- Moneta evento personalizzata (nome + simbolo immagine): icona visibile in tutti i prezzi, saldi, menu, carrelli, ricevute (stampa inclusa) e resoconti. Componente condiviso `CurrencyDisplay`.
- Resoconti eventi/stand: totali convertiti in euro tramite `exchangeRate` (importo ÷ rate) con badge moneta evento per i valori non convertiti.
- Liquidazione stand a fine serata: pagina `/events/:eventId/settlements` dove il gestore seleziona lo stand, inserisce i crediti presentati (valore libero, il report è solo informativo), la percentuale di trattenuta (default 0) e il sistema calcola il corrispettivo in euro (crediti ÷ cambio, meno trattenuta). Modello `StandSettlement` con snapshot di `exchangeRate`, storico liquidazioni con totali e operatore.
- Dare/Avere sulla liquidazione stand: campo `direction` su `StandSettlement` (`debit` = DARE, carico crediti allo stand senza pagamento in euro, da restituire in liquidazione; `credit` = AVERE, liquidazione con pagamento in euro). Riepilogo stand con caricati/liquidati/da restituire (DARE − AVERE), resoconto per evento con colonne separate, storico filtrato per direzione e badge DARE/AVERE. Documento stampabile di ricevuta in `docs/RICEVUTA_LIQUIDAZIONE.md`.

## Feature Checklist

### Utenti
- [x] Gestione dei "preferiti" per l'utente
- [x] Produzione di un QR Code per l'identificazione dell'utente

### Eventi
- [x] url pagina ufficiale (opzionale)
- [x] descrizione breve (opzionale) e descrizione lunga (opzionale)
- [x] Editor HTML custom (TipTap RichEditor)
- [x] Descrizioni renderizzate come HTML in tutte le pagine

### Stand
- [x] Stand collegato ad un evento (nome, slogan, descrizione)
- [x] Postazioni per stand (cucina, griglia, bibite...)
- [x] Menu di prodotti in vendita con immagine cover, galleria, ingredienti, prezzo
- [x] Prezzo personalizzato per evento e per tipologia utente
- [x] Prodotti dedicati a specifiche postazioni

### Ordini
- [x] Ordini online e da operatore
- [x] Pagamento misto: crediti + moneta reale
- [x] Pagamento via QR code o manuale
- [x] Resoconto transazioni per stand

### Prossimi sviluppi (completati)
- [x] Gestione Staff / Postazioni
- [x] Pagina Eventi CRUD
- [x] Pagina Utenti CRUD
- [x] Pagina EventUsers
- [x] Test (80 backend + 16 frontend)
- [x] Disponibilità prodotto toggle
- [x] Receipt & QR code
- [x] Guide stampabili

### Cassa Unica (Jun 2026)
- [x] Ruolo event-cashier
- [x] Assegnazione ruolo Marco
- [x] GET /auth/me/stands esteso
- [x] EventCashierPage, EventOrdersPage
- [x] Pulsanti in EventDetailPage

### Coordinate Stand & Mappa (Jun 2026)
- [x] location su Stand model
- [x] CRUD location
- [x] Seed coordinate
- [x] EventMapPage con Leaflet

### POI (Jun 2026)
- [x] Modello POI + CRUD API
- [x] Seed POI
- [x] PoiDetailPage
- [x] Gestione POI in EventDetailPage

### Due Dashboard con Toggle (Jun 2026)
- [x] viewMode in AuthContext
- [x] Navbar cambia navigazione
- [x] DashboardPage duale
- [x] Toggle Utente/Operatore

### Home page ordinata (Jun 2026)
- [x] listEvents sort: startDate: 1 (prima i più prossimi)

### Alias Management (Jul 2026)
- Modello Alias con text univoco, entityType ('event'|'stand'), entityRef
- CRUD protetta su `/api/aliases`, resolve pubblico su `/api/resolve/:type/:alias`
- `AliasManager` componente riutilizzabile con input + lista + delete
- Integrato in EventDetailPage e StandDetailPage
- Rotta `/show/:entityType/:alias` → resolve API → redirect lato client

### Photo Gallery (Jul 2026)
- Modelli EventPhoto (seq incrementale, Cloudinary) e EventFrame (overlay PNG)
- API nidificate sotto `/api/events/:eventId/photos` e `/api/events/:eventId/frames`
- Upload diretto su Cloudinary con cartella `events/{eventId}/photos/`
- Ruoli `photo-admin` (CRUD cornici, delete foto) e `photo-print` (stampa galleria)
- EventGalleryPage con griglia, selezione multipla, stampa via window.print()
- Sezione amministrazione cornici in EventDetailPage

## Session History

### Theming system (May 2026)
- Seasonal themes: 6 palettes (spring, summer, autumn, winter, christmas, easter) auto-applied via date detection
- Per-event colors: 4 custom fields + CSS color-mix()
- ThemeProvider + useEventTheme hook

### Event detail pages (May 2026)
- EventDetailPage: evento + stand cards + tema
- HomePage cards linked to events

### Order management & station queue (May 2026)
- Counter model per orderNumber progressivo
- StandOrdersPage, StationQueuePage (kiosk view)
- Station readiness per-item

### Dashboard stand management links (May 2026)
- GET /api/auth/me/stands
- DashboardPage "Gestione stand"

### Seed data & scroll fixes (May 2026)
- Stand roles populate (Marco, Sara)
- Orders populate (2 ordini esempio)
- Dashboard scroll fix (height: 100vh; overflow-y: auto)
- StationQueuePage global CSS fix

### Per-item station readiness & cashier mark-all (May 2026)
- markItemReady endpoint
- Cashier "Segna come pronto" (preparing → ready)
- StationQueuePage per-item layout

### Android Gradle fix (May 2026)
- settings.gradle.kts: dependencyResolutionManagement fix

### Navbar eventi dropdown (May 2026)
- Pulsante "Eventi" con dropdown event list

### GTM integration & privacy fixes (May 2026)
- Frontend GTM, PrivacyPage, CookieConsentBanner
- Android GTM via HttpURLConnection

### QR scanner per wallet (May 2026)
- html5-qrcode, QRScanner modale
- Integrato in EventUsersPage

### Stand admin navbar & event association (May 2026)
- Navbar "Stand", EventsPage toggle stand associazione

### Maximum update depth fix (May 2026)
- useEventTheme loop fix con useMemo

### Test controllers (May 2026)
- 23 nuovi test (stands, products, stations, event-products)

### Product management in StandDetailPage (May 2026)
- Nuovo prodotto, Aggiungi esistente, Elenco

### Homepage & Cashier POS (May 2026)
- HomePage riscritta, CashierOrderPage POS

### Cassa unica implementazione (Jun 2026)
- Ruolo event-cashier, getMyStands esteso
- EventCashierPage, EventOrdersPage

### Due Dashboard con Toggle (Jun 2026)
- viewMode in AuthContext, toggle navbar

### POI Management admin su EventDetailPage (Jun 2026)
- Form inline POI su EventDetailPage

### Descrizioni HTML — RichEditor (Jun 2026)
- TipTap RichEditor, rendering HTML description

### Miglioramenti cassa unica (Jun 2026)
- Ruolo stand-pickup, auto-transition, scontrino window.print(), beep sonoro

### Fix città e googleMapsUrl (Jun 2026)
- city query, googleMapsUrl persistente, normalizeCountry, preferiti EventDetailPage

### HTML descrizioni su tutte le pagine (Jun 2026)
- dangerouslySetInnerHTML su HomePage, DashboardPage, EventsPage, FavoritesPage

### Mappa Eventi (Jun 2026)
- Marker evento, zoom fix

### Coordinate con virgola (Jun 2026)
- type="text" inputMode="decimal" + replace(',', '.')

### Favicon (Jun 2026)
- favicon.svg brandizzata

### Eliminazione ordini evento & disponibilità prodotto (Jun 2026)
- DELETE /api/orders/event/:eventId, available toggle

### Ricevuta e QR code ordini (Jun 2026)
- GET /orders/:orderId/receipt, receipt-qrcode, Order.receiptQrCode

### Guide stampabili (Jun 2026)
- /guide/:role con 4 guide Q&A

### Volantino / Flyer (Jun 2026)
- FlyerPage React fuori AppLayout, @media print override

### Usage Contracts (Jun 2026)
- Modello, API CRUD, frontend page, enforcement PATCH stands

### Cash Payments & Report Pending Orders (Jun 2026)
- cashPaymentsEnabled flag, pendingOrders nei report

### Per-event Stand Location + MapPicker (Jul 2026)
- locations[] array su Stand, MapPicker Leaflet, tiles Esri

### Bug fix mappa & EventDetailPage revamp (Jul 2026)
- maxZoom fix, MapPicker satellite, ConfirmModal danger prop
- EventDetailPage hero redesign

### Design revamp (Jul 2026)
- Token, shadow, animazioni, HomePage/FavoritesPage/DashboardPage card redesign

### unifiedCashierEnabled (Jul 2026)
- Campo booleano su Event, toggle form, nasconde "Nuovo ordine" per-stand

### Menu Print — Stampa menu stand (Jul 2026)
- toEventProductResponse esteso con coverImage/gallery
- MenuPrintPage a /admin/menu-print
- A3 landscape, page-break tra stand

### Printer Agent — ESC/POS (Jul 2026)
- Progetto printer-agent/ con generatore ESC/POS puro TS
- Server HTTP (:9300), tipi PrintJob/PrintLine
- Script install.sh per Raspberry Pi 2 Model B
- systemd service, gruppo lp, IP statico via DHCP reservation

### Resoconti evento & Menu riorganizzato (Jul 2026)
- GET /orders/report/event/:eventId con aggregazione per-stand
- cashRevenue/cashRevenue espliciti nei report
- EventReportPage con split contanti/crediti
- Navbar riorganizzata in dropdown per gruppo
- Sezione Resoconti in DashboardPage

### Resoconti per stand per evento (Jul 2026)
- toEventProductResponse esteso con coverImage/gallery
- MenuPrintPage a /admin/menu-print
- A3 landscape, page-break tra stand

### Resoconti per stand per evento (Jul 2026)
- [x] GET /orders/report/event/:eventId — aggregazione per-stand con split contanti/crediti
- [x] cashRevenue esplicito in getStandReport
- [x] EventReportPage con tabella per-stand, totali, colonne contanti/crediti
- [x] Accesso riservato a event-admin / event-cashier

### Riorganizzazione Menu (Jul 2026)
- [x] Navbar raggruppata per ambito: Piattaforma, Ordini, Resoconti, Personale
- [x] Sezione Resoconti in DashboardPage operatore

### Printer Agent (Jul 2026)
- [x] Progetto `printer-agent/` con generatore ESC/POS puro TypeScript
- [x] Server HTTP su porta 9300 per job di stampa
- [x] Supporto testo, separatori, barcode, QR code, taglio carta, beep
- [x] Script installazione per Raspberry Pi 2 Model B (o superiori)
- [x] Servizio systemd con auto-restart

### Cassa automatica nel report evento (Jul 2026)
- [x] Cassa calcolata automaticamente come `totalRevenue - cashBasis`
- [x] `cashBasis` salvato in localStorage al momento dell'azzeramento
- [x] "Azzera cassa" imposta il basis al totale corrente, cassa parte da 0
- [x] "Imposta" permette override manuale del basis

### Printer-agent rimosso (Jul 2026)
- [x] Eliminata la directory `printer-agent/`
- [x] Stampante termica collegata direttamente al PC cassa Windows
- [x] Stampa via `window.print()` con HTML puro — nessun Raspberry Pi

### Alias / Link brevi (Jul 2026)
- [x] Modello Alias (text univoco, entityType, entityRef)
- [x] CRUD API `/api/aliases` (protette, solo auth)
- [x] Resolve API pubblica `/api/resolve/:entityType/:alias`
- [x] Rotta pubblica `/show/:entityType/:alias` con redirect SPA
- [x] Componente AliasManager integrato in EventDetailPage e StandDetailPage
- [x] Validazione: solo `[a-z0-9_-]`, lowercase, univoco

### Photo Gallery Evento (Jul 2026)
- [x] Modello EventPhoto (image Cloudinary, sequenceNumber, frameId, takenAt)
- [x] Modello EventFrame (image overlay PNG per cornici)
- [x] API `/api/events/:eventId/photos` — list, create, delete singola/massiva
- [x] API `/api/events/:eventId/frames` — list, create, delete
- [x] Ruoli: `photo-admin` (gestione cornici/foto), `photo-print` (stampa galleria)
- [x] EventGalleryPage con griglia foto, selezione, stampa HTML, eliminazione
- [x] Sezione Cornici in EventDetailPage con upload PNG trasparente

### Photo Booth (Jul 2026)
- [x] PhotoBoothPage con webcam live (getUserMedia), scatto, anteprima con cornice
- [x] Upload foto su server con frameId opzionale
- [x] Selettore cornici con preview prima dello scatto
- [x] Navigazione post-upload verso la galleria

### Slideshow improvements (Jul 2026)
- [x] Selettore velocità rotazione nello header (5s, 10s, 15s, 20s, 30s)
- [x] 8 foto per volta (griglia 4×2) con object-fit contain
- [x] Fix overflow griglia: minmax(0,1fr) per righe, overflow:hidden, min-height:0 sui wrapper
- [x] Fix footer che copriva la griglia: background opaco, rimosso backdrop-filter blur

## Session History

### Slideshow improvements (Jul 2026)
- Selettore velocità rotazione: useState `rotateSec` (default 10s), useEffect separato da fetch/poll
- Griglia ridotta da 4×4 (16) a 4×2 (8) per evitare righe basse coperte dal footer
- CSS Grid gotcha: `grid-template-rows: repeat(N, 1fr)` impedisce alle righe di restringersi sotto il contenuto intrinseco delle cella (immagini, testo); fix con `minmax(0, 1fr)`
- Footer backdrop-filter blur si estende visivamente oltre i suoi bounds; rimosso in favore di background opaco
- object-fit: contain (non cover) per foto slideshow — le celle alte delle 2 righe bastano a contenere le foto senza ritaglio

### Contest / Caccia ai POI (Jul 2026)
- [x] Modello Contest (eventId, nome, descrizione, startsAt, endsAt, durationMinutes, requireSequence, premio, isActive, orderedPOIIds)
- [x] Modello ContestPOI (eventId, nome, hint, sequenceOrder) — POI non visibili in mappa, riutilizzabili tra contest dello stesso evento
- [x] Modello ContestParticipation (contestId, participantId UUID, scannedPOIIds, startedAt, completedAt, isWinner, prizeAwarded)
- [x] Ruolo `contest-admin` (scope event) con permessi contests e contest-pois CRUD
- [x] API /api/contests con CRUD separata per contest-pois (condivisi), contest, scan, partecipazione, premiazione
- [x] API /api/contests/:contestId/poi-qrcodes — genera QR code per ogni POI del contest (dataURL, stampa HTML)
- [x] GET /api/contests — pubblico, lista contest attivi per evento
- [x] POST /api/contests/:contestId/scan — pubblico, registra scansione con validazione sequenza e tempo
- [x] Frontend: EventContestsPage — lista pubblica contest attivi per evento
- [x] Frontend: ContestPage — dettaglio contest con lista POI (nomi + hint), pulsante "Inizia", countdown info
- [x] Frontend: ContestPlayPage — gioco: countdown live, scanner QR, POI trovati/mancanti, messaggi toast
- [x] Frontend: ContestVerifyPage — verifica vincita, dettagli partecipazione, pulsante consegna premio (solo contest-admin)
- [x] Frontend: EventDetailPage — sezione admin contest (creazione POI contest, creazione contest, stampa QR POI)
- [x] Seed: 4 ContestPOI + 2 Contest per springEvent, Marco ha anche ruolo contest-admin
- [x] Campo `groups[]` su ContestPOI (array di stringhe) — un POI può appartenere a più gruppi
- [x] Campo `pickConfig` su Contest (`{ groupPicks: { group, count }[] }`) + `autoPickedPOIIds` tracciamento
- [x] Backend: auto-pick alla creazione — dati i gruppi e il numero per gruppo, seleziona POI casuali e li aggiunge a orderedPOIIds
- [x] Backend: updateContest preserva POI manuali + ricalcola auto-pick se pickConfig cambia
- [x] Frontend: form CPOI con input "Gruppi (separati da virgola)" e badge gruppo nelle card
- [x] Frontend: sezione "Prelievo automatico per gruppi" nel form contest con aggiunta/rimozione gruppi
- [x] Frontend: POI divisi per gruppo nella pool del drag-and-drop (+ header "Senza gruppo" per quelli senza gruppo)

### Drag-and-drop contest POI selection (Jul 2026)
- [x] Sostituito checkboxes + frecce su/giù con HTML5 drag-and-drop nativo
- [x] Pool POI disponibili (trascina per aggiungere) vs Ordine POI (trascina per riordinare)
- [x] Duplicati permessi — stesso POI può apparire più volte nell'ordine
- [x] Rimozione via pulsante ×, riordino via drag all'interno della lista ordinata

### EventExchangePage riscritta (Jul 2026)
- [x] Rimosse duplicazioni degli state hooks che causavano ridefinizioni
- [x] Struttura JSX corretta con chiusure section/div appropriate
- [x] Tutte le stringhe in italiano

### Traduzioni italiano contest form (Jul 2026)
- [x] Sostituiti testi inglesi rimasti: "Ordered sequence" → "Sequenza ordinata", "Prizes" → "Premi", ecc.

#### Decisioni progettuali
- ContestPOI è modello separato da POI (quelli evento hanno coordinate e sono visibili in mappa, ContestPOI no)
- ContestPOI condivisibili tra più contest dello stesso evento (CRUD separata da Contest)
- Partecipazione anonima via UUID salvato in localStorage (nessuna registrazione richiesta)
- QR code generato come dataURL (qrcode npm), stampa via finestra HTML pura (pattern Menu Print)
- Scadenza partecipazione: countdown lato client + validazione lato server su ogni scan
- Il pulsante "Consegna premio" in ContestVerifyPage è accessibile solo a utenti autenticati con ruolo contest-admin o platform-admin

### Bug fix: EventUserTransaction.userId nullable (Jul 2026)
- [x] `userId: required: true` → `default: null` sul modello EventUserTransaction
- [x] Fix: validazione falliva per transazioni anonime (userId era null ma richiesto)

### Tasso di cambio evento + revisione pagina Exchange (Jul 2026)
- [x] Aggiunto `exchangeRate` (Number, default 1) al modello Event
- [x] Aggiunto `realAmount` (Number, nullable) a EventUserTransaction per tracciare l'equivalente in EUR
- [x] createEvent/updateEvent/toEventResponse includono exchangeRate
- [x] Top-up: amount in EUR, backend calcola crediti = EUR * exchangeRate, store realAmount
- [x] Refund: amount in crediti, backend calcola EUR = crediti / exchangeRate, store realAmount
- [x] getBalance: aggiunti `exchangeRate`, `myTopUp/Refund/NetBalance/Count` (filtrati per performedByUserId), `mySinceReset*`
- [x] listTransactions: performedByUserId popolato con firstName/lastName, restituito come `performedByName`
- [x] Event exchange form: nuovo campo "Tasso di cambio (1 € = X moneta)"
- [x] EventExchangePage: simbolo moneta = iniziale in cerchio (CurrencySymbol component)
- [x] Statistiche cassa divise in "Tutte le postazioni" e "Questa postazione"
- [x] Tutti gli importi mostrano equivalente in EUR con prefisso €
- [x] Form Carica: input in EUR, preview crediti; Form Rimborsa: input in crediti, preview EUR
- [x] Tabella storico: colonne Importo {currencyName}, Equivalente €, Operatore
- [x] "Saldo dopo": crediti + EUR equivalent in colonna
- [x] EUR equivalent calcolato da amount/rate per vecchie transazioni senza realAmount
- [x] CurrencySymbol rimosso dalle sezioni secondarie (solo nell'h1)
- [x] Fix: EUR carichi usava netBalance invece di totalTopUp
- [x] Tutti i 187 test backend passano, frontend build OK

### Contest: POI duplicati in orderedPOIIds (Jul 2026)
- [x] Backend `registerScan`: rimosso check "POI already scanned" → ora permette scansione multipla dello stesso POI fino a `orderedCount` occorrenze
- [x] Backend `registerScan`: sequence check usa `orderedPOIIds[scannedPOIIds.length]` (array completo, non deduplicato)
- [x] Backend `completeParticipation`: check `scannedPOIIds.length === orderedPOIIds.length` (totale slot, non unici)
- [x] Frontend POI grid: mostra tutti gli `orderedPOIIds` (inclusi duplicati), non solo `pois` unici
- [x] Frontend marking: occurrence-based — per ogni posizione, conteggio occorrenze in `orderedPOIIds[0..i]` vs conteggio scansioni in `scannedPOIIds`. Trovato solo quando `scanCount >= occurrence`
- [x] Frontend: pulsante scan spostato sopra la griglia POI
- [x] Frontend: POI trovati spostati sotto a quelli da trovare (separati da divider)
- [x] Frontend: highlight prossimo POI da scansionare (bordo brand, sfondo glow)
- [x] Frontend: schermata finale usa conteggio slot totali (non unici) per "Hai trovato X di Y POI"
- [x] SCSS: `.poiNext` (bordo brand + glow), `.poiDivider` (separatore trovati/da trovare)

### Email subscription + GDPR consent (Jul 2026)
- [x] Modello `EmailSubscription` (email, eventId, marketingConsent, source, isActive, consentTimestamp, consentIp)
- [x] API CRUD: `POST /api/email-subscriptions` (subscribe pubblico), `GET /` (admin paginato), `DELETE /:id` (unsubscribe admin), `POST /unsubscribe` (by email)
- [x] `sendEventPhotoEmail` registra l'email con consenso marketing dopo l'invio (upsert)
- [x] `ConfirmModal`: nuova prop `showConsent` + `consentLabel` per checkbox privacy
- [x] `EventGalleryPage`: checkbox consenso nel modale email, invia `marketingConsent` alla API
- [x] Documento `docs/INFORMATIVA_PRIVACY_EMAIL.md` — informativa GDPR + modulo di consenso firmabile

### Bug fix: ordine non visibile in cassa (Jul 2026)
- [x] Backend `listOrders` / `listMyStationOrders`: supporto `?status=preparing,ready` (comma-separated → `$in`)
- [x] `CashierOrderPage.handleSubmit`: ora avanza l'ordine a `preparing` dopo la creazione
- [x] `CashierOrderPage.loadActiveOrders`: ora mostra ordini `preparing` E `ready`
- [x] Titolo pannello cambiato da "Ordini pronti" a "Ordini in corso"

## Session History

### Email subscription + GDPR consent (Jul 2026)
- **Problema**: le email inserite per l'invio foto non venivano salvate, impossibile inviare promozioni future. Nessun consenso GDPR tracciato.
- **Soluzione**: nuovo modello `EmailSubscription` con upsert su email. `sendEventPhotoEmail` ora registra automaticamente l'email dopo l'invio. Frontend: checkbox "Acconsento al trattamento..." nel modale email della galleria.
- **Documento privacy**: `docs/INFORMATIVA_PRIVACY_EMAIL.md` con informativa completa Art. 13 GDPR e modulo di consenso firmabile dal titolare dell'email.

### Bug fix: ordine non visibile in cassa (Jul 2026)
- **Problema**: l'addetto al ritiro creava un ordine su `CashierOrderPage`, ma non lo vedeva nell'elenco "Ordini pronti". Due cause: (1) `handleSubmit` non avanzava lo stato a `preparing` dopo la creazione (a differenza di `EventCashierPage`); (2) `loadActiveOrders` filtrava solo `status: 'ready'`.
- **Soluzione**: aggiunto `updateOrderStatus(orderId, 'preparing')` in `handleSubmit`. `loadActiveOrders` ora filtra con `status: 'preparing,ready'`. Backend: `listOrders` e `listMyStationOrders` supportano comma-separated per filtrare più stati contemporaneamente.
- **Lesson learned**: due pagine cassa (`CashierOrderPage` e `EventCashierPage`) avevano logica di creazione ordine diversa. Ora sono allineate.

### Contest: POI duplicati in orderedPOIIds (Jul 2026)
- **Problema**: `orderedPOIIds` può contenere duplicati (es. stesso POI 3 volte = 15 slot, 3 unici). Il codice precedente deduplicava ovunque, causando:
  1. Scansione unica di un POI lo marcava come "trovato" in tutte le occorrenze (`scannedIds.includes(poi.id)`)
  2. Il conteggio finale usava gli unici ("3 di 3" invece di "15 di 15")
  3. `completeParticipation` permetteva il completamento con solo 3 scan su 15 slot
- **Soluzione backend**: `registerScan` ora permette scansioni multiple dello stesso POI ID (fino a quante volte appare in `orderedPOIIds`). `scannedPOIIds` può contenere duplicati. Sequence check usa l'array completo.
- **Soluzione frontend**: marking occurrence-based — per ogni posizione `i` in `orderedPOIIds`, si conta quante volte quel POI ID appare in `orderedPOIIds[0..i]` (numero di occorrenza) e si confronta con quante volte è stato scansionato. Un POI è "trovato" solo quando `scanCount >= occurrence`.
- **Bug fix**: il primo approccio (position-based, `i < scannedIds.length`) era errato — se `orderedPOIIds = [A, B, A]` e `scannedIds = [A, A]`, la posizione 1 (B) veniva marchiata come trovata pur non essendo stata scansionata. Fix con occurrence-based.
- **Lesson learned**: quando si tracciano duplicati in un array ordinato, non usare la lunghezza come indicatore di progresso. Usare il conteggio occorrenze per ogni POI ID.
