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

## Fix: HomePage mostra prossimi eventi + ultimi 3 terminati
- **Da fare**: HomePage mostra in alto gli eventi prossimi/in corso, in basso una sezione compatta "Eventi terminati" con gli ultimi 3 eventi conclusi.

## Fase 6: Cleanup AppLayout + Navbar legacy
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
