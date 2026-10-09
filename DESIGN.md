---
name: Finance Tracker
description: A calm, tidy personal ledger for KRW and IDR wallets.
colors:
  canvas: "#F4F5F1"
  surface: "#FDFDFB"
  surface-muted: "#EEF0EA"
  ink: "#17181A"
  ink-muted: "#65686E"
  hairline: "#E6E8E2"
  lime: "#A6DD3C"
  lime-soft: "#EEF7D9"
  income: "#0F7D61"
  expense: "#C8412C"
  canvas-dark: "#111311"
  surface-dark: "#1B1D1B"
  surface-muted-dark: "#252825"
  ink-dark: "#F2F3EF"
  ink-muted-dark: "#9EA29B"
  hairline-dark: "#2E312D"
  lime-soft-dark: "#2A3518"
  income-dark: "#3CC796"
  expense-dark: "#F0735E"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  title:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  tile: "14px"
  field: "20px"
  card: "24px"
  sheet: "28px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    height: "52px"
    padding: "0 24px"
  button-pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 18px"
  button-icon:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "44px"
  chip-filter:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 16px 0 6px"
  chip-filter-selected:
    backgroundColor: "{colors.lime-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    height: "52px"
    padding: "0 18px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "20px"
  icon-tile:
    backgroundColor: "{colors.surface-muted}"
    rounded: "{rounded.tile}"
    size: "48px"
  nav-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sheet}"
    height: "80px"
  nav-action:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    size: "60px"
---

# Design System: Finance Tracker

## 1. Overview

**Creative North Star: "The Tidy Wallet"**

Everything has a place and nothing is out of place. The app feels like a well-organised wallet: soft rounded compartments on a calm, faintly warm canvas, each holding exactly one thing. Amounts are the content. They are set large, in tabular figures, with a clear sign, and the rest of the interface steps back so they can be read in a glance on a phone held in one hand.

The visual language is borrowed from a modern mobile task app: off-white canvas, near-white cards with generous radii, pill-shaped controls, near-black ink for primary actions, and a single fresh lime used sparingly for selection and progress. It is strictly **Restrained**: tinted neutrals plus one accent, with the only other colors reserved for meaning (income and expense). There are no dark hero cards in the light theme; depth comes from tone, not drama.

This system rejects the **generic SaaS dashboard** (gray sidebars, rows of identical stat cards, gradient accents, dense admin tables) and anything **childish or gamified** (cartoon icons, confetti, badges, streaks). It is a calm personal tool, not a product demo and not a game.

Layout is a single phone column with a 24px gutter, content max width 480px centered on larger screens, and a fixed bottom navigation. Vertical rhythm alternates tight groups (12px inside a card) with clear separations (24 to 32px between sections), so screens read as a few tidy compartments rather than one long list. Motion is responsive, not choreographed: 150 to 250ms state transitions with an ease-out-quart curve; sheets slide up; nothing bounces; everything collapses to an opacity fade under `prefers-reduced-motion`.

**Key Characteristics:**
- Soft compartments: near-white cards (24px radius) on a tinted canvas, no heavy borders.
- Pills everywhere you tap: filters, actions, segmented controls, nav.
- Near-black ink for the one primary action; lime only for "selected" and "progress".
- Big, tabular, signed numbers; muted small meta text beneath.
- One raised center button in the nav: add a transaction from anywhere.

## 2. Colors

A tinted-neutral palette leaning very slightly toward the lime hue, one fresh accent, and two meaning colors that are never used decoratively.

### Primary
- **Fresh Lime** (`lime`): the brand accent. Fills selected filter chips' count dot, progress bar fills, the active-tab indicator dot, and small status tags. Always paired with ink text or ink icons on top. Never used for text on light surfaces, never for money direction.
- **Lime Mist** (`lime-soft` / `lime-soft-dark`): background of a selected filter chip or segmented option. Large-area companion to Fresh Lime.

### Neutral
- **Ink** (`ink` / `ink-dark`): primary text, amounts, primary buttons, the nav's raised add button. In dark theme it inverts to a warm off-white.
- **Muted Ink** (`ink-muted` / `ink-muted-dark`): meta lines (dates, counts, wallet names under titles), placeholder text, inactive nav labels. Passes 4.5:1 on surface and canvas in both themes.
- **Canvas** (`canvas` / `canvas-dark`): the screen background behind cards.
- **Surface** (`surface` / `surface-dark`): cards, inputs, pills, sheets, nav bar.
- **Sunken Surface** (`surface-muted` / `surface-muted-dark`): icon tiles, progress-bar tracks, pressed state of pills.
- **Hairline** (`hairline` / `hairline-dark`): 1px dividers between rows inside a card and the optional input border. Never a card outline.

### Meaning colors (not decorative)
- **Income Teal** (`income` / `income-dark`): positive amounts and the income series in charts. Deliberately a cool teal-green, clearly distinct from Fresh Lime.
- **Expense Coral** (`expense` / `expense-dark`): negative amounts, the expense series in charts, destructive actions and error text.

### Named Rules
**The One Voice Rule.** Fresh Lime covers at most 10% of any screen. If two lime things compete for attention, one of them is wrong.

**The Lime Is Not Text Rule.** Lime never carries text or icons on light surfaces (it fails contrast). Text sits on lime, never in lime.

**The Signed Amount Rule.** Every amount shows its direction with a sign (+ / −) as well as color. Income Teal and Expense Coral appear only on amounts, chart series and destructive states.

**The No Pure Values Rule.** No `#000` and no `#fff` anywhere; use Ink and Surface.

## 3. Typography

**Display / Body Font:** Plus Jakarta Sans (with `system-ui, sans-serif`), loaded in weights 400, 500, 600, 700.

**Character:** A geometric sans with soft, open shapes: friendly without being cute, tidy without being cold. One family carries everything; hierarchy comes from size and weight, not from mixing fonts.

### Hierarchy
- **Display** (700, 32px, 1.1, −0.02em): page titles ("Transactions", "Wallets"), allowed to wrap to two lines as in the reference. One per screen.
- **Headline** (700, 24px, 1.2, tabular): the headline amount of a card (wallet balance, month total).
- **Title** (700, 19px, 1.3): card titles, wallet names, sheet titles.
- **Body** (500, 15px, 1.5): row titles, button and chip text, input text. Line length capped at 65ch where text runs.
- **Label** (500, 12px, 1.4, +0.01em): meta lines, nav labels, percentages, captions.

Steps are 12 / 15 / 19 / 24 / 32 (each about 1.25× the previous).

### Named Rules
**The Tabular Money Rule.** Every amount uses `font-variant-numeric: tabular-nums` so columns of numbers align and totals don't jitter as they update.

**The One Display Rule.** Exactly one Display-size element per screen: the page title. Amounts top out at Headline.

## 4. Elevation

Near-flat, tonal layering. Depth comes from Surface sitting on Canvas, not from shadows. Shadows exist only for things that float above the page: the bottom navigation, sheets and popovers.

### Shadow Vocabulary
- **Resting card** (`box-shadow: 0 1px 2px rgba(23, 24, 26, 0.04)`): barely there; separates a card from canvas in bright light. Omit in dark theme.
- **Floating bar** (`box-shadow: 0 -8px 24px rgba(23, 24, 26, 0.06)`): bottom navigation.
- **Raised action** (`box-shadow: 0 8px 20px rgba(23, 24, 26, 0.18)`): the nav's center add button.
- **Sheet** (`box-shadow: 0 -12px 40px rgba(23, 24, 26, 0.12)`): bottom sheets and dialogs.

### Named Rules
**The Flat Card Rule.** Cards never get more than the resting shadow and never get a border outline. If a card needs a border to be visible, the canvas/surface contrast is wrong.

## 5. Components

### Buttons
- **Shape:** fully rounded pills (`rounded.pill`).
- **Primary:** Ink fill, Surface text, 52px tall, full width in forms and sheets ("Add expense", "Sign in"). One per screen or sheet.
- **Pill (secondary):** Surface fill, Ink text, 44px tall, optional 18px leading icon. Used for page-level actions next to the title ("Add", "This month").
- **Icon button:** 44px Surface circle with an Ink icon (theme toggle, back, edit). The "open" affordance on cards uses a 36px Sunken Surface circle with an arrow-up-right icon.
- **Destructive:** Surface pill with Expense Coral text; confirm step uses an Expense Coral fill with Surface text.
- **Hover / Press / Focus:** press darkens fill one step (Surface → Sunken Surface, Ink → 85% Ink) over 150ms; focus shows a 2px Ink ring with 2px offset (Ink-dark ring in dark theme). Lime is never the focus color (too low contrast).

### Chips (filters and segmented controls)
- **Style:** 44px pill, Surface fill, Muted Ink text. A leading 32px Sunken Surface circle holds the count in Ink label weight 600 ("5 All", "3 Income").
- **Selected:** Lime Mist fill, Ink text weight 600, count circle turns Surface. No checkmark needed.
- **Use:** transaction type filters (All / Income / Expense), the Wallets vs Categories switch, theme choice in Settings. Rows of chips scroll horizontally, never wrap.

### Cards / Containers
- **Corner style:** 24px (`rounded.card`); sheets 28px top corners.
- **Background:** Surface on Canvas.
- **Shadow:** resting card only (see Elevation).
- **Border:** none. Rows inside a card are separated by 1px Hairline inset 16px from the left.
- **Internal padding:** 20px; 16px between stacked elements inside.
- **Never nested.** A list of rows lives in one card; a card never contains another card.

### Wallet Card (signature)
The reference's project card, translated. Top row: 48px icon tile tinted with the wallet's own color at low opacity (wallet icon in that color, darkened for contrast), wallet name in Title, meta line in Label Muted Ink ("12 transactions · KRW"), and the 36px open circle on the right. Below: the balance in Headline (tabular, signed only if negative). Bottom: an 8px progress track (Sunken Surface) with a Fresh Lime fill showing this month's spending as a share of this month's income, a caption "62% of income spent" in Label Muted Ink, and income / expense amounts on the right in Label with sign and meaning color. Over 100% the fill switches to Expense Coral and the caption says so in words.

### Transaction Row
48px icon tile (category initial or icon on Sunken Surface), description in Body 600, meta in Label Muted Ink ("Food · 3 Oct, 13.00"), amount right-aligned in Body 700 tabular with sign and meaning color. Whole row is a 64px+ tap target that opens the details sheet.

### Inputs / Fields
- **Style:** 52px tall, Surface fill, 20px radius, no border on Canvas; 1px Hairline border when placed on a Surface card. Leading 18px Muted Ink icon for search.
- **Amount input (signature):** in the add sheet, the amount is entered in Display size, tabular, with the currency symbol in Muted Ink before it.
- **Focus:** 2px Ink ring, 2px offset.
- **Error:** Expense Coral 1px border plus a Label-size message below in Expense Coral, written as what to do ("Enter an amount above 0").
- **Disabled:** 50% opacity, no pointer.

### Navigation
- **Top bar (per screen):** left, a 44px avatar circle (initials on Lime Mist) and two lines: "Good morning" in Label Muted Ink, the user's name in Title. Right: icon buttons (theme toggle). Below it, the Display page title with an optional Pill action on the right.
- **Bottom bar:** Surface, 28px top corners, floating bar shadow, safe-area padding. Five slots: Home, Transactions, **Add** (center), Stats, Wallets. Tabs are 24px icons over a Label caption; inactive in Muted Ink, active in Ink weight 600 with a 4px Fresh Lime dot beneath.
- **Center Add button (signature):** 60px Ink circle with a Surface "+" icon, raised 20px above the bar with the raised-action shadow. Always opens the Add Transaction sheet; it is never a tab and never shows an active state. In dark theme it becomes an Ink-dark (off-white) circle with an Ink icon.

### Sheets and Dialogs
Bottom sheets for create/edit flows (28px top radius, 4px × 36px Sunken Surface handle, 24px padding). Centered dialogs only for destructive confirmation, with the destructive choice on the right.

### Screen map
How each existing screen adopts the system. Items marked *(new)* are presentation additions on top of existing data, not new backend features.

- **Dashboard (Home):** top bar; Display title "This month" with a Pill showing the month. Wallet cards in a horizontal snap-scroll row (one card plus a 24px peek of the next), replacing arrows and letter chips; long-press a card to set it as main (a small Lime Mist "Main" tag on the card). Below: filter chips All / Income / Expense with counts *(new)*, then one card of the five most recent Transaction Rows and a "See all" Pill.
- **Transactions:** top bar; Display "Transactions"; month switcher as a Pill with chevrons; search field *(new, client-side over the loaded month)*; filter chips All / Income / Expense with counts *(new)*; rows grouped by day, each day a Label header ("Thu, 3 Oct") over one card of rows; "Load more" as a full-width Pill at the end.
- **Add / Edit transaction (sheet):** opened by the center Add button or a row. Segmented chips Expense / Income at top, the Display-size amount input, description field, category as a horizontally scrolling chip row with a "+ New" chip, wallet and date as Pill selectors, Primary button at the bottom.
- **Transaction details (sheet):** amount in Headline with sign, description in Title, then label/value rows (Category, Wallet, Date) in one card; Edit as Pill, Delete as destructive Pill.
- **Stats:** Display "Stats"; month Pill and wallet Pill as filters. A single summary card with three columns (Income, Expense, Net) in Title tabular with signs: one card, not three stat cards. Category breakdown as Transaction-Row-style rows each with an 8px bar (Fresh Lime fill, share of total expense) instead of a pie. Trend chart in one card: bars in Income Teal and Expense Coral, Hairline gridlines, Label axis text, no legend box (series named in the card's meta line).
- **Wallets & Categories:** Display "Wallets"; Pill "Add". Segmented chips "Wallets n" / "Categories n". Wallets: stacked Wallet Cards. Categories: one card of rows (color tile, name, type as a Label tag, open circle).
- **Settings:** Display "Settings"; grouped cards of rows (Profile, Password, Appearance, Security), each row with a trailing chevron opening a sheet. Theme choice as three chips Light / Dark / System.
- **Auth (Login / Register):** no bottom bar. Canvas background, app mark, Display "Welcome back" / "Create account", fields stacked with 12px gaps, Primary button full width, secondary link in Body Muted Ink.
- **Empty states:** one short sentence in Body Muted Ink plus the single Pill that fixes it ("Add your first wallet"). No illustrations.

## 6. Do's and Don'ts

### Do:
- **Do** keep a 24px screen gutter and at least 24px between sections; 12 to 16px inside cards.
- **Do** show every amount with a sign, tabular figures, and its currency symbol (₩ for KRW, Rp for IDR).
- **Do** use Fresh Lime only for selection, progress and the active-tab dot, on at most 10% of the screen.
- **Do** make every tappable element at least 44px and give it a visible 2px Ink focus ring.
- **Do** design both themes together; each token has a light and a dark value and both meet WCAG AA.
- **Do** use bottom sheets for create and edit; reserve centered dialogs for destructive confirmation.
- **Do** write UI copy as plain, short sentences; tell people what to do in errors.

### Don't:
- **Don't** build a **generic SaaS dashboard**: no gray sidebar, no rows of identical stat cards, no gradient accents, no dense admin tables.
- **Don't** make it **childish or gamified**: no cartoon icons, confetti, badges, streaks or mascots.
- **Don't** use a dark hero card in the light theme; the black "pinned" card from the reference is intentionally not adopted.
- **Don't** introduce purple or any second brand accent. Category colors come only from the user's own choices, shown at low opacity in icon tiles.
- **Don't** put text or icons in lime on light surfaces, or use lime (or any green) for money direction.
- **Don't** use `#000` or `#fff`, side-stripe borders (`border-left` thicker than 1px as an accent), gradient text, or decorative glassmorphism.
- **Don't** nest cards or outline cards with borders.
- **Don't** animate layout properties or use bounce/elastic easing.
- **Don't** use em dashes in UI copy.
