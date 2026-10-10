# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal Finance Tracker — a full-stack PWA with a Node.js/Express/Prisma backend and a React/Vite/Tailwind frontend. Supports transactions, wallets, categories, and stats, with cookie-based JWT auth (access + refresh tokens), Redis session storage, and WebAuthn-based biometric unlock. Email verification is disabled: registration creates a verified account and signs the user in.

---

## Development Commands

### Full Stack via Docker (preferred for integration testing)
```bash
make setup        # First-time: create traefik-public Docker network
make infra        # Start only PostgreSQL (:6500) and Redis (:6379) for local dev
make dev          # Full dev env in Docker (with hot-reload frontend)
make prod         # Full prod env in Docker
make stop         # Stop all containers
make status       # Show container status
make logs-f       # Follow all logs
```

### Backend (local)
```bash
cd backend
npm run start           # ts-node-dev with --respawn --transpile-only (dev server)
npm run build           # tsc compile to dist/
npm run test            # Jest (NODE_ENV=development)
npm run test:watch      # Jest watch mode
npm run test:int        # Integration scenarios (tests/*.int.ts) against real Postgres + Redis; needs `make infra`
npx prisma migrate dev  # Create + run a migration
npm run db:push         # Push schema changes without migration
npm run db:seed         # Run prisma/seed.ts
```

Run a single backend test file:
```bash
cd backend && npx jest tests/auth.spec.ts
```

### Frontend (local)
```bash
cd client
npm run dev         # Vite dev server (http://localhost:5173)
npm run build       # tsc + vite build
npm run lint        # ESLint
npm run test        # Vitest (watch)
npm run test:run    # Vitest (single run, CI)
npm run test:ui     # Vitest browser UI
npm run test:e2e    # Playwright (e2e/*.e2e.ts): real browser + own backend on :8010 / Vite on :5180; needs `make infra`
```

Run a single frontend test file:
```bash
cd client && npx vitest run src/test/Login.test.tsx
```

---

## Architecture

### Backend (`backend/src/`)
Layered Express app following the pattern: **Routes → Controllers → Services → Prisma**

- `app.ts` — bootstraps Express, registers all routes under `/api/*`, sets up pug views for email templates. Sets `TZ=Asia/Seoul` (month/year filters are built in server-local time) and `trust proxy` (Traefik)
- `routes/` — route definitions, apply `deserializeUser` + `requireUser` middleware for protected endpoints, and `validate(schema)` for request validation
- `controllers/` — parse request, delegate to service, return JSON response
- `services/` — all Prisma queries live here; no DB access in controllers
- `services/ai.service.ts`: the only Gemini caller (`@google/genai`, JSON-schema output, 20s timeout, untrusted input kept out of the system instruction); `services/capture.service.ts`: deterministic rules turning the AI's labels into a transaction draft (wallet/currency, "Other" category, date window). `POST /api/capture/text` (iOS Shortcut, personal API token via `middleware/requireApiToken.ts`) saves; `POST /api/capture/photo` (session) returns a draft only. `GEMINI_API_KEY` unset → 503. See `docs/shortcut-setup.md`.
- `schemas/` — Zod schemas for input validation (used by the `validate` middleware)
- `middleware/deserializeUser.ts` — extracts `access_token` cookie (or Bearer header), verifies JWT via RS256, checks Redis session, attaches user to `res.locals.user`
- `middleware/prismaMiddleware.ts` — shared PrismaClient, balance-adjustment helpers, and a `Decimal.toJSON` override so money fields serialize as JSON numbers
- `middleware/requireUser.ts` — gate after deserializeUser; 403 if no user
- `utils/jwt.ts` — RS256 sign/verify using base64-encoded keys from `config/`
- `utils/connectRedis.ts` — Redis client used for session storage (keyed by user ID)
- `config/` — uses the `config` npm package; `default.ts` for base values, `production.ts` overrides, `custom-environment-variables.ts` maps env vars to config keys

**Auth flow**: Login/register → sign accessToken (2h) + refreshToken (30 days) → both set as HttpOnly cookies (no tokens in the response body). With `rememberMe: false` the refresh cookie is a session cookie. On 401/403 the axios interceptor calls `/api/auth/refresh`, which re-sets the access cookie.

**Sessions**: Each login gets a session id (`sid`, carried in both JWTs); the user object is stored in Redis under `session:<userId>:<sid>`. `deserializeUser` checks that key on every protected request. Logout deletes only that device's session; password reset deletes all of the user's sessions.

### Frontend (`client/src/`)

- `main.tsx` → `App.tsx` wraps providers (`ThemeProvider`, `AuthProvider`) → `Router.tsx` sets up routes
- `Router.tsx` — protected routes nested under `<ProtectedRoutes>` which checks `useAuth().user`; auth pages (`/login`, `/register`) shown only when unauthenticated
- `contexts/auth.context.tsx` — single source of auth state; handles login, register, logout, biometric unlock, and a 30-min inactivity logout that applies only when "Remember me" was not checked
- `lib/axios.ts` — Axios instance with `VITE_API_URL` base URL and `withCredentials`; response interceptor auto-refreshes on 401/403 and redirects to `/login` on refresh failure
- `hooks/` — custom hooks manage all data fetching (useState + useEffect pattern, no React Query). Each hook exposes `{ data, loading, error, refetch }`. Offline caching is handled inside `useTransactions`/`useStats` via `useOffline`, keyed per query (cleared on logout); transactions created offline are queued (`queuePendingChange`) and replayed on reconnect.
- `services/biometric.service.ts` — WebAuthn credential creation/assertion (client-side only, no server verification). Credentials stored in `localStorage`. It only unlocks an existing cookie session; it cannot sign in once the session has expired.
- `services/secure-storage.service.ts` — prefixed localStorage/sessionStorage wrapper for client-side flags (last activity, remember-me, preferences); no tokens are stored client-side
- `components/app-layout.tsx` — app shell: greeting header, bottom nav (Home, Transactions, center **+**, Stats, Wallets) and the global Add Transaction sheet. Pages read shared state via `useAppShell()` (`selectedWalletId`, and `dataVersion`, which is bumped after the sheet saves so pages refetch)
- `components/finance/` — domain components (wallet cards, transaction rows/list, filter chips, month switcher, transaction/wallet/category forms, details sheet)
- Visual design follows `DESIGN.md` (tokens in `src/index.css`: canvas/surface/ink, `lime`, `income`, `expense`; Plus Jakarta Sans). Reference mockups live in `docs/design/stitch/`
- `components/ui/` — shadcn/ui component library files (do not hand-edit; use `npx shadcn@latest add <component>` to add new ones)
- `config/app.ts` — app-wide config

### Data Model (Prisma)
- `User` → has many `Wallet`s and `Category`s
- `Wallet` → has `balance`, `currency` (KRW or IDR), `isMain`, `displayOrder`; holds many `Transaction`s
- `Transaction` → belongs to one `Wallet` and one `Category`; has `amount`, `date`, `description`
- `Category` → `userId` is nullable (null = global/default category); has `type: INCOME | EXPENSE`
- `Transfer` → links exactly two `Transaction` rows (out on the source wallet, in on the destination) via `transferId`; they use the hidden global categories `transfer-out`/`transfer-in` (`isTransfer`), are edited only through `/api/transfers`, and are excluded from stats

### Infrastructure
- Traefik reverse proxy routes `finance.umeh.me` → prod frontend, `finance-api.umeh.me` → backend
- Backend port 4000 in Docker (8000 when run locally via `npm run start`), frontend Nginx on 80 (mapped to 3000 prod / 3001 dev). The backend container runs `prisma migrate deploy` on start
- PostgreSQL exposed on 6500 locally (user/password `postgres`), Redis on 6379

---

## Key Conventions

- Backend env vars are loaded from `backend/.env`; the `config` package reads them via `custom-environment-variables.ts`, not `process.env` directly
- JWT keys (`accessTokenPrivateKey`, `accessTokenPublicKey`, `refreshTokenPrivateKey`, `refreshTokenPublicKey`) are stored as base64-encoded strings in env/config — always decode with `Buffer.from(key, 'base64').toString('ascii')` before use
- Month/date filters are sent as exact ISO instants computed in the browser's timezone (`startDate`/`endDate`, plus `tz` for the stats trend), so the server timezone never decides which month a transaction belongs to
- Frontend env vars use `VITE_` prefix; `VITE_API_URL` controls the backend base URL
- The `@` path alias maps to `client/src/` in both Vite and TypeScript configs
- Currency support is intentionally limited to KRW and IDR in wallet creation
- Schema changes need a migration (`npx prisma migrate dev`); never change `schema.prisma` without one
- Categories with `userId = null` are global and are returned to every user alongside their own
- Backend tests use Jest + Supertest (`.spec.ts` files in `backend/tests/`); frontend tests use Vitest + Testing Library (files in `client/src/test/`)
- Never call real Gemini in tests: integration tests mock `extractTransaction` (`jest.mock('../src/services/ai.service', …)`) and the Playwright backend runs with `GEMINI_API_KEY=''`. For a manual check use `npm run try-capture -- "<text>"`.
