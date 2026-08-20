# Street Food Events — Descrizione Applicazione

## Panoramica Generale

**Street Food Events** è un sistema completo di gestione di eventi enogastronomici per street food. L'applicazione permette di organizzare eventi con stand di diversi tipi (food, artigianato, divertimento), gestire ordini, pagamenti, galleria fotografica, contest interattivi e liquidazioni finanziarie.

## Architettura del Sistema

### Stack Tecnologico
- **Backend**: Express.js + Mongoose + TypeScript, Node.js ≥22
- **Frontend**: React 19 + Vite 8 + TypeScript + SCSS Modules
- **Database**: MongoDB (con replica set per transazioni)
- **Auth**: Sessioni httpOnly cookie con argon2
- **Storage**: Cloudinary per immagini e video
- **Deploy**: Render (piano free, regione Frankfurt)

### Componenti Principali

#### 1. Gestione Eventi
- **Modello Event**: nome, localizzazione geografica (GeoJSON), date inizio/fine, valuta personalizzata (nome + simbolo), tasso di cambio, temi personalizzabili, descrizioni HTML, immagini
- **Visibilità**: campo `isPublic` per nascondere eventi dalla parte pubblica mantenendo la gestibilità per gli operatori
- **Dashboard duali**: vista "Utente" (eventi pubblici) e vista "Operatore" (gestione completa)

#### 2. Gestione Stand
- **Tipologie**: `food` (cibo), `artigianato` (artigianato), `divertimento` (divertimento)
- **Multi-evento**: uno stand può partecipare a più eventi con numerazione progressiva separata per ogni evento
- **Posizionamento**: coordinate GPS per ogni evento, visibilità mappa configurabile
- **Postazioni**: stazioni di lavoro all'interno dello stand (cucina, griglia, bevande, ecc.)

#### 3. Menu e Prodotti
- **EventProduct**: prodotti specifici per evento+stand con prezzo personalizzato
- **Supporto multimediale**: immagini di copertina, galleria, ingredienti
- **Disponibilità**: toggle per attivare/disattivare prodotti
- **Ordinamento**: riordinamento drag-and-drop con sequenza personalizzata

#### 4. Sistema Ordini
- **Flusso completo**: creazione → conferma → preparazione → pronto → ritiro
- **Pagamento misto**: crediti virtuali + contanti
- **Ordini omaggio**: ordini gratuiti con badge "OMAGGIO" e contatore soglia (5%)
- **Ricevute**: generazione automatica con QR code
- **Display pubblico**: coda ordini in tempo reale per ogni stand

#### 5. Sistema Valutario (Exchange)
- **Valuta personalizzata**: ogni evento ha la sua valuta (es. "Tokens", "Gettoni")
- **Tasso di cambio**: conversione EUR ↔ valuta evento
- **Wallet utenti**: caricamento (top-up) e rimborso crediti
- **Transazioni**: storico completo con tracciamento operatore

#### 6. Liquidazione Stand
- **Modello StandSettlement**: calcolo automatico lordo €, trattenuta, erogato
- **Direzione**: DARE (carico crediti) / AVERE (pagamento euro)
- **Snapshot**: tasso di cambio salvato al momento della liquidazione
- **Report**: riepilogo aggregato per evento con totali

#### 7. Galleria Fotografica
- **Media**: foto e video con upload su Cloudinary
- **Cornici**: overlay PNG per foto con stile personalizzato
- **Sequenza**: numerazione incrementale condivisa
- **Slideshow**: riproduzione automatica con controlli velocità
- **Foto booth**: scatto webcam con anteprima cornice
- **Email**: invio foto multiple a un indirizzo

#### 8. Contest e POI
- **ContestPOI**: punti di interesse per caccia al tesoro
- **QR Code**: scansione per registrazioni progressi
- **Partecipazione anonima**: UUID salvato in localStorage
- **Premiazione**: premi multipli con assegnazione automatica
- **Pool sincronizzato**: POI auto-generati da stand e POI evento

#### 9. Sistema Ruoli
- **Ruoli piattaforma**: `platform-admin` (amministratore totale)
- **Ruoli evento**: `event-admin`, `event-cashier`, `event-manager`
- **Ruoli stand**: `cashier`, `station-manager`, `pickup`
- **Ruoli speciali**: `photo-admin`, `photo-print`, `contest-admin`, `exchange-admin`

#### 10. Notifiche Email
- **EmailSubscription**: raccolta consensi GDPR
- **Invio foto**: email con immagini dalla galleria
- **Consenso tracciato**: timestamp, IP, fonte

## Flussi Utente Principali

### Organizzatore Evento
1. Crea evento con date, localizzazione, valuta personalizzata
2. Aggiunge stand (food/artigianato/divertimento) con posizioni mappa
3. Configura menu prodotti per ogni stand
4. Gestisce ordini e resoconti
5. Esegue liquidazioni a fine serata
6. Gestisce galleria foto e contest

### Gestore Stand
1. Accede alla cassa per il proprio stand
2. Crea ordini clienti (contanti/crediti/omaggio)
3. Gestisce postazioni di lavoro
4. Visualizza coda ordini in tempo reale
5. Consulta report vendite

### Cliente/Partecipante
1. Naviga menu pubblico stand
2. Ordina prodotti (online o da operatore)
3. Partecipa a contest (scansione QR)
4. Visualizza galleria foto
5. Riceve foto via email

### Operatore Cambio
1. Gestisce wallet clienti (carica/rimborsa crediti)
2. Esegue liquidazioni stand
3. Consulta transazioni e saldi

## Interfacce Pubbliche

- **Home**: eventi in programma con data/ora
- **Menu Stand**: `/events/:eventId/stands/:standId` (navigazione tra stand)
- **Mappa Evento**: `/events/:eventId/map` (Leaflet con marker numerati)
- **Galleria**: `/events/:eventId/galleria` (foto + video + slideshow)
- **Contest**: `/events/:eventId/contests` (lista + play + verifica)
- **Ricevuta**: ordine singolo con QR code
- **Alias**: `/show/:entityType/:alias` (link brevi)

## API REST Principali

### Autenticazione
- `POST /api/auth/login` — Login
- `POST /api/auth/register` — Registrazione
- `GET /api/auth/me` — Utente corrente

### Eventi
- `GET /api/events` — Lista eventi
- `POST /api/events` — Crea evento
- `PATCH /api/events/:eventId` — Modifica evento
- `DELETE /api/events/:eventId` — Elimina evento

### Stand
- `GET /api/stands` — Lista stand
- `POST /api/stands` — Crea stand
- `PATCH /api/stands/:standId` — Modifica stand
- `PATCH /api/stands/reorder` — Riordina stand per evento

### Ordini
- `POST /api/orders` — Crea ordine
- `GET /api/orders/stand/:standId` — Ordini per stand
- `PATCH /api/orders/:orderId/status` — Aggiorna stato
- `GET /api/orders/stand/:standId/ordersqueue` — Coda pubblica

### Cambio Valuta
- `POST /api/exchange/:eventId/top-up` — Carica crediti
- `POST /api/exchange/:eventId/refund` — Rimborsa crediti
- `GET /api/exchange/:eventId/balance` — Saldo cassa

### Liquidazioni
- `POST /api/exchange/:eventId/settlements` — Crea liquidazione
- `GET /api/exchange/:eventId/settlements` — Storico liquidazioni
- `GET /api/exchange/:eventId/settlements/report` — Report aggregato

## Modelli Dati Principali

### Event
```typescript
{
  name: string;
  location: { type: 'Point', coordinates: [number, number] };
  startDate: Date;
  endDate: Date;
  currencyName: string;
  currencySymbol: { url: string; publicId: string };
  exchangeRate: number; // 1 EUR = X valuta evento
  isPublic: boolean;
  cashPaymentsEnabled: boolean;
  unifiedCashierEnabled: boolean;
}
```

### Stand
```typescript
{
  type: 'food' | 'artigianato' | 'divertimento';
  name: string;
  slogan: string;
  description: string;
  eventIds: ObjectId[];
  locations: [{ eventId: ObjectId; location: Point }];
  numbers: [{ eventId: ObjectId; number: number; showOnMap: boolean }];
  coverImage: Image;
  gallery: Image[];
}
```

### Order
```typescript
{
  eventId: ObjectId;
  standId: ObjectId;
  stationId: ObjectId;
  userId: ObjectId;
  items: [{ eventProductId: ObjectId; quantity: number; unitPrice: number; subtotal: number }];
  total: number;
  creditAmountUsed: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  isGift: boolean;
  readyAt: Date;
}
```

### StandSettlement
```typescript
{
  eventId: ObjectId;
  standId: ObjectId;
  standName: string;
  amount: number; // crediti
  exchangeRate: number; // snapshot
  direction: 'debit' | 'credit';
  feePercent: number;
  grossEuro: number;
  feeEuro: number;
  payoutEuro: number;
  description: string;
  performedByUserId: ObjectId;
  occurredAt: Date;
}
```

## Pattern Architetturali

### Autenticazione
- Cookie httpOnly `sid` con argon2
- `optionalAuthMiddleware` per endpoint pubblici che filtrano per utente
- Ruoli con scope (platform, event, stand)

### Transazioni MongoDB
- Replica set obbligatorio
- Await sequenziali (MAI Promise.all) dentro transazioni
- Rollback automatico su errore

### Upload Media
- Multer per multipart form data
- Cloudinary per storage
- Resource type awareness (image/video)

### Stampa
- Pattern `window.print()` con HTML puro
- Evita conflitti CSS SPA
- Usato per: menu, ricevute, galleria, flyer

### Mappa
- Leaflet con tile Esri (satellite + mappa)
- Marker numerati con badge circolare
- MapPicker riutilizzabile con marker draggabile

## Regole di Business

### Ordini Omaggio
- Total = 0, paymentStatus = 'paid'
- Articoli mantengono prezzo reale per conteggi
- Soglia 5%: contatore diventa rosso
- Esclusi da fatturato e ordini pagati nei resoconti

### Liquidazioni
- Report solo informativo (nessun check saldo)
- Snapshot exchangeRate al momento della liquidazione
- Valori euro calcolati e memorizzati (no ricalcolo)

### Contest
- orderedPOIIds può contenere duplicati
- Occurrence-based marking (non Set/includes)
- Completamento = scannedPOIIds.length === orderedPOIIds.length

## Testing

- **Backend**: 249 test (Vitest)
- **Frontend**: 16 test (Vitest)
- **Typecheck**: TypeScript strict mode
- **Lint**: ESLint flat config

## Deploy

- **Render**: due servizi web (backend + frontend)
- **Build**: `npm run build` (tsup backend, tsc + vite frontend)
- **Ignored Paths**: `docs/**` non attiva deploy

## Gotchi Noti

1. MongoDB richiede replica set
2. Path alias `@/*` solo backend (non frontend)
3. SCSS usa `@use` non `@import`
4. Build frontend esegue typecheck prima
5. Transazioni Mongo: solo await sequenziali
6. Cloudinary delete: sempre con resource_type corretto
7. Liquidazioni NON entrano in getBalance
8. EventUserTransaction.userId è nullable
9. Contest.orderedPOIIds ammette duplicati
10. StandSettlement.direction: default 'credit'