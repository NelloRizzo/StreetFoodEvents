# AGENTS.md — Street Food Events

## ISTRUZIONI
Si tratta di un sistema di gestione di stand enograstronomici per eventi di street food.
Il sistema di gestione prevede utenti che possano avere ruoli diversi (applicativi, per evento e per stand).
La gestione prevede già un meccanismo di autenticazione utente e un primo esempio di modello di evento in mongodb.

## Repo structure

Two independent npm packages in `backend/` and `frontend/`. No monorepo tool — run commands inside each directory.

## Feature Checklist

### Utenti

- [x] Gestione dei "preferiti" per l'utente
    - in questa sezione l'utente aggiunge manifestazioni e/o stand che, nel frontend appariranno in un menu di scelta veloce per raggiungerli
- [x] Produzione di un QR Code per l'identificazione dell'utente
    - in questo modo l'utente potrà essere identificato, nel front end, attraverso la lettura del QRCode tramite webcam
    - il QRCode dovrà essere prodotto in fase di registrazione e reso disponibile nella sezione _/me_ oltre ai dettagli dei crediti disponibili nei diversi eventi

### Eventi

- Ad ogni evento aggiungere:
    - [x] url pagina ufficiale (opzionale)
    - [x] descrizione breve (opzionale) e descrizione lunga (opzionale)
    - [x] un editor html custom per la produzione di descrizioni "belle"?
        - TipTap RichEditor (B/I/U/S, H2/H3, liste, blockquote, link)
        - Descrizioni renderizzate come HTML in EventDetailPage, HomePage, DashboardPage, lista Eventi

### Stand

- [x] Uno stand è collegato ad un evento
    - ha un nome, uno slogan (opzionale), una descrizione (opzionale)
- [x] Ogni stand ha diverse postazioni (es. cucina, griglia, bibite...)
- [x] Ad ogni stand è collegato un menu di prodotti in vendita

    - [x] ogni prodotto ha una immagine di cover, una galleria opzionale, un nome e un elenco di ingredienti oltre ad un prezzo

        - il prezzo potrebbe essere legato all'evento, per cui il gestore dello stand potrebbe proporre gli stessi prodotti in eventi diversi con prezzi diversi
        - il prezzo potrebbe essere legato allo stato di utente (es. vip, ospite?)

    - [x] ogni prodotto è dedicato ad una specifica sezione dello stand (es. cucina, griglia, bibite...) così che il personale di quella sezione vedrà, negli ordini solo i prodotti di propria competenza

### Ordini

- [x] Un cliente può effettuare ordini on line smistati automaticamente alle diverse postazioni dello stand oppure un operatore può caricare un ordine per un cliente (in questo caso il pagamento avviene al caricamento dell'ordine)
- [x] Pagamento misto: crediti evento + moneta reale (es. 5 crediti + €5 su un totale di €10). `creditAmountUsed` traccia quanti crediti sono usati; il resto è pagato esternamente senza toccare il wallet
- [x] Il pagamento può avvenire automaticamente mostrando il proprio QRCode al cassiere o manualmente attraverso l'azione diretta del cassiere
- [x] Su richiesta è disponibile un resoconto delle transazioni effettuate per ogni stand (resoconto della serata, resoconto dall'inizio della manifestazione, resoconto per tutte le manifestazioni alle quali lo stand ha partecipato)
    - il resoconto deve essere disponibile in formato semplice (saldo entrate/uscite) e dettagliato (elenco completo delle transazioni legate allo stand)

### Prossimi sviluppi

- [x] **Gestione Staff / Postazioni** — interfaccia per assegnare il personale alle postazioni degli stand (CRUD `user-stations`)
- [x] **Pagina Eventi** — gestione CRUD degli eventi nel frontend
- [x] **Pagina Utenti** — gestione CRUD degli utenti nel frontend
- [x] **Pagina EventUsers** — gestione delle associazioni utente-evento
- [x] **Test** — scritti con vitest: 80 test backend (models, utils, services, controllers) + 16 test frontend (lib/api, lib/theme)
- [x] **Disponibilità prodotto** — `EventProduct.available` booleano, toggle in admin, esclusione da ordini
- [x] **Receipt & QR code** — ricevuta pubblica + QR code per ordini
- [x] **Guide stampabili** — `/guide/:role` con 4 guide operative Q&A

### Cassa Unica (Jun 2026)

- [x] **Ruolo `event-cashier`** — ruolo scope `event` con permessi ordini/pagamenti. Seed in `roles-populate.ts`
- [x] **Assegnazione ruolo** — Marco (cashierUser) riceve `event-cashier` per Spring Event
- [x] **`GET /auth/me/stands`** — esteso per includere stand da ruoli evento
- [x] **`EventCashierPage`** — `/events/:eventId/cashier` — selettore stand + griglia prodotti, crea ordini per lo stand selezionato
- [x] **`EventOrdersPage`** — `/events/:eventId/orders` — tutti gli ordini dell'evento, filtrabili per stand
- [x] **EventDetailPage** — pulsanti "Cassa unica" + "Gestisci ordini evento"

### Coordinate Stand & Mappa (Jun 2026)

- [x] **`location` su Stand model** — campo GeoJSON `{ type: 'Point', coordinates: [lng, lat] }`
- [x] **Controller stand** — include `location` in response e CRUD
- [x] **Seed coordinate** — coordinate realistiche per ogni stand seed
- [x] **`EventMapPage`** — `/events/:eventId/mappa` — Leaflet mappa con marker stand + POI

### POI — Points of Interest (Jun 2026)

- [x] **Modello `POI`** — name, description, coverImage, gallery, location, iconType, iconImage, eventId
- [x] **CRUD API POI** — `GET/POST/PATCH/DELETE /api/pois`
- [x] **Seed POI** — punti di esempio per Spring Event
- [x] **`PoiDetailPage`** — `/events/:eventId/pois/:poiId` — dettaglio con cover, gallery, descrizione
- [x] **Gestione POI in EventDetailPage** — sezione admin per creare/modificare/eliminare POI

### Due Dashboard con Toggle (Jun 2026)

- [x] **`viewMode` in AuthContext** — `'user' | 'operator'`, default in base ai ruoli
- [x] **Navbar** — cambia navigazione in base al viewMode attivo
- [x] **DashboardPage** — mostra contenuti diversi in base al viewMode
- [x] **Toggle** — pulsante per passare da vista utente a operatore

### Home Page ordinata (Jun 2026)

- [x] **`listEvents` sort** — cambiato da `{ startDate: -1 }` a `{ startDate: 1 }` (prima i più prossimi)

## Backend (`backend/`)

Express + Mongoose + argon2 session auth (httpOnly cookie). ESM, TypeScript, Node ≥22.

### Commands

| Command | What |
|---|---|
| `npm run dev` | `tsx watch src/server.ts` (auto-restart) |
| `npm run build` | `tsup src/server.ts --format esm --platform node --target node22 --out-dir dist --clean` |
| `npm run start` | `node dist/server.js` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `eslint .` (flat config) |
| `npm run format` | `prettier . --write` (no config file found) |
| `npm run test` | `vitest run` (80 tests) |
| `npm run populate:database` | `tsx src/scripts/populate-database.ts` |
| `npm run reset:database` | `tsx src/scripts/reset-database.ts --password=<password>` |

### Gotchas

- **MongoDB requires a replica set** — the `.env` uses `replicaSet=rs0` because Mongoose transactions are used.
- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths + tsup resolves it).
- **Auth**: session token in httpOnly cookie named `sid` (configurable). `argon2` for password hashing. Login sets cookie; `auth.middleware` validates on every protected route.
- **Env vars**: validated at startup via Zod. Missing vars cause immediate `process.exit(1)`. See `.env.example` at repo root.
- **Cloudinary**: all image uploads go through Cloudinary. `CLOUDINARY_*` env vars required.
- **ESLint**: flat config (`backend/eslint.config.js`) with TypeScript + Node rules. `argsIgnorePattern: '^_'` for Express error handler params.
- **Entrypoint**: `src/server.ts` → `src/app.ts` → route files in `src/routes/`.

### API routes

| Prefix | Auth |
|---|---|
| `GET /health` | No |
| `/api/auth/*` | Login no, logout/me yes |
| `/api/events/*` | GET public, POST/PATCH/DELETE protected |
| `/api/pois/*` | GET public, POST/PATCH/DELETE protected |
| `/api/stands/*` | GET public, POST/PATCH/DELETE protected |
| `/api/stations/*` | GET public, POST/PATCH/DELETE protected |
| `/api/products/*` | GET public, POST/PATCH/DELETE protected |
| `/api/users/*` | All protected |
| `/api/event-users/*` | All protected |
| `/api/event-products/*` | All protected |
| `/api/favorites/*` | All protected |
| `/api/orders/*` | All protected (list, create, status, cancel, pay, stand report). `DELETE /event/:eventId` requires platform-admin. `GET /:orderId/receipt` is public (before auth) |
| `/api/upload/*` | All protected (POST image/gallery, DELETE image/gallery) |

## Frontend (`frontend/`)

React 19 + Vite 8 + TypeScript ~6.0 + SCSS Modules + React Router 7.

### Commands

| Command | What |
|---|---|
| `npm run dev` | `vite` (dev server on :5173) |
| `npm run build` | `tsc -b && vite build` (typechecks THEN bundles) |
| `npm run lint` | `eslint .` (flat config) |
| `npm run test` | `vitest run` (16 tests) |
| `npm run preview` | `vite preview` |

### Gotchas

- **Vite proxy**: `/api` → `http://127.0.0.1:4000` (backend must be running on :4000).
- **Path alias**: no `@/*` alias in Vite config — imports are relative.
- **SCSS**: uses `@use` for token imports (`_tokens.scss`), not `@import`.
- **Build runs typecheck first** (`tsc -b`), so type errors block the build.
- **Auth**: `AuthContext` wraps the app in `main.tsx`. Calls `GET /api/auth/me` on mount to restore session. `apiRequest` helper uses `credentials: 'include'` for cookie forwarding.
- **Routing**: `createBrowserRouter` in `src/router.tsx` with `AppLayout` wrapping all routes.
- **Favorites**: `src/lib/favorites.ts` provides `fetchFavorites`, `createFavorite`, `deleteFavorite`. Backend `toFavoriteResponse` returns `event`/`stand` objects with `{ id, name, slogan }`.
- **FavoritesPage** at `/favorites` (protected) lists user's favorited stands/events with remove action.
- **Favorite toggle**: A heart button (♡/♥) rendered on each stand card (StandsPage) and stand detail header (StandDetailPage). Uses local `favoriteIds` Set for instant UI toggle.
- **QR code**: `DashboardPage` fetches `GET /api/auth/me/qrcode` on mount and displays a PNG QR code encoding the user ID. The backend uses the `qrcode` package with brand colors.
- **Orders system**: Full backend CRUD under `/api/orders/*` with status workflow (`pending → confirmed → preparing → ready → completed`), payment with mixed credit/external, cancellation with automatic credit refund, and per-stand report with revenue breakdown (credit vs external).
- **Order model**: `Order` with embedded `OrderItem[]` (denormalized product name, price), `creditAmountUsed` for mixed payments, `paymentTransactionId` linking to wallet transaction.
- **Order flow**: `createOrder` validates EventProduct/station/price, uses Mongoose transactions for atomicity. `payOrder` accepts `creditAmount` (defaults to full `total`). `cancelOrder` refunds only `creditAmountUsed`.
- **Frontend orders**: `/orders` (list with filters + quick actions), `/orders/new` (event→stand→menu→cart with station assignment + credit amount), `/orders/:orderId` (detail + status transitions + pay with credit slider).
- **OrdersPage**: filterable list by stand/status, quick status transitions, pay (0 credits = external only), cancel.
- **NewOrderPage**: two-column layout (menu on left, cart on right), select event → stand → browse products, assign per-product station, set credit amount for partial payment.
- **OrderDetailPage**: full order detail, meta badges, item list, next-status action, pay section with credit amount input (0 = external only, partial = mixed), cancel with refund of creditAmountUsed.

## Shared root

- **Feature checklist**: see [## Feature Checklist](#feature-checklist) in this file for the Italian feature todo list.
- `.env.example` at repo root documents required env vars for backend.
- `.gitignore` at root covers both packages (plus ignores `.env` files).
- No CI, no pre-commit hooks, no task runner config found.

## Session History

### Theming system (May 2026)
- **Seasonal themes**: 6 palettes (spring, summer, autumn, winter, christmas, easter) auto-applied via date detection (Easter via Computus, Christmas 15 Dec–6 Jan, meteorological seasons).
- **Per-event colors**: 4 custom fields (themeBrand, themeText, themeSurface, themeHighlight) on Event model + color pickers in EventsPage form. CSS `color-mix()` derives soft/deep/line/glow from these 4.
- **Architecture**: `ThemeProvider` wraps app in `main.tsx`, applies `.theme-*` class on `<html>`; `useEventTheme` hook applies `[data-event-theme]` + inline `--theme-*` vars per component.
- **ThemePreviewPage**: `/theme-preview` route with 6 side-by-side themed cards for evaluation (temporary).
- **StandDetailPage**: fetches event theme from first `eventId` and applies via `useEventTheme`.

### Event detail pages (May 2026)
- **EventDetailPage**: `/events/:eventId` (public route) fetches event + its stands, shows detail + stand cards linked to `/stands/:standId`, applies event theme.
- **HomePage cards**: linked to `/events/:eventId`.
- See next steps in this file's header for remaining work.

### Order management & station queue (May 2026)
- **Counter model**: `backend/src/models/counter.model.ts` — sequenza atomica per `orderNumber` (per-stand, azzerabile).
- **Order model**: aggiunto campo `orderNumber: Number` — intero progressivo assegnato alla creazione via `CounterModel.findOneAndUpdate({ $inc: seq })`.
- **resetOrderCounter**: `POST /orders/reset-counter` con body `{ standId }` — azzera il contatore a 0.
- **StandOrdersPage**: `/orders/stand/:standId` (protetta, dentro AppLayout) — elenco ordini dello stand con filtro per status. Azioni: "Consegna effettuata" (ready → completed), "Annulla", "Azzera contatore". Ogni stazione linka alla coda.
- **StationQueuePage**: `/orders/station/:stationId` (protetta, **fuori da AppLayout**, no navbar/footer) — fullscreen kiosk-view, font grandi, sfondo scuro. Auto-refresh ogni 5s. Mostra solo numero ordine + prodotti + bottone "Pronto". Quando non ci sono ordini: messaggio di inattività con checkmark verde.
- **StandDetailPage**: aggiunto link "Gestisci ordini" → `/orders/stand/:standId`; nome postazione ora linka a `/orders/station/:stationId`.
- **Station readiness**: per-item `ready: boolean`. `markStationReady` marca tutti gli item di una stazione come pronti; auto-transizione a `ready` quando tutti gli item dell'ordine sono pronti.

### Dashboard stand management links (May 2026)
- **`GET /api/auth/me/stands`**: nuovo endpoint che restituisce gli stand (tramite `UserRoleModel` scope stand) e le stazioni (tramite `UserStationModel`) assegnate all'utente autenticato.
- **DashboardPage**: sezione "Gestione stand" con chip link per ogni stand → `/orders/stand/:standId` e ogni postazione → `/orders/station/:stationId`.

### Seed data & scroll fixes (May 2026)
- **`backend/src/scripts/stand-roles-populate.ts`**: assegna Marco (cashier) e Sara (kitchen) allo stand Gourmet Street tramite `UserRoleModel` con `standId` valorizzato. Chiamato da `populate-database.ts` dopo `populateStands`.
- **`backend/src/scripts/orders-populate.ts`**: crea 2 ordini di esempio per Gourmet Street @ Spring:
  - Ordine #1 (`preparing`): 2x Smash Burger (Griglia) + 1x Patate Speziate (Cucina) — 21€, unpaid
  - Ordine #2 (`ready`): 1x Pulled Pork Sandwich (Cucina) + 2x Birra Artigianale (Bibite) — 21€, paid
  - CounterModel aggiornato a seq=2
- **StandOrdersPage (`frontend/src/pages/StandOrdersPage.tsx`)**: link "Torna allo stand" → `/dashboard` (non più `/stands/:standId`)
- **Dashboard scroll fix**: `.app { height: 100vh; overflow-y: auto; }` in `App.module.scss` (da `min-height: 100vh`) — risolve scroll mancante su dispositivi mobili con altezza ridotta.
- **StationQueuePage global CSS fix**: rimossi selettori globali `html, body, #root { overflow: hidden; }` da `StationQueuePage.module.scss` che bloccavano lo scroll su tutte le pagine. Ora `.page` ha `height: 100dvh; overflow: hidden` (scoped) e `.queue` usa `height: 100%; overflow-y: auto`.

### Per-item station readiness & cashier mark-all (May 2026)
- **`markItemReady` endpoint**: `PATCH /orders/:orderId/mark-item-ready` con body `{ eventProductId }` — marca un singolo item come pronto; auto-transition a `ready` quando tutti gli items sono pronti.
- **Cashier "Segna come pronto"**: `updateOrderStatus` quando transizione `preparing → ready` marca **tutti** gli items come `ready: true` (sovrascrive quelli non ancora marcati dalle postazioni).
- **StationQueuePage per-item**: layout column, ogni item ha il suo "Pronto". Quando pronto, l'item viene barrato (`line-through`, opacità 0.45) e il bottone diventa una spunta verde. La card scompare solo quando tutti gli items della stazione sono pronti.
- **StandOrdersPage**: aggiunto pulsante "Segna come pronto" (blu) per ordini in `preparing`, prima di "Consegna effettuata" (verde) che gestisce `ready → completed`.
- **Frontend**: `markItemReady` in `lib/orders.ts`, `handleReady` + pulsante in `StandOrdersPage.tsx`, stile `.readyBtn` blu.
- **Credenziali seed**:
  - Admin: `giulia.ferri@streetfoodevents.test` / `Password123!`
  - Cassiere: `marco.conti@streetfoodevents.test` / `Password123!`
  - Cucina: `sara.leoni@streetfoodevents.test` / `Password123!`
  - Cliente: `luca.rinaldi@streetfoodevents.test` / `Password123!`

### Android Gradle fix (May 2026)
- **`settings.gradle.kts`**: sostituito `dependencyResolution` (blocco inesistente) con `dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS) }` — risolve errore "Unresolved reference" in Gradle 8.12.

### Navbar eventi dropdown (May 2026)
- **Navbar**: aggiunto pulsante "Eventi" per tutti gli utenti autenticati che apre un dropdown con la lista degli eventi (cover, nome, data, luogo). Ogni card linka a `/events/:eventId`. I dati vengono fetchati da `GET /api/events` all'apertura del dropdown. Stessa gestione click-outside degli altri dropdown. Stili mobile (inline) e desktop (absolute positioning).

### GTM integration & privacy fixes (May 2026)
- **Frontend GTM**: creato `src/lib/gtm.ts` con `initGTM`, `pushToDataLayer`, `trackPageView` — script caricato async solo se `VITE_GTM_ID` non vuoto e consenso analytics attivo. Integrato in `AppLayout.tsx` (init a mount, `trackPageView` a ogni cambio rotta) e `CookieConsentBanner.tsx` (init su "Accetta tutti").
- **Frontend config**: creato `src/lib/config.ts` per centralizzare `privacyEmail` da `VITE_PRIVACY_EMAIL` (`.env`).
- **Frontend PrivacyPage**: rimosse `style={}` inline, creato `PrivacyPage.module.scss` con stili dedicati (sezioni, tabella cookie, link brandizzati). Email per diritti letta da `config.ts`.
- **Android GTM**: creato `GtmManager.kt` (sender HTTP leggero — nessuna dipendenza nativa, manda GET a `gtm.js`). `AnalyticsManager.kt` integrato con GTM + callback `reinitialize()`. `ConsentManager.kt` aggiunto `onAnalyticsChanged`. `StreetFoodApp.kt` wired context + callback.
- **Android bug fix**: `PrivacyConsentDialog.kt` — sostituito `androidx.compose.ui.window.Dialog` con `AlertDialog` Material3 (risolve `ComposableFunction0`). Rimosso `import android.app.AlertDialog` che shadowava il composable. Composer BOM aggiornato a `2026.02.00`.
- **Android GTM dep fix**: eliminata dipendenza `play-services-tagmanager` per conflitto `DataLayer`. Implementato sender HTTP diretto via `HttpURLConnection` + `kotlinx.coroutines`.

### QR scanner per wallet (May 2026)
- **`html5-qrcode`**: installato package per scansione QR via webcam.
- **`QRScanner.tsx`**: nuovo componente modale con fotocamera + selettore camera (se più di una disponibile). Nasconde l'overlay interno della libreria (`.qr-shaded-region`). Auto-seleziona camera posteriore. Pulsante "Annulla". Safe stop con `try/catch`.
- **`EventUsersPage.tsx`**: aggiunto pulsante "📷 QR" nella sezione "Collega utente all'evento". Alla scansione, fa `GET /api/users/:userId` per verificare l'ID e auto-seleziona l'utente nel dropdown. Edge case: camera negata, QR con ID inesistente, doppia scansione.

### Stand admin navbar & event association (May 2026)
- **Navbar**: aggiunta voce "Stand" nel menu Amministrazione (link a `/stands`).
- **EventsPage**: su ogni card evento compare il pulsante "Stand" che espande un pannello con la lista di tutti gli stand e checkbox per associarli/scollegarli all'evento. La modifica via `PATCH /stands/:standId` è immediata, con feedback visivo (pillola colorata se collegato, disabilitato durante il salvataggio).
- **StandsPage**: ogni card stand ha ora due link distinti: "Postazioni" e "Prodotti" (entrambi vanno a `/stands/:standId`; "Prodotti" scrolla alla sezione prodotti via hash `#prodotti`).

### Maximum update depth fix — useEventTheme (May 2026)
- **EventDetailPage.tsx**: l'oggetto tema passato a `useEventTheme` era creato inline ad ogni render, causando un loop infinito (cleanup chiamava `setEventTheme(null)` → re-render → nuovo oggetto → cleanup → ...). Fixato con `useMemo` e dipendenze stabili.
- **EventStandMenuPage.tsx**: stesso identico pattern, stessa fix.

### Test controllers (May 2026)
- **4 nuovi file test**: `stands.test.ts` (7 test), `products.test.ts` (6 test), `stations.test.ts` (5 test), `event-products.test.ts` (4 test) = 23 nuovi test.
- Coprono CRUD di stand, prodotti, postazioni e associazioni evento-prodotto (creazione con auth, validazione 401, update, delete, filtro per eventId/standId).
- Totale backend: da 57 a **80 test** (13 files, tutti passanti).

### Product management in StandDetailPage (May 2026)
- **`/stands/:standId`**: aggiunta sezione "Prodotti" con:
  - **"Nuovo prodotto"** — form con nome, ingredienti, prezzo standard, cover image e galleria. Alla creazione (`POST /products`) il prodotto viene salvato nel catalogo globale e il form passa automaticamente alla schermata di associazione con il nuovo prodotto già preselezionato.
  - **"Aggiungi esistente"** — form per associare un prodotto già esistente allo stand: selezione evento (filtrato tra quelli dello stand), prodotto (dal catalogo), prezzo personalizzato opzionale, e postazioni (checkbox). Crea un `EventProduct` via `POST /event-products`.
  - **Elenco** dei prodotti associati con nome, evento, postazioni, prezzo e pulsante "Rimuovi" (`DELETE /event-products/:id`).

### Homepage & Cashier POS (May 2026)
- **Homepage**: riscritta come event showcase (`HomePage.tsx`) — griglia di card evento con cover image, nome, data, luogo. Ogni card linka a `/events/:eventId`.
- **Router (frontend/src/router.tsx)**: nuove rotte protette:
  - `/events/:eventId/stands/:standId/orders` → `StandOrdersPage` (event-filtered)
  - `/events/:eventId/stands/:standId/order` → `CashierOrderPage` (POS cassa)
- **EventDetailPage**: mostra pulsanti "Gestisci ordini" e "Nuovo ordine" per ogni stand quando l'utente è autenticato.
- **Event-aware StandDetailPage**: il vecchio pulsante "Gestisci ordini" → `/orders/stand/:standId` è stato sostituito con un pannello contenente:
  - Selettore a discesa degli eventi associati allo stand (da `stand.eventIds` filtrato sulla lista `events` fetchata)
  - Primo evento preselezionato automaticamente
  - Due pulsanti: **"Gestisci ordini"** → `/events/:eventId/stands/:standId/orders` e **"Nuovo ordine"** → `/events/:eventId/stands/:standId/order`
- **CashierOrderPage**: POS layout calculator-style con:
  - Top bar: selezione cliente (dropdown, QR scan o "Ordine diretto")
  - Station tabs per filtrare i prodotti
  - Griglia di pulsanti prodotto grandi (tipo calcolatrice)
  - Notes modal: quantità + note testuali + selettore stazione (se > 1)
  - Pannello carrello laterale con riepilogo
  - Pagamento con crediti misti
  - Submit & reset — dopo l'invio con successo il carrello viene svuotato e la pagina resta pronta per un nuovo ordine
- **StandOrdersPage**: accetta `eventId` opzionale da URL per filtrare ordini per evento; verifica ruolo stand via `GET /api/auth/me/stands`.
- **Role check**: tutte le pagine ordini/cassa verificano che l'utente abbia un ruolo sullo stand chiamando `GET /api/auth/me/stands` al mount.

### Cassa unica — implementazione (Jun 2026)
- **Ruolo `event-cashier`**: aggiunto in `roles-populate.ts` con scope `event`, permessi `orders:*` e `payments:*`. Assegnato a Marco per Spring Event in `events-populate.ts`.
- **`getMyStands`**: esteso in `auth.controller.ts` per includere stand da ruoli evento (oltre a ruoli stand). Usa `RoleModel.find({ scope: 'event' })` per trovare i roleId evento, poi cerca UserRole con eventId non nullo, e infine recupera tutti gli stand per quegli eventi tramite `StandModel.find({ eventIds: eventId })`.
- **`EventCashierPage`**: nuova pagina a `/events/:eventId/cashier`. Layout a due colonne (menu/carrello) come CashierOrderPage, ma con un selettore stand in alto. Verifica ruolo event-cashier via `/auth/me/roles`. Fetcha prodotti/postazioni/utenti per lo stand selezionato.
- **`EventOrdersPage`**: nuova pagina a `/events/:eventId/orders`. Mostra tutti gli ordini dell'evento filtrabili per stand. Stesse azioni di StandOrdersPage (pronto, consegna, annulla). Report aggregato.
- **Router**: nuove rotte `/events/:eventId/cashier` e `/events/:eventId/orders` (protette).
- **EventDetailPage**: pulsanti "Cassa unica" e "Gestisci ordini evento" visibili solo se l'utente ha ruolo event-cashier o platform-admin per quell'evento.
- **DashboardPage**: sezione "Gestione eventi" con link per ogni evento dove l'utente ha ruolo event-level.

### Coordinate Stand & POI Map (Jun 2026)
- **Stand location**: aggiunto campo `location` (GeoJSON Point) a `stand.model.ts`. CRUD aggiornato in `stands.controller.ts`.
- **Seed coordinate**: coordinate realistiche per Gourmet Street, BBQ Revolution e Sweet Corner (`stands-populate.ts`).
- **POI model**: creato `poi.model.ts` con `{ name, description, location, iconType, iconImage, coverImage, gallery, eventId }`.
- **POI controller**: CRUD completo in `pois.controller.ts`, route `/api/pois/*` in `pois.routes.ts`.
- **Seed POI**: 5 punti di esempio per Spring Event (Info Point, Ingresso, Parcheggio, Palco, Bagni) in `pois-populate.ts`.
- **EventMapPage**: nuova pagina a `/events/:eventId/mappa` con Leaflet. Mostra marker stand (🏪) e POI (emoji per tipo). Popup con link a stand/POI detail.
- **PoiDetailPage**: nuova pagina a `/events/:eventId/pois/:poiId` con cover image, galleria, descrizione, coordinate.
- **Router**: nuove rotte `/events/:eventId/mappa` e `/events/:eventId/pois/:poiId`.
- **EventDetailPage**: pulsante "Mappa" sempre visibile nell'header.

### Due Dashboard con Toggle (Jun 2026)
- **`viewMode` in AuthContext**: stato `'user' | 'operator'` con `setViewMode`. Default `'user'`.
- **Navbar toggle**: segment control "Utente / Operatore" nella navbar (mobile e desktop). Cambia navigazione in base a `viewMode`.
- **DashboardPage duale**: vista utente mostra eventi/wallet/QR; vista operatore mostra gestione stand/eventi/wallet admin.
- **Navbar**: usa `useAuth()` direttamente invece di props per accesso a `viewMode`/`setViewMode`.

### Home page ordinata (Jun 2026)
- **`listEvents` sort**: `startDate: -1` → `startDate: 1` (eventi più prossimi per primi) in `events.controller.ts`.

### POI Management admin su EventDetailPage (Jun 2026)
- **Sezione "Punti di Interesse"** su EventDetailPage — visibile solo a utenti con ruolo evento (`hasEventRole`). Form inline per creare/modificare POI: nome, descrizione, coordinate (lat/lng con virgola), icona (select), cover image (ImageUploader single), galleria (ImageUploader multiple). Elenco POI con pulsanti Modifica/Elimina. API CRUD via `GET/POST/PATCH/DELETE /api/pois/*`.
- **UseEffect separato** per fetch POI all'apertura pagina (`GET /pois?eventId=${eventId}`).
- **Salvataggio** con `bodyJson` di `apiRequest`, coordinate convertite da stringa a numero con `replace(',', '.')`.

### Descrizioni HTML — RichEditor (Jun 2026)
- **RichEditor component**: `frontend/src/components/RichEditor.tsx`, basato su TipTap (StarterKit + Underline + Link). Toolbar: B/I/U/S, H2/H3, bullet/ordered lists, blockquote, link. Integrato in EventsPage per `shortDescription` e `longDescription`.
- **EventDetailPage rendering**: `shortDescription` passato da `<p>{text}</p>` a `<div dangerouslySetInnerHTML>`. CSS liste (`ul/ol/li`) e link (`a`) aggiunti per `.shortDesc` e `.longDesc`.

### Miglioramenti cassa unica (Jun 2026)
- **Ruolo `stand-pickup`**: aggiunto in `roles-populate.ts` (scope `stand`, permessi `orders:read`, `orders:update`). Assegnato agli operatori stand che possono solo confermare consegne.
- **Auto-transition ordini**: ordini pagati su EventCashierPage partono come `confirmed` invece di `pending`.
- **Conferma + scontrino**: dopo la creazione ordine, popup con numero ordine; pulsante "Stampa" usa `window.print()` con sezione `@media print` (evento, stand, nr ordine, prodotti, totale, data).
- **Notifica sonora**: 880Hz beep su StationQueuePage quando arrivano nuovi ordini.

### Fix città e googleMapsUrl (Jun 2026)
- **`handleCityQueryChange`**: ora aggiorna `form.city` via `setForm((prev) => ({ ...prev, city: value }))` — la città digitata viene effettivamente inviata al backend.
- **`googleMapsUrl` persistente**: rimosso il guard `urlEditMode` in `handleSubmit`. `form.googleMapsUrl` è sempre usato (se non vuoto), anche dopo "Fine modifica".
- **Dropdown regione/provincia abilitati**: `normalizeCountry()` converte `null`/`''`/`'Italia'`/`'IT'` in `'ITA'`. Seed `events-populate.ts`: `country: 'Italia'` → `'ITA'`.
- **Priorità URL maps**: ordine `generateGoogleMapsUrl` (backend) e `autoGeneratedUrl` (frontend) cambiato: coordinate → indirizzo → città.
- **Preferiti su EventDetailPage**: pulsante ♡/♥ nell'header, fetch iniziale e toggle come su StandDetailPage.

### HTML descrizioni su tutte le pagine (Jun 2026)
- **HomePage & DashboardPage**: shortDescription resa con `dangerouslySetInnerHTML` + CSS liste/link (prima era testo piano).
- **Lista Eventi (EventsPage)**: stesso fix sulla card lista (`<span>` → `dangerouslySetInnerHTML`).
- **FavoritesPage**: shortDescription resa con `dangerouslySetInnerHTML` + CSS `ul/ol/li/a` su `.cardDesc`.
- CSS per `ul/ol/li` e `a` aggiunto a tutti gli stili `.shortDesc`, `.longDesc`, `.cardDesc`, `.eventDesc`.

### Mappa Eventi — marker e zoom (Jun 2026)
- **Marker evento**: aggiunto marker 📍 sulla mappa dell'evento (prima solo stand e POI).
- **Zoom massimo**: `fitBounds` ora ha `{ maxZoom: 15 }` — evita zoom eccessivo quando c'è un solo marker.
- **Zoom iniziale**: da 16 a 14.
- **Zoom stand selezionato**: da 19 a 16.
- **Reset zoom**: anche il pulsante "Reset zoom"/selettore "Tutti gli stand" usa `maxZoom: 15`.

### Coordinate con virgola (Jun 2026)
- **Input lat/lng**: passati da `type="number"` a `type="text" inputMode="decimal"` con `replace(',', '.')` — accettano la virgola come separatore decimale (locale italiano).

### Favicon (Jun 2026)
- **`frontend/public/favicon.svg`**: forchetta + coltello bianchi su sfondo brand `#bf5a2a`, rounded square.

### Eliminazione ordini evento & disponibilità prodotto (Jun 2026)
- **`deleteEventOrders`**: `DELETE /api/orders/event/:eventId` (platform-admin only) — cancella tutti gli ordini di un evento e azzera i counter degli stand. Pensato per pulire dati di test/dimostrazioni.
- **`available` su EventProduct**: campo booleano default `true`. `PATCH /event-products/:id` accetta `{ available: bool }`. Toggle "Disponibile / Non disp." su StandDetailPage e EventProductsPage.
- **Ordini filtrano prodotti**: CashierOrderPage, EventCashierPage, NewOrderPage escludono i prodotti con `available === false`.

### Ricevuta e QR code ordini (Jun 2026)
- **`GET /api/orders/:orderId/receipt`** (pubblica): restituisce numero ordine, status, eventName, standName, prodotti, totali, crediti, data.
- **`GET /api/orders/:orderId/receipt-qrcode`** (protetta): rigenera il QR code per la ricevuta.
- **`createOrder` response**: include `receiptQrCode` (data URL che punta a `/receipt/:orderId`).
- **`Order.receiptQrCode`**: campo opzionale nel tipo TypeScript frontend.
- **EventCashierPage**: QR code nel popup di conferma + nella sezione `@media print`.
- **`/receipt/:orderId`**: pagina pubblica con dettaglio ricevuta e pulsante "Segna come ritirato" per utenti autorizzati.
- **Link "Ricevuta"**: aggiunto a OrderDetailPage, StandOrdersPage, EventOrdersPage.

### Guide stampabili (Jun 2026)
- **`GuidePage`** a `/guide/:role`: 4 guide operative in formato Q&A con glossario finale:
  - `event-admin` — Amministratore Evento (accesso evento, POI, cassa unica, prodotti non disp., cancellazione ordini)
  - `event-cashier` — Cassiere Unico (cassa unica, selezione stand/cliente, pagamento crediti, scontrino)
  - `station-attendant` — Addetto a Postazione (coda postazione, refresh 5s, segnalazione pronto)
  - `stand-cashier` — Cassiere Stand (vista operatore, creazione ordini, stati, resoconti)
- **Stampa A4**: `@media print` rimuove il selettore ruoli, layout pulito.
- **Link "Guide"** nel dropdown utente della navbar.

### Volantino / Flyer — pagina promozionale stampabile (Jun 2026)

- **Decisione architetturale**: il volantino doveva stamparsi senza pagine bianche. Due strade tentate:
  1. **React Page dentro SPA** (FlyerPage / VolantinoPage) — fallita: `min-height: 100vh` + `overflow: hidden` su `.page` e su `#root`/`body` clippano il contenuto in stampa, anche con override `!important` in `@media print`
  2. **HTML puro in `public/`** — soluzione definitiva: Vite copia `public/` → `dist/`, `npx serve -s` serve il file esatto se il path matcha un file/directory index

- **Cartella**: `frontend/public/flyer/` → servito a `/flyer/index.html`
- **Link navbar** (`Navbar.tsx`): `<a href="/flyer/index.html" target="_blank">` link diretto al file statico, nessuna route React coinvolta
- **Niente route React**: il vecchio `VolantinoPage.tsx` e `VolantinoPage.module.scss` eliminati. La route `path: 'volantino'` rimossa dal router.
- **Fix stampa**: nell'HTML standalone, `@media print` aggiunto `body { overflow: visible !important; min-height: auto !important; }`

#### Cosa NON fare
- Non tentare di servire il volantino via React (`serve -s` serve il file statico di `public/` prima della SPA fallback, ma solo se il path matcha un FILE o DIRECTORY INDEX esatto — `/flyer/index.html` è sicuro, `/flyer/` potrebbe andare in SPA fallback in alcune versioni di `serve`)
- Non aggiungere `min-height: 100vh` o `overflow: hidden` su wrapper che devono stampare — se inevitabile, aggiungere override esplicito `!important` nel `@media print` (e anche così potrebbe non bastare per wrapper annidati come `#root`)

## Render deploy

`render.yaml` configura due servizi web (backend + frontend), piano free, regione Frankfurt.

### Ignora AGENTS.md nei deploy

L'`ignoreCommand` in `render.yaml` evita che modifiche al solo `AGENTS.md` attivino un deploy su Render:

```yaml
ignoreCommand: >
  git diff --name-only HEAD~1 HEAD | grep -v '^AGENTS\.md$' | grep -q .
```

- Se cambiano solo file `AGENTS.md` → comando esce con codice non-zero → Render **salta** il build.
- Se cambiano altri file (anche insieme ad `AGENTS.md`) → esce con 0 → build **eseguito**.
