# Frontend — Street Food Events App

React SPA for managing street food events, stands, menus and orders. Serves as the operator/admin interface for event organizers and stand staff.

## Features

- Dashboard with favorites, wallet balance, QR code, and management shortcuts
- Public event catalog with detail pages and themed branding
- Public stand menu browsing with online ordering
- Full order management: create, pay (credits + real currency), cancel, track status
- Per-stand order panel with status transitions and counter reset
- Station queue kiosk view (fullscreen, auto-refresh, per-item readiness)
- Admin CRUD pages: events, stands, stations, products, users, staff assignments, event-users
- User profile editing with avatar upload and password change
- Wallet management for event credits (top-up by admins)
- Favorites system for quick access to frequently used events/stands
- Seasonal theming (6 palettes) + per-event custom colors
- Responsive design with SCSS Modules

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build | Vite 8 |
| Language | TypeScript ~6.0 |
| Routing | React Router 7 |
| Styling | SCSS Modules |
| Linting | ESLint (flat config) |

## Prerequisites

- Node.js ≥22
- npm
- Backend server running on `http://127.0.0.1:4000` (or configure proxy in `vite.config.ts`)

## Setup

1. Navigate to `frontend/`:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

   The app runs on `http://localhost:5173`. API calls to `/api/*` are proxied to `http://127.0.0.1:4000`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check then build for production |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build |

## Routes

| Route | Auth | Description |
|---|---|---|
| `/` | Public | Homepage with upcoming events |
| `/login` | Public | Login form |
| `/dashboard` | Protected | User dashboard (favorites, wallet, management links, QR code) |
| `/events` | Public | Event list |
| `/events/:eventId` | Public | Event detail with stand cards |
| `/events/:eventId/stands/:standId` | Public | Stand menu with ordering |
| `/stands` | Public | Stand list |
| `/stands/:standId` | Public | Stand detail |
| `/favorites` | Protected | User favorites |
| `/orders` | Protected | Order list with filters |
| `/orders/new` | Protected | Create new order |
| `/orders/:orderId` | Protected | Order detail |
| `/orders/stand/:standId` | Protected | Stand management panel |
| `/orders/station/:stationId` | Protected | Station queue kiosk (fullscreen) |
| `/profile` | Protected | Edit profile, change password |
| `/staff` | Protected | Staff/station assignments |
| `/events/manage` | Protected | Event CRUD |
| `/stands/manage` | Protected | Stand CRUD |
| `/stations/manage` | Protected | Station CRUD |
| `/products` | Protected | Product CRUD |
| `/event-products` | Protected | Event-product pricing & station mapping |
| `/users` | Protected | User management |
| `/event-users` | Protected | Event-user associations & wallet |
| `/theme-preview` | Protected | Theme preview (temporary) |

## Project Structure

```
frontend/
├── public/                  # Static assets
├── src/
│   ├── main.tsx             # App entrypoint
│   ├── App.tsx              # Root component
│   ├── AppLayout.tsx        # Layout with navbar/footer
│   ├── router.tsx           # Route definitions
│   ├── assets/              # Images, icons
│   ├── components/          # Shared components (Navbar, Avatar, ImageUploader)
│   ├── features/
│   │   ├── auth/            # Auth context, require-auth guard
│   │   └── theme/           # ThemeProvider, useEventTheme
│   ├── lib/                 # API helpers (api.ts, favorites.ts, orders.ts, upload.ts, theme.ts)
│   ├── pages/               # Page components (~20 pages)
│   └── styles/              # Global SCSS, tokens, themes
├── index.html
├── vite.config.ts           # Vite config with API proxy
├── eslint.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── package.json
```

## Theming

The app supports seasonal auto-theming (spring, summer, autumn, winter, christmas, easter) via date detection. Events can override colors with 4 custom fields (brand, text, surface, highlight) that are applied via CSS custom properties and `color-mix()`.

## License

Private — internal project.
