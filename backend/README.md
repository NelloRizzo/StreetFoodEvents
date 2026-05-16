# Backend — Street Food Events API

REST API for managing street food events, stands, menus, roles, orders and user authentication.

## Features

- User authentication via httpOnly cookie sessions (argon2 password hashing)
- Role-based access control (platform, event, stand scopes)
- Event CRUD with custom theming (brand, text, surface, highlight colors)
- Stand & station management with per-event product pricing
- Product catalog with cover image, gallery, ingredients, and station assignments
- Order management with status workflow (`pending → confirmed → preparing → ready → completed`)
- Mixed payment system (event credits + real currency)
- Per-order-item station readiness tracking with atomic counter-based order numbering
- Wallet system with top-up, payment, and refund transactions
- QR code generation for user identification, event pages and stand pages
- Self-registration endpoint (`POST /api/auth/register`) with auto-login
- Cloudinary image upload (products, avatars, galleries)
- Per-stand order reports (simple summary and detailed transaction lists)
- HTML sanitization for rich text descriptions
- Favorites system (events and stands)

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥22 |
| Framework | Express 4 |
| Language | TypeScript |
| Database | MongoDB + Mongoose 8 (replica set required for transactions) |
| Auth | argon2 + httpOnly cookies |
| Validation | Zod |
| Uploads | Cloudinary + multer |
| QR | qrcode |
| Build | tsup (bundler) |

## Prerequisites

- Node.js ≥22
- MongoDB with replica set enabled (`replicaSet=rs0`)
- Cloudinary account (for image uploads)
- npm

## Setup

1. Clone the repository and navigate to `backend/`:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (see `.env.example` at repo root):
   ```env
   NODE_ENV=development
   PORT=4000
   AUTH_SESSION_COOKIE_NAME=sid
   AUTH_SESSION_TTL_HOURS=12
   CLIENT_URL=http://localhost:5173
   MONGODB_URI=mongodb://localhost:27017/street_food_events
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```

## Seed Data

Populate the database with sample events, stands, stations, products, users and orders:

```bash
npm run populate:database
```

Test credentials after seeding:

| Role | Email | Password |
|---|---|---|
| Admin | `giulia.ferri@streetfoodevents.test` | `Password123!` |
| Cashier | `marco.conti@streetfoodevents.test` | `Password123!` |
| Kitchen | `sara.leoni@streetfoodevents.test` | `Password123!` |
| Customer | `luca.rinaldi@streetfoodevents.test` | `Password123!` |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with auto-restart |
| `npm run build` | Bundle with tsup to `dist/` |
| `npm run start` | Run production build |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint (no config yet — may fail) |
| `npm run format` | Prettier formatting |
| `npm run test` | Run vitest tests |
| `npm run populate:database` | Seed database with sample data |

## API Overview

| Prefix | Auth | Description |
|---|---|---|
| `GET /health` | No | Health check |
| `/api/auth/*` | Mixed | Login (public), logout, me, QR, profile update |
| `/api/events/*` | Mixed | GET public, rest protected — event CRUD |
| `/api/stands/*` | Mixed | GET public, rest protected — stand CRUD |
| `/api/stations/*` | Mixed | GET public, rest protected — station CRUD |
| `/api/products/*` | Mixed | GET public, rest protected — product CRUD |
| `/api/users/*` | Protected | User management |
| `/api/event-users/*` | Protected | Event-user associations & wallet |
| `/api/event-products/*` | Protected | Event-specific product pricing & station mapping |
| `/api/favorites/*` | Protected | User favorites (events & stands) |
| `/api/orders/*` | Protected | Order CRUD, payment, cancellation, station readiness, reports |
| `/api/upload/*` | Protected | Image upload/delete via Cloudinary |

## Project Structure

```
backend/
├── src/
│   ├── app.ts              # Express app setup (middleware, routes)
│   ├── server.ts           # Entrypoint — starts HTTP server
│   ├── config/             # Env validation (Zod), DB connection
│   ├── controllers/        # Route handlers
│   ├── middlewares/        # Auth middleware, error handler
│   ├── models/             # Mongoose schemas & models
│   ├── routes/             # Express routers
│   ├── scripts/            # Database seed scripts
│   ├── services/           # Business logic (auth, wallet, cloudinary)
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Helpers (async handler, session, sanitizer)
├── dist/                   # Compiled output
├── .env                    # Environment variables (not committed)
└── package.json
```

## License

Private — internal project.
