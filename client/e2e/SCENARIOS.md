# E2E UI scenarios

Real browser (Pixel 7 viewport unless noted), real backend and database. Every
scenario is driven through the UI for the feature under test; the API is only
used to set up preconditions and to verify what was persisted.

Files: `auth.e2e.ts`, `dashboard.e2e.ts`, `transactions.e2e.ts`,
`wallets.e2e.ts`, `home.e2e.ts`, `settings.e2e.ts`, `capture.e2e.ts`, `transfers.e2e.ts`, plus the earlier
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
| D1 | Add income via the sheet | Balance and Income go up; row appears in Latest |
| D2 | Add expense via the sheet | Balance goes down, Expense goes up; row in Latest |
| D3 | Submit the sheet with no description / zero amount | Validation error, nothing created |
| D4 | Amount above the server cap | Server message shown, nothing created |
| D5 | Create a category inline from the sheet's category box | New category is selected and the transaction saves with it |
| D6 | Swipe to another wallet card on Transactions | Selected wallet and its list follow it |
| D7 | Add from the + sheet while the 2nd wallet is shown on Transactions | Saved to that wallet; Transactions stays on it |
| D8 | Long-press a wallet card on Transactions | That wallet becomes Main (tag moves, persists after reload) |
| D9 | "See all transactions" link | Opens /transactions |
| D10 | Bottom navigation (Home, Transactions, Wallets, Settings) | Each tab opens its page |

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

## Home (`home.e2e.ts`)
| ID | Scenario | Expected |
|---|---|---|
| H1 | KRW and IDR wallets; toggle KRW -> IDR | Total, cards, Latest and Summary switch to IDR; no KRW card or row |
| H2 | Tap a Home card | Lands on /transactions with that wallet's rows only |
| H3 | Swipe the Transactions cards to the 2nd wallet | List switches to the 2nd wallet's rows |
| H4 | Home month switcher -> previous month | Summary shows the empty state for that month; Total and Latest unchanged |
| H5 | Visit /stats | Ends on Home showing Summary |
| H6 | Tap the IDR card, reload Transactions | Still on the IDR wallet's list |
| H7 | Only KRW wallets | No Currency radiogroup |
| H8 | Income transaction this month | Listed under Summary's Income bars with its amount |
| H9 | Summary numbers | Income, Expense, Net and category share match the seeded month |
| H10 | Yearly chart | Income and expense bars drawn |
| H11 | Add from the + sheet while on Home | Summary and Latest update without a reload |
| H12 | New user with one wallet, no transactions | "No transactions yet" prompt and zeroes, no error |

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

## Transfers (`transfers.e2e.ts`)
| ID | Scenario | Expected |
|---|---|---|
| TR1 | KRW → IDR through the sheet | Both balances update; each wallet lists its side; stats unchanged |
| TR2 | Same-currency transfer | Only one amount field; both balances update |
| TR3 | Edit from the details sheet | Both sides show the new amounts; balances follow |
| TR4 | Delete from the details sheet | Both rows gone; balances restored |
| TR5 | Income/Expense filter chips | Transfer rows hidden; shown under All |
