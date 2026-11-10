# CHANGELOG — Street Food Events

Changelog del mese corrente (in ordine cronologico).
Le voci piu vecchie sono archiviate in CHANGELOG_ANNUALE.md (storico, non in ordine cronologico).

## Novembre 2026
- **Note del supervisore analizzate e chiuse (nessuna modifica).**
  • «Posso votare più foto in galleria»: comportamento by design — un «mi piace» per foto per dispositivo, lo stesso telefono può mettere il cuore su più foto (distinto dal voto del contest fotografico, che è uno per dispositivo per evento). Documentato in ARCHITECTURE.md.
  • «Lo slideshow riporta la votazione aggiornata?»: sì — lo slideshow fa polling ogni 2 minuti e ad ogni poll rilegge i rank dei contest (`fetchContestRanks`), calcolati lato server; le medaglie si aggiornano entro ~2 minuti da un nuovo voto.
  • Entrambe le note rimosse da `docs/NOTE_SUPERVISORE.md` (segnaposto ripristinato). Nessun tocco a codice: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
- **Scaricamento QR: nome file descrittivo.**
  • Il componente `QRCodeDownload` compone ora il nome del file scaricato da `purpose` + `nome evento` (sanitizzato), invece di nomi generici (`recensioni-evento`, `menu-<stand>` senza evento). I call site principali (QR evento, menu stand, contest, recensioni, stand) passano `purpose`/`eventName` (o `fileName` esplicito per backward compat). I file scaricati indicano quindi cosa rappresenta il QR e l'evento associato.
  • Verifica: frontend build OK. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
- **UI/UX pubblico: polish wizard adesione (piano di lavoro #3, tranche 7).**
  • Titolo wizard con clamp, font-weight 800, letter-spacing negativo.
  • Solo pagine pubbliche; la parte admin resta invariata.
  • Verifica: frontend build OK. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
- **UI/UX pubblico: polish pagina frames (piano di lavoro #3, tranche 6).**
  • Titolo bold con letter-spacing negativo.
  • Solo pagine pubbliche; la parte admin resta invariata.
  • Verifica: frontend build OK. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
- **UI/UX pubblico: polish pagina contest evento (piano di lavoro #3, tranche 5).**
  • Titolo più grande/bold con letter-spacing negativo; nome card contest bold.
  • Solo pagine pubbliche; la parte admin resta invariata.
  • Verifica: frontend build OK. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
- **UI/UX pubblico: polish pagina recensioni (piano di lavoro #3, tranche 4).**
  • Hero recensioni con gradiente brand-soft e ombra; titolo clamp più grande/bold.
  • Solo pagine pubbliche; la parte admin resta invariata.
  • Verifica: frontend build OK. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
- **UI/UX pubblico: polish galleria, mappa, bottom bar, stand detail (piano di lavoro #3, tranche 3).**
  • Galleria pubblica: titolo clamp più grande, sottotitolo più leggibile.
  • Mappa evento: titolo più grande/bold, contenitore mappa con border-radius, ombra e bordo.
  • Bottom bar: glassmorphism, stato attivo con gradiente brand e barra 3px.
  • Stand detail: titolo bold con letter-spacing negativo.
  • Solo pagine pubbliche; la parte admin resta invariata.
  • Verifica: frontend build OK. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
- **UI/UX pubblico: header glassmorphism e brand mark a tema (piano di lavoro #3, tranche 2).**
  • PublicHeader: backdrop-filter blur+saturate, sfondo semitrasparente, ombra sottile, transizione.
  • Brand mark: gradiente brand→highlight, box-shadow a tema, rotazione leggera al hover.
  • Solo pagine pubbliche; la parte admin resta invariata.
  • Verifica: frontend build OK. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
- **UI/UX pubblico: polish del hero evento e delle card del menu stand (piano di lavoro #3, prima tranche).**
  • Hero evento: overlay più scuro e graduale, padding aumentato, titolo più grande/bold con letter-spacing negativo e text-shadow più marcato.
  • Card del menu stand: aggiunto box-shadow e transizione; hover con lift (-2px) e shadow più pronunciata.
  • Solo pagine pubbliche; la parte admin resta invariata.
  • Verifica: frontend typecheck e build OK. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
- **Slideshow: badge dei contest fotografici (medaglie top-3) sulle foto (piano di lavoro #2).**
  • La slideshow ora recupera i contest fotografici dell'evento e, per ciascuno, il dettaglio con i rank calcolati; le foto che risultano sul podio (rank <= 3) mostrano la medaglia corrispondente (🥇🥈🥉) in alto a destra. Riusa `rankByCount` lato backend (nessun nuovo endpoint).
  • Verifica: frontend typecheck, build e 324 test OK. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
- **QR code: sezione admin per la generazione di tutti i QR (piano di lavoro #1).**
  • Rimossi dalla pagina pubblica dell'evento i pulsanti QR (Evento/Menu) del menu "Altro", che non generavano il QR.
  • Nuova pagina admin `/admin/events/:eventId/qrcodes` ("QR code" nella sidebar, sezione Gestione) che genera e scarica: QR Evento, QR Menu (primo stand visibile), QR Galleria, QR Scatto foto (photo booth), QR Contest evento. Nuovi endpoint `GET /api/events/:eventId/gallery-qrcode` e `.../photo-booth-qrcode`; il QR "scatto foto" apre la pagina evento con `?photoBooth=1` che auto-apre il photo booth.
  • Verifica: backend typecheck e lint OK; frontend typecheck, build e 324 test OK. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
- **Photo contest: il voto è per evento e la scrittura è robusta (niente transazione).**
  • **Bug 1 (Info a 0 voti)**: `votePhotoContest` avvolgeva un singolo `insert` in una transazione Mongoose; su ambienti dove le transazioni falliscono (standalone mongod, timeout) il voto tornava 500 e il pannello «Info» restava a 0. Rimosso `mongoose.startSession()`/`startTransaction()`: l'insert è atomico per documento, e un errore di chiave duplicata (11000, race tra due richieste parallele dallo stesso dispositivo) viene ora tollerato e risponde 403 invece di 500.
  • **Bug 2 (più voti per evento)**: il controllo di voto esistente era per-contest (`findOne({ contestId, deviceIdHash })`), quindi lo stesso dispositivo poteva votare in più contest dello stesso evento. Ora `findDeviceVoteInEvent` cerca su tutti i contest dell'evento → un solo voto per dispositivo per evento (403 «Hai già votato in un altro contest di questo evento: un voto per evento»); `getPhotoContest` espone `hasVoted`/`votedPhotoId` coerenti con quella regola.
  • Verifica: backend typecheck ✓, suite completa **657 test ✓** (58 file), lint 0 errori. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
- **Photo contest: foto storiche senza `type` incluse nel dettaglio e nel voto.**
  • Debito tecnico: `find({ type: 'image' })` escludeva le foto salvate prima dell'introduzione del campo `type` (il default dello schema vale in scrittura, non sui documenti già salvati). Ora `IMAGE_OR_UNTYPED = { $or: [{ type: 'image' }, { type: { $exists: false } }] }` in `getPhotoContest` e `isEligiblePhoto` accetta anche `type` assente/null. Test «accetta foto storiche senza campo type ed esclude i video» copre il caso.
  • Verifica: backend typecheck ✓, suite completa **657 test ✓** (58 file), lint 0 errori. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
- **PWA clienti: rimossi i pulsanti «Esporta social» / «Esporta prodotti» dal menu stand.**
  • Il menu stand (`EventStandMenuPage`) mostrava i pulsanti di export social agli operatori loggati (`canExportSocial && user`); nella build PWA (`/customers/`) la schermata non consente la gestione, quindi i pulsanti sono ora nascosti quando `isCustomersPwa()` è vero (flag di build `VITE_CUSTOMERS_BUILD` + rilevamento del path). Il sito operatore resta invariato.
  • Verifica: frontend typecheck ✓, test `EventStandMenuPage` ✓. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
- **Photo contest: rimosso `PhotoContestEntry` e la route `POST /:contestId/entries` (codice morto).**
  • **Cosa faceva**: solo `PhotoContestEntryModel.deleteMany({ contestId })` e `{ ok: true }` — cancellava record che nessuno leggeva più, perché dal 28 Ott tutte le foto della galleria partecipano al contest e il dettaglio si costruisce da `EventPhoto`. Un endpoint che dichiara di «impostare le foto del contest» e in realtà non cambia niente è peggio del nulla: chi lo chiama (un tool, un test, una futura pagina) crede di aver cambiato i partecipanti e non lo scopre.
  • **Rimosso tutto insieme** — route, `setPhotoContestEntries`, `models/photo-contest-entry.model.ts` e la collezione `photocontestentries` dal reset del DB nei test — perché lasciare `model` + `setup` senza la route avrebbe continuato a dare l'idea che la collezione serva. **Nessun test ha dovuto cambiare**: nessuno nominava la rotta (verificato), il che conferma che era irraggiungibile dall'app.
  • **Docs**: via la riga dalla tabella route in `AGENTS.md`; in `ARCHITECTURE.md` la nota «non aggiungere letture di `PhotoContestEntry`» diventa «il modello non esiste più» (era un avviso contro un errore, ora non c'è più niente da evitare).
  • Verifica: backend typecheck ✓, suite completa **653 test ✓** (58 file), lint 0 errori. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
- **Photo contest: rimosso il flag `requireDevicePhotoMatch` (controllo mai eseguibile).**
  • Il campo confrontava `EventPhoto.takenByDeviceIdHash`, che **nessun percorso di upload scrive**: se attivato avrebbe sempre negato ogni voto con un messaggio fuorviante. Rimosso dal modello contest, dall'allowed list di `updatePhotoContest`, dall'unico blocco in `votePhotoContest` e dal frontend. Rimossi anche i campi orfani `takenByDeviceIdHash` e `takenFromBooth` da `EventPhoto` e il payload `isTakenByThisDevice` dal dettaglio del contest (mai popolati e mai necessari). Il test del dettaglio pubblico ora garantisce esplicitamente che flag e identità dispositivo non vengano esposti. **Nessuna migrazione necessaria**.
  • Verifica: backend typecheck ✓, lint 0, suite **653 test ✓** (58 file); frontend build ✓. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
- **Photo contest: il dettaglio pubblico ora ha i test che gli mancavano (era il percorso rimasto rotto per giorni).**
  • **Il buco**: dopo il 28 Ott `getPhotoContest` era coperto da **un solo** test, il contratto «i voti si nascondono con `showVotesCount` spento». Nessuno caricava la rotta per davvero: `hasVoted`/`votedPhotoId`, `isTakenByThisDevice`, l'elenco delle foto e l'ordine di scatto erano scoperti — ed è esattamente per questo che il 500 `ReferenceError: entries is not defined` è rimasto invisibile per giorni (typecheck rosso, ma nessun test che eseguisse quella funzione).
  • **+5 test** in `integration-photo-contests.test.ts`: (1) tutte le foto della galleria partecipano, in **ordine di scatto**, con i gradini `[2, 1, null]` e `hasVoted`/`votedPhotoId` del dispositivo che ha votato; (2) un altro dispositivo e un anonimo ottengono `hasVoted: false` e `votedPhotoId: null`; (3) `isTakenByThisDevice` vero **solo** per la foto che porta `takenByDeviceIdHash` di quel dispositivo, falso per tutti gli altri; (4) 404 per un contest di un altro evento; (5) `isOpen` falso prima di `startsAt` e dopo `endsAt`.
  • **Test verificati non verdi a vuoto**: invertendo l'ordinamento delle foto falliscono 2 test, restituendo `isTakenByThisDevice: false` ne fallisce 1. Entrambe le mutazioni sono state ripristinate.
  • Verifica: backend typecheck ✓, suite completa **653 test ✓** (58 file, +5), lint 0 errori. Solo file cloud: **nessuna rigenerazione di `distro/local-app.tar` necessaria**.
