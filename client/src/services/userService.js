import api, { handleApiError } from './api';

export const userService = {
  getProfile: async () => {
    try {
      const response = await api.get('/api/profile');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  updateProfile: async (profileData) => {
    try {
      const response = await api.put('/api/profile', profileData);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getCrew: async () => {
    try {
      const response = await api.get('/api/crew');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getClients: async () => {
    try {
      const response = await api.get('/api/clients');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getPendingUsers: async () => {
    try {
      const response = await api.get('/api/admin/pending-users');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getUsers: async () => {
    try {
      const response = await api.get('/api/admin/users');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getRoles: async () => {
    try {
      const response = await api.get('/api/admin/roles');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  approveUser: async (userId, role) => {
    try {
      const payload = { user_id: userId };
      if (role) payload.role = role;
      const response = await api.post('/api/admin/approve-user', payload);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  rejectUser: async (userId) => {
    try {
      const response = await api.post('/api/admin/reject-user', { user_id: userId });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  updateUserRole: async (userId, role) => {
    try {
      const response = await api.post('/api/admin/update-user-role', { user_id: userId, role });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  deleteUser: async (userId) => {
    try {
      const response = await api.post('/api/admin/delete-user', { user_id: userId });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  }
};
