# AI transaction capture: design

Date: 2026-10-10. Status: approved in brainstorming, pending spec review.

## Goal

1. Replace the n8n workflow. Today an iOS Shortcut screenshots a banking/payment app, iOS OCR extracts the text, and n8n uses AI to turn it into JSON and calls the app's create-transaction API. The backend takes over: the Shortcut posts the OCR text straight to us, we extract the transaction with AI and save it.
2. Add "Scan photo" to the app's Add sheet: AI reads a photo of a receipt or payment screen and fills the form; the user confirms by tapping Save.

## Decisions

| Topic | Decision |
|---|---|
| AI provider | Google Gemini API, free tier, model `gemini-2.5-flash` (configurable). Free-tier inputs may be used by Google to improve its products; accepted for personal use. |
| Shortcut auth | Personal API token, one per user, valid only on the Shortcut endpoint |
| Shortcut flow | Save immediately, return a one-line summary for the Shortcut to show |
| Photo flow | Return a draft only; the user reviews it in the form and saves with the existing create endpoint |
| No category fits | Use an "Other" category of the right type, created on first use |
| Several transactions in one capture | Extract one: the most relevant payment (receipt total, latest payment) |
| Photo storage | Not stored |

## Architecture

```
iOS Shortcut ──OCR text──▶ POST /api/capture/text  (API token) ─┐
                                                              ├─▶ capture.service ─▶ ai.service (Gemini)
App Add sheet ──photo────▶ POST /api/capture/photo (session)  ─┘        │
                                                                       ▼
                                                   resolve (our rules) ─▶ draft
                                     text: createTransaction(draft) → summary
                                     photo: return draft to the app
```

Units (backend, following routes → controllers → services):

- `services/ai.service.ts`: the only module that knows about Gemini. `extract(input: { text } | { image, mimeType }, context): Promise<AiExtraction>`. Sends a prompt plus a JSON response schema and parses the reply. Throws `AiUnavailableError` on network, quota or parse failures.
- `services/capture.service.ts`: pure resolution rules plus orchestration. `resolveDraft(extraction, wallets, categories, now, tz)` turns an `AiExtraction` into a `TransactionDraft` (ids, not names) or throws a `CaptureError` with a readable message. Creates the "Other" category when needed.
- `controllers/capture.controller.ts`: `captureTextHandler` (resolve, then `createTransaction`, then summary) and `capturePhotoHandler` (resolve, return the draft).
- `middleware/requireApiToken.ts`: authenticates `Authorization: Bearer ft_…` and sets `res.locals.user`. Mounted only on `/api/capture/text`.
- Token endpoints in the user routes/controller (session auth).

### AI contract

Gemini receives the input (text or image), the user's wallets (name, currency), categories (name, type), the current local date/time and timezone (`Asia/Seoul` server default), and instructions to pick the single most relevant payment. Response schema (`AiExtraction`):

```ts
{
  found: boolean;                 // false if no transaction is recognizable
  type: 'INCOME' | 'EXPENSE';
  amount: number | null;          // positive, in the transaction currency
  currency: string | null;        // ISO code if visible (KRW, IDR, USD…)
  description: string;            // short, e.g. the merchant name
  date: string | null;            // ISO-8601 local date-time if visible
  categoryName: string | null;    // best match among the provided categories
  walletName: string | null;      // best match among the provided wallets
}
```

The AI only reads and labels; our code decides what is saved.

## Resolution rules (`resolveDraft`)

1. `found` false, or `amount` missing: `CaptureError("Couldn't find an amount")`.
2. Amount must be > 0 and ≤ `MAX_AMOUNT` (999,999,999,999), else `CaptureError`.
3. Wallet:
   - `walletName` matches a wallet (case-insensitive) whose currency equals `currency` (or `currency` is null): use it.
   - else if `currency` is known: main wallet if same currency, else first wallet in that currency, else `CaptureError("No <CUR> wallet")`.
   - else (currency unknown): main wallet, else first wallet; no wallets at all → `CaptureError("Add a wallet first")`.
4. Category: `categoryName` matching an existing category of the same `type` (case-insensitive, user's own or global) → use it; else "Other" of that type (find, or create for the user).
5. Date: parse `date` as local time in the user timezone; missing or unparseable → now; more than 24h in the future → now.
6. Description: trimmed, max 255 chars; empty → the resolved category's name.

Output `TransactionDraft`: `{ type, amount, description, date (ISO instant), walletId, categoryId, categoryName, walletName, currency }`.

## API

### Personal API token (session auth)

- `GET /api/users/me/api-token` → `{ exists, createdAt, lastUsedAt }`
- `POST /api/users/me/api-token` → `{ token }` (plain token shown once; replaces any existing token)
- `DELETE /api/users/me/api-token` → 204

Token format `ft_` + 32 random bytes (base64url). Stored as SHA-256 hash on the user: new nullable columns `apiTokenHash` (unique), `apiTokenCreatedAt`, `apiTokenLastUsedAt` (migration). `lastUsedAt` updated on each successful use.

### `POST /api/capture/text` (API token)

Body `{ text: string }` (1 to 8,000 chars). Response 201:

```json
{ "status": "success", "message": "Added -₩6,500 Latte · Coffee · KRW Main", "data": { "transaction": { … } } }
```

### `POST /api/capture/photo` (session)

Body `{ image: string (base64, no data: prefix), mimeType: "image/jpeg" | "image/png" | "image/webp" }`, decoded size ≤ 5 MB. Response 200 `{ status, data: { draft: TransactionDraft } }`. Nothing is saved.

The global `express.json({ limit: '10kb' })` stays; `/api/capture/photo` gets its own `express.json({ limit: '7mb' })` mounted before the global parser.

### Shared behavior

- Rate limit: one shared budget of 30 captures per hour per user across both endpoints (`express-rate-limit`, keyed by user id).
- Missing `GEMINI_API_KEY` → 503 "AI capture isn't set up".
- `AiUnavailableError` → 503 "AI is unavailable, try again later".
- `CaptureError` → 422 with its message. Validation errors → 400 (existing `validate` middleware, which now includes `message`).
- Every error body is `{ status, message }`, so the Shortcut can show `message` whether the call succeeded or failed.

## Client

- **Add sheet**: "Scan photo" pill beside the Expense/Income switch, backed by `<input type="file" accept="image/*">` (on iPhone this offers camera or library). The client downsizes to max 1600px and re-encodes as JPEG (canvas) before upload. While waiting: "Reading photo…" and Save disabled. On success the form is filled from the draft (type, amount, description, category, wallet, date) and a note shows "Filled from photo. Check before saving." On error the message shows in the sheet and the form stays editable. Saving uses the existing `POST /api/transactions`.
- **Settings → Security**: "Shortcut token" card with status (none / created / last used), Generate or Regenerate, Revoke, a one-time reveal of the new token with Copy, and the Shortcut settings to use (URL, header, body).
- **Docs**: `docs/shortcut-setup.md` with the iOS Shortcut steps: Take Screenshot → Extract Text from Image → Get Contents of URL (POST, header, JSON body `{"text": …}`) → Show Notification with the response `message`.

## Configuration

- `GEMINI_API_KEY` (env, mapped in `custom-environment-variables.ts`), optional: capture is disabled when absent.
- `geminiModel` in config, default `gemini-2.5-flash`.
- New dependency: `@google/genai` (official Gemini SDK).

## Testing

- Unit (Jest): `resolveDraft` rules: wallet and currency choice, "Other" fallback and creation, date handling (missing, future, timezone), amount bounds, no-wallet case. Gemini is never called.
- Integration (`npm run test:int`, real Postgres/Redis, `ai.service` replaced by a fake via `jest.mock`): token generate/regenerate/revoke; token required and rejected after revoke; token not accepted on other endpoints; text capture creates the transaction and returns the summary; photo capture returns a draft and saves nothing; oversized image rejected; 503 when AI is unavailable or not configured; rate limit.
- E2E (Playwright): Settings token generate/copy/revoke; photo flow with `/api/capture/photo` mocked via `page.route`: form filled, nothing saved until Save, error keeps form editable.
- Manual: one script `backend/scripts/try-capture.ts` that calls real Gemini with a sample text when `GEMINI_API_KEY` is set. Not part of any test run.

## Out of scope

- Multiple transactions per capture.
- Storing photos or OCR text.
- Learning from user corrections.
- A review queue for Shortcut captures (they are saved immediately; mistakes are fixed in the app).
