# GUIDA — Street Food Events

Guida di prodotto: **a chi serve l'app, come funziona e perché è fatta così**.
Questo documento descrive il punto di vista dell'utente; per le API e i dettagli tecnici vedi `AGENTS.md`.

| Documento | Versione | Ultimo aggiornamento |
|---|---|---|
| GUIDA — Street Food Events | **1.1** | 1 ottobre 2026 |

La 1.1 introduce i **badge** del visitatore e il **fuso orario dell'evento**. La storia delle modifiche è in `docs/CHANGELOG.md`: questo documento si aggiorna solo quando cambia il *perché* di un flusso, non a ogni novità.

---

## 1. La filosofia

L'app nasce da un problema concreto: **un evento di street food è una macchina che si accende per tre giorni e si spegne.** Non c'è tempo per configurare nulla, non c'è un ufficio, e ognuno fa un pezzo diverso. Tutto il resto discende da nove convinzioni.

### 1.1 L'evento è usa e getta, non un evergreen
Un evento è un **contenitore temporaneo**. Tutta la configurazione (moneta, tema, fasce di commissione, tagli, categorie, sponsor) si duplica con un click in "Duplica evento" per l'edizione dell'anno dopo. I dati operativi — wallet, ordini, transazioni, foto, contest — **non** vengono copiati: sono la storia di quell'evento, non la sua configurazione. Neppure le scadenze si copiano, perché un nuovo evento riparte da zero su quelle.

### 1.2 Il visitatore non installa e non si registra per guardare il menu
L'obiettivo è che tra la piazza e la bocca passino **meno di trenta secondi**: si scansiona un QR, si legge il menu, si ordina dal telefono. Per questo esiste una PWA installabile (con app-shell offline) e non un'app dagli store, e per questo il menu è pubblico e navigabile senza account. **Per ordinare serve però l'accesso**: la registrazione serve a rintracciare l'ordine, non a consultare il menu.

### 1.3 Il credito è una moneta locale, non un pagamento
L'ospite non paga con il POS e non riceve scontrino: **cambia in token al banco cambio** e spende i token. Questo semplifica l'esperienza del visitatore, ti fa risparmiare i costi di commissione per transazione e — soprattutto — rende l'organizzatore **indipendente dal proprio POS**. Il credito esiste solo per quell'evento e non vale nulla fuori.

### 1.4 Si delega per ruolo, non condividendo un account
In un evento working, il gestore del cambio non è il gestore delle foto, non è il cassiere e non è il gestore stand. L'app ha **13 ruoli** su tre ambiti (piattaforma, evento, stand) perché ognuno riceve solo la sua fetta di comandi. Nessuno deve mai "loggarsi con l'account di un altro" per aiutare: è così che i problemi diventano impossibili da attribuire.

### 1.5 Ogni postazione risponde di sé
Ogni cassa ha un **nome, un fondo iniziale e un contenuto proprio**. Chiude quando finisce il turno e riporta il conto. Questo vale sia per le casse stand (ordini) sia per i banchi cambio (crediti), ed è la ragione per cui il Master Cambio mostra tutte le casse affiancate: nessuno risponde per un altro.

### 1.6 Tutto ciò che si conta deve uscire su carta
Si lavora in piazzola, spesso senza rete e senza stampante di rete. Quindi ogni resoconto — vendite, liquidazioni, casse, visitatori — è **stampabile** in un click, pensato per essere archiviato o spedito per email.

### 1.7 I dati del visitatore sono il minimo necessario
Nella coda ordini, nel display pubblico e nel tracking del visitatore **non compaiono nome del cliente né prezzi**. Chi serve sa solo "ordine 42 in preparazione". Il nome del cliente esiste solo dove serve: la cassa che lo serve.

### 1.8 Ogni stand è un'azienda indipendente
Chi possiede uno stand ha i **propri ordini, il proprio menu, il proprio resoconto**. Può lavorare senza mai rivolgersi all'organizzatore, e l'organizzatore non può impedirglielo. È la garanzia che chi compra uno spazio possa continuare a gestirlo anche se l'evento finisce male.

### 1.9 Si premia la presenza, non la spesa
I badge riconoscono quello che un visitatore **fa** — ordina per la prima volta, si muove fra più stand, resta la sera, scatta foto, segue l'evento — e mai **quanto spende**. Il premio è la soddisfazione di essere riconosciuto, non un premio materiale: per questo sono cinque, banali da ottenere, e visibili solo a chi li ha. Un badge che premiasse chi ha speso di più sarebbe il messaggio sbagliato in un evento dove si consumano token, e su un evento di tre giorni l'ultima cosa che l'organizzatore vuole è incentivare a spendere.

---

## 2. I ruoli in sintesi

I ruoli hanno un **ambito** (*scope*): *platform*, *event*, *stand*.

| Ruolo | Ambito | Serve a |
|---|---|---|
| `platform-admin` | platform | Gestisce la piattaforma: eventi, stand, utenti, ruoli, pubblicità, social, configurazione globale |
| `blog-admin` | platform | Gestisce il blog e moderi i commenti |
| `writer` | platform | Scrive articoli del blog (non può cancellare né gestire categorie) |
| `event-admin` | event | Gestisce **un evento**: dati, stand, prodotti, adesioni, riassegnazioni, ordine del menu |
| `exchange-admin` | event | Gestisce il **banco cambio**: casse, crediti, rimborsi, liquidazioni stand |
| `event-cashier` | event | Cassa **unica per l'evento** (ordini di qualunque stand) |
| `contest-admin` | event | Gestisce contest e punti di interesse |
| `photo-admin` | event | Carica e cancella foto/video, gestisce le cornici |
| `photo-print` | event | Vede le foto per poterle stampare |
| `stand-admin` | stand | Gestisce **un singolo stand**: configurazione, menu, ordini, pagamenti |
| `cashier` | stand | Cassa di **un singolo stand** |
| `kitchen` | stand | Cucina: legge il menu e avanza gli ordini |
| `stand-pickup` | stand | Ritiro: legge e aggiorna gli ordini |

Due regole da conoscere:

- **`event-admin` è il ruolo più ampio sull'evento**: chi lo ha non è bloccato dai guard dei ruoli specifici (`exchange-admin`, `contest-admin`…) sul **proprio** evento. Delega bene senza perdere il controllo generale.
- **`platform-admin` è intenzionalmente escluso** da alcune operazioni (per esempio l'approvazione delle adesioni stand), per non poter auto-convalidarsi ciò che dovrebbe convalidare l'organizzatore.

Un utente senza ruoli vede solo il lato pubblico. Chi ha ruoli vede, in area admin, **solo gli eventi per cui ne ha uno** — derivati anche dagli stand posseduti.

---

## 3. Il visitatore (utente)

Il visitatore è l'ospite dell'evento. Non ha ruoli e non vede l'area admin.

**Cosa può fare**

| Azione | Serve accesso? |
|---|---|
| Vedere gli eventi pubblici e la loro pagina | no |
| Sfogliare il menu di uno stand | no |
| **Ordinare** | **sì** |
| Seguire il proprio ordine | sì (QR / link) |
| Scattare foto al photobooth | no |
| Valutare un evento o uno stand | sì, oppure come ospite con nome + email |
| Partecipare ai contest scansionando i POI | no |
| Aggiungere eventi ai preferiti | sì |
| Vedere i propri badge e il progresso di quelli ancora bloccati | sì |

**Il momento critico è l'ordine.** Il menu è una vetrina aperta a tutti; l'ordine richiede l'accesso perché è ciò che lega la persona al biglietto dell'ordine e al tracking. Chi non ha un account può comunque recensire: gli si rilascia un token ospite.

**Il tracking** (`/track/:orderId`) mostra solo l'ordine: cosa contiene e in che stato è. Nessun prezzo, nessun dato del cliente. Quando l'ordine diventa pronto la schermata diventa verde — e su richiesta esplicita dell'utente può suonare e mandare una notifica.

**I badge** sono nella pagina del profilo: si vincono **da soli**, senza che nessuno li assegni, e chi li ha vede la data in cui sono arrivati; chi non li ha ancora vede **a che punto è** ("2 su 3"), perché un obiettivo quasi raggiunto è più motivante di uno lontano. Chi si registra dopo che la feature è esistita li riceve lo stesso, perché il riconoscimento guarda alla **storia** e non al momento in cui è stato scritto il codice. I cinque badge sono globali sull'account e non hanno a che fare con un evento in particolare: sono un curriculum del visitatore, non un premio dell'evento. Nessuno può vedere i badge di un altro, e non esiste una classifica: l'app non mette le persone l'una contro l'altra.

---

## 4. Admin di piattaforma

Vede l'app dall'alto. È il ruolo che vede **tutti** gli eventi, anche quelli di organizzatori terzi.

**Responsabilità**

- **Eventi**: creazione, modifica, duplicazione per la nuova edizione, pubblicazione (pubblico / non pubblico).
- **Stand**: anagrafiche e numerazione. Ogni stand ha un **numero progressivo per evento**, che si ri assegna da un'unica schermata.
- **Utenti e ruoli**: inviti, attivazione, assegnazione dei ruoli per evento e per stand.
- **Sponsor**: sono una configurazione dell'evento, non un'entità a sé.
- **Pubblicità e social**: advertisement trasversali e pubblicazione su Facebook/Instagram.
- **Reset**: azzeramento completo di un evento (ordini, transazioni, liquidazioni, saldi). È un'operazione distruttiva e va confermata due volte.

**Cosa non fa**: non approva le adesioni stand al posto dell'organizzatore, per la regola di cui sopra.

---

## 5. Admin evento

È il ruolo del **gestore della manifestazione**. Configura l'evento e coordina gli stand.

**Configurazione dell'evento**
Identità e descrizione, immagini, date, luogo, sito ufficiale. Poi le impostazioni che definiscono il funzionamento:

- **Moneta dell'evento**: nome, simbolo, tasso di cambio. Da qui dipende tutto il resto.
- **Tagli di valuta**: le denominazioni accettate dal banco cambio.
- **Fasce di commissione**: percentuali e quote fisse applicate sulle liquidazioni. Una fascia senza tetto copre gli incassi eccedenti le altre.
- **Tema colore**: si applica alle pagine e alle postazioni dell'app locale.
- **Fuso orario**: da cui dipende tutto ciò che ragiona sull'ora locale dell'evento. Per un evento italiano non serve quasi mai cambiarlo, ma per un evento serale all'estero sì.
- **Adesione stand**: apertura, scadenza e regolamento. Se manca il regolamento, l'adesione non si può inviare.
- **Sponsor e partner**: si caricano in anticipo con `enabled` spento e si accendono quando l'accordo è firmato.

**Operatività**
- **Stand dell'evento**: approvare le adesioni (creando lo stand e assegnando il suo ruolo al richiedente), rifiutare o chiedere integrazioni, rinumerare.
- **Prodotti e menu**: catalogo e categorie, con riordino.
- **POI e contest**: punti di interesse, regole di estrazione automatica e QR.
- **Casse stand**: il Master Cambio vede tutte le casse aperte e chiuse, con fondi e contenuti.

**La delega è il punto chiave.** Il gestore evento non deve fare il lavoro in prima persona: assegna `exchange-admin` a chi gestisce i crediti, `photo-admin` a chi gestisce le foto, `event-cashier` a chi gestisce la cassa unica. Lui resta il responsabile complessivo.

---

## 6. Gestore stand

Possiede uno o più stand. Per lui l'app è un'azienda, e non ha bisogno dell'organizzatore per lavorare.

**Cosa gestisce**

- **Profilo dello stand**: nome, descrizione, immagine di copertina, categorie.
- **Menu e prodotti**: cosa vende e a quanto (i prezzi sono in crediti dell'evento).
- **Ordini**: riceve, avanza gli stati, marca i prodotti come pronti, stampa la ricevuta.
- **Cassa**: apre la sua postazione, incassa in contanti, con POS o in crediti. Ogni postazione ha la sua cassa.
- **Resoconto**: il venduto per prodotto, distinguendo i prodotti in omaggio (che non generano fatturato) e la parte incassata col POS.
- **Il rapporto con l'ordine è diretto**: chi ha creato l'ordine è il proprietario della ricevuta, quindi non serve alcun intermediario per stamparla o cancellarlo.

**Liquidazione**: quando l'evento chiude, il gestore stand **non incassa in autonomia**. Va in liquidazione presso il `exchange-admin`, che converte i crediti guadagnati in euro applicando la commissione prevista dall'evento. La liquidazione può andare in due direzioni:

- **AVERE** — lo stand ha crediti e riceve euro (è il caso normale).
- **DARE** — si caricano crediti allo stand, senza pagamento in euro (per es. un reso o una correzione).

La percentuale e la quota fissa si applicano sul **lordo di quella singola liquidazione**; chi opera può sovrascriverle al volo quando serve, e la sostituzione resta tracciata nel campo `feeSource`.

---

## 7. L'operatore

Non "amministra": **usa**. Ha un compito preciso per turno. È il ruolo più diffuso e quello in cui l'app deve essere più veloce.

| Ruolo | Cosa fa, schermata |
|---|---|
| `cashier` | Cassa dello stand: prende ordini, incassa, stampa ricevuta |
| `kitchen` | Cucina: legge gli ordini e segna what's pronto |
| `stand-pickup` | Ritiro: legge gli ordini e li consegna |
| `exchange-admin` | Banco cambio: carica crediti, rimbrosa, gestisce le casse e le richieste alla cassa master |
| `event-cashier` | Cassa unica: ordini di tutti gli stand dell'evento |
| `photo-print` | Stampa le foto ai visitatori |
| `photo-admin` | Carica e cancella foto e cornici |

**Il flusso dell'ordine, nella sua forma tipica**
1. **Cassa** — il cassiere prende l'ordine e lo incassa (contanti, POS, o crediti se l'ospite ha converts). L'ordine entra in *preparing*.
2. **Cucina** — segna i prodotti come pronti uno a uno.
3. **Display / coda** — lo stand espone la coda a uno schermo, aggiornata da sola ogni pochi secondi.
4. **Consegna** — l'ordine passa a *ready* e resta in coda per un tempo limitato, poi sparisce.
5. **Notifica** — al cliente arriva l'avviso che è pronto (schermata e, se l'ha chiesto, notifica push).

**Il banco cambio è un caso a parte** perché ha una catena di fiducia. Ogni postazione apre la **propria** cassa con un nome; alla fine del turno la chiude e il fondo torna al banco master. Se il contenuto scende sotto la soglia di sicurezza, la postizione **manda da sola la richiesta** di rifornimento. Le richieste sono mono-valuta per scelta: una richiesta di euro e una di crediti restano due richieste distinte, perché accorparle nasconderebbe al cassiere master che cosa è stato davvero chiesto.

**La foto, infine, è un flusso a parte dal cibo**: il photobooth compone la foto con cornice e hashtag e la rende subito scaricabile. Chi stampa non ha permessi di cancellazione; chi amministra le foto sì.

---

## 8. Il denaro in sintesi

Tre conti distinti, spesso confusi. Tenerli separati è la regola.

| Contatore | Cosa misura | Chi lo tocca |
|---|---|---|
| **Ordini** | Cosa è stato venduto e come è stato pagato (contanti / POS / crediti) | cassa stand o cassa unica |
| **Banco cambio** | Quanti crediti sono entrati e usciti, e quanto denaro c'è in cassa | `exchange-admin` |
| **Liquidazione** | Quanto euro spetta allo stand sui crediti guadagnati | `exchange-admin`, dopo l'evento |

Due conseguenze pratiche che vale la pena ricordare:

- **I POS non passano dalla cassa.** Il POS alimenta i **report**, non il contenuto fisico del cassino. Il contenuto si muove solo con i flussi `cash`.
- **Il saldo del visitatore è unico per evento**, non per cassa. Un rimborso dato dalla cassa 2 può rimborsare crediti caricati alla cassa 1: è lo stesso portafoglio.

---

## 9. Glossario

| Termine | Significato |
|---|---|
| **Evento** | La manifestazione, con la sua moneta, le sue regole e le sue scadenze |
| **Stand** | Il banco di un venditore; può partecipare a più eventi |
| **Numero stand** | Progressivo **per evento**: serve a mappa, menu e volantino |
| **Credito / token** | Moneta locale dell'evento (1 token = 1€ × tasso) |
| **Banco cambio** | Il punto in cui si caricano e rimborsano crediti |
| **Cassa** | Registro fisico di una postazione, con fondo e contenuto |
| **Fondo cassa** | Il denaro/crediti con cui si apre la cassa |
| **Contenuto** | Quanto c'è in cassa **dentro**, al netto del fondo |
| **Liquidazione** | La conversione dei crediti guadagnati dallo stand in euro |
| **POI** | Punto di interesse di un contest |
| **Cornice** | Bordo grafico applicato alle foto del photobooth |
| **Omaggio** | Ordine senza pagamento: conta nei prodotti, non nel fatturato |
| **Adesione** | Domanda di partecipazione di uno stand, con i propri stati |
| **Badge** | Riconoscimento che il visitatore si assegna da solo; nessuno lo concede e nessuno può premiare in base alla spesa |
| **Fuso orario dell'evento** | Da quale ora locale si misura l'evento; gli orari sono salvati in UTC e convertiti con questo |