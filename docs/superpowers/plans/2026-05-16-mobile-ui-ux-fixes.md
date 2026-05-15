# Mobile UI/UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all identified bugs and mobile UX issues across the Finance Tracker PWA — dark-theme breakage, hardcoded fallbacks, wrong icons, dev leftovers, and incomplete settings UI.

**Architecture:** Each task is self-contained — edit one or two files, verify visually via Playwright screenshot, commit. No new dependencies needed; theme-awareness uses existing Tailwind CSS variables (`bg-background`, `text-foreground`, etc.) and the existing `useTheme()` context.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn/ui, Vite, Playwright (for visual verification)

---

## File Map

| File | What changes |
|------|-------------|
| `client/src/components/finance/transactions-list.tsx` | Replace all hardcoded `bg-white` / `text-gray-*` / `hover:bg-gray-50` / `divide-gray-100` / `border-gray-200` with theme-aware equivalents |
| `client/src/components/app-header.tsx` | Derive avatar initials from `user.name`; remove broken `AvatarImage` src |
| `client/src/pages/Stats.tsx` | Replace hardcoded `$` Y-axis formatter with currency-aware version |
| `client/src/components/icons/menu-icons.tsx` | Add `TransactionsIcon` SVG |
| `client/src/components/app-layout.tsx` | Wire `TransactionsIcon` into the bottom nav Transactions item |
| `client/src/config/menu.ts` | Remove "Pages" and "Error" dev-only sidebar items |
| `client/src/pages/Settings.tsx` | Fix tab overflow on mobile; add real Light/Dark/System buttons in Appearance tab |
| `client/src/components/finance/wallet-carousel.tsx` | Update hint text from desktop drag language to mobile touch language |
| `docker-compose.yml` | Change `VITE_APP_NAME=Finance App` → `VITE_APP_NAME=Finance Tracker` (both frontend services) |

---

## Task 1: Fix Transactions page — dark theme breakage

**Files:**
- Modify: `client/src/components/finance/transactions-list.tsx`

The `variant="full"` branch uses hardcoded light-mode classes throughout. Replace every hardcoded color with Tailwind CSS variables so it respects both light and dark themes.

- [ ] **Step 1: Replace hardcoded classes in the full-variant loading state (line ~144)**

Change:
```tsx
<div className={cn("bg-white min-h-screen", className)}>
```
To:
```tsx
<div className={cn("bg-background min-h-screen", className)}>
```

- [ ] **Step 2: Replace hardcoded classes in the full-variant error state (line ~154)**

Change:
```tsx
<div className={cn("bg-white min-h-screen p-4", className)}>
```
To:
```tsx
<div className={cn("bg-background min-h-screen p-4", className)}>
```

- [ ] **Step 3: Replace hardcoded classes in the full-variant root container (line ~166)**

Change:
```tsx
<div className={cn("bg-white min-h-screen", className)}>
```
To:
```tsx
<div className={cn("bg-background min-h-screen", className)}>
```

- [ ] **Step 4: Replace month navigation header (line ~169)**

Change:
```tsx
<div className="bg-white border-b border-gray-200 px-4 py-3">
```
To:
```tsx
<div className="bg-background border-b border-border px-4 py-3">
```

- [ ] **Step 5: Replace transactions list container (line ~199)**

Change:
```tsx
<div className="bg-white">
```
To:
```tsx
<div className="bg-background">
```

- [ ] **Step 6: Replace divider class (line ~207)**

Change:
```tsx
<div className="divide-y divide-gray-100">
```
To:
```tsx
<div className="divide-y divide-border">
```

- [ ] **Step 7: Fix `TransactionListItem` hover and text colors (lines ~57–84)**

Change the item `div` from:
```tsx
className="flex items-center justify-between py-4 px-4 hover:bg-gray-50 cursor-pointer transition-colors"
```
To:
```tsx
className="flex items-center justify-between py-4 px-4 hover:bg-accent cursor-pointer transition-colors"
```

Change description text from:
```tsx
<div className="font-medium text-gray-900">
```
To:
```tsx
<div className="font-medium text-foreground">
```

Change date text from:
```tsx
<div className="text-sm text-gray-500">
```
To:
```tsx
<div className="text-sm text-muted-foreground">
```

Change expense amount from:
```tsx
isIncome ? "text-blue-600" : "text-gray-900"
```
To:
```tsx
isIncome ? "text-blue-500" : "text-foreground"
```

- [ ] **Step 8: Fix empty state text color (line ~201)**

Change:
```tsx
<p className="text-gray-500">
```
To:
```tsx
<p className="text-muted-foreground">
```

- [ ] **Step 9: Verify visually with Playwright**

Navigate to `https://finance.umeh.me/transactions` at 390×844 viewport. Confirm dark background, readable text, no white flash.

- [ ] **Step 10: Commit**

```bash
git add client/src/components/finance/transactions-list.tsx
git commit -m "fix: replace hardcoded bg-white/gray colors with theme-aware classes in transactions list"
```

---

## Task 2: Fix avatar — wrong initials and broken image

**Files:**
- Modify: `client/src/components/app-header.tsx`

The avatar always shows "SC" (a shadcn template remnant) and tries to load a broken image URL.

- [ ] **Step 1: Add a helper to derive initials from user name**

Inside `AppHeader`, before the return statement, add:

```tsx
const getUserInitials = (name: string) => {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};
```

- [ ] **Step 2: Replace the Avatar markup**

Change:
```tsx
<Avatar className='h-8 w-8'>
  <AvatarImage src={baseUrl + '/avatars/shadcn.jpg'} alt='shadcn' />
  <AvatarFallback className="rounded-lg">SC</AvatarFallback>
</Avatar>
```
To:
```tsx
<Avatar className='h-8 w-8'>
  <AvatarFallback className="rounded-lg">
    {user ? getUserInitials(user.name) : 'U'}
  </AvatarFallback>
</Avatar>
```

Also remove the now-unused `baseUrl` import from `@/config/app` if `baseUrl` is no longer used elsewhere in this file. Check with a grep first:

```bash
grep -n "baseUrl" client/src/components/app-header.tsx
```

If `baseUrl` only appears in the avatar src, remove its import line.

- [ ] **Step 3: Verify with Playwright**

Navigate to `https://finance.umeh.me/`. Confirm the avatar shows "US" (for Umar Syarif). Confirm no console error about `/avatars/shadcn.jpg`.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/app-header.tsx
git commit -m "fix: derive avatar initials from user name, remove broken avatar image"
```

---

## Task 3: Fix Stats chart — hardcoded `$` Y-axis

**Files:**
- Modify: `client/src/pages/Stats.tsx`

Both `BarChart` and `LineChart` use `tickFormatter={(value) => \`$${value}\`}` which always displays USD even when the wallet is KRW or IDR.

- [ ] **Step 1: Replace Y-axis formatter in BarChart**

Change:
```tsx
<YAxis tickFormatter={(value) => `$${value}`} />
```
To:
```tsx
<YAxis tickFormatter={(value) => formatCurrency(Number(value), selectedCurrency)} />
```

- [ ] **Step 2: Replace Y-axis formatter in LineChart**

Change:
```tsx
<YAxis tickFormatter={(value) => `$${value}`} />
```
To:
```tsx
<YAxis tickFormatter={(value) => formatCurrency(Number(value), selectedCurrency)} />
```

- [ ] **Step 3: Verify with Playwright**

Navigate to `https://finance.umeh.me/stats`. Confirm Y-axis shows `₩` or `IDR` labels (not `$`). If no data, show filters and switch wallet to verify currency changes.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Stats.tsx
git commit -m "fix: use wallet currency in Stats chart Y-axis instead of hardcoded dollar sign"
```

---

## Task 4: Fix bottom nav — wrong icon for Transactions

**Files:**
- Modify: `client/src/components/icons/menu-icons.tsx`
- Modify: `client/src/components/app-layout.tsx`

Both "Transactions" and "Stats" use `<StatsIcon />` in the bottom nav.

- [ ] **Step 1: Add `TransactionsIcon` to the icons file**

In `client/src/components/icons/menu-icons.tsx`, add after the `HomeIcon` export:

```tsx
export function TransactionsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className || "h-6 w-6 mb-1"}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Import and use `TransactionsIcon` in `app-layout.tsx`**

Change the import:
```tsx
import { HomeIcon, StatsIcon, WalletIcon } from './icons/menu-icons';
```
To:
```tsx
import { HomeIcon, StatsIcon, TransactionsIcon, WalletIcon } from './icons/menu-icons';
```

Change the Transactions nav item from:
```tsx
{
  icon: <StatsIcon />,
  label: 'Transactions',
  ...
},
```
To:
```tsx
{
  icon: <TransactionsIcon />,
  label: 'Transactions',
  ...
},
```

- [ ] **Step 3: Verify with Playwright**

Navigate to `https://finance.umeh.me/`. Confirm bottom nav shows a different icon for "Transactions" vs "Stats".

- [ ] **Step 4: Commit**

```bash
git add client/src/components/icons/menu-icons.tsx client/src/components/app-layout.tsx
git commit -m "fix: add distinct TransactionsIcon for bottom nav, Transactions and Stats no longer share the same icon"
```

---

## Task 5: Remove dev placeholder items from sidebar

**Files:**
- Modify: `client/src/config/menu.ts`

"Pages" (with sub-items Sample Page, Coming Soon) and "Error" are developer scaffolding that should not be visible in production.

- [ ] **Step 1: Remove the "Pages" and "Error" entries**

Replace the entire `mainMenu` array with:
```ts
export const mainMenu: MenuType = [
    {
        title: 'Dashboard',
        url: '/',
        icon: Gauge
    },
    {
        title: 'Wallets & Categories',
        url: '/wallets',
        icon: Wallet
    },
]
```

Also remove the now-unused imports `CircleAlert` and `Files` from lucide-react:
```ts
import {
    Gauge,
    Wallet,
    LucideIcon
} from 'lucide-react'
```

- [ ] **Step 2: Verify with Playwright**

Click the hamburger menu. Confirm sidebar only shows "Dashboard" and "Wallets & Categories" — no "Pages" or "Error".

- [ ] **Step 3: Commit**

```bash
git add client/src/config/menu.ts
git commit -m "fix: remove Pages and Error dev-only items from sidebar navigation"
```

---

## Task 6: Fix Settings tabs — mobile overflow

**Files:**
- Modify: `client/src/pages/Settings.tsx`

On 390px wide mobile the 4 tabs squish and "Appearance" is barely readable. The `TabsList` needs horizontal scrolling.

- [ ] **Step 1: Add overflow-x-auto and whitespace-nowrap to TabsList**

Find the `TabsList` element (around line 48) and change from:
```tsx
<TabsList className="grid w-full grid-cols-4">
```
To:
```tsx
<TabsList className="flex w-full overflow-x-auto scrollbar-none gap-1 h-auto p-1">
```

Change each `TabsTrigger` to remove grid-column assumptions and ensure they don't shrink:
Each tab trigger like:
```tsx
<TabsTrigger value="profile" className="flex items-center gap-2">
```
Becomes:
```tsx
<TabsTrigger value="profile" className="flex items-center gap-2 shrink-0">
```

Apply `shrink-0` to all four `TabsTrigger` elements: profile, security, notifications, appearance.

- [ ] **Step 2: Verify with Playwright at 390px**

Navigate to `https://finance.umeh.me/settings`. All 4 tabs should be visible and tappable without overflow clipping. Swipe/scroll the tab bar if needed.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Settings.tsx
git commit -m "fix: make Settings tabs horizontally scrollable on mobile"
```

---

## Task 7: Add real theme selector in Settings Appearance tab

**Files:**
- Modify: `client/src/pages/Settings.tsx`

The Appearance tab has a `{/* TODO: Add theme selector */}` placeholder. Wire in the actual `useTheme()` context with Light / Dark / System buttons.

- [ ] **Step 1: Add `useTheme` import to Settings.tsx**

In the imports section add:
```tsx
import { useTheme } from '@/contexts/theme.context';
import { Sun, Moon, Monitor } from 'lucide-react';
```

- [ ] **Step 2: Use the theme hook inside the component**

At the top of the `Settings` function body, add:
```tsx
const { theme, setTheme } = useTheme();
```

- [ ] **Step 3: Replace the TODO placeholder in the Appearance tab**

Replace:
```tsx
<div className="space-y-2">
  <Label>Color Theme</Label>
  <p className="text-sm text-muted-foreground">
    Choose your preferred color theme.
  </p>
  {/* TODO: Add theme selector */}
</div>
```
With:
```tsx
<div className="space-y-2">
  <Label>Color Theme</Label>
  <p className="text-sm text-muted-foreground">
    Choose your preferred color theme.
  </p>
  <div className="flex gap-2 pt-1">
    <Button
      variant={theme === 'light' ? 'default' : 'outline'}
      size="sm"
      onClick={() => setTheme('light')}
      className="flex items-center gap-2"
    >
      <Sun className="h-4 w-4" />
      Light
    </Button>
    <Button
      variant={theme === 'dark' ? 'default' : 'outline'}
      size="sm"
      onClick={() => setTheme('dark')}
      className="flex items-center gap-2"
    >
      <Moon className="h-4 w-4" />
      Dark
    </Button>
    <Button
      variant={theme === 'system' ? 'default' : 'outline'}
      size="sm"
      onClick={() => setTheme('system')}
      className="flex items-center gap-2"
    >
      <Monitor className="h-4 w-4" />
      System
    </Button>
  </div>
</div>
```

- [ ] **Step 4: Verify with Playwright**

Navigate to `/settings` → Appearance tab. Click "Light" — page goes light. Click "Dark" — page goes dark. Active button should appear filled/default variant.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Settings.tsx
git commit -m "feat: add Light/Dark/System theme selector in Settings Appearance tab"
```

---

## Task 8: Fix wallet carousel hint text for mobile

**Files:**
- Modify: `client/src/components/finance/wallet-carousel.tsx`

"Drag to reorder" is a desktop mouse interaction that doesn't apply to mobile touch. Replace with touch-appropriate language.

- [ ] **Step 1: Update hint text (line ~320)**

Change:
```tsx
Wallet {currentIndex + 1} of {wallets.length} • Drag to reorder • Double-click to set as main
```
To:
```tsx
Wallet {currentIndex + 1} of {wallets.length} • Long press to reorder • Double-tap to set as main
```

Also update the `title` attribute on the wallet dot element (line ~306):
Change:
```tsx
title={`${wallet.name} - Click to select, double-click to set as main, drag to reorder`}
```
To:
```tsx
title={`${wallet.name} - Tap to select, double-tap to set as main`}
```

- [ ] **Step 2: Verify with Playwright**

Navigate to `https://finance.umeh.me/`. Confirm the hint text reads "Long press to reorder • Double-tap to set as main".

- [ ] **Step 3: Commit**

```bash
git add client/src/components/finance/wallet-carousel.tsx
git commit -m "fix: update wallet carousel hint text to use mobile touch language"
```

---

## Task 9: Fix app name consistency

**Files:**
- Modify: `docker-compose.yml`

`docker-compose.yml` sets `VITE_APP_NAME=Finance App` but the HTML `<title>` is "Finance Tracker". Align both to "Finance Tracker".

- [ ] **Step 1: Update both frontend service env vars in docker-compose.yml**

Find both occurrences of:
```yaml
- VITE_APP_NAME=Finance App
```
And change both to:
```yaml
- VITE_APP_NAME=Finance Tracker
```
(There are two — one in the dev frontend service, one in the prod frontend service.)

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "fix: align VITE_APP_NAME to Finance Tracker to match page title"
```

---

## Deployment

After all tasks are committed locally, rebuild and push to VPS:

```bash
# On VPS (43.133.234.230)
cd /path/to/finance-app
git pull
docker compose up -d --build frontend-prod
```

Then verify on `https://finance.umeh.me/` with Playwright at 390×844 viewport.
