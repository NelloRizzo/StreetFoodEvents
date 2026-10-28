# TODO — Street Food Events
_(ogni voce è separata dalle altre con una riga bianca)_

## Bug riscontrati in questa sessione
- _(nessun bug aperto: vedi CHANGELOG.md)_

## Prossime Implementazioni
- _(nessuna altra implementazione immediata è stata programmata)_

## Adesione Stand a Manifestazione
- **Aperti**: pagamento online di quota di partecipazione e caparra tramite Payment Gateway (oggi i campi `participationFee`/`deposit` su `Event` con scadenze `participationFeeDeadline`/`depositDeadline` sono informativi, accettati con checkbox nel wizard; il payment gateway resta fuori scope). Futuro ruolo `stand-owner` dedicato (oggi si riusa `stand-admin`).

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

### 3. Statistiche Avanzate Evento — **IMPLEMENTATA** (Ott 2026)
- **Fatto**: pagina `Analisi vendite` (`/admin/events/:eventId/analytics`) + endpoint `GET /api/events/:eventId/analytics` con vendite per ora, prodotti più venduti, tempo medio di preparazione (bucket a confini fissi) e vendite per stand. Grafici in CSS, non librerie. Vedi CHANGELOG Ottobre 2026.
- **Scostamento dal piano originale**: la `mappa calore presenze` è diventata una **mappa delle vendite per stand** (cerchi Leaflet proporzionali al fatturato): dei visitatori non c'è il GPS, quindi non esiste un dato di posizione aggregabile. **Export CSV fatto** (Ott 2026: pulsante «Esporta CSV» in testata con un unico file contenente tutte le sezioni e il filtro attivo; da una seconda iterativa anche i **pulsanti «Esporta CSV» in testa alle tabelle** — dettaglio per stand e prodotti più venduti in Analisi vendite, dettaglio per stand in Stima visitatori — per scaricare la sola tabella col filtro attivo — vedi CHANGELOG); per il PDF vale la stampa già esistente (`window.print`), non è previsto un export dedicato.
- **Motivazione**: supporto decisionale per organizzatori

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
- **Stato attuale**: esiste l'export CSV **client-side** del resoconto incassi (`EventOrdersPage`), quello di `Analisi vendite` (`lib/analyticsCsv.ts`, file unico + pulsanti in testa alle tabelle per singola sezione) e quello del dettaglio per stand della stima visitatori (`lib/visitorsCsv.ts`); tutti importano le convenzioni da **`frontend/src/lib/csv.ts`** (separatore virgola, punto decimale, BOM UTF-8, helper `num`/`pct`/`dateTime`) — non ricopiare le funzioni. L'export server-side di ordini/transazioni/utenti qui descritto resta da fare.
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

### 10. App Mobile (PWA) — **IMPLEMENTATA IN PARTE** (Set 2026)
- **Fatto**: PWA clienti installabile con app-shell offline (`vite-plugin-pwa` su `vite.customer.config.ts`: `display: standalone`, workbox con precache degli asset, `navigateFallback: '/customers/index.html'`, `navigateFallbackDenylist: [/^\/api\//]`, `registerType: 'prompt'` per non forzare l'aggiornamento). Le route admin sono in un bundle separato e non vengono cacheate.
- **Da fare**: vedi "Idee e implementazioni future" (touch, push, gesture, verifica responsive), con la valutazione di merito.
- **Descrizione originale**: esperienza mobile nativa, installazione home screen, push notifications
- **Motivazione**: esperienza mobile, accessibilità

### 11. Gestione Staff Avanzata
- **Descrizione**: turni, assegnazioni, timetable per personale
- **Modello**: `Shift { userId, standId, date, startTime, endTime, role }`
- **API**: CRUD turni, disponibilità staff, assegnazione automatica
- **Frontend**: calendar view, swap turni, notifiche assegnazioni
- **Motivazione**: organizzazione lavoro, riduzione conflitti

### 12. Sistema Badge e Gamification — **fatto (1° blocco)**
- **Stato**: modello, assegnazione automatica e profilo utente **implementati e testati** (Ott 2026: 13 test backend + 6 frontend). Nessun nuovo ruolo, nessuna classifica, nessuna assegnazione manuale.
- **Fatto**: `Badge { userId, type, earnedAt, eventId|null }` con indice unico `{ userId, type }`; `syncBadges(userId)` come **unico** punto di attacco (retroattivo e auto-guarente, niente script di backfill); `GET /api/badges/me` con solo `authMiddleware` (i dati sono del chiamante, nessun `userId` in query); sezione "I tuoi badge" in `ProfilePage` con **progresso** sui bloccati; `detachEventFromBadges()` alla cancellazione evento (il badge resta, perde solo il contesto).
- **Tipi reali**: "Primo ordine" 🧾, "Esploratore" 🧭 (3 stand distinti), "Nottefondista" 🌙 (dopo le 22 **locali**, da qui `Event.timezone`), "Fotografo" 📷 (3 foto), "Seguace" 💛 (2 eventi preferiti). Catalogo unico in `services/badge-catalog.ts` (label + icone viaggiano nella risposta).
- **Escluso di proposito**: "**Top Spender**" — premiare chi spende di più è il messaggio sbagliato in un evento dove si consumano token.
- **Rimandato — "Cacciatore POI"**: `ContestParticipation` **non ha `userId`** (partecipante anonimo con UUID in `localStorage`). Per farlo serve legare la partecipazione all'utente quando esiste: è una modifica al flusso contest, non un badge.
- **Leaderboard**: sempre rimandata, per privacy e per il messaggio che manderebbe.
- **Residuo (valutare)**: badge a "numero di ordine specifico impostabile da admin" — un traguardo arbitrario deciso da chi gestisce; da valutare solo se ha un uso concreto (es. "ordine n. 100 dell'evento").

### 13. Chat in Tempo Reale
- **Descrizione**: chat tra utenti e stand per ordini/assistenza
- **Tecnologia**: WebSocket + MongoDB per persistenza
- **Modello**: `Message { senderId, receiverId, standId, content, timestamp }`
- **Frontend**: chat window, notifiche messaggi
- **Motivazione**: supporto clienti, comunicazione diretta

### 14. Audit Log
- **Descrizione**: tracciamento modifiche critiche per sicurezza
- **Modello**: `AuditLog { userId, action, entityType, entityId, changes, timestamp }`
- **Middleware**: hook su operazioni CRUD sensibili
- **API**: `/api/audit-logs` con filtri (solo admin)
- **Frontend**: pagina audit log con filtri
- **Motivazione**: sicurezza, compliance, debugging

### 15. Integrazione GTM (eventi analytics)
- **Descrizione**: estendere il dataLayer/GTM (già presente per ordini cassa, coupon e ordini dal menu) con eventi aggiuntivi:
  - QR Code scansionati (scene contest, menu, recensioni);
  - utilizzo dei Token (top-up/refund/spese osservabili via GTM);
  - percorsi più frequentati nei contest;
  - performance delle diverse aree (discutere).
- **Nota**: la stima visitatori è già implementata in-app (`GET /api/events/:eventId/visitors`), l'eventuale push dei dati in GTM è valutabile in futuro.

### 16. PWA clienti — valutazioni rimandate (Ott 2026)
Queste voci completano **10. App Mobile (PWA)** e sono **non urgenti**: analizzate e rimandate di proposito, non dimenticate. Ogni voce porta con sé la misura e la valutazione, così non va rifatta da capo. **Indicazioni per gli agenti**: non vanno implementate d'iniziativa senza una richiesta esplicita; l'ultima voce descrive **cosa esiste già**, non un lavoro da fare.

- **Ottimizzazione touch** (valutata Ott 2026, **non fatta per scelta**): è l'unica voce di valutazione che merita davvero il lavoro, e costerebbe poco. Due difetti misurati: ① il pulsante più toccato dell'app (`.addBtn` nel menu stand, `EventStandMenuPage.module.scss:345`) ha `padding: 0.4rem 0.9rem` e **nessun `min-height`** → alta ≈29px: passa il minimo WCAG AA (24px) ma è sotto i 44px raccomandati da Apple e i 48dp di Material; sulle pagine pubbliche ci sono 316 blocchi di stile e sole 13 dichiarazioni `min-height`. ② **100+ regole `:hover` in ~60 file e zero `@media (hover: hover)`**: su telefono lo stile hover resta applicato dopo il tocco finché non si tocca altro. Intervento proposto, tutto CSS e senza toccare l'architettura: `touch-action: manipulation` in `global.scss`, hover sotto `@media (hover: hover)` e `min-height` con token condiviso. **Ambito consigliato: solo pagine pubbliche** — l'admin è desktop e lì il problema touch non esiste.
- **Push notifications** (valutata Ott 2026, **consigliata rimandare**): il caso d'uso ovvio ("il tuo ordine è pronto") è già coperto dalla pagina di tracking e dal display pubblico, che in un evento restano accese. Servirebbero davvero alla postazione di cucina, ma l'ostacolo è serio: `vite.customer.config.ts` usa la strategia predefinita `generateSW`, e **Workbox in quella modalità non supporta gli handler `push`** → serve passare a `injectManifest` con un `sw.ts` proprio, riscrivendo l'app-shell offline che oggi funziona. Servono inoltre VAPID, `web-push` lato backend, modello `PushSubscription`, gestione delle subscription morte (410) e il vincolo di Render free (un solo processo). **Decisivo: sull'app locale non è possibile**, perché `.local/docker-compose.yml:16` serve su `http://<host>:4000` e service worker e push richiedono un contesto sicuro: per usarle in piazza servirebbe TLS con certificato autofirmato da installare a mano su ogni telefono. Su iOS funzionano solo con la PWA installata nella home screen.
- **Gesture** (valutata Ott 2026, **consigliata cancellare**): non c'è nessuna interazione che le richieda (niente carousel da scorrere, niente drag-and-drop lato cliente; Leaflet gestisce già pan e zoom al tocco). Implementare gesture senza un caso d'uso porta a navigazioni accidentali proprio mentre un visitatore sta ordinando.
- **Verifica del layout responsive** (valutata Ott 2026): è QA, non una feature. Non esiste tooling di test visivo (solo vitest unitari), quindi sarebbe un giro manuale sulle pagine pubbliche; l'unico controllo automatico sensato coprirebbe la regola "bersagli di tocco", non l'aspetto reale.
- **Stato attuale**: installabile (manifest, `standalone`, icone maskable e apple-touch), con prompt di installazione (`CustomerPwaPrompt.tsx`: `beforeinstallprompt`, riconoscimento standalone, dismissal persistito), app-shell offline (workbox precache + `navigateFallback: '/customers/index.html'` con denylist delle API), viewport touch-ready (`width=device-width, viewport-fit=cover`) e 59 media query. Le route admin restano fuori dal bundle customer e non vengono cachate.

### 17. Pubblicazione social — analisi problematiche (ricerca Ago 2026)
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

### 18. Visualizzazione Google Maps su EventMapPage (feature futura)
- Mostrare stand e POI dell'evento anche su una visualizzazione "Google Maps" scelta dall'utente nella mappa.
- Orientamento: soluzione **ufficiale con API key** (Google Maps JavaScript API), non endpoint tile non ufficiali (violano i ToS Google).
- Richiede: chiave API Google Cloud (Maps JavaScript API) configurata come `VITE_GOOGLE_MAPS_KEY`, vista/mappa dedicata con marker custom per evento, stand e POI (popup come l'attuale pagina Leaflet).
- Stato attuale: EventMapPage usa Leaflet con tile Esri (Satellite + Mappa); marker già renderizzati come overlay, ma nessuna base layer Google.

### 19. Warning di compilazione — inventario e stime (Ott 2026)
Risposta alla nota del supervisore «Quanto lavoro ci vuole per eliminare tutte le warnings di compilazione?». Inventario misurato il 19/10/2026, non a occhio:

- **Backend: zero warning.** `npm run lint` (0 errori, 0 warning), `npm run typecheck` pulito, `npm run build` senza avvisi. Non c'è nulla da fare.
- **Frontend — ESLint: 10 warning, tutti `react-hooks/exhaustive-deps`, 0 errori.** Per file:
  - `ImageUploader.tsx:19` — l'inizializzazione condizionale di `images` rende le dipendenze del `useCallback` instabili: va wrappata in un `useMemo` proprio. **Banale.**
  - `MapPicker.tsx:108` e `:117` — due `useEffect` senza dipendenze (`center`, `onChange`, `resetCenter`, `currentLat/Lng`…); il `onChange` però viene dai componenti chiamanti, quindi serve `useCallback` a monte in più pagine. **Il caso più scomodo.**
  - `EventCashierPage.tsx:181` (`stands`), `EventsPage.tsx:380` (`fetchEvents`), `OrderDetailPage.tsx:57` (`load`), `StandDetailPage.tsx:142` e `:239` (`fetchStand`, `fetchStations`, `checkFavorite`, `fetchEventProducts`) — `useEffect` che richiedono `useCallback` sui fetch definiti nel body: refactor meccanico, ma ognuno va verificato per non introdurre loop di fetch (il motivo per cui le dipendenze sono state lasciate fuori).
  - `EventDetailPage.tsx:117` e `EventStandMenuPage.tsx:168` — due `useMemo` che mancano `event`: aggiungere la dipendenza è un attimo, verificare che non ricalcoli troppo spesso.
  - **Stima: 2–4 ore** per tutti e 10.
- **Frontend — vite build: un solo chunk da 2,18 MB (621 kB gzip) > soglia 500 kB.** La correzione vera è il code splitting con `React.lazy`/`Suspense` sulle rotte del router principale: **mezza giornata** incluse la verifica dello stato di caricamento su ogni rotta. Alzare `chunkSizeWarningLimit` silenzia l'avviso senza ridurre il bundle — è mascheramento, non fix, e non va fatto.
- **`PLUGIN_TIMINGS`** (avviso del build tool sul tempo di `vite:css`): è un'informazione sugli strumenti di build, non un difetto del codice — non è eliminabile.
- **Totale realistico per arrivare a zero warning: circa 1 giorno** (2–4 h ESLint + mezza giornata code splitting). Non è urgente: i warning attuali non indicano bug, sono scelte note di dipendenze React.
