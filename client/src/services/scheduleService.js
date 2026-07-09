import api, { handleApiError } from './api';

export const scheduleService = {
  getTasks: async (year, month) => {
    try {
      const response = await api.get('/api/schedule/tasks', {
        params: { year, month }
      });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getTaskNotes: async (taskId) => {
    try {
      const response = await api.get(`/api/schedule/tasks/${taskId}/notes`);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  updateTaskNotes: async (taskId, notes) => {
    try {
      const response = await api.put(`/api/schedule/tasks/${taskId}/notes`, { notes });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  bulkSaveTasks: async (payload) => {
    try {
      const response = await api.post('/api/schedule/bulk-save', payload);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  }
};
