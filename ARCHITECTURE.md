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

## ESC/POS Printer Agent (progetto in sospeso)
- **Branch**: `feature/escpos-bluetooth`
- **Architettura**:
  ```
  Tablet (cassa Chrome Android) → WiFi → Raspberry Pi Zero W (:9300) → USB → Stampante termica
  ```
- **Principi**:
  - Generazione ESC/POS sul Pi, non nel backend cloud (funziona offline)
  - Zero dipendenze native: `/dev/usb/lp*` accessibile via `fs.writeFileSync`
  - Fallback a `window.print()` se agente irraggiungibile
  - IP statico via DHCP reservation, niente mDNS

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

## Frontend
- React 19 + Vite 8 + TypeScript ~6.0 + SCSS Modules + React Router 7.
- Vite proxy: `/api` → `http://127.0.0.1:4000`.
- No `@/*` alias — imports are relative.
- SCSS uses `@use` for token imports (`_tokens.scss`), not `@import`.
- Build runs typecheck first (`tsc -b`), so type errors block the build.
