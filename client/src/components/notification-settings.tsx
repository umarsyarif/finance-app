import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import axios from '@/lib/axios';
import { PillButton } from '@/components/page-header';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { BLOCKED, pushStatus, subscribePush, unsubscribePush, type PushStatus } from '@/services/push.service';

interface Settings {
  nudgeEnabled: boolean;
  nudgeTime: string;
  timezone: string;
  shortcutEnabled: boolean;
  monthlySummaryEnabled: boolean;
}

const apiMessage = (err: unknown) => (isAxiosError(err) ? err.response?.data?.message : undefined);

function ToggleRow({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>
        <span className="block text-[15px] font-semibold">{title}</span>
        {subtitle && <span className="block text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      {children}
    </div>
  );
}

export function NotificationSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [time, setTime] = useState('');
  const [push, setPush] = useState<PushStatus | null>(null);
  const [pushError, setPushError] = useState('');

  const save = async (patch: Partial<Settings>) => {
    try {
      const { data } = await axios.put('/api/notifications/settings', patch);
      setSettings(data.data.settings);
      setTime(data.data.settings.nudgeTime);
    } catch (err) {
      toast.error(apiMessage(err) ?? "Couldn't save");
    }
  };

  useEffect(() => {
    pushStatus().then(setPush).catch(() => setPush('unsupported'));
    axios.get('/api/notifications/settings').then(({ data }) => {
      const s: Settings = data.data.settings;
      setSettings(s);
      setTime(s.nudgeTime);
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (zone && zone !== s.timezone) save({ timezone: zone });
    }).catch(() => {});
  }, []);

  const enablePush = async () => {
    setPushError('');
    try {
      await subscribePush();
      setPush('on');
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Couldn't enable push");
    }
  };

  const disablePush = async () => {
    await unsubscribePush();
    setPush('off');
  };

  return (
    <section aria-label="Notifications" className="space-y-4 rounded-[24px] bg-card p-5 shadow-resting">
      <ToggleRow title="Push on this device">
        {push === 'on' && <Switch aria-label="Push on this device" checked onCheckedChange={disablePush} />}
        {push === 'off' && <PillButton onClick={enablePush}>Enable push</PillButton>}
      </ToggleRow>
      {push === 'needs-install' && <p className="text-xs text-muted-foreground">Add to Home Screen to get push</p>}
      {push === 'denied' && <p className="text-xs text-muted-foreground">{BLOCKED}</p>}
      {push === 'unsupported' && <p className="text-xs text-muted-foreground">This browser can't receive push</p>}
      {pushError && <p role="alert" className="text-xs text-destructive">{pushError}</p>}

      {settings && (
        <>
          <ToggleRow title="Daily reminder" subtitle="Nudge if nothing is logged today">
            <Switch aria-label="Daily reminder" checked={settings.nudgeEnabled} onCheckedChange={(v) => save({ nudgeEnabled: v })} />
          </ToggleRow>
          {settings.nudgeEnabled && (
            <Input
              type="time"
              aria-label="Reminder time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              onBlur={() => time && time !== settings.nudgeTime && save({ nudgeTime: time })}
            />
          )}
          <ToggleRow title="Shortcut saves" subtitle="Tell me when the Shortcut records a transaction">
            <Switch aria-label="Shortcut saves" checked={settings.shortcutEnabled} onCheckedChange={(v) => save({ shortcutEnabled: v })} />
          </ToggleRow>
          <ToggleRow title="Monthly summary" subtitle="A recap at the start of each month">
            <Switch aria-label="Monthly summary" checked={settings.monthlySummaryEnabled} onCheckedChange={(v) => save({ monthlySummaryEnabled: v })} />
          </ToggleRow>
        </>
      )}
    </section>
  );
}
