import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import axios from '@/lib/axios';
import { AxiosError } from 'axios';
import { biometricService } from '@/services/biometric.service';
import { secureStorage } from '@/services/secure-storage.service';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  biometricEnabled: boolean;
  biometricSupported: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (name: string, email: string, password: string, passwordConfirm: string) => Promise<void>;
  logout: () => Promise<void>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => void;
  biometricLogin: () => Promise<boolean>;
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

      // Check for existing token
      const token = secureStorage.getToken();
      if (token) {
        try {
          const response = await axios.get('/api/users/me');
          setUser(response.data.data.user);
          secureStorage.setLastActivity();
        } catch (error) {
          console.error('Failed to fetch user:', error);
          secureStorage.removeToken();
          setUser(null);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []); // Empty dependency array - run only once on mount

  // Set up activity tracking and session monitoring
  useEffect(() => {
    // Set up activity tracking
    const handleActivity = () => {
      if (user) {
        secureStorage.setLastActivity();
      }
    };

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Check for session expiration periodically
    const sessionCheckInterval = setInterval(() => {
      if (user && secureStorage.isSessionExpired(30)) {
        console.log('Session expired due to inactivity');
        logout();
      }
    }, 60000); // Check every minute

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      clearInterval(sessionCheckInterval);
    };
  }, [user]); // This effect can depend on user for activity tracking

  if (loading) {
    return <div>Loading...</div>;
  }

  const login = async (email: string, password: string, rememberMe = false) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      
      if (response.data.access_token) {
        // Store token with remember me option
        secureStorage.setToken(response.data.access_token, rememberMe);
        
        // Fetch user profile
        const userResponse = await axios.get('/api/users/me');
        setUser(userResponse.data.data.user);
        secureStorage.setLastActivity();
        
        console.log('Login successful');
      }
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        throw new Error(error.response?.data?.message || 'Login failed');
      }
      throw new Error('An unexpected error occurred');
    }
  };
  
  const register = async (name: string, email: string, password: string, passwordConfirm: string) => {
    try {
      await axios.post('/api/auth/register', {
        name,
        email,
        password,
        passwordConfirm,
      });
      // Token storage is handled by axios interceptor
      
      // Fetch user profile
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
      await axios.get('/api/auth/logout');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      // Always clear local state
      secureStorage.removeToken();
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

  const biometricLogin = async (): Promise<boolean> => {
    if (!biometricEnabled) {
      return false;
    }

    try {
      const result = await biometricService.authenticate();
      if (result.success && result.userId) {
        // Refresh the user session
        await refreshUser();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Biometric login failed:', error);
      return false;
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const response = await axios.get('/api/users/me');
      setUser(response.data.data.user);
      secureStorage.setLastActivity();
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
        biometricLogin,
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