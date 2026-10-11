# Assets (generic holdings: gold and Binance crypto first) and the wallet balance lock: design

Date: 2026-10-11. Status: approved in brainstorming (generic model revision), pending spec review.

## Goals

1. **Wallet balance lock** (already built on this branch, commit `7bff0d1`): a wallet's balance can't be edited once it has transactions.
2. **Assets:** track holdings with live value in KRW or IDR, with gain/loss and a distribution chart. The first two asset classes are:
   - **Gold:** purchases entered by hand.
   - **Crypto:** quantities synced from the user's Binance account through a read-only API key, with the cost per coin entered by hand.
3. **Extensible by design:** a later asset class (stocks, bonds…) is added with a new asset-class entry, a price source and a registry entry, with no new tables for manually tracked assets.
4. **Navigation:** the bottom bar's Wallets tab becomes Assets; the Wallets page moves under Profile.

## Decisions

| Topic | Decision |
|---|---|
| Link to wallets | None. Buying or selling an asset never touches wallet balances or stats |
| Data model | Generic: `AssetLot` (manual buys and sells of any class), `AssetCost` (cost for synced holdings of any class); one table per sync source for credentials (`BinanceConnection`) |
| Asset class | A plain string validated in code (`GOLD`, `CRYPTO` today), not a database enum, so new classes need no migration |
| Holdings | Gathered from **holding sources** behind one interface: `manual` (sums `AssetLot`) and `binance` today |
| Prices | Gathered from **price sources**, one per asset class, behind one interface; all return USD |
| Gold | Class `GOLD`, symbol `XAU`, unit grams; priced from Binance `PAXGUSDT` (1 PAXG = 1 troy oz) ÷ 31.1035 per gram |
| Crypto | Class `CRYPTO`, symbol = coin (`BTC`); quantities from Binance Spot + Funding + Simple Earn (flexible and locked); priced from Binance `<COIN>USDT` (USDT = 1, treated as USD); holdings worth under $1 hidden |
| Exchange rates | `open.er-api.com/v6/latest/USD` (no key) for USD→KRW and USD→IDR |
| Display | One currency, the KRW/IDR toggle shared with Home (`selectedCurrency`); every value, cost and gain converted at the current rate |
| Placement | Its own page `/assets`; nav Home · Transactions · **+** · Assets · Profile; `/wallets` stays as a route and is linked from Profile |
| Chart | Donut of each holding's share of total asset value; holdings under 3% grouped as "Other"; assets only, no wallet cash |

## Wallet balance lock

- `PATCH /api/wallets/:id` refuses a **changed** balance when the wallet has transactions: 400 "Can't change the balance of a wallet with N transaction(s). Add an income or expense instead." An unchanged balance, which the wallet form always resends, is allowed.
- The wallet form shows the balance read-only with "Locked: this wallet has transactions." when `wallet._count.transactions > 0`.
- Tests: `backend/tests/wallet-balance.int.ts` and `client/src/test/WalletFormBalance.test.tsx`.

## Data model (one migration)

```prisma
// A manual buy (quantity > 0) or sell (quantity < 0) of any manually tracked asset
model AssetLot {
  id         String   @id @default(uuid())
  userId     String
  assetClass String   // GOLD today; STOCK, BOND… later (validated in code)
  symbol     String   // XAU for gold
  date       DateTime
  quantity   Decimal  @db.Decimal(24, 8)   // grams for gold; negative = sale
  totalPaid  Decimal  @db.Decimal(19, 4)   // money paid; negative for a sale (money received)
  currency   String   // IDR | KRW | USD
  note       String?
  createdAt  DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, assetClass, symbol])
  @@map("asset_lots")
}

// What the user paid in total for a holding that comes from a sync source (no per-lot history)
model AssetCost {
  userId       String
  assetClass   String   // CRYPTO today
  symbol       String   // BTC
  costAmount   Decimal  @db.Decimal(19, 4)
  costCurrency String   // USD | KRW | IDR
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([userId, assetClass, symbol])
  @@map("asset_costs")
}

// Credentials of one sync source (each source has its own shape)
model BinanceConnection {
  userId       String    @id
  apiKey       String
  secretEnc    String    // base64 ciphertext
  iv           String    // base64, 12 bytes
  authTag      String    // base64, 16 bytes
  lastSyncedAt DateTime?
  lastError    String?
  createdAt    DateTime  @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("binance_connections")
}
```

`User` gets the three back-relations.

## Backend

### Asset classes (`services/assets/asset-classes.ts`)

```ts
export const ASSET_CLASSES = {
  GOLD:   { manual: true,  unit: 'g',  defaultSymbol: 'XAU' },
  CRYPTO: { manual: false, unit: null, defaultSymbol: null },
} as const;
export type AssetClass = keyof typeof ASSET_CLASSES;
```

Validation of `assetClass` uses these keys. Adding `STOCK` later means adding a key, a price source and a client registry entry.

### Interfaces

```ts
interface Holding { assetClass: AssetClass; symbol: string; quantity: number; source: 'manual' | 'binance' }

interface HoldingSource {
  id: 'manual' | 'binance';
  fetch(userId: string, opts: { refresh: boolean }): Promise<{ holdings: Holding[]; status?: SourceStatus }>;
}

interface PriceSource {
  assetClass: AssetClass;
  usdPrices(symbols: string[]): Promise<Record<string, number | null>>;
}
```

### Holding sources (`services/assets/sources/`)

- **`manual.source.ts`:** sums `AssetLot.quantity` per (class, symbol) for the user, skipping zero totals.
- **`binance.source.ts`** (uses `binance.service`):
  - Only when a `BinanceConnection` exists.
  - It caches holdings per user for 5 minutes in memory; `refresh` bypasses the cache.
  - On success it updates `lastSyncedAt` and clears `lastError`.
  - On failure it records `lastError` (the sanitized message) and returns the last cached holdings when it has them.
  - `status = { connected, lastSyncedAt, error }`. Its holdings are class `CRYPTO`.

### Price sources (`services/assets/prices/`)

- **`gold.price.ts`** (GOLD): `XAU` = Binance `PAXGUSDT` ÷ 31.1035 (USD per gram).
- **`crypto.price.ts`** (CRYPTO):
  - One `GET /api/v3/ticker/price?symbols=[…]` for the `<SYMBOL>USDT` pairs.
  - `USDT` = 1. A symbol without a pair gets `null`.
- **`fx.ts`:** `usdRates() → { KRW, IDR }` from open.er-api.com.
- **Caching:** prices for 60 s per symbol set, exchange rates for 1 h.
- **Failure:** on a fetch failure each returns its last cached values and reports `stale: true`. With no cache at all it throws `PriceUnavailableError`.

### `services/binance.service.ts`

The only caller of signed Binance endpoints.

- **`signedRequest(method, path, params, creds)`:**
  - adds `timestamp` and `recvWindow=10000`
  - signs the query with HMAC-SHA256 and sends the `X-MBX-APIKEY` header
  - 10 s timeout
  - errors are rethrown as `BinanceError(message)` with Binance's `msg` only
- **`checkReadOnly(creds)`:** `GET /sapi/v1/account/apiRestrictions`. It throws `BinanceError("Use a read-only key: turn off trading, withdrawals and transfers")` if `enableReading` is false, or if any of these is true:
  - `enableSpotAndMarginTrading`, `enableWithdrawals`, `enableInternalTransfer`
  - `enableMargin`, `enableFutures`, `permitsUniversalTransfer`, `enableVanillaOptions`
- **`fetchBalances(creds) → Record<symbol, number>`:**
  - Spot: `GET /api/v3/account?omitZeroBalances=true`, counting free + locked. Symbols starting with `LD` are skipped, since they are legacy savings tokens mirrored by Earn.
  - Funding: `POST /sapi/v1/asset/get-funding-asset`, counting free + locked + freeze.
  - Simple Earn flexible: `GET /sapi/v1/simple-earn/flexible/position?size=100`, `totalAmount`.
  - Simple Earn locked: `GET /sapi/v1/simple-earn/locked/position?size=100`, `amount`.
  - Summed per symbol.
- **Logging:** never logs URLs, query strings or headers, only `Binance request failed: <path> <status> <msg>`.

### `services/crypto-box.ts`

`encrypt(plain) → { secretEnc, iv, authTag }` and `decrypt(...) → plain`, using AES-256-GCM through Node's `crypto`, with a random 12-byte IV each time. The key comes from config `assetsEncryptionKey` (env `ASSETS_ENCRYPTION_KEY`, base64 32 bytes, default `''`).

### `services/assets/portfolio.service.ts`, `getPortfolio(userId, currency, refresh)`

1. Gather holdings from all sources in parallel (one source failing never fails the others). Merge by (class, symbol, source).
2. Price each holding with its class's price source, then convert to `currency` with `fx`.
3. Cost per holding:
   - **Manual:** Σ `AssetLot.totalPaid` for that (class, symbol), each lot converted from its currency. That is the net money put in (sales reduce it).
   - **Synced:** the matching `AssetCost`, converted. `null` when there's none.
4. `value = quantity × usdPrice × rate`; `gain = value − cost` (`null` without a cost); `gainPct`.
5. Holdings worth under $1 are dropped. A holding with no price is kept with `value: null`, and excluded from totals and the chart.
6. Response:

```ts
{
  currency: 'KRW' | 'IDR',
  total: { value: number; cost: number | null; gain: number | null; gainPct: number | null }, // cost/gain only over holdings with a cost
  holdings: Array<{
    assetClass: string; symbol: string; quantity: number; unit: string | null;
    value: number | null; cost: number | null; gain: number | null; gainPct: number | null;
    source: 'manual' | 'binance';
  }>,
  sources: { binance: { connected: boolean; lastSyncedAt: string | null; error: string | null } },
  stale: boolean   // any price or rate came from cache after a failed fetch
}
```

### Endpoints (session auth; `routes/asset.routes.ts` at `/api/assets`)

| Method and path | Body / query | Result |
|---|---|---|
| `GET /` | `currency=KRW\|IDR`, `refresh=1?` | the portfolio response |
| `GET /lots?assetClass=GOLD` | | lots, newest first |
| `POST /lots` | `{ assetClass (manual classes only), symbol, date, quantity ≠ 0, totalPaid, currency, note? }` | 201 |
| `PATCH /lots/:id` / `DELETE /lots/:id` | same fields, optional | 200 / 204; 404 for another user's row |
| `PUT /costs/:assetClass/:symbol` | `{ costAmount ≥ 0 \| null, costCurrency }`; `null` deletes | 200 |
| `PUT /sources/binance` | `{ apiKey, apiSecret }` (each 10–128 chars) | `checkReadOnly` with the plain credentials, encrypt, upsert, first sync → `{ connected: true, lastSyncedAt }`; 400 with the reason when not read-only or rejected |
| `DELETE /sources/binance` | | 204, deletes the row |

When `ASSETS_ENCRYPTION_KEY` is empty, `PUT /sources/binance` answers 503 "Binance sync isn't set up". Manual assets and prices work without it.

## Client

- **Navigation:**
  - `app-footer.tsx`: Home · Transactions · **+** · Assets (`Gem` icon, `/assets`) · Profile.
  - `Router.tsx`: adds `assets`; `wallets` stays.
  - Profile gets a "Wallets & categories" row (chevron) linking to `/wallets`.
- **Asset class registry** (`components/assets/asset-classes.ts`):

```ts
export const ASSET_CLASS_UI = {
  GOLD:   { label: 'Gold',   icon: Coins, color: '#D4A017', manual: true,  unit: 'g', symbols: [{ value: 'XAU', label: 'Gold' }] },
  CRYPTO: { label: 'Crypto', icon: Bitcoin, color: null,   manual: false, unit: null },
} as const;
```

  The Assets page renders one card per class present in the registry, in registry order. Adding stocks later is a new entry here.

- **`pages/Assets.tsx`** (`PageTitle` eyebrow "Portfolio", title "Assets"), from top to bottom:
  1. **CurrencyToggle:** always KRW and IDR, sharing `selectedCurrency` with Home.
  2. **Total card:** value, and gain/loss (amount and %) coloured income/expense when any cost exists. Shows "Prices may be out of date" when `stale`.
  3. **Distribution chart** (`components/assets/distribution-chart.tsx`): a Recharts donut of holding values with a legend of name · value · %.
     - Slices under 3% are merged into "Other". It's hidden when the total is 0.
     - Colours come from the registry (Gold `#D4A017`), with crypto from a fixed palette by descending value.
  4. **One `AssetClassCard` per class** (`components/assets/asset-class-card.tsx`), driven by the registry:
     - **Manual classes (GOLD):**
       - total quantity with its unit, value, average cost per unit, gain
       - "Add purchase" opens a sheet with date, quantity, total paid, currency and note (the symbol picker is hidden when the class has one symbol)
       - tapping the card opens the lot list sheet (edit/delete)
       - a sale is entered with a "Sell" toggle that negates quantity and amount
     - **Synced classes (CRYPTO):**
       - Not connected: a "Connect Binance" button.
       - Connected: "Last synced 3 min ago", plus the error if the last sync failed. Each holding row has symbol, quantity, value, and gain, or "Add cost" (a sheet with amount and currency USD/KRW/IDR).
       - A "Binance" menu with "Sync now" (`refresh=1`) and "Disconnect" (with confirmation).
- **Connect Binance sheet:** API key and secret fields (`type="password"`, `autoComplete="off"`), with instructions:
  1. Binance → Account → API Management → Create API (system generated).
  2. Keep **only "Enable Reading"** checked.
  3. Restrict access to trusted IP **43.155.186.108**.
  4. Paste the key and secret.

  Errors show inline, and the secret field is cleared after any submit.
- **Pull-to-refresh** on Assets passes `refresh=1` (through `dataVersion`).
- **Hook:** `hooks/use-portfolio.ts` provides `{ data, loading, error, refetch }` and keeps the last good data on error.

## Extending to a new asset class (example: STOCK)

1. **Backend:** add `STOCK: { manual: true, unit: 'shares', defaultSymbol: null }` to `ASSET_CLASSES`, and a `stock.price.ts` price source.
2. **Client:** add a `STOCK` entry to `ASSET_CLASS_UI`, with a symbol input instead of a fixed list.
3. **No migration:** manual stock lots use `AssetLot`.
4. **Broker sync (if wanted):** a new holding source plus its own credentials table, like `BinanceConnection`.

## Error handling

- **Binance down or key revoked:** the crypto card shows the last synced holdings with "Couldn't sync: <reason>". Manual classes are unaffected.
- **Prices or exchange rates down:** values come from the last cached prices (`stale: true`). With no cache at all, `GET /` answers 503 "Prices are unavailable right now", and the page shows it while the lot lists stay usable through `GET /lots`.
- **No `ASSETS_ENCRYPTION_KEY`:** the Connect button shows "Binance sync isn't set up on the server".

## Security

- **Read-only only:** a key with any trading, withdrawal or transfer permission is refused at save time.
- **Secret storage:** the secret is stored only AES-256-GCM-encrypted. The encryption key lives only in `backend/.env` on the server, is generated once with `openssl rand -base64 32`, and is never committed.
- **Never exposed:** neither the secret nor the API key is returned by any endpoint or logged; the portfolio only exposes `connected`.
- **IP restriction:** restricting the key to the VPS IP is part of the instructions, so a leaked key is unusable elsewhere.
- **Disconnect:** deletes the row. Deleting the user cascades.

## Testing

**Backend** (Jest; Binance and price HTTP mocked; never real exchange calls):
- **`crypto-box`:** round trip; a tampered `authTag` throws.
- **`binance.service`:**
  - the signature matches a known HMAC for a fixed query and secret
  - `checkReadOnly` rejects each forbidden permission
  - `fetchBalances` sums the four sources and skips `LD*`
- **Price sources:** gold per gram from PAXG; crypto pair mapping with USDT = 1 and no-pair → null; stale fallback.
- **`portfolio.service`:**
  - merges the manual and Binance sources
  - manual cost from lots in mixed currencies; synced cost from `AssetCost`
  - dust filtered; a no-price holding excluded from totals
  - one source failing doesn't fail the response
- **`assets.int.ts`** (real DB, mocked HTTP):
  - Binance connect: a trading-enabled key gets 400 and nothing is stored; a valid key is stored encrypted (the DB column ≠ the secret); no response contains the secret.
  - Lots CRUD, including a sale.
  - `POST /lots` with `assetClass: CRYPTO` (not manual) → 400; an unknown class → 400.
  - `PUT /costs` set and clear.
  - Another user's lot → 404.
  - The 503 without the encryption key.

**Vitest:**
- distribution grouping (under 3% → Other; percentages sum to 100)
- `AssetClassCard` for a manual and a synced class
- the Assets page states: not connected, synced with a gain, sync error with the last data, stale prices
- the gain colour and sign

**Playwright** (`e2e/assets.e2e.ts`; Binance mocked via `page.route` on `/api/assets*` where it needs crypto data):
- AS1: the nav shows Assets; Profile → "Wallets & categories" opens `/wallets`.
- AS2: two gold purchases show total grams, value and average cost; a sale reduces the grams; deleting a lot updates the totals.
- AS3: with mocked holdings, the crypto card lists the coins, and the legend shows Gold and BTC with percentages.
- AS4: the KRW/IDR toggle changes the currency of every figure.
- AS5: the Connect sheet shows the read-only and IP instructions, and an error response is shown inline.

**Manual:** after deploy, one real check with the user's read-only key.

## Out of scope

- Any asset class beyond GOLD and CRYPTO. The model supports more, but none are built.
- Linking asset buys and sells to wallets or transactions.
- Trade-history-based cost.
- Price alerts.
- Historical value charts.
- Wallet cash in the distribution chart.
