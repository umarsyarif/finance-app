import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor — auto-refresh on 401/403
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (originalRequest.url?.includes('/api/auth/refresh')) {
      return Promise.reject(error);
    }

    if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await axiosInstance.get('/api/auth/refresh');
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
