# TODO — Street Food Events

## Visualizzazione Google Maps su EventMapPage (feature futura)
- Mostrare stand e POI dell'evento anche su una visualizzazione "Google Maps" scelta dall'utente nella mappa.
- Orientamento: soluzione **ufficiale con API key** (Google Maps JavaScript API), non endpoint tile non ufficiali (violano i ToS Google).
- Richiede: chiave API Google Cloud (Maps JavaScript API) configurata come `VITE_GOOGLE_MAPS_KEY`, vista/mappa dedicata con marker custom per evento, stand e POI (popup come l'attuale pagina Leaflet).
- Stato attuale: EventMapPage usa Leaflet con tile Esri (Satellite + Mappa); marker già renderizzati come overlay, ma nessuna base layer Google.

## Cover e Logo per Eventi e Stand
- **Eventi**: presentare sia un **cover** (banner orizzontale, già `coverImage` esistente) che un **logo** (icona rotonda, già `logo` esistente) in tutte le superfici: HomePage, EventDetailPage, dropdown Eventi navbar/sidebar, dashboard.
- **Stand**: aggiungere un campo **logo** (icona rotonda) oltre alla `coverImage` già esistente. Mostrare logo in mappa (marker), menu pubblico, coda ordini, lista stand in EventDetailPage.
- **Stato attuale**: Event ha `coverImage` + `logo` ma non sempre entrambi vengono mostrati ovunque; Stand ha solo `coverImage`, manca il logo.
- **Obiettivo**: coerenza visiva — ogni entità (evento e stand) ha sempre cover + logo visibili nelle card, marker, dropdown e pagine di dettaglio.

---

## Backend completato ma frontend pending

### CurrencySymbol upload in EventsPage
- Il backend accetta e salva `currencySymbol` (imageSchema) su Event, ma **EventsPage non ha il campo** nel form.
- `EventFormData` non include `currencySymbol`, `handleSubmit` non lo manda.
- **Da fare**: aggiungere `ImageUploader` per currencySymbol nel form evento (campo sezione Moneta), aggiungere al tipo `EventFormData` e a `handleSubmit`.

### Fee bands (fasce trattenuta) — editor in EventsPage
- Backend: `Event.feeBands: [{ maxAmount, feePercent, feeFlat }]` implementato (model + controller create/update/response).
- **Da fare frontend**: editor dinamico nella form evento per gestire le fasce. Ogni fascia ha: soglia EUR, percentuale, importo forfait (uno dei due). Ordinate per maxAmount crescente. L'ultima fascia con maxAmount very high = catch-all.

### Fee override per stand-evento — input in StandsPage
- Backend: `stand.numbers[].feePercent` e `stand.numbers[].feeFlat` implementati (model + controller `eventFees`).
- **Da fare frontend**: nella form StandsPage, quando un evento è collegato, mostrare campi opzionali "Fee % stand" e "Fee forfait €" per quell'evento. Se compilati, hanno la precedenza sulle fasce dell'evento in fase di liquidazione.

### Denominations (tagli token) — editor in EventsPage
- Backend: `Event.denominations: [{ label, value, quantity }]` implementato (model + controller).
- **Da fare frontend**: editor dinamico nella form evento per gestire i tagli. Ogni taglio ha: etichetta (es. "1 Token"), valore in moneta evento, quantità totale emessa. Ordinati per valore crescente.

### Liquidazione con conteggio tagli — StandSettlementsPage
- Backend: `createSettlement` accetta `denominations[]`, calcola amount da tagli, valida che resi ≤ emessi.
- Backend: `StandSettlement.denominations: [{ label, value, count, euroAmount }]` nel modello.
- **Da fare frontend**: sostituire il campo singolo "Importo presentato" con una **griglia tagli** dove il cassiere inserisce la quantità per ogni taglio. Per ogni taglio → euro = (quantità × valore / cambio). Sommatoria totale in euro, poi fee e payout.

### Riepilogo tagli (emessi / resi / persi)
- **Da fare backend**: endpoint `GET /api/exchange/:eventId/denomination-report` che aggrega per ogni taglio: quantità emessa (dal evento), quantità restituita (somma da tutti i settlement credit), persa (emessi - resi), anomalia (resi > emessi).
- **Da fare frontend**: sezione riepilogo tagli in StandSettlementsPage o pagina dedicata. Tabella con: taglio, valore, emessi, resi, persi, stato (ok/anomalia con evidenziazione rossa).

### Categorie prodotti
- **Da fare backend**: `Event.categories: [{ label, icon? }]` (model + controller). `Product.categoryId` opzionale (ref a category label). Endpoint menu raggruppato per categoria.
- **Da fare frontend**: editor categorie nella form evento (EventsPage). Campo "Categoria" nel form prodotto (EventProductsPage). Toggle "Per stand" / "Per categoria" nel menu pubblico (EventStandMenuPage).

### Fix: eventi pubblici — visibilità corretta
- `isPublic: true` → l'evento è visibile nella parte **pubblica** del sito (home, mappa, menu, dropdown eventi navbar).
- Tutti gli eventi (indipendentemente da `isPublic`) sono visualizzabili nella parte **admin** (sidebar, pagine gestionali, dropdown eventi admin).
- **Da fare**: verificare che la parte pubblica mostri solo eventi `isPublic: true` e che la parte admin mostri tutti gli eventi. Correggere eventuali filtri errati.

### Fix: HomePage mostra prossimi eventi + ultimi 3 terminati
- **Da fare**: HomePage mostra in alto gli eventi prossimi/in corso, in basso una sezione compatta "Eventi terminati" con gli ultimi 3 eventi conclusi.

### Fase 5: Splitting DashboardPage (utente vs operatore)
- La DashboardPage attuale mescola viste utente (wallet, ordini, preferiti) e viste operatore (gestione stand, eventi, cassa).
- **Da fare**: separare in due layout/pagine: DashboardPage (utente) e OperatorDashboardPage (operatore con ruoli).

### Admin sidebar: contesto evento unico
- La sidebar admin attuale moltiplica le voci per ogni evento (Cassa Evento1, Cassa Evento2, Ordini Evento1, Ordini Evento2, Liquidazione Evento1, Liquidazione Evento2, Galleria Evento1, Galleria Evento2, Photo booth Evento1, Photo booth Evento2, Menu stampa). Con N eventi la sidebar è ingovernabile.
- **Da fare**: introdurre un **selettore evento** in cima alla sidebar. Una volta selezionato l'evento, le voci event-scopate (Cassa, Ordini, Liquidazione, Galleria, Photo booth, Menu stampa, Resoconto liquidazioni, etc.) mostrano SOLO quella relativa all'evento selezionato. Le voci globali (Eventi, Stand, Prodotti, Staff, Utenti, Ruoli, etc.) restano invariate.
- La selezione evento persiste in `localStorage` (chiave `adminSelectedEventId`) e viene letta all'avvio della sidebar.
- L'URL delle voci event-scopate NON cambia (restano `/admin/events/:eventId/cashier` etc.) — il selettore simply reindirizza quando cambia.
- **Voci che dipendono dall'evento selezionato**: Cassa, Ordini, Liquidazione, Resoconto liquidazioni, Galleria, Photo booth, Menu stampa, Portafogli eventi (filtra per evento), Numerazione stand (in EventDetailPage).
- **Voci globali (non dipendono dall'evento)**: Dashboard, Eventi, Stand, Prodotti, Prodotti per evento, Staff, Utenti, Ruoli, Contratti d'uso, Guide, Volantino, Cornici.

### Fase 6: Cleanup AppLayout + Navbar legacy
- `AppLayout.tsx` e `Navbar.tsx` sono legacy (router ora usa AdminLayout + PublicLayout).
- **Da fare**: verificare che non siano più referenziati, rimuoverli se inutilizzati.

---

## Feature Implementabili (AI-ready)

### 1. Notifiche Push in Tempo Reale
- **Descrizione**: sistema di notifiche push per aggiornamenti ordini, promozioni eventi, scadenze contest
- **Tecnologia**: WebSocket o Server-Sent Events + Service Worker
- **API da implementare**: `/api/notifications` (CRUD), `/api/notifications/subscribe` (registrazione device)
- **Frontend**: componente toast/notification center, abilitazione/disabilitazione notifiche
- **Motivazione**: migliorare esperienza utente con aggiornamenti istantanei

### 2. Prenotazioni Stand
- **Descrizione**: sistema di prenotazione slot temporali per visitare stand specifici
- **Modello**: `Reservation { eventId, standId, userId, timeSlot, status }`
- **API**: CRUD prenotazioni, disponibilità slot, check-in
- **Frontend**: calendar picker, lista prenotazioni, QR code check-in
- **Motivazione**: ridurre code, migliorare gestione flussi visitatori

### 3. Statistiche Avanzate Evento
- **Descrizione**: dashboard analitica con metriche dettagliate
- **Metriche**: vendite per ora, prodotti più venduti, mappa calore presenze, tempo medio preparazione
- **API**: `/api/events/:eventId/analytics` con aggregazioni MongoDB
- **Frontend**: grafici (Chart.js/Recharts), export CSV/PDF
- **Motivazione**: supporto decisionale per organizzatori

### 4. Sistema Feedback e Recensioni
- **Descrizione**: valutazione stand e prodotti da parte dei clienti
- **Modello**: `Review { eventId, standId, userId, rating, comment, createdAt }`
- **API**: CRUD recensioni, media voti, moderazione
- **Frontend**: stelle valutazione, form commento, top-rated stand
- **Motivazione**: quality control, gamification

### 5. Promozioni e Coupon
- **Descrizione**: sistema sconti e promozioni per eventi/stand
- **Modello**: `Promotion { code, discountType, discountValue, eventId, standId, expiresAt, usageLimit }`
- **API**: validazione coupon, applicazione sconto, storico utilizzi
- **Frontend**: input coupon in cassa, gestione promozioni admin
- **Motivazione**: marketing, fidelizzazione

### 6. Multi-lingua (i18n)
- **Descrizione**: supporto lingue multiple per interfaccia e contenuti
- **Tecnologia**: react-intl o i18next
- **Traduzioni**: IT (default), EN, DE, FR
- **API**: campi localizzati su Event/Stand (name_it, name_en, ecc.)
- **Motivazione**: internazionalizzazione eventi turistici

### 7. Esportazione Dati
- **Descrizione**: export ordini, transazioni, utenti in formati standard
- **Formati**: CSV, Excel (xlsx), PDF con grafe
- **API**: `/api/export/:type` con filtri data/evento/stand
- **Frontend**: pulsanti export con filtri, preview
- **Motivazione**: compliance fiscale, analisi esterne

### 8. Sistema Abbonamenti
- **Descrizione**: abbonamenti periodici per accesso premium
- **Modello**: `Subscription { userId, plan, startDate, endDate, status }`
- **Piani**: Basic (ordini), Pro (analytics), Enterprise (multi-Evento)
- **API**: gestione abbonamenti, verifica accesso
- **Frontend**: pagina piani, gestione abbonamento
- **Motivazione**: monetizzazione SaaS

### 9. Integrazione Payment Gateway
- **Descrizione**: pagamento online con carte/bonifici
- **Provider**: Stripe, PayPal, bonifico bancario
- **API**: `/api/payments/create-intent`, webhook conferma
- **Frontend**: form pagamento sicuro, storico transazioni
- **Motivazione**: vendita online, pre-vendita

### 10. App Mobile (PWA)
- **Descrizione**: Progressive Web App per esperienza mobile nativa
- **Features**: offline mode, installazione home screen, push notifications
- **Tecnologia**: Service Worker + manifest.json
- **Frontend**: ottimizzazione touch, gesture, layout responsive
- **Motivazione**: esperienza mobile, accessibilità

### 11. Gestione Staff Avanzata
- **Descrizione**: turni, assegnazioni, timetable per personale
- **Modello**: `Shift { userId, standId, date, startTime, endTime, role }`
- **API**: CRUD turni, disponibilità staff, assegnazione automatica
- **Frontend**: calendar view, swap turni, notifiche assegnazioni
- **Motivazione**: organizzazione lavoro, riduzione conflitti

### 12. Sistema Badge e Gamification
- **Descrizione**: achievement e livelli per partecipazione
- **Modello**: `Badge { userId, type, earnedAt, eventId }`
- **Tipi**: "Primo Ordine", "Cacciatore POI", "Fotografo", "Top Spender"
- **API**: assegnazione badge, classifica, statistiche utente
- **Frontend**: profilo utente con badge, leaderboard
- **Motivazione**: engagement, fidelizzazione

### 13. Chat in Tempo Reale
- **Descrizione**: chat tra utenti e stand per ordini/assistenza
- **Tecnologia**: WebSocket + MongoDB per persistenza
- **Modello**: `Message { senderId, receiverId, standId, content, timestamp }`
- **Frontend**: chat window, notifiche messaggi
- **Motivazione**: supporto clienti, comunicazione diretta

### 14. Gestione Ingredienti e Allergeni
- **Descrizione**: tracciamento ingredienti per sicurezza alimentare
- **Modello**: `Ingredient { name, allergens[] }`, `ProductIngredient { productId, ingredientId, quantity }`
- **API**: CRUD ingredienti, allergeni, filtri per allergeni
- **Frontend**: dettaglio prodotto con allergeni, filtri menu
- **Motivazione**: compliance normativa, sicurezza

### 15. Audit Log
- **Descrizione**: tracciamento modifiche critiche per sicurezza
- **Modello**: `AuditLog { userId, action, entityType, entityId, changes, timestamp }`
- **Middleware**: hook su operazioni CRUD sensibili
- **API**: `/api/audit-logs` con filtri (solo admin)
- **Frontend**: pagina audit log con filtri
- **Motivazione**: sicurezza, compliance, debugging
