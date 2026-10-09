# AI Transaction Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an iOS Shortcut post OCR text to the backend, which extracts and saves a transaction with Gemini; and let the app's Add sheet fill its form from a photo for the user to confirm.

**Architecture:** `ai.service` is the only Gemini caller and returns a fixed `AiExtraction` JSON. `capture.service` applies our own deterministic rules (`resolveDraft`) to turn that into a `TransactionDraft` with real wallet/category ids. `POST /api/capture/text` (personal API token) saves the draft; `POST /api/capture/photo` (session) returns it for the client to confirm.

**Tech Stack:** Express + Prisma + Zod (backend), `@google/genai` 2.28.0 (Gemini, model `gemini-2.5-flash`), React/Vite (client), Jest + Supertest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-ai-transaction-capture-design.md`

---

## Conventions for every task

- Backend commands run from `backend/`, client commands from `client/`.
- Local infra must be up for integration/e2e tests: from the repo root run `make infra`, and from `backend/` run `npx prisma migrate deploy`.
- The server pins `process.env.TZ` to `Asia/Seoul` in `src/app.ts`; local date strings are interpreted in that timezone.
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## File map

Backend
- Create `src/services/ai.service.ts`: Gemini client, prompt, response schema, `extractTransaction`, `parseExtraction`, error classes.
- Create `src/services/capture.service.ts`: `resolveDraft`, `findOrCreateOtherCategory`, `summarize`, `CaptureError`, draft types.
- Create `src/schemas/capture.schema.ts`: request validation.
- Create `src/controllers/capture.controller.ts`: text and photo handlers.
- Create `src/routes/capture.routes.ts`: routes, shared per-user rate limiter.
- Create `src/middleware/requireApiToken.ts`: Bearer `ft_…` token auth.
- Create `scripts/try-capture.ts`: manual real-Gemini check.
- Modify `src/services/user.service.ts`: token issue/revoke/status/lookup; hide `apiTokenHash`.
- Modify `src/controllers/user.controller.ts`, `src/routes/user.routes.ts`: token endpoints.
- Modify `src/app.ts`: photo body parser, mount capture router.
- Modify `prisma/schema.prisma` + new migration: token columns.
- Modify `config/default.ts`, `config/custom-environment-variables.ts`, `Dockerfile`, `package.json`.
- Tests: `tests/capture.spec.ts`, `tests/ai.spec.ts` (unit), `tests/capture.int.ts` (integration).

Client
- Create `src/lib/image.ts`: downscale a photo to a JPEG base64 payload.
- Create `src/components/api-token-settings.tsx`: Settings card.
- Modify `src/hooks/use-transaction-form.ts`: `applyDraft`.
- Modify `src/components/finance/transaction-form.tsx`: Scan photo pill.
- Modify `src/pages/Settings.tsx`: render the token card.
- Tests: `e2e/capture.e2e.ts`, `e2e/SCENARIOS.md`.

Docs
- Create `docs/shortcut-setup.md`; modify `CLAUDE.md`.

---

### Task 1: Config, dependency, Node 20

**Files:**
- Modify: `backend/package.json` (via npm)
- Modify: `backend/config/default.ts`
- Modify: `backend/config/custom-environment-variables.ts`
- Modify: `backend/Dockerfile`

- [ ] **Step 1: Install the SDK**

Run (in `backend/`): `npm i @google/genai@2.28.0`
Expected: `package.json` dependencies gain `"@google/genai": "^2.28.0"`.

- [ ] **Step 2: Add config keys**

`backend/config/default.ts` becomes:

```ts
export default {
  redisCacheExpiresIn: 43200, // 30 days in minutes
  refreshTokenExpiresIn: 43200, // 30 days in minutes
  accessTokenExpiresIn: 120, // 2 hours in minutes
  origin: 'http://localhost:5173',
  // AI capture: empty key disables the capture endpoints (503)
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
};
```

In `backend/config/custom-environment-variables.ts`, add inside the exported object, after `port: 'PORT',`:

```ts
  geminiApiKey: 'GEMINI_API_KEY',
  geminiModel: 'GEMINI_MODEL',
```

- [ ] **Step 3: Node 20 in Docker (the SDK requires Node >= 20)**

In `backend/Dockerfile` change `FROM node:18-alpine` to `FROM node:20-alpine`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx jest`
Expected: no type errors; all existing unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/config backend/Dockerfile
git commit -m "chore(backend): add Gemini SDK and config; Node 20 image"
```

---

### Task 2: API token columns

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `User`)
- Create: `backend/prisma/migrations/<timestamp>_api_token/migration.sql` (generated)
- Modify: `backend/src/services/user.service.ts:9-15` (`excludedFields`)

- [ ] **Step 1: Add the columns**

In `model User`, after `passwordResetAt DateTime?` add:

```prisma
  // Personal API token for the iOS Shortcut (SHA-256 hash; the token is shown once)
  apiTokenHash       String?   @unique
  apiTokenCreatedAt  DateTime?
  apiTokenLastUsedAt DateTime?
```

- [ ] **Step 2: Generate the migration**

Run: `npx prisma migrate dev --name api_token`
Expected: a new folder `prisma/migrations/*_api_token/` whose `migration.sql` adds the three columns to `"users"` and a unique index on `"apiTokenHash"`; Prisma Client regenerated.

- [ ] **Step 3: Never expose the hash**

In `backend/src/services/user.service.ts`, `excludedFields` becomes:

```ts
export const excludedFields = [
  "password",
  "verified",
  "verificationCode",
  "passwordResetAt",
  "passwordResetToken",
  "apiTokenHash",
];
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx jest && npx prisma migrate status`
Expected: no errors; tests pass; "Database schema is up to date!".

- [ ] **Step 5: Commit**

```bash
git add backend/prisma backend/src/services/user.service.ts
git commit -m "feat(db): add personal API token columns to users"
```

---

### Task 3: Token service, endpoints and middleware

**Files:**
- Modify: `backend/src/services/user.service.ts` (append)
- Modify: `backend/src/controllers/user.controller.ts` (append)
- Modify: `backend/src/routes/user.routes.ts`
- Create: `backend/src/middleware/requireApiToken.ts`
- Create: `backend/tests/capture.int.ts`

- [ ] **Step 1: Write the failing integration tests**

Create `backend/tests/capture.int.ts`:

```ts
/**
 * Integration scenarios for personal API tokens and AI capture.
 * Real Postgres + Redis; the Gemini call (extractTransaction) is mocked.
 * Run: npm run test:int
 */
process.env.TZ = 'Asia/Seoul';

jest.mock('../src/services/ai.service', () => ({
  ...jest.requireActual('../src/services/ai.service'),
  extractTransaction: jest.fn(),
}));

import request from 'supertest';
import app, { ready } from '../src/app';
import prisma from '../src/middleware/prismaMiddleware';
import redisClient from '../src/utils/connectRedis';
import { deleteAllSessions } from '../src/services/user.service';

const run = Date.now();
const emails: string[] = [];
type Agent = ReturnType<typeof request.agent>;

async function newUser(tag: string): Promise<Agent> {
  const email = `cap-${tag}-${run}@example.test`;
  emails.push(email);
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: tag, email, password: 'password123', passwordConfirm: 'password123' });
  expect(res.status).toBe(201);
  return agent;
}

let owner: Agent;

beforeAll(async () => {
  await ready;
  owner = await newUser('owner');
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.transaction.deleteMany({ where: { wallet: { userId: { in: ids } } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.category.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await Promise.all(ids.map((id) => deleteAllSessions(id)));
  await prisma.$disconnect();
  await redisClient.quit();
});

describe('personal API token', () => {
  it('starts with no token', async () => {
    const res = await owner.get('/api/users/me/api-token');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ exists: false, createdAt: null, lastUsedAt: null });
  });

  it('issues a token once and only stores its hash', async () => {
    const res = await owner.post('/api/users/me/api-token');
    expect(res.status).toBe(201);
    expect(res.body.data.token).toMatch(/^ft_[A-Za-z0-9_-]{43}$/);

    const status = await owner.get('/api/users/me/api-token');
    expect(status.body.data.exists).toBe(true);
    expect(JSON.stringify((await owner.get('/api/users/me')).body)).not.toContain('apiTokenHash');
  });

  it('is not accepted on normal endpoints', async () => {
    const { body } = await owner.post('/api/users/me/api-token');
    const res = await request(app).get('/api/wallets').set('Authorization', `Bearer ${body.data.token}`);
    expect(res.status).toBe(401);
  });

  it('regenerating invalidates the previous token, revoking invalidates all', async () => {
    const first = (await owner.post('/api/users/me/api-token')).body.data.token;
    const second = (await owner.post('/api/users/me/api-token')).body.data.token;
    const send = (token: string) =>
      request(app).post('/api/capture/text').set('Authorization', `Bearer ${token}`).send({ text: 'x' });

    expect((await send(first)).status).toBe(401);
    expect((await send(second)).status).not.toBe(401);

    expect((await owner.delete('/api/users/me/api-token')).status).toBe(204);
    expect((await send(second)).status).toBe(401);
  });

  it('rejects a missing or malformed token', async () => {
    expect((await request(app).post('/api/capture/text').send({ text: 'x' })).status).toBe(401);
    const res = await request(app).post('/api/capture/text').set('Authorization', 'Bearer nope').send({ text: 'x' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid or missing API token');
  });
});
```

Add a script to `backend/package.json` is not needed: `npm run test:int` already matches `**/*.int.ts`.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:int -- tests/capture.int.ts`
Expected: FAIL. `/api/users/me/api-token` returns 404 (route missing), and `jest.mock('../src/services/ai.service')` fails with "Cannot find module" until Task 5. To unblock this task, temporarily create `backend/src/services/ai.service.ts` containing only `export const extractTransaction = async () => { throw new Error('not implemented'); };` (Task 5 replaces it). Rerun: tests fail on the 404s.

- [ ] **Step 3: Token functions in the user service**

Append to `backend/src/services/user.service.ts` (`crypto`, `prisma`, `omit`, `excludedFields` are already in scope):

```ts
// Personal API tokens (iOS Shortcut). Only a SHA-256 hash is stored.
const API_TOKEN_PREFIX = "ft_";
const hashApiToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const issueApiToken = async (userId: string) => {
  const token = API_TOKEN_PREFIX + crypto.randomBytes(32).toString("base64url");
  await prisma.user.update({
    where: { id: userId },
    data: { apiTokenHash: hashApiToken(token), apiTokenCreatedAt: new Date(), apiTokenLastUsedAt: null },
  });
  return token;
};

export const revokeApiToken = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: { apiTokenHash: null, apiTokenCreatedAt: null, apiTokenLastUsedAt: null },
  });
};

export const getApiTokenStatus = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { apiTokenHash: true, apiTokenCreatedAt: true, apiTokenLastUsedAt: true },
  });
  return {
    exists: !!user?.apiTokenHash,
    createdAt: user?.apiTokenCreatedAt ?? null,
    lastUsedAt: user?.apiTokenLastUsedAt ?? null,
  };
};

// Returns the user (without secrets) for a valid token and records the use; null otherwise
export const findUserByApiToken = async (token: string) => {
  if (!token.startsWith(API_TOKEN_PREFIX)) return null;
  const user = await prisma.user.findUnique({ where: { apiTokenHash: hashApiToken(token) } });
  if (!user) return null;
  await prisma.user.update({ where: { id: user.id }, data: { apiTokenLastUsedAt: new Date() } });
  return omit(user, excludedFields);
};
```

- [ ] **Step 4: Token handlers**

Append to `backend/src/controllers/user.controller.ts`, and add `getApiTokenStatus, issueApiToken, revokeApiToken` to its import from `'../services/user.service'`:

```ts
export const getApiTokenHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ status: 'success', data: await getApiTokenStatus(res.locals.user.id) });
  } catch (err: any) {
    next(err);
  }
};

export const createApiTokenHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = await issueApiToken(res.locals.user.id);
    res.status(201).json({ status: 'success', data: { token } });
  } catch (err: any) {
    next(err);
  }
};

export const deleteApiTokenHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await revokeApiToken(res.locals.user.id);
    res.status(204).end();
  } catch (err: any) {
    next(err);
  }
};
```

- [ ] **Step 5: Routes**

In `backend/src/routes/user.routes.ts`, extend the controller import with `createApiTokenHandler, deleteApiTokenHandler, getApiTokenHandler` and add after the existing `/me/password` route:

```ts
router.get('/me/api-token', getApiTokenHandler);
router.post('/me/api-token', createApiTokenHandler);
router.delete('/me/api-token', deleteApiTokenHandler);
```

- [ ] **Step 6: Middleware**

Create `backend/src/middleware/requireApiToken.ts`:

```ts
import { NextFunction, Request, Response } from 'express';
import { findUserByApiToken } from '../services/user.service';
import AppError from '../utils/appError';

// Authenticates `Authorization: Bearer ft_…` personal API tokens (iOS Shortcut only)
export const requireApiToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const user = token ? await findUserByApiToken(token) : null;
    if (!user) {
      return next(new AppError(401, 'Invalid or missing API token'));
    }
    res.locals.user = user;
    next();
  } catch (err: any) {
    next(err);
  }
};
```

- [ ] **Step 7: Temporary capture route so the token tests can run**

The token tests call `/api/capture/text`; Task 6 builds the real route. For now create `backend/src/routes/capture.routes.ts`:

```ts
import express from 'express';
import { requireApiToken } from '../middleware/requireApiToken';

const router = express.Router();

router.post('/text', requireApiToken, (_req, res) => {
  res.status(501).json({ status: 'error', message: 'Not implemented yet' });
});

export default router;
```

and in `backend/src/app.ts` add `import captureRouter from './routes/capture.routes';` with the other route imports and `app.use('/api/capture', captureRouter);` after `app.use('/api/stats', statsRouter);`.

- [ ] **Step 8: Run tests**

Run: `npm run test:int -- tests/capture.int.ts`
Expected: PASS (5 tests). Then `npx tsc --noEmit && npx jest` → all pass.

- [ ] **Step 9: Commit**

```bash
git add backend/src backend/tests/capture.int.ts
git commit -m "feat(api): personal API token endpoints and Bearer token middleware"
```

---

### Task 4: Resolution rules (`capture.service`)

**Files:**
- Create: `backend/src/services/capture.service.ts`
- Create: `backend/tests/capture.spec.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `backend/tests/capture.spec.ts`:

```ts
process.env.TZ = 'Asia/Seoul';

import { resolveDraft, summarize, CaptureError, type DraftCategory } from '../src/services/capture.service';
import type { AiExtraction } from '../src/services/ai.service';

const now = new Date('2026-10-10T03:00:00.000Z'); // 12:00 in Seoul
const wallets = [
  { id: 'w-krw-main', name: 'KRW Main', currency: 'KRW', isMain: true },
  { id: 'w-krw-card', name: 'Shinhan Card', currency: 'KRW', isMain: false },
  { id: 'w-idr', name: 'Rupiah', currency: 'IDR', isMain: false },
];
const categories: DraftCategory[] = [
  { id: 'c-food', name: 'Food', type: 'EXPENSE' },
  { id: 'c-salary', name: 'Salary', type: 'INCOME' },
];
const other = jest.fn(async (type: 'INCOME' | 'EXPENSE') => ({ id: `c-other-${type}`, name: 'Other', type }));
const ctx = () => ({ wallets, categories, now, otherCategory: other });

const extraction = (over: Partial<AiExtraction> = {}): AiExtraction => ({
  found: true,
  type: 'EXPENSE',
  amount: 6500,
  currency: 'KRW',
  description: 'Starbucks',
  date: '2026-10-10T08:15:00',
  categoryName: 'Food',
  walletName: null,
  ...over,
});

beforeEach(() => other.mockClear());

describe('resolveDraft: amount', () => {
  it('rejects a capture without an amount', async () => {
    await expect(resolveDraft(extraction({ amount: null }), ctx())).rejects.toThrow("Couldn't find an amount");
    await expect(resolveDraft(extraction({ found: false }), ctx())).rejects.toThrow(CaptureError);
  });

  it('rejects zero, negative and oversized amounts', async () => {
    await expect(resolveDraft(extraction({ amount: 0 }), ctx())).rejects.toThrow(CaptureError);
    await expect(resolveDraft(extraction({ amount: -5 }), ctx())).rejects.toThrow(CaptureError);
    await expect(resolveDraft(extraction({ amount: 1e13 }), ctx())).rejects.toThrow(CaptureError);
  });
});

describe('resolveDraft: wallet', () => {
  it('uses the named wallet when its currency matches', async () => {
    const draft = await resolveDraft(extraction({ walletName: 'shinhan card' }), ctx());
    expect(draft.walletId).toBe('w-krw-card');
  });

  it('ignores a named wallet in another currency and falls back to the main wallet', async () => {
    const draft = await resolveDraft(extraction({ walletName: 'Rupiah' }), ctx());
    expect(draft.walletId).toBe('w-krw-main');
  });

  it('picks a wallet in the capture currency when the main wallet differs', async () => {
    const draft = await resolveDraft(extraction({ currency: 'IDR', amount: 25000 }), ctx());
    expect(draft.walletId).toBe('w-idr');
    expect(draft.currency).toBe('IDR');
  });

  it('uses the main wallet when the currency is unknown', async () => {
    const draft = await resolveDraft(extraction({ currency: null }), ctx());
    expect(draft.walletId).toBe('w-krw-main');
  });

  it('refuses a currency with no wallet', async () => {
    await expect(resolveDraft(extraction({ currency: 'USD' }), ctx())).rejects.toThrow('No USD wallet');
  });

  it('refuses when the user has no wallets', async () => {
    await expect(resolveDraft(extraction(), { ...ctx(), wallets: [] })).rejects.toThrow('Add a wallet first');
  });
});

describe('resolveDraft: category', () => {
  it('matches an existing category of the same type, case-insensitively', async () => {
    const draft = await resolveDraft(extraction({ categoryName: 'food' }), ctx());
    expect(draft.categoryId).toBe('c-food');
    expect(other).not.toHaveBeenCalled();
  });

  it('falls back to Other when the name is unknown or the type differs', async () => {
    const unknown = await resolveDraft(extraction({ categoryName: 'Pharmacy' }), ctx());
    expect(unknown.categoryId).toBe('c-other-EXPENSE');
    const wrongType = await resolveDraft(extraction({ categoryName: 'Salary' }), ctx());
    expect(wrongType.categoryId).toBe('c-other-EXPENSE');
    const income = await resolveDraft(extraction({ type: 'INCOME', categoryName: null }), ctx());
    expect(income.categoryId).toBe('c-other-INCOME');
  });
});

describe('resolveDraft: date and description', () => {
  it('reads a local date-time in the server timezone', async () => {
    const draft = await resolveDraft(extraction({ date: '2026-10-09T14:20:00' }), ctx());
    expect(draft.date).toBe('2026-10-09T05:20:00.000Z');
  });

  it('uses local noon for a date without a time', async () => {
    const draft = await resolveDraft(extraction({ date: '2026-10-09' }), ctx());
    expect(draft.date).toBe('2026-10-09T03:00:00.000Z');
  });

  it('uses now for a missing, invalid or far-future date', async () => {
    for (const date of [null, 'not a date', '2027-10-10T08:00:00']) {
      const draft = await resolveDraft(extraction({ date }), ctx());
      expect(draft.date).toBe(now.toISOString());
    }
  });

  it('trims the description and falls back to the category name', async () => {
    expect((await resolveDraft(extraction({ description: '  Emart  ' }), ctx())).description).toBe('Emart');
    expect((await resolveDraft(extraction({ description: '' }), ctx())).description).toBe('Food');
  });
});

describe('summarize', () => {
  it('describes what was added', async () => {
    const draft = await resolveDraft(extraction(), ctx());
    expect(summarize(draft)).toBe('Added -₩6,500 Starbucks · Food · KRW Main');
  });

  it('signs income with +', async () => {
    const draft = await resolveDraft(extraction({ type: 'INCOME', amount: 3200000, categoryName: 'Salary', description: 'Payroll' }), ctx());
    expect(summarize(draft)).toBe('Added +₩3,200,000 Payroll · Salary · KRW Main');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest tests/capture.spec.ts`
Expected: FAIL with "Cannot find module '../src/services/capture.service'".

- [ ] **Step 3: Add the `AiExtraction` type to the AI module**

Replace the temporary `backend/src/services/ai.service.ts` from Task 3 with (Task 5 completes it):

```ts
// The fixed JSON shape Gemini must return (see the spec's "AI contract")
export interface AiExtraction {
  found: boolean;
  type: 'INCOME' | 'EXPENSE';
  amount: number | null;
  currency: string | null;
  description: string;
  date: string | null;
  categoryName: string | null;
  walletName: string | null;
}

export const extractTransaction = async (): Promise<AiExtraction> => {
  throw new Error('not implemented');
};
```

- [ ] **Step 4: Implement `capture.service`**

Create `backend/src/services/capture.service.ts`:

```ts
import { CategoryType } from '@prisma/client';
import type { AiExtraction } from './ai.service';
import { createCategory, findCategory } from './category.service';
import { MAX_AMOUNT } from '../schemas/transaction.schema';

export class CaptureError extends Error {}

export interface DraftWallet {
  id: string;
  name: string;
  currency: string;
  isMain: boolean;
}

export interface DraftCategory {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

export interface TransactionDraft {
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  date: string; // ISO instant
  walletId: string;
  walletName: string;
  currency: string;
  categoryId: string;
  categoryName: string;
}

export interface ResolveContext {
  wallets: DraftWallet[];
  categories: DraftCategory[];
  now: Date;
  otherCategory: (type: 'INCOME' | 'EXPENSE') => Promise<DraftCategory>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const same = (a: string | null | undefined, b: string) => !!a && a.trim().toLowerCase() === b.toLowerCase();

function pickWallet(x: AiExtraction, wallets: DraftWallet[]): DraftWallet {
  if (wallets.length === 0) throw new CaptureError('Add a wallet first');
  const currency = x.currency?.trim().toUpperCase() || null;
  const named = wallets.find((w) => same(x.walletName, w.name));
  if (named && (!currency || named.currency === currency)) return named;

  const main = wallets.find((w) => w.isMain) ?? wallets[0];
  if (!currency) return main;
  if (main.currency === currency) return main;
  const sameCurrency = wallets.find((w) => w.currency === currency);
  if (!sameCurrency) throw new CaptureError(`No ${currency} wallet`);
  return sameCurrency;
}

// Local date-times (no offset) are read in the server timezone (process.env.TZ)
function pickDate(raw: string | null, now: Date): Date {
  if (!raw) return now;
  const value = /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? `${raw.trim()}T12:00:00` : raw.trim();
  const date = new Date(value);
  if (isNaN(date.getTime())) return now;
  if (date.getTime() - now.getTime() > DAY_MS) return now;
  return date;
}

// Turn the AI's labels into a concrete draft; our rules, not the model, decide what is saved
export async function resolveDraft(x: AiExtraction, ctx: ResolveContext): Promise<TransactionDraft> {
  if (!x.found || x.amount === null || x.amount === undefined) {
    throw new CaptureError("Couldn't find an amount");
  }
  if (!(x.amount > 0) || x.amount > MAX_AMOUNT) {
    throw new CaptureError('The amount looks wrong; enter it manually');
  }

  const wallet = pickWallet(x, ctx.wallets);
  const category =
    ctx.categories.find((c) => c.type === x.type && same(x.categoryName, c.name)) ??
    (await ctx.otherCategory(x.type));
  const description = x.description?.trim().slice(0, 255) || category.name;

  return {
    type: x.type,
    amount: x.amount,
    description,
    date: pickDate(x.date, ctx.now).toISOString(),
    walletId: wallet.id,
    walletName: wallet.name,
    currency: wallet.currency,
    categoryId: category.id,
    categoryName: category.name,
  };
}

// The user's "Other" category for this type, created on first use
export async function findOrCreateOtherCategory(userId: string, type: 'INCOME' | 'EXPENSE'): Promise<DraftCategory> {
  const existing = await findCategory({ userId, type, name: { equals: 'Other', mode: 'insensitive' } });
  const category = existing ?? (await createCategory({ name: 'Other', type: type as CategoryType, user: { connect: { id: userId } } }));
  return { id: category.id, name: category.name, type };
}

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

// One line for the iOS Shortcut notification
export function summarize(d: TransactionDraft): string {
  const sign = d.type === 'INCOME' ? '+' : '-';
  return `Added ${sign}${money(d.amount, d.currency)} ${d.description} · ${d.categoryName} · ${d.walletName}`;
}
```

- [ ] **Step 5: Run tests**

Run: `npx jest tests/capture.spec.ts`
Expected: PASS (all describe blocks). Then `npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/capture.service.ts backend/src/services/ai.service.ts backend/tests/capture.spec.ts
git commit -m "feat(capture): resolution rules for AI-extracted transactions"
```

---

### Task 5: Gemini service (`ai.service`)

**Files:**
- Modify: `backend/src/services/ai.service.ts` (full replacement)
- Create: `backend/tests/ai.spec.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `backend/tests/ai.spec.ts`:

```ts
process.env.TZ = 'Asia/Seoul';

import { buildPrompt, parseExtraction, AiUnavailableError } from '../src/services/ai.service';

const ctx = {
  wallets: [{ id: 'w1', name: 'KRW Main', currency: 'KRW', isMain: true }],
  categories: [{ id: 'c1', name: 'Food', type: 'EXPENSE' as const }],
  now: new Date('2026-10-10T03:00:00.000Z'),
  timeZone: 'Asia/Seoul',
};

describe('buildPrompt', () => {
  it('lists wallets, categories and the local time', () => {
    const prompt = buildPrompt(ctx);
    expect(prompt).toContain('KRW Main (KRW, main)');
    expect(prompt).toContain('Food (EXPENSE)');
    expect(prompt).toContain('2026-10-10 12:00:00');
    expect(prompt).toContain('Asia/Seoul');
  });
});

describe('parseExtraction', () => {
  const valid = {
    found: true, type: 'EXPENSE', amount: 6500, currency: 'KRW', description: 'Starbucks',
    date: '2026-10-10T08:15:00', categoryName: 'Food', walletName: null,
  };

  it('accepts the expected JSON', () => {
    expect(parseExtraction(JSON.stringify(valid))).toEqual(valid);
  });

  it('rejects empty, non-JSON or wrongly shaped replies as AI unavailable', () => {
    expect(() => parseExtraction(undefined)).toThrow(AiUnavailableError);
    expect(() => parseExtraction('not json')).toThrow(AiUnavailableError);
    expect(() => parseExtraction(JSON.stringify({ ...valid, type: 'TRANSFER' }))).toThrow(AiUnavailableError);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest tests/ai.spec.ts`
Expected: FAIL ("buildPrompt is not a function" / export missing).

- [ ] **Step 3: Implement the service**

Replace `backend/src/services/ai.service.ts` with:

```ts
import { GoogleGenAI } from '@google/genai';
import config from 'config';
import { z } from 'zod';

// The fixed JSON shape Gemini must return (see the spec's "AI contract")
export interface AiExtraction {
  found: boolean;
  type: 'INCOME' | 'EXPENSE';
  amount: number | null;
  currency: string | null;
  description: string;
  date: string | null;
  categoryName: string | null;
  walletName: string | null;
}

export interface AiContext {
  wallets: { name: string; currency: string; isMain: boolean }[];
  categories: { name: string; type: 'INCOME' | 'EXPENSE' }[];
  now: Date;
  timeZone: string;
}

export type AiInput = { text: string } | { image: string; mimeType: string };

export class AiNotConfiguredError extends Error {}
export class AiUnavailableError extends Error {}

const extractionSchema = z.object({
  found: z.boolean(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  description: z.string(),
  date: z.string().nullable(),
  categoryName: z.string().nullable(),
  walletName: z.string().nullable(),
});

// JSON Schema sent to Gemini so it replies with exactly this structure
const responseJsonSchema = {
  type: 'object',
  properties: {
    found: { type: 'boolean', description: 'false if no payment or transfer can be recognized' },
    type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
    amount: { type: ['number', 'null'], description: 'positive amount in the transaction currency, no symbols' },
    currency: { type: ['string', 'null'], description: 'ISO 4217 code if visible, e.g. KRW, IDR, USD' },
    description: { type: 'string', description: 'short label, usually the merchant or counterparty' },
    date: { type: ['string', 'null'], description: 'local date-time YYYY-MM-DDTHH:mm:ss if visible, else null' },
    categoryName: { type: ['string', 'null'], description: 'exact name from the provided categories, or null' },
    walletName: { type: ['string', 'null'], description: 'exact name from the provided wallets, or null' },
  },
  required: ['found', 'type', 'amount', 'currency', 'description', 'date', 'categoryName', 'walletName'],
};

export function buildPrompt(ctx: AiContext): string {
  const localNow = ctx.now.toLocaleString('sv-SE', { timeZone: ctx.timeZone });
  const wallets = ctx.wallets.map((w) => `- ${w.name} (${w.currency}${w.isMain ? ', main' : ''})`).join('\n') || '- (none)';
  const categories = ctx.categories.map((c) => `- ${c.name} (${c.type})`).join('\n') || '- (none)';
  return [
    'You extract one financial transaction from a banking or payment app screenshot, a receipt, or OCR text of one.',
    'If several transactions are visible, pick the single most relevant one: a receipt total, or the most recent payment.',
    'Amounts are positive numbers without currency symbols or thousands separators. Money paid out is EXPENSE; money received is INCOME.',
    'Korean won has no decimals. Indonesian rupiah often uses "." as the thousands separator (Rp 25.000 is 25000).',
    `The current local time is ${localNow} (${ctx.timeZone}). Return dates as local time; if the year is missing, assume the current year.`,
    `The user's wallets:\n${wallets}`,
    `The user's categories:\n${categories}`,
    'Use categoryName and walletName only if one of the listed names clearly fits; otherwise null.',
  ].join('\n\n');
}

export function parseExtraction(text: string | undefined): AiExtraction {
  if (!text) throw new AiUnavailableError('Empty AI response');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AiUnavailableError('AI response was not JSON');
  }
  const parsed = extractionSchema.safeParse(json);
  if (!parsed.success) throw new AiUnavailableError('AI response had an unexpected shape');
  return parsed.data;
}

let client: GoogleGenAI | undefined;
function getClient(): GoogleGenAI {
  const apiKey = config.get<string>('geminiApiKey');
  if (!apiKey) throw new AiNotConfiguredError('GEMINI_API_KEY is not set');
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

// The only place that talks to Gemini
export async function extractTransaction(input: AiInput, ctx: AiContext): Promise<AiExtraction> {
  const ai = getClient();
  const content = 'text' in input ? { text: `OCR text:\n${input.text}` } : { inlineData: { mimeType: input.mimeType, data: input.image } };
  let reply: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: config.get<string>('geminiModel'),
      contents: [{ role: 'user', parts: [{ text: buildPrompt(ctx) }, content] }],
      config: { responseMimeType: 'application/json', responseJsonSchema, temperature: 0 },
    });
    reply = response.text;
  } catch (err) {
    console.error('Gemini request failed:', err);
    throw new AiUnavailableError('Gemini request failed');
  }
  return parseExtraction(reply);
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest tests/ai.spec.ts tests/capture.spec.ts && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/ai.service.ts backend/tests/ai.spec.ts
git commit -m "feat(ai): Gemini extraction service with JSON schema output"
```

---

### Task 6: Capture endpoints

**Files:**
- Create: `backend/src/schemas/capture.schema.ts`
- Create: `backend/src/controllers/capture.controller.ts`
- Modify: `backend/src/routes/capture.routes.ts` (full replacement)
- Modify: `backend/src/app.ts`
- Modify: `backend/tests/capture.int.ts` (append)

- [ ] **Step 1: Write the failing integration tests**

In `backend/tests/capture.int.ts`, add these imports after the existing ones:

```ts
import { extractTransaction, AiUnavailableError, AiNotConfiguredError, type AiExtraction } from '../src/services/ai.service';

const mockedExtract = extractTransaction as jest.MockedFunction<typeof extractTransaction>;
const extraction = (over: Partial<AiExtraction> = {}): AiExtraction => ({
  found: true, type: 'EXPENSE', amount: 6500, currency: 'KRW', description: 'Latte',
  date: null, categoryName: 'Coffee', walletName: null, ...over,
});
```

and append:

```ts
describe('capture', () => {
  let shortcut: Agent;
  let token: string;
  let walletId: string;

  beforeAll(async () => {
    shortcut = await newUser('shortcut');
    walletId = (await shortcut.post('/api/wallets').send({ name: 'KRW Main', currency: 'KRW', balance: 10000 })).body.data.wallet.id;
    await shortcut.put(`/api/wallets/${walletId}/main`);
    await shortcut.post('/api/categories').send({ name: 'Coffee', type: 'EXPENSE' });
    token = (await shortcut.post('/api/users/me/api-token')).body.data.token;
  });

  const sendText = (text = 'STARBUCKS 6,500원 승인') =>
    request(app).post('/api/capture/text').set('Authorization', `Bearer ${token}`).send({ text });

  it('text: saves the transaction and returns a summary', async () => {
    mockedExtract.mockResolvedValueOnce(extraction());
    const res = await sendText();

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Added -₩6,500 Latte · Coffee · KRW Main');
    expect(res.body.data.transaction.amount).toBe(6500);
    const wallet = await shortcut.get(`/api/wallets/${walletId}`);
    expect(wallet.body.data.wallet.balance).toBe(3500);
    expect(mockedExtract).toHaveBeenLastCalledWith({ text: 'STARBUCKS 6,500원 승인' }, expect.objectContaining({ timeZone: 'Asia/Seoul' }));
  });

  it('text: unknown category lands in an auto-created Other', async () => {
    mockedExtract.mockResolvedValueOnce(extraction({ categoryName: 'Pharmacy', description: 'Olive Young' }));
    const res = await sendText();
    expect(res.status).toBe(201);
    expect(res.body.message).toContain('· Other ·');
  });

  it('text: missing amount is a readable 422', async () => {
    mockedExtract.mockResolvedValueOnce(extraction({ amount: null }));
    const res = await sendText();
    expect(res.status).toBe(422);
    expect(res.body.message).toBe("Couldn't find an amount");
  });

  it('text: AI failures are a readable 503', async () => {
    mockedExtract.mockRejectedValueOnce(new AiUnavailableError('boom'));
    expect((await sendText()).body).toEqual({ status: 'error', message: 'AI is unavailable, try again later' });
    mockedExtract.mockRejectedValueOnce(new AiNotConfiguredError('no key'));
    const res = await sendText();
    expect(res.status).toBe(503);
    expect(res.body.message).toBe("AI capture isn't set up");
  });

  it('text: validates the body', async () => {
    const res = await request(app).post('/api/capture/text').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  it('photo: returns a draft and saves nothing', async () => {
    mockedExtract.mockResolvedValueOnce(extraction({ amount: 12000, description: 'Emart' }));
    const before = (await shortcut.get(`/api/transactions?walletId=${walletId}`)).body.data.pagination.total;

    const res = await shortcut.post('/api/capture/photo').send({ image: Buffer.from('fake-jpeg').toString('base64'), mimeType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.data.draft).toMatchObject({ amount: 12000, description: 'Emart', walletId, categoryName: 'Coffee', type: 'EXPENSE' });
    expect(mockedExtract).toHaveBeenLastCalledWith({ image: expect.any(String), mimeType: 'image/jpeg' }, expect.anything());
    const after = (await shortcut.get(`/api/transactions?walletId=${walletId}`)).body.data.pagination.total;
    expect(after).toBe(before);
  });

  it('photo: requires a session, not the API token', async () => {
    const res = await request(app).post('/api/capture/photo').set('Authorization', `Bearer ${token}`)
      .send({ image: 'AAAA', mimeType: 'image/jpeg' });
    expect(res.status).toBe(401);
  });

  it('photo: rejects images over 5 MB and unsupported types', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64');
    expect((await shortcut.post('/api/capture/photo').send({ image: big, mimeType: 'image/jpeg' })).status).toBe(400);
    expect((await shortcut.post('/api/capture/photo').send({ image: 'AAAA', mimeType: 'image/gif' })).status).toBe(400);
  });

  // Keep this last in the block: it uses up the user's hourly budget
  it('limits captures to 30 per hour per user, shared across both endpoints', async () => {
    mockedExtract.mockResolvedValue(extraction({ amount: null })); // 422s: nothing is written
    let last = await sendText();
    for (let i = 0; i < 31 && last.status !== 429; i++) last = await sendText();
    expect(last.status).toBe(429);
    expect(last.body.message).toBe('Too many captures, try again in an hour.');
    const photo = await shortcut.post('/api/capture/photo').send({ image: 'AAAA', mimeType: 'image/jpeg' });
    expect(photo.status).toBe(429);
    mockedExtract.mockReset();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:int -- tests/capture.int.ts`
Expected: the new `capture` tests FAIL (501 from the placeholder route, 404 for `/photo`).

- [ ] **Step 3: Request schemas**

Create `backend/src/schemas/capture.schema.ts`:

```ts
import { object, string, z, TypeOf } from 'zod';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const captureTextSchema = object({
  body: object({
    text: string({ required_error: 'Text is required' })
      .trim()
      .min(1, 'Text is required')
      .max(8000, 'Text is too long (max 8,000 characters)'),
  }),
});

export const capturePhotoSchema = object({
  body: object({
    image: string({ required_error: 'Image is required' })
      .min(1, 'Image is required')
      .refine((b64) => Buffer.byteLength(b64, 'base64') <= MAX_IMAGE_BYTES, 'Image is too large (max 5 MB)'),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
      errorMap: () => ({ message: 'Use a JPEG, PNG or WebP image' }),
    }),
  }),
});

export type CaptureTextInput = TypeOf<typeof captureTextSchema>['body'];
export type CapturePhotoInput = TypeOf<typeof capturePhotoSchema>['body'];
```

- [ ] **Step 4: Controller**

Create `backend/src/controllers/capture.controller.ts`:

```ts
import { NextFunction, Request, Response } from 'express';
import { CapturePhotoInput, CaptureTextInput } from '../schemas/capture.schema';
import { AiInput, AiNotConfiguredError, AiUnavailableError, extractTransaction } from '../services/ai.service';
import { CaptureError, findOrCreateOtherCategory, resolveDraft, summarize, TransactionDraft } from '../services/capture.service';
import { findCategories } from '../services/category.service';
import { createTransaction } from '../services/transaction.service';
import { findWalletsByUserId } from '../services/wallet.service';
import AppError from '../utils/appError';

const timeZone = () => process.env.TZ || 'Asia/Seoul';

async function draftFor(userId: string, input: AiInput): Promise<TransactionDraft> {
  const [wallets, categories] = await Promise.all([
    findWalletsByUserId(userId),
    findCategories({ OR: [{ userId }, { userId: null }] }),
  ]);
  const now = new Date();
  const extraction = await extractTransaction(input, { wallets, categories, now, timeZone: timeZone() });
  return resolveDraft(extraction, {
    wallets,
    categories,
    now,
    otherCategory: (type) => findOrCreateOtherCategory(userId, type),
  });
}

// Readable, Shortcut-friendly errors
function captureFailure(err: unknown, next: NextFunction) {
  if (err instanceof AiNotConfiguredError) return next(new AppError(503, "AI capture isn't set up"));
  if (err instanceof AiUnavailableError) return next(new AppError(503, 'AI is unavailable, try again later'));
  if (err instanceof CaptureError) return next(new AppError(422, err.message));
  return next(err);
}

// iOS Shortcut: OCR text in, saved transaction + one-line summary out
export const captureTextHandler = async (req: Request<{}, {}, CaptureTextInput>, res: Response, next: NextFunction) => {
  try {
    const draft = await draftFor(res.locals.user.id, { text: req.body.text });
    const transaction = await createTransaction({
      wallet: { connect: { id: draft.walletId } },
      category: { connect: { id: draft.categoryId } },
      amount: draft.amount,
      description: draft.description,
      date: new Date(draft.date),
    });
    res.status(201).json({ status: 'success', message: summarize(draft), data: { transaction } });
  } catch (err) {
    captureFailure(err, next);
  }
};

// App: photo in, draft out; the user confirms by saving through POST /api/transactions
export const capturePhotoHandler = async (req: Request<{}, {}, CapturePhotoInput>, res: Response, next: NextFunction) => {
  try {
    const draft = await draftFor(res.locals.user.id, { image: req.body.image, mimeType: req.body.mimeType });
    res.status(200).json({ status: 'success', data: { draft } });
  } catch (err) {
    captureFailure(err, next);
  }
};
```

Note: `findCategories` is typed loosely (`as any`) in `category.service.ts`; it returns rows with `id`, `name`, `type`, which satisfy `DraftCategory`.

- [ ] **Step 5: Routes with the shared per-user limit**

Replace `backend/src/routes/capture.routes.ts` with:

```ts
import express from 'express';
import rateLimit from 'express-rate-limit';
import { capturePhotoHandler, captureTextHandler } from '../controllers/capture.controller';
import { deserializeUser } from '../middleware/deserializeUser';
import { requireApiToken } from '../middleware/requireApiToken';
import { requireUser } from '../middleware/requireUser';
import { validate } from '../middleware/validate';
import { capturePhotoSchema, captureTextSchema } from '../schemas/capture.schema';

const router = express.Router();

// One budget per user across both endpoints, to protect the Gemini free quota
const captureLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (_req, res) => res.locals.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many captures, try again in an hour.' },
});

router.post('/text', requireApiToken, captureLimiter, validate(captureTextSchema), captureTextHandler);
router.post('/photo', deserializeUser, requireUser, captureLimiter, validate(capturePhotoSchema), capturePhotoHandler);

export default router;
```

- [ ] **Step 6: Larger body limit for photos only**

In `backend/src/app.ts`, directly above `app.use(express.json({ limit: '10kb' }));` add:

```ts
  // Photos are base64 JSON (≤5 MB image); every other route keeps the 10kb limit
  app.use('/api/capture/photo', express.json({ limit: '7mb' }));
```

- [ ] **Step 7: Run tests**

Run: `npm run test:int` (all integration files) and `npx jest` and `npx tsc --noEmit`
Expected: all PASS, including the 9 new `capture` tests.

- [ ] **Step 8: Commit**

```bash
git add backend/src backend/tests/capture.int.ts
git commit -m "feat(capture): /api/capture/text (Shortcut) and /api/capture/photo (draft)"
```

---

### Task 7: Manual real-Gemini check

**Files:**
- Create: `backend/scripts/try-capture.ts`
- Modify: `backend/package.json` (scripts)

- [ ] **Step 1: Write the script**

Create `backend/scripts/try-capture.ts`:

```ts
/**
 * Manual check against real Gemini (uses your quota). Not part of any test run.
 * Usage: GEMINI_API_KEY=... npm run try-capture -- "STARBUCKS 6,500원 10/09 14:20 신한카드 승인"
 */
require('dotenv').config();
process.env.TZ = process.env.TZ || 'Asia/Seoul';
import { extractTransaction } from '../src/services/ai.service';

const text = process.argv.slice(2).join(' ') || 'STARBUCKS 6,500원 10/09 14:20 신한카드 승인';

extractTransaction(
  { text },
  {
    wallets: [
      { name: 'KRW Main', currency: 'KRW', isMain: true },
      { name: 'Rupiah', currency: 'IDR', isMain: false },
    ],
    categories: [
      { name: 'Coffee', type: 'EXPENSE' },
      { name: 'Groceries', type: 'EXPENSE' },
      { name: 'Salary', type: 'INCOME' },
    ],
    now: new Date(),
    timeZone: process.env.TZ,
  }
)
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
```

- [ ] **Step 2: Add the npm script**

In `backend/package.json` `scripts`, add: `"try-capture": "ts-node --transpile-only scripts/try-capture.ts"`

- [ ] **Step 3: Verify it fails cleanly without a key**

Run: `GEMINI_API_KEY= npm run try-capture`
Expected: prints `GEMINI_API_KEY is not set` and exits 1. (With a real key it prints the extracted JSON.)

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/try-capture.ts backend/package.json
git commit -m "chore(capture): manual script to try extraction against real Gemini"
```

---

### Task 8: Shortcut token card in Settings

**Files:**
- Create: `client/src/components/api-token-settings.tsx`
- Modify: `client/src/pages/Settings.tsx` (security section)
- Create: `client/e2e/capture.e2e.ts`

- [ ] **Step 1: Write the failing e2e scenario**

Create `client/e2e/capture.e2e.ts`:

```ts
// Scenarios C1–C4 (see SCENARIOS.md)
import { test, expect, signUp, API } from './helpers';

test('C1 generate, use and revoke the Shortcut token', async ({ page }) => {
  await signUp(page, 'c1');
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Security' }).click();
  await expect(page.getByText('No token yet')).toBeVisible();

  await page.getByRole('button', { name: 'Generate token' }).click();
  const token = (await page.getByTestId('new-api-token').textContent())!.trim();
  expect(token).toMatch(/^ft_/);
  await expect(page.getByText("Copy it now. It won't be shown again.")).toBeVisible();

  // Token is accepted by the capture endpoint (no Gemini key in e2e, so it stops at 503)
  const send = () => page.request.post(`${API}/api/capture/text`, { headers: { Authorization: `Bearer ${token}` }, data: { text: 'x' } });
  expect((await send()).status()).toBe(503);

  await page.getByRole('button', { name: 'Revoke' }).click();
  await expect(page.getByText('No token yet')).toBeVisible();
  expect((await send()).status()).toBe(401);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/capture.e2e.ts`
Expected: FAIL ("No token yet" not found).

- [ ] **Step 3: The component**

Create `client/src/components/api-token-settings.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';

interface TokenStatus {
  exists: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
}

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const day = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const apiMessage = (err: unknown) => (isAxiosError(err) ? err.response?.data?.message : undefined);

// Personal API token for the iOS Shortcut (Settings → Security)
export function ApiTokenSettings() {
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await axios.get('/api/users/me/api-token');
    setStatus(data.data);
  };

  useEffect(() => {
    load().catch(() => setStatus({ exists: false, createdAt: null, lastUsedAt: null }));
  }, []);

  const generate = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post('/api/users/me/api-token');
      setNewToken(data.data.token);
      await load();
    } catch (err) {
      toast.error(apiMessage(err) || "Couldn't create a token");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      await axios.delete('/api/users/me/api-token');
      setNewToken(null);
      await load();
      toast.success('Token revoked');
    } catch (err) {
      toast.error(apiMessage(err) || "Couldn't revoke the token");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed; select the token and copy it manually');
    }
  };

  return (
    <section className="space-y-4 rounded-[24px] bg-card p-5 shadow-resting">
      <div>
        <h2 className="text-[19px] font-bold">Shortcut token</h2>
        <p className="text-sm text-muted-foreground">Lets your iOS Shortcut add transactions. It can only add transactions.</p>
      </div>

      <p className="text-sm">
        {!status ? 'Loading…' : !status.exists ? 'No token yet' : (
          <>
            Created {day(status.createdAt!)} · {status.lastUsedAt ? `last used ${day(status.lastUsedAt)}` : 'not used yet'}
          </>
        )}
      </p>

      {newToken && (
        <div className="space-y-2 rounded-[20px] bg-lime-soft p-4">
          <p className="text-sm font-semibold">Copy it now. It won't be shown again.</p>
          <code data-testid="new-api-token" className="block break-all text-sm">{newToken}</code>
          <Button type="button" variant="secondary" className="h-11 rounded-full" onClick={copy}>Copy token</Button>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="button" disabled={busy} className="h-11 flex-1 rounded-full" onClick={generate}>
          {status?.exists ? 'Regenerate' : 'Generate token'}
        </Button>
        {status?.exists && (
          <Button type="button" variant="secondary" disabled={busy} className="h-11 rounded-full text-expense" onClick={revoke}>
            Revoke
          </Button>
        )}
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>In the Shortcut, use “Get Contents of URL”:</p>
        <p>POST <code className="break-all text-foreground">{apiUrl}/api/capture/text</code></p>
        <p>Header <code className="text-foreground">Authorization: Bearer &lt;token&gt;</code></p>
        <p>JSON body <code className="text-foreground">{'{"text": <extracted text>}'}</code>, then show the response's <code className="text-foreground">message</code>.</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Render it in Settings → Security**

In `client/src/pages/Settings.tsx`, add `import { ApiTokenSettings } from '@/components/api-token-settings';` and, inside the `section === 'security'` block, render `<ApiTokenSettings />` directly after `<BiometricSettings />`.

- [ ] **Step 5: Run tests**

Run: `npx tsc -b --noEmit && npx playwright test e2e/capture.e2e.ts`
Expected: PASS (C1).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/api-token-settings.tsx client/src/pages/Settings.tsx client/e2e/capture.e2e.ts
git commit -m "feat(client): Shortcut token card in Settings → Security"
```

---

### Task 9: Scan photo in the Add sheet

**Files:**
- Create: `client/src/lib/image.ts`
- Modify: `client/src/hooks/use-transaction-form.ts`
- Modify: `client/src/components/finance/transaction-form.tsx`
- Modify: `client/e2e/capture.e2e.ts` (append)

- [ ] **Step 1: Write the failing e2e scenarios**

Append to `client/e2e/capture.e2e.ts` (and extend the import with `seedWallet, seedCategory, txCount, openAddSheet, saveButton, row`):

```ts
// 1×1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('C2 a scanned photo fills the form and nothing saves until Save', async ({ page }) => {
  await signUp(page, 'c2');
  const wallet = await seedWallet(page, 'KRW', 100000, 'KRW Main');
  const food = await seedCategory(page, 'EXPENSE', 'Food');
  let uploaded: { image: string; mimeType: string } | undefined;
  await page.route('**/api/capture/photo', async (route) => {
    uploaded = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'success', data: { draft: {
        type: 'EXPENSE', amount: 48500, description: 'Emart', date: '2026-10-09T05:20:00.000Z',
        walletId: wallet, walletName: 'KRW Main', currency: 'KRW', categoryId: food, categoryName: 'Food',
      } } }),
    });
  });
  await page.goto('/');

  const sheet = await openAddSheet(page);
  await sheet.getByLabel('Scan photo').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PNG });

  await expect(sheet.getByText('Filled from photo. Check before saving.')).toBeVisible();
  await expect(sheet.getByLabel('Amount')).toHaveValue('48500');
  await expect(sheet.getByPlaceholder('What was it for?')).toHaveValue('Emart');
  await expect(sheet.getByRole('button', { name: 'Food' })).toHaveAttribute('aria-pressed', 'true');
  expect(uploaded?.mimeType).toBe('image/jpeg'); // downscaled and re-encoded on the client
  expect(await txCount(page, wallet)).toBe(0);

  await saveButton(sheet).click();
  await expect(row(page, 'Emart')).toBeVisible();
  expect(await txCount(page, wallet)).toBe(1);
});

test('C3 a failed scan shows the reason and keeps the form editable', async ({ page }) => {
  await signUp(page, 'c3');
  await seedWallet(page);
  await page.route('**/api/capture/photo', (route) =>
    route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ status: 'fail', message: "Couldn't find an amount" }) })
  );
  await page.goto('/');

  const sheet = await openAddSheet(page);
  await sheet.getByLabel('Scan photo').setInputFiles({ name: 'blurry.png', mimeType: 'image/png', buffer: PNG });

  await expect(sheet.getByText("Couldn't find an amount")).toBeVisible();
  await sheet.getByLabel('Amount').fill('1000');
  await expect(sheet.getByLabel('Amount')).toHaveValue('1000');
});

test('C4 editing a transaction has no Scan photo option', async ({ page }) => {
  await signUp(page, 'c4');
  const wallet = await seedWallet(page);
  const food = await seedCategory(page, 'EXPENSE', 'Food');
  await page.request.post(`${API}/api/transactions`, { data: { walletId: wallet, categoryId: food, amount: 1000, description: 'edit-me', date: new Date().toISOString() } });
  await page.goto('/transactions');
  await row(page, 'edit-me').click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit transaction' }).getByLabel('Scan photo')).toHaveCount(0);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test e2e/capture.e2e.ts`
Expected: C2 and C3 FAIL ("Scan photo" not found); C4 passes trivially (keeps it from regressing).

- [ ] **Step 3: Image downscaling helper**

Create `client/src/lib/image.ts`:

```ts
// Shrink a photo to at most `maxSize` px on its longest side and re-encode as JPEG,
// so uploads stay small (the API accepts ≤5 MB) and EXIF orientation is applied.
export async function downscaleImage(file: File, maxSize = 1600): Promise<{ image: string; mimeType: 'image/jpeg' }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not supported');
  context.fillStyle = '#ffffff'; // flatten transparency for JPEG
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { image: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' };
}
```

- [ ] **Step 4: `applyDraft` in the form hook**

In `client/src/hooks/use-transaction-form.ts`, add this interface below `TransactionFormData`:

```ts
// What POST /api/capture/photo returns (see backend capture.service TransactionDraft)
export interface TransactionDraft {
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  walletId: string;
  categoryId: string;
}
```

add this function next to `updateField`:

```ts
  // Fill the form from an AI draft; the user still reviews it and taps Save
  const applyDraft = (draft: TransactionDraft) => {
    setFormData(prev => ({
      ...prev,
      description: draft.description,
      amount: String(draft.amount),
      date: draft.date,
      walletId: draft.walletId,
      categoryId: draft.categoryId,
    }));
    setSubmitError(null);
  };
```

and add `applyDraft,` and `setSubmitError,` to the object returned by `useTransactionForm`.

- [ ] **Step 5: Scan photo pill in the form**

In `client/src/components/finance/transaction-form.tsx`:

1. Imports: change `import { useState } from 'react';` to `import { useRef, useState } from 'react';`, change `import { Plus } from 'lucide-react';` to `import { Camera, Plus } from 'lucide-react';`, and add:

```tsx
import { isAxiosError } from 'axios';
import { downscaleImage } from '@/lib/image';
import type { TransactionDraft } from '../../hooks/use-transaction-form';
```

2. Inside `TransactionForm`, after `const [newCategory, setNewCategory] = useState<string | null>(null);` add:

```tsx
  const fileInput = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
```

3. Add `applyDraft` to the destructuring of `useTransactionForm(...)`.

4. After the `createCategory` function add:

```tsx
  // Photo → AI draft → form. Nothing is saved until the user taps Save.
  const scanPhoto = async (file: File | undefined) => {
    if (!file) return;
    setScanning(true);
    setScanError(null);
    setScanned(false);
    try {
      const payload = await downscaleImage(file);
      const { data } = await axios.post('/api/capture/photo', payload);
      const draft: TransactionDraft = data.data.draft;
      setType(draft.type);
      await refetchCategories(); // the draft may use a just-created "Other" category
      applyDraft(draft);
      setScanned(true);
    } catch (err) {
      setScanError((isAxiosError(err) && err.response?.data?.message) || "Couldn't read the photo. Enter the details manually.");
    } finally {
      setScanning(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };
```

5. Replace the type switch block:

```tsx
      <div role="group" aria-label="Type" className="flex gap-2">
        <ChoiceChip selected={type === 'EXPENSE'} onClick={() => switchType('EXPENSE')}>Expense</ChoiceChip>
        <ChoiceChip selected={type === 'INCOME'} onClick={() => switchType('INCOME')}>Income</ChoiceChip>
      </div>
```

with:

```tsx
      <div className="flex items-center gap-2">
        <div role="group" aria-label="Type" className="flex gap-2">
          <ChoiceChip selected={type === 'EXPENSE'} onClick={() => switchType('EXPENSE')}>Expense</ChoiceChip>
          <ChoiceChip selected={type === 'INCOME'} onClick={() => switchType('INCOME')}>Income</ChoiceChip>
        </div>
        {!transaction && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              aria-label="Scan photo"
              className="sr-only"
              onChange={(e) => scanPhoto(e.target.files?.[0])}
            />
            <ChoiceChip className="ml-auto" disabled={scanning} onClick={() => fileInput.current?.click()}>
              <span className="flex items-center gap-1.5"><Camera className="size-4" /> {scanning ? 'Reading…' : 'Scan'}</span>
            </ChoiceChip>
          </>
        )}
      </div>

      {scanning && <p className="text-sm text-muted-foreground">Reading photo…</p>}
      {scanned && <p className="rounded-[20px] bg-lime-soft px-4 py-3 text-sm font-semibold">Filled from photo. Check before saving.</p>}
      {scanError && <p role="alert" className="text-sm text-expense">{scanError}</p>}
```

6. Disable saving while a scan runs: change the submit button's `disabled={isSubmitting}` to `disabled={isSubmitting || scanning}`.

- [ ] **Step 6: Run tests**

Run: `npx tsc -b --noEmit && npx playwright test e2e/capture.e2e.ts e2e/dashboard.e2e.ts`
Expected: C1–C4 and all dashboard scenarios PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/lib/image.ts client/src/hooks/use-transaction-form.ts client/src/components/finance/transaction-form.tsx client/e2e/capture.e2e.ts
git commit -m "feat(client): scan a photo to fill the Add sheet, confirm before saving"
```

---

### Task 10: Docs and scenario catalog

**Files:**
- Create: `docs/shortcut-setup.md`
- Modify: `client/e2e/SCENARIOS.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Shortcut guide**

Create `docs/shortcut-setup.md`:

```markdown
# iOS Shortcut: add a transaction from a screenshot

Replaces the old n8n workflow. The Shortcut sends the screenshot's text to the backend, which reads it with AI and saves the transaction.

## 1. Get a token

In the app: Settings → Security → Shortcut token → Generate token. Copy it; it is shown once. Revoke or regenerate it there at any time.

## 2. Build the Shortcut

1. **Take Screenshot**
2. **Extract Text from Image** (input: Screenshot)
3. **Get Contents of URL**
   - URL: `https://finance-api.umeh.me/api/capture/text` (local: `http://localhost:8000/api/capture/text`)
   - Method: POST
   - Headers: `Authorization` = `Bearer <your token>`
   - Request Body: JSON, field `text` (Text) = *Extracted Text*
4. **Get Dictionary Value** for key `message` from *Contents of URL*
5. **Show Notification** with *Dictionary Value*

Success shows e.g. "Added -₩6,500 Latte · Coffee · KRW Main". Failures show a short reason, e.g. "Couldn't find an amount", "No USD wallet", "Invalid or missing API token", or "Too many captures, try again in an hour." (limit: 30 captures per hour, shared with in-app photo scans).

Tip: run it from the Back Tap setting or the Action button right after paying.
```

- [ ] **Step 2: Scenario catalog**

In `client/e2e/SCENARIOS.md`, add `capture.e2e.ts` to the "Files:" list and append:

```markdown
## AI capture (`capture.e2e.ts`)
| ID | Scenario | Expected |
|---|---|---|
| C1 | Generate, use and revoke the Shortcut token in Settings | Token shown once; accepted by /api/capture/text; rejected after Revoke |
| C2 | Scan a photo in the Add sheet (AI response mocked) | Form filled, note shown, nothing saved until Save; upload re-encoded as JPEG |
| C3 | Scan fails | Server reason shown; form stays editable |
| C4 | Edit an existing transaction | No Scan option |
```

- [ ] **Step 3: CLAUDE.md**

In `CLAUDE.md` under "Backend (`backend/src/`)", add after the `services/` bullet:

```markdown
- `services/ai.service.ts` — the only Gemini caller (`@google/genai`, JSON-schema output); `services/capture.service.ts` — deterministic rules that turn the AI's labels into a transaction draft (wallet/currency, "Other" category, dates). Routes: `POST /api/capture/text` (iOS Shortcut, personal API token via `middleware/requireApiToken.ts`) saves; `POST /api/capture/photo` (session) returns a draft only. `GEMINI_API_KEY` unset → 503. See `docs/shortcut-setup.md`.
```

and under "Key Conventions" add:

```markdown
- Integration tests mock `extractTransaction` (`jest.mock('../src/services/ai.service', …)`); never call real Gemini in tests. Use `npm run try-capture -- "<text>"` for a manual check.
```

- [ ] **Step 4: Commit**

```bash
git add docs/shortcut-setup.md client/e2e/SCENARIOS.md CLAUDE.md
git commit -m "docs: iOS Shortcut setup and AI capture notes"
```

---

### Task 11: Full verification

- [ ] **Step 1: Backend**

Run (in `backend/`): `npx tsc --noEmit && npx jest && npm run test:int`
Expected: all pass (unit includes `capture.spec.ts`, `ai.spec.ts`; integration includes `capture.int.ts`).

- [ ] **Step 2: Client**

Run (in `client/`): `npx tsc -b --noEmit && npx vitest run && npx playwright test && npm run build`
Expected: all pass; build succeeds.

- [ ] **Step 3: Manual (optional, uses quota)**

With `GEMINI_API_KEY` set in `backend/.env`: `npm run try-capture -- "STARBUCKS 6,500원 10/09 14:20 신한카드 승인"`
Expected: JSON with `amount: 6500`, `type: "EXPENSE"`, `currency: "KRW"`.
