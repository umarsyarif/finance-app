# Wallet transfers: design

Date: 2026-10-10. Status: approved in brainstorming, pending spec review.

## Goal

Record money moving between the user's own wallets, including currency exchange (KRW ↔ IDR), so that both balances move but nothing counts as income or expense in stats.

Today the only way is an expense in one wallet plus an income in the other. Balances end up right, but stats show the exchange as spending and earnings, and the two sides are not linked.

## Decisions

| Topic | Decision |
|---|---|
| Fees | None. The user enters the amount sent and the amount received; any fee or spread is inside the difference. |
| Same-currency transfers | Supported. One amount field when currencies match, two (sent, received) when they differ. |
| Exchange rate | Not stored. Shown read-only in the form as the ratio of the two amounts. |
| List display | One row per wallet: the source wallet shows the outgoing side, the destination shows the incoming side. Tapping either opens the whole transfer. |
| AI capture | Unchanged. Capture never produces transfers. |
| Data model | Approach A: a `Transfer` record linking two ordinary `Transaction` rows, which use two hidden built-in categories. |

## Data model

One migration:

- New model `Transfer`: `id` (uuid), `userId` (relation to `User`), `date`, `note String?`, `createdAt`, `updatedAt`. Has many `Transaction`s.
- `Transaction.transferId String?`, a relation to `Transfer`, indexed.
- `Category.isTransfer Boolean @default(false)`.
- The migration inserts two global categories (`userId` null, `isTransfer` true) with fixed ids:
  - `transfer-out`: "Transfer out", type `EXPENSE`.
  - `transfer-in`: "Transfer in", type `INCOME`.

Every transfer has exactly two rows: the out row (on `fromWallet`, category `transfer-out`) and the in row (on `toWallet`, category `transfer-in`). The existing balance helpers (`applyBalanceOnCreate/Update/Delete`) derive the sign from the category type, so they move both balances without changes.

## Backend

New files, following routes → controllers → services:
- `routes/transfer.routes.ts`
- `controllers/transfer.controller.ts`
- `services/transfer.service.ts`
- `schemas/transfer.schema.ts`

They are mounted at `/api/transfers` behind `deserializeUser` and `requireUser`.

### Endpoints

- `POST /api/transfers` takes the body `{ fromWalletId, toWalletId, amountSent, amountReceived?, date, note? }` and returns 201 `{ status, data: { transfer } }`.
- `GET /api/transfers/:transferId` returns 200 `{ status, data: { transfer } }`.
- `PATCH /api/transfers/:transferId` takes the same fields as `POST`. All of them are required, and the whole transfer is replaced. It returns 200 `{ status, data: { transfer } }`.
- `DELETE /api/transfers/:transferId` returns 204.

The `transfer` shape is:
```ts
{
  id, date, note,
  from: { walletId, walletName, currency, amount, transactionId },
  to:   { walletId, walletName, currency, amount, transactionId },
}
```

### Rules (transfer.service)

1. `fromWalletId` ≠ `toWalletId`, else 400 "Pick two different wallets".
2. Both wallets must belong to the user, else 404 "Wallet not found".
3. Amounts must be > 0 and ≤ the existing `MAX_AMOUNT`.
4. If the currencies match: `amountReceived` must be absent or equal to `amountSent` (else 400 "Amounts must match for wallets in the same currency"). The in row uses `amountSent`.
5. If the currencies differ: `amountReceived` is required, else 400 "Enter the amount received".
6. Row descriptions:
   - With a note, both rows use the trimmed note (max 255 characters).
   - Without one, the out row is "Transfer to <toWallet.name>" and the in row is "Transfer from <fromWallet.name>".
7. **Create:** in one `prisma.$transaction`, create the `Transfer` and its two rows, applying `applyBalanceOnCreate` to each row.
8. **Update:** in one `prisma.$transaction`:
   - Lock both rows with `SELECT … FOR UPDATE`.
   - Re-validate against the new wallets.
   - Update each row (wallet, amount, date, description) with `applyBalanceOnUpdate`. This handles a changed wallet the same way an edited transaction does today.
   - Update the `Transfer` record's `date` and `note`.
9. **Delete:** in one `prisma.$transaction`, lock both rows, apply `applyBalanceOnDelete` to each, then delete the rows and the `Transfer`.
10. A transfer may leave the source wallet's balance negative, the same as an expense can today.

### Changes to existing code

- **Transaction list and get:** include `transferId` and `transfer: { id, note, transactions: [{ id, amount, wallet: { id, name, currency } }] }`, so the client can show both sides of a transfer without another request.
- **Guards:**
  - `PATCH` and `DELETE /api/transactions/:id` on a row with a `transferId`: 409 "Edit this in the transfer".
  - `POST` and `PATCH /api/transactions` with an `isTransfer` category: 404 "Category not found", the same answer as any category the user can't use.
- **Categories:** the shared lookups in `category.service` (`findCategory`, `findUniqueCategory`, `findCategories`, `countCategories`) add `isTransfer: false` to every query. That one change covers:
  - the category list, which no longer shows them
  - get, update and delete on an `isTransfer` category, which answer 404 as if it didn't exist
  - transaction create and update, which can no longer pick them
  - the AI capture, which no longer sees them
  The transfer service uses the two fixed ids directly.
- **Stats:** the summary, category breakdown and yearly trend add `transferId: null` to their where clauses.
- **Wallets:** no change. Transfer rows count as transactions, so a wallet with transfers can't be deleted or have its currency changed.

## Client

- **Add sheet** (`transaction-form.tsx`, `use-transaction-form.ts`):
  - The type switch becomes Expense / Income / Transfer.
  - In Transfer mode the form shows:
    - From wallet, defaulting to the selected wallet.
    - To wallet, which leaves out the From wallet.
    - Amount, plus "Received (<CUR>)" when the currencies differ.
    - Date, and an optional note.
  - With two amounts, a read-only rate line appears, e.g. "1 KRW = 11.5 IDR".
  - There is no category picker and no Scan photo. The submit button reads "Save transfer".
  - Saving calls `POST /api/transfers`, then bumps `dataVersion` like the other saves.
  - While offline, the sheet shows "Transfers need a connection" and doesn't queue the save.
- **Rows** (`transactions-list.tsx`, dashboard Recent):
  - A row with a `transferId` gets a neutral arrows icon.
  - Its title is the note, or "To <wallet>" / "From <wallet>".
  - Its amount uses the ink colour, signed − for the out side and + for the in side.
- **Filter chips:** transfers appear only under All. Income and Expense hide them.
- **Wallet card totals** (`wallet-cards.tsx`): rows with a `transferId` are skipped when summing income and expense.
- **Details** (`transaction-details-modal.tsx`):
  - A transfer row shows from, to, both amounts and the date, using the `transfer` data already included in the list response.
  - **Edit** opens the sheet in Transfer mode prefilled and saves with `PATCH`.
  - **Delete** asks for confirmation, then sends `DELETE`.
- **Stats page:** no change.

## Errors

Every error is returned as `{ status, message }` and shown in the sheet or as a toast:
- 400: validation errors.
- 404: a wallet or transfer that isn't the user's.
- 409: a transfer row edited or deleted through `/api/transactions`.

Each write is a single database transaction, so a failure part-way leaves no partial transfer.

## Testing

**Backend integration** (`backend/tests/transfer.int.ts`, real Postgres and Redis):
- Create a same-currency transfer and a cross-currency one; both balances are correct.
- Each validation error from the rules above.
- Another user's wallet or transfer gives 404.
- Update the amounts, and move a transfer to a different wallet; the balances of all three wallets are correct.
- Delete restores both balances.
- The 409 guards on `/api/transactions/:id`.
- The transfer categories are missing from the categories list and refused by `POST /api/transactions`.
- The stats summary, breakdown and trend leave transfers out.
- A wallet that has a transfer can't be deleted.

**Frontend unit** (Vitest):
- Transfer mode shows one amount field for wallets in the same currency, and two plus the rate line for different currencies.
- The To list leaves out the From wallet.

**E2E** (`client/e2e/transfers.e2e.ts`, added to `SCENARIOS.md`):

| ID | Scenario | Expected |
|---|---|---|
| TR1 | KRW → IDR through the sheet | Both balances update; each wallet lists its side; stats unchanged |
| TR2 | Same-currency transfer | Only one amount field; both balances update |
| TR3 | Edit from the details sheet | Both sides show the new amounts; balances follow |
| TR4 | Delete from the details sheet | Both rows gone; balances restored |
| TR5 | Income/Expense filter chips | Transfer rows hidden; shown under All |

## Out of scope

- Fees.
- AI capture of transfers.
- Recurring transfers.
- Storing exchange rates or totals converted between currencies.
