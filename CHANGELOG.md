# CHANGELOG — Street Food Events

Tutte le feature implementate, in ordine cronologico.

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
