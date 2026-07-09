import api, { handleApiError } from './api';

export const authService = {
  login: async (username, password) => {
    try {
      const response = await api.post('/api/login', { username, password });
      return response.data.user;
    } catch (error) {
      handleApiError(error);
    }
  },

  logout: async () => {
    try {
      await api.post('/api/logout');
    } catch (error) {
      handleApiError(error);
    }
  },

  register: async (userData) => {
    try {
      const response = await api.post('/api/register', userData);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  checkAuth: async () => {
    try {
      const response = await api.get('/api/me');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  updateTheme: async (themeMode) => {
    try {
      await api.put('/api/profile/theme', { theme_mode: themeMode });
    } catch (error) {
      handleApiError(error);
    }
  }
};
