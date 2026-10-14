import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import axios from '@/lib/axios';
import { AxiosError } from 'axios';
import { biometricService } from '@/services/biometric.service';
import { secureStorage } from '@/services/secure-storage.service';
import { unsubscribePush } from '@/services/push.service';
import { clearOfflineStorage } from '@/hooks/use-offline';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  avatarUpdatedAt: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  biometricEnabled: boolean;
  biometricSupported: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, passwordConfirm: string) => Promise<void>;
  logout: () => Promise<void>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);

  // Initialize auth only once on mount
  useEffect(() => {
    const initializeAuth = async () => {
      // Check biometric support
      const supported = await biometricService.isSupported();
      setBiometricSupported(supported);
      setBiometricEnabled(biometricService.isEnabled());

      // Check for existing cookie session
      try {
        const response = await axios.get('/api/users/me');
        setUser(response.data.data.user);
      } catch {
        setUser(null);
      }
      setLoading(false);
    };

    initializeAuth();
  }, []); // Empty dependency array - run only once on mount

  if (loading) {
    return (
      <div role="status" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="size-8 animate-spin text-lime" aria-hidden="true" />
        <span className="text-sm font-medium text-muted-foreground">Loading your wallet…</span>
      </div>
    );
  }

  const login = async (email: string, password: string) => {
    try {
      // Sessions are always remembered (30-day refresh cookie); the Face ID lock guards the device
      await axios.post('/api/auth/login', { email, password, rememberMe: true });
      const userResponse = await axios.get('/api/users/me');
      setUser(userResponse.data.data.user);
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.message || 'Login failed');
      }
      throw new Error('An unexpected error occurred');
    }
  };
  
  const register = async (name: string, email: string, password: string, passwordConfirm: string) => {
    try {
      // Registration signs the user in (email verification is disabled)
      await axios.post('/api/auth/register', { name, email, password, passwordConfirm });
      const userResponse = await axios.get('/api/users/me');
      setUser(userResponse.data.data.user);
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.message || 'Registration failed');
      }
      throw new Error('An unexpected error occurred');
    }
  };
  
  const logout = async () => {
    try {
      await unsubscribePush(); // needs the session cookie, so before logout
      await axios.get('/api/auth/logout');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      secureStorage.clear();
      clearOfflineStorage();
      setUser(null);
    }
  };

  const enableBiometric = async (): Promise<boolean> => {
    if (!user || !biometricSupported) {
      return false;
    }

    try {
      const success = await biometricService.register(user.id, user.name);
      setBiometricEnabled(success);
      return success;
    } catch (error) {
      console.error('Failed to enable biometric authentication:', error);
      return false;
    }
  };

  const disableBiometric = (): void => {
    biometricService.disable();
    setBiometricEnabled(false);
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const response = await axios.get('/api/users/me');
      setUser(response.data.data.user);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        biometricEnabled,
        biometricSupported,
        login,
        register,
        logout,
        enableBiometric,
        disableBiometric,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}