# Profile page, wallet icon and colour, Face ID app lock: design

Date: 2026-10-11. Status: approved in brainstorming, pending spec review.

## Goal

1. Show the greeting, avatar and theme toggle only on Home; other pages start with their own title.
2. Replace Settings with a **Profile** page modelled on the Stitch "Profile & Settings" screen (`docs/design/stitch/profile-settings.png`), limited to features that exist.
3. Let the user upload a profile photo.
4. Give wallets a choosable icon, and make the wallet colour visible: a filled icon tile.
5. Fix Face ID by turning it into an **app lock**.

## Root cause of the Face ID bug

- The Face ID button lives on the sign-in page, which is only reachable without a valid session.
- `biometricLogin` only re-reads an existing cookie session (`/api/users/me`). The WebAuthn check is local and the server never sees it.
- So on the sign-in page there is never a session to unlock, and it always fails with "Your session has expired". Sessions disappear because without "Remember me" the refresh cookie is a session cookie (iOS closes standalone apps often), and because of logout.
- The fix is an app lock over a long-lived session, not sign-in.

## Decisions

| Topic | Decision |
|---|---|
| Header | `AppHeader` (greeting, avatar, theme toggle) renders only on `/` |
| Settings | Becomes Profile at `/profile`; nav tab "Profile" (person icon); `/settings` → `/profile` |
| Profile content | Profile card, stats row, Appearance, Face ID lock, Change password, Shortcut token, Sign out, version line. Nothing else from the mockup |
| Photo storage | In the database, client-resized to 256×256 JPEG |
| Wallet look | Icon tile filled with the wallet colour, white icon; curated wallet icon set |
| Face ID | App lock; sessions always "remember me" (30 days); the inactivity logout is removed |

## Layout and Profile page

- **`components/app-layout.tsx`** renders `<AppHeader />` only when `useLocation().pathname === '/'`.
- **`AppHeader`**:
  - greeting and name, as today
  - an avatar that shows the photo (falling back to initials) and is a link to `/profile`, with no dropdown
  - the theme toggle
- **`app-footer.tsx`:** the last tab is `{ to: '/profile', label: 'Profile', icon: UserRound }`.
- **`Router.tsx`:**
  - `profile` → `<Profile />`
  - `settings` → `<Navigate to="/profile" replace />`
- **`pages/Profile.tsx`** replaces `pages/Settings.tsx`. From top to bottom:
  1. `PageTitle` with eyebrow "Account" and title "Profile".
  2. **Profile card:**
     - the avatar (88 px) with a camera badge; tapping it opens a file input `accept="image/*"`
     - name, email, and "Member since <Mon YYYY>" (from `user.createdAt`)
     - an **Edit profile** pill that opens a sheet with the existing name form (`PATCH /api/users/me`)
     - a **Remove photo** text button when a photo exists
  3. **Stats row** (three columns): "<n> wallets"; currencies ("KRW · IDR"); main wallets ("Toss · Main Pocket", the main wallet of each currency in KRW, IDR order).
  4. **Preferences:** Appearance with a Light / Dark / System segmented control (the existing theme context).
  5. **Security:**
     - Face ID lock: a switch with the subtitle "Require Face ID when opening the app". It's hidden when `biometricSupported` is false.
     - Change password: a row with chevron opening a sheet with the existing password form.
     - Shortcut token: a row with chevron opening a sheet with the existing `ApiTokenSettings`.
  6. **Sign out:** a full-width pill that calls `logout()`.
  7. **Version line:** "Finance Tracker" plus the build version (`import.meta.env.VITE_APP_VERSION` if set, else omitted).

## Profile photo

**Backend:**
- Migration: a new table `user_avatars` (`UserAvatar { userId @id, image Bytes, mimeType, updatedAt }`, cascade on user delete), plus `User.avatarUpdatedAt DateTime?`.
- The bytes live outside `users` because `deserializeUser` reloads the `users` row on every request; they are never loaded except by the avatar endpoints.
- `PUT /api/users/me/avatar` (session auth):
  - Body `{ image: base64 string, mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }`. The decoded size must be ≤ 200 KB, else 400 "Image is too large"; the base64 format is validated like the photo-capture schema.
  - It upserts the `user_avatars` row, sets `avatarUpdatedAt = now` and returns `{ user }`. No session refresh is needed: the user is reloaded per request.
  - It gets its own body parser limit (`express.json({ limit: '300kb' })`) mounted before the global 10 KB one.
- `GET /api/users/me/avatar` (session auth):
  - Returns the bytes with `Content-Type: image/jpeg` and `Cache-Control: private, max-age=31536000, immutable`.
  - 404 when there is no photo.
- `DELETE /api/users/me/avatar` → 204; deletes the row and clears `avatarUpdatedAt`.
- `/me` (and the session user) carries `avatarUpdatedAt`. The client builds `avatarUrl = /api/users/me/avatar?v=<avatarUpdatedAt ms>` when it is set.

**Client:**
- `lib/image.ts` gets `squareAvatar(file): Promise<{ image, mimeType }>`. It decodes through `<img>` (as `downscaleImage` does), centre-crops to a square, draws at 256×256 and encodes JPEG at 0.85 quality.
- The upload uses `PUT /api/users/me/avatar`, then `refreshUser()`. Errors show as a toast ("Couldn't update your photo").
- An `Avatar` component (`components/user-avatar.tsx`) shows the image when `avatarUrl` is set, and initials otherwise. It's used by `AppHeader` and the Profile card.

## Wallet icon and colour

- **Backend:**
  - migration `Wallet.icon String?`
  - the wallet create and update schemas accept `icon` (same kebab-case regex as category icons, nullable)
  - the controllers pass it through
- **Client:**
  - `components/finance/wallet-icon.tsx` exports `WALLET_ICONS`:
    - `wallet` (default), `landmark`, `credit-card`, `piggy-bank`, `banknote`, `smartphone`
    - `coins`, `briefcase`, `plane`, `house`, `gift`, `shield`
  - It also exports `WalletTile({ icon, color, size })`: a rounded tile with `backgroundColor: color` and a white icon (default `wallet`).
  - The wallet form gets an Icon picker. It reuses `IconPicker`, generalised to take an `icons` map prop; the category form passes `CATEGORY_ICONS`.
  - The tile is used by `wallet-cards.tsx` (Home and Transactions) and `pages/Wallets.tsx`, replacing today's faint tinted tile.
- Existing wallets keep their stored colour (blue for the imported ones) until edited.

## Face ID app lock

- **Sessions:**
  - The sign-in form's "Remember me" checkbox is removed, and `login` always sends `rememberMe: true` (the backend already defaults to true).
  - The 30-minute inactivity check in `auth.context.tsx` (`isSessionExpired(30)` interval and activity listeners) is removed.
  - `remember_me` storage handling is removed.
- **Lock state** (`contexts/app-lock.tsx`, inside `AuthProvider`):
  - `locked` is true at start when `user && biometricService.isEnabled()`.
  - On `visibilitychange` to hidden, it records the time. On visible, it locks if more than 60 seconds have passed and the lock is enabled.
  - `unlock()` calls `biometricService.authenticate()`; success clears `locked`.
  - `usePassword()` calls `logout()`.
- **Lock screen** (`components/lock-screen.tsx`):
  - It covers the whole viewport (above the app, below nothing) and shows the app logo and "Unlock with Face ID".
  - It calls `unlock()` automatically once on show, and has a "Try again" button and a "Use password instead" link.
  - While locked, app content is not rendered (not just covered), so screen readers and screenshots don't expose it.
- **Toggle:** on calls `enableBiometric()` (registers once); off calls `disableBiometric()`.
- **Sign-in page:** the Face ID button and `biometricLogin` are removed.

## Testing

**Backend integration** (`backend/tests/profile.int.ts`):
- Avatar:
  - Upload, then GET returns the same bytes with `image/jpeg`.
  - `/me` has `avatarUpdatedAt` and no `avatar` field.
  - DELETE, then GET gives 404.
  - Over 200 KB gives 400, a bad mime type gives 400, and no session gives 401.
- Wallet icon: create and update with an icon; a malformed icon gives 400; `null` clears it.

**Vitest:**
- The `AppHeader` greeting renders only on `/` (render the layout under `MemoryRouter` at `/` and at `/wallets`).
- `squareAvatar` returns a JPEG string. Canvas is mocked: check that the draw call crops the centre square.
- App lock, with `biometricService` mocked:
  - It's locked on start when enabled, and content is hidden.
  - A successful unlock shows the content; a failure stays locked and "Try again" is visible.
  - Hidden for more than 60 s, then visible: it locks again. Under 60 s it doesn't.
  - "Use password instead" calls logout.
- `WalletTile` uses the colour as its background and falls back to the default icon.

**Playwright** (`client/e2e/profile.e2e.ts`; also update `settings.e2e.ts` G1–G6 to the new page):
- P1: `/settings` redirects to `/profile`; the profile card shows name, email and "Member since".
- P2: uploading a photo shows it on Profile and as Home's avatar (`img` src contains `/api/users/me/avatar`).
- P3: Edit profile, Change password and Shortcut token sheets open, and saving the name updates the card.
- P4: `/transactions` and `/wallets` show no greeting and no theme toggle; Home shows both.
- P5: setting a wallet icon and colour shows a tile with that background colour and a white icon on its card.
- P6: Sign out from Profile lands on `/login`.

## Out of scope

- Passkey sign-in (server-side WebAuthn).
- The mockup's Pro plan, QR code, default currency, number formatting, passcode, export, linked accounts, notifications and help.
- Cropping UI for the photo (centre crop only).
- Recolouring existing wallets automatically.
