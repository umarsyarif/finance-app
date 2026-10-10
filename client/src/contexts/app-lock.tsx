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
