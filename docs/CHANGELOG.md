# CHANGELOG — Street Food Events

Tutte le feature implementate, in ordine cronologico.

## Luglio 2026
- Slideshow, galleria, invio email foto, stampa full-page.

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
- CSS Grid gotcha: `grid-template-rows: repeat(N, 1fr)` impedisce alle righe di restringersi sotto il contenuto intrinseco; fix con `minmax(0, 1fr)`
- Footer backdrop-filter blur si estende visivamente oltre i suoi bounds; rimosso in favore di background opaco
- object-fit: contain (non cover) per foto slideshow — le celle alte delle 2 righe bastano a contenere le foto senza ritaglio
