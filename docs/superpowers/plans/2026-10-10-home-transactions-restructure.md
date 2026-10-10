# Home and Transactions Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Home becomes a per-currency overview that absorbs Stats.
- Transactions becomes a per-wallet ledger.
- The Stats page is removed.

**Architecture:**
- The app shell holds two persisted selections: `selectedWalletId` and `selectedCurrency`.
- Pure helpers in `lib/selection.ts` resolve those selections against the current wallet list, falling back when an id is stale.
- Home filters everything to the selected currency's wallets and reuses the existing stats endpoints with `walletIds`.
- Transactions shows the existing ledger for one wallet, chosen by swiping the wallet cards.
- The backend gets two additive query parameters.

**Tech Stack:**
- Backend: Express, Prisma, Zod, Jest + Supertest.
- Client: React 18, Vite, Tailwind, Recharts, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-home-transactions-restructure-design.md`

## Global Constraints

- Branch: work on `feat/home-restructure` from `main`.
  - Commit after each task, with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Never push.
  - Do not commit unrelated working-tree changes that may be present: `backend/package.json` (an `import-statements` script line), `backend/scripts/import-statements.ts`, and `client/dev-dist/*`. Stage only the files your task names.
- Supported currencies are KRW and IDR only. The toggle order is **KRW, then IDR**.
- Home order, top to bottom:
  1. currency toggle
  2. total balance
  3. wallet cards
  4. Latest
  5. month switcher
  6. Summary
  7. year chart
- Home's month switcher drives only Summary (6) and the year chart (7). The total (2), the cards' in/out (3) and Latest (4) always show this month or the newest data.
- Transfers are excluded from every income/expense figure. The backend already does this; the client must not re-add them.
- Navigation is Home · Transactions · **+** · Wallets · Settings. `/stats` redirects to `/`.
- Persisted keys go through `secureStorage.setItem(key, value, true)`: `selected_wallet` and `selected_currency`.
- Copy, verbatim:
  - "Summary"
  - "Latest"
  - "See all transactions"
  - "No transactions in <Month YYYY>"
  - "No transactions yet. Tap + to add one."
  - "<YYYY> by month"
  - "Total"
- Do not hand-edit `client/src/components/ui/`. Never call real Gemini.
- Run suites one after another, never in parallel. Integration tests and Playwright share the DB and need `make infra`.

## Review Focus

1. **A stale selected wallet.** If the saved `selected_wallet` was deleted, Transactions and the + sheet must fall back to the main wallet rather than show an empty list or fail to save (Tasks 2 and 4 tests).
2. **Selection drift on Home.** Toggling the currency on Home must not change `selectedWalletId`, because Home cards only set it on tap. Otherwise Transactions would silently jump wallets (Task 3 test).
3. **Long-press versus tap.** Long-pressing a card to make it Main must not also open Transactions. Tapping "Manage" must open Wallets, not Transactions (Task 3 test).
4. **Queries without wallet ids.** While wallets are still loading, Home must not fetch Latest or stats without `walletIds`. That would briefly mix KRW and IDR (Task 5 test on `enabled`).
5. **`walletIds` belonging to another user.** The transactions list must ignore them (Task 1 test).

---

## File Structure

**Backend**
- Modify `backend/src/schemas/stats.schema.ts`: add `type`.
- Modify `backend/src/controllers/stats.controller.ts` and `backend/src/services/stats.service.ts`: pass `type` through to the breakdown.
- Modify `backend/src/schemas/transaction.schema.ts` and `backend/src/controllers/transaction.controller.ts`: add `walletIds`.
- Create `backend/tests/home.int.ts`.

**Client**
- Create `client/src/lib/selection.ts`: `resolveWalletId`, `currenciesOf`, `resolveCurrency`.
- Modify `client/src/components/app-layout.tsx`: persisted `selectedWalletId` and `selectedCurrency`.
- Modify `client/src/hooks/use-transaction-form.ts` and `client/src/components/finance/transfer-form.tsx`: ignore a stale `defaultWalletId`.
- Modify `client/src/components/finance/wallet-cards.tsx`: add the `walletIds`, `month` and `onOpen` props, make `onSelect` optional, and add the tap guard.
- Modify `client/src/components/finance/transactions-list.tsx`: add a `walletId` prop.
- Modify `client/src/pages/Transactions.tsx`: cards plus a per-wallet list.
- Modify `client/src/hooks/use-transactions.ts`: add the `walletIds` and `enabled` options.
- Modify `client/src/hooks/use-stats.ts`: add `incomeBreakdown` and an `enabled` option.
- Create `client/src/lib/chart-colors.ts`: `useTokenColors`, moved from Stats.
- Create `client/src/components/finance/currency-toggle.tsx`, `currency-summary.tsx` and `year-chart.tsx`.
- Modify `client/src/pages/Dashboard.tsx`: the new Home.
- Modify `client/src/components/app-footer.tsx` and `client/src/Router.tsx`.
- Delete `client/src/pages/Stats.tsx`.
- Create the tests `client/src/test/selection.test.ts`, `WalletCards.test.tsx` and `HomeParts.test.tsx`.
- Delete `client/e2e/stats.e2e.ts`.
- Create `client/e2e/home.e2e.ts`.
- Modify `client/e2e/dashboard.e2e.ts`, `client/e2e/SCENARIOS.md` and `CLAUDE.md`.

---

### Task 1: Backend – income breakdown and multi-wallet transaction list

**Files:**
- Modify: `backend/src/schemas/stats.schema.ts`
- Modify: `backend/src/controllers/stats.controller.ts` (`getCategoryBreakdownHandler`)
- Modify: `backend/src/services/stats.service.ts` (`StatsFilters`, `getCategoryBreakdown`)
- Modify: `backend/src/schemas/transaction.schema.ts` (`getTransactionsSchema`)
- Modify: `backend/src/controllers/transaction.controller.ts` (`getTransactionsHandler`)
- Test: `backend/tests/home.int.ts`

**Interfaces:**
- Produces:
  - `GET /api/stats/category-breakdown?type=INCOME|EXPENSE` (default `EXPENSE`), returning the same item shape as today.
  - `GET /api/transactions?walletIds=a,b`, which returns rows from those wallets only. The existing `walletId` still works.

- [ ] **Step 1: Create the branch**

```bash
git checkout main && git checkout -b feat/home-restructure
```

- [ ] **Step 2: Write the failing integration test**

Create `backend/tests/home.int.ts`:

```ts
/**
 * Integration scenarios for the Home overview queries.
 * Real Postgres + Redis. Run: npm run test:int
 */
process.env.TZ = 'Asia/Seoul';
jest.setTimeout(30000);

import request from 'supertest';
import app, { ready } from '../src/app';
import prisma from '../src/middleware/prismaMiddleware';
import redisClient from '../src/utils/connectRedis';
import { deleteAllSessions } from '../src/services/user.service';

const run = Date.now();
const emails: string[] = [];
type Agent = ReturnType<typeof request.agent>;

async function newUser(tag: string): Promise<Agent> {
  const email = `home-${tag}-${run}@example.test`;
  emails.push(email);
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: tag, email, password: 'password123', passwordConfirm: 'password123' });
  expect(res.status).toBe(201);
  return agent;
}

const wallet = async (a: Agent, currency: string, name: string) =>
  (await a.post('/api/wallets').send({ name, currency, balance: 0 })).body.data.wallet.id as string;
const category = async (a: Agent, name: string, type: 'INCOME' | 'EXPENSE') =>
  (await a.post('/api/categories').send({ name, type })).body.data.category.id as string;
const tx = async (a: Agent, walletId: string, categoryId: string, amount: number) =>
  expect((await a.post('/api/transactions').send({ walletId, categoryId, amount, date: when, description: 'x' })).status).toBe(201);

const when = '2026-10-05T03:00:00.000Z';
const range = 'startDate=2026-09-30T15:00:00.000Z&endDate=2026-10-31T14:59:59.999Z';

beforeAll(async () => {
  await ready;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.transaction.deleteMany({ where: { wallet: { userId: { in: ids } } } });
  await prisma.transfer.deleteMany({ where: { userId: { in: ids } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.category.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await Promise.all(ids.map((id) => deleteAllSessions(id)));
  await prisma.$disconnect();
  await redisClient.quit();
});

describe('category breakdown type', () => {
  it('returns expense categories by default and income categories with type=INCOME', async () => {
    const u = await newUser('breakdown');
    const w = await wallet(u, 'KRW', 'Won');
    await tx(u, w, await category(u, 'Food', 'EXPENSE'), 7000);
    await tx(u, w, await category(u, 'Salary', 'INCOME'), 3_000_000);

    const expense = await u.get(`/api/stats/category-breakdown?walletIds=${w}&${range}`);
    expect(expense.status).toBe(200);
    expect(expense.body.data.map((c: { categoryName: string }) => c.categoryName)).toEqual(['Food']);

    const income = await u.get(`/api/stats/category-breakdown?walletIds=${w}&${range}&type=INCOME`);
    expect(income.status).toBe(200);
    expect(income.body.data.map((c: { categoryName: string }) => c.categoryName)).toEqual(['Salary']);
    expect(income.body.data[0].percentage).toBe(100);

    expect((await u.get(`/api/stats/category-breakdown?type=BOTH`)).status).toBe(400);
  });
});

describe('transactions walletIds', () => {
  it('returns rows from exactly the listed wallets and ignores other users\' wallets', async () => {
    const u = await newUser('multi');
    const a = await wallet(u, 'KRW', 'A');
    const b = await wallet(u, 'KRW', 'B');
    const c = await wallet(u, 'IDR', 'C');
    const food = await category(u, 'Food', 'EXPENSE');
    await tx(u, a, food, 1);
    await tx(u, b, food, 2);
    await tx(u, c, food, 3);

    const other = await newUser('other');
    const foreign = await wallet(other, 'KRW', 'Foreign');
    await tx(other, foreign, await category(other, 'Food', 'EXPENSE'), 99);

    const res = await u.get(`/api/transactions?walletIds=${a},${b},${foreign}&limit=5`);
    expect(res.status).toBe(200);
    const amounts = res.body.data.transactions.map((t: { amount: number }) => t.amount).sort();
    expect(amounts).toEqual([1, 2]);

    const single = await u.get(`/api/transactions?walletId=${c}`);
    expect(single.body.data.transactions.map((t: { amount: number }) => t.amount)).toEqual([3]);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `cd backend && npx jest --testMatch '**/home.int.ts' --runInBand --forceExit`
Expected:
- FAIL: the income breakdown returns `Food`, because the type is hard-coded.
- FAIL: `walletIds` is ignored, so the result is `[1, 2, 3]`, or includes more rows.

- [ ] **Step 4: Add `type` to the breakdown**

In `backend/src/schemas/stats.schema.ts`, add to the `query` object (after `month`):

```ts
    type: z.enum(['INCOME', 'EXPENSE']).optional(),
```

Import `z` if needed: `import { object, string, number, date, TypeOf, z } from 'zod';`

In `backend/src/services/stats.service.ts`:
- Add `type?: 'INCOME' | 'EXPENSE';` to `StatsFilters`.
- In `getCategoryBreakdown`, destructure `type` from `filters`. Replace the hard-coded clause:
  ```ts
    category: {
      type: type ?? 'EXPENSE', // breakdown is per type; expenses unless asked otherwise
    },
  ```

In `backend/src/controllers/stats.controller.ts` (`getCategoryBreakdownHandler`), destructure `type` from `req.query` and add `type,` to `filters`.

- [ ] **Step 5: Add `walletIds` to the transactions list**

In `backend/src/schemas/transaction.schema.ts` (`getTransactionsSchema.query`), add after `walletId`:

```ts
    // Comma-separated; Home's "Latest" spans every wallet of one currency
    walletIds: string().optional().refine((val) => !val || val.split(',').every((id) => id.trim().length > 0), {
      message: 'Invalid wallet IDs format',
    }),
```

In `backend/src/controllers/transaction.controller.ts` (`getTransactionsHandler`), destructure `walletIds` from `req.query` and add the following after `if (walletId) where.walletId = walletId;`:

```ts
    if (walletIds) where.walletId = { in: walletIds.split(',').map((id) => id.trim()) };
```

`where.wallet.userId` already scopes the rows to the user, so another user's ids match nothing.

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd backend && npx jest --testMatch '**/home.int.ts' --runInBand --forceExit && npx tsc --noEmit && npm test && npm run test:int`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/schemas/stats.schema.ts backend/src/controllers/stats.controller.ts backend/src/services/stats.service.ts backend/src/schemas/transaction.schema.ts backend/src/controllers/transaction.controller.ts backend/tests/home.int.ts
git commit -m "feat(api): income category breakdown and multi-wallet transaction list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Client – persisted selection and stale-wallet fallback

**Files:**
- Create: `client/src/lib/selection.ts`
- Modify: `client/src/components/app-layout.tsx`
- Modify: `client/src/hooks/use-transaction-form.ts:84-91`
- Modify: `client/src/components/finance/transfer-form.tsx:46-50`
- Test: `client/src/test/selection.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // lib/selection.ts
  export type Currency = 'KRW' | 'IDR';
  type WalletLike = { id: string; currency: string; isMain: boolean };
  export function resolveWalletId(wallets: WalletLike[], stored?: string): string | undefined;
  export function currenciesOf(wallets: WalletLike[]): string[];           // 'KRW' first, then 'IDR', then any other
  export function resolveCurrency(wallets: WalletLike[], stored?: string): string | undefined;
  ```
  And the `AppShellContext`:
  ```ts
  selectedWalletId?: string;  setSelectedWalletId: (id: string) => void;   // persisted as 'selected_wallet'
  selectedCurrency?: string;  setSelectedCurrency: (c: string) => void;    // persisted as 'selected_currency'
  dataVersion: number;        notifyDataChanged: () => void;
  ```
  The shell stores the raw values. Consumers resolve them with the helpers above.

- [ ] **Step 1: Write the failing test**

Create `client/src/test/selection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveWalletId, currenciesOf, resolveCurrency } from '@/lib/selection';

const krwMain = { id: 'k1', currency: 'KRW', isMain: true };
const krw2 = { id: 'k2', currency: 'KRW', isMain: false };
const idr = { id: 'i1', currency: 'IDR', isMain: false };

describe('resolveWalletId', () => {
  it('keeps a stored wallet that still exists', () => {
    expect(resolveWalletId([krwMain, krw2, idr], 'i1')).toBe('i1');
  });
  it('falls back to the main wallet when the stored one is gone', () => {
    expect(resolveWalletId([krw2, krwMain], 'deleted')).toBe('k1');
  });
  it('falls back to the first wallet when none is main', () => {
    expect(resolveWalletId([krw2, idr], undefined)).toBe('k2');
  });
  it('is undefined with no wallets', () => {
    expect(resolveWalletId([], 'k1')).toBeUndefined();
  });
});

describe('currenciesOf', () => {
  it('lists KRW before IDR without duplicates', () => {
    expect(currenciesOf([idr, krw2, krwMain])).toEqual(['KRW', 'IDR']);
  });
  it('lists a single currency alone', () => {
    expect(currenciesOf([krw2, krwMain])).toEqual(['KRW']);
  });
});

describe('resolveCurrency', () => {
  it('keeps a stored currency the user still has', () => {
    expect(resolveCurrency([krwMain, idr], 'IDR')).toBe('IDR');
  });
  it("defaults to the main wallet's currency", () => {
    expect(resolveCurrency([idr, { ...krw2, isMain: true }], undefined)).toBe('KRW');
    expect(resolveCurrency([krwMain], 'IDR')).toBe('KRW');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd client && npx vitest run src/test/selection.test.ts`
Expected: FAIL because `@/lib/selection` doesn't exist.

- [ ] **Step 3: Implement the helpers**

Create `client/src/lib/selection.ts`:

```ts
// Shell selections are stored raw (they may point at a deleted wallet); these resolve them against the current list
export type Currency = 'KRW' | 'IDR';
type WalletLike = { id: string; currency: string; isMain: boolean };

const ORDER = ['KRW', 'IDR'];

const fallback = (wallets: WalletLike[]) => wallets.find((w) => w.isMain) ?? wallets[0];

export function resolveWalletId(wallets: WalletLike[], stored?: string): string | undefined {
  return wallets.find((w) => w.id === stored)?.id ?? fallback(wallets)?.id;
}

export function currenciesOf(wallets: WalletLike[]): string[] {
  const present = [...new Set(wallets.map((w) => w.currency))];
  const rank = (c: string) => (ORDER.includes(c) ? ORDER.indexOf(c) : ORDER.length);
  return present.sort((a, b) => rank(a) - rank(b));
}

export function resolveCurrency(wallets: WalletLike[], stored?: string): string | undefined {
  return stored && currenciesOf(wallets).includes(stored) ? stored : fallback(wallets)?.currency;
}
```

- [ ] **Step 4: Persist the selections in the shell**

Replace the state and context in `client/src/components/app-layout.tsx`:

```tsx
import { useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { AppHeader } from './app-header';
import { AppFooter } from './app-footer';
import { AddTransactionSheet } from './finance/add-transaction-sheet';
import { secureStorage } from '@/services/secure-storage.service';

export interface AppShellContext {
  // Wallet shown on Transactions (raw; resolve with resolveWalletId). The Add sheet defaults to it.
  selectedWalletId?: string;
  setSelectedWalletId: (walletId: string) => void;
  // Currency shown on Home (raw; resolve with resolveCurrency)
  selectedCurrency?: string;
  setSelectedCurrency: (currency: string) => void;
  // Bumped after the global Add sheet saves, so pages can refetch
  dataVersion: number;
  notifyDataChanged: () => void;
}

export const useAppShell = () => useOutletContext<AppShellContext>();

// State remembered across reloads in localStorage
function usePersisted(key: string) {
  const [value, setValue] = useState<string | undefined>(() => secureStorage.getItem(key) ?? undefined);
  const set = (next: string) => {
    setValue(next);
    secureStorage.setItem(key, next, true);
  };
  return [value, set] as const;
}

export function AppLayout() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = usePersisted('selected_wallet');
  const [selectedCurrency, setSelectedCurrency] = usePersisted('selected_currency');
  const [dataVersion, setDataVersion] = useState(0);
  const notifyDataChanged = () => setDataVersion((v) => v + 1);

  return (
    <div className="min-h-screen flex flex-col w-full">
      <AppHeader />
      <main className="w-full max-w-[480px] mx-auto px-6 flex flex-grow flex-col pb-32">
        <Outlet
          context={{ selectedWalletId, setSelectedWalletId, selectedCurrency, setSelectedCurrency, dataVersion, notifyDataChanged } satisfies AppShellContext}
        />
      </main>
      <AppFooter onAdd={() => setIsAddOpen(true)} />
      <AddTransactionSheet
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        defaultWalletId={selectedWalletId}
        onTransactionChange={notifyDataChanged}
      />
    </div>
  );
}
```

Check `secureStorage.getItem`/`setItem` in `client/src/services/secure-storage.service.ts`, and that `clearOfflineStorage` or logout don't wipe the `persistent` keys in a way that breaks this. Losing them on logout is fine.

- [ ] **Step 5: Ignore a stale default wallet in both forms**

In `client/src/hooks/use-transaction-form.ts` (the "New transactions start on…" effect), replace `const walletId = defaultWalletId ?? fallback?.id;` with:

```ts
    const walletId = wallets.some((w) => w.id === defaultWalletId) ? defaultWalletId : fallback?.id;
```

In `client/src/components/finance/transfer-form.tsx` (the "New transfers start from…" effect), replace the `setFrom(...)` line with:

```ts
    setFrom(wallets.some((w) => w.id === defaultWalletId) ? defaultWalletId! : (wallets.find((w) => w.isMain) ?? wallets[0]).id);
```

Add one case to `client/src/test/TransferForm.test.tsx`: render with `defaultWalletId="deleted"` and assert that the From wallet combobox shows "Won bank", the main wallet in that file's mock.

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd client && npx vitest run && npx tsc --noEmit -p tsconfig.app.json`
Expected: all PASS. `Dashboard.tsx` still compiles, because it only uses `selectedWalletId`, `setSelectedWalletId`, `dataVersion` and `notifyDataChanged`.

- [ ] **Step 7: Commit**

```bash
git add client/src/lib/selection.ts client/src/components/app-layout.tsx client/src/hooks/use-transaction-form.ts client/src/components/finance/transfer-form.tsx client/src/test/selection.test.ts client/src/test/TransferForm.test.tsx
git commit -m "feat(client): persisted wallet and currency selection with stale-id fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Client – WalletCards: subset, month, tap to open

**Files:**
- Modify: `client/src/components/finance/wallet-cards.tsx`
- Test: `client/src/test/WalletCards.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces the new props:
  ```ts
  interface WalletCardsProps {
    selectedWalletId?: string;
    onSelect?: (walletId: string) => void; // swipe selects (Transactions). Omitted on Home: swiping only browses.
    onOpen?: (walletId: string) => void;   // tap a card (Home). Omitted: cards are not tappable.
    walletIds?: string[];                  // show only these wallets (Home: the selected currency's)
    month?: Date;                          // in/out period; defaults to the current month
    refreshKey?: number;
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `client/src/test/WalletCards.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from '@/lib/axios';
import { WalletCards } from '@/components/finance/wallet-cards';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
const setMainWallet = vi.fn();
vi.mock('@/hooks/use-wallets', () => ({
  useWallets: () => ({
    wallets: [
      { id: 'k1', name: 'Won', currency: 'KRW', isMain: true, balance: 1000, color: '#000', _count: { transactions: 0 } },
      { id: 'i1', name: 'Rupiah', currency: 'IDR', isMain: false, balance: 5, color: '#000', _count: { transactions: 0 } },
    ],
    loading: false, error: null, refetch: vi.fn(), setMainWallet,
  }),
}));

const renderCards = (props: Parameters<typeof WalletCards>[0]) =>
  render(<MemoryRouter><WalletCards {...props} /></MemoryRouter>);

describe('WalletCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (axios.get as any).mockResolvedValue({ data: { data: { transactions: [] } } });
  });

  it('shows only the given wallets and does not change the selection without onSelect', () => {
    const onOpen = vi.fn();
    renderCards({ walletIds: ['i1'], onOpen, selectedWalletId: 'k1' });
    expect(screen.queryByLabelText('Won', { selector: 'article' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Rupiah', { selector: 'article' })).toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('tap opens; long-press makes main without opening; Manage does not open', () => {
    vi.useFakeTimers();
    const onOpen = vi.fn();
    renderCards({ onOpen });
    const card = screen.getByLabelText('Rupiah', { selector: 'article' });

    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledWith('i1');

    onOpen.mockClear();
    fireEvent.pointerDown(card);
    act(() => { vi.advanceTimersByTime(600); });
    fireEvent.pointerUp(card);
    fireEvent.click(card);
    expect(setMainWallet).toHaveBeenCalledWith('i1');
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Manage Rupiah'));
    expect(onOpen).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('fetches in/out for the given month', () => {
    renderCards({ month: new Date(2026, 8, 15) });
    const params = (axios.get as any).mock.calls[0][1].params;
    expect(new Date(params.startDate).getMonth()).toBe(8);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd client && npx vitest run src/test/WalletCards.test.tsx`
Expected: FAIL. `onSelect` is currently required (a TS error under vitest is fine), the subset is ignored, tap does nothing, and the month is ignored.

- [ ] **Step 3: Implement the props**

In `client/src/components/finance/wallet-cards.tsx`:

1. Replace `WalletCardsProps` with the interface above. Change the signature to `export function WalletCards({ selectedWalletId, onSelect, onOpen, walletIds, month, refreshKey }: WalletCardsProps)`.
2. Rename the hook's list: `const { wallets: allWallets, loading, error, refetch, setMainWallet } = useWallets();`. Then add:
   ```ts
   const wallets = useMemo(
     () => (walletIds ? allWallets.filter((w) => walletIds.includes(w.id)) : allWallets),
     [allWallets, walletIds?.join(',')]
   );
   const period = month ?? new Date();
   const periodKey = `${period.getFullYear()}-${period.getMonth()}`;
   const isThisMonth = periodKey === `${new Date().getFullYear()}-${new Date().getMonth()}`;
   const periodText = isThisMonth ? 'this month' : `in ${period.toLocaleDateString('en-US', { month: 'long' })}`;
   ```
   (Import `useMemo`.)
3. In the "Default selection" effect, only call `onSelect` when it's provided, and scroll to the selected card only if it's in the list:
   ```ts
   useEffect(() => {
     if (wallets.length === 0) return;
     const current = wallets.find((w) => w.id === selectedWalletId) ?? (onSelect ? wallets.find((w) => w.isMain) ?? wallets[0] : undefined);
     if (!current) return;
     if (onSelect && current.id !== selectedWalletId) onSelect(current.id);
     const index = wallets.indexOf(current);
     const el = scroller.current?.children[index] as HTMLElement | undefined;
     if (el && scroller.current) scroller.current.scrollLeft = el.offsetLeft - scroller.current.offsetLeft - 24;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [wallets]);
   ```
4. In the month-totals effect, use `period` instead of `now`, and make the dependency list `[wallets, periodKey]`.
5. In `onScroll`, return early when `!onSelect`: `if (!el || el.children.length === 0 || !onSelect) return;`
6. Long-press guard and tap:
   ```ts
   const longPressed = useRef(false);
   const startPress = (walletId: string) => {
     longPressed.current = false;
     pressTimer.current = window.setTimeout(() => { longPressed.current = true; makeMain(walletId); }, LONG_PRESS_MS);
   };
   const open = (walletId: string) => {
     if (longPressed.current) { longPressed.current = false; return; }
     onOpen?.(walletId);
   };
   ```
7. On the `<article>`, add these only when `onOpen` is set:
   ```tsx
   {...(onOpen && {
     role: 'button',
     tabIndex: 0,
     onClick: () => open(wallet.id),
     onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(wallet.id); } },
   })}
   ```
   Keep `aria-label={wallet.name}`, and add `cursor-pointer` to its class when `onOpen` is set.
8. On the "Manage" `<Link>`, add `onClick={(e) => e.stopPropagation()}` and `onPointerDown={(e) => e.stopPropagation()}`.
9. Replace the captions' and the progress bar's "this month" with `periodText`:
   - `'No income ' + periodText`
   - `'No activity ' + periodText`
   - `aria-label={\`Share of income spent ${periodText}\`}`

   Keep the other text unchanged.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd client && npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npm run lint 2>&1 | tail -3`
Expected:
- vitest PASS.
- `tsc` reports errors only in `Dashboard.tsx` if it no longer type-checks. It should still compile, because `onSelect` is now optional.
- No new lint errors (the baseline has about 70 pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/finance/wallet-cards.tsx client/src/test/WalletCards.test.tsx
git commit -m "feat(client): wallet cards can show a subset, a chosen month, and open on tap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Client – Transactions becomes the per-wallet ledger

**Files:**
- Modify: `client/src/components/finance/transactions-list.tsx` (`TransactionsListProps`, `TransactionsList`)
- Modify: `client/src/pages/Transactions.tsx`
- Test: `client/src/test/TransactionsPage.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 2: `useAppShell()` with `selectedWalletId`/`setSelectedWalletId`, and `resolveWalletId`
  - from Task 3: `WalletCards` with `selectedWalletId`, `onSelect` and `month`
- Produces: `TransactionsList` takes `walletId?: string` and passes it to `useTransactions`.

- [ ] **Step 1: Write the failing test**

Create `client/src/test/TransactionsPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MonthlyTransactionsView } from '@/pages/Transactions';

const listProps = vi.fn();
const cardProps = vi.fn();
vi.mock('@/components/finance/transactions-list', () => ({
  TransactionsList: (p: unknown) => { listProps(p); return null; },
}));
vi.mock('@/components/finance/wallet-cards', () => ({
  WalletCards: (p: unknown) => { cardProps(p); return null; },
}));
vi.mock('@/hooks/use-wallets', () => ({
  useWallets: () => ({ wallets: [{ id: 'k1', currency: 'KRW', isMain: true }, { id: 'i1', currency: 'IDR', isMain: false }] }),
}));
const shell = { selectedWalletId: 'deleted', setSelectedWalletId: vi.fn(), dataVersion: 0 };
vi.mock('@/components/app-layout', () => ({ useAppShell: () => shell }));

describe('Transactions page', () => {
  it('lists only the resolved wallet (main when the stored one is gone)', () => {
    render(<MonthlyTransactionsView />);
    expect(listProps).toHaveBeenLastCalledWith(expect.objectContaining({ walletId: 'k1' }));
    expect(cardProps).toHaveBeenLastCalledWith(expect.objectContaining({ selectedWalletId: 'k1', onSelect: shell.setSelectedWalletId }));
  });

  it('cards follow the page month', () => {
    render(<MonthlyTransactionsView />);
    const { month } = cardProps.mock.lastCall![0] as { month: Date };
    const list = listProps.mock.lastCall![0] as { currentDate: Date };
    expect(month).toBe(list.currentDate);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd client && npx vitest run src/test/TransactionsPage.test.tsx`
Expected: FAIL. The page renders no `WalletCards`, and the list has no `walletId`.

- [ ] **Step 3: Implement**

In `client/src/components/finance/transactions-list.tsx`:
- Add `walletId?: string;` to `TransactionsListProps`.
- Destructure `walletId` in `TransactionsList`.
- Pass it in: `useTransactions({ limit, month, year, refreshKey, walletId })`.

Replace `client/src/pages/Transactions.tsx` with:

```tsx
import { useState } from 'react';
import { getCurrentDate } from '@/lib/date-utils';
import { TransactionsList } from '@/components/finance/transactions-list';
import { WalletCards } from '@/components/finance/wallet-cards';
import { PageTitle } from '@/components/page-header';
import { useAppShell } from '@/components/app-layout';
import { useWallets } from '@/hooks/use-wallets';
import { resolveWalletId } from '@/lib/selection';

// One wallet's ledger: swipe the cards to pick the wallet; the month drives the list and the cards' in/out
export function MonthlyTransactionsView() {
  const [currentDate, setCurrentDate] = useState(getCurrentDate());
  const { selectedWalletId, setSelectedWalletId, dataVersion } = useAppShell();
  const { wallets } = useWallets();
  const walletId = resolveWalletId(wallets, selectedWalletId);

  return (
    <>
      <PageTitle eyebrow="Monthly ledger" title="Transactions" />
      <WalletCards selectedWalletId={walletId} onSelect={setSelectedWalletId} month={currentDate} refreshKey={dataVersion} />
      {walletId && (
        <div className="mt-6">
          <TransactionsList
            walletId={walletId}
            month={currentDate.getMonth() + 1}
            year={currentDate.getFullYear()}
            currentDate={currentDate}
            onMonthChange={setCurrentDate}
            refreshKey={dataVersion}
          />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd client && npx vitest run && npx tsc --noEmit -p tsconfig.app.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/finance/transactions-list.tsx client/src/pages/Transactions.tsx client/src/test/TransactionsPage.test.tsx
git commit -m "feat(client): Transactions is a per-wallet ledger with swipeable wallet cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Client – Home building blocks (data hooks, toggle, summary, year chart)

**Files:**
- Modify: `client/src/hooks/use-transactions.ts`
- Modify: `client/src/hooks/use-stats.ts`
- Create: `client/src/lib/chart-colors.ts`
- Create: `client/src/components/finance/currency-toggle.tsx`
- Create: `client/src/components/finance/currency-summary.tsx`
- Create: `client/src/components/finance/year-chart.tsx`
- Test: `client/src/test/HomeParts.test.tsx`

**Interfaces:**
- Consumes (Task 1): `GET /api/stats/category-breakdown?type=INCOME` and `GET /api/transactions?walletIds=`.
- Produces:
  ```ts
  // use-transactions: new options
  walletIds?: string[];   // sent as walletIds=a,b (ignored if walletId is also given)
  enabled?: boolean;      // default true; false = no request, loading stays true

  // use-stats: new option and return value
  enabled?: boolean;                        // default true
  incomeBreakdown: CategoryBreakdown[];     // same shape as categoryBreakdown, type=INCOME
  export type { CategoryBreakdown, MonthlySummary, TrendData };   // exported for the components below

  // components
  export function CurrencyToggle(props: { currencies: string[]; value: string; onChange: (c: string) => void }): JSX.Element | null; // null when currencies.length < 2
  export function CurrencySummary(props: { currency: string; monthLabel: string; summary: MonthlySummary | null; expenses: CategoryBreakdown[]; incomes: CategoryBreakdown[] }): JSX.Element;
  export function YearChart(props: { year: number; data: TrendData[]; currency: string; highlightMonth: number }): JSX.Element; // highlightMonth 1-12
  export function useTokenColors(): { income: string; expense: string; grid: string; muted: string };
  ```

- [ ] **Step 1: Write the failing test**

Create `client/src/test/HomeParts.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CurrencyToggle } from '@/components/finance/currency-toggle';
import { CurrencySummary } from '@/components/finance/currency-summary';
import { barOpacity } from '@/components/finance/year-chart';

describe('CurrencyToggle', () => {
  it('is hidden with a single currency', () => {
    const { container } = render(<CurrencyToggle currencies={['KRW']} value="KRW" onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows KRW and IDR as radio chips', () => {
    render(<CurrencyToggle currencies={['KRW', 'IDR']} value="IDR" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /IDR/ })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('CurrencySummary', () => {
  const summary = { income: 3000000, expense: 7000, balance: 2993000, month: 10, year: 2026 };
  const cat = (name: string, type: 'INCOME' | 'EXPENSE', amount: number) =>
    ({ categoryId: name, categoryName: name, amount, percentage: 100, type, color: '#000' });

  it('shows income, expense, net and both category lists', () => {
    render(<CurrencySummary currency="KRW" monthLabel="October 2026" summary={summary}
      expenses={[cat('Food', 'EXPENSE', 7000)]} incomes={[cat('Salary', 'INCOME', 3000000)]} />);
    expect(screen.getByRole('heading', { name: 'Summary' })).toBeInTheDocument();
    expect(screen.getByText('+₩3,000,000', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('₩2,993,000')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Salary')).toBeInTheDocument();
  });

  it('shows the empty message for a month with nothing', () => {
    render(<CurrencySummary currency="KRW" monthLabel="September 2026" summary={{ ...summary, income: 0, expense: 0, balance: 0 }} expenses={[]} incomes={[]} />);
    expect(screen.getByText('No transactions in September 2026')).toBeInTheDocument();
  });
});

describe('YearChart', () => {
  it('dims every month except the highlighted one', () => {
    expect(barOpacity(10, 10)).toBe(1);
    expect(barOpacity(3, 10)).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd client && npx vitest run src/test/HomeParts.test.tsx`
Expected: FAIL because the modules don't exist.

- [ ] **Step 3: Extend the data hooks**

In `client/src/hooks/use-transactions.ts`:
- Add `walletIds?: string[];` and `enabled?: boolean;` to `UseTransactionsOptions`, and destructure `walletIds` and `enabled = true` with the other options.
- After `if (walletId) query.append('walletId', walletId);`, add:
  ```ts
  else if (walletIds && walletIds.length > 0) query.append('walletIds', walletIds.join(','));
  ```
- In the fetch effect, skip fetching when disabled, and include `enabled` in its dependencies:
  ```ts
  useEffect(() => {
    if (!enabled) return;
    fetchTransactions(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, refreshKey, enabled]);
  ```

In `client/src/hooks/use-stats.ts`:
- Add `export` to the `MonthlySummary`, `CategoryBreakdown` and `TrendData` interfaces.
- Add `enabled?: boolean;` to `StatsFilters`, and `incomeBreakdown: CategoryBreakdown[];` to `UseStatsReturn`.
- Add the state `const [incomeBreakdown, setIncomeBreakdown] = useState<CategoryBreakdown[]>([]);`.
- Add the cache key `const incomeKey = \`stats-income?${params}\`;`. Restore it in `useCached`, and treat it as present when any of the four keys has data.
- Fetch four requests in `Promise.all`. The fourth is `axios.get(\`/api/stats/category-breakdown?${params.toString()}&type=INCOME\`)`. Set and save `incomeBreakdown` like the others.
- In the effect, add `if (filters.enabled === false) return;` first, and add `filters.enabled` to the dependency list.
- Return `incomeBreakdown`.

- [ ] **Step 4: Move the chart colours**

Create `client/src/lib/chart-colors.ts` with `useTokenColors`, copied verbatim from `client/src/pages/Stats.tsx` (lines 15–24) together with its imports (`useMemo`, `useTheme`), and exported:

```ts
import { useMemo } from 'react';
import { useTheme } from '@/contexts/theme.context';

// Chart colors come from the theme tokens (SVG attributes can't read CSS variables)
export function useTokenColors() {
  const { theme } = useTheme();
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const get = (name: string) => css.getPropertyValue(name).trim();
    return { income: get('--income'), expense: get('--expense'), grid: get('--border'), muted: get('--muted-foreground') };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}
```

- [ ] **Step 5: Write the three components**

Create `client/src/components/finance/currency-toggle.tsx`:

```tsx
import { FilterChips } from './filter-chips';

// Home's currency switch; hidden when every wallet uses the same currency
export function CurrencyToggle({ currencies, value, onChange }: { currencies: string[]; value: string; onChange: (c: string) => void }) {
  if (currencies.length < 2) return null;
  return <FilterChips label="Currency" options={currencies.map((c) => ({ value: c, label: c }))} value={value} onChange={onChange} />;
}
```

Create `client/src/components/finance/currency-summary.tsx`. The markup is moved from Stats' "Monthly summary" and "Where it went" sections:

```tsx
import { RowsCard } from './transactions-list';
import type { CategoryBreakdown, MonthlySummary } from '@/hooks/use-stats';
import { formatAmount } from '@/lib/format-utils';
import { cn } from '@/lib/utils';

function CategoryBars({ title, entries, type, currency }: { title: string; entries: CategoryBreakdown[]; type: 'INCOME' | 'EXPENSE'; currency: string }) {
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <RowsCard>
        {entries.map((entry) => (
          <div key={entry.categoryId} className="space-y-2 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{entry.categoryName}</p>
                <p className="text-xs text-muted-foreground">{Math.round(entry.percentage)}% of {type === 'INCOME' ? 'income' : 'spending'}</p>
              </div>
              <p className={cn('shrink-0 text-[15px] font-bold tabular-nums', type === 'INCOME' ? 'text-income' : 'text-expense')}>
                {formatAmount(entry.amount, type, currency)}
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', type === 'INCOME' ? 'bg-income' : 'bg-lime')} style={{ width: `${entry.percentage}%` }} />
            </div>
          </div>
        ))}
      </RowsCard>
    </div>
  );
}

// Home section 6: the selected currency's month (income, expense, net) and its top categories
export function CurrencySummary({ currency, monthLabel, summary, expenses, incomes }: {
  currency: string;
  monthLabel: string;
  summary: MonthlySummary | null;
  expenses: CategoryBreakdown[];
  incomes: CategoryBreakdown[];
}) {
  const income = summary?.income ?? 0;
  const expense = summary?.expense ?? 0;
  const empty = income === 0 && expense === 0;
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-[19px] font-bold">Summary</h2>
      <div className="grid grid-cols-3 gap-3 rounded-[24px] bg-card p-5 shadow-resting">
        {[
          { label: 'Income', value: formatAmount(income, 'INCOME', currency), tone: 'text-income' },
          { label: 'Expense', value: formatAmount(expense, 'EXPENSE', currency), tone: 'text-expense' },
          { label: 'Net', value: formatAmount(summary?.balance ?? 0, null, currency), tone: '' },
        ].map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={cn('truncate text-[15px] font-bold tabular-nums', item.tone)}>{item.value}</p>
          </div>
        ))}
      </div>
      {empty ? (
        <p className="rounded-[24px] bg-card p-6 text-center text-muted-foreground shadow-resting">No transactions in {monthLabel}</p>
      ) : (
        <>
          <CategoryBars title="Expense" entries={expenses} type="EXPENSE" currency={currency} />
          <CategoryBars title="Income" entries={incomes} type="INCOME" currency={currency} />
        </>
      )}
    </section>
  );
}
```

Check that `bg-income` exists as a Tailwind token (look for `--color-income` in `client/src/index.css`). If not, use `bg-[var(--income)]`.

Create `client/src/components/finance/year-chart.tsx`. The chart is moved from Stats, plus a highlight:

```tsx
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TrendData } from '@/hooks/use-stats';
import { useTokenColors } from '@/lib/chart-colors';
import { formatCurrency } from '@/lib/format-utils';

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

// The selected month's bars stay solid; the rest fade so the month stands out
export const barOpacity = (month: number, highlightMonth: number) => (month === highlightMonth ? 1 : 0.35);

// Home section 7: Jan–Dec income vs expense for the selected currency
export function YearChart({ year, data, currency, highlightMonth }: { year: number; data: TrendData[]; currency: string; highlightMonth: number }) {
  const colors = useTokenColors();
  return (
    <section className="space-y-3 rounded-[24px] bg-card p-5 shadow-resting">
      <div>
        <h2 className="text-[19px] font-bold">{year} by month</h2>
        <p className="text-xs text-muted-foreground">
          <span className="text-income">Income</span> and <span className="text-expense">expense</span>
        </p>
      </div>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ left: -12, right: 0, top: 8 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={colors.grid} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: colors.muted }} interval={0} tickFormatter={(v: string) => v.charAt(0)} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: colors.muted }} tickFormatter={(v) => compact.format(Number(v))} />
            <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} formatter={(value) => formatCurrency(Number(value), currency)} />
            <Bar dataKey="income" name="Income" fill={colors.income} radius={[4, 4, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fillOpacity={barOpacity(i + 1, highlightMonth)} />)}
            </Bar>
            <Bar dataKey="expense" name="Expense" fill={colors.expense} radius={[4, 4, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fillOpacity={barOpacity(i + 1, highlightMonth)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="py-8 text-center text-muted-foreground">No data yet.</p>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `cd client && npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npm run lint 2>&1 | tail -3`
Expected: PASS, with no new lint errors. `Stats.tsx` still compiles: it ignores the new return value, and its local `useTokenColors` is still there (Task 6 deletes the file).

- [ ] **Step 7: Commit**

```bash
git add client/src/hooks/use-transactions.ts client/src/hooks/use-stats.ts client/src/lib/chart-colors.ts client/src/components/finance/currency-toggle.tsx client/src/components/finance/currency-summary.tsx client/src/components/finance/year-chart.tsx client/src/test/HomeParts.test.tsx
git commit -m "feat(client): Home building blocks: currency toggle, summary, year chart, income breakdown

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Client – the new Home, navigation, Stats removal

**Files:**
- Modify: `client/src/pages/Dashboard.tsx` (full rewrite)
- Modify: `client/src/components/app-footer.tsx`
- Modify: `client/src/Router.tsx`
- Delete: `client/src/pages/Stats.tsx`
- Test: `client/src/test/HomePage.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 2: `useAppShell()` (`selectedWalletId`, `setSelectedWalletId`, `selectedCurrency`, `setSelectedCurrency`, `dataVersion`, `notifyDataChanged`), `resolveCurrency` and `currenciesOf`
  - from Task 3: `WalletCards` with `walletIds`, `selectedWalletId` and `onOpen`
  - from Task 5: `useTransactions` (`walletIds`, `enabled`), `useStats` (`enabled`, `incomeBreakdown`), `CurrencyToggle`, `CurrencySummary` and `YearChart`

- [ ] **Step 1: Write the failing test**

Create `client/src/test/HomePage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';

const txOpts = vi.fn();
const statsOpts = vi.fn();
let wallets: unknown[] = [];
vi.mock('@/hooks/use-wallets', () => ({ useWallets: () => ({ wallets, loading: false, refetch: vi.fn() }) }));
vi.mock('@/hooks/use-transactions', () => ({
  useTransactions: (o: unknown) => { txOpts(o); return { transactions: [], loading: false }; },
}));
vi.mock('@/hooks/use-stats', () => ({
  useStats: (o: unknown) => { statsOpts(o); return { monthlySummary: null, categoryBreakdown: [], incomeBreakdown: [], trendData: [], loading: false, error: null }; },
}));
vi.mock('@/components/finance/wallet-cards', () => ({ WalletCards: () => null }));
vi.mock('@/components/finance/year-chart', () => ({ YearChart: () => null }));
const shell = { selectedCurrency: 'IDR', setSelectedCurrency: vi.fn(), selectedWalletId: undefined, setSelectedWalletId: vi.fn(), dataVersion: 0, notifyDataChanged: vi.fn() };
vi.mock('@/components/app-layout', () => ({ useAppShell: () => shell }));

const renderHome = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);

describe('Home', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not query before wallets load', () => {
    wallets = [];
    renderHome();
    expect(txOpts).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
    expect(statsOpts).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('scopes Latest, Summary and the total to the selected currency', () => {
    wallets = [
      { id: 'k1', currency: 'KRW', isMain: true, balance: 1000 },
      { id: 'i1', currency: 'IDR', isMain: false, balance: 1500 },
      { id: 'i2', currency: 'IDR', isMain: false, balance: 2500 },
    ];
    renderHome();
    expect(txOpts).toHaveBeenLastCalledWith(expect.objectContaining({ walletIds: ['i1', 'i2'], limit: 5, enabled: true }));
    expect(statsOpts).toHaveBeenLastCalledWith(expect.objectContaining({ walletIds: ['i1', 'i2'], enabled: true }));
    expect(screen.getByText('Rp 4,000')).toBeInTheDocument();
    expect(screen.getByText(/2 wallets/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd client && npx vitest run src/test/HomePage.test.tsx`
Expected: FAIL, because the current Dashboard doesn't use `walletIds` or `enabled`.

- [ ] **Step 3: Rewrite Home**

Replace `client/src/pages/Dashboard.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { WalletCards } from '@/components/finance/wallet-cards';
import { RowsCard, TransactionRow, type Transaction } from '@/components/finance/transactions-list';
import { TransactionDetailsModal } from '@/components/finance/transaction-details-modal';
import { MonthSwitcher } from '@/components/finance/month-switcher';
import { CurrencyToggle } from '@/components/finance/currency-toggle';
import { CurrencySummary } from '@/components/finance/currency-summary';
import { YearChart } from '@/components/finance/year-chart';
import { PageTitle, PillButton } from '@/components/page-header';
import { useAppShell } from '@/components/app-layout';
import { useWallets } from '@/hooks/use-wallets';
import { useTransactions } from '@/hooks/use-transactions';
import { useStats } from '@/hooks/use-stats';
import { currenciesOf, resolveCurrency } from '@/lib/selection';
import { formatAmount } from '@/lib/format-utils';
import { formatDateForDateInput, getStartOfMonth, getEndOfMonth } from '@/lib/date-utils';

const LATEST = 5;

// Home: one currency at a time (toggle), its wallets, newest activity, and the chosen month's summary
export default function Dashboard() {
  const navigate = useNavigate();
  const { selectedWalletId, setSelectedWalletId, selectedCurrency, setSelectedCurrency, dataVersion, notifyDataChanged } = useAppShell();
  const { wallets, refetch } = useWallets();
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState<Transaction | null>(null);

  useEffect(() => {
    if (dataVersion) refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion]);

  const currency = resolveCurrency(wallets, selectedCurrency);
  const inCurrency = wallets.filter((w) => w.currency === currency);
  const walletIds = inCurrency.map((w) => w.id);
  const ready = walletIds.length > 0;
  const total = inCurrency.reduce((sum, w) => sum + Number(w.balance), 0);

  const { transactions: latest, loading: latestLoading } = useTransactions({ walletIds, limit: LATEST, refreshKey: dataVersion, enabled: ready });

  const y = month.getFullYear();
  const m = month.getMonth() + 1;
  const filters = useMemo(() => ({
    startDate: formatDateForDateInput(getStartOfMonth(y, m)),
    endDate: formatDateForDateInput(getEndOfMonth(y, m)),
    walletIds,
    refreshKey: dataVersion,
    enabled: ready,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [y, m, walletIds.join(','), dataVersion, ready]);
  const { monthlySummary, categoryBreakdown, incomeBreakdown, trendData } = useStats(filters);
  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const openWallet = (walletId: string) => {
    setSelectedWalletId(walletId);
    navigate('/transactions');
  };
  const changed = () => {
    setSelected(null);
    notifyDataChanged();
  };

  return (
    <>
      <PageTitle eyebrow="Overview" title="Home" />

      {wallets.length === 0 || !currency ? (
        <WalletCards onOpen={openWallet} refreshKey={dataVersion} />
      ) : (
        <div className="space-y-6">
          <CurrencyToggle currencies={currenciesOf(wallets)} value={currency} onChange={setSelectedCurrency} />

          <section aria-label="Total" className="rounded-[24px] bg-card p-5 shadow-resting">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold tabular-nums">{formatAmount(total, null, currency)}</p>
            <p className="text-xs text-muted-foreground">{inCurrency.length} {inCurrency.length === 1 ? 'wallet' : 'wallets'}</p>
          </section>

          <WalletCards walletIds={walletIds} selectedWalletId={selectedWalletId} onOpen={openWallet} refreshKey={dataVersion} />

          <section className="space-y-2">
            <h2 className="px-1 text-[19px] font-bold">Latest</h2>
            {latestLoading ? (
              <div className="h-40 animate-pulse rounded-[24px] bg-card" />
            ) : latest.length === 0 ? (
              <p className="rounded-[24px] bg-card p-6 text-center text-muted-foreground shadow-resting">No transactions yet. Tap + to add one.</p>
            ) : (
              <RowsCard>
                {latest.map((t) => <TransactionRow key={t.id} transaction={t} showDate onClick={() => setSelected(t)} />)}
              </RowsCard>
            )}
            <PillButton className="w-full justify-center" onClick={() => navigate('/transactions')}>
              See all transactions <ArrowRight />
            </PillButton>
          </section>

          <MonthSwitcher date={month} onChange={setMonth} />
          <CurrencySummary currency={currency} monthLabel={monthLabel} summary={monthlySummary} expenses={categoryBreakdown} incomes={incomeBreakdown} />
          <YearChart year={y} data={trendData} currency={currency} highlightMonth={m} />
        </div>
      )}

      {selected && (
        <TransactionDetailsModal transaction={selected} isOpen={!!selected} onClose={() => setSelected(null)} onUpdate={changed} onDelete={changed} />
      )}
    </>
  );
}
```

If `useWallets` doesn't expose `refetch`, or `balance` is typed as a string, adjust to the real hook (`client/src/hooks/use-wallets.ts`). The "No wallets" branch renders `WalletCards`, which already shows the "add a wallet" prompt.

- [ ] **Step 4: Navigation and the route**

In `client/src/components/app-footer.tsx`, set the tabs to:

```ts
import { LayoutGrid, Plus, ReceiptText, Settings, Wallet } from 'lucide-react';

const tabs = [
    { to: '/', label: 'Home', icon: LayoutGrid },
    { to: '/transactions', label: 'Transactions', icon: ReceiptText },
    null, // center slot: Add
    { to: '/wallets', label: 'Wallets', icon: Wallet },
    { to: '/settings', label: 'Settings', icon: Settings },
];
```

In `client/src/Router.tsx`:
- Replace `<Route path="stats" element={<Stats />} />` with `<Route path="stats" element={<Navigate to="/" replace />} />`.
- Remove the `Stats` import. `Navigate` is already imported.

Delete `client/src/pages/Stats.tsx`. Check that nothing else imports it: `grep -rn "pages/Stats" client/src`.

- [ ] **Step 5: Run the tests**

Run: `cd client && npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npm run lint 2>&1 | tail -3`
Expected: PASS, with no new lint errors.

Then check by hand at 375 px in the browser preview, in both light and dark:
- the toggle switches every section
- the total adds up
- a card tap opens Transactions on that wallet
- the month switcher changes only Summary and the chart

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Dashboard.tsx client/src/components/app-footer.tsx client/src/Router.tsx client/src/test/HomePage.test.tsx
git rm client/src/pages/Stats.tsx
git commit -m "feat(client): Home is the per-currency overview; Stats page removed; Settings in the nav

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: End-to-end scenarios and docs

**Files:**
- Delete: `client/e2e/stats.e2e.ts`
- Create: `client/e2e/home.e2e.ts`
- Modify: `client/e2e/dashboard.e2e.ts` and any other e2e file that breaks
- Modify: `client/e2e/SCENARIOS.md`, `CLAUDE.md`

**Interfaces:**
- Consumes the UI from Tasks 2–6:
  - Home sections: the "Currency" radiogroup, the "Total" region, cards (`article[aria-label=<wallet name>]`, which act as buttons on Home), the "Latest" heading, the month switcher (`Previous month`/`Next month`), the "Summary" heading and "<YYYY> by month"
  - Transactions: cards plus the list
  - Footer: Home, Transactions, Wallets, Settings

- [ ] **Step 1: Write the scenarios**

Read `client/e2e/helpers.ts`, `client/e2e/stats.e2e.ts` and `client/e2e/dashboard.e2e.ts` first. Create `client/e2e/home.e2e.ts`, covering these scenarios with the helpers (`signUp`, `seedWallet`, `seedCategory`, `seedTx`, `thisMonth`, `api`, `prevMonth`, `card`):

| ID | Scenario | Expected |
|---|---|---|
| H1 | KRW wallet (₩1,000,000) and IDR wallet (Rp 500,000); toggle KRW → IDR | Total, cards, Latest and Summary switch to IDR: total "Rp 500,000"; no ₩ card; Latest shows only IDR rows |
| H2 | Tap a Home card | Lands on `/transactions`; that wallet's rows are listed; another wallet's row is not |
| H3 | On Transactions, swipe (scroll the card row) to the 2nd wallet | The list switches to the 2nd wallet's rows |
| H4 | Home month switcher → previous month | Summary shows "No transactions in <prev Month YYYY>"; Total and Latest unchanged |
| H5 | Visit `/stats` | Ends on `/` showing "Summary" |
| H6 | Tap the IDR card, reload `/transactions` | Still on the IDR wallet's list |
| H7 | Only KRW wallets | No "Currency" radiogroup |
| H8 | An income transaction (Salary) this month | Listed under Summary's Income bars with its amount |
| H9 | S1 equivalent: summary numbers | Income, Expense and Net match the seeded month (from the old S1) |
| H10 | S5 equivalent | "<YYYY> by month" chart renders bars (`.recharts-bar-rectangle` count > 0) |
| H11 | S6 equivalent | Adding an expense from the + sheet while on Home updates Summary's Expense without a reload |
| H12 | S7 equivalent | A new user with one wallet and no transactions sees "No transactions yet. Tap + to add one." and zeroes |

Use the old `stats.e2e.ts` assertions as the starting point for H9–H12. Then delete `client/e2e/stats.e2e.ts`.

To swipe in H3, scroll the card row's container: `await page.locator('article[aria-label="<2nd>"]').scrollIntoViewIfNeeded()`. If that doesn't change the selection, `evaluate` `el.parentElement.scrollLeft = el.offsetLeft`. Then assert on the list.

- [ ] **Step 2: Update the broken scenarios**

Run: `cd client && npx playwright test 2>&1 | tail -30`. Fix every failure caused by the new structure, keeping the intent:
- D6 and D7 ("swiping on the dashboard switches Recent", "add from the 2nd wallet") become Transactions-page scenarios: swipe on `/transactions`, add from the + sheet, and assert that it was saved to that wallet.
- D9 "See all transactions" still opens `/transactions`.
- D10: the nav's four tabs are Home, Transactions, Wallets and Settings.
- "Recent" assertions that check a new row on Home now check "Latest", or the Transactions list.

Do not weaken behavioral assertions; adapt selectors and locations only. If a failure is an app bug, fix the app and note it in your report.

- [ ] **Step 3: Run the full suite**

Run: `cd client && npm run test:e2e`
Expected: all pass. Run it after the backend integration tests, never at the same time.

- [ ] **Step 4: Update the docs**

In `client/e2e/SCENARIOS.md`:
- Replace the Stats section with a "Home (`home.e2e.ts`)" table for H1–H12.
- Update the Dashboard rows you changed.
- Update the Files list (remove `stats.e2e.ts`, add `home.e2e.ts`).

In `CLAUDE.md`, replace the `components/app-layout.tsx` bullet's nav description with:

```markdown
- `components/app-layout.tsx` — app shell: greeting header, bottom nav (Home, Transactions, center **+**, Wallets, Settings) and the global Add Transaction sheet. Pages read shared state via `useAppShell()`: `selectedWalletId` (Transactions' wallet; persisted) and `selectedCurrency` (Home's KRW/IDR; persisted), both resolved with `lib/selection.ts`, plus `dataVersion`, bumped after the sheet saves so pages refetch. Home is a per-currency overview (total, wallet cards, latest 5, month Summary, year chart); Transactions is a per-wallet ledger; `/stats` redirects to Home
```

- [ ] **Step 5: Commit**

```bash
git add client/e2e CLAUDE.md
git commit -m "test(e2e): Home scenarios H1-H12; adapt dashboard flows to the new structure

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
