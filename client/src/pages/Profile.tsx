import { useRef, useState } from 'react';
import { Camera, ChevronRight, KeyRound, LogOut, Pencil, ScanFace, Smartphone, Trash2, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { ApiTokenSettings } from '@/components/api-token-settings';
import { PageTitle, PillButton } from '@/components/page-header';
import { FilterChips } from '@/components/finance/filter-chips';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/auth.context';
import { useTheme } from '@/contexts/theme.context';
import { useWallets } from '@/hooks/use-wallets';
import { currenciesOf } from '@/lib/selection';
import axios from '@/lib/axios';
import { squareAvatar } from '@/lib/image';

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
  const { user, refreshUser, logout, biometricEnabled, biometricSupported, enableBiometric, disableBiometric } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { wallets } = useWallets();
  const [sheet, setSheet] = useState<SheetName>(null);
  const [profileData, setProfileData] = useState({ name: user?.name ?? '', email: user?.email ?? '' });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
  const [lockPending, setLockPending] = useState(false);
  const [saving, setSaving] = useState(false);
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
  const toggleLock = async (on: boolean) => {
    setLockPending(true);
    try {
      await applyLock(on);
    } finally {
      setLockPending(false);
    }
  };
  const applyLock = async (on: boolean) => {
    if (!on) return disableBiometric();
    if (!(await enableBiometric())) toast.error("Couldn't turn on Face ID lock");
  };
  const removePhoto = async () => {
    try {
      await axios.delete('/api/users/me/avatar');
      await refreshUser();
    } catch {
      toast.error("Couldn't remove your photo");
    }
  };

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
            <label className="relative cursor-pointer">
              <input ref={fileInput} type="file" accept="image/*" aria-label="Change photo" className="sr-only" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
              <UserAvatar user={user} className="size-[88px] text-2xl" />
              <span aria-hidden className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-foreground text-background"><Camera className="size-4" /></span>
            </label>
            <div className="min-w-0">
              <p className="truncate text-[19px] font-bold">{user?.name}</p>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              {memberSince && <p className="text-xs text-muted-foreground">Member since {memberSince}</p>}
            </div>
          </div>
          <PillButton className="w-full justify-center" onClick={() => { setProfileData({ name: user?.name ?? '', email: user?.email ?? '' }); setSheet('profile'); }}><Pencil /> Edit profile</PillButton>
          {user?.avatarUpdatedAt && <button type="button" onClick={removePhoto} className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground"><Trash2 className="size-4" /> Remove photo</button>}
        </section>

        <section aria-label="Stats" className="grid grid-cols-3 gap-3 rounded-[24px] bg-card p-5 text-center shadow-resting">
          <div><p className="text-xs text-muted-foreground">Wallets</p><p className="font-bold">{wallets.length}</p></div>
          <div><p className="text-xs text-muted-foreground">Currencies</p><p className="font-bold">{currenciesOf(wallets).join(' · ') || '—'}</p></div>
          <div className="min-w-0"><p className="text-xs text-muted-foreground">Main</p><p className="truncate font-bold">{mains || '—'}</p></div>
        </section>

        <SectionLabel>Money</SectionLabel>
        <section aria-label="Money" className="rounded-[24px] bg-card px-5 py-1 shadow-resting">
          <Row icon={Wallet} title="Wallets & categories" subtitle="Accounts, balances and categories" onClick={() => navigate('/wallets')} />
        </section>

        <SectionLabel>Preferences</SectionLabel>
        <section aria-label="Preferences" className="space-y-3 rounded-[24px] bg-card p-5 shadow-resting">
          <p className="text-[15px] font-semibold">Appearance</p>
          <FilterChips label="Theme" value={theme} onChange={setTheme}
            options={(['light', 'dark', 'system'] as const).map((value) => ({ value, label: themeLabel[value] }))} />
        </section>

        <SectionLabel>Security</SectionLabel>
        <section aria-label="Security" className="rounded-[24px] bg-card px-5 py-1 shadow-resting [&>*+*]:border-t [&>*+*]:border-border">
          {/* Shown while enabled too, so an unsupported device can still turn the lock off */}
          {(biometricSupported || biometricEnabled) && (
            <div className="flex items-center gap-3 py-3">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-muted"><ScanFace className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">Face ID lock</span>
                <span className="block text-xs text-muted-foreground">Require Face ID when opening the app</span>
              </span>
              <Switch aria-label="Face ID lock" checked={biometricEnabled} disabled={lockPending} onCheckedChange={toggleLock} />
            </div>
          )}
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
