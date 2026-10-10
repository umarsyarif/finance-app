# Profile, Wallet Style and App Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Settings becomes a Profile page with a profile photo.
- Greeting, avatar and theme toggle show only on Home.
- Wallets get a chosen icon in a tile filled with their colour.
- Face ID becomes a working app lock.

**Architecture:**
- **Backend:**
  - The avatar lives in its own `user_avatars` table, so `deserializeUser`, which reloads the `users` row on every request, never loads image bytes. `users` gets `avatarUpdatedAt`.
  - Wallets get an `icon` column.
- **Client:**
  - `AppHeader` renders only on `/`, and Settings is rebuilt as `/profile`.
  - A shared `IconPicker` serves categories and wallets.
  - A new `AppLockProvider` hides the app until local biometric success. Sessions are always the 30-day "remember me" kind.

**Tech Stack:**
- Backend: Express, Prisma 5, Zod, Jest + Supertest.
- Client: React 18, Vite, Tailwind, lucide-react, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-profile-wallet-style-app-lock-design.md`. One deviation, applied to the spec: the avatar bytes live in `user_avatars`, not on `users`.

## Global Constraints

- **Branch:** work in a git worktree on `feat/profile-lock`, created from `main` (the controller sets it up).
  - Commit after each task, with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.
  - Stage only the files the task names.
- Schema changes need a migration (`npx prisma migrate dev --name <name>`).
- **Avatar API** (all session-auth):
  - `PUT /api/users/me/avatar` takes `{ image, mimeType }`. `mimeType` is one of `image/jpeg`, `image/png`, `image/webp`; the decoded image must be ≤ 200 KB, else 400 "Image is too large".
  - `GET /api/users/me/avatar` returns the bytes, or 404.
  - `DELETE /api/users/me/avatar` returns 204.
- The client builds the avatar URL as `/api/users/me/avatar?v=<avatarUpdatedAt epoch ms>`.
- **Wallet icon names** (Lucide kebab-case, stored as strings): `wallet` (default), `landmark`, `credit-card`, `piggy-bank`, `banknote`, `smartphone`, `coins`, `briefcase`, `plane`, `house`, `gift`, `shield`.
- **Lock:** re-locks after **60 seconds** hidden. Copy:
  - "Unlock with Face ID"
  - "Try again"
  - "Use password instead"
  - "Face ID lock"
  - "Require Face ID when opening the app"
- **Profile copy:**
  - "Account" (eyebrow), "Profile" (title)
  - "Member since <Mon YYYY>"
  - "Edit profile", "Change password", "Shortcut token", "Sign out", "Remove photo"
  - nav tab "Profile"
- Do not hand-edit `client/src/components/ui/`. Never call real Gemini.
- Run suites one after another. Integration tests and Playwright need `make infra` (already running).

## Review Focus

1. **Photo too big or wrong type.** A photo over 200 KB after resizing, or a HEIC that the browser can't decode, should show a toast ("Couldn't update your photo") and leave the old photo in place (Task 3 test).
2. **Toggling the lock on or off mid-session.** Turning Face ID lock on in Profile must not lock the screen immediately, and turning it off while locked is impossible (Task 5 test).
3. **Signing in fresh.** After a password sign-in, the app must not immediately show the lock screen, even with the lock enabled (Task 5 test).
4. **The header on deep pages.** Pages under `/` other than Home (`/transactions`, `/wallets`, `/profile`, 404) show no greeting, avatar or theme toggle (Task 2 test).
5. **Another user's avatar.** `GET /api/users/me/avatar` only ever returns the session user's own photo. A user without one gets 404 even when another user has a photo (Task 1 test).

---

### Task 1: Backend – avatar storage and wallet icon

**Files:**
- Modify: `backend/prisma/schema.prisma`, and create a migration
- Modify: `backend/src/services/user.service.ts` (`excludedFields` stays; add avatar helpers)
- Create: `backend/src/schemas/avatar.schema.ts`
- Modify: `backend/src/controllers/user.controller.ts`, `backend/src/routes/user.routes.ts`
- Modify: `backend/src/app.ts` (body parser for the avatar route)
- Modify: `backend/src/schemas/wallet.schema.ts`, `backend/src/controllers/wallet.controller.ts`
- Test: `backend/tests/profile.int.ts`

**Interfaces:**
- Produces:
  - `User.avatarUpdatedAt: DateTime?`, which appears in `/api/users/me` because it isn't excluded
  - the model `UserAvatar { userId @id, image Bytes, mimeType String, updatedAt }`, mapped to `user_avatars`
  - `Wallet.icon: String?`
  - the avatar endpoints from the Global Constraints

- [ ] **Step 1: Write the failing test.** Create `backend/tests/profile.int.ts`:

```ts
/**
 * Integration scenarios for the profile photo and wallet icon.
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
  const email = `profile-${tag}-${run}@example.test`;
  emails.push(email);
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: tag, email, password: 'password123', passwordConfirm: 'password123' });
  expect(res.status).toBe(201);
  return agent;
}

// A real 1x1 JPEG
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

beforeAll(async () => {
  await ready;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.userAvatar.deleteMany({ where: { userId: { in: ids } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await Promise.all(ids.map((id) => deleteAllSessions(id)));
  await prisma.$disconnect();
  await redisClient.quit();
});

describe('profile photo', () => {
  it('uploads, serves, appears as avatarUpdatedAt on /me, and deletes', async () => {
    const u = await newUser('photo');
    const put = await u.put('/api/users/me/avatar').send({ image: JPEG.toString('base64'), mimeType: 'image/jpeg' });
    expect(put.status).toBe(200);

    const me = (await u.get('/api/users/me')).body.data.user;
    expect(me.avatarUpdatedAt).toBeTruthy();
    expect(me.avatar).toBeUndefined();

    const got = await u.get('/api/users/me/avatar').buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(got.status).toBe(200);
    expect(got.headers['content-type']).toMatch(/image\/jpeg/);
    expect(Buffer.compare(got.body as Buffer, JPEG)).toBe(0);

    expect((await u.delete('/api/users/me/avatar')).status).toBe(204);
    expect((await u.get('/api/users/me/avatar')).status).toBe(404);
    expect((await u.get('/api/users/me')).body.data.user.avatarUpdatedAt).toBeNull();
  });

  it('rejects oversized images and other mime types, and needs a session', async () => {
    const u = await newUser('limits');
    const big = Buffer.alloc(201 * 1024, 1).toString('base64');
    const tooBig = await u.put('/api/users/me/avatar').send({ image: big, mimeType: 'image/jpeg' });
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.message).toContain('Image is too large');
    expect((await u.put('/api/users/me/avatar').send({ image: JPEG.toString('base64'), mimeType: 'image/gif' })).status).toBe(400);
    expect((await request(app).get('/api/users/me/avatar')).status).toBe(401);
  });

  it("never serves another user's photo", async () => {
    const a = await newUser('owner');
    await a.put('/api/users/me/avatar').send({ image: JPEG.toString('base64'), mimeType: 'image/jpeg' });
    const b = await newUser('other');
    expect((await b.get('/api/users/me/avatar')).status).toBe(404);
  });
});

describe('wallet icon', () => {
  it('is saved, changed, cleared, and validated', async () => {
    const u = await newUser('wallet');
    const created = await u.post('/api/wallets').send({ name: 'Bank', currency: 'KRW', balance: 0, icon: 'landmark' });
    expect(created.status).toBe(201);
    expect(created.body.data.wallet.icon).toBe('landmark');
    const id = created.body.data.wallet.id;
    expect((await u.patch(`/api/wallets/${id}`).send({ icon: 'piggy-bank' })).body.data.wallet.icon).toBe('piggy-bank');
    expect((await u.patch(`/api/wallets/${id}`).send({ icon: null })).body.data.wallet.icon).toBeNull();
    expect((await u.patch(`/api/wallets/${id}`).send({ icon: '<x>' })).status).toBe(400);
  });
});
```

If that JPEG constant doesn't decode, any real small JPEG works. The test only compares bytes, and the server doesn't decode images.

- [ ] **Step 2: Run it and confirm it fails.**
Run: `cd backend && npx jest --testMatch '**/profile.int.ts' --runInBand --forceExit`
Expected: FAIL (404 on the routes; no `userAvatar` model).

- [ ] **Step 3: Update the schema and migrate.** In `backend/prisma/schema.prisma`:
  - `model User`: add `avatarUpdatedAt DateTime?` and `avatar UserAvatar?`.
  - Add the model:
    ```prisma
    // Profile photo kept out of `users` (deserializeUser loads that row on every request)
    model UserAvatar {
      userId    String   @id
      image     Bytes
      mimeType  String
      updatedAt DateTime @updatedAt

      user User @relation(fields: [userId], references: [id], onDelete: Cascade)

      @@map("user_avatars")
    }
    ```
  - `model Wallet`: add `icon String? // Lucide icon name; the client falls back to "wallet"`.

  Then run `cd backend && npx prisma migrate dev --name profile_avatar_wallet_icon`.

- [ ] **Step 4: Add the avatar schema, service, controller, routes and parser.**

`backend/src/schemas/avatar.schema.ts`:

```ts
import { object, string, z, TypeOf } from 'zod';

export const MAX_AVATAR_BYTES = 200 * 1024;

export const putAvatarSchema = object({
  body: object({
    image: string({ required_error: 'Image is required' })
      .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Image must be base64')
      .refine((b64) => Math.floor((b64.length * 3) / 4) <= MAX_AVATAR_BYTES, 'Image is too large'),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  }),
});

export type PutAvatarInput = TypeOf<typeof putAvatarSchema>['body'];
```

In `backend/src/services/user.service.ts`, add:

```ts
export const saveAvatar = (userId: string, image: Buffer, mimeType: string) =>
  prisma.$transaction(async (tx) => {
    await tx.userAvatar.upsert({ where: { userId }, create: { userId, image, mimeType }, update: { image, mimeType } });
    return tx.user.update({ where: { id: userId }, data: { avatarUpdatedAt: new Date() } });
  });

export const findAvatar = (userId: string) => prisma.userAvatar.findUnique({ where: { userId } });

export const removeAvatar = (userId: string) =>
  prisma.$transaction([
    prisma.userAvatar.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { avatarUpdatedAt: null } }),
  ]);
```

(Import `prisma` as the file already does.)

In `backend/src/controllers/user.controller.ts`, add:

```ts
export const putAvatarHandler = async (req: Request<{}, {}, PutAvatarInput>, res: Response, next: NextFunction) => {
  try {
    const user = await saveAvatar(res.locals.user.id, Buffer.from(req.body.image, 'base64'), req.body.mimeType);
    res.status(200).json({ status: 'success', data: { user: omit(user, excludedFields) } });
  } catch (err) {
    next(err);
  }
};

export const getAvatarHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const avatar = await findAvatar(res.locals.user.id);
    if (!avatar) return next(new AppError(404, 'No profile photo'));
    // The URL carries ?v=<avatarUpdatedAt>, so a new photo gets a new URL
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    res.type(avatar.mimeType).send(Buffer.from(avatar.image));
  } catch (err) {
    next(err);
  }
};

export const deleteAvatarHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await removeAvatar(res.locals.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
```

Then:
- In `backend/src/routes/user.routes.ts`, add `router.put('/me/avatar', validate(putAvatarSchema), putAvatarHandler);`, `router.get('/me/avatar', getAvatarHandler);` and `router.delete('/me/avatar', deleteAvatarHandler);`.
- In `backend/src/app.ts`, next to the capture parsers and before the global `express.json({ limit: '10kb' })`, add:
  ```ts
  // Profile photo: ≤200 KB image, base64 in JSON
  app.use('/api/users/me/avatar', express.json({ limit: '300kb' }));
  ```
- Check how `app.ts` maps `entity.too.large`. If it would show a different message for this route, add `/api/users/me/avatar` with "Image is too large".

- [ ] **Step 5: Add the wallet icon.**
  - In `backend/src/schemas/wallet.schema.ts`, add `const icon = () => string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Invalid icon').max(40).nullable();`. Add `icon: icon().optional(),` to both the create and update body schemas.
  - In `backend/src/controllers/wallet.controller.ts`:
    - destructure `icon` with the other body fields in create and update
    - pass `icon` into `createWallet`
    - add `if (icon !== undefined) updateData.icon = icon;` in update

- [ ] **Step 6: Run the tests and confirm they pass.**
Run: `cd backend && npx jest --testMatch '**/profile.int.ts' --runInBand --forceExit && npx tsc --noEmit && npm test && npm run test:int`
Expected: all PASS.

- [ ] **Step 7: Commit.**

```bash
git add backend/prisma backend/src backend/tests/profile.int.ts docs/superpowers/specs/2026-10-11-profile-wallet-style-app-lock-design.md docs/superpowers/plans/2026-10-11-profile-wallet-style-app-lock.md
git commit -m "feat(api): profile photo endpoints and wallet icon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Client – Home-only header and the Profile page

**Files:**
- Create: `client/src/components/user-avatar.tsx`
- Modify: `client/src/components/app-header.tsx`, `client/src/components/app-layout.tsx`, `client/src/components/app-footer.tsx`, `client/src/Router.tsx`
- Modify: `client/src/contexts/auth.context.tsx` (the `User` type only)
- Create: `client/src/pages/Profile.tsx`
- Delete: `client/src/pages/Settings.tsx`
- Test: `client/src/test/ProfileLayout.test.tsx`

**Interfaces:**
- Consumes (Task 1): `/api/users/me` returns `createdAt` and `avatarUpdatedAt`.
- Produces:
  - `User` gains `createdAt: string; avatarUpdatedAt: string | null`.
  - `avatarUrl(user)`, which returns `string | null`.
  - `<UserAvatar user size className />`.
  - The `/profile` route with sections: `profile-card`, `stats`, `preferences`, `security`.
  - The Security section has a placeholder slot where Task 5 adds the lock switch. Until then the existing `BiometricSettings` card is rendered there.

- [ ] **Step 1: Write the failing test.** Create `client/src/test/ProfileLayout.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/app-layout';
import { avatarUrl } from '@/components/user-avatar';

vi.mock('@/contexts/auth.context', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Umar Syarif', email: 'u@x.test', createdAt: '2026-10-01T00:00:00Z', avatarUpdatedAt: null }, logout: vi.fn() }),
}));
vi.mock('@/components/finance/add-transaction-sheet', () => ({ AddTransactionSheet: () => null }));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<p>home</p>} />
          <Route path="/wallets" element={<p>wallets</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe('header placement', () => {
  it('shows greeting, avatar link and theme toggle on Home', () => {
    renderAt('/');
    expect(screen.getByText(/Good (morning|afternoon|evening)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile' , exact: false })).toHaveAttribute('href', '/profile');
  });

  it('shows none of it on other pages', () => {
    renderAt('/wallets');
    expect(screen.queryByText(/Good (morning|afternoon|evening)/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /theme/i })).not.toBeInTheDocument();
  });
});

describe('avatarUrl', () => {
  it('versions the URL by the update time, or is null', () => {
    expect(avatarUrl({ avatarUpdatedAt: null })).toBeNull();
    expect(avatarUrl({ avatarUpdatedAt: '2026-10-11T00:00:00.000Z' })).toBe(`/api/users/me/avatar?v=${Date.parse('2026-10-11T00:00:00.000Z')}`);
  });
});
```

Check `client/src/components/mode-toggle.tsx` for the toggle's accessible name and adjust the `/theme/i` query to match it. Note that the footer has a "Profile" nav link too, so on Home `getByRole('link', { name: 'Profile' })` may match two. Give the header avatar link `aria-label="Open profile"` and query that name instead.

- [ ] **Step 2: Run it and confirm it fails.**
Run: `cd client && npx vitest run src/test/ProfileLayout.test.tsx`
Expected: FAIL (`user-avatar` is missing; the header shows on every page).

- [ ] **Step 3: Implement the avatar, header, layout, nav and routes.**

`client/src/components/user-avatar.tsx`:

```tsx
import { cn } from '@/lib/utils';
import axios from '@/lib/axios';

type AvatarUser = { name?: string; avatarUpdatedAt?: string | null };

// Same-origin in production; prefixed with the API base in dev
export const avatarUrl = (user: Pick<AvatarUser, 'avatarUpdatedAt'>) =>
  user.avatarUpdatedAt ? `/api/users/me/avatar?v=${Date.parse(user.avatarUpdatedAt)}` : null;

const initials = (name = '') => name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2) || 'U';

// Profile photo, or the user's initials on lime when there is none
export function UserAvatar({ user, className }: { user: AvatarUser | null; className?: string }) {
  const src = user && avatarUrl(user);
  return (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-lime-soft text-sm font-semibold text-foreground', className)}>
      {src ? <img src={`${axios.defaults.baseURL ?? ''}${src}`} alt="" className="size-full object-cover" /> : initials(user?.name)}
    </span>
  );
}
```

Replace `client/src/components/app-header.tsx` with:

```tsx
import { Link } from 'react-router-dom';
import { ModeToggle } from './mode-toggle';
import { UserAvatar } from './user-avatar';
import { useAuth } from '@/contexts/auth.context';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Home only: avatar (to Profile), greeting, theme toggle
export function AppHeader() {
  const { user } = useAuth();
  return (
    <header className="w-full max-w-[480px] mx-auto px-6 pt-6 pb-2 flex items-center gap-3">
      <Link to="/profile" aria-label="Open profile" className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <UserAvatar user={user} className="size-11" />
      </Link>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{greeting()}</p>
        <p className="text-[19px] font-bold leading-tight truncate">{user?.name}</p>
      </div>
      <ModeToggle />
    </header>
  );
}
```

The remaining edits:
- **`app-layout.tsx`:** import `useLocation` from `react-router-dom`. Render `{pathname === '/' && <AppHeader />}` where `<AppHeader />` is now. On pages without a header, `<main>` gets `pt-6` so titles aren't flush with the top: `className={cn('… existing …', pathname !== '/' && 'pt-6')}`.
- **`app-footer.tsx`:** import `UserRound` instead of `Settings`. The last tab becomes `{ to: '/profile', label: 'Profile', icon: UserRound }`.
- **`Router.tsx`:**
  - replace the Settings import with `import Profile from './pages/Profile';`
  - add `<Route path="profile" element={<Profile />} />`
  - change `settings` to `<Route path="settings" element={<Navigate to="/profile" replace />} />`
- **`auth.context.tsx`:** extend `interface User` with `createdAt: string;` and `avatarUpdatedAt: string | null;`.

- [ ] **Step 4: Write the Profile page.** Create `client/src/pages/Profile.tsx`. It carries the old Settings logic, with the forms moved into sheets:

```tsx
import { useState } from 'react';
import { ChevronRight, KeyRound, LogOut, Pencil, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { ApiTokenSettings } from '@/components/api-token-settings';
import { BiometricSettings } from '@/components/biometric-settings';
import { PageTitle, PillButton } from '@/components/page-header';
import { FilterChips } from '@/components/finance/filter-chips';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/auth.context';
import { useTheme } from '@/contexts/theme.context';
import { useWallets } from '@/hooks/use-wallets';
import { currenciesOf } from '@/lib/selection';
import axios from '@/lib/axios';

const apiMessage = (err: unknown) => (err instanceof AxiosError ? err.response?.data?.message : undefined);
const field = 'h-[52px] rounded-[20px] bg-card px-[18px]';
const themeLabel = { light: 'Light', dark: 'Dark', system: 'System' } as const;
type SheetName = 'profile' | 'password' | 'token' | null;

function Row({ icon: Icon, title, subtitle, onClick }: { icon: typeof Pencil; title: string; subtitle?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-ring">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-muted"><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        {subtitle && <span className="block text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</h2>;
}

export default function Profile() {
  const { user, refreshUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { wallets } = useWallets();
  const [sheet, setSheet] = useState<SheetName>(null);
  const [profileData, setProfileData] = useState({ name: user?.name ?? '', email: user?.email ?? '' });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
  const [saving, setSaving] = useState(false);

  const mains = currenciesOf(wallets)
    .map((c) => wallets.find((w) => w.currency === c && w.isMain)?.name)
    .filter(Boolean)
    .join(' · ');
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.patch('/api/users/me', profileData);
      await refreshUser();
      toast.success('Profile updated');
      setSheet(null);
    } catch (err) {
      toast.error(apiMessage(err) || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post('/api/users/me/password', passwordData);
      setPasswordData({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
      toast.success('Password changed. Other devices have been signed out.');
      setSheet(null);
    } catch (err) {
      toast.error(apiMessage(err) || 'Failed to change password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const titles: Record<Exclude<SheetName, null>, string> = { profile: 'Edit profile', password: 'Change password', token: 'Shortcut token' };

  return (
    <>
      <PageTitle eyebrow="Account" title="Profile" />

      <div className="space-y-4">
        <section aria-label="Profile card" className="space-y-5 rounded-[24px] bg-card p-5 shadow-resting">
          <div className="flex items-center gap-4">
            <UserAvatar user={user} className="size-[88px] text-2xl" />
            <div className="min-w-0">
              <p className="truncate text-[19px] font-bold">{user?.name}</p>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              {memberSince && <p className="text-xs text-muted-foreground">Member since {memberSince}</p>}
            </div>
          </div>
          <PillButton className="w-full justify-center" onClick={() => setSheet('profile')}><Pencil /> Edit profile</PillButton>
        </section>

        <section aria-label="Stats" className="grid grid-cols-3 gap-3 rounded-[24px] bg-card p-5 text-center shadow-resting">
          <div><p className="text-xs text-muted-foreground">Wallets</p><p className="font-bold">{wallets.length}</p></div>
          <div><p className="text-xs text-muted-foreground">Currencies</p><p className="font-bold">{currenciesOf(wallets).join(' · ') || '—'}</p></div>
          <div className="min-w-0"><p className="text-xs text-muted-foreground">Main</p><p className="truncate font-bold">{mains || '—'}</p></div>
        </section>

        <SectionLabel>Preferences</SectionLabel>
        <section aria-label="Preferences" className="space-y-3 rounded-[24px] bg-card p-5 shadow-resting">
          <p className="text-[15px] font-semibold">Appearance</p>
          <FilterChips label="Theme" value={theme} onChange={setTheme}
            options={(['light', 'dark', 'system'] as const).map((value) => ({ value, label: themeLabel[value] }))} />
        </section>

        <SectionLabel>Security</SectionLabel>
        <section aria-label="Security" className="rounded-[24px] bg-card px-5 py-1 shadow-resting [&>*+*]:border-t [&>*+*]:border-border">
          {/* Task 5 replaces this with the Face ID lock switch */}
          <BiometricSettings />
          <Row icon={KeyRound} title="Change password" subtitle="Signs out your other devices" onClick={() => setSheet('password')} />
          <Row icon={Smartphone} title="Shortcut token" subtitle="For the iOS capture Shortcut" onClick={() => setSheet('token')} />
        </section>

        <PillButton className="w-full justify-center text-expense" onClick={logout}><LogOut /> Sign out</PillButton>
        <p className="pb-4 text-center text-xs text-muted-foreground">
          Finance Tracker{import.meta.env.VITE_APP_VERSION ? ` · v${import.meta.env.VITE_APP_VERSION}` : ''}
        </p>
      </div>

      <Sheet open={sheet !== null} onOpenChange={(open) => !open && setSheet(null)}>
        <SheetContent side="bottom" className="mx-auto max-h-[92vh] max-w-[480px] overflow-y-auto rounded-t-[28px] px-6 pb-8">
          <SheetHeader className="px-0">
            <SheetTitle className="text-[19px] font-bold">{sheet && titles[sheet]}</SheetTitle>
            <SheetDescription className="sr-only">{sheet && titles[sheet]}</SheetDescription>
          </SheetHeader>
          {sheet === 'profile' && (
            <form onSubmit={saveProfile} className="space-y-5">
              <div className="space-y-2"><Label htmlFor="name">Full Name</Label>
                <Input id="name" value={profileData.name} onChange={(e) => setProfileData((p) => ({ ...p, name: e.target.value }))} className={field} /></div>
              <div className="space-y-2"><Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" value={profileData.email} onChange={(e) => setProfileData((p) => ({ ...p, email: e.target.value }))} className={field} /></div>
              <Button type="submit" disabled={saving} className="h-[52px] w-full rounded-full text-[15px]">{saving ? 'Saving…' : 'Save'}</Button>
            </form>
          )}
          {sheet === 'password' && (
            <form onSubmit={changePassword} className="space-y-5">
              {([['current-password', 'currentPassword', 'Current Password', 'current-password'],
                ['new-password', 'newPassword', 'New Password', 'new-password'],
                ['confirm-password', 'newPasswordConfirm', 'Confirm New Password', 'new-password']] as const).map(([id, name, label, auto]) => (
                <div key={id} className="space-y-2"><Label htmlFor={id}>{label}</Label>
                  <Input id={id} name={name} type="password" autoComplete={auto} required minLength={name === 'newPassword' ? 8 : undefined}
                    value={passwordData[name]} onChange={(e) => setPasswordData((p) => ({ ...p, [name]: e.target.value }))} className={field} /></div>
              ))}
              <Button type="submit" disabled={saving} className="h-[52px] w-full rounded-full text-[15px]">{saving ? 'Changing…' : 'Change Password'}</Button>
            </form>
          )}
          {sheet === 'token' && <ApiTokenSettings />}
        </SheetContent>
      </Sheet>
    </>
  );
}
```

Delete `client/src/pages/Settings.tsx`. Check `useWallets()` returns `isMain` and `currency` (it does) and that `PillButton` accepts `className` (it does).

- [ ] **Step 5: Run the tests and confirm they pass.**
Run: `cd client && npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npm run lint 2>&1 | tail -3`
Expected: PASS, with no new lint errors in the touched files (about 64 pre-existing errors elsewhere).

- [ ] **Step 6: Commit.**

```bash
git add client/src/components/user-avatar.tsx client/src/components/app-header.tsx client/src/components/app-layout.tsx client/src/components/app-footer.tsx client/src/Router.tsx client/src/contexts/auth.context.tsx client/src/pages/Profile.tsx client/src/test/ProfileLayout.test.tsx
git rm client/src/pages/Settings.tsx
git commit -m "feat(client): Profile page; greeting, avatar and theme toggle only on Home

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Client – profile photo upload

**Files:**
- Modify: `client/src/lib/image.ts` (add `squareAvatar`)
- Modify: `client/src/pages/Profile.tsx` (the avatar becomes an upload button, plus "Remove photo")
- Test: `client/src/test/squareAvatar.test.ts`, `client/src/test/ProfileAvatar.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 1: `PUT` and `DELETE /api/users/me/avatar`
  - from Task 2: `UserAvatar`, `refreshUser`, and the Profile card
- Produces: `squareAvatar(file: File): Promise<{ image: string; mimeType: 'image/jpeg' }>`, where `image` is base64 without the `data:` prefix.

- [ ] **Step 1: Write the failing tests.**

Read `client/src/lib/image.ts` first and follow its `<img>` decode and canvas approach, and the way `client/src/test/` tests already mock canvas or `Image` for `downscaleImage` (if they do).

`client/src/test/squareAvatar.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { squareAvatar } from '@/lib/image';

const drawImage = vi.fn();
beforeEach(() => {
  drawImage.mockClear();
  // 400x300 source image
  vi.stubGlobal('Image', class {
    width = 400; height = 300; naturalWidth = 400; naturalHeight = 300;
    onload: (() => void) | null = null; onerror: (() => void) | null = null;
    set src(_v: string) { setTimeout(() => this.onload?.()); }
    decode() { return Promise.resolve(); }
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,QUJD');
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
});

describe('squareAvatar', () => {
  it('centre-crops to a square and draws it at 256x256 as JPEG', async () => {
    const out = await squareAvatar(new File(['x'], 'p.png', { type: 'image/png' }));
    expect(out).toEqual({ image: 'QUJD', mimeType: 'image/jpeg' });
    // source crop: 300x300 starting at x=50
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 50, 0, 300, 300, 0, 0, 256, 256);
  });
});
```

Adapt the `Image` stub to however `image.ts` decodes (`onload` versus `decode()`); the asserted crop and output are what matter.

`client/src/test/ProfileAvatar.test.tsx`: render `Profile` with `useAuth` mocked (a user without `avatarUpdatedAt`, `refreshUser: vi.fn()`), `useWallets` mocked (`wallets: []`), axios mocked (`put`, `delete`, `patch`, `post`) and `squareAvatar` mocked to resolve `{ image: 'QUJD', mimeType: 'image/jpeg' }`. Assert:
1. Choosing a file in the input labelled "Change photo" calls `axios.put('/api/users/me/avatar', { image: 'QUJD', mimeType: 'image/jpeg' })`, then `refreshUser`.
2. When `squareAvatar` rejects, `toast.error` is called with "Couldn't update your photo" (mock `sonner`), and `axios.put` is not called.
3. With a user whose `avatarUpdatedAt` is set, "Remove photo" calls `axios.delete('/api/users/me/avatar')`, then `refreshUser`. Without a photo, no "Remove photo" button is rendered.

Write these three `it(...)` blocks with `@testing-library/react` (`fireEvent.change(input, { target: { files: [file] } })`) and `waitFor`.

- [ ] **Step 2: Run them and confirm they fail.**
Run: `cd client && npx vitest run src/test/squareAvatar.test.ts src/test/ProfileAvatar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.**

Append to `client/src/lib/image.ts`, reusing its decode helper (whatever loads a `File` into an `HTMLImageElement`; call it the same way `downscaleImage` does):

```ts
const AVATAR_SIZE = 256;

// Profile photo: centre square, 256x256 JPEG (a few tens of KB), base64 without the data: prefix
export async function squareAvatar(file: File): Promise<{ image: string; mimeType: 'image/jpeg' }> {
  const img = await loadImage(file); // the module's existing <img> decode helper
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  return { image: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], mimeType: 'image/jpeg' };
}
```

If `image.ts` has no standalone decode helper, extract the one inside `downscaleImage` into `loadImage(file)` and have both use it.

In `Profile.tsx`:
- Import `Camera` and `Trash2` icons, `squareAvatar`, and `useRef`.
- Replace the `<UserAvatar …/>` in the card with:
  ```tsx
  <label className="relative cursor-pointer">
    <input ref={fileInput} type="file" accept="image/*" aria-label="Change photo" className="sr-only" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
    <UserAvatar user={user} className="size-[88px] text-2xl" />
    <span aria-hidden className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-foreground text-background"><Camera className="size-4" /></span>
  </label>
  ```
- Add the handlers:
  ```tsx
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadPhoto = async (file?: File) => {
    if (!file) return;
    try {
      const payload = await squareAvatar(file);
      await axios.put('/api/users/me/avatar', payload);
      await refreshUser();
      toast.success('Photo updated');
    } catch {
      toast.error("Couldn't update your photo");
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  const removePhoto = async () => {
    try {
      await axios.delete('/api/users/me/avatar');
      await refreshUser();
    } catch {
      toast.error("Couldn't remove your photo");
    }
  };
  ```
- Below the Edit profile pill, add `{user?.avatarUpdatedAt && <button type="button" onClick={removePhoto} className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground"><Trash2 className="size-4" /> Remove photo</button>}`.

- [ ] **Step 4: Run the tests and confirm they pass.**
Run: `cd client && npx vitest run && npx tsc --noEmit -p tsconfig.app.json`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add client/src/lib/image.ts client/src/pages/Profile.tsx client/src/test/squareAvatar.test.ts client/src/test/ProfileAvatar.test.tsx
git commit -m "feat(client): upload and remove the profile photo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Client – wallet icon and colour tile

**Files:**
- Modify: `client/src/components/finance/category-icon.tsx` (`IconPicker` takes an `icons` map)
- Create: `client/src/components/finance/wallet-icon.tsx`
- Modify: `client/src/components/finance/wallet-form.tsx`, `client/src/components/finance/wallet-cards.tsx`, `client/src/pages/Wallets.tsx`, `client/src/hooks/use-wallets.ts` (type)
- Test: `client/src/test/WalletIcon.test.tsx`

**Interfaces:**
- Consumes (Task 1): `Wallet.icon`.
- Produces:
  - `WALLET_ICONS: Record<string, LucideIcon>`
  - `WalletTile({ icon, color, className })`
  - `IconPicker({ value, onChange, icons? })`, where `icons` defaults to `CATEGORY_ICONS`

- [ ] **Step 1: Write the failing test.** Create `client/src/test/WalletIcon.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WalletTile, WALLET_ICONS } from '@/components/finance/wallet-icon';
import { IconPicker } from '@/components/finance/category-icon';

describe('WalletTile', () => {
  it('fills with the wallet colour and draws an icon', () => {
    const { container } = render(<WalletTile icon="landmark" color="#EF4444" />);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile.style.backgroundColor).toBe('rgb(239, 68, 68)');
    expect(tile.querySelector('svg')).toBeInTheDocument();
  });

  it('falls back to the wallet icon for none or an unknown name', () => {
    const { container } = render(<WalletTile icon={null} color="#3B82F6" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    render(<WalletTile icon="nope" color="#3B82F6" />);
  });
});

describe('IconPicker with a custom set', () => {
  it('offers exactly the wallet icons', () => {
    const onChange = vi.fn();
    render(<IconPicker value={null} onChange={onChange} icons={WALLET_ICONS} />);
    expect(screen.getAllByRole('radio')).toHaveLength(12);
    fireEvent.click(screen.getByRole('radio', { name: 'piggy-bank' }));
    expect(onChange).toHaveBeenCalledWith('piggy-bank');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.**
Run: `cd client && npx vitest run src/test/WalletIcon.test.tsx`
Expected: FAIL (the module is missing).

- [ ] **Step 3: Implement.**

`client/src/components/finance/wallet-icon.tsx`:

```tsx
import { Banknote, Briefcase, Coins, CreditCard, Gift, House, Landmark, PiggyBank, Plane, Shield, Smartphone, Wallet, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Curated wallet icons, keyed by Lucide's kebab-case name (what the API stores)
export const WALLET_ICONS: Record<string, LucideIcon> = {
  wallet: Wallet,
  landmark: Landmark,
  'credit-card': CreditCard,
  'piggy-bank': PiggyBank,
  banknote: Banknote,
  smartphone: Smartphone,
  coins: Coins,
  briefcase: Briefcase,
  plane: Plane,
  house: House,
  gift: Gift,
  shield: Shield,
};

// Wallet tile: filled with the wallet's colour, white icon (default "wallet")
export function WalletTile({ icon, color, className }: { icon?: string | null; color: string; className?: string }) {
  const Icon = (icon && WALLET_ICONS[icon]) || Wallet;
  return (
    <span aria-hidden className={cn('flex size-12 shrink-0 items-center justify-center rounded-[14px] text-white', className)} style={{ backgroundColor: color }}>
      <Icon className="size-6" />
    </span>
  );
}
```

In `client/src/components/finance/category-icon.tsx`, change `IconPicker` to `export function IconPicker({ value, onChange, icons = CATEGORY_ICONS }: { value: string | null; onChange: (icon: string | null) => void; icons?: Record<string, LucideIcon> })` and map over `Object.entries(icons)`.

Wallet form (`wallet-form.tsx`):
- add `icon: null as string | null` to the form state (from `wallet.icon ?? null` when editing) and `icon?: string | null` to its `Wallet` interface
- render `<div className="space-y-2"><Label>Icon</Label><IconPicker value={formData.icon} onChange={(icon) => setFormData((p) => ({ ...p, icon }))} icons={WALLET_ICONS} /></div>` above the colour section
- `submitData` already spreads `formData`, so `icon` is sent

Elsewhere:
- **Type:** add `icon?: string | null;` to `Wallet` in `client/src/hooks/use-wallets.ts`.
- **`wallet-cards.tsx`:** replace the tile `<span … style={{ backgroundColor: `${wallet.color}26`, color: wallet.color }}><WalletIcon className="size-6" /></span>` with `<WalletTile icon={wallet.icon} color={wallet.color} />`. Remove the now-unused `Wallet as WalletIcon` import.
- **`pages/Wallets.tsx`:** make the same replacement in the wallets list.

- [ ] **Step 4: Run the tests and confirm they pass.**
Run: `cd client && npx vitest run && npx tsc --noEmit -p tsconfig.app.json`
Expected: PASS. `CategoryIcon.test.tsx` still passes: `IconPicker` defaults to `CATEGORY_ICONS`.

- [ ] **Step 5: Commit.**

```bash
git add client/src/components/finance/category-icon.tsx client/src/components/finance/wallet-icon.tsx client/src/components/finance/wallet-form.tsx client/src/components/finance/wallet-cards.tsx client/src/pages/Wallets.tsx client/src/hooks/use-wallets.ts client/src/test/WalletIcon.test.tsx
git commit -m "feat(client): wallet icons in a tile filled with the wallet colour

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Client – Face ID app lock and always-remembered sessions

**Files:**
- Create: `client/src/contexts/app-lock.tsx`, `client/src/components/lock-screen.tsx`
- Modify: `client/src/App.tsx` (wrap `Router` with `AppLockProvider`)
- Modify: `client/src/contexts/auth.context.tsx` (remove `biometricLogin`, remember-me and the inactivity timer; `login(email, password)` always sends `rememberMe: true`)
- Modify: `client/src/pages/Login.tsx` (remove the Remember me checkbox and the Face ID button)
- Modify: `client/src/pages/Profile.tsx` (the Face ID lock switch replaces `<BiometricSettings />`)
- Delete: `client/src/components/biometric-settings.tsx`
- Test: `client/src/test/AppLock.test.tsx`; update `client/src/test/Login.test.tsx` if it references remember-me or biometrics

**Interfaces:**
- Consumes: `useAuth()` → `user`, `biometricEnabled`, `biometricSupported`, `enableBiometric()`, `disableBiometric()`, `logout()`; `biometricService.authenticate()` → `{ success, error? }`.
- Produces:
  - `AppLockProvider` with `useAppLock()` → `{ locked, unlock: () => Promise<void>, error: string | null }`
  - `AWAY_LOCK_MS = 60_000`

- [ ] **Step 1: Write the failing test.** Create `client/src/test/AppLock.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { AppLockProvider, AWAY_LOCK_MS } from '@/contexts/app-lock';

const authenticate = vi.fn();
vi.mock('@/services/biometric.service', () => ({ biometricService: { authenticate: () => authenticate() } }));
const auth = { user: { id: 'u1' } as unknown, biometricEnabled: true, logout: vi.fn() };
vi.mock('@/contexts/auth.context', () => ({ useAuth: () => auth }));

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
};

const renderApp = () => render(<AppLockProvider><p>secret</p></AppLockProvider>);

describe('AppLockProvider', () => {
  beforeEach(() => {
    authenticate.mockReset();
    auth.biometricEnabled = true;
    auth.user = { id: 'u1' };
    vi.useRealTimers();
  });

  it('hides the app until Face ID succeeds', async () => {
    authenticate.mockResolvedValueOnce({ success: false, error: 'cancelled' }).mockResolvedValueOnce({ success: true });
    renderApp();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.getByText('Unlock with Face ID')).toBeInTheDocument();
    await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('secret');
  });

  it('does not lock when the lock is off, or when nobody is signed in', () => {
    auth.biometricEnabled = false;
    renderApp();
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('re-locks after more than a minute away, not after a short switch', async () => {
    authenticate.mockResolvedValue({ success: true });
    renderApp();
    await screen.findByText('secret');
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now');

    spy.mockReturnValue(now);
    act(() => setHidden(true));
    spy.mockReturnValue(now + 10_000);
    act(() => setHidden(false));
    expect(screen.getByText('secret')).toBeInTheDocument();

    spy.mockReturnValue(now + 20_000);
    act(() => setHidden(true));
    spy.mockReturnValue(now + 20_000 + AWAY_LOCK_MS + 1);
    authenticate.mockResolvedValueOnce({ success: false });
    act(() => setHidden(false));
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    spy.mockRestore();
  });

  it('"Use password instead" signs out', async () => {
    authenticate.mockResolvedValue({ success: false });
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Use password instead' }));
    expect(auth.logout).toHaveBeenCalled();
  });
});
```

Also add a test for Review Focus #2 and #3. Render with `auth.user = null`, then rerender with a signed-in user while `biometricEnabled` is true (simulating a fresh password sign-in): the content shows without the lock. Rerendering from `biometricEnabled: false` to `true` with a user also keeps the content visible.

- [ ] **Step 2: Run it and confirm it fails.**
Run: `cd client && npx vitest run src/test/AppLock.test.tsx`
Expected: FAIL (the module is missing).

- [ ] **Step 3: Implement the lock.**

`client/src/contexts/app-lock.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './auth.context';
import { biometricService } from '@/services/biometric.service';
import { LockScreen } from '@/components/lock-screen';

// Re-lock when the app comes back after this long in the background
export const AWAY_LOCK_MS = 60_000;

type AppLock = { locked: boolean; unlock: () => Promise<void>; error: string | null };
const AppLockContext = createContext<AppLock | null>(null);
export const useAppLock = () => useContext(AppLockContext);

// Face ID app lock: a local gate over an existing (30-day) session. It hides the app on cold start and
// after time away. Not a server credential: it never signs anyone in.
export function AppLockProvider({ children }: { children: ReactNode }) {
  const { user, biometricEnabled, logout } = useAuth();
  const enabled = Boolean(user && biometricEnabled);
  // Lock only on a cold start with the lock on; signing in or turning the lock on mid-session doesn't lock
  const [locked, setLocked] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const hiddenAt = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const unlock = useCallback(async () => {
    setError(null);
    const result = await biometricService.authenticate();
    if (result.success) setLocked(false);
    else setError(result.error ?? "Face ID didn't work");
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current !== null && enabledRef.current && Date.now() - hiddenAt.current > AWAY_LOCK_MS) {
        setLocked(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // A signed-out or lock-disabled app is never locked
  useEffect(() => {
    if (!enabled) setLocked(false);
  }, [enabled]);

  const value = { locked: locked && enabled, unlock, error };
  return (
    <AppLockContext.Provider value={value}>
      {value.locked ? <LockScreen onUnlock={unlock} onUsePassword={logout} error={error} /> : children}
    </AppLockContext.Provider>
  );
}
```

`client/src/components/lock-screen.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Full-screen gate shown while the app is locked; the app itself isn't rendered behind it
export function LockScreen({ onUnlock, onUsePassword, error }: { onUnlock: () => void; onUsePassword: () => void; error: string | null }) {
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    onUnlock();
  }, [onUnlock]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <img src="/favicon.svg" alt="" className="size-16" />
      <div className="space-y-1">
        <ScanFace aria-hidden className="mx-auto size-8 text-muted-foreground" />
        <h1 className="text-[19px] font-bold">Unlock with Face ID</h1>
        {error && <p role="alert" className="text-sm text-muted-foreground">{error}</p>}
      </div>
      <Button className="h-[52px] w-full max-w-xs rounded-full text-[15px]" onClick={onUnlock}>Try again</Button>
      <button type="button" className="text-sm text-muted-foreground underline" onClick={onUsePassword}>Use password instead</button>
    </main>
  );
}
```

In `client/src/App.tsx`, wrap the router: `<AuthProvider><AppLockProvider><Router /></AppLockProvider><PWAPrompt /><Toaster … /></AuthProvider>`.

- [ ] **Step 4: Make sessions always remembered, remove the old Face ID sign-in, and add the Profile switch.**

In `client/src/contexts/auth.context.tsx`:
- **`login`:**
  - its signature becomes `login(email: string, password: string)`
  - it posts `{ email, password, rememberMe: true }`
  - remove the `remember_me` set/remove
  - update `AuthContextType.login` to match
- **`register`:** remove the `remember_me` line.
- **Inactivity timer:** delete the whole activity-tracking and `sessionCheckInterval` `useEffect`, and the `setLastActivity()` calls.
- **`biometricLogin`:** delete it, and its entry in the context type and value.

In `client/src/pages/Login.tsx`:
- remove `rememberMe` state, the checkbox block, the biometric button block and `biometricLogin`/`biometricEnabled`/`biometricSupported` from `useAuth()`
- call `login(formData.email, formData.password)`
- remove now-unused imports (`Checkbox`, fingerprint icon and others)

In `client/src/pages/Profile.tsx`, replace `<BiometricSettings />` with a switch row (and remove its import):

```tsx
{biometricSupported && (
  <div className="flex items-center gap-3 py-3">
    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-muted"><ScanFace className="size-5" /></span>
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-semibold">Face ID lock</span>
      <span className="block text-xs text-muted-foreground">Require Face ID when opening the app</span>
    </span>
    <Switch aria-label="Face ID lock" checked={biometricEnabled} onCheckedChange={toggleLock} />
  </div>
)}
```

Add the handler, with `biometricEnabled`, `biometricSupported`, `enableBiometric` and `disableBiometric` from `useAuth()`, `Switch` from `@/components/ui/switch`, and `ScanFace` from lucide:

```tsx
const toggleLock = async (on: boolean) => {
  if (!on) return disableBiometric();
  if (!(await enableBiometric())) toast.error("Couldn't turn on Face ID lock");
};
```

Delete `client/src/components/biometric-settings.tsx` (`grep -rn biometric-settings client/src` must show nothing left).

- [ ] **Step 5: Run the tests and confirm they pass.**
Run: `cd client && npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npm run lint 2>&1 | tail -3`
Expected: PASS. If `Login.test.tsx` asserted the remember-me checkbox or the biometric button, update it so it asserts the form works without them and that `login` is called with `(email, password)`.

- [ ] **Step 6: Commit.**

```bash
git add client/src/contexts/app-lock.tsx client/src/components/lock-screen.tsx client/src/App.tsx client/src/contexts/auth.context.tsx client/src/pages/Login.tsx client/src/pages/Profile.tsx client/src/test
git rm client/src/components/biometric-settings.tsx
git commit -m "feat(client): Face ID app lock over a remembered session

Face ID on the sign-in page could never work: it only re-read an existing session,
and the sign-in page is only reachable without one. It is now a local lock on open
and after a minute away; sessions always use the 30-day cookie.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: End-to-end scenarios and docs

**Files:**
- Create: `client/e2e/profile.e2e.ts`
- Modify: `client/e2e/helpers.ts` (`avatarButton`, `logOutViaUi`), `client/e2e/settings.e2e.ts`, `client/e2e/auth.e2e.ts`, `client/e2e/app.e2e.ts`, `client/e2e/capture.e2e.ts`, `client/e2e/dashboard.e2e.ts`, `client/e2e/SCENARIOS.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes the UI from Tasks 2–5:
  - the Home header link "Open profile"
  - the nav tab "Profile"
  - the Profile sections and sheets
  - the "Change photo" input and "Remove photo"
  - the wallet form's Icon picker
  - `WalletTile`
  - "Sign out"

- [ ] **Step 1: Update the helpers and existing scenarios.**
- **`helpers.ts`:**
  - `avatarButton` becomes `page.getByRole('link', { name: 'Open profile' })` (Home only).
  - `logOutViaUi` becomes `await page.goto('/profile'); await page.getByRole('button', { name: 'Sign out' }).click(); await expect(page).toHaveURL(/\/login/);`
- **`auth.e2e.ts` A10 (initials):** assert `avatarButton(page)` has text "AL" on `/` (`UserAvatar` renders the initials inside the link).
- **`app.e2e.ts`:** delete the "without Remember me, closing the browser signs you out" scenario (that behaviour is removed). Add one asserting that a new browser context reusing the stored cookies is still signed in.
- **`capture.e2e.ts`:** the token card now lives in a sheet. Replace `page.goto('/settings')` with `page.goto('/profile')`, then click `getByRole('button', { name: /Shortcut token/ })`. Keep every assertion.
- **`dashboard.e2e.ts` D10:** the nav tab is "Profile" and leads to `/profile`.
- **`settings.e2e.ts`:** rewrite G1–G5 against `/profile`:
  - G1: Edit profile is prefilled with name and email
  - G2: changing the name updates the card and Home's initials
  - G3: Change password works (the old password stops working)
  - G4: the Appearance "Dark" chip sets the `dark` class and survives a reload
  - G5: every section is visible at phone width
  - G6 (404) stays as it is

- [ ] **Step 2: Write `client/e2e/profile.e2e.ts`.** Use `signUp`, `seedWallet`, `api` and `card` from `helpers.ts`:

```ts
// Scenarios P1–P6 (see SCENARIOS.md)
import { test, expect, signUp, seedWallet, card } from './helpers';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('P1 /settings opens Profile with the profile card', async ({ page }) => {
  await signUp(page, 'p1', 'Pat Lee');
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/profile$/);
  const profileCard = page.getByRole('region', { name: 'Profile card' });
  await expect(profileCard).toContainText('Pat Lee');
  await expect(profileCard).toContainText('Member since');
});

test('P2 an uploaded photo shows on Profile and as the Home avatar', async ({ page }) => {
  await signUp(page, 'p2');
  await page.goto('/profile');
  await page.getByLabel('Change photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('region', { name: 'Profile card' }).locator('img[src*="/api/users/me/avatar"]')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Open profile' }).locator('img[src*="/api/users/me/avatar"]')).toBeVisible();
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Remove photo' }).click();
  await expect(page.getByRole('region', { name: 'Profile card' }).locator('img')).toHaveCount(0);
});

test('P3 profile sheets open and the name saves', async ({ page }) => {
  await signUp(page, 'p3', 'Old Name');
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByRole('dialog').getByLabel('Full Name').fill('New Name');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name: 'Profile card' })).toContainText('New Name');
  await page.getByRole('button', { name: /Change password/ }).click();
  await expect(page.getByRole('dialog').getByLabel('Current Password')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Shortcut token/ }).click();
  await expect(page.getByRole('dialog')).toContainText(/token/i);
});

test('P4 greeting and theme toggle appear only on Home', async ({ page }) => {
  await signUp(page, 'p4');
  await page.goto('/');
  await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible();
  for (const path of ['/transactions', '/wallets', '/profile']) {
    await page.goto(path);
    await expect(page.getByText(/Good (morning|afternoon|evening)/)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open profile' })).toHaveCount(0);
  }
});

test('P5 a wallet icon and colour show as a filled tile', async ({ page }) => {
  await signUp(page, 'p5');
  await seedWallet(page, 'KRW', 1000, 'Bank');
  await page.goto('/wallets');
  await page.getByRole('button', { name: 'Edit Bank' }).click();
  await page.getByRole('dialog').getByRole('radio', { name: 'landmark' }).click();
  await page.getByRole('dialog').locator('button[style*="rgb(239, 68, 68)"], button[style*="#EF4444"]').first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  const tile = card(page, 'Bank').locator('span[aria-hidden][style*="background-color"]').first();
  await expect(tile).toHaveCSS('background-color', 'rgb(239, 68, 68)');
  await expect(tile.locator('svg')).toBeVisible();
});

test('P6 Sign out from Profile lands on the sign-in page', async ({ page }) => {
  await signUp(page, 'p6');
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
});
```

Adapt the colour-swatch selector in P5 to the wallet form's real preset buttons: red is `#EF4444` in `COLOR_PRESETS`, and the buttons set `style.backgroundColor`. Keep the assertion on the tile's colour.

- [ ] **Step 3: Run the suites.**
Run: `cd client && npx playwright test e2e/profile.e2e.ts`, then the full `npm run test:e2e`.
Expected: all pass. Fix app bugs rather than weakening assertions, and report any you fix.

- [ ] **Step 4: Update the docs.**
- **`SCENARIOS.md`:**
  - add a "Profile (`profile.e2e.ts`)" table for P1–P6
  - update the Settings section's G rows to say Profile
  - remove the remember-me row in the app list, replacing it with the persistent-session row
  - add `profile.e2e.ts` to the Files list
- **`CLAUDE.md`:**
  - In the Overview and the Auth flow paragraph, replace the "rememberMe"/"30-min inactivity" text with: "Sign-in always issues the 30-day session (refresh cookie). Face ID is an app lock (`contexts/app-lock.tsx`): a local WebAuthn check that hides the app on open and after 60 s in the background; it never signs anyone in."
  - Update the `services/biometric.service.ts` and `contexts/auth.context.tsx` bullets the same way.
  - Under Data Model, add: "`UserAvatar` → the profile photo (bytes, ≤200 KB), kept out of `users` because `deserializeUser` loads that row on every request; `User.avatarUpdatedAt` versions `/api/users/me/avatar`". Add `icon` to the `Wallet` line.
  - In the `app-layout.tsx` bullet, change the nav to "Home, Transactions, center **+**, Wallets, Profile", and note that the greeting header renders only on Home.

- [ ] **Step 5: Commit.**

```bash
git add client/e2e CLAUDE.md
git commit -m "test(e2e): Profile scenarios P1-P6; adapt auth, settings and capture flows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
