import api, { handleApiError } from './api';

export const budgetService = {
  getBudgetVersions: async (projectId) => {
    try {
      const response = await api.get(`/api/projects/${projectId}/budget-versions`);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getBudgetValues: async (projectId, versionId = null) => {
    try {
      const url = versionId 
        ? `/api/budget-values/project/${projectId}?version_id=${versionId}`
        : `/api/budget-values/project/${projectId}`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getBudgetBreakdown: async (projectId, versionId, itemId) => {
    try {
      const response = await api.get(`/api/budget-values/breakdown`, {
        params: { project_id: projectId, version_id: versionId, item_id: itemId }
      });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  saveBudgetBreakdown: async (payload) => {
    try {
      const response = await api.post('/api/budget-values/breakdown', payload);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  updateBudgetValuesBatch: async (payload) => {
    try {
      const response = await api.post('/api/budget-values/batch', payload);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  createDepartment: async (data) => {
    try {
      const response = await api.post('/api/departments', data);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  createCategory: async (data) => {
    try {
      const response = await api.post('/api/categories', data);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  createBudgetItem: async (data) => {
    try {
      const response = await api.post('/api/budget-items', data);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  cloneBudgetVersion: async (projectId, versionId) => {
    try {
      const response = await api.post(`/api/projects/${projectId}/budget-versions`, { source_version_id: versionId });
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  publishBudgetVersion: async (versionId, settings) => {
    try {
      const response = await api.put(`/api/budget-versions/${versionId}/publish`, settings);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  deleteBudgetVersion: async (versionId) => {
    try {
      const response = await api.delete(`/api/budget-versions/${versionId}`);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  }
};
