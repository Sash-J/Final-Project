import axios from 'axios';
import { API } from '../config';

// Configure a centralized axios instance
const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// We can set up the 401 interceptor here, or provide a way to inject it.
// Since AuthContext needs to update its state when a 401 happens,
// we will expose a function to register the interceptor.
export const setupInterceptors = (onUnauthorized) => {
  const interceptor = api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (
        error.response &&
        error.response.status === 401 &&
        window.location.pathname !== '/login'
      ) {
        onUnauthorized();
      }
      return Promise.reject(error);
    }
  );
  return () => api.interceptors.response.eject(interceptor);
};

// Helper for standard error throwing
export const handleApiError = (error) => {
  const message = error.response?.data?.error || error.response?.data?.message || error.message || 'An unexpected error occurred';
  throw new Error(message);
};

export default api;
