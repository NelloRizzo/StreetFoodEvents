# CHANGELOG — Street Food Events

Tutte le feature implementate, in ordine cronologico.

## Luglio 2026
- Slideshow, galleria, invio email foto, stampa full-page.
- Contest: caccia ai POI con QR code, partecipazione anonima, ruoli contest-admin.

## Settembre 2026
- App locale offline + sync remoto (primo step): il backend cloud espone le API di sincronizzazione `/api/sync` protette da bearer token statico (`SYNC_API_TOKEN` env) — `GET /events`, `GET /events/:eventId/stands`, `GET /events/:eventId/stands/:standId` (snapshot completo evento+stand: event, stand, stations, products, eventProducts, eventUsers, counter) e `POST /push` (upsert di ordini/transazioni/contatori/saldi event-user con guardia LWW). L'app locale (`.local/`) ha un pannello **Sync** che permette di selezionare evento e stand remoto e **importarli** sostituendo completamente i dati locali (wipe transazionale + insert che preserva gli `_id`); se esistono modifiche locali non sincronizzate il pannello chiede di **pushear prima** (modale di conferma). Ledger locale `SyncLedger` traccia le operazioni pendenti, `LocalState` conserva evento/stand attivo correnti; il frontend locale usa `MetaContext` (`Cassa`, `CodaPostazioni`, `CodaPubblica`) al posto della `config.ts` hardcoded. Auth server-to-server a token statico condiviso (`remoteUrl`/`remoteToken` in `.local/backend/src/config.ts`). Test in `backend/src/__tests__/controllers/sync.test.ts` (6 test).

## Agosto 2026
- Visibilità pubblica evento: campo `isPublic` su `Event` (default `true`). Se disabilitato, l'evento non appare nella home pubblica, nel menu Eventi della navbar e nella sezione "Eventi attivi" del dashboard utente (`GET /api/events` e `GET /api/events/home` filtrano per `isPublic: true` per utenti non gestori). Gli operatori con ruolo platform o event-scope continuano a vedere e gestire TUTTI gli eventi, nascosti inclusi. In `EventsPage` (Gestione) nuovo checkbox "Visibile nella parte pubblica" nel form di creazione/modifica e badge "Non visibile nella parte pubblica" sulle card degli eventi nascosti.
- EventDetailPage: sezione stand divisa in due — "Food & Beverage" e "Artigianato" — con conteggio e stati vuoti separati. I numeri progressivi restano globali per evento e i pulsanti ▲/▼ riordinano sulla lista completa.
- Menu pubblico stand (`/events/:eventId/stands/:standId`): la descrizione dello stand, quando presente, viene mostrata prima dei prodotti; la sezione Prodotti è nascosta se lo stand non ha prodotti (e con essa il carrello laterale); la galleria dello stand viene mostrata sotto i prodotti quando presente.
- Tipologia stand (food vs artigianato): campo `type` su `Stand` (`food` default | `artigianato`), già gestito da `createStand` e ora anche da `updateStand`; esposto in tutte le risposte CRUD. In `StandsPage` selettore Tipologia nel form di creazione/modifica (default "Food & Beverage") e badge tipologia nelle card. In `EventMapPage` marker con colore diverso per tipologia (verde food, viola artigianato) e legenda aggiornata. Gestione `ValidationError` Mongoose → 400 nell'error handler di `app.ts` (prima ricadeva su 500).
- ContestPOI collegabile a uno stand: campo `standId` su `ContestPOI` (opzionale, `null` di default) — lo stand dell'evento diventa un POI del contest e gli `hints` fungono da enigmi per individuarlo. Validazione che lo stand appartenga all'evento del POI, nome auto-derivato dallo stand quando non specificato, `standId` esposto in tutte le risposte CRUD e nel dettaglio pubblico del contest (dove il nome mostrato ai partecipanti è quello dello stand). Selettore stand nel form POI in `EventDetailPage` e badge 🏪 con nome dello stand nelle card. Il QR di un POI collegato a uno stand codifica sempre l'URL dello stand nell'evento (`/events/{eventId}/stands/{standId}`, identico a `GET /api/stands/:standId/qrcode`), mai un QR di contest; lo scanner del gioco riconosce l'URL dello stand e lo mappa al POI del contest.
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
- Quantitativi di prodotto venduto nei resoconti: `GET /api/orders/report/stand/:standId` restituisce `productQuantities` (prodotto, quantità, ricavi, escluse le righe degli ordini cancellati) e `GET /api/orders/report/event/:eventId` restituisce `productQuantities` aggregato per stand+prodotto. In `StandOrdersPage` nuova card "Quantitativi prodotti venduti" con tabella e riga TOTALE; in `EventReportPage` nuova card "Quantitativi per prodotto" (colonna Stand quando il filtro è "Tutti gli stand", filtrata per stand altrimenti) con riga TOTALE.
- Nuova tipologia stand "Divertimento": campo `type` su `Stand` ora ammette `food` | `artigianato` | `divertimento`. In `StandsPage` terza opzione nel selettore Tipologia e badge arancione nelle card; in `EventDetailPage` terza sezione stand con emoji 🎡; in `EventMapPage` marker arancione e voce di legenda per gli stand divertimento.
- Ordini omaggio: la cassa può creare ordini omaggio (`Order.isGift`), che partono direttamente `confirmed` + `paid` con totale 0 e nessun addebito (né crediti né cassa); gli articoli conservano prezzo/quantità reali per i conteggi. Numero ordine con prefisso "O" e badge OMAGGIO in display coda, liste ordini, dettaglio, ricevuta (stampa inclusa) e cassa. `GET /api/orders/gift-stats` (auth) conta gli omaggi per stand/evento (solo ordini non cancellati) con soglia 5%: il contatore in cassa diventa rosso quando la percentuale supera il 5%. Nei resoconti, omaggi contati separatamente (`giftOrders`, `giftProducts`, colonna "Omaggi" nelle quantità prodotto) e **esclusi dal fatturato e dagli ordini pagati**.
- Dashboard operatore: gli eventi terminati (fine giornata passata) non offrono più nessuna operazione — badge "Terminato — nessuna operazione" al posto di Cassa/Ordini/Coda/Coda combinata/chip postazioni/Liquidazione. Sezione Resoconti riscritta con dropdown per evento e dropdown per stand + "Menu stampa", al posto della lista crescente di pulsanti.
- Nuove tipologie POI: l'`iconType` di `POI` ammette ora anche `cinema`, `relax`, `ristoro` e `divertimento`. Aggiunte al selettore Icona del form POI in `EventDetailPage` (🎬 Cinema, 🧘 Relax, 🧺 Ristoro, 🎢 Divertimento) e alla resa dei marker in `EventMapPage`. Icona Ingresso cambiata da 🚪 porta a 🪧 cartello.
- Marker mappa stand: i segnaposto degli stand `artigianato` e `divertimento` applicano ora anche la classe base del numero (forma rotonda, dimensione e bordo come gli stand food) oltre al colore dedicato (viola/arancio); stessa correzione per i badge di legenda in `EventMapPage`.
- Numerazione stand globale: i pulsanti ▲/▼ vengono rimossi dalle card delle sezioni per categoria (dove spostavano uno stand dentro la lista globale, mescolando i numeri tra categorie) e sostituiti da una sezione admin dedicata "Numerazione stand" in `EventDetailPage` — un'unica lista di TUTTI gli stand (misti, con badge categoria) ordinata per numero, con ▲/▼. La sequenza resta 1..N globale per evento, senza distinzione di categoria.
- Visualizzazione stand in mappa: ogni voce della sezione "Numerazione stand" ha un toggle "Mappa" che imposta `showOnMap` sul numero dello stand per quell'evento (campo su `Stand.numbers`, default `true`, gestito da `PATCH /stands/reorder`). Uno stand con `showOnMap: false` non appare più come marker né nella combo di `EventMapPage`, ma conserva il suo numero e resta nella numerazione/riordino.
- CRUD categorie globali: nuova pagina admin `Categorie` (`/admin/categories`, voce nella sidebar Gestione) per creare, rinominare ed eliminare le categorie della collezione globale `Category`. Le categorie restano globali (usate da tutti gli stand/eventi nei menu per categoria e nella vista menu); una categoria eliminata sposta i relativi prodotti nel gruppo "Senza categoria".
- Stampa menu per categoria: in `MenuPrintPage` (modalità "Per categoria") ora è possibile selezionare quali categorie stampare (checkbox con seleziona/deseleziona tutte), oltre agli stand. `categoryMenuFullHtml` filtra le sezioni in base alle categorie scelte.
- Form "Nuovo prodotto" dello stand (`StandDetailPage`) allineato al menu Prodotti: aggiunti i campi Descrizione, Allergeni (Reg. UE 1169/2011) e Prodotto congelato, inviati da `createNewProduct`. Le opzioni allergeni sono estratte in un modulo condiviso `frontend/src/lib/allergens.ts` (riusato da `ProductsPage`).
- Fix visibilità pubblica evento: la home ("Eventi in programma") e il menu Eventi della navbar mostravano anche gli eventi con `isPublic: false` quando l'utente autenticato era un gestore (platform/event-scope). Ora `GET /api/events?public=true` filtra SEMPRE per isPublic diverso da `false` (include anche gli eventi senza il campo, legacy) ed è usato dalle superfici pubbliche (HomePage, dropdown Eventi della Navbar); la gestione (`EventsPage`, drop-down Resoconti, ecc.) continua a usare `GET /api/events` senza parametro e vede TUTTI gli eventi. Il dropdown Resoconti della Navbar ora carica gli eventi autonomamente (`/events` senza `public`), così un evento nascosto con report resta raggiungibile dagli operatori. Rimossi loop infiniti nel caricamento navbar (flag `eventsLoaded`/`reportsLoaded`) e nel filtro `endDate` della home page.
- Fix dashboard operatore: la combobox "Seleziona evento" di ogni stand mostrava "Evento" al posto del nome reale quando l'evento dello stand non compariva in `GET /api/events` (es. evento non pubblico per un utente con solo ruoli stand-scope). Ora nome e data di fine di ogni evento vengono risolti con `GET /api/events/:eventId` (endpoint pubblico, restituisce sempre l'evento) per tutti gli eventi degli stand e dei ruoli evento dell'utente. Inoltre la combobox elenca SOLO gli eventi in corso (esclusi quelli terminati), e se l'evento selezionato in precedenza è terminato si ricade sul primo evento in corso dello stand.
- Contest POI da eventi: il pool dei POI disponibili di un contest ora viene sincronizzato automaticamente con TUTTI gli stand e TUTTI i POI dell'evento (`GET /api/contests/contest-pois?eventId=` invoca `syncContestPoisForEvent` prima di rispondere). La sync è idempotente, non elimina nulla e, se esiste già un POI libero con lo stesso nome di uno stand/POI evento, lo collega invece di crearne un duplicato. Nuovo campo `ContestPOI.poiId` (ref POI, default null, mutuamente esclusivo con `standId`): per i POI collegati a un evento il nome viene risolto dal POI reale in `getContest` e `getContestPoiQrCodes`. Il QR degli stand-POI resta quello del menu dello stand (`/events/:eventId/stands/:standId`); i POI-POI evento usano la scan URL del contest. Frontend: form "Nuovo POI" in `EventDetailPage` con selettore Stand O POI dell'evento, badge 📍 per i POI evento nella lista.
- Navigazione rapida tra stand: barra orizzontale scrollabile con chip per ogni stand nell'evento nella pagina menu pubblico (`/events/:eventId/stands/:standId`). Lo stand corrente è evidenziato; click su un altro stand svuota il carrello e naviga al suo menu. Ordinata per numero progressivo. Il carrello resta sticky nello stand selezionato.
- Filtro eventi terminati dalla home: `GET /api/events?public=true` ora restituisce solo gli eventi con `endDate >= now` (gli eventi passati non compaiono più nella home pubblica né nel menu Eventi della navbar). Gli operatori continuano a vedere tutti gli eventi nella gestione.
- QR Code menu stand: nuovo endpoint `GET /api/events/:eventId/menu-qrcode` (no auth) che genera un QR code linkante al menu del primo stand visibile dell'evento (ordinato per numero, filtrato per `showOnMap !== false`). Se nessuno stand è visibile, restituisce 404. Pulsante "⌘ QR" aggiunto in `EventDetailPage` accanto al QR evento.
- Stand bar mobile: la barra di navigazione tra stand nel menu pubblico ora usa frecce ←/→ laterali (visibili solo quando il contenuto è scrollabile) al posto della scrollbar nativa, che è scomoda su smartphone. Le frecce scompaiono automaticamente quando tutti gli stand visibili cabano nello schermo.
- Stand visibili solo in mappa: la barra stand del menu pubblico mostra SOLO gli stand con `showOnMap !== false` per l'evento corrente (stessa logica della mappa).
- Home: i pulsanti "Accedi" e "Registrati" vengono nascosti quando l'utente è già autenticato.
- Categoria nei form prodotto: nuovo componente condiviso `CategorySelect` usato in `EventProductsPage` e `StandDetailPage` — select con le categorie dell'evento più opzione "+ Nuova categoria…" che crea al volo la categoria via `PATCH /events/:eventId`. Le etichette sono normalizzate (trim, spazi multipli collassati) e confrontate senza diacritici/maiuscole per evitare duplicati ("Dolci" vs "dolci  "). Badge categoria sulle card prodotto di entrambe le pagine.
- Dashboard solo utente: rimossa la vista operatore dalla dashboard (`viewMode` eliminato da `AuthContext`) — gestione eventi/stand/wallet/resoconti resta nella sezione admin. La sidebar admin ha una nuova sezione "Operativo" con SOLO gli stand dell'utente (`/auth/me/stands`): link Ordini, Cassa (se autorizzati: platform-admin, ruolo stand `cashier`, o event-admin/event-cashier per l'evento dello stand) e Coda Ordini (apre in nuova tab); per ogni postazione dei propri stand il link "Coda" alla coda postazione. Gli eventi terminati non generano voci operative.
- Duplicazione evento: endpoint `POST /api/events/:eventId/duplicate` (auth) che crea una nuova edizione partendo dalla configurazione dell'evento sorgente — copia luogo, moneta (+simbolo), cambio, tema, descrizioni, cover/logo/galleria, flag cassa, fasce trattenuta, tagli e categorie; collega gli stand dell'evento con numerazione progressiva da 1 (preservando `showOnMap`, `feePercent`, `feeFlat` per-evento), copia le associazioni prodotto→evento (prezzi override, categorie, postazioni, ordine) e i POI (icona, immagine, gallery). NON copia wallet/transazioni/ordini/liquidazioni/foto/cornici/contest/preferiti/alias; `url` riparte vuoto e `cashRegisterResetAt` da null. Body opzionale `{ name, startDate, endDate, isPublic }` (default: nome + " (copia)", date +1 anno). In `EventsPage` pulsante "Duplica" su ogni card con form precompilato (nome, date, visibilità pubblica deselezionata di default) e riepilogo di cosa viene copiato.
- Selettore evento nella sidebar admin: un menu "Evento attivo" in cima alla nav sostituisce le voci moltiplicate per evento. Le sezioni **Ordini** (Cassa evento, Ordini evento), **Operativo** (stand/postazioni filtrati per l'evento selezionato), **Finanziario** (Liquidazione) e **Foto** (Galleria, Photo booth) mostrano solo l'evento scelto; le voci globali (Dashboard, Gestione, Portafogli eventi, Cornici, Piattaforma) restano invariate. La selezione persiste in `localStorage` (`adminSelectedEventId`), segue l'evento nell'URL quando si naviga su pagine event-scoped e, se cambiata mentre si è su una pagina event-scoped, reindirizza alla stessa pagina del nuovo evento. Default: primo evento in corso (non terminato). Nascosto a sidebar compressa. Fix: l'etichetta "Modalità pubblica" nel menu utente mostrava letteralmente `\u00E0` (escape non interpretato in testo JSX).
- Ordinamenti alfabetici: `GET /api/users` ora ordina per cognome+nome con collation italiana case-insensitive (prima: creazione più recente); il blocco Operativo della sidebar ordina alfabeticamente stand e postazioni (`Intl.Collator` it). Le liste stand erano già alfabetiche per nome.
- Pagina gestione stand dedicata: `/admin/stands/:standId/manage` con selettore evento (default primo in corso), card Ordini/Cassa/Coda ordini e sezione Code postazioni. La sezione Operativo della sidebar ha ora UNA voce per stand gestito che porta alla pagina manage, al posto delle voci moltiplicate per evento/postazione.
- Home pubblica: gli eventi futuri/in corso restano nella griglia principale; sotto, nuova sezione compatta "Eventi terminati" con gli ultimi 3 eventi passati ordinati per data di fine decrescente (logo, nome, data).
- Coerenza logo stand nelle superfici: chip e header del menu pubblico usano `logo ?? coverImage`, le card stand di EventDetailPage usano `coverImage ?? logo`, l'header della coda ordini display mostra il logo rotondo dello stand.
- Rimozione legacy: eliminati `AppLayout.tsx`, `Navbar.tsx` e `Navbar.module.scss` (non referenziati; il router usa AdminLayout + PublicLayout).
- Voci DARE/AVERE in euro sulle liquidazioni stand: campo `unit` su `StandSettlement` (`credits` default | `euro`). Le operazioni verso lo standista possono essere registrate direttamente in euro, oltre che in crediti evento: AVERE euro = pagamento diretto (lordo=erogato=importo, nessuna trattenuta né conversione), DARE euro = credito da esigere dallo stand senza movimento di cassa; i tagli sono accettati solo per le liquidazioni in crediti (400 altrimenti). Il saldo si chiude per compensazione con operazioni in direzione opposta (anche parziali). Summary/storico/resoconto aggregato separano crediti ed euro (`loadedEuro`/`settledEuro`); i record legacy senza `unit` contano come crediti (`$ifNull`). UI `/settlements`: toggle In crediti/In euro nel form, anteprime dedicate, card saldo euro, badge "Voce €" nello storico; resoconto con colonne "Voci € DARE/AVERE". Test: 21 casi in `integration-settlements.test.ts`.
- Liquidazioni — stampa elenco transazioni: pulsante "Stampa elenco transazioni" sulla sezione storico di `/settlements`; la stampa mostra intestazione evento+timestamp, barra totali (crediti e voci €) e tabella completa, nascondendo form, riepilogo e paginazione.
- Evento admin centralizzato: nuovo `AdminEventContext` (creato in `AdminLayout`, consumato dalla sidebar e dalle pagine) espone `selectedEventId`, `selectedEvent` e `events` a TUTTE le pagine admin. L'unica combo per scegliere l'evento resta quella "Evento attivo" in cima alla nav della sidebar; le pagine che avevano un proprio selettore locale lo usano ora dal context e non caricano più la lista eventi in autonomia: `EventUsersPage` (Portafogli), `MenuPrintPage` (Stampa menu), `StandDetailPage` (selettore azioni) , `StandManagePage` (Gestione stand), `UsageContractsPage` (filtro contratti) ed `EventProductsPage` (filtro prodotti per evento). I selettori evento che restano sono solo campi di modulo (associazione prodotto, assegnazione ruolo event-scope, evento nel contratto). Scelto un evento diverso da quello corrente, si naviga SEMPRE alla home della dashboard (`/admin/dashboard`) — non si resta sulla stessa pagina (es. StandDetailPage/StandManagePage mostrano tutti gli eventi dello stand e con il nuovo evento potrebbero risultare incoerenti).

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
- Menù pubblico dell'evento (`/events/:eventId/menu`): nuova pagina che riassume i menù di tutti gli stand in un'unica pagina, con vista commutabile "Per stand" / "Per categorie", voci ordinate alfabeticamente (A-Z, case-insensitive), prezzi nascosti quando 0 (menu omaggio), ingredienti e link al menu completo di ogni stand. Pulsante "Menù" nella pagina evento.
- Sezione "Le mie foto" nel dashboard utente: `GET /api/photos/mine` (auth) restituisce le foto scattate dall'utente autenticato raggruppate per evento (ultimi 30 scatti per evento con conteggio totale integro, thumbnail Cloudinary generate server-side). Nel dashboard una card per evento con badge numeri progressivi, indicatore video e link diretto alla galleria; gli eventi terminati mostrano il badge "Terminato".
- Pubblicazione social dalle gallerie foto: seleziona le foto in `EventGalleryPage` → pulsante "Pubblica sui social" → scelta piattaforme + didascalia → coda di pubblicazione su Facebook Page e Instagram professional con polling dello stato. Backend: modello `SocialPost`, endpoint `GET/POST /api/events/:eventId/social/posts` + `GET .../social/config` (photo-admin / platform-admin), servizio Graph API (variante Facebook Login: stesso Page token per FB e IG), worker in-process con retry (max 3, backoff 60s crescente), piattaforma non configurata = post fallito immediato con messaggio chiaro. Solo immagini JPEG (video rifiutati); le foto devono appartenere all'evento. Attivazione via env opzionali `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`, `META_IG_USER_ID`.
- Fix UI vari: select stilizzati in StandManagePage; back-link da Ordini stand verso Gestione stand quando si arriva dalla dashboard; pagine cassa fullscreen senza padding del page-shell (AdminLayout `data-fullbleed`); filtro per evento e categoria modificabile inline nelle card di EventProductsPage; redirect delle vecchie route `/admin/stands/:standId(/orders)` e `/orders/:orderId` verso le posizioni attuali.
- Photo booth aperto a tutti: il caricamento foto (`POST /api/events/:eventId/photos`) non richiede piu' autenticazione per le immagini (chiunque possa aprire la pagina puo' scattare); i video restano riservati agli utenti autenticati (anonimo -> 401). `createdBy` resta null per gli anonimi.
- Cornice di evento: nuovo campo `defaultFrameId` su Event (selezionabile dall'admin foto nella toolbar della galleria, dropdown "Cornice evento" con PATCH evento). Quando impostata, il photo booth applica automaticamente quella cornice e NON mostra piu' il selettore al visitatore; senza cornice di evento il selettore resta disponibile come prima.
- Fondo cassa + movimenti di cassa (cambio valuta): nuovo modello `CashRegisterMovement` (currency `euro`|`credits`, direction `in`|`out`, amount, description, operatore) e subdoc `Event.cashFloat { euro, credits, setAt }`. `GET /api/exchange/:eventId/balance` restituisce ora anche `cashFloat`, `euroContent`, `creditsContent` (fondo + top-up/rimborsi in euro + movimenti, token al contrario) e i totali movimenti; nuove rotte `POST /:eventId/cash-float` (imposta/modifica fondo), `GET/POST /:eventId/cash-movements` (storico paginato + registrazione carico/prelievo per trasferimenti tra casse). Nella pagina cambio la sezione "Contenuto cassa" sostituisce il riepilogo con card Euro/Token separate, form imposta fondo, form movimento carico/prelievo e tabella movimenti; **rimosso il pulsante "Azzera cassa"** (l'endpoint reset-cash-register resta nel backend ma senza UI).
- Cambio valuta fullscreen: la pagina `/admin/events/:eventId/exchange` apre senza sidebar/topbar (hideChrome in AdminLayout, pattern display/cassa); voce "Cambio" nella sezione Finanziario della sidebar admin.
- Utenti solo su invito: `POST /api/users` non accetta più password — crea l'utente inattivo con token di attivazione (hash SHA-256, scadenza 7 giorni) e invia email con link `${CLIENT_URL}/attiva/:token`; se Brevo non è configurato risponde comunque 201 con `emailSent: false` + `activationUrl` da consegnare a mano. Nuovo endpoint pubblico `POST /api/auth/activate { token, password }` che imposta la password (argon2), attiva l'account e invalida il token; `resend-invite` (`POST /api/users/:userId/resend-invite`) rigenera il token invalidando il precedente. Il login distingue "account non ancora attivato" (403 con istruzioni) da "disattivato". `passwordHash` ora nullable. Frontend: `UsersPage` con form invito-only (niente password alla creazione), stato "Invito in attesa", pulsante "Reinvia invito" e banner col link quando l'email non parte; nuova pagina pubblica `ActivationPage` su `/attiva/:token` (password + conferma). Test: `integration-user-activation.test.ts` (4 casi) + users.test.ts aggiornato.
- Gestione contest in pagina admin dedicata: `/admin/events/:eventId/contest-manage` (contest-admin / platform-admin) con tutta la gestione estratta da EventDetailPage — POI del contest (stand/POI evento, indizi, gruppi), creazione/modifica contest con prelievo automatico per gruppi e ordinamento POI, avvia/interrompi, stampa QR. In EventDetailPage resta un blocco link "Gestisci contest" / "Vedi contest pubblici" per chi ha il ruolo.
- Fix mock email nei test: `users.test.ts` ora mocha `@/services/email.service` (con `sendActivationEmail` rifiutante) — senza mock, con BREVO_API_KEY reale in `.env`, la creazione utente inviava email vere agli indirizzi @test.com.
- Breadcrumb admin con nomi reali: in `AdminTopBar` i segmenti con id Mongo vengono risolti col nome dell'evento (`GET /api/events/:id`) o dello stand (`GET /api/stands/:id`) e gli ordini mostrano "Ordine #N" (`GET /api/orders/:id`); etichette italiane fisse per i segmenti noti (Cassa evento, Cambio valuta, Liquidazioni, ecc.). Fetch singolo per id con cache in `requestedRef` e fallback sul placeholder finché il nome non arriva.
- Liquidazione stand più chiara: nella pagina liquidazioni il toggle direzione diventa "AVERE · Pago lo stand" / "DARE · Carico allo stand" con legenda fissa sotto (AVERE = denaro che esce dalla cassa verso lo standista; DARE = valore che lo stand deve al gestore); pulsanti di registrazione autoesplicativi ("Registra liquidazione (paga lo stand)", "Carica crediti allo stand (da restituire)", "Registra addebito/pagamento in euro allo stand").
- Volantino aggiornato (`/flyer`): due nuove sezioni — "Cassa & Cambio" (POS, cambio valuta con fondo cassa, liquidazioni AVERE/DARE, monete personalizzate) e "Foto & Social" (photo booth aperto a tutti, galleria foto/video, slideshow, pubblicazione social) — più card per contest, ordini omaggio, numerazione stand, menù pubblico, display coda ordini e monete personalizzate; hero copy e statistiche allineate (9 aree funzionali).
- Pagina cambio a schermo intero con tema dedicato: come la cassa apre senza sidebar/topbar ma con palette verde scuro (token colore ridefiniti in `.fullPage` di `EventExchangePage.module.scss`, quindi senza impatto sulla pagina liquidazioni che riusa le stesse classi); nuovi titoli/back-link/link testuali chiari sullo scuro; combo "Valuta" e "Tipo" del movimento cassa stilizzate; rimosso il link "Liquidazione stand" e il back-link ora è "← Torna ad admin".
- Pagina cambio: le card "Imposta fondo cassa" e "Registra movimento" sono in una sezione collassabile ("Fondo cassa e movimenti") chiusa di default, così le operazioni comuni di carico/rimborso restano subito raggiungibili.
- Menù evento rifatto col design del menù stand: card prodotto con thumbnail/placeholder, ingredienti e prezzo con icona moneta, click che apre il modale dettaglio (immagine grande + Chiudi), sezioni per stand con logo tondo, badge numerico e link al menù dello stand, oppure vista "Per categorie" con sezioni e indicazione dello stand per ogni voce; toggle a chip "Per stand" / "Per categorie". Riusa direttamente `EventStandMenuPage.module.scss` (il vecchio modulo SCSS della pagina è stato eliminato); l'API `/events/:id/menu` esponeva già `coverImage`, `standCoverImage` e `standLogo`.
