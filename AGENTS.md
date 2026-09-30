# AGENTS.md — Street Food Events

## ISTRUZIONI
Sistema di gestione di stand enogastronomici per eventi di street food. Utenti con ruoli diversi (applicativi, per evento e per stand). Autenticazione già implementata.

## File di riferimento — destinazione delle attività

I file di documentazione sono in `docs/`. Modifiche a questi file NON attivano un deploy su Render (grazie a Ignored Paths configurato sul dashboard).

| File | Destinazione | Cosa scriverci |
|---|---|---|
| `docs/CHANGELOG.md` | **Cronologia feature — ULTIMO MESE** | Changelog rolling: contiene SOLO le voci del mese corrente (ultimo mese). Ogni volta che una feature viene completata, aggiungere una entry in cima alla sezione `## <Mese> <Anno>` corrente. Quando il mese corrente finisce (o la sezione cresce troppo), spostare le voci più vecchie in `docs/CHANGELOG_ANNUALE.md` così `CHANGELOG.md` resta sempre l'"ultimo mese". |
| `docs/CHANGELOG_ANNUALE.md` | **Cronologia storica (annuale)** | Archivio delle voci uscite dal mese corrente. NON si aggiorna con nuove feature: le nuove entry vanno SOLO in `docs/CHANGELOG.md`. |
| `docs/ARCHITECTURE.md` | **Decisioni progettuali** | Pattern architetturali, motivazioni delle scelte, "cose da non fare", gotchas che un agente AI deve conoscere per non ripetere errori. Aggiornare quando si introduce un nuovo pattern o si impara una lezione. |
| `docs/TODO.md` | **Task in sospeso** | Feature non ancora implementate, bug aperti, attività pianificate per il futuro. Spostare qui le entry da `docs/CHANGELOG.md` solo quando diventano obsolete, non quando sono completate. |
| `AGENTS.md` (questo file, radice) | **Setup operativo** | Istruzioni di base, comandi, struttura repo, API routes, deploy. NON contiene storia feature né progetti futuri — solo ciò che serve per operare OGGI. |

## Repo structure

Two independent npm packages (`backend/`, `frontend/`). No monorepo tool. The `printer-agent/` package was removed (Jul 2026) — thermal printer connects directly to Windows cash register machine via `window.print()`. The `photo-point/` Python app was removed (Jul 2026) — photo booth functionality now lives in `frontend/src/pages/PhotoBoothPage.tsx`.

App locale offline in `.local/` (backend+frontend+seed in un solo container, vedi `.local/README.md`). Distribuzione su notebook tramite immagine esportata in `distro/local-app.tar` (cartella **gitignorata**). **Regola operativa**: ad ogni modifica ai sorgenti di `.local/` (o `Dockerfile`/`entrypoint.sh`/compose), una volta verificato `docker compose up --build` (o `npm run local:up`), rieseguire `docker save local-app -o distro/local-app.tar` — mai lasciare l'immagine indietro rispetto al codice.

**DO WHAT THE USER ASKED**: whenever a session touches a source file under `.local/` (or `Dockerfile`/`entrypoint.sh`/compose/.env.example) and the change is verified working, the agent MUST: (1) explicitly tell the user in the final summary that `distro/local-app.tar` needs regeneration (or was regenerated); (2) regenerate the image automatically by running `docker compose up --build` / `npm run local:up` followed by `docker save local-app -o ../distro/local-app.tar` (from `.local/`), unless the changes are still unverified or the user asks to skip. If a change makes the image stale without the agent regenerating it, note it prominently so the user can decide.

## Backend (`backend/`)

Express + Mongoose + argon2 session auth (httpOnly cookie). ESM, TypeScript, Node ≥22.

### Commands

| Command | What |
|---|---|
| `npm run dev` | `tsx watch src/server.ts` |
| `npm run build` | `tsup src/server.ts --format esm --platform node --target node22 --out-dir dist --clean` |
| `npm run start` | `node dist/server.js` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `eslint .` |
| `npm run test` | `vitest run` (187 tests) |
| `npm run populate:database` | `tsx src/scripts/populate-database.ts` |
| `npm run reset:database` | `tsx src/scripts/reset-database.ts --password=<password>` |

### Gotchas
- MongoDB requires a replica set (`replicaSet=rs0`).
- Path alias: `@/*` maps to `./src/*`.
- Auth: httpOnly cookie `sid`, argon2.
- Env vars validated at startup via Zod.
- Cloudinary required.
- ESLint flat config.
- Entrypoint: `src/server.ts` → `src/app.ts` → `src/routes/`.

### Gotchas (backend — data layer)
- `EventUserTransaction.userId` is nullable (`default: null`). Anonymous EventUsers don't have a userId, so transactions for them store `userId: null`.
- `EventUserTransaction.realAmount` stores the EUR equivalent at time of transaction (for top-up: EUR input, for refund: credits input / exchangeRate).
- `Event.exchangeRate` defines how many event currency units = 1 EUR. Default 1 (1:1).
- `ContestPOI.groups` is an array of strings (`[String]`), not a single string. A POI can belong to multiple groups.
- `Contest.pickConfig` (`{ groupPicks: { group, count }[] }`) defines auto-pick rules per group. `Contest.autoPickedPOIIds` tracks which POIs were auto-selected. Manual POI additions are preserved when `pickConfig` changes.
- `Contest.orderedPOIIds` can contain **duplicates** — the same POI ID can appear multiple times. `scannedPOIIds` also stores duplicates (one entry per scan). Completion = `scannedPOIIds.length === orderedPOIIds.length` (total slots, NOT unique count). Do NOT use `Set` or `includes()` to check if a specific occurrence has been scanned — use occurrence-based counting (see ARCHITECTURE.md).
- `StandSettlement` stores computed euro values (`grossEuro`/`feeEuro`/`payoutEuro`) + `exchangeRate` snapshot. `amount` (crediti) è libero — il report stand è solo informativo, nessun check di saldo residuo. Le liquidazioni NON entrano in `getBalance`.
- **Commissione in liquidazione**: l'unica fonte sono le **fasce dell'evento** (`Event.feeBands`), scelte sul **lordo di quella singola liquidazione** (prima fascia col tetto che copre, altrimenti residuale `maxAmount <= 0`): `resolveSettlementFee()` in `exchange.controller.ts`. **NON esistono fee per stand** (`Stand.numbers[].feePercent`/`feeFlat` e il body `eventFees` sono stati rimossi: gestire fasce diverse per stand era troppo complesso). L'unica deroga è la **sovrascrittura in liquidazione**: se il client manda `feePercent`/`feeFlat` quei valori **vengono usati così come sono, anche 0** (`feeSource: 'custom'`), altrimenti valgono le fasce (`'band'`). `feeEuro = min(lordo, lordo% + feeFlat)`, mai oltre il lordo. `feeSource` ∈ `band|custom|none` (+ `stand` ammesso solo per record storici). **GOTCHA 1**: la risoluzione non può stare solo nel frontend, altrimenti una chiamata API senza `feePercent` tratteneva zero. **GOTCHA 2**: il frontend deve **ommettere** `feePercent`/`feeFlat` quando l'operatore non li ha toccati (flag `feeTouched`): mandarli sempre come 0 faceva vincere il client e la fascia non entrava mai.
- `StandSettlement.direction` è `'debit' | 'credit'` (default `'credit'`). `'debit'` (DARE) = carico crediti allo stand, NESSUN pagamento in euro (`grossEuro`/`feeEuro`/`payoutEuro` = 0, `feePercent` ignorato e forzato a 0); `'credit'` (AVERE) = liquidazione con pagamento in euro. `toReturnCredits` (da restituire) = caricati − liquidati, mai negativo. Record esistenti senza `direction` valgono come `'credit'` (`$ifNull` negli aggregate).
- **`CashRegister`** = banco cambio per evento (collezione `cashregisters`: `eventId`, `name`, `status open|closed`, `openedByUserId`, `openedAt`, `closedAt`, `cashFloat { euro, credits, setAt }`). `EventUserTransaction.cashRegisterId` e `CashRegisterMovement.cashRegisterId` sono **nullable** (record legacy senza cassa). Una `top-up`/`refund`/fondo/movimento con `cashRegisterId` nel body è **attribuita alla cassa e validata `status === 'open'`** (400 "Cassa chiusa, operazione non ammessa"); l'operatore è l'unico responsabile (fork bancario: più banchi, ciascuno con la propria cassa). `setCashFloat` con `cashRegisterId` scrive su `CashRegister.cashFloat`, senza → legacy `Event.cashFloat`. Il balance di una cassa **chiusa** = snapshot storico (sola lettura, nessuna scrittura). Il conteggio "transazioni" nel report/master conta **SOLO `top-up` + `refund`** (ripreso dal filtro già usato da `getCashRegisterStats` su `occurredAt` con `from`/`to`).
- **`CashRegister.lowThreshold`** = soglie di sicurezza (sottodocumento `{ euro, credits }`, entrambe nullable; `null` = disattivato). Esposto da lista casse, balance singola e report master. `PATCH /cash-registers/:cashRegisterId` accetta **`name` e/o `lowThreshold` indipendenti** (400 se entrambi assenti, 409 `name_taken` invariato sulla rinomina; entrambe le soglie `null` azzerano il sottodocumento). Sotto soglia la postazione **invia da sola** la richiesta (frontend, vedi sotto); inoltre il contenuto **negativo** triggera l'auto-invio anche a soglia disattivata. `POST /cash-registers` (sia apertura normale sia `{ force: true, cashRegisterToClose }`) **eredita `lowThreshold`** dalla cassa sostituita o dall'ultima cassa chiusa dell'evento, così la postazione non riparta con le soglie azzerate.
- **`POST /api/exchange/:eventId/cash-registers/reset-all`** = azzeramento TOTALE del banco cambio dell'evento (pulsante "Azzera tutto" nel Master Cambio, con conferma distruttiva): **cancella TUTTE le casse** dell'evento (`CashRegisterModel.deleteMany`, sia aperte sia già chiuse, con i loro fondi e il loro storico → la lista casse riparte vuota), **cancella** `EventUserTransaction`, `CashRegisterMovement`, `CashRequest` e `PromotionUsage`, e porta a 0 tutti i `EventUser.balance`. Risposta: `deletedRegisters` (non più `closedRegisters`). **Ordini e `StandSettlement` NON vengono toccati** (il reset di un evento li gestisce `POST /api/orders/event/:eventId/reset`). Dopo il reset il frontend rimuove `sfe_cash_register_<eventId>` dal `localStorage`: la postazione non deve restare agganciata a una cassa cancellata e deve riaprirne una.
- **Rimborso con controllo saldo**: `POST /api/exchange/:eventId/refund` verifica `EventUser.balance >= amount` **prima** di scrivere → 400 con saldo, importo richiesto in token ed equivalente EUR (niente più saldo negativo silenzioso).
- **`EventUserTransaction.paymentMethod`** = `'cash' | 'pos'` (default `cash` sui record legacy). **`Order.isPos`** = boolean (default `false`, forzato `false` sugli omaggi) = la parte reale dell'ordine (`total - creditAmountUsed`) è stata incassata col POS. Il **contenuto fisico** della cassa (`euroContent`/`creditsContent`/movimenti) conta **solo i flussi `cash`**: i POS alimentano **solo i report**. Report: `posRevenue = Σ(total - creditAmountUsed)` sui paid non-omaggio POS, `cashRevenue = totalRevenue - creditRevenue - posRevenue`, con `posOrders` come conteggio.
- **`CashRequest`** (collezione `cashrequests`) = richiesta di contanti/token dalle postazioni di **cambio** alla cassa master. `cashRegisterId` **obbligatorio** (scope solo banco cambio: le casse stand non hanno un `CashRegister`). `kind euro|credits|both`; `amountEuro`/`amountCredits` **nullable** (null = richiesta generica, decide la master) e **mai entrambi valorizzati**; la consegna invece su `both` accetta entrambe le valute. `status pending|acknowledged|delivered|cancelled|confirmed`: `delivered`/`cancelled`/`confirmed` **immutabili**, `delivered` **implica l'ack** se non c'è, `confirmed` (conferma di ricezione della postazione, da `acknowledged|`) **implica l'ack** se non c'è. **Dedup sul `kind` ESATTO** (stessa cassa + stesso kind `pending|acknowledged|**delivered**` → `200 { duplicate: true }`): NON mappare `both` sulle valute singole, altrimenti una richiesta Euro già aperta spegnerebbe una `both` e il cassiere crederebbe di aver chiesto anche i crediti. `pendingCount` resta `pending + acknowledged`. **La consegna registra un `CashRegisterMovement` `direction:'in'`** sulla cassa ricevente (2 movimenti se `both` con due importi), così `euroContent`/`creditsContent` si aggiornano da soli; l'uscita dalla master resta a carico della master (come i movimenti manuali). `isAutomatic` marca le richieste nate dal superamento della soglia: l'auto-invio sta nel **frontend** (`EventExchangePage`, effect sul balance) e **non deve allegare gli importi del form manuale**; `autoSentRef` blocca i POST ripetuti a ogni poll e si **ri-arma** quando il contenuto torna sopra soglia (una consegna parziale non deve generare un loop).
- **Permessi `event-admin` = superset sul proprio evento**: `hasRole(slugs, { eventParam })` soddisfa anche `event-admin` quando è presente un `eventParam`, così il gestore evento non è bloccato dalle guard dei ruoli specifici (`exchange-admin`, `contest-admin`, …) sul proprio evento. `platform-admin` **non** va aggiunto centralmente (route come l'approvazione adesioni lo escludono intenzionalmente → vedi la riga sotto). `GET /api/events` senza `public=true` usa `getEventAccess` (`services/event-access.service.ts`): i gestori non-platform vedono **solo gli eventi per cui hanno un ruolo**, derivati anche dagli stand posseduti; `?public=true` e gli utenti senza ruoli vedono la lista pubblica invariata. **GOTCHA noto**: `hasRole` applica gli scope evento e stand con due chiavi `$or` → su una route con **entrambi** i parametri la seconda sovrascrive la prima e lo scope evento NON viene verificato; va rifatto con `$and`.

### API routes
`GET /health` (no auth). All `/api/*` routes: GET are public except users/event-users/event-products/favorites/orders/upload. POST/PATCH/DELETE are protected.

### API routes — Auth & utenti
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/activate` | no | Attiva account su invito: body `{ token, password }` (≥8), imposta passwordHash (argon2) + isActive, invalida il token |
| POST | `/api/users` | auth | SOLO invito: niente password — crea utente inattivo con token attivazione (SHA-256, 7 giorni) e invia email `${CLIENT_URL}/attiva/:token`; se Brevo non configurata → 201 con `emailSent: false` + `activationUrl` |
| POST | `/api/users/:userId/resend-invite` | auth | Rigenera token attivazione e reinvia email (400 se già attivato) |

Login: utente inattivo o senza password → 403 con messaggio distinto ("non ancora attivato" vs "disattivato"). `passwordHash` è nullable.

### API routes — Events
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/events?public=true` | optional | Lista eventi pubblici e non terminati (`endDate >= now`). Senza `public=true`: tutti gli eventi (solo gestori/platform). |
| GET | `/api/events/:eventId/menu-qrcode` | no | QR code (data URL) che linka al menu del primo stand visibile (`showOnMap !== false`) dell'evento. 404 se nessuno stand visibile. |
| POST | `/api/events/:eventId/duplicate` | auth | Duplica l'evento come base operativa per la prossima edizione: copia configurazione (moneta, tema, fasce, tagli, categorie), collega gli stand con rinumerazione progressiva, copia EventProduct e POI. NON copia wallet/ordini/transazioni/foto/contest, né le scadenze `participationFeeDeadline`/`depositDeadline`/`adhesionDeadline` (nuova edizione → null). Body opzionale `{ name, startDate, endDate, isPublic }` (default: nome+" (copia)", date +1 anno). |

### API routes — Alias
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/aliases?entityType=&entityRef=` | auth | Lista alias filtrata per entità |
| POST | `/api/aliases` | auth | Crea alias (text, entityType, entityRef) |
| PATCH | `/api/aliases/:aliasId` | auth | Modifica alias |
| DELETE | `/api/aliases/:aliasId` | auth | Elimina alias |
| GET | `/api/resolve/:entityType/:alias` | no | Risolve alias → entityId |

### API routes — Photos
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/events/:eventId/photos` | no | Lista media evento (foto e video) |
| POST | `/api/events/:eventId/photos` | no (immagini) / auth (video) | Carica media: multipart con campo `image` (foto, 10 MB, anche anonimo) oppure `video` (fino a 100 MB, richiede auth — anonimo → 401) |
| POST | `/api/events/:eventId/photos/send-email` | photo-print / photo-admin / platform-admin | Invia più foto selezionate a un unico indirizzo email (body: `email`, `photoIds[]`, `marketingConsent`) |
| POST | `/api/events/:eventId/photos/:photoId/send-email` | photo-print / photo-admin / platform-admin | Invia una singola foto via email (body: `email`, `marketingConsent`) |
| DELETE | `/api/events/:eventId/photos` | photo-admin | Cancella tutte le foto/video (delete Cloudinary con `resource_type` corretto) |
| DELETE | `/api/events/:eventId/photos/:photoId` | auth | Cancella singola foto/video |

### API routes — Frames
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/events/:eventId/frames` | no | Lista cornici evento |
| POST | `/api/events/:eventId/frames` | photo-admin | Carica cornice (multipart image + name) |
| DELETE | `/api/events/:eventId/frames/:frameId` | photo-admin | Elimina cornice |

### API routes — Pubblicazione social
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/photos/mine` | auth | Foto scattate dall'utente autenticato, raggruppate per evento (max 30 per evento, thumbnail generate server-side) |
| GET | `/api/events/:eventId/social/config` | photo-admin / platform-admin | Piattaforme configurate (`{ facebook, instagram }`) |
| POST | `/api/events/:eventId/social/posts` | photo-admin / platform-admin | Accoda pubblicazione: body `{ photoIds[], platforms[], caption? }`. Solo immagini (video → 400); foto di altro evento → 404; piattaforma non configurata → post con `status: 'failed'` immediato |
| GET | `/api/events/:eventId/social/posts?ids=a,b` | photo-admin / platform-admin | Stato dei post social (polling esito) |

Pubblicazione Meta: account UNICO della piattaforma via env opzionali `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`, `META_IG_USER_ID` (Facebook Page + Instagram professional, variante Facebook Login su graph.facebook.com). Coda in-process con worker `setInterval` avviato da `server.ts`; retry max 3 con backoff. Se le env non sono impostate la feature resta silenziosamente disattivata.

### API routes — Recensioni
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/events/:eventId/reviews` | no | Lista recensioni pubbliche (`standId` opzionale) |
| GET | `/api/events/:eventId/reviews/summary` | no | Media evento + per-stand |
| GET | `/api/events/:eventId/reviews/qrcode?standId=` | no | QR data URL della pagina recensione (evento o stand) |
| GET | `/api/events/:eventId/reviews/mine` | optional auth (o `x-access-token` guest) | Mie recensioni |
| POST | `/api/events/:eventId/reviews` | optional auth | Crea recensione. Gate: utente registrato deve aver un **ordine non cancellato** per evento/stand (403 altrimenti); anonimo richiede `reviewerName`, riceve guest token (salvato sha256 come `guestTokenHash`) rimandato come header `x-access-token`; secondo tentativo stesso target → 409. UX unica per target (indice unico parziale su `userId`/`guestTokenHash`) |
| GET | `/api/events/:eventId/reviews/manage` | event-admin / platform-admin | Lista admin con filtro stand/stato, paginata |
| GET | `/api/events/:eventId/reviews/qrcodes/all` | event-admin / platform-admin | QR data URL delle pagine recensione di **TUTTI** gli stand dell'evento, ordinati per numero stand (`{ items: [{ standId, standName, number, url, qrCode }] }`) |
| PATCH | `/api/events/:eventId/reviews/:reviewId` | event-admin / platform-admin | Nasconde/mostra recensione (`status: hidden|visible`) |
| DELETE | `/api/events/:eventId/reviews/:reviewId` | event-admin / platform-admin | Elimina recensione |

Nota: modello `Review` — `standId` null = recensione evento; moderazione **post-hoc** (visibili subito, nascondibili). Guardia route admin: `reviewsRouter.use(authMiddleware)` + `hasRole(['event-admin','platform-admin'])` — la registrazione `GET /qrcodes/all` è PRIMA di `/:reviewId` (il segmento `all` non deve finire nel param).

### API routes — Blog
Router montato in `app.ts` su `/api/blog` (`blog.routes.ts`). **Trasversale**: i post NON sono legati a un evento, ma ogni post può collegarsi a un `Event` (facoltativo) e a una `BlogCategory` (facoltativa).

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/blog` | no | Elenco paginato pubblicati (`page`/`limit`/`category`/`eventId`) |
| GET | `/api/blog/home` | no | Aside home: **tutte le pinnate** (dalla più recente pin) **+ le ultime 5 pubblicate**, deduplicato per `_id` |
| GET | `/api/blog/categories` | no | Elenco categorie pubblicate |
| GET | `/api/blog/:slug` | no | Dettaglio pubblicato (incrementa `viewCount`); 404 se draft |
| GET | `/api/blog/:slug/comments` | no | Commenti `status: 'visible'` |
| POST | `/api/blog/:slug/comments` | auth | Crea commento (solo registrati, max 2000, 1 per utente/post → 409) |
| GET | `/api/blog/manage/posts` | writer / blog-admin / platform-admin | Lista gestione (**senza `contentHtml`**, include i draft) con filtri stato/pin/categoria/evento |
| POST | `/api/blog/manage/posts` | writer / blog-admin / platform-admin | Crea notizia (nuova = `draft`; `isPinned` nel body è **ignorato**, la notizia nasce sempre non pinnata) |
| GET | `/api/blog/manage/posts/:postId` | writer / blog-admin / platform-admin | Dettaglio per l'editor (include il corpo sanificato, anche dei draft) |
| PATCH | `/api/blog/manage/posts/:postId` | writer / blog-admin / platform-admin | Modifica; `isPinned` solo blog-admin/platform-admin |
| DELETE | `/api/blog/manage/posts/:postId` | blog-admin / platform-admin | Elimina (anche i commenti) |
| GET/POST | `/api/blog/manage/categories` | GET: writer+ / POST: blog-admin | Elenco / creazione categoria |
| PATCH/DELETE | `/api/blog/manage/categories/:categoryId` | blog-admin / platform-admin | Modifica / elimina (i post restano, `categoryId` → null) |
| GET | `/api/blog/manage/comments` | blog-admin / platform-admin | Tutti i commenti con filtro stato |
| PATCH/DELETE | `/api/blog/manage/comments/:commentId` | blog-admin / platform-admin | Nasconda (`hidden`) / elimina |

**Gotcha blog**:
- **Ruoli** (scope `platform`, in `roles-populate.ts`): `writer` = `blog:read|create|update`; `blog-admin` = anche `delete`, `categories`, `comments`. Nuovi ruoli → **ri-eseguire `npm run populate:database`** in produzione, poi assegnarli da `UserRolesPage`.
- **Ordine delle route**: `GET /:slug` e `POST /:slug/comments` sono registrati **PRIMA** di `/manage/*`; `/manage` come slug inesistente darebbe solo un 404 innocuo, ma **mai** registrare `/manage/:x` dopo `/:slug/comments`.
- **XSS**: il body passa sempre da `sanitizeBlogHtml()` in scrittura **e in lettura** (forza `target="_blank"` + `rel="noopener noreferrer nofollow"` su ogni `<a>`). Non fidarsi mai del `contentHtml` salvato: i record scritti prima della regola o modificati fuori dall'app possono avere link senza `target`.
- `GET /api/blog/home` deduplica per `_id`: una pinnata fra le ultime 5 non aggiunge un elemento. Il frontend (`BlogNewsAside`) **non ri-ordina** e non renderizza nulla se la lista è vuota (niente box vuoto in home).
- `RichEditor` ha la prop opzionale `imageUploadType`: con la prop il pulsante immagine carica su Cloudinary (`type=blog` → cartella `blog`), senza resta il prompt URL. Non rimuovere la prop senza aggiornare i call site (`BlogPostEditPage` la passa, `EventsPage`/`AdhesionFormManagePage` no).
- `useBlogRoleAccess` (`features/blog/use-blog-role.ts`) è solo un gate **UI** con gli stessi slug/scope del guard API e fallisce chiuso: la protezione reale è `hasRole` lato backend.

### Frontend — Blog routes
| Route | Element | Description |
|---|---|---|
| `/blog` | BlogListPage | Elenco pubblico con filtro categoria |
| `/blog/:slug` | BlogPostPage | Notizia + commenti (richiede login per commentare) |
| `/admin/blog` | BlogManagePage | Gestione notizie + moderazione commenti |
| `/admin/blog/categories` | BlogCategoriesPage | CRUD categorie (solo blog-admin) |
| `/admin/blog/new` | BlogPostEditPage | Nuova notizia |
| `/admin/blog/:postId/edit` | BlogPostEditPage | Modifica (anche bozze, via `GET /manage/posts/:postId`) |

Nota: la sidebar admin (`AdminSidebar`) mostra la sezione «Contenuti» → «Notizie» (e «Categorie blog» solo per `blog-admin/platform-admin`) **senza bisogno di evento selezionato**: il blog è trasversale, quindi niente dipendenza da `selectedEventId`. La PWA clienti (`customer-router`) **non** monta le rotte blog e `PublicLayout` non ha una voce di menu per il blog: è raggiungibile solo dal sito operatore.

### Frontend — Alias routes
| Route | Element | Description |
|---|---|---|
| `/show/:entityType/:alias` | AliasRedirectPage | Redirect verso pagina reale |
| `/attiva/:token` | ActivationPage | Attivazione account su invito: imposta password, attiva utente |

### Frontend — Recensioni
| Route | Element | Description |
|---|---|---|
| `/events/:eventId/review` | EventReviewPage | Recensione evento (pubblica, form con stelle + lista, guardia "acquisto verificato") |
| `/events/:eventId/stands/:standId/review` | StandReviewPage | Recensione stand (pubblica) |
| `/admin/events/:eventId/reviews` | ReviewsManagePage | Moderazione recensioni (filtro stand/stato, paginazione, QR evento e stand) |
| `/admin/events/:eventId/reviews/qrcodes` | ReviewsQrCodesPage | QR recensioni di TUTTI gli stand in un'unica pagina stampabile (`window.print`, `@media print` = griglia 3 colonne, toolbar nascosta) |

### Frontend — Gallery route
| Route | Element | Description |
|---|---|---|
| `/events/:eventId/galleria` | EventGalleryPage | Galleria foto con stampa, selezione, invio email e pubblicazione social |
| `/events/:eventId/slideshow` | SlideshowPage | Slideshow automatico con rotazione e cornici |
| `/events/:eventId/menu` | EventMenuPage | Menù pubblico dell'evento: vista per stand o per categorie, ordine alfabetico |

### Frontend — Stand display route
| Route | Element | Description |
|---|---|---|
| `/events/:eventId/stands/:standId/ordersqueue` | StandDisplayPage | Coda Ordini: display fullscreen pubblico ordini in lavorazione (auto-refresh 5s) |

### Frontend — Adesione stand
| Route | Element | Description |
|---|---|---|
| `/events/:eventId/stand-adhesion` | StandAdhesionWizardPage | Wizard adesione PUBBLICO (anche anonimo, solo stand nuovi; gate regolamento, ripresa via access token in localStorage) |
| `/admin/events/:eventId/stand-adhesion` | StandAdhesionWizardPage | Stesso wizard sotto AdminLayout (admin evento / owner stand) |
| `/admin/events/:eventId/adhesions` | AdhesionsManagePage | Gestione/approvazione adesioni (solo event-admin; platform-admin escluso) |
| `/admin/events/:eventId/adhesion-form` | AdhesionFormManagePage | Modulo di adesione generato dall'evento (stampa/gestione) |
| `/events/:eventId/adhesion-form` | AdhesionFormPublicPage | Modulo di adesione stampabile pubblico |

### Frontend — Exchange route
| Route | Element | Description |
|---|---|---|
| `/events/:eventId/exchange` | EventExchangePage | Cambio valuta (crediti), solo exchange-admin / platform-admin. Ogni postazione apre/chiude la propria cassa (id in `localStorage sfe_cash_register_<eventId>`); senza cassa aperta top-up/refund/fondo/movimenti sono bloccati. **Ordine delle sezioni** (flusso operativo): ① `Contenuto cassa` = totali + card "Apri cassa" se non c'è cassa attiva → ② `Richieste alla master e impostazioni cassa` = le due sezioni collassabili (richiesta + soglie, fondo + movimento), entrambe con guardia `activeCassa && cassaBalance` → ③ `Operazioni verso i clienti` = selezione cliente + saldo, banner "nessuna cassa aperta", griglia Carica/Rimborsa → ④ `Movimenti di cassa` (tabella + paginazione) → ⑤ `Storico transazioni`. **Richieste manuali mono-valuta**: la select `Valuta` + un solo campo importo (mai `both`); il frontend tipizza `'euro' \| 'credits'` e i record legacy `both` sono trattati da `kindAlreadyOpen` come bloccanti per entrambe le valute. **Rimborso in euro**: il campo mostra `Importo €`, converte in token (`euro * rate`) solo per l'API (che valida il saldo in token), max `selUserBalance / (rateSafe)`; i richiami automatici per soglia restano senza importo |
| `/events/:eventId/cash-registers` | CashRegistersPage | **Master Cambio**: resoconto di TUTTE le casse (fondo/contenuto € e crediti, conteggio transazioni da `datetime-local` Da/, auto-refresh 5s, stampa), solo exchange-admin / platform-admin |
| `/events/:eventId/settlements` | StandSettlementsPage | Liquidazione stand (crediti → euro con percentuale trattenuta), solo exchange-admin / platform-admin |
| `/events/:eventId/settlements/report` | SettlementsReportPage | Resoconto liquidazioni aggregato per evento (stampa + filtro date), solo exchange-admin / platform-admin |

### Frontend — Contest routes
| Route | Element | Description |
|---|---|---|
| `/admin/events/:eventId/contest-manage` | EventContestManagePage | Gestione contest (POI contest, contest, avvio/stop, stampa QR), solo contest-admin / platform-admin |
| Richieste API gestite da `EventDetailPage.tsx` nelle sezioni Contest POI, poi create/edit contest | | |

### API routes — Orders
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/orders/stand/:standId/ordersqueue` | no | Coda Ordini: ordini confirmed/preparing/ready (minimi dati, niente prezzi/clienti) |
| GET | `/api/orders/gift-stats?eventId=&standId=` | auth | Contatore omaggi per stand/evento (totalOrders, giftOrders, giftPercentage, giftThreshold=5, thresholdExceeded). Conta solo ordini non cancellati. Registrata PRIMA di `/:orderId` |
| POST | `/api/orders/event/:eventId/reset` | platform-admin | Reset completo evento: elimina ordini, TUTTE le transazioni (acquisti + cambio), liquidazioni stand, azzera saldi portafogli, contatori e `cashRegisterResetAt`. In transazione. |

### API routes — Reports
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/orders/report/stand/:standId` | auth | Report per singolo stand (stand owner) |
| GET | `/orders/report/event/:eventId` | auth | Report evento aggregato per-stand (event-admin/event-cashier) |

### API routes — Stima visitatori
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/events/:eventId/visitors` | event-admin / event-cashier / platform-admin | Stima visitatori: per stand = quantità vendute × coefficiente per categoria di prodotto (tabella fissa in codice, default 1); per evento = token netti venduti (top-up − refund) ÷ spesa media per ordine osservata (fallback 10). Query: `from`/`to` (default finestra evento; `to` date-only → fine giornata), `standId`, `stationId`. Omaggi (`isGift`) e ordini cancellati esclusi dalle quantità. |

### API routes — Cambio valuta
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/exchange/:eventId/users` | exchange-admin / platform-admin | Lista utenti cambio (auto-crea il generico se mancante; espone `isGeneric` = anonimo **senza** `displayName`) |
| GET | `/api/exchange/:eventId/users/:eventUserId/balance` | exchange-admin / platform-admin | Saldo di un singolo wallet (`{ id, balance }`): endpoint **leggero** per il polling della postazione, che interroga solo il cliente generico (400 id non valido, 404 di un altro evento) |
| GET | `/api/exchange/:eventId/balance` | exchange-admin / platform-admin | Saldo cassa (top-up/refund aggregati + fondo cassa e contenuto euro/token) |
| GET | `/api/exchange/:eventId/transactions` | exchange-admin / platform-admin | Storico transazioni (paginato) |
| GET | `/api/exchange/:eventId/cash-registers` | exchange-admin / platform-admin | Lista casse evento (con operatore di apertura) |
| POST | `/api/exchange/:eventId/cash-registers` | exchange-admin / platform-admin | Apre cassa (auto-nome `Cassa N`). 409 `code:'name_taken'` se ne esiste già una aperta; con `{ force: true, cashRegisterToClose }` chiude l'altra e riapre qui |
| GET | `/api/exchange/:eventId/cash-registers/report` | exchange-admin / platform-admin | Master Cambio: resoconto TUTTE le casse (fondo €/crediti, contenuto, conteggio top-up/refund), filtro `from`/`to` su `occurredAt` (default `from` = `event.startDate`), totali. Registrata PRIMA di `/:cashRegisterId` |
| GET | `/api/exchange/:eventId/cash-registers/:cashRegisterId/balance` | exchange-admin / platform-admin | Balance di una singola cassa (fondi + contenuto + `topUpReal`/`refundReal` + conteggi since) |
| PATCH | `/api/exchange/:eventId/cash-registers/:cashRegisterId` | exchange-admin / platform-admin | Rinomina e/o soglie di sicurezza (`name` e `lowThreshold { euro, credits }` indipendenti; entrambe le soglie `null` azzerano il sottodocumento; `null` = soglia disattivata; 409 `name_taken` invariato) |
| POST | `/api/exchange/:eventId/cash-registers/:cashRegisterId/close` | exchange-admin / platform-admin | Chiude cassa (404/400 se già chiusa) |
| POST | `/api/exchange/:eventId/cash-registers/close-all` | exchange-admin / platform-admin | Chiude **tutte** le casse `open` dell'evento (`updateMany`), risponde `{ closedRegisters }`, idempotente. Registrata PRIMA di `/:cashRegisterId` |
| GET | `/api/exchange/:eventId/cash-requests` | exchange-admin / platform-admin | Richieste delle postazioni alla master (filtri `status` csv, `cashRegisterId`, `from`/`to` su `requestedAt`, `limit`; `pendingCount` = pending+acknowledged) |
| POST | `/api/exchange/:eventId/cash-requests` | exchange-admin / platform-admin | Crea richiesta (cassa `open` obbligatoria; importi mai misti; **idempotente**: stessa cassa + stesso `kind` in `pending|acknowledged|delivered` → `200 { duplicate: true }`) |
| PATCH | `/api/exchange/:eventId/cash-requests/:requestId` | exchange-admin / platform-admin | `acknowledged` (solo da pending) / `delivered` (implica l'ack, registra i movimenti `in` nella cassa ricevente) / `confirmed` (da acknowledged|delivered, implica l'ack) / `cancelled`; `delivered`, `confirmed` e `cancelled` sono immutabili |
| POST | `/api/exchange/:eventId/top-up` | exchange-admin / platform-admin | Carica crediti (reale → virtuale). Con `cashRegisterId` nel body la transazione è attribuita alla cassa (400 se chiusa/non appartenente) |
| POST | `/api/exchange/:eventId/refund` | exchange-admin / platform-admin | Rimborsa crediti (virtuale → reale). Con `cashRegisterId` nel body la transazione è attribuita alla cassa (400 se chiusa/non appartenente). 400 se il saldo è insufficiente (prima di scrivere). Accetta `paymentMethod: 'cash'|'pos'` come `top-up` |
| GET | `/api/exchange/:eventId/settlements/summary` | exchange-admin / platform-admin | Riepilogo crediti guadagnati/liquidati per stand (informativo) |
| GET | `/api/exchange/:eventId/settlements/report` | exchange-admin / platform-admin | Resoconto aggregato liquidazioni per stand (numero, crediti, lordo/trattenuta/erogato €, residuo), filtro `from`/`to`, totali evento |
| GET | `/api/exchange/:eventId/settlements` | exchange-admin / platform-admin | Storico liquidazioni stand (paginato, filtro standId) |
| POST | `/api/exchange/:eventId/settlements` | exchange-admin / platform-admin | Crea liquidazione stand (standId, amount crediti libero, feePercent default 0) |
| POST | `/api/exchange/:eventId/guests` | exchange-admin / platform-admin | Crea cliente al volo (displayName opzionale). **Senza nome NON crea un wallet nuovo**: riusa il cliente generico dell'evento (`{ reused: true }`, 200) |
| POST | `/api/exchange/:eventId/cash-float` | exchange-admin / platform-admin | Imposta/modifica fondo cassa (euro, credits); con `cashRegisterId` scrive sul `CashRegister.cashFloat` (cassa deve essere `open`), senza → legacy `Event.cashFloat`. Il pulsante "Azzera" del Master Cambio lo riusa con `{ cashRegisterId, euro: 0, credits: 0 }` |
| GET | `/api/exchange/:eventId/cash-movements` | exchange-admin / platform-admin | Storico movimenti cassa (paginato) |
| POST | `/api/exchange/:eventId/cash-movements` | exchange-admin / platform-admin | Registra movimento carico/prelievo (currency euro/credits, direction in/out) |
| POST | `/api/exchange/:eventId/reset-cash-register` | exchange-admin / platform-admin | Azzera cassa |
| POST | `/api/exchange/:eventId/cash-registers/reset-all` | exchange-admin / platform-admin | **Azzera TUTTO** il banco cambio dell'evento: **cancella tutte le casse** (aperte e chiuse, con fondi e storico), cancella transazioni/movimenti/richieste/PromotionUsage e porta a 0 tutti i portafogli utente. Risposta `deletedRegisters`. Ordini e liquidazioni stand NON toccati |
| GET | `/api/exchange/:eventId/cash-register-reset` | exchange-admin / platform-admin | Data ultimo azzeramento |

### API routes — Contest POI
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/contests/contest-pois?eventId=` | contest-admin / platform-admin | Lista POI contest |
| POST | `/api/contests/contest-pois` | contest-admin / platform-admin | Crea POI contest (name, hints[], groups[], standId opzionale — stand dell'evento come POI) |
| PATCH | `/api/contests/contest-pois/:poiId` | contest-admin / platform-admin | Modifica POI contest (standId: null per scollegare) |
| DELETE | `/api/contests/contest-pois/:poiId` | contest-admin / platform-admin | Elimina POI contest |

### API routes — Contests
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/contests?eventId=` | no | Lista contest pubblici |
| GET | `/api/contests/:contestId` | no | Dettaglio contest + POI |
| POST | `/api/contests/` | contest-admin / platform-admin | Crea contest (con pickConfig per auto-pick gruppi) |
| PATCH | `/api/contests/:contestId` | contest-admin / platform-admin | Modifica contest |
| DELETE | `/api/contests/:contestId` | contest-admin / platform-admin | Elimina contest |
| POST | `/api/contests/:contestId/scan` | no | Registra scansione POI |
| POST | `/api/contests/:contestId/complete` | no | Completa partecipazione (premia, classifica) |
| GET | `/api/contests/:contestId/participation/:participantId` | no | Stato partecipazione |
| PATCH | `/api/contests/:contestId/participation/:participantId/award` | contest-admin / platform-admin | Consegna premio |
| GET | `/api/contests/:contestId/poi-qrcodes` | contest-admin / platform-admin | QR code per ogni POI del contest |

### API routes — Adesione stand (wizard elettronico)
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/events/:eventId/adhesions` | auth | Lista adesioni (admin vede tutto; gli altri solo le proprie: stands possesso o `userId`) |
| POST | `/api/events/:eventId/adhesions` | optional auth | Crea adesione. **Gate**: 400 se l'evento non ha `regulationDocument` o se `Event.adhesionDeadline` è passata ("Il termine per la presentazione delle adesioni è scaduto."). Anonimo SOLO per stand nuovo (senza `standId`); con `standId` → admin/owner. Response include `accessToken` (da conservare e inviare come header `x-access-token`) — nel DB solo `accessTokenHash` sha256 |
| GET | `/api/events/:eventId/adhesions/mine` | optional auth | Adesione dell'utente (o via `x-access-token`) → `{ item }` o `{ item: null }` |
| GET | `/api/events/:eventId/adhesions/:adhesionId` | optional auth | Dettaglio (admin/owner/utente/token; altrimenti 404) |
| PATCH | `/api/events/:eventId/adhesions/:adhesionId` | optional auth | Modifica bozza (409 se approved; `submitted` → `draft`). 400 se `adhesionDeadline` passata |
| POST | `/api/events/:eventId/adhesions/:adhesionId/submit` | optional auth | Invia per approvazione (400 con campi mancanti o se `adhesionDeadline` passata; per i nuovi stand crea/riusa utente inattivo con invito email; response `activationUrl`/`emailSent`) |
| POST | `/api/events/:eventId/adhesions/:adhesionId/withdraw` | optional auth | Ritira da `submitted` → `draft` |
| POST | `/api/events/:eventId/adhesions/:adhesionId/approve` | event-admin | Approva. Se l'adesione non ha `standId` CREA lo `Stand` (numero progressivo + ruoli/logo) e assegna `stand-admin` all'utente. **platform-admin ESCLUSO** (`hasRole` matcha per slug) |
| POST | `/api/events/:eventId/adhesions/:adhesionId/reject` | event-admin | Rifiuta con `{ reviewNote }` |
| POST | `/api/events/:eventId/adhesions/:adhesionId/integration` | event-admin | Richiede integrazioni → stato `integration` ("Da integrare"), `reviewNote` obbligatoria |

### API routes — Advertisement
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/advertisements` | no | Lista advertisement ABILITATI (per lo slideshow); trasversali, non legati a un evento |
| GET | `/api/advertisements/manage` | platform-admin / photo-admin | Lista completa (abilitati e disabilitati) |
| POST | `/api/advertisements` | platform-admin / photo-admin | Crea advertisement (multipart `image` + `name` opzionale + `weight` default 1) |
| POST | `/api/advertisements/reset-appearances` | platform-admin / photo-admin | Azzera i contatori `appearances` di tutti gli advertisement |
| POST | `/api/advertisements/:advertisementId/appearance` | no | Incrementa `appearances` ($inc) — chiamato dalla slideshow ogni volta che mostra l'advertisement |
| PATCH | `/api/advertisements/:advertisementId` | platform-admin / photo-admin | Attiva/disattiva (`enabled`), aggiorna `name` o `weight` |
| DELETE | `/api/advertisements/:advertisementId` | platform-admin / photo-admin | Elimina (rimuove asset da Cloudinary) |

Nota: `weight` (min 1) guida la **selezione casuale ponderata** nel pannello slideshow — piú alto = piú spesso mostrato. Il campo `appearances` (default 0) è il totale persistito di apparizioni, incrementato lato server a ogni display; il totale è mostrato in admin accanto alla thumbnail e azzerabile dal pulsante "Azzera contatori apparizioni". La schermata slideshow ha in testata titolo editabile + sottotitolo (nome evento) + aggiorna + velocità; il pannello Advertisement aperto NON ha titolo né contatore (solo × per chiudere). `useKeepAlive` (ping anti-idle ogni 9 min) è montato SOLO su `SlideshowPage` (era sulle pagine cassa, tolto da lì a Set 2026).

### API routes — Email Subscriptions
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/email-subscriptions` | no | Subscribe (crea/aggiorna consenso per email) |
| POST | `/api/email-subscriptions/unsubscribe` | no | Disiscrizione by email |
| GET | `/api/email-subscriptions` | platform-admin | Lista iscrizioni (paginata, filtrabile per eventId/isActive/search) |
| DELETE | `/api/email-subscriptions/:id` | platform-admin | Cancella iscrizione |

### API routes — Promozioni e Coupon
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/events/:eventId/promotions` | event-admin / platform-admin | Lista coupon dell'evento (QR inline incluso) |
| POST | `/api/events/:eventId/promotions` | event-admin / platform-admin | Crea coupon (code, type discount/product/value, formula, maxPresentations, perUserLimit, expiresAt, standId) |
| PATCH | `/api/events/:eventId/promotions/:promotionId` | event-admin / platform-admin | Modifica coupon (o `isActive` per attiva/disattiva) |
| DELETE | `/api/events/:eventId/promotions/:promotionId` | event-admin / platform-admin | Elimina coupon (400 se già usato: disattivare per conservare lo storico) |
| GET | `/api/events/:eventId/promotions/:promotionId/qrcode` | event-admin / platform-admin | QR del codice coupon (data URL) |
| GET | `/api/events/:eventId/promotions/:promotionId/usage` | event-admin / platform-admin | Storico utilizzi (max 200) |
| POST | `/api/events/:eventId/promotions/validate` | auth | Valida un codice: `{ valid, item }` o `{ valid:false, message }` |
| POST | `/api/events/:eventId/promotions/redeem-value` | auth (cassa) | Riscatta buono valore accreditando crediti al cliente (body `{ code, eventUserId }`) |

Tipi coupon: `discount` (sconto `%` o `fixed` in crediti), `product` (prodotto in omaggio / formula `formula {paid,total}` con `formulaMaxFree`), `value` (buono valore al riscatto). **Gli sconti percentuali NON si applicano ai pagamenti in crediti** (blocco server+client). Nella cassa: componente `CouponPanel` (input + scan QR) su `CashierOrderPage`/`EventCashierPage`; gestione in `/admin/events/:eventId/promotions`. Report: `coupons` per promozione + `discountAmount` nei totali. Gotcha: router nidificato usa `Router({ mergeParams: true })`; filtri campo-vs-campo numerici con `$expr`.

## Frontend (`frontend/`)

React 19 + Vite 8 + TypeScript ~6.0 + SCSS Modules + React Router 7.

### Commands

| Command | What |
|---|---|
| `npm run dev` | `vite` (:5173) |
| `npm run build` | `tsc -b && vite build` |
| `npm run lint` | `eslint .` |
| `npm run test` | `vitest run` (16 tests) |

### Gotchas
- Vite proxy: `/api` → `http://127.0.0.1:4000`.
- No `@/*` alias — imports are relative.
- SCSS: `@use` for tokens, not `@import`.
- Build runs typecheck first (`tsc -b`).
- Auth: `AuthContext` + `apiRequest` with `credentials: 'include'`.
- Routing: `createBrowserRouter` in `src/router.tsx`.
- Evento admin: `AdminEventContext` esposto da `AdminLayout` fornisce `selectedEventId`/`selectedEvent`/`events` a sidebar e pagine — MAI aggiungere una combo evento locale in una pagina admin (la selezione vive solo nella sidebar "Evento attivo"; cambia evento → sempre `/admin/dashboard`). Dettagli in ARCHITECTURE.md.

## Render deploy

`render.yaml` configura due servizi web (backend + frontend), piano free, regione Frankfurt.

### Files esclusi dal deploy
Modifiche ai file in `docs/` non attivano un deploy. Imposta su Render dashboard per ogni servizio:
**Settings → Build Filters → Ignored Paths**: `docs/**`

## Session state (Set 2026 — liquidazione: fee solo da Event.feeBands + sovrascrittura)
### Completed
- **Fee solo dall'evento, fee per stand eliminati**: `Stand.numbers[].feePercent`/`feeFlat` **rimossi** dal modello, il body `eventFees` non è più accettato da `POST /stands`/`PATCH /stands/:id`, `toStandResponse` non li espone, `duplicateEvent` non li copia, e il fieldset "Commissioni per evento" è sparito da `StandsPage`. Motivo: gestire fasce diverse per stand per evento era troppo complesso.
- **`resolveSettlementFee` legge solo `Event.feeBands`**: fascia scelta sugli euro **lordi di quella singola liquidazione** (prima col tetto che copre, altrimenti residuale `maxAmount <= 0`), `feeFlat` somma alla percentuale, `feeEuro = min(lordo, lordo% + quota)`.
- **Sovrascrittura in liquidazione**: se il client manda `feePercent`/`feeFlat` valgono **così come sono, anche 0** (`feeSource: 'custom'`). In `StandSettlementsPage` i due input sono "Sovrascrivi percentuale/quota fissa", con bottone "Torna alla fascia dell'evento" e una riga che dice sempre cosa verrà applicato. **GOTCHA**: i campi viaggiano **omessi** finché l'operatore non li tocca (`feeTouched`) — inviarli sempre come 0 faceva vincere il client e la fascia non entrava mai.
- Verifica: backend typecheck ✓, suite completa **534 test ✓** (51 file), lint 0 errori; frontend typecheck ✓, **96 test vitest ✓** (15 file), lint 0 errori, build ✓. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — TODO chiuso: fee in liquidazione, hasRole, UI)
### Completed
- **Il fee configurato non entrava in liquidazione** (chiuso il punto 1 del TODO): `POST /exchange/:eventId/settlements` copiava `feePercent` dal body e validava **solo il range 0-100**; `Event.feeBands` e `Stand.numbers[].feePercent` non erano mai letti dal backend. La derivazione esisteva **solo nel frontend** (`StandSettlementsPage` `resolveFee`), e solo come suggerimento **precompilato se l'evento aveva i tagli** (`:174 if (isEuro || !hasDenoms || !isCredit || denomTotalCredits <= 0) return`). Quindi ogni liquidazione senza tagli (e ogni chiamata API senza `feePercent`) tratteneva **zero**. Ora `resolveSettlementFee()` in `exchange.controller.ts`: priorità all'override dello stand per quell'evento, altrimenti le fasce dell'evento scelte sul **lordo di quella singola liquidazione** (prima col tetto che copre, altrimenti residuale `maxAmount <= 0`); se il client non manda `feePercent`/`feeFlat` si usa il valore risolto, se li manda vince il client. **`feeFlat` implementata** (`feeEuro = min(lordo, lordo% + quota)`), nuovi campi `StandSettlement.feeFlat` e `feeSource` (`stand|band|none`). Fee solo su AVERE+crediti (DARE e `unit:'euro'` a zero). Test: +4 in `integration-settlements.test.ts`.
- **`hasRole` rifatto** (chiuso il punto 2 del TODO, `backend/src/middlewares/role.middleware.ts`): i due scope erano due chiavi `$or` **nello stesso oggetto** → la seconda sovrascriveva la prima e su una route con **entrambi** i parametri lo scope evento non era verificato (nessuna route attuale affetta, guard rotto). Ora ogni scope in un `$or` diverso dentro un `$and`. Test cross-event nuovo `src/__tests__/middlewares/role.middleware.test.ts` (8 casi, verificato **non verde a vuoto**: ripristinando le due chiavi `$or` ne falliscono 2).
- **Pulsante "indietro" unificato**: esistevano **16 definizioni `.backLink` in 14 file** (6 mai usate) + `.backBtn`/`.heroBack`/`.homeLink`/`.exBackLink`, 6 gruppi di colori e margini mancanti (il bottone restava attaccato a ciò che segue). Ora **una classe globale `.back-link`** in `global.scss` (+ `--bare`, `--inline`, `--bottom`, `--onDark`), migrati i **34 elementi di 25 pagine**, cancellate tutte le definizioni locali, `padding-top` aggiunto dove mancava (`PrintableDocument`, `PoiDetailPage`), e `.back-link` nascosto in stampa. **GOTCHA**: non creare più una `.backLink` nel module.scss di una pagina.
- **StandsPage filtrata per evento attivo** (`useAdminEvent()` + `GET /stands?eventId=`), con nota sotto il titolo ed empty state dedicato.
- **Toggle tracking rimosso dalla sidebar admin** (props eliminate da `AdminSidebar`; restano il toggle in `AdminTopBar` e il mount di `OrderTrackingModal`).
- **Blog**: copertina a **1/3 della larghezza, `float: left`** con testo che le scorre attorno (clearfix dopo il corpo, sotto 40rem tutta larghezza) e **miniatura 44×44 nell'aside "Notizie" della home**.
- Verifica: backend typecheck ✓, suite completa **533 test ✓** (51 file, +14), lint 0 errori; frontend typecheck ✓, **96 test vitest ✓** (15 file), lint 0 errori (11 warning `exhaustive-deps` pre-esistenti), build (tsc+vite) ✓. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — saldo sempre aggiornato, wallet unico "Non collegato a clienti")
### Completed
- **Il saldo NON è per cassa**: `EventUser.balance` è **un documento per (evento, cliente)** (`services/event-user-transactions.service.ts` scrive il saldo sul wallet; `cashRegisterId` è solo un campo di audit sulla transazione) → un rimborso da Cassa 2 usa i token caricati su Cassa 1. Il bug era che **la pagina non rileggeva mai `users`**: il polling dei 5s chiudeva solo `fetchCassaBalance()`/`fetchMyRequests()`, quindi il saldo era lo snapshot del caricamento e una cassa bloccava un rimborso appena abilitato dall'altra.
- **Polling solo del cliente generico**: ripollare `GET /exchange/:eventId/users` ogni 5s è caro (no paginazione, `populate`, `sort` su tutti i wallet) → nuovo endpoint leggero **`GET /api/exchange/:eventId/users/:eventUserId/balance`** (`{ id, balance }`, un documento, 400 id non valido, 404 di un altro evento). Il frontend lo interroga **solo per il cliente generico** (`fetchGenericBalance`, `genericBalance`); `targetBalance` e le etichette della select usano `balanceOf(u)` che preferisce la rilettura live. **GOTCHA**: la lista clienti NON va ripollata — si ricarica solo all'apertura e dopo ogni operazione locale (estratta in `fetchUsers`).
- **Un solo wallet anonimo condiviso**: `POST /exchange/:eventId/guests` **senza nome riusa** il cliente generico (`{ reused: true }`, 200) invece di creare un `EventUser` — prima ogni "+ Crea" a vuoto creava un **secondo wallet anonimo con saldo 0** e `users.find(isAnonymous)` poteva risolvere su quello → "Saldo: 0.00" e rimborso bloccato. `GET /users` espone **`isGeneric`** (anonimo **senza** `displayName`, distinto dagli ospiti con nome) e il frontend usa `users.find(isGeneric) ?? users.find(isAnonymous)`.
- **UI**: "Cliente generico" è di nuovo la **selezione di default** (il trattino `—` resta scorciatoia verso lo stesso wallet) e in UI si chiama **"Non collegato a clienti"** (select + riga del saldo).
- Verifica: backend typecheck ✓, suite completa **521 test ✓** (50 file, +1 su generico unico / endpoint saldo), lint 0 errori; frontend typecheck ✓, **96 test vitest ✓** (15 file), lint 0 errori, build (tsc+vite) ✓. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — cliente non obbligatorio, Chiudi tutte, cassa chiusa in sola lettura)
### Completed
- **Cliente non più obbligatorio nelle operazioni di cambio**: la select di `EventExchangePage` mostra `-- Seleziona --` non più ma un **trattino `—`** = **cliente anonimo** (spesso le operazioni non hanno un cliente registrato). Nuovi derivati: `anonymousUser` = primo `isAnonymous` di `users`, `targetUser = selectedUser ?? anonymousUser`, `targetUserId`, `targetBalance`; `topUp`/`refund` mandano `eventUserId: targetUserId` e i `disabled` usano `!targetUserId`. **GOTCHA**: lo stato `selUserBalance` è stato **eliminato**: il saldo viene letto da `users[].balance` (unica fonte di verità, si aggiorna da sola perché ogni operazione richiama `fetchData()`). L'auto-select del "Cliente Generico" **non forza più l'id** — resta il trattino come default e pulisce solo la selezione se il cliente non esiste più. I pulsanti restano disabilitati solo senza cassa attiva o senza wallet anonimo.
- **`POST /api/exchange/:eventId/cash-registers/close-all`** (exchange-admin / platform-admin, **registrata PRIMA di `/:cashRegisterId`**): chiude con un `updateMany` tutte le casse `open` dell'evento, risponde `{ closedRegisters }`, **idempotente** (0 alla seconda chiamata) e scoped all'evento. Master Cambio: bottone "**Chiudi tutte (N)**" con `ConfirmModal` danger, disabilitato se `openCount === 0`; rimuove `sfe_cash_register_<eventId>` dal `localStorage` e mostra un banner verde (`.notice`, gemello di `.error`).
- **Cassa chiusa = solo rendiconti**: anche l'intera `<section>` "Richieste alla master e impostazioni cassa" è gateata su `activeCassa` (prima restava l'`<h2>` a sezione vuota). Rimaste solo la card "Apri cassa", "Movimenti di cassa" e "Storico transazioni".
- **GOTCHA `force`**: `POST /cash-registers` con `force: true` chiude l'altra cassa **solo se c'è conflitto di nome** (è il flusso 409 `name_taken`), non in generale. Per chiudere le altre serve `close-all`.
- Verifica: backend typecheck ✓, **520 test ✓** (50 file, +1 `close-all`), lint 0 errori; frontend typecheck ✓, **96 test vitest ✓** (15 file), lint 0 errori sui file toccati, build (tsc+vite) ✓. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — cassa chiusa in sola lettura, Azzera per cassa, Azzera tutto)
### Completed
- **Cassa chiusa = solo rendiconti**: in `EventExchangePage` le sezioni operative sono gateate su `activeCassa` (che è già `null` quando la cassa viene chiusa o forzata da un'altra macchina). Spariscono "Richieste alla master e impostazioni cassa" e "Operazioni verso i clienti"; restano la card **"Apri cassa"** e i due rendiconti. I **"Movimenti di cassa"** sono un report **a livello evento** (`listCashMovements` filtra solo `eventId`) → la tabella è ora **sempre** renderizzata (via il messaggio "Apri una cassa per visualizzare i movimenti", rimosso).
- **"Azzera" per singola cassa nel Master Cambio** (colonna Azioni, solo casse `open`): riusa `POST /exchange/:eventId/cash-float` con `{ cashRegisterId, euro: 0, credits: 0 }` → **nessuna modifica backend**. Azzera il **solo fondo**: movimenti/carichi/rimborsi restano, quindi il "Contenuto" torna a valere solo quanto documentato da incassi, rimborsi e movimenti (il `ConfirmModal` danger lo dice).
- **"Azzera tutto" cancella anche le casse**: `resetAllCashRegisters` usa `CashRegisterModel.deleteMany({ eventId })` invece di `updateMany` verso `closed` + fondi a zero → un evento azzerato riparte con la lista casse **vuota**. Risposta: `deletedRegisters` al posto di `closedRegisters`. Le postazioni devono riaprire una cassa (il frontend rimuove già `sfe_cash_register_<eventId>` dal `localStorage`).
- **Allineamenti UI**: bottone "Apri cassa" **in linea con l'input del nome cassa** (`.cassaOpenRow` flex); `.field` del modulo cambio ora copre **anche `select`** (oltre a `input`) → le etichette "Incasso con" / "Restituisci con" non restano più attaccate al menu. **GOTCHA**: `.field input` aveva `margin-top` ma le `select` no, quindi ogni select dentro un `.field` sembrava "incastrato" nell'etichetta.
- Verifica: backend typecheck ✓, suite completa **519 test ✓** (50 file, `integration-cash-registers.test.ts` aggiornato a `deletedRegisters === 2` + `cashregisters`/`cashrequests` vuote), lint 0 errori; frontend typecheck ✓, **96 test vitest ✓** (15 file), lint 0 errori sui file toccati, build (tsc+vite) ✓. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — richieste master mono-valuta, rimborso in euro, riordino pagina cambio)
### Completed
- **Richieste alla master solo mono-valuta**: `EventExchangePage` non offre più `both` nel form manuale — select "Valuta" + **un solo campo importo**, inviato nel campo corrispondente (`amountEuro`/`amountCredits`) con l'altro `null`. Tipo frontend `CashRequestKind` ridotto a `'euro' | 'credits'` (il backend mantiene `both` per i legacy e per `delivered`). Nuovo helper `kindAlreadyOpen(openRequests, kind)` usato sia dai due form manuali sia dall'auto-invio: **una `both` legacy aperta blocca entrambe le valute** (evita doppia consegna). **GOTCHA**: l'auto-invio per soglia NON deve allegare gli importi del form manuale — le richieste automatiche restano senza importo, la master decide.
- **Rimborso mostrato in euro**: campo `Importo €` con `max={refundMaxEuro}` (`selUserBalance / (rateSafe)`), conversione `euro * rate` solo nell'handler `handleRefund` (l'API riceve ancora token e valida il saldo in token), anteprima "≈ N token", bottone "Rimborsa tutto il saldo (€)", messaggio di superamento saldo che riporta prima l'euro. `rateSafe` = `rate || 1` per non dividere per zero (usato anche nei `max` e nelle conversioni EUR→token).
- **Riordino sezioni pagina cambio**: ① `Contenuto cassa` (totali + "Apri cassa") → ② `Richieste alla master e impostazioni cassa` (i due collapsibles, guardia `activeCassa && cassaBalance`) → ③ `Operazioni verso i clienti` (selezione cliente + saldo + banner + griglia Carica/Rimborsa: l'h2 "Seleziona utente" è stato assorbito nella stessa `<section>`) → ④ `Movimenti di cassa` (tabella + paginazione, "Apri una cassa per visualizzare i movimenti" senza cassa) → ⑤ `Storico transazioni`. La card "Apri cassa" sta ora **nella sezione totali**, non dentro le impostazioni.
- Verifica: frontend typecheck ✓, **96 test vitest ✓** (15 file), lint 0 errori su `EventExchangePage.tsx`, build (tsc+vite) ✓. Backend non toccato. Docs aggiornate (`AGENTS.md`, `docs/CHANGELOG.md`). Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — casse evento multiple + Master Cambio)
### Completed
- **Backend** — nuovo modello `CashRegister` (collezione `cashregisters`); `cashRegisterId` (nullable) aggiunto a `EventUserTransaction` e `CashRegisterMovement`. API `/api/exchange/:eventId/cash-registers` (exchange-admin / platform-admin): lista, apertura con auto-nome `Cassa N` (409 `name_taken` se ne esiste un'altra aperta; `force: true` + `cashRegisterToClose` per chiudere l'altra e riaprire qui), report (Master Cambio, `from`/`to` su `occurredAt`, default `from` = `event.startDate`, solo top-up/refund), rename, close, balance per singola cassa. Le operazioni `topUp`/`refund`/`setCashFloat`/`addCashMovement` accettano `cashRegisterId` e validano `status === 'open'` server-side (400 altrimenti); `setCashFloat` con cassa scrive su `CashRegister.cashFloat` (senza → legacy `Event.cashFloat`). `resetEventOrders` elimina anche casse + movimenti.
- **Frontend `EventExchangePage`**: apertura/chiusura cassa per postazione (id in `localStorage sfe_cash_register_<eventId>`), nome editabile con Rinomina, 409 → modale di conferma force-close, balance della cassa attiva (fondi contenuti per cassa), **blocco operazioni senza cassa aperta** (banner `.cassaLocked` + input disabilitati), ricaduta automatica se rileva cassa chiusa da altra macchina.
- **`CashRegistersPage`** ("Master Cambio", `/admin/events/:eventId/cash-registers`): tabella tutte le casse + fondo/contenuto €/crediti, conteggio transazioni con filtro `datetime-local` Da/a, riga TOTALE, auto-refresh 5s, stampa. Voce sidebar Finanziario, `SEGMENT_LABELS['cash-registers']='Master Cambio'` (la route NON matcha la regex `isExchange` di AdminLayout → chrome visibili).
- Verifica: backend typecheck ✓, **435 test ✓** (47 file, +9 in `integration-cash-registers.test.ts`), lint 0 errori; frontend build (tsc+vite) ✓, 43 test vitest ✓, lint 0 errori (13 warning pre-esistenti). Docs aggiornate. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — fix sessione: recensioni, coupon, Master Cambio)
### Completed
- **Recensioni admin con nomi reali**: `toAdminReview` accetta `context?: { eventName?, standName? }`; `getManageReviews` carica il nome evento (`.select('name')`) e una mappa dei nomi stand (`StandModel.find({ _id: { $in: standIds } }).select('name')`) → la pagina `ReviewsManagePage` non mostra più "Evento" al posto del nome né lo standId. Update di `AdminReview` in `lib/reviews.ts`.
- **Coupon verifica leggibile**: `.notice` di `CouponPanel.module.scss` ora rosso scuro (`#8f1d1d`) su sfondo rosso chiaro con bordo (prima quasi invisibile).
- **Link "Apri Cambio Valuta"**: punta a `/admin/events/${eventId}/exchange` (non esiste rotta pubblica `/events/:eventId/exchange` — verifica su `router.tsx`, riga 141 sotto AdminLayout) e apre in **nuova tab** (`target="_blank"` + `rel="noopener noreferrer"`).
- **Coupon valore/prodotto**: `redeemValue` accetta **`userId`** ALTERNATIVO a `eventUserId` — le casse usano gli id della lista `/users` (User id), NON gli EventUser id; risolve l'EventUser con `{ _id: eventUserId }` oppure `{ userId } + eventId + isActive` (404 con messaggio distinto se l'utente non è legato all'evento). `redeemValuePromotion` in `lib/promotions.ts` ha tipi corretti (`valueAmount` + `balance` + `transactionId`). `CouponPanel` ha la prop opzionale `customerUserId` (le due pagine cassa passano `selectedCustomerId`); il buono valore si riscatta inline ("Riscatta sul portafoglio del cliente selezionato", `window.confirm`, box risultato con saldo); per i coupon prodotto quando non ancora applicati mostra "Aggiungi al carrello «prodotto» per applicare l'omaggio".
- **Master Cambio — chiudi cassa**: nuona colonna "Azioni" (`styles.printHide`): per casse `open` pulsante "Chiudi" → `ConfirmModal` danger → `POST /exchange/:eventId/cash-registers/:cashRegisterId/close` → `load(true)`; errori in banner `.error`.
- **Master Cambio — stampa**: la pagina usciva bianca perché `AdminSidebar` è `position: fixed; z-index: 40; height: 100vh` e senza hide si sovrappone a ogni pagina stampata → in `global.scss` il blocco `@media print` ora nasconde anche `.admin aside` (l'unico `<aside>` dentro `.admin` è la sidebar; `AdminTopBar` è `<header>`, già coperto da `header, footer`). Colonna Azioni nascosta con `@media print { .printHide { display: none !important } }`. Gotcha in `docs/ARCHITECTURE.md` sezione Printing.
- **Master Cambio — totale**: la riga TOTALE NON mostra più il badge "Aperta" (cella Stato → "—" quando `isTotal`).
- **GOTCHAS**: `CouponPanel` è usato SOLO da `CashierOrderPage`/`EventCashierPage`; quando si tocca `CouponPanel.tsx` verificare entrambe le pagine cassa. Eventuali nuove colonne operative nelle tabella report del Master Cambio vanno marchiate `.printHide`.
- Verifica: backend typecheck ✓, **437 test ✓** (47 file, +2 in `integration-promotions.test.ts`: redeem by userId e 404 utente non legato; +assertions `eventName`/`standName` in `integration-reviews.test.ts`), lint 0 errori; frontend build (tsc+vite) ✓, 43 test vitest ✓, lint 0 errori (13 warning pre-esistenti). Docs aggiornate (`AGENTS.md`, `CHANGELOG.md`, `ARCHITECTURE.md`, `TODO.md` — sezione "Fix di questa sessione" svuotata). Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — tracking rimosso dalla cassa + pagina dedicata per lo stand)
### Completed
- **Tracking rimosso dalla cassa**: `OrderTrackingModal variant="inline"` era montato dentro l'overlay "Ordine creato" di `CashierOrderPage`/`EventCashierPage`, dove però compare già la ricevuta → rimosso il componente e il suo import da entrambe le pagine. Le broadcast `broadcastOrderCreated`/`broadcastTrackingClear` sulle casse RESTANO invariate (i modali standalone delle altre pagine/tab si chiudono comunque alla chiusura della ricevuta).
- **Pagina dedicata al tracking per stand** (`StandTrackingPage`, porta `events/:eventId/stands/:standId/tracking`): route **standalone senza layout** (niente navbar, come `ordersqueue`). **Layout finale**: **banner** (`stand.coverImage`) full-width in alto con bordo `--color-brand`; sotto **due colonne** — a sinistra il pannello identità **in verticale** (logo `logo ?? coverImage` in alto, poi **nome dello stand** e **nome della manifestazione**, centrati, `overflow-wrap: anywhere` per nomi lunghi; il **numero è OMESSO** — è già visibile nel tracking a destra), a destra il **solo tracking abilitato automaticamente** (nuova variante **`page`** di `OrderTrackingModal`, card embedded senza overlay/backdrop, nessun Escape). **Tema evento** con `useEventTheme` + CSS vars `--color-brand/brand-deep/highlight` (fallback navy, `StandTrackingPage.module.scss`). Sotto i 900px le due colonne impilano verticalmente.
- **La pagina NON mostra l'ultimo ordine all'apertura** (stesso comportamento del modale standalone): cattura il **`createdAt`** dell'ordine più recente come `baseline` e **resta in attesa del PROSSIMO** ordine ("Preparazione ordine in corso...", placeholder `.empty`/`.emptyText`/`.emptyHint`). **Baseline DATE-BASED (`createdAt`), MAI `orderNumber`** — il contatore può essere azzerato (`POST /api/orders/event/:eventId/reset` elimina i `Counter`), quindi il confronto "nuovo ordine" usa la data di emissione. Anche il backend `getStandKioskRecent` ordina per **`createdAt: -1`** (era `orderNumber: -1`). La variante `page` **ascolta `tracking-clear`** come la standalone: alla chiusura della ricevuta in cassa la pagina si svuota e l'ordine mostrato NON ricompare col polling (baseline + `clearedAtRef`); se l'ordine esce dagli stati in-lavorazione la pagina torna vuota; si ripresenta solo al prossimo ordine.
- **Card "Tracking ordine"** in `StandManagePage` (sezione Operazioni, accanto a Cassa/Coda ordini): apre la pagina in nuova tab (`target="_blank"`), gated come le altre da `selectedEventId && eventOngoing`.
- **GOTCHAS**: `OrderTrackingModal` ora ha solo varianti `'standalone' | 'page'` (l'ex `'inline'` è sparito — nessun call site rimasto); per standalone il `standId` si omette (dropdown), per `page` è sempre esplicito; `load()` usa `KioskOrder.createdAt` per baseline e confronto, `clearedAtRef` guardia le race (fetch risolta dopo il clear); nella variante `page` se `kiosk-recent` non ha ordini (`res.order === null`) la visualizzazione viene azzerata.
- Verifica: backend (orders.controller.ts) typecheck ✓ + **426 test ✓** (46 file, +1 `kiosk-recent` dopo reset contatore), lint 0 errori; frontend build (tsc+vite) ✓, 43 test vitest ✓, lint 0 errori (13 warning pre-esistenti). Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**. COMMIT + PUSH su `main`.

## Session state (Set 2026 — fix chiusura tracking modal con ricevuta cassa + rimozione pulsante ×)
### Completed
- **Race condition fix**: il modale standalone non si chiudeva alla chiusura della ricevuta in cassa. `broadcastOrderCreated` lanciava `load()` async; se la fetch di `kiosk-recent` risolveva **dopo** il `tracking-clear` emesso dalla cassa, `load()` ri-mostrava il modale appena nascosto. Fix in `OrderTrackingModal.tsx`: aggiunta ref `clearedAtRef` (`useRef(0)`); `load()` cattura `startedAt = Date.now()` prima della fetch; `onTrackingClear` e `dismiss()` scrivono `clearedAtRef.current = Date.now()`; alla risoluzione, se `clearedAtRef.current > startedAt` il `setKiosk`/`setActive` sono saltati (il baseline viene comunque aggiornato così il polling 5s non ri-presenta lo stesso ordine). Effetto che resetta `selectedStandId`/`variant` azzera `clearedAtRef`.
- **Pulsante `×` manuale rimosso**: il `closeBtn` dalla card standalone è eliminato (ormai inutile: la chiusura avviene solo tramite ricevuta cassa / overlay / Escape). Rimosso anche il blocco SCSS `.closeBtn`/`.closeBtn:hover`.
- Verifica: frontend build (tsc+vite) ✓, 43 test vitest ✓, lint 0 errori (13 warning pre-esistenti). Backend non toccato. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — modale tracking: restyling UX "toggle resta premuto" + stand name/numero/logo nel track)
### Completed
- **Restyling UX del modale tracking**: `OrderTrackingModal` (variante standalone) non mostra più l'"ultimo ordine in lavorazione" già esistente all'apertura del toggle — il modale si **basa** sull'ordine più recente alla prima visualizzazione (`baseline` captured in ref) e **appare solo per ordini NUOVI** (`orderNumber > baseline`), uno alla volta, al loro arrivo. **Chiusura = solo dismiss**: X/overlay/Escape ora chiamano `dismiss()` che nasconde la visualizzazione corrente **senza disattivare il tracking** — il toggle (pulsante mirino/ON) resta premuto e il modale riappare al prossimo ordine (era il comportamento opposto: chiudere il modale spegneva il tracking). Rimosso ogni stato vuoto "Nessun ordine in attesa" (nessun empty state: standalone senza ordine attivo e con stand selezionato → `null`; senza stand → solo il dropdown stand). Prop `onClose` **rimossa** da `OrderTrackingModalProps` e da tutti i call site (`AdminLayout`, `PublicLayout`, `SlideshowPage` — niente più `onClose={onToggleTracking}`).
- **Chiusura allineata alla ricevuta cassa**: nuovo evento **`tracking-clear`** in `lib/tracking.ts` (`broadcastTrackingClear({ eventId, standId })` + `onTrackingClear` con unsubscribe; registro locale + BroadcastChannel `sfe_tracking_orders`). Le due casse (`CashierOrderPage`/`EventCashierPage`) **hanno rimosso `useTrackingEnabled('cashier', …)`** (che teneva il modale inline perennemente nascosto) e ora il modale inline "Ordine creato" è **sempre montato** all'interno dell'overlay; alla chiusura della ricevuta (Chiudi / click overlay via `resetSuccessModal`) le casse chiamano `broadcastTrackingClear` così **anche i modali standalone delle altre pagine/tab si chiudono**. Il modale standalone si sottoscrive a `onTrackingClear` (filtrato per evento/stand) e fa `dismiss()`.
- **Stand name + numero + logo nel card del track**: backend `getStandKioskRecent` ora seleziona `name numbers logo coverImage` e restituisce anche **`standNumber`** (da `stand.numbers` match per `eventId`, altrimenti `null`) e **`standLogo`** (`(logo ?? coverImage)?.url ?? null`). Frontend: `KioskState` esteso (`standNumber: number | null`, `standLogo: string | null`); il card del modale mostra un blocco identità `.standIdentity` (logo img, badge numero `.standNumber` e nome `.standName`) prima del conteggio coda.
- Test: `orders.test.ts` kiosk-recent aggiornato (stand creato con `numbers` + `logo`, asserzioni su `standNumber`/`standLogo`). Verifica: backend typecheck ✓, 24 test orders ✓, lint 0 errori; frontend build (tsc+vite) ✓, lint 0 errori (13 warning pre-esistenti), 43 test vitest ✓. La suite backend intera NON è stata rieseguita (solo `orders.test.ts` + typecheck + lint). Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — tracking: sessionStorage per tab + notifiche self da ogni sorgente)
### Completed
- **Toggle per pagina ora in `sessionStorage`** (era `localStorage`, che sopravvive alla chiusura del browser): `isTrackingEnabled`/`setTrackingEnabled` in `lib/tracking.ts` leggono/scrivono `sessionStorage`, quindi il tracking resta attivo su navigazioni e F5 nella stessa tab e si spegne solo alla **disattivazione o chiusura della tab/browser**. **Rimosso il listener cross-tab `storage`** da `useTrackingEnabled` (con sessionStorage ogni tab è indipendente) — il toggle NON è più sincronizzato tra finestre diverse.
- **Notifiche ordine con self-delivery + tutte le sorgenti**: `broadcastOrderCreated` ora notifica sia un registro **locale** (`localListeners`, stesso tab) sia il BroadcastChannel `sfe_tracking_orders` (altre tab); `onOrderCreated` sottoscrive entrambi con unsubscribe combinato → **il modale si aggiorna subito anche nella tab che ha creato l'ordine** (prima lo stesso tab non riceveva i propri messaggi via BroadcastChannel). Aggiunto `broadcastOrderCreated` dopo il `createOrder` anche in **`EventStandMenuPage`** (ordini dal menu pubblico), oltre alle due casse.
- Verifica: frontend build (tsc+vite) ✓, 43 test vitest ✓, lint 0 errori (13 warning pre-esistenti). Backend non toccato. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — modale tracking ordini globale + pagina track ordine con notifica "pronto")
### Completed
- **Backend** — due endpoint pubblici registrati PRIMA di `authMiddleware` in `orders.routes.ts`: `GET /api/orders/:orderId/track` (`getOrderTrack`: minimi dati `{ id, orderNumber, status, isGift, readyAt, createdAt, eventId, standId, eventName, standName, items[{ productName, quantity, stationName }] }` — **niente dati cliente né prezzi**) e `GET /api/orders/stand/:standId/kiosk-recent` (`getStandKioskRecent`: `confirmed/preparing/ready`, filtro `eventId`, ultimo ordine per `orderNumber: -1`, `queueCount`, `trackUrl` da `req.query.url` (usato dal frontend con `window.location.origin` così il QR punta all'origin della postazione) con fallback origin/request, **QR data URL generato server-side** con `qrcode` — il frontend NON ha lib QR).
- **Frontend** — `TrackOrderPage` (`/track/:orderId`, fullscreen, polling 5s): schermata **"PRONTO!"** verde al passaggio a `ready` con **beep Web Audio** + **Notification API opzionale** (permesso richiesto solo su click del pulsante "Abilita notifiche", mai automatico — Chrome può bloccare i prompt silenziosi); stati completato/annullato/in lavorazione + riepilogo articoli. **`OrderTrackingModal`** (refactor dell'ex `OrderKioskPage`, **RIMOSSA** — niente più `/kiosk` né `KIOSK_ACTIVE_KEY`): varianti **`standalone`** (overlay centrato scuro z-index 200; mount globale in `AdminLayout` skip sulle route cassa, e in `SlideshowPage` via pulsante mirino in testata) e **`inline`** (card senza backdrop dentro l'overlay "Ordine creato" delle due casse `EventCashierPage`/`CashierOrderPage`, con `stopPropagation`, chiusa insieme al riepilogo). **Toggle per pagina** — NON più un master switch unico: `useTrackingEnabled(page, eventId)` in `lib/tracking.ts` con chiavi distinte `sfe_tracking_admin_<eventId>` / `sfe_tracking_slideshow_<eventId>` / `sfe_tracking_cashier_<eventId>` (sync fra tab via listener `storage`); i tre mount point (pagine admin, slideshow, casse) hanno ciascuno il proprio ON/OFF. **Push istantaneo**: le casse chiamano `broadcastOrderCreated({ eventId, standId, orderId, orderNumber })` subito dopo la creazione ordine; `OrderTrackingModal` si sottoscrive con `onOrderCreated` (BroadcastChannel `sfe_tracking_orders`, stesso tab NON riceve i propri messaggi) e fa `load()` immediato se l'evento/stand combacia — il polling 5s resta come fallback (es. schermi su macchine diverse). Pulsante mirino **anche in `AdminTopBar`** (navbar), mostrato solo per ruoli `event-admin`/`stand-admin`/`platform-admin` (check `/auth/me/roles`), condivide il toggle admin. Il pulsante mirino è presente **anche sulle pagine pubbliche** (`PublicHeader`, tutte le route pubbliche con `eventId`, skip `hideChrome`): visibile SOLO agli utenti con i tre ruoli admin (stesso check in `PublicLayout`), toggle con chiave `sfe_tracking_public_<eventId>`, modale con dropdown stand. Senza standId fisso il modale ha un **dropdown stand** (fetch `/stands?eventId=`); polling 5s → **QR grande + numero ordine + stato + riepilogo + badge "N ordini in coda"**.
- **GOTCHAS**: `hideChrome` di `PublicLayout` copre solo `/track` e `/ordersqueue` (il `/kiosk` è stato rimosso); `OrderModel.items` richiede almeno un item (validazione) → testare con item; i test creano ordini direttamente col modello (serve `userId` obbligatorio — qualsiasi ObjectId va bene). Track restituisce i valori anche per ordini `completed`/`cancelled` (il frontend mostra lo stato), `kiosk-recent` invece filtra SOLO gli in-lavorazione.
- Test: +4 in `orders.test.ts` (track pubblico minimale senza customerId/total; 400/404; kiosk-recent ultimo in lavorazione + QR + eventId filter; kiosk vuoto + 400/404). Suite backend **425 test ✓** (46 file), typecheck ✓, lint 0 errori; frontend build (tsc+vite) ✓, 43 test vitest ✓, lint 0 errori (13 warning pre-esistenti). Docs aggiornate (`docs/CHANGELOG.md`, `docs/TODO.md` punto 2 → fatto). Nessun tocco a `.local/`: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — recensioni senza gate acquisto + "Cosa hai comprato" + % affidabilità)
### Completed
- **Gate acquisto rimosso**: `createReview` in `reviews.controller.ts` non esegue più `OrderModel.exists` con ordine non cancellato → un **utente registrato può recensire qualsiasi evento o stand** (era 403 per evento/stand senza acquisto). Il duplicate-check (409 per stesso target) e il guest token per gli anonimi sono invariati.
- **Campo `Review.whatBought`** (String, trim, default null, max 200, sanitizzato): creato in `review.model.ts` (dopo `comment`), incluso in `toPublicReview` e nel `ReviewModel.create`. Il frontend lo espone come "Cosa hai comprato" **solo per le recensioni stand** (`ReviewForm.tsx`, maxLength 200), mostrato nelle card con riga "Comprato: …" (`ReviewCard.tsx`, `ReviewsManagePage.tsx`).
- **Affidabilità**: il badge "Acquisto verificato" è rinominato **"Utente registrato"** (il campo `isVerified` resta `!!userId`, cambia solo il significato esposto); `getReviewsSummary` aggiunge `registeredCount` alle aggregazioni evento e per-stand; le pagine `EventReviewPage`/`StandReviewPage` mostrano "X% da utenti registrati" (percentuale client-side, helper `registeredPercent` in `lib/reviews.ts`).
- **GOTCHAS**: il testo "Verificheremo il tuo acquisto…" in `ReviewForm` non esiste più; `whatBought` è solo per stand (per l'evento resta null); il backend arrotonda `avg` a 1 decimale (testare con `3.3`, non con `10/3` esatto).
- Test: adattati i 2 test del gate (ora 201) + +1 `whatBought` (round-trip sanitizzato + max 200) + `registeredCount` nel summary in `integration-reviews.test.ts`. Suite backend **421 test ✓** (46 file), typecheck ✓, lint 0 errori; frontend build (tsc+vite) ✓, 43 test vitest ✓, lint 0 errori (13 warning pre-esistenti). Docs aggiornate (`docs/CHANGELOG.md`, `docs/TODO.md` punto 1 → fatto, punto 2 chiosco riscritto conciso). Nessun tocco a `.local/`: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — data limite adesione stand)
### Completed
- **Data limite adesione** (`Event.adhesionDeadline`, Date, default null — dopo `depositDeadline` nel model): configurabile in admin in `EventsPage` ("Termine adesione stand", `type="date"`, vuoto = nessun limite). Esposto in `toEventResponse` (create/update/read round-trip). `duplicateEvent` NON lo copia nella nuova edizione (resta null, come le altre scadenze).
- **Gate backend** in `stand-adhesions.controller.ts`: helper `adhesionDeadlineError(deadline)` + 400 `'Il termine per la presentazione delle adesioni è scaduto.'` in `createAdhesion` (dopo il gate `regulationDocument`), `updateAdhesion` (check prima dei controlli approved) e `submitAdhesion` (prima di `completenessErrors`). `submitAdhesion` ora carica l'evento con `.select('adhesionDeadline participationFee deposit')`.
- **Blocco wizard** (`StandAdhesionWizardPage`): `EventRef` include `adhesionDeadline`; `now` catturato via `useState(() => Date.now())` (mai `Date.now()` in render — regola React impure); se scaduta E (nessuna adesione OPPURE adesione editabile: draft/rejected/integration) → early return con `styles.deadlineNotice` ("Il termine per la presentazione delle adesioni era il <data>. Non è più possibile compilare o inviare un'adesione."). Adesioni in stato submitted/approved restano consultabili.
- **QR che punta all'app per gli stand: NON implementata** (decisione utente) — esclusa da TODO e docs.
- Test: +3 in `integration-stand-adhesions.test.ts` (round-trip evento; create 400 con deadline passata; update+submit 400 dopo spostamento deadline al passato). Suite backend **420 test ✓** (46 file), typecheck ✓, lint 0 errori; frontend tsc+build ✓, 43 test vitest ✓, lint 0 errori (13 warning pre-esistenti). Nessun tocco a `.local/`: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — recensioni: QR stampabili di tutti gli stand + layout pagine recensione)
### Completed
- **Pagina stampabile QR recensioni di TUTTI gli stand** (`ReviewsQrCodesPage`, `/admin/events/:eventId/reviews/qrcodes`): guardia roles (event-admin / platform-admin, come ReviewsManagePage), fetch `GET /events/:eventId/reviews/qrcodes/all`, header con nome evento + pulsante Stampa, griglia card (nome stand + badge numero + QR + "Recensione dello stand"), CSS `@media print` = griglia a 3 colonne + class `no-print` per toolbar. Route admin in `router.tsx`; link "QR recensioni di tutti gli stand" nella toolbar di `ReviewsManagePage`.
- **Endpoint backend** `GET /api/events/:eventId/reviews/qrcodes/all` (event-admin / platform-admin): `getAllReviewQrCodes` in `reviews.controller.ts` — carica evento + stand (`.select('_id name numbers')`, `.lean()`), ordina per numero stand evento (null → fondo, poi per nome), genera QR data URL per ogni `/events/:eventId/stands/:standId/review` → `{ items: [{ standId, standName, number, url, qrCode }] }`. Route registrata PRIMA di `/:reviewId`.
- **Fix layout pagine recensione**: le pagine pubbliche `EventReviewPage` e `StandReviewPage` renderizzavano senza `page-shell` (larghezza piena, diversa dalle altre pagine) → contenuto avvolto in `<div className="page-shell">` (stesso pattern di EventStandMenuPage/EventDetailPage).
- Test: +2 in `integration-reviews.test.ts` (lista completa QR per event-admin; 401/403). Suite backend **417 test ✓** (46 file), typecheck ✓, lint 0 errori; frontend build (tsc+vite) ✓, lint 0 errori (13 warning pre-esistenti). Nessun tocco a `.local/`: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — menu operativo platform-admin + data inizio nel dropdown evento)
### Completed
- **`GET /api/auth/me/stands` ora include TUTTI gli stand per i platform-admin**: prima restituiva solo gli stand legati ai ruoli stand/evento espliciti dell'utente → un platform-admin (es. `platform-admin` senza ruoli su "Evento di prova") NON vedeva lo stand collegato all'evento nella sezione **Operativo** della sidebar (che filtra `eventIds.includes(selectedEventId)`). Fix in `auth.controller.ts` `getMyStands`: ramo `isPlatformAdmin` (rilevato da UserRole con ruolo scope `platform`) → `StandModel.find({})` + `StationModel.find({ standId: { $ne: null } })`. Corregge anche i falsi "forbidden" di Cassa/Ordini/Ricevuta (usano `/auth/me/stands` per l'autorizzazione). Test: +2 in `auth.test.ts` (platform vede tutti, utente regolare no). Suite backend **396 test ✓**, typecheck ✓, lint 0 errori.
- **Dropdown "Evento attivo"** (AdminSidebar): ogni evento mostra `Nome — gg/mm/aaaa` (data inizio da `AdminEventItem.startDate`, già esposta da `GET /events`) per distinguere le edizioni con lo stesso nome.
- Nessun tocco a `.local/`: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — adesione stand: commissioni senza tetto + accettazione fee + fix testi)
### Completed
- **Fascia commissione "senza tetto"** (fee band residuale): una fascia con `maxAmount` vuoto/0 = **incassi non compresi nelle altre fasce** (oltre l'ultimo tetto). `EventsPage` la consente come "Importo massimo (EUR) — vuoto = senza tetto" con **validazione al submit: al massimo UNA fascia senza tetto** (alert+return). `adhesion-form.service.ts` `feesSection` rende le fasce capped ordinate ("fino a X € lordi") + la residuale in coda ("oltre l’ultimo tetto (non compresi nelle altre fasce)") con nota. `StandSettlementsPage` `resolveFee`: fallback alla fascia residuale quando nessuna capped copre `ge`.
- **Accettazione fee nel wizard web**: sezione "④bis Commissioni sugli incassi" (elenco fasce + checkbox) → campo `feesAccepted` (Boolean default false) su `StandAdhesion` (model + pick/response/completeness controller, `select('participationFee deposit feeBands')` al submit). `completenessErrors` richiede `feesAccepted` quando `(event.feeBands?.length ?? 0) > 0` (messaggio "accettazione dei fee"); la `missing` list del wizard usa "accettazione fee". `AdhesionsManagePage` mostra "Commissioni sugli incassi: accettate/non accettate" (tipi `AdhesionItem.feesAccepted` + `EventRef.feeBands`).
- **Fix testo**: nel wizard il prerisiuto referente mostrava letterale `dall\u2019organizzazione` (era un text node JSX, occhio `\u2019` non viene interpretato in testo JSX) → `dall&apos;organizzazione`. Verificate le altre occorrenze `\u2019` (tutte string JS, ok).
- **Dimensioni upload**: hint "1080 x 220 px" sotto l'`ImageUploader` banner stand e "quadrato, minimo 512 x 512 px" sotto il logo in `StandAdhesionWizardPage`.
- Test: +2 (`integration-stand-adhesions.test.ts`: submit senza feesAccepted con feeBands → 400; `integration-adhesion-form.test.ts`: fascia senza tetto rende "incassi oltre l'ultimo tetto" + "non compresi nelle altre fasce"). Suite backend **394 test ✓**, typecheck ✓, lint 0 errori; frontend build (tsc+vite) ✓, 43 test vitest ✓, lint 0 errori (13 warning pre-esistenti). Docs `ADESIONE_STAND.md` Sezione F aggiornata (nota fascia senza tetto). Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.

## Session state (Set 2026 — app locale fullscreen + tema evento + code in ordine FIFO)
### Completed
- **Code in ordine FIFO** (cloud + app locale): coda postazione e coda pubblica/display ordinano gli elementi per **`orderNumber` crescente** (primo ordine in testa) con sort lato frontend — la coda postazione prima mostrava il più recente in alto (il backend `listOrders` ordina per `createdAt: -1`). File: `frontend/src/pages/StationQueuePage.tsx`, `frontend/src/pages/StandDisplayPage.tsx`, `.local/frontend/src/components/CodaPostazioni.tsx`, `.local/frontend/src/components/CodaPubblica.tsx`. Nessuna modifica backend (per non influire su altre pagine che usano `listOrders`).
- **App locale fullscreen con navbar**: `.local/frontend/src/App.tsx` ha una navbar (brand "Street Food — Locale", tab pillola Cassa/Coda Postazioni/Display Pubblico/Sync con badge pendenti, nome evento a destra) e layout `100dvh` flex column; `Cassa`, `CodaPostazioni`, `CodaPubblica` sono page a tutto schermo (`flex:1, minHeight:0`) con tema dark che richiama il cashier remoto (`#1a1a2e`/`#16213e`/`#0f3460`, accento `#e94560`, success `#28a745`); `CodaPubblica` replica il `StandDisplayPage` remoto (`#0f172a`/`#1e293b`/`#334155`). `Sync.tsx` NON è a tema (resta pannello admin-like con maxWidth 1100).
- **Tema evento negli accenti**: `getMeta()` del backend locale espone `theme` (`{brand,text,surface,highlight}`) letto dall'`EventModel` corrente; `MetaContext` le applica come CSS variables `--sf-brand` / `--sf-highlight` su `:root` (fallback `#e94560`/`#ffc107`). Gli accenti dei componenti locali usano `var(--sf-brand)` / `var(--sf-highlight)` (tab attiva, brand navbar, badge ordine, titoli, pulsanti, bordo "in preparazione", badge omaggio); sfondi scuri fissi restano navy. **GOTCHA**: se l'evento remoto non ha il tema i colori cadono sui default navy — mai ripristinare hex accento hardcoded nei componenti locali.
- Verifica: build `.local/frontend` ✓ (warning pre-esistente duplicate key `height` in App.tsx), `tsc --noEmit` backend locale ✓, frontend cloud build (tsc+vite) ✓, lint selettivo cloud 0 errori. **`.local/` modificato: `distro/local-app.tar` RIGENERATA.**

## Session state (Set 2026 — pulizia lint pre-esistenti)
### Completed
- **Lint a 0 errori** su entrambi i package (era 33 errori backend + 58 errori frontend, tutti pre-esistenti).
- Frontend `eslint.config.js`: **regole disattivate di proposito** — `react-hooks/set-state-in-effect` (39 errori: il pattern repo `void load()` con `setLoading(true)` sincrono la scatena; era assente con react-hooks ≤6, nessun refactor in remoto) e `react-refresh/only-export-components` (7: helper esportati da `CurrencyDisplay`/`CategorySelect` usati in ~18 file + hook da `auth-context`/`ThemeProvider`). Il resto di react-hooks/ts rules resta attivo.
- Fix banali frontend: `no-empty` ×9 (`catch { /* noop */ }` su catch intenzionali), `no-useless-assignment` (`PhotoBoothModal` `let dateStr: string`), `no-require-imports` (`vite.config.ts`: import ESM `node:fs` + `new URL('./dist/…', import.meta.url)` al posto di `require`/`__dirname`).
- Backend: rimosso dead import `hashActivationToken` da `users.controller.ts` + **32 unused vars nei test** (import morti rimossi; fixture per side-effect senza assegnazione destructure o destructured ridotte a `{ role }`).
- VERIFICA: frontend build ✓ + 43 test vitest ✓ + lint 0 errori (restano 13 warning `exhaustive-deps` pre-esistenti); backend typecheck ✓ + **372 test ✓** + lint 0 errori. Nessun tocco a `.local/`: nessuna rigenerazione di `distro/local-app.tar` necessaria. COMMIT `chore`.

## Session state (Set 2026 — promozioni e coupon)
### Completed
- Sistema **Promozioni e Coupon** completo (backend + frontend): tre tipi di coupon applicabili in cassa via input manuale o **QR scan** — `discount` (sconto `%` o `fixed` in crediti, mai su pagamenti in crediti per la versione percentuale, blocco server+client), `product` (prodotto del menu omaggio — semplici o con **formula** 2x1/3x2 via `formula { paid, total }` e cap `formulaMaxFree`; ogni ordine = 1 presentazione `maxPresentations`, non restituita se l'ordine viene annullato) e `value` (buono valore riscattato accreditando crediti al cliente). Modelli `Promotion` + `PromotionUsage`. API `/api/events/:eventId/promotions` (`Router({ mergeParams: true })`). Integrazione in `createOrder`/`payOrder` con campi `promotionId/promotionCode/discountAmount/freeUnits` sull'ordine, report con sezione `coupons` + `discountAmount`. Frontend: `CouponPanel` nelle due cacce, pagina `/admin/events/:eventId/promotions`, sezione coupon nei report e righe Sconto/Omaggi su ricevuta e modale conferma.
- **GOTCHAS applicati**: Express 5 sub-router su `/api/events/:eventId/...` con `mergeParams: true`; filtri campo-vs-campo numerici con `$expr` (mai `{ field: { $gt: '$other' } }`); per-user limit richiede `eventUserId` sui `PromotionUsage` (risolto in `createOrder`).
- Verifica: backend typecheck ✓, **341 test ✓** (incl. `integration-promotions.test.ts`, 27 test), frontend build (tsc+vite) ✓, 41 test vitest ✓, lint senza errori NUOVI (backend da 36 a 33 errori solo per rimozione degli unused-import miei; i restanti 33 sono pre-esistenti). COMMIT precedente "Revert feat(slideshow)" esiste. Solo cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria** (`.local/` non toccato).

## Session state (Set 2026 — esportazione social moneta + regolamento PDF su evento)
### Completed
- **Regolamento PDF su evento**: `Event.regulationDocument` (subdocumento `document.schema`, default null) caricabile in `EventsPage`; endpoint `POST /api/upload/document` (solo `application/pdf`, 20 MB, Cloudinary `resource_type: 'raw'`) e `DELETE /api/upload/document`. Pulsante "Scarica Regolamento" nella hero di `EventDetailPage` (solo se presente) che scarica con nome **`regolamento-<manifestazione>-<anno>.pdf`** — **GOTCHA**: un `<a download>` cross-origin su Cloudinary NON forza il nome; usare `fetch`→`blob`→`URL.createObjectURL`→anchor `download` (fallback `window.open`).
- **Esportazione social**: il nome della moneta appare SOLO nella riga "Moneta evento: NOME (1 NOME = €)"; nei prezzi di poster+caption si usa il **logo della moneta** (`currencySymbol.url`) o l'**iniziale in un circoletto unicode** (`Ⓣ`, U+24B6.. via `circledInitialText`); simboli nudi ('€', 'euro') restano testo. La **descrizione evento nella caption è ripulita dai tag HTML** (`stripHtml` in `lib/socialMenu.ts`).
- Documentazione: `docs/ADESIONE_STAND.md` Sezione E — Energia elettrica (un solo punto luce; esigenze aggiuntive elencate nel modulo con potenza kW/kWh; contributo a carico dello stand); `docs/regolamenti/notti-cilentane-2027.md` aggiornato.
- Verifica: backend non toccato; frontend build (tsc+vite) ✓, 41 test vitest ✓, lint solo warning pre-esistenti. Nessun tocco a `.local/`: nessuna rigenerazione di `distro/local-app.tar` necessaria.

## Session state (Set 2026 — saldo utente in pagina evento pubblica)
### Completed
- `GET /api/events/:eventId` ora usa `optionalAuthMiddleware` e, se `req.user` è presente, restituisce anche `wallet: { balance } | null` (saldo crediti dell'utente per quell'evento, via `EventUserModel`). `EventDetailPage` mostra un badge "saldo" con l'ammontare (o 0) nella moneta dell'evento accanto al badge moneta, solo per utenti autenticati (ai visitatori anonimi resta nascosto).
- Verifica: backend typecheck ✓, 303 test ✓, frontend build ✓.
- Nota: la modifica tocca solo `backend/` e `frontend/` cloud — NON `.local/`, quindi nessuna rigenerazione di `distro/local-app.tar` necessaria.

## Session state (Set 2026 — parametri coupon in eventi GA4/GTM)
### Completed
- `trackCashierOrderCreated` e `trackOrderCreated` in `analytics.ts` ora accettano i parametri opzionali `promotionCode`, `discountAmount`, `couponType` (esposti nel dataLayer come `promotion_code`, `discount_amount`, `coupon_type`). Call sites: `CashierOrderPage.tsx` e `EventCashierPage.tsx` passano i valori dalla response API (`response.item.promotionCode`, `response.item.discountAmount`, `coupon?.item.type`). `EventStandMenuPage` (menu pubblico, nessun coupon) mantiene i default vuoti — nessun cambio.
- Fix `CouponPanel.tsx`: `trackCouponApplied` ora riceve `discountAmount` e `freeUnits` calcolati da `computeCouponDiscount(coupon.item, lines)` al momento della validazione, invece dei valori zero hardcoded.
- Verifica: frontend build ✓, 43 test vitest ✓, lint 0 errori (13 warning pre-esistenti). Nessun tocco a `.local/`: nessuna rigenerazione di `distro/local-app.tar` necessaria.

## Session state (Set 2026 — fix "stand collegato" per nome nel wizard adesione)
### Completed
- **Bug**: nel campo "Stand collegato" (gestori evento) si digitava il NOME dello stand che finiva in `standId` del payload → nella creazione/modifica adesione mongoose lanciava `Cast to ObjectId failed for value "…" at path "standId"`.
- **Modello di adesione**: l'adesione è per UN NUOVO stand (nome scritto nella prima riga "Nome attività", `standId` vuoto → lo Stand viene creato all'approvazione) OPPURE uno stand GIÀ registrato di proprietà dell'utente. Il campo "Stand collegato" NON è un campo libero.
- **Fix backend** (`stand-adhesions.controller.ts`): nuova helper `resolveStandReference(eventId, ref)` — accetta sia un ObjectId valido sia il **nome** dello stand (match case-insensitive esatto tra gli stand dell'evento, `name` escaped per la regex); usata in `createAdhesion` e `updateAdhesion` (se il nome non esiste → 400 "Nessuno stand trovato…"). `data.standId`/`body.standId` assegnato con l'ObjectId risolto così il modello non vede più la stringa. Defence-in-depth: il frontend ora NON invia più nomi, solo id.
- **Fix frontend** (`StandAdhesionWizardPage.tsx`): il campo "Stand collegato" da free-text `<input>` con datalist è diventato un `<select>` con gli stand dell'evento (per admin/gestori) o "I tuoi stand" (per l'utente) — prima opzione "— Nuovo stand: scrivi il nome qui sotto —". Label spiegata ("solo stand GIÀ registrati…; se lo stand è NUOVO lascia vuoto"). Selezione di uno stand esistente precompila `standName`; deselezione lo svuota se vuoto.
- Test: +2 in `integration-stand-adhesions.test.ts` (creazione per nome → id risolto; nome inesistente → 400). Suite backend **374 test ✓**, typecheck ✓, lint 0 errori; frontend build (tsc+vite) ✓, lint 0 errori (13 warning pre-esistenti). Nessun tocco a `.local/`: nessuna rigenerazione di `distro/local-app.tar` necessaria.

## Session state (Set 2026 — fix submit adesione: quota/caparra opzionali + persist pre-submit)
### Completed
- **Bug**: "Compilazione incompleta: accettazione del prezzo di partecipazione, accettazione della caparra, firma del richiedente" — ma l'evento NON ha quota/caparra e la firma è compilata nel form.
- **Fix ① (backend)**: `completenessErrors(adhesion, event)` ora richiede `participationFeeAccepted`/`depositAccepted` SOLO se `event.participationFee`/`event.deposit` sono definiti (`!= null`), come già faceva la `missing` list del wizard. `submitAdhesion` carica l'evento (`select('participationFee deposit')`) e lo passa.
- **Fix ② (frontend)**: `handleSubmit` in `StandAdhesionWizardPage.tsx` chiamava il submit coi dati SALVATI, ignorando modifiche non ancora persistite (es. firma digitata dopo l'ultimo salvataggio). Ora fa SEMPRE `persist(buildPayload(form))` (PATCH se l'adesione esiste, POST altrimenti) prima del POST `/submit`.
- Test: +1 in `integration-stand-adhesions.test.ts` (evento senza fee/caparra → submit OK senza acceptance). Suite backend **375 test ✓**, typecheck ✓, frontend build ✓.

## Session state (Set 2026 — stato "Da integrare" + referente dello stand nel wizard adesione)
### Completed
- **Stato `integration` ("Da integrare")** per le adesioni stand: nuovo endpoint `POST /api/events/:eventId/adhesions/:adhesionId/integration` (solo event-admin, `reviewNote` obbligatoria, 400 se manca) richiesto dal terzo pulsante "Da integrare" su `AdhesionsManagePage`. Setta `status: 'integration'`, `reviewedAt`, `reviewNote`. Lo stand riapre l'adesione in modifica dal wizard (stato `editable` come draft/rejected), può ritirarla (da `submitted` o `integration`) e reinviarla (`submit` funziona da `integration`; azzera `reviewedAt`/`reviewNote`). Il gestore può da `integration` approvare/rifiutare/chiedere ulteriori integrazioni.
- **Sezione referente**: estratta dalla sezione ① e spostata in campo dedicato finale ⑦ "Referente dello stand" nel wizard — "Nome e cognome del referente" (campo unico), email, telefono, **recapito social** opzionale (`contactSocial`, nuovo campo modello + API). Regole: nome referente obbligatorio per TUTTI; stand NUOVO (standId vuoto) → email obbligatoria (serve per creare/attivare l'account di gestione); stand GIÀ registrato → email O telefono. Validazione identica in `completenessErrors` (backend) e `missing` (frontend).
- Test: suite backend **377 test ✓** (+2: flusso integration, regole referente), typecheck ✓, frontend build (tsc+vite) ✓, lint 0 errori (13 warning pre-esistenti). Nessun tocco a `.local/`: nessuna rigenerazione di `distro/local-app.tar` necessaria.

## Session state (Set 2026 — advertisement nel pannello slideshow)
### Completed
- **Rifiniture UI (ultimo step)**: dashboard admin con **card a griglia per ogni advertisement** (`.list` flex-wrap orizzontale, card 210px): immagine portrait grande in alto (`cardImgWrap`, object-fit contain) con **badge stato sovrapposto** in alto a destra, sotto nome (ellipsis), badge apparizioni, campo Peso e pulsanti Attiva/Disattiva + Elimina dedicati. Pannello slideshow: **rimossa la barra superiore** (`adPanelHeader`) — la chiusura è ora un **circoletto bianco con la X** (`adPanelClose`, 2rem, assoluto in alto a destra sopra l'immagine); **titolo slideshow allineato a sinistra** (`titleGroup` con `margin-right: auto`, `.refreshBtn` mantiene `margin-left: auto` → controlli a destra).
- COMMIT e PUSH su `main`: `33070bc` (contatori apparizioni + titolo slideshow con sottotitolo + keep-alive spostato a SlideshowPage), `e62949f` (griglia admin + titolo a sinistra), `2c64e6f` (rimozione barra pannello + circoletto X). Nessun tocco a `.local/`: nessuna rigenerazione di `distro/local-app.tar` necessaria.
- **Advertisement trasversali**: modello `Advertisement` (collezione `advertisements`, NON legato a evento — campi `image`/`enabled`/`weight`/`name`/`appearances`) con API `/api/advertisements`: `GET /` pubblico (solo `enabled: true`), `GET /manage` (platform-admin/photo-admin, tutte), `POST` (multipart `image`, guard same-role), `POST /reset-appearances` (azzeramento contatori, guard same-role), `POST /:advertisementId/appearance` (pubblico, `$inc` apparizioni), `PATCH /:advertisementId` (toggle `enabled`/nome/`weight`), `DELETE` (rimuove asset Cloudinary).
- **Pannello collassabile in `SlideshowPage`**: a destra della griglia foto — chiuso = tab verticale sottile "Advertisement"; aperto = occupa `min(30vw, 100vh*0.7071)` (proporzione portrait A4) a tutta l'altezza, riducendo la larghezza della griglia. Ruota con lo stesso timer `rotateSec` dei pulsanti velocità ma con **selezione casuale ponderata** sul `weight` (`weightedPickIndex` — probabilità ∝ peso, mai ripetuto consecutivo se esistono alternative); dissolvenza `adFade`. Struct layout: `.fullscreen` (colonna) → `.body` (riga: `.stage` + `.adPanel`). Il pannello aperto NON ha titolo né contatore (solo × per chiudere). La schermata ha in testata **titolo slideshow editabile + sottotitolo (nome evento)** + aggiorna + velocità; `useKeepAlive` (ping anti-idle 9 min) è montato solo qui (tolto dalle pagine cassa).
- **Contatori apparizioni**: ogni display di un advertisement (pannello aperto) chiama `POST /:id/appearance` che fa `$inc` su `appearances` — il **totale è mostrato in admin accanto alla thumbnail** di ogni card; pulsante "Azzera contatori apparizioni" in `AdvertisementsPage` (conferma) → `POST /reset-appearances`.
- **Pagina admin** `AdvertisementsPage` (`/admin/advertisements`, sezione sidebar Foto, solo platform-admin): upload (nome opzionale + peso), input peso numerico accanto alla thumbnail di ogni card, badge apparizioni, attiva/disattiva, elimina.
- Test: `integration-advertisements.test.ts` (15 test: public only enabled, auth/403 su manage, create platform-admin, peso custom, clamp peso a 1, PATCH peso, appearance increment, 400/404 appearance, reset counters, 401 reset, toggle, delete + deleteImage, 400/404). Suite backend **392 test ✓** (45 file), typecheck ✓, lint ✓; frontend build (tsc+vite) ✓, lint 0 errori (13 warning pre-esistenti). Nessun tocco a `.local/`: nessuna rigenerazione di `distro/local-app.tar` necessaria.

## Session state (Aug 2026 — evento admin centralizzato con AdminEventContext)
### Completed
- Nuovo `frontend/src/layouts/AdminEventContext.ts`: `AdminEventContext` + hook `useAdminEvent()` che espone `{ selectedEventId, selectedEvent, events }` a sidebar e pagine.
- `AdminLayout` è l'unica sorgente di verità: carica gli eventi (`GET /api/events` senza `public`), li fornisce via `AdminEventContext.Provider`, delega `handleSelectEvent` ad `AdminSidebar`. Risoluzione `selectedEventId`: (1) evento nell'URL (solo `/admin/events/:id/...`), (2) `localStorage['adminSelectedEventId']`, (3) primo evento in corso (`endOfDay(endDate) >= now`), fallback `events[0]`.
- `handleSelectEvent`: aggiorna context + `localStorage`; se il nuovo evento è DIVERSO da quello corrente → **navigate SEMPRE a `/admin/dashboard`** (mai rewrite URL sulla stessa pagina — StandDetailPage/StandManagePage mostrano tutti gli eventi dello stand e resterebbero incoerenti).
- Combo locali rimosse (ora leggono `selectedEventId` dal context negli effect): `EventUsersPage`, `MenuPrintPage`, `StandDetailPage` (selettore azioni), `StandManagePage`, `UsageContractsPage` (filtro contratti), `EventProductsPage` (filtro prodotti). Le pagine che servono l'evento COMPLETO (currencyName, logo, coverImage, promo) mantengono un fetch locale `GET /events` SOLO per i dettagli — mai per la SELEZIONE.
- Selettori evento che restano come campi di modulo (NON rimuovere): ruolo event-scope in `UserRolesPage`, form prodotto in `EventProductsPage`/`StandDetailPage`, evento nel form contratto. `NewOrderPage`/`OrdersPage` sono dead code (non in `router.tsx`) e non toccate.
- Verifica: `npm run build` (tsc + vite) ✓, `vitest` 16 test ✓, lint senza errori NUOVI (`EventProductsPage` è stata ristrutturata per evitare un nuovo `set-state-in-effect`; restano solo quelli pre-esistenti).

## Session state (Aug 2026 — ordini omaggio + dashboard eventi terminati)
### Completed
- Ordini omaggio: `Order.isGift` (default `false`). `createOrder` con `isGift: true` forza `status: 'confirmed'`, `total: 0`, `creditAmountUsed: 0`, `paymentStatus: 'paid'`, `paidAt`, `paymentTransactionId: null`; la logica pagamento è saltata (`if (paymentOnCreate && !isGift)`). Gli item conservano `unitPrice`/`subtotal` reali per il conteggio prodotti. Numero ordine con prefisso "O" e badge OMAGGIO a livello UI (display coda, liste ordini, dettaglio, ricevuta, cassa).
- `GET /api/orders/gift-stats?eventId=&standId=` (auth): conta solo ordini non cancellati; `thresholdExceeded = giftPercentage > 5` (STRETTO — al 5% esatto non scatta). Route registrata PRIMA di `get('/:orderId')`. `GiftCounter` (frontend) mostra "Omaggi: X/Y (Z%)" verde ok / rosso pulsante se superata.
- Resoconti: `giftOrders` (non cancellati) per stand e nei totali; `giftProducts` nel summary stand; `productQuantities` split `quantity`/`giftQuantity`/`revenue` (i gift NON generano revenue). I gift sono esclusi da `paidOrders`, `cashPaymentOrders` e `mixedPaymentOrders` per costruzione, ma `creditPaymentOrders` li esclude ESPLICITAMENTE (`$ne: ['$isGift', true]`) perché `creditAmountUsed === total` (0===0) li matcha di default.
- Dashboard operatore: eventi terminati (fine giornata `endDate` passata) → badge "Terminato — nessuna operazione", niente link Cassa/Ordini/Coda/Coda combinata né chip postazioni né Liquidazione. `isEventFinished` usa `endOfDay(end) < now` con `now` catturato una volta via `useState(() => Date.now())` (il lint React vieta `Date.now()` in render). Sezione Resoconti con dropdown per evento e dropdown per stand + "Menu stampa", invece della lista di pulsanti.
- Test: `orders.test.ts` (creazione gift forzata, gift-stats con soglia al 5% esatto e oltre, cancellazione esclusa dal conteggio) e `integration-reports.test.ts` (report stand/evento: gift esclusi dal fatturato, quantità omaggio separate). 249 test backend, typecheck pulito sia backend che frontend. Lint frontend: nessun errore NUOVO (restano solo i pre-esistenti in AliasManager/ConfirmModal e i `no-empty`/`set-state-in-effect` già presenti).

## Session state (Aug 2026 — invio email bulk galleria + lightbox + timeout "Pronto" display)
### Completed
- Endpoint bulk `POST /api/events/:eventId/photos/send-email` (photo-print / photo-admin / platform-admin): body `{ email, photoIds[], marketingConsent }`. Invia tutte le foto a un unico indirizzo via `email.service.sendPhotosEmail` (una email con N immagini; se tra le selezionate c'è un video → 400). `sendPhotoEmail` (singola) delega a `sendPhotosEmail` con un array di 1. La registrazione della subscription è estratta in `recordEmailSubscription`.
- `EventGalleryPage`: click su foto/video → lightbox a schermo intero (`lightboxPhoto` state, overlay + media contenuto, numero in basso a destra, click fuori chiude). La selezione multipla avviene SOLO col pallino in alto a destra (button `.check`, `e.stopPropagation()`), non col click sulla card. Pulsante toolbar "Invia selezionate via email" (photo-print+) quando `selectedIds.size > 0`; filtra solo immagini.
- Timeout "Pronto" nel display coda: campo `Order.readyAt` (Date, default null) valorizzato in `updateOrderStatus`/`markStationReady`/`markItemReady`/`cancelOrderItems` quando l'ordine passa a `ready`. `getStandDisplayOrders` esclude i `ready` più vecchi di `STAND_DISPLAY_READY_TIMEOUT_MINUTES` (env, default 2). Test in `orders.test.ts` (17 test) e `integration-event-photos.test.ts` (12 test).

## Session state (Aug 2026 — numeri progressivi stand per evento)
### Completed
- `Stand.numbers`: array di `{ eventId, number }`. `number` = progressivo per-evento, auto-assign alla creazione dello stand e quando uno stand viene collegato a un evento. `GET /api/stands` include `numbers` (filter per `eventId`), `/api/stands/:standId` pure.
- `Stand.numbers[].showOnMap` (default `true`): se `false` lo stand non viene mostrato in mappa (marker + combo `EventMapPage`) ma conserva il numero. Gestito da `PATCH /stands/reorder` con `showOnMap` opzionale per item.
- Endpoint bulk `PATCH /api/stands/reorder` (auth): body `{ eventId, items: [{ standId, number }] }`. Valida che tutti gli stand facciano parte dell'evento, poi imposta `numbers` per ogni stand. Pattern identico a `/stations/reorder` e `/event-products/reorder`.
- Sort liste per numero: `listStands` usa `numbers` quando filtrato per evento (fallback `name` per gli stand senza numero). `EventDetailPage` ordina per numero (fallback nome).
- `EventDetailPage`: badge col numero su ogni card stand; la numerazione è GLOBALE per evento (senza distinzione di categoria) e si gestisce nella sezione admin "Numerazione stand" — lista unica di tutti gli stand ordinata per numero (mista, con badge categoria) con pulsanti ▲/▼. `EventMapPage`: marker numerati (divIcon con badge circolare) e legenda; combo degli stand con numero.
- `EventStandMenuPage`: prezzo nascosto quando è 0 (menu omaggio), sia nelle card che nel modale dettaglio.
- Test: `backend/src/__tests__/controllers/stands.test.ts` (11 test: assign on create/link, reorder + rinumerazione, validazione stand non nell'evento).

## Session state (Aug 2026 — video in galleria + cassa stand dalla dashboard)
### Completed
- `EventPhoto` supporta `type: 'image' | 'video'` (default `'image'`) con subdocument `video` (`{ url, publicId, width, height, format, bytes, duration }`); `image` e `video` sono opzionali. `POST /api/events/:eventId/photos` usa `multerMediaUpload.fields([{ name: 'image' }, { name: 'video' }])` e salva il tipo giusto.
- Cloudinary: `uploadVideoBuffer` (resource_type `video`), `deleteVideo`/`deleteMedia` (destroy con `resource_type`); `deleteAllEventPhotos`/`deleteEventPhoto` scelgono la funzione in base a `type`.
- `EventGalleryPage`: pulsante "Carica video" (photo-admin, input file → multipart `video`), card `<video controls>`, badge 🎬, contatore "elementi", stampa e invio email solo per foto.
- `SlideshowPage`: i video in griglia girano muted/loop/autoplay/playsInline; nel modale fullscreen con controlli.
- Dashboard: link "Cassa" per stand → `/events/:eventId/stands/:standId/order`, mostrato solo se autorizzato (`canAccessStandCash`: platform-admin, ruolo stand-scope `cashier` per quello stand, oppure `event-admin`/`event-cashier` per un evento dello stand). Sta nella riga `standActions` accanto a "Coda Ordini".
- Test: `backend/src/__tests__/controllers/integration-event-photos.test.ts` (9 test: upload video/immagine, sequenza condivisa, delete singola/all con resource_type corretto, email video → 400).

## Session state (Aug 2026 — menu pubblico stand con immagini)
### Completed
- `EventStandMenuPage` (`/events/:eventId/stands/:standId`): `Stand.coverImage` mostrata come banner cover in testata e come logo circolare accanto al titolo; thumbnail `product.coverImage` per ogni voce di menu. Lo Stand ha un SOLO campo immagine (`coverImage`) — niente logo separato.

## Session state (Aug 2026 — resoconto liquidazioni per evento)
### Completed
- Endpoint `GET /api/exchange/:eventId/settlements/report` (exchange-admin / platform-admin): aggrega per stand tutte le liquidazioni (`StandSettlement`) — numero, crediti liquidati, lordo €, trattenuta €, erogato € — più colonne di riferimento `earnedCredits` (dal report ordini, intero evento) e `remainingCredits`. Supporta filtro `from`/`to` su `occurredAt` (le colonne di riferimento restano per tutto l'evento). Totali evento inclusi.
- `SettlementsReportPage` su `/events/:eventId/settlements/report`: riepilogo con card totali, tabella per stand con riga TOTALE, filtro date e pulsante stampa (stili print in `EventReportPage.module.scss`). Riusa i moduli SCSS di `EventReportPage`.
- Navigazione: link "Resoconto liquidazioni" nella header di `StandSettlementsPage` e nella sezione Cambio valuta di `EventDetailPage`.
- Test: `integration-settlements.test.ts` (report aggregato con euro, filtro date, evento vuoto).

## Session state (Aug 2026 — moneta evento + resoconti in euro)
### Completed
- `CurrencyDisplay` condiviso (`frontend/src/components/CurrencyDisplay.tsx` + `.module.scss`): icona moneta (immagine `currencySymbol.url` o iniziale di `currencyName` in circoletto). Helper `currencyInitial(name)` e `currencyBadgeHtml(name)` per HTML inline (stampa).
- Moneta evento visibile in: DashboardPage, EventStandMenuPage, NewOrderPage, CashierOrderPage, EventCashierPage (cassa unica), OrderDetailPage, ReceiptPage (stampa + schermo), OrdersPage, EventOrdersPage, StandOrdersPage, MenuPrintPage, EventProductsPage, StandDetailPage, EventUsersPage, EventDetailPage.
- Resoconto in euro: `fmt(n, rate)` divide per rate in `EventReportPage`; `StandOrdersPage` report con `(value / (report.exchangeRate ?? 1))`. Backend `getEventReport` seleziona `exchangeRate`; `getStandReport` carica l'evento e restituisce `currencyName`/`currencySymbol`/`exchangeRate`.
- `lib/orders.ts`: tipi `StandReport`/`EventReport` includono `currencyName`/`currencySymbol`/`exchangeRate`; `StandReport` ha anche `eventId`.
- Ordini multi-evento (OrdersPage/StandOrdersPage senza filtro evento): moneta risolta dal fetch `/events` per eventId, fallback alla moneta del report se filtro attivo.
- Backend `getOrderReceipt` seleziona `currencyName currencySymbol` e risposta include `eventId`, `currencyName`, `currencySymbol`.

## Session state (Aug 2026 — liquidazione stand)
### Completed
- Modello `StandSettlement` (`backend/src/models/stand-settlement.model.ts`): `eventId`, `standId`, `standName` (denormalizzato), `amount` (crediti, libero), `exchangeRate` (snapshot), `feePercent` (0-100), `grossEuro`/`feeEuro`/`payoutEuro` (calcolati e memorizzati), `description`, `performedByUserId`, `occurredAt`.
- API: `GET /api/exchange/:eventId/settlements/summary` (crediti guadagnati dai report + già liquidati per stand — SOLO informativo), `GET /api/exchange/:eventId/settlements` (storico paginato con totali), `POST /api/exchange/:eventId/settlements` (crea liquidazione, nessun check di saldo residuo). Guard: `exchange-admin`/`platform-admin`.
- `StandSettlementsPage` su `/events/:eventId/settlements`: selezione stand, importo presentato (default = crediti guadagnati dal report, modificabile), percentuale trattenuta (default 0), anteprima in euro (lordo ÷ cambio, trattenuta, da corrispondere), storico con totali.
- Navigazione: link in `EventDetailPage` (sezione Cambio valuta), in `EventExchangePage` header, e in `DashboardPage` (Gestione wallet, per evento con ruolo exchange-admin).
- Test: `backend/src/__tests__/controllers/integration-settlements.test.ts` (9 test). `exchangeRouter` montato in `createTestApp`; collezione `standsettlements` aggiunta al reset di setup.ts.

## Session state (Aug 2026 — postazione clienti stand display)
### Completed
- Endpoint pubblico `GET /api/orders/stand/:standId/ordersqueue` (confirmed/preparing/ready, minimi dati: niente prezzi, nomi clienti o pagamenti)
- `StandDisplayPage` fullscreen pubblico su `/events/:eventId/stands/:standId/ordersqueue` (polling 5s, avanzamento articoli per postazione, badge "Pronto")
- `hideChrome` in AppLayout include le route `/display` (navbar e footer nascosti)
- Link "Coda Ordini" (nuova tab) nella header di `StandOrdersPage` e nella dashboard operatore
- Helper `fetchStandDisplayOrders` in `frontend/src/lib/orders.ts`
- Test backend: filtro stati, esclusione pending/completed, 404 stand inesistente
- I comandi display NON sono protetti: la route è registrata PRIMA di `authMiddleware` in `orders.routes.ts`

## Session state (Aug 2026 — reset evento + cambio auto-select + POI centrato)
### Completed
- `POST /api/orders/event/:eventId/reset` (platform-admin): in transazione elimina ordini, TUTTE le `EventUserTransaction` (acquisti + cambio), le `StandSettlement`, azzera i saldi `EventUser`, elimina i `Counter` degli stand e azzera `Event.cashRegisterResetAt`. Implementato in `resetEventOrders` (orders.controller.ts) con await SEQUENZIALI dentro la transazione — MAI `Promise.all` su operazioni con session Mongo (flaky: 500 intermittente).
- UI doppia conferma in `EventDetailPage`: bottone "Azzera ordini" → modale riepilogo → modale `prompt` che richiede la digitazione di "AZZERA". Test: `integration-order-reset.test.ts` (3 test).
- `EventExchangePage`: al caricamento, se nessun utente è selezionato viene selezionato di default il Cliente Generico (`isAnonymous`); il pulsante "+ Crea" seleziona automaticamente il nuovo cliente creato (usa `res.item.id`). Ref `selectedUserIdRef` per evitare closure stantie in `fetchData`.
- `MapPicker`: se non ci sono coordinate valide ma c'è `resetCenter`, usa `resetCenter` come centro iniziale + posizione marker e precompila le coordinate via `onChange` (fallback a Roma solo se niente `resetCenter`). Il form "Nuovo POI" di `EventDetailPage` passa le coordinate dell'evento come `resetCenter` con label "Centra sull'evento".

## Session state (Jul 2026 — email subscription + fix cassa ordini)
### Completed
- EmailSubscription model + CRUD API (pubblica subscribe, admin list/delete)
- `sendEventPhotoEmail` registra email + consenso marketing dopo invio
- ConfirmModal: checkbox consenso privacy per prompt mode
- EventGalleryPage: consenso marketing nel modale email
- docs/INFORMATIVA_PRIVACY_EMAIL.md (GDPR + modulo firmabile)
- `listOrders` / `listMyStationOrders`: supporto comma-separated per `?status=`
- `CashierOrderPage`: ordine avanza a `preparing` dopo creazione
- `CashierOrderPage`: mostra ordini `preparing` + `ready` (non solo `ready`)
- BUG: due pagine cassa (`CashierOrderPage` e `EventCashierPage`) avevano logica diversa — allineata
