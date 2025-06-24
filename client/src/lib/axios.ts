import axios, { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { secureStorage } from '@/services/secure-storage.service';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true, // Required for handling cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = secureStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Store the token if it's in the response
    const token = response.data?.access_token;
    if (token) {
      // Preserve remember me setting when storing new token
      const hasRememberMe = secureStorage.hasRememberMe();
      secureStorage.setToken(token, hasRememberMe);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Don't retry refresh endpoint to prevent infinite loops
    if (originalRequest.url?.includes('/api/auth/refresh')) {
      return Promise.reject(error);
    }

    // If the error is due to an expired token and we haven't tried to refresh yet
    if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh the token
        const response = await axiosInstance.get('/api/auth/refresh');
        const newToken = response.data.access_token;
        if (newToken) {
          // Preserve remember me setting when storing refreshed token
          const hasRememberMe = secureStorage.hasRememberMe();
          secureStorage.setToken(newToken, hasRememberMe);
          // Update the authorization header for the retry
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
        }
        // Retry the original request
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // If refresh fails, clear token and redirect to login
        secureStorage.removeToken();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;