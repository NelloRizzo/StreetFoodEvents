# TODO — Street Food Events

## Photo booth aperto a tutti + cornice di evento
- ✅ IMPLEMENTATI (Ago 2026, vedi CHANGELOG): upload foto aperto a tutti (immagini anche anonime, video solo auth) e `defaultFrameId` su Event con applicazione automatica nel photo booth.

### Pubblicazione social — analisi problematiche (ricerca Ago 2026)
Punti a favore: le foto sono già composte con cornice+hashtag nel JPEG (client-side) e hostate su Cloudinary con URL pubblico — requisito indispensabile: Meta fa fetch dell'immagine dall'URL passato.

**Facebook**:
- Profili personali NON postabili via API (dal 2018) → solo Pagine (`POST /{page-id}/photos` con `url=`).
- Permessi `pages_manage_posts` + `pages_read_engagement` (+ `publish_video`); utente con task CREATE_CONTENT/MANAGE sulla Page; Page access token.
- Multi-business ⇒ App Review + Business Verification (Tech Provider); uso interno su nostre Page ⇒ Standard Access senza review ma gestione token manuale.
- Rischio errore 368 (anti-spam) pubblicando molte foto simili in sequenza.

**Instagram**:
- Solo account professional (Business/Creator); due varianti: Instagram Login (`graph.instagram.com`, permessi `instagram_business_content_publish`) o Facebook Login (`instagram_content_publish` + Page token). Da scegliere a monte.
- Flusso asincrono container→media_publish con polling `status_code`; immagini SOLO JPEG; rate limit 100 post/24h per account (50 caroselli; carousel max 10 foto = 1 post).
- PPA (Page Publishing Authorization) può bloccare la pubblicazione su alcune Page; App Review come FB per uso multi-business.

**TikTok**:
- Client non auditato = post SOLO privati (`SELF_ONLY`) e max 5 utenti/24h ⇒ inutilizzabile in produzione senza audit (UX mockup + compliance + approvazione TikTok).
- UX obbligatorie: dropdown privacy senza default, consenso esplicito pre-publish ("Music Usage Confirmation"); ~15 post/giorno per creator; scope `video.publish`; URL ownership per PULL_FROM_URL.

**Trasversale**:
- OAuth multi-tenant per organizzatore vs unico account piattaforma; token Page ~60 giorni (refresh flow necessario).
- Nessuno scheduler/coda nel backend (Render free = 1 processo): servirebbe modello `SocialPost { photoIds[], platforms[], status, attempts, lastError }` + loop in-process o enqueue inline in createEventPhoto.
- GDPR: nessun consenso sul documento EventPhoto oggi; cancellare la foto locale NON la rimuove dai social.
- Rate limit rendono irrealistico il post per-singola-foto: batch/carousel quasi obbligatorio.

**Opzioni**: (A) semi-automatica con selezione dalla galleria [consigliata]; (B) carousel giornaliero automatico (10 migliori foto); (C) Web Share API nativa (zero review, funziona anche su profili); (D) bridge Buffer/Zapier/Make.

**Stato**: IMPLEMENTATA (Ago 2026) — opzione (A): trigger manuale dalla galleria, account UNICO della piattaforma, solo Meta. Vedi CHANGELOG Agosto 2026. Restano aperti:
- OAuth multi-tenant per organizzatore (oggi solo account piattaforma); refresh token Page ~60 giorni.
- TikTok (richiede audit app; post SELF_ONLY senza).
- Carousel/batch automatico giornaliero; gestione GDPR della rimozione dal social (cancellare la foto locale NON la rimuove dai social).
- Pubblicazione dall'account dell'utente che scatta + tag automatico dell'evento: VALUTATA E SCARTATA (Ago 2026) — i profili Facebook personali non sono postabili via API dal 2018 (servirebbe OAuth multi-utente con Pagina/IG professional per ogni fotografo + App Review Meta); il tag evento realistico è la @menzione dell'handle nel caption, non il tag foto.

## Visualizzazione Google Maps su EventMapPage (feature futura)
- Mostrare stand e POI dell'evento anche su una visualizzazione "Google Maps" scelta dall'utente nella mappa.
- Orientamento: soluzione **ufficiale con API key** (Google Maps JavaScript API), non endpoint tile non ufficiali (violano i ToS Google).
- Richiede: chiave API Google Cloud (Maps JavaScript API) configurata come `VITE_GOOGLE_MAPS_KEY`, vista/mappa dedicata con marker custom per evento, stand e POI (popup come l'attuale pagina Leaflet).
- Stato attuale: EventMapPage usa Leaflet con tile Esri (Satellite + Mappa); marker già renderizzati come overlay, ma nessuna base layer Google.

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

### 6. Multi-lingua (i18n) — Piano dettagliato (Ago 2026)
- **Scope**: solo pagine pubbliche; admin resta in italiano
- **Lingue**: configurabili dall'admin (qualsiasi lingua)
- **Due domini**: (A) UI strings (react-i18next) e (B) Contenuti tradotti (DB + Groq AI)

#### UI Strings (react-i18next + i18next-browser-languagedetector)
- **Pagine pubbliche** (~12): LandingPage, EventsPage, EventDetailPage, EventStandMenuPage, EventGalleryPage, SlideshowPage, EventMenuPage, LoginPage, RegisterPage, ActivationPage, AliasRedirectPage, NotFoundPage
- **Componenti shared**: CookieConsentBanner, PublicHeader, PublicBottomBar, LanguageSelector (nuovo)
- **Setup**: `frontend/src/i18n/index.ts`, `frontend/src/locales/{it,en}.json`, hook `useTranslation()`
- **Detection**: localStorage → navigator.language → fallback `it`
- **LanguageSelector**: dropdown nella navbar pubblica (solo pagine pubbliche)

#### Content Multilingua (schema embedded + Groq)
- **Schema Mongoose**: `nameTranslations: Map<String, String>` + `descriptionTranslations: Map<String, String>` su Event, Stand, EventProduct
- **API**: `GET /api/events?lang=xx` ritorna contenuti tradotti con fallback a default
- **Admin UI**: tabs linguistiche nei form Evento/Stand/Prodotto (una tab per lingua attiva)
- **LanguagesPage** (sotto Platform): gestione lingue attive (codice, nome, flag, default)

#### Groq AI Fallback (eager on-save)
- **API**: `https://api.groq.com/openai/v1/chat/completions` (modello `llama-3.3-70b-versatile`, gratuito)
- **Strategia**: quando l'admin salva un contenuto → Groq traduce in tutte le lingue attive automaticamente
- **Admin**: può revisionare/correggere dopo; pulsante "Traduci in tutte le lingue"
- **Cache**: traduzioni salvate in `*Translations` fields, accesso diretto (niente cache extra)

#### Lingua visitatore
- **Auto-detect**: Accept-Language del browser
- **Selettore manuale**: dropdown opzionale nella PublicHeader
- **localStorage**: salva preferenza per visite successive

#### Tempistiche stimate
| Fase | Giorni |
|---|---|
| Schema DB (aggiungere *Translations fields) | 1-2 |
| Core i18next + locale files + detection | 2-3 |
| LanguageSelector + PublicHeader | 1 |
| API content con `?lang=` param | 2 |
| Groq service + eager translate on save | 2-3 |
| Admin UI: tabs linguistiche | 3-4 |
| Admin LanguagesPage | 1-2 |
| Public pages: sostituire hardcoded text | 3-4 |
| Test + polish | 2 |
| **TOTALE** | **~18-22 giorni** |

- **Motivazione**: internazionalizzazione eventi turistici, accesso visitatori stranieri

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

### 16. App Locale Offline + Sync Remoto
- **Descrizione**: deployment dell'app su laptop locale per eventi senza connessione internet
- **Stack**: stesso backend Express+Mongoose, MongoDB locale (replica set single-node), frontend con `VITE_API_URL=http://127.0.0.1:4000/api`
- **Sync engine**: endpoint `GET /sync/pull?since=<ts>` + `POST /sync/push` con batch di modifiche. `lastModifiedAt` + `syncVersion` su ogni model. Risoluzione conflitti LWW (last-write-wins)
- **Storage media**: Cloudinary opzionale, multer con storage disco locale + endpoint statico per servire file
- **Setup**: script `npm run setup:local` (avvia Mongo replica set, seed, backend, frontend)
- **Limiti**: foto/video non sincronizzati (troppo pesanti); sessioni auth separate per local/remote; sync periodico (non real-time)
- **Stimata**: ~750-950 righe (sync engine, lastModifiedAt, scripts, doc)
- **Motivazione**: eventi in zone senza rete (fiere, manifesti, location isolate)

#### Stato (SET 2026) — primo step implementato, engine LWW su `lastModifiedAt` NON ancora fatto
Approccio implementato (diverso dal piano originario): **preservazione snapshot via `_id`**, non sync engine generico:
- Il backend cloud espone API di sola sincronizzazione **`/api/sync`** protette da **bearer token statico** (`SYNC_API_TOKEN` env): `GET /events`, `GET /events/:eventId/stands`, `GET /events/:eventId/stands/:standId` (snapshot completo evento+stand: event, stand, stations, products, eventProducts, eventUsers, counter), `POST /push` (ordini/transazioni/contatori/saldi event-user upsert con guardia LWW locale al posto di lastModifiedAt).
- L'app locale (`.local/`) ha un pannello Sync: seleziona evento e stand remoto → **import** che SOSTITUISCE completamente i dati locali (wipe transazionale + insert preservando `_id`) con snapshot remoto. Se esistono dati locali non sincronizzati (`/pending/count` sul ledger), il pannello chiede di **pushare prima** (modale di conferma) per non perdere lavoro fatto offline.
- Ledger locale `SyncLedger` traccia le operazioni locali pendenti; `LocalState` (doc `key: 'current'`) conserva l'evento/stand attivo corrente (con `eventName`/`currencyName`).
- Frontend locale usa `MetaContext` (eventId/standId/currencyName dinamici da `/api/sync/meta`) al posto della `config.ts` hardcoded; `Cassa`/`CodaPostazioni`/`CodaPubblica` non sono più legate a `config`.
- Auth server-to-server: token statico condiviso (niente OAuth/session); su cloud in `env.ts`, su locale in `.local/backend/src/config.ts` (`remoteUrl`/`remoteToken`).

Restano a fare (futuro):
- Sync engine generico LWW (`lastModifiedAt` + `syncVersion`, `GET /sync/pull?since=<ts>`) — oggi il push è diff goal-selected per ordini/transazioni/contatori/saldi.
- Align port locale: `config.ts` default 4200 vs Docker compose 4000.
- Script unico `npm run setup:local`; storage media locale opzionale.
- Doc operativa `REMOTE_URL`/`REMOTE_TOKEN`/`SYNC_API_TOKEN` (aggiunti a `.env.example`).
