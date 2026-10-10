import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './auth.context';
import { biometricService } from '@/services/biometric.service';
import { LockScreen } from '@/components/lock-screen';

// Re-lock when the app comes back after this long in the background
export const AWAY_LOCK_MS = 60_000;

type AppLock = { locked: boolean; unlock: (auto?: boolean) => Promise<void>; error: string | null; pending: boolean };
const AppLockContext = createContext<AppLock | null>(null);
export const useAppLock = () => useContext(AppLockContext);

// Face ID app lock: a local gate over an existing (30-day) session. It hides the app on cold start and
// after time away. Not a server credential: it never signs anyone in. It is per-device and intentionally
// survives sign-out (single-user app); turn it off in Profile.
export function AppLockProvider({ children }: { children: ReactNode }) {
  const { user, biometricEnabled, biometricSupported, logout } = useAuth();
  // Unsupported device (Face ID/passcode turned off) never locks: it could never unlock
  const enabled = Boolean(user && biometricEnabled && biometricSupported);
  // Lock only on a cold start with the lock on; signing in or turning the lock on mid-session doesn't lock
  const [locked, setLocked] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const hiddenAt = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const unlock = useCallback(async (auto = false) => {
    // One Face ID prompt at a time: a second concurrent credentials.get would fail
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await biometricService.authenticate();
      if (result.success) setLocked(false);
      // The prompt fired on show has no user gesture: a cancel/not-allowed there isn't worth an error line
      else if (!(auto && /not allowed|cancel/i.test(result.error ?? ''))) setError(result.error ?? "Face ID didn't work");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
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

  const value = { locked: locked && enabled, unlock, error, pending };
  return (
    <AppLockContext.Provider value={value}>
      {value.locked ? <LockScreen onUnlock={unlock} onUsePassword={logout} error={error} pending={pending} /> : children}
    </AppLockContext.Provider>
  );
}
