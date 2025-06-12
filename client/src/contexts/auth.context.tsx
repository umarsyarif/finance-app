import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import axios from '@/lib/axios';
import { AxiosError } from 'axios';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, passwordConfirm: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      axios.get('/api/users/me')
        .then(response => {
          setUser(response.data.data.user);
        })
        .catch(error => {
          console.error('Failed to fetch user:', error);
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      // Token storage is handled by axios interceptor
      
      if (response.data.access_token) {
        console.log('login success');
        // Fetch user profile
        const userResponse = await axios.get('/api/users/me');
        setUser(userResponse.data.data.user);
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
      localStorage.removeItem('access_token');
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear the token and user state even if the API call fails
      localStorage.removeItem('access_token');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        register,
        logout,
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