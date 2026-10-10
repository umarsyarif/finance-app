# Home and Transactions restructure: design

Date: 2026-10-10. Status: approved in brainstorming, pending spec review.

## Goal

- **Transactions** today mixes every wallet (₩ and Rp rows in one list). It should be a per-wallet ledger.
- **Home** would then duplicate Transactions, so it becomes an all-wallets overview for one currency at a time. It absorbs the Stats page.
- **Stats** is removed.

## Decisions

| Topic | Decision |
|---|---|
| Home scope | One currency at a time, chosen with a KRW / IDR toggle that merges every wallet in that currency |
| Toggle | Hidden when the user's wallets are all one currency; defaults to the main wallet's currency; remembered |
| Home wallet cards | Only the selected currency's wallets, each with **this month's** in/out; tapping a card opens that wallet in Transactions |
| Home month switcher | Drives only the Summary section and the yearly chart |
| Yearly chart | Always Jan–Dec of the switcher's year; the selected month is highlighted |
| Latest | Newest 5 transactions across all wallets of the selected currency, regardless of month |
| Transactions | Per-wallet ledger; swipe the wallet cards to pick the wallet; its month switcher drives the list and the cards' in/out |
| Shared wallet selection | One `selectedWalletId` shared by Home (card tap), Transactions (swipe) and the + sheet, persisted |
| Navigation | Home · Transactions · **+** · Wallets · Settings; `/stats` redirects to `/` |
| Backend | Two additive query params: `type=INCOME|EXPENSE` on `GET /api/stats/category-breakdown` (default `EXPENSE`), and `walletIds` on `GET /api/transactions` |

## Home (`/`)

From top to bottom:

```
Overview
1. [ KRW | IDR ]                 currency toggle (hidden with one currency)
2. Total ₩1,250,000 · 3 wallets  sum of the selected currency's wallet balances; no month figures
3. [ wallet cards, swipe ]       selected currency's wallets; balance + this month's in/out; tap → Transactions
4. Latest                        newest 5 across the currency's wallets, any month
     row × 5
     [ See all transactions → ]  opens Transactions on the selected wallet
5. [ ‹ October 2026 › ]          month switcher
6. Summary                       selected currency, selected month
     Income · Expense · Net
     Top categories
       Expense  bars with share and amount
       Income   bars with share and amount
7. 2026 by month                 Jan–Dec bar chart (income vs expense), selected currency, selected month highlighted
```

**Data sources.** `W` is the ids of the wallets in the selected currency. All reads exclude transfers, which the backend already does.

| Section | Source |
|---|---|
| Total | the sum of `balance` over `W`, from `useWallets` |
| Cards | the existing `WalletCards` with a `wallets` filter; it fetches each wallet's month totals as it does today |
| Latest | `GET /api/transactions?walletIds=W&limit=5` (newest first, no date range) |
| Summary: income, expense, net | `GET /api/stats/monthly-summary?walletIds=W&startDate&endDate` |
| Summary: expense categories | `GET /api/stats/category-breakdown?walletIds=W&startDate&endDate` (type defaults to EXPENSE) |
| Summary: income categories | the same with `type=INCOME` |
| Chart | `GET /api/stats/trend?walletIds=W&year&tz` |

**Card tap.** Tapping a card sets `selectedWalletId` and navigates to `/transactions`. The card's existing "Manage" arrow keeps its current behaviour.

## Transactions (`/transactions`)

```
Monthly ledger
Transactions
[ wallet cards, swipe ]          ALL wallets (both currencies); swiping selects the wallet
[ ‹ October 2026 › ]             drives the list and the cards' in/out
[ search ]  [ All | Income | Expense ]
  Today
    rows
  Yesterday …
  [ Load more ]
```

- The list shows only `selectedWalletId`'s transactions for the chosen month. The existing `TransactionsList` gets a `walletId` filter.
- Transfers stay neutral rows under All, as they are now.
- The cards on Transactions follow the month switcher: `WalletCards` gets a `month` prop, defaulting to the current month so Home is unchanged.

## Shared state (app shell)

- **`selectedWalletId`**
  - Set by tapping a card on Home or swiping on Transactions. The + sheet defaults to it.
  - Persisted in `secureStorage` (local).
  - On load, a missing or deleted id falls back to the main wallet, then to the first wallet.
- **`selectedCurrency`** (`'KRW' | 'IDR'`)
  - Persisted the same way.
  - Defaults to the main wallet's currency.
  - If the user has no wallet in the stored currency, it falls back the same way.
- **Month** is local to each page. Moving between pages doesn't carry a past month over.

## Navigation

- `app-footer.tsx` tabs are Home · Transactions · **+** · Wallets · Settings.
- Settings stays in the avatar menu too.
- Router:
  - `/stats` becomes `<Navigate to="/" replace />`
  - `pages/Stats.tsx` is deleted

## Backend

- `GET /api/stats/category-breakdown` takes an optional `type` (`INCOME` | `EXPENSE`). It's validated in `stats.schema.ts`, defaults to `EXPENSE`, and replaces the hard-coded `type: 'EXPENSE'` in `getCategoryBreakdown`.
- `GET /api/transactions` today accepts only a single `walletId`. It gains an optional comma-separated `walletIds` (for Latest), validated like the stats one, and the existing `walletId` keeps working. Only the user's own wallets match, because the list is already scoped to the user.

## Components

- **New `components/finance/currency-summary.tsx`**: section 6. It renders the income/expense/net figures and both category bar lists from props. The markup moves from Stats.
- **New `components/finance/year-chart.tsx`**: section 7. It holds the Recharts bar chart from Stats, plus a `highlightMonth` prop.
- **New `components/finance/currency-toggle.tsx`**: section 1. It reuses the existing `FilterChips` styling.
- **`pages/Dashboard.tsx`** becomes the new Home layout.
- **`pages/Transactions.tsx`** adds the cards and the wallet filter.
- **`components/finance/wallet-cards.tsx`** gains:
  - `wallets` (an optional subset to show)
  - `month` (optional, defaults to now)
  - `onOpen` (optional, called when a card is tapped)
- **`hooks/use-stats.ts`** fetches the income breakdown as well.

## Empty states

| Case | Shown |
|---|---|
| No wallets | The existing "add a wallet" prompt on Home and Transactions |
| One currency | Toggle hidden |
| No transactions in the selected month | Summary shows zeros and "No transactions in <Month>" in place of the bars; the chart still draws 12 months |
| No transactions at all (Latest) | "No transactions yet. Tap + to add one." |
| Transactions page, wallet with no rows this month | The existing empty list message |

## Testing

**Backend integration** (`backend/tests/api.int.ts` or a new file):
- The breakdown with `type=INCOME` returns only income categories.
- With no `type` it returns only expense categories, as before.
- `walletIds` on the transactions list returns rows from exactly those wallets, and ignores another user's wallet ids.

**Vitest:**
- The currency defaults to the main wallet's currency.
- `selectedWalletId` falls back to the main wallet when the stored id no longer exists.
- The toggle is hidden with one currency.
- `YearChart` highlights the given month.

**Playwright:**
- Rewrite S1–S7 (`stats.e2e.ts`) against Home's Summary and chart.
- Update D1–D10 (`dashboard.e2e.ts`) for the new layout and nav.
- New scenarios:

| ID | Scenario | Expected |
|---|---|---|
| H1 | Toggle KRW → IDR | Total, cards, Latest, Summary and chart switch to the IDR wallets |
| H2 | Tap a Home card | Transactions opens on that wallet; the list shows only its rows |
| H3 | Swipe cards on Transactions | The list switches wallet; no rows from other wallets |
| H4 | Home month switcher to the previous month | Summary and chart change; Total, cards and Latest unchanged |
| H5 | Visit `/stats` | Redirected to Home |
| H6 | Select a wallet, reload | The same wallet is still selected on Transactions |
| H7 | Wallets in one currency only | No toggle |
| H8 | Income categories | An income transaction appears under Summary's income bars |

**Manual:** a browser check at phone width (375 px), in light and dark.

## Out of scope

- Totals that combine currencies (no exchange rates).
- New chart types, or picking a year other than through the month switcher.
- Changes to the Wallets and Settings pages beyond the nav.
