# E2E UI scenarios

Real browser (Pixel 7 viewport unless noted), real backend and database. Every
scenario is driven through the UI for the feature under test; the API is only
used to set up preconditions and to verify what was persisted.

Files: `auth.e2e.ts`, `dashboard.e2e.ts`, `transactions.e2e.ts`,
`wallets.e2e.ts`, `stats.e2e.ts`, `settings.e2e.ts`, `capture.e2e.ts`, plus the earlier
regression suite `app.e2e.ts`.

## Auth (`auth.e2e.ts`)
| ID | Scenario | Expected |
|---|---|---|
| A1 | Register through the form | Lands on dashboard, signed in, empty-wallet prompt shown |
| A2 | Register with mismatched passwords | Error shown, stays on register |
| A3 | Register with a password under 8 chars | Error shown, stays on register |
| A4 | Register with an email that already exists (different case) | "Email already exist" error |
| A5 | Login with wrong password | "Invalid email or password", stays on login |
| A6 | Login, then reload | Still signed in |
| A7 | Visit a protected page signed out | Redirected to /login |
| A8 | Visit /login while signed in | Sent to the dashboard, not a 404 |
| A9 | Log out from the header menu | Back on /login; protected pages redirect again |
| A10 | Header avatar shows the user's initials | Initials of the registered name |

## Dashboard (`dashboard.e2e.ts`)
| ID | Scenario | Expected |
|---|---|---|
| D1 | Add income via the sheet | Balance and Income go up; row appears in Recent |
| D2 | Add expense via the sheet | Balance goes down, Expense goes up; row in Recent |
| D3 | Submit the sheet with no description / zero amount | Validation error, nothing created |
| D4 | Amount above the server cap | Server message shown, nothing created |
| D5 | Create a category inline from the sheet's category box | New category is selected and the transaction saves with it |
| D6 | Swipe to another wallet card | Selected wallet, balance and Recent list follow it |
| D7 | Add from the + sheet while the 2nd wallet is shown | Saved to that wallet; dashboard stays on it |
| D8 | Long-press a wallet card | That wallet becomes Main (tag moves, persists after reload) |
| D9 | "See all transactions" link | Opens /transactions |
| D10 | Bottom navigation | Each tab opens its page |

## Transactions (`transactions.e2e.ts`)
| ID | Scenario | Expected |
|---|---|---|
| T1 | Open a row | Details modal shows amount, description, category, wallet, date in local time |
| T2 | Details modal contains no placeholder/debug text | Only real transaction data |
| T3 | Edit amount and description | List and wallet balance update; persisted |
| T4 | Edit category from expense to income category | Balance moves accordingly |
| T5 | Delete with confirmation | Row gone, balance restored |
| T6 | Cancel delete | Row stays |
| T7 | Navigate to previous / next / future month | Correct month label; empty state for months with no data |
| T8 | Month view only lists that month's rows | No rows from adjacent months |

## Wallets & categories (`wallets.e2e.ts`)
| ID | Scenario | Expected |
|---|---|---|
| W1 | Create wallet (IDR, initial balance) | Card shows name, IDR, balance in rupiah |
| W2 | Edit wallet name only | Name changes, balance unchanged |
| W3 | Change currency of a wallet with transactions | Error toast, currency unchanged |
| W4 | Delete empty wallet with confirmation | Card gone |
| W5 | Delete wallet with transactions | Error toast explaining why; card stays |
| W6 | Create category (income) | Card shows name and type |
| W7 | Rename category | New name shown, persisted |
| W8 | Flip type of a category in use | Error toast; type unchanged |
| W9 | Delete category in use | Error toast; card stays |
| W10 | Delete unused category | Card gone |
| W11 | Open "Add wallet" right after editing a wallet | Empty form, not the previous wallet's values |
| W12 | Rename an IDR wallet | Currency stays IDR |

## Stats (`stats.e2e.ts`)
| ID | Scenario | Expected |
|---|---|---|
| S1 | Summary for current month | Net, income, expense match seeded data |
| S2 | Category breakdown | Expense categories with amounts and shares |
| S3 | Previous month | Its own (empty) numbers |
| S4 | Pick another wallet | Totals and currency follow that wallet |
| S5 | Yearly chart | Income and expense bars drawn |
| S6 | Add from the + sheet while on Stats | Numbers update without a reload (and the sheet defaults to a wallet) |
| S7 | User with no transactions | Zeroes / empty state, no error |

## Settings (`settings.e2e.ts`)
| ID | Scenario | Expected |
|---|---|---|
| G1 | Profile tab shows current name and email | Prefilled |
| G2 | Change name and save | Persisted (header initials and reload show the new name) |
| G3 | Change password form | Either works (old password stops working) or isn't offered |
| G4 | Appearance: pick Dark | `dark` class on <html>, persists after reload |
| G5 | All sections reachable on a phone-width screen | Each section opens |
| G6 | 404 page while signed in | 404 content with a working "Back to Home" |

## Cross-cutting checks (every scenario)
- No uncaught page errors (`pageerror`) during the scenario.

## AI capture (`capture.e2e.ts`)
| ID | Scenario | Expected |
|---|---|---|
| C1 | Generate, use and revoke the Shortcut token | Token starts with `ft_`; capture endpoint answers 503 (no Gemini key in e2e); after Revoke, "No token yet" and the endpoint answers 401 |
| C1b | Regenerating replaces the token | Old token gets 401; new token gets 503 (accepted, no Gemini key) |
| C1c | Token status fails to load | "Couldn't load token status" shown; no Generate button and no "No token yet" |
| C2 | A scanned photo fills the form | "Reading photo…" with Save disabled; then amount, description, category and wallet are filled and the hint "Filled from photo. Check before saving." shows; upload is JPEG; no transaction saved until Save |
| C3 | A failed scan shows the reason | Server message (e.g. "Couldn't find an amount") shown; form stays editable |
| C4 | Editing a transaction has no Scan photo option | No "Scan photo" control in the Edit transaction dialog |
| C5 | An income draft switches the type | Income type and the draft's category (Salary) are selected |
| C6 | A non-image file is rejected before any request | "This image format isn't supported. Try a JPEG or PNG screenshot." shown; no request reaches `/api/capture/photo` |
