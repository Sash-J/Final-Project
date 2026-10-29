import api, { handleApiError } from './api';

export const dashboardService = {
  getClientDashboard: async () => {
    try {
      const response = await api.get('/api/client/dashboard');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getFinancialSummary: async () => {
    try {
      const response = await api.get('/api/admin/finance/summary');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getFinancialProjects: async () => {
    try {
      const response = await api.get('/api/admin/finance/projects');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  }
};
