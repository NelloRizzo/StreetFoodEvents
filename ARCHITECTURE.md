# ARCHITECTURE — Street Food Events

Considerazioni progettuali e decisioni architetturali.

## Theming System
- **Seasonal themes**: 6 palettes (spring, summer, autumn, winter, christmas, easter) auto-applied via date detection (Easter via Computus, Christmas 15 Dec–6 Jan, meteorological seasons).
- **Per-event colors**: 4 custom fields (themeBrand, themeText, themeSurface, themeHighlight) on Event model + color pickers in EventsPage form. CSS `color-mix()` derives soft/deep/line/glow from these 4.
- **Architecture**: `ThemeProvider` wraps app in `main.tsx`, applies `.theme-*` class on `<html>`; `useEventTheme` hook applies `[data-event-theme]` + inline `--theme-*` vars per component.

## Printing approach
- **Window.print() su HTML puro**: per stampare senza conflitti CSS SPA, si usa `window.open('', '_blank')`, si scrive HTML puro con `document.write()`, si chiama `window.print()` + `window.close()`. Evita problemi di `min-height: 100vh` e `overflow: hidden` di React/SPA.

### Flyer page — lessons learned
- **React Page dentro SPA (FlyerPage) con reset CSS aggressivo** è la soluzione adottata.
- **Cosa NON fare**:
  - Non usare server custom (`server.js`) — il problema è solo CSS, non va risolto a livello di routing/serving
  - Non usare HTML standalone in `public/` se servito da `serve -s` — `serve` single-page mode non serve file da subdirectory
  - Non dimenticare di override `min-height: 0 !important` su `#root` e `body` nel `@media print` di pagine che devono stampare

### Menu Print
- **Pagina React dentro AppLayout** per la selezione (evento → stand checkbox), poi finestra HTML puro per la stampa A3 landscape.
- `@page { size: A3 landscape; margin: 1cm }` + `page-break-before: always` tra stand.

## Map & Location
- **Per-event stand locations**: array `locations[{ eventId, location }]` sul modello Stand per supportare posizioni diverse per ogni evento.
- **MapPicker**: componente Leaflet riutilizzabile con marker draggabile SVG custom brand `#bf5a2a`.
- **Tile layer**: Esri World_Street_Map (mappa) e World_Imagery (satellite), maxZoom 20-22.

## Printer-agent (rimosso Jul 2026)
- Il progetto `printer-agent/` è stato eliminato.
- La stampante termica si collega direttamente alla macchina Windows della cassa.
- La stampa avviene via `window.print()` con HTML puro — nessun ESC/POS, nessun Raspberry Pi.

## Auth
- Session token in httpOnly cookie named `sid` (configurable). `argon2` for password hashing.
- `auth.middleware` validates on every protected route.
- Frontend: `AuthContext` wraps the app, calls `GET /api/auth/me` on mount.

## Backend
- Express + Mongoose + argon2 session auth. ESM, TypeScript, Node ≥22.
- MongoDB requires a replica set (`replicaSet=rs0`) because Mongoose transactions are used.
- Path alias: `@/*` maps to `./src/*`.
- Env vars validated at startup via Zod. Missing vars cause immediate `process.exit(1)`.
- Cloudinary for all image uploads.

## Reports & aggregations
- **Stand report** (`GET /orders/report/stand/:standId`): aggregazione per singolo stand, usata in StandOrdersPage.
- **Event report** (`GET /orders/report/event/:eventId`): aggregazione per tutti gli stand di un evento, con split contanti (`total - creditAmountUsed`) e crediti (`creditAmountUsed`).
- **Permessi**: event report accessibile solo a ruoli `event-admin` e `event-cashier` (oltre a `platform-admin`).
- **Cassa unica**: il flag `unifiedCashierEnabled` nell'evento determina se mostrare la colonna contanti nel report.
- **Cash disabled**: se `cashPaymentsEnabled = false`, il report mostra solo colonna crediti.

## Navbar grouping
- La Navbar raggruppa le voci in dropdown per ambito: **Piattaforma** (admin), **Ordini**, **Resoconti**, **Personale**.
- Ogni dropdown ha `useRef` + `handleClickOutside` per chiusura.
- Gli event items dinamici sono un dropdown separato "Eventi" a sé stante.

## Alias / Link brevi
- **Modello Alias**: `{ text (unique, lowercase, regex ^[a-z0-9_-]+$), entityType ('event'|'stand'), entityRef (ObjectId) }`
- **CRUD**: `/api/aliases` — tutte le route sono protette (authMiddleware). Filtrabili per `?entityType=&entityRef=`.
- **Resolve pubblico**: `/api/resolve/:entityType/:alias` → JSON con `{ entityType, entityId, entityName }`. Nessuna auth.
- **Frontend redirect**: la rotta `/show/:entityType/:alias` è gestita dalla SPA. `AliasRedirectPage` chiama la resolve API e fa `window.location.href` verso la pagina reale. Scelta architetturale: con frontend e backend come servizi separati su Render, un 303 lato server richiederebbe di escludere `/show/*` dal catch-all della SPA.
- **AliasManager**: componente riutilizzabile che mostra la lista alias e permette aggiunta/eliminazione. Usato in EventDetailPage e StandDetailPage.
- **Cosa NON fare**: non permettere caratteri speciali come `#`, `?`, spazi nell'alias — causerebbero problemi di parsing URL. La regex `^[a-z0-9_-]+$` è restrittiva di proposito.

## Photo Gallery
- **Modelli separati**: `EventPhoto` (image, sequenceNumber, frameId, takenAt) e `EventFrame` (name, image overlay PNG).
- **SequenceNumber auto-incrementale**: calcolato come `max(seq) + 1` per evento all'upload. Pattern nel controller, non usa CounterModel (dedicato agli ordini).
- **Cloudinary folder**: `events/{eventId}/photos/` e `events/{eventId}/frames/`. Upload diretto nei controller con `uploadImageBuffer`.
- **API nidificate**: montate in `app.ts` come `app.use('/api/events/:eventId/photos', eventPhotosRouter)` con `mergeParams: true` per ereditare `eventId`.
- **Permessi**: `POST /photos` richiede solo auth (chiunque può caricare). `DELETE /photos` (massiva) richiede `photo-admin` o `platform-admin`. `DELETE /photos/:photoId` richiede solo auth. `POST /frames` e `DELETE /frames/:frameId` richiedono `photo-admin`.
- **Ruoli in seed**: `photo-admin` (scope event, permessi photos:read/create/delete, frames:read/create/delete). `photo-print` (scope event, solo photos:read).
- **Stampa galleria**: finestra HTML pura via `window.open()` + `document.write()` + `window.print()`, stesso pattern del Menu Print e della ricevuta. Evita conflitti CSS SPA.
- **Cosa NON fare**: non eliminare foto da Cloudinary senza prima cancellare il record DB — il controller fa prima `findOneAndDelete` poi `deleteImage`. Non usare `fs` per le foto — tutto su Cloudinary.

## Frontend
- React 19 + Vite 8 + TypeScript ~6.0 + SCSS Modules + React Router 7.
- Vite proxy: `/api` → `http://127.0.0.1:4000`.
- No `@/*` alias — imports are relative.
- SCSS uses `@use` for token imports (`_tokens.scss`), not `@import`.
- Build runs typecheck first (`tsc -b`), so type errors block the build.
