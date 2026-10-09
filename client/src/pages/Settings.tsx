import { useState } from 'react';
import { BiometricSettings } from '@/components/biometric-settings';
import { ApiTokenSettings } from '@/components/api-token-settings';
import { PageTitle } from '@/components/page-header';
import { FilterChips } from '@/components/finance/filter-chips';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth.context';
import { toast } from 'sonner';
import axios from '@/lib/axios';
import { AxiosError } from 'axios';

import { useTheme } from '@/contexts/theme.context';

const apiMessage = (err: unknown) => (err instanceof AxiosError ? err.response?.data?.message : undefined);

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [section, setSection] = useState<'profile' | 'security' | 'appearance'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    newPasswordConfirm: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await axios.patch('/api/users/me', profileData);
      await refreshUser();
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(apiMessage(err) || 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);

    try {
      await axios.post('/api/users/me/password', passwordData);
      setPasswordData({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
      toast.success('Password changed. Other devices have been signed out.');
    } catch (err) {
      toast.error(apiMessage(err) || 'Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handlePasswordInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const field = 'h-[52px] rounded-[20px] bg-card px-[18px]';
  const themeLabel = { light: 'Light', dark: 'Dark', system: 'System' } as const;

  return (
    <>
      <PageTitle title="Settings" />

      <FilterChips
        label="Settings section"
        className="mb-6"
        value={section}
        onChange={setSection}
        options={[
          { value: 'profile', label: 'Profile' },
          { value: 'security', label: 'Security' },
          { value: 'appearance', label: 'Appearance' },
        ]}
      />

      {section === 'profile' && (
        <section className="space-y-5 rounded-[24px] bg-card p-5 shadow-resting">
          <h2 className="text-[19px] font-bold">Profile</h2>
          <form onSubmit={handleProfileUpdate} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" name="name" value={profileData.name} onChange={handleChange} placeholder="Your name" className={field} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" name="email" type="email" value={profileData.email} onChange={handleChange} placeholder="you@example.com" className={field} />
            </div>
            <Button type="submit" disabled={isLoading} className="h-[52px] w-full rounded-full text-[15px]">
              {isLoading ? 'Saving…' : 'Update Profile'}
            </Button>
          </form>
        </section>
      )}

      {section === 'security' && (
        <div className="space-y-4">
          <section className="space-y-5 rounded-[24px] bg-card p-5 shadow-resting">
            <div>
              <h2 className="text-[19px] font-bold">Password</h2>
              <p className="text-sm text-muted-foreground">Changing it signs out your other devices.</p>
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" value={passwordData.currentPassword} onChange={handlePasswordInput} required className={field} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" name="newPassword" type="password" autoComplete="new-password" value={passwordData.newPassword} onChange={handlePasswordInput} minLength={8} required className={field} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input id="confirm-password" name="newPasswordConfirm" type="password" autoComplete="new-password" value={passwordData.newPasswordConfirm} onChange={handlePasswordInput} required className={field} />
              </div>
              <Button type="submit" disabled={isChangingPassword} className="h-[52px] w-full rounded-full text-[15px]">
                {isChangingPassword ? 'Changing…' : 'Change Password'}
              </Button>
            </form>
          </section>
          <BiometricSettings />
          <ApiTokenSettings />
        </div>
      )}

      {section === 'appearance' && (
        <section className="space-y-4 rounded-[24px] bg-card p-5 shadow-resting">
          <div>
            <h2 className="text-[19px] font-bold">Theme</h2>
            <p className="text-sm text-muted-foreground">System follows your phone's setting.</p>
          </div>
          <FilterChips
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={(['light', 'dark', 'system'] as const).map((value) => ({ value, label: themeLabel[value] }))}
          />
        </section>
      )}
    </>
  );
}
