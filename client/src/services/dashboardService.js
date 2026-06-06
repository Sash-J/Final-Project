import api, { handleApiError } from './api';

export const dashboardService = {
  getAdminDashboard: async () => {
    try {
      const response = await api.get('/api/dashboard/admin');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getClientDashboard: async () => {
    try {
      const response = await api.get('/api/dashboard/client');
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getCrewDashboard: async () => {
    try {
      const response = await api.get('/api/dashboard/crew');
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
